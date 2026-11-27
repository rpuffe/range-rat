// The County's look (council round 4, section 3.3): four back yards past the kerb, picket fences, mailboxes,
// the Gnome and the paddling pool, the right net moved out to 96.5, and the drones. The server module is
// server/venues/county.mjs; the numbers are web/js/county.js.
import * as THREE from 'three';
import { MAP } from '../map.js';
import { DRONES, VAN, vanToast, inspectAlertAt } from '../county.js';
import { armAgain } from '../settings.js';
import { buildPerson, animatePerson } from '../people.js';
import { RIVAL_LOOK } from '../today.js';   // council round 13 #4: Site 13's jacket colour   // council round 12 #7a: the FHI inspector

const Y = MAP.YARDS;
const UP = new THREE.Vector3(0, 1, 0);
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

// Round 11: Zoning's van, a white box van with an orange light bar that drives down the kerb while it tows.
function zoningVan() {
  const g = new THREE.Group();
  g.add(box(2.2, 2.2, 4.6, mat(0xf4f4f0), 0, 1.4, 0.4));
  g.add(box(2.1, 1.4, 1.5, mat(0xe9e9e4), 0, 1.0, -2.6));
  g.add(box(1.9, 0.6, 0.05, mat(0x1d2430), 0, 1.4, -3.36));
  g.add(box(1.6, 0.18, 0.4, new THREE.MeshBasicMaterial({ color: 0xff8a1a }), 0, 2.6, -0.2));
  g.add(box(2.25, 0.5, 2.6, mat(0x2d7a3a), 0, 1.7, 0.8));              // "COUNTY ZONING" green band
  for (const [x, z] of [[-1, -2.4], [1, -2.4], [-1, 1.8], [1, 1.8]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), mat(0x1a1a1a)); w.rotation.z = Math.PI / 2; w.position.set(x, 0.42, z); g.add(w); }
  g.visible = false;
  return g;
}

