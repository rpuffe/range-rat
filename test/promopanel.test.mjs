// Council round 6 #7.3: the report's promotion panel shows stamps from the first, and the fee only from 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoPanelHtml, showPromo, showFee, FEE_FROM_STAMPS } from '../web/js/promopanel.js';

const promo = (stamps, ready = false) => ({ next: 'Range Club', fee: 6000, stamps, need: 3, ready, signed: [] });

test('no panel before the first stamp', () => {
  assert.equal(showPromo(promo(0)), false); assert.equal(promoPanelHtml(promo(0)), ''); assert.equal(promoPanelHtml(null), '');
});
test('1 stamp: the stamps, no fee; 2 stamps: the fee', () => {
  assert.equal(FEE_FROM_STAMPS, 2);
  const one = promoPanelHtml(promo(1), { cash: 100 });
  assert.match(one, /Review stamps/); assert.match(one, /●○○/); assert.doesNotMatch(one, /Franchise fee/);
  const two = promoPanelHtml(promo(2), { cash: 100 });
  assert.match(two, /Franchise fee <b>\$6,000 · you have \$100/);
  assert.equal(showFee(promo(1)), false); assert.equal(showFee(promo(2)), true);
});
test('ready: the fee and the sign button', () => {
  const h = promoPanelHtml(promo(3, true), { signedN: 1, onlineN: 2 });
  assert.match(h, /Franchise fee <b>\$6,000<\/b>/); assert.match(h, /Sign the franchise agreement \(1 of 2 signed\)/);
});
