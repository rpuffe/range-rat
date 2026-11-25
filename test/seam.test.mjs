// The venue seam (council round 4, build item 3): world-dependent geometry, the fourth gauge, and the module
// registries. The GOLDEN fingerprints below were recorded at commit 3d6f5d8, before the seam touched anything:
// at the Muni and the Club the seam must change nothing at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIM, launch, leadLaunch, swingLaunch, spill, advanceBall, ballValue, perks, clampToField, mulberry32, MATS, BAYS,
  upkeepCeiling, VENUE_RULES, revealCards, stepCart } from '../web/js/sim.js';
import { MAP, SNAG, cartBlocked, fieldFor, netsFor, netClamp, ballFeatures, cartSpeedAt, onTrack, trackDist, kerbBlocked } from '../web/js/map.js';
import { Crew } from '../server/crew.mjs';
import { VenueHooks, MODULES, checkModule } from '../server/venues/index.mjs';
import { createViews } from '../web/js/views/registry.js';

// ---- golden fingerprints ------------------------------------------------------------------------------------------
function fnv(parts) {
  let h = 0x811c9dc5;
  for (const s of parts) for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}
function fly(b, world) {                     // to rest (or drift, or 30 s), then where it ended
  b = { ...b, rest: false, acc: 0 };
  let r = false;
  for (let i = 0; i < 30 * 60 && !r; i++) r = advanceBall(b, 1 / 60, world);
  return `${b.x.toFixed(5)},${b.z.toFixed(5)},${b.y.toFixed(5)},${r === 'drift' ? 'd' : r ? 'r' : 'f'}`;
}
function landings(venue) {
  const world = { venue }, rng = mulberry32(1234), out = [];
  const kinds = ['range', 'range', 'bouncy', 'square'];
  for (let i = 0; i < 120; i++) out.push(fly({ ...launch(MATS[i % MATS.length], rng, { beginner: i % 7 === 0 }), kind: kinds[i % 4] }, world));
  for (let i = 0; i < 20; i++) out.push(fly({ ...leadLaunch(MATS[i % 10], rng), kind: 'lead' }, world));
  for (let i = 0; i < 80; i++) {             // crew swings, sprayed wide into both side nets, and curved
    const bay = BAYS[i % 2], yaw = (rng() - 0.5) * 2.4, pitch = rng() * 0.6, power = 0.3 + rng() * 0.85;
    out.push(fly({ ...swingLaunch(bay, yaw, pitch, power), curve: (rng() - 0.5) * 2, kind: 'range' }, world));
  }
  for (const s of spill(10, -40, 12, rng)) out.push(fly({ ...s, kind: 'range' }, world));
  return out;
}
function cartGrid(venue) {
  const world = { venue }, out = [];
  for (let x = -70; x <= 100; x += 1.25) {
    let row = '';
    for (let z = -195; z <= 20; z += 1.25) row += cartBlocked(x, z, world) ? '1' : '0';
    out.push(row);
  }
  return out;
}
function fieldClamps(world) {
  const rng = mulberry32(77), out = [];
  for (let i = 0; i < 400; i++) {
    const p = { x: -120 + rng() * 240, z: -230 + rng() * 260 };
    world === undefined ? clampToField(p) : clampToField(p, world);
    out.push(`${p.x.toFixed(4)},${p.z.toFixed(4)}`);
  }
  return out;
}
function bvs() {
  const rng = mulberry32(9), out = [];
  for (let i = 0; i < 200; i++) {
    const k = perks({ washer: i % 4, ads: i % 3 });
    out.push(JSON.stringify(ballValue({ perks: k, mult: 1 + (i % 5) * 0.25, cart: i % 3 ? { mud: rng() } : null, curb: rng(),
      pond: i % 2 ? rng() : null, fries: i % 4 > 1 ? rng() : null, commendations: i % 11, venue: i % 2 })));
  }
  return out;
}
function crewRun(save, opts = {}) {          // a whole seeded crew: customers, helpers, the cart, the pond
  const clock = { t: 1_000_000 };
  const crew = new Crew('GOLD', save, { shiftSecs: 90, seed: 7, now: () => clock.t, ...opts });
  const a = crew.join('A'), b = crew.join('B');
  crew.connect(a); crew.connect(b);
  crew.startShift();
  const out = [];
  for (let i = 0; i < 90 * 20; i++) {
    clock.t += 50; crew.tick(0.05);
    if (i % 200 === 0) { a.x = -20 + (i % 37); a.z = -30 - (i % 50); crew.input(a, { x: a.x, z: a.z }); }
    if (i % 100 === 0) out.push(crew.cash.toFixed(2), String(crew.balls.size), JSON.stringify(crew.valueNow()));
  }
  for (const bl of crew.balls.values()) out.push(`${bl.id}:${bl.x.toFixed(4)},${bl.z.toFixed(4)},${bl.rest},${bl.kind}`);
  out.push(JSON.stringify(crew.stats), String(crew.ceiling()), JSON.stringify(crew.quota));
  return out;
}
const CLUB_SAVE = { venue: 1, day: 6, venueDay: 2, stamps: 2, up: { cart: 1, helpers: 2, shed: 1, washer: 2 } };   // stamps 2: the quota climbs with stamps (playtest), so this keeps the recorded day-3 target

