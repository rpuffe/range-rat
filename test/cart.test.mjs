import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew, PING_PRIZES } from '../server/crew.mjs';
import { SIM, CART, BAYS, perks, underReels } from '../web/js/sim.js';

// A crew on a fake clock. `run(secs)` steps 20 ticks a second (use multiples of 0.25 to avoid float drift).
function makeCrew(save = { up: { cart: 1 } }, shiftSecs = 600) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('CART', save, { shiftSecs, seed: 5, now: () => clock.t });
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;   // Curb Appeal 1: Upkeep 1.5, so the cash below is exact
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}

function addPlayer(crew, name, x, z) {
  const p = crew.join(name);
  crew.connect(p);
  p.x = x; p.z = z;
  return p;
}

// Open a shift with no customers, so only what the test places is on the range.
function openShift(crew) {
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  crew.flush();
}

const act = (crew, p, ...a) => crew.input(p, { a });
const restingBall = (crew, x, z) => {
  const b = crew.addBall({ x, y: SIM.BALL_R, z, vx: 0, vy: 0, vz: 0 });
  b.rest = true;
  return b;
};
// A fast, level-ish ball aimed straight at the cart's centre from 6 m away.
const shootAtCart = (crew, by = null) => {
  const c = crew.cart;
  const s = { x: c.x - 6, y: 1, z: c.z, vx: 20, vy: 1, vz: 0 };
  if (by) s.by = by;
  return crew.addBall(s);
};
const pings = crew => crew.events.filter(e => e.t === 'ping');
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const reelCentre = c => ({ x: c.x - Math.sin(c.yaw) * CART.REEL_AHEAD, z: c.z - Math.cos(c.yaw) * CART.REEL_AHEAD });

// Drive the cart toward (x, z) in small, plausible steps, as a real client would.
function driveCart(crew, p, run, x, z) {
  for (let i = 0; i < 100; i++) {
    const c = crew.cart, d = Math.hypot(x - c.x, z - c.z);
    if (d < 0.05) return;
    const k = Math.min(1, 2 / d);
    run(0.25);
    crew.input(p, { cart: { x: c.x + (x - c.x) * k, z: c.z + (z - c.z) * k, yaw: c.yaw } });
  }
  assert.fail('cart never arrived');
}

// ---- 1. the cart exists only once bought -------------------------------------

test('no cart without the upgrade; snapshot reports none and boarding does nothing', () => {
  const { crew } = makeCrew({});
  assert.equal(crew.cart, null);
  assert.equal(crew.snapshot().cart, null);
  const p = addPlayer(crew, 'A', 31, 10);
  act(crew, p, { t: 'board' }, { t: 'leave' });
  assert.equal(crew.cart, null);
  assert.equal(crew.driving(p), false);
});

test('with up.cart the cart exists, parked, and the snapshot reports it', () => {
  const { crew } = makeCrew();
  assert.ok(crew.cart);
  assert.equal(crew.cart.x, CART.PARK.x);
  assert.equal(crew.cart.z, CART.PARK.z);
  assert.equal(crew.cart.yaw, CART.PARK.yaw);
  assert.equal(crew.cart.driver, null);
  assert.equal(crew.cart.load, 0);
  const s = crew.snapshot().cart;
  assert.equal(s.x, CART.PARK.x);
  assert.equal(s.z, CART.PARK.z);
  assert.equal(s.driver, null);
  assert.equal(s.load, 0);
  assert.equal(s.boost, 0);
});

test('buying the cart in the shop creates it (cash needed, outside a shift)', () => {
  const { crew } = makeCrew({});
  const p = addPlayer(crew, 'A', 20, 2);
  act(crew, p, { t: 'buy', id: 'cart' });
  assert.equal(crew.cart, null, 'no cash, no cart');
  crew.cash = 700;
  act(crew, p, { t: 'buy', id: 'cart' });
  assert.equal(crew.up.cart, 1);
  assert.equal(crew.cash, 100);
  assert.ok(crew.cart, 'cart created on purchase');
  assert.equal(crew.cart.x, CART.PARK.x);
  assert.ok(crew.snapshot().cart);
  assert.equal(crew.perks.cartCap, 300);
});

test('cart tier 2 (wide reels) improves perks and keeps the same cart object', () => {
  const { crew } = makeCrew();
  const before = crew.cart;
  crew.cash = 1500;
  const p = addPlayer(crew, 'A', 20, 2);
  act(crew, p, { t: 'buy', id: 'cart' });
  assert.equal(crew.up.cart, 2);
  assert.equal(crew.cart, before);
  assert.equal(crew.perks.cartCap, 600);
  assert.ok(crew.perks.cartReel > perks({ cart: 1 }).cartReel);
  assert.ok(crew.perks.cartSpeed > perks({ cart: 1 }).cartSpeed);
});

