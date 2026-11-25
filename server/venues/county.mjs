// The County (venue 4): customers slice into the Yards, Zoning Compliance counts the strays, drones fetch them.
// Council round 4, section 3.3. Pure rules live in web/js/county.js; the look is web/js/views/county.js.
import { SIM, KIND_W } from '../../web/js/sim.js';
import { SLICE, ZONING, DRONES, DISPATCH, strayCount, zoning, droneCount, droneTarget, droneStep, newZone, zoneLive } from '../../web/js/county.js';
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

export default {
  id: 'county',
  venue: 4,

  init() { return { drones: [], strays: 0, z: 0, kpi: 1, said: false }; },

  startShift(crew, st) {
    st.z = 0; st.strays = 0; st.kpi = 1; st.zone = null;
    for (const d of st.drones) { d.x = SIM.STAND.x; d.z = SIM.STAND.z + 1.5; d.y = DRONES.ALT; d.pocket = 0; d.pocketW = 0; d.target = null; }
  },

  tick(crew, st, dt) {
    stepDrones(crew, st, dt);
    if (!st.said && st.drones.length) { st.said = true; crew.pa('drones', { once: true, big: true }); }
    if ((st.z += dt) >= ZONING.EVERY) {          // the stray count, recomputed every half second
      st.z = 0;
      st.strays = strayCount(crew.balls.values());
      st.kpi = zoning(st.strays);
    }
  },

  // Council round 10 §D: Ⓨ held on foot (drones owned): "Drones, here!" pins a 20 m zone at you for 30 s.
  input(crew, st, p, a) {
    if (a.t !== 'dispatch') return false;
    if (!st.drones.length || !crew.working() || p.down > 0 || crew.driving(p) || p.diving) return true;
    st.zone = newZone(p.x, p.z, st.t ?? 0);
    for (const d of st.drones) d.retarget = null;
    crew.events.push({ t: 'dispatch', by: p.id, x: +p.x.toFixed(1), z: +p.z.toFixed(1), r: DISPATCH.R, secs: DISPATCH.SECS });
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
  }),
};
