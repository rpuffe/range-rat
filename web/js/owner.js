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
// The endless Board races yesterday's shift (its cash and its curve), not the all-time record; an old save with no
// yesterday yet races the record. Returns { cash, curve?, vs: 'yesterday'|'record' }, or null with nothing to race.
export function yesterdayPace(records) {
  const y = records?.yesterday;
  if (y && +y.cash > 0) return { cash: +y.cash, ...(cleanCurve(y.curve) ? { curve: y.curve } : {}), vs: 'yesterday' };
  if (+records?.cash > 0) return { cash: +records.cash, ...(cleanCurve(records.curve) ? { curve: records.curve } : {}), vs: 'record' };
  return null;
}
// A saved yesterday, or undefined.
export function cleanYesterday(y) {
  const cash = Number(y?.cash);
  if (!Number.isFinite(cash) || cash < 0) return undefined;
  const c = cleanCurve(y.curve);
  return c ? { cash, curve: c } : { cash };
}
// At an endless bell: today against yesterday (or the record, before there is a yesterday). Returns the records' new
// yesterday and streak, and the report's result { beat, streak, by }. Pure: crew.mjs assigns it.
export function raceYesterday(records, dayCash, curve) {
  const cash = Math.max(0, +dayCash || 0), target = yesterdayPace(records)?.cash ?? 0;
  const beat = cash > target;
  const streak = beat ? Math.max(0, (records?.streak | 0)) + 1 : 0;
  const c = cleanCurve(curve);
  return { yesterday: c ? { cash, curve: c } : { cash }, streak,
    result: { beat, streak, by: Math.round(Math.abs(cash - target) * 100) / 100, vs: target } };
}
// "$2.1M", "$850K", "$900": the report's short money.
export function shortMoney(v) {
  const a = Math.abs(+v || 0), r1 = x => (Math.round(x * 10) / 10).toString();
  if (a >= 1e9) return '$' + r1(a / 1e9) + 'B';
  if (a >= 1e6) return '$' + r1(a / 1e6) + 'M';
  if (a >= 1e4) return '$' + Math.round(a / 1e3) + 'K';
  return '$' + Math.round(a).toLocaleString('en-US');
}
// The endless report's first line: "Beat yesterday · 4 in a row." or "Short of yesterday by $2.1M."
export function streakLine(res) {
  if (!res) return '';
  if (res.beat) return res.streak > 1 ? `Beat yesterday · ${res.streak} in a row.` : 'Beat yesterday.';
  return 'Short of yesterday by ' + shortMoney(res.by) + '.';
}

// ---- crew colours ----------------------------------------------------------------------------------------------
// One stripe a Rat, in join order (the snapshot's player order), at most 6. Hex strings or numbers.
export const crewStripes = players => (players ?? []).map(p => p?.color).filter(c => c != null && c !== '').slice(0, 6);
export const STATUE_PA = 'statue';
