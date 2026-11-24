// The economy rules: personal carrying gear, helper pockets, ball value
// (fleet factor from cart mud), and the power washer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SIM, CART, WASH, SHOP_BY_ID, nextPrice, perks, gearPerks, ballValue, payFor, money, HELPER_POCKET } from '../web/js/sim.js';

// A crew on a fake clock. `run(secs)` steps 20 ticks a second.
function makeCrew(save = { up: { cart: 1 } }, shiftSecs = 600) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('ECON', save, { shiftSecs, seed: 7, now: () => clock.t });
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;   // Curb Appeal 1: Upkeep 1.5, so the cash below is exact
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
function addPlayer(crew, name, x = 20, z = 5) {
  const p = crew.join(name);
  crew.connect(p);
  p.x = x; p.z = z;
  return p;
}
// A shift with no customers, so only what the test places is on the range.
function openShift(crew) {
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  crew.flush();
}
const act = (crew, p, ...a) => crew.input(p, { a });
const buy = (crew, p, id) => act(crew, p, { t: 'buy', id });
const restingBall = (crew, x, z) => {
  const b = crew.addBall({ x, y: SIM.BALL_R, z, vx: 0, vy: 0, vz: 0 });
  b.rest = true;
  return b;
};
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const ST = WASH.STATION;

// ---- personal gear ---------------------------------------------------------

test('gear is a personal shop item and perks() carries no personal stats', () => {
  assert.equal(SHOP_BY_ID.gear.personal, true);
  assert.notEqual(SHOP_BY_ID.washer.personal, true);
  const k = perks({ gear: 3 });
  for (const f of ['pocket', 'reach', 'scoop']) assert.equal(f in k, false, f);
  assert.deepEqual([0, 1, 2, 3].map(l => gearPerks(l).pocket), [3, 8, 25, 60]);
  assert.equal(HELPER_POCKET, 8);
});

test('buying gear raises only the buyer, paid from the shared wallet', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A'), b = addPlayer(crew, 'B');
  assert.equal(a.gear, 0); assert.equal(b.gear, 0);
  crew.cash = 1000;
  buy(crew, a, 'gear');
  assert.equal(a.gear, 1);
  assert.equal(b.gear, 0, 'B is untouched');
  assert.equal(crew.cash, 980);
  assert.equal(crew.up.gear, undefined, 'not a crew upgrade');
  const ev = crew.flush().ev.find(e => e.t === 'buy' && e.id === 'gear');
  assert.ok(ev && ev.by === a.id && ev.level === 1 && ev.price === 20 && ev.personal === true);
  buy(crew, b, 'gear'); buy(crew, b, 'gear');
  assert.equal(b.gear, 2);
  assert.equal(a.gear, 1);
  assert.equal(crew.cash, 980 - 20 - 75);
});

test('gear price is the catalog price whatever the crew size, and follows the buyer\'s own level', () => {
  const { crew } = makeCrew();
  const [a, b] = ['A', 'B', 'C', 'D'].map(n => addPlayer(crew, n));
  crew.cash = 1000;
  assert.equal(crew.players.size, 4);
  buy(crew, a, 'gear');
  assert.equal(crew.cash, 980, 'tier 1 is $20 even with four players');
  assert.equal(nextPrice('gear', crew.up, 4, a.gear), 75);
  assert.equal(nextPrice('gear', crew.up, 4, b.gear), 20);
  buy(crew, a, 'gear');
  assert.equal(crew.cash, 905);
  // crew items are still scaled (x2.2 for four)
  buy(crew, b, 'helpers');
  assert.equal(crew.cash, 905 - 132);
});

test('gear can be maxed, not bought without the cash, and bought mid-shift', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A');
  buy(crew, a, 'gear');
  assert.equal(a.gear, 0, 'no cash');
  crew.cash = 10000;
  for (let i = 0; i < 5; i++) buy(crew, a, 'gear');
  assert.equal(a.gear, 3, 'tier 3 is the top');
  assert.equal(crew.cash, 10000 - 20 - 75 - 250);
  const b = addPlayer(crew, 'B');
  crew.startShift();
  buy(crew, b, 'gear');
  assert.equal(b.gear, 1, 'the shop is open mid-shift');
});

