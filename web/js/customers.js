// Customer lifecycle, shared rules: plain numbers, no THREE, no DOM. The server
// runs stepMat() as the one true copy; the browser only calls custPos() to draw.
//
// Each mat carries a tiny state machine. What crosses the wire is
//   { cust, st, t0, look, left, inc }   (state + start time, NEVER positions)
// and every position is a pure function of (state, t0, t), so server and all
// browsers agree without a single position being sent.
//
// Occupant states (mat.st):
//   'empty'   nobody here
//   'playing' hitting a bucket; the per-mat ball timer may fire (matReady)
//   'wait'    arrived at a muddy mat (mud >= REFUSE_MUD): stands on the walkway, arms crossed. Seated once the
//             mat is under WAIT_OK; after WAIT_MAX s they refuse (-> 'sulk')
//   'sulk'    refused a muddy mat: sulks CUST.SULK s, then leaves
//   'leave'   walking out with the empty bucket (the mat is free from here on)
// Incoming customer (mat.inc = {cust, look, t0}) is in the 'arrive' state: they walk
// gate -> the basket by the BUCKETS dispenser (grab a bucket; owner layout, layout.js) -> mat. It is a second slot so the next
// customer is already walking in while the last bucket empties (no idle mat, no queue).
//
// Owner playtest 3 §3.3: the basket can run out. An arriving customer reaches it at inc.t0 + tA and takes a bucket
// through ctx.takeBucket() (none given: there's always one). An empty basket: they wait there (inc.wb, arms crossed,
// facing the machine; inc.t0 is held so the walk resumes from the basket) for WAIT_MAX s, then refuse ('nobucket').
// §3.2: an arrival picks its mat among the free open ones (pickMat, weighted 1 − mud) when ctx.mats is given.
//
// Time is one monotonic server clock in seconds (`now`); it never pauses.

import { LINE as MATS, UPPER_BAYS } from './sim.js';   // round 11 (bays.js): the whole line, the new wing too
import { BASKET_POINT } from './layout.js';
import { WING_WALK_X } from './bays.js';

export const CUST = {
  WALK: 1.3,              // m/s
  BUCKET: 30,             // balls per bucket
  BUCKET_CLUB: 40,        // balls per bucket at the Range Club (venue >= 1) and up
  REFUSE_MUD: 0.9,        // mat mud at or above this: the customer will not step on, and waits
  WAIT_OK: 0.6,           // hose the mat under this and the waiting customer steps on
  WAIT_MAX: 25,           // s a customer waits at a muddy mat before refusing and leaving
  SULK: 2,                // s of sulking before they leave
  EMPTY_AFTER_REFUSE: 30, // s the mat stays empty (nobody arrives) after a refusal
  GRAB: 2,                // s at the basket picking up a bucket
  SETUP: 1.5,             // s after 'playing' starts before the first ball (set the bucket down)
  FINISH: 1.8,            // s after the last ball is hit before they pick up and leave
  LEAVE_HOLD: 8,          // s the mat reports 'leave' (the walker keeps walking client-side)
  GAP: 8,                 // default mean seconds per ball, used to time the next arrival
  PLAY_DX: 0.6,           // default offset of a golfer's feet left of the mat centre (people.js p.ball.x)
};

