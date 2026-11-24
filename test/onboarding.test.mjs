// The first-night ramp (owner playtest, 2026-11-24): the shop grows by day, the kitchen waits for
// the Range Club, a teenager arrives on day 2, and day 1 has a shared checklist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SHOP, SHOP_BY_ID, nextPrice, shopShows, shopDay, SIM } from '../web/js/sim.js';

function makeCrew(save = null) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('ONBD', save, { shiftSecs: 240, seed: 3, now: () => clock.t });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
const rows = (venue, day) => SHOP.filter(i => shopShows(i, venue, day)).map(i => i.id);

test('day 1 at the Muni shows only gear, the teenagers, shoes and hard hats', () => {
  assert.deepEqual(rows(0, 1), ['gear', 'helpers', 'shoes', 'hardhat']);
});
test('the washer and ads join on day 2, the cart on day 3', () => {
  assert.deepEqual(rows(0, 2), ['gear', 'helpers', 'washer', 'ads', 'shoes', 'hardhat']);
  assert.ok(rows(0, 3).includes('cart'));
  assert.ok(!rows(0, 9).includes('shed'), 'no kitchen at the Muni, ever');
});
test('the snack shed (the kitchen) opens at the Range Club, with every Muni row', () => {
  const club = rows(1, 1);
  for (const id of ['gear', 'cart', 'shed', 'helpers', 'washer', 'ads', 'shoes', 'hardhat']) assert.ok(club.includes(id), id);
  assert.equal(nextPrice('shed', {}, 1, 0, 0), null);
  assert.equal(nextPrice('shed', {}, 1, 0, 1), SHOP_BY_ID.shed.tiers[1].cost);
});
test('overnight, the shop shops for tomorrow', () => {
  assert.equal(shopDay('report', 1), 2);
  assert.equal(shopDay('shift', 1), 1);
  assert.equal(shopDay('lobby', 1), 1);
});

test('the server refuses a row that is not open yet, and sells it overnight', () => {
  const { crew } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  crew.startShift(); crew.cash = 1000;
  crew.buy(a, 'washer');
  assert.equal(crew.up.washer ?? 0, 0, 'no washer on day 1');
  crew.buy(a, 'shed');
  assert.equal(crew.up.shed ?? 0, 0, 'no kitchen at the Muni');
  crew.phase = 'report';                                 // the overnight shop sells for day 2
  crew.buy(a, 'washer');
  assert.equal(crew.up.washer, 1);
});

test('day 2: Corporate sends a teenager, once', () => {
  const { crew } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  crew.startShift();
  assert.equal(crew.helpers.length, 0, 'day 1 is just the crew');
  crew.endShift(); crew.flush();
  crew.startShift();
  assert.equal(crew.day, 2);
  assert.equal(crew.up.helpers, 1);
  assert.equal(crew.helpers.length, 1);
  assert.ok(crew.flush().ev.some(e => e.t === 'freehelper'));
  crew.endShift(); crew.startShift();
  assert.equal(crew.up.helpers, 1, 'only on day 2');
});
test('a crew that already hired one gets a second teenager on day 2', () => {
  const { crew } = makeCrew({ day: 2, up: { helpers: 1 } });
  crew.startShift();
  assert.equal(crew.up.helpers, 2);
});

test('the day 1 checklist ticks off for the whole crew, then goes away', () => {
  const { crew, run } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  crew.startShift();
  let todo = crew.snapshot().todo;
  assert.deepEqual(todo.map(t => t.id), ['pick', 'bank', 'sign', 'buy']);
  assert.ok(todo.every(t => !t.done));
  crew.stats.picked = 5; crew.stats.deposited = 3;
  crew.fixtures.sign = 0;
  crew.cash = 100; crew.buy(a, 'shoes');
  todo = crew.snapshot().todo;
  assert.ok(todo.every(t => t.done), JSON.stringify(todo));
  assert.equal(todo[0].n, 1, 'capped at the goal'); assert.equal(todo[1].n, 3);
  crew.endShift(); crew.startShift();
  assert.equal(crew.snapshot().todo, null, 'day 2 has no checklist');
  run(1);
});
test('no checklist after the Muni or in a promoted crew', () => {
  const { crew } = makeCrew({ venue: 1, day: 1, venueDay: 0 });
  crew.startShift();
  assert.equal(crew.snapshot().todo, null);
});

test('day 1 skips the memo card (quiet) but keeps the PA welcome; later memos are one line plus flavor', () => {
  const { crew } = makeCrew();
  crew.join('A');
  crew.startShift();
  const ev = crew.flush().ev;
  const memo = ev.find(e => e.t === 'memo');
  assert.equal(memo.quiet, true);
  assert.ok(ev.some(e => e.t === 'pa' && e.id === 'welcome'));
  crew.endShift(); crew.flush(); crew.startShift();
  const m2 = crew.flush().ev.find(e => e.t === 'memo');
  assert.equal(m2.quiet, false);
  assert.ok(m2.text.split(' ').length <= 9, m2.text);
  assert.match(m2.flavor, /teenager/);
});

