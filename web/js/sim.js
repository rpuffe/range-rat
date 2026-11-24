// The shared simulation: plain numbers, no THREE, no DOM. The server runs it
// as the one true copy of the range; browsers run the same ball physics so
// flights look smooth between server ticks (the server's word wins at rest).

export const SIM = {
  G: 9.81,
  BALL_R: 0.06,        // m, a touch big so it reads in first person
  STEP: 1 / 120,       // s, fixed physics step (same on server and client)
  ROLL_DECEL: 3.2,     // m/s² of rolling resistance on fairway
  POCKET: 3,           // balls a player can carry by hand
  REACH: 1.6,          // m, how close a ball must be to pick it up
  STAND: { x: 26, z: 6 },
  STAND_REACH: 3,
  BALL_PRICE: 1,       // $ per ball dropped in the bucket stand
  WALK: 4.2,           // m/s
  FIELD: { xMin: -150, xMax: 150, zMin: -290, zMax: 9 },
  MAX_PLAYERS: 6,
  MAX_BALLS: 800,      // when the field is this full, customers wait for a clean mat
  HELPER_WALK: 3.4,    // m/s, hired help is in no hurry
  SHIFT_SECS: 420,     // one day: opening to sunset
  KNOCK_SECS: 2.2,     // flat on your back after a ball hit
  HIT_R: 0.45,         // m, a player's body radius for ball hits
  HIT_H: 1.9,          // m, a player's height for ball hits
  HIT_MIN_SPEED: 5,    // m/s, slower balls just bump your shoes
};

// Ten mats along z = 0, everyone hitting toward -z.
export const MATS = Array.from({ length: 10 }, (_, i) => ({ i, x: -18 + i * 4 }));

// How many mats have a customer: more crew, more customers. Balanced for 4.
export const activeMats = players => Math.min(MATS.length, 4 + 2 * Math.max(1, players));

export function mulberry32(a) {
  return () => {
    a |= 0; a = a + 0x6d2b79f5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Seconds until a customer hits their next ball.
export const swingGap = rng => 4 + rng() * 8;

// A customer's shot from a mat: ~30–140 m carries, a bit of spray.
export function launch(mat, rng) {
  const speed = 16 + rng() * 22, loft = 0.25 + rng() * 0.35, aim = (rng() - 0.5) * 0.35;
  const h = speed * Math.cos(loft);
  return { x: mat.x, y: 0.1, z: -0.4, vx: Math.sin(aim) * h, vy: speed * Math.sin(loft), vz: -Math.cos(aim) * h };
}

// Balls knocked out of a player's hands: a little pop up and outward.
export function spill(x, z, n, rng) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, s = 1.5 + rng() * 2;
    out.push({ x, y: 1.0, z, vx: Math.cos(a) * s, vy: 2 + rng() * 1.5, vz: Math.sin(a) * s });
  }
  return out;
}

// One fixed physics step. Returns true on the step the ball comes to rest.
function stepOnce(b) {
  const dt = SIM.STEP, R = SIM.BALL_R;
  b.vy -= SIM.G * dt;
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  if (b.y < R) {
    b.y = R;
    if (b.vy < -1) { b.vy *= -0.35; b.vx *= 0.7; b.vz *= 0.7; }
    else {
      b.vy = 0;
      const s = Math.hypot(b.vx, b.vz), ns = Math.max(0, s - SIM.ROLL_DECEL * dt);
      if (ns === 0) { b.vx = 0; b.vz = 0; b.rest = true; return true; }
      b.vx *= ns / s; b.vz *= ns / s;
    }
  }
  return false;
}

// Advance a ball by dt seconds of fixed steps (the remainder carries over in
// b.acc). Returns true if it came to rest during this call.
export function advanceBall(b, dt) {
  if (b.rest) return false;
  b.acc = (b.acc ?? 0) + dt;
  while (b.acc >= SIM.STEP) {
    b.acc -= SIM.STEP;
    if (stepOnce(b)) { b.acc = 0; return true; }
  }
  return false;
}

// Did a ball moving from (x0, y0, z0) to its current spot pass through a
// standing player? Closest approach of the segment to the player's axis.
export function ballHitsPlayer(x0, y0, z0, b, p) {
  if (b.rest || p.down > 0) return false;
  if (Math.hypot(b.vx, b.vy, b.vz) < SIM.HIT_MIN_SPEED) return false;
  const dx = b.x - x0, dz = b.z - z0, len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((p.x - x0) * dx + (p.z - z0) * dz) / len2)) : 0;
  const cx = x0 + dx * t, cz = z0 + dz * t, cy = y0 + (b.y - y0) * t;
  return Math.hypot(cx - p.x, cz - p.z) < SIM.HIT_R && cy < SIM.HIT_H;
}

