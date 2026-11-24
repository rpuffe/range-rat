// Ball types: physics, which kind a customer hits by day and venue, weights,
// the splitter, the super-bouncy dodge, and debuts / venue persistence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SIM, WASH, CART, KIND_W, KIND_NAMES, KIND_BLURB, advanceBall, pickKind, mulberry32 } from '../web/js/sim.js';

function makeCrew(save = null, shiftSecs = 100000, seed = 11) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('KIND', save, { shiftSecs, seed, now: () => clock.t });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
function openShift(crew, mud = 0) {
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = mud;
  crew.flush();
}
function addPlayer(crew, name, x, z) {
  const p = crew.join(name);
  crew.connect(p);
  p.x = x; p.z = z;
  return p;
}
const act = (crew, p, ...a) => crew.input(p, { a });
const restingBall = (crew, x, z, kind) => {
  const b = crew.addBall({ x, y: SIM.BALL_R, z, vx: 0, vy: 0, vz: 0, kind });
  b.rest = true;
  return b;
};
const STAND = SIM.STAND;
const R = SIM.BALL_R;

// ---- physics -----------------------------------------------------------------------

const shot = kind => ({ x: 0, y: 0.1, z: 0, vx: 0, vy: 9, vz: -22, kind });

// Fly a ball in dt chunks to rest. Records the landing spot (first ground contact), the highest
// point after that landing, and the rest point.
function fly(b, dt, maxT = 120) {
  let landed = null, hopPeak = 0;
  for (let t = 0; t < maxT && !b.rest; t += dt) {
    advanceBall(b, dt);
    if (!landed && b.y <= R + 1e-9) landed = { x: b.x, z: b.z };
    else if (landed) hopPeak = Math.max(hopPeak, b.y);
  }
  return { landed, hopPeak, rest: { x: b.x, z: b.z }, dist: Math.hypot(b.x, b.z) };
}

test('square: stops dead on its first ground contact, where a range ball would have landed', () => {
  const sq = shot('square'), rg = shot('range');
  let landing = null;
  for (let i = 0; i < 100000 && !landing; i++) { advanceBall(rg, SIM.STEP); if (rg.y <= R + 1e-9) landing = { x: rg.x, z: rg.z }; }
  assert.ok(landing, 'the range ball lands');
  const f = fly(sq, SIM.STEP);
  assert.equal(sq.rest, true);
  assert.equal(sq.vx, 0); assert.equal(sq.vy, 0); assert.equal(sq.vz, 0);
  assert.equal(sq.y, R);
  assert.ok(Math.abs(f.rest.x - landing.x) < 1e-6 && Math.abs(f.rest.z - landing.z) < 1e-6,
    `rests at ${f.rest.z} but a range ball first lands at ${landing.z}`);
  assert.equal(f.hopPeak, 0, 'no second hop');
});

test('square dropped straight down does not bounce at all', () => {
  const b = { x: 3, y: 4, z: -7, vx: 0, vy: 0, vz: 0, kind: 'square' };
  fly(b, 1 / 60);
  assert.equal(b.rest, true);
  assert.equal(b.x, 3); assert.equal(b.z, -7);
});

test('bouncy: bounces higher and rolls further than a range ball', () => {
  const bouncy = fly(shot('bouncy'), 1 / 60), range = fly(shot('range'), 1 / 60);
  assert.ok(bouncy.hopPeak > range.hopPeak * 1.5, `peak after landing: bouncy ${bouncy.hopPeak} vs range ${range.hopPeak}`);
  assert.ok(bouncy.dist > range.dist, `bouncy ${bouncy.dist} vs range ${range.dist}`);
});

test('every kind comes to rest in finite time', () => {
  for (const kind of ['range', 'glow', 'lead', 'square', 'gold', 'splitter', 'bouncy']) {
    const b = shot(kind);
    fly(b, 1 / 20);
    assert.equal(b.rest, true, `${kind} never rested`);
  }
});

