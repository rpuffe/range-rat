// Council round 13 #1 (builder 2): the Members' Tournament, the Club's back-half peak. design/round15-club.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIM } from '../web/js/sim.js';
import { CLUB_DAY } from '../web/js/clubdays.js';
import { creekProject, inPondArea, MAP } from '../web/js/map.js';
import { TOURNEY, tourneyDay, flightTimes, flightN, pondBall, memberSpots, clearSpot, dropShot, tourneyLine, flightAlert,
  FLIGHT_ALERT, BONUS_ALERT, CLEAN_LINE, CLAIM_LINE, TOURNEY_MEMO, carryLine } from '../web/js/tourney.js';
import { wordCount } from '../web/js/say.js';
import { Crew } from '../server/crew.mjs';
import { MODULES } from '../server/venues/index.mjs';

function clubCrew({ n = 2, venueDay = 3, extra = {}, seed = 7 } = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('TOUR', { venue: 1, day: 12, venueDay, up: { shed: 1, cart: 1, gear: 3 }, mowe: { tame: true }, ...extra }, { seed, now: () => clock.t });
  const rats = Array.from({ length: n }, (_, i) => { const p = crew.join('R' + i); crew.connect(p); p.x = 20 + i * 2; p.z = 6; return p; });
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;   // no customers: only the members hit
  const ev = [];
  const run = (secs, each) => {
    for (let i = 0; i < secs * 20 && crew.phase === 'shift'; i++) {
      clock.t += 50; for (const p of rats) { p.seenAt = clock.t; p.movedAt = clock.t; }
      crew.tick(0.05); ev.push(...crew.events); crew.events = []; each?.();
    }
  };
  return { crew, rats, run, ev, st: () => crew.mods.state('tourney') };
}
const T = (ev, phase) => ev.filter(e => e.t === 'tourney' && e.phase === phase);

test('the Tournament is wired: CLUB_DAY.tourney 4, the module is in the production list', () => {
  assert.equal(CLUB_DAY.tourney, 4); assert.equal(TOURNEY.DAY, 4);
  assert.ok(MODULES.some(m => m.id === 'tourney' && m.venue === 1));
  assert.equal(TOURNEY.BANK_R, SIM.STAND_REACH, 'a return banks at the stand reach');
});

test('tourneyDay: Club day 4 on; never a boss day, Promotion Day, endless, or another venue', () => {
  assert.equal(tourneyDay({ venue: 1, venueDay: 3 }), false);
  assert.equal(tourneyDay({ venue: 1, venueDay: 4 }), true);
  assert.equal(tourneyDay({ venue: 1, venueDay: 9 }), true);
  assert.equal(tourneyDay({ venue: 1, venueDay: 5, boss: true }), false, 'a rematch keeps the day');
  assert.equal(tourneyDay({ venue: 1, venueDay: 5, promo: true }), false);
  assert.equal(tourneyDay({ venue: 1, venueDay: 5, endless: true }), false);
  assert.equal(tourneyDay({ venue: 2, venueDay: 5 }), false);
});

test('flightTimes: T-5:00 and T-2:30, the second dodging the Last Call deal by 20 s', () => {
  assert.deepEqual(flightTimes(420, []), [120, 270]);
  assert.deepEqual(flightTimes(420, [270, 300]), [120, 250], 'Last Call rings at 270: the flight goes 20 s early');
  assert.deepEqual(flightTimes(420, [125]), [105, 270], 'clear of a deal at 125: early');
  assert.deepEqual(flightTimes(420, [125, 100]), [145, 270], 'early would clash: late instead');
  const [a, b] = flightTimes(420, [270, 300]);
  for (const d of [270, 300]) { assert.ok(Math.abs(a - d) >= 20); assert.ok(Math.abs(b - d) >= 20); }
});

test('N by crew size, and the pond ball from 3P', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(flightN), [2, 2, 3, 3, 4, 4]);
  assert.deepEqual([1, 2, 3, 4].map(pondBall), [false, false, true, true]);
});

