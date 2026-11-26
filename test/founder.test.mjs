// Council round 11 #7: the founder, drawn once (web/js/founder.js): the 1958 photo and the jumbotron's newsreel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawFounder, drawNewsreel, PHOTO, NEWSREEL } from '../web/js/founder.js';

// A 2D context stub: every method is a no-op that counts its calls; every property can be set.
function stubCtx() {
  const calls = {};
  const grad = { addColorStop() {} };
  const target = { calls, createRadialGradient: () => grad, createLinearGradient: () => grad, measureText: () => ({ width: 10 }) };
  return new Proxy(target, {
    get(o, k) {
      if (k in o) return o[k];
      return (...a) => { calls[k] = (calls[k] ?? 0) + 1; for (const v of a) assert.ok(Number.isFinite(v) || typeof v !== 'number', `${String(k)}: a non-finite argument`); };
    },
    set(o, k, v) { o[k] = v; return true; },
  });
}

test('drawFounder draws to a stub context without throwing at t 0, 0.5 and 1 (sepia, circled, plain)', () => {
  for (const t of [0, 0.5, 1]) for (const opts of [{}, { circle: true }, { sepia: false, grain: false }]) {
    const g = stubCtx();
    drawFounder(g, PHOTO.W, PHOTO.H, t, opts);
    assert.ok(g.calls.fillRect > 0 && g.calls.stroke > 0, 'it drew something');
  }
  assert.deepEqual([PHOTO.W, PHOTO.H], [160, 100]);
  drawFounder(null, 10, 10, 0.5);   // no context: nothing, no throw
});

test('the circled photo adds the red pencil; a junk t is clamped', () => {
  const plain = stubCtx(), circled = stubCtx();
  drawFounder(plain, 160, 100, 1, { grain: false });
  drawFounder(circled, 160, 100, 1, { grain: false, circle: true });
  assert.ok(circled.calls.ellipse > plain.calls.ellipse, 'one more ellipse: the circle');
  drawFounder(stubCtx(), 160, 100, NaN); drawFounder(stubCtx(), 160, 100, 9);
});

test('drawNewsreel runs 12 s: the leader, the swing, the pan into an empty sky', () => {
  assert.equal(NEWSREEL.SECS, 12);
  assert.ok(NEWSREEL.LEADER < NEWSREEL.SWING && NEWSREEL.SWING < NEWSREEL.PAN && NEWSREEL.PAN < NEWSREEL.SECS);
  for (const t of [0, 0.7, 1.6, 4, 6.4, 8, 10.6, 11.9, 12, 30]) {
    const g = stubCtx();
    drawNewsreel(g, 1024, 512, t);
    assert.ok(g.calls.fillRect > 0, `t ${t}`);
  }
});
