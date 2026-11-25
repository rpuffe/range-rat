// Playthrough 4 (design/playtest-round4.md): Ball No. 1 before a full pocket (C1), Gary's lines true for the whole
// visit (A12 parked stalls, A13 stop lines until inspected, A14 hysteresis), tips on a carried-over day (A15), a bought
// item's tip first (A16), and solo Gary (A18).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { actPick } from '../web/js/actpick.js';
import { tipsAllowed } from '../web/js/tips.js';
import { nextHint, createHinter, hintText, HINT_GAP, BOUGHT_HINT, EARLY_HINTS } from '../web/js/settings.js';
import { GARY_LINE_HOLD } from '../web/js/nudge.js';
import { wordCount } from '../web/js/say.js';
import { GARY, activeMats } from '../web/js/sim.js';

function makeCrew(save, n = 2, shiftSecs = 200) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('PT4A', { voiced: ['welcome', 'gary'], ...save }, { shiftSecs, seed: 5, now: () => clock.t });
  const rats = [];
  for (let i = 0; i < n; i++) { const p = crew.join('R' + i); crew.connect(p); rats.push(p); }
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  const step = (secs = 0.05) => { for (let t = 0; t < secs - 1e-9; t += 0.05) { clock.t += 50; crew.tick(0.05); } crew.flush(); };
  const nudges = () => crew.snapshot().mods?.nudge ?? {};
  const mats = v => { for (const k of Object.keys(crew.fixtures)) if (k.startsWith('mat')) crew.fixtures[k] = v; };
  return { crew, rats, step, nudges, mats };
}
const toWarn = m => { m.crew.shiftT = m.crew.shiftSecs * GARY.AT - 0.01; m.step(0.1); assert.equal(m.crew.gary?.phase, 'warn'); };

// ---- C1 ------------------------------------------------------------------------------------------------------------
test('C1: Ball No. 1 is picked up with a full pocket; other balls still say "Full"', () => {
  const one = { id: 9, kind: 'one' }, range = { id: 3, kind: 'range' };
  assert.deepEqual(actPick({ near: one, carrying: 25, pocket: 25 }), { grab: one }, 'full pocket: Ball No. 1 anyway');
  assert.deepEqual(actPick({ near: one, carrying: 25, pocket: 25, scoop: true }), { grab: one }, 'the push picker too');
  assert.deepEqual(actPick({ near: range, carrying: 25, pocket: 25 }), { full: true });
  assert.deepEqual(actPick({ near: null, carrying: 25, pocket: 25 }), { full: true });
  assert.deepEqual(actPick({ near: range, carrying: 3, pocket: 25 }), { grab: range });
  assert.equal(actPick({ near: range, carrying: 3, pocket: 25, scoop: true }), null, 'the scoop picks by rolling');
  assert.equal(actPick({ near: one, carrying: 0, pocket: 25, holdingOne: true }), null);
  // and the server takes it from a full pocket
  const m = makeCrew({ day: 5 }, 1);
  const [a] = m.rats;
  a.pocket = 25;
  const b = m.crew.addBall({ x: a.x + 0.3, y: 0.02, z: a.z, vx: 0, vy: 0, vz: 0, kind: 'one' });
  b.rest = true;
  assert.equal(m.crew.pickup(a, b.id), true);
  assert.equal(a.one, true);
});

// ---- A12 -----------------------------------------------------------------------------------------------------------
function shootGary(m, by) {
  const g = m.crew.gary;
  const b = m.crew.addBall({ x: g.x, y: 1, z: g.z - 0.4, vx: 0, vy: 0, vz: 12, kind: 'range' });
  b.by = by;
  m.crew.events.length = 0;
  m.crew.tick(0.05);   // no flush: read the events
  const e = m.crew.events.find(o => o.t === 'enthusiasm');
  m.crew.balls.clear();
  return e;
}
test('A12: pings while he is parked in the warning stall him, still 3 a visit', () => {
  const m = makeCrew({ day: 5 });
  for (const k of Object.keys(m.crew.fixtures)) m.crew.fixtures[k] = 0;
  toWarn(m);
  const g = m.crew.gary;
  assert.equal(shootGary(m, m.rats[0].id)?.stall, 1);
  assert.equal(shootGary(m, m.rats[0].id)?.stall, 2);
  assert.equal(g.phase, 'warn');
  assert.ok(g.pause >= 2 * GARY.STALL - 1e-9, 'banked for the drive');
  g.t = 0; m.step(0.05); assert.equal(g.phase, 'drive');
  assert.equal(shootGary(m, m.rats[0].id)?.stall, 3);
  const e = shootGary(m, m.rats[0].id);
  assert.ok(e && e.stall === undefined, 'the cap is per visit, warning included');
  assert.equal(g.stalls, GARY.STALLS);
});