// ---- 2. boarding -------------------------------------------------------------

test('boarding needs you within BOARD_REACH', () => {
  const { crew } = makeCrew();
  const p = addPlayer(crew, 'A', CART.PARK.x - CART.BOARD_REACH - 0.5, CART.PARK.z);
  act(crew, p, { t: 'board' });
  assert.equal(crew.cart.driver, null, 'too far');
  p.x = CART.PARK.x - CART.BOARD_REACH + 0.3;
  act(crew, p, { t: 'board' });
  assert.equal(crew.cart.driver, p.id);
  assert.ok(crew.events.some(e => e.t === 'board' && e.by === p.id));
  assert.equal(crew.snapshot().cart.driver, p.id);
});

test('boarding puts the driver on the cart', () => {
  const { crew } = makeCrew();
  const p = addPlayer(crew, 'A', CART.PARK.x - 2, CART.PARK.z + 1);
  act(crew, p, { t: 'board' });
  assert.equal(p.x, crew.cart.x);
  assert.equal(p.z, crew.cart.z);
});

test('you cannot board while knocked down', () => {
  const { crew } = makeCrew();
  const p = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  crew.knockDown(p);
  assert.ok(p.down > 0);
  act(crew, p, { t: 'board' });
  assert.equal(crew.cart.driver, null);
});

test('a second player cannot board an occupied cart; leaving frees it', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  const b = addPlayer(crew, 'B', CART.PARK.x + 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  assert.equal(crew.cart.driver, a.id);
  act(crew, b, { t: 'board' });
  assert.equal(crew.cart.driver, a.id, 'still A');
  act(crew, b, { t: 'leave' });
  assert.equal(crew.cart.driver, a.id, 'a non-driver cannot kick the driver out');

  act(crew, a, { t: 'leave' });
  assert.equal(crew.cart.driver, null);
  assert.ok(crew.events.some(e => e.t === 'unboard' && e.by === a.id));
  assert.ok(dist(a, crew.cart) < 2, 'steps out beside the cart');
  assert.ok(dist(a, crew.cart) > 0.5, 'but not inside it');
  act(crew, b, { t: 'board' });
  assert.equal(crew.cart.driver, b.id, 'free again');
});

test('leave when not driving does nothing', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', 5, 5);
  act(crew, a, { t: 'leave' });
  assert.equal(a.x, 5);
  assert.equal(a.z, 5);
  assert.ok(!crew.events.some(e => e.t === 'unboard'));
});

// ---- 3. driving --------------------------------------------------------------

test('the reported cart pose is clamped: a teleport moves it only a little', () => {
  const { crew, clock } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  clock.t += 50;
  crew.input(a, { cart: { x: -100, z: -200, yaw: 1.25 } });
  const moved = dist(crew.cart, CART.PARK);
  assert.ok(moved > 0, 'it did move toward the target');
  assert.ok(moved <= 1.3, `moved ${moved.toFixed(2)} m in 50 ms`);
  assert.ok(crew.cart.x < CART.PARK.x && crew.cart.z < CART.PARK.z, 'toward the reported pose');
  assert.equal(crew.cart.yaw, 1.25);
});

test('the driver position follows the cart', () => {
  const { crew, run } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  run(0.5);
  crew.input(a, { cart: { x: CART.PARK.x - 2, z: CART.PARK.z - 1, yaw: 0.5 } });
  assert.equal(a.x, crew.cart.x);
  assert.equal(a.z, crew.cart.z);
  assert.equal(a.yaw, crew.cart.yaw);
  assert.ok(crew.cart.x < CART.PARK.x);
  const s = crew.snapshot();
  assert.equal(s.cart.x, s.players[0].x);
  assert.equal(s.cart.z, s.players[0].z);
});

test('the driver\'s on-foot position reports are ignored while driving', () => {
  const { crew, run } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  run(0.5);
  crew.input(a, { x: 0, z: 0, cart: { x: CART.PARK.x, z: CART.PARK.z, yaw: CART.PARK.yaw } });
  assert.equal(a.x, crew.cart.x);
  assert.equal(a.z, crew.cart.z);
});

