// Dimple Creek: the Muni field's map rules (council round 3, §3.3-3.4). Plain numbers, no THREE, no DOM:
// the server runs it as the one true copy, browsers run the same ball and cart rules for smooth prediction,
// and terrain.js only draws what is in MAP.
//
// World-dependent behaviour (dry gravel at the Muni, running water from the Club up) always comes in as an
// argument: `world = { venue }`. Nothing here keeps module state, because one Node process runs many crews
// at different venues. A missing world means venue 0.
//
// This module deliberately imports nothing (sim.js is meant to import IT). The handful of constants it shares
// with sim.js (BALL_R, STEP, ROLL_DECEL, POND) are mirrored below and pinned equal by test/map.test.mjs.

export const MAP = {
  // What walkers and the cart are held inside. The nets sit half a metre outside it (NETS), because a ball
  // is clamped to the net itself. NOTE: sim.js's SIM.FIELD is still +-150 x -290..9; this is the smaller one.
  FIELD: { xMin: -64, xMax: 64, zMin: -189, zMax: 9 },
  NETS: { side: 64.5, back: -190 },                            // they catch everything; no fly-overs
  CREEK: {
    HW: 1.6,                                                   // half-width, m (3.2 m wide)
    IN: [[-64, -38], [-46, -46], [-30, -58], [-17.3, -72]],    // inflow: left net -> the pond's inlet (the Delta)
    OUT: [[-5, -82], [8, -96], [28, -102], [46, -108], [64, -114]],   // outflow: the pond's outlet -> the Grate
    DRIFT: 1.5,                                                // m/s, the current (Club+)
  },
  POND: { x: -12, z: -78, r: 8, FROM_VENUE: 1 },               // mirrors sim.js POND; open water from the Club, a mud flat before
  DELTA: { x: -17, z: -72, r: 2.5 },                           // where creek-fed balls settle in the pond
  GRATE: { x: 63, z: -114, r: 2.5 },                           // where outflow balls pile up, at the right net
  // Each bridge spans its creek segment at right angles: `len` runs ACROSS the creek, `w` runs ALONG it.
  // yaw/branch/seg/ux/uz are derived at import (below), see bridgeYaw().
  BRIDGES: [
    { id: 'plank', x: -38, z: -52, len: 5, w: 1.4, cart: false },   // across IN seg 1, foot only
    { id: 'cart', x: 18, z: -99, len: 6, w: 5.0, cart: true },      // across OUT seg 1, the only vehicle crossing
    { id: 'stones', x: 40, z: -106, len: 4.5, w: 1.2, cart: false },// across OUT seg 2, foot only
  ],
  FLAGS: [{ id: 'red', x: -4, z: -48 }, { id: 'yellow', x: 26, z: -76 }, { id: 'blue', x: -6, z: -140 }],
  ROCKS: [{ id: 'dimples', x: 34, z: -150, r: 2.2, h: 2.2 }],           // a 1962 promotional boulder in a necktie
  BOXES: [{ id: 'tractor', x: -48, z: -128, w: 3.2, d: 1.8, h: 2.0 }],  // FHI Grounds Unit 1, retired 1971
  MOWER_SHED: { x: -58, z: 4 },                                         // Club+
  SIGN: { x: -6, z: -69.8, text: 'POND · CLOSED FOR SYNERGY' },    // venue 0 only, on the near shore
  // Callouts: every landmark is a pile spot or a place something happens (rule 2). `minVenue` is when the
  // name enters the crew's vocabulary. y is a good label height for CCTV/beacons.
  LANDMARKS: [
    { id: 'red', name: 'Red', x: -4, z: -48, y: 6.6, kind: 'flag' },
    { id: 'yellow', name: 'Yellow', x: 26, z: -76, y: 6.6, kind: 'flag' },
    { id: 'blue', name: 'Blue', x: -6, z: -140, y: 6.6, kind: 'flag' },
    { id: 'plank', name: 'the Plank', x: -38, z: -52, y: 2.2, kind: 'bridge' },
    { id: 'cart', name: 'the Bridge', x: 18, z: -99, y: 2.6, kind: 'bridge' },
    { id: 'stones', name: 'the Stones', x: 40, z: -106, y: 2.0, kind: 'bridge' },
    { id: 'dimples', name: 'the Rock', x: 34, z: -150, y: 3.6, kind: 'rock' },
    { id: 'tractor', name: 'the Tractor', x: -48, z: -128, y: 3.2, kind: 'box' },
    { id: 'backnet', name: 'the Back Net', x: 0, z: -190, y: 6, kind: 'net' },
    { id: 'delta', name: 'the Delta', x: -17, z: -72, y: 2.2, kind: 'creek', minVenue: 1 },
    { id: 'grate', name: 'the Grate', x: 63, z: -114, y: 2.4, kind: 'creek', minVenue: 1 },
  ],
};

