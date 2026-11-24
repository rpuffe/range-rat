// The Orbital (council round 4, build item 9): orbit shots, debris ids, the EVA, the O2, the tether.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import orbit from '../server/venues/orbit.mjs';
import { MODULES, checkModule } from '../server/venues/index.mjs';
import { ORBIT, LIFT, debrisSpot, evaStep, rideHeight, spaceness, clampDisc, TETHER_ROW, debrisKpi, diveTiers } from '../web/js/orbit.js';
import { KIND_W, SHOP, nextPrice } from '../web/js/sim.js';
import { MAP } from '../web/js/map.js';
import { readFileSync } from 'node:fs';
import { RALLY_LINES, dealJobs } from '../web/js/rally.js';

function room(extra = {}, shiftSecs = 900) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('ORB', { venue: 5, day: 9, venueDay: 1, up: { shed: 1 }, ...extra }, { shiftSecs, seed: 11, now: () => clock.t, modules: [orbit] });
  const run = secs => { for (let i = 0; i < Math.round(secs * 20); i++) { clock.t += 50; crew.tick(0.05); } };
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift();
  const st = crew.mods.state('orbit');
  const toLift = q => { q.x = LIFT.x + 0.8; q.z = LIFT.z; };
  return { crew, clock, run, p, st, toLift };
}
// Pat rides up and is floating at the car.
function afloat(opts) {
  const r = room(opts);
  r.toLift(r.p);
  r.crew.input(r.p, { a: [{ t: 'lift' }] });
  r.run(ORBIT.RIDE + 0.3);
  assert.equal(r.st.riders.get(r.p.id)?.ph, 'out');
  return r;
}
const at = (p, lx, lz) => { p.x = LIFT.x + lx; p.z = LIFT.z + lz; };

test('the constants are the doc\'s, the module is valid and registered, and debris weighs 3', () => {
  assert.deepEqual({ ...ORBIT, TOP: 0 }, { SHOT: 0.05, VY: 70, LEAVE_Y: 150, CAP: 60, RIDE: 5, R: 11, GRAB: 2.2, GRAB_SLACK: 0.3, TETHER_EVERY: 8,
    KPI_AT: 30, SWIM_MUL: 1.2, EYE0: 1.7, TOP: 0, BAG_W: 3, PUMP_REACH: 3.4, SKY_CLEAR: 15 });
  assert.equal(ORBIT.TOP, 120);
  assert.equal(KIND_W.debris, ORBIT.BAG_W);
  assert.deepEqual(LIFT, { x: MAP.LIFT.x, z: MAP.LIFT.z });
  assert.doesNotThrow(() => checkModule(orbit));
  assert.ok(MODULES.includes(orbit));
  assert.equal(orbit.venue, 5);
});

test('debrisSpot is deterministic, stays inside the disc, and uses the golden angle', () => {
  for (let id = 0; id < 400; id++) {
    const a = debrisSpot(id), b = debrisSpot(id);
    assert.deepEqual(a, b);
    assert.ok(Math.hypot(a.x, a.z) <= 3 + 6 * 1.2 + 1e-9 && Math.hypot(a.x, a.z) < ORBIT.R, `id ${id} inside R`);
    assert.ok(Math.abs(a.y) <= 1.5 + 1e-9);
    assert.ok(Math.abs(Math.hypot(a.x, a.z) - (3 + (id % 7) * 1.2)) < 1e-9, 'radius 3 + (id mod 7) x 1.2');
  }
  const s = debrisSpot(1);
  assert.ok(Math.abs(Math.atan2(s.z, s.x) - 2.39996) < 1e-9);
});

test('5% of customer shots go straight up (lead balls never), and the gauge is 1 - debris / 30', () => {
  const { crew } = room();
  let up = 0; const N = 6000;
  for (let i = 0; i < N; i++) {
    const out = crew.mods.pipe('launchMod', { x: 0, y: 1, z: 0, vx: 3, vy: 9, vz: -20, kind: 'range' }, { mat: {}, kind: 'range', lead: false });
    if (out.orbit) { up++; assert.equal(out.vy, 70); assert.equal(out.vx, 0); assert.equal(out.vz, 0); }
  }
  assert.ok(up / N > 0.04 && up / N < 0.06, `got ${up / N}`);
  for (let i = 0; i < 200; i++) assert.ok(!crew.mods.pipe('launchMod', { vx: 1, vy: 1, vz: 1, kind: 'lead' }, { mat: {}, kind: 'lead', lead: true }).orbit);
  assert.equal(debrisKpi(0), 1); assert.equal(debrisKpi(15), 0.5); assert.equal(debrisKpi(30), 0); assert.equal(debrisKpi(60), 0);
});

