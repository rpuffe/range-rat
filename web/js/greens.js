// "On the green" (council round 10 #6): the greens mean something from day 1. Pure rules: no THREE, no DOM; the
// server module (server/venues/greens.mjs) and the view (views/greens.js) read this.
// A CREW ball (from a crew bay: b.by is a Rat) that comes to rest on a green (inside the bowl's r, MAP.BOWLS) at the
// Muni or the Club adds GREENS.HUSTLE to Hustle (sharing the cap), at most GREENS.PER_SHIFT times a shift. At Tiered
// and later the green has a cup and the same ball is a TARGET (server/venues/tiered.mjs) instead.
import { MAP } from './map.js';
import { inBowl } from './tiered.js';

export const GREENS = {
  HUSTLE: 0.1,          // added to Hustle (crew.mult), under the same cap as pings and TARGETs
  PER_SHIFT: 5,         // so it can't be farmed
  TARGET_VENUE: 2,      // from Tiered on the green is a TARGET instead
  TIP: 'Land a crew ball on a green: Hustle.',
};

// Does this resting ball count as "on the green"? Returns the bowl, or null.
// b: { x, z, by, kind, sunk, drifting }; venue; crew: is b.by a Rat (the caller decides); n: how many counted today.
export function onGreen(b, { venue = 0, crew = false, n = 0, shift = true } = {}) {
  if (!b || !crew || !shift || (venue | 0) >= GREENS.TARGET_VENUE || n >= GREENS.PER_SHIFT) return null;
  if (b.kind === 'one' || b.sunk || b.drifting) return null;
  return inBowl(b.x, b.z, MAP.BOWLS, 0);
}
