// The hub's ball-flow chain (owner layout, 2026-11-24), as plain numbers: no THREE, no DOM, unit-tested
// (test/layout.test.mjs). Balls are dropped at the RETURN (sim.js SIM.STAND: a bin by the mat line), ride a clear
// pipe to the BANK (the Board and its silo, sim.js BANK / SILO), and, once the crew owns the Ball washer row, go
// through the WASHER on the way: the pipe climbs into its hopper and its chute (washer.js) runs on to the silo.
// Customers take their bucket from a BASKET by the red BUCKETS dispenser (scenery.js), never from the return.
import { SIM, WASHER, SILO } from './sim.js';
import { MAP, creekProject, setTubePosts } from './map.js';   // round 11: the tube's posts block the cart

// The return bin is the old stand's box (main.js: 2 x 1 x 1.2 m); the pipe leaves its back (+z), low down.
export const RETURN = { x: SIM.STAND.x, z: SIM.STAND.z, W: 2, D: 1.2, H: 1 };
const OUT = { x: RETURN.x + 0.4, y: 0.72, z: RETURN.z + RETURN.D / 2 + 0.02 };

// Where a pipe meets the silo: on its skin, facing where the pipe comes from, at height y.
export function siloEntry(from, y) {
  const dx = SILO.x - from.x, dz = SILO.z - from.z, d = Math.hypot(dx, dz) || 1;
  return { x: SILO.x - dx / d * (SILO.R + 0.02), y, z: SILO.z - dz / d * (SILO.R + 0.02) };
}

// Before the washer: straight to the bank, a gentle fall (the balls roll). [x, y, z] control points.
const IN_SILO = siloEntry(OUT, 0.5);
export const PIPE_DIRECT = [
  [OUT.x, OUT.y, OUT.z],
  [OUT.x + (IN_SILO.x - OUT.x) * 0.33, 0.66, OUT.z + (IN_SILO.z - OUT.z) * 0.33],
  [OUT.x + (IN_SILO.x - OUT.x) * 0.66, 0.58, OUT.z + (IN_SILO.z - OUT.z) * 0.66],
  [IN_SILO.x, IN_SILO.y, IN_SILO.z],
];
// With the washer: the pneumatic riser up and over the hopper's rim (washer.js: rim at y 1.91, r 0.42), dropping in.
export const PIPE_WASHER = [
  [OUT.x, OUT.y, OUT.z],
  [OUT.x + 0.02, 1.35, OUT.z + 0.25],
  [WASHER.x - 0.02, 2.2, WASHER.z - 0.85],
  [WASHER.x, 2.32, WASHER.z - 0.4],
  [WASHER.x, 2.02, WASHER.z - 0.08],
];
export const PIPE_SECS = { direct: 1.7, washer: 1.5 };   // how long a ball takes along each

// The customers' basket: on the ground in front of the dispenser (scenery.js: the red box at 23.5, 8.5, its
// front at z 8.15), and where a customer stands to take a bucket, facing the machine (+z).
export const DISPENSER = { x: 23.5, z: 8.5 };
export const BASKET = { x: DISPENSER.x, z: 7.5, r: 0.32 };
export const BASKET_POINT = { x: DISPENSER.x, z: 6.8 };
// Owner playtest 3 §3.3: where a Rat fills buckets, 1.2 m east of the dispenser (beside its east side), clear of the
// customers' spot (BASKET_POINT).
export const FILL_POINT = { x: DISPENSER.x + 1.2, z: 8.2 };
// Round 11 (owner: "buckets overlap"): the basket's 12 bucket slots are a low rack west of the basket, 2 rows of 6,
// 0.4 m apart (a bucket is 0.34 m across: no two touch). y is the rack's top, where a bucket's base sits.
export const BUCKET = { R: 0.17, R0: 0.13, H: 0.26 };   // the range bucket: top radius, base radius, height
export const RACK = { x: DISPENSER.x - 1.55, z: 7.42, W: 2.5, D: 0.9, H: 0.1, GAP: 0.4 };
export const BASKET_SLOTS = Array.from({ length: 12 }, (_, i) => {
  const row = i < 6 ? 0 : 1, k = i % 6;
  return { x: RACK.x + (2.5 - k) * RACK.GAP, y: RACK.H, z: RACK.z + (row ? 0.21 : -0.21) };   // slot 0 nearest the dispenser
});
// Where buckets fill (round 11: "make it obvious"): one under each Rat chute on the dispenser's east side (main.js's
// stream of balls), and one under the filler's spout on its west side (SHOP `filler`; it shows only once bought).
export const CHUTE_BUCKETS = [{ x: DISPENSER.x + 0.66, z: 8.22 }, { x: DISPENSER.x + 0.66, z: 8.66 }];
export const FILLER = { x: DISPENSER.x - 0.72, z: 8.5, W: 0.5, D: 0.62, H: 1.25, SPOUT_Y: 0.78 };
export const FILLER_BUCKET = { x: FILLER.x, z: FILLER.z - 0.42 };