test('a non-driver\'s cart pose is ignored', () => {
  const { crew, run } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  const b = addPlayer(crew, 'B', CART.PARK.x + 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  run(0.5);
  const before = { ...crew.cart };
  crew.input(b, { cart: { x: 0, z: 0, yaw: 2 } });
  assert.equal(crew.cart.x, before.x);
  assert.equal(crew.cart.z, before.z);
  assert.equal(crew.cart.yaw, before.yaw);

  // and with nobody driving, nobody can push it either
  act(crew, a, { t: 'leave' });
  const parked = { ...crew.cart };
  run(0.5);
  crew.input(a, { cart: { x: 0, z: 0, yaw: 2 } });
  crew.input(b, { cart: { x: 0, z: 0, yaw: 2 } });
  assert.equal(crew.cart.x, parked.x);
  assert.equal(crew.cart.z, parked.z);
});

test('the cart stays inside the field and ignores junk poses', () => {
  const { crew, run } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  for (let i = 0; i < 60; i++) { run(0.25); crew.input(a, { cart: { x: 1e6, z: 1e6, yaw: 0 } }); }
  assert.ok(crew.cart.x <= SIM.FIELD.xMax);
  assert.ok(crew.cart.z <= SIM.FIELD.zMax + 6);
  assert.ok(crew.cart.x > CART.PARK.x, 'it did drive');
  crew.input(a, { cart: { x: NaN, z: 5, yaw: 0 } });
  assert.ok(Number.isFinite(crew.cart.x) && Number.isFinite(crew.cart.z));
});

// ---- 4. scooping -------------------------------------------------------------

test('scooping a resting ball under the reels fills the cart, not the pocket', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  crew.phase = 'shift';
  const c = crew.cart;
  const b = restingBall(crew, reelCentre(c).x, reelCentre(c).z);
  assert.ok(underReels(c, b, crew.perks.cartReel), 'sanity: the ball is under the reels');
  const r = act(crew, a, { t: 'pickup', ball: b.id, cart: true });
  assert.deepEqual(r.denied, []);
  assert.equal(c.load, 1);
  assert.equal(a.pocket, 0);
  assert.equal(crew.balls.has(b.id), false);
  assert.equal(crew.stats.carted, 1);
  assert.equal(crew.stats.picked, 1);
  assert.ok(crew.events.some(e => e.t === 'gone' && e.id === b.id && e.by === a.id));
  assert.equal(crew.snapshot().cart.load, 1);
});

test('scooping works for a ball near the reels, and is denied far away, in the air, or unknown', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  crew.phase = 'shift';
  const c = crew.cart, r = reelCentre(c);
  const slack = crew.perks.cartReel / 2 + 1.5;

  const near = restingBall(crew, r.x + slack - 0.2, r.z);
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: near.id, cart: true }).denied, [], 'just inside the slack');
  assert.equal(c.load, 1);

  const edge = restingBall(crew, r.x + slack + 0.5, r.z);
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: edge.id, cart: true }).denied, [edge.id], 'just outside');

  const far = restingBall(crew, -80, -150);
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: far.id, cart: true }).denied, [far.id]);

  const air = crew.addBall({ x: r.x, y: 3, z: r.z, vx: 0, vy: 0, vz: 0 });
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: air.id, cart: true }).denied, [air.id], 'still flying');

  assert.deepEqual(act(crew, a, { t: 'pickup', ball: 99999, cart: true }).denied, [99999], 'no such ball');
  assert.equal(c.load, 1);
  assert.equal(a.pocket, 0);
});

test('scooping is denied past perks.cartCap', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  crew.phase = 'shift';
  const c = crew.cart, r = reelCentre(c);
  c.load = crew.perks.cartCap - 1;
  const b1 = restingBall(crew, r.x, r.z), b2 = restingBall(crew, r.x, r.z);
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: b1.id, cart: true }).denied, []);
  assert.equal(c.load, crew.perks.cartCap);
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: b2.id, cart: true }).denied, [b2.id], 'hopper full');
  assert.equal(c.load, crew.perks.cartCap);
  assert.ok(crew.balls.has(b2.id));
});

test('only the driver can scoop, and not before the shift opens', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  const b = addPlayer(crew, 'B', CART.PARK.x + 1, CART.PARK.z);
  const c = crew.cart, r = reelCentre(c);
  const ball = restingBall(crew, r.x, r.z);
  crew.phase = 'shift';
  assert.deepEqual(act(crew, b, { t: 'pickup', ball: ball.id, cart: true }).denied, [ball.id], 'nobody is driving');
  act(crew, a, { t: 'board' });
  assert.deepEqual(act(crew, b, { t: 'pickup', ball: ball.id, cart: true }).denied, [ball.id], 'B is not the driver');
  assert.equal(c.load, 0);
  crew.phase = 'lobby';
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: ball.id, cart: true }).denied, [ball.id], 'lobby');
  crew.phase = 'shift';
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: ball.id, cart: true }).denied, []);
  assert.equal(c.load, 1);
});

test('the driver cannot hand-pick while driving', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  crew.phase = 'shift';
  const b = restingBall(crew, crew.cart.x, crew.cart.z);
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: b.id }).denied, [b.id]);
  assert.equal(a.pocket, 0);
});

// ---- 5. auto-unload ----------------------------------------------------------

