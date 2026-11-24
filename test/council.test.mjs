// The fun council's economy (design/council-round1.md §2, §4.6 items 3 and 4):
// Ball Value, Curb Appeal, weighted balls, washing fixtures, the daily quota,
// Last Call, and the counters.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SIM, CART, WASH, FIXTURES, FIXTURE_BY_ID, KIND_W, VENUES, LAST_CALL, BALLS_OUTSTANDING,
  perks, ballValue, payFor, quotaQ, upkeepCeiling, VENUE_RULES } from '../web/js/sim.js';

// A crew on a fake clock. `run(secs)` steps 20 ticks a second.
function makeCrew(save = null, shiftSecs = 600, seed = 11) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('CNCL', save, { shiftSecs, seed, now: () => clock.t });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
const setMud = (crew, v) => { for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = v; };
// Start a shift with no customers and a clean range (Curb 1), after the morning mud has been laid.
function openShift(crew, mud = 0) {
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  setMud(crew, mud);
  crew.flush();
}
function addPlayer(crew, name, x, z) {
  const p = crew.join(name);
  crew.connect(p);
  p.x = x; p.z = z;
  return p;
}
const act = (crew, p, ...a) => crew.input(p, { a });
const restingBall = (crew, x, z, kind) => {
  const b = crew.addBall({ x, y: SIM.BALL_R, z, vx: 0, vy: 0, vz: 0, kind });
  b.rest = true;
  return b;
};
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const ST = WASH.STATION;
const STAND = SIM.STAND;
const reelCentre = c => ({ x: c.x - Math.sin(c.yaw) * CART.REEL_AHEAD, z: c.z - Math.cos(c.yaw) * CART.REEL_AHEAD });

// ---- Ball Value ------------------------------------------------------------------

test('BV = Rate x Upkeep, with commendations raising Rate +5% each', () => {
  const k = perks({ washer: 1 });                       // price 2
  assert.equal(ballValue({ perks: k, curb: 1 }).rate, 2);
  assert.equal(ballValue({ perks: k, curb: 1 }).bv, 3);
  const c4 = ballValue({ perks: k, curb: 1, commendations: 4 });
  assert.equal(c4.rate, 2.4, '2 x 1.2');
  assert.equal(c4.bv, 3.6, '2.4 x Upkeep 1.5');
  assert.equal(c4.value, 3.6);
  const c10 = ballValue({ perks: perks({}), curb: 1, commendations: 10 });
  assert.equal(c10.rate, 1.5, '+50% at the cap');
  assert.equal(c10.bv, 2.25);
  assert.equal(ballValue({ perks: perks({}), curb: 1, commendations: 25 }).rate, 1.5, 'commendations are capped at 10');
  assert.equal(ballValue({ perks: perks({}), curb: 1, commendations: 3 }).rate, 1.15);
});

test('BV: venue rate multiplies, hustle multiplies the headline value only', () => {
  assert.deepEqual(VENUES.slice(0, 3).map(v => v.rate), [1, 5, 25]);
  const club = ballValue({ perks: perks({ washer: 2 }), curb: 1, venue: 1 });
  assert.equal(club.rate, 15, 'venue 5 x price 3');
  assert.equal(club.bv, 22.5);
  const h = ballValue({ perks: perks({}), curb: 1, mult: 2 });
  assert.equal(h.bv, 1.5);
  assert.equal(h.hustle, 2);
  assert.equal(h.value, 3);
});

test('Upkeep is 1 + 0.5 x (Curb + Pond + Fries); locked KPIs count 0', () => {
  const k = perks({});
  assert.equal(ballValue({ perks: k, curb: 0 }).upkeep, 1);
  assert.equal(ballValue({ perks: k, curb: 1 }).upkeep, 1.5);
  assert.equal(ballValue({ perks: k, curb: 0.5, pond: null, fries: null }).upkeep, 1.25);
  assert.equal(ballValue({ perks: k, curb: 1, pond: 1 }).upkeep, 2);
  assert.equal(ballValue({ perks: k, curb: 1, pond: 1, fries: 1 }).upkeep, 2.5);
  assert.equal(upkeepCeiling({}), 1.5, 'only Curb exists so far');
  assert.equal(upkeepCeiling({ pond: 0 }), 2, 'an unlocked KPI lifts the ceiling');
  assert.equal(upkeepCeiling({ pond: 0, fries: 0 }), 2.5);
});

test('payFor = weights x BV x Hustle x Gear, to cents', () => {
  const v = ballValue({ perks: perks({}), curb: 1, mult: 2 });   // BV 1.5, Hustle 2
  assert.equal(payFor(1, v), 3);
  assert.equal(payFor(5, v), 15);
  assert.equal(payFor(5, v, 1.25), 18.75);
  assert.equal(payFor(0, v), 0);
  const odd = ballValue({ perks: perks({}), curb: 0.1234 });     // BV 1.06
  assert.equal(payFor(3, odd), 3.18);
  assert.equal(payFor(1, odd, 1.21915), 1.29);
});

test('the crew reads commendations (clamped to 0..10), washer and curb into its BV', () => {
  const { crew } = makeCrew({ up: { washer: 1 }, commendations: 4 });
  setMud(crew, 0);
  assert.equal(crew.valueNow().rate, 2.4);
  assert.equal(crew.valueNow().bv, 3.6);
  assert.equal(crew.ballPrice(), 3.6);
  crew.mult = 2;
  assert.equal(crew.ballPrice(), 7.2, 'Hustle');
  assert.equal(crew.snapshot().value.bv, 3.6);
  assert.equal(makeCrew({ commendations: 99 }).crew.commendations, 10);
  assert.equal(makeCrew({ commendations: -5 }).crew.commendations, 0);
  assert.equal(makeCrew({ commendations: 'x' }).crew.commendations, 0);
});

