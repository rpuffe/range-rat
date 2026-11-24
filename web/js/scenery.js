// Decorative scenery for Range Rat: nets, fence, trees, hills, the customer
// parking lot and entrance arch, a clubhouse backdrop, and small props.
// Everything happens inside createScenery(); this module has no side effects.
import * as THREE from 'three';
import { MAP, creekProject } from './map.js';

// Key coordinates for the customer-arrival feature (metres, world space).
// path runs from a parked car, across the lot, through the gate, to the stand.
export const ENTRANCE = {
  lot: { x: -10, z: 31 },
  gate: { x: -3, z: 9.5 },
  path: [[-12, 35.5], [-12, 31], [-3, 31], [-3, 20], [-3, 9.5], [-3, 5.5], [8, 5.5], [18, 5.5], [23.5, 5.2]],
};

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScenery(scene, { lowDetail = false } = {}) {
  const rnd = mulberry32(20240611);
  const R = (a, b) => a + (b - a) * rnd();
  const root = new THREE.Group();
  root.name = 'scenery';
  scene.add(root);

  const lambert = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  // Build an InstancedMesh from item descriptors:
  // { p:[x,y,z], ry, rx, rz, s:[sx,sy,sz] | number, c: colour }
  function inst(geo, mat, items, { shadow = false } = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach((it, i) => {
      dummy.position.set(it.p[0], it.p[1], it.p[2]);
      dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      const s = it.s === undefined ? 1 : it.s;
      if (typeof s === 'number') dummy.scale.set(s, s, s); else dummy.scale.set(s[0], s[1], s[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (it.c !== undefined) mesh.setColorAt(i, tmpColor.set(it.c));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    mesh.castShadow = shadow;
    root.add(mesh);
    return mesh;
  }
  const mesh = (geo, mat, x, y, z, shadow = false) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = shadow;
    root.add(m);
    return m;
  };
  const flatPlane = () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const flatCircle = (seg = 20) => new THREE.CircleGeometry(1, seg).rotateX(-Math.PI / 2);
  const decalOpts = (f) => ({ polygonOffset: true, polygonOffsetFactor: -f, polygonOffsetUnits: -f });

  // Shared materials
  const woodDark = lambert(0x6b5a45);
  const white = lambert(0xffffff);

  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Shared bags filled by several sections, built into InstancedMeshes in "Flora".
  const bushes = [];
  const flowers = [];
  const flags = { mesh: null, items: [] };
  const FLOWER_COLS = [0xf06a8a, 0xffd23f, 0xf4f0e6, 0xff8a3d, 0xb58cf0, 0xff5a4a];
  const addBush = (x, y, z, s) => bushes.push({ p: [x, y, z], s: [s * R(1.0, 1.5), s * R(0.55, 0.8), s * R(0.9, 1.3)], ry: R(0, 3), c: tmpColor.setHSL(R(0.22, 0.31), R(0.4, 0.55), R(0.22, 0.32)).clone() });
  const addFlowers = (x, y, z, spread, n) => {
    for (let i = 0; i < n; i++) flowers.push({ p: [x + R(-spread, spread), y + R(0, 0.12), z + R(-spread * 0.4, spread * 0.4)], s: R(0.8, 1.3), c: FLOWER_COLS[(rnd() * FLOWER_COLS.length) | 0] });
  };

  // ---------- 7. Ground variation ----------
  {
    const rough = lambert(0x6d9440, decalOpts(2));
    inst(flatPlane(), rough, [
      { p: [-207.5, 0.01, 0], s: [285, 1, 700] },
      { p: [207.5, 0.01, 0], s: [285, 1, 700] },
    ]);
    // gravel strip under the fence (broken at the entrance gap and cart gap)
    inst(flatPlane(), lambert(0xb7a98a, decalOpts(3)), [
      { p: [-36.5, 0.012, 9.5], s: [57, 1, 1.5] },
      { p: [15, 0.012, 9.5], s: [26, 1, 1.5] },
      { p: [49.75, 0.012, 9.5], s: [30.5, 1, 1.5] },
    ]);
    // subtle decals on the field: target greens and dark tufts (flat, y <= 0.02)
    const greens = [];
    const flagSpots = [];
    for (const { x, z, r } of MAP.FLAGS.map((f, i) => ({ ...f, r: [6, 7, 7][i] ?? 6 }))) {
      greens.push({ p: [x, 0.016, z], s: [r * 1.22, 1, r * 1.22], c: 0x5a9044 });   // fringe
      greens.push({ p: [x, 0.018, z], s: [r, 1, r], c: 0x6aa352 });
      greens.push({ p: [x, 0.02, z], s: [r * 0.45, 1, r * 0.45], c: 0x7db85c });
      flagSpots.push({ x, z, ph: R(0, 6) });
    }
    inst(flatCircle(28), lambert(0xffffff, decalOpts(4)), greens);
    flags.items = []; flags.mesh = null;   // the flags themselves are terrain.js's (Dimple Creek)
    const tufts = [];
    for (let i = 0; i < (lowDetail ? 14 : 28); i++) {
      const x = R(-56, 56), z = R(-180, -12);
      if (Math.hypot(x + 12, z + 78) < 12 || creekProject(x, z).d < MAP.CREEK.HW + 1.5) continue;   // not in the pond or the creek
      tufts.push({ p: [x, 0.017, z], s: [R(0.5, 1.2), 1, R(0.4, 0.9)], ry: R(0, 3) });
    }
    inst(flatCircle(10), lambert(0x4e7c2e, decalOpts(4)), tufts);
  }

  // ---------- 1. Range boundaries ----------
  let rightPoles = null;   // the right net's poles, their own mesh so the County can move them out with the net
  {
    const gridTex = canvasTex(64, 64, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      g.strokeStyle = 'rgba(235,240,235,1)';
      g.lineWidth = 3;
      g.strokeRect(0, 0, w, h);
    });
    gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
    gridTex.anisotropy = 4;
    const netMat = new THREE.MeshBasicMaterial({
      map: gridTex, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false,
    });
    const netGeo = (len, h) => {
      const g = new THREE.PlaneGeometry(len, h);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 2.5, uv.getY(i) * h / 2.5);
      return g;
    };
    const sideGeo = netGeo(185, 12).rotateY(Math.PI / 2);
    for (const sx of [-MAP.NETS.side, MAP.NETS.side]) mesh(sideGeo, netMat, sx, 8, -97.5);
    mesh(netGeo(130, 12), netMat, 0, 8, MAP.NETS.back);

    const poles = [], right = [], poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 16, 6), poleMat = lambert(0x6e747a);
    for (const sx of [-MAP.NETS.side, MAP.NETS.side]) for (let z = -5; z >= MAP.NETS.back - 0.1; z -= 14.7) (sx > 0 ? right : poles).push({ p: [sx, 8, z] });
    for (let x = -MAP.NETS.side; x <= MAP.NETS.side + 0.1; x += 12.9) poles.push({ p: [x, 8, MAP.NETS.back] });
    inst(poleGeo, poleMat, poles);
    rightPoles = inst(poleGeo, poleMat, right);

    // fence posts along z 9.5 with gaps for the entrance (-8..2) and cart (28..34.5)
    const posts = [];
    for (let x = -65; x <= 65.01; x += 2.5) {
      if ((x > -8 && x < 2) || (x > 28 && x < 34.5)) continue;
      posts.push({ p: [x, 0.6, 9.5] });
    }
    const fenceMat = lambert(0x3f7a45);
    inst(new THREE.BoxGeometry(0.15, 1.2, 0.15), fenceMat, posts);
    inst(new THREE.BoxGeometry(1, 0.08, 0.06), fenceMat, [
      { p: [-36.5, 0.95, 9.5], s: [57, 1, 1] },
      { p: [15, 0.95, 9.5], s: [26, 1, 1] },
      { p: [49.75, 0.95, 9.5], s: [30.5, 1, 1] },
    ]);
  }

  // ---------- 2. Trees ----------
  const sway = { mesh: null, items: [], acc: 0 };
  {
    const N = lowDetail ? 110 : 220;
    const blocked = (x, z) => {
      if (x > -36 && x < 16 && z > 6 && z < 50) return true;          // reserved lot
      if (Math.hypot(x - 52, z - 22) < 16) return true;               // clubhouse
      if (x > 12 && x < 42 && z < 20) return true;                    // stand, cart, sign
      if (Math.abs(x) < 68 && z < 12) return true;                    // field and nets
      if (Math.abs(x) < 68 && z < -215 && z > -225) return true;
      return false;
    };
    // cluster centres
    const zones = [];
    for (let i = 0; i < 16; i++) {
      const side = i % 2 ? 1 : -1;
      zones.push([side * R(80, 160), R(-265, 30)]);
    }
    for (let i = 0; i < 8; i++) zones.push([R(-130, 130), R(22, 55)]);
    for (let i = 0; i < 4; i++) zones.push([R(-100, 100), R(-282, -235)]);
    const trees = [];
    let guard = 0;
    while (trees.length < N && guard++ < 6000) {
      const zc = zones[(rnd() * zones.length) | 0];
      const x = zc[0] + (rnd() + rnd() + rnd() - 1.5) * 26;
      const z = zc[1] + (rnd() + rnd() + rnd() - 1.5) * 26;
      if (blocked(x, z)) continue;
      if (Math.abs(x) < 70 && z < 12 && z > -225) continue;
      if (z < -288 || Math.abs(x) > 175) continue;
      if (z > 62) continue;
      const cone = rnd() < 0.55;
      const s = R(0.8, 1.6);
      const greens = [0x4f7f33, 0x5d8f3a, 0x6b9a3f, 0x3f6f35, 0x78a043];
      const autumn = [0xd98a2b, 0xc8692a, 0xe0a33a];
      const pr = rnd();
      const base = pr < 0.09 ? autumn[(rnd() * 3) | 0]
        : pr < 0.17 ? 0xe9a3b8                     // blossom pink
        : pr < 0.23 ? 0xb8662f                     // copper beech
        : greens[(rnd() * 5) | 0];
      const col = new THREE.Color(base).offsetHSL(R(-0.025, 0.025), R(-0.06, 0.08), R(-0.05, 0.06));
      trees.push({ x, z, s, cone, col, ph: R(0, 6.28), trunkH: 1.6 * s });
    }
    const trunks = trees.map(t => ({ p: [t.x, 0, t.z], s: [t.s, t.trunkH, t.s] }));
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 1, 6).translate(0, 0.5, 0);
    inst(trunkGeo, lambert(0x6b4a2e), trunks);

    // faint warm emissive = golden-hour rim lift without any lights
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x241506 });
    const coneGeo = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
    const ballGeo = new THREE.IcosahedronGeometry(1, 1);
    for (const isCone of [true, false]) {
      const list = trees.filter(t => t.cone === isCone);
      const items = list.map(t => isCone
        ? { p: [t.x, t.trunkH * 0.8, t.z], s: [2.2 * t.s, 5.6 * t.s, 2.2 * t.s], c: t.col }
        : { p: [t.x, t.trunkH + 1.6 * t.s, t.z], s: [2.5 * t.s, 2.2 * t.s, 2.5 * t.s], c: t.col });
      const m = inst(isCone ? coneGeo : ballGeo, canopyMat, items);
      list.forEach((t, i) => sway.items.push({ m, i, it: items[i], ph: t.ph }));
    }
    sway.meshes = sway.items.reduce((a, o) => (a.includes(o.m) ? a : a.concat(o.m)), []);
  }

  // ---------- 3. Distant hills ----------
  {
    const items = [];
    const n = lowDetail ? 16 : 26;
    const cols = [0x5f8a6a, 0x66917a, 0x587f6c, 0x6a9484, 0x5a7f78];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R(-0.08, 0.08);
      const r = R(320, 580);
      const h = R(35, 85);
      items.push({
        p: [Math.sin(a) * r, -h * 0.25, -Math.cos(a) * r - 100],
        s: [R(110, 220), h, R(90, 150)], ry: R(0, 3), c: cols[i % cols.length],
      });
    }
    // vertex-colour gradient: shaded valleys at the base, sunlit warm tops (multiplies instance colour)
    const hillGeo = new THREE.IcosahedronGeometry(1, 1);
    const hp = hillGeo.attributes.position;
    const hc = new Float32Array(hp.count * 3);
    for (let i = 0; i < hp.count; i++) {
      const k = Math.min(1, Math.max(0, (hp.getY(i) + 0.25) / 1.25));
      hc[i * 3] = 0.62 + 0.62 * k; hc[i * 3 + 1] = 0.66 + 0.5 * k; hc[i * 3 + 2] = 0.78 + 0.1 * k - 0.1 * k * k * 2;
    }
    hillGeo.setAttribute('color', new THREE.BufferAttribute(hc, 3));
    inst(hillGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, vertexColors: true, emissive: 0x120a08 }), items);
  }

  // ---------- 4. Parking lot and entrance ----------
  {
    mesh(new THREE.PlaneGeometry(36, 22).rotateX(-Math.PI / 2), lambert(0x3a3d42, decalOpts(2)), -10, 0.01, 31);
    // bay lines (skip the two beside the walkway stall at x -3)
    const lines = [];
    for (let x = -25.5; x <= 7.6; x += 3) {
      if (Math.abs(x + 4.5) < 0.1 || Math.abs(x + 1.5) < 0.1) { lines.push({ p: [x, 0.02, 38.75], s: [0.12, 1, 5.5] }); continue; }
      lines.push({ p: [x, 0.02, 23.75], s: [0.12, 1, 5.5] });
      lines.push({ p: [x, 0.02, 38.75], s: [0.12, 1, 5.5] });
    }
    inst(new THREE.BoxGeometry(1, 0.02, 1), lambert(0xe9e6dc), lines);

    // cars
    const cars = [
      [-24, 23.8, Math.PI, 0xc0392b], [-18, 23.8, Math.PI, 0x2f6fb5], [3, 23.8, Math.PI, 0xe0b43a],
      [-15, 38.7, 0, 0xdadada], [-12, 38.7, 0, 0x3b7a4a], [-6, 38.7, 0, 0x6a4a8a],
    ];
    const bodies = [], cabins = [], wheels = [];
    const M = new THREE.Matrix4(), L = new THREE.Matrix4(), P = new THREE.Matrix4();
    const bodyM = [], cabinM = [], wheelM = [], bodyC = [];
    const place = (arr, car, lx, ly, lz, sx = 1, sy = 1, sz = 1, rz = 0) => {
      const [cx, cz, yaw] = car;
      M.makeRotationY(yaw + R(-0.03, 0.03));
      M.setPosition(cx + R(-0.12, 0.12), 0, cz);
      dummy.position.set(lx, ly, lz); dummy.rotation.set(0, 0, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
      L.copy(dummy.matrix);
      P.multiplyMatrices(M, L);
      arr.push(P.clone());
    };
    for (const car of cars) {
      place(bodyM, car, 0, 0.55, 0); bodyC.push(car[3]);
      place(cabinM, car, 0, 1.17, -0.2);
      for (const [wx, wz] of [[-0.9, -1.4], [0.9, -1.4], [-0.9, 1.4], [0.9, 1.4]]) place(wheelM, car, wx, 0.33, wz, 1, 1, 1, Math.PI / 2);
    }
    const instM = (geo, mat, mats, colors, shadow) => {
      const m = new THREE.InstancedMesh(geo, mat, mats.length);
      mats.forEach((mm, i) => { m.setMatrixAt(i, mm); if (colors) m.setColorAt(i, tmpColor.set(colors[i])); });
      m.instanceMatrix.needsUpdate = true; m.frustumCulled = false; m.castShadow = shadow;
      root.add(m);
    };
    instM(new THREE.BoxGeometry(1.8, 0.7, 4.2), white, bodyM, bodyC, false);
    instM(new THREE.BoxGeometry(1.6, 0.55, 2.2), lambert(0x34424e), cabinM, null, false);
    instM(new THREE.CylinderGeometry(0.33, 0.33, 0.25, 10), lambert(0x1c1c1e), wheelM, null, false);
    void bodies; void cabins; void wheels;

    // paved path
    const segs = [];
    const W = 2.2, pts = ENTRANCE.path;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
      segs.push({ p: [(ax + bx) / 2, 0.016, (az + bz) / 2], ry: Math.atan2(-dz, dx), s: [len + W, 1, W] });
    }
    inst(flatPlane(), lambert(0xb9b2a0, decalOpts(4)), segs);

    // entrance arch (gap x -8..2, centre -3, fence line z 9.5)
    const gx = ENTRANCE.gate.x, gz = ENTRANCE.gate.z;
    const archMat = lambert(0x2f5d3a);
    inst(new THREE.BoxGeometry(0.6, 5.2, 0.6), archMat, [{ p: [gx - 4.4, 2.6, gz] }, { p: [gx + 4.4, 2.6, gz] }], { shadow: true });
    mesh(new THREE.BoxGeometry(9.8, 1.5, 0.3), archMat, gx, 5.45, gz, true);
    const signTex = canvasTex(2048, 256, (g, w, h) => {
      g.fillStyle = '#23472c'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#e8dfc2'; g.lineWidth = 8; g.strokeRect(14, 14, w - 28, h - 28);
      g.fillStyle = '#f3ecd2'; g.font = 'bold 118px Georgia, "Times New Roman", serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('FAIRWAY HOLDINGS · MUNI RANGE', w / 2, h / 2 + 6);
    });
    const signMat = new THREE.MeshBasicMaterial({ map: signTex });
    const signGeo = new THREE.PlaneGeometry(9.4, 1.18);
    mesh(signGeo, signMat, gx, 5.45, gz + 0.16);
    const back = mesh(signGeo, signMat, gx, 5.45, gz - 0.16);
    back.rotation.y = Math.PI;
    // Dimples on top: a golf ball in a necktie
    const ball = mesh(new THREE.SphereGeometry(0.55, 14, 10), lambert(0xfafafa), gx, 6.7, gz, true);
    ball.scale.set(1, 1, 1);
    mesh(new THREE.BoxGeometry(0.22, 0.6, 0.08), lambert(0xd9382b), gx, 6.45, gz + 0.54);
  }

  // ---------- 5. Clubhouse backdrop ----------
  const clubFlag = {};
  {
    const cx = 52, cz = 22;
    const body = mesh(new THREE.BoxGeometry(14, 4.5, 8), lambert(0xd9c9a3), cx, 2.25, cz, true);
    body.receiveShadow = true;
    // gable roof (ridge along x)
    const roofGeo = new THREE.CylinderGeometry(1, 1, 1, 3).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);
    const roof = mesh(roofGeo, lambert(0x8a3b2e), cx, 4.5 + 0.5 * (2.4 / 1.5), cz, true);
    roof.scale.set(14.8, 2.4 / 1.5, 9.4 / 1.732);
    // porch
    mesh(new THREE.BoxGeometry(14, 0.3, 2.4), lambert(0x9a7b52), cx, 0.15, cz - 5.2);
    mesh(new THREE.BoxGeometry(14.4, 0.15, 2.9), lambert(0x7a3326), cx, 3.15, cz - 5.2, true);
    inst(new THREE.CylinderGeometry(0.1, 0.1, 3, 6), lambert(0xeee6d0),
      [-6.8, -2.2, 2.2, 6.8].map(dx => ({ p: [cx + dx, 1.65, cz - 6.2] })));
    // windows and door
    inst(new THREE.BoxGeometry(1.4, 1.3, 0.1), lambert(0xf0c27a),
      [-4.8, -2.4, 2.4, 4.8].map(dx => ({ p: [cx + dx, 2.2, cz - 4.03] })));
    mesh(new THREE.BoxGeometry(1.3, 2.3, 0.1), lambert(0x5b3b24), cx, 1.45, cz - 4.03);
    // flagpole and flag
    mesh(new THREE.CylinderGeometry(0.07, 0.1, 9.5, 6), lambert(0xe8e8e8), cx + 8.8, 4.75, cz - 3);
    mesh(new THREE.SphereGeometry(0.16, 8, 6), lambert(0xe0b43a), cx + 8.8, 9.6, cz - 3);
    const ftex = canvasTex(128, 80, (g, w, h) => {
      g.fillStyle = '#2f6b3a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fafafa'; g.beginPath(); g.arc(w / 2, h / 2, 24, 0, 6.3); g.fill();
      g.fillStyle = '#d9382b'; g.fillRect(w / 2 - 4, h / 2 + 14, 8, 16);
    });
    const fg = new THREE.PlaneGeometry(2.2, 1.35, 8, 4).translate(1.1, 0, 0);
    const flag = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: ftex, side: THREE.DoubleSide }));
    flag.position.set(cx + 8.8, 8.7, cz - 3);
    root.add(flag);
    clubFlag.geo = fg;
    clubFlag.base = Float32Array.from(fg.attributes.position.array);
  }

  // ---------- 6. Small props ----------
  const sock = {};
  {
    // benches facing the field (-z)
    const benches = [[18, 8.7], [-14, 8.7], [48, 6.5]];
    const bm = lambert(0x8b6b45);
    inst(new THREE.BoxGeometry(1.8, 0.08, 0.5), bm, benches.map(([x, z]) => ({ p: [x, 0.5, z] })));
    inst(new THREE.BoxGeometry(1.8, 0.45, 0.06), bm, benches.map(([x, z]) => ({ p: [x, 0.78, z + 0.22], rx: -0.12 })));
    const legs = [];
    for (const [x, z] of benches) for (const dx of [-0.8, 0.8]) legs.push({ p: [x + dx, 0.25, z] });
    inst(new THREE.BoxGeometry(0.08, 0.5, 0.45), lambert(0x3d3d40), legs);

    // trash cans
    const cans = [[20.5, 8.8], [-9, 8.7], [45.5, 6.5], [-16.5, 8.7]];
    inst(new THREE.CylinderGeometry(0.3, 0.25, 0.8, 8), lambert(0x3b5a3a), cans.map(([x, z]) => ({ p: [x, 0.4, z] })));
    inst(new THREE.CylinderGeometry(0.33, 0.33, 0.06, 8), lambert(0x6e747a), cans.map(([x, z]) => ({ p: [x, 0.83, z] })));

    // ball dispenser machine
    mesh(new THREE.BoxGeometry(0.9, 1.5, 0.7), lambert(0xd9382b), 23.5, 0.75, 8.5);
    mesh(new THREE.SphereGeometry(0.42, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), lambert(0xe6f2f2, { transparent: true, opacity: 0.8 }), 23.5, 1.5, 8.5);
    mesh(new THREE.BoxGeometry(0.6, 0.35, 0.05), lambert(0x222428), 23.5, 1.0, 8.14);

    // windsock
    mesh(new THREE.CylinderGeometry(0.05, 0.08, 6, 6), lambert(0xe8e8e8), 60, 3, -10);
    const pivot = new THREE.Group();
    pivot.position.set(60, 6, -10);
    const sg = new THREE.ConeGeometry(0.42, 1.9, 8, 4, true).rotateZ(-Math.PI / 2).translate(0.95, 0, 0);
    const cols = new Float32Array(sg.attributes.position.count * 3);
    for (let i = 0; i < sg.attributes.position.count; i++) {
      const band = Math.floor(sg.attributes.position.getX(i) / 0.48 + 0.01) % 2;
      tmpColor.set(band ? 0xfafafa : 0xe8742a).toArray(cols, i * 3);
    }
    sg.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    const sockMesh = new THREE.Mesh(sg, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    pivot.add(sockMesh);
    root.add(pivot);
    sock.pivot = pivot; sock.mesh = sockMesh;

    // yardage signs on the left net (100/150/200 yd)
    const ys = [[100, -91.4], [150, -137.2], [200, -182.9]];
    inst(new THREE.BoxGeometry(0.12, 2.6, 0.12), woodDark, ys.map(([, z]) => ({ p: [-63.6, 1.3, z] })));
    const sgeo = new THREE.PlaneGeometry(2.2, 1.1);
    for (const [yd, z] of ys) {
      const tex = canvasTex(256, 128, (g, w, h) => {
        g.fillStyle = '#23472c'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#f3ecd2'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
        g.fillStyle = '#f3ecd2'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(yd + ' YD', w / 2, h / 2 + 4);
      });
      const m = mesh(sgeo, new THREE.MeshBasicMaterial({ map: tex }), -63.5, 2.3, z);
      m.rotation.y = Math.PI / 2;
    }
  }

  // ---------- 8. Path edging and lamp posts ----------
  const lamps = { halo: null };
  {
    const pts = ENTRANCE.path;
    const segD = (px, pz, ax, az, bx, bz) => {
      const dx = bx - ax, dz = bz - az;
      const u = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(px - (ax + u * dx), pz - (az + u * dz));
    };
    const bricks = [];
    const step = lowDetail ? 1.2 : 0.62;
    const brickCols = [0xb86a4b, 0xa95c41, 0xc27a55, 0x9e5a45];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
      const ux = dx / len, uz = dz / len;
      for (let d = 0.3; d < len; d += step) {
        for (const side of [-1, 1]) {
          const x = ax + ux * d - uz * 1.13 * side, z = az + uz * d + ux * 1.13 * side;
          if (x > 17 && z < 8) continue;                       // keep clear of the stand end
          let clear = true;
          for (let j = 0; j < pts.length - 1 && clear; j++) {
            if (segD(x, z, pts[j][0], pts[j][1], pts[j + 1][0], pts[j + 1][1]) < 1.0) clear = false;
          }
          if (clear) bricks.push({ p: [x, 0.03, z], ry: Math.atan2(-dz, dx), c: brickCols[(rnd() * 4) | 0] });
        }
      }
    }
    inst(new THREE.BoxGeometry(0.5, 0.05, 0.15), lambert(0xffffff), bricks);

    const spots = [[-10.2, 33.5], [-8, 29.2], [-5.2, 17], [-0.8, 17], [-0.8, 25], [2.5, 7], [9, 7]];
    inst(new THREE.CylinderGeometry(0.05, 0.07, 3.2, 6).translate(0, 1.6, 0), lambert(0x2e3034), spots.map(([x, z]) => ({ p: [x, 0, z] })));
    inst(new THREE.SphereGeometry(0.18, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffdc8f }), spots.map(([x, z]) => ({ p: [x, 3.3, z] })));
    lamps.halo = new THREE.MeshBasicMaterial({ color: 0xffb860, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
    inst(new THREE.SphereGeometry(0.55, 8, 6), lamps.halo, spots.map(([x, z]) => ({ p: [x, 3.3, z] })));
  }

  // ---------- 9. Flora: bushes, planters, flower beds ----------
  {
    const dens = lowDetail ? 2 : 1;
    // behind the fence (z > 9.5); skip the stand/cart stretch (x 12..42) and the entrance gap
    for (const [x0, x1] of [[-64, -9.5], [3, 10.5], [43, 64]]) {
      for (let x = x0; x < x1; x += R(2.4, 3.6) * dens) {
        const z = 10.7 + R(-0.15, 0.5), s = R(0.5, 0.85);
        addBush(x, s * 0.35, z, s);
        addFlowers(x, s * 0.75, z, s, lowDetail ? 2 : 4);
      }
    }
    // lot edges
    for (let z = 21; z < 42; z += 3.6 * dens) {
      for (const x of [-29.4, 8.9]) { const s = R(0.5, 0.8); addBush(x, s * 0.35, z, s); addFlowers(x, s * 0.75, z, s, 3); }
    }
    for (let x = -27; x < 8; x += 3.6 * dens) { const s = R(0.5, 0.8); addBush(x, s * 0.35, 43, s); addFlowers(x, s * 0.75, 43, s, 3); }
    // clubhouse porch beds
    for (const [x0, x1] of [[43, 49], [55.5, 61.5]]) {
      for (let x = x0; x < x1; x += 1.5 * dens) { const s = R(0.45, 0.7); addBush(x, s * 0.35, 14.7, s); addFlowers(x, s * 0.75, 14.7, s, 4); }
    }
    // arch planters (both sides of both posts)
    const gx = ENTRANCE.gate.x, gz = ENTRANCE.gate.z;
    const planters = [];
    for (const px of [gx - 4.4, gx + 4.4]) {
      for (const dz of [-1.0, 1.0]) {
        planters.push({ p: [px, 0.25, gz + dz] });
        addFlowers(px, 0.6, gz + dz, 0.6, 7);
        addBush(px, 0.55, gz + dz, 0.38);
      }
    }
    inst(new THREE.BoxGeometry(1.5, 0.5, 0.7), lambert(0x8a5a3a), planters);

    inst(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true, emissive: 0x1a1006 }), bushes);
    inst(new THREE.IcosahedronGeometry(0.11, 0), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x2a1a0c }), flowers);
  }

  // ---------- 10. Sky dressing: clouds, birds, haze ----------
  const clouds = { mesh: null, items: [] };
  const birds = { mesh: null, items: [] };
  const haze = { mat: null };
  {
    // clouds: one merged puff of overlapping spheres, instanced with per-cloud scale/tint
    const puffs = [[0, 0, 0, 1], [0.9, -0.1, 0.1, 0.8], [-0.95, -0.12, -0.1, 0.78], [0.35, 0.35, 0.2, 0.7], [-0.4, 0.3, -0.2, 0.65], [1.6, -0.25, 0, 0.5], [-1.6, -0.25, 0.1, 0.5]];
    const pos = [], nor = [];
    for (const [x, y, z, r] of puffs) {
      const g = new THREE.IcosahedronGeometry(r, 1).translate(x, y, z);
      const p = g.attributes.position.array, n = g.attributes.normal.array;
      for (let i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(n[i]); }
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    cg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    const cmat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82, depthWrite: false, emissive: 0x3a2418 });
    const tints = [0xfff1e4, 0xffe6d2, 0xfff6ee, 0xffdcc4];
    const n = lowDetail ? 6 : 10;
    for (let i = 0; i < n; i++) {
      const w = R(26, 48);
      clouds.items.push({
        x: R(-650, 650), y: R(150, 290), z: R(-520, -120), sx: w, sy: w * R(0.22, 0.3), sz: w * R(0.5, 0.75),
        ry: R(0, 3), v: R(1.2, 3.2), c: tints[i % tints.length],
      });
    }
    clouds.mesh = inst(cg, cmat, clouds.items.map(c => ({ p: [c.x, c.y, c.z], s: [c.sx, c.sy, c.sz], ry: c.ry, c: c.c })));

    // birds: flapping chevrons circling far off
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, -0.3, -0.75, 0.0, 0.45, 0, 0, 0.1,
      0, 0, -0.3, 0, 0, 0.1, 0.75, 0.0, 0.45,
    ], 3));
    const bmat = new THREE.MeshBasicMaterial({ color: 0x3e2f38, side: THREE.DoubleSide });
    const nb = lowDetail ? 5 : 10;
    for (let i = 0; i < nb; i++) {
      birds.items.push({
        cx: R(-40, 40), cz: R(-210, -120), r: R(120, 260), y: R(55, 120),
        w: R(0.04, 0.08) * (i % 2 ? 1 : -1), a: R(0, 6.28), ph: R(0, 6), s: R(2.0, 3.0),
      });
    }
    birds.mesh = inst(bg, bmat, birds.items.map(b => ({ p: [b.cx, b.y, b.cz] })));

    // horizon haze: open cylinder, vertex alpha fading upward
    const hg = new THREE.CylinderGeometry(700, 700, 80, 48, 1, true).translate(0, 40, 0);
    const hpos = hg.attributes.position, hcol = new Float32Array(hpos.count * 4);
    for (let i = 0; i < hpos.count; i++) {
      const k = hpos.getY(i) / 80;
      hcol[i * 4] = 1; hcol[i * 4 + 1] = 0.84; hcol[i * 4 + 2] = 0.66; hcol[i * 4 + 3] = 0.55 * (1 - k) * (1 - k);
    }
    hg.setAttribute('color', new THREE.BufferAttribute(hcol, 4));
    haze.mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.BackSide, depthWrite: false, fog: false });
    const hm = mesh(hg, haze.mat, 0, 0, -100);
    hm.frustumCulled = false;
    hm.renderOrder = -1;
  }

  // ---------- 11. Fireflies (dusk only) ----------
  const flies = { mesh: null, items: [], mat: null };
  {
    const n = lowDetail ? 16 : 34;
    for (let i = 0; i < n; i++) {
      const lot = i % 4 === 0;
      flies.items.push({
        x: lot ? R(-34, 12) : (i % 2 ? 1 : -1) * R(70, 115), y: lot ? R(1.5, 3) : R(0.7, 3.5),
        z: lot ? R(12, 45) : R(-210, 30), ph: R(0, 6.28), sp: R(0.5, 1.1),
      });
    }
    flies.mat = new THREE.MeshBasicMaterial({ color: 0xf3ff8a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    flies.mesh = inst(new THREE.IcosahedronGeometry(0.09, 0), flies.mat, flies.items.map(f => ({ p: [f.x, f.y, f.z] })));
    flies.mesh.visible = false;
  }

  // ---------- animation ----------
  const flagPos = clubFlag.geo.attributes.position;
  const hazeCol = new THREE.Color(), hazeA = new THREE.Color(0xf3dcb8), hazeB = new THREE.Color(0xff9e6a);
  return {
    rightPoles,   // the right side net's poles (the County moves them with the net)
    // dt seconds, t running seconds, timeOfDay01 optional (0 morning .. 1 sunset)
    tick(dt, t, timeOfDay01 = 0) {
      // clouds drift
      for (let i = 0; i < clouds.items.length; i++) {
        const c = clouds.items[i];
        c.x += c.v * dt; if (c.x > 700) c.x = -700;
        dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(0, c.ry, 0); dummy.scale.set(c.sx, c.sy, c.sz);
        dummy.updateMatrix(); clouds.mesh.setMatrixAt(i, dummy.matrix);
      }
      clouds.mesh.instanceMatrix.needsUpdate = true;
      // birds circle and flap
      for (let i = 0; i < birds.items.length; i++) {
        const b = birds.items[i];
        b.a += b.w * dt;
        const vx = -Math.sin(b.a) * Math.sign(b.w), vz = Math.cos(b.a) * Math.sign(b.w);
        dummy.position.set(b.cx + Math.cos(b.a) * b.r, b.y + Math.sin(t * 0.3 + b.ph) * 3, b.cz + Math.sin(b.a) * b.r);
        dummy.rotation.set(0, Math.atan2(-vx, -vz), 0);
        dummy.scale.set(b.s, b.s * Math.sin(t * 5 + b.ph) * 0.9, b.s);
        dummy.updateMatrix(); birds.mesh.setMatrixAt(i, dummy.matrix);
      }
      birds.mesh.instanceMatrix.needsUpdate = true;
      // target flags flutter
      for (let i = 0; i < flags.items.length; i++) {
        const f = flags.items[i];
        dummy.position.set(f.p[0], 0, f.p[2]); dummy.rotation.set(0, 0.5 + Math.sin(t * 0.4 + f.ph) * 0.35, 0);
        dummy.scale.set(1, 1, 1 + Math.sin(t * 3 + f.ph) * 0.12);
        dummy.updateMatrix(); flags.mesh.setMatrixAt(i, dummy.matrix);
      }
      if (flags.mesh) flags.mesh.instanceMatrix.needsUpdate = true;
      // evening mood: haze warms, lamp glow swells, fireflies appear after 0.75
      hazeCol.copy(hazeA).lerp(hazeB, timeOfDay01);
      haze.mat.opacity = 0.55 + 0.45 * timeOfDay01;
      haze.mat.color.copy(hazeCol);
      lamps.halo.opacity = 0.12 + 0.3 * timeOfDay01;
      const fa = Math.max(0, Math.min(1, (timeOfDay01 - 0.75) / 0.12));
      flies.mesh.visible = fa > 0;
      if (fa > 0) {
        flies.mat.opacity = fa * 0.9;
        for (let i = 0; i < flies.items.length; i++) {
          const f = flies.items[i], a = t * f.sp + f.ph;
          dummy.position.set(f.x + Math.sin(a) * 1.4, f.y + Math.sin(a * 1.7) * 0.5, f.z + Math.cos(a * 0.8) * 1.4);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(0.35 + 0.65 * Math.max(0, Math.sin(t * 2.2 + f.ph * 3)));
          dummy.updateMatrix(); flies.mesh.setMatrixAt(i, dummy.matrix);
        }
        flies.mesh.instanceMatrix.needsUpdate = true;
      }
      // trees: gentle sway, throttled to ~15 Hz
      sway.acc += dt;
      if (sway.acc >= 1 / 15) {
        sway.acc = 0;
        for (const o of sway.items) {
          const it = o.it;
          dummy.position.set(it.p[0], it.p[1], it.p[2]);
          dummy.rotation.set(Math.sin(t * 0.9 + o.ph) * 0.03, 0, Math.cos(t * 0.7 + o.ph * 1.3) * 0.03);
          dummy.scale.set(it.s[0], it.s[1], it.s[2]);
          dummy.updateMatrix();
          o.m.setMatrixAt(o.i, dummy.matrix);
        }
        for (const m of sway.meshes) m.instanceMatrix.needsUpdate = true;
      }
      // clubhouse flag ripple
      for (let i = 0; i < flagPos.count; i++) {
        const x = clubFlag.base[i * 3], y = clubFlag.base[i * 3 + 1];
        flagPos.setZ(i, Math.sin(x * 2.6 - t * 4.5 + y * 1.4) * 0.16 * (x / 2.2));
      }
      flagPos.needsUpdate = true;
      // windsock: slow drifting breeze
      sock.pivot.rotation.y = 0.9 + Math.sin(t * 0.13) * 0.5 + Math.sin(t * 0.41) * 0.1;
      sock.mesh.rotation.z = -(0.12 + 0.14 * (1 + Math.sin(t * 0.7)) * 0.5 + 0.05 * Math.sin(t * 2.3));
    },
  };
}
