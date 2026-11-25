// Playthrough 5 fix pass, server and rules (design/playtest-round5.md): Clock out early, the promotion skip (A1),
// Gary and the autopilot cart (C1), honest goals (C2, C3, A2, B5), the deck order deal (B1), autopilot (C5, C6, C9),
// the drones' zone and tip (C4), and the small server items (B8, C10, A10).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SIM, FRIES, GARY, CART } from '../web/js/sim.js';
import { AUTO, halfLapPose, detour, stepAutopilot, newAuto } from '../web/js/autopilot.js';
import { onTrack, cartBlocked } from '../web/js/map.js';
import { droneTarget } from '../web/js/county.js';
import { nudgeLine, nudgeTarget } from '../web/js/nudge.js';
import { HINT_WHEN, hintText, BOUGHT_HINT } from '../web/js/settings.js';
import { wordCount } from '../web/js/say.js';
import { GOALS } from '../web/js/goals.js';

function makeCrew(save = null, { shiftSecs = 600, seed = 11, names = ['A'] } = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('PTFV', save, { shiftSecs, seed, now: () => clock.t });
  const ps = names.map((n, i) => { const p = crew.join(n); crew.connect(p); p.x = 20 + i; p.z = 5; return p; });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; for (const p of ps) { p.seenAt = clock.t; p.movedAt = clock.t; } crew.tick(0.05); } };
  return { crew, clock, run, ps };
}
const quiet = crew => { for (const m of crew.mats) m.next = 1e9; };
const act = (crew, p, a) => crew.input(p, { a: [a] });
// The Club's card, every goal done but the live fee (which the cash covers).
function doneCard(crew) {
  crew.goals.done.push('fed', 'treasures', 'seal'); crew.goals.n.reviews = 3; crew.cash = 1e9;
  assert.ok(crew.promoInfo().ready, 'the card is done');
}
const names = n => ['A', 'B', 'C', 'D'].slice(0, n);

// ---- Clock out early -------------------------------------------------------------------------------------------------
test('clock out: refused until the card is done; solo rings the bell at once, the normal way', () => {
  const { crew, ps: [a], run } = makeCrew({ day: 10, venue: 1, venueDay: 2, v: 5 });
  crew.startShift(); quiet(crew); run(2);
  assert.equal(crew.snapshot().clockOut, null, 'no button before the card is done');
  act(crew, a, { t: 'clockout', on: true });
  assert.equal(crew.phase, 'shift', 'refused');
  doneCard(crew);
  assert.deepEqual(crew.snapshot().clockOut, { n: 0, of: 1 });
  crew.flush();
  act(crew, a, { t: 'clockout', on: true });
  assert.equal(crew.phase, 'report', 'the bell rang');
  const ev = crew.flush().ev;
  assert.ok(ev.some(e => e.t === 'clockedout' && e.early > 500));
  assert.ok(ev.some(e => e.t === 'quota'), 'the review ran (the stamp)');
  assert.ok(crew.report.early > 500 && crew.report.promo.ready, 'the report says so, and the promotion is there to sign');
});

test('clock out: every online Rat must hold it; letting go takes the vote back; the card going undone clears it', () => {
  const { crew, ps: [a, b], run } = makeCrew({ day: 10, venue: 1, venueDay: 2, v: 5 }, { names: names(2) });
  crew.startShift(); quiet(crew); run(2); doneCard(crew);
  act(crew, a, { t: 'clockout', on: true });
  assert.equal(crew.phase, 'shift');
  assert.deepEqual(crew.snapshot().clockOut, { n: 1, of: 2 });
  assert.equal(crew.snapshot().players.find(p => p.id === a.id).clockOut, true);
  act(crew, a, { t: 'clockout', on: false });
  act(crew, b, { t: 'clockout', on: true });
  assert.equal(crew.phase, 'shift', 'A let go');
  crew.cash = 0; run(0.1);                                  // the fee slipped: the card is no longer done
  assert.equal(crew.snapshot().clockOut, null);
  crew.cash = 1e9; act(crew, a, { t: 'clockout', on: true });
  assert.equal(crew.phase, 'shift', 'B\'s old vote was cleared');
  act(crew, b, { t: 'clockout', on: true });
  assert.equal(crew.phase, 'report');
});

