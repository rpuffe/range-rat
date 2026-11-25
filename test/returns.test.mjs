// Council round 10 §C (#7): the field ball returns. Ⓧ at one sends your pocket home through its pipe: it THUNKs into
// the main return 6 s later at your gear factor and goes through the washer like any bank. Teenagers and the cart
// never use them. server/crew.mjs feedTube, web/js/layout.js FIELD_RETURNS, sim.js the 'returns' row.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SHOP, perks } from '../web/js/sim.js';
import { FIELD_RETURNS } from '../web/js/layout.js';
import { TUBE } from '../web/js/dive.js';

function crewWith(up, { venue = 0, day = 4 } = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('RETN', { venue, day, venueDay: venue ? 1 : day, up: { washer: 1, ...up } }, { shiftSecs: 300, seed: 3, now: () => clock.t, modules: [] });
  const p = crew.join('Pat'); crew.connect(p);
  crew.startShift();
  const run = secs => { for (let i = 0; i < Math.round(secs * 20); i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, p, run };
}

test('the row (round 11): the Far return from Muni day 4 ($3,000 base), the Back return at the Club ($12,000)', () => {
  const row = SHOP.find(i => i.id === 'returns');
  assert.ok(row, 'a crew row');
  assert.equal(row.tiers[1].cost, 3000); assert.equal(row.tiers[1].minDay ?? row.minDay, 4);
  assert.equal(row.tiers[2].cost, 12000); assert.equal(row.tiers[2].minVenue, 1);
  assert.deepEqual([perks({}).returns, perks({ returns: 1 }).returns, perks({ returns: 2 }).returns], [0, 1, 2]);
  assert.equal(FIELD_RETURNS[0].label, 'RETURN 2');
});

test('Ⓧ at the Field return: the pocket banks at the main return 6 s later, through the washer', () => {
  const { crew, p, run } = crewWith({ returns: 1 });
  const r = FIELD_RETURNS[0];
  p.x = r.x + 0.8; p.z = r.z; p.pocket = 20; p.pocketW = 20;
  const dep0 = crew.stats.deposited, hop0 = crew.hopper.n;
  crew.feedTube(p);
  assert.equal(p.pocket, 0, 'into the pipe');
  assert.ok(crew.events.some(e => e.t === 'tube' && e.id === p.id && e.at === 'field'));
  run(TUBE.DELAY - 0.5);
  assert.equal(crew.stats.deposited, dep0, 'not yet');
  run(1);
  assert.equal(crew.stats.deposited, dep0 + 20, 'THUNK: banked 6 s later');
  assert.ok(crew.hopper.n >= hop0 + 20, 'through the washer like any bank');
});

test('not bought, too far, or the Back return before tier 2: nothing goes in', () => {
  const { crew, p } = crewWith({});
  const r = FIELD_RETURNS[0];
  p.x = r.x; p.z = r.z; p.pocket = 5;
  assert.equal(crew.feedTube(p), false); assert.equal(p.pocket, 5);
  const b = crewWith({ returns: 1 }, { venue: 1, day: 8 });
  b.p.x = FIELD_RETURNS[1].x; b.p.z = FIELD_RETURNS[1].z; b.p.pocket = 5;
  assert.equal(b.crew.feedTube(b.p), false, 'the Back return is tier 2');
  const c = crewWith({ returns: 2 }, { venue: 1, day: 8 });
  c.p.x = FIELD_RETURNS[1].x; c.p.z = FIELD_RETURNS[1].z; c.p.pocket = 5;
  assert.equal(c.crew.feedTube(c.p), true);
  c.p.x += 5; c.p.pocket = 5;
  assert.equal(c.crew.feedTube(c.p), false, 'out of reach');
});

test('teenagers never use the pipe: "Teenagers don\'t trust the pipe."', () => {
  const { crew, run } = crewWith({ returns: 1, helpers: 2 });
  const r = FIELD_RETURNS[0];
  for (let i = 0; i < 30; i++) { const b = crew.addBall({ x: r.x + (i % 6) - 3, y: 0.06, z: r.z - 2 - Math.floor(i / 6), vx: 0, vy: 0, vz: 0, kind: 'range' }); b.rest = true; }
  let fed = 0;
  for (let k = 0; k < 120; k++) { run(1); fed += crew.events.filter(e => e.t === 'tube').length; crew.events.length = 0; }
  assert.equal(fed, 0);
  assert.equal(crew.tube.q.length, 0);
});
