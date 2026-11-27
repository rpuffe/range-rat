// Council round 11 #1 (builder 1): MOW-E Goes Rogue (the boss), the tame pet, MOW-E 2.0 (design/council-round11.md §2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS, TAME, BOSS_LINES, crewHP, huntSpeed, bossDay, bossDue, newBoss, stepBoss, hoseBoss, behind, ringOf, inRing,
  bossPayout, bossBoard, bossSnap, bossLive, richest, tameDue, newTame, stepTame, tameBoard, moweSnap, moweBoard, cleanMowe, eatable, MOWER,
  meterSecs, coolLeft, updateSnap, updateBoard, WHISTLE, atPost, whistleOpen, tameRun,
  whistleStrip, inStrip, canBlow, newWhistlePass, bossAt, isCrash, bossOwnsScreen, rematchNext, promoNear, lostLine, stampText, moweRow, moweEve, sidestep, scoreBoard, BURST_MULT } from '../web/js/mowe.js';
import { MAP } from '../web/js/map.js';
import { WASH } from '../web/js/sim.js';
import { PA_LINES } from '../web/js/pa.js';
import { wordCount, SAY } from '../web/js/say.js';
import { todayFor } from '../web/js/today.js';
import { bossSlip } from '../web/js/garyvisit.js';
import { AWARDS, NIGHT_KEYS, awardsFor } from '../web/js/awards.js';
import { moweEngineParams, bossTempo, MOWE_ENGINE } from '../web/js/sfx.js';
import { Crew } from '../server/crew.mjs';
import { midDue } from '../web/js/story.js';   // round 13 #3c

const step = (s, secs, ctx = {}, dt = 0.05) => { const outs = []; for (let i = 0; i < Math.round(secs / dt); i++) outs.push(stepBoss(s, dt, ctx)); return outs; };
const fight = (n = 4, o = {}) => { const s = newBoss({ n, ...o }); step(s, BOSS.WARN + 0.01); assert.equal(s.phase, 'harvest'); return s; };
// A Rat standing straight behind it at d m.
const rear = (s, d = 4, id = 'r') => ({ id, x: s.x + Math.sin(s.yaw) * d, z: s.z + Math.cos(s.yaw) * d });
const front = (s, d = 4, id = 'f') => ({ id, x: s.x - Math.sin(s.yaw) * d, z: s.z - Math.cos(s.yaw) * d });

test('the HP, meter and hunt-speed tables by crew size (round 12 #1b), the rematch is tired, the encore is +1 and +10 %', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(crewHP), [3, 4, 9, 12, 13, 14]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(meterSecs), [2, 2, 3, 4, 4, 4]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(huntSpeed), [4.0, 4.2, 4.4, 4.6, 4.8, 5.0]);
  assert.equal(newBoss({ n: 4 }).hpMax, 12); assert.equal(newBoss({ n: 4 }).meterSecs, 4);
  assert.equal(newBoss({ n: 4, lost: 1 }).hpMax, 11, 'the rematch: HP −1');
  assert.equal(newBoss({ n: 1, lost: 1 }).hpMax, 2, 'never under 2');
  const e = newBoss({ n: 4, encore: true });
  assert.equal(e.hpMax, 13); assert.ok(Math.abs(e.hunt - 4.6 * 1.1) < 1e-9); assert.ok(Math.abs(e.speed - BOSS.SPEED * 1.1) < 1e-9);
  assert.equal(newBoss({ n: 1 }).knockR, BOSS.KNOCK_R_SOLO); assert.equal(newBoss({ n: 2 }).knockR, BOSS.KNOCK_R);
});

test('when: Club day 3 at 30 %, the rematch, the encore on Stadium day >= 2; never endless or Promotion Day', () => {
  const st = { tame: false, lost: 0, encore: false };
  assert.equal(bossDay({ venue: 1, venueDay: 3, st }), 'club');
  assert.equal(bossDay({ venue: 1, venueDay: 2, st }), null, 'Club day 2: not yet');
  assert.equal(bossDay({ venue: 1, venueDay: 4, st: { ...st, lost: 1 } }), 'club', 'the rematch');
  assert.equal(bossDay({ venue: 1, venueDay: 5, st: { ...st, lost: 2 } }), null, 'two losses: tamed anyway');
  assert.equal(bossDay({ venue: 1, venueDay: 4, st: { ...st, tame: true } }), null);
  assert.equal(bossDay({ venue: 1, venueDay: 3, st, promo: true }), null, 'Promotion Day moves it');
  assert.equal(bossDay({ venue: 1, venueDay: 3, st, endless: true }), null);
  assert.equal(bossDay({ venue: 3, venueDay: 1, st: { tame: true } }), null, 'the Stadium reveal morning: no');
  assert.equal(bossDay({ venue: 3, venueDay: 2, st: { tame: true } }), 'encore');
  assert.equal(bossDay({ venue: 3, venueDay: 3, st: { tame: true, encore: true } }), null, 'one encore');
  assert.equal(bossDay({ venue: 2, venueDay: 4, st }), null);
  const due = { venue: 1, venueDay: 3, st, shiftSecs: 420 };
  assert.ok(!bossDue({ ...due, shiftT: 125.9 })); assert.ok(bossDue({ ...due, shiftT: 126 }));
  assert.ok(!bossDue({ ...due, shiftT: 200, mower: {} }), 'once a shift');
});

test('no Gary, no Today on a boss morning (the boss owns its day)', () => {
  assert.equal(bossSlip(7, 7, true), 8); assert.equal(bossSlip(7, 7, false), 7); assert.equal(bossSlip(9, 7, true), 9);
  const base = { key: 1, day: 9, venue: 1 };
  assert.ok(todayFor(base), 'a plain day deals one');
  assert.equal(todayFor({ ...base, boss: true }), null);
});

test('the build-up: 15 s in the shed, the Board counts down, the near lanes are inside the hose', () => {
  const s = newBoss({ n: 4 });
  assert.equal(s.phase, 'warn');
  assert.equal(bossBoard(s), 'MOW-E · ROGUE · 0:15');
  step(s, 5);
  assert.equal(bossBoard(s), 'MOW-E · ROGUE · 0:10');
  assert.deepEqual([s.x, s.z], [BOSS.SHED.x, BOSS.SHED.z], 'it waits in the shed');
  assert.equal(hoseBoss(s, rear(s), 5).ok, false, 'no hosing it in the shed');
  for (const z of BOSS.LANES) for (const x of [BOSS.X0, BOSS.X1]) assert.ok(Math.hypot(x - WASH.STATION.x, z - WASH.STATION.z) < WASH.HOSE, `(${x}, ${z}) in hose`);
  assert.deepEqual(BOSS.SHED, MAP.MOWER_SHED); assert.deepEqual(BOSS.POND, { x: MAP.POND.x, z: MAP.POND.z, r: MAP.POND.r });
  assert.ok(Math.hypot(BOSS.BOX.x0 - WASH.STATION.x, BOSS.BOX.z0 - WASH.STATION.z) < WASH.HOSE, 'the arena\'s far corner');
  assert.ok(BOSS.BOX.z0 > MAP.POND.z + MAP.POND.r, 'the arena stops short of the pond');
  const out = step(s, 10.05).find(o => o.phase);
  assert.equal(out?.phase, 'harvest');
});

