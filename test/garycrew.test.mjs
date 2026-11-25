// Owner playtest 3 §6 against the real Crew: the drive-by, the schedule, chatting, Gary's Seal, the wand on boarding.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { GARY, SIM } from '../web/js/sim.js';
import { GARY_INTRO } from '../web/js/garyvisit.js';

function make(save = { day: 5 }, seed = 5) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('GARY', { voiced: ['welcome', 'gary'], ...save }, { shiftSecs: 200, seed, now: () => clock.t });
  const p = crew.join('Al'); crew.connect(p);
  const tick = (dt = 0.05) => { clock.t += dt * 1000; crew.tick(dt); };
  return { crew, p, tick, clock };
}
const quiet = crew => { for (const m of crew.mats) m.next = 1e9; for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0; };
function toWarn(m) {
  m.crew.startShift(); quiet(m.crew);
  m.crew.shiftT = m.crew.shiftSecs * GARY.AT; m.tick();
  assert.equal(m.crew.gary?.phase, 'warn');
}
// Run him to a verdict with everyone at the return (the full huddle) or not.
function toVerdict(m, huddle) {
  const g = m.crew.gary; g.t = 0; m.tick();
  m.p.x = huddle ? SIM.STAND.x : -30; m.p.z = huddle ? SIM.STAND.z : 40; m.p.movedAt = m.clock.t;
  for (let i = 0; i < 4000 && m.crew.gary.phase !== 'done'; i++) { quiet(m.crew); m.p.movedAt = m.clock.t; m.tick(0.1); }
  return m.crew.events;
}

test('the intro drive-by fires once ever on Muni day 4 at 0:20, with the PA', () => {
  const m = make({ day: 4 });
  m.crew.startShift(); quiet(m.crew);
  m.crew.shiftT = GARY_INTRO.AT - 0.5; m.tick();
  assert.equal(m.crew.garyIntro, null);
  m.crew.events.length = 0;
  m.crew.shiftT = GARY_INTRO.AT; m.tick();
  assert.ok(m.crew.garyIntro && !m.crew.garyIntro.done);
  assert.ok(m.crew.events.some(e => e.t === 'pa' && e.id === 'garyIntro'));
  assert.ok(m.crew.snapshot().garyIntro);
  let waved = false;
  for (let i = 0; i < 400 && !m.crew.garyIntro.done; i++) { m.tick(0.1); waved ||= m.crew.events.some(e => e.t === 'garyIntro'); }
  assert.ok(m.crew.garyIntro.done && waved);
  assert.equal(m.crew.snapshot().garyIntro, null);
  assert.ok(m.crew.voiced.has('garyIntro'));
});

test('the day-3 tomorrow line, and a visit eve line', () => {
  const m = make({ day: 3 });
  m.crew.startShift(); m.crew.shiftT = m.crew.shiftSecs; m.tick();
  assert.equal(m.crew.report.tomorrow, 'Tomorrow: Gary from Regional. Clean, then huddle.');
});

test('visits on day 4, then 2–3 days apart; the memo and the eve line follow the schedule; the save keeps garyDay', () => {
  const m = make({ day: 4, voiced: ['welcome', 'gary', 'garyIntro'] }, 11);
  const visits = [];
  for (let d = 0; d < 20; d++) {
    m.crew.events.length = 0;
    m.crew.startShift(); quiet(m.crew);
    const memo = m.crew.events.find(e => e.t === 'memo');
    if (m.crew.garyToday()) { visits.push(m.crew.day); assert.match(memo.text, /^Gary visits today\./); }
    else assert.doesNotMatch(memo.text ?? '', /Gary/);
    if (m.crew.garyToday()) { m.crew.shiftT = m.crew.shiftSecs * GARY.AT; m.tick(); toVerdict(m, true); }
    else { m.crew.shiftT = m.crew.shiftSecs * GARY.AT + 1; m.tick(); assert.equal(m.crew.gary, null, 'no Gary on an off day'); }
    m.crew.shiftT = m.crew.shiftSecs; m.tick();
    if (m.crew.garyDay === m.crew.day + 1) assert.equal(m.crew.report.tomorrow, 'Tomorrow: Gary visits. Clean, then huddle.');
    assert.equal(m.crew.toSave().garyDay, m.crew.garyDay);
  }
  assert.equal(visits[0], 4);
  for (let i = 1; i < visits.length; i++) assert.ok([2, 3].includes(visits[i] - visits[i - 1]), `${visits}`);
});

