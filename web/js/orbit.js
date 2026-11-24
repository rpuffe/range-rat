// Range Rat: the Orbital's shared rules (council round 4, section 3.4 and build item 9): the Lift, orbit shots,
// the EVA, the tether. Pure and DOM-free: the server module (server/venues/orbit.mjs), the view (views/orbit.js) and
// sim.js (which appends TETHER_ROW to SHOP) all read the same numbers from here.
//
// DELIBERATELY does not import sim.js (sim.js imports THIS file for TETHER_ROW: a cycle is a TDZ crash). It reuses
// the Deep End's air rules from dive.js (airStep, pumpGain, diveTiers), which imports nothing.
import { airStep, pumpGain, diveTiers, PUMP } from './dive.js';
import { MAP } from './map.js';

export const ORBIT = {
  SHOT: 0.05,          // the share of customer shots that go straight up
  VY: 70,              // m/s, straight up
  LEAVE_Y: 150,        // a ball above this has left: it becomes a debris id
  CAP: 60,             // debris ids kept (a saved Set); a shot past the cap just leaves
  RIDE: 5,             // seconds, up and down
  R: 11,               // m: the EVA disc around the car
  GRAB: 2.2,           // m: how close debris must be to grab it
  GRAB_SLACK: 0.3,     // the server forgives this much walking lag
  TETHER_EVERY: 8,     // s: the winch clears one
  KPI_AT: 30,          // Orbital Debris = 1 - debris / 30
  SWIM_MUL: 1.2,       // EVA drift speed: your dive tier's swim x this
  EYE0: 1.7,           // m: the camera at the platform
  TOP: MAP.LIFT.TOP,   // m: 120
  BAG_W: 3,            // KIND_W.debris (mirrored; test/orbit.test.mjs pins it)
  PUMP_REACH: 3.4,     // m from the car: a buddy this close cranks the O2
};

export const LIFT = { x: MAP.LIFT.x, z: MAP.LIFT.z };
export const TETHER_ROW = {
  id: 'tether', title: 'Orbital tether winch', minVenue: 5, tiers: [
    { name: 'Hands and a prayer', desc: 'Debris is retrieved by hand, in a spacesuit. The suit was sized for someone else.' },
    { name: 'Orbital tether winch', cost: 6_000_000, desc: 'Reels in one piece of debris every 8 s, all shift. A winch on a 400 m tower. Corporate calls it "the tether". The EVA becomes optional.' },
  ],
};
export const tetherTier = up => Math.max(0, Math.min(TETHER_ROW.tiers.length - 1, (up?.tether ?? 0) | 0));
export const hasTether = up => tetherTier(up) >= 1;

// ---- debris ----------------------------------------------------------------------------------------------------
const GOLDEN = 2.39996;       // rad: the golden angle
// Where debris `id` floats, relative to the top of the Lift (x, z in metres east/south of the car, y above the car).
// Deterministic, never streamed: every client and the server agree. Always inside ORBIT.R.
export function debrisSpot(id) {
  const n = Math.abs(Math.floor(+id || 0));
  const a = n * GOLDEN, r = 3 + (n % 7) * 1.2;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, y: Math.sin(n * 1.7) * 1.5 };
}
// Flat distance from a local EVA position (x, z relative to the car) to debris `id`.
export function debrisDist(id, lx, lz) {
  const s = debrisSpot(id);
  return Math.hypot(s.x - lx, s.z - lz);
}
// The nearest id (of `ids`) within `reach` of the local spot, or null.
export function nearestDebris(ids, lx, lz, reach = ORBIT.GRAB) {
  let best = null, bd = reach;
  for (const id of ids) { const d = debrisDist(id, lx, lz); if (d <= bd) { bd = d; best = id; } }
  return best;
}
// A shot that goes up: straight up from where it was launched, nothing sideways.
export const orbitShot = shot => ({ ...shot, vx: 0, vz: 0, vy: ORBIT.VY, curve: 0, orbit: true });
// The live gauge.
export const debrisKpi = n => Math.max(0, Math.min(1, 1 - n / ORBIT.KPI_AT));

// ---- the ride and the float --------------------------------------------------------------------------------------
const ease = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
// Camera height for a rider: 'up' rises 1.7 -> 120 over RIDE seconds, 'out' sits at the top, 'down' falls back.
export function rideHeight(ph, t) {
  const k = ease(t / ORBIT.RIDE), span = ORBIT.TOP - ORBIT.EYE0;
  if (ph === 'up') return ORBIT.EYE0 + span * k;
  if (ph === 'down') return ORBIT.EYE0 + span * (1 - k);
  return ORBIT.TOP;
}
// How "in space" the ride is, 0..1 (the sky fades to stars as this rises; the fog pushes out).
export const spaceness = h => ease((h - 20) / (ORBIT.TOP - 20));

// Keep an EVA position inside the disc around the car. Mutates and returns p.
export function clampDisc(p) {
  const dx = p.x - LIFT.x, dz = p.z - LIFT.z, d = Math.hypot(dx, dz);
  if (d > ORBIT.R) { p.x = LIFT.x + dx * ORBIT.R / d; p.z = LIFT.z + dz * ORBIT.R / d; }
  return p;
}
export const atLift = (p, r = ORBIT.PUMP_REACH) => Math.hypot(p.x - LIFT.x, p.z - LIFT.z) <= r;
export const evaSwim = tier => tier.swim * ORBIT.SWIM_MUL;

// One step of a spacewalker's oxygen: the dive tier's air, no Deep End drain (the Lift is nowhere near it), plus
// whatever the buddy on the platform cranked. Returns { air, gasp }.
export function evaStep({ air, dt, tier, gain = 0 }) {
  return airStep({ air, dt, tier, x: LIFT.x, z: LIFT.z, gain });
}
// What one buddy cranks this step: the pond's pump rules (turns capped, or the held-button trickle).
export const crankGain = ({ turns = 0, held = false, dt }) => pumpGain({ turns, held, dt });
// The cap on the whole platform's gain: two pumpers' worth, like the dock.
export const maxGain = dt => PUMP.MAX_TPS * PUMP.SECS_PER_TURN * 2 * dt;
export { diveTiers };
