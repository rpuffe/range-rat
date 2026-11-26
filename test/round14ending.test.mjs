// Council round 12, builder 3 ("ending"): the ending on camera (#3), endless contracts you can see and win (#6),
// Site 13 the live endless rival (#8). design/round14-ending.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Crew } from '../server/crew.mjs';
import { SIM } from '../web/js/sim.js';
import { wordCount } from '../web/js/say.js';
import { oneBeam, oneBeamScale, ONE_BEAM, ONE_DOWN_LINE, targetBeamsHidden, lastBucketLine } from '../web/js/huddlerules.js';
import { HUSH, hushWeight, CASE, PLAQUE_HEAD, newCase, addRecordLine, plaqueLines, cleanCase, caseMoney } from '../web/js/caserules.js';
import { CONTRACT, GOALS_BY_STARS, contractsFor, contractMet, contractLive, goalText, cleanContract, COSMETICS, RIVAL_LOOK,
  unlockedLooks, canWear, newlyUnlocked } from '../web/js/today.js';
import { RIVAL, rivalTarget, rivalJitter, rivalPace, rivalBell, cleanRival, rivalLine } from '../web/js/owner.js';
import { BEAT_BY_ID, midDue } from '../web/js/story.js';

const preset = id => JSON.parse(readFileSync(new URL(`../server/presets/${id}.json`, import.meta.url), 'utf8')).save;

// ---- #3a the gold beam ------------------------------------------------------------------------------------------
test('#3a: the beam stands on Ball No. 1 while it is down, over its carrier while carried; the Target beams hide then', () => {
  const balls = [{ kind: 'range', x: 1, z: 1 }, { kind: 'one', x: -17, z: -110 }];
  const down = { phase: 'shift', lastBucket: { phase: 'down' }, players: [] };
  const out = { x: 0, z: 0, carried: null };
  assert.equal(oneBeam(down, balls, out), out, 'writes into the out object (no allocation per frame)');
  assert.deepEqual(out, { x: -17, z: -110, carried: null });
  const carried = { phase: 'shift', lastBucket: { phase: 'carried' }, players: [{ id: 'a', x: 3, z: 4 }, { id: 'b', x: 9, z: 8, one: true }] };
  assert.deepEqual(oneBeam(carried, [], out), { x: 9, z: 8, carried: 'b' });
  assert.equal(oneBeam({ ...carried, lastBucket: { phase: 'huddle' } }, [], out)?.carried, 'b');
  for (const ph of ['sky', 'falling', 'done']) assert.equal(oneBeam({ phase: 'shift', lastBucket: { phase: ph }, players: [] }, balls), null, ph);
  assert.equal(oneBeam({ ...down, phase: 'report' }, balls), null);
  assert.ok(targetBeamsHidden(down) && targetBeamsHidden(carried) && targetBeamsHidden({ ...carried, lastBucket: { phase: 'huddle' } }));
  assert.ok(!targetBeamsHidden({ phase: 'shift', lastBucket: null }) && !targetBeamsHidden({ phase: 'shift', lastBucket: { phase: 'done' } }));
  assert.ok(Math.abs(9 * ONE_BEAM.SY - 25) < 0.3, 'the 9 m beacon × 2.8 is the 25 m beam');
  assert.ok(Math.abs(9 * ONE_BEAM.CARRY_SY - 4) < 1e-9, 'the carried pillar is 4 m');
  const rs = [0, 0.5, 1, 1.5].map(t => oneBeamScale(false, t));
  assert.ok(Math.max(...rs) <= 2 * 1.12 + 1e-9 && Math.min(...rs) >= 2 * 0.88 - 1e-9, 'radius ×2, pulse ±12 %');
  assert.equal(oneBeamScale(true, 0.5), 1);
});

test('#3a: the banner says "follow the gold beam": ≤ 8 words, each segment ≤ 28 characters', () => {
  const c = { phase: 'shift', lastBucket: { phase: 'down' }, players: [] };
  assert.equal(lastBucketLine(c, 'a'), ONE_DOWN_LINE);
  assert.ok(wordCount(ONE_DOWN_LINE) <= 8, ONE_DOWN_LINE);
  for (const seg of ONE_DOWN_LINE.split(' · ')) assert.ok(seg.length <= 28, seg);
  assert.match(ONE_DOWN_LINE, /gold beam/);
});

