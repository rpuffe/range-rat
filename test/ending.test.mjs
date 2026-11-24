// The ending fix pack (council round 5, §2.1: Q1–Q7) and the Ready Up signature hold (Q4).
// Built from the council's repro scripts against the real Crew.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { POND, inPond, SIM } from '../web/js/sim.js';
import { LIFT, ORBIT } from '../web/js/orbit.js';

function room(save, players = ['A']) {
  let t = 0;
  const c = new Crew('END', save, { now: () => t * 1000, seed: 5 });
  const run = secs => { for (let i = 0; i < Math.round(secs * 10); i++) { t += 0.1; for (const p of c.players.values()) if (p.online > 0) p.seenAt = t * 1000; c.tick(0.1); c.events = []; } };
  const ps = players.map(n => { const p = c.join(n); c.connect(p); return p; });
  return { c, run, ps, clock: () => t, advance: s => { t += s; } };
}
const one = c => [...c.balls.values()].find(b => b.kind === 'one');
const toStand = p => { p.x = SIM.STAND.x; p.z = SIM.STAND.z; };
// Walk A to Ball No. 1, pick it up, and bank it at the stand.
function bankOne(c, a) {
  const b = one(c); assert.ok(b, 'Ball No. 1 is on the field');
  a.x = b.x; a.z = b.z; assert.ok(c.pickup(a, b.id), 'picked up');
  toStand(a);
  return c.depositOne(a);
}

test('Q1: the countdown hitting 1 at the bell starts the Last Bucket next morning, and the sweep keeps Ball No. 1', () => {
  const { c, run, ps: [a] } = room({ day: 30, venue: 5, venueDay: 2, outstanding: 4, up: { cart: 1 } });
  c.readyUp(a); run(1);
  c.carts[0].load = 10; c.carts[0].loadW = 10;
  c.shiftT = c.shiftSecs - 0.05; run(0.2);
  assert.equal(c.phase, 'report');
  assert.equal(c.outstanding, 1);
  assert.equal(c.lastBucket, null, 'not begun under the report card');
  run(12);
  assert.equal(one(c), undefined, 'no Ball No. 1 lands during the report');
  c.readyUp(a); run(1);
  assert.equal(c.phase, 'shift');
  assert.ok(c.lastBucket && c.lastBucket.phase !== 'done', 'the Last Bucket begins this morning');
  run(20);
  assert.ok(one(c), 'Ball No. 1 came home');
  assert.ok(bankOne(c, a), 'banked');
  assert.equal(c.phase, 'report');
  assert.ok(c.report.ending, 'the ending played');
});

test('Q1: the night crew\'s sweep never takes Ball No. 1', () => {
  const { c, run, ps: [a] } = room({ day: 30, venue: 5, venueDay: 2, outstanding: 5 });
  c.readyUp(a); run(1);
  const b = c.addBall({ x: 0, y: SIM.BALL_R, z: -40, vx: 0, vy: 0, vz: 0, kind: 'one' }); b.rest = true;
  c.addBall({ x: 2, y: SIM.BALL_R, z: -40, vx: 0, vy: 0, vz: 0, kind: 'range' });
  c.endShift(); c.startShift();
  assert.ok(c.balls.has(b.id), 'Ball No. 1 kept');
  assert.equal([...c.balls.values()].filter(o => !o.sunk && o.kind !== 'one').length, 0, 'everything else swept');
});

test('Q1: a lost Ball No. 1 is sent again while the Last Bucket is active (the clock can\'t hold for ever)', () => {
  const { c, run, ps: [a] } = room({ day: 30, venue: 5, venueDay: 2, outstanding: 2 });
  c.readyUp(a); run(1);
  a.pocket = 1; a.pocketW = 1; toStand(a); c.deposit(a); run(12);
  const b = one(c); assert.ok(b);
  c.balls.delete(b.id);                         // any future lost-ball path
  run(1);
  assert.equal(c.lastBucket.phase, 'falling', 'self-healed back to falling');
  run(20);
  assert.ok(one(c), 'it fell again');
  assert.equal(c.lastBucket.phase, 'down');
  assert.ok(bankOne(c, a));
});

