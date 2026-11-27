// Endless, client side (council round 7, #9): the Owner's projects you can see. Crew colours repaint the stand, the
// Board frame and the carts (one stripe a Rat, in join order); the statue is a bronze Rat holding Ball No. 1 by the
// stand, the crew's names on the plinth. The rules live in web/js/owner.js (pure) and server/crew.mjs.
// Xbox: the paint is vertex colour on one merged mesh per surface (stand, Board trim, each cart: no textures); the
// statue is one merged mesh (< 2k triangles) plus its name plate (off on the low tier).
import * as THREE from 'three';
import { SIM } from '../sim.js';
import { BOARD_YAW } from '../signs.js';
import { hasPaint, hasStatue, crewStripes, POACH_CARD, POACH_BAY, regularsShown } from '../owner.js';
import { buildPerson, animatePerson, SWING_SECS } from '../people.js';   // council round 14 #5b: Site 13's regulars

const STATUE = { x: 29.6, z: 5.4 };   // east of the stand, short of the cart park (CART.PARK 31, 10)
const BRONZE = 0x8c5a2b, BRONZE_DARK = 0x6b4220, STONE = 0x8d8a83, BALL = 0xf4f1e8;

// Geometries merged into one non-indexed BufferGeometry with a vertex colour each: [geometry, hex] pairs.
function merge(parts) {
  const pos = [], nor = [], col = [], c = new THREE.Color();
  for (const [geo, hex] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    c.set(hex);
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); col.push(c.r, c.g, c.b);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}

// A w × h × d band split into one stripe a colour along `axis` ('x' across, 'y' stacked).
function stripes(w, h, d, colors, axis = 'y') {
  const n = Math.max(1, colors.length);
  return merge(colors.map((hex, i) => {
    const g = axis === 'x' ? new THREE.BoxGeometry(w / n, h, d) : new THREE.BoxGeometry(w, h / n, d);
    if (axis === 'x') g.translate(-w / 2 + w / n * (i + 0.5), 0, 0);
    else g.translate(0, h / 2 - h / n * (i + 0.5), 0);   // the first Rat on top
    return [g, hex];
  }));
}

// The statue: a plinth and a bronze Rat (body, head, ears, snout, tail, one arm up) holding Ball No. 1. ~1.9k triangles (< 2k).
function statueGeometry() {
  const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };
  const parts = [
    [at(new THREE.BoxGeometry(1.3, 1.1, 1.3), 0, 0.55, 0), STONE],
    [at(new THREE.BoxGeometry(1.45, 0.12, 1.45), 0, 1.16, 0), STONE],
    [at(new THREE.CapsuleGeometry(0.34, 0.6, 4, 10), 0, 1.75, 0), BRONZE],                     // body
    [at(new THREE.SphereGeometry(0.3, 12, 8), 0, 2.38, 0.06), BRONZE],                         // head
    [at(new THREE.ConeGeometry(0.14, 0.34, 10), 0, 2.33, 0.4, Math.PI / 2), BRONZE_DARK],     // snout
    [at(new THREE.SphereGeometry(0.12, 8, 6), -0.22, 2.66, 0), BRONZE_DARK],                   // ears
    [at(new THREE.SphereGeometry(0.12, 8, 6), 0.22, 2.66, 0), BRONZE_DARK],
    [at(new THREE.CapsuleGeometry(0.08, 0.5, 3, 8), 0.36, 2.35, 0.05, 0, 0, -0.35), BRONZE],  // the arm, up
    [at(new THREE.CapsuleGeometry(0.08, 0.4, 3, 8), -0.34, 1.68, 0.1, 0.3, 0, 0.25), BRONZE], // the other arm
    [at(new THREE.CapsuleGeometry(0.1, 0.4, 3, 8), -0.16, 1.27, 0.08), BRONZE_DARK],           // legs
    [at(new THREE.CapsuleGeometry(0.1, 0.4, 3, 8), 0.16, 1.27, 0.08), BRONZE_DARK],
    [at(new THREE.TorusGeometry(0.35, 0.035, 5, 14, Math.PI * 1.2), 0, 1.4, -0.38, 0, Math.PI / 2, 0), BRONZE_DARK],   // tail
    [at(new THREE.SphereGeometry(0.16, 14, 10), 0.5, 2.78, 0.05), BALL],                       // Ball No. 1, held high
  ];
  return merge(parts);
}

// The names on the plinth: a small canvas plate (the one texture; skipped on the low tier).
function namePlate(names) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2a27'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#d8b46a'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 20px Georgia, serif'; g.fillText('THE RANGE RATS', 128, 22);
  const list = names.slice(0, 6), rows = Math.ceil(list.length / 2) || 1;
  g.font = `600 ${list.length > 4 ? 18 : 22}px Georgia, serif`;
  list.forEach((n, i) => {
    const col = list.length > 2 ? (i % 2 ? 192 : 64) : 128, row = list.length > 2 ? Math.floor(i / 2) : i;
    g.fillText(String(n).slice(0, 12), col, 56 + row * (66 / Math.max(1, list.length > 2 ? rows : list.length)));
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.55), new THREE.MeshLambertMaterial({ map: tex }));
  m.position.set(0, 0.6, 0.656);
  return m;
}

