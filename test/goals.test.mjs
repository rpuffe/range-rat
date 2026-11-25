// Council round 10 #1: the venue goal card (web/js/goals.js), pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, crewScale, scaled, printCard, rowsOf, cardDone, nextGoal, goalLine, rewardFor, migrateV4, doneToast, strip,
  headline, tomorrowLine, dealLine, dealGoal, cleanCard, printOver, cardHtml, moreText } from '../web/js/goals.js';

const words = s => s.trim().split(/\s+/).length;

test('every card has 5 goals with the fee last; the Orbital has 4 and no fee', () => {
  for (let v = 0; v <= 4; v++) {
    assert.equal(CARDS[v].length, 5, 'venue ' + v);
    assert.equal(CARDS[v].at(-1).id, 'fee');
    assert.equal(CARDS[v].filter(g => g.id === 'reviews').length, 1);
  }
  assert.equal(CARDS[0].find(g => g.id === 'reviews').n, 2, 'the Muni: 2 good days');
  for (let v = 1; v <= 2; v++) assert.equal(CARDS[v].find(g => g.id === 'reviews').n, 3, 'the Club and Tiered: 3');
  for (let v = 3; v <= 4; v++) assert.equal(CARDS[v].find(g => g.id === 'reviews').n, 2, 'round 11 (expert #1): the Stadium and the County: 2');
  assert.equal(CARDS[5].length, 4);
  assert.ok(!CARDS[5].some(g => g.id === 'fee'));
});

test('scale: solo 0.4, 2P 0.6, 3P 0.8, 4P 1, 5P 1.2, 6P 1.4, rounded up', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(crewScale), [0.4, 0.6, 0.8, 1, 1.2, 1.4]);
  assert.equal(scaled(2000, 0.4), 800);
  assert.equal(scaled(2000, 0.6), 1200);
  assert.equal(scaled(30, 0.4), 12);
  assert.equal(scaled(8, 0.6), 5, '4.8 rounds up');
  assert.equal(scaled(12, 1.4), 17, '16.8 rounds up');
  assert.equal(scaled(24, 0.8), 20, '19.2 rounds up');
  const solo = printCard(1, 1), six = printCard(1, 6);
  assert.equal(solo.need.fed, 180); assert.equal(six.need.fed, 180, 'playthrough 5 B5: FED uptime does not scale');
  assert.equal(printCard(0, 1).need.bank, 800);
  assert.equal(solo.need.treasures, 2, 'treasures do not scale (one a morning)');
  assert.equal(solo.need.reviews, 3, 'nor the good days');
  assert.equal(printCard(5, 3).need.lift, 3, 'every Rat printed on the card');
});

test('rows: counts, purchases from the shop, the live fee', () => {
  const card = printCard(0, 4);
  card.n.bank = 1500; card.n.reviews = 1;
  let rows = rowsOf(card, { up: {}, cash: 4605, fee: 5500 });
  assert.deepEqual(rows.map(r => r.done), [false, false, false, false, false]);
  assert.equal(goalLine(rows[0]), 'Bank 2,000 balls · 1,500 / 2,000');
  assert.equal(goalLine(rows[3]), 'Hit the daily target 2× · 1 / 2');
  assert.equal(goalLine(rows[4]), 'Save the $5,500 fee · $4,605 / $5,500');
  rows = rowsOf(card, { up: { washer: 1 }, cash: 6000, fee: 5500 });
  assert.equal(rows[1].done, true, 'owning the washer ticks it');
  assert.equal(rows[4].done, true, 'the fee ticks with the cash');
  assert.equal(rowsOf(card, { up: {}, cash: 10, fee: 5500 })[4].done, false, 'and un-ticks below it');
});

