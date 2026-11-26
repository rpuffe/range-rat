// Council round 11, builder 3 ("late"): the County says "hazards" (#2), souvenir requests (#5), endless opens with a
// win (#6). design/round13-late.md has the bot numbers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIM, QUOTA_KPI } from '../web/js/sim.js';
import { missLine, gaugeMiss, zoningCause, ZONE_COST, GAUGE_MISS, RALLY_LINES } from '../web/js/rally.js';
import { HAZ, ZONING, HAZ_DEAL, hazDealDue, hazPair, zoningLabel, vanToast } from '../web/js/county.js';
import { SOUV, REQ, SECTIONS, reqEvery, reqDue, reqSection, inSection, souvPay, reqCrowd, reqMiss, reqLine, carryLine } from '../web/js/stadium.js';
import { raceYesterday, streakLine, ownerRecord, ownerBook, cleanOwner, yesterdayPace, winchLine } from '../web/js/owner.js';
import { HINTS, createHinter, armAgain } from '../web/js/settings.js';
import { wordCount } from '../web/js/say.js';
import { Crew } from '../server/crew.mjs';
import stadium from '../server/venues/stadium.mjs';
import county from '../server/venues/county.mjs';

function crewAt(venue, mods, n = 2, extra = {}, shiftSecs = 300) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('LT11', { venue, day: 20, venueDay: 1, up: { shed: 1, cart: 1 }, ...extra }, { shiftSecs, seed: 4, now: () => clock.t, modules: mods });
  const rats = Array.from({ length: n }, (_, i) => { const p = crew.join('R' + i); crew.connect(p); p.x = 20 + i * 5; p.z = 9; return p; });
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;   // no customers: the test places every ball
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; for (const p of rats) { p.seenAt = clock.t; p.movedAt = clock.t; } crew.tick(0.05); } };
  return { crew, rats, run, clock };
}
const rest = (crew, x, z, kind = 'range') => { const b = crew.addBall({ x, y: SIM.BALL_R, z, vx: 0, vy: 0, vz: 0, kind }); b.rest = true; return b; };
const drain = crew => { const ev = crew.events; crew.events = []; return ev; };

// ---- #2 the County says "hazards" -----------------------------------------------------------------------------------
test('the miss line names the bigger Zoning term: hazards when haz/12 >= strays/30, strays otherwise', () => {
  assert.equal(ZONE_COST.HAZ, HAZ.CAP); assert.equal(ZONE_COST.STRAY, ZONING.STRAY_CAP);
  assert.equal(missLine(4, { haz: 9, strays: 14 }), 'Missed: 9 hazards left out. Spray, then bag.');
  assert.equal(missLine(4, { haz: 2, strays: 14 }), 'Missed: 14 strays in the Yards.');
  assert.equal(missLine(4, { haz: 4, strays: 10 }), 'Missed: 4 hazards left out. Spray, then bag.', 'a tie goes to hazards');
  assert.equal(missLine(4, { haz: 1, strays: 0 }), 'Missed: 1 hazard left out. Spray, then bag.');
  assert.equal(missLine(4, { haz: 0, strays: 0 }), GAUGE_MISS[4], 'nothing out: the fallback');
  assert.equal(missLine(3, { haz: 9, strays: 0 }), GAUGE_MISS[3], 'only the County reads hazards');
  assert.deepEqual(gaugeMiss(4, { haz: 9, strays: 3 }), { why: missLine(4, { haz: 9, strays: 3 }), cause: 'haz', out: '9 hazards out' });
  assert.deepEqual(gaugeMiss(2, null), { why: GAUGE_MISS[2] });
  assert.equal(zoningCause({ haz: 0, strays: 5 }).cause, 'strays');
  for (const st of [{ haz: 99, strays: 0 }, { haz: 0, strays: 99 }, { haz: 1, strays: 0 }]) assert.ok(wordCount(missLine(4, st)) <= 8, missLine(4, st));
  assert.ok(wordCount(RALLY_LINES.hazards) <= 8 && wordCount(RALLY_LINES.gauge[4]) <= 8 && wordCount(vanToast(12)) <= 8);
});

