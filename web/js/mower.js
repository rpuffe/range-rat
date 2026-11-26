// MOW-E, client view: a ride-on mower (white body, a small FHI flag, a spinning blade deck) and the striped lane decal
// shown during the legacy pass's warning. Low-poly primitives, no assets. Rules live in mowe.js; this only draws the
// snapshot the server sends (mowe.js moweSnap: the legacy pass, the boss or the tame pet).
//
// Council round 11 #1 (builder 1), the boss ("MOW-E Goes Rogue", MOW-E 2.0) adds, all built once and hidden:
//   the catcher bag at its back (0.4 → 1.2 with eaten / CATCHER), the emissive grille (glows red while it can be hit,
//   pulses while stalled, dark while venting), the beacon red (amber when choked or tame), headlights, the three near
//   lanes' hazard stripes (one InstancedMesh), the red scan line to its target (one Line), the plug ring (one
//   InstancedMesh of ticks, a gold sweep for the pull), a shed door that rattles, and the sink. Smoke puffs use the
//   shared confetti pool, tinted. At most +3 draw calls while a boss is live (the stripes show in the build-up, the scan
//   line in the hunt, the ring at the plug: never together).
// It also plays the boss's sound (sfx.js moweEngine, bossLoop, the beeps, the cough, the gurgle), the red screen-edge
// pulse when it hunts you, and the MOW-E TAMED stamp (a say.js STAMP item's show / hide).
import * as THREE from 'three';
import { MOWER, BOSS, BOSS_LINES } from './mowe.js';
import * as SFX from './sfx.js';

const SMOKE = 0x8a8a8a, BLACK = 0x3a3a3a;   // smoke: the confetti pool's paper, tinted (a few, rising)

