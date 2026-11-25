// The owner's layout (2026-11-24): a ball-flow chain you can see. Return by the mats -> (washer) -> the bank's silo;
// customers take a bucket from the basket by the dispenser. web/js/layout.js, sim.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIM, MATS, BAYS, CART, WASHER, WASHER_HANDLES, BANK, SILO, FIXTURE_BY_ID, GARY, atStand, WASH } from '../web/js/sim.js';
import { RETURN, PIPE_DIRECT, PIPE_WASHER, BASKET, BASKET_POINT, DISPENSER, siloEntry } from '../web/js/layout.js';
import { ENTRANCE_PATH, APPROACH_Z, arriveRoute } from '../web/js/customers.js';
import { cartBlocked } from '../web/js/map.js';

const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const pt = p => ({ x: p[0], y: p[1], z: p[2] });

test('the return is the bank point, at the yard edge by the mat line, and the stand fixture moved with it', () => {
  assert.deepEqual(SIM.STAND, { x: RETURN.x, z: RETURN.z });
  assert.ok(SIM.STAND.z > 0 && SIM.STAND.z < APPROACH_Z + 0.5, 'just behind the mat line');
  assert.ok(SIM.STAND.x > MATS[9].x + 4, 'beside the customers, not on their mats');
  assert.ok(d(SIM.STAND, BAYS[0]) > 3, 'clear of the right crew bay');
  assert.deepEqual({ x: FIXTURE_BY_ID.stand.x, z: FIXTURE_BY_ID.stand.z }, SIM.STAND);
  assert.ok(d(SIM.STAND, BANK) > 4, 'the Board and silo stay where they were');
  assert.ok(atStand(SIM.SPAWN) === false && d(SIM.SPAWN, SIM.STAND) < 6, 'a Rat clocks in a few steps from it');
});

test('the cart unloads at the return, not where it parks, and can drive there', () => {
  const reach = SIM.STAND_REACH + 2.5;
  assert.ok(d(CART.PARK, SIM.STAND) > reach && d(CART.PARK2, SIM.STAND) > reach, 'parking never unloads by itself');
  for (const z of [-2, -1, 0]) assert.equal(cartBlocked(SIM.STAND.x, z, { venue: 0 }), false, 'the field side is open');
});

test('pipe: from the return\'s back to the silo, and through the washer once it is bought', () => {
  const s = pt(PIPE_DIRECT[0]), e = pt(PIPE_DIRECT.at(-1));
  assert.ok(Math.abs(s.z - (RETURN.z + RETURN.D / 2)) < 0.1 && s.y < RETURN.H, 'leaves the bin low, on the bank side');
  assert.ok(Math.abs(d(e, SILO) - SILO.R) < 0.05, 'ends on the silo skin');
  for (let i = 1; i < PIPE_DIRECT.length; i++) assert.ok(PIPE_DIRECT[i][1] <= PIPE_DIRECT[i - 1][1], 'the direct pipe only falls');
  assert.deepEqual(PIPE_WASHER[0], PIPE_DIRECT[0]);
  const top = pt(PIPE_WASHER.at(-1));
  assert.ok(d(top, WASHER) < 0.2 && top.y > 1.91, 'drops into the hopper from above its rim');
  // The washer sits between: closer to the return than the silo is, and on the line from one to the other.
  const along = ((WASHER.x - SIM.STAND.x) * (SILO.x - SIM.STAND.x) + (WASHER.z - SIM.STAND.z) * (SILO.z - SIM.STAND.z)) / d(SILO, SIM.STAND) ** 2;
  assert.ok(along > 0.3 && along < 0.75, `washer at ${along.toFixed(2)} of the way`);
  assert.deepEqual(WASHER_HANDLES.L, { x: WASHER.x - 1.4, z: WASHER.z });
  assert.deepEqual(WASHER_HANDLES.R, { x: WASHER.x + 1.4, z: WASHER.z });
  assert.ok(Math.abs(d(siloEntry(WASHER, 0.8), SILO) - SILO.R - 0.02) < 1e-9);
});

