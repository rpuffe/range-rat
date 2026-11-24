// Scuba v2 rules (council round 3, section 4): the Deep End, dive gear, pump and haul, the tube,
// treasure and the Lost & Found case. All pure: web/js/dive.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { POND, inPond } from '../web/js/sim.js';
import {
  PD_POND, POND_DEEP, deepDist, inDeepEnd, inDeepCore, deepness, bedAt, eyeY, seeded, sinksDeep, deepEndSpot, sinkSpot,
  DIVE_ROW, POND_ROW, diveTiers, MAX_DIVE_LEVEL, PUMP, HAUL, pumpGain, drainMult, airStep,
  newLine, canSend, sendBag, haulReady, takeLine, nightCrew,
  TUBE, atTube, hasTube, hasPondPump, pondTier, newTube, tubeFeed, tubeArrivals, tubeInFlight, pondPumpStep,
  TREASURE, TREASURE_BY_ID, TREASURE_CHANCE, cleanLostFound, nextTreasure, rollTreasure, treasureSpot, finderFee, lostFoundLine,
  waterLook,
} from '../web/js/dive.js';

test('dive.js has no imports (sim.js imports it, so a cycle would crash)', () => {
  assert.doesNotMatch(readFileSync(new URL('../web/js/dive.js', import.meta.url), 'utf8'), /^\s*import\s/m);
});

test('the mirrored pond numbers match sim.js', () => {
  assert.equal(PD_POND.x, POND.x); assert.equal(PD_POND.z, POND.z); assert.equal(PD_POND.r, POND.r);
  assert.equal(PD_POND.BOTTOM, POND.BOTTOM); assert.deepEqual(PD_POND.DOCK, POND.DOCK); assert.equal(PD_POND.DOCK_R, POND.DOCK_R);
  assert.equal(POND_DEEP.SHELF, POND.BOTTOM);
});

test('the Deep End: a 3 m sinkhole from -1.1 down to -4.5', () => {
  assert.deepEqual([POND_DEEP.x, POND_DEEP.z, POND_DEEP.r, POND_DEEP.FLOOR], [-15, -83, 3, -4.5]);
  assert.ok(inDeepEnd({ x: -15, z: -83 }) && !inDeepEnd({ x: -12, z: -78 }));
  assert.ok(inDeepCore({ x: -15, z: -83 }) && !inDeepCore({ x: -15 + 2.9, z: -83 }));
  assert.equal(bedAt(POND.x + 7, POND.z), POND.BOTTOM, 'the shelf is flat');
  assert.equal(bedAt(-15, -83), -4.5, 'the floor');
  assert.equal(bedAt(-15 + POND_DEEP.r, -83), -1.1, 'the lip is back at the shelf');
  let last = -9;
  for (let d = 0; d <= 3; d += 0.25) { const y = bedAt(-15 + d, -83); assert.ok(y >= last - 1e-9, 'the wall rises monotonically'); last = y; }
  assert.equal(deepness(-15, -83), 1); assert.equal(deepness(-15 + 3.01, -83), 0);
  assert.ok(eyeY(-15, -83) < eyeY(POND.x, POND.z) - 2, 'your eyes follow the bed down');
  assert.equal(eyeY(POND.x + 5, POND.z), POND.BOTTOM + 0.75);
  assert.ok(Math.abs(deepDist(-15, -83)) < 1e-9);
});

test('lead and gold balls always end up in the Deep End, inside the pond', () => {
  assert.ok(sinksDeep('lead') && sinksDeep('gold') && !sinksDeep('range') && !sinksDeep('glow'));
  const rng = seeded(5);
  for (let i = 0; i < 500; i++) {
    const s = deepEndSpot(rng);
    assert.ok(inDeepEnd(s), 'in the hole');
    assert.ok(Math.hypot(s.x - POND.x, s.z - POND.z) < POND.r - POND_DEEP.MARGIN + 1e-9, 'and in the pond, off the wall');
    assert.ok(Math.abs(s.y - bedAt(s.x, s.z)) < 1e-9);
    assert.ok(inPond(s));
  }
  const lead = sinkSpot('lead', { x: -12, z: -76 }, seeded(1)), plain = sinkSpot('range', { x: -12, z: -76 }, seeded(1));
  assert.ok(inDeepEnd(lead));
  assert.deepEqual([plain.x, plain.z, plain.y], [-12, -76, POND.BOTTOM]);
  assert.deepEqual(sinkSpot('gold', { x: 0, z: 0 }, seeded(9)), sinkSpot('gold', { x: 50, z: 50 }, seeded(9)), 'the landing spot does not matter to a rolling ball');
});

