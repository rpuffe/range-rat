// Council round 13 #2 (builder 3): one centre text, enforced at the source (web/js/centre.js, pure).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createCentre, PRI, CENTRE, overlapOf } from '../web/js/centre.js';

function rig(opts = {}) {
  let t = 0;
  const dropped = [];
  const c = createCentre({ now: () => t, onDrop: (i, why) => dropped.push([i.id, why]), ...opts });
  const ups = [];   // [t, id] each time the visible item changes
  const run = (to, step = 0.05) => { for (; t < to - 1e-9;) { t = Math.round((t + step) * 1000) / 1000; const v = c.update(); if ((v?.id ?? null) !== (ups.at(-1)?.[1] ?? null)) ups.push([t, v?.id ?? null]); } };
  return { c, run, ups, dropped, set t(v) { t = v; }, get t() { return t; } };
}

test('the ladder: story 0, stamp and ALERT 1, PA 2, memo 3, tips and the checklist 4, toasts 5', () => {
  assert.deepEqual([PRI.STORY, PRI.STAMP, PRI.ALERT, PRI.PA, PRI.MEMO, PRI.TIP, PRI.CHECK, PRI.TOAST], [0, 1, 1, 2, 3, 4, 4, 5]);
  assert.equal(CENTRE.SNAP, 0.15);
});

test('only one item draws: the rest wait their turn, highest first, then first in', () => {
  const r = rig();
  r.c.request({ id: 'toast', pri: PRI.TOAST, secs: 2 });
  r.c.request({ id: 'memo', pri: PRI.MEMO, secs: 2 });
  r.c.request({ id: 'pa', pri: PRI.PA, secs: 2, maxWait: Infinity });
  r.run(10);
  assert.deepEqual(r.ups.filter(u => u[1]).map(u => u[1]), ['pa', 'memo', 'toast']);
  for (let i = 1; i < r.ups.length; i++) if (r.ups[i][1] && r.ups[i - 1][1]) assert.fail('two items back to back with no gap');
});

test('a higher priority snaps the lower one out in 150 ms; a resumable PA plays after with the time it had left', () => {
  const r = rig();
  r.c.request({ id: 'pa', pri: PRI.PA, secs: 6, resume: true });
  r.run(1);
  assert.equal(r.c.up().id, 'pa');
  r.c.request({ id: 'alert', pri: PRI.ALERT, secs: 3 });
  r.run(1.05);
  assert.equal(r.c.up(), null, 'the PA is out at once');
  r.run(1.25);
  assert.equal(r.c.up()?.id, 'alert', 'the ALERT draws after the 150 ms snap');
  r.run(12);
  const back = r.ups.filter(u => u[1] === 'pa');
  assert.equal(back.length, 2, 'the PA comes back');
  assert.equal(r.c.up(), null);
  // a lower one arriving never snaps
  const s = rig();
  s.c.request({ id: 'memo', pri: PRI.MEMO, secs: 3 }); s.run(0.5);
  s.c.request({ id: 'toast', pri: PRI.TOAST, secs: 1.2, ttl: 3 }); s.run(2);
  assert.equal(s.c.up().id, 'memo');
});

test('a snapped item that is not resumable is gone', () => {
  const r = rig();
  r.c.request({ id: 'tip', pri: PRI.TIP, secs: 4, maxWait: Infinity }); r.run(0.5);
  r.c.request({ id: 'memo', pri: PRI.MEMO, secs: 2 }); r.run(6);
  assert.deepEqual(r.ups.filter(u => u[1]).map(u => u[1]), ['tip', 'memo']);
  assert.deepEqual(r.dropped, [['tip', 'snapped']]);
});

test('a tip never queues: it shows now, or not at all', () => {
  const r = rig();
  r.c.request({ id: 'memo', pri: PRI.MEMO, secs: 3 }); r.run(0.5);
  const tip = r.c.request({ id: 'tip', pri: PRI.TIP, secs: 4 });
  assert.equal(tip.state, 'dropped');
  assert.equal(r.c.quiet, false);
  r.run(4);
  assert.equal(r.c.quiet, true);
  const tip2 = r.c.request({ id: 'tip2', pri: PRI.TIP, secs: 4 });
  r.run(4.1);
  assert.equal(tip2.state, 'up');
});

test('the fade finishes before the next item shows', () => {
  const r = rig();
  r.c.request({ id: 'a', pri: PRI.ALERT, secs: 1.5 });
  r.c.request({ id: 'b', pri: PRI.ALERT, secs: 1.5 });
  r.run(5, 0.01);
  const a = r.ups.find(u => u[1] === 'a'), gone = r.ups.find(u => u[1] === null && u[0] > a[0]), b = r.ups.find(u => u[1] === 'b');
  assert.ok(b[0] - gone[0] >= CENTRE.FADE - 1e-6, `b waits out a's ${CENTRE.FADE} s fade`);
  assert.equal(r.c.fading, false);
});

