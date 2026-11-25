// The County (venue 4): customers slice into the Yards, Zoning Compliance counts the strays, drones fetch them.
// Council round 4, section 3.3. Pure rules live in web/js/county.js; the look is web/js/views/county.js.
import { SIM, KIND_W, WASH } from '../../web/js/sim.js';
import { SLICE, ZONING, DRONES, DISPATCH, strayCount, zoning, droneCount, droneTarget, droneStep, newZone, zoneLive,
  HAZ, VAN, hazChance, inHazZone, hazardCount, zoningWith, vanTow, vanPick } from '../../web/js/county.js';
import { nearestReturn } from '../../web/js/layout.js';
import { tubeFeed } from '../../web/js/dive.js';

const r2 = v => Math.round(v * 100) / 100;
const PARK = { x: SIM.STAND.x, z: SIM.STAND.z, stand: true, idle: true };

function fleet(crew, st) {                      // keep the drone list at the row's size (they spawn at the stand)
  const want = droneCount(crew.up);
  while (st.drones.length < want) {
    const i = st.drones.length;
    st.drones.push({ id: `dr${i}`, x: SIM.STAND.x + (i % 2) * 1.6, y: DRONES.ALT, z: SIM.STAND.z + 1.5 - (i >> 1) * 1.6, yaw: 0, pocket: 0, pocketW: 0, target: null });
  }
}

// stepDrones lives here, NOT in stepHelpers. A drone flies at y 6 ignoring the creek, the kerb and wading; takes strays
// first, then the nearest ball; carries 25; dips to y 1 to grab; banks at the stand. It is never knocked down: it is
// not in crew.helpers or crew.players, so no ball, cart or mower ever asks it.
// Council round 10 §C/§D: a drone banks at the NEAREST return (a field return's pipe THUNKs its load home in 6 s), and a
// dispatch zone (st.zone) is cleared first.
const homeFor = (crew, d) => { const r = nearestReturn(d.x, d.z, crew.perks?.returns ?? 0); return { x: r.x, z: r.z, stand: true, at: r.id }; };
export function stepDrones(crew, st, dt) {
  fleet(crew, st);
  if (!st.drones.length) return;
  const working = crew.working();
  st.t = (st.t ?? 0) + dt;
  if (st.zone && !zoneLive(st.zone, st.t)) { st.zone = null; crew.dirty = true; }
  const zone = st.zone;
  const claimed = new Set(st.drones.map(d => d.target).filter(v => v != null));
  for (const d of st.drones) {
    let goal = null;
    if (d.pocket >= DRONES.POCKET || (d.pocket > 0 && !working)) goal = homeFor(crew, d);
    else if (working) {
      let b = d.target != null ? crew.balls.get(d.target) : null;
      // A dispatch re-aims each drone once (it drops a target outside the zone for one inside).
      if (b && zone && Math.hypot(b.x - zone.x, b.z - zone.z) > zone.r && d.retarget !== zone.until) { d.retarget = zone.until; b = null; }
      if (!b || !b.rest) {
        claimed.delete(d.target); d.target = null;
        b = droneTarget(d, crew.balls.values(), claimed, zone);
        if (b) { d.target = b.id; claimed.add(b.id); }
      }
      if (b) goal = { x: b.x, z: b.z, grab: true, ball: b };
      else if (d.pocket > 0) goal = homeFor(crew, d);
    }
    const there = droneStep(d, goal ?? PARK, dt);
    if (!there || !goal) continue;
    if (goal.stand) {
      if (goal.at && goal.at !== 'main' && crew.tube) {   // a field return: into its pipe, banked at the return 6 s later
        tubeFeed(crew.tube, crew.tubeClock ?? 0, { n: d.pocket, w: d.pocketW || d.pocket, factor: 1 });
        Object.assign(crew.tube.q.at(-1), { by: d.id, kind: 'helper' });
        crew.events.push({ t: 'tube', id: d.id, at: goal.at });
      } else crew.bank(d.pocket, d.id, 'helper', d.pocketW || d.pocket);
      d.pocket = 0; d.pocketW = 0;
    } else if (goal.ball) {
      crew.balls.delete(goal.ball.id);
      const k = crew.loadOf(goal.ball);
      d.pocket += k; d.pocketW += (KIND_W[goal.ball.kind] ?? 1) * (k === 3 ? 3 : 1); d.target = null;
      crew.stats.picked += k; crew.dirty = true;
      crew.events.push({ t: 'gone', id: goal.ball.id, by: d.id });
    }
  }
}

