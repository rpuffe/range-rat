// Council round 10 #8 (§D): late automation you play with. The Stadium's Autopilot cart (web/js/autopilot.js,
// server/venues/stadium.mjs) and the County's drone dispatch (web/js/county.js, server/venues/county.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP, onTrack } from '../web/js/map.js';
import { CART, SIM, perks, underReels } from '../web/js/sim.js';
import { CROWD, gateAt, newLap, stepLap } from '../web/js/stadium.js';
import { AUTO, newAuto, stepAutopilot, lapGoal, harvestTarget, nextMode, trackPoint } from '../web/js/autopilot.js';
import { DISPATCH, droneTarget, newZone, zoneLive } from '../web/js/county.js';
import { Crew } from '../server/crew.mjs';
import stadium from '../server/venues/stadium.mjs';
import county from '../server/venues/county.mjs';

const W3 = { venue: 3 };
const ctx = (over = {}) => ({ dt: 0.05, t: 0, world: W3, speed: 11, mul: () => 1.3, cap: 300, balls: [], people: [], stand: SIM.STAND,
  reach: SIM.STAND_REACH + 2, underReels: (c, b) => underReels(c, b, 4.2), ...over });

test('the row: tier 4 of the cart row, the Stadium on, $250k base', () => {
  assert.equal(perks({ cart: 3 }).autopilot, false);
  assert.equal(perks({ cart: 4 }).autopilot, true);
  assert.equal(perks({ cart: 4 }).carts, 2, 'it drives the carts you have');
});

test('lap mode: from the parking spot onto the Track and round it, laps that stepLap counts', () => {
  const c = { x: CART.PARK.x, z: CART.PARK.z, yaw: 0, load: 0, tipT: 0 }, a = newAuto();
  const lap = newLap(); let laps = 0, onAt = null;
  for (let i = 0; i < 20 * 70; i++) {
    stepAutopilot(c, a, ctx({ t: i * 0.05 }));
    if (onAt == null && onTrack(c.x, c.z)) onAt = i * 0.05;
    if (stepLap(lap, gateAt(c.x, c.z), i * 0.05)) laps++;
  }
  assert.ok(onAt != null && onAt < 10, `on the Track in ${onAt?.toFixed(1)} s`);
  assert.ok(laps >= 2, `${laps} laps in 70 s (each within the 25 s gate window)`);
  assert.ok(onTrack(c.x, c.z, 1));
});

test('it stops for anyone on foot near its nose (so you can climb in, or hold Ⓨ)', () => {
  const p = trackPoint(0), c = { x: p.x, z: p.z, yaw: 0, load: 0, tipT: 0 }, a = newAuto();
  const r = stepAutopilot(c, a, ctx({ people: [{ x: p.x + 1, z: p.z }] }));
  assert.equal(r.moved, 0);
  assert.deepEqual([c.x, c.z], [p.x, p.z]);
  assert.ok(stepAutopilot(c, a, ctx({ people: [{ x: p.x + 9, z: p.z }] })).moved > 0);
});

test('harvest mode: drives to the nearest ball, scoops at ×0.6, and tips at the return when full', () => {
  const balls = [];
  for (let i = 0; i < 12; i++) balls.push({ id: i, x: 10 + (i % 4) * 0.6, z: -20 - Math.floor(i / 4) * 0.6, y: 0.06, rest: true, kind: 'range' });
  const far = { id: 99, x: -40, z: -100, y: 0.06, rest: true, kind: 'range' };   // across the creek: it can't drive there
  const c = { x: 20, z: -5, yaw: 0, load: 0, tipT: 0 }, a = newAuto('harvest');
  let moved = 0, n = 0;
  for (let i = 0; i < 20 * 30 && balls.length; i++) {
    const r = stepAutopilot(c, a, ctx({ t: i * 0.05, balls: [...balls, far], mul: () => 1 }));
    moved += r.moved;
    for (const b of r.scooped) { const k = balls.indexOf(b); if (k >= 0) { balls.splice(k, 1); c.load++; n++; } }
  }
  assert.equal(n, 12, 'every nearby ball scooped');
  assert.ok(moved > 0);
  assert.ok(harvestTarget(c, [far], { world: W3 }) === far, 'it is still the nearest...');
  // ...but a full hopper goes home first.
  c.load = 300;
  const d0 = Math.hypot(c.x - SIM.STAND.x, c.z - SIM.STAND.z);
  for (let i = 0; i < 20 * 3; i++) stepAutopilot(c, a, ctx({ cap: 300, balls: [far], mul: () => 1 }));
  assert.ok(Math.hypot(c.x - SIM.STAND.x, c.z - SIM.STAND.z) < d0, 'heads to the return');
  const v = 11 * AUTO.SPEED;
  assert.ok(Math.abs(d0 - Math.hypot(c.x - SIM.STAND.x, c.z - SIM.STAND.z) - v * 3) < 1, 'at ×0.6 speed');
  assert.equal(nextMode('lap'), 'harvest'); assert.equal(nextMode('harvest'), 'lap');
  assert.ok(lapGoal(0, 0));
});

function autoCrew() {
  const clock = { t: 1_000_000 };
  const crew = new Crew('AUTO', { venue: 3, day: 9, venueDay: 1, up: { shed: 1, cart: 4 } }, { shiftSecs: 300, seed: 5, now: () => clock.t, modules: [stadium] });
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift();
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, p, run, st: crew.mods.state('stadium'), clock };
}

