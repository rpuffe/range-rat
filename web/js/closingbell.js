// The Closing Bell, client half (council round 6, #3): the Board's crossing flash, the venue gauge's pass tick, and the
// APPROVED / DENIED stamp. Pure: no THREE, no DOM (board.js and main.js draw it; test/closingbell.test.mjs pins it).
// The rules (the review, the gauge, the rally line) are builder A's: sim.js, crew.mjs, rally.js.
import * as SIMNS from './sim.js';   // QUOTA_KPI (#2), read softly so this loads before it lands

export const BELL = {
  FLASH_SECS: 0.4,     // the target bar's flash when BV crosses the target
  FLASH_GAP: 3,        // s: at most one flash this often, so drift round the mark can't strobe it
  STAMP_SECS: 1.5,     // the rubber stamp holds the centre this long
  REPORT_HOLD: 2,      // s the report card waits after the quota event (the bell, then the stamp)
  GREEN: '#4fe07a', AMBER: '#ffb02e',
  CONFETTI: 160, CONFETTI_LOW: 60, CONFETTI_SECS: 2,
};
export const gaugePass = () => SIMNS.QUOTA_KPI ?? 0.5;

// The Board's crossing state machine. s = { above: bool|null, at: s of the last flash }. Feed it every Board update
// with the shift clock (t, seconds). Returns 'up' (crossed over the target: green flash + ding), 'down' (fell back
// under: amber flash) or null. `live` false (no shift / no target) forgets the side, so a new day never flashes.
export function crossing(s, { bv, quota, live, t }) {
  if (!live || quota == null || !Number.isFinite(bv)) { s.above = null; return null; }
  const above = bv >= quota;
  const was = s.above;
  s.above = above;
  if (was == null || was === above) return null;
  if (t - (s.at ?? -Infinity) < BELL.FLASH_GAP) return null;
  s.at = t;
  return above ? 'up' : 'down';
}

// The venue gauge's fill: its own colour, red while under the pass tick during Last Call.
export const gaugeRed = (v, lastCall, pass = gaugePass()) => !!lastCall && v != null && v < pass;

// The stamp for a quota event: APPROVED in red ink, or DENIED in grey (≤ 8 words of reason under it, if the server
// sent one).
export function stampFor(e) {
  if (!e) return null;
  const why = typeof e.why === 'string' ? e.why : typeof e.reason === 'string' ? e.reason : '';
  return e.hit ? { ok: true, text: 'APPROVED', ink: '#d0202a', why: '' }
    : { ok: false, text: 'DENIED', ink: '#8a8f98', why: why.split(/\s+/).filter(Boolean).length <= 8 ? why : '' };
}
