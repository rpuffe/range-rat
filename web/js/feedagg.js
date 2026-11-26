// Council round 11 8.10 (builder 4; B #8): helper knockdowns spammed the feed. They aggregate: the first fall in a
// minute shows at once (with the helper's name); the rest of that minute fold into one "Helpers flattened ×3" line
// when the minute is up. Pure: an injectable clock, no DOM (main.js feeds it and calls due() on a timer).
export const FALL_AGG = { SECS: 60 };

export function createFallAgg({ now = () => Date.now() / 1000, secs = FALL_AGG.SECS } = {}) {
  let until = -Infinity, held = 0;
  return {
    // A helper fell: the line to show now, or null (it's counted for the minute's line).
    add(line) {
      const t = now();
      if (t >= until) { until = t + secs; held = 0; return line; }
      held++;
      return null;
    },
    // The minute's line once it's up ("Helpers flattened ×3"), or null. The next fall after it opens a new minute.
    due() {
      if (!held || now() < until) return null;
      const line = `Helpers flattened ×${held}`;
      held = 0; until = now() + secs;   // this line counts as the minute's one line
      return line;
    },
    get held() { return held; },
    get until() { return until; },
  };
}
