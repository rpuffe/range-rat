// The ball-flow chain you can see (owner layout, 2026-11-24; the numbers are in layout.js): the clear pipe from the
// ball return by the mats to the bank's silo, the riser into the washer's hopper once the crew owns it (the washer's
// own chute, washer.js, carries on to the silo), balls rolling along it when anyone banks, and the customers'
// basket of balls by the BUCKETS dispenser.
// Round 11 (owner: "one physical story": return -> pipe -> washer -> silo -> machine -> basket -> customer):
// - balls in the return pipe are dirty (brown); they drop inside the silo down to its fill (silo(n)),
// - a clear feed pipe runs from the silo's foot into the dispenser's dome, with balls in it while a bucket fills,
// - every range bucket is one InstancedMesh (+ one of ball heaps that grow as it fills): the rack's 12 slots (no
//   overlap), the bucket under each Rat chute, the filler's bucket (SHOP `filler`, a bolt-on machine with its own
//   spout: "make it obvious"), and a bucket at every playing bay that empties as the customer hits.
// Draw calls: one pipe (the other is hidden), the feed pipe, one InstancedMesh of rolling balls (hidden when none
// roll; pool = the detail.js tier's pipeBalls + the feed's), one merged basket + rack, buckets, heaps, the filler.
import * as THREE from 'three';
import { PIPE_DIRECT, PIPE_WASHER, PIPE_FEED, PIPE_SECS, BASKET, BASKET_SLOTS, BUCKET, RACK, DISPENSER, CHUTE_BUCKETS,
  FILLER, FILLER_BUCKET, FIELD_RETURNS, FIELD_RETURN, RETURN_TUBE, TUBE_TRUNK, TUBE_BRANCH, fieldReturns, tubeRoute, siloLevelY, TUBE_POSTS } from './layout.js';
import { SILO, MATS, BUCKETS } from './sim.js';
import { UPPER, PLAY_Z, bucketFor } from './customers.js';
// (the tube's posts come from layout.js TUBE_POSTS: round 11)
import { whoosh } from './tubesfx.js';
import * as TEX from './textures.js';   // the galvanised metal band in the field returns' atlas

const v3 = p => new THREE.Vector3(p[0], p[1], p[2]);
const DIRTY = new THREE.Color(0x8a6a45), MUDDY = new THREE.Color(0xc9b088), CLEAN = new THREE.Color(0xffffff);

// Merge (geometry, colour, matrix?) parts into one non-indexed BufferGeometry with vertex colours.
function mergeParts(parts) {
  const pos = [], nor = [], col = [];
  for (const [geo, color, m] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (m) g.applyMatrix4(m);
    const c = new THREE.Color(color), p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}
const T = (x, y, z, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));

// The range bucket (base at y 0): blue sides, a lighter rim band, a bottom, a wire handle.
function bucketGeometry() {
  const { R, R0, H } = BUCKET;
  return mergeParts([
    [new THREE.CylinderGeometry(R, R0, H * 0.82, 14, 1, true), 0x2f6fbf, T(0, H * 0.41, 0)],
    [new THREE.CylinderGeometry(R + 0.004, R * 0.97, H * 0.18, 14, 1, true), 0x5b93d6, T(0, H * 0.91, 0)],
    [new THREE.CircleGeometry(R0, 14), 0x24589a, T(0, 0.004, 0, -Math.PI / 2)],
    [new THREE.TorusGeometry(R, 0.008, 4, 16, Math.PI), 0x9aa1a8, T(0, H, 0)],
  ]);
}
// A heap of balls (base at y 0, ~0.1 tall, radius ~ the bucket's inside): the instance scales it with the fill.
function heapGeometry() {
  const parts = [], r = 0.045;
  const ring = (n, rr, y) => { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + y * 9; parts.push([new THREE.SphereGeometry(r, 6, 4), 0xf6f4ee, T(Math.cos(a) * rr, y, Math.sin(a) * rr)]); } };
  ring(8, 0.11, r); ring(5, 0.06, r + 0.035); ring(1, 0, r + 0.07);
  parts.push([new THREE.CylinderGeometry(0.15, 0.15, 0.03, 12), 0xe9e6dc, T(0, r * 0.6, 0)]);
  return mergeParts(parts);
}