test('nextGoal: the first open in card order; the fee only when it is the last one left', () => {
  const card = printCard(1, 4);
  card.n.fed = 75;
  let rows = rowsOf(card, { cash: 0, fee: 9000 });
  assert.equal(nextGoal(rows).id, 'fed');
  assert.equal(moreText(nextGoal(rows)), '2 more minutes fed');
  assert.equal(goalLine(nextGoal(rows)), 'Keep the crew fed for 3 minutes · 1:15 / 3:00');
  assert.equal(strip(rows, 1).next, 'NEXT: 2 MORE MINUTES FED');
  assert.equal(strip(rows, 1).label, '0 OF 5 GOALS');
  card.n.fed = 180; card.n.treasures = 2; card.done.push('seal'); card.n.reviews = 3;
  rows = rowsOf(card, { cash: 0, fee: 9000 });
  assert.equal(nextGoal(rows).id, 'fee');
  assert.equal(strip(rows, 1).label, '4 OF 5 GOALS');
  assert.equal(strip(rows, 1).next, 'NEXT: $9,000 MORE FOR THE FEE');
  card.n.reviews = 2;
  assert.equal(nextGoal(rowsOf(card, { cash: 0, fee: 9000 })).id, 'reviews', 'the fee waits behind an open goal');
  assert.equal(nextGoal(rowsOf(card, { cash: 0, fee: 9000 })).id, 'reviews');
});

test('cardDone needs all five', () => {
  const card = printCard(2, 2);
  Object.assign(card.n, { targets: 99, orders: 99, reviews: 3 });
  assert.equal(cardDone(rowsOf(card, { up: { gutters: 1 }, cash: 1e6, fee: 600000 })), true);
  assert.equal(cardDone(rowsOf(card, { up: {}, cash: 1e6, fee: 600000 })), false);
  assert.equal(cardDone(rowsOf(card, { up: { gutters: 1 }, cash: 1, fee: 600000 })), false);
  assert.equal(cardDone([]), false);
});

test('the reward: REWARD_BV[venue] × BV × crewScale (round 11: ~7% of a shift, every venue)', () => {
  assert.equal(rewardFor(29), 1160);                 // the Muni, 4P: 40 × 29
  assert.equal(rewardFor(2.62, 0, 1), 41.92);         // solo: × 0.4
  assert.equal(rewardFor(400, 2, 4), 48000);          // Tiered: 120 × BV
  assert.equal(rewardFor(8400, 4, 2), 756000);        // the County, 2P: 150 × BV × 0.6
  assert.equal(rewardFor(10, 99), 1300);              // past the Orbital: the Orbital's
  assert.equal(doneToast('fed', 180, 1450), 'Goal done! Fed for 3 minutes. +$1,450');
  for (const id of ['bank', 'washer', 'huddle', 'fed', 'treasures', 'seal', 'targets', 'orders', 'gutters', 'laps', 'pings', 'cart2', 'strays', 'drones', 'pass', 'lift', 'debris', 'tether'])
    assert.ok(words(doneToast(id, 2000, 1_234_567)) <= 8, id + ': ' + doneToast(id, 2000, 1_234_567));
});

test('a v4 save with 3 stamps is grandfathered; with 1 the review count is 1 and owned rows tick', () => {
  const g = migrateV4({ venue: 1, stamps: 3 });
  assert.equal(g.grand, true);
  const full = printOver(g, 4);
  assert.equal(cardDone(rowsOf(full, { cash: 1e6, fee: 50000 })), true, 'the card is done…');
  assert.equal(cardDone(rowsOf(full, { cash: 10, fee: 50000 })), false, '…except the live fee');
  const one = printOver(migrateV4({ venue: 0, stamps: 1 }), 2);
  const rows = rowsOf(one, { up: { washer: 2 }, cash: 0, fee: 7700 });
  assert.equal(rows.find(r => r.id === 'reviews').have, 1);
  assert.equal(rows.find(r => r.id === 'washer').done, true, 'an owned washer ticks');
  assert.equal(rows.find(r => r.id === 'bank').have, 0, 'counts start at 0');
  assert.equal(rows.find(r => r.id === 'huddle').done, false, 'Gary starts open');
  assert.equal(rows.find(r => r.id === 'bank').need, 1200, 'printed for the crew of the next morning');
  assert.equal(migrateV4({ venue: 0, stamps: 9 }).n.reviews, 2);
  assert.equal(migrateV4({ venue: 5, outstanding: 1 }).grand, true, 'an Orbital save at Ball No. 1');
  assert.equal(migrateV4({ venue: 5, outstanding: 900 }).grand, true, 'any v4 Orbital save');
  assert.equal(migrateV4({ venue: 3, endless: true }), null);
});