test('memberSpots: one each side of centre, one in the pond at 3P+, clear of the creek, pure (no RNG)', () => {
  for (let day = 10; day < 40; day++) for (const vday of [4, 5, 6]) for (const f of [0, 1, 2]) for (const n of [1, 2, 3, 4]) {
    const s = memberSpots(day, vday, f, n);
    assert.equal(s.length, flightN(n));
    const land = s.filter(o => !o.pond);
    assert.ok(land.some(o => o.x < 0) && land.some(o => o.x > 0), `both sides d${day} v${vday} f${f} n${n}`);
    assert.equal(s.filter(o => o.pond).length, n >= 3 ? 1 : 0);
    for (const o of land) {
      assert.ok(o.z <= -TOURNEY.NEAR + 1e-6 && o.z >= -TOURNEY.FAR - 1e-6 || [-100, -64, -150, -140].includes(o.z), `60-140 m out: ${o.z}`);
      assert.ok(creekProject(o.x, o.z).d >= TOURNEY.CREEK_PAD - 1e-6, 'off the creek');
      assert.ok(!inPondArea(o.x, o.z, 1));
    }
    for (const o of s.filter(q => q.pond)) assert.ok(inPondArea(o.x, o.z, -2), 'in the pond');
    assert.deepEqual(memberSpots(day, vday, f, n), s, 'the same spots every time');
  }
  assert.ok(clearSpot(-30, -100) && !clearSpot(MAP.POND.x, MAP.POND.z));
});

test('the drop comes to rest on its spot (a crew run, no customers)', () => {
  const { crew, run, ev } = clubCrew({ n: 4 });
  run(125);
  const fl = T(ev, 'flight')[0];
  assert.ok(fl, 'flight 1 by 125 s');
  const st = crew.mods.state('tourney');
  for (const e of st.balls) {
    const b = crew.balls.get(e.id); const spot = fl.spots[e.j];
    if (spot.pond) { assert.ok(b.sunk, 'the pond ball sank'); continue; }
    assert.ok(b.rest && Math.hypot(b.x - spot.x, b.z - spot.z) < 2.5, `rests near its spot ${b.x},${b.z} vs ${spot.x},${spot.z}`);
    assert.equal(b.hands, true, 'Rats only: no machine, helper or mower takes it');
  }
  void dropShot;
});

test('no flight before Club day 4, on a boss day, or on Promotion Day; the Club days 1-3 stream is untouched', () => {
  for (const [label, o] of [['day 3', { venueDay: 2 }], ['boss', { venueDay: 4, extra: { mowe: { tame: false } } }], ['promo', { venueDay: 4, extra: { promoDay: 12 } }]]) {
    const { crew, run, ev } = clubCrew(o);
    run(300);
    assert.equal(T(ev, 'flight').length, 0, label);
    assert.equal(crew.mods.state('tourney').on, false, label);
  }
});

test('two flights at 120 / 250 s; each ball claimed by the caddie cart at 30 s', () => {
  const { crew, run, ev } = clubCrew({ n: 2 });
  run(119.9); assert.equal(T(ev, 'flight').length, 0);
  run(0.2); assert.equal(T(ev, 'flight').length, 1);
  assert.equal(T(ev, 'flight')[0].n, 2);
  run(29.5); assert.equal(T(ev, 'claim').length, 0, 'still on the clock at 29.6 s');
  run(1); assert.equal(T(ev, 'claim').length, 2, 'claimed at 30 s');
  assert.ok(ev.some(e => e.t === 'gone' && e.by === 'caddie'));
  run(130); assert.equal(T(ev, 'flight').length, 2);
  assert.equal(crew.stats.memberClaimed, 4);
});