test('GOLDEN: ball landings at the Muni and the Club are unchanged', () => {
  assert.equal(fnv(landings(0)), 'b27ddabd');
  assert.equal(fnv(landings(1)), 'b488577a');
  assert.deepEqual(landings(1).slice(140, 143), ['-64.47534,-77.40055,0.06000,r', '64.46103,-57.91526,0.06000,r', '41.42574,-78.22139,0.06000,r'],
    'the side nets still catch at +-64.5');
});

test('GOLDEN: cartBlocked, fieldFor, clampToField and BV are unchanged at venues 0-1', () => {
  assert.equal(fnv(cartGrid(0)), '57cd6cee');
  assert.equal(fnv(cartGrid(1)), '57cd6cee');
  for (const w of [undefined, { venue: 0 }, { venue: 1 }, { venue: 2 }, { venue: 3 }]) assert.equal(fnv(fieldClamps(w)), 'c2fe5e4b', JSON.stringify(w));
  for (const v of [0, 1, 2, 3]) {
    assert.equal(fieldFor({ venue: v }), MAP.FIELD);
    assert.deepEqual(netsFor({ venue: v }), { left: -64.5, right: 64.5, back: -190 });
  }
  assert.deepEqual(fieldFor(), SIM.FIELD);
  // Re-recorded for owner playtest 3 §1.4 (the one price, one cause: put SIM.CLEAN_KIT back to 1 and the gear factors
  // back to 1 + 0.25 x cleanliness and a648feb3 comes out again).
  assert.equal(fnv(bvs()), '18de0432', 'BV is byte-identical with no kpi');
  assert.equal('kpi' in ballValue({ perks: perks({}), curb: 1 }), false, 'no kpi key unless a venue has one');
});

// Club golden re-recorded for council round 6 #8 (squares: x2, 0.15 share, and the reels refuse them); the Muni run is day 1.
// Both re-recorded for the owner layout (2026-11-24), checked one cause at a time: the Muni run moved only with the
// customers' walk to the basket by the dispenser (was 10b46ff0), the Club run only with the bank point moving to the
// ball return, where its two teenagers bank (was 71c4c5b). With both put back, the old fingerprints come out exactly.
// Council round 10 #5: the Club run re-recorded for the creek snags (one cause: SNAG.ON = 0 gives a1dfbc50 again, below).
// Round 11 (expert pacing review): all three re-recorded. The causes, each checked by its builder: the end-of-day taper,
// the busier daytime crowd and the spotless/goal-reward cash (Muni and Club), and gear grime folded into the Clean %
// (Club). The bays, Today, range and late work leave them unchanged. The venue-2+ module still changes nothing.
test('GOLDEN: a whole seeded crew plays out identically at the Muni and the Club (no modules)', () => {
  assert.equal(fnv(crewRun(null)), 'dee0fab1');
  assert.equal(fnv(crewRun(CLUB_SAVE)), 'ba21dc31');
});

test('GOLDEN: with the creek snags off, the Club run is the pre-round-10 fingerprint', (t) => {
  SNAG.ON = 0; t.after(() => { SNAG.ON = 1; });
  assert.equal(fnv(crewRun(CLUB_SAVE)), 'dee791b9');
});

