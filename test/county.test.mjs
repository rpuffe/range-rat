// The County (venue 4), council round 4 build item 8: the slice, the Yards, Zoning Compliance, drones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { launch, advanceBall, mulberry32, MATS, SHOP, nextPrice } from '../web/js/sim.js';
import { MAP, cartBlocked, kerbBlocked } from '../web/js/map.js';
import { SLICE, strayCount, zoning, DRONES_ROW, DRONES, droneCount, droneStep, droneTarget, yardAt } from '../web/js/county.js';
import { Crew } from '../server/crew.mjs';
import county from '../server/venues/county.mjs';
import { MODULES, checkModule } from '../server/venues/index.mjs';
import { createViews } from '../web/js/views/registry.js';
import { readFileSync } from 'node:fs';

function crewAt(venue, extra = {}, mods = [county]) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('CNTY', { venue, day: 5, venueDay: 1, up: { shed: 1 }, ...extra }, { shiftSecs: 120, seed: 11, now: () => clock.t, modules: mods });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
const rest = (crew, o) => { const b = crew.addBall({ x: 0, y: 0.06, z: 0, vx: 0, vy: 0, vz: 0, kind: 'range', ...o }); b.rest = true; return b; };

test('the module is registered, well-formed, and wired into the views', () => {
  checkModule(county);
  assert.ok(MODULES.includes(county), 'one line in server/venues/index.mjs');
  // views/index.js imports three (not loadable in node): check the registry's source text instead.
  const idx = readFileSync(new URL('../web/js/views/index.js', import.meta.url), 'utf8');
  assert.ok(idx.includes("\nimport county from './county.js';\n") && idx.includes('\n  county,\n'));
  assert.ok(SHOP.some(i => i.id === 'drones'), 'DRONES_ROW is in the shop');
});

test('2,000 seeded customer shots: 8-18% end in the Yards at the County, and venues 0-3 never slice', () => {
  const shots = venue => {
    const crew = crewAt(venue, {}, [county]).crew;
    const rng = mulberry32(2026), world = { venue };
    let yards = 0, curved = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const mat = MATS[i % MATS.length];
      let s = { ...launch(mat, rng), kind: 'range' };
      s = crew.mods.pipe('launchMod', s, { mat, kind: 'range', lead: false });
      if (s.curve) { curved++; assert.ok(s.curve >= SLICE.MIN && s.curve <= SLICE.MAX); }
      const b = { ...s, rest: false, acc: 0 };
      for (let k = 0; k < 40 * 60 && !advanceBall(b, 1 / 60, world); k++);
      if (b.x > MAP.KERB_X) yards++;
    }
    return { yards: yards / N, curved: curved / N };
  };
  const c = shots(4);
  assert.ok(c.yards >= 0.08 && c.yards <= 0.18, `yards share ${c.yards}`);
  assert.ok(Math.abs(c.curved - 0.4) < 0.04, `slice share ${c.curved}`);
  for (const v of [0, 1, 2, 3]) assert.equal(shots(v).curved, 0, `venue ${v} has no slice`);
});

test('a ball at x 80 rests (the net is out at 96.5) and a cart at x 66 is blocked; before the County neither', () => {
  const b = { x: 80, y: 0.06, z: -100, vx: 0, vy: 0, vz: 0, kind: 'range', rest: false, acc: 0 };
  assert.ok(advanceBall(b, 1, { venue: 4 }) || b.x === 80);
  assert.equal(b.x, 80);
  assert.equal(cartBlocked(66, -100, { venue: 4 }), true);
  assert.equal(kerbBlocked(66, -100, { venue: 3 }), false);
  assert.equal(yardAt(80, -128), 3); assert.equal(yardAt(70, -40), 1); assert.equal(yardAt(70, -170), 4); assert.equal(yardAt(30, -100), 0);
});

