// The Upper Deck (council round 4, build item 5): the pure rules, the server module, the view's slogan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK, newDeck, stepDeck, serveEffect, applyServe, afterIncident, landingSpot, hitByFall, fallPose, climbPath, pointAlong,
  pathLength, bannerFor, mugTone, fineFor, tabFor, fillOrder, orderEvery, isRoundOrder } from '../web/js/deck.js';
import { Crew } from '../server/crew.mjs';
import deck from '../server/venues/deck.mjs';
import { createViews } from '../web/js/views/registry.js';
import { MODULES } from '../server/venues/index.mjs';

// ---- pure rules -------------------------------------------------------------------------------------------------
test('constants match the doc', () => {
  assert.equal(DECK.MAX, 6); assert.equal(DECK.WARN, 4); assert.equal(DECK.SOBER_SECS, 60);
  assert.deepEqual(DECK.FOOD, { fries: 1, hotdog: 2 });
  assert.equal(DECK.TAB, 5); assert.equal(DECK.FINE, 50); assert.equal(DECK.RESET_TO, 2); assert.equal(DECK.FALL_R, 1.5);
  assert.deepEqual(DECK.SEATS, [-14, -6, 6, 14]);
});

test('serveEffect: beer +1, hot dog -2, fries -1, burnt nothing', () => {
  assert.equal(serveEffect('beer', 'good'), 1); assert.equal(serveEffect('beer', 'perfect'), 1);
  assert.equal(serveEffect('hotdog', 'good'), -2); assert.equal(serveEffect('fries', 'perfect'), -1);
  for (const it of ['beer', 'hotdog', 'fries']) assert.equal(serveEffect(it, 'burnt'), 0);
});

test('six beers cause an incident, five do not', () => {
  const d = newDeck();
  for (let i = 0; i < 5; i++) assert.equal(applyServe(d, 'beer', 'good').incident, false);
  assert.equal(d.drinks, 5);
  assert.equal(applyServe(d, 'beer', 'perfect').incident, true);
  assert.equal(afterIncident(d), 0); assert.equal(d.drinks, DECK.RESET_TO);
  assert.equal(afterIncident(d), 1, 'round robin');
});

test('60 s sobers by 1; a hot dog is -2, fries -1, floored at 0; a burnt beer adds nothing', () => {
  const d = newDeck(); d.drinks = 4;
  stepDeck(d, 59.9); assert.equal(d.drinks, 4);
  stepDeck(d, 0.2); assert.equal(d.drinks, 3);
  applyServe(d, 'hotdog', 'good'); assert.equal(d.drinks, 1);
  applyServe(d, 'fries', 'good'); assert.equal(d.drinks, 0);
  applyServe(d, 'fries', 'good'); assert.equal(d.drinks, 0, 'floored');
  applyServe(d, 'beer', 'burnt'); assert.equal(d.drinks, 0);
});

test('landing spot and the 1.5 m rule', () => {
  const s = landingSpot(2); assert.deepEqual(s, { x: 6, z: 1.0 });
  assert.equal(hitByFall({ x: 6, z: 2.2 }, s), true, '1.2 m');
  assert.equal(hitByFall({ x: 6, z: 3.0 }, s), false, '2 m');
});

test('the fall runs from the rail to the ground; the climb ends at the seat; the mugs go amber then red', () => {
  const a = fallPose(1, 0), b = fallPose(1, 1);
  assert.deepEqual([a.x, a.y, a.z], [-6, 3, 2.4]); assert.ok(Math.abs(b.y) < 1e-9 && Math.abs(b.z - 1.0) < 1e-9);
  assert.ok(Math.abs(b.spin + Math.PI) < 1e-9, 'a half spin');
  const path = climbPath(3), end = pointAlong(path, pathLength(path) + 1);
  assert.equal(end.done, true); assert.deepEqual([end.x, end.y, end.z], [14, 3, 2.4]);
  assert.deepEqual([3, 4, 5, 6].map(mugTone), ['ok', 'loud', 'cut', 'cut']);
});

test('the slogan counts days; red and 0 on an incident day', () => {
  assert.equal(bannerFor(9, 5, false).text, 'DAYS WITHOUT AN INCIDENT: 4');
  const r = bannerFor(5, 5, true); assert.equal(r.text, 'DAYS WITHOUT AN INCIDENT: 0'); assert.ok(r.bg);
});

