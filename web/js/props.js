// Range Rat props: small physical details and in-use animations on the stations, plus a cheap
// graphics pass (ground texture, worn paths, contact shadows, soft clouds, light balance).
// It decorates groups other modules already built; it never rebuilds them. Everything it
// adds scales with the perf.js profile through detailFor() (detail.js, unit-tested).
//
//   const props = createProps({ scene, camera, renderer, perf, sky, me, cartViews, fpGear, myGear,
//                               crew: () => crew, sprayOn: () => bool, ballCount: () => n });
//   props.tick(dt, t)   // once a frame, after sky.setTime and the cart loop, before render
//
// Finds what it decorates by position or shape (the stand, wash station, snack shed, ball
// washer, dispenser, ground, stripes, clouds, MOW-E), so the builders stay untouched. Anything
// it can't find is skipped. Station props attach to the station's own group, in its local
// frame, so a later rotation of a group carries them along.
import * as THREE from 'three';
import { SIM, WASH, FRIES, MATS, BAYS, BANK } from './sim.js';
import { BASKET } from './layout.js';
import { MAP } from './map.js';
import { WASHER_POS } from './washer.js';
import { detailFor, emit, wetStep, sagPoints, rollAngle, gaugeAngle, ease, throttle, rng, lightBalance } from './detail.js';
import { createStations, findStations, REVEAL } from './stations.js';   // owner notes: the washer and shed appear when they matter
import { sharedConfetti, confettiCount } from './confetti.js';
import { MUD, mudField, paintClean, matAt, matUV, cameClean } from './mud.js';

const TAU = Math.PI * 2;

