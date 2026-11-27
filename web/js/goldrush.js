// Council round 14 #1 (builder 2): the Gold Rush, the first hour's sprint. Pure: no THREE, no DOM, no sim.js import (the
// server module, the view, the bots and the tests share it).
//
// On Muni day 3 (the day the gold arrives) and again on Club day 2 (the Club's gold day, the pond's first), Site 13's
// delivery van backs up to the fence and dumps a crate of gold balls over it. Each lands on the field under a short gold
// beam with a clock (30 s, 40 s solo). A Rat picks one up (it rides in their hands: b.hands, so no machine, helper or
// mower takes it) and walks it to any return: an ordinary gold ball (KIND_W.gold, ×10), no new pay rule. A ball still
// out when its clock runs out is claimed by Site 13's cart ("For research."). At the Club, at 3P+, one ball lands in the
// pond (a diver's job): the diver's bag pays it as the gold ball it is.
// It's the Tournament's grammar (beams, a clock, a rival cart, carry to a return), two venues before it matters. The
// spots come from hash32(day, vday, 'rush', j, k): no RNG draw, so the seam's Muni days 1-2 don't move.
import { MAP } from './map.js';
import { hash32 } from './today.js';
import { clearSpot } from './tourney.js';

export const RUSH = {
  MUNI: { VENUE: 0, DAY: 3, AT: 255 },   // Muni day 3, T-2:45 (after the DAY3 mats nudge at 210 s)
  CLUB: { VENUE: 1, VDAY: 2, AT: 240 },  // Club day 2 (CLUB_DAY.gold, the pond's first day), T-3:00
  FULL: 420,                    // the shift the AT times are written for (a short shift keeps the seconds-left)
  DODGE: 20,                    // s: the drop keeps this clear of a deal (Last Call, the cleanup): tourney.js flightTimes's rule
  MIN_AT: 30,                   // a short shift whose rush would land in its first 30 s has none (the morning is the memo's)
  SECS: 30, SECS_1P: 40,        // each ball's clock, from the drop
  N: [3, 3, 3, 4, 4, 4],        // balls a wave, by crew size 1..6. The council's 1P 2 measured 0.71 calls a minute on Muni day 3
                                // (bar 0.8); 3, all within PAIR_1P of the first, gives one Rat one trip (design/round16-peaks.md)
  NEAR: 45, FAR: 110,           // m out from the mats (z -45 .. -110)
  X: 50, MID: 8,                // |x| of a spot: MID..X, alternating sides
  APART: 12,                    // spots keep this far apart
  PAIR_1P: 30,                  // solo: every later ball lands within this of the first (one Rat takes them all)
  POND_FROM: 3,                 // at the Club, from this crew size one ball lands in the pond
  DROP_Y: 24, DROP_VY: -4, DROP_VH: 4, ROLL: 6,   // the drop: lofted in over the fence (tourney.js dropShot's shape)
  VAN: { x: -66, z: -28 },      // where Site 13's van backs up: outside the left net, by the gate end of the field
  BANK_R: 3.5,                  // SIM.STAND_REACH, as the Tournament's
  DROPPED_SECS: 12,             // a knocked-down carrier's rush ball goes back on the clock for at least this
  GARY_PAD: 5,                  // on a Club Gary day the wave's clocks run out this long before his warn
  CART_SECS: 6,                 // the view: Site 13's cart hums out for the last 6 s of a clock
};

const clampN = n => Math.max(1, Math.min(RUSH.N.length, n | 0 || 1));
export const rushN = n => RUSH.N[clampN(n) - 1];
export const rushSecs = n => ((n | 0) <= 1 ? RUSH.SECS_1P : RUSH.SECS);
export const rushPond = (n, venue) => venue === 1 && (n | 0) >= RUSH.POND_FROM;

// Which rush is today: 'muni' | 'club' | null. Never endless, a boss day, Promotion Day or a reveal morning; never a Gary
// day at the Muni. Club day 2 is usually Gary's (a visit due on the reveal morning slips a day, garyvisit.js), so there the
// rush runs ahead of his warn instead (rushTime's garyAt).
export function rushDay({ venue, day, venueDay, endless = false, promo = false, boss = false, gary = false, reveal = false } = {}) {
  if (endless || promo || boss || reveal) return null;
  if (venue === RUSH.MUNI.VENUE && (day | 0) === RUSH.MUNI.DAY) return gary ? null : 'muni';
  if (venue === RUSH.CLUB.VENUE && (venueDay | 0) === RUSH.CLUB.VDAY) return 'club';
  return null;
}

// The drop's shiftT on a shift of `secs`, kept DODGE s clear of `deals` (shiftT of Last Call and the cleanup): earlier
// first, as the Tournament's flights. null when it would land in the first MIN_AT s (a short test shift).
// garyAt (shiftT of Gary's warn, on a Club Gary day): the whole wave, clock included, is done GARY_PAD s before it.
export function rushTime(which, secs = RUSH.FULL, deals = [], garyAt = null, clock = RUSH.SECS) {
  const at0 = which === 'club' ? RUSH.CLUB.AT : which === 'muni' ? RUSH.MUNI.AT : null;
  if (at0 == null) return null;
  let at = secs - (RUSH.FULL - at0);
  const near = t => deals.some(d => Math.abs(t - d) < RUSH.DODGE - 1e-9);
  if (near(at)) {
    const clash = deals.find(d => Math.abs(at - d) < RUSH.DODGE - 1e-9), early = clash - RUSH.DODGE, late = clash + RUSH.DODGE;
    at = !near(early) ? early : late;
  }
  if (garyAt != null) at = Math.min(at, garyAt - clock - RUSH.GARY_PAD);
  return at >= RUSH.MIN_AT && at < secs ? at : null;
}

