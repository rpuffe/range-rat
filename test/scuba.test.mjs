// Scuba v2 rules (council round 3, section 4): the Deep End, dive gear, pump and haul, the tube,
// treasure and the Lost & Found case. All pure: web/js/dive.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { POND, inPond, SIM, SHOP_BY_ID, nextPrice } from '../web/js/sim.js';
import { Crew } from '../server/crew.mjs';
import { gearGrimeFactor } from '../web/js/sim.js';
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

test('the dive gear row: free mask, then $1,200 / $5,000 / $40,000 (the scooter, halved by the playtest)', () => {
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
  assert.equal(TREASURE.at(-1).id, 'scorecard'); assert.equal(TREASURE.at(-1).minVenue, 4);
  assert.match(TREASURE.at(-1).blurb, /Signed by the founder/);
  assert.equal(TREASURE[0].name, 'Car keys');
  assert.equal(TREASURE.filter(t => t.minVenue === 4).length, 1);
  for (const t of TREASURE) { assert.ok(t.name && t.blurb && t.mesh && t.fee === 200, t.id); assert.equal(TREASURE_BY_ID[t.id], t); }
  assert.match(TREASURE_BY_ID.trophy.blurb, /GARY/);
});

test('treasure turns up one at a time, in order', () => {
  assert.equal(nextTreasure([], 1).id, 'keys');
  assert.equal(nextTreasure(['keys', 'trophy'], 1).id, 'shades');
  const eleven = TREASURE.slice(0, 11).map(t => t.id);
  assert.equal(nextTreasure(eleven, 1), null, 'at the Club the scorecard is held back');
  assert.equal(nextTreasure(eleven, 2), null, 'not at Tiered');
  assert.equal(nextTreasure(eleven, 3), null, 'not at the Stadium');
  assert.equal(nextTreasure(eleven, 4).id, 'scorecard');
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

// ---- the crew-level rules (server/crew.mjs) ------------------------------------------------
function makeCrew(save = { venue: 1, day: 3 }, seed = 11) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('DIVE', save, { shiftSecs: 600, seed, now: () => clock.t });
  const step = (dt = 0.05) => { clock.t += dt * 1000; crew.tick(dt); };
  const run = secs => { for (let i = 0; i < Math.round(secs * 20); i++) step(); };
  return { crew, clock, run, step };
}
function openShift(crew) {
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
  crew.flush();
}
function addPlayer(crew, name, x, z) { const p = crew.join(name); crew.connect(p); p.x = x; p.z = z; return p; }
const act = (crew, p, ...a) => crew.input(p, { a });
const DOCK = POND.DOCK, DEEP = POND_DEEP;
const evs = crew => crew.flush().ev;
const sunkBall = (crew, kind = 'range', x = POND.x, z = POND.z) => {
  const b = crew.addBall({ x, y: POND.BOTTOM, z, vx: 0, vy: 0, vz: 0, kind }); b.sunk = true; b.rest = true; return b;
};

test('pump turns feed air: a cranking buddy beats the drain, holding alone does not, nobody pumping drains', () => {
  const airAfter = (turnsPerTick, held) => {
    const { crew, step } = makeCrew(); openShift(crew);
    const diver = addPlayer(crew, 'D', POND.x, POND.z), pumper = addPlayer(crew, 'P', DOCK.x, DOCK.z + 1);
    step(); diver.air = 10;
    for (let i = 0; i < 20; i++) { act(crew, pumper, { t: 'pump', turns: turnsPerTick, held }); step(); }
    return diver.air;
  };
  const none = airAfter(0, false), held = airAfter(0, true), crank = airAfter(0.125, false);
  assert.ok(Math.abs(none - 9) < 0.01, `drains 1 a second (${none})`);
  assert.ok(held < 10 && held > none, `held-only trickle is +0.5 a second against -1 (${held})`);
  assert.ok(crank > 10, `a full crank (2.5 turns a second) wins (${crank})`);
  assert.ok(crank <= diveTiers(0).air);
});

test('the old {t:"pump", on:true} still pumps; a pumper off the dock does nothing', () => {
  const { crew, step } = makeCrew(); openShift(crew);
  const diver = addPlayer(crew, 'D', POND.x, POND.z), pumper = addPlayer(crew, 'P', DOCK.x, DOCK.z + 1);
  step(); diver.air = 10;
  act(crew, pumper, { t: 'pump', on: true });
  for (let i = 0; i < 20; i++) step();
  assert.ok(pumper.pumping && diver.air > 9.3, `${diver.air}`);
  const far = addPlayer(crew, 'F', 0, 0);
  act(crew, far, { t: 'pump', turns: 1, on: true });
  assert.equal(far.pumping, false);
});

test('twin tanks: 70 s of air, and no x2 drain in the Deep End', () => {
  const { crew, step } = makeCrew({ venue: 1, day: 3, diveByName: { Tw: 2 } }); openShift(crew);
  const tw = addPlayer(crew, 'Tw', DEEP.x, DEEP.z), mask = addPlayer(crew, 'Mk', DEEP.x + 0.5, DEEP.z);
  assert.equal(tw.dive, 2); assert.equal(tw.air, 70); assert.equal(mask.air, 20);
  step();
  for (let i = 0; i < 20; i++) step();
  assert.ok(Math.abs(tw.air - 68.95) < 0.2, `x1 (${tw.air})`);
  assert.ok(Math.abs(mask.air - 17.9) < 0.2, `x2 (${mask.air})`);
});

test('the bag follows the tier: mask 10, tank 15', () => {
  const { crew } = makeCrew({ venue: 1, day: 3, diveByName: { Tk: 1 } }); openShift(crew);
  const mask = addPlayer(crew, 'Mk', POND.x, POND.z), tank = addPlayer(crew, 'Tk', POND.x, POND.z);
  crew.tick(0.05);
  const balls = Array.from({ length: 20 }, () => sunkBall(crew));
  for (const b of balls) { act(crew, mask, { t: 'pickup', ball: b.id, pond: true }); }
  assert.equal(mask.bag, 10);
  for (const b of balls) { act(crew, tank, { t: 'pickup', ball: b.id, pond: true }); }
  assert.equal(tank.bag, 10, 'only 10 were left');
  const more = Array.from({ length: 10 }, () => sunkBall(crew));
  for (const b of more) act(crew, tank, { t: 'pickup', ball: b.id, pond: true });
  assert.equal(tank.bag, 15);
});

test('send and haul: the diver keeps diving, the buddy lands the bag, it ignores pocket capacity', () => {
  const { crew, step } = makeCrew(); openShift(crew);
  const diver = addPlayer(crew, 'D', POND.x, POND.z), hauler = addPlayer(crew, 'H', DOCK.x, DOCK.z + 1);
  step();
  diver.bag = 7; diver.bagW = 9; diver.bagKinds = Array(7).fill('range');
  act(crew, diver, { t: 'send' });
  assert.equal(diver.bag, 0); assert.equal(crew.line.n, 7);
  assert.deepEqual(evs(crew).filter(e => e.t === 'sent').map(e => e.n), [7]);
  act(crew, diver, { t: 'send' });                       // an empty bag sends nothing
  assert.equal(crew.line.n, 7);
  // holding for 1.5 s lands it; a short tap does not
  act(crew, hauler, { t: 'haul' }); for (let i = 0; i < 10; i++) { step(0.1); act(crew, hauler, { t: 'haul' }); }
  assert.equal(hauler.pocket, 0, '1 s is not enough');
  act(crew, hauler, { t: 'haul', held: false });
  assert.equal(hauler.haulHeld, 0);
  act(crew, hauler, { t: 'haul' });
  for (let i = 0; i < 17; i++) { step(0.1); act(crew, hauler, { t: 'haul' }); }
  assert.equal(hauler.pocket, 7); assert.equal(hauler.pocketW, 9); assert.equal(crew.line.n, 0);
  assert.ok(evs(crew).some(e => e.t === 'hauled' && e.n === 7));
  // a hauler can't haul from the water
  crew.line.n = 3; act(crew, diver, { t: 'haul' }); assert.equal(diver.pocket, 0);
});

test('a gasp spills the bag in the diver\'s hands but a bag already on the line is safe', () => {
  const { crew, step } = makeCrew(); openShift(crew);
  const d = addPlayer(crew, 'D', POND.x, POND.z); step();
  d.bag = 4; d.bagW = 4; d.bagKinds = Array(4).fill('range');
  act(crew, d, { t: 'send' });
  d.bag = 2; d.bagW = 2; d.bagKinds = ['range', 'range'];
  d.air = 0.01; step();
  assert.ok(evs(crew).some(e => e.t === 'gasp'));
  assert.equal(crew.line.n, 4, 'the line is safe');
  assert.equal(crew.sunkCount(), 2, 'the carried bag spilled back');
});

test('unhauled bags bank at half pay at the bell', () => {
  const cashAfterBell = w => { const { crew } = makeCrew(); openShift(crew); crew.line.n = w; crew.line.w = w; crew.endShift(); assert.equal(crew.line.n, 0); return crew.cash; };
  const base = cashAfterBell(0), ten = cashAfterBell(10) - base, twenty = cashAfterBell(20) - base;
  assert.ok(ten > 0 && Math.abs(twenty - 2 * ten) < 0.05, `${ten} vs ${twenty}`);
  // half pay: what the night crew banks is 10 balls' weight x 0.5, at the value the bell sees
  const { crew } = makeCrew(); openShift(crew);
  const real = crew.bank.bind(crew); let seen = null;
  crew.bank = (n, by, kind, w, g) => { if (by === 'night') seen = { n, w, v: crew.valueNow() }; return real(n, by, kind, w, g); };
  crew.line.n = 10; crew.line.w = 10; crew.endShift();
  assert.deepEqual([seen.n, seen.w], [10, 5], 'ten balls, half the weight');
});

test('lead and gold roll into the Deep End', () => {
  const { crew } = makeCrew(); openShift(crew);
  for (const kind of ['lead', 'gold', 'lead']) crew.sinkNew(kind);
  const b = crew.addBall({ x: POND.x + 3, y: 0.05, z: POND.z + 2, vx: 0, vy: 0, vz: 0, kind: 'lead' });
  crew.sink(b);
  const g = crew.addBall({ x: POND.x - 2, y: 0.05, z: POND.z - 1, vx: 0, vy: 0, vz: 0, kind: 'gold' });
  crew.sink(g);
  const range = crew.addBall({ x: POND.x + 3, y: 0.05, z: POND.z + 2, vx: 0, vy: 0, vz: 0, kind: 'range' });
  crew.sink(range);
  const sunk = [...crew.balls.values()].filter(x => x.sunk);
  assert.equal(sunk.length, 6);
  for (const x of sunk) {
    if (x.kind === 'range') { assert.equal(x.x, POND.x + 3); assert.equal(x.y, POND.BOTTOM); continue; }
    assert.ok(inDeepEnd(x) && inPond(x), `${x.kind} at ${x.x},${x.z}`);
    assert.ok(Math.abs(x.y - bedAt(x.x, x.z)) < 1e-9);
  }
});

test('treasure: a morning roll, one per shift, in order, from the Club on', () => {
  let ever = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const { crew } = makeCrew({ venue: 1, day: 3 }, seed); openShift(crew);
    if (crew.treasure) { ever++; assert.equal(crew.treasure.id, 'keys'); assert.ok(inDeepEnd(crew.treasure)); assert.ok(inPond(crew.treasure)); }
    // a second morning can't stack another on top of one that is still down there
    const before = crew.treasure;
    crew.phase = 'report'; crew.startShift();
    if (before) assert.equal(crew.treasure.id, 'keys', 'still the same one');
  }
  assert.ok(ever > 2 && ever < 11, `about half the mornings (${ever}/12)`);
  const muni = makeCrew({ venue: 0, day: 3 }).crew; openShift(muni);
  assert.equal(muni.treasure, null);
});