test('a customer\'s orbit shot leaves above y 150 and becomes a debris id; the sky holds 60', () => {
  const { crew, run, st } = room();
  const b = crew.addBall({ x: -10, y: 1, z: -5, vx: 0, vy: 70, vz: 0, kind: 'range', orbit: true });
  let peak = 0; for (let i = 0; i < 20 * 6 && crew.balls.has(b.id); i++) { run(0.05); peak = Math.max(peak, b.y); }
  assert.ok(!crew.balls.has(b.id), 'the ball entity is gone');
  assert.ok(peak > 100, 'it flew');
  assert.equal(st.debris.size, 1);
  assert.deepEqual([...st.debris], [0]);
  const ev = crew.snapshot();
  assert.deepEqual(ev.mods.orbit.d, [0]);
  // fill the sky: the cap holds at 60 and a later shot just leaves.
  st.debris = new Set(Array.from({ length: 59 }, (_, i) => 100 + i)); st.next = 200;
  for (let k = 0; k < 4; k++) { crew.addBall({ x: -10, y: 160, z: -5, vx: 0, vy: 1, vz: 0, kind: 'range', orbit: true }); run(0.1); }
  assert.equal(st.debris.size, ORBIT.CAP);
  assert.equal(crew.mods.kpi(), 0);
});

test('Ride the Lift: only from the platform, 5 s up, floating in the 11 m disc', () => {
  const far = room();
  far.p.x = LIFT.x + 12; far.p.z = LIFT.z;
  far.crew.input(far.p, { a: [{ t: 'lift' }] });
  assert.equal(far.st.riders.size, 0, 'not from across the field');
  const { crew, run, p, st, toLift } = room();
  toLift(p);
  crew.input(p, { a: [{ t: 'lift' }] });
  assert.equal(st.riders.get(p.id).ph, 'up');
  assert.equal(crew.snapshot().mods.orbit.r[p.id][0], 0);
  run(ORBIT.RIDE - 0.5); assert.equal(st.riders.get(p.id).ph, 'up');
  run(0.8); assert.equal(st.riders.get(p.id).ph, 'out');
  assert.ok(crew.events.some(e => e.t === 'lift' && e.dir === 'up'));
  assert.ok(crew.events.some(e => e.t === 'pa' && e.id === 'eva'), 'the PA, once');
  // client-reported position, server-clamped to R round the car.
  crew.input(p, { x: LIFT.x + 40, z: LIFT.z, a: [] });
  assert.ok(Math.hypot(p.x - LIFT.x, p.z - LIFT.z) <= ORBIT.R + 1e-6);
  const q = { x: LIFT.x + 50, z: LIFT.z - 3 }; clampDisc(q);
  assert.ok(Math.abs(Math.hypot(q.x - LIFT.x, q.z - LIFT.z) - ORBIT.R) < 1e-9);
  assert.ok(rideHeight('up', 0) < 2 && rideHeight('up', ORBIT.RIDE) === 120 && rideHeight('out', 1) === 120 && rideHeight('down', ORBIT.RIDE) < 2);
  assert.ok(spaceness(2) === 0 && spaceness(120) === 1);
  // a second Ⓧ does nothing; two Rats can both be up.
  crew.input(p, { a: [{ t: 'lift' }] }); assert.equal(st.riders.size, 1);
});

test('a grab at 2.2 m works and at 3 m does not', () => {
  const a = afloat();
  a.st.debris = new Set([0]);                 // id 0 floats 3 m east of the car
  const s = debrisSpot(0);
  at(a.p, s.x + 3.0, s.z);
  a.crew.input(a.p, { a: [{ t: 'grab' }] });
  assert.equal(a.st.riders.get(a.p.id).bag.length, 0, '3 m: out of reach');
  assert.equal(a.st.debris.size, 1);
  at(a.p, s.x + 2.2, s.z);
  a.crew.input(a.p, { a: [{ t: 'grab' }] });
  assert.deepEqual(a.st.riders.get(a.p.id).bag, [0], '2.2 m: grabbed');
  assert.equal(a.st.debris.size, 0);
  assert.equal(a.crew.mods.kpi(), 1);
  assert.ok(a.crew.events.some(e => e.t === 'grabbed' && e.deb === 0));
});

test('the bag is your dive tier\'s bag (10 / 15 / 25 / 40)', () => {
  for (const [level, bag] of [[0, 10], [1, 15], [2, 25], [3, 40]]) {
    const a = afloat();
    a.p.dive = level;
    assert.equal(diveTiers(level).bag, bag);
    const r = a.st.riders.get(a.p.id);
    r.bag = Array.from({ length: bag }, (_, i) => 1000 + i);          // a full bag
    a.st.debris = new Set([0]); const s = debrisSpot(0); at(a.p, s.x + 1, s.z);
    a.crew.input(a.p, { a: [{ t: 'grab' }] });
    assert.equal(r.bag.length, bag, `tier ${level} is full at ${bag}`);
    assert.equal(a.st.debris.size, 1);
    r.bag.pop();
    a.crew.input(a.p, { a: [{ t: 'grab' }] });
    assert.equal(r.bag.length, bag, 'one more fits');
  }
});

