// The Orbital (venue 5): the Lift, orbit shots, the EVA and the tether (council round 4, §3.4, build item 9).
// Orbit shots become saved debris ids; a Rat rides the Lift up, floats in a disc round the car (the dive tier's air
// and bag; council round 8 #4: no platform crank, the tank is the tank), grabs debris and rides down with it at weight
// 3 a ball. Any number of Rats ride at once.
// Orbital Debris (this venue's gauge) = 1 - debris / 30. The tether winch (crew row) clears one every 8 s.
// Round 11 (expert #10a): only debris brought down counts toward Balls Outstanding here (DEBRIS_BALLS a piece, crew.mjs
// countDebris), so the Orbital lasts 2 full shifts and the EVA races the countdown.
//
// Actions (the `input` hook): {t:'lift'} {t:'grab'} {t:'ridedown'} ({t:'orbpump'} from an old client: swallowed).
import { ORBIT, LIFT, debrisKpi, orbitShot, nearestDebris, clampDisc, atLift, evaStep, hasTether,
  diveTiers } from '../../web/js/orbit.js';

const PLATFORM_R = 2.4;                       // "on the platform": this close to the car
const cleanIds = a => [...new Set((Array.isArray(a) ? a : []).filter(n => Number.isInteger(n) && n >= 0))].sort((x, y) => x - y).slice(0, ORBIT.CAP);
const PH = { up: 0, out: 1, down: 2 };

export default {
  id: 'orbit',
  venue: 5,

  init(crew, saved) {
    const debris = new Set(cleanIds(saved?.d));
    const next = Math.max(Number.isInteger(saved?.n) ? saved.n : 0, debris.size ? Math.max(...debris) + 1 : 0);
    return { debris, next, riders: new Map(), tetherAcc: 0, kpi: debrisKpi(debris.size) };
  },
  startShift(crew, st) { st.riders.clear(); st.tetherAcc = 0; },

  // 5% of customer shots go straight up. (Lead balls stay in the pond business.) None while the Last Bucket is on
  // (round 7 #5: the crew is clearing the sky for Ball No. 1, and the sky must not refill behind them).
  launchMod(crew, st, shot, { lead, upper }) {   // council round 10 #3: the upper bays never orbit (keeps the debris tuned)
    if (lead || upper || shot.kind === 'one' || (crew.lastBucket && crew.lastBucket.phase !== 'done')) return undefined;
    return crew.rng() < ORBIT.SHOT ? orbitShot(shot) : undefined;
  },

  tick(crew, st, dt) {
    // 1. Shots that have left the atmosphere become ids (a ball entity is not kept).
    for (const b of crew.balls.values()) {
      if (!b.orbit || b.y <= ORBIT.LEAVE_Y) continue;
      crew.balls.delete(b.id); crew.events.push({ t: 'gone', id: b.id });
      leave(crew, st);
    }
    // 2. The riders. (Council round 8 #4: the platform crank is gone; EVA air is the dive tier's tank.)
    for (const [id, r] of st.riders) {
      const p = crew.players.get(id);
      if (!p) { st.riders.delete(id); continue; }
      if ((p.online <= 0 || p.down > 0) && r.ph !== 'down') reel(crew, st, p, r);
      // The Last Bucket needs everyone at the stand: the Lift brings every rider home (bag kept, it lands
      // in the pocket). It keeps running through that pause; only a venue reveal holds it. Not while the sky is the
      // job (round 7 #5, phase 'sky'): once it clears, Ball No. 1 falls and everyone still up rides down.
      if (crew.lastBucket && crew.lastBucket.phase !== 'done' && crew.lastBucket.phase !== 'sky' && r.ph !== 'down') {
        r.ph = 'down'; r.t = 0; pin(p); crew.events.push({ t: 'lift', id: p.id, dir: 'down' });
      }
      if (crew.paused() && !(crew.lastBucket && crew.lastBucket.phase !== 'done')) continue;
      const tier = diveTiers(p.dive);
      if (r.ph === 'up') { r.t += dt; pin(p); if (r.t >= ORBIT.RIDE) { r.ph = 'out'; r.t = 0; } }
      else if (r.ph === 'out') {
        const s = evaStep({ air: r.air, dt, tier });
        r.air = s.air; clampDisc(p);
        if (s.gasp) reel(crew, st, p, r);
      } else {
        r.t += dt; pin(p);
        if (r.t >= ORBIT.RIDE) land(crew, st, p, r);
      }
    }
    // 3. The tether winch: one piece every 8 s, banked at weight 3.
    if (crew.working() && hasTether(crew.up)) {
      st.tetherAcc += dt;
      while (st.tetherAcc >= ORBIT.TETHER_EVERY - 1e-9) {
        st.tetherAcc -= ORBIT.TETHER_EVERY;
        const id = st.debris.size ? Math.min(...st.debris) : null;
        if (id == null) continue;
        st.debris.delete(id); st.kpi = debrisKpi(st.debris.size);
        crew.bank(1, 'tether', null, ORBIT.BAG_W, 1);
        crew.countDebris?.(1);   // round 11: a piece down counts DEBRIS_BALLS toward Balls Outstanding
        crew.stats.winched = (crew.stats.winched ?? 0) + 1;
        crew.events.push({ t: 'winch', deb: id });
      }
    } else if (!hasTether(crew.up)) st.tetherAcc = 0;
  },

  input(crew, st, p, a) {
    switch (a.t) {
      case 'lift': {
        if (st.riders.has(p.id) || !crew.working() || p.down > 0 || crew.driving(p) || p.one || p.diving) return true;
        if (!atLift(p, PLATFORM_R)) return true;
        st.riders.set(p.id, { ph: 'up', t: 0, air: diveTiers(p.dive).air, bag: [] });
        pin(p); p.movedAt = crew.now(); p.pumping = false;
        crew.events.push({ t: 'lift', id: p.id, dir: 'up' });
        crew.pa('eva', { once: true, big: true });
        return true;
      }
      case 'grab': {
        const r = st.riders.get(p.id);
        if (!r || r.ph !== 'out' || p.down > 0 || r.bag.length >= diveTiers(p.dive).bag) return true;
        const id = nearestDebris(st.debris, p.x - LIFT.x, p.z - LIFT.z, ORBIT.GRAB + ORBIT.GRAB_SLACK);
        if (id == null) return true;
        st.debris.delete(id); r.bag.push(id); st.kpi = debrisKpi(st.debris.size);
        crew.events.push({ t: 'grabbed', id: p.id, deb: id });
        return true;
      }
      case 'ridedown': {
        const r = st.riders.get(p.id);
        if (r && r.ph === 'out') { r.ph = 'down'; r.t = 0; pin(p); crew.events.push({ t: 'lift', id: p.id, dir: 'down' }); }
        return true;
      }
      case 'orbpump': return true;   // round 8 #4: the crank is gone; an old client's tap changes nothing
      default: return false;
    }
  },

  // A rider places the walker: pinned to the car on the ride, inside the disc while floating.
  clamp(crew, st, p) {
    const r = st.riders.get(p.id);
    if (!r) return undefined;
    if (r.ph === 'out') clampDisc(p); else pin(p);
    return true;
  },

  // The bell: anyone still out comes down, and the bag banks (the carriers have already been paid).
  endShift(crew, st) {
    for (const [id, r] of [...st.riders]) {
      const p = crew.players.get(id);
      if (p) land(crew, st, p, r, true); else st.riders.delete(id);
    }
  },

  kpi: (crew, st) => st.kpi,

  snapshot(crew, st) {
    const r = {};
    for (const [id, x] of st.riders) r[id] = [PH[x.ph], +x.t.toFixed(2), +x.air.toFixed(1), x.bag.length];
    return { d: [...st.debris], r, w: hasTether(crew.up) ? 1 : 0 };
  },
  toSave: (crew, st) => (st.next || st.debris.size ? { d: [...st.debris], n: st.next } : undefined),
};

