// Range Rat: the pond, properly. Caustics, god rays, kelp, lily pads, fish, a very large catfish,
// lost-and-found junk, silt, bubbles, an air hose, a shimmering underside to the surface and a
// panic vignette. Everything is instanced / merged: roughly 16 draw calls while diving, and only
// the lily pads, faint caustics, fish and catfish draw from the shore.
//
//   const scuba = createScuba(scene, camera, POND);
//   scuba.setUnder(true|false);                       // when scene.userData.under flips
//   scuba.tick(dt, t, { air01, pumping, depthPos });  // once per frame
//
// No top-level side effects: everything is built inside createScuba().

import * as THREE from 'three';

const TAU = Math.PI * 2;

// Small seeded PRNG so the pond looks the same for every crewmate.
const seeded = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Bakes many primitives into one non-indexed geometry with vertex colours (one draw call).
class Bake {
  constructor() {
    this.pos = []; this.nor = []; this.col = [];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
    this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.c = new THREE.Color();
  }
  add(geo, hex, p, r, s, base) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    this.e.set(r?.[0] || 0, r?.[1] || 0, r?.[2] || 0); this.q.setFromEuler(this.e);
    this.v.set(p?.[0] || 0, p?.[1] || 0, p?.[2] || 0);
    this.s.set(s?.[0] ?? 1, s?.[1] ?? 1, s?.[2] ?? 1);
    this.m.compose(this.v, this.q, this.s);
    if (base) this.m.premultiply(base);
    g.applyMatrix4(this.m);
    this.c.set(hex);
    const P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i++) { this.pos.push(P[i]); this.nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) this.col.push(this.c.r, this.c.g, this.c.b);
    g.dispose(); geo.dispose();
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

// ---------- shaders ----------

