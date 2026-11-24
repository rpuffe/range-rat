// Fun council, round 2 (design/council-round2.md): promotion and the venue ladder, Ready Up,
// the ball washer, gear grime, the New Hire Kit, the Corporate PA, the ledger and awards,
// crew records, the Last Bucket and endless mode, the CCTV mark, and the round-2 fixes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SIM, CART, WASH, FRIES, POND, VENUES, VENUE_RULES, PROMO_STAMPS, ONE_YEAR, BALLS_OUTSTANDING, WASHER, WASHER_HANDLES,
  atHandle, gearGrimeFactor, venueQuotaF, nextPrice, perks, priceScale, upkeepCeiling } from '../web/js/sim.js';

// A crew on a fake clock. `run(secs)` steps 20 ticks a second.
function makeCrew(save = null, shiftSecs = 600, seed = 11) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('RND2', save, { shiftSecs, seed, now: () => clock.t });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
const setMud = (crew, v) => { for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = v; };
// Start a shift with no customers and a spotless range (Curb 1), so BV is exact.
function openShift(crew, mud = 0) {
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  setMud(crew, mud);
  crew.flush();
}
function addPlayer(crew, name, x = 20, z = 5) {
  const p = crew.join(name);
  crew.connect(p);
  p.x = x; p.z = z;
  return p;
}
const act = (crew, p, ...a) => crew.input(p, { a });
const events = crew => crew.flush().ev;
const restingBall = (crew, x, z, kind) => {
  const b = crew.addBall({ x, y: SIM.BALL_R, z, vx: 0, vy: 0, vz: 0, kind });
  b.rest = true;
  return b;
};
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const STAND = SIM.STAND;
const ST = WASH.STATION;

// A crew at the report screen (day-1 shift, so there is no quota to disturb stamps), names online.
function atReport(save = {}, names = ['A'], shiftSecs = 5) {
  const m = makeCrew({ day: 1, ...save }, shiftSecs);
  const ps = names.map((n, i) => addPlayer(m.crew, n, 20 + i, 5));
  openShift(m.crew);
  m.run(shiftSecs + 1);
  assert.equal(m.crew.phase, 'report');
  m.crew.flush();
  return { ...m, ps };
}

// ---- constants the round-2 rules lean on -------------------------------------------------

test('Hustle is unchanged: +0.25 a ping, capped at x2', () => {
  assert.equal(CART.MULT_STEP, 0.25);
  assert.equal(CART.MAX_MULT, 2);
});

test('gearGrimeFactor: 1 + 0.25 x (1 - grime/3), clamped to 0..3', () => {
  near(gearGrimeFactor(0), 1.25);
  near(gearGrimeFactor(1), 1 + 0.25 * 2 / 3);
  near(gearGrimeFactor(2), 1 + 0.25 / 3);
  assert.equal(gearGrimeFactor(3), 1);
  assert.equal(gearGrimeFactor(9), 1, 'more than three layers is still three');
  assert.equal(gearGrimeFactor(-4), 1.25, 'negative is clean');
  assert.equal(gearGrimeFactor(undefined), 1.25, 'no grime recorded is clean');
});

test('perks: the washer tiers, turbo and covered bays', () => {
  assert.deepEqual([0, 1, 2, 3].map(w => perks({ washer: w }).washAuto), [0, 0, 1, 5]);
  assert.deepEqual([0, 1, 2, 3].map(w => perks({ washer: w }).price), [1, 2, 3, 3], 'the industrial tier adds throughput, not Rate');
  assert.deepEqual([0, 1, 2, 3].map(w => perks({ washer: w }).washer), [0, 1, 2, 3]);
  assert.equal(perks({}).turbo, false);
  assert.equal(perks({ amen: 1 }).turbo, true);
  assert.equal(perks({ amen: 1 }).covered, false);
  assert.equal(perks({ amen: 2 }).covered, true);
});

test('venue-gated shop rows: Club amenities and the industrial washer open at venue 1', () => {
  assert.equal(nextPrice('amen', {}, 1, 0, 0), null, 'not at the Muni');
  assert.equal(nextPrice('amen', {}, 1, 0, 1), 3000);
  assert.equal(nextPrice('amen', { amen: 1 }, 1, 0, 1), 8000);
  assert.equal(nextPrice('amen', { amen: 2 }, 1, 0, 1), null, 'maxed');
  assert.equal(nextPrice('amen', {}, 4, 0, 1), Math.round(3000 * priceScale(4)), 'a crew price');
  assert.equal(nextPrice('washer', { washer: 2 }, 1, 0, 0), null, 'the industrial wash is hidden at the Muni');
  assert.equal(nextPrice('washer', { washer: 2 }, 1, 0, 1), 6000);
  assert.equal(nextPrice('washer', { washer: 1 }, 1, 0, 0), 160, 'the electric tier is still a Muni purchase');
});

test('buying: amenities and the industrial wash are refused at the Muni, bought at the Club', () => {
  const muni = makeCrew({ up: { washer: 2 } }).crew;
  muni.cash = 100000;
  const a = addPlayer(muni, 'A');
  act(muni, a, { t: 'buy', id: 'amen' }, { t: 'buy', id: 'washer' });
  assert.equal(muni.up.amen, undefined);
  assert.equal(muni.up.washer, 2);
  assert.equal(muni.cash, 100000);

  const club = makeCrew({ venue: 1, up: { washer: 2 } }).crew;
  club.cash = 100000;
  const b = addPlayer(club, 'B');
  act(club, b, { t: 'buy', id: 'amen' }, { t: 'buy', id: 'amen' }, { t: 'buy', id: 'washer' });
  assert.equal(club.up.amen, 2);
  assert.equal(club.up.washer, 3);
  assert.equal(club.cash, 100000 - 3000 - 8000 - 6000);
  assert.equal(club.perks.turbo, true);
  assert.equal(club.perks.covered, true);
  assert.equal(club.perks.washAuto, 5);
});

// ---- promotion -----------------------------------------------------------------------

test('promoInfo: the fee scales with the online crew, stamps and ready', () => {
  const { crew } = atReport({ stamps: 3, cash: 10000 }, ['A', 'B', 'C', 'D']);
  assert.deepEqual(crew.promoInfo(), { next: 'Range Club', fee: 5500, stamps: 3, need: PROMO_STAMPS, ready: true, signed: [] });
  addPlayer(crew, 'E').online = 0;
  assert.equal(crew.promoInfo().fee, 5500, 'an offline Rat does not raise the price');
  assert.equal(crew.snapshot().promo.fee, 5500);
  crew.cash = 5499;
  assert.equal(crew.promoInfo().ready, false, 'short of the fee');
  crew.cash = 10000; crew.stamps = 2;
  assert.equal(crew.promoInfo().ready, false, 'short of stamps');
  assert.equal(crew.promoInfo().stamps, 2);

  const solo = atReport({ stamps: 3, cash: 10000 }).crew;
  assert.equal(solo.promoInfo().fee, 2500, 'solo pays the catalogue fee');
  assert.equal(solo.promoInfo().next, VENUE_RULES[1].name);
});

test('promoInfo is null at the Orbital Range and in endless mode', () => {
  assert.equal(makeCrew({ venue: 5 }).crew.promoInfo(), null);
  assert.equal(makeCrew({ venue: 5, endless: true }).crew.promoInfo(), null);
  assert.equal(makeCrew({ venue: 5 }).crew.snapshot().promo, null);
  assert.ok(makeCrew({ venue: 4 }).crew.promoInfo(), 'there is still the Orbital Range to go');
});

test('sign works only in the report phase, and only when the crew is ready', () => {
  const m = makeCrew({ day: 1, stamps: 3, cash: 10000 }, 600);
  const a = addPlayer(m.crew, 'A');
  openShift(m.crew);
  assert.equal(m.crew.sign(a, true), false, 'mid-shift');
  act(m.crew, a, { t: 'sign', on: true });
  assert.equal(m.crew.venue, 0);
  assert.deepEqual(m.crew.promoInfo().signed, []);

  const r = atReport({ stamps: 2, cash: 10000 });
  assert.equal(r.crew.sign(r.ps[0], true), false, 'two stamps is not enough');
  const r2 = atReport({ stamps: 3, cash: 100 });
  assert.equal(r2.crew.sign(r2.ps[0], true), false, 'nor is a short wallet');
  assert.equal(r2.crew.venue, 0);
  assert.equal(r2.crew.cash, 100);
});

test('every online Rat must sign; unsigning withdraws; an offline Rat does not block', () => {
  const { crew, ps: [a, b, c] } = atReport({ stamps: 3, cash: 10000 }, ['A', 'B', 'C']);
  const off = crew.join('Ghost');          // joined, never connected
  assert.equal(off.online, 0);

  act(crew, a, { t: 'sign', on: true });
  let ev = events(crew).find(e => e.t === 'sign');
  assert.deepEqual({ by: ev.by, on: ev.on, n: ev.n, of: ev.of }, { by: a.id, on: true, n: 1, of: 3 });
  assert.deepEqual(crew.promoInfo().signed, [a.id]);
  assert.equal(crew.snapshot().players.find(p => p.id === a.id).signed, true);
  assert.equal(crew.snapshot().players.find(p => p.id === b.id).signed, false);

  act(crew, b, { t: 'sign', on: true });
  act(crew, a, { t: 'sign', on: false });
  assert.deepEqual(crew.promoInfo().signed, [b.id], 'A unsigned');
  assert.equal(crew.venue, 0);
  act(crew, a, { t: 'sign', on: true });
  assert.equal(crew.venue, 0, 'C has not signed');
  act(crew, c, { t: 'sign', on: true });
  assert.equal(crew.venue, 1, 'all three online Rats signed: the ghost did not matter');
  assert.deepEqual([...crew.signed], [], 'signatures are spent');
});

test('a Rat who drops offline after signing does not block the others', () => {
  const { crew, ps: [a, b] } = atReport({ stamps: 3, cash: 10000 }, ['A', 'B']);
  act(crew, b, { t: 'sign', on: true });
  crew.disconnect(b);
  assert.equal(crew.venue, 0);
  act(crew, a, { t: 'sign', on: true });
  assert.equal(crew.venue, 1, 'solo online now');
});

test('promote(): fee, stamps, venue, write-off, reveal flag, shed, event, save', () => {
  const { crew, ps: [a] } = atReport({ stamps: 3, cash: 3000 });
  assert.equal(crew.outstanding, BALLS_OUTSTANDING);
  crew.flush();
  assert.equal(crew.promote(), true);
  assert.equal(crew.cash, 500, 'minus the $2,500 fee');
  assert.equal(crew.stamps, 0);
  assert.equal(crew.totals.stamps, 3, 'lifetime stamps are kept');
  assert.equal(crew.venue, 1);
  assert.equal(crew.venueDay, 0);
  assert.equal(crew.outstanding, BALLS_OUTSTANDING - 1_200_000_000, 'the Club writes off 1.2 billion');
  assert.equal(crew.pendingReveal, 1);
  assert.equal(crew.up.shed, 1, 'the members expect fries: the shed is granted');
  assert.equal(crew.perks.shed, 1);
  assert.equal(crew.title(), VENUE_RULES[1].title);
  const ev = events(crew).find(e => e.t === 'promoted');
  assert.ok(ev);
  assert.equal(ev.venue, 1); assert.equal(ev.fee, 2500); assert.equal(ev.writeOff, 1_200_000_000);

  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.equal(save.venue, 1);
  assert.equal(save.pendingReveal, 1);
  assert.equal(save.outstanding, BALLS_OUTSTANDING - 1_200_000_000);
  assert.equal(save.totals.stamps, 3);
  assert.equal(save.up.shed, 1);
  assert.equal(a.name, 'A');
});