test('gear is remembered by name: saved, restored from a save, and on rejoin', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'Ann'), b = addPlayer(crew, 'Bob');
  crew.cash = 1000;
  buy(crew, a, 'gear'); buy(crew, a, 'gear'); buy(crew, b, 'gear');
  assert.deepEqual(crew.gearByName, { Ann: 2, Bob: 1 });
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.deepEqual(save.gear, { Ann: 2, Bob: 1 });
  assert.equal(save.up.gear, undefined);

  const { crew: back } = makeCrew(save);
  assert.equal(back.join('Ann').gear, 2);
  assert.equal(back.join('Bob').gear, 1);
  assert.equal(back.join('Cy').gear, 0, 'a stranger starts bare-handed');

  // Leaving and rejoining the same live crew under the same name.
  crew.removePlayer(a);
  assert.equal(crew.join('Ann').gear, 2);
});

test('a crew-level up.gear in a save is ignored, and bad personal gear is clamped', () => {
  const { crew } = makeCrew({ up: { gear: 3, washer: 1 }, gear: { Hi: 99, Neg: -4, Junk: 'x', ThisNameIsFarTooLongToKeep: 2 } });
  assert.deepEqual(crew.up, { washer: 1 });
  assert.equal(crew.join('Neg').gear, 0);
  assert.equal(crew.join('Hi').gear, 3);
  assert.equal(crew.join('Rando').gear, 0, 'crew-level gear gives nobody anything');
  assert.equal(crew.gearByName.Junk, undefined);
  assert.equal(crew.gearByName.ThisNameIsFarTooLongToKeep, undefined);
});

test('the pocket cap comes from your own gear, at every tier', () => {
  for (const [gear, cap] of [[0, 3], [1, 8], [2, 25], [3, 60]]) {
    const { crew } = makeCrew();
    const a = addPlayer(crew, 'A', 10, -20);
    a.gear = gear;
    openShift(crew);
    const ids = Array.from({ length: cap + 5 }, () => restingBall(crew, a.x, a.z).id);
    let got = 0;
    for (const id of ids) if (!act(crew, a, { t: 'pickup', ball: id }).denied.length) got++;
    assert.equal(got, cap, `gear ${gear} carries ${cap}`);
    assert.equal(a.pocket, cap);
  }
});

test('players on the same crew carry different amounts', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', 10, -20), b = addPlayer(crew, 'B', 10, -20);
  a.gear = 2;
  openShift(crew);
  for (const p of [a, b]) for (let i = 0; i < 30; i++) act(crew, p, { t: 'pickup', ball: restingBall(crew, 10, -20).id });
  assert.equal(a.pocket, 25);
  assert.equal(b.pocket, 3);
});

test('snapshot reports each player\'s gear', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A'); addPlayer(crew, 'B');
  a.gear = 3;
  assert.deepEqual(crew.snapshot().players.map(p => p.gear), [3, 0]);
});

// ---- helpers -----------------------------------------------------------------

test('a helper carries at most HELPER_POCKET, whatever the crew\'s gear', () => {
  const { crew, run } = makeCrew({ up: { helpers: 1 } });
  const a = addPlayer(crew, 'A', 100, 5);
  a.gear = 3;
  openShift(crew);
  const h = crew.helpers[0];
  for (let i = 0; i < 30; i++) restingBall(crew, h.x + (i % 5) * 0.2, h.z + 0.3);
  let max = 0;
  for (let i = 0; i < 400; i++) { run(0.05); max = Math.max(max, h.pocket); }
  assert.equal(max, 8, 'fills to eight, and never beyond');
  assert.ok(crew.stats.helped >= 8, `banked ${crew.stats.helped}`);
});

// ---- ball value --------------------------------------------------------------

test('ballValue: BV = rate x Upkeep; no cart means Gear 1', () => {
  assert.deepEqual(ballValue({ perks: perks({}), curb: 1 }),
    { value: 1.5, bv: 1.5, rate: 1, upkeep: 1.5, hustle: 1, cartGear: 1, curb: 1, pond: null, fries: null });
  assert.equal(ballValue({ perks: perks({ washer: 2 }), curb: 1 }).value, 4.5, 'rate 3 x Upkeep 1.5');
  assert.equal(ballValue({ perks: perks({ washer: 1 }), curb: 1, cart: null }).cartGear, 1);
});

