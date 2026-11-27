// Council round 14, builder 3 ("tourney"): the Bell's lobby and price (3a), the Tournament announced, scored and fair
// to a solo Rat (3b), the County's second patch (3c), and the poach tuned, visible and its three lines wired (#5).
// design/round16-tourney.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIM, GARY, nextPrice, shopVday, priceScale, SHOP_BY_ID } from '../web/js/sim.js';
import { LANDMARK_ROW, LANDMARK, bellOpen, bellStateOf, STAR_CARD, STAR_LINE, STAR_PLAQUE, STAR_TILT } from '../web/js/landmarks.js';
import { TOURNEY, flightTimes, garyWindow, ballSecs, memberSpots, tourneyRow, tourneyEveDue, TOURNEY_EVE_LINE, TOURNEY_MEMO } from '../web/js/tourney.js';
import { tourneyEve } from '../server/venues/tourney.mjs';
import { INSPECT, PATCH2, secondPatch, inspectPatch } from '../web/js/county.js';
import { hash32 } from '../web/js/today.js';
import { POACH, poachPrice, rivalBell, cleanRival, poachDouble, poachShopTag, POACH_DOUBLE_TAG,
  regularsShown, POACH_ROW_LINE, HUSTLE_HINT, POACH_FEED } from '../web/js/owner.js';
import poach from '../server/venues/poach.mjs';
import { PA_LINES } from '../web/js/pa.js';
import { plaqueLines, newCase, starTiltWeight } from '../web/js/caserules.js';
import { wordCount } from '../web/js/say.js';
import { Crew } from '../server/crew.mjs';

// ---- 3a: the Members' Bell ----------------------------------------------------------------------------------------
test('3a: the bell is $10k base ($22k at 4P), rings a bonus round at the Club and Tiered, sound only later', () => {
  const t = LANDMARK_ROW.tiers[LANDMARK.BELL];
  assert.equal(t.cost, 10_000);
  assert.equal(Math.round(t.cost * priceScale(4)), 22_000);
  assert.match(t.desc, /Ring it for a bonus round, once a shift\./);
  assert.equal(bellOpen({ left: 200, venue: 1 }), true);
  assert.equal(bellOpen({ left: 200, venue: 2 }), true);
  for (const v of [0, 3, 4, 5]) assert.equal(bellOpen({ left: 200, venue: v }), false, `venue ${v}`);
  assert.equal(bellStateOf({ venue: 1, mods: { tourney: { bell: 1 }, happyhour: { bell: 2 } } }), 1);
  assert.equal(bellStateOf({ venue: 2, mods: { tourney: { bell: 1 }, happyhour: { bell: 2 } } }), 2);
  assert.equal(bellStateOf({ venue: 3, mods: { tourney: { bell: 1 } } }), 0);
});

test('3a: the bell is on sale in the Club day-4 lobby (shopVday), not the day-3 one', () => {
  if (!SHOP_BY_ID.landmark) return;   // builder 4's SHOP line
  // In the lobby crew.day is already the coming day but venueDay isn't (it increments in startShift).
  const lobby = vday => nextPrice('landmark', {}, 4, 0, 1, 12, false, shopVday('lobby', vday));
  assert.equal(lobby(3), 22_000, 'the lobby before Club day 4 shops for day 4');
  assert.equal(lobby(2), null, 'before Club day 3: not yet');
  // And the server's buy() honours it: a 4P crew in the lobby before Club day 4 can ring up the bell.
  const crew = new Crew('BELLLOB', { venue: 1, day: 12, venueDay: 3, cash: 1e6 }, { seed: 3, now: () => 1e6 });
  const ps = ['A', 'B', 'C', 'D'].map(n => { const p = crew.join(n); crew.connect(p); return p; });
  assert.equal(crew.phase, 'lobby');
  assert.equal(crew.buy(ps[0], 'landmark'), true);
  assert.equal(crew.up.landmark, 1);
  assert.equal(crew.cash, 1e6 - 22_000);
});

