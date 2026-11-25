// Round 11, builder "pacing": the end of the day (taper, glow, two-minute cleanup), SPOTLESS RANGE, Promotion Day,
// the solo Gary morning, the late cards' 2× and the ✦ rewards. Pure modules first, then the real Crew.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { LAST_CALL, CLEANUP, GARY } from '../web/js/sim.js';
import { endScale, endWindows, taperK, taperBays, taperRate, spotlessBonus, spotlessRow, SPOTLESS } from '../web/js/dayend.js';
import { isPromotionDay, promoDue, promoQ, promoStrip, newRide, stepRide, PROMO_DAY } from '../web/js/promoday.js';
import { CARDS, reviewsNeed, rewardFor, REWARD_BV, GOALS } from '../web/js/goals.js';
import { PA_LINES } from '../web/js/pa.js';

const words = s => s.split(/\s+/).filter(Boolean).length;
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

// ---- dayend.js -------------------------------------------------------------------------------------------------------
test('the end of the day: taper at T-3:00, glow at T-2:30, the last customer out at T-2:00 (full shift)', () => {
  assert.deepEqual(endWindows(420), { taper: 180, glow: 150, cleanup: 120 });
  assert.equal(LAST_CALL.TAPER, 180); assert.equal(LAST_CALL.SECS, 150); assert.equal(CLEANUP, 120);
  const w = endWindows(360);                                   // day 2: scaled, so it keeps its hitting time
  near(w.taper, 180 * 360 / 420); near(w.cleanup, 120 * 360 / 420);
  assert.ok(360 - w.taper > 200, 'day 2 still hits for over 200 s');
  assert.equal(endScale(900), 1, 'a long test shift keeps the full windows');
  assert.equal(taperK(0, 420), 1); assert.equal(taperK(420 - 180, 420), 1);
  near(taperK(420 - 150, 420), 0.5); assert.equal(taperK(420 - 120, 420), 0); assert.equal(taperK(419, 420), 0);
  let last = 1;                                               // smooth: never rises, no step bigger than a tick's worth
  for (let t = 230; t <= 310; t += 0.5) { const k = taperK(t, 420); assert.ok(k <= last + 1e-12 && last - k < 0.01); last = k; }
});

test('taperBays and taperRate fall smoothly to none / MIN_RATE', () => {
  assert.equal(taperBays(10, 1), 10); assert.equal(taperBays(10, 0.95), 10); assert.equal(taperBays(10, 0.5), 5);
  assert.equal(taperBays(10, 0.01), 1, 'one bay just before the cleanup'); assert.equal(taperBays(10, 0), 0);
  assert.equal(taperBays(2, 0.3), 1);
  assert.equal(taperRate(1), 1); assert.equal(taperRate(0), LAST_CALL.MIN_RATE); near(taperRate(0.5), 0.75);
});

test('SPOTLESS RANGE: none left pays 0.75 of a goal reward; nearly (≤2%, ≤12) 0.3; a dead day nothing', () => {
  const r = 1000;
  assert.deepEqual(spotlessBonus({ left: 0, launched: 400, reward: r }), { kind: 'spotless', left: 0, cash: 750 });
  assert.deepEqual(spotlessBonus({ left: 8, launched: 400, reward: r }), { kind: 'nearly', left: 8, cash: 300 });
  assert.equal(spotlessBonus({ left: 9, launched: 400, reward: r }), null, 'over 2%');
  assert.equal(spotlessBonus({ left: 13, launched: 5000, reward: r }), null, 'over NEAR_MAX');
  assert.equal(spotlessBonus({ left: 0, launched: SPOTLESS.MIN - 1, reward: r }), null, 'too few balls to count');
  assert.equal(spotlessBonus({ left: 0, launched: 400, reward: 0 }), null);
  const m = v => '$' + v.toLocaleString('en-US');
  assert.equal(spotlessRow({ kind: 'spotless', left: 0, cash: 1450 }, m), 'SPOTLESS RANGE! +$1,450');
  assert.equal(spotlessRow({ kind: 'nearly', left: 3, cash: 580 }, m), 'Nearly spotless: 3 left. +$580');
  for (const s of [{ kind: 'spotless', left: 0, cash: 12345678 }, { kind: 'nearly', left: 12, cash: 12345678 }]) assert.ok(words(spotlessRow(s, m)) <= 8);
});

