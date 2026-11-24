// Per-venue re-dress for Range Rat: the same map, promoted up the ladder.
// Muni -> Club -> Tiered -> Stadium -> County -> Orbital, plus endless.
// Groups are built lazily the first time a venue needs them and are cumulative.
// Everything outside the field (x -60..60, z -150..0) or above head height / behind the mats.
// Round 4 (council-round4.md §3.0): the venue modules' views (views/*.js) reach the pieces they animate through
// `parts` (createVenues(...).parts): the Tiered deck, both Stadium stands and crowds, the jumbotron, the Lift car.
import * as THREE from 'three';
import { MAP } from './map.js';
import { SIGN_BY_ID, yawOf, tagSign } from './signs.js';

export const SIGN_TEXT = [
  { title: 'MUNI RANGE', sub: 'a Fairway Holdings property', tag: 'Every Ball Matters.™' },
  { title: 'RANGE CLUB', sub: 'a Fairway Holdings property', tag: 'Members Welcome. Mostly.' },
  { title: 'TIERED ENTERTAINMENT RANGE', sub: 'a Fairway Holdings property', tag: 'Now With More Levels.' },
  { title: 'STADIUM RANGE', sub: 'a Fairway Holdings property', tag: 'Please Do Not Feed The Crowd.' },
  { title: 'COUNTY RANGE', sub: 'a Fairway Holdings property', tag: 'Zoned For Fun.' },
  { title: 'ORBITAL RANGE', sub: 'a Fairway Holdings property', tag: 'Every Ball Matters. Everywhere.' },
  { title: 'UNDER NEW MANAGEMENT', sub: 'Range Rats LLC', tag: 'Every Ball Matters. To Us.' },
];
const SIGN_BG = ['#1d4d2f', '#14402a', '#2a1f5c', '#7a1f2b', '#3a5a2a', '#0b1030', '#5a3b12'];

// Redraws the road-sign canvas (same layout as main.js's sign) for venue 0..6.
export function paintSign(x, w, h, venue) {
  const v = Math.max(0, Math.min(6, venue | 0));
  const t = SIGN_TEXT[v], sx = w / 512, sy = h / 256;
  x.save(); x.scale(sx, sy);
  x.fillStyle = SIGN_BG[v]; x.fillRect(0, 0, 512, 256);
  if (v >= 1) { x.strokeStyle = '#e8b04a'; x.lineWidth = 6; x.strokeRect(10, 10, 492, 236); }
  x.fillStyle = '#fff8ec'; x.textAlign = 'center';
  let px = 54; x.font = `bold ${px}px system-ui, sans-serif`;
  while (x.measureText(t.title).width > 470 && px > 22) { px -= 2; x.font = `bold ${px}px system-ui, sans-serif`; }
  x.fillText(t.title, 256, 110);
  x.font = '600 26px system-ui, sans-serif'; x.fillText(t.sub, 256, 160);
  x.font = 'italic 24px system-ui, sans-serif'; x.fillText(t.tag, 256, 205);
  x.restore();
}

const lambert = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
const BOX = new THREE.BoxGeometry(1, 1, 1);

function textPlane(text, w, h, bg, fg, px, flip) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.max(32, Math.round(256 * h / w));
  const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `bold ${px}px system-ui, sans-serif`; x.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  if (flip) m.rotation.y = Math.PI;
  return m;
}

// One InstancedMesh from a list of [x,y,z,sx,sy,sz] boxes.
function boxes(list, mat, shadow) {
  const im = new THREE.InstancedMesh(BOX, mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
  list.forEach((b, i) => { p.set(b[0], b[1], b[2]); s.set(b[3], b[4], b[5]); im.setMatrixAt(i, m.compose(p, q, s)); });
  im.instanceMatrix.needsUpdate = true; im.castShadow = !!shadow; im.frustumCulled = false;
  return im;
}
const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(BOX, mat); m.scale.set(w, h, d); m.position.set(x, y, z); return m; };

