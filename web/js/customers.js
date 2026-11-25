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

import { MATS } from './sim.js';
import { BASKET_POINT } from './layout.js';

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
const matX = mat => MATS[typeof mat === 'object' ? mat.i ?? mat.mat : mat].x;

// Gate -> the basket, then basket -> mat. Returns the two legs and their timings.
export function arriveRoute(mat, dx = CUST.PLAY_DX) {
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
  const sx = matX(mat) - dx;
  const P = basket ? [[STAND_POINT.x, STAND_POINT.z], [18, 5.5], [-3, 5.5], [GATE.x, GATE.z], [EXIT_POINT.x, EXIT_POINT.z]]
    : [[sx, PLAY_Z], [sx, APPROACH_Z], [-3, 5.5], [GATE.x, GATE.z], [EXIT_POINT.x, EXIT_POINT.z]];
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
  if (c.st === 'playing') return at(sx, PLAY_Z, { act: u < CUST.SETUP ? 'set' : 'play', carry: true });
  if (c.st === 'wait') return at(sx, APPROACH_Z, { act: 'wait', carry: true });
  if (c.st === 'sulk') return at(sx, APPROACH_Z, { act: 'sulk', carry: true });
  if (c.st === 'leave') {
    const r = leaveRoute(c.mat, dx, !!c.basket), d = Math.min(u * CUST.WALK, r.dur * CUST.WALK);
    const p = polyAt(r.P, d), done = u >= r.dur;
    return at(p.x, p.z, { yaw: heading(p.hx, p.hz), speed: done ? 0 : CUST.WALK, act: 'walk', carry: !c.basket, done });
  }
  return at(sx, APPROACH_Z);
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
export function openShift(mats, { now = 0, rng = Math.random, venue = 0, nOpen = mats.length, nextCust, mud } = {}) {
  const ev = [], ctx = { nextCust };
  for (const mat of mats) {
    Object.assign(mat, newMat(mat.i), { clock: now });
    if (mat.i >= nOpen) continue;
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
  } else if (mat.st === 'leave') {
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
  if (mat.inc && now >= mat.inc.t0 + arr && (mat.st === 'empty' || mat.st === 'leave') && now >= mat.noBefore) {
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
  const free = mat.st === 'empty' || mat.st === 'leave' || mat.st === 'sulk';
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

// What goes in the snapshot for one mat.
export const matWire = mat => ({
  cust: mat.cust, st: mat.st, t0: +mat.t0.toFixed(2), look: mat.look, left: mat.balls,
  inc: mat.inc && { cust: mat.inc.cust, look: mat.inc.look, t0: +mat.inc.t0.toFixed(2), ...(mat.inc.wb != null ? { wb: 1 } : {}) },
});
