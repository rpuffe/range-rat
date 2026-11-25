// Playthrough 3, Playtester A (design/playtest-round3.md): Gary's lines hold until Spotless and re-deal (solo too),
// the GARY 3 · 2 · 1 lasts ~5 s everywhere, "On target" keeps an Upkeep margin, and the 30 s re-check keeps lines.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { redealGary, GARY_SPOTLESS } from '../web/js/nudge.js';
import { garyCountdown, GARY_COUNT } from '../web/js/huddlerules.js';
import { shortfall, shortfalls, dealJobs, upkeepOk, RALLY_LINES, UPKEEP_MARGIN } from '../web/js/rally.js';
import { GARY } from '../web/js/sim.js';

function makeCrew(save, n = 2, shiftSecs = 200) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('PT3A', { voiced: ['welcome', 'gary'], ...save }, { shiftSecs, seed: 5, now: () => clock.t });
  const rats = [];
  for (let i = 0; i < n; i++) { const p = crew.join('R' + i); crew.connect(p); rats.push(p); }
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;      // no customers: the mud is what the test sets
  const step = (secs = 0.05) => { for (let t = 0; t < secs - 1e-9; t += 0.05) { clock.t += 50; crew.tick(0.05); } crew.flush(); };
  const nudges = () => crew.snapshot().mods?.nudge ?? {};
  const mats = v => { for (const k of Object.keys(crew.fixtures)) if (k.startsWith('mat')) crew.fixtures[k] = v; };
  return { crew, rats, step, nudges, mats };
}
const toWarn = m => { m.crew.shiftT = m.crew.shiftSecs * GARY.AT - 0.01; m.step(0.1); assert.equal(m.crew.gary?.phase, 'warn'); };

// ---- #1 / #12: Gary's lines --------------------------------------------------------------------------------------
test('#1: a Gary line stays up at the pass mark and clears only once the stop is Spotless', () => {
  const m = makeCrew({ day: 5 });
  const [a, b] = m.rats;
  a.x = 1; a.z = 3; b.x = 15; b.z = 12;
  m.crew.fixtures.sign = 0.9; m.crew.fixtures.stand = 0; m.mats(0.9);
  toWarn(m);
  assert.equal(m.nudges()[b.id], 'gary:sign');
  m.crew.fixtures.sign = GARY.CLEAN - 0.01;   // it would pass now, and scuff straight back
  m.step(0.1);
  assert.equal(m.nudges()[b.id], 'gary:sign', 'passing is not enough: the line holds');
  m.crew.fixtures.sign = GARY_SPOTLESS - 0.01;
  m.step(0.1);
  assert.equal(m.nudges()[b.id], 'gary:stall', 'Spotless: the stop line clears (round 8 #2: nothing left, so stall him)');
  assert.equal(m.nudges()[a.id], 'gary:mats', 'the other line is untouched');
});

test('#1: a stop that fails again during the warning is dealt again', () => {
  const m = makeCrew({ day: 5 });
  const [a, b] = m.rats;
  a.x = 1; a.z = 3; b.x = 15; b.z = 12;
  m.crew.fixtures.sign = 0.9; m.crew.fixtures.stand = 0; m.mats(0.9);
  toWarn(m);
  m.crew.fixtures.sign = 0; m.step(0.1);
  assert.equal(m.nudges()[b.id], 'gary:stall');
  m.crew.fixtures.sign = 0.8; m.step(0.1);   // scuffed again while he's still on his way
  assert.equal(m.nudges()[b.id], 'gary:sign', 're-dealt');
  assert.equal(m.crew.gary.phase, 'warn');
});

test('#12: solo, a Spotless stop deals the next failing one', () => {
  const m = makeCrew({ day: 5 }, 1);
  const [a] = m.rats;
  a.x = 14; a.z = 12;
  m.crew.fixtures.sign = 0.9; m.crew.fixtures.stand = 0.9; m.mats(0.9);
  toWarn(m);
  assert.equal(m.nudges()[a.id], 'gary:sign', 'nearest first');
  m.crew.fixtures.sign = 0; m.step(0.1);
  const next = m.nudges()[a.id];
  assert.ok(next === 'gary:mats' || next === 'gary:stand', `the next failing stop (${next})`);
  m.crew.fixtures.stand = 0; m.mats(0); m.step(0.1);
  assert.equal(m.nudges()[a.id], 'gary:meet', 'everything Spotless: meet him at the stand (round 8 #2)');
});