test('the dive gear row: free mask, then $1,200 / $5,000 / $40,000 (County)', () => {
  assert.equal(DIVE_ROW.id, 'dive'); assert.equal(DIVE_ROW.personal, true); assert.equal(DIVE_ROW.minVenue, 1);
  assert.equal(DIVE_ROW.tiers.length, MAX_DIVE_LEVEL + 1);
  assert.equal(DIVE_ROW.tiers[0].cost, undefined);
  assert.deepEqual(DIVE_ROW.tiers.slice(1).map(t => t.cost), [1200, 5000, 40000]);
  assert.equal(DIVE_ROW.tiers[3].minVenue, 2);
  for (let i = 2; i < DIVE_ROW.tiers.length; i++) assert.ok(DIVE_ROW.tiers[i].cost > DIVE_ROW.tiers[i - 1].cost);
  for (const t of DIVE_ROW.tiers) assert.ok(t.name && t.desc);
});

test('the dive tiers match the ladder in the design doc', () => {
  const t = [0, 1, 2, 3].map(diveTiers);
  assert.deepEqual(t.map(x => x.air), [20, 40, 70, 70]);
  assert.deepEqual(t.map(x => x.swim), [0.6, 0.7, 0.75, 1.3]);
  assert.deepEqual(t.map(x => x.bag), [10, 15, 25, 40]);
  assert.deepEqual(t.map(x => x.deepDrain), [2, 2, 1, 1]);
  assert.deepEqual(t.map(x => x.light), [0, 0, 1, 1]);
  assert.deepEqual(t.map(x => x.glintR), [6, 6, 8, 8]);
  assert.deepEqual(t.map(x => x.kit), ['mask', 'tank', 'twin', 'scooter']);
  assert.equal(diveTiers(-4).level, 0); assert.equal(diveTiers(99).level, 3); assert.equal(diveTiers(undefined).level, 0); assert.equal(diveTiers('2').level, 2);
  diveTiers(1).air = 1;
  assert.equal(diveTiers(1).air, 40, 'callers get copies');
  assert.equal(diveTiers(0).air, POND.AIR); assert.equal(diveTiers(0).bag, POND.BAG); assert.equal(diveTiers(0).swim, POND.SWIM, 'the mask is the old pond');
});

test('air: x2 drain in the Deep End unless you have twin tanks', () => {
  const mask = diveTiers(0), twin = diveTiers(2);
  assert.equal(drainMult(mask, -12, -78), 1);
  assert.equal(drainMult(mask, -15, -83), 2);
  assert.equal(drainMult(twin, -15, -83), 1);
  assert.equal(airStep({ air: 10, dt: 1, tier: mask, x: -12, z: -78 }).air, 9);
  assert.equal(airStep({ air: 10, dt: 1, tier: mask, x: -15, z: -83 }).air, 8);
  assert.equal(airStep({ air: 10, dt: 1, tier: twin, x: -15, z: -83 }).air, 9);
  assert.equal(airStep({ air: 20, dt: 1, tier: mask, x: -12, z: -78, gain: 5 }).air, 20, 'never over the tank');
  const out = airStep({ air: 0.5, dt: 1, tier: mask, x: -12, z: -78 });
  assert.equal(out.gasp, true); assert.equal(out.air, 0);
  assert.equal(airStep({ air: 5, dt: 0.05, tier: mask, x: 0, z: 0 }).gasp, false);
});

test('Buddy Air v2: air only comes from cranking, no infinite AFK air', () => {
  assert.equal(pumpGain({ turns: 1, dt: 1 }), 1.5, '1 turn = 1.5 s of air');
  assert.equal(pumpGain({ turns: 10, dt: 1 }), 2.5 * 1.5, 'capped at 2.5 turns a second');
  assert.equal(pumpGain({ turns: 10, dt: 0.1 }), 0.25 * 1.5);
  assert.equal(pumpGain({ held: true, dt: 1 }), 0.5, 'holding without rotating: +0.5 s a second');
  assert.equal(pumpGain({ turns: 0, held: false, dt: 1 }), 0);
  assert.equal(pumpGain({ turns: -3, dt: 1 }), 0);
  // the old pump was +2 against -1, so holding was infinite air. Now a full-speed crank wins, a held button only slows the drain.
  const mask = diveTiers(0);
  const full = airStep({ air: 10, dt: 1, tier: mask, x: 0, z: 0, gain: pumpGain({ turns: 2.5, dt: 1 }) }).air;
  const held = airStep({ air: 10, dt: 1, tier: mask, x: 0, z: 0, gain: pumpGain({ held: true, dt: 1 }) }).air;
  assert.ok(full > 10 && held < 10, `full crank ${full}, held ${held}`);
  assert.ok(PUMP.MAX_TPS === 2.5 && PUMP.SECS_PER_TURN === 1.5);
});

