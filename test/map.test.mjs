import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIM, POND, KIND_PHYS, MATS, launch, mulberry32, advanceBall, CREEK_DIVE } from '../web/js/sim.js';
import {
  MAP, surfaceAt, creekProject, creekPoint, creekLength, cartBlocked, wadeFactor, onBridge, keepInField,
  netClamp, obstacleBounce, ballFeatures, landBall, groundContact, startDrift, stepDrift, driftAt, driftSecs, driftEvent,
  sinkSpot, restSpot, nearestLandmark, landmarksFor, inPondArea,
  SNAG, snags, snagS, snagSpot, inCreekWater, inCreekChannel, creekCurrent,
} from '../web/js/map.js';

const DRY = { venue: 0 }, WET = { venue: 1 }, LATE = { venue: 3 };

// A reference stepper: today's stepOnce, with the ground block swapped for map.js's groundContact and the
// net/obstacle pass after the move. This is exactly the integration the sim owner will paste in.
function step(b, world) {
  const dt = SIM.STEP, R = SIM.BALL_R, k = KIND_PHYS[b.kind];
  b.vy -= SIM.G * dt;
  if (k?.drift && b.y > R) { b.vx += k.drift * dt; b.vx -= b.vx * k.drag * dt; b.vz -= b.vz * k.drag * dt; }
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  ballFeatures(b);
  if (b.y < R) return groundContact(b, world, k);
  return null;
}
// Run until it rests or drifts. Returns { out, steps, contact } where contact is the first ground-touch spot.
function fly(b, world, maxSteps = 120 * 60) {
  let contact = null;
  for (let i = 0; i < maxSteps; i++) {
    const wasAir = b.y > SIM.BALL_R;
    const out = step(b, world);
    if (!contact && b.y <= SIM.BALL_R + 1e-9 && wasAir) contact = { x: b.x, z: b.z };
    if (out) return { out, steps: i + 1, contact: contact ?? { x: b.x, z: b.z } };
  }
  return { out: null, steps: maxSteps, contact };
}

test('map.js mirrors the sim constants it must not import', () => {
  assert.equal(SIM.BALL_R, 0.06);
  assert.equal(SIM.STEP, 1 / 120);
  assert.equal(SIM.ROLL_DECEL, 3.2);
  assert.equal(MAP.POND.x, POND.x); assert.equal(MAP.POND.z, POND.z); assert.equal(MAP.POND.r, POND.r);
  assert.equal(MAP.POND.FROM_VENUE, POND.FROM_VENUE);
});

test('geometry: the creek meets the pond, the bridges sit on the creek, crossings are perpendicular', () => {
  const dIn = Math.hypot(MAP.CREEK.IN.at(-1)[0] - POND.x, MAP.CREEK.IN.at(-1)[1] - POND.z);
  const dOut = Math.hypot(MAP.CREEK.OUT[0][0] - POND.x, MAP.CREEK.OUT[0][1] - POND.z);
  assert.ok(Math.abs(dIn - POND.r) < 0.3 && Math.abs(dOut - POND.r) < 0.3, `inlet ${dIn}, outlet ${dOut}`);
  assert.ok(Math.hypot(MAP.DELTA.x - POND.x, MAP.DELTA.z - POND.z) < POND.r, 'the Delta is in the pond');
  assert.ok(Math.abs(creekLength('in') - 58.6) < 0.5 && Math.abs(creekLength('out') - 78) < 0.5);
  for (const b of MAP.BRIDGES) {
    assert.ok(creekProject(b.x, b.z).d < 0.05, `${b.id} is on the creek centreline`);
    assert.ok(Math.abs(Math.cos(b.yaw) * b.ux - Math.sin(b.yaw) * b.uz) < 1e-9, `${b.id} yaw is across the flow`);
  }
  assert.equal(MAP.BRIDGES.filter(b => b.cart).length, 1);
  for (const o of [...MAP.ROCKS, ...MAP.BOXES, ...MAP.FLAGS]) assert.ok(creekProject(o.x, o.z).d > 5, `${o.id} clear of the creek`);
});

