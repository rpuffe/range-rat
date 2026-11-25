// Round 11 (owner): "Build more bays". Only built bays exist; the crew row adds two a tier at every crew size;
// an old "Open every bay" save keeps everything it had (web/js/bays.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE_LINE, WING_X, LINE_LEN, BUILD, BUILD_ROW, baseMats, buildTier, builtMats, builtUpper, migrateBays,
  matIndex, fixtureBuilt, syncBayFixtures, WING_WALK_X } from '../web/js/bays.js';
import { LINE, MATS, BAYS, activeMats, activeUpper, SHOP_BY_ID, FIXTURES, WASH, SIM } from '../web/js/sim.js';
import { MAP } from '../web/js/map.js';
import { leaveRoute, arriveRoute, UPPER, matOfShot, PLAY_Z } from '../web/js/customers.js';
import { Crew } from '../server/crew.mjs';

test('base counts per crew size stay where they were: 6 solo, 8 for two, 10 for three and up', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(n => baseMats(n)), [6, 8, 10, 10, 10, 10]);
  assert.deepEqual([1, 2, 3, 4].map(n => activeMats(n)), [6, 8, 10, 10]);
  assert.equal(activeMats(0), 6, 'nobody online counts as one');
});

test('each tier builds two more bays at EVERY crew size; four Rats grow past ten, to sixteen', () => {
  const table = [0, 1, 2, 3].map(t => [1, 2, 3, 4].map(n => builtMats(n, { build: t })));
  assert.deepEqual(table, [
    [6, 8, 10, 10],
    [8, 10, 12, 12],
    [10, 12, 14, 14],
    [12, 14, 16, 16],
  ]);
  assert.equal(builtMats(6, { build: 3 }), LINE_LEN, 'capped at the line');
  assert.equal(buildTier({ build: 9 }), BUILD.TIERS, 'a bad save clamps');
  assert.equal(buildTier({ build: -1 }), 0);
  assert.equal(buildTier(null), 0);
});

test('the Upper Deck: 2 a Rat, +2 a tier, six at most', () => {
  assert.deepEqual([0, 1, 2, 3].map(t => [1, 2, 3, 4].map(n => builtUpper(n, { build: t }))), [
    [2, 4, 6, 6], [4, 6, 6, 6], [6, 6, 6, 6], [6, 6, 6, 6],
  ]);
  assert.equal(activeUpper(1, { build: 1 }), 4);
});

test('the row: three tiers, priced early (day 2), mid-Muni (day 3) and at the Club; shown to every crew size', () => {
  assert.equal(SHOP_BY_ID.build, BUILD_ROW);
  assert.equal(BUILD_ROW.tiers.length - 1, BUILD.TIERS);
  assert.deepEqual(BUILD_ROW.tiers.slice(1).map(t => t.cost), [50, 250, 4000]);
  assert.equal(BUILD_ROW.maxCrew, undefined, 'no crew-size cap: four Rats build too');
  assert.equal(BUILD_ROW.tiers[3].minVenue, 1);
  for (const t of BUILD_ROW.tiers) assert.ok(t.desc.length > 0);
});

test('save migration: an old up.bays = 1 keeps everything it had (tier 2: solo 10, 2P 12, 4P 14)', () => {
  const up = migrateBays({ bays: 1, cart: 1 });
  assert.deepEqual(up, { cart: 1, build: 2 });
  for (const n of [1, 2, 3, 4]) assert.ok(builtMats(n, up) >= 10, `${n} Rats keep all ten`);
  assert.equal(builtMats(1, up), 10);
  assert.equal(builtUpper(1, up), 6, 'and all six upper bays, as before');
  assert.deepEqual(migrateBays({ bays: 0, gear: 2 }), { gear: 2 }, 'never bought: nothing added');
  assert.deepEqual(migrateBays({ bays: 1, build: 3 }), { build: 3 }, 'a higher tier wins');
  assert.deepEqual(migrateBays({ build: 1 }), { build: 1 }, 'a new save is untouched');
  assert.equal(migrateBays(null), null);
});