// ---- Curb Appeal -----------------------------------------------------------------

test('curb is 1 minus the average mud over the twelve fixtures', () => {
  const { crew } = makeCrew();
  assert.equal(FIXTURES.length, 12);
  assert.deepEqual(Object.keys(crew.fixtures), ['sign', 'stand', ...Array.from({ length: 10 }, (_, i) => `mat${i}`)]);
  setMud(crew, 0);
  assert.equal(crew.curb(), 1);
  assert.equal(crew.valueNow().upkeep, 1.5);
  setMud(crew, 1);
  assert.equal(crew.curb(), 0);
  assert.equal(crew.valueNow().upkeep, 1);
  assert.equal(crew.ballPrice(), 1, 'a filthy range pays the bare rate');
  setMud(crew, 0);
  crew.fixtures.sign = 0.9; crew.fixtures.stand = 0.5;
  near(crew.curb(), 1 - 1.4 / 12);
  crew.fixtures.mat3 = 0.6;
  near(crew.curb(), 1 - 2.0 / 12);
  assert.equal(crew.valueNow().bv, 1.42, '1 x (1 + 0.5 x 0.8333) = 1.4167');
  crew.fixtures = {};
  assert.equal(crew.curb(), 1, 'no fixtures: nothing to be dirty');
});

test('the snapshot reports curb, upkeep and fixtures (to 2 places)', () => {
  const { crew } = makeCrew();
  setMud(crew, 0);
  crew.fixtures.sign = 0.12345;
  const s = crew.snapshot();
  assert.equal(s.fixtures.sign, 0.12);
  assert.equal(Object.keys(s.fixtures).length, 12);
  near(s.value.curb, 1 - 0.12345 / 12);
});

// ---- washing a fixture -----------------------------------------------------------

// A player holding the wand, standing `dist` metres from `fx` (straight down-field of it), clock moved on.
function washAt(fxId, dist, save = { up: { cart: 1 } }) {
  const m = makeCrew(save);
  const fx = FIXTURE_BY_ID[fxId];
  const p = addPlayer(m.crew, 'W', ST.x, ST.z);
  act(m.crew, p, { t: 'wand' });
  assert.equal(p.wand, true);
  p.x = fx.x; p.z = fx.z - dist;
  m.run(1);
  return { ...m, p, fx };
}

test('washing a fixture: range is measured to the fixture, WASH.RANGE + 1.5 + its radius', () => {
  assert.equal(WASH.HOSE, 60);
  const { crew, clock, p, fx } = washAt('sign', 0);
  assert.equal(fx.r, 1.8);
  setMud(crew, 0.8);
  const reach = WASH.RANGE + 1.5 + fx.r;
  p.z = fx.z - (reach - 0.1);
  assert.equal(crew.wash(p, 0.5, 'sign'), true, 'just inside');
  clock.t += 1000;
  p.z = fx.z - (reach + 0.1);
  const before = crew.fixtures.sign;
  assert.equal(crew.wash(p, 0.5, 'sign'), false, 'just outside');
  assert.equal(crew.fixtures.sign, before);

  // The cart's parking spot is nowhere near the sign: range is to the target, not to the cart.
  p.z = fx.z - 2;
  assert.ok(Math.hypot(crew.cart.x - p.x, crew.cart.z - p.z) > 10);
  clock.t += 1000;
  assert.equal(crew.wash(p, 0.5, 'sign'), true, 'near the sign, far from the cart');
  assert.equal(crew.wash(p, 0.5, 'cart'), false, 'but the cart is out of reach');
});

test('washing a fixture: fixtures clean 1.6x faster than the cart, and the cart stays the default', () => {
  const { crew, clock, p, fx } = washAt('stand', 2);
  setMud(crew, 0.8);
  crew.cart.mud = 0.8;
  crew.cart.x = p.x; crew.cart.z = p.z - 3;
  assert.equal(crew.wash(p, 0.5, 'stand'), true);
  near(crew.fixtures.stand, 0.8 - WASH.RATE * 1.6 * 0.5);
  assert.equal(crew.cart.mud, 0.8, 'the cart is untouched');
  clock.t += 1000;
  assert.equal(crew.wash(p, 0.5), true, 'no target: the cart');
  near(crew.cart.mud, 0.8 - WASH.RATE * 0.5);
  clock.t += 1000;
  assert.equal(crew.wash(p, 0.5, 'cart'), true);
  near(crew.cart.mud, 0.8 - 2 * WASH.RATE * 0.5);
  clock.t += 1000;
  assert.equal(crew.wash(p, 0.5, null), true, 'null target counts as the cart');
  near(crew.cart.mud, 0.8 - 3 * WASH.RATE * 0.5);
  near((0.8 - crew.fixtures.stand) / (0.8 - crew.cart.mud) * 3, 1.6);
  assert.equal(crew.stats.washed, 2);
  assert.ok(fx);
});

test('washing a fixture through input raises Curb, and so BV', () => {
  const { crew, p } = washAt('mat3', 3);
  setMud(crew, 0);
  crew.fixtures.mat3 = 1;
  const bv0 = crew.valueNow().bv, curb0 = crew.curb();
  act(crew, p, { t: 'wash', secs: 0.4, target: 'mat3' });
  near(crew.fixtures.mat3, 1 - WASH.RATE * 1.6 * 0.4);
  assert.ok(crew.curb() > curb0);
  assert.ok(crew.valueNow().bv >= bv0);
  near(crew.curb() - curb0, WASH.RATE * 1.6 * 0.4 / 12);
});