test('golden: balls that never touch a feature fly exactly as today, to the millimetre', () => {
  const rng = mulberry32(1234);
  let compared = 0;
  for (let i = 0; i < 400; i++) {
    const mat = MATS[i % MATS.length];
    const l = launch(mat, rng);
    const kind = ['range', 'range', 'bouncy', 'foam', 'square'][i % 5];
    const a = { ...l, kind }, b = { ...l, kind };
    let touched = false;
    // the new stepper, watching what it lands on and where
    for (let n = 0; n < 120 * 40 && !b.rest; n++) {
      const x = b.x, z = b.z;
      const out = step(b, DRY);
      if (b.y <= SIM.BALL_R + 1e-9 && surfaceAt(b.x, b.z, DRY) !== 'fairway') touched = true;
      if (Math.abs(b.x) > MAP.NETS.side - 2 || b.z < MAP.NETS.back + 2) touched = true;
      if (Math.hypot(b.x - MAP.ROCKS[0].x, b.z - MAP.ROCKS[0].z) < 6 || Math.hypot(b.x - MAP.BOXES[0].x, b.z - MAP.BOXES[0].z) < 6) touched = true;
      if (out === 'rest') break;
      void x; void z;
    }
    if (touched) continue;
    for (let n = 0; n < 120 * 40 && !a.rest; n++) advanceBall(a, SIM.STEP);
    assert.ok(Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.z - b.z) < 1e-3, `ball ${i} (${kind}): ${a.x},${a.z} vs ${b.x},${b.z}`);
    compared++;
  }
  assert.ok(compared > 100, `only ${compared} untouched balls compared`);
});

test('gravel stops a ball within 0.5 m at venue 0', () => {
  for (const branch of ['in', 'out']) for (const s of [6, 14, 30, 45]) {
    const p = creekPoint(branch, s);
    if (inPondArea(p.x, p.z) || onBridge(p.x, p.z, 1)) continue;
    assert.equal(surfaceAt(p.x, p.z, DRY), 'gravel');
    for (const hs of [8, 20, 35]) for (const vy of [-4, -10, -22]) {
      // a landing: first ground contact is on the spot, with a carry along +x/-z like a customer's ball
      const vx = hs * 0.6, vz = -hs * 0.8;
      const b = { x: p.x - vx * SIM.STEP, y: SIM.BALL_R + 0.004, z: p.z - vz * SIM.STEP, vx, vy, vz, kind: 'range' };
      const r = fly(b, DRY);
      assert.equal(r.out, 'rest', 'comes to rest');
      assert.equal(surfaceAt(r.contact.x, r.contact.z, DRY), 'gravel', 'it landed in the bed');
      assert.ok(Math.hypot(b.x - r.contact.x, b.z - r.contact.z) <= 0.5, `${branch} s=${s} hs=${hs} vy=${vy}: ${Math.hypot(b.x - r.contact.x, b.z - r.contact.z).toFixed(2)} m`);
    }
  }
  // a ball already rolling into the bed stops dead soon after (roll x6)
  const p = creekPoint('in', 14);
  const rolling = { x: p.x - 0.8, y: SIM.BALL_R, z: p.z, vx: 2, vy: 0, vz: 0, kind: 'range' };
  assert.equal(fly(rolling, DRY).out, 'rest');
  assert.ok(Math.hypot(rolling.x - p.x + 0.8, rolling.z - p.z) < 0.5);
});

test('mud sticks where it lands at the Muni; the pond is open water from the Club', () => {
  const b = { x: POND.x + 2, y: 0.4, z: POND.z, vx: 6, vy: -8, vz: -3, kind: 'range' };
  const r = fly(b, DRY);
  assert.equal(r.out, 'rest');
  assert.ok(Math.hypot(b.x - r.contact.x, b.z - r.contact.z) < 0.01, 'stuck on the spot');
  assert.equal(landBall({ x: POND.x, z: POND.z }, DRY).action, 'stick');
  assert.equal(landBall({ x: POND.x, z: POND.z }, WET).action, 'sink');   // the server's existing sink() takes it from here
});

