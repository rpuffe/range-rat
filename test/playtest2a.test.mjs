// Playthrough 2, Playtester A (design/playtest-round2.md): the rally names the biggest Upkeep loss, Gary spares the
// huddle ring on every leg and counts 3 · 2 · 1 from the mats, the day-2 nudges skip what a Rat already does, and the
// report says how far short of the fee the crew is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { shortfall, RALLY_LINES, RALLY_RECHECK } from '../web/js/rally.js';
import { garyCountdown } from '../web/js/huddlerules.js';
import { nudgeSatisfied, dealFor } from '../web/js/nudge.js';
import { promoPanelHtml, feeShort } from '../web/js/promopanel.js';
import { LAST_CALL } from '../web/js/sim.js';

const val = (upkeep, extra = {}) => ({ bv: upkeep, rate: 1, curb: 1, pond: null, fries: null, ...extra });
const twelve = (o = {}) => ({ sign: 0, stand: 0, ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['mat' + i, 0])), ...o });

// ---- 1. the rally line -------------------------------------------------------------------------------------------
test('ten scuffed mats outweigh one filthy sign (mats grouped, by their Upkeep cost)', () => {
  const fx = twelve({ sign: 0.9, ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['mat' + i, 0.3])) });
  assert.equal(shortfall({ value: val(1.2), quota: { q: 0.3 }, fixtures: fx }), RALLY_LINES.mats, 'mats 3.0 of mud vs the sign 0.9');
  const lone = twelve({ sign: 0.9, mat0: 0.3 });
  assert.equal(shortfall({ value: val(1.2), quota: { q: 0.3 }, fixtures: lone }), RALLY_LINES.sign);
  const stand = twelve({ stand: 0.8, mat0: 0.2, mat1: 0.2 });
  assert.equal(shortfall({ value: val(1.2), quota: { q: 0.3 }, fixtures: stand }), RALLY_LINES.stand);
});

test('fries and the pond compete at their real cost, not past a threshold', () => {
  // mats: 0.5 × 3 / 12 = 0.125 of Upkeep; fries at 0.6 cost 0.2 → fries; at 0.9 cost 0.05 → mats
  const fx = twelve(Object.fromEntries(Array.from({ length: 10 }, (_, i) => ['mat' + i, 0.3])));
  assert.equal(shortfall({ value: val(1.2, { fries: 0.6 }), quota: { q: 0.5 }, fixtures: fx }), RALLY_LINES.fries);
  assert.equal(shortfall({ value: val(1.2, { fries: 0.9 }), quota: { q: 0.5 }, fixtures: fx }), RALLY_LINES.mats);
  assert.equal(shortfall({ value: val(1.2, { pond: 0.5, fries: 0.9 }), quota: { q: 0.5 }, fixtures: fx }), RALLY_LINES.pond);
});

function lastCallRun(save, setup) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('RLY2', save, { shiftSecs: 120, seed: 9, now: () => clock.t });
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  setup?.(crew);
  const ev = [];
  while (crew.phase === 'shift') { clock.t += 50; crew.tick(0.05); ev.push(...crew.flush().ev.map(e => ({ ...e, at: crew.shiftT }))); }
  return ev;
}

test('a second rally line ~30 s into Last Call when still short, once', () => {
  const ev = lastCallRun({ day: 2 });
  const rallies = ev.filter(e => e.t === 'rally');
  assert.equal(rallies.length, 1);
  assert.equal(rallies[0].need, RALLY_LINES.mats);
  const into = rallies[0].at - (120 - LAST_CALL.SECS);
  assert.ok(into >= RALLY_RECHECK - 0.1 && into < RALLY_RECHECK + 1, `at ${into} s into Last Call`);
});

test('no second line when the crew is on target by then', () => {
  const ev = lastCallRun({ day: 2 }, crew => {
    const tick = crew.tick.bind(crew);
    crew.tick = dt => { for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0; tick(dt); };   // spotless all day
  });
  assert.equal(ev.filter(e => e.t === 'rally').length, 0);
});

// ---- 2. Gary --------------------------------------------------------------------------------------------------
function garyCrew() {
  const crew = new Crew('GRY2', { day: 4 }, { shiftSecs: 240, seed: 3, now: () => 1 });
  const a = crew.join('A'); crew.connect(a);
  crew.startShift();
  return { crew, a };
}

test('Gary never runs over a Rat in the huddle ring, even on the mats → cart leg', () => {
  const { crew, a } = garyCrew();
  crew.cart = { x: 24, z: 2, mud: 0.5 };                     // parked by the stand: his route crosses the ring
  const mi = crew.garyStops().findIndex(s => s.id === 'mats');
  crew.gary = { phase: 'drive', pause: 0, stop: mi + 1, x: 26.5, z: 4.5, yaw: 0, fails: 0, checks: [] };
  a.x = 27; a.z = 5; a.down = 0;                             // inside HUDDLE_R of the stand, right in his path
  for (let i = 0; i < 10; i++) crew.stepGary(0.1);
  assert.equal(a.down, 0);
  // ...but outside the ring he still drives like he owns the place
  crew.gary = { phase: 'drive', pause: 0, stop: mi + 1, x: 10, z: 2, yaw: 0, fails: 0, checks: [], cart: crew.cart };
  a.x = 10.5; a.z = 2; a.down = 0;
  crew.stepGary(0.1);
  assert.ok(a.down > 0, 'out on the range he still knocks you down');
});