test('an autopilot lap counts at half: +0.03 crowd, and its own counter', () => {
  const { crew, p, run, st } = autoCrew();
  p.x = 30; p.z = 30;   // out of the way
  run(1);
  assert.equal(crew.carts[0].auto, 'lap', 'the undriven cart is on autopilot');
  const before = st.s;
  run(60);
  assert.ok(st.autoLaps >= 2, `${st.autoLaps} autopilot laps`);
  assert.equal(st.laps, 0, 'no driven laps');
  assert.ok(crew.events.length >= 0);
  assert.ok(st.s > before - 60 * CROWD.DECAY - 1e-9, 'the laps hold the crowd up');
  const snap = crew.snapshot().mods.stadium;
  assert.deepEqual(snap.auto, ['lap', 'lap']); assert.equal(snap.autoLaps, st.autoLaps);
});

test('a crew ping on an autopilot cart pays the prize and +0.08', () => {
  const { crew, p, run, st } = autoCrew();
  p.x = 30; p.z = 30;
  run(1);
  const c = crew.carts[0], s0 = st.s, pings0 = crew.stats.pings;
  crew.ping({ by: p.id, vx: 1, vy: 1, vz: 1 }, c);
  const ev = crew.events.filter(e => e.t === 'ping').at(-1);
  assert.ok(ev.prize, 'a prize, though nobody drives it');
  assert.equal(crew.stats.pings, pings0 + 1);
  assert.ok(st.s - s0 >= CROWD.PING - 1e-9, `+${(st.s - s0).toFixed(3)}`);
});

test('Ⓨ held at an undriven cart switches it to harvest; it scoops and tips at the return', () => {
  const { crew, p, run, st } = autoCrew();
  const c = crew.carts[0];
  p.x = c.x + 1; p.z = c.z;
  crew.mods.first('input', p, { t: 'auto' });
  assert.equal(st.auto[0].mode, 'harvest');
  assert.ok(crew.events.some(e => e.t === 'auto' && e.mode === 'harvest'));
  p.x = 30; p.z = 40;
  for (let i = 0; i < 20; i++) { const b = crew.addBall({ x: 12 + (i % 5), y: 0.06, z: -14 - Math.floor(i / 5), vx: 0, vy: 0, vz: 0, kind: 'range' }); b.rest = true; }
  const picked0 = crew.stats.carted;
  run(40);
  assert.ok(crew.stats.carted - picked0 >= 10, `${crew.stats.carted - picked0} scooped`);
});

test('drone dispatch: a zone at the Rat for 30 s, cleared first, then it lapses', () => {
  const z = newZone(10, -50, 100);
  assert.deepEqual([z.r, z.until], [DISPATCH.R, 130]);
  assert.ok(zoneLive(z, 129.9) && !zoneLive(z, 130));
  const d = { x: 0, z: 0 };
  const near = { id: 1, x: 2, z: -2, rest: true }, inZone = { id: 2, x: 14, z: -55, rest: true }, stray = { id: 3, x: 80, z: -100, rest: true };
  assert.equal(droneTarget(d, [near, inZone, stray]), stray, 'strays first without a zone');
  assert.equal(droneTarget(d, [near, inZone, stray], new Set(), z), inZone, 'the zone beats strays and the nearest');
});

test('the County: hold Ⓨ pins the zone, every drone clears it first, and they bank at the nearest return', () => {
  const clock = { t: 1_000_000 };
  const crew = new Crew('DISP', { venue: 4, day: 12, venueDay: 1, up: { shed: 1, drones: 1, returns: 2 } }, { shiftSecs: 300, seed: 11, now: () => clock.t, modules: [county] });
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift();
  const st = crew.mods.state('county');
  const rest = o => { const b = crew.addBall({ x: 0, y: 0.06, z: 0, vx: 0, vy: 0, vz: 0, kind: 'range', ...o }); b.rest = true; return b; };
  rest({ x: 26, z: 4 }); rest({ x: 80, z: -120 });   // a near ball and a stray
  const zoned = [rest({ x: 0, z: -125 }), rest({ x: 3, z: -128 }), rest({ x: -8, z: -131 })];
  crew.mods.call('tick', 0.05);
  p.x = 0; p.z = -128;
  assert.equal(crew.mods.first('input', p, { t: 'dispatch' }), true);
  assert.ok(st.zone && crew.events.some(e => e.t === 'dispatch'));
  assert.ok(crew.snapshot().mods.county.zone);
  for (let i = 0; i < 2; i++) crew.mods.call('tick', 0.05);
  const targets = st.drones.map(d => d.target);
  assert.ok(targets.every(id => zoned.some(b => b.id === id)), 'both drones re-aimed into the zone');
  for (let i = 0; i < 20 * 25; i++) crew.mods.call('tick', 0.05);
  assert.ok(zoned.every(b => !crew.balls.has(b.id)), 'the zone is cleared');
  // A full drone near the Back return banks there: into the pipe (6 s), not a flight home.
  const d = st.drones[0]; d.x = -6; d.z = -120; d.pocket = 25; d.pocketW = 25; d.target = null;
  const q0 = crew.tube.q.length;
  for (let i = 0; i < 40; i++) crew.mods.call('tick', 0.05);
  assert.equal(crew.tube.q.length, q0 + 1, 'fed the Back return');
  assert.equal(crew.tube.q.at(-1).kind, 'helper');
  assert.ok(crew.events.some(e => e.t === 'tube' && e.at === 'back'));
  for (let i = 0; i < 20 * 35; i++) crew.mods.call('tick', 0.05);
  assert.equal(st.zone, null, 'it lapses after 30 s');
});
