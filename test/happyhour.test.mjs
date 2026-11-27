// Council round 14 #2 (builder 2): Happy Hour on the Tiered deck, the Members' Bell's bonus one (3a), the solo bowls read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { MAP } from '../web/js/map.js';
import { RETURN } from '../web/js/layout.js';
import { DECK, newDeck, happyFill, openOrders, openCount, tabFor, stepDeck } from '../web/js/deck.js';
import { HAPPY, happyDay, happyTime, happyN, happyBallSecs, greenSpots, bonusClear, happyLine, happyRow } from '../web/js/happyhour.js';
import { BELL } from '../web/js/landmarks.js';
import { bowlsEase, bowlsPass } from '../web/js/rally.js';
import { endWindows } from '../web/js/dayend.js';
import { eventCall } from '../scripts/bots/calls.mjs';
import happyhour from '../server/venues/happyhour.mjs';
import { MODULES, checkModule } from '../server/venues/index.mjs';

test('happyDay / happyTime: every Tiered shift but Promotion Day, at T-4:00 for 60 s', () => {
  assert.equal(happyDay({ venue: 2 }), true);
  for (const o of [{ venue: 1 }, { venue: 3 }, { venue: 2, endless: true }, { venue: 2, promo: true }]) assert.equal(happyDay(o), false, JSON.stringify(o));
  assert.equal(happyTime(420), 180);
  assert.equal(happyTime(420, 1), 90, 'solo: T-5:30, clear of the bowls rally');
  assert.equal(HAPPY.SECS, 60);
  assert.equal(happyTime(90), null, 'a short test shift has none');
});

test('happyFill: the queue fills to 3 at once, every open order is a Happy Hour order and pays x1.5', () => {
  const d = newDeck();
  stepDeck(d, 31);                                     // one ordinary order open
  assert.equal(openCount(d), 1);
  const raised = happyFill(d);
  assert.equal(raised.length, 2);
  assert.equal(openCount(d), DECK.QUEUE);
  assert.ok(openOrders(d).every(o => o.happy));
  assert.equal(tabFor(10, openOrders(d)[0]), DECK.ORDER_TAB * 1.5 * 10);
  assert.equal(tabFor(10, { seat: 0 }), DECK.ORDER_TAB * 10, 'an ordinary order unchanged');
  assert.equal(tabFor(10, { round: true, happy: true }), DECK.ROUND_TAB * 1.5 * 10);
  assert.equal(happyFill(d).length, 0, 'already full');
});

test('the loungers\' balls: N by crew size, one per distinct target green, on the green; the clock by crew size', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(happyN), [1, 2, 3, 3, 3, 3]);
  assert.deepEqual([1, 2, 4].map(happyBallSecs), [40, 30, 30]);
  for (const day of [10, 11, 12, 13]) for (const n of [1, 2, 3, 4]) for (const k of [0, 1]) {
    const s = greenSpots(day, day - 9, n, k);
    assert.equal(s.length, happyN(n));
    assert.equal(new Set(s.map(o => o.bowl)).size, s.length, 'distinct greens');
    for (const o of s) { const g = MAP.BOWLS.find(b => b.id === o.bowl); const r = Math.hypot(o.x - g.x, o.z - g.z); assert.ok(r > g.cup && r < g.r, 'on the green, off the cup'); }
    if (n === 1) assert.equal(s[0].bowl, 'A', 'solo: the nearest green');
  }
});

test('the bell\'s bonus can\'t start inside a live Happy Hour, nor overlap today\'s', () => {
  assert.equal(bonusClear({ t: 100, at: 180 }), true);
  assert.equal(bonusClear({ t: 130, at: 180 }), false, 'would run into today\'s');
  assert.equal(bonusClear({ t: 200, at: 180, done: true, live: true }), false, 'live');
  assert.equal(bonusClear({ t: 260, at: 180, done: true }), true);
});

test('the Board line and the report row', () => {
  assert.equal(happyLine({ on: 1, orders: 3, pips: '110', t: 40.2 }), 'HAPPY HOUR · ORDERS 3 · ●●○ · 0:41');
  assert.equal(happyLine({ on: 0 }), null);
  assert.deepEqual(happyRow({ pours: 3, got: 2, n: 3, cash: 41_200 }), { text: 'Happy Hour: 3 pours, 2 of 3 greens · +$41k', cash: 41200 });
});

function tiered(n = 1, extra = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('HAPPY', { day: 12, venue: 2, venueDay: 1, garyDay: 30, up: { shed: 1 }, ...extra }, { seed: 7, now: () => clock.t });
  const rats = [];
  for (let i = 0; i < n; i++) { const p = crew.join('R' + i); crew.connect(p); rats.push(p); }
  crew.startShift();
  const ev = [];
  const run = (fn = () => {}) => {
    for (let i = 0; i < 430 * 20 && crew.phase === 'shift'; i++) {
      clock.t += 50; crew.tick(0.05);
      fn(crew, rats);
      for (const e of crew.events) if (e.t === 'happy' || e.t === 'deckOrder') ev.push({ ...e, at: crew.shiftT });
      crew.events = [];
    }
  };
  return { crew, rats, ev, run };
}

