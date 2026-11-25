// Council round 10 §B/§C: dirt you can see on the sign and the return (web/js/mud.js's surface variant), and the field
// ball returns' places (web/js/layout.js). Pure: no three.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUD, SURF, mudField, mudSurface, surfaceAlpha, surfaceThreshold, fieldAt, paintClean } from '../web/js/mud.js';

test('mudSurface: a w x h quad maps onto the field at the mats\' texel size, each seed its own patch', () => {
  const s = mudSurface(3.2, 1.6, 0);
  assert.equal(s.su, 2); assert.equal(s.sv, 1);
  assert.deepEqual(s.uv(0, 0), [0, 0]);
  assert.deepEqual(s.uv(1, 1), [2, 1], 'a 3.2 m sign spans two mat widths of the field');
  const m = mudSurface(MUD.SIZE, MUD.SIZE);
  assert.deepEqual(m.uv(0.5, 0.5), [0.5, 0.5], 'a mat-sized quad is the mat');
  const a = mudSurface(3.2, 1.6, 1), b = mudSurface(3.2, 1.6, 2);
  assert.notDeepEqual(a.uv(0, 0), b.uv(0, 0), 'the two sign faces read different patches');
  assert.ok(a.ou >= 0 && a.ou < 1 && a.ov >= 0 && a.ov < 1);
  assert.equal(s.reach, 0.5, 'the jet stays the same size in metres on a bigger surface');
});

test('a surface is spotless at the server\'s CLEAN line, and muddier low down', () => {
  for (const noise of [0, 0.3, 1]) for (const v of [0, 0.5, 1]) {
    assert.ok(surfaceThreshold(noise, 0, v) >= MUD.CLEAN + MUD.EDGE - 1e-9);
    assert.equal(surfaceAlpha(1, noise, 0, MUD.CLEAN, v), 0, 'CLEAN shows nothing');
  }
  assert.ok(surfaceThreshold(0.6, 0, 0) < surfaceThreshold(0.6, 0, 1), 'the bottom edge washes last');
  assert.ok(surfaceThreshold(0.6, 0, 1) - surfaceThreshold(0.6, 0, 0) <= SURF.LOW + 1e-9);
  assert.ok(surfaceThreshold(0.4, 1, 0.5) > surfaceThreshold(0.4, 0, 0.5), 'my spray streaks wash off first');
});

test('the sign washes in patches: the muddy share falls step by step, not all at once', () => {
  const F = mudField(64, 7), s = mudSurface(3.2, 1.6, 1), N = 40;
  const share = mud => {
    let shown = 0, total = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const u = (i + 0.5) / N, v = (j + 0.5) / N, [fu, fv] = s.uv(u, v), t = fieldAt(F, fu, fv);
      shown += surfaceAlpha(t.density, t.noise, 0, mud, v); total += 1;
    }
    return shown / total;
  };
  const levels = [1, 0.8, 0.6, 0.4, 0.2, 0.1, MUD.CLEAN].map(share);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] <= levels[i - 1] + 1e-9, `monotone: ${levels.map(x => x.toFixed(2))}`);
  assert.ok(levels[0] > 0.6, `filthy reads filthy (${levels[0].toFixed(2)})`);
  assert.equal(levels.at(-1), 0, 'spotless at CLEAN');
  const mid = share(0.4);
  assert.ok(mid > 0.05 && mid < levels[0] * 0.8, `half-washed is patchy (${mid.toFixed(2)})`);
});

test('paintClean: reach scales the streak in the memory', () => {
  const a = new Float32Array(32 * 32), b = new Float32Array(32 * 32);
  paintClean(a, 32, 0.5, 0.5, 1, 0, 0.5, 1); paintClean(b, 32, 0.5, 0.5, 1, 0, 0.5, 0.5);
  const lit = m => m.filter(v => v > 0).length;
  assert.ok(lit(b) < lit(a) && lit(b) > 0);
});
