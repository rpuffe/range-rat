// Round 11, builder "late": the Stadium and the County bite (expert #6), and a hands-on job per late venue (expert #9).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { QUOTA_KPI, WASH, SIM } from '../web/js/sim.js';
import { CROWD, CROWD_LINE, crowdDecay, stepSentiment, newWindow, pushSample, windowMean, BOO, SOUV, atRail, railPoint, souvCrowd, booOut } from '../web/js/stadium.js';
import { HAZ, VAN, hazChance, inHazZone, isHazard, hazardCount, zoningWith, zoning, vanTow, vanPick, droneTarget } from '../web/js/county.js';
import { newMat } from '../web/js/customers.js';
import { Crew } from '../server/crew.mjs';
import stadium from '../server/venues/stadium.mjs';
import county from '../server/venues/county.mjs';
import { checkModule, HOOKS } from '../server/venues/index.mjs';

// ---- the pure rules ------------------------------------------------------------------------------------------------
test('the late gauges share the bell line, and the modules pass the seam check with the take hook', () => {
  assert.equal(CROWD_LINE, QUOTA_KPI);
  assert.equal(VAN.LINE, QUOTA_KPI);
  assert.ok(HOOKS.includes('take'));
  checkModule(stadium); checkModule(county);
});

test('crowdDecay grows with the crew: unattended, the live crowd crosses the line in ~110 s at 4P, ~200 s solo', () => {
  const cross = n => { let s = 1, t = 0; while (s >= CROWD_LINE) { s = stepSentiment(s, 1, crowdDecay(n)); t++; } return t; };
  assert.ok(crowdDecay(1) < crowdDecay(2) && crowdDecay(2) < crowdDecay(3) && crowdDecay(3) < crowdDecay(4));
  assert.equal(crowdDecay(9), crowdDecay(4)); assert.equal(crowdDecay(0), crowdDecay(1));
  assert.ok(cross(4) >= 90 && cross(4) <= 120, `4P live ${cross(4)} s`);
  assert.ok(cross(1) >= 180, `solo live ${cross(1)} s`);
  // The graded gauge (the Board, the bell) is the 2-minute mean: from a full window it crosses ~40-60 s later at 4P.
  const win = newWindow(); for (let i = 0; i < CROWD.WINDOW; i++) pushSample(win, 1);
  let s = 1, t = 0;
  while (windowMean(win) >= CROWD_LINE) { s = stepSentiment(s, 1, crowdDecay(4)); pushSample(win, s); t++; }
  assert.ok(t >= 130 && t <= 180, `4P graded ${t} s`);
  // One Rat lapping (+0.1 per ~11 s lap) out-runs the 4P drain: the gauge is one Rat's job.
  assert.ok(0.1 / 11 > crowdDecay(4) * 1.3);
  assert.equal(stepSentiment(0.5, 420), 0, 'the old default rate is kept for old readers');
});

test('a boo walks a seated customer out (sulk, then the bay stays empty); nobody seated, nothing happens', () => {
  const m = newMat(3); m.st = 'playing'; m.balls = 12; m.cust = 7;
  const ev = booOut(m, 100);
  assert.deepEqual(ev, [{ t: 'refuse', mat: 3, cust: 7, why: 'boo' }]);
  assert.equal(m.st, 'sulk'); assert.equal(m.balls, 0); assert.equal(m.noBefore, 100 + BOO.EMPTY);
  assert.deepEqual(booOut(newMat(1), 100), []);
});

test('souvenirs: the crowd rail is the side nets by the stands, and a relay doubles the cheer', () => {
  assert.ok(atRail(62, -60) && atRail(-63, -30) && !atRail(40, -60) && !atRail(62, -160) && !atRail(62, 5));
  const r = railPoint(10, -200); assert.ok(atRail(r.x, r.z));
  assert.ok(atRail(railPoint(-20, -50).x, -50) && railPoint(-20, -50).x < 0);
  assert.equal(souvCrowd(2, true), 2 * souvCrowd(2, false));
  assert.equal(souvCrowd(1, false), SOUV.CROWD);
});

