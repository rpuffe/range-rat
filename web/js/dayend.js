// The end of the day (round 11, the owner's firm call). Pure: no THREE, no DOM. server/crew.mjs runs it.
//   T−3:00  customers start to taper: busy bays and the swing rate fall smoothly;
//   T−2:30  Last Call: the customers left hit glow balls, the rally rings;
//   T−2:00  the last customer walks out: two minutes of cleanup (no customer ball, no scuffing).
// The windows are for a full 420 s shift and scale with a shorter one, so day 2 (360 s) keeps its hitting time.
import { LAST_CALL, CLEANUP } from './sim.js';

export const endScale = secs => Math.max(0, Math.min(1, (Number(secs) || 0) / LAST_CALL.FULL));
// Seconds before the bell each phase starts: { taper, glow, cleanup }.
export function endWindows(secs) {
  const k = endScale(secs);
  return { taper: LAST_CALL.TAPER * k, glow: LAST_CALL.SECS * k, cleanup: CLEANUP * k };
}
// How much of the day's crowd is still here: 1 until the taper, falling to 0 at the cleanup (the last customer out).
export function taperK(shiftT, secs) {
  const w = endWindows(secs), left = secs - shiftT;
  if (left >= w.taper) return 1;
  if (left <= w.cleanup) return 0;
  return (left - w.cleanup) / Math.max(1e-9, w.taper - w.cleanup);
}
// Busy bays while tapering: n at k = 1, one bay just before the cleanup, none at k = 0.
export const taperBays = (n, k) => (k >= 1 ? n : k <= 0 ? 0 : Math.max(1, Math.min(n, Math.ceil(n * k - 1e-9))));
// The swing rate's factor (a mat's gap is divided by it): 1, falling to MIN_RATE as the last customers pack up.
export const taperRate = k => LAST_CALL.MIN_RATE + (1 - LAST_CALL.MIN_RATE) * Math.max(0, Math.min(1, k));
// A mat's swing rate on a day with an end of day (from LAST_CALL.FROM_DAY): the busier daytime crowd (DAY_RATE) tapering
// with k. The two-minute cleanup and the taper cost ~37% of the old day's balls; DAY_RATE gives them back in daylight.
// Day 1 (training: no taper, no cleanup) keeps the plain rate.
export const swingRate = (k, day) => (day >= LAST_CALL.FROM_DAY ? LAST_CALL.DAY_RATE * taperRate(k) : 1);
// The clock text for a window ("2:00"), for tips and memos.
export const clockText = s => Math.floor(Math.round(s) / 60) + ':' + String(Math.round(s) % 60).padStart(2, '0');

// ---- SPOTLESS RANGE (round 11, expert #4b and the owner) ------------------------------------------------------------
// At the bell, after the cleanup: no ball left out there pays a bonus and stamps the report; a nearly spotless range
// (at most NEAR of the day's customer balls left, and no more than NEAR_MAX) pays a smaller one. A day with fewer than
// MIN customer balls (a test's empty range, a dead shift) has nothing to be spotless about. The cash scales like a goal's
// reward (goals.js rewardFor: BV × the venue's share × crewScale), so it matters at every venue: ~5% of a shift.
export const SPOTLESS = Object.freeze({ SHARE: 0.75, NEAR_SHARE: 0.3, NEAR: 0.02, NEAR_MAX: 12, MIN: 30 });
// { kind: 'spotless' | 'nearly', left, cash } or null. left: balls still out (crew.ballsLeft); launched: today's
// customer balls; reward: what a ✦ goal pays now (goals.js rewardFor).
export function spotlessBonus({ left, launched, reward }) {
  const l = Math.max(0, Math.floor(Number(left) || 0)), n = Math.max(0, Number(launched) || 0), r = Math.max(0, Number(reward) || 0);
  if (n < SPOTLESS.MIN || !(r > 0)) return null;
  if (l === 0) return { kind: 'spotless', left: 0, cash: Math.round(r * SPOTLESS.SHARE * 100) / 100 };
  if (l <= SPOTLESS.NEAR_MAX && l <= SPOTLESS.NEAR * n) return { kind: 'nearly', left: l, cash: Math.round(r * SPOTLESS.NEAR_SHARE * 100) / 100 };
  return null;
}
// The report's stamp row (≤ 8 words): "SPOTLESS RANGE! +$1,450" / "Nearly spotless: 3 left. +$580"
export const spotlessRow = (s, money = v => '$' + v) => (!s ? '' : s.kind === 'spotless' ? `SPOTLESS RANGE! +${money(s.cash)}` : `Nearly spotless: ${s.left} left. +${money(s.cash)}`);
