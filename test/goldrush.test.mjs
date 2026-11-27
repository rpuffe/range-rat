// Council round 14 #1 (builder 2): the Gold Rush on Muni day 3 and Club day 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { MAP } from '../web/js/map.js';
import { KIND_W } from '../web/js/sim.js';
import { RUSH, rushDay, rushTime, rushSpots, rushN, rushSecs, rushLine, rushRow, rushClaimLine } from '../web/js/goldrush.js';
import { clearSpot } from '../web/js/tourney.js';
import { RETURN } from '../web/js/layout.js';
import { eventCall } from '../scripts/bots/calls.mjs';
import goldrush from '../server/venues/goldrush.mjs';
import { MODULES, checkModule } from '../server/venues/index.mjs';

test('rushDay: Muni day 3 and Club day 2 only; never endless, boss, Gary, Promotion Day or a reveal morning', () => {
  assert.equal(rushDay({ venue: 0, day: 3, venueDay: 3 }), 'muni');
  assert.equal(rushDay({ venue: 1, day: 7, venueDay: 2 }), 'club');
  for (const d of [1, 2, 4, 5]) assert.equal(rushDay({ venue: 0, day: d, venueDay: d }), null, 'Muni day ' + d);
  for (const vd of [1, 3, 4]) assert.equal(rushDay({ venue: 1, day: 6 + vd, venueDay: vd }), null, 'Club day ' + vd);
  for (const v of [2, 3, 4, 5]) assert.equal(rushDay({ venue: v, day: 3, venueDay: 2 }), null);
  for (const k of ['endless', 'promo', 'boss', 'gary', 'reveal']) assert.equal(rushDay({ venue: 0, day: 3, venueDay: 3, [k]: true }), null, k);
  for (const k of ['endless', 'promo', 'boss', 'reveal']) assert.equal(rushDay({ venue: 1, day: 7, venueDay: 2, [k]: true }), null, 'club ' + k);
  assert.equal(rushDay({ venue: 1, day: 7, venueDay: 2, gary: true }), 'club', "Club day 2 is usually Gary's: it runs ahead of him");
});

test('rushTime: 255 / 240 s on a 420 s shift, kept 20 s clear of Last Call and the cleanup; none on a short test shift', () => {
  assert.equal(rushTime('muni', 420), 255);
  assert.equal(rushTime('club', 420), 240);
  assert.equal(rushTime('muni', 420, [270, 300]), 250, 'Last Call at 270: the Muni drop moves 20 s ahead of it');
  assert.equal(rushTime('club', 420, [270, 300]), 240, '30 s clear already');
  assert.equal(rushTime('muni', 90), null);
  assert.equal(rushTime(null, 420), null);
});

test('rushSpots: N and the clock by crew size; on the field, alternating sides; the solo pair within 30 m; the pond ball at the Club at 3P+', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(rushN), [3, 3, 3, 4, 4, 4]);
  assert.deepEqual([1, 2, 4].map(rushSecs), [40, 30, 30]);
  for (const [day, vd, venue] of [[3, 3, 0], [8, 2, 1], [9, 2, 1], [4, 3, 0]]) for (const n of [1, 2, 3, 4, 6]) {
    const s = rushSpots(day, vd, n, venue);
    assert.equal(s.length, rushN(n));
    assert.deepEqual(s, rushSpots(day, vd, n, venue), 'pure: same spots every call');
    const land = s.filter(o => !o.pond), pond = s.filter(o => o.pond);
    assert.equal(pond.length, venue === 1 && n >= 3 ? 1 : 0, `pond ball v${venue} ${n}P`);
    for (const o of land) assert.ok(clearSpot(o.x, o.z), JSON.stringify(o));
    for (const o of pond) assert.ok(Math.hypot(o.x - MAP.POND.x, o.z - MAP.POND.z) <= MAP.POND.r);
    if (n === 1) for (const o of land.slice(1)) assert.ok(Math.hypot(land[0].x - o.x, land[0].z - o.z) <= RUSH.PAIR_1P, 'solo: all near the first');
    else if (land.length >= 2) assert.ok(land[0].x < 0 && land[1].x > 0, 'one each side');
  }
});

test('the Board line and the report row', () => {
  assert.equal(rushLine({ pips: '110', t: 21.2 }), 'GOLD RUSH · ●●○ · 0:22');
  assert.equal(rushLine(null), null);
  assert.deepEqual(rushRow({ n: 4, got: 3, cash: 214.4 }), { text: 'Gold Rush: 3 of 4 · +$214', cash: 214 });
  assert.deepEqual(rushRow({ n: 4, got: 0 }), { text: 'Site 13 took all 4. For research.' });
  assert.equal(rushClaimLine(2), 'Site 13 took 2. For research.');
});

