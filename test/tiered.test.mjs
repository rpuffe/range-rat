// Tiered (venue 2): the Target Greens, Bay Utilization, Target Practice, the gutters (council round 4, build item 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { MODULES, checkModule } from '../server/venues/index.mjs';
import tiered from '../server/venues/tiered.mjs';
import { readFileSync } from 'node:fs';
import { MAP } from '../web/js/map.js';
import { inBowl, cupSpot, bayUtil, CUP_FULL, GUTTERS_ROW, GUTTERS, TARGET, drainsAll, guttersDrain } from '../web/js/tiered.js';
import { SHOP, CART, nextPrice } from '../web/js/sim.js';

const [A, B, C] = MAP.BOWLS;
function setup(extra = {}, venue = 2) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('TIER', { venue, day: 5, venueDay: 1, up: { shed: 1, ...extra }, cash: 1000 },
    { shiftSecs: 120, seed: 5, now: () => clock.t, modules: [tiered] });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  const drop = (x, z, by) => crew.addBall({ x, y: 0.06, z, vx: 0, vy: 0, vz: 0, kind: 'range', ...(by ? { by } : {}) });
  const st = () => crew.mods.state('tiered');
  return { crew, p, run, drop, st };
}
const inCup = (crew, id) => [...crew.balls.values()].filter(b => b.cup === id);

test('the module is registered and well formed; the view plugs in through the registry', () => {
  assert.ok(MODULES.includes(tiered));
  assert.doesNotThrow(() => checkModule(tiered));
  assert.equal(tiered.venue, 2);
  const src = readFileSync(new URL('../web/js/views/tiered.js', import.meta.url), 'utf8');   // the view imports three: browser only
  assert.ok(src.includes("id: 'tiered'") && src.includes('venue: 2'));
  const pure = readFileSync(new URL('../web/js/tiered.js', import.meta.url), 'utf8');
  assert.ok(!/^import .*sim[.]js/m.test(pure), 'tiered.js must not import sim.js (a TDZ cycle)');
});

test('inBowl: r 6.9 of Bowl A is inside, r 7.5 is not; cupSpot stays in the cup and is deterministic', () => {
  assert.equal(inBowl(A.x + 6.9, A.z), A);
  assert.equal(inBowl(A.x + 7.5, A.z), null);
  assert.equal(inBowl(B.x, B.z - 7.9), B);
  assert.equal(inBowl(C.x - 8.9, C.z), C);
  assert.equal(inBowl(0, -10), null);
  const seen = new Set();
  for (let id = 1; id < 300; id++) {
    const s = cupSpot(id, A);
    assert.deepEqual(s, cupSpot(id, A));
    assert.ok(Math.hypot(s.x - A.x, s.z - A.z) <= A.cup, 'inside the cup');
    seen.add(s.x.toFixed(3) + s.z.toFixed(3));
  }
  assert.ok(seen.size > 250, 'scattered');
});

test('bayUtil: empty cups 1, 30 balls 0 (round 6 #2: was 40), clamped', () => {
  assert.equal(CUP_FULL, 30);
  assert.equal(bayUtil(0), 1);
  assert.equal(bayUtil(30), 0);
  assert.equal(bayUtil(15), 0.5);
  assert.equal(bayUtil(40), 0);
  assert.equal(bayUtil(400), 0);
  assert.equal(bayUtil(-3), 1);
});

test('a customer ball resting at r 6.9 of A rolls into the cup; at r 7.5 it stays put', () => {
  const { crew, drop, run, st } = setup();
  const inb = drop(A.x + 6.9, A.z), out = drop(A.x + 7.5, A.z);
  run(0.2);
  assert.equal(inb.cup, 'A');
  assert.ok(Math.hypot(inb.x - A.x, inb.z - A.z) <= A.cup);
  assert.equal(out.cup, undefined);
  assert.equal(out.x, A.x + 7.5);
  assert.equal(st().cups[0], 1);
  assert.ok(crew.mods.kpi() < 1 && crew.mods.kpi() > 0.95);
});

