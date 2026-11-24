// Council round 6 #3: the Closing Bell. shortfall() names the single biggest thing the crew is short of at Last Call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { shortfall, RALLY_LINES, GAUGE_MISS } from '../web/js/rally.js';

const clean = { sign: 0, stand: 0, mat0: 0, mat1: 0 };
const val = (upkeep, extra = {}) => ({ bv: upkeep, rate: 1, curb: 1, pond: null, fries: null, ...extra });

test('only the gauge short: the venue\'s line', () => {
  assert.equal(shortfall({ value: val(2.5), quota: { q: 0.5 }, kpi: 0.4, fixtures: clean, venue: 2 }), RALLY_LINES.gauge[2]);
  assert.equal(shortfall({ value: val(2.5), quota: { q: 0.5 }, kpi: 0.2, fixtures: clean, venue: 3 }), 'The crowd is bored. Lap the Track!');
  assert.equal(shortfall({ value: val(2.5), quota: { q: 0.5 }, kpi: 0.49, fixtures: clean, venue: 4 }), 'Strays in the Yards. Go get them!');
  assert.equal(shortfall({ value: val(2.5), quota: { q: 0.5 }, kpi: 0, fixtures: clean, venue: 5 }), 'Debris overhead. Ride the Lift!');
});

test('only the mats dirty: the mats line; a filthy sign: the sign line', () => {
  const mats = { ...clean, mat0: 0.9, mat1: 0.8 };
  assert.equal(shortfall({ value: val(1.2, { curb: 0.6 }), quota: { q: 0.3 }, fixtures: mats }), RALLY_LINES.mats);
  assert.equal(shortfall({ value: val(1.2, { curb: 0.6 }), quota: { q: 0.3 }, fixtures: { ...clean, sign: 0.9 } }), RALLY_LINES.sign);
});

test('under target: low fries or a murky pond, when it costs the most', () => {
  const v = val(1.5, { curb: 0.95, fries: 0.1, pond: 0.9 });
  assert.equal(shortfall({ value: v, quota: { q: 0.8 }, fixtures: { ...clean, mat0: 0.1 }, venue: 1 }), RALLY_LINES.fries);
  const p = val(1.5, { curb: 0.95, fries: 0.9, pond: 0.2 });
  assert.equal(shortfall({ value: p, quota: { q: 0.8 }, fixtures: { ...clean, mat0: 0.1 }, venue: 1 }), RALLY_LINES.pond);
});

test('all met: the on-target line', () => {
  assert.equal(shortfall({ value: val(1.5), quota: { q: 0.3 }, fixtures: clean }), 'On target. Hold it till the bell.');
  assert.equal(shortfall({ value: val(2.6), quota: { q: 0.5 }, kpi: 0.5, fixtures: clean, venue: 2 }), RALLY_LINES.onTarget);
});

test('endless, or no review today: null', () => {
  assert.equal(shortfall({ value: val(1), quota: null, fixtures: clean, endless: true }), null);
  assert.equal(shortfall({ value: val(1), quota: { q: 0.3 }, kpi: 0, fixtures: clean, venue: 5, endless: true }), null);
  assert.equal(shortfall({ value: val(1), quota: null, fixtures: clean }), null);
});

test('every line is 8 words or fewer', () => {
  const lines = [...Object.values(RALLY_LINES.gauge), ...Object.values(RALLY_LINES).filter(l => typeof l === 'string'), ...Object.values(GAUGE_MISS)];
  assert.ok(lines.length >= 13);
  for (const l of lines) assert.ok(l.split(/\s+/).length <= 8, l);
});

// ---- the lastcall event ---------------------------------------------------------------------------------------
function runShift(save) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('RALY', save, { shiftSecs: 100, seed: 9, now: () => clock.t });
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  const ev = [];
  while (crew.phase === 'shift') { clock.t += 50; crew.tick(0.05); ev.push(...crew.flush().ev); }
  return { crew, lastcalls: ev.filter(e => e.t === 'lastcall') };
}

test('the lastcall event carries need and fires once a shift', () => {
  const { lastcalls } = runShift({ day: 2 });
  assert.equal(lastcalls.length, 1);
  assert.equal(lastcalls[0].need, RALLY_LINES.mats, 'the morning mud: the mats are the dirtiest fixture');
});

test('no lastcall on day 1; endless rings it with no line', () => {
  assert.equal(runShift({ day: 1 }).lastcalls.length, 0);
  const e = runShift({ day: 40, endless: true }).lastcalls;
  assert.equal(e.length, 1, 'the horn still rings');
  assert.equal(e[0].need, null);
});

test('playtest 2: the Last Call line reads the gauge ahead of the rush at Tiered', async () => {
  const { RALLY_MARGIN, RALLY_LINES: L } = await import('../web/js/rally.js');
  const { Crew } = await import('../server/crew.mjs');
  const crew = new Crew('RLY', { venue: 2, day: 12, venueDay: 1, up: { shed: 1 } }, { shiftSecs: 120, seed: 3, now: () => 1 });
  crew.join('A'); crew.startShift();
  crew.mods.kpi = () => 0.6;                       // over the tick now, but the rush will fill the cups
  assert.ok(RALLY_MARGIN[2] >= 0.2);
  assert.equal(crew.rallyNeed(), L.gauge[2], 'warns before the rush instead of "On target"');
  crew.mods.kpi = () => 0.9;
  assert.notEqual(crew.rallyNeed(), L.gauge[2]);
});
