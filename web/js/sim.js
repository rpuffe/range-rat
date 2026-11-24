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
  SWING_COOLDOWN: 0.8, // s between a player's own swings at a crew bay
};

// The picker cart. One per crew, shared: whoever climbs in drives. Its cage
// keeps the driver safe, and a crew ball that hits the cage pays out (Hit the Cart).
export const CART = {
  PARK: { x: 31, z: 10, yaw: Math.PI / 2 },   // where it lives (and starts each morning)
  BOARD_REACH: 3,       // m, how close you must be to climb in
  REEL_AHEAD: 1.9,      // m, the gang reels' centre, ahead of the cart's middle
  REEL_DEPTH: 0.7,      // m, front to back of the reels
  CAGE_R: 1.3,          // m, how close a ball must pass to ring the cage
  CAGE_H: 2.3,          // m
  RUN_OVER_SPEED: 3,    // m/s, faster than this and people on foot go flying
  BOOST: 1.6,           // speed multiplier during a ping boost
  BOOST_SECS: 20,
  JACKPOT_R: 15,        // m, a jackpot hoovers every resting ball this close
  MAX_MULT: 3,
};

// Crew bays: two mats of the crew's own, either side of the customers.
// You hit the balls you're carrying, so swinging never makes money from nothing.
export const BAYS = [{ x: 23, z: 0 }, { x: -23, z: 0 }];
export const BAY_REACH = 1.4;
export const atBay = p => BAYS.some(b => Math.hypot(p.x - b.x, p.z - b.z) < BAY_REACH);

// A crew swing: aim with your view, power from how long you held the button.
export function swingLaunch(bay, yaw, pitch, power) {
  const speed = 12 + 43 * Math.max(0, Math.min(1, power));
  const loft = Math.max(0.03, Math.min(1.0, 0.12 + pitch));
  const h = speed * Math.cos(loft);
  return { x: bay.x, y: 0.1, z: bay.z - 0.4, vx: -Math.sin(yaw) * h, vy: speed * Math.sin(loft), vz: -Math.cos(yaw) * h };
}

// Is a resting ball under the cart's gang reels? (cart frame: forward is -z at yaw 0)
export function underReels(cart, b, width) {
  const fx = -Math.sin(cart.yaw), fz = -Math.cos(cart.yaw);      // forward
  const dx = b.x - cart.x, dz = b.z - cart.z;
  const ahead = dx * fx + dz * fz, side = dx * fz - dz * fx;
  return Math.abs(ahead - CART.REEL_AHEAD) <= CART.REEL_DEPTH / 2 + 0.15 && Math.abs(side) <= width / 2;
}

// Did a ball moving from (x0, y0, z0) to where it is now pass through the cage?
export function ballHitsCart(x0, y0, z0, b, cart) {
  if (b.rest) return false;
  const dx = b.x - x0, dz = b.z - z0, len2 = dx * dx + dz * dz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((cart.x - x0) * dx + (cart.z - z0) * dz) / len2)) : 0;
  const cx = x0 + dx * t, cz = z0 + dz * t, cy = y0 + (b.y - y0) * t;
  return Math.hypot(cx - cart.x, cz - cart.z) < CART.CAGE_R && cy < CART.CAGE_H && cy > 0.2;
}

