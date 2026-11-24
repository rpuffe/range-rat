// Council round 7 #9: Endless, the Owner's projects, and a Board that races the record's own curve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OWNER_ROW, OWNER, ownerTier, maxMult, hasPaint, hasStatue, CURVE_N, curveStep, finishCurve, cleanCurve, paceAt, crewStripes,
  yesterdayPace, raceYesterday, streakLine, shortMoney } from '../web/js/owner.js';
import { SHOP_BY_ID, shopShows, nextPrice, CART } from '../web/js/sim.js';

test('the row is hidden outside endless and shown in it', () => {
  assert.equal(SHOP_BY_ID.owner, OWNER_ROW);
  for (let v = 0; v <= 5; v++) assert.equal(shopShows(OWNER_ROW, v, 99, false), false);
  assert.equal(shopShows(OWNER_ROW, 5, 99, true), true);
  assert.equal(nextPrice('owner', {}, 1, 0, 5, 99, false), null);
  assert.equal(nextPrice('owner', {}, 1, 0, 5, 99, true), 0, 'round 8 #3: the colours are the deed, not a buy');
});

test('prices scale ×2.2 at 4P, three tiers, then maxed (round 8 #3: $120M and $300M)', () => {
  assert.equal(nextPrice('owner', {}, 4, 0, 5, 99, true), 0);
  assert.equal(nextPrice('owner', { owner: 1 }, 4, 0, 5, 99, true), 264_000_000);
  assert.equal(nextPrice('owner', { owner: 2 }, 4, 0, 5, 99, true), 660_000_000);
  assert.equal(nextPrice('owner', { owner: 3 }, 4, 0, 5, 99, true), null);
});

test('maxMult is 2 before tier 2 and 3 after, and 2 outside endless whatever the tier', () => {
  assert.equal(CART.MAX_MULT, OWNER.BASE_MULT);
  assert.equal(maxMult({}, true), 2);
  assert.equal(maxMult({ owner: 1 }, true), 2);
  assert.equal(maxMult({ owner: 2 }, true), 3);
  assert.equal(maxMult({ owner: 3 }, true), 3);
  for (const t of [0, 1, 2, 3]) assert.equal(maxMult({ owner: t }, false, CART.MAX_MULT), 2);
  assert.equal(ownerTier({ owner: 99 }), 3);
  assert.equal(hasPaint({ owner: 1 }, true), true); assert.equal(hasPaint({ owner: 1 }, false), false);
  assert.equal(hasStatue({ owner: 2 }, true), false); assert.equal(hasStatue({ owner: 3 }, true), true);
});

test('records.curve: 14 rising points from a shift, the last the day', () => {
  const pts = [];
  let cash = 0;
  for (let t = 0; t <= 420; t += 0.5) { cash += t < 60 ? 10 : 100; curveStep(pts, t, 420, cash); }
  assert.equal(pts.length, CURVE_N - 1);
  const c = finishCurve(pts, cash + 500);
  assert.equal(c.length, 14);
  for (let i = 1; i < 14; i++) assert.ok(c[i] >= c[i - 1]);
  assert.ok(c[0] > 0 && c[13] === cash + 500);
  assert.deepEqual(cleanCurve(c), c);
  // a late join (server restart mid-shift) fills the missed checkpoints, and nothing passes the day
  const late = finishCurve(curveStep([], 200, 420, 50), 40);
  assert.equal(late.length, 14); assert.ok(late.every(v => v <= 40));
});

test('pace interpolates the record curve', () => {
  const curve = Array.from({ length: 14 }, (_, i) => (i + 1) ** 2 * 1000);   // a slow start, a fast finish
  const records = { cash: curve[13], curve };
  assert.equal(paceAt(records, 0, 420), 0);
  assert.equal(paceAt(records, 30, 420), 1000);
  assert.equal(paceAt(records, 15, 420), 500);
  assert.equal(paceAt(records, 45, 420), 2500);           // halfway 1,000 → 4,000
  assert.equal(paceAt(records, 420, 420), 196_000);
  assert.equal(paceAt(records, 999, 420), 196_000);
  assert.ok(paceAt(records, 60, 420) < records.cash * 60 / 420, 'early on the curve is below linear: the record started slowly too');
});

test('an old record (no curve, or a broken one) falls back to linear', () => {
  assert.equal(paceAt({ cash: 42_000 }, 210, 420), 21_000);
  assert.equal(paceAt({ cash: 42_000, curve: [1, 2, 3] }, 210, 420), 21_000);
  assert.equal(paceAt({ cash: 42_000, curve: Array(14).fill(0).map((_, i) => 14 - i) }, 210, 420), 21_000);
  assert.equal(paceAt({ cash: 0 }, 210, 420), 0);
  assert.equal(cleanCurve(null), null);
});