test('a cup event is emitted for the client tween', () => {
  const { crew, drop, st } = setup();
  const b = drop(B.x + 1, B.z + 1);
  crew.events.length = 0;
  tiered.onRest(crew, st(), b);
  const e = crew.events.find(x => x.t === 'cup');
  assert.ok(e && e.id === b.id && e.bowl === 'B');
  assert.equal(e.x, b.x); assert.equal(e.z, b.z);
});

test('Bay Utilization is the live KPI at venue 2 only; the ceiling reads 3.0', () => {
  const { crew, drop, run } = setup();
  assert.equal(crew.ceiling(), 3.0);
  for (let i = 0; i < 40; i++) drop(A.x + 1, A.z);
  run(0.5);
  assert.equal(crew.mods.kpi(), 0);
  assert.equal(crew.valueNow().kpi, 0);
  assert.equal(setup({}, 3).crew.mods.kpi(), null, 'not graded after Tiered');
});

test('a crew ball in a bowl is TARGET: the cup flushes to the shooter at gear x1, Hustle +0.25 (capped)', () => {
  const { crew, p, drop, run } = setup();
  p.grime = 5;                                  // a filthy Rat: the flush still pays at gear x1
  for (let i = 0; i < 5; i++) drop(C.x + 0.3, C.z);
  run(0.3);
  assert.equal(inCup(crew, 'C').length, 5);
  const cash0 = crew.cash, mult0 = crew.mult, v = crew.valueNow();   // the flush banks BEFORE the Hustle bump
  const shot = drop(C.x + 5, C.z + 3, p.id);
  run(0.3);
  assert.equal(inCup(crew, 'C').length, 0, 'the cup is empty');
  assert.ok(!crew.balls.has(shot.id), 'so is the shot');
  assert.ok(Math.abs((crew.cash - cash0) - 6 * v.value) < 0.05, `6 balls at gear x1: ${crew.cash - cash0} vs ${6 * v.value}`);
  assert.equal(crew.mult, mult0 + TARGET.HUSTLE);
  assert.equal(crew.stats.targets, 1);
  assert.equal(p.shift.banked, 6);
  crew.mult = CART.MAX_MULT;
  drop(A.x, A.z + 2, p.id); run(0.2);
  assert.equal(crew.mult, CART.MAX_MULT, 'shares the cap with pings');
});

test('a crew ball in a bowl outside the shift is just a cupped ball (no bank)', () => {
  const { crew, p, drop, st } = setup();
  crew.phase = 'report';
  const b = drop(A.x, A.z + 1, p.id);
  tiered.onRest(crew, st(), b);
  assert.equal(b.cup, 'A');
});

test('the gutters row: $50,000 base (halved by the playtest), a Tiered crew row; from the Stadium on it drains 1 a second per cup, banked as kind gutter', () => {
  assert.ok(SHOP.includes(GUTTERS_ROW));
  assert.equal(GUTTERS_ROW.minVenue, 2);
  assert.equal(nextPrice('gutters', {}, 1, 0, 1), null, 'not before Tiered');
  assert.equal(nextPrice('gutters', {}, 1, 0, 2), 50000);
  const { crew, drop, run } = setup({ gutters: 1 }, 3);
  for (let i = 0; i < 6; i++) { drop(A.x + 0.2, A.z); drop(B.x, B.z + 0.2); }
  run(0.3);
  const a0 = inCup(crew, 'A').length;
  assert.equal(a0, inCup(crew, 'B').length);
  run(3.0);
  assert.equal(inCup(crew, 'A').length, a0 - 3, '1 a second');
  assert.equal(inCup(crew, 'B').length, a0 - 3, 'per cup');
  run(10);
  assert.equal(inCup(crew, 'A').length, 0);
  assert.ok(crew.cash > 1000);
  assert.ok(crew.stats.deposited >= 12);
});

