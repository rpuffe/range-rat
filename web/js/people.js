// People for Range Rat: procedural low-poly customers and crewmates (Range Rats).
// Primitives only, no asset files. Adapted from the golf game's golfers.js (same
// two-bone-IK arm solver, same swing timeline), re-proportioned to a ~1.75 m
// adult and slimmed to ~16 meshes per person.
//
// Space: root origin at the feet, ground y = 0, facing -z (down range).
//   root -> body (uniform height scale, yaw) -> rig (pitch/roll/lift) -> legs, torso, head.
// Inside `body` the rig is built facing +z (as in golfers.js) and body.rotation.y
// is PI, so the person faces root -z. Nothing is scaled on `root` itself, so a
// name tag parented to root is unaffected by the person's height.
//
// Cost: ONE shared vertex-coloured Lambert material for every person. Colours
// (clothes, skin, hair, hats, props) are baked into per-triangle vertex colours,
// and geometries are cached per colour combination, so ten customers in the
// same few palette colours share most of their buffers. Per person:
//   head, chest, pelvis, 2 thighs, 2 shins (shoes merged in), 2 upper arms,
//   2 forearms (hands merged in), club = 12 meshes, plus 4 prop meshes
//   (bucket, tube, wand, bag) that are hidden unless carried = 16 total.
// Only the chest casts a shadow.
//
// Golf: in 'address' / 'swing' the person turns side-on (like golfers.js): the
// ball sits at root-local +x (p.ball) and the shot flies toward root-local -z
// (down range, for an unrotated root). personAddress() stands them at a ball.

import * as THREE from 'three';

export const SWING_IMPACT = 0.55;   // swing k at which the club meets the ball
export const SWING_SECS = 1.6;      // natural duration of one full swing

// ---------------------------------------------------------------- dimensions
const BALL_R = 0.04;                 // height of the ball centre the arc is built for
const D = {
  hipY: 0.93, TL: 0.45, SL: 0.45, foot: 0.03,    // hip height, thigh, shin
  sY: 0.5, sX: 0.2, UA: 0.29, FA: 0.27,           // shoulder above hip / out from spine, upper arm, forearm
  legGap: 0.095, stance: 0.04, tilt: 0.5,         // hip offset, rest hip splay, spine tilt at address
};
const REACH = D.UA + D.FA;
const CLUB_LEN = { iron: 0.95, driver: 1.08 };

// ---------------------------------------------------------------- palettes
const SHIRTS = [0xf4f1e6, 0x3b7dd8, 0xd6455d, 0x2f9e6b, 0xf2b134, 0x7b5ea7, 0x14a3a3, 0xe8e0c8, 0x2d4a7a, 0xe9783c, 0xa8d5ba, 0xf29cb0];
const PANTS = [0xc9b48a, 0x2f3b52, 0x474a52, 0xd8d0bc, 0x6b7a4a, 0xeeeeee, 0xb08f5e, 0x3d5a80, 0x8a8f99];
const SKINS = [0xf6d5bd, 0xf2cdb0, 0xe0ac86, 0xc68642, 0xa5673f, 0x8d5524, 0x6f4430];
const HAIRS = [0x2a1c12, 0x5a3820, 0xa8743a, 0xd6b068, 0x8a8a8a, 0x15110e, 0xa64a24, 0xdcdcdc];
const HATS = [0xf4f1e6, 0x1f3a6e, 0xd6455d, 0x2f9e6b, 0x222428, 0xf2b134, 0x3b7dd8];
const SHOES = [0xf4f1e6, 0x2a2a30, 0x6b4a2e, 0xdddddd];
const BAGS = [0x2f6b9a, 0xb23a48, 0x2b2f3a, 0x3f7d4a, 0xc9892b];
const STAFF_SHIRTS = [0x24304a, 0xf4f1e6, 0x2b2f3a];
const VEST = 0xff7a1a, VEST_TAPE = 0xf3ee9a, BUCKET = 0xe8552e;

const hexOf = c => new THREE.Color(c).getHex();
const shade = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();

