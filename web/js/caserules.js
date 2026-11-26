// Council round 12 #3b/#3d (builder 3): the ending's pure rules. Pure: no THREE, no DOM (tested in test/ending.test.mjs).
//   * the hush: how the camera's look-at at the bank eases in and out (round2.js);
//   * the glass case by the return: where it stands, and its plaque (views/glasscase.js draws it; crew.mjs keeps it).
// The case: from the bank on, Ball No. 1's two gold halves sit in a small glass case beside the return, with a plaque:
// "BALL No. 1 · 1958–2026 · FOUND BY" and the crew's names; each Owners' record day adds a line ("Day 4 · $91.2M"),
// and the plaque shows the newest four. Saved as `glassCase` ({ names, year, from, lines }).
import { SIM } from './sim.js';

// The hush (round2.js): within NEAR m of the return the camera eases over EASE s to look at the hopper lip (LIP_Y, where
// the crack opens) from BACK m further back and UP m higher, and eases back when the note's beat ends.
export const HUSH = Object.freeze({ NEAR: 15, EASE: 0.8, BACK: 1, UP: 0.3, LIP_Y: 1.9 });
const smooth = x => { const u = x < 0 ? 0 : x > 1 ? 1 : x; return u * u * (3 - 2 * u); };
// The look-at's weight 0..1: t s since the bank, toff s since it let go (null: still on).
export const hushWeight = (t, toff = null) => smooth(t / HUSH.EASE) * (toff == null ? 1 : 1 - smooth(toff / HUSH.EASE));

// Where the case stands: beside the return, on the crew's side, clear of the pickup ring and Gary's spot
// (garycameo.js CAMEO.SPOT: −2.4, +1.3). yaw turns its plaque toward the mats.
export const CASE = Object.freeze({ x: SIM.STAND.x - 2.6, z: SIM.STAND.z + 3.2, yaw: -Math.PI / 2, MAX_LINES: 4, KEEP: 40, NAMES: 6 });
export const PLAQUE_HEAD = 'BALL No. 1 · 1958–2026 · FOUND BY';

const cleanName = n => String(n ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, 16);
// A new case: the crew's names (online first, at most NAMES) and the bank's day (endless day N is `day - from`).
export const newCase = (names = [], day = 0, year = 2026) =>
  ({ names: [...new Set(names.map(cleanName).filter(Boolean))].slice(0, CASE.NAMES), year, from: Math.max(0, day | 0), lines: [] });
// "$91.2M", "$850K", "$900".
export function caseMoney(v) {
  const a = Math.max(0, +v || 0), r1 = x => (Math.round(x * 10) / 10).toString();
  if (a >= 1e9) return '$' + r1(a / 1e9) + 'B';
  if (a >= 1e6) return '$' + r1(a / 1e6) + 'M';
  if (a >= 1e4) return '$' + Math.round(a / 1e3) + 'K';
  return '$' + Math.round(a);
}
// An Owners' record day (or the day that opened the book): "Day 4 · $91.2M" on the plaque. Returns a new case.
export function addRecordLine(c, day, cash) {
  if (!c) return c;
  const n = Math.max(1, (day | 0) - (c.from | 0));
  return { ...c, lines: [...(c.lines ?? []), `Day ${n} · ${caseMoney(cash)}`].slice(-CASE.KEEP) };
}
// The plaque's lines, top to bottom: the head, the names, then the newest MAX_LINES record lines.
export function plaqueLines(c) {
  if (!c) return [];
  return [PLAQUE_HEAD, (c.names ?? []).join(' · '), ...(c.lines ?? []).slice(-CASE.MAX_LINES)];
}
// A saved case, or null.
export function cleanCase(c) {
  if (!c || typeof c !== 'object' || !Array.isArray(c.names)) return null;
  const lines = (Array.isArray(c.lines) ? c.lines : []).filter(l => typeof l === 'string' && l.length <= 40).slice(-CASE.KEEP);
  return { ...newCase(c.names, c.from, Number.isInteger(c.year) ? c.year : 2026), lines };
}
