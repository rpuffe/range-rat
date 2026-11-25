// Council round 10 #5: scuba in Dimple Creek, as a lazy river. Pure rules: no THREE, no DOM. The server (crew.mjs)
// decides who is under; the client (main.js) applies the current to its own movement with the same function.
//
// - Stay in running creek water (off the bridges) for CREEK_DIVE.DUCK_SECS and you duck under. A quick crossing
//   (the creek is 3.2 m wide) never dunks you.
// - Under, you drift downstream at CREEK_DIVE.CURRENT on top of your swim; you float under the bridges.
// - Walk out of the channel sideways to surface. The in-branch carries you into the pond (the pond dive takes over);
//   the out-branch holds you at the Grate's net until you climb out.
// - Air drains x CREEK_DIVE.AIR_MULT (the snorkel breaks the surface). Out of air, you pop up on the nearest bank.
import { CREEK_DIVE } from './dive.js';
import { clubOpenAt } from './clubdays.js';
import { MAP, inCreekWater, inCreekChannel, creekCurrent, creekProject, inPondArea } from './map.js';

const venueOf = world => world?.venue ?? 0;
export const creekOpen = world => venueOf(world) >= CREEK_DIVE.FROM_VENUE && clubOpenAt('creekDive', world);   // round 11: Club day 3

// One server step for one Rat. st: the Rat ({ x, z, creekT, creekDiving }); blocked: driving, aloft, down, the One.
// Mutates st.creekT / st.creekDiving. Returns 'under' (just ducked), 'up' (just surfaced), 'pond' (carried into the
// pond: the pond dive takes over) or null.
export function creekStep(st, dt, world, blocked = false) {
  if (!creekOpen(world) || blocked) {
    st.creekT = 0;
    if (st.creekDiving) { st.creekDiving = false; return 'up'; }
    return null;
  }
  if (st.creekDiving) {
    if (inPondArea(st.x, st.z)) { st.creekDiving = false; st.creekT = 0; return 'pond'; }
    if (!inCreekChannel(st.x, st.z, world)) { st.creekDiving = false; st.creekT = 0; return 'up'; }
    return null;
  }
  if (inCreekWater(st.x, st.z, world)) {
    st.creekT = (st.creekT ?? 0) + dt;
    if (st.creekT >= CREEK_DIVE.DUCK_SECS - 1e-9) { st.creekDiving = true; return 'under'; }
  } else st.creekT = 0;
  return null;
}

// The current on a diver's own movement (client) or a still diver (tests): moves pos by the flow for dt.
// Kept inside the channel: it never pushes you out sideways, and the Grate's net holds you.
export function applyCurrent(pos, dt, world) {
  const c = creekCurrent(pos.x, pos.z, world);
  if (!c.vx && !c.vz) return pos;
  pos.x += c.vx * dt; pos.z += c.vz * dt;
  return pos;
}

// Out of air in the creek: the nearest bank, 0.8 m past the water's edge on the side you were on.
export function bankSpot(x, z) {
  const q = creekProject(x, z), dx = x - q.x, dz = z - q.z, d = Math.hypot(dx, dz);
  let nx, nz;
  if (d > 1e-6) { nx = dx / d; nz = dz / d; }
  else { const o = creekProject(x + 0.01, z); nx = -(o.z - q.z) || 1; nz = (o.x - q.x) || 0; const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l; }
  const off = MAP.CREEK.HW + 0.8;
  return { x: q.x + nx * off, z: q.z + nz * off };
}

export const creekAir = dt => dt * CREEK_DIVE.AIR_MULT;   // the drain, in seconds of air, for dt in the creek

// Round 11 (expert #7, "stations never make you wait"): catch your breath on the move. After a creek dive, the air
// refills BREATH.WALK_MUL times as fast while you walk (or wade) to the next snag, so standing on the bank waiting is
// never the fastest way back under. Standing still refills at the normal land rate. Pure: st is the Rat
// ({ x, z, breathX, breathZ, lastCreek }); mutates the breath fields. Returns the refill multiplier for this step.
export const BREATH = { WALK_MUL: 3, MOVING: 0.6 };   // m/s: faster than this counts as walking
export function breathMul(st, dt) {
  const px = st.breathX, pz = st.breathZ;
  st.breathX = st.x; st.breathZ = st.z;
  if (!st.lastCreek || px == null || !(dt > 0)) return 1;
  return Math.hypot(st.x - px, st.z - pz) / dt > BREATH.MOVING ? BREATH.WALK_MUL : 1;
}