test('ride down: the bag goes to your pocket at weight 3 a ball, and banks at the stand', () => {
  const a = afloat();
  a.st.debris = new Set([0, 1]);
  const r = a.st.riders.get(a.p.id); r.bag = [7, 8, 9];
  a.crew.input(a.p, { a: [{ t: 'ridedown' }] });
  assert.equal(r.ph, 'down');
  a.run(ORBIT.RIDE - 0.5); assert.ok(a.st.riders.has(a.p.id));
  a.run(0.8);
  assert.equal(a.st.riders.size, 0);
  assert.equal(a.p.pocket, 3);
  assert.equal(a.p.pocketW, 9);
  assert.ok(a.crew.events.some(e => e.t === 'landed' && e.n === 3));
  const cash = a.crew.cash;
  a.p.x = 0; a.p.z = 0;      // (the stand's deposit rules are crew.mjs's: here we just confirm the weight is what pays)
  a.crew.bank(3, a.p.id, null, a.p.pocketW);
  const per9 = a.crew.cash - cash;
  const c2 = a.crew.cash; a.crew.bank(3, a.p.id, null, 3);
  assert.ok(Math.abs(per9 - 3 * (a.crew.cash - c2)) < 0.02, 'weight 9 pays three times weight 3');
});

test('out of O2: the tether reels you in, the bag goes back to orbit with the same ids, and you ride down', () => {
  const a = afloat();
  const r = a.st.riders.get(a.p.id);
  r.bag = [3, 4, 5]; r.air = 0.2;
  a.run(0.5);
  assert.equal(r.ph, 'down');
  assert.deepEqual([...a.st.debris].sort(), [3, 4, 5]);
  assert.equal(r.bag.length, 0);
  assert.ok(a.crew.events.some(e => e.t === 'reel' && e.id === a.p.id));
  a.run(ORBIT.RIDE + 0.5);
  assert.equal(a.p.pocket, 0, 'nothing comes down');
  assert.equal(a.st.riders.size, 0);
  // the rules, pure: the dive tier's air, no Deep End drain, and a gasp at zero.
  const t = diveTiers(0);
  assert.equal(evaStep({ air: 20, dt: 1, tier: t }).air, 19);
  assert.equal(evaStep({ air: 0.5, dt: 1, tier: t }).gasp, true);
  assert.equal(evaStep({ air: 20, dt: 1, tier: t, gain: 3 }).air, 20, 'never past the tank');
});

// Council round 8 #4: the platform crank is gone. EVA air is the dive tier's tank; everyone rides.
test("round 8 #4: an orbpump input is ignored and changes no rider's air", () => {
  const a = afloat();
  const r = a.st.riders.get(a.p.id); r.air = 8;
  const q = a.crew.join('Quin'); a.crew.connect(q); at(q, 1.2, 0.5);
  for (let i = 0; i < 20; i++) { a.crew.input(q, { a: [{ t: 'orbpump', held: true }, { t: 'orbpump', turns: 1 }] }); a.run(0.1); }
  assert.ok(Math.abs(r.air - 6) < 0.06, `drains 1/s, crank or no crank: ${r.air}`);
  assert.equal(a.crew.snapshot().mods.orbit.p, undefined, 'no pumpers on the wire');
  assert.equal(a.st.pump, undefined);
  const view = readFileSync(new URL('../web/js/views/orbit.js', import.meta.url), 'utf8');
  assert.ok(!/crank their oxygen|orbpump/.test(view), 'no crank prompt, no crank input');
});

test('round 8 #4: four Rats can ride at once', () => {
  const a = room();
  const rats = [a.p, ...['Quin', 'Ros', 'Sal'].map(n => { const q = a.crew.join(n); a.crew.connect(q); return q; })];
  for (const q of rats) { a.toLift(q); a.crew.input(q, { a: [{ t: 'lift' }] }); }
  assert.equal(a.st.riders.size, 4);
  a.run(ORBIT.RIDE + 0.3);
  assert.ok(rats.every(q => a.st.riders.get(q.id)?.ph === 'out'), 'all four float');
  for (const q of rats) a.crew.input(q, { a: [{ t: 'ridedown' }] });
  a.run(ORBIT.RIDE + 0.3);
  assert.equal(a.st.riders.size, 0, 'all four ride down');
  // The sky line is everyone's: one job, every Rat gets it.
  const line = RALLY_LINES.gauge[5];
  assert.equal(line, 'Debris overhead. Everyone up the Lift!');
  const dealt = dealJobs([{ line, at: LIFT }], rats.map((q, i) => ({ id: q.id, x: i * 10, z: 0 })));
  assert.deepEqual(new Set(Object.values(dealt)), new Set([line]));
  assert.equal(Object.keys(dealt).length, 4);
});

