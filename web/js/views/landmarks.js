// Council round 13 #4 (builder 2): the Range landmarks' look. Each is built once, the first time the crew reaches the
// Club, and shown by tier (crew.up.landmark: the snapshot's s.up?.landmark, or the shop's level); they stay at every later
// venue, like the bays. The rules are ../landmarks.js.
//   1 the Members' Bell: a brass bell on a post by the return. At the Club, Ⓐ beside it rings a bonus flight (the server
//     says when it can: s.mods.tourney.bell 1 open / 2 rung). Later it rings itself for the venue's peak (sound only).
//   2 the dimpl Tap Wall: a neon tap wall on the deck's bar end, lower-case logo.
//   3 Stretch fireworks: launch racks on both stand roofs; a rocket over each answered Stretch section, a volley on a
//     GRAND SLAM.
//   4 Site 13's inspector: drawn by views/county.js (his jacket).
//   5 a star named Gary: five stars spelling GARY over the Lift (over the glass case in endless). One Points draw.
// Xbox budget: the bell 2 meshes, the wall 2, the racks 1 InstancedMesh, the sparks 1 Points, the star 1 Points.
import * as THREE from 'three';
import { BELL, BELL_PROMPT, LANDMARK, landmarkTier, STAR } from '../landmarks.js';
import { SECTIONS } from '../stadium.js';
import { CASE } from '../caserules.js';

const SPARKS = 160, BURST = 40, BURST_SECS = 1.8;
const RACK_X = 82, RACK_Y = 6.7;
const near = (me, p, r) => !!me && Math.hypot(me.x - p.x, me.z - p.z) <= r;