test('pulling up to the stand banks the load at the ball price', () => {
  const { crew, run } = makeCrew({ up: { cart: 1, washer: 1 } });
  openShift(crew);
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  const c = crew.cart, r = reelCentre(c);
  for (let i = 0; i < 5; i++) act(crew, a, { t: 'pickup', ball: restingBall(crew, r.x, r.z).id, cart: true });
  assert.equal(c.load, 5);

  run(1);
  assert.equal(c.load, 5, 'parked far from the stand: nothing unloads');
  assert.equal(crew.cash, 0);

  crew.flush();
  c.x = SIM.STAND.x + 2; c.z = SIM.STAND.z + 2; c.mud = 0;   // spotless cart: Gear 1.25
  run(0.25);
  assert.equal(c.load, 0);
  assert.equal(crew.cash, 18.75, 'washer tier 1: rate $2, BV $3 at Curb 1, x 1.25 Gear for a spotless cart');
  assert.equal(crew.stats.deposited, 5);
  assert.equal(crew.stats.cash, 18.75);
  const ev = crew.flush().ev.find(e => e.t === 'cash' && e.kind === 'cart');
  assert.ok(ev);
  assert.equal(ev.n, 5);
  assert.equal(ev.by, a.id);
});

test('an empty cart at the stand banks nothing', () => {
  const { crew, run } = makeCrew();
  openShift(crew);
  const a = addPlayer(crew, 'A', CART.PARK.x - 1, CART.PARK.z);
  act(crew, a, { t: 'board' });
  driveCart(crew, a, run, SIM.STAND.x + 2, SIM.STAND.z + 2);
  run(0.5);
  assert.equal(crew.cash, 0);
  assert.ok(!crew.flush().ev.some(e => e.t === 'cash'));
});

// ---- 6. the cage keeps the driver safe ---------------------------------------

test('a fast ball through the driver does not knock them down, but does knock a player on foot', () => {
  for (const preping of [true, false]) {
    const ds = makeCrew();
    const d = addPlayer(ds.crew, 'D', CART.PARK.x - 1, CART.PARK.z);
    act(ds.crew, d, { t: 'board' });
    const bd = shootAtCart(ds.crew);
    if (preping) bd.pinged = true;     // skip the cage ping so only the player check is in play
    ds.run(1);
    assert.equal(d.down, 0, `driver untouched (pre-pinged: ${preping})`);
    assert.equal(ds.crew.stats.knockdowns, 0);

    const fs = makeCrew();
    const f = addPlayer(fs.crew, 'F', CART.PARK.x, CART.PARK.z);
    const bf = shootAtCart(fs.crew);
    bf.pinged = true;                  // nobody is driving; isolate the player hit from the cage
    fs.run(0.5);
    assert.ok(f.down > 0, 'the same ball floors a player on foot');
    assert.equal(fs.crew.stats.knockdowns, 1);
  }
});

// ---- 7. running people over --------------------------------------------------

test('driving at speed through a player on foot knocks them down', () => {
  const { crew, clock } = makeCrew();
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  const v = addPlayer(crew, 'V', CART.PARK.x + 1.2, CART.PARK.z);
  const bystander = addPlayer(crew, 'W', CART.PARK.x + 1.2, CART.PARK.z + 20);
  act(crew, d, { t: 'board' });
  crew.flush();
  clock.t += 50;       // short interval, so a modest hop is a high speed
  crew.input(d, { cart: { x: CART.PARK.x + 5, z: CART.PARK.z, yaw: CART.PARK.yaw } });
  assert.ok(crew.cart.v > CART.RUN_OVER_SPEED, `cart speed ${crew.cart.v}`);
  assert.ok(v.down > 0, 'the victim is flat on their back');
  assert.equal(bystander.down, 0);
  assert.equal(d.down, 0, 'the driver is not their own victim');
  assert.equal(crew.stats.runOver, 1);
  assert.equal(crew.stats.knockdowns, 1);
  assert.ok(crew.flush().ev.some(e => e.t === 'knock' && e.id === v.id && e.by === 'cart'));
});

test('running someone over spills their pocket', () => {
  const { crew, clock } = makeCrew();
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  const v = addPlayer(crew, 'V', CART.PARK.x + 1.2, CART.PARK.z);
  v.pocket = 3;
  act(crew, d, { t: 'board' });
  clock.t += 50;
  crew.input(d, { cart: { x: CART.PARK.x + 5, z: CART.PARK.z, yaw: CART.PARK.yaw } });
  assert.equal(v.pocket, 0);
  assert.equal(crew.balls.size, 3);
});

