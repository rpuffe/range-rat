// Range Rat: the pond, properly. Caustics, god rays, kelp, lily pads, fish, a very large catfish,
// lost-and-found junk, silt, bubbles, an air hose, a shimmering underside to the surface and a
// panic vignette. Everything is instanced / merged: roughly 16 draw calls while diving, and only
// the lily pads, faint caustics, fish and catfish draw from the shore.
//
//   const scuba = createScuba(scene, camera, POND, { mode: 'pond', onPing });
//   scuba.attach({ water: pondWater, bed: pondBed });  // once: carves the Deep End, tints the water
//   scuba.setUnder(true|false);                       // when scene.userData.under flips
//   scuba.tick(dt, t, { air01, pumping, pumpRate, clarity, glintR, mine });   // once per frame
//   scuba.setFound(ids); scuba.setTreasure(id, x, z); scuba.plunge(x, z, mine); scuba.surface(x, z, { bag, mine });
//   scuba.ping(x, z); scuba.placeCase(x, z, yaw); scuba.setMode('pond' | 'eva');
// (see the block above "public API" for what each does and when to call it)
//
// No top-level side effects: everything is built inside createScuba().

import * as THREE from 'three';
import { tagSign } from './signs.js';
import { POND_DEEP, bedAt, deepness, deepDist, TREASURE, TREASURE_BY_ID, waterLook } from './dive.js';

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
  mood = (0.7 + 0.3 * sin(vW.x * 0.35 + t) * sin(vW.z * 0.4 - t * 0.8)) * (0.25 + 0.75 * smoothstep(-4.4, -1.3, vW.y));
