// Day-2 suggestions (council round 6 #10): on the Muni's day 2, after the memo, each online Rat gets ONE different
// suggestion, a single line with the checklist's yellow arrow over the place. Dealt round the crew from a pool that
// depends on what the crew owns; it goes once you've done it, or after 45 s. No roles: nothing rewards it.
// Pure (no THREE, no DOM): server/venues/nudge.mjs deals and clears it, main.js shows it in the checklist's slot.
import { MAP } from './map.js';
import { SIM, WASHER_HANDLES, WASH, MATS, FIXTURE_BY_ID, FRIES } from './sim.js';
import { morningLine, morningTarget } from './morning.js';   // owner playtest 3 §3.4: the morning deal ('am:*', builder 2)

export const NUDGE = {
  SECS: 45,          // the line goes after 45 s of working time...
  WAIT: 10,          // ...counted from 10 s into the shift, once the memo and the PA card have had their turn
  DAY: 2, VENUE: 0,
  FAR_Z: -60,        // "the far field": past the red flag, toward Yellow
};
export const NUDGE_TEXT = {
  hose: 'Try hosing the mats.',
  far: 'Try picking the far field.',
  stand: 'Try banking at the ball return.',
  washer: 'Try the ball washer crank.',
  shop: 'Try the shop: get a washer.',
};

// The pool, in dealing order: the washer line depends on whether the crew owns one.
export const nudgePool = up => ['hose', 'far', 'stand', (up?.washer ?? 0) > 0 ? 'washer' : 'shop'];
// The i-th Rat dealt today (0-based) gets this one: 4 Rats get 4 different, a 5th repeats from the top.
export const dealNudge = (i, up) => { const pool = nudgePool(up); return pool[((i % pool.length) + pool.length) % pool.length]; };

// Is today a nudge day?
export const nudgeDay = crew => crew.venue === NUDGE.VENUE && crew.day === NUDGE.DAY && !crew.endless;

// Has this Rat done it once since it was dealt? base: what was true at the deal ({ banked, washAt, crankAt }).
export function nudgeDone(id, p, base, up) {
  switch (id) {
    case 'hose': return (p.washAt ?? 0) > (base.washAt ?? 0);                 // sprayed something with the wand
    case 'far': return (p.z ?? 0) < NUDGE.FAR_Z && (p.pocket ?? 0) > 0;      // out in the far field with a ball
    case 'stand': return (p.shift?.banked ?? 0) > (base.banked ?? 0);
    case 'washer': return (p.crankAt ?? 0) > (base.crankAt ?? 0);
    case 'shop': return (up?.washer ?? 0) > 0;                               // somebody bought the washer
    default: return true;
  }
}

// Playtest round 2 #7: does this Rat already do it (so dealing it would only nag)? Ever sprayed, or holding the wand;
// banked today; out in the far field with a ball; ever cranked; the crew owns the washer.
export const nudgeSatisfied = (id, p, up) => (id === 'hose' && !!p?.wand) || nudgeDone(id, p ?? {}, { banked: 0, washAt: 0, crankAt: 0 }, up);

// The next suggestion for this Rat from the i-th deal on, skipping any it already satisfies: { id, used } (used: deals
// consumed, so the crew still gets different lines), or { id: null } when it satisfies all of them.
export function dealFor(i, p, up) {
  const n = nudgePool(up).length;
  for (let k = 0; k < n; k++) { const id = dealNudge(i + k, up); if (!nudgeSatisfied(id, p, up)) return { id, used: k + 1 }; }
  return { id: null, used: 1 };
}

// Where the yellow arrow goes (client). wand: does this Rat hold the wand; at: where they stand (the nearest mat).
// null = no place (the shop is a menu).
export function nudgeTarget(id, wand = false, at = { x: 0, z: 0 }, { cart = null, gary = null } = {}) {
  if (id?.startsWith('am:')) return id === 'am:mats' || ((id === 'am:sign' || id === 'am:stand') && !wand) ? nudgeTarget(id === 'am:mats' ? 'hose' : 'gary:' + id.slice(3), wand, at) : morningTarget(id);
  if (id === 'gary:stall' || id === 'gary:chat') return gary ? { x: gary.x, z: gary.z, y: 2.6, s: 1 } : null;   // round 8 #2: his cart, wherever it is
  if (id === 'gary:meet') return nudgeTarget('stand');
  if (id === 'mats3' || id === 'gary:mats') return nudgeTarget('hose', wand, at);   // the wash station, then the nearest mat
  if (id === 'gary:sign') return wand ? { x: FIXTURE_BY_ID.sign.x, z: FIXTURE_BY_ID.sign.z, y: 3.4, s: 1 } : { x: WASH.STATION.x, z: WASH.STATION.z, y: 2.2, s: 1 };
  if (id === 'gary:stand') return wand ? { x: SIM.STAND.x, z: SIM.STAND.z, y: 2.6, s: 1 } : { x: WASH.STATION.x, z: WASH.STATION.z, y: 2.2, s: 1 };
  if (id === 'gary:cart') return wand && cart ? { x: cart.x, z: cart.z, y: 2.2, s: 1 } : { x: WASH.STATION.x, z: WASH.STATION.z, y: 2.2, s: 1 };
  if (id === 'gary:kitchen') return { x: FRIES.SHED.x, z: FRIES.SHED.z, y: 2.6, s: 1 };
  if (id === 'hose') return wand ? { x: MATS.reduce((b, m) => Math.abs(m.x - at.x) < Math.abs(b.x - at.x) ? m : b).x, z: 0, y: 2.2, s: 1 } : { x: WASH.STATION.x, z: WASH.STATION.z, y: 2.2, s: 1 };
  if (id === 'far') { const f = MAP.FLAGS.find(g => g.id === 'yellow'); return { x: f.x, z: f.z, y: 3, s: 1 }; }
  if (id === 'stand') return { x: SIM.STAND.x, z: SIM.STAND.z, y: 2.6, s: 1 };
  if (id === 'washer') return { x: (WASHER_HANDLES.L.x + WASHER_HANDLES.R.x) / 2, z: WASHER_HANDLES.L.z, y: 2.4, s: 1 };
  return null;
}