test('a slow cart does not hurt anyone, and a downed player is not run over twice', () => {
  const { crew, run, clock } = makeCrew();
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  const v = addPlayer(crew, 'V', CART.PARK.x + 0.8, CART.PARK.z);
  act(crew, d, { t: 'board' });
  run(1);                                                         // a full second to creep half a metre
  crew.input(d, { cart: { x: CART.PARK.x + 0.5, z: CART.PARK.z, yaw: CART.PARK.yaw } });
  assert.ok(crew.cart.v < CART.RUN_OVER_SPEED);
  assert.equal(v.down, 0);
  assert.equal(crew.stats.runOver, 0);

  clock.t += 50;
  crew.input(d, { cart: { x: CART.PARK.x + 1.5, z: CART.PARK.z, yaw: CART.PARK.yaw } });
  assert.ok(v.down > 0);
  assert.equal(crew.stats.runOver, 1);
  clock.t += 50;
  crew.input(d, { cart: { x: CART.PARK.x + 2.2, z: CART.PARK.z, yaw: CART.PARK.yaw } });
  assert.equal(crew.stats.runOver, 1, 'already down');
});

test('hired help gets run over too', () => {
  const { crew, clock } = makeCrew({ up: { cart: 1, helpers: 1 } });
  const h = crew.helpers[0];
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  act(crew, d, { t: 'board' });
  h.x = CART.PARK.x + 1.2; h.z = CART.PARK.z;
  clock.t += 50;
  crew.input(d, { cart: { x: CART.PARK.x + 5, z: CART.PARK.z, yaw: CART.PARK.yaw } });
  assert.ok(h.down > 0);
  assert.equal(crew.stats.runOver, 1);
});

// ---- 8. swings ---------------------------------------------------------------

const SWING = { t: 'swing', yaw: 0, pitch: 0.3, power: 0.5 };

test('a swing needs a shift, a crew bay, and a ball in your pocket, which it uses up', () => {
  const { crew } = makeCrew();
  const a = addPlayer(crew, 'A', BAYS[0].x, BAYS[0].z);
  a.pocket = 2;

  act(crew, a, SWING);
  assert.equal(a.pocket, 2, 'no swinging in the lobby');
  assert.equal(crew.balls.size, 0);

  openShift(crew);
  act(crew, a, SWING);
  assert.equal(a.pocket, 1, 'one ball used');
  assert.equal(crew.balls.size, 1);
  const b = [...crew.balls.values()][0];
  assert.equal(b.by, a.id, 'the ball is credited to the swinger');
  assert.ok(b.vz < 0 && Math.hypot(b.vx, b.vy, b.vz) > 12, 'it is actually hit downrange');
  assert.equal(crew.stats.swings, 1);
  assert.ok(crew.flush().ev.some(e => e.t === 'spawn' && e.id === b.id));
});

// The swing launches the ball from 0.4 m in front of the bay centre, which is inside HIT_R (0.45)
// of a player standing right on the bay, so it clips its own swinger on the first tick.
test('swinging from the middle of the bay does not floor the swinger', () => {
  const { crew, run } = makeCrew();
  openShift(crew);
  const a = addPlayer(crew, 'A', BAYS[0].x, BAYS[0].z);
  a.pocket = 2;
  act(crew, a, SWING);
  run(0.25);
  assert.equal(a.down, 0, 'BUG: ballHitsPlayer sees the freshly-swung ball (spawned 0.4 m away, HIT_R 0.45) as hitting its swinger');
  assert.equal(a.pocket, 1, 'BUG: the remaining pocket ball spills when the swinger is floored');
});

test('both crew bays work, and being off a bay or out of balls does not', () => {
  const { crew } = makeCrew();
  openShift(crew);
  const a = addPlayer(crew, 'A', BAYS[1].x + 0.5, BAYS[1].z);
  a.pocket = 5;
  act(crew, a, SWING);
  assert.equal(crew.balls.size, 1, 'the west bay works too');

  a.x = 0; a.z = 5;
  a.swungAt = 0;
  act(crew, a, SWING);
  assert.equal(crew.balls.size, 1, 'mid-field is not a bay');
  assert.equal(a.pocket, 4);

  a.x = BAYS[0].x + 3; a.z = BAYS[0].z;
  act(crew, a, SWING);
  assert.equal(crew.balls.size, 1, 'beside the bay is not on it');

  a.x = BAYS[0].x; a.pocket = 0;
  act(crew, a, SWING);
  assert.equal(crew.balls.size, 1, 'empty pockets cannot swing');
  assert.equal(a.pocket, 0);
});

test('swings have a cooldown', () => {
  const { crew, run } = makeCrew();
  openShift(crew);
  const a = addPlayer(crew, 'A', BAYS[0].x + 1, BAYS[0].z);   // off-centre: see the self-hit test
  a.pocket = 5;
  act(crew, a, SWING);
  act(crew, a, SWING);
  assert.equal(a.pocket, 4, 'the second swing is too soon');
  run(SIM.SWING_COOLDOWN - 0.3);
  act(crew, a, SWING);
  assert.equal(a.pocket, 4, 'still cooling down');
  run(0.5);
  act(crew, a, SWING);
  assert.equal(a.pocket, 3, 'ready again');
  assert.equal(crew.stats.swings, 2);
});