// A seeded crew on a rush day; run(fn) ticks the whole shift, calling fn each tick.
function rushCrew(save, n = 1) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('RUSH', save, { seed: 7, now: () => clock.t });
  const rats = [];
  for (let i = 0; i < n; i++) { const p = crew.join('R' + i); crew.connect(p); rats.push(p); }
  crew.startShift();
  const ev = [];
  const run = (fn = () => {}) => {
    for (let i = 0; i < 430 * 20 && crew.phase === 'shift'; i++) {
      clock.t += 50; crew.tick(0.05);
      for (const e of crew.events) if (e.t === 'rush') ev.push({ ...e, at: crew.shiftT });
      fn(crew, rats);
      crew.events = [];
    }
  };
  return { crew, rats, ev, run };
}

test('in a crew: Muni day 3 drops at T-2:50, Site 13 claims what nobody takes; the call tag; the report row', () => {
  assert.ok(MODULES.includes(goldrush)); checkModule(goldrush);
  const { crew, ev, run } = rushCrew({ day: 3, venue: 0, venueDay: 2 }, 1);
  const st = crew.mods.state('goldrush');
  assert.equal(st.which, 'muni'); assert.equal(st.at, 250);
  run();
  const drop = ev.find(e => e.phase === 'drop');
  assert.ok(drop && Math.abs(drop.at - 250) < 0.1);
  assert.deepEqual(eventCall(drop), ['gold', 3], 'calls.mjs counts one call a ball');
  const claims = ev.filter(e => e.phase === 'claim');
  assert.equal(claims.length, 3);
  for (const c of claims) assert.ok(Math.abs(c.at - 290) < 0.2, 'the 40 s solo clock');
  assert.deepEqual(crew.report.rows?.find(r => /Site 13/.test(r.text)), { text: 'Site 13 took all 3. For research.' });
});

test('in a crew: a Rat takes a rush ball (hands, not the pocket) and banks it at a return as a gold ball; all banked is a clean sweep', () => {
  const { crew, rats, ev, run } = rushCrew({ day: 3, venue: 0, venueDay: 2 }, 1);
  const p = rats[0];
  run(c => {
    const st = c.mods.state('goldrush');
    for (const e of st.balls) {
      const b = c.balls.get(e.id);
      if (e.st === 'out' && b?.rest) { p.x = b.x; p.z = b.z; const pocket = p.pocket; assert.equal(c.pickup(p, b.id), true); assert.equal(p.pocket, pocket, 'not in the pocket'); }
    }
    if (st.held[p.id] > 0 && !st.balls.some(e => e.st === 'out' || e.st === 'air')) { p.x = RETURN.x; p.z = RETURN.z; }
  });
  const banks = ev.filter(e => e.phase === 'bank');
  assert.equal(banks.length, 3);
  assert.ok(ev.some(e => e.phase === 'sweep'), 'Clean sweep. Site 13 is furious.');
  assert.ok(banks.every(b => b.cash > 0));
  const row = crew.report.rows.find(r => r.text.startsWith('Gold Rush'));
  assert.match(row.text, /^Gold Rush: 3 of 3 · \+\$/);
  assert.equal(KIND_W.gold, 10);
});

test('Club day 2 at 4P: four balls, one in the pond, at T-3:00; Muni days 1-2 and Club day 1 never fire', () => {
  const { crew } = rushCrew({ day: 8, venue: 1, venueDay: 1, garyDay: 10, up: { shed: 1 } }, 4);
  assert.equal(crew.venueDay, 2);
  const st = crew.mods.state('goldrush');
  assert.equal(st.which, 'club');
  assert.equal(crew.garyToday(), false); assert.equal(st.at, 240);
  const g = rushCrew({ day: 8, venue: 1, venueDay: 1, garyDay: 8, up: { shed: 1 } }, 4).crew;
  assert.equal(g.garyToday(), true);
  assert.ok(Math.abs(g.mods.state('goldrush').at - (420 * 0.43 - 30 - 5)) < 1e-6, 'a Club Gary day: the wave is done 5 s before his warn');
  assert.equal(rushDay({ venue: 0, day: 3, venueDay: 3, gary: true }), null, 'never a Gary day at the Muni');
  assert.equal(rushSpots(crew.day, crew.venueDay, 4, 1).filter(s => s.pond).length, 1);
  for (const save of [null, { day: 2, venue: 0, venueDay: 1 }, { day: 7, venue: 1, venueDay: 0 }]) {
    const r = rushCrew(save, 2);
    assert.equal(r.crew.mods.state('goldrush').at, null, JSON.stringify(save));
  }
});