test('spotless fixture: snaps to 0 below 0.05, and the event carries its target', () => {
  const { crew, clock, p } = washAt('sign', 3);
  setMud(crew, 0);
  crew.fixtures.sign = 0.07;
  crew.flush();
  crew.wash(p, 0.5, 'sign');                           // 0.07 - 0.064 = 0.006
  assert.equal(crew.fixtures.sign, 0, 'snapped to exactly zero');
  assert.deepEqual(crew.flush().ev.filter(e => e.t === 'spotless'), [{ t: 'spotless', by: p.id, target: 'sign' }]);

  clock.t += 1000;
  crew.fixtures.sign = 0.03;                           // already under: silent
  crew.wash(p, 0.5, 'sign');
  assert.equal(crew.fixtures.sign, 0);
  assert.equal(crew.flush().ev.filter(e => e.t === 'spotless').length, 0);

  clock.t += 1000;
  crew.fixtures.sign = 0.12;                           // 0.12 - 0.064 = 0.056: close, not spotless
  crew.wash(p, 0.5, 'sign');
  near(crew.fixtures.sign, 0.056);
  assert.equal(crew.flush().ev.filter(e => e.t === 'spotless').length, 0);
});

test('spotless cart event also names its target', () => {
  const m = makeCrew({ up: { cart: 1 } });
  const p = addPlayer(m.crew, 'W', ST.x, ST.z);
  act(m.crew, p, { t: 'wand' });
  m.crew.cart.x = ST.x; m.crew.cart.z = ST.z - 4; m.crew.cart.mud = 0.07;
  m.run(1); m.crew.flush();
  m.crew.wash(p, 0.5);
  assert.deepEqual(m.crew.flush().ev.filter(e => e.t === 'spotless'), [{ t: 'spotless', by: p.id, target: 'cart' }]);
});

test('washing refuses unknown targets, a missing wand, and a cart that was never bought', () => {
  const { crew, p } = washAt('mat0', 2);
  setMud(crew, 0.5);
  assert.equal(crew.wash(p, 0.5, 'mat99'), false);
  assert.equal(crew.wash(p, 0.5, 'nope'), false);
  p.wand = false;
  assert.equal(crew.wash(p, 0.5, 'mat0'), false);
  assert.equal(crew.fixtures.mat0, 0.5);
  p.wand = true;

  const { crew: bare, p: q } = washAt('mat0', 2, {});
  assert.equal(bare.cart, null);
  setMud(bare, 0.5);
  assert.equal(bare.wash(q, 0.5), false, 'no cart to default to');
  assert.equal(bare.wash(q, 0.5, 'mat0'), true, 'fixtures need no cart');
});

test('washing refuses a target that is only a prototype property, and leaves curb a number', () => {
  const { crew, p } = washAt('mat0', 2);
  setMud(crew, 0.5);
  for (const t of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.equal(crew.wash(p, 0.5, t), false, `REAL BUG: wash target '${t}' is accepted (FIXTURE_BY_ID is a plain object, so the lookup finds Object.prototype members and the NaN range check lets it through)`);
    assert.ok(Number.isFinite(crew.curb()), `REAL BUG: after wash target '${t}' curb() is ${crew.curb()}`);
    delete crew.fixtures[t];
  }
});

test('the hose reaches the sign, the stand and every mat from the station', () => {
  for (const f of FIXTURES) assert.ok(Math.hypot(f.x - ST.x, f.z - ST.z) < WASH.HOSE, f.id);
});

// ---- morning mud -----------------------------------------------------------------

const matsMuddy = crew => Object.entries(crew.fixtures).filter(([k, v]) => k.startsWith('mat') && v === 0.95);

test('the constructor lays the morning mud', () => {
  const { crew } = makeCrew();
  assert.equal(Object.keys(crew.fixtures).length, 12);
  assert.equal(crew.fixtures.sign, 0.9);
  assert.equal(crew.fixtures.stand, 0.5);
  const n = matsMuddy(crew).length;
  assert.ok(n >= 1 && n <= 5, `${n} muddy mats (random picks can repeat)`);
  for (const [k, v] of Object.entries(crew.fixtures)) if (k.startsWith('mat')) assert.ok(v === 0 || v === 0.95, `${k} ${v}`);
});

test('day 1 starts with whatever mud there is; the mud comes back from day 2\'s start', () => {
  const { crew, run } = makeCrew(null, 5);
  setMud(crew, 0);
  crew.startShift();
  assert.equal(crew.day, 1);
  assert.ok(Object.values(crew.fixtures).every(v => v === 0), 'no overnight mud before day 1');
  run(6);
  assert.equal(crew.phase, 'report');
  setMud(crew, 0);
  crew.startShift();
  assert.equal(crew.day, 2);
  assert.equal(crew.fixtures.sign, 0.9);
  assert.equal(crew.fixtures.stand, 0.5);
  const n = matsMuddy(crew).length;
  assert.ok(n >= 1 && n <= 5, `${n} muddy mats`);
  const clean = Object.entries(crew.fixtures).filter(([k, v]) => k.startsWith('mat') && v === 0);
  assert.equal(n + clean.length, 10, 'every other mat is spotless');
});

test('a saved crew on day 3 gets the morning mud on its first shift', () => {
  const { crew } = makeCrew({ day: 3 });
  setMud(crew, 0);
  crew.startShift();
  assert.equal(crew.day, 3);
  assert.equal(crew.fixtures.sign, 0.9);
  assert.ok(matsMuddy(crew).length >= 1);
  const again = makeCrew({ day: 1 });
  setMud(again.crew, 0);
  again.crew.startShift();
  assert.equal(again.crew.fixtures.sign, 0, 'but a day-1 save does not');
});

test('during a shift the sign and stand gather dust', () => {
  const { crew, run } = makeCrew(null, 600);
  openShift(crew, 0);
  run(100);
  near(crew.fixtures.sign, 100 * 0.0008, 1e-6);
  near(crew.fixtures.stand, 100 * 0.0006, 1e-6);
  assert.equal(crew.fixtures.mat0, 0, 'mats only get scuffed by swings');
  crew.fixtures.sign = 0.9999;
  run(5);
  assert.equal(crew.fixtures.sign, 1, 'capped at 1');
});