function hashStr(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rng(seed) {
  let a = hashStr(String(seed ?? 0)) || 1;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- geometry helpers
const _c = new THREE.Color(), _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tc = new THREE.Vector3();
// Non-indexed copy with a flat per-triangle vertex colour: fn(cx, cy, cz) -> hex, or a hex.
function paint(geo, fn) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    let hex = fn;
    if (typeof fn === 'function') {
      _ta.fromBufferAttribute(p, i); _tb.fromBufferAttribute(p, i + 1); _tc.fromBufferAttribute(p, i + 2);
      hex = fn((_ta.x + _tb.x + _tc.x) / 3, (_ta.y + _tb.y + _tc.y) / 3, (_ta.z + _tb.z + _tc.z) / 3);
    }
    _c.set(hex);
    for (let k = 0; k < 3; k++) { col[(i + k) * 3] = _c.r; col[(i + k) * 3 + 1] = _c.g; col[(i + k) * 3 + 2] = _c.b; }
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
function merge(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); col.set(g.attributes.color.array, o);
    o += g.attributes.position.count * 3; g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return out;
}
// A lathe body with extra rows at the given heights so colour bands land exactly on them.
function lathe(profile, ys, fn, segs = 10) {
  const pts = profile.slice();
  for (const y of ys) {
    const i = pts.findIndex((q, j) => j < pts.length - 1 && q[1] <= y && pts[j + 1][1] > y);
    if (i < 0) continue;
    const a = pts[i], b = pts[i + 1], u = (y - a[1]) / (b[1] - a[1]);
    pts.splice(i + 1, 0, [a[0] + (b[0] - a[0]) * u, y]);
  }
  return paint(new THREE.LatheGeometry(pts.map(q => new THREE.Vector2(q[0], q[1])), segs), fn);
}
// an ellipsoid, scaled and placed, painted one colour
function ell(r, sx, sy, sz, x, y, z, col, w = 10, h = 7) {
  const g = new THREE.SphereGeometry(r, w, h); g.scale(sx, sy, sz); g.translate(x, y, z);
  return paint(g, col);
}
const cyl = (rt, rb, h, seg, x, y, z, col, hs = 1) => paint(new THREE.CylinderGeometry(rt, rb, h, seg, hs).translate(x, y, z), col);

const _cache = new Map();
function cached(key, make) {
  let g = _cache.get(key);
  if (!g) { g = make(); _cache.set(key, g); }
  return g;
}
let _mat = null;
const sharedMat = () => _mat || (_mat = new THREE.MeshLambertMaterial({ vertexColors: true }));

// ---------------------------------------------------------------- part geometry (cached)
function torsoGeo(shirt, skin, staff) {
  return cached(`torso|${shirt}|${skin}|${staff}`, () => {
    const prof = [[0.001, -0.04], [0.13, -0.03], [0.14, 0.1], [0.16, 0.28], [0.19, 0.42], [0.205, 0.5], [0.15, 0.555], [0.06, 0.585], [0.001, 0.595]];
    const body = lathe(prof, [0.2, 0.25, 0.44], (x, y) => staff
      ? (y < 0.44 ? (y > 0.2 && y < 0.25 ? VEST_TAPE : VEST) : y > 0.54 ? shade(shirt, 0.85) : shirt)
      : (y > 0.54 ? shade(shirt, 0.85) : shirt));
    return merge([body, cyl(0.05, 0.056, 0.12, 8, 0, 0.57, 0, skin)]);
  });
}
const pelvisGeo = (pants) => cached(`pelvis|${pants}`, () => {
  const g = new THREE.SphereGeometry(0.16, 10, 7); g.scale(1, 0.55, 0.8);
  return paint(g, (x, y) => y > 0.03 ? 0x2a2a2e : pants);
});
const thighGeo = (pants) => cached(`thigh|${pants}`, () => paint(new THREE.CapsuleGeometry(0.075, D.TL - 0.15, 3, 8), pants));
const shinGeo = (pants, skin, shoe, shorts) => cached(`shin|${pants}|${skin}|${shoe}|${shorts}`, () => {
  const len = D.SL - 0.12;
  const leg = paint(new THREE.CapsuleGeometry(0.06, len, 3, 8), shorts ? (x, y) => y < -0.1 ? 0xf4f4f0 : skin : pants);
  return merge([leg, ell(0.06, 1, 0.55, 1.8, 0, -D.SL / 2 + 0.003, 0.045, shoe, 8, 6)]);   // shoe sole at ground (ankle is D.foot up)
});
const upperGeo = (shirt) => cached(`upper|${shirt}`, () => paint(new THREE.CapsuleGeometry(0.045, D.UA - 0.09, 3, 8), shirt));
// forearm with the hand sphere merged on the +Y end (the end that reaches for the target)
const foreGeo = (skin, sleeve) => cached(`fore|${skin}|${sleeve}`, () => {
  const arm = paint(new THREE.CapsuleGeometry(0.036, D.FA - 0.072, 3, 8), (x, y) => sleeve != null && y < D.FA / 2 - 0.07 ? sleeve : skin);
  return merge([arm, ell(0.05, 1, 1, 1, 0, D.FA / 2, 0, skin, 8, 6)]);
});

function headGeo(skin, hairStyle, hair, hatStyle, hat) {
  return cached(`head|${skin}|${hairStyle}|${hair}|${hatStyle}|${hat}`, () => {
    const parts = [];
    parts.push(ell(0.11, 0.95, 1.08, 1, 0, 0.13, 0, skin, 12, 9));             // skull
    parts.push(ell(0.013, 1, 1, 0.6, 0.038, 0.14, 0.098, 0x1c1412, 6, 4));       // eyes
    parts.push(ell(0.013, 1, 1, 0.6, -0.038, 0.14, 0.098, 0x1c1412, 6, 4));
    parts.push(ell(0.02, 1, 1, 1.2, 0, 0.118, 0.108, shade(skin, 0.94), 6, 5));  // nose
    parts.push(ell(0.025, 0.4, 1, 0.8, 0.105, 0.13, 0, skin, 6, 5));             // ears
    parts.push(ell(0.025, 0.4, 1, 0.8, -0.105, 0.13, 0, skin, 6, 5));
    // hair: a hemisphere tipped back so the hairline clears the face
    const cap = (r, sy) => paint(new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.95, sy, 1.02).rotateX(-0.35).translate(0, 0.135, -0.008), hair);
    if (hairStyle === 'short') parts.push(cap(0.117, 1.08));
    else if (hairStyle === 'buzz') parts.push(cap(0.1135, 1.085));
    else if (hairStyle === 'long') { parts.push(cap(0.117, 1.08)); parts.push(ell(0.1, 1, 1.6, 0.6, 0, 0.06, -0.075, hair, 8, 6)); }
    // hats
    if (hatStyle === 'cap' || hatStyle === 'visor') {
      if (hatStyle === 'cap') parts.push(paint(new THREE.SphereGeometry(0.124, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1.05).rotateX(-0.12).translate(0, 0.16, -0.005), hat));
      else parts.push(cyl(0.118, 0.12, 0.045, 12, 0, 0.175, -0.003, hat));
      parts.push(paint(new THREE.CylinderGeometry(0.115, 0.115, 0.01, 10, 1, false, -Math.PI / 2, Math.PI).rotateX(-0.2).translate(0, 0.153, 0.075), shade(hat, 0.8)));
    } else if (hatStyle === 'bucket') {
      parts.push(cyl(0.118, 0.126, 0.08, 12, 0, 0.19, 0, hat));
      parts.push(cyl(0.2, 0.2, 0.012, 14, 0, 0.158, 0, shade(hat, 0.9)));
    } else if (hatStyle === 'straw') {
      parts.push(paint(new THREE.SphereGeometry(0.12, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.17, 0), 0xe6cf8f));
      parts.push(cyl(0.125, 0.125, 0.025, 12, 0, 0.172, 0, hat));
      parts.push(cyl(0.24, 0.24, 0.01, 16, 0, 0.165, 0, 0xd8bd78));
    }
    return merge(parts);
  });
}