// ---- promoday.js -----------------------------------------------------------------------------------------------------
const row = (id, kind, have, need, done) => ({ id, kind, have, need, done });
test('promoDue: one good day short and every other goal done (the live fee too)', () => {
  const card = (rev, fee = true, other = true) => [row('laps', 'count', 12, 12, other), row('pings', 'count', 12, 12, true), row('cart2', 'buy', 1, 1, true),
    row('reviews', 'reviews', rev, 2, rev >= 2), row('fee', 'fee', 1, 1, fee)];
  assert.equal(promoDue(card(1)), true);
  assert.equal(promoDue(card(0)), false, 'two short');
  assert.equal(promoDue(card(2)), false, 'done: the card signs as usual');
  assert.equal(promoDue(card(1, false)), false, 'the fee still short');
  assert.equal(promoDue(card(1, true, false)), false, 'a feature goal open');
  assert.equal(promoDue([row('lift', 'riders', 1, 1, true), row('sky', 'sky', 0, 1, false)]), false, 'the Orbital: no review');
  assert.equal(promoDue([]), false);
});

test('promoQ: +10 points of the bar the first try, capped at 90%, the regular target after', () => {
  near(promoQ(0.3, 1.5, 0), 0.35);                             // Muni: 60% -> 70%
  near(promoQ(0.3, 1.5, 1), 0.3);
  near(promoQ(0.42, 1.5, 0), 0.45, 1e-12);                      // 84% -> 90% (the cap)
  near(promoQ(0.47, 1.5, 0), 0.47, 1e-12);                      // already over the cap: never lower
  near(promoQ(0.7, 3, 0), 0.9);                                 // Tiered (ceiling 3): 35% -> 45%
  assert.equal(promoQ(null, 1.5, 0), null);
});

test('Promotion Day words: the memo, the tomorrow lines, the strip, the PA caption', () => {
  assert.equal(PROMO_DAY.MEMO, 'Promotion Day. Regional is watching.');
  for (const s of [PROMO_DAY.MEMO, PROMO_DAY.TOMORROW, PROMO_DAY.AGAIN, PA_LINES.promoday.caption]) assert.ok(words(s) <= 8, s);
  const s = promoStrip({ pips: [true, true, true, false, true], label: '4 OF 5 GOALS', next: 'NEXT: ONE MORE GOOD DAY' });
  assert.equal(s.label, 'PROMOTION DAY'); assert.equal(s.next, PROMO_DAY.NEXT); assert.deepEqual(s.pips, [true, true, true, false, true]);
  assert.equal(isPromotionDay({ day: 9, promoDay: 9 }), true);
  assert.equal(isPromotionDay({ day: 9, promoDay: 8 }), false);
  assert.equal(isPromotionDay({ day: 9, promoDay: 9, endless: true }), false);
  assert.equal(isPromotionDay(null), false);
});

test('the ride-along loops behind the fence for ever, lifting the clipboard each lap', () => {
  const r = newRide();
  let waves = 0, maxZ = -Infinity, minZ = Infinity;
  for (let i = 0; i < 20 * 600; i++) { if (stepRide(r, 0.05) === 'wave') waves++; maxZ = Math.max(maxZ, r.z); minZ = Math.min(minZ, r.z); }
  assert.ok(waves >= 4, `${waves} waves in 10 minutes`);
  assert.ok(minZ >= 12 && maxZ <= 13.01, 'stays behind the fence (z 9)');
  const from = newRide({ x: 26, z: 10 });
  assert.equal(from.x, 26); assert.equal(from.z, 10);
});

// ---- the cards -------------------------------------------------------------------------------------------------------
test('expert #1: the Stadium and the County need 2 good days; laps 12 and strays 85 at 4P', () => {
  assert.equal(reviewsNeed(3), 2); assert.equal(reviewsNeed(4), 2);
  assert.equal(reviewsNeed(1), 3); assert.equal(reviewsNeed(2), 3); assert.equal(reviewsNeed(0), 2);
  assert.equal(GOALS.laps.n, 12); assert.equal(GOALS.strays.n, 85); assert.equal(GOALS.bank.n, 2000);
  assert.ok(CARDS[3].some(g => g.id === 'laps'));
});