test('playtest: an unfinished day-1 checklist carries into day 2 (and not beyond); day-1 mats start clean', () => {
  const { crew } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  crew.startShift();
  assert.ok(Object.keys(crew.fixtures).filter(k => k.startsWith('mat')).every(k => crew.fixtures[k] === 0), 'no mat refusals while training');
  crew.stats.picked = 1; crew.stats.deposited = 3; crew.snapshot();
  crew.endShift(); crew.flush(); crew.startShift();
  const todo = crew.snapshot().todo;
  assert.ok(todo, 'day 2 keeps the unfinished checklist');
  assert.deepEqual(todo.filter(t => t.done).map(t => t.id), ['pick', 'bank'], 'the banked steps stay done');
  const memo = crew.flush().ev.find(e => e.t === 'memo');
  assert.equal(memo.quiet, false, 'day 2 still gets its memo');
  crew.endShift(); crew.startShift();
  assert.equal(crew.snapshot().todo, null, 'gone on day 3');
});

test('playtest: Gary does not run over the huddle on his way to the stand', () => {
  const { crew } = makeCrew({ day: 4 });
  const a = crew.join('A'); crew.connect(a);
  crew.startShift();
  crew.gary = { phase: 'drive', pause: 0, stop: 0, x: 26, z: 14, yaw: 0, fails: 0, checks: [] };
  crew.garyStops = () => [{ id: 'stand', x: 26, z: 10 }];
  a.x = 26; a.z = 13.6; a.down = 0;
  crew.stepGary(0.1);
  assert.equal(a.down, 0);
});

// ---- council round 6 #10: day-2 suggestions -------------------------------------------------------------------------
import { NUDGE, NUDGE_TEXT, nudgePool, dealNudge, nudgeTarget } from '../web/js/nudge.js';
const nudges = crew => crew.snapshot().mods?.nudge ?? {};
function day2(n, save = {}) {
  const { crew, run, clock } = makeCrew({ day: 2, ...save });
  const rats = Array.from({ length: n }, (_, i) => { const p = crew.join('R' + i); crew.connect(p); return p; });
  crew.startShift();
  return { crew, run, clock, rats };
}

test('day 2: 4 Rats get 4 different nudges; a 5th repeats from the top', () => {
  const { crew, rats } = day2(5);
  const got = rats.map(p => nudges(crew)[p.id]);
  assert.deepEqual(got, ['hose', 'far', 'stand', 'shop', 'hose']);
  assert.equal(new Set(got.slice(0, 4)).size, 4);
  for (const id of got) assert.ok(NUDGE_TEXT[id].split(' ').length <= 8, NUDGE_TEXT[id]);
});
test('the washer nudge depends on up.washer', () => {
  assert.deepEqual(nudgePool({}), ['hose', 'far', 'stand', 'shop']);
  assert.deepEqual(nudgePool({ washer: 1 }), ['hose', 'far', 'stand', 'washer']);
  assert.equal(dealNudge(3, { washer: 2 }), 'washer');
  const { crew, rats } = day2(4, { up: { washer: 1 } });
  assert.equal(nudges(crew)[rats[3].id], 'washer');
  assert.equal(nudgeTarget('shop'), null, 'the shop is a menu: no arrow');
  assert.ok(nudgeTarget('washer') && nudgeTarget('far') && nudgeTarget('stand') && nudgeTarget('hose', true));
});
test('no nudges on day 1, day 3, at the Club, or in endless', () => {
  for (const save of [{ day: 1 }, { day: 3 }, { day: 2, venue: 1, venueDay: 2 }]) {
    const { crew } = makeCrew(save);
    const p = crew.join('A'); crew.connect(p); crew.startShift();
    assert.deepEqual(nudges(crew), {}, JSON.stringify(save));
  }
});
test('a late joiner on day 2 gets the next one in the pool', () => {
  const { crew, run } = day2(2);
  run(1);
  const late = crew.join('Late'); crew.connect(late);
  run(0.2);
  assert.equal(nudges(crew)[late.id], 'stand');
});
test('doing it clears the line; otherwise it goes after 45 s of working time', () => {
  const { crew, run, rats } = day2(3);
  const [hoser, far, stander] = rats;
  run(1);
  stander.pocket = 2; stander.pocketW = 2; stander.x = SIM.STAND.x; stander.z = SIM.STAND.z; crew.deposit(stander);
  run(0.1);
  assert.equal(nudges(crew)[stander.id], undefined, 'banked: done');
  far.x = 26; far.z = -76; far.pocket = 1; run(0.1);
  assert.equal(nudges(crew)[far.id], undefined, 'in the far field with a ball: done');
  assert.equal(nudges(crew)[hoser.id], 'hose');
  run(NUDGE.WAIT + NUDGE.SECS);
  assert.deepEqual(nudges(crew), {}, '45 s: gone');
});
test('the unfinished day-1 checklist keeps precedence: no nudge while it is up', () => {
  const { crew } = makeCrew();
  const a = crew.join('A'); crew.connect(a);
  crew.startShift(); crew.stats.picked = 1; crew.snapshot();
  crew.endShift(); crew.flush(); crew.startShift();
  assert.equal(crew.day, 2); assert.ok(crew.snapshot().todo);
  assert.deepEqual(nudges(crew), {}, 'the checklist first');
  crew.todo = { pick: true, bank: true, sign: true, buy: true };
  crew.tick(0.05);
  assert.equal(nudges(crew)[a.id], 'hose', 'dealt once the checklist is done');
});
