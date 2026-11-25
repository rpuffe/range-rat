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
  assert.equal(shortfall({ value: val(2.5), quota: { q: 0.5 }, kpi: 0, fixtures: clean, venue: 5 }), 'Debris overhead. Everyone up the Lift!');
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
  // Owner playtest 3 §3.1: yesterday's mats come back capped at 0.6 (the save's fixtures).
  const mud = Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['mat' + i, 0.8]));
  const { lastcalls } = runShift({ day: 2, fixtures: mud });
  assert.equal(lastcalls.length, 1);
  assert.equal(lastcalls[0].need, RALLY_LINES.mats, 'yesterday’s mud: the mats are the dirtiest fixture');
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
  crew.mods.kpi = () => 1;                         // round 8 #1: the Glow Rush margin is 0.5: only empty cups are safe
  assert.notEqual(crew.rallyNeed(), L.gauge[2]);
});

test('round 7 #5: the Orbital has no review, so its line is the debris or nothing', () => {
  assert.equal(shortfall({ value: val(1), quota: null, kpi: 0.2, fixtures: clean, venue: 5 }), 'Debris overhead. Everyone up the Lift!');
  assert.equal(shortfall({ value: val(1), quota: null, kpi: 0.8, fixtures: clean, venue: 5 }), null);
  assert.equal(shortfall({ value: val(1), quota: null, kpi: 0.2, fixtures: clean, venue: 5, endless: true }), null);
  assert.equal(shortfall({ value: val(1), quota: null, kpi: 0.2, fixtures: clean, venue: 4 }), null, 'elsewhere no quota still means no line');
});

test('round 7 #7: the Stadium rallies at T-120 once (from its day 2); other venues at T-90 (owner playtest 3 §2)', async () => {
  const { RALLY_AT, rallyAt } = await import('../web/js/rally.js');
  assert.deepEqual({ ...RALLY_AT }, { 3: 120 });
  assert.equal(rallyAt(3), 120); assert.equal(rallyAt(2), 90); assert.equal(rallyAt(4), 90);
  const at = save => {
    const clock = { t: 1_000_000 };
    const crew = new Crew('RAL7', save, { shiftSecs: 200, seed: 9, now: () => clock.t });
    crew.startShift();
    const out = [];
    while (crew.phase === 'shift') { clock.t += 50; crew.tick(0.05); for (const e of crew.flush().ev) if (e.t === 'lastcall') out.push(Math.round(crew.shiftSecs - crew.shiftT)); }
    return out;
  };
  assert.deepEqual(at({ day: 20, venue: 3, venueDay: 2 }), [120]);
  assert.deepEqual(at({ day: 20, venue: 2, venueDay: 2 }), [90]);
  assert.deepEqual(at({ day: 20, venue: 4, venueDay: 2 }), [90]);
});

// ---- Round 7 #4: dealt jobs ---------------------------------------------------------------------------------------
test('round 7 #4: shortfalls() ranks the gauge first, then each Upkeep term by cost; its head is shortfall()', async () => {
  const { shortfalls, JOB_AT, gaugeAt } = await import('../web/js/rally.js');
  const fx = { sign: 0.6, stand: 0.2, mat0: 0.9, mat1: 0.9, mat2: 0.5 };
  const args = { value: val(1.2, { fries: 0.7, pond: null }), quota: { q: 0.6 }, kpi: 0.3, fixtures: fx, venue: 2, cups: [3, 20, 5] };
  const list = shortfalls(args);
  assert.deepEqual(list.map(j => j.id), ['gauge', 'mats', 'fries', 'sign', 'stand']);
  assert.deepEqual(list[0].at, gaugeAt(2, [3, 20, 5]), 'the worst bowl: B');
  assert.equal(list[0].at.x, 26);
  assert.deepEqual(list[1].at, JOB_AT.mats);
  assert.equal(list[0].line, shortfall(args));
  // terms under 0.01 are left out
  const tiny = shortfalls({ value: val(1.2), quota: { q: 0.6 }, fixtures: { sign: 0.01, mat0: 0.5, mat1: 0 } });
  assert.deepEqual(tiny.map(j => j.id), ['mats']);
  // a short gauge with Upkeep on target still deals the real Upkeep terms to the rest of the crew
  assert.deepEqual(shortfalls({ value: val(2.6), quota: { q: 0.5 }, kpi: 0.2, fixtures: { sign: 0.5, mat0: 0, mat1: 0 }, venue: 3 }).map(j => j.id), ['gauge', 'sign']);
  assert.deepEqual(shortfalls({ value: val(2.6), quota: { q: 0.5 }, kpi: 0.9, fixtures: { sign: 0.5, mat0: 0, mat1: 0 }, venue: 3 }), [], 'both on target: nothing to deal');
  // the head always matches the single line (500 seeded cases)
  let s = 7; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 500; i++) {
    const a = { value: val(1 + r(), { fries: r() < 0.5 ? null : r(), pond: r() < 0.5 ? null : r() }), quota: { q: r() }, kpi: r(),
      fixtures: { sign: r(), stand: r(), mat0: r(), mat1: r() }, venue: [2, 3, 4][(r() * 3) | 0] };
    assert.equal(shortfalls(a)[0]?.line ?? RALLY_LINES.onTarget, shortfall(a), JSON.stringify(a));
  }
});