export function createMower({ scene, confetti = null }) {
  const root = new THREE.Group(); root.name = 'mower'; root.visible = false; scene.add(root);
  const mat = (c, extra) => new THREE.MeshLambertMaterial({ color: c, ...extra });
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };

  // The mower faces -z locally; yaw turns it (mower snapshot yaw: -PI/2 faces +x).
  const body = new THREE.Group(); root.add(body);
  const white = mat(0xf4f1ea), dark = mat(0x2b2b33), blue = mat(0x2d6cc0), flagWhite = mat(0xffffff);
  add(body, new THREE.BoxGeometry(1.3, 0.55, 1.9), white, 0, 0.62, 0.15);           // chassis
  add(body, new THREE.BoxGeometry(1.0, 0.35, 0.8), white, 0, 0.98, 0.45);           // engine hood behind seat
  add(body, new THREE.BoxGeometry(0.7, 0.14, 0.6), dark, 0, 1.0, -0.05);            // seat
  add(body, new THREE.BoxGeometry(0.7, 0.4, 0.12), dark, 0, 1.2, 0.2);              // seat back
  add(body, new THREE.BoxGeometry(0.1, 0.1, 0.5), dark, 0, 1.2, -0.5);              // steering post
  add(body, new THREE.BoxGeometry(0.6, 0.08, 0.08), dark, 0, 1.32, -0.7);           // wheel
  add(body, new THREE.BoxGeometry(1.34, 0.12, 0.4), blue, 0, 0.5, -0.8);            // FHI stripe at the nose
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xd24a3a });
  const beacon = add(body, new THREE.BoxGeometry(0.2, 0.2, 0.2), beaconMat, 0, 1.55, 0.5);   // beacon (blinks)
  const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10).rotateZ(Math.PI / 2);
  for (const [x, z, s] of [[-0.75, 0.75, 1.2], [0.75, 0.75, 1.2], [-0.75, -0.6, 0.8], [0.75, -0.6, 0.8]]) {
    const w = add(body, wheelGeo, dark, x, 0.34 * s, z); w.scale.setScalar(s);
  }
  // FHI flag on a mast (the tame pet wears a small white flag instead)
  add(body, new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), dark, 0.55, 1.6, 0.7);
  const flag = add(body, new THREE.BoxGeometry(0.5, 0.3, 0.02), blue, 0.8, 2.15, 0.7);
  const flagMark = add(body, new THREE.BoxGeometry(0.2, 0.08, 0.025), white, 0.8, 2.15, 0.7);
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
  // ---- the boss's parts (hidden unless a boss) ----
  // The catcher bag at the rear (+z locally): it swells with every ball eaten.
  const bagGeo = new THREE.BoxGeometry(1.1, 0.9, 0.9); bagGeo.translate(0, 0, 0.45);
  const bag = add(body, bagGeo, mat(0x3d5a2a), 0, 0.85, 1.12); bag.visible = false;
  // The intake grille: an emissive red panel on the rear face, above the bag. Its glow is the "hit me now" cue.
  const grilleMat = new THREE.MeshLambertMaterial({ color: 0x3a1010, emissive: 0xff2a1a, emissiveIntensity: 0 });
  const grille = add(body, new THREE.BoxGeometry(0.9, 0.36, 0.05), grilleMat, 0, 1.12, 0.87); grille.visible = false;
  // Headlights (two small bright quads at the nose).
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff3c4 });
  const lamps = [-0.45, 0.45].map(x => { const l = add(body, new THREE.BoxGeometry(0.22, 0.14, 0.04), lampMat, x, 0.75, -0.83); l.visible = false; return l; });

  // The legacy lane decal: a striped band 4 m wide across the field at the lane, with arrows.
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 32;
  const c = cv.getContext('2d');
  for (let i = 0; i < 32; i++) { c.fillStyle = i % 2 ? '#f2c21b' : '#2b2b33'; c.fillRect(i * 16, 0, 16, 32); }
  const tex = new THREE.CanvasTexture(cv); tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(8, 1);
  const decalMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false });
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(MOWER.X1 - MOWER.X0, 4).rotateX(-Math.PI / 2), decalMat);
  decal.position.y = 0.04; decal.visible = false; decal.renderOrder = 2; scene.add(decal);

  // The boss's three near lanes: red-and-white hazard stripes, one InstancedMesh (one draw call), the build-up only.
  const hcv = document.createElement('canvas'); hcv.width = 512; hcv.height = 32;
  const hc = hcv.getContext('2d');
  hc.fillStyle = '#f4f1ea'; hc.fillRect(0, 0, 512, 32); hc.fillStyle = '#d8242a';
  for (let i = -1; i < 17; i++) { hc.beginPath(); hc.moveTo(i * 32, 32); hc.lineTo(i * 32 + 16, 0); hc.lineTo(i * 32 + 32, 0); hc.lineTo(i * 32 + 16, 32); hc.fill(); }
  const htex = new THREE.CanvasTexture(hcv); htex.wrapS = THREE.RepeatWrapping; htex.repeat.set(10, 1);
  const hazMat = new THREE.MeshBasicMaterial({ map: htex, transparent: true, opacity: 0.5, depthWrite: false });
  const hazLanes = new THREE.InstancedMesh(new THREE.PlaneGeometry(BOSS.X1 - BOSS.X0, 3).rotateX(-Math.PI / 2), hazMat, BOSS.LANES.length);
  { const m4 = new THREE.Matrix4(); BOSS.LANES.forEach((z, i) => { m4.makeTranslation((BOSS.X0 + BOSS.X1) / 2, 0.045, z); hazLanes.setMatrixAt(i, m4); }); }
  hazLanes.visible = false; hazLanes.renderOrder = 2; hazLanes.frustumCulled = false; scene.add(hazLanes);

  // The scan line: its sensor to its target, while it hunts (one Line, two points, updated in place).
  const scanGeo = new THREE.BufferGeometry(); scanGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const scanMat = new THREE.LineBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.85, depthTest: false });
  const scan = new THREE.Line(scanGeo, scanMat); scan.visible = false; scan.frustumCulled = false; scan.renderOrder = 3; scene.add(scan);

  // The plug ring: 2.5 m across, ticks (the huddle ring's look) and a gold sweep for the pull. One InstancedMesh.
  const T = 24, step = Math.PI * 2 / T;
  const tickGeo = new THREE.RingGeometry(BOSS.RING_R - 0.22, BOSS.RING_R, 3, 1, 0, step * 0.86).rotateX(-Math.PI / 2);
  const ring = new THREE.InstancedMesh(tickGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }), T * 2);
  ring.visible = false; ring.frustumCulled = false; ring.renderOrder = 2; scene.add(ring);
  const PALE = new THREE.Color(0xf4f1ea), GOLD = new THREE.Color(0xffc34d);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), o0 = new THREE.Vector3(), sc = new THREE.Vector3();
  const tick = (i, k, s) => { q.setFromAxisAngle(up, -k * step + Math.PI / 2); sc.setScalar(s); m4.compose(o0, q, sc); ring.setMatrixAt(i, m4); };
  for (let i = 0; i < T * 2; i++) { tick(i, i % T, i < T ? 1 : 0); ring.setColorAt(i, i < T ? PALE : GOLD); }
  ring.instanceMatrix.needsUpdate = true;
  let ringGold = -1;
  const ringFill = k => {   // show k of the T gold ticks
    if (k === ringGold) return; ringGold = k;
    for (let i = 0; i < T; i++) tick(T + i, i, i < k ? 0.8 : 0);
    ring.instanceMatrix.needsUpdate = true;
  };

  // The shed door: a quad on the shed's front that rattles through the build-up.
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), mat(0x8a8f98, { side: THREE.DoubleSide }));
  door.position.set(BOSS.SHED.x + 2.2, 1.1, BOSS.SHED.z); door.rotation.y = Math.PI / 2; door.visible = false; scene.add(door);

  // Two 4 m orange-and-white cones at x +-64 on the lane, so the lane reads from the yard (the decal alone is a few pixels).
  const coneCv = document.createElement('canvas'); coneCv.width = 8; coneCv.height = 64;
  const cc = coneCv.getContext('2d');
  for (let i = 0; i < 8; i++) { cc.fillStyle = i % 2 ? '#f4f1ea' : '#f26a1b'; cc.fillRect(0, i * 8, 8, 8); }
  const coneTex = new THREE.CanvasTexture(coneCv); coneTex.wrapS = THREE.RepeatWrapping;
  const coneGeo = new THREE.ConeGeometry(0.9, 4, 12, 1, true), coneMat = new THREE.MeshLambertMaterial({ map: coneTex, side: THREE.DoubleSide });
  const cones = [MOWER.X0, MOWER.X1].map(x => {
    const c = new THREE.Mesh(coneGeo, coneMat); c.position.set(x, 2, 0); c.visible = false; scene.add(c); return c;
  });

  // The screen edge: a red inset glow when it hunts you (DOM, no draw call).
  let edge = null;
  const edgeEl = () => {
    if (edge || typeof document === 'undefined') return edge;
    edge = document.createElement('div'); edge.id = 'mowe-edge';
    edge.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:30;opacity:0;transition:opacity .15s;box-shadow:inset 0 0 0 6px rgba(230,30,30,.9),inset 0 0 90px 30px rgba(230,30,30,.55)';
    document.body.appendChild(edge);
    return edge;
  };

  // Sound.
  let engine = null, loop = null, beepT = 0;
  const stopSound = (fade = false) => { engine?.stop(); engine = null; if (loop) { loop.stop(fade); loop = null; } };

  let snap = null, tgt = { x: 0, z: 0, yaw: 0 }, spin = 0, meId = null, hunted = false, smokeT = 0;
  let scanTarget = () => null;
  const cur = { x: 0, z: 0, yaw: 0 };
  const isBoss = () => snap?.kind === 'boss';

  function smoke(n = 18, tint = SMOKE, upV = 3) {
    if (!confetti) return;
    const bx = Math.sin(cur.yaw), bz = Math.cos(cur.yaw);   // the rear (+z local)
    confetti.burst(cur.x + bx * 1.3, 1.2, cur.z + bz * 1.3, { n, secs: 1.6, speed: 1.4, up: upV, tint });
  }

  return {
    root, decal,
    // The server's mower snapshot (mowe.js moweSnap) or null/undefined; me: your player id (the hunt's edge pulse).
    update(s, me = null) {
      const was = snap; snap = s || null; meId = me;
      if (!snap) {
        root.visible = false; decal.visible = false; hazLanes.visible = false; scan.visible = false; ring.visible = false; door.visible = false;
        for (const c of cones) c.visible = false;
        if (edge) edge.style.opacity = '0';
        hunted = false;
        if (was) stopSound(true);
        return;
      }
      const boss = isBoss(), tame = snap.kind === 'tame';
      root.visible = !(boss && snap.out === 'gone') && !(tame && snap.phase === 'done') && !(!boss && !tame && snap.phase === 'done');
      // legacy decal + cones
      decal.visible = !boss && !tame && (snap.phase === 'warn' || snap.phase === 'drive');
      for (const c of cones) { c.visible = decal.visible; c.position.z = snap.lane ?? 0; }
      if (decal.visible) decal.position.set((MOWER.X0 + MOWER.X1) / 2, 0.04, snap.lane);
      // the boss's parts
      bag.visible = grille.visible = boss;
      for (const l of lamps) l.visible = boss;
      hazLanes.visible = boss && snap.phase === 'warn';
      door.visible = boss && (snap.phase === 'warn' || (snap.phase === 'fled' && snap.out === 'gone'));
      ring.visible = boss && snap.phase === 'plug' && !!snap.ring;
      if (ring.visible) { ring.position.set(snap.ring.x, 0.07, snap.ring.z); ringFill(Math.round((snap.plug ?? 0) * T)); }
      scan.visible = boss && snap.phase === 'hunt' && snap.target != null;
      flag.material = tame ? flagWhite : blue; flagMark.visible = !tame;
      hunted = boss && snap.phase === 'hunt' && snap.target != null && snap.target === meId;
      if (edgeEl() && !hunted) edge.style.opacity = '0';
      tgt.x = snap.x; tgt.z = snap.z; tgt.yaw = snap.yaw ?? -Math.PI / 2;   // in place: no per-frame allocation
      if (!was || was.kind !== snap.kind) { cur.x = tgt.x; cur.z = tgt.z; cur.yaw = tgt.yaw; }
      // sound: the boss loop through the fight (it stops dead on a win and fades on a loss), the engine while it runs
      const fighting = boss && (snap.phase === 'harvest' || snap.phase === 'hunt' || snap.phase === 'plug');
      if (fighting) { loop ??= SFX.bossLoop(); loop.set(snap.phase); }
      else if (loop) { loop.stop(!(boss && snap.phase === 'tamed')); loop = null; }
      const engineOn = root.visible && (boss ? snap.out !== 'sink' : true);
      if (engineOn) engine ??= SFX.moweEngine();
      else if (engine) { engine.stop(); engine = null; }
    },
    // Server events the view reacts to (main.js passes them on): hits, shoves, the plug, the pond.
    event(e) {
      if (e.t === 'moweHit') { smoke(14); engine?.cough(); }
      else if (e.t === 'moweShove') { SFX.horn('mower'); setTimeout(() => SFX.horn('mower'), 260); setTimeout(() => SFX.horn('mower'), 520); }
      else if (e.t === 'mower' && e.phase === 'plug') { smoke(18, BLACK, 4); engine?.choke(); }
      else if (e.t === 'mower' && e.phase === 'tamed') engine?.unplug();
      else if (e.t === 'mower' && e.phase === 'pond') SFX.gurgle();
      else if (e.t === 'moweTarget' && e.id != null && e.id === meId) SFX.horn('mower');   // a beep: it's after you
    },
    // The MOW-E TAMED stamp (say.js STAMP): the bell's stamp's look, its own element (board.js is another builder's).
    stamp(on) {
      if (typeof document === 'undefined') return;
      let el = document.getElementById('mowe-stamp');
      if (!el) {
        el = document.createElement('div'); el.id = 'mowe-stamp';
        el.style.cssText = 'position:fixed;left:50%;top:42%;z-index:40;pointer-events:none;text-align:center;opacity:0;transform:translate(-50%,-50%) rotate(-8deg);'
          + 'transition:opacity .2s;font:900 clamp(40px,8vw,100px)/1 system-ui,sans-serif;letter-spacing:.04em;color:#d0202a;border:.09em solid #d0202a;'
          + 'border-radius:.08em;padding:.06em .3em;background:rgba(255,250,235,.85);box-shadow:0 .05em .3em rgba(0,0,0,.35);white-space:nowrap';
        document.body.appendChild(el);
      }
      el.textContent = BOSS_LINES.stamp;
      el.style.opacity = on ? '1' : '0';
      if (on) el.animate?.([{ transform: 'translate(-50%,-50%) rotate(-12deg) scale(2.4)', opacity: 0 }, { transform: 'translate(-50%,-50%) rotate(-8deg) scale(0.94)', opacity: 1, offset: 0.55 },
        { transform: 'translate(-50%,-50%) rotate(-8deg) scale(1)', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)' });
    },
    get hunted() { return hunted; },
    // Where the scan line points: fn(id) → { x, z } of that Rat (main.js knows where everyone is).
    setTargets(fn) { scanTarget = fn; },
    tick(dt, t = 0, ear = null) {
      if (!snap) return;
      const boss = isBoss();
      const k = Math.min(1, dt * 8);
      cur.x += (tgt.x - cur.x) * k; cur.z += (tgt.z - cur.z) * k;
      let dy = tgt.yaw - cur.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); cur.yaw += dy * k;
      const sinking = boss && snap.phase === 'tamed' && (snap.out === 'sink' || snap.out === 'gone');
      const sink = sinking ? snap.sink ?? 0 : 0;
      root.position.set(cur.x, -1.9 * sink, cur.z); root.rotation.set(-0.35 * sink, cur.yaw, 0, 'YXZ');   // nose first into the pond
      const moving = boss || snap.kind === 'tame' ? !!snap.moving : snap.phase === 'drive' && !snap.blocked;
      spin += dt * (moving ? 40 : snap.phase === 'warn' || (boss && (snap.stall || snap.rage)) ? 8 : 0);
      for (const b of blades) b.rotation.y = spin;
      flag.rotation.y = Math.sin(t * 6) * 0.35;
      const choked = boss && (snap.phase === 'plug' || snap.phase === 'tamed');
      beaconMat.color.setHex(snap.kind === 'tame' || choked ? 0xffa21a : 0xff2a1a);
      beacon.visible = Math.sin(t * (boss && !choked ? 16 : 10)) > -0.2;
      body.position.y = moving ? Math.sin(t * 40) * 0.01 : boss && (snap.stall || snap.rage) ? Math.sin(t * 60) * 0.02 : 0;
      if (decal.visible) decalMat.opacity = snap.phase === 'warn' ? 0.35 + 0.25 * (0.5 + 0.5 * Math.sin(t * 8)) : 0.3;
      if (boss) {
        const s = 0.4 + 0.8 * Math.min(1, (snap.eaten ?? 0) / BOSS.CATCHER);
        bag.scale.set(0.8 + 0.2 * s, s, s);
        grilleMat.emissiveIntensity = choked ? 0 : snap.stall && snap.open ? 0.8 + 0.7 * Math.abs(Math.sin(t * 9)) : snap.open ? 0.9 : 0.05;
        if (hazLanes.visible) hazMat.opacity = 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * 8));
        if (door.visible) door.rotation.x = snap.phase === 'warn' ? Math.sin(t * 38) * 0.05 * (1 + (1 - (snap.t ?? 0) / BOSS.WARN) * 2) : 0;
        if (scan.visible) {
          const a = scanGeo.attributes.position.array, tp = scanTarget(snap.target);
          if (tp) { a[0] = cur.x; a[1] = 1.4; a[2] = cur.z; a[3] = tp.x; a[4] = 1.0; a[5] = tp.z; scanGeo.attributes.position.needsUpdate = true; scanMat.opacity = 0.55 + 0.4 * Math.abs(Math.sin(t * 7)); }
          else scan.visible = false;
        }
        if (edge && hunted) edge.style.opacity = String(0.55 + 0.45 * Math.abs(Math.sin(t * 6)));
        // the build-up's beeps: every 2.0 s at 15 s left, every 0.4 s at the end
        if (snap.phase === 'warn') {
          const u = 1 - Math.max(0, snap.t ?? 0) / BOSS.WARN, gap = 2.0 - 1.6 * u;
          if ((beepT -= dt) <= 0) { beepT = gap; SFX.horn('mower'); }
        } else beepT = 0;
        if (snap.phase === 'plug' && (smokeT -= dt) <= 0) { smokeT = 0.8; smoke(4, BLACK, 3); }
        if (snap.phase === 'tamed' && snap.out === 'limp' && (smokeT -= dt) <= 0) { smokeT = 0.7; smoke(6, SMOKE, 2); }
      }
      // the engine: louder near the listener (ear: { x, z }), pitch with how hard it's working
      if (engine) {
        const d = ear ? Math.hypot(ear.x - cur.x, ear.z - cur.z) : 30;
        const speed01 = !moving ? 0 : boss ? (snap.phase === 'hunt' ? 1 : snap.phase === 'tamed' || snap.phase === 'fled' ? 0.45 : 0.7) : 0.55;
        engine.set(speed01, d, boss && (!!snap.stall || !!snap.rage), !boss);
      }
    },
  };
}
