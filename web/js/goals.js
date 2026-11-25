// The venue goal card (council round 10 #1, §1 A): it replaces the review stamps. Every venue from the Muni to the
// County shows one card of 5 goals; all 5 done and the crew can sign at the report. The Orbital's card is the Last
// Bucket's four steps (Ball No. 1 falls when they're done). Endless has no card.
//   - the last goal is always "Save the $X fee": live (ticks when cash ≥ fee, un-ticks below it);
//   - one is "Hit the daily target N×" (the Closing Bell's APPROVED at this venue: 2 at the Muni, 3 from the Club);
//   - the other three are feature goals, each paying 50 × BV when it completes (✦).
// Counts scale with the crew printed on the venue's first morning (solo ×0.4 … 6P ×1.4, rounded up) and never move.
// Pure: no THREE, no DOM. server/crew.mjs keeps the card; board.js, round2.js, morning.js and main.js read it.
import { money } from './sim.js';

export const REWARD_BV = 50;         // a feature goal pays 50 × BV when it completes
export const RISE_REVIEWS = 3;       // the quota curve climbs with good days until this many (the old PROMO_STAMPS)
export const SCALE = { 1: 0.4, 2: 0.6, 3: 0.8, 4: 1, 5: 1.2, 6: 1.4 };
export const crewScale = n => SCALE[Math.max(1, Math.min(6, Math.floor(Number(n) || 1)))];
export const scaled = (n, scale) => Math.max(1, Math.ceil(n * (scale ?? 1) - 1e-9));

const commas = n => Math.max(0, Math.round(n || 0)).toLocaleString('en-US');
// kind: 'count' (scaled by the crew) · 'fixed' (a count that doesn't scale) · 'buy' (owning row ≥ tier) ·
// 'once' (one event ticks it) · 'reviews' (APPROVED days at this venue) · 'fee' (live) · 'riders' (every Rat
// printed on the card) · 'sky' (live: the Orbital's sky gate is clear).
// text(need) is the card's row; more(left) the strip's and the deal's "18 more hot dogs"; short the toast's name.
const G = {
  bank: { kind: 'count', n: 2000, reward: true, text: n => `Bank ${commas(n)} balls`, more: n => `${commas(n)} more balls`, short: n => `${commas(n)} balls` },
  washer: { kind: 'buy', row: 'washer', tier: 1, reward: true, text: () => 'Buy the ball washer', short: () => 'The ball washer' },
  huddle: { kind: 'once', gary: true, reward: true, text: () => 'Huddle for Gary', short: () => 'Huddled for Gary' },
  hotdogs: { kind: 'count', n: 30, reward: true, text: n => `Serve ${n} hot dogs`, more: n => `${n} more hot dog${n === 1 ? '' : 's'}`, short: n => `${n} hot dogs` },
  treasures: { kind: 'fixed', n: 2, reward: true, treasure: true, text: n => `Bring up ${n} treasures`, more: n => `${n} more treasure${n === 1 ? '' : 's'}`, short: n => `${n} treasures` },
  seal: { kind: 'once', gary: true, reward: true, text: () => "Earn Gary's Seal", short: () => "Gary's Seal" },
  targets: { kind: 'count', n: 8, reward: true, text: n => `Land ${n} TARGETs`, more: n => `${n} more TARGET${n === 1 ? '' : 's'}`, short: n => `${n} TARGETs` },
  orders: { kind: 'count', n: 24, reward: true, text: n => `Fill ${n} deck orders`, more: n => `${n} more deck order${n === 1 ? '' : 's'}`, short: n => `${n} deck orders` },
  gutters: { kind: 'buy', row: 'gutters', tier: 1, reward: true, text: () => 'Buy the ball-return gutters', short: () => 'The gutters' },
  laps: { kind: 'count', n: 20, reward: true, text: n => `Drive ${n} laps of the Ping Track`, more: n => `${n} more lap${n === 1 ? '' : 's'}`, short: n => `${n} laps` },
  pings: { kind: 'count', n: 12, reward: true, text: n => `Ping the cart ${n} times`, more: n => `${n} more ping${n === 1 ? '' : 's'}`, short: n => `${n} pings` },
  cart2: { kind: 'buy', row: 'cart', tier: 3, reward: true, text: () => 'Buy the second cart', short: () => 'The second cart' },
  strays: { kind: 'count', n: 150, reward: true, text: n => `Sweep ${n} strays from the Yards`, more: n => `${n} more stray${n === 1 ? '' : 's'}`, short: n => `${n} strays` },
  drones: { kind: 'buy', row: 'drones', tier: 1, reward: true, text: () => 'Buy the drones', short: () => 'The drones' },
  pass: { kind: 'once', gary: true, reward: true, text: () => "Pass Gary's inspection", short: () => "Gary's inspection" },
  lift: { kind: 'riders', reward: true, text: () => 'Every Rat rides the Lift', more: n => `${n} more Rat${n === 1 ? '' : 's'} on the Lift`, short: () => 'Everyone rode the Lift' },
  debris: { kind: 'count', n: 60, reward: true, text: n => `Bring down ${n} debris`, more: n => `${n} more debris`, short: n => `${n} debris` },
  tether: { kind: 'buy', row: 'tether', tier: 1, reward: true, text: () => 'Buy the tether winch', short: () => 'The tether winch' },
  sky: { kind: 'sky', text: () => 'Clear the sky', short: () => 'The sky' },
  reviews: { kind: 'reviews', text: n => `Hit the daily target ${n}×`, more: n => (n === 1 ? 'one more good day' : `${n} more good days`) },
  fee: { kind: 'fee', text: (n, fee) => `Save the ${money(fee ?? 0)} fee`, more: n => `${money(Math.ceil(n))} more for the fee` },
};
export const GOALS = G;

