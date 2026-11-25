// The bucket basket (owner playtest 3 §3.3): pure rules, no THREE, no DOM. The server (crew.mjs) owns one
// { n, fill: { ratId: secs }, machT } and steps it; customers.js takes a bucket through ctx.takeBucket().
// It starts every morning empty ("the night crew doesn't do buckets") and holds BUCKETS.BASKET. A Rat at the
// dispenser's side (layout.js FILL_POINT) holds Use: a bucket fills in FILL_SECS and drops in. Two chutes, so two
// Rats fill at once; a third is refused. The Bucket machine (SHOP `bucket`) adds one every MACHINE_SECS.
import { BUCKETS } from './sim.js';
import { FILL_POINT } from './layout.js';

export const FILL_REACH = 1.4;   // m from FILL_POINT a Rat may fill from

export const newBasket = () => ({ n: 0, fill: {}, machT: 0 });
export const atFill = p => !!p && Math.hypot(p.x - FILL_POINT.x, p.z - FILL_POINT.z) <= FILL_REACH;

// A customer at the basket takes one. Returns true when there was one.
export function takeBucket(b) {
  if (b.n <= 0) return false;
  b.n--;
  return true;
}

// A Rat starts (on) or stops holding. Returns 'ok' | 'busy' (both chutes taken) | 'far' | 'full' | 'off'.
export function holdFill(b, id, on, p) {
  if (!on) { delete b.fill[id]; return 'off'; }
  if (id in b.fill) return 'ok';
  if (!atFill(p)) return 'far';
  if (b.n >= BUCKETS.BASKET) return 'full';
  if (Object.keys(b.fill).length >= BUCKETS.CHUTES) return 'busy';
  b.fill[id] = 0;
  return 'ok';
}

// Advance the fillers and the machine. where(id): that Rat's { x, z } or null (gone). Returns
// [{ t: 'bucket', by: ratId | 'machine', n }] for each bucket that dropped in.
export function stepBasket(b, dt, { where = () => null, machine = false } = {}) {
  const ev = [];
  for (const id of Object.keys(b.fill)) {
    if (b.n >= BUCKETS.BASKET || !atFill(where(id))) { delete b.fill[id]; continue; }   // full, or walked off
    if ((b.fill[id] += dt) >= BUCKETS.FILL_SECS - 1e-9) {
      b.fill[id] = 0; b.n++;
      ev.push({ t: 'bucket', by: id, n: b.n });
    }
  }
  if (machine && b.n < BUCKETS.BASKET) {
    if ((b.machT += dt) >= BUCKETS.MACHINE_SECS - 1e-9) { b.machT = 0; b.n++; ev.push({ t: 'bucket', by: 'machine', n: b.n }); }
  } else b.machT = 0;
  return ev;
}

// The silo's cosmetic fill (§3.3): "it never runs dry" (Fairway Holdings has 4 billion), but it dips a little for
// each bucket filled and rises with each bank.
export const siloFill = (banked, filled) => Math.max(0, 400 + (banked | 0) - BUCKETS.BALLS * (filled | 0));