// ---- council round 10 #3: the Upper Deck's six middle bays (Tiered on) -----------------------------------------
// Six more "mats" above lower mats 2-7 (x -10..10), indices 16..21 in crew.mats (round 11: after the whole line). Their customers hit from y 3.1 at the
// deck's front, behind the low rail (z 2.6: the ball passes under the rail's bar). No mud, no basket (the bar sells
// them a bucket at the top of the stairs), no lead. They come up the stairs from x -27.5 and leave the same way.
// Activation goes from the middle out (solo: the two centre bays), so a small crew's drinkers stand over the return.
export const UPPER = {
  FROM: MATS.length,                     // crew.mats index of the first upper bay
  X: [-10, -6, -2, 2, 6, 10],
  Y: 3.1,                                // the tee (the deck's top is y 3)
  Z: 2.6,                                // feet and ball, behind the low rail at z 2.1
  FLOOR: 3,
  ORDER: [2, 3, 1, 4, 0, 5],             // which bays open first
  STAIRS_X: -27.5,
};
export const UPPER_MATS = UPPER.X.map((x, k) => ({ i: UPPER.FROM + k, x, upper: true }));
export const isUpper = mat => (typeof mat === 'object' ? mat.i ?? mat.mat : mat) >= UPPER.FROM;
// The upper bays open (seat indices 0..5, ascending) for n bays in play.
export const upperOpen = n => UPPER.ORDER.slice(0, Math.max(0, Math.min(UPPER_BAYS, n | 0))).sort((a, b) => a - b);
// A customer's shot from an upper bay: launch()'s numbers from the deck (same three RNG draws), the spray widened by
// the seat's mugs (council round 10 §2: aim spread x (1 + 0.15 x mugs)).
export function upperLaunch(mat, rng, mugs = 0) {
  const speed = 16 + rng() * 22, loft = 0.25 + rng() * 0.35, aim = (rng() - 0.5) * 0.35 * (1 + 0.15 * Math.max(0, mugs));
  const h = speed * Math.cos(loft);
  return { x: mat.x, y: UPPER.Y, z: UPPER.Z, vx: Math.sin(aim) * h, vy: speed * Math.sin(loft), vz: -Math.cos(aim) * h };
}
// Which crew.mats index a customer ball just left from (its spawn x, y, z), or -1: the client's swing cue.
export function matOfShot(x, y, z) {
  if (Math.abs(z - PLAY_Z) < 0.2 && y < 1) return MATS.findIndex(m => Math.abs(m.x - x) < 0.3);
  if (Math.abs(z - UPPER.Z) < 0.2 && Math.abs(y - UPPER.Y) < 0.2) { const k = UPPER.X.findIndex(v => Math.abs(v - x) < 0.3); return k < 0 ? -1 : UPPER.FROM + k; }
  return -1;
}

export const bucketFor = venue => (venue ?? 0) >= 1 ? CUST.BUCKET_CLUB : CUST.BUCKET;

// ---- the route (mirrors ENTRANCE in scenery.js; a test keeps them equal) -------------
export const GATE = { x: -3, z: 9.5 };
export const ENTRANCE_PATH = [[-12, 35.5], [-12, 31], [-3, 31], [-3, 20], [-3, 9.5], [-3, 5.5], [8, 5.5], [18, 5.5], [BASKET_POINT.x, BASKET_POINT.z]];
export const STAND_POINT = BASKET_POINT;              // end of the path: at the basket by the dispenser, facing the machine
export const APPROACH_Z = 2.2;                         // the walkway behind the golfers
export const PLAY_Z = -0.4;                            // a golfer's feet z at the mat (the ball sits here)
export const EXIT_POINT = { x: -3, z: 20 };           // walkers despawn here, out through the gate

