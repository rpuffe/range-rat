// Council round 13 #6 (builder 3): spawns that look at the venue, not a roof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { clockInSpot, CLOCK_IN } from '../web/js/sim.js';
import { WHISTLE } from '../web/js/mowe.js';
import { SPAWN_PITCH } from '../web/js/spawnlook.js';

test('the Club and Tiered clock in outside the awning and the deck, clear of the washer handles and the MOW-E post', () => {
  assert.equal(CLOCK_IN.LATE_FROM, 1);
  for (const v of [1, 2]) for (let k = 0; k < 6; k++) {
    const c = clockInSpot(v, k);
    assert.ok(c.x > 23.5 + 0.5, `venue ${v} slot ${k}: x ${c.x} is past the awning's end (x 23.5)`);
    assert.ok(!(c.x > -20.5 && c.x < 20.5 && c.z > 1.5 && c.z < 6.5), `venue ${v} slot ${k}: not under the deck`);
    assert.ok(!(c.x > 25.9 && c.x < 29.1), `slot ${k}: off the washer and its handles`);
    assert.ok(Math.hypot(c.x - WHISTLE.POST.x, c.z - WHISTLE.POST.z) > WHISTLE.R, `slot ${k}: outside the MOW-E post's reach`);
  }
  assert.deepEqual(clockInSpot(0, 0), { x: CLOCK_IN.X, z: CLOCK_IN.Z }, 'the Muni row is unchanged');
});

test('the spawn pitch eases from −0.2 to −0.28 over 1.5 s at venues ≥ 1, and never at the Muni', () => {
  assert.equal(SPAWN_PITCH.pitchAt(0, 0), null);
  assert.equal(SPAWN_PITCH.pitchAt(1, 0), -0.2);
  assert.ok(Math.abs(SPAWN_PITCH.pitchAt(1, 0.75) - -0.24) < 0.01);
  assert.equal(SPAWN_PITCH.pitchAt(3, 1.5), -0.28);
  assert.equal(SPAWN_PITCH.pitchAt(3, 2), null, 'after the ease the player has the stick');
});
