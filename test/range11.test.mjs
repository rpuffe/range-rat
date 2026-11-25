// Round 11, builder "range": the owner's ball-return, bucket and hopper notes. The Far return across the creek and its
// tube on posts (layout.js), the bucket filler row (sim.js `filler`, basket.js), the bucket rack's real slots, the silo
// level the chutes drop to, and the hopper counts in plain words (hoppertext.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIM, SHOP_BY_ID, BUCKETS, machineSecs, nextPrice, tierLock, SILO } from '../web/js/sim.js';
import { FIELD_RETURNS, RETURN, RETURN_TUBE, TUBE_TRUNK, TUBE_BRANCH, TUBE_JOIN, tubeRoute, BASKET, BASKET_POINT, BASKET_SLOTS, BUCKET, RACK,
  DISPENSER, CHUTE_BUCKETS, FILLER, FILLER_BUCKET, FILL_POINT, PIPE_FEED, siloLevelY, SILO_BALLS } from '../web/js/layout.js';
import { newBasket, stepBasket, machineProgress } from '../web/js/basket.js';
import { washerBoard, washerPrompt } from '../web/js/hoppertext.js';
import { custPos } from '../web/js/customers.js';
import { MAP, creekProject } from '../web/js/map.js';
import { Crew } from '../server/crew.mjs';

const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pt = p => ({ x: p[0], y: p[1], z: p[2] });

test('the Far return is across the creek: the walk to it from the bank crosses the water', () => {
  for (const r of FIELD_RETURNS) {
    let wet = false;
    for (let k = 0; k <= 400; k++) {
      const x = RETURN.x + (r.x - RETURN.x) * k / 400, z = RETURN.z + (r.z - RETURN.z) * k / 400;
      if (z < -30 && creekProject(x, z).d < MAP.CREEK.HW) wet = true;
    }
    assert.ok(wet, `${r.id} is on the far side of the creek`);
    assert.ok(d(r, RETURN) > 120, `${r.id} is far out (${d(r, RETURN).toFixed(0)} m)`);
  }
});

test('the tube: from each return\'s lid, high on posts across the range, down into the main return\'s bin', () => {
  const far = FIELD_RETURNS[0], back = FIELD_RETURNS[1];
  assert.deepEqual([TUBE_TRUNK[0][0], TUBE_TRUNK[0][2]], [far.x, far.z]);
  assert.deepEqual([TUBE_BRANCH[0][0], TUBE_BRANCH[0][2]], [back.x, back.z]);
  assert.ok(TUBE_TRUNK[0][1] > 1.5 && TUBE_BRANCH[0][1] > 1.5, 'out of the lid');
  const end = pt(TUBE_TRUNK.at(-1));
  assert.ok(Math.abs(end.x - RETURN.x) < RETURN.W / 2 && Math.abs(end.z - RETURN.z) < RETURN.D / 2 && end.y > RETURN.H && end.y < RETURN.H + 0.2, 'drops into the bin top');
  assert.ok(TUBE_TRUNK.includes(TUBE_JOIN) && TUBE_BRANCH.at(-1) === TUBE_JOIN, 'the Back branch joins the trunk');
  assert.equal(tubeRoute('field'), TUBE_TRUNK);
  assert.deepEqual(tubeRoute('back').at(-1), TUBE_TRUNK.at(-1));
  // Overhead everywhere in the field (a cart and a Rat pass under it), clear of the County kerb, inside the nets.
  for (const p of [...TUBE_TRUNK.slice(3, -3), ...TUBE_BRANCH.slice(3)]) {
    assert.ok(p[1] >= 3.3, `high at ${p}`);
    assert.ok(p[0] < MAP.YARDS.xMin - 8 && p[0] > MAP.FIELD.xMin, `inside the range at ${p}`);
  }
  assert.ok(RETURN_TUBE.SECS < 6, 'the batch lands just before the THUNK (dive.js TUBE.DELAY 6 s)');
});

test('the filler row: a cheap slow filler from Muni day 2, the 10 s machine at the Club', () => {
  const row = SHOP_BY_ID.filler;
  assert.ok(row && !SHOP_BY_ID.bucket, 'the row is `filler` now');
  assert.equal(nextPrice('filler', {}, 1, 0, 0, 1), null, 'not on day 1');
  assert.equal(nextPrice('filler', {}, 1, 0, 0, 2), 50);
  assert.equal(nextPrice('filler', {}, 4, 0, 0, 2), 110, 'crew-scaled');
  assert.equal(tierLock(row, 1, 0, 9), 'Range Club', 'the machine waits for the Club');
  assert.equal(nextPrice('filler', { filler: 1 }, 1, 0, 1, 1), 400);
  assert.deepEqual([0, 1, 2].map(machineSecs), [0, BUCKETS.SLOW_SECS, BUCKETS.MACHINE_SECS]);
  assert.equal(BUCKETS.SLOW_SECS, 20);
});

