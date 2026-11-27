// Council round 13 #1 (builder 2): the Members' Tournament, the Club's back-half peak. Pure: no THREE, no DOM, no
// sim.js import (the server module, the view, the bots and the tests share it).
//
// From Club day 4 (CLUB_DAY.tourney), on any Club day that isn't a boss day or Promotion Day, the members come out to
// play: two flights a shift (T-5:00 and T-2:30, each moved up to DODGE s to stay clear of a Last Call deal). Each
// flight, N members tee off from the covered bays nearest the clubhouse and each ball lands somewhere on the field under
// a navy-and-gold beam (the spots come from hash32(day, venueDay, flight): no RNG draw). Each ball has SECS s; then the
// members' caddie cart claims it. A Rat picks one up (it rides in their hands, outside the pocket: b.hands, so no
// machine, helper or mower takes it) and walks it to a return: it pays PAY Ball Values. At 3P+ one ball a flight drops
// in the pond (a diver's job). Every ball in a flight banked: a clean flight.
import { MAP, creekProject, inPondArea } from './map.js';
import { hash32 } from './today.js';
import { CLUB_DAY } from './clubdays.js';

export const TOURNEY = {
  DAY: CLUB_DAY.tourney ?? 4,   // the first Club day with flights
  AT: [120, 270],               // shiftT of each flight on a full 420 s shift (T-5:00, T-2:30)
  FULL: 420,                    // the shift the AT times are written for (a short shift keeps the seconds-left)
  DODGE: 20,                    // s: a flight within this of a deal moves clear of it (earlier first)
  SECS: 30,                     // each ball's clock, from the drop
  PAY: 45,                      // ball-weights a member's ball pays at a return. The council's ×25 assumed a ~$70 4P Club BV;
                                // the bots measure ~$46 (×35 gave a 13 % share, ×50 16 %; ×45 puts a 4–6-of-6 crew at ~24 %: design/round15-club.md)
  N: [2, 2, 3, 3, 4, 4],        // balls a flight, by crew size 1..6
  POND_FROM: 3,                 // from this crew size one ball a flight is in the pond
  NEAR: 60, FAR: 140,           // m out from the mats (z -60 .. -140)
  X: 54, MID: 8,                // |x| range of a spot: MID..X, either side of centre
  CREEK_PAD: 9, POND_PAD: 5, APART: 16,   // keep clear of the creek, the pond, and each other
  TEE: [{ x: 18, z: 1.2 }, { x: 14, z: 1.2 }, { x: 10, z: 1.2 }, { x: 6, z: 1.2 }],   // the covered bays by the clubhouse
  DROP_Y: 24, DROP_VY: -4, DROP_VH: 4, ROLL: 6,   // the drop: a lofted ball coming in from the tee's direction
  BANK_R: 3.5,                  // SIM.STAND_REACH (pinned by test/tourney.test.mjs): how close to a return banks it
  DROPPED_SECS: 12,             // a knocked-down carrier's member ball goes back on the clock for at least this
};

const clampN = n => Math.max(1, Math.min(TOURNEY.N.length, n | 0 || 1));
export const flightN = n => TOURNEY.N[clampN(n) - 1];
export const pondBall = n => (n | 0) >= TOURNEY.POND_FROM;

// Is today a Tournament day? venue 1, venueDay >= DAY, not endless, not Promotion Day, no boss today.
export const tourneyDay = ({ venue, venueDay, endless = false, promo = false, boss = false } = {}) =>
  venue === 1 && !endless && !promo && !boss && (venueDay | 0) >= TOURNEY.DAY;

// The flights' shiftT for a shift of `secs`, each moved clear of `deals` (shiftT of the deals: Last Call, the cleanup).
// Written as seconds-left so a short shift keeps "T-5:00" (a shift shorter than that starts the flight at 0).
export function flightTimes(secs = TOURNEY.FULL, deals = []) {
  const out = [];
  for (const at0 of TOURNEY.AT) {
    let at = Math.max(0, secs - (TOURNEY.FULL - at0));
    const near = d => Math.abs(at - d) < TOURNEY.DODGE - 1e-9;
    const clash = deals.find(near);
    if (clash != null) {
      const early = clash - TOURNEY.DODGE, late = clash + TOURNEY.DODGE;
      at = early >= 0 && !deals.some(d => Math.abs(early - d) < TOURNEY.DODGE - 1e-9) ? early : late;
    }
    out.push(at);
  }
  return out;
}

// A spot is clear: on the field, off the creek, off the pond, off the Rock and the Tractor.
export function clearSpot(x, z) {
  const F = MAP.FIELD;
  if (x < F.xMin + 6 || x > F.xMax - 6 || z < F.zMin + 6 || z > -20) return false;
  if (creekProject(x, z).d < TOURNEY.CREEK_PAD) return false;
  if (inPondArea(x, z, TOURNEY.POND_PAD)) return false;
  for (const r of MAP.ROCKS) if (Math.hypot(x - r.x, z - r.z) < r.r + 5) return false;
  for (const b of MAP.BOXES) if (Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) + 5) return false;
  return true;
}
const FALLBACK = [{ x: -30, z: -100 }, { x: 30, z: -64 }, { x: -50, z: -150 }, { x: 46, z: -140 }];