test('expert #5.3: the ✦ reward grows with the venue and the crew', () => {
  assert.equal(REWARD_BV.length, 6);
  assert.equal(rewardFor(100, 3, 4), 18000);
  assert.ok(rewardFor(100, 3, 1) < rewardFor(100, 3, 2) && rewardFor(100, 3, 2) < rewardFor(100, 3, 4));
  assert.equal(rewardFor(0, 2, 4), 0);
});

// ---- the real Crew ---------------------------------------------------------------------------------------------------
function crewAt(save, n = 1, shiftSecs = undefined) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('PACE', save, { seed: 7, now: () => clock.t, ...(shiftSecs ? { shiftSecs } : {}) });
  const ps = Array.from({ length: n }, (_, i) => { const p = crew.join('R' + i); crew.connect(p); return p; });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; if (crew.basket) crew.basket.n = 12; for (const p of ps) { p.seenAt = clock.t; } crew.tick(0.05); } };   // someone keeps the basket stocked
  return { crew, ps, run, clock };
}

test('the taper: the busy bays fall from T-3:00 and none are open in the cleanup', () => {
  const { crew, run } = crewAt({ day: 5 }, 4);
  crew.startShift();
  crew.shiftT = 420 - 185; run(1);
  const open = () => crew.mats.filter(m => m.st === 'playing' || m.inc).length;
  const full = open();
  crew.shiftT = 420 - 140; run(6);
  const mid = open();
  crew.shiftT = 420 - 115; run(8);
  assert.ok(full >= 4, `${full} busy at T-3:05`);
  assert.ok(mid < full, `${mid} < ${full} in the taper`);
  assert.equal(open(), 0, 'nobody on a mat in the cleanup');
  assert.equal(crew.closing(), true);
});

test('solo Gary morning: the sign and the cart start at his pass line, with a 90 s warning', () => {
  const { crew } = crewAt({ day: 6, garyDay: 7, up: { cart: 1 } }, 1);
  crew.startShift();
  crew.carts[0].mud = 1;
  crew.phase = 'report'; crew.startShift();
  assert.equal(crew.day, 7); assert.ok(crew.garyToday());
  assert.equal(crew.fixtures.sign, GARY.SOLO_START);
  assert.equal(crew.carts[0].mud, GARY.SOLO_START);
  assert.equal(GARY.SOLO_WARN, 90);
  const duo = crewAt({ day: 6, garyDay: 7 }, 2).crew;
  duo.startShift(); duo.phase = 'report'; duo.startShift();
  assert.ok(duo.fixtures.sign > GARY.SOLO_START, 'a crew of 2 gets the usual morning');
});

// A Stadium crew one good day short with every other goal done.
function oneShort(n = 2) {
  const save = { v: 5, day: 30, venue: 3, venueDay: 3, cash: 1e9, up: { cart: 3, shed: 1 }, garyDay: 99 };
  const c = crewAt(save, n);
  c.crew.startShift();
  const g = c.crew.goals;
  g.n.laps = 99; g.n.pings = 99; g.n.reviews = 1; c.crew.goalScan();
  return c;
}

test('Promotion Day is dealt at the bell, and the next morning is one: memo, strip, Gary, +10 points', () => {
  const { crew } = oneShort();
  assert.equal(crew.promoInfo().ready, false);
  crew.quota = { q: 99 };                         // today's bell misses: still one short
  crew.endShift();
  assert.equal(crew.promoDay, crew.day + 1);
  assert.equal(crew.report.tomorrow, PROMO_DAY.TOMORROW);
  crew.flush();
  crew.startShift();
  assert.equal(isPromotionDay(crew), true);
  const ev = crew.flush().ev;
  const memo = ev.find(e => e.t === 'memo');
  assert.equal(memo.text, PROMO_DAY.MEMO); assert.equal(memo.promoDay, true);
  assert.equal(crew.garyToday(), true, 'Gary inspects today');
  assert.equal(crew.snapshot().goals.strip.label, 'PROMOTION DAY');
  const base = crew.ceiling() - 1;
  assert.ok(crew.quota.q > 0 && crew.quota.q <= 0.9 * base + 1e-9);
  assert.equal(crew.toSave?.().promoDay ?? crew.promoDay, crew.day);
});

