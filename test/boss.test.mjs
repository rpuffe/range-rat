// Council round 11 #1 (builder 1): MOW-E Goes Rogue (the boss), the tame pet, MOW-E 2.0 (design/council-round11.md §2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS, TAME, BOSS_LINES, crewHP, huntSpeed, bossDay, bossDue, newBoss, stepBoss, hoseBoss, behind, ringOf, inRing,
  bossPayout, bossBoard, bossSnap, bossLive, richest, tameDue, newTame, stepTame, tameBoard, moweSnap, moweBoard, cleanMowe, eatable, MOWER } from '../web/js/mowe.js';
import { MAP } from '../web/js/map.js';
import { WASH } from '../web/js/sim.js';
import { PA_LINES } from '../web/js/pa.js';
import { wordCount, SAY } from '../web/js/say.js';
import { todayFor } from '../web/js/today.js';
import { bossSlip } from '../web/js/garyvisit.js';
import { AWARDS, NIGHT_KEYS, awardsFor } from '../web/js/awards.js';
import { moweEngineParams, bossTempo, MOWE_ENGINE } from '../web/js/sfx.js';
import { Crew } from '../server/crew.mjs';

const step = (s, secs, ctx = {}, dt = 0.05) => { const outs = []; for (let i = 0; i < Math.round(secs / dt); i++) outs.push(stepBoss(s, dt, ctx)); return outs; };
const fight = (n = 4, o = {}) => { const s = newBoss({ n, ...o }); step(s, BOSS.WARN + 0.01); assert.equal(s.phase, 'harvest'); return s; };
// A Rat standing straight behind it at d m.
const rear = (s, d = 4, id = 'r') => ({ id, x: s.x + Math.sin(s.yaw) * d, z: s.z + Math.cos(s.yaw) * d });
const front = (s, d = 4, id = 'f') => ({ id, x: s.x - Math.sin(s.yaw) * d, z: s.z - Math.cos(s.yaw) * d });

test('the HP and hunt-speed table by crew size (§2.3), the rematch is tired, the encore is +1 and +10 %', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(crewHP), [3, 3, 4, 4, 5, 5]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(huntSpeed), [4.0, 4.2, 4.4, 4.6, 4.8, 5.0]);
  assert.equal(newBoss({ n: 4 }).hpMax, 4);
  assert.equal(newBoss({ n: 4, lost: 1 }).hpMax, 3, 'the rematch: HP −1');
  assert.equal(newBoss({ n: 1, lost: 1 }).hpMax, 2, 'never under 2');
  const e = newBoss({ n: 4, encore: true });
  assert.equal(e.hpMax, 5); assert.ok(Math.abs(e.hunt - 4.6 * 1.1) < 1e-9); assert.ok(Math.abs(e.speed - BOSS.SPEED * 1.1) < 1e-9);
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

test('a hit is 2.0 s of spray ÷ washRate from its rear arc (several hosers add up), halved while stalled', () => {
  let s = fight();
  assert.ok(behind(s, rear(s)) && !behind(s, front(s)));
  const side = { x: s.x + Math.cos(s.yaw) * 4, z: s.z - Math.sin(s.yaw) * 4 };   // 90° off its nose: not the grille
  assert.ok(!behind(s, side), 'its side is not its back');
  assert.equal(hoseBoss(s, front(s), 1).ok, false, 'its nose: no');
  assert.equal(hoseBoss(s, rear(s, 12), 1, { reach: 7 }).ok, false, 'out of reach');
  assert.equal(hoseBoss(s, rear(s), 1.9).hit, false);
  const r = hoseBoss(s, rear(s), 0.1);
  assert.ok(r.hit); assert.equal(s.hp, 3);
  s = fight();
  assert.equal(hoseBoss(s, rear(s), 1.3, { rate: 1.5 }).hit, false);
  assert.equal(hoseBoss(s, rear(s), 0.04, { rate: 1.5 }).hit, true, 'the Fan: 1.33 s');
  s = fight();
  hoseBoss(s, rear(s, 4, 'a'), 0.5, { rate: 2 }); assert.equal(hoseBoss(s, rear(s, 4, 'b'), 0.5, { rate: 2 }).hit, true, 'two hosers with the Turbo: 0.5 + 0.5');
  s = fight(); s.stall = 3;
  assert.equal(hoseBoss(s, rear(s), 1.0).hit, true, 'stalled: 1.0 s');
  // after a hit the grille vents (shut): spray lands, does nothing
  assert.equal(s.vent, s.ventSecs);
  const v = hoseBoss(s, rear(s), 5);
  assert.ok(v.ok && !v.hit, 'venting');
});