test('wet: a ball landing in the water drifts down the inflow to the Delta and sinks', () => {
  const p = creekPoint('in', 10);
  const b = { id: 7, x: p.x, y: 0.4, z: p.z, vx: 5, vy: -9, vz: -3, kind: 'range' };
  assert.equal(fly(b, WET).out, 'drift');
  assert.deepEqual([b.vx, b.vy, b.vz], [0, 0, 0]);
  const d = startDrift(b, WET);
  assert.equal(d.branch, 'in'); assert.ok(Math.abs(d.s0 - 10) < 0.5);
  assert.equal(b.drifting, true);
  assert.deepEqual(driftEvent(b), { t: 'drift', id: 7, branch: 'in', s0: d.s0, v: 1.5 });
  const secs = driftSecs('in', d.s0);
  assert.ok(secs > 30 && secs < 39.5);
  // the server's stepping and the client's closed form agree all the way down
  let t = 0, out = null;
  while (!out && t < 60) {
    out = stepDrift(b, 0.05); t += 0.05;
    if (!out) { const a = driftAt(d, t); assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.01); }
  }
  assert.equal(out, 'sink');
  assert.ok(Math.abs(t - secs) < 0.1, `${t} vs ${secs}`);
  assert.equal(b.drifting, false);
  assert.ok(Math.hypot(b.x - MAP.DELTA.x, b.z - MAP.DELTA.z) <= MAP.DELTA.r + 1e-9, 'sinks in the Delta');
  assert.ok(inPondArea(b.x, b.z), 'which is inside the pond');
  assert.equal(driftAt(d, 999).end, 'sink');
  assert.equal(driftAt(d, 1).end, null);
  // the longest ride is len / DRIFT: about 39 s
  assert.ok(Math.abs(driftSecs('in', 0) - creekLength('in') / 1.5) < 1e-9);
});

test('wet: outflow balls rest in a pile at the Grate, inside the net', (t) => {
  SNAG.ON = 0; t.after(() => { SNAG.ON = 1; });   // council round 10 #5: no snags here (the riders that reach the Grate)
  const ids = [];
  for (let id = 1; id <= 30; id++) {
    const p = creekPoint('out', 36 + (id % 7));   // downstream of the Cart Bridge, upstream of the Stones
    const b = { id, x: p.x, y: SIM.BALL_R, z: p.z, vx: 0, vy: 0, vz: 0, kind: 'range' };
    const d = startDrift(b, LATE);
    assert.equal(d.branch, 'out');
    let out = null, t = 0;
    while (!out && t < 80) { out = stepDrift(b, 0.1); t += 0.1; }
    assert.equal(out, 'rest');
    assert.equal(b.rest, true);
    assert.ok(Math.hypot(b.x - MAP.GRATE.x, b.z - MAP.GRATE.z) <= MAP.GRATE.r, `ball ${id} in the Grate pile`);
    assert.ok(b.x <= MAP.NETS.side, 'inside the net');
    ids.push(`${b.x.toFixed(2)},${b.z.toFixed(2)}`);
  }
  assert.ok(new Set(ids).size > 20, 'the pile is scattered, not one point');
  assert.ok(driftSecs('out', 0) < 52 && driftSecs('out', 0) > 50);
  assert.deepEqual(restSpot(5), restSpot(5));
  assert.ok(Math.hypot(sinkSpot(5).x - MAP.DELTA.x, sinkSpot(5).z - MAP.DELTA.z) <= MAP.DELTA.r);
});

test('dry creek never drifts; kind one ignores the water', () => {
  const p = creekPoint('in', 10);
  assert.equal(startDrift({ id: 1, x: p.x, z: p.z, kind: 'range' }, DRY), null);
  assert.equal(landBall({ x: p.x, z: p.z, kind: 'range' }, DRY).action, 'dead');
  assert.equal(landBall({ x: p.x, z: p.z, kind: 'one' }, WET).action, 'bounce');
});