test('the hazard deal: 3 hazards under the line + 0.1, not 2; not above it; at most every 45 s', () => {
  const L = QUOTA_KPI;
  assert.equal(hazDealDue({ haz: 3, kpi: L + 0.05, line: L }), true);
  assert.equal(hazDealDue({ haz: 2, kpi: 0, line: L }), false, '2 hazards: no deal');
  assert.equal(hazDealDue({ haz: 5, kpi: L + HAZ_DEAL.OVER + 0.01, line: L }), false, 'Zoning comfortable: no deal');
  assert.equal(hazDealDue({ haz: 5, kpi: 0.2, line: L, since: 44 }), false);
  assert.equal(hazDealDue({ haz: 5, kpi: 0.2, line: L, since: 45 }), true);
});

test('hazPair: the wand holder sprays, the nearest other Rat bags; solo deals one', () => {
  const hz = [{ x: 0, z: -30 }, { x: 4, z: -30 }];
  const rats = [{ id: 'a', x: 2, z: -31 }, { id: 'b', x: 2, z: -40 }, { id: 'c', x: 30, z: 0, wand: true }];
  assert.deepEqual(hazPair(rats, hz), ['c', 'a'], 'the wand holder is the sprayer');
  assert.deepEqual(hazPair(rats.slice(0, 2), hz), ['a', 'b']);
  assert.deepEqual(hazPair([rats[1]], hz), ['b']);
  assert.deepEqual(hazPair(rats, []), []);
});

test('the Board label and the first tow say hazards', () => {
  assert.equal(zoningLabel(0.62, 7), 'ZONING 62% · 7 HAZARDS');
  assert.equal(zoningLabel(0.9, 1), 'ZONING 90% · 1 HAZARD');
  assert.equal(zoningLabel(1, 0), 'ZONING 100%');
  assert.equal(vanToast(6), 'Zoning towed 6 balls. Bag the hazards!');
});

test('County crew: 3 hazards out deals "Hazards out!" to two Rats; the bell names the hazards', () => {
  const { crew, rats: [a, b, c], run } = crewAt(4, [county], 3);
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
  const mk = (x, z) => { const h = rest(crew, x, z); h.kind = 'hazard'; h.hands = true; h.hazAt = crew.custT; return h; };
  a.x = 0; a.z = -30; b.x = 5; b.z = -32; c.x = -40; c.z = 5;
  mk(0, -35); mk(3, -35);
  run(1);
  assert.equal(drain(crew).filter(e => e.t === 'rally').length, 0, '2 hazards: no deal');
  for (let i = 0; i < 5; i++) mk(6 + i, -36);   // 7 out: Zoning 0.42, under the line
  run(1);
  const deal = drain(crew).filter(e => e.t === 'rally');
  assert.equal(deal.length, 1);
  assert.deepEqual(Object.keys(deal[0].needs).sort(), [a.id, b.id].sort(), 'the two nearest');
  assert.equal(deal[0].needs[a.id], RALLY_LINES.hazards);
  assert.equal(deal[0].need, undefined, 'the third Rat gets no line');
  run(20);
  assert.equal(drain(crew).filter(e => e.t === 'rally' && e.haz).length, 0, 'not again inside 45 s');
  assert.match(crew.snapshot().mods.county.label, /^ZONING \d+% · 7 HAZARDS$/);
  crew.bank(10, a.id);
  crew.endShift();
  const q = crew.report.quota;
  assert.equal(q.gaugeOk, false);
  assert.equal(q.why, 'Missed: 7 hazards left out. Spray, then bag.');
  assert.equal(q.cause, 'haz'); assert.equal(q.out, '7 hazards out');
});

test('the hazard tip re-arms once after a hazard DENIED (HINTS.hazard.again)', () => {
  const mem = new Map(), storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  assert.equal(HINTS.hazard.again, true);
  const h = createHinter({ storage });
  h.markSeen(['hazard', 'souvenir']);
  assert.ok(h.seen.includes('hazard'));
  assert.equal(armAgain('souvenir', storage), false, 'only an `again` hint re-arms');
  assert.equal(armAgain('hazard', storage), true);
  assert.ok(!h.seen.includes('hazard') && h.seen.includes('souvenir'));
  let shown = null;
  for (let i = 0; i < 40 && !shown; i++) h.tick(0.5, { playing: true, venue: 4, hazOut: true, day: 20, show: (t, id) => { shown = id; } });
  assert.equal(shown, 'hazard');
});