// ---- A1: the promotion skip ----------------------------------------------------------------------------------------
for (const n of [1, 4]) {
  test(`A1 (${n}P): Ready on a done card does not start a new day at the same venue`, () => {
    const { crew, ps, run } = makeCrew({ day: 10, venue: 1, venueDay: 2, v: 5 }, { names: names(n) });
    crew.startShift(); quiet(crew); run(1); doneCard(crew);
    crew.endShift();
    const day = crew.day;
    for (const p of ps) act(crew, p, { t: 'start' });
    run(200);
    assert.equal(crew.phase, 'report', 'Ready waits for the signatures (even past the old 120 s hold)');
    assert.equal(crew.day, day);
    for (const p of ps) act(crew, p, { t: 'sign', on: true });
    assert.equal(crew.venue, 2, 'signed: promoted');
    run(1); for (const p of ps) act(crew, p, { t: 'start' });
    assert.equal(crew.phase, 'shift');
  });
}

test('A1: "Not yet" lets Ready start the day at the same venue; tomorrow asks again', () => {
  const { crew, ps: [a, b], run } = makeCrew({ day: 10, venue: 1, venueDay: 2, v: 5 }, { names: names(2) });
  crew.startShift(); quiet(crew); run(1); doneCard(crew); crew.endShift();
  act(crew, a, { t: 'start' }); act(crew, b, { t: 'start' });
  assert.equal(crew.phase, 'report');
  act(crew, b, { t: 'notyet' });
  assert.equal(crew.phase, 'shift', 'everyone was ready: the day starts');
  assert.equal(crew.venue, 1);
  assert.equal(crew.notYet, false, 'reset for the next report');
});

test('A1: after the hold, the Rats who signed carry the promotion (an idle Rat cannot stall it)', () => {
  const { crew, ps: [a], run } = makeCrew({ day: 10, venue: 1, venueDay: 2, v: 5 }, { names: names(2) });
  crew.startShift(); quiet(crew); run(1); doneCard(crew); crew.endShift();
  act(crew, a, { t: 'sign', on: true }); act(crew, a, { t: 'start' });
  run(119); assert.equal(crew.venue, 1);
  run(2); assert.equal(crew.venue, 2, 'promoted');
  run(21); assert.equal(crew.phase, 'shift');
});

// ---- C1: Gary and the autopilot cart ------------------------------------------------------------------------------
test('C1: at the County with autopilot, Gary reaches a verdict every visit (the cart he heads for waits)', () => {
  for (const seed of [3, 7, 11]) {
    const { crew, run } = makeCrew({ day: 20, venue: 4, venueDay: 2, v: 5, up: { cart: 4 } }, { seed, names: names(2) });
    crew.garyDay = 20;
    crew.startShift(); run(1);
    assert.equal(crew.carts.length >= 1 && crew.perks.autopilot, true);
    let verdict = false, held = false;
    for (let i = 0; i < 600 && !verdict; i++) {
      run(1);
      if (crew.gary?.cart && crew.garyHolds(crew.gary.cart)) held = true;
      verdict = crew.gary?.phase === 'done';
    }
    assert.ok(verdict, 'seed ' + seed + ': a verdict');
    assert.ok(held, 'the autopilot cart waited for him');
  }
});

test('C1: a cart a Rat keeps driving away still gets inspected (the leg gives up chasing)', () => {
  const { crew, run, ps: [a] } = makeCrew({ day: 20, venue: 4, venueDay: 2, v: 5, up: { cart: 1 } });
  crew.garyDay = 20; crew.startShift(); quiet(crew);
  crew.gary = { phase: 'drive', t: 0, x: GARY.START.x, z: GARY.START.z, yaw: 0, stop: crew.garyStops().findIndex(s => s.id === 'cart'), pause: 0, fails: 0, checks: [], stalls: 0 };
  let k = 0;
  for (let i = 0; i < 50 * 20 && !crew.gary.checks.length; i++) {
    const c = crew.carts[0]; c.x = (k++ % 2) ? -40 : 40; c.z = -60;   // driven to and fro across the field
    crew.tick(0.05);
  }
  assert.equal(crew.gary.checks[0]?.stop, 'cart');
});

// ---- honest goals ---------------------------------------------------------------------------------------------------
test('C3: debris counts winched pieces, is never force-ticked, and is sized to the sky once it stops refilling', () => {
  const { crew, run } = makeCrew({ day: 40, venue: 5, venueDay: 2, v: 5, outstanding: 5000 }, { names: names(4) });
  crew.startShift(); quiet(crew); crew.flush();
  crew.events.push({ t: 'winch', deb: 1 }, { t: 'landed', n: 3 });
  crew.goalScan();
  assert.equal(crew.goals.n.debris, 4, 'the winch counts');
  const orbit = crew.mods.state('orbit');
  orbit.debris = new Set([1, 2]);
  assert.equal(crew.goalRows().find(r => r.id === 'debris').need, 60, 'the printed count while the sky refills');
  crew.lastBucket = { phase: 'sky' };
  let r = crew.goalRows().find(x => x.id === 'debris');
  assert.equal(r.need, 6, 'brought down 4 + 2 up there'); assert.equal(r.done, false);
  orbit.debris = new Set(); crew.goalCheck();
  assert.ok(!crew.goals.done.includes('debris') || crew.goals.n.debris >= 4);
  r = crew.goalRows().find(x => x.id === 'debris');
  assert.equal(r.need, 4, 'never more than there was');
  run(0.1);
});