// The cards, venue by venue (4P numbers). `reviews` carries its N.
export const CARDS = [
  [{ id: 'bank' }, { id: 'washer' }, { id: 'huddle' }, { id: 'reviews', n: 2 }, { id: 'fee' }],        // the Muni
  [{ id: 'hotdogs' }, { id: 'treasures' }, { id: 'seal' }, { id: 'reviews', n: 3 }, { id: 'fee' }],    // the Club
  [{ id: 'targets' }, { id: 'orders' }, { id: 'gutters' }, { id: 'reviews', n: 3 }, { id: 'fee' }],    // Tiered
  [{ id: 'laps' }, { id: 'pings' }, { id: 'cart2' }, { id: 'reviews', n: 3 }, { id: 'fee' }],          // the Stadium
  [{ id: 'strays' }, { id: 'drones' }, { id: 'pass' }, { id: 'reviews', n: 3 }, { id: 'fee' }],        // the County
  [{ id: 'lift' }, { id: 'debris' }, { id: 'tether' }, { id: 'sky' }],                                 // the Orbital: the Last Bucket
];
export const LAST_CARD = 5;
export const hasCard = (venue, endless = false) => !endless && venue >= 0 && venue < CARDS.length;
export const reviewsNeed = venue => CARDS[venue]?.find(g => g.id === 'reviews')?.n ?? 0;
// The counting goals on a venue's card that count `id`'s events (crew.mjs goalTick calls through this).
export const onCard = (venue, id) => !!CARDS[venue]?.some(g => g.id === id);

// The printed count of each goal for a crew of `crew` Rats (scale = crewScale(crew)). opts.treasuresLeft caps the
// treasure goal at what's still in the pond's pool (an old save with a full glass case never softlocks).
export function needOf(g, scale, crew, opts = {}) {
  const d = G[g.id];
  switch (d.kind) {
    case 'count': return scaled(d.n, scale);
    case 'fixed': return Math.min(d.n, opts.treasuresLeft ?? d.n);
    case 'reviews': return g.n;
    case 'riders': return Math.max(1, Math.min(6, crew | 0));
    default: return 1;
  }
}

// A fresh card for `venue`, printed for the crew online now. { venue, scale, crew, need, n, done }
export function printCard(venue, crew, opts = {}) {
  if (!hasCard(venue)) return null;
  const c = Math.max(1, Math.min(6, crew | 0)), scale = crewScale(c), need = {};
  for (const g of CARDS[venue]) if (G[g.id].kind !== 'fee' && G[g.id].kind !== 'sky' && G[g.id].kind !== 'buy' && G[g.id].kind !== 'once') need[g.id] = needOf(g, scale, c, opts);
  const card = { venue, scale, crew: c, need, n: {}, done: [], who: [] };
  for (const g of CARDS[venue]) if (G[g.id].kind === 'fixed' && need[g.id] <= 0) card.done.push(g.id);   // nothing left to bring up
  return card;
}
// Print a migrated / unprinted card (scale null) for the crew online now, keeping its counts and ticks.
export function printOver(card, crew, opts = {}) {
  const fresh = printCard(card.venue, crew, opts);
  if (!fresh) return null;
  return { ...fresh, n: { ...card.n }, done: [...new Set([...fresh.done, ...(card.done ?? [])])], who: [...(card.who ?? [])], ...(card.grand ? { grand: true } : {}) };
}