test('treasure: pick it up in the Deep End, bank it at the stand for 200 x BV, lostFound round-trips the save', () => {
  const { crew, step } = makeCrew({ venue: 1, day: 3, lostFound: ['keys'] }); openShift(crew);
  assert.deepEqual(crew.lostFound, ['keys']);
  crew.treasure = { id: 'trophy', x: DEEP.x, z: DEEP.z };
  const d = addPlayer(crew, 'D', DEEP.x, DEEP.z), other = addPlayer(crew, 'O', POND.x + 4, POND.z); step();
  act(crew, other, { t: 'treasure' });
  assert.equal(other.treasure, null, 'too far away');
  act(crew, d, { t: 'treasure' });
  assert.equal(d.treasure, 'trophy'); assert.equal(crew.treasure, null);
  assert.equal(crew.snapshot().players.find(p => p.id === d.id).treasure, 'trophy');
  d.x = POND.DOCK.x; d.z = POND.DOCK.z + 4; step();               // surfaced with it
  assert.equal(d.treasure, 'trophy');
  d.x = SIM.STAND.x; d.z = SIM.STAND.z; step(); crew.flush();
  const bv = crew.valueNow().bv, cash0 = crew.cash;
  crew.paShift = 0; crew.paAt = 0;
  act(crew, d, { t: 'deposit' });
  assert.equal(d.treasure, null);
  assert.deepEqual(crew.lostFound, ['keys', 'trophy']);
  assert.ok(Math.abs(crew.cash - cash0 - 200 * bv) < 0.01, `fee ${crew.cash - cash0} vs ${200 * bv}`);
  const e = evs(crew);
  assert.ok(e.some(x => x.t === 'treasure' && x.phase === 'banked' && x.id === 'trophy' && x.fee > 0));
  assert.ok(e.some(x => x.t === 'pa' && x.id === 'treasure'), 'the first-treasure PA line');
  assert.deepEqual(crew.snapshot().pond.lostFound, ['keys', 'trophy']);
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.equal(save.v, 4); assert.deepEqual(save.lostFound, ['keys', 'trophy']);
  const back = new Crew('DIVE', save, { shiftSecs: 600, seed: 3 });
  assert.deepEqual(back.lostFound, ['keys', 'trophy']);
});

