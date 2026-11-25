// The shared simulation: plain numbers, no THREE, no DOM. The server runs it
// as the one true copy of the range; browsers run the same ball physics so
// flights look smooth between server ticks (the server's word wins at rest).
// The map (Dimple Creek: the creek, its crossings, the nets, the landmarks)
// lives in map.js; world-dependent physics takes `world` ({venue}) as an argument.
import { groundContact, ballFeatures, startDrift, cartBlocked, keepInField, fieldFor } from './map.js';
import { DIVE_ROW, POND_ROW } from './dive.js';
export { CREEK_DIVE } from './dive.js';   // council round 10 #5: the creek dive's numbers live with the pond's
// Venue shop rows (council round 4, wave C): each venue build uncomments ITS OWN import here and its row in
// SHOP below, nothing else. The row's file must import nothing from sim.js (see dive.js: a cycle is a TDZ crash).
import { GUTTERS_ROW } from './tiered.js';
//
import { DRONES_ROW } from './county.js';
//
import { TETHER_ROW } from './orbit.js';
import { OWNER_ROW } from './owner.js';
import { clubOpen, clubDayLabel } from './clubdays.js';   // round 11 (builder "feel"): stagger the Club, one idea a day   // endless (round 7 #9): the Owner's projects
import { BUILD_ROW, WING_X, builtMats, builtUpper } from './bays.js';   // round 11 (owner): Build more bays