// A save's card, cleaned. Junk or another venue's card: null (the morning prints a fresh one).
export function cleanCard(c, venue) {
  if (!c || typeof c !== 'object' || c.venue !== venue || !hasCard(venue)) return null;
  const ids = new Set(CARDS[venue].map(g => g.id));
  const n = {}, need = {};
  for (const [k, v] of Object.entries(c.n ?? {})) if (ids.has(k) && Number.isFinite(v)) n[k] = Math.max(0, Math.min(1e7, Math.floor(v)));
  for (const [k, v] of Object.entries(c.need ?? {})) if (ids.has(k) && Number.isFinite(v)) need[k] = Math.max(0, Math.min(1e7, Math.floor(v)));
  const done = [...new Set(Array.isArray(c.done) ? c.done.filter(k => ids.has(k) && G[k].kind !== 'fee' && G[k].kind !== 'sky') : [])];
  const who = Array.isArray(c.who) ? [...new Set(c.who.filter(w => typeof w === 'string' && w.length <= 16))].slice(0, 6) : [];
  const scale = Object.values(SCALE).includes(c.scale) ? c.scale : null;
  const crew = Number.isInteger(c.crew) && c.crew >= 1 && c.crew <= 6 ? c.crew : null;
  return { venue, scale: scale && crew ? scale : null, crew: scale ? crew : null, need, n, done, who, ...(c.grand ? { grand: true } : {}) };
}

// A save from before v5 (review stamps) becomes the card for its current venue (§1 A, save migration):
//   the review goal's count is min(N, stamps); purchase goals tick from what's owned (live anyway); the count goals
//   start at 0; Gary and treasure goals start open; a save with stamps ≥ 3 is grandfathered (every goal but the live
//   fee marked done), so nobody loses a promotion they'd already earned. An Orbital save is grandfathered too (it
//   earned the Orbital under the stamps; Ball No. 1 keeps today's sky gate). The card prints at the next morning (scale null).
export function migrateV4(save) {
  const venue = Math.max(0, Math.min(5, Math.floor(Number(save?.venue) || 0)));
  if (save?.endless || !hasCard(venue)) return null;
  const stamps = Math.max(0, Math.floor(Number(save?.stamps) || 0));
  const card = { venue, scale: null, crew: null, need: {}, n: {}, done: [], who: [] };
  const N = reviewsNeed(venue);
  if (N) card.n.reviews = Math.min(N, stamps);
  const grand = venue === LAST_CARD || stamps >= RISE_REVIEWS;
  if (grand) { card.grand = true; for (const g of CARDS[venue]) if (G[g.id].kind !== 'fee' && G[g.id].kind !== 'sky') card.done.push(g.id); if (N) card.n.reviews = N; }
  return card;
}

// live: { up, cash, fee, sky } — what the card reads that isn't a count (the shop, the wallet, the Orbital's sky).
// Rows: [{ id, text, have, need, done, reward, fresh }] in card order (fresh: done since this morning, from `today`).
export function rowsOf(card, live = {}, today = []) {
  if (!card) return [];
  return CARDS[card.venue].map(g => {
    const d = G[g.id];
    let have = 0, need = 1, done = card.done.includes(g.id);
    switch (d.kind) {
      case 'fee': need = live.fee ?? 0; have = Math.min(need, Math.max(0, live.cash ?? 0)); done = need > 0 && (live.cash ?? 0) >= need; break;
      case 'sky': done = !!live.sky; have = done ? 1 : 0; break;
      case 'buy': done = done || (live.up?.[d.row] ?? 0) >= d.tier; have = done ? 1 : 0; break;
      case 'once': done = done || (card.n[g.id] ?? 0) >= 1; have = done ? 1 : 0; break;
      case 'riders': need = card.need[g.id] ?? card.crew ?? 1; have = Math.min(need, card.who?.length ?? 0); done = done || have >= need; break;
      default: need = card.need[g.id] ?? needOf(g, card.scale ?? 1, card.crew ?? 4); have = Math.min(need, card.n[g.id] ?? 0); done = done || have >= need;
    }
    return { id: g.id, kind: d.kind, text: d.text(need, live.fee), have, need, done, reward: !!d.reward, fresh: done && today.includes(g.id) };
  });
}
export const cardDone = rows => rows.length > 0 && rows.every(r => r.done);
export const doneCount = rows => rows.filter(r => r.done).length;