test('A2: the Muni goal is "Pass Gary with a huddle": a failed verdict with a huddle does not tick it; solo can pass', () => {
  assert.equal(GOALS.huddle.text(), 'Pass Gary with a huddle');
  for (const pass of [false, true]) {
    const { crew, run, ps: [a] } = makeCrew({ day: 8, venue: 0, venueDay: 8, v: 5 });
    crew.garyDay = 8; crew.startShift(); quiet(crew);
    a.x = SIM.STAND.x; a.z = SIM.STAND.z;
    for (let i = 0; i < 400 && crew.gary?.phase !== 'done'; i++) {
      if (pass) for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
      else for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 1;
      run(1); a.x = SIM.STAND.x; a.z = SIM.STAND.z;
    }
    assert.equal(crew.gary?.phase, 'done');
    assert.equal((crew.goals.n.huddle ?? 0) >= 1, pass, pass ? 'solo passes with the huddle' : 'a failed verdict never ticks it');
  }
});

// ---- B1: the deck order deal ---------------------------------------------------------------------------------------
test('B1: "Deck order! Pour a beer!" goes to the Rat nearest the kitchen while an order and the order goal are open', () => {
  const { crew, run, ps: [a, b] } = makeCrew({ day: 20, venue: 2, venueDay: 2, v: 5, up: { shed: 1 } }, { names: names(2) });
  crew.startShift(); quiet(crew); run(1);
  a.x = FRIES.SHED.x; a.z = FRIES.SHED.z + 1; b.x = -30; b.z = -30;
  crew.mods.state('deck').deck.order = { seat: 0, left: 30 };
  run(0.2);
  assert.equal(crew.snapshot().mods.nudge?.[a.id], 'order');
  assert.equal(nudgeLine('order'), 'Deck order! Pour a beer!');
  assert.ok(nudgeTarget('order'));
  crew.mods.state('deck').deck.order = null; run(0.2);
  assert.notEqual(crew.snapshot().mods.nudge?.[a.id], 'order', 'filled or lapsed: gone');
  crew.goals.n.orders = 999; crew.goalCheck();
  crew.mods.state('deck').deck.order = { seat: 0, left: 30 }; run(0.2);
  assert.notEqual(crew.snapshot().mods.nudge?.[a.id], 'order', 'no order goal: no line');
});

test('B1: at 2P the morning deal gives one Rat the card goal', () => {
  const { crew, ps } = makeCrew({ day: 12, venue: 1, venueDay: 2, v: 5 }, { names: names(2) });
  crew.startShift();
  const n = crew.snapshot().mods.nudge ?? {};
  assert.ok(ps.some(p => n[p.id]?.startsWith('am:goal:')), JSON.stringify(n));
});

// ---- autopilot ------------------------------------------------------------------------------------------------------
test('C5: an autopilot cart rinses at the return; a muddy lapping cart goes to rinse', () => {
  const c = { x: SIM.STAND.x + 3, z: SIM.STAND.z, yaw: 0, load: 0, tipT: 0, mud: 0.8 };
  const ctx = { dt: 0.1, t: 0, world: { venue: 3 }, speed: 8, cap: 100, balls: [], people: [], stand: SIM.STAND, reach: SIM.STAND_REACH + 2, underReels: () => false };
  const r = stepAutopilot(c, newAuto('lap'), ctx);
  assert.equal(c.mud, 0); assert.ok(r.rinsed);
  const far = { x: 0, z: -12, yaw: 0, load: 0, tipT: 0, mud: AUTO.RINSE_AT + 0.1 };
  const d0 = Math.hypot(far.x - SIM.STAND.x, far.z - SIM.STAND.z);
  stepAutopilot(far, newAuto('lap'), ctx);
  assert.ok(Math.hypot(far.x - SIM.STAND.x, far.z - SIM.STAND.z) < d0, 'heads for the return');
});