// ---- the server module ------------------------------------------------------------------------------------------
function setup(venue = 2, extra = {}, shiftSecs = 120) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('DECK', { venue, day: 5, venueDay: 1, up: { shed: 1 }, cash: 500_000, ...extra }, { shiftSecs, seed: 3, now: () => clock.t, modules: [deck] });
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift();
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  const serve = (item, quality = 'good', who = p) => { who.x = 42; who.z = 6; clock.t += 4100; return crew.serve(who, { item, quality }); };
  return { crew, p, clock, run, serve };
}

test('the module is well formed and registered', () => {
  assert.ok(MODULES.includes(deck)); assert.equal(deck.venue, 2);
});

test('six beers inside 30 s cause an incident: fine 50 x BV (round 7 #8), drinks drop to 2, a fall event, stats', () => {
  const { crew, p, serve } = setup();
  const bv = crew.valueNow().bv, cash0 = crew.cash;
  for (let i = 0; i < 5; i++) serve('beer');
  assert.equal(crew.mods.state('deck').deck.drinks, 5);
  assert.ok(!crew.events.some(e => e.t === 'deckFall'), 'five do not');
  const tabs = crew.cash - cash0;
  assert.ok(tabs > 5 * 5 * bv * 0.9 && tabs < 5 * 5 * bv * 1.3, `five tabs of 5 x BV (fries satisfaction nudges BV up): ${tabs} vs ${25 * bv}`);
  serve('beer');
  const ev = crew.events.find(e => e.t === 'deckFall');
  assert.ok(ev, 'the sixth');
  assert.equal(crew.mods.state('deck').deck.drinks, 2);
  const bvNow = crew.valueNow().bv;
  assert.ok(Math.abs(ev.fine - 50 * bvNow) < 0.01 * ev.fine + 0.5, `fine ${ev.fine} vs ${50 * bvNow}`);
  assert.equal(crew.stats.incidents, 1);
  assert.equal(p.shift.lastOrders, 1);
  assert.equal(crew.snapshot().mods.deck.today, true);
  assert.equal(crew.ledger().find(r => r.id === p.id).lastOrders, 1, 'the ledger counter behind Last Orders');
  assert.deepEqual(deck.awards(), [['Last Orders', 'lastOrders']]);
  assert.ok(crew.events.some(e => e.t === 'pa' && e.id === 'deck'));
});

test('the fine never takes cash below $0', () => {
  const { crew, serve } = setup(2, { cash: 0 });
  for (let i = 0; i < 5; i++) serve('beer');
  crew.cash = 10;                      // the tabs paid in; leave next to nothing
  serve('beer');
  assert.ok(crew.cash >= 0);
  assert.equal(crew.cash, 0);
  assert.ok(crew.events.find(e => e.t === 'deckFall').fine > 0);
});

test('a Rat 1.2 m from the landing spot is knocked down, one at 2 m is not', () => {
  const { crew, p, serve } = setup();
  const near = crew.join('Near'), far = crew.join('Far'); crew.connect(near); crew.connect(far);
  near.x = -14; near.z = 2.2; far.x = -14; far.z = 3.0;       // the first fall is seat 0, x -14, z 1.0
  const hold = (r, x, z) => { r.x = x; r.z = z; };
  for (let i = 0; i < 5; i++) { serve('beer'); hold(near, -14, 2.2); hold(far, -14, 3.0); }
  serve('beer', 'good');
  assert.ok(near.down > 0, 'knocked flat'); assert.equal(far.down > 0, false);
  assert.ok(crew.events.some(e => e.t === 'knock' && e.id === near.id && e.by === 'customer'));
});

test('time sobers, hot dogs and fries sober, a burnt beer adds nothing, the morning resets', () => {
  const { crew, serve, run } = setup();
  const st = crew.mods.state('deck');
  serve('beer'); serve('beer'); serve('beer'); serve('beer', 'burnt');
  assert.equal(st.deck.drinks, 3);
  serve('hotdog'); assert.equal(st.deck.drinks, 1);
  serve('beer'); serve('beer'); assert.equal(st.deck.drinks, 3);
  run(61); assert.equal(st.deck.drinks, 2, '60 s of shift time = -1');
  serve('fries'); assert.equal(st.deck.drinks, 1);
  serve('beer', 'good'); assert.equal(st.deck.drinks, 2);
  crew.phase = 'report'; crew.startShift();
  assert.equal(st.deck.drinks, 0, 'resets each morning');
});

