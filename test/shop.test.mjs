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
    // Council round 10 §D: Autopilot ($250k) follows the $300k second cart on purpose.
    for (let i = 2; i < item.tiers.length; i++) if (item.tiers[i].name !== 'Autopilot') assert.ok(item.tiers[i].cost > item.tiers[i - 1].cost, `${item.id} tier ${i}`);
  }
});

test('prices scale with crew size, balanced for 4', () => {
  assert.equal(priceScale(1), 1);
  assert.ok(Math.abs(priceScale(4) - 2.2) < 1e-9);
  assert.equal(nextPrice('helpers', {}, 1), 60);
  assert.equal(nextPrice('helpers', {}, 4), 132);
  assert.equal(nextPrice('gear', {}, 1, 0), 20);
  assert.equal(nextPrice('gear', {}, 4, 0), 44, 'crew gear is scaled by crew size (§5.2)');
  assert.equal(nextPrice('gear', { gear: 2 }, 1), 250, 'uses the crew level');
  assert.equal(nextPrice('gear', { gear: 3 }, 1), null, 'gear maxed out');
  assert.equal(nextPrice('dive', {}, 4, 0, 1), 1200, 'dive gear is still personal');
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
  assert.equal(crew.up.gear, 1, 'gear is a crew upgrade (§5.2)');
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
  assert.deepEqual(Object.keys(crew.up).sort(), ['gear', 'shoes']);
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
  // washer 2: rate $3.75 (the one price), BV $5.63 at Curb 1, a clean Rat x1 = $16.89 in all. The muddy third is paid now.
  assert.equal(crew.cash, 5.63, 'the muddy price (full / 3) is paid at the stand');
  assert.equal(crew.hopper.n, 3);
  assert.equal(crew.hopper.credit, 11.26, 'the premium waits in the hopper');
  crew.washBalls(3, a.id);
  assert.equal(crew.cash, 16.89, 'washed: every ball pays the full washer price');
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
  // 4 balls x BV $3.75 (rate 2.5 x Upkeep 1.5), helpers pay the full price (owner playtest 3 §1.4) = $15: $7.50 muddy
  // now, $7.50 waiting. The bell washes half of what is left (2 balls) at half pay: $7.50 x 0.5 x 0.5 = $1.88.
  assert.equal(crew.report.cash, 9.38, 'muddy $7.50 + the night crew $1.88');
  assert.equal(crew.report.unwashed, 2);
  assert.ok(Math.abs(crew.report.lostPremium - 5.62) < 0.011, String(crew.report.lostPremium));
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
  crew.day = 2;                                         // the washer row opens on day 2
  crew.cash = 1000;
  for (const id of ['gear', 'gear', 'helpers', 'helpers', 'washer']) buy(crew, a, id);
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.equal(save.up.gear, 2);
  const { crew: back } = makeCrew(save);
  assert.deepEqual(back.up, { gear: 2, helpers: 2, washer: 1 });
  assert.equal(back.join('A').gear, 2);
  assert.equal(back.helpers.length, 2);
  assert.equal(back.cash, crew.cash);
});

test('a tampered save cannot give tiers that do not exist', () => {
  const { crew } = makeCrew({ up: { gear: 99, helpers: -3, bogus: 2, washer: 99 }, gear: { A: 99, B: -2 } });
  assert.deepEqual(crew.up, { gear: 3, washer: 3 }, 'clamped to the catalog');
});

// Council round 7 #9: the Owner's projects row is endless-only: it never leaks into venues 0–5.
test("no endless-only row (the Owner's projects) leaks into venues 0–5", async () => {
  const { shopShows } = await import('../web/js/sim.js');
  for (let v = 0; v <= 5; v++) {
    for (const item of SHOP.filter(i => i.endless)) {
      assert.equal(shopShows(item, v, 99), false, `${item.id} at venue ${v}`);
      assert.equal(nextPrice(item.id, {}, 4, 0, v, 99), null);
    }
  }
  assert.ok(SHOP.some(i => i.id === 'owner' && i.endless));
});

