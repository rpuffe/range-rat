// Council round 11 #5: the souvenir request's look. "WE WANT A BALL!": a pulsing gold ring on the lit stretch of rail,
// that section's fans on their feet waving, a world banner over the stand, and a confetti puff when it's answered.
// Council round 12 #2c/#2e: a gold beam over every lit section (the beacon look, 20 m tall, pulsing: seen from under the
// deck and from the mats), and up to three sections at once for the Seventh-Inning Stretch.
// The rules live in ../stadium.js (REQ, SECTIONS). Xbox budget: five meshes built once (the rings and the beams as one
// InstancedMesh each, the banner, one InstancedMesh of arms, one of confetti), hidden when idle; no per-frame allocations.
import * as THREE from 'three';
import { SECTIONS, SOUV, REQ } from '../stadium.js';

const MAXLIT = 3, ARMS = 96, BITS = 40, PUFF_SECS = 1.6, BEAM_H = 20;

export function createSouvReq(ctx, parent) {
  const root = new THREE.Group(); root.name = 'souv_req'; parent.add(root);

  // The rings: standing gold hoops on the rail, 16 m long and facing the field (flat on the ground they vanished at range).
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const rings = new THREE.InstancedMesh(new THREE.RingGeometry(0.86, 1, 48), ringMat, MAXLIT);
  rings.frustumCulled = false; rings.renderOrder = 2; rings.visible = false; rings.count = 0; root.add(rings);

  // The beams (round 12 #2e): one open cylinder per lit section, additive gold, the beacon look.
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const beamGeo = new THREE.CylinderGeometry(1.1, 1.6, BEAM_H, 14, 1, true); beamGeo.translate(0, BEAM_H / 2, 0);
  const beams = new THREE.InstancedMesh(beamGeo, beamMat, MAXLIT);
  beams.frustumCulled = false; beams.renderOrder = 3; beams.visible = false; beams.count = 0; root.add(beams);

  // The banner: one canvas, redrawn only when the section changes (single requests only: the Stretch's words are on the
  // jumbotron and the Board).
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

  // The fans: arms up and waving over the lit sections' crowd (the stand crowd is venues.js's InstancedMesh).
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

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s1 = new THREE.Vector3(1, 1, 1), sv = new THREE.Vector3();
  const qRing = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));   // the hoop turned to the YZ plane
  const q0 = new THREE.Quaternion();
  const lit = [];          // the lit SECTIONS (0..MAXLIT)
  let key = '';

  function pickFans() {
    nFans = 0;
    const crowd = ctx.venues?.crowd ?? [];
    const per = Math.floor(ARMS / 2 / Math.max(1, lit.length));
    for (const sc of lit) {
      const side = sc.side < 0 ? 'left' : 'right';
      let k = 0;
      for (const c of crowd) {
        if (c.side !== side) continue;
        for (const b of c.base) {
          if (b[2] < sc.z0 || b[2] > sc.z1 || k >= per || nFans >= ARMS / 2) continue;
          fanPos[nFans * 4] = b[0]; fanPos[nFans * 4 + 1] = b[1]; fanPos[nFans * 4 + 2] = b[2]; fanPos[nFans * 4 + 3] = b[3];
          nFans++; k++;
        }
      }
    }
  }
  const ringAt = (j, sc, sy) => { p.set(sc.side * (SOUV.RAIL_X - 0.5), 2.2, sc.zc); sv.set(REQ.LEN / 2 + 0.5, sy, 1); rings.setMatrixAt(j, m4.compose(p, qRing, sv)); };

  return {
    // req: the snapshot's mods.stadium.req ({ i, sec, left }) or null; stretch: mods.stadium.stretch ({ i: [..] }) or null.
    set(req, stretch = null) {
      const ids = stretch?.i?.length ? stretch.i : req ? [req.i] : [];
      const k = (stretch ? 's' : 'r') + ids.join(',');
      if (k === key) return;
      key = k; lit.length = 0;
      for (const i of ids) if (SECTIONS[i] && lit.length < MAXLIT) lit.push(SECTIONS[i]);
      const on = lit.length > 0;
      rings.visible = beams.visible = arms.visible = on;
      rings.count = beams.count = lit.length;
      banner.visible = on && !stretch;
      if (!on) return;
      lit.forEach((sc, j) => {
        ringAt(j, sc, 2.2);
        p.set(sc.side * (SOUV.RAIL_X + 1.5), 0.5, sc.zc);
        beams.setMatrixAt(j, m4.compose(p, q0, s1));
      });
      rings.instanceMatrix.needsUpdate = true; beams.instanceMatrix.needsUpdate = true;
      if (banner.visible) {
        const sc = lit[0];
        banner.position.set(sc.side * 76, 10.5, sc.zc);
        banner.rotation.y = sc.side < 0 ? Math.PI / 2 : -Math.PI / 2;   // facing the field
        drawBanner(sc.name);
      }
      pickFans();
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
      if (lit.length) {
        const k = 0.5 + 0.5 * Math.sin(t * 6);
        ringMat.opacity = 0.45 + 0.5 * k;
        beamMat.opacity = 0.22 + 0.25 * (0.5 + 0.5 * Math.sin(t * 3.2));
        for (let j = 0; j < lit.length; j++) ringAt(j, lit[j], 2.2 + 0.35 * k);
        rings.instanceMatrix.needsUpdate = true;
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
    hide() { this.set(null, null); bits.visible = false; puffT = -1; },
    get lit() { return lit[0] ?? null; },
    get litN() { return lit.length; },
  };
}