export function createBallReturn(scene, { pool = 24 } = {}) {
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd3e8, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const curves = { direct: new THREE.CatmullRomCurve3(PIPE_DIRECT.map(v3)), washer: new THREE.CatmullRomCurve3(PIPE_WASHER.map(v3)),
    feed: new THREE.CatmullRomCurve3(PIPE_FEED.map(v3), false, 'centripetal') };
  const pipes = {};
  for (const k of ['direct', 'washer', 'feed']) {
    const m = new THREE.Mesh(new THREE.TubeGeometry(curves[k], k === 'feed' ? 40 : 28, k === 'feed' ? 0.085 : 0.11, 10, false), glass);
    m.renderOrder = 2; m.name = 'pipe.' + k; scene.add(m);
    pipes[k] = m;
  }
  pipes.washer.visible = false;
  let route = 'direct';

  // Balls rolling down the pipes: one InstancedMesh, the free ones parked out of sight (count = live ones).
  const FEED_N = 8;
  const n = Math.max(1, pool | 0) + FEED_N;
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
  balls.frustumCulled = false; balls.count = 0; balls.visible = false; scene.add(balls);
  balls.setColorAt(0, CLEAN);
  const live = [];                       // { t, delay, route, fall }
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();   // council round 12, 4b: was a Vector3 (no order): "setFromEuler unknown order" every frame
  const IN_SILO = curves.direct.getPoint(1);
  let siloY = siloLevelY(400);

  // The customers' basket of balls (a wire basket heaped with balls) and the bucket rack, one merged mesh.
  {
    const parts = [];
    const put = (geo, color, x, y, z) => parts.push([geo, color, T(x, y, z)]);
    const bx = BASKET.x, bz = BASKET.z;
    put(new THREE.CylinderGeometry(BASKET.r, BASKET.r * 0.85, 0.34, 14, 1, true), 0x8d959e, bx, 0.17, bz);
    put(new THREE.CylinderGeometry(BASKET.r * 0.85, BASKET.r * 0.85, 0.02, 14), 0x6d747c, bx, 0.01, bz);
    parts.push([new THREE.TorusGeometry(BASKET.r, 0.014, 5, 18), 0xb9c0c8, T(bx, 0.34, bz, Math.PI / 2)]);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) {
      const a = i * 2.4, rr = (i < 9 ? 0.22 : i < 17 ? 0.13 : 0.05) * (0.85 + 0.3 * r());
      put(new THREE.SphereGeometry(0.06, 7, 5), 0xf6f4ee, bx + Math.cos(a) * rr, 0.3 + (i < 9 ? 0 : i < 17 ? 0.06 : 0.11) + r() * 0.02, bz + Math.sin(a) * rr);
    }
    // The rack: a slatted pallet top on three runners, each slot's ring painted on it.
    for (const dz of [-0.36, 0, 0.36]) put(new THREE.BoxGeometry(RACK.W, RACK.H * 0.6, 0.1), 0x7a5a3a, RACK.x, RACK.H * 0.3, RACK.z + dz);
    for (let i = 0; i < 7; i++) put(new THREE.BoxGeometry(RACK.W / 7 - 0.04, 0.03, RACK.D), 0xb08a58, RACK.x - RACK.W / 2 + (i + 0.5) * RACK.W / 7, RACK.H - 0.015, RACK.z);
    for (const sl of BASKET_SLOTS) parts.push([new THREE.RingGeometry(BUCKET.R0 + 0.01, BUCKET.R0 + 0.035, 16), 0xf2efe6, T(sl.x, RACK.H + 0.002, sl.z, -Math.PI / 2)]);
    const basket = new THREE.Mesh(mergeParts(parts), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    basket.castShadow = true; basket.name = 'basket';
    scene.add(basket);
  }

  // The old bucket filler / the Bucket machine (SHOP `filler`): a bolt-on box on the dispenser's west side with a motor
  // drum, a ball spout and a gauge lamp. Tier 1 is grey and battered, tier 2 safety yellow. Hidden until bought.
  const fillerMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }));
  fillerMesh.name = 'basket.filler'; fillerMesh.castShadow = true; fillerMesh.visible = false; scene.add(fillerMesh);
  const fillerAt = new THREE.Vector3(FILLER.x, 0, FILLER.z);
  function buildFiller(tier) {
    const body = tier >= 2 ? 0xf2c230 : 0x8d949b, dark = tier >= 2 ? 0x3a3a3a : 0x5d6369;
    const { W, D, H, SPOUT_Y } = FILLER, fz = -D / 2;   // local: +x east, the spout on the front (-z) face
    fillerMesh.geometry.dispose();
    fillerMesh.geometry = mergeParts([
      [new THREE.BoxGeometry(W, H, D), body, T(0, H / 2, 0)],
      [new THREE.BoxGeometry(W + 0.04, 0.06, D + 0.04), dark, T(0, H + 0.03, 0)],
      [new THREE.CylinderGeometry(0.13, 0.13, W * 0.8, 12), dark, T(0, H - 0.25, fz - 0.06, 0, 0, Math.PI / 2)],      // the motor drum
      [new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), 0x9aa3a8, T(0.12, H + 0.15, 0)],                                  // the feed stub from the dome
      [new THREE.BoxGeometry(0.14, 0.12, 0.2), dark, T(0, SPOUT_Y, fz - 0.1)],                                         // the spout
      [new THREE.CylinderGeometry(0.06, 0.04, 0.12, 10), 0x22262a, T(0, SPOUT_Y - 0.1, fz - 0.16)],
      [new THREE.BoxGeometry(0.3, 0.12, 0.01), 0xfff6dc, T(0, H - 0.52, fz - 0.005)],                                  // the plate
      [new THREE.SphereGeometry(0.045, 8, 6), 0x46d16a, T(-W / 2 + 0.08, H - 0.1, fz - 0.01)],                          // the lamp
    ]);
    fillerMesh.position.copy(fillerAt);
  }

  // Every range bucket and its heap of balls: two InstancedMeshes, rebuilt each frame from the list below (no allocation).
  const BMAX = 64;
  const buckets = new THREE.InstancedMesh(bucketGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), BMAX);
  buckets.name = 'basket.buckets'; buckets.castShadow = true; buckets.count = 0; buckets.frustumCulled = false; scene.add(buckets);
  const heaps = new THREE.InstancedMesh(heapGeometry(), new THREE.MeshLambertMaterial({ vertexColors: true }), BMAX);
  heaps.name = 'basket.heaps'; heaps.count = 0; heaps.frustumCulled = false; scene.add(heaps);
  let nb = 0, nh = 0;
  function addBucket(x, y, z, fill, tilt = 0) {
    if (nb >= BMAX) return;
    _q.setFromEuler(_e.set(tilt, 0, 0)); _s.set(1, 1, 1);
    buckets.setMatrixAt(nb++, _m.compose(_p.set(x, y, z), _q, _s));
    if (fill > 0.02 && nh < BMAX) {
      const f = Math.min(1, fill);
      _s.set(0.62 + 0.38 * f, 0.5 + 0.8 * f, 0.62 + 0.38 * f);
      heaps.setMatrixAt(nh++, _m.compose(_p.set(x, y + 0.012 + (BUCKET.H - 0.11) * f, z), _q, _s));
    }
  }

  let shownN = 0, chutes = 0, chuteT = 0, basketMaxN = BUCKETS.BASKET;
  const chuteF = [0, 0];                   // each Rat chute's bucket, 0..1 (client-side: FILL_SECS a bucket)
  let mach = null, machShown = 0, fillerTier = 0, fillerT = 0;
  const tween = { t: 1, from: { x: 0, y: 0, z: 0 } };   // the newest bucket hopping into its slot
  let bays = null, bayVenue = 0;
  const CHUTE = { x: DISPENSER.x + 0.5, y: 1.05, z: CHUTE_BUCKETS[0].z };   // the dispenser's east-side chute mouth
  // Playthrough 5 A5: the empty-basket lamp, an orange beacon on the dispenser's head (main.js lights it when the basket
  // runs dry mid-day). +1 draw call, only while lit.
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true }));
  lamp.position.set(DISPENSER.x, 2.0, DISPENSER.z); lamp.visible = false; lamp.name = 'basket.lamp'; scene.add(lamp);
  let lampT = 0, feedT = 0;

  return {
    pipes, curves,
    get route() { return route; },
    // The washer is in the world: the pipe climbs into its hopper; otherwise it runs straight to the silo.
    update(washerShown) {
      const want = washerShown ? 'washer' : 'direct';
      if (want === route) return;
      route = want;
      pipes.direct.visible = route === 'direct'; pipes.washer.visible = route === 'washer';
    },
    // k balls were banked at the return: send a few down the pipe, staggered.
    banked(k) {
      const want = Math.min(6, Math.max(0, k | 0), n - live.length);
      for (let i = 0; i < want; i++) live.push({ t: 0, delay: i * 0.14, route, fall: 0 });
    },
    // The silo's banked supply (basket.js siloFill): balls from the direct pipe drop to its level.
    silo(nBalls) { siloY = siloLevelY(nBalls); },
    // The snapshot's basket count and how many Rats are filling (the chutes' ball streams and buckets).
    basket(nIn, filling = 0, max = BUCKETS.BASKET) {   // max: the server's basketMax (round 11: Ball Shortage's 6)
      basketMaxN = max;
      const k = Math.max(0, Math.min(BASKET_SLOTS.length, nIn | 0));
      if (k < shownN) tween.t = 1;
      shownN = k;
      const c = Math.max(0, Math.min(2, filling | 0));
      for (let j = c; j < 2; j++) chuteF[j] = 0;
      chutes = c;
    },
    // Round 11: the filler. tier: the crew's `filler` row; progress: the snapshot's machT (0..1, null: none).
    machine(tier, progress) {
      tier = Math.max(0, Math.min(2, tier | 0));
      if (tier !== fillerTier) { fillerTier = tier; fillerMesh.visible = tier > 0; if (tier > 0) buildFiller(tier); }
      mach = tier > 0 && progress != null ? Math.max(0, Math.min(1, progress)) : null;
    },
    // A bucket dropped in (the 'bucket' event): it hops from where it filled to its slot.
    bucketIn(by) {
      const src = by === 'machine' ? FILLER_BUCKET : CHUTE_BUCKETS[0];
      tween.t = 0; tween.from.x = src.x; tween.from.y = 0; tween.from.z = src.z;
      if (by === 'machine') machShown = 0; else chuteF[0] = 0;
    },
    // The playing bays' buckets: the snapshot's lower mats ({ st, left }) and the venue (balls a bucket).
    bays(mats, venue) { bays = mats ?? null; bayVenue = venue | 0; },
    alarm(on) { lamp.visible = !!on; },
    tick(dt) {
      if (lamp.visible) { lampT += dt; const k = 0.5 + 0.5 * Math.sin(lampT * 9); lamp.material.opacity = 0.35 + 0.65 * k; lamp.scale.setScalar(0.85 + 0.35 * k); }
      // The filler's bucket: ease toward the server's progress; a drop to ~0 is a new bucket.
      if (mach != null) machShown = mach < machShown - 0.3 ? mach : machShown + (mach - machShown) * Math.min(1, dt * 6);
      const machBusy = mach != null && shownN < basketMaxN;
      if (fillerMesh.visible) {   // it wheezes (tier 1) or hums (tier 2) while it works
        fillerT += dt;
        fillerMesh.position.x = fillerAt.x + (machBusy ? Math.sin(fillerT * (fillerTier >= 2 ? 60 : 23)) * 0.006 : 0);
      }
      for (let j = 0; j < chutes; j++) chuteF[j] = (chuteF[j] + dt / BUCKETS.FILL_SECS) % 1;
      if (tween.t < 1) tween.t = Math.min(1, tween.t + dt / 0.45);

      // ---- the buckets
      nb = 0; nh = 0;
      for (let i = 0; i < shownN; i++) {
        const sl = BASKET_SLOTS[i];
        if (i === shownN - 1 && tween.t < 1) {
          const u = tween.t, e = u * u * (3 - 2 * u);
          addBucket(tween.from.x + (sl.x - tween.from.x) * e, sl.y * e + Math.sin(u * Math.PI) * 0.35, tween.from.z + (sl.z - tween.from.z) * e, 1);
        } else addBucket(sl.x, sl.y, sl.z, 1);
      }
      for (let j = 0; j < chutes; j++) addBucket(CHUTE_BUCKETS[j].x, 0, CHUTE_BUCKETS[j].z, chuteF[j]);
      if (mach != null) addBucket(FILLER_BUCKET.x, 0, FILLER_BUCKET.z, machBusy ? machShown : 0);
      if (bays) {
        const per = bucketFor(bayVenue);
        for (let i = 0; i < bays.length && i < UPPER.FROM; i++) {
          const m = bays[i], mat = MATS[i];
          if (!m || !mat || m.st !== 'playing' || !(m.left > 0)) continue;
          addBucket(mat.x - 1.25, 0, PLAY_Z + 0.45, m.left / per);
        }
      }
      buckets.count = nb; heaps.count = nh;
      buckets.visible = nb > 0; heaps.visible = nh > 0;
      if (nb) buckets.instanceMatrix.needsUpdate = true;
      if (nh) heaps.instanceMatrix.needsUpdate = true;

      // ---- the balls: the chutes' streams, the filler's spout, the feed pipe, the return pipe
      let c = 0;
      const put = (x, y, z, col) => { balls.setMatrixAt(c, _m.makeTranslation(x, y, z)); balls.setColorAt(c, col); c++; };
      if (chutes) {                      // a ball every 0.05 s: 30 in 1.5 s, falling out of the chute into its bucket
        chuteT = (chuteT + dt) % 0.3;
        for (let j = 0; j < chutes * 3 && c < n; j++) {
          const u = ((chuteT / 0.3) + (j % 3) / 3) % 1, b = CHUTE_BUCKETS[j / 3 | 0];
          const floor = 0.06 + chuteF[j / 3 | 0] * (BUCKET.H - 0.06);
          put(CHUTE.x + (b.x - CHUTE.x) * u, CHUTE.y - (CHUTE.y - floor) * u * u, b.z + (j % 2) * 0.04, CLEAN);
        }
      }
      if (machBusy && c + 2 <= n) {      // the filler's spout dribbles
        const k = (fillerT * (fillerTier >= 2 ? 3 : 1.5)) % 1, floor = 0.06 + machShown * (BUCKET.H - 0.06);
        for (let j = 0; j < 2; j++) { const u = (k + j * 0.5) % 1; put(FILLER_BUCKET.x, FILLER.SPOUT_Y - 0.16 - (FILLER.SPOUT_Y - 0.16 - floor) * u * u, FILLER_BUCKET.z, CLEAN); }
      }
      if ((chutes || machBusy) && c < n) {   // the silo feeds the dispenser while anything fills
        feedT = (feedT + dt * (chutes ? 0.9 : 0.45)) % 1;
        for (let j = 0; j < FEED_N && c < n; j++) { curves.feed.getPoint((feedT + j / FEED_N) % 1, _p); put(_p.x, _p.y, _p.z, CLEAN); }
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const b = live[i];
        if (b.delay > 0) { b.delay -= dt; continue; }
        if (b.t < 1) b.t += dt / PIPE_SECS[b.route];
        if (b.t >= 1 && b.route === 'washer') { live.splice(i, 1); continue; }   // into the hopper: the washer's heap takes over
        if (c >= n) continue;              // the chute's balls share the pool
        if (b.t >= 1) {                    // into the silo: it drops to the fill
          b.fall += dt;
          const y = IN_SILO.y - 4.9 * b.fall * b.fall;
          if (y <= siloY || b.fall > 0.8) { live.splice(i, 1); continue; }
          put(IN_SILO.x + (SILO.x - IN_SILO.x) * Math.min(1, b.fall * 3) * 0.6, Math.max(siloY, y), IN_SILO.z + (SILO.z - IN_SILO.z) * Math.min(1, b.fall * 3) * 0.6, MUDDY);
          continue;
        }
        curves[b.route].getPoint(b.route === 'direct' ? b.t * (0.6 + 0.4 * b.t) : b.t, _p);   // the direct pipe falls: they speed up
        put(_p.x, _p.y, _p.z, b.route === 'washer' ? DIRTY : MUDDY);
      }
      balls.count = c; balls.visible = c > 0;
      if (c) { balls.instanceMatrix.needsUpdate = true; balls.instanceColor.needsUpdate = true; }
    },
  };
}