const polyLen = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
function polyAt(pts, d) {
  let r = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az);
    if (r <= L || i === pts.length - 1) {
      const u = L > 0 ? Math.min(1, r / L) : 1;
      return { x: ax + (bx - ax) * u, z: az + (bz - az) * u, hx: L ? (bx - ax) / L : 0, hz: L ? (bz - az) / L : 1 };
    }
    r -= L;
  }
}
// people.js faces root -z at rotation 0: forward = (-sin yaw, -cos yaw)
const heading = (hx, hz) => Math.atan2(-hx, -hz);
const matIdx = mat => typeof mat === 'object' ? mat.i ?? mat.mat : mat;
const matX = mat => { const i = matIdx(mat); return i >= UPPER.FROM ? UPPER.X[i - UPPER.FROM] : MATS[i].x; };
// 3D legs for the upper bays: [x, y, z] points; y rides the stairs (x -25 -> -20 climbs 0 -> 3).
const poly3Len = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); return L; };
function poly3At(pts, d) {
  let r = Math.max(0, d);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (r <= L || i === pts.length - 1) {
      const u = L > 0 ? Math.min(1, r / L) : 1, hl = Math.hypot(b[0] - a[0], b[2] - a[2]);
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, z: a[2] + (b[2] - a[2]) * u, hx: hl ? (b[0] - a[0]) / hl : 0, hz: hl ? (b[2] - a[2]) / hl : 1 };
    }
    r -= L;
  }
}
const UP_BACK_Z = 7.5, UP_DECK_Z = 4;     // behind the deck's back wall (z 6.1); the stairs and the deck's walkway
const upTop = () => [-20, UPPER.FLOOR, UP_DECK_Z];
const upFoot = () => [[GATE.x, 0, GATE.z], [GATE.x, 0, UP_BACK_Z], [UPPER.STAIRS_X, 0, UP_BACK_Z], [UPPER.STAIRS_X, 0, UP_DECK_Z], [-25, 0, UP_DECK_Z], upTop()];
export function upperArriveRoute(mat, dx = CUST.PLAY_DX) {
  const sx = matX(mat) - dx;
  const A = upFoot(), B = [upTop(), [sx, UPPER.FLOOR, UP_DECK_Z], [sx, UPPER.FLOOR, UPPER.Z]];
  const lenA = poly3Len(A), lenB = poly3Len(B), toApproach = poly3Len(B.slice(0, 2));
  return { A, B, sx, tA: lenA / CUST.WALK, tG: CUST.GRAB, tB: lenB / CUST.WALK, tHold: lenA / CUST.WALK + CUST.GRAB + toApproach / CUST.WALK, upper: true };
}
export function upperLeaveRoute(mat, dx = CUST.PLAY_DX) {
  const sx = matX(mat) - dx;
  const P = [[sx, UPPER.FLOOR, UPPER.Z], [sx, UPPER.FLOOR, UP_DECK_Z], ...upFoot().reverse(), [EXIT_POINT.x, 0, EXIT_POINT.z]];
  return { P, dur: poly3Len(P) / CUST.WALK, sx, upper: true };
}

// Gate -> the basket, then basket -> mat. Returns the two legs and their timings.
export function arriveRoute(mat, dx = CUST.PLAY_DX) {
  if (isUpper(mat)) return upperArriveRoute(mat, dx);
  const sx = matX(mat) - dx;
  const A = [[GATE.x, GATE.z], ...ENTRANCE_PATH.slice(5)];
  const B = [[STAND_POINT.x, STAND_POINT.z], [22.5, APPROACH_Z], [sx, APPROACH_Z], [sx, PLAY_Z]];
  const lenA = polyLen(A), lenB = polyLen(B), toApproach = polyLen(B.slice(0, 3));
  return { A, B, sx, tA: lenA / CUST.WALK, tG: CUST.GRAB, tB: lenB / CUST.WALK, tHold: lenA / CUST.WALK + CUST.GRAB + toApproach / CUST.WALK };
}
export const arriveDur = (mat, dx) => { const r = arriveRoute(mat, dx); return r.tA + r.tG + r.tB; };

// Mat -> back to the walkway -> path -> out through the gate.
// basket: they never got a bucket (owner playtest 3 §3.3), so they walk back out from the basket.
export function leaveRoute(mat, dx = CUST.PLAY_DX, basket = false) {
  if (isUpper(mat)) return upperLeaveRoute(mat, dx);
  const sx = matX(mat) - dx;
  const P = basket ? [[STAND_POINT.x, STAND_POINT.z], [18, 5.5], [-3, 5.5], [GATE.x, GATE.z], [EXIT_POINT.x, EXIT_POINT.z]]
    : [[sx, PLAY_Z], [sx, APPROACH_Z], ...(sx < WING_WALK_X ? [[WING_WALK_X, APPROACH_Z]] : []), [-3, 5.5], [GATE.x, GATE.z], [EXIT_POINT.x, EXIT_POINT.z]];   // round 11: the wing walks the walkway past the Tiered stairs
  return { P, dur: polyLen(P) / CUST.WALK, sx };
}
export const leaveDur = (mat, dx) => leaveRoute(mat, dx).dur;

