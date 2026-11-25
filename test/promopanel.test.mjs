// The report's promotion panel. Council round 10 #1: the goal card replaced the review stamps (council round 6 #7.3 /
// round 7 #10.1 tested the stamps and the fee headline): five rows, Sign only when all five are done, and the
// headline reads the card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoPanelHtml, showPromo, cardHeadline } from '../web/js/promopanel.js';
import { printCard, rowsOf } from '../web/js/goals.js';

const promo = (ready = false) => ({ next: 'Range Club', fee: 6000, ready, signed: [], done: ready ? 5 : 1, of: 5 });
const goals = (n = {}, live = {}) => { const c = printCard(0, 4); Object.assign(c.n, n); return { venue: 0, rows: rowsOf(c, { cash: 0, fee: 6000, ...live }), reward: 131 }; };

test('the card shows from the first report: five rows, no stamps', () => {
  assert.equal(showPromo(null), false); assert.equal(promoPanelHtml(null), '');
  const h = promoPanelHtml(promo(), { goals: goals({ bank: 800 }), cash: 100 });
  assert.doesNotMatch(h, /stamp/i);
  assert.equal((h.match(/<li/g) ?? []).length, 5);
  assert.match(h, /Bank 2,000 balls · 800 \/ 2,000/);
  assert.match(h, /Save the \$6,000 fee/);
  assert.doesNotMatch(h, /sign-btn/, 'no Sign before 5/5');
});
test('ready: the sign button', () => {
  const h = promoPanelHtml(promo(true), { goals: goals({ bank: 2000, huddle: 1, reviews: 2 }, { up: { washer: 1 }, cash: 9000 }), signedN: 1, onlineN: 2 });
  assert.match(h, /Sign the franchise agreement \(1 of 2 signed\)/);
});
test('the headline reads the card', () => {
  assert.equal(cardHeadline(goals({ bank: 2000, reviews: 2 })), '2 of 5 done · 3 to go');
  assert.equal(cardHeadline(goals({ bank: 2000, huddle: 1, reviews: 2 }, { up: { washer: 1 }, cash: 9000 })), 'Card done! Sign for the Club.');
  assert.equal(cardHeadline(null), '');
  for (const g of [goals(), goals({ bank: 2000 })]) assert.ok(cardHeadline(g).split(' ').length <= 8);
});
