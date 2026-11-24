// Station props (props.js): the pure numbers in detail.js. No three, no DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailFor, emit, wetStep, WET, sagPoints, rollAngle, gaugeAngle, GAUGE, ease, throttle, rng, lightBalance } from '../web/js/detail.js';
import { profileFor } from '../web/js/perf.js';

test('Low (and Xbox Auto) spends nothing new per frame; High buys the extras', () => {
  const lo = detailFor(profileFor('low')), hi = detailFor(profileFor('high'));
  assert.equal(lo.standard, false); assert.equal(lo.mist, 0); assert.equal(lo.hoseSegs, 0); assert.equal(lo.clippings, 0);
  assert.equal(lo.wetSheen, false); assert.equal(lo.rings, false); assert.equal(lo.shadowRadius, 1); assert.equal(lo.animHz, 20);
  assert.ok(hi.standard && hi.wetSheen && hi.rings && hi.hi);
  assert.ok(hi.mist > 0 && hi.hoseSegs > 0 && hi.clippings > 0 && hi.animHz === 0);
  for (const k of ['mist', 'bubbles', 'steam', 'clippings', 'hoseSegs', 'clouds']) assert.ok(lo[k] <= hi[k], k);
});

test('Auto steps on High peel the extras off', () => {
  const s0 = detailFor(profileFor('high', 0)), s1 = detailFor(profileFor('high', 1)), s2 = detailFor(profileFor('high', 2));
  assert.ok(s1.mist < s0.mist && s1.bubbles < s0.bubbles);
  assert.equal(s0.hi, true); assert.equal(s2.hi, false);
  assert.deepEqual(detailFor(), detailFor(profileFor('high')));   // a missing profile is safe (High)
});

test('emit carries the fractional remainder so slow rates still fire', () => {
  let carry = 0, total = 0;
  for (let i = 0; i < 61; i++) { const e = emit(2, 1 / 60, carry); carry = e.carry; total += e.n; }   // a second (and a frame for float slop)
  assert.equal(total, 2);
  assert.deepEqual(emit(-5, 1, 0), { n: 0, carry: 0 });
  assert.equal(emit(10, 0.25, 0.6).n, 3);
});

test('wetness rises while sprayed, dries in about four seconds, stays in 0..1', () => {
  let w = 0;
  for (let i = 0; i < 30; i++) w = wetStep(w, true, 1 / 60);
  assert.ok(w > 0.9);
  w = wetStep(w, true, 1); assert.equal(w, 1);
  let t = 0; while (w > 0) { w = wetStep(w, false, 0.1); t += 0.1; }
  assert.ok(Math.abs(t - 1 / WET.DRY) < 0.15);
  assert.equal(wetStep(0, false, 5), 0);
});

test('a hanging hose sags in the middle, ends at its ends, and never goes underground', () => {
  const p = sagPoints([0, 0.5, 0], [4, 1.2, 0], 8, 0.6);
  assert.equal(p.length, 9);
  assert.deepEqual(p[0], [0, 0.5, 0]); assert.deepEqual(p[8], [4, 1.2, 0]);
  assert.ok(p[4][1] < (0.5 + 1.2) / 2);
  for (const q of sagPoints([0, 0.1, 0], [9, 0.1, 0], 10, 2)) assert.ok(q[1] >= 0.03);
});

test('rolling, gauge, easing, throttle, rng', () => {
  assert.equal(rollAngle(Math.PI * 0.6, 0.3), Math.PI * 2);
  assert.equal(rollAngle(1, 0), 0);
  assert.equal(gaugeAngle(0), GAUGE.REST);
  assert.ok(Math.abs(gaugeAngle(1, 0) - (GAUGE.REST + GAUGE.SWEEP * 0.75)) < 1e-9);
  assert.ok(gaugeAngle(2) <= GAUGE.REST + GAUGE.SWEEP * 0.75 + 0.05);
  assert.ok(Math.abs(ease(0, 1, 5, 10) - 1) < 1e-6);
  assert.equal(ease(3, 3, 5, 0.1), 3);
  assert.deepEqual(throttle(0, 0.016, 0), { run: true, acc: 0, dt: 0.016 });
  const a = throttle(0, 0.02, 20); assert.equal(a.run, false);
  const b = throttle(a.acc, 0.04, 20); assert.equal(b.run, true); assert.ok(Math.abs(b.dt - 0.06) < 1e-9);
  const r1 = rng(5), r2 = rng(5);
  for (let i = 0; i < 20; i++) { const v = r1(); assert.equal(v, r2()); assert.ok(v >= 0 && v < 1); }
});

test('the light balance adds sun, trims flat fill, and warms toward sunset', () => {
  const L = { sunI: 3, hemi: 1 };
  const am = lightBalance(L, 0), pm = lightBalance(L, 1);
  assert.ok(am.sunI > L.sunI && am.hemiI < L.hemi);
  assert.ok(pm.warm > am.warm && pm.sunI > am.sunI);
  assert.ok(pm.hemiI > 0.7 * L.hemi);
});