test('promote() keeps a better shed, refuses when not ready, and does nothing twice', () => {
  const { crew } = atReport({ stamps: 3, cash: 9000, up: { shed: 3 } });
  assert.equal(crew.promote(), true);
  assert.equal(crew.up.shed, 3, 'a conveyor stays a conveyor');
  assert.equal(crew.promote(), false, 'stamps are spent');
  assert.equal(crew.venue, 1);
  const poor = atReport({ stamps: 3, cash: 10 }).crew;
  assert.equal(poor.promote(), false);
  assert.equal(poor.venue, 0);
  assert.equal(poor.stamps, 3);
});

test('write-offs: each venue takes its bite, never below one year, and Orbital sets 1958 exactly', () => {
  const expect = [[0, 1_200_000_000], [1, 1_500_000_000], [2, 800_000_000], [3, 712_000_000]];
  for (const [venue, off] of expect) {
    const { crew } = atReport({ venue, stamps: 3, cash: 1e9, outstanding: 4_000_000_000 });
    assert.equal(crew.promote(), true, 'venue ' + venue);
    assert.equal(crew.outstanding, 4_000_000_000 - off, 'venue ' + venue);
  }
  const small = atReport({ stamps: 3, cash: 1e9, outstanding: 1000 }).crew;
  small.promote();
  assert.equal(small.outstanding, ONE_YEAR + 1, 'a write-off bigger than what is left stops just above the Orbital floor');
  const orbit = atReport({ venue: 4, stamps: 3, cash: 1e9, outstanding: 123_456_789 }).crew;
  assert.equal(orbit.promote(), true);
  assert.equal(orbit.venue, 5);
  assert.equal(orbit.outstanding, ONE_YEAR, 'whatever was left, 1,958 remain');
  assert.equal(ONE_YEAR, 1958);
});

test('the morning after: reveal + the venue PA line, and the clock is held for 6 s', () => {
  const { crew, run, ps: [a] } = atReport({ stamps: 3, cash: 5000 });
  act(crew, a, { t: 'sign', on: true });
  assert.equal(crew.venue, 1);
  crew.flush();
  act(crew, a, { t: 'start' });                       // solo: ready, so the shift starts at once
  assert.equal(crew.phase, 'shift');
  const ev = events(crew);
  const reveal = ev.find(e => e.t === 'reveal');
  assert.ok(reveal, 'a reveal event');
  assert.equal(reveal.venue, 1);
  assert.equal(reveal.memo, VENUE_RULES[1].memo);
  assert.equal(reveal.title, VENUE_RULES[1].title);
  assert.ok(ev.find(e => e.t === 'pa' && e.id === 'club'), 'the Club line');
  assert.equal(crew.pendingReveal, 0);
  assert.equal(crew.revealT, 6);
  assert.equal(crew.snapshot().revealT, 6);
  assert.equal(crew.venueDay, 1);
  assert.equal(crew.paused(), true);

  for (const m of crew.mats) m.next = 0.1;             // customers are itching to swing
  run(5.5);
  assert.equal(crew.shiftT, 0, 'the clock does not advance during the reveal');
  assert.equal(events(crew).filter(e => e.t === 'spawn').length, 0, 'no customer swings either');
  run(1.5);
  assert.equal(crew.revealT, 0);
  assert.ok(crew.shiftT > 0.4 && crew.shiftT < 1.1, `the shift is running again: ${crew.shiftT}`);
  assert.ok(events(crew).filter(e => e.t === 'spawn').length > 0, 'customers resume');
});

test('no reveal without a promotion, and a pending reveal survives a save', () => {
  const m = makeCrew({ day: 2 });
  m.crew.startShift();
  assert.equal(events(m.crew).filter(e => e.t === 'reveal').length, 0);
  assert.equal(m.crew.revealT, 0);

  const { crew } = atReport({ stamps: 3, cash: 5000 });
  crew.promote();
  const back = makeCrew(JSON.parse(JSON.stringify(crew.toSave()))).crew;
  assert.equal(back.pendingReveal, 1);
  assert.equal(back.venue, 1);
  back.startShift();
  assert.equal(events(back).filter(e => e.t === 'reveal').length, 1);
  assert.equal(back.revealT, 6);
});

test('every later venue has its reveal line', () => {
  for (const v of [2, 3, 4, 5]) {
    const { crew } = makeCrew({ venue: v, pendingReveal: v, day: 9 });
    crew.startShift();
    const ev = events(crew);
    assert.ok(ev.find(e => e.t === 'reveal' && e.venue === v), 'reveal ' + v);
    assert.ok(ev.find(e => e.t === 'pa' && e.id === VENUE_RULES[v].pa), 'pa ' + VENUE_RULES[v].pa);
  }
});

test('at the Club: Rate is x5, and it multiplies with the washer', () => {
  assert.equal(makeCrew().crew.valueNow().rate, 1);
  assert.equal(makeCrew({ venue: 1 }).crew.valueNow().rate, 5);
  assert.equal(makeCrew({ venue: 1, up: { washer: 2 } }).crew.valueNow().rate, 15);
  assert.equal(VENUES[1].rate, 5);
});

// A customer swing, forced: mat 0 fires on the next tick.
const swing = crew => { crew.mats[0].next = 0; crew.tick(0.05); };

test('fries are eaten every 8 swings at the Muni and every 5 at the Club', () => {
  const eaten = (venue, swings) => {
    const { crew } = makeCrew({ venue, up: { shed: 1 }, fries: 20 }, 100000);
    openShift(crew);
    const stock = [];
    for (let i = 0; i < swings; i++) { swing(crew); stock.push(crew.fries); }
    return stock;
  };
  const muni = eaten(0, 17);
  assert.equal(muni[6], 20, '7 swings: nothing yet');
  assert.equal(muni[7], 19, 'the 8th swing');
  assert.equal(muni[14], 19);
  assert.equal(muni[15], 18, 'then 8 more');
  assert.equal(VENUE_RULES[0].eatEvery, undefined, 'the Muni uses FRIES.EAT_EVERY');
  assert.equal(FRIES.EAT_EVERY, 8);

  const club = eaten(1, 14);
  assert.equal(club[7], 19, 'the first basket still goes at swing 8 (the counter was already running)');
  assert.equal(club[11], 19);
  assert.equal(club[12], 18, 'then every 5');
  assert.equal(VENUE_RULES[1].eatEvery, 5);
});

test('Gary adds a kitchen stop at the Club, and it passes with fries at 50% or more', () => {
  const muni = makeCrew().crew, club = makeCrew({ venue: 1 }).crew;
  assert.deepEqual(muni.garyStops().map(s => s.id), ['sign', 'mats', 'cart', 'stand']);
  assert.deepEqual(club.garyStops().map(s => s.id), ['sign', 'mats', 'cart', 'kitchen', 'stand']);
  const k = club.garyStops().find(s => s.id === 'kitchen');
  assert.equal(k.x, FRIES.SHED.x);
  club.fries = FRIES.MAX * 0.5;
  assert.equal(club.inspect('kitchen'), true);
  club.fries = FRIES.MAX * 0.5 - 1;
  assert.equal(club.inspect('kitchen'), false);
  club.fries = FRIES.MAX;
  assert.equal(club.inspect('kitchen'), true);
});

test('Gary visits the kitchen on his round and a thin fryer counts as a fail', () => {
  const { crew, run } = makeCrew({ venue: 1, day: 4, up: { shed: 1 }, fries: 4, voiced: ['welcome'] }, 600);
  openShift(crew);
  run(0.1);                      // the reveal flag is not set (no promotion), so the clock runs
  crew.shiftT = 600 * 0.43;
  run(160);
  const ev = events(crew);
  const checks = ev.filter(e => e.t === 'check');
  assert.deepEqual(checks.map(c => c.stop), ['sign', 'mats', 'kitchen', 'stand'], 'no cart, so no cart stop');
  assert.equal(checks.find(c => c.stop === 'kitchen').ok, false);
  const verdict = ev.find(e => e.t === 'verdict');
  assert.ok(verdict);
  assert.equal(verdict.fails, 1, 'only the kitchen failed');
  assert.ok(verdict.gained >= 1, 'one fail is still a commendation');
});

test('amenities: the turbo nozzle reaches further, covered bays skip the morning mud and halve scuffs', () => {
  const reachAt = up => {
    const { crew } = makeCrew({ up, venue: 1 });
    openShift(crew);
    const a = addPlayer(crew, 'A', ST.x, ST.z);
    assert.equal(act(crew, a, { t: 'wand' }).denied.length, 0);
    assert.equal(a.wand, true);
    const o = { x: ST.x + 9.5, z: ST.z };
    crew.fixtures.mat0 = 0.9;
    // a mat 9.5 m away (the mat's own radius is added to the reach)
    const f = { x: o.x, z: o.z };
    crew.cart = null;
    return Math.hypot(f.x - a.x, f.z - a.z) <= 7 * (crew.perks.turbo ? 9 / 7 : 1) + 1.5;
  };
  assert.equal(reachAt({}), false);
  assert.equal(reachAt({ amen: 1 }), true);

  const bare = makeCrew({ day: 2 }).crew; bare.startShift();
  const mats = c => Object.entries(c.fixtures).filter(([k]) => k.startsWith('mat')).map(([, v]) => v);
  assert.ok(mats(bare).some(v => v > 0.5), 'the morning mud is on the mats');
  const covered = makeCrew({ day: 2, venue: 1, up: { amen: 2 } }).crew; covered.startShift();
  assert.ok(mats(covered).every(v => v === 0), 'covered bays: the members never see a muddy mat');
  assert.ok(covered.fixtures.sign > 0.5, 'the sign still gets dusty');

  const scuff = up => { const { crew } = makeCrew({ venue: 1, up }, 100000); openShift(crew); swing(crew); return crew.fixtures.mat0; };
  near(scuff({}), 0.006);
  near(scuff({ amen: 2 }), 0.003);
});

// ---- the quota is judged on Upkeep -------------------------------------------------------

test('a mid-shift purchase cannot buy the quota (judged on Upkeep, not dollars)', () => {
  const { crew, run } = makeCrew({ day: 2 }, 5);
  openShift(crew, 1);                                  // filthy: Upkeep 1.0 against a 1.3 ask
  crew.bank(10, 'x');
  crew.cash = 1000;
  const a = addPlayer(crew, 'A');
  act(crew, a, { t: 'buy', id: 'washer' });            // Rate 1 -> 2: BV doubles, Upkeep does not
  assert.equal(crew.valueNow().bv, 2);
  assert.equal(crew.quotaTarget(), 2.6, 'the line moved with the Rate');
  run(6);
  assert.equal(crew.report.quota.hit, false);
  assert.equal(crew.report.quota.bv, 2);
  assert.equal(crew.report.quota.target, 2.6);
  assert.equal(crew.stamps, 0);
});

test('hit = deposited > 0 and bv / rate >= 1 + q', () => {
  const { crew, run } = makeCrew({ day: 2, up: { washer: 1 } }, 5);
  openShift(crew, 0);                                  // Upkeep 1.5 vs 1.3, at Rate 2
  crew.bank(1, 'x');
  run(6);
  assert.equal(crew.report.quota.hit, true);
  assert.equal(crew.report.quota.target, 2.6);
  assert.equal(crew.report.quota.bv, 3);
});