// ---- constants mirrored from sim.js (pinned equal by the test) ---------------------------------------------
const R = 0.06;            // SIM.BALL_R
const STEP = 1 / 120;      // SIM.STEP
const ROLL_DECEL = 3.2;    // SIM.ROLL_DECEL

const { HW } = MAP.CREEK;
const venueOf = world => world?.venue ?? 0;
const wetAt = world => venueOf(world) >= 1;                 // the water is on
const pondOpen = world => venueOf(world) >= MAP.POND.FROM_VENUE;

// ---- creek geometry: two polylines, precomputed -----------------------------------------------------------
function buildBranch(pts) {
  const segs = []; let s = 0;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [x0, z0] = pts[i], [x1, z1] = pts[i + 1];
    const len = Math.hypot(x1 - x0, z1 - z0);
    segs.push({ x0, z0, x1, z1, len, s0: s, dx: (x1 - x0) / len, dz: (z1 - z0) / len });
    s += len;
  }
  return { segs, len: s };
}
const BRANCHES = { in: buildBranch(MAP.CREEK.IN), out: buildBranch(MAP.CREEK.OUT) };
export const creekLength = branch => BRANCHES[branch].len;

// The point `s` metres along a branch (clamped), with its unit direction of flow.
export function creekPoint(branch, s) {
  const B = BRANCHES[branch];
  s = Math.max(0, Math.min(B.len, s));
  let g = B.segs[B.segs.length - 1];
  for (const q of B.segs) if (s <= q.s0 + q.len) { g = q; break; }
  const t = s - g.s0;
  return { x: g.x0 + g.dx * t, z: g.z0 + g.dz * t, dx: g.dx, dz: g.dz, s };
}

// Nearest point on the creek centreline: { d, branch, s, seg, x, z, side } (side: +1 left of the flow).
export function creekProject(x, z) {
  let best = null;
  for (const branch of ['in', 'out']) {
    const B = BRANCHES[branch];
    for (let i = 0; i < B.segs.length; i++) {
      const g = B.segs[i];
      const t = Math.max(0, Math.min(g.len, (x - g.x0) * g.dx + (z - g.z0) * g.dz));
      const px = g.x0 + g.dx * t, pz = g.z0 + g.dz * t;
      const d = Math.hypot(x - px, z - pz);
      if (!best || d < best.d) best = { d, branch, s: g.s0 + t, seg: i, x: px, z: pz, side: (x - px) * -g.dz + (z - pz) * g.dx >= 0 ? 1 : -1 };
    }
  }
  return best;
}

// ---- bridges: derived frames --------------------------------------------------------------------------------
// Local frame: X (length) runs across the creek, Z (width) runs along it. A mesh built that way and given
// rotation.y = yaw sits right. u = unit vector along the creek, n = unit vector across it.
for (const b of MAP.BRIDGES) {
  const p = creekProject(b.x, b.z);
  const g = BRANCHES[p.branch].segs[p.seg];
  b.branch = p.branch; b.seg = p.seg; b.ux = g.dx; b.uz = g.dz;
  b.yaw = Math.atan2(-g.dx, -g.dz);   // local +X -> (cos yaw, -sin yaw) = (-dz, dx), perpendicular to flow
}
export const bridgeYaw = id => MAP.BRIDGES.find(b => b.id === id)?.yaw ?? 0;

// Which bridge deck (or stepping-stone strip) is this point on? Returns the bridge or null.
export function onBridge(x, z, pad = 0) {
  for (const b of MAP.BRIDGES) {
    const dx = x - b.x, dz = z - b.z;
    const along = dx * b.ux + dz * b.uz;                  // width axis
    const across = dx * -b.uz + dz * b.ux;                // length axis
    if (Math.abs(across) <= b.len / 2 + pad && Math.abs(along) <= b.w / 2 + pad) return b;
  }
  return null;
}

