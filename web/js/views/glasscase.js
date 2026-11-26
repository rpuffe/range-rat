// Council round 12 #3d (builder 3): the opened Ball No. 1 in a glass case by the return, from the bank on. A plinth
// whose front is a canvas plaque ("BALL No. 1 · 1958–2026 · FOUND BY", the crew's names, the newest four Owners'
// record days), a glass box, and the two gold halves inside. The rules (the spot, the plaque's lines) are pure in
// caserules.js; the server keeps the case (crew.mjs glassCase, in the snapshot and the save).
// Xbox: built once, 3 draw calls (the plinth and its plaque are one mesh: the plinth's other faces sample a wood
// corner of the plaque canvas; the two halves are one InstancedMesh; the glass). The plaque redraws only when a line
// is added. Active at the Orbital and in endless (venue 5); hidden until the crew has a case.
// Also, endless edge text for builder 3's contract and Site 13 (council round 12 #6c, #8): the feed's "Contract lost."
// and "Passed Site 13." with the Board's one flash (no centre text).
import * as THREE from 'three';
import { CASE, plaqueLines } from '../caserules.js';

const PW = 1024, PH = 512;   // the plaque canvas; the corner 0..32 px is solid wood (the plinth's other faces)
const W = 0.9, H = 1.0, D = 0.6;   // the plinth (m)
const GLASS = 0.62;              // the glass box's side (m), on top of the plinth

function drawPlaque(g, lines) {
  g.fillStyle = '#5a3b22'; g.fillRect(0, 0, PW, PH);                       // wood (and the 32 px corner the sides use)
  g.fillStyle = '#c9a24a'; g.fillRect(40, 40, PW - 80, PH - 80);          // the brass plate
  g.fillStyle = '#e6c56c'; g.fillRect(52, 52, PW - 104, PH - 104);
  g.fillStyle = '#2a1d0c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const [head, names, ...rec] = lines;
  g.font = '800 46px Georgia, serif'; g.fillText(head ?? '', PW / 2, 112, PW - 140);
  g.font = 'italic 700 40px Georgia, serif'; g.fillText(names ?? '', PW / 2, 180, PW - 140);
  g.fillRect(PW / 2 - 200, 222, 400, 3);
  g.font = '600 36px Georgia, serif';
  rec.forEach((l, i) => g.fillText(l, PW / 2, 272 + i * 48, PW - 160));
}

export default {
  id: 'glasscase',
  venue: 5,
  create(ctx) {
    let root = null, plaqueG = null, plaqueTex = null, key = '', lost = false, passed = false;
    function build() {
      root = new THREE.Group(); root.name = 'glass-case';
      root.position.set(CASE.x, 0, CASE.z); root.rotation.y = CASE.yaw;
      const c = document.createElement('canvas'); c.width = PW; c.height = PH;
      plaqueG = c.getContext('2d');
      plaqueTex = new THREE.CanvasTexture(c); plaqueTex.colorSpace = THREE.SRGBColorSpace; plaqueTex.anisotropy = 4;
      // The plinth: its +z face (the front, toward the mats after CASE.yaw) shows the plaque; the rest sample the wood corner.
      const geo = new THREE.BoxGeometry(W, H, D);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        const face = Math.floor(i / 4);   // BoxGeometry: +x, −x, +y, −y, +z, −z, 4 vertices each
        if (face !== 4) uv.setXY(i, 0.01, 0.99);
      }
      geo.translate(0, H / 2, 0);
      root.add(new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: plaqueTex })));
      // The two gold halves, open like a locket, on a little stand inside the glass: one InstancedMesh.
      const half = new THREE.SphereGeometry(0.13, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const halves = new THREE.InstancedMesh(half, new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0x7a5410, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide }), 2);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
      halves.setMatrixAt(0, m.compose(p.set(-0.1, H + 0.2, 0), q.setFromEuler(e.set(0, 0, 0.55)), s));          // cup up, tilted
      halves.setMatrixAt(1, m.compose(p.set(0.12, H + 0.26, 0.02), q.setFromEuler(e.set(0, 0, Math.PI - 0.7)), s));   // the lid, open
      root.add(halves);
      // The glass: one transparent box.
      const glass = new THREE.Mesh(new THREE.BoxGeometry(GLASS, GLASS, GLASS * 0.8).translate(0, H + GLASS / 2, 0),
        new THREE.MeshStandardMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.1, depthWrite: false }));
      glass.renderOrder = 2;
      root.add(glass);
      ctx.scene.add(root);
    }
    function paint(gc) {
      const k = JSON.stringify(gc);
      if (k === key) return;
      key = k;
      drawPlaque(plaqueG, plaqueLines(gc));
      plaqueTex.needsUpdate = true;
    }
    return {
      show(on) { if (root && !on) root.visible = false; },
      onSnapshot(s) {
        const gc = s?.glassCase;
        if (!gc) { if (root) root.visible = false; return; }
        if (!root) build();
        root.visible = true;
        paint(gc);
        if (s.phase !== 'shift') { lost = false; passed = false; }
      },
      onEvent(e) {
        if (e.t === 'contractLost' && !lost) { lost = true; ctx.feed?.('Contract lost.'); }
        if (e.t === 'rival' && e.passed && !passed) { passed = true; ctx.feed?.('Passed Site 13.'); ctx.board?.flash?.(true); }
      },
    };
  },
};
