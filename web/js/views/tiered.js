// Tiered Entertainment Range (venue 2), client side: bowl decals, neon pins, the cup tween, gutter glass, the strobe.
// The rules live in web/js/tiered.js (pure) and server/venues/tiered.mjs.
import * as THREE from 'three';
import { MAP } from '../map.js';
import { TARGET, hasGutters } from '../tiered.js';

const FLAG = { red: 0xff3b5c, yellow: 0xffe14a, blue: 0x4aa8ff };

export default {
  id: 'tiered',
  venue: 2,
  create(ctx) {
    const root = new THREE.Group();
    root.name = 'tiered';
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
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 8), pinMat); pin.position.set(b.r * 0.55, 2, 0); g.add(pin);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), pinMat); tip.position.set(b.r * 0.55, 4.1, 0); g.add(tip);
      root.add(g);
      return { b, col, pinMat, glass, strobe: 0 };
    });
    ctx.scene.add(root);
    const tweens = [];
    let t = 0, lastThunk = -1;

    return {
      show(on) { root.visible = on; },
      onSnapshot() {
        const own = hasGutters(ctx.crew()?.up);
        for (const w of bowls) w.glass.visible = own;
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
          (mine ? ctx.toast : ctx.feed)(mine ? `TARGET! Bowl ${e.bowl}: ${e.n} balls flushed. Hustle x${e.mult.toFixed(2)}` : `${ctx.nameOf(e.by)} hit TARGET on Bowl ${e.bowl}: ${e.n} balls`, 3);
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