// ---- the upgrade shop ------------------------------------------------------
// Bought overnight (or before the first shift) from the crew's shared cash.
// Tier 0 of each item is what you start with; buying moves up one tier.

export const SHOP = [
  { id: 'gear', title: 'Carrying gear', tiers: [
    { name: 'Bare hands', desc: 'Your pockets. Holds 3.' },
    { name: 'Ball retriever tube', cost: 20, desc: 'Click, click, click. Holds 8 and reaches a bit further.' },
    { name: 'Range bucket', cost: 75, desc: 'Holds 25. You look like you work here.' },
    { name: 'Push picker', cost: 250, desc: 'Walk over balls and it scoops them up. Holds 60.' },
  ] },
  { id: 'helpers', title: 'Hired help', tiers: [
    { name: 'Nobody', desc: 'It is just the crew.' },
    { name: 'One teenager', cost: 60, desc: 'Picks up balls and banks them, with the crew\'s gear (up to a bucket). Paid in pizza.' },
    { name: 'Two teenagers', cost: 150, desc: 'They walk out together. They walk back together.' },
    { name: 'Three teenagers', cost: 400, desc: 'One of them brought a speaker.' },
    { name: 'Four teenagers', cost: 1000, desc: 'A union is forming.' },
  ] },
  { id: 'washer', title: 'Ball washer', tiers: [
    { name: 'Muddy balls', desc: 'A ball banks for $1.' },
    { name: 'Hand-crank washer', cost: 40, desc: 'Clean balls: $2 each.' },
    { name: 'Electric washer', cost: 160, desc: 'Sparkling balls: $3 each.' },
  ] },
  { id: 'ads', title: 'Advertising', tiers: [
    { name: 'Word of mouth', desc: 'Customers trickle in.' },
    { name: 'A sign by the road', cost: 30, desc: 'Customers hit 25% more balls.' },
    { name: 'Radio spot', cost: 90, desc: 'Customers hit 55% more balls.' },
    { name: 'A blimp', cost: 250, desc: 'Customers hit twice as many balls.' },
  ] },
  { id: 'shoes', title: 'Shoes', tiers: [
    { name: 'Range-issue loafers', desc: 'They squeak.' },
    { name: 'Sneakers', cost: 15, desc: 'Walk 15% faster.' },
    { name: 'Running shoes', cost: 45, desc: 'Walk 30% faster.' },
    { name: 'Carbon spikes', cost: 120, desc: 'Walk 45% faster.' },
  ] },
  { id: 'hardhat', title: 'Hard hats', tiers: [
    { name: 'No hats', desc: `A ball hit floors you for ${SIM.KNOCK_SECS} seconds.` },
    { name: 'Hard hats for everyone', cost: 35, desc: 'Back up in 1 second. Goes BONK.' },
  ] },
];
export const SHOP_BY_ID = Object.fromEntries(SHOP.map(i => [i.id, i]));
export const HELPER_NAMES = ['Kyle', 'Madison', 'Tanner', 'Brayden'];

// Prices scale with crew size (balanced for 4): ×1 solo, ×2.2 for four.
export const priceScale = crewSize => 1 + 0.4 * (Math.max(1, crewSize) - 1);
export function nextPrice(id, up, crewSize) {
  const item = SHOP_BY_ID[id], lvl = up?.[id] ?? 0;
  const t = item?.tiers[lvl + 1];
  return t ? Math.round(t.cost * priceScale(crewSize)) : null;   // null: maxed out
}

// What the crew's upgrades add up to.
export function perks(up = {}) {
  const g = up.gear ?? 0;
  return {
    pocket: [3, 8, 25, 60][g],
    reach: [SIM.REACH, 2.0, 2.0, 2.2][g],
    scoop: g >= 3 ? 1.1 : 0,                         // push picker: auto-pickup radius
    helpers: up.helpers ?? 0,
    price: SIM.BALL_PRICE + (up.washer ?? 0),
    swingGapMult: [1, 0.8, 0.645, 0.5][up.ads ?? 0],
    walk: SIM.WALK * (1 + 0.15 * (up.shoes ?? 0)),
    knockSecs: up.hardhat ? 1 : SIM.KNOCK_SECS,
  };
}

export const atStand = p =>Math.hypot(p.x - SIM.STAND.x, p.z - SIM.STAND.z) < SIM.STAND_REACH;

export function clampToField(p) {
  const F = SIM.FIELD;
  p.x = Math.max(F.xMin, Math.min(F.xMax, p.x));
  p.z = Math.max(F.zMin, Math.min(F.zMax, p.z));
}
