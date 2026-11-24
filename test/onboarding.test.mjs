// The first-night ramp (owner playtest, 2026-11-24): the shop grows by day, the kitchen waits for
// the Range Club, a teenager arrives on day 2, and day 1 has a shared checklist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SHOP, SHOP_BY_ID, nextPrice, shopShows, shopDay } from '../web/js/sim.js';

function makeCrew(save = null) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('ONBD', save, { shiftSecs: 240, seed: 3, now: () => clock.t });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
const rows = (venue, day) => SHOP.filter(i => shopShows(i, venue, day)).map(i => i.id);

test('day 1 at the Muni shows only gear, the teenagers, shoes and hard hats', () => {
  assert.deepEqual(rows(0, 1), ['gear', 'helpers', 'shoes', 'hardhat']);
});
test('the washer and ads join on day 2, the cart on day 3', () => {
  assert.deepEqual(rows(0, 2), ['gear', 'helpers', 'washer', 'ads', 'shoes', 'hardhat']);
  assert.ok(rows(0, 3).includes('cart'));
  assert.ok(!rows(0, 9).includes('shed'), 'no kitchen at the Muni, ever');
});
test('the snack shed (the kitchen) opens at the Range Club, with every Muni row', () => {
  const club = rows(1, 1);
  for (const id of ['gear', 'cart', 'shed', 'helpers', 'washer', 'ads', 'shoes', 'hardhat']) assert.ok(club.includes(id), id);
  assert.equal(nextPrice('shed', {}, 1, 0, 0), null);
  assert.equal(nextPrice('shed', {}, 1, 0, 1), SHOP_BY_ID.shed.tiers[1].cost);
});
test('overnight, the shop shops for tomorrow', () => {
  assert.equal(shopDay('report', 1), 2);
  assert.equal(shopDay('shift', 1), 1);
  assert.equal(shopDay('lobby', 1), 1);
});

test('the server refuses a row that is not open yet, and sells it overnight', () => {
  const { crew } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  crew.startShift(); crew.cash = 1000;
  crew.buy(a, 'washer');
  assert.equal(crew.up.washer ?? 0, 0, 'no washer on day 1');
  crew.buy(a, 'shed');
  assert.equal(crew.up.shed ?? 0, 0, 'no kitchen at the Muni');
  crew.phase = 'report';                                 // the overnight shop sells for day 2
  crew.buy(a, 'washer');
  assert.equal(crew.up.washer, 1);
});

test('day 2: Corporate sends a teenager, once', () => {
  const { crew } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  crew.startShift();
  assert.equal(crew.helpers.length, 0, 'day 1 is just the crew');
  crew.endShift(); crew.flush();
  crew.startShift();
  assert.equal(crew.day, 2);
  assert.equal(crew.up.helpers, 1);
  assert.equal(crew.helpers.length, 1);
  assert.ok(crew.flush().ev.some(e => e.t === 'freehelper'));
  crew.endShift(); crew.startShift();
  assert.equal(crew.up.helpers, 1, 'only on day 2');
});
test('a crew that already hired one gets a second teenager on day 2', () => {
  const { crew } = makeCrew({ day: 2, up: { helpers: 1 } });
  crew.startShift();
  assert.equal(crew.up.helpers, 2);
});

test('the day 1 checklist ticks off for the whole crew, then goes away', () => {
  const { crew, run } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  crew.startShift();
  let todo = crew.snapshot().todo;
  assert.deepEqual(todo.map(t => t.id), ['pick', 'bank', 'sign', 'buy']);
  assert.ok(todo.every(t => !t.done));
  crew.stats.picked = 12; crew.stats.deposited = 10;
  crew.fixtures.sign = 0;
  crew.cash = 100; crew.buy(a, 'shoes');
  todo = crew.snapshot().todo;
  assert.ok(todo.every(t => t.done), JSON.stringify(todo));
  assert.equal(todo[0].n, 10, 'capped at the goal');
  crew.endShift(); crew.startShift();
  assert.equal(crew.snapshot().todo, null, 'day 2 has no checklist');
  run(1);
});
test('no checklist after the Muni or in a promoted crew', () => {
  const { crew } = makeCrew({ venue: 1, day: 1, venueDay: 0 });
  crew.startShift();
  assert.equal(crew.snapshot().todo, null);
});
