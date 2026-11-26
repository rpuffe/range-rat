// The huddle beat's pure rules for the client (council round 6 #5): the ring's slots, the gold sweep, the
// Last Bucket banner line, and the Board's GARY 3 · 2 · 1. No three, no DOM: unit-tested in test/huddle.test.mjs.
// The server owns the truth (crew.mjs stepHuddle); this only draws it.

import { skyBanner, skyToClear } from './orbit.js';
import { SIM } from './sim.js';

export const HUDDLE = {
  R: 8,              // the ring round the stand (crew.mjs HUDDLE_R, GARY.HUDDLE_R)
  HOLD: 3,           // seconds of everyone holding Use (crew.mjs HUDDLE_HOLD)
  TICKS: 48,         // the ring is drawn as this many arc ticks (one InstancedMesh)
  MAX_SLOTS: 6,      // one slot per online Rat (six crew colours)
};

const dist = (p, c) => Math.hypot(p.x - c.x, p.z - c.z);
const esc = s => String(s ?? '').replace(/[&<>"']/g, ch => '&#' + ch.charCodeAt(0) + ';');   // the banner is innerHTML

// The slots for the Last Bucket huddle, in the server's order: [{ id, color, in, held }].
export function ringSlots(lb, players = []) {
  if (!lb || lb.phase !== 'huddle') return [];
  const byId = new Map(players.map(p => [p.id, p]));
  const inSet = new Set(lb.in ?? []), held = new Set(lb.held ?? []);
  return (lb.slots ?? []).slice(0, HUDDLE.MAX_SLOTS).map(id => ({ id, color: byId.get(id)?.color ?? '#ffffff', in: inSet.has(id), held: held.has(id) }));
}

// Gary's huddle (A4): the same ring, no hold. A slot fills while that Rat is within the ring (his verdict's rule).
export function garyRingSlots(players = [], stand, r = HUDDLE.R) {
  return players.filter(p => p.online).slice(0, HUDDLE.MAX_SLOTS).map(p => ({ id: p.id, color: p.color ?? '#ffffff', in: dist(p, stand) < r, held: false }));
}

// Which slot a ring tick belongs to, or -1 for the small gap between two slots.
export function slotOfTick(i, n, ticks = HUDDLE.TICKS) {
  if (n <= 0) return -1;
  const s = Math.floor(i * n / ticks);
  if (n > 1 && Math.floor((i + 1) * n / ticks) !== s) return -1;   // the last tick of each slot is the gap
  return s;
}

// How many gold ticks the sweep has filled (0..ticks).
export const sweepTicks = (sweep, hold = HUDDLE.HOLD, ticks = HUDDLE.TICKS) => Math.max(0, Math.min(ticks, Math.floor((sweep / hold) * ticks + 1e-9)));

// The sweep to draw between snapshots: it runs on locally while every slot is held, and sits at 0 otherwise.
export function sweepNow(lb, since) {
  if (!lb || lb.phase !== 'huddle') return 0;
  const slots = lb.slots?.length ?? 0, held = lb.held?.length ?? 0;
  if (!slots || held < slots) return 0;
  return Math.min(HUDDLE.HOLD, (lb.sweep ?? 0) + Math.max(0, since));
}

export const LB_NAME = 8;   // council round 11 8.3: the waiting name's most characters (then '…')
const cutName = n => { const s = String(n ?? '').toUpperCase(); return s.length > LB_NAME ? s.slice(0, LB_NAME - 1) + '…' : s; };
// The Last Bucket's one banner line (round2.js shows it; one centre text at a time). '' hides it.
// `glyph` is the Use control (Ⓐ on a pad, SPACE on a keyboard). The huddle line is ≤ 8 words.
export function lastBucketLine(c, meId, glyph = 'Ⓐ', stand = SIM.STAND) {   // the ball return (owner layout)
  const lb = c?.lastBucket;
  if (!lb || lb.phase === 'done' || c.phase !== 'shift') return '';
  const on = (c.players ?? []).filter(p => p.online);
  if (lb.phase === 'sky') return skyToClear(lb.debris) > 0 || !lb.step ? skyBanner(lb.debris)   // round 7 #5: the sky gate (debris overhead)
    : `SKY CLEAR · NOW ${esc(lb.step).toUpperCase()}`;           // round 12: the sky is clear, a card step isn't (owner: "never cleared")
  // Playthrough 5 C10: solo it is just HOLD SPACE ("TOGETHER · 0/1" read oddly with nobody to hold with).
  if (lb.phase === 'huddle') return (lb.slots ?? []).length <= 1 ? `HOLD ${glyph}` : `HOLD ${glyph} TOGETHER · <b>${(lb.held ?? []).length} / ${(lb.slots ?? []).length}</b>`;
  const carrier = on.find(p => p.one);
  if (carrier) {
    // Council round 11 8.3: it clipped at 800 px. One name plus a count ("BALL NO. 1 · HOME · 3/4 · WAITING: RAT2 +1"),
    // the name cut to LB_NAME characters, and a CSS max-width with an ellipsis as the backstop. Solo: just the goal.
    if (on.length <= 1) return 'BALL NO. 1 → THE RETURN';
    const missing = on.filter(p => dist(p, stand) >= HUDDLE.R).sort((a, b) => (b.id === meId) - (a.id === meId));
    const who = !missing.length ? '' : missing[0].id === meId ? 'YOU' : esc(cutName(missing[0].name));
    return `BALL NO. 1 · HOME · <b>${on.length - missing.length}/${on.length}</b>${who ? ` · WAITING: ${who}${missing.length > 1 ? ' +' + (missing.length - 1) : ''}` : ''}`;
  }
  return lb.phase === 'down' ? 'BALL NO. 1 IS DOWN · follow the beam' : '';
}

// The Board while Gary drives his last leg to the stand: GARY 3, GARY 3 · 2, GARY 3 · 2 · 1. null otherwise.
// Playtest round 2 #2: when the server sends { eta, span } (seconds to the stand, and that eta when he left the mats),
// the count runs from the mats instead, a third of the route per digit, so it lasts several seconds.
// `stop` is his stand stop (sim.js GARY.STOPS), `speed` GARY.SPEED; he arrives within 0.3 m (crew.mjs stepGary).
// Playthrough 3 #2: the count is the last GARY_COUNT seconds (crew.mjs garyEta sends nothing earlier), so it lasts
// about 5 s at every venue, cart or no cart (from the mats it ran 11–67 s with a cart).
export const GARY_COUNT = 5;
export function garyCountdown(gary, stop = { x: 26, z: 10 }, speed = 5) {
  if (!gary || gary.phase !== 'drive') return null;
  if (gary.eta != null && gary.span > 0) {
    if (gary.eta <= 0 || gary.eta > GARY_COUNT + 0.5) return null;   // an older server's long span: wait for the last 5 s
    const n = Math.max(1, Math.min(3, Math.ceil(3 * gary.eta / Math.min(gary.span, GARY_COUNT) - 1e-9)));
    return 'GARY ' + [3, 2, 1].filter(k => k >= n).join(' · ');
  }
  if (gary.to !== 'stand') return null;
  const eta = (dist(gary, stop) - 0.3) / speed;
  if (eta <= 0 || eta > 3) return null;
  const n = Math.max(1, Math.ceil(eta));
  return 'GARY ' + [3, 2, 1].filter(k => k >= n).join(' · ');
}