test('the Club quota: q = (ceiling - 1) x venueQuotaF(venueDay)', () => {
  const f = [1, 2, 3, 4, 5, 6, 7, 8, 50].map(venueQuotaF);
  for (let i = 1; i < 8; i++) assert.ok(f[i] >= f[i - 1], 'never falls as days pass');
  assert.ok(f[0] > 0 && f[0] < f[4], 'starts below where it ends up');
  near(f[5] - f[4], 0.025, 0.0251);
  assert.equal(f[8], Math.max(...f), 'capped');
  assert.ok(f[8] <= 0.8);

  const { crew } = makeCrew({ venue: 1, venueDay: 0, up: { shed: 1 }, day: 1 });
  assert.equal(crew.ceiling(), 2.5, 'Curb + Pond + Fries');
  assert.equal(upkeepCeiling({ pond: 1, fries: 1 }), 2.5);
  crew.startShift();
  near(crew.quota.q, 1.5 * venueQuotaF(1));             // day 1 at the venue
  assert.equal(crew.venueDay, 1);
  near(crew.quotaTarget(), 5 * (1 + 1.5 * venueQuotaF(1)), 0.011);
  const memo = events(crew).find(e => e.t === 'memo');
  near(memo.target, crew.quotaTarget(), 1e-9);

  const d3 = makeCrew({ venue: 1, venueDay: 2, stamps: 2, up: { shed: 1 }, day: 4 }).crew;
  d3.startShift();
  assert.equal(d3.venueDay, 3);
  near(d3.quota.q, 1.5 * venueQuotaF(3));

  // A crew that keeps missing is not pushed out of reach (playtest): day 6 with one stamp gets the 2-stamp target.
  const behind = makeCrew({ venue: 1, venueDay: 5, stamps: 1, up: { shed: 1 }, day: 8 }).crew;
  behind.startShift();
  near(behind.quota.q, 1.5 * venueQuotaF(2));
  const done = makeCrew({ venue: 1, venueDay: 5, stamps: 3, up: { shed: 1 }, day: 8 }).crew;
  done.startShift();
  near(done.quota.q, 1.5 * venueQuotaF(6), 1e-9);
});

test('the Muni quota is unchanged by venues: quotaQ(day, ceiling)', () => {
  const c = makeCrew({ day: 3 }).crew; c.startShift();
  assert.deepEqual(c.quota, { q: 0.3 });     // round 6 #1: the 0.3 floor
});

test('at the Club: a tidy crew hits the quota, a muddy one misses', () => {
  const tidy = makeCrew({ venue: 1, up: { shed: 1 }, fries: 20, day: 1 }, 5);
  openShift(tidy.crew, 0);
  tidy.crew.bank(10, 'x');
  tidy.run(6);
  assert.equal(tidy.crew.report.quota.hit, true, 'Upkeep 2.5 vs the ask');
  assert.equal(tidy.crew.stamps, 1);
  near(tidy.crew.report.quota.target, 5 * (1 + 1.5 * venueQuotaF(1)), 0.011);

  const messy = makeCrew({ venue: 1, up: { shed: 1 }, fries: 0, day: 1 }, 5);
  openShift(messy.crew, 1);
  messy.crew.bank(10, 'x');
  messy.run(6);
  assert.equal(messy.crew.report.quota.hit, false, 'Upkeep 1.5 is below the ask');
});

// ---- Ready Up --------------------------------------------------------------------------------

test('Ready Up: opening the range from the lobby is instant', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A'); addPlayer(crew, 'B');
  assert.equal(crew.phase, 'lobby');
  act(crew, a, { t: 'start' });
  assert.equal(crew.phase, 'shift');
});

test('Ready Up: the next shift starts when everyone online is ready', () => {
  const { crew, ps: [a, b, c] } = atReport({}, ['A', 'B', 'C']);
  crew.join('Ghost');                                  // offline: does not count
  act(crew, a, { t: 'start' });
  let ev = events(crew).find(e => e.t === 'ready');
  assert.equal(ev.n, 1); assert.equal(ev.of, 3);
  assert.equal(crew.snapshot().players.find(p => p.id === a.id).ready, true);
  assert.equal(crew.phase, 'report');
  act(crew, b, { t: 'start' });
  assert.equal(crew.phase, 'report');
  act(crew, c, { t: 'start' });
  assert.equal(crew.phase, 'shift');
  assert.equal(crew.day, 2);
  assert.equal(crew.ready.size, 0, 'cleared for the next report');
});

test('Ready Up: 20 s after the first Rat is ready the shift starts anyway', () => {
  const { crew, run, ps: [a] } = atReport({}, ['A', 'B']);
  act(crew, a, { t: 'start' });
  act(crew, a, { t: 'start' });                        // pressing twice does not matter
  run(19);
  assert.equal(crew.phase, 'report', 'B is still reading');
  run(1.5);
  assert.equal(crew.phase, 'shift');
  assert.equal(crew.day, 2);
});

test('Ready Up: nobody ready, nobody is pushed', () => {
  const { crew, run } = atReport({}, ['A', 'B']);
  run(60);
  assert.equal(crew.phase, 'report');
});

test('Ready Up: pressing start mid-shift does nothing', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A');
  openShift(crew);
  const t = crew.shiftT, day = crew.day;
  act(crew, a, { t: 'start' });
  assert.equal(crew.phase, 'shift');
  assert.equal(crew.day, day);
  assert.equal(crew.shiftT, t);
});

// ---- the ball washer --------------------------------------------------------------------------

const washerCrew = (tier = 1, shiftSecs = 600, extra = {}) => {
  const m = makeCrew({ up: { washer: tier }, ...extra }, shiftSecs);
  openShift(m.crew);
  const a = addPlayer(m.crew, 'A', WASHER_HANDLES.L.x, WASHER_HANDLES.L.z);
  return { ...m, a };
};
const crank = (crew, p, side, turns) => crew.input(p, { a: [{ t: 'crank', side, turns }] });

test('the washer station geometry: a handle each side, reach 1.8 m', () => {
  assert.equal(WASHER.REACH, 1.8);
  assert.equal(WASHER.CRANK_MAX, 2.5);
  assert.ok(atHandle({ x: WASHER_HANDLES.L.x, z: WASHER_HANDLES.L.z }, 'L'));
  assert.ok(!atHandle({ x: WASHER_HANDLES.L.x, z: WASHER_HANDLES.L.z }, 'R'));
  assert.ok(!atHandle({ x: 30, z: 6 }, 'L'));
});

test('banking with a washer pays the muddy price now and parks the premium in the hopper', () => {
  const { crew } = washerCrew(1);
  crew.bank(10, 'x');                                  // BV 3 (Rate 2, Upkeep 1.5): $30 in all
  assert.equal(crew.cash, 15, 'muddy: full / price (2)');
  assert.equal(crew.hopper.n, 10);
  assert.equal(crew.hopper.credit, 15);
  assert.equal(crew.stats.cash, 15);
  assert.equal(crew.stats.deposited, 10);
  const ev = events(crew).find(e => e.t === 'cash');
  assert.equal(ev.cash, 15); assert.equal(ev.credit, 15); assert.equal(ev.n, 10);
});

test('no washer: pay in full, no hopper', () => {
  const { crew } = makeCrew();
  openShift(crew);
  crew.bank(10, 'x');
  assert.equal(crew.cash, 15);
  assert.deepEqual(crew.hopper, { n: 0, credit: 0, frac: 0 });
  assert.equal(events(crew).find(e => e.t === 'cash').credit, 0);
  assert.equal(crew.snapshot().washer, null);
});

test('the premium follows the carrier: grime and the cart gear decide the full price', () => {
  const { crew, a } = washerCrew(1);
  a.grime = 0;
  crew.bank(4, a.id, null, 4);                         // 4 x 3 x 1.25 = 15, muddy 7.5
  assert.equal(crew.cash, 7.5);
  assert.equal(crew.hopper.credit, 7.5);
  crew.bank(4, 'h0', 'helper', 4);                     // helpers are x1: 12, muddy 6
  assert.equal(crew.cash, 13.5);
  assert.equal(crew.hopper.credit, 13.5);
});

test('washBalls pays credit x washed / n and shrinks both', () => {
  const { crew, a } = washerCrew(1);
  crew.bank(10, 'x');
  assert.equal(crew.washBalls(4, a.id), 4);
  assert.equal(crew.cash, 21, '15 + 15 x 4/10');
  assert.equal(crew.hopper.n, 6);
  assert.equal(crew.hopper.credit, 9);
  assert.equal(crew.stats.scrubbed, 4);
  assert.equal(a.shift.scrubbed, 4);
  assert.equal(crew.washBalls(50, a.id), 6, 'cannot wash more than the hopper holds');
  assert.equal(crew.cash, 30, 'the whole $30');
  assert.equal(crew.hopper.n, 0);
  assert.equal(crew.hopper.credit, 0);
  assert.equal(crew.washBalls(1, a.id), 0, 'nothing left to wash');
});

test('crank validation: tier, side, reach, turns, and a Rat who is down', () => {
  const { crew, a } = washerCrew(1);
  crew.bank(20, 'x');
  assert.equal(crew.crank(a, 'L', 0.5), true);
  assert.equal(crew.crank(a, 'R', 0.5), false, 'the right handle is 2.8 m away');
  assert.equal(crew.crank(a, 'X', 0.5), false, 'no such handle');
  assert.equal(crew.crank(a, undefined, 0.5), false);
  assert.equal(crew.crank(a, 'L', 0), false);
  assert.equal(crew.crank(a, 'L', -1), false);
  assert.equal(crew.crank(a, 'L', NaN), false);
  assert.equal(crew.crank(a, 'L', 'lots'), false);
  a.x = 30; a.z = 6;
  assert.equal(crew.crank(a, 'L', 0.5), false, 'out of reach');
  a.x = WASHER_HANDLES.R.x; a.z = WASHER_HANDLES.R.z;
  assert.equal(crew.crank(a, 'R', 0.5), true);
  a.down = 1;
  assert.equal(crew.crank(a, 'R', 0.5), false, 'flat on your back');
  a.down = 0;
  const none = washerCrew(0);
  assert.equal(none.crew.crank(none.a, 'L', 1), false, 'no washer bought');
});

test('crank: honest cranking at 2.5 turns a second washes a ball a turn', () => {
  const { crew, clock, a } = washerCrew(1);
  crew.bank(12, 'x');                                  // credit 18
  const before = crew.cash;
  for (let i = 0; i < 16; i++) { clock.t += 250; crank(crew, a, 'L', 0.625); }
  assert.equal(crew.hopper.n, 2, '10 turns, 10 balls');
  assert.equal(crew.cash - before, 15, '18 x 10/12');
  assert.equal(a.shift.scrubbed, 10);
});

test('crank: a greedy client is clamped to CRANK_MAX x dt (plus the little slack)', () => {
  const { crew, clock, a } = washerCrew(1);
  crew.bank(100, 'x');
  for (let i = 0; i < 16; i++) { clock.t += 250; crank(crew, a, 'L', 100); }   // 4 s of "100 turns"
  const washed = 100 - crew.hopper.n;
  assert.ok(washed >= 10, `an honest 4 s is worth 10 (got ${washed})`);
  assert.ok(washed <= WASHER.CRANK_MAX * 4 + 16 * 0.15 + 1e-9, `4 s of cranking washed ${washed} balls`);
});