test('physics are deterministic across dt: 1/20 and 1/144 steps give the same rest point', () => {
  for (const kind of ['range', 'square', 'bouncy']) {
    const a = fly(shot(kind), 1 / 20), b = fly(shot(kind), 1 / 144);
    assert.ok(Math.abs(a.rest.x - b.rest.x) < 1e-6 && Math.abs(a.rest.z - b.rest.z) < 1e-6,
      `${kind}: (${a.rest.x}, ${a.rest.z}) vs (${b.rest.x}, ${b.rest.z})`);
  }
});

// ---- pickKind ----------------------------------------------------------------------

function sample(day, venue, n = 200000, seed = 7) {
  const rng = mulberry32(seed), c = {};
  for (let i = 0; i < n; i++) { const k = pickKind(day, venue, rng); c[k] = (c[k] ?? 0) + 1; }
  for (const k of Object.keys(c)) c[k] /= n;
  return c;
}
const within = (v, lo, hi, what) => assert.ok(v >= lo && v <= hi, `${what}: ${v} not in [${lo}, ${hi}]`);

test('pickKind: days 1 and 2 at the Muni are only range balls', () => {
  for (const day of [1, 2]) assert.deepEqual(sample(day, 0, 50000), { range: 1 });
});

test('pickKind: day 3 brings gold (rare); the square ball waits for day 5', () => {
  const c = sample(3, 0);
  within(c.gold ?? 0, 0.003, 0.008, 'gold');
  assert.deepEqual(Object.keys(c).sort(), ['gold', 'range']);
  assert.equal(sample(4, 0).square, undefined, 'no square on day 4');
  const d5 = sample(5, 0);
  within(d5.square ?? 0, 0.13, 0.15, 'square on day 5 (round 6 #8: was ~0.27)');
  within(d5.gold ?? 0, 0.003, 0.008, 'gold on day 5');
});

test('pickKind: splitter from day 7; the foam ball is cut', () => {
  const d6 = sample(6, 0), d7 = sample(7, 0);
  assert.equal(d6.splitter, undefined);
  assert.ok(d7.splitter > 0.02 && d7.splitter < 0.06, `splitter ${d7.splitter}`);
  for (const day of [6, 9, 15]) assert.equal(sample(day, 2, 50000).foam, undefined, 'no foam, ever');
});

test('pickKind: bouncy only at venue 1 and up, and never lead or glow', () => {
  for (const day of [1, 3, 7, 12]) assert.equal(sample(day, 0, 50000).bouncy, undefined, `day ${day} venue 0`);
  for (const venue of [1, 2, 5]) within(sample(7, venue).bouncy ?? 0, 0.05, 0.13, `bouncy at venue ${venue}`);
  for (const k of Object.keys(sample(12, 3))) assert.ok(!['lead', 'glow'].includes(k), `pickKind never picks ${k}`);
});

test('pickKind: same seed, same sequence', () => {
  const a = mulberry32(5), b = mulberry32(5);
  for (let i = 0; i < 500; i++) assert.equal(pickKind(8, 2, a), pickKind(8, 2, b));
});

test('every kind has a name, and every non-range kind a blurb and a weight', () => {
  for (const k of Object.keys(KIND_W)) assert.ok(KIND_NAMES[k], `name for ${k}`);
  for (const k of Object.keys(KIND_W)) if (k !== 'range') assert.ok(KIND_BLURB[k], `blurb for ${k}`);
});

// ---- weights, end to end -----------------------------------------------------------

