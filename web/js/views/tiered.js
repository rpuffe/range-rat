// Tiered Entertainment Range (venue 2), client side: bowl decals, neon pins, the cup tween, gutter glass, the strobe.
// Council round 6 (#4): 10 m pins with a flag showing the cup's count, light pillars over every bowl, and the
// landing ring at a crew bay (aim.js predicts where a PURE strike rests).
// The rules live in web/js/tiered.js (pure) and server/venues/tiered.mjs.
import * as THREE from 'three';
import { MAP } from '../map.js';
import { TARGET, hasGutters } from '../tiered.js';
import { AIM, createAimer, ringBowl, flagNormal, cupWarn } from '../aim.js';

const FLAG = { red: 0xff3b5c, yellow: 0xffe14a, blue: 0x4aa8ff };
const PIN_H = 10, PIN_R = 0.125, PILLAR_H = 30, FLAG_W = 2.6, FLAG_H = 2;   // the flag reads at 150 m

// The flag's canvas: the bowl's colour with the cup's count on a plate (red plate at the cup's share of the pass line).
function drawFlag(f, n) {
  const { g, size, col } = f, warn = n >= cupWarn();
  g.fillStyle = '#' + col.toString(16).padStart(6, '0'); g.fillRect(0, 0, size, size);
  g.fillStyle = warn ? '#d0202a' : '#fff8e6';
  g.beginPath(); g.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = warn ? '#ffffff' : '#14161c'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const s = String(Math.min(99, n));
  g.font = `900 ${Math.round(size * (s.length > 1 ? 0.42 : 0.52))}px system-ui, sans-serif`;
  g.fillText(s, size / 2, size / 2 + size * 0.03);
  f.tex.needsUpdate = true;
}

