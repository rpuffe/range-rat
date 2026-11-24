// MOW-E, the Club's autonomous mower (council round 3, 3.5). Pure shared rules, no DOM.
// Gary's pattern: a scheduled mover with a telegraph. The twist: it helps (it rakes a lane
// of balls into a windrow) and it flattens anyone standing in the lane.
//
// State (plain JSON, safe to snapshot as-is except `hit`, use mowerSnap()):
//   { phase: 'warn'|'drive'|'done', t, lane, x, z, yaw, blocked, hit: [ids], raked: n }
// Space: the mower crosses +x at z = lane. Windrow goes to lane + RAKE_OFFSET (toward the mats).

export const MOWER = {
  FROM_VENUE: 1,            // the Range Club
  FROM_DAY: 2,              // day 2 at the venue (venueDay)
  AT: 0.25,                 // of the shift
  WARN_SECS: 12,
  SPEED: 4,                 // m/s
  LANES: [-24, -36, -120, -156, -166, -178],   // clear Dimples Rock (>= 3.8 m), the tractor and the Tiered bowls
  LANE_NAMES: ['the Short Grass', 'Short of Red', 'the Tractor', 'the Rock', 'the Long Grass', 'the Back Net'],   // after the landmarks, so a crew can call it
  RAKE_OFFSET: 2.4,         // windrow lands at lane + this, keeping x
  RAKE_HALF: 2,             // balls within +-2 m of the lane get raked
  JITTER: 0.3,              // +- m on the windrow's z
  KNOCK_R: 1.3,             // Rats and helpers this close are knocked flat
  CART_STOP: 3,             // stop and honk while the cart is within this of the mower
  SHED: { x: -58, z: 4 },
  X0: -64, X1: 64,
};
export const MOWER_DRIVE_SECS = (MOWER.X1 - MOWER.X0) / MOWER.SPEED;   // 32

const rake = b => b && !b.sunk && !b.drift && !b.drifting && !b.treasure && b.kind !== 'one' && b.kind !== 'treasure';
const balls_ = balls => (balls instanceof Map ? [...balls.values()] : balls ? [...balls] : []);

// Should MOW-E start now? venueDay is 1-based days spent at this venue. Once a shift.
export function mowerDue({ venue, venueDay, shiftT, shiftSecs, mower, endless = false }) {
  return !mower && !endless && venue >= MOWER.FROM_VENUE && venueDay >= MOWER.FROM_DAY && shiftT >= shiftSecs * MOWER.AT;
}

// The lane is the candidate with the most resting, rakeable balls within +-RAKE_HALF.
// Ties (including all-zero) go to rng. rng: () => [0,1).
export function pickLane(balls, rng = Math.random) {
  const bs = balls_(balls).filter(b => b.rest && rake(b));
  let best = [], most = -1;
  for (const z of MOWER.LANES) {
    const n = bs.reduce((s, b) => s + (Math.abs(b.z - z) <= MOWER.RAKE_HALF ? 1 : 0), 0);
    if (n > most) { most = n; best = [z]; } else if (n === most) best.push(z);
  }
  return best[Math.min(best.length - 1, Math.floor(rng() * best.length))];
}

export function newMower(balls, rng = Math.random) {
  const lane = pickLane(balls, rng);
  return { phase: 'warn', t: MOWER.WARN_SECS, lane, x: MOWER.SHED.x, z: MOWER.SHED.z, yaw: -Math.PI / 2, blocked: false, hit: [], raked: 0 };
}

// Where is it? With no t: the state's own position (warn: rolling out of the shed to the
// lane's start over the warning; drive/done: the integrated x). With t (seconds since the drive
// began): the ideal unobstructed position, handy for tests and client smoothing.
export function mowerPos(s, t) {
  if (t != null) {
    const d = Math.max(0, Math.min(1, t / MOWER_DRIVE_SECS));
    return { x: MOWER.X0 + (MOWER.X1 - MOWER.X0) * d, z: s.lane };
  }
  if (s.phase === 'warn') {
    const k = 1 - Math.max(0, s.t) / MOWER.WARN_SECS;
    return { x: MOWER.SHED.x + (MOWER.X0 - MOWER.SHED.x) * k, z: MOWER.SHED.z + (s.lane - MOWER.SHED.z) * k };
  }
  return { x: s.x, z: s.z };
}

// Advance one tick. Mutates the mower state only; the caller applies the results:
//   raked:   [{id, x, z}] balls to move (set rest, zero velocity); emit {t:'rake', ids, z: lane+RAKE_OFFSET}
//   knocked: [ids] -> knockDown(p, 'mower'), stats.runOver++
//   honk:    true on the tick a cart first blocks it -> events.push({t:'honk'})
//   phaseChange: 'drive' | 'done' | null (events.push({t:'mower', phase}))
// players: iterable of {id, x, z, down?, driving?} (Rats and helpers). carts: [{x, z}] (the fleet: any of them
// blocks it), or the legacy cart: {x, z} or null.
export function stepMower(s, dt, { balls, players, cart, carts = cart ? [cart] : [], rng = Math.random } = {}) {
  const out = { raked: [], knocked: [], honk: false, phaseChange: null };
  if (!s || s.phase === 'done') return out;
  if (s.phase === 'warn') {
    s.t -= dt;
    const p = mowerPos(s); s.x = p.x; s.z = p.z;
    if (s.t <= 0) { s.phase = 'drive'; s.t = 0; s.x = MOWER.X0; s.z = s.lane; s.yaw = -Math.PI / 2; out.phaseChange = 'drive'; }
    return out;
  }
  // drive
  s.t += dt;
  const was = s.blocked;
  s.blocked = carts.some(c => c && Math.hypot(c.x - s.x, c.z - s.z) < MOWER.CART_STOP && c.x >= s.x - 0.5);
  if (s.blocked) { if (!was) out.honk = true; return out; }
  s.x = Math.min(MOWER.X1, s.x + MOWER.SPEED * dt);
  const rz = s.lane + MOWER.RAKE_OFFSET;
  for (const b of balls_(balls)) {
    if (!b.rest || !rake(b)) continue;
    if (Math.abs(b.z - s.lane) > MOWER.RAKE_HALF) continue;
    if (b.x > s.x) continue;       // not reached yet
    out.raked.push({ id: b.id, x: b.x, z: rz + (rng() - 0.5) * 2 * MOWER.JITTER });
  }
  s.raked += out.raked.length;
  for (const p of players || []) {
    if (!p || p.down > 0 || p.driving || s.hit.includes(p.id)) continue;
    if (Math.hypot(p.x - s.x, p.z - s.z) < MOWER.KNOCK_R) { s.hit.push(p.id); out.knocked.push(p.id); }
  }
  if (s.x >= MOWER.X1) { s.phase = 'done'; out.phaseChange = 'done'; }
  return out;
}

// What the clients see.
export const mowerSnap = s => s ? { phase: s.phase, t: s.t, lane: s.lane, x: s.x, z: s.z, yaw: s.yaw, blocked: s.blocked } : null;
// The lane's landmark name, "the Tractor"; falls back to the coordinate for a lane that is not in LANES.
export const laneName = lane => { const i = MOWER.LANES.indexOf(lane); return i >= 0 ? MOWER.LANE_NAMES[i] : `z ${lane}`; };
export const mowerBoard = s => s && s.phase === 'warn' ? `MOW-E · BY ${laneName(s.lane).toUpperCase()} · 0:${String(Math.max(0, Math.ceil(s.t))).padStart(2, '0')}` : null;