test('round 12 #1a: your own meter, from its rear arc: meterSecs ÷ washRate, twice as fast while stalled; a hit cools only you', () => {
  let s = fight(2);   // 2P: a 2 s meter, 4 HP
  assert.ok(behind(s, rear(s)) && !behind(s, front(s)));
  const side = { x: s.x + Math.cos(s.yaw) * 4, z: s.z - Math.sin(s.yaw) * 4 };   // 90° off its nose: not the grille
  assert.ok(!behind(s, side), 'its side is not its back');
  assert.equal(hoseBoss(s, front(s), 1).ok, false, 'its nose: no');
  assert.equal(hoseBoss(s, rear(s, 12), 1, { reach: 7 }).ok, false, 'out of reach');
  assert.equal(hoseBoss(s, rear(s), 1.9).hit, false);
  assert.ok(Math.abs(s.meter.r - 0.95) < 1e-9, 'it is my meter');
  const r = hoseBoss(s, rear(s), 0.1);
  assert.ok(r.hit); assert.equal(s.hp, 3); assert.equal(s.by.r, 1); assert.equal(s.meter.r, 0);
  // only the scorer cools (8 s); the 1 s global stagger holds everyone else
  assert.equal(coolLeft(s, 'r'), BOSS.COOL_ME);
  assert.equal(hoseBoss(s, rear(s), 0.5).why, 'cool', 'my nozzle sputters');
  assert.equal(hoseBoss(s, rear(s, 4, 'b'), 0.5).why, 'stagger', 'nobody fills in the 1 s after a hit');
  step(s, BOSS.STAGGER_ALL + 0.05);
  const b = hoseBoss(s, rear(s, 4, 'b'), 0.5); assert.ok(b.fill && !b.hit, 'then the others keep spraying');
  assert.equal(hoseBoss(s, rear(s), 0.5).why, 'cool');
  step(s, BOSS.COOL_ME);
  assert.equal(coolLeft(s, 'r'), 0); assert.ok(hoseBoss(s, rear(s), 0.1).fill, 'cooled down: yours again');
  s = fight(2);
  assert.equal(hoseBoss(s, rear(s), 1.3, { rate: 1.5 }).hit, false);
  assert.equal(hoseBoss(s, rear(s), 0.04, { rate: 1.5 }).hit, true, 'the Fan: 1.33 s');
  s = fight(2); s.stall = 3;
  assert.equal(hoseBoss(s, rear(s), 1.0).hit, true, 'stalled: 1.0 s');
  s = fight(4);
  assert.equal(hoseBoss(s, rear(s), 3.9).hit, false); assert.equal(hoseBoss(s, rear(s), 0.1).hit, true, '4P: a 4 s meter');
});

test('round 12 #1a: crossfire ×1.25, meters decay in the harvest, a hit staggers it (1 s), the bolt at most every 8 s', () => {
  let s = fight(2);
  hoseBoss(s, rear(s, 4, 'a'), 0.4);
  const r = hoseBoss(s, rear(s, 4, 'b'), 0.4);
  assert.ok(r.cross); assert.ok(Math.abs(s.meter.b - 0.4 * 1.25 / 2) < 1e-9, 'b fills ×1.25 while a sprays too');
  step(s, BOSS.CROSS_WIN + 0.1);
  assert.ok(!hoseBoss(s, rear(s, 4, 'b'), 0.1).cross, 'a stopped: no crossfire');
  // decay: 1 s after your last spray, 0.5/s (no banking a meter across a bolt)
  s = fight(2); s.burst = false; s.goal = { x: s.x, z: s.z }; s.seekT = 99;
  hoseBoss(s, rear(s), 1.6);   // 0.8
  step(s, 1.0); assert.ok(Math.abs(s.meter.r - 0.8) < 0.03, 'held for 1 s');
  step(s, 1.0); assert.ok(Math.abs(s.meter.r - 0.3) < 0.04, 'then −0.5/s');
  s.phase = 'hunt'; s.meter.r = 0.6; s.rage = 0; step(s, 3); assert.equal(s.meter.r, 0.6, 'the hunt never drains a meter');
  // the stagger and the bolt
  s = fight(2); s.wp = 0; s.burst = false;
  hoseBoss(s, rear(s, 4, 'a'), 2);
  assert.equal(s.stagger, BOSS.STAGGER); assert.equal(s.bolt, BOSS.BOLT_SECS);
  const x0 = s.x, z0 = s.z; step(s, 0.9);
  assert.ok(Math.hypot(s.x - x0, s.z - z0) < 1e-9, 'it stops while it staggers');
  step(s, 2); s.bolt = 0;
  hoseBoss(s, rear(s, 4, 'b'), 2);
  assert.equal(s.bolt, 0, 'a second hit inside 8 s: no bolt');
  step(s, BOSS.BOLT_COOL); s.hp = 4; s.phase = 'harvest';
  hoseBoss(s, rear(s, 4, 'c'), 2);
  assert.equal(s.bolt, BOSS.BOLT_SECS, 'after 8 s it bolts again');
});

test('a cart in front stalls it 6 s, then it shoves it 4 m aside, and that cart cannot block it for 8 s', () => {
  const s = fight(); s.burst = false; s.x = 0; s.z = -24; s.yaw = -Math.PI / 2;   // heading +x
  const cart = { i: 0, x: 2.5, z: -24 };
  let outs = step(s, 0.05, { carts: [cart] });
  assert.ok(outs[0].honk && s.stall > 0);
  outs = step(s, BOSS.STALL - 0.1, { carts: [cart] });
  assert.ok(outs.every(o => !o.shove)); assert.ok(Math.abs(s.x) < 1e-9, 'it waits');
  outs = step(s, 0.2, { carts: [cart] });
  const sh = outs.find(o => o.shove)?.shove;
  assert.ok(sh && sh.i === 0 && Math.abs(Math.hypot(sh.dx, sh.dz) - BOSS.SHOVE) < 1e-6 && Math.abs(sh.dx) < 1e-6, 'sideways, 4 m');
  // the same cart, right back in its face: no stall during the cooldown
  outs = step(s, 2, { carts: [{ i: 0, x: s.x + 2.5, z: -24 }] });
  assert.ok(outs.every(o => !o.honk), 'cooldown');
  assert.ok(step(s, 0.05, { carts: [{ i: 0, x: s.x - 2.5, z: -24 }] }).every(o => !o.honk), 'a cart behind it never stalls it');
});

test('phase 2 starts at half HP (rounded up) or after 40 s', () => {
  let s = fight(2);
  hoseBoss(s, rear(s, 4, 'a'), 2); assert.equal(s.phase, 'harvest');
  step(s, 1.1); hoseBoss(s, rear(s, 4, 'b'), 2); assert.equal(s.phase, 'hunt', '4 → 2');
  s = fight(4); s.hp = 7; hoseBoss(s, rear(s), 4); assert.equal(s.phase, 'hunt', '4P: 12 → 6');
  s = fight(1); hoseBoss(s, rear(s), 2); assert.equal(s.phase, 'hunt', 'solo 3 → 2');
  s = fight(4);
  const outs = step(s, BOSS.HARVEST_MAX + 0.1);
  assert.ok(outs.some(o => o.phase === 'hunt')); assert.equal(s.hp, 12);
  assert.ok(s.rage > 0 || s.ph > 0, 'it revs first');
});

test('the hunt picks the nearest Rat on foot: never a driver, a diver, a Rat aloft or one just flattened', () => {
  const s = fight(4); s.burst = false; s.x = 0; s.z = -24;
  s.hp = 7; hoseBoss(s, rear(s), 4); assert.equal(s.phase, 'hunt'); s.stagger = 0; s.rage = 0;
  const rats = [
    { id: 'drv', x: 1, z: -24, driving: true }, { id: 'div', x: 0, z: -22, diving: true }, { id: 'up', x: -1, z: -24, aloft: true },
    { id: 'off', x: 0, z: -25, online: false }, { id: 'down', x: 0, z: -23, down: 2 }, { id: 'far', x: 20, z: -24 }, { id: 'near', x: 8, z: -30 },
  ];
  const o = stepBoss(s, 0.05, { rats });
  assert.equal(o.target, 'near'); assert.equal(s.target, 'near');
  // re-aims every 3 s (a sidestep works): the aim point stays put meanwhile
  const aim = { ...s.aim }; rats.find(r => r.id === 'near').x = 30;
  step(s, 1, { rats }); assert.deepEqual(s.aim, aim);
  step(s, 2.1, { rats }); assert.notDeepEqual(s.aim, aim);
  // knocked: that Rat can't be re-targeted for 5 s
  const s2 = fight(2); s2.burst = false; s2.phase = 'hunt'; s2.x = 0; s2.z = -24;
  const r2 = [{ id: 'a', x: 0.5, z: -24 }, { id: 'b', x: 15, z: -24 }];
  const k = stepBoss(s2, 0.05, { rats: r2 });
  assert.deepEqual(k.knocked, ['a']);
  stepBoss(s2, 0.05, { rats: r2 });
  assert.equal(s2.target, 'b');
});