test('crank: a client that floods the endpoint with no time passing washes nothing', () => {
  const { crew, clock, a } = washerCrew(1);
  crew.bank(100, 'x');
  clock.t += 250; crank(crew, a, 'L', 0.5);            // the legitimate first call
  const before = crew.hopper.n;
  for (let i = 0; i < 100; i++) crank(crew, a, 'L', 1);   // 100 messages in the same millisecond
  const washed = before - crew.hopper.n;
  assert.ok(washed <= 1, `REAL BUG: 100 crank messages in 0 ms washed ${washed} balls; the server is meant to clamp to CRANK_MAX x dt, and dt is 0 (each call gets the +0.15 slack)`);
});

test('crank: two Rats, one at each handle, add up', () => {
  const { crew, clock, a } = washerCrew(1);
  const b = addPlayer(crew, 'B', WASHER_HANDLES.R.x, WASHER_HANDLES.R.z);
  crew.bank(40, 'x');
  for (let i = 0; i < 8; i++) { clock.t += 250; crank(crew, a, 'L', 0.625); crank(crew, b, 'R', 0.625); }
  assert.equal(a.shift.scrubbed, 5);
  assert.equal(b.shift.scrubbed, 5);
  assert.equal(crew.hopper.n, 30, '5 each over 2 s: two handles, double the throughput');
});

test('snapshot.washer: the hopper, the auto rate, and who is cranking which handle', () => {
  assert.equal(makeCrew().crew.snapshot().washer, null);
  const { crew, clock, a } = washerCrew(1);
  const b = addPlayer(crew, 'B', WASHER_HANDLES.R.x, WASHER_HANDLES.R.z);
  crew.bank(10, 'x');
  let w = crew.snapshot().washer;
  assert.deepEqual(w, { n: 10, credit: 15, auto: 0, L: null, R: null, rateL: 0, rateR: 0 });
  clock.t += 250; crank(crew, a, 'L', 0.625);
  w = crew.snapshot().washer;
  assert.equal(w.L, a.id); assert.equal(w.R, null);
  near(w.rateL, 2.5, 0.01);
  clock.t += 250; crank(crew, b, 'R', 0.3);
  w = crew.snapshot().washer;
  assert.equal(w.R, b.id);
  assert.ok(w.rateR > 0 && w.rateR < w.rateL);
  clock.t += 500;
  w = crew.snapshot().washer;
  assert.equal(w.L, null, 'a handle nobody has turned for half a second is free');
  assert.equal(w.R, null);
  assert.equal(w.rateL, 0);
  assert.deepEqual([2, 3].map(t => washerCrew(t).crew.snapshot().washer.auto), [1, 5]);
});

test('washed events batch what each Rat cranked', () => {
  const { crew, clock, run, a } = washerCrew(1);
  crew.bank(10, 'x');
  for (let i = 0; i < 4; i++) { clock.t += 250; crank(crew, a, 'L', 0.625); }
  run(0.6);
  const ev = events(crew).filter(e => e.t === 'washed');
  assert.ok(ev.length >= 1);
  assert.equal(ev.reduce((n, e) => n + e.n, 0), 2, '2.5 turns: two whole balls');
  assert.equal(ev[0].by, a.id);
  assert.ok(ev[0].cash > 0);
  assert.equal(ev.at(-1).left, 8);
});

test('the electric washer cleans a ball a second on its own, and pays for each', () => {
  const { crew, run } = washerCrew(2);
  crew.bank(10, 'x');                                  // BV 4.5, $45: muddy 15, credit 30
  assert.equal(crew.cash, 15);
  run(5.5);
  assert.equal(crew.hopper.n, 5);
  assert.equal(crew.cash, 30, '15 + 30 x 5/10');
  const ev = events(crew).filter(e => e.t === 'washed');
  assert.ok(ev.length > 0 && ev.every(e => e.by === 'machine'));
  assert.equal(crew.stats.scrubbed, 5);
});

test('the industrial wash cleans five a second', () => {
  const { crew, run } = washerCrew(3, 600, { venue: 1 });
  crew.bank(40, 'x');
  const credit = crew.hopper.credit, before = crew.cash;
  run(2.5);
  const washed = 40 - crew.hopper.n;
  assert.ok(washed >= 11 && washed <= 13, `5 a second for 2.5 s (got ${washed})`);
  near(crew.cash - before, credit * washed / 40, 0.02);
});

test('the auto washer rests between shifts and with an empty hopper', () => {
  const { crew, run } = washerCrew(2, 5);
  run(6);
  assert.equal(crew.phase, 'report');
  crew.hopper = { n: 5, credit: 10, frac: 0 };
  const cash = crew.cash;
  run(3);
  assert.equal(crew.hopper.n, 5, 'the machine works shifts, not report screens');
  assert.equal(crew.cash, cash);
});

test('at the bell: half of what is left is washed at half pay, the rest is lost', () => {
  const { crew, run, a } = washerCrew(1, 5);
  crew.bank(10, 'x');
  crew.washBalls(2, a.id);                             // n 8, credit 12, cash 18
  assert.equal(crew.cash, 18);
  run(6);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.report.unwashed, 4);
  assert.equal(crew.report.lostPremium, 9, 'of $12 waiting, $3 was paid');
  assert.equal(crew.cash, 21, '18 + the night crew\'s $3');
  assert.equal(crew.report.cash, 21);
  assert.equal(crew.stats.unwashed, 4);
  assert.deepEqual(crew.hopper, { n: 0, credit: 0, frac: 0 });
  assert.equal(crew.totals.unwashed, 4);
  assert.equal(crew.totals.lostPremium, 9);
});

test('the bell split with an odd hopper rounds the washed half down', () => {
  const { crew } = washerCrew(1);
  crew.hopper = { n: 7, credit: 7, frac: 0 };
  crew.endShift();
  assert.equal(crew.report.unwashed, 4);
  assert.equal(crew.report.lostPremium, 5.25);
  assert.equal(crew.cash, 1.75);
});

test('an empty hopper at the bell reports nothing unwashed', () => {
  const { crew, run } = washerCrew(1, 5);
  run(6);
  assert.equal(crew.report.unwashed, 0);
  assert.equal(crew.report.lostPremium, 0);
});

test('a new shift starts with an empty hopper', () => {
  const { crew } = washerCrew(1);
  crew.hopper = { n: 9, credit: 9, frac: 0.5 };
  crew.phase = 'report';
  crew.startShift();
  assert.deepEqual(crew.hopper, { n: 0, credit: 0, frac: 0 });
});

test('cart and helper loads go through the hopper too', () => {
  const { crew, run } = makeCrew({ up: { washer: 1, cart: 1 } }, 600);
  openShift(crew);
  crew.cart.load = 4; crew.cart.loadW = 4; crew.cart.mud = 0;
  crew.cart.x = STAND.x + 2; crew.cart.z = STAND.z + 2;
  run(0.25);
  assert.equal(crew.hopper.n, 4);
  assert.equal(crew.cash, 7.5, '4 x 3 x 1.25 = 15, half now');
  assert.equal(crew.hopper.credit, 7.5);
});

// ---- gear grime ------------------------------------------------------------------------------

test('grime resets to 0 at the start of every shift', () => {
  const { crew } = makeCrew({ day: 2 }, 5);
  const a = addPlayer(crew, 'A');
  a.grime = 3;
  crew.startShift();
  assert.equal(a.grime, 0);
});

test('a knockdown adds a layer of grime, capped at 3, with a grime event', () => {
  const { crew } = makeCrew();
  openShift(crew);
  const a = addPlayer(crew, 'A', 0, 0);
  for (let i = 1; i <= 5; i++) { a.down = 0; crew.knockDown(a); assert.equal(a.grime, Math.min(i, 3)); }
  const ev = events(crew).filter(e => e.t === 'grime');
  assert.deepEqual(ev.map(e => e.v), [1, 2, 3], 'no event when nothing changed');
  assert.equal(crew.snapshot().players[0].grime, 3);
  const h = makeCrew({ up: { helpers: 1 } }).crew;
  openShift(h);
  h.knockDown(h.helpers[0]);
  assert.equal(h.helpers[0].grime, undefined, 'helpers do not get dirty');
});

test('picking up balls never adds grime: only knockdowns do (council round 3)', () => {
  const { crew } = makeCrew();
  openShift(crew);
  const a = addPlayer(crew, 'A', 30, 30);
  for (let i = 0; i < 60; i++) { a.pocket = 0; act(crew, a, { t: 'pickup', ball: restingBall(crew, a.x, a.z).id }); }
  assert.equal(a.grime, 0);
});

test('pay reflects grime on a Rat\'s own deposits; helpers stay x1', () => {
  const pay = grime => {
    const { crew } = makeCrew();
    openShift(crew);
    const a = addPlayer(crew, 'A', STAND.x, STAND.z);
    a.grime = grime; a.pocket = 1; a.pocketW = 1;
    act(crew, a, { t: 'deposit' });
    return { cash: crew.cash, ev: events(crew).find(e => e.t === 'cash') };
  };
  assert.equal(pay(0).cash, 1.88, 'BV 1.5 x 1.25 = 1.875');
  assert.equal(pay(1).cash, 1.75);
  assert.equal(pay(2).cash, 1.63);
  assert.equal(pay(3).cash, 1.5);
  assert.equal(pay(0).ev.clean, true);
  assert.equal(pay(2).ev.clean, false);
  const { crew } = makeCrew();
  openShift(crew);
  crew.bank(2, 'h0', 'helper', 2);
  assert.equal(crew.cash, 3);
  assert.equal(events(crew).find(e => e.t === 'cash').clean, undefined);
});

test('Hose a Friend: a layer per 0.5 s on target, a shove away from the sprayer, a hosed event', () => {
  const { crew, clock } = makeCrew();
  openShift(crew);
  const a = addPlayer(crew, 'A', ST.x, ST.z), b = addPlayer(crew, 'B', ST.x + 4, ST.z);
  b.grime = 3;
  assert.equal(act(crew, a, { t: 'wand' }).denied.length, 0);
  assert.equal(a.wand, true);
  crew.flush();
  for (let i = 0; i < 3; i++) {
    clock.t += 500;
    assert.equal(crew.wash(a, 0.5, 'p:' + b.id), true);
    assert.equal(b.grime, 2 - i, `layer ${i + 1}`);
  }
  const ev = events(crew);
  assert.deepEqual(ev.filter(e => e.t === 'grime').map(e => e.v), [2, 1, 0]);
  const hosed = ev.filter(e => e.t === 'hosed');
  assert.equal(hosed.length, 3);
  assert.equal(hosed[0].id, b.id); assert.equal(hosed[0].by, a.id);
  near(hosed[0].dx, 0.5); near(hosed[0].dz, 0, 1e-9);
  assert.equal(a.shift.hosed, 3);
  clock.t += 500; crew.wash(a, 0.5, 'p:' + b.id);
  assert.equal(a.shift.hosed, 3, 'a clean friend earns nothing');
  assert.equal(b.grime, 0);
});