test('save migration on the real Crew: an old solo save seats ten customers; a 4P crew at tier 3 seats sixteen', () => {
  const seated = (save, n) => {
    const clock = { t: 1_000_000 };
    const crew = new Crew('BAYS', save, { shiftSecs: 600, seed: 3, now: () => clock.t });
    for (let i = 0; i < n; i++) { const p = crew.join('R' + i); crew.connect(p); p.x = 30; p.z = 9; }
    crew.startShift();
    for (let i = 0; i < 100; i++) { clock.t += 50; crew.tick(0.05); }
    return { crew, n: crew.mats.filter(m => !m.upper && m.st !== 'empty').length };
  };
  const old = seated({ v: 4, day: 3, up: { bays: 1 } }, 1);
  assert.equal(old.crew.up.build, 2);
  assert.equal(old.crew.up.bays, undefined);
  assert.equal(old.n, 10);
  assert.equal(old.crew.snapshot().nMats, 10);
  const big = seated({ v: 4, day: 6, venue: 1, venueDay: 1, up: { build: 3 } }, 4);
  assert.equal(big.n, 16);
  assert.equal(big.crew.snapshot().nMats, 16);
  assert.ok(big.crew.mats.filter(m => m.i >= BASE_LINE && !m.upper).every(m => m.st !== 'empty'), 'the wing is busy');
  assert.equal(seated({ v: 4, day: 3 }, 1).n, 6, 'solo, nothing built: six');
});

test('the line: the old ten unchanged, the wing west of the left crew bay, clear of the stairs, the Lift and the mower shed', () => {
  assert.equal(LINE.length, LINE_LEN);
  assert.deepEqual(LINE.slice(0, BASE_LINE), MATS, 'the old ten keep their places (the seam goldens fly from them)');
  assert.deepEqual(LINE.map(m => m.i), LINE.map((_, i) => i));
  const leftBay = Math.min(...BAYS.map(b => b.x));
  for (const x of WING_X) {
    assert.ok(x < leftBay - 4, `wing mat ${x} clears the crew bay`);
    assert.ok(x - 2 > MAP.MOWER_SHED.x + 2, 'and the mower shed');
    assert.ok(Math.hypot(x - MAP.LIFT.x, 0 - MAP.LIFT.z) > MAP.LIFT.r + 2.5, 'and the Lift');
    assert.ok(x > SIM.FIELD.xMin + 10, 'inside the nets');
  }
  for (let k = 1; k < WING_X.length; k++) assert.equal(WING_X[k - 1] - WING_X[k], 4, '4 m apart like the old line');
  // A wing customer walks out along the walkway to WING_WALK_X before cutting to the gate (not through the stairs).
  const r = leaveRoute(LINE_LEN - 1);
  assert.deepEqual(r.P[2], [WING_WALK_X, 2.2]);
  assert.ok(WING_WALK_X > -24.55 + 0.45, 'east of the Tiered stairs');
  assert.ok(!leaveRoute(3).P.some(p => p[0] === WING_WALK_X), 'the old line walks out as before');
  assert.ok(arriveRoute(LINE_LEN - 1).tA > 0);
  assert.equal(matOfShot(WING_X[2], 0.1, PLAY_Z), BASE_LINE + 2, 'the swing cue knows the wing');
  assert.equal(UPPER.FROM, LINE_LEN, 'the upper bays ride after the whole line');
});

test('the hose reaches every bay of the wing from the wash station', () => {
  for (const f of FIXTURES.filter(f => f.id.startsWith('mat'))) assert.ok(Math.hypot(f.x - WASH.STATION.x, f.z - WASH.STATION.z) < WASH.HOSE, f.id);
});

