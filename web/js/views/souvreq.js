// Council round 11 #5: the souvenir request's look. "WE WANT A BALL!": a pulsing gold ring on the lit stretch of rail,
// that section's fans on their feet waving, a world banner over the stand, and a confetti puff when it's answered.
// The rules live in ../stadium.js (REQ, SECTIONS). Xbox budget: four meshes built once (the ring, the banner, one
// InstancedMesh of arms, one of confetti), hidden when idle; no per-frame allocations.
import * as THREE from 'three';
import { SECTIONS, SOUV, REQ } from '../stadium.js';

const ARMS = 48, BITS = 40, PUFF_SECS = 1.6;

export function createSouvReq(ctx, parent) {
  const root = new THREE.Group(); root.name = 'souv_req'; parent.add(root);

  // The ring: a standing gold hoop on the rail, 16 m long and facing the field (flat on the ground it vanished at range).
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), ringMat);
  ring.rotation.y = Math.PI / 2; ring.renderOrder = 2; ring.visible = false; root.add(ring);

  // The banner: one canvas, redrawn only when the section changes.
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
  const g2 = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(13, 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
  banner.visible = false; root.add(banner);
  let drawn = '';
  const drawBanner = name => {
    if (drawn === name) return; drawn = name;
    g2.clearRect(0, 0, 512, 160);
    g2.fillStyle = '#1a1203'; g2.fillRect(0, 0, 512, 160);
    g2.strokeStyle = '#ffc83a'; g2.lineWidth = 8; g2.strokeRect(4, 4, 504, 152);
    g2.textAlign = 'center'; g2.textBaseline = 'middle';
    g2.fillStyle = '#ffd36b'; g2.font = 'bold 60px system-ui, sans-serif'; g2.fillText('WE WANT A BALL!', 256, 66, 476);   // maxWidth: never clipped
    g2.fillStyle = '#fff8ec'; g2.font = '600 34px system-ui, sans-serif'; g2.fillText(`SECTION ${name}`, 256, 126);
    tex.needsUpdate = true;
  };

  // The fans: arms up and waving over the lit section's crowd (the stand crowd is venues.js's InstancedMesh).
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.75, 0.12), new THREE.MeshLambertMaterial({ color: 0xffe0c0 }), ARMS);
  arms.frustumCulled = false; arms.visible = false; arms.count = 0; root.add(arms);
  const fanPos = new Float32Array(ARMS * 2);   // [x, y, z, phase] per fan, up to ARMS / 2 fans (two arms each)
  const DZ = [-0.28, 0.28];
  let nFans = 0;

  // Confetti: a puff over the section when a souvenir lands there.
  const bitsMat = new THREE.MeshBasicMaterial({ vertexColors: false, color: 0xffffff, side: THREE.DoubleSide });
  const bits = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.35, 0.22), bitsMat, BITS);
  bits.frustumCulled = false; bits.visible = false; root.add(bits);
  const col = new THREE.Color();
  for (let i = 0; i < BITS; i++) { col.setHSL((i * 0.137) % 1, 0.9, 0.6); bits.setColorAt(i, col); }
  const bitV = new Float32Array(BITS * 3), bitP = new Float32Array(BITS * 3);
  let puffT = -1;

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1);
  let sec = null;

  function pickFans(sc) {
    nFans = 0;
    const crowd = ctx.venues?.crowd ?? [];
    const side = sc.side < 0 ? 'left' : 'right';
    for (const c of crowd) {
      if (c.side !== side) continue;
      for (const b of c.base) {
        if (b[2] < sc.z0 || b[2] > sc.z1 || nFans >= ARMS / 2) continue;
        fanPos[nFans * 4] = b[0]; fanPos[nFans * 4 + 1] = b[1]; fanPos[nFans * 4 + 2] = b[2]; fanPos[nFans * 4 + 3] = b[3];
        nFans++;
      }
    }
  }

  return {
    // req: the snapshot's mods.stadium.req ({ i, sec, left }) or null.
    set(req) {
      const next = req ? SECTIONS[req.i] ?? null : null;
      if (next === sec) return;
      sec = next;
      ring.visible = banner.visible = arms.visible = !!sec;
      if (!sec) return;
      ring.position.set(sec.side * (SOUV.RAIL_X - 0.5), 2.2, sec.zc);
      ring.scale.set(REQ.LEN / 2 + 0.5, 2.2, 1);   // turned to the YZ plane: local x runs along the rail (z)
      banner.position.set(sec.side * 76, 10.5, sec.zc);
      banner.rotation.y = sec.side < 0 ? Math.PI / 2 : -Math.PI / 2;   // facing the field
      drawBanner(sec.name);
      pickFans(sec);
    },
    // A souvenir answered section i: confetti over it.
    puff(i) {
      const sc = SECTIONS[i]; if (!sc) return;
      puffT = 0; bits.visible = true;
      for (let k = 0; k < BITS; k++) {
        bitP[k * 3] = sc.side * (SOUV.RAIL_X + 2); bitP[k * 3 + 1] = 3; bitP[k * 3 + 2] = sc.zc + ((k * 7) % 16) - 8;
        const a = k * 2.399;
        bitV[k * 3] = Math.cos(a) * 2.5; bitV[k * 3 + 1] = 5 + (k % 5); bitV[k * 3 + 2] = Math.sin(a) * 2.5;
      }
    },
    tick(dt, t) {
      if (sec) {
        const k = 0.5 + 0.5 * Math.sin(t * 6);
        ringMat.opacity = 0.45 + 0.5 * k;
        ring.scale.y = 2.2 + 0.35 * k;
        let n = 0;
        for (let f = 0; f < nFans && n + 1 < ARMS; f++) {
          const x = fanPos[f * 4], y = fanPos[f * 4 + 1], z = fanPos[f * 4 + 2], ph = fanPos[f * 4 + 3];
          for (let j = 0; j < 2; j++) { const dz = DZ[j];
            const sw = Math.sin(t * 7 + ph + dz * 3) * 0.6;
            e.set(sw * Math.sign(dz), 0, 0); q.setFromEuler(e);
            p.set(x, y + 0.75, z + dz);
            arms.setMatrixAt(n++, m4.compose(p, q, s1));
          }
        }
        arms.count = n; arms.instanceMatrix.needsUpdate = true;
      }
      if (puffT >= 0) {
        puffT += dt;
        if (puffT > PUFF_SECS) { puffT = -1; bits.visible = false; return; }
        for (let k = 0; k < BITS; k++) {
          bitV[k * 3 + 1] -= 9 * dt;
          bitP[k * 3] += bitV[k * 3] * dt; bitP[k * 3 + 1] = Math.max(0.1, bitP[k * 3 + 1] + bitV[k * 3 + 1] * dt); bitP[k * 3 + 2] += bitV[k * 3 + 2] * dt;
          e.set(t * 5 + k, t * 3 + k * 0.5, 0); q.setFromEuler(e);
          p.set(bitP[k * 3], bitP[k * 3 + 1], bitP[k * 3 + 2]);
          bits.setMatrixAt(k, m4.compose(p, q, s1));
        }
        bits.instanceMatrix.needsUpdate = true;
      }
    },
    hide() { this.set(null); bits.visible = false; puffT = -1; },
    get lit() { return sec; },
  };
}