test('without the gutters nothing drains', () => {
  const { crew, drop, run } = setup();
  for (let i = 0; i < 4; i++) drop(A.x, A.z + 0.2);
  run(5);
  assert.equal(inCup(crew, 'A').length, 4);
});

test('balls picked out of a cup free the dial on the next recount', () => {
  const { crew, drop, run, st } = setup();
  const bs = [drop(A.x, A.z), drop(A.x, A.z + 0.3)];
  run(0.5);
  assert.equal(st().cups[0], 2);
  crew.balls.delete(bs[0].id);
  run(0.5);
  assert.equal(st().cups[0], 1);
});

test('the snapshot is small JSON; the module keeps no save key', () => {
  const { crew, drop, run, st } = setup();
  drop(A.x, A.z); run(0.5);
  const snap = tiered.snapshot(crew, st());
  assert.deepEqual(snap.cups, [1, 0, 0]);
  assert.ok(JSON.stringify(snap).length < 80);
  assert.equal(tiered.toSave, undefined);
});

test('the forgiving lip (round 6 #4): a crew ball at r + 1.4 is a TARGET, at r + 1.6 it is not; customers still cup inside r only', () => {
  assert.equal(TARGET.LIP, 1.5);
  assert.equal(inBowl(A.x + A.r + 1.4, A.z, MAP.BOWLS, TARGET.LIP), A);
  assert.equal(inBowl(A.x + A.r + 1.4, A.z), null, 'no pad: the plain bowl');
  {
    const { crew, p, drop, run } = setup();
    drop(A.x + A.r + 1.4, A.z, p.id);
    run(0.3);
    assert.equal(crew.stats.targets, 1, 'r + 1.4: TARGET');
  }
  {
    const { crew, p, drop, run } = setup();
    const b = drop(A.x + A.r + 1.6, A.z, p.id);
    run(0.3);
    assert.equal(crew.stats.targets ?? 0, 0, 'r + 1.6: no TARGET');
    assert.equal(b.cup, undefined);
  }
  {
    const { crew, drop, run, st } = setup();
    const b = drop(A.x + A.r + 0.5, A.z);
    run(0.3);
    assert.equal(b.cup, undefined, 'a customer ball at r + 0.5 does not cup');
    assert.equal(st().cups[0], 0);
    assert.equal(crew.stats.targets ?? 0, 0);
  }
});

test('playtest 2: a crew swing sails over the teenagers walking past the bays', async () => {
  const { Crew } = await import('../server/crew.mjs');
  const crew = new Crew('TEEN', { venue: 2, day: 12, venueDay: 1, up: { helpers: 1 } }, { shiftSecs: 120, seed: 3, now: () => 1 });
  const a = crew.join('A'); crew.connect(a); crew.startShift();
  const h = crew.helpers[0];
  const b = crew.addBall({ x: h.x, y: 1, z: h.z + 0.3, vx: 0, vy: 0, vz: -10, kind: 'range' }); b.by = a.id;
  for (let i = 0; i < 10; i++) crew.tick(0.02);
  assert.equal(h.down, 0);
});

// Council round 7 #1: linked gutters.
test('round 7 #1: the row text; drainsAll and guttersDrain split at Tiered', () => {
  assert.equal(GUTTERS.LINKED_VENUE, 2);
  assert.equal(GUTTERS_ROW.tiers[1].desc, 'Linked pipes under every green. A TARGET drains all three cups.');
  assert.equal(GUTTERS_ROW.tiers[1].cost, 50000);
  assert.equal(drainsAll({ gutters: 1 }, 2), true);
  assert.equal(drainsAll({}, 2), false);
  assert.equal(guttersDrain({ gutters: 1 }, 2), false);
  assert.equal(guttersDrain({ gutters: 1 }, 3), true);
  assert.equal(guttersDrain({}, 3), false);
});

