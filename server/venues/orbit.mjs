// The Orbital (venue 5): the Lift, orbit shots, the EVA and the tether (council round 4, §3.4, build item 9).
// Orbit shots become saved debris ids; a Rat rides the Lift up, floats in a disc round the car (the dive tier's air
// and bag, a buddy on the platform cranking the O2), grabs debris and rides down with it at weight 3 a ball.
// Orbital Debris (this venue's gauge) = 1 - debris / 30. The tether winch (crew row) clears one every 8 s.
//
// Actions (the `input` hook): {t:'lift'} {t:'grab'} {t:'ridedown'} {t:'orbpump', turns, held}.
import { ORBIT, LIFT, debrisKpi, orbitShot, nearestDebris, clampDisc, atLift, evaStep, crankGain, maxGain, hasTether,
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
    return { debris, next, riders: new Map(), pump: new Map(), tetherAcc: 0, kpi: debrisKpi(debris.size) };
  },
  startShift(crew, st) { st.riders.clear(); st.pump.clear(); st.tetherAcc = 0; },

  // 5% of customer shots go straight up. (Lead balls stay in the pond business.)
  launchMod(crew, st, shot, { lead }) {
    if (lead || shot.kind === 'one') return undefined;
    return crew.rng() < ORBIT.SHOT ? orbitShot(shot) : undefined;
  },

  tick(crew, st, dt) {
    // 1. Shots that have left the atmosphere become ids (a ball entity is not kept).
    for (const b of crew.balls.values()) {
      if (!b.orbit || b.y <= ORBIT.LEAVE_Y) continue;
      crew.balls.delete(b.id); crew.events.push({ t: 'gone', id: b.id });
      leave(crew, st);
    }
    const now = crew.now();
    // 2. Buddies on the platform crank the O2 (the pond's pump rules).
    let gain = 0;
    for (const p of crew.players.values()) {
      const pm = st.pump.get(p.id);
      if (!pm) continue;
      const live = p.online > 0 && p.down <= 0 && !st.riders.has(p.id) && atLift(p, PLATFORM_R + 1);
      const turns = live ? Math.min(pm.turns, 2.5 * dt) : 0;
      pm.turns = live ? Math.max(0, pm.turns - turns) : 0;
      const held = live && pm.held && now - pm.at < 1500;
      pm.on = live && (held || now - pm.at < 400);
      if (live) gain += crankGain({ turns, held: held && turns === 0, dt });
    }
    gain = Math.min(gain, maxGain(dt));
    // 3. The riders.
    for (const [id, r] of st.riders) {
      const p = crew.players.get(id);
      if (!p) { st.riders.delete(id); continue; }
      if ((p.online <= 0 || p.down > 0) && r.ph !== 'down') reel(crew, st, p, r);
      if (crew.paused()) continue;
      const tier = diveTiers(p.dive);
      if (r.ph === 'up') { r.t += dt; pin(p); if (r.t >= ORBIT.RIDE) { r.ph = 'out'; r.t = 0; } }
      else if (r.ph === 'out') {
        const s = evaStep({ air: r.air, dt, tier, gain });
        r.air = s.air; clampDisc(p);
        if (s.gasp) reel(crew, st, p, r);
      } else {
        r.t += dt; pin(p);
        if (r.t >= ORBIT.RIDE) land(crew, st, p, r);
      }
    }
    // 4. The tether winch: one piece every 8 s, banked at weight 3.
    if (crew.working() && hasTether(crew.up)) {
      st.tetherAcc += dt;
      while (st.tetherAcc >= ORBIT.TETHER_EVERY - 1e-9) {
        st.tetherAcc -= ORBIT.TETHER_EVERY;
        const id = st.debris.size ? Math.min(...st.debris) : null;
        if (id == null) continue;
        st.debris.delete(id); st.kpi = debrisKpi(st.debris.size);
        crew.bank(1, 'tether', null, ORBIT.BAG_W, 1);
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
      case 'orbpump': {
        if (st.riders.has(p.id) || !atLift(p, PLATFORM_R + 1)) { st.pump.delete(p.id); return true; }
        const pm = st.pump.get(p.id) ?? { turns: 0, held: false, at: 0, on: false };
        const turns = Number(a.turns);
        if (Number.isFinite(turns) && turns > 0) { pm.turns = Math.min(1, pm.turns + Math.min(turns, 1)); pm.at = crew.now(); }
        pm.held = !!a.held; if (pm.held) pm.at = crew.now();
        st.pump.set(p.id, pm);
        return true;
      }
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
    st.pump.clear();
  },

  kpi: (crew, st) => st.kpi,

  snapshot(crew, st) {
    const r = {};
    for (const [id, x] of st.riders) r[id] = [PH[x.ph], +x.t.toFixed(2), +x.air.toFixed(1), x.bag.length];
    const pumping = []; for (const [id, pm] of st.pump) if (pm.on) pumping.push(id);
    return { d: [...st.debris], r, p: pumping.length ? pumping : undefined, w: hasTether(crew.up) ? 1 : 0 };
  },
  toSave: (crew, st) => (st.next || st.debris.size ? { d: [...st.debris], n: st.next } : undefined),
};

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
  }
  p.x = LIFT.x + 1.6; p.z = LIFT.z + 0.4; p.movedAt = crew.now();
  crew.events.push({ t: 'landed', id: p.id, n });
}
