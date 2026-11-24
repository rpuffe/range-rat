// Range Rat: Scuba v2 shared rules (council round 3, section 4). Pure and DOM-free: the server
// (crew.mjs), the client (main.js / round2.js) and scuba.js all read the same numbers from here.
//
// DELIBERATELY no imports. sim.js is expected to import DIVE_ROW / POND_ROW from this file to
// append them to SHOP, so importing sim.js back would create a cycle (a TDZ crash when this file
// is loaded first). The few pond numbers needed are mirrored in PD_POND and pinned to sim.js's
// POND by test/scuba.test.mjs.

// The pond, as sim.js's POND defines it (mirrored; a test keeps them equal).
export const PD_POND = { x: -12, z: -78, r: 8, BOTTOM: -1.1, DOCK: { x: -12, z: -68.5 }, DOCK_R: 2.2 };

// ---- 4.1 The Deep End ------------------------------------------------------------------
// A 3 m-radius sinkhole at the far side of the pond. Its centre is 5.83 m from the pond's centre,
// so the far lip pokes about 0.8 m past the wall: the part of the hole that matters is the part
// inside the pond (the scuba.js bed clips it).
export const POND_DEEP = {
  x: -15, z: -83, r: 3,
  SHELF: -1.1,            // the pond bed everywhere else (= POND.BOTTOM)
  FLOOR: -4.5,            // the bottom of the hole
  FLOOR_R: 0.38,          // the flat floor is this fraction of r; the wall slopes up from there to r
  AIR_DRAIN: 2,           // air drains x2 down here (x1 with twin tanks or better)
  FOG_FACTOR: 0.5,        // "it's dark down there": the fog's far distance halves
  SPAWN_R: 0.6,           // treasure and sunk lead/gold settle within this fraction of r of the centre
  MARGIN: 0.8,            // ...and at least this far inside the pond wall
};

const clamp01 = x => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Horizontal distance from the Deep End's centre.
export const deepDist = (x, z) => Math.hypot(x - POND_DEEP.x, z - POND_DEEP.z);
// Is this spot over the hole (the whole 3 m lip counts)?
export const inDeepEnd = p => deepDist(p.x, p.z) < POND_DEEP.r;
// Is this spot properly down in it (past the first half of the slope)? Drives air drain and darkness.
export const inDeepCore = p => deepDist(p.x, p.z) < POND_DEEP.r * 0.8;
// 0 on the shelf, 1 on the floor: how deep into the hole a spot is.
export const deepness = (x, z) => 1 - smooth(POND_DEEP.r * POND_DEEP.FLOOR_R, POND_DEEP.r, deepDist(x, z));

// The bed's height at (x, z): the shelf, dropping to the floor through the Deep End. scuba.js builds
// its lathe from this, and crew.mjs can rest balls at this height.
export function bedAt(x, z) {
  return POND_DEEP.SHELF + (POND_DEEP.FLOOR - POND_DEEP.SHELF) * deepness(x, z);
}

// Where a diver's eyes sit: 0.75 m off the bed on the shelf, following the bed down (softened)
// so you actually sink into the Deep End.
export function eyeY(x, z) {
  return POND_DEEP.SHELF + 0.75 + (POND_DEEP.FLOOR - POND_DEEP.SHELF) * deepness(x, z) * 0.8;
}

// ---- seeded randomness -----------------------------------------------------------------
export const seeded = seed => () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---- 4.1 where sunk lead and gold go ---------------------------------------------------
// "They roll": lead and gold balls always end up in the Deep End.
export const sinksDeep = kind => kind === 'lead' || kind === 'gold';