test('round 7 #1: at Tiered with gutters, cups do not drain on their own over 60 s', () => {
  const { crew, drop, run } = setup({ gutters: 1 });
  const mine = [];
  for (let i = 0; i < 4; i++) mine.push(drop(A.x + 0.2, A.z), drop(C.x, C.z + 0.2));
  run(60);
  assert.ok(mine.every(b => crew.balls.has(b.id) && b.cup), 'every cupped ball is still in its cup');
  assert.ok(!crew.events.some(e => e.t === 'gutter'), 'no gutter drains');
});

test('round 7 #1: a crew ball in Bowl A with gutters drains A, B and C to the shooter: one TARGET, Hustle once', () => {
  const { crew, p, drop, run } = setup({ gutters: 1 });
  for (let i = 0; i < 3; i++) { drop(A.x + 0.2, A.z); drop(B.x, B.z + 0.2); drop(C.x + 0.3, C.z); }
  drop(C.x, C.z + 0.4);
  run(0.3);
  const cash0 = crew.cash, mult0 = crew.mult, v = crew.valueNow();
  const signals = [];
  const sig = crew.mods.signal.bind(crew.mods);
  crew.mods.signal = (k, d) => { signals.push(k); return sig(k, d); };
  crew.events.length = 0;
  drop(A.x + 2, A.z + 1, p.id);
  run(0.3);
  for (const id of ['A', 'B', 'C']) assert.equal(inCup(crew, id).length, 0, id + ' drained');
  assert.ok(Math.abs((crew.cash - cash0) - 11 * v.value) < 0.05, '11 balls at gear x1');
  assert.equal(p.shift.banked, 11);
  assert.equal(crew.mult, mult0 + TARGET.HUSTLE, 'Hustle once');
  assert.equal(crew.stats.targets, 1);
  assert.equal(signals.filter(k => k === 'target').length, 1);
  const e = crew.events.find(x => x.t === 'target');
  assert.equal(e.all, true);
  assert.equal(e.n, 11);
  assert.equal(e.bowl, 'A');
});

test('round 7 #1: without gutters a TARGET flushes its own cup only (no all flag)', () => {
  const { crew, p, drop, run } = setup();
  for (let i = 0; i < 2; i++) { drop(A.x + 0.2, A.z); drop(B.x, B.z + 0.2); }
  run(0.3);
  crew.events.length = 0;
  drop(A.x + 2, A.z, p.id);
  run(0.3);
  assert.equal(inCup(crew, 'A').length, 0);
  assert.equal(inCup(crew, 'B').length, 2);
  const e = crew.events.find(x => x.t === 'target');
  assert.equal(e.all, undefined);
  assert.equal(e.n, 3);
});

// ---- Council round 8 #1: the Glow Rush -------------------------------------------------------------------------------
test('round 8 #1: cupWeight: a glow ball counts 2 at Tiered, 1 from the Stadium on; a range ball 1, a splitter 3', async () => {
  const { cupWeight, RUSH } = await import('../web/js/tiered.js');
  assert.deepEqual(RUSH, { GLOW_CUP: 2, VENUE: 2 });
  assert.equal(cupWeight({ kind: 'glow' }, 2), 2);
  assert.equal(cupWeight({ kind: 'range' }, 2), 1);
  assert.equal(cupWeight({ kind: 'splitter' }, 2), 3);
  assert.equal(cupWeight({ kind: 'glow' }, 3), 1);
  assert.equal(cupWeight({ kind: 'splitter' }, 3), 3);
});

const dropKind = (crew, x, z, kind, by) => crew.addBall({ x, y: 0.06, z, vx: 0, vy: 0, vz: 0, kind, ...(by ? { by } : {}) });

test('round 8 #1: a resting glow ball in Bowl A counts 2 at Tiered and 1 at the Stadium', () => {
  for (const [venue, want] of [[2, 2], [3, 1]]) {
    const { crew, run, st } = setup({}, venue);
    dropKind(crew, A.x + 0.2, A.z, 'glow');
    dropKind(crew, A.x - 0.2, A.z, 'range');
    run(0.5);
    assert.equal(st().cups[0], want + 1, 'venue ' + venue);
    assert.equal(st().kpi, bayUtil(want + 1));
  }
});

