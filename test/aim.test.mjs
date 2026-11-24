// The landing-ring predictor (council round 6, #4): web/js/aim.js against the server's real crew swing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import tiered from '../server/venues/tiered.mjs';
import { BAYS } from '../web/js/sim.js';
import { MAP } from '../web/js/map.js';
import { CUP_FULL } from '../web/js/tiered.js';
import { AIM, predictRest, createAimer, ringBowl, cupWarn, KPI_PASS } from '../web/js/aim.js';

// Where the server rests a crew ball hit from `bay` with this (pure) launch.
function serverRest(bay, yaw, pitch, power) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('AIMT', { venue: 2, day: 5, venueDay: 1, up: {}, cash: 1000 },
    { shiftSecs: 400, seed: 3, now: () => clock.t, modules: [tiered] });
  const p = crew.join('A'); crew.connect(p);
  crew.startShift();
  Object.assign(p, { x: bay.x, z: bay.z, pocket: 3 });
  assert.ok(crew.swing(p, { yaw, pitch, power }), 'the swing is accepted');
  const id = [...crew.balls.values()].find(b => b.by === p.id).id;
  for (let i = 0; i < 20 * 30; i++) {
    clock.t += 50; crew.tick(0.05);
    const e = crew.events.find(x => x.t === 'rest' && x.id === id);
    if (e) return { x: e.x, z: e.z };
    if (crew.events.some(x => x.t === 'drift' && x.id === id)) return 'drift';
    crew.events.length = 0;
  }
  return null;
}

test('predictRest matches the server rest spot for the same pure launch (within 0.05 m)', () => {
  const shots = [[BAYS[1], -0.15, 0.15, 0.8], [BAYS[0], 0.05, 0.2, 0.3], [BAYS[1], 0.1, 0.25, 0.5], [BAYS[1], -0.2, 0.35, 0.9], [BAYS[0], 0.35, 0.3, 0.7]];
  for (const [bay, yaw, pitch, power] of shots) {
    const want = serverRest(bay, yaw, pitch, power);
    const got = predictRest({ bay, yaw, pitch, power }, { venue: 2 });
    assert.ok(want && got, `both rest (${yaw}, ${pitch}, ${power})`);
    assert.ok(Math.hypot(want.x - got.x, want.z - got.z) < 0.05, `${JSON.stringify(want)} vs ${JSON.stringify(got)}`);
    assert.ok(got.steps <= AIM.MAX_STEPS);
  }
  // A shot into the running creek: the server drifts it, and the ring shows nothing.
  assert.equal(serverRest(BAYS[0], 0.1, 0.25, 0.6), 'drift');
  assert.equal(predictRest({ bay: BAYS[0], yaw: 0.1, pitch: 0.25, power: 0.6 }, { venue: 2 }), null);
});

test('predictRest is deterministic and returns null with no power', () => {
  const l = { bay: BAYS[0], yaw: 0.05, pitch: 0.2, power: 0.7 };
  assert.deepEqual(predictRest(l, { venue: 2 }), predictRest(l, { venue: 2 }));
  assert.equal(predictRest({ ...l, power: 0 }, { venue: 2 }), null);
  assert.equal(predictRest(null), null);
});

test('the aimer recomputes at most HZ times a second, and only when power or aim moved', () => {
  let calls = 0, t = 0;
  const a = createAimer({ predict: () => ({ x: ++calls, z: 0 }), now: () => t });
  const base = { bay: BAYS[0], yaw: 0, pitch: 0.2, power: 0.7 };
  a.update(base); assert.equal(calls, 1);
  t += 500; a.update({ ...base, power: 0.705, yaw: 0.005 }); assert.equal(calls, 1, 'under 0.01 power and 0.5 degrees: no recompute');
  t += 10; a.update({ ...base, power: 0.75 }); assert.equal(calls, 2, 'power moved');
  t += 10; a.update({ ...base, power: 0.8 }); assert.equal(calls, 2, 'within 1/HZ s: held');
  t += 1000 / AIM.HZ; a.update({ ...base, power: 0.8 }); assert.equal(calls, 3);
  assert.equal(a.update(null), null);
});

test('the ring turns the bowl colour inside the crew lip; a cup goes red at its share of the pass line', () => {
  const [A] = MAP.BOWLS;
  assert.equal(ringBowl({ x: A.x + A.r + 1.4, z: A.z }), A);
  assert.equal(ringBowl({ x: A.x + A.r + 1.6, z: A.z }), null);
  assert.equal(cupWarn(3, CUP_FULL), Math.max(1, Math.round(CUP_FULL * (1 - KPI_PASS) / 3)));
  assert.equal(cupWarn(3, 30), 5);
});

test('benchmark: a worst-case predict stays near the 1,500-step budget', () => {
  let worst = 0;
  for (let p = 0.2; p <= 1.15; p += 0.05) {
    const r = predictRest({ bay: BAYS[0], yaw: 0, pitch: 0.3, power: p }, { venue: 2 });
    if (r) worst = Math.max(worst, r.steps);
  }
  assert.ok(worst > 0 && worst <= 1700, `worst ${worst} steps`);
});
