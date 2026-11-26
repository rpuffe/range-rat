// Round 11 (builder "today"): Corporate's Today (expert #3), the endless contracts and cosmetics (#10b), the night recap
// and awards (#8). web/js/today.js and web/js/awards.js are pure; the server tests drive a real Crew.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TODAY, MODS, MOD_IDS, todayPool, todayFor, dealMod, todayMemo, todayChip, todayReport, todayKind, todayShot, ballMul, mudMul,
  basketCap, swingMul, orderBoost, juniorDay, skyK, floodsOn, contractsFor, contractMet, goalText, cleanContract, COSMETICS, unlockedLooks,
  nextLook, newlyUnlocked, canWear, cleanLooks, cycleLook, CONTRACT } from '../web/js/today.js';
import { AWARDS, addNight, awardsFor, nightCard, cleanCard, cardRows, daysText } from '../web/js/awards.js';
import { Crew } from '../server/crew.mjs';
import { KIND_W, BUCKETS } from '../web/js/sim.js';

const words = s => s.trim().split(/\s+/).length;
const base = { key: 12345, venue: 0, nMats: 8 };

// ---- today.js -----------------------------------------------------------------------------------------------------
test('Today: none before Muni day 5, on a Gary day, on Promotion Day, on a reveal morning, at the Orbital or in endless', () => {
  for (let d = 1; d < TODAY.FROM_DAY; d++) assert.equal(todayFor({ ...base, day: d }), null, 'day ' + d);
  const days = Array.from({ length: 40 }, (_, i) => i + 5);
  assert.ok(days.every(d => todayFor({ ...base, day: d })), 'every plain day from 5 deals one');
  for (const flag of ['gary', 'promo', 'reveal', 'endless']) assert.equal(todayFor({ ...base, day: 9, [flag]: true }), null, flag);
  assert.equal(todayFor({ ...base, day: 9, venue: 5 }), null, 'no Today at the Orbital');
});

test('Today is deterministic from the key, never the same two days running, and fits the venue', () => {
  for (const key of [1, 7, 99, 12345, 0xbeef]) {
    let prev = null;
    for (let d = 5; d < 60; d++) {
      const t = todayFor({ ...base, key, day: d });
      assert.deepEqual(t, todayFor({ ...base, key, day: d }), 'same key, same day, same deal');
      assert.notEqual(t.id, prev, `key ${key} day ${d} repeats ${prev}`);
      prev = t.id;
    }
  }
  const seen = new Set();
  for (let d = 5; d < 200; d++) seen.add(todayFor({ ...base, day: d }).id);
  assert.deepEqual([...seen].sort(), [...MOD_IDS].sort(), 'every modifier turns up at the Muni');
  for (const v of [3, 4]) {
    assert.ok(!todayPool(v).includes('junior'), 'no clinic at venue ' + v);
    for (let d = 5; d < 120; d++) assert.notEqual(todayFor({ ...base, venue: v, day: d }).id, 'junior');
  }
  const c = dealMod('celeb', 3, 9, 6);
  assert.ok(c.bay >= 0 && c.bay < 6, 'the celebrity takes a bay in play');
  assert.ok([1, -1].includes(dealMod('windy', 3, 9).wind));
});

test('Today\'s words: one memo line of 8 words or fewer, a short Board chip, a report line', () => {
  for (const id of MOD_IDS) for (const v of [0, 2]) {
    const t = dealMod(id, 1, 5);
    const m = todayMemo(t, v);
    assert.ok(m && words(m) <= 8, `${id}@${v}: "${m}"`);
    assert.ok(todayChip(t).length <= 16, todayChip(t));
    assert.ok(todayReport(t, {}, v), id);
  }
  assert.match(todayMemo({ id: 'celeb', bay: 3 }), /Bay 4/);
  assert.equal(todayChip({ id: 'celeb', bay: 3 }), 'CELEB · BAY 4');
  assert.match(todayMemo({ id: 'league' }, 2), /deck/i);
  assert.equal(todayMemo(null), null);
  assert.match(todayReport({ id: 'celeb', bay: 0 }, { celeb: 12, celebKnocks: 2 }), /12 balls at ×3, 2 Rats/);
});

