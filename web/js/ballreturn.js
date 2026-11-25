// The ball-flow chain you can see (owner layout, 2026-11-24; the numbers are in layout.js): the clear pipe from the
// ball return by the mats to the bank's silo, the riser into the washer's hopper once the crew owns it (the washer's
// own chute, washer.js, carries on to the silo), balls rolling along it when anyone banks, and the customers'
// basket of balls by the BUCKETS dispenser. Draw calls: one pipe (the other is hidden), one InstancedMesh of
// rolling balls (hidden when none roll; its pool is the detail.js tier's pipeBalls), one merged basket.
// Owner playtest 3 §3.3: the basket's buckets are one InstancedMesh of 12 slots (layout.js BASKET_SLOTS): count = the
// snapshot's basket, so the heap is the readout (+1 draw call); while a Rat fills, balls drop from the dispenser's
// chute into the bucket by them, drawn from the same rolling-ball pool.
import * as THREE from 'three';
import { PIPE_DIRECT, PIPE_WASHER, PIPE_SECS, BASKET, BASKET_SLOTS, DISPENSER, FILL_POINT, FIELD_RETURNS, FIELD_RETURN, fieldReturns } from './layout.js';

const v3 = p => new THREE.Vector3(p[0], p[1], p[2]);

export function createBallReturn(scene, { pool = 24 } = {}) {
  const glass = new THREE.MeshLambertMaterial({ color: 0x9fd3e8, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const curves = { direct: new THREE.CatmullRomCurve3(PIPE_DIRECT.map(v3)), washer: new THREE.CatmullRomCurve3(PIPE_WASHER.map(v3)) };
  const pipes = {};
  for (const k of ['direct', 'washer']) {
    const m = new THREE.Mesh(new THREE.TubeGeometry(curves[k], 28, 0.11, 10, false), glass);
    m.renderOrder = 2; m.name = 'pipe.' + k; scene.add(m);
    pipes[k] = m;
  }
  pipes.washer.visible = false;
  let route = 'direct';

  // Balls rolling down the pipe: one InstancedMesh, the free ones parked out of sight (count = live ones).
  const n = Math.max(1, pool | 0);
  const balls = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshLambertMaterial({ color: 0xffffff }), n);
  balls.frustumCulled = false; balls.count = 0; balls.visible = false; scene.add(balls);
  const live = [];                       // { t, delay, route }
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3();

  // The customers' basket: a wire basket heaped with balls and a short stack of empty buckets, one merged mesh
  // with vertex colours.
  {
    const parts = [];
    const put = (geo, color, x, y, z) => { const g = (geo.index ? geo.toNonIndexed() : geo).translate(x, y, z); parts.push([g, new THREE.Color(color)]); };
    put(new THREE.CylinderGeometry(BASKET.r, BASKET.r * 0.85, 0.34, 14, 1, true), 0x8d959e, 0, 0.17, 0);
    put(new THREE.CylinderGeometry(BASKET.r * 0.85, BASKET.r * 0.85, 0.02, 14), 0x6d747c, 0, 0.01, 0);
    put(new THREE.TorusGeometry(BASKET.r, 0.014, 5, 18).rotateX(Math.PI / 2), 0xb9c0c8, 0, 0.34, 0);
    let s = 7;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 22; i++) {
      const a = i * 2.4, rr = (i < 9 ? 0.22 : i < 17 ? 0.13 : 0.05) * (0.85 + 0.3 * r());
      put(new THREE.SphereGeometry(0.06, 7, 5), 0xf6f4ee, Math.cos(a) * rr, 0.3 + (i < 9 ? 0 : i < 17 ? 0.06 : 0.11) + r() * 0.02, Math.sin(a) * rr);
    }
    const pos = [], nor = [], col = [];
    for (const [g, c] of parts) {
      pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
      for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const basket = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    basket.position.set(BASKET.x, 0, BASKET.z); basket.castShadow = true; basket.name = 'basket';
    scene.add(basket);
  }

  // The filled buckets (owner playtest 3 §3.3): blue buckets heaped by the basket, one per bucket in it.
  const bucketGeo = new THREE.CylinderGeometry(0.17, 0.13, 0.26, 12, 1, true);
  const buckets = new THREE.InstancedMesh(bucketGeo, new THREE.MeshLambertMaterial({ color: 0x2f6fbf, side: THREE.DoubleSide }), BASKET_SLOTS.length);
  buckets.name = 'basket.buckets'; buckets.castShadow = true; buckets.count = 0; buckets.visible = false; scene.add(buckets);
  BASKET_SLOTS.forEach((s, i) => buckets.setMatrixAt(i, _m.makeTranslation(s.x, s.y, s.z)));
  buckets.instanceMatrix.needsUpdate = true;
  let shownN = 0, chutes = 0, chuteT = 0;
  const CHUTE = { x: DISPENSER.x + 0.5, y: 1.05, z: FILL_POINT.z };   // the dispenser's east-side chute mouth
  // Playthrough 5 A5: the empty-basket lamp, an orange beacon on the dispenser's head (main.js lights it when the basket
  // runs dry mid-day). +1 draw call, only while lit.
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff8a1a, transparent: true }));
  lamp.position.set(DISPENSER.x, 2.0, DISPENSER.z); lamp.visible = false; lamp.name = 'basket.lamp'; scene.add(lamp);
  let lampT = 0;

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
      for (let i = 0; i < want; i++) live.push({ t: 0, delay: i * 0.14, route });
    },
    // The snapshot's basket count and how many Rats are filling (the chute's ball stream).
    basket(n, filling = 0) {
      const k = Math.max(0, Math.min(BASKET_SLOTS.length, n | 0));
      if (k !== shownN) { shownN = k; buckets.count = k; buckets.visible = k > 0; }
      chutes = Math.max(0, Math.min(2, filling | 0));
    },
    alarm(on) { lamp.visible = !!on; },
    tick(dt) {
      if (lamp.visible) { lampT += dt; const k = 0.5 + 0.5 * Math.sin(lampT * 9); lamp.material.opacity = 0.35 + 0.65 * k; lamp.scale.setScalar(0.85 + 0.35 * k); }
      let c = 0;
      if (chutes) {                      // a ball every 0.05 s: 30 in 1.5 s, falling out of the chute
        chuteT = (chuteT + dt) % 0.3;
        for (let j = 0; j < Math.min(chutes * 3, n) && c < n; j++) {
          const u = ((chuteT / 0.3) + j / 3) % 1;
          balls.setMatrixAt(c++, _m.makeTranslation(CHUTE.x + (j % 2) * 0.12, CHUTE.y - 0.75 * u * u, CHUTE.z));
        }
      }
      for (let i = live.length - 1; i >= 0; i--) {
        const b = live[i];
        if (b.delay > 0) { b.delay -= dt; continue; }
        b.t += dt / PIPE_SECS[b.route];
        if (b.t >= 1) { live.splice(i, 1); continue; }
        if (c >= n) continue;              // the chute's balls share the pool
        curves[b.route].getPoint(b.route === 'direct' ? b.t * (0.6 + 0.4 * b.t) : b.t, _p);   // the direct pipe falls: they speed up
        balls.setMatrixAt(c++, _m.makeTranslation(_p.x, _p.y, _p.z));
      }
      balls.count = c; balls.visible = c > 0;
      if (c) balls.instanceMatrix.needsUpdate = true;
    },
  };
}