#endif
  vec2 w = vec2(sin(p.y * 1.3 + t) * 0.25, sin(p.y * 0.9 - t) * 0.2);
  float a = cell(p + w, t, uPer);
  float b = cell(p * 2.0 + vec2(7.0, 3.0) + w, t * 1.3 + 2.0, uPer * 2.0);
  float la = 1.0 - smoothstep(0.0, 0.07, a);
  float lb = 1.0 - smoothstep(0.0, 0.09, b);
  float c = pow(la, 1.8) + 0.45 * pow(lb, 1.8);
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
uniform float uTime; uniform float uClar;
varying vec3 vN; varying vec3 vV; varying float vUy; varying float vK;
void main(){
  float face = abs(dot(normalize(vN), normalize(vV)));
  float a = pow(face, 1.6) * (0.2 + 0.8 * vUy) * smoothstep(0.0, 0.25, vUy);
  a *= 0.7 + 0.3 * sin(uTime * 0.8 + vK * 20.0 + vUy * 3.0);
  gl_FragColor = vec4(vec3(0.55, 1.0, 0.8) * a * 0.22 * (0.25 + 0.75 * uClar), 1.0);
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
uniform float uTime; uniform vec3 uTint; uniform float uClar;
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
  col = mix(uTint * 0.9, col, 0.35 + 0.65 * uClar);
  float a = mix(0.85, 0.42 + 0.3 * (1.0 - uClar), window) + sh * 0.15 * uClar;
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
#elif defined(DROP)
  vA = aAlpha * (1.0 - smoothstep(30.0, 55.0, d));
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

const DROP_FRAG = `
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  if (r > 1.0) discard;
  float a = (1.0 - r * r) * vA;
  gl_FragColor = vec4(mix(vec3(0.6, 0.85, 1.0), vec3(1.0), 1.0 - r), a);
}`;

// Treasure glints: twinkling gold four-point stars that only show inside the diver's glint range
// (6 m, 8 m with the light). Not fogged on purpose: they are what you see in the dark.
const GLINT_VERT = `
attribute float aSize; attribute float aPh;
uniform float uScale; uniform float uTime; uniform float uR; uniform float uGlow;
varying float vA;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(-mv.z, 0.1);
  float tw = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uTime * 2.6 + aPh * 6.2831), 3.0);
  gl_PointSize = clamp(aSize * uScale / d * (0.6 + tw) * (1.0 + uGlow), 3.0, 120.0);
  vA = tw * (1.0 - smoothstep(uR - 1.5, uR, d)) * (0.55 + 0.45 * uGlow);
}`;
const GLINT_FRAG = `
varying float vA;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float r = length(c) * 2.0;
  float core = pow(max(0.0, 1.0 - r), 2.0);
  float cross = max(exp(-abs(c.x) * 34.0) * (1.0 - smoothstep(0.0, 0.5, abs(c.y))),
                    exp(-abs(c.y) * 34.0) * (1.0 - smoothstep(0.0, 0.5, abs(c.x))));
  float a = (core + cross * 0.9) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(1.0, 0.86, 0.42) * a, a);
}`;

// ---------- the module ----------

const WATER_FOG0 = 0x1f6a5e;
const PIT_CLEAR = 0.6;   // keep kelp and shelf junk this many metres clear of the Deep End's lip

export function createScuba(scene, camera, POND, opts = {}) {
  const rand = seeded(opts.seed ?? 1987);
  let mode = opts.mode === 'eva' ? 'eva' : 'pond';   // 'eva': the Orbital reuse (palette swap; stub)
  const onPing = typeof opts.onPing === 'function' ? opts.onPing : null;
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
  const U = { uTime: { value: 0 }, uClar: { value: 1 } };
  const PX = POND.x, PZ = POND.z;
  const pitLocal = { x: POND_DEEP.x - PX, z: POND_DEEP.z - PZ };
  const nearPit = (x, z, m = PIT_CLEAR) => Math.hypot(x - pitLocal.x, z - pitLocal.z) < POND_DEEP.r + m;
  const bedY = (lx, lz) => bedAt(lx + PX, lz + PZ) - 0.04;     // resting height of an item at pond-local (lx, lz)
  let under = false, clock = 0, vignette = null, vigOp = -1, padTimer = 0;

  // --- caustics (bed: always, faint from above; wall: only underwater) ---
  const causticMat = (wall) => keep(new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uAmt: { value: wall ? 0.28 : 0.18 }, uColor: { value: new THREE.Color(0.45, 0.95, 0.8) },
      uC: { value: new THREE.Vector2(POND.x, POND.z) }, uPer: { value: wall ? 40 : 0 },
    },
    defines: wall ? { WALL: 1 } : {},
    vertexShader: CAUSTIC_VERT, fragmentShader: CAUSTIC_FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: wall ? THREE.BackSide : THREE.FrontSide,
  }));
  const bedMat = causticMat(false);

  // --- the bed as a heightfield: the shelf at -1.1 with the Deep End sinkhole (dive.js bedAt) ---
  // A polar grid, pond-local XZ plus a skirt that closes the sinkhole where it runs into the wall.
  // `world` bakes pond-centre offsets in (for carving the main.js bed mesh); `colors` adds the silt tint.
  function bedGeometry({ lift = 0, world = false, colors = false, radius = R }) {
    const SEG = 96, RINGS = 64, pos = [], col = [], idx = [];
    const ox = world ? PX : 0, oz = world ? PZ : 0, c = new THREE.Color(), base = new THREE.Color(0x3b3322), dark = new THREE.Color(0x15110a);
    const h = (lx, lz) => bedAt(lx + PX, lz + PZ) - 0.06 + lift;
    for (let i = 0; i <= RINGS; i++) {
      const r = radius * (i / RINGS);
      for (let j = 0; j <= SEG; j++) {
        const a = (j % SEG) / SEG * TAU, lx = Math.cos(a) * r, lz = Math.sin(a) * r;
        pos.push(lx + ox, h(lx, lz), lz + oz);
        if (colors) {
          const dn = deepness(lx + PX, lz + PZ), n = 0.82 + 0.3 * (Math.sin(lx * 3.1 + lz * 1.7) * Math.sin(lz * 2.3 - lx * 0.9) * 0.5 + 0.5);
          c.copy(base).multiplyScalar(n).lerp(dark, dn * 0.8);
          col.push(c.r, c.g, c.b);
        }
      }
    }
    for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEG; j++) {
      const a = i * (SEG + 1) + j, b = a + SEG + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
    // skirt: a vertical strip at the wall from the edge height up to the shelf (zero-area where there is no pit)
    const top = POND_DEEP.SHELF - 0.06 + lift, s0 = pos.length / 3;
    for (let j = 0; j <= SEG; j++) {
      const a = (j % SEG) / SEG * TAU, lx = Math.cos(a) * radius, lz = Math.sin(a) * radius;
      pos.push(lx + ox, h(lx, lz), lz + oz, lx + ox, top, lz + oz);
      if (colors) { col.push(dark.r, dark.g, dark.b, base.r * 0.8, base.g * 0.8, base.b * 0.8); }
    }
    for (let j = 0; j < SEG; j++) { const a = s0 + j * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
  const bedCaustics = new THREE.Mesh(keep(bedGeometry({ lift: 0.08, radius: R - 0.05 })), bedMat);
  bedCaustics.renderOrder = 1; bedCaustics.frustumCulled = false;
  root.add(bedCaustics);

  // main.js's flat pond bed hides the sinkhole, so swap its geometry for the carved one (and
  // remember the water plane so its colour can follow Pond Clarity). Called automatically if the
  // meshes can be found in the scene; call attach({ water, bed }) to be explicit.
  let waterMesh = null, bedMesh = null, tintClar = -1;
  function attach({ water, bed } = {}) {
    if (water) { waterMesh = water; tintClar = -1; }
    if (bed && bed !== bedMesh) {
      bedMesh = bed;
      bed.updateMatrixWorld(true);
      const g = bedGeometry({ world: true, colors: true });
      g.applyMatrix4(new THREE.Matrix4().copy(bed.matrixWorld).invert());
      bed.geometry.dispose(); bed.geometry = g;
      bed.material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      disposables.push(g, bed.material);
    }
  }
  {
    let w = null, b = null;
    scene.traverse(o => {
      if (!o.isMesh || o.geometry?.type !== 'CircleGeometry' || Math.hypot(o.position.x - PX, o.position.z - PZ) > 0.01) return;
      if (Math.abs(o.position.y - (POND.BOTTOM - 0.06)) < 0.01) b = o; else if (Math.abs(o.position.y - 0.03) < 0.01) w = o;
    });
    if (w || b) attach({ water: w, bed: b });
  }
  const wallCaustics = new THREE.Mesh(keep(new THREE.CylinderGeometry(R - 0.05, R - 0.05, 1.1, 48, 1, true)), causticMat(true));
  wallCaustics.position.y = -0.6; wallCaustics.renderOrder = 1; wallCaustics.frustumCulled = false;
  underOnly.add(wallCaustics);

  // --- light shafts: 6 soft cones from the surface, one instanced draw ---
  const SHAFTS = 6;
  const shaftMat = keep(new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uClar: U.uClar }, vertexShader: SHAFT_VERT, fragmentShader: SHAFT_FRAG,
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
      let a = rand() * TAU, d = reed ? R - 0.7 - rand() * 0.8 : 3.8 + rand() * (R - 4.8);
      for (let g = 0; g < 12 && nearPit(Math.cos(a) * d, Math.sin(a) * d, 0.4); g++) { a = rand() * TAU; d = reed ? R - 0.7 - rand() * 0.8 : 3.8 + rand() * (R - 4.8); }
      const h = reed ? 1.4 + rand() * 0.5 : 0.7 + rand() * 0.7;
      p.set(Math.cos(a) * d, bedY(Math.cos(a) * d, Math.sin(a) * d) - 0.02, Math.sin(a) * d);
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
      if (nearPit(x, z, 0)) continue;
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
      { // the catfish scatters the shoal as it passes
        const dx = px - catfish.position.x, dy = py - catfish.position.y, dz = pz - catfish.position.z, d = Math.hypot(dx, dy, dz);
        if (d < 2.4 && d > 0.01) { const k = (2.4 - d) * 3 / d; ax += dx * k; ay += dy * k; az += dz * k; fast = 1; }
      }
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
    // The catfish circles the Deep End (it has no name; it is not golf's), rising to the shelf now and then.
    catAng += dt * 0.2;
    const rad = 1.45 + Math.sin(t * 0.11) * 0.4;
    const x = pitLocal.x * 0.95 + Math.cos(catAng) * rad, z = pitLocal.z * 0.95 + Math.sin(catAng) * rad;
    const vx = -Math.sin(catAng) * rad, vz = Math.cos(catAng) * rad;
    catfish.position.set(x, POND_DEEP.FLOOR + 1.1 + Math.sin(t * 0.4) * 0.25 + (Math.sin(t * 0.05) * 0.5 + 0.5) * 1.0, z);
    catfish.rotation.set(Math.sin(t * 0.9) * 0.03, Math.atan2(-vz, vx) + Math.sin(t * 1.3) * 0.08, Math.sin(t * 0.6) * 0.03);
    catLook.copy(catfish.position);
  }

  // --- lost and found: the 12 treasures (dive.js TREASURE) plus a toppled shopping cart ---
  // Each item is built once as merged vertex-coloured geometry (+ a gold part with a glow) lying at
  // the origin, then instanced as Groups: on the shelf (the old set dressing, hidden once found),
  // glinting in the Deep End (the active treasure), and in the Lost & Found glass case.
  const baseAt = (x, y, z, yaw, roll, pitch) => new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch || 0, yaw || 0, roll || 0, 'YXZ')), new THREE.Vector3(1, 1, 1));
  const ITEM = {
    cart(j) {
      const b = baseAt(0, 0.28, 0, 0.8, 0.9, 0.1), c = 0x9aa0a6;
      j.add(new THREE.BoxGeometry(0.7, 0.02, 0.45), c, [0, 0, 0], null, null, b);
      j.add(new THREE.BoxGeometry(0.7, 0.35, 0.02), c, [0, 0.17, 0.22], null, null, b);
      j.add(new THREE.BoxGeometry(0.7, 0.35, 0.02), c, [0, 0.17, -0.22], null, null, b);
      j.add(new THREE.BoxGeometry(0.02, 0.35, 0.45), c, [-0.35, 0.17, 0], null, null, b);
      j.add(new THREE.BoxGeometry(0.04, 0.04, 0.5), 0xc23b2e, [0.4, 0.4, 0], null, null, b);
      j.add(new THREE.BoxGeometry(0.7, 0.03, 0.45), 0x666b70, [0, -0.2, 0], null, null, b);
      for (const sx of [-0.3, 0.3]) for (const sz of [-0.18, 0.18])
        j.add(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 8), 0x222222, [sx, -0.27, sz], [Math.PI / 2, 0, 0], null, b);
    },
    club(j) {
      const b = baseAt(0, 0.03, 0, 2.2, 0, 0);
      j.add(new THREE.CylinderGeometry(0.012, 0.016, 1.1, 6), 0xc4c8cc, [0, 0, 0], [0, 0, Math.PI / 2], null, b);
      j.add(new THREE.CylinderGeometry(0.022, 0.02, 0.28, 6), 0x1b1b1b, [0.5, 0, 0], [0, 0, Math.PI / 2], null, b);
      j.add(new THREE.BoxGeometry(0.12, 0.05, 0.09), 0x8e949a, [-0.58, 0.01, 0.04], [0, 0.2, 0], null, b);
    },
    cone(j) {
      const b = baseAt(0, 0.17, 0, 0.4, 1.35, 0);
      j.add(new THREE.ConeGeometry(0.17, 0.5, 8), 0xff6a1a, [0, 0.0, 0], null, null, b);
      j.add(new THREE.CylinderGeometry(0.09, 0.1, 0.07, 8), 0xf2f2f2, [0, 0.03, 0], null, null, b);
      j.add(new THREE.BoxGeometry(0.4, 0.03, 0.4), 0x2a2a2a, [0, -0.26, 0], null, null, b);
    },
    tyre(j) {
      const b = baseAt(0, 0.2, 0, 1.1, 0.0, 1.2);
      j.add(new THREE.TorusGeometry(0.3, 0.11, 7, 14), 0x1d1d1d, [0, 0, 0], null, null, b);
      j.add(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 10), 0x777b7f, [0, 0, 0], [Math.PI / 2, 0, 0], null, b);
    },
    trophy(j, g) {
      const TB = baseAt(0, 0, 0, 0.6, 0.12, 0.05);
      j.add(new THREE.BoxGeometry(0.34, 0.1, 0.26), 0x4a2f18, [0, 0.05, 0], null, null, TB);
      g.add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8), 0xffffff, [0, 0.115, 0], null, null, TB);
      g.add(new THREE.CylinderGeometry(0.02, 0.03, 0.16, 8), 0xffd24a, [0, 0.2, 0], null, null, TB);
      g.add(new THREE.CylinderGeometry(0.13, 0.05, 0.22, 10, 1, true), 0xffd24a, [0, 0.38, 0], null, null, TB);
      g.add(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), 0xffd24a, [0, 0.27, 0], null, null, TB);
      for (const sx of [-1, 1]) g.add(new THREE.TorusGeometry(0.06, 0.015, 5, 8, Math.PI), 0xffe27a, [sx * 0.14, 0.4, 0], [0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2], null, TB);
      return new THREE.Matrix4().copy(TB).multiply(new THREE.Matrix4().makeTranslation(0, 0.05, 0.132));   // the plaque
    },
    shades(j) {
      const b = baseAt(0, 0.02, 0, 0.5, 0, 0);
      for (const sx of [-0.075, 0.075]) {
        j.add(new THREE.TorusGeometry(0.06, 0.012, 5, 10), 0x111111, [sx, 0, 0], [Math.PI / 2, 0, 0], null, b);
        j.add(new THREE.CylinderGeometry(0.055, 0.055, 0.008, 10), 0x1a2a4a, [sx, 0, 0], null, null, b);
        j.add(new THREE.BoxGeometry(0.01, 0.01, 0.18), 0x111111, [sx * 1.9, 0.01, -0.09], null, null, b);
      }
      j.add(new THREE.BoxGeometry(0.05, 0.012, 0.012), 0x111111, [0, 0, 0], null, null, b);
    },
    boot(j) {
      const b = baseAt(0, 0.13, 0, 3.5, 1.35, 0), c = 0x6b4423;
      j.add(new THREE.BoxGeometry(0.14, 0.32, 0.14), c, [0, 0.12, 0], null, null, b);
      j.add(new THREE.BoxGeometry(0.3, 0.1, 0.15), c, [0.09, -0.07, 0], null, null, b);
      j.add(new THREE.BoxGeometry(0.32, 0.03, 0.16), 0x24180d, [0.09, -0.13, 0], null, null, b);
    },
    duck(j) {
      const b = baseAt(0, 0.07, 0, 4.1, 0.2, 0);
      j.add(new THREE.SphereGeometry(0.1, 8, 6), 0xffdc2e, [0, 0, 0], null, [1.2, 0.85, 0.9], b);
      j.add(new THREE.SphereGeometry(0.06, 8, 6), 0xffdc2e, [0.1, 0.11, 0], null, null, b);
      j.add(new THREE.ConeGeometry(0.03, 0.06, 5), 0xff8a1a, [0.18, 0.11, 0], [0, 0, -Math.PI / 2], null, b);
      // the necktie: middle management
      j.add(new THREE.BoxGeometry(0.03, 0.04, 0.012), 0xc23b2e, [0.08, 0.045, 0], [0, 0, -0.25], null, b);
      j.add(new THREE.ConeGeometry(0.022, 0.07, 4), 0xc23b2e, [0.075, 0.0, 0], [Math.PI, 0, -0.25], null, b);
    },
    keys(j, g) {
      const b = baseAt(0, 0.02, 0, 0.7, 0, 0);
      j.add(new THREE.TorusGeometry(0.045, 0.008, 5, 12), 0xcfd3d8, [0, 0, 0], [Math.PI / 2, 0, 0], null, b);
      for (const [yaw, len] of [[0.3, 0.1], [1.4, 0.09], [2.5, 0.11]]) {
        j.add(new THREE.BoxGeometry(len, 0.006, 0.016), 0xcfd3d8, [Math.cos(yaw) * (0.045 + len / 2), 0, Math.sin(yaw) * (0.045 + len / 2)], [0, -yaw, 0], null, b);
        j.add(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 8), 0xcfd3d8, [Math.cos(yaw) * (0.045 + len), 0, Math.sin(yaw) * (0.045 + len)], null, null, b);
      }
      g.add(new THREE.BoxGeometry(0.1, 0.006, 0.016), 0xffd24a, [-0.1, 0.004, 0.02], [0, 0.5, 0], null, b);
      j.add(new THREE.BoxGeometry(0.06, 0.025, 0.04), 0x1e4fa3, [0, 0.01, -0.09], null, null, b);   // the Buick fob
    },
    pin(j, g) {
      const b = baseAt(0, 0.012, 0, 0.3, 0, 0);
      g.add(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 16), 0xffd24a, [0, 0, 0], null, null, b);
      j.add(new THREE.CylinderGeometry(0.04, 0.04, 0.014, 16), 0xf2c94c, [0, 0.002, 0], null, null, b);
      j.add(new THREE.BoxGeometry(0.012, 0.016, 0.012), 0x1b1b1b, [-0.016, 0.004, -0.008], null, null, b);   // one good eye
      j.add(new THREE.BoxGeometry(0.014, 0.016, 0.004), 0x9a2a1e, [0.016, 0.004, -0.008], [0, 0.6, 0], null, b); // one scratched out
      j.add(new THREE.BoxGeometry(0.03, 0.016, 0.006), 0x1b1b1b, [0, 0.004, 0.016], null, null, b);
    },
    memo(j) {
      const b = baseAt(0, 0.012, 0, 0.9, 0.06, 0.02);
      j.add(new THREE.BoxGeometry(0.22, 0.008, 0.3), 0xe3dcc0, [0, 0, 0], null, null, b);
      j.add(new THREE.BoxGeometry(0.2, 0.01, 0.04), 0xb8312a, [0, 0.002, -0.1], null, null, b);   // URGENT
      for (let k = 0; k < 4; k++) j.add(new THREE.BoxGeometry(0.16 - k * 0.02, 0.01, 0.008), 0x6a6a68, [0, 0.002, -0.03 + k * 0.045], null, null, b);
    },
    vhs(j) {
      const b = baseAt(0, 0.02, 0, 1.0, 0.04, 0);
      j.add(new THREE.BoxGeometry(0.19, 0.03, 0.105), 0x16161b, [0, 0, 0], null, null, b);
      j.add(new THREE.BoxGeometry(0.13, 0.032, 0.05), 0xd8d2c0, [-0.01, 0, 0.02], null, null, b);
      j.add(new THREE.CylinderGeometry(0.016, 0.016, 0.034, 8), 0xeeeeee, [-0.04, 0, -0.03], null, null, b);
      j.add(new THREE.CylinderGeometry(0.016, 0.016, 0.034, 8), 0xeeeeee, [0.04, 0, -0.03], null, null, b);
    },
    scorecard(j, g) {
      const b = baseAt(0, 0.01, 0, 0.4, 0.05, 0);
      j.add(new THREE.BoxGeometry(0.2, 0.006, 0.29), 0xf0e6c2, [0, 0, 0], null, null, b);
      j.add(new THREE.BoxGeometry(0.2, 0.008, 0.045), 0x2f5d3a, [0, 0.001, -0.12], null, null, b);
      for (let k = 0; k < 5; k++) j.add(new THREE.BoxGeometry(0.17, 0.008, 0.006), 0x5a5a52, [0, 0.001, -0.06 + k * 0.04], null, null, b);
      j.add(new THREE.BoxGeometry(0.06, 0.009, 0.01), 0xb8312a, [0.04, 0.0015, 0.12], null, null, b);   // LOST BALL
      g.add(new THREE.BoxGeometry(0.012, 0.012, 0.1), 0xffd24a, [-0.07, 0.01, 0.06], [0, 0.4, 0], null, b); // the founder's pencil
    },
  };
  const itemGeo = {};
  function geoOf(id) {
    if (itemGeo[id]) return itemGeo[id];
    const j = new Bake(), g = new Bake(), plaque = ITEM[id](j, g) || null;
    const jg = keep(j.build()); jg.computeBoundingBox();
    const bb = jg.boundingBox, rad = Math.max(0.06, Math.hypot(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) / 2);
    return (itemGeo[id] = { j: jg, g: g.pos.length ? keep(g.build()) : null, plaque, rad, cy: (bb.max.y + bb.min.y) / 2 });
  }
  const junkMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const goldMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xb07a10, emissiveIntensity: 0.9, side: THREE.DoubleSide }));
  const ghostMat = keep(new THREE.MeshBasicMaterial({ color: 0x0b1620, transparent: true, opacity: 0.55, depthWrite: false }));
  let plaqueMat = null;
  function getPlaqueMat() {   // "1987 Club Champion" (canvas texture; plain gold if there is no DOM)
    if (plaqueMat) return plaqueMat;
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
        map = keep(new THREE.CanvasTexture(cv)); map.colorSpace = THREE.SRGBColorSpace;
      }
    }
    return (plaqueMat = keep(new THREE.MeshBasicMaterial({ color: map ? 0xbbbbbb : 0xc9a23a, map })));
  }
  const plaqueGeo = keep(new THREE.PlaneGeometry(0.3, 0.075));
  // A fresh Group for an item (shared geometry and materials); ghost = a dark silhouette instead.
  function makeItem(id, ghost = false) {
    const G = geoOf(id), grp = new THREE.Group();
    grp.add(new THREE.Mesh(G.j, ghost ? ghostMat : junkMat));
    if (G.g) grp.add(new THREE.Mesh(G.g, ghost ? ghostMat : goldMat));
    if (G.plaque && !ghost) {
      const pl = new THREE.Mesh(plaqueGeo, getPlaqueMat());
      pl.matrixAutoUpdate = false; pl.matrix.copy(G.plaque); grp.add(pl);
    }
    grp.children.forEach(c => { c.frustumCulled = false; });
    return grp;
  }

  // On the shelf: the cart is pure set dressing; the seven classic treasures lie around until found.
  const SHELF_IDS = ['club', 'cone', 'tyre', 'trophy', 'shades', 'boot', 'duck'];
  const shelf = {};   // id -> Group
  const found = new Set();
  let active = null;  // { id, group, pos: Vector3 (world), glints }
  const syncShelf = () => { for (const id of SHELF_IDS) shelf[id].visible = !found.has(id) && active?.id !== id; };
  {
    const spots = [];
    for (let i = 0, guard = 0; i < 8 && guard < 200; guard++) {
      const a = i * 2.399 + rand() * 0.6, d = 1.6 + rand() * (R - 3.4);
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (nearPit(x, z, 0.9)) continue;
      spots.push([x, z]); i++;
    }
    while (spots.length < 8) spots.push([-1.5 * spots.length, 2]);
    const place = (id, k) => {
      const g = makeItem(id); g.position.set(spots[k][0], bedY(spots[k][0], spots[k][1]), spots[k][1]);
      underOnly.add(g); return g;
    };
    place('cart', 0);
    SHELF_IDS.forEach((id, i) => { shelf[id] = place(id, i + 1); });
  }
  const trophyPos = new THREE.Vector3(PX + shelf.trophy.position.x, shelf.trophy.position.y + 0.3, PZ + shelf.trophy.position.z);

  // --- the active treasure: glinting in the Deep End until a diver carries it off ---
  const GLINTS = 7;
  const glintGeo = keep(new THREE.BufferGeometry());
  {
    const P = new Float32Array(GLINTS * 3), S = new Float32Array(GLINTS), Ph = new Float32Array(GLINTS);
    for (let i = 0; i < GLINTS; i++) {
      const a = rand() * TAU, d = 0.05 + rand() * 0.22;
      P[i * 3] = Math.cos(a) * d; P[i * 3 + 1] = 0.04 + rand() * 0.32; P[i * 3 + 2] = Math.sin(a) * d;
      S[i] = 0.05 + rand() * 0.07; Ph[i] = rand();
    }
    glintGeo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    glintGeo.setAttribute('aSize', new THREE.BufferAttribute(S, 1));
    glintGeo.setAttribute('aPh', new THREE.BufferAttribute(Ph, 1));
  }
  const glintU = { uTime: U.uTime, uScale: { value: 800 }, uR: { value: 6 }, uGlow: { value: 0 } };
  const glintMat = keep(new THREE.ShaderMaterial({
    uniforms: glintU, vertexShader: GLINT_VERT, fragmentShader: GLINT_FRAG,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false,
  }));
  const glints = new THREE.Points(glintGeo, glintMat);
  glints.frustumCulled = false; glints.renderOrder = 6; glints.visible = false;
  underOnly.add(glints);
  const fitScale = id => Math.max(1, 0.2 / geoOf(id).rad);   // small items are blown up so a diver can find them
  // Put (or clear) the treasure that is currently lying in the Deep End. (x, z) are world coordinates;
  // use dive.js treasureSpot() so every client agrees. setTreasure(null) when it is carried off.
  function setTreasure(id, x, z) {
    if (active) { underOnly.remove(active.group); active = null; }
    glints.visible = false;
    if (id && TREASURE_BY_ID[id] && ITEM[id]) {
      const lx = x - PX, lz = z - PZ, g = makeItem(id), sc = fitScale(id);
      g.scale.setScalar(sc); g.position.set(lx, bedY(lx, lz), lz);
      underOnly.add(g);
      glints.position.set(lx, bedY(lx, lz), lz);
      glints.visible = true;
      active = { id, group: g, pos: new THREE.Vector3(x, bedY(lx, lz), z), pinged: false };
    }
    syncShelf();
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
    uniforms: { uTime: U.uTime, uTint: { value: new THREE.Color(WATER_FOG0) }, uClar: U.uClar }, vertexShader: SURF_VERT, fragmentShader: SURF_FRAG,
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

  // --- the Lost & Found glass case: 12 slots, one per treasure, dark silhouettes until found ---
  const caseG = new THREE.Group();
  caseG.name = 'lost-and-found-case';
  root.add(caseG);
  const CASE = { W: 1.9, H: 1.7, D: 0.55, BASE: 0.5, COLS: 4, ROWS: 3, DX: 0.44, DY: 0.52 };
  const caseSlots = [];     // { id, real: Group, ghost: Group }
  let signCtx = null, signTex = null;
  {
    const wood = keep(new THREE.MeshLambertMaterial({ color: 0x5a3a1e })), brass = keep(new THREE.MeshLambertMaterial({ color: 0xc9a23a, emissive: 0x3a2a05 }));
    const glass = keep(new THREE.MeshLambertMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide }));
    const felt = keep(new THREE.MeshLambertMaterial({ color: 0x1f3a2a }));
    const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(keep(new THREE.BoxGeometry(w, h, d)), m); o.position.set(x, y, z); caseG.add(o); return o; };
    box(CASE.W + 0.14, CASE.BASE, CASE.D + 0.14, wood, 0, CASE.BASE / 2, 0);
    box(CASE.W + 0.14, 0.1, CASE.D + 0.14, wood, 0, CASE.BASE + CASE.H + 0.05, 0);
    box(CASE.W, 0.03, CASE.D, felt, 0, CASE.BASE + 0.015, 0);
    for (let r = 1; r < CASE.ROWS; r++) box(CASE.W, 0.03, CASE.D, felt, 0, CASE.BASE + r * CASE.DY + 0.015, 0);
    const gl = new THREE.Mesh(keep(new THREE.BoxGeometry(CASE.W, CASE.H, CASE.D)), glass);
    gl.position.set(0, CASE.BASE + CASE.H / 2, 0); gl.renderOrder = 5; caseG.add(gl);
    const edges = new THREE.LineSegments(keep(new THREE.EdgesGeometry(gl.geometry)), keep(new THREE.LineBasicMaterial({ color: 0xc9a23a })));
    edges.position.copy(gl.position); caseG.add(edges);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, CASE.H, 0.05, brass, sx * CASE.W / 2, CASE.BASE + CASE.H / 2, sz * CASE.D / 2);
    // the brass sign on the base, with the count
    let signMat;
    if (typeof document !== 'undefined') {
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      signCtx = cv.getContext('2d');
      if (signCtx) { signTex = keep(new THREE.CanvasTexture(cv)); signTex.colorSpace = THREE.SRGBColorSpace; }
    }
    signMat = keep(new THREE.MeshBasicMaterial({ color: signTex ? 0xffffff : 0xc9a23a, map: signTex }));
    const sign = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.5, 0.375)), signMat);
    sign.position.set(0, CASE.BASE / 2, CASE.D / 2 + 0.075); caseG.add(tagSign(sign, 'lostfound'));   // signs.js
    TREASURE.forEach((t, i) => {
      const col = i % CASE.COLS, row = CASE.ROWS - 1 - Math.floor(i / CASE.COLS);
      const sx = (col - (CASE.COLS - 1) / 2) * CASE.DX, sy = CASE.BASE + row * CASE.DY + 0.03;
      const sc = Math.min(2.5, Math.max(0.25, 0.17 / geoOf(t.id).rad));
      const mk = ghost => {
        const g = makeItem(t.id, ghost); g.scale.setScalar(sc); g.position.set(sx, sy, 0);
        g.visible = ghost; caseG.add(g); return g;
      };
      caseSlots.push({ id: t.id, real: mk(false), ghost: mk(true), sc });
    });
  }
  function drawSign() {
    if (!signCtx) return;
    const g = signCtx, n = found.size;
    g.fillStyle = '#6b4d10'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#c9a23a'; g.fillRect(6, 6, 500, 116);
    g.fillStyle = '#3a2806'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = 'bold 54px serif'; g.fillText('LOST & FOUND', 256, 44);
    g.font = 'bold 40px serif'; g.fillText(`${n} / ${TREASURE.length}`, 256, 94);
    signTex.needsUpdate = true;
  }
  drawSign();
  caseG.position.set(POND.DOCK.x - PX + 3.4, 0, POND.DOCK.z - PZ + 1.2);
  caseG.rotation.y = 0;   // front faces +z, towards the stand

  // Where the case stands (world x, z and the yaw its front faces; 0 = facing +z). Call once at
  // startup with the stand's position if the case should sit there instead of by the dock.
  function placeCase(x, z, yaw = 0, y = 0) { caseG.position.set(x - PX, y, z - PZ); caseG.rotation.y = yaw; }

  function setFound(ids) {
    found.clear();
    for (const id of ids ?? []) if (Object.hasOwn(TREASURE_BY_ID, id)) found.add(id);
    for (const sl of caseSlots) { const f = found.has(sl.id); sl.real.visible = f; sl.ghost.visible = !f; }
    if (active && found.has(active.id)) setTreasure(null);
    syncShelf(); drawSign();
  }
  function animateCase(T) {
    for (let i = 0; i < caseSlots.length; i++) if (caseSlots[i].real.visible) caseSlots[i].real.rotation.y = T * 0.5 + i;
  }

  // --- rings: splash rings on the surface, gold sonar rings on the bed ---
  function ringPool(parent, n, color) {
    const geo = keep(new THREE.RingGeometry(0.82, 1, 44)); geo.rotateX(-Math.PI / 2);
    const pool = [];
    for (let i = 0; i < n; i++) {
      const mat = keep(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      const m = new THREE.Mesh(geo, mat); m.visible = false; m.frustumCulled = false; m.renderOrder = 4;
      parent.add(m); pool.push({ m, age: 9, dur: 1, r0: 0.1, r1: 1, a: 1, delay: 0 });
    }
    let c = 0;
    return {
      fire(x, y, z, r0, r1, dur, a = 1, delay = 0) {
        const o = pool[c++ % n]; o.m.position.set(x, y, z); o.age = -delay; o.dur = dur; o.r0 = r0; o.r1 = r1; o.a = a;
      },
      step(dt) {
        for (const o of pool) {
          if (o.age >= o.dur) continue;
          o.age += dt;
          if (o.age < 0) { o.m.visible = false; continue; }
          const u = Math.min(1, o.age / o.dur), e = 1 - (1 - u) * (1 - u);
          o.m.visible = u < 1; o.m.scale.setScalar(o.r0 + (o.r1 - o.r0) * e); o.m.material.opacity = o.a * (1 - u) * (1 - u);
        }
      },
    };
  }
  const splashRings = ringPool(root, 6, 0xdff8ff);
  const sonarRings = ringPool(underOnly, 5, 0xffd86a);

  // --- spray: droplets thrown up from a plunge or a surfacing (visible from the shore too) ---
  const ND = 110;
  const dropGeo = keep(new THREE.BufferGeometry());
  const dP = new Float32Array(ND * 3), dS = new Float32Array(ND), dA = new Float32Array(ND), dV = new Float32Array(ND * 3), dOn = new Uint8Array(ND);
  for (let i = 0; i < ND; i++) dP[i * 3 + 1] = -50;
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dP, 3).setUsage(THREE.DynamicDrawUsage));
  dropGeo.setAttribute('aSize', new THREE.BufferAttribute(dS, 1).setUsage(THREE.DynamicDrawUsage));
  dropGeo.setAttribute('aAlpha', new THREE.BufferAttribute(dA, 1).setUsage(THREE.DynamicDrawUsage));
  const drops = new THREE.Points(dropGeo, keep(new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uScale: { value: 800 } }, defines: { DROP: 1 },
    vertexShader: POINT_VERT, fragmentShader: DROP_FRAG, transparent: true, depthWrite: false,
  })));
  drops.frustumCulled = false; drops.renderOrder = 7;
  root.add(drops);
  let dCursor = 0, dLive = 0;
  function spray(lx, lz, n, up, out) {
    for (let k = 0; k < n; k++) {
      const i = dCursor++ % ND, a = Math.random() * TAU, v = out * (0.3 + Math.random() * 0.7);
      dOn[i] = 1; dLive++;
      dP[i * 3] = lx + Math.cos(a) * 0.15 * Math.random(); dP[i * 3 + 1] = SURF + 0.05; dP[i * 3 + 2] = lz + Math.sin(a) * 0.15 * Math.random();
      dV[i * 3] = Math.cos(a) * v; dV[i * 3 + 1] = up * (0.55 + Math.random() * 0.6); dV[i * 3 + 2] = Math.sin(a) * v;
      dS[i] = 0.03 + Math.random() * 0.05; dA[i] = 0.9;
    }
  }
  function stepDrops(dt) {
    if (!dLive) return;
    for (let i = 0; i < ND; i++) {
      if (!dOn[i]) continue;
      dV[i * 3 + 1] -= 9.8 * dt;
      dP[i * 3] += dV[i * 3] * dt; dP[i * 3 + 1] += dV[i * 3 + 1] * dt; dP[i * 3 + 2] += dV[i * 3 + 2] * dt;
      dA[i] *= 1 - 0.35 * dt;
      if (dP[i * 3 + 1] < SURF - 0.02 && dV[i * 3 + 1] < 0) { dOn[i] = 0; dA[i] = 0; dP[i * 3 + 1] = -50; dLive--; }
    }
    dropGeo.attributes.position.needsUpdate = true; dropGeo.attributes.aSize.needsUpdate = true; dropGeo.attributes.aAlpha.needsUpdate = true;
  }

  // --- screen effects (mine only): a camera dip, a damped wobble, a flare, a floating bag count ---
  const fx = { dipFrom: 0, dipT: 9, dipDur: 0.6, wobT: 9, wobDur: 1.2, wobAmp: 0, flashT: 9, flashDur: 0.8, flashA: 0 };
  let flashEl = null, canvasEl = null, wobbling = false;
  function ensureFlash() {
    if (flashEl || typeof document === 'undefined') return flashEl;
    flashEl = document.getElementById('scuba-flash');
    if (!flashEl) {
      flashEl = document.createElement('div'); flashEl.id = 'scuba-flash';
      flashEl.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:29;opacity:0;display:none;';
      document.body.appendChild(flashEl);
    }
    return flashEl;
  }
  function flash(kind, a, dur) {
    const el = ensureFlash(); if (!el) return;
    el.style.background = kind === 'sun'
      ? 'radial-gradient(ellipse at 50% -5%, rgba(255,250,215,0.98) 0%, rgba(210,255,245,0.55) 38%, rgba(255,255,255,0) 78%)'
      : 'radial-gradient(ellipse at 50% 50%, rgba(220,250,255,0.0) 20%, rgba(190,240,255,0.55) 70%, rgba(255,255,255,0.85) 100%)';
    fx.flashT = 0; fx.flashDur = dur; fx.flashA = a;
  }
  function floatText(text) {
    if (typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.textContent = text;
    el.style.cssText = 'position:fixed;left:50%;top:40%;pointer-events:none;z-index:31;font:800 2.6em/1 system-ui,sans-serif;color:#fff;' +
      'text-shadow:0 0 14px rgba(120,230,255,0.95),0 2px 0 rgba(0,60,80,0.8);opacity:0;white-space:nowrap;';
    document.body.appendChild(el);
    const done = () => el.remove();
    if (el.animate) {
      const an = el.animate([
        { opacity: 0, transform: 'translate(-50%, 18px) scale(0.7)' },
        { opacity: 1, transform: 'translate(-50%, 0) scale(1.15)', offset: 0.18 },
        { opacity: 1, transform: 'translate(-50%, -26px) scale(1)', offset: 0.7 },
        { opacity: 0, transform: 'translate(-50%, -70px) scale(1)' },
      ], { duration: 1700, easing: 'ease-out' });
      an.onfinish = done;
    } else setTimeout(done, 1700);
  }
  function applyFx(dt, T) {
    if (fx.dipT < fx.dipDur) {
      fx.dipT += dt;
      const u = Math.min(1, fx.dipT / fx.dipDur), e = u * u * (3 - 2 * u);
      camera.position.y += fx.dipFrom * (1 - e);
    }
    if (fx.wobT < fx.wobDur) {
      fx.wobT += dt;
      const k = Math.max(0, 1 - fx.wobT / fx.wobDur), kk = k * k, a = fx.wobAmp;
      camera.rotation.z += Math.sin(fx.wobT * 13) * 0.04 * a * kk;
      if (!canvasEl && typeof document !== 'undefined') canvasEl = document.querySelector('canvas');
      if (canvasEl) {
        canvasEl.style.transform = `translate(${(Math.sin(fx.wobT * 19) * 5 * a * kk).toFixed(2)}px, ${(Math.cos(fx.wobT * 15) * 4 * a * kk).toFixed(2)}px) scale(${(1 + 0.03 * a * kk).toFixed(4)})`;
        wobbling = true;
      }
    } else if (wobbling) { if (canvasEl) canvasEl.style.transform = ''; wobbling = false; }
    if (fx.flashT < fx.flashDur && flashEl) {
      fx.flashT += dt;
      const u = Math.min(1, fx.flashT / fx.flashDur);
      flashEl.style.opacity = String(fx.flashA * (1 - u) * (1 - u));
      flashEl.style.display = u < 1 ? 'block' : 'none';
    }
  }

  // --- public API ---
  // Plunge: a Rat stepped off the dock edge (call on the { t: 'dive', on: true } event, for ANY
  // player; x, z = where they went in, `mine` = it is the local player). Everyone sees the splash
  // ring and spray; the local player also gets the dip through the surface, a wobble and a flash.
  function plunge(x, z, mine = false) {
    const lx = x - PX, lz = z - PZ;
    splashRings.fire(lx, SURF + 0.02, lz, 0.2, 1.9, 0.95, 0.9);
    splashRings.fire(lx, SURF + 0.02, lz, 0.1, 1.2, 0.7, 0.6, 0.08);
    spray(lx, lz, mine ? 34 : 26, 3.6, 1.4);
    if (mine) {
      fx.dipFrom = 1.15; fx.dipT = 0; fx.dipDur = 0.6;
      fx.wobT = 0; fx.wobDur = 1.0; fx.wobAmp = 1;
      flash('water', 0.4, 0.5);
      for (let i = 0; i < 46; i++) spawn(lx + (Math.random() - 0.5) * 0.9, -0.1 - Math.random() * 1.0, lz + (Math.random() - 0.5) * 0.9, 0.03 + Math.random() * 0.08, 0.9 + Math.random() * 1.4, 0.18);
    }
  }
  // Surfacing (call on { t: 'dive', on: false } and { t: 'gasp' }): spray, a light flare, a float
  // showing the bag count ({ bag: 12 } -> "+12"), and the camera bursting up through the surface.
  function surface(x, z, o = {}) {
    const lx = x - PX, lz = z - PZ;
    splashRings.fire(lx, SURF + 0.02, lz, 0.2, 2.3, 1.1, 1);
    splashRings.fire(lx, SURF + 0.02, lz, 0.1, 1.5, 0.8, 0.7, 0.1);
    spray(lx, lz, o.mine ? 70 : 44, 5.2, 2.2);
    if (o.mine) {
      fx.dipFrom = -1.25; fx.dipT = 0; fx.dipDur = 0.55;
      fx.wobT = 0; fx.wobDur = 1.4; fx.wobAmp = 1.4;
      flash('sun', 0.85, 0.9);
      if (o.bag > 0) floatText(`+${o.bag}`);
    }
  }
  // A sonar ping at a treasure (world x, z): two gold rings spreading over the bed. tick() fires
  // this itself when the active treasure comes inside glint range; call it directly for effect.
  function ping(x, z) {
    const lx = x - PX, lz = z - PZ, y = bedY(lx, lz) + 0.06;
    sonarRings.fire(lx, y, lz, 0.2, 3.2, 1.5, 0.9);
    sonarRings.fire(lx, y, lz, 0.1, 2.2, 1.2, 0.6, 0.18);
  }

  function setUnder(v) {
    under = !!v;
    underOnly.visible = under;
    refreshAmt();
    if (!under) setVignette(0);
  }
  function setMode(m) { mode = m === 'eva' ? 'eva' : 'pond'; tintClar = -1; }

  // --- pond clarity: the water, the underside, the fog and the light all follow one number ---
  let clarTgt = 1, clarCur = 1, clarSet = false;
  function refreshAmt() { bedMat.uniforms.uAmt.value = (under ? 0.38 : 0.18) * (0.4 + 0.6 * clarCur); }
  function setClarity(c, snap = false) {
    clarTgt = Math.max(0, Math.min(1, c));
    if (snap || !clarSet) { clarCur = clarTgt; clarSet = true; }
  }
  const lookFor = (clar, wx, wz) => mode === 'eva'
    ? { surface: 0x05070f, fog: 0x02030a, far: 22, near: 0.5 }
    : waterLook(clar, wx, wz);
  function applyTint() {
    if (Math.abs(tintClar - clarCur) < 0.004) return;
    tintClar = clarCur;
    const look = lookFor(clarCur);
    if (waterMesh?.material?.color) waterMesh.material.color.setHex(look.surface);
    surfMat.uniforms.uTint.value.setHex(look.fog);
    U.uClar.value = clarCur;
    refreshAmt();
  }

  const cdir = new THREE.Vector3(), tv = new THREE.Vector3();
  function tick(dt, t, state) {
    dt = Math.min(Math.max(dt || 0, 0), 0.05);
    clock += dt;
    const T = typeof t === 'number' ? t : clock;
    const s = state || {};
    if (typeof s.clarity === 'number') setClarity(s.clarity);
    if (clarCur !== clarTgt) clarCur += (clarTgt - clarCur) * Math.min(1, dt * 1.6);
    if (Math.abs(clarCur - clarTgt) < 0.002) clarCur = clarTgt;
    applyTint();
    U.uTime.value = T;
    animateCase(T);
    splashRings.step(dt); sonarRings.step(dt); stepDrops(dt);
    const air01 = s.air01 ?? 1, dp = s.depthPos && typeof s.depthPos === 'object' ? s.depthPos : null;
    const cx = (dp?.x ?? camera.position.x) - PX, cy = dp?.y ?? camera.position.y, cz = (dp?.z ?? camera.position.z) - PZ;
    // From the shore and far away there is nothing else to animate.
    if (!under && Math.hypot(cx, cz) > R + 70) { applyFx(dt, T); return; }
    if (typeof innerHeight === 'number') { scaleU.value = innerHeight * 0.85; glintU.uScale.value = innerHeight * 0.85; }

    padTimer += dt;
    if (padTimer > 0.066) { padTimer = 0; updatePads(T); }
    stepCat(dt, T);
    stepFish(dt, T, under, cx, cy, cz);
    if (!under) { applyFx(dt, T); return; }

    // The water gets darker and thicker down the Deep End, and murkier with Pond Clarity.
    if (scene.fog) {
      const look = lookFor(clarCur, cx + PX, cz + PZ);
      scene.fog.color.setHex(look.fog); scene.fog.near = look.near; scene.fog.far = look.far;
    }

    // shafts sway slowly
    const e = new THREE.Euler(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), m = new THREE.Matrix4();
    for (let i = 0; !lowDetail && i < SHAFTS; i++) {   // lowDetail: shafts are hidden, skip the matrix writes too
      const d = shaftData[i];
      e.set(Math.sin(T * 0.21 + d.ph) * 0.07, 0, 0.2 + Math.sin(T * 0.17 + d.ph * 2) * 0.08);
      q.setFromEuler(e); p.set(d.x, SURF, d.z); sc.set(d.s, 1, d.s);
      shafts.setMatrixAt(i, m.compose(p, q, sc));
    }
    shafts.instanceMatrix.needsUpdate = true;

    goldMat.emissiveIntensity = 0.75 + 0.25 * Math.sin(T * 1.7);

    // treasure glints: only within range (6 m, 8 m with the dive light); a soft ping the first time you get there
    const gr = s.glintR ?? 6;
    glintU.uR.value = gr; glintU.uGlow.value = s.light ? 1 : 0;
    if (active) {
      const d = camera.position.distanceTo(tv.set(active.pos.x, active.pos.y + 0.2, active.pos.z));
      if (d < gr && !active.pinged) {
        active.pinged = true; ping(active.pos.x, active.pos.z);
        if (onPing) {
          camera.getWorldDirection(cdir);
          const dx = active.pos.x - camera.position.x, dz = active.pos.z - camera.position.z, dl = Math.hypot(dx, dz) || 1;
          onPing({ id: active.id, dist: d, pan: Math.max(-1, Math.min(1, (dx * -cdir.z + dz * cdir.x) / dl)) });
        }
      } else if (d > gr + 1.5) active.pinged = false;
      active.group.rotation.y = Math.sin(T * 0.3) * 0.2;
    }

    // bubbles: calm breathing, panic below 30% air, and the pump column (boils faster as the crank speeds up)
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
      const rate = Math.max(0, Math.min(1, s.pumpRate ?? 0.6));
      pumpAcc += (12 + 52 * rate) * dt;
      while (pumpAcc >= 1) {
        pumpAcc -= 1;
        spawn(hoseAt.x + (Math.random() - 0.5) * 0.3, BED_TOP + 0.05, hoseAt.z + (Math.random() - 0.5) * 0.3,
          0.03 + Math.random() * 0.06, 0.8 + Math.random() * (0.8 + rate), 0.15);
      }
    } else pumpAcc = 0;
    stepBubbles(dt, T);

    // low air: pulsing red edge
    if (air01 < 0.25) {
      const k = (0.25 - Math.max(air01, 0)) / 0.25;
      setVignette(Math.min(1, (0.35 + 0.65 * k) * (0.6 + 0.4 * Math.sin(T * (5 + k * 8)))));
    } else setVignette(0);
    applyFx(dt, T);
  }

  function dispose() {
    scene.remove(root);
    for (const o of disposables) o.dispose?.();
    padMesh.dispose(); petalMesh.dispose(); heartMesh.dispose(); fishMesh.dispose(); kelp.dispose(); shafts.dispose();
    vignette?.remove(); vignette = null; flashEl?.remove(); flashEl = null;
    if (canvasEl) canvasEl.style.transform = '';
  }

  // Low detail (perf.js: Xbox / Graphics Low): no light shafts, half the silt, half the kelp. Safe to flip live.
  let lowDetail = false;
  function setLowDetail(on) {
    lowDetail = !!on;
    shafts.visible = !lowDetail;
    motes.geometry.setDrawRange(0, lowDetail ? MOTES >> 1 : MOTES);
    kelp.count = lowDetail ? KELP >> 1 : KELP;
  }
  setLowDetail(opts.lowDetail);

  setUnder(false);
  return {
    setLowDetail,
    // the original API
    setUnder, tick, dispose, group: root, trophyPos,
    // Scuba v2
    attach, setClarity, setFound, setTreasure, plunge, surface, ping, placeCase, setMode,
    caseGroup: caseG,
    get mode() { return mode; },
    get activeTreasure() { return active ? active.id : null; },
  };
}