// Venue animation rate for the heavy loops (neon colours, stadium crowd bob). 0 = every frame. perf.js sets it.
let heavyHz = 0;
export function setHeavyRate(hz) { heavyHz = Number.isFinite(hz) && hz > 0 ? hz : 0; }

export function createVenues(scene) {
  const built = {};
  const groups = {};
  // parts: what the venue views may drive. crowdBob is the stand crowd's bob height (the Stadium view sets it from
  // Crowd Sentiment); carY is the Lift car's height (the Orbital view sets it during a ride; it rests on the platform).
  const live = { flags: [], neon: null, crowd: [], car: null, blinkers: null, debris: [], jumbo: null,
    deck: null, stands: { left: null, right: null }, crowdBob: 0.35, carY: 1.5, groups };
  let venue = 0, endless = false, blinkMat = null;

  function grp(name) { const g = new THREE.Group(); g.name = 'venue_' + name; g.visible = false; scene.add(g); groups[name] = g; return g; }

  const builders = {
    club() {
      const g = grp('club');
      const green = lambert(0x1d6b3a), white = lambert(0xf4f1e8), dark = lambert(0x3a2f26);
      // awning over the mat line: roof on 6 posts (back row, behind the mats)
      g.add(box(47, 0.25, 3.2, green, 0, 3.1, 0));
      g.add(box(47, 0.5, 0.12, white, 0, 2.85, -1.55));            // front valance
      const posts = []; for (let i = 0; i < 6; i++) posts.push([-22 + i * 8.8, 1.5, 1.45, 0.18, 3, 0.18]);
      g.add(boxes(posts, lambert(0xe8e2d0), true));
      // white dividers between the mats (mats at x -18..18 step 4; dividers at +-2 offsets)
      const dv = []; for (let i = 0; i <= 10; i++) dv.push([-20 + i * 4, 0.55, 1.0, 0.08, 1.1, 1.8]);
      g.add(boxes(dv, white));
      // KITCHEN board under the shed's front eave (signs.js 'kitchen'; it used to sit inside the roof, placed for an
      // old shed position). Faces the counter side (-z).
      const K = SIGN_BY_ID.kitchen, k = textPlane('KITCHEN', 2.0, 0.5, '#fff8ec', '#8a3b2e', 38, false);
      k.position.set(K.pos.x, K.pos.y, K.pos.z); k.rotation.y = yawOf(K.normal); g.add(tagSign(k, 'kitchen'));
      // two club flags at the bank (the Board, sim.js BANK 26, 6; the ball return moved to the mats)
      for (const dx of [-1.8, 1.8]) {
        const pole = box(0.07, 5, 0.07, lambert(0xcccccc), 26 + dx, 2.5, 6.0); g.add(pole);
        const geo = new THREE.PlaneGeometry(1.4, 0.8); geo.translate(0.7, 0, 0);
        const flag = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0x1d6b3a, side: THREE.DoubleSide }));
        flag.position.set(26 + dx, 4.5, 6.0); g.add(flag);
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.2), new THREE.MeshBasicMaterial({ color: 0xe8b04a, side: THREE.DoubleSide }));
        stripe.position.set(0.7, 0, 0.01); flag.add(stripe);
        live.flags.push({ m: flag, ph: dx });
      }
    },
    tiered() {
      // The Upper Deck: x +-20 (it used to run to 23.5, over the ball washer at 21.5), z 2..6, top y 3.
      // The stairs climb from x -25 to the deck's left end at -20. The deck loungers stand at its rail (z 2.4).
      const g = grp('tiered');
      const conc = lambert(0x8d8f96), dark = lambert(0x23252d);
      g.add(box(40, 0.3, 4, conc, 0, 2.85, 4));                    // floor slab x -20..20, z 2..6, top y 3
      g.add(box(40, 3.2, 0.3, dark, 0, 4.6, 6.1));                 // back wall
      const legs = []; for (let i = 0; i <= 10; i++) legs.push([-19.6 + i * 3.92, 1.35, 3.9, 0.35, 2.7, 0.35]);
      g.add(boxes(legs, conc, true));
      // 10 bay openings: pillars between bays on the deck front, rail across the top
      const pil = []; for (let i = 0; i <= 10; i++) pil.push([-20 + i * 4, 3.9, 2.15, 0.25, 1.8, 0.25]);
      g.add(boxes(pil, lambert(0xf4f1e8), true));
      g.add(box(40, 0.12, 0.2, lambert(0xf4f1e8), 0, 4.85, 2.15));
      g.add(box(40, 0.1, 0.1, dark, 0, 3.5, 2.1));                 // low rail
      // stairs at the left end, rising toward +x onto the deck
      const st = []; for (let i = 0; i < 6; i++) st.push([-24.55 + i * 0.9, (i + 1) * 0.5 - 0.25, 4, 0.9, (i + 1) * 0.5, 3]);
      g.add(boxes(st, conc, true));
      live.deck = { group: g, xMin: -20, xMax: 20, y: 3, zRail: 2.4, stairsX: -24.55 };
      // neon strips: one instanced mesh, per-instance colour cycled in tick
      const nm = new THREE.InstancedMesh(BOX, new THREE.MeshBasicMaterial({ color: 0xffffff }), 11);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
      for (let i = 0; i < 10; i++) { p.set(-18 + i * 4, 2.6, 1.95); s.set(3.4, 0.08, 0.08); nm.setMatrixAt(i, m4.compose(p, q, s)); nm.setColorAt(i, new THREE.Color(0xff00aa)); }
      p.set(0, 5.1, 2.15); s.set(40, 0.08, 0.08); nm.setMatrixAt(10, m4.compose(p, q, s)); nm.setColorAt(10, new THREE.Color(0x00ffee));
      nm.instanceMatrix.needsUpdate = true; nm.frustumCulled = false;
      g.add(nm); live.neon = nm;
    },
    stadium() {
      const g = grp('stadium');
      const conc = lambert(0x7b7f88), seat = lambert(0x37425a);
      const crowdGeo = new THREE.SphereGeometry(0.4, 6, 5);
      const per = 140;
      for (const side of [-1, 1]) {
        // Each stand is its own group (parts.stands.left / .right): the County hides the right one ("relocated to
        // the County Fair") because the Yards are where it stood.
        const sg = new THREE.Group(); sg.name = side < 0 ? 'stand_left' : 'stand_right'; g.add(sg);
        live.stands[side < 0 ? 'left' : 'right'] = sg;
        // 3 stepped tiers; fronts face the field
        for (let t = 0; t < 3; t++) {
          const w = 9 - t * 2.6, x = side * (75 + w / 2 + t * 2.6);
          sg.add(box(w, 2.2 + t * 2.2, 100, t % 2 ? seat : conc, x, (2.2 + t * 2.2) / 2, -70));
        }
        const im = new THREE.InstancedMesh(crowdGeo, new THREE.MeshLambertMaterial({ color: 0xffffff }), per);
        const base = [];
        for (let i = 0; i < per; i++) {
          const t = i % 3, row = (i / 3) | 0, zz = -118 + (row % 47) * 2.0 + (i % 2) * 0.7;
          const x = side * (75.8 + t * 2.6 + 0.9 + (row % 2) * 0.6), y = 2.2 + t * 2.2 + 0.55;
          base.push([x, y, zz, Math.random() * 6.28]);
          im.setColorAt(i, new THREE.Color().setHSL(Math.random(), 0.6, 0.55));
        }
        im.frustumCulled = false; sg.add(im);
        live.crowd.push({ im, base, side: side < 0 ? 'left' : 'right', stand: sg, m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1.2, 1), p: new THREE.Vector3() });
      }
      // jumbotron frame behind the bank (sim.js BANK 26,6; board at z 7.2)
      const fr = lambert(0x2a2d33), j = new THREE.Group();
      for (const dx of [-5.4, 5.4]) j.add(box(0.4, 16, 0.4, fr, dx, 8, 0));
      j.add(box(11.2, 0.4, 0.6, fr, 0, 16, 0)); j.add(box(11.2, 0.4, 0.6, fr, 0, 9.6, 0));
      j.add(box(0.3, 6.4, 0.5, fr, 0, 12.8, 0));
      // The screen faces the field (-z) and sits in front of the frame (signs.js 'jumbo'), so views/stadium.js
      // draws on it unmirrored.
      const back = new THREE.Mesh(new THREE.PlaneGeometry(10.4, 6), new THREE.MeshBasicMaterial({ color: 0x0a0c12 }));
      back.position.set(0, 12.8, -0.31); back.rotation.y = yawOf(SIGN_BY_ID.jumbo.normal); j.add(tagSign(back, 'jumbo'));
      j.position.set(26, 0, 14); g.add(j);
      live.jumbo = j;
    },
    county() {
      const g = grp('county');
      const wood = lambert(0xf4f1e8);
      const pk = [], rail = [], mail = [], post = [];
      for (const side of [-1, 1]) {
        const x = side * 122;
        for (let z = -262; z <= 20; z += 0.9) pk.push([x, 0.55, z, 0.12, 1.1, 0.06]);
        rail.push([x, 0.35, -121, 0.06, 0.1, 282], [x, 0.8, -121, 0.06, 0.1, 282]);
        for (let z = -250; z <= 0; z += 50) { post.push([side * 125, 0.6, z, 0.1, 1.2, 0.1]); mail.push([side * 125, 1.3, z, 0.35, 0.3, 0.6]); }
      }
      g.add(boxes(pk, wood, false)); g.add(boxes(rail, wood)); g.add(boxes(post, lambert(0x6b5a45)));
      g.add(boxes(mail, lambert(0x2d4fa0)));
      const flagsM = []; for (let z = -250; z <= 0; z += 50) for (const sd of [-1, 1]) flagsM.push([sd * 125, 1.55, z, 0.05, 0.18, 0.28]);
      g.add(boxes(flagsM, lambert(0xd33)));
      // COUNTY LINE sign (faces +x, readable from the field edge)
      const sg = new THREE.Group();
      sg.add(box(0.15, 3, 0.15, lambert(0x6b5a45), 0, 1.5, -1.4)); sg.add(box(0.15, 3, 0.15, lambert(0x6b5a45), 0, 1.5, 1.4));
      const pl = textPlane('COUNTY LINE', 3.2, 1.0, '#1d4d2f', '#fff8ec', 34, false);
      pl.rotation.y = yawOf(SIGN_BY_ID.county.normal); pl.position.set(0.1, 2.6, 0); sg.add(tagSign(pl, 'county'));
      sg.position.set(-119, 0, -30); g.add(sg);
    },
    orbital() {
      // The Lift (MAP.LIFT, beside the Mower Shed): a 2.6 m platform, the tower just behind it (+z), and the car,
      // which rests on the platform and rises only with riders (parts.carY; the Orbital view drives it).
      const g = grp('orbital');
      const L = MAP.LIFT, tz = L.z + 1.9;
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 400, 10), lambert(0xc8ccd6));
      cyl.position.set(L.x, 200, tz); g.add(cyl);
      g.add(new THREE.Mesh(new THREE.CylinderGeometry(L.r, L.r + 0.2, 0.3, 16), lambert(0x555a66)).translateX(L.x).translateY(0.15).translateZ(L.z));
      const car = new THREE.Group();
      car.add(box(2, 2.4, 2, lambert(0xf4f1e8), 0, 0, 0)); car.add(box(2.1, 0.5, 2.1, lambert(0x1d6b3a), 0, 1.4, 0));
      car.position.set(L.x, live.carY, L.z); g.add(car); live.car = car;
      // blinking lights up the tower: one instanced mesh, one shared material that toggles
      blinkMat = new THREE.MeshBasicMaterial({ color: 0xff2200 });
      const lights = []; for (let y = 20; y <= 380; y += 30) lights.push([L.x, y, tz + 0.6, 0.35, 0.35, 0.35]);
      const bl = boxes(lights, blinkMat); g.add(bl); live.blinkers = bl;
      // floating ball debris: sprites, high up
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(32, 32, 28, 0, 6.3); x.fill();
      x.fillStyle = '#c9ccd2'; for (const [a, b] of [[22, 24], [38, 22], [30, 38], [44, 36], [20, 40]]) { x.beginPath(); x.arc(a, b, 3, 0, 6.3); x.fill(); }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const sm = new THREE.SpriteMaterial({ map: tex, fog: false });
      const spots = [[-30, 70, -40], [20, 90, -90], [-60, 110, 10], [50, 80, -20], [0, 130, -60], [75, 100, 30]];
      for (const [px, py, pz] of spots) { const s = new THREE.Sprite(sm); s.scale.set(3, 3, 1); s.position.set(px, py, pz); g.add(s); live.debris.push({ s, y0: py, ph: px }); }
    },
    endless() {
      const g = grp('endless');
      g.add(box(0.08, 1.2, 0.08, lambert(0x6b5a45), 10, 0.6, 11));
      const pl = textPlane('FOR SALE', 1.2, 0.6, '#c62828', '#ffffff', 40, false);
      pl.position.set(10, 1.3, 11); pl.rotation.y = yawOf(SIGN_BY_ID.forsale.normal); g.add(tagSign(pl, 'forsale'));
      g.add(box(0.1, 1.2, 0.1, lambert(0x6b5a45), 10.5, 0.6, 11));
    },
  };

  function ensure(name) { if (!built[name]) { built[name] = true; builders[name](); } }

  function setVenue(v, isEndless) {
    venue = Math.max(0, Math.min(5, v | 0)); endless = !!isEndless;
    if (endless) venue = 5;
    const want = { club: venue >= 1, tiered: venue >= 2, stadium: venue >= 3, county: venue >= 4, orbital: venue >= 5, endless };
    for (const k of Object.keys(want)) { if (want[k]) ensure(k); if (groups[k]) groups[k].visible = want[k]; }
  }

  const col = new THREE.Color();
  let heavyAcc = 0;
  function tick(dt, t) {
    if (venue >= 1 && live.flags.length) for (const f of live.flags) {
      f.m.rotation.y = Math.sin(t * 4 + f.ph) * 0.35; f.m.scale.x = 0.9 + 0.1 * Math.sin(t * 7 + f.ph);
    }
    // The neon colours and the stadium crowd's bob (hundreds of matrix writes) run at heavyHz on Xbox / Low.
    let heavy = true;
    if (heavyHz > 0) { heavyAcc += dt; if (heavyAcc < 1 / heavyHz) heavy = false; else heavyAcc %= 1 / heavyHz; }
    if (heavy && venue >= 2 && live.neon) {
      const n = live.neon.count;
      for (let i = 0; i < n; i++) { col.setHSL((t * 0.15 + i * 0.09) % 1, 1, 0.55); live.neon.setColorAt(i, col); }
      live.neon.instanceColor.needsUpdate = true;
    }
    if (heavy && venue >= 3) for (const c of live.crowd) {
      if (!c.stand.visible) continue;              // a hidden stand (the County's right one) costs nothing
      for (let i = 0; i < c.base.length; i++) {
        const b = c.base[i];
        c.p.set(b[0], b[1] + Math.max(0, Math.sin(t * 3 + b[3])) * live.crowdBob, b[2]);
        c.im.setMatrixAt(i, c.m.compose(c.p, c.q, c.s));
      }
      c.im.instanceMatrix.needsUpdate = true;
    }
    if (venue >= 5) {
      if (live.car) live.car.position.y = live.carY;
      if (blinkMat) blinkMat.color.setHex(Math.sin(t * 5) > 0 ? 0xff2200 : 0x330800);
      for (const d of live.debris) { d.s.position.y = d.y0 + Math.sin(t * 0.7 + d.ph) * 2; d.s.material.rotation = t * 0.2; }
    }
  }

  return { setVenue, tick, parts: live };
}