test('Promotion Day passed at the bell signs on the spot: a promoday event, the PA, promoted', () => {
  const { crew } = oneShort();
  crew.quota = { q: 99 }; crew.endShift(); crew.flush(); crew.startShift(); crew.flush();
  crew.quota = { q: 0 };                          // an easy bell
  crew.bank(50, crew.online()[0].id);
  const venue = crew.venue;
  crew.endShift();
  const ev = crew.flush().ev;
  const pd = ev.find(e => e.t === 'promoday');
  assert.ok(pd?.pass, 'passed');
  assert.ok(ev.find(e => e.t === 'pa' && e.id === 'promoday'));
  assert.ok(ev.find(e => e.t === 'promoted'));
  assert.equal(crew.venue, venue + 1);
  assert.equal(crew.promoDay, null);
});

test('Promotion Day failed comes again tomorrow at the regular target', () => {
  const { crew } = oneShort();
  crew.quota = { q: 99 }; crew.endShift(); crew.flush(); crew.startShift(); crew.flush();
  const q1 = crew.quota.q;
  crew.quota = { q: 99 }; crew.endShift();
  const ev = crew.flush().ev;
  assert.equal(ev.find(e => e.t === 'promoday')?.pass, false);
  assert.equal(crew.promoDay, crew.day + 1);
  assert.equal(crew.report.tomorrow, PROMO_DAY.AGAIN);
  crew.startShift();
  assert.equal(isPromotionDay(crew), true);
  assert.equal(crew.promoTries(), 1);
  assert.ok(crew.quota.q <= q1, 'the second try drops the extra 10 points');
});

test('SPOTLESS RANGE at the bell: an empty field after a real day pays, and the report says so', () => {
  const { crew, run } = crewAt({ day: 5 }, 2, 120);
  crew.startShift();
  run(110);
  assert.ok((crew.stats.launched ?? 0) >= SPOTLESS.MIN, `${crew.stats.launched} customer balls`);
  for (const [id, b] of [...crew.balls]) if (!b.sunk) crew.balls.delete(id);   // the crew swept it all
  const cash0 = crew.cash;
  run(11);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.report.spotless?.kind, 'spotless');
  assert.ok(crew.cash >= cash0 + crew.report.spotless.cash - 1e-6);
});

test('a card with a Gary goal: after a promotion he comes on the new venue\'s second morning at the latest', () => {
  const { crew } = crewAt({ v: 5, day: 20, venue: 4, venueDay: 0, pendingReveal: 4, garyDay: 40, cash: 1e6 }, 2);
  crew.startShift();
  assert.equal(crew.garyDay, crew.day + 1, 'the County prints "Pass Gary\'s inspection"');
  const t = crewAt({ v: 5, day: 20, venue: 2, venueDay: 0, pendingReveal: 2, garyDay: 40, cash: 1e6 }, 2).crew;
  t.startShift();
  assert.equal(t.garyDay, 40, 'Tiered has no Gary goal: his schedule stands');
});

test('final pass: the busier day (DAY_RATE) only on days with an end of day; the tube posts block the cart when owned', async () => {
  const { swingRate } = await import('../web/js/dayend.js');
  assert.equal(swingRate(1, 1), 1, 'day 1 keeps the plain rate');
  assert.equal(swingRate(1, 3), LAST_CALL.DAY_RATE);
  near(swingRate(0, 3), LAST_CALL.DAY_RATE * LAST_CALL.MIN_RATE);
  const { TUBE_POSTS } = await import('../web/js/layout.js');
  const { cartBlocked } = await import('../web/js/map.js');
  const p = TUBE_POSTS.find(q => q.tier === 1 && Math.abs(q.x - 50) < 0.01);
  assert.ok(p, 'a trunk post on x 50');
  assert.equal(cartBlocked(p.x, p.z, { venue: 3, ret: 0 }), false, 'not owned: no tube, no post');
  assert.equal(cartBlocked(p.x + 0.5, p.z, { venue: 3, ret: 1 }), true, 'owned: the post blocks the cart');
  assert.equal(cartBlocked(p.x, p.z + 4.5, { venue: 3, ret: 1 }), false, 'the cart fits between posts');
  const b = TUBE_POSTS.find(q => q.tier === 2);
  assert.equal(cartBlocked(b.x, b.z, { venue: 3, ret: 1 }), false, 'the Back branch needs tier 2');
  assert.equal(cartBlocked(b.x, b.z, { venue: 3, ret: 2 }), true);
});
