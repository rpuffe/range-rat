// Owner playtest 3 §6 (web/js/garyvisit.js, pure): the drive-by, the schedule, the chat, the Seal's line.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GARY } from '../web/js/sim.js';
import { GARY_INTRO, introDue, newIntro, stepIntro, garyNext, garyMorning, garyParked, stepChat, pingStall, stallRoom,
  chatBit, CHAT_BITS, garyPlate, SEAL_LINE, commendFor, CHAT_FEED } from '../web/js/garyvisit.js';
import { PA_LINES } from '../web/js/pa.js';
import { GARY_TEXT, garyExtra, nudgeLine } from '../web/js/nudge.js';
import { wordCount } from '../web/js/say.js';

test('the drive-by: Muni day 4 from 0:20, once; it waves once at the return and leaves by the gate', () => {
  assert.equal(introDue({ day: 4, venue: 0, endless: false, shiftT: 20, voiced: false }), true);
  assert.equal(introDue({ day: 4, venue: 0, endless: false, shiftT: 19, voiced: false }), false);
  assert.equal(introDue({ day: 4, venue: 0, endless: false, shiftT: 30, voiced: true }), false);
  assert.equal(introDue({ day: 5, venue: 0, endless: false, shiftT: 30, voiced: false }), false);
  const it = newIntro(), evs = [];
  for (let t = 0; t < 60 && !it.done; t += 0.1) { const e = stepIntro(it, 0.1); if (e) evs.push(e); }
  assert.deepEqual(evs, ['wave', 'done']);
  const end = GARY_INTRO.ROUTE.at(-1);
  assert.ok(Math.hypot(it.x - end.x, it.z - end.z) < 1e-6);
});

test('visits: day 4, then 2–3 days apart (about 4 in 10), never on a venue day 1', () => {
  let g = garyMorning(null, 1), days = [];
  for (let day = 1; day <= 30; day++) {
    g = garyMorning(g, day, day === 12);   // a promotion: day 12 is the Club's reveal morning
    if (g === day) { days.push(day); g = garyNext(day, 7); }
  }
  assert.equal(days[0], 4);
  for (let i = 1; i < days.length; i++) assert.ok([2, 3].includes(days[i] - days[i - 1]) || days[i] === 13, `${days}`);
  assert.ok(!days.includes(12), 'slips off the venue day 1');
  assert.ok(days.length >= 9 && days.length <= 14, `${days.length} visits in 27 days`);
  // over many seeds the long gap is about 1 in 3
  let long = 0; for (let s = 0; s < 300; s++) long += garyNext(10, s) === 13 ? 1 : 0;
  assert.ok(long > 70 && long < 130, `${long}`);
});

test('an old save without garyDay gets today (from day 4); a missed visit comes today', () => {
  assert.equal(garyMorning(undefined, 9), 9);
  assert.equal(garyMorning(undefined, 2), 4);
  assert.equal(garyMorning(6, 8), 8);
  assert.equal(garyMorning(8, 8, true), 9, 'a reveal morning slips him a day');
});

test('chat: holding within 2.5 m of a parked Gary adds pause; 12 s, then nothing', () => {
  const g = { phase: 'drive', pause: 3, x: 0, z: 0 };
  const rat = { id: 'a', x: 2, z: 0, held: true, down: 0 };
  assert.ok(garyParked(g));
  const ev = stepChat(g, [rat], 0.5);
  assert.deepEqual(ev, [{ t: 'garyChat', by: 'a', on: true }]);
  assert.equal(g.pause, 3.5);
  for (let i = 0; i < 40 && g.chat; i++) { g.pause = Math.max(0.01, g.pause - 0.5); stepChat(g, [rat], 0.5); }
  assert.ok(Math.abs(g.stalled - GARY.STALL_BUDGET) < 1e-9);
  assert.equal(g.chat, null, 'the budget ran out: the chat ended');
  assert.ok(g.pause >= GARY.CHAT_RESUME, 'he waits a second');
  assert.deepEqual(g.spare, ['a']);
});

test('chat: too far, not held, knocked down, or Gary driving: nothing', () => {
  const far = { phase: 'drive', pause: 2, x: 0, z: 0 };
  assert.deepEqual(stepChat(far, [{ id: 'a', x: 3, z: 0, held: true }], 0.1), []);
  assert.deepEqual(stepChat(far, [{ id: 'a', x: 1, z: 0, held: false }], 0.1), []);
  const moving = { phase: 'drive', pause: 0, x: 0, z: 0 };
  assert.deepEqual(stepChat(moving, [{ id: 'a', x: 1, z: 0, held: true }], 0.1), []);
  const warn = { phase: 'warn', t: 30, pause: 0, x: 0, z: 0 };
  stepChat(warn, [{ id: 'a', x: 1, z: 0, held: true }], 1);
  assert.equal(warn.pause, 0, 'the warning is not parked (he waits past the fence)');
  const g = { phase: 'drive', pause: 2, x: 0, z: 0 };
  stepChat(g, [{ id: 'a', x: 1, z: 0, held: true }], 0.1);
  const ev = stepChat(g, [{ id: 'a', x: 1, z: 0, held: true, down: 2 }], 0.1);
  assert.deepEqual(ev, [{ t: 'garyChat', by: 'a', on: false }], 'a knockdown ends it');
});

test('a cart ping after 10 s of chat adds 2 s, not 3', () => {
  assert.equal(pingStall({ stalled: 0 }), GARY.STALL);
  assert.equal(pingStall({ stalled: 10 }), 2);
  assert.equal(pingStall({ stalled: 12 }), 0);
  assert.equal(stallRoom(null), GARY.STALL_BUDGET);
});

test('his bits cycle every 2 s; a 12 s chat is six bits', () => {
  const seen = []; for (let t = 0; t < 12; t += 2) seen.push(chatBit(t));
  assert.equal(seen.length, 6); assert.equal(seen[0], CHAT_BITS[0]); assert.equal(seen[5], CHAT_BITS[0]);
  for (const b of CHAT_BITS) assert.ok(wordCount(b.replace(/…/g, ' ')) <= 3, b);
});

test('the lines: the intro card, the Seal, the chat line, the plate', () => {
  assert.equal(PA_LINES.garyIntro.caption, 'Gary. Regional Manager. He has a clipboard.');
  assert.ok(wordCount(PA_LINES.garyIntro.caption) <= 8);
  assert.equal(SEAL_LINE, 'Gary approves! ×1.25 a ball till the bell.');
  assert.ok(wordCount(SEAL_LINE) <= 8);
  assert.equal(GARY_TEXT.chat, 'Keep Gary talking: hold Ⓐ!');
  assert.equal(nudgeLine(garyExtra('gary:stall', true)), GARY_TEXT.chat);
  assert.equal(nudgeLine(garyExtra('gary:stall', false)), GARY_TEXT.stall);
  assert.equal(garyExtra('gary:sign', true), 'gary:sign');
  assert.equal(garyPlate(true), 'GARY · REGIONAL MANAGER'); assert.equal(garyPlate(false), 'GARY');
  assert.equal(CHAT_FEED, 'You asked Gary about his boat.');
});

test('commendations: 3 with the full huddle, 1 without, capped at 10', () => {
  assert.equal(commendFor({ pass: true, huddle: true, have: 0 }), 3);
  assert.equal(commendFor({ pass: true, huddle: false, have: 0 }), 1);
  assert.equal(commendFor({ pass: true, huddle: true, have: 9 }), 1);
  assert.equal(commendFor({ pass: false, huddle: true, have: 0 }), 0);
});