// A resting spot inside the Deep End AND inside the pond wall. rng() is any 0..1 function
// (crew.rng). Always returns a spot (falls back to the hole's centre, which is inside the pond).
export function deepEndSpot(rng, pond = PD_POND, spread = POND_DEEP.SPAWN_R) {
  for (let i = 0; i < 24; i++) {
    const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * POND_DEEP.r * spread;
    const x = POND_DEEP.x + Math.cos(a) * d, z = POND_DEEP.z + Math.sin(a) * d;
    if (Math.hypot(x - pond.x, z - pond.z) < pond.r - POND_DEEP.MARGIN) return { x, z, y: bedAt(x, z) };
  }
  return { x: POND_DEEP.x, z: POND_DEEP.z, y: bedAt(POND_DEEP.x, POND_DEEP.z) };
}

// Where a sinking ball of this kind comes to rest. `landed` = {x, z} where it hit the water.
// Lead and gold roll into the Deep End; everything else stays where it fell.
export function sinkSpot(kind, landed, rng, pond = PD_POND) {
  if (sinksDeep(kind)) return deepEndSpot(rng, pond);
  return { x: landed.x, z: landed.z, y: bedAt(landed.x, landed.z) };
}

// ---- 4.2 The dive gear ladder ----------------------------------------------------------
// Personal, bought from the crew wallet, not price-scaled, kept by name (diveByName in the save).
// Tier 0 is free at the Club. Same shape as the other personal SHOP rows. NOTE nextPrice()
// reads a personal row's level from its `gearLevel` argument, so crew.mjs must pass p.dive for id 'dive'.
export const DIVE_ROW = {
  id: 'dive', title: 'Your dive gear', personal: true, minVenue: 1, tiers: [
    { name: 'Mask and snorkel', desc: '20 s of air, a bag of 10. The Deep End drains you twice as fast.' },
    { name: 'Scuba tank', cost: 1200, desc: '40 s of air, a bag of 15. A yellow tank. It has never been inspected.' },
    { name: 'Twin tanks and a dive light', cost: 5000, desc: '70 s of air, a bag of 25, and no extra drain in the Deep End. The light glints treasure at 8 m.' },
    { name: 'Dive scooter', cost: 40000, minVenue: 2, desc: 'Swim 1.3x faster, a bag of 40. Corporate calls it a "personal aquatic mobility asset".' },
  ],
};

// One diver's numbers by gear level (0..3).
//   air       seconds of air          swim   x walking speed underwater (was POND.SWIM)
//   bag       balls in the bag        deepDrain  air drain multiplier in the Deep End
//   light     0|1 dive light          glintR metres at which treasure glints
//   kit       what mates see you wearing: 'mask' | 'tank' | 'twin' | 'scooter'
const DIVE_TIERS = [
  { level: 0, name: 'Mask and snorkel', air: 20, swim: 0.6,  bag: 10, deepDrain: 2, light: 0, glintR: 6, kit: 'mask' },
  { level: 1, name: 'Scuba tank',       air: 40, swim: 0.7,  bag: 15, deepDrain: 2, light: 0, glintR: 6, kit: 'tank' },
  { level: 2, name: 'Twin tanks',       air: 70, swim: 0.75, bag: 25, deepDrain: 1, light: 1, glintR: 8, kit: 'twin' },
  { level: 3, name: 'Dive scooter',     air: 70, swim: 1.3,  bag: 40, deepDrain: 1, light: 1, glintR: 8, kit: 'scooter' },
];
export const MAX_DIVE_LEVEL = DIVE_TIERS.length - 1;
export const diveTiers = level => ({ ...DIVE_TIERS[Math.max(0, Math.min(MAX_DIVE_LEVEL, Math.floor(+level || 0)))] });

// ---- 4.3 Buddy Air v2: pump and haul ---------------------------------------------------
export const PUMP = {
  SECS_PER_TURN: 1.5,     // 1 crank turn = +1.5 s of air
  MAX_TPS: 2.5,           // turns per second cap (the washer crank cap)
  HOLD_PER_SEC: 0.5,      // holding the button without rotating: +0.5 s of air a second
  REACH: 0,               // (the pumper just has to be onDock)
};
export const HAUL = {
  HOLD_SECS: 1.5,         // hold the button this long on the dock to land a bag
  NIGHT_MULT: 0.5,        // a bag nobody hauled by the bell banks at half pay
};