test('crew colours: one stripe a Rat, in join order', () => {
  assert.deepEqual(crewStripes([{ color: '#f00' }, { color: '#0f0' }, {}]), ['#f00', '#0f0']);
  assert.deepEqual(crewStripes(null), []);
});

// ---- the server: buying, the Hustle cap, the record curve, the pace -------------------------------------------
import { Crew } from '../server/crew.mjs';
function makeCrew(save = null, shiftSecs = 420) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('OWNR', save, { shiftSecs, seed: 7, now: () => clock.t });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
const ENDLESS = { day: 40, venue: 5, venueDay: 6, stamps: 3, endless: true, outstanding: 1, cash: 0 };

test('the server sells the row only in endless, and the statue says its PA once', () => {
  const v5 = makeCrew({ ...ENDLESS, endless: false, outstanding: 9 }).crew;
  const a5 = v5.join('A'); v5.connect(a5); v5.cash = 1e9;
  v5.input(a5, { a: [{ t: 'buy', id: 'owner' }] });
  assert.equal(v5.up.owner, undefined, 'not at the Orbital');
  const { crew } = makeCrew(ENDLESS);
  const a = crew.join('A'); crew.connect(a); crew.cash = 1e9; crew.flush();
  assert.equal(crew.up.owner, 1, 'round 8 #3: an endless save is already in its colours');
  for (let i = 0; i < 3; i++) crew.input(a, { a: [{ t: 'buy', id: 'owner' }] });
  assert.equal(crew.up.owner, 3);
  assert.equal(crew.cash, 1e9 - 420_000_000, 'solo prices: $120M + $300M; the 3rd buy is refused');
  assert.equal(crew.flush().ev.filter(e => e.t === 'pa' && e.id === 'statue').length, 1);
  assert.deepEqual(new Crew('OWNR', JSON.parse(JSON.stringify(crew.toSave()))).up.owner, 3, 'it survives a save');
});

test("pings cap the Hustle at ×2, ×3 with the Owner's Hustle in endless only", () => {
  const cap = (save, up) => {
    const { crew } = makeCrew({ ...save, up });
    const a = crew.join('A'); crew.connect(a); crew.startShift();
    const c = crew.carts[0] ?? { i: 0, driver: a.id, load: 0, x: 0, z: 0 };
    c.driver = a.id; crew.rng = () => 0.95;   // the 'mult' prize
    for (let i = 0; i < 12; i++) crew.ping({ by: a.id, vx: 0, vz: 0, vy: 0 }, c);
    return crew.mult;
  };
  assert.equal(cap(ENDLESS, { cart: 1, owner: 1 }), 2);
  assert.equal(cap(ENDLESS, { cart: 1, owner: 2 }), 3);
  assert.equal(cap({ ...ENDLESS, endless: false, outstanding: 9 }, { cart: 1, owner: 2 }), 2);
});

test('a record shift saves records.curve (14 rising points), and the next shift paces against it', () => {
  const { crew, run } = makeCrew({ ...ENDLESS, records: { cash: 1, banked: 0, day: 39 } });
  const a = crew.join('A'); crew.connect(a);
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  for (let t = 0; t < 420; t += 10) { crew.bank(t < 120 ? 1 : 10, a.id); run(10); }
  assert.equal(crew.phase, 'report');
  const c = crew.records.curve;
  assert.equal(c.length, 14);
  for (let i = 1; i < 14; i++) assert.ok(c[i] >= c[i - 1], 'rising');
  assert.equal(c[13], crew.records.cash);
  crew.startShift(); run(60);
  const pace = crew.snapshot().pace;
  assert.ok(Math.abs(pace.now - paceAt(crew.records, crew.shiftT, crew.shiftSecs)) < 0.01);
  assert.ok(pace.now < crew.records.cash * crew.shiftT / crew.shiftSecs, 'the record started slowly, so the pace does too');
});

// ---- council round 8 #3: race yesterday, the streak, the deed --------------------------------------------------------
const words = t => t.trim().split(/\s+/).filter(w => w !== '·').length;

test('streakLine: beat with a run, beat once, short by; all ≤ 8 words', () => {
  assert.equal(streakLine({ beat: true, streak: 4 }), 'Beat yesterday · 4 in a row.');
  assert.equal(streakLine({ beat: true, streak: 1 }), 'Beat yesterday.');
  assert.equal(streakLine({ beat: false, streak: 0, by: 2_140_000 }), 'Short of yesterday by $2.1M.');
  assert.equal(streakLine(null), '');
  assert.equal(shortMoney(850_000), '$850K'); assert.equal(shortMoney(900), '$900'); assert.equal(shortMoney(1.25e9), '$1.3B');
  for (const r of [{ beat: true, streak: 123 }, { beat: false, by: 999_999_999 }]) assert.ok(words(streakLine(r)) <= 8, streakLine(r));
});

