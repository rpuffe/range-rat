import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew, newCode, validCode, cleanName } from '../server/crew.mjs';
import { SIM } from '../web/js/sim.js';

// A crew on a fake clock, so tests control time.
function makeCrew(opts = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('TEST', opts.save ?? null, { shiftSecs: 30, seed: 42, now: () => clock.t, ...opts });
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;   // Curb Appeal 1: Upkeep 1.5, so the cash below is exact
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
const restingBall = crew => [...crew.balls.values()].find(b => b.rest);
const standOn = (crew, p, x, z) => { p.x = x; p.z = z; };

test('codes are 4 letters with no I or O', () => {
  for (let i = 0; i < 500; i++) { const c = newCode(); assert.ok(validCode(c), c); assert.ok(!/[IO]/.test(c)); }
  assert.ok(!validCode('ABIO'));
  assert.ok(!validCode('abc'));
});

test('names are trimmed, control-free and capped', () => {
  assert.equal(cleanName('  Bob\u0007 '), 'Bob');
  assert.equal(cleanName('x'.repeat(40)).length, 16);
});

test('six players max, distinct colours, tokens checked', () => {
  const { crew } = makeCrew();
  const ps = Array.from({ length: 6 }, (_, i) => crew.join(`P${i}`));
  assert.ok(ps.every(Boolean));
  assert.equal(new Set(ps.map(p => p.color)).size, 6);
  assert.equal(crew.join('seventh'), null);
  assert.equal(crew.auth(ps[0].id, ps[0].token), ps[0]);
  assert.equal(crew.auth(ps[0].id, ps[1].token), null);
  assert.equal(crew.auth(ps[0].id, undefined), null);
});

test('no balls before the shift opens; customers hit once it does', () => {
  const { crew, run } = makeCrew();
  const p = crew.join('A'); crew.connect(p);
  run(5);
  assert.equal(crew.balls.size, 0);
  crew.input(p, { a: [{ t: 'start' }] });
  assert.equal(crew.phase, 'shift');
  run(10);
  assert.ok(crew.balls.size > 0);
});

test('pick up by hand: reach, pocket of 3, one owner per ball', () => {
  const { crew, run } = makeCrew();
  const a = crew.join('A'), b = crew.join('B'); crew.connect(a); crew.connect(b);
  crew.input(a, { a: [{ t: 'start' }] });
  run(20);
  const ball = restingBall(crew);
  assert.ok(ball, 'something landed');

  standOn(crew, a, ball.x + 10, ball.z);
  assert.deepEqual(crew.input(a, { a: [{ t: 'pickup', ball: ball.id }] }).denied, [ball.id], 'too far');

  standOn(crew, a, ball.x + 0.5, ball.z); standOn(crew, b, ball.x - 0.5, ball.z);
  assert.deepEqual(crew.input(a, { a: [{ t: 'pickup', ball: ball.id }] }).denied, []);
  assert.deepEqual(crew.input(b, { a: [{ t: 'pickup', ball: ball.id }] }).denied, [ball.id], 'already taken');
  assert.equal(a.pocket, 1);
  assert.ok(crew.flush().ev.some(e => e.t === 'gone' && e.id === ball.id && e.by === a.id));

  a.pocket = SIM.POCKET;
  run(10);
  const next = restingBall(crew);
  standOn(crew, a, next.x, next.z);
  assert.deepEqual(crew.input(a, { a: [{ t: 'pickup', ball: next.id }] }).denied, [next.id], 'pocket full');
});

test('dropping balls in the bucket stand pays the whole crew', () => {
  const { crew } = makeCrew();
  const a = crew.join('A');
  crew.input(a, { a: [{ t: 'start' }] });
  a.pocket = 3; a.pocketW = 3;   // deposit() reads the weight; real pickups keep both in step
  standOn(crew, a, 0, -40);
  crew.input(a, { a: [{ t: 'deposit' }] });
  assert.equal(crew.cash, 0, 'not at the stand');
  standOn(crew, a, SIM.STAND.x, SIM.STAND.z - 1);
  crew.input(a, { a: [{ t: 'deposit' }] });
  assert.equal(crew.cash, 5.64, 'BV = rate 1.25 (the one price) x Upkeep 1.5 (Curb 1) = 1.88, x 1 for a clean Rat');
  assert.equal(a.pocket, 0);
});

test('reported movement is clamped to a walking speed', () => {
  const { crew, clock } = makeCrew();
  const a = crew.join('A');
  const x0 = a.x;
  clock.t += 100;
  crew.input(a, { x: x0 - 500, z: a.z });
  assert.ok(x0 - a.x < 2, `teleport clamped (moved ${(x0 - a.x).toFixed(2)} m)`);
});

test('a ball through a standing player knocks them flat and spills their pocket', () => {
  const { crew, run } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  crew.phase = 'report';                 // no customers: just our ball
  standOn(crew, a, 0, -60); a.pocket = 3;
  crew.addBall({ x: 0, y: 1.0, z: -55, vx: 0, vy: 0.5, vz: -25 });
  crew.flush();
  run(0.5);
  assert.ok(a.down > 0, 'down');
  assert.equal(a.pocket, 0, 'pocket spilled');
  const ev = crew.flush().ev;
  assert.ok(ev.some(e => e.t === 'knock' && e.id === a.id));
  assert.equal(ev.filter(e => e.t === 'spawn').length, 3, 'three balls go everywhere');
  assert.deepEqual(crew.input(a, { a: [{ t: 'deposit' }] }).denied, []);
  run(SIM.KNOCK_SECS + 0.1);
  assert.equal(a.down, 0, 'back up');
});

test('a shift ends into a report, then the next day starts on a clean field', () => {
  const { crew, run } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  crew.input(a, { a: [{ t: 'start' }] });
  crew.stats.picked = 5;
  run(31);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.report.picked, 5);
  assert.equal(crew.totals.picked, 5);
  assert.equal(crew.toSave().day, 2, 'the save is ready for tomorrow');
  crew.input(a, { a: [{ t: 'start' }] });
  assert.equal(crew.day, 2);
  assert.equal([...crew.balls.values()].filter(b => !b.sunk).length, 0, 'the field is clean (the pond keeps what sank)');
});

test('a crew loads from its save', () => {
  const { crew } = makeCrew({ save: { v: 1, day: 4, cash: 120, totals: { picked: 300 } } });
  assert.equal(crew.day, 4);
  assert.equal(crew.cash, 120);
  assert.equal(crew.totals.picked, 300);
  assert.equal(crew.phase, 'lobby');
});

test('an offline player is dropped after the grace period, balls and all', () => {
  const { crew, clock, run } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  a.pocket = 2;
  crew.disconnect(a);
  run(1);
  assert.ok(crew.players.has(a.id), 'kept for a reload');
  clock.t += 61_000;
  run(0.1);
  assert.ok(!crew.players.has(a.id));
  assert.equal(crew.balls.size, 2, 'their pocket lands on the grass');
});