// The silo (board.js draws it: 2.5 m of clear tube, 2000 instanced balls in 33 layers of 62). Round 11: its fill shows the
// banked supply (basket.js siloFill), so the chutes drop their balls to that level. The y of the top of n balls.
export const SILO_BALLS = { MAX: 2000, PER_LAYER: 62, H: 2.5 };
export function siloLevelY(n) {
  const layers = Math.ceil(SILO_BALLS.MAX / SILO_BALLS.PER_LAYER), dy = (SILO_BALLS.H - 0.22) / (layers - 1);
  const k = Math.max(0, Math.min(SILO_BALLS.MAX, n | 0));
  return k <= 0 ? 0.1 : 0.16 + Math.floor((k - 1) / SILO_BALLS.PER_LAYER) * dy + 0.05;
}
// Round 11: the silo feeds the dispenser: a clear pipe from the silo's foot, low behind the Board, up the dispenser's
// back and into its glass dome (scenery.js: dome top at y 1.92). Balls run along it while a bucket fills.
export const PIPE_FEED = [
  [SILO.x - 0.1, 0.3, SILO.z + SILO.R + 0.02],
  [SILO.x - 0.4, 0.22, SILO.z + 1.6],
  [DISPENSER.x + 2.2, 0.22, DISPENSER.z + 1.05],
  [DISPENSER.x + 0.3, 0.3, DISPENSER.z + 0.75],
  [DISPENSER.x + 0.1, 1.2, DISPENSER.z + 0.5],
  [DISPENSER.x, 1.86, DISPENSER.z + 0.2],
];