test('one pip at a time: a hit staggers it (1 s), the vent is longer with more Rats, the harvest bolts', () => {
  assert.equal(newBoss({ n: 1 }).ventSecs, BOSS.VENT); assert.equal(newBoss({ n: 4 }).ventSecs, BOSS.VENT + 3 * BOSS.VENT_N);
  const s = fight(4, {}); s.wp = 0; s.burst = false;
  hoseBoss(s, rear(s), 2);
  assert.equal(s.stagger, BOSS.STAGGER); assert.equal(s.bolt, BOSS.BOLT_SECS);
  const x0 = s.x, z0 = s.z; step(s, 0.9);
  assert.ok(Math.hypot(s.x - x0, s.z - z0) < 1e-9, 'it stops while it staggers');
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
  let s = fight(4);
  hoseBoss(s, rear(s), 2); assert.equal(s.phase, 'harvest');
  s.vent = 0; hoseBoss(s, rear(s), 2); assert.equal(s.phase, 'hunt', '4 → 2');
  s = fight(1); hoseBoss(s, rear(s), 2); assert.equal(s.phase, 'hunt', 'solo 3 → 2');
  s = fight(4);
  const outs = step(s, BOSS.HARVEST_MAX + 0.1);
  assert.ok(outs.some(o => o.phase === 'hunt')); assert.equal(s.hp, 4);
  assert.ok(s.rage > 0 || s.ph > 0, 'it revs first');
});