// "Next" is the first open goal in card order, except that the fee only shows when it's the last one left.
export function nextGoal(rows) {
  const open = rows.filter(r => !r.done);
  if (!open.length) return null;
  return open.find(r => r.kind !== 'fee') ?? open[0];
}
const left = r => Math.max(0, r.need - r.have);
// The row's words for the strip and the deal: "18 more hot dogs", "buy the ball washer", "huddle for Gary".
export function moreText(r) {
  if (!r) return '';
  const d = G[r.id];
  if (d.more && r.kind !== 'buy' && r.kind !== 'once' && r.kind !== 'sky') return d.more(left(r));
  const t = d.text(r.need);
  return t[0].toLowerCase() + t.slice(1);
}
// The card row: "Serve 30 hot dogs · 18 / 30", "Buy the ball washer · ✓", "Save the $5,500 fee · $4,605 / $5,500".
export function goalLine(r) {
  if (r.done) return `${r.text} · ✓`;
  if (r.kind === 'fee') return `${r.text} · ${money(Math.floor(r.have))} / ${money(r.need)}`;
  if (r.kind === 'count' || r.kind === 'fixed' || r.kind === 'reviews' || r.kind === 'riders') return `${r.text} · ${commas(r.have)} / ${commas(r.need)}`;
  return r.text;
}
// What a feature goal pays when it completes: 50 × BV (cents).
export const rewardFor = bv => Math.round((Number(bv) || 0) * REWARD_BV * 100) / 100;
// The one toast (≤ 8 words): "Goal done! 30 hot dogs. +$1,450"
export const doneToast = (id, need, reward) => `Goal done! ${G[id]?.short?.(need) ?? G[id]?.text(need) ?? id}.${reward > 0 ? ' +' + money(reward) : ''}`;

// The Board's strip: five pips, "3 OF 5 GOALS", "NEXT: 18 MORE HOT DOGS". The Orbital: "THE LAST BUCKET 2 OF 4".
export function strip(rows, venue) {
  if (!rows?.length) return null;
  const k = doneCount(rows), n = rows.length, nx = nextGoal(rows);
  return { pips: rows.map(r => r.done), label: venue === LAST_CARD ? `THE LAST BUCKET ${k} OF ${n}` : `${k} OF ${n} GOALS`,
    next: nx ? 'NEXT: ' + moreText(nx).toUpperCase() : venue === LAST_CARD ? 'BALL NO. 1 IS COMING' : 'CARD DONE · SIGN AT THE BELL' };
}

// The report's headline: "3 of 5 done · 2 to go", or "Card done! Sign for Tiered."
const VENUE_SHORT = ['the Muni', 'the Club', 'Tiered', 'the Stadium', 'the County', 'the Orbital'];
export const venueShort = v => VENUE_SHORT[v] ?? 'the next range';
export function headline(rows, venue) {
  if (!rows?.length) return '';
  const k = doneCount(rows), n = rows.length;
  if (k >= n) return venue === LAST_CARD ? 'Every step done! Ball No. 1 falls.' : `Card done! Sign for ${venueShort(venue + 1)}.`;
  return `${k} of ${n} done · ${n - k} to go`;
}
// The tomorrow line (≤ 8 words): "Tomorrow: two goals left for Tiered." / "Tomorrow: sign at the bell for Tiered."
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
export function tomorrowLine(rows, venue) {
  if (!rows?.length) return null;
  const open = rows.length - doneCount(rows);
  if (venue === LAST_CARD) return open ? `Tomorrow: ${WORDS[open]} step${open === 1 ? '' : 's'} to the Last Bucket.` : null;
  const to = venueShort(venue + 1);
  return open ? `Tomorrow: ${WORDS[open]} goal${open === 1 ? '' : 's'} left for ${to}.` : `Tomorrow: sign at the bell for ${to}.`;
}
// The morning deal's line (≤ 8 words): "Goal: 12 more hot dogs."
export const dealLine = r => (r ? `Goal: ${moreText(r)}.` : null);
// The feature goal to deal: the open one nearest done (count goals by share; the rest at 0), card order on ties.
export function dealGoal(rows) {
  let best = null, bestF = -1;
  for (const r of rows ?? []) {
    if (r.done || !r.reward) continue;
    const f = r.need > 0 && r.kind !== 'buy' && r.kind !== 'once' ? r.have / r.need : 0;
    if (f > bestF) { best = r; bestF = f; }
  }
  return best;
}

// The card as HTML rows for the report and the pause menu's Goals panel: each row with a tick or a count and its
// reward; today's newly done goals highlighted. rewardNow: 50 × BV now (for the ✦ rows).
export function cardHtml(rows, { rewardNow = 0, esc = s => String(s) } = {}) {
  if (!rows?.length) return '';
  return '<ul class="goal-card">' + rows.map(r =>
    '<li class="' + (r.done ? 'done' : 'open') + (r.fresh ? ' fresh' : '') + '"><span class="tick">' + (r.done ? '✓' : '○') + '</span> ' +
    esc(goalLine(r).replace(/ · ✓$/, '')) +
    (r.reward ? ' <b class="reward">✦ ' + (r.done && !r.fresh ? 'paid' : '+' + money(rewardNow)) + '</b>' : '') + '</li>').join('') + '</ul>';
}