// ---- the surface grid: a 1 m broad phase built once at import ----------------------------------------------
// Cells that could touch the creek are flagged; only those pay for the exact (analytic) creek test.
const GX0 = -65, GZ0 = -191, GW = 130, GH = 201;
const NEAR = new Uint8Array(GW * GH);
for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
  if (creekProject(GX0 + i + 0.5, GZ0 + j + 0.5).d <= HW + 0.72) NEAR[j * GW + i] = 1;
}
const nearCreek = (x, z) => {
  const i = Math.floor(x - GX0), j = Math.floor(z - GZ0);
  return i >= 0 && i < GW && j >= 0 && j < GH && NEAR[j * GW + i] === 1;
};

export const inPondArea = (x, z, pad = 0) => Math.hypot(x - MAP.POND.x, z - MAP.POND.z) < MAP.POND.r + pad;

// 'fairway' | 'gravel' | 'mud' | 'water' | 'pond'. Bridge decks are fairway; the pond zone is mud at the
// Muni (a drained flat) and open 'pond' from the Club up.
export function surfaceAt(x, z, world) {
  if (inPondArea(x, z)) return pondOpen(world) ? 'pond' : 'mud';
  if (!nearCreek(x, z)) return 'fairway';
  if (creekProject(x, z).d >= HW) return 'fairway';
  if (onBridge(x, z)) return 'fairway';
  return wetAt(world) ? 'water' : 'gravel';
}

// Walking speed multiplier on this spot (the pond itself keeps main.js's existing swim rule).
export function wadeFactor(x, z, world) {
  const s = surfaceAt(x, z, world);
  return s === 'gravel' || s === 'mud' ? 0.8 : s === 'water' ? 0.5 : 1;
}

// ---- the cart: the same rule wet or dry --------------------------------------------------------------------
// Blocked when: within HW + 1.0 of the creek and off the Cart Bridge's deck; within the pond (or the mud flat)
// + 1 m; within a rock or box + 1.2 m; outside the field (the cart's z limit is zMax + 6, the parking spot).
// `world` is accepted for symmetry and deliberately ignored: what the driver learns on day 4 stays true.
export function cartBlocked(x, z, world) {   // eslint-disable-line no-unused-vars
  const F = MAP.FIELD;
  if (x < F.xMin || x > F.xMax || z < F.zMin || z > F.zMax + 6) return true;
  if (inPondArea(x, z, 1)) return true;
  for (const r of MAP.ROCKS) if (Math.hypot(x - r.x, z - r.z) < r.r + 1.2) return true;
  for (const b of MAP.BOXES) if (Math.abs(x - b.x) < b.w / 2 + 1.2 && Math.abs(z - b.z) < b.d / 2 + 1.2) return true;
  if (z < -30 && z > -125 && creekProject(x, z).d < HW + 1.0) {   // cheap box reject first; the creek lives here
    const br = onBridge(x, z);
    if (!(br && br.cart)) return true;
  }
  return false;
}

// Clamp a walker or cart (anything with x, z) to the field. Returns true if it moved.
export function keepInField(p, zPad = 0) {
  const F = MAP.FIELD;
  const x = Math.max(F.xMin, Math.min(F.xMax, p.x)), z = Math.max(F.zMin, Math.min(F.zMax + zPad, p.z));
  const moved = x !== p.x || z !== p.z;
  p.x = x; p.z = z;
  return moved;
}

// ---- balls: nets and obstacles ----------------------------------------------------------------------------------
// The nets catch everything. A ball past x = +-64.5 or z = -190 is put back on the net; its normal velocity
// reverses at x0.1 and everything else (tangential, and vy) is kept at x0.4, so it drops. Returns true if hit.
export function netClamp(b) {
  const { side, back } = MAP.NETS;
  let hit = false;
  if (b.x > side || b.x < -side) { b.x = b.x > 0 ? side : -side; b.vx *= -0.1; b.vz *= 0.4; b.vy *= 0.4; hit = true; }
  if (b.z < back) { b.z = back; b.vz *= -0.1; b.vx *= 0.4; b.vy *= 0.4; hit = true; }
  return hit;
}