// Where a customer is at time t. c = { mat, st, t0, hold? }  (mat: index or {i}).
//   hold: an arriving customer whose mat is still taken waits at the walkway instead
// Returns { x, z, yaw, speed, act, carry, done }
//   act: 'walk' | 'grab' | 'wait' | 'set' | 'play' | 'sulk'
//   carry: holding the bucket (on the ground beside the feet during set/play)
//   done: the walk-out is finished, so the figure can be removed
export function custPos(c, t, opt = {}) {
  if (isUpper(c.mat)) return upperPos(c, t, opt);
  const dx = opt.dx ?? CUST.PLAY_DX, u = Math.max(0, t - c.t0);
  const sx = matX(c.mat) - dx;
  const at = (x, z, extra) => ({ x, z, yaw: 0, speed: 0, act: 'wait', carry: false, done: false, ...extra });
  if (c.st === 'arrive') {
    const r = arriveRoute(c.mat, dx);
    const uu = c.hold ? Math.min(u, r.tHold) : Math.min(u, r.tA + r.tG + r.tB);
    if (uu < r.tA) { const p = polyAt(r.A, uu * CUST.WALK); return at(p.x, p.z, { yaw: heading(p.hx, p.hz), speed: CUST.WALK, act: 'walk' }); }
    if (c.wb) return at(STAND_POINT.x, STAND_POINT.z, { yaw: heading(0, 1), act: 'wait' });   // no bucket: arms crossed at the machine
    if (uu < r.tA + r.tG) return at(STAND_POINT.x, STAND_POINT.z, { yaw: heading(0, 1), act: 'grab', carry: uu - r.tA > r.tG * 0.5 });   // facing the machine (+z)
    const p = polyAt(r.B, (uu - r.tA - r.tG) * CUST.WALK);
    const end = uu >= r.tA + r.tG + r.tB || (c.hold && uu >= r.tHold);
    return at(p.x, p.z, { yaw: end ? 0 : heading(p.hx, p.hz), speed: end ? 0 : CUST.WALK, act: end ? 'wait' : 'walk', carry: true });
  }
  // Round 11: the bucket is set down by the mat (ballreturn.js draws it there, emptying as they hit), so not in hand.
  if (c.st === 'playing') return at(sx, PLAY_Z, { act: u < CUST.SETUP ? 'set' : 'play', carry: false });
  if (c.st === 'wait') return at(sx, APPROACH_Z, { act: 'wait', carry: true });
  if (c.st === 'sulk') return at(sx, APPROACH_Z, { act: 'sulk', carry: true });
  if (c.st === 'leave') {
    const r = leaveRoute(c.mat, dx, !!c.basket), d = Math.min(u * CUST.WALK, r.dur * CUST.WALK);
    const p = polyAt(r.P, d), done = u >= r.dur;
    // Round 11: the emptied bucket stays at the bay (the held bucket model is always full), so they walk out empty-handed.
    return at(p.x, p.z, { yaw: heading(p.hx, p.hz), speed: done ? 0 : CUST.WALK, act: 'walk', carry: false, done });
  }
  if (c.st === 'fell') return at(sx, APPROACH_Z, { done: true });
  return at(sx, APPROACH_Z);
}