test('raceYesterday: the streak counts beats and resets on a miss; the record stands in before a yesterday', () => {
  let rec = { cash: 50, streak: 0 };
  let r = raceYesterday(rec, 40, null);
  assert.equal(r.result.beat, false); assert.equal(r.result.by, 10); assert.equal(r.streak, 0);
  rec = { ...rec, yesterday: r.yesterday, streak: r.streak };
  r = raceYesterday(rec, 45, null);                 // beats yesterday (40), not the record
  assert.equal(r.result.beat, true); assert.equal(r.streak, 1);
  rec = { ...rec, yesterday: r.yesterday, streak: r.streak };
  r = raceYesterday(rec, 46, null); assert.equal(r.streak, 2);
  rec = { ...rec, yesterday: r.yesterday, streak: r.streak };
  r = raceYesterday(rec, 46, null); assert.equal(r.streak, 0, 'a tie is not a beat');
  assert.deepEqual(yesterdayPace({ cash: 10 }), { cash: 10, vs: 'record' });
  assert.equal(yesterdayPace({ cash: 0 }), null);
  assert.equal(yesterdayPace({ cash: 10, yesterday: { cash: 7 } }).vs, 'yesterday');
});

test('Ball No. 1 banks the deed: up.owner 1 and the paint shows', () => {
  const { crew } = makeCrew({ day: 30, venue: 5, venueDay: 6, stamps: 3, outstanding: 1 });
  const a = crew.join('A'); crew.connect(a); crew.startShift();
  assert.equal(crew.up.owner ?? 0, 0);
  crew.lastBucket = { phase: 'huddle', sweep: 99, held: [a.id] };
  crew.huddleIn = () => true;
  assert.equal(crew.depositOne(a), true);
  assert.equal(crew.up.owner, 1); assert.equal(hasPaint(crew.up, crew.endless), true);
  assert.equal(crew.records.yesterday, undefined, 'the ending shift does not write yesterday');
  assert.equal(crew.report.race, undefined);
  assert.equal(new Crew('OWNR', { ...ENDLESS, up: { owner: 0 } }).up.owner, 1, 'an endless save with owner 0 loads as 1');
  assert.equal(new Crew('OWNR', { ...ENDLESS, endless: false, outstanding: 9 }).up.owner ?? 0, 0, 'not before the ending');
});

test('two endless shifts: yesterday is the second, the streak counts, the pace races yesterday', () => {
  const { crew, run } = makeCrew({ ...ENDLESS, records: { cash: 1000, banked: 0, day: 39 } });
  const a = crew.join('A'); crew.connect(a);
  crew.startShift(); run(30);
  let p = crew.snapshot().pace;
  assert.equal(p.vs, 'record', 'an old save with no yesterday races the record'); assert.equal(p.record, 1000);
  for (const m of crew.mats) m.next = 1e9;
  for (let t = 30; t < 420; t += 10) { crew.bank(1, a.id); run(10); }
  assert.equal(crew.phase, 'report');
  const d1 = crew.report, y1 = crew.records.yesterday.cash;
  assert.ok(d1.race, 'an endless bell races'); assert.equal(y1, d1.cash);
  assert.equal(crew.snapshot().pace, null, 'no pace outside a shift');
  crew.startShift(); for (const m of crew.mats) m.next = 1e9;
  for (let t = 0; t < 420; t += 10) { crew.bank(5, a.id); run(10); }
  const y2 = crew.records.yesterday.cash;
  assert.equal(y2, crew.report.cash); assert.ok(y2 > y1);
  assert.equal(crew.report.race.beat, true); assert.equal(crew.records.streak, d1.race.beat ? 2 : 1);
  crew.startShift(); run(60);
  p = crew.snapshot().pace;
  assert.equal(p.vs, 'yesterday'); assert.equal(p.record, y2); assert.equal(p.best, crew.records.cash);
  assert.ok(Math.abs(p.now - paceAt(crew.records.yesterday, crew.shiftT, crew.shiftSecs)) < 0.01);
  crew.cash = 0;
  for (let t = 60; t < 420; t += 10) run(10);   // bank nothing more: a miss
  assert.equal(crew.phase, 'report');
  assert.equal(crew.report.race.beat, false); assert.equal(crew.records.streak, 0);
  const back = new Crew('OWNR', JSON.parse(JSON.stringify(crew.toSave())));
  assert.deepEqual(back.records.yesterday, crew.records.yesterday); assert.equal(back.records.streak ?? 0, 0);
});

test('review days never write yesterday or the streak', () => {
  const { crew, run } = makeCrew({ day: 10, venue: 2, venueDay: 2, stamps: 0, outstanding: 99, records: { cash: 1, banked: 0, day: 9 } });
  const a = crew.join('A'); crew.connect(a); crew.startShift();
  for (let t = 0; t < 420; t += 10) { crew.bank(10, a.id); run(10); }
  assert.equal(crew.phase, 'report');
  assert.equal(crew.records.yesterday, undefined); assert.equal(crew.records.streak, undefined); assert.equal(crew.report.race, undefined);
});