test('GOLDEN: a module that lives at venue 2+ changes nothing at venues 0-1', () => {
  const noisy = { id: 'noisy', venue: 2, kpi: () => 0, launchMod: (c, st, shot) => ({ ...shot, vx: shot.vx + 9 }), tick: c => { c.cash += 1000; } };
  assert.equal(fnv(crewRun(null, { modules: [noisy] })), 'dee0fab1');
  assert.equal(fnv(crewRun(CLUB_SAVE, { modules: [noisy] })), 'ba21dc31');
});

// ---- the fourth gauge ------------------------------------------------------------------------------------------------
test('kpi: 1 gives an Upkeep ceiling of 3.0, and the KPI adds 0.5 x kpi to Upkeep', () => {
  assert.equal(upkeepCeiling({ pond: 1, fries: 1, kpi: 1 }), 3.0);
  assert.equal(upkeepCeiling({ pond: 1, fries: 1 }), 2.5);
  assert.equal(upkeepCeiling({ pond: 1, fries: 1, kpi: 0 }), 3.0, 'the slot counts, whatever the dial reads');
  const k = perks({});
  assert.equal(ballValue({ perks: k, curb: 1, pond: 1, fries: 1, kpi: 1 }).upkeep, 3.0);
  assert.equal(ballValue({ perks: k, curb: 1, pond: 1, fries: 1, kpi: 0.5 }).upkeep, 2.75);
  assert.equal(ballValue({ perks: k, curb: 1, kpi: 7 }).kpi, 1, 'clamped');
  assert.equal(ballValue({ perks: k, curb: 1, kpi: 0.5 }).bv, 2.19, '1.25 (the one price) x 1.75');
});

const dummyKpi = (venue, v = 1) => ({ id: 'dial', venue, kpi: () => v });
function crewAt(venue, modules = [], extra = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('SEAM', { venue, day: 5, venueDay: 1, up: { shed: 1 }, ...extra }, { shiftSecs: 60, seed: 3, now: () => clock.t, modules });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}

test('the Crew: a venue KPI lifts the ceiling to 3.0 and the quota scales with it; only the current venue is graded', () => {
  assert.equal(crewAt(2).crew.ceiling(), 2.5, 'Tiered with no module yet: as before');
  const { crew } = crewAt(2, [dummyKpi(2, 0.5)]);
  assert.equal(crew.ceiling(), 3.0);
  assert.equal(crew.valueNow().kpi, 0.5);
  crew.startShift();
  const base = crewAt(2).crew; base.startShift();
  assert.ok(crew.quota.q > base.quota.q, 'the quota scales with the ceiling');
  assert.ok(Math.abs(crew.quota.q / base.quota.q - 2 / 1.5) < 1e-9);
  // At the Stadium, the Tiered dial is still in the world but no longer graded.
  const later = crewAt(3, [dummyKpi(2, 0.5)]).crew;
  assert.equal(later.valueNow().kpi, undefined);
  assert.equal(later.ceiling(), 2.5);
  assert.equal(crewAt(1, [dummyKpi(2, 0.5)], { venueDay: 2 }).crew.ceiling(), 2.5, 'nor before it');   // round 11: Club day 2, the pond filled
});

test('VENUE_RULES: a KPI label and a how-to card from Tiered on; the reveal shows the how-to second', () => {
  assert.equal(VENUE_RULES[0].kpi, undefined); assert.equal(VENUE_RULES[1].kpi, undefined);
  assert.deepEqual(VENUE_RULES.slice(2).map(r => r.kpi), ['BAY UTILIZATION', 'CROWD SENTIMENT', 'ZONING COMPLIANCE', 'ORBITAL DEBRIS']);
  for (const r of VENUE_RULES.slice(2, 5)) assert.ok(r.howto?.startsWith('New: '));
  assert.equal(VENUE_RULES[5].howto, 'The Lift is open. Keep the sky clear.');   // round 7 #5: the Orbital's job is the sky
  assert.deepEqual(revealCards(1, 'memo'), ['memo']);
  assert.deepEqual(revealCards(2, 'memo'), ['memo', VENUE_RULES[2].howto]);
  assert.deepEqual(revealCards(6, 'Under New Management.'), ['Under New Management.']);
});

