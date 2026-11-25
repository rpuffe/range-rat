// The hub's ball-flow chain (owner layout, 2026-11-24), as plain numbers: no THREE, no DOM, unit-tested
// (test/layout.test.mjs). Balls are dropped at the RETURN (sim.js SIM.STAND: a bin by the mat line), ride a clear
// pipe to the BANK (the Board and its silo, sim.js BANK / SILO), and, once the crew owns the Ball washer row, go
// through the WASHER on the way: the pipe climbs into its hopper and its chute (washer.js) runs on to the silo.
// Customers take their bucket from a BASKET by the red BUCKETS dispenser (scenery.js), never from the return.
import { SIM, WASHER, SILO } from './sim.js';

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
// customers' spot (BASKET_POINT). The basket's 12 bucket slots: a little heap on the ground beside the basket.
export const FILL_POINT = { x: DISPENSER.x + 1.2, z: 8.2 };
export const BASKET_SLOTS = Array.from({ length: 12 }, (_, i) => {
  const row = i < 5 ? 0 : i < 9 ? 1 : i < 11 ? 2 : 3, k = [0, 5, 9, 11][row], m = [5, 4, 2, 1][row];
  return { x: BASKET.x - 0.85 + (i - k - (m - 1) / 2) * 0.34, y: 0.15 + row * 0.26, z: BASKET.z + 0.05 };
});
