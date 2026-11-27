// Council round 6 #7.1: only your own cash floats over you; machinery rolls into one float over the stand every 2 s.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAYFLOAT, payRoute, createRoller } from '../web/js/payfloat.js';

test('your banks are yours, other Rats\' are theirs, machinery rolls up', () => {
  const ids = ['me', 'pat'];
  assert.equal(payRoute({ by: 'me', kind: null }, 'me', ids), 'hud', 'round 14 6.5: your own banks pop by the cash HUD');
  assert.equal(payRoute({ by: 'me', kind: 'cart' }, 'me', ids), 'hud', 'the cart you drove');
  assert.equal(payRoute({ by: 'pat', kind: null }, 'me', ids), 'rat');
  assert.equal(payRoute({ by: 'pat', kind: 'cart' }, 'me', ids), 'rat');
  for (const e of [{ by: 'h1', kind: 'helper' }, { by: 'night', kind: 'helper' }, { by: 'gutter', kind: 'gutter' },
    { by: 'tether', kind: null }, { by: 'cart', kind: 'cart' }, { by: 'd2', kind: 'helper' }]) assert.equal(payRoute(e, 'me', ids), 'roll', e.by);
  assert.equal(PAYFLOAT.RAT_FEED_MIN, 20);
});

test('the roller sums a 2 s window into one float', () => {
  const out = [], timers = [];
  const r = createRoller(x => out.push(x), (fn, ms) => timers.push([fn, ms]));
  r.add(100.5, 3); r.add(40, 2); r.add(0.25, 1);
  assert.equal(timers.length, 1); assert.equal(timers[0][1], 2000);
  assert.equal(out.length, 0);
  timers.shift()[0]();
  assert.deepEqual(out, [{ cash: 140.75, n: 6 }]);
  r.add(5, 1); assert.equal(timers.length, 1, 'a new window');
  timers.shift()[0](); assert.deepEqual(out[1], { cash: 5, n: 1 });
});