test('treasure: a knockdown drops it at your feet, a gasp sends it back to the Deep End, one carrier at a time', () => {
  const { crew, step } = makeCrew(); openShift(crew);
  crew.treasure = { id: 'duck', x: DEEP.x, z: DEEP.z };
  const d = addPlayer(crew, 'D', DEEP.x, DEEP.z), o = addPlayer(crew, 'O', DEEP.x + 0.4, DEEP.z); step();
  act(crew, d, { t: 'treasure' });
  act(crew, o, { t: 'treasure' });
  assert.equal(d.treasure, 'duck'); assert.equal(o.treasure, null);
  d.x = POND.x + 2; d.z = POND.z; d.down = 1; step();
  assert.equal(d.treasure, null);
  assert.equal(crew.treasure.id, 'duck'); assert.ok(Math.hypot(crew.treasure.x - (POND.x + 2), crew.treasure.z - POND.z) < 0.5, 'at their feet');
  d.down = 0; d.x = crew.treasure.x; d.z = crew.treasure.z; act(crew, d, { t: 'treasure' });
  assert.equal(d.treasure, 'duck');
  d.air = 0.01; step();
  assert.equal(d.treasure, null);
  assert.ok(inDeepEnd(crew.treasure), 'back in the Deep End');
});

test('the dive gear row is bought from the crew wallet at catalog price, kept by name', () => {
  const { crew } = makeCrew({ venue: 1, day: 3 }); openShift(crew);
  const a = addPlayer(crew, 'Ann', 20, 5), b = addPlayer(crew, 'Bob', 20, 5);
  crew.cash = 100_000;
  assert.equal(nextPrice('dive', {}, 2, a.dive, 1), 1200, 'not price-scaled by crew size');
  assert.equal(crew.buy(a, 'dive'), true); assert.equal(a.dive, 1); assert.equal(crew.cash, 98_800);
  assert.equal(crew.buy(a, 'dive'), true); assert.equal(crew.cash, 93_800);
  assert.equal(crew.buy(a, 'dive'), false, 'the scooter is a County purchase');
  assert.equal(b.dive, 0); assert.equal(a.gear, crew.up.gear ?? 0, 'carrying gear untouched');
  assert.deepEqual(crew.toSave().diveByName, { Ann: 2 });
  const back = new Crew('DIVE', JSON.parse(JSON.stringify(crew.toSave())), { shiftSecs: 600, seed: 5 });
  const again = back.join('Ann'); assert.equal(again.dive, 2); assert.equal(again.air, 70);
  crew.venue = 2; assert.equal(crew.buy(a, 'dive'), true); assert.equal(a.dive, 3);
  const muni = makeCrew({ venue: 0, day: 3 }).crew; const m = addPlayer(muni, 'M', 20, 5); muni.cash = 99_999;
  assert.equal(muni.buy(m, 'dive'), false, 'no pond before the Club');
  assert.ok(SHOP_BY_ID.dive && SHOP_BY_ID.pond);
});