test('the tether winch clears 1 debris every 8 s and banks it', () => {
  const none = room({ up: { shed: 1 } });
  none.st.debris = new Set([1, 2, 3]); none.run(17);
  assert.equal(none.st.debris.size, 3, 'no winch, no clearing');
  const { crew, run, st } = room({ up: { shed: 1, tether: 1 } });
  st.debris = new Set([1, 2, 3, 4, 5]);
  const cash = crew.cash;
  run(7.5); assert.equal(st.debris.size, 5);
  run(1);   assert.equal(st.debris.size, 4);
  run(16);  assert.equal(st.debris.size, 2);
  assert.ok(crew.cash > cash, 'it banks');
  assert.equal(crew.stats.winched, 3);
  assert.ok(crew.events.some(e => e.t === 'winch'));
});

test('the shop row: $6,000,000 base, Orbital only, and old saves load', () => {
  assert.ok(SHOP.includes(TETHER_ROW));
  assert.equal(TETHER_ROW.id, 'tether'); assert.equal(TETHER_ROW.minVenue, 5);
  assert.equal(TETHER_ROW.tiers[1].cost, 6_000_000);
  assert.equal(nextPrice('tether', {}, 1, 0, 4), null);
  assert.equal(nextPrice('tether', {}, 1, 0, 5), 6_000_000);
});

test('the save keeps the debris ids (and the next id); junk is cleaned', () => {
  const { crew, run, st } = room();
  st.debris = new Set([4, 9, 12]); st.next = 20;
  run(1);
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.deepEqual(save.mods.orbit, { d: [4, 9, 12], n: 20 });
  const back = new Crew('ORB', save, { modules: [orbit], seed: 1 });
  assert.deepEqual([...back.mods.state('orbit').debris], [4, 9, 12]);
  assert.equal(back.mods.state('orbit').next, 20);
  const junk = new Crew('ORB', { venue: 5, mods: { orbit: { d: [3, 'x', -1, 3.5, 7, 7], n: 'no' } } }, { modules: [orbit], seed: 1 });
  assert.deepEqual([...junk.mods.state('orbit').debris], [3, 7]);
  assert.equal(junk.mods.state('orbit').next, 8);
  assert.equal(new Crew('ORB', { venue: 5 }, { modules: [orbit], seed: 1 }).toSave().mods, undefined, 'nothing to keep, no key');
});

test('the bell brings a spacewalker down and banks the bag; a knockdown reels you in', () => {
  const a = afloat();
  const r = a.st.riders.get(a.p.id); r.bag = [1, 2];
  const cash = a.crew.cash;
  a.crew.mods.call('endShift', 'bell');
  assert.equal(a.st.riders.size, 0);
  assert.ok(a.crew.cash > cash, 'banked at the bell');
  const b = afloat();
  const rb = b.st.riders.get(b.p.id); rb.bag = [5];
  b.p.down = 3; b.run(0.1);
  assert.equal(rb.ph, 'down');
  assert.deepEqual([...b.st.debris], [5]);
});

test('the view and the PA line are wired (three is not loadable here, so read the files)', () => {
  const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
  const idx = read('../web/js/views/index.js').split(/\r?\n/);
  assert.ok(idx.includes("import orbit from './orbit.js';"));
  assert.ok(idx.includes('  orbit,'));
  const view = read('../web/js/views/orbit.js');
  assert.ok(view.includes("id: 'orbit',") && view.includes('venue: 5,') && view.includes('createEva'));
  assert.ok(read('../web/js/scuba.js').includes('export function createEva'));
  assert.ok(read('../web/js/pa.js').includes("eva: { line: 'A Range Rat has left the atmosphere. Corporate will hold their locker.'"));
});

test('round 7 #5: no orbit shots while the Last Bucket is on', () => {
  const { crew, st } = room();
  const shot = { x: 0, y: 1, z: 0, vx: 0, vy: 10, vz: -30, kind: 'range' };
  crew.rng = () => 0;                      // would always go up
  assert.ok(orbit.launchMod(crew, st, shot, { lead: false })?.orbit);
  crew.lastBucket = { phase: 'sky' };
  assert.equal(orbit.launchMod(crew, st, shot, { lead: false }), undefined);
  crew.lastBucket = { phase: 'done' };
  assert.ok(orbit.launchMod(crew, st, shot, { lead: false })?.orbit);
});