test('the hunt picks the nearest Rat on foot: never a driver, a diver, a Rat aloft or one just flattened', () => {
  const s = fight(4); s.burst = false; s.x = 0; s.z = -24;
  hoseBoss(s, rear(s), 2); s.vent = 0; hoseBoss(s, rear(s), 2); s.stagger = 0; s.rage = 0;
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

test('it eats resting balls within 3 m (not souvenirs, sunk balls or Ball No. 1) until the catcher is full', () => {
  const s = fight(4); s.burst = false; s.x = 0; s.z = -24; s.goal = { x: 0, z: -24 }; s.seekT = 99;
  const balls = [{ id: 1, x: 1, z: -24, rest: true, kind: 'range' }, { id: 2, x: 2.9, z: -24, rest: true, kind: 'gold' }, { id: 3, x: 3.5, z: -24, rest: true },
    { id: 4, x: 0, z: -23, rest: true, sunk: true }, { id: 5, x: 0, z: -25, rest: true, kind: 'one' }, { id: 6, x: -1, z: -24, rest: true, hands: true }, { id: 7, x: 0, z: -24.5, rest: false }];
  const o = stepBoss(s, 0.01, { balls, weigh: b => (b.kind === 'gold' ? 10 : 1) });
  assert.deepEqual(o.eaten.sort(), [1, 2]); assert.equal(s.eaten, 2); assert.equal(s.eatenW, 11);
  assert.ok(!eatable({ rest: true, cup: 1 }));
  s.eaten = BOSS.CATCHER;
  assert.deepEqual(stepBoss(s, 0.01, { balls: [{ id: 9, x: 0.5, z: -24, rest: true }] }).eaten, [], 'full');
  // the harvest heads for the richest spot in its arena
  const pile = Array.from({ length: 6 }, (_, i) => ({ id: 20 + i, x: 30 + i * 0.5, z: -40, rest: true }));
  assert.deepEqual(richest({ x: 0, z: -10 }, [...pile, { id: 30, x: 0, z: -12, rest: true }]), { x: 30, z: -40, n: 6 });
  assert.equal(richest({ x: 0, z: -10 }, [{ id: 31, x: -12, z: -78, rest: true }]), null, 'the pond is out of bounds');
});

test('the plug: 2.4 s ÷ min(3, holders) in the ring at its back; nobody for 10 s reboots it at 1 HP and +15 s', () => {
  const s = fight(4); s.phase = 'hunt'; s.hp = 1; s.vent = 0; s.rage = 0;
  const r = hoseBoss(s, rear(s), 2);
  assert.equal(r.phase, 'plug'); assert.equal(s.phase, 'plug');
  const ring = ringOf(s);
  assert.ok(inRing(s, ring) && !inRing(s, front(s, 3)));
  const rat = (id, held = true) => ({ id, x: ring.x, z: ring.z, holding: held });
  step(s, 1.2, { rats: [rat('a')] }); assert.ok(Math.abs(s.plug - 0.5) < 0.03, 'solo: half way at 1.2 s');
  step(s, 0.4, { rats: [rat('a'), rat('b'), rat('c'), rat('d')] });
  assert.equal(s.phase, 'tamed', 'three or more: 0.8 s for the whole pull');
  const t = fight(1); t.phase = 'hunt'; t.hp = 1; t.vent = 0; t.rage = 0; hoseBoss(t, rear(t), 2);
  assert.equal(t.phase, 'plug');
  const cap = t.cap;
  step(t, 9.9, { rats: [rat('x', false)] }); assert.equal(t.phase, 'plug');
  const outs = step(t, 0.2, { rats: [] });
  assert.ok(outs.some(o => o.reboot)); assert.equal(t.phase, 'hunt'); assert.equal(t.hp, 1); assert.equal(t.cap, cap + BOSS.REBOOT_CAP);
});

test('the cap: 100 s and it flees home; the win limps into the pond; the Board says so', () => {
  const s = fight(4);
  const outs = step(s, BOSS.CAP + 0.1);
  assert.ok(outs.some(o => o.phase === 'fled')); assert.equal(s.phase, 'fled');
  assert.equal(bossBoard(s), 'MOW-E WINS · REMATCH TOMORROW');
  let home = false; for (let i = 0; i < 1200 && !home; i++) home = stepBoss(s, 0.05).home;
  assert.ok(home); assert.equal(s.out, 'gone');
  s.final = true; assert.equal(bossBoard(s), 'MOW-E WINS · WARRANTY EXPIRED');
  const w = fight(4); w.phase = 'plug'; w.ring = ringOf(w);
  step(w, 3, { rats: [{ id: 'a', ...w.ring, holding: true }] });
  assert.equal(w.phase, 'tamed'); assert.equal(bossBoard(w), 'MOW-E TAMED');
  const sunk = step(w, 60);
  assert.ok(sunk.some(o => o.sunk)); assert.equal(w.sink, 1);
  assert.ok(Math.hypot(w.x - BOSS.POND.x, w.z - BOSS.POND.z) < BOSS.POND.r, 'in the pond');
  const e = newBoss({ encore: true }); step(e, BOSS.WARN + 0.1);
  assert.equal(bossBoard(e), 'MOW-E 2.0 VS SITE 12 · ■■■■■');
  assert.equal(bossBoard(fight(4)), 'MOW-E · ■■■■ · ATE 0');
});

test('a win banks eaten × 2, a gold ball a Rat, the bounty and a commendation; a loss loses them; two losses tame him', () => {
  assert.deepEqual(bossPayout({ eaten: 30, eatenW: 33, n: 4 }), { n: 60, w: 66, gold: 4, bounty: BOSS.BOUNTY });
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
  for (let i = 0; i < 60; i++) { clock.t += 50; crew.tick(0.05); }
  assert.equal(m.phase, 'tamed');
  assert.ok(crew.events.some(e => e.t === 'mower' && e.phase === 'tamed' && e.n === 20));
  assert.ok(crew.cash > cash); assert.equal(crew.commendations, Math.min(10, comm + 1));
  assert.equal([...crew.balls.values()].filter(b => b.kind === 'gold').length >= 1, true, 'a gold ball for the Rat');
  assert.ok(crew.balls.size >= n0 + 1);
  assert.deepEqual(crew.toSave().mowe, { tame: true, lost: 0, encore: false, memo: BOSS_LINES.regards });
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

test('the tame pass: two a shift at 25 % and 60 %, gathers a lane, banks at a return, never knocks anyone down', () => {
  assert.equal(tameDue({ venue: 2, tame: true, shiftT: 104, shiftSecs: 420 }), -1);
  assert.equal(tameDue({ venue: 2, tame: true, shiftT: 105, shiftSecs: 420 }), 0);
  assert.equal(tameDue({ venue: 2, tame: true, shiftT: 253, shiftSecs: 420, k: 1 }), 1);
  assert.equal(tameDue({ venue: 2, tame: true, shiftT: 400, shiftSecs: 420, k: 2 }), -1);
  assert.equal(tameDue({ venue: 2, tame: false, shiftT: 400, shiftSecs: 420 }), -1, 'untamed: no pet');
  assert.equal(tameDue({ venue: 2, tame: true, endless: true, shiftT: 400, shiftSecs: 420 }), -1);
  const lane = MOWER.LANES[1];
  const balls = Array.from({ length: 10 }, (_, i) => ({ id: i, x: -50 + i * 10, z: lane + 1, rest: true, kind: 'range' }));
  const s = newTame(balls);
  assert.equal(s.lane, lane);
  const rat = { id: 'r', x: 0, z: lane };
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
});

test('in a crew: a tamed MOW-E makes its passes and banks helper balls; no boss and no pet on an untamed later venue', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('TAME', { venue: 2, day: 12, venueDay: 3, mowe: { tame: true } }, { shiftSecs: 420, seed: 5, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p); p.x = 30; p.z = 8;
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  for (let i = 0; i < 20; i++) { const b = crew.addBall({ x: -40 + i * 4, y: 0.02, z: MOWER.LANES[0] + 0.5, vx: 0, vy: 0, vz: 0, kind: 'range' }); b.rest = true; }
  crew.shiftT = 105;
  let banked = 0;
  for (let i = 0; i < 120 * 20; i++) { clock.t += 50; crew.tick(0.05); for (const e of crew.events) if (e.t === 'moweBank') banked += e.n; crew.events = []; }
  assert.equal(banked, 20);
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
  s.phase = 'plug'; assert.equal(bossBoard(s), 'MOW-E · PULL THE PLUG');
  assert.equal(moweSnap(null), null);
});

test('every new centre line is 8 words or fewer; the award and the sound helpers', () => {
  const lines = [BOSS_LINES.loose, BOSS_LINES.hunt, BOSS_LINES.plug('Ⓐ'), BOSS_LINES.plug('Space'), BOSS_LINES.stamp, BOSS_LINES.eotm, BOSS_LINES.regards,
    BOSS_LINES.warranty, BOSS_LINES.kept(37), BOSS_LINES.back, BOSS_LINES.prompt('Ⓐ'), PA_LINES.rogue.caption, PA_LINES.rogue2.caption, PA_LINES.pond.caption];
  for (const l of lines) assert.ok(wordCount(l) <= SAY.MAX_WORDS, `${wordCount(l)}: ${l}`);
  assert.equal(PA_LINES.rogue.caption, 'MOW-E updated itself. Please stand back.');
  assert.ok(NIGHT_KEYS.includes('moweHits')); assert.equal(AWARDS[0][0], 'MOW-E Wrangler');
  assert.equal(awardsFor({ A: { banked: 9, moweHits: 3 }, B: { banked: 99 } })[1].award, 'MOW-E Wrangler');
  const near = moweEngineParams(1, 0), far = moweEngineParams(1, 45);
  assert.equal(near.freq, MOWE_ENGINE.F1); assert.equal(moweEngineParams(0).freq, MOWE_ENGINE.F0); assert.equal(moweEngineParams(0.5, 0, true).freq, MOWE_ENGINE.IDLE);
  assert.ok(Math.abs(near.gain - MOWE_ENGINE.GAIN) < 1e-9 && Math.abs(far.gain - MOWE_ENGINE.GAIN / 4) < 1e-9, 'gain 0.03 / (1 + d / 15)');
  assert.deepEqual(['harvest', 'hunt', 'plug'].map(bossTempo), [112, 128, 144]);
});