test('cartBlocked: shut off the bridge, open on it, identical wet or dry', () => {
  const cb = MAP.BRIDGES.find(b => b.cart);
  // along the bridge's length (across the creek) every point on the deck is open
  for (let a = -6; a <= 6; a += 0.25) {
    const x = cb.x + -cb.uz * a, z = cb.z + cb.ux * a;
    assert.equal(cartBlocked(x, z, DRY), false, `bridge a=${a}`);
    assert.equal(cartBlocked(x, z, LATE), false);
  }
  // the creek bed and its 1 m margin, anywhere else, is blocked
  for (const branch of ['in', 'out']) for (let s = 0; s < creekLength(branch); s += 2) {
    const p = creekPoint(branch, s);
    if (onBridge(p.x, p.z)?.cart) continue;
    assert.equal(cartBlocked(p.x, p.z, DRY), true, `${branch} ${s}`);
  }
  // beside the bridge, along the bank, blocked; the foot crossings are not for carts
  assert.equal(cartBlocked(cb.x + cb.ux * 6, cb.z + cb.uz * 6, DRY), true);
  assert.equal(cartBlocked(-38, -52, DRY), true);
  assert.equal(cartBlocked(40, -106, DRY), true);
  // pond, rock, tractor, nets
  assert.equal(cartBlocked(POND.x, POND.z, DRY), true);
  assert.equal(cartBlocked(POND.x + POND.r + 0.5, POND.z, DRY), true);
  assert.equal(cartBlocked(34 + 3.0, -150, DRY), true);
  assert.equal(cartBlocked(-48, -128 + 2.0, DRY), true);
  assert.equal(cartBlocked(65, -20, DRY), true);
  assert.equal(cartBlocked(0, -191, DRY), true);
  // the yard and the open field are fine
  assert.equal(cartBlocked(31, 10, DRY), false);
  assert.equal(cartBlocked(0, -20, DRY), false);
  assert.equal(cartBlocked(26, -76, DRY), false);
  // identical for every venue, everywhere
  const rng = mulberry32(99);
  for (let i = 0; i < 4000; i++) {
    const x = -70 + rng() * 140, z = -195 + rng() * 215;
    assert.equal(cartBlocked(x, z, DRY), cartBlocked(x, z, LATE));
    assert.equal(cartBlocked(x, z, DRY), cartBlocked(x, z));
  }
});

test('netClamp keeps every ball inside the nets', () => {
  const rng = mulberry32(5);
  for (let i = 0; i < 300; i++) {
    const b = { x: (rng() - 0.5) * 120, y: 0.1, z: -rng() * 150, vx: (rng() - 0.5) * 120, vy: rng() * 30, vz: (rng() - 0.9) * 120, kind: 'range' };
    for (let n = 0; n < 120 * 30 && !b.rest; n++) {
      const out = step(b, i % 2 ? DRY : LATE);
      assert.ok(Math.abs(b.x) <= MAP.NETS.side + 1e-9 && b.z >= MAP.NETS.back - 1e-9, `ball ${i} escaped: ${b.x}, ${b.z}`);
      if (out) break;
    }
  }
  // the physics of the catch: normal x0.1 reversed, tangential x0.4
  const b = { x: 65, y: 3, z: -50, vx: 20, vy: 5, vz: -10 };
  assert.equal(netClamp(b), true);
  assert.equal(b.x, MAP.NETS.side);
  assert.ok(Math.abs(b.vx + 2) < 1e-9 && Math.abs(b.vz + 4) < 1e-9 && Math.abs(b.vy - 2) < 1e-9);
  const c = { x: 0, y: 3, z: -191, vx: 3, vy: 0, vz: -30 };
  netClamp(c);
  assert.equal(c.z, MAP.NETS.back); assert.ok(Math.abs(c.vz - 3) < 1e-9);
  assert.equal(netClamp({ x: 0, y: 1, z: -100, vx: 1, vy: 1, vz: 1 }), false);
});

