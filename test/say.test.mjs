// The one centre-text queue (council round 7 #3): the pure model in web/js/say.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSayModel, wordCount, SAY, KINDS } from '../web/js/say.js';

function model(opts = {}) {
  let t = 0;
  const m = createSayModel({ now: () => t, ...opts });
  const at = s => { t = s; return m.update(); };
  const shown = [];   // every distinct visible item, in order, sampled every 0.05 s
  const run = (to, step = 0.05) => { for (; t < to - 1e-9; ) { t = Math.round((t + step) * 1000) / 1000; const v = m.update(); if (v && shown.at(-1) !== v) shown.push(v); } };
  return { m, at, run, shown, get t() { return t; } };
}

test('wordCount: $1,240 and 3/4 are one word; a bare dot is none', () => {
  assert.equal(wordCount('Bank $1,240 by 3/4 time'), 5);
  assert.equal(wordCount('Day 3 · The Muni'), 4);
  assert.equal(wordCount(''), 0);
  assert.deepEqual(KINDS, ['STAMP', 'ALERT', 'PA', 'MEMO', 'TIP', 'TOAST']);   // council round 13 #2: the centre.js ladder
});

test('two items never show at once: the second waits for the first, then a 0.3 s gap', () => {
  const s = model();
  s.m.say('ALERT', 'Gary in 45 s', { secs: 3.5 });
  s.m.say('TOAST', 'Bought!', { secs: 2.5 });
  assert.equal(s.at(0).text, 'Gary in 45 s');
  assert.equal(s.at(3.4).text, 'Gary in 45 s', 'the visible one is never replaced');
  assert.equal(s.at(3.5), null, 'hidden at 3.5 s');
  assert.equal(s.at(3.7), null, 'the gap');
  assert.equal(s.at(3.81)?.text, undefined, 'the toast is past its 3 s life by now');
  // a toast that arrives while an alert shows, but fresh enough, follows it
  const s2 = model();
  s2.m.say('ALERT', 'A', { secs: 1.5 });
  s2.at(0);
  s2.m.say('TOAST', 'B');
  s2.run(6);
  assert.deepEqual(s2.shown.map(i => i.text), ['A', 'B']);
  assert.ok(s2.shown[1].until - s2.shown[1].secs >= 1.5 + SAY.GAP - 1e-9, 'B starts after the gap');
});

test('STAMP preempts: it shows at once and drops queued alerts, toasts and tips', () => {
  const s = model();
  s.m.say('MEMO', 'Today: 1,123 to go.');
  assert.equal(s.at(0.7).kind, 'MEMO');
  s.m.say('ALERT', 'rally'); s.m.say('TOAST', 'Bought!'); s.m.say('TIP', 'Hold A to pour');
  s.m.say('STAMP', 'APPROVED');
  assert.equal(s.m.visible.text, 'APPROVED');
  assert.deepEqual(s.m.queued.map(i => i.kind), []);
  assert.equal(s.m.dropped, 3);
});

test('a toast queued behind a 6 s PA is dropped, not shown late', () => {
  const s = model();
  s.m.say('PA', 'Gary from Regional is on site.', { secs: 6 });
  s.at(0);
  s.m.say('TOAST', 'Spotless!');
  s.run(10);
  assert.deepEqual(s.shown.map(i => i.kind), ['PA']);
  assert.equal(s.m.dropped, 1);
});

test('the same key updates in place: visible keeps its slot, queued keeps its place', () => {
  const s = model();
  s.m.say('TOAST', 'Fries (1/6)', { key: 'fries' });
  s.at(0);
  const a = s.m.visible;
  s.at(1);
  s.m.say('TOAST', 'Fries (2/6)', { key: 'fries' });
  assert.equal(s.m.visible, a);
  assert.equal(a.text, 'Fries (2/6)');
  assert.equal(a.v, 1);
  assert.ok(a.until >= 1 + SAY.SECS.TOAST - 1e-9, 'its time restarts');
  assert.equal(s.m.queued.length, 0);
  // queued
  s.m.say('ALERT', 'rally one', { key: 'rally' });
  s.m.say('ALERT', 'rally two', { key: 'rally' });
  assert.deepEqual(s.m.queued.map(i => i.text), ['rally two']);
});

test('round 13: a TIP never queues; it fires only after 2 s of quiet (quietFor), or not at all', () => {
  const s = model();
  s.m.say('TOAST', 'Bought!', { secs: 1.2 });
  s.at(0);
  assert.equal(s.m.say('TIP', 'Hold A to pour'), null, 'something is up: the tip is dropped, not queued');
  s.at(1.2);
  s.at(2.5); assert.equal(s.m.quietFor(), false, 'only 1.3 s of quiet');
  s.at(3.25); assert.equal(s.m.quietFor(), true);
  s.m.say('TIP', 'Hold A to pour');
  assert.equal(s.at(3.3)?.kind, 'TIP');
  // and a tip past its 60 s life is dropped
  const s2 = model();
  s2.m.say('PA', 'x', { secs: 70 }); s2.at(0);
  assert.equal(s2.m.say('TIP', 'old tip'), null);
  s2.run(75, 0.5);
  assert.deepEqual(s2.shown.map(i => i.kind), ['PA']);
});