// ---- owner playtest 3 §4, §5 ---------------------------------------------------
test('§4 Open every bay: Muni from day 2 for 1–3 Rats, hidden at 4+, and it carries over to every venue', async () => {
  const { shopShows, SHOP_BY_ID, activeMats } = await import('../web/js/sim.js');
  const bays = SHOP_BY_ID.bays;
  assert.equal(shopShows(bays, 0, 1, false, 1), false, 'not on day 1');
  for (const n of [1, 2, 3]) assert.equal(shopShows(bays, 0, 2, false, n), true, `${n} Rats, day 2`);
  assert.equal(shopShows(bays, 0, 2, false, 4), false, 'every mat is already open at 4');
  assert.equal(nextPrice('bays', {}, 1, 0, 0, 2), 40);
  assert.equal(nextPrice('bays', {}, 2, 0, 0, 2), 56);
  assert.equal(nextPrice('bays', {}, 4, 0, 0, 2), null);
  assert.equal(nextPrice('bays', { bays: 1 }, 1, 0, 0, 5), null, 'one tier');
  assert.equal(activeMats(1), 6);
  assert.equal(activeMats(1, { bays: 1 }), 10);
  assert.equal(activeMats(2, { bays: 1 }), 10);
  // Main-session call (overrides the spec's Muni-only rule): the bays stay open after promotion.
  assert.equal(activeMats(1, { bays: 1 }, 1), 10);
  assert.equal(shopShows(bays, 1, 1, false, 1), true, 'still in the Club shop (owned, or a late buy)');
  assert.equal(perks({ bays: 1 }).bays, true);
});

test('§5.1 the pressure washer row: fan (day 2), turbo (day 4), foam cannon (Tiered)', async () => {
  const { tierLock, SHOP_BY_ID } = await import('../web/js/sim.js');
  const wand = SHOP_BY_ID.wand;
  assert.deepEqual(wand.tiers.map(t => t.name), ['Garden-hose nozzle', 'Fan nozzle', 'Turbo nozzle', 'Foam cannon']);
  assert.equal(nextPrice('wand', {}, 1, 0, 0, 1), null, 'not on day 1');
  assert.equal(nextPrice('wand', {}, 1, 0, 0, 2), 40);
  assert.equal(nextPrice('wand', {}, 4, 0, 0, 2), 88);
  assert.equal(nextPrice('wand', { wand: 1 }, 1, 0, 0, 3), null, 'the turbo waits for day 4');
  assert.equal(tierLock(wand, 1, 0, 3), 'Day 4');
  assert.equal(nextPrice('wand', { wand: 1 }, 4, 0, 0, 4), 330);
  assert.equal(nextPrice('wand', { wand: 1 }, 1, 0, 1, 1), 150, 'day gates are Muni-only');
  assert.equal(nextPrice('wand', { wand: 2 }, 1, 0, 1, 9), null, 'the foam cannon is Tiered');
  assert.equal(tierLock(wand, 2, 1, 9), 'Tiered Entertainment Range');
  assert.equal(nextPrice('wand', { wand: 2 }, 4, 0, 2, 9), 44000);
  assert.equal(nextPrice('wand', { wand: 3 }, 1, 0, 5, 99), null, 'the truck is a later build');
  assert.deepEqual([0, 1, 2, 3].map(w => perks({ wand: w }).washRate), [1, 1.5, 2, 2]);
  assert.deepEqual([0, 1, 2, 3].map(w => perks({ wand: w }).washReach), [7, 7, 9, 9]);
  assert.equal(perks({ wand: 2 }).foam, false);
  assert.equal(perks({ wand: 3 }).foam, true);
  // Club amenities keep one tier: covered bays.
  assert.equal(SHOP_BY_ID.amen.tiers.length, 2);
  assert.equal(nextPrice('amen', {}, 1, 0, 1), 8000);
  assert.equal(perks({ amen: 1 }).covered, true);
  assert.equal(SHOP_BY_ID.amen.tiers[1].desc, 'Mats scuff half as fast. The members approve.');
});

test('§5.2 carrying gear and shoes are crew rows at the crew price', async () => {
  const { SHOP_BY_ID } = await import('../web/js/sim.js');
  assert.equal(SHOP_BY_ID.gear.personal, undefined);
  assert.equal(SHOP_BY_ID.gear.title, 'Crew carrying gear');
  assert.equal(SHOP_BY_ID.shoes.title, 'Crew shoes');
  assert.equal(SHOP_BY_ID.dive.personal, true, 'dive gear stays personal');
  assert.deepEqual([0, 1, 2].map(g => nextPrice('gear', { gear: g }, 4)), [44, 165, 550]);
  assert.deepEqual([0, 1, 2].map(g => nextPrice('gear', { gear: g }, 1)), [20, 75, 250]);
  assert.equal(44 + 165 + 550, 759, 'a 4P crew pays $759, not 4 × $345');
});

test('§5.3 the cart carries half', async () => {
  const { CART } = await import('../web/js/sim.js');
  assert.deepEqual([0, 1, 2, 3].map(c => perks({ cart: c }).cartCap), [0, 150, 300, 300]);
  assert.equal(CART.UNLOAD_SECS, 1.5);
});