const clubGeo = (kind) => cached(`club|${kind}`, () => {
  const L = CLUB_LEN[kind];
  const parts = [cyl(0.017, 0.015, 0.24, 8, 0, -0.12, 0, 0x1d1d22), cyl(0.0105, 0.011, L - 0.24, 6, 0, -0.24 - (L - 0.24) / 2, 0, 0xc8ccd2)];
  if (kind === 'iron') parts.push(paint(new THREE.BoxGeometry(0.1, 0.05, 0.028).translate(-0.036, -L, 0), 0xc8ccd2));
  else parts.push(ell(0.058, 1, 0.7, 0.9, -0.03, -L, 0, 0x22283a, 10, 7));
  return merge(parts);
});

const bucketGeo = () => cached('bucket', () => {
  const parts = [paint(new THREE.CylinderGeometry(0.14, 0.11, 0.25, 12, 3).translate(0, -0.245, 0), (x, y) => y > -0.15 ? shade(BUCKET, 1.2) : BUCKET)];
  const balls = [[0, -0.1, 0], [0.07, -0.11, 0], [-0.07, -0.11, 0], [0, -0.11, 0.07], [0, -0.11, -0.07], [0.05, -0.095, 0.05], [-0.05, -0.095, -0.05], [0.05, -0.095, -0.05], [-0.05, -0.095, 0.05]];
  for (const [x, y, z] of balls) parts.push(ell(0.036, 1, 1, 1, x, y, z, 0xfbfaf6, 6, 4));
  parts.push(paint(new THREE.TorusGeometry(0.12, 0.007, 4, 10, Math.PI).translate(0, -0.12, 0), 0x8a8f99));
  return merge(parts);
});
const tubeGeo = () => cached('tube', () => paint(new THREE.CylinderGeometry(0.04, 0.04, 0.7, 10, 5), (x, y) => Math.abs(y) > 0.23 ? BUCKET : 0xd9c9a0));
const wandGeo = () => cached('wand', () => merge([
  cyl(0.017, 0.017, 0.2, 6, 0, -0.08, 0, 0x1d1d22), cyl(0.011, 0.011, 1.0, 6, 0, -0.65, 0, 0xc8ccd2),
  paint(new THREE.TorusGeometry(0.06, 0.012, 5, 10).rotateX(Math.PI / 2).translate(0, -1.15, 0), 0xf2c230),
]));
const bagGeo = (col) => cached(`bag|${col}`, () => {
  const parts = [cyl(0.09, 0.075, 0.7, 10, 0, 0, 0, col), cyl(0.1, 0.1, 0.06, 10, 0, 0.35, 0, 0xf4f1ea), cyl(0.078, 0.078, 0.06, 10, 0, -0.34, 0, 0x2a2a30),
    paint(new THREE.BoxGeometry(0.12, 0.28, 0.05).translate(0, -0.05, -0.085), shade(col, 0.8))];
  for (const [x, z, c] of [[0.04, 0.02, 0xe8473a], [-0.04, 0.0, 0xffd23f], [0.0, -0.04, 0x3fa7ff]]) {
    parts.push(cyl(0.008, 0.008, 0.36, 5, x, 0.5, z, 0xc8ccd2));
    parts.push(ell(0.032, 1, 1, 1, x, 0.7, z, c, 6, 4));
  }
  return merge(parts);
});

// ---------------------------------------------------------------- build
const HAT_STYLES = new Set(['none', 'cap', 'visor', 'bucket', 'straw']);