// ---------- the EVA: the visor, the breath and the O2 gauge (council round 4, build item 9) ----------
// The Orbital reuses the scuba code in 'eva' mode (createScuba's palette swap above); this is its screen half. It is
// DOM and WebAudio only (no THREE), so the view (views/orbit.js) builds one on the first ride and calls tick() every
// frame the rider is in a helmet. Low air pulses the same red vignette as the pond, and the breathing is synthesised
// (filtered noise: an inhale, an exhale and a faint regulator tick) and sped up by panic.
//
//   const eva = createEva({ audio: SFX.audioHandle });      // audio() -> { ctx, master, isMuted } | null
//   eva.setOn(true|false);                                  // helmet on / off (the ride up, the ride down)
//   eva.tick(dt, t, { air01, secs, ph: 'up'|'out'|'down', speed01, space01 });
//   eva.dispose();
export function createEva(opts = {}) {
  const getAudio = typeof opts.audio === 'function' ? opts.audio : () => null;
  const has = typeof document !== 'undefined';
  let root = null, vig = null, fog = null, gauge = null, fill = null, num = null, on = false;
  let cyc = 0, lastVig = -1, lastFog = -1, lastFill = -1, lastNum = '', beepT = 0, noise = null;

  function build() {
    if (root || !has) return root;
    root = document.createElement('div');
    root.id = 'eva-visor';
    root.style.cssText = 'position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:28;opacity:0;display:none;';
    // The visor: a dark rim that shrinks the view into a rounded helmet, two curved glints, a faint blue tint.
    const visor = document.createElement('div');
    visor.style.cssText = 'position:absolute;inset:0;background:' +
      'radial-gradient(ellipse 78% 74% at 50% 50%, rgba(0,0,0,0) 62%, rgba(4,8,18,0.55) 84%, rgba(2,4,10,0.96) 100%),' +
      'radial-gradient(ellipse 120% 90% at 30% 8%, rgba(140,190,255,0.10) 0%, rgba(140,190,255,0) 46%);';
    const glint = document.createElement('div');
    glint.style.cssText = 'position:absolute;left:11%;top:9%;width:22%;height:11%;border-radius:50%;transform:rotate(-24deg);' +
      'border-top:2px solid rgba(220,240,255,0.35);border-left:1px solid rgba(220,240,255,0.18);filter:blur(0.6px);';
    const glint2 = document.createElement('div');
    glint2.style.cssText = 'position:absolute;right:13%;top:12%;width:9%;height:5%;border-radius:50%;transform:rotate(18deg);' +
      'border-top:2px solid rgba(220,240,255,0.22);filter:blur(0.6px);';
    fog = document.createElement('div');       // breath fog: blooms at the bottom of the glass on every exhale
    fog.style.cssText = 'position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse 46% 30% at 50% 96%, rgba(235,245,255,0.55) 0%, rgba(235,245,255,0) 100%);';
    vig = document.createElement('div');        // low O2: the pond's pulsing red edge
    vig.style.cssText = 'position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center, rgba(160,0,0,0) 38%, rgba(190,10,10,0.55) 80%, rgba(120,0,0,0.9) 100%);';
    gauge = document.createElement('div');      // the O2 tube
    gauge.style.cssText = 'position:absolute;left:18px;bottom:26%;width:26px;height:150px;border:2px solid rgba(190,225,255,0.7);border-radius:13px;' +
      'background:rgba(6,14,28,0.55);overflow:hidden;box-shadow:0 0 14px rgba(120,190,255,0.35);';
    fill = document.createElement('div');
    fill.style.cssText = 'position:absolute;left:0;right:0;bottom:0;height:100%;background:linear-gradient(0deg,#5fd0ff,#c4f0ff);';
    gauge.appendChild(fill);
    num = document.createElement('div');
    num.style.cssText = 'position:absolute;left:12px;bottom:calc(26% - 26px);font:700 15px/1 ui-monospace,Consolas,monospace;color:#cfeaff;letter-spacing:0.08em;text-shadow:0 0 6px #0008;';
    root.append(visor, glint, glint2, fog, vig, gauge, num);
    document.body.appendChild(root);
    return root;
  }

  function setOn(v) {
    on = !!v;
    if (on) build();
    if (!root) return;
    root.style.display = on ? 'block' : 'none';
    root.style.opacity = on ? '1' : '0';
    if (!on) { lastVig = lastFog = lastFill = -1; lastNum = ''; }
  }

  // One breath: filtered noise through a band-pass with an attack/decay envelope. `exhale` is lower and longer.
  function breath(exhale, panic, vol) {
    const a = getAudio(); if (!a?.ctx || a.isMuted?.()) return;
    const c = a.ctx, now = c.currentTime;
    if (!noise) {
      noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const src = c.createBufferSource(); src.buffer = noise; src.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9 + panic * 1.4;
    const g = c.createGain();
    const dur = (exhale ? 1.35 : 0.95) * (1 - panic * 0.55);
    const f0 = exhale ? 900 : 1500, f1 = exhale ? 420 : 900;
    bp.frequency.setValueAtTime(f0 * (1 + panic * 0.4), now);
    bp.frequency.linearRampToValueAtTime(f1, now + dur);
    const peak = vol * (exhale ? 0.16 : 0.12) * (1 + panic * 0.8);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + dur * 0.28);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp); bp.connect(g); g.connect(a.master);
    src.start(now, Math.random() * 0.5); src.stop(now + dur + 0.05);
    if (!exhale) {          // the regulator tick
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'square'; o.frequency.value = 2300; og.gain.setValueAtTime(vol * 0.02, now); og.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
      o.connect(og); og.connect(a.master); o.start(now); o.stop(now + 0.04);
    }
  }
  function beep() {
    const a = getAudio(); if (!a?.ctx || a.isMuted?.()) return;
    const c = a.ctx, now = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = 1180; g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.07, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g); g.connect(a.master); o.start(now); o.stop(now + 0.18);
  }

  function tick(dt, t, s = {}) {
    if (!on) return;
    dt = Math.min(Math.max(dt || 0, 0), 0.1);
    const air01 = Math.max(0, Math.min(1, s.air01 ?? 1));
    const panic = air01 < 0.3 ? (0.3 - air01) / 0.3 : 0;
    const exertion = Math.max(0, Math.min(1, s.speed01 ?? 0));
    // the breathing cycle: ~4.4 s at rest, quicker when you move, ~1.5 s in a panic. Inhale first (40%), then exhale.
    const period = 4.4 - 0.9 * exertion - 2.9 * panic;
    const before = cyc;
    cyc = (cyc + dt / period) % 1;
    const vol = s.ph === 'out' ? 1 : 0.5;
    if (cyc < before) breath(false, panic, vol);                    // a new cycle starts: inhale
    if (before < 0.4 && cyc >= 0.4) breath(true, panic, vol);       // ...and the exhale
    // the visor fog follows the exhale; the red edge pulses under 25% like the pond's
    const ex = cyc >= 0.4 ? Math.sin((cyc - 0.4) / 0.6 * Math.PI) : 0;
    const fogOp = Math.round(ex * 0.3 * 50) / 50;
    if (fog && fogOp !== lastFog) { lastFog = fogOp; fog.style.opacity = String(fogOp); }
    let vo = 0;
    if (air01 < 0.25) { const k = (0.25 - air01) / 0.25; vo = Math.min(1, (0.35 + 0.65 * k) * (0.6 + 0.4 * Math.sin(t * (5 + k * 8)))); }
    vo = Math.round(vo * 50) / 50;
    if (vig && vo !== lastVig) { lastVig = vo; vig.style.opacity = String(vo); }
    if (air01 < 0.25 && s.ph === 'out' && (beepT -= dt) <= 0) { beepT = 0.9 - 0.5 * panic; beep(); }
    if (air01 >= 0.25) beepT = 0;
    // the gauge
    const f = Math.round(air01 * 100);
    if (fill && f !== lastFill) {
      lastFill = f; fill.style.height = f + '%';
      fill.style.background = air01 < 0.25 ? 'linear-gradient(0deg,#ff4a3a,#ff9a7a)' : 'linear-gradient(0deg,#5fd0ff,#c4f0ff)';
    }
    const label = `O₂ ${Math.ceil(s.secs ?? 0)}s`;
    if (num && label !== lastNum) { lastNum = label; num.textContent = label; }
  }

  function dispose() { root?.remove(); root = vig = fog = gauge = fill = num = null; on = false; }
  return { setOn, tick, dispose, get on() { return on; } };
}
