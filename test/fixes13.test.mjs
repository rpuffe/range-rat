// Council round 13 #8 (builder 4): the fixes pack.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mins, moreText, rowsOf, printCard, withBuyPay, buyUp, cardHtml } from '../web/js/goals.js';
import { createReadyGate, READY } from '../web/js/readygate.js';
import { huddleCalls, huddleLine, huddleHolds, HUDDLE_CALL } from '../web/js/huddlerules.js';
import { lobbyTagline } from '../web/js/sim.js';
import { GOALS_BY_STARS, goalText, contractMet } from '../web/js/today.js';
import { Crew } from '../server/crew.mjs';

const words = s => s.trim().split(/\s+/).length;

test('8.5: under a minute reads "under a minute"; "1 more minute" is 60-119 s', () => {
  assert.equal(mins(1), 'under a minute');
  assert.equal(mins(59), 'under a minute');
  assert.equal(mins(60), '1 minute');
  assert.equal(mins(119), '1 minute');
  assert.equal(mins(120), '2 minutes');
  assert.equal(mins(180), '3 minutes');
  const card = printCard(1, 4);
  card.n.fed = 179;
  assert.equal(moreText(rowsOf(card, { cash: 0, fee: 1 }).find(r => r.id === 'fed')), 'under a minute more fed');
  card.n.fed = 70;
  assert.equal(moreText(rowsOf(card, { cash: 0, fee: 1 }).find(r => r.id === 'fed')), '1 more minute fed');
});

test('8.4: a buy goal\'s ✦ shows the reward at the Ball Value after the buy lands', () => {
  assert.deepEqual(buyUp({ washer: 0, ads: 1 }, 'washer'), { washer: 1, ads: 1 });
  const rows = [{ id: 'washer', kind: 'buy', reward: true, done: false, text: 'Buy the ball washer' }, { id: 'bank', kind: 'count', reward: true, done: false, text: 'Bank', have: 1, need: 2 }];
  const out = withBuyPay(rows, { washer: 0 }, up => (up.washer ? 54.88 : 27.44));
  assert.equal(out[0].pay, 54.88);
  assert.equal(out[1].pay, undefined);
  assert.match(cardHtml(out, { rewardNow: 27.44 }), /✦ ≈ \+\$54\.88/);   // round 14 6.12: an open row's pay is an estimate
  // the live crew: day 1's washer goal pays (and shows) more than today's BV reward, at exactly what it then pays
  let t = 0;
  const c = new Crew('WASH', null, { seed: 7, now: () => t * 1000 });
  const p = c.join('a'); c.connect(p); c.startShift(); c.endShift();   // the overnight shop
  const w = c.goalWire(), row = w.rows.find(r => r.id === 'washer');
  assert.ok(row.pay > w.reward, `${row.pay} > ${w.reward}`);
  c.cash = 1e6; c.events = [];
  assert.ok(c.buy(p, 'washer'));
  const ev = c.events.find(e => e.t === 'goal' && e.id === 'washer');
  assert.ok(ev, 'the washer goal paid');
  assert.equal(ev.reward, row.pay);
});

test('8.7: the Stadium lobby line is about souvenirs', () => {
  assert.equal(lobbyTagline(3), 'Answer souvenir requests. Keep the crowd happy.');
  assert.ok(words(lobbyTagline(3)) <= 8);
});

test('8.9: the 3★ contract allows one knockdown', () => {
  const up = GOALS_BY_STARS[3].find(g => g.k === 'upright');
  assert.equal(up.n, 1);
  assert.equal(goalText(up), 'At most 1 knockdown');
  assert.ok(contractMet({ goal: { k: 'upright', n: 1 } }, { knockdowns: 1 }));
  assert.ok(!contractMet({ goal: { k: 'upright', n: 1 } }, { knockdowns: 2 }));
});

test('8.3: Ready ignores a held key and Ⓐ for 1.5 s after a card closes; a fresh press works', () => {
  const g = createReadyGate();
  g.keyDown(0.0); g.frame(0.1, true); g.frame(1.0, true);   // Space went down while the note card was up
  g.frame(1.1, false);                                       // the card closes; the report takes focus
  g.keyUp(1.2);
  assert.equal(g.allow(1.2), false, 'the held Space\'s key-up does not ready');
  g.keyUp(2.9);
  assert.equal(g.allow(2.9), false, 'nor later: that press began under the card');
  assert.equal(g.allow(1.6 + 0.3), false, 'a pad Ⓐ inside the grace');
  g.keyDown(3.0); assert.equal(g.allow(3.0), true, 'a fresh press after the grace readies');
  const h = createReadyGate();
  h.frame(0, true); assert.equal(h.allow(0.5, 'mouse'), true, 'a mouse click is always deliberate');
  assert.equal(READY.GRACE, 1.5);
});

test('8.2: a double press is one press; the button shows pressed at once', () => {
  const g = createReadyGate();
  assert.equal(g.allow(10, 'mouse'), true);
  assert.ok(g.pressedNow(10.2));
  assert.equal(g.allow(10.25, 'mouse'), false, 'the second click of a double click');
  assert.equal(g.allow(10 + READY.PRESSED + 0.01, 'mouse'), true);
});

test('8.6: the huddle calls the far and the diving Rats, and waits up to 10 s for a diver', () => {
  const stand = { x: 26, z: 10 };
  const ps = [{ id: 'a', online: 1, x: 26, z: 12 }, { id: 'b', online: 1, x: 20, z: -80, diving: true }, { id: 'c', online: 1, x: 26, z: -40 }, { id: 'd', online: 0, x: 0, z: -200 }];
  const calls = huddleCalls(ps, stand);
  assert.deepEqual(calls, [{ id: 'b', dive: true }, { id: 'c', dive: false }]);
  const names = { b: 'Pip', c: 'Kev' };
  assert.equal(huddleLine([{ id: 'b', dive: true }], id => names[id]), 'Huddle! Pip, surface!');
  assert.equal(huddleLine(calls, id => names[id]), 'Huddle! Pip +1, back to the return!');
  assert.ok(words(huddleLine(calls, id => names[id])) <= 8);
  assert.equal(huddleLine([], id => id), '');
  assert.ok(huddleHolds(ps, 0, stand));
  assert.ok(!huddleHolds(ps, HUDDLE_CALL.WAIT, stand), 'never longer than 10 s');
  assert.ok(!huddleHolds(ps.filter(p => !p.diving), 0, stand), 'no wait for a walker');
});