test('saves from before v3 load with empty dive gear and an empty case', () => {
  const old = { v: 2, code: 'OLD', day: 5, cash: 10, venue: 1, gear: { Ann: 2 } };
  const crew = new Crew('OLD', old, { shiftSecs: 600, seed: 1 });
  assert.deepEqual(crew.diveByName, {}); assert.deepEqual(crew.lostFound, []);
  assert.equal(crew.join('Ann').dive, 0);
  const junk = new Crew('JNK', { diveByName: { A: 9, B: -1, C: 'x', D: 2 }, lostFound: ['keys', 'keys', 'nope', 5] }, { shiftSecs: 600, seed: 1 });
  assert.deepEqual(junk.diveByName, { A: 3, D: 2 }); assert.deepEqual(junk.lostFound, ['keys']);
  assert.equal(crew.toSave().v, 4);
  assert.equal(crew.up.gear, 2, 'owner playtest 3 §5.2: the old bucket by name became the crew gear');
});

test('the pneumatic tube: feed it by the dock, balls bank at the stand 6 s later at the gear factor you fed with', () => {
  const { crew, step, run } = makeCrew({ venue: 1, day: 3, up: { pond: 1 } }); openShift(crew);
  const p = addPlayer(crew, 'T', TUBE.BOX.x, TUBE.BOX.z + 0.5); step();
  p.pocket = 6; p.pocketW = 6;
  const bv = crew.valueNow(), cash0 = crew.cash;
  act(crew, p, { t: 'feed' });
  assert.equal(p.pocket, 0);
  assert.equal(crew.snapshot().pond.tube, 6);
  run(5.5); assert.equal(crew.cash, cash0, 'still in the tube');
  run(1);
  assert.ok(crew.cash > cash0 && Math.abs(crew.cash - cash0 - 6 * bv.bv * bv.hustle * gearGrimeFactor(p.grime)) < 0.02);
  assert.ok(evs(crew).some(e => e.t === 'thunk' && e.n === 6));
  const noTube = makeCrew(); openShift(noTube.crew);
  const q = addPlayer(noTube.crew, 'Q', TUBE.BOX.x, TUBE.BOX.z + 0.5); q.pocket = 3;
  act(noTube.crew, q, { t: 'feed' });
  assert.equal(q.pocket, 3, 'no tube bought yet');
});