test('Hose a Friend: short bursts add up, and the rules hold', () => {
  const { crew, clock } = makeCrew();
  openShift(crew);
  const a = addPlayer(crew, 'A', ST.x, ST.z), b = addPlayer(crew, 'B', ST.x + 4, ST.z);
  b.grime = 2;
  assert.equal(crew.wash(a, 0.3, 'p:' + b.id), false, 'no wand yet');
  act(crew, a, { t: 'wand' });
  clock.t += 200; crew.wash(a, 0.2, 'p:' + b.id);
  assert.equal(b.grime, 2, '0.2 s is not a layer');
  clock.t += 200; crew.wash(a, 0.2, 'p:' + b.id);
  assert.equal(b.grime, 2);
  clock.t += 200; crew.wash(a, 0.2, 'p:' + b.id);
  assert.equal(b.grime, 1, '0.6 s of spray');
  assert.equal(crew.wash(a, 0.5, 'p:' + a.id), false, 'you cannot hose yourself');
  assert.equal(crew.wash(a, 0.5, 'p:nobody'), false);
  b.x = ST.x + 12;
  clock.t += 500;
  assert.equal(crew.wash(a, 0.5, 'p:' + b.id), false, 'out of range');
  assert.equal(b.grime, 1);
});

test('the turbo nozzle stretches the hose to 9 m', () => {
  const hosedAt = (up, d) => {
    const { crew, clock } = makeCrew({ venue: 1, up });
    openShift(crew);
    const a = addPlayer(crew, 'A', ST.x, ST.z), b = addPlayer(crew, 'B', ST.x + d, ST.z);
    b.grime = 1;
    act(crew, a, { t: 'wand' });
    clock.t += 500;
    return crew.wash(a, 0.5, 'p:' + b.id);
  };
  assert.equal(hosedAt({}, 9), false);
  assert.equal(hosedAt({ amen: 1 }, 9), true);
  assert.equal(hosedAt({}, 8), true, 'within the standard 7 m + 1.5');
});

test('the wand on yourself (look down): a layer per 1.5 s; the spigot is gone', () => {
  const { crew, clock } = makeCrew();
  openShift(crew);
  const a = addPlayer(crew, 'A', ST.x, ST.z);
  a.grime = 2;
  clock.t += 500;
  assert.equal(crew.wash(a, 0.5, 'self'), false, 'no wand, no hose');
  act(crew, a, { t: 'wand' });
  const hose = () => { clock.t += 500; return crew.wash(a, 0.5, 'self'); };
  hose(); hose();
  assert.equal(a.grime, 2, '1 s');
  hose();
  assert.equal(a.grime, 1, '1.5 s');
  hose(); hose(); hose();
  assert.equal(a.grime, 0, '3 s in all');
  assert.equal(hose(), false, 'nothing left to hose');
  assert.equal(typeof crew.rinse, 'undefined', 'the spigot was merged into the wand');
});

// ---- the New Hire Kit --------------------------------------------------------------------------

test('New Hire Kit: a new name after day 1 gets a tube and a kit event', () => {
  const { crew } = makeCrew({ day: 2 });
  const p = crew.join('Newbie');
  assert.equal(p.gear, 1);
  assert.equal(crew.gearByName.Newbie, 1, 'recorded at once');
  const kit = events(crew).find(e => e.t === 'kit');
  assert.deepEqual({ id: kit.id, level: kit.level }, { id: p.id, level: 1 });
  assert.equal(crew.toSave().gear.Newbie, 1);
});

test('New Hire Kit: at the Club it is a range bucket', () => {
  const { crew } = makeCrew({ day: 5, venue: 1 });
  const p = crew.join('Newbie');
  assert.equal(p.gear, 2);
  assert.equal(events(crew).find(e => e.t === 'kit').level, 2);
});

test('New Hire Kit: day 1 gets nothing, and a known name keeps its gear', () => {
  const day1 = makeCrew().crew;
  assert.equal(day1.join('Early').gear, 0);
  assert.equal(events(day1).filter(e => e.t === 'kit').length, 0);

  const { crew } = makeCrew({ day: 6, gear: { Vet: 3 } });
  assert.equal(crew.join('Vet').gear, 3, 'a known Rat is not a new hire');
  assert.equal(events(crew).filter(e => e.t === 'kit').length, 0);

  const b = crew.join('Fresh');
  crew.removePlayer(b);
  crew.flush();
  assert.equal(crew.join('Fresh').gear, 1, 'rejoining under the same name keeps the kit');
  assert.equal(events(crew).filter(e => e.t === 'kit').length, 0, 'no second kit');
  crew.gearByName.Fresh = 3;
  assert.equal(crew.join('Fresh').gear, 3);
});

// ---- the Corporate PA --------------------------------------------------------------------------

const paIds = crew => events(crew).filter(e => e.t === 'pa').map(e => e.id);

test('PA: a once line plays once and is remembered', () => {
  const { crew, clock } = makeCrew();
  assert.equal(crew.pa('cart', { once: true }), true);
  assert.deepEqual(paIds(crew), ['cart']);
  assert.ok(crew.voiced.has('cart'));
  clock.t += 60_000;
  assert.equal(crew.pa('cart', { once: true }), false);
  assert.deepEqual(paIds(crew), []);
});

test('PA: at most 3 ordinary lines a shift, 20 s apart; the next shift resets the count', () => {
  const { crew, clock } = makeCrew({ day: 2, voiced: ['welcome'] });
  crew.startShift();
  clock.t += 25_000;
  crew.flush();
  assert.equal(crew.pa('record'), true);
  assert.equal(crew.pa('jackpot'), false, 'inside the 20 s gap: dropped, not queued');
  clock.t += 19_000;
  assert.equal(crew.pa('jackpot'), false);
  clock.t += 2_000;
  assert.equal(crew.pa('jackpot'), true);
  clock.t += 21_000;
  assert.equal(crew.pa('huddle'), true);
  clock.t += 21_000;
  assert.equal(crew.pa('record'), false, 'a fourth in one shift');
  assert.deepEqual(paIds(crew), ['record', 'jackpot', 'huddle']);
  crew.phase = 'report'; crew.startShift();
  crew.flush();
  clock.t += 21_000;
  assert.equal(crew.pa('record'), true, 'a new shift, a new allowance');
});

test('PA: big lines (venue reveals, one, last, endless) bypass the cap and the gap', () => {
  const { crew } = makeCrew({ day: 2, voiced: ['welcome'] });
  crew.startShift();
  crew.flush();
  assert.equal(crew.pa('record'), true);
  for (const id of ['club', 'tiered', 'stadium', 'county', 'orbital', 'one', 'last', 'endless']) {
    assert.equal(crew.pa(id), true, id);
  }
  assert.equal(crew.paShift, 1, 'big lines do not count');
  assert.equal(crew.pa('jackpot'), false, 'the ordinary gap still applies from the record line');
  assert.equal(paIds(crew).length, 9);
});

test('PA: a repeatable line with a chance is thinned after its first time', () => {
  const { crew, clock } = makeCrew();
  crew.rng = () => 0.9;
  assert.equal(crew.pa('huddle', { chance: 1 / 3 }), true, 'the first time always plays');
  clock.t += 30_000;
  assert.equal(crew.pa('huddle', { chance: 1 / 3 }), false, 'then 1 in 3');
  crew.rng = () => 0.1;
  assert.equal(crew.pa('huddle', { chance: 1 / 3 }), true);
});

test('PA: the first shift ever welcomes the crew, once; voiced is saved and restored', () => {
  const { crew } = makeCrew();
  crew.startShift();
  assert.deepEqual(paIds(crew), ['welcome']);
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.ok(save.voiced.includes('welcome'));
  const { crew: back } = makeCrew(save);
  assert.ok(back.voiced.has('welcome'));
  back.startShift();
  assert.deepEqual(paIds(back), [], 'the welcome is once per crew, ever');
  assert.deepEqual(makeCrew({ voiced: 'junk' }).crew.toSave().voiced, []);
  assert.deepEqual(makeCrew({ voiced: [1, 'ok', null] }).crew.toSave().voiced, ['ok']);
});

test('PA: debut lines fire with the debut, once', () => {
  const { crew } = makeCrew({ day: 3, voiced: ['welcome'] });
  openShift(crew);
  crew.rng = () => 0.001;                              // pickKind: a gold ball
  swing(crew);
  let ev = events(crew);
  assert.ok(ev.find(e => e.t === 'debut' && e.kind === 'gold'));
  assert.ok(ev.find(e => e.t === 'pa' && e.id === 'gold'), 'the gold line');
  crew.mats[0].next = 0; crew.tick(0.05);
  ev = events(crew);
  assert.equal(ev.filter(e => e.t === 'debut').length, 0);
  assert.equal(ev.filter(e => e.t === 'pa').length, 0);
});

test('PA: the glow line plays at the first Last Call', () => {
  const { crew } = makeCrew({ day: 2, voiced: ['welcome'] }, 600);
  openShift(crew);
  crew.shiftT = 560;
  swing(crew);
  const ev = events(crew);
  assert.ok(ev.find(e => e.t === 'debut' && e.kind === 'glow'));
  assert.ok(ev.find(e => e.t === 'pa' && e.id === 'glow'));
});

test('PA: the first cart purchase speaks, once', () => {
  const { crew } = makeCrew({ voiced: ['welcome'], day: 3 });
  openShift(crew);
  crew.cash = 5000;
  const a = addPlayer(crew, 'A');
  act(crew, a, { t: 'buy', id: 'cart' });
  assert.deepEqual(paIds(crew), ['cart']);
  act(crew, a, { t: 'buy', id: 'cart' });              // the wide reels
  assert.deepEqual(paIds(crew), []);
});

test('PA: Gary\'s first warning speaks once', () => {
  const { crew, run } = makeCrew({ day: 4, voiced: ['welcome'] }, 600);
  openShift(crew);
  crew.shiftT = 600 * 0.43;
  run(0.1);
  const ev = events(crew);
  assert.ok(ev.find(e => e.t === 'gary' && e.phase === 'warn'));
  assert.ok(ev.find(e => e.t === 'pa' && e.id === 'gary'));
  assert.ok(crew.voiced.has('gary'));
});

test('PA: the CCTV line plays the first time anyone opens the monitors at the Club', () => {
  const muni = makeCrew({ voiced: ['welcome'] }).crew;
  openShift(muni);
  act(muni, addPlayer(muni, 'A'), { t: 'cctv' });
  assert.deepEqual(paIds(muni), [], 'no cameras at the Muni');
  const { crew } = makeCrew({ venue: 1, voiced: ['welcome'] });
  openShift(crew);
  const a = addPlayer(crew, 'A');
  act(crew, a, { t: 'cctv' });
  assert.deepEqual(paIds(crew), ['cctv']);
  act(crew, a, { t: 'cctv' });
  assert.deepEqual(paIds(crew), []);
});

// ---- the ledger and awards -----------------------------------------------------------------------

function ledgerCrew(n, stats = []) {
  const m = makeCrew({ day: 1 }, 5);
  const ps = Array.from({ length: n }, (_, i) => addPlayer(m.crew, 'R' + i, 20 + i, 5));
  openShift(m.crew);
  stats.forEach((s, i) => Object.assign(ps[i].shift, s));
  m.run(6);
  assert.equal(m.crew.phase, 'report');
  return { ...m, ps, ledger: m.crew.report.ledger };
}

