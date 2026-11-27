// Council round 13 #4 (builder 2): Range landmarks, one thing worth buying at every venue. design/round15-club.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIM, priceScale, shopShows, tierLock } from '../web/js/sim.js';
import { LANDMARK, LANDMARK_ROW, landmarkTier, hasLandmark, BELL, atBell, bellOpen, TAP, tapPours, FIREWORKS, INSPECT2, inspect2Due,
  INSPECTOR_MEMO, STAR_LINE, BELL_PROMPT, BELL_WAIT, worthBuying } from '../web/js/landmarks.js';
import { stretchSections, stretchN, stretchAlert, SECTIONS } from '../web/js/stadium.js';
import { BONUS_ALERT } from '../web/js/tourney.js';
import { wordCount } from '../web/js/say.js';
import { Crew } from '../server/crew.mjs';

test('the row: five tiers, one per venue, in order; prices ×2.2 at 4P ($22k / $440k / $11M / $44M / $132M)', () => {
  const t = LANDMARK_ROW.tiers;
  assert.equal(t.length, 6);
  assert.deepEqual(t.slice(1).map(x => x.minVenue), [1, 2, 3, 4, 5], 'one a venue, sequential');
  assert.deepEqual(t.slice(1).map(x => Math.round(x.cost * priceScale(4))), [22_000, 440_000, 11_000_000, 44_000_000, 132_000_000]);
  assert.equal(landmarkTier({ landmark: 9 }), 5); assert.equal(landmarkTier({}), 0);
  assert.ok(hasLandmark({ landmark: 3 }, LANDMARK.TAP) && !hasLandmark({ landmark: 1 }, LANDMARK.TAP));
});

test('each tier shows from its venue; the bell from Club day 4; the next tier waits for its venue', () => {
  assert.equal(shopShows(LANDMARK_ROW, 0, 9), false, 'not at the Muni');
  assert.equal(shopShows(LANDMARK_ROW, 1, 9, false, 4, 3), false, 'Club day 3: not yet');
  assert.equal(shopShows(LANDMARK_ROW, 1, 9, false, 4, 4), true, 'Club day 4');
  assert.equal(shopShows(LANDMARK_ROW, 3, 9), true);
  assert.equal(tierLock(LANDMARK_ROW, 0, 1, 9, 4), null, 'the bell at Club day 4');
  assert.ok(tierLock(LANDMARK_ROW, 1, 1, 9, 5), 'the Tap Wall waits for Tiered');
  assert.equal(tierLock(LANDMARK_ROW, 1, 2, 9), null);
  assert.ok(tierLock(LANDMARK_ROW, 2, 2, 9), 'the fireworks wait for the Stadium');
  assert.equal(tierLock(LANDMARK_ROW, 4, 5, 9), null, 'the star at the Orbital');
});

test('the bell: by the return, once a shift, T-6:00..T-1:30, never with a flight out; a bonus flight in a crew', () => {
  assert.ok(Math.hypot(BELL.POST.x - SIM.STAND.x, BELL.POST.z - SIM.STAND.z) < 8, 'by the return');
  assert.ok(atBell(BELL.POST) && !atBell({ x: BELL.POST.x + 3, z: BELL.POST.z }));
  assert.equal(bellOpen({ left: 361 }), false); assert.equal(bellOpen({ left: 360 }), true); assert.equal(bellOpen({ left: 90 }), true);
  assert.equal(bellOpen({ left: 89 }), false); assert.equal(bellOpen({ left: 200, rung: true }), false); assert.equal(bellOpen({ left: 200, live: true }), false);
  assert.equal(bellOpen({ left: 200, venue: 2 }), true, 'council round 14 #3a: Tiered rings a bonus Happy Hour');
  assert.equal(bellOpen({ left: 200, venue: 3 }), false, 'from the Stadium: sound only');
  assert.equal(bellOpen({ left: 200, venue: 2, endless: true }), false);
  const clock = { t: 1e6 };
  const crew = new Crew('BELL', { venue: 1, day: 12, venueDay: 4, up: { landmark: 1, gear: 3 }, mowe: { tame: true } }, { seed: 7, now: () => clock.t });
  crew.up.landmark = 1;   // (a save's up.landmark needs LANDMARK_ROW in SHOP: builder 4's sim.js line)
  const p = crew.join('A'); crew.connect(p); crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  const run = s => { for (let i = 0; i < s * 20; i++) { clock.t += 50; p.seenAt = clock.t; p.movedAt = clock.t; crew.tick(0.05); } };
  Object.assign(p, BELL.POST);
  run(30); crew.events = [];
  crew.mods.first('input', p, { t: 'bell' });
  assert.equal(crew.events.some(e => e.t === 'tourney' && e.phase === 'bellno'), true, 'T-6:30: too early');
  run(31); crew.events = [];
  crew.mods.first('input', p, { t: 'bell' });
  const fl = crew.events.find(e => e.t === 'tourney' && e.phase === 'flight');
  assert.ok(fl && fl.bonus, 'a bonus flight');
  run(40); crew.events = [];
  crew.mods.first('input', p, { t: 'bell' });
  assert.equal(crew.events.some(e => e.phase === 'flight'), false, 'once a shift');
  assert.equal(crew.mods.state('tourney').bonus, 1);
});