// Debris still overhead (the sky gate in crew.mjs beginLastBucket / stepLastBucket reads it).
export const debrisLeft = st => st?.debris?.size ?? 0;

function pin(p) { p.x = LIFT.x; p.z = LIFT.z; }

// A shot left the atmosphere: it gets the next id, unless the sky is full (then it just leaves).
function leave(crew, st) {
  if (st.debris.size < ORBIT.CAP) { st.debris.add(st.next); st.next++; }
  st.kpi = debrisKpi(st.debris.size);
  crew.stats.orbited = (crew.stats.orbited ?? 0) + 1;
  crew.events.push({ t: 'orbit', n: st.debris.size });
}

// Out of O2 (or knocked flat, or gone): the tether reels you in, the bag spills back into orbit (same ids).
function reel(crew, st, p, r) {
  for (const id of r.bag) st.debris.add(id);
  r.bag = []; st.kpi = debrisKpi(st.debris.size);
  r.ph = 'down'; r.t = 0; r.air = diveTiers(p.dive).air * 0.5; pin(p);
  crew.events.push({ t: 'reel', id: p.id });
}

// The ride is over: the bag goes to your pocket at weight 3 a ball (capacity ignored, like surfacing).
function land(crew, st, p, r, atBell = false) {
  st.riders.delete(p.id);
  const n = r.bag.length;
  if (r.ph !== 'down') pin(p);
  if (n) {
    if (!atBell) { p.pocket += n; p.pocketW = (p.pocketW ?? 0) + n * ORBIT.BAG_W; crew.dirty = true; }
    else crew.bank(n, p.id, null, n * ORBIT.BAG_W);
    crew.stats.debris = (crew.stats.debris ?? 0) + n;
    crew.countDebris?.(n);   // round 11: what comes down from orbit is what counts (DEBRIS_BALLS a piece)
  }
  p.x = LIFT.x + 1.6; p.z = LIFT.z + 0.4; p.movedAt = crew.now();
  crew.events.push({ t: 'landed', id: p.id, n });
}