test('each customer swing scuffs its mat by 0.006', () => {
  const { crew } = makeCrew(null, 600);
  openShift(crew, 0);
  crew.mats[2].next = 0.01;
  crew.tick(0.05);
  near(crew.fixtures.mat2, 0.006);
  for (const k of Object.keys(crew.fixtures)) if (k !== 'mat2' && k !== 'sign' && k !== 'stand') assert.equal(crew.fixtures[k], 0, k);
  assert.ok(crew.flush().ev.some(e => e.t === 'spawn'), 'a ball was hit');
  for (let i = 0; i < 4; i++) { crew.mats[2].next = 0.01; crew.tick(0.05); }
  near(crew.fixtures.mat2, 0.03);
  crew.fixtures.mat2 = 0.998;
  crew.mats[2].next = 0.01; crew.tick(0.05);
  assert.equal(crew.fixtures.mat2, 1, 'capped at 1');
});

test('no swing, no scuff: a full field leaves the mat clean', () => {
  const { crew } = makeCrew(null, 600);
  openShift(crew, 0);
  for (let i = 0; i < SIM.MAX_BALLS; i++) crew.balls.set(-i - 1, { id: -i - 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rest: true });
  crew.mats[2].next = 0.01;
  crew.tick(0.05);
  assert.equal(crew.fixtures.mat2, 0);
});

// ---- ball weights, end to end ------------------------------------------------------

test('KIND_W: the council weights for every ball type', () => {
  assert.deepEqual(KIND_W, { range: 1, glow: 2, lead: 3, square: 2, gold: 10, splitter: 1, bouncy: 1.5, debris: 3 });
});

test('a player\'s pocket carries weights: a range, glow and lead ball bank for 6 x BV', () => {
  const { crew } = makeCrew(null, 600);
  openShift(crew, 0);
  const a = addPlayer(crew, 'A', STAND.x, STAND.z);
  const ids = [restingBall(crew, a.x, a.z, 'range').id, restingBall(crew, a.x, a.z, 'glow').id, restingBall(crew, a.x, a.z, 'lead').id];
  for (const id of ids) assert.deepEqual(act(crew, a, { t: 'pickup', ball: id }).denied, []);
  assert.equal(a.pocket, 3);
  assert.equal(a.pocketW, 6);
  crew.flush();
  act(crew, a, { t: 'deposit' });
  assert.equal(a.pocket, 0);
  assert.equal(a.pocketW, 0);
  assert.equal(crew.cash, 11.25, '6 x BV 1.5, a clean Rat (grime 0) has Gear 1.25');
  assert.equal(crew.stats.deposited, 3, 'the count is balls, not weight');
  assert.equal(crew.stats.cash, 11.25);
  const ev = crew.flush().ev.find(e => e.t === 'cash');
  assert.equal(ev.n, 3);
  assert.equal(ev.cash, 11.25);
  assert.equal(ev.per, 3.75);
});

test('a ball of no known kind weighs 1', () => {
  const { crew } = makeCrew(null, 600);
  openShift(crew, 0);
  const a = addPlayer(crew, 'A', STAND.x, STAND.z);
  act(crew, a, { t: 'pickup', ball: restingBall(crew, a.x, a.z).id });
  act(crew, a, { t: 'pickup', ball: restingBall(crew, a.x, a.z, 'mystery').id });
  assert.equal(a.pocketW, 2);
});

test('a knock-down spills the pocket and resets its weight', () => {
  const { crew } = makeCrew(null, 600);
  openShift(crew, 0);
  const a = addPlayer(crew, 'A', STAND.x, STAND.z);
  act(crew, a, { t: 'pickup', ball: restingBall(crew, a.x, a.z, 'lead').id });
  act(crew, a, { t: 'pickup', ball: restingBall(crew, a.x, a.z, 'glow').id });
  assert.equal(a.pocketW, 5);
  crew.knockDown(a);
  assert.equal(a.pocket, 0);
  assert.equal(a.pocketW, 0);
  a.down = 0;
  act(crew, a, { t: 'pickup', ball: restingBall(crew, a.x, a.z, 'range').id });
  assert.equal(a.pocketW, 1, 'only the new ball counts');
  act(crew, a, { t: 'deposit' });
  assert.equal(crew.cash, 1.75, 'BV 1.5 x Gear 1.1667: the knock-down left one layer of grime');
});

test('the cart\'s load carries weights, and a cart deposit adds Gear 1 + 0.25 x cleanliness', () => {
  const { crew, run } = makeCrew({ up: { cart: 1 } }, 600);
  openShift(crew, 0);
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  const c = crew.cart, r = reelCentre(c);
  act(crew, a, { t: 'pickup', ball: restingBall(crew, r.x, r.z, 'glow').id, cart: true },
    { t: 'pickup', ball: restingBall(crew, r.x, r.z, 'lead').id, cart: true });
  assert.equal(c.load, 2);
  assert.equal(c.loadW, 5);
  crew.flush();
  c.x = STAND.x + 2; c.z = STAND.z + 2; c.mud = 0;
  run(0.25);
  assert.equal(c.load, 0);
  assert.equal(c.loadW, 0);
  assert.equal(crew.cash, 9.38, '5 x BV 1.5 x Gear 1.25 = 9.375');
  const ev = crew.flush().ev.find(e => e.t === 'cash' && e.kind === 'cart');
  assert.equal(ev.n, 2);
  assert.equal(ev.cash, 9.38);
});

