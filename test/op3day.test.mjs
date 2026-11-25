// Owner playtest 3, builder 2: the day itself. §2 the cleanup minute, §3.1 mats overnight, §3.2 customers pick a clean
// mat, §3.3 the bucket basket, §3.4 the morning deal. (Last Call's own tests are in council.test.mjs, the T-60 gauge in
// tiered.test.mjs, the cleanup deal's margin in playtest3a.test.mjs.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { CUST, newMat, stepMat, pickMat } from '../web/js/customers.js';
import { MATS, BUCKETS, MAT_NIGHT_CAP, mulberry32 } from '../web/js/sim.js';
import { FILL_POINT, BASKET_POINT, DISPENSER, BASKET_SLOTS } from '../web/js/layout.js';
import { newBasket, holdFill, stepBasket, takeBucket, FILL_REACH, siloFill } from '../web/js/basket.js';
import { MORNING_TEXT, morningJobs, dealMorning, morningPool } from '../web/js/morning.js';
import { RALLY_LINES, RALLY_PICK, shortfalls } from '../web/js/rally.js';
import { nudgeLine, nudgeTarget } from '../web/js/nudge.js';
import { wordCount } from '../web/js/say.js';

function makeCrew(save = null, n = 1, shiftSecs = 600, seed = 5) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('OP3D', { voiced: ['welcome', 'gary'], ...save }, { shiftSecs, seed, now: () => clock.t });
  const rats = [];
  for (let i = 0; i < n; i++) { const p = crew.join('R' + i); crew.connect(p); rats.push(p); }
  const run = secs => { for (let i = 0; i < secs * 20 - 1e-9; i++) { clock.t += 50; for (const p of rats) { p.seenAt = clock.t; p.movedAt = clock.t; } crew.tick(0.05); } };
  return { crew, rats, run, clock };
}
const nudges = crew => crew.snapshot().mods?.nudge ?? {};

// ---- §3.2: pickMat ----------------------------------------------------------------------------------------------------
test('§3.2 pickMat: never a muddy (>= 0.9) mat while a cleaner free one exists; the triggering one when all are', () => {
  const mats = MATS.map(m => newMat(m.i));
  const mud = { 0: 0.95, 1: 0.2, 2: 0.95 };
  const ctx = r => ({ rng: () => r, now: 0, mudOf: i => mud[i] ?? 0.95, isOpen: i => i < 3 });
  for (const r of [0, 0.3, 0.6, 0.99]) assert.equal(pickMat(mats, 0, ctx(r)).i, 1, 'r ' + r);
  mud[1] = 0.92;
  assert.equal(pickMat(mats, 0, ctx(0.5)).i, 0, 'every free mat is muddy: the triggering one');
  mud[1] = 0.2; mats[1].inc = { cust: 1, look: 1, t0: 0 };
  assert.equal(pickMat(mats, 2, ctx(0.5)), null, 'a mat with someone incoming is not free; a clean mat is open: nobody comes to the muddy bay');
  mats[1].inc = null; Object.assign(mats[1], { st: 'playing', balls: 30, t0: 0 });
  assert.equal(pickMat(mats, 0, ctx(0.5)), null, 'the clean mat is busy: the muddy bay stays empty');
  Object.assign(mats[1], newMat(1));
  mats[1].inc = null; mud[0] = 0; mud[1] = 0.5;
  let seen0 = 0, seen1 = 0;
  const rng = mulberry32(3);
  for (let k = 0; k < 2000; k++) { const i = pickMat(mats, 0, { rng, now: 0, mudOf: i => mud[i] ?? 0.95, isOpen: i => i < 2 }).i; if (i === 0) seen0++; else seen1++; }
  assert.ok(Math.abs(seen0 / 2000 - 2 / 3) < 0.05, 'weighted 1 - mud: ' + seen0 + ' / ' + seen1);
});