test('hazards: the zone is inside the hose, short of the kerb; zoning counts them; the van tows from the kerb side', () => {
  assert.ok(HAZ.ZONE_R <= WASH.HOSE + WASH.RANGE, 'a hazard is always where a wand can reach it');
  const S = WASH.STATION;
  assert.ok(inHazZone(S.x, S.z - 30, S) && !inHazZone(S.x, S.z - 80, S) && !inHazZone(63, -30, S) && !inHazZone(S.x, 0, S));
  assert.equal(zoningWith(0, 0), 1); assert.equal(zoningWith(15, 0), zoning(15));
  assert.ok(Math.abs(zoningWith(0, HAZ.CAP / 2) - 0.5) < 1e-9);
  assert.equal(hazardCount([{ kind: 'hazard' }, { kind: 'hazard', sunk: true }, { kind: 'range' }]), 1);
  assert.ok(isHazard({ kind: 'hazard' }) && !isHazard({ kind: 'range' }));
  assert.ok(vanTow(1) < vanTow(4));
  assert.ok(hazChance(1) < hazChance(2) && hazChance(3) < hazChance(4) && hazChance(4) === HAZ.CHANCE && hazChance(9) === HAZ.CHANCE);
  const balls = [{ x: 10, rest: true }, { x: 80, rest: true }, { x: 50, rest: true }, { x: 90, rest: false }, { x: 95, rest: true, kind: 'one' }];
  assert.deepEqual(vanPick(balls, 2).map(b => b.x), [80, 50]);
  assert.deepEqual(vanPick([{ x: 70, rest: true, kind: 'hazard', hands: true }, { x: 60, rest: true }], 5).map(b => b.x), [60], 'the van leaves the hazards');
  assert.equal(droneTarget({ x: 0, z: 0 }, [{ id: 1, x: 1, z: 0, rest: true, hands: true, kind: 'hazard' }]), null, 'drones refuse hazards');
});

// ---- the server modules --------------------------------------------------------------------------------------------
function crewAt(venue, mods, n = 2, extra = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('LATE', { venue, day: 20, venueDay: 1, up: { shed: 1, cart: 1, helpers: 2 }, ...extra }, { shiftSecs: 300, seed: 4, now: () => clock.t, modules: mods });
  const rats = Array.from({ length: n }, (_, i) => { const p = crew.join('R' + i); crew.connect(p); p.x = 20 + i * 5; p.z = 9; return p; });
  crew.startShift();
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; for (const p of rats) { p.seenAt = clock.t; p.movedAt = clock.t; } crew.tick(0.05); } };
  return { crew, rats, run, clock };
}
const rest = (crew, x, z, kind = 'range') => { const b = crew.addBall({ x, y: SIM.BALL_R, z, vx: 0, vy: 0, vz: 0, kind }); b.rest = true; return b; };

test('Stadium: a souvenir rides in your hands, not the pocket; teenagers and the cart leave it; the rail pays and cheers', () => {
  const { crew, rats: [a], run } = crewAt(3, [stadium]);
  const st = crew.mods.state('stadium');
  const b = rest(crew, 0, -60, 'souvenir'); b.hands = true;
  run(3);
  assert.ok(crew.balls.has(b.id), 'the teenagers walked past it');
  crew.cart.x = b.x; crew.cart.z = b.z + 1; crew.cart.yaw = 0; crew.cart.driver = a.id;
  assert.equal(crew.cartPickup(a, b.id), false, 'the cart reels refuse it');
  crew.cart.driver = null;
  a.x = b.x; a.z = b.z;
  assert.ok(crew.pickup(a, b.id));
  assert.equal(a.pocket, 0); assert.equal(st.hands[a.id].n, 1);
  assert.equal(crew.snapshot().mods.stadium.hands[a.id], 1);
  st.s = 0.4; const cash = crew.cash;
  a.x = 62; a.z = -60; run(0.1);
  assert.ok(!st.hands[a.id], 'delivered');
  assert.ok(st.s > 0.4 + SOUV.CROWD - 0.01, `crowd ${st.s}`);
  assert.ok(crew.cash > cash, 'it pays');
  assert.equal(crew.stats.souvenirs, 1);
});

test('Stadium: walk past a mate with empty hands and the souvenirs pass to them, once; delivered, the cheer is double', () => {
  const { crew, rats: [a, b], run } = crewAt(3, [stadium]);
  const st = crew.mods.state('stadium');
  const ball = rest(crew, 0, -60, 'souvenir'); ball.hands = true;
  a.x = 0; a.z = -60; b.x = 30; b.z = -60;
  crew.pickup(a, ball.id); run(0.1);
  assert.equal(st.hands[a.id].n, 1, 'no mate near yet');
  a.x = 29; run(0.1);
  assert.ok(!st.hands[a.id] && st.hands[b.id]?.relay, 'handed off');
  assert.ok(crew.events.length >= 0);
  a.x = 30.5; run(0.1);
  assert.ok(st.hands[b.id] && !st.hands[a.id], 'a relayed bundle does not pass back');
  st.s = 0.3; b.x = 62; run(0.1);
  assert.ok(st.s > 0.3 + 2 * SOUV.CROWD - 0.01, `double: ${st.s}`);
});

