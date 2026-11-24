// Dimple Creek at the crew level: balls drift down the running creek at the Club,
// stop in the dry gravel at the Muni, nobody picks up a drifting ball, and only the
// Cart Bridge gets the cart across.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { MAP } from '../web/js/map.js';

function makeCrew(save) {
  const clock = { t: 1000 };
  const crew = new Crew('TEST', save, { now: () => clock.t, seed: 5, shiftSecs: 600 });
  crew.join('A');
  crew.startShift();
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
// Drop a ball straight down onto the creek line, on the outflow (well away from the pond).
const onCreek = crew => crew.addBall({ x: 36, y: 1.2, z: -105, vx: 0, vy: -3, vz: 0, kind: 'range' });

test('Club: a ball landing in the creek drifts (event), cannot be picked up, and rests at the Grate', () => {
  const { crew, run } = makeCrew({ day: 4, venue: 1 });
  for (const m of crew.mats) m.next = 1e9;   // no customer balls
  const b = onCreek(crew);
  crew.flush();
  run(1);
  assert.equal(b.drifting, true);
  assert.ok(crew.flush().ev.some(e => e.t === 'drift' && e.id === b.id), 'drift event');
  const a = [...crew.players.values()][0];
  a.x = b.x; a.z = b.z;
  assert.equal(crew.pickup(a, b.id), false, 'no grabbing a ball out of the current');
  run(60);
  assert.equal(b.drifting, false);
  assert.equal(b.rest, true);
  assert.ok(Math.hypot(b.x - MAP.GRATE.x, b.z - MAP.GRATE.z) < MAP.GRATE.r + 0.5, `rests at the Grate: ${b.x}, ${b.z}`);
});

test('Muni: the creek is dry gravel; a ball landing there stays put and can be picked up', () => {
  const { crew, run } = makeCrew({ day: 4, venue: 0 });
  for (const m of crew.mats) m.next = 1e9;
  const b = onCreek(crew);
  run(2);
  assert.equal(!!b.drifting, false);
  assert.equal(b.rest, true);
  assert.ok(Math.hypot(b.x - 36, b.z + 105) < 0.5);
});

test('the cart cannot be driven across the creek off the bridge', () => {
  const { crew, clock } = makeCrew({ day: 4, venue: 1, up: { cart: 1 } });
  const a = [...crew.players.values()][0];
  const c = crew.cart;
  c.x = 36; c.z = -100; c.driver = a.id; c.movedAt = clock.t;   // just north of the outflow
  clock.t += 1000;
  crew.driveTo(a, { x: 36, z: -108, yaw: 0 }, clock.t);
  assert.ok(c.z > -103, `stopped at the bank, z ${c.z}`);
});