// ---- #5 souvenir requests -------------------------------------------------------------------------------------------
test('requests: one at a time, from 0:30 to T-60, every 38/45/55/65 s by crew size, 30 s each', () => {
  assert.deepEqual([4, 3, 2, 1].map(reqEvery), [38, 45, 55, 65]);   // council round 12 #2: a call a minute round the Stretch's pause
  assert.equal(REQ.SECS, 30);
  assert.equal(reqDue({ t: 29, left: 300, n: 4 }), false);
  assert.equal(reqDue({ t: 30, left: 300, n: 4 }), true);
  assert.equal(reqDue({ t: 60, left: 300, last: 30, n: 4 }), false);
  assert.equal(reqDue({ t: 75, left: 300, last: 30, n: 4 }), true);
  assert.equal(reqDue({ t: 75, left: 300, last: 30, n: 1 }), false);
  assert.equal(reqDue({ t: 120, left: 300, last: 30, n: 1 }), true);
  assert.equal(reqDue({ t: 200, left: 60, last: 30, n: 4 }), false, 'none from T-60');
  assert.equal(reqDue({ t: 200, left: 300, last: 30, n: 4, live: true }), false, 'one at a time');
  assert.equal(SECTIONS.length, 6);
  for (const s of SECTIONS) assert.equal(s.z1 - s.z0, REQ.LEN);
  assert.equal(new Set(Array.from({ length: 6 }, (_, k) => reqSection(k).i)).size, 6, 'six in a row: every section once');
  const C = SECTIONS[2];
  assert.ok(inSection(C, -63, C.zc) && !inSection(C, 63, C.zc) && !inSection(C, -63, SECTIONS[0].zc));
});

test('requests: a lit delivery pays x3 and +0.15; the relay does not stack; a miss costs 0.06 (solo 0.03)', () => {
  assert.equal(souvPay(1, false, true), SOUV.W * 3);
  assert.equal(souvPay(1, true, true), SOUV.W * 3, 'the best is x3');
  assert.equal(souvPay(2, true, false), 2 * SOUV.W * 2);
  assert.equal(reqCrowd(1), 0.15);
  assert.equal(reqMiss(4), 0.06); assert.equal(reqMiss(1), 0.03);
  assert.equal(reqLine({ sec: 'C', left: 17.4 }), 'SECTION C WANTS A BALL · 0:18');
  assert.equal(carryLine(2), 'Souvenirs ×2 → crowd rail');
  for (const l of [carryLine(3), carryLine(1, { sec: 'D' })]) assert.ok(wordCount(l) <= 8, l);
});

test('Stadium crew: a request lights at 0:30, a delivery in its section pays x3 and cheers; the next one, missed, costs crowd', () => {
  const { crew, rats: [a, b], run } = crewAt(3, [stadium], 2, {}, 420);
  const st = crew.mods.state('stadium');
  run(29); assert.equal(st.req, null);
  run(1.5);
  assert.ok(st.req, 'lit at 0:30');
  const sec = SECTIONS[st.req.i];
  assert.equal(crew.snapshot().mods.stadium.req.sec, sec.name);
  const ball = rest(crew, 0, -60, 'souvenir'); ball.hands = true;
  a.x = 0; a.z = -60; b.x = -40; b.z = 0;
  assert.ok(crew.pickup(a, ball.id));
  st.s = 0.4; const c0 = crew.stats.cash;
  a.x = sec.side * 63; a.z = sec.zc; run(0.1);
  assert.equal(st.req, null, 'answered');
  assert.ok(Math.abs(st.s - (0.4 + REQ.CROWD)) < 0.01, `crowd ${st.s}`);
  assert.ok(crew.stats.souvCash > 0 && crew.stats.cash - c0 >= crew.stats.souvCash - 0.01);
  // a plain delivery of the same ball elsewhere pays a third
  const ev = drain(crew).find(e => e.t === 'crowd' && e.kind === 'souv');
  assert.equal(ev.req, sec.name);
  run(76);   // the next request (2P: 75 s start to start, so 1:45) lights
  assert.ok(st.req, 'the next one is lit');
  const s0 = st.s;
  run(31);
  assert.equal(st.req, null);
  assert.ok(drain(crew).some(e => e.t === 'crowd' && e.kind === 'reqmiss'));
  assert.ok(st.s < s0 - REQ.MISS + 0.01, 'the miss costs the crowd');
});

