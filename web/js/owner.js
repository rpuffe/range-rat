// Endless: the Owner's projects and the record's own pace (council round 7, #9). Pure: no THREE, no DOM.
// DELIBERATELY imports nothing from sim.js (the GUTTERS_ROW rule): sim.js imports OWNER_ROW from here, so importing it
// back would be a cycle. Callers pass CART.MAX_MULT in as `base`.
//
// After the Last Bucket, Site 12 is the crew's. One crew row, shown only in endless, three tiers, each a visible moment:
// the crew's colours on the stand, the Board frame and the carts; the Owner's Hustle (the Hustle cap ×2 → ×3, so the
// record is beaten by playing: pings and TARGETs are what move it, N3); and a bronze statue by the stand.

export const OWNER = {
  PAINT: 1, HUSTLE: 2, STATUE: 3,   // tiers
  HUSTLE_MULT: 3,                   // the Hustle cap with the Owner's Hustle, in endless only
  BASE_MULT: 2,                     // CART.MAX_MULT, for callers that don't pass it
};

export const OWNER_ROW = {
  id: 'owner', title: "Owner's projects", endless: true, tiers: [
    { name: 'Nothing yet', desc: 'Site 12 is yours. It looks exactly like it did when it was Corporate\'s.' },
    // Council round 8 #3: the colours are the deed, not a purchase. Ball No. 1 sets tier 1 (crew.mjs depositOne); cost 0
    // keeps the index (no save migration) and makes the shop's next tier the Owner's Hustle.
    { name: 'Crew colours', cost: 0, desc: "Site 12 is yours. It's in your colours now." },
    { name: "The Owner's Hustle", cost: 120_000_000, desc: 'Hit the Cart caps at ×3, not ×2. Pings and TARGETs beat the record.' },
    { name: 'The statue', cost: 300_000_000, desc: 'A bronze Range Rat holding Ball No. 1, by the bank. Your names on the plinth.' },
  ],
};

export const ownerTier = up => Math.max(0, Math.min(OWNER_ROW.tiers.length - 1, (up?.owner ?? 0) | 0));
// The Hustle cap: ×3 in endless once the Owner's Hustle is bought; `base` (×2) everywhere else, whatever the tier.
export const maxMult = (up, endless, base = OWNER.BASE_MULT) =>
  endless && ownerTier(up) >= OWNER.HUSTLE ? OWNER.HUSTLE_MULT : base;
export const hasPaint = (up, endless) => !!endless && ownerTier(up) >= OWNER.PAINT;
export const hasStatue = (up, endless) => !!endless && ownerTier(up) >= OWNER.STATUE;

// ---- the record's own pace (C4) ---------------------------------------------------------------------------------
// The record shift's cumulative cash at CURVE_N checkpoints (every 30 s of a 420 s shift); the last is the record.
// The endless Board's pace tick interpolates it, so the pace doesn't lie in the first minute (the record banked slowly
// then too). A record saved before the curve existed falls back to linear.
export const CURVE_N = 14;

// During a shift: push today's cumulative cash at each checkpoint passed (the last one is the bell: finishCurve).
export function curveStep(pts, shiftT, shiftSecs, cash) {
  if (!(shiftSecs > 0)) return pts;
  while (pts.length < CURVE_N - 1 && shiftT >= (pts.length + 1) * shiftSecs / CURVE_N) pts.push(Math.max(0, +cash || 0));
  return pts;
}
// At the bell: CURVE_N rising points ending on the day's cash (missed checkpoints repeat the last; never above the day).
export function finishCurve(pts, dayCash) {
  const end = Math.max(0, +dayCash || 0), out = [];
  for (let i = 0; i < CURVE_N - 1; i++) {
    const v = Number.isFinite(pts?.[i]) ? pts[i] : out[i - 1] ?? 0;
    out.push(Math.round(Math.min(end, Math.max(out[i - 1] ?? 0, v)) * 100) / 100);
  }
  out.push(end);
  return out;
}
// A saved curve, or null: CURVE_N finite, non-negative, non-decreasing numbers.
export function cleanCurve(c) {
  if (!Array.isArray(c) || c.length !== CURVE_N) return null;
  for (let i = 0; i < CURVE_N; i++) if (!Number.isFinite(c[i]) || c[i] < 0 || (i && c[i] < c[i - 1])) return null;
  return c.slice();
}
// Where the record was at shiftT: the curve, interpolated (0 at the opening), or linear without one.
export function paceAt(records, shiftT, shiftSecs) {
  const cash = +records?.cash || 0;
  if (!(shiftSecs > 0) || cash <= 0) return 0;
  const f = Math.max(0, Math.min(1, shiftT / shiftSecs));
  const c = cleanCurve(records.curve);
  if (!c) return cash * f;
  const x = f * CURVE_N, k = Math.min(CURVE_N - 1, Math.floor(x));
  const a = k ? c[k - 1] : 0, b = c[k];
  return a + (b - a) * (x - k);
}

