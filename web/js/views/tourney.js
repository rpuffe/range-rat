// Council round 13 #1 (builder 2): the Members' Tournament's look and sound. Three members in navy blazers at the covered
// bays by the clubhouse (one of them in a Site 13 jacket: they entered anyway), a navy-and-gold beam over every member's
// ball that shrinks with its 30 s clock, and the members' caddie cart: a small white cart that hums out from the clubhouse
// for the last CART_SECS of a ball's clock and takes it. The rules are ../tourney.js; the server is
// server/venues/tourney.mjs. Xbox budget: the members are 3 people.js figures (shared material); the beams are one
// InstancedMesh; the carts are two (body, canopy). Everything is built once, hidden when idle, no per-frame allocations.
import * as THREE from 'three';
import { buildPerson, animatePerson, SWING_SECS } from '../people.js';
import { TOURNEY, teeOf, flightAlert, CLEAN_LINE, CLAIM_LINE, carryLine } from '../tourney.js';

const MAXB = 6, CART_SECS = 6, BACK_SECS = 3, BEAM_H = 18;
const GARAGE = { x: 44, z: 8 };          // where the caddie cart comes from (the cart path by the clubhouse)
const NAVY = 0x1d2a4a, GOLD = 0xffc83a, SITE13 = 0x5b6b7a;