const r2 = v => Math.round(v * 100) / 100;
const FALLBACK = [{ x: -30, z: -70 }, { x: 30, z: -60 }, { x: -24, z: -96 }, { x: 36, z: -92 }];

// The wave's landing spots: [{ x, z, pond, side }]. Alternating sides, starting left; solo, every later one within PAIR_1P
// m of the first; at the Club at 3P+ the last one is in the pond. hash32(day, vday, 'rush', j, k): no RNG draw.
export function rushSpots(day, vday, n = 4, venue = 0) {
  const N = rushN(n), pond = rushPond(n, venue), land = pond ? N - 1 : N, out = [];
  const ok = (x, z) => clearSpot(x, z) && out.every(o => Math.hypot(o.x - x, o.z - z) >= RUSH.APART);
  for (let j = 0; j < land; j++) {
    const side = j % 2 === 0 ? -1 : 1;
    let spot = null;
    for (let k = 0; k < 60 && !spot; k++) {
      const h = hash32(day | 0, vday | 0, 'rush', j, k);
      let x, z;
      if ((n | 0) <= 1 && j > 0) {               // the solo pair: one Rat, two balls, "drop the hose, go now"
        const a = (h % 3600) / 3600 * Math.PI * 2, r = RUSH.APART + 1 + (((h >>> 12) % 1000) / 1000) * (RUSH.PAIR_1P - RUSH.APART - 2);
        x = out[0].x + Math.cos(a) * r; z = out[0].z + Math.sin(a) * r;
      } else {
        z = -(RUSH.NEAR + ((h % 1009) / 1008) * (RUSH.FAR - RUSH.NEAR));
        x = side * (RUSH.MID + (((h >>> 11) % 1009) / 1008) * (RUSH.X - RUSH.MID));
      }
      if (ok(x, z)) spot = { x, z };
    }
    if (!spot) {
      const f = (n | 0) <= 1 && j > 0 ? { x: out[0].x + (out[0].x < 0 ? 16 : -16), z: out[0].z } : null;
      spot = f && clearSpot(f.x, f.z) ? f : FALLBACK.find(c => out.every(o => Math.hypot(o.x - c.x, o.z - c.z) >= RUSH.APART)) ?? FALLBACK[j % FALLBACK.length];
    }
    out.push({ x: r2(spot.x), z: r2(spot.z), pond: false, side: Math.sign(spot.x) || side });
  }
  if (pond) {
    const h = hash32(day | 0, vday | 0, 'rushp'), P = MAP.POND;
    const a = (h % 3600) / 3600 * Math.PI * 2, r = (((h >>> 12) % 1000) / 1000) * (P.r - 3);
    out.push({ x: r2(P.x + Math.cos(a) * r), z: r2(P.z + Math.sin(a) * r), pond: true, side: 1 });
  }
  return out;
}

// The drop: lofted in from the van's side of the field, aimed so it comes to rest on the spot (a pond ball splashes in on
// it). Returns the spawn { x, y, z, vx, vy, vz }.
export function rushShot(spot) {
  const dx = spot.x - RUSH.VAN.x, dz = spot.z - RUSH.VAN.z, L = Math.hypot(dx, dz) || 1, ux = dx / L, uz = dz / L;
  const { DROP_Y: Y, DROP_VY: VY, DROP_VH: VH } = RUSH, G = 9.81;
  const T = (VY + Math.sqrt(VY * VY + 2 * G * Y)) / G;
  const back = VH * T + (spot.pond ? 0 : RUSH.ROLL);
  return { x: spot.x - ux * back, y: Y, z: spot.z - uz * back, vx: ux * VH, vy: VY, vz: uz * VH };
}

// ---- what you see and read ---------------------------------------------------------------------------------------
const clockOf = t => { const s = Math.max(0, Math.ceil(t ?? 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// The Board (builder 4's board.js reads mods.goldrush): "GOLD RUSH · ●●○ · 0:22". ● still out, ○ taken or gone.
export function rushLine(snap) {
  if (!snap?.pips) return null;
  return `GOLD RUSH · ${[...snap.pips].map(c => (c === '1' ? '●' : '○')).join('')} · ${clockOf(snap.t)}`;
}
export const RUSH_ALERT = "Gold Rush! Beat Site 13's cart!";          // the one centre ALERT (5 words)
const RUSH_CLAIM_LINE = 'Site 13 took one. For research.';     // the feed, merged per wave
export const rushClaimLine = k => ((k | 0) <= 1 ? RUSH_CLAIM_LINE : `Site 13 took ${k | 0}. For research.`);
export const RUSH_SWEEP_LINE = 'Clean sweep. Site 13 is furious.';    // the feed: every ball banked
export const RUSH_EVE = 'Tomorrow: a Gold Rush. Gold balls, worth ten.';   // tomorrowText's Muni day-3 eve (builder 4)
// The report row (reportRows): "Gold Rush: 3 of 4 · +$214", or "Site 13 took all 4. For research."
export function rushRow({ n = 0, got = 0, cash = 0 } = {}) {
  if (!(n > 0)) return null;
  if (!(got > 0)) return { text: `Site 13 took all ${n}. For research.` };
  return { text: `Gold Rush: ${got} of ${n} · +$${Math.round(cash).toLocaleString('en-US')}`, cash: Math.round(cash) };
}
export const rushCarryLine = n => `Gold ball${n === 1 ? '' : 's'} ×${n} → a return`;   // the HUD prompt, not centre text