// Council round 10 §D: Ⓨ held on foot (drones owned): "Drones, here!" pins a 20 m zone at you for 30 s.
function dispatch(crew, st, p) {
  if (!st.drones.length || !crew.working() || p.down > 0 || crew.driving(p) || p.diving) return true;
  st.zone = newZone(p.x, p.z, st.t ?? 0);
  for (const d of st.drones) d.retarget = null;
  crew.events.push({ t: 'dispatch', by: p.id, x: +p.x.toFixed(1), z: +p.z.toFixed(1), r: DISPATCH.R, secs: DISPATCH.SECS });
  crew.dirty = true;
  return true;
}

// ---- round 11 (expert #9): the wand on a hazard. a: { t: 'hazspray', id, secs } (crew.wash's 'h:<id>' target) -------
const clock = crew => crew.custT ?? 0;
function wetIds(crew) {                                // the hazards wet right now (a short list: the client's prompt and sheen)
  if (crew.venue !== 4) return [];
  const now = clock(crew), out = [];
  for (const b of crew.balls.values()) if (b.kind === 'hazard' && b.wetUntil > now && out.length < 16) out.push(b.id);
  return out;
}                 // the monotonic server clock (wet timers)
function hazSpray(crew, st, p, a) {
  const b = crew.balls.get(a.id);
  if (!b || b.kind !== 'hazard' || !p.wand || p.down > 0 || !(a.secs > 0)) return true;
  if (Math.hypot(b.x - p.x, b.z - p.z) > (crew.perks?.washReach ?? WASH.RANGE) + 1.5) return true;
  const now = clock(crew);
  if (b.wetUntil > now) { b.wetUntil = now + HAZ.WET; return true; }   // keep it wet while you spray it
  b.spray = (b.spray ?? 0) + Math.min(a.secs, 0.5);
  if (b.spray + 1e-9 >= HAZ.SPRAY) {
    b.spray = 0; b.wetUntil = now + HAZ.WET; b.sprayBy = p.id;
    crew.events.push({ t: 'hazwet', id: b.id, by: p.id, secs: HAZ.WET });
    crew.dirty = true;
  }
  return true;
}

// A hazard nobody bagged in HAZ.LIFE s is written off: a range ball again (not while it's wet).
function expire(crew) {
  const now = clock(crew);
  for (const b of crew.balls.values()) {
    if (b.kind !== 'hazard' || b.wetUntil > now || now - (b.hazAt ?? now) < HAZ.LIFE) continue;
    b.kind = 'range'; b.hands = false; b.spray = 0;
    crew.events.push({ t: 'hazgone', id: b.id });
  }
}

// ---- round 11 (expert #6): below the line, Zoning's van tows balls off the field every VAN.EVERY s -----------------
function van(crew, st, dt) {
  if (st.van && (st.van.left -= dt) <= 0) { st.van = null; crew.dirty = true; }
  if (!crew.working() || crew.closing?.() || st.kpi + 1e-9 >= VAN.LINE) { st.vanT = 0; return; }
  if ((st.vanT += dt) < VAN.EVERY) return;
  st.vanT = 0;
  const towed = vanPick(crew.balls.values(), vanTow(crew.onlineCount()));
  for (const b of towed) { crew.balls.delete(b.id); crew.events.push({ t: 'gone', id: b.id, by: 'van' }); }
  st.vans++; st.towed += towed.length;
  crew.stats.towed = (crew.stats.towed ?? 0) + towed.length;
  st.van = { left: VAN.SECS };
  crew.events.push({ t: 'van', n: towed.length, k: st.vans });
  crew.dirty = true;
}