// ---- the server registry ---------------------------------------------------------------------------------------------
// A dummy module that records every hook it sees (tests only: never in MODULES).
function recorder(venue = 2) {
  const log = [];
  const rec = name => (crew, st, ...a) => { log.push(name); st.n = (st.n ?? 0) + 1; return undefined; };
  const m = {
    id: 'dummy', venue,
    init(crew, saved) { log.push('init'); return { n: 0, saved: saved ?? null }; },
    startShift: rec('startShift'), tick: rec('tick'), serve: rec('serve'), knockDown: rec('knockDown'),
    ping(crew, st, b, info) { log.push('ping:' + info.prize); },
    endShift(crew, st, ending) { log.push('endShift'); st.ended = (st.ended ?? 0) + 1; },
    input(crew, st, p, a) { if (a.t !== 'dummy') return false; log.push('input'); st.pressed = a.n; return true; },
    launchMod(crew, st, shot, info) { log.push('launchMod'); return { ...shot, tagged: info.kind }; },
    onRest(crew, st, b) { log.push('onRest'); },
    signal(crew, st, name, data) { log.push('signal:' + name); },
    kpi: () => 0.25,
    snapshot(crew, st) { return { n: st.n, pressed: st.pressed ?? 0 }; },
    toSave(crew, st) { return { ended: st.ended ?? 0, pressed: st.pressed ?? 0 }; },
  };
  return { m, log };
}

test('a dummy module\'s hooks fire in order: init, startShift, ticks with shots and rests, inputs, endShift', () => {
  const { m, log } = recorder(2);
  const { crew, clock, run } = crewAt(2, [m]);
  assert.deepEqual(log, ['init']);
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift();
  assert.deepEqual(log.slice(0, 2), ['init', 'startShift']);
  run(20);
  assert.ok(log.includes('tick') && log.includes('launchMod') && log.includes('onRest'));
  assert.ok(log.indexOf('launchMod') < log.indexOf('onRest'), 'a shot spawns before it can rest');
  const spawned = [...crew.balls.values()].filter(b => b.tagged);
  assert.ok(spawned.length > 0, 'launchMod reshaped the customers\' shots');
  // A module's own action, routed by crew.input.
  crew.input(p, { a: [{ t: 'dummy', n: 7 }] });
  assert.equal(crew.mods.state('dummy').pressed, 7);
  assert.deepEqual(crew.snapshot().mods.dummy.pressed, 7);
  // Serve (at the shed), a knockdown, a signal.
  p.x = 42; p.z = 6; clock.t += 10_000;
  crew.serve(p, { item: 'fries', quality: 'perfect' });
  crew.knockDown(p, 'test');
  crew.mods.signal('target', { by: p.id });
  run(60);                                   // the bell
  assert.equal(crew.phase, 'report');
  const order = ['init', 'startShift', 'launchMod', 'onRest', 'input', 'serve', 'knockDown', 'signal:target', 'endShift'];
  const at = order.map(n => log.indexOf(n));
  assert.ok(at.every(i => i >= 0), JSON.stringify(at));
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'in order');
  assert.equal(log.filter(n => n === 'endShift').length, 1);
  assert.equal(crew.valueNow().kpi, 0.25);
});

test('a module\'s save key round-trips through the registry; unknown keys are kept', () => {
  const { m } = recorder(2);
  const { crew, run } = crewAt(2, [m], { mods: { ghost: { keep: 1 } } });
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift(); crew.input(p, { a: [{ t: 'dummy', n: 3 }] }); run(61);
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.deepEqual(save.mods, { ghost: { keep: 1 }, dummy: { ended: 1, pressed: 3 } });
  const again = recorder(2);
  const back = new Crew('SEAM', save, { modules: [again.m], seed: 1 });
  assert.deepEqual(back.mods.state('dummy').saved, { ended: 1, pressed: 3 });
  // No module with anything to keep: no mods key at all (old saves stay byte-compatible).
  assert.equal('mods' in crewAt(1).crew.toSave(), false);
  // Junk under mods is ignored.
  assert.doesNotThrow(() => new Crew('SEAM', { mods: 'junk' }, { modules: [recorder().m] }));
  assert.equal(new Crew('SEAM', { mods: [1, 2] }, { modules: [recorder().m] }).mods.state('dummy').saved, null);
});