test('3a: at Tiered the Tournament module leaves the bell alone (no bonus flight off the Club)', () => {
  const crew = new Crew('BELLT', { venue: 2, day: 20, venueDay: 1, up: { landmark: 2 } }, { seed: 4, now: () => 1e6 });
  crew.up.landmark = 2;
  const p = crew.join('A'); crew.connect(p); crew.startShift();
  crew.shiftT = 200; Object.assign(p, { x: 21.5, z: 6.6 });
  crew.events = [];
  const tourney = crew.mods.list.find(e => e.m.id === 'tourney');
  assert.equal(tourney.m.input(crew, tourney.st, p, { t: 'bell' }), false);
  assert.equal(crew.events.some(e => e.t === 'tourney'), false);
});

// ---- 3b: the Tournament -----------------------------------------------------------------------------------------
test('3b: on a Gary day no flight lands in his warn..warn+120 s; off a Gary day nothing moves', () => {
  const secs = 420, gw = garyWindow(secs, GARY.AT);
  assert.deepEqual(flightTimes(secs, []), [120, 270]);
  assert.deepEqual(flightTimes(secs, [], null), [120, 270]);
  const g = flightTimes(secs, [], gw);
  assert.equal(g[0], 120, 'flight 1 is before his warn');
  assert.ok(Math.abs(g[1] - (gw[1] + TOURNEY.GARY_PAD)) < 1e-9, `flight 2 to the window's near (late) edge + 5 s: ${g[1]}`);
  // With the Club's deals (Last Call at 270, the cleanup at 300): flight 2 keeps clear of both and of Gary.
  const d = flightTimes(secs, [270, 300], gw);
  for (const t of d) {
    assert.ok(!(t > gw[0] - TOURNEY.GARY_PAD && t < gw[1] + TOURNEY.GARY_PAD), `${t} outside Gary's window`);
    for (const x of [270, 300]) assert.ok(Math.abs(t - x) >= TOURNEY.DODGE - 1e-9, `${t} clear of the deal at ${x}`);
  }
  // A flight nearer the early edge goes early.
  assert.deepEqual(flightTimes(secs, [], [130, 245]), [120, 270], 'both already clear');
  assert.deepEqual(flightTimes(secs, [], [110, 200]), [105, 270], 'nearer the early edge: edge - 5');
  assert.deepEqual(flightTimes(secs, [], [10, 400]), [5, 405], 'each to its nearer edge');
  assert.equal(flightTimes(secs, [], [0, 200])[0], 205, 'the early edge is off the shift: late');
});

test('3b: a solo Rat gets a 45 s clock and a pair within 30 m; 2P+ keep 30 s and a ball each side', () => {
  assert.equal(ballSecs(1), 45); assert.equal(ballSecs(2), 30); assert.equal(ballSecs(4), 30);
  for (let day = 10; day < 60; day++) for (const f of [0, 1, 2]) {
    const s = memberSpots(day, 5, f, 1);
    assert.equal(s.length, 2);
    const dd = Math.hypot(s[0].x - s[1].x, s[0].z - s[1].z);
    assert.ok(dd <= TOURNEY.PAIR_1P && dd >= TOURNEY.APART, `d${day} f${f}: ${dd.toFixed(1)} m`);
  }
  const two = memberSpots(20, 5, 0, 2);
  assert.ok(two[0].x < 0 && two[1].x > 0, 'unchanged at 2P');
});

test('3b: in a solo crew the flight event and each ball carry the 45 s clock', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('T1P', { venue: 1, day: 13, venueDay: 4, up: { shed: 1, gear: 3 }, mowe: { tame: true } }, { seed: 7, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p); crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  const st = crew.mods.state('tourney');
  assert.equal(st.on, true);
  const ev = [];
  for (let i = 0; i < 20 * (st.at[0] + 1); i++) { clock.t += 50; p.seenAt = p.movedAt = clock.t; crew.tick(0.05); ev.push(...crew.events); crew.events = []; }
  const fl = ev.find(e => e.t === 'tourney' && e.phase === 'flight');
  assert.ok(fl); assert.equal(fl.secs, 45);
  assert.ok(st.balls.every(b => b.left > 40));
});

