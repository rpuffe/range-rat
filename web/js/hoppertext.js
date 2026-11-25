// Round 11 (owner: the hopper count "doesn't make a whole lot of sense"): every place a hopper count shows says what it
// holds, in balls, in plain words. Pure (no THREE, no DOM), unit-tested in test/range11.test.mjs.
//   the washer's front board (washer.js):  "34 DIRTY BALLS" / "WAITING TO WASH · +$68"
//   the crank prompt (round2.js):           "Hold A: crank 34 dirty balls clean (+$68)"
//   the dispenser window (props.js):        "SILO 0432" (the balls behind its glass are the silo supply)
import { money } from './sim.js';

const balls = n => `${n} ${n === 1 ? 'ball' : 'balls'}`;

// The washer's front board, two lines. amber: the pile is getting big (over 100 waiting).
export function washerBoard(n, credit) {
  n = Math.max(0, Math.round(n || 0));
  if (n === 0) return { top: 'HOPPER EMPTY', sub: 'BANK BALLS TO WASH', amber: false };
  return { top: `${n} DIRTY ${n === 1 ? 'BALL' : 'BALLS'}`, sub: `WAITING TO WASH · +$${Math.round(credit || 0)}`, amber: n > 100 };
}

// The prompt at a crank handle.
export function washerPrompt({ cranking = false, n = 0, owed = 0, btn = 'E', pad = false, latched = false } = {}) {
  n = Math.max(0, Math.round(n || 0));
  if (cranking) return n ? `Cranking… ${balls(n)} still dirty${latched ? ` · ${btn} lets go` : ''}` : `Cranking… all clean${latched ? ` · ${btn} lets go` : ''}`;
  if (!n) return 'The washer hopper is empty. Bank some balls.';
  return `${pad ? 'Tap' : 'Hold'} ${btn}: crank ${balls(n)} clean (+${money(owed)})`;
}