test('modules are inactive below their venue (only init runs) and stay active above it', () => {
  const low = recorder(2);
  const { crew, run } = crewAt(1, [low.m]);
  crew.startShift(); run(5);
  assert.deepEqual(low.log, ['init']);
  assert.deepEqual(crew.snapshot().mods, {});
  const high = recorder(2);
  const c3 = crewAt(3, [high.m]);
  c3.crew.startShift(); c3.run(1);
  assert.ok(high.log.includes('tick'), 'the bowls are still there at the Stadium');
});

test('the registry checks modules: ids, venues, hook names, duplicates; and the production list is valid', () => {
  assert.throws(() => checkModule({ id: 'Bad Id', venue: 2 }));
  assert.throws(() => checkModule({ id: 'ok', venue: 9 }));
  assert.throws(() => checkModule({ id: 'ok', venue: 2, onTick() {} }), /unknown hook onTick/);
  assert.throws(() => checkModule({ id: 'ok', venue: 2, tick: 3 }));
  assert.throws(() => new VenueHooks({ venue: 0 }, [{ id: 'a', venue: 2 }, { id: 'a', venue: 3 }]), /duplicate/);
  for (const m of MODULES) checkModule(m);
  assert.ok(!MODULES.some(m => m.id === 'dummy'), 'the dummy module lives in tests only');
});

test('veto, first, pipe and payCash: Gary\'s stop can be failed, inputs claimed, cash never below $0', () => {
  const veto = { id: 'veto', venue: 2, inspect: (c, st, id) => (id === 'kitchen' ? false : undefined) };
  const { crew } = crewAt(2, [veto]);
  crew.fries = 20;
  assert.equal(crew.inspectBase('kitchen'), true);
  assert.equal(crew.inspect('kitchen'), false);
  crew.fixtures.sign = 0;
  assert.equal(crew.inspect('sign'), true);
  crew.cash = 100;
  assert.equal(crew.payCash(-250), -100);
  assert.equal(crew.cash, 0);
  const p = crew.join('Pat');
  assert.equal(crew.payCash(55.5, p.id), 55.5);
  assert.equal(p.shift.cash, 55.5);
  // A once-ever module PA line can be big (ignores the per-shift cap).
  crew.paShift = 99;
  assert.equal(crew.pa('overserved', { once: true }), false);
  assert.equal(crew.pa('overserved', { once: true, big: true }), true);
  assert.equal(crew.pa('overserved', { once: true, big: true }), false, 'once');
});

test('awards from a module join the ledger; clamp lets a module place its own walkers', () => {
  const m = { id: 'aw', venue: 2, awards: () => [['Last Orders', 'sixth']], clamp: (c, st, p) => (p.eva ? true : undefined) };
  const { crew } = crewAt(2, [m]);
  const a = crew.join('A'), b = crew.join('B'); crew.connect(a); crew.connect(b);
  a.shift.sixth = 1;
  b.shift.banked = 5;
  const led = crew.ledger();
  assert.equal(led.find(l => l.id === a.id).award, 'Last Orders');
  b.eva = true; b.movedAt = crew.now() - 1000;
  crew.input(b, { x: b.x, z: 12 });         // past zMax 9: a module that placed it keeps it
  assert.equal(b.z, 12);
  a.movedAt = crew.now() - 1000;
  crew.input(a, { x: a.x, z: 12 });
  assert.equal(a.z, SIM.FIELD.zMax);
});

