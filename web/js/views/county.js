// The County's look (council round 4, section 3.3): four back yards past the kerb, picket fences, mailboxes,
// the Gnome and the paddling pool, the right net moved out to 96.5, and the drones. The server module is
// server/venues/county.mjs; the numbers are web/js/county.js.
import * as THREE from 'three';
import { MAP } from '../map.js';
import { DRONES } from '../county.js';

const Y = MAP.YARDS;
const mat = (color, o = {}) => new THREE.MeshLambertMaterial({ color, ...o });

function box(w, h, d, m, x, y, z) { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; }

function mailbox(x, z) {
  const g = new THREE.Group();
  g.add(box(0.12, 1.1, 0.12, mat(0x6b4a2b), 0, 0.55, 0));
  const body = box(0.34, 0.3, 0.55, mat(0x2f5da8), 0, 1.2, 0);
  const flag = box(0.05, 0.3, 0.05, mat(0xd9382b), 0.2, 1.35, 0.1);
  g.add(body, flag);
  g.position.set(x, 0, z);
  return g;
}

function gnome(x, z) {
  const g = new THREE.Group();
  g.add(box(0.5, 0.5, 0.4, mat(0x2e6fb5), 0, 0.25, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat(0xf0c9a0)); head.position.y = 0.62; g.add(head);
  const beard = box(0.3, 0.22, 0.1, mat(0xf5f5f0), 0, 0.5, 0.17); g.add(beard);
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 10), mat(0xd9382b)); hat.position.y = 0.97; g.add(hat);
  g.position.set(x, 0, z);
  return g;
}

function fence(z) {                       // pickets across x with an open gate in the middle (a 5 m gap)
  const g = new THREE.Group(), wood = mat(0xf2efe6);
  const gate = 4;                         // half-width of the gate gap around the yard's centre line
  const mid = (Y.xMin + Y.xMax) / 2;
  for (let x = Y.xMin + 0.5; x < Y.xMax; x += 0.7) {
    if (Math.abs(x - mid) < gate / 2) continue;
    g.add(box(0.14, 1.0, 0.06, wood, x, 0.5, z));
  }
  for (const [a, b] of [[Y.xMin, mid - gate / 2], [mid + gate / 2, Y.xMax]]) g.add(box(b - a, 0.08, 0.08, wood, (a + b) / 2, 0.75, z));
  return g;
}

function drone() {
  const g = new THREE.Group(), dark = mat(0x333940);
  g.add(box(0.7, 0.18, 0.7, dark, 0, 0, 0));
  const rotors = [];
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const arm = box(0.7, 0.05, 0.05, dark, sx * 0.4, 0, sz * 0.4); arm.rotation.y = sx * sz * Math.PI / 4; arm.scale.x = 0.9; g.add(arm);
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.02, 14), mat(0xbfc7d1, { transparent: true, opacity: 0.55 }));
    r.position.set(sx * 0.62, 0.12, sz * 0.62); g.add(r); rotors.push(r);
  }
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.3, 10, 1, true), mat(0xc9a15a, { side: THREE.DoubleSide }));
  basket.position.y = -0.55; g.add(basket);
  for (const sx of [-1, 1]) g.add(box(0.02, 0.45, 0.02, dark, sx * 0.22, -0.3, 0));
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 })); led.position.set(0, 0.02, 0.37); g.add(led);
  return { g, rotors, basket };
}