test('it eats resting balls within 3 m (not souvenirs, sunk balls or Ball No. 1), one every 0.6 s, until the catcher is full', () => {
  const s = fight(4); s.burst = false; s.x = 0; s.z = -24; s.goal = { x: 0, z: -24 }; s.seekT = 99; s.speed = 0;
  const balls = [{ id: 1, x: 1, z: -24, rest: true, kind: 'range' }, { id: 2, x: 2.9, z: -24, rest: true, kind: 'gold' }, { id: 3, x: 3.5, z: -24, rest: true },
    { id: 4, x: 0, z: -23, rest: true, sunk: true }, { id: 5, x: 0, z: -25, rest: true, kind: 'one' }, { id: 6, x: -1, z: -24, rest: true, hands: true }, { id: 7, x: 0, z: -24.5, rest: false }];
  const weigh = b => (b.kind === 'gold' ? 10 : 1);
  const o = stepBoss(s, 0.01, { balls, weigh });
  assert.deepEqual(o.eaten, [1], 'the nearest first'); assert.ok(s.grazing, 'it slows to graze');
  const left = () => balls.filter(b => !s.ateIds?.has(b.id) && b.id !== 1);
  assert.deepEqual(step(s, 0.5, { balls: left(), weigh }).flatMap(x => x.eaten), [], 'not before 0.6 s');
  assert.deepEqual(step(s, 0.15, { balls: left(), weigh }).flatMap(x => x.eaten), [2]);
  assert.equal(s.eaten, 2); assert.equal(s.eatenW, 11);
  assert.ok(Math.abs(BOSS.CATCHER * BOSS.EAT_EVERY - 18) < 1e-9, 'an unblocked harvest on a pile fills the catcher in 18 s');
  assert.ok(!eatable({ rest: true, cup: 1 }));
  s.eaten = BOSS.CATCHER;
  assert.deepEqual(stepBoss(s, 0.01, { balls: [{ id: 9, x: 0.5, z: -24, rest: true }] }).eaten, [], 'full');
  // the harvest heads for the richest spot in its arena
  const pile = Array.from({ length: 6 }, (_, i) => ({ id: 20 + i, x: 30 + i * 0.5, z: -40, rest: true }));
  assert.deepEqual(richest({ x: 0, z: -10 }, [...pile, { id: 30, x: 0, z: -12, rest: true }]), { x: 30, z: -40, n: 6 });
  assert.equal(richest({ x: 0, z: -10 }, [{ id: 31, x: -12, z: -78, rest: true }]), null, 'the pond is out of bounds');
});

// The plug's tug-of-war: n Rats online, the first k holding Use on the ring (they walk with it), stepped dt at a time.
function pull(s, n, k, secs, dt = 0.05) {
  const outs = [];
  for (let i = 0; i < Math.round(secs / dt); i++) {
    const rats = Array.from({ length: n }, (_, j) => ({ id: 'p' + j, x: s.ring?.x ?? 0, z: s.ring?.z ?? 0, holding: j < k }));
    outs.push(stepBoss(s, dt, { rats }));
    if (s.phase !== 'plug') break;
  }
  return outs;
}
const plugged = (n = 4) => { const s = fight(n); s.phase = 'hunt'; s.hp = 1; s.rage = 0; s.burst = false; s.x = 20; s.z = -30; const r = hoseBoss(s, rear(s), 4); assert.equal(r.phase, 'plug'); return s; };

test('round 12 #1c, the plug: the bar fills at (holders ÷ crew) ÷ 3 s, so everyone holding takes 3 s at any size', () => {
  const s = plugged(4);
  const ring = ringOf(s);
  assert.ok(inRing(s, ring) && !inRing(s, front(s, 3)));
  let outs = pull(s, 4, 4, 2.9); assert.equal(s.phase, 'plug'); outs = pull(s, 4, 4, 0.2);
  assert.equal(s.phase, 'tamed', '4 of 4: 3 s'); assert.ok(outs.some(o => o.phase === 'tamed'));
  const solo = plugged(1); pull(solo, 1, 1, 2.9); assert.equal(solo.phase, 'plug'); pull(solo, 1, 1, 0.2); assert.equal(solo.phase, 'tamed', 'solo: 3 s');
  const t3 = plugged(4); pull(t3, 4, 3, 3.9); assert.equal(t3.phase, 'plug'); pull(t3, 4, 3, 0.2); assert.equal(t3.phase, 'tamed', '3 of 4: 4 s');
  const t2 = plugged(4); pull(t2, 4, 2, 5.9); assert.equal(t2.phase, 'plug'); pull(t2, 4, 2, 0.2); assert.equal(t2.phase, 'tamed', '2 of 4 (half the crew: no yank loss): 6 s');
});

test('round 12 #1c: it crawls home dragging the ring, yanks every 1.5 s (−0.06 unless half the crew holds), drains, reboots', () => {
  const s = plugged(4), r0 = { ...s.ring }, sh0 = Math.hypot(s.x - BOSS.SHED.x, s.z - BOSS.SHED.z);
  const outs = pull(s, 4, 1, 6);
  const sh1 = Math.hypot(s.x - BOSS.SHED.x, s.z - BOSS.SHED.z);
  assert.ok(sh1 < sh0 + 3, 'it turns for home');
  assert.ok(Math.hypot(s.ring.x - r0.x, s.ring.z - r0.z) > 3, 'the ring goes with it');
  assert.equal(outs.filter(o => o.yank).length, 4, 'a yank every 1.5 s');
  // one of four: 6 s × (1/4)/3 = 0.5, less four yanks of 0.06
  assert.ok(Math.abs(s.plug - (0.5 - 4 * BOSS.YANK_LOSS)) < 0.02, `a lone holder at 4P loses ground on every yank (${s.plug.toFixed(3)})`);
  pull(s, 4, 1, 4); assert.ok(Math.hypot(s.x - BOSS.SHED.x, s.z - BOSS.SHED.z) < sh1 - 3, 'then crawls toward the shed');
  const lone = plugged(4); const lo = pull(lone, 4, 1, 40);
  const secs = lo.length * 0.05; assert.equal(lone.phase, 'tamed'); assert.ok(secs > 15 && secs < 26, `a lone holder at 4P still wins, slowly (${secs.toFixed(1)} s)`);
  // let go: it drains 0.1/s; the 10 s idle reboot stays
  const d = plugged(2); pull(d, 2, 2, 1.5); const k = d.plug; pull(d, 2, 0, 1); assert.ok(Math.abs(d.plug - (k - BOSS.PULL_DRAIN)) < 0.01, 'drains 0.1/s');
  const t = plugged(1); const cap = t.cap;
  pull(t, 1, 0, 9.9); assert.equal(t.phase, 'plug');
  const ro = pull(t, 1, 0, 0.2);
  assert.ok(ro.some(o => o.reboot)); assert.equal(t.phase, 'hunt'); assert.equal(t.hp, 1); assert.equal(t.cap, cap + BOSS.REBOOT_CAP);
  assert.equal(BOSS.HOLD_WALK, 2.0); assert.ok(BOSS.HOLD_WALK > BOSS.CRAWL, 'holders can walk it home');
});

