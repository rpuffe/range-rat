// Range Rat: County Range shared rules (council round 4, section 3.3). Pure and DOM-free: the server module
// (server/venues/county.mjs), the view and the tests read the same numbers from here.
//
// DELIBERATELY does not import sim.js. sim.js imports DRONES_ROW from this file to append it to SHOP, so importing
// sim.js back would be a cycle (a TDZ crash when this file loads first). map.js is a leaf and is safe.
import { MAP } from './map.js';

// "Customers at the County fade the ball. Corporate does not use the word 'slice'."
// 40% of customer shots get a curve in [MIN, MAX): the crew swing's own curve physics, bending right (+x).
// Tuned: the doc's 0.6-1.4 puts only ~6% of shots in the Yards; 1.0-2.0 gives ~12% (the 10-15% target, pinned by test).
export const SLICE = { CHANCE: 0.4, MIN: 1.0, MAX: 2.0 };

// Zoning Compliance = 1 - strays / STRAY_CAP. A stray is a resting ball past the kerb (x > KERB_X).
export const ZONING = { STRAY_CAP: 30, EVERY: 0.5 };
export const isStray = b => !!b && !!b.rest && !b.sunk && b.kind !== 'one' && b.x > MAP.KERB_X;
export const strayCount = balls => { let n = 0; for (const b of balls) if (isStray(b)) n++; return n; };
export const zoning = strays => Math.max(0, Math.min(1, 1 - strays / ZONING.STRAY_CAP));

// The yard a spot is in (1..4), or 0 if it is not in the Yards. Fences split them at z -70, -110, -150.
export function yardAt(x, z) {
  const Y = MAP.YARDS;
  if (x <= Y.xMin || x > Y.xMax || z > Y.zMax || z < Y.zMin) return 0;
  let n = 1;
  for (const f of Y.FENCES) if (z < f) n++;
  return n;
}

// Drones: a crew row (price-scaled like every crew row). Tier 1 two drones, tier 2 four.
export const DRONES_ROW = {
  id: 'drones', title: 'Drones', minVenue: 4, tiers: [
    { name: 'No drones', desc: 'The Yards are cleared on foot. The county is watching.' },
    { name: 'Two drones', cost: 1200000, desc: 'They take the strays first, then the nearest ball. 10 m/s, 25 balls each, never knocked down. "They are not watching you."' },
    { name: 'Four drones', cost: 3000000, desc: 'Four of them. Zoning has stopped returning your calls, which is the good kind of quiet.' },
  ],
};
export const DRONE_COUNTS = [0, 2, 4];
export const droneTier = up => Math.max(0, Math.min(DRONES_ROW.tiers.length - 1, (up?.drones ?? 0) | 0));
export const droneCount = up => DRONE_COUNTS[droneTier(up)];

export const DRONES = {
  SPEED: 10,       // m/s, ignoring the creek, the kerb and wading
  ALT: 6,          // cruise height (y)
  GRAB_Y: 1,       // the dip to grab a ball
  DIP_R: 2.5,      // start dipping this close to the ball
  VSPEED: 6,       // m/s up and down
  POCKET: 25,      // balls carried
  GRAB_R: 0.5,     // horizontal reach for a grab
};

// Who a drone goes for: strays first (nearest to it), then the nearest ball. `claimed` is a Set of ball ids that
// other drones already want. Returns the ball or null.
export function droneTarget(d, balls, claimed = new Set()) {
  let best = null, bd = Infinity, bs = false;
  for (const b of balls) {
    if (!b.rest || b.sunk || b.kind === 'one' || claimed.has(b.id)) continue;
    const stray = isStray(b), dist = Math.hypot(b.x - d.x, b.z - d.z);
    if (stray === bs ? dist < bd : stray) { best = b; bd = dist; bs = stray; }
  }
  return best;
}

// One drone step toward goal {x, z, grab?}: flies at SPEED, climbs to ALT (dips to GRAB_Y close to a ball to grab).
// Mutates d {x, y, z, yaw}. Returns true once it is over the goal (and, for a grab, down at the ball).
export function droneStep(d, goal, dt) {
  const dx = goal.x - d.x, dz = goal.z - d.z, dist = Math.hypot(dx, dz);
  const step = Math.min(dist, DRONES.SPEED * dt);
  if (dist > 1e-6) { d.x += dx / dist * step; d.z += dz / dist * step; d.yaw = Math.atan2(-dx, -dz); }
  const left = dist - step;
  const want = goal.grab && left < DRONES.DIP_R ? DRONES.GRAB_Y : DRONES.ALT;
  const dy = want - d.y, vy = Math.min(Math.abs(dy), DRONES.VSPEED * dt);
  d.y += Math.sign(dy) * vy;
  return left < DRONES.GRAB_R && (!goal.grab || d.y <= DRONES.GRAB_Y + 0.05);
}