test('the line: send a bag, haul it up, nothing is lost', () => {
  const line = newLine();
  const d = { diving: true, down: 0, bag: 12, bagW: 15, bagKinds: ['range', 'lead', 'range'] };
  assert.ok(canSend(d));
  assert.ok(!canSend({ ...d, bag: 0 }) && !canSend({ ...d, diving: false }) && !canSend({ ...d, down: 2 }));
  assert.equal(sendBag(d, line), 12);
  assert.deepEqual([d.bag, d.bagW, d.bagKinds.length], [0, 0, 0], 'a fresh empty bag');
  d.bag = 5; d.bagW = 5; d.bagKinds = ['range'];
  sendBag(d, line);
  assert.deepEqual([line.n, line.w, line.kinds.length], [17, 20, 4], 'bags stack on the line');
  assert.equal(haulReady(1.49), false); assert.equal(haulReady(HAUL.HOLD_SECS), true);
  const got = takeLine(line);
  assert.deepEqual([got.n, got.w, got.kinds.length], [17, 20, 4]);
  assert.deepEqual([line.n, line.w, line.kinds.length], [0, 0, 0]);
  sendBag({ bag: 3, bagW: 3, bagKinds: [] }, line);
  assert.deepEqual(nightCrew(line), { n: 3, w: 3, mult: 0.5 }, 'unhauled at the bell: half pay');
});

test('the pond row: tube $4,000, pump $15,000, both Club and up', () => {
  assert.equal(POND_ROW.id, 'pond'); assert.equal(POND_ROW.minVenue, 1); assert.ok(!POND_ROW.personal);
  assert.deepEqual(POND_ROW.tiers.map(t => t.cost), [undefined, 4000, 15000]);
  assert.equal(pondTier({}), 0); assert.equal(pondTier({ pond: 2 }), 2); assert.equal(pondTier({ pond: 9 }), 2);
  assert.ok(!hasTube({}) && hasTube({ pond: 1 }) && !hasPondPump({ pond: 1 }) && hasPondPump({ pond: 2 }));
});

test('the tube: 6 s to the stand at the gear factor you fed it with; the pump clears a ball every 8 s', () => {
  assert.equal(TUBE.DELAY, 6); assert.equal(TUBE.PUMP_EVERY, 8);
  assert.ok(Math.hypot(TUBE.BOX.x - POND.DOCK.x, TUBE.BOX.z - POND.DOCK.z) < POND.DOCK_R, 'the red box is on the dock');
  assert.ok(atTube({ x: TUBE.BOX.x, z: TUBE.BOX.z + 1 }) && !atTube({ x: 0, z: 0 }));
  const tube = newTube();
  tubeFeed(tube, 100, { n: 5, w: 6, kinds: ['range'], factor: 1.2 });
  tubeFeed(tube, 103, { n: 2, factor: 1 });
  tubeFeed(tube, 103, { n: 0 });
  assert.equal(tubeInFlight(tube), 7);
  assert.deepEqual(tubeArrivals(tube, 105.9), []);
  const a = tubeArrivals(tube, 106);
  assert.equal(a.length, 1); assert.equal(a[0].n, 5); assert.equal(a[0].factor, 1.2);
  assert.equal(tubeArrivals(tube, 109)[0].w, 2, 'w defaults to n');
  assert.equal(tubeInFlight(tube), 0);
  const p = newTube(); let cleared = 0;
  for (let i = 0; i < 160; i++) cleared += pondPumpStep(p, 0.1);   // 16 s
  assert.equal(cleared, 2);
  assert.equal(pondPumpStep(newTube(), 24), 3, 'a long step does not lose pumps');
});

