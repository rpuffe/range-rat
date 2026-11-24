// The day-one pacing pack (council round 3, build item 2): day lengths,
// the beginners' clinic, and clocking in at the yard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SIM, shiftSecsFor, launch, mulberry32 } from '../web/js/sim.js';

const clockCrew = (save = null, opts = {}) => new Crew('TEST', save, { now: () => 0, seed: 3, ...opts });

test('shiftSecsFor: 4, 6, then 7 minutes', () => {
  assert.equal(shiftSecsFor(1), 240);
  assert.equal(shiftSecsFor(2), 360);
  for (const d of [3, 4, 10]) assert.equal(shiftSecsFor(d), 420);
});

test('the crew follows the day lengths at the Muni, and a full day at later venues', () => {
  const c = clockCrew();
  c.join('A');
  c.startShift();
  assert.equal(c.shiftSecs, 240, 'day 1');
  c.endShift(); c.startShift();
  assert.equal(c.shiftSecs, 360, 'day 2');
  const club = clockCrew({ day: 2, venue: 1 });
  club.join('A'); club.startShift();
  assert.equal(club.shiftSecs, SIM.SHIFT_SECS);
});

test('the env override wins over the day lengths', () => {
  const c = clockCrew(null, { shiftSecs: 40 });
  c.join('A'); c.startShift();
  assert.equal(c.shiftSecs, 40);
});

test('beginners\' clinic: day-1 carries are ×0.7 of the same shot', () => {
  const mat = { x: 0 };
  const a = launch(mat, mulberry32(9)), b = launch(mat, mulberry32(9), { beginner: true });
  const sa = Math.hypot(a.vx, a.vy, a.vz), sb = Math.hypot(b.vx, b.vy, b.vz);
  assert.ok(Math.abs(sb / sa - 0.7) < 1e-9, `ratio ${sb / sa}`);
});

test('every shift starts with the whole crew clocked in at the yard, out of the cart and the pond', () => {
  const c = clockCrew({ day: 3 });
  const a = c.join('A'), b = c.join('B');
  a.x = -40; a.z = -120; a.diving = true; a.wand = true;
  b.x = 50; b.z = -60;
  c.startShift();
  for (const p of [a, b]) {
    assert.ok(p.x >= 18 && p.x <= 30, `x ${p.x}`);
    assert.equal(p.z, 4);
    assert.equal(p.diving, false);
    assert.equal(p.wand, false);
  }
  assert.notEqual(a.x, b.x, 'side by side, not stacked');
});