test('fixtures: an unbuilt bay holds no mud; a wing bay is a fixture only while built', () => {
  assert.equal(matIndex('mat12'), 12); assert.equal(matIndex('sign'), -1); assert.equal(matIndex('matx'), -1);
  assert.equal(fixtureBuilt('sign', 0), true);
  assert.equal(fixtureBuilt('mat5', 6), true); assert.equal(fixtureBuilt('mat6', 6), false);
  const fx = { sign: 0.9, stand: 0.5 };
  for (let i = 0; i < 10; i++) fx['mat' + i] = 0.4;
  assert.equal(syncBayFixtures(fx, 6), true);
  assert.deepEqual([6, 7, 8, 9].map(i => fx['mat' + i]), [0, 0, 0, 0], 'a closed bay is gone, and so is its mud');
  assert.equal(fx.mat5, 0.4);
  assert.equal(Object.keys(fx).length, 12, 'the old twelve keep their Curb slots (balance unchanged)');
  assert.equal(syncBayFixtures(fx, 6), false, 'idempotent');
  syncBayFixtures(fx, 12);
  assert.equal(fx.mat10, 0); assert.equal(fx.mat11, 0); assert.ok(!('mat12' in fx));
  fx.mat11 = 0.7;
  syncBayFixtures(fx, 10);
  assert.ok(!('mat10' in fx) && !('mat11' in fx), 'the wing leaves Curb when not built');
});

test('the real Crew: Curb counts a built wing bay; nobody can hose a bay that is not built', () => {
  const clock = { t: 1_000_000 };
  const crew = new Crew('WING', { v: 4, day: 6, venue: 1, venueDay: 1, up: { build: 1, wand: 1 } }, { shiftSecs: 600, seed: 2, now: () => clock.t });
  const p = crew.join('Solo'); crew.connect(p);
  crew.startShift();
  clock.t += 50; crew.tick(0.05);
  assert.equal(crew.snapshot().nMats, 8);
  assert.ok(!('mat10' in crew.fixtures));
  assert.equal(crew.curbSlots(), 12);
  // A Rat with the wand beside mat 9 (built? no: solo tier 1 is 0..7)
  p.wand = true; p.x = LINE[9].x + 2; p.z = 0;
  crew.fixtures.mat9 = 0;
  assert.equal(crew.wash(p, 0.5, 'mat9'), false, 'mat 10 is not there');
  p.x = LINE[7].x + 2; crew.fixtures.mat7 = 0.5; clock.t += 500;
  assert.equal(crew.wash(p, 0.5, 'mat7'), true);
  assert.ok(crew.fixtures.mat7 < 0.5);
  // Four Rats at tier 1: twelve bays, the wing's first two join Curb.
  for (let i = 0; i < 3; i++) { const q = crew.join('Q' + i); crew.connect(q); }
  clock.t += 50; crew.tick(0.05);
  assert.equal(crew.snapshot().nMats, 12);
  assert.equal(crew.fixtures.mat10, 0); assert.equal(crew.fixtures.mat11, 0);
  assert.equal(crew.curbSlots(), 14);
});

test('one tip, once, when a tier goes up (8 words or fewer), pointing at the newest bay', async () => {
  const { nextHint, HINTS, BOUGHT_HINT } = await import('../web/js/settings.js');
  const { tipTarget } = await import('../web/js/tips.js');
  assert.ok(HINTS.bays.kb.split(/\s+/).length <= 8);
  assert.equal(BOUGHT_HINT.build, 'bays');
  const base = { seen: ['shop', 'sprint', 'cctv', 'bv'], playSecs: 100, venue: 0, day: 3, cash: 0 };
  assert.equal(nextHint({ ...base, baysFresh: true }), 'bays');
  assert.equal(nextHint({ ...base, baysFresh: false }), null, 'an old save migrating to tier 2 says nothing');
  assert.equal(nextHint({ ...base, seen: [...base.seen, 'bays'], baysFresh: true }), null, 'once ever');
  assert.deepEqual(tipTarget('bays', { nMats: 12 }), { x: LINE[11].x, z: 0, y: 1.6, s: 1 });
});