// ---- #3b the hush ---------------------------------------------------------------------------------------------
test('#3b: the hush eases in over 0.8 s and out over 0.8 s; the note card sits high; the crack is lifted', () => {
  assert.equal(hushWeight(0), 0); assert.ok(Math.abs(hushWeight(0.4) - 0.5) < 1e-9); assert.equal(hushWeight(0.8), 1); assert.equal(hushWeight(9), 1);
  assert.equal(hushWeight(9, 0), 1); assert.equal(hushWeight(9, 0.8), 0);
  assert.deepEqual([HUSH.NEAR, HUSH.EASE, HUSH.BACK, HUSH.UP, HUSH.LIP_Y], [15, 0.8, 1, 0.3, 1.9]);
  assert.equal(BEAT_BY_ID.note.cards[0].pos, 'high', 'the note card draws in the upper third');
});

// ---- #3d the glass case -----------------------------------------------------------------------------------------
test('#3d: the plaque: the head, the names, the newest 4 record lines; save round-trip', () => {
  let c = newCase(['Ann', 'Bob', 'Ann', ''], 19);
  assert.deepEqual(c.names, ['Ann', 'Bob']);
  assert.equal(PLAQUE_HEAD, 'BALL No. 1 · 1958–2026 · FOUND BY');
  for (const [d, v] of [[20, 69.4e6], [21, 74e6], [23, 80e6], [24, 91.2e6], [27, 95e6]]) c = addRecordLine(c, d, v);
  const lines = plaqueLines(c);
  assert.equal(lines.length, 2 + CASE.MAX_LINES);
  assert.deepEqual(lines.slice(2), ['Day 2 · $74M', 'Day 4 · $80M', 'Day 5 · $91.2M', 'Day 8 · $95M'], 'the newest four, by Owners\' day');
  assert.deepEqual(cleanCase(JSON.parse(JSON.stringify(c))), c);
  assert.equal(cleanCase(null), null); assert.equal(cleanCase({ names: 'x' }), null);
  assert.equal(caseMoney(850e3), '$850K');
  assert.ok(Math.hypot(CASE.x - SIM.STAND.x, CASE.z - SIM.STAND.z) < 6, 'by the return');
});

function lastBucket(n = 1) {
  let t = 0;
  const c = new Crew('CASE', preset('lastbucket'), { now: () => t * 1000, seed: 7 });
  const ps = Array.from({ length: n }, (_, i) => { const p = c.join('R' + i); c.connect(p); return p; });
  const log = [];
  const run = secs => { for (let i = 0; i < Math.round(secs * 10); i++) { t += 0.1; for (const p of c.players.values()) if (p.online > 0) p.seenAt = t * 1000; c.tick(0.1); log.push(...c.events); c.events = []; } };
  if (c.phase !== 'shift') { for (const p of ps) c.readyUp(p); run(1); }
  for (let i = 0; i < 400 && ![...c.balls.values()].some(b => b.kind === 'one' && b.y <= 0.4); i++) run(0.5);
  return { c, ps, run, log };
}
test('#3d: the bank builds the case FOUND BY the crew; the first Owners\' morning flags Gary; the save keeps it; an old save builds one', () => {
  const m = lastBucket(2), { c, ps, run } = m;
  const b = [...c.balls.values()].find(x => x.kind === 'one');
  ps[1].x = b.x; ps[1].z = b.z; assert.ok(c.pickup(ps[1], b.id));
  for (const p of ps) { p.x = SIM.STAND.x + 0.3; p.z = SIM.STAND.z; c.input(p, { a: [{ t: 'hold', on: true }] }); }
  run(3.4);
  assert.equal(c.lastBucket.phase, 'done');
  assert.deepEqual(c.glassCase.names, ['R1', 'R0'], 'the carrier first');
  assert.deepEqual(c.snapshot().glassCase.names, ['R1', 'R0']);
  for (const p of ps) c.readyUp(p);
  run(0.5);
  assert.equal(c.snapshot().firstOwnerDay, true, 'a rejoin restores Gary at the return');
  const save = JSON.parse(JSON.stringify(c.toSave()));
  assert.deepEqual(new Crew('CASE', save).glassCase, c.glassCase);
  // an old save past the bank, with no case: built from the crew's names on its next morning
  const old = { ...save }; delete old.glassCase;
  const o = new Crew('OLDC', old, { seed: 3 });
  const p = o.join('Zed'); o.connect(p);
  o.startShift();
  assert.deepEqual(o.glassCase.names, ['Zed']);
  assert.equal(o.snapshot().firstOwnerDay, undefined, 'not the first Owners\' morning');
});

