// Council round 14 #1 (builder 2): the Gold Rush's look and sound. Site 13's delivery van backs up to the left net and
// tips a crate over it; a short gold beam stands over every rush ball and shrinks with its clock; Site 13's red cart
// (the caddie cart's shape, recoloured, "13" on the canopy) hums out from the van for the last CART_SECS of a clock and
// takes it, then hums back. The rules are ../goldrush.js; the server is server/venues/goldrush.mjs.
// Xbox budget: the van is 3 meshes; the beams one InstancedMesh; the carts two. Built once, hidden when idle, no
// per-frame allocations. The gold balls themselves are main.js's gold balls (their beacon ring comes free).
import * as THREE from 'three';
import { RUSH, RUSH_ALERT, rushClaimLine, RUSH_SWEEP_LINE, rushCarryLine } from '../goldrush.js';

const MAXB = 6, BACK_SECS = 3, BEAM_H = 10, MERGE_SECS = 3, VAN_SECS = 14;
const GOLD = 0xffc83a, RED = 0xc8262c, WHITE = 0xf6f4ee;

function numberTexture() {              // "13" on the canopy: one small canvas, made once
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#c8262c'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#ffffff'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('13', 32, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default {
  id: 'goldrush',
  venue: 0,
  create(ctx) {
    const root = new THREE.Group(); root.name = 'goldrush'; root.visible = false; ctx.scene.add(root);

    // The van: a red box body, a white cab, a crate on the tail lift. Backed up to the fence, facing away from it.
    const van = new THREE.Group(); van.visible = false;
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 4.6), new THREE.MeshLambertMaterial({ color: RED })); body.position.set(0, 1.5, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.7, 1.6), new THREE.MeshLambertMaterial({ color: WHITE })); cab.position.set(0, 1.15, -3.0);
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), new THREE.MeshLambertMaterial({ color: 0x9a6b3a })); crate.position.set(0, 3.2, 2.0);
    for (const m of [body, cab, crate]) { m.castShadow = false; van.add(m); }
    van.rotation.y = Math.PI / 2;        // its back (+z local) toward the net (+x world)
    root.add(van);

    const beamGeo = new THREE.CylinderGeometry(0.55, 0.9, BEAM_H, 10, 1, true); beamGeo.translate(0, BEAM_H / 2, 0);
    const beams = new THREE.InstancedMesh(beamGeo, new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }), MAXB);
    beams.frustumCulled = false; beams.count = 0; beams.renderOrder = 3; root.add(beams);

    // Site 13's carts: a white body under a red "13" canopy, one instance per ball being claimed (or driving home).
    const bodyGeo = new THREE.BoxGeometry(1.3, 0.8, 2.2); bodyGeo.translate(0, 0.6, 0);
    const roofGeo = new THREE.BoxGeometry(1.4, 0.08, 1.7); roofGeo.translate(0, 1.95, -0.1);
    const tex = numberTexture();
    const carts = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ color: WHITE }), MAXB);
    const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshLambertMaterial(tex ? { map: tex } : { color: RED }), MAXB);
    for (const m of [carts, roofs]) { m.frustumCulled = false; m.count = 0; root.add(m); }

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    const GATE = { x: RUSH.VAN.x + 3, z: RUSH.VAN.z };
    let list = [], held = 0, venue = 0, vanT = -1, claims = 0, claimT = -1;
    const back = [];
    for (let i = 0; i < MAXB; i++) back.push({ x: 0, z: 0, t: -1 });
    const cartAt = (j, x, z, yaw) => {
      q.setFromAxisAngle(up, yaw); p3.set(x, 0, z); s3.set(1, 1, 1);
      m4.compose(p3, q, s3); carts.setMatrixAt(j, m4); roofs.setMatrixAt(j, m4);
    };
    const who = id => (id === ctx.me?.id ? 'You' : ctx.nameOf?.(id) ?? 'A Rat');
    const flushClaims = () => { if (claims > 0) ctx.feed?.(rushClaimLine(claims), '#ff8a80'); claims = 0; claimT = -1; };

    return {
      show(v) { root.visible = v; },
      onSnapshot(s, mine) {
        venue = s?.endless ? 5 : s?.venue ?? 0;
        const on = (venue === 0 || venue === 1) && s?.phase === 'shift';
        list = on ? mine?.balls ?? [] : [];
        held = on ? mine?.held?.[ctx.me?.id] ?? 0 : 0;
        if (!on) vanT = -1;
      },
      onEvent(e) {
        if (e.t !== 'rush') return;
        if (e.phase === 'drop') {
          ctx.say?.('ALERT', RUSH_ALERT, { key: 'goldrush' });   // the one centre ALERT (say.js -> centre.js)
          vanT = 0;
          for (let i = 0; i < 3; i++) setTimeout(() => ctx.SFX?.bell?.(1568), i * 420);   // the van's reversing beep
          for (let i = 0; i < (e.n | 0); i++) setTimeout(() => ctx.SFX?.scoop?.(), 2400 + i * 260);   // a golf-clap a landing
        } else if (e.phase === 'claim') {
          ctx.SFX?.trombone?.();
          claims++; if (claimT < 0) claimT = 0;                 // merged: "Site 13 took 2. For research."
          const b = back.find(o => o.t < 0); if (b) { b.x = e.x; b.z = e.z; b.t = 0; }
        } else if (e.phase === 'take') { if (e.by === ctx.me?.id) ctx.SFX?.glint?.(); }
        else if (e.phase === 'bank') { ctx.feed?.(`${e.by ? who(e.by) : 'Someone'} banked a rush ball! ×10`, '#ffd36b'); ctx.SFX?.jackpot?.(); }
        else if (e.phase === 'dived') ctx.feed?.(`${who(e.by)} dived for the gold!`, '#ffd36b');
        else if (e.phase === 'sweep') { flushClaims(); ctx.feed?.(RUSH_SWEEP_LINE, '#9be88a'); ctx.SFX?.bell?.(1047); }
      },
      tick(dt, t) {
        if (claimT >= 0 && (claimT += dt) >= MERGE_SECS) flushClaims();
        const vis = root.visible && (venue === 0 || venue === 1);
        if (vanT >= 0) vanT += dt;
        const vanOn = vis && vanT >= 0 && vanT < VAN_SECS;
        van.visible = vanOn;
        if (vanOn) {                                            // backs up for 2 s, tips the crate, then idles
          const u = Math.min(1, vanT / 2);
          van.position.set(RUSH.VAN.x - 5 * (1 - u), 0, RUSH.VAN.z);
          crate.rotation.x = vanT > 2 && vanT < 4 ? -Math.sin((vanT - 2) / 2 * Math.PI) * 1.1 : 0;
        }
        let n = 0, c = 0;
        if (vis) {
          const balls = ctx.balls?.();
          for (const e of list) {
            if (n >= MAXB) break;
            const b = balls?.get?.(e.id);
            const x = b ? b.x : e.x, z = b ? b.z : e.z;
            const k = Math.max(0.25, Math.min(1, e.t / RUSH.SECS_1P)) * (1 + 0.06 * Math.sin(t * 6 + n));
            p3.set(x, e.pond ? 0.2 : 0, z); s3.set(k, 0.4 + 0.6 * k, k); q.identity();
            beams.setMatrixAt(n++, m4.compose(p3, q, s3));
            if (e.t < RUSH.CART_SECS && c < MAXB) {             // Site 13's cart hums out from the gate
              const u = 1 - e.t / RUSH.CART_SECS, cx = GATE.x + (x - GATE.x) * u, cz = GATE.z + (z - GATE.z) * u;
              cartAt(c++, cx, cz, Math.atan2(-(x - GATE.x), -(z - GATE.z)));
            }
          }
          for (const o of back) {
            if (o.t < 0 || c >= MAXB) continue;
            o.t += dt;
            if (o.t >= BACK_SECS) { o.t = -1; continue; }
            const u = o.t / BACK_SECS, cx = o.x + (GATE.x - o.x) * u, cz = o.z + (GATE.z - o.z) * u;
            cartAt(c++, cx, cz, Math.atan2(-(GATE.x - o.x), -(GATE.z - o.z)));
          }
        }
        beams.count = n; beams.instanceMatrix.needsUpdate = n > 0;
        carts.count = roofs.count = c;
        if (c) { carts.instanceMatrix.needsUpdate = true; roofs.instanceMatrix.needsUpdate = true; }
      },
      prompt() { return held > 0 && (venue === 0 || venue === 1) ? rushCarryLine(held) : null; },
    };
  },
};