const CAUSTIC_VERT = `
varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

// Voronoi edge lines (F2 - F1), two layers, drifting: reads as rippling caustic net.
const CAUSTIC_FRAG = `
uniform float uTime; uniform float uAmt; uniform vec3 uColor; uniform vec2 uC; uniform float uPer;
varying vec3 vW;
vec2 hash2(vec2 p){
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
float cell(vec2 p, float t, float per){
  vec2 g = floor(p), f = fract(p);
  float d1 = 9.0, d2 = 9.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 o = vec2(float(i), float(j));
    vec2 cg = g + o;
    if (per > 0.0) cg.x = mod(cg.x, per);
    vec2 h = 0.5 + 0.45 * sin(t + 6.2831 * hash2(cg));
    vec2 r = o + h - f;
    float d = dot(r, r);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return sqrt(d2) - sqrt(d1);
}
void main(){
  float t = uTime * 0.7;
  vec2 p;
  float fade = 1.0, mood = 1.0;
#ifdef WALL
  float ang = atan(vW.z - uC.y, vW.x - uC.x);
  p = vec2(ang * uPer / 6.2831853, vW.y * 2.2);
  fade = smoothstep(-1.2, -0.05, vW.y);
#else
  p = vW.xz * 1.1;
  mood = 0.7 + 0.3 * sin(vW.x * 0.35 + t) * sin(vW.z * 0.4 - t * 0.8);
#endif
  vec2 w = vec2(sin(p.y * 1.3 + t) * 0.25, sin(p.y * 0.9 - t) * 0.2);
  float a = cell(p + w, t, uPer);
  float b = cell(p * 2.0 + vec2(7.0, 3.0) + w, t * 1.3 + 2.0, uPer * 2.0);
  float la = 1.0 - smoothstep(0.0, 0.16, a);
  float lb = 1.0 - smoothstep(0.0, 0.2, b);
  float c = pow(la, 1.6) + 0.6 * pow(lb, 1.6);
  gl_FragColor = vec4(uColor * c * uAmt * fade * mood, 1.0);
}`;

const SHAFT_VERT = `
varying vec3 vN; varying vec3 vV; varying float vUy; varying float vK;
void main(){
  mat4 mv = modelViewMatrix * instanceMatrix;
  vec4 p = mv * vec4(position, 1.0);
  vN = mat3(mv) * normal;
  vV = -p.xyz;
  vUy = uv.y;
  vK = fract(instanceMatrix[3].x * 3.7 + instanceMatrix[3].z * 5.3);
  gl_Position = projectionMatrix * p;
}`;
const SHAFT_FRAG = `
uniform float uTime;
varying vec3 vN; varying vec3 vV; varying float vUy; varying float vK;
void main(){
  float face = abs(dot(normalize(vN), normalize(vV)));
  float a = pow(face, 1.6) * (0.2 + 0.8 * vUy) * smoothstep(0.0, 0.25, vUy);
  a *= 0.7 + 0.3 * sin(uTime * 0.8 + vK * 20.0 + vUy * 3.0);
  gl_FragColor = vec4(vec3(0.55, 1.0, 0.8) * a * 0.22, 1.0);
}`;

const KELP_VERT = `
uniform float uTime;
varying float vY; varying float vTint;
#include <fog_pars_vertex>
void main(){
  vY = position.y;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  float ph = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 2.3;
  float k = position.y * position.y;
  float h = length(instanceMatrix[1].xyz) * 0.5;
  wp.x += (sin(uTime * 1.2 + ph) * 0.22 + sin(uTime * 2.3 + ph * 1.7) * 0.06) * k * h;
  wp.z += cos(uTime * 0.9 + ph * 1.3) * 0.18 * k * h;
  vTint = fract(ph * 7.31);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const KELP_FRAG = `
varying float vY; varying float vTint;
#include <fog_pars_fragment>
void main(){
  vec3 base = vec3(0.02, 0.10, 0.05), tip = vec3(0.30, 0.50, 0.12);
  vec3 c = mix(base, tip, smoothstep(0.0, 1.0, vY));
  c *= 0.75 + 0.5 * vTint;
  c = mix(c, vec3(0.45, 0.45, 0.12), step(0.8, vTint) * 0.5 * vY);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

// Underside of the surface: a Snell's window (sky seen through a bright disc), mirror outside it.
const SURF_VERT = `
varying vec3 vW;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const SURF_FRAG = `
uniform float uTime;
varying vec3 vW;
void main(){
  vec2 q = vW.xz * 1.3;
  float t = uTime;
  float s1 = sin(q.x * 2.1 + t * 1.1), s2 = sin(q.y * 2.7 - t * 0.9), s3 = sin((q.x + q.y) * 1.7 + t * 1.4);
  float dx = 0.10 * (cos(q.x * 2.1 + t * 1.1) + 0.7 * cos((q.x + q.y) * 1.7 + t * 1.4));
  float dz = 0.10 * (cos(q.y * 2.7 - t * 0.9) + 0.7 * cos((q.x + q.y) * 1.7 + t * 1.4));
  vec3 n = normalize(vec3(dx, -1.0, dz));
  vec3 V = normalize(cameraPosition - vW);
  float ndv = clamp(dot(n, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);
  float window = smoothstep(0.55, 0.72, ndv);
  float sh = pow(max(0.0, (s1 + s2 + s3) / 3.0 * 0.5 + 0.5), 4.0);
  vec3 mirror = vec3(0.10, 0.36, 0.34) + vec3(0.25, 0.4, 0.4) * fres;
  vec3 sky = vec3(0.55, 0.85, 0.92) + vec3(0.2) * sh;
  vec3 col = mix(mirror, sky, window * 0.75);
  float a = mix(0.85, 0.42, window) + sh * 0.15;
  gl_FragColor = vec4(col, clamp(a, 0.0, 0.95));
}`;

const POINT_VERT = `
attribute float aSize; attribute float aAlpha;
uniform float uScale; uniform float uTime;
varying float vA;
void main(){
  vec3 p = position;
#ifdef MOTE
  float s = aAlpha * 40.0;
  p += vec3(sin(uTime * 0.31 + s), sin(uTime * 0.23 + s * 1.7) * 0.4, cos(uTime * 0.27 + s * 2.3)) * 0.5;
#endif
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(-mv.z, 0.1);
  gl_PointSize = clamp(aSize * uScale / d, 1.5, 56.0);
#ifdef MOTE
  vA = (0.25 + 0.2 * sin(uTime * 1.3 + s * 3.0)) * (1.0 - smoothstep(4.0, 9.0, d));
#else
  vA = aAlpha * (1.0 - smoothstep(5.0, 9.0, d));
#endif
}`;
const MOTE_FRAG = `
varying float vA;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float a = (1.0 - r); a *= a;
  gl_FragColor = vec4(vec3(0.75, 0.95, 0.8), a * vA);
}`;
const BUBBLE_FRAG = `
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float ring = smoothstep(0.55, 0.95, r) * (1.0 - smoothstep(0.95, 1.0, r));
  float hl = smoothstep(0.22, 0.0, length(c - vec2(-0.14, -0.14)));
  float a = (ring * 0.75 + 0.07 + hl * 0.7) * vA;
  gl_FragColor = vec4(vec3(0.85, 1.0, 1.0), a);
}`;

// ---------- the module ----------

export function createScuba(scene, camera, POND) {
  const rand = seeded(1987);
  const R = POND.r, BED = POND.BOTTOM - 0.06, BED_TOP = BED + 0.02, SURF = 0.03;
  const root = new THREE.Group();
  root.name = 'scuba';
  root.position.set(POND.x, 0, POND.z);
  scene.add(root);
  const underOnly = new THREE.Group();   // everything that only draws while diving
  underOnly.visible = false;
  root.add(underOnly);

  const disposables = [];
  const keep = o => { disposables.push(o); return o; };
  const U = { uTime: { value: 0 } };
  let under = false, clock = 0, vignette = null, vigOp = -1, padTimer = 0;

  // --- caustics (bed: always, faint from above; wall: only underwater) ---
  const causticMat = (wall) => keep(new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uAmt: { value: wall ? 0.7 : 0.22 }, uColor: { value: new THREE.Color(0.45, 0.95, 0.8) },
      uC: { value: new THREE.Vector2(POND.x, POND.z) }, uPer: { value: wall ? 40 : 0 },
    },
    defines: wall ? { WALL: 1 } : {},
    vertexShader: CAUSTIC_VERT, fragmentShader: CAUSTIC_FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: wall ? THREE.BackSide : THREE.FrontSide,
  }));
  const bedMat = causticMat(false);
  const bedCaustics = new THREE.Mesh(keep(new THREE.CircleGeometry(R - 0.05, 48)), bedMat);
  bedCaustics.rotation.x = -Math.PI / 2; bedCaustics.position.y = BED_TOP + 0.02; bedCaustics.renderOrder = 1;
  bedCaustics.frustumCulled = false;
  root.add(bedCaustics);
  const wallCaustics = new THREE.Mesh(keep(new THREE.CylinderGeometry(R - 0.05, R - 0.05, 1.1, 48, 1, true)), causticMat(true));
  wallCaustics.position.y = -0.6; wallCaustics.renderOrder = 1; wallCaustics.frustumCulled = false;
  underOnly.add(wallCaustics);

  // --- light shafts: 6 soft cones from the surface, one instanced draw ---
  const SHAFTS = 6;
  const shaftMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime }, vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  }));
  const shaftGeo = keep(new THREE.CylinderGeometry(0.25, 1.1, 1.2, 14, 1, true));
  shaftGeo.translate(0, -0.55, 0);
  const shafts = new THREE.InstancedMesh(shaftGeo, shaftMat, SHAFTS);
  shafts.frustumCulled = false; shafts.renderOrder = 2;
  const shaftData = [];
  for (let i = 0; i < SHAFTS; i++) {
    const a = rand() * TAU, d = Math.sqrt(rand()) * (R - 2.5);
    shaftData.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, ph: rand() * TAU, s: 0.7 + rand() * 0.9 });
  }
  underOnly.add(shafts);

  // --- kelp and reeds: clumps of three tapered blades, swayed in the vertex shader ---
  const clump = new Bake();
  [[0, 0, 0, 1], [0.06, 0.04, 1.0, 0.8], [-0.05, 0.05, 2.1, 0.65]].forEach(([ox, oz, ry, hm]) => {
    const pl = new THREE.PlaneGeometry(1, 1, 1, 5);
    const pa = pl.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i) + 0.5;
      pa.setXYZ(i, pa.getX(i) * 0.09 * (1 - 0.8 * y), y * hm, 0);
    }
    clump.add(pl, 0xffffff, [ox, 0, oz], [0, ry, 0]);
  });
  const kelpGeo = keep(clump.build());
  const kelpMat = keep(new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader: KELP_VERT, fragmentShader: KELP_FRAG, side: THREE.DoubleSide, fog: true,
  }));
  kelpMat.uniforms.uTime = U.uTime;
  const KELP = 32;
  const kelp = new THREE.InstancedMesh(kelpGeo, kelpMat, KELP);
  kelp.frustumCulled = false;
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < KELP; i++) {
      const reed = i >= KELP - 7;
      const a = rand() * TAU, d = reed ? R - 0.7 - rand() * 0.8 : 3.8 + rand() * (R - 4.8);
      const h = reed ? 1.4 + rand() * 0.5 : 0.7 + rand() * 0.7;
      p.set(Math.cos(a) * d, BED, Math.sin(a) * d);
      q.setFromEuler(e.set(0, rand() * TAU, 0));
      const w = 0.8 + rand() * 0.6;
      s.set(w, h, w);
      kelp.setMatrixAt(i, m.compose(p, q, s));
    }
  }
  underOnly.add(kelp);

  // --- lily pads and flowers (visible from above too) ---
  const PADS = 16, FLOWERS = 3;
  const padGeo = keep(new THREE.CircleGeometry(0.5, 16, 0.3, TAU - 0.6));
  padGeo.rotateX(-Math.PI / 2);
  const padMesh = new THREE.InstancedMesh(padGeo, keep(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide })), PADS);
  const padData = [];
  {
    const col = new THREE.Color(), greens = [0x2f7a2e, 0x3d8a35, 0x276b30, 0x4a9a3a];
    let guard = 0;
    while (padData.length < PADS && guard++ < 400) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * (R - 1.0);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (z > 5.0 && Math.abs(x) < 2.8) continue;               // keep the dock end clear
      const s = 0.55 + rand() * 0.65;
      if (padData.some(o => Math.hypot(o.x - x, o.z - z) < (o.s + s) * 0.55)) continue;
      padData.push({ x, z, s, rot: rand() * TAU, ph: rand() * TAU });
    }
    padData.forEach((o, i) => padMesh.setColorAt(i, col.setHex(greens[i % greens.length])));
    padMesh.count = padData.length;
  }
  const petalGeo = keep(new THREE.SphereGeometry(0.1, 5, 3));
  petalGeo.scale(1, 0.3, 0.45); petalGeo.translate(0.1, 0, 0);
  const petalMesh = new THREE.InstancedMesh(petalGeo, keep(new THREE.MeshLambertMaterial({ color: 0xffffff })), FLOWERS * 6);
  const heartMesh = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(0.06, 6, 4)), keep(new THREE.MeshLambertMaterial({ color: 0xffd23a, emissive: 0x553300 })), FLOWERS);
  const flowers = [0, 1, 2].map(i => ({ pad: Math.min(padData.length - 1, 1 + i * 4) }));
  {
    const col = new THREE.Color(), cols = [0xff9ec7, 0xffffff, 0xffc2e0];
    flowers.forEach((f, i) => { for (let k = 0; k < 6; k++) petalMesh.setColorAt(i * 6 + k, col.setHex(cols[i])); });
  }
  padMesh.frustumCulled = false; petalMesh.frustumCulled = false; heartMesh.frustumCulled = false;
  root.add(padMesh, petalMesh, heartMesh);

  const dummy = new THREE.Object3D();
  function updatePads(t) {
    padData.forEach((o, i) => {
      dummy.position.set(o.x, SURF + 0.025 + Math.sin(t * 0.9 + o.ph) * 0.012, o.z);
      dummy.rotation.set(Math.sin(t * 0.7 + o.ph) * 0.03, o.rot + Math.sin(t * 0.15 + o.ph) * 0.15, Math.cos(t * 0.6 + o.ph) * 0.03);
      dummy.scale.setScalar(o.s);
      dummy.updateMatrix();
      padMesh.setMatrixAt(i, dummy.matrix);
    });
    padMesh.instanceMatrix.needsUpdate = true;
    flowers.forEach((f, i) => {
      const o = padData[f.pad]; if (!o) return;
      const y = SURF + 0.1 + Math.sin(t * 0.9 + o.ph) * 0.012;
      for (let k = 0; k < 6; k++) {
        dummy.position.set(o.x, y, o.z);
        dummy.rotation.set(0, k * TAU / 6 + o.rot, -0.35);
        dummy.scale.setScalar(1);
        dummy.updateMatrix(); petalMesh.setMatrixAt(i * 6 + k, dummy.matrix);
      }
      dummy.position.set(o.x, y + 0.025, o.z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      heartMesh.setMatrixAt(i, dummy.matrix);
    });
    petalMesh.instanceMatrix.needsUpdate = true; heartMesh.instanceMatrix.needsUpdate = true;
  }
  updatePads(0);

  // --- fish: 12 instanced, boids-lite; a comically large catfish ---
  const FN = 12;
  const fb = new Bake();
  fb.add(new THREE.SphereGeometry(1, 7, 5), 0xffffff, [0, 0, 0], [0, 0, 0], [0.17, 0.075, 0.05]);
  fb.add(new THREE.ConeGeometry(0.06, 0.12, 4), 0xffffff, [-0.21, 0, 0], [0, 0, -Math.PI / 2], [1.6, 1, 0.25]);
  fb.add(new THREE.ConeGeometry(0.03, 0.08, 3), 0xffffff, [-0.01, 0.075, 0], [0, 0, -Math.PI / 2], [1, 1, 0.3]);
  const fishMesh = new THREE.InstancedMesh(keep(fb.build()), keep(new THREE.MeshLambertMaterial({ color: 0xffffff })), FN);
  fishMesh.frustumCulled = false;
  const fp = new Float32Array(FN * 3), fv = new Float32Array(FN * 3), fsz = new Float32Array(FN), fph = new Float32Array(FN);
  {
    const col = new THREE.Color(), cols = [0xff8a2a, 0xcfd8dc, 0xffd23a, 0x7fb8e8, 0xff8a2a, 0xe8eef0];
    for (let i = 0; i < FN; i++) {
      const a = rand() * TAU, d = rand() * (R - 2.5);
      fp[i * 3] = Math.cos(a) * d; fp[i * 3 + 1] = POND.BOTTOM + 0.3 + rand() * 0.55; fp[i * 3 + 2] = Math.sin(a) * d;
      const h = rand() * TAU; fv[i * 3] = Math.cos(h) * 0.5; fv[i * 3 + 2] = Math.sin(h) * 0.5;
      fsz[i] = 0.8 + rand() * 0.6; fph[i] = rand() * TAU;
      fishMesh.setColorAt(i, col.setHex(cols[i % cols.length]));
    }
  }
  root.add(fishMesh);

  const cb = new Bake();
  cb.add(new THREE.SphereGeometry(1, 10, 7), 0x5b5a48, [0, 0, 0], [0, 0, 0], [1.1, 0.28, 0.38]);
  cb.add(new THREE.SphereGeometry(1, 8, 6), 0x4a4a3a, [0.95, -0.03, 0], [0, 0, 0], [0.5, 0.2, 0.46]);
  cb.add(new THREE.SphereGeometry(1, 7, 5), 0xc9c4a0, [0.2, -0.17, 0], [0, 0, 0], [0.8, 0.15, 0.3]);
  cb.add(new THREE.ConeGeometry(0.28, 0.7, 5), 0x4f4e3f, [-1.4, 0, 0], [0, 0, -Math.PI / 2], [1.1, 1, 0.22]);
  cb.add(new THREE.ConeGeometry(0.1, 0.5, 4), 0x4f4e3f, [-0.1, 0.34, 0], [0, 0, -Math.PI / 2 + 0.3], [1.2, 1, 0.25]);
  for (const sz of [-1, 1]) {
    cb.add(new THREE.SphereGeometry(0.05, 6, 4), 0xf1eed0, [1.15, 0.12, sz * 0.26]);
    for (let k = 0; k < 2; k++) {
      const wg = new THREE.CylinderGeometry(0.012, 0.004, 0.8, 4); wg.translate(0, 0.4, 0);
      cb.add(wg, 0x2e2e24, [1.3, -0.03 - k * 0.04, sz * (0.2 + k * 0.1)], [0, sz * (0.45 + k * 0.5), -Math.PI / 2 + k * 0.12]);
    }
  }
  const catfish = new THREE.Mesh(keep(cb.build()), keep(new THREE.MeshLambertMaterial({ vertexColors: true })));
  catfish.frustumCulled = false;
  root.add(catfish);
  const catLook = new THREE.Vector3();
  let catAng = rand() * TAU;

  function stepFish(dt, t, flee, cx, cy, cz) {
    let mx = 0, my = 0, mz = 0, vx = 0, vy = 0, vz = 0;
    for (let i = 0; i < FN; i++) {
      mx += fp[i * 3]; my += fp[i * 3 + 1]; mz += fp[i * 3 + 2]; vx += fv[i * 3]; vy += fv[i * 3 + 1]; vz += fv[i * 3 + 2];
    }
    const lim = R - 0.9, ymin = POND.BOTTOM + 0.2, ymax = -0.25;
    for (let i = 0; i < FN; i++) {
      const o = i * 3, px = fp[o], py = fp[o + 1], pz = fp[o + 2];
      let ax = ((mx - px) / (FN - 1) - px) * 0.3 + ((vx - fv[o]) / (FN - 1) - fv[o]) * 0.5;
      let ay = ((my - py) / (FN - 1) - py) * 0.3 + ((vy - fv[o + 1]) / (FN - 1) - fv[o + 1]) * 0.5;
      let az = ((mz - pz) / (FN - 1) - pz) * 0.3 + ((vz - fv[o + 2]) / (FN - 1) - fv[o + 2]) * 0.5;
      for (let j = 0; j < FN; j++) {
        if (j === i) continue;
        const dx = px - fp[j * 3], dy = py - fp[j * 3 + 1], dz = pz - fp[j * 3 + 2], d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.3) { const k = 0.25 / (d2 + 0.05); ax += dx * k; ay += dy * k; az += dz * k; }
      }
      ax += Math.sin(t * 0.7 + fph[i] * 3.1) * 0.6; az += Math.cos(t * 0.9 + fph[i] * 1.7) * 0.6; ay += Math.sin(t * 0.5 + fph[i]) * 0.25;
      const rr = Math.hypot(px, pz);
      if (rr > lim) { ax -= px / rr * (rr - lim) * 6; az -= pz / rr * (rr - lim) * 6; }
      if (py < ymin) ay += (ymin - py) * 6; else if (py > ymax) ay -= (py - ymax) * 6;
      let fast = 0;
      if (flee) {
        const dx = px - cx, dy = py - cy, dz = pz - cz, d = Math.hypot(dx, dy, dz);
        if (d < 3.2 && d > 0.01) { const k = (3.2 - d) * 4 / d; ax += dx * k; ay += dy * k; az += dz * k; fast = 1; }
      }
      fv[o] += ax * dt; fv[o + 1] += ay * dt; fv[o + 2] += az * dt;
      const sp = Math.hypot(fv[o], fv[o + 1], fv[o + 2]) || 1e-4, vmax = fast ? 2.1 : 0.85, vmin = 0.3;
      const k = (sp > vmax ? vmax : sp < vmin ? vmin : sp) / sp;
      fv[o] *= k; fv[o + 1] *= k; fv[o + 2] *= k;
      fp[o] += fv[o] * dt; fp[o + 1] += fv[o + 1] * dt; fp[o + 2] += fv[o + 2] * dt;
      const hs = Math.hypot(fv[o], fv[o + 2]);
      dummy.position.set(fp[o], fp[o + 1], fp[o + 2]);
      dummy.rotation.set(0, Math.atan2(-fv[o + 2], fv[o]) + Math.sin(t * (fast ? 16 : 8) + fph[i]) * 0.18, Math.atan2(fv[o + 1], hs));
      dummy.scale.setScalar(fsz[i]);
      dummy.updateMatrix();
      fishMesh.setMatrixAt(i, dummy.matrix);
    }
    fishMesh.instanceMatrix.needsUpdate = true;
  }
  function stepCat(dt, t) {
    catAng += dt * 0.17;
    const rad = 4.3 + Math.sin(t * 0.11) * 1.3;
    const x = Math.cos(catAng) * rad, z = Math.sin(catAng) * rad;
    const vx = -Math.sin(catAng) * rad, vz = Math.cos(catAng) * rad;
    catfish.position.set(x, POND.BOTTOM + 0.3 + Math.sin(t * 0.4) * 0.05, z);
    catfish.rotation.set(Math.sin(t * 0.9) * 0.03, Math.atan2(-vz, vx) + Math.sin(t * 1.3) * 0.08, Math.sin(t * 0.6) * 0.03);
    catLook.copy(catfish.position);
  }

  // --- lost and found: one merged draw, plus a gold trophy ---
  const junk = new Bake(), gold = new Bake();
  const baseAt = (x, y, z, yaw, roll, pitch) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch || 0, yaw || 0, roll || 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const spots = [];
  for (let i = 0; i < 8; i++) {
    const a = i * 2.399 + rand() * 0.6, d = 1.6 + rand() * (R - 3.4);
    spots.push([Math.cos(a) * d, Math.sin(a) * d]);
  }
  const Y0 = BED_TOP;
  { // shopping cart, toppled
    const b = baseAt(spots[0][0], Y0 + 0.28, spots[0][1], 0.8, 0.9, 0.1), c = 0x9aa0a6;
    junk.add(new THREE.BoxGeometry(0.7, 0.02, 0.45), c, [0, 0, 0], null, null, b);
    junk.add(new THREE.BoxGeometry(0.7, 0.35, 0.02), c, [0, 0.17, 0.22], null, null, b);
    junk.add(new THREE.BoxGeometry(0.7, 0.35, 0.02), c, [0, 0.17, -0.22], null, null, b);
    junk.add(new THREE.BoxGeometry(0.02, 0.35, 0.45), c, [-0.35, 0.17, 0], null, null, b);
    junk.add(new THREE.BoxGeometry(0.04, 0.04, 0.5), 0xc23b2e, [0.4, 0.4, 0], null, null, b);
    junk.add(new THREE.BoxGeometry(0.7, 0.03, 0.45), 0x666b70, [0, -0.2, 0], null, null, b);
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.18, 0.18])
      junk.add(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), 0x222222, [sx, -0.27, sz], [Math.PI / 2, 0, 0], null, b);
  }
  { // golf club
    const b = baseAt(spots[1][0], Y0 + 0.03, spots[1][1], 2.2, 0.0, 0);
    const sh = new THREE.CylinderGeometry(0.012, 0.016, 1.1, 6);
    junk.add(sh, 0xc4c8cc, [0, 0, 0], [0, 0, Math.PI / 2], null, b);
    junk.add(new THREE.CylinderGeometry(0.022, 0.02, 0.28, 6), 0x1b1b1b, [0.5, 0, 0], [0, 0, Math.PI / 2], null, b);
    junk.add(new THREE.BoxGeometry(0.12, 0.05, 0.09), 0x8e949a, [-0.58, 0.01, 0.04], [0, 0.2, 0], null, b);
  }
  { // traffic cone
    const b = baseAt(spots[2][0], Y0 + 0.17, spots[2][1], 0.4, 1.35, 0);
    junk.add(new THREE.ConeGeometry(0.17, 0.5, 8), 0xff6a1a, [0, 0.0, 0], null, null, b);
    junk.add(new THREE.CylinderGeometry(0.09, 0.1, 0.07, 8), 0xf2f2f2, [0, 0.03, 0], null, null, b);
    junk.add(new THREE.BoxGeometry(0.4, 0.03, 0.4), 0x2a2a2a, [0, -0.26, 0], null, null, b);
  }
  { // tyre
    const b = baseAt(spots[3][0], Y0 + 0.2, spots[3][1], 1.1, 0.0, 1.2);
    junk.add(new THREE.TorusGeometry(0.3, 0.11, 7, 14), 0x1d1d1d, [0, 0, 0], null, null, b);
    junk.add(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10), 0x777b7f, [0, 0, 0], [Math.PI / 2, 0, 0], null, b);
  }
  // trophy: gold with a glow (emissive material, no real light); wooden base joins the junk draw
  const TB = baseAt(spots[4][0] * 0.7, Y0, spots[4][1] * 0.7, 0.6, 0.12, 0.05);
  junk.add(new THREE.BoxGeometry(0.34, 0.1, 0.26), 0x4a2f18, [0, 0.05, 0], null, null, TB);
  gold.add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), 0xffffff, [0, 0.115, 0], null, null, TB);
  gold.add(new THREE.CylinderGeometry(0.02, 0.03, 0.16, 8), 0xffd24a, [0, 0.2, 0], null, null, TB);
  gold.add(new THREE.CylinderGeometry(0.13, 0.05, 0.22, 10, 1, true), 0xffd24a, [0, 0.38, 0], null, null, TB);
  gold.add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), 0xffd24a, [0, 0.27, 0], null, null, TB);
  for (const sx of [-1, 1]) gold.add(new THREE.TorusGeometry(0.06, 0.015, 5, 8, Math.PI), 0xffe27a, [sx * 0.14, 0.4, 0], [0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2], null, TB);
  { // sunglasses
    const b = baseAt(spots[5][0], Y0 + 0.02, spots[5][1], 0.5, 0, 0);
    for (const sx of [-0.075, 0.075]) {
      junk.add(new THREE.TorusGeometry(0.06, 0.012, 5, 10), 0x111111, [sx, 0, 0], [Math.PI / 2, 0, 0], null, b);
      junk.add(new THREE.CylinderGeometry(0.055, 0.055, 0.008, 10), 0x1a2a4a, [sx, 0, 0], null, null, b);
      junk.add(new THREE.BoxGeometry(0.01, 0.01, 0.18), 0x111111, [sx * 1.9, 0.01, -0.09], null, null, b);
    }
    junk.add(new THREE.BoxGeometry(0.05, 0.012, 0.012), 0x111111, [0, 0, 0], null, null, b);
  }
  { // boot
    const b = baseAt(spots[6][0], Y0 + 0.13, spots[6][1], 3.5, 1.35, 0), c = 0x6b4423;
    junk.add(new THREE.BoxGeometry(0.14, 0.32, 0.14), c, [0, 0.12, 0], null, null, b);
    junk.add(new THREE.BoxGeometry(0.3, 0.1, 0.15), c, [0.09, -0.07, 0], null, null, b);
    junk.add(new THREE.BoxGeometry(0.32, 0.03, 0.16), 0x24180d, [0.09, -0.13, 0], null, null, b);
  }
  { // rubber duck
    const b = baseAt(spots[7][0], Y0 + 0.07, spots[7][1], 4.1, 0.2, 0);
    junk.add(new THREE.SphereGeometry(0.1, 8, 6), 0xffdc2e, [0, 0, 0], null, [1.2, 0.85, 0.9], b);
    junk.add(new THREE.SphereGeometry(0.06, 8, 6), 0xffdc2e, [0.1, 0.11, 0], null, null, b);
    junk.add(new THREE.ConeGeometry(0.03, 0.06, 5), 0xff8a1a, [0.18, 0.11, 0], [0, 0, -Math.PI / 2], null, b);
  }
  const junkMesh = new THREE.Mesh(keep(junk.build()), keep(new THREE.MeshLambertMaterial({ vertexColors: true })));
  const goldMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xb07a10, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
  const goldMesh = new THREE.Mesh(keep(gold.build()), goldMat);
  underOnly.add(junkMesh, goldMesh);
  const trophyPos = new THREE.Vector3(POND.x + spots[4][0] * 0.7, BED_TOP + 0.3, POND.z + spots[4][1] * 0.7);
  { // the plaque: "1987 Club Champion" (canvas texture; skipped if there is no DOM)
    let map = null;
    if (typeof document !== 'undefined') {
      const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
      const g = cv.getContext('2d');
      if (g) {
        g.fillStyle = '#c9a23a'; g.fillRect(0, 0, 256, 64);
        g.strokeStyle = '#6b4d10'; g.lineWidth = 3; g.strokeRect(3, 3, 250, 58);
        g.fillStyle = '#3a2806'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = 'bold 22px serif'; g.fillText('1987', 128, 20);
        g.font = 'bold 20px serif'; g.fillText('CLUB CHAMPION', 128, 44);
        map = new THREE.CanvasTexture(cv); map.colorSpace = THREE.SRGBColorSpace;
      }
    }
    const plaque = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.3, 0.075)),
      keep(new THREE.MeshBasicMaterial({ color: map ? 0xbbbbbb : 0xc9a23a, map })));
    plaque.matrixAutoUpdate = false;
    plaque.matrix.copy(TB).multiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0.132));
    underOnly.add(plaque);
    if (map) keep(map);
  }

  // --- air hose from the dock ---
  const hoseAt = { x: POND.DOCK.x - POND.x, z: POND.DOCK.z - 1 - POND.z };
  {
    const hl = Math.hypot(hoseAt.x, hoseAt.z), cap = R - 0.9;   // the hose end must be in the water
    if (hl > cap) { hoseAt.x *= cap / hl; hoseAt.z *= cap / hl; }
  }
  {
    const pts = [
      new THREE.Vector3(hoseAt.x, 0.28, hoseAt.z + 1.6), new THREE.Vector3(hoseAt.x, 0.1, hoseAt.z + 0.7),
      new THREE.Vector3(hoseAt.x + 0.1, -0.5, hoseAt.z + 0.25), new THREE.Vector3(hoseAt.x, BED_TOP + 0.06, hoseAt.z),
    ];
    const hose = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 14, 0.035, 6)),
      keep(new THREE.MeshLambertMaterial({ color: 0xe8c32a })));
    underOnly.add(hose);
  }

  // --- particles: silt motes (GPU drift) and a pooled bubble system ---
  const scaleU = { value: 800 };
  const MOTES = 220;
  const moteGeo = keep(new THREE.BufferGeometry());
  {
    const P = new Float32Array(MOTES * 3), S = new Float32Array(MOTES), A = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * (R - 0.4);
      P[i * 3] = Math.cos(a) * d; P[i * 3 + 1] = POND.BOTTOM + 0.1 + rand() * 0.9; P[i * 3 + 2] = Math.sin(a) * d;
      S[i] = 0.012 + rand() * 0.025; A[i] = rand();
    }
    moteGeo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    moteGeo.setAttribute('aSize', new THREE.BufferAttribute(S, 1));
    moteGeo.setAttribute('aAlpha', new THREE.BufferAttribute(A, 1));
  }
  const motes = new THREE.Points(moteGeo, keep(new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uScale: scaleU }, defines: { MOTE: 1 },
    vertexShader: POINT_VERT, fragmentShader: MOTE_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  })));
  motes.frustumCulled = false;
  underOnly.add(motes);

  const NB = 240;
  const bubGeo = keep(new THREE.BufferGeometry());
  const bP = new Float32Array(NB * 3), bS = new Float32Array(NB), bA = new Float32Array(NB);
  const bVy = new Float32Array(NB), bPh = new Float32Array(NB), bWob = new Float32Array(NB), bAge = new Float32Array(NB), bOn = new Uint8Array(NB);
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bP, 3));
  bubGeo.setAttribute('aSize', new THREE.BufferAttribute(bS, 1));
  bubGeo.setAttribute('aAlpha', new THREE.BufferAttribute(bA, 1));
  bubGeo.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
  const bubbles = new THREE.Points(bubGeo, keep(new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uScale: scaleU },
    vertexShader: POINT_VERT, fragmentShader: BUBBLE_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  })));
  bubbles.frustumCulled = false;
  underOnly.add(bubbles);
  let bCursor = 0, mouthAcc = 0, pumpAcc = 0;
  function spawn(x, y, z, size, vy, wob) {
    for (let k = 0; k < NB; k++) {
      const i = (bCursor + k) % NB;
      if (bOn[i]) continue;
      bCursor = i + 1; bOn[i] = 1;
      bP[i * 3] = x; bP[i * 3 + 1] = y; bP[i * 3 + 2] = z;
      bS[i] = size; bA[i] = 1; bVy[i] = vy; bPh[i] = Math.random() * TAU; bWob[i] = wob; bAge[i] = 0;
      return;
    }
  }
  function stepBubbles(dt, t) {
    for (let i = 0; i < NB; i++) {
      if (!bOn[i]) continue;
      bAge[i] += dt;
      bP[i * 3 + 1] += bVy[i] * dt;
      bP[i * 3] += Math.sin(t * 5 + bPh[i]) * bWob[i] * dt;
      bP[i * 3 + 2] += Math.cos(t * 4.3 + bPh[i]) * bWob[i] * dt;
      bS[i] *= 1 + 0.25 * dt;
      if (bP[i * 3 + 1] > SURF - 0.02) { bOn[i] = 0; bA[i] = 0; bP[i * 3 + 1] = -50; }
    }
    bubGeo.attributes.position.needsUpdate = true; bubGeo.attributes.aSize.needsUpdate = true; bubGeo.attributes.aAlpha.needsUpdate = true;
  }

  // --- the surface from below ---
  const surfMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime }, vertexShader: SURF_VERT, fragmentShader: SURF_FRAG,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  }));
  const surf = new THREE.Mesh(keep(new THREE.CircleGeometry(R, 48)), surfMat);
  surf.rotation.x = -Math.PI / 2; surf.position.y = SURF - 0.02; surf.renderOrder = 3; surf.frustumCulled = false;
  underOnly.add(surf);

  // --- the low-air vignette (one lazily created DOM node) ---
  function ensureVignette() {
    if (vignette || typeof document === 'undefined') return vignette;
    vignette = document.getElementById('scuba-vignette');
    if (!vignette) {
      vignette = document.createElement('div');
      vignette.id = 'scuba-vignette';
      vignette.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:30;opacity:0;display:none;' +
        'background:radial-gradient(ellipse at center, rgba(160,0,0,0) 38%, rgba(190,10,10,0.55) 80%, rgba(120,0,0,0.9) 100%);';
      document.body.appendChild(vignette);
    }
    return vignette;
  }
  function setVignette(op) {
    if (op <= 0.001 && !vignette) return;
    const el = ensureVignette(); if (!el) return;
    if (Math.abs(op - vigOp) < 0.01) return;
    vigOp = op;
    el.style.opacity = String(op);
    el.style.display = op > 0.001 ? 'block' : 'none';
  }

  // --- public API ---
  function setUnder(v) {
    under = !!v;
    underOnly.visible = under;
    bedMat.uniforms.uAmt.value = under ? 1.0 : 0.22;
    if (!under) setVignette(0);
  }

  const cdir = new THREE.Vector3();
  function tick(dt, t, state) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    clock += dt;
    const T = typeof t === 'number' ? t : clock;
    const s = state || {};
    const air01 = s.air01 ?? 1, dp = s.depthPos && typeof s.depthPos === 'object' ? s.depthPos : null;
    const cx = (dp?.x ?? camera.position.x) - POND.x, cy = dp?.y ?? camera.position.y, cz = (dp?.z ?? camera.position.z) - POND.z;
    // From the shore and far away there is nothing to animate.
    if (!under && Math.hypot(cx, cz) > R + 70) return;
    U.uTime.value = T;
    if (typeof innerHeight === 'number') scaleU.value = innerHeight * 0.85;

    padTimer += dt;
    if (padTimer > 0.066) { padTimer = 0; updatePads(T); }
    stepFish(dt, T, under, cx, cy, cz);
    stepCat(dt, T);
    if (!under) return;

    // shafts sway slowly
    const e = new THREE.Euler(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), m = new THREE.Matrix4();
    for (let i = 0; i < SHAFTS; i++) {
      const d = shaftData[i];
      e.set(Math.sin(T * 0.21 + d.ph) * 0.07, 0, 0.2 + Math.sin(T * 0.17 + d.ph * 2) * 0.08);
      q.setFromEuler(e); p.set(d.x, SURF, d.z); sc.set(d.s, 1, d.s);
      shafts.setMatrixAt(i, m.compose(p, q, sc));
    }
    shafts.instanceMatrix.needsUpdate = true;

    goldMat.emissiveIntensity = 0.75 + 0.25 * Math.sin(T * 1.7);

    // bubbles: calm breathing, panic below 30% air, and the pump column
    camera.getWorldDirection(cdir);
    const mx = cx + cdir.x * 0.38, my = cy - 0.16 + cdir.y * 0.38, mz = cz + cdir.z * 0.38;
    const panic = air01 < 0.3 ? (0.3 - Math.max(air01, 0)) / 0.3 : 0;
    mouthAcc += (0.9 + panic * 16) * dt;
    while (mouthAcc >= 1) {
      mouthAcc -= 1;
      const r = Math.random();
      spawn(mx + (r - 0.5) * 0.08, my, mz + (Math.random() - 0.5) * 0.08, 0.012 + Math.random() * (0.014 + panic * 0.02), 0.4 + Math.random() * 0.3, 0.05 + panic * 0.12);
    }
    if (s.pumping) {
      pumpAcc += 42 * dt;
      while (pumpAcc >= 1) {
        pumpAcc -= 1;
        spawn(hoseAt.x + (Math.random() - 0.5) * 0.3, BED_TOP + 0.05, hoseAt.z + (Math.random() - 0.5) * 0.3,
          0.03 + Math.random() * 0.06, 0.8 + Math.random() * 0.8, 0.15);
      }
    } else pumpAcc = 0;
    stepBubbles(dt, T);

    // low air: pulsing red edge
    if (air01 < 0.25) {
      const k = (0.25 - Math.max(air01, 0)) / 0.25;
      setVignette(Math.min(1, (0.35 + 0.65 * k) * (0.6 + 0.4 * Math.sin(T * (5 + k * 8)))));
    } else setVignette(0);
  }

  function dispose() {
    scene.remove(root);
    for (const o of disposables) o.dispose?.();
    padMesh.dispose(); petalMesh.dispose(); heartMesh.dispose(); fishMesh.dispose(); kelp.dispose(); shafts.dispose();
    vignette?.remove(); vignette = null;
  }

  setUnder(false);
  return { setUnder, tick, dispose, group: root, trophyPos };
}