// Balls reflect off Dimples Rock (a circle) and the Old Tractor (a box) below their heights, at x0.5; they pile
// on the side they arrived from. Returns true if it bounced.
export function obstacleBounce(b) {
  let hit = false;
  for (const o of MAP.ROCKS) {
    if (b.y - R > o.h) continue;
    const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz), lim = o.r + R;
    if (d >= lim) continue;
    const nx = d > 1e-6 ? dx / d : 1, nz = d > 1e-6 ? dz / d : 0;
    b.x = o.x + nx * lim; b.z = o.z + nz * lim;
    const vn = b.vx * nx + b.vz * nz;
    if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vz -= 1.5 * vn * nz; }   // vn -> -0.5 vn
    hit = true;
  }
  for (const o of MAP.BOXES) {
    if (b.y - R > o.h) continue;
    const hx = o.w / 2 + R, hz = o.d / 2 + R, dx = b.x - o.x, dz = b.z - o.z;
    if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue;
    if (hx - Math.abs(dx) < hz - Math.abs(dz)) {          // shallowest way out: along x
      const s = dx >= 0 ? 1 : -1; b.x = o.x + s * hx;
      if (b.vx * s < 0) b.vx *= -0.5;
    } else {
      const s = dz >= 0 ? 1 : -1; b.z = o.z + s * hz;
      if (b.vz * s < 0) b.vz *= -0.5;
    }
    hit = true;
  }
  return hit;
}

// One call per physics step, after the position update: nets, then obstacles.
export function ballFeatures(b) {
  const n = netClamp(b), o = obstacleBounce(b);
  return n || o;
}

// ---- balls: how they land on each surface -------------------------------------------------------------------------
// Overrides to the kind's own physics. Absent keys leave the sim's defaults alone, so fairway is untouched.
//   gravel: lands dead (bounce x0.4 of the usual, almost no forward carry, roll x6); mud: stays put like a square ball;
//   water: drifts (see startDrift).
export const SURFACE_PHYS = {
  gravel: { bounce: 0.08, keep: 0.02, roll: 6 },
  mud: { stick: true },
  water: { drift: true },
};

// Classify a landing without touching the ball: { surface, action, branch?, s0? }.
//   action: 'bounce' (fairway, as today) | 'dead' (gravel) | 'stick' (mud) | 'sink' (open pond: the server's
//   existing sink()) | 'drift' (creek water; branch and s0 say where it joins the current).
export function landBall(b, world) {
  const surface = surfaceAt(b.x, b.z, world);
  if (b.kind === 'one') return { surface, action: 'bounce' };         // Ball No. 1 doesn't fly
  if (surface === 'water') { const p = creekProject(b.x, b.z); return { surface, action: 'drift', branch: p.branch, s0: p.s }; }
  if (surface === 'gravel') return { surface, action: 'dead' };
  if (surface === 'mud') return { surface, action: 'stick' };
  if (surface === 'pond') return { surface, action: 'sink' };
  return { surface, action: 'bounce' };
}

// Drop-in replacement for stepOnce's `if (b.y < R) {...}` block. `k` is KIND_PHYS[b.kind]. Fairway arithmetic is
// identical to today's. Returns 'rest' (came to rest; same as `true` from stepOnce), 'drift' (landed in running
// water: the ball is stopped, call startDrift), or null (still moving).
export function groundContact(b, world, k) {
  b.y = R;
  const surface = surfaceAt(b.x, b.z, world);
  if (surface === 'water' && b.kind !== 'one') { b.vx = b.vy = b.vz = 0; return 'drift'; }
  const sp = SURFACE_PHYS[surface];
  if (k?.stick || sp?.stick) { b.vx = b.vy = b.vz = 0; b.rest = true; return 'rest'; }
  if (b.vy < -1) {
    const e = sp?.bounce ?? k?.bounce ?? 0.35, keep = sp?.keep ?? k?.keep ?? 0.7;
    b.vy *= -e; b.vx *= keep; b.vz *= keep;
  } else {
    b.vy = 0;
    const s = Math.hypot(b.vx, b.vz), ns = Math.max(0, s - ROLL_DECEL * (k?.roll ?? 1) * (sp?.roll ?? 1) * STEP);
    if (ns === 0) { b.vx = 0; b.vz = 0; b.rest = true; return 'rest'; }
    b.vx *= ns / s; b.vz *= ns / s;
  }
  return null;
}