test('round 8 #1: a TARGET on a cup holding 4 glow balls banks 4 balls (+ the shooter), not 8', () => {
  const { crew, p, run, st } = setup({ gutters: 1 });
  for (let i = 0; i < 4; i++) dropKind(crew, A.x + 0.1 * i, A.z, 'glow');
  run(0.3);
  assert.equal(st().cups[0], 8, 'the flags show the doubled count');
  crew.events.length = 0;
  dropKind(crew, A.x + 2, A.z, 'range', p.id);
  run(0.3);
  assert.equal(crew.events.find(e => e.t === 'target').n, 5);
  assert.equal(p.shift.banked, 5);
  assert.equal(st().cups[0], 0);
});

// The real rule over a whole seeded 4P shift (late gear, gutters): one TARGET at T-15 saves the stamp; one at T-50
// leaves the rush time to fill the cups again (council8/tiered3.mjs, now against the real rule).
function rushShift(seed, shotAt) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('RUSH', { day: 20, venue: 2, venueDay: 2, stamps: 1, up: { shed: 3, washer: 3, cart: 2, helpers: 4, ads: 3, amen: 2, gutters: 1 } }, { seed, now: () => clock.t });
  for (let i = 0; i < 4; i++) { const r = crew.join('R' + i); crew.connect(r); r.x = 27 + i; r.z = 9; }
  crew.startShift();
  const shooter = [...crew.players.values()][0];
  const st = crew.mods.state('tiered');
  let shot = shotAt == null;
  const end = crew.shiftSecs - 0.1;
  while (crew.phase === 'shift' && crew.shiftT < end) {
    clock.t += 50; crew.basket.n = 12;                 // owner playtest 3 §3.3: someone keeps the basket stocked
    for (const r of crew.players.values()) { r.seenAt = clock.t; r.movedAt = clock.t; }
    if (!shot && crew.shiftT >= crew.shiftSecs - shotAt) {
      shot = true;
      const b = { id: 9_000_000 + seed, x: A.x, y: 0.06, z: A.z, vx: 0, vy: 0, vz: 0, rest: true, kind: 'range', by: shooter.id };
      crew.balls.set(b.id, b); tiered.onRest(crew, st, b);
    }
    crew.tick(0.05);
  }
  return crew.mods.kpi();                              // what the review reads (owner playtest 3 §2: the T-60 gauge)
}

// Owner playtest 3 §2: the bowls are judged at T-60 ("the last customer out reads the bowls"). Council 9 N5: a TARGET
// at 1:05 passes 6/6, at 1:15 3/6; none fails; one at T-50 is too late to change the stamp.
test('owner playtest 3 §2: seeded 4P shifts: a TARGET at T-65 passes seeds 1-6, none fails, one at T-50 changes nothing', () => {
  for (const s of [1, 2, 3, 4, 5, 6]) assert.ok(rushShift(s, 65) >= 0.5, 'seed ' + s + ' T-65');
  for (const s of [1, 2, 3]) assert.ok(rushShift(s, null) < 0.5, 'seed ' + s + ' with no TARGET fails');
  for (const s of [1, 2, 3]) assert.equal(rushShift(s, 50), rushShift(s, null), 'seed ' + s + ': a TARGET after 1:00 is not read');
  const early = [1, 2, 3, 4, 5, 6].filter(s => rushShift(s, 75) >= 0.5).length;
  assert.ok(early >= 2 && early <= 5, 'the rush has teeth: ' + early + ' of 6 pass at T-75');
});