// The flight's landing spots: [{ x, z, pond, side }]. The land balls alternate left (x < 0) and right, starting left, so
// any flight has one each side; at 3P+ the last one is in the pond. hash32(day, vday, 'm', flight, j, k): no RNG draw.
export function memberSpots(day, vday, flight, n = 4) {
  const N = flightN(n), pond = pondBall(n), land = pond ? N - 1 : N, out = [];
  for (let j = 0; j < land; j++) {
    const side = j % 2 === 0 ? -1 : 1;
    let spot = null;
    for (let k = 0; k < 40 && !spot; k++) {
      const h = hash32(day | 0, vday | 0, 'm', flight | 0, j, k);
      const z = -(TOURNEY.NEAR + ((h % 1009) / 1008) * (TOURNEY.FAR - TOURNEY.NEAR));
      const x = side * (TOURNEY.MID + (((h >>> 11) % 1009) / 1008) * (TOURNEY.X - TOURNEY.MID));
      if (clearSpot(x, z) && out.every(o => Math.hypot(o.x - x, o.z - z) >= TOURNEY.APART)) spot = { x, z };
    }
    spot ??= FALLBACK.find(f => Math.sign(f.x) === side && out.every(o => Math.hypot(o.x - f.x, o.z - f.z) >= TOURNEY.APART)) ?? FALLBACK[j % FALLBACK.length];
    out.push({ x: Math.round(spot.x * 100) / 100, z: Math.round(spot.z * 100) / 100, pond: false, side });
  }
  if (pond) {
    const h = hash32(day | 0, vday | 0, 'p', flight | 0), P = MAP.POND;
    const a = (h % 3600) / 3600 * Math.PI * 2, r = (((h >>> 12) % 1000) / 1000) * (P.r - 3);
    out.push({ x: Math.round((P.x + Math.cos(a) * r) * 100) / 100, z: Math.round((P.z + Math.sin(a) * r) * 100) / 100, pond: true, side: -1 });
  }
  return out;
}

// The member who hits ball j tees off from TEE[j] (the covered bays nearest the clubhouse).
export const teeOf = j => TOURNEY.TEE[(j | 0) % TOURNEY.TEE.length];

// The drop: a lofted ball coming in from its tee's direction, aimed so it comes to rest on the spot (a pond ball
// splashes in on it). Returns the spawn { x, y, z, vx, vy, vz }.
export function dropShot(spot, j = 0) {
  const tee = teeOf(j), dx = spot.x - tee.x, dz = spot.z - tee.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  const { DROP_Y: Y, DROP_VY: VY, DROP_VH: VH } = TOURNEY, G = 9.81;
  const T = (VY + Math.sqrt(VY * VY + 2 * G * Y)) / G;   // time to the first bounce
  const back = VH * T + (spot.pond ? 0 : TOURNEY.ROLL);   // the bounce and roll carry it the last few metres
  return { x: spot.x - ux * back, y: Y, z: spot.z - uz * back, vx: ux * VH, vy: VY, vz: uz * VH };
}

// A return near (x, z)? returns: [{ x, z }] (the main return and any field returns).
export const atReturn = (x, z, returns) => (returns ?? []).some(r => Math.hypot(x - r.x, z - r.z) <= TOURNEY.BANK_R);

// ---- what you see and read ---------------------------------------------------------------------------------------
const clockOf = t => { const s = Math.max(0, Math.ceil(t ?? 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// The Board (builder 4's board.js / bvtext.js kpiNoteOf reads mods.tourney): "MEMBERS' TOURNAMENT · ●●○ · 0:22". One
// pip a ball in the flight: ● still out on the grass (or in the pond), ○ taken or gone. The clock is the longest left.
export function tourneyLine(snap) {
  const f = snap?.flight;
  if (!f || !f.pips) return null;
  return `MEMBERS' TOURNAMENT · ${[...f.pips].map(c => (c === '1' ? '●' : '○')).join('')} · ${clockOf(f.t)}`;
}
// The one centre ALERT a flight (through say.js / centre.js, priority 1).
export const FLIGHT_ALERT = ["Members' Tournament! Grab their balls first!", "Second flight! Grab the members' balls!"];
export const BONUS_ALERT = 'Bonus flight! The bell has spoken.';
export const flightAlert = (k, bonus = false) => (bonus ? BONUS_ALERT : FLIGHT_ALERT[Math.min(FLIGHT_ALERT.length - 1, k | 0)]);
export const CLEAN_LINE = 'Clean flight! The members are appalled.';   // the feed (not centre text)
export const CLAIM_LINE = 'The caddie cart took one. Kazoo.';          // the feed
// The morning memo's second line on the first Tournament day (builder 4's memoSecond `note` slot).
export const TOURNEY_MEMO = "Members' Tournament today. Site 13 entered anyway.";
// The carry chip / prompt (≤ 8 words): "Member's ball ×2 → a return".
export const carryLine = n => `Member's ball${n === 1 ? '' : 's'} ×${n} → a return`;