// Seconds of air a pumper adds this step. `turns` = crank turns since the last step (the
// `{t:'pump', turns}` input; the server should accumulate the latest value as p.pumpTurns),
// `held` = the accessibility path (button held, no rotation). Turns are capped at 2.5/s.
export function pumpGain({ turns = 0, held = false, dt }) {
  const t = Math.max(0, Math.min(turns, PUMP.MAX_TPS * dt));
  if (t > 0) return t * PUMP.SECS_PER_TURN;
  return held ? PUMP.HOLD_PER_SEC * dt : 0;
}

// Is a diver breathing the Deep End's thin air at this spot? (x1 drain at tier.deepDrain === 1.)
export const drainMult = (tier, x, z) => (deepDist(x, z) < POND_DEEP.r * 0.8 ? tier.deepDrain : 1);

// One step of a diver's air. Returns { air, gasp }. `gain` is what pumpGain returned (seconds).
// Air never exceeds the tier's tank. gasp = true when it runs out.
export function airStep({ air, dt, tier, x, z, gain = 0 }) {
  const next = Math.min(tier.air, air - dt * drainMult(tier, x, z) + gain);
  return { air: Math.max(0, next), gasp: next <= 0 };
}

// The line: bags clipped on by the diver wait here until a buddy hauls them. A line is
// { n, w, kinds: [] } (balls, weight, kinds) and is pure data.
export const newLine = () => ({ n: 0, w: 0, kinds: [] });
// Can this diver clip their bag on? (diving, conscious, at least one ball)
export const canSend = p => !!p.diving && !(p.down > 0) && p.bag > 0;
// Move the diver's bag onto the line. Mutates both. Returns how many balls were sent ("Sent up: 12").
export function sendBag(p, line) {
  const n = p.bag;
  line.n += n; line.w += p.bagW ?? n; line.kinds.push(...(p.bagKinds ?? []));
  p.bag = 0; p.bagW = 0; p.bagKinds = [];
  return n;
}
// A hold on the dock lands the whole line. `held` is seconds the haul button has been held;
// returns true once it reaches HAUL.HOLD_SECS (then call takeLine).
export const haulReady = held => held >= HAUL.HOLD_SECS;
// Empty the line into a hauler's pocket (ignores capacity, like surfacing). Returns { n, w, kinds }.
export function takeLine(line) {
  const out = { n: line.n, w: line.w, kinds: line.kinds.slice() };
  line.n = 0; line.w = 0; line.kinds.length = 0;
  return out;
}
// At the bell with a loaded line: what the night crew banks. { n, w, mult } (pay x mult).
export function nightCrew(line) {
  return { n: line.n, w: line.w, mult: HAUL.NIGHT_MULT };
}

// ---- 4.5 The pond's automation ladder --------------------------------------------------
// A crew row (price-scaled like every crew row).
export const POND_ROW = {
  id: 'pond', title: 'Pond works', minVenue: 1, tiers: [
    { name: 'A bucket and hope', desc: 'The pond is cleared by hand. Corporate calls this "ownership".' },
    { name: 'Pneumatic ball tube', cost: 4000, desc: 'A red FHI box on the dock. Carry balls to it and they bank at the stand 6 s later with a THUNK. "Installed 1987. Works, mostly."' },
    { name: 'Pond pump', cost: 15000, desc: 'Clears one sunk ball every 8 s through the tube, all shift. Diving becomes the Deep End and the treasure.' },
  ],
};
export const pondTier = up => Math.max(0, Math.min(POND_ROW.tiers.length - 1, (up?.pond ?? 0) | 0));

export const TUBE = {
  BOX: { x: PD_POND.DOCK.x - 0.7, z: PD_POND.DOCK.z + 0.6 },   // the red box on the dock (mirror of the air pump)
  REACH: 2.0,
  DELAY: 6,               // seconds from feeding to the THUNK at the stand
  PUMP_EVERY: 8,          // the pond pump clears one sunk ball this often
  FROM_TIER: 1,           // pond row tier that installs the tube
  PUMP_TIER: 2,           // ...and the pump
};
export const atTube = p => Math.hypot(p.x - TUBE.BOX.x, p.z - TUBE.BOX.z) < TUBE.REACH;
export const hasTube = up => pondTier(up) >= TUBE.FROM_TIER;
export const hasPondPump = up => pondTier(up) >= TUBE.PUMP_TIER;