for (const [kind, w] of [['range', 1], ['gold', 10], ['bouncy', 1.5], ['square', 2]]) {
  test(`a ${kind} ball banks ${w} x a range ball (BV 1.5 at Curb 1, clean Rat x1.25)`, () => {
    const { crew } = makeCrew();
    openShift(crew, 0);
    const a = addPlayer(crew, 'A', STAND.x, STAND.z);
    const ball = restingBall(crew, a.x, a.z, kind);
    assert.deepEqual(act(crew, a, { t: 'pickup', ball: ball.id }).denied, []);
    assert.equal(a.pocket, 1);
    assert.equal(a.pocketW, w);
    crew.flush();
    act(crew, a, { t: 'deposit' });
    assert.equal(a.pocket, 0);
    assert.equal(crew.cash, Math.round(w * 1.5 * 1.25 * 100) / 100, `${kind} x BV 1.5 x a clean Rat's 1.25`);
    assert.equal(crew.stats.deposited, 1, 'one ball, whatever it weighs');
  });
}

// ---- splitter ----------------------------------------------------------------------

test('splitter: pickup adds one to the pocket and spawns 2 range balls near it', () => {
  const { crew } = makeCrew();
  openShift(crew, 0);
  const a = addPlayer(crew, 'A', 5, -20);
  const s = restingBall(crew, 5.5, -20, 'splitter');
  crew.flush();
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: s.id }).denied, []);
  assert.equal(a.pocket, 1, 'the splitter itself goes in the pocket');
  assert.equal(a.pocketW, 1);
  assert.equal(crew.balls.has(s.id), false);
  const kids = [...crew.balls.values()];
  assert.equal(kids.length, 2);
  for (const k of kids) {
    assert.equal(k.kind, 'range');
    assert.ok(Math.hypot(k.x - 5.5, k.z + 20) < 1, 'spawned where the splitter was');
    assert.equal(k.rest, false, 'popped into the air');
  }
  const ev = crew.flush().ev;
  assert.equal(ev.filter(e => e.t === 'spawn' && e.kind === 'range').length, 2);
});

test('splitter: a full pocket still denies it, and nothing splits', () => {
  const { crew } = makeCrew();
  openShift(crew, 0);
  const a = addPlayer(crew, 'A', 5, -20);
  a.pocket = SIM.POCKET;
  const s = restingBall(crew, 5, -20, 'splitter');
  act(crew, a, { t: 'pickup', ball: s.id });
  assert.equal(crew.balls.size, 1);
  assert.equal(a.pocket, SIM.POCKET);
});

// ---- bouncy dodge ------------------------------------------------------------------

const kicks = crew => crew.flush().ev.filter(e => e.t === 'kick');

test('bouncy: a resting ball hops away when a player comes within 2.6 m', () => {
  const { crew } = makeCrew();
  openShift(crew, 0);
  const a = addPlayer(crew, 'A', 0, -50);
  const b = restingBall(crew, 2, -50, 'bouncy');
  crew.flush();
  crew.tick(0.05);
  const k = kicks(crew);
  assert.equal(k.length, 1);
  assert.equal(k[0].id, b.id);
  assert.equal(b.rest, false);
  assert.equal(b.hops, 1);
  assert.ok((b.x - a.x) * k[0].vx + (b.z - a.z) * k[0].vz > 0, 'velocity points away from the player');
  assert.ok(k[0].vy > 0);
  assert.ok(Math.abs(k[0].vz) < 1e-9, 'directly away along x');
});

test('bouncy: stays put when the player is farther than 2.6 m', () => {
  const { crew } = makeCrew();
  openShift(crew, 0);
  addPlayer(crew, 'A', 0, -50);
  const b = restingBall(crew, 3, -50, 'bouncy');
  crew.flush();
  crew.tick(0.05);
  assert.equal(kicks(crew).length, 0);
  assert.equal(b.rest, true);
});

test('bouncy: only bouncy balls dodge', () => {
  const { crew } = makeCrew();
  openShift(crew, 0);
  addPlayer(crew, 'A', 0, -50);
  const b = restingBall(crew, 1, -50, 'range');
  crew.flush();
  crew.tick(0.05);
  assert.equal(kicks(crew).length, 0);
  assert.equal(b.rest, true);
});