export default {
  id: 'tiered',
  venue: 2,
  create(ctx) {
    const root = new THREE.Group();
    root.name = 'tiered';
    const low = !!ctx.perf?.low;
    const flagPx = low ? 32 : 64;
    const pinGeo = new THREE.CylinderGeometry(PIN_R, PIN_R, PIN_H, 8);
    const flagGeo = new THREE.PlaneGeometry(FLAG_W, FLAG_H).translate(FLAG_W / 2, 0, 0);   // hangs off the pole
    const bowls = MAP.BOWLS.map(b => {
      const col = FLAG[b.flag] ?? 0xffffff;
      const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
      const mk = (geo, mat, y) => { const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); return m; };
      mk(new THREE.CircleGeometry(b.r, 48), new THREE.MeshBasicMaterial({ color: 0x1c5a3a, transparent: true, opacity: 0.45, depthWrite: false }), 0.02);
      mk(new THREE.RingGeometry(b.r - 0.35, b.r, 48), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.8, depthWrite: false }), 0.03);
      mk(new THREE.CircleGeometry(b.cup * 1.1, 24), new THREE.MeshBasicMaterial({ color: 0x0a0a12 }), 0.04);
      const glass = mk(new THREE.RingGeometry(b.cup * 1.1, b.cup * 1.35, 24), new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, depthWrite: false }), 0.06);
      glass.visible = false;
      const pinMat = new THREE.MeshBasicMaterial({ color: col });
      const px = b.r * 0.55;
      const pin = new THREE.Mesh(pinGeo, pinMat); pin.position.set(px, PIN_H / 2, 0); g.add(pin);
      // The flag: a canvas redrawn only when the cup's count changes, facing both crew bays.
      const c = document.createElement('canvas'); c.width = c.height = flagPx;
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const flag = new THREE.Mesh(flagGeo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
      const n = flagNormal(b);
      flag.position.set(px, PIN_H - FLAG_H / 2 - 0.1, 0); flag.rotation.y = Math.atan2(n.x, n.z);
      g.add(flag);
      root.add(g);
      const f = { g: c.getContext('2d'), size: flagPx, col, tex, n: 0 };
      drawFlag(f, 0);
      return { b, col, pinMat, glass, strobe: 0, flag: f, pinAt: { x: b.x + px, z: b.z } };
    });
    // Light pillars: one InstancedMesh for all three bowls (the gold-ball beacon's material, in each flag's colour).
    const pillars = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.35, 0.9, PILLAR_H, 12, 1, true).translate(0, PILLAR_H / 2, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
      bowls.length);
    const m4 = new THREE.Matrix4(), c3 = new THREE.Color();
    bowls.forEach((w, i) => { m4.makeTranslation(w.pinAt.x, 0, w.pinAt.z); pillars.setMatrixAt(i, m4); pillars.setColorAt(i, c3.setHex(w.col)); });
    pillars.instanceMatrix.needsUpdate = true; if (pillars.instanceColor) pillars.instanceColor.needsUpdate = true;
    pillars.frustumCulled = false;
    root.add(pillars);
    // The landing ring: where a PURE strike rests, in your colour; the bowl's colour while it would score.
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(AIM.RING_R - AIM.RING_W / 2, AIM.RING_R + AIM.RING_W / 2, 40), ringMat);
    ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 3;
    root.add(ring);
    const aimer = createAimer({ hz: low ? AIM.LOW_HZ : AIM.HZ, now: () => performance.now() });
    ctx.scene.add(root);
    const tweens = [];
    let t = 0, lastThunk = -1;

    return {
      show(on) { root.visible = on; if (!on) { ring.visible = false; aimer.update(null); } },
      onSnapshot(s, mine) {
        const own = hasGutters(ctx.crew()?.up);
        bowls.forEach((w, i) => {
          w.glass.visible = own;
          const n = Math.max(0, mine?.cups?.[i] | 0);
          if (n !== w.flag.n) { w.flag.n = n; drawFlag(w.flag, n); }
        });
      },
      // main.js, every frame: { bay, yaw, pitch, power, color, world } while you stand at a crew bay with balls, else null.
      aim(input) {
        const rest = aimer.update(input);
        ring.visible = !!rest;
        if (!rest) return;
        ring.position.set(rest.x, 0.08, rest.z);
        const bowl = ringBowl(rest);
        ringMat.color.set(bowl ? FLAG[bowl.flag] ?? 0xffffff : input.color ?? '#ffffff');
        ringMat.opacity = bowl ? 0.8 : 0.5;
      },
      onEvent(e) {
        if (e.t === 'cup') {
          const b = ctx.balls().get(e.id);
          if (!b) return;
          const d = Math.hypot(e.x - b.x, e.z - b.z);
          tweens.push({ id: e.id, fx: b.x, fz: b.z, tx: e.x, tz: e.z, age: 0, dur: Math.max(0.05, d / TARGET.TWEEN_SPEED) });
        } else if (e.t === 'target') {
          const w = bowls.find(x => x.b.id === e.bowl);
          if (w) w.strobe = TARGET.STROBE;
          ctx.SFX.jackpot?.();
          const mine = e.by === ctx.me.id;
          (mine ? ctx.toast : ctx.feed)(mine ? `TARGET! +${e.n} ball${e.n === 1 ? '' : 's'}` : `${ctx.nameOf(e.by)} hit TARGET on Bowl ${e.bowl}: ${e.n} balls`, 3);
        } else if (e.t === 'gutter' && t - lastThunk > 0.4) { lastThunk = t; ctx.SFX.bonk?.(); }
      },
      tick(dt, now) {
        t = now ?? t + dt;
        for (let i = tweens.length - 1; i >= 0; i--) {
          const w = tweens[i], b = ctx.balls().get(w.id);
          if (!b) { tweens.splice(i, 1); continue; }
          w.age += dt;
          const k = Math.min(1, w.age / w.dur);
          b.x = w.fx + (w.tx - w.fx) * k; b.z = w.fz + (w.tz - w.fz) * k; b.y = 0.06;
          if (k >= 1) tweens.splice(i, 1);
        }
        for (const w of bowls) {
          if (w.strobe > 0) { w.strobe = Math.max(0, w.strobe - dt); w.pinMat.color.setHex(Math.floor(w.strobe * 10) % 2 ? 0xffffff : w.col); }
          else w.pinMat.color.setHex(w.col);
        }
      },
      reportLines: r => (r?.targets > 0 ? [`Target Practice: ${r.targets} direct hit${r.targets === 1 ? '' : 's'}`] : []),
    };
  },
};
