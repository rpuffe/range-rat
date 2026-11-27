// Council round 14 #6 (builder 4): the polish pack. design/round16-polish.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockInSpot, CLOCK_IN, SIM, WASHER_HANDLES, VENUE_RULES } from '../web/js/sim.js';
import { CASE } from '../web/js/caserules.js';
// views/garycameo.js imports THREE (not loadable here): its CAMEO.SPOT, copied (dx −2.4, dz 1.3 from the return)
const returnSpot = st => ({ x: st.x - 2.4, z: st.z + 1.3 });
import { WHISTLE } from '../web/js/mowe.js';
import { bubbleSizeK, bubbleFade, BUBBLE } from '../web/js/bubbleclamp.js';
import { createGaryLineGate, GARY_LINES } from '../web/js/nudge.js';
import { payRoute, createHudPop, HUDPOP } from '../web/js/payfloat.js';
import { ENDCARD_AT, ENDCARD_HOLD, ENDING_READY_SECS, endingReadyFrom } from '../web/js/dayend.js';
import { promoPanelHtml } from '../web/js/promopanel.js';
import { createAuto } from '../web/js/perf.js';
import { wordCount } from '../web/js/say.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('6.1: every endless slot is ≥ 3 m from the case and the cameo, off the washer handles and the MOW-E post', () => {
  const cameo = returnSpot(SIM.STAND);
  for (let k = 0; k < 6; k++) {
    const s = clockInSpot(5, k, true);
    assert.equal(s.x, CLOCK_IN.ENDLESS_XS[k]);
    assert.ok(dist(s, CASE) >= 3, `slot ${k}: ${dist(s, CASE).toFixed(2)} m from the case`);
    assert.ok(dist(s, cameo) >= 3, `slot ${k}: ${dist(s, cameo).toFixed(2)} m from Gary's cameo spot`);
    assert.ok(!(s.x > WASHER_HANDLES.L.x - 0.2 && s.x < WASHER_HANDLES.R.x + 0.2), `slot ${k}: not between the washer's handles`);
    assert.ok(dist(s, WHISTLE.POST) >= 2.5, `slot ${k}: ${dist(s, WHISTLE.POST).toFixed(2)} m from the MOW-E post (L: the 31.8 slot is 2.8 m off)`);
  }
  assert.deepEqual(clockInSpot(5, 0, false).x, CLOCK_IN.LATE_XS[0], 'the Orbital proper keeps the late row');
});

test('6.2: the bubble is capped at 9 % of the screen, and fades out inside 2.5 m', () => {
  const h = 2.6 * 64 / 512;   // Gary's bubble, world height
  assert.equal(bubbleSizeK(h, 20, 70), 1, 'far: untouched');
  const k = bubbleSizeK(h, 0.8, 70), frac = h * k / (2 * 0.8 * Math.tan(35 * Math.PI / 180));
  assert.ok(k < 1 && Math.abs(frac - BUBBLE.SIZE) < 1e-9, `close: scaled to ${(frac * 100).toFixed(1)} % of the screen`);
  assert.equal(bubbleFade(1.0), 0); assert.equal(bubbleFade(2.5), 1); assert.ok(bubbleFade(2.0) > 0 && bubbleFade(2.0) < 1);
  assert.equal(bubbleFade(10), 1);
});

test('6.3: from the Club on, the clock-in faces down-range (0, −80); the Muni has no yaw', () => {
  assert.equal(clockInSpot(0, 2).yaw, undefined);
  for (const v of [1, 2, 3, 4, 5]) for (let k = 0; k < 6; k++) {
    const s = clockInSpot(v, k), fx = -Math.sin(s.yaw), fz = -Math.cos(s.yaw);   // crew.mjs: yaw = atan2(−dx, −dz)
    const tx = CLOCK_IN.AIM.x - s.x, tz = CLOCK_IN.AIM.z - s.z, d = Math.hypot(tx, tz);
    assert.ok(fx * tx / d + fz * tz / d > 0.9999, `venue ${v} slot ${k} faces the aim`);
    assert.ok(fz < -0.9, 'down-range is −z');
  }
  const e = clockInSpot(5, 0, true); assert.ok(Number.isFinite(e.yaw), 'endless too');
});

test('6.4: one Gary line at a time; holds ≥ 4 s; the extras once, after a failed check, 6 s clear', () => {
  const g = createGaryLineGate();
  assert.equal(g.pick('gary:mats', 0), 'gary:mats');
  assert.equal(g.pick('gary:stall', 1), 'gary:mats', 'the stop line holds 4 s');
  assert.equal(g.pick('gary:stall', GARY_LINES.HOLD + 0.1), null, 'no failed check yet: no stall line');
  g.failedCheck();
  assert.equal(g.pick('gary:stall', GARY_LINES.HOLD + 2), null, 'within 6 s of the stop line');
  const t = GARY_LINES.HOLD + 0.1 + GARY_LINES.EXTRA_GAP + 0.1;
  assert.equal(g.pick('gary:stall', t), 'gary:stall');
  assert.equal(g.pick('gary:stall', t + 3), 'gary:stall', 'it stays while wanted');
  assert.equal(g.pick(null, t + 5), null, 'gone after its hold');
  assert.equal(g.pick('gary:stall', t + 20), null, 'once a visit');
  assert.equal(g.pick('gary:chat', t + 20), 'gary:chat', 'the chat line has its own once');
  g.reset(); assert.equal(g.pick('gary:stall', 100), null, 'a new visit: wait for a failed check again');
  assert.equal(g.pick('meet:x', 0), null, 'not a Gary line');
});