test('round 7 #4: dealJobs: 4 Rats and 2 jobs is 2 + 1 + 1, nearest first; on target, everyone; solo, the top line; 6 Rats', async () => {
  const { dealJobs } = await import('../web/js/rally.js');
  const A = { line: 'Hose the mats before the bell!', at: { x: 0, z: 3.5 } }, B = { line: 'The sign is filthy. Hose it!', at: { x: 14, z: 11 } };
  const rats = [{ id: 'r1', x: 1, z: 3 }, { id: 'r2', x: 13, z: 10 }, { id: 'r3', x: -2, z: 4 }, { id: 'r4', x: 40, z: 0 }];
  const d = dealJobs([A, B], rats);
  assert.equal(d.r1, A.line); assert.equal(d.r3, A.line, 'the biggest job: the 2 nearest');
  assert.equal(d.r2, B.line, 'the next job: the nearest undealt Rat');
  assert.equal(d.r4, B.line, 'round the other jobs again: the biggest keeps its half');
  assert.deepEqual(dealJobs([], rats), { r1: RALLY_LINES.onTarget, r2: RALLY_LINES.onTarget, r3: RALLY_LINES.onTarget, r4: RALLY_LINES.onTarget });
  assert.deepEqual(dealJobs([A, B], [{ id: 'solo', x: 14, z: 11 }]), { solo: A.line }, 'solo: the top line, wherever you stand');
  const C = { line: 'Fries are low. Cook!', at: { x: 42, z: 6 } };
  const six = dealJobs([A, B, C], Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, x: i * 8, z: 5 })));
  const count = l => Object.values(six).filter(x => x === l).length;
  assert.equal(Object.keys(six).length, 6);
  assert.equal(count(A.line), 3, 'ceil(6/2) on the biggest');
  assert.deepEqual([count(B.line), count(C.line)], [2, 1], 'every job gets a Rat, then round again');
  for (const l of [A, B, C].map(j => j.line)) assert.ok(l.split(/\s+/).length <= 8, l);
});

test('round 7 #4: the lastcall event carries needs per online Rat, and need (the top line) for old clients', () => {
  const clock = { t: 1_000_000 };
  const crew = new Crew('RALZ', { day: 2 }, { shiftSecs: 100, seed: 9, now: () => clock.t });
  const a = crew.join('A'); crew.connect(a); const b = crew.join('B'); crew.connect(b);
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  crew.fixtures.sign = 1; for (const k of Object.keys(crew.fixtures)) if (k.startsWith('mat')) crew.fixtures[k] = 0.9;
  a.x = 0; a.z = 3; b.x = 14; b.z = 11;
  const ev = [];
  while (crew.phase === 'shift') { clock.t += 50; crew.tick(0.05); a.x = 0; a.z = 3; b.x = 14; b.z = 11; ev.push(...crew.flush().ev); }
  const lc = ev.find(e => e.t === 'lastcall');
  assert.equal(lc.need, RALLY_LINES.mats);
  assert.deepEqual(Object.keys(lc.needs).sort(), [a.id, b.id].sort());
  assert.equal(lc.needs[a.id], RALLY_LINES.mats, 'the nearest Rat gets the biggest job');
  assert.equal(lc.needs[b.id], RALLY_LINES.sign, 'the other gets the next one');
});