// ---- world-dependent geometry ----------------------------------------------------------------------------------------
test('at venue 4 a ball at x 80 is not clamped, and a cart at x 66 is blocked', () => {
  const W4 = { venue: 4 }, W1 = { venue: 1 };
  const b = { x: 80, y: 0.06, z: -100, vx: 0.4, vy: 0, vz: 0, kind: 'range', rest: false, acc: 0 };
  let r = false;
  for (let i = 0; i < 600 && !r; i++) r = advanceBall(b, 1 / 60, W4);
  assert.equal(r, true);
  assert.ok(b.x > 80 && b.x < 81, `rested in the Yards at ${b.x}`);
  const c = { x: 80, y: 1, z: -100, vx: 0, vy: 0, vz: 0 };
  assert.equal(netClamp(c, W4), false);
  assert.equal(c.x, 80);
  assert.equal(netClamp({ ...c }, W1), true, 'at the Club that is outside the net');
  const far = { x: 99, y: 2, z: -100, vx: 5, vy: 0, vz: 0 };
  assert.equal(ballFeatures(far, W4), true); assert.equal(far.x, MAP.YARDS.NET_X);
  const p = { x: 80, z: -100 };
  clampToField(p, W4); assert.equal(p.x, 80);
  clampToField(p, W1); assert.equal(p.x, 64);
  assert.equal(cartBlocked(66, -100, W4), true);
  assert.equal(cartBlocked(64.2, -100, W4), true, 'the kerb');
  assert.equal(kerbBlocked(64.2, -100, W4), true);
  assert.equal(kerbBlocked(64.2, -100, { venue: 3 }), false);
  assert.equal(cartBlocked(60, -100, W4), false);
});

test('at venue 4 the server lets a Rat walk into the Yards, and keeps the cart behind the kerb', () => {
  const { crew, clock } = crewAt(4, [], { up: { cart: 1 } });
  const p = crew.join('Pat'); crew.connect(p);
  p.x = 63; p.z = -60;
  for (let i = 0; i < 20; i++) { clock.t += 250; crew.input(p, { x: p.x + 1, z: -60 }); }
  assert.ok(p.x > 75, `walked out to ${p.x}`);
  const c1 = crewAt(1).crew, q = c1.join('Q'); c1.connect(q); q.x = 63; q.z = -60;
  c1.input(q, { x: 64.5, z: -60 }); assert.ok(q.x <= 64);
  // The cart: drive at the kerb.
  const d = crew.join('Dee'); crew.connect(d);
  Object.assign(crew.cart, { x: 60, z: -60 }); d.x = 60; d.z = -60;
  assert.equal(crew.board(d), true);
  for (let i = 0; i < 20; i++) { clock.t += 250; crew.input(d, { cart: { x: crew.cart.x + 2, z: -60, yaw: -Math.PI / 2 } }); }
  assert.ok(crew.cart.x <= 64, `the cart stopped at ${crew.cart.x}`);
});

test('the Ping Track: geometry, and the cart x1.3 on it only from the Stadium on', () => {
  const T = MAP.TRACK;
  assert.ok(trackDist(T.x + T.a, T.z) < 1e-6);
  assert.ok(trackDist(T.x, T.z - T.b) < 1e-6);
  assert.ok(Math.abs(trackDist(T.x, T.z - T.b - 2) - 2) < 1e-6);
  assert.ok(onTrack(T.x + T.a + 2.4, T.z) && !onTrack(T.x + T.a + 2.6, T.z), 'w 5: edges at +-2.5');
  assert.equal(cartSpeedAt(T.x + T.a, T.z, { venue: 3 }), 1.3);
  assert.equal(cartSpeedAt(T.x + T.a, T.z, { venue: 2 }), 1);
  assert.equal(cartSpeedAt(T.x, T.z, { venue: 3 }), 1, 'the infield is ordinary turf');
  assert.equal(cartSpeedAt(31, 10, { venue: 5 }), 1);
  // Clearances from §3.1/§3.2: Bowl A by >= 2.5 m, the mats (z 0) by >= 9.5 m.
  const A = MAP.BOWLS[0];
  let minA = Infinity;
  for (let a = 0; a < Math.PI * 2; a += 0.01) minA = Math.min(minA, trackDist(A.x + Math.cos(a) * A.r, A.z + Math.sin(a) * A.r) - T.w / 2);
  assert.ok(minA >= 2.4, `Bowl A clearance ${minA}`);
  assert.ok(T.z + T.b + T.w / 2 <= -9.5);
  // The Lift's platform stops the cart at the Orbital only.
  assert.equal(cartBlocked(MAP.LIFT.x, MAP.LIFT.z, { venue: 5 }), true);
  assert.equal(cartBlocked(MAP.LIFT.x, MAP.LIFT.z, { venue: 4 }), false);
});