export const SIM = {
  G: 9.81,
  BALL_R: 0.06,        // m, a touch big so it reads in first person
  STEP: 1 / 120,       // s, fixed physics step (same on server and client)
  ROLL_DECEL: 3.2,     // m/s² of rolling resistance on fairway
  POCKET: 3,           // balls a player can carry by hand
  REACH: 1.6,          // m, how close a ball must be to pick it up
  // The ball return (owner layout, 2026-11-24): the drop-off bin by the mat line, where Rats, teenagers, drones
  // and the cart bank. Its pipe carries the balls (through the washer, once bought) to the bank: the Board and
  // its silo at BANK. The code keeps the old name: STAND, atStand and the 'stand' fixture are the return now.
  STAND: { x: 27, z: 1.8 },
  SPAWN: { x: 23, z: 2 },   // where Rats clock in (the old stand's -3, -4: the layout moved the bank, not the crew)
  STAND_REACH: 3.5,   // 3 m read as "go to the stand" while touching it (playtest)
  BALL_PRICE: 1,       // $ per ball dropped in the bucket stand
  CLEAN_KIT: 1.25,     // owner playtest 3 §1.4: the clean-kit 25% is in the price (a clean carrier gets the Board's number)
  WALK: 4.2,           // m/s
  FIELD: { xMin: -64, xMax: 64, zMin: -189, zMax: 9 },   // Dimple Creek's netted field (map.js MAP.FIELD)
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

// The picker cart. Shared by the crew: whoever climbs in drives. Its cage
// keeps the driver safe, and a crew ball that hits the cage pays out (Hit the Cart).
// From the Stadium the row's tier 3 parks a second one beside it (the fleet, council round 4).
export const CART = {
  PARK: { x: 31, z: 10, yaw: Math.PI / 2 },   // where it lives (and starts each morning)
  PARK2: { x: 35, z: 10, yaw: Math.PI / 2 },  // the second cart's spot (the fleet)
  BOARD_REACH: 3,       // m, how close you must be to climb in
  REEL_AHEAD: 1.9,      // m, the gang reels' centre, ahead of the cart's middle
  REEL_DEPTH: 0.7,      // m, front to back of the reels
  CAGE_R: 1.3,          // m, how close a ball must pass to ring the cage
  CAGE_H: 2.3,          // m
  RUN_OVER_SPEED: 3,    // m/s, faster than this and people on foot go flying
  BOOST: 1.6,           // speed multiplier during a ping boost
  BOOST_SECS: 20,
  JACKPOT_R: 15,        // m, a jackpot hoovers every resting ball this close (until the hopper is full)
  UNLOAD_SECS: 1.5,     // owner playtest 3 §5.3: the hopper tips over 1.5 s at the return; the bank lands at the end
  MAX_MULT: 2,          // Hustle: +MULT_STEP a ping, capped (council round 1: pings mustn't outearn chores)
  MULT_STEP: 0.25,
};

// Crew bays: two mats of the crew's own, either side of the customers.
// You hit the balls you're carrying, so swinging never makes money from nothing.
export const BAYS = [{ x: 23, z: 0 }, { x: -23, z: 0 }];
export const BAY_REACH = 1.4;
export const atBay = p => BAYS.some(b => Math.hypot(p.x - b.x, p.z - b.z) < BAY_REACH);

// A crew swing: aim with your view, power from how long you held the button.
export function swingLaunch(bay, yaw, pitch, power) {
  const speed = 12 + 43 * Math.max(0, Math.min(1.15, power));
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
export function stepCart(c, throttle, steer, dt, vmax, world) {
  const ox = c.x, oz = c.z;
  const accel = throttle > 0 ? 5 : throttle < 0 ? (c.v > 0.3 ? 12 : 3) : 0;
  c.v += throttle * accel * dt;
  if (!throttle) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 3.5 * dt);   // rolls to a stop
  c.v = Math.max(-3, Math.min(vmax, c.v));
  c.yaw -= steer * Math.max(-1, Math.min(1, c.v / 3)) * 1.25 * dt;
  c.x += -Math.sin(c.yaw) * c.v * dt;
  c.z += -Math.cos(c.yaw) * c.v * dt;
  if (keepInField(c, 6)) c.v *= 0.3;
  // The creek, the pond, the rock and the tractor stop the cart: only the Cart Bridge crosses.
  if (cartBlocked(c.x, c.z, world)) { c.x = ox; c.z = oz; c.v *= -0.2; }
}

// Ten mats along z = 0, everyone hitting toward -z.
export const MATS = Array.from({ length: 10 }, (_, i) => ({ i, x: -18 + i * 4 }));
// Round 11 (owner, bays.js): the whole line in build order: the old ten, then the new wing west of the left crew bay.
// MATS stays the old ten (the seam goldens fly from it); anything drawn, washed or walked to uses LINE.
export const LINE = [...MATS, ...WING_X.map((x, k) => ({ i: MATS.length + k, x }))];

// How many mats are BUILT (only built bays exist: no mat, no number, no customer). More crew, more bays; balanced for 4.
// Round 11 (owner): 6 solo, 8 for two, 10 for three+, and +2 a tier of "Build more bays" (up.build) at every crew size.
export const activeMats = (players, up = null) => builtMats(players, up);
// Council round 10 §3: the Upper Deck's six middle bays (Tiered on). Solo 2, 2P 4, 3P+ 6; round 11: +2 a build tier.
export const UPPER_BAYS = 6;
export const activeUpper = (players, up = null) => builtUpper(players, up);

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

// Day lengths (council round 3): a short first day, then a full one.
export const shiftSecsFor = day => (day <= 1 ? 240 : day === 2 ? 360 : 420);

// A customer's shot from a mat: ~30–140 m carries, a bit of spray.
// Day 1 is the beginners' clinic: carries ×0.7, so balls land closer.
export function launch(mat, rng, { beginner = false } = {}) {
  const speed = (16 + rng() * 22) * (beginner ? 0.7 : 1), loft = 0.25 + rng() * 0.35, aim = (rng() - 0.5) * 0.35;
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
// How each ball type flies and lands (same on server and client).
//   square: stops dead where it lands.  bouncy: springy and rolls on and on.
export const KIND_PHYS = {
  square: { bounce: 0, stick: true },
  bouncy: { bounce: 0.78, keep: 0.92, roll: 1.2 },
};
function stepOnce(b, world) {
  const dt = SIM.STEP, R = SIM.BALL_R, k = KIND_PHYS[b.kind];
  b.vy -= SIM.G * dt;
  if (b.curve && b.y > 0.12) {   // hook or slice from a crew swing: sideways push, perpendicular to travel
    const h = Math.hypot(b.vx, b.vz);
    if (h > 1) { const a = 6 * b.curve * dt / h, vx = b.vx; b.vx -= b.vz * a; b.vz += vx * a; }
  }
  b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  ballFeatures(b, world);                  // the nets (where they hang at this venue), Dimples Rock, the Old Tractor
  if (b.y < R) {
    const r = groundContact(b, world, k);  // fairway, gravel, mud, or the creek's water
    if (r === 'rest') return true;
    if (r === 'drift') return 'drift';
  }
  return false;
}

// Advance a ball by dt seconds of fixed steps (the remainder carries over in
// b.acc). Returns true if it came to rest during this call, or 'drift' if it
// landed in the running creek (b.drift is set; step it with stepDrift).
export function advanceBall(b, dt, world) {
  if (b.rest || b.drifting) return false;
  b.acc = (b.acc ?? 0) + dt;
  while (b.acc >= SIM.STEP) {
    b.acc -= SIM.STEP;
    const r = stepOnce(b, world);
    if (r === 'drift') { b.acc = 0; startDrift(b, world); return 'drift'; }
    if (r) { b.acc = 0; return true; }
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
// Open any time (Tab / D-pad up), paid from the crew's shared cash.
// Tier 0 of each item is what you start with; buying moves up one tier.

export const SHOP = [
  // Owner playtest 3 §5.2: carrying gear is a crew row (up.gear): one buy kits out every Rat, late joiners too.
  { id: 'gear', title: 'Crew carrying gear', tiers: [
    { name: 'Bare hands', desc: 'Everyone’s pockets. Holds 3.' },
    { name: 'Ball retriever tubes', cost: 20, desc: 'One for every Rat. Click, click, click. Holds 8 and reaches a bit further.' },
    { name: 'Range buckets', cost: 75, desc: 'Everyone holds 25. You all look like you work here.' },
    { name: 'Push pickers', cost: 250, desc: 'Everyone walks over balls and scoops them up. Holds 60.' },
  ] },
  // Round 11 (owner): "Build more bays" (bays.js) replaces "Open every bay" (up.bays, migrated to up.build 2): +2 bays
  // a tier at every crew size, built overnight. Bays are concrete: they carry over to every venue.
  BUILD_ROW,
  { id: 'cart', title: 'Picker cart', minDay: 3, tiers: [
    { name: 'No cart', desc: 'Everything on foot.' },
    { name: 'Caged picker cart', cost: 600, desc: 'Drive over balls to scoop them up. Holds 150, unloads itself at the ball return, and the cage keeps the driver safe. Hit it from a crew bay for prizes.' },
    { name: 'Wide gang reels', cost: 1500, desc: 'Scoops a lane almost twice as wide, holds 300, a bit faster.' },
    { name: 'A second cart', cost: 300000, minVenue: 3, desc: 'Another caged cart with wide reels, parked beside the first. One laps for the crowd, one harvests. Each pings on its own.' },
    // Council round 10 §D: an undriven cart laps the Ping Track itself (half credit); hold Ⓨ at it to harvest.
    { name: 'Autopilot', cost: 250000, minVenue: 3, desc: 'An empty cart drives the Ping Track by itself. Ping it from a bay. Hold Ⓨ at it to send it harvesting.' },
  ] },
  { id: 'shed', title: 'Snack shed', minVenue: 1, tiers: [
    { name: 'Boarded up', desc: 'The old shed. Something smells like fryer oil.' },
    { name: 'Snack shed', cost: 200, desc: 'Reopens the shed. Fries raise what every ball pays.' },
    { name: 'Electric peeler', cost: 600, desc: 'Peels on its own: a basket every 10 s. Nobody asked how.' },
    { name: 'Fry conveyor', cost: 2000, desc: 'A basket every 3 s. Corporate does not explain why a driving range needs this many fries.' },
  ] },
  // Council round 10 §C: field ball returns (perks.returns). Ⓧ at one sends your pocket home in 6 s.
  // Round 11 (owner): the Far return sits across the creek at a late-Muni / Club price (it stops Rats coming back to
  // the main area); its pneumatic tube runs above ground on posts all the way to the return (ballreturn.js).
  { id: 'returns', title: 'Field ball returns', minDay: 4, tiers: [
    { name: 'One return', desc: 'Every ball walks home to the ball return.' },
    { name: 'The Far return', cost: 3000, minDay: 4, desc: 'A second return across the creek. A shiny tube on stilts whooshes your balls home. THUNK.' },
    { name: 'The Back return', cost: 12000, minVenue: 1, club: 'back', desc: 'A third return out by the Blue flag. Its tube joins the first one. THUNK.' },
  ] },
  { id: 'helpers', title: 'Hired help', tiers: [
    { name: 'Nobody', desc: 'It is just the crew.' },
    { name: 'One teenager', cost: 60, desc: 'Picks up balls with a beat-up tube (8 at a time) and banks them. Paid in pizza. They don’t do lawns. There’s a dog.' },
    { name: 'Two teenagers', cost: 150, desc: 'They walk out together. They walk back together.' },
    { name: 'Three teenagers', cost: 400, desc: 'One of them brought a speaker.' },
    { name: 'Four teenagers', cost: 1000, desc: 'A union is forming.' },
  ] },
  { id: 'washer', title: 'Ball washer', minDay: 2, tiers: [
    { name: 'Muddy balls', desc: 'A ball banks for $1.' },
    { name: 'Hand-crank washer', cost: 40, desc: 'Clean balls: $2 each, once someone cranks them through the ball washer on the return pipe.' },
    { name: 'Electric washer', cost: 160, desc: 'Sparkling balls: $3 each, and it washes 1 ball a second on its own.' },
    { name: 'Industrial ball wash', cost: 6000, minVenue: 1, desc: 'Washes 5 balls a second on its own. A ball car wash. It has a name. The name is Brent.' },
  ] },
  // Owner playtest 3 §5.1: the pressure washer's own row (perks.washRate / washReach / foam / truck). The
  // power-washing truck (Stadium, $300,000) is a later build: its tier is not in the shop yet.
  { id: 'wand', title: 'Pressure washer', minDay: 2, tiers: [
    { name: 'Garden-hose nozzle', desc: 'It sprays. Mostly forward.' },
    { name: 'Fan nozzle', cost: 40, minDay: 2, desc: 'Cleans 1.5× as fast. A wider spray. Same tiny engine.' },
    { name: 'Turbo nozzle', cost: 150, minDay: 4, desc: 'Cleans twice as fast and reaches 9 m. Corporate approved this nozzle after a brief incident.' },
    { name: 'Foam cannon', cost: 20000, minVenue: 2, desc: 'Foams every fixture in a 2 m cone at once. Sweep a row of mats in one pass.' },
  ] },
  // Owner playtest 3 §3.3, round 11: the basket's automatic filler (machineSecs): a slow, cheap Muni filler from day 2,
  // the fast machine at the Club. It was the row `bucket` (the machine only); crew.mjs migrates old saves.
  { id: 'filler', title: 'Bucket filler', minDay: 2, tiers: [
    { name: 'Filled by hand', desc: 'Hold the button at the dispenser. 30 balls a bucket.' },
    { name: 'Old bucket filler', cost: 50, desc: 'Fills a bucket every 20 s by itself. It wheezes. You can watch it.' },
    { name: 'Bucket machine', cost: 400, minVenue: 1, desc: 'Fills a bucket every 10 s. It hums. Nobody knows the tune.' },
  ] },
  // Owner playtest 3 §5.1: the turbo nozzle moved to the wand row; amenities keep one tier (saves migrate in crew.mjs).
  { id: 'amen', title: 'Club amenities', minVenue: 1, tiers: [
    { name: 'None', desc: 'The members have noticed.' },
    { name: 'Covered bays', cost: 8000, desc: 'Mats scuff half as fast. The members approve.' },
  ] },
  DIVE_ROW,    // personal: the dive gear ladder (Scuba v2), kept by name as diveByName
  POND_ROW,    // crew: the pneumatic ball tube and the pond pump
  GUTTERS_ROW,   // Tiered (2): the ball-return gutters
  //
  DRONES_ROW,    // County (4): drones
  //
  TETHER_ROW,    // Orbital (5): the orbital tether winch
  OWNER_ROW,     // endless only (round 7 #9): the Owner's projects (`endless: true`)
  { id: 'ads', title: 'Advertising', minDay: 2, tiers: [
    { name: 'Word of mouth', desc: 'Customers trickle in.' },
    { name: 'A sign by the road', cost: 30, desc: 'Customers hit 25% more balls.' },
    { name: 'Radio spot', cost: 90, desc: 'Customers hit 55% more balls.' },
    { name: 'A blimp', cost: 250, desc: 'Customers hit twice as many balls.' },
  ] },
  { id: 'shoes', title: 'Crew shoes', tiers: [
    { name: 'Range-issue loafers', desc: 'They squeak.' },
    { name: 'Sneakers', cost: 15, desc: 'Everyone walks 15% faster and sprints longer.' },
    { name: 'Running shoes', cost: 45, desc: 'Everyone walks 30% faster and sprints even longer.' },
    { name: 'Carbon spikes', cost: 120, desc: 'Everyone walks 45% faster and sprints for ages.' },
  ] },
  { id: 'hardhat', title: 'Hard hats', tiers: [
    { name: 'No hats', desc: `A ball hit floors you for ${SIM.KNOCK_SECS} seconds.` },
    { name: 'Hard hats for everyone', cost: 35, desc: 'Back up in 1 second. Goes BONK.' },
  ] },
];
export const SHOP_BY_ID = Object.fromEntries(SHOP.map(i => [i.id, i]));
export const HELPER_NAMES = ['Kyle', 'Madison', 'Tanner', 'Brayden'];

// The shop grows with the crew (owner playtest, 2026-11-24: don't overwhelm a new crew).
// A row appears at its venue (`minVenue`) and, at the Muni, on its day (`minDay`): day 1 is
// gear, shoes, hard hats and the teenagers; the washer and ads on day 2; the cart on day 3;
// the snack shed (the kitchen) at the Range Club. Hidden rows are not shown at all.
// Owner playtest 3 §4: a row with `maxCrew` hides for bigger crews (Open every bay: at 4+ Rats every mat is open).
// Round 11 (clubdays.js): a row with `club` (a CLUB_DAY key) hides at the Club before that Club day (vday).
export const shopShows = (item, venue = 0, day = Infinity, endless = false, crew = 1, vday = null) =>   // round 7 #9: an `endless` row shows only in endless
  (item.minVenue ?? 0) <= venue && (venue > 0 || (item.minDay ?? 0) <= day) && (!item.endless || !!endless) &&
  (!item.maxCrew || Math.max(1, crew) <= item.maxCrew) && (!item.club || endless || clubOpen(item.club, venue, vday));
// Why the next tier can't be bought yet: 'Day 4' (a Muni tier's own day) or the venue's name. Null when it can.
// Round 11: a tier with `club` (a CLUB_DAY key) is locked at the Club before that Club day: 'Club day 3'.
export function tierLock(item, lvl, venue = 0, day = Infinity, vday = null) {
  const t = item?.tiers[lvl + 1];
  if (!t) return null;
  if ((t.minVenue ?? 0) > venue) return VENUE_RULES[t.minVenue]?.name ?? 'later';
  if (venue === 0 && (t.minDay ?? 0) > day) return `Day ${t.minDay}`;
  if (t.club && !clubOpen(t.club, venue, vday)) return clubDayLabel(t.club);
  return null;
}
// The day the shop is shopping for: overnight (the report) it is tomorrow.
export const shopDay = (phase, day) => (phase === 'report' ? day + 1 : day);

// Crew upgrades scale with crew size (balanced for 4): ×1 solo, ×2.2 for four.
// Personal gear (only the dive gear now, §5.2) doesn't: everyone buys their own at the catalog price.
export const priceScale = crewSize => 1 + 0.4 * (Math.max(1, crewSize) - 1);
export function nextPrice(id, up, crewSize, gearLevel = 0, venue = 0, day = Infinity, endless = false, vday = null) {   // round 11: vday (clubdays.js)
  const item = Object.hasOwn(SHOP_BY_ID, id) ? SHOP_BY_ID[id] : null;
  if (!item || !shopShows(item, venue, day, endless, crewSize, endless ? null : vday)) return null;
  const lvl = item.personal ? gearLevel : up?.[id] ?? 0;
  const t = item.tiers[lvl + 1];
  if (!t || tierLock(item, lvl, venue, day, endless ? null : vday)) return null;    // maxed out, or not at this venue (or Muni day) yet
  return item.personal ? t.cost : Math.round(t.cost * priceScale(crewSize));
}

// The crew's carrying gear (up.gear, §5.2), the same for every Rat. p.gear is a copy on the wire.
export function gearPerks(level = 0) {
  return {
    pocket: [3, 8, 25, 60][level],
    reach: [SIM.REACH, 2.0, 2.0, 2.2][level],
    scoop: level >= 3 ? 1.1 : 0,                     // push picker: auto-pickup radius
  };
}
export const HELPER_POCKET = 8;

// Sprint: a short burst at SPEED×, on a stamina bar that shoes stretch.
export const SPRINT = { SPEED: 1.75, REGEN_DELAY: 0.8 };
export const sprintSecs = shoes => 1.5 + 1.25 * (shoes ?? 0);   // 1.5 s in loafers, 5.25 s in carbon spikes

// What the crew's upgrades add up to.
export function perks(up = {}) {
  return {
    helpers: up.helpers ?? 0,
    price: SIM.BALL_PRICE + Math.min(2, up.washer ?? 0),
    washer: up.washer ?? 0,
    washAuto: [0, 0, 1, 5][up.washer ?? 0],          // balls a second the ball washer cleans on its own
    washRate: [1, 1.5, 2, 2, 2][up.wand ?? 0],      // §5.1: the pressure washer's row (fan ×1.5, turbo ×2)
    washReach: [7, 7, 9, 9, 9][up.wand ?? 0],      // m of spray (WASH.RANGE at tier 0)
    foam: (up.wand ?? 0) >= 3,                     // the foam cannon: every fixture in a 2 m cone at once
    truck: (up.wand ?? 0) >= 4,                    // the power-washing truck (a later build)
    covered: (up.amen ?? 0) >= 1,
    build: up.build ?? 0,                          // round 11: Build more bays (bays.js)
    swingGapMult: [1, 0.8, 0.645, 0.5][up.ads ?? 0],
    walk: SIM.WALK * (1 + 0.15 * (up.shoes ?? 0)),
    knockSecs: up.hardhat ? 1 : SIM.KNOCK_SECS,
    cart: up.cart ?? 0,
    carts: [0, 1, 1, 2, 2][up.cart ?? 0],               // how many carts the crew owns (tier 3: the fleet)
    cartCap: [0, 150, 300, 300, 300][up.cart ?? 0],   // owner playtest 3 §5.3: half the hopper, a fast unload
    cartReel: [0, 2.4, 4.2, 4.2, 4.2][up.cart ?? 0],
    cartSpeed: [0, 9, 11, 11, 11][up.cart ?? 0],
    autopilot: (up.cart ?? 0) >= 4,                 // council round 10 §D: an undriven cart laps (or harvests) by itself
    returns: Math.max(0, Math.min(2, up.returns ?? 0)),   // council round 10 §C: 1 = the Field return, 2 = + the Back return
    shed: up.shed ?? 0,
    autoFry: [0, 0, 10, 3][up.shed ?? 0],          // seconds per basket, 0 = by hand only
  };
}

// ---- ball value: Corporate pays per ball ------------------------------------
// The per-ball rate is the crew's KPI. Upgrades raise it; upkeep (a clean
// cart) keeps it up; Hit the Cart multiplies it for the day.

export const WASH = {
  STATION: { x: 36, z: 3 },   // the pressure washer, beside the cart's parking spot
  GRAB: 2.5,                  // m, how close to grab the wand
  HOSE: 86,                   // m of hose (reaches the mats and the sign); wander further and you drop the wand. Round 11: 60 -> 86, so it reaches the new wing (bays.js, mat 16 at x -48)
  RANGE: 7,                   // m, how far the spray reaches
  RATE: 0.08,                 // mud cleaned per second of spraying on target (stacks per sprayer), × perks.washRate
  FOAM_R: 2,                  // m: the foam cannon's cone, every fixture this close to the spray line at once
  MUD_PER_M: 0.003,           // the cart's mud per metre driven (full after ~330 m)
};

// The council's model (design/council-round1.md §2):
//   pay per deposit = Σ ball weights × BV × Hustle × Gear(carrier)
//   BV     = Rate × Upkeep                  the big number on the Board
//   Rate   = venue rate × (1 + washer tier) × (1 + 0.05 × commendations)
//   Upkeep = 1 + 0.5 × (Curb + Pond + Fries + KPI)  each 0..1; a locked KPI counts 0. KPI is the
//            current venue's own gauge (round 4: Bay Utilization, Crowd Sentiment, Zoning Compliance,
//            Orbital Debris); only the current venue's counts, and it is null at the Muni and the Club.
//   Hustle = Hit the Cart: 1 + 0.25 a ping, max ×2, resets each morning
//   Gear   = owner playtest 3 §1.4 (the one price): Rate carries SIM.CLEAN_KIT ×1.25, so a clean carrier pays exactly
//            BV × Hustle; grime takes off up to 20% (a Rat: 0.2 × grime / 3; the cart: 0.2 × mud). Machinery ×1.
export const VENUES = [{ name: 'Muni Range', rate: 1 }, { name: 'Range Club', rate: 5 }, { name: 'Tiered Entertainment Range', rate: 25 },
  { name: 'Stadium Range', rate: 100 }, { name: 'County Range', rate: 500 }, { name: 'Orbital Range', rate: 2500 }];
export const KIND_W = { range: 1, glow: 2, lead: 3, square: 2, gold: 10, splitter: 1, bouncy: 1.5, debris: 3 };

// Which kind a customer's next ball is (lead and glow are chosen elsewhere).
// Debuts by day: gold day 3, square day 5 (council round 3), splitter day 7,
// bouncy at the Club (venue 1+). The foam ball was cut in round 3.
// Round 11 (clubdays.js): at the Club the kinds stagger by Club day (vday): square day 1, gold day 2 (with the pond's
// lead), bouncy day 3. One rng() draw either way, so the stream only moves where a kind is held back.
export function pickKind(day, venue, rng, vday = null) {
  const r = rng();
  const club = (venue ?? 0) === 1 && vday != null;
  if ((club ? clubOpen('gold', venue, vday) : day >= 3) && r < 0.005) return 'gold';
  if (day >= 7 && r < 0.045) return 'splitter';
  if (venue >= 1 && clubOpen('bouncy', venue, vday) && r < 0.10) return 'bouncy';
  if ((club ? clubOpen('square', venue, vday) : day >= 5) && r < 0.15) return 'square';      // round 6 #8: fewer (was 0.28), worth ×2, and the reels can't take them
  return 'range';
}
export const KIND_NAMES = { range: 'range ball', glow: 'glow ball', lead: 'lead ball', square: 'square ball', gold: 'GOLD BALL', splitter: 'splitter', bouncy: 'super-bouncy ball', debris: 'orbital debris' };
export const KIND_BLURB = {
  square: "Worth ×2. The reels can't take it.",
  gold: 'Worth ×10. Dimples watches.',   // playthrough 3 #10: the debut memo in 8 words ("NEW: the GOLD BALL. ...")
  lead: 'Worth ×3. It always ends up in the pond.',
  splitter: 'Pick one up and it becomes three.',
  bouncy: 'Worth ×1.5. It does not want to be picked up.',
  glow: 'Worth ×2. Only at Last Call.',
  debris: 'Worth ×3. It left the atmosphere and came back. Corporate has questions.',
};
export const BALLS_OUTSTANDING = 4_213_377_019;   // down to Ball No. 1, hit into orbit by the founder in 1958
const clamp01 = v => Math.max(0, Math.min(1, v ?? 0));
const c2 = v => Math.round(v * 100) / 100;

// The cart's gear factor: 1 − 0.2 × mud (no cart: 1; filthy 0.8). Each cart in the fleet pays its own.
export const cartGearOf = cart => cart ? 1 - 0.2 * Math.max(0, Math.min(1, cart.mud ?? 0)) : 1;
export function ballValue({ perks: k, mult = 1, cart = null, curb = 0.5, pond = null, fries = null, kpi = null, commendations = 0, venue = 0 }) {
  const rate = VENUES[venue].rate * k.price * (1 + 0.05 * Math.min(10, commendations)) * SIM.CLEAN_KIT;
  const upkeep = 1 + 0.5 * (clamp01(curb) + (pond == null ? 0 : clamp01(pond)) + (fries == null ? 0 : clamp01(fries)) + (kpi == null ? 0 : clamp01(kpi)));
  const bv = c2(rate * upkeep);
  const cartGear = cartGearOf(cart);
  const v = { value: c2(bv * mult), bv, rate: c2(rate), upkeep, hustle: mult, cartGear, curb: clamp01(curb), pond, fries };
  if (kpi != null) v.kpi = clamp01(kpi);     // only when the venue has one: the Muni and the Club are byte-identical
  return v;
}
export const payFor = (w, v, gear = 1) => c2(w * v.bv * v.hustle * gear);
// The most Upkeep can be: 1.5 with Curb alone, +0.5 per unlocked gauge. 3.0 with all four (Tiered and up).
export const upkeepCeiling = ({ pond = null, fries = null, kpi = null }) => 1 + 0.5 * (1 + (pond == null ? 0 : 1) + (fries == null ? 0 : 1) + (kpi == null ? 0 : 1));

// Curb Appeal: the things customers see. Each gets muddy; the wand cleans them.
export const FIXTURES = [
  { id: 'sign', x: 14, z: 11, r: 1.8 },
  { id: 'stand', x: SIM.STAND.x, z: SIM.STAND.z, r: 1.6 },   // the ball return (customers see it from the mats)
  ...LINE.map(m => ({ id: `mat${m.i}`, x: m.x, z: 0, r: 1.1 })),   // round 11: the wing too (only BUILT mats hold mud, bays.js)
];
export const FIXTURE_BY_ID = Object.fromEntries(FIXTURES.map(f => [f.id, f]));

// The daily quota: BV at the closing bell must reach Rate × (1 + q). None on day 1.
// Council round 6 #1: a floor of 0.3, so an idle Muni crew misses day 2 (it must hose before the bell).
export function quotaQ(day, ceiling) {
  if (day <= 1) return null;
  const q = [0.15, 0.2, 0.3, 0.35][day - 2] ?? 0.35 + 0.05 * (day - 5);
  return Math.min(Math.max(0.3, q), 0.8 * (ceiling - 1));
}
// The end of the day (round 11, owner firm call; replaces owner playtest 3 §2's "glow at 1:30, out at 1:00"):
// from T−TAPER customers taper off (busy bays and the swing rate fall smoothly, dayend.js), Last Call's glow balls
// from T−SECS, and at T−CLEANUP the last customer walks out: a two-minute cleanup, no customer ball, no scuffing.
// Windows are for a full FULL-second shift and scale down with a shorter one (day 2's 360 s). SWING: no rush now (1).
// DAY_RATE: the busier daytime crowd (round 11 final pass) that keeps a shift's customer balls within ~10% of the old day.
export const LAST_CALL = { SECS: 150, FROM_DAY: 2, SWING: 1, TAPER: 180, FULL: 420, MIN_RATE: 0.5, DAY_RATE: 1.6 };
export const CLEANUP = 120;
// Owner playtest 3 §3.1: mats keep their mud overnight, capped here ("the night crew knocks the worst off").
export const MAT_NIGHT_CAP = 0.6;
// Owner playtest 3 §3.3: the bucket basket by the dispenser. Empty every morning; the crew fills it by hand at the
// Muni (hold Ⓐ, two chutes); the SHOP `filler` row adds one every SLOW_SECS (the Muni's old filler) or MACHINE_SECS (the Club).
export const BUCKETS = { BASKET: 12, BALLS: 30, BALLS_CLUB: 40, FILL_SECS: 1.5, CHUTES: 2, MACHINE_SECS: 10, SLOW_SECS: 20, WAIT: 25 };
export const machineSecs = tier => [0, BUCKETS.SLOW_SECS, BUCKETS.MACHINE_SECS][Math.max(0, Math.min(2, tier | 0))];
// Council round 6 #2: from Tiered on, the bell's review also needs the venue gauge at or above this.
// The Muni and the Club have no gauge (kpi null), so their rule is unchanged.
export const QUOTA_KPI = 0.5;

// ---- promotion and the venue ladder (council round 2, §4.1–4.2) -------------
export const VENUE_RULES = [
  { name: 'Muni Range', title: 'Range Rat' },
  { name: 'Range Club', title: 'Club Retrieval Associate', fee: 2500, writeOff: 1_200_000_000, memo: "1,200,000,000 balls have been reclassified as members' property.", pa: 'club', eatEvery: 8 },
  { name: 'Tiered Entertainment Range', title: 'Experiential Retrieval Lead', fee: 50000, writeOff: 1_500_000_000, memo: '1,500,000,000 balls have been reclassified as experiential.', pa: 'tiered', eatEvery: 8,
    kpi: 'BAY UTILIZATION', howto: 'New: Target Greens. Balls in a cup block the sensors. Bay Utilization is now on the Board. The Upper Deck is now serving.' },
  { name: 'Stadium Range', title: 'Stadium Retrieval Captain', fee: 600000, writeOff: 800_000_000, memo: '800,000,000 balls have been sold to fans as souvenirs.', pa: 'stadium', eatEvery: 8,
    kpi: 'CROWD SENTIMENT', howto: 'New: the Ping Track. The crowd grades you now. The crowd has never played golf.' },
  { name: 'County Range', title: 'County Retrieval Director', fee: 3_000_000, writeOff: 712_000_000, memo: '712,000,000 balls have been reclassified as the county.', pa: 'county', eatEvery: 8,
    kpi: 'ZONING COMPLIANCE', howto: 'New: the Yards. Your customers now hit into the county. The county has noticed.' },
  { name: 'Orbital Range', title: 'Orbital Retrieval Officer', fee: 12_500_000,   /* round 11: 15M -> 12.5M, so the County's 2 good days are its 2 shifts */ writeOff: 'rest', memo: 'Earth has been fully retrieved. 1,958 balls remain. They are all in orbit.', pa: 'orbital', eatEvery: 8,
    kpi: 'ORBITAL DEBRIS', howto: 'The Lift is open. Keep the sky clear.' },
];
// Round 4: VENUE_RULES[v].kpi is the Board's fourth gauge label (only the current venue's KPI is graded),
// and .howto is the reveal's second memo card.
export const revealCards = (venue, memo) => [memo, VENUE_RULES[venue]?.howto].filter(Boolean);
export const ONE_YEAR = 1958;
// Quota from the Club on: a share of the headroom, growing with days at the venue.
// Softened from the council's 0.45..0.8 so a casual crew makes quota without every chore covered.
export const venueQuotaF = vd => Math.min(0.7, [0.35, 0.4, 0.45, 0.5][vd - 1] ?? 0.5 + 0.025 * (vd - 4));

// ---- the ball washer station (council round 2, §4.4) ------------------------
// Owner layout (2026-11-24): on the pipe from the return (SIM.STAND) to the bank (BANK), so balls go
// return -> washer -> bank. A handle either side of the pipe (L on the world's -x side).
export const WASHER = { x: 27.5, z: 3.8, REACH: 1.8, CRANK_MAX: 2.5 };
export const WASHER_HANDLES = { L: { x: WASHER.x - 1.4, z: WASHER.z }, R: { x: WASHER.x + 1.4, z: WASHER.z } };
// The bank: the Board and its ball silo, on the old stand's spot (the Board's root is at z + 1.2). The silo
// stands 2.5 m along the Board (turned 35 degrees, signs.js BOARD_YAW): board.js puts it there, ballreturn.js aims the pipe at it.
export const BANK = { x: 26, z: 6 };
export const SILO = { x: BANK.x + 2.5 * Math.cos(35 * Math.PI / 180), z: BANK.z + 1.2 - 2.5 * Math.sin(35 * Math.PI / 180), R: 0.5 };
export const atHandle = (p, side) => Math.hypot(p.x - WASHER_HANDLES[side].x, p.z - WASHER_HANDLES[side].z) < WASHER.REACH;

// ---- gear grime (council round 2, §4.7) ------------------------------------
export const gearGrimeFactor = grime => 1 - 0.2 * Math.max(0, Math.min(3, grime ?? 0)) / 3;   // owner playtest 3 §1.4: 1.0 clean -> 0.8 caked

// The pond (council round 1, #5): balls that land in it sink and stay overnight.
// Pond Clarity counts toward Upkeep from day 4, when lead balls start arriving.
export const POND = {
  x: -12, z: -78, r: 8,
  DOCK: { x: -12, z: -68.5 },     // the jetty on the near shore: pump air from here
  DOCK_R: 2.2,
  FROM_VENUE: 1,                  // the pond (and lead balls) open with the Range Club
  LEAD_CHANCE: 0.06,
  CLEAR_AT: 80,                   // clarity = 1 - sunk / CLEAR_AT (softened from 30: a crew that skips the pond for a shift still makes quota)
  MAX_SUNK: 60,
  BOTTOM: -1.1,                   // where sunk balls rest
  AIR: 20,                        // seconds of air (mask)
  AIR_REFILL: 6,                  // per second, back on land
  PUMP: 2,                        // per second, while a crewmate pumps
  BAG: 10,
  REACH: 2.2,
  SWIM: 0.6,                      // walking speed underwater
};
// The snack shed: peel potatoes into baskets of fries; customers eat them.
export const FRIES = {
  SHED: { x: 42, z: 6 }, REACH: 2.4,   // where you stand at the counter (inside the walkable field)
  MAX: 20,                    // baskets in stock: Fry Satisfaction = stock / MAX
  EAT_EVERY: 8,               // customer swings per basket eaten
  SERVE_MIN_SECS: 4,          // the kitchen minigame: at most one serve this often per Rat
};
// Council round 10 #2: a hot dog FEDs the crew. Every ball the crew banks pays × fed (a separate factor like
// Gary's Seal: past the Hustle cap; Upkeep never sees it). Good +0.05, perfect +0.10, capped at ×1.25, and it
// wears off 0.05 every 20 s of working time (the cleanup minute counts). Reset each morning.
export const FED = { GOOD: 0.05, PERFECT: 0.10, MAX: 1.25, DECAY: 0.05, EVERY: 20 };
export const atShed = p => Math.hypot(p.x - FRIES.SHED.x, p.z - FRIES.SHED.z) < FRIES.REACH;

export const inPond = p => Math.hypot(p.x - POND.x, p.z - POND.z) < POND.r;
export const onDock = p => Math.hypot(p.x - POND.DOCK.x, p.z - POND.DOCK.z) < POND.DOCK_R;
export const pondClarity = sunk => Math.max(0, 1 - sunk / POND.CLEAR_AT);

// A lead ball: lofted to land in the pond, from the customer's mat.
export function leadLaunch(mat, rng) {
  const tx = POND.x + (rng() - 0.5) * POND.r, tz = POND.z + (rng() - 0.5) * POND.r;
  const dx = tx - mat.x, dz = tz - (-0.4), d = Math.hypot(dx, dz), loft = 0.6;
  const speed = Math.sqrt(d * SIM.G / Math.sin(2 * loft));
  const h = speed * Math.cos(loft);
  return { x: mat.x, y: 0.1, z: -0.4, vx: dx / d * h, vy: speed * Math.sin(loft), vz: dz / d * h };
}

// Gary from Regional's Walkthrough (council round 1, #2). From day 3: a warning
// at 43% of the shift, then he drives his route, pausing at each stop.
export const GARY = {
  FROM_DAY: 4, AT: 0.43, WARN_SECS: 45, SPEED: 5, PAUSE: 3,   // day 4 (playtest: day 3 already brings the first target and gold)
  CLEAN: 0.34,              // a stop passes at this much mud or less
  HUDDLE_R: 8,              // every online Rat this close to the stand when he arrives: it counts twice
  STALL: 3, STALLS: 3,      // council round 8 #2: a crew ball on his cart while he drives: 3 s of notes, 3 times a visit
  SOLO_WARN: 90, SOLO_MATS: 2,   // playthrough 4 A18: solo, a longer warning (round 11: 60 -> 90 s) and only the two muddiest mats in play
  SOLO_START: 0.34,         // round 11 (expert XS): on a solo Gary morning the sign and the cart start at his pass line
  // Owner playtest 3 §6.2–6.4: the schedule, the chat and the Seal.
  GAP: 2, GAP_LONG: 3, GAP_LONG_P: 1 / 3,   // the next visit is 2 days later, or 3 with a 1-in-3 chance (crew RNG)
  STALL_BUDGET: 12,         // s of stalling a visit, shared by chat and cart pings (each ping still GARY.STALL)
  CHAT_R: 2.5,              // m: hold Ⓐ this close to a parked Gary to chat
  CHAT_RESUME: 1,           // s he waits after a chat ends ("Right, then.")
  SEAL: 1.25,               // Gary's Seal: a passed visit with a full huddle pays ×1.25 a ball until the bell
  COMMEND_HUDDLE: 3, COMMEND_PASS: 1, COMMEND_CAP: 10,   // commendations for a pass with / without the full huddle
  START: { x: 60, z: 14 },
  STOPS: [
    { id: 'sign', x: 16.8, z: 10.6 },       // playthrough 5 A7: beside the sign's right post, 1.6 m from the fence (z 9): in chat reach (it was z 13)
    { id: 'mats', x: 0, z: 3.5 },
    { id: 'cart', x: null, z: null },       // wherever the (muddier) cart is (skipped if the crew has none)
    { id: 'stand', x: 26, z: 10 },          // owner layout: behind the Board (the bank); he inspects the return and its huddle from there
  ],
};
// $6,000, $1.23, and whole dollars from $100 up (playtest 3: "+$150,645.01" everywhere).
export const money = v => `$${Number.isInteger(v) || Math.abs(v) >= 100 ? Math.round(v).toLocaleString('en-US') : v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const atStand = p =>Math.hypot(p.x - SIM.STAND.x, p.z - SIM.STAND.z) < SIM.STAND_REACH;

// Hold a walker inside the field at this venue (fieldFor: the County opens the Yards to x 96). Every caller
// passes its world; a missing world is venue 0.
export function clampToField(p, world) {
  const F = fieldFor(world);
  p.x = Math.max(F.xMin, Math.min(F.xMax, p.x));
  p.z = Math.max(F.zMin, Math.min(F.zMax, p.z));
}
