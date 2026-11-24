// The ball-flow chain you can see (owner layout, 2026-11-24; the numbers are in layout.js): the clear pipe from the
// ball return by the mats to the bank's silo, the riser into the washer's hopper once the crew owns it (the washer's
// own chute, washer.js, carries on to the silo), balls rolling along it when anyone banks, and the customers'
// basket of balls by the BUCKETS dispenser. Draw calls: one pipe (the other is hidden), one InstancedMesh of
// rolling balls (hidden when none roll; its pool is the detail.js tier's pipeBalls), one merged basket.
import * as THREE from 'three';
import { PIPE_DIRECT, PIPE_WASHER, PIPE_SECS, BASKET } from './layout.js';

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
    for (let i = 0; i < 4; i++) put(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 12, 1, true), 0x2f6fbf, 0.6, 0.15 + i * 0.07, 0.15);
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
    tick(dt) {
      let c = 0;
      for (let i = live.length - 1; i >= 0; i--) {
        const b = live[i];
        if (b.delay > 0) { b.delay -= dt; continue; }
        b.t += dt / PIPE_SECS[b.route];
        if (b.t >= 1) { live.splice(i, 1); continue; }
        curves[b.route].getPoint(b.route === 'direct' ? b.t * (0.6 + 0.4 * b.t) : b.t, _p);   // the direct pipe falls: they speed up
        balls.setMatrixAt(c++, _m.makeTranslation(_p.x, _p.y, _p.z));
      }
      balls.count = c; balls.visible = c > 0;
      if (c) balls.instanceMatrix.needsUpdate = true;
    },
  };
}