test('§3.2 a crew\'s arriving customers skip the muddy bay while a clean one is free', () => {
  const { crew, run } = makeCrew({ day: 3, fixtures: { mat0: 0.95 } }, 1);
  crew.startShift();
  crew.fixtures.mat0 = 0.95;
  for (const m of crew.mats) Object.assign(m, newMat(m.i));   // nobody seated: every open mat is free at once
  const arrive = [];
  for (let i = 0; i < 20; i++) { crew.basket.n = 12; run(0.05); for (const e of crew.events) if (e.t === 'custwait') arrive.push(e.mat); crew.flush(); }
  assert.ok(crew.mats.filter(m => m.inc).length >= 5, 'the free mats call their customers');
  assert.equal(crew.mats[0].inc, null, 'the muddy bay stays empty');
});

// ---- §3.3: the basket ------------------------------------------------------------------------------------------------
const basketCtx = (b, o = {}) => ({ rng: mulberry32(1), venue: 0, mud: 0, takeBucket: () => takeBucket(b), ...o });
test('§3.3 a customer at an empty basket waits 25 s there, then refuses (why: nobucket); one bucket lets exactly one through', () => {
  const b = newBasket();
  const m = newMat(3);
  const ev = [];
  for (let t = 0; t <= 80; t += 0.25) ev.push(...stepMat(m, 0.25, { ...basketCtx(b), now: t }));
  const ref = ev.filter(e => e.t === 'refuse');
  assert.ok(ref.length >= 1 && ref.every(e => e.why === 'nobucket'), 'refused for want of a bucket');
  assert.equal(ev.filter(e => e.t === 'start').length, 0, 'nobody seated without a bucket');
  const firstArrive = ev.find(e => e.t === 'arrive');
  assert.ok(firstArrive);
  // One bucket, two customers walking in: one gets it, the other waits.
  const b2 = { ...newBasket(), n: 1 };
  const m1 = newMat(1), m2 = newMat(2), all = [];
  for (let t = 0; t <= 60; t += 0.25) for (const mm of [m1, m2]) all.push(...stepMat(mm, 0.25, { ...basketCtx(b2), now: t }));
  assert.equal(all.filter(e => e.t === 'start').length, 1, 'exactly one through');
  assert.equal(b2.n, 0);
  assert.equal(all.filter(e => e.t === 'refuse' && e.why === 'nobucket').length, 1, 'the other waited at the basket and left');
});

test('§3.3 filling: a 1.5 s hold drops one in, two chutes, a third is busy, walking off stops it, the basket holds 12', () => {
  const b = newBasket();
  const at = { x: FILL_POINT.x, z: FILL_POINT.z }, far = { x: 0, z: 0 };
  assert.equal(holdFill(b, 'a', true, at), 'ok');
  assert.equal(holdFill(b, 'b', true, at), 'ok');
  assert.equal(holdFill(b, 'c', true, at), 'busy');
  assert.equal(holdFill(b, 'd', true, far), 'far');
  const where = { a: at, b: at };
  let ev = [];
  for (let i = 0; i < 29; i++) ev.push(...stepBasket(b, 0.05, { where: id => where[id] }));
  assert.equal(b.n, 0, 'not yet at 1.45 s');
  ev.push(...stepBasket(b, 0.05, { where: id => where[id] }));
  assert.equal(b.n, 2, 'one each at 1.5 s');
  assert.deepEqual(ev.map(e => e.by).sort(), ['a', 'b']);
  where.b = far; stepBasket(b, 0.1, { where: id => where[id] });
  assert.ok(!('b' in b.fill), 'walked off: the chute is free');
  for (let i = 0; i < 400; i++) stepBasket(b, 0.05, { where: id => where[id] });
  assert.equal(b.n, BUCKETS.BASKET, 'full at 12');
  assert.equal(holdFill(b, 'c', true, at), 'full');
  assert.equal(siloFill(100, 2), 440);
});