test('ballValue: a spotless cart is Gear x1.25, a filthy one x1; the headline value excludes Gear', () => {
  const k = perks({ washer: 2, cart: 1 });
  near(ballValue({ perks: k, curb: 1, cart: { mud: 0 } }).cartGear, 1.25);
  near(ballValue({ perks: k, curb: 1, cart: { mud: 1 } }).cartGear, 1);
  near(ballValue({ perks: k, curb: 1, cart: { mud: 0.5 } }).cartGear, 1.125);
  near(ballValue({ perks: k, curb: 1, cart: {} }).cartGear, 1.25, 1e-9);   // missing mud counts as spotless
  near(ballValue({ perks: k, curb: 1, cart: { mud: 7 } }).cartGear, 1, 1e-9);   // mud is clamped to 1
  near(ballValue({ perks: k, curb: 1, cart: { mud: -3 } }).cartGear, 1.25, 1e-9);   // and to 0
  const clean = ballValue({ perks: k, curb: 1, cart: { mud: 0 } }), filthy = ballValue({ perks: k, curb: 1, cart: { mud: 1 } });
  assert.equal(clean.value, 4.5);
  assert.equal(filthy.value, 4.5, 'the per-ball headline does not move with cart mud');
  assert.equal(payFor(1, clean, clean.cartGear), 5.63, '4.5 x 1.25 = 5.625, to cents');
  assert.equal(payFor(1, filthy, filthy.cartGear), 4.5);
});

test('ballValue: Hit the Cart multiplies BV; the cart Gear applies on top at the deposit', () => {
  const k = perks({ washer: 1, cart: 1 });
  assert.equal(ballValue({ perks: k, curb: 1, mult: 3, cart: { mud: 0 } }).value, 9);
  assert.equal(ballValue({ perks: k, curb: 1, mult: 3, cart: { mud: 1 } }).value, 9);
  const v = ballValue({ perks: k, curb: 1, mult: 3, cart: { mud: 0 } });
  assert.equal(payFor(1, v, v.cartGear), 11.25, '3 x 3 x 1.25');
  assert.equal(payFor(1, v), 9, 'people carry at Gear 1');
  assert.equal(ballValue({ perks: k, curb: 1, mult: 2 }).value, 6, 'no cart: BV x mult');
  assert.equal(ballValue({ perks: k, curb: 1, mult: 2 }).hustle, 2);
});

test('ballValue rounds BV to cents first, then the pay to cents', () => {
  const k = perks({});
  assert.equal(ballValue({ perks: k, curb: 0.1234 }).bv, 1.06);                  // 1.0617
  assert.equal(ballValue({ perks: k, mult: 3, curb: 0.1234 }).value, 3.18, 'BV rounded before Hustle: 1.06 x 3');
  const v = ballValue({ perks: k, curb: 0.1234, cart: { mud: 0.1234 } });
  assert.equal(payFor(1, v, v.cartGear), 1.29);                                  // 1.06 x 1.21915 = 1.2923
});

test('money() formats whole dollars plainly and fractions to cents', () => {
  assert.equal(money(3), '$3');
  assert.equal(money(3.5), '$3.50');
  assert.equal(money(1.18), '$1.18');
});

test('crew.ballPrice() follows BV and Hustle, not the cart; the snapshot reports the value', () => {
  const { crew } = makeCrew({ up: { cart: 1, washer: 2 } });
  assert.equal(crew.cart.mud, 0, 'the cart starts spotless');
  assert.equal(crew.ballPrice(), 4.5);
  assert.equal(crew.snapshot().value.value, 4.5);
  assert.equal(crew.snapshot().value.cartGear, 1.25);
  crew.cart.mud = 1;
  assert.equal(crew.ballPrice(), 4.5, 'cart mud only changes the cart Gear');
  assert.equal(crew.snapshot().value.cartGear, 1);
  crew.mult = 2;
  assert.equal(crew.ballPrice(), 9);
  assert.equal(crew.snapshot().value.value, 9);

  const { crew: bare } = makeCrew({ up: { washer: 1 } });
  assert.equal(bare.cart, null);
  assert.equal(bare.ballPrice(), 3, 'rate 2 x Upkeep 1.5');
  assert.equal(bare.snapshot().value.value, 3);
});

test('banking pays weights x BV, in whole cents', () => {
  const { crew } = makeCrew({ up: { cart: 1 } });
  crew.fixtures.sign = 0.5;                            // Curb 1 - 0.5/12
  assert.equal(crew.ballPrice(), 1.48);                // 1.4792 -> 1.48
  crew.bank(3, 'x');
  assert.equal(crew.cash, 4.44);
  crew.bank(7, 'x');
  assert.equal(crew.cash, 14.8, '10 x 1.48, no float dust');
  assert.equal(crew.stats.cash, 14.8);
  assert.equal(crew.stats.deposited, 10);
  const ev = crew.flush().ev.filter(e => e.t === 'cash');
  assert.deepEqual(ev.map(e => e.cash), [4.44, 10.36]);
});