test('a filthy cart only loses its Gear bonus; Hustle stacks on top', () => {
  const { crew } = makeCrew({ up: { cart: 1 } }, 600);
  setMud(crew, 0);
  crew.mult = 2;
  crew.cart.mud = 1;
  crew.bank(4, 'x', 'cart', 4);
  assert.equal(crew.cash, 12, '4 x 1.5 x 2 x Gear 1');
  crew.cart.mud = 0.5;
  crew.bank(4, 'x', 'cart', 4);
  assert.equal(crew.cash, 12 + 13.5, '4 x 1.5 x 2 x Gear 1.125');
  crew.bank(4, 'x', 'helper', 4);
  assert.equal(crew.cash, 12 + 13.5 + 12, 'helpers have Gear 1');
});

test('helpers pick up by weight and bank it', () => {
  const { crew, run } = makeCrew({ up: { helpers: 1 } }, 600);
  openShift(crew, 0);
  const h = crew.helpers[0];
  restingBall(crew, h.x + 0.3, h.z, 'lead');
  run(0.5);
  assert.equal(crew.stats.helped, 1);
  assert.equal(h.pocket, 0);
  assert.equal(h.pocketW, 0);
  assert.equal(crew.cash, 4.5, 'a lead ball: 3 x BV 1.5');
});

test('at closing, helpers and the cart turn in their weighted loads', () => {
  const { crew, run } = makeCrew({ up: { helpers: 1, cart: 1 } }, 5);
  openShift(crew, 0);
  const h = crew.helpers[0];
  h.x = -100; h.z = -100; h.pocket = 2; h.pocketW = 5;
  crew.cart.load = 2; crew.cart.loadW = 5; crew.cart.mud = 0;
  run(6);
  assert.equal(crew.phase, 'report');
  assert.equal(h.pocketW, 0);
  assert.equal(crew.cart.loadW, 0);
  assert.equal(crew.report.deposited, 4);
  near(crew.report.cash, 7.5 + 9.38, 1e-9);   // helper 5 x 1.5, cart 5 x 1.5 x 1.25
});

// ---- Last Call -------------------------------------------------------------------

const spawns = ev => ev.filter(e => e.t === 'spawn');

test('Last Call: from day 2, the last 60 s; customer balls glow and the bell rings once', () => {
  assert.equal(LAST_CALL.SECS, 60);
  assert.equal(LAST_CALL.FROM_DAY, 2);
  const { crew } = makeCrew({ day: 2 }, 120);
  crew.startShift();
  const online = addPlayer(crew, 'A', 100, 5);          // a crew on the range: customers keep coming
  assert.equal(crew.lastCall(), false);
  let all = [], rung = 0;
  const step = secs => { for (let i = 0; i < secs * 20; i++) { crew.tick(0.05); const ev = crew.flush().ev; rung += ev.filter(e => e.t === 'lastcall').length; all = all.concat(ev); } };
  step(59);
  assert.equal(crew.lastCall(), false);
  assert.equal(crew.snapshot().lastCall, false);
  const before = spawns(all);
  assert.ok(before.length > 3, `${before.length} customer swings`);
  assert.ok(before.every(e => e.kind === 'range'), 'ordinary balls before Last Call');
  assert.equal(all.filter(e => e.t === 'lastcall').length, 0);
  step(1.5);
  assert.equal(crew.lastCall(), true);
  assert.equal(crew.snapshot().lastCall, true);
  all = [];
  step(30);
  const during = spawns(all);
  assert.ok(during.length > 3, `${during.length} swings in Last Call`);
  assert.ok(during.every(e => e.kind === 'glow'), 'glow balls');
  assert.equal(rung, 1, 'rung once, not every tick');
  assert.ok([...crew.balls.values()].filter(b => b.kind).every(b => b.kind === 'glow' || b.kind === 'range'));
  assert.ok(online);
});

test('Last Call: the swings come 1.5x as often', () => {
  const gap = shiftT => {
    const { crew } = makeCrew({ day: 2 }, 300);
    openShift(crew);
    crew.rng = () => 0.5;                              // swingGap = 4 + 0.5 x 8 = 8
    crew.shiftT = shiftT;
    crew.mats[0].next = 0.01;
    crew.tick(0.05);
    return crew.mats[0].next;
  };
  near(gap(10), 8);
  near(gap(300 - 61), 8, 1e-9);
  near(gap(300 - 59), 8 / LAST_CALL.SWING);
  near(gap(300 - 59) * 1.5, 8);
});

test('Last Call does not happen on day 1, and rings again on the next day\'s shift', () => {
  const { crew, run } = makeCrew(null, 120);
  crew.startShift();
  addPlayer(crew, 'A', 100, 5);
  let all = [];
  for (let i = 0; i < 115 * 20; i++) { crew.tick(0.05); all = all.concat(crew.flush().ev); }
  assert.equal(crew.day, 1);
  assert.equal(crew.lastCall(), false);
  assert.equal(all.filter(e => e.t === 'lastcall').length, 0);
  assert.ok(spawns(all).length > 5);
  assert.ok(spawns(all).every(e => e.kind === 'range'), 'no glow balls on day 1');

  // Day 2 and day 3 each ring once.
  for (const day of [2, 3]) {
    crew.shiftT = crew.shiftSecs; crew.tick(0.05);       // closing
    assert.equal(crew.phase, 'report');
    crew.startShift();
    assert.equal(crew.day, day);
    crew.flush();
    let ev = [];
    for (let i = 0; i < 55 * 20; i++) { crew.tick(0.05); ev = ev.concat(crew.flush().ev); }
    assert.equal(ev.filter(e => e.t === 'lastcall').length, 0, 'the first 55 s of a 120 s day: not yet');
    for (let i = 0; i < 50 * 20; i++) { crew.tick(0.05); ev = ev.concat(crew.flush().ev); }
    assert.equal(ev.filter(e => e.t === 'lastcall').length, 1, `day ${day}`);
  }
  assert.ok(run);
});