test('cleanCard drops junk and another venue’s card', () => {
  const c = printCard(1, 3); c.n.fed = 7; c.done.push('seal', 'fee', 'nope');
  const back = cleanCard(JSON.parse(JSON.stringify(c)), 1);
  assert.deepEqual(back.n, { fed: 7 }); assert.deepEqual(back.done, ['seal']); assert.equal(back.scale, 0.8);
  // Playthrough 5 B5: an old card's done hot dog goal stays done as the FED goal; its dog count is dropped.
  const old = cleanCard({ venue: 1, scale: 1, crew: 4, n: { hotdogs: 30 }, done: ['hotdogs'] }, 1);
  assert.deepEqual(old.done, ['fed']); assert.deepEqual(old.n, {});
  assert.equal(cleanCard(c, 2), null);
  assert.equal(cleanCard('junk', 1), null);
  assert.equal(cleanCard({ venue: 1, scale: 7, n: { fed: -3 } }, 1).scale, null);
});

test('words: the headline, tomorrow and deal lines', () => {
  const card = printCard(1, 4); card.n.fed = 180; card.n.reviews = 3; card.done.push('seal');
  const rows = rowsOf(card, { cash: 0, fee: 50000 });
  assert.equal(headline(rows, 1), '3 of 5 done · 2 to go');
  assert.equal(tomorrowLine(rows, 1), 'Tomorrow: two goals left for Tiered.');
  card.n.treasures = 2;
  const all = rowsOf(card, { cash: 1e6, fee: 50000 });
  assert.equal(headline(all, 1), 'Card done! Sign for Tiered.');
  assert.equal(tomorrowLine(all, 1), 'Tomorrow: sign at the bell for Tiered.');
  assert.equal(tomorrowLine(rowsOf(printCard(0, 4), { cash: 0, fee: 1 }), 0), 'Tomorrow: five goals left for the Club.');
  const dogs = printCard(1, 4); dogs.n.fed = 120;
  const pick = dealGoal(rowsOf(dogs, { cash: 0, fee: 1 }));
  assert.equal(pick.id, 'fed', 'the open goal nearest done');
  assert.equal(dealLine(pick), 'Goal: 1 more minute fed.');
  for (let v = 0; v <= 5; v++) {
    const rs = rowsOf(printCard(v, 4), { cash: 0, fee: 1 });
    for (const r of rs) assert.ok(words(dealLine(r)) <= 8, dealLine(r));
    assert.ok(words(tomorrowLine(rs, v)) <= 8, tomorrowLine(rs, v));
    assert.ok(words(strip(rs, v).next) <= 8, strip(rs, v).next);
  }
  assert.equal(strip(rowsOf(printCard(5, 4), {}), 5).label, 'THE LAST BUCKET 0 OF 4');
});

test('cardHtml: rows, rewards, today highlighted', () => {
  const card = printCard(1, 4); card.n.fed = 180;
  const h = cardHtml(rowsOf(card, { cash: 0, fee: 9 }, ['fed']), { rewardNow: 1450 });
  assert.match(h, /class="done fresh"/);
  assert.match(h, /Keep the crew fed for 3 minutes/);
  assert.match(h, /✦ \+\$1,450/);
  assert.equal((h.match(/<li/g) ?? []).length, 5);
});
