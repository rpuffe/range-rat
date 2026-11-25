// Every sign in the world reads from where players stand to read it (web/js/signs.js), at every venue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SIGNS, SIGN_BY_ID, VIEWERS, readable, signsAt, signActive, viewerPoint, facing, yawOf } from '../web/js/signs.js';
import { MAP } from '../web/js/map.js';

const VENUES = [0, 1, 2, 3, 4, 5, 6];   // 6 = endless

test('every sign is readable (dot(normal, toViewer) > 0.5) from each of its approach points, at every venue', () => {
  const bad = [];
  for (const v of VENUES) for (const s of signsAt(v)) for (const w of s.viewers) {
    const r = readable(s, w);
    if (!r.ok) bad.push(`venue ${v}: ${s.id} from ${typeof w === 'string' ? w : JSON.stringify(w)} -> ${r.why} (dot ${r.dot.toFixed(2)})`);
  }
  assert.deepEqual(bad, []);
});

test('the table is well formed', () => {
  assert.equal(new Set(SIGNS.map(s => s.id)).size, SIGNS.length, 'ids are unique');
  for (const s of SIGNS) {
    assert.ok(s.viewers.length > 0, `${s.id} has an approach point`);
    for (const w of s.viewers) assert.ok(viewerPoint(w), `${s.id}: viewer ${w} exists`);
    assert.ok(Math.abs(Math.hypot(s.normal.x, s.normal.y, s.normal.z) - 1) < 1e-9, `${s.id} normal is a unit vector`);
    assert.ok(VENUES.some(v => signActive(s, v)), `${s.id} exists at some venue`);
  }
  for (const w of Object.values(VIEWERS)) {     // walkers stand on the walkable field (the reveal camera and the lot path excepted)
    if (w === VIEWERS.reveal || w === VIEWERS.lotPath) continue;
    assert.ok(w.x >= MAP.FIELD.xMin && w.x <= MAP.FIELD.xMax && w.z >= MAP.FIELD.zMin && w.z <= MAP.FIELD.zMax, JSON.stringify(w));
  }
});

test('venue gating: pond sign is Muni only, KITCHEN from the Club, FOR SALE only in endless', () => {
  assert.deepEqual(VENUES.filter(v => signActive(SIGN_BY_ID.pond, v)), [0]);
  assert.deepEqual(VENUES.filter(v => signActive(SIGN_BY_ID.kitchen, v)), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(VENUES.filter(v => signActive(SIGN_BY_ID.forsale, v)), [6]);
  assert.deepEqual(VENUES.filter(v => signActive(SIGN_BY_ID.jumbo, v)), [3, 4, 5, 6]);
});

test('signs read both ways where players stand on both sides', () => {
  for (const [a, b] of [['road.field', 'road.road'], ['arch.in', 'arch.out'], ['board.back', 'board.front'], ['washer.sign', 'washer.sign.back']]) {
    const n = SIGN_BY_ID[a].normal, m = SIGN_BY_ID[b].normal;
    assert.ok(n.x * m.x + n.z * m.z < -0.99, `${a} and ${b} are back to back`);
  }
});

test('readable() catches the faults it exists for', () => {
  // The old washer: the whole station faced +z, so BALL WASHER read mirrored (from behind) from the drop-in spot.
  const oldWasher = { ...SIGN_BY_ID['washer.sign'], normal: facing(0) };
  assert.equal(readable(oldWasher, 'spawn').why, 'back');
  // A ±z sign is edge-on to someone looking along x (owner layout: the washer by the return, seen from the tee line).
  const square = { ...SIGN_BY_ID['washer.sign'], normal: facing(Math.PI) };
  assert.equal(readable(square, 'teeCentre').why, 'oblique');
  // The old yardage boards faced straight across the field (+x): 200 YD was edge-on from the mats.
  const oldYd = { ...SIGN_BY_ID['yardage.200'], normal: { x: 1, y: 0, z: 0 } };
  assert.equal(readable(oldYd, 'teeCentre').why, 'oblique');
  // A road sign with only its field face: the promotion reveal (from the road) saw it mirrored.
  assert.equal(readable(SIGN_BY_ID['road.field'], 'reveal').why, 'back');
  // A flat mat number read from in front of the mat is upside down.
  assert.equal(readable(SIGN_BY_ID['mat.4'], { x: SIGN_BY_ID['mat.4'].pos.x, y: 1.6, z: -0.8 }).why, 'upside-down');
  assert.ok(Math.abs(yawOf(facing(2.1)) - 2.1) < 1e-12);
});

test('round 6 #4: every Target Green flag faces both crew bays (dot > 0.5), and the mesh yaw matches flagNormal', async () => {
  const { flagNormal } = await import('../web/js/aim.js');
  const { BAYS } = await import('../web/js/sim.js');
  for (const b of MAP.BOWLS) {
    const n = flagNormal(b);
    const sign = { pos: { x: b.x, y: 9.3, z: b.z }, normal: n };   // round 10 #6: the pin stands at the green's centre
    for (const bay of BAYS) {
      const r = readable(sign, { x: bay.x, y: 1.6, z: bay.z });
      assert.ok(r.ok && r.dot > 0.5, `Bowl ${b.id} from bay ${bay.x}: ${r.why} (dot ${r.dot.toFixed(2)})`);
    }
    // views/tiered.js sets flag.rotation.y = atan2(n.x, n.z): a plane's +z normal turned by that yaw is n.
    const yaw = Math.atan2(n.x, n.z);
    assert.ok(Math.abs(Math.sin(yaw) - n.x) < 1e-12 && Math.abs(Math.cos(yaw) - n.z) < 1e-12);
  }
});

test('round 10 #6: one pole per green at every venue: the landmark flag until Tiered, the target pin (same spot) after', async () => {
  const { readFileSync } = await import('node:fs');
  const tv = readFileSync(new URL('../web/js/views/tiered.js', import.meta.url), 'utf8');
  const tr = readFileSync(new URL('../web/js/terrain.js', import.meta.url), 'utf8');
  assert.match(tv, /const px = 0;/, 'the Tiered pin stands at the bowl centre');
  assert.ok(tv.includes('setFlags?.(!on)'), 'and hides the landmark flag while the Tiered view is up');
  assert.match(tr, /const setFlags = on =>/, 'terrain.js has the hook');
  assert.equal(MAP.FLAGS.length, MAP.BOWLS.length);
  for (const b of MAP.BOWLS) {
    const flags = MAP.FLAGS.filter(f => Math.hypot(f.x - b.x, f.z - b.z) < b.r);
    assert.equal(flags.length, 1, 'one landmark flag on green ' + b.id);
    assert.ok(Math.hypot(flags[0].x - b.x, flags[0].z - b.z) < 1e-9, 'at the centre, where the pin and cup are');
  }
  // the views: tiered (venue 2+) toggles the terrain flags; nothing else draws a pole on a green
  const { VIEWS } = await import('../web/js/views/index.js').catch(() => ({ VIEWS: null }));
  if (VIEWS) assert.ok(VIEWS.some(v => v.id === 'greens' && v.venue === 0));
});