export function createProps({ scene, camera, renderer, perf, sky, me, cartViews = [], fpGear, myGear, others = null,
  crew = () => ({}), sprayOn = () => false, ballCount = () => 0 } = {}) {
  if (/[?&]debug/.test(globalThis.location?.search ?? '')) globalThis.__props = { renderer, scene, camera, perf };   // ?debug: for timing renders
  if (/[?&]noprops/.test(globalThis.location?.search ?? '')) {   // ?noprops: A/B the cost (the stations still hide until they matter)
    const bare = createStations({ scene, ...findStations(scene) });
    return { tick() { bare.update(crew()); }, detail: null };
  }
  const D = detailFor(perf?.profile);
  const rand = rng(91731);
  const R = (a, b) => a + (b - a) * rand();

  // ---------------------------------------------------------------- materials
  const matCache = new Map();
  // A prop material: MeshStandard (roughness/metalness, a sky reflection) for metal on High; Lambert for
  // paint, rubber and wood, and for everything on Low (Standard costs more per pixel). Shared by key.
  function M(color, rough = 0.8, metal = 0, extra = {}) {
    const key = `${color}|${rough}|${metal}|${JSON.stringify(Object.keys(extra))}`;
    if (!Object.keys(extra).length && matCache.has(key)) return matCache.get(key);
    const m = D.standard && metal >= 0.3 ? new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, envMap, envMapIntensity: 0.7, ...extra })
      : new THREE.MeshLambertMaterial({ color, ...extra });
    if (!Object.keys(extra).length) matCache.set(key, m);
    return m;
  }
  const shiny = (color, opacity) => D.wetSheen
    ? new THREE.MeshPhongMaterial({ color, specular: 0x8899aa, shininess: 120, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
    : new THREE.MeshLambertMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

  // A tiny generated environment so metal props reflect a sky instead of going black (High only).
  let envMap = null;
  if (D.standard && renderer) {
    const es = new THREE.Scene();
    const sg = new THREE.SphereGeometry(10, 16, 8), col = [];
    for (let i = 0; i < sg.attributes.position.count; i++) { const y = sg.attributes.position.getY(i) / 10; const c = y > 0.05 ? new THREE.Color(0x9fb8e0).lerp(new THREE.Color(0xffe2b8), 1 - y) : new THREE.Color(0x4f6a35); col.push(c.r, c.g, c.b); }
    sg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    es.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const pm = new THREE.PMREMGenerator(renderer); envMap = pm.fromScene(es, 0, 0.1, 100).texture; pm.dispose(); sg.dispose();
  }
  const steel = M(0x9aa3ad, 0.35, 0.6), darkSteel = M(0x3a3d42, 0.5, 0.5), rubber = M(0x1c1c1f, 0.95, 0);
  const brass = M(0xc9a24a, 0.35, 0.7), yellow = M(0xf2c94c, 0.55, 0.05), red = M(0xd9382b, 0.5, 0.05);
  const blue = M(0x2f6fbf, 0.45, 0.15), engineGrey = M(0x55595f, 0.6, 0.35), hoseGreen = M(0x2f5d3a, 0.7, 0);
  const wood = M(0x8b6b45, 0.9, 0), boltMat = M(0xb8bec6, 0.3, 0.8);

  // ---------------------------------------------------------------- canvas textures (made once, all small)
  function canvasTex(w, h, draw, { srgb = true, repeat = null } = {}) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.anisotropy = D.hi ? 4 : 1;
    return t;
  }
  const softDot = canvasTex(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  }, { srgb: false });
  const bubbleTex = canvasTex(64, 64, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, w * 0.28, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,0.08)'); r.addColorStop(0.8, 'rgba(235,245,255,0.8)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(w * 0.36, w * 0.34, w * 0.08, 0, TAU); g.fill();
  }, { srgb: false });
  const blotchTex = (seed, n, col) => canvasTex(128, 128, (g, w) => {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = w / 2 + (r() - 0.5) * w * 0.55, y = w / 2 + (r() - 0.5) * w * 0.55, rad = w * (0.08 + r() * 0.2);
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, `rgba(${col},${0.35 + r() * 0.3})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, w, w);
    }
  }, { srgb: false });
  const dirtTex = blotchTex(7, 26, '255,255,255');

  // ---------------------------------------------------------------- tiny geometry helpers
  // Merge already-placed geometries (each may carry a matrix) into one non-indexed BufferGeometry.
  function merge(list) {
    const pos = [], nor = [], uv = [];
    for (const [geo, m] of list) {
      const g = (geo.index ? geo.toNonIndexed() : geo.clone());
      if (m) g.applyMatrix4(m);
      pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
      if (g.attributes.uv) uv.push(...g.attributes.uv.array); else for (let i = 0; i < g.attributes.position.count; i++) uv.push(0, 0);
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return out;
  }
  const mtx = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
    new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
  function add(parent, geo, mat, x = 0, y = 0, z = 0, { rx = 0, ry = 0, rz = 0, shadow = false, name } = {}) {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
    o.castShadow = shadow && D.hi; if (name) o.name = name;
    parent.add(o); return o;
  }
  // A text/decal plane facing +z (rotate the parent or pass ry to turn it).
  function decal(parent, w, h, tex, x, y, z, { ry = 0, basic = false, alpha = false, glow = false } = {}) {
    const mat = basic || glow ? new THREE.MeshBasicMaterial({ map: tex, transparent: alpha, toneMapped: false })
      : new THREE.MeshLambertMaterial({ map: tex, transparent: alpha, polygonOffset: true, polygonOffsetFactor: -1 });
    if (alpha) mat.depthWrite = false;
    return add(parent, new THREE.PlaneGeometry(w, h), mat, x, y, z, { ry });
  }
  // Hex bolts as one InstancedMesh: [[x, y, z, rx, ry, rz], ...] in the parent's frame (axis along local y).
  const boltGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.012, 6);
  function bolts(parent, list) {
    const im = new THREE.InstancedMesh(boltGeo, boltMat, list.length);
    list.forEach((b, i) => im.setMatrixAt(i, mtx(b[0], b[1], b[2], b[3] || 0, b[4] || 0, b[5] || 0)));
    parent.add(im); return im;
  }
  // Bake a prop group's static meshes into one mesh per material (draw calls stay flat).
  // Anything in `keep` (and its subtree) stays live: it animates, toggles or recolours.
  function bake(root, keep = []) {
    const skip = new Set(keep.filter(Boolean)), byMat = new Map();
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const walk = o => {
      if (skip.has(o)) return;
      for (const c of [...o.children]) walk(c);
      if (o === root || !o.isMesh || o.isInstancedMesh || o.children.length) return;
      const k = o.material.uuid;
      if (!byMat.has(k)) byMat.set(k, { mat: o.material, list: [], shadow: false });
      const e = byMat.get(k);
      e.list.push([o.geometry, new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)]); e.shadow ||= o.castShadow;
      o.parent.remove(o);
    };
    walk(root);
    for (const { mat, list, shadow } of byMat.values()) {
      const m = new THREE.Mesh(list.length === 1 && !list[0][0].index ? list[0][0].clone().applyMatrix4(list[0][1]) : merge(list), mat);
      m.castShadow = shadow; root.add(m);
    }
    // empty groups left behind are harmless; drop them anyway
    const empty = []; root.traverse(o => { if (o.isGroup && o !== root && !o.children.length && !skip.has(o)) empty.push(o); });
    for (const o of empty) o.removeFromParent();
  }

  // ---------------------------------------------------------------- billboard puffs (mist, steam, bubbles, drips, clippings)
  // One InstancedMesh of camera-facing quads per kind; a puff fades by shrinking (soft textures).
  const _m4 = new THREE.Matrix4(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
  function puffs(cap, { map = softDot, color = 0xffffff, opacity = 0.8, blending = THREE.NormalBlending } = {}) {
    const n = Math.max(1, cap);
    const mat = new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending, fog: true });
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, n);
    im.frustumCulled = false; im.count = 0; im.visible = false; im.renderOrder = 3;
    scene.add(im);
    const P = Array.from({ length: n }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s0: 0.1, s1: 0.3, g: 0, drag: 0 }));
    let next = 0;
    return {
      mesh: im, cap: cap | 0,
      spawn(x, y, z, vx, vy, vz, life, s0, s1, g = 0, drag = 0) {
        if (!cap) return;
        const p = P[next = (next + 1) % n];
        Object.assign(p, { life, max: life, x, y, z, vx, vy, vz, s0, s1, g, drag });
      },
      update(dt) {
        let c = 0;
        for (const p of P) {
          if (p.life <= 0) continue;
          p.life -= dt; if (p.life <= 0) continue;
          const k = 1 - p.life / p.max;
          if (p.drag) { const f = Math.exp(-p.drag * dt); p.vx *= f; p.vy *= f; p.vz *= f; }
          p.vy -= p.g * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          if (p.y < 0.02) { p.y = 0.02; p.vy = 0; p.vx *= 0.5; p.vz *= 0.5; }
          const s = (p.s0 + (p.s1 - p.s0) * k) * Math.min(1, (1 - k) * 4);
          _m4.compose(_v.set(p.x, p.y, p.z), camera.quaternion, _s.set(s, s, s));
          im.setMatrixAt(c++, _m4);
        }
        im.count = c; im.visible = c > 0;
        if (c) im.instanceMatrix.needsUpdate = true;
      },
    };
  }

  const found = { stand: null, wash: null, shed: null, washer: null };
  for (const o of scene.children) {
    if (!o.isGroup) continue;
    const at = (x, z) => Math.abs(o.position.x - x) < 0.01 && Math.abs(o.position.z - z) < 0.01;
    if (at(SIM.STAND.x, SIM.STAND.z) && o.children.length <= 3) found.stand = o;
    else if (at(WASH.STATION.x, WASH.STATION.z) && o.children.length <= 4) found.wash = o;
    else if (at(FRIES.SHED.x, FRIES.SHED.z + 2.25)) found.shed = o;
    else if (at(WASHER_POS.x, WASHER_POS.z) && o.children.length > 8) found.washer = o;
  }

  // ---------------------------------------------------------------- contact shadows and worn ground
  // Soft dark blobs under everything that stands on the grass, and worn dirt where feet go.
  const marks = { blob: null, dirt: null, of: { washer: { blob: [], dirt: [] }, shed: { blob: [], dirt: [] } }, saved: new Map() };   // the stations' own, hidden with them
  {
    const blobs = [
      [SIM.STAND.x, SIM.STAND.z, 2.8, 2.0], [WASHER_POS.x, WASHER_POS.z, 1.4, 1.4], [WASH.STATION.x, WASH.STATION.z, 1.6, 1.3],
      [FRIES.SHED.x, FRIES.SHED.z + 2.25, 4.0, 3.4], [23.5, 8.5, 1.4, 1.2], [18, 8.7, 2.2, 0.9], [-14, 8.7, 2.2, 0.9], [48, 6.5, 2.2, 0.9],
      [20.5, 8.8, 0.9, 0.9], [-9, 8.7, 0.9, 0.9], [45.5, 6.5, 0.9, 0.9], [-16.5, 8.7, 0.9, 0.9], [BANK.x, BANK.z + 1.2, 1.4, 1.4], [BASKET.x, BASKET.z, 0.9, 0.9],
    ];
    const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: softDot, color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), blobs.length);
    blobs.forEach(([x, z, sx, sz], i) => im.setMatrixAt(i, mtx(x, 0.014, z, 0, 0, 0, sx, 1, sz)));
    im.frustumCulled = false; im.renderOrder = 1; scene.add(im);
    marks.blob = im; marks.of.washer.blob.push(1); marks.of.shed.blob.push(3);

    const dirt = [];
    for (const m of MATS) dirt.push([m.x, 1.25, 1.5, 1.0, R(0, 3)]);
    for (let x = -20; x <= 20; x += 2.6) dirt.push([x + R(-0.6, 0.6), 2.4 + R(-0.4, 0.4), R(2.2, 3.2), R(0.9, 1.4), R(-0.3, 0.3)]);   // the walkway behind the mats
    dirt.push([SIM.STAND.x, SIM.STAND.z - 1.0, 3.4, 1.8, 0], [SIM.STAND.x - 2.6, SIM.STAND.z - 0.6, 2.4, 1.3, 0.4], [BASKET.x, BASKET.z - 0.7, 1.8, 1.2, 0]);   // the return's apron; the customers' spot at the basket
    marks.of.washer.dirt.push(dirt.length, dirt.length + 1);
    dirt.push([WASHER_POS.x - 1.4, WASHER_POS.z, 1.1, 1.1, 0], [WASHER_POS.x + 1.4, WASHER_POS.z, 1.1, 1.1, 0]);   // where the crankers stand
    marks.of.shed.dirt.push(dirt.length + 3);
    dirt.push([31, 10, 3.4, 4.6, 0.2], [33.5, 6.8, 2.6, 3.4, 0.6], [36.8, 4.4, 2.2, 1.8, 0], [FRIES.SHED.x, FRIES.SHED.z - 0.1, 3.2, 1.6, 0]);   // the yard: cart park, wash pad, the counter
    for (const b of BAYS) dirt.push([b.x, b.z + 1.3, 1.6, 1.0, 0]);
    const dm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: dirtTex, color: 0x7a5a36, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), dirt.length);
    dirt.forEach(([x, z, sx, sz, ry], i) => { dm.setMatrixAt(i, mtx(x, 0.012, z, 0, ry, 0, sx, 1, sz)); dm.setColorAt(i, new THREE.Color().setHSL(0.08 + R(-0.01, 0.01), R(0.3, 0.42), R(0.3, 0.42))); });
    dm.frustumCulled = false; dm.renderOrder = 1; scene.add(dm);
    marks.dirt = dm;
  }
  // A station's contact shadow and worn dirt go with it (a zero-scale instance; the matrix is kept to put back).
  const _zero = new THREE.Matrix4().makeScale(0, 0, 0), _keep = new THREE.Matrix4();
  function stationMarks(name, on) {
    for (const [im, list] of [[marks.blob, marks.of[name].blob], [marks.dirt, marks.of[name].dirt]]) {
      if (!im) continue;
      for (const i of list) {
        const key = im.uuid + ':' + i;
        if (!marks.saved.has(key)) { im.getMatrixAt(i, _keep); marks.saved.set(key, _keep.clone()); }
        im.setMatrixAt(i, on ? marks.saved.get(key) : _zero);
      }
      im.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- ground: grass texture, yard mowing, variation, green rings
  {
    const grass = canvasTex(128, 128, (g, w) => {
      const r = rng(3);
      g.fillStyle = 'rgb(240,244,236)'; g.fillRect(0, 0, w, w);
      for (let i = 0; i < 2200; i++) {
        const v = 212 + (r() * 43) | 0, x = r() * w, y = r() * w, d = r() < 0.3 ? 2 : 1;
        g.fillStyle = `rgb(${v - 6},${v},${v - 12})`; g.fillRect(x, y, d, d);
      }
      for (let i = 0; i < 160; i++) { g.fillStyle = 'rgba(255,255,230,0.5)'; g.fillRect(r() * w, r() * w, 1, 2); }
    }, { srgb: true });
    grass.wrapS = grass.wrapT = THREE.RepeatWrapping;
    let ground = null; const stripes = [];
    for (const o of scene.children) {
      const p = o.isMesh && o.geometry?.type === 'PlaneGeometry' ? o.geometry.parameters : null;
      if (!p) continue;
      if (p.width === 700 && p.height === 700) ground = o;
      else if (p.width === 128 && p.height === 12) stripes.push(o);
    }
    if (ground) { const t = grass.clone(); t.repeat.set(220, 220); t.needsUpdate = true; ground.material.map = t; ground.material.color.multiplyScalar(1.07); ground.material.needsUpdate = true; }
    if (stripes.length) { const t = grass.clone(); t.repeat.set(40, 4); t.needsUpdate = true; for (const s of stripes) { s.material.map = t; s.material.color.multiplyScalar(1.07); s.material.needsUpdate = true; } }

    // Yard mowing (the area the crew walks: behind and between the mats) + broad tonal variation.
    const yard = canvasTex(256, 64, (g, w, h) => {
      const r = rng(11);
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,220,0.10)' : 'rgba(0,20,0,0.10)'; g.fillRect(i * w / 16, 0, w / 16, h); }
      for (let i = 0; i < 40; i++) {
        const x = r() * w, y = r() * h, rad = 6 + r() * 18, gr = g.createRadialGradient(x, y, 0, x, y, rad);
        const dark = r() < 0.55; gr.addColorStop(0, dark ? 'rgba(20,40,0,0.16)' : 'rgba(255,240,160,0.13)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
    }, { srgb: false });
    const ym = new THREE.Mesh(new THREE.PlaneGeometry(128, 18).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: yard, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    ym.position.set(0, 0.008, 1); ym.renderOrder = 0; scene.add(ym);
    const field = canvasTex(128, 128, (g, w) => {
      const r = rng(17);
      for (let i = 0; i < 70; i++) {
        const x = r() * w, y = r() * w, rad = 8 + r() * 22, gr = g.createRadialGradient(x, y, 0, x, y, rad);
        const dark = r() < 0.5; gr.addColorStop(0, dark ? 'rgba(10,30,0,0.13)' : 'rgba(255,245,170,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, w);
      }
    }, { srgb: false });
    const fm = new THREE.Mesh(new THREE.PlaneGeometry(128, 200).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: field, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    fm.position.set(0, 0.009, -108); scene.add(fm);

    // Target greens: a white collar ring and a dashed yardage ring, flat on the grass.
    if (D.rings) {
      const ringTex = canvasTex(128, 8, (g, w, h) => { g.fillStyle = '#fff'; for (let i = 0; i < 24; i++) g.fillRect(i * w / 24, 0, w / 48, h); }, { srgb: false, repeat: [1, 1] });
      const rad = [6, 7, 7], solid = [], dash = [];
      MAP.FLAGS.forEach((f, i) => {
        const r = rad[i] ?? 6;
        solid.push([new THREE.RingGeometry(r * 1.22, r * 1.22 + 0.18, 48).rotateX(-Math.PI / 2), mtx(f.x, 0.022, f.z)]);
        dash.push([new THREE.RingGeometry(r * 1.9, r * 1.9 + 0.22, 64, 1).rotateX(-Math.PI / 2), mtx(f.x, 0.022, f.z)]);
      });
      const ringMat = extra => new THREE.MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5, ...extra });
      scene.add(new THREE.Mesh(merge(solid), ringMat({ opacity: 0.55 })), new THREE.Mesh(merge(dash), ringMat({ opacity: 0.45, alphaMap: ringTex })));
    }
  }

  // ---------------------------------------------------------------- clouds: soft billboard puffs
  const clouds = { items: [], mesh: null, acc: 0 };
  {
    let old = null;
    scene.getObjectByName('scenery')?.traverse(o => { if (o.isInstancedMesh && o.material?.emissive?.getHex?.() === 0x3a2418) old = o; });
    const tex = canvasTex(128, 96, (g, w, h) => {
      const r = rng(5);
      for (let i = 0; i < 14; i++) {
        const x = w * (0.22 + r() * 0.56), y = h * (0.38 + r() * 0.3), rad = w * (0.12 + r() * 0.14);
        const gr = g.createRadialGradient(x, y - rad * 0.2, 0, x, y, rad);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(250,246,242,0.55)'); gr.addColorStop(1, 'rgba(240,232,228,0)');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
      const shade = g.createLinearGradient(0, h * 0.35, 0, h); shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(120,100,120,0.35)');
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = shade; g.fillRect(0, 0, w, h);
    }, { srgb: true });
    if (old) {
      old.visible = false;
      const tints = [0xfff1e4, 0xffe6d2, 0xfff6ee, 0xffdcc4];
      const n = D.clouds;
      for (let i = 0; i < n; i++) {
        const w = R(60, 120), x = R(-650, 650), y = R(150, 280), z = R(-560, -140), v = R(1.2, 3.2);
        for (let j = 0; j < 3; j++) clouds.items.push({ x: x + (j - 1) * w * 0.35, y: y + R(-6, 10), z: z + R(-10, 10), w: w * R(0.6, 0.9), h: w * R(0.38, 0.5), v, c: tints[(i + j) % 4] });
      }
      clouds.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.92 }), clouds.items.length);
      clouds.items.forEach((c, i) => clouds.mesh.setColorAt(i, new THREE.Color(c.c)));
      clouds.mesh.frustumCulled = false; clouds.mesh.renderOrder = -1;
      scene.add(clouds.mesh);
    }
  }

  // ---------------------------------------------------------------- wet sheen
  // A glossy dark skin over things the spray hits; it shows while wet and dries off.
  const wettable = [];
  const wetMat = () => shiny(0x1b2a38, 0);
  function makeWettable(mesh, grow = 1.01) {
    if (!D.wetSheen || !mesh?.geometry) return null;
    const skin = new THREE.Mesh(mesh.geometry, wetMat());
    skin.scale.setScalar(grow); skin.visible = false; skin.renderOrder = 2;
    mesh.add(skin);
    const w = { mesh, skin, wet: 0, hit: false };
    wettable.push(w); return w;
  }
  // Wet spots on the ground and pads: flat shiny decals that shrink as they dry.
  const spots = { n: D.wetSheen ? 18 : 6, items: [], mesh: null, next: 0 };
  {
    const mat = D.wetSheen ? new THREE.MeshPhongMaterial({ map: softDot, color: 0x203040, specular: 0xffffff, shininess: 80, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })
      : new THREE.MeshBasicMaterial({ map: softDot, color: 0x203040, transparent: true, opacity: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    spots.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), mat, spots.n);
    spots.mesh.frustumCulled = false; spots.mesh.count = 0; spots.mesh.renderOrder = 2; scene.add(spots.mesh);
    for (let i = 0; i < spots.n; i++) spots.items.push({ life: 0, x: 0, y: 0, z: 0, s: 1 });
  }
  const wetSpot = (x, y, z, s) => { const p = spots.items[spots.next = (spots.next + 1) % spots.n]; Object.assign(p, { life: 5, x, y, z, s }); };

  // ---------------------------------------------------------------- particles
  const mist = puffs(D.mist, { color: 0xe8f6ff, opacity: 0.5 });
  const drips = puffs(D.hi ? 24 : 8, { color: 0xbfe3ff, opacity: 0.9 });
  const steam = puffs(D.steam, { color: 0xf4f1ee, opacity: 0.45 });
  const bubbles = puffs(D.bubbles, { map: bubbleTex, opacity: 0.95 });
  const clips = puffs(D.clippings, { map: null, color: 0x5f9a36, opacity: 1 });

  // ---------------------------------------------------------------- the pressure washer station (36, 3)
  const pw = { gauge: null, needle: null, holster: null, reel: null, pressure: 0, outlet: new THREE.Vector3(), reelAng: 0, lastLen: 0 };
  if (found.wash) {
    const st = found.wash;
    for (const c of st.children) {
      const p = c.geometry?.parameters;
      if (p && ((p.width === 0.9 && p.height === 0.8) || c.geometry.type === 'TorusGeometry')) c.visible = false;   // the old box and ring
      if (p && p.width === 5 && p.depth === 4) { const w = makeWettable(c, 1.0); if (w) w.skin.position.y = 0.002; }
    }
    const u = new THREE.Group(); u.name = 'pressureWasher'; st.add(u);
    // Frame: base rails, uprights at the back, a handle with grips.
    const frame = merge([
      [new THREE.CylinderGeometry(0.022, 0.022, 0.78, 8), mtx(-0.32, 0.12, 0, Math.PI / 2)],
      [new THREE.CylinderGeometry(0.022, 0.022, 0.78, 8), mtx(0.32, 0.12, 0, Math.PI / 2)],
      [new THREE.CylinderGeometry(0.022, 0.022, 0.9, 8), mtx(-0.32, 0.55, -0.38, -0.12)],
      [new THREE.CylinderGeometry(0.022, 0.022, 0.9, 8), mtx(0.32, 0.55, -0.38, -0.12)],
      [new THREE.CylinderGeometry(0.022, 0.022, 0.66, 8), mtx(0, 0.99, -0.43, 0, 0, Math.PI / 2)],
      [new THREE.CylinderGeometry(0.022, 0.022, 0.66, 8), mtx(0, 0.12, 0.38, 0, 0, Math.PI / 2)],
    ]);
    add(u, frame, darkSteel, 0, 0, 0, { shadow: true });
    for (const x of [-0.2, 0.2]) add(u, new THREE.CylinderGeometry(0.03, 0.03, 0.14, 10), rubber, x, 0.99, -0.43, { rz: Math.PI / 2 });
    // Wheels with yellow hubs, a rubber foot at the front.
    for (const x of [-0.4, 0.4]) {
      add(u, new THREE.CylinderGeometry(0.17, 0.17, 0.08, 16), rubber, x, 0.17, -0.3, { rz: Math.PI / 2, shadow: true });
      add(u, new THREE.CylinderGeometry(0.07, 0.07, 0.085, 10), yellow, x, 0.17, -0.3, { rz: Math.PI / 2 });
    }
    add(u, new THREE.BoxGeometry(0.5, 0.06, 0.08), rubber, 0, 0.04, 0.38);
    // Deck plate, the blue shroud, the engine with fins, the red tank, muffler, recoil start.
    add(u, new THREE.BoxGeometry(0.66, 0.035, 0.74), darkSteel, 0, 0.255, 0);
    const shroud = add(u, new THREE.BoxGeometry(0.62, 0.22, 0.6), blue, 0, 0.38, 0.02, { shadow: true });
    add(u, new THREE.BoxGeometry(0.4, 0.3, 0.36), engineGrey, -0.04, 0.63, -0.04, { shadow: true });
    const fins = []; for (let i = 0; i < 6; i++) fins.push([new THREE.BoxGeometry(0.42, 0.012, 0.3), mtx(-0.04, 0.69 + i * 0.022, -0.04)]);
    add(u, merge(fins), darkSteel, 0, 0, 0);
    add(u, new THREE.CylinderGeometry(0.11, 0.11, 0.34, 14), red, -0.04, 0.88, -0.06, { rz: Math.PI / 2, shadow: true });
    add(u, new THREE.CylinderGeometry(0.035, 0.035, 0.04, 10), rubber, -0.12, 0.99, -0.06);
    add(u, new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), steel, 0.24, 0.62, -0.12, { rx: Math.PI / 2 });
    add(u, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 14), red, -0.27, 0.62, -0.04, { rz: Math.PI / 2 });
    add(u, new THREE.SphereGeometry(0.018, 8, 6), rubber, -0.31, 0.62, -0.04);
    // The pump: a brass head on the front with an outlet, and the pressure gauge looking up at you.
    add(u, new THREE.CylinderGeometry(0.07, 0.08, 0.18, 12), brass, 0.18, 0.4, 0.38, { rx: Math.PI / 2 });
    add(u, new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), brass, 0.18, 0.4, 0.5, { rx: Math.PI / 2 });
    const gTex = canvasTex(128, 128, (g, w) => {
      g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = 3;
      for (let i = 0; i <= 10; i++) { const a = -2.2 - Math.PI / 2 + (i / 10) * 3.4 + Math.PI; const c = Math.cos(a), s = Math.sin(a); g.beginPath(); g.moveTo(64 + c * 44, 64 + s * 44); g.lineTo(64 + c * 54, 64 + s * 54); g.stroke(); }
      g.strokeStyle = '#d9382b'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 50, -Math.PI / 2 + 0.95, -Math.PI / 2 + 1.75); g.stroke();
      g.fillStyle = '#222'; g.font = 'bold 15px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('PSI', 64, 92); g.font = '9px system-ui, sans-serif'; g.fillText('FAIRWAY HOLDINGS', 64, 104);
    });
    const gauge = new THREE.Group(); gauge.position.set(0.18, 0.56, 0.36); gauge.rotation.x = -0.6; u.add(gauge);
    add(gauge, new THREE.CylinderGeometry(0.075, 0.075, 0.035, 18), steel, 0, 0, -0.015, { rx: Math.PI / 2 });
    decal(gauge, 0.13, 0.13, gTex, 0, 0, 0.004, { basic: true });
    const needle = new THREE.Group(); needle.position.z = 0.008; gauge.add(needle);
    add(needle, new THREE.BoxGeometry(0.006, 0.055, 0.003), M(0xd9382b, 0.4, 0), 0, 0.024, 0);
    add(gauge, new THREE.CylinderGeometry(0.008, 0.008, 0.01, 8), rubber, 0, 0, 0.01, { rx: Math.PI / 2 });
    add(u, new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), brass, 0.18, 0.48, 0.38);
    pw.needle = needle;
    // A brand decal on the shroud, deadpan.
    decal(u, 0.36, 0.1, canvasTex(256, 72, (g, w, h) => {
      g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d4d2f'; g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
      g.fillStyle = '#1d4d2f'; g.font = 'bold 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('HYDRO-RAT 3000', w / 2, h / 2 + 1);
    }), -0.1, 0.38, 0.322);
    bolts(u, [[-0.29, 0.49, 0.3], [0.29, 0.49, 0.3], [-0.29, 0.49, -0.26], [0.29, 0.49, -0.26], [0.12, 0.4, 0.475, Math.PI / 2], [0.24, 0.4, 0.475, Math.PI / 2], [0.18, 0.46, 0.475, Math.PI / 2], [0.18, 0.34, 0.475, Math.PI / 2]]);
    // Hose reel on its own little frame, with a coil of green hose and a crank.
    const reelFrame = new THREE.Group(); reelFrame.position.set(-0.85, 0, 0.05); u.add(reelFrame);
    add(reelFrame, merge([
      [new THREE.BoxGeometry(0.04, 0.6, 0.04), mtx(-0.2, 0.3, 0.12, 0.2)], [new THREE.BoxGeometry(0.04, 0.6, 0.04), mtx(-0.2, 0.3, -0.12, -0.2)],
      [new THREE.BoxGeometry(0.04, 0.6, 0.04), mtx(0.2, 0.3, 0.12, 0.2)], [new THREE.BoxGeometry(0.04, 0.6, 0.04), mtx(0.2, 0.3, -0.12, -0.2)],
      [new THREE.BoxGeometry(0.44, 0.03, 0.4), mtx(0, 0.02, 0)],
    ]), darkSteel, 0, 0, 0, { shadow: true });
    const reel = new THREE.Group(); reel.position.set(0, 0.56, 0); reelFrame.add(reel);
    add(reel, merge([
      [new THREE.CylinderGeometry(0.27, 0.27, 0.015, 20), mtx(-0.17, 0, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(0.27, 0.27, 0.015, 20), mtx(0.17, 0, 0, 0, 0, Math.PI / 2)],
      [new THREE.CylinderGeometry(0.09, 0.09, 0.34, 12), mtx(0, 0, 0, 0, 0, Math.PI / 2)],
    ]), M(0xd9382b, 0.55, 0.15), 0, 0, 0, { shadow: true });
    const coil = []; for (let l = 0; l < 3; l++) for (let i = 0; i < 6; i++) coil.push([new THREE.TorusGeometry(0.12 + l * 0.04, 0.02, 6, 20), mtx(-0.13 + i * 0.052, 0, 0, 0, Math.PI / 2)]);
    add(reel, merge(coil), hoseGreen, 0, 0, 0);
    add(reel, new THREE.BoxGeometry(0.03, 0.2, 0.03), steel, 0.2, 0.08, 0);
    add(reel, new THREE.CylinderGeometry(0.02, 0.02, 0.1, 8), rubber, 0.25, 0.17, 0, { rz: Math.PI / 2 });
    pw.reel = reel;
    // The hose from the pump outlet to the reel hub (static), and the live hose's start point.
    const hc = new THREE.CatmullRomCurve3([new THREE.Vector3(0.18, 0.4, 0.55), new THREE.Vector3(0.0, 0.05, 0.6), new THREE.Vector3(-0.5, 0.04, 0.45), new THREE.Vector3(-0.85, 0.3, 0.2), new THREE.Vector3(-0.85, 0.56, 0.0)]);
    add(u, new THREE.TubeGeometry(hc, 20, 0.02, 6), hoseGreen, 0, 0, 0);
    pw.outlet.set(-0.85, 0.36, 0.25);
    // The wand holstered on the side when nobody's holding it.
    const holster = new THREE.Group(); holster.position.set(0.4, 0.5, 0.05); u.add(holster);
    add(holster, new THREE.BoxGeometry(0.06, 0.18, 0.12), yellow, 0, 0.42, 0);
    add(holster, new THREE.CylinderGeometry(0.011, 0.011, 0.85, 6), steel, 0, 0.0, 0);
    add(holster, new THREE.CylinderGeometry(0.022, 0.014, 0.05, 8), red, 0, -0.44, 0);
    add(u, new THREE.TorusGeometry(0.03, 0.008, 6, 12), darkSteel, 0.38, 0.35, 0.05, { rx: Math.PI / 2 });
    pw.holster = holster;
    // The puddle that never quite dries, shiny.
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), shiny(0x1e2b33, 0.55));
    puddle.material.map = softDot; puddle.material.needsUpdate = true;
    puddle.position.set(0.15, 0.011, 0.6); puddle.scale.set(0.75, 1, 0.5); puddle.renderOrder = 2; u.add(puddle);
    pw.puddle = puddle;
    bake(u, [reel, needle, holster, puddle]);
  }
  // The live hose: instanced segments from the reel to the wand in my hands.
  const hose = { n: D.hoseSegs, mesh: null, from: new THREE.Vector3(), to: new THREE.Vector3() };
  if (hose.n && found.wash) {
    hose.mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 6, 1, true).translate(0, 0.5, 0), hoseGreen, hose.n);
    hose.mesh.frustumCulled = false; hose.mesh.visible = false; scene.add(hose.mesh);
  }

  // ---------------------------------------------------------------- the wand in my hands
  const wand = { group: null, tip: new THREE.Vector3(), cone: null, coneMat: null, recoil: 0, dripT: 0, hand: new THREE.Vector3() };
  function decorateWand(g) {
    if (g.userData.props) return; g.userData.props = true;
    add(g, new THREE.BoxGeometry(0.05, 0.13, 0.06), rubber, 0.32, 0.84, -0.2, { rx: 0.35 });                 // grip
    add(g, new THREE.BoxGeometry(0.012, 0.06, 0.02), darkSteel, 0.32, 0.86, -0.28, { rx: 0.25 });             // trigger
    add(g, new THREE.TorusGeometry(0.045, 0.006, 6, 12, Math.PI), darkSteel, 0.32, 0.86, -0.27, { ry: Math.PI / 2, rz: Math.PI });
    add(g, new THREE.CylinderGeometry(0.02, 0.02, 0.07, 10), brass, 0.32, 0.9, -0.12, { rx: Math.PI / 2 });   // hose coupling
    add(g, new THREE.CylinderGeometry(0.016, 0.016, 0.12, 8), rubber, 0.32, 1.0, -0.42, { rx: Math.PI / 2 }); // lance guard
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10), red, 0.32, 1.0, -1.16, { rx: Math.PI / 2 });     // quick-connect nozzle
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xe6f6ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.6, 16, 1, true).translate(0, -0.8, 0).rotateX(Math.PI / 2), coneMat);
    cone.position.set(0.32, 1.0, -1.23); cone.visible = false; g.add(cone);
    wand.group = g; wand.cone = cone; wand.coneMat = coneMat; wand.tipObj = g.getObjectByName('nozzleTip');
  }
  function decoratePicker(g, drum) {
    if (g.userData.props) return; g.userData.props = true;
    for (const y of [-0.45, 0.45]) add(drum, new THREE.CylinderGeometry(0.28, 0.28, 0.02, 14), M(0xd9822b, 0.6, 0.1), 0, y, 0);
    add(drum, new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), steel, 0, 0, 0);
    add(g, merge([[new THREE.BoxGeometry(0.03, 0.5, 0.03), mtx(-0.47, 0.42, -1.45, 0.6)], [new THREE.BoxGeometry(0.03, 0.5, 0.03), mtx(0.47, 0.42, -1.45, 0.6)], [new THREE.BoxGeometry(0.97, 0.03, 0.03), mtx(0, 0.62, -1.3)]]), darkSteel, 0, 0, 0);
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), rubber, 0, 1.33, -0.3, { rx: 1.12 });
  }
  function decorateGear(root) {
    for (const g of root.children) {
      if (g.userData.props) continue;
      const drum = g.getObjectByName('drum');
      if (drum) { decoratePicker(g, drum); continue; }
      const box = g.children.find(c => c.geometry?.parameters?.width === 0.08 && c.geometry.parameters.depth === 0.22);
      if (box) { decorateWand(g); continue; }
      const tube = g.children.find(c => c.geometry?.parameters?.height === 1.0 && c.geometry.parameters.radiusTop === 0.025);
      if (tube) { g.userData.props = true; const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.16, 10), rubber); grip.position.y = 0.42; tube.add(grip);
        for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 5, 12), steel); r.position.y = -0.4 - i * 0.03; r.rotation.x = Math.PI / 2; tube.add(r); } continue; }
      g.userData.props = true;
    }
  }

  // ---------------------------------------------------------------- the ball washer (local frame; front is +z)
  const bw = { g: found.washer, drum: null, lamp: null, beacon: null, brushes: [], tier: -1, motor: null, brent: null, active: 0, bubbleC: 0, dripC: 0 };
  if (bw.g) {
    const g = bw.g, orig = [...g.children];
    bolts(g, [[-0.36, 0.09, -0.36], [0.36, 0.09, -0.36], [-0.36, 0.09, 0.36], [0.36, 0.09, 0.36],
      [-0.38, 1.41, 0.351, Math.PI / 2], [0.38, 1.41, 0.351, Math.PI / 2], [-0.38, 0.99, 0.351, Math.PI / 2], [0.38, 0.99, 0.351, Math.PI / 2]]);
    // The decal plate on the post.
    decal(g, 0.3, 0.22, canvasTex(160, 120, (x, w, h) => {
      x.fillStyle = '#c9ccd0'; x.fillRect(0, 0, w, h); x.strokeStyle = '#5a5e64'; x.lineWidth = 4; x.strokeRect(4, 4, w - 8, h - 8);
      x.fillStyle = '#1b1d20'; x.textAlign = 'center'; x.font = 'bold 17px system-ui, sans-serif'; x.fillText('BALL HYGIENE UNIT', w / 2, 32);
      x.font = '13px system-ui, sans-serif'; x.fillText('Model BH-1 · Fairway Holdings', w / 2, 54); x.fillText('Do not insert hands.', w / 2, 76); x.fillText('Do not insert Kevin.', w / 2, 96);
      for (const [cx, cy] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]]) { x.fillStyle = '#7d828a'; x.beginPath(); x.arc(cx, cy, 4, 0, TAU); x.fill(); }
      const r = rng(2); for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(110,70,30,${0.1 + r() * 0.2})`; x.fillRect(r() * w, r() * h, 2 + r() * 8, 1 + r() * 3); }
    }), 0, 0.42, 0.183);
    // Grime streaks under the window, and a wet puddle round the base.
    decal(g, 0.7, 0.3, canvasTex(128, 64, (x, w, h) => {
      const r = rng(8); for (let i = 0; i < 22; i++) { const px = r() * w; const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(70,50,25,0.5)'); gr.addColorStop(1, 'rgba(70,50,25,0)'); x.fillStyle = gr; x.fillRect(px, 0, 1 + r() * 3, h * (0.4 + r() * 0.6)); }
    }, { srgb: false }), 0, 0.92, 0.352, { alpha: true });
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), shiny(0x1e2b33, 0.5));
    puddle.material.map = softDot; puddle.material.needsUpdate = true;
    puddle.position.set(0.1, 0.011, 0.35); puddle.scale.set(0.8, 1, 0.55); puddle.renderOrder = 2; g.add(puddle);
    // Rubber grips on the crank knobs (the red knobs: r 0.04, 0.14 long).
    g.traverse(o => {
      const p = o.geometry?.parameters;
      if (o.isMesh && p && p.radiusTop === 0.04 && p.height === 0.14 && !o.userData.grip) {
        o.userData.grip = true;
        o.add(new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.1, 10), rubber));
        for (const y of [-0.03, 0, 0.03]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.005, 4, 12), rubber); r.rotation.x = Math.PI / 2; r.position.y = y; o.add(r); }
      }
      if (o.isMesh && p && p.radiusTop === 0.13 && p.height === 0.5) bw.drum = o;
    });
    // Wet balls glint in the chute: the chute's ball material goes glossy.
    if (D.wetSheen) {
      const glossy = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0xffffff, shininess: 140 });
      for (const o of scene.children) if (o.isMesh && o.geometry?.type === 'SphereGeometry' && o.geometry.parameters.radius === 0.06 && o.geometry.parameters.widthSegments === 10) o.material = glossy;
    }
    bake(g, orig);
  }
  function washerTier(t) {
    if (!bw.g || t === bw.tier) return;
    bw.tier = t;
    if (t >= 2 && !bw.motor) {   // Electric: a motor on the back, a conduit to the ground, a status lamp.
      const m = new THREE.Group(); bw.g.add(m); bw.motor = m;
      add(m, new THREE.CylinderGeometry(0.13, 0.13, 0.3, 16), M(0x4a5560, 0.45, 0.5), 0, 1.2, -0.5, { rx: Math.PI / 2, shadow: true });
      add(m, merge(Array.from({ length: 5 }, (_, i) => [new THREE.BoxGeometry(0.29, 0.012, 0.25), mtx(0, 1.2 - 0.1 + i * 0.05, -0.5)])), darkSteel, 0, 0, 0);
      add(m, new THREE.CylinderGeometry(0.015, 0.015, 1.1, 6), M(0x666a70, 0.6, 0.3), 0.08, 0.6, -0.6);
      add(m, new THREE.BoxGeometry(0.12, 0.16, 0.06), M(0x8b8f96, 0.5, 0.4), 0.3, 1.25, -0.37);
      bw.lamp = add(m, new THREE.SphereGeometry(0.025, 10, 8), new THREE.MeshBasicMaterial({ color: 0x2a3a2a }), 0.3, 1.3, -0.335);
      decal(m, 0.16, 0.05, canvasTex(128, 40, (x, w, h) => { x.fillStyle = '#f2c94c'; x.fillRect(0, 0, w, h); x.fillStyle = '#111'; x.font = 'bold 22px system-ui'; x.textAlign = 'center'; x.fillText('⚡ 240V', w / 2, 29); }), 0, 1.38, -0.5, { ry: Math.PI });
      bake(m, [bw.lamp]);
    }
    if (t >= 3 && !bw.brent) {   // Industrial: Brent. A stainless hood with roller brushes, a beacon, a name.
      const b = new THREE.Group(); bw.g.add(b); bw.brent = b;
      const ss = M(0xc8cdd3, 0.28, 0.85);
      add(b, new THREE.BoxGeometry(1.1, 0.95, 0.5), ss, 0, 0.475, -0.85, { shadow: true });
      add(b, new THREE.BoxGeometry(1.16, 0.06, 0.56), darkSteel, 0, 0.97, -0.85);
      const brush = canvasTex(32, 64, (x, w, h) => { for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? '#2f6fbf' : '#f2c94c'; x.fillRect(0, i * h / 16, w, h / 16); } });
      for (const sx of [-1, 1]) {
        const r = add(b, new THREE.CylinderGeometry(0.13, 0.13, 0.85, 12), new THREE.MeshLambertMaterial({ map: brush }), sx * 0.7, 0.5, -0.85);
        bw.brushes.push(r);
        add(b, new THREE.CylinderGeometry(0.02, 0.02, 1.0, 6), steel, sx * 0.7, 0.5, -0.85);
      }
      decal(b, 1.0, 0.3, canvasTex(256, 76, (x, w, h) => {
        x.fillStyle = '#1b1d20'; x.fillRect(0, 0, w, h); x.strokeStyle = '#f2a516'; x.lineWidth = 5; x.strokeRect(4, 4, w - 8, h - 8);
        x.fillStyle = '#f2a516'; x.font = 'bold 44px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('B R E N T', w / 2, h / 2 + 2);
      }), 0, 0.62, -1.103, { glow: true, ry: Math.PI });
      bw.beacon = add(b, new THREE.CylinderGeometry(0.07, 0.08, 0.14, 12), new THREE.MeshBasicMaterial({ color: 0xffa21a, transparent: true, opacity: 0.9 }), 0.4, 1.07, -0.85);
      decal(b, 0.5, 0.2, canvasTex(160, 64, (x, w, h) => { x.fillStyle = '#e8e2d0'; x.fillRect(0, 0, w, h); x.fillStyle = '#222'; x.font = '15px system-ui'; x.textAlign = 'center'; x.fillText('Hi. I am Brent.', w / 2, 26); x.fillText('I wash 5 balls a second.', w / 2, 48); }), -0.05, 0.3, -1.103, { ry: Math.PI });
      bake(b, [...bw.brushes, bw.beacon]);
    }
  }

  // ---------------------------------------------------------------- the ball return (the old bucket stand) and the dispenser
  const disp = { win: null, level: -1, ctx: null, tex: null };
  if (found.stand) {
    const s = found.stand, orig = [...s.children];
    // Corner posts and a top lip so the box reads as a built stand, plus a stencil and a slot.
    add(s, merge([[-0.98, -0.58], [0.98, -0.58], [-0.98, 0.58], [0.98, 0.58]].map(([x, z]) => [new THREE.BoxGeometry(0.07, 1.02, 0.07), mtx(x, 0.51, z)])), M(0x5e3c20, 0.85, 0), 0, 0, 0, { shadow: true });
    add(s, new THREE.BoxGeometry(2.08, 0.05, 1.28), M(0x5e3c20, 0.85, 0), 0, 1.02, 0);
    const sten = canvasTex(256, 96, (x, w, h) => {
      x.fillStyle = 'rgba(245,240,225,0.85)'; x.font = 'bold 40px Impact, system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('BALL RETURN', w / 2, 46);
      x.font = 'italic 18px system-ui, sans-serif'; x.fillText('Every Ball Matters.™', w / 2, 78);
      x.globalCompositeOperation = 'destination-out'; const r = rng(4); for (let i = 0; i < 260; i++) x.fillRect(r() * w, r() * h, 2, 2);
    });
    decal(s, 1.4, 0.52, sten, 0, 0.55, -0.606, { ry: Math.PI, alpha: true });
    // A stack of wire buckets beside the return (the Rats' own), dented, and one knocked over.
    const wireTex = canvasTex(64, 32, (x, w, h) => { x.strokeStyle = '#fff'; x.lineWidth = 2; for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(i * 8, 0); x.lineTo(i * 8, h); x.stroke(); } for (let j = 0; j <= 4; j++) { x.beginPath(); x.moveTo(0, j * 8); x.lineTo(w, j * 8); x.stroke(); } }, { srgb: false });
    const wireMat = D.standard ? new THREE.MeshStandardMaterial({ color: 0xb9c0c8, alphaMap: wireTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.7 })
      : new THREE.MeshLambertMaterial({ color: 0xb9c0c8, alphaMap: wireTex, alphaTest: 0.5, side: THREE.DoubleSide });
    const bg = new THREE.CylinderGeometry(0.2, 0.15, 0.3, 14, 2, true);
    { const p = bg.attributes.position, r = rng(21); for (let i = 0; i < p.count; i++) { const k = 1 - r() * 0.08; p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); } bg.computeVertexNormals(); }
    const rimG = new THREE.TorusGeometry(0.2, 0.012, 5, 18).rotateX(Math.PI / 2).translate(0, 0.15, 0);
    for (let i = 0; i < 5; i++) {
      const tilt = R(-0.06, 0.06);
      add(s, bg, wireMat, 1.35, 0.15 + i * 0.07, -0.25, { rx: tilt, rz: R(-0.05, 0.05), shadow: i === 4 });
      add(s, rimG, steel, 1.35, 0.15 + i * 0.07, -0.25, { rx: tilt });
    }
    add(s, bg, wireMat, 1.4, 0.2, 0.45, { rz: Math.PI / 2 - 0.15, ry: 0.6 });
    add(s, rimG, steel, 1.4, 0.2, 0.45, { rz: Math.PI / 2 - 0.15, ry: 0.6 });
    makeWettable(s.children[0]);
    bake(s, orig);
  }
  {
    // The dispenser (scenery.js: a red box at (23.5, 0.75, 8.5) facing -z, a glass dome, a dark panel).
    let box = null;
    scene.getObjectByName('scenery')?.traverse(o => { const p = o.geometry?.parameters; if (o.isMesh && p && p.width === 0.9 && p.height === 1.5 && p.depth === 0.7) box = o; });
    if (box) {
      const g = new THREE.Group(); g.position.set(box.position.x, 0, box.position.z); g.rotation.y = Math.PI; scene.add(g);   // local +z faces the yard (-z world)
      box.material = M(0xc8322a, 0.45, 0.25);
      // The lit header.
      const head = canvasTex(256, 64, (x, w, h) => {
        const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fff5d8'); gr.addColorStop(1, '#ffd98a'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
        x.fillStyle = '#b3261e'; x.font = 'bold 44px Impact, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('BUCKETS', w / 2, h / 2 + 2);
      });
      add(g, new THREE.BoxGeometry(0.96, 0.28, 0.24), darkSteel, 0, 1.68, 0.44);
      decal(g, 0.9, 0.23, head, 0, 1.68, 0.562, { glow: true });
      // The coin slot plate.
      const plate = new THREE.Group(); plate.position.set(0.3, 1.25, 0.352); g.add(plate);
      add(plate, new THREE.BoxGeometry(0.2, 0.26, 0.02), steel, 0, 0, 0);
      add(plate, new THREE.BoxGeometry(0.02, 0.07, 0.02), rubber, 0, 0.05, 0.008);
      add(plate, new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12), red, 0, -0.06, 0.01, { rx: Math.PI / 2 });
      decal(plate, 0.18, 0.05, canvasTex(128, 36, (x, w, h) => { x.fillStyle = '#222'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2c94c'; x.font = 'bold 18px system-ui'; x.textAlign = 'center'; x.fillText('TOKENS ONLY', w / 2, 25); }), 0, -0.11, 0.012, { basic: true });
      bolts(plate, [[-0.085, 0.115, 0.012, Math.PI / 2], [0.085, 0.115, 0.012, Math.PI / 2], [-0.085, -0.115, 0.012, Math.PI / 2], [0.085, -0.115, 0.012, Math.PI / 2]]);
      // The ball-count window over the old panel: balls behind glass, and a counter.
      const c = document.createElement('canvas'); c.width = 128; c.height = 96;
      disp.ctx = c.getContext('2d'); disp.tex = new THREE.CanvasTexture(c); disp.tex.colorSpace = THREE.SRGBColorSpace;
      disp.win = decal(g, 0.56, 0.4, disp.tex, -0.08, 0.98, 0.392, { basic: true });
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.4), shiny(0xcfe8f5, 0.18));
      glass.position.set(-0.08, 0.98, 0.397); g.add(glass);
      // The tray and a bucket under the chute.
      add(g, new THREE.BoxGeometry(0.5, 0.05, 0.3), darkSteel, 0, 0.32, 0.45);
      add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10), darkSteel, 0, 0.5, 0.4);
      add(g, new THREE.CylinderGeometry(0.2, 0.15, 0.3, 14, 1, true), new THREE.MeshLambertMaterial({ color: 0x2f6fbf, side: THREE.DoubleSide }), 0, 0.5, 0.45);
      bolts(g, [[-0.42, 1.45, 0.352, Math.PI / 2], [0.42, 1.45, 0.352, Math.PI / 2], [-0.42, 0.06, 0.352, Math.PI / 2], [0.42, 0.06, 0.352, Math.PI / 2]]);
      bake(g, [disp.win]);
    }
  }
  function drawWindow(level) {
    const x = disp.ctx; if (!x) return;
    const w = 128, h = 96;
    x.fillStyle = '#1a1d22'; x.fillRect(0, 0, w, h);
    const r = rng(77), top = h - 8 - level * (h - 26);
    for (let y = h - 10; y > top; y -= 7) for (let i = 0; i < 18; i++) {
      const bx = 6 + i * 6.6 + (((y / 7) | 0) % 2) * 3.3 + r() * 1.2;
      x.fillStyle = r() < 0.12 ? '#d8d2c0' : '#f6f4ee'; x.beginPath(); x.arc(bx, y, 3.4, 0, TAU); x.fill();
    }
    x.fillStyle = '#0d0f12'; x.fillRect(0, 0, w, 16);
    x.fillStyle = '#ff5a3a'; x.font = 'bold 13px ui-monospace, Consolas, monospace'; x.textAlign = 'center';
    x.fillText(`IN HOPPER ${String(Math.round(level * 500)).padStart(4, '0')}`, w / 2, 12);
    disp.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the snack shed (local frame; the counter faces -z)
  const shed = { g: found.shed, glow: null, glowMat: null, vent: new THREE.Vector3(), win: new THREE.Vector3(), steamC: 0, ventC: 0, boards: null };
  if (shed.g) {
    const g = shed.g, orig = [...g.children];
    for (const c of g.children) {
      const p = c.geometry?.parameters;
      if (c.isMesh && c.geometry.type === 'SphereGeometry' && p.radius === 0.4) c.visible = false;   // the old sack blob
      if (c.isMesh && p?.width === 2.2 && p.height === 0.8) shed.boards = c;
    }
    // A burlap sack with a folded-over top.
    const burlap = canvasTex(64, 64, (x, w, h) => {
      x.fillStyle = '#a3804f'; x.fillRect(0, 0, w, h);
      for (let i = 0; i < w; i += 3) { x.fillStyle = 'rgba(70,45,20,0.35)'; x.fillRect(i, 0, 1, h); x.fillRect(0, i, w, 1); }
      const r = rng(6); for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,230,180' : '60,40,15'},0.25)`; x.fillRect(r() * w, r() * h, 2, 1); }
      x.fillStyle = 'rgba(40,60,120,0.75)'; x.font = 'bold 12px system-ui'; x.textAlign = 'center'; x.fillText('SPUDS', w / 2, h / 2);
    }, { repeat: [2, 1] });
    const sackMat = new THREE.MeshLambertMaterial({ map: burlap });
    const prof = [[0.0, 0], [0.3, 0.02], [0.38, 0.12], [0.4, 0.3], [0.36, 0.5], [0.28, 0.64], [0.2, 0.7], [0.16, 0.72]].map(([x, y]) => new THREE.Vector2(x, y));
    const sack = add(g, new THREE.LatheGeometry(prof, 16), sackMat, -1.6, 0, -1.4, { shadow: true });
    sack.scale.set(1, 1, 0.82);
    add(g, new THREE.CylinderGeometry(0.26, 0.17, 0.18, 14, 1, true), new THREE.MeshLambertMaterial({ map: burlap, side: THREE.DoubleSide }), -1.6, 0.76, -1.43, { rx: 0.5, rz: 0.15 });
    add(g, new THREE.TorusGeometry(0.165, 0.018, 5, 14), M(0x6b4f2a, 1, 0), -1.6, 0.71, -1.4, { rx: Math.PI / 2 });
    // A crate of potatoes.
    const crate = new THREE.Group(); crate.position.set(-1.65, 0, -0.65); crate.rotation.y = 0.2; g.add(crate);
    const slats = [];
    for (const y of [0.06, 0.18, 0.3]) { slats.push([new THREE.BoxGeometry(0.62, 0.08, 0.02), mtx(0, y, -0.22)], [new THREE.BoxGeometry(0.62, 0.08, 0.02), mtx(0, y, 0.22)], [new THREE.BoxGeometry(0.02, 0.08, 0.44), mtx(-0.3, y, 0)], [new THREE.BoxGeometry(0.02, 0.08, 0.44), mtx(0.3, y, 0)]); }
    slats.push([new THREE.BoxGeometry(0.62, 0.02, 0.44), mtx(0, 0.02, 0)]);
    add(crate, merge(slats), M(0xb08a58, 0.9, 0), 0, 0, 0, { shadow: true });
    const pot = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 7, 5), M(0xb08850, 0.9, 0), 18);
    for (let i = 0; i < 18; i++) pot.setMatrixAt(i, mtx(R(-0.24, 0.24), 0.3 + R(0, 0.06), R(-0.17, 0.17), R(0, 3), R(0, 3), 0, R(1.1, 1.4), R(0.8, 1), R(0.85, 1.05)));
    crate.add(pot);
    // The fryer glow behind the shutters (shows when the shed is open).
    const glowTex = canvasTex(128, 48, (x, w, h) => {
      x.fillStyle = '#2a1d14'; x.fillRect(0, 0, w, h);
      const gr = x.createRadialGradient(w * 0.62, h, 2, w * 0.62, h, w * 0.45); gr.addColorStop(0, 'rgba(255,170,60,1)'); gr.addColorStop(1, 'rgba(255,120,40,0)');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      x.fillStyle = '#9aa3ad'; x.fillRect(w * 0.5, h * 0.55, w * 0.25, h * 0.3); x.fillStyle = '#3a3d42'; x.fillRect(w * 0.48, h * 0.5, w * 0.29, 3);
      x.strokeStyle = '#c8ccd2'; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(w * 0.52 + i * 5, h * 0.55); x.lineTo(w * 0.52 + i * 5, h * 0.85); x.stroke(); }
      x.fillStyle = '#5a4a3a'; x.fillRect(4, 6, 30, 3); x.fillRect(40, 6, 22, 3);
    });
    shed.glowMat = new THREE.MeshBasicMaterial({ map: glowTex, toneMapped: false });
    shed.glow = add(g, new THREE.PlaneGeometry(2.1, 0.75), shed.glowMat, 0, 1.45, -1.206, { ry: Math.PI });
    // A vent stack on the roof, a propane bottle at the side, grease on the wall and the ground.
    add(g, new THREE.CylinderGeometry(0.09, 0.09, 1.1, 10), steel, 0.75, 2.75, 0.55, { shadow: true });
    add(g, new THREE.ConeGeometry(0.18, 0.12, 10), steel, 0.75, 3.36, 0.55);
    shed.vent.set(0.75, 3.4, 0.55);
    add(g, new THREE.CylinderGeometry(0.16, 0.16, 0.6, 14), M(0xe8e4dc, 0.4, 0.4), 1.75, 0.3, -0.7, { shadow: true });
    add(g, new THREE.SphereGeometry(0.16, 12, 6, 0, TAU, 0, Math.PI / 2), M(0xe8e4dc, 0.4, 0.4), 1.75, 0.6, -0.7);
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 0.08, 8), brass, 1.75, 0.78, -0.7);
    const grease = canvasTex(128, 64, (x, w, h) => {
      const r = rng(31); for (let i = 0; i < 14; i++) { const cx = r() * w, cy = h * (0.2 + r() * 0.6), rad = 6 + r() * 18; const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, 'rgba(60,40,15,0.45)'); gr.addColorStop(1, 'rgba(60,40,15,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); }
      for (let i = 0; i < 8; i++) { const px = r() * w; x.fillStyle = 'rgba(60,40,15,0.3)'; x.fillRect(px, h * 0.3, 2, h * 0.7); }
    }, { srgb: false });
    decal(g, 2.4, 0.9, grease, 0, 0.5, -1.206, { ry: Math.PI, alpha: true });
    const gs = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: grease, color: 0x000000, transparent: true, opacity: 0.7, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    gs.position.set(0.3, 0.013, -1.9); g.add(gs);
    // A chalk menu board on an A-frame, out front.
    const menu = new THREE.Group(); menu.position.set(-0.85, 0, -2.25); menu.rotation.y = Math.PI + 0.25; g.add(menu);
    const chalk = canvasTex(128, 160, (x, w, h) => {
      x.fillStyle = '#23302a'; x.fillRect(0, 0, w, h); x.strokeStyle = '#8b6b45'; x.lineWidth = 8; x.strokeRect(0, 0, w, h);
      x.fillStyle = '#f4f1e6'; x.textAlign = 'center'; x.font = 'bold 18px system-ui'; x.fillText('TODAY', w / 2, 28);
      x.font = '14px system-ui'; x.textAlign = 'left'; x.fillText('Fries', 12, 54); x.fillText('Hot dog', 12, 76); x.fillText('Beer', 12, 98);
      x.textAlign = 'right'; x.fillText('$', w - 12, 54); x.fillText('$$', w - 12, 76); x.fillText('ask', w - 12, 98);
      x.textAlign = 'center'; x.font = 'italic 10px system-ui'; x.fillText('Prices set by Regional.', w / 2, 128); x.fillText('Ketchup is a privilege.', w / 2, 144);
    });
    const leg = new THREE.Group(); leg.rotation.x = -0.18; menu.add(leg);
    decal(leg, 0.5, 0.62, chalk, 0, 0.5, 0.01);
    add(leg, new THREE.BoxGeometry(0.54, 0.7, 0.02), wood, 0, 0.47, 0);
    add(menu, new THREE.BoxGeometry(0.54, 0.7, 0.02), wood, 0, 0.47, -0.17, { rx: 0.18 });
    shed.win.set(0, 1.85, -1.3);
    bake(g, [...orig, shed.glow]);
  }

  // ---------------------------------------------------------------- stations appear when they matter (owner notes)
  // The ball washer exists once the crew owns the Ball washer row; the snack shed once it's open. A pop and a puff.
  const confetti = sharedConfetti(scene);
  const stations = createStations({
    scene, washer: found.washer, shed: found.shed, tube: findStations(scene).tube,
    burst: (x, y, z) => confetti.burst(x, y, z, { n: confettiCount(REVEAL.CONFETTI, !D.standard, REVEAL.CONFETTI_LOW), secs: 1.6, speed: 3.5, up: 4 }),
    onToggle: stationMarks,
  });

  // ---------------------------------------------------------------- mat mud (owner notes: "right now they are just brown")
  // Each mat's own material (main.js cloned one per mat) gets a mud layer in its shader: splotches, footprints and
  // smears from one generated field, shown where the mat's mud is above a per-texel threshold, so the mud breaks up
  // and washes off in patches. Where my spray lands, a tiny per-mat memory raises the threshold along the jet, so
  // streaks wash off first. No new meshes, no new draw calls. main.js paintFixtures skips the old flat tint.
  const mats = { list: [], tex: null };
  {
    const F = mudField(MUD.TEX, 7), n = MUD.TEX;
    const data = new Uint8Array(n * n * 4);
    for (let i = 0; i < n * n; i++) { data[i * 4] = F.density[i] * 255; data[i * 4 + 1] = F.noise[i] * 255; data[i * 4 + 3] = 255; }
    mats.tex = new THREE.DataTexture(data, n, n, THREE.RGBAFormat);
    mats.tex.wrapS = mats.tex.wrapT = THREE.RepeatWrapping; mats.tex.magFilter = mats.tex.minFilter = THREE.LinearFilter; mats.tex.needsUpdate = true;
    const byX = new Map(MATS.map(m => [m.x.toFixed(2), m]));
    const f3 = v => v.toFixed(3);
    for (const o of scene.children) {
      const p = o.isMesh && o.geometry?.type === 'BoxGeometry' ? o.geometry.parameters : null;
      if (!p || p.width !== MUD.SIZE || p.height !== 0.04 || !o.material?.isMeshLambertMaterial) continue;
      const m = byX.get(o.position.x.toFixed(2)); if (!m) continue;
      const mem = new Float32Array(MUD.MEM * MUD.MEM), memBytes = new Uint8Array(MUD.MEM * MUD.MEM * 4);
      const memTex = new THREE.DataTexture(memBytes, MUD.MEM, MUD.MEM, THREE.RGBAFormat);
      memTex.magFilter = memTex.minFilter = THREE.LinearFilter; memTex.needsUpdate = true;
      const U = { uMudTex: { value: mats.tex }, uMem: { value: memTex }, uMud: { value: 0 }, uWet: { value: 0 }, uTime: { value: 0 } };
      const mat = o.material;
      mat.color.set(0x2f6b2a); mat.userData.mudOverlay = true;
      mat.onBeforeCompile = sh => {
        Object.assign(sh.uniforms, U);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vMudUv;')
          .replace('#include <begin_vertex>', `#include <begin_vertex>\nvMudUv = position.xz / ${f3(MUD.SIZE)} + 0.5;`);
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec2 vMudUv; uniform sampler2D uMudTex; uniform sampler2D uMem; uniform float uMud; uniform float uWet; uniform float uTime;`)
          .replace('#include <map_fragment>', `#include <map_fragment>
{ vec4 mt = texture2D(uMudTex, vMudUv); float mem = texture2D(uMem, vMudUv).r;
  float c = min(0.98, ${f3(MUD.BASE)} + ${f3(MUD.NOISE)} * mt.g + ${f3(MUD.MEMK)} * mem);   // mud.js cleanThreshold
  float a = mt.r * smoothstep(c - ${f3(MUD.EDGE)}, c + ${f3(MUD.EDGE)}, uMud);              // mud.js mudAlpha
  vec3 mudCol = mix(vec3(0.115, 0.056, 0.016), vec3(0.05, 0.026, 0.009), mt.g);
  diffuseColor.rgb = mix(diffuseColor.rgb, mudCol, a * 0.95);
  diffuseColor.rgb *= 1.0 - 0.32 * uWet; }`)
          .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float glint = texture2D(uMudTex, vMudUv * 2.3 + vec2(uTime * 0.07, -uTime * 0.05)).g * texture2D(uMudTex, vMudUv * 3.1 - vec2(uTime * 0.04, uTime * 0.06)).g;
  totalEmissiveRadiance += vec3(0.55, 0.62, 0.7) * uWet * smoothstep(0.55, 0.9, glint) * 0.8; }   // drifting glints off the water film`);
      };
      mat.customProgramCacheKey = () => 'rr-mat-mud';
      mat.needsUpdate = true;
      mats.list.push({ i: m.i, x: m.x, z: o.position.z, U, mem, memBytes, memTex, mud: -1, wet: 0, hit: false, dirty: false });
    }
  }
  const memUpload = M => { for (let i = 0; i < M.mem.length; i++) M.memBytes[i * 4] = M.mem[i] * 255; M.memTex.needsUpdate = true; M.dirty = false; };
  const sparkle = puffs(D.sparkle, { color: 0xffffff, opacity: 1, blending: THREE.AdditiveBlending });
  const jet = puffs(D.jet, { color: 0xdff4ff, opacity: 0.85 });   // crewmates' spray

  // ---------------------------------------------------------------- picker carts
  const cageBars = merge([
    ...[[-0.75, -0.85], [0.75, -0.85], [-0.75, 0.85], [0.75, 0.85]].map(([x, z]) => [new THREE.CylinderGeometry(0.025, 0.025, 1.55, 6), mtx(x, 0, z)]),
    ...[-0.85, 0.85].map(z => [new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), mtx(0, 0.775, z, 0, 0, Math.PI / 2)]),
    ...[-0.75, 0.75].map(x => [new THREE.CylinderGeometry(0.02, 0.02, 1.7, 6), mtx(x, 0.775, 0, Math.PI / 2)]),
    ...[-0.75, 0.75].map(x => [new THREE.CylinderGeometry(0.015, 0.015, 1.7, 6), mtx(x, 0.1, 0, Math.PI / 2)]),
    [new THREE.CylinderGeometry(0.015, 0.015, 1.5, 6), mtx(0, 0.1, 0.85, 0, 0, Math.PI / 2)],
  ]);
  const hopperFrame = merge([
    [new THREE.BoxGeometry(1.3, 0.03, 0.6), mtx(0, -0.25, 0)],
    ...[[-0.65, -0.3], [0.65, -0.3], [-0.65, 0.3], [0.65, 0.3]].map(([x, z]) => [new THREE.BoxGeometry(0.04, 0.52, 0.04), mtx(x, 0, z)]),
    [new THREE.BoxGeometry(1.34, 0.04, 0.04), mtx(0, 0.25, 0.3)], [new THREE.BoxGeometry(1.34, 0.04, 0.04), mtx(0, 0.25, -0.3)],
  ]);
  const mudTex = canvasTex(128, 64, (x, w, h) => {
    const r = rng(13);
    const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(90,61,30,0)'); gr.addColorStop(0.45, 'rgba(90,61,30,0.6)'); gr.addColorStop(1, 'rgba(80,52,24,0.95)');
    x.fillStyle = gr; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(${70 + r() * 30 | 0},${48 + r() * 20 | 0},22,${0.5 + r() * 0.4})`; x.beginPath(); x.arc(r() * w, h * (0.25 + r() * 0.75), 1 + r() * 4, 0, TAU); x.fill(); }
  });
  const reelDisc = new THREE.CylinderGeometry(0.265, 0.265, 0.02, 12), reelEnds = new Map();
  function decorateCart(v) {
    if (v.props) return;
    const P = { lastX: v.pose?.x ?? v.g.position.x, lastZ: v.pose?.z ?? v.g.position.z, wheels: [], mudMat: null, reelW: -1, shroud: null, wet: null };
    v.props = P;
    add(v.cage, cageBars, M(0x3a3d42, 0.45, 0.6), 0, 0, 0, { shadow: true });
    if (v.cage.material) { v.cage.material.transparent = true; v.cage.material.opacity = 0.45; }
    add(v.g, hopperFrame, darkSteel, 0, 1.05, 1.05);
    v.g.traverse(o => { const p = o.geometry?.parameters; if (o.isMesh && o.geometry.type === 'CylinderGeometry' && p.radiusTop === 0.3 && p.height === 0.22) P.wheels.push(o); });
    for (const w of P.wheels) {
      add(w, merge([[new THREE.CylinderGeometry(0.15, 0.15, 0.23, 10), null], [new THREE.BoxGeometry(0.26, 0.232, 0.04), null]]), M(0xd8d4c8, 0.5, 0.4), 0, 0, 0);
    }
    P.mudMat = new THREE.MeshLambertMaterial({ map: mudTex, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const band = merge([
      [new THREE.PlaneGeometry(2.4, 0.42), mtx(0.705, 0.52, 0, 0, Math.PI / 2)], [new THREE.PlaneGeometry(2.4, 0.42), mtx(-0.705, 0.52, 0, 0, -Math.PI / 2)],
      [new THREE.PlaneGeometry(1.4, 0.42), mtx(0, 0.52, -1.205, 0, Math.PI)], [new THREE.PlaneGeometry(1.4, 0.42), mtx(0, 0.52, 1.205)],
    ]);
    const bm = new THREE.Mesh(band, P.mudMat); bm.renderOrder = 2; v.g.add(bm);
    P.mudMesh = bm;
    const blob = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: softDot, color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    blob.position.y = 0.015; blob.renderOrder = 1; v.g.add(blob);
    P.wet = makeWettable(v.body);
  }
  function decorateReels(v) {
    const P = v.props;
    if (P.reelW === v.reelWidth) return;
    P.reelW = v.reelWidth;
    for (const d of v.reels.children) {
      const h = +d.geometry.parameters.height.toFixed(3);
      if (!reelEnds.has(h)) reelEnds.set(h, merge([[reelDisc, mtx(0, -h / 2)], [reelDisc, mtx(0, h / 2)], [new THREE.CylinderGeometry(0.03, 0.03, h + 0.04, 6), null]]));
      add(d, reelEnds.get(h), steel, 0, 0, 0);
    }
    if (!P.shroud) {
      P.shroud = add(v.g, new THREE.CylinderGeometry(0.03, 0.03, 1, 8), M(0x2e7d4f, 0.55, 0.3), 0, 0.62, v.reels.position.z, { rz: Math.PI / 2 });   // the reel frame's top rail
    }
    P.shroud.scale.y = Math.max(0.5, v.reelWidth + 0.1);
    P.shroud.visible = v.reels.visible;
  }

  // ---------------------------------------------------------------- MOW-E
  const mow = { root: scene.getObjectByName('mower'), pulley: null, blade: null, chute: new THREE.Vector3(), last: new THREE.Vector3(), clipC: 0 };
  if (mow.root) {
    let deck = null;
    mow.root.traverse(o => { if (o.isGroup && Math.abs(o.position.z + 1.5) < 0.01 && Math.abs(o.position.y - 0.28) < 0.01) deck = o; });
    if (deck) {
      mow.blade = deck.children.find(c => c.isGroup) ?? null;
      add(deck, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), M(0xd24a3a, 0.5, 0.2), 0, 0.12, 0);
      mow.pulley = add(deck, merge([[new THREE.CylinderGeometry(0.12, 0.12, 0.05, 12), null], [new THREE.BoxGeometry(0.22, 0.06, 0.03), null]]), steel, 0, 0.17, 0);
      add(deck, new THREE.BoxGeometry(0.3, 0.16, 0.4), M(0x2b2b33, 0.7, 0.1), 1.2, -0.02, 0.1, { rz: -0.35 });
      bolts(deck, [[-1.0, 0.095, -0.38], [1.0, 0.095, -0.38], [-1.0, 0.095, 0.38], [1.0, 0.095, 0.38]]);
      mow.deck = deck;
    }
    const body = mow.root.children[0];
    if (body) {
      add(body, new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), M(0x2b2b33, 0.4, 0.6), -0.4, 1.35, 0.75);
      for (const x of [-0.4, 0.4]) add(body, new THREE.CircleGeometry(0.07, 12), new THREE.MeshBasicMaterial({ color: 0xfff4d0 }), x, 0.65, -0.851, { ry: Math.PI });
      bolts(body, [[-0.6, 0.9, 0.9, Math.PI / 2], [0.6, 0.9, 0.9, Math.PI / 2]]);
    }
  }

  // main.js's spray droplets: round and soft instead of square.
  for (const o of scene.children) if (o.isPoints && o.material?.isPointsMaterial && !o.material.map) { o.material.map = softDot; o.material.size = 0.11; o.material.depthWrite = false; o.material.needsUpdate = true; }

  // ---------------------------------------------------------------- shadows: softer edges on High
  // PCF with a wider kernel radius costs the same taps as today's PCF (PCFSoft measured +2.5 ms at 1440p).
  if (sky?.sun?.shadow) sky.sun.shadow.radius = D.shadowRadius;

  // ---------------------------------------------------------------- per frame
  const ray = new THREE.Raycaster(); ray.far = 9.5;
  const dir = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), warm = new THREE.Color(0xffb070);
  const aim = new THREE.Vector3(), jetDir = new THREE.Vector3(), mateDir = new THREE.Vector3();
  let splashCarry = 0, jetCarry = 0;
  let animAcc = 0, sprayT = 0, steamCarry = 0, ventCarry = 0, mistCarry = 0, bubCarry = 0, dripCarry = 0, clipCarry = 0, t0 = 0;
  const sprayTargets = [];

  function tickLights(k) {
    if (!sky?.sun || !sky.hemi) return;
    const B = lightBalance({ sunI: sky.sun.intensity, hemi: sky.hemi.intensity }, k);
    sky.sun.intensity = B.sunI; sky.hemi.intensity = B.hemiI;
    sky.sun.color.lerp(warm, B.warm * 0.35);
  }

  function tickSpray(dt, t, on) {
    const st = crew() ?? {};
    const anyWand = !!me?.wand || (st.players ?? []).some(p => p.wand);
    if (pw.holster) pw.holster.visible = !anyWand;
    pw.pressure = ease(pw.pressure, on ? 1 : me?.wand ? 0.12 : 0, on ? 8 : 2.5, dt);
    if (pw.needle) pw.needle.rotation.z = -gaugeAngle(pw.pressure, t);
    // the wand: recoil and the spray cone, drips from the nozzle when idle
    const wg = wand.group && wand.group.parent ? wand.group : null;
    if (wg && wand.cone) {
      wand.recoil = ease(wand.recoil, on ? 1 : 0, 14, dt);
      wg.position.z = wand.recoil * (0.025 + Math.sin(t * 60) * 0.006);
      wg.position.y = wand.recoil * Math.sin(t * 47) * 0.004;
      wand.cone.visible = wand.recoil > 0.05;
      wand.coneMat.opacity = wand.recoil * (0.1 + Math.random() * 0.05);
      wand.cone.scale.set(0.8 + Math.random() * 0.3, 1, 0.8 + Math.random() * 0.3);
      // The nozzle tip in the world (owner notes: the spray must come out of the nozzle): main.js's 'nozzleTip'.
      if (wand.tipObj) wand.tipObj.getWorldPosition(wand.tip); else { tmp.set(0.32, 1.0, -1.23); wg.updateWorldMatrix(true, false); wg.localToWorld(wand.tip.copy(tmp)); }
    }
    for (const M of mats.list) M.hit = false;
    if (on) {
      camera.getWorldDirection(dir);
      ray.set(camera.position, dir);
      sprayTargets.length = 0; for (const w of wettable) sprayTargets.push(w.mesh);
      const hits = ray.intersectObjects(sprayTargets, false);
      let hitPt = null;
      for (const w of wettable) w.hit = false;
      if (hits.length) { hitPt = hits[0].point; const w = wettable.find(x => x.mesh === hits[0].object); if (w) w.hit = true; }
      else if (dir.y < -0.02) { const d = (0.04 - camera.position.y) / dir.y; if (d < 9) hitPt = tmp2.copy(camera.position).addScaledVector(dir, d); }
      // The jet runs from the nozzle tip to where the crosshair lands (or 7 m out): the cone and the mist follow it.
      aim.copy(hitPt ?? tmp.copy(camera.position).addScaledVector(dir, 7));
      jetDir.copy(aim).sub(wand.tip); const jetLen = jetDir.length() || 1; jetDir.divideScalar(jetLen);
      if (wg && wand.cone) { wand.cone.lookAt(tmp.copy(wand.tip).multiplyScalar(2).sub(aim)); wand.cone.scale.z = Math.min(1.6, jetLen / 1.6); }
      // mist along the jet and a burst where it lands
      const em = emit(mist.cap * 1.6, dt, mistCarry); mistCarry = em.carry;
      for (let i = 0; i < em.n; i++) {
        if (hitPt && i % 2 === 0) mist.spawn(hitPt.x + R(-0.2, 0.2), hitPt.y + R(0.05, 0.3), hitPt.z + R(-0.2, 0.2), R(-0.6, 0.6), R(0.3, 1.0), R(-0.6, 0.6), R(0.5, 0.9), 0.15, 0.7, -0.2, 1.5);
        else { const a = R(0.05, 0.6) * Math.min(1, jetLen / 4); mist.spawn(wand.tip.x + jetDir.x * a * 4, wand.tip.y + jetDir.y * a * 4, wand.tip.z + jetDir.z * a * 4, jetDir.x * 2 + R(-0.4, 0.4), jetDir.y * 2 + R(-0.2, 0.4), jetDir.z * 2 + R(-0.4, 0.4), R(0.3, 0.6), 0.05, 0.35, 0, 2); }
      }
      if (hitPt && (sprayT += dt) > 0.12) { sprayT = 0; wetSpot(hitPt.x + R(-0.15, 0.15), hits.length ? hitPt.y + 0.003 : 0.016, hitPt.z + R(-0.15, 0.15), R(0.5, 0.9)); }
      // Splashes: droplets bouncing up where it lands (not on Low).
      if (hitPt && D.splash) {
        const sp = emit(D.splash, dt, splashCarry); splashCarry = sp.carry;
        for (let i = 0; i < sp.n; i++) drips.spawn(hitPt.x + R(-0.1, 0.1), hitPt.y + 0.03, hitPt.z + R(-0.1, 0.1), R(-1.2, 1.2) - jetDir.x * 0.8, R(1.2, 2.4), R(-1.2, 1.2) - jetDir.z * 0.8, R(0.35, 0.6), 0.03, 0.02, 9.8);
      }
      // On a mat? It gets wet, and (not on Low) my spray streaks the mud off from where it lands.
      if (hitPt && !hits.length) {
        const k = matAt(hitPt.x, hitPt.z, mats.list);
        const M = k >= 0 ? mats.list[k] : null;
        if (M) {
          M.hit = true;
          const uv = matUV(hitPt.x, hitPt.z, M.x, M.z);
          if (D.matStreaks && uv && M.mud > MUD.CLEAN && paintClean(M.mem, MUD.MEM, uv.u, uv.v, jetDir.x, jetDir.z, 2.2 * dt)) M.dirty = M.memUsed = true;
        }
      }
    } else for (const w of wettable) w.hit = false;
    if (me?.wand && !on && wg) {   // a dripping nozzle
      const e = emit(1.6, dt, dripCarry); dripCarry = e.carry;
      for (let i = 0; i < e.n; i++) drips.spawn(wand.tip.x, wand.tip.y - 0.02, wand.tip.z, 0, -0.2, 0, 0.7, 0.025, 0.02, 9.8);
    }
    for (const w of wettable) {
      w.wet = wetStep(w.wet, w.hit, dt);
      w.skin.visible = w.wet > 0.01;
      if (w.skin.visible) w.skin.material.opacity = 0.42 * w.wet;
    }
    // the hose from the reel to my hands
    if (hose.mesh) {
      const show = !!me?.wand && !!wg && found.wash;
      hose.mesh.visible = show;
      if (show) {
        found.wash.localToWorld(hose.from.copy(pw.outlet));
        tmp.set(0.32, 0.84, -0.12); wg.localToWorld(hose.to.copy(tmp));
        const dist = Math.hypot(hose.to.x - hose.from.x, hose.to.z - hose.from.z);
        const pts = sagPoints([hose.from.x, hose.from.y, hose.from.z], [hose.to.x, hose.to.y - 0.4, hose.to.z], hose.n - 1, 0.3);
        pts.push([hose.to.x, hose.to.y, hose.to.z]);
        for (let i = 0; i < hose.n; i++) {
          const a = pts[i], b = pts[i + 1];
          _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); const len = _v.length() || 1e-3;
          _q.setFromUnitVectors(tmp.set(0, 1, 0), _v.divideScalar(len));
          _m4.compose(tmp2.set(a[0], a[1], a[2]), _q, _s.set(1, len, 1));
          hose.mesh.setMatrixAt(i, _m4);
        }
        hose.mesh.instanceMatrix.needsUpdate = true;
        if (pw.reel) { pw.reelAng += (dist - pw.lastLen) * 2.5; pw.reel.rotation.x = pw.reelAng; }
        pw.lastLen = dist;
      }
    }
  }

  // The mats' mud, wet sheen and the sparkle when one comes clean (every frame: it's what you're spraying).
  function tickMats(dt, t) {
    const fx = crew()?.fixtures ?? {};
    for (const M of mats.list) {
      const mud = Math.max(0, Math.min(1, fx['mat' + M.i] ?? 0));
      if (M.mud >= 0 && cameClean(M.mud, mud)) {   // clean! a glint over the mat
        for (let i = 0; i < sparkle.cap; i++) sparkle.spawn(M.x + R(-0.7, 0.7), R(0.08, 0.3), M.z + R(-0.7, 0.7), R(-0.2, 0.2), R(0.4, 1.1), R(-0.2, 0.2), R(0.35, 0.7), R(0.08, 0.14), 0.01, 0, 1);
      }
      if (mud <= MUD.CLEAN && M.memUsed) { M.mem.fill(0); M.memUsed = false; M.dirty = true; }   // spotless: the next mud starts fresh
      if (M.dirty) memUpload(M);
      M.mud = mud;
      M.U.uMud.value = mud;
      if (D.matWet) { M.wet = wetStep(M.wet, M.hit, dt); M.U.uWet.value = M.wet * 0.9; M.U.uTime.value = t; }
    }
  }

  // Crewmates' spray: droplets from their wand's nozzle (people.js: the lance runs down the wand's local -y to
  // the yellow ring at y -1.15), while the server says they're washing (snapshot players[].spray).
  function tickMates(dt) {
    if (!others?.size || !jet.cap) return;
    const players = crew()?.players ?? [];
    for (const [id, o] of others) {
      const w = o.person?.parts?.wand;
      if (!o.g?.visible || !w?.visible || !players.find(p => p.id === id)?.spray) continue;
      w.updateWorldMatrix(true, false);
      tmp.set(0, -1.18, 0); w.localToWorld(tmp);
      mateDir.set(0, -1, 0).transformDirection(w.matrixWorld);
      const e = emit(D.jet * 2.5, dt, jetCarry); jetCarry = e.carry;
      for (let i = 0; i < e.n; i++) {
        const v = R(7, 10);
        jet.spawn(tmp.x, tmp.y, tmp.z, mateDir.x * v + R(-0.5, 0.5), mateDir.y * v + R(-0.3, 0.5), mateDir.z * v + R(-0.5, 0.5), R(0.3, 0.45), 0.04, 0.12, 9.8);
      }
    }
  }

  function tickWasher(dt, t) {
    if (!bw.g) return;
    const st = crew() ?? {};
    washerTier(st.up?.washer ?? 0);
    const w = st.washer ?? {};
    const busy = (w.rateL || 0) + (w.rateR || 0) + (w.auto && (w.n ?? 0) > 0 ? 1 : 0);
    bw.active = ease(bw.active, busy > 0 ? 1 : 0, 3, dt);
    if (bw.lamp) bw.lamp.material.color.set(w.auto ? ((t * 2) % 1 < 0.7 ? 0x4cff6a : 0x1f6a2a) : 0x2a3a2a);
    if (bw.beacon) { bw.beacon.visible = busy > 0 || (w.n ?? 0) > 0; bw.beacon.rotation.y = t * 6; bw.beacon.material.opacity = 0.6 + 0.4 * Math.max(0, Math.sin(t * 9)); }
    for (const b of bw.brushes) b.rotation.y += dt * (busy > 0 ? 14 : 0.6);
    if (bw.active > 0.05) {
      const e = emit(bubbles.cap * 0.6 * bw.active, dt, bubCarry); bubCarry = e.carry;
      for (let i = 0; i < e.n; i++) {
        const a = R(0, TAU);
        tmp.set(Math.cos(a) * 0.4, 1.92, Math.sin(a) * 0.4); bw.g.localToWorld(tmp);
        tmp2.set(Math.cos(a), 0, Math.sin(a)).transformDirection(bw.g.matrixWorld);
        bubbles.spawn(tmp.x, tmp.y, tmp.z, tmp2.x * 0.25, R(0.05, 0.25), tmp2.z * 0.25, R(1.2, 2.2), R(0.04, 0.07), R(0.07, 0.11), 0.35, 0.6);
      }
      const d = emit(3 * bw.active, dt, dripCarry); dripCarry = d.carry;
      for (let i = 0; i < d.n; i++) { tmp.set(R(-0.25, 0.25), 0.93, 0.36); bw.g.localToWorld(tmp); drips.spawn(tmp.x, tmp.y, tmp.z, 0, 0, 0, 0.5, 0.025, 0.02, 9.8); }
    }
  }

  function tickShed(dt, t) {
    if (!shed.g) return;
    const st = crew() ?? {};
    const open = !!st.fries?.open, cooking = open && (st.players ?? []).some(p => p.cooking);
    if (shed.glowMat) shed.glowMat.color.setScalar(open ? 0.85 + 0.15 * Math.sin(t * 7) * Math.sin(t * 3.1) : 0.4);
    if (!open) return;
    const e = emit(shed.g && steam.cap ? (cooking ? 6 : 2.5) : 0, dt, steamCarry); steamCarry = e.carry;
    for (let i = 0; i < e.n; i++) {
      tmp.set(R(-0.7, 0.7), 1.82, -1.25); shed.g.localToWorld(tmp);
      steam.spawn(tmp.x, tmp.y, tmp.z, R(-0.1, 0.1), R(0.35, 0.6), R(-0.1, 0.1), R(1.4, 2.2), 0.12, 0.55, -0.05, 0.4);
    }
    const v = emit(steam.cap ? 2.5 : 0, dt, ventCarry); ventCarry = v.carry;
    for (let i = 0; i < v.n; i++) { tmp.copy(shed.vent); shed.g.localToWorld(tmp); steam.spawn(tmp.x, tmp.y, tmp.z, R(-0.1, 0.1) + 0.15, R(0.5, 0.8), R(-0.1, 0.1), R(1.6, 2.6), 0.15, 0.8, -0.05, 0.3); }
  }

  function tickCarts(dt) {
    for (const v of cartViews) {
      if (!v) continue;
      decorateCart(v);
      decorateReels(v);
      const P = v.props, x = v.g.position.x, z = v.g.position.z;
      const dx = x - P.lastX, dz = z - P.lastZ; P.lastX = x; P.lastZ = z;
      const fwd = -(dx * Math.sin(v.g.rotation.y) + dz * Math.cos(v.g.rotation.y));   // + going forward (-z local)
      const d = Math.abs(dx) + Math.abs(dz) > 5 ? 0 : fwd;                               // ignore teleports
      for (const w of P.wheels) w.rotation.x -= rollAngle(d, 0.3);
      if (!v.pose || v.pose.v === 0) for (const r of v.reels.children) r.rotation.x -= rollAngle(d, 0.26);   // the ones main.js doesn't spin
      const mud = Math.min(1, crew()?.carts?.[cartViews.indexOf(v)]?.mud ?? crew()?.cart?.mud ?? 0);
      P.mudMat.opacity = Math.min(0.95, mud * 1.2);
      P.mudMesh.visible = mud > 0.02;
    }
  }

  function tickMower(dt) {
    if (!mow.root?.visible) return;
    if (mow.pulley && mow.blade) mow.pulley.rotation.y = mow.blade.rotation.y * 1.6;
    mow.root.getWorldPosition(tmp);
    const moved = tmp.distanceTo(mow.last) / Math.max(dt, 1e-3); mow.last.copy(tmp);
    if (clips.cap && moved > 0.5 && moved < 40 && mow.deck) {
      const e = emit(30, dt, clipCarry); clipCarry = e.carry;
      for (let i = 0; i < e.n; i++) {
        tmp.set(1.35, 0.0, 0.1); mow.deck.localToWorld(tmp);
        tmp2.set(1, 0, 0).transformDirection(mow.deck.matrixWorld);
        clips.spawn(tmp.x, tmp.y, tmp.z, tmp2.x * R(2, 4) + R(-0.5, 0.5), R(0.8, 2), tmp2.z * R(2, 4) + R(-0.5, 0.5), R(0.6, 1.1), 0.04, 0.03, 6, 1);
      }
    }
  }

  function tickClouds(dt, t) {
    if (!clouds.mesh) return;
    const tt = throttle(clouds.acc, dt, D.cloudHz); clouds.acc = tt.acc;
    if (!tt.run) return;
    clouds.items.forEach((c, i) => {
      c.x += c.v * tt.dt; if (c.x > 720) c.x = -720;
      _q.copy(camera.quaternion);
      _m4.compose(_v.set(c.x, c.y, c.z), _q, _s.set(c.w, c.h, 1));
      clouds.mesh.setMatrixAt(i, _m4);
    });
    clouds.mesh.instanceMatrix.needsUpdate = true;
  }

  function tickSpots(dt) {
    let c = 0;
    for (const p of spots.items) {
      if (p.life <= 0) continue;
      p.life -= dt; if (p.life <= 0) continue;
      const s = p.s * Math.min(1, p.life / 3);
      spots.mesh.setMatrixAt(c++, _m4.compose(_v.set(p.x, p.y, p.z), _q.identity(), _s.set(s, 1, s)));
    }
    spots.mesh.count = c; spots.mesh.visible = c > 0; if (c) spots.mesh.instanceMatrix.needsUpdate = true;
  }

  const api = {
    // dt seconds, t running seconds, k the time of day (0 opening .. 1 sunset)
    tick(dt, t = (t0 += dt), k = 0) {
      tickLights(k);
      const on = !!sprayOn();
      if (fpGear) decorateGear(fpGear);
      if (myGear) decorateGear(myGear);
      tickSpray(dt, t, on);          // every frame: it's in your hands
      tickMats(dt, t);
      stations.update(crew()); stations.tick(dt);
      tickMates(dt); jet.update(dt); sparkle.update(dt);
      tickCarts(dt);
      const th = throttle(animAcc, dt, D.animHz); animAcc = th.acc;
      if (th.run) {
        const d = th.dt;
        tickWasher(d, t); tickShed(d, t); tickMower(d);
        mist.update(d); drips.update(d); steam.update(d); bubbles.update(d); clips.update(d); tickSpots(d);
        const lv = Math.round(Math.max(0, Math.min(1, 1 - (ballCount() || 0) / 300)) * 10) / 10;
        if (lv !== disp.level) { disp.level = lv; drawWindow(lv); }
      }
      tickClouds(dt, t);
    },
    detail: D,
  };
  if (globalThis.__props) globalThis.__props.api = api;
  return api;
}