test('C6: the second cart starts half a lap out on the Track; the park-to-Track route swings round the return', () => {
  const p = halfLapPose(CART.PARK);
  assert.ok(onTrack(p.x, p.z) && !cartBlocked(p.x, p.z, { venue: 3 }));
  const { crew } = makeCrew({ day: 20, venue: 3, venueDay: 2, v: 5, up: { cart: 4 } });
  crew.startShift();
  assert.ok(Math.hypot(crew.carts[1].x - crew.carts[0].x, crew.carts[1].z - crew.carts[0].z) > 30, 'no lockstep');
  // Drive a lapping cart from the park: it never comes inside the return's stop radius.
  const c = { ...CART.PARK, load: 0, tipT: 0, mud: 0 };
  const avoid = { x: SIM.STAND.x, z: SIM.STAND.z, r: SIM.STAND_REACH + AUTO.STOP_R };
  const ctx = { dt: 0.05, t: 0, world: { venue: 3 }, speed: 8, cap: 100, balls: [], people: [], stand: SIM.STAND, reach: SIM.STAND_REACH + 2, avoid, underReels: () => false };
  let closest = Infinity;
  for (let i = 0; i < 400; i++) { stepAutopilot(c, newAuto('lap'), ctx); closest = Math.min(closest, Math.hypot(c.x - avoid.x, c.z - avoid.z)); }
  assert.ok(closest >= avoid.r - 0.3, 'closest ' + closest.toFixed(2));
  assert.ok(onTrack(c.x, c.z, 0.5), 'and it reached the Track');
  assert.deepEqual(detour({ x: 0, z: 0 }, { x: 10, z: 0 }, null), { x: 10, z: 0 });
});

test('C9: harvest mode carries over the night', () => {
  const { crew, ps: [a] } = makeCrew({ day: 20, venue: 3, venueDay: 2, v: 5, up: { cart: 4 } });
  crew.startShift();
  a.x = crew.carts[0].x + 1; a.z = crew.carts[0].z;
  act(crew, a, { t: 'auto' });
  assert.equal(crew.mods.state('stadium').auto[0].mode, 'harvest');
  crew.endShift(); crew.startShift();
  assert.equal(crew.mods.state('stadium').auto[0].mode, 'harvest');
});

// ---- C4: the drones -------------------------------------------------------------------------------------------------
test('C4: the zone outranks strays anywhere on the field; the dispatch is taught once drones are bought', () => {
  const stray = { id: 1, rest: true, x: 80, z: -60 }, nearMat = { id: 2, rest: true, x: 0, z: -5 }, inBowl = { id: 3, rest: true, cup: true, x: -4, z: -48 };
  const d = { x: 80, z: -60 };
  assert.equal(droneTarget(d, [stray, nearMat]).id, 1, 'no zone: the stray first');
  assert.equal(droneTarget(d, [stray, nearMat], new Set(), { x: 0, z: 0, r: 20 }).id, 2, 'the zone by the mats first');
  assert.equal(droneTarget(d, [stray, inBowl], new Set(), { x: -4, z: -48, r: 20 }).id, 3, 'and in a bowl');
  assert.equal(HINT_WHEN.drones({ up: { drones: 1 } }), true);
  assert.equal(HINT_WHEN.drones({ up: {} }), false);
  assert.equal(BOUGHT_HINT.drones, 'drones');
  for (const pad of [false, true]) assert.ok(wordCount(hintText('drones', pad)) <= 8, hintText('drones', pad));
});

// ---- small server items ---------------------------------------------------------------------------------------------
test('B8: serving needs a shift (no beer pays in the lobby)', () => {
  const { crew, ps: [a] } = makeCrew({ day: 20, venue: 2, venueDay: 2, v: 5, up: { shed: 1 } });
  a.x = FRIES.SHED.x; a.z = FRIES.SHED.z;
  assert.equal(crew.phase, 'lobby');
  assert.equal(crew.serve(a, { item: 'beer', quality: 'perfect' }), false);
});

test('C10: no record PA on the ending shift', () => {
  const { crew } = makeCrew({ day: 40, venue: 5, venueDay: 2, v: 5 });
  crew.startShift(); crew.flush();
  crew.endless = true; crew.stats.cash = 1e9;
  crew.endShift(true);
  assert.equal(crew.flush().ev.filter(e => e.t === 'pa' && e.id === 'record').length, 0);
});

test('A10: at the Muni the target holds while the review goal is open', () => {
  const open = makeCrew({ day: 9, venue: 0, venueDay: 9, v: 5 }).crew; open.startShift();
  const d4 = makeCrew({ day: 4, venue: 0, venueDay: 4, v: 5 }).crew; d4.startShift();
  assert.equal(open.quota.q, d4.quota.q, 'day 9 asks what day 4 asked');
  const done = makeCrew({ day: 9, venue: 0, venueDay: 9, v: 5, goals: { venue: 0, scale: 1, crew: 1, need: {}, n: { reviews: 2 }, done: [] } }).crew; done.startShift();
  assert.ok(done.quota.q > d4.quota.q, 'the review goal done: it climbs with the days again');
});