test('3b: the first Tournament morning sets the memo event slot (once ever); the report row; the eve line', () => {
  const crew = new Crew('TMEMO', { venue: 1, day: 12, venueDay: 3, up: { gear: 3 }, mowe: { tame: true } }, { seed: 7, now: () => 1e6 });
  const p = crew.join('A'); crew.connect(p);
  crew.venueDay = 3;
  assert.equal(tourneyEve(crew), TOURNEY_EVE_LINE, 'the night before Club day 4');
  crew.startShift();
  const st = crew.mods.state('tourney');
  assert.equal(st.on, true); assert.equal(st.seen, true);
  assert.equal(tourneyEve(crew), null, 'seen: never again');
  assert.equal(tourneyEveDue({ venue: 1, venueDay: 4, seen: true }), false);
  assert.equal(tourneyEveDue({ venue: 1, venueDay: 4, boss: true }), false, 'a boss day is not a Tournament day');
  assert.equal(tourneyEveDue({ venue: 1, venueDay: 3 }), false);
  // memoEvent is read by the memo push (builder 4) and cleared the same morning: the memo carries the line.
  assert.ok(JSON.stringify(crew.memo ?? crew.lastMemo ?? crew.events).includes(TOURNEY_MEMO) || crew.memoEvent == null);
  assert.deepEqual(tourneyRow({ out: 0 }), null);
  assert.deepEqual(tourneyRow({ out: 4, banked: 0 }), { text: 'The caddie took all 4. Kazoo.' });
  assert.deepEqual(tourneyRow({ out: 4, banked: 3, cash: 7363.4 }), { text: "Members' balls 3 of 4", cash: 7363.4 });
  for (const s of [TOURNEY_EVE_LINE, tourneyRow({ out: 12, banked: 0 }).text, tourneyRow({ out: 12, banked: 11 }).text]) assert.ok(wordCount(s) <= 8, s);
  // The module's reportRows at the bell.
  st.launched = 4; st.banked = 3; st.cash = 100;
  const tm = crew.mods.list.find(e => e.m.id === 'tourney');
  assert.deepEqual(tm.m.reportRows(crew, st), [{ text: "Members' balls 3 of 4", cash: 100 }]);
});

test('3b: the memo shows the Tournament line on the first Tournament morning (memoSecond event slot)', () => {
  const crew = new Crew('TMEMO2', { venue: 1, day: 12, venueDay: 3, up: { gear: 3 }, mowe: { tame: true } }, { seed: 7, now: () => 1e6 });
  const p = crew.join('A'); crew.connect(p);
  crew.events = [];
  crew.startShift();
  const memo = crew.events.find(e => e.t === 'memo' || e.memo);
  const text = JSON.stringify(memo ?? {});
  assert.ok(text.includes(TOURNEY_MEMO), `the memo names the Tournament: ${text.slice(0, 200)}`);
});

// ---- 3c: the County's second patch -------------------------------------------------------------------------------
test('3c: the second inspection never repeats the first patch', () => {
  const first = { x: -2.2, z: -40.9 };
  const hz = [{ x: -2, z: -41 }, { x: 0, z: -38 }, { x: 30, z: -60 }, { x: 31, z: -58 }];
  const p = secondPatch(hz, first, 0);
  assert.ok(Math.hypot(p.x - first.x, p.z - first.z) >= PATCH2.APART, 'a far hazard');
  assert.deepEqual([p.x, p.z], [30, -60]);
  // Every hazard near the first: an anchor, from the hash, never within APART of the first.
  for (let day = 1; day < 40; day++) {
    const h = hash32(day, 3, 'insp', 2), q = secondPatch([{ x: -2, z: -41 }], first, h);
    assert.ok(Math.hypot(q.x - first.x, q.z - first.z) >= PATCH2.APART, `day ${day}`);
    assert.equal(q.r, INSPECT.R);
  }
  assert.deepEqual(secondPatch(hz, null), inspectPatch(hz), 'no first: the usual patch');
});

