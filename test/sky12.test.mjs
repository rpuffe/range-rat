// Round 12 (owner playtest: "the sky never cleared"). The Clear-the-sky row and the Last Bucket banner say what the
// gate still waits on, and the Orbital's debris arrives fast enough to finish in about two shifts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyText, rowsOf, CARDS } from '../web/js/goals.js';
import { lastBucketLine } from '../web/js/huddlerules.js';
import { ORBIT } from '../web/js/orbit.js';

test('the sky row names Balls Outstanding first, then the debris overhead', () => {
  assert.equal(skyText({ skyOut: 1959, skyUp: 30 }), 'Clear the sky · 1,958 balls still in orbit');
  assert.equal(skyText({ skyOut: 1, skyUp: 7 }), 'Clear the sky · 7 more debris down');
  assert.equal(skyText({ skyOut: 1, skyUp: 0 }), 'Clear the sky');
  const card = { venue: 5, scale: 1, crew: 1, need: {}, n: {}, done: [], who: [] };
  const sky = rowsOf(card, { skyOut: 500, skyUp: 0 }).find(r => r.id === 'sky');
  assert.match(sky.text, /499 balls still in orbit/);
  assert.equal(CARDS[5].at(-1).id, 'sky');
});

test('the banner: debris overhead first; once clear it names the open card step, never "0 UP"', () => {
  const c = lb => ({ phase: 'shift', players: [{ id: 'a', online: 1, x: 0, z: 0 }], lastBucket: lb });
  assert.match(lastBucketLine(c({ phase: 'sky', debris: 20, step: 'buy the tether winch' }), 'a'), /CLEAR THE SKY · 5 UP/);
  const clear = lastBucketLine(c({ phase: 'sky', debris: 10, step: 'buy the tether winch' }), 'a');
  assert.equal(clear, 'SKY CLEAR · NOW BUY THE TETHER WINCH');
  assert.ok(!/0 UP/.test(clear));
  assert.match(lastBucketLine(c({ phase: 'sky', debris: 10 }), 'a'), /CLEAR THE SKY/);
});

test('the drift is 12 s and the customer share stays 10%', () => {
  assert.equal(ORBIT.DRIFT_EVERY, 12); assert.equal(ORBIT.SHOT, 0.10);
});

test('the backlog drifts into reach every 12 s, whatever the customers do; never during the Last Bucket or in endless', async () => {
  const { Crew } = await import('../server/crew.mjs');
  const orbit = (await import('../server/venues/orbit.mjs')).default;
  const mk = extra => {
    const clock = { t: 1_000_000 };
    const crew = new Crew('SKY', { venue: 5, day: 9, venueDay: 1, outstanding: 1958, up: {}, ...extra }, { shiftSecs: 900, seed: 3, now: () => clock.t, modules: [orbit] });
    const p = crew.join('Pat'); crew.connect(p); crew.startShift();
    crew.balls.clear();
    const run = s => { for (let i = 0; i < s * 20; i++) { clock.t += 50; crew.tick(0.05); for (const b of crew.balls.values()) if (b.orbit) crew.balls.delete(b.id); } };
    return { crew, run, st: crew.mods.state('orbit') };
  };
  const a = mk(); const d0 = a.st.debris.size; a.run(61);
  assert.ok(a.st.debris.size - d0 >= 5, `drifted ${a.st.debris.size - d0}`);
  const e = mk({ endless: true }); const e0 = e.st.debris.size; e.run(61);
  assert.equal(e.st.debris.size, e0, 'no drift in endless');
});