// ---- the creek as a free conveyor (Club and up) ----------------------------------------------------------------------
// A drifting ball is state plus a start: { branch, s0, v }, never streamed positions. Server and client both
// evaluate driftAt(), so they agree with no traffic. Inflow ends in 'sink' at the Delta (the diver's pile);
// outflow ends in 'rest' at the Grate (the cart's pile).
const END_S = { in: () => BRANCHES.in.len, out: () => BRANCHES.out.len - 1.0 };   // out: rests 1 m short of the net
const END_KIND = { in: 'sink', out: 'rest' };

export function startDrift(b, world) {
  const L = landBall(b, world);
  if (L.action !== 'drift') return null;
  b.drift = { branch: L.branch, s0: L.s0, v: MAP.CREEK.DRIFT, s: L.s0 };   // s0 is what the event carries; s is progress
  b.drifting = true;
  return b.drift;
}
export const driftEvent = b => ({ t: 'drift', id: b.id, branch: b.drift.branch, s0: b.drift.s0, v: b.drift.v });
export const driftSecs = (branch, s0, v = MAP.CREEK.DRIFT) => Math.max(0, END_S[branch]() - s0) / v;

// Pure: where is a drift `t` seconds after it started? { x, z, s, end: null | 'sink' | 'rest' }.
export function driftAt(d, t) {
  const end = END_S[d.branch](), s = Math.min(end, d.s0 + d.v * Math.max(0, t));
  const p = creekPoint(d.branch, s);
  return { x: p.x, z: p.z, s, end: s >= end ? END_KIND[d.branch] : null };
}

// Mutating step for the server's tick: advances b.drift.s, moves the ball, returns 'sink' | 'rest' | null.
export function stepDrift(b, dt) {
  const d = b.drift;
  if (!d) return null;
  const end = END_S[d.branch]();
  d.s = Math.min(end, (d.s ?? d.s0) + d.v * dt);
  const p = creekPoint(d.branch, d.s);
  b.x = p.x; b.z = p.z; b.y = R; b.vx = b.vy = b.vz = 0;
  if (d.s >= end) {
    b.drifting = false;
    const r = END_KIND[d.branch];
    if (r === 'rest') { b.rest = true; const q = restSpot(b.id); b.x = q.x; b.z = q.z; }
    else { const q = sinkSpot(b.id); b.x = q.x; b.z = q.z; }
    return r;
  }
  return null;
}

// A stable per-ball scatter in a disc, so piles look like piles (deterministic from the ball id).
const idNum = id => typeof id === 'number' ? id | 0 : [...String(id)].reduce((h, c) => Math.imul(h, 31) + c.charCodeAt(0) | 0, 7);
const hash01 = (id, salt) => { let h = Math.imul(idNum(id), 2654435761) + salt * 40503; h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return ((h >>> 0) % 10007) / 10007; };
function discSpot(c, id, rMul) {
  const a = hash01(id, 1) * Math.PI * 2, r = Math.sqrt(hash01(id, 2)) * c.r * rMul;
  return { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r };
}
export const sinkSpot = id => discSpot(MAP.DELTA, id, 1);         // inside the pond (the Delta is on its shore)
export function restSpot(id) {                                    // the Grate pile, kept inside the net
  const q = discSpot(MAP.GRATE, id, 0.75);
  q.x = Math.min(q.x, MAP.NETS.side - 0.3);
  return q;
}

// ---- callouts ------------------------------------------------------------------------------------------------------
export const landmarksFor = world => MAP.LANDMARKS.filter(l => (l.minVenue ?? 0) <= venueOf(world));
// "by the Plank": the nearest named landmark within maxD, for callouts and beacons.
export function nearestLandmark(x, z, world, maxD = 14) {
  let best = null, bd = maxD;
  for (const l of landmarksFor(world)) {
    const d = l.kind === 'net' ? Math.abs(z - l.z) : Math.hypot(x - l.x, z - l.z);
    if (d < bd) { bd = d; best = l; }
  }
  return best && { ...best, d: bd };
}
