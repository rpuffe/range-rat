// Tiered (venue 2): the Target Greens, Bay Utilization, Target Practice, the gutters (council round 4, build item 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { MODULES, checkModule } from '../server/venues/index.mjs';
import tiered from '../server/venues/tiered.mjs';
import { readFileSync } from 'node:fs';
import { MAP } from '../web/js/map.js';
import { inBowl, cupSpot, bayUtil, GUTTERS_ROW, TARGET } from '../web/js/tiered.js';
import { SHOP, CART, nextPrice } from '../web/js/sim.js';

const [A, B, C] = MAP.BOWLS;
function setup(extra = {}, venue = 2) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('TIER', { venue, day: 5, venueDay: 1, up: { shed: 1, ...extra }, cash: 1000 },
    { shiftSecs: 120, seed: 5, now: () => clock.t, modules: [tiered] });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  const drop = (x, z, by) => crew.addBall({ x, y: 0.06, z, vx: 0, vy: 0, vz: 0, kind: 'range', ...(by ? { by } : {}) });
  const st = () => crew.mods.state('tiered');
  return { crew, p, run, drop, st };
}
const inCup = (crew, id) => [...crew.balls.values()].filter(b => b.cup === id);

test('the module is registered and well formed; the view plugs in through the registry', () => {
  assert.ok(MODULES.includes(tiered));
  assert.doesNotThrow(() => checkModule(tiered));
  assert.equal(tiered.venue, 2);
  const src = readFileSync(new URL('../web/js/views/tiered.js', import.meta.url), 'utf8');   // the view imports three: browser only
  assert.ok(src.includes("id: 'tiered'") && src.includes('venue: 2'));
  const pure = readFileSync(new URL('../web/js/tiered.js', import.meta.url), 'utf8');
  assert.ok(!/^import .*sim[.]js/m.test(pure), 'tiered.js must not import sim.js (a TDZ cycle)');
});

test('inBowl: r 6.9 of Bowl A is inside, r 7.5 is not; cupSpot stays in the cup and is deterministic', () => {
  assert.equal(inBowl(A.x + 6.9, A.z), A);
  assert.equal(inBowl(A.x + 7.5, A.z), null);
  assert.equal(inBowl(B.x, B.z - 7.9), B);
  assert.equal(inBowl(C.x - 8.9, C.z), C);
  assert.equal(inBowl(0, -10), null);
  const seen = new Set();
  for (let id = 1; id < 300; id++) {
    const s = cupSpot(id, A);
    assert.deepEqual(s, cupSpot(id, A));
    assert.ok(Math.hypot(s.x - A.x, s.z - A.z) <= A.cup, 'inside the cup');
    seen.add(s.x.toFixed(3) + s.z.toFixed(3));
  }
  assert.ok(seen.size > 250, 'scattered');
});

test('bayUtil: empty cups 1, 40 balls 0, clamped', () => {
  assert.equal(bayUtil(0), 1);
  assert.equal(bayUtil(40), 0);
  assert.equal(bayUtil(20), 0.5);
  assert.equal(bayUtil(400), 0);
  assert.equal(bayUtil(-3), 1);
});

test('a customer ball resting at r 6.9 of A rolls into the cup; at r 7.5 it stays put', () => {
  const { crew, drop, run, st } = setup();
  const inb = drop(A.x + 6.9, A.z), out = drop(A.x + 7.5, A.z);
  run(0.2);
  assert.equal(inb.cup, 'A');
  assert.ok(Math.hypot(inb.x - A.x, inb.z - A.z) <= A.cup);
  assert.equal(out.cup, undefined);
  assert.equal(out.x, A.x + 7.5);
  assert.equal(st().cups[0], 1);
  assert.ok(crew.mods.kpi() < 1 && crew.mods.kpi() > 0.95);
});

test('a cup event is emitted for the client tween', () => {
  const { crew, drop, st } = setup();
  const b = drop(B.x + 1, B.z + 1);
  crew.events.length = 0;
  tiered.onRest(crew, st(), b);
  const e = crew.events.find(x => x.t === 'cup');
  assert.ok(e && e.id === b.id && e.bowl === 'B');
  assert.equal(e.x, b.x); assert.equal(e.z, b.z);
});