test('the cap: 100 s and it flees home; the win limps into the pond; the Board says so', () => {
  const s = fight(4);
  const outs = step(s, BOSS.CAP + 0.1);
  assert.ok(outs.some(o => o.phase === 'fled')); assert.equal(s.phase, 'fled');
  assert.equal(bossBoard(s), 'MOW-E WINS · REMATCH NEXT CLUB DAY', '9.11');
  let home = false; for (let i = 0; i < 1200 && !home; i++) home = stepBoss(s, 0.05).home;
  assert.ok(home); assert.equal(s.out, 'gone');
  s.final = true; assert.equal(bossBoard(s), 'MOW-E WINS · WARRANTY EXPIRED');
  // the win: from anywhere in the arena, the splash (the pond event) comes within 10 s of the stamp
  for (const [x, z] of [[56, -6], [-24, -6], [56, -56], [20, -30]]) {
    const w = plugged(1); w.x = x; w.z = z; w.ring = ringOf(w);
    pull(w, 1, 1, 3.2);
    assert.equal(w.phase, 'tamed'); assert.equal(bossBoard(w), 'MOW-E TAMED');
    let t = 0, splash = false; for (; t < 20 && !splash; t += 0.05) splash = stepBoss(w, 0.05).sunk;
    assert.ok(splash && t <= 10, `the splash ${t.toFixed(1)} s after the stamp from (${x}, ${z})`);
    assert.ok(Math.hypot(w.x - BOSS.POND.x, w.z - BOSS.POND.z) < BOSS.POND.r, 'at the pond');
    step(w, BOSS.SINK + 0.1); assert.equal(w.sink, 1); assert.equal(w.out, 'gone');
  }
  const e = newBoss({ encore: true }); step(e, BOSS.WARN + 0.1);
  assert.equal(bossBoard(e), 'MOW-E 2.0 VS SITE 12 · ' + '■'.repeat(13));
  assert.equal(bossBoard(fight(4)), 'MOW-E · ' + '■'.repeat(12) + ' · ATE 0');
});

