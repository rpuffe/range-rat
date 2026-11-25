// Autopilot (council round 10 §D, #8): the Stadium's cart row tier 4. An undriven cart drives itself: it laps the Ping
// Track (its laps count at half: +0.03 crowd), or, held Ⓨ at it, it harvests: it sweeps to the nearest balls and
// scoops like a driver at ×0.6, then tips them at the ball return (never a field return: the cart's trips still pass
// the crew bays). It stops for anyone on foot near its nose, so you can always climb in or hold Ⓨ at it.
// Pure: no THREE, no DOM, no sim.js (CART numbers are passed in). server/venues/stadium.mjs steps it; test/autopilot.test.mjs.
import { MAP, onTrack, cartBlocked } from './map.js';

export const AUTO = {
  SPEED: 0.6,         // × the cart's speed (and × the Track's 1.3 on it): "like a driver at ×0.6"
  LAP_LEAD: 7,        // m: it steers at a point this far ahead on the Track's centreline
  STOP_R: 3.2,        // m: someone on foot this close (ahead or beside) and it waits
  HOLD_SECS: 0.6,     // hold Ⓨ this long at a cart to switch lap <-> harvest (a tap still climbs in)
  SKIP_SECS: 12,      // a ball it can't drive to (the creek, the pond) is skipped this long
  LAP_CROWD: 0.03,    // an autopilot lap: half credit
  MODES: ['lap', 'harvest'],
};

const T = MAP.TRACK;
export const trackPoint = th => ({ x: T.x + T.a * Math.cos(th), z: T.z + T.b * Math.sin(th) });
export const trackTh = (x, z) => Math.atan2((z - T.z) / T.b, (x - T.x) / T.a);
// The steering point: on the Track, LAP_LEAD m on round the oval (th increasing); off it, the nearest centreline point.
export function lapGoal(x, z) {
  const th = trackTh(x, z);
  if (!onTrack(x, z, 0.5)) return trackPoint(th);
  const r = Math.hypot(T.a * Math.sin(th), T.b * Math.cos(th)) || 1;   // |dP/dth|
  return trackPoint(th + AUTO.LAP_LEAD / r);
}

// Is the straight drive from (x0, z0) to (x1, z1) clear for a cart (half-metre steps)?
export function clearDrive(x0, z0, x1, z1, world) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5));
  for (let i = 1; i <= n; i++) if (cartBlocked(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, world)) return false;
  return true;
}

// Who it goes for when harvesting: the nearest resting ball it can drive straight to (not Ball No. 1, sunk, in the
// creek, aloft or square: squares jam the reels). skip: Map id -> until (seconds).
export function harvestTarget(c, balls, { world, t = 0, skip = new Map() } = {}) {
  let best = null, bd = Infinity;
  for (const b of balls) {
    if (!b.rest || b.sunk || b.creek || b.drifting || b.kind === 'one' || b.kind === 'square' || b.y > 0.4) continue;
    if ((skip.get(b.id) ?? -1) > t) continue;
    const d = Math.hypot(b.x - c.x, b.z - c.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}

// Someone on foot near the nose: wait for them.
export const blockedBy = (c, people) => people.some(o => Math.hypot(o.x - c.x, o.z - c.z) < AUTO.STOP_R);

// Drive c ({ x, z, yaw }) toward goal at speed for dt (cart frame: forward is (-sin yaw, -cos yaw)). Turns at once (a
// cart's 10 Hz pose reads smooth through the view's easing). Returns { moved, there, stuck }.
export function driveToward(c, goal, speed, dt, world) {
  const dx = goal.x - c.x, dz = goal.z - c.z, d = Math.hypot(dx, dz);
  if (d < 0.3) return { moved: 0, there: true, stuck: false };
  c.yaw = Math.atan2(-dx, -dz);
  const step = Math.min(d, speed * dt), nx = c.x + dx / d * step, nz = c.z + dz / d * step;
  if (cartBlocked(nx, nz, world)) return { moved: 0, there: false, stuck: true };
  c.x = nx; c.z = nz;
  return { moved: step, there: d - step < 0.3, stuck: false };
}

// One step of an autopilot cart. c: { x, z, yaw, load, tipT } (the crew's cart). a: its autopilot state (newAuto()). ctx: { dt, t, world,
// speed (the cart's own m/s), mul(x, z) (the Track's ×1.3), cap, balls (iterable), people (on foot), stand, reach
// (the unload reach), underReels(c, b) }. Returns { moved, scooped: [balls] } (the caller deletes and banks them).
export const newAuto = (mode = 'lap') => ({ mode, target: null, skip: new Map() });
export function stepAutopilot(c, a, ctx) {
  const out = { moved: 0, scooped: [] };
  if (c.tipT > 0 || blockedBy(c, ctx.people ?? [])) return out;
  const v = ctx.speed * AUTO.SPEED * (ctx.mul?.(c.x, c.z) ?? 1);
  const home = ctx.stand && c.load > 0 && (c.load >= ctx.cap || a.mode === 'lap');   // full (or back to lapping): tip it first
  if (home) {
    if (Math.hypot(c.x - ctx.stand.x, c.z - ctx.stand.z) < ctx.reach) return out;       // the return tips it (crew.mjs)
    out.moved = driveToward(c, ctx.stand, v, ctx.dt, ctx.world).moved;
    return out;
  }
  if (a.mode === 'lap') {
    out.moved = driveToward(c, lapGoal(c.x, c.z), v, ctx.dt, ctx.world).moved;
    return out;
  }
  // Harvest: to the nearest ball it can reach; scoop whatever passes under the reels on the way.
  const balls = Array.isArray(ctx.balls) ? ctx.balls : [...ctx.balls];   // (an iterator is read once)
  let b = a.target != null ? balls.find(o => o.id === a.target) : null;
  if (!b || !b.rest) {
    a.target = null;
    for (let tries = 0; tries < 4 && !a.target; tries++) {
      b = harvestTarget(c, balls, { world: ctx.world, t: ctx.t, skip: a.skip });
      if (!b) break;
      if (clearDrive(c.x, c.z, b.x, b.z, ctx.world)) a.target = b.id;
      else { a.skip.set(b.id, ctx.t + AUTO.SKIP_SECS); b = null; }
    }
  }
  if (b) {
    const r = driveToward(c, b, v, ctx.dt, ctx.world);
    out.moved = r.moved;
    if (r.stuck) { a.skip.set(b.id, ctx.t + AUTO.SKIP_SECS); a.target = null; }
  } else if (c.load > 0 && ctx.stand) out.moved = driveToward(c, ctx.stand, v, ctx.dt, ctx.world).moved;   // nothing left: tip it
  let load = c.load;
  for (const o of balls) {
    if (load >= ctx.cap) break;
    if (!o.rest || o.sunk || o.creek || o.drifting || o.kind === 'one' || o.kind === 'square' || o.y > 0.4) continue;
    if (ctx.underReels(c, o) || (a.target === o.id && Math.hypot(o.x - c.x, o.z - c.z) < 2.2)) { out.scooped.push(o); load += o.kind === 'splitter' ? 3 : 1; }
  }
  if (out.scooped.some(o => o.id === a.target)) a.target = null;
  return out;
}

// The next mode when someone holds Ⓨ at it.
export const nextMode = mode => (mode === 'harvest' ? 'lap' : 'harvest');