test('an old save without garyDay gets its next inspection', () => {
  const m = make({ day: 9 });
  assert.equal(m.crew.garyDay, null);
  m.crew.startShift();
  assert.equal(m.crew.garyDay, 9); assert.ok(m.crew.garyToday());
});

test('chatting: Ⓐ held within 2.5 m of a parked Gary adds pause; it shares the 12 s budget with pings', () => {
  const m = make(); toWarn(m);
  const g = m.crew.gary; g.t = 0; m.tick(); g.pause = 2;   // parked at a stop
  m.p.x = g.x + 2; m.p.z = g.z; m.crew.input(m.p, { a: [{ t: 'chat', on: true }] });
  m.crew.events.length = 0;
  for (let i = 0; i < 20; i++) m.tick(0.05);
  assert.ok(m.crew.events.some(e => e.t === 'garyChat' && e.on && e.by === m.p.id));
  assert.ok(Math.abs(g.pause - 2) < 1e-6, 'his pause holds while you talk');
  assert.ok(Math.abs(g.stalled - 1) < 1e-6);
  assert.equal(m.crew.snapshot().gary.chat, m.p.id);
  m.crew.input(m.p, { a: [{ t: 'chat', on: false }] }); m.tick(0.05);
  assert.equal(g.chat, null);
  assert.ok(g.pause >= GARY.CHAT_RESUME, '"Right, then.": he waits a second');
});

test('a chat ends on a knockdown; chat while he drives does nothing', () => {
  const m = make(); toWarn(m);
  const g = m.crew.gary; g.t = 0; m.tick(); g.pause = 0;
  m.p.x = g.x + 1; m.p.z = g.z; m.crew.input(m.p, { a: [{ t: 'chat', on: true }] });
  const before = g.stalled ?? 0; m.tick(0.05);
  assert.equal(g.stalled ?? 0, before, 'driving: no chat');
});

test('a pass with the full huddle: the Seal (×1.25 a ball, Upkeep unchanged) and 3 commendations; without: 1, no Seal', () => {
  const m = make(); toWarn(m);
  const up0 = m.crew.valueNow().upkeep, bv0 = m.crew.valueNow().bv;
  const ev = toVerdict(m, true).find(e => e.t === 'verdict');
  assert.equal(ev.seal, GARY.SEAL); assert.equal(ev.gained, 3);
  assert.equal(m.crew.seal, 1.25);
  const v = m.crew.valueNow();
  assert.equal(v.seal, 1.25); assert.ok(Math.abs(v.upkeep - up0) < 1e-3, 'Upkeep untouched (commendations move BV, the Seal does not)');
  const cash0 = m.crew.cash; m.crew.bank(4, m.p.id);
  const paid = m.crew.cash - cash0;
  assert.ok(m.crew.stats.sealCash > 0 && Math.abs(m.crew.stats.sealCash - paid * 0.2) < 0.02, `${m.crew.stats.sealCash} of ${paid}`);
  m.crew.shiftT = m.crew.shiftSecs; m.tick();
  assert.ok(m.crew.report.sealCash > 0);
  m.crew.startShift();
  assert.equal(m.crew.seal, 1, 'the Seal resets each morning');
  const n = make(); toWarn(n);
  const e2 = toVerdict(n, false).find(e => e.t === 'verdict');
  assert.equal(e2.huddle, false); assert.equal(e2.gained, 1); assert.equal(e2.seal, undefined); assert.equal(n.crew.seal, 1);
});

test('climbing into the cart puts the wand back', () => {
  const m = make({ day: 5, up: { cart: 1 } });
  m.crew.startShift(); quiet(m.crew);
  const c = m.crew.carts[0]; assert.ok(c);
  m.p.wand = true; m.p.x = c.x; m.p.z = c.z;
  assert.ok(m.crew.board(m.p));
  assert.equal(m.p.wand, false);
});