// The upper bays' version: the same states, with a y on every position (the stairs, and the deck at y 3).
// 'fell' (council round 10 #3): the drunkest fell off the deck; views/deck.js draws the fall, the crowd drops the figure.
function upperPos(c, t, opt = {}) {
  const dx = opt.dx ?? CUST.PLAY_DX, u = Math.max(0, t - c.t0), sx = matX(c.mat) - dx;
  const at = (x, y, z, extra) => ({ x, y, z, yaw: 0, speed: 0, act: 'wait', carry: false, done: false, ...extra });
  if (c.st === 'arrive') {
    const r = upperArriveRoute(c.mat, dx);
    const uu = c.hold ? Math.min(u, r.tHold) : Math.min(u, r.tA + r.tG + r.tB);
    if (uu < r.tA) { const p = poly3At(r.A, uu * CUST.WALK); return at(p.x, p.y, p.z, { yaw: heading(p.hx, p.hz), speed: CUST.WALK, act: 'walk' }); }
    const top = upTop();
    if (uu < r.tA + r.tG) return at(top[0], top[1], top[2], { yaw: heading(1, 0), act: 'grab', carry: uu - r.tA > r.tG * 0.5 });   // at the bar
    const p = poly3At(r.B, (uu - r.tA - r.tG) * CUST.WALK);
    const end = uu >= r.tA + r.tG + r.tB || (c.hold && uu >= r.tHold);
    return at(p.x, p.y, p.z, { yaw: end ? 0 : heading(p.hx, p.hz), speed: end ? 0 : CUST.WALK, act: end ? 'wait' : 'walk', carry: true });
  }
  if (c.st === 'playing') return at(sx, UPPER.FLOOR, UPPER.Z, { act: u < CUST.SETUP ? 'set' : 'play', carry: true });
  if (c.st === 'wait' || c.st === 'sulk') return at(sx, UPPER.FLOOR, UP_DECK_Z, { act: c.st, carry: true });
  if (c.st === 'leave') {
    const r = upperLeaveRoute(c.mat, dx), p = poly3At(r.P, Math.min(u, r.dur) * CUST.WALK), done = u >= r.dur;
    return at(p.x, p.y, p.z, { yaw: heading(p.hx, p.hz), speed: done ? 0 : CUST.WALK, act: 'walk', carry: false, done });   // round 11: empty-handed
  }
  return at(sx, UPPER.FLOOR, UPPER.Z, { done: c.st === 'fell' });
}

// ---- the per-mat state machine -----------------------------------------------------
let _ids = 0;
export function newMat(i) {
  return { i, st: 'empty', cust: 0, t0: 0, look: 0, balls: 0, fin: 0, noBefore: 0, inc: null, clock: 0 };
}
const newLook = rng => 1 + Math.floor(rng() * 1e6);
const nextId = ctx => ctx.nextCust ? ctx.nextCust() : ++_ids;

// Is this mat's customer ready to hit a ball right now? (The crew's per-mat timer
// should only fire when this is true, then call shoot().)
export const matReady = (mat, now) => mat.st === 'playing' && mat.balls > 0 && !mat.fin && now - mat.t0 >= CUST.SETUP;

// A ball was hit: spend one from the bucket. When the bucket empties, the customer
// leaves after FINISH s. Returns events.
export function shoot(mat, now) {
  if (mat.st !== 'playing' || mat.balls <= 0) return [];
  mat.balls--;
  const ev = [{ t: 'ballBudget', mat: mat.i, cust: mat.cust, left: mat.balls }];
  if (mat.balls === 0) mat.fin = now + CUST.FINISH;
  return ev;
}

function toLeave(mat, now, why, ev) {
  ev.push({ t: 'leave', mat: mat.i, cust: mat.cust, why });
  mat.st = 'leave'; mat.t0 = now; mat.balls = 0; mat.fin = 0;
}
function seat(mat, now, balls, ev, venue) {
  mat.st = 'playing'; mat.t0 = now; mat.balls = balls; mat.fin = 0;
  ev.push({ t: 'start', mat: mat.i, cust: mat.cust, look: mat.look, balls });
  ev.push({ t: 'ballBudget', mat: mat.i, cust: mat.cust, left: balls });
}