test('the pond pump clears one sunk ball every 8 s through the tube', () => {
  const { crew, run } = makeCrew({ venue: 1, day: 3, up: { pond: 2 } }); openShift(crew);
  const before = crew.sunkCount();
  for (let i = 0; i < 6; i++) sunkBall(crew);
  run(16.5);
  assert.equal(crew.sunkCount(), before + 6 - 2);
  const cash0 = crew.cash; run(6); assert.ok(crew.cash > cash0, 'banked by the tube');
});

test('the pond row is a crew row: priced by crew size, Club and up', () => {
  assert.equal(nextPrice('pond', {}, 1, 0, 1), 4000);
  assert.equal(nextPrice('pond', {}, 4, 0, 1), 8800);
  assert.equal(nextPrice('pond', {}, 1, 0, 0), null);
});

// ---- council round 6 #9: scuba you can follow from the dock (web/js/scubafollow.js, pure) ----
import { FOLLOW, pickGlints, bagAt, boilBubble, caseSpin } from '../web/js/scubafollow.js';

test('round 6 #9: the glint selector picks only sunk lead and gold inside the torch cone and range, nearest first, ≤ 20', () => {
  const eye = { x: 0, y: -1, z: 0 }, dir = { x: 0, y: 0, z: -1 };
  const balls = [
    { id: 1, kind: 'lead', sunk: true, x: 0, y: -1, z: -2 },        // dead ahead, 2 m
    { id: 2, kind: 'gold', sunk: true, x: 0.5, y: -1, z: -5 },      // ahead, 5 m
    { id: 3, kind: 'gold', sunk: true, x: 0, y: -1, z: -6.5 },      // out of range
    { id: 4, kind: 'lead', sunk: true, x: 3, y: -1, z: -1 },        // outside the cone
    { id: 5, kind: 'lead', sunk: true, x: 0, y: -1, z: 3 },         // behind
    { id: 6, kind: 'range', sunk: true, x: 0, y: -1, z: -1 },       // not lead or gold
    { id: 7, kind: 'gold', sunk: false, x: 0, y: -1, z: -1 },       // not sunk
  ];
  assert.deepEqual(pickGlints(balls, eye, dir).map(b => b.id), [1, 2]);
  const many = Array.from({ length: 40 }, (_, i) => ({ id: i, kind: i % 2 ? 'gold' : 'lead', sunk: true, x: 0, y: -1, z: -0.5 - i * 0.1 }));
  const got = pickGlints(many, eye, dir);
  assert.equal(got.length, FOLLOW.GLINT_MAX);
  assert.equal(got[0].id, 0, 'nearest first');
  assert.ok(Math.abs(FOLLOW.GLINT_COS - Math.cos(0.5)) < 1e-12, 'the cone is the torch\'s');
});