test('customers: gate -> the basket at the dispenser -> mat; the basket is out of the Rats\' way', () => {
  assert.deepEqual(ENTRANCE_PATH.at(-1), [BASKET_POINT.x, BASKET_POINT.z]);
  assert.ok(BASKET_POINT.z < BASKET.z && BASKET.z < DISPENSER.z - 0.35, 'standing in front of the basket, the basket in front of the machine');
  const r = arriveRoute(4);
  assert.deepEqual(r.A.at(-1), [BASKET_POINT.x, BASKET_POINT.z]);
  assert.deepEqual(r.B[0], [BASKET_POINT.x, BASKET_POINT.z]);
  assert.ok(d(BASKET, SIM.STAND) > 5 && d(BASKET, WASHER) > 3, 'not at the return, nor the washer');
  assert.ok(d(BASKET, WASH.STATION) > 10);
});

test('Gary still pulls up behind the Board; the huddle ring is round the return in front of it', () => {
  const stop = GARY.STOPS.find(s => s.id === 'stand');
  assert.ok(d(stop, BANK) < 5, 'his stand stop is at the bank');
  assert.ok(d(stop, SIM.STAND) > GARY.HUDDLE_R, 'he parks outside the ring, so nobody in it is in his way');
});

// Council round 10 §C: the Field return (10, -62) and the Back return (-6, -128).
import { FIELD_RETURNS, FIELD_RETURN, fieldReturns, atFieldReturn, nearestReturn } from '../web/js/layout.js';
import { MAP, creekProject, trackDist } from '../web/js/map.js';
import { MOWER } from '../web/js/mowe.js';
import { POND } from '../web/js/sim.js';

test('the field returns clear the bowls, the pond, the creek, the Track and every MOW-E lane', () => {
  assert.deepEqual(FIELD_RETURNS.map(r => [r.id, r.x, r.z, r.tier]), [['field', 10, -62, 1], ['back', -6, -128, 2]]);
  for (const r of FIELD_RETURNS) {
    for (const b of MAP.BOWLS) assert.ok(d(r, b) > b.r + 2, `${r.id} clears Bowl ${b.id} (${d(r, b).toFixed(1)} m)`);
    assert.ok(d(r, POND) > POND.r + 10, `${r.id} clears the pond`);
    assert.ok(creekProject(r.x, r.z).d > MAP.CREEK.HW + 5, `${r.id} clears the creek`);
    assert.ok(trackDist(r.x, r.z) > MAP.TRACK.w / 2 + 3, `${r.id} clears the Track`);
    for (const z of MOWER.LANES) assert.ok(Math.abs(r.z - z) > 2 + 2, `${r.id} clears MOW-E's lane at z ${z}`);
    for (const t of MAP.BOXES ?? []) assert.ok(d(r, t) > 4, `${r.id} clears ${t.id}`);
  }
  assert.ok(Math.abs(d(FIELD_RETURNS[0], MAP.BOWLS[0]) - 19.8) < 0.1 && Math.abs(d(FIELD_RETURNS[0], MAP.BOWLS[1]) - 21) < 0.3, 'the numbers in §C');
});

test('fieldReturns / atFieldReturn / nearestReturn follow the row tier', () => {
  assert.deepEqual(fieldReturns(0), []);
  assert.deepEqual(fieldReturns(1).map(r => r.id), ['field']);
  assert.deepEqual(fieldReturns(2).map(r => r.id), ['field', 'back']);
  const at = { x: 10.5, z: -61 };
  assert.equal(atFieldReturn(at, 0), null, 'not bought: no return there');
  assert.equal(atFieldReturn(at, 1)?.id, 'field');
  assert.equal(atFieldReturn({ x: 10 + FIELD_RETURN.REACH + 0.1, z: -62 }, 2), null);
  assert.equal(atFieldReturn({ x: -6, z: -127 }, 1), null, 'the Back return is tier 2');
  assert.equal(atFieldReturn({ x: -6, z: -127 }, 2)?.id, 'back');
  assert.equal(nearestReturn(0, -100, 0).id, 'main');
  assert.equal(nearestReturn(0, -100, 1).id, 'field');
  assert.equal(nearestReturn(0, -120, 2).id, 'back');
  assert.equal(nearestReturn(SIM.STAND.x, SIM.STAND.z - 3, 2).id, 'main');
});