// ---- #6 contracts -------------------------------------------------------------------------------------------------
test('#6a: one count for "left": the report, the contract and the dusk line read ballsLeft()', () => {
  const c = new Crew('LEFT', { v: 5, day: 30, venue: 5, endless: true }, { shiftSecs: 120, seed: 3 });
  const p = c.join('A'); c.connect(p);
  c.startShift();
  c.addBall({ x: 0, y: 0.02, z: -30, vx: 0, vy: 0, vz: 0, kind: 'range' }).rest = true;
  c.addBall({ x: 2, y: 0.02, z: -30, vx: 0, vy: 0, vz: 0, kind: 'range', sunk: true });   // sunk: not "left out there"
  c.addBall({ x: 4, y: 0.02, z: -30, vx: 0, vy: 0, vz: 0, kind: 'range', cup: 1 });     // in a cup: not either
  c.contract = { mod: { id: 'rain' }, goal: { k: 'spotless', n: 0 }, stars: 1 };
  const left = c.ballsLeft();
  c.endShift();
  assert.equal(c.report.left, left);
  assert.equal(c.contractStats(c.report.left).left, left);
  assert.equal(c.report.contract.met, left === 0);
});

test('#6b: goal tiers: the pool, the Hustle goals (×3 only with the Owner\'s Hustle), text ≤ 8 words', () => {
  assert.deepEqual(GOALS_BY_STARS[1].map(g => g.k), ['cash', 'upright', 'spotless']);
  assert.deepEqual(GOALS_BY_STARS[2].map(g => g.k), ['cash', 'upright', 'hustle']);
  assert.deepEqual(GOALS_BY_STARS[3].map(g => g.k), ['cash', 'upright', 'hustle']);
  assert.deepEqual(GOALS_BY_STARS[3].find(g => g.k === 'cash').f, 1.1);
  const seen = new Set();
  for (let d = 1; d < 80; d++) for (const cap of [2, 3]) for (const o of contractsFor({ key: 5, day: d, yesterday: 5e7, hustleCap: cap })) {
    assert.ok(wordCount(goalText(o.goal)) <= 8, goalText(o.goal));
    if (o.goal.k === 'hustle') { seen.add(o.stars + ':' + o.goal.n + ':' + (o.goal.by ?? '-')); assert.ok(o.goal.n <= cap); }
    assert.deepEqual(cleanContract(JSON.parse(JSON.stringify(o))), o);
  }
  assert.ok(seen.has('2:2:-') && seen.has('3:3:' + CONTRACT.HUSTLE_BY) && seen.has('3:2:' + CONTRACT.HUSTLE_BY), [...seen].join());
  assert.equal(goalText({ k: 'hustle', n: 3, by: 120 }), 'Hit ×3 Hustle by T−2:00');
  assert.equal(goalText({ k: 'hustle', n: 2 }), 'Reach ×2 Hustle');
  const h3 = { goal: { k: 'hustle', n: 3, by: 120 } };
  assert.ok(contractMet(h3, { hustleAt: 299, secs: 420 }) && !contractMet(h3, { hustleAt: 301, secs: 420 }) && !contractMet(h3, { hustleAt: null, secs: 420 }));
  assert.ok(contractMet({ goal: { k: 'hustle', n: 2 } }, { hustleAt: 419, secs: 420 }));
});

