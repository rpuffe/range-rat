import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIM, MATS, activeMats, mulberry32, launch, advanceBall, ballHitsPlayer } from '../web/js/sim.js';

const fly = b => { let t = 0; while (!b.rest && t < 60) { advanceBall(b, 1 / 60); t += 1 / 60; } return t; };

test('customer shots land on the range and stop', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 200; i++) {
    const b = { ...launch(MATS[i % MATS.length], rng), rest: false };
    const t = fly(b);
    assert.ok(b.rest, 'ball comes to rest');
    assert.ok(t < 30, `rests in a sane time (${t.toFixed(1)}s)`);
    assert.ok(b.z < -15 && b.z > -220, `lands down range (z=${b.z.toFixed(1)})`);
    assert.equal(b.y, SIM.BALL_R);
  }
});

test('the physics is frame-rate independent (fixed steps)', () => {
  const a = { ...launch(MATS[3], mulberry32(1)), rest: false };
  const b = { ...a };
  while (!a.rest) advanceBall(a, 1 / 20);       // server ticks
  while (!b.rest) advanceBall(b, 1 / 144);      // a fast monitor
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9);
});

test('more crew, more customers, up to every mat', () => {
  assert.equal(activeMats(1), 6);
  assert.equal(activeMats(2), 8);
  assert.equal(activeMats(4), 10);
  assert.equal(activeMats(6), 10);
});

test('a fast ball through a standing player hits; slow, high or downed ones do not', () => {
  const p = { x: 0, z: -50, down: 0 };
  const b = { x: 0, y: 1.0, z: -51, vx: 0, vy: -2, vz: -20, rest: false };
  assert.ok(ballHitsPlayer(0, 1.2, -49, b, p), 'passes through');
  assert.ok(!ballHitsPlayer(0, 5, -49, { ...b, y: 5 }, p), 'over the head');
  assert.ok(!ballHitsPlayer(0, 1.2, -49, { ...b, vz: -2, vy: 0 }, p), 'too slow');
  assert.ok(!ballHitsPlayer(0, 1.2, -49, b, { ...p, down: 1 }), 'already down');
  assert.ok(!ballHitsPlayer(3, 1.2, -49, { ...b, x: 3 }, p), 'wide');
});