// Council round 10 §C: the field ball returns (layout.js FIELD_RETURNS), the crew owns `tier` of them. Each is the
// pond tube's red FHI box, taller, with its number on a plate ("RETURN 2"), a feed mouth, and its grey pneumatic pipe
// bending into the ground (it runs home buried). All the owned ones are ONE merged mesh (vertex colours, one canvas
// for the plates): +1 draw call, rebuilt only when the tier changes. thunk(id) gives the box a little kick.
export function createFieldReturns(scene) {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  let tex = null;
  if (c) {
    c.width = 256; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 160);
    FIELD_RETURNS.forEach((r, i) => {
      const y0 = i * 64;
      g.fillStyle = '#fbf6e8'; g.fillRect(0, y0, 256, 64);
      g.strokeStyle = '#2a2418'; g.lineWidth = 5; g.strokeRect(3, y0 + 3, 250, 58);
      g.fillStyle = '#b3261e'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = 'bold 34px "Courier New", monospace'; g.fillText(r.label, 128, y0 + 27);
      g.fillStyle = '#2a2418'; g.font = '600 13px system-ui, sans-serif'; g.fillText('FHI · BALLS IN · THUNK', 128, y0 + 51);
    });
    tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  }
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex });
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
  mesh.name = 'fieldReturns'; mesh.castShadow = true; mesh.visible = false;
  scene.add(mesh);
  const WHITE_V = 0.06;    // the canvas's plain white strip (rows 128-160: v 0..0.2)
  const { W, D, H } = FIELD_RETURN;

  function build(tier) {
    const pos = [], nor = [], col = [], uv = [];
    const put = (geo, color, m, plate = -1) => {
      const gg = (geo.index ? geo.toNonIndexed() : geo).applyMatrix4(m);
      const cc = new THREE.Color(color), p = gg.attributes.position, n = gg.attributes.normal, u = gg.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(cc.r, cc.g, cc.b);
        if (plate >= 0 && u) uv.push(u.getX(i), 1 - (plate * 64 + 64) / 160 + u.getY(i) * 64 / 160);   // plate i's band
        else uv.push(0.5, WHITE_V);
      }
    };
    const T = (x, y, z, ry = 0, rx = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1));
    for (const r of fieldReturns(tier)) {
      const i = FIELD_RETURNS.indexOf(r), X = r.x, Z = r.z;
      put(new THREE.BoxGeometry(W + 0.2, 0.08, D + 0.2), 0x7d7f80, T(X, 0.04, Z));                // the concrete pad
      put(new THREE.BoxGeometry(W, H, D), 0xb3261e, T(X, 0.08 + H / 2, Z));                      // the red box
      put(new THREE.BoxGeometry(W + 0.06, 0.07, D + 0.06), 0x7d1812, T(X, 0.08 + H + 0.035, Z)); // its lid
      put(new THREE.BoxGeometry(0.5, 0.16, 0.04), 0x1c1a18, T(X, 0.08 + H - 0.35, Z + D / 2 + 0.01));   // the feed mouth (+z: the bank side)
      put(new THREE.BoxGeometry(0.56, 0.04, 0.12), 0xd9d4c4, T(X, 0.08 + H - 0.44, Z + D / 2 + 0.05)); // its lip
      put(new THREE.BoxGeometry(0.06, 0.6, 0.06), 0x6b5a45, T(X, 0.08 + H + 0.35, Z));            // the plate's post
      put(new THREE.PlaneGeometry(1.0, 0.25), 0xffffff, T(X, 0.08 + H + 0.62, Z + 0.035), i);            // the plate, both faces
      put(new THREE.PlaneGeometry(1.0, 0.25), 0xffffff, T(X, 0.08 + H + 0.62, Z - 0.035, Math.PI), i);
      // The pneumatic pipe: out of the back, an elbow, and down into the ground (it runs home buried).
      put(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), 0x9aa3a8, T(X, 0.5, Z - D / 2 - 0.25, 0, Math.PI / 2));
      put(new THREE.SphereGeometry(0.11, 10, 6), 0x9aa3a8, T(X, 0.5, Z - D / 2 - 0.5));
      put(new THREE.CylinderGeometry(0.09, 0.09, 0.5, 10), 0x9aa3a8, T(X, 0.25, Z - D / 2 - 0.5));
      put(new THREE.CylinderGeometry(0.2, 0.24, 0.06, 12), 0x5a4a3a, T(X, 0.03, Z - D / 2 - 0.5));   // the dug-in collar
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    mesh.geometry.dispose(); mesh.geometry = geo;
    mesh.visible = pos.length > 0;
  }

  let tier = -1, kick = 0;
  return {
    mesh,
    // The crew's 'returns' tier (0 none, 1 Field, 2 + Back). Rebuilds only on a change.
    update(t) { t = Math.max(0, Math.min(FIELD_RETURNS.length, t | 0)); if (t !== tier) { tier = t; build(t); } },
    thunk() { kick = 1; },
    tick(dt) { if (kick > 0) { kick = Math.max(0, kick - dt * 4); mesh.position.y = Math.sin(kick * 9) * 0.02 * kick; } },
  };
}