test('a PA waits at most 6 s (while it could show), then its caption goes to the feed', () => {
  const r = rig();
  r.c.request({ id: 'alert', pri: PRI.ALERT, secs: 8 });
  r.c.request({ id: 'pa', pri: PRI.PA, secs: 4 });
  r.run(10);
  assert.deepEqual(r.dropped, [['pa', 'wait']]);
  // a client's rule that holds it (the bell lock) doesn't count as waiting
  let held = true;
  const s = rig({ eligible: i => !(held && i.id === 'pa') });
  s.c.request({ id: 'pa', pri: PRI.PA, secs: 4 });
  s.run(20); assert.deepEqual(s.dropped, []);
  held = false; s.run(21);
  assert.equal(s.c.up()?.id, 'pa');
});

test('busy(pri): anything at that priority or higher up or queued', () => {
  const r = rig();
  r.c.request({ id: 'memo', pri: PRI.MEMO, secs: 3 });
  assert.equal(r.c.busy(PRI.MEMO), true);
  assert.equal(r.c.busy(PRI.PA), false);
  r.run(0.1);
  assert.equal(r.c.busy(PRI.TOAST), true);
  r.run(4);
  assert.equal(r.c.busy(), false);
});

test('a held claim stays until released; an idle line (the checklist) steps aside for anything', () => {
  const r = rig();
  r.c.request({ id: 'check', pri: PRI.CHECK, idle: true, text: 'Bank them at the return' });
  r.run(1);
  assert.equal(r.c.up().id, 'check');
  assert.equal(r.c.busy(), false, 'the standing line is not "busy"');
  r.c.request({ id: 'toast', pri: PRI.TOAST, secs: 1.5 });
  r.run(1.4);
  assert.equal(r.c.up()?.id, 'toast', 'even a toast: the checklist steps aside');
  r.run(5);
  assert.equal(r.c.up()?.id, 'check', 'and comes back');
  r.c.request({ id: 'story', pri: PRI.STORY, hold: true });
  r.run(60);
  assert.equal(r.c.up().id, 'story');
  r.c.release('story'); r.run(61);
  assert.equal(r.c.up()?.id, 'check');
  r.c.release('check'); r.run(62);
  assert.equal(r.c.up(), null);
});

test('the same id updates in place; a forced item (the bell stamp) shows over anything and is never snapped', () => {
  const r = rig();
  const a = r.c.request({ id: 'fries', pri: PRI.TOAST, text: 'Fries (1/6)', secs: 2 }); r.run(0.5);
  r.c.request({ id: 'fries', pri: PRI.TOAST, text: 'Fries (2/6)', secs: 2 });
  assert.equal(r.c.up(), a); assert.equal(a.text, 'Fries (2/6)'); assert.equal(a.v, 1);
  r.c.request({ id: 'stamp', pri: PRI.STAMP, secs: 1.5, force: true });
  assert.equal(r.c.up().id, 'stamp');
  r.c.request({ id: 'story', pri: PRI.STORY, hold: true }); r.run(1);
  assert.equal(r.c.up().id, 'stamp');
});

test('overlapOf: two or more centre elements over 0.3 opacity is an overlap frame', () => {
  assert.equal(overlapOf([{ id: 'memo', opacity: 1 }, { id: 'pa-card', opacity: 0.2 }]), null);
  assert.deepEqual(overlapOf([{ id: 'memo', opacity: 1 }, { id: 'pa-card', opacity: 0.5 }]).map(s => s.id), ['memo', 'pa-card']);
});

// ---- 2b / 2c: the non-text rules (centrehooks.js, payfloat.js) and 8.1 / 8.2 ----------------------------------------
import { washerTipOk, createFightMute, fightMuted, plateFade, PLATE_R } from '../web/js/centrehooks.js';
import { createPayMerge, mergedLine, PAYFLOAT } from '../web/js/payfloat.js';
import { emptyBasketRat } from '../web/js/tips.js';
import { createStoryCard, CARD_GRACE } from '../web/js/storycard.js';
import { createSayModel } from '../web/js/say.js';

