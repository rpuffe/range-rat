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

// Council round 7 #10.1 (A5): stamps done, fee unpaid: the report leads with the shortfall.
import { feeHeadline } from '../web/js/promopanel.js';
test('the fee headline appears at 3 stamps only, and only while short', () => {
  const p = { next: 'Range Club', fee: 5500, stamps: 3, need: 3, ready: false, signed: [] };
  assert.equal(feeHeadline(p, 4605), '3 stamps. $895 short.');
  assert.ok(feeHeadline(p, 4605).split(' ').length <= 8);
  assert.equal(feeHeadline({ ...p, stamps: 2 }, 4605), '');
  assert.equal(feeHeadline({ ...p, stamps: 0 }, 0), '');
  assert.equal(feeHeadline(p, 5500), '');                    // the fee is covered
  assert.equal(feeHeadline({ ...p, ready: true }, 100), ''); // ready to sign: the button leads instead
  assert.equal(feeHeadline(null), '');
});