// ---- racing yesterday (council round 8 #3) -----------------------------------------------------------------------
// The endless Board races yesterday's shift (its cash and its curve), not the all-time record.
// Council round 11 #6: with no yesterday (endless day 1, the Owners' first) there is no race: the Orbital's debris-fed
// record is out of reach, and a first report that reads as a loss to your own ghost is no way to start.
// Returns { cash, curve?, vs: 'yesterday' }, or null with nothing to race.
export function yesterdayPace(records) {
  const y = records?.yesterday;
  if (y && +y.cash > 0) return { cash: +y.cash, ...(cleanCurve(y.curve) ? { curve: y.curve } : {}), vs: 'yesterday' };
  return null;
}
// A saved yesterday, or undefined.
export function cleanYesterday(y) {
  const cash = Number(y?.cash);
  if (!Number.isFinite(cash) || cash < 0) return undefined;
  const c = cleanCurve(y.curve);
  return c ? { cash, curve: c } : { cash };
}
// At an endless bell: today against yesterday. Returns the records' new yesterday and streak, and the report's result
// { beat, streak, by }. Pure: crew.mjs assigns it. Council round 11 #6: no yesterday yet (endless day 1): no race, the
// result is { first: true, target } (today's cash: tomorrow's to beat) and the streak starts at 0.
export function raceYesterday(records, dayCash, curve) {
  const cash = Math.max(0, +dayCash || 0), y = yesterdayPace(records);
  const c = cleanCurve(curve);
  const yesterday = c ? { cash, curve: c } : { cash };
  if (!y) return { yesterday, streak: 0, result: { first: true, target: Math.round(cash * 100) / 100 } };
  const target = y.cash, beat = cash > target;
  const streak = beat ? Math.max(0, (records?.streak | 0)) + 1 : 0;
  return { yesterday, streak, result: { beat, streak, by: Math.round(Math.abs(cash - target) * 100) / 100, vs: target } };
}

// ---- council round 11 #6: the Owners keep their own book ----------------------------------------------------------
// records.owner = { cash }: the best endless shift. The Orbital's records.cash stays the report's 'Best ever'. The first
// endless bell opens the book (no NEW); from then on beating it is the record (the PA, the report's 'Record shift!').
// Returns { owner, record } (record: { cash, was, owner: true } or null).
export function ownerRecord(records, dayCash) {
  const cash = Math.max(0, +dayCash || 0), was = cleanOwner(records?.owner);
  if (!was) return { owner: { cash }, record: null };
  if (cash > was.cash) return { owner: { cash }, record: { cash, was: was.cash, owner: true } };
  return { owner: was, record: null };
}
// A saved owner book, or undefined.
export function cleanOwner(o) {
  if (o == null) return undefined;
  const cash = Number(o.cash);
  return Number.isFinite(cash) && cash >= 0 ? { cash } : undefined;
}
// Banking Ball No. 1 opens the Owners' book (builder 2's depositOne): yesterday, the streak and the owner record go.
export function ownerBook(records) {
  const { yesterday, streak, owner, ...rest } = records ?? {};
  return rest;
}

// The Orbital's sky phase waiting on the winch (builder 4's strip, huddlerules.js): "SKY CLEAR · WINCH $13.2M · YOU HAVE $9.1M".
export const winchLine = (price, cash) => `SKY CLEAR · WINCH ${shortMoney(price)} · YOU HAVE ${shortMoney(cash)}`;
// "$2.1M", "$850K", "$900": the report's short money.
export function shortMoney(v) {
  const a = Math.abs(+v || 0), r1 = x => (Math.round(x * 10) / 10).toString();
  if (a >= 1e9) return '$' + r1(a / 1e9) + 'B';
  if (a >= 1e6) return '$' + r1(a / 1e6) + 'M';
  if (a >= 1e4) return '$' + Math.round(a / 1e3) + 'K';
  return '$' + Math.round(a).toLocaleString('en-US');
}
// The endless report's first line: "Beat yesterday · 4 in a row." or "Short of yesterday by $2.1M."
// Council round 11 #6: endless day 1 reads "Day 1 as Owners. Beat $70.8M tomorrow."
export function streakLine(res) {
  if (!res) return '';
  if (res.first) return `Day 1 as Owners. Beat ${shortMoney(res.target)} tomorrow.`;
  if (res.beat) return res.streak > 1 ? `Beat yesterday · ${res.streak} in a row.` : 'Beat yesterday.';
  return 'Short of yesterday by ' + shortMoney(res.by) + '.';
}