test('no swing with a junk aim, while knocked down, or while driving', () => {
  const { crew } = makeCrew();
  openShift(crew);
  const a = addPlayer(crew, 'A', BAYS[0].x, BAYS[0].z);
  a.pocket = 5;
  act(crew, a, { t: 'swing', yaw: NaN, pitch: 0, power: 1 });
  act(crew, a, { t: 'swing', yaw: 0, pitch: 0 });
  assert.equal(a.pocket, 5);

  crew.knockDown(a);
  const spilled = crew.balls.size;
  a.pocket = 5; a.x = BAYS[0].x; a.z = BAYS[0].z;
  act(crew, a, SWING);
  assert.equal(a.pocket, 5, 'flat on your back');
  assert.equal(crew.balls.size, spilled);
  a.down = 0;

  // Park the cart on the bay, climb in, then try to swing from the seat.
  crew.cart.x = BAYS[0].x; crew.cart.z = BAYS[0].z;
  act(crew, a, { t: 'board' });
  assert.equal(crew.cart.driver, a.id);
  const n = crew.balls.size;
  act(crew, a, SWING);
  assert.equal(a.pocket, 5, 'no swinging from the driver\'s seat');
  assert.equal(crew.balls.size, n);
  assert.equal(crew.stats.swings, 0);
});

// ---- 9. Hit the Cart ---------------------------------------------------------

function pingSetup(save) {
  const s = makeCrew(save);
  openShift(s.crew);
  const driver = addPlayer(s.crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  const swinger = addPlayer(s.crew, 'S', BAYS[0].x + 1, BAYS[0].z);   // off-centre: see the self-hit test
  act(s.crew, driver, { t: 'board' });
  s.crew.flush();
  return { ...s, driver, swinger };
}

test('PING_PRIZES weights add up to 1 and cover jackpot, boost, mult', () => {
  assert.deepEqual(PING_PRIZES.map(p => p[0]).sort(), ['boost', 'jackpot', 'mult']);
  assert.ok(Math.abs(PING_PRIZES.reduce((s, p) => s + p[1], 0) - 1) < 1e-9);
});

test('a crew-hit ball through the cage with a driver gives a prize ping', () => {
  const { crew, run, swinger } = pingSetup();
  shootAtCart(crew, swinger.id);
  run(0.5);
  const ev = pings(crew);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].by, swinger.id);
  assert.ok(PING_PRIZES.some(p => p[0] === ev[0].prize), `prize ${ev[0].prize}`);
  assert.equal(crew.stats.pings, 1);
});

test('a ball swung from the bay can ring the cart for real', () => {
  const { crew, run, swinger } = pingSetup();
  // Straight downrange of the east bay, which swings toward -z at yaw 0.
  crew.cart.x = BAYS[0].x; crew.cart.z = BAYS[0].z - 12;
  swinger.pocket = 1;
  act(crew, swinger, { t: 'swing', yaw: 0, pitch: 0.02, power: 0.3 });
  const b = [...crew.balls.values()][0];
  assert.equal(b.by, swinger.id);
  run(2);
  assert.equal(pings(crew).length, 1);
  assert.equal(crew.stats.pings, 1);
  assert.equal(b.pinged, true);
});

test('jackpot sweeps resting balls within JACKPOT_R into the cart', () => {
  const { crew, run, swinger } = pingSetup();
  const c = crew.cart;
  const near = [restingBall(crew, c.x + 3, c.z), restingBall(crew, c.x, c.z - 8), restingBall(crew, c.x - CART.JACKPOT_R + 1, c.z)];
  const far = restingBall(crew, c.x - CART.JACKPOT_R - 5, c.z);
  const edge = restingBall(crew, c.x, c.z - CART.JACKPOT_R - 0.5);
  crew.flush();
  crew.rng = () => 0.1;
  shootAtCart(crew, swinger.id);
  run(0.5);
  const ev = pings(crew);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].prize, 'jackpot');
  assert.equal(ev[0].n, 3);
  assert.equal(c.load, 3);
  for (const b of near) assert.equal(crew.balls.has(b.id), false, 'swept');
  assert.ok(crew.balls.has(far.id), 'too far');
  assert.ok(crew.balls.has(edge.id), 'just outside the radius');
  assert.equal(crew.stats.carted, 3);
  assert.equal(crew.stats.picked, 3);
});