// GARY in a 5 × 7 dot font, as points (one Points draw call).
const GLYPH = {
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
};
function starGeometry() {
  const pts = [];
  [...'GARY'].forEach((ch, k) => GLYPH[ch].forEach((row, r) => [...row].forEach((c, col) => {
    if (c === '1') pts.push((k * 6 + col - 11.5) * 1.6, (6 - r) * 1.6, 0);
  })));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

export default {
  id: 'landmarks',
  venue: 1,
  create(ctx) {
    const root = new THREE.Group(); root.name = 'landmarks'; ctx.scene.add(root);
    const brass = new THREE.MeshLambertMaterial({ color: 0xc9a13a, emissive: 0x3a2a08 });

    // 1. The bell: a post with a yoke, and the bell.
    const bell = new THREE.Group(); bell.position.set(BELL.POST.x, 0, BELL.POST.z); root.add(bell);
    const postGeo = new THREE.BoxGeometry(0.14, 2.4, 0.14); postGeo.translate(0, 1.2, 0);
    bell.add(new THREE.Mesh(postGeo, new THREE.MeshLambertMaterial({ color: 0x3b2a1c })));
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.36, 0.5, 14, 1, true), brass);
    cup.material.side = THREE.DoubleSide; cup.position.set(0, 2.05, 0.18); bell.add(cup);
    let swingT = -1;

    // 2. The Tap Wall: a dark panel with a row of brass taps and a pink neon "dimpl" bar, at the deck's bar end.
    const wall = new THREE.Group(); wall.position.set(19.2, 3, 3.6); root.add(wall);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.8, 3.2), new THREE.MeshLambertMaterial({ color: 0x1b1d24 })); panel.position.y = 0.9; wall.add(panel);
    const neon = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 2.6), new THREE.MeshBasicMaterial({ color: 0xff3fae })); neon.position.set(-0.12, 1.55, 0); wall.add(neon);

    // 3. The racks: three on each stand roof (one InstancedMesh), and the sparks.
    const racks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.8, 3), new THREE.MeshLambertMaterial({ color: 0x444a55 }), 6);
    { const m = new THREE.Matrix4(); SECTIONS.forEach((sc, i) => { m.makeTranslation(sc.side * RACK_X, RACK_Y + 0.4, sc.zc); racks.setMatrixAt(i, m); }); }
    racks.frustumCulled = false; root.add(racks);
    const spos = new Float32Array(SPARKS * 3), svel = new Float32Array(SPARKS * 3), scol = new Float32Array(SPARKS * 3);
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3)); sgeo.setAttribute('color', new THREE.BufferAttribute(scol, 3));
    const sparks = new THREE.Points(sgeo, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending }));
    sparks.frustumCulled = false; sparks.visible = false; root.add(sparks);
    const bursts = [0, 1, 2, 3].map(() => ({ t: -1 }));
    const col = new THREE.Color();
    function burst(x, y, z, hue) {
      const k = bursts.findIndex(b => b.t < 0); if (k < 0) return;
      bursts[k].t = 0;
      for (let i = 0; i < BURST; i++) {
        const j = (k * BURST + i) * 3, a = i * 2.399, e = Math.acos(1 - 2 * ((i + 0.5) / BURST));
        spos[j] = x; spos[j + 1] = y; spos[j + 2] = z;
        svel[j] = Math.sin(e) * Math.cos(a) * 9; svel[j + 1] = Math.cos(e) * 9; svel[j + 2] = Math.sin(e) * Math.sin(a) * 9;
        col.setHSL((hue + i * 0.01) % 1, 0.9, 0.6); scol[j] = col.r; scol[j + 1] = col.g; scol[j + 2] = col.b;
      }
      sparks.visible = true; sgeo.attributes.color.needsUpdate = true;
    }
    const rocket = i => { const sc = SECTIONS[i]; if (sc) burst(sc.side * RACK_X, 26, sc.zc, (i * 0.17) % 1); };
    let volley = -1;

    // 5. The star: GARY in points, over the Lift (or the glass case in endless).
    const star = new THREE.Points(starGeometry(), new THREE.PointsMaterial({ color: 0xfff4c0, size: 1.6, sizeAttenuation: true, transparent: true, depthWrite: false }));
    star.frustumCulled = false; root.add(star);

    let tier = 0, venue = 0, endless = false, bellState = 0;
    const apply = () => {
      bell.visible = tier >= LANDMARK.BELL;
      wall.visible = tier >= LANDMARK.TAP && venue >= 2;          // the deck stands from Tiered
      racks.visible = tier >= LANDMARK.FIREWORKS && venue >= 3;    // and the stands from the Stadium (the County hides the right one: kept)
      star.visible = tier >= LANDMARK.STAR && venue >= 5;
      if (endless) star.position.set(CASE.x, 34, CASE.z); else star.position.set(STAR.x, STAR.y, STAR.z);
    };
    const ring = () => { swingT = 0; ctx.SFX?.bell?.(523); };

    return {
      show(on) { root.visible = on; },
      onSnapshot(s, mine) {
        const t = landmarkTier(s?.up ?? ctx.crew?.()?.up), v = s?.venue ?? 0, e = !!s?.endless;
        bellState = s?.mods?.tourney?.bell ?? 0;
        if (t !== tier || v !== venue || e !== endless) { tier = t; venue = v; endless = e; apply(); }
        void mine;
      },
      onEvent(e) {
        if (e.t === 'buy' && e.id === 'landmark') { ctx.SFX?.jackpot?.(); return; }
        if (tier >= LANDMARK.BELL && e.t === 'tourney' && e.phase === 'bell') ring();
        if (tier >= LANDMARK.BELL && venue >= 2 && ((e.t === 'crowd' && e.kind === 'stretch') || (e.t === 'inspect' && e.phase === 'start'))) ring();   // the bell rings for the peak
        if (tier >= LANDMARK.FIREWORKS && e.t === 'crowd') {
          if (e.kind === 'souv' && e.stretch && e.req) rocket('ABCDEF'.indexOf(e.req));
          else if (e.kind === 'grandslam') { volley = 0; ctx.feed?.('GRAND SLAM! Every section answered!', '#ffd36b'); ctx.SFX?.jackpot?.(); }
        }
        if (tier >= LANDMARK.BELL && e.t === 'lastbucket' && e.phase === 'banked') { ring(); if (tier >= LANDMARK.FIREWORKS) volley = 0; }   // at the bank
      },
      tick(dt, t) {
        if (swingT >= 0) { swingT += dt; cup.rotation.x = Math.sin(swingT * 14) * 0.5 * Math.max(0, 1 - swingT / 1.5); if (swingT > 1.5) swingT = -1; }
        if (wall.visible) neon.material.color.setHSL(0.9 + 0.04 * Math.sin(t * 2), 1, 0.6);
        if (volley >= 0) {                                         // a GRAND SLAM: six rockets, a third of a second apart
          const k = Math.floor(volley / 0.33); volley += dt;
          if (Math.floor(volley / 0.33) !== k && k < 6) rocket(k);
          if (volley > 2.2) volley = -1;
        }
        let live = false;
        for (let k = 0; k < bursts.length; k++) {
          const b = bursts[k]; if (b.t < 0) continue;
          b.t += dt; live = true;
          if (b.t > BURST_SECS) { b.t = -1; for (let i = 0; i < BURST; i++) spos[(k * BURST + i) * 3 + 1] = -100; continue; }
          for (let i = 0; i < BURST; i++) {
            const j = (k * BURST + i) * 3;
            svel[j + 1] -= 6 * dt; spos[j] += svel[j] * dt; spos[j + 1] += svel[j + 1] * dt; spos[j + 2] += svel[j + 2] * dt;
          }
        }
        if (live) sgeo.attributes.position.needsUpdate = true; else sparks.visible = false;
        if (star.visible) star.material.opacity = 0.75 + 0.25 * Math.sin(t * 1.3);
      },
      // Ⓐ at the bell, at the Club: ring a bonus flight (the server checks the window; bellState 1 = open).
      prompt(btn) { return tier >= LANDMARK.BELL && venue === 1 && !endless && bellState === 1 && near(ctx.me, BELL.POST, BELL.R) ? BELL_PROMPT.replace('Ⓐ', btn) : null; },
      use() {
        if (tier < LANDMARK.BELL || venue !== 1 || endless || bellState !== 1 || !near(ctx.me, BELL.POST, BELL.R)) return false;
        ctx.act?.({ t: 'bell' });
        return true;
      },
    };
  },
};