test('the bell lock: only the stamp shows; PA and MEMO wait until the report closes', () => {
  const s = model();
  s.m.say('TOAST', 'Bought!'); s.at(0);
  s.m.bell();
  assert.equal(s.m.visible, null, 'the visible toast goes at the bell');
  assert.equal(s.m.say('ALERT', 'late rally'), null, 'dropped under the lock');
  s.m.say('PA', 'A record shift.', { secs: 4 });
  s.m.say('MEMO', 'Tomorrow');
  s.at(0.45);
  s.m.say('STAMP', 'DENIED');
  s.run(4);
  assert.deepEqual(s.shown.map(i => i.kind), ['STAMP']);
  s.m.report();
  s.m.say('TOAST', 'Signed (1 of 4)');
  s.run(8);
  assert.deepEqual(s.shown.map(i => i.kind), ['STAMP', 'TOAST'], 'the report card is open: feedback shows, PA and MEMO still wait');
  s.m.open();
  s.run(20);
  assert.deepEqual(s.shown.map(i => i.kind), ['STAMP', 'TOAST', 'PA', 'MEMO']);
});

test('a memo settles 0.6 s, so the PA line a tick later still goes first', () => {
  const s = model();
  s.m.say('MEMO', 'Today: 1,123 to go.');
  s.at(0.1);
  s.m.say('PA', 'Good morning, Range Rats.', { secs: 4 });
  s.run(12);
  assert.deepEqual(s.shown.map(i => i.kind), ['PA', 'MEMO']);
});

test('order: kind first, then first in, first out', () => {
  const s = model();
  s.m.say('TOAST', 't1'); s.m.say('ALERT', 'a1'); s.m.say('MEMO', 'm1', { secs: 1.2 }); s.m.say('ALERT', 'a2', { secs: 1.2 }); s.m.say('PA', 'p1', { secs: 1.2 });
  s.run(12);
  assert.deepEqual(s.shown.map(i => i.text), ['a1', 'a2', 'p1', 'm1'], 't1 is stale by the time its turn comes (round 13: ALERT outranks PA)');
});

test('every item shows at least 1.2 s; dev warns once on a line over 8 words', () => {
  const warned = [];
  const s = model({ warn: (text, n) => warned.push(n) });
  const i = s.m.say('TOAST', 'one two three four five six seven eight nine', { secs: 0.2 });
  s.m.say('TOAST', 'one two three four five six seven eight nine');
  assert.equal(i.secs, SAY.MIN_SHOW);
  assert.deepEqual(warned, [9]);
});

// Main session, council round 10: on a fresh save a debut memo and a PA card could share the screen. The DOM adapter
// now keeps what is physically up and takes everything else down before anything shows.
import { createSay } from '../web/js/say.js';
function fakeDom() {
  const els = {};
  const el = id => (els[id] ??= { id, textContent: '', cls: new Set(id === 'memo' ? ['hidden'] : []), classList: { toggle(c, on) { on ? this.o.cls.add(c) : this.o.cls.delete(c); }, contains(c) { return this.o.cls.has(c); } } });
  const $ = id => { const e = el(id); e.classList.o = e; return e; };
  return { $, memoUp: () => !el('memo').cls.has('hidden') };
}
test('the adapter: a memo and a PA card are never up together (debut memo + debut PA, any order, a hold)', () => {
  let t = 0;
  const dom = fakeDom();
  let card = null;   // the PA card's caption while it is on
  const pa = (text, secs) => ({ secs, data: { show: () => { card = text; }, hide: () => { if (card === text) card = null; } } });
  const s = createSay({ $: dom.$, now: () => t, tick: 0 });
  const both = [];
  const run = to => { for (; t < to; t = Math.round((t + 0.05) * 1000) / 1000) { s.sync(); if (card && dom.memoUp()) both.push(t); } };
  s.say('MEMO', 'NEW: the gold ball.', { secs: 5 });
  s.say('PA', 'A gold ball. It belongs to Corporate.', pa('gold', 6));
  run(3);
  assert.equal(card, 'gold', 'the PA outranks the memo from the same tick');
  s.say('MEMO', 'NEW: the square ball.', { secs: 5 });
  s.say('PA', 'A square ball. It does not roll.', pa('square', 4));
  run(30);
  assert.deepEqual(both, []);
  assert.equal(card, null); assert.equal(dom.memoUp(), false);
  // A PA card that is still up (its hide was lost) comes down before a memo shows.
  s.say('PA', 'stuck', { secs: 2, data: { show: () => { card = 'stuck'; }, hide: () => {} } });
  run(31);
  assert.equal(card, 'stuck');
  s.say('MEMO', 'Today: 1,123 to go.', { secs: 3 });
  s.up.forEach(i => { if (i.kind === 'PA') i.data.hide = () => { card = null; }; });
  run(40);
  assert.deepEqual(both, []);
  s.stop();
});

test('hold (the Deck Cam): a queued PA card and memo wait for the cut; hold(0) lets them go', () => {
  let t = 0;
  const m = createSayModel({ now: () => t });
  m.hold(2.6);
  m.say('PA', 'A guest fell. Beer is not a ladder.', { secs: 4 });
  m.say('TOAST', 'Bought!');
  assert.equal(m.update()?.kind, 'TOAST', 'feedback still shows');
  t = 2.0; m.update(); assert.ok(m.held);
  assert.notEqual(m.visible?.kind, 'PA');
  t = 2.55; m.update(); t = 3.0; assert.equal(m.update()?.kind, 'PA', 'the card after the cut (and the toast and the gap)');
  const m2 = createSayModel({ now: () => t });
  m2.hold(2.6); m2.say('MEMO', 'x'); t += 1; m2.update(); assert.equal(m2.visible, null);
  m2.hold(0); assert.equal(m2.update()?.kind, 'MEMO', 'skipped: it goes at once');
});