test('ledger: one entry per online Rat, with the shift stats and an award', () => {
  const m = makeCrew({ day: 1 }, 5);
  const a = addPlayer(m.crew, 'A', STAND.x, STAND.z), b = addPlayer(m.crew, 'B');
  m.crew.join('Ghost');                                // offline: not in the ledger
  openShift(m.crew);
  a.x = STAND.x; a.z = STAND.z;   // clocked in at the yard; walk to the stand
  a.pocket = 4; a.pocketW = 4;
  act(m.crew, a, { t: 'deposit' });
  m.crew.knockDown(b);
  m.run(6);
  const l = m.crew.report.ledger;
  assert.equal(l.length, 2);
  const la = l.find(e => e.id === a.id), lb = l.find(e => e.id === b.id);
  assert.equal(la.name, 'A'); assert.equal(la.color, a.color);
  assert.equal(la.banked, 4);
  assert.equal(la.cash, 7.5, '4 x 1.5 x 1.25');
  assert.equal(lb.knockdowns, 1);
  for (const k of ['dived', 'cooked', 'scrubbed', 'hosed', 'pings']) assert.equal(typeof la[k], 'number', k);
  assert.equal(la.award, 'Employee of the Shift', 'the most banked');
  assert.equal(lb.award, 'Most Horizontal Associate');
});

test('awards: each Rat gets at most one, the higher stat wins, the rest are Present', () => {
  const { ledger } = ledgerCrew(6, [
    { banked: 50, knockdowns: 9, dived: 9 },           // A: would win everything; keeps the first
    { banked: 10, knockdowns: 4 },                     // B: Most Horizontal (A is taken)
    { banked: 5, dived: 2 },                           // C: Department of Wet
    { banked: 4, cooked: 6 },                          // D: Fry Laureate
    { banked: 3, scrubbed: 12 },                       // E: Crank Operator
    { banked: 2, hosed: 3 },                           // F: Hydration Officer
  ]);
  assert.deepEqual(ledger.map(e => e.award), ['Employee of the Shift', 'Most Horizontal Associate', 'Department of Wet',
    'Fry Laureate', 'Crank Operator of the Shift', 'Hydration Officer']);
  assert.equal(new Set(ledger.map(e => e.award)).size, 6, 'no award twice');
});

test('awards: the higher stat wins a shared award; unmatched Rats are Present', () => {
  const { ledger } = ledgerCrew(4, [{ banked: 1, knockdowns: 2 }, { banked: 9, knockdowns: 3 }, { banked: 2, knockdowns: 5 }, {}]);
  assert.equal(ledger[1].award, 'Employee of the Shift');
  assert.equal(ledger[2].award, 'Most Horizontal Associate', '5 beats 2');
  assert.equal(ledger[0].award, 'Present', 'knocked flat twice but outranked');
  assert.equal(ledger[3].award, 'Present');
});

test('awards: Enthusiasm goes to the most pings; Employee of the Shift is always given out', () => {
  const { ledger } = ledgerCrew(3, [{ pings: 1 }, { pings: 4 }, {}]);
  assert.equal(ledger.filter(e => e.award === 'Employee of the Shift').length, 1, 'even when nobody banked a ball');
  assert.ok(ledger.some(e => e.award === 'Enthusiasm (Noted)'));
  assert.equal(ledger[1].award, 'Enthusiasm (Noted)');
  const solo = ledgerCrew(1).ledger;
  assert.equal(solo.length, 1);
  assert.equal(solo[0].award, 'Employee of the Shift');
});

test('the report carries the venue, title and promotion info', () => {
  const { crew } = atReport({ stamps: 3, cash: 9000 });
  assert.equal(crew.report.venue, 0);
  assert.equal(crew.report.title, 'Range Rat');
  assert.equal(crew.report.promo.ready, true);
  assert.equal(crew.report.promo.next, 'Range Club');
  assert.match(crew.report.tomorrow, /Tomorrow/);
});

// ---- crew records --------------------------------------------------------------------------------

test('a record shift from day 3 sets report.record, saves records (no PA: it landed on the bell stamp, playtest round 2)', () => {
  const { crew, run } = makeCrew({ day: 3, voiced: ['welcome', 'gary'] }, 5);   // (a 5 s shift would otherwise have Gary warn and use the PA gap)
  openShift(crew);
  crew.bank(10, 'x');
  run(6);
  assert.deepEqual(crew.report.record, { cash: 15, was: 0 });
  assert.deepEqual(crew.records, { cash: 15, banked: 10, day: 3 });
  assert.ok(!events(crew).find(e => e.t === 'pa' && e.id === 'record'), 'the report line says it, not a PA over the stamp');
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.deepEqual(save.records, { cash: 15, banked: 10, day: 3 });
  assert.deepEqual(makeCrew(save).crew.records, save.records);
  assert.deepEqual(crew.snapshot().records, save.records);
});

test('records: a better shift beats it, a worse one does not, days 1 and 2 never count', () => {
  const early = makeCrew({ day: 2 }, 5);
  openShift(early.crew); early.crew.bank(10, 'x'); early.run(6);
  assert.equal(early.crew.report.record, null);
  assert.equal(early.crew.records.cash, 0);

  const { crew, run } = makeCrew({ day: 3, voiced: ['welcome', 'gary'], records: { cash: 15, banked: 10, day: 2 } }, 5);
  openShift(crew); crew.bank(10, 'x'); run(6);
  assert.equal(crew.report.record, null, 'equal is not a record');
  crew.phase = 'report';
  openShift(crew); crew.bank(20, 'x'); run(6);
  assert.deepEqual(crew.report.record, { cash: 30, was: 15 });
  assert.equal(crew.records.banked, 20);
  assert.equal(crew.records.day, 4);
});

test('records: junk in a save is cleaned', () => {
  const { crew } = makeCrew({ records: { cash: 'x', banked: -5, day: NaN } });
  assert.deepEqual(crew.records, { cash: 0, banked: 0, day: 0 });
  assert.deepEqual(makeCrew({}).crew.records, { cash: 0, banked: 0, day: 0 });
});

// ---- the Last Bucket and endless mode -----------------------------------------------------------

function lastBucketCrew(extra = {}) {
  const m = makeCrew({ venue: 5, outstanding: 10, day: 5, voiced: ['welcome'], ...extra }, 600);
  openShift(m.crew);
  const a = addPlayer(m.crew, 'A', STAND.x, STAND.z), b = addPlayer(m.crew, 'B', STAND.x + 3, STAND.z);
  m.crew.flush();
  return { ...m, a, b };
}
// Bring Ball No. 1 home: bank down to 1, wait for the fall and the rest.
function landTheBall({ crew, run }) {
  crew.bank(9, 'x');
  run(3.2);
  run(20);
  const b = crew.balls.get(crew.lastBucket.id);
  assert.ok(b && b.rest, 'Ball No. 1 has landed');
  return b;
}

test('Last Bucket: banking at the Orbital Range stops at 1 and begins the moment', () => {
  const { crew, run } = lastBucketCrew({ outstanding: 5 });
  crew.bank(100, 'x');
  assert.equal(crew.outstanding, 1, 'clamped at one');
  assert.equal(crew.stats.deposited, 100, 'every ball still counted');
  assert.equal(crew.lastBucket.phase, 'falling');
  const ev = events(crew);
  assert.ok(ev.find(e => e.t === 'lastbucket' && e.phase === 'falling'));
  assert.ok(ev.find(e => e.t === 'pa' && e.id === 'one'));
  assert.equal(crew.paused(), true);
  assert.equal(crew.snapshot().lastBucket.phase, 'falling');
  const t0 = crew.shiftT;
  run(2);
  assert.equal(crew.shiftT, t0, 'the sun is paused');
  crew.bank(10, 'x');
  assert.equal(crew.outstanding, 1, 'it only starts once');
  assert.equal(events(crew).filter(e => e.t === 'lastbucket').length, 0);
});

test('Last Bucket: it starts the same way from 1,958 and from a reloaded save at 1', () => {
  const orbit = atReport({ venue: 4, stamps: 3, cash: 1e9, outstanding: 5e8 }).crew;
  orbit.promote();
  assert.equal(orbit.outstanding, 1958);
  orbit.phase = 'shift';
  orbit.bank(1957, 'x');
  assert.equal(orbit.outstanding, 1);
  assert.equal(orbit.lastBucket.phase, 'falling');

  const back = makeCrew({ venue: 5, outstanding: 1, day: 5 }).crew;
  openShift(back);
  // (council round 5, Q1) a restart mid-moment picks the moment up at the morning, not on the next ball
  assert.equal(back.lastBucket.phase, 'falling', 'a restart mid-moment picks the moment up at the morning');
  back.bank(1, 'x');
  assert.equal(back.lastBucket.phase, 'falling', 'and the next ball changes nothing');
});

test('Last Bucket: not before the Orbital Range', () => {
  const { crew } = makeCrew({ venue: 4, outstanding: 10, day: 5 });
  openShift(crew);
  crew.bank(10, 'x');
  assert.equal(crew.lastBucket, null);
  assert.equal(crew.outstanding, 0);
  assert.ok(!crew.paused());
});

test('Last Bucket: mats stop, and after 3 s Ball No. 1 spawns high and falls', () => {
  const m = lastBucketCrew();
  const { crew, run } = m;
  crew.bank(9, 'x');
  crew.flush();
  crew.mats[0].next = 0;
  run(2.8);
  assert.equal(events(crew).filter(e => e.t === 'spawn').length, 0, 'nothing yet');
  run(0.5);
  const spawn = events(crew).filter(e => e.t === 'spawn');
  assert.equal(spawn.length, 1, 'a customer swing did not sneak in');
  assert.equal(spawn[0].kind, 'one');
  assert.equal(spawn[0].y, 120);
  assert.equal(crew.lastBucket.phase, 'down');
  const ball = crew.balls.get(crew.lastBucket.id);
  assert.ok(Math.abs(ball.x) < 40);
  run(2.5);
  assert.ok(ball.y < 120 && ball.vy < 0, `falling: y ${ball.y.toFixed(1)} vy ${ball.vy.toFixed(1)}`);
  run(10);
  assert.equal(ball.rest, true);
  assert.ok(ball.z < -85 && ball.z > -140, `landed ${ball.z.toFixed(0)} m out`);
  assert.ok(!(Math.hypot(ball.x - POND.x, ball.z - POND.z) < POND.r), 'not in the pond');
  assert.ok(events(crew).find(e => e.t === 'rest' && e.one === true));
  assert.equal(events(crew).filter(e => e.t === 'spawn').length, 0, 'the range stayed quiet');
  assert.equal(crew.shiftT, 0, 'the whole time the clock was held');
});

test('Last Bucket: only a hand picks it up, outside the pocket', () => {
  const m = lastBucketCrew();
  const { crew, a, b } = m;
  const ball = landTheBall(m);
  a.x = ball.x; a.z = ball.z; a.pocket = 25; a.pocketW = 25;   // a full bucket
  crew.flush();
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: ball.id }).denied, []);
  assert.equal(a.one, true);
  assert.equal(a.pocket, 25, 'the pocket is untouched');
  assert.equal(crew.balls.has(ball.id), false);
  assert.equal(crew.lastBucket.phase, 'carried');
  assert.equal(crew.lastBucket.by, a.id);
  assert.equal(crew.snapshot().players.find(p => p.id === a.id).one, true);
  assert.ok(events(crew).find(e => e.t === 'lastbucket' && e.phase === 'carried' && e.by === a.id));
  assert.equal(b.one, false);
});