// Opening bell: every open mat is already taken by an early bird (no walk, partial
// bucket so refills stagger); the rest are empty. Returns events.
// mud: (i) => this mat's mud 0..1. An early bird never takes a mat at >= REFUSE_MUD: they wait behind it.
export function openShift(mats, { now = 0, rng = Math.random, venue = 0, nOpen = mats.length, nextCust, mud, isOpen } = {}) {
  const ev = [], ctx = { nextCust };
  for (const mat of mats) {
    Object.assign(mat, newMat(mat.i), { clock: now });
    if (isOpen ? !isOpen(mat.i) : mat.i >= nOpen) continue;   // isOpen: the upper bays (council round 10 #3)
    mat.cust = nextId(ctx); mat.look = newLook(rng);
    if ((mud?.(mat.i) ?? 0) >= CUST.REFUSE_MUD) {
      mat.st = 'wait'; mat.t0 = now;
      ev.push({ t: 'wait', mat: mat.i, cust: mat.cust });
      continue;
    }
    seat(mat, now - CUST.SETUP, Math.max(1, Math.ceil(bucketFor(venue) * (0.35 + 0.65 * rng()))), ev, venue);
  }
  return ev;
}

// Advance one mat. ctx: { mud (this mat's fixture mud 0..1), venue, rng, open (mat is in use),
// now (monotonic seconds; if omitted it accumulates dt), gap (mean s per ball), nextCust }.
// Returns events: arrive, start, ballBudget, leave, refuse.
export function stepMat(mat, dt, ctx = {}) {
  const now = ctx.now ?? (mat.clock += dt);
  if (ctx.now != null) mat.clock = now;
  const { mud = 0, venue = 0, rng = Math.random } = ctx, open = ctx.open !== false, gap = ctx.gap ?? CUST.GAP;
  const ev = [];

  if (mat.st === 'playing') {
    if (mat.fin && now >= mat.fin) toLeave(mat, now, 'done', ev);
    else if (!open) toLeave(mat, now, 'closed', ev);
  } else if (mat.st === 'wait') {
    if (!open) toLeave(mat, now, 'closed', ev);
    else if (mud < CUST.WAIT_OK) seat(mat, now, bucketFor(venue), ev, venue);
    else if (now >= mat.t0 + CUST.WAIT_MAX) {
      mat.st = 'sulk'; mat.t0 = now; mat.balls = 0; mat.fin = 0;
      mat.noBefore = now + CUST.EMPTY_AFTER_REFUSE;
      ev.push({ t: 'refuse', mat: mat.i, cust: mat.cust, mud });
    }
  } else if (mat.st === 'sulk') {
    if (now >= mat.t0 + CUST.SULK) toLeave(mat, now, 'refused', ev);
  } else if (mat.st === 'leave' || mat.st === 'fell') {
    if (now >= mat.t0 + CUST.LEAVE_HOLD) { mat.st = 'empty'; mat.cust = 0; }
  }

  if (mat.inc && !open) { ev.push({ t: 'leave', mat: mat.i, cust: mat.inc.cust, why: 'closed' }); mat.inc = null; }

  const arr = arriveDur(mat.i);
  if (!mat.inc && open && canCall(mat, now, gap)) {
    const dest = ctx.mats ? pickMat(ctx.mats, mat.i, { ...ctx, now, gap }) : mat;
    if (dest) {
      dest.inc = { cust: nextId(ctx), look: newLook(rng), t0: now };
      ev.push({ t: 'arrive', mat: dest.i, cust: dest.inc.cust, look: dest.inc.look });
    }
  }

  // at the basket: take a bucket, or wait for one (owner playtest 3 §3.3)
  if (mat.inc && !mat.inc.got && ctx.takeBucket) {
    const tA = arriveRoute(mat.i).tA;
    if (now >= mat.inc.t0 + tA) {
      if (ctx.takeBucket()) { mat.inc.got = true; if (mat.inc.wb != null) { mat.inc.t0 = now - tA; mat.inc.wb = null; } }
      else {
        mat.inc.wb ??= now; mat.inc.t0 = now - tA;
        if (now >= mat.inc.wb + CUST.WAIT_MAX) {
          ev.push({ t: 'refuse', mat: mat.i, cust: mat.inc.cust, why: 'nobucket' }, { t: 'leave', mat: mat.i, cust: mat.inc.cust, why: 'nobucket' });
          mat.inc = null;
        }
      }
    }
  }

  // arrived: take the mat if it is free, else wait at the walkway
  if (mat.inc && now >= mat.inc.t0 + arr && (mat.st === 'empty' || mat.st === 'leave' || mat.st === 'fell') && now >= mat.noBefore) {
    mat.cust = mat.inc.cust; mat.look = mat.inc.look; mat.inc = null;
    if (mud >= CUST.REFUSE_MUD) {
      mat.st = 'wait'; mat.t0 = now; mat.balls = 0; mat.fin = 0;
      ev.push({ t: 'wait', mat: mat.i, cust: mat.cust });
    } else seat(mat, now, bucketFor(venue), ev, venue);
  }
  return ev;
}

