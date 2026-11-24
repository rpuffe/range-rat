// The Stadium (council round 4, build item 7): the Ping Track, the lap gates, Crowd Sentiment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAP, onTrack, cartSpeedAt } from '../web/js/map.js';
import { CROWD, gateAt, newLap, stepLap, stepSentiment, bump, pingDelta } from '../web/js/stadium.js';
import { Crew } from '../server/crew.mjs';
import { MODULES } from '../server/venues/index.mjs';
import stadium from '../server/venues/stadium.mjs';
import { RALLY_LINES } from '../web/js/rally.js';

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

// ---- round 7 #7: the crowd remembers, and the Two-Minute Warning ------------------------------------------------------
test('windowMean over a partial and a full (wrapped) buffer', async () => {
  const { newWindow, pushSample, windowMean } = await import('../web/js/stadium.js');
  assert.equal(CROWD.WINDOW, 120);
  const w = newWindow();
  assert.equal(windowMean(w), null);
  pushSample(w, 0.2); pushSample(w, 0.4);
  assert.ok(Math.abs(windowMean(w) - 0.3) < 1e-12, 'the mean so far');
  for (let i = 0; i < 120; i++) pushSample(w, 1);
  assert.equal(w.a.length, 120);
  assert.equal(windowMean(w), 1, 'the oldest samples roll off');
  for (let i = 0; i < 60; i++) pushSample(w, 0);
  assert.ok(Math.abs(windowMean(w) - 0.5) < 1e-12);
});

// A 4P Stadium day (420 s), cart 0 driven round the Track during `windows` (seconds of shift).
function lapShift(windows, seed = 1) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('STD7', { day: 24, venue: 3, venueDay: 2, stamps: 1, up: { shed: 3, washer: 3, cart: 2, helpers: 4, ads: 3, amen: 2 } }, { seed, now: () => clock.t });
  const rats = [0, 1, 2, 3].map(i => { const p = crew.join('R' + i); crew.connect(p); p.x = 27 + i; p.z = 9; return p; });
  crew.startShift();
  const c = crew.carts[0], ev = [];
  let th = 0;
  while (crew.phase === 'shift' && crew.shiftT < crew.shiftSecs - 0.1) {
    const t = crew.shiftT, on = windows.some(([a, b]) => t >= a && t < b);
    if (on) { if (!c.driver) c.driver = rats[0].id; th += 14.3 * 0.05 / 24.2; c.x = T.x + T.a * Math.cos(th); c.z = T.z + T.b * Math.sin(th); c.v = 14.3; }
    else if (c.driver) { c.driver = null; c.v = 0; }
    clock.t += 50;
    for (const p of rats) { p.seenAt = clock.t; p.movedAt = clock.t; }
    crew.tick(0.05);
    ev.push(...crew.flush().ev.map(e => ({ ...e, at: crew.shiftT })));
  }
  return { crew, ev, kpi: crew.mods.kpi() };
}

test('a seeded shift: no laps fails; 60 s of laps at Last Call fails; 60 s right after the warning passes', () => {
  const S = 420;
  assert.ok(lapShift([]).kpi < 0.3);
  assert.ok(lapShift([[S - 60, S]]).kpi < 0.5);
  const { crew, kpi } = lapShift([[S - 120, S - 60]]);
  assert.ok(kpi >= 0.5, `graded ${kpi}`);
  const snap = crew.snapshot().mods.stadium;
  assert.ok(snap.s != null && snap.k != null && snap.s !== snap.k, 'the snapshot carries the live s and the graded k');
  assert.equal(snap.k, Math.round(kpi * 1000) / 1000);
});

test('the Two-Minute Warning: one lastcall at T-120 (warning, read off the live crowd), none at T-60, the Board banner flag', () => {
  const { crew, ev } = lapShift([]);
  const lc = ev.filter(e => e.t === 'lastcall');
  assert.equal(lc.length, 1);
  assert.ok(lc[0].warning);
  assert.ok(Math.abs(lc[0].at - (crew.shiftSecs - 120)) < 0.2, `at ${lc[0].at}`);
});

test('the snapshot raises w between the warning and Last Call only', () => {
  const { crew, run } = stadiumCrew();
  crew.venueDay = 2; crew.shiftSecs = 300;
  crew.shiftT = 300 - 121; run(0.5);
  assert.equal(crew.snapshot().mods.stadium.w, undefined);
  crew.shiftT = 300 - 119.5; run(0.5);
  assert.equal(crew.snapshot().mods.stadium.w, 1);
  crew.shiftT = 300 - 59; run(0.2);
  assert.equal(crew.snapshot().mods.stadium.w, undefined, 'Last Call takes the Board');
});

test('playthrough 3 #1: the Stadium\'s first day gets the Two-Minute Warning too, once the reveal is over', () => {
  const { crew, run } = stadiumCrew();
  crew.venueDay = 1;                                 // (startShift counted the morning: this is its first day)
  crew.shiftSecs = 300; crew.shiftT = 300 - 121; run(0.5);
  assert.equal(crew.events.filter(e => e.t === 'lastcall').length, 0, 'not before T-120');
  crew.revealT = 2; crew.shiftT = 300 - 119;
  assert.equal(crew.warnDue(), false, 'not during the reveal');
  crew.revealT = 0; run(0.2);
  const lc = crew.events.filter(e => e.t === 'lastcall');
  assert.equal(lc.length, 1); assert.ok(lc[0].warning);
  crew.shiftT = 300 - 59; run(0.2);
  assert.equal(crew.events.filter(e => e.t === 'lastcall').length, 1, 'Last Call rings with no second line');
});

test('playthrough 3 #2: the T-30 re-check reads the live crowd; live fine but graded short says "Keep lapping!"', () => {
  const { crew, run, st } = stadiumCrew();
  crew.venueDay = 2; crew.shiftSecs = 300;
  crew.fixtures = Object.fromEntries(Object.keys(crew.fixtures).map(k => [k, 0]));   // Upkeep clean: only the crowd counts
  st.win.a = Array(120).fill(0.2); st.win.i = 0;     // the graded mean is short (from before the bell: no slip line)...
  st.s = 1;                                          // ...but the Rats are lapping at 100% live
  crew.shiftT = 300 - 60; run(0.2);
  crew.events.length = 0;
  crew.shiftT = 300 - 30.1; run(0.3);
  const r = crew.events.filter(e => e.t === 'rally');
  assert.equal(r.length, 1);
  assert.equal(r[0].need, RALLY_LINES.keepLapping);
  assert.equal(Object.values(r[0].needs)[0], RALLY_LINES.keepLapping);
  // Live crowd bored too: the old line.
  const b = stadiumCrew();
  b.crew.venueDay = 2; b.crew.shiftSecs = 300;
  b.st.win.a = Array(120).fill(0.2); b.st.win.i = 0; b.st.s = 0.3;
  b.crew.shiftT = 300 - 60; b.run(0.2);
  b.crew.events.length = 0;
  b.crew.shiftT = 300 - 30.1; b.run(0.3);
  assert.equal(b.crew.events.find(e => e.t === 'rally')?.need, RALLY_LINES.gauge[3]);
});