test('GARY 3 · 2 · 1 lasts several seconds (playthrough 3 #2: the last ~5 s)', () => {
  const { crew } = garyCrew();
  crew.cart = { x: 30, z: -10, yaw: 0, v: 0, driver: null, load: 0, loadW: 0, boostT: 0, mud: 0, movedAt: 1 };
  const mats = crew.garyStops().find(s => s.id === 'mats');
  const mi = crew.garyStops().indexOf(mats);
  crew.gary = { phase: 'drive', t: 0, pause: 0, stop: mi, x: mats.x, z: mats.z + 0.1, yaw: 0, fails: 0, checks: [] };
  const seen = [];
  let t = 0;
  for (let i = 0; i < 2000 && crew.gary.phase === 'drive'; i++) {
    crew.stepGary(0.05); t += 0.05;
    const s = garyCountdown(crew.snapshot().gary);
    if (s) seen.push({ t, s });
  }
  assert.ok(seen.length, 'the Board counted');
  const secs = seen.at(-1).t - seen[0].t;
  assert.ok(secs >= 4, `counted for ${secs.toFixed(1)} s`);
  assert.deepEqual([...new Set(seen.map(x => x.s))], ['GARY 3', 'GARY 3 · 2', 'GARY 3 · 2 · 1']);
});

test('garyCountdown splits the last ~5 s into thirds (playthrough 3 #2: was the whole route from the mats)', () => {
  const g = eta => garyCountdown({ phase: 'drive', to: 'cart', x: 0, z: 0, eta, span: 9 });
  assert.equal(g(9), null, 'a long span from an older server: wait for the last 5 s');
  assert.equal(g(5), 'GARY 3'); assert.equal(g(3.5), 'GARY 3');
  assert.equal(g(3), 'GARY 3 · 2'); assert.equal(g(1), 'GARY 3 · 2 · 1');
  assert.equal(g(0), null);
  assert.equal(garyCountdown({ phase: 'drive', to: 'cart', x: 0, z: 0 }), null, 'before the mats: no count');
});

// ---- 5. nudges ------------------------------------------------------------------------------------------------
test('a nudge the Rat already satisfies is skipped', () => {
  assert.equal(nudgeSatisfied('hose', { wand: true }), true);
  assert.equal(nudgeSatisfied('hose', { washAt: 5 }), true);
  assert.equal(nudgeSatisfied('hose', {}), false);
  assert.deepEqual(dealFor(0, { washAt: 5 }, {}), { id: 'far', used: 2 });
  assert.deepEqual(dealFor(0, {}, {}), { id: 'hose', used: 1 });
});

test('the host who already hosed is not dealt "hose"; nothing is dealt in Last Call', () => {
  const clock = { t: 1_000_000 };
  const crew = new Crew('NDG2', { day: 2 }, { shiftSecs: 240, seed: 3, now: () => clock.t });
  const host = crew.join('Host'); crew.connect(host);
  host.washAt = 999_000;                                    // sprayed the sign yesterday
  crew.startShift();
  const nudges = () => crew.snapshot().mods?.nudge ?? {};
  assert.equal(nudges()[host.id], 'far');
  crew.shiftT = crew.shiftSecs - 30;                         // Last Call
  const late = crew.join('Late'); crew.connect(late);
  clock.t += 50; crew.tick(0.05);
  assert.equal(nudges()[late.id], undefined);
});

// ---- 6. the ledger and the fee ---------------------------------------------------------------------------------
test('hosing a fixture clean credits the Rat in the ledger', () => {
  const clock = { t: 1_000_000 };
  const crew = new Crew('HOS2', { day: 2 }, { shiftSecs: 240, seed: 3, now: () => clock.t });
  const a = crew.join('A'); crew.connect(a); crew.startShift();
  a.wand = true; a.x = 14; a.z = 13; a.washAt = 0;
  crew.fixtures.sign = 0.2;
  for (let i = 0; i < 60 && crew.fixtures.sign > 0; i++) { clock.t += 500; crew.wash(a, 0.5, 'sign'); }
  assert.equal(crew.fixtures.sign, 0);
  assert.equal(a.shift.hosed, 1);
});

test('stamps complete but cash short: "Fee: $X short"', () => {
  const promo = { next: 'Range Club', fee: 5500, stamps: 3, need: 3, ready: false, signed: [] };
  assert.equal(feeShort(promo, 4605), 'Fee: $895 short');
  const h = promoPanelHtml(promo, { cash: 4605 });
  assert.match(h, /Fee: \$895 short/);
  assert.doesNotMatch(h, /Earn 3 review stamps/);
  assert.doesNotMatch(promoPanelHtml({ ...promo, stamps: 2 }, { cash: 100 }), /short/);
  assert.ok(feeShort(promo, 4605).split(' ').length <= 8);
});