test('lastCall() is false in the lobby and in the report', () => {
  const { crew } = makeCrew({ day: 5 }, 100);
  assert.equal(crew.lastCall(), false);
  crew.startShift();
  crew.shiftT = 99;
  assert.equal(crew.lastCall(), true);
  crew.endShift();
  assert.equal(crew.lastCall(), false);
});

// ---- the quota -------------------------------------------------------------------

test('quotaQ: none on day 1, then a floor of 0.3 (round 6 #1): 0.30 / 0.30 / 0.30 / 0.35 and +0.05 a day, capped by the ceiling', () => {
  assert.equal(quotaQ(1, 1.5), null);
  assert.equal(quotaQ(0, 1.5), null);
  assert.equal(quotaQ(2, 2.5), 0.3);
  assert.equal(quotaQ(3, 2.5), 0.3);
  assert.equal(quotaQ(4, 2.5), 0.3);
  assert.equal(quotaQ(5, 2.5), 0.35);
  near(quotaQ(6, 2.5), 0.4);
  near(quotaQ(9, 2.5), 0.55);
  near(quotaQ(2, upkeepCeiling({})), 0.3);
  near(quotaQ(6, upkeepCeiling({})), 0.4, 1e-9);          // day 6 asks 0.4, which is also the Curb-alone cap
  near(quotaQ(30, upkeepCeiling({})), 0.4, 1e-9);        // 0.8 x (1.5 - 1): Curb alone cannot be asked for more
});

test('no quota on day 1: the memo says welcome, the report has no quota', () => {
  const { crew, run } = makeCrew(null, 5);
  crew.startShift();
  assert.equal(crew.quota, null);
  const ev = crew.flush().ev;
  const memo = ev.filter(e => e.t === 'memo');
  assert.equal(memo.length, 1);
  assert.equal(memo[0].day, 1);
  assert.equal(memo[0].target, null);
  assert.match(memo[0].text, /Welcome to the Muni Range/);
  assert.equal(crew.snapshot().quota, null);
  run(6);
  assert.equal(crew.report.quota, null);
  assert.equal(crew.stamps, 0);
  assert.equal(crew.flush().ev.filter(e => e.t === 'quota').length, 0, 'no quota event either');
});

test('the day-2 target is Rate x (1 + 0.30), set at the start of the shift (round 6 #1: the 0.3 floor)', () => {
  const { crew } = makeCrew({ day: 2 }, 600);
  crew.startShift();
  assert.deepEqual(crew.quota, { q: 0.3 }, 'the quota stores only q; the target follows the live Rate');
  assert.equal(crew.quotaTarget(), 1.3);
  assert.deepEqual(crew.snapshot().quota, { q: 0.3, target: 1.3 });
  const memo = crew.flush().ev.find(e => e.t === 'memo');
  assert.equal(memo.day, 2);
  assert.equal(memo.target, 1.3);
  assert.match(memo.text, /\$1\.30/);

  const { crew: b } = makeCrew({ day: 2, up: { washer: 1 }, commendations: 4 }, 600);
  b.startShift();
  assert.equal(b.quotaTarget(), 3.12, 'rate 2 x 1.2 = 2.4, x 1.3');
  assert.match(b.flush().ev.find(e => e.t === 'memo').text, /\$3\.12/);

  assert.equal(makeCrew({ day: 3 }).crew.quota, null, 'nothing before the shift starts');
  const d3 = makeCrew({ day: 3 }).crew; d3.startShift();
  assert.deepEqual(d3.quota, { q: 0.3 });
  assert.equal(d3.quotaTarget(), 1.3);
  const d6 = makeCrew({ day: 6 }).crew; d6.startShift();
  assert.equal(d6.quotaTarget(), 1.4);
});

test('the target ignores curb; a purchase moves the target WITH the Rate, so it cannot buy the quota', () => {
  const { crew } = makeCrew({ day: 2 }, 600);
  crew.startShift();
  assert.equal(crew.quotaTarget(), 1.3, 'the morning mud does not change the goalposts');
  crew.cash = 1000;
  const p = addPlayer(crew, 'A', 0, 0);
  act(crew, p, { t: 'buy', id: 'washer' });
  assert.equal(crew.quota.q, 0.3, 'q is fixed for the shift');
  assert.equal(crew.quotaTarget(), 2.6, 'Rate 2 x (1 + 0.3): the red line rides up with the purchase');
});

test('hitting the quota: bonus of 15% of the day\'s cash, a stamp, a quota event, in the report', () => {
  const { crew, run } = makeCrew({ day: 2 }, 5);
  openShift(crew, 0);                                   // Curb 1: BV 1.5 against a target of 1.3
  crew.bank(10, 'x');
  assert.equal(crew.stats.cash, 15);
  run(6);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.stamps, 1);
  assert.equal(crew.cash, 17.25, '15 + bonus 2.25');
  assert.equal(crew.report.cash, 15, 'the report\'s day cash excludes the bonus');
  assert.equal(crew.report.bank, 17.25);
  const q = crew.report.quota;
  assert.equal(q.hit, true);
  assert.equal(q.target, 1.3);
  assert.equal(q.bv, 1.5);
  assert.equal(q.bonus, 2.25);
  assert.equal(q.stamps, 1);
  assert.equal(q.title, 'Range Rat');
  const evs = crew.flush().ev.filter(e => e.t === 'quota');
  assert.equal(evs.length, 1);
  assert.deepEqual(evs[0], { t: 'quota', ...q });
});

test('a third stamp makes you Range Rat II, in the report', () => {
  const { crew, run } = makeCrew({ day: 2, stamps: 2 }, 5);
  openShift(crew, 0);
  crew.bank(1, 'x');
  run(6);
  assert.equal(crew.stamps, 3);
  assert.equal(crew.report.quota.title, 'Range Rat', 'titles come from the venue now, not from stamps');
  assert.equal(crew.title(), 'Range Rat');
});