test('the Tap Wall: every third order pours itself (paid as an order, no drink added)', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(tapPours), [false, false, true, false, false, true]);
  assert.equal(TAP.EVERY, 3);
  const clock = { t: 1e6 };
  const crew = new Crew('TAP', { venue: 2, day: 20, venueDay: 1, up: { landmark: 2, shed: 1 } }, { seed: 4, now: () => clock.t });
  crew.up.landmark = 2;
  const p = crew.join('A'); crew.connect(p); crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  const ev = [];
  for (let i = 0; i < 20 * 200; i++) { clock.t += 50; p.seenAt = clock.t; p.movedAt = clock.t; crew.tick(0.05); ev.push(...crew.events); crew.events = []; }
  const orders = ev.filter(e => e.t === 'deckOrder').length, taps = ev.filter(e => e.t === 'deckTab' && e.tap).length;
  assert.ok(orders >= 3, `orders came (${orders})`);
  assert.equal(taps, Math.floor(orders / 3));
  assert.equal(crew.mods.state('deck').deck.drinks, 0, 'the wall pours; nobody drinks more');
});

test('the fireworks: the Stretch lights one more section (3 at 1-2P, 4 at 3P+); GRAND SLAM only when all answered', () => {
  for (let d = 1; d < 40; d++) for (const n of [1, 2, 3, 4]) {
    const plain = stretchSections(d, 1, n), fw = stretchSections(d, 1, n, FIREWORKS.EXTRA);
    assert.equal(plain.length, stretchN(n));
    assert.equal(fw.length, stretchN(n) + 1);
    assert.equal(new Set(fw).size, fw.length);
    for (const i of fw) assert.ok(SECTIONS[i]);
  }
  assert.ok(wordCount(stretchAlert(4)) <= 8);
  assert.equal(stretchAlert(4), 'Seventh-inning stretch! Four sections want balls!');
});

test('the second inspection: T-5:30, 45 s, ×4; never past its window', () => {
  assert.equal(INSPECT2.AT, 330); assert.equal(INSPECT2.SECS, 45); assert.equal(INSPECT2.PAY, 4);
  assert.equal(inspect2Due({ left: 331 }), false); assert.equal(inspect2Due({ left: 330 }), true);
  assert.equal(inspect2Due({ left: 300, done: true }), false); assert.equal(inspect2Due({ left: 250 }), false);
  const clock = { t: 1e6 };
  const crew = new Crew('INS', { venue: 4, day: 30, venueDay: 1, up: { landmark: 4 } }, { seed: 4, now: () => clock.t });
  crew.up.landmark = 4;
  const p = crew.join('A'); crew.connect(p); crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  const ev = [];
  for (let i = 0; i < 20 * 250; i++) { clock.t += 50; p.seenAt = clock.t; p.movedAt = clock.t; crew.tick(0.05); ev.push(...crew.events); crew.events = []; }
  const starts = ev.filter(e => e.t === 'inspect' && e.phase === 'start');
  assert.equal(starts.length, 2, 'two visits');
  assert.equal(starts[0].site13, true); assert.equal(starts[0].secs, 45);
  assert.ok(!starts[1].site13);
});

test('the lines are ≤ 8 words', () => {
  for (const s of [BONUS_ALERT, INSPECTOR_MEMO, STAR_LINE, BELL_PROMPT, BELL_WAIT]) assert.ok(wordCount(s) <= 8, s);
});

test('worthBuying: a price within 2 shifts of income', () => {
  assert.equal(worthBuying(100, 50), true); assert.equal(worthBuying(101, 50), false); assert.equal(worthBuying(null, 50), false);
});