test('jackpot respects the hopper cap', () => {
  const { crew, run, swinger } = pingSetup();
  const c = crew.cart;
  for (let i = 0; i < 4; i++) restingBall(crew, c.x + 2 + i, c.z + 1);
  c.load = crew.perks.cartCap - 2;
  crew.rng = () => 0.1;
  shootAtCart(crew, swinger.id);
  run(0.25);
  assert.equal(c.load, crew.perks.cartCap, 'topped up, no further');
  assert.equal(pings(crew)[0].n, 2);
  let left = 0;
  for (const b of crew.balls.values()) if (b.rest && dist(b, c) < CART.JACKPOT_R) left++;
  assert.equal(left, 2, 'two resting balls stay on the grass');
});

test('boost sets cart.boostT, lets the cart move faster, and wears off', () => {
  const { crew, run, swinger, driver } = pingSetup();
  crew.rng = () => 0.5;
  shootAtCart(crew, swinger.id);
  run(0.25);
  assert.equal(pings(crew)[0].prize, 'boost');
  assert.ok(crew.cart.boostT > CART.BOOST_SECS - 1 && crew.cart.boostT <= CART.BOOST_SECS);
  assert.ok(crew.snapshot().cart.boost > 0);

  // The clamp now allows boosted speed: a hop over a second goes further than the unboosted limit.
  run(0.75);
  const x0 = crew.cart.x;
  crew.input(driver, { cart: { x: x0 + 100, z: crew.cart.z, yaw: crew.cart.yaw } });
  const unboostedMax = crew.perks.cartSpeed * 1.3 * 1 + 0.6;
  assert.ok(crew.cart.x - x0 > unboostedMax + 0.5, `boosted hop ${(crew.cart.x - x0).toFixed(2)} vs ${unboostedMax.toFixed(2)}`);

  run(CART.BOOST_SECS + 1);
  assert.equal(crew.cart.boostT, 0, 'wears off');
});

test('mult raises the multiplier, caps at MAX_MULT, and multiplies banked cash', () => {
  const { crew, run, swinger, driver } = pingSetup();
  crew.rng = () => 0.9;
  assert.equal(crew.mult, 1);
  shootAtCart(crew, swinger.id); run(0.5);
  assert.equal(pings(crew)[0].prize, 'mult');
  assert.equal(crew.mult, 1 + CART.MULT_STEP);
  assert.equal(crew.snapshot().mult, 1 + CART.MULT_STEP);
  shootAtCart(crew, swinger.id); run(0.5);
  assert.equal(crew.mult, 1 + 2 * CART.MULT_STEP);
  for (let i = 0; i < 4; i++) { shootAtCart(crew, swinger.id); run(0.5); }
  assert.equal(crew.mult, CART.MAX_MULT, 'capped');
  assert.equal(crew.stats.pings, 6);
  assert.equal(pings(crew).at(-1).mult, CART.MAX_MULT);

  crew.cart.mud = 0;
  assert.equal(crew.ballPrice(), 1.5 * CART.MAX_MULT, 'BV $1.5 x Hustle 2; the cart Gear is applied at the deposit, not in the headline');
  crew.cart.load = 4;
  const before = crew.cash;
  crew.cart.x = SIM.STAND.x + 2; crew.cart.z = SIM.STAND.z + 2;
  run(0.25);
  assert.equal(crew.cart.load, 0);
  assert.equal(crew.cash - before, 4 * 1.5 * CART.MAX_MULT * 1.25, 'cart deposit: weights x BV x Hustle x Gear');
});

test('a customer ball (no `by`) rings the cage for no prize', () => {
  const { crew, run } = pingSetup();
  crew.rng = () => 0.1;
  shootAtCart(crew, null);
  run(0.5);
  const ev = pings(crew);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].by, null);
  assert.equal(ev[0].prize, undefined);
  assert.equal(crew.stats.pings, 0);
  assert.equal(crew.cart.load, 0);
  assert.equal(crew.mult, 1);
  assert.equal(crew.cart.boostT, 0);
});

test('a crew ball on an undriven cart rings for no prize', () => {
  const { crew, run, swinger, driver } = pingSetup();
  act(crew, driver, { t: 'leave' });
  crew.flush();
  crew.rng = () => 0.5;
  shootAtCart(crew, swinger.id);
  run(0.5);
  const ev = pings(crew);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].prize, undefined);
  assert.equal(crew.stats.pings, 0);
  assert.equal(crew.cart.boostT, 0);
});

test('no prize outside a shift', () => {
  const { crew, run, swinger } = pingSetup();
  crew.phase = 'report';
  crew.rng = () => 0.9;
  shootAtCart(crew, swinger.id);
  run(0.5);
  assert.equal(pings(crew)[0].prize, undefined);
  assert.equal(crew.mult, 1);
});

