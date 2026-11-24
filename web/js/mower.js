// MOW-E, client view: a ride-on mower (white body, a small FHI flag, a spinning blade deck)
// and the striped lane decal shown during the warning. Low-poly primitives, no assets.
// Rules live in mowe.js; this only draws the snapshot the server sends.
import * as THREE from 'three';
import { MOWER } from './mowe.js';

export function createMower({ scene }) {
  const root = new THREE.Group(); root.name = 'mower'; root.visible = false; scene.add(root);
  const mat = (c, extra) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };

  // The mower faces -z locally; yaw turns it (mower snapshot yaw: -PI/2 faces +x).
  const body = new THREE.Group(); root.add(body);
  const white = mat(0xf4f1ea), dark = mat(0x2b2b33), red = mat(0xd24a3a), blue = mat(0x2d6cc0);
  add(body, new THREE.BoxGeometry(1.3, 0.55, 1.9), white, 0, 0.62, 0.15);           // chassis
  add(body, new THREE.BoxGeometry(1.0, 0.35, 0.8), white, 0, 0.98, 0.45);           // engine hood behind seat
  add(body, new THREE.BoxGeometry(0.7, 0.14, 0.6), dark, 0, 1.0, -0.05);            // seat
  add(body, new THREE.BoxGeometry(0.7, 0.4, 0.12), dark, 0, 1.2, 0.2);              // seat back
  add(body, new THREE.BoxGeometry(0.1, 0.1, 0.5), dark, 0, 1.2, -0.5);              // steering post
  add(body, new THREE.BoxGeometry(0.6, 0.08, 0.08), dark, 0, 1.32, -0.7);           // wheel
  add(body, new THREE.BoxGeometry(1.34, 0.12, 0.4), blue, 0, 0.5, -0.8);            // FHI stripe at the nose
  add(body, new THREE.BoxGeometry(0.2, 0.2, 0.2), red, 0, 1.55, 0.5);               // beacon (blinks)
  const beacon = body.children[body.children.length - 1];
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10).rotateZ(Math.PI / 2);
  for (const [x, z, s] of [[-0.75, 0.75, 1.2], [0.75, 0.75, 1.2], [-0.75, -0.6, 0.8], [0.75, -0.6, 0.8]]) {
    const w = add(body, wheelGeo, dark, x, 0.34 * s, z); w.scale.setScalar(s);
  }
  // FHI flag on a mast
  add(body, new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), dark, 0.55, 1.6, 0.7);
  const flag = add(body, new THREE.BoxGeometry(0.5, 0.3, 0.02), blue, 0.8, 2.15, 0.7);
  add(body, new THREE.BoxGeometry(0.2, 0.08, 0.025), white, 0.8, 2.15, 0.7);
  // Blade deck out front, with a spinning blade
  const deck = new THREE.Group(); deck.position.set(0, 0.28, -1.5); body.add(deck);
  add(deck, new THREE.BoxGeometry(2.2, 0.18, 0.9), mat(0xe2ded3), 0, 0, 0);
  const blades = [];
  for (const x of [-0.55, 0.55]) {
    const g = new THREE.Group(); g.position.set(x, -0.1, 0); deck.add(g);
    add(g, new THREE.BoxGeometry(0.95, 0.03, 0.12), mat(0xb8bcc4), 0, 0, 0);
    add(g, new THREE.BoxGeometry(0.12, 0.03, 0.95), mat(0xb8bcc4), 0, 0.005, 0);
    blades.push(g);
  }

  // The lane decal: a striped band 4 m wide across the field at the lane, with arrows.
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 32;
  const c = cv.getContext('2d');
  for (let i = 0; i < 32; i++) { c.fillStyle = i % 2 ? '#f2c21b' : '#2b2b33'; c.fillRect(i * 16, 0, 16, 32); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(8, 1);
  const decalMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(MOWER.X1 - MOWER.X0, 4).rotateX(-Math.PI / 2), decalMat);
  decal.position.y = 0.04; decal.visible = false; decal.renderOrder = 2; scene.add(decal);

  // Two 4 m orange-and-white cones at x +-64 on the lane, so the lane reads from the yard (the decal alone is a few pixels).
  const coneCv = document.createElement('canvas'); coneCv.width = 8; coneCv.height = 64;
  const cc = coneCv.getContext('2d');
  for (let i = 0; i < 8; i++) { cc.fillStyle = i % 2 ? '#f4f1ea' : '#f26a1b'; cc.fillRect(0, i * 8, 8, 8); }
  const coneTex = new THREE.CanvasTexture(coneCv); coneTex.wrapS = THREE.RepeatWrapping;
  const coneGeo = new THREE.ConeGeometry(0.9, 4, 12, 1, true), coneMat = new THREE.MeshLambertMaterial({ map: coneTex, side: THREE.DoubleSide });
  const cones = [MOWER.X0, MOWER.X1].map(x => {
    const c = new THREE.Mesh(coneGeo, coneMat); c.position.set(x, 2, 0); c.visible = false; scene.add(c); return c;
  });

  let snap = null, tgt = { x: 0, z: 0, yaw: 0 }, spin = 0;
  const cur = { x: 0, z: 0, yaw: 0 };

  return {
    root, decal,
    // The server's mower snapshot (mowerSnap) or null/undefined.
    update(s) {
      const was = snap; snap = s || null;
      if (!snap) { root.visible = false; decal.visible = false; for (const c of cones) c.visible = false; return; }
      root.visible = true;
      decal.visible = snap.phase === 'warn' || snap.phase === 'drive';
      for (const c of cones) { c.visible = decal.visible; c.position.z = snap.lane; }
      decal.position.set((MOWER.X0 + MOWER.X1) / 2, 0.04, snap.lane);
      // while warning the server sends the shed-to-start roll-out position
      tgt = { x: snap.x, z: snap.z, yaw: snap.yaw ?? -Math.PI / 2 };
      if (!was) { cur.x = tgt.x; cur.z = tgt.z; cur.yaw = tgt.yaw; }
    },
    tick(dt, t = 0) {
      if (!snap) return;
      const k = Math.min(1, dt * 8);
      cur.x += (tgt.x - cur.x) * k; cur.z += (tgt.z - cur.z) * k;
      let dy = tgt.yaw - cur.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cur.yaw += dy * k;
      root.position.set(cur.x, 0, cur.z); root.rotation.y = cur.yaw;
      const driving = snap.phase === 'drive' && !snap.blocked;
      spin += dt * (driving ? 40 : snap.phase === 'warn' ? 6 : 0);
      for (const b of blades) b.rotation.y = spin;
      flag.rotation.y = Math.sin(t * 6) * 0.35;
      beacon.visible = snap.phase !== 'done' && Math.sin(t * 10) > -0.2;
      body.position.y = driving ? Math.sin(t * 40) * 0.01 : 0;
      if (decal.visible) decalMat.opacity = snap.phase === 'warn' ? 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 8)) : 0.3;
    },
  };
}
