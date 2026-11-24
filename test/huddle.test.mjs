// The huddle beat's client rules (council round 6 #5): web/js/huddlerules.js (pure, no three).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HUDDLE, ringSlots, garyRingSlots, slotOfTick, sweepTicks, sweepNow, lastBucketLine, garyCountdown } from '../web/js/huddlerules.js';
import { SIM, GARY } from '../web/js/sim.js';

test('the ring and the rules agree with the server and sim.js', () => {
  assert.equal(GARY.HUDDLE_R, HUDDLE.R);
  assert.equal(GARY.SPEED, 5);
  const stand = GARY.STOPS.find(s => s.id === 'stand');
  assert.deepEqual({ x: stand.x, z: stand.z }, { x: 26, z: 10 }, 'garyCountdown\'s default stop');
  assert.deepEqual(SIM.STAND, { x: 26, z: 6 });
});

test('slots: one per Rat, in the server\'s order, filled when in the ring, bright when held', () => {
  const players = [{ id: 'a', color: '#f00' }, { id: 'b', color: '#0f0' }, { id: 'c', color: '#00f' }];
  const lb = { phase: 'huddle', slots: ['b', 'a', 'c'], in: ['a', 'b'], held: ['b'], sweep: 0 };
  assert.deepEqual(ringSlots(lb, players), [
    { id: 'b', color: '#0f0', in: true, held: true },
    { id: 'a', color: '#f00', in: true, held: false },
    { id: 'c', color: '#00f', in: false, held: false },
  ]);
  assert.deepEqual(ringSlots({ phase: 'carried' }, players), [], 'no ring outside the huddle');
  assert.equal(ringSlots({ phase: 'huddle', slots: 'abcdefgh'.split(''), in: [], held: [] }, []).length, HUDDLE.MAX_SLOTS);
});

test('Gary\'s ring: online Rats only, a slot fills inside 8 m of the stand, never held', () => {
  const s = garyRingSlots([
    { id: 'a', color: '#f00', online: true, x: 26, z: 13.9 },
    { id: 'b', color: '#0f0', online: true, x: 26, z: 14.1 },
    { id: 'c', color: '#00f', online: false, x: 26, z: 6 },
  ], SIM.STAND);
  assert.deepEqual(s.map(x => [x.id, x.in, x.held]), [['a', true, false], ['b', false, false]]);
});

test('ticks: every slot gets ticks, a gap between slots, none for a lone Rat', () => {
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const per = Array(n).fill(0);
    let gaps = 0;
    for (let i = 0; i < HUDDLE.TICKS; i++) { const s = slotOfTick(i, n); if (s < 0) gaps++; else per[s]++; }
    assert.equal(gaps, n > 1 ? n : 0, `${n} slots: ${n > 1 ? n : 0} gaps`);
    assert.ok(per.every(k => k >= 6), `${n} slots: each slot is drawn (${per})`);
  }
  assert.equal(slotOfTick(0, 0), -1);
});

test('the sweep: 0 → 48 gold ticks over 3 s, and it only runs on locally while every slot is held', () => {
  assert.equal(sweepTicks(0), 0);
  assert.equal(sweepTicks(1.5), 24);
  assert.equal(sweepTicks(3), HUDDLE.TICKS);
  assert.equal(sweepTicks(9), HUDDLE.TICKS);
  const all = { phase: 'huddle', slots: ['a', 'b'], held: ['a', 'b'], sweep: 1 };
  assert.equal(sweepNow(all, 0.5), 1.5);
  assert.equal(sweepNow(all, 9), 3, 'capped at the bank');
  assert.equal(sweepNow({ ...all, held: ['a'] }, 0.5), 0, 'a slot let go: nothing runs');
  assert.equal(sweepNow({ phase: 'carried' }, 1), 0);
});

test('the banner: one line, "HOLD Ⓐ TOGETHER · 3 / 4" once the carrier is at the stand (≤ 8 words)', () => {
  const players = [
    { id: 'a', name: 'Ann', online: true, one: true, x: 26, z: 6 },
    { id: 'b', name: '<Bo>', online: true, x: 60, z: 6 },
  ];
  const c = { phase: 'shift', players, lastBucket: { phase: 'huddle', slots: ['a', 'b', 'c', 'd'], held: ['a', 'b', 'c'], in: [] } };
  const line = lastBucketLine(c, 'a', 'Ⓐ');
  assert.equal(line, 'HOLD Ⓐ TOGETHER · <b>3 / 4</b>');
  assert.ok(line.replace(/<[^>]+>/g, '').split(/\s+/).filter(w => w !== '·').length <= 8);
  assert.equal(lastBucketLine(c, 'a', 'SPACE'), 'HOLD SPACE TOGETHER · <b>3 / 4</b>');
  // Before the stand: the old line, with names escaped (the banner is innerHTML).
  const walking = lastBucketLine({ ...c, lastBucket: { phase: 'carried' } }, 'a');
  assert.match(walking, /^BALL NO\. 1 → THE STAND · <b>1 \/ 2<\/b> · waiting: &#60;Bo&#62;$/);
  assert.equal(lastBucketLine({ ...c, players: [], lastBucket: { phase: 'down' } }, 'a'), 'BALL NO. 1 IS DOWN · follow the beam');
  assert.equal(lastBucketLine({ ...c, lastBucket: { phase: 'done' } }, 'a'), '');
  assert.equal(lastBucketLine({ ...c, phase: 'report' }, 'a'), '');
});

test('the Board counts GARY 3 · 2 · 1 on his last leg to the stand, and only then', () => {
  const at = (z, to = 'stand', phase = 'drive') => garyCountdown({ phase, to, x: 26, z });
  assert.equal(at(10 + 0.3 + 5 * 3.5), null, 'more than 3 s out');
  assert.equal(at(10 + 0.3 + 5 * 2.5), 'GARY 3');
  assert.equal(at(10 + 0.3 + 5 * 1.5), 'GARY 3 · 2');
  assert.equal(at(10 + 0.3 + 5 * 0.5), 'GARY 3 · 2 · 1');
  assert.equal(at(10), null, 'arrived: he inspects');
  assert.equal(at(12, 'mats'), null, 'not heading for the stand');
  assert.equal(at(12, 'stand', 'warn'), null);
  assert.equal(garyCountdown(null), null);
});
