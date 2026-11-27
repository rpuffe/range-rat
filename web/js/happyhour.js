// Council round 14 #2a (builder 2): Happy Hour on the Tiered deck, the venue's small peak. Pure: no THREE, no DOM, no
// sim.js import (the server module, the view, the bots and the tests share it).
//
// Every Tiered shift (venue 2, not endless, not Promotion Day) at T-4:00, for 60 s, ahead of the T-3:00 bowls rally:
//   - the deck's order queue fills at once (deck.js happyFill: the head plus two), and every Happy Hour order pays x1.5;
//   - the loungers chip their own balls onto the target greens and want them back: 1 at 1P, 2 at 2P, 3 at 3P+, one per
//     green, each under a neon beam with a 30 s clock (40 s solo). Carried in hands to a return, each pays x20 Ball
//     Value. A lapsed one: "The lounger shrugs. Experiential." (no rival: dimpl doesn't compete, it shrugs).
// Council round 14 #3a: the Members' Bell (landmark tier 1) rings a bonus Happy Hour here, once a shift, T-6:00..T-1:30,
// never inside a live one (server/venues/happyhour.mjs).
// The greens and spots come from hash32(day, vday, 'happy', k, j): no RNG draw.
import { MAP } from './map.js';
import { hash32 } from './today.js';
import { DECK } from './deck.js';

export const HAPPY = {
  VENUE: 2,
  AT: 180,                      // shiftT on a full 420 s shift: T-4:00
  AT_1P: 90,                    // solo: T-5:30, so the one Rat is back on the bowls well before the T-3:00 rally (the bots:
                                // at T-4:00 a solo crew missed the bowls on Happy Hour days and Tiered ran 4/6/8 shifts)
  FULL: 420,
  SECS: 60,                     // the window
  MIN_AT: 30,                   // a short shift whose window would open in its first 30 s has none
  ORDER_X: DECK.HAPPY_X,        // x1.5 ORDER_TAB on a Happy Hour order (deck.js tabFor)
  BALL_PAY: 20,                 // ball-weights a lounger's ball pays at a return (x20 Ball Value)
  BALL_SECS: 30, BALL_SECS_1P: 40,
  N: [1, 2, 3, 3, 3, 3],        // loungers' balls, by crew size 1..6 (one per target green: there are three)
  SPOT_K: 0.55,                 // a ball sits this far out from the cup (x the green's r): on the green, not in the cup
  DROP_Y: 18, DROP_VY: -3, DROP_VH: 3,   // the chip: lofted in from the deck, settling on the green
  BANK_R: 3.5,                  // SIM.STAND_REACH
  DROPPED_SECS: 12,
};

const clampN = n => Math.max(1, Math.min(HAPPY.N.length, n | 0 || 1));
export const happyN = n => Math.min(MAP.BOWLS.length, HAPPY.N[clampN(n) - 1]);
export const happyBallSecs = n => ((n | 0) <= 1 ? HAPPY.BALL_SECS_1P : HAPPY.BALL_SECS);

// Is there a Happy Hour today? Tiered only, not endless, not Promotion Day.
export const happyDay = ({ venue, endless = false, promo = false } = {}) => venue === HAPPY.VENUE && !endless && !promo;

// The window's start (shiftT) on a shift of `secs`, as seconds-left (T-4:00; T-5:30 solo); null when it would open in the
// first MIN_AT s.
export function happyTime(secs = HAPPY.FULL, n = 4) {
  const at = secs - (HAPPY.FULL - ((n | 0) <= 1 ? HAPPY.AT_1P : HAPPY.AT));
  return at >= HAPPY.MIN_AT && at < secs ? at : null;
}

// Can a bonus Happy Hour start now (the bell's own rule, landmarks.js bellOpen, plus this): not inside a live one, and
// not so close to today's scheduled one that the two would overlap. at: the scheduled start (or null), done: it ran.
export function bonusClear({ t, at = null, done = false, live = false }) {
  if (live) return false;
  if (at == null || done) return true;
  return t + HAPPY.SECS <= at;
}

const r2 = v => Math.round(v * 100) / 100;
// The loungers' balls for window k (0 and 1: today's and the bell's, in the order they run): [{ x, z, bowl }] on distinct greens.
export function greenSpots(day, vday, n = 4, k = 0) {
  // Solo, the one ball is on the nearest green (A, 48 m out): one Rat can fetch it and still make the T-3:00 rally.
  const N = happyN(n), B = MAP.BOWLS, first = (n | 0) <= 1 ? 0 : hash32(day | 0, vday | 0, 'happy', k | 0) % B.length, out = [];
  for (let j = 0; j < N; j++) {
    const g = B[(first + j) % B.length], h = hash32(day | 0, vday | 0, 'happy', k | 0, j);
    const a = (h % 3600) / 3600 * Math.PI * 2, r = g.r * HAPPY.SPOT_K;
    out.push({ x: r2(g.x + Math.cos(a) * r), z: r2(g.z + Math.sin(a) * r), bowl: g.id });
  }
  return out;
}

// The chip from the deck: a lofted ball coming in from the deck's direction (z ~2.6), settling on the spot.
export function chipShot(spot) {
  const dx = spot.x, dz = spot.z - DECK.SEAT_Z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  const { DROP_Y: Y, DROP_VY: VY, DROP_VH: VH } = HAPPY, G = 9.81;
  const T = (VY + Math.sqrt(VY * VY + 2 * G * Y)) / G;
  const back = VH * T + 2;
  return { x: spot.x - ux * back, y: Y, z: spot.z - uz * back, vx: ux * VH, vy: VY, vz: uz * VH };
}

// ---- what you see and read ---------------------------------------------------------------------------------------
const clockOf = t => { const s = Math.max(0, Math.ceil(t ?? 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// The Board (builder 4's board.js reads mods.happyhour): "HAPPY HOUR · ORDERS 3 · ●●○ · 0:41".
export function happyLine(snap) {
  if (!snap?.on) return null;
  const pips = snap.pips ? ` · ${[...snap.pips].map(c => (c === '1' ? '●' : '○')).join('')}` : '';
  return `HAPPY HOUR · ORDERS ${snap.orders | 0}${pips} · ${clockOf(snap.t)}`;
}
export const HAPPY_ALERT = 'Happy Hour! Drinks, and fetch the greens!';   // the one centre ALERT (6 words)
export const HAPPY_BONUS_ALERT = 'Bonus round! The bell has spoken.';     // the bell's (6 words)
export const HAPPY_LAPSE_LINE = 'The lounger shrugs. Experiential.';      // the feed
export const happyCarryLine = n => `Lounger's ball${n === 1 ? '' : 's'} ×${n} → a return`;
const kMoney = v => { const a = Math.abs(Math.round(v)); return a >= 1e6 ? `$${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1e4 ? `$${Math.round(a / 1e3)}k` : `$${a.toLocaleString('en-US')}`; };
// The report row: "Happy Hour: 3 pours, 2 of 3 greens · +$41k".
export function happyRow({ pours = 0, got = 0, n = 0, cash = 0 } = {}) {
  if (!(n > 0) && !(pours > 0)) return null;
  return { text: `Happy Hour: ${pours} pour${pours === 1 ? '' : 's'}, ${got} of ${n} greens · +${kMoney(cash)}`, cash: Math.round(cash) };
}