// The tube queue: entries { due, n, w, kinds, factor } where `factor` is the gear factor you had
// when you fed it. All pure; `now` is any monotonically increasing seconds clock.
export const newTube = () => ({ q: [], pumpAcc: 0 });
export function tubeFeed(tube, now, { n, w, kinds = [], factor = 1 }) {
  if (n > 0) tube.q.push({ due: now + TUBE.DELAY, n, w: w ?? n, kinds, factor });
}
// Entries that have arrived by `now` (removed from the queue; bank each at the stand).
export function tubeArrivals(tube, now) {
  const out = [];
  while (tube.q.length && tube.q[0].due <= now) out.push(tube.q.shift());
  return out;
}
export const tubeInFlight = tube => tube.q.reduce((s, e) => s + e.n, 0);
// The pond pump: returns how many sunk balls to clear this step (0 or 1 or more after a long dt).
export function pondPumpStep(tube, dt) {
  tube.pumpAcc += dt;
  let n = 0;
  while (tube.pumpAcc >= TUBE.PUMP_EVERY - 1e-9) { tube.pumpAcc -= TUBE.PUMP_EVERY; n++; }
  return n;
}

// ---- 4.4 Treasure and the Lost & Found case --------------------------------------------
// 12 treasures, in the order they surface. `mesh` is the scuba.js model key. `minVenue` 4 =
// County and up (the scorecard foreshadows Ball No. 1); 2 is Tiered, 3 Stadium. `blurb` is the memo card's Corporate
// voice; `fee` is the finder's fee in ball values (200 x BV: about $2,000 at the Club).
export const TREASURE = [
  { id: 'keys',      mesh: 'keys',      name: 'Car keys',                         minVenue: 1, fee: 200, blurb: 'A 1994 Buick. Still unlocked.' },
  { id: 'trophy',    mesh: 'trophy',    name: 'The 1987 Club Champion trophy',    minVenue: 1, fee: 200, blurb: 'Engraved: GARY. Corporate has no comment.' },
  { id: 'shades',    mesh: 'shades',    name: 'Sunglasses',                       minVenue: 1, fee: 200, blurb: "Gary's. He has other pairs. He has many pairs." },
  { id: 'duck',      mesh: 'duck',      name: 'A rubber duck in a necktie',       minVenue: 1, fee: 200, blurb: 'Middle management.' },
  { id: 'boot',      mesh: 'boot',      name: 'One boot',                         minVenue: 1, fee: 200, blurb: 'Size 13, left. The right is still out there.' },
  { id: 'club',      mesh: 'club',      name: 'A golf club',                      minVenue: 1, fee: 200, blurb: 'Thrown in anger, 1991. The anger remains.' },
  { id: 'cone',      mesh: 'cone',      name: 'A traffic cone',                   minVenue: 1, fee: 200, blurb: 'Nobody knows. Corporate has stopped asking.' },
  { id: 'tyre',      mesh: 'tyre',      name: 'A tyre',                           minVenue: 1, fee: 200, blurb: 'From a cart that is no longer with us.' },
  { id: 'pin',       mesh: 'pin',       name: 'A Dimples lapel pin',              minVenue: 1, fee: 200, blurb: 'One eye scratched out. Dimples has forgiven you.' },
  { id: 'memo',      mesh: 'memo',      name: 'A waterlogged memo',               minVenue: 1, fee: 200, blurb: 'Stamped URGENT. Unreadable. Corporate confirms it was important.' },
  { id: 'vhs',       mesh: 'vhs',       name: 'A VHS tape',                       minVenue: 1, fee: 200, blurb: 'Ball Retrieval Training (1979). You are already doing it wrong.' },
  { id: 'scorecard', mesh: 'scorecard', name: 'The 1958 scorecard',               minVenue: 4, fee: 200, blurb: 'Hole 1: LOST BALL. Signed by the founder.' },
];
export const TREASURE_BY_ID = Object.fromEntries(TREASURE.map(t => [t.id, t]));
export const TREASURE_IDS = TREASURE.map(t => t.id);
export const TREASURE_CHANCE = 0.5;     // each morning, at most one a shift
export const PA_FIRST_TREASURE = 'An item has been recovered from the pond. Corporate will be keeping it in a glass case. Corporate keeps everything in a glass case.';

