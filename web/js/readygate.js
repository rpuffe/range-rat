// Council round 13 8.2 / 8.3 (builder 4): the report's Ready / Next shift press. Pure: no DOM (test/fixes13.test.mjs).
//   8.3 (C #14): a held Ⓐ/Space skipped the final report: the Space that closed the note card was still down when the
//       report's Next shift took focus, and its key-up clicked it. Ready now ignores Ⓐ/Space/Enter for GRACE s after
//       any card closes (a story card, the note card), and a key press must have gone DOWN after that card (a fresh
//       press: its key-up alone never readies). A mouse click is always deliberate.
//   8.2 (A #6): a double press. The button shows its pressed state at once (PRESSED s), and a second press inside
//       that is the same press.
export const READY = Object.freeze({ GRACE: 1.5, PRESSED: 1.0, KEY_WINDOW: 0.05 });

export function createReadyGate({ grace = READY.GRACE, pressed = READY.PRESSED } = {}) {
  let cardAt = -Infinity, downAt = -Infinity, keyAt = -Infinity, pressAt = -Infinity;
  return {
    // t (s), every ~100 ms: is a card up right now? The last moment one was is when the grace starts.
    frame(t, cardUp) { if (cardUp) cardAt = t; },
    // a Space/Enter keydown (repeat: the browser's auto-repeat of a held key, which is never a fresh press)
    keyDown(t, repeat = false) { keyAt = t; if (!repeat) downAt = t; },
    keyUp(t) { keyAt = t; },
    // via: 'mouse' (a real click), or omitted: a key if a Space/Enter event is happening now, else the pad (whose Ⓐ is
    // already edge-triggered, so a held Ⓐ never presses twice).
    allow(t, via = null) {
      const how = via ?? (t - keyAt <= READY.KEY_WINDOW ? 'key' : 'pad');
      if (t - pressAt < pressed) return false;
      if (how !== 'mouse') {
        if (t - cardAt < grace) return false;
        if (how === 'key' && !(downAt > cardAt)) return false;
      }
      pressAt = t;
      return true;
    },
    pressedNow: t => t - pressAt < pressed,
  };
}
