// Council round 13 #0 (builder 4): the shared calls tally, the policy loader's flags, the shift caps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CallTally, eventCall, summarise, MERGE } from '../scripts/bots/calls.mjs';
import { wanted } from '../scripts/bots/policies.mjs';
import { parseCaps, stuckLine } from '../scripts/bots/snap.mjs';

const fakeCrew = (o = {}) => ({ phase: 'shift', venue: 1, venueDay: 4, day: 8, endless: false, events: [], fixtures: {}, basket: { n: 12 }, perks: {}, fries: 30, working: () => true, ...o });

test('§1.4: which events are calls', () => {
  assert.equal(eventCall({ t: 'crowd', kind: 'req' }), 'request');
  assert.deepEqual(eventCall({ t: 'crowd', kind: 'stretch', n: 3 }), ['stretch', 3]);
  assert.equal(eventCall({ t: 'inspect', phase: 'start' }), 'inspector');
  assert.equal(eventCall({ t: 'inspect', phase: 'done' }), null);
  assert.equal(eventCall({ t: 'treasure', phase: 'sunk' }), 'treasure');
  assert.equal(eventCall({ t: 'gary', phase: 'warn' }), 'gary');
  assert.equal(eventCall({ t: 'garyIntro', phase: 'wave' }), null);
  assert.equal(eventCall({ t: 'rally' }), 'deal');
  assert.equal(eventCall({ t: 'mower', boss: true, phase: 'hunt' }), 'boss');
  assert.equal(eventCall({ t: 'mower', phase: 'home' }), null);
  assert.equal(eventCall({ t: 'rest', kind: 'gold' }), null, 'special balls coming to rest are not calls');
  assert.deepEqual(eventCall({ t: 'tourney', call: 'member', n: 2 }), ['member', 2], 'a module marks its own calls');
});

test('repeats inside 8 s merge; deck orders are one job per 30 s; a Stretch counts every section', () => {
  const c = new CallTally(4), crew = fakeCrew();
  const at = (secs, ev) => { crew.events = ev; c.step(crew, secs); };
  at(1, [{ t: 'rally' }]); at(MERGE - 2, [{ t: 'rally' }]); at(3, [{ t: 'rally' }]);   // t 1, 7 (merged), 10
  at(1, [{ t: 'deckOrder' }]); at(20, [{ t: 'deckOrder' }]); at(15, [{ t: 'deckOrder' }]);
  at(1, [{ t: 'crowd', kind: 'stretch', n: 3 }]);
  const r = c.endShift(crew);
  assert.equal(r.kinds.deal, 2);
  assert.equal(r.kinds.deckOrder, 2);
  assert.equal(r.kinds.stretch, 3);
  assert.equal(r.venue, 'Club');
});

test('states count on the edge; the morning\'s empty basket is not a call', () => {
  const c = new CallTally(1), crew = fakeCrew({ basket: { n: 0 }, fixtures: { sign: 0.6 }, perks: { shed: 1 }, fries: 5 });
  c.step(crew, 1); c.step(crew, 20);
  let r = c.endShift(crew);
  assert.equal(r.kinds.basket, undefined);
  assert.equal(r.kinds.wash, 1);
  assert.equal(r.kinds.fries, 1);
  crew.basket.n = 12; c.step(crew, 1); crew.basket.n = 1; c.step(crew, 1);
  r = c.endShift(crew);
  assert.equal(r.kinds.basket, 1, 'a basket that runs low after the fill is a call');
});

test('the venue is the one the shift started at (a Promotion Day promotes mid-shift); r8 drops the new kinds', () => {
  const c = new CallTally(4), crew = fakeCrew({ venue: 2, venueDay: 3 });
  crew.events = [{ t: 'gary', phase: 'warn' }, { t: 'mower', boss: true, phase: 'warn' }]; c.step(crew, 60);
  crew.events = [{ t: 'mower', boss: true, phase: 'hunt' }]; c.step(crew, 60);
  crew.venue = 3;
  const r = c.endShift(crew);
  assert.equal(r.venue, 'Tiered');
  assert.equal(r.n, 3); assert.equal(r.r8, 1);
  assert.equal(r.perMin, 1.5);
  const t = summarise([r, { ...r, venue: 'Club', vd: 4 }]);
  assert.ok(t.some(x => x.venue === 'Club d4+'));
});

test('policy flags map to policy files', () => {
  assert.deepEqual(wanted({ TOURNEY: '1', WHISTLE: 'aim', BUY: '0', POLICY: 'x,tourney' }).map(w => w.name), ['tourney', 'whistle', 'x']);
  assert.deepEqual(wanted({}), []);
});

test('shift caps parse, and a stuck crew names its stuck goal', () => {
  assert.deepEqual(parseCaps('0:8,3:6'), { 0: 8, 3: 6 });
  const line = stuckLine({ venue: 3, endless: false, goalRows: () => [{ id: 'requests', have: 0, need: 6 }, { id: 'pings', done: true }] }, 6);
  assert.equal(line, 'stuck at Stadium on requests 0/6 after 6 shifts');
});
