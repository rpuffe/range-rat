// Round 11 (expert #7, "stations never make you wait"): the kitchen hands a full tray to whoever walks past.
// Pure rules, no THREE, no DOM: the server (crew.mjs) keeps the tray; the kitchen card and the HUD read the snapshot.
//
// A hot dog that would be wasted (the crew is already FED to the cap, so it adds nothing) goes on the shed's warm
// tray instead (up to TRAY.MAX). Later, once FED has worn down far enough for a dog to count, any Rat who walks past
// the shed window (atShed, on foot, not knocked flat) carries the top dog out: it FEDs the crew as if just served.
// So a cook can prep ahead and leave the shed; a 2P crew keeps "Keep the crew fed" ticking without camping the kitchen.
// A dog keeps HOLD_SECS of working time on the tray, then goes cold and is binned.
import { FED } from './sim.js';

export const TRAY = { MAX: 2, HOLD_SECS: 150 };
export const DOG_ADD = { perfect: FED.PERFECT, good: FED.GOOD };

export const newTray = () => ({ dogs: [] });   // [{ q: 'good' | 'perfect', left: secs }]

// A served dog added `gain` to FED (food.js fedServe). Nothing (the cap)? It goes on the tray if there's room.
// Returns true when it went on the tray.
export function trayServe(t, quality, gain) {
  if (gain > 0 || !DOG_ADD[quality] || t.dogs.length >= TRAY.MAX) return false;
  t.dogs.push({ q: quality, left: TRAY.HOLD_SECS });
  return true;
}

// Would the top dog count now? Only once FED has room for its whole add.
export const trayWanted = (t, fed) => t.dogs.length > 0 && (fed ?? 1) + DOG_ADD[t.dogs[0].q] <= FED.MAX + 1e-9;

// Working time passes: dogs go cold. Returns how many were binned.
export function trayTick(t, dt) {
  let n = 0;
  for (let i = t.dogs.length - 1; i >= 0; i--) if ((t.dogs[i].left -= dt) <= 0) { t.dogs.splice(i, 1); n++; }
  return n;
}

// Take the top dog (the caller FEDs the crew with its quality). Returns its quality or null.
export const trayTake = t => (t.dogs.length ? t.dogs.shift().q : null);