test('a ball pings at most once', () => {
  const { crew, run, swinger } = pingSetup();
  crew.rng = () => 0.9;
  const b = shootAtCart(crew, swinger.id);
  run(0.5);
  assert.equal(b.pinged, true);
  assert.equal(pings(crew).length, 1);
  // Send the same ball back through the cage.
  b.x = crew.cart.x - 5; b.y = 1; b.z = crew.cart.z; b.vx = 20; b.vy = 1; b.vz = 0; b.rest = false;
  run(0.5);
  assert.equal(pings(crew).length, 1, 'no second ping');
  assert.equal(crew.mult, 1 + CART.MULT_STEP);
  assert.equal(crew.stats.pings, 1);
});

test('a ball that misses the cage does not ping', () => {
  const { crew, run, swinger } = pingSetup();
  const c = crew.cart;
  crew.addBall({ x: c.x - 6, y: 1, z: c.z + CART.CAGE_R + 2, vx: 20, vy: 1, vz: 0, by: swinger.id });   // wide
  crew.addBall({ x: c.x - 6, y: 5, z: c.z, vx: 20, vy: 5, vz: 0, by: swinger.id });                      // lobbed over the top
  run(0.5);
  assert.equal(pings(crew).length, 0);
  assert.equal(crew.stats.pings, 0);
});

// ---- 10. shift boundaries and the driver going away ---------------------------

test('startShift resets mult and parks an empty, driverless cart', () => {
  const { crew, run } = makeCrew({ up: { cart: 1 } }, 5);
  openShift(crew);
  crew.mult = 3;
  crew.cart.x = 0; crew.cart.z = -40; crew.cart.yaw = 1;
  crew.cart.boostT = 12; crew.cart.v = 4;
  run(6);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.mult, 3, 'multiplier lasts the rest of the shift');
  crew.startShift();
  assert.equal(crew.phase, 'shift');
  assert.equal(crew.mult, 1);
  assert.equal(crew.snapshot().mult, 1);
  assert.equal(crew.cart.x, CART.PARK.x);
  assert.equal(crew.cart.z, CART.PARK.z);
  assert.equal(crew.cart.yaw, CART.PARK.yaw);
  assert.equal(crew.cart.v, 0);
  assert.equal(crew.cart.load, 0);
  assert.equal(crew.cart.driver, null);
  assert.equal(crew.cart.boostT, 0);
});

test('startShift clears the field', () => {
  const { crew } = makeCrew();
  restingBall(crew, 10, -50);
  crew.startShift();
  assert.equal(crew.balls.size, 0);
});

test('endShift banks any cart load into the report', () => {
  const { crew, run } = makeCrew({ up: { cart: 1 } }, 5);
  openShift(crew);
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  act(crew, d, { t: 'board' });
  crew.cart.load = 7;
  crew.mult = 2;
  crew.cart.mud = 0;
  crew.cart.boostT = 9;
  run(6);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.cart.load, 0);
  assert.equal(crew.cart.boostT, 0);
  assert.equal(crew.cash, 26.25, '7 balls x BV 1.5 x Hustle 2 x Gear 1.25 (spotless cart)');
  assert.equal(crew.report.deposited, 7);
  assert.equal(crew.report.cash, 26.25);
  assert.equal(crew.report.bank, 26.25);
  assert.equal(crew.totals.deposited, 7);
});

test('endShift banks a driverless cart\'s load too', () => {
  const { crew, run } = makeCrew({ up: { cart: 1 } }, 5);
  openShift(crew);
  crew.cart.load = 3;
  run(6);
  assert.equal(crew.cash, 5.63, '3 balls x BV 1.5 x Gear 1.25 = 5.625, to cents (spotless cart)');
  assert.equal(crew.report.deposited, 3);
});

test('an offline driver loses the cart after about 5 s', () => {
  const { crew, run } = makeCrew();
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  act(crew, d, { t: 'board' });
  run(10);
  assert.equal(crew.cart.driver, d.id, 'online drivers keep it');

  crew.disconnect(d);
  assert.equal(d.online, 0);
  run(3);
  assert.equal(crew.cart.driver, d.id, 'still within the grace period');
  run(3);
  assert.equal(crew.cart.driver, null, 'cart released');
  assert.equal(crew.cart.v, 0);
  assert.equal(crew.snapshot().cart.driver, null);
  assert.ok(crew.players.has(d.id), 'the player themselves keep their spot much longer');

  const other = addPlayer(crew, 'O', crew.cart.x - 1, crew.cart.z);
  act(crew, other, { t: 'board' });
  assert.equal(crew.cart.driver, other.id);
});

test('a driver who reconnects within the grace period keeps the cart', () => {
  const { crew, run } = makeCrew();
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  act(crew, d, { t: 'board' });
  crew.disconnect(d);
  run(3);
  crew.connect(d);
  run(10);
  assert.equal(crew.cart.driver, d.id);
});

test('a removed driver frees the cart', () => {
  const { crew } = makeCrew();
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  act(crew, d, { t: 'board' });
  crew.removePlayer(d);
  assert.equal(crew.cart.driver, null);
});