test('Q2: a Rat on the EVA when the Last Bucket begins is brought down, and the huddle completes', () => {
  const { c, run, ps: [a, b] } = room({ day: 30, venue: 5, venueDay: 2, outstanding: 3, mods: { orbit: { d: [1, 2, 3], n: 4 } } }, ['A', 'B']);
  c.readyUp(a); run(1);
  assert.equal(c.phase, 'shift');
  b.x = LIFT.x + 0.8; b.z = LIFT.z; c.input(b, { a: [{ t: 'lift' }] }); run(ORBIT.RIDE + 1);
  const st = c.mods.state('orbit');
  assert.equal(st.riders.get(b.id)?.ph, 'out');
  st.riders.get(b.id).bag.push(7);              // a piece of debris in the bag: it lands with them
  a.pocket = 5; a.pocketW = 5; toStand(a); c.deposit(a);   // the last balls: Ball No. 1 begins
  assert.ok(c.lastBucket);
  run(ORBIT.RIDE + 1);
  assert.equal(st.riders.has(b.id), false, 'B landed within the ride time');
  assert.equal(b.pocket, 1, 'the bag came home');
  run(8);
  toStand(b);
  assert.ok(bankOne(c, a), 'the huddle completes');
});

test('Q3: Ball No. 1\'s payout stays out of the crew record (the endless pace target)', () => {
  const { c, run, ps: [a] } = room({ day: 30, venue: 5, venueDay: 2, outstanding: 2, records: { cash: 1000, banked: 1, day: 3 } });
  c.readyUp(a); run(1);
  a.pocket = 1; a.pocketW = 1; toStand(a); c.deposit(a); run(15);
  const before = c.stats.cash;
  const bv = c.valueNow().bv;
  assert.ok(bankOne(c, a));
  assert.ok(c.endless);
  assert.ok(c.stats.cash > before + 1000 * bv, 'the day did pay Ball No. 1');
  assert.ok(c.records.cash < 1000 * bv, `record ${c.records.cash} excludes the payout`);
  assert.equal(c.records.cash, Math.max(1000, before), 'the record is the day\'s takings without Ball No. 1');
});

test('Q6: Ball No. 1 dropped in the pond lands on the dock instead (knockdown and leaving)', () => {
  const { c, run, ps: [a, b] } = room({ day: 30, venue: 5, venueDay: 2, outstanding: 5 }, ['A', 'B']);
  c.readyUp(a); run(1);
  a.one = true; a.x = POND.x; a.z = POND.z; assert.ok(inPond(a));
  c.knockDown(a);
  let ball = one(c);
  assert.ok(ball && !inPond(ball), 'knocked flat in the pond: Ball No. 1 is on the shore');
  c.balls.delete(ball.id);
  b.one = true; b.x = POND.x + 1; b.z = POND.z; c.removePlayer(b);
  ball = one(c);
  assert.ok(ball && !inPond(ball), 'left in the pond: Ball No. 1 is on the shore');
  a.down = 0; a.x = ball.x; a.z = ball.z; run(0.2);
  assert.equal(a.diving, false);
  assert.ok(c.pickup(a, ball.id), 'and anyone can pick it up');
});

