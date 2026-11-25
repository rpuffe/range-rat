import test from 'node:test';
import assert from 'node:assert/strict';
import * as SFX from '../web/js/sfx.js';
import * as AMB from '../web/js/ambience.js';
import { createPA } from '../web/js/pa.js';

test('dbToGain: -9 dB duck, +3 dB horn', () => {
  assert.equal(SFX.dbToGain(0), 1);
  assert.ok(Math.abs(SFX.dbToGain(SFX.DUCK_DB) - 0.3548) < 1e-3);
  assert.ok(Math.abs(SFX.dbToGain(SFX.HORN_DB) - 1.4125) < 1e-3);
  assert.equal(SFX.dbToGain('x'), 1);
});

test('drone voices are capped at 3', () => {
  assert.equal(SFX.MAX_DRONE_VOICES, 3);
  assert.deepEqual([0, 1, 2, 3, 4, 9, -1, NaN].map(SFX.droneVoices), [0, 1, 2, 3, 3, 3, 0, 0]);
});

test('audio entry points are silent no-ops before unlock', () => {
  assert.doesNotThrow(() => { SFX.glint(0.5); SFX.horn('gary'); SFX.horn('mower'); SFX.droneBuzz(5); SFX.droneBuzz(0); SFX.duck(true); SFX.duck(false); SFX.setUnderwater(true); SFX.setUnderwater(false); });
  assert.equal(SFX.audioHandle(), null);
  assert.doesNotThrow(() => AMB.setAmbience({ underwater: true }));
});

test('PA ducks while it speaks and restores after', async () => {
  const calls = [];
  const pa = createPA({ audio: () => ({ duck: (on) => calls.push(on) }) });
  pa.say('welcome');
  assert.deepEqual(calls, [true]);
  pa.stop();
  assert.deepEqual(calls, [true, false]);
});

// Owner playtest 3 §7.4: the cart's engine is a low motor, not a whine.
test('the cart engine: ≤ 160 Hz and a filter ≤ 900 Hz at top speed, glide 0.25 s, gain 0.012 + 0.028 × speed', () => {
  const top = SFX.engineParams(1), idle = SFX.engineParams(0.05);
  assert.ok(top.freq <= 160 && top.lowpass <= 900, JSON.stringify(top));
  assert.ok(idle.freq >= 70 && idle.lowpass >= 400);
  assert.equal(SFX.engineParams(3).freq, top.freq, 'clamped: turbo never raises the pitch');
  assert.ok(Math.abs(top.gain - 0.04) < 1e-9);
  assert.equal(SFX.engineParams(0).gain, 0);
  assert.equal(SFX.ENGINE.GLIDE, 0.25);
  assert.ok(top.trem === 28 && SFX.engineParams(0).trem === 12);
  const k = SFX.tanhCurve();
  assert.ok(Math.abs(k[0] + 1) < 1e-6 && Math.abs(k[k.length - 1] - 1) < 1e-6, 'normalised tanh');
  assert.doesNotThrow(() => { const e = SFX.cartEngine(); e.set(1); e.stop(); });
});