test('in a crew: it fires at 180 s for 60 s, fills the deck, chips the balls; the call tag; a ball banked pays x20 BV', () => {
  assert.ok(MODULES.includes(happyhour)); checkModule(happyhour);
  const { crew, rats, ev, run } = tiered(2);
  const p = rats[0];
  let bv = 0;
  run(c => {
    const st = c.mods.state('happyhour');
    const e = st.balls.find(o => o.st === 'out' && c.balls.get(o.id)?.rest);
    if (e && !(st.held[p.id] > 0)) { const b = c.balls.get(e.id); p.x = b.x; p.z = b.z; assert.equal(c.pickup(p, b.id), true); }
    else if (st.held[p.id] > 0) { bv = c.valueNow().bv; p.x = RETURN.x; p.z = RETURN.z; }
  });
  const start = ev.find(e => e.phase === 'start');
  assert.ok(start && Math.abs(start.at - 180) < 0.1);
  assert.equal(start.orders, DECK.QUEUE);
  assert.deepEqual(eventCall(start), ['lounger', 2]);
  assert.ok(ev.filter(e => e.t === 'deckOrder' && e.happy).length >= 1, 'the new tickets');
  const end = ev.find(e => e.phase === 'end');
  assert.ok(Math.abs(end.at - 240) < 0.1);
  const bank = ev.find(e => e.phase === 'bank');
  assert.ok(bank && bank.cash > 0);
  assert.ok(Math.abs(bank.cash - HAPPY.BALL_PAY * bv) / (HAPPY.BALL_PAY * bv) < 0.05, `x20 BV: ${bank.cash} vs ${HAPPY.BALL_PAY * bv}`);
  assert.match(crew.report.rows.find(r => r.text.startsWith('Happy Hour')).text, /^Happy Hour: \d+ pours?, [12] of 2 greens · \+\$/);
});

test('3a: the Members\' Bell at Tiered rings a bonus Happy Hour, once a shift, never on top of today\'s', () => {
  const { crew, rats, ev, run } = tiered(2, { up: { shed: 1, landmark: 1 } });
  const p = rats[0], at = [100, 130, 300];
  run(c => {
    if (at.length && c.shiftT >= at[0]) { at.shift(); p.x = BELL.POST.x; p.z = BELL.POST.z; c.mods.first('input', p, { t: 'bell' }); }
  });
  const phases = ev.filter(e => e.t === 'happy').map(e => e.phase);
  assert.equal(phases.filter(x => x === 'bell').length, 1, 'once a shift');
  const starts = ev.filter(e => e.phase === 'start');
  assert.deepEqual(starts.map(s => [Math.round(s.at), !!s.bonus]), [[100, true], [180, false]]);
  assert.ok(ev.filter(e => e.phase === 'bellno').length >= 1, 'the 130 s / 300 s rings are refused');
});

test('2b: the bowls read scales by crew size (rally.js) and lifts Tiered\'s Last Call read at 1P / 2P only', () => {
  assert.equal(bowlsEase(1), 0.5); assert.equal(bowlsEase(2), 0.25); assert.equal(bowlsEase(3), null);
  assert.equal(bowlsPass({ n: 1, load0: 40, load: 20 }), true);
  assert.equal(bowlsPass({ n: 1, load0: 40, load: 21 }), false);
  assert.equal(bowlsPass({ n: 2, load0: 40, load: 10 }), true);
  assert.equal(bowlsPass({ n: 2, load0: 40, load: 11 }), false);
  assert.equal(bowlsPass({ n: 4, load0: 40, load: 0 }), false, '3P+ keep the plain read');
  for (const [n, eased] of [[1, true], [4, false]]) {
    const { crew, run } = tiered(n);
    const glowAt = crew.shiftSecs - endWindows(crew.shiftSecs).glow;
    let set0 = false, set1 = false, kpi = null;
    const fill = (c, k) => {
      for (const b of [...c.balls.values()]) if (b.cup) c.balls.delete(b.id);
      for (let i = 0; i < k; i++) { const id = c.nextBall++; c.balls.set(id, { id, x: -4, y: 0.02, z: -48, vx: 0, vy: 0, vz: 0, kind: 'range', rest: true, cup: 'A' }); }
    };
    run(c => {
      if (!set0 && c.shiftT >= crew.shiftSecs - 181) { set0 = true; fill(c, 60); }
      if (!set1 && c.shiftT >= glowAt - 0.3) { set1 = true; fill(c, 25); }
      const t = c.mods.state('tiered');
      if (kpi == null && t.kpiAtClose != null) kpi = t.kpiAtClose;
    });
    assert.equal(crew.mods.state('happyhour').load0 >= 60, true);
    if (eased) assert.equal(kpi, 0.5, '1P: 25 of 60 left is under half: passes');
    else assert.ok(kpi < 0.5, '4P: the plain read');
  }
});
