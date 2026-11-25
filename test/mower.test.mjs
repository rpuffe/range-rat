import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOWER, MOWER_DRIVE_SECS, pickLane, newMower, mowerPos, stepMower, mowerDue, mowerSnap, mowerBoard, laneName } from '../web/js/mowe.js';
import { FRIES_MENU, FRIES_YIELD, menuFor, yieldFor, garyEats, garyHungry } from '../web/js/menu.js';

const ball = (id, x, z, extra = {}) => ({ id, x, z, rest: true, kind: 'range', ...extra });
const mid = () => 0.5;
const drive = (s, args, secs, dt = 0.05) => {
  const all = { raked: [], knocked: [], honk: 0 };
  for (let i = 0; i < Math.round(secs / dt); i++) {
    const r = stepMower(s, dt, { rng: mid, ...args });
    all.raked.push(...r.raked); all.knocked.push(...r.knocked); if (r.honk) all.honk++;
  }
  return all;
};
const driving = (lane = -132, x = MOWER.X0) => { const s = newMower([], mid); s.lane = lane; s.phase = 'drive'; s.x = x; s.z = lane; return s; };

test('constants match the spec', () => {
  assert.equal(MOWER.FROM_VENUE, 1); assert.equal(MOWER.FROM_DAY, 2); assert.equal(MOWER.AT, 0.25);
  assert.equal(MOWER.WARN_SECS, 12); assert.equal(MOWER.SPEED, 4); assert.equal(MOWER.RAKE_OFFSET, 2.4);
  assert.equal(MOWER_DRIVE_SECS, 32);
});

test('mowerDue: Club day 3+ (round 11: one idea a day), day 2+ later, once, at 25% of the shift', () => {
  const base = { venue: 1, venueDay: 3, shiftT: 105, shiftSecs: 420, mower: null };
  assert.ok(mowerDue(base));
  assert.ok(!mowerDue({ ...base, shiftT: 104 }));
  assert.ok(!mowerDue({ ...base, venue: 0 }));
  assert.ok(!mowerDue({ ...base, venueDay: 2 }), 'Club day 2: MOW-E waits for day 3');
  assert.ok(mowerDue({ ...base, venue: 2, venueDay: 2 }), 'Tiered day 2: as before');
  assert.ok(!mowerDue({ ...base, venue: 2, venueDay: 1 }));
  assert.ok(!mowerDue({ ...base, mower: {} }));
});

test('pickLane takes the candidate with the most resting balls', () => {
  const bs = [ball(1, 0, -119), ball(2, 5, -121), ball(3, 9, -122), ball(4, 0, -24)];
  assert.equal(pickLane(bs, mid), -120);
});

test('pickLane skips ones, drifting, treasure, sunk, moving balls; ties go to rng', () => {
  const bs = [ball(1, 0, -24, { kind: 'one' }), ball(2, 0, -24, { drift: true }), ball(3, 0, -24, { treasure: true }),
    ball(4, 0, -24, { sunk: true }), ball(5, 0, -24, { rest: false }), ball(6, 0, -36)];
  assert.equal(pickLane(bs, mid), -36);
  assert.equal(pickLane([], () => 0), MOWER.LANES[0]);
  assert.equal(pickLane(new Map(), () => 0.999), MOWER.LANES.at(-1));
});

test('warn counts down 12 s then drives; board line', () => {
  const s = newMower([], mid);
  assert.equal(s.phase, 'warn');
  assert.deepEqual(mowerPos(s), MOWER.SHED);
  assert.equal(mowerBoard(s), `MOW-E · BY ${laneName(s.lane).toUpperCase()} · 0:12`);
  let changed = null;
  for (let i = 0; i < 12 / 0.05 + 2 && !changed; i++) changed = stepMower(s, 0.05, {}).phaseChange;
  assert.equal(changed, 'drive');
  assert.equal(s.x, MOWER.X0); assert.equal(s.z, s.lane);
  assert.equal(mowerBoard(s), null);
});

test('drives x -64 to +64 in 32 s then is done', () => {
  const s = driving();
  drive(s, { balls: [], players: [] }, 31);
  assert.equal(s.phase, 'drive');
  drive(s, { balls: [], players: [] }, 2);
  assert.equal(s.phase, 'done'); assert.equal(s.x, MOWER.X1);
  assert.deepEqual(mowerPos(s, 16), { x: 0, z: s.lane });
});

test('rakes lane balls into a windrow at lane + 2.4, keeping x; skips ones and drifters', () => {
  const s = driving();
  const balls = [ball(1, -30, -131), ball(2, 20, -133), ball(3, 0, -100), ball(4, 0, -132, { kind: 'one' }), ball(5, 10, -132, { drift: true })];
  const moved = [];
  for (let i = 0; i < 800; i++) for (const m of stepMower(s, 0.05, { balls, players: [], rng: () => 0.9 }).raked) { moved.push(m); balls.find(b => b.id === m.id).z = m.z; }
  const r = { raked: moved };
  const ids = moved.map(m => m.id);
  assert.deepEqual([...ids].sort(), [1, 2]);
  for (const m of r.raked) assert.ok(Math.abs(m.z - (-132 + 2.4)) <= 0.3 + 1e-9);
  assert.equal(r.raked.find(m => m.id === 1).x, -30);
});