export default {
  id: 'county',
  venue: 4,

  init() { return { drones: [], strays: 0, z: 0, kpi: 1, said: false, haz: 0, hz: false, vanT: 0, vans: 0, towed: 0, bagged: 0 }; },

  startShift(crew, st) {
    st.z = 0; st.strays = 0; st.kpi = 1; st.zone = null; st.haz = 0; st.hz = false; st.vanT = 0; st.vans = 0; st.towed = 0; st.bagged = 0; st.van = null;
    for (const d of st.drones) { d.x = SIM.STAND.x; d.z = SIM.STAND.z + 1.5; d.y = DRONES.ALT; d.pocket = 0; d.pocketW = 0; d.target = null; }
  },

  tick(crew, st, dt) {
    stepDrones(crew, st, dt);
    if (!st.said && st.drones.length) { st.said = true; crew.pa('drones', { once: true, big: true }); }
    if ((st.z += dt) >= ZONING.EVERY) {          // the stray count, recomputed every half second
      st.z = 0;
      st.strays = strayCount(crew.balls.values());
      // Round 11 (expert #6): at the County itself, every hazard lying out counts against Zoning too.
      if (crew.venue === 4 && !crew.closing?.()) expire(crew);   // the cleanup doesn't write them off: bag them before the bell
      st.haz = crew.venue === 4 ? hazardCount(crew.balls.values()) : 0;
      st.kpi = zoningWith(st.strays, st.haz);
    }
    if (crew.venue === 4) van(crew, st, dt);
  },

  // Round 11 (expert #9): a County customer ball that rests inside the hose's reach turns hazard with HAZ.CHANCE.
  onRest(crew, st, b) {
    if (crew.venue !== 4 || crew.endless || !crew.working() || b.by != null || b.kind !== 'range' || b.sunk || b.creek || b.drifting) return;
    if (!inHazZone(b.x, b.z, WASH.STATION) || crew.rng() >= hazChance(crew.onlineCount())) return;
    b.kind = 'hazard'; b.hands = true; b.hazAt = crew.custT ?? 0;
    if (!st.hz) st.hz = true;
    crew.events.push({ t: 'hazard', id: b.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2) });
    crew.dirty = true;
  },

  // The wand on a hazard ('h:<id>' wash target): HAZ.SPRAY s of spray makes it wet for HAZ.WET s.
  input(crew, st, p, a) {
    if (a.t === 'hazspray') return hazSpray(crew, st, p, a);
    if (a.t !== 'dispatch') return false;
    return dispatch(crew, st, p);
  },

  // A Rat picks up a hazard: wet, it's bagged on the spot (it pays HAZ.W); dry, it's refused.
  take(crew, st, p, b) {
    if (b.kind !== 'hazard') return false;
    if (!(b.wetUntil > clock(crew))) return false;
    crew.balls.delete(b.id); crew.stats.picked++;
    st.bagged++; crew.stats.bagged = (crew.stats.bagged ?? 0) + 1;
    const team = b.sprayBy && b.sprayBy !== p.id;
    crew.events.push({ t: 'gone', id: b.id, by: p.id }, { t: 'hazbag', id: b.id, by: p.id, name: p.name, ...(team ? { team: b.sprayBy } : {}) });
    const c0 = crew.stats.cash;
    crew.bank(1, p.id, null, HAZ.W, null, { haz: 1 });
    crew.stats.hazCash = Math.round(((crew.stats.hazCash ?? 0) + crew.stats.cash - c0) * 100) / 100;
    st.haz = Math.max(0, st.haz - 1); st.kpi = zoningWith(st.strays, st.haz);
    crew.dirty = true;
    return true;
  },

  endShift(crew, st) {                           // the drones bank what they carry, like the helpers
    for (const d of st.drones) { crew.bank(d.pocket, d.id, 'helper', d.pocketW || d.pocket); d.pocket = 0; d.pocketW = 0; d.target = null; }
  },

  // 40% of customer shots slice: curve 1.0-2.0 (see SLICE), bending right. The pond's heavy lead balls keep their line.
  launchMod(crew, st, shot, { lead }) {
    if (lead) return shot;
    if (crew.rng() < SLICE.CHANCE) return { ...shot, curve: SLICE.MIN + crew.rng() * (SLICE.MAX - SLICE.MIN) };
    return shot;
  },

  kpi: (crew, st) => st.kpi,

  snapshot: (crew, st) => ({
    strays: st.strays, kpi: r2(st.kpi),
    ...(st.zone ? { zone: { x: r2(st.zone.x), z: r2(st.zone.z), r: st.zone.r, left: r2(st.zone.until - (st.t ?? 0)) } } : {}),
    drones: st.drones.map(d => ({ id: d.id, x: r2(d.x), y: r2(d.y), z: r2(d.z), yaw: r2(d.yaw), n: d.pocket })),
    ...(st.hz ? { hz: 1, haz: st.haz, wet: wetIds(crew) } : {}), ...(st.van ? { van: r2(VAN.SECS - st.van.left) } : {}), ...(st.vans ? { vans: st.vans, towed: st.towed } : {}),
  }),
};
