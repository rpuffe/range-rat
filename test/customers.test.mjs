import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CUST, bucketFor, GATE, ENTRANCE_PATH, arriveRoute, arriveDur, leaveDur, custPos, newMat, stepMat, matReady, shoot, openShift, matWire } from '../web/js/customers.js';
import { MATS, mulberry32 } from '../web/js/sim.js';

const run = (mat, from, to, ctx, step = 0.25) => {
  const ev = [];
  for (let t = from; t <= to + 1e-9; t += step) ev.push(...stepMat(mat, step, { ...ctx, now: t }));
  return ev;
};
const ctxOf = (o = {}) => ({ rng: mulberry32(7), venue: 0, mud: 0, ...o });

test('constants match the spec', () => {
  assert.equal(CUST.WALK, 1.3); assert.equal(CUST.BUCKET, 30); assert.equal(CUST.BUCKET_CLUB, 50);
  assert.equal(CUST.REFUSE_MUD, 0.9); assert.equal(CUST.SULK, 2); assert.equal(CUST.EMPTY_AFTER_REFUSE, 30);
  assert.equal(bucketFor(0), 30); assert.equal(bucketFor(1), 50); assert.equal(bucketFor(5), 50);
});

test('the route copy matches ENTRANCE in scenery.js', () => {
  const src = readFileSync(new URL('../web/js/scenery.js', import.meta.url), 'utf8');
  const path = JSON.parse(/path:\s*(\[\[[\d\s.,\[\]-]*\]\])/.exec(src)[1]);
  assert.deepEqual(path, ENTRANCE_PATH);
  const g = /gate:\s*\{\s*x:\s*(-?[\d.]+),\s*z:\s*(-?[\d.]+)/.exec(src);
  assert.deepEqual({ x: +g[1], z: +g[2] }, GATE);
});

test('custPos is pure and starts at the gate, grabs a bucket, ends at the mat', () => {
  for (const i of [0, 5, 9]) {
    const c = { mat: i, st: 'arrive', t0: 100 };
    assert.deepEqual(custPos(c, 123.4), custPos(c, 123.4));
    const a = custPos(c, 100), r = arriveRoute(i);
    assert.deepEqual([a.x, a.z, a.carry, a.act], [GATE.x, GATE.z, false, 'walk']);
    const g = custPos(c, 100 + r.tA + 0.1);
    assert.equal(g.act, 'grab'); assert.equal(g.carry, false);
    assert.equal(custPos(c, 100 + r.tA + CUST.GRAB - 0.1).carry, true);
    const end = custPos(c, 100 + arriveDur(i) + 5);
    assert.ok(Math.abs(end.x - (MATS[i].x - CUST.PLAY_DX)) < 1e-9 && Math.abs(end.z - -0.4) < 1e-9);
    assert.equal(end.carry, true);
  }
});

test('walking speed is 1.3 m/s and positions are continuous', () => {
  const c = { mat: 3, st: 'arrive', t0: 0 }, dur = arriveDur(3);
  let prev = custPos(c, 0), walked = 0;
  for (let t = 0.05; t < dur; t += 0.05) {
    const p = custPos(c, t), d = Math.hypot(p.x - prev.x, p.z - prev.z);
    assert.ok(d <= CUST.WALK * 0.05 + 1e-6, `jump at ${t}: ${d}`);
    walked += d; prev = p;
  }
  const r = arriveRoute(3);
  assert.ok(Math.abs(walked - (r.tA + r.tB) * CUST.WALK) < 0.2);
  assert.ok(dur > 20 && dur < 80, `arrival ${dur}s`);
});

test('a held arrival waits at the walkway, not on the mat', () => {
  const c = { mat: 2, st: 'arrive', t0: 0, hold: true };
  const p = custPos(c, 500);
  assert.equal(p.act, 'wait'); assert.ok(Math.abs(p.z - 2.2) < 1e-9); assert.equal(p.carry, true);
});

test('playing, sulking and leaving positions', () => {
  const sx = MATS[4].x - CUST.PLAY_DX;
  assert.equal(custPos({ mat: 4, st: 'playing', t0: 10 }, 10.5).act, 'set');
  assert.equal(custPos({ mat: 4, st: 'playing', t0: 10 }, 20).act, 'play');
  assert.equal(custPos({ mat: 4, st: 'sulk', t0: 10 }, 11).act, 'sulk');
  const L = { mat: 4, st: 'leave', t0: 10 };
  const s = custPos(L, 10); assert.equal(s.x, sx); assert.equal(s.z, -0.4);
  assert.equal(custPos(L, 10 + leaveDur(4) - 1).done, false);
  const e = custPos(L, 10 + leaveDur(4) + 1);
  assert.equal(e.done, true); assert.deepEqual([e.x, e.z], [-3, 20]);
});

test('early birds take every open mat at opening, with staggered buckets', () => {
  const mats = MATS.map(m => newMat(m.i));
  const ev = openShift(mats, { now: 50, rng: mulberry32(3), venue: 0, nOpen: 6 });
  assert.equal(mats.filter(m => m.st === 'playing').length, 6);
  assert.equal(mats.filter(m => m.st === 'empty').length, 4);
  assert.equal(ev.filter(e => e.t === 'start').length, 6);
  assert.equal(new Set(mats.slice(0, 6).map(m => m.balls)).size > 2, true, 'staggered');
  for (const m of mats.slice(0, 6)) { assert.ok(m.balls >= 1 && m.balls <= 30); assert.ok(matReady(m, 50), 'no setup wait'); }
  assert.equal(new Set(mats.slice(0, 6).map(m => m.cust)).size, 6);
});

test('a bucket is 30 balls at the Muni and 50 at the Club', () => {
  for (const [venue, n] of [[0, 30], [1, 50]]) {
    const m = newMat(1), ctx = ctxOf({ venue });
    const ev = run(m, 0, arriveDur(1) + 1, ctx);
    assert.ok(ev.some(e => e.t === 'arrive'));
    const start = ev.find(e => e.t === 'start');
    assert.equal(start.balls, n); assert.equal(m.balls, n); assert.equal(m.st, 'playing');
  }
});

test('ball budget: shoot() spends the bucket, then they leave and the next one is walking in', () => {
  const m = newMat(0), ctx = ctxOf({ gap: 8 });
  let now = 0;
  const ev = [];
  const step = to => { for (; now < to; now += 0.25) ev.push(...stepMat(m, 0.25, { ...ctx, now })); };
  step(arriveDur(0) + 3);
  assert.equal(m.st, 'playing');
  assert.equal(matReady(m, now), true);
  let shots = 0;
  while (m.balls > 0) { assert.ok(matReady(m, now)); ev.push(...shoot(m, now)); shots++; now += 0.1; }
  assert.equal(shots, 30);
  assert.equal(matReady(m, now), false, 'no more balls, swing finishing');
  assert.deepEqual(shoot(m, now), []);
  step(now + CUST.FINISH + 0.5);
  assert.equal(m.st, 'leave');
  assert.equal(ev.filter(e => e.t === 'leave' && e.why === 'done').length, 1);
  assert.ok(m.inc, 'the replacement is already walking in');
});

test('the next customer is timed to arrive as the bucket runs dry (no idle mat, no queue)', () => {
  const m = newMat(5), ctx = ctxOf({ gap: 8 });
  openShift([m], { now: 0, rng: mulberry32(1), nOpen: 1 });
  let nextShot = 8, idle = 0, arrivals = 0;
  for (let now = 0; now < 900; now += 0.25) {
    const ev = stepMat(m, 0.25, { ...ctx, now });
    arrivals += ev.filter(e => e.t === 'arrive').length;
    if (m.st !== 'playing') idle += 0.25;
    if (now >= nextShot && matReady(m, now)) { shoot(m, now); nextShot = now + 8; }
  }
  assert.ok(arrivals >= 3, `arrivals ${arrivals}`);
  assert.ok(idle < 900 * 0.1, `idle ${idle}s of 900`);
});

test('a filthy mat is refused: sulk 2 s, leave, empty for 30 s, then fine once cleaned', () => {
  const m = newMat(2), ev = [];
  let mud = 0.95, now = 0;
  const tick = to => { for (; now < to; now += 0.25) ev.push(...stepMat(m, 0.25, { ...ctxOf(), mud, now })); };
  tick(arriveDur(2) + 0.5);
  const refuse = ev.find(e => e.t === 'refuse');
  assert.ok(refuse && refuse.mud === 0.95 && m.st === 'sulk');
  const tr = m.t0;
  assert.equal(m.balls, 0); assert.equal(matReady(m, now), false);
  tick(tr + CUST.SULK + 0.5);
  assert.equal(m.st, 'leave');
  assert.ok(ev.some(e => e.t === 'leave' && e.why === 'refused'));
  // nobody arrives at the mat until 30 s after the refusal
  tick(tr + CUST.EMPTY_AFTER_REFUSE - 1);
  assert.equal(m.st === 'playing' || m.st === 'sulk', false);
  assert.equal(matReady(m, now), false, 'no balls from a refused mat');
  mud = 0;                                        // someone hosed it down
  tick(tr + CUST.EMPTY_AFTER_REFUSE + arriveDur(2) + 2);
  assert.equal(m.st, 'playing');
  assert.ok(m.t0 >= tr + CUST.EMPTY_AFTER_REFUSE - 1e-6, 'arrived no sooner than 30 s after the refusal');
});

test('mud just under the threshold is accepted, at the threshold refused', () => {
  for (const [mud, st] of [[0.89, 'playing'], [0.9, 'sulk']]) {
    const m = newMat(0); run(m, 0, arriveDur(0) + 0.5, ctxOf({ mud }));
    assert.equal(m.st, st);
  }
});

test('an arrival waits at the walkway while the mat is still taken', () => {
  const m = newMat(0);
  openShift([m], { now: 0, rng: mulberry32(2), nOpen: 1 });
  m.balls = 50; m.inc = { cust: 99, look: 5, t0: 0 };
  run(m, 0, 200, ctxOf({ gap: 8 }));          // never shoots
  assert.equal(m.st, 'playing'); assert.equal(m.cust !== 99, true); assert.equal(m.inc.cust, 99);
});

test('closing a mat sends the customer out and cancels the walker', () => {
  const m = newMat(3); run(m, 0, arriveDur(3) + 1, ctxOf());
  assert.equal(m.st, 'playing');
  const ev = run(m, 100, 100.5, ctxOf({ open: false }));
  assert.equal(m.st, 'leave'); assert.equal(m.inc, null);
  assert.ok(ev.some(e => e.t === 'leave' && e.why === 'closed'));
  assert.equal(matReady(m, 101), false);
  run(m, 101, 130, ctxOf({ open: false }));
  assert.equal(m.st, 'empty'); assert.equal(m.inc, null);
});

test('deterministic: same rng and times give the same wire state', () => {
  const play = () => {
    const m = newMat(6); const rng = mulberry32(11); let n = 0;
    run(m, 0, 400, { rng, venue: 1, mud: 0, gap: 8, nextCust: () => ++n });
    return JSON.stringify(matWire(m));
  };
  assert.equal(play(), play());
});

test('wire state carries cust/st/t0/look only, never positions', () => {
  const m = newMat(1); run(m, 0, 10, ctxOf());
  const w = matWire(m);
  assert.deepEqual(Object.keys(w).sort(), ['cust', 'inc', 'left', 'look', 'st', 't0']);
  assert.ok(m.inc && Object.keys(w.inc).sort().join() === 'cust,look,t0');
});

test('stepMat without ctx.now accumulates dt', () => {
  const m = newMat(0);
  for (let i = 0; i < 400; i++) stepMat(m, 0.25, { rng: mulberry32(1) });
  assert.equal(m.clock, 100);
  assert.equal(m.st, 'playing');
});