test('2b: the washer tip only in a Muni week: hopper empty ≥ 30 s, balls out, nothing 0–3 up, < 1,000 banked', () => {
  const ok = { emptyFor: 31, ballsOut: 12, centreBusy: false, banked: 400 };
  assert.equal(washerTipOk(ok), true);
  assert.equal(washerTipOk({ ...ok, emptyFor: 10 }), false);
  assert.equal(washerTipOk({ ...ok, ballsOut: 0 }), false);
  assert.equal(washerTipOk({ ...ok, centreBusy: true }), false);
  assert.equal(washerTipOk({ ...ok, banked: 25000 }), false, 'never at a late venue');
});

test('2b: pops from one source merge within 1.5 s into "+$X ×k"; at most 2 floats; none while hidden', () => {
  let t = 0, hide = false;
  const jobs = [], out = [];
  const m = createPayMerge(f => out.push(f), { now: () => t, schedule: (fn, ms) => jobs.push({ fn, at: t + ms / 1000 }), hidden: () => hide });
  const flush = to => { t = to; for (const j of jobs.splice(0)) if (j.at <= to) j.fn(); else jobs.push(j); };
  for (let i = 0; i < 7; i++) m.add('me', 7.426, 3);
  flush(1.6);
  assert.equal(out.length, 1);
  assert.equal(mergedLine(out[0], v => '$' + v.toFixed(2)), '+$51.98 ×7');
  m.add('a', 1, 1); m.add('b', 1, 1); m.add('c', 1, 1); flush(3.2);
  assert.equal(out.length, 3, 'three sources at once: only two floats go up');
  hide = true; m.add('me', 5, 1); flush(6);
  assert.equal(out.length, 3, 'hidden while a priority 0–1 item is up');
  assert.equal(PAYFLOAT.MAX_UP, 2);
});

test('2c: the boss mutes the nags from the warn to the stamp, then one summary line', () => {
  const f = createFightMute();
  const fight = { kind: 'boss', phase: 'hunt' };
  assert.equal(fightMuted(fight), true);
  assert.equal(fightMuted({ kind: 'boss', phase: 'tamed' }), false);
  assert.equal(f.step(fight), null);
  assert.equal(f.refuse(fight), true); f.refuse(fight); f.refuse(fight);
  assert.equal(f.step({ kind: 'boss', phase: 'tamed' }), '3 customers left during the fight.');
  assert.equal(f.step({ kind: 'boss', phase: 'tamed' }), null, 'once');
  assert.equal(f.refuse({ kind: 'boss', phase: 'tamed' }), false);
});

test('2b: name plates fade to 0 near the return during the hush only', () => {
  const st = { x: 23, z: 2 };
  assert.equal(plateFade(25, 5, st, true), 0);
  assert.equal(plateFade(23, 2 - PLATE_R - 1, st, true), 1);
  assert.equal(plateFade(25, 5, st, false), 1);
});

test('8.1: an unfinished sign step no longer mutes the empty-basket alarm', () => {
  const c = { phase: 'shift', basket: 0, todo: [{ id: 'pick', done: true }, { id: 'sign', done: false }], players: [{ id: 'a', online: true, x: 0, z: 0 }] };
  assert.equal(emptyBasketRat(c, true, { x: 1, z: 1 }), 'a');
  assert.equal(emptyBasketRat({ ...c, todo: [{ id: 'bank', done: false }] }, true, { x: 1, z: 1 }), null);
});

test('8.2: the first card of a beat takes no press for 1.2 s (the photo card 1.8 s)', () => {
  let t = 0;
  const card = createStoryCard({ sayer: createSayModel({ now: () => t }), now: () => t, tick: 0 });
  card.add('promo:5');
  const first = card.card;
  t = 0.6; card.press();
  assert.equal(card.card, first, 'a double press from the report button is eaten');
  t = CARD_GRACE.FIRST + 0.05; card.press();
  assert.notEqual(card.card, first);
  assert.equal(CARD_GRACE.PHOTO, 1.8);
});

test('council round 14 #0d: the centre zone on screen (inCentreBox)', async () => {
  const { inCentreBox, CENTRE: C } = await import('../web/js/centre.js');
  assert.ok(inCentreBox({ x0: 0.45, x1: 0.55, y0: 0.3, y1: 0.35 }), 'a bubble mid-screen');
  assert.ok(!inCentreBox({ x0: 0.02, x1: 0.15, y0: 0.02, y1: 0.08 }), 'the cash HUD corner');
  assert.ok(!inCentreBox({ x0: 0.4, x1: 0.6, y0: 0.8, y1: 0.9 }), 'low on the screen');
  assert.ok(!inCentreBox(null));
  assert.ok(C.BOX.x0 < 0.5 && C.BOX.x1 > 0.5 && C.BOX.y0 < 0.5 && C.BOX.y1 > 0.5);
});
