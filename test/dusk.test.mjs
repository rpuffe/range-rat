// End of the day: the walk-off (dusk.js). The camera path, the "left out there" count, the hold and skip timing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUSK, easeInOut, camPath, duskPlan, holdEnd, duskStage, leftOut, leftLine, glowBudget, walkRoute, walkAt, padEdge } from '../web/js/dusk.js';
import { detailFor } from '../web/js/detail.js';
import { profileFor } from '../web/js/perf.js';

test('the ease is smooth at both ends and monotonic', () => {
  assert.equal(easeInOut(0), 0); assert.equal(easeInOut(1), 1); assert.equal(easeInOut(0.5), 0.5);
  assert.equal(easeInOut(-1), 0); assert.equal(easeInOut(2), 1);
  assert.ok(easeInOut(0.01) < 0.001 && 1 - easeInOut(0.99) < 0.001);   // no snap at either end
  let prev = 0;
  for (let i = 1; i <= 100; i++) { const v = easeInOut(i / 100); assert.ok(v >= prev); prev = v; }
});

test('the camera lifts from the eye to a high view of the field in ~3 s, then holds', () => {
  const from = { x: 20, y: 1.65, z: 4 };
  const a = camPath(0, from);
  assert.deepEqual([a.x, a.y, a.z, a.w], [20, 1.65, 4, 0]);
  const end = camPath(DUSK.CAM_SECS, from);
  assert.deepEqual([end.x, end.y, end.z, end.w], [DUSK.END.x, DUSK.END.y, DUSK.END.z, 1]);
  assert.ok(DUSK.END.y >= 90 && DUSK.END.y <= 120);
  assert.ok(DUSK.CAM_SECS >= 2.5 && DUSK.CAM_SECS <= 3.5);
  assert.deepEqual(camPath(10, from), end);
  const mid = camPath(DUSK.CAM_SECS / 2, from);
  assert.ok(mid.y > from.y + (DUSK.END.y - from.y) / 2, 'the height leads: clear of the nets before it travels');
  // no frame jumps more than a few metres at 60 fps
  let p = camPath(0, from);
  for (let t = 1 / 60; t <= DUSK.CAM_SECS + 0.01; t += 1 / 60) {
    const q = camPath(t, from);
    assert.ok(Math.hypot(q.x - p.x, q.y - p.y, q.z - p.z) < 2.5); p = q;
  }
});

test('left out there: every ball still on the field, not the picked, the sunk or Ball No. 1', () => {
  const balls = new Map([
    [1, { x: 0, z: -40 }], [2, { x: 1, z: -50, rest: true }], [3, { hidden: true }], [4, { sunk: true }],
    [5, { kind: 'one' }], [6, { kind: 'gold' }], [7, { drifting: true }],
  ]);
  assert.equal(leftOut(balls), 4);
  assert.equal(leftOut([]), 0);
  assert.equal(leftLine(142), '142 left out there');
  assert.equal(leftLine(1), '1 ball left out there');
  assert.equal(leftLine(0), 'Not a ball left out there');
  for (const n of [0, 1, 142, 1500]) assert.ok(leftLine(n).split(/\s+/).length <= 8);
});

test('the plan: runs after a normal bell and in endless; not the ending, not a rejoin; Reduce Motion is calm', () => {
  assert.deepEqual(duskPlan({}), { run: true, cam: true, secs: DUSK.SECS });
  assert.equal(duskPlan({ ending: true }).run, false);
  assert.equal(duskPlan({ rejoin: true }).run, false);
  const calm = duskPlan({ reduceMotion: true });
  assert.equal(calm.run, true); assert.equal(calm.cam, false); assert.ok(calm.secs < DUSK.SECS);
  assert.ok(DUSK.SECS >= 5 && DUSK.SECS <= 6);
});

test('the hold: the card waits for the stamp, then the beat; a skipped plan keeps the stamp hold', () => {
  const now = 10000, stamp = now + 2000, plan = duskPlan({});
  assert.equal(holdEnd(now, stamp, plan), stamp + DUSK.SECS * 1000);   // a review day: the stamp's 2 s, then 5.5 s
  assert.equal(holdEnd(now, 0, plan), now + DUSK.SECS * 1000);          // endless: no stamp, straight in
  assert.equal(holdEnd(now, now - 50000, plan), now + DUSK.SECS * 1000);   // yesterday's stale stamp doesn't count
  assert.equal(holdEnd(now, stamp, duskPlan({ ending: true })), stamp);
  assert.equal(holdEnd(now, stamp, duskPlan({ reduceMotion: true })), stamp + DUSK.CALM_SECS * 1000);
});

test('the stages: the camera, then the walk, the glow, the count, done; a skip lands on done', () => {
  const plan = duskPlan({});
  const s0 = duskStage(0, plan);
  assert.equal(s0.cam, 0); assert.equal(s0.walk, false); assert.equal(s0.glow, 0); assert.equal(s0.label, false); assert.equal(s0.done, false);
  const s2 = duskStage(2, plan);
  assert.ok(s2.walk && s2.meWalk && s2.label && s2.glow > 0.9 && !s2.done);
  assert.equal(duskStage(DUSK.SECS, plan).done, true);
  assert.equal(duskStage(DUSK.SECS - 0.01, plan).done, false);
  assert.ok(DUSK.ME_WALK_AT > DUSK.WALK_AT, 'your own body stands while the camera leaves it');
  const calm = duskPlan({ reduceMotion: true }), c = duskStage(1, calm);
  assert.equal(c.cam, 0); assert.equal(c.meWalk, false); assert.ok(c.dim > 0 && c.label);
  assert.equal(duskStage(calm.secs, calm).done, true);
});

test('the glow follows the perf tier: one Points either way, fewer and still on Low (Xbox)', () => {
  const lo = glowBudget(detailFor(profileFor('low'))), hi = glowBudget(detailFor(profileFor('high')));
  assert.equal(lo.pulse, false); assert.equal(hi.pulse, true);
  assert.ok(lo.max < hi.max && lo.max >= 300);
});

test('the walk-off: along the stand to the gate, up the path, into the lot', () => {
  const r = walkRoute({ x: 26, z: 4 });
  assert.deepEqual(r[0], [26, 4]);
  assert.ok(r.some(([x, z]) => x === -3 && z === 9.5), 'through the gate');
  const last = r[r.length - 1];
  assert.ok(Math.abs(last[0] - DUSK.LOT.x) <= 4 && Math.abs(last[1] - DUSK.LOT.z) <= 3);
  const a = walkAt(r, 0);
  assert.deepEqual([a.x, a.z, a.done], [26, 4, false]);
  assert.ok(Math.abs(a.yaw - Math.PI / 2) < 0.1, 'facing -x: west along the stand');   // atan2(-dx, -dz) with dx < 0
  const b = walkAt(r, 5);
  assert.ok(b.x < 26 && !b.done);
  assert.equal(walkAt(r, 1e4).done, true);
  // two walkers don't share a parking spot
  const ends = new Set([0, 1, 2, 3].map(n => walkRoute({ x: 0, z: 0 }, n).at(-1).join()));
  assert.equal(ends.size, 4);
});

test('a pad skip needs a fresh press', () => {
  assert.equal(padEdge([true, false], [true, false]), false);   // held from before the beat
  assert.equal(padEdge([true, false], [true, true]), true);
  assert.equal(padEdge([], [false]), false);
});