test('§3.3 the Bucket machine adds one every 10 s up to 12; the crew\'s basket is empty every morning', () => {
  const b = newBasket();
  for (let i = 0; i < 199; i++) stepBasket(b, 0.05, { machine: true });
  assert.equal(b.n, 0);
  stepBasket(b, 0.05, { machine: true });
  assert.equal(b.n, 1);
  for (let i = 0; i < 3000; i++) stepBasket(b, 0.05, { machine: true });
  assert.equal(b.n, 12);
  const { crew, rats: [a], run } = makeCrew({ day: 3, venue: 1, venueDay: 2, up: { bucket: 1 } });
  crew.startShift();
  assert.equal(crew.snapshot().basket, 0, 'empty at 0:00');
  crew.basket.n = 7; crew.endShift(); crew.startShift();
  assert.equal(crew.basket.n, 0, 'the night crew doesn\'t do buckets');
  for (const m of crew.mats) m.next = 1e9;
  run(10.2);
  assert.ok(crew.basket.n >= 1, 'the machine works the shift');
  a.x = FILL_POINT.x; a.z = FILL_POINT.z;
});

test('§3.3 the crew: hold Use at the fill point, a third Rat gets fillbusy, the snapshot carries basket and filling', () => {
  const { crew, rats, run } = makeCrew({ day: 3 }, 3);
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  for (const p of rats) { p.x = FILL_POINT.x; p.z = FILL_POINT.z; }
  crew.flush();
  for (const p of rats) crew.input(p, { a: [{ t: 'fill', on: true }] });
  assert.ok(crew.events.some(e => e.t === 'fillbusy' && e.id === rats[2].id));
  assert.equal(crew.snapshot().filling.length, 2);
  run(1.55);
  assert.equal(crew.snapshot().basket, 2);
  crew.input(rats[0], { a: [{ t: 'fill', on: false }] });
  assert.equal(crew.snapshot().filling.length, 1);
});

test('§3.3 layout: FILL_POINT is within reach of the dispenser and 1 m or more from the customers\' spot', () => {
  assert.ok(Math.hypot(FILL_POINT.x - DISPENSER.x, FILL_POINT.z - DISPENSER.z) <= 1.5, 'by the dispenser');
  assert.ok(Math.hypot(FILL_POINT.x - BASKET_POINT.x, FILL_POINT.z - BASKET_POINT.z) >= 1, 'clear of BASKET_POINT');
  assert.ok(FILL_REACH >= 1);
  assert.equal(BASKET_SLOTS.length, BUCKETS.BASKET);
  for (const s of BASKET_SLOTS) assert.ok(Math.hypot(s.x - BASKET_POINT.x, s.z - BASKET_POINT.z) > 0.5, 'the heap is off the customers\' spot');
});

// ---- §3.1: mats overnight and the save ------------------------------------------------------------------------------
test('§3.1 fixtures survive toSave / load, capped at MAT_NIGHT_CAP in the morning; day 1\'s mats are 0', () => {
  const { crew } = makeCrew({ day: 4 });
  crew.startShift();
  crew.fixtures.mat1 = 0.3; crew.fixtures.mat4 = 0.97;
  crew.endShift();
  const back = new Crew('OP3D', JSON.parse(JSON.stringify(crew.toSave())), { shiftSecs: 600, seed: 1, now: () => 1 });
  back.startShift();
  assert.equal(back.day, 5);
  assert.equal(back.fixtures.mat1, 0.3);
  assert.equal(back.fixtures.mat4, MAT_NIGHT_CAP);
  assert.equal(back.fixtures.sign, 0.9); assert.equal(back.fixtures.stand, 0.5);
  const d1 = makeCrew(null).crew; d1.startShift();
  assert.ok(Object.entries(d1.fixtures).filter(([k]) => k.startsWith('mat')).every(([, v]) => v === 0));
});