// ---- A13 -----------------------------------------------------------------------------------------------------------
test('A13: at each stop only the lines for stops he has inspected go', () => {
  const m = makeCrew({ day: 5 });
  const [a, b] = m.rats;
  a.x = 14; a.z = 12; b.x = 0; b.z = 2;
  m.crew.fixtures.sign = 0.9; m.crew.fixtures.stand = 0; m.mats(0.9);
  toWarn(m);
  assert.deepEqual(m.nudges(), { [a.id]: 'gary:sign', [b.id]: 'gary:mats' });
  m.crew.gary.t = 0;
  for (let i = 0; i < 2000 && !(m.crew.gary.checks?.length > 0); i++) m.step(0.1);
  assert.equal(m.crew.gary.checks[0].stop, 'sign');
  m.step(0.1);
  assert.equal(m.nudges()[b.id], 'gary:mats', 'the mats still fail and he has not been there: the line stays');
  assert.equal(m.nudges()[a.id], 'gary:stall', 'the sign was inspected: that line goes');
  for (let i = 0; i < 2000 && !m.crew.gary.checks.some(c => c.stop === 'mats'); i++) m.step(0.1);
  m.step(0.1);
  assert.notEqual(m.nudges()[b.id], 'gary:mats', 'inspected (and failed): the mats line goes too');
});

// ---- A14 -----------------------------------------------------------------------------------------------------------
test('A14: a stall/meet line switches only after 3 s stable; "meet" only when nobody holds a stop line', () => {
  const m = makeCrew({ day: 5 }, 3);
  const [a, b, c] = m.rats;
  a.x = 14; a.z = 12; b.x = 0; b.z = 2; c.x = 30; c.z = 30;
  for (const k of Object.keys(m.crew.fixtures)) m.crew.fixtures[k] = 0;
  m.crew.fixtures.sign = 0.9;
  toWarn(m);
  assert.equal(m.nudges()[a.id], 'gary:sign');
  assert.equal(m.nudges()[b.id], 'gary:stall');
  // The sign passes but isn't Spotless: nothing fails, but a still holds a stop line, so the extras still stall.
  m.crew.fixtures.sign = GARY.CLEAN - 0.01; m.step(4);
  assert.equal(m.nudges()[a.id], 'gary:sign');
  assert.equal(m.nudges()[b.id], 'gary:stall', 'no "meet" while a Rat still holds a stop line');
  // Spotless: a's line goes (a takes meet at once), the extras switch only after GARY_LINE_HOLD s.
  m.crew.fixtures.sign = 0; m.step(0.1);
  assert.equal(m.nudges()[a.id], 'gary:meet', 'a new extra line is immediate');
  assert.equal(m.nudges()[b.id], 'gary:stall', 'a switch waits');
  // Flip the want back and forth faster than the hold: the line never flips.
  let flips = 0, last = m.nudges()[b.id];
  for (let i = 0; i < 6; i++) {
    m.crew.fixtures.sign = i % 2 ? 0 : 0.9;   // fails, then Spotless again, 1.5 s each
    for (let k = 0; k < 15; k++) { m.step(0.1); const v = m.nudges()[b.id]; if (v !== last && v?.startsWith('gary:') && !['gary:sign', 'gary:mats'].includes(v)) flips++; last = v; }
  }
  assert.ok(flips <= 1, `stall/meet flips under the hold: ${flips}`);
  m.crew.fixtures.sign = 0;
  m.step(GARY_LINE_HOLD + 0.3);
  assert.equal(m.nudges()[b.id], 'gary:meet');
  assert.equal(m.nudges()[c.id], 'gary:meet');
});

// ---- A15 -----------------------------------------------------------------------------------------------------------
test('A15: tips play on a carried-over day (a finished checklist), not while a step is open', () => {
  const base = { phase: 'shift', mods: {} };
  assert.equal(tipsAllowed({ ...base, todo: null }, 'me'), true);
  assert.equal(tipsAllowed({ ...base, todo: [{ id: 'pick', done: true }, { id: 'bank', done: true }] }, 'me'), true, 'a carried-over day 2');
  assert.equal(tipsAllowed({ ...base, todo: [{ id: 'pick', done: true }, { id: 'bank', done: false }] }, 'me'), false);
  assert.equal(tipsAllowed({ ...base, todo: null, mods: { nudge: { me: 'hose' } } }, 'me'), false, 'my nudge line holds the slot');
  assert.equal(tipsAllowed({ ...base, todo: null, mods: { orbit: { r: { me: [1, 2] } } } }, 'me'), false, 'up the Lift');
  assert.equal(tipsAllowed({ phase: 'report', todo: null }, 'me'), false);
});

