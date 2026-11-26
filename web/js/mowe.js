// MOW-E, the Club's autonomous mower (council round 3, 3.5). Pure shared rules, no DOM.
// Gary's pattern: a scheduled mover with a telegraph. The twist: it helps (it rakes a lane
// of balls into a windrow) and it flattens anyone standing in the lane.
//
// State (plain JSON, safe to snapshot as-is except `hit`, use mowerSnap()):
//   { phase: 'warn'|'drive'|'done', t, lane, x, z, yaw, blocked, hit: [ids], raked: n }
// Space: the mower crosses +x at z = lane. Windrow goes to lane + RAKE_OFFSET (toward the mats).
import { clubOpen } from './clubdays.js';   // round 11: MOW-E from Club day 3

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

const rake = b => b && !b.sunk && !b.creek && !b.drift && !b.drifting && !b.treasure && b.kind !== 'one' && b.kind !== 'treasure';
const balls_ = balls => (balls instanceof Map ? [...balls.values()] : balls ? [...balls] : []);

// Should MOW-E start now? venueDay is 1-based days spent at this venue. Once a shift.
export function mowerDue({ venue, venueDay, shiftT, shiftSecs, mower, endless = false }) {
  return !mower && !endless && venue >= MOWER.FROM_VENUE && venueDay >= MOWER.FROM_DAY && clubOpen('mower', venue, venueDay) && shiftT >= shiftSecs * MOWER.AT;   // round 11: Club day 3
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

// =====================================================================================================================
// Council round 11 #1 (design/council-round11.md §2): "MOW-E Goes Rogue", the boss; the tame pet after it; and
// "MOW-E 2.0", the Stadium encore. A pure phase machine (no DOM, no RNG): server/crew.mjs stepMowe runs it, mower.js
// draws bossSnap / tameSnap. The legacy daily pass above stays for its tests and for BOSS.ON = 0 (the seam golden).
//
// Boss state (plain JSON): { kind: 'boss', phase: 'warn'|'harvest'|'hunt'|'plug'|'tamed'|'fled', t, ph, ft, cap, ... }
//   warn     15 s build-up in the shed (the PA, the Board countdown, the striped near lanes, speeding beeps)
//   harvest  a serpentine along the three near lanes at 3.5 m/s, eating resting balls within 3 m (up to 40 s)
//   hunt     from half HP (or 40 s): it hunts the nearest Rat on foot, re-aiming every 3 s, turning 120°/s
//   plug     at HP 0 it chokes: hold Use in the ring at its back (2.4 s ÷ min(3, holders)); 10 s idle reboots it at 1 HP
//   tamed    the win: it limps into the pond and sinks (s.out 'limp' → 'sink' → 'gone')
//   fled     the loss: the 100 s cap ran out, it drives home to the shed (s.out 'home' → 'gone')
// Yaw: as the legacy mower and the Rats (atan2(-dx, -dz)): forward is (-sin yaw, -cos yaw).
// =====================================================================================================================
const D2R = Math.PI / 180;
export const BOSS = {
  ON: 1,                    // 0: no boss and no tame pass, the legacy daily pass (the seam goldens' "boss off" run)
  CLUB: 1, STADIUM: 3,      // venue indices
  CLUB_DAY: 3,              // Club venue day 3 (its debut, CLUB_DAY.mower), then the rematch on the next Club day
  STADIUM_DAY: 2,           // the encore: the first Stadium day >= 2 that isn't Promotion Day
  AT: 0.30,                 // of the shift (126 s of 420)
  WARN: 15,                 // the build-up
  CAP: 100, REBOOT_CAP: 15, // the fight's cap (from the burst), and what a reboot adds
  LANES: [-14, -24, -36], X0: -36, X1: 56,          // the near lanes (z) and their run (x): all inside the 86 m hose
  BOX: { x0: -24, x1: 56, z0: -56, z1: -6 },        // where it may drive once out (clear of the mats, the pond, the creek, the rails)
  HOSE: { x: 36, z: 3, r: 80 },                      // ...and never past the washer's hose (86 m, less a margin)
  SEEK: 4, SEEK_R: 6,       // the harvest heads for the richest spot (most resting balls within 6 m), re-picked every 4 s
  SPILL: 12,                // a flattened Rat's pocket: at most this many go in the catcher (the rest spill as ever)
  SHED: { x: -58, z: 4 },   // MAP.MOWER_SHED
  POND: { x: -12, z: -78, r: 8 },   // MAP.POND (the win's cutscene; test/boss.test.mjs checks it matches)
  BURST: 7,                 // m/s out of the shed to the first lane
  SPEED: 3.5,               // m/s, the harvest (a walking Rat, 4.2, keeps up)
  EAT_R: 3,                 // m: every resting ball this close goes in the catcher
  CATCHER: 30,              // ...until it's full (the bag at its biggest): a win pays at most 60 balls from it
  HIT_SECS: 2,              // seconds of spray a hit (÷ the nozzle's washRate; several hosers add up; halved while stalled)
  REAR_COS: Math.cos(110 * D2R),   // the grille: the Rat must stand more than 110° off its nose
  BODY_R: 1.2,              // m, added to the wand's reach
  STAGGER: 1,               // s it stops after a hit
  VENT: 6, VENT_N: 2,       // s after a hit its grille is shut (smoke; +2 s a Rat past the first): spray lands, does nothing
  BOLT: 5.5, BOLT_SECS: 2.5,   // in the harvest a hit makes it bolt (after the stagger): the hosers must catch it again
  RAGE: 3,                  // s it revs and turns on the crew at the hunt's start (and a reboot): no damage
  STALL: 6, SHOVE: 4, SHOVE_MUD: 0.4, COOL: 8, CART_STOP: 3,   // a cart in front: 6 s stall, shoved 4 m aside, 8 s cooldown
  HARVEST_MAX: 40,
  REAIM: 3, TURN: 120 * D2R,
  KNOCK_R: 1.3, KNOCK_R_SOLO: 1.0, IMMUNE: 5,
  PLUG_SECS: 2.4, PLUG_MAX: 3, PLUG_IDLE: 10,
  RING_R: 1.25, RING_BACK: 2.4, RING_SLACK: 1.0,    // the ring is 2.5 m across, 2.4 m behind its centre (+1 m of slack)
  // The win: eaten ×2; a gold ball per Rat ("everyone grabs one", at most 5); Corporate's bounty, 10 × BV. Measured (bots,
  // design/round13-mowe.md): a 4P Club day-3 shift is ~575 ball-weights, so the council's 5 gold + 100 × BV alone was ~26 %.
  PAYX: 2, GOLD: 5, GOLD_R: 6, BOUNTY: 10,
  LIMP: 4, HOME: 5, SINK: 3, AFTER: 30,              // the outros (m/s, s) and how long the Board keeps the result
  ENCORE_HP: 1, ENCORE_SPEED: 1.1,
};
// The tame pet (§2.4): two passes a shift, at 25 % and 60 %, at every venue from the morning after the boss.
export const TAME = { AT: [0.25, 0.6], SPEED: 4, OUT: 7, HOME: 5, HALF: 3, GATHER_X: 1.5, STOP: 2.7, CREEP: 6, BEEP: 1.5 };

// The centre lines (each <= 8 words) and the memo's second lines. `btn` is the Use glyph ('Ⓐ', or 'Space').
export const BOSS_LINES = {
  loose: 'MOW-E is loose! Block it. Hose its back!',
  hunt: 'Now it hunts. Lead it into a cart!',
  plug: (btn = 'Ⓐ') => `Pull the plug! Hold ${btn} at its back!`,
  stamp: 'MOW-E TAMED',
  prompt: (btn = 'Ⓐ') => `Hold ${btn}: pull the plug`,
  back: 'Get behind it: hose the grille',
  eotm: 'MOW-E is Employee of the Month.',
  regards: 'MOW-E sends his regards.',
  warranty: "MOW-E's warranty expired. He's yours now.",
  kept: n => `MOW-E kept ${n} balls.`,
};

const clampN = n => Math.max(1, Math.min(6, Math.floor(Number(n) || 1)));
// §2.3: HP by crew size (solo and 2P 3, 3–4P 4, 5–6P 5) and the hunt's speed (4.0, 4.2, 4.4, 4.6, 4.8, 5.0 m/s).
export const crewHP = n => { n = clampN(n); return n <= 2 ? 3 : n <= 4 ? 4 : 5; };
export const huntSpeed = n => [4.0, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0][clampN(n)];

// Is today a boss day? 'club' (the fight or its rematch), 'encore' (MOW-E 2.0) or null. st: the save's
// { tame, lost, encore }. Never in endless, never on Promotion Day (the boss moves to the next eligible day).
export function bossDay({ venue, venueDay, endless = false, promo = false, st = null } = {}) {
  if (!BOSS.ON || endless || promo) return null;
  const s = st ?? {};
  if (venue === BOSS.CLUB && venueDay >= BOSS.CLUB_DAY && !s.tame && (s.lost ?? 0) < 2) return 'club';
  if (venue === BOSS.STADIUM && venueDay >= BOSS.STADIUM_DAY && !s.encore) return 'encore';
  return null;
}
// Should the boss start now? (Once a shift: `mower` is today's mower state, if any.)
export const bossDue = ({ shiftT, shiftSecs, mower = null, ...day }) => !mower && !!bossDay(day) && shiftT >= shiftSecs * BOSS.AT;

// The near lanes' serpentine: along -14, back along -24, along -36, back along -24, and round again.
const WP = (() => { const [a, b, c] = BOSS.LANES, { X0, X1 } = BOSS; return [[X0, a], [X1, a], [X1, b], [X0, b], [X0, c], [X1, c], [X1, b], [X0, b]].map(([x, z]) => ({ x, z })); })();
export const BOSS_PATH = WP;

export function newBoss({ n = 4, encore = false, lost = 0 } = {}) {
  n = clampN(n);
  const hpMax = Math.max(2, crewHP(n) + (encore ? BOSS.ENCORE_HP : -Math.min(1, lost | 0)));   // the rematch: "it's tired"
  const k = encore ? BOSS.ENCORE_SPEED : 1;
  return {
    kind: 'boss', encore: !!encore, n, phase: 'warn', t: BOSS.WARN, ph: 0, ft: 0, cap: BOSS.CAP, clock: 0,
    hp: hpMax, hpMax, speed: BOSS.SPEED * k, hunt: huntSpeed(n) * k, knockR: n === 1 ? BOSS.KNOCK_R_SOLO : BOSS.KNOCK_R,
    x: BOSS.SHED.x, z: BOSS.SHED.z, yaw: Math.atan2(-(WP[0].x - BOSS.SHED.x), -(WP[0].z - BOSS.SHED.z)),
    wp: 0, burst: true, eaten: 0, eatenW: 0, acc: 0, stagger: 0, stall: 0, stallCart: -1, cool: {},
    target: null, aimT: 0, aim: null, immune: {}, vent: 0, ventSecs: BOSS.VENT + BOSS.VENT_N * (n - 1), rage: 0, bolt: 0, seekT: 0, goal: null, plug: 0, idle: 0, holders: 0, ring: null, rebooted: 0,
    hits: 0, by: {}, knocks: 0, stalls: 0, out: null, sink: 0, moving: false,
  };
}

const fwd = s => ({ x: -Math.sin(s.yaw), z: -Math.cos(s.yaw) });
// Is the Rat at (x, z) in its rear arc (more than 110° off its nose)?
export function behind(s, p) {
  const dx = p.x - s.x, dz = p.z - s.z, d = Math.hypot(dx, dz);
  if (d < 0.3) return false;
  const f = fwd(s);
  return (f.x * dx + f.z * dz) / d < BOSS.REAR_COS;
}
// The plug ring: 2.4 m behind it.
export const ringOf = s => { const f = fwd(s); return { x: s.x - f.x * BOSS.RING_BACK, z: s.z - f.z * BOSS.RING_BACK }; };
export const inRing = (s, p) => !!s?.ring && Math.hypot(p.x - s.ring.x, p.z - s.ring.z) <= BOSS.RING_R + BOSS.RING_SLACK;
// What it may eat: a resting ground ball (not sunk, snagged, drifting, Ball No. 1, a treasure, nor a Rats-only souvenir/hazard).
export const eatable = b => !!b && b.rest && !b.sunk && !b.creek && !b.drift && !b.drifting && !b.treasure && !b.hands && !b.cup && b.kind !== 'one' && b.kind !== 'treasure';
const huntable = (s, r) => !!r && r.online !== false && !(r.down > 0) && !r.driving && !r.diving && !r.aloft && !((s.immune[r.id] ?? -1) > s.clock);
export const bossLive = s => !!s && s.kind === 'boss' && (s.phase === 'warn' || s.phase === 'harvest' || s.phase === 'hunt' || s.phase === 'plug');
export const bossFighting = s => !!s && s.kind === 'boss' && (s.phase === 'harvest' || s.phase === 'hunt');

function setPhase(s, ph, out) {
  s.phase = ph; s.ph = 0; if (out) out.phase = ph;
  if (ph === 'hunt') { s.aimT = 0; s.target = null; s.rage = BOSS.RAGE; s.acc = 0; }
  if (ph === 'plug') { s.plug = 0; s.idle = 0; s.stall = 0; s.stallCart = -1; s.stagger = 0; s.target = null; s.ring = ringOf(s); s.moving = false; }
  if (ph === 'tamed') { s.out = 'limp'; s.t = 0; s.ring = null; s.target = null; }
  if (ph === 'fled') { s.out = 'home'; s.t = 0; s.ring = null; s.target = null; s.stall = 0; s.stagger = 0; }
}

// Turn toward (tx, tz) at most `turn` rad/s, then roll forward. Returns the distance left.
function steer(s, tx, tz, speed, dt, turn = BOSS.TURN) {
  const dx = tx - s.x, dz = tz - s.z, d = Math.hypot(dx, dz);
  if (d > 1e-3) {
    let dy = Math.atan2(-dx, -dz) - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    s.yaw += Math.max(-turn * dt, Math.min(turn * dt, dy));
  }
  const f = fwd(s), step = speed * dt;
  s.x += f.x * step; s.z += f.z * step; s.moving = step > 0;
  return d;
}
// Straight there (the outros and the tame pass): face it and go. Returns true on arrival.
function driveTo(s, g, speed, dt, stop = 0.6) {
  const dx = g.x - s.x, dz = g.z - s.z, d = Math.hypot(dx, dz);
  if (d <= stop) { s.moving = false; return true; }
  s.yaw = Math.atan2(-dx, -dz);
  const step = Math.min(d, speed * dt);
  s.x += dx / d * step; s.z += dz / d * step; s.moving = true;
  return d - step <= stop;
}
const inBox = s => {
  const B = BOSS.BOX, H = BOSS.HOSE;
  s.x = Math.max(B.x0, Math.min(B.x1, s.x)); s.z = Math.max(B.z0, Math.min(B.z1, s.z));
  const dx = s.x - H.x, dz = s.z - H.z, d = Math.hypot(dx, dz);
  if (d > H.r) { s.x = H.x + dx / d * H.r; s.z = H.z + dz / d * H.r; }
};
const inArena = b => { const B = BOSS.BOX; return b.x >= B.x0 && b.x <= B.x1 && b.z >= B.z0 && b.z <= B.z1 && Math.hypot(b.x - BOSS.HOSE.x, b.z - BOSS.HOSE.z) <= BOSS.HOSE.r; };
// The harvest's goal: the resting ball in the arena with the most others within SEEK_R (ties: the nearest), or null.
export function richest(s, balls) {
  const bs = [];
  for (const b of balls instanceof Map ? balls.values() : balls ?? []) if (eatable(b) && inArena(b)) bs.push(b);
  let best = null, bn = 0, bd = Infinity;
  const R = BOSS.SEEK_R;
  for (const a of bs) {
    let n = 0;
    for (const b of bs) if (Math.abs(b.x - a.x) <= R && Math.abs(b.z - a.z) <= R && Math.hypot(b.x - a.x, b.z - a.z) <= R) n++;
    const d = Math.hypot(a.x - s.x, a.z - s.z);
    if (n > bn || (n === bn && d < bd)) { best = a; bn = n; bd = d; }
  }
  return best ? { x: best.x, z: best.z, n: bn } : null;
}
// The first cart (off its cooldown) within CART_STOP in front of it.
function blocker(s, carts) {
  const f = fwd(s);
  for (const c of carts ?? []) {
    if (!c || (s.cool[c.i] ?? -1) > s.clock) continue;
    const dx = c.x - s.x, dz = c.z - s.z;
    if (Math.hypot(dx, dz) < BOSS.CART_STOP && f.x * dx + f.z * dz > 0) return c;
  }
  return null;
}
// The shove after a stall: the cart goes SHOVE m sideways, away from its nose line (to whichever side it sat on).
function shoveOf(s, carts) {
  const c = (carts ?? []).find(k => k && k.i === s.stallCart);
  if (!c) return null;
  const f = fwd(s), px = -f.z, pz = f.x;   // a perpendicular
  const side = px * (c.x - s.x) + pz * (c.z - s.z) >= 0 ? 1 : -1;
  return { i: c.i, dx: px * side * BOSS.SHOVE, dz: pz * side * BOSS.SHOVE };
}
function pickPrey(s, rats) {
  let best = null, bd = Infinity;
  for (const r of rats) { if (!huntable(s, r)) continue; const d = Math.hypot(r.x - s.x, r.z - s.z); if (d < bd) { bd = d; best = r; } }
  return best;
}
const pondBank = s => {
  const P = BOSS.POND, dx = s.x - P.x, dz = s.z - P.z, d = Math.hypot(dx, dz) || 1;
  return { x: P.x + dx / d * (P.r - 1.5), z: P.z + dz / d * (P.r - 1.5) };
};

// Spray from a Rat on foot with the wand. secs: seconds of spray (crew.wash's clamp); rate: the nozzle's washRate;
// reach: the wand's reach. Returns { ok, why?, hit?, hp?, phase? }: ok false when it isn't hittable from there.
export function hoseBoss(s, rat, secs, { rate = 1, reach = 7 } = {}) {
  if (!bossFighting(s) || !(secs > 0)) return { ok: false, why: 'idle' };
  if (Math.hypot(rat.x - s.x, rat.z - s.z) > reach + BOSS.BODY_R) return { ok: false, why: 'far' };
  if (!behind(s, rat)) return { ok: false, why: 'front' };
  if (s.vent > 0 || s.rage > 0) return { ok: true, hit: false, why: 'shut' };   // the grille is shut: it lands, it does nothing
  s.acc += secs * rate * (s.stall > 0 ? 2 : 1);
  if (s.acc < BOSS.HIT_SECS) return { ok: true, hit: false };
  s.acc = 0; s.hp = Math.max(0, s.hp - 1); s.hits++; s.by[rat.id] = (s.by[rat.id] ?? 0) + 1;
  if (s.stall <= 0) { s.stagger = BOSS.STAGGER; if (s.phase === 'harvest') s.bolt = BOSS.BOLT_SECS; }
  s.vent = s.ventSecs ?? BOSS.VENT;
  const out = { ok: true, hit: true, hp: s.hp, phase: null };
  if (s.hp <= 0) setPhase(s, 'plug', out);
  else if (s.phase === 'harvest' && s.hp <= Math.ceil(s.hpMax / 2)) setPhase(s, 'hunt', out);
  return out;
}

// One tick. ctx: { balls (Map or array), rats: [{ id, x, z, down, driving, diving, aloft, online, holding }],
// carts: [{ i, x, z }], weigh: b => pay weight }. Mutates the boss only; returns what the crew applies:
//   eaten [ids] (delete them), knocked [ids] (the pocket goes in the catcher, then knockDown), phase (a change),
//   shove { i, dx, dz } (move that cart, +SHOVE_MUD), honk (a cart stalled it), target (the hunt picked a new Rat;
//   null: none; undefined: no change), reboot, sunk (the win's pond), home (the loss reached the shed).
export function stepBoss(s, dt, ctx = {}) {
  const out = { eaten: [], knocked: [], phase: null, shove: null, honk: false, target: undefined, reboot: false, sunk: false, home: false };
  if (!s || s.kind !== 'boss') return out;
  s.clock += dt;
  const rats = ctx.rats ?? [];
  if (s.phase === 'warn') {
    s.t -= dt;
    if (s.t <= 0) { s.t = 0; setPhase(s, 'harvest', out); }
    return out;
  }
  if (s.phase === 'plug') {
    const hold = rats.filter(r => r.holding && r.online !== false && !(r.down > 0) && !r.driving && !r.diving && inRing(s, r));
    s.holders = Math.min(BOSS.PLUG_MAX, hold.length);
    if (s.holders > 0) {
      s.idle = 0; s.plug = Math.min(1, s.plug + dt * s.holders / BOSS.PLUG_SECS);
      if (s.plug >= 1 - 1e-9) setPhase(s, 'tamed', out);
    } else if ((s.idle += dt) >= BOSS.PLUG_IDLE) {
      s.hp = 1; s.cap += BOSS.REBOOT_CAP; s.plug = 0; s.idle = 0; s.rebooted++; s.ring = null;
      setPhase(s, 'hunt', out); out.reboot = true;
    }
    return out;
  }
  if (s.phase === 'tamed' || s.phase === 'fled') {
    s.t += dt;
    if (s.out === 'limp') { if (driveTo(s, pondBank(s), BOSS.LIMP, dt, 0.4)) s.out = 'sink'; }
    else if (s.out === 'sink') { s.moving = false; s.sink = Math.min(1, s.sink + dt / BOSS.SINK); if (s.sink >= 1) { s.out = 'gone'; s.goneT = s.t; out.sunk = true; } }
    else if (s.out === 'home' && driveTo(s, BOSS.SHED, BOSS.HOME, dt, 0.8)) { s.out = 'gone'; s.goneT = s.t; out.home = true; }
    return out;
  }
  // harvest / hunt
  s.ft += dt; s.ph += dt;
  if (s.vent > 0) s.vent = Math.max(0, s.vent - dt);
  if (s.ft >= s.cap) { setPhase(s, 'fled', out); return out; }
  if (s.phase === 'harvest' && s.ph >= BOSS.HARVEST_MAX) setPhase(s, 'hunt', out);
  if (s.stall > 0) {
    s.moving = false;
    s.stall -= dt;
    if (s.stall <= 0) { s.stall = 0; out.shove = shoveOf(s, ctx.carts); s.cool[s.stallCart] = s.clock + BOSS.COOL; s.stallCart = -1; }
    return out;
  }
  if (s.stagger > 0) { s.moving = false; s.stagger = Math.max(0, s.stagger - dt); return out; }
  if (s.rage > 0) {   // it revs in place and swings round to the nearest Rat
    s.moving = false; s.rage = Math.max(0, s.rage - dt);
    const prey = pickPrey(s, rats);
    if (prey) { let dy = Math.atan2(-(prey.x - s.x), -(prey.z - s.z)) - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.yaw += Math.max(-BOSS.TURN * dt, Math.min(BOSS.TURN * dt, dy)); }
    return out;
  }
  if (!s.burst) {
    const c = blocker(s, ctx.carts);
    if (c) { s.stall = BOSS.STALL; s.stallCart = c.i; s.stalls++; s.moving = false; out.honk = true; return out; }
  }
  if (s.phase === 'hunt') {
    s.aimT -= dt;
    const cur = s.target != null ? rats.find(r => r.id === s.target) : null;
    if (!huntable(s, cur) || s.aimT <= 0) {
      const prey = pickPrey(s, rats), id = prey?.id ?? null;
      if (id !== s.target) out.target = id;
      s.target = id; s.aimT = BOSS.REAIM; s.aim = prey ? { x: prey.x, z: prey.z } : null;
    }
  }
  // Where to: the hunt's aim; the harvest's richest spot (re-picked every SEEK s, or on arrival); else the near lanes.
  if (s.phase === 'harvest' && !s.burst) {
    s.seekT -= dt;
    if (s.seekT <= 0 || !s.goal || Math.hypot(s.goal.x - s.x, s.goal.z - s.z) < 1.2) { s.goal = richest(s, ctx.balls); s.seekT = BOSS.SEEK; }
  }
  const bolt = s.bolt > 0; if (bolt) s.bolt = Math.max(0, s.bolt - dt);
  if (s.phase === 'hunt' && s.aim) { steer(s, s.aim.x, s.aim.z, s.hunt, dt); inBox(s); s.burst = false; }
  else if (s.phase === 'harvest' && !s.burst && s.goal) { steer(s, s.goal.x, s.goal.z, bolt ? BOSS.BOLT : s.speed, dt); inBox(s); }
  else {
    const w = WP[s.wp % WP.length];
    const d = steer(s, w.x, w.z, s.burst ? BOSS.BURST : s.phase === 'hunt' ? s.hunt : bolt ? BOSS.BOLT : s.speed, dt, s.burst ? Math.PI * 4 : BOSS.TURN);
    if (d < 1.5) { s.wp = (s.wp + 1) % WP.length; s.burst = false; }
    if (!s.burst) inBox(s);
  }
  // Eat.
  const weigh = ctx.weigh ?? (() => 1);
  const bs = ctx.balls instanceof Map ? ctx.balls.values() : ctx.balls ?? [];
  if (s.eaten < BOSS.CATCHER) for (const b of bs) {
    if (s.eaten >= BOSS.CATCHER) break;
    if (Math.abs(b.x - s.x) > BOSS.EAT_R || Math.abs(b.z - s.z) > BOSS.EAT_R || !eatable(b) || Math.hypot(b.x - s.x, b.z - s.z) > BOSS.EAT_R) continue;
    out.eaten.push(b.id); s.eaten++; s.eatenW += weigh(b);
  }
  // Knock.
  if (!s.burst) for (const r of rats) {
    if (!huntable(s, r) || Math.hypot(r.x - s.x, r.z - s.z) >= s.knockR) continue;
    out.knocked.push(r.id); s.knocks++; s.immune[r.id] = s.clock + BOSS.IMMUNE;
    if (s.target === r.id) { s.target = null; s.aimT = 0; s.aim = null; out.target = null; }
  }
  return out;
}

// The win's payout (§2.2): every eaten ball (spilled pockets included) ×2, as weight; five gold balls; the bounty.
export const bossPayout = s => ({ n: (s?.eaten ?? 0) * BOSS.PAYX, w: (s?.eatenW ?? 0) * BOSS.PAYX, gold: Math.min(BOSS.GOLD, s?.n ?? BOSS.GOLD), bounty: BOSS.BOUNTY });

const pips = (hp, max) => '■'.repeat(Math.max(0, hp)) + '□'.repeat(Math.max(0, max - hp));
const mmss = t => { const k = Math.max(0, Math.ceil(t)); return `${Math.floor(k / 60)}:${String(k % 60).padStart(2, '0')}`; };
// What the clients see.
export function bossSnap(s) {
  if (!s || s.kind !== 'boss') return null;
  return { kind: 'boss', encore: s.encore, phase: s.phase, t: s.t, x: s.x, z: s.z, yaw: s.yaw, hp: s.hp, hpMax: s.hpMax, eaten: s.eaten,
    stall: s.stall > 0, hit: s.stagger > 0, open: s.vent <= 0 && s.rage <= 0, rage: s.rage > 0, target: s.target, plug: s.plug, holders: s.holders, ring: s.ring, sink: s.sink, out: s.out,
    left: Math.max(0, s.cap - s.ft), hits: s.hits, moving: s.moving, final: !!s.final };
}
// The Board's banner. The encore's jumbotron is the HP bar.
export function bossBoard(s) {
  if (!s || s.kind !== 'boss') return null;
  const name = s.encore ? 'MOW-E 2.0' : 'MOW-E';
  const after = s.out !== 'gone' || s.t - (s.goneT ?? 0) < BOSS.AFTER;
  switch (s.phase) {
    case 'warn': return `${name} · ROGUE · ${mmss(s.t)}`;
    case 'harvest': case 'hunt': return s.encore ? `MOW-E 2.0 VS SITE 12 · ${pips(s.hp, s.hpMax)}` : `MOW-E · ${pips(s.hp, s.hpMax)} · ATE ${s.eaten}`;
    case 'plug': return `${name} · PULL THE PLUG`;
    case 'tamed': return after ? `${name} TAMED` : null;
    case 'fled': return after ? (s.encore ? 'MOW-E 2.0 WINS' : s.final ? 'MOW-E WINS · WARRANTY EXPIRED' : 'MOW-E WINS · REMATCH TOMORROW') : null;
    default: return null;
  }
}

// ---- the tame pet ---------------------------------------------------------------------------------------------------
// Which tame pass is due now (0 or 1), or -1. k: the passes already made this shift.
export function tameDue({ venue, endless = false, tame = false, shiftT, shiftSecs, k = 0 } = {}) {
  if (!BOSS.ON || !tame || endless || !(venue >= 1) || k >= TAME.AT.length) return -1;
  return shiftT >= shiftSecs * TAME.AT[k] ? k : -1;
}
// The richest of the six old lanes (ties: the first, so the pass draws no RNG).
export function newTame(balls, k = 0) {
  const lane = pickLane(balls, () => 0);
  return { kind: 'tame', k, phase: 'out', lane, x: BOSS.SHED.x, z: BOSS.SHED.z, yaw: -Math.PI / 2, load: 0, loadW: 0, blocked: false, blockT: 0, beepT: 0, moving: false };
}
// One tick of a pass: out of the shed to the lane, along it (gathering every resting ball within ±3 m as it passes),
// to the nearest owned return (bank them), back to the shed. It never knocks anyone down: it stops short of a Rat
// or a helper and beeps (after TAME.CREEP s it creeps on past, so a Rat standing still can't park it for ever).
// ctx: { balls, people: [{ x, z }], returnAt: (x, z) => { x, z }, weigh }. Returns { gathered [ids], bank { n, w } | null, beep, done }.
export function stepTame(s, dt, ctx = {}) {
  const out = { gathered: [], bank: null, beep: false, done: false };
  if (!s || s.kind !== 'tame' || s.phase === 'done') return out;
  const f = fwd(s);
  const block = (ctx.people ?? []).some(p => { const dx = p.x - s.x, dz = p.z - s.z; return Math.hypot(dx, dz) < TAME.STOP && f.x * dx + f.z * dz > 0; });
  if (block) s.blockT += dt; else s.blockT = 0;
  s.blocked = block && s.blockT < TAME.CREEP;
  if (s.blocked) { s.moving = false; if ((s.beepT -= dt) <= 0) { s.beepT = TAME.BEEP; out.beep = true; } return out; }
  s.beepT = 0;
  if (s.phase === 'out') { if (driveTo(s, { x: MOWER.X0, z: s.lane }, TAME.OUT, dt)) { s.phase = 'mow'; s.yaw = -Math.PI / 2; } }
  else if (s.phase === 'mow') {
    driveTo(s, { x: MOWER.X1, z: s.lane }, TAME.SPEED, dt);
    const weigh = ctx.weigh ?? (() => 1);
    const bs = ctx.balls instanceof Map ? ctx.balls.values() : ctx.balls ?? [];
    for (const b of bs) {
      if (Math.abs(b.z - s.lane) > TAME.HALF || Math.abs(b.x - s.x) > TAME.GATHER_X || !eatable(b)) continue;
      out.gathered.push(b.id); s.load++; s.loadW += weigh(b);
    }
    if (s.x >= MOWER.X1 - 0.6) s.phase = 'home';
  } else if (s.phase === 'home') {
    const r = ctx.returnAt?.(s.x, s.z) ?? { x: 27, z: 1.8 };
    if (driveTo(s, r, TAME.HOME, dt, 2.5)) { if (s.load > 0) out.bank = { n: s.load, w: s.loadW }; s.load = 0; s.loadW = 0; s.phase = 'shed'; }
  } else if (s.phase === 'shed' && driveTo(s, BOSS.SHED, TAME.OUT, dt, 0.8)) { s.phase = 'done'; out.done = true; s.moving = false; }
  return out;
}
export const tameSnap = s => s && s.kind === 'tame' ? { kind: 'tame', phase: s.phase, lane: s.lane, x: s.x, z: s.z, yaw: s.yaw, load: s.load, blocked: s.blocked, moving: s.moving } : null;
export const tameBoard = s => s && s.kind === 'tame' && (s.phase === 'mow' || s.phase === 'home') ? `MOW-E · BRINGING ${s.load} HOME` : null;

// Any mower state (the boss, the tame pass, or the legacy pass) to its snapshot and Board banner.
export const moweSnap = s => !s ? null : s.kind === 'boss' ? bossSnap(s) : s.kind === 'tame' ? tameSnap(s) : mowerSnap(s);
export const moweBoard = s => !s ? null : s.kind === 'boss' ? bossBoard(s) : s.kind === 'tame' ? tameBoard(s) : mowerBoard(s);

// The save's `mowe`: { tame, lost (0–2), encore, memo? } (an old save: untamed, no losses, no encore).
const MEMOS = [BOSS_LINES.eotm, BOSS_LINES.regards, BOSS_LINES.warranty];
export function cleanMowe(o) {
  const lost = Math.max(0, Math.min(2, Math.floor(Number(o?.lost) || 0)));
  const memo = MEMOS.includes(o?.memo) ? o.memo : null;
  return { tame: o?.tame === true || lost >= 2, lost, encore: o?.encore === true, ...(memo ? { memo } : {}) };
}
