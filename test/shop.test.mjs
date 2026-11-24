import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SIM, SHOP, nextPrice, priceScale, perks, gearPerks } from '../web/js/sim.js';

function makeCrew(save = null, shiftSecs = 60) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('SHOP', save, { shiftSecs, seed: 9, now: () => clock.t });
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;   // Curb Appeal 1: Upkeep 1.5, so the cash below is exact
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
const buy = (crew, p, id) => crew.input(p, { a: [{ t: 'buy', id }] });

test('every shop item starts free at tier 0 and costs more each tier', () => {
  for (const item of SHOP) {
    assert.equal(item.tiers[0].cost, undefined, item.id);
    for (let i = 2; i < item.tiers.length; i++) assert.ok(item.tiers[i].cost > item.tiers[i - 1].cost, `${item.id} tier ${i}`);
  }
});

test('prices scale with crew size, balanced for 4', () => {
  assert.equal(priceScale(1), 1);
  assert.ok(Math.abs(priceScale(4) - 2.2) < 1e-9);
  assert.equal(nextPrice('helpers', {}, 1), 60);
  assert.equal(nextPrice('helpers', {}, 4), 132);
  assert.equal(nextPrice('gear', {}, 1, 0), 20);
  assert.equal(nextPrice('gear', {}, 4, 0), 20, 'personal gear is not scaled by crew size');
  assert.equal(nextPrice('gear', {}, 4, 2), 250, 'uses the passed gear level');
  assert.equal(nextPrice('gear', {}, 1, 3), null, 'gear maxed out');
  assert.equal(nextPrice('hardhat', { hardhat: 1 }, 1), null, 'maxed out');
});

test('perks follow the upgrades', () => {
  assert.equal(gearPerks(0).pocket, 3);
  assert.equal(gearPerks(2).pocket, 25);
  assert.ok(gearPerks(3).scoop > 0);
  for (const k of ['pocket', 'reach', 'scoop']) assert.equal(k in perks({ gear: 3 }), false, `perks() has no ${k}`);
  assert.equal(perks({ washer: 2 }).price, 3);
  assert.ok(perks({ shoes: 3 }).walk > perks().walk * 1.4);
  assert.equal(perks({ hardhat: 1 }).knockSecs, 1);
});

test('buying: any time, only with the cash', () => {
  const { crew, run } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  buy(crew, a, 'gear');
  assert.equal(a.gear, 0, 'no cash, no tube');

  crew.cash = 100;
  buy(crew, a, 'gear');
  assert.equal(a.gear, 1);
  assert.equal(crew.up.gear, undefined, 'gear is personal, not a crew upgrade');
  assert.equal(crew.cash, 80);
  assert.ok(crew.flush().ev.some(e => e.t === 'buy' && e.id === 'gear' && e.level === 1 && e.by === a.id));

  crew.input(a, { a: [{ t: 'start' }] });
  buy(crew, a, 'shoes');
  assert.equal(crew.up.shoes, 1, 'the shop is open mid-shift');
  assert.equal(crew.cash, 65);

  run(61);
  assert.equal(crew.phase, 'report');
  buy(crew, a, 'shoes');
  assert.equal(crew.up.shoes, 2, 'open overnight too');
  assert.equal(crew.cash, 20);

  buy(crew, a, 'nonsense');
  assert.deepEqual(Object.keys(crew.up), ['shoes']);
});

test('better gear: a bigger pocket on the server too', () => {
  const { crew, run } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  a.gear = 2;
  crew.input(a, { a: [{ t: 'start' }] });
  run(25);
  let n = 0;
  for (const b of [...crew.balls.values()].filter(b => b.rest)) {
    a.x = b.x; a.z = b.z;
    if (!crew.input(a, { a: [{ t: 'pickup', ball: b.id }] }).denied.length) n++;
  }
  assert.ok(n > 3, `carried ${n} (more than bare hands)`);
  assert.ok(a.pocket <= 25);
});