test('12 treasures, the 1958 scorecard last and County-only', () => {
  assert.equal(TREASURE.length, 12);
  assert.equal(new Set(TREASURE.map(t => t.id)).size, 12);
  assert.equal(TREASURE.at(-1).id, 'scorecard'); assert.equal(TREASURE.at(-1).minVenue, 2);
  assert.match(TREASURE.at(-1).blurb, /Signed by the founder/);
  assert.equal(TREASURE[0].name, 'Car keys');
  assert.equal(TREASURE.filter(t => t.minVenue === 2).length, 1);
  for (const t of TREASURE) { assert.ok(t.name && t.blurb && t.mesh && t.fee === 200, t.id); assert.equal(TREASURE_BY_ID[t.id], t); }
  assert.match(TREASURE_BY_ID.trophy.blurb, /GARY/);
});

test('treasure turns up one at a time, in order', () => {
  assert.equal(nextTreasure([], 1).id, 'keys');
  assert.equal(nextTreasure(['keys', 'trophy'], 1).id, 'shades');
  const eleven = TREASURE.slice(0, 11).map(t => t.id);
  assert.equal(nextTreasure(eleven, 1), null, 'at the Club the scorecard is held back');
  assert.equal(nextTreasure(eleven, 2).id, 'scorecard');
  assert.equal(nextTreasure(TREASURE.map(t => t.id), 3), null, 'all found');
  assert.equal(nextTreasure(['pin'], 1).id, 'keys', 'order is by list, skipping only what is found');
  assert.equal(rollTreasure([], 0, () => 0), null, 'no pond before the Club');
  assert.equal(rollTreasure([], 1, () => 0.49).id, 'keys');
  assert.equal(rollTreasure([], 1, () => 0.5), null, '50% a morning');
  assert.equal(TREASURE_CHANCE, 0.5);
  const rng = seeded(11); let hits = 0;
  for (let i = 0; i < 2000; i++) if (rollTreasure([], 1, rng)) hits++;
  assert.ok(hits > 900 && hits < 1100, `about half the mornings (${hits})`);
});

test('treasure placement is deterministic and always lands in the Deep End', () => {
  for (const t of TREASURE) {
    const a = treasureSpot(1234, t.id), b = treasureSpot(1234, t.id);
    assert.deepEqual(a, b, t.id);
    assert.ok(inDeepEnd(a) && inPond(a), t.id);
  }
  const spots = new Set(TREASURE.map(t => treasureSpot(1234, t.id).x));
  assert.ok(spots.size > 6, 'different treasures lie in different spots');
  assert.notDeepEqual(treasureSpot(1, 'keys'), treasureSpot(2, 'keys'));
  for (let s = 0; s < 60; s++) assert.ok(inDeepEnd(treasureSpot(s * 977, 'duck')));
});

test('finder fee: 200 x BV, and the Lost & Found line', () => {
  assert.equal(finderFee('keys', 10), 2000);
  assert.equal(finderFee('keys', 10.35), 2070);
  assert.equal(finderFee('nope', 5), 1000);
  assert.equal(lostFoundLine([]), 'Lost & Found 0 / 12');
  assert.equal(lostFoundLine(['keys', 'duck', 'keys', 'junk']), 'Lost & Found 2 / 12');
  assert.deepEqual(cleanLostFound(['keys', 'x', 'keys', 7, null, 'tyre']), ['keys', 'tyre']);
  assert.deepEqual(cleanLostFound(undefined), []); assert.deepEqual(cleanLostFound('keys'), []);
});

test('water clarity: teal at 1, brown-green at 0, fog 6 + 8 x clarity, halved in the Deep End', () => {
  const clear = waterLook(1), murky = waterLook(0);
  assert.equal(clear.far, 14); assert.equal(murky.far, 6);
  assert.equal(waterLook(0.5).far, 10);
  assert.notEqual(clear.surface, murky.surface); assert.notEqual(clear.fog, murky.fog);
  assert.ok((clear.surface & 0xff) > (murky.surface & 0xff), 'the blue falls away as it clogs');
  assert.equal(waterLook(1, -12, -78).far, 14, 'the shelf');
  assert.equal(waterLook(1, -15, -83).far, 7, 'the floor of the Deep End');
  assert.equal(waterLook(2).far, 14); assert.equal(waterLook(-1).far, 6); assert.equal(waterLook(undefined).far, 14);
  assert.ok(waterLook(1, -15, -81).far < 14 && waterLook(1, -15, -81).far > 7, 'it darkens down the wall');
});