test('a player depositing at the stand is paid at their own grime Gear (clean = x1.25), whatever the cart looks like', () => {
  const { crew } = makeCrew({ up: { cart: 1 } });
  const a = addPlayer(crew, 'A', SIM.STAND.x, SIM.STAND.z);
  crew.cart.mud = 0;
  a.pocket = 4; a.pocketW = 4;
  act(crew, a, { t: 'deposit' });
  assert.equal(crew.cash, 7.5, '4 x BV 1.5 x 1.25');
  crew.cart.mud = 1;
  a.pocket = 10; a.pocketW = 10;   // deposit() zeroes pocketW; real pickups keep both in step
  act(crew, a, { t: 'deposit' });
  assert.equal(crew.cash, 26.25, '+ 10 x 1.5 x 1.25: the muddy cart changes nothing for a Rat');
});

// ---- mud from driving ---------------------------------------------------------

test('mud accumulates with distance driven', () => {
  const { crew, run } = makeCrew();
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  act(crew, d, { t: 'board' });
  assert.equal(crew.cart.mud, 0);
  run(0.25);
  const x0 = crew.cart.x, z0 = crew.cart.z;
  for (let i = 0; i < 20; i++) {                       // 1.5 m hops, 4 per second
    run(0.25);
    crew.input(d, { cart: { x: crew.cart.x - 1.5, z: crew.cart.z, yaw: crew.cart.yaw } });
  }
  const moved = Math.hypot(crew.cart.x - x0, crew.cart.z - z0);
  assert.ok(moved > 25, `drove ${moved.toFixed(1)} m`);
  near(crew.cart.mud, moved * WASH.MUD_PER_M, 1e-6);
  assert.equal(crew.snapshot().cart.mud, +crew.cart.mud.toFixed(3));
  assert.ok(crew.valueNow().cartGear < 1.25, 'the cart Gear bonus is wearing off');
});

test('standing still, or driving junk poses, adds no mud', () => {
  const { crew, run } = makeCrew();
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  act(crew, d, { t: 'board' });
  run(5);
  crew.input(d, { cart: { x: crew.cart.x, z: crew.cart.z, yaw: crew.cart.yaw } });
  crew.input(d, { cart: { x: NaN, z: 3 } });
  assert.equal(crew.cart.mud, 0);
});

test('mud is capped at 1', () => {
  const { crew, run } = makeCrew();
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  act(crew, d, { t: 'board' });
  crew.cart.mud = 0.99;
  for (let i = 0; i < 12; i++) { run(0.25); crew.input(d, { cart: { x: crew.cart.x - 2, z: crew.cart.z, yaw: crew.cart.yaw } }); }
  assert.equal(crew.cart.mud, 1);
  near(crew.valueNow().cartGear, 1, 1e-9);
});

// ---- the wand -------------------------------------------------------------------

test('the wand is grabbed within GRAB of the station and dropped by toggling again', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', ST.x, ST.z);
  act(crew, a, { t: 'wand' });
  assert.equal(a.wand, true);
  assert.equal(crew.snapshot().players[0].wand, true);
  act(crew, a, { t: 'wand' });
  assert.equal(a.wand, false, 'toggled off');
  act(crew, a, { t: 'wand' });
  assert.equal(a.wand, true);
});

test('the wand: just inside GRAB works, just outside does not', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', ST.x + WASH.GRAB - 0.1, ST.z);
  assert.equal(crew.toggleWand(a), true);
  assert.equal(a.wand, true);
  a.wand = false;
  a.x = ST.x + WASH.GRAB + 0.1;
  assert.equal(crew.toggleWand(a), false);
  assert.equal(a.wand, false);
  const far = addPlayer(crew, 'Far', 5, 5);
  act(crew, far, { t: 'wand' });
  assert.equal(far.wand, false);
});

