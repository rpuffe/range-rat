// The Stadium (council round 4, build item 7): the Ping Track, the lap gates, Crowd Sentiment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP, onTrack, cartSpeedAt } from '../web/js/map.js';
import { CROWD, gateAt, newLap, stepLap, stepSentiment, bump, pingDelta } from '../web/js/stadium.js';
import { Crew } from '../server/crew.mjs';
import { MODULES } from '../server/venues/index.mjs';
import stadium from '../server/venues/stadium.mjs';

const T = MAP.TRACK;
test('onTrack: the centreline and both edges are on, past them is off', () => {
  assert.ok(onTrack(T.x + T.a, T.z));                       // east end, centreline
  assert.ok(onTrack(T.x, T.z - T.b));                       // north
  assert.ok(onTrack(T.x + T.a + 2.4, T.z));                 // outer edge (w/2 = 2.5)
  assert.ok(onTrack(T.x + T.a - 2.4, T.z));                 // inner edge
  assert.ok(!onTrack(T.x + T.a + 2.7, T.z));
  assert.ok(!onTrack(T.x + T.a - 2.7, T.z));
  assert.ok(!onTrack(T.x, T.z), 'the infield is not the Track');
});

test('the Track is x1.3 only at venue 3+', () => {
  const x = T.x + T.a, z = T.z;
  assert.equal(cartSpeedAt(x, z, { venue: 3 }), 1.3);
  assert.equal(cartSpeedAt(x, z, { venue: 2 }), 1);
  assert.equal(cartSpeedAt(0, 0, { venue: 3 }), 1);
  assert.equal(cartSpeedAt(x, z, { venue: 0 }), 1);
});

test('gates: four quadrants by angle, -1 off the Track', () => {
  assert.equal(gateAt(T.x + T.a, T.z), 0);
  assert.equal(gateAt(T.x, T.z + T.b), 1);
  assert.equal(gateAt(T.x - T.a, T.z), 2);
  assert.equal(gateAt(T.x, T.z - T.b), 3);
  assert.equal(gateAt(0, 0), -1);
});

const run = (gates, dt = 4) => { const l = newLap(); let laps = 0; gates.forEach((g, i) => { if (stepLap(l, g, i * dt)) laps++; }); return laps; };
test('a lap needs all four gates in order, either direction, within 25 s', () => {
  assert.equal(run([0, 1, 2, 3, 0]), 1, 'clockwise');
  assert.equal(run([0, 3, 2, 1, 0]), 1, 'anticlockwise');
  assert.equal(run([2, 3, 0, 1, 2]), 1, 'from any gate');
  assert.equal(run([0, 1, 2, 3]), 0, 'three quarter-turns is not a lap');
  assert.equal(run([0, 1, 3, 2]), 0, 'across the oval restarts');
  assert.equal(run([0, 1, 2, 3, 0], 7), 0, '28 s is too slow');
  assert.equal(run([0, 1, 2, 3, 0], 6), 1, '24 s is fine');
  assert.equal(run([0, 1, 0, 1, 2, 3, 0]), 1, 'a wobble back over a line is ignored');
  assert.equal(run([0, 1, 2, 3, 0, 1, 2, 3, 0]), 2, 'the last gate starts the next lap');
  assert.equal(run([0, -1, 1, -1, 2, 3, 0]), 1, 'leaving the Track does not reset');
});

test('sentiment: decay, deltas, clamps', () => {
  assert.equal(stepSentiment(0.5, 420), 0, 'empty in about 400 s');
  assert.ok(Math.abs(stepSentiment(0.5, 1) - 0.4988) < 1e-9);
  assert.equal(bump(0.95, 0.16), 1);
  assert.equal(pingDelta(false, 'boost'), 0.08);
  assert.equal(pingDelta(true, 'boost'), 0.16);
  assert.ok(Math.abs(pingDelta(true, 'jackpot') - 0.26) < 1e-9);
});

function stadiumCrew(venue = 3) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('STAD', { venue, day: 5, venueDay: 1, up: { shed: 1, cart: 1 } }, { shiftSecs: 120, seed: 5, now: () => clock.t, modules: [stadium] });
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift();
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, p, run, st: crew.mods.state('stadium') };
}

test('registered in MODULES at venue 3', () => assert.ok(MODULES.includes(stadium) && stadium.venue === 3));

test('the server module: starts at 0.5, decays, pings pay more on the Track, knockdowns cap at 10', () => {
  const { crew, p, run, st } = stadiumCrew();
  assert.equal(crew.mods.kpi(), 0.5);
  run(10);
  assert.ok(Math.abs(st.s - (0.5 - 0.012)) < 0.01, 'decayed about 0.0012/s');
  const s0 = st.s;
  crew.cart.x = 0; crew.cart.z = 0;
  const b = { by: p.id };
  stadium.ping(crew, st, b, { prize: 'boost', n: 0, cart: crew.cart });
  assert.ok(Math.abs(st.s - s0 - 0.08) < 1e-9, 'off the Track: +0.08');
  crew.cart.x = T.x + T.a; crew.cart.z = T.z;
  const s1 = st.s;
  stadium.ping(crew, st, b, { prize: 'boost', n: 0, cart: crew.cart });
  assert.ok(Math.abs(st.s - s1 - 0.16) < 1e-9, 'on the Track: +0.16');
  st.s = 0;
  for (let i = 0; i < 15; i++) crew.knockDown(p, 'cart');
  assert.ok(Math.abs(st.s - 0.2) < 1e-9, 'ten knockdowns of +0.02, the rest are free');
  assert.equal(st.knocks, 15);
  assert.ok(crew.events.some(e => e.t === 'crowd' && e.kind === 'knock'));
  crew.mods.signal('target', {});
  assert.ok(Math.abs(st.s - 0.26) < 1e-9, 'a TARGET! is +0.06');
  assert.equal(crew.snapshot().mods.stadium.knocks, 15);
});

test('laps are read off the driven cart\'s pose and pay +0.1', () => {
  const { crew, p, run, st } = stadiumCrew();
  crew.cart.driver = p.id;
  const lap = [[T.a, 0], [0, T.b], [-T.a, 0], [0, -T.b], [T.a, 0]];   // the whole oval, back to the start gate
  st.s = 0.3;
  for (const [dx, dz] of lap) { crew.cart.x = T.x + dx; crew.cart.z = T.z + dz; run(2); }
  assert.equal(st.laps, 1);
  assert.ok(st.s > 0.3 + 0.05 - 0.0025 * 8 - 0.001);
  crew.cart.driver = null; run(1);
  assert.equal(st.lap.n, 0, 'a parked cart resets the lap');
});

test('the module is idle off-shift and below venue 3', () => {
  const { crew } = stadiumCrew(2);
  assert.equal(crew.snapshot().mods.stadium, undefined);
});