test('Today\'s effects: kinds, the wind, the celebrity, the pay, the mud, the basket, the deck, the night sky', () => {
  // night: range balls glow all day, worth NIGHT_W of a glow (×1.1 a range ball); rain from RAIN_GLOW of the shift
  assert.equal(todayKind({ id: 'night' }, 'range', 0, 420), 'glow');
  assert.equal(todayKind({ id: 'night' }, 'gold', 0, 420), 'gold', 'only range balls change');
  assert.equal(todayKind({ id: 'rain' }, 'range', 100, 420), 'range');
  assert.equal(todayKind({ id: 'rain' }, 'range', 420 * (1 - TODAY.RAIN_GLOW) + 1, 420), 'glow');
  assert.equal(todayKind(null, 'range', 0, 420), 'range');
  const nightShot = todayShot({ id: 'night' }, { kind: 'glow', vx: 0, vz: -20 }, { i: 0, x: 0 });
  assert.ok(Math.abs(KIND_W.glow * ballMul(nightShot) - 1.1) < 1e-9, 'a night glow pays ×1.1');
  assert.equal(ballMul(todayShot({ id: 'night' }, { kind: 'glow', vx: 0, vz: -20 }, { i: 0, x: 0 }, [], { lastCall: true })), 1, 'Last Call\'s glow keeps ×2');
  // windy: light balls curve a lot, heavy ones a little, the day's way
  assert.equal(todayShot({ id: 'windy', wind: -1 }, { kind: 'range', vx: 0, vz: -20 }).curve, -TODAY.WIND);
  assert.equal(todayShot({ id: 'windy', wind: 1 }, { kind: 'lead', vx: 0, vz: -20 }).curve, TODAY.WIND_HEAVY);
  // the celebrity: only their bay; ×3; aimed at the nearest Rat out on the field (not one behind the mats)
  const mat = { i: 4, x: -2 };
  assert.equal(todayShot({ id: 'celeb', bay: 3 }, { kind: 'range', x: -2, z: -0.4, vx: 0, vz: -20 }, mat).mul, undefined, 'another bay');
  const s = todayShot({ id: 'celeb', bay: 4 }, { kind: 'range', x: -2, z: -0.4, vx: 0, vz: -20 }, mat, [{ x: 30, z: -40 }, { x: 0, z: 3 }]);
  assert.equal(s.mul, 3); assert.ok(s.celeb);
  assert.ok(Math.abs(Math.atan2(s.vx, -s.vz) - Math.atan2(32, 39.6)) < 1e-6, 'aimed at the Rat at (30, -40)');
  assert.ok(Math.abs(Math.hypot(s.vx, s.vz) - 20) < 1e-9, 'same speed');
  assert.equal(mudMul({ id: 'rain' }), 2); assert.equal(mudMul(null), 1);
  assert.equal(basketCap({ id: 'shortage' }, 12), 6); assert.equal(basketCap(null, 12), 12);
  assert.equal(swingMul({ id: 'league' }, 3), TODAY.LEAGUE_SWING); assert.equal(swingMul({ id: 'windy' }, 3), 1);
  assert.equal(swingMul({ id: 'celeb', bay: 3 }, 3), TODAY.CELEB_GAP); assert.equal(swingMul({ id: 'celeb', bay: 3 }, 4), 1);
  assert.ok(juniorDay({ id: 'junior' }, 0) && !juniorDay({ id: 'junior' }, 1) && !juniorDay(null, 0), 'the clinic takes every other bay');
  assert.equal(orderBoost({ id: 'league' }, 3), 2); assert.equal(orderBoost({ id: 'league' }, 1), 1, 'no deck below Tiered'); assert.equal(orderBoost({ id: 'windy' }, 3), 1);
  assert.equal(skyK({ id: 'night' }, 0.1), TODAY.NIGHT_SKY); assert.equal(skyK(null, 0.1), 0.1);
  assert.ok(floodsOn({ id: 'night' }, false) && floodsOn(null, true) && !floodsOn(null, false));
});

