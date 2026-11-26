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
  assert.deepEqual(SIM.STAND, { x: 27, z: 1.8 }, 'the ball return by the mats (owner layout): the ring is round it');
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
    { id: 'a', color: '#f00', online: true, x: SIM.STAND.x, z: SIM.STAND.z + 7.9 },
    { id: 'b', color: '#0f0', online: true, x: SIM.STAND.x, z: SIM.STAND.z + 8.1 },
    { id: 'c', color: '#00f', online: false, x: SIM.STAND.x, z: SIM.STAND.z },
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
    { id: 'a', name: 'Ann', online: true, one: true, x: SIM.STAND.x, z: SIM.STAND.z },
    { id: 'b', name: '<Bo>', online: true, x: 60, z: 6 },
  ];
  const c = { phase: 'shift', players, lastBucket: { phase: 'huddle', slots: ['a', 'b', 'c', 'd'], held: ['a', 'b', 'c'], in: [] } };
  const line = lastBucketLine(c, 'a', 'Ⓐ');
  assert.equal(line, 'HOLD Ⓐ TOGETHER · <b>3 / 4</b>');
  assert.ok(line.replace(/<[^>]+>/g, '').split(/\s+/).filter(w => w !== '·').length <= 8);
  assert.equal(lastBucketLine(c, 'a', 'SPACE'), 'HOLD SPACE TOGETHER · <b>3 / 4</b>');
  // Playthrough 5 C10: solo, no "TOGETHER · 0 / 1".
  assert.equal(lastBucketLine({ ...c, lastBucket: { phase: 'huddle', slots: ['a'], held: [], in: [] } }, 'a', 'SPACE'), 'HOLD SPACE');
  // Before the stand: the old line, with names escaped (the banner is innerHTML).
  const walking = lastBucketLine({ ...c, lastBucket: { phase: 'carried' } }, 'a');
  assert.equal(walking, 'BALL NO. 1 · HOME · <b>1/2</b> · WAITING: &#60;BO&#62;');   // council round 11 8.3: one name plus a count
  assert.equal(lastBucketLine({ ...c, players: [], lastBucket: { phase: 'down' } }, 'a'), 'BALL NO. 1 DOWN · follow the gold beam');
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

test('round 7 #5: the Last Bucket line during the sky gate counts the pieces still to clear', async () => {
  const { lastBucketLine: line } = await import('../web/js/huddlerules.js');
  assert.equal(line({ phase: 'shift', players: [], lastBucket: { phase: 'sky', debris: 38 } }, 'a'), 'CLEAR THE SKY · 23 UP');
  assert.equal(line({ phase: 'shift', players: [], lastBucket: { phase: 'sky', debris: 15 } }, 'a'), 'CLEAR THE SKY · 0 UP');
});

// Council round 11 8.3 (builder 4): the carry banner fits 800 px at 1–6 Rats: one name plus a count, never a list.
test('8.3: the carry banner is one name plus a count at 1–6 Rats (≤ 46 characters with long names), solo is the goal', async () => {
  const { lastBucketLine: line, LB_NAME } = await import('../web/js/huddlerules.js');
  const plain = s => s.replace(/<[^>]+>/g, '').replace(/&#\d+;/g, 'x');
  for (let n = 1; n <= 6; n++) {
    const players = Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'Bartholomew The ' + i, online: true, one: i === 0, x: i === 0 ? SIM.STAND.x : 60, z: i === 0 ? SIM.STAND.z : 6 }));
    const l = plain(line({ phase: 'shift', players, lastBucket: { phase: 'carried' } }, 'p0'));
    if (n === 1) { assert.equal(l, 'BALL NO. 1 → THE RETURN'); continue; }
    assert.ok(l.length <= 46, `${n} Rats: ${l} (${l.length})`);
    assert.equal(l, `BALL NO. 1 · HOME · 1/${n} · WAITING: ${'BARTHOLOMEW THE 1'.slice(0, LB_NAME - 1)}…${n > 2 ? ' +' + (n - 2) : ''}`);
  }
  const me = [{ id: 'a', name: 'A', online: true, one: true, x: SIM.STAND.x, z: SIM.STAND.z }, { id: 'b', name: 'Bo', online: true, x: 60, z: 6 }, { id: 'c', name: 'Cy', online: true, x: 60, z: 9 }];
  assert.equal(line({ phase: 'shift', players: me, lastBucket: { phase: 'carried' } }, 'c'), 'BALL NO. 1 · HOME · <b>1/3</b> · WAITING: YOU +1', 'you first');
  assert.equal(line({ phase: 'shift', players: me.map(p => ({ ...p, x: SIM.STAND.x, z: SIM.STAND.z })), lastBucket: { phase: 'carried' } }, 'c'), 'BALL NO. 1 · HOME · <b>3/3</b>');
});

// Council round 11 8.5 (builder 4): the basket line stands down at the climax and during the boss.
test('8.5: the morning deal stands down while Ball No. 1 is down, carried or in the huddle, and while the boss is live', async () => {
  const { standDown } = await import('../web/js/morning.js');
  for (const phase of ['down', 'carried', 'huddle']) assert.equal(standDown({ lastBucket: { phase } }), true, phase);
  for (const phase of ['sky', 'done']) assert.equal(standDown({ lastBucket: { phase } }), false, phase);
  assert.equal(standDown({}), false);
  for (const phase of ['warn', 'harvest', 'hunt', 'plug']) assert.equal(standDown({ mower: { kind: 'boss', phase } }), true, phase);
  assert.equal(standDown({ mower: { kind: 'boss', phase: 'tamed' } }), false);
  // The server: a crew with the basket short at the Last Bucket's carry deals nothing, and its snapshot has no line.
  const { Crew } = await import('../server/crew.mjs');
  const crew = new Crew('SD85', { venue: 5, day: 20, venueDay: 2 }, { seed: 3, now: () => 1e6 });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  const nudge = () => crew.snapshot().mods?.nudge;
  assert.ok(Object.values(nudge() ?? {}).some(v => String(v).startsWith('am:')), 'a morning line on an ordinary morning');
  crew.lastBucket = { phase: 'carried' };
  assert.equal(nudge(), undefined, 'none while Ball No. 1 is carried');
});