test('Zoning Compliance = 1 - strays / 30, recomputed every half second, graded only at the County', () => {
  assert.equal(zoning(0), 1); assert.equal(zoning(15), 0.5); assert.equal(zoning(99), 0);
  const { crew, run } = crewAt(4);
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift();
  crew.revealT = 0;
  for (let i = 0; i < 6; i++) rest(crew, { x: 70 + i, z: -50 - i });
  rest(crew, { x: 20, z: -60 });                 // on the range: not a stray
  rest(crew, { x: 80, z: -90, kind: 'one' });    // Ball No. 1 is nobody's stray
  assert.equal(strayCount(crew.balls.values()), 6);
  crew.mods.call('tick', 0.6);
  assert.equal(crew.mods.state('county').strays, 6);
  assert.equal(crew.mods.kpi(), 0.8);
  assert.equal(crew.snapshot().mods.county.strays, 6);
  assert.equal(crewAt(3).crew.mods.kpi(), null, 'the County module is asleep at the Stadium');
  assert.ok(run);
});

test('drone row: two then four, $1.2M then $3M base, from the County only', () => {
  assert.equal(DRONES_ROW.tiers[1].cost, 1200000); assert.equal(DRONES_ROW.tiers[2].cost, 3000000);
  assert.equal(droneCount({}), 0); assert.equal(droneCount({ drones: 1 }), 2); assert.equal(droneCount({ drones: 2 }), 4);
  assert.equal(nextPrice('drones', {}, 1, 0, 3), null);
  assert.equal(nextPrice('drones', {}, 1, 0, 4), 1200000);
});

test('drones take strays first, are never knocked down, and bank at the stand', () => {
  const { crew } = crewAt(4, { up: { shed: 1, drones: 1 } });
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift();
  const near = rest(crew, { x: 30, z: -10 }), stray = rest(crew, { x: 80, z: -120 });
  const st = crew.mods.state('county');
  crew.mods.call('tick', 0.05);
  assert.equal(st.drones.length, 2);
  assert.ok(st.drones.some(d => d.target === stray.id), 'a drone is after the stray');
  assert.ok(st.drones.some(d => d.target === near.id), 'the other takes the nearest ball');
  assert.ok(!crew.helpers.some(h => h.id.startsWith('dr')) && ![...crew.players.keys()].some(k => String(k).startsWith('dr')), 'not knockable people');
  const cash0 = crew.cash, helped0 = crew.stats.helped;
  for (let i = 0; i < 20 * 60 && crew.stats.helped < helped0 + 2; i++) crew.mods.call('tick', 0.05);
  assert.ok(!crew.balls.has(stray.id) && !crew.balls.has(near.id), 'both picked');
  assert.ok(crew.cash > cash0 && crew.stats.helped >= helped0 + 2, 'banked at the stand');
});

test('drone pure rules: 10 m/s, y 6 cruise, dips to y 1 to grab, strays beat nearer balls', () => {
  const d = { x: 0, y: 6, z: 0, yaw: 0 };
  droneStep(d, { x: 100, z: 0 }, 1);
  assert.ok(Math.abs(d.x - DRONES.SPEED) < 1e-9 && d.y === 6);
  let there = false;
  for (let i = 0; i < 2000 && !there; i++) there = droneStep(d, { x: 20, z: 0, grab: true }, 0.05);
  assert.ok(there && d.y <= DRONES.GRAB_Y + 0.05);
  const balls = [{ id: 1, x: 2, z: 0, rest: true, kind: 'range' }, { id: 2, x: 90, z: -100, rest: true, kind: 'range' }, { id: 3, x: 3, z: 0, rest: true, kind: 'one' }];
  assert.equal(droneTarget({ x: 0, z: 0 }, balls).id, 2, 'the stray first');
  assert.equal(droneTarget({ x: 0, z: 0 }, balls, new Set([2])).id, 1, 'then the nearest ball, never No. 1');
});

test('the drones are announced once', () => {
  const { crew, run } = crewAt(4, { up: { shed: 1, drones: 1 } });
  const p = crew.join('Pat'); crew.connect(p); crew.startShift(); run(2);
  assert.equal(crew.events.filter(e => e.t === 'pa' && e.id === 'drones').length, 1);
});

test('the view file declares id county at venue 4 and the registry runs a view lazily', () => {
  const src = readFileSync(new URL('../web/js/views/county.js', import.meta.url), 'utf8');
  assert.ok(src.includes("id: 'county',") && src.includes('venue: 4,'));
  let made = 0;
  const v = createViews({}, [{ id: 'county', venue: 4, create() { made++; return {}; } }]);
  v.onSnapshot({ venue: 3 }); assert.equal(made, 0);
  v.onSnapshot({ venue: 4 }); assert.equal(made, 1);
});