test('Q5: a cart or Gary can\'t run over a Rat floating on the EVA (a Rat on the grass there still goes flying)', () => {
  const { c, run, ps: [a, b, g] } = room({ day: 30, venue: 5, venueDay: 2, outstanding: 50, up: { cart: 1 } }, ['A', 'B', 'G']);
  c.readyUp(a); run(1);
  b.x = LIFT.x + 0.8; b.z = LIFT.z; c.input(b, { a: [{ t: 'lift' }] }); run(ORBIT.RIDE + 1);
  assert.equal(c.mods.state('orbit').riders.get(b.id)?.ph, 'out');
  // The cart: drive A through the rider's ground spot.
  assert.ok(c.board(Object.assign(a, { x: c.carts[0].x, z: c.carts[0].z })));
  b.x = LIFT.x + 6; b.z = LIFT.z + 6;           // floating out in the disc, over open grass
  const cart = c.carts[0]; cart.x = b.x - 2; cart.z = b.z; cart.movedAt = c.now() - 200;
  g.x = b.x; g.z = b.z; g.down = 0;             // the control: G stands on the grass under B
  c.driveTo(a, { x: b.x, z: b.z, yaw: 0 }, c.now());
  assert.ok(g.down > 0, 'the cart did run over the spot');
  assert.equal(b.down, 0, 'the cart passed underneath');
  // Gary: drives straight through.
  c.gary = { phase: 'drive', pause: 0, stop: 0, x: b.x - 0.5, z: b.z, yaw: 0, fails: 0, checks: [] };
  c.garyStops = () => [{ id: 'sign', x: b.x + 10, z: b.z }];
  g.down = 0; g.x = b.x; g.z = b.z;
  c.stepGary(0.1);
  assert.ok(g.down > 0, 'Gary did run over the spot');
  assert.equal(b.down, 0, 'Gary passed underneath');
  assert.equal(c.mods.state('orbit').riders.get(b.id)?.ph, 'out', 'still floating');
});

test('Q7: a Rat who leaves with a treasure puts it back in the Deep End', () => {
  const { c, run, ps: [a, b] } = room({ day: 30, venue: 2, venueDay: 2 }, ['A', 'B']);
  c.readyUp(a); run(1);
  c.treasure = null; b.treasure = 'keys';
  c.removePlayer(b);
  assert.ok(c.treasure && c.treasure.id === 'keys', 'the treasure is back down there');
});

test('Q4: Ready Up holds while a promotion waits on signatures, then the promotion goes through', () => {
  const { c, run, ps: [a, b] } = room({ day: 10, venue: 1, venueDay: 3, stamps: 10, cash: 1e9 }, ['A', 'B']);
  c.readyUp(a); run(1);
  c.endShift();
  assert.ok(c.promoInfo().ready, 'a promotion is ready');
  c.readyUp(a);                                  // A mashes "Clock in"
  run(25);
  assert.equal(c.phase, 'report', 'the 20 s timer holds for the signatures');
  assert.deepEqual(c.awaitingSignatures(), { n: 0, of: 2 });
  assert.ok(c.sign(a, true)); run(1);
  assert.equal(c.phase, 'report');
  assert.ok(c.sign(b, true));
  assert.equal(c.venue, 2, 'promoted');
  run(0.5);
  assert.equal(c.phase, 'shift', 'and the held timer lets the shift start');
});

test('Q4: without a promotion, the 20 s Ready Up timer still starts the shift', () => {
  const { c, run, ps: [a] } = room({ day: 10, venue: 1, venueDay: 3, stamps: 0 }, ['A', 'B']);
  c.readyUp(a); run(1);
  c.endShift();
  c.readyUp(a); run(21);
  assert.equal(c.phase, 'shift');
});

test('playtest: the Rat who carries Ball No. 1 is credited, and an idle Rat cannot stall the huddle', () => {
  const { c, run, ps: [a, b] } = room({ day: 30, venue: 5, venueDay: 2, outstanding: 2 }, ['A', 'B']);
  c.readyUp(a); c.readyUp(b); run(1);
  a.pocket = 1; a.pocketW = 1; toStand(a); c.deposit(a);
  for (let i = 0; i < 60 && !(one(c) && one(c).rest); i++) run(1);
  b.x = -40; b.z = -100; b.movedAt = c.now();        // B is away and just moved: the huddle waits
  assert.equal(bankOne(c, a), false, 'B is not at the stand yet');
  b.movedAt = c.now() - 61_000;                       // B has not moved for a minute: counted present
  assert.ok(c.depositOne(a), 'an idle Rat no longer stalls the ending');
  assert.equal(a.shift.banked >= 1, true, 'the carrier banked it');
  assert.ok(a.shift.cash > 0, 'and gets the payout on the end card');
});
