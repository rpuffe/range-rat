// Council round 10 #6: "on the green" at the Muni and the Club.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GREENS, onGreen } from '../web/js/greens.js';
import { MAP } from '../web/js/map.js';
import { Crew } from '../server/crew.mjs';
import { MODULES } from '../server/venues/index.mjs';
import greens from '../server/venues/greens.mjs';
import { hintText, HINT_WHEN } from '../web/js/settings.js';

const A = MAP.BOWLS[0];
function setup(venue = 0) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('GRNS', { venue, day: 3, venueDay: 3, up: {}, cash: 1000 }, { shiftSecs: 200, seed: 4, now: () => clock.t });
  const p = crew.join('G'); crew.connect(p);
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; p.seenAt = clock.t; p.movedAt = clock.t; crew.tick(0.05); } };
  const land = (by, dx = 0) => { const b = crew.addBall({ x: A.x + dx, y: 0.06, z: A.z, vx: 0, vy: 0, vz: 0, kind: 'range', ...(by ? { by } : {}) }); run(0.2); return b; };
  return { crew, p, run, land };
}

test('the rule: a crew ball inside r counts; a customer ball, a ball off the green, Tiered on, and the 6th never', () => {
  assert.equal(GREENS.HUSTLE, 0.1); assert.equal(GREENS.PER_SHIFT, 5);
  const on = { x: A.x + A.r - 0.1, z: A.z };
  assert.equal(onGreen(on, { crew: true })?.id, 'A');
  assert.equal(onGreen(on, { crew: false }), null, 'a customer ball');
  assert.equal(onGreen({ x: A.x + A.r + 0.1, z: A.z }, { crew: true }), null, 'no lip before Tiered');
  assert.equal(onGreen(on, { crew: true, venue: 1 })?.id, 'A', 'the Club');
  assert.equal(onGreen(on, { crew: true, venue: 2 }), null, 'Tiered: a TARGET instead');
  assert.equal(onGreen(on, { crew: true, n: 5 }), null, 'five a shift');
  assert.equal(onGreen(on, { crew: true, shift: false }), null);
  assert.ok(GREENS.TIP.split(/\s+/).length <= 8);
  assert.equal(hintText('green', false), GREENS.TIP);
  assert.equal(HINT_WHEN.green({ venue: 0, atBay: true }), true);
  assert.equal(HINT_WHEN.green({ venue: 2, atBay: true }), false);
});

test('server: a crew ball on a green adds 0.1 Hustle and an event; never a customer\'s; at most 5 a shift; reset each morning', () => {
  assert.ok(MODULES.includes(greens));
  const { crew, p, land } = setup(0);
  const m0 = crew.mult;
  land(null);
  assert.equal(crew.mult, m0, 'a customer ball does nothing');
  const b = land(p.id);
  assert.ok(Math.abs(crew.mult - (m0 + 0.1)) < 1e-9);
  const e = crew.events.find(x => x.t === 'onGreen');
  assert.deepEqual([e.by, e.bowl, e.n], [p.id, 'A', 1]);
  assert.ok(crew.balls.has(b.id), 'the ball is ordinary: still there to pick');
  for (let i = 0; i < 6; i++) land(p.id, 0.1 * i);
  assert.equal(crew.events.filter(x => x.t === 'onGreen').length, 5, 'five a shift');
  assert.ok(crew.mult <= 2 + 1e-9, 'under the shared cap');
  crew.phase = 'report'; crew.startShift();
  assert.equal(crew.mods.state('greens').n, 0);
});

test('server: at Tiered the green is a TARGET, not "on the green"', () => {
  const { crew, p, land } = setup(2);
  land(p.id);
  assert.equal(crew.events.filter(x => x.t === 'onGreen').length, 0);
  assert.ok(crew.events.some(x => x.t === 'target'));
});