// ---- #6 endless opens with a win ------------------------------------------------------------------------------------
test('owner book: day 1 opens it (no NEW), beating it is the record; ownerBook clears the race', () => {
  let r = ownerRecord({ cash: 99 }, 70);
  assert.deepEqual(r, { owner: { cash: 70 }, record: null });
  r = ownerRecord({ cash: 99, owner: { cash: 70 } }, 71);
  assert.deepEqual(r.record, { cash: 71, was: 70, owner: true });
  assert.equal(ownerRecord({ owner: { cash: 70 } }, 60).record, null);
  assert.deepEqual(ownerBook({ cash: 5, curve: [1], yesterday: { cash: 3 }, streak: 2, owner: { cash: 4 } }), { cash: 5, curve: [1] });
  assert.equal(cleanOwner(null), undefined); assert.deepEqual(cleanOwner({ cash: '12' }), { cash: 12 });
  assert.equal(yesterdayPace({ cash: 84.7e6 }), null, 'no race against the Orbital record');
  const d1 = raceYesterday({ cash: 84.7e6 }, 70.8e6, null);
  assert.equal(streakLine(d1.result), 'Day 1 as Owners. Beat $70.8M tomorrow.');
  assert.ok(wordCount(streakLine(d1.result)) <= 8);
  assert.equal(winchLine(13.2e6, 9.1e6), 'SKY CLEAR · WINCH $13.2M · YOU HAVE $9.1M');
});

test('endless crew: day 1 has no race and no record under the Orbital best; day 2 beating day 1 is a NEW owner record', () => {
  const clock = { t: 1_000_000 };
  const crew = new Crew('OWN1', { day: 40, venue: 5, venueDay: 6, endless: true, outstanding: 1, cash: 0, records: { cash: 1e9, banked: 0, day: 39 } }, { shiftSecs: 420, seed: 3, now: () => clock.t });
  const a = crew.join('A'); crew.connect(a);
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; a.seenAt = clock.t; a.movedAt = clock.t; crew.tick(0.05); } };
  const day = per => { crew.startShift(); for (const m of crew.mats) m.next = 1e9; for (let t = 0; t < 420; t += 10) { crew.bank(per, a.id); run(10); } assert.equal(crew.phase, 'report'); };
  day(1);
  assert.ok(crew.report.race.first); assert.equal(crew.report.record, null);
  assert.equal(crew.records.owner.cash, crew.report.cash); assert.equal(crew.records.cash, 1e9, 'Best ever stays');
  const saved = new Crew('OWN1', JSON.parse(JSON.stringify(crew.toSave())));
  assert.deepEqual(saved.records.owner, crew.records.owner, 'the book saves');
  day(3);
  assert.equal(crew.report.race.beat, true);
  assert.equal(crew.report.record?.owner, true, 'NEW owner record');
});

test('MOW-E 2.0 at the Stadium (§2.7): no drain while the boss is live, +0.08 a hit, 1.0 on a win', () => {
  const { crew, run } = crewAt(3, [stadium], 2, {}, 420);
  const st = crew.mods.state('stadium');
  crew.stepMowe = () => {};   // the test drives the boss state by hand
  crew.mower = { kind: 'boss', phase: 'hunt', hits: 0 };
  st.s = 0.5; run(10);
  assert.ok(Math.abs(st.s - 0.5) < 1e-6, `no drain: ${st.s}`);
  crew.mower.hits = 2; run(0.1);
  assert.ok(Math.abs(st.s - 0.66) < 1e-6, `two hits: ${st.s}`);
  crew.mower.phase = 'tamed'; run(0.1);
  assert.ok(st.s > 0.99, 'a win fills the crowd');
});

// ---- council round 12 #7 (builder 2): Inspection Hour, spray chains, the tip, the card -------------------------------
import { INSPECT, inspectSecs, inspectDue, inspectPatch, zoningInspected, inspectAlert, CHAIN, sweepStep, zoningWith, INSPECT_MEMO } from '../web/js/county.js';
import { WASH } from '../web/js/sim.js';
import { tomorrowLine, rowsOf, printCard } from '../web/js/goals.js';
import { kpiNoteOf } from '../web/js/bvtext.js';

const hazAt = (crew, x, z) => { const b = rest(crew, x, z); b.kind = 'hazard'; b.hands = true; b.hazAt = crew.custT ?? 0; return b; };