test('round 6 #9: the bag tween starts at the diver and ends at the dock', () => {
  const from = { x: 3, y: -2.4, z: -1 }, to = { x: POND.DOCK.x, y: 0.3, z: POND.DOCK.z };
  assert.deepEqual(bagAt(from, to, 0), from);
  const end = bagAt(from, to, 1);
  for (const k of ['x', 'y', 'z']) assert.ok(Math.abs(end[k] - to[k]) < 1e-9, k);
  const mid = bagAt(from, to, 0.5);
  assert.ok(mid.y > (from.y + to.y) / 2, 'it climbs first, then runs along the line');
  assert.equal(bagAt(from, to, 1.01), null, 'done');
  assert.equal(bagAt(from, to, -0.1), null);
  assert.ok(FOLLOW.BAG_SECS > 1 && FOLLOW.BAG_SECS < 3);
});

test('round 6 #9: the surface boil: 8 bubbles in a 0.6 m ring over the diver, the same on every client', () => {
  for (let k = 0; k < FOLLOW.BOIL_N; k++) {
    const b = boilBubble(10, 20, k, 0, 3.3);
    assert.ok(Math.hypot(b.x - 10, b.z - 20) <= FOLLOW.BOIL_R + 1e-9);
    assert.ok(b.rise >= 0 && b.rise < 1 && b.alpha >= 0 && b.size > 0);
    assert.deepEqual(boilBubble(10, 20, k, 0, 3.3), b, 'deterministic');
  }
});

test('round 6 #9: the Lost & Found reveal spins for 2 s, then stops', () => {
  assert.equal(caseSpin(0).turn, 0);
  assert.ok(caseSpin(1).turn > Math.PI * 4);
  assert.equal(caseSpin(2), null);
  assert.equal(caseSpin(-1), null);
});
