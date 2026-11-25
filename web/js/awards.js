// The end-of-night recap and awards (round 11, expert review #8). Pure: no THREE, no DOM. The server (crew.mjs) adds
// each Rat's shift counters into the night's at every bell (addNight) and builds the night card (nightCard) into
// every report and the save; the client (recap.js) draws it at a promotion ("Good place to stop") and, for a saved
// crew coming back, as "Previously on Range Rat".

// The counters a night keeps per Rat (each a p.shift key the server already counts, or one round 11 adds:
// picked, dealt, gary (seconds chatting to Gary), treasures).
export const NIGHT_KEYS = ['banked', 'cash', 'picked', 'knockdowns', 'dealt', 'cooked', 'dived', 'hosed', 'scrubbed', 'buckets', 'pings', 'gary', 'treasures', 'mowed'];

// One award per Rat, in this order: each goes to the best Rat not yet awarded with a count over 0.
// [title, key, unit line]
export const AWARDS = [
  ['Most Knockdowns Dealt', 'dealt', n => `${n} Rats flattened`],
  ['Fry Lord', 'cooked', n => `${n} served`],
  ['Deepest Diver', 'dived', n => `${n} balls off the bottom`],
  ['Talked to Gary the Longest', 'gary', n => `${Math.round(n)} s of small talk`],
  ['Most Sprayed', 'hosed', n => `${n} things hosed clean`],
  ['Treasure Hunter', 'treasures', n => `${n} treasures`],
  ['Sweep King', 'picked', n => `${n.toLocaleString('en-US')} balls picked`],
  ['Most Horizontal', 'knockdowns', n => `${n} times flat`],
  ['Crank Champion', 'scrubbed', n => `${n.toLocaleString('en-US')} balls scrubbed`],
  ['Bucket Brigade', 'buckets', n => `${n} buckets filled`],
  ['Cart Magnet', 'pings', n => `${n} pings`],
  ['Banker of the Night', 'banked', n => `${n.toLocaleString('en-US')} balls banked`],
];

const num = v => (Number.isFinite(+v) ? +v : 0);
// Add one Rat's shift counters into their night: night[name] = { color, ...counts }. Mutates and returns night.
export function addNight(night, name, color, shift = {}) {
  const r = night[name] ??= { color };
  r.color = color ?? r.color;
  for (const k of NIGHT_KEYS) { const v = num(shift[k]); if (v) r[k] = Math.round((num(r[k]) + v) * 100) / 100; }
  return night;
}

// rats: { name: { color, ...counts } }. Returns [{ name, color, award, line }], best first by banked.
export function awardsFor(rats = {}) {
  const list = Object.entries(rats).map(([name, r]) => ({ name, ...r }));
  const out = new Map();
  for (const [title, key, line] of AWARDS) {
    const best = list.filter(r => !out.has(r.name) && num(r[key]) > 0).sort((a, b) => num(b[key]) - num(a[key]))[0];
    if (best) out.set(best.name, { award: title, line: line(num(best[key])) });
  }
  return list.sort((a, b) => num(b.banked) - num(a.banked))
    .map(r => ({ name: r.name, color: r.color ?? '#fff8ec', ...(out.get(r.name) ?? { award: 'Showed Up', line: 'Corporate noticed' }) }));
}

// The night card. n: { startedAt, now (ms), fromDay, day, venue, title, balls, cash, knockdowns, falls, treasures, shifts, rats }.
export function nightCard(n = {}) {
  return {
    minutes: Math.max(0, Math.round((num(n.now) - num(n.startedAt)) / 60000)),
    fromDay: n.fromDay ?? n.day ?? 1, day: n.day ?? 1, shifts: n.shifts ?? 0, venue: n.venue ?? 0, title: n.title ?? '',
    balls: num(n.balls), cash: Math.round(num(n.cash) * 100) / 100, knockdowns: num(n.knockdowns), falls: num(n.falls), treasures: num(n.treasures),
    rats: awardsFor(n.rats ?? {}),
  };
}

// A saved night card, cleaned (or null).
export function cleanCard(c) {
  if (!c || typeof c !== 'object') return null;
  const i = (v, hi = 1e9) => Math.max(0, Math.min(hi, Math.floor(num(v))));
  const s = (v, n = 40) => String(v ?? '').slice(0, n);
  const rats = (Array.isArray(c.rats) ? c.rats : []).slice(0, 6).map(r => ({ name: s(r?.name, 16), color: /^#[0-9a-f]{3,8}$/i.test(r?.color) ? r.color : '#fff8ec', award: s(r?.award), line: s(r?.line) }));
  return { minutes: i(c.minutes, 1e5), fromDay: i(c.fromDay, 1e6) || 1, day: i(c.day, 1e6) || 1, shifts: i(c.shifts, 1e5), venue: i(c.venue, 6), title: s(c.title),
    balls: i(c.balls), cash: Math.max(0, Math.round(num(c.cash) * 100) / 100), knockdowns: i(c.knockdowns), falls: i(c.falls), treasures: i(c.treasures), rats };
}

// The card's numbers as rows [label, value] (only what happened; minutes, balls and knockdowns always).
export function cardRows(c) {
  if (!c) return [];
  const rows = [['Minutes played', String(c.minutes)], ['Balls banked', c.balls.toLocaleString('en-US')], ['Knockdowns', String(c.knockdowns)]];
  if (c.falls) rows.push(['Deck falls', String(c.falls)]);
  if (c.treasures) rows.push(['Treasures', String(c.treasures)]);
  return rows;
}
export const daysText = c => (!c ? '' : c.fromDay === c.day ? `Day ${c.day}` : `Days ${c.fromDay}–${c.day}`);