// ---- §2: the cleanup deal ---------------------------------------------------------------------------------------------
test('§2 the cleanup deal: margin 0, and "Grab the last balls!" over RALLY_PICK balls out there', () => {
  assert.equal(RALLY_LINES.pick, 'Grab the last balls!');
  const value = { bv: 1.2, rate: 1, curb: 0.6, pond: null, fries: null };
  const jobs = shortfalls({ value, quota: { q: 0.3 }, fixtures: { sign: 0, mat0: 0.9 }, left: RALLY_PICK + 1 });
  assert.deepEqual(jobs.map(j => j.id), ['mats', 'pick']);
  assert.deepEqual(shortfalls({ value, quota: { q: 0.3 }, fixtures: { sign: 0, mat0: 0.9 }, left: RALLY_PICK }).map(j => j.id), ['mats']);
  const { crew } = makeCrew({ day: 4 }, 2);
  crew.startShift();
  crew.valueNow = () => ({ bv: 1.6, rate: 1, curb: 1, pond: null, fries: null });   // on target
  crew.ballsLeft = () => 40;
  const r = crew.recheckNeeds();
  assert.equal(r.need, RALLY_LINES.pick);
  assert.deepEqual(Object.values(r.needs), [RALLY_LINES.pick, RALLY_LINES.pick]);
  crew.ballsLeft = () => 10;
  assert.equal(crew.recheckNeeds().need, RALLY_LINES.onTarget);
});

// ---- §3.4: the morning deal ------------------------------------------------------------------------------------------
test('§3.4 the morning deal: 4 different lines to 4 Rats at the Muni day 3 with a dirty sign and an empty basket', () => {
  const { crew, rats } = makeCrew({ day: 3, fixtures: { mat2: 0.5 } }, 4);
  rats.forEach((p, i) => { p.x = 18 + i * 2.4; p.z = 4; });
  crew.startShift();
  const n = nudges(crew);
  const lines = rats.map(p => n[p.id]);
  assert.deepEqual([...new Set(lines)].sort(), ['am:basket', 'am:mats', 'am:sign', 'am:stand']);
  for (const l of lines) assert.ok(nudgeLine(l) && nudgeTarget(l, false, { x: 0, z: 0 }), l);
});

test('§3.4 a job done clears its line; the rest go after 45 s of working time; day 1 has none', () => {
  const { crew, rats, run } = makeCrew({ day: 3 }, 2);
  crew.goals?.done.push('bank', 'washer', 'huddle');   // playthrough 5 B1: at 2P one Rat takes the card's goal; this test is about the jobs
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  const n0 = nudges(crew);
  const sign = rats.find(p => n0[p.id] === 'am:sign');
  assert.ok(sign, 'someone hoses the sign');
  crew.fixtures.sign = 0.05; run(0.1);
  assert.equal(nudges(crew)[sign.id], undefined, 'hosed: done');
  run(56);
  assert.deepEqual(nudges(crew), {}, 'the morning is over');
  const d1 = makeCrew(null, 2).crew; d1.startShift();
  assert.deepEqual(nudges(d1), {}, 'day 1: the checklist');
});

test('§3.4 the Stadium deals the lap line; with the machine, no basket line once the basket reaches 12', () => {
  const { crew } = makeCrew({ day: 30, venue: 3, venueDay: 3, up: { bucket: 1 } }, 1);
  crew.startShift();
  assert.ok(morningPool(3).includes('crowd'));
  const jobs = morningJobs({ venue: 3, basket: 0, fixtures: {}, crowd: 0.5 });
  assert.ok(jobs.includes('crowd') && jobs.includes('basket'));
  const solo = makeCrew({ day: 30, venue: 3, venueDay: 3 }, 1);
  solo.rats[0].x = 0; solo.rats[0].z = -40;             // nearest the Track
  solo.crew.basket.n = 12;
  solo.crew.startShift(); solo.crew.basket.n = 12;
  assert.deepEqual(dealMorning(morningJobs({ venue: 3, basket: 12, fixtures: {}, crowd: 0.5 }), [{ id: 'x', x: 0, z: -40 }]), { x: 'crowd' });
  assert.ok(!morningJobs({ venue: 1, basket: 12, fixtures: {} }).includes('basket'), 'a full basket is not short');
  assert.ok(crew);
});

test('§3.4 / §8 every new line is short', () => {
  for (const l of Object.values(MORNING_TEXT)) assert.ok(wordCount(l) <= 7, l);
  assert.ok(wordCount(RALLY_LINES.pick) <= 8);
});