test('no wand while driving or knocked down', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', ST.x, ST.z);
  crew.cart.x = ST.x; crew.cart.z = ST.z;
  act(crew, a, { t: 'board' });
  assert.ok(crew.driving(a));
  act(crew, a, { t: 'wand' });
  assert.equal(a.wand, false, 'driving');

  const b = addPlayer(crew, 'B', ST.x, ST.z);
  b.down = 1;
  act(crew, b, { t: 'wand' });
  assert.equal(b.wand, false, 'knocked down');
  b.down = 0;
  act(crew, b, { t: 'wand' });
  assert.equal(b.wand, true);
});

test('walking further than HOSE from the station drops the wand on the next input', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', ST.x, ST.z);
  act(crew, a, { t: 'wand' });
  assert.equal(a.wand, true);
  a.x = ST.x - WASH.HOSE + 0.5;                  // hose stretched, still reaches
  crew.input(a, {});
  assert.equal(a.wand, true);
  a.x = ST.x - WASH.HOSE - 0.5;
  assert.equal(a.wand, true, 'nothing happens until the next input');
  crew.input(a, {});
  assert.equal(a.wand, false);
});

// ---- washing ----------------------------------------------------------------------

// A player holding the wand, a muddy cart in spray range, the clock advanced so
// a full 0.5 s wash is allowed.
function washSetup(mud = 0.8) {
  const m = makeCrew();
  const p = addPlayer(m.crew, 'W', ST.x, ST.z);
  act(m.crew, p, { t: 'wand' });
  m.crew.cart.x = ST.x; m.crew.cart.z = ST.z - 4;
  m.crew.cart.mud = mud;
  m.run(1);
  return { ...m, p };
}

test('washing removes RATE x secs of mud', () => {
  const { crew, p } = washSetup(0.8);
  assert.equal(crew.wash(p, 0.5), true);
  near(crew.cart.mud, 0.8 - WASH.RATE * 0.5);
  assert.equal(crew.stats.washed, 0.5);
  assert.equal(crew.dirty, true);
});

test('washing goes through input and makes the cart worth more', () => {
  const { crew, p } = washSetup(1);
  near(crew.valueNow().cartGear, 1);
  act(crew, p, { t: 'wash', secs: 0.4 });
  near(crew.cart.mud, 1 - WASH.RATE * 0.4);
  assert.ok(crew.valueNow().cartGear > 1, 'a cleaner cart earns more Gear');
});

test('a wash is capped at 0.5 s', () => {
  const { crew, p } = washSetup(0.8);
  crew.wash(p, 10);
  near(crew.cart.mud, 0.8 - WASH.RATE * 0.5);
  assert.equal(crew.stats.washed, 0.5);
});

test('a wash is capped at the time since the last wash (x1.15 jitter room, never free time)', () => {
  const { crew, clock, p } = washSetup(0.8);
  crew.wash(p, 0.5);                                  // sets washAt = now
  const m1 = crew.cart.mud;
  crew.wash(p, 0.5);                                  // no time passed: nothing counts
  near(m1 - crew.cart.mud, 0);
  clock.t += 300;
  const m2 = crew.cart.mud;
  crew.wash(p, 0.5);                                  // 0.3 s x 1.15
  near(m2 - crew.cart.mud, WASH.RATE * 0.345);
  clock.t += 200;
  const m3 = crew.cart.mud;
  crew.wash(p, 0.15);                                 // the caller's smaller figure wins
  near(m3 - crew.cart.mud, WASH.RATE * 0.15);
});

test('no spraying faster than real time: a flood of washes adds up to about the clock', () => {
  const { crew, p } = washSetup(1);
  for (let i = 0; i < 8; i++) act(crew, p, { t: 'wash', secs: 0.5 });   // 8 messages in one instant
  near(crew.cart.mud, 1 - WASH.RATE * 0.5);           // only the first counts: no time passed for the rest
});

test('washing needs the wand', () => {
  const { crew, p } = washSetup(0.8);
  p.wand = false;
  assert.equal(crew.wash(p, 0.5), false);
  assert.equal(crew.cart.mud, 0.8);
  assert.equal(crew.stats.washed, 0);
});

test('washing needs the cart within RANGE + 1.5, and a cart to wash', () => {
  const { crew, p } = washSetup(0.8);
  crew.cart.x = p.x; crew.cart.z = p.z - (WASH.RANGE + 1.4);
  assert.equal(crew.wash(p, 0.5), true, 'just inside');
  const before = crew.cart.mud;
  crew.cart.z = p.z - (WASH.RANGE + 1.6);
  assert.equal(crew.wash(p, 0.5), false, 'just outside');
  assert.equal(crew.cart.mud, before);

  const { crew: bare } = makeCrew({});
  const q = addPlayer(bare, 'Q', ST.x, ST.z);
  act(bare, q, { t: 'wand' });
  assert.equal(bare.wash(q, 0.5), false, 'no cart at all');
});