test('missing the quota: no bonus, no stamp, still an event and a report entry', () => {
  const { crew, run } = makeCrew({ day: 2 }, 5);
  openShift(crew, 1);                                   // a filthy range: BV 1.00 against 1.3
  crew.bank(10, 'x');
  assert.equal(crew.stats.cash, 10);
  run(6);
  assert.equal(crew.stamps, 0);
  assert.equal(crew.cash, 10, 'no bonus');
  const q = crew.report.quota;
  assert.equal(q.hit, false);
  assert.equal(q.bonus, 0);
  assert.equal(q.bv, 1);
  assert.equal(q.target, 1.3);
  assert.equal(q.stamps, 0);
  assert.equal(crew.flush().ev.filter(e => e.t === 'quota').length, 1);
});

test('the quota is judged on BV at the bell: scrubbing in the last second counts, scuffing at the bell hurts', () => {
  const { crew } = makeCrew({ day: 2 }, 100);
  openShift(crew, 1);
  crew.bank(2, 'x');
  setMud(crew, 0);                                      // everything washed before the bell
  crew.shiftT = 100;
  crew.tick(0.05);
  assert.equal(crew.report.quota.hit, true);
  assert.equal(crew.report.quota.bv, 1.5);
});

test('exactly on target is a hit', () => {
  const { crew, run } = makeCrew({ day: 2 }, 5);
  openShift(crew, 0.4);                                 // Curb 0.6: Upkeep 1.3, BV 1.3 = target
  crew.bank(1, 'x');
  run(6);
  assert.equal(crew.report.quota.bv, 1.3);
  assert.equal(crew.report.quota.target, 1.3);
  assert.equal(crew.report.quota.hit, true);
  assert.equal(crew.stamps, 1);
});

test('a bonus is 15% of the day cash only, not of the whole bank', () => {
  const { crew, run } = makeCrew({ day: 2, cash: 100 }, 5);
  openShift(crew, 0);
  crew.bank(10, 'x');
  run(6);
  assert.equal(crew.report.quota.hit, true);
  assert.equal(crew.report.quota.bonus, 2.25);
  assert.equal(crew.cash, 117.25);
});

test('a day with no deposits is a MISS even when BV beats the target', () => {
  const { crew, run } = makeCrew({ day: 2, cash: 100 }, 5);
  openShift(crew, 0);                                   // BV 1.5 >= 1.3
  run(6);
  const q = crew.report.quota;
  assert.ok(q.bv >= q.target);
  assert.equal(q.hit, false, 'Corporate does not stamp a crew that banked nothing');
  assert.equal(q.bonus, 0);
  assert.equal(crew.stamps, 0);
  assert.equal(crew.cash, 100);
  assert.equal(crew.flush().ev.filter(e => e.t === 'quota' && !e.hit).length, 1);
});

test('titles come from the venue, never from stamps; endless mode is Owner', () => {
  const title = save => makeCrew(save).crew.title();
  for (const stamps of [0, 2, 3, 5, 6, 40]) assert.equal(title({ stamps }), 'Range Rat', 'stamps ' + stamps);
  VENUE_RULES.forEach((r, v) => assert.equal(title({ venue: v }), r.title, 'venue ' + v));
  assert.equal(title({ venue: 5, endless: true }), 'Owner');
  assert.equal(makeCrew({ stamps: 3 }).crew.snapshot().title, 'Range Rat');
  assert.equal(makeCrew({ stamps: 3 }).crew.snapshot().stamps, 3);
});

test('stamps and commendations are saved and restored', () => {
  const { crew } = makeCrew({ stamps: 4, commendations: 3 });
  assert.equal(crew.stamps, 4);
  assert.equal(crew.commendations, 3);
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.equal(save.stamps, 4);
  assert.equal(save.commendations, 3);
  const { crew: back } = makeCrew(save);
  assert.equal(back.stamps, 4);
  assert.equal(back.commendations, 3);
  assert.equal(back.title(), 'Range Rat');
  const s = back.snapshot();
  assert.equal(s.stamps, 4);
  assert.equal(s.commendations, 3);
  assert.equal(s.value.rate, 1.15);
});

test('a stamp earned today is in the save', () => {
  const { crew, run } = makeCrew({ day: 2, stamps: 2 }, 5);
  openShift(crew, 0);
  crew.bank(1, 'x');
  run(6);
  assert.equal(crew.toSave().stamps, 3);
  assert.equal(crew.toSave().day, 3);
  assert.equal(makeCrew(crew.toSave()).crew.stamps, 3);
  assert.equal(makeCrew(crew.toSave()).crew.title(), 'Range Rat');
});

test('junk stamps and commendations in a save are cleaned', () => {
  for (const junk of [undefined, null, 'x', NaN, -3]) {
    const { crew } = makeCrew({ stamps: junk, commendations: junk });
    assert.equal(crew.stamps, 0, String(junk));
    assert.equal(crew.commendations, 0, String(junk));
  }
  assert.equal(makeCrew({ stamps: 2.9 }).crew.stamps, 2);
  assert.equal(makeCrew({ commendations: 11 }).crew.commendations, 10);
});

// ---- the counters ------------------------------------------------------------------

test('outstanding = BALLS_OUTSTANDING - all-time deposited - today; silo is today\'s deposits', () => {
  const { crew } = makeCrew({ totals: { deposited: 1000 } }, 600);
  openShift(crew, 0);
  let s = crew.snapshot();
  assert.equal(s.outstanding, BALLS_OUTSTANDING - 1000);
  assert.equal(s.silo, 0);
  crew.bank(5, 'x');
  s = crew.snapshot();
  assert.equal(s.silo, 5);
  assert.equal(s.outstanding, BALLS_OUTSTANDING - 1005);
  crew.bank(7, 'x', 'helper', 7);
  s = crew.snapshot();
  assert.equal(s.silo, 12);
  assert.equal(s.outstanding, BALLS_OUTSTANDING - 1012);
  assert.equal(BALLS_OUTSTANDING, 4_213_377_019);
});

