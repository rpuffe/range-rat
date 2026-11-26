// Council round 10 #1: the goal card on the server (server/crew.mjs): Sign is refused until 5/5; each counter ticks
// its goal once; the reward is paid once; the forced treasure; Gary comes back tomorrow; the save v4 -> v5 migration.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SIM, FRIES, GARY } from '../web/js/sim.js';
import { rewardFor } from '../web/js/goals.js';

function makeCrew(save = null, { shiftSecs = 600, seed = 11, names = ['A'] } = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('GOAL', save, { shiftSecs, seed, now: () => clock.t });
  const ps = names.map((n, i) => { const p = crew.join(n); crew.connect(p); p.x = 20 + i; p.z = 5; return p; });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; for (const p of ps) p.seenAt = clock.t; crew.tick(0.05); } };
  return { crew, clock, run, ps };
}
const quiet = crew => { for (const m of crew.mats) m.next = 1e9; };
const goalEvents = crew => crew.flush().ev.filter(e => e.t === 'goal');
const row = (crew, id) => crew.goalRows().find(r => r.id === id);

test('a fresh crew prints the Muni card on its first morning, for the crew online then', () => {
  const { crew } = makeCrew(null, { names: ['A', 'B'] });
  assert.equal(crew.goals, null);
  crew.startShift();
  assert.equal(crew.goals.venue, 0);
  assert.equal(crew.goals.scale, 0.6);
  assert.equal(row(crew, 'bank').need, 1200);
  assert.deepEqual(crew.goalRows().map(r => r.id), ['bank', 'washer', 'huddle', 'reviews', 'fee']);
  const p = crew.join('C'); crew.connect(p);
  crew.phase = 'report'; crew.startShift();
  assert.equal(row(crew, 'bank').need, 1200, 'a late joiner never raises the bar');
  const s = crew.snapshot();
  assert.equal(s.goals.strip.label, '0 OF 5 GOALS');
  assert.equal(s.goals.strip.next, 'NEXT: 1,200 MORE BALLS');
});

test('banking ticks the bank goal; done once, paid its reward once, one event', () => {
  const { crew, ps: [a] } = makeCrew();
  crew.startShift(); quiet(crew); crew.flush();
  crew.goals.n.bank = 795;
  const cash0 = crew.cash, bv = crew.valueNow().bv;
  crew.bank(10, a.id);
  crew.goalScan();
  const ev = goalEvents(crew);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].id, 'bank');
  assert.equal(ev[0].reward, rewardFor(bv, crew.venue, crew.onlineCount()));
  assert.ok(crew.cash >= cash0 + rewardFor(bv, crew.venue, crew.onlineCount()) - 1e-6);
  const cash1 = crew.cash;
  crew.bank(10, a.id); crew.goalScan();
  assert.equal(goalEvents(crew).length, 0, 'no second reward');
  assert.ok(Math.abs(crew.cash - cash1 - 10 * crew.valueNow().bv) < 1, 'only the balls paid');
  assert.ok(crew.goals.done.includes('bank'));
});

test('a hot dog, a TARGET, a lap, a ping and a treasure each tick their goal once', () => {
  for (const [venue, id, e] of [[2, 'targets', { t: 'target' }], [2, 'orders', { t: 'deckTab', order: true }],
    [3, 'pings', { t: 'ping', prize: 'mult' }], [1, 'treasures', { t: 'treasure', phase: 'banked' }]]) {
    const { crew } = makeCrew({ venue, venueDay: 0, day: 10, up: { shed: 1 } });
    crew.startShift(); quiet(crew); crew.flush();
    crew.events.push({ ...e });
    crew.goalScan(); crew.goalScan();
    assert.equal(crew.goals.n[id], 1, id);
  }
  const { crew } = makeCrew({ venue: 1, venueDay: 0, day: 10, up: { shed: 1 } });
  crew.startShift(); crew.flush();
  // Playthrough 5 B5: the Club's FED goal counts working seconds with FED up, not dogs served.
  crew.events.push({ t: 'served', item: 'hotdog', quality: 'good' });
  crew.goalScan();
  assert.equal(crew.goals.n.fed ?? 0, 0, 'a dog served is not a count');
  crew.fedSt.fed = 1.5;
  for (let i = 0; i < 51; i++) crew.tick(0.1);
  assert.equal(crew.goals.n.fed, 5, 'five working seconds fed');
  // C2: an autopilot lap is not a driven lap
  const s = makeCrew({ venue: 3, venueDay: 0, day: 10 }).crew;
  s.startShift(); s.flush();
  s.events.push({ t: 'crowd', kind: 'lap', auto: true }); s.goalScan();
  assert.equal(s.goals.n.laps ?? 0, 0, 'autopilot laps do not count');
});

