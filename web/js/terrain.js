// Range Rat: Dimple Creek, the view half (council round 3, section 3). Draws MAP from map.js and nothing else:
// the creek ribbon (dry gravel at the Muni, animated water from the Club), the Plank, the Cart Bridge with
// rails, the Stones, Dimples Rock in its necktie, the Old Tractor, three 6 m flags on ground discs, the Grate,
// the drained pond's CLOSED dressing and its sign. Everything is merged or instanced: about a dozen draw calls.
//
//   const terrain = createTerrain({ scene });         // THREE is imported from 'three' like scenery.js does
//   terrain.setVenue(crew.venue);                     // dry gravel at 0, running water from 1
//   terrain.tick(dt, now / 1000);                     // once per frame (current, flag flutter)
//   terrain.landmarkLabels()                          // [{ id, name, x, y, z }] for CCTV labels and beacons
//
// No top-level side effects: everything is built inside createTerrain().
import * as THREE_NS from 'three';
import { SIGN_BY_ID, yawOf, tagSign } from './signs.js';
import { MAP, creekPoint, creekLength, inPondArea } from './map.js';
import { CREEK_DIVE } from './dive.js';

const TAU = Math.PI * 2;
const seeded = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export function createTerrain({ scene, THREE = THREE_NS } = {}) {
  const rnd = seeded(1962);
  const R = (a, b) => a + (b - a) * rnd();
  const { HW } = MAP.CREEK;
  const root = new THREE.Group();
  root.name = 'terrain';
  const dry = new THREE.Group(); dry.name = 'terrain-dry';     // the Muni: gravel, the mud flat, the sign
  const wet = new THREE.Group(); wet.name = 'terrain-wet';     // the Club and up: the water is on
  root.add(dry, wet);
  scene?.add(root);
  let venue = 0;

  const lambert = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
  const decal = f => ({ polygonOffset: true, polygonOffsetFactor: -f, polygonOffsetUnits: -f });
  const flatCircle = (r, seg = 24) => new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2);

  // ---- Bake: many primitives -> one vertex-coloured, flat-shaded mesh --------------------------------------
  class Bake {
    constructor() { this.pos = []; this.nor = []; this.col = []; this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.c = new THREE.Color(); }
    add(geo, hex, p, r, s, base) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      this.e.set(r?.[0] || 0, r?.[1] || 0, r?.[2] || 0); this.q.setFromEuler(this.e);
      this.v.set(p?.[0] || 0, p?.[1] || 0, p?.[2] || 0); this.s.set(s?.[0] ?? 1, s?.[1] ?? 1, s?.[2] ?? 1);
      this.m.compose(this.v, this.q, this.s);
      if (base) this.m.premultiply(base);
      g.applyMatrix4(this.m);
      this.c.set(hex);
      const P = g.attributes.position.array, N = g.attributes.normal.array;
      for (let i = 0; i < P.length; i++) { this.pos.push(P[i]); this.nor.push(N[i]); }
      for (let i = 0; i < P.length / 3; i++) this.col.push(this.c.r, this.c.g, this.c.b);
      g.dispose();
      return this;
    }
    box(w, h, d, hex, p, r, base) { return this.add(new THREE.BoxGeometry(w, h, d), hex, p, r, null, base); }
    cyl(rt, rb, h, seg, hex, p, r, base) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), hex, p, r, null, base); }
    build(extra) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...extra }));
      m.frustumCulled = false;
      return m;
    }
  }
  const frame = (x, z, yaw) => new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(1, 1, 1));

  // ---- the creek ribbon -------------------------------------------------------------------------------------
  // A strip along a branch's centreline, offset by hw each side. Tangents are averaged at the joints so it bends
  // without gaps; uv.v runs with distance (4 m a repeat) for the flowing-water texture.
  function ribbon(hw, y, colorFn) {
    const pos = [], uv = [], col = [], idx = [];
    for (const branch of ['in', 'out']) {
      const len = creekLength(branch), base = pos.length / 3;
      const ss = new Set([0, len]);
      for (let s = 2; s < len; s += 2) ss.add(+s.toFixed(3));
      const pts = branch === 'in' ? MAP.CREEK.IN : MAP.CREEK.OUT;
      let acc = 0;
      for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); ss.add(+acc.toFixed(3)); }   // exact joints
      const list = [...ss].sort((a, b) => a - b).filter((s, i, arr) => i === 0 || s - arr[i - 1] > 0.05);
      list.forEach((s, k) => {
        const p = creekPoint(branch, s), a = creekPoint(branch, s - 0.02), b = creekPoint(branch, s + 0.02);
        let tx = a.dx + b.dx, tz = a.dz + b.dz; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
        const nx = -tz, nz = tx, miter = 1 / Math.max(0.55, Math.abs(nx * -p.dz + nz * p.dx));
        const w = hw * Math.min(1.6, miter);
        pos.push(p.x + nx * w, y, p.z + nz * w, p.x - nx * w, y, p.z - nz * w);
        uv.push(0, s / 4, 1, s / 4);
        const c = colorFn(s, k, branch); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (k > 0) { const i0 = base + (k - 1) * 2; idx.push(i0, i0 + 2, i0 + 1, i0 + 1, i0 + 2, i0 + 3); }
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // winding: make sure the face normal points up
    if (g.attributes.normal.array[1] < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; } g.computeVertexNormals(); }
    return g;
  }
  const tint = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

  // banks: a dirt verge, wetter and darker once the water is on
  const bankMat = lambert(0x9c8e6c, { vertexColors: true, ...decal(2) });
  const bank = new THREE.Mesh(ribbon(HW + 1.1, 0.02, (s, k) => tint(0xffffff, 0.92 + 0.08 * ((k * 7) % 3) / 2)), bankMat);
  bank.name = 'creek-bank'; bank.frustumCulled = false;
  root.add(bank);

  // the dry bed: gravel, mottled along its length
  const gravel = new THREE.Mesh(ribbon(HW, 0.03, (s, k) => tint(0xaea288, 0.86 + 0.14 * (((k * 5) % 4) / 3))), lambert(0xffffff, { vertexColors: true, ...decal(3) }));
  gravel.name = 'creek-gravel'; gravel.frustumCulled = false;
  dry.add(gravel);
  // pebbles and a few bigger cobbles, merged
  {
    const b = new Bake(), geo = new THREE.IcosahedronGeometry(1, 0);
    const greys = [0x8d8678, 0x9b9484, 0x7c766a, 0xb0a894, 0x6f6a60];
    for (const branch of ['in', 'out']) {
      const len = creekLength(branch);
      for (let i = 0; i < 70; i++) {
        const s = R(0, len), p = creekPoint(branch, s), off = R(-1, 1) * (HW - 0.2);
        const x = p.x - p.dz * off, z = p.z + p.dx * off;
        if (inPondArea(x, z, 0.8)) continue;
        const r = R(0.07, 0.22);
        b.add(geo, greys[(rnd() * greys.length) | 0], [x, 0.04 + r * 0.25, z], [R(0, 3), R(0, TAU), R(0, 3)], [r, r * 0.55, r * R(0.8, 1.3)]);
      }
    }
    const m = b.build(); m.name = 'creek-pebbles'; dry.add(m);
  }

  // the running water: a streaky texture scrolled along the flow at the creek's own DRIFT speed
  let flowTex = null;
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#6fb6d4'; g.fillRect(0, 0, 64, 128);
    const r2 = seeded(77);
    for (let i = 0; i < 26; i++) {
      const x = r2() * 64, y = r2() * 128, h = 10 + r2() * 26;
      g.fillStyle = `rgba(255,255,255,${0.18 + r2() * 0.22})`;
      g.fillRect(x, y, 2 + r2() * 3, h);
      g.fillRect(x, y - 128, 2 + r2() * 3, h);   // wraps cleanly
    }
    flowTex = new THREE.CanvasTexture(c);
    flowTex.wrapS = flowTex.wrapT = THREE.RepeatWrapping;
    flowTex.colorSpace = THREE.SRGBColorSpace;
  }
  const waterMat = new THREE.MeshLambertMaterial({ color: 0xffffff, map: flowTex, transparent: true, opacity: 0.84, emissive: 0x0c2a38, ...decal(5) });
  if (!flowTex) waterMat.color.set(0x4f9fc0);
  const water = new THREE.Mesh(ribbon(HW, 0.05, () => new THREE.Color(1, 1, 1)), waterMat);
  water.name = 'creek-water'; water.frustumCulled = false;
  waterMat.side = THREE.DoubleSide;   // council round 10 #5: seen from below by a creek diver
  wet.add(water);
  // Council round 10 #5: the creek's trench, for divers. A bed strip at CREEK_DIVE.BED plus two walls from the grass
  // down to it, one geometry, ONE mesh (+1 draw call). From above the ground plane hides it; from below (back-face
  // culled) the walls, the bed and the DoubleSide water enclose the view. The bed takes the flow texture, scrolled.
  {
    const pos = [], uv = [], col = [], idx = [], BED = CREEK_DIVE.BED;
    const quad = (a, b, c, d, ca, cb) => {   // a-b along the top/near edge, c-d the far edge, s-ordered
      const i = pos.length / 3;
      for (const [p, u, cc] of [[a, 0, ca], [b, 0, ca], [c, 1, cb], [d, 1, cb]]) { pos.push(p[0], p[1], p[2]); uv.push(u, p[3] / 4); col.push(cc.r, cc.g, cc.b); }
      idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
    };
    const bedC = new THREE.Color(0x6a9a8c), wallTop = new THREE.Color(0x5a4a30), wallBot = new THREE.Color(0x40503f);
    for (const branch of ['in', 'out']) {
      const len = creekLength(branch); let prev = null;
      for (let s = 0; s <= len + 1e-6; s += Math.min(2, Math.max(0.05, len - s) || 2)) {
        const p = creekPoint(branch, s), w = HW - 0.02;
        const L = [p.x - p.dz * w, p.z + p.dx * w], Rr = [p.x + p.dz * w, p.z - p.dx * w];
        const cur = { L, R: Rr, s, pond: inPondArea(p.x, p.z) };
        if (prev && !cur.pond && !prev.pond) {
          quad([prev.L[0], BED, prev.L[1], prev.s], [cur.L[0], BED, cur.L[1], cur.s], [prev.R[0], BED, prev.R[1], prev.s], [cur.R[0], BED, cur.R[1], cur.s], bedC, bedC);
          for (const k of ['L', 'R']) quad([prev[k][0], 0.0, prev[k][1], prev.s], [cur[k][0], 0.0, cur[k][1], cur.s], [prev[k][0], BED, prev[k][1], prev.s], [cur[k][0], BED, cur[k][1], cur.s], wallTop, wallBot);
        }
        prev = cur;
        if (s >= len) break;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const trench = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, map: flowTex, side: THREE.DoubleSide }));
    trench.name = 'creek-trench'; trench.frustumCulled = false;
    wet.add(trench);
  }
  // foam where the inflow meets the pond: a pale ring on the Delta, the diver's pile
  {
    const ring = new THREE.Mesh(new THREE.RingGeometry(MAP.DELTA.r - 0.25, MAP.DELTA.r, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xeaf6fa, transparent: true, opacity: 0.4, depthWrite: false, ...decal(6) }));
    ring.position.set(MAP.DELTA.x, 0.07, MAP.DELTA.z); ring.name = 'delta-ring';
    wet.add(ring);
  }

  // ---- the drained pond (Muni): a mud flat behind CLOSED tape, and its sign ----------------------------------
  {
    const { x, z, r } = MAP.POND;
    const mud = new THREE.Mesh(flatCircle(r, 32), lambert(0x5b4630, decal(5))); mud.position.set(x, 0.05, z); dry.add(mud);
    const dark = new THREE.Mesh(flatCircle(r * 0.55, 20), lambert(0x4b3a26, decal(6))); dark.position.set(x - 0.6, 0.055, z + 0.4); dry.add(dark);
    const crack = new THREE.Mesh(new THREE.RingGeometry(r * 0.78, r * 0.84, 28).rotateX(-Math.PI / 2), lambert(0x6e5a3e, decal(6))); crack.position.set(x, 0.056, z); dry.add(crack);
    // tape: posts on a ring with a yellow band between them
    const b = new Bake(), n = 14, tr = r + 0.8;
    const chord = 2 * tr * Math.sin(Math.PI / n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, a2 = ((i + 0.5) / n) * TAU;
      b.cyl(0.05, 0.06, 1.1, 5, 0xd9d4c4, [x + Math.cos(a) * tr, 0.55, z + Math.sin(a) * tr]);
      b.box(chord, 0.1, 0.02, 0xf2c230, [x + Math.cos(a2) * tr * Math.cos(Math.PI / n), 0.95, z + Math.sin(a2) * tr * Math.cos(Math.PI / n)], [0, -a2 + Math.PI / 2, 0]);
      b.box(chord, 0.1, 0.02, 0xf2c230, [x + Math.cos(a2) * tr * Math.cos(Math.PI / n), 0.7, z + Math.sin(a2) * tr * Math.cos(Math.PI / n)], [0, -a2 + Math.PI / 2, 0]);
    }
    const tape = b.build(); tape.name = 'closed-tape'; dry.add(tape);
    // the FHI sign: "POND" over "CLOSED FOR SYNERGY", on two posts, facing the mats
    const [l1, l2] = MAP.SIGN.text.split(' · ');
    let tex = null;
    if (typeof document !== 'undefined') {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256;
      const g = c.getContext('2d');
      g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#c0392b'; g.fillRect(0, 0, 512, 20); g.fillRect(0, 236, 512, 20);
      g.fillStyle = '#2a2a2a'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = '900 96px system-ui, sans-serif'; g.fillText(l1, 256, 98);
      g.font = '800 42px system-ui, sans-serif'; g.fillText(l2, 256, 172);
      g.font = '600 18px system-ui, sans-serif'; g.fillStyle = '#777'; g.fillText('FHI GROUNDS  ·  THANK YOU FOR YOUR SYNERGY', 256, 216);
      tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    }
    const sign = new THREE.Group(); sign.name = 'pond-sign';
    sign.add(new THREE.Mesh(new THREE.PlaneGeometry(3.6, 1.8), new THREE.MeshLambertMaterial({ map: tex, color: tex ? 0xffffff : 0xf4efe2, side: THREE.DoubleSide })));
    sign.children[0].position.y = 2.1;
    tagSign(sign.children[0], 'pond'); sign.rotation.y = yawOf(SIGN_BY_ID.pond.normal);   // faces the mats (+z)
    const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), postMat = lambert(0x6b5a45);
    for (const px of [-1.5, 1.5]) { const p = new THREE.Mesh(postGeo, postMat); p.position.set(px, 1.3, -0.04); sign.add(p); }
    sign.position.set(MAP.SIGN.x, 0, MAP.SIGN.z);
    dry.add(sign);
  }

  // ---- bridges --------------------------------------------------------------------------------------------------
  // Local frame: X along the span (across the creek), Z across the deck (along the creek), +Y up.
  const deckHi = 0xa07a4c, deckLo = 0x8b6b45, beam = 0x5d4a35;
  const railsDry = new Bake(), railsWet = new Bake(), fixed = new Bake();
  for (const br of MAP.BRIDGES) {
    const f = frame(br.x, br.z, br.yaw);
    if (br.id === 'plank') {
      fixed.box(br.len, 0.1, br.w, deckLo, [0, 0.16, 0], null, f);
      fixed.box(br.len * 0.96, 0.03, br.w * 0.7, deckHi, [0, 0.225, 0], null, f);   // a worn strip down the middle
      for (const sx of [-1, 1]) fixed.box(0.5, 0.16, br.w + 0.2, beam, [sx * (br.len / 2 - 0.1), 0.08, 0], null, f);
      for (const sz of [-1, 1]) fixed.box(br.len, 0.08, 0.1, beam, [0, 0.1, sz * (br.w / 2 - 0.1)], null, f);   // stringers
    } else if (br.id === 'cart') {
      const boards = 12, bw = br.w / boards;
      for (let i = 0; i < boards; i++) fixed.box(br.len, 0.14, bw - 0.03, i % 2 ? deckLo : deckHi, [0, 0.2, -br.w / 2 + bw * (i + 0.5)], null, f);
      for (const sz of [-1, 0, 1]) fixed.box(br.len, 0.2, 0.22, beam, [0, 0.05, sz * (br.w / 2 - 0.2)], null, f);   // beams under the deck
      for (const sx of [-1, 1]) fixed.box(1.5, 0.1, br.w, deckLo, [sx * (br.len / 2 + 0.45), 0.1, 0], [0, 0, -sx * 0.2], f);   // ramps down to the bank
      // rails run the length of the span on both edges: weathered wood at the Muni, painted at the Club
      for (const sz of [-1, 1]) {
        const z = sz * (br.w / 2 - 0.12);
        for (let i = 0; i <= 4; i++) {
          const x = -br.len / 2 + 0.2 + i * (br.len - 0.4) / 4;
          railsDry.box(0.14, 0.95, 0.14, 0x6b5a45, [x, 0.66, z], null, f);
          railsWet.box(0.14, 0.95, 0.14, 0xf2efe6, [x, 0.66, z], null, f);
          railsWet.box(0.17, 0.08, 0.17, 0xd9382b, [x, 1.16, z], null, f);
        }
        railsDry.box(br.len, 0.1, 0.1, 0x7a6850, [0, 1.08, z], null, f); railsDry.box(br.len, 0.08, 0.08, 0x7a6850, [0, 0.72, z], null, f);
        railsWet.box(br.len, 0.1, 0.1, 0xf2efe6, [0, 1.08, z], null, f); railsWet.box(br.len, 0.08, 0.08, 0xd9382b, [0, 0.72, z], null, f);
      }
    } else {   // the Stones: seven flat stones, a stride apart, not quite in a line
      const n = 7, geo = new THREE.CylinderGeometry(1, 1.15, 1, 7);
      for (let i = 0; i < n; i++) {
        const x = -br.len / 2 + 0.45 + i * (br.len - 0.9) / (n - 1), r = R(0.38, 0.52), z = R(-0.25, 0.25);
        fixed.add(geo, [0x8a8a85, 0x9a9a92, 0x777771][i % 3], [x, 0.1, z], [0, R(0, TAU), 0], [r, 0.2, r], f);
      }
    }
  }
  const bridgeMesh = fixed.build(); bridgeMesh.name = 'bridges'; root.add(bridgeMesh);
  const rd = railsDry.build(); rd.name = 'rails-dry'; dry.add(rd);
  const rw = railsWet.build(); rw.name = 'rails-wet'; wet.add(rw);

  // ---- Dimples Rock, in its necktie; the Old Tractor ---------------------------------------------------------------
  const props = new Bake();
  {
    const o = MAP.ROCKS[0];
    const g = new THREE.IcosahedronGeometry(1, 1).toNonIndexed(), p = g.attributes.position;
    const h = (x, y, z) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return v - Math.floor(v); };
    for (let i = 0; i < p.count; i++) { const k = 1 + (h(p.getX(i), p.getY(i), p.getZ(i)) - 0.5) * 0.14; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
    g.computeVertexNormals();
    props.add(g, 0x8d8f8b, [o.x, o.h * 0.45, o.z], [0, 0.6, 0], [o.r, o.h * 0.55, o.r]);
    props.add(g, 0x9c9e99, [o.x - 0.7, o.h * 0.3, o.z - 0.6], [0, 1.9, 0], [o.r * 0.55, o.h * 0.4, o.r * 0.55]);   // a smaller lump, so it isn't an egg
    // the 1962 promotional necktie, facing the mats (+z)
    const tz = o.z + o.r * 0.9;
    props.box(0.34, 0.3, 0.2, 0xb3262b, [o.x, 1.62, tz - 0.05], [0.25, 0, 0]);          // knot
    props.box(0.46, 1.15, 0.12, 0xc4372c, [o.x, 0.95, tz + 0.04], [0.14, 0, 0]);         // blade
    props.box(0.46, 0.14, 0.13, 0xf2efe6, [o.x, 0.78, tz + 0.06], [0.14, 0, 0]);         // a stripe
    props.add(new THREE.ConeGeometry(0.23, 0.28, 3), 0xc4372c, [o.x, 0.3, tz + 0.11], [Math.PI + 0.14, 0, 0], [1, 1, 0.5]);   // the point
  }
  {
    const t = MAP.BOXES[0], X = t.x, Z = t.z;
    const green = 0x56784a, rust = 0x8a5a38, dark = 0x2b2b2b, glass = 0x7fa6b4;
    // faces +x (toward the field's middle); 3.2 x 1.8 footprint, 2 m to the roof
    props.box(2.5, 0.45, 0.8, rust, [X + 0.1, 0.8, Z]);
    props.box(1.2, 0.7, 0.85, green, [X + 0.95, 1.3, Z]);
    props.box(0.5, 0.5, 0.7, rust, [X + 1.35, 0.98, Z]);                                // grille
    props.box(1.05, 1.0, 1.0, green, [X - 0.7, 1.6, Z]);
    props.box(0.9, 0.55, 1.02, glass, [X - 0.7, 1.7, Z]);
    props.box(1.25, 0.08, 1.25, rust, [X - 0.7, 2.1, Z]);                               // roof, a hair over 2 m
    for (const sz of [-1, 1]) {
      props.cyl(0.82, 0.82, 0.32, 10, dark, [X - 0.85, 0.82, Z + sz * 0.72], [Math.PI / 2, 0, 0]);
      props.cyl(0.4, 0.4, 0.33, 8, 0x6a6a64, [X - 0.85, 0.82, Z + sz * 0.72], [Math.PI / 2, 0, 0]);   // hub
      props.cyl(0.45, 0.45, 0.24, 8, dark, [X + 1.1, 0.46, Z + sz * 0.7], [Math.PI / 2, 0, 0]);
    }
    props.cyl(0.05, 0.05, 0.75, 5, 0x44403a, [X + 1.0, 2.0, Z + 0.3]);                 // exhaust
    props.box(1.0, 0.04, 0.5, 0x5f7f50, [X - 0.7, 0.66, Z], null);                      // a sagging mudguard line, mostly
  }
  const propMesh = props.build(); propMesh.name = 'rock-and-tractor'; root.add(propMesh);

  // ---- the three flags: 6 m poles, pennants that flutter, discs on the grass -----------------------------------------
  const FLAG_COL = { red: 0xc4372c, yellow: 0xe6b422, blue: 0x2f6fc4 };
  const flagMeshes = [];
  {
    const b = new Bake(), disc = [];
    for (const f of MAP.FLAGS) {
      b.cyl(0.035, 0.05, 6, 6, 0xf2efe6, [f.x, 3, f.z]);
      b.add(new THREE.SphereGeometry(0.09, 6, 4), 0xe6b422, [f.x, 6.05, f.z]);
      const c = FLAG_COL[f.id];
      for (const [r, k, y] of [[3.4, 0.7, 0.022], [2.8, 1, 0.026], [1.2, 1.25, 0.03]]) {
        const d = new THREE.Mesh(flatCircle(r, 28), lambert(new THREE.Color(c).multiplyScalar(k), decal(4 + y * 100)));
        d.position.set(f.x, y, f.z); d.name = `flag-disc-${f.id}`; disc.push(d); root.add(d);
      }
      const tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([0, 5.95, 0, 0, 5.0, 0, 1.9, 5.5, 0], 3));
      tri.computeVertexNormals();
      const pen = new THREE.Mesh(tri, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide, emissive: new THREE.Color(c).multiplyScalar(0.25) }));
      pen.position.set(f.x + 0.035, 0, f.z); pen.userData.ph = R(0, TAU); pen.name = `flag-${f.id}`;
      root.add(pen); flagMeshes.push(pen);
    }
    const m = b.build(); m.name = 'flag-poles'; root.add(m); flagMeshes.poles = m;
  }
  // Council round 10 #6: Tiered's pin stands at the green's centre, so the landmark flag hides (the discs stay).
  const setFlags = on => { for (const p of flagMeshes) p.visible = !!on; if (flagMeshes.poles) flagMeshes.poles.visible = !!on; };

  // ---- the Grate: a headwall and bars across the outflow's end, on a concrete apron (the cart's pile) -------------------
  {
    const G = MAP.GRATE, b = new Bake(), hw = HW + 0.4;
    const apron = new THREE.Mesh(flatCircle(G.r + 0.4, 20), lambert(0x8d8a82, decal(5)));
    apron.position.set(G.x - 0.4, 0.034, G.z); apron.name = 'grate-apron'; root.add(apron);
    b.box(0.7, 1.5, hw * 2 + 1.4, 0x7c7a74, [64.0, 0.75, G.z]);                     // the headwall, in front of the net
    for (let i = 0; i < 9; i++) b.cyl(0.04, 0.04, 1.1, 5, 0x3a3f44, [63.5, 0.55, G.z - hw + 0.1 + i * (hw * 2 - 0.2) / 8]);
    b.box(0.1, 0.1, hw * 2, 0x3a3f44, [63.5, 1.1, G.z]); b.box(0.1, 0.08, hw * 2, 0x3a3f44, [63.5, 0.3, G.z]);
    for (const sz of [-1, 1]) b.box(0.9, 1.2, 0.5, 0x7c7a74, [63.9, 0.6, G.z + sz * (hw + 0.7)]);
    const m = b.build(); m.name = 'grate'; root.add(m);
  }

  // ---- venue switch, per-frame, labels ---------------------------------------------------------------------------------
  function setVenue(v) {
    venue = v | 0;
    const isWet = venue >= 1;
    dry.visible = !isWet; wet.visible = isWet;
    bankMat.color.set(isWet ? 0x6e5f40 : 0x9c8e6c);
  }
  function tick(dt, t = 0) {
    if (flowTex && wet.visible) flowTex.offset.y -= dt * MAP.CREEK.DRIFT / 4;   // 4 m per texture repeat, at the real current
    for (const p of flagMeshes) p.rotation.y = 0.28 * Math.sin(t * 2.2 + p.userData.ph) + 0.12 * Math.sin(t * 5.1 + p.userData.ph * 2);
  }
  function landmarkLabels() {
    return MAP.LANDMARKS.filter(l => (l.minVenue ?? 0) <= venue).map(l => ({ id: l.id, name: l.name, x: l.x, y: l.y, z: l.z }));
  }
  setVenue(0);

  return { setVenue, tick, landmarkLabels, setFlags, root, meshes: [root], get venue() { return venue; }, groups: { dry, wet } };
}