// Council round 10 §C: the field ball returns (layout.js FIELD_RETURNS), the crew owns `tier` of them. Each is the
// pond tube's red FHI box, taller, with its number on a plate ("RETURN 2") and a feed mouth. Round 11 (owner): their
// pipe is no longer buried: an obnoxious, big, shiny pneumatic tube rises out of each lid and runs above ground on
// galvanised posts all the way back to the main return (layout.js TUBE_TRUNK / TUBE_BRANCH), with chrome couplings
// every few metres. A pocket fed in whooshes through it as a batch of balls you can see (whoosh(id, n), and a sound).
// Draw calls: the boxes + posts + couplings (one merged mesh, one canvas for the plates), the clear tube (one mesh),
// the batches (one InstancedMesh). Rebuilt only when the tier changes. thunk(id) gives the box a little kick.
export function createFieldReturns(scene) {
  const PLATES_H = FIELD_RETURNS.length * 64, ATLAS_H = 256;   // power of two: the plates on top, the metal band below
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let tex = null;
  if (c) {
    c.width = 256; c.height = ATLAS_H;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, ATLAS_H);
    TEX.paintPixels(g, 'metal', 0, PLATES_H, 256, ATLAS_H - PLATES_H);   // rows below the plates: galvanised metal
    FIELD_RETURNS.forEach((r, i) => {
      const y0 = i * 64;
      g.fillStyle = '#fbf6e8'; g.fillRect(0, y0, 256, 64);
      g.strokeStyle = '#2a2418'; g.lineWidth = 5; g.strokeRect(3, y0 + 3, 250, 58);
      g.fillStyle = '#b3261e'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 34px "Courier New", monospace'; g.fillText(r.label, 128, y0 + 27);
      g.fillStyle = '#2a2418'; g.font = '600 13px system-ui, sans-serif'; g.fillText('FHI · BALLS IN · WHOOSH', 128, y0 + 51);
    });
    TEX.signFinish(g, 256, PLATES_H, { screws: false });
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.name = 'fieldReturns'; mesh.castShadow = true; mesh.visible = false;
  scene.add(mesh);
  // The tube: clear and glossy, so the batches show.
  const tubeMat = new THREE.MeshPhongMaterial({ color: 0xe6f7ff, emissive: 0x1a2a33, specular: 0xffffff, shininess: 140, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const tubeMesh = new THREE.Mesh(new THREE.BufferGeometry(), tubeMat);
  tubeMesh.name = 'fieldReturns.tube'; tubeMesh.renderOrder = 2; tubeMesh.visible = false; scene.add(tubeMesh);
  const curves = Object.fromEntries(FIELD_RETURNS.map(r => [r.id, new THREE.CatmullRomCurve3(tubeRoute(r.id).map(v3), false, 'centripetal')]));
  const trunk = new THREE.CatmullRomCurve3(TUBE_TRUNK.map(v3), false, 'centripetal');
  const branch = new THREE.CatmullRomCurve3(TUBE_BRANCH.map(v3), false, 'centripetal');
  const BAND_V = 1 - PLATES_H / ATLAS_H;   // the metal band: v 0..BAND_V (canvas rows PLATES_H..ATLAS_H)
  const { W, D, H } = FIELD_RETURN, TR = RETURN_TUBE.R;

  function build(tier) {
    const pos = [], nor = [], col = [], uv = [];
    const put = (geo, color, m, plate = -1) => {
      const gg = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m);
      const cc = new THREE.Color(color), p = gg.attributes.position, n = gg.attributes.normal, u = gg.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(cc.r, cc.g, cc.b);
        if (plate >= 0 && u) uv.push(u.getX(i), 1 - (plate * 64 + 64) / ATLAS_H + u.getY(i) * 64 / ATLAS_H);   // plate i's band
        else if (u) uv.push(u.getX(i), 0.01 + u.getY(i) * (BAND_V - 0.02));   // everything else: the metal band
        else uv.push(0.5, BAND_V / 2);
      }
    };
    const owned = fieldReturns(tier);
    for (const r of owned) {
      const i = FIELD_RETURNS.indexOf(r), X = r.x, Z = r.z;
      put(new THREE.BoxGeometry(W + 0.2, 0.08, D + 0.2), 0x7d7f80, T(X, 0.04, Z));                // the concrete pad
      put(new THREE.BoxGeometry(W, H, D), 0xb3261e, T(X, 0.08 + H / 2, Z));                      // the red box
      put(new THREE.BoxGeometry(W + 0.06, 0.07, D + 0.06), 0x7d1812, T(X, 0.08 + H + 0.035, Z)); // its lid
      put(new THREE.BoxGeometry(0.5, 0.16, 0.04), 0x1c1a18, T(X, 0.08 + H - 0.35, Z + D / 2 + 0.01));   // the feed mouth (+z: the bank side)
      put(new THREE.BoxGeometry(0.56, 0.04, 0.12), 0xd9d4c4, T(X, 0.08 + H - 0.44, Z + D / 2 + 0.05)); // its lip
      put(new THREE.BoxGeometry(0.06, 0.6, 0.06), 0x6b5a45, T(X - 0.3, 0.08 + H + 0.35, Z + 0.2));    // the plate's post (beside the riser)
      put(new THREE.PlaneGeometry(1.0, 0.25), 0xffffff, T(X - 0.3, 0.08 + H + 0.62, Z + 0.235), i);       // the plate, both faces
      put(new THREE.PlaneGeometry(1.0, 0.25), 0xffffff, T(X - 0.3, 0.08 + H + 0.62, Z + 0.165, 0, Math.PI), i);
      put(new THREE.CylinderGeometry(TR + 0.06, TR + 0.08, 0.12, 14), 0xc9ced3, T(X, 0.08 + H + 0.1, Z));  // the chrome collar on the lid
    }
    // Posts and couplings along each owned tube.
    const lines = tier >= 2 ? [trunk, branch] : tier >= 1 ? [trunk] : [];
    for (const cv of lines) {
      const len = cv.getLength(), q = new THREE.Vector3(), tng = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), quat = new THREE.Quaternion();
      for (let s = 2, k = 0; s < len; s += 2.6, k++) {   // couplings: chrome bands, every third one a fat brass flange
        cv.getPointAt(s / len, q); cv.getTangentAt(s / len, tng);
        quat.setFromUnitVectors(up, tng);
        const brass = k % 3 === 0;
        put(new THREE.CylinderGeometry(TR + (brass ? 0.06 : 0.03), TR + (brass ? 0.06 : 0.03), brass ? 0.16 : 0.08, 16), brass ? 0xe0b040 : 0xe4e8ec, new THREE.Matrix4().compose(q, quat, new THREE.Vector3(1, 1, 1)));
      }
    }
    // Round 11: the posts come from layout.js TUBE_POSTS, the same list the cart collides with (map.js cartBlocked).
    for (const p of TUBE_POSTS) {
      if (p.tier > tier) continue;
      const h = p.y - TR;
      put(new THREE.CylinderGeometry(0.07, 0.09, h, 8), 0x8a9197, T(p.x, h / 2, p.z));                  // galvanised post
      put(new THREE.BoxGeometry(0.34, 0.06, 0.34), 0x6f767c, T(p.x, 0.03, p.z));                          // its foot
      put(new THREE.TorusGeometry(TR + 0.03, 0.03, 6, 14, Math.PI), 0x8a9197, T(p.x, p.y, p.z, 0, p.yaw + Math.PI / 2));   // the saddle
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    mesh.geometry.dispose(); mesh.geometry = geo;
    mesh.visible = pos.length > 0;
    // The clear tube itself.
    tubeMesh.geometry.dispose();
    const tubes = lines.map(cv => new THREE.TubeGeometry(cv, Math.ceil(cv.getLength() / 1.2), TR, 12, false));
    if (tubes.length) {
      const P = [], N = [];
      for (const t of tubes) { const g = t.toNonIndexed(); P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); t.dispose(); }
      const tg = new THREE.BufferGeometry();
      tg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); tg.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
      tg.computeBoundingSphere();
      tubeMesh.geometry = tg;
    } else tubeMesh.geometry = new THREE.BufferGeometry();
    tubeMesh.visible = tubes.length > 0;
  }

  // The batches: each pocket whooshes home as a short train of balls.
  const BMAX = 48;
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x333333 }), BMAX);
  balls.frustumCulled = false; balls.count = 0; balls.visible = false; balls.name = 'fieldReturns.balls'; scene.add(balls);
  const batches = [];                       // { id, t, k, arrived }
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3();
  const HUB = new THREE.Vector3(...TUBE_TRUNK.at(-1));

  let tier = -1, kick = 0;
  return {
    mesh, tubeMesh,
    // The crew's 'returns' tier (0 none, 1 the Far return, 2 + Back). Rebuilds only on a change.
    update(t) { t = Math.max(0, Math.min(FIELD_RETURNS.length, t | 0)); if (t !== tier) { tier = t; build(t); } },
    thunk() { kick = 1; },
    // A pocket of n went in return `id`: a batch of balls (more balls, a longer train) and a whoosh. cam: the listener.
    whoosh(id, nBalls = 8, cam = null) {
      const r = FIELD_RETURNS.find(f => f.id === id);
      if (!r || !curves[id]) return;
      if (batches.length < 6) batches.push({ id, t: 0, k: Math.max(4, Math.min(12, Math.ceil((nBalls | 0) / 4) + 3)), arrived: false });
      whoosh(cam ? Math.hypot(cam.x - r.x, cam.z - r.z) : 0, true);
    },
    tick(dt, cam = null) {
      if (kick > 0) { kick = Math.max(0, kick - dt * 4); mesh.position.y = Math.sin(kick * 9) * 0.02 * kick; }
      let c = 0;
      for (let i = batches.length - 1; i >= 0; i--) {
        const b = batches[i];
        b.t += dt;
        const lead = b.t / RETURN_TUBE.SECS;
        if (!b.arrived && lead > 0.88) { b.arrived = true; whoosh(cam ? Math.hypot(cam.x - HUB.x, cam.z - HUB.z) : 0, false); }
        if (lead - (b.k - 1) * 0.012 >= 1) { batches.splice(i, 1); continue; }
        for (let j = 0; j < b.k && c < BMAX; j++) {
          const u = lead - j * 0.012;   // a train, ~2 m between balls on the trunk
          if (u <= 0 || u >= 1) continue;
          curves[b.id].getPointAt(u * u * (1.6 - 0.6 * u) / 1.0, _p);   // it sucks away slowly, then flies
          balls.setMatrixAt(c++, _m.makeTranslation(_p.x, _p.y, _p.z));
        }
      }
      balls.count = c; balls.visible = c > 0;
      if (c) balls.instanceMatrix.needsUpdate = true;
    },
  };
}