test('#6c: the contract live: met when it can\'t be undone, lost when it can\'t come back; "Contract lost." once', () => {
  assert.deepEqual(contractLive({ goal: { k: 'upright', n: 2 } }, { knockdowns: 1 }), { state: 'live', so: 1 });
  assert.equal(contractLive({ goal: { k: 'upright', n: 2 } }, { knockdowns: 3 }).state, 'lost');
  assert.equal(contractLive({ goal: { k: 'cash', n: 100 } }, { cash: 100 }).state, 'met');
  assert.equal(contractLive({ goal: { k: 'cash', n: 5e7 } }, { cash: 4.18e7 }).so, '$41.8M SO FAR');
  assert.equal(contractLive({ goal: { k: 'spotless', n: 0 } }, { left: 7 }).so, '7 OUT NOW');
  const h = { goal: { k: 'hustle', n: 3, by: 120 } };
  assert.equal(contractLive(h, { mult: 1.5, shiftT: 100, secs: 420 }).so, '×1.5 NOW');
  assert.equal(contractLive(h, { mult: 3, hustleAt: 250, shiftT: 260, secs: 420 }).state, 'met');
  assert.equal(contractLive(h, { mult: 2, shiftT: 301, secs: 420 }).state, 'lost');
  // the server: the snapshot carries state and so; one contractLost event
  const c = new Crew('LIVE', { v: 5, day: 30, venue: 5, endless: true }, { shiftSecs: 120, seed: 3 });
  const p = c.join('A'); c.connect(p);
  c.startShift();
  c.contract = { mod: { id: 'rain' }, goal: { k: 'upright', n: 0 }, stars: 3 };
  assert.deepEqual([c.snapshot().contract.state, c.snapshot().contract.so], ['live', 0]);
  c.events = []; c.stats.knockdowns = 1;
  c.tick(0.05); c.tick(0.05);
  assert.equal(c.events.filter(e => e.t === 'contractLost').length, 1);
  assert.equal(c.snapshot().contract.state, 'lost');
  // the Hustle reached in time is met at the bell
  c.contract = { mod: { id: 'rain' }, goal: { k: 'hustle', n: 2, by: 30 }, stars: 3 }; c.hustleAt = null; c.mult = 2;
  c.tick(0.05);
  assert.ok(c.hustleAt != null && c.hustleAt < 1);
  c.endShift();
  assert.equal(c.report.contract.met, true);
});

test('#6d: a cosmetic at 3 stars and every 5 after (3, 8, 13, …); the Site 13 jacket by acquisition only', () => {
  assert.deepEqual(COSMETICS.map(c => c.stars), [3, 8, 13, 18, 23, 28, 33, 38, 43, 48]);
  assert.equal(CONTRACT.PER_UNLOCK, 5); assert.equal(CONTRACT.FIRST, 3);
  assert.equal(newlyUnlocked(0, 3).id, 'hat-teal'); assert.equal(newlyUnlocked(3, 7), null); assert.equal(newlyUnlocked(7, 8).id, 'cart-gold');
  assert.ok(!canWear(RIVAL_LOOK.id, 'vest', 1000)); assert.ok(canWear(RIVAL_LOOK.id, 'vest', 0, true));
  assert.ok(unlockedLooks(0, true).some(c => c.id === RIVAL_LOOK.id) && !unlockedLooks(99).some(c => c.id === RIVAL_LOOK.id));
});

