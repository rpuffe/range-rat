// Confetti: ONE pooled THREE.Points shared by everything that celebrates (council round 6: the bell's APPROVED stamp,
// #3; the huddle's cannons and Gary's salute, #5). One draw call, a fixed buffer, no allocation after creation.
//
//   const c = sharedConfetti(scene);          // the one pool for this scene (created on first call)
//   c.burst(x, y, z, { n, secs, speed, up }); // n points from (x, y, z); they flutter down and vanish after `secs`
//   c.tick(dt);                               // main.js calls this once a frame; a second call in the same frame is a no-op
//
// The low tier spends fewer points: callers pass confettiCount(n, low, lowCap) (the bell: 160, low tier 60).
import * as THREE from 'three';

export const CONFETTI = {
  MAX: 400,          // points in the shared pool (two 160-point cannons plus a puff fit)
  G: 6,              // m/s², light paper: it falls slower than a ball
  DRAG: 1.6,         // 1/s air drag on the horizontal speed
  SIZE: 0.16,        // m, a point's size (size-attenuated)
  COLORS: [0xff3b5c, 0xffe14a, 0x4aa8ff, 0x6fd36f, 0xff9a2a, 0xf4f1e8, 0xc77dff],
  // Council round 12 9.12 (builder 1): a tinted burst (MOW-E's smoke) goes to its own small pool of soft round puffs
  // (an alpha-edged canvas sprite, so no square points: testers read the old ones as black squares at the Stadium).
  // They rise and slow instead of falling like paper. +1 draw call only while smoke is alive.
  SMOKE: { MAX: 120, SIZE: 0.7, RISE: 0.6, LIFT_DRAG: 2.2 },
};
// The smoke puff's alpha: 1 in the middle, 0 at the edge (smoothstep). A canvas texture where there's a document.
export const puffAlpha = r => { const k = Math.max(0, Math.min(1, 1 - r)); return k * k * (3 - 2 * k); };
function puffTexture() {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d'); if (!c) return null;
  const img = c.createImageData(64, 64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const i = (y * 64 + x) * 4, a = puffAlpha(Math.hypot(x - 31.5, y - 31.5) / 32); img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 200); }
  c.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(cv);
}

// How many points a burst gets at this tier: low tier caps at `lowCap` (60 for the bell), else n.
export const confettiCount = (n, low, lowCap = 60) => Math.max(0, Math.min(CONFETTI.MAX, low ? Math.min(n, lowCap) : n)) | 0;

// Pool slots: a ring over MAX, so a new burst overwrites the oldest points when the pool is full.
export function claimSlots(head, n, max = CONFETTI.MAX) {
  const out = [];
  for (let i = 0; i < Math.min(n, max); i++) out.push((head + i) % max);
  return { slots: out, head: (head + Math.min(n, max)) % max };
}

const pools = new WeakMap();
export function sharedConfetti(scene) {
  let c = pools.get(scene);
  if (!c) { c = createConfetti(scene); pools.set(scene, c); }
  return c;
}

export function createConfetti(scene, { max = CONFETTI.MAX, puff = false } = {}) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3), life = new Float32Array(max), spin = new Float32Array(max);
  for (let i = 0; i < max; i++) pos[i * 3 + 1] = -999;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const map = puff ? puffTexture() : null;
  const mat = new THREE.PointsMaterial({ size: puff ? CONFETTI.SMOKE.SIZE : CONFETTI.SIZE, vertexColors: true, sizeAttenuation: true, depthWrite: false,
    ...(puff ? { map, transparent: true, opacity: 0.85, alphaTest: 0.02 } : {}) });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5;
  scene.add(pts);
  const tmp = new THREE.Color();
  let head = 0, alive = 0;
  let smoke = null;   // round 12 9.12: built on the first tinted burst

  function burst(x, y, z, { n = 160, secs = 2, speed = 7, up = 6, tint = null } = {}) {   // tint: one colour (council round 11 #1: MOW-E's smoke)
    if (tint != null && max === CONFETTI.MAX) { smoke ??= createConfetti(scene, { max: CONFETTI.SMOKE.MAX, puff: true }); return smoke.burst(x, y, z, { n, secs, speed, up, tint, puffed: true }); }
    const r = claimSlots(head, n, max); head = r.head;
    for (const i of r.slots) {
      if (life[i] <= 0) alive++;
      const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65);
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = up * (0.6 + Math.random() * 0.7); vel[i * 3 + 2] = Math.sin(a) * s;
      life[i] = secs * (0.75 + Math.random() * 0.25); spin[i] = Math.random() * 10;
      tmp.setHex(tint ?? CONFETTI.COLORS[(Math.random() * CONFETTI.COLORS.length) | 0]);
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    pts.visible = alive > 0;
    geo.attributes.color.needsUpdate = true; geo.attributes.position.needsUpdate = true;
  }

  let lastTick = -1;
  function tick(dt) {
    const t = performance.now();
    if (t - lastTick < 2) return;               // shared pool: only the first caller each frame steps it
    lastTick = t;
    smoke?.tick(dt);
    if (alive <= 0) return;
    const d = Math.min(0.05, dt), drag = Math.exp(-CONFETTI.DRAG * d);
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= d;
      if (life[i] <= 0) { pos[i * 3 + 1] = -999; alive--; continue; }
      vel[i * 3] *= drag; vel[i * 3 + 2] *= drag;
      if (puff) { const k = Math.exp(-CONFETTI.SMOKE.LIFT_DRAG * d); vel[i * 3 + 1] = CONFETTI.SMOKE.RISE + (vel[i * 3 + 1] - CONFETTI.SMOKE.RISE) * k; pos[i * 3] += vel[i * 3] * d; pos[i * 3 + 1] += vel[i * 3 + 1] * d; pos[i * 3 + 2] += vel[i * 3 + 2] * d; continue; }   // smoke rises and slows
      vel[i * 3 + 1] = Math.max(-1.6, vel[i * 3 + 1] - CONFETTI.G * d);       // paper reaches a slow terminal fall
      spin[i] += d * 9;
      pos[i * 3] += (vel[i * 3] + Math.sin(spin[i]) * 0.5) * d;               // flutter
      pos[i * 3 + 1] += vel[i * 3 + 1] * d;
      pos[i * 3 + 2] += (vel[i * 3 + 2] + Math.cos(spin[i]) * 0.5) * d;
    }
    pts.visible = alive > 0;
    geo.attributes.position.needsUpdate = true;
  }

  return { burst, tick, points: pts, get alive() { return alive; } };
}