// ---- crew colours ----------------------------------------------------------------------------------------------
// One stripe a Rat, in join order (the snapshot's player order), at most 6. Hex strings or numbers.
export const crewStripes = players => (players ?? []).map(p => p?.color).filter(c => c != null && c !== '').slice(0, 6);
export const STATUE_PA = 'statue';

// ---- council round 12 #8 (builder 3): Site 13, the live endless rival --------------------------------------------
// From endless day 2 the Board races Site 13: "SITE 13 $41.8M (est.)" under your total. Their number climbs through
// the shift on the same curve as yours (yesterday's, as paceAt reads it: the Last Call surge is in it), aiming at
// F × your average for the last 3 Owners' days, ±JITTER from hash32(day). The council asked for 1.04 / 1.08; endless
// income is flat day to day once the Owner's projects are bought, so 1.04 beat the bot on only 36 % of days (18 runs):
// F 1.00 / F2 1.04 measures 45-55 % (design/round14-ending.md). Beat them on WIN of the WEEK endless days
// (days 2–8, 9–15, …) and Site 13 is acquired: the next morning's memo says so, their fence sign takes the crew's teal
// and the Site 13 jacket unlocks. Week 2 on they come back with a jumbotron: F2.
// records.rival = { week, wins, days, last: [the last 3 Owners' days' cash], acquired } (saved with the records).
export const RIVAL = Object.freeze({ FROM: 2, F: 1.0, F2: 1.04, JITTER: 0.06, WEEK: 7, WIN: 4, LAST: 3, PASS_AFTER: 60 });
// FNV-1a over the day (the same hash as today.js hash32, kept local: this module imports nothing).
function hashDay(day) {
  let h = 0x811c9dc5;
  for (const ch of String(day) + '|site13') { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}
export const rivalJitter = day => ((hashDay(day) % 10001) / 10000 * 2 - 1) * RIVAL.JITTER;   // −6 % … +6 %
// Today's target, or null (no Owners' day banked yet). rival: records.rival; day: the global day.
export function rivalTarget(rival, day) {
  const last = (rival?.last ?? []).filter(v => Number.isFinite(v) && v >= 0).slice(-RIVAL.LAST);
  if (!last.length) return null;
  const avg = last.reduce((a, b) => a + b, 0) / last.length;
  const f = (rival?.week | 0) >= 2 ? RIVAL.F2 : RIVAL.F;
  return Math.round(avg * f * (1 + rivalJitter(day)) * 100) / 100;
}
// Their live number at shiftT: the target on yesterday's curve (linear without one).
export function rivalPace(target, records, shiftT, shiftSecs) {
  if (!(target > 0)) return 0;
  const y = yesterdayPace(records);
  if (!y || !y.curve || !(y.curve[CURVE_N - 2] > 0)) return target * Math.max(0, Math.min(1, shiftT / shiftSecs));   // no (or an empty) curve: linear
  return target * paceAt({ cash: y.cash, curve: y.curve }, shiftT, shiftSecs) / y.cash;
}
// At an Owners' bell: today's cash against today's target (null target: no race, day 1). Returns
// { rival: the new records.rival, result: { win, target, cash } | null, acquired: bool (the week was won), newWeek }.
export function rivalBell(rival, target, dayCash, poached = false) {
  const r = cleanRival(rival) ?? { week: 1, wins: 0, days: 0, last: [], acquired: 0, dbl: 0, pw: 0 };
  const cash = Math.max(0, +dayCash || 0);
  const last = [...r.last, cash].slice(-RIVAL.LAST);
  if (!(target > 0)) return { rival: { ...r, last }, result: null, acquired: false, newWeek: false };
  const win = cash > target;
  let { week, wins, days, acquired } = r;
  // Council round 13 #4b: a poached win counts twice toward the 4 of 7. Council round 14 #5a (builder 3; C #3: two poached
  // wins acquired Site 13 by day 3, every week): only the week's first poached win (r.dbl); later ones count 1.
  let dbl = r.dbl, double = false;
  days++; if (win) { double = poached && !dbl; wins += double ? POACH.COUNT : 1; if (double) dbl = 1; }
  let won = false, newWeek = false;
  // Council round 13 #4b (builder 2): the 4th win clinches the week at once (a poaching crew can take Site 13 by its
  // 4th-5th Owners' day); otherwise the week resolves on its 7th day, as before.
  let pw = r.pw;
  if (days >= RIVAL.WEEK || wins >= RIVAL.WIN) { won = wins >= RIVAL.WIN; if (won) acquired++; week++; wins = 0; days = 0; newWeek = true; dbl = 0; pw = 0; }
  return { rival: { week, wins, days, last, acquired, dbl, pw }, result: { win, ...(poached ? { poached: true } : {}), ...(double ? { double: true } : {}), target: Math.round(target * 100) / 100, cash: Math.round(cash * 100) / 100 }, acquired: won, newWeek };
}
// A saved rival, or undefined.
export function cleanRival(r) {
  if (!r || typeof r !== 'object') return undefined;
  const n = (v, hi) => Math.max(0, Math.min(hi, Math.floor(Number(v) || 0)));
  const last = (Array.isArray(r.last) ? r.last : []).map(Number).filter(v => Number.isFinite(v) && v >= 0).slice(-RIVAL.LAST);
  return { week: Math.max(1, n(r.week, 1e6)), wins: n(r.wins, RIVAL.WEEK), days: n(r.days, RIVAL.WEEK - 1), last, acquired: n(r.acquired, 1e6),
    dbl: r.dbl ? 1 : 0, pw: n(r.pw, RIVAL.WEEK) };   // council round 14 #5a: the week's double used; poaches this week
}
// The report's first line (not centre text): "Site 13 revised its estimate." / "Site 13 sends a fruit basket."
export const rivalLine = res => (!res ? '' : res.win ? 'Site 13 revised its estimate.' : 'Site 13 sends a fruit basket.');
// The week so far, for the report's row: "Site 13 this week: 3 of 5 won (4 of 7 acquires)."
export const rivalWeekLine = rival => (rival ? `Site 13 this week: ${rival.wins} of ${rival.days} won (${RIVAL.WIN} of ${RIVAL.WEEK} acquires).` : '');

// ---- council round 13 #4b (builder 2): poach a Site 13 regular -------------------------------------------------------
// Endless only, from the first day with a race (a yesterday), once a day. It costs SHARE of yesterday's bank. Today a bay
// of Site 13's regulars (in their jackets) hits at your range (+EXTRA of the day's customer balls, server/venues/poach.mjs),
// Site 13's live target drops CUT, and a day you poach AND win counts COUNT of the "4 of 7" toward the acquisition.
// Council round 14 #5a: DOUBLE_PER_WEEK (one poached win a rival week counts COUNT; any more count 1) and RISE (the price
// × RISE for each poach already made this week: 25 %, 37.5 %, 56 % of yesterday's bank).
export const POACH = Object.freeze({ SHARE: 0.25, CUT: 0.05, COUNT: 2, EXTRA: 0.07, DOUBLE_PER_WEEK: 1, RISE: 1.5 });
export const POACH_ROW = {
  id: 'poach', title: 'Poach a Site 13 regular', endless: true, repeat: 'day', tiers: [
    { name: 'Nobody poached today', desc: 'Site 13 has regulars. Regulars have prices.' },
    { name: 'Poach a regular', cost: 0, desc: "A quarter of yesterday's bank, more for each poach this week. Their regulars hit here today, Site 13's target drops 5 %, and the week's first poached win counts double." },
  ],
};
// Today's price, or null: not endless, no yesterday (no race yet), or already poached today. Council round 14 #5a:
// weekPoaches (records.rival.pw, the poaches already made this rival week) raises it ×RISE each.
export function poachPrice({ endless = false, records = null, day = 0, poachDay = null, weekPoaches = null } = {}) {
  const y = +records?.yesterday?.cash || 0;
  if (!endless || !(y > 0) || poachDay === day) return null;
  const k = Math.max(0, (weekPoaches ?? records?.rival?.pw ?? 0) | 0);
  return Math.round(y * POACH.SHARE * POACH.RISE ** k * 100) / 100;
}
// Is the week's double still unused? (the shop's "Counts double today")
export const poachDouble = rival => !(cleanRival(rival)?.dbl);
export const POACH_DOUBLE_TAG = 'Counts double today';
// The shop row's tag from the snapshot (s.mods.poach): the tag while today's poach is for sale and the double unused.
export const poachShopTag = mine => (mine?.price != null && mine?.dbl ? POACH_DOUBLE_TAG : null);
// Council round 14 #5b: the report row on a poach day (POACH_FEED below is also the morning's centre card).
// The regulars: N figures in Site 13 red at their bay. (The morning's card is the PA queue's: pa.js PA_LINES.poach.)
export const POACH_BAY = Object.freeze({ x: 22, z: -0.4 });   // their bay (server/venues/poach.mjs REG_BAY: launch()'s mat z)
export const POACH_CARD = Object.freeze({ N: 3, RED: 0xc0262d });
export const regularsShown = (s, mine) => !!s?.endless && !!mine?.on && s?.phase === 'shift';
export const POACH_ROW_LINE = 'Poached a regular · Site 13 −5 %';
// Site 13's target once you've poached one of theirs.
export const poachTarget = target => (target > 0 ? Math.round(target * (1 - POACH.CUT) * 100) / 100 : target);
export const POACH_FEED = 'Site 13 lost a regular. To you.';
// The report's hint, once, the first time a Hustle (Owner's) contract wins against them (5 words).
export const HUSTLE_HINT = 'Hustle days beat Site 13.';
