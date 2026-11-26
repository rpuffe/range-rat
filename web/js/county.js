// Range Rat: County Range shared rules (council round 4, section 3.3). Pure and DOM-free: the server module
// (server/venues/county.mjs), the view and the tests read the same numbers from here.
//
// DELIBERATELY does not import sim.js. sim.js imports DRONES_ROW from this file to append it to SHOP, so importing
// sim.js back would be a cycle (a TDZ crash when this file loads first). map.js is a leaf and is safe.
import { MAP } from './map.js';

// "Customers at the County fade the ball. Corporate does not use the word 'slice'."
// 40% of customer shots get a curve in [MIN, MAX): the crew swing's own curve physics, bending right (+x).
// Tuned: the doc's 0.6-1.4 puts only ~6% of shots in the Yards; 1.0-2.0 gives ~12% (the 10-15% target, pinned by test).
// Round 7 #6: 0.40 -> 0.15, so ~4-5% land in the Yards (the teenagers no longer clear them: one Rat's errand, or drones).
export const SLICE = { CHANCE: 0.15, MIN: 1.0, MAX: 2.0 };

// Zoning Compliance = 1 - strays / STRAY_CAP. A stray is a resting ball past the kerb (x > KERB_X).
export const ZONING = { STRAY_CAP: 30, EVERY: 0.5 };
export const isStray = b => !!b && !!b.rest && !b.sunk && b.kind !== 'one' && b.x > MAP.KERB_X;
export const strayCount = balls => { let n = 0; for (const b of balls) if (isStray(b)) n++; return n; };
export const zoning = strays => Math.max(0, Math.min(1, 1 - strays / ZONING.STRAY_CAP));

// The yard a spot is in (1..4), or 0 if it is not in the Yards. Fences split them at z -70, -110, -150.
export function yardAt(x, z) {
  const Y = MAP.YARDS;
  if (x <= Y.xMin || x > Y.xMax || z > Y.zMax || z < Y.zMin) return 0;
  let n = 1;
  for (const f of Y.FENCES) if (z < f) n++;
  return n;
}

// Drones: a crew row (price-scaled like every crew row). Tier 1 two drones, tier 2 four.
export const DRONES_ROW = {
  id: 'drones', title: 'Drones', minVenue: 4, tiers: [
    { name: 'No drones', desc: 'The Yards are cleared on foot. The county is watching.' },
    { name: 'Two drones', cost: 1200000, desc: 'They take the strays first, then the nearest ball. 10 m/s, 25 balls each, never knocked down. "They are not watching you."' },
    { name: 'Four drones', cost: 3000000, desc: 'Four of them. Zoning has stopped returning your calls, which is the good kind of quiet.' },
  ],
};
export const DRONE_COUNTS = [0, 2, 4];
export const droneTier = up => Math.max(0, Math.min(DRONES_ROW.tiers.length - 1, (up?.drones ?? 0) | 0));
export const droneCount = up => DRONE_COUNTS[droneTier(up)];

export const DRONES = {
  SPEED: 10,       // m/s, ignoring the creek, the kerb and wading
  ALT: 6,          // cruise height (y)
  GRAB_Y: 1,       // the dip to grab a ball
  DIP_R: 2.5,      // start dipping this close to the ball
  VSPEED: 6,       // m/s up and down
  POCKET: 25,      // balls carried
  GRAB_R: 0.5,     // horizontal reach for a grab
};

// Who a drone goes for: strays first (nearest to it), then the nearest ball. `claimed` is a Set of ball ids that
// other drones already want. Council round 10 §D: with a dispatch `zone` ({ x, z, r }) pinned, every ball inside it
// comes first (nearest), then strays, then the rest. Returns the ball or null.
export function droneTarget(d, balls, claimed = new Set(), zone = null) {
  let best = null, bd = Infinity, bs = -1;
  for (const b of balls) {
    if (!b.rest || b.sunk || b.creek || b.kind === 'one' || b.hands || claimed.has(b.id)) continue;   // council round 10 #5: snags are divers' only; round 11: hazards are Rats' only
    const score = zone && Math.hypot(b.x - zone.x, b.z - zone.z) <= zone.r ? 2 : isStray(b) ? 1 : 0, dist = Math.hypot(b.x - d.x, b.z - d.z);
    if (score > bs || (score === bs && dist < bd)) { best = b; bd = dist; bs = score; }
  }
  return best;
}

// Council round 10 §D: drone dispatch. On foot at the County, hold Ⓨ: "Drones, here!" pins a 20 m zone for 30 s.
export const DISPATCH = { R: 20, SECS: 30, HOLD_SECS: 0.6 };
export const newZone = (x, z, t) => ({ x, z, r: DISPATCH.R, until: t + DISPATCH.SECS });
export const zoneLive = (zone, t) => !!zone && t < zone.until;

// One drone step toward goal {x, z, grab?}: flies at SPEED, climbs to ALT (dips to GRAB_Y close to a ball to grab).
// Mutates d {x, y, z, yaw}. Returns true once it is over the goal (and, for a grab, down at the ball).
export function droneStep(d, goal, dt) {
  const dx = goal.x - d.x, dz = goal.z - d.z, dist = Math.hypot(dx, dz);
  const step = Math.min(dist, DRONES.SPEED * dt);
  if (dist > 1e-6) { d.x += dx / dist * step; d.z += dz / dist * step; d.yaw = Math.atan2(-dx, -dz); }
  const left = dist - step;
  const want = goal.grab && left < DRONES.DIP_R ? DRONES.GRAB_Y : DRONES.ALT;
  const dy = want - d.y, vy = Math.min(Math.abs(dy), DRONES.VSPEED * dt);
  d.y += Math.sign(dy) * vy;
  return left < DRONES.GRAB_R && (!goal.grab || d.y <= DRONES.GRAB_Y + 0.05);
}