test('bouncy: gives up after 4 hops, and can then be picked up', () => {
  const { crew } = makeCrew();
  openShift(crew, 0);
  const a = addPlayer(crew, 'A', 0, -80);
  const b = restingBall(crew, 0, -50, 'bouncy');
  crew.flush();
  let total = 0;
  for (let hop = 1; hop <= 6; hop++) {
    a.x = b.x - 1.5; a.z = b.z;                       // walk up beside it
    crew.tick(0.05);
    total += kicks(crew).length;
    a.x = -140; a.z = -200;                            // step away while it flies and settles
    for (let i = 0; i < 400 && !b.rest; i++) crew.tick(0.05);
    assert.equal(b.rest, true, `hop ${hop} settles`);
    crew.flush();
  }
  assert.equal(total, 4, 'exactly 4 kicks');
  assert.equal(b.hops, 4);
  a.x = b.x - 0.5; a.z = b.z;
  assert.deepEqual(act(crew, a, { t: 'pickup', ball: b.id }).denied, []);
  assert.equal(a.pocket, 1, 'caught at last');
});

test('bouncy: ignores a driver in the cart', () => {
  const { crew } = makeCrew();
  openShift(crew, 0);
  const a = addPlayer(crew, 'A', 0, -50);
  if (!crew.cart) crew.cart = { x: 0, z: -50, yaw: 0, v: 0, driver: null, load: 0, boostT: 0, mud: 0, movedAt: crew.now() };
  crew.cart.driver = a.id;
  assert.equal(crew.driving(a), true);
  const b = restingBall(crew, 1, -50, 'bouncy');
  crew.flush();
  crew.tick(0.05);
  assert.equal(kicks(crew).length, 0);
  assert.equal(b.rest, true);
  assert.equal(b.hops ?? 0, 0);
});

// ---- debuts and venue --------------------------------------------------------------

function debutsOver(crew, run, secs = 400) {
  crew.flush();
  const seen = [];
  for (let s = 0; s < secs; s++) { run(1); seen.push(...crew.flush().ev.filter(e => e.t === 'debut').map(e => e.kind)); }
  return seen;
}

test('debut: the first spawn of each non-range kind emits one debut event, never again', () => {
  const { crew, run } = makeCrew({ day: 7, venue: 1 });
  crew.startShift();
  for (const m of crew.mats) m.next = 0;
  assert.equal(crew.debuts.size, 0);
  const seen = debutsOver(crew, run);
  for (const k of ['square', 'splitter', 'bouncy']) assert.equal(seen.filter(x => x === k).length, 1, `${k} debuts once`);
  assert.ok(seen.filter(x => x === 'gold').length <= 1, 'gold debuts at most once (it is rare)');
  assert.equal(new Set(seen).size, seen.length, 'no kind debuts twice');
  assert.ok(!seen.includes('range'), 'range never debuts');
  for (const k of ['square', 'splitter', 'bouncy']) assert.ok(seen.includes(k), `${k} appeared`);
  assert.deepEqual([...crew.debuts].sort(), [...seen].sort());
});

test('debut: day 1 customers never debut anything', () => {
  const { crew, run } = makeCrew();
  crew.startShift();
  for (const m of crew.mats) m.next = 0;
  assert.deepEqual(debutsOver(crew, run, 120), []);
  assert.equal(crew.debuts.size, 0);
});

test('debuts round-trip through toSave: a loaded crew does not repeat a debut', () => {
  const first = makeCrew({ day: 7, venue: 1 }, 100000, 3);
  first.crew.startShift();
  for (const m of first.crew.mats) m.next = 0;
  const seen = debutsOver(first.crew, first.run, 200);
  assert.ok(seen.length >= 3, `some kinds debuted: ${seen}`);
  const save = JSON.parse(JSON.stringify(first.crew.toSave()));
  assert.deepEqual([...save.debuts].sort(), [...seen].sort());

  const second = makeCrew(save, 100000, 3);
  assert.deepEqual([...second.crew.debuts].sort(), [...seen].sort());
  second.crew.startShift();
  for (const m of second.crew.mats) m.next = 0;
  const again = debutsOver(second.crew, second.run, 200);
  for (const k of seen) assert.ok(!again.includes(k), `${k} debuted again after loading`);
});