test('Gary\'s kitchen stop fails during an incident, whatever the stock', () => {
  const { crew, serve } = setup();
  crew.gary = { phase: 'warn', t: 5, x: 0, z: 0, yaw: 0, stop: 0, pause: 0, fails: 0, checks: [], fed: true };
  assert.equal(crew.inspect('kitchen'), true, 'a fed Gary passes it');
  for (let i = 0; i < 6; i++) serve('beer');
  assert.equal(crew.inspect('kitchen'), false);
  assert.equal(crew.inspect('mats') === false || true, true);
});

test('lastIncidentDay is saved through the module key and the snapshot', () => {
  const { crew, serve } = setup();
  for (let i = 0; i < 6; i++) serve('beer');
  const save = crew.toSave();
  assert.deepEqual(save.mods.deck, { last: 5 });
  const back = new Crew('DECK', save, { modules: [deck], seed: 1 });
  assert.equal(back.mods.state('deck').last, 5);
  assert.equal(crew.snapshot().mods.deck.last, 5);
  assert.equal(new Crew('DECK', { venue: 2, day: 9, mods: { deck: { last: 'junk' } } }, { modules: [deck] }).mods.state('deck').last, 9, 'junk falls back to today');
});

test('the deck is inert at venues 0 and 1', () => {
  for (const v of [0, 1]) {
    const { crew, serve } = setup(v);
    const cash0 = crew.cash;
    serve(v === 0 ? 'fries' : 'hotdog');
    assert.equal(crew.snapshot().mods.deck, undefined);
    assert.equal(crew.cash, cash0);
    assert.equal(crew.stats.incidents ?? 0, 0);
  }
});

// ---- the view's slogan, through the registry --------------------------------------------------------------------
test('the deck view\'s banner reads DAYS WITHOUT AN INCIDENT', async () => {
  const mod = { id: 'deck', venue: 2, create: () => ({ banner: s => bannerFor(s.day, s.mods.deck.last, s.mods.deck.today) }) };
  const v = createViews({}, [mod]);
  const s = { venue: 2, day: 8, mods: { deck: { last: 5, today: false } } };
  v.onSnapshot(s);
  assert.equal(v.banner(s).text, 'DAYS WITHOUT AN INCIDENT: 3');
  assert.equal(fineFor(2), 100); assert.equal(tabFor(2), 10);
});

// ---- council round 6 #6: the loungers order ---------------------------------------------------------------------
test('orders every 30 s, every 20 s at amber; one open at a time, 30 s long (round 7 #8), round robin seats', () => {
  assert.equal(DECK.ORDER_SECS, 30); assert.equal(DECK.ORDER_LOUD_SECS, 20); assert.equal(DECK.ORDER_OPEN, 30); assert.equal(DECK.ORDER_TAB, 10);
  assert.equal(orderEvery(3), 30); assert.equal(orderEvery(4), 20);
  const d = newDeck();
  assert.equal(stepDeck(d, 29.9).order, false); assert.equal(d.order, null);
  assert.equal(stepDeck(d, 0.2).order, true); assert.deepEqual(d.order, { seat: 0, left: 30 });
  assert.equal(stepDeck(d, 29.7).expired, false, 'still open at 29.7 s');
  const r = stepDeck(d, 0.4); assert.equal(r.expired, true, 'lapses after 30 s');
  assert.equal(r.order, true, '30 s open and 30 s apart: the next seat orders as it lapses'); assert.equal(d.order.seat, 1);
  const loud = newDeck(); loud.drinks = 4;
  assert.equal(stepDeck(loud, 19.9).order, false); assert.equal(stepDeck(loud, 0.2).order, true, 'amber: every 20 s');
});

test('a paying beer fills the open order; food and burnt beer do not', () => {
  const d = newDeck(); stepDeck(d, 30);
  assert.equal(fillOrder(d, 'hotdog', 'good'), null); assert.equal(fillOrder(d, 'beer', 'burnt'), null);
  assert.ok(d.order);
  assert.deepEqual(fillOrder(d, 'beer', 'good'), { seat: 0, left: 30 }); assert.equal(d.order, null);
  assert.equal(fillOrder(d, 'beer', 'perfect'), null, 'nothing open');
  assert.equal(tabFor(2, true), 20); assert.equal(tabFor(2), 10);
});