test('rock and tractor reflect low balls at x0.5 and let high ones pass', () => {
  const rock = MAP.ROCKS[0];
  const b = { x: rock.x - rock.r + 0.01, y: 0.5, z: rock.z, vx: 10, vy: 0, vz: 0 };
  assert.equal(obstacleBounce(b), true);
  assert.ok(b.x <= rock.x - rock.r && Math.abs(b.vx + 5) < 1e-9, `${b.x} ${b.vx}`);
  const hi = { x: rock.x - 1, y: rock.h + 1, z: rock.z, vx: 10, vy: 0, vz: 0 };
  assert.equal(obstacleBounce(hi), false);
  const t = MAP.BOXES[0];
  const c = { x: t.x, y: 0.5, z: t.z + t.d / 2 - 0.05, vx: 0, vy: 0, vz: -8 };
  assert.equal(obstacleBounce(c), true);
  assert.ok(c.z >= t.z + t.d / 2 && Math.abs(c.vz - 4) < 1e-9);
  assert.equal(obstacleBounce({ x: t.x, y: 0.5, z: t.z + 6, vx: 0, vy: 0, vz: -8 }), false);
});

test('surfaceAt sanity on landmarks and against the exact creek test', () => {
  for (const w of [DRY, WET, LATE]) {
    for (const f of MAP.FLAGS) assert.equal(surfaceAt(f.x, f.z, w), 'fairway', f.id);
    assert.equal(surfaceAt(MAP.ROCKS[0].x, MAP.ROCKS[0].z, w), 'fairway');
    assert.equal(surfaceAt(MAP.BOXES[0].x, MAP.BOXES[0].z, w), 'fairway');
    for (const b of MAP.BRIDGES) assert.equal(surfaceAt(b.x, b.z, w), 'fairway', `${b.id} deck`);
    assert.equal(surfaceAt(31, 10, w), 'fairway');
    assert.equal(surfaceAt(0, 0, w), 'fairway');
  }
  const mid = creekPoint('in', 12);
  assert.equal(surfaceAt(mid.x, mid.z, DRY), 'gravel');
  assert.equal(surfaceAt(mid.x, mid.z, WET), 'water');
  assert.equal(surfaceAt(POND.x, POND.z, DRY), 'mud');
  assert.equal(surfaceAt(POND.x, POND.z, WET), 'pond');
  const g = creekPoint('out', 76);
  assert.equal(surfaceAt(g.x, g.z, DRY), 'gravel'); assert.equal(surfaceAt(g.x, g.z, LATE), 'water');
  assert.equal(surfaceAt(MAP.GRATE.x, MAP.GRATE.z, LATE), 'water');
  // the broad-phase grid never disagrees with the exact answer
  const rng = mulberry32(42);
  for (let i = 0; i < 20000; i++) {
    const x = -64.9 + rng() * 129.8, z = -192 + rng() * 203;
    const exact = inPondArea(x, z) ? 'p' : creekProject(x, z).d < MAP.CREEK.HW && !onBridge(x, z) ? 'c' : 'f';
    const s = surfaceAt(x, z, WET);
    assert.equal(s === 'pond' ? 'p' : s === 'water' ? 'c' : 'f', exact, `${x},${z}`);
  }
});

test('walking: wade x0.8 dry, x0.5 wet, bridges and bank full speed', () => {
  const mid = creekPoint('in', 12);
  assert.equal(wadeFactor(mid.x, mid.z, DRY), 0.8);
  assert.equal(wadeFactor(mid.x, mid.z, WET), 0.5);
  assert.equal(wadeFactor(POND.x, POND.z, DRY), 0.8);       // the mud flat
  assert.equal(wadeFactor(POND.x, POND.z, WET), 1);         // open pond keeps main.js's swim rule
  for (const b of MAP.BRIDGES) { assert.equal(wadeFactor(b.x, b.z, DRY), 1); assert.equal(wadeFactor(b.x, b.z, LATE), 1); }
  assert.equal(wadeFactor(0, 0, WET), 1);
});

