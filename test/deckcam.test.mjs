// The Deck Cam (council round 10 #4): web/js/deckcam.js, pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECKCAM, CUT_LABEL, cutPlan, shotFor, skips, cutAt, fallRate } from '../web/js/deckcam.js';
import { DECK } from '../web/js/deck.js';
import { wordCount } from '../web/js/say.js';

const fall = (k = 1) => ({ t: 'deckFall', seat: 2, x: -6, z: 1, k });

test('the length: 2.6 s for the shift\'s first fall, 1.8 s for the 2nd and later', () => {
  assert.equal(cutPlan(fall(1), {}).secs, 2.6);
  assert.equal(cutPlan(fall(2), {}).secs, 1.8);
  assert.equal(cutPlan(fall(5), {}).secs, 1.8);
  assert.equal(cutPlan(fall(2), {}, 1).secs, 2.6, 'k can be passed');
});

test('the shot: from (x + 3.5, 1.4, -2.5) up at (x, 2.2, 1.8)', () => {
  assert.deepEqual(shotFor(-6), { from: { x: -2.5, y: 1.4, z: -2.5 }, at: { x: -6, y: 2.2, z: 1.8 } });
  const p = cutPlan(fall(), {});
  assert.deepEqual([p.from, p.at], [shotFor(-6).from, shotFor(-6).at]);
});

test('playthrough 5 B4: the short cut frames the drop (from above the customers) and the BONK lands inside it', () => {
  const p = cutPlan(fall(2), {});
  assert.deepEqual([p.from, p.at], [shotFor(-6, true).from, shotFor(-6, true).at]);
  assert.ok(p.from.y > 2.2, 'over a customer head');
  // The fall's own clock: the lean (u < 0.25) then the drop, at the short cut's rates.
  let t = 0, u = 0; const dt = 1 / 120;
  while (u < 1) { u += dt * fallRate(u, DECKCAM.SECS_LATER) / DECK.FALL_SECS; t += dt; }
  assert.ok(t < DECKCAM.SECS_LATER, `the BONK at ${t.toFixed(2)} s`);
  assert.equal(fallRate(0.1, DECKCAM.SECS), 1, 'the first cut keeps its lean');
  assert.equal(fallRate(0.5, DECKCAM.SECS), DECKCAM.SLOW);
});

test('who is left out: driving, diving, the Lift or EVA, a menu, knocked down, and the setting off', () => {
  for (const me of [{ driving: true }, { diving: true }, { lift: true }, { menu: true }, { down: 1.2 }, { replays: false }])
    assert.equal(cutPlan(fall(), me), null, JSON.stringify(me));
  assert.ok(cutPlan(fall(), { down: 0, replays: true }));
  assert.equal(cutPlan(null, {}), null);
  assert.equal(cutPlan({ t: 'deckFall' }, {}), null, 'no x, no shot');
});

test('the cook gets the short cut after closing the kitchen, within 5 s', () => {
  const p = cutPlan(fall(1), { kitchen: true });
  assert.equal(p.wait, true); assert.equal(p.secs, DECKCAM.SECS_LATER); assert.equal(p.until, 5);
});

test('skip: any button, any key, or a stick past 0.5', () => {
  assert.equal(skips({}), false);
  assert.equal(skips({ sticks: [0.3, -0.49, 0.1, 0] }), false);
  assert.equal(skips({ sticks: [0, 0.51] }), true);
  assert.equal(skips({ sticks: [-0.6] }), true);
  assert.equal(skips({ buttons: [false, { pressed: false }] }), false);
  assert.equal(skips({ buttons: [false, { pressed: true }] }), true);
  assert.equal(skips({ key: true }), true);
});

test('it cuts back at its length, or on the BONK; the edge label is short', () => {
  assert.deepEqual(cutAt(1.3, 2.6), { on: true, k: 0.5 });
  assert.equal(cutAt(2.6, 2.6).on, false);
  assert.equal(cutAt(0.5, 2.6, true).on, false);
  for (const l of Object.values(CUT_LABEL)) assert.ok(wordCount(l) <= 5, l);
});