// ---- contracts and cosmetics --------------------------------------------------------------------------------------
test('contracts: three offers, one of each star count, three different modifiers, deterministic', () => {
  for (let d = 1; d < 40; d++) {
    const o = contractsFor({ key: 77, day: d, yesterday: 4000 });
    assert.equal(o.length, CONTRACT.OFFERS);
    assert.deepEqual(o.map(c => c.stars), [1, 2, 3]);
    assert.equal(new Set(o.map(c => c.mod.id)).size, 3);
    assert.deepEqual(o, contractsFor({ key: 77, day: d, yesterday: 4000 }));
    for (const c of o) assert.ok(goalText(c.goal).length > 0 && words(goalText(c.goal)) <= 6);
    for (const c of o) assert.deepEqual(cleanContract(JSON.parse(JSON.stringify(c))), c);
  }
  assert.ok(contractsFor({ key: 77, day: 3, yesterday: 0 }).every(c => c.goal.k !== 'cash'), 'no yesterday: no cash goal');
  const hard = contractsFor({ key: 1, day: 1, yesterday: 1000 }).find(c => c.goal.k === 'cash');
  if (hard) assert.ok(hard.goal.n > 0);
  assert.ok(contractMet({ goal: { k: 'cash', n: 100 } }, { cash: 100 }));
  assert.ok(!contractMet({ goal: { k: 'cash', n: 100 } }, { cash: 99.99 }));
  assert.ok(contractMet({ goal: { k: 'upright', n: 0 } }, { knockdowns: 0 }));
  assert.ok(!contractMet({ goal: { k: 'spotless', n: 5 } }, { left: 6 }));
  assert.equal(cleanContract({ mod: { id: 'nope' }, goal: { k: 'cash', n: 1 } }), null);
});

test('cosmetics: one every 5 stars from 3 (council round 12 #6d), cheap recolours; the locker cycles only what is unlocked', () => {
  COSMETICS.forEach((c, i) => { assert.equal(c.stars, 3 + 5 * i); assert.ok(['hat', 'vest', 'cart'].includes(c.part)); assert.ok(Number.isInteger(c.hex)); });
  assert.equal(unlockedLooks(2).length, 0); assert.equal(unlockedLooks(3).length, 1); assert.equal(unlockedLooks(13).length, 3);
  assert.equal(nextLook(3).stars, 8); assert.equal(nextLook(1000), null);
  assert.equal(newlyUnlocked(1, 4).id, 'hat-teal'); assert.equal(newlyUnlocked(4, 5), null); assert.equal(newlyUnlocked(7, 14).id, 'vest-pink');
  assert.ok(canWear('hat-teal', 'hat', 3)); assert.ok(!canWear('hat-teal', 'hat', 2)); assert.ok(!canWear('hat-teal', 'vest', 99)); assert.ok(canWear(null, 'cart', 0));
  assert.equal(cycleLook(null, 'hat', 20), 'hat-teal'); assert.equal(cycleLook('hat-teal', 'hat', 20), 'hat-black'); assert.equal(cycleLook('hat-black', 'hat', 20), null);
  assert.equal(cycleLook(null, 'vest', 5), null, 'nothing unlocked: stays standard');
  assert.deepEqual(cleanLooks({ Ann: { hat: 'hat-teal', vest: 'cart-gold' }, Bob: { hat: 'x' }, ['x'.repeat(20)]: { hat: 'hat-teal' } }), { Ann: { hat: 'hat-teal' } });
});

// ---- awards.js ----------------------------------------------------------------------------------------------------
test('awards: one per Rat, never twice; the best count wins; a Rat with nothing "Showed Up"', () => {
  const night = {};
  addNight(night, 'Ann', '#e8604c', { banked: 300, cooked: 40, dealt: 1, picked: 310 });
  addNight(night, 'Bob', '#4c9be8', { banked: 200, dealt: 5, gary: 12.4, picked: 400 });
  addNight(night, 'Cy', '#f2c94c', { banked: 100, picked: 90 });
  addNight(night, 'Dee', '#6fcf7c', {});
  addNight(night, 'Ann', '#e8604c', { banked: 50, cooked: 2 });
  assert.equal(night.Ann.banked, 350); assert.equal(night.Ann.cooked, 42);
  const a = awardsFor(night), by = Object.fromEntries(a.map(r => [r.name, r]));
  assert.equal(by.Bob.award, 'Most Knockdowns Dealt'); assert.match(by.Bob.line, /5 Rats/);
  assert.equal(by.Ann.award, 'Fry Lord');
  assert.equal(by.Cy.award, 'Sweep King', 'Bob and Ann are taken: Cy has the next most picked');
  assert.equal(by.Dee.award, 'Showed Up');
  assert.equal(new Set(a.map(r => r.award)).size, 4);
  assert.deepEqual(a.map(r => r.name), ['Ann', 'Bob', 'Cy', 'Dee'], 'best banker first');
  assert.ok(AWARDS.some(([t]) => t === 'Talked to Gary the Longest') && AWARDS.some(([t]) => t === 'Most Sprayed') && AWARDS.some(([t]) => t === 'Deepest Diver'));
});

