// Council round 10 #2: food that clearly pays. FED (hot dogs), the fry basket's money, the menu cards, the Club's dusk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FED, FRIES, VENUE_RULES, SHOP_BY_ID, payFor, ballValue, perks } from '../web/js/sim.js';
import { newFed, fedServe, fedTick, fedRing, fedShare, fedChip, fedHud, basketValue, friesServeValue } from '../web/js/food.js';
import { yieldFor, menuPayoff, serveFloat } from '../web/js/menu.js';
import { clubDuskJobs, RALLY_LINES } from '../web/js/rally.js';
import { Crew } from '../server/crew.mjs';

test('the constants are the council\'s', () => {
  assert.deepEqual(FED, { GOOD: 0.05, PERFECT: 0.10, MAX: 1.25, DECAY: 0.05, EVERY: 20 });
  for (let v = 1; v <= 5; v++) assert.equal(VENUE_RULES[v].eatEvery, 8, VENUE_RULES[v].name);
  assert.equal(SHOP_BY_ID.shed.tiers[1].desc, 'Reopens the shed. Fries raise what every ball pays.');
});

test('a dog lifts FED by 0.05 / 0.10, it caps at 1.25, and decays 0.05 per 20 s of working time', () => {
  const st = newFed();
  assert.equal(fedServe(st, 'good'), 0.05); assert.equal(st.fed, 1.05);
  assert.equal(fedServe(st, 'perfect'), 0.1); assert.equal(st.fed, 1.15);
  assert.equal(fedServe(st, 'burnt'), 0);
  fedServe(st, 'perfect'); assert.equal(fedServe(st, 'perfect'), 0, 'at the cap'); assert.equal(st.fed, FED.MAX);
  fedTick(st, 19.9); assert.equal(st.fed, 1.25);
  assert.ok(fedRing(st) < 0.01);
  fedTick(st, 0.2); assert.equal(st.fed, 1.2, 'one loss at 20 s');
  fedTick(st, 80); assert.equal(st.fed, 1, 'four more and it is gone');
  assert.equal(fedRing(st), 0); assert.equal(fedChip(1), null); assert.equal(fedChip(1.2), '×1.20 FED'); assert.equal(fedHud(1.2), ' · ×1.2 fed');
});

test('a dog adds 0 baskets; FED is a factor past Hustle that Upkeep never sees', () => {
  assert.equal(yieldFor('hotdog', 'perfect'), 0); assert.equal(yieldFor('hotdog', 'good'), 0);
  const v = ballValue({ perks: perks({}), mult: 2, curb: 1, venue: 1 });
  assert.equal(payFor(10, v, 1.2), Math.round(10 * v.bv * 2 * 1.2 * 100) / 100);
  assert.equal(fedShare(120, 1.2), 20);
});

function makeCrew(save = { venue: 1, day: 6, venueDay: 1, up: { shed: 1 } }) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('FOOD', save, { shiftSecs: 600, seed: 3, now: () => clock.t });
  const run = secs => { for (let i = 0; i < Math.round(secs * 20); i++) { clock.t += 50; crew.tick(0.05); } };
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  crew.flush();
  const p = crew.join('Cook'); crew.connect(p); p.x = FRIES.SHED.x; p.z = FRIES.SHED.z;
  return { crew, clock, run, p };
}
const serve = (m, item, quality) => { m.clock.t += 5000; m.crew.input(m.p, { a: [{ t: 'serve', item, quality }] }); };

test('server: a served dog FEDs the crew, banking pays × fed, the report counts it, and the morning resets it', () => {
  const m = makeCrew();
  const v0 = m.crew.valueNow();
  assert.equal(v0.fed, undefined, 'no fed key until a dog');
  serve(m, 'hotdog', 'perfect');
  assert.equal(m.crew.fedSt.fed, 1.1);
  const ev = m.crew.flush().ev.find(e => e.t === 'served');
  assert.equal(ev.n, 0, 'no fry baskets'); assert.equal(ev.fed, 1.1); assert.equal(ev.float, '+10% a ball');
  const v = m.crew.valueNow();
  assert.equal(v.fed, 1.1); assert.equal(v.upkeep, v0.upkeep, 'Upkeep never sees FED');
  const cash0 = m.crew.cash;
  m.crew.bank(10, m.p.id, 'helper', 10, 1);
  assert.ok(Math.abs((m.crew.cash - cash0) - payFor(10, v, 1.1)) < 0.02);
  assert.ok(m.crew.stats.fedCash > 0);
  m.run(21); assert.equal(m.crew.fedSt.fed, 1.05, 'wears off on working time');
  m.crew.phase = 'report'; m.crew.startShift(); assert.equal(m.crew.fedSt.fed, 1, 'reset each morning');
});

test("server: Gary's dog gives no FED", () => {
  const m = makeCrew();
  m.crew.gary = { phase: 'warn', checks: [], fed: false };
  serve(m, 'hotdog', 'good');
  assert.equal(m.crew.gary.fed, true); assert.equal(m.crew.fedSt.fed, 1);
});

test('the menu cards print the payoff in money', () => {
  const v = { rate: 18.8, hustle: 1, bv: 20 };
  assert.equal(basketValue(v), 0.47);
  assert.equal(menuPayoff('fries', { v, stock: 0 }), '+$1.41 A BALL');
  assert.equal(menuPayoff('fries', { v, stock: 19 }), '+$0.47 A BALL', 'only the room left in the fryer');
  assert.equal(menuPayoff('fries', { v, stock: 20 }), 'FRYER FULL');
  assert.equal(menuPayoff('hotdog', { fed: 1 }), '+5% EVERY BALL');
  assert.equal(menuPayoff('hotdog', { fed: 1.25 }), '×1.25 FED · FULL');
  assert.equal(menuPayoff('beer', { tab: 2900 }), '$2,900 TAB');
  assert.equal(serveFloat('fries', 'perfect', { v, stockBefore: 0 }), '+$1.41 a ball');
  assert.equal(serveFloat('fries', 'burnt', { v }), null);
  assert.equal(friesServeValue(v, 3, 18), 0.94);
});

test("the Club's dusk deals jobs, not 'hold it': fries under half, 5+ glow snags, 30+ balls left, a short fixture", () => {
  const ids = jobs => jobs.map(j => j.id);
  assert.deepEqual(ids(clubDuskJobs({ value: { fries: 0.4 }, glowSnags: 5, left: 30 })), ['friesBell', 'glowDive', 'pick']);
  assert.deepEqual(ids(clubDuskJobs({ value: { fries: 0.6 }, glowSnags: 4, left: 10 })), []);
  assert.deepEqual(ids(clubDuskJobs({ value: { fries: 0.9 }, fixtures: { sign: 0.6, mat0: 0 } })), ['sign']);
  for (const l of [RALLY_LINES.friesBell, RALLY_LINES.glowDive]) assert.ok(l.split(/\s+/).length <= 8, l);
});