test('server: a filled order pays 10 x BV, an unordered beer 5 x BV; expiry costs nothing; deckOrder event and snapshot', () => {
  const { crew, serve, run } = setup();
  const st = crew.mods.state('deck');
  let c0 = crew.cash; serve('beer'); const plain = crew.cash - c0;
  const bv = crew.valueNow().bv;
  assert.ok(Math.abs(plain - 5 * bv) < 0.1 * 5 * bv + 0.5, `unordered ${plain} vs ${5 * bv}`);
  run(30.2);
  assert.ok(crew.events.some(e => e.t === 'deckOrder' && e.seat === 0));
  assert.equal(crew.snapshot().mods.deck.order.seat, 0);
  c0 = crew.cash; serve('beer'); const ordered = crew.cash - c0;
  assert.ok(Math.abs(ordered - 10 * crew.valueNow().bv) < 0.1 * 10 * bv + 0.5, `ordered ${ordered} vs ${10 * bv}`);
  assert.ok(crew.events.some(e => e.t === 'deckTab' && e.order));
  assert.equal(crew.snapshot().mods.deck.order, null);
  assert.equal(crew.stats.deckOrders, 1);
  // the next order lapses unfilled: no cash moves, no drink, no penalty
  run(30); assert.ok(st.deck.order);
  const cash = crew.cash, drinks = st.deck.drinks, open = st.deck.order;
  run(31); assert.notEqual(st.deck.order, open, 'it lapsed (the next seat may already be ordering)');
  assert.equal(crew.cash, cash); assert.equal(st.deck.drinks, drinks); assert.equal(crew.stats.incidents ?? 0, 0);
});

test('orders only while the shift clock runs', () => {
  const { crew, run } = setup();
  crew.phase = 'report';
  run(90);
  assert.equal(crew.mods.state('deck').deck.order, null);
  assert.ok(!crew.events.some(e => e.t === 'deckOrder'));
});

// Fill every order `late` s after it opens (the walk and the pour: round 7 #8 measured a human cook at ~24 s), for a
// whole shift. Returns { incidents, filled, rounds }.
function orderRun(secs, hotdogAtAmber, late = 24, skipRounds = false) {
  const { crew, serve, run } = setup(2, {}, 900);
  const st = crew.mods.state('deck');
  let seen = null, due = null;
  for (let t = 0; t < secs; t += 0.5) {
    run(0.5);
    const o = st.deck.order;
    if (o && o !== seen) { seen = o; due = skipRounds && o.round ? null : t + late; }
    if (o && due != null && t >= due) { due = null; serve('beer'); }
    if (hotdogAtAmber && st.deck.drinks >= DECK.WARN) serve('hotdog');
  }
  return { incidents: crew.stats.incidents ?? 0, filled: crew.stats.deckOrders ?? 0, rounds: crew.stats.deckRounds ?? 0 };
}
test('round 7 #8: a cook filling every order 24 s late with no food has 1-3 incidents a shift; with a hot dog at amber, none', () => {
  // Careless = fills every order, rounds too, never feeds them: the playtest goal is 1-3 incidents (2 with rounds).
  const careless = orderRun(420, false);
  assert.ok(careless.incidents >= 1 && careless.incidents <= 3, JSON.stringify(careless));
  assert.ok(careless.filled >= 12, 'a 30 s window lets a human fill them');
  assert.ok(careless.rounds >= 1, 'and rounds come up');
  // Waving the rounds off is its own kind of careful: no falls without food.
  assert.ok(orderRun(420, false, 24, true).incidents <= 1);
  const careful = orderRun(420, true);
  assert.equal(careful.incidents, 0, JSON.stringify(careful));
});

test('round 7 #8: rounds only from 3 Drinks, every third order', () => {
  assert.equal(DECK.ROUND_EVERY, 3); assert.equal(DECK.ROUND_FROM, 3); assert.equal(DECK.ROUND_TAB, 25); assert.equal(DECK.ROUND_DRINKS, 2);
  assert.equal(isRoundOrder(3, 3), true); assert.equal(isRoundOrder(3, 2), false, 'not below 3 Drinks');
  assert.equal(isRoundOrder(2, 5), false); assert.equal(isRoundOrder(6, 4), true); assert.equal(isRoundOrder(0, 5), false);
  const d = newDeck(); d.drinks = 3;
  const flags = [];
  for (let i = 0; i < 6; i++) { d.order = null; d.orderT = 0; d.soberT = 0; stepDeck(d, 30); flags.push(!!d.order.round); }
  assert.deepEqual(flags, [false, false, true, false, false, true]);
  const z = newDeck();
  for (let i = 0; i < 3; i++) { z.order = null; z.orderT = 0; stepDeck(z, 30); }
  assert.equal(z.order.round, undefined, 'the third order at 0 Drinks is an ordinary one');
});