// Drop junk ids that don't exist and duplicates (for loading a save).
export const cleanLostFound = a => [...new Set(Array.isArray(a) ? a : [])].filter(id => Object.hasOwn(TREASURE_BY_ID, id));

// The next treasure to surface: the next unfound item in order, skipping ones this venue can't
// have yet (so the scorecard is always last, and only from the County on). null if none left.
export function nextTreasure(lostFound, venue) {
  const have = new Set(lostFound ?? []);
  return TREASURE.find(t => !have.has(t.id) && venue >= t.minVenue) ?? null;
}
// The morning roll: given the rng and the case, which treasure (if any) sinks today?
// Returns a TREASURE entry or null. Call once at shift start, only if none is already down there.
export function rollTreasure(lostFound, venue, rng) {
  if (venue < 1) return null;
  const t = nextTreasure(lostFound, venue);
  if (!t) return null;
  return rng() < TREASURE_CHANCE ? t : null;
}
// Where a treasure lies: deterministic from (seed, id), always inside the Deep End and the pond.
// crew.mjs would normally pass the crew's seed (any integer) so every client agrees.
export function treasureSpot(seed, id, pond = PD_POND) {
  let h = (seed | 0) ^ 0x9E3779B9;
  for (let i = 0; i < String(id).length; i++) h = Math.imul(h ^ String(id).charCodeAt(i), 0x01000193);
  return deepEndSpot(seeded(h), pond, 0.5);
}
// What a treasure is worth when banked: 200 x BV (the Corporate "gesture").
export const finderFee = (id, bv) => Math.round((TREASURE_BY_ID[id]?.fee ?? 200) * bv);
// "Lost & Found 4 / 12"
export const lostFoundLine = lostFound => `Lost & Found ${cleanLostFound(lostFound).length} / ${TREASURE.length}`;
// How far you can see the glint: 6 m, 8 m with the dive light.
export const glintRange = tier => tier.glintR;
export const canSeeGlint = (tier, dist) => dist <= tier.glintR;

// ---- 4.6 Water clarity -----------------------------------------------------------------
// Clear teal at clarity 1, murky brown-green at 0. Returns {surface, fog} as 0xRRGGBB ints plus
// the fog far distance (halved in the Deep End if x,z are given).
const lerp = (a, b, t) => a + (b - a) * t;
const lerpHex = (a, b, t) => {
  const r = Math.round(lerp(a >> 16 & 255, b >> 16 & 255, t)), g = Math.round(lerp(a >> 8 & 255, b >> 8 & 255, t)), bl = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | bl;
};
export const WATER = {
  SURFACE_CLEAR: 0x2fa6a0, SURFACE_MURKY: 0x5b5a2c,
  FOG_CLEAR: 0x1f6a5e,     FOG_MURKY: 0x3b3a1c,
};
export function waterLook(clarity, x, z) {
  const c = clamp01(clarity ?? 1);
  const dn = x === undefined ? 0 : deepness(x, z);
  return {
    surface: lerpHex(WATER.SURFACE_MURKY, WATER.SURFACE_CLEAR, c),
    fog: lerpHex(WATER.FOG_MURKY, WATER.FOG_CLEAR, c),
    far: (6 + 8 * c) * (1 - (1 - POND_DEEP.FOG_FACTOR) * dn),
    near: 0.5,
  };
}