test('6.5: your own banks route to the HUD and count up', () => {
  assert.equal(payRoute({ by: 'me' }, 'me', ['me']), 'hud');
  const h = createHudPop();
  h.add(10, 0); assert.equal(h.value(0), 0); assert.equal(h.value(HUDPOP.COUNT), 10);
  h.add(5, 1); assert.equal(h.value(1), 10, 'counts on from what it showed'); assert.equal(h.value(1 + HUDPOP.COUNT), 15);
  assert.equal(h.opacity(1 + HUDPOP.HOLD), 1); assert.ok(h.opacity(1 + HUDPOP.HOLD + HUDPOP.FADE) < 1e-9);
  h.add(3, 10); assert.equal(h.value(10 + HUDPOP.COUNT), 3, 'a fresh pop after it faded');
});

test('6.7: the ending report holds Ready until the end card has been up 10 s; 30 s countdown', () => {
  assert.equal(ENDCARD_HOLD, 10); assert.equal(ENDING_READY_SECS, 30);
  assert.ok(ENDCARD_AT > 20 && ENDCARD_AT < 40);
  assert.equal(endingReadyFrom(1000), 1000 + (ENDCARD_AT + 10) * 1000);
});

test('6.9 / 6.10 / 6.11: "To reach …", the Stadium memo, one auto step a minute', () => {
  assert.match(promoPanelHtml({ next: 'Range Club', fee: 1, ready: false, done: 0, of: 3 }, { goals: { rows: [] } }), /<h3>To reach Range Club<\/h3>/);
  assert.equal(VENUE_RULES[3].memo, 'NEW: the Ping Track.');
  assert.ok(wordCount('Today: 35% clean. Crowd over half. ' + VENUE_RULES[3].memo) <= wordCount('Today: 35% clean. Crowd over half. NEW: the Ping Track. Keep the crowd happy.') - 4, 'the tail is gone');
  const a = createAuto({ settle: 0, hold: 1 }); let n = 0; for (let t = 0; t < 59; t++) if (a.update(99, 1)) n++;
  assert.equal(n, 1);
});

test('6.7: on the ending report early Ready presses wait for the end card; a normal report is unchanged', async () => {
  const { Crew } = await import('../server/crew.mjs');
  const clock = { t: 1e6 };
  const crew = new Crew('END7', { venue: 5, day: 18, venueDay: 2 }, { seed: 7, now: () => clock.t });
  const a = crew.join('A'), b = crew.join('B'); crew.connect(a); crew.connect(b);
  crew.startShift(); crew.endShift(true);
  assert.ok(crew.report.ending && crew.phase === 'report');
  crew.readyUp(a); crew.readyUp(b);
  assert.equal(crew.phase, 'report', 'all ready, but the end card has not had its 10 s');
  assert.equal(crew.readyAt, 0, 'no countdown yet');
  const step = secs => { for (let i = 0; i < secs * 10; i++) { clock.t += 100; for (const p of [a, b]) p.seenAt = clock.t; crew.tick(0.1); } };
  step(ENDCARD_AT + ENDCARD_HOLD - 2); assert.equal(crew.phase, 'report');
  step(3); assert.equal(crew.phase, 'shift', 'everyone had pressed: the shift starts once the hold is over');
  // a normal report: all ready starts at once
  const n = new Crew('END8', null, { seed: 7, now: () => clock.t }); const p = n.join('A'); n.connect(p);
  n.startShift(); n.endShift(); n.readyUp(p); assert.equal(n.phase, 'shift');
  // one of two presses early on the ending: the 30 s countdown starts at the hold's end
  const c = new Crew('END9', { venue: 5, day: 18, venueDay: 2 }, { seed: 7, now: () => clock.t });
  const x = c.join('A'), y = c.join('B'); c.connect(x); c.connect(y); c.startShift(); c.endShift(true);
  const t0 = clock.t; c.readyUp(x);
  const step2 = secs => { for (let i = 0; i < secs * 10; i++) { clock.t += 100; for (const q of [x, y]) q.seenAt = clock.t; c.tick(0.1); } };
  step2(ENDCARD_AT + ENDCARD_HOLD + 1); assert.ok(c.readyAt > 0 && c.readyAt >= t0 + (ENDCARD_AT + ENDCARD_HOLD) * 1000 - 200);
  step2(ENDING_READY_SECS - 3); assert.equal(c.phase, 'report'); step2(4); assert.equal(c.phase, 'shift');
});