test('Bay Utilization is the live KPI at venue 2 only; the ceiling reads 3.0', () => {
  const { crew, drop, run } = setup();
  assert.equal(crew.ceiling(), 3.0);
  for (let i = 0; i < 40; i++) drop(A.x + 1, A.z);
  run(0.5);
  assert.equal(crew.mods.kpi(), 0);
  assert.equal(crew.valueNow().kpi, 0);
  assert.equal(setup({}, 3).crew.mods.kpi(), null, 'not graded after Tiered');
});

test('a crew ball in a bowl is TARGET: the cup flushes to the shooter at gear x1, Hustle +0.25 (capped)', () => {
  const { crew, p, drop, run } = setup();
  p.grime = 5;                                  // a filthy Rat: the flush still pays at gear x1
  for (let i = 0; i < 5; i++) drop(C.x + 0.3, C.z);
  run(0.3);
  assert.equal(inCup(crew, 'C').length, 5);
  const cash0 = crew.cash, mult0 = crew.mult, v = crew.valueNow();   // the flush banks BEFORE the Hustle bump
  const shot = drop(C.x + 5, C.z + 3, p.id);
  run(0.3);
  assert.equal(inCup(crew, 'C').length, 0, 'the cup is empty');
  assert.ok(!crew.balls.has(shot.id), 'so is the shot');
  assert.ok(Math.abs((crew.cash - cash0) - 6 * v.value) < 0.05, `6 balls at gear x1: ${crew.cash - cash0} vs ${6 * v.value}`);
  assert.equal(crew.mult, mult0 + TARGET.HUSTLE);
  assert.equal(crew.stats.targets, 1);
  assert.equal(p.shift.banked, 6);
  crew.mult = CART.MAX_MULT;
  drop(A.x, A.z + 2, p.id); run(0.2);
  assert.equal(crew.mult, CART.MAX_MULT, 'shares the cap with pings');
});

test('a crew ball in a bowl outside the shift is just a cupped ball (no bank)', () => {
  const { crew, p, drop, st } = setup();
  crew.phase = 'report';
  const b = drop(A.x, A.z + 1, p.id);
  tiered.onRest(crew, st(), b);
  assert.equal(b.cup, 'A');
});

test('the gutters row: $50,000 base, a Tiered crew row; it drains 1 a second per cup, banked as kind gutter', () => {
  assert.ok(SHOP.includes(GUTTERS_ROW));
  assert.equal(GUTTERS_ROW.minVenue, 2);
  assert.equal(nextPrice('gutters', {}, 1, 0, 1), null, 'not before Tiered');
  assert.equal(nextPrice('gutters', {}, 1, 0, 2), 50000);
  const { crew, drop, run } = setup({ gutters: 1 });
  for (let i = 0; i < 6; i++) { drop(A.x + 0.2, A.z); drop(B.x, B.z + 0.2); }
  run(0.3);
  const a0 = inCup(crew, 'A').length;
  assert.equal(a0, inCup(crew, 'B').length);
  run(3.0);
  assert.equal(inCup(crew, 'A').length, a0 - 3, '1 a second');
  assert.equal(inCup(crew, 'B').length, a0 - 3, 'per cup');
  run(10);
  assert.equal(inCup(crew, 'A').length, 0);
  assert.ok(crew.cash > 1000);
  assert.ok(crew.stats.deposited >= 12);
});

test('without the gutters nothing drains', () => {
  const { crew, drop, run } = setup();
  for (let i = 0; i < 4; i++) drop(A.x, A.z + 0.2);
  run(5);
  assert.equal(inCup(crew, 'A').length, 4);
});

test('balls picked out of a cup free the dial on the next recount', () => {
  const { crew, drop, run, st } = setup();
  const bs = [drop(A.x, A.z), drop(A.x, A.z + 0.3)];
  run(0.5);
  assert.equal(st().cups[0], 2);
  crew.balls.delete(bs[0].id);
  run(0.5);
  assert.equal(st().cups[0], 1);
});

test('the snapshot is small JSON; the module keeps no save key', () => {
  const { crew, drop, run, st } = setup();
  drop(A.x, A.z); run(0.5);
  const snap = tiered.snapshot(crew, st());
  assert.deepEqual(snap.cups, [1, 0, 0]);
  assert.ok(JSON.stringify(snap).length < 80);
  assert.equal(tiered.toSave, undefined);
});