test('a member ball banked at the return pays ×PAY (45) Ball Value; a clean flight fires once', () => {
  const { crew, rats, run, ev, st } = clubCrew({ n: 2 });
  run(124);
  const one = crew.balls.get(st().balls[0].id), two = crew.balls.get(st().balls[1].id);
  const [a, b] = rats;
  Object.assign(a, { x: one.x, z: one.z }); Object.assign(b, { x: two.x, z: two.z });
  assert.ok(crew.pickup(a, one.id) && crew.pickup(b, two.id));
  assert.equal(a.pocket, 0, 'in hands, not the pocket');
  assert.deepEqual(crew.mods.snapshot().tourney.held, { [a.id]: 1, [b.id]: 1 });
  run(40); assert.equal(T(ev, 'claim').length, 0, 'held balls are safe from the caddie');
  // A plain ball's price, for the ratio.
  crew.bank(1, a.id, null, 1); const plain = ev.length; run(0.05);
  const unit = crew.events.concat(ev).filter(e => e.t === 'cash').at(-1); void plain;
  Object.assign(a, { x: SIM.STAND.x, z: SIM.STAND.z }); run(0.1);
  const pay = ev.filter(e => e.t === 'cash' && e.member);
  assert.equal(pay.length, 1);
  assert.ok(Math.abs((pay[0].cash + pay[0].credit) / (unit.cash + unit.credit) - TOURNEY.PAY) < 0.01, 'x PAY'); assert.equal(TOURNEY.PAY, 45);
  assert.equal(T(ev, 'clean').length, 0, 'one of two: not clean yet');
  Object.assign(b, { x: SIM.STAND.x, z: SIM.STAND.z }); run(0.1);
  assert.equal(T(ev, 'clean').length, 1);
  run(5); assert.equal(T(ev, 'clean').length, 1, 'once');
  assert.equal(crew.stats.memberBanked, 2); assert.equal(crew.stats.cleanFlights, 1);
});

test('a knocked-down carrier drops the member ball back on the clock', () => {
  const { crew, rats, run, st } = clubCrew({ n: 2 });
  run(124);
  const e = st().balls[0], b = crew.balls.get(e.id), [a] = rats;
  Object.assign(a, { x: b.x, z: b.z }); crew.pickup(a, b.id);
  crew.knockDown(a, 'test');
  assert.equal(e.st, 'air'); assert.ok(e.left >= TOURNEY.DROPPED_SECS);
  assert.equal(crew.balls.get(e.id)?.kind, 'member');
  run(2); assert.equal(crew.balls.get(e.id).hands, true);
});

test('MOW-E fetching a member ball (the aimed whistle signal) banks it', () => {
  const { crew, run, ev, st } = clubCrew({ n: 2 });
  run(124);
  crew.mods.signal('member', { id: st().balls[0].id });
  assert.equal(ev.concat(crew.events).filter(e => e.t === 'cash' && e.member).length, 1);
  assert.equal(st().balls[0].st, 'banked');
});

test('the Board line, the ALERTs, the memo and the feed lines are ≤ 8 words', () => {
  assert.equal(tourneyLine({ flight: { pips: '110', t: 21.3 } }), "MEMBERS' TOURNAMENT · ●●○ · 0:22");
  assert.equal(tourneyLine({}), null);
  assert.equal(flightAlert(0), FLIGHT_ALERT[0]); assert.equal(flightAlert(1), FLIGHT_ALERT[1]); assert.equal(flightAlert(0, true), BONUS_ALERT);
  for (const s of [...FLIGHT_ALERT, BONUS_ALERT, CLEAN_LINE, CLAIM_LINE, TOURNEY_MEMO, carryLine(1), carryLine(3)]) assert.ok(wordCount(s) <= 8, s);
});

test('the first Tournament morning puts the memo note in the slot, once', () => {
  const { crew } = clubCrew({ venueDay: 3 });
  assert.equal(crew.mods.state('tourney').seen, true);
  assert.deepEqual(crew.mods.toSave().tourney, { seen: 1 });
});