function beamGeometry() {               // an open cylinder, gold with two navy bands (vertex colours: one draw call)
  const g = new THREE.CylinderGeometry(0.7, 1.1, BEAM_H, 12, 6, true); g.translate(0, BEAM_H / 2, 0);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const band = Math.floor(pos.getY(i) / (BEAM_H / 6) + 1e-6);
    c.setHex(band === 1 || band === 3 ? NAVY : GOLD);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export default {
  id: 'tourney',
  venue: 1,
  create(ctx) {
    const root = new THREE.Group(); root.name = 'tourney'; root.visible = false; ctx.scene.add(root);

    // The members: navy blazers (and one Site 13 jacket), at the covered bays nearest the clubhouse.
    const members = [0, 1, 2].map(i => {
      const p = buildPerson({ seed: 'member' + i, shirt: i === 2 ? SITE13 : NAVY, pants: 0xd8d2c0, hat: i === 1 ? 0xf4f1ea : false });
      p.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
      p.setClub(true, 'driver');
      const tee = teeOf(i);
      p.root.position.set(tee.x, 0, tee.z + 0.6); p.root.rotation.y = 0;
      root.add(p.root);
      return { p, swingT: -1 };
    });

    const beams = new THREE.InstancedMesh(beamGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.42, depthWrite: false, side: THREE.DoubleSide }), MAXB);
    beams.frustumCulled = false; beams.count = 0; beams.renderOrder = 3; root.add(beams);

    // The caddie carts: a white body and a navy canopy, one instance each per ball being claimed (or driving home).
    const bodyGeo = new THREE.BoxGeometry(1.3, 0.8, 2.2); bodyGeo.translate(0, 0.6, 0);
    const roofGeo = new THREE.BoxGeometry(1.4, 0.08, 1.7); roofGeo.translate(0, 1.95, -0.1);
    const carts = new THREE.InstancedMesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xf6f4ee }), MAXB);
    const roofs = new THREE.InstancedMesh(roofGeo, new THREE.MeshLambertMaterial({ color: NAVY }), MAXB);
    for (const m of [carts, roofs]) { m.frustumCulled = false; m.count = 0; root.add(m); }

    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    let on = false, list = [], held = 0, venue = 0;
    const back = [];   // carts driving home after a claim: { x, z, t }
    for (let i = 0; i < MAXB; i++) back.push({ x: 0, z: 0, t: -1 });
    const cartAt = (j, x, z, yaw) => {
      q.setFromAxisAngle(up, yaw); p3.set(x, 0, z); s3.set(1, 1, 1);
      m4.compose(p3, q, s3); carts.setMatrixAt(j, m4); roofs.setMatrixAt(j, m4);
    };
    const who = id => (id === ctx.me?.id ? 'You' : ctx.nameOf?.(id) ?? 'A Rat');

    return {
      show(v) { root.visible = v; },
      onSnapshot(s, mine) {
        venue = s?.endless ? 5 : s?.venue ?? 0;
        on = venue === 1 && s?.phase === 'shift' && !!mine?.on;
        list = venue === 1 && s?.phase === 'shift' ? mine?.balls ?? [] : [];
        held = mine?.held?.[ctx.me?.id] ?? 0;
      },
      onEvent(e) {
        if (e.t !== 'tourney') return;
        if (e.phase === 'flight') {
          ctx.say?.('ALERT', flightAlert(e.main, e.bonus), { key: 'tourney' });   // the one centre ALERT a flight (say.js -> centre.js)
          ctx.SFX?.bell?.(659);
          for (let i = 0; i < members.length; i++) members[i].swingT = i * 0.35;      // they tee off, one after another
          setTimeout(() => ctx.SFX?.clap ? ctx.SFX.clap() : ctx.SFX?.scoop?.(), 2600);  // a polite golf-clap as they land
        } else if (e.phase === 'claim') {
          (ctx.SFX?.kazoo ?? ctx.SFX?.trombone)?.();                                   // the kazoo stinger
          ctx.feed?.(CLAIM_LINE);
          const b = back.find(o => o.t < 0); if (b) { b.x = e.x; b.z = e.z; b.t = 0; }
        } else if (e.phase === 'take') { if (e.by === ctx.me?.id) ctx.SFX?.glint?.(); }
        else if (e.phase === 'bank') {
          ctx.feed?.(`${e.by === 'mowe' ? 'MOW-E' : who(e.by)} banked a member's ball! ×${TOURNEY.PAY}`, '#ffd36b');
          ctx.SFX?.jackpot?.();
        } else if (e.phase === 'clean') {
          ctx.feed?.(CLEAN_LINE, '#9be88a'); ctx.SFX?.bell?.(1047);
          ctx.dimples?.('doff');                                                      // the Board's Dimples doffs his monocle (builder 4's hook, if any)
        } else if (e.phase === 'bell') ctx.feed?.(`${who(e.by)} rang the Members' Bell.`, '#ffd36b');
      },
      tick(dt, t) {
        const vis = root.visible && venue === 1;
        for (const m of members) {
          m.p.root.visible = vis && on;
          if (!m.p.root.visible) continue;
          if (m.swingT >= 0) {
            m.swingT += dt;
            const k = m.swingT / SWING_SECS;
            if (k >= 1) m.swingT = -1;
            animatePerson(m.p, dt, k >= 0 && k < 1 ? { mode: 'swing', k } : { mode: 'idle' });
          } else animatePerson(m.p, dt, { mode: 'idle' });
        }
        let n = 0, c = 0;
        if (vis) {
          const balls = ctx.balls?.();
          for (const e of list) {
            if (n >= MAXB) break;
            const b = balls?.get?.(e.id);
            const x = b ? b.x : e.x, z = b ? b.z : e.z;
            const k = Math.max(0.25, Math.min(1, e.t / TOURNEY.SECS)) * (1 + 0.05 * Math.sin(t * 5 + n));
            p3.set(x, e.pond ? 0.2 : 0, z); s3.set(k, 0.4 + 0.6 * k, k); q.identity();
            beams.setMatrixAt(n++, m4.compose(p3, q, s3));
            if (e.t < CART_SECS && c < MAXB) {                       // the caddie cart hums out to it
              const u = 1 - e.t / CART_SECS, cx = GARAGE.x + (x - GARAGE.x) * u, cz = GARAGE.z + (z - GARAGE.z) * u;
              cartAt(c++, cx, cz, Math.atan2(-(x - GARAGE.x), -(z - GARAGE.z)));
            }
          }
          for (const o of back) {
            if (o.t < 0 || c >= MAXB) continue;
            o.t += dt;
            if (o.t >= BACK_SECS) { o.t = -1; continue; }
            const u = o.t / BACK_SECS, cx = o.x + (GARAGE.x - o.x) * u, cz = o.z + (GARAGE.z - o.z) * u;
            cartAt(c++, cx, cz, Math.atan2(-(GARAGE.x - o.x), -(GARAGE.z - o.z)));
          }
        }
        beams.count = n; beams.instanceMatrix.needsUpdate = n > 0;
        carts.count = roofs.count = c;
        if (c) { carts.instanceMatrix.needsUpdate = true; roofs.instanceMatrix.needsUpdate = true; }
      },
      // Carrying a member's ball: where it goes (the HUD prompt, not centre text).
      prompt() { return held > 0 && venue === 1 ? carryLine(held) : null; },
    };
  },
};
