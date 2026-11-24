// Tiered Entertainment Range (venue 2): the Target Greens, Bay Utilization, Target Practice, the gutters
// (council-round4.md §3.1 and build item 4). Pure rules: no THREE, no DOM.
// DELIBERATELY imports nothing from sim.js: sim.js imports GUTTERS_ROW from this file, so importing it back would be
// a cycle (a TDZ crash when this file loads first). map.js is a leaf, so MAP.BOWLS is safe to read.
import { MAP } from './map.js';

// Bay Utilization: the venue's fourth gauge. Balls resting in cups block the sensors; 40 in the cups is an empty dial.
export const CUP_FULL = 40;
export const bayUtil = cupBalls => Math.max(0, Math.min(1, 1 - Math.max(0, cupBalls || 0) / CUP_FULL));

// The bowl a resting point lies inside (r, not the cup), or null. The rule is flat: no heightfield.
export function inBowl(x, z, bowls = MAP.BOWLS) {
  for (const b of bowls) if (Math.hypot(x - b.x, z - b.z) < b.r) return b;
  return null;
}
export const bowlById = (id, bowls = MAP.BOWLS) => bowls.find(b => b.id === id) ?? null;

// Where ball `id` lies in the cup: a deterministic scatter over a disc of the cup radius (a hash, no RNG state).
export function cupSpot(id, bowl) {
  let h = Math.imul((id | 0) ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  const u = (h >>> 0) / 4294967296;
  let g = Math.imul(h ^ 0x27d4eb2f, 0x165667b1); g ^= g >>> 15;
  const v = (g >>> 0) / 4294967296;
  const rr = bowl.cup * 0.92 * Math.sqrt(u), a = v * Math.PI * 2;
  return { x: bowl.x + Math.cos(a) * rr, z: bowl.z + Math.sin(a) * rr };
}

// Target Practice: a crew ball resting in a bowl flushes that cup to the shooter.
export const TARGET = {
  HUSTLE: 0.25,        // added to the Hustle multiplier (shares the cart's cap with pings)
  GEAR: 1,             // the flush banks at gear x1
  STROBE: 3,           // s the neon pin strobes
  TWEEN_SPEED: 4,      // m/s the client rolls a ball into its cup (dist / 4 s)
};

// Automation: the ball-return gutters drain one ball a second from each cup to the stand.
export const GUTTERS = { PER_SEC: 1, FROM_TIER: 1 };
export const GUTTERS_ROW = {
  id: 'gutters', title: 'Ball-return gutters', minVenue: 2, tiers: [
    { name: 'Cups fill up', desc: 'Balls that roll into a Target Green stay there until somebody empties the cup.' },
    { name: 'Ball-return gutters', cost: 100000, desc: 'Buried pipes drain 1 ball a second from each cup to the stand, at gear x1. There is a glass section at each cup, so you can watch. Corporate calls this "visibility".' },
  ],
};
export const hasGutters = up => ((up?.gutters ?? 0) | 0) >= GUTTERS.FROM_TIER;