test('#1: redealGary skips the stops someone still holds', () => {
  const stops = [{ id: 'sign', x: 14, z: 13 }, { id: 'mats', x: 0, z: 3.5 }];
  assert.deepEqual(redealGary(stops, [{ id: 'a', x: 14, z: 13 }], ['sign']), { a: 'mats' });
  assert.deepEqual(redealGary(stops, [{ id: 'a', x: 0, z: 0 }], ['sign', 'mats']), { a: 'stall' }, 'round 8 #2: every failing stop held: stall');
  assert.deepEqual(redealGary([], [{ id: 'a', x: 0, z: 0 }], []), { a: 'meet' }, 'nothing fails: meet');
});

// ---- #2: the countdown lasts ~5 s at every venue, with or without a cart -----------------------------------------
for (const venue of [0, 1, 2, 3, 4]) for (const withCart of [false, true]) {
  test(`#2: GARY 3 · 2 · 1 lasts ~${GARY_COUNT} s (venue ${venue}, ${withCart ? 'a cart far away' : 'no cart'})`, () => {
    const crew = new Crew('PT3C', { day: 6, venue }, { shiftSecs: 240, seed: 3, now: () => 1 });
    const a = crew.join('A'); crew.connect(a);
    crew.startShift();
    a.x = 26; a.z = 6;
    if (withCart) crew.cart = { x: -30, z: -40, yaw: 0, v: 0, driver: null, load: 0, loadW: 0, boostT: 0, mud: 0, movedAt: 1 };
    else crew.cart = null;
    crew.gary = { phase: 'drive', t: 0, pause: 0, stop: 0, x: GARY.START.x, z: GARY.START.z, yaw: 0, fails: 0, checks: [] };
    const seen = [];
    let t = 0;
    for (let i = 0; i < 8000 && crew.gary.phase === 'drive'; i++) {
      crew.stepGary(0.05); t += 0.05;
      const s = garyCountdown(crew.snapshot().gary);
      if (s) seen.push({ t, s });
    }
    assert.ok(seen.length, 'the Board counted');
    const secs = seen.at(-1).t - seen[0].t;
    assert.ok(secs >= GARY_COUNT - 1.2 && secs <= GARY_COUNT + 0.5, `counted for ${secs.toFixed(1)} s`);
    assert.deepEqual([...new Set(seen.map(x => x.s))], ['GARY 3', 'GARY 3 · 2', 'GARY 3 · 2 · 1']);
  });
}

// ---- #3: "On target" keeps an Upkeep margin ---------------------------------------------------------------------
const val = upkeep => ({ bv: upkeep, rate: 1, curb: 1, pond: null, fries: null });
const twelve = (o = {}) => ({ sign: 0, stand: 0, ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['mat' + i, 0.2])), ...o });

test('#3: just over the target is not "On target" at the rally (the margin), but passes the review', () => {
  const quota = { q: 0.3 }, value = val(1.3 + UPKEEP_MARGIN / 2);
  assert.ok(upkeepOk(value, quota), 'the review would pass it now');
  assert.equal(shortfall({ value, quota, fixtures: twelve() }), RALLY_LINES.onTarget, 'no margin: on target');
  assert.equal(shortfall({ value, quota, fixtures: twelve(), margin: UPKEEP_MARGIN }), RALLY_LINES.mats, 'with the margin: name the biggest term');
  assert.ok(shortfalls({ value, quota, fixtures: twelve(), margin: UPKEEP_MARGIN }).length > 0, 'and deal it');
  assert.equal(shortfall({ value: val(1.3 + UPKEEP_MARGIN + 0.01), quota, fixtures: twelve(), margin: UPKEEP_MARGIN }), RALLY_LINES.onTarget);
  assert.ok(UPKEEP_MARGIN >= 0.01 && UPKEEP_MARGIN <= 0.03);   // round 11: the taper leaves ~30 s of thin scuffing
});