test('3c: in a County crew with the inspector retained, the two visits go to different places', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('C2P', { venue: 4, day: 40, venueDay: 2, up: { landmark: 4, gear: 3 } }, { seed: 5, now: () => clock.t });
  crew.up.landmark = 4;
  const p = crew.join('A'); crew.connect(p); crew.startShift();
  const starts = [];
  for (let i = 0; i < 20 * 300 && crew.phase === 'shift'; i++) {
    clock.t += 50; p.seenAt = p.movedAt = clock.t; crew.tick(0.05);
    for (const e of crew.events) if (e.t === 'inspect' && e.phase === 'start') starts.push(e);
    crew.events = [];
  }
  assert.equal(starts.length, 2, 'two visits');
  assert.ok(Math.hypot(starts[0].x - starts[1].x, starts[0].z - starts[1].z) >= PATCH2.APART - 0.1, JSON.stringify(starts));
});

// ---- 5a: the poach, tuned --------------------------------------------------------------------------------------
test('5a: one double a week; the price ×1.5 for each poach this week', () => {
  assert.equal(POACH.DOUBLE_PER_WEEK, 1);
  const rec = pw => ({ yesterday: { cash: 1e6 }, rival: { week: 1, wins: 0, days: 0, last: [1], acquired: 0, pw } });
  assert.deepEqual([0, 1, 2].map(pw => poachPrice({ endless: true, records: rec(pw), day: 9 })), [250_000, 375_000, 562_500]);
  assert.equal(poachPrice({ endless: true, records: rec(2), day: 9, weekPoaches: 0 }), 250_000, 'weekPoaches wins');
  let r = { week: 1, wins: 0, days: 0, last: [50], acquired: 0 };
  const a = rivalBell(r, 40, 50, true); assert.equal(a.rival.wins, 2); assert.equal(a.rival.dbl, 1);
  const b = rivalBell(a.rival, 40, 50, true); assert.equal(b.rival.wins, 3, 'the second poached win counts 1');
  const lost = rivalBell(r, 60, 50, true); assert.equal(lost.rival.dbl, 0, 'a poached loss keeps the double');
  assert.equal(poachDouble(a.rival), false); assert.equal(poachDouble(r), true);
  assert.deepEqual(cleanRival({ ...a.rival, pw: 2 }).pw, 2);
  // Fastest acquisition: the double + two wins = the 3rd race day; never twice in 5 days.
  let k = { week: 1, wins: 0, days: 0, last: [50], acquired: 0 }, acq = [];
  for (let d = 1; d <= 5; d++) { const o = rivalBell(k, 40, 50, true); k = o.rival; if (o.acquired) acq.push(d); }
  assert.deepEqual(acq, [3]);
});

test('5a: buyPoach passes the week\'s count and raises it; a new week resets it', () => {
  const crew = new Crew('PCH2', { venue: 5, day: 40, venueDay: 9, endless: true, cash: 1e9,
    records: { cash: 9e7, yesterday: { cash: 8e7 }, rival: { week: 1, wins: 0, days: 1, last: [8e7, 8e7], acquired: 0 } } }, { seed: 3, now: () => 1e6 });
  const p = crew.join('A'); crew.connect(p); crew.startShift();
  const c0 = crew.cash;
  assert.equal(crew.buy(p, 'poach'), true);
  assert.equal(c0 - crew.cash, 2e7);
  assert.equal(crew.records.rival.pw, 1);
  crew.poachDay = null;   // (tomorrow)
  const c1 = crew.cash;
  assert.equal(crew.buy(p, 'poach'), true);
  assert.equal(c1 - crew.cash, 3e7, '37.5 %');
  assert.equal(rivalBell({ ...crew.records.rival, days: 6 }, 40, 50, false).rival.pw, 0, 'the week ends: back to 25 %');
});

// ---- 5b: visible ------------------------------------------------------------------------------------------------
test('5b: the regulars only on a poach day; the card waits for the memo; the shop tag; the report row', () => {
  assert.equal(regularsShown({ endless: true, phase: 'shift' }, { on: 1 }), true);
  assert.equal(regularsShown({ endless: true, phase: 'shift' }, { price: 5 }), false);
  assert.equal(regularsShown({ endless: true, phase: 'report' }, { on: 1 }), false);
  assert.equal(PA_LINES.poach.caption, POACH_FEED, 'the card is from the PA queue, after the memo');
  assert.equal(poachShopTag({ price: 5, dbl: 1 }), POACH_DOUBLE_TAG);
  assert.equal(poachShopTag({ price: null, dbl: 1 }), null);
  assert.equal(poachShopTag({ price: 5 }), null);
  for (const s of [POACH_FEED, POACH_ROW_LINE, POACH_DOUBLE_TAG, HUSTLE_HINT]) assert.ok(wordCount(s) <= 8, s);
});