test('Last Bucket: the cart, the jackpot and helpers all skip it', () => {
  const { crew, run } = makeCrew({ venue: 5, outstanding: 10, day: 5, up: { cart: 1, helpers: 1 } });
  openShift(crew);
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  const c = crew.cart, rx = c.x - Math.sin(c.yaw) * CART.REEL_AHEAD, rz = c.z - Math.cos(c.yaw) * CART.REEL_AHEAD;
  const one = restingBall(crew, rx, rz, 'one');
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: one.id, cart: true }).denied, [one.id], 'the reels will not take it');
  assert.equal(c.load, 0);

  // jackpot hoover
  const other = restingBall(crew, c.x + 2, c.z + 2, 'range');
  crew.rng = () => 0.1;                                 // a jackpot
  crew.ping({ id: 99999, by: a.id, vx: 1, vy: 1, vz: 1 });
  assert.equal(crew.balls.has(other.id), false, 'the jackpot scooped the range ball');
  assert.equal(crew.balls.has(one.id), true, 'but not Ball No. 1');
  assert.equal(c.load, 1);

  // helpers
  crew.balls.delete(other.id);
  const h = crew.helpers[0];
  one.x = h.x + 1; one.z = h.z;
  const far = restingBall(crew, 60, 25, 'range');
  run(20);
  assert.equal(crew.balls.has(one.id), true, 'the helper left it alone');
  assert.equal(crew.balls.has(far.id), false, 'while the ordinary ball was collected');
});

test('Last Bucket: the carrier cannot board the cart, and a knockdown drops it', () => {
  const m = lastBucketCrew({ up: { cart: 1 } });
  const { crew, a, b } = m;
  const ball = landTheBall(m);
  a.x = ball.x; a.z = ball.z;
  act(crew, a, { t: 'pickup', ball: ball.id });
  assert.equal(a.one, true);
  a.x = CART.PARK.x - 1; a.z = CART.PARK.z;
  assert.equal(crew.board(a), false, 'both hands are full');

  a.pocket = 2; a.pocketW = 2;
  crew.flush();
  crew.knockDown(a, 'test');
  assert.equal(a.one, false);
  const dropped = crew.balls.get(crew.lastBucket.id);
  assert.ok(dropped && dropped.kind === 'one' && dropped.rest, 'it drops at the feet and does not fly');
  assert.ok(Math.hypot(dropped.x - a.x, dropped.z - a.z) < 1);
  assert.equal(crew.lastBucket.phase, 'down');
  assert.equal(a.grime, 1);
  assert.ok(events(crew).find(e => e.t === 'rest' && e.one === true));

  b.x = dropped.x; b.z = dropped.z;                     // a crewmate scoops it up
  assert.deepEqual(act(crew, b, { t: 'pickup', ball: dropped.id }).denied, []);
  assert.equal(b.one, true);
  assert.equal(crew.lastBucket.by, b.id);
});

test('Last Bucket: banking it needs every online Rat within 8 m of the stand', () => {
  const m = lastBucketCrew();
  const { crew, a, b } = m;
  const ball = landTheBall(m);
  a.x = ball.x; a.z = ball.z;
  act(crew, a, { t: 'pickup', ball: ball.id });
  crew.join('Ghost');                                   // offline Rats never block
  a.x = STAND.x; a.z = STAND.z;
  b.x = 80; b.z = 6;
  crew.flush();
  const cash = crew.cash;
  act(crew, a, { t: 'deposit' });
  const ev = events(crew);
  const huddle = ev.find(e => e.t === 'huddle');
  assert.deepEqual({ n: huddle.n, of: huddle.of, by: huddle.by }, { n: 1, of: 2, by: a.id });
  assert.equal(a.one, true, 'refused');
  assert.equal(crew.cash, cash);
  assert.equal(crew.endless, false);
  assert.equal(crew.phase, 'shift');

  b.x = STAND.x + 8.5;
  act(crew, a, { t: 'hold', on: true }); act(crew, b, { t: 'hold', on: true }); m.run(3.2);   // the huddle (round 6 #5)
  assert.equal(a.one, true, '8.5 m is too far');
  b.x = STAND.x + 7.9;
  const bv = crew.valueNow().bv;
  m.run(3.2);                                     // both still holding: the sweep fills
  assert.equal(a.one, false);
  near(crew.cash - cash, 1958 * bv, 0.01);
});

test('Last Bucket: banking it ends the world: outstanding 0, endless, the last line, the ending report', () => {
  const m = lastBucketCrew();
  const { crew, a, b } = m;
  const ball = landTheBall(m);
  a.x = ball.x; a.z = ball.z;
  act(crew, a, { t: 'pickup', ball: ball.id });
  a.x = STAND.x; a.z = STAND.z; b.x = STAND.x + 2;
  crew.flush();
  act(crew, a, { t: 'hold', on: true }); act(crew, b, { t: 'hold', on: true }); m.run(3.2);   // the huddle (round 6 #5)
  assert.equal(crew.outstanding, 0);
  assert.equal(crew.endless, true);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.paused(), false);
  const ev = events(crew);
  const banked = ev.find(e => e.t === 'lastbucket' && e.phase === 'banked');
  assert.ok(banked && banked.by === a.id && banked.cash > 0);
  assert.ok(ev.find(e => e.t === 'pa' && e.id === 'last'));
  const r = crew.report.ending;
  assert.ok(r, 'report.ending');
  assert.equal(r.days, 5);
  assert.equal(r.banked, 10, 'nine balls and Ball No. 1');
  assert.equal(r.commendations, crew.commendations);
  assert.equal(typeof r.quotas, 'number');
  assert.equal(crew.report.quota, null, 'no performance review on the last day');
  assert.equal(crew.title(), 'Owner');
  assert.equal(crew.snapshot().title, 'Owner');
  assert.equal(crew.promoInfo(), null);

  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.equal(save.endless, true);
  assert.equal(save.outstanding, 0);
  assert.equal(save.venue, 5);
  const back = makeCrew(save).crew;
  assert.equal(back.endless, true);
  assert.equal(back.title(), 'Owner');
});

test('Endless mode: a reveal, no quota, no Gary, and the first customer ball sets Balls Outstanding to 1', () => {
  const m = lastBucketCrew();
  const { crew, run, a, b } = m;
  const ball = landTheBall(m);
  a.x = ball.x; a.z = ball.z;
  act(crew, a, { t: 'pickup', ball: ball.id });
  a.x = STAND.x; a.z = STAND.z; b.x = STAND.x + 2;
  act(crew, a, { t: 'hold', on: true }); act(crew, b, { t: 'hold', on: true }); m.run(3.2);   // the huddle (round 6 #5)
  crew.flush();

  act(crew, a, { t: 'start' }); act(crew, b, { t: 'start' });
  assert.equal(crew.phase, 'shift');
  let ev = events(crew);
  const reveal = ev.find(e => e.t === 'reveal');
  assert.ok(reveal && reveal.title === 'Owner');
  const memo = ev.find(e => e.t === 'memo');
  assert.equal(memo.target, null);
  assert.equal(crew.quota, null);
  assert.equal(crew.snapshot().quota, null);
  assert.equal(crew.outstanding, 0, 'nothing out there yet');
  for (const m of crew.mats) m.next = 1e9;
  run(6.5);                                             // the reveal
  setMud(crew, 0); run(2);                              // the morning mud kept the early birds waiting: hose it, they step on
  crew.flush();
  swing(crew);
  ev = events(crew);
  assert.equal(crew.outstanding, 1);
  assert.ok(ev.find(e => e.t === 'pa' && e.id === 'endless'));
  swing(crew);
  assert.equal(crew.outstanding, 2, 'a live count from here');
  assert.equal(paIds(crew).includes('endless'), false, 'once');
  crew.bank(5, 'x');
  assert.equal(crew.outstanding, 0, 'banking takes it down to zero, not one');
  assert.equal(crew.lastBucket.phase, 'done', 'and nothing starts a second Last Bucket');

  crew.shiftT = 600 * 0.45;
  run(1);
  assert.equal(crew.gary, null, 'Gary does not come');
  crew.shiftT = 599.99;
  run(0.5);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.report.quota, null);
  assert.equal(crew.stamps, 0);
  assert.match(crew.report.tomorrow, /never ends/);
});

// ---- CCTV ---------------------------------------------------------------------------------------

test('CCTV mark: only from the Club, validated, and rate-limited per Rat', () => {
  const muni = makeCrew().crew;
  openShift(muni);
  const m0 = addPlayer(muni, 'A');
  act(muni, m0, { t: 'mark', x: 10, z: -50 });
  assert.equal(events(muni).filter(e => e.t === 'mark').length, 0, 'no cameras at the Muni');

  const { crew, clock } = makeCrew({ venue: 1 });
  openShift(crew);
  const a = addPlayer(crew, 'A'), b = addPlayer(crew, 'B');
  act(crew, a, { t: 'mark', x: 10.123, z: -50.987 });
  const ev = events(crew).filter(e => e.t === 'mark');
  assert.equal(ev.length, 1);
  assert.deepEqual({ by: ev[0].by, x: ev[0].x, z: ev[0].z, color: ev[0].color }, { by: a.id, x: 10.1, z: -51, color: a.color });
  act(crew, a, { t: 'mark', x: 20, z: -60 });
  assert.equal(events(crew).filter(e => e.t === 'mark').length, 0, 'inside the 2 s cooldown');
  act(crew, b, { t: 'mark', x: 20, z: -60 });
  assert.equal(events(crew).filter(e => e.t === 'mark').length, 1, 'the cooldown is per Rat');
  clock.t += 2100;
  act(crew, a, { t: 'mark', x: 20, z: -60 });
  assert.equal(events(crew).filter(e => e.t === 'mark').length, 1);
  clock.t += 2100;
  act(crew, a, { t: 'mark', x: NaN, z: 3 }, { t: 'mark', x: 'a', z: 3 }, { t: 'mark' });
  assert.equal(events(crew).filter(e => e.t === 'mark').length, 0, 'junk coordinates');
});

// ---- the round-2 fixes ---------------------------------------------------------------------------

test('save v2: venue, venueDay, outstanding, pendingReveal, endless, records and voiced round-trip', () => {
  const save = { venue: 3, venueDay: 4, outstanding: 123456, pendingReveal: 3, endless: false,
    records: { cash: 99.5, banked: 40, day: 12 }, voiced: ['welcome', 'cart'], debuts: ['gold'], day: 20 };
  const crew = makeCrew(save).crew;
  const back = JSON.parse(JSON.stringify(crew.toSave()));
  assert.equal(back.v, 3, 'v3 adds diveByName and lostFound');
  assert.equal(back.venue, 3);
  assert.equal(back.venueDay, 4);
  assert.equal(back.outstanding, 123456);
  assert.equal(back.pendingReveal, 3);
  assert.equal(back.endless, false);
  assert.deepEqual(back.records, { cash: 99.5, banked: 40, day: 12 });
  assert.deepEqual(back.voiced, ['welcome', 'cart']);
  assert.deepEqual(back.debuts, ['gold']);
});

test('save: junk is cleaned', () => {
  const crew = makeCrew({ venue: 99, venueDay: -3, outstanding: 'lots', pendingReveal: 'x', endless: 'yes', voiced: [] }).crew;
  assert.equal(crew.venue, 5);
  assert.equal(crew.venueDay, 0);
  assert.equal(crew.outstanding, BALLS_OUTSTANDING);
  assert.equal(crew.pendingReveal, 0, 'REAL BUG (minor): a junk truthy pendingReveal ("x") becomes venue 1 via int(..., 1, 5) and plays a spurious Club reveal');
  assert.equal(makeCrew({ venue: -2 }).crew.venue, 0);
  assert.equal(makeCrew({ outstanding: -5 }).crew.outstanding, 0);
});