test('round 12 #7a: the inspector rules: once at T-3:30, 60 s (75 solo), the busiest patch, noted hazards count twice', () => {
  assert.equal(inspectSecs(1), 75); assert.equal(inspectSecs(4), 60);
  assert.equal(inspectDue({ left: 211 }), false); assert.equal(inspectDue({ left: 210 }), true); assert.equal(inspectDue({ left: 200, done: true }), false);
  const p = inspectPatch([{ x: 0, z: -20 }, { x: 40, z: -20 }, { x: 42, z: -22 }, { x: 44, z: -18 }]);
  assert.equal(p.x, 40); assert.equal(p.r, INSPECT.R);
  assert.deepEqual(inspectPatch([]), { x: INSPECT.CENTRE.x, z: INSPECT.CENTRE.z, r: INSPECT.R });
  assert.equal(zoningInspected(0, 2, 2, 0), zoningWith(0, 4), 'a noted hazard counts double');
  assert.ok(Math.abs(zoningInspected(0, 0, 0, -0.05) - 0.95) < 1e-9);
  assert.ok(wordCount(inspectAlert) <= 8 && wordCount(INSPECT_MEMO) <= 8);
  assert.equal(kpiNoteOf({ county: { inspect: { where: '4 HAZARDS', t: 44.2 } } }), 'INSPECTION · 4 HAZARDS · 0:45');
});

test('round 12 #7a: County crew: he comes at T-3:30 to the busiest patch; bagged there ×3 and +0.04; left there, noted -0.05 and double', () => {
  const { crew, rats: [a, b], run } = crewAt(4, [county], 2, {}, 420);
  const st = crew.mods.state('county');
  const S = WASH.STATION;
  const far = hazAt(crew, S.x - 40, S.z - 20);
  const cl = [hazAt(crew, S.x, S.z - 30), hazAt(crew, S.x + 2, S.z - 31), hazAt(crew, S.x - 2, S.z - 29)];
  crew.shiftT = crew.shiftSecs - 211; drain(crew); run(1.5);
  const ev = drain(crew).find(e => e.t === 'inspect' && e.phase === 'start');
  assert.ok(ev, 'he came');
  assert.ok(Math.hypot(ev.x - S.x, ev.z - (S.z - 30)) < 3, 'the busiest patch');
  assert.equal(ev.n, 3);
  assert.equal(crew.snapshot().mods.county.inspect.where, '3 HAZARDS');
  // bag one in his patch: ×3 pay, +0.04 Zoning
  for (const h of cl) h.wetUntil = crew.custT + 99;
  const k0 = st.kpi, c0 = crew.stats.hazCash ?? 0;
  b.x = cl[0].x; b.z = cl[0].z; assert.ok(crew.pickup(b, cl[0].id));
  assert.ok((crew.stats.hazCash - c0) > 0);
  const paid3 = crew.stats.hazCash - c0;
  assert.ok(st.kpi > k0 + 1 / 12 + 0.03, `+1/12 for the hazard and +0.04: ${k0} -> ${st.kpi}`);
  // bag the far one (outside): plain pay
  far.wetUntil = crew.custT + 99; const c1 = crew.stats.hazCash;
  b.x = far.x; b.z = far.z; assert.ok(crew.pickup(b, far.id));
  assert.ok(Math.abs(paid3 / (crew.stats.hazCash - c1) - INSPECT.PAY) < 0.15, `x3 in the patch (BV drifts a little): ${paid3} vs ${crew.stats.hazCash - c1}`);
  // leave two in it: he notes them as he leaves
  for (const h of cl) h.wetUntil = 0;
  run(INSPECT.SECS + 1);
  const done = drain(crew).find(e => e.t === 'inspect' && e.phase === 'done');
  assert.equal(done.noted, 2); assert.equal(done.clean, false);
  assert.ok(st.noted.has(cl[1].id) && st.noted.has(cl[2].id));
  run(1);
  assert.ok(Math.abs(st.kpi - zoningInspected(st.strays, 2, 2, INSPECT.BONUS - 2 * INSPECT.NOTED)) < 1e-9, `kpi ${st.kpi}`);
  assert.equal(crew.snapshot().mods.county.inspect, undefined);
  run(60);
  assert.equal(drain(crew).filter(e => e.t === 'inspect').length, 0, 'once a shift');
  // lead's call (round 14): from the cleanup to the bell the noted hazards are filed (they don't count): never a wall
  crew.shiftT = crew.shiftSecs - 59; run(1);
  assert.ok(crew.closing());
  assert.ok(Math.abs(st.kpi - zoningInspected(st.strays, st.haz - 2, 0, INSPECT.BONUS)) < 1e-9, `at the bell: ${st.kpi}`);
});