test('keepInField and the callout names', () => {
  const p = { x: 99, z: -300 };
  assert.equal(keepInField(p), true);
  assert.deepEqual(p, { x: 64, z: -189 });
  const cart = { x: 31, z: 15 };
  assert.equal(keepInField(cart, 6), false);
  assert.equal(nearestLandmark(-37, -50, DRY).name, 'the Plank');
  assert.equal(nearestLandmark(18, -98, DRY).name, 'the Bridge');
  assert.equal(nearestLandmark(-5, -135, DRY).name, 'Blue');
  assert.equal(nearestLandmark(0, -185, DRY).name, 'the Back Net');
  assert.ok(!landmarksFor(DRY).some(l => l.id === 'delta') && landmarksFor(WET).some(l => l.id === 'delta'));
  assert.equal(nearestLandmark(0, 0, DRY), null);
});

// ---- council round 10 #5: snags --------------------------------------------------------------------------------------
test('snags: 1 in 3 range balls, every gold and glow; the point is deterministic and inside the branch', () => {
  let range = 0;
  for (let id = 1; id <= 3000; id++) if (snags(id, 'range')) range++;
  assert.ok(range > 900 && range < 1100, `about a third of range balls snag (${range})`);
  for (let id = 1; id <= 200; id++) { assert.equal(snags(id, 'gold'), true); assert.equal(snags(id, 'glow'), true); assert.equal(snags(id, 'lead'), false); }
  for (const branch of ['in', 'out']) for (let id = 1; id <= 200; id++) {
    const s0 = 3 + (id % 20);
    const s = snagS(id, 'gold', branch, s0);
    assert.equal(s, snagS(id, 'gold', branch, s0), 'deterministic');
    assert.ok(s >= s0 && s <= creekLength(branch), 'downstream of where it landed, inside the branch');
    const q = snagSpot(id, branch, s);
    assert.ok(creekProject(q.x, q.z).d < MAP.CREEK.HW, 'inside the channel');
    assert.equal(q.y, CREEK_DIVE.BED + SIM.BALL_R);
  }
  SNAG.ON = 0; assert.equal(snags(1, 'gold'), false); SNAG.ON = 1;
});

test('a snagging ball stops on the bed as b.creek, never sunk; the event and driftAt agree', () => {
  let id = 1; while (!snags(id, 'range')) id++;
  const p = creekPoint('in', 4);
  const b = { id, x: p.x, y: SIM.BALL_R, z: p.z, vx: 0, vy: 0, vz: 0, kind: 'range' };
  const d = startDrift(b, WET);
  assert.ok(d.snag != null && driftEvent(b).snag != null);
  let out = null, t = 0;
  while (!out && t < 80) { out = stepDrift(b, 0.05); t += 0.05; }
  assert.equal(out, 'snag');
  assert.equal(b.creek, true); assert.equal(b.rest, true); assert.ok(!b.sunk);
  assert.equal(driftAt({ ...d, s: undefined }, 999).end, 'snag');
});

test('the dive current: 0.8 m/s downstream in creek water, nothing on land or the Muni, held at the Grate', () => {
  const p = creekPoint('out', 20), c = creekCurrent(p.x, p.z, WET);
  assert.ok(Math.abs(Math.hypot(c.vx, c.vz) - CREEK_DIVE.CURRENT) < 1e-9);
  assert.ok(c.vx * p.dx + c.vz * p.dz > 0, 'downstream');
  assert.equal(inCreekWater(p.x, p.z, DRY), false);
  assert.deepEqual([creekCurrent(p.x, p.z, DRY).vx, creekCurrent(0, 0, WET).vx], [0, 0]);
  const br = creekPoint('out', 30);   // under the Cart Bridge: you float under it
  assert.equal(inCreekWater(br.x, br.z, WET), false); assert.ok(creekCurrent(br.x, br.z, WET).vx > 0);
  const g = creekPoint('out', creekLength('out') - 0.3);
  assert.equal(creekCurrent(g.x, g.z, WET).vx, 0);
});