// ---- round 11 (expert #6, #9): Zoning bites, and the hazard balls ---------------------------------------------------
// Hazard balls: a customer ball that comes to rest inside the hose's reach (ZONE_R of the pressure washer, short of
// the kerb) turns hazard with hazChance(crew size). Drones, teenagers, carts and the autopilot refuse them (b.hands). One Rat sprays
// it with the wand (SPRAY s on it) and it is wet for WET s; a Rat who picks up a wet hazard bags it on the spot: it
// pays W ball-weights. A dry hazard can't be picked up. Sprayer and bagger can be the same Rat (solo), just slower.
// Each hazard lying out costs Zoning 1/CAP, on top of the strays: unattended, a 4P crew's hazards cross the line in
// ~90-120 s (the hazards come with the customers, so a solo crew's come ~2.5x slower). A hazard nobody bags is
// written off after LIFE s of open range (it turns back into a range ball; not in the cleanup): left alone, a 4P crew's Zoning hovers round the line
// (DENIED some days), a solo crew's stays well above it. W: Corporate bills the county for the disposal (~10% of a
// 4P County shift's income when the crew does the job).
export const HAZ = { CHANCE: 0.14, ZONE_R: 62, KERB_PAD: 3, SPRAY: 1.0, WET: 8, W: 40, CAP: 12, LIFE: 120 };
// The chance scales with the crew (gentle solo, real at 4P): x0.4 solo, x1 at 4P.
export const hazChance = n => HAZ.CHANCE * [0.4, 0.65, 0.85, 1][Math.max(1, Math.min(4, n | 0 || 1)) - 1];
// The washer station is passed in (sim.js WASH.STATION): this file must not import sim.js.
export const inHazZone = (x, z, st) => Math.hypot(x - st.x, z - st.z) <= HAZ.ZONE_R && x < MAP.KERB_X - HAZ.KERB_PAD && z < -4;
export const isHazard = b => !!b && b.kind === 'hazard' && !b.sunk;
export const hazardCount = balls => { let n = 0; for (const b of balls) if (isHazard(b)) n++; return n; };
// Zoning with hazards: 1 - strays / STRAY_CAP - hazards / HAZ.CAP, clamped (no hazards: the old zoning()).
export const zoningWith = (strays, hazards = 0) => Math.max(0, Math.min(1, 1 - strays / ZONING.STRAY_CAP - hazards / HAZ.CAP));

// Below the line Zoning sends a van down the kerb: every EVERY s of working shift it tows TOW(n) resting balls (the
// ones nearest the kerb first: strays, then the field's right side). Towed balls are gone, unpaid.
export const VAN = { EVERY: 30, LINE: 0.5, SECS: 8 };
export const vanTow = n => 4 + 2 * Math.max(1, Math.min(4, n | 0 || 1));
// Which balls the van takes: resting, not Ball No. 1, not sunk/in the creek, not a hazard; nearest the kerb first.
export function vanPick(balls, k) {
  const out = [];
  for (const b of balls) {
    if (!b.rest || b.sunk || b.creek || b.drifting || b.kind === 'one' || b.hands) continue;   // the hazards are yours to bag
    out.push(b);
  }
  out.sort((a, b) => b.x - a.x);
  return out.slice(0, Math.max(0, k | 0));
}

// ---- council round 11 #2: the County says "hazards" -------------------------------------------------------------------
// A live deal: whenever Zoning is under the line + OVER and MIN+ hazards are out, the rally deals "Hazards out! Spray and
// bag!" to the two Rats nearest the hazards (solo: the one Rat), at most every EVERY s (Last Call re-deals at once).
export const HAZ_DEAL = { MIN: 3, OVER: 0.1, EVERY: 45 };
export const hazDealDue = ({ haz = 0, kpi = 1, line = 0.5, since = Infinity }) => haz >= HAZ_DEAL.MIN && kpi < line + HAZ_DEAL.OVER && since >= HAZ_DEAL.EVERY;
// Who gets it: [sprayer, bagger] ids (one id solo). rats: [{ id, x, z, wand }]; hazards: [{ x, z }]. The sprayer is the
// wand holder nearest the hazards' centroid if anyone holds the wand, else the nearest Rat; the bagger is the nearest
// other Rat. [] with no Rats or no hazards.
export function hazPair(rats, hazards) {
  if (!rats?.length || !hazards?.length) return [];
  let cx = 0, cz = 0;
  for (const h of hazards) { cx += h.x; cz += h.z; }
  cx /= hazards.length; cz /= hazards.length;
  const byDist = [...rats].sort((a, b) => Math.hypot(a.x - cx, a.z - cz) - Math.hypot(b.x - cx, b.z - cz));
  const sprayer = byDist.find(r => r.wand) ?? byDist[0];
  const bagger = byDist.find(r => r !== sprayer);
  return bagger ? [sprayer.id, bagger.id] : [sprayer.id];
}
// The Board's Zoning gauge line (builder 4's board.js draws mods.county.label): "ZONING 62% · 7 HAZARDS".
export const zoningLabel = (kpi, haz = 0) => `ZONING ${Math.round(Math.max(0, Math.min(1, kpi ?? 1)) * 100)}%${haz > 0 ? ` · ${haz} HAZARD${haz === 1 ? '' : 'S'}` : ''}`;
// The first van tow's toast (the rest go to the feed).
export const vanToast = n => `Zoning towed ${n} balls. Bag the hazards!`;