test('stepBasket: the slow filler drops a bucket every 20 s, its progress is on the wire, true still means 10 s', () => {
  const b = newBasket();
  let ev = [];
  for (let i = 0; i < 399; i++) ev.push(...stepBasket(b, 0.05, { machine: machineSecs(1) }));
  assert.equal(b.n, 0);
  assert.ok(Math.abs(machineProgress(b, 20) - 0.9975) < 0.01);
  ev.push(...stepBasket(b, 0.05, { machine: machineSecs(1) }));
  assert.equal(b.n, 1); assert.deepEqual(ev, [{ t: 'bucket', by: 'machine', n: 1 }]);
  assert.equal(machineProgress(b, 0), null, 'no filler: null');
  const c = newBasket();
  for (let i = 0; i < 200; i++) stepBasket(c, 0.05, { machine: true });
  assert.equal(c.n, 1, 'true = the Club machine (10 s)');
});

test('an old save\'s Bucket machine (row `bucket` 1) is the filler row\'s tier 2', () => {
  const crew = new Crew('MIGR', { v: 5, venue: 1, day: 8, venueDay: 3, up: { bucket: 1 } }, { seed: 1, now: () => 1e6, modules: [] });
  assert.equal(crew.up.filler, 2);
  assert.equal(crew.up.bucket, undefined);
  const fresh = new Crew('MIG2', { v: 5, venue: 0, day: 3, up: { filler: 1 } }, { seed: 1, now: () => 1e6, modules: [] });
  assert.equal(fresh.up.filler, 1);
});

test('the bucket rack: 12 real slots, no two buckets touch, clear of the basket, the dispenser and the customers', () => {
  assert.equal(BASKET_SLOTS.length, BUCKETS.BASKET);
  for (let i = 0; i < BASKET_SLOTS.length; i++) for (let j = i + 1; j < BASKET_SLOTS.length; j++)
    assert.ok(d(BASKET_SLOTS[i], BASKET_SLOTS[j]) >= 2 * BUCKET.R + 0.02, `slots ${i} and ${j} overlap`);
  for (const s of BASKET_SLOTS) {
    assert.equal(s.y, RACK.H, 'every bucket sits on the rack, none stacked');
    assert.ok(d(s, BASKET) > BASKET.r + BUCKET.R, 'clear of the wire basket');
    assert.ok(d(s, BASKET_POINT) > 0.6, 'clear of where the customer stands');
    assert.ok(s.x + BUCKET.R < DISPENSER.x - 0.45 || s.z + BUCKET.R < DISPENSER.z - 0.35, 'clear of the dispenser box');
    assert.ok(d(s, FILLER_BUCKET) > 2 * BUCKET.R, 'clear of the filler\'s bucket');
  }
  // The fill buckets: the chutes' on the dispenser's east side by the Rat, the filler's on its west side under its spout.
  for (const c of CHUTE_BUCKETS) assert.ok(c.x - BUCKET.R > DISPENSER.x + 0.45 && d(c, FILL_POINT) < 1.4);
  assert.ok(d(CHUTE_BUCKETS[0], CHUTE_BUCKETS[1]) >= 2 * BUCKET.R);
  assert.ok(FILLER.x + FILLER.W / 2 <= DISPENSER.x - 0.45 + 1e-9, 'the filler bolts on the west side');
  assert.ok(FILLER_BUCKET.z < FILLER.z - FILLER.D / 2 + BUCKET.R, 'its bucket sits under the spout, in front');
});

test('the silo: its level rises with the supply, inside the tube; the feed pipe runs silo -> dispenser dome', () => {
  let last = -1;
  for (let n = 0; n <= SILO_BALLS.MAX; n += 50) { const y = siloLevelY(n); assert.ok(y >= last && y <= SILO_BALLS.H); last = y; }
  assert.ok(siloLevelY(5000) === siloLevelY(SILO_BALLS.MAX));
  const s = pt(PIPE_FEED[0]), e = pt(PIPE_FEED.at(-1));
  assert.ok(Math.abs(d(s, SILO) - SILO.R) < 0.15, 'leaves the silo\'s skin');
  assert.ok(d(e, DISPENSER) < 0.4 && e.y < 1.92 && e.y > 1.5, 'ends inside the dome');
});

test('hopper counts in plain words', () => {
  assert.deepEqual(washerBoard(34, 68), { top: '34 DIRTY BALLS', sub: 'WAITING TO WASH · +$68', amber: false });
  assert.equal(washerBoard(0, 0).top, 'HOPPER EMPTY');
  assert.equal(washerBoard(1, 2).top, '1 DIRTY BALL');
  assert.ok(washerBoard(150, 300).amber);
  assert.match(washerPrompt({ n: 34, owed: 68, btn: 'E' }), /^Hold E: crank 34 balls clean \(\+\$68/);
  assert.match(washerPrompt({ n: 34, owed: 68, btn: 'A', pad: true }), /^Tap A/);
  assert.match(washerPrompt({ cranking: true, n: 5 }), /5 balls still dirty/);
  assert.match(washerPrompt({ n: 0 }), /empty/);
});

test('a playing customer has set the bucket down (ballreturn.js draws it by the mat)', () => {
  const p = custPos({ mat: 3, st: 'playing', t0: 0 }, 5);
  assert.equal(p.carry, false);
  assert.equal(custPos({ mat: 3, st: 'leave', t0: 0 }, 1).carry, false, 'they walk out empty-handed (the bucket model is always full)');
});
