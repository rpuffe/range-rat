// Council round 14 #0b (builder 4): the hooks this round's items need. design/round16-polish.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memoSecond, shopVday, shopDay } from '../web/js/sim.js';
import { reportRowsHtml } from '../web/js/recap.js';
import { Crew } from '../server/crew.mjs';
import { MODULES, HOOKS, REPORT_ROWS, checkModule } from '../server/venues/index.mjs';

test('memoSecond: an event beats the NEW line, which goes to lost (it floats NEW ×1.5)', () => {
  assert.deepEqual(memoSecond({ event: 'E', kindNew: 'NEW: k', flavor: 'f' }), { today: null, line: 'E', lost: 'NEW: k' });
  assert.deepEqual(memoSecond({ event: 'E', venueNew: 'NEW: v' }), { today: null, line: 'E', lost: 'NEW: v' });
  assert.deepEqual(memoSecond({ event: 'E', today: 'Windy.' }), { today: null, line: 'E', lost: null }, "Today's chip stays on the Board");
  assert.equal(memoSecond({ event: 'E', news: 'N' }).line, 'N', 'news still wins');
  assert.equal(memoSecond({ event: 'E', contract: 'Contract: x.' }).line, 'Contract: x.');
});

test('memoSecond: with no event nothing changes (the seam goldens hold)', () => {
  for (const a of [{ kindNew: 'NEW: k', flavor: 'f' }, { today: 'T', kindNew: 'k' }, { mowe: 'm', note: 'n' }, { flavor: 'f' }, {}]) {
    assert.deepEqual(memoSecond({ ...a, event: null }), memoSecond(a));
  }
});

test('shopVday: the coming venue day overnight AND in the lobby (B #4)', () => {
  assert.equal(shopVday('report', 3), 4);
  assert.equal(shopVday('lobby', 3), 4, 'in the lobby venueDay has not incremented yet');
  assert.equal(shopVday('shift', 3), 3);
  assert.equal(shopDay('lobby', 4), 4, 'the global day is already the coming day in the lobby');
});

test('memoEvent: set in a module startShift, shown the same morning, cleared after', () => {
  const mod = checkModule({ id: 'evtest', venue: 0, startShift(crew) { if (crew.day === 2) crew.memoEvent = 'Test event today.'; } });
  const crew = new Crew('MEMO', null, { seed: 7, modules: [...MODULES, mod] });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  const memo1 = crew.events.find(e => e.t === 'memo'); crew.events = [];
  assert.notEqual(memo1?.flavor, 'Test event today.');
  crew.endShift(); crew.events = [];
  crew.startShift();
  const memo2 = crew.events.find(e => e.t === 'memo');
  assert.equal(memo2.day, 2); assert.equal(memo2.flavor, 'Test event today.');
  assert.equal(crew.memoEvent, null, 'one morning only');
});

test('reportRows: a hook; at most REPORT_ROWS from the modules, in order; blanks dropped; on report.rows', () => {
  assert.ok(HOOKS.includes('reportRows')); assert.equal(REPORT_ROWS, 2);
  const a = checkModule({ id: 'rowa', venue: 0, reportRows: () => [{ text: '' }, { text: 'A row · +$5', cash: 5 }] });
  const b = checkModule({ id: 'rowb', venue: 0, reportRows: () => [{ text: 'B row' }, { text: 'C row' }] });
  const crew = new Crew('ROWS', null, { seed: 7, modules: [...MODULES, a, b] });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift(); crew.endShift();
  assert.deepEqual(crew.report.rows, [{ text: 'A row · +$5', cash: 5 }, { text: 'B row' }]);
  const plain = new Crew('ROW0', null, { seed: 7 }); plain.connect(plain.join('A')); plain.startShift(); plain.endShift();
  assert.equal('rows' in plain.report, false, 'no module rows: the report object is unchanged (the goldens)');
});

test('reportRowsHtml: escaped, ≤ 2, cash only when the text has no $', () => {
  const h = reportRowsHtml([{ text: 'Gold Rush: 3 of 4 · +$214', cash: 214 }, { text: 'Poached <b>', cash: -50 }, { text: 'third' }]);
  assert.equal((h.match(/class="modrow"/g) ?? []).length, 2);
  assert.ok(!h.includes('<b>+$214'), 'the text already says the cash');
  assert.ok(h.includes('&lt;b&gt;') && h.includes('−$50'));
  assert.equal(reportRowsHtml(undefined), '');
});

test('calls.mjs #0c: answered per kind, never above offered; a module tags answer:', async () => {
  const { CallTally, eventAnswer } = await import('../scripts/bots/calls.mjs');
  assert.equal(eventAnswer({ t: 'tourney', phase: 'take' }), 'member');
  assert.deepEqual(eventAnswer({ t: 'goldrush', answer: 'gold', n: 2 }), ['gold', 2]);
  assert.equal(eventAnswer({ t: 'inspect', phase: 'done', bagged: 0 }), null, 'met means a hazard bagged');
  const c = new CallTally(1);
  const crew = { phase: 'shift', venue: 1, venueDay: 4, day: 9, events: [], working: () => false };
  crew.events = [{ t: 'tourney', phase: 'flight', call: 'member', n: 3 }]; c.step(crew, 1);
  crew.events = [{ t: 'tourney', phase: 'take' }, { t: 'tourney', phase: 'take' }]; c.step(crew, 1);
  crew.events = [{ t: 'deckTab', order: true }]; c.step(crew, 58);   // an order poured with none offered: not counted
  const rec = c.endShift(crew);
  assert.equal(rec.n, 3); assert.equal(rec.ans, 2); assert.deepEqual(rec.answered, { member: 2 });
  assert.equal(rec.ansPerMin, 2);
});