test('a ball is raked only once reached, and not again after it is moved', () => {
  const s = driving();
  const balls = new Map([[1, ball(1, 0, -132)]]);
  let n = 0;
  for (let i = 0; i < 40 / 0.05; i++) {
    const r = stepMower(s, 0.05, { balls, players: [], rng: mid });
    if (i < 15 / 0.05) assert.equal(r.raked.length, 0, 'not reached yet');
    for (const m of r.raked) { n++; balls.get(m.id).z = m.z; }
  }
  assert.equal(n, 1);
});

test('knocks flat Rats and helpers within 1.3 m, once; skips downed and driving', () => {
  const s = driving();
  const players = [
    { id: 'a', x: 0, z: -132.5 }, { id: 'b', x: 0, z: -134 }, { id: 'c', x: 0, z: -132, down: 2 },
    { id: 'd', x: 0, z: -132, driving: true }, { id: 'h', x: 4, z: -131.5 },
  ];
  const r = drive(s, { balls: [], players }, 40);
  assert.deepEqual(r.knocked.sort(), ['a', 'h']);
});

test('the cart in the path stops it and honks once until it is clear', () => {
  const s = driving(-132, 0);
  const cart = { x: 5, z: -132 };
  const r = drive(s, { balls: [], players: [], cart }, 5);
  assert.equal(r.honk, 1);
  assert.ok(s.x < 5 && s.x > 1.5 && s.blocked);
  const x = s.x;
  drive(s, { balls: [], players: [], cart }, 1);
  assert.equal(s.x, x);
  cart.x = 30;
  drive(s, { balls: [], players: [], cart }, 1);
  assert.ok(s.x > x && !s.blocked);
  const t = driving(-132, 0);
  assert.equal(drive(t, { balls: [], players: [], cart: { x: 0, z: -20 } }, 2).honk, 0);
});

test('snapshot fields', () => {
  assert.equal(mowerSnap(null), null);
  assert.deepEqual(Object.keys(mowerSnap(newMower([], mid))).sort(), ['blocked', 'lane', 'phase', 't', 'x', 'yaw', 'z']);
});

test('menu by venue: Muni fries, Club + hot dog, Tiered + beer', () => {
  assert.deepEqual(FRIES_MENU, [['fries'], ['fries', 'hotdog'], ['fries', 'hotdog', 'beer']]);
  assert.deepEqual(menuFor(0), ['fries']); assert.deepEqual(menuFor(7), ['fries', 'hotdog', 'beer']);
});

test('yields: fries 3 (+1 one peel)/2/0, beer 2/1/0, hot dog 0 (council round 10: it FEDs instead)', () => {
  assert.equal(yieldFor('fries', 'perfect'), 3);
  assert.equal(yieldFor('fries', 'perfect', true), 4);
  assert.equal(yieldFor('fries', 'good', true), 2);
  assert.equal(yieldFor('hotdog', 'perfect', true), 0);
  assert.equal(yieldFor('hotdog', 'good'), 0);
  assert.equal(yieldFor('beer', 'good'), 1);
  for (const it of Object.keys(FRIES_YIELD)) assert.equal(yieldFor(it, 'burnt'), 0);
  assert.equal(yieldFor('nope', 'perfect'), 0);
});

test('Gary eats one: a hot dog while he is on site and before his kitchen stop', () => {
  const g = { phase: 'warn', checks: [] };
  assert.deepEqual(garyEats(g, 'hotdog', 'perfect'), { fed: true, take: 1 });
  assert.equal(garyEats(g, 'fries', 'perfect').fed, false);
  assert.equal(garyEats(g, 'hotdog', 'burnt').fed, false);
  assert.equal(garyEats({ ...g, phase: 'drive' }, 'hotdog', 'good').fed, true);
  assert.equal(garyEats({ ...g, fed: true }, 'hotdog', 'good').fed, false);
  assert.equal(garyEats({ ...g, phase: 'done' }, 'hotdog', 'good').fed, false);
  assert.equal(garyEats({ ...g, checks: [{ stop: 'kitchen', ok: false }] }, 'hotdog', 'good').fed, false);
  assert.equal(garyHungry(null), false);
});

// ---- council round 4, build item 1 --------------------------------------------------
import { MAP } from '../web/js/map.js';
test('MOW-E lanes clear every rock, box and Target Green bowl, and are named after landmarks', () => {
  assert.deepEqual(MOWER.LANES, [-24, -36, -120, -156, -166, -178]);
  assert.equal(MOWER.LANE_NAMES.length, MOWER.LANES.length);
  const bowls = [{ x: -4, z: -48, r: 7 }, { x: 26, z: -76, r: 8 }, { x: -6, z: -140, r: 9 }];   // round 4 §3.1
  const mowerHalf = 2.2;
  for (const lane of MOWER.LANES) {
    for (const r of [...MAP.ROCKS, ...bowls]) assert.ok(Math.abs(lane - r.z) - r.r >= mowerHalf, `lane ${lane} vs ${r.id ?? 'bowl'}`);
    for (const b of MAP.BOXES) assert.ok(Math.abs(lane - b.z) - b.d / 2 >= mowerHalf + MOWER.RAKE_HALF, `lane ${lane} vs ${b.id}`);
  }
  for (const [i, lane] of MOWER.LANES.entries()) assert.equal(laneName(lane), MOWER.LANE_NAMES[i]);
  assert.equal(laneName(-120), 'the Tractor');
  assert.equal(laneName(-999), 'z -999');
  const s = newMower([ball(1, 0, -120)], mid);
  assert.equal(s.lane, -120);
  assert.equal(mowerBoard(s), 'MOW-E · BY THE TRACTOR · 0:12');
});