// Council round 12 #7a: the FHI inspector (a people.js figure in a grey suit, sunglasses, a clipboard) and his patch (a
// chalk-white ring on the grass). Built once, hidden when he's not on site.
function inspector(shirt = 0x5b6470, seed = 'fhi-inspector') {
  const p = buildPerson({ seed, shirt, pants: 0x3a4048, hat: false });
  p.root.traverse(o => { if (o.isMesh) o.castShadow = false; });
  const dark = new THREE.MeshBasicMaterial({ color: 0x111317 });
  const glasses = box(0.2, 0.05, 0.03, dark, 0, 0.12, 0.11);
  p.parts.head?.add(glasses);
  const board = box(0.24, 0.32, 0.03, mat(0xa77b45), -0.12, 0.02, 0.2);
  board.add(box(0.2, 0.24, 0.005, mat(0xf4f1ea), 0, -0.01, 0.02));
  (p.parts.torso?.isObject3D ? p.parts.torso : p.root).add(board);   // held at the chest (armR is a { up, fo } pair, not a node)
  p.root.visible = false;
  return p;
}
// Council round 13 #7a (builder 2): a white clipboard-beam over him for his visit (one mesh, additive, built once), so he
// can be found from the mats. Site 13's inspector on retainer (landmark tier 4) wears their jacket.
const BEAM_H = 22;
const beamMesh = () => {
  const g = new THREE.CylinderGeometry(0.5, 0.9, BEAM_H, 12, 1, true); g.translate(0, BEAM_H / 2, 0);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  m.renderOrder = 3; m.visible = false; m.frustumCulled = false;
  return m;
};
const NUDGE = { SECS: 2, YAW: 15 * Math.PI / 180 };   // 1P only: the camera eases 15° toward him for 2 s (control stays)
const ringMesh = () => {
  const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.05; m.renderOrder = 2; m.visible = false;
  return m;
};

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
    // Round 11: hazards (the wet ones repaint as 'hazwet' client-side), the van, the first-time lines.
    const van = zoningVan(); root.add(van);
    let vanAt = null, wet = new Set(), hz = false, vanSaid = false;
    const fhi = inspector(); root.add(fhi.root);              // council round 12 #7a
    const patch = ringMesh(); root.add(patch);
    const beam = beamMesh(); root.add(beam);                 // council round 13 #7a
    const site13 = inspector(RIVAL_LOOK.hex, 'site13-inspector'); root.add(site13.root);   // council round 13 #4: the retainer, in Site 13's jacket
    let ins = null, insTh = 0, solo = false, nudge = -1, nudgeYaw = 0;
    const setKind = (id, k) => { const b = ctx.balls?.()?.get(id); if (b && b.kind !== k) b.kind = k; };

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
        // Round 11: the wet list, the van's progress down the kerb.
        hz = !!mine?.hz; vanAt = mine?.van ?? null;
        ins = s?.phase === 'shift' ? mine?.inspect ?? null : null;   // council round 12 #7a: { x, z, r, t, n }
        solo = (s?.players?.filter?.(p => p.online !== false && !p.helper)?.length ?? 2) <= 1;
        if (ins) { patch.position.x = ins.x; patch.position.z = ins.z; patch.scale.set(ins.r, ins.r, 1); }
        if (s?.phase !== 'shift') vanSaid = false;
        const now = new Set(mine?.wet ?? []);
        for (const id of wet) if (!now.has(id)) setKind(id, 'hazard');
        for (const id of now) setKind(id, 'hazwet');
        wet = now;
      },
      onEvent(e) {
        if (e.t === 'buy' && e.id === 'drones') { ctx.SFX.jackpot?.(); ctx.toast?.('Drones deployed. The crowd goes mild.', 3); }
        else if (e.t === 'quota' && e.venue === 4 && !e.hit && e.cause === 'haz') armAgain('hazard');   // council round 11 #2: the tip comes back tomorrow
        else if (e.t === 'hazard') setKind(e.id, 'hazard');
        else if (e.t === 'hazwet') setKind(e.id, 'hazwet');
        else if (e.t === 'inspect') {                              // council round 12 #7a: the one centre ALERT, then the feed
          if (e.phase === 'start') {
            ctx.say?.('ALERT', inspectAlertAt(e.x, e.z), { key: 'inspect' }); ctx.SFX?.horn?.('gary');   // council round 13 #7a: the ALERT names his place
            ctx.chevron?.(e.x, e.z, 3);                              // builder 1's screen-edge chevron, toward him
            if (solo && ctx.me) { nudge = 0; const a = Math.atan2(-(e.x - ctx.me.x), -(e.z - ctx.me.z)); nudgeYaw = Math.sign(Math.atan2(Math.sin(a - (ctx.camera?.rotation?.y ?? 0)), Math.cos(a - (ctx.camera?.rotation?.y ?? 0)))); } ctx.feed?.(`FHI inspector on site: ${e.n ?? 0} hazards in his patch.`, '#ffd36b'); }
          else ctx.feed?.(e.clean ? 'The inspector left impressed. Zoning approves.' : `The inspector noted ${e.noted} hazard${e.noted === 1 ? '' : 's'}. They count double.`, e.clean ? '#9be88a' : undefined);
        }
        else if (e.t === 'hazgone') setKind(e.id, 'range');
        else if (e.t === 'hazbag') {
          const who = e.by === ctx.me?.id ? 'You' : ctx.nameOf?.(e.by) ?? 'A Rat';
          if (e.sweep) { ctx.feed?.(`CLEAN SWEEP! ${who}: three in six seconds. Double!`, '#9be88a'); ctx.SFX?.bell?.(1047); }   // council round 12 #7b
          else ctx.feed?.(`${who} bagged a hazard${e.team ? ' (team job)' : ''}${e.insp ? '. Inspected: triple!' : '. Zoning approves.'}`);
          if (e.by === ctx.me?.id) ctx.SFX?.glint?.();
        } else if (e.t === 'van') {
          if (!vanSaid) { vanSaid = true; ctx.toast?.(vanToast(e.n), 3); }   // council round 11 #2: the first tow says why
          else ctx.feed?.(`Zoning towed ${e.n} more balls. Bag the hazards!`);
        }
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
        const who = ins?.who ? site13 : fhi;                        // council round 13 #4: the retainer's visit is Site 13's man
        (who === fhi ? site13 : fhi).root.visible = false;
        who.root.visible = patch.visible = beam.visible = root.visible && !!ins;   // council round 12 #7a: he walks a slow loop round his patch
        const fhi_ = who;
        if (fhi_.root.visible) {
          insTh += dt * 1.1 / Math.max(2, ins.r * 0.6);
          const rr = ins.r * 0.6, x = ins.x + Math.cos(insTh) * rr, z = ins.z + Math.sin(insTh) * rr;
          fhi_.root.position.set(x, 0, z); fhi_.root.rotation.y = Math.atan2(-Math.sin(insTh), Math.cos(insTh));
          animatePerson(fhi_, dt, { mode: 'walk', speed: 1.1 });
          beam.position.set(x, 0, z);
          const k = Math.max(0.3, Math.min(1, (ins.t ?? 0) / Math.max(1, ins.secs ?? 60)));   // it narrows as his visit runs out
          beam.scale.set(k, 1, k); beam.material.opacity = 0.22 + 0.14 * (0.5 + 0.5 * Math.sin(t * 3));
          patch.material.opacity = 0.45 + 0.3 * (0.5 + 0.5 * Math.sin(t * 4));
        }
        van.visible = root.visible && vanAt != null;                 // down the kerb, top to bottom, over VAN.SECS
        if (van.visible) { const u = Math.min(1, vanAt / VAN.SECS); van.position.set(MAP.KERB_X - 3, 0, 5 + (Y.zMin - 5) * u); van.rotation.y = 0; }
      },
      // Council round 13 #7a: solo, the camera eases toward him for NUDGE.SECS (added after main.js placed it; never
      // consumes the camera, so the player keeps control and the yaw they steer is untouched).
      camera(cam, dt) {
        if (nudge < 0 || !root.visible) return false;
        nudge += dt;
        if (nudge >= NUDGE.SECS) { nudge = -1; return false; }
        cam.rotateOnWorldAxis?.(UP, nudgeYaw * NUDGE.YAW * Math.sin(Math.PI * nudge / NUDGE.SECS));
        return false;
      },
      // Round 11: next to a hazard ball, say what it needs.
      prompt(btn) {
        if (!hz || !root.visible || !ctx.me) return null;
        let near = null, nd = 3;
        for (const b of ctx.balls?.()?.values?.() ?? []) {
          if (b.kind !== 'hazard' && b.kind !== 'hazwet') continue;
          const d = Math.hypot(b.x - ctx.me.x, b.z - ctx.me.z);
          if (d < nd) { nd = d; near = b; }
        }
        if (!near) return null;
        if (near.kind === 'hazwet') return `${btn}  Bag the hazard (it's wet)`;
        return ctx.me.wand ? 'Hazard ball: spray it, then bag it' : 'Hazard ball: spray it first (the washer wand)';
      },
    };
  },
};