test('round 12 #5b: the catcher bursts at the ring (MOW-E balls ×2 within 8 m, gold within 6 m), nobody is flattened, the bell banks leftovers ×1', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('BOSS', { venue: 1, day: 7, venueDay: 2, up: { cart: 1, wand: 1 } }, { shiftSecs: 420, seed: 3, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;   // no customers
  crew.shiftT = 126; crew.tick(0.05);
  const m = crew.mower;
  m.phase = 'plug'; m.x = 10; m.z = -30; m.ring = ringOf(m); m.eaten = 12; m.eatenW = 15;
  const ring = { ...m.ring };
  Object.assign(p, { x: ring.x, z: ring.z, holding: true });
  let tamedAt = null, pondAt = null;
  for (let i = 0; i < 15 * 20; i++) {
    if (m.phase === 'plug' && m.ring) Object.assign(p, { x: m.ring.x, z: m.ring.z });   // walk it home
    clock.t += 50; crew.tick(0.05);
    for (const e of crew.events) { if (e.t === 'mower' && e.phase === 'tamed') tamedAt = crew.shiftT; if (e.t === 'mower' && e.phase === 'pond') pondAt = crew.shiftT; }
    crew.events = [];
  }
  assert.ok(tamedAt != null && pondAt != null && pondAt - tamedAt <= 10, `the pond PA on the splash (${(pondAt - tamedAt).toFixed(1)} s)`);
  const at = m.burstAt;
  const drag = Math.hypot(at.x - ring.x, at.z - ring.z);
  assert.ok(drag >= 2 && drag < 6, `it bursts where the ring was dragged to (${drag.toFixed(1)} m)`);
  const mowe = [...crew.balls.values()].filter(b => b.mowe), gold = [...crew.balls.values()].filter(b => b.kind === 'gold');
  assert.equal(mowe.length, 12); assert.ok(mowe.every(b => b.rest), 'they come to rest');
  for (const b of mowe) assert.ok(Math.hypot(b.x - at.x, b.z - at.z) <= BOSS.FOUNT_R, `a MOW-E ball within 8 m (${Math.hypot(b.x - at.x, b.z - at.z).toFixed(1)})`);
  assert.ok(Math.abs(mowe[0].mul - BOSS.PAYX * 15 / 12) < 1e-9, '×2 of what it ate, on average');
  assert.equal(gold.length, 1); for (const b of gold) assert.ok(Math.hypot(b.x - at.x, b.z - at.z) <= BOSS.GOLD_R, 'gold within 6 m');
  assert.equal(p.down > 0, false, 'the fountain never flattened the Rat in the ring');
  // the bell: leftovers bank ×1 and are not "left out there"
  const cash = crew.cash;
  crew.endShift();
  assert.ok(crew.cash > cash); assert.equal([...crew.balls.values()].filter(b => b.mowe).length, 0);
});

test('a win pays the bounty and a commendation; a loss loses the catcher; two losses tame him', () => {
  assert.deepEqual(bossPayout({ eaten: 30, eatenW: 33, n: 4 }), { n: 45, w: 49.5, gold: 4, bounty: BOSS.BOUNTY }, 'round 13 #3d: ×1.5');
  assert.equal(bossPayout({ eaten: 0, eatenW: 0, n: 9 }).gold, BOSS.GOLD);
  const clock = { t: 1e6 };
  const crew = new Crew('BOSS', { venue: 1, day: 7, venueDay: 2, up: { cart: 1, wand: 1 } }, { shiftSecs: 420, seed: 3, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  assert.equal(crew.bossToday(), 'club');
  crew.shiftT = 126; crew.tick(0.05);
  assert.equal(crew.mower?.kind, 'boss');
  assert.ok(crew.events.some(e => e.t === 'pa' && e.id === 'rogue'));
  const m = crew.mower;
  m.phase = 'plug'; m.ring = ringOf(m); m.eaten = 10; m.eatenW = 10;
  const cash = crew.cash, comm = crew.commendations, n0 = crew.balls.size;
  Object.assign(p, { x: m.ring.x, z: m.ring.z, holding: true });
  for (let i = 0; i < 70 && m.phase === 'plug'; i++) { if (m.ring) Object.assign(p, { x: m.ring.x, z: m.ring.z }); clock.t += 50; crew.tick(0.05); }   // walk it home
  assert.equal(m.phase, 'tamed');
  assert.ok(crew.events.some(e => e.t === 'mower' && e.phase === 'tamed' && e.n === 10), 'n: the MOW-E balls in the fountain');
  assert.ok(crew.cash > cash, 'the bounty'); assert.equal(crew.commendations, Math.min(10, comm + 1));
  assert.equal([...crew.balls.values()].filter(b => b.kind === 'gold').length >= 1, true, 'a gold ball for the Rat');
  assert.ok(crew.balls.size >= n0 + 1);
  assert.deepEqual(crew.toSave().mowe, { tame: true, lost: 0, encore: false, beat: true, memo: BOSS_LINES.regards });
  assert.deepEqual(cleanMowe({ tame: true, beat: true }), { tame: true, lost: 0, encore: false, beat: true }, 'the beat flag survives a save');
  // the losses
  const lose = new Crew('BOSS', { venue: 1, day: 7, venueDay: 2 }, { shiftSecs: 420, seed: 3, now: () => clock.t });
  const q = lose.join('B'); lose.connect(q);
  lose.startShift(); lose.shiftT = 126; lose.tick(0.05);
  const cash2 = lose.cash; lose.mower.eaten = 20;
  lose.moweLose();
  assert.equal(lose.cash, cash2, 'the eaten balls are gone');
  assert.deepEqual(lose.moweSt, { tame: false, lost: 1, encore: false }); assert.equal(lose.moweMemo, BOSS_LINES.eotm);
  assert.ok(lose.events.some(e => e.t === 'mower' && e.phase === 'fled' && e.kept === 20));
  lose.mower = null; lose.moweStart(); assert.equal(lose.mower.hpMax, crewHP(1) - 1, 'the rematch is tired');
  lose.moweLose();
  assert.deepEqual(lose.moweSt, { tame: true, lost: 2, encore: false }); assert.equal(lose.moweMemo, BOSS_LINES.warranty);
  assert.equal(lose.mower.final, true);
});

test('the bell mid-fight is a loss (never stuck), and a fight on a short shift ends before the bell', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('BOSS', { venue: 1, day: 7, venueDay: 2 }, { shiftSecs: 120, seed: 3, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  for (let i = 0; i < 125 * 20 && crew.phase === 'shift'; i++) { clock.t += 50; crew.tick(0.05); }
  assert.equal(crew.phase, 'report');
  assert.equal(crew.moweSt.lost, 1, 'it fled before (or at) the bell');
  assert.ok(crew.mower.phase === 'fled');
});

test('round 13 #5b, the tame pass: two a shift (30 / 65 %), to the richest spot, ±4 m, at most 12, banks at a return, never knocks', () => {
  assert.equal(tameDue({ venue: 2, tame: true, shiftT: 125, shiftSecs: 420 }), -1);
  assert.equal(tameDue({ venue: 2, tame: true, shiftT: 126, shiftSecs: 420 }), 0);
  assert.equal(tameDue({ venue: 2, tame: true, shiftT: 273, shiftSecs: 420, k: 1 }), 1);
  assert.equal(tameDue({ venue: 2, tame: true, shiftT: 400, shiftSecs: 420, k: 2 }), -1, 'two passes');
  assert.equal(TAME.CAP, 12);
  assert.equal(tameDue({ venue: 2, tame: false, shiftT: 400, shiftSecs: 420 }), -1, 'untamed: no pet');
  assert.equal(tameDue({ venue: 2, tame: true, endless: true, shiftT: 400, shiftSecs: 420 }), -1);
  // it seeks the richest spot, not the old six lanes; and keeps its drive out of the pond
  const pile = Array.from({ length: 8 }, (_, i) => ({ id: 100 + i, x: 30 + (i % 4), z: -95 + (i >> 2), rest: true, kind: 'range' }));
  const run = tameRun([...pile, { id: 99, x: -40, z: -30, rest: true }]);
  assert.ok(Math.abs(run.z - -95) <= 1 && run.x0 <= 30 && run.x1 >= 33, `the pile (${JSON.stringify(run)})`);
  const wet = tameRun([{ id: 1, x: 5, z: -78, rest: true }, { id: 2, x: 6, z: -78, rest: true }]);
  assert.ok(wet.x0 >= BOSS.POND.x + BOSS.POND.r, 'the drive stops short of the pond');
  const lane = -100;
  const balls = Array.from({ length: 10 }, (_, i) => ({ id: i, x: -10 + i * 3, z: lane + 1, rest: true, kind: 'range' }));
  const s = newTame(balls);
  assert.ok(Math.abs(s.lane - (lane + 1)) < 1e-9, 'the richest spot\'s line');
  const rat = { id: 'r', x: s.x0 + 8, z: s.lane };
  let gathered = 0, bank = null, beeps = 0, blockedAt = null;
  for (let i = 0; i < 2400 && s.phase !== 'done'; i++) {
    const o = stepTame(s, 0.05, { balls: balls.filter(b => !b.gone), people: [rat], returnAt: () => ({ x: 27, z: 1.8 }) });
    for (const id of o.gathered) balls[id].gone = true;
    gathered += o.gathered.length; if (o.bank) bank = o.bank; if (o.beep) beeps++;
    if (s.blocked && blockedAt == null) blockedAt = Math.hypot(rat.x - s.x, rat.z - s.z);
    if (s.phase === 'mow' && tameBoard(s)) assert.match(tameBoard(s), /^MOW-E · BRINGING \d+ HOME$/);
  }
  assert.equal(s.phase, 'done'); assert.equal(gathered, 10); assert.deepEqual(bank, { n: 10, w: 10 });
  assert.ok(beeps >= 1 && blockedAt != null && blockedAt > 1.3, 'it stopped short of the Rat and beeped');
  assert.equal(moweSnap(s).kind, 'tame'); assert.equal(moweBoard(s), null);
  // at most 25 a pass
  const many = Array.from({ length: 60 }, (_, i) => ({ id: i, x: -20 + i * 0.5, z: -60, rest: true, kind: 'range' }));
  const c = newTame(many); let got = 0;
  for (let i = 0; i < 2400 && c.phase !== 'done'; i++) { const o = stepTame(c, 0.05, { balls: many.filter(b => !b.gone), returnAt: () => ({ x: 27, z: 1.8 }) }); for (const id of o.gathered) many[id].gone = true; got += o.gathered.length; }
  assert.equal(got, TAME.CAP);
  // the whistle's pass says it's coming
  const w = newTame(many, 0, { bonus: true }); assert.equal(moweBoard(w), 'MOW-E · ON HIS WAY');
});

test('round 12 #5d, the whistle: once a shift at the MOW-E post, a bonus pass now; not on a boss day, in endless or before the Club', () => {
  assert.ok(atPost(WHISTLE.POST) && !atPost({ x: WHISTLE.POST.x + 3, z: WHISTLE.POST.z }));
  assert.ok(whistleOpen({ tame: true, venue: 2 })); assert.ok(!whistleOpen({ tame: false, venue: 2 }));
  assert.ok(!whistleOpen({ tame: true, venue: 2, endless: true })); assert.ok(!whistleOpen({ tame: true, venue: 3, boss: true }));
  const clock = { t: 1e6 };
  const crew = new Crew('WHIS', { venue: 2, day: 12, venueDay: 3, mowe: { tame: true } }, { shiftSecs: 420, seed: 5, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  assert.equal(crew.whistleState(), 1);
  Object.assign(p, { x: 0, z: -20 });
  assert.equal(crew.moweWhistle(p), false, 'only taken at the post');
  // round 13 #5a: take it at the post (state 3, carried), then blow it out in the field
  Object.assign(p, WHISTLE.POST);
  crew.input(p, { a: [{ t: 'whistle' }] });
  assert.equal(crew.whistleState(), 3); assert.equal(crew.whistleCarrier(), p.id); assert.equal(crew.mower, null, 'taking it sends nobody');
  assert.ok(crew.events.some(e => e.t === 'moweWhistle' && e.take));
  const q = crew.join('B'); crew.connect(q); Object.assign(q, { x: 0, z: -60 });
  assert.equal(crew.moweWhistle(q), false, 'one Rat holds it');
  Object.assign(p, { x: 27, z: -12 });   // ~14 m from the return
  assert.equal(crew.moweWhistle(p), false, 'no blow within 20 m of the return');
  Object.assign(p, { x: 10, z: -40 });
  crew.input(p, { a: [{ t: 'whistle', x: 999, z: 999 }] });   // the client's x/z is ignored: the server's own position
  const m = crew.mower;
  assert.equal(m?.kind, 'tame'); assert.ok(m.bonus && m.whistle); assert.equal(crew.whistleState(), 2);
  assert.deepEqual(m.strip.at, { x: 10, z: -40 }, 'the whistle is server-positioned');
  assert.ok(crew.events.some(e => e.t === 'moweWhistle' && e.blow));
  assert.equal(crew.moweWhistle(p), false, 'once a shift');
  Object.assign(p, WHISTLE.POST); assert.equal(crew.moweWhistle(p), false, 'once a shift (not back on the post to take)');
  // the bonus pass doesn't use up the first scheduled one
  for (let i = 0; i < 200 * 20 && crew.shiftT < 140; i++) { clock.t += 50; crew.tick(0.05); crew.events = []; }
  assert.ok(crew.mower.kind === 'tame' && !crew.mower.bonus && crew.mower.k === 0, 'the 30 % pass still comes');
});

test('round 13 #5a: the whistle strip: 10 m wide, 30 m long through the spot toward the return, at most 30', () => {
  const ret = { x: 27, z: 1.8 }, at = { x: 10, z: -60 };
  const st = whistleStrip(at, ret);
  assert.ok(Math.abs(Math.hypot(st.b.x - st.a.x, st.b.z - st.a.z) - WHISTLE.STRIP.L) < 1e-9, '30 m long');
  assert.ok(Math.hypot(st.b.x - ret.x, st.b.z - ret.z) < Math.hypot(st.a.x - ret.x, st.a.z - ret.z), 'b is the end toward the return');
  assert.ok(Math.abs((st.a.x + st.b.x) / 2 - at.x) < 1e-9 && Math.abs((st.a.z + st.b.z) / 2 - at.z) < 1e-9, 'through the spot');
  assert.ok(inStrip(st, at) && !inStrip(st, { x: at.x + 8, z: at.z }), '±5 m wide');
  assert.ok(canBlow({ x: 10, z: -20 }, ret) && !canBlow({ x: 20, z: -10 }, ret), '20 m from the return');
  // 50 balls along the strip, 6 just outside it: the pass takes 30, all inside
  const L = 30, ux = (st.b.x - st.a.x) / L, uz = (st.b.z - st.a.z) / L;
  const balls = Array.from({ length: 50 }, (_, i) => ({ id: i, x: st.a.x + ux * (i * 0.6) + uz * ((i % 5) - 2), z: st.a.z + uz * (i * 0.6) - ux * ((i % 5) - 2), rest: true, kind: 'range' }));
  for (let i = 0; i < 6; i++) balls.push({ id: 100 + i, x: at.x - uz * 7, z: at.z + ux * 7 + i * 0.1, rest: true, kind: 'range' });
  const s = newWhistlePass(at, ret);
  let got = [], bank = null;
  for (let i = 0; i < 4000 && s.phase !== 'done'; i++) {
    const o = stepTame(s, 0.05, { balls: balls.filter(b => !b.gone), returnAt: () => ret });
    for (const id of o.gathered) { balls.find(b => b.id === id).gone = true; got.push(id); }
    if (o.bank) bank = o.bank;
  }
  assert.equal(s.phase, 'done'); assert.equal(got.length, WHISTLE.CAP); assert.ok(got.every(id => id < 100), 'only inside the strip');
  assert.equal(bank.n, WHISTLE.CAP);
});

test('in a crew: a tamed MOW-E makes its passes and banks helper balls; no boss and no pet on an untamed later venue', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('TAME', { venue: 2, day: 12, venueDay: 3, mowe: { tame: true } }, { shiftSecs: 420, seed: 5, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p); p.x = 30; p.z = 8;
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  for (let i = 0; i < 20; i++) { const b = crew.addBall({ x: -10 + i * 1.5, y: 0.02, z: MOWER.LANES[0] + 0.5, vx: 0, vy: 0, vz: 0, kind: 'range' }); b.rest = true; }
  crew.shiftT = 84;
  let banked = 0;
  for (let i = 0; i < 120 * 20; i++) { clock.t += 50; crew.tick(0.05); for (const e of crew.events) if (e.t === 'moweBank') banked += e.n; crew.events = []; }
  assert.equal(banked, TAME.CAP, 'round 13 #5b: one pass of 12 by T−1:36');
  const later = new Crew('UNT', { venue: 2, day: 12, venueDay: 3 }, { shiftSecs: 420, seed: 5, now: () => clock.t });
  const q = later.join('A'); later.connect(q);
  later.startShift(); later.shiftT = 300;
  for (let i = 0; i < 40; i++) later.tick(0.05);
  assert.equal(later.mower, null, 'an old save past the Club: untamed, no pet (the encore can still tame him)');
});

test('an old save loads untamed; the save round-trips; junk is cleaned', () => {
  assert.deepEqual(cleanMowe(undefined), { tame: false, lost: 0, encore: false });
  assert.deepEqual(cleanMowe({ tame: 'yes', lost: 9, encore: 1, memo: 'hello' }), { tame: true, lost: 2, encore: false });
  assert.deepEqual(cleanMowe({ lost: 1, memo: BOSS_LINES.eotm }), { tame: false, lost: 1, encore: false, memo: BOSS_LINES.eotm });
  const crew = new Crew('OLD', { venue: 1, day: 6, venueDay: 2 }, { seed: 1 });
  assert.deepEqual(crew.moweSt, { tame: false, lost: 0, encore: false });
  const again = new Crew('OLD', crew.toSave(), { seed: 1 });
  assert.deepEqual(again.moweSt, crew.moweSt);
});

test('the boss morning: Gary slips a day and no Today is dealt', () => {
  const crew = new Crew('GARY', { venue: 1, day: 8, venueDay: 2, garyDay: 9 }, { shiftSecs: 420, seed: 1 });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();   // day 8 → its venue day 3
  assert.equal(crew.bossToday(), 'club');
  assert.equal(crew.garyToday(), false); assert.equal(crew.today, null);
  const g = new Crew('GARY', { venue: 1, day: 8, venueDay: 2, garyDay: 8 }, { shiftSecs: 420, seed: 1 });
  g.join('A'); g.startShift();
  assert.equal(g.garyDay, 9, 'a visit due on the boss morning comes tomorrow');
});

test('the snapshot and the Board: the boss, the encore, the plug', () => {
  const s = fight(4);
  const snap = bossSnap(s);
  for (const k of ['kind', 'phase', 'x', 'z', 'yaw', 'hp', 'hpMax', 'eaten', 'stall', 'open', 'target', 'plug', 'ring', 'sink', 'left']) assert.ok(k in snap, k);
  assert.equal(moweSnap(s).kind, 'boss'); assert.equal(moweBoard(s), bossBoard(s));
  assert.ok(bossLive(s));
  assert.ok(snap.meters && 'full' in snap, 'round 12: the meters and the grille glow');
  hoseBoss(s, rear(s, 4, 'me'), 1); hoseBoss(s, rear(s, 4, 'you'), 4.5);
  const sm = bossSnap(s);
  assert.deepEqual(sm.meters.me, [0.25, 0]); assert.deepEqual(sm.meters.you, [0, BOSS.COOL_ME]); assert.equal(sm.full, 0.25, 'the glow: the fullest live meter');
  s.phase = 'plug'; s.plug = 0.6; assert.equal(bossBoard(s), 'PULL! ■■□□');
  assert.equal(bossSnap(s).meters, null, 'no meters at the plug');
  assert.equal(moweSnap(null), null);
});

test('every new centre line is 8 words or fewer; the award and the sound helpers', () => {
  const lines = [BOSS_LINES.loose, BOSS_LINES.hunt, BOSS_LINES.plug('Ⓐ'), BOSS_LINES.plug('Space'), BOSS_LINES.stamp, BOSS_LINES.eotm, BOSS_LINES.regards,
    BOSS_LINES.warranty, BOSS_LINES.kept(37), BOSS_LINES.back, BOSS_LINES.prompt('Ⓐ'), BOSS_LINES.whistle('Ⓐ'), BOSS_LINES.whistle('Space'), PA_LINES.rogue.caption, PA_LINES.rogue2.caption, PA_LINES.pond.caption];
  for (const l of lines) assert.ok(wordCount(l) <= SAY.MAX_WORDS, `${wordCount(l)}: ${l}`);
  assert.equal(PA_LINES.rogue.caption, 'MOW-E updated itself. Please stand back.');
  assert.ok(NIGHT_KEYS.includes('moweHits')); assert.equal(AWARDS[0][0], 'MOW-E Wrangler');
  assert.equal(awardsFor({ A: { banked: 9, moweHits: 3 }, B: { banked: 99 } })[1].award, 'MOW-E Wrangler');
  const near = moweEngineParams(1, 0), far = moweEngineParams(1, 45);
  assert.equal(near.freq, MOWE_ENGINE.F1); assert.equal(moweEngineParams(0).freq, MOWE_ENGINE.F0); assert.equal(moweEngineParams(0.5, 0, true).freq, MOWE_ENGINE.IDLE);
  assert.ok(Math.abs(near.gain - MOWE_ENGINE.GAIN) < 1e-9 && Math.abs(far.gain - MOWE_ENGINE.GAIN / 4) < 1e-9, 'gain 0.03 / (1 + d / 15)');
  assert.deepEqual(['warn', 'harvest', 'hunt', 'plug'].map(p => bossTempo(p)), [96, 112, 128, 144]);
  assert.equal(bossTempo('plug', 1), 200, 'the heartbeat speeds up with the pull'); assert.equal(bossTempo('hunt', 1), 128);
});

test('round 12 #5a: the boss morning: the update bar from the bell to the warn, the stripes, the memo line', () => {
  assert.deepEqual(updateSnap('club', 0, 420), { kind: 'update', pct: 0 });
  assert.equal(updateSnap('club', 126, 420), null, 'the warn takes over');
  assert.equal(updateSnap(null, 50, 420), null);
  assert.equal(updateBoard(updateSnap('club', 80.64, 420)), 'MOW-E UPDATE ▓▓▓░ 64 %');
  assert.equal(updateBoard({ pct: 1 }), 'MOW-E UPDATE ▓▓▓▓ 100 %');
  assert.equal(moweBoard(updateSnap('club', 0, 420)), 'MOW-E UPDATE ░░░░ 0 %');
  const crew = new Crew('UPD', { venue: 1, day: 7, venueDay: 2 }, { shiftSecs: 420, seed: 3 });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  assert.equal(crew.bossToday(), 'club');   // the memo's second line is builder 4's (sim.js MEMO_LINES.moweUpdate; a NEW line outranks it)
});

test('9.10: in the fight, a customer ball never flattens a helper', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('HLP', { venue: 1, day: 7, venueDay: 2, up: { helpers: 1 } }, { shiftSecs: 420, seed: 3, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift(); crew.shiftT = 126; crew.tick(0.05);
  assert.ok(bossLive(crew.mower)); crew.tick(0.05);
  assert.ok(crew.moweLookUntil > crew.custT, 'helpers are covered while it is live');
});

test('for builder 3: a Club win flags moweBeat until Gary’s next Club verdict, which carries moweWon once', async () => {
  const crew = new Crew('BEAT', { venue: 1, day: 9, venueDay: 4, mowe: { tame: true, beat: true } }, { shiftSecs: 420, seed: 2 });
  assert.equal(crew.moweSt.beat, true);
  const moweWon = crew.venue === 1 && !!crew.moweSt.beat;
  assert.ok(moweWon);
  const src = (await import('node:fs')).readFileSync(new URL('../server/crew.mjs', import.meta.url), 'utf8');
  assert.ok(src.includes('moweWon') && src.includes('moweBeat'), 'the verdict event and the snapshot carry it');
});

test('9.12: MOW-E smoke is a soft round puff (its own pool), confetti stays paper; the sounds builder 2 asked for exist', async () => {
  const { readFileSync } = await import('node:fs');   // confetti.js imports three (not in node): read its source, as closingbell.test does
  const src = readFileSync(new URL('../web/js/confetti.js', import.meta.url), 'utf8');
  assert.ok(src.includes('SMOKE: { MAX:') && src.includes('puffTexture()') && src.includes('transparent: true'), 'a soft round sprite pool for smoke');
  assert.ok(src.includes('if (tint != null && max === CONFETTI.MAX)'), 'tinted bursts (the smoke) go to it');
  const SFX = await import('../web/js/sfx.js');
  for (const k of ['organ', 'chant', 'creak', 'whistle', 'sputter']) assert.equal(typeof SFX[k], 'function', k);
  SFX.organ(); SFX.chant();   // no audio context in node: a silent no-op
});

// ---- council round 13, builder 1: the loss path and report, MOW-E 2.0 crashes Promotion Day, the payout trim, the sidestep
test('round 13 #3a: a loss fires the red stamp, then one line; "Rematch tomorrow" is true for tomorrow\'s bossDay', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('LOSS', { venue: 1, day: 7, venueDay: 2 }, { shiftSecs: 420, seed: 3, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift(); crew.shiftT = 126; crew.tick(0.05);
  crew.mower.eaten = 26; crew.events = [];
  crew.moweLose();
  const e = crew.events.find(x => x.t === 'mower' && x.phase === 'fled');
  assert.ok(e.rematch, 'the card is far from done: the rematch is tomorrow');
  assert.equal(e.line, BOSS_LINES.lost);
  assert.equal(stampText({ won: false }), 'MOW-E WINS'); assert.equal(stampText({ won: true, encore: true }), 'MOW-E 2.0 TAMED');
  assert.equal(bossDay({ venue: 1, venueDay: crew.venueDay + 1, st: crew.moweSt }), 'club', 'tomorrow really is the rematch');
  // the Board: the scoreline once the stamp's banner has had its 30 s
  const m = crew.mower; m.goneT = 0; m.t = BOSS.AFTER + 1;
  assert.equal(bossBoard(m), 'MOW-E 1 · CREW 0'); assert.equal(scoreBoard(1), 'MOW-E 1 · CREW 0');
  // the report's row and the Tomorrow line
  crew.endShift();
  const r = crew.report;
  assert.deepEqual({ won: r.mowe.won, kept: r.mowe.kept, rematch: r.mowe.rematch }, { won: false, kept: 26, rematch: true });
  assert.equal(moweRow(r.mowe), 'MOW-E: got away · kept 26 balls · rematch tomorrow');
  if (!crew.promoDay) assert.equal(r.tomorrow, BOSS_LINES.rematchEve);
  assert.equal(moweRow({ won: true, n: 18, gold: 4 }), 'MOW-E: tamed · 18 balls · 4 gold');
  // the hedge: a card that could be signed by tomorrow, or the second loss, says "For now"
  assert.equal(rematchNext({ final: true }), false); assert.equal(rematchNext({ encore: true }), false);
  const near = [{ kind: 'reviews', need: 3, have: 2, done: false }, { kind: 'fee', need: 100, have: 80, done: false }, { kind: 'count', done: true }];
  assert.ok(promoNear(near)); assert.equal(rematchNext({ rows: near }), false);
  assert.ok(!promoNear([{ kind: 'reviews', need: 3, have: 0, done: false }, { kind: 'fee', need: 100, have: 10 }]));
  assert.equal(lostLine({ rematch: false }), BOSS_LINES.lostLater); assert.equal(lostLine({ encore: true, crash: true }), BOSS_LINES.crashLeft);
});

test('round 13 #3a: the bell beating the fight still writes the report row', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('BELL', { venue: 1, day: 7, venueDay: 2 }, { shiftSecs: 420, seed: 3, now: () => clock.t });
  crew.join('A'); crew.startShift(); crew.shiftT = 126; crew.tick(0.05);
  assert.equal(crew.mower?.kind, 'boss');
  crew.endShift();
  assert.equal(crew.report.mowe?.won, false); assert.equal(crew.moweSt.lost, 1);
});

test('round 13 #3b: tomorrowText says MOW-E on the boss eve and the rematch eve', () => {
  assert.equal(moweEve(bossDay({ venue: 1, venueDay: 3, st: { tame: false, lost: 0 } }), { lost: 0 }), BOSS_LINES.eve);
  assert.equal(moweEve(bossDay({ venue: 1, venueDay: 4, st: { tame: false, lost: 1 } }), { lost: 1 }), BOSS_LINES.rematchEve);
  assert.equal(moweEve(bossDay({ venue: 1, venueDay: 4, st: { tame: true } }), { tame: true }), null);
  // in a crew: the Club day-2 bell
  const clock = { t: 1e6 };
  const crew = new Crew('EVE', { venue: 1, day: 6, venueDay: 1 }, { shiftSecs: 420, seed: 3, now: () => clock.t });
  crew.join('A'); crew.startShift();
  assert.equal(crew.venueDay, 2); assert.equal(crew.bossToday(), null);
  crew.endShift();
  assert.equal(crew.report.tomorrow, BOSS_LINES.eve);
});

test('round 13 #3c: MOW-E 2.0 crashes a Stadium Promotion Day: encore, warns at 180 s, a loss still promotes and sets encore', () => {
  const st = { tame: true, encore: false };
  assert.equal(bossDay({ venue: 3, venueDay: 2, promo: true, st }), 'encore');
  assert.equal(bossDay({ venue: 3, venueDay: 2, promo: true, st: { ...st, encore: true } }), null, 'one encore');
  assert.equal(bossDay({ venue: 3, venueDay: 2, promo: true, st: { tame: false } }), 'encore', 'as the encore: an untamed crew meets it too');
  assert.equal(bossDay({ venue: 1, venueDay: 3, promo: true, st: { tame: false } }), null, 'the Club still skips Promotion Day');
  assert.ok(isCrash({ venue: 3, venueDay: 2, promo: true, st }));
  assert.equal(Math.round(bossAt(420, true)), 180); assert.equal(Math.round(bossAt(420)), 126);
  assert.ok(!bossDue({ venue: 3, venueDay: 2, promo: true, st, shiftT: 179, shiftSecs: 420 }) && bossDue({ venue: 3, venueDay: 2, promo: true, st, shiftT: 180, shiftSecs: 420 }));
  assert.match(updateBoard(updateSnap('encore', 90, 420, true)), /^PROMOTION DAY · MOW-E 2\.0 UPDATE [▓░]{3}$/);
  assert.equal(PA_LINES.crash.caption, BOSS_LINES.crash);
  const clock = { t: 1e6 };
  const crew = new Crew('CRASH', { venue: 3, day: 21, venueDay: 1, promoDay: 21, mowe: { tame: true } }, { shiftSecs: 420, seed: 3, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  assert.equal(crew.day, 21); assert.equal(crew.bossToday(), 'encore');
  crew.shiftT = 178; crew.tick(0.05); assert.notEqual(crew.mower?.kind, 'boss', 'not before 180 s');
  crew.shiftT = 180; crew.events = []; crew.tick(0.05);
  assert.equal(crew.mower?.kind, 'boss'); assert.ok(crew.mower.crash && crew.mower.encore);
  assert.ok(crew.events.some(e => e.t === 'pa' && e.id === 'crash'));
  crew.events = []; crew.moweLose();
  const e = crew.events.find(x => x.t === 'mower' && x.phase === 'fled');
  assert.equal(e.line, BOSS_LINES.crashLeft); assert.equal(crew.moweSt.encore, true, 'encore played either way');
  assert.equal(bossDay({ venue: 3, venueDay: 2, promo: true, st: crew.moweSt }), null);
  assert.equal(crew.promoDay, crew.day, 'a loss doesn\'t touch Promotion Day: the bell still promotes');
});

test('round 13 #3c: the crash morning plays Gary\'s Stadium mid beat', () => {
  assert.equal(midDue({ venue: 3, venueDay: 2, promoDay: true, boss: true }), 'mid:3');
  assert.equal(midDue({ venue: 3, venueDay: 2, promoDay: true, boss: false }), null, 'a plain Promotion Day: no');
  assert.equal(midDue({ venue: 1, venueDay: 3, promoDay: true, boss: true }), null);
});

test('round 13 #3d/#3e/#3f: the burst is ×1.5; the dodge side is perpendicular to the hunt; the boss owns the screen', () => {
  assert.equal(BOSS.PAYX, 1.5); assert.equal(BURST_MULT, 1.5);
  assert.equal(newBoss({ n: 2 }).catcher, 30); assert.equal(newBoss({ n: 3 }).catcher, 24, 'the catcher holds 24 at 3P+'); assert.equal(newBoss({ n: 4 }).catcher, 24);
  { const c = fight(4); c.eaten = 24; assert.deepEqual(stepBoss(c, 0.7, { balls: [{ id: 9, x: c.x + 0.5, z: c.z, rest: true }] }).eaten, [], 'full at 24'); }
  assert.equal(bossPayout({ eaten: 10, eatenW: 10, n: 1 }).n, 15);
  const s = fight(1); s.yaw = 0.7;   // forward (-sin, -cos)
  const f = { x: -Math.sin(s.yaw), z: -Math.cos(s.yaw) };
  for (const side of [-1, 1]) {
    const p = { x: s.x + f.x * 5 - f.z * side * 1.5, z: s.z + f.z * 5 + f.x * side * 1.5 };
    const v = sidestep(s, p);
    assert.ok(Math.abs(v.x * f.x + v.z * f.z) < 1e-9, 'perpendicular to its heading');
    assert.ok(Math.abs(Math.hypot(v.x, v.z) - 1) < 1e-9);
    assert.ok(v.x * (p.x - s.x) + v.z * (p.z - s.z) > 0, 'toward the side the Rat is already on');
  }
  assert.ok(bossOwnsScreen(newBoss({ n: 2 })), 'from the warn');
  const w = fight(2); w.phase = 'tamed'; assert.ok(!bossOwnsScreen(w), 'not after the stamp'); assert.ok(!bossOwnsScreen(null));
  // the tell: the snapshot's rev flag comes in the last REV s before a re-aim
  const h = fight(1); h.phase = 'hunt'; h.rage = 0; h.stall = 0; h.aimT = 0.3; assert.equal(bossSnap(h).rev, true); h.aimT = 2; assert.equal(bossSnap(h).rev, false);
});

test('round 13: every new MOW-E line is 8 words or fewer', () => {
  const lines = [BOSS_LINES.lost, BOSS_LINES.lostLater, BOSS_LINES.crash, BOSS_LINES.crashLeft, BOSS_LINES.huntSolo, BOSS_LINES.regards, BOSS_LINES.lostStamp, BOSS_LINES.stamp2,
    BOSS_LINES.whistle('Ⓐ'), BOSS_LINES.blow('Ⓐ'), BOSS_LINES.blow('Space'), BOSS_LINES.eve, BOSS_LINES.rematchEve, PA_LINES.crash.caption,
    BOSS_LINES.took('Pip'), BOSS_LINES.blew('Pip'), BOSS_LINES.brought(28)];
  for (const l of lines) assert.ok(wordCount(l) <= SAY.MAX_WORDS, l);
});

test('round 13 #5a: the aimed strip fetches a member\'s ball (builder 2 banks it), never a ball outside the strip', () => {
  const ret = { x: 27, z: 1.8 }, at = { x: 10, z: -60 }, s = newWhistlePass(at, ret);
  const balls = [{ id: 1, x: at.x, z: at.z, rest: true, kind: 'member', member: 0, hands: true }, { id: 2, x: at.x + 9, z: at.z, rest: true, kind: 'member', member: 0, hands: true }];
  const got = [];
  for (let i = 0; i < 4000 && s.phase !== 'done'; i++) { const o = stepTame(s, 0.05, { balls, returnAt: () => ret }); got.push(...(o.members ?? [])); }
  assert.deepEqual(got, [1]);
});

test('round 13, the lead\'s calls: the solo strip holds 14, the whistle pass sets out from the post, Gary waits for the crash', () => {
  const ret = { x: 27, z: 1.8 }, at = { x: 10, z: -60 };
  assert.equal(newWhistlePass(at, ret, 0, 1).cap, WHISTLE.CAP_1P); assert.equal(WHISTLE.CAP_1P, 14); assert.equal(newWhistlePass(at, ret, 0, 2).cap, WHISTLE.CAP);
  const s = newWhistlePass(at, ret); assert.deepEqual({ x: s.x, z: s.z }, WHISTLE.POST, 'from the post, not the shed');
  // the crash day: Gary's warn (due at 43 %) waits while the fight is live, then he still inspects before the bell
  const clock = { t: 1e6 };
  const crew = new Crew('GCRASH', { venue: 3, day: 21, venueDay: 1, promoDay: 21, mowe: { tame: true } }, { shiftSecs: 420, seed: 3, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p); p.x = 30; p.z = 8;
  crew.startShift();
  assert.ok(crew.garyToday(), 'Gary inspects on Promotion Day');
  for (const m of crew.mats) m.next = 1e9;
  let warnAt = null, fightEnd = null, verdict = false;
  for (let i = 0; i < 430 * 20 && crew.phase === 'shift'; i++) {
    clock.t += 50; crew.tick(0.05);
    for (const e of crew.events) {
      if (e.t === 'gary' && e.phase === 'warn' && warnAt == null) { warnAt = crew.shiftT; assert.ok(!bossLive(crew.mower), 'never during the fight'); }
      if (e.t === 'mower' && e.boss && (e.phase === 'fled' || e.phase === 'tamed')) fightEnd = crew.shiftT;
      if (e.t === 'verdict') verdict = true;
    }
    crew.events = [];
  }
  assert.ok(fightEnd != null && warnAt != null && warnAt >= fightEnd, `the warn (${warnAt}) after the fight (${fightEnd})`);
  assert.ok(verdict, 'he still inspects before the bell');
});