test('stepCart with cartSpeedAt: faster on the Track at the Stadium', () => {
  const run = venue => {
    const c = { x: MAP.TRACK.x, z: MAP.TRACK.z - MAP.TRACK.b, yaw: Math.PI / 2, v: 0 };   // heading -x along the bottom straight
    for (let i = 0; i < 150; i++) stepCart(c, 1, 0, 1 / 60, 9 * cartSpeedAt(c.x, c.z, { venue }), { venue });   // 2.5 s: still on the curve
    return c.v;
  };
  assert.ok(Math.abs(run(2) - 9) < 1e-9);
  assert.ok(Math.abs(run(3) - 11.7) < 1e-9);
});

// ---- the client registry (pure: no THREE needed) ---------------------------------------------------------------------
test('views: created lazily at their venue, shown and hidden, called in order, first answer wins', () => {
  const log = [];
  const mk = (id, venue, extra = {}) => ({ id, venue, create(ctx) { log.push('create:' + id); return {
    show(on) { log.push(`show:${id}:${on}`); }, onSnapshot(s, mine) { log.push(`snap:${id}:${mine?.v ?? '-'}`); },
    onEvent(e) { log.push(`ev:${id}:${e.t}`); }, ...extra }; } });
  const v = createViews({}, [mk('a', 2, { prompt: () => 'A says', banner: () => null, amb: () => ({ crowd: 0.9 }), reportLines: () => ['a line'] }),
    mk('b', 3, { prompt: () => 'B says', use: () => true, banner: () => ({ text: 'DAYS WITHOUT AN INCIDENT: 4' }), speedMul: () => 0 })]);
  v.onSnapshot({ venue: 1 });
  assert.deepEqual(log, [], 'nothing is built at the Club');
  assert.equal(v.prompt('A'), null); assert.equal(v.use(), false); assert.equal(v.count, 0);
  v.onSnapshot({ venue: 2, mods: { a: { v: 1 } } });
  assert.deepEqual(log, ['create:a', 'show:a:true', 'snap:a:1']);
  assert.equal(v.prompt('A'), 'A says');
  v.onSnapshot({ venue: 3, mods: {} });
  assert.equal(v.prompt('A'), 'A says', 'registry order');
  assert.equal(v.use(), true);
  assert.deepEqual(v.banner({}), { text: 'DAYS WITHOUT AN INCIDENT: 4' });
  assert.deepEqual(v.amb({}), { crowd: 0.9 });
  assert.deepEqual(v.reportLines({}), ['a line']);
  assert.equal(v.speedMul({}), 0, 'a zero multiplier is an answer');
  v.onEvent({ t: 'ping' });
  assert.ok(log.includes('ev:a:ping') && log.includes('ev:b:ping'));
  log.length = 0;
  v.onSnapshot({ venue: 1 });
  assert.deepEqual(log, ['show:a:false', 'show:b:false']);
  v.onSnapshot({ venue: 0, endless: true });
  assert.ok(log.includes('show:a:true') && log.includes('show:b:true'), 'endless counts as the Orbital');
  assert.equal(log.filter(l => l.startsWith('create')).length, 0, 'built once');
});

test('views: use() passes fromPad, and unlatch / lockLook reach the view that latched (the Lift crank)', () => {
  let latched = false;
  const v = createViews({}, [{ id: 'l', venue: 2, create: () => ({ show() {},
    use: fromPad => { if (latched) { latched = false; return true; } if (fromPad) { latched = true; return true; } return false; },
    unlatch: () => { if (!latched) return false; latched = false; return true; }, lockLook: () => latched, capturing: () => latched }) }]);
  v.onSnapshot({ venue: 2, mods: {} });
  assert.equal(v.use(false), false, 'a mouse click does not latch');
  assert.equal(v.use(true), true); assert.equal(v.lockLook(), true); assert.equal(v.capturing(), true);
  assert.equal(v.unlatch(), true); assert.equal(v.lockLook(), false); assert.equal(v.capturing(), false);
  v.use(true); assert.equal(v.use(true), true, 'a second tap lets go'); assert.equal(v.lockLook(), false);
});