// ---- Round 7 #4: Gary's warning, dealt. When his 45 s warning starts (day 4+, every venue), each online Rat's nudge
// slot gets one FAILING stop, nearest first; extra Rats double up on the mats. A stop that passes clears its line, and
// every line clears when he reaches his first stop. Day 3 at the Muni: one rhythm line at half-shift. No roles: nothing
// checks or rewards who did what. Nudge ids: 'gary:<stop>' and 'mats3'.
export const GARY_TEXT = {
  sign: 'Gary checks the sign. Hose it!',
  mats: 'Gary checks the mats. Hose them!',
  stand: 'Gary checks the return. Hose it!',
  cart: 'Gary checks the cart. Hose it!',
  kitchen: "Gary's hungry. Serve a hot dog!",
  // Council round 8 #2: no duplicate stops. An extra Rat stalls him while something fails, else meets him at the
  // stand (a full huddle counts twice). 'meet', not 'stand': gary:stand is already the hose-the-stand line.
  stall: 'Stall Gary: ping his cart!',
  chat: 'Keep Gary talking: hold Ⓐ!',   // owner playtest 3 §6.3: the stall line while he's parked (garyExtra)
  meet: 'All clean. Meet Gary at the return!',
};
// Owner playtest 3 §6.3: the dealt stall line reads by what Gary is doing: parked (the warning, a stop) he can be
// chatted to; driving, ping his cart. The server deals 'gary:stall' either way; the client shows the right one.
export const garyExtra = (id, parked) => (id === 'gary:stall' && parked ? 'gary:chat' : id);
// The two lines that aren't a stop (nothing to hose, nothing to clear at Spotless).
export const GARY_EXTRA = ['stall', 'meet'];
// Playthrough 4 A14: a Rat's stall/meet line switches only after the other has been wanted this long (s), so it never flips.
export const GARY_LINE_HOLD = 3;
// The shooter's toast when their ball stalls him (the enthusiasm event carries stall: 1..GARY.STALLS).
export const GARY_STALLED = "Gary stalled! He's taking notes.";
export const DAY3 = { DAY: 3, VENUE: 0, AT: 0.5, MUD: 0.3, TEXT: 'Keep the mats clean.' };

// The line for any nudge id (day 2, Gary's, day 3).
export const nudgeLine = id => NUDGE_TEXT[id] ?? morningLine(id) ?? (id === 'mats3' ? DAY3.TEXT : id?.startsWith('gary:') ? GARY_TEXT[id.slice(5)] : null) ?? null;

// stops: Gary's failing stops [{ id, x, z }] (route order); rats: [{ id, x, z }]. Returns { [ratId]: stopId }.
// Nearest first: the closest (Rat, stop) pair is dealt, then the next closest among the rest, until every failing
// stop has a Rat. Council round 8 #2: extra Rats never double up: 'stall' while anything fails (failing: true by
// default when stops is non-empty; redealGary passes it for stops someone else holds), else 'meet' (every Rat, then).
export function dealGary(stops, rats, failing = stops.length > 0) {
  const out = {};
  const d = (r, s) => Math.hypot(r.x - s.x, r.z - s.z);
  const openStops = [...stops], left = [...rats];
  while (openStops.length && left.length) {
    let best = null;
    for (const r of left) for (const s of openStops) if (!best || d(r, s) < best.d) best = { r, s, d: d(r, s) };
    out[best.r.id] = best.s.id;
    left.splice(left.indexOf(best.r), 1); openStops.splice(openStops.indexOf(best.s), 1);
  }
  for (const r of left) out[r.id] = failing ? 'stall' : 'meet';
  return out;
}

// Playthrough 3 #1: a Gary line clears only once its stop is Spotless (this much mud or less), not at the pass mark
// (GARY.CLEAN 0.34), so a hosed stop doesn't scuff straight back into a fail.
export const GARY_SPOTLESS = 0.1;

// Playthrough 3 #1 and #12: during the warning, a Rat with no line (theirs went Spotless) takes a failing stop nobody
// holds, nearest first: solo works down the list, and a stop that fails again is dealt again. held: the stop ids
// still dealt. Returns { [ratId]: stopId | 'stall' | 'meet' } (round 8 #2: a Rat with no stop left stalls Gary, or
// meets him at the stand when nothing fails).
export const redealGary = (stops, rats, held = []) => dealGary(stops.filter(s => !held.includes(s.id)), rats, stops.length > 0);
