// Council round 7 #4: Gary's warning, dealt (one failing stop per Rat, nearest first), and the Muni's day-3 line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { dealGary, GARY_TEXT, DAY3, nudgeLine, nudgeTarget } from '../web/js/nudge.js';
import { GARY } from '../web/js/sim.js';

function makeCrew(save, n = 2, shiftSecs = 200) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('DEAL', { voiced: ['welcome', 'gary'], ...save }, { shiftSecs, seed: 5, now: () => clock.t });
  const rats = [];
  for (let i = 0; i < n; i++) { const p = crew.join('R' + i); crew.connect(p); rats.push(p); }
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;      // no customers: the mud is what the test sets
  const step = (secs = 0.05) => { for (let t = 0; t < secs - 1e-9; t += 0.05) { clock.t += 50; crew.tick(0.05); } crew.flush(); };
  const nudges = () => crew.snapshot().mods?.nudge ?? {};
  const mats = v => { for (const k of Object.keys(crew.fixtures)) if (k.startsWith('mat')) crew.fixtures[k] = v; };
  return { crew, rats, step, nudges, mats, clock };
}
const toWarn = m => { m.crew.shiftT = m.crew.shiftSecs * GARY.AT - 0.01; m.step(0.1); assert.equal(m.crew.gary?.phase, 'warn'); };

test('dealGary: nearest first, one failing stop each, extras double up on the mats', () => {
  const stops = [{ id: 'sign', x: 14, z: 13 }, { id: 'mats', x: 0, z: 3.5 }, { id: 'stand', x: 26, z: 10 }];
  assert.deepEqual(dealGary(stops, [{ id: 'a', x: 25, z: 9 }, { id: 'b', x: 1, z: 3 }, { id: 'c', x: 15, z: 12 }, { id: 'd', x: 50, z: 50 }]),
    { a: 'stand', b: 'mats', c: 'sign', d: 'mats' });
  assert.deepEqual(dealGary([], [{ id: 'a', x: 0, z: 0 }]), {}, 'nothing failing: no line');
  assert.deepEqual(dealGary([{ id: 'sign', x: 14, z: 13 }], [{ id: 'a', x: 0, z: 0 }, { id: 'b', x: 1, z: 1 }]), { a: 'sign', b: 'sign' }, 'no mats to double up on: the nearest failing stop');
  for (const l of Object.values(GARY_TEXT)) assert.ok(l.split(/\s+/).length <= 8, l);
  assert.equal(nudgeLine('gary:sign'), 'Gary checks the sign. Hose it!');
  assert.equal(nudgeLine('mats3'), DAY3.TEXT);
  assert.equal(nudgeLine('hose'), 'Try hosing the mats.');
  assert.ok(nudgeTarget('gary:kitchen'));
  assert.deepEqual(nudgeTarget('gary:cart', true, {}, { cart: { x: 5, z: 6 } }), { x: 5, z: 6, y: 2.2, s: 1 });
});

test("Gary's warning deals only failing stops, nearest first; a stop that passes clears its line", () => {
  const m = makeCrew({ day: 5 });
  const [a, b] = m.rats;
  a.x = 1; a.z = 3; b.x = 15; b.z = 12;
  m.crew.fixtures.sign = 0.9; m.crew.fixtures.stand = 0; m.mats(0.9);
  assert.deepEqual(m.nudges(), {}, 'nothing before the warning');
  toWarn(m);
  assert.deepEqual(m.nudges(), { [a.id]: 'gary:mats', [b.id]: 'gary:sign' });
  m.crew.fixtures.sign = 0;
  m.step(0.1);
  assert.deepEqual(m.nudges(), { [a.id]: 'gary:mats' }, 'the sign passes: its line clears');
});

test('a late joiner gets one; every line clears when Gary reaches his first stop', () => {
  const m = makeCrew({ day: 6 }, 1);
  const [a] = m.rats;
  a.x = 14; a.z = 12;
  m.crew.fixtures.sign = 0.9; m.mats(0.9);
  toWarn(m);
  assert.equal(m.nudges()[a.id], 'gary:sign');
  const late = m.crew.join('Late'); m.crew.connect(late); late.x = 0; late.z = 2;
  m.step(0.1);
  assert.equal(m.nudges()[late.id], 'gary:mats', 'the late joiner: a failing stop too');
  for (let i = 0; i < 2000 && !(m.crew.gary.checks?.length > 0); i++) m.step(0.1);
  assert.ok(m.crew.gary.checks.length > 0, 'he reached his first stop');
  m.step(0.1);
  assert.deepEqual(m.nudges(), {}, 'all clear');
});

test('no Gary deal on Muni days 1 to 3 (Gary is day 4+)', () => {
  for (const day of [1, 2, 3]) {
    const m = makeCrew({ day });
    m.crew.fixtures.sign = 0.9; m.mats(0.9);
    m.crew.shiftT = m.crew.shiftSecs * GARY.AT + 1; m.step(0.2);
    assert.equal(m.crew.gary, null, 'no Gary on day ' + day);
    assert.ok(!Object.values(m.nudges()).some(v => v.startsWith('gary:')), 'no Gary line on day ' + day);
  }
});

test('day 3 at the Muni: "Keep the mats clean." at half-shift to the Rat nearest the mats, only over 0.3 mud', () => {
  const dirty = makeCrew({ day: 3 });
  const [a, b] = dirty.rats;
  a.x = 30; a.z = 20; b.x = 2; b.z = 4;
  dirty.mats(0.5);
  dirty.crew.shiftT = dirty.crew.shiftSecs * DAY3.AT - 1; dirty.step(0.1);
  assert.deepEqual(dirty.nudges(), {}, 'not before half-shift');
  dirty.crew.shiftT = dirty.crew.shiftSecs * DAY3.AT; dirty.step(0.1);
  assert.deepEqual(dirty.nudges(), { [b.id]: 'mats3' });
  b.washAt = dirty.clock.t + 1; dirty.step(0.1);
  assert.deepEqual(dirty.nudges(), {}, 'hosing clears it');

  const clean = makeCrew({ day: 3 });
  clean.mats(0.2);
  clean.crew.shiftT = clean.crew.shiftSecs * DAY3.AT; clean.step(0.1);
  clean.mats(0.9); clean.step(0.1);
  assert.deepEqual(clean.nudges(), {}, 'under 0.3 at half-shift: no line, and it does not deal again');
  const club = makeCrew({ day: 3, venue: 1 });
  club.mats(0.9); club.crew.shiftT = club.crew.shiftSecs * DAY3.AT; club.step(0.1);
  assert.deepEqual(club.nudges(), {}, 'the Muni only');
});
