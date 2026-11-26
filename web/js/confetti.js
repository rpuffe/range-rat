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
};

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

export function createConfetti(scene, { max = CONFETTI.MAX } = {}) {
  const pos = new Float32Array(max * 3), col = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3), life = new Float32Array(max), spin = new Float32Array(max);
  for (let i = 0; i < max; i++) pos[i * 3 + 1] = -999;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.PointsMaterial({ size: CONFETTI.SIZE, vertexColors: true, sizeAttenuation: true, depthWrite: false });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false; pts.visible = false; pts.renderOrder = 5;
  scene.add(pts);
  const tmp = new THREE.Color();
  let head = 0, alive = 0;

  function burst(x, y, z, { n = 160, secs = 2, speed = 7, up = 6, tint = null } = {}) {   // tint: one colour (council round 11 #1: MOW-E's smoke)
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
    if (alive <= 0) return;
    const d = Math.min(0.05, dt), drag = Math.exp(-CONFETTI.DRAG * d);
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) continue;
      life[i] -= d;
      if (life[i] <= 0) { pos[i * 3 + 1] = -999; alive--; continue; }
      vel[i * 3] *= drag; vel[i * 3 + 2] *= drag;
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