export default {
  id: 'county',
  venue: 4,

  create(ctx) {
    const root = new THREE.Group(); root.name = 'county'; root.visible = false;
    ctx.scene.add(root);

    // The lawns: four yards of a slightly different green, so the fences read from the cart-less far side.
    const W = Y.xMax - Y.xMin, edges = [Y.zMax, ...Y.FENCES, Y.zMin];
    const greens = [0x5fa84a, 0x68b153, 0x5aa044, 0x6bb056];
    for (let i = 0; i < 4; i++) {
      const z0 = edges[i], z1 = edges[i + 1] ?? Y.zMin, d = Math.abs(z1 - z0);
      const lawn = new THREE.Mesh(new THREE.PlaneGeometry(W, d), mat(greens[i], { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      lawn.rotation.x = -Math.PI / 2; lawn.position.set((Y.xMin + Y.xMax) / 2, 0.02, (z0 + z1) / 2);
      root.add(lawn);
    }
    // The kerb: a low concrete strip along x 64.5 ("County Ordinance 1971: no vehicles on residential lawns").
    root.add(box(0.5, 0.25, Math.abs(Y.zMax - Y.zMin), mat(0xb9b6ad), Y.xMin + 0.25, 0.12, (Y.zMax + Y.zMin) / 2));
    for (const z of Y.FENCES) root.add(fence(z));
    for (const m of Y.MAILBOXES) root.add(mailbox(m.x, m.z));
    root.add(gnome(Y.GNOME.x, Y.GNOME.z));
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(Y.POOL.r, Y.POOL.r, 0.25, 24), mat(0x4aa3e0, { transparent: true, opacity: 0.9 }));
    pool.position.set(Y.POOL.x, 0.13, Y.POOL.z); root.add(pool);
    // The "Yard N" signs, on a post at each yard's gate end.
    for (let i = 0; i < 4; i++) {
      const z = ((edges[i] + (edges[i + 1] ?? Y.zMin)) / 2);
      root.add(box(0.1, 1.6, 0.1, mat(0x6b4a2b), Y.xMin + 1.2, 0.8, z + 8));
      root.add(box(1.1, 0.5, 0.06, mat(0x2d7a3a), Y.xMin + 1.2, 1.65, z + 8));
    }

    // Drones, one mesh per snapshot entry.
    const drones = new Map();
    let spin = 0;

    const stand = ctx.venues?.stands?.right ?? null;
    const net = ctx.rightNet ?? null;
    const net0 = net ? net.position.x : null;
    const poles = ctx.rightPoles ?? null;                      // scenery's right-side poles (one InstancedMesh)

    return {
      show(on) {
        root.visible = on;
        if (stand) stand.visible = !on;                          // "relocated to the County Fair"
        if (net) net.position.x = on ? Y.NET_X : net0;           // the right net comes down, and goes up at 96.5
        if (poles) poles.position.x = on ? Y.NET_X - MAP.NETS.side : 0;   // and its poles go with it
      },
      onSnapshot(s, mine) {
        const list = mine?.drones ?? [];
        const seen = new Set();
        for (const d of list) {
          let e = drones.get(d.id);
          if (!e) { e = drone(); e.to = { x: d.x, y: d.y, z: d.z }; e.g.position.set(d.x, d.y, d.z); root.add(e.g); drones.set(d.id, e); }
          e.to = { x: d.x, y: d.y, z: d.z }; e.yaw = d.yaw; e.n = d.n || 0; seen.add(d.id);
        }
        for (const [id, e] of drones) if (!seen.has(id)) { root.remove(e.g); drones.delete(id); }
      },
      onEvent(e) {
        if (e.t === 'buy' && e.id === 'drones') { ctx.SFX.jackpot?.(); ctx.toast?.('Drones deployed. The crowd goes mild.', 3); }
      },
      tick(dt, t) {
        spin += dt;
        ctx.SFX?.droneBuzz?.(root.visible ? drones.size : 0);   // capped at 3 voices in sfx.js
        for (const e of drones.values()) {
          const k = Math.min(1, dt * 8);
          e.g.position.x += (e.to.x - e.g.position.x) * k;
          e.g.position.y += (e.to.y - e.g.position.y) * k + Math.sin(t * 6 + e.to.x) * 0.002;
          e.g.position.z += (e.to.z - e.g.position.z) * k;
          e.g.rotation.y = e.yaw ?? 0;
          e.g.rotation.z = Math.sin(t * 3) * 0.04;
          e.basket.visible = true;
          e.basket.scale.y = 1 + Math.min(1, (e.n || 0) / DRONES.POCKET);   // the basket fills
          for (const r of e.rotors) r.rotation.y = spin * (e.n ? 60 : 45);
        }
      },
      prompt() { return null; },
    };
  },
};
