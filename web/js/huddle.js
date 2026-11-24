// The huddle ring round the stand (council round 6 #5): one InstancedMesh of arc ticks, so one draw call.
// The outer ticks are the slots (one per online Rat, their colour when they're inside the ring, brighter while
// held); the inner ticks are the gold sweep that fills over 3 s while every slot is held. Gary's 45 s warning
// shows the same ring with no sweep. The rules are pure in huddlerules.js; the confetti is the shared pool
// (confetti.js). Also the crowd roar for the bank: a noise swell on the SFX bus, no new audio file.
//
//   const ring = createHuddleRing(scene, stand);   // once
//   ring.show(slots, sweep);                       // per frame: slots from ringSlots / garyRingSlots, sweep in s
//   ring.hide();
//   roar(SFX.audioHandle());                       // the crowd at full for ~4 s
import * as THREE from 'three';
import { HUDDLE, slotOfTick, sweepTicks } from './huddlerules.js';

const T = HUDDLE.TICKS;
const EMPTY = new THREE.Color(0x3a3644), GOLD = new THREE.Color(0xffc34d);

export function createHuddleRing(scene, stand) {
  const step = (Math.PI * 2) / T;
  // One tick: a flat arc 0.45 m wide at the ring's radius, a hair narrower than its step so the ticks read as a dial.
  const geo = new THREE.RingGeometry(HUDDLE.R - 0.45, HUDDLE.R, 3, 1, 0, step * 0.86);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.InstancedMesh(geo, mat, T * 2);
  mesh.name = 'huddle-ring'; mesh.frustumCulled = false; mesh.visible = false; mesh.renderOrder = 2;
  mesh.position.set(stand.x, 0.07, stand.z);
  scene.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), o = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const c = new THREE.Color();
  for (let i = 0; i < T * 2; i++) mesh.setColorAt(i, EMPTY);
  let key = '';

  function place(i, angle, scale) {
    q.setFromAxisAngle(up, angle); s.set(scale, scale > 0 ? 1 : 0, scale);   // scale 0: the tick is hidden
    m4.compose(o, q, s); mesh.setMatrixAt(i, m4);
  }
  function show(slots = [], sweep = 0) {
    if (!slots.length) { hide(); return; }
    const gold = sweepTicks(sweep);
    const k = slots.map(x => x.color + (x.in ? 1 : 0) + (x.held ? 1 : 0)).join() + '|' + gold;
    mesh.visible = true;
    if (k === key) return;
    key = k;
    for (let i = 0; i < T; i++) {
      const si = slotOfTick(i, slots.length), a = -i * step + Math.PI / 2;   // clockwise from the stand's front
      place(i, a, si < 0 ? 0 : 1);
      if (si >= 0) {
        const sl = slots[si];
        if (sl.in) c.set(sl.color).multiplyScalar(sl.held ? 1.25 : 0.8); else c.copy(EMPTY);
        mesh.setColorAt(i, c);
      }
      place(T + i, a, i < gold ? 0.93 : 0);                   // the gold sweep, just inside the slots
      mesh.setColorAt(T + i, GOLD);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  function hide() { mesh.visible = false; key = ''; }
  return { show, hide, mesh };
}

// The crowd roar: a bright noise burst, then a broad cheering bed held at full for ~4 s and let go.
export function roar(audio) {
  const c = audio?.ctx, out = audio?.master;
  if (!c || !out || audio.isMuted?.()) return;
  const len = 5, buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) {
    const t = i / c.sampleRate;
    const wobble = 0.75 + 0.25 * Math.sin(t * 7.3) * Math.sin(t * 2.1 + 1);   // many voices, never quite in step
    d[i] = (Math.random() * 2 - 1) * wobble;
  }
  const t0 = c.currentTime;
  const src = c.createBufferSource(); src.buffer = buf;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7;
  bp.frequency.setValueAtTime(2200, t0); bp.frequency.exponentialRampToValueAtTime(900, t0 + 0.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.5, t0 + 0.08);            // the burst
  g.gain.linearRampToValueAtTime(0.3, t0 + 0.6);             // the bed, at full
  g.gain.setValueAtTime(0.3, t0 + 4.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
  src.connect(bp).connect(g).connect(out);
  src.onended = () => { src.disconnect(); bp.disconnect(); g.disconnect(); };
  src.start(t0); src.stop(t0 + len);
}