// ---- A16 -----------------------------------------------------------------------------------------------------------
test('A16: a just-bought item\'s tip jumps the queue and the gap; early tips are short and Muni days 1-2 only', () => {
  const seen = ['shop', 'sprint', 'cctv'];
  // The mud tip is due first in HINT_ORDER, and a tip just played: the bought one still goes first.
  const ctx = { seen, playSecs: 100, day: 4, matMudMax: 0.95, up: { washer: 1 }, sinceLast: 1 };
  assert.equal(nextHint(ctx), null, 'inside the gap, nothing');
  assert.equal(nextHint({ ...ctx, bought: 'crank' }), 'crank', 'the bought item jumps the gap and the order');
  assert.equal(nextHint({ ...ctx, sinceLast: HINT_GAP, bought: null }), 'mud');
  assert.equal(nextHint({ ...ctx, bought: 'crank', seen: [...seen, 'crank'] }), null, 'still once ever');
  // The hinter: a purchase shows its tip on the next tick, well inside 3 s.
  const shown = [], h = createHinter({ storage: { getItem: () => null, setItem: () => {} } });
  const tick = up => h.tick(0.1, { playing: true, day: 4, cash: 50, up, show: (t, id) => shown.push({ id }) });
  for (let i = 0; i < 200; i++) tick({});
  const before = shown.length;
  h.bought('shed'); tick({ shed: 1 });
  assert.equal(shown.length, before + 1);
  assert.equal(shown.at(-1).id, 'shed');
  assert.equal(BOUGHT_HINT.washer, 'crank');
  // Early tips: 8 words or fewer, shown only on the Muni's days 1-2.
  for (const id of EARLY_HINTS) for (const pad of [false, true]) assert.ok(wordCount(hintText(id, pad)) <= 8, `${id}: ${hintText(id, pad)}`);
  assert.equal(nextHint({ seen: [], playSecs: 100, cash: 50, day: 2, venue: 0 }), 'shop');
  assert.equal(nextHint({ seen: [], playSecs: 100, cash: 50, day: 3, venue: 0 }), null, 'day 3: no shop/sprint tips');
  assert.equal(nextHint({ seen: ['shop', 'sprint'], playSecs: 100, cash: 50, day: 1, venue: 1 }), 'cctv', 'the Club: CCTV, not the early ones');
  assert.equal(nextHint({ seen: [...seen], playSecs: 100, day: 2, venue: 0 }), 'bv');
  assert.equal(nextHint({ seen: [...seen], playSecs: 100, day: 4, venue: 0 }), null, 'no bv tip past day 2');
});

// ---- A18 -----------------------------------------------------------------------------------------------------------
test('A18: solo Gary warns for 60 s and inspects only the two muddiest mats in play', () => {
  const m = makeCrew({ day: 5 }, 1);
  for (const k of Object.keys(m.crew.fixtures)) m.crew.fixtures[k] = 0;
  const n = activeMats(1);
  m.crew.fixtures.mat0 = 0.9; m.crew.fixtures.mat1 = 0.8;
  for (let i = 2; i < n; i++) m.crew.fixtures['mat' + i] = 0.3;   // passing, but over the 80% rule's slack
  toWarn(m);
  const g = m.crew.gary;
  assert.ok(Math.abs(g.t - GARY.SOLO_WARN) < 0.2, `warning ${g.t}`);
  assert.equal(GARY.SOLO_WARN, 60);
  assert.deepEqual(g.mats, ['mat0', 'mat1']);
  assert.equal(m.crew.inspectBase('mats'), false, 'his two mats are filthy');
  m.crew.fixtures.mat0 = 0; m.crew.fixtures.mat1 = 0.2;
  for (let i = 2; i < n; i++) m.crew.fixtures['mat' + i] = 0.6;   // the rest got muddy: not his business
  assert.equal(m.crew.inspectBase('mats'), true, 'only his two count');
  // A crew of two: the old rule, the 45 s warning.
  const m2 = makeCrew({ day: 5 }, 2);
  toWarn(m2);
  assert.ok(Math.abs(m2.crew.gary.t - GARY.WARN_SECS) < 0.2);
  assert.equal(m2.crew.gary.mats, undefined);
});