test('outstanding counts balls, not weight', () => {
  const { crew } = makeCrew(null, 600);
  openShift(crew, 0);
  crew.bank(3, 'x', null, 8);
  assert.equal(crew.snapshot().silo, 3);
  assert.equal(crew.snapshot().outstanding, BALLS_OUTSTANDING - 3);
});

test('outstanding does not double count today once the shift is banked into the totals', () => {
  const { crew, run } = makeCrew(null, 5);
  openShift(crew, 0);
  crew.bank(5, 'x');
  const during = crew.snapshot().outstanding;
  assert.equal(during, BALLS_OUTSTANDING - 5);
  run(6);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.totals.deposited, 5);
  assert.equal(crew.snapshot().outstanding, BALLS_OUTSTANDING - 5,
    'the report-phase snapshot must not subtract today twice (outstanding is a stored field now)');
  openShift(crew, 0);
  assert.equal(crew.snapshot().outstanding, BALLS_OUTSTANDING - 5, 'next morning it is right again');
});

// ---- memos and tomorrow ------------------------------------------------------------

test('a memo fires at every shift start, with text, and a target from day 2', () => {
  const { crew, run } = makeCrew(null, 5);
  const seen = [];
  for (let d = 1; d <= 4; d++) {
    crew.startShift();
    const memos = crew.flush().ev.filter(e => e.t === 'memo');
    assert.equal(memos.length, 1, `day ${d}`);
    assert.equal(memos[0].day, d);
    assert.equal(typeof memos[0].text, 'string');
    assert.ok(memos[0].text.length > 20);
    if (d === 1) assert.equal(memos[0].target, null);
    else {
      assert.equal(typeof memos[0].target, 'number');
      assert.equal(memos[0].target, crew.quotaTarget());
      assert.match(memos[0].text, new RegExp('\\$' + memos[0].target.toFixed(2).replace('.', '\\.')));
    }
    seen.push(memos[0].text);
    run(6);
    crew.flush();
  }
  assert.ok(new Set(seen).size > 1, 'the memos are not all the same');
});

test('the report says what is coming tomorrow', () => {
  const { crew, run } = makeCrew(null, 5);
  const tomorrow = [];
  for (let d = 1; d <= 4; d++) {
    crew.startShift();
    run(6);
    assert.equal(typeof crew.report.tomorrow, 'string');
    assert.ok(crew.report.tomorrow.length > 10);
    tomorrow.push(crew.report.tomorrow);
  }
  assert.equal(tomorrow[0], 'Tomorrow: a target. Hose before the bell.', 'council round 6 #1');
  assert.ok(tomorrow[0].split(/s+/).length <= 8);
  assert.match(tomorrow[1], /gold/, 'day 3 brings gold');
  assert.match(tomorrow[2], /Gary from Regional/, 'Gary inspects on day 4 (playtest)');
  assert.ok(new Set(tomorrow).size >= 3);
});

test('a full week: day 1 clean, then quota, mud and Last Call from day 2', () => {
  const { crew, run } = makeCrew(null, 120);
  crew.startShift();
  assert.equal(crew.quota, null);
  assert.equal(crew.snapshot().lastCall, false);
  crew.shiftT = 119.99; crew.tick(0.05);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.report.quota, null);

  setMud(crew, 0);
  crew.startShift();
  assert.equal(crew.day, 2);
  assert.equal(crew.quota.q, 0.3);
  assert.equal(crew.fixtures.sign, 0.9);
  assert.equal(crew.snapshot().quota.target, 1.3);
  crew.shiftT = 61;
  assert.equal(crew.snapshot().lastCall, true);
  assert.ok(run);
});

// ---- council round 6 #1: the Muni stamps are earned ------------------------------------------------------------
// A seeded 4P Muni day 2 at full length, customers swinging all shift: an idle crew misses the 0.3 floor, and a crew
// that hoses every fixture once in the morning hits it.
function muniDay2(hose, seed = 7) {
  const { crew, run } = makeCrew({ day: 1 }, null, seed);
  const ps = ['A', 'B', 'C', 'D'].map((n, i) => addPlayer(crew, n, ST.x + i, ST.z));
  crew.startShift(); crew.shiftT = crew.shiftSecs; crew.tick(0.05);   // day 1 done
  crew.startShift();
  assert.equal(crew.day, 2);
  assert.equal(crew.quota.q, 0.3);
  crew.bank(20, 'x');                                    // deposits, so only Upkeep decides the stamp
  if (hose) {
    const p = ps[0]; p.wand = true; p.washAt = crew.now();
    for (const fx of FIXTURES) {
      p.x = fx.x; p.z = fx.z + 0.5;
      for (let i = 0; i < 40 && crew.fixtures[fx.id] > 0; i++) { run(0.5); crew.wash(p, 0.5, fx.id); }
    }
  }
  while (crew.phase === 'shift') run(1);
  const q = crew.report.quota;
  return { upkeep: q.bv / crew.valueNow().rate, hit: q.hit, target: q.target };
}
test('round 6 #1: a 4P Muni day 2 with no hosing misses (Upkeep < 1.30); hosing every fixture once hits', () => {
  const idle = muniDay2(false), hosed = muniDay2(true);
  assert.ok(idle.upkeep < 1.3, `idle Upkeep ${idle.upkeep}`);
  assert.equal(idle.hit, false);
  assert.ok(hosed.upkeep >= 1.3, `hosed Upkeep ${hosed.upkeep}`);
  assert.equal(hosed.hit, true);
});
