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
};
export const CUT_LABEL = { pad: 'DECK CAM · Ⓑ skip', kb: 'DECK CAM · any key skips' };

// The shot for a fall at x.
export const shotFor = x => ({
  from: { x: x + DECKCAM.FROM.dx, y: DECKCAM.FROM.y, z: DECKCAM.FROM.z },
  at: { x, y: DECKCAM.AT.y, z: DECKCAM.AT.z },
});

// e: the deckFall event ({ x, k: the fall's number today }). me: { driving, diving, lift (riding the Lift or in the
// EVA), kitchen (the overlay is open), menu (any card is up), down (knocked down, s), replays (the setting, default on) }.
// Returns null (no cut), { wait: true, secs, until } (the cook: play the short cut once the kitchen closes, within
// KITCHEN_WAIT s), or { secs, from, at }.
export function cutPlan(e, me = {}, k = e?.k ?? 1) {
  if (!e || !Number.isFinite(e.x)) return null;
  if (me.replays === false) return null;
  if (me.driving || me.diving || me.lift || me.menu || (me.down ?? 0) > 0) return null;
  const secs = (k ?? 1) > 1 ? DECKCAM.SECS_LATER : DECKCAM.SECS;
  if (me.kitchen) return { wait: true, secs: DECKCAM.SECS_LATER, until: DECKCAM.KITCHEN_WAIT, ...shotFor(e.x) };
  return { secs, ...shotFor(e.x) };
}

// Does this input skip the cut? { buttons: [bool | { pressed }], sticks: [x, y, ...], key: bool }.
export function skips({ buttons = [], sticks = [], key = false } = {}) {
  if (key) return true;
  if (buttons.some(b => (typeof b === 'object' ? b?.pressed : b))) return true;
  return sticks.some(v => Math.abs(v ?? 0) > DECKCAM.STICK);
}

// Where the cut is at t s of `secs`: { on, k } (k 0..1). Ends at secs, or on the BONK (bonked: true).
export const cutAt = (t, secs, bonked = false) => (bonked || t >= secs ? { on: false, k: 1 } : { on: true, k: Math.max(0, t / secs) });