test('the washer makes every banked ball worth more', () => {
  const { crew } = makeCrew({ up: { washer: 2 } });
  const a = crew.join('A');
  crew.input(a, { a: [{ t: 'start' }] });
  a.pocket = 3; a.pocketW = 3; a.x = SIM.STAND.x; a.z = SIM.STAND.z;
  crew.input(a, { a: [{ t: 'deposit' }] });
  // washer 2: rate $3, BV $4.5 at Curb 1, a clean Rat x1.25 = $16.88 in all. The muddy third is paid now.
  assert.equal(crew.cash, 5.63, 'the muddy price (full / 3) is paid at the stand');
  assert.equal(crew.hopper.n, 3);
  assert.equal(crew.hopper.credit, 11.25, 'the premium waits in the hopper');
  crew.washBalls(3, a.id);
  assert.equal(crew.cash, 16.88, 'washed: every ball pays the full washer price');
  assert.equal(crew.hopper.n, 0);
});

test('advertising: customers hit more balls', () => {
  const count = up => {
    const { crew, run } = makeCrew({ up });
    const a = crew.join('A'); crew.connect(a);
    crew.input(a, { a: [{ t: 'start' }] });
    let spawned = 0;
    for (let i = 0; i < 50; i++) { run(1); spawned += crew.flush().ev.filter(e => e.t === 'spawn').length; }
    return spawned;
  };
  const plain = count({}), blimp = count({ ads: 3 });
  assert.ok(blimp > plain * 1.5, `blimp ${blimp} vs ${plain}`);
});

test('hired help picks up balls and banks them', () => {
  const { crew, run } = makeCrew(null, SIM.SHIFT_SECS);
  const a = crew.join('A'); crew.connect(a);
  crew.cash = 60;
  buy(crew, a, 'helpers');
  assert.equal(crew.helpers.length, 1);
  assert.equal(crew.snapshot().helpers[0].name, 'Kyle');
  a.x = 100; a.z = 5;                     // out of the way of the mats
  crew.input(a, { a: [{ t: 'start' }] });
  run(SIM.SHIFT_SECS - 1);
  assert.ok(crew.stats.helped >= 9, `one helper banked ${crew.stats.helped} in a shift`);
  assert.ok(crew.helpers[0].pocket <= 8, 'a beat-up tube: eight at a time');
  assert.ok(crew.cash >= crew.stats.helped, 'and it went in the crew wallet');
});

test('at closing, helpers turn in what they carry and it counts today', () => {
  const { crew, run } = makeCrew({ up: { helpers: 1, washer: 1 } }, 5);
  const a = crew.join('A'); crew.connect(a);
  crew.input(a, { a: [{ t: 'start' }] });
  crew.helpers[0].pocket = 4;
  run(6);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.report.helped, 4);
  // 4 balls x BV $3 (rate 2 x Upkeep 1.5), helpers have Gear 1 = $12: $6 muddy now, $6 waiting.
  // The bell washes half of what is left (2 balls) at half pay: $6 x 0.5 x 0.5 = $1.50.
  assert.equal(crew.report.cash, 7.5, 'muddy $6 + the night crew $1.50');
  assert.equal(crew.report.unwashed, 2);
  assert.equal(crew.report.lostPremium, 4.5);
  assert.equal(crew.helpers[0].pocket, 0);
});

test('helpers do not chase the same ball', () => {
  const { crew, run } = makeCrew({ up: { helpers: 3 } });
  const a = crew.join('A'); crew.connect(a);
  crew.input(a, { a: [{ t: 'start' }] });
  run(20);
  const targets = crew.helpers.map(h => h.target).filter(Boolean);
  assert.equal(new Set(targets).size, targets.length);
});

test('upgrades and helpers survive a save', () => {
  const { crew } = makeCrew();
  const a = crew.join('A');
  crew.cash = 1000;
  for (const id of ['gear', 'gear', 'helpers', 'helpers', 'washer']) buy(crew, a, id);
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.deepEqual(save.gear, { A: 2 });
  const { crew: back } = makeCrew(save);
  assert.deepEqual(back.up, { helpers: 2, washer: 1 });
  assert.equal(back.join('A').gear, 2);
  assert.equal(back.helpers.length, 2);
  assert.equal(back.cash, crew.cash);
});

test('a tampered save cannot give tiers that do not exist', () => {
  const { crew } = makeCrew({ up: { gear: 99, helpers: -3, bogus: 2, washer: 99 }, gear: { A: 99, B: -2 } });
  assert.deepEqual(crew.up, { washer: 3 }, 'personal gear is not a crew upgrade');
  assert.deepEqual(crew.gearByName, { A: 3 });
});