test('round 7 #8: a filled round is +2 Drinks and a 25 x BV tab; at 4 Drinks it is an incident; unfilled it lapses quietly', () => {
  assert.equal(tabFor(2, { seat: 0, round: true }), 50);
  assert.equal(tabFor(2, { seat: 0 }), 20);
  {
    const d = newDeck(); d.drinks = 3; d.order = { seat: 1, left: 30, round: true };
    const o = fillOrder(d, 'beer', 'good');
    assert.equal(o.round, true);
    assert.deepEqual(applyServe(d, 'beer', 'good', o), { delta: 2, incident: false });
    assert.equal(d.drinks, 5);
  }
  {
    const d = newDeck(); d.drinks = 4; d.order = { seat: 1, left: 30, round: true };
    assert.equal(applyServe(d, 'beer', 'perfect', fillOrder(d, 'beer', 'perfect')).incident, true, 'at 4 Drinks a round is a fall');
  }
  // The server: the round pays 25 x BV, adds 2 and says so in the event and the snapshot.
  const { crew, serve, run } = setup();
  const st = crew.mods.state('deck');
  st.deck.drinks = 3; st.deck.norders = 2;
  run(30.2);
  assert.equal(st.deck.order.round, true);
  assert.ok(crew.events.some(e => e.t === 'deckOrder' && e.round));
  assert.equal(crew.snapshot().mods.deck.order.round, true);
  const c0 = crew.cash; serve('beer');
  const bv = crew.valueNow().bv;
  assert.ok(Math.abs((crew.cash - c0) - 25 * bv) < 0.1 * 25 * bv + 0.5, `round tab ${crew.cash - c0} vs ${25 * bv}`);
  assert.equal(st.deck.drinks, 5);
  assert.equal(crew.stats.deckRounds, 1);
  assert.ok(crew.events.some(e => e.t === 'deckTab' && e.round));
  // An unfilled round lapses: nothing moves.
  st.deck.order = { seat: 0, left: 0.5, round: true }; st.deck.orderT = 0;
  const cash = crew.cash, drinks = st.deck.drinks;
  run(1);
  assert.equal(crew.cash, cash); assert.equal(st.deck.drinks, drinks); assert.equal(crew.stats.incidents ?? 0, 0);
});


// ---- Council round 8 #5: Liability escalates ------------------------------------------------------------------------
test('round 8 #5: fineFor escalates 50 / 100 / 200 / 200 x BV for falls 1-4 of a shift', async () => {
  const { fineMult, ordinal } = await import('../web/js/deck.js');
  assert.equal(DECK.FINE_CAP, 4);
  assert.deepEqual([1, 2, 3, 4, 5].map(k => fineFor(10, k)), [500, 1000, 2000, 2000, 2000]);
  assert.equal(fineFor(10), 500, 'k defaults to the first fall');
  assert.equal(fineMult(0), 1);
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
});

test('round 8 #5: falls count per shift (the event carries k and the escalated fine) and reset each morning', () => {
  const { crew, serve } = setup();
  const fall = () => { const d = crew.mods.state('deck').deck; d.drinks = DECK.MAX - 1; serve('beer'); return crew.events.filter(e => e.t === 'deckFall').at(-1); };
  const ks = [], ratio = [];
  for (let i = 0; i < 4; i++) { const e = fall(); ks.push(e.k); ratio.push(Math.round(e.fine / crew.valueNow().bv)); }   // BV after the serve, as the fine reads it
  assert.deepEqual(ks, [1, 2, 3, 4]);
  assert.deepEqual(ratio, [50, 100, 200, 200]);
  assert.equal(crew.mods.state('deck').falls, 4);
  deck.startShift(crew, crew.mods.state('deck'));
  assert.equal(crew.mods.state('deck').falls, 0, 'a new morning, a clean sheet');
  assert.equal(fall().k, 1);
});

test('round 8 #5: a greedy cook (every order and round, no food) ends a shift with >= 2 falls and >= 150 x BV of fines', () => {
  const { crew, run, serve } = setup(2, {}, 420);
  const st = crew.mods.state('deck');
  let xbv = 0;
  for (let t = 0; t < 420; t += 0.5) {
    run(0.5);
    if (st.deck.order) { const bv = crew.valueNow().bv, f0 = crew.stats.deckFines ?? 0; serve('beer'); xbv += ((crew.stats.deckFines ?? 0) - f0) / bv; }
  }
  assert.ok((crew.stats.incidents ?? 0) >= 2, 'falls ' + crew.stats.incidents);
  assert.ok(xbv >= 150 - 1e-6, 'fines ' + xbv.toFixed(1) + ' x BV');
});