test('washing refuses junk secs and a knocked-down washer', () => {
  const { crew, p } = washSetup(0.8);
  for (const s of [0, -1, NaN, Infinity, undefined, 'x']) {
    if (s === Infinity) continue;                       // Infinity is finite-checked below
    assert.equal(crew.wash(p, s), false, String(s));
  }
  assert.equal(crew.wash(p, Infinity), false, 'Infinity is not a number of seconds');
  assert.equal(crew.cart.mud, 0.8);
  p.down = 1;
  assert.equal(crew.wash(p, 0.5), false);
  assert.equal(crew.cart.mud, 0.8);
});

test('mud never goes below 0', () => {
  const { crew, p } = washSetup(0.02);
  crew.wash(p, 0.5);
  assert.equal(crew.cart.mud, 0);
});

test('crossing below 0.05 snaps the cart to spotless and cheers once', () => {
  const { crew, clock, p } = washSetup(0.07);
  crew.flush();
  crew.wash(p, 0.5);                                  // 0.07 - 0.04 = 0.03 -> spotless
  assert.equal(crew.cart.mud, 0, 'snapped to exactly zero');
  assert.deepEqual(crew.flush().ev.filter(e => e.t === 'spotless'), [{ t: 'spotless', by: p.id, target: 'cart' }]);
  assert.equal(crew.valueNow().cartGear, 1.25);

  crew.cart.mud = 0.03;                               // already under: washing more is silent
  clock.t += 500;
  crew.wash(p, 0.5);
  assert.equal(crew.cart.mud, 0);
  assert.equal(crew.flush().ev.filter(e => e.t === 'spotless').length, 0);
});

test('stopping just above 0.05 is not spotless yet', () => {
  const { crew, p } = washSetup(0.1);
  crew.flush();
  crew.wash(p, 0.5);                                  // 0.1 - 0.04 = 0.06
  near(crew.cart.mud, 0.06);
  assert.equal(crew.flush().ev.filter(e => e.t === 'spotless').length, 0);
});

test('stats.washed accumulates seconds, to a tenth', () => {
  const { crew, clock, p } = washSetup(1);
  crew.wash(p, 0.5);
  clock.t += 500; crew.wash(p, 0.25);
  clock.t += 500; crew.wash(p, 0.3);
  assert.equal(crew.stats.washed, 1.1);
  assert.equal(crew.totals.washed, 0, 'banked into totals at closing, not before');
});

test('two players washing at once stack, and the spotless credit goes to the one who finishes it', () => {
  const { crew, clock, run } = makeCrew();
  const a = addPlayer(crew, 'A', ST.x, ST.z), b = addPlayer(crew, 'B', ST.x + 1, ST.z);
  act(crew, a, { t: 'wand' }); act(crew, b, { t: 'wand' });
  assert.ok(a.wand && b.wand, 'the station has room for two hoses');
  crew.cart.x = ST.x; crew.cart.z = ST.z - 4;
  crew.cart.mud = 0.5;
  run(1);
  crew.wash(a, 0.5); crew.wash(b, 0.5);
  near(crew.cart.mud, 0.5 - 2 * WASH.RATE * 0.5);
  assert.equal(crew.stats.washed, 1);

  crew.cart.mud = 0.07;
  clock.t += 500;
  crew.flush();
  crew.wash(a, 0.5);                                  // 0.03: A finishes it
  crew.wash(b, 0.5);
  assert.equal(crew.cart.mud, 0);
  assert.deepEqual(crew.flush().ev.filter(e => e.t === 'spotless'), [{ t: 'spotless', by: a.id, target: 'cart' }]);
});

test('three sprayers clean three times as fast as one', () => {
  const cleaned = n => {
    const { crew, run } = makeCrew();
    const ps = Array.from({ length: n }, (_, i) => addPlayer(crew, `P${i}`, ST.x, ST.z));
    for (const p of ps) act(crew, p, { t: 'wand' });
    crew.cart.x = ST.x; crew.cart.z = ST.z - 4; crew.cart.mud = 1;
    run(1);
    for (const p of ps) crew.wash(p, 0.5);
    return 1 - crew.cart.mud;
  };
  near(cleaned(3), 3 * cleaned(1));
});