// Is this mat free (or about to be) for a new customer? (§3.2: the arrival trigger and pickMat's candidates.)
function canCall(mat, now, gap) {
  const arr = arriveDur(mat.i);
  if (now + arr < mat.noBefore) return false;
  const free = mat.st === 'empty' || mat.st === 'leave' || mat.st === 'sulk' || mat.st === 'fell';
  return free || (mat.st === 'playing' && mat.balls * gap + CUST.FINISH <= arr + 1);
}

// Owner playtest 3 §3.2: an arriving customer picks among the free open mats (no incoming customer, free or about
// to be), weighted 1 − mud; a mat at REFUSE_MUD or over weighs 0. When no free mat is clean, a muddy trigger calls
// nobody while any open mat is clean (busy): the muddy bay just stays empty, which you can see from the return. Only
// when every open mat is that muddy do they head for it (and wait there, as before). Returns the mat, or null (nobody
// comes). One candidate: no RNG draw.
// mats: every mat; i: the triggering mat's index; ctx: { rng, now, gap, mudOf(i), isOpen(i) }.
export function pickMat(mats, i, ctx = {}) {
  const { rng = Math.random, now = 0, gap = CUST.GAP } = ctx;
  const mudOf = ctx.mudOf ?? (() => 0), isOpen = ctx.isOpen ?? (() => true);
  const self = mats.find(m => m.i === i) ?? mats[i];
  const cands = [];
  for (const m of mats) {
    if (m !== self && (m.inc || !isOpen(m.i) || !canCall(m, now, gap))) continue;
    const mud = mudOf(m.i), w = mud >= CUST.REFUSE_MUD ? 0 : 1 - mud;
    if (w > 0) cands.push([m, w]);
  }
  if (!cands.length) return mats.some(m => m !== self && isOpen(m.i) && mudOf(m.i) < CUST.REFUSE_MUD) ? null : self;
  if (cands.length === 1) return cands[0][0];
  let r = rng() * cands.reduce((a, c) => a + c[1], 0);
  for (const [m, w] of cands) if ((r -= w) < 0) return m;
  return cands.at(-1)[0];
}

// Council round 10 #3: the deck's drunkest fell off the rail. The customer is gone at once (no walk out: views/deck.js
// plays the fall), the bucket with them; nobody new takes the bay for `secs` (the replacement climbs the stairs).
export function fellOff(mat, now, secs = 20) {
  if (!mat) return [];
  const ev = [];
  if (mat.st === 'playing' || mat.st === 'wait' || mat.st === 'sulk') ev.push({ t: 'leave', mat: mat.i, cust: mat.cust, why: 'fell' });
  if (mat.st !== 'empty') { mat.st = 'fell'; mat.t0 = now; }
  mat.balls = 0; mat.fin = 0;
  mat.noBefore = Math.max(mat.noBefore, now + secs - arriveDur(mat.i));
  return ev;
}

// What goes in the snapshot for one mat.
export const matWire = mat => ({
  cust: mat.cust, st: mat.st, t0: +mat.t0.toFixed(2), look: mat.look, left: mat.balls,
  inc: mat.inc && { cust: mat.inc.cust, look: mat.inc.look, t0: +mat.inc.t0.toFixed(2), ...(mat.inc.wb != null ? { wb: 1 } : {}) },
});