// Council round 10 §C: the field ball returns (the crew row 'returns', sim.js perks().returns: 1 = the Field
// return, 2 = + the Back return). A red FHI box out in the field: Ⓧ there sends your pocket home through its
// buried pneumatic pipe, and it THUNKs into the main RETURN TUBE_SECS later (dive.js TUBE.DELAY, the pond tube's
// queue), through the washer like any bank. Rats on foot and drones use them; the cart and teenagers never do.
// Round 11 (owner): both returns sit across the creek (the outflow), far out, and their pneumatic tube runs above ground
// on posts all the way back to the main RETURN (TUBE_TRUNK, TUBE_BRANCH): balls whoosh through it in batches.
export const FIELD_RETURNS = [
  { id: 'field', tier: 1, x: 44, z: -130, label: 'RETURN 2' },  // the Far return: across the creek, past the Stones
  { id: 'back', tier: 2, x: -6, z: -128, label: 'RETURN 3' },   // by Blue (the Club); its tube joins the Far return's
];
export const FIELD_RETURN = { REACH: 2.0, W: 0.8, D: 0.6, H: 1.5 };   // the pond tube's box, taller
// The tube: up out of the Far return's lid, north along x 50 (clear of the Track, the bowls and the County kerb) at
// 3.8 m, then west over the hub and down into the main RETURN's bin top. The Back return's branch runs east along
// z -124 and meets the trunk at TUBE_JOIN. [x, y, z] control points; posts stand under the high stretches.
export const RETURN_TUBE = { R: 0.3, HIGH: 3.8, SECS: 5.6, POST_EVERY: 9 };   // SECS: the whoosh, just inside dive.js TUBE.DELAY (6 s)
export const TUBE_JOIN = [49, RETURN_TUBE.HIGH, -124];
export const TUBE_TRUNK = [
  [44, 1.62, -130], [44, 3.0, -130.1], [45.6, 3.7, -128.4], TUBE_JOIN,
  [50, RETURN_TUBE.HIGH, -112], [50, RETURN_TUBE.HIGH, -84], [50, RETURN_TUBE.HIGH, -56], [50, RETURN_TUBE.HIGH, -28],
  [48.6, RETURN_TUBE.HIGH, -9], [42, 3.7, -2.6], [33.5, 3.4, 0.2], [29.2, 2.8, 1.5], [27.75, 1.9, 1.8], [27.6, 1.08, 1.8],
];
export const TUBE_BRANCH = [
  [-6, 1.62, -128], [-6, 3.0, -127.9], [-4.6, 3.7, -126], [2, RETURN_TUBE.HIGH, -124], [18, RETURN_TUBE.HIGH, -124], [34, RETURN_TUBE.HIGH, -124], TUBE_JOIN,
];
// The tube's posts (round 11): every POST_EVERY m along each line (from half a step in), under the high stretches
// (y ≥ 2.6) and never in the creek. { x, z, y, yaw, tier }: tier 1 the trunk (the Far return), 2 the Back branch.
// One list for the drawing (ballreturn.js) and the cart's collision (map.js cartBlocked, registered here).
function linePosts(pts, tier) {
  const out = [];
  let acc = 0, next = RETURN_TUBE.POST_EVERY / 2;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0, z0] = pts[i - 1], [x1, y1, z1] = pts[i], L = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
    while (L > 0 && next <= acc + L) {
      const t = (next - acc) / L, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, z = z0 + (z1 - z0) * t;
      next += RETURN_TUBE.POST_EVERY;
      if (y < 2.6 || (z < -30 && z > -125 && creekProject(x, z).d < MAP.CREEK.HW + 0.6)) continue;
      out.push({ x, y, z, yaw: Math.atan2(x1 - x0, z1 - z0), tier });
    }
    acc += L;
  }
  return out;
}
export const TUBE_POSTS = [...linePosts(TUBE_TRUNK, 1), ...linePosts(TUBE_BRANCH, 2)];
setTubePosts(TUBE_POSTS);
// The whole run from a return to the bin (the Back return's: its branch, then the trunk from the join on).
export const tubeRoute = id => (id === 'back' ? [...TUBE_BRANCH, ...TUBE_TRUNK.slice(TUBE_TRUNK.indexOf(TUBE_JOIN) + 1)] : TUBE_TRUNK);
// The returns the crew owns (from the row's tier).
export const fieldReturns = (tier = 0) => FIELD_RETURNS.filter(r => r.tier <= (tier | 0));
// The owned field return a point is at (within REACH), or null.
export function atFieldReturn(p, tier = 0) {
  for (const r of fieldReturns(tier)) if (Math.hypot(p.x - r.x, p.z - r.z) < FIELD_RETURN.REACH) return r;
  return null;
}
// The nearest place to bank from (x, z): the main return or an owned field return. { x, z, id } (id 'main' for RETURN).
export function nearestReturn(x, z, tier = 0) {
  let best = { x: RETURN.x, z: RETURN.z, id: 'main' }, bd = Math.hypot(x - RETURN.x, z - RETURN.z);
  for (const r of fieldReturns(tier)) { const d = Math.hypot(x - r.x, z - r.z); if (d < bd) { bd = d; best = { x: r.x, z: r.z, id: r.id }; } }
  return best;
}