// Owner playtest 3 §2: the re-check is now the cleanup deal at T-60, after which nothing scuffs: it reads margin 0.
test('#3: the Last Call rally reads the margin; the cleanup deal (T-60) reads none, as nothing scuffs after it', () => {
  const m = makeCrew({ day: 4 });
  m.crew.quota = { ...(m.crew.quota ?? {}), q: 0.3 };
  m.crew.valueNow = () => val(1.3 + UPKEEP_MARGIN / 2);
  m.mats(0.2); m.crew.fixtures.sign = 0; m.crew.fixtures.stand = 0;
  const first = m.crew.rallyNeeds();
  assert.notEqual(first.need, RALLY_LINES.onTarget);
  assert.equal(m.crew.recheckNeeds().need, RALLY_LINES.onTarget, 'margin 0 at the cleanup deal');
  m.crew.valueNow = () => val(1.3 - 0.01);
  assert.equal(m.crew.recheckNeeds().need, first.need, 'still short: the same line');
  m.crew.valueNow = () => val(1.3 + UPKEEP_MARGIN + 0.02);
  assert.equal(m.crew.rallyNeeds().need, RALLY_LINES.onTarget);
  assert.equal(m.crew.recheckNeeds().need, RALLY_LINES.onTarget);
});

// ---- #4: the 30 s re-check keeps each Rat's line -----------------------------------------------------------------
test('#4: dealJobs with prev keeps each line still short and deals only new jobs', () => {
  const S = { id: 'sign', line: RALLY_LINES.sign, at: { x: 14, z: 13 } };
  const T = { id: 'stand', line: RALLY_LINES.stand, at: { x: 26, z: 10 } };
  const M = { id: 'mats', line: RALLY_LINES.mats, at: { x: 0, z: 3.5 } };
  const near = { a: { id: 'a', x: 14, z: 13 }, b: { id: 'b', x: 26, z: 10 } };
  const first = dealJobs([S, T], [near.a, near.b]);
  assert.deepEqual(first, { a: S.line, b: T.line });
  const swapped = [{ id: 'a', x: 26, z: 10 }, { id: 'b', x: 14, z: 13 }];   // they walked past each other
  assert.deepEqual(dealJobs([S, T], swapped), { a: T.line, b: S.line }, 'without prev: dealt by position (the bug)');
  assert.deepEqual(dealJobs([S, T], swapped, undefined, first), first, 'with prev: kept');
  assert.deepEqual(dealJobs([T, M], swapped, undefined, first), { a: M.line, b: T.line }, 'the sign is done: its Rat gets the new job, the stand stays');
  assert.deepEqual(dealJobs([T], swapped, undefined, first), { a: T.line, b: T.line }, 'nothing new: the freed Rat joins an open job');
});

test('#4: the crew re-check keeps lines by Rat, not by where they stand', () => {
  const m = makeCrew({ day: 4 });
  const [a, b] = m.rats;
  m.crew.quota = { ...(m.crew.quota ?? {}), q: 0.6 };
  m.crew.valueNow = () => val(1.2);
  m.mats(0); m.crew.fixtures.sign = 0.9; m.crew.fixtures.stand = 0.9;
  a.x = 14; a.z = 13; b.x = 26; b.z = 10;
  const first = m.crew.rallyNeeds().needs;
  assert.deepEqual(first, { [a.id]: RALLY_LINES.sign, [b.id]: RALLY_LINES.stand });
  a.x = 26; a.z = 10; b.x = 14; b.z = 13;
  assert.deepEqual(m.crew.recheckNeeds().needs, first, 'kept');
});

// ---- #10: shorter text -------------------------------------------------------------------------------------------
test('#10: the gold debut memo is 8 words; the day-5 line with stamps and fee in hand says sign', async () => {
  const { KIND_NAMES, KIND_BLURB } = await import('../web/js/sim.js');
  assert.ok(`NEW: the ${KIND_NAMES.gold}. ${KIND_BLURB.gold}`.split(/\s+/).length <= 8);
  const run = save => {
    const clock = { t: 1_000_000 };
    const crew = new Crew('PT3T', { voiced: ['welcome', 'gary'], ...save }, { shiftSecs: 5, seed: 5, now: () => clock.t });
    const p = crew.join('A'); crew.connect(p);
    crew.startShift();
    for (let i = 0; i < 200 && crew.phase === 'shift'; i++) { clock.t += 50; crew.tick(0.05); }
    return crew.report.tomorrow;
  };
  assert.equal(run({ day: 5, stamps: 3, cash: 1e6 }), 'Tomorrow: sign at the bell for the Club.');
  assert.equal(run({ day: 5, stamps: 3, cash: 0, garyDay: 99 }), 'Tomorrow: one goal left for the Club.', 'round 10 #1: the card counts what is left (the fee)');
});
