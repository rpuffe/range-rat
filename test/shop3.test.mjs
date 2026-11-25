// Owner playtest 3 §4, §5.1–5.3 on the real Crew: Open every bay, the pressure washer row (fan, turbo, foam),
// crew carrying gear and the half hopper that tips for 1.5 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SIM, CART, WASH, FIXTURE_BY_ID } from '../web/js/sim.js';

function makeCrew(save = null, shiftSecs = 600, seed = 5) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('SHP3', save, { shiftSecs, seed, now: () => clock.t });
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
  const run = secs => { for (let i = 0; i < Math.round(secs * 20); i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
const addPlayer = (crew, name, x = 30, z = 9) => { const p = crew.join(name); crew.connect(p); p.x = x; p.z = z; return p; };
const act = (crew, p, ...a) => crew.input(p, { a });

test('§4: a solo crew with Open every bay seats a customer on all ten mats', () => {
  const count = up => {
    const { crew, run } = makeCrew({ v: 4, day: 3, up });
    addPlayer(crew, 'Solo');
    crew.startShift();
    run(5);
    return crew.mats.filter(m => m.st !== 'empty').length;
  };
  assert.equal(count({}), 6);
  assert.equal(count({ bays: 1 }), 10);
});

test('§4: the bays stay open after promotion (main-session call: every venue)', () => {
  const { crew, run } = makeCrew({ v: 4, day: 6, venue: 1, venueDay: 1, up: { bays: 1 } });
  addPlayer(crew, 'Solo');
  crew.startShift();
  run(5);
  assert.equal(crew.mats.filter(m => m.st !== 'empty').length, 10);
});

test('§4 pace: a seeded solo Muni day 3 with every bay open hits >= 70 balls a minute in the first two minutes', () => {
  let t = 1e6;
  const crew = new Crew('PACE', { v: 4, day: 3, up: { bays: 1, helpers: 1 } }, { seed: 1, now: () => t });   // seeds 1–7: 66.5–80 (b3 early-real.mjs: mean 73)
  const p = crew.join('Solo'); crew.connect(p);
  crew.phase = 'report'; crew.day = 2;
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = k.startsWith('mat') ? 0.3 : 0.4;   // yesterday's bell
  crew.startShift();
  let hit = 0;
  const add = crew.addBall.bind(crew);
  crew.addBall = s => { const b = add(s); if (b) hit++; return b; };
  while (crew.shiftT < 120) { t += 50; p.seenAt = t; p.x = 30; p.z = 9; crew.tick(0.05); crew.events = []; }
  assert.ok(hit / 2 >= 70, `${hit / 2} balls a minute`);
});

test('§5.1: the fan nozzle cleans 1.5x as fast, the turbo 2x and reaches 9 m', () => {
  const cleaned = (up, d = 3) => {
    const { crew, clock } = makeCrew({ v: 4, day: 5, up });
    crew.startShift();
    const f = FIXTURE_BY_ID.sign;
    const a = addPlayer(crew, 'A', WASH.STATION.x, WASH.STATION.z);
    act(crew, a, { t: 'wand' });
    a.x = f.x + d; a.z = f.z;
    crew.fixtures.sign = 0.9;
    clock.t += 500;
    if (!crew.wash(a, 0.5, 'sign')) return 0;
    return +(0.9 - crew.fixtures.sign).toFixed(4);
  };
  const base = cleaned({});
  assert.ok(Math.abs(base - WASH.RATE * 1.6 * 0.5) < 1e-6, `garden hose ${base}`);
  assert.ok(Math.abs(cleaned({ wand: 1 }) - base * 1.5) < 1e-6);
  assert.ok(Math.abs(cleaned({ wand: 2 }) - base * 2) < 1e-6);
  assert.equal(cleaned({}, 11), 0, '11 m is out of the garden hose\'s reach (7 m + 1.5 slack + the sign)');
  assert.ok(cleaned({ wand: 2 }, 11) > 0, 'the turbo reaches 9 m (+ the sign\'s size)');
});

test('§5.1: the foam cannon cleans every fixture in its cone at once', () => {
  const run = up => {
    const { crew, clock } = makeCrew({ v: 4, venue: 2, day: 20, venueDay: 2, up });
    crew.startShift();
    const a = addPlayer(crew, 'A', WASH.STATION.x, WASH.STATION.z);
    act(crew, a, { t: 'wand' });
    // Stand at the end of the mat row and spray along it: mat9 (x 18) is the target, mat8 (x 14) sits on the line.
    a.x = 22; a.z = 0.2;
    crew.fixtures.mat9 = 0.5; crew.fixtures.mat8 = 0.5; crew.fixtures.mat0 = 0.5;
    clock.t += 500;
    crew.wash(a, 0.5, 'mat8');
    return { m8: crew.fixtures.mat8, m9: crew.fixtures.mat9, m0: crew.fixtures.mat0 };
  };
  const plain = run({ wand: 2, build: 2 }), foam = run({ wand: 3, build: 2 });   // round 11: solo, mats 8 and 9 exist only once built (bays.js)
  assert.ok(plain.m8 < 0.5 && plain.m9 === 0.5, 'a plain nozzle cleans only its target');
  assert.ok(foam.m8 < 0.5 && foam.m9 < 0.5, 'the foam cleans mat9 (in the cone, inside the reach) too');
  assert.equal(foam.m0, 0.5, 'a mat far down the row is out of reach');
  assert.ok(Math.abs(foam.m8 - foam.m9) < 1e-9, 'at the same rate');
});

test('§5.2: a crew gear buy lifts every Rat, and the pocket follows', () => {
  const { crew } = makeCrew({ v: 4 });
  const a = addPlayer(crew, 'A'), b = addPlayer(crew, 'B'), c = addPlayer(crew, 'C'), d = addPlayer(crew, 'D');
  crew.cash = 1000;
  act(crew, a, { t: 'buy', id: 'gear' });
  assert.equal(crew.cash, 956, '$20 x 2.2');
  assert.deepEqual([a, b, c, d].map(p => p.gear), [1, 1, 1, 1]);
  assert.equal(crew.snapshot().players.find(p => p.id === d.id).gear, 1, 'p.gear stays on the wire');
});

test('§5.3: the caged cart stops scooping at 150, and the jackpot never overfills', () => {
  const { crew } = makeCrew({ v: 4, day: 5, up: { cart: 1 } });
  crew.startShift();
  const c = crew.cart;
  assert.equal(crew.perks.cartCap, 150);
  c.load = 149;
  for (let i = 0; i < 30; i++) { const b = crew.addBall({ x: c.x + (i % 6) - 3, y: SIM.BALL_R, z: c.z + Math.floor(i / 6) - 2, vx: 0, vy: 0, vz: 0 }); b.rest = true; }
  const p = addPlayer(crew, 'D', c.x, c.z); act(crew, p, { t: 'board' });
  crew.rng = () => 0;   // the jackpot
  crew.ping({ by: p.id, vx: 0, vy: 1, vz: 0, x: c.x, y: 1, z: c.z }, c);
  assert.equal(c.load, 150, 'clamped at the cap');
  assert.ok([...crew.balls.values()].filter(b => b.rest).length >= 29, 'the rest stay on the ground');
});

test('§5.3: the hopper tips for 1.5 s at the return, then the bank lands', () => {
  const { crew, run } = makeCrew({ v: 4, day: 5, up: { cart: 1 } });
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  const c = crew.cart;
  c.load = 100; c.loadW = 100;
  c.x = SIM.STAND.x + 2; c.z = SIM.STAND.z + 2;
  run(0.1);
  assert.ok(c.tipT > 0 && crew.snapshot().carts[0].tip > 0, 'tipping, on the wire');
  run(1.2);
  assert.equal(c.load, 100, 'not yet');
  run(0.4);
  assert.equal(c.load, 0, 'banked after 1.5 s');
  assert.equal(crew.snapshot().carts[0].tip, undefined);
  assert.equal(CART.UNLOAD_SECS, 1.5);
});
