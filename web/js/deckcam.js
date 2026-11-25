// The Deck Cam (council round 10 #4, §2b): when a lounger falls off the Upper Deck, each client cuts its own camera
// to a fixed shot of the fall for 2.6 s (1.8 s for a shift's 2nd and later falls), letterboxed, "DECK CAM · Ⓑ skip"
// at the bottom-left edge. Any button, or a stick past 0.5, skips it. It is the main camera, moved, then put back
// (main.js owns it); views/deck.js slows the drop to ×0.4 while it runs and calls the cut off on the BONK.
// Pure: no THREE, no DOM. test/deckcam.test.mjs.

export const DECKCAM = {
  SECS: 2.6,          // the first fall of a shift
  SECS_LATER: 1.8,    // the 2nd and later
  KITCHEN_WAIT: 5,    // the cook gets the short cut after closing the kitchen, if within this
  STICK: 0.5,         // a stick past this skips
  FROM: { dx: 3.5, y: 1.4, z: -2.5 },   // the shot: from (x + 3.5, 1.4, -2.5), up at the rail from the mat line...
  AT: { y: 2.2, z: 1.8 },               // ...looking at (x, 2.2, 1.8)
  BARS: 0.08,         // the letterbox: 8% top and bottom
  SLOW: 0.4,          // the drop's speed while the cut runs (views/deck.js)
  // Playthrough 5 B4: the short cut (a repeat, or the cook's) showed the lean and the deck's underside, and the bay's
  // customer filled a third of it. It plays the lean ×3 and the drop at SLOW_LATER (lean 0.12 s + drop 1.6 s: the
  // BONK lands inside 1.8 s), from higher and further back, over the customers' heads, down at the drop's middle.
  LEAN_LATER: 3,
  SLOW_LATER: 0.65,
  FROM_LATER: { dx: 2, y: 3.4, z: -4.5 },
  AT_LATER: { y: 1.6, z: 1.6 },
};
export const CUT_LABEL = { pad: 'DECK CAM · Ⓑ skip', kb: 'DECK CAM · any key skips' };

// The shot for a fall at x (later: the short cut's shot).
export const shotFor = (x, later = false) => {
  const F = later ? DECKCAM.FROM_LATER : DECKCAM.FROM, A = later ? DECKCAM.AT_LATER : DECKCAM.AT;
  return { from: { x: x + F.dx, y: F.y, z: F.z }, at: { x, y: A.y, z: A.z } };
};
// The fall's clock rate while a cut runs (views/deck.js): u < 0.25 is the lean. secs: the cut's length.
export const fallRate = (u, secs) => {
  const later = secs < DECKCAM.SECS;
  return u < 0.25 ? (later ? DECKCAM.LEAN_LATER : 1) : later ? DECKCAM.SLOW_LATER : DECKCAM.SLOW;
};

// e: the deckFall event ({ x, k: the fall's number today }). me: { driving, diving, lift (riding the Lift or in the
// EVA), kitchen (the overlay is open), menu (any card is up), down (knocked down, s), replays (the setting, default on) }.
// Returns null (no cut), { wait: true, secs, until } (the cook: play the short cut once the kitchen closes, within
// KITCHEN_WAIT s), or { secs, from, at }.
export function cutPlan(e, me = {}, k = e?.k ?? 1) {
  if (!e || !Number.isFinite(e.x)) return null;
  if (me.replays === false) return null;
  if (me.driving || me.diving || me.lift || me.menu || (me.down ?? 0) > 0) return null;
  const secs = (k ?? 1) > 1 ? DECKCAM.SECS_LATER : DECKCAM.SECS;
  if (me.kitchen) return { wait: true, secs: DECKCAM.SECS_LATER, until: DECKCAM.KITCHEN_WAIT, ...shotFor(e.x, true) };
  return { secs, ...shotFor(e.x, secs < DECKCAM.SECS) };
}

// Does this input skip the cut? { buttons: [bool | { pressed }], sticks: [x, y, ...], key: bool }.
export function skips({ buttons = [], sticks = [], key = false } = {}) {
  if (key) return true;
  if (buttons.some(b => (typeof b === 'object' ? b?.pressed : b))) return true;
  return sticks.some(v => Math.abs(v ?? 0) > DECKCAM.STICK);
}

// Where the cut is at t s of `secs`: { on, k } (k 0..1). Ends at secs, or on the BONK (bonked: true).
export const cutAt = (t, secs, bonked = false) => (bonked || t >= secs ? { on: false, k: 1 } : { on: true, k: Math.max(0, t / secs) });
