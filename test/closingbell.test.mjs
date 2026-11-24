// The Closing Bell, client half (council round 6, #3): the Board's crossing flash, the gauge's pass tick, the stamp,
// and the bell / trombone sounds. The rally line's rules are builder A's (test/rally.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BELL, crossing, gaugeRed, gaugePass, stampFor } from '../web/js/closingbell.js';
import * as SFX from '../web/js/sfx.js';

test('crossing: green over the target, amber back under, at most one flash every 3 s', () => {
  const s = { above: null, at: -Infinity };
  const at = (bv, t, quota = 100) => crossing(s, { bv, quota, live: true, t });
  assert.equal(at(80, 0), null, 'the first reading only sets the side');
  assert.equal(at(101, 1), 'up');
  assert.equal(at(99, 2), null, 'drift back under within 3 s: no strobe');
  assert.equal(at(102, 2.5), null);
  assert.equal(at(98, 4.1), 'down', '3 s on: amber');
  assert.equal(at(98, 9), null, 'no change, no flash');
  assert.equal(at(120, 9.5), 'up');
});

test('crossing: no shift or no target forgets the side, so a new morning never flashes', () => {
  const s = { above: null, at: -Infinity };
  crossing(s, { bv: 150, quota: 100, live: true, t: 0 });
  assert.equal(crossing(s, { bv: 0, quota: 100, live: false, t: 10 }), null);
  assert.equal(crossing(s, { bv: 0, quota: 100, live: true, t: 20 }), null, 'the new shift starts fresh, under the mark');
  assert.equal(crossing(s, { bv: 5, quota: null, live: true, t: 30 }), null, 'endless: no target');
});

test('the venue gauge: a pass tick at QUOTA_KPI (0.5); red under it only during Last Call', () => {
  assert.equal(gaugePass(), 0.5);
  assert.equal(gaugeRed(0.43, true), true);
  assert.equal(gaugeRed(0.43, false), false);
  assert.equal(gaugeRed(0.5, true), false);
  assert.equal(gaugeRed(null, true), false, 'no gauge (the Muni, the Club)');
});

test('the stamp: APPROVED in red ink, DENIED in grey with a reason of 8 words or fewer', () => {
  assert.deepEqual(stampFor({ hit: true }), { ok: true, text: 'APPROVED', ink: '#d0202a', why: '' });
  const d = stampFor({ hit: false, why: 'Missed: the bowls were full.' });
  assert.equal(d.text, 'DENIED'); assert.equal(d.ok, false); assert.equal(d.why, 'Missed: the bowls were full.');
  assert.equal(stampFor({ hit: false, why: 'one two three four five six seven eight nine' }).why, '', 'too long: dropped');
  assert.equal(stampFor(null), null);
  assert.ok(BELL.STAMP_SECS <= BELL.REPORT_HOLD, 'the stamp is gone before the report card opens');
  assert.equal(BELL.FLASH_GAP, 3);
  assert.ok(BELL.CONFETTI <= 160 && BELL.CONFETTI_LOW <= 60);
});

test('bell() and trombone() exist, are synthesised (no samples) and are silent with no audio context', () => {
  assert.equal(typeof SFX.bell, 'function');
  assert.equal(typeof SFX.trombone, 'function');
  assert.doesNotThrow(() => { SFX.bell(); SFX.trombone(); });
  assert.ok(SFX.BELL_PARTIALS.length >= 5 && SFX.TROMBONE_NOTES.length === 2);
  assert.ok(SFX.TROMBONE_NOTES[1][1] < SFX.TROMBONE_NOTES[0][0], 'the second note sags lower');
  const src = readFileSync(new URL('../web/js/sfx.js', import.meta.url), 'utf8');
  assert.ok(!/\.(mp3|ogg|wav)['"]/.test(src));
});

test('the Board wires the flash, the tick and the stamp; confetti is one pooled Points', () => {
  const board = readFileSync(new URL('../web/js/board.js', import.meta.url), 'utf8');
  assert.ok(board.includes('crossing(') && board.includes('gaugeRed(') && board.includes('function stamp('));
  const conf = readFileSync(new URL('../web/js/confetti.js', import.meta.url), 'utf8');
  assert.equal((conf.match(/new THREE\.Points\(/g) ?? []).length, 1);
});