// The cart's driving model, shared so the server can sanity-check the driver.
export function stepCart(c, throttle, steer, dt, vmax) {
  const accel = throttle > 0 ? 5 : throttle < 0 ? (c.v > 0.3 ? 12 : 3) : 0;
  c.v += throttle * accel * dt;
  if (!throttle) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 3.5 * dt);   // rolls to a stop
  c.v = Math.max(-3, Math.min(vmax, c.v));
  c.yaw -= steer * Math.max(-1, Math.min(1, c.v / 3)) * 1.25 * dt;
  c.x += -Math.sin(c.yaw) * c.v * dt;
  c.z += -Math.cos(c.yaw) * c.v * dt;
  const x = Math.max(SIM.FIELD.xMin, Math.min(SIM.FIELD.xMax, c.x)), z = Math.max(SIM.FIELD.zMin, Math.min(SIM.FIELD.zMax + 6, c.z));
  if (x !== c.x || z !== c.z) { c.x = x; c.z = z; c.v *= 0.3; }
}

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
  // Personal: each Range Rat buys their own (from the crew wallet), at the
  // catalog price, and keeps it under their name across sessions.
  { id: 'gear', title: 'Your carrying gear', personal: true, tiers: [
    { name: 'Bare hands', desc: 'Your pockets. Holds 3.' },
    { name: 'Ball retriever tube', cost: 20, desc: 'Click, click, click. Holds 8 and reaches a bit further.' },
    { name: 'Range bucket', cost: 75, desc: 'Holds 25. You look like you work here.' },
    { name: 'Push picker', cost: 250, desc: 'Walk over balls and it scoops them up. Holds 60.' },
  ] },
  { id: 'cart', title: 'Picker cart', tiers: [
    { name: 'No cart', desc: 'Everything on foot.' },
    { name: 'Caged picker cart', cost: 600, desc: 'Drive over balls to scoop them up. Holds 300, unloads itself at the stand, and the cage keeps the driver safe. Hit it from a crew bay for prizes.' },
    { name: 'Wide gang reels', cost: 1500, desc: 'Scoops a lane almost twice as wide, holds 600, a bit faster.' },
  ] },
  { id: 'helpers', title: 'Hired help', tiers: [
    { name: 'Nobody', desc: 'It is just the crew.' },
    { name: 'One teenager', cost: 60, desc: 'Picks up balls with a beat-up tube (8 at a time) and banks them. Paid in pizza.' },
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

// Crew upgrades scale with crew size (balanced for 4): ×1 solo, ×2.2 for four.
// Personal gear doesn't: everyone buys their own at the catalog price.
export const priceScale = crewSize => 1 + 0.4 * (Math.max(1, crewSize) - 1);
export function nextPrice(id, up, crewSize, gearLevel = 0) {
  const item = SHOP_BY_ID[id];
  if (!item) return null;
  const lvl = item.personal ? gearLevel : up?.[id] ?? 0;
  const t = item.tiers[lvl + 1];
  if (!t) return null;                                 // maxed out
  return item.personal ? t.cost : Math.round(t.cost * priceScale(crewSize));
}

// One Range Rat's own carrying gear.
export function gearPerks(level = 0) {
  return {
    pocket: [3, 8, 25, 60][level],
    reach: [SIM.REACH, 2.0, 2.0, 2.2][level],
    scoop: level >= 3 ? 1.1 : 0,                     // push picker: auto-pickup radius
  };
}
export const HELPER_POCKET = 8;

// What the crew's upgrades add up to.
export function perks(up = {}) {
  return {
    helpers: up.helpers ?? 0,
    price: SIM.BALL_PRICE + (up.washer ?? 0),
    swingGapMult: [1, 0.8, 0.645, 0.5][up.ads ?? 0],
    walk: SIM.WALK * (1 + 0.15 * (up.shoes ?? 0)),
    knockSecs: up.hardhat ? 1 : SIM.KNOCK_SECS,
    cart: up.cart ?? 0,
    cartCap: [0, 300, 600][up.cart ?? 0],
    cartReel: [0, 2.4, 4.2][up.cart ?? 0],
    cartSpeed: [0, 9, 11][up.cart ?? 0],
  };
}

// ---- ball value: Corporate pays per ball ------------------------------------
// The per-ball rate is the crew's KPI. Upgrades raise it; upkeep (a clean
// cart) keeps it up; Hit the Cart multiplies it for the day.

export const WASH = {
  STATION: { x: 36, z: 3 },   // the pressure washer, beside the cart's parking spot
  GRAB: 2.5,                  // m, how close to grab the wand
  HOSE: 10,                   // m of hose: wander further and you drop the wand
  RANGE: 7,                   // m, how far the spray reaches
  RATE: 0.08,                 // mud cleaned per second of spraying on target (stacks per sprayer)
  MUD_PER_M: 0.003,           // the cart's mud per metre driven (full after ~330 m)
};

export function ballValue({ perks: k, mult = 1, cart = null }) {
  const base = k.price;
  // Corporate inspects the fleet: a spotless cart earns a bonus, a filthy one a dock.
  const fleet = cart ? 1.25 - 0.55 * Math.max(0, Math.min(1, cart.mud ?? 0)) : 1;
  const value = Math.round(base * fleet * mult * 100) / 100;
  return { value, base, fleet, mult };
}
export const money = v => `$${Number.isInteger(v) ? v : v.toFixed(2)}`;

export const atStand = p =>Math.hypot(p.x - SIM.STAND.x, p.z - SIM.STAND.z) < SIM.STAND_REACH;

export function clampToField(p) {
  const F = SIM.FIELD;
  p.x = Math.max(F.xMin, Math.min(F.xMax, p.x));
  p.z = Math.max(F.zMin, Math.min(F.zMax, p.z));
}