// ---- Council round 8 ----------------------------------------------------------------------------------------------
test('round 8: every Rat kept its line and a new job opens: it goes to a Rat, never to nobody', async () => {
  const { dealJobs } = await import('../web/js/rally.js');
  const G = { id: 'gauge', line: RALLY_LINES.gauge[2], loss: 1, at: { x: 0, z: -60 } };
  const M = { id: 'mats', line: RALLY_LINES.mats, loss: 0.2, at: { x: 0, z: 3.5 } };
  const S = { id: 'sign', line: RALLY_LINES.sign, loss: 0.05, at: { x: 14, z: 13 } };
  const rats = [{ id: 'a', x: 0, z: 3 }, { id: 'b', x: 14, z: 13 }];
  const prev = { a: M.line, b: S.line };
  assert.deepEqual(dealJobs([M, S], rats, undefined, prev), prev, 'nothing new: everyone keeps their line');
  // The gauge goes short at the re-check: the holder of the lowest-ranked job (the sign, closest to done) takes it.
  assert.deepEqual(dealJobs([G, M, S], rats, undefined, prev), { a: M.line, b: G.line });
  // Doubled up: the new job takes the nearest Rat off the doubled job, and the single holder keeps theirs.
  const three = [...rats, { id: 'c', x: 0, z: -20 }];
  assert.deepEqual(dealJobs([G, M, S], three, undefined, { a: M.line, b: S.line, c: M.line }), { a: M.line, b: S.line, c: G.line });
  // A new job ranked below every held one stays undealt (as with more jobs than Rats).
  const F = { id: 'fries', line: RALLY_LINES.fries, loss: 0.01, at: { x: 40, z: 6 } };
  assert.deepEqual(dealJobs([M, S, F], rats, undefined, prev), prev);
});

test('round 8 #1: at Tiered the Last Call line is the Glow Rush at a gauge of 0.6, and its miss line', () => {
  assert.equal(RALLY_LINES.gauge[2], 'Glow rush! Shoot before they leave!');   // owner playtest 3 §2
  assert.equal(GAUGE_MISS[2], 'Missed: the bowls were full at 1:00.');
  const clock = { t: 1 };
  const crew = new Crew('RLG', { venue: 2, day: 12, venueDay: 1, up: { shed: 1 } }, { shiftSecs: 120, seed: 3, now: () => clock.t });
  crew.join('A'); crew.startShift();
  crew.mods.kpi = () => 0.6;
  assert.equal(crew.rallyNeed(), 'Glow rush! Shoot before they leave!');
});

// ---- council round 10 #2/#5: the Club's dusk always deals jobs ------------------------------------------------------
test("the Club deals jobs at T-90 when on target: fries for the bell, glow in the creek; never 'hold it' with a job open", () => {
  const clock = { t: 1_000_000 };
  const crew = new Crew('RALY', { venue: 1, day: 6, venueDay: 1, up: { shed: 1 } }, { shiftSecs: 600, seed: 9, now: () => clock.t });
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
  const a = crew.join('A'), b = crew.join('B'); crew.connect(a); crew.connect(b);
  a.x = 40; a.z = 5; b.x = 15; b.z = -95;
  crew.quota = { q: 0 };   // on target
  crew.fries = 4;          // the fryer at 20%
  for (let i = 0; i < 5; i++) { const s = crew.addBall({ x: 18 + i, y: -0.89, z: -99, vx: 0, vy: 0, vz: 0, kind: 'glow' }); s.rest = true; s.creek = true; }
  const r = crew.rallyNeeds();
  assert.equal(r.need, RALLY_LINES.friesBell);
  assert.equal(r.needs[a.id], RALLY_LINES.friesBell, 'the Rat by the shed cooks');
  assert.equal(r.needs[b.id], RALLY_LINES.glowDive, 'the Rat by the Bridge dives');
  crew.fries = 20; for (const bl of [...crew.balls.values()]) crew.balls.delete(bl.id);
  assert.equal(crew.rallyNeeds().need, RALLY_LINES.onTarget, 'nothing left to do: hold it');
});