test('debuts: junk in a save is ignored', () => {
  const { crew } = makeCrew({ debuts: ['gold', 7, null, 'foam'] });
  assert.deepEqual([...crew.debuts].sort(), ['foam', 'gold']);
  assert.equal(makeCrew({ debuts: 'gold' }).crew.debuts.size, 0);
});

test('venue round-trips through toSave and is clamped to 0..5', () => {
  assert.equal(makeCrew().crew.venue, 0);
  assert.equal(makeCrew({ venue: 3 }).crew.venue, 3);
  assert.equal(makeCrew({ venue: 3 }).crew.toSave().venue, 3);
  const again = makeCrew(JSON.parse(JSON.stringify(makeCrew({ venue: 4 }).crew.toSave()))).crew;
  assert.equal(again.venue, 4);
  assert.equal(makeCrew({ venue: 99 }).crew.venue, 5);
  assert.equal(makeCrew({ venue: -2 }).crew.venue, 0);
  assert.equal(makeCrew({ venue: 2.9 }).crew.venue, 2);
  assert.equal(makeCrew({ venue: 'x' }).crew.venue, 0);
  assert.equal(makeCrew({ venue: NaN }).crew.venue, 0);
});

test('venue reaches spawning: at venue 0 no bouncy ever spawns, at venue 1 some do', () => {
  const kindsAt = venue => {
    const { crew, run } = makeCrew({ day: 4, venue });
    crew.startShift();
    for (const m of crew.mats) m.next = 0;
    const kinds = new Set();
    for (let s = 0; s < 400; s++) { run(1); for (const e of crew.flush().ev) if (e.t === 'spawn') kinds.add(e.kind); }
    return kinds;
  };
  assert.ok(!kindsAt(0).has('bouncy'));
  assert.ok(kindsAt(1).has('bouncy'));
});

// ---- council round 6 #8: square balls jam the reels ------------------------------------------------------------

test('round 6 #8: the cart reels refuse a square ball; a walker picks it up; it banks at weight 2', () => {
  const { crew } = makeCrew({ up: { cart: 1 } });
  openShift(crew, 0);
  const d = addPlayer(crew, 'D', CART.PARK.x - 1, CART.PARK.z);
  act(crew, d, { t: 'board' });
  const c = crew.cart, rx = c.x - Math.sin(c.yaw) * CART.REEL_AHEAD, rz = c.z - Math.cos(c.yaw) * CART.REEL_AHEAD;
  const sq = restingBall(crew, rx, rz, 'square'), rg = restingBall(crew, rx + 0.2, rz, 'range');
  assert.deepEqual(act(crew, d, { t: 'pickup', ball: sq.id, cart: true }).denied, [sq.id], 'the reels pass over it');
  assert.deepEqual(act(crew, d, { t: 'pickup', ball: rg.id, cart: true }).denied, [], 'a range ball still scoops');
  assert.equal(c.load, 1);
  assert.ok(crew.balls.has(sq.id), 'the square stays exactly where it landed');
  const w = addPlayer(crew, 'W', rx, rz);
  assert.deepEqual(act(crew, w, { t: 'pickup', ball: sq.id }).denied, [], 'a walker takes it');
  assert.equal(w.pocketW, 2);
  assert.equal(KIND_W.square, 2);
  assert.equal(KIND_BLURB.square, "Worth ×2. The reels can't take it.");
});

test('round 6 #8: the square share over 10,000 seeded draws: ~14% at the Muni from day 5, ~5% at the Club', () => {
  within(sample(5, 0, 10000).square ?? 0, 0.13, 0.15, 'Muni day 5');
  within(sample(7, 1, 10000).square ?? 0, 0.04, 0.06, 'Club day 7');
  within(sample(5, 1, 10000).square ?? 0, 0.04, 0.06, 'Club day 5');
});