// opts: { seed, shirt, pants, skin, hat, staff }
//  shirt/pants/skin: hex number (or any THREE.Color input) to override the seeded pick
//  hat: number|Color|css string -> a cap in that colour; 'cap'|'visor'|'bucket'|'straw'|'none'
//       -> that style; false -> bare head (hair); undefined/true -> seeded
//  staff: orange Range Rat vest + a cap in the shirt's colour
export function buildPerson(opts = {}) {
  const { seed = 0, staff = false } = opts;
  const r = rng(seed);
  // draw in a fixed order so an override never shifts the other picks
  const rv = Array.from({ length: 16 }, () => r());
  const pick = (arr, v) => arr[Math.min(arr.length - 1, Math.floor(v * arr.length))];
  const height = 1 + (rv[0] * 2 - 1) * 0.08;
  const build = 0.92 + rv[1] * 0.2;
  const shirt = opts.shirt != null ? hexOf(opts.shirt) : pick(staff ? STAFF_SHIRTS : SHIRTS, rv[2]);
  const pants = opts.pants != null ? hexOf(opts.pants) : pick(PANTS, rv[3]);
  const skin = opts.skin != null ? hexOf(opts.skin) : pick(SKINS, rv[4]);
  const hairStyle = pick(['short', 'short', 'buzz', 'long', 'bald', 'short'], rv[5]);
  const hair = pick(HAIRS, rv[6]);
  let hatStyle = 'none', hatCol = pick(HATS, rv[8]);
  const hv = rv[7], ho = opts.hat;
  if (staff) { hatStyle = 'cap'; hatCol = shirt; }
  else if (ho === false) hatStyle = 'none';
  else if (typeof ho === 'string' && HAT_STYLES.has(ho)) hatStyle = ho;
  else if (ho != null && ho !== true) { hatStyle = 'cap'; hatCol = hexOf(ho); }
  else hatStyle = hv < 0.34 ? 'none' : hv < 0.66 ? 'cap' : hv < 0.78 ? 'visor' : hv < 0.9 ? 'bucket' : 'straw';
  const sleeve = rv[9] < 0.3 ? shirt : null;          // long sleeves on some
  const shorts = rv[10] < 0.18;
  const shoe = pick(SHOES, rv[11]);
  const bagCol = pick(BAGS, rv[12]);
  const iron = rv[13] < 0.5;

  const root = new THREE.Group();
  const body = new THREE.Group(); body.scale.setScalar(height); body.rotation.y = Math.PI; root.add(body);
  const rig = new THREE.Group(); body.add(rig);
  const mat = sharedMat();
  const mk = (geo, parent, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  const legs = {};
  for (const [s, key] of [[1, 'L'], [-1, 'R']]) {
    const hip = new THREE.Group(); hip.position.set(s * D.legGap, D.hipY, 0); rig.add(hip);
    const thigh = mk(thighGeo(pants), hip, 0, -D.TL / 2, 0);
    const knee = new THREE.Group(); knee.position.y = -D.TL; hip.add(knee);
    const shin = mk(shinGeo(pants, skin, shoe, shorts), knee, 0, -D.SL / 2, 0);
    legs[key] = { hip, knee, thigh, shin };
  }
  const pelvis = mk(pelvisGeo(pants), rig, 0, D.hipY, 0); pelvis.scale.set(build, 1, 1);
  const torso = new THREE.Group(); torso.position.y = D.hipY; rig.add(torso);
  const chest = mk(torsoGeo(shirt, skin, !!staff), torso); chest.castShadow = true;
  const bz = 0.62 * (0.95 + 0.1 * (build - 0.92) / 0.2);
  chest.scale.set(build, 1, bz);
  const head = new THREE.Group(); head.position.set(0, D.sY + 0.06, 0.01); torso.add(head);
  mk(headGeo(skin, hairStyle, hair, hatStyle, hatCol), head);
  const mkArm = s => ({
    up: mk(upperGeo(shirt), torso), fo: mk(foreGeo(skin, sleeve), torso),
    UA: D.UA, FA: D.FA, shoulder: new THREE.Vector3(s * D.sX, D.sY, 0),
  });
  const armL = mkArm(1), armR = mkArm(-1);
  const club = mk(clubGeo(iron ? 'iron' : 'driver'), torso); club.visible = false;
  const bucket = mk(bucketGeo(), body); bucket.visible = false;
  const tube = mk(tubeGeo(), torso); tube.visible = false;
  const wand = mk(wandGeo(), torso); wand.visible = false;
  const bag = mk(bagGeo(bagCol), torso, 0.03, 0.3, -0.19); bag.rotation.set(-0.14, 0, 0.32); bag.visible = false;

  const p = {
    root,
    parts: { body, rig, torso, head, chest, pelvis, legL: legs.L, legR: legs.R, armL, armR, club, bucket, tube, wand, bag },
    carry: 'none', club: false, clubKind: iron ? 'iron' : 'driver',
    height, build, sd: (hashStr(String(seed)) % 1000) / 1000,
    ball: new THREE.Vector3(),         // root-local ground point of the ball in address/swing
    anim: { mode: null, t: 0, time: 0, phase: 0, blend: 1, dur: 0.2, prev: null, from: newPose(), cur: newPose(), tgt: newPose() },
    setCarry(kind) {
      this.carry = ['bucket', 'tube', 'wand', 'clubbag'].includes(kind) ? kind : 'none';
      refresh(this);
    },
    setClub(on, kind) {
      this.club = !!on;
      if (kind === 'iron' || kind === 'driver') { this.clubKind = kind; club.geometry = clubGeo(kind); }
      this.ball.set(SWG[this.clubKind].z * this.height, 0, 0);
      refresh(this);
    },
  };
  root.userData.person = p;
  root.userData.height = 1.75 * height + (hatStyle === 'straw' || hatStyle === 'bucket' ? 0.03 : 0);   // for name tags
  p.ball.set(SWG[p.clubKind].z * height, 0, 0);
  animatePerson(p, 0, { mode: 'idle' });
  return p;
}

// props' visibility depends on carry / club / mode; re-evaluate and re-pose now
function refresh(p) {
  if (p.anim.mode) applyPose(p, p.anim.cur);
}

// Stand a person at a ball (ground point) so their swing sends it toward target.
export function personAddress(p, ball, target) {
  const th = Math.atan2(-(target.x - ball.x), -(target.z - ball.z));
  p.root.rotation.set(0, th, 0);
  p.root.position.set(ball.x - p.ball.x * Math.cos(th), ball.y ?? 0, ball.z + p.ball.x * Math.sin(th));
  return p;
}

// ---------------------------------------------------------------- swing geometry (from golfers.js)
function swingGeom(club) {
  const Sc = new THREE.Vector3(0, D.hipY + D.sY * Math.cos(D.tilt), D.sY * Math.sin(D.tilt));
  const HR = 0.77 * REACH;
  const L = club + HR, dy = Sc.y - BALL_R;
  const z = Sc.z + Math.sqrt(Math.max(0.04, L * L - dy * dy));
  const Dv = new THREE.Vector3(0, BALL_R, z).sub(Sc);
  const hr = Dv.length() - club;
  Dv.normalize();
  return { Sc, D: Dv, HR: hr, B: new THREE.Vector3(-1, 0, 0), z };
}
const SWG = { iron: swingGeom(CLUB_LEN.iron), driver: swingGeom(CLUB_LEN.driver) };

// Swing timeline: a = hands' angle round the arc (+ back, - through), h = wrist cock.
const A_TOP = 2.3, A_FIN = -2.55, HINGE = 1.65;
function swingPose(k) {
  let a, h, f = 0;
  if (k < 0.1) { a = 0.05 * Math.sin(k / 0.1 * Math.PI * 2); h = 0; }
  else if (k < 0.42) { const u = (k - 0.1) / 0.32; a = A_TOP * (0.5 - 0.5 * Math.cos(u * Math.PI)); h = HINGE * smooth(0.05, 0.75, u); }
  else if (k < 0.46) { a = A_TOP; h = HINGE; }
  else if (k < SWING_IMPACT) { const u = (k - 0.46) / (SWING_IMPACT - 0.46); a = A_TOP * (1 - u * u); h = HINGE * (1 - u * u * u); }
  else if (k < 0.74) { const u = (k - SWING_IMPACT) / (0.74 - SWING_IMPACT); f = 1 - (1 - u) * (1 - u); a = A_FIN * f; h = -HINGE * Math.pow(f, 0.7); }
  else { f = 1; a = A_FIN; h = -HINGE; }
  return { a, h, f };
}

// ---------------------------------------------------------------- math + rig helpers
const TAU = Math.PI * 2;
const clamp01 = x => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * u;
const pulse = (a, b, c, d, x) => smooth(a, b, x) * (1 - smooth(c, d, x));
const _up = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Vector3(), _p = new THREE.Vector3();
const _T = new THREE.Vector3(), _Pole = new THREE.Vector3();
const _co = new THREE.Vector3(), _cd = new THREE.Vector3(), _cf = new THREE.Vector3(), _tL = new THREE.Vector3(), _tR = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();
const _m = new THREE.Matrix4(), _ti = new THREE.Matrix4(), _tq = new THREE.Quaternion(), _tqi = new THREE.Quaternion(), _eu = new THREE.Euler();
const _hp = new THREE.Vector3(0, D.hipY, 0), _one = new THREE.Vector3(1, 1, 1), _qs = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qId = new THREE.Quaternion();

function seg(mesh, a, b, len) {
  mesh.position.lerpVectors(a, b, 0.5);
  _v.subVectors(b, a); const d = _v.length();
  mesh.quaternion.setFromUnitVectors(_up, _v.divideScalar(d || 1));
  mesh.scale.set(1, d / len, 1);
}
// Two-bone arm in torso space: shoulder -> T, elbow bends toward pole.
function solveArm(arm, T, pole) {
  const S = arm.shoulder, UA = arm.UA, FA = arm.FA;
  _w.subVectors(T, S); const d = _w.length(); _w.divideScalar(d || 1);
  if (d >= UA + FA - 1e-4) _e.copy(S).addScaledVector(_w, d * UA / (UA + FA));
  else {
    const along = (UA * UA - FA * FA + d * d) / (2 * d), h = Math.sqrt(Math.max(0, UA * UA - along * along));
    _p.copy(pole).addScaledVector(_w, -pole.dot(_w)).normalize();
    _e.copy(S).addScaledVector(_w, along).addScaledVector(_p, h);
  }
  seg(arm.up, S, _e, UA); seg(arm.fo, _e, T, FA);
}
// Club pivot at origin, shaft along dir (grip -> head), face normal roughly toward face.
function orientClub(club, origin, dir, face) {
  club.position.copy(origin);
  _y.copy(dir).negate().normalize();
  _z.copy(face).addScaledVector(_y, -face.dot(_y)).normalize();
  _x.crossVectors(_y, _z);
  club.quaternion.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}
// how far a foot's lowest point (ankle, or toe / heel once the foot pitches with the shin) sits above the ground
const liftOf = (a, k, hz) => {
  const b = a + k, ank = (D.TL + D.SL) - (D.TL * Math.cos(a) + D.SL * Math.cos(b)) * Math.cos(hz);
  return ank - (b > 0 ? 0.12 * Math.sin(b) : -0.05 * Math.sin(b));
};
function glance(t, seed) {
  const p = (t * 0.16 + seed) % 1;
  return smooth(0.12, 0.2, p) * (1 - smooth(0.32, 0.4, p)) - smooth(0.6, 0.68, p) * (1 - smooth(0.8, 0.88, p));
}

// ---------------------------------------------------------------- pose
// A pose is a flat bag of numbers so blending between modes is one lerp loop.
// Hand targets, poles and the club are in TORSO space; everything else is joint angles.
const KEYS = ['yaw', 'pitch', 'roll', 'rx', 'ry', 'fix', 'bg', 'br',
  'lhx', 'lhy', 'lhz', 'lkx', 'rhx', 'rhy', 'rhz', 'rkx',
  'tx', 'ty', 'tz', 'hx', 'hy', 'hz',
  'alx', 'aly', 'alz', 'arx', 'ary', 'arz', 'plx', 'ply', 'plz', 'prx', 'pry', 'prz',
  'cox', 'coy', 'coz', 'cdx', 'cdy', 'cdz', 'cfx', 'cfy', 'cfz', 'bsx', 'bsz'];
function newPose() { const o = {}; for (const k of KEYS) o[k] = 0; return o; }
function copyPose(dst, src) { for (const k of KEYS) dst[k] = src[k]; }
const setV = (P, pre, x, y, z) => { P[pre + 'x'] = x; P[pre + 'y'] = y; P[pre + 'z'] = z; };

function rest(P) {
  for (const k of KEYS) P[k] = 0;
  P.fix = 1; P.lhz = D.stance; P.rhz = -D.stance;
  setV(P, 'al', D.sX + 0.04, D.sY - 0.52, 0.03); setV(P, 'ar', -(D.sX + 0.04), D.sY - 0.52, 0.03);
  setV(P, 'pl', 0.5, -0.3, -1); setV(P, 'pr', -0.5, -0.3, -1);
}
function idleMotion(P, T, sd, k) {
  const w = T * 0.5 + sd * 6;
  P.br = Math.sin(T * 1.7 + sd * 3);
  P.roll = 0.022 * Math.sin(w) * k; P.rx = 0.012 * Math.sin(w + 1) * k;
  P.lhx = 0.02 * Math.sin(w) * k; P.rhx = -P.lhx;
  P.tx = (0.02 + 0.012 * Math.sin(T * 1.7)) * k; P.hx = -0.02 * k; P.hy = 0.35 * glance(T, sd) * k;
  P.alz += 0.01 * Math.sin(T * 1.7 + 1); P.arz += 0.01 * Math.sin(T * 1.7 + 2);
  P.bsx = 0.03 * Math.sin(T * 1.7); P.bsz = 0.02 * Math.sin(T * 1.3);
}

// Address / swing: hands and club ride the arc to the ball (golfers.js), then are
// converted from rig space to torso space so the blend works the same as any pose.
function swingFill(P, p, k, wag) {
  const G = SWG[p.clubKind], { a: a0, h, f } = swingPose(k), a = a0 + wag;
  P.yaw = -Math.PI / 2;                                   // side-on: ball at root +x, shot to root -z
  const shift = 0.06 * smooth(0.42, 0.6, k) - 0.02 * smooth(0.1, 0.4, k);
  P.rx = shift;
  P.lhx = P.rhx = -0.16; P.lhz = D.stance + 0.06; P.rhz = -(D.stance + 0.06); P.lkx = 0.32; P.rkx = 0.32;
  P.rkx += 0.6 * f; P.rhx -= 0.12 * f; P.rhy = -0.55 * f;  // trail knee kicks in on the follow-through
  const drop = liftOf(P.lhx, P.lkx, P.lhz);
  P.ry = -drop; P.fix = 0;
  const turn = a > 0 ? -1.4 * (a / A_TOP) : 1.6 * (a / A_FIN);
  P.tx = lerp(D.tilt, 0.06, smooth(SWING_IMPACT, 0.85, k)); P.ty = turn; P.tz = a > 0 ? 0.1 * (a / A_TOP) : -0.2 * (a / A_FIN);
  P.hy = -turn * 0.8 * (1 - f) + 0.3 * f; P.hx = lerp(0.22, -0.18, f);
  const b = a + h;
  _co.copy(G.Sc).addScaledVector(G.D, G.HR * Math.cos(a)).addScaledVector(G.B, G.HR * Math.sin(a));
  _cd.copy(G.D).multiplyScalar(Math.cos(b)).addScaledVector(G.B, Math.sin(b));
  _cf.copy(G.D).multiplyScalar(Math.sin(b)).addScaledVector(G.B, -Math.cos(b));
  _co.x -= shift; _co.y += drop;                          // hands stay on the arc to the ball, not the weight shift
  _tL.copy(_co).addScaledVector(_cd, 0.045); _tR.copy(_co).addScaledVector(_cd, 0.125);
  _tq.setFromEuler(_eu.set(P.tx, P.ty, P.tz)); _tqi.copy(_tq).invert();
  _ti.compose(_hp, _tq, _one).invert();
  _tL.applyMatrix4(_ti); _tR.applyMatrix4(_ti); _co.applyMatrix4(_ti);
  _cd.applyQuaternion(_tqi); _cf.applyQuaternion(_tqi);
  setV(P, 'al', _tL.x, _tL.y, _tL.z); setV(P, 'ar', _tR.x, _tR.y, _tR.z);
  setV(P, 'pl', 0.3, -1, 0); setV(P, 'pr', -0.3, -1, 0);
  setV(P, 'co', _co.x, _co.y, _co.z); setV(P, 'cd', _cd.x, _cd.y, _cd.z); setV(P, 'cf', _cf.x, _cf.y, _cf.z);
}

function computePose(p, P, mode, st, A) {
  rest(P);
  const t = A.t, T = A.time, sd = p.sd, sX = D.sX, sY = D.sY;
  let clubSet = false, mv = 0, sp = 0, ph = A.phase;
  if (mode === 'walk' || mode === 'carry') { sp = Math.max(0, st?.speed ?? 1.4); mv = smooth(0.03, 0.5, sp); }
  if (mode === 'idle' || mv < 1 && (mode === 'walk' || mode === 'carry')) idleMotion(P, T, sd, mode === 'idle' ? 1 : 1 - mv);

  if (mode === 'walk' || mode === 'carry') {
    const ampK = Math.min(1.25, sp / 1.4), sL = Math.sin(ph), cL = Math.cos(ph);
    const hipAmp = Math.min(0.8, 0.4 * Math.pow(Math.max(sp, 0.05) / 1.4, 0.7)) * mv;
    P.lhx = -hipAmp * sL; P.rhx = hipAmp * sL;
    const kA = Math.min(1.2, 0.45 + 0.22 * sp);
    P.lkx = (0.08 + kA * Math.pow(Math.max(0, cL), 0.8) + 0.25 * Math.max(0, -sL)) * mv;
    P.rkx = (0.08 + kA * Math.pow(Math.max(0, -cL), 0.8) + 0.25 * Math.max(0, sL)) * mv;
    P.tx = (0.04 + 0.018 * sp + 0.05 * clamp01((sp - 2) / 2)) * mv; P.ty = 0.13 * sL * ampK * mv;
    P.hx = -P.tx * 0.7; P.hy = -P.ty * 0.8; P.roll = 0.015 * Math.sin(ph) * mv;
    const phi = Math.min(0.8, 0.18 + 0.2 * sp) * mv, bend = clamp01((sp - 1.6) / 2.4);
    for (const [pre, f, s] of [['al', -sL, 1], ['ar', sL, -1]]) {
      const rr = 0.52 - 0.14 * Math.max(0, f) * (0.4 + bend) - 0.14 * bend * mv, ang = f * phi;
      setV(P, pre, s * (sX + 0.04), sY - rr * Math.cos(ang), rr * Math.sin(ang) + 0.02);
    }
    P.bsx = -0.12 * sL * ampK * mv + 0.03 * Math.sin(T * 1.7) * (1 - mv); P.bsz = 0.05 * Math.sin(ph * 2) * mv;
  } else if (mode === 'address' || mode === 'swing') {
    const k = mode === 'swing' ? clamp01(st?.k ?? 0) : 0;
    swingFill(P, p, k, mode === 'address' ? 0.035 * Math.sin(t * 3.2) * smooth(0.3, 0.8, t) : 0);
    P.br = Math.sin(T * 1.7) * 0.5;
    clubSet = true;
  } else if (mode === 'knocked') {
    P.fix = 0; P.pitch = -Math.PI / 2; P.ry = 0.13; P.br = Math.sin(T * 2.2) * 0.6;
    P.lhx = P.rhx = 0.05; P.lhz = 0.13; P.rhz = -0.13; P.lkx = 0.12 + 0.04 * Math.sin(T * 3); P.rkx = 0.1;
    P.hx = -0.18; P.hy = 0.25 * Math.sin(T * 1.4); P.tz = 0.04;
    setV(P, 'al', sX + 0.5, sY - 0.1, -0.05); setV(P, 'ar', -(sX + 0.5), sY - 0.1, -0.05);
  } else if (mode === 'cheer') {
    const per = 0.7, u = (t % per) / per, hop = Math.sin(Math.PI * u), pump = Math.sin(TAU * u);
    P.fix = 0; P.ry = 0.16 * hop; P.lhx = P.rhx = -0.3 * hop; P.lkx = P.rkx = 0.1 + 0.7 * hop;
    P.br = Math.sin(T * 6); P.tx = -0.06; P.ty = 0.1 * Math.sin(t * TAU / (per * 2)); P.hx = -0.25;
    setV(P, 'al', sX + 0.26, sY + 0.4 + 0.1 * pump, 0.06); setV(P, 'ar', -(sX + 0.26), sY + 0.4 - 0.1 * pump, 0.06);
    setV(P, 'pl', 0.8, -0.5, 0); setV(P, 'pr', -0.8, -0.5, 0);
  } else if (mode === 'facepalm') {
    const u = t % 3.2, sh = smooth(0.6, 0.9, u) * (1 - smooth(2.2, 2.5, u));
    P.br = Math.sin(T * 1.2) * 0.5; P.tx = 0.15; P.hx = 0.3; P.hy = 0.22 * Math.sin(t * 3) * sh; P.roll = 0.03 * Math.sin(T * 0.8);
    setV(P, 'ar', -0.02, sY + 0.152 + 0.008 * Math.sin(t * 6) * sh, 0.21);
    setV(P, 'pr', -1, -0.7, 0);
    setV(P, 'al', sX + 0.08, sY - 0.5, 0.06);
  }

  // props held in the hands (only while the arm is just carrying, not swinging or cheering)
  const carrying = mode === 'idle' || mode === 'walk' || mode === 'carry';
  const holdL = (mode === 'carry' || p.carry === 'bucket') && (carrying || mode === 'facepalm');
  const holdR = (p.club || p.carry === 'tube' || p.carry === 'wand') && carrying;
  if (holdL) setV(P, 'al', sX + 0.05, sY - 0.54, 0.04 + 0.03 * Math.sin(ph) * mv);
  if (holdR) { setV(P, 'ar', -0.25, sY - 0.44, 0.13); setV(P, 'pr', -0.6, -0.3, -1); }
  if (!clubSet) {                                         // club follows the right hand, shaft down and forward
    setV(P, 'co', P.arx, P.ary, P.arz); setV(P, 'cd', 0, -0.8, 0.6); setV(P, 'cf', 1, 0, 0);
  }
  P.bg = (mode === 'address' || mode === 'swing' || mode === 'knocked' || mode === 'cheer') ? 1 : 0;
}

const _hv = new THREE.Vector3(), _gv = new THREE.Vector3(-0.4, 0.37, 0.18);
function applyPose(p, P) {
  const { body, rig, torso, head, chest, pelvis, legL, legR, armL, armR, club, bucket, tube, wand, bag } = p.parts;
  body.rotation.y = Math.PI + P.yaw;
  rig.rotation.set(P.pitch, 0, P.roll);
  legL.hip.rotation.set(P.lhx, P.lhy, P.lhz); legL.knee.rotation.x = P.lkx;
  legR.hip.rotation.set(P.rhx, P.rhy, P.rhz); legR.knee.rotation.x = P.rkx;
  torso.rotation.set(P.tx, P.ty, P.tz); head.rotation.set(P.hx, P.hy, P.hz);
  const lift = Math.min(liftOf(P.lhx, P.lkx, P.lhz), liftOf(P.rhx, P.rkx, P.rhz));
  rig.position.set(P.rx, P.ry - P.fix * lift, 0);
  chest.scale.set(p.build * (1 + 0.015 * P.br), 1 + 0.012 * P.br, 0.62 * (0.95 + 0.1 * (p.build - 0.92) / 0.2) * (1 + 0.03 * P.br));
  solveArm(armL, _T.set(P.alx, P.aly, P.alz), _Pole.set(P.plx, P.ply, P.plz));
  solveArm(armR, _T.set(P.arx, P.ary, P.arz), _Pole.set(P.prx, P.pry, P.prz));

  const shown = p.club, grounded = p.anim.mode === 'address' || p.anim.mode === 'swing';
  club.visible = shown;
  if (shown) orientClub(club, _co.set(P.cox, P.coy, P.coz), _cd.set(P.cdx, P.cdy, P.cdz), _cf.set(P.cfx, P.cfy, P.cfz));
  const free = !shown && !grounded;
  tube.visible = p.carry === 'tube' && free; wand.visible = p.carry === 'wand' && free; bag.visible = p.carry === 'clubbag';
  if (tube.visible) { tube.position.set(P.arx, P.ary + 0.05, P.arz); tube.rotation.set(-0.1, 0, 0.05); }
  if (wand.visible) { wand.position.set(P.arx, P.ary, P.arz); wand.rotation.set(-0.35, 0, 0.04); }

  bucket.visible = p.carry === 'bucket';
  if (bucket.visible) {                                    // hangs from the left hand, or sits on the ground
    torso.updateMatrix(); rig.updateMatrix();
    _hv.set(P.alx, P.aly, P.alz).applyMatrix4(torso.matrix).applyMatrix4(rig.matrix);
    bucket.position.lerpVectors(_hv, _gv, P.bg);
    _qb.setFromEuler(_eu.set(P.bsx, 0, P.bsz));            // bucket lives in body space: upright, plus its pendulum sway
    bucket.quaternion.copy(_qb).slerp(_qId, P.bg);
  }
}

// ---------------------------------------------------------------- animate
const MODES = new Set(['idle', 'walk', 'carry', 'address', 'swing', 'knocked', 'cheer', 'facepalm']);

// state: { mode: 'idle' } | { mode: 'walk'|'carry', speed } | { mode: 'address' } | { mode: 'swing', k }
//      | { mode: 'knocked' } | { mode: 'cheer' } | { mode: 'facepalm' }
export function animatePerson(p, dt, state = { mode: 'idle' }) {
  const A = p.anim;
  dt = Math.min(Math.max(dt || 0, 0), 0.1);
  let mode = state?.mode ?? 'idle';
  if (!MODES.has(mode)) mode = 'idle';
  if (mode !== A.mode) {
    if (A.mode === null) A.blend = 1;
    else { copyPose(A.from, A.cur); A.blend = 0; }
    A.prev = A.mode; A.mode = mode; A.t = 0;
    A.dur = mode === 'address' ? 0.4 : A.prev === 'knocked' ? 0.5 : mode === 'knocked' ? 0.25 : 0.2;
  }
  A.t += dt; A.time += dt;
  if (mode === 'walk' || mode === 'carry') A.phase += dt * (0.35 + 0.45 * Math.max(0, state?.speed ?? 1.4)) * TAU;
  computePose(p, A.tgt, mode, state, A);
  A.blend = Math.min(1, A.blend + dt / A.dur);
  const e = A.blend * A.blend * (3 - 2 * A.blend);
  for (const k of KEYS) A.cur[k] = A.from[k] + (A.tgt[k] - A.from[k]) * e;
  applyPose(p, A.cur);
}