test('Sign is refused until the card is 5/5', () => {
  const { crew, ps: [a] } = makeCrew({ day: 6, venue: 0, venueDay: 3 }, { shiftSecs: 5 });
  crew.startShift(); quiet(crew);
  crew.goals.n.bank = 9999; crew.goals.n.reviews = 2; crew.cash = 1e6; crew.up.washer = 1;
  crew.phase = 'report';
  assert.equal(crew.promoInfo().ready, false, 'Gary is still open');
  assert.equal(crew.sign(a, true), false);
  crew.goals.n.huddle = 1; crew.goalCheck();
  assert.equal(crew.promoInfo().ready, true);
  assert.equal(crew.promoInfo().done, 5);
  crew.cash = 10;
  assert.equal(crew.promoInfo().ready, false, 'the fee is live');
  crew.cash = 1e6;
  assert.equal(crew.sign(a, true), true);
  assert.equal(crew.venue, 1, 'promoted');
  assert.equal(crew.goals, null, 'the Club card prints on its first morning');
  crew.startShift();
  assert.equal(crew.goals.venue, 1);
});

test('the forced treasure sinks every morning while the treasure goal is open', () => {
  const { crew } = makeCrew({ venue: 1, venueDay: 1, day: 8, up: { shed: 1 } }, { seed: 3 });   // round 11: from Club day 2 (the pond fills)
  for (let d = 0; d < 6; d++) {
    crew.phase = d ? 'report' : crew.phase; crew.treasure = null;
    crew.startShift();
    assert.ok(crew.treasure, 'day ' + d);
  }
  crew.goals.n.treasures = 2; crew.goalCheck();
  let missed = 0;
  for (let d = 0; d < 12; d++) { crew.phase = 'report'; crew.treasure = null; crew.startShift(); if (!crew.treasure) missed++; }
  assert.ok(missed > 0, 'the 50% roll is back once the goal is done');
});

test('Gary returns the next day after a visit that leaves a Gary goal open', () => {
  const { crew, run } = makeCrew({ venue: 1, venueDay: 1, day: 8, up: { shed: 1 }, garyDay: 8 }, { shiftSecs: 300 });
  crew.startShift(); quiet(crew);
  assert.equal(crew.garyDay, 8);
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 1;   // a filthy range: he fails it
  run(400);
  assert.equal(crew.phase, 'report');
  assert.equal(crew.garyDay, 9, 'back tomorrow');
  assert.equal(crew.report.tomorrow, 'Gary will be back tomorrow.');
});

test('a v4 save with 3 stamps is grandfathered; the save is v5 and round-trips', () => {
  const { crew, ps: [a] } = makeCrew({ day: 6, venue: 1, venueDay: 4, stamps: 3, cash: 1e6, up: { shed: 1 } }, { shiftSecs: 5 });
  crew.startShift(); quiet(crew);
  assert.equal(crew.reviews, 3);
  assert.equal(crew.goalRows().every(r => r.done), true);
  crew.phase = 'report';
  assert.equal(crew.promoInfo().ready, true);
  const save = crew.toSave();
  assert.equal(save.v, 5);
  assert.equal(save.reviews, 3);
  assert.equal(save.stamps, undefined);
  const back = new Crew('GOAL', JSON.parse(JSON.stringify(save)), { seed: 1 });
  assert.deepEqual(back.goals.done, crew.goals.done);
  const one = makeCrew({ day: 6, venue: 0, venueDay: 4, stamps: 1, up: { washer: 2 } }).crew;
  one.startShift();
  assert.equal(row(one, 'reviews').have, 1);
  assert.equal(row(one, 'washer').done, true);
  assert.equal(row(one, 'bank').have, 0);
  void a;
});

test('the tomorrow line counts the goals left', () => {
  const { crew, run } = makeCrew({ day: 12, venue: 1, venueDay: 1, up: { shed: 1 }, garyDay: 99 }, { shiftSecs: 5 });
  crew.startShift(); quiet(crew);
  run(6);
  assert.equal(crew.phase, 'report');
  assert.match(crew.report.tomorrow, /^Tomorrow: (five|four) goals left for Tiered\.$/);
  void SIM; void FRIES; void GARY;
});