test('owner playtest 3 §2: the review reads the gauge stored at T-60 (kpiAtClose), and the snapshot says judged', () => {
  const { crew, drop, run, st } = setup({ gutters: 1 });
  for (const m of crew.mats) m.next = 1e9;
  crew.shiftSecs = 200;                                // long enough for the cleanup minute
  run(crew.shiftSecs - 61 - crew.shiftT);
  assert.equal(st().kpiAtClose, null);
  run(1.2);
  assert.ok(crew.closing());
  const atClose = st().kpiAtClose;
  assert.equal(typeof atClose, 'number');
  for (let i = 0; i < 21; i++) drop(B.x + (i % 5) * 0.2, B.z + Math.floor(i / 5) * 0.2);   // cups fill after 1:00
  run(0.5);
  assert.notEqual(st().kpi, atClose, 'the live gauge moved');
  assert.equal(crew.mods.kpi(), atClose, 'the review reads the T-60 gauge');
  assert.equal(crew.snapshot().mods.tiered.judged, 1);
});

// ---- Council round 8 #6: "Saved by Cy's TARGET at 0:12." ------------------------------------------------------------
test('round 8 #6: a Last Call TARGET that lifts the gauge from 0.3 over the tick at T-12 is the save; no late TARGET, none', async () => {
  const { savedLine, clockText } = await import('../web/js/tiered.js');
  for (const late of [true, false]) {
    const { crew, p, drop, run, st } = setup({ gutters: 1 });
    for (let i = 0; i < 21; i++) drop(B.x + (i % 5) * 0.2, B.z + Math.floor(i / 5) * 0.2);   // 21 balls: the gauge at 0.3
    run(0.5);
    assert.ok(Math.abs(st().kpi - 0.3) < 0.04, 'gauge ' + st().kpi);
    for (const m of crew.mats) m.next = 1e9;                                             // no customers: a still bowl
    run(crew.shiftSecs - 12 - crew.shiftT);
    assert.ok(crew.lastCall());
    if (late) { drop(A.x + 2, A.z, p.id); run(0.3); }
    run(crew.shiftSecs);
    assert.equal(crew.phase, 'report');
    const saved = crew.snapshot().mods.tiered.saved;
    if (!late) { assert.equal(saved, undefined, 'no late TARGET, no save'); continue; }
    assert.equal(saved.left, 12);
    assert.equal(saved.by, p.id);
    assert.equal(crew.report.quota?.gaugeOk, true);
    assert.equal(savedLine(saved, { venue: 2, quota: { hit: true } }), `Saved by ${p.name}'s TARGET at 0:12.`);
  }
  assert.equal(clockText(12), '0:12'); assert.equal(clockText(75), '1:15');
  const s = { by: 'x', name: 'Cy', left: 12 };
  assert.equal(savedLine(s, { venue: 2, quota: { hit: true } }), "Saved by Cy's TARGET at 0:12.");
  assert.equal(savedLine(s, { venue: 2, quota: { hit: false } }), '', 'only on a stamped bell');
  assert.equal(savedLine(s, { venue: 3, quota: { hit: true } }), '', 'Tiered only');
  assert.equal(savedLine(null, { venue: 2, quota: { hit: true } }), '');
  assert.ok(savedLine(s, { venue: 2, quota: { hit: true } }).split(/\s+/).length <= 8);
});

test('round 8 #6: a dip back under the tick clears the save; a TARGET outside Last Call is never one', () => {
  const { crew, p, drop, run, st } = setup({ gutters: 1 });
  for (const m of crew.mats) m.next = 1e9;
  for (let i = 0; i < 21; i++) drop(B.x + (i % 5) * 0.2, B.z + Math.floor(i / 5) * 0.2);
  run(0.5);
  drop(A.x + 2, A.z, p.id); run(0.3);                                   // T-119: a lift, but not Last Call
  assert.equal(st().saved, null);
  for (let i = 0; i < 21; i++) drop(B.x + (i % 5) * 0.2, B.z + Math.floor(i / 5) * 0.2);
  run(crew.shiftSecs - 30 - crew.shiftT);
  drop(A.x + 2, A.z, p.id); run(0.3);                                   // T-30: the save
  assert.equal(st().saved?.left, 30);
  for (let i = 0; i < 21; i++) drop(B.x + (i % 5) * 0.2, B.z + Math.floor(i / 5) * 0.2);
  run(0.5);
  assert.equal(st().saved, null, 'the cups filled again: no longer a save');
});