export default {
  id: 'owner',
  venue: 5,            // endless counts as 5; everything below waits for s.endless
  create(ctx) {
    const low = !!ctx.perf?.low;
    const paintMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const bronzeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    let key = '', standBand = null, boardTrim = null, cartGeo = null, statue = null, plateKey = '';
    const cartBands = new Map();   // cart view -> its band mesh

    function clearPaint() {
      for (const m of [standBand, boardTrim]) { if (m) { m.parent?.remove(m); m.geometry.dispose(); } }
      standBand = boardTrim = null;
      for (const [, m] of cartBands) m.parent?.remove(m);
      cartBands.clear();
      cartGeo?.dispose(); cartGeo = null;
      ctx.board?.frameColor?.(null);
    }
    function paint(colors) {
      clearPaint();
      if (!colors.length) return;
      standBand = new THREE.Mesh(stripes(2.06, 0.36, 1.26, colors), paintMat);   // the stand's top band (2 × 1 × 1.2)
      standBand.position.set(SIM.STAND.x, 0.8, SIM.STAND.z);
      ctx.scene.add(standBand);
      if (ctx.board?.attach) {
        const { BW, BOTTOM } = ctx.board.dims;
        boardTrim = new THREE.Mesh(stripes(BW + 0.2, 0.24, 0.14, colors, 'x'), paintMat);   // under the frame
        boardTrim.position.set(0, BOTTOM - 0.22, 0);
        ctx.board.attach(boardTrim);
        ctx.board.frameColor(new THREE.Color(colors[0]).getHex());
      }
      cartGeo = stripes(1.44, 0.16, 2.44, colors);   // round the cart body (1.4 × 0.45 × 2.4 at y 0.55)
    }
    function paintCarts() {
      if (!cartGeo) return;
      for (const v of ctx.cartViews ?? []) {
        if (!v?.g || cartBands.has(v)) continue;
        const m = new THREE.Mesh(cartGeo, paintMat); m.position.y = 0.64;
        v.g.add(m); cartBands.set(v, m);
      }
    }
    function placeStatue(on, names) {
      if (on && !statue) {
        statue = new THREE.Group();
        const m = new THREE.Mesh(statueGeometry(), bronzeMat); m.castShadow = !low;
        statue.add(m);
        statue.position.set(STATUE.x, 0, STATUE.z); statue.rotation.y = BOARD_YAW;   // faces the path, like the Board
        ctx.scene.add(statue);
      }
      if (statue) statue.visible = on;
      const k = names.join('|');
      if (statue && on && !low && k !== plateKey) {
        plateKey = k;
        const old = statue.getObjectByName('plate');
        if (old) { statue.remove(old); old.geometry.dispose(); old.material.map?.dispose(); old.material.dispose(); }
        const p = namePlate(names); p.name = 'plate'; statue.add(p);
      }
    }

    // Council round 14 #5b (builder 3; C #4: the poach was invisible): on a poach day three Site 13 regulars in red
    // jackets stand at their bay (POACH_BAY); the front one swings on each of their launches, then they rotate. Built on
    // the first poach day only (people.js: merged per limb, shared materials; no per-frame allocation).
    let regs = null, regOn = false, regK = 0;
    const REG_SPOTS = [{ x: 0, z: 0.6 }, { x: 0.9, z: 2.0 }, { x: -0.9, z: 2.1 }];
    function buildRegs() {
      regs = new THREE.Group(); regs.name = 'site13-regulars'; ctx.scene.add(regs);
      regs.position.set(POACH_BAY.x, 0, POACH_BAY.z);
      regs.userData.list = REG_SPOTS.map((o, i) => {
        const p = buildPerson({ seed: 'site13-reg' + i, shirt: POACH_CARD.RED, pants: 0x2a2a30, hat: i === 1 ? POACH_CARD.RED : false });
        p.root.traverse(m => { if (m.isMesh) m.castShadow = false; });
        p.setClub(true, 'driver');
        regs.add(p.root);
        return { p, swingT: -1 };
      });
      placeRegs();
    }
    function placeRegs() {   // the hitter on the mat, the other two waiting behind it
      regs.userData.list.forEach((r, i) => { const o = REG_SPOTS[(i - regK + REG_SPOTS.length) % REG_SPOTS.length]; r.p.root.position.set(o.x, 0, o.z); r.p.root.rotation.y = o.z < 1 ? 0 : Math.PI * 0.9; });
    }

    return {
      show(on) { if (!on) { clearPaint(); key = ''; if (statue) statue.visible = false; if (regs) regs.visible = false; } },
      // The regulars' swings (the poach morning's PA card is the server's: poach.mjs crew.pa('poach')).
      onEvent(e) {
        if (e.t === 'spawn' && regOn && regs && Math.abs(e.x - POACH_BAY.x) < 0.3 && Math.abs(e.z - POACH_BAY.z) < 0.6) {
          const r = regs.userData.list[regK];
          if (r.swingT >= 0) { regK = (regK + 1) % regs.userData.list.length; placeRegs(); }
          regs.userData.list[regK].swingT = 0;
        }
      },
      tick(dt) {
        if (!regs || !regs.visible) return;
        for (const r of regs.userData.list) {
          if (r.swingT >= 0) {
            r.swingT += dt;
            const k = r.swingT / SWING_SECS;
            if (k >= 1) { r.swingT = -1; animatePerson(r.p, dt, { mode: 'idle' }); }
            else animatePerson(r.p, dt, { mode: 'swing', k });
          } else animatePerson(r.p, dt, { mode: 'idle' });
        }
      },
      onSnapshot(s) {
        regOn = regularsShown(s, s?.mods?.poach);
        if (regOn && !regs) buildRegs();
        if (regs) regs.visible = regOn;
        const colors = hasPaint(s.up, s.endless) ? crewStripes(s.players) : [];
        const k = colors.join(',');
        if (k !== key) { key = k; paint(colors); }
        paintCarts();
        placeStatue(hasStatue(s.up, s.endless), (s.players ?? []).map(p => p.name));
      },
    };
  },
};