test('the night card: minutes, balls, knockdowns, falls, treasures; it cleans and round-trips', () => {
  const c = nightCard({ startedAt: 0, now: 61 * 60_000, fromDay: 5, day: 9, venue: 1, title: 'Range Rat', balls: 4000, cash: 9000.5, knockdowns: 7, falls: 0, treasures: 2, rats: { Ann: { color: '#e8604c', banked: 4 } } });
  assert.equal(c.minutes, 61); assert.equal(daysText(c), 'Days 5–9');
  assert.deepEqual(cardRows(c).map(r => r[0]), ['Minutes played', 'Balls banked', 'Knockdowns', 'Treasures'], 'no deck falls: no row');
  assert.deepEqual(cleanCard(JSON.parse(JSON.stringify(c))), c);
  assert.equal(cleanCard(null), null);
  assert.equal(cleanCard({ rats: [{ name: '<b>', color: 'javascript:1' }] }).rats[0].color, '#fff8ec');
});

// ---- the server ---------------------------------------------------------------------------------------------------
function crewAt(save, { n = 2, code = 'TDAY', seed = 3 } = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew(code, save, { shiftSecs: 120, seed, now: () => clock.t });
  const rats = Array.from({ length: n }, (_, i) => { const p = crew.join('Rat' + i); crew.connect(p); return p; });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, rats, run, clock };
}
const flush = crew => crew.flush().ev;

test('server: the morning deals Today from Muni day 5 (memo line, snapshot chip, report line); none before', () => {
  const { crew, run } = crewAt({ v: 5, day: 4, venue: 0, garyDay: 99 });
  crew.startShift();
  assert.equal(crew.today, null, 'day 4: nothing');
  run(121);
  assert.equal(crew.phase, 'report');
  crew.startShift();   // day 5
  const t = todayFor({ key: crew.todayKey, day: 5, venue: 0, nMats: 99 });
  assert.equal(crew.today?.id, t.id);
  const memo = flush(crew).find(e => e.t === 'memo' && e.day === 5);
  assert.equal(memo.today, todayMemo(crew.today, 0));
  assert.equal(crew.snapshot().today.chip, todayChip(crew.today));
  run(121);
  assert.equal(crew.report.today.id, t.id);
  assert.ok(crew.report.today.line.length > 0);
  assert.ok(crew.report.night && crew.report.night.shifts === 2 && crew.report.night.rats.length === 2, 'the night card rides in every report');
});

test('server: no Today on a Gary day', () => {
  const { crew } = crewAt({ v: 5, day: 7, venue: 0, garyDay: 7 });
  crew.startShift();
  assert.ok(crew.garyToday());
  assert.equal(crew.today, null);
});

test('server: Ball Shortage holds the basket at 6; the celebrity\'s balls bank ×3; rain doubles the scuff', () => {
  const { crew, rats } = crewAt({ v: 5, day: 9, venue: 0, garyDay: 99 });
  crew.startShift();
  crew.today = { id: 'shortage' }; crew.basket.cap = 6;
  crew.basket.n = 6;
  assert.equal(crew.basketFor(rats[0]), 'full');
  // a ×3 ball picked by hand pays three range balls
  const p = rats[0];
  const b = crew.addBall({ x: p.x, y: 0.021, z: p.z, vx: 0, vy: 0, vz: 0, kind: 'range', mul: 3 }); b.rest = true;
  assert.ok(crew.pickup(p, b.id));
  assert.equal(p.pocketW, 3);
  assert.equal(p.shift.picked, 1, 'the night counts picks per Rat');
  assert.equal(mudMul({ id: 'rain' }), 2);
});

test('server: a crew ball that flattens a Rat counts as dealt for its shooter', () => {
  const { crew, rats } = crewAt({ v: 5, day: 3, venue: 0 });
  crew.startShift();
  const [a, b] = rats;
  b.x = 0; b.z = -10;
  crew.addBall({ x: 0, y: 1.0, z: -9.6, vx: 0, vy: 0, vz: -12, kind: 'range', by: a.id });
  for (let i = 0; i < 20 && !b.down; i++) crew.tick(0.05);
  assert.ok(b.down > 0, 'knocked flat');
  assert.equal(a.shift.dealt, 1);
});