test('round 12 #7b: a spray wets every hazard within 3 m; 3 bagged within 6 s is a CLEAN SWEEP (×2 on the third)', () => {
  const times = [];
  assert.equal(sweepStep(times, 0), false); assert.equal(sweepStep(times, 2), false); assert.equal(sweepStep(times, 5.9), true);
  assert.equal(times.length, 0, 'it resets');
  assert.equal(sweepStep(times, 10), false); assert.equal(sweepStep(times, 17), false); assert.equal(sweepStep(times, 18), false, '6 s window');
  const { crew, rats: [a, b] } = crewAt(4, [county], 2);
  const S = WASH.STATION;
  const h = [hazAt(crew, S.x, S.z - 30), hazAt(crew, S.x + 2.5, S.z - 30), hazAt(crew, S.x - 1, S.z - 32), hazAt(crew, S.x + 6, S.z - 30)];
  a.x = S.x; a.z = S.z; assert.ok(crew.toggleWand(a));
  a.x = h[0].x + 4; a.z = h[0].z;
  for (let i = 0; i < 6; i++) { a.washAt = crew.now() - 500; crew.wash(a, 0.5, 'h:' + h[0].id); }
  const now = crew.custT;
  assert.ok(h[0].wetUntil > now && h[1].wetUntil > now && h[2].wetUntil > now, 'the chain: within 3 m');
  assert.ok(!(h[3].wetUntil > now), '6 m away stays dry');
  drain(crew);
  const c0 = crew.stats.hazCash ?? 0, pays = [];
  for (const x of h.slice(0, 3)) { const c = crew.stats.hazCash ?? 0; b.x = x.x; b.z = x.z; assert.ok(crew.pickup(b, x.id)); pays.push(crew.stats.hazCash - c); }
  assert.ok(Math.abs(pays[2] / pays[0] - CHAIN.PAY) < 0.15, `x2 on the third: ${pays}`);
  assert.ok(drain(crew).some(e => e.t === 'hazbag' && e.sweep), 'CLEAN SWEEP');
  assert.equal(crew.stats.sweeps, 1);
  assert.ok(crew.stats.hazCash > c0);
});

test('round 12 #7c/#7d: the hazard tip names the button; the card names the one goal left in 8 words', () => {
  assert.match(HINTS.hazard.pad, /\bRT\b/); assert.match(HINTS.hazard.kb, /\bClick\b/);
  assert.ok(wordCount(HINTS.hazard.pad) <= 8 && wordCount(HINTS.hazard.kb) <= 8);
  for (const v of [0, 1, 2, 3, 4]) for (const n of [1, 4]) {
    const card = printCard(v, n);
    const rows = rowsOf(card, { fee: 6_600_000, cash: 1_000 });
    for (const open of rows) {
      const one = rows.map(r => ({ ...r, done: r !== open }));
      const line = tomorrowLine(one, v);
      assert.ok(wordCount(line) <= 8, line);
      assert.ok(!/one goal left/.test(line) || open.kind === 'fee', `names it: ${line}`);
    }
  }
  const c4 = rowsOf(printCard(4, 4), { fee: 1, cash: 9 });
  assert.equal(tomorrowLine(c4.map(r => ({ ...r, done: r.id !== 'reviews', have: r.id === 'reviews' ? 1 : r.have })), 4), 'Tomorrow: one more good day for the Orbital.');
  assert.equal(tomorrowLine(c4.map(r => ({ ...r, done: r.id !== 'strays', have: r.id === 'strays' ? 45 : r.have })), 4), 'Tomorrow: 40 more strays for the Orbital.');
  assert.equal(tomorrowLine(c4.map(r => ({ ...r, done: r.id === 'fee' })), 4), 'Tomorrow: four goals left for the Orbital.', 'more than one: the count');
});

test('round 12 9.16: the Orbital with every step done names Ball No. 1 (strip and tomorrow), never undefined', async () => {
  const { strip } = await import('../web/js/goals.js');
  const rows = rowsOf(printCard(5, 4), { sky: true, up: { tether: 1 } }).map(r => ({ ...r, done: true }));
  assert.equal(strip(rows, 5).next, 'NEXT: FIND BALL NO. 1');
  assert.equal(tomorrowLine(rows, 5), 'Tomorrow: find Ball No. 1.');
});
