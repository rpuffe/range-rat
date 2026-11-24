// Council round 6 #2: the venue gauge decides the stamp. From Tiered on (venues 2-5) the bell's review passes only if
// Upkeep reaches the target AND the venue gauge is at least QUOTA_KPI (0.5). The Muni and the Club have no gauge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { QUOTA_KPI } from '../web/js/sim.js';
import { GAUGE_MISS } from '../web/js/rally.js';

function makeCrew(save) {
  const clock = { t: 1_000_000 };
  return new Crew('GAGE', save, { shiftSecs: 600, seed: 3, now: () => clock.t });
}
// A spotless shift at `venue` with deposits, judged at the bell with the gauge forced to `kpi`.
const KPI_ID = { 2: 'tiered', 3: 'stadium', 4: 'county', 5: 'orbit' };
function bell(venue, kpi, ending = false) {
  const crew = makeCrew({ venue, day: 12, venueDay: 1, cash: 0 });
  crew.startShift();
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
  crew.bank(10, 'x');
  if (kpi != null) {
    const st = crew.mods.state(KPI_ID[venue]);
    if (venue === 3) st.s = kpi; else st.kpi = kpi;
  }
  crew.endShift(ending);
  return crew;
}

test('QUOTA_KPI is 0.5', () => assert.equal(QUOTA_KPI, 0.5));

test('at Tiered, Upkeep over the target with the gauge at 0.49 gives no stamp; at 0.50 it gives one', () => {
  const low = bell(2, 0.49);
  assert.ok(low.valueNow().bv / low.valueNow().rate >= 1 + low.quota.q, 'Upkeep is over the target');
  assert.equal(low.report.quota.hit, false);
  assert.equal(low.stamps, 0);
  assert.equal(low.report.quota.bonus, 0);
  const ok = bell(2, 0.5);
  assert.equal(ok.report.quota.hit, true);
  assert.equal(ok.stamps, 1);
});

test('the report and the quota event carry gauge and gaugeOk, and the miss line names the gauge', () => {
  const low = bell(2, 0.43);
  const q = low.report.quota;
  assert.equal(q.gauge, 0.43);
  assert.equal(q.gaugeOk, false);
  assert.equal(q.why, 'Missed: the bowls were full.');
  const ev = low.flush().ev.find(e => e.t === 'quota');
  assert.equal(ev.gauge, 0.43);
  assert.equal(ev.gaugeOk, false);
  assert.equal(ev.why, q.why);
  const ok = bell(2, 0.8).report.quota;
  assert.equal(ok.gaugeOk, true);
  assert.equal(ok.why, undefined);
});

test('every gauge venue (2-4) applies the rule, with its own miss line of 8 words or fewer', () => {
  for (const v of [2, 3, 4]) {
    const miss = bell(v, 0.3).report.quota, pass = bell(v, 0.9).report.quota;
    assert.equal(miss.hit, false, `venue ${v} misses on the gauge`);
    assert.equal(miss.why, GAUGE_MISS[v]);
    assert.ok(GAUGE_MISS[v].split(/\s+/).length <= 8);
    assert.equal(pass.hit, true, `venue ${v} passes with the gauge held`);
  }
});

test('at the Muni and the Club there is no gauge: the quota entry has no gauge fields', () => {
  for (const venue of [0, 1]) {
    const crew = bell(venue, null);
    const q = crew.report.quota;
    assert.ok(q, `venue ${venue} has a review`);
    assert.deepEqual(Object.keys(q).sort(), ['bonus', 'bv', 'hit', 'stamps', 'target', 'title']);
  }
});

test('the ending shift has no review', () => {
  const crew = bell(5, 0.1, true);
  assert.equal(crew.report.quota, null);
  assert.equal(crew.flush().ev.filter(e => e.t === 'quota').length, 0);
});

test('round 7 #5: no review at the Orbital (no quota, no stamp, no quota event); venues 2-4 still review', () => {
  const crew = bell(5, 0.9);
  assert.equal(crew.quota, null);
  assert.equal(crew.report.quota, null);
  assert.equal(crew.flush().ev.filter(e => e.t === 'quota').length, 0);
  assert.equal(crew.stamps, 0);
  for (const v of [2, 3, 4]) assert.ok(bell(v, 0.9).report.quota, `venue ${v} still reviews`);
});

test('round 7 #5: the Orbital memo is the countdown', () => {
  const crew = makeCrew({ venue: 5, day: 12, venueDay: 1, outstanding: 1123 });
  crew.startShift();
  const memo = crew.flush().ev.find(e => e.t === 'memo');
  assert.equal(memo.text, 'Today: clear the sky. 1,123 to bring home.');
  assert.equal(memo.target, null);
});

test('round 7 #7: the Stadium review reads the 2-minute mean, not the live mood', () => {
  const crew = makeCrew({ venue: 3, day: 12, venueDay: 1, cash: 0 });
  crew.startShift();
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
  crew.bank(10, 'x');
  const st = crew.mods.state('stadium');
  for (let i = 0; i < 120; i++) st.win.a[i] = 0.3;           // two minutes of a bored crowd
  st.s = 0.95;                                                // a last-second lap doesn't rescue it
  crew.endShift();
  assert.equal(crew.report.quota.gauge, 0.3);
  assert.equal(crew.report.quota.gaugeOk, false);
});