test('Stadium: a knocked-down Rat drops their souvenirs, still souvenirs', () => {
  const { crew, rats: [a] } = crewAt(3, [stadium]);
  const st = crew.mods.state('stadium');
  const ball = rest(crew, 0, -60, 'souvenir'); ball.hands = true;
  a.x = 0; a.z = -60; crew.pickup(a, ball.id);
  crew.knockDown(a);
  assert.ok(!st.hands[a.id]);
  assert.equal([...crew.balls.values()].filter(o => o.kind === 'souvenir' && o.hands).length, 1);
});

test('Stadium: below the line the crowd boos and a seated customer walks out every BOO.EVERY s', () => {
  const { crew, run } = crewAt(3, [stadium], 4);
  const st = crew.mods.state('stadium');
  run(2);
  st.s = 0; st.win.a.fill(0); st.t = BOO.GRACE;
  const before = crew.mats.filter(m => m.st === 'playing').length;
  crew.events = [];
  run(BOO.EVERY + 0.5);
  const boos = crew.events.filter(e => e.t === 'crowd' && e.kind === 'boo');
  assert.equal(boos.length, 1);
  assert.ok(before > 0 && boos[0].mat != null, 'someone was seated, and walked');
  assert.ok(crew.stats.booed >= 1);
});

test('Stadium: some customer balls are souvenirs at the Stadium only, never at the County', () => {
  const { crew, run } = crewAt(3, [stadium], 4);
  run(120);
  assert.ok(crew.mods.state('stadium').sv, 'a souvenir showed up');
  const c = crewAt(4, [stadium, county], 4);
  c.run(60);
  assert.ok(![...c.crew.balls.values()].some(b => b.kind === 'souvenir'));
});

test('County: a resting customer ball near the washer turns hazard; dry it is refused; the wand wets it; picked up wet it is bagged', () => {
  const { crew, rats: [a, b] } = crewAt(4, [county]);
  const st = crew.mods.state('county');
  const ball = rest(crew, WASH.STATION.x, WASH.STATION.z - 30);
  const rng = crew.rng; crew.rng = () => 0; county.onRest(crew, st, ball); crew.rng = rng;
  assert.equal(ball.kind, 'hazard'); assert.ok(ball.hands);
  assert.ok(crew.events.some(e => e.t === 'hazard' && e.id === ball.id));
  b.x = ball.x; b.z = ball.z;
  assert.equal(crew.pickup(b, ball.id), false, 'dry: refused');
  assert.equal(b.pocket, 0);
  // a takes the wand and sprays it from 4 m
  a.x = WASH.STATION.x; a.z = WASH.STATION.z; assert.ok(crew.toggleWand(a));
  a.x = ball.x + 4; a.z = ball.z;
  for (let i = 0; i < 6; i++) { a.washAt = crew.now() - 500; crew.wash(a, 0.5, 'h:' + ball.id); }
  assert.ok(ball.wetUntil > crew.custT, 'wet');
  assert.ok(crew.events.some(e => e.t === 'hazwet' && e.by === a.id));
  const cash = crew.cash;
  assert.ok(crew.pickup(b, ball.id), 'wet: bagged');
  assert.ok(!crew.balls.has(ball.id) && b.pocket === 0 && crew.cash > cash);
  assert.ok(crew.events.some(e => e.t === 'hazbag' && e.by === b.id && e.team === a.id), 'a team job');
});

test('County: unbagged hazards pull Zoning under the line, and then the van tows balls every VAN.EVERY s', () => {
  const { crew, run } = crewAt(4, [county], 4);
  const st = crew.mods.state('county');
  for (let i = 0; i < HAZ.CAP; i++) { const b = rest(crew, WASH.STATION.x - 20 + i, WASH.STATION.z - 20); b.kind = 'hazard'; b.hands = true; }
  for (let i = 0; i < 20; i++) rest(crew, 40 + i, -60);
  run(1);
  assert.ok(st.kpi < VAN.LINE, `zoning ${st.kpi}`);
  crew.events = [];
  run(VAN.EVERY + 0.5);
  const vans = crew.events.filter(e => e.t === 'van');
  assert.equal(vans.length, 1);
  assert.ok(vans[0].n > 0 && crew.stats.towed === vans[0].n);
  assert.ok(crew.snapshot().mods.county.van != null, 'the van is on the Board snapshot while it drives');
  assert.ok(crew.mods.state('county').haz >= HAZ.CAP - 1, 'the van tows range balls, not the hazards');   // round 11: the busier day spawns a few more
});
