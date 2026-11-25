// Tiered Entertainment Range (venue 2): the Target Greens, Bay Utilization, Target Practice, the gutters
// (council-round4.md §3.1 and build item 4). Pure rules: no THREE, no DOM.
// DELIBERATELY imports nothing from sim.js: sim.js imports GUTTERS_ROW from this file, so importing it back would be
// a cycle (a TDZ crash when this file loads first). map.js is a leaf, so MAP.BOWLS is safe to read.
import { MAP } from './map.js';

// Bay Utilization: the venue's fourth gauge. Balls resting in cups block the sensors; 30 in the cups is an empty dial
// (council round 6 #2: was 40, which left an idle crew a free pass on the gauge stamp).
export const CUP_FULL = 30;
// Council round 10 #3: the upper bays add supply, so the dial grows 2 a bay in play: 42 at 4P (6 bays), 38 at 2P, 34 solo.
export const CUP_PER_UPPER = 2;
export const cupFull = (upper = 0) => CUP_FULL + CUP_PER_UPPER * Math.max(0, upper | 0);
export const bayUtil = (cupBalls, full = CUP_FULL) => Math.max(0, Math.min(1, 1 - Math.max(0, cupBalls || 0) / full));

// The bowl a resting point lies inside (r, not the cup), or null. The rule is flat: no heightfield.
// `pad` widens every bowl by that many metres: crew balls use TARGET.LIP (council round 6, #4), customers 0.
export function inBowl(x, z, bowls = MAP.BOWLS, pad = 0) {
  for (const b of bowls) if (Math.hypot(x - b.x, z - b.z) < b.r + pad) return b;
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
  LIP: 1.5,            // m: a crew ball resting within r + LIP is a TARGET (council round 6, #4); customers cup inside r
};

// Automation: the ball-return gutters. Council round 7 (#1): at Tiered they are LINKED and never drain on their own;
// a TARGET drains all three cups to the shooter. From the Stadium on (venue > LINKED_VENUE, Bay Utilization is not
// graded) they drain one ball a second from each cup to the stand, as before: pure convenience there.
export const GUTTERS = { PER_SEC: 1, FROM_TIER: 1, LINKED_VENUE: 2 };
export const GUTTERS_ROW = {
  id: 'gutters', title: 'Ball-return gutters', minVenue: 2, tiers: [
    { name: 'Cups fill up', desc: 'Balls that roll into a Target Green stay there until somebody empties the cup.' },
    { name: 'Ball-return gutters', cost: 50000, desc: 'Linked pipes under every green. A TARGET drains all three cups.' },
  ],
};
export const hasGutters = up => ((up?.gutters ?? 0) | 0) >= GUTTERS.FROM_TIER;
// A TARGET drains every cup (linked gutters) rather than just its own.
export const drainsAll = (up, venue) => hasGutters(up) && (venue | 0) >= GUTTERS.LINKED_VENUE;
// The gutters drain on their own (1 a second a cup) only after Tiered.
export const guttersDrain = (up, venue) => hasGutters(up) && (venue | 0) > GUTTERS.LINKED_VENUE;

// Council round 8 (#1): the Glow Rush. At Tiered a glow ball resting in a cup counts GLOW_CUP towards the cup count
// and Bay Utilization. Glow balls only spawn in Last Call (crew.mjs tick), so this is a Last Call rule with no clock
// check: the cups fill twice as fast at dusk and the TARGET that saves the stamp lands in the last ~30 s. The flush
// still banks real balls (ballCount), not this weight. From the Stadium on, a glow ball counts as one.
export const RUSH = { GLOW_CUP: 2, VENUE: 2 };
// What one resting ball adds to its cup's count: a splitter 3, a glow ball 2 at Tiered, anything else 1.
export function cupWeight(b, venue) {
  if (b?.kind === 'splitter') return 3;
  if (b?.kind === 'glow' && (venue | 0) === RUSH.VENUE) return RUSH.GLOW_CUP;
  return 1;
}

// Council round 8 #6 (B2): the report card's line for the TARGET that lifted Bay Utilization over the tick in Last Call
// (the module's snapshot `saved`: { by, name, left }). Only on a stamped bell; "" otherwise. 6 words.
export const clockText = secs => { const s = Math.max(0, Math.round(secs || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
export function savedLine(saved, report) {
  if (!saved || !report?.quota?.hit || (report.venue ?? RUSH.VENUE) !== RUSH.VENUE) return '';
  return `Saved by ${saved.name || 'a Rat'}'s TARGET at ${clockText(saved.left)}.`;
}