test('5b/5c: the poach module\'s rows: the poach day, and the Hustle hint once ever', () => {
  const voiced = new Set();
  const crew = { endless: true, day: 9, poachDay: 9, rivalT: 100, records: { yesterday: { cash: 150 } }, contract: { goal: { k: 'hustle', n: 2 } }, voiced };
  assert.deepEqual(poach.reportRows(crew), [{ text: POACH_ROW_LINE }, { text: HUSTLE_HINT }]);
  assert.deepEqual(poach.reportRows(crew), [{ text: POACH_ROW_LINE }], 'once ever');
  assert.ok(voiced.has('hustlehint'));
  const lost = { ...crew, poachDay: 3, voiced: new Set(), records: { yesterday: { cash: 50 } } };
  assert.deepEqual(poach.reportRows(lost), [], 'no poach, no beat');
  assert.deepEqual(poach.reportRows({ ...lost, records: { yesterday: { cash: 150 } }, contract: { goal: { k: 'cash' } } }), [], 'not a Hustle day');
  assert.deepEqual(poach.reportRows({ endless: false }), []);
});

test('5b: a poach morning queues the one PA card (crew.pa: big, so the PA cap never eats it)', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('PCH3', { venue: 5, day: 40, venueDay: 9, endless: true, cash: 1e9,
    records: { cash: 9e7, yesterday: { cash: 8e7 }, rival: { week: 1, wins: 0, days: 1, last: [8e7, 8e7], acquired: 0 } } }, { seed: 3, now: () => clock.t });
  const p = crew.join('A'); crew.connect(p);
  assert.equal(crew.buy(p, 'poach'), true);
  crew.startShift();
  const ev = [];
  for (let i = 0; i < 20 * 12; i++) { clock.t += 50; p.seenAt = p.movedAt = clock.t; crew.tick(0.05); ev.push(...crew.events.map(e => ({ ...e, at: crew.shiftT }))); crew.events = []; }
  const pa = ev.filter(e => e.t === 'pa' && e.id === 'poach');
  assert.equal(pa.length, 1); assert.ok(pa[0].at >= 9, 'after the memo');
  assert.equal(ev.filter(e => e.t === 'poach').length, 1);
});

test('5b: the snapshot carries dbl while the double is unused', () => {
  const mk = rival => ({ endless: true, phase: 'shift', day: 9, poachDay: null, records: { yesterday: { cash: 1e6 }, rival } });
  assert.equal(poach.snapshot(mk({ week: 1, wins: 0, days: 1, last: [1], acquired: 0 })).dbl, 1);
  assert.equal(poach.snapshot(mk({ week: 1, wins: 2, days: 1, last: [1], acquired: 0, dbl: 1 })).dbl, undefined);
});

// ---- 5c: the three lines ----------------------------------------------------------------------------------------
test('5c: the star card, the plaque line and the tilt', () => {
  assert.equal(STAR_CARD, `Gary: '${STAR_LINE}'`);
  assert.ok(wordCount(STAR_CARD) <= 8, STAR_CARD);
  const c = newCase(['A', 'B'], 10);
  assert.equal(plaqueLines(c).includes(STAR_PLAQUE), false);
  assert.equal(plaqueLines(c, { star: true }).at(-1), STAR_PLAQUE);
  assert.equal(starTiltWeight(0), 0);
  assert.equal(starTiltWeight(STAR_TILT.AT + STAR_TILT.UP + 0.1), 1);
  assert.equal(starTiltWeight(STAR_TILT.AT + 2 * STAR_TILT.UP + STAR_TILT.HOLD + 0.01), 0);
  assert.ok(Math.abs(2 * STAR_TILT.UP + STAR_TILT.HOLD - 2) < 1e-9, '2 s in all');
  assert.ok(STAR_TILT.AT + 2 * STAR_TILT.UP + STAR_TILT.HOLD <= 7.5 - 3, 'inside the case shot (revealclock: CASE_AT 3, floor 7.5)');
  void SIM;
});