// ---- #8 Site 13 ---------------------------------------------------------------------------------------------------
test('#8: Site 13: no race on the Owners\' day 1; F × the last 3 days ± 6 %; 4 of 7 acquires; week 2 is F2 ×', () => {
  assert.equal(rivalTarget(undefined, 20), null, 'day 1: nothing banked as Owners yet');
  for (let d = 1; d < 200; d++) assert.ok(Math.abs(rivalJitter(d)) <= RIVAL.JITTER + 1e-12);
  const r = { week: 1, wins: 0, days: 0, last: [60e6, 70e6, 80e6, 90e6].slice(-3), acquired: 0 };
  const t = rivalTarget(r, 33);
  assert.ok(Math.abs(t / (80e6 * RIVAL.F) - 1 - rivalJitter(33)) < 1e-6);
  assert.ok(Math.abs(rivalTarget({ ...r, week: 2 }, 33) / t - RIVAL.F2 / RIVAL.F) < 1e-9);
  let rv = cleanRival({ last: [70e6] }), acquired = false;
  for (const win of [true, false, true, true, false, false, true]) { const b = rivalBell(rv, 50, win ? 60 : 40); rv = b.rival; acquired = b.acquired; }
  assert.ok(acquired, '4 of 7'); assert.equal(rv.acquired, 1); assert.equal(rv.week, 2); assert.equal(rv.days, 0);
  rv = cleanRival({ last: [1] });
  for (const win of [true, false, true, false, false, true, false]) { const b = rivalBell(rv, 50, win ? 60 : 40); rv = b.rival; acquired = b.acquired; }
  assert.ok(!acquired, '3 of 7 does not'); assert.equal(rv.acquired, 0);
  assert.deepEqual(cleanRival(JSON.parse(JSON.stringify(rv))), rv);
  assert.equal(rivalBell(undefined, null, 5).result, null, 'day 1: the bell only books the cash');
  assert.ok(wordCount(rivalLine({ win: true })) <= 8 && wordCount(rivalLine({ win: false })) <= 8);
  assert.equal(rivalPace(100, {}, 210, 420), 50, 'no curve: linear');
});

test('#8: the server: Site 13 on the Board from day 2, the bell\'s line, the week, the save', () => {
  const c = new Crew('S13', { v: 5, day: 30, venue: 5, endless: true }, { shiftSecs: 120, seed: 3 });
  const p = c.join('A'); c.connect(p);
  c.startShift();
  assert.equal(c.snapshot().rival, undefined, 'no Owners\' day banked: no rival');
  c.stats.cash = 1000; c.endShift();
  assert.equal(c.report.rival, undefined);
  assert.deepEqual(c.records.rival.last, [1000]);
  c.startShift();
  assert.ok(c.rivalT > 1000 * 0.97 && c.rivalT < 1000 * 1.11);
  for (let i = 0; i < 600; i++) c.tick(0.1);
  const s = c.snapshot();
  assert.ok(s.rival && s.rival.est === true && s.rival.cash > 0, 'the Board\'s SITE 13 $… (est.)');
  c.stats.cash = 5000; c.endShift();
  assert.equal(c.report.rival.win, true);
  const back = new Crew('S13', JSON.parse(JSON.stringify(c.toSave())));
  assert.deepEqual(back.records.rival, c.records.rival);
  // a won week: the memo's news, the jacket
  c.records.rival = { week: 1, wins: 4, days: 6, last: [1000, 1000, 1000], acquired: 0 };
  c.startShift(); c.stats.cash = 1; c.endShift();
  assert.equal(c.records.rival.acquired, 1); assert.equal(c.memoNews, 'Site 13 has been acquired. By you.');
  assert.equal(c.snapshot().site13, 1);
  c.input(p, { a: [{ t: 'look', part: 'vest', id: RIVAL_LOOK.id }] });
  assert.equal(c.looks.A?.vest, RIVAL_LOOK.id);
});

// ---- 9.13 ---------------------------------------------------------------------------------------------------------
test('9.13: the Stadium mid beat plays on the encore (boss) morning; one "off the record"', () => {
  assert.equal(midDue({ venue: 3, venueDay: 4, boss: true }), 'mid:3');
  assert.equal(midDue({ venue: 1, venueDay: 4, boss: true }), null, 'the Club boss day still owns its morning');
  assert.ok(!BEAT_BY_ID['mid:3'].cards.some(c => /off the record/i.test(c.line)));
});

test('9.15: Gary\'s Club sign-off after a MOW-E win, once (the caller passes the flag)', async () => {
  const { garyBye, GARY_BYE_MOWE, GARY_BYE } = await import('../web/js/story.js');
  assert.equal(garyBye(1, true), GARY_BYE_MOWE); assert.equal(garyBye(1), GARY_BYE[1]); assert.equal(garyBye(3, true), GARY_BYE[3]);
  assert.ok(wordCount(GARY_BYE_MOWE) <= 8);
});