test('server: endless contracts: offers at the report, any Rat picks, the morning deals it, stars at the bell', () => {
  const { crew, rats, run } = crewAt({ v: 5, day: 30, venue: 5, endless: true, records: { cash: 50, yesterday: { cash: 50 } } });
  crew.startShift();
  assert.ok(crew.contract, 'the first morning of a loaded endless crew takes the first offer');
  run(121);
  assert.equal(crew.phase, 'report');
  const s = crew.snapshot();
  assert.equal(s.offers.length, 3); assert.equal(s.pick, 0);
  crew.input(rats[1], { a: [{ t: 'contract', i: 2 }] });
  assert.equal(crew.snapshot().pick, 2);
  crew.input(rats[0], { a: [{ t: 'contract', i: 9 }] });
  assert.equal(crew.snapshot().pick, 2, 'junk is ignored');
  const want = s.offers[2];
  crew.startShift();
  assert.deepEqual(crew.contract, want);
  assert.equal(crew.today.id, want.mod.id);
  assert.equal(crew.snapshot().offers, undefined, 'no offers mid-shift');
  // meet it for sure: rewrite the goal to something already true
  crew.contract = { ...crew.contract, goal: { k: 'cash', n: 0 } };
  const was = crew.stars;
  run(121);
  assert.equal(crew.report.contract.met, true);
  assert.equal(crew.stars, was + want.stars);
  assert.equal(crew.report.contract.total, crew.stars);
});

test('server: stars unlock cosmetics; the locker refuses what is locked; looks, paint, stars and the night are saved', () => {
  const { crew, rats } = crewAt({ v: 5, day: 30, venue: 5, endless: true, stars: 10 });   // council round 12 #6d: 3, 8, 13, …
  const [a] = rats;
  crew.input(a, { a: [{ t: 'look', part: 'hat', id: 'hat-teal' }, { t: 'look', part: 'cart', id: 'cart-gold' }, { t: 'look', part: 'vest', id: 'vest-pink' }] });
  assert.deepEqual(crew.looks, { Rat0: { hat: 'hat-teal' } }, 'the vest needs 13 stars');
  assert.equal(crew.cartPaint, 'cart-gold');
  const sp = crew.snapshot();
  assert.deepEqual(sp.players.find(p => p.id === a.id).look, { hat: 'hat-teal' });
  assert.equal(sp.cartPaint, 'cart-gold'); assert.equal(sp.stars, 10);
  crew.input(a, { a: [{ t: 'look', part: 'hat', id: null }] });
  assert.deepEqual(crew.looks, {});
  crew.input(a, { a: [{ t: 'look', part: 'hat', id: 'hat-teal' }] });
  crew.startShift(); crew.contract = null; crew.endShift();
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.equal(save.stars, 10); assert.deepEqual(save.looks, { Rat0: { hat: 'hat-teal' } }); assert.equal(save.cartPaint, 'cart-gold');
  assert.ok(save.night && save.night.rats.length === 2);
  const back = new Crew('TDAY', save, { shiftSecs: 120, seed: 3 });
  assert.equal(back.stars, 10); assert.deepEqual(back.looks, { Rat0: { hat: 'hat-teal' } }); assert.equal(back.cartPaint, 'cart-gold');
  // "Previously on Range Rat": the welcome carries the saved card until this session's first bell
  const p = back.join('Rat0');
  const w = back.welcome(p.id);
  assert.equal(w.previously.rats.length, 2);
  assert.ok('next' in w.previously);
  back.startShift(); back.endShift();
  assert.equal(back.welcome(p.id).previously, undefined, 'after a bell this session, the card is tonight\'s');
  // a tampered save cannot wear what it has not earned
  assert.equal(new Crew('TDAY', { ...save, stars: 5 }).cartPaint, null);
});

test('server: League Night from Tiered runs the deck order clock twice as fast', () => {
  const { crew } = crewAt({ v: 5, day: 20, venue: 2, venueDay: 3 }, { n: 1 });
  crew.startShift();
  crew.revealT = 0;
  const dk = () => crew.mods.state('deck').deck;
  const step = secs => { const t0 = dk().orderT ?? 0; dk().order = null; for (let i = 0; i < secs * 20; i++) crew.tick(0.05); return (dk().orderT ?? 0) - t0; };
  crew.today = null;
  const plain = step(1);
  crew.today = { id: 'league' };
  const league = step(1);
  assert.ok(Math.abs(plain - 1) < 0.06, 'plain: 1 s a second (' + plain + ')');
  assert.ok(Math.abs(league - 2) < 0.12, 'league: 2 s a second (' + league + ')');
});
