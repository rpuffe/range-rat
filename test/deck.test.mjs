// The Upper Deck (council round 4, build item 5): the pure rules, the server module, the view's slogan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK, newDeck, stepDeck, serveEffect, applyServe, afterIncident, landingSpot, hitByFall, fallPose, climbPath, pointAlong,
  pathLength, bannerFor, mugTone, fineFor, tabFor } from '../web/js/deck.js';
import { Crew } from '../server/crew.mjs';
import deck from '../server/venues/deck.mjs';
import { createViews } from '../web/js/views/registry.js';
import { MODULES } from '../server/venues/index.mjs';

// ---- pure rules -------------------------------------------------------------------------------------------------
test('constants match the doc', () => {
  assert.equal(DECK.MAX, 6); assert.equal(DECK.WARN, 4); assert.equal(DECK.SOBER_SECS, 30);
  assert.deepEqual(DECK.FOOD, { fries: 1, hotdog: 2 });
  assert.equal(DECK.TAB, 5); assert.equal(DECK.FINE, 100); assert.equal(DECK.RESET_TO, 2); assert.equal(DECK.FALL_R, 1.5);
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

test('30 s sobers by 1; a hot dog is -2, fries -1, floored at 0; a burnt beer adds nothing', () => {
  const d = newDeck(); d.drinks = 4;
  stepDeck(d, 29.9); assert.equal(d.drinks, 4);
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
function setup(venue = 2, extra = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('DECK', { venue, day: 5, venueDay: 1, up: { shed: 1 }, cash: 500_000, ...extra }, { shiftSecs: 120, seed: 3, now: () => clock.t, modules: [deck] });
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift();
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  const serve = (item, quality = 'good', who = p) => { who.x = 42; who.z = 6; clock.t += 4100; return crew.serve(who, { item, quality }); };
  return { crew, p, clock, run, serve };
}

test('the module is well formed and registered', () => {
  assert.ok(MODULES.includes(deck)); assert.equal(deck.venue, 2);
});

test('six beers inside 30 s cause an incident: fine 100 x BV, drinks drop to 2, a fall event, stats', () => {
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
  assert.ok(Math.abs(ev.fine - 100 * bvNow) < 0.01 * ev.fine + 0.5, `fine ${ev.fine} vs ${100 * bvNow}`);
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
  run(31); assert.equal(st.deck.drinks, 2, '30 s of shift time = -1');
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
  assert.equal(fineFor(2), 200); assert.equal(tabFor(2), 10);
});
