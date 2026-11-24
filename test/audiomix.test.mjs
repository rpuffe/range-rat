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