test('Balls Outstanding is a stored field: old saves derive it, bank() decrements it', () => {
  const old = makeCrew({ totals: { deposited: 1000 } }).crew;
  assert.equal(old.outstanding, BALLS_OUTSTANDING - 1000);
  const stored = makeCrew({ totals: { deposited: 1000 }, outstanding: 777 }).crew;
  assert.equal(stored.outstanding, 777, 'a stored count wins');
  assert.equal(makeCrew({ outstanding: 0 }).crew.outstanding, 0, 'zero is a real value');
  openShift(stored);
  stored.bank(7, 'x');
  assert.equal(stored.outstanding, 770);
  assert.equal(stored.snapshot().outstanding, 770);
  stored.endShift();
  assert.equal(stored.snapshot().outstanding, 770, 'the report does not subtract today twice');
  assert.equal(stored.toSave().outstanding, 770);
  assert.equal(makeCrew({ outstanding: 3, venue: 1 }).crew.outstanding, 3);
  const floor = makeCrew({ outstanding: 3, venue: 1 }).crew; openShift(floor); floor.bank(10, 'x');
  assert.equal(floor.outstanding, 0, 'below the Orbital Range it just counts down');
});

test('the pond opens with the Club: lead balls and saved sunk balls only from venue 1', () => {
  const muni = makeCrew({ pondSunk: 5 }).crew;
  assert.equal(muni.sunkCount(), 0);
  assert.equal(muni.snapshot().pond.unlocked, false);
  const club = makeCrew({ pondSunk: 5, venue: 1 }).crew;
  assert.equal(club.sunkCount(), 5);
  assert.equal(club.snapshot().pond.unlocked, true);
  near(club.valueNow().pond, 1 - 5 / POND.CLEAR_AT);
  assert.equal(POND.FROM_VENUE, 1);

  const kindAt = venue => {
    const { crew } = makeCrew({ venue, day: 1, voiced: ['welcome'] });
    openShift(crew);
    crew.rng = () => 0.01;                              // under LEAD_CHANCE
    swing(crew);
    return events(crew).find(e => e.t === 'spawn').kind;
  };
  assert.equal(kindAt(1), 'lead');
  assert.notEqual(kindAt(0), 'lead', 'no lead balls at the Muni, even on a lucky roll');
});

test('splitters through the cart, the jackpot and helpers load as 3', () => {
  const { crew, run } = makeCrew({ up: { cart: 1, helpers: 1 } });
  openShift(crew);
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  const c = crew.cart, r = { x: c.x - Math.sin(c.yaw) * CART.REEL_AHEAD, z: c.z - Math.cos(c.yaw) * CART.REEL_AHEAD };
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: restingBall(crew, r.x, r.z, 'splitter').id, cart: true }).denied, []);
  assert.equal(c.load, 3);
  assert.equal(c.loadW, 3);
  assert.equal(crew.stats.picked, 3);
  assert.equal(crew.stats.carted, 3);

  crew.rng = () => 0.1;                                 // jackpot
  restingBall(crew, c.x + 2, c.z + 2, 'splitter');
  crew.ping({ id: 99999, by: a.id, vx: 1, vy: 1, vz: 1 });
  assert.equal(c.load, 6);
  assert.equal(c.loadW, 6);
  const jack = events(crew).find(e => e.t === 'ping' && e.prize === 'jackpot');
  assert.equal(jack.n, 3);

  const h = crew.helpers[0];
  const s = restingBall(crew, 60, 25, 'splitter');
  h.x = 60; h.z = 25;
  run(0.5);
  assert.equal(crew.balls.has(s.id), false);
  assert.equal(h.pocket, 3);
  assert.equal(h.pocketW, 3);
});

test('a banked splitter counts as 3 balls', () => {
  const { crew } = makeCrew({ up: { cart: 1 } });
  openShift(crew);
  crew.cart.load = 3; crew.cart.loadW = 3; crew.cart.mud = 0;
  crew.cart.x = STAND.x + 2; crew.cart.z = STAND.z + 2;
  crew.tick(0.05);
  assert.equal(crew.stats.deposited, 3);
  assert.equal(crew.outstanding, BALLS_OUTSTANDING - 3);
  assert.equal(crew.cash, 5.63);
});

test('a diver surfacing with a bag keeps the kinds\' weights', () => {
  const { crew, run } = makeCrew({ venue: 1, day: 3 });
  openShift(crew);
  const a = addPlayer(crew, 'A', POND.x, POND.z);
  run(0.1);
  assert.equal(a.diving, true);
  crew.sinkNew('lead', a); crew.sinkNew('gold', a);
  const ids = [...crew.balls.values()].filter(b => b.sunk).map(b => b.id);
  const sunkBefore = ids.length;
  for (const id of ids) { const b = crew.balls.get(id); a.x = b.x; a.z = b.z; act(crew, a, { t: 'pickup', ball: id, pond: true }); }   // lead and gold roll into the Deep End
  assert.equal(a.bag, sunkBefore);
  assert.deepEqual(a.bagKinds.slice().sort(), ['gold', 'lead']);
  a.x = POND.DOCK.x; a.z = POND.DOCK.z + 4;
  run(0.1);
  assert.equal(a.diving, false);
  assert.equal(a.pocket, 2);
  assert.equal(a.pocketW, 13, 'lead x3 + gold x10');
  assert.deepEqual(a.bagKinds, []);
});

test('a gasping diver\'s bag re-sinks with its original kinds', () => {
  const { crew, run } = makeCrew({ venue: 1, day: 3 });
  openShift(crew);
  const a = addPlayer(crew, 'A', POND.x, POND.z);
  run(0.1);
  crew.sinkNew('lead', a); crew.sinkNew('gold', a); crew.sinkNew('lead', a);
  for (const b of [...crew.balls.values()].filter(b => b.sunk)) { a.x = b.x; a.z = b.z; act(crew, a, { t: 'pickup', ball: b.id, pond: true }); }
  assert.equal(a.bag, 3);
  assert.deepEqual(a.bagKinds.slice().sort(), ['gold', 'lead', 'lead']);
  assert.equal(crew.sunkCount(), 0);
  crew.flush();
  a.air = 0.01;
  run(0.1);
  assert.equal(a.diving, false);
  assert.ok(events(crew).find(e => e.t === 'gasp'));
  assert.equal(a.bag, 0);
  assert.deepEqual(a.bagKinds, []);
  const kinds = [...crew.balls.values()].filter(b => b.sunk).map(b => b.kind).sort();
  assert.deepEqual(kinds, ['gold', 'lead', 'lead'], 'lead stays lead and gold stays gold');
});

test('a splitter fished out of the pond is worth three (council round 2, section 1.2 item 4 lists pondPickup)', () => {
  const { crew, run } = makeCrew({ venue: 1, day: 8 });
  openShift(crew);
  const a = addPlayer(crew, 'A', POND.x, POND.z);
  run(0.1);
  crew.sinkNew('splitter', a);
  const b = [...crew.balls.values()].find(x => x.sunk);
  act(crew, a, { t: 'pickup', ball: b.id, pond: true });
  assert.equal(a.bag, 3, 'REAL BUG: pondPickup() still banks a splitter as one ball of weight 1; the council doc lists pondPickup() among the paths that must load 3');
  assert.equal(a.bagW, 3);
});

test('prices scale with the Rats who are online, not everyone in the grace window', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A');
  crew.join('B'); crew.join('C');                       // dropped a moment ago: still in the roster
  assert.equal(crew.players.size, 3);
  assert.equal(crew.onlineCount(), 1);
  crew.cash = 1000;
  const flushed = events(crew);
  assert.ok(flushed);
  act(crew, a, { t: 'buy', id: 'helpers' });
  const ev = events(crew).find(e => e.t === 'buy');
  assert.equal(ev.price, 60, 'one Rat online: the solo price, not x1.8');
  assert.equal(crew.cash, 940);
  assert.equal(crew.promoInfo().fee, 2500);
});

// ---- council round 4, build item 1: Gary counts only the mats in play --------------------
test('Gary\'s mats check ignores mats that are not in play (solo uses 6 of 10)', () => {
  const { crew } = (() => { const clock = { t: 1_000_000 }; return { crew: new Crew('GARYM', null, { shiftSecs: 600, seed: 5, now: () => clock.t }) }; })();
  const p = crew.join('Solo'); crew.connect(p);
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
  assert.equal(crew.inspect('mats'), true);
  for (let i = 6; i < 10; i++) crew.fixtures['mat' + i] = 1;            // four filthy mats nobody plays
  assert.equal(crew.inspect('mats'), true, 'mats 6-9 are not counted solo');
  for (let i = 0; i < 2; i++) crew.fixtures['mat' + i] = 1;             // 2 of 6 active are filthy: 4/6 < 0.8
  assert.equal(crew.inspect('mats'), false);
});

// ---- round 4 item 12: the endless target (record pace) --------------------------------------------
test('Endless target: snapshot.pace is record pace in endless, null otherwise, and scales with shiftT', () => {
  const e = makeCrew({ venue: 5, endless: true, day: 9, records: { cash: 400, banked: 10, day: 4 } }, 600);
  openShift(e.crew);
  assert.equal(e.crew.snapshot().quota, null);
  e.crew.shiftT = 0;
  assert.equal(e.crew.snapshot().pace.now, 0);
  assert.equal(e.crew.snapshot().pace.record, 400);
  e.crew.shiftT = 150;
  near(e.crew.snapshot().pace.now, 100);
  e.crew.shiftT = 300;
  near(e.crew.snapshot().pace.now, 200);
  e.crew.stats.cash = 55;
  assert.equal(e.crew.snapshot().pace.cash, 55);
  const plain = makeCrew({ venue: 5, day: 9, outstanding: 10, records: { cash: 400, banked: 10, day: 4 } }, 600);
  openShift(plain.crew);
  assert.equal(plain.crew.snapshot().pace, null, 'not endless');
  const noRec = makeCrew({ venue: 5, endless: true, day: 9 }, 600);
  openShift(noRec.crew);
  assert.equal(noRec.crew.snapshot().pace, null, 'no record yet');
});

test('round 6 #5: the Gary huddle flag is unchanged by the ring (no hold needed, holding alone is not enough)', () => {
  const verdictWith = (place, holdIt) => {
    const { crew } = makeCrew({ day: 5, voiced: ['welcome'] });
    openShift(crew);
    const a = addPlayer(crew, 'A', STAND.x, STAND.z), b = addPlayer(crew, 'B', STAND.x + 3, STAND.z);
    place(a, b);
    if (holdIt) { act(crew, a, { t: 'hold', on: true }); act(crew, b, { t: 'hold', on: true }); }
    crew.gary = { phase: 'drive', t: 0, pause: 0, stop: 0, x: 26, z: 10, yaw: 0, fails: 0, checks: [] };
    crew.garyStops = () => [{ id: 'stand', x: 26, z: 10 }];
    crew.flush();
    assert.equal(crew.snapshot().gary.to, 'stand', 'the snapshot says where he is headed (the Board countdown)');
    crew.stepGary(0.1);
    return events(crew).find(e => e.t === 'verdict');
  };
  assert.equal(verdictWith(() => {}, false).huddle, true, 'all within 8 m: a huddle, nobody held anything');
  assert.equal(verdictWith((a, b) => { b.x = STAND.x + 20; }, true).huddle, false, 'holding Use away from the stand does not count');
  assert.equal(verdictWith(() => {}, true).huddle, true);
});
