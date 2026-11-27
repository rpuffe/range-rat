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
//   plug     at HP 0 it chokes and crawls home: hold Use in the ring at its back (a tug-of-war, round 12); 10 s idle reboots it
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
  EAT_R: 3,                 // m: a resting ball this close can go in the catcher...
  EAT_EVERY: 0.6, GRAZE: 0.35,           // ...one every 0.6 s (council round 12 #5c: an unblocked harvest fills 30 in ~18 s; a block shrinks it)
  CATCHER: 30,              // ...until it's full (the bag at its biggest): a win fountains at most 30 MOW-E balls (×2 each)
  HIT_SECS: 2,              // seconds of spray that fill YOUR meter (÷ the nozzle's washRate; twice as fast while stalled)
  // Council round 12 #1a: each Rat has their own hit meter (no shared vent). A full meter is your hit, and YOUR nozzle
  // cools 8 s. Two or more Rats spraying it at once fill ×1.25 (crossfire). After any hit, 1 s where no meter fills.
  // A meter unsprayed for 1 s drains 0.5/s. The harvest's bolt fires at most once every 8 s.
  COOL_ME: 8, CROSSFIRE: 1.25, CROSS_WIN: 0.4, STAGGER_ALL: 1.0, DECAY: 0.5, DECAY_AFTER: 1, BOLT_COOL: 8,
  REAR_COS: Math.cos(110 * D2R),   // the grille: the Rat must stand more than 110° off its nose
  BODY_R: 1.2,              // m, added to the wand's reach
  STAGGER: 1,               // s it stops after a hit
  BOLT: 5.5, BOLT_SECS: 2.5,   // in the harvest a hit makes it bolt (after the stagger): the hosers must catch it again
  RAGE: 3,                  // s it revs and turns on the crew at the hunt's start (and a reboot): no damage
  STALL: 6, SHOVE: 4, SHOVE_MUD: 0.4, COOL: 8, CART_STOP: 3,   // a cart in front: 6 s stall, shoved 4 m aside, 8 s cooldown
  // Round 12 #1b, by crew size [-, 1P, 2P, 3P, 4P, 5P, 6P]: HP (crewHP) and the seconds of spray a hit (meterSecs, ÷ washRate).
  // The council's 3/4/6/7 with a 2 s meter gave 4P fights of 26–35 s (bots): per-Rat meters make the crew's damage scale
  // with its size, so 3P+ get more pips and a bigger meter (design/round14-mowe.md has the sweep).
  HP_BY_N: [3, 3, 4, 9, 12, 13, 14],
  METER_BY_N: [2, 2, 2, 3, 4, 4, 4],
  HARVEST_MAX: 40,
  REAIM: 3, TURN: 120 * D2R,
  KNOCK_R: 1.3, KNOCK_R_SOLO: 1.0, IMMUNE: 5,
  PLUG_IDLE: 10,
  // Council round 12 #1c, the plug as a tug-of-war: it crawls home at 1 m/s dragging the ring; the bar fills at
  // (holders ÷ crew online) ÷ 3 s; every 1.5 s it yanks (0.5 m, and −0.06 unless half the crew holds); nobody holding
  // drains 0.1/s. A Rat holding in the ring walks at 2 m/s (the client's cap).
  PULL_SECS: 3, CRAWL: 1.0, CRAWL_TURN: 25 * D2R, YANK: 1.5, YANK_LOSS: 0.06, YANK_JERK: 0.5, PULL_DRAIN: 0.1, HOLD_WALK: 2.0,
  RING_R: 1.25, RING_BACK: 2.4, RING_SLACK: 1.0,    // the ring is 2.5 m across, 2.4 m behind its centre (+1 m of slack)
  // The win (council round 12 #5b): the catcher bursts on the spot, every eaten ball a resting MOW-E ball worth ×2
  // within FOUNT_R of the ring (the bell banks leftovers ×1); a gold ball per Rat (at most 5) within GOLD_R of the ring;
  // Corporate's bounty, 10 × BV.
  PAYX: 1.5, GOLD: 5, GOLD_R: 6, FOUNT_R: 8, BOUNTY: 10,   // council round 13 #3d: the fountain ×2 → ×1.5 (BURST_MULT)
  CATCHER_3P: 24,           // council round 13 #3d: the catcher's cap at 3P+ (4P medians were still 14 % at ×1.5)
  PROMO_AT: 180 / 420,      // council round 13 #3c: MOW-E 2.0 crashes Promotion Day at T−4:00 (after the ceremony's morning)
  STANDS_EXIT: { x: -78, z: -70 },   // ...and, lost, drives off through the left stands (it took the bunting)
  LIMP: 6, LIMP_SECS: 8.5, HOME: 5, SINK: 3, AFTER: 30,   // the outros (m/s; the limp speeds up to reach the pond in 8.5 s)
  ENCORE_HP: 1, ENCORE_SPEED: 1.1,
};
// The tame pet, at every venue from the morning after the boss. Council round 12 #5d: three passes a shift (20 %, 45 %,
// 70 %), each to the field's richest spot (a RUN m drive either side of it, gathering ±HALF m, up to CAP a pass), then
// the nearest return. Plus the whistle: once a shift, Use at the MOW-E post by the return sends a bonus pass now.
// Council round 13 #5b: two smaller passes (30 %, 65 %) of 12; the whistle is where the pet's value lives.
export const TAME = { AT: [0.3, 0.65], SPEED: 4, OUT: 7, HOME: 5, HALF: 4, GATHER_X: 1.5, STOP: 2.7, CREEP: 6, BEEP: 1.5,
  CAP: 12, RUN: 25, BOX: { x0: -60, x1: 60, z0: -180, z1: -10 } };
// Council round 13 #5a, the whistle on a lanyard: Use at the post takes it (one Rat carries it, like the wand); Use out in
// the field (MIN_D m or more from the nearest return) blows it, and MOW-E mows a STRIP.W × STRIP.L strip through that spot
// toward the return, up to CAP balls. Once a shift.
// Lead's call (round 13): solo, the strip holds CAP_1P (the pet stays <= 8 % of a solo crew's balls); MOW-E sets out from the
// post (by the return), not the shed, so it can beat a member ball's 30 s clock.
export const WHISTLE = { POST: { x: 31.5, z: 1.2 }, R: 2.2, CARRY: true, MIN_D: 20, STRIP: { W: 10, L: 30 }, CAP: 30, CAP_1P: 14, MEMBER_AHEAD: 8 };
export const whistleCap = n => (n | 0) <= 1 ? WHISTLE.CAP_1P : WHISTLE.CAP;
export const BURST_MULT = BOSS.PAYX;

// The centre lines (each <= 8 words) and the memo's second lines. `btn` is the Use glyph ('Ⓐ', or 'Space').
export const BOSS_LINES = {
  loose: 'MOW-E is loose! Block it. Hose its back!',
  hunt: 'Now it hunts. Lead it into a cart!',
  huntSolo: 'Step aside, then hose its back!',   // council round 13 #3e: a crew of 1–2 learns the sidestep
  plug: (btn = 'Ⓐ') => `Pull the plug! Hold ${btn} at its back!`,
  stamp: 'MOW-E TAMED',
  stamp2: 'MOW-E 2.0 TAMED',                     // #3c: the Promotion Day crash, won
  lostStamp: 'MOW-E WINS',                       // #3a: the TAMED stamp's twin, red
  lost: 'MOW-E got away. Rematch tomorrow.',     // #3a: the one line after the loss stamp
  lostLater: 'MOW-E got away. For now.',         //      ...when tomorrow isn't a Club boss day
  crash: 'MOW-E heard about the ceremony.',      // #3c: the crash's PA caption (pa.js 'crash')
  crashLeft: 'MOW-E 2.0 left. It took the bunting.',   // #3c: the crash, lost (promotion still stands)
  prompt: (btn = 'Ⓐ') => `Hold ${btn}: pull the plug`,
  back: 'Get behind it: hose the grille',
  eotm: 'MOW-E is Employee of the Month.',
  regards: 'MOW-E sends his regards. Whistle at the post.',   // #5c
  warranty: "MOW-E's warranty expired. He's yours now.",
  kept: n => `MOW-E kept ${n} balls.`,
  whistle: (btn = 'Ⓐ') => `${btn}: take MOW-E's whistle`,   // #5a: at the post
  blow: (btn = 'Ⓐ') => `${btn}: whistle MOW-E here`,         // #5a: out in the field, carrying it
  // #5c, the feed (edge text)
  took: name => `${name} has the whistle.`,
  blew: name => `${name} whistled. MOW-E's on his way.`,
  brought: n => `MOW-E brought ${n} home.`,
  // #3b, the report's Tomorrow line
  eve: 'Tomorrow: MOW-E finishes its update.',
  rematchEve: "Tomorrow: MOW-E's rematch. Wands at the bell.",
};

const clampN = n => Math.max(1, Math.min(6, Math.floor(Number(n) || 1)));
// Council round 12 #1b: HP by crew size (1P 3, 2P 4, 3P 9, 4P 12, 5P 13, 6P 14), so a 4P fight is long enough to share;
// the hunt's speed (4.0, 4.2, 4.4, 4.6, 4.8, 5.0 m/s).
export const crewHP = n => BOSS.HP_BY_N[clampN(n)];
export const meterSecs = n => BOSS.METER_BY_N[clampN(n)] ?? BOSS.HIT_SECS;
export const huntSpeed = n => [4.0, 4.0, 4.2, 4.4, 4.6, 4.8, 5.0][clampN(n)];

// Is today a boss day? 'club' (the fight or its rematch), 'encore' (MOW-E 2.0) or null. st: the save's
// { tame, lost, encore }. Never in endless, never on Promotion Day (the boss moves to the next eligible day).
// Council round 13 #3c: a Stadium Promotion Day with the encore unplayed is MOW-E 2.0's crash.
export function bossDay({ venue, venueDay, endless = false, promo = false, st = null } = {}) {
  if (!BOSS.ON || endless) return null;
  const s = st ?? {};
  if (promo) return venue === BOSS.STADIUM && venueDay >= BOSS.STADIUM_DAY && !s.encore ? 'encore' : null;   // as the encore: no tame needed (a crew promoted past the Club untamed still meets it)
  if (venue === BOSS.CLUB && venueDay >= BOSS.CLUB_DAY && !s.tame && (s.lost ?? 0) < 2) return 'club';
  if (venue === BOSS.STADIUM && venueDay >= BOSS.STADIUM_DAY && !s.encore) return 'encore';
  return null;
}
// When the warn comes (s into the shift): BOSS.AT of it; the crash (Promotion Day) at PROMO_AT, after the ceremony's morning.
export const bossAt = (shiftSecs, promo = false) => shiftSecs * (promo ? BOSS.PROMO_AT : BOSS.AT);
// Should the boss start now? (Once a shift: `mower` is today's mower state, if any.)
export const bossDue = ({ shiftT, shiftSecs, mower = null, ...day }) => !mower && !!bossDay(day) && shiftT >= bossAt(shiftSecs, !!day.promo);
// Council round 13 #3c: is today's boss the Promotion Day crash?
export const isCrash = day => !!day.promo && bossDay(day) === 'encore';
// Council round 13 #3f: the boss owns the screen from the warn to the stamp (builder 3's centre.js mutes the nags).
export const bossOwnsScreen = s => bossLive(s);

// The near lanes' serpentine: along -14, back along -24, along -36, back along -24, and round again.
const WP = (() => { const [a, b, c] = BOSS.LANES, { X0, X1 } = BOSS; return [[X0, a], [X1, a], [X1, b], [X0, b], [X0, c], [X1, c], [X1, b], [X0, b]].map(([x, z]) => ({ x, z })); })();
export const BOSS_PATH = WP;

export function newBoss({ n = 4, encore = false, lost = 0, crash = false } = {}) {
  n = clampN(n);
  const hpMax = Math.max(2, crewHP(n) + (encore ? BOSS.ENCORE_HP : -Math.min(1, lost | 0)));   // the rematch: "it's tired"
  const k = encore ? BOSS.ENCORE_SPEED : 1;
  return {
    kind: 'boss', encore: !!encore, crash: !!(encore && crash), lostN: encore ? 0 : lost | 0, n, phase: 'warn', t: BOSS.WARN, ph: 0, ft: 0, cap: BOSS.CAP, clock: 0,
    catcher: n >= 3 ? BOSS.CATCHER_3P : BOSS.CATCHER,   // council round 13 #3d: 24 at 3P+ (the payout trim)
    hp: hpMax, hpMax, meterSecs: meterSecs(n), speed: BOSS.SPEED * k, hunt: huntSpeed(n) * k, knockR: n === 1 ? BOSS.KNOCK_R_SOLO : BOSS.KNOCK_R,
    x: BOSS.SHED.x, z: BOSS.SHED.z, yaw: Math.atan2(-(WP[0].x - BOSS.SHED.x), -(WP[0].z - BOSS.SHED.z)),
    wp: 0, burst: true, eaten: 0, eatenW: 0, eatT: BOSS.EAT_EVERY, stagger: 0, stall: 0, stallCart: -1, cool: {},
    target: null, aimT: 0, aim: null, immune: {}, rage: 0, bolt: 0, boltNext: 0, seekT: 0, goal: null,
    meter: {}, coolMe: {}, sprayAt: {}, allUntil: 0,   // round 12 #1a: per-Rat meters (id → 0..1), cooled-until, last spray, the global stagger
    plug: 0, idle: 0, holders: 0, crew: n, ring: null, ring0: null, yankT: 0, yanks: 0, limp: BOSS.LIMP, rebooted: 0,
    hits: 0, by: {}, knocks: 0, stalls: 0, out: null, sink: 0, moving: false,
  };
}
// Round 12 #1a: is that Rat's nozzle cooling? Seconds left (0: no).
export const coolLeft = (s, id) => Math.max(0, (s?.coolMe?.[id] ?? 0) - (s?.clock ?? 0));
// Is anyone else spraying it right now (crossfire)? A cooled Rat's spray doesn't count.
function crossfire(s, id) {
  for (const k in s.sprayAt) if (k !== String(id) && s.sprayAt[k] >= s.clock - BOSS.CROSS_WIN && !(coolLeft(s, k) > 0)) return true;
  return false;
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
  if (ph === 'plug') { s.plug = 0; s.idle = 0; s.stall = 0; s.stallCart = -1; s.stagger = 0; s.target = null; s.ring = ringOf(s); s.ring0 = { ...s.ring }; s.yankT = 0; s.moving = false; }
  if (ph === 'tamed') {
    s.burstAt = s.ring ? { ...s.ring } : ringOf(s);   // round 12 #5b: where the catcher bursts and the gold lands
    const b = pondBank(s); s.limp = Math.max(BOSS.LIMP, Math.hypot(b.x - s.x, b.z - s.z) / BOSS.LIMP_SECS);   // the splash is in ~9 s
    s.out = 'limp'; s.t = 0; s.ring = null; s.target = null;
  }
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
export function richest(s, balls, within = inArena) {
  const bs = [];
  for (const b of balls instanceof Map ? balls.values() : balls ?? []) if (eatable(b) && within(b)) bs.push(b);
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
// Round 12 #1a: the spray fills THAT Rat's meter (cool: your nozzle is cooling; stagger: the 1 s after any hit; fill:
// it counted, cross: with crossfire).
export function hoseBoss(s, rat, secs, { rate = 1, reach = 7 } = {}) {
  if (!bossFighting(s) || !(secs > 0)) return { ok: false, why: 'idle' };
  if (Math.hypot(rat.x - s.x, rat.z - s.z) > reach + BOSS.BODY_R) return { ok: false, why: 'far' };
  if (!behind(s, rat)) return { ok: false, why: 'front' };
  const id = rat.id;
  if (s.rage > 0) return { ok: true, hit: false, why: 'shut' };   // it revs and turns: the grille is shut
  if (coolLeft(s, id) > 0) return { ok: true, hit: false, why: 'cool' };   // your nozzle sputters grey
  s.sprayAt[id] = s.clock;
  if (s.clock < s.allUntil) return { ok: true, hit: false, why: 'stagger' };
  const cross = crossfire(s, id);
  s.meter[id] = (s.meter[id] ?? 0) + secs * rate * (s.stall > 0 ? 2 : 1) * (cross ? BOSS.CROSSFIRE : 1) / (s.meterSecs ?? BOSS.HIT_SECS);
  if (s.meter[id] < 1 - 1e-9) return { ok: true, hit: false, fill: true, cross };
  s.meter[id] = 0; s.coolMe[id] = s.clock + BOSS.COOL_ME; s.allUntil = s.clock + BOSS.STAGGER_ALL;
  s.hp = Math.max(0, s.hp - 1); s.hits++; s.by[id] = (s.by[id] ?? 0) + 1;
  if (s.stall <= 0) {
    s.stagger = BOSS.STAGGER;
    if (s.phase === 'harvest' && s.clock >= s.boltNext) { s.bolt = BOSS.BOLT_SECS; s.boltNext = s.clock + BOSS.BOLT_COOL; }
  }
  const out = { ok: true, hit: true, fill: true, cross, hp: s.hp, phase: null };
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
  const out = { eaten: [], knocked: [], phase: null, shove: null, honk: false, target: undefined, reboot: false, sunk: false, home: false, yank: false };
  if (!s || s.kind !== 'boss') return out;
  s.clock += dt;
  const rats = ctx.rats ?? [];
  if (s.phase === 'warn') {
    s.t -= dt;
    if (s.t <= 0) { s.t = 0; setPhase(s, 'harvest', out); }
    return out;
  }
  if (s.phase === 'plug') {   // round 12 #1c: the tug-of-war
    let online = 0, hold = 0;
    for (const r of rats) {
      if (r.online === false) continue;
      online++;
      if (r.holding && !(r.down > 0) && !r.driving && !r.diving && inRing(s, r)) hold++;
    }
    online = Math.max(1, online); s.holders = hold; s.crew = online;
    // It crawls home, dragging the ring, and lurches every YANK s.
    steer(s, BOSS.SHED.x, BOSS.SHED.z, BOSS.CRAWL, dt, BOSS.CRAWL_TURN); inBox(s);
    if ((s.yankT += dt) >= BOSS.YANK) {
      s.yankT -= BOSS.YANK; s.yanks++; out.yank = true;
      const f = fwd(s); s.x += f.x * BOSS.YANK_JERK; s.z += f.z * BOSS.YANK_JERK; inBox(s);
      if (hold * 2 < online) s.plug = Math.max(0, s.plug - BOSS.YANK_LOSS);
    }
    s.ring = ringOf(s);
    if (hold > 0) {
      s.idle = 0; s.plug = Math.min(1, s.plug + dt * hold / online / BOSS.PULL_SECS);
      if (s.plug >= 1 - 1e-9) setPhase(s, 'tamed', out);
    } else {
      s.plug = Math.max(0, s.plug - BOSS.PULL_DRAIN * dt);
      if ((s.idle += dt) >= BOSS.PLUG_IDLE) {
        s.hp = 1; s.cap += BOSS.REBOOT_CAP; s.plug = 0; s.idle = 0; s.rebooted++; s.ring = null;
        setPhase(s, 'hunt', out); out.reboot = true;
      }
    }
    return out;
  }
  if (s.phase === 'tamed' || s.phase === 'fled') {
    s.t += dt;
    // Round 12 #5b: the pond event (and its PA) is the splash, the moment it reaches the bank.
    if (s.out === 'limp') { if (driveTo(s, pondBank(s), s.limp ?? BOSS.LIMP, dt, 0.4)) { s.out = 'sink'; s.splashT = s.t; out.sunk = true; } }
    else if (s.out === 'sink') { s.moving = false; s.sink = Math.min(1, s.sink + dt / BOSS.SINK); if (s.sink >= 1) { s.out = 'gone'; s.goneT = s.t; } }
    else if (s.out === 'home' && driveTo(s, s.crash ? BOSS.STANDS_EXIT : BOSS.SHED, BOSS.HOME, dt, 0.8)) { s.out = 'gone'; s.goneT = s.t; out.home = true; }   // round 13 #3c: the crash leaves through the stands
    return out;
  }
  // harvest / hunt
  s.ft += dt; s.ph += dt;
  // #1a: no banking a meter across a bolt. Only in the harvest (where it bolts): in the hunt the hunted Rat sprays in
  // bursts between dodges, and a solo Rat is always the one hunted (measured: decay there lost 1p-chase its fights).
  if (s.phase === 'harvest') for (const k in s.meter) if (s.meter[k] > 0 && s.clock - (s.sprayAt[k] ?? -1e9) > BOSS.DECAY_AFTER) s.meter[k] = Math.max(0, s.meter[k] - BOSS.DECAY * dt);
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
  else if (s.phase === 'harvest' && !s.burst && s.goal) { steer(s, s.goal.x, s.goal.z, bolt ? BOSS.BOLT : s.grazing ? s.speed * BOSS.GRAZE : s.speed, dt); inBox(s); }
  else {
    const w = WP[s.wp % WP.length];
    const d = steer(s, w.x, w.z, s.burst ? BOSS.BURST : s.phase === 'hunt' ? s.hunt : bolt ? BOSS.BOLT : s.speed, dt, s.burst ? Math.PI * 4 : BOSS.TURN);
    if (d < 1.5) { s.wp = (s.wp + 1) % WP.length; s.burst = false; }
    if (!s.burst) inBox(s);
  }
  // Eat: round 12 #5c, the nearest resting ball within EAT_R, one every EAT_EVERY s (it never banks a backlog).
  // While there's something to eat in reach, the harvest slows to graze (GRAZE): a window to hose it, or block it.
  s.eatT = Math.min(BOSS.EAT_EVERY, (s.eatT ?? BOSS.EAT_EVERY) + dt); s.grazing = false;
  if (s.eaten < (s.catcher ?? BOSS.CATCHER)) {
    const bs = ctx.balls instanceof Map ? ctx.balls.values() : ctx.balls ?? [];
    let best = null, bd = Infinity;
    for (const b of bs) {
      if (Math.abs(b.x - s.x) > BOSS.EAT_R || Math.abs(b.z - s.z) > BOSS.EAT_R || !eatable(b)) continue;
      const d = Math.hypot(b.x - s.x, b.z - s.z);
      if (d <= BOSS.EAT_R && d < bd) { bd = d; best = b; }
    }
    s.grazing = !!best;
    if (best && s.eatT >= BOSS.EAT_EVERY - 1e-9) { out.eaten.push(best.id); s.eaten++; s.eatenW += (ctx.weigh ?? (() => 1))(best); s.eatT = 0; }
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
  // Round 12 #1a: meters { id: [fill 0..1, cooling s] } (each Rat's crosshair ring); full: the fullest live meter (the grille's glow).
  let meters = null, full = 0;
  if (bossFighting(s)) {
    meters = {};
    for (const k in s.meter) { const c = coolLeft(s, k); meters[k] = [Math.round(s.meter[k] * 100) / 100, Math.round(c * 10) / 10]; if (!(c > 0)) full = Math.max(full, s.meter[k]); }
    for (const k in s.coolMe) if (!(k in meters) && coolLeft(s, k) > 0) meters[k] = [0, Math.round(coolLeft(s, k) * 10) / 10];
  }
  return { kind: 'boss', encore: s.encore, phase: s.phase, t: s.t, x: s.x, z: s.z, yaw: s.yaw, hp: s.hp, hpMax: s.hpMax, eaten: s.eaten,
    stall: s.stall > 0, hit: s.stagger > 0, open: s.rage <= 0 && s.clock >= (s.allUntil ?? 0), rage: s.rage > 0, target: s.target, plug: s.plug, holders: s.holders, crew: s.crew, ring: s.ring, sink: s.sink, out: s.out,
    left: Math.max(0, s.cap - s.ft), hits: s.hits, moving: s.moving, final: !!s.final, meters, full: Math.round(full * 100) / 100, yanks: s.yanks ?? 0,
    crash: !!s.crash, lostN: s.lostN ?? 0, rev: s.phase === 'hunt' && s.rage <= 0 && s.stall <= 0 && s.aimT > 0 && s.aimT <= REV };   // council round 13: the crash, the scoreline, the rev puff
}
// Round 12 #5a: the boss morning, from the bell to the warn: the Board's update bar and the near lanes' stripes.
// shiftT: seconds into the shift. Returns { kind: 'update', pct } until the warn, else null.
// Council round 13 #3c: promo (the crash): the bar runs to PROMO_AT and the Board reads PROMOTION DAY · MOW-E 2.0 UPDATE.
export function updateSnap(day, shiftT, shiftSecs, promo = false) {
  if (!day || !(shiftSecs > 0)) return null;
  const at = bossAt(shiftSecs, promo);
  return shiftT < at ? { kind: 'update', pct: Math.max(0, Math.min(1, shiftT / at)), ...(promo ? { crash: true } : {}) } : null;
}
export const updateBoard = u => {
  const k = Math.max(0, Math.min(1, u?.pct ?? 0));
  if (u?.crash) { const n = Math.min(3, Math.floor(k * 3 + 0.5)); return `PROMOTION DAY · MOW-E 2.0 UPDATE ${'▓'.repeat(n)}${'░'.repeat(3 - n)}`; }
  const n = Math.min(4, Math.floor(k * 4 + 0.5));
  return `MOW-E UPDATE ${'▓'.repeat(n)}${'░'.repeat(4 - n)} ${Math.floor(k * 100)} %`;
};
// The Board's banner. The encore's jumbotron is the HP bar.
export function bossBoard(s) {
  if (!s || s.kind !== 'boss') return null;
  const name = s.encore ? 'MOW-E 2.0' : 'MOW-E';
  const after = s.out !== 'gone' || s.t - (s.goneT ?? 0) < BOSS.AFTER;
  switch (s.phase) {
    case 'warn': return `${name} · ROGUE · ${mmss(s.t)}`;
    case 'harvest': case 'hunt': return s.encore ? `MOW-E 2.0 VS SITE 12 · ${pips(s.hp, s.hpMax)}` : `MOW-E · ${pips(s.hp, s.hpMax)} · ATE ${s.eaten}`;
    case 'plug': { const n = Math.min(4, Math.floor((s.plug ?? 0) * 4 + 1e-9)); return `PULL! ${'■'.repeat(n)}${'□'.repeat(4 - n)}`; }   // round 12 #1c
    case 'tamed': return after ? `${name} TAMED` : null;
    // 9.11; council round 13 #3a: after the loss the scoreline stays up until the rematch's morning.
    case 'fled': return after ? (s.encore ? 'MOW-E 2.0 WINS' : s.final ? 'MOW-E WINS · WARRANTY EXPIRED' : 'MOW-E WINS · REMATCH NEXT CLUB DAY') : s.encore || s.final ? null : scoreBoard(s.lostN ?? 1);
    default: return null;
  }
}
// Council round 13 #3a: the Board's scoreline after a loss ("MOW-E 1 · CREW 0").
export const scoreBoard = lost => `MOW-E ${Math.max(1, lost | 0)} · CREW 0`;

// ---- council round 13 #3a/#3b: the loss path, told -----------------------------------------------------------------
// Will tomorrow be the rematch? A loss that isn't the second (final), not the encore, and a card that can't be signed or
// turn into Promotion Day by tomorrow (rows: goals.js rowsOf; "near": every goal but the reviews and the live fee done,
// and the reviews row at most 2 short; then the line hedges with "For now", which is never false).
export function promoNear(rows) {
  if (!rows?.length) return false;
  const r = rows.find(x => x.kind === 'reviews');
  if (r && !r.done && r.need - r.have > 2) return false;
  return rows.every(x => x.done || x === r || (x.kind === 'fee' && !(x.need > 0 && x.have < x.need * 0.6)));
}
export const rematchNext = ({ encore = false, final = false, rows = null } = {}) => !encore && !final && !promoNear(rows);
// The one centre line after the loss stamp.
export const lostLine = ({ encore = false, crash = false, rematch = false } = {}) => encore && crash ? BOSS_LINES.crashLeft : rematch ? BOSS_LINES.lost : BOSS_LINES.lostLater;
// The stamp: won or lost, the Club fight or MOW-E 2.0.
export const stampText = ({ won = true, encore = false } = {}) => won ? (encore ? BOSS_LINES.stamp2 : BOSS_LINES.stamp) : encore ? 'MOW-E 2.0 WINS' : BOSS_LINES.lostStamp;
// The report's MOW-E row (above the goals), from endShift's report.mowe: { won, n, gold } or { won: false, kept, rematch }.
export function moweRow(r) {
  if (!r) return null;
  const name = r.encore ? 'MOW-E 2.0' : 'MOW-E';
  if (r.won) return `${name}: tamed · ${r.n ?? 0} balls · ${r.gold ?? 0} gold`;
  return `${name}: got away · kept ${r.kept ?? 0} balls · ${r.encore ? 'took the bunting' : r.rematch ? 'rematch tomorrow' : r.final ? 'warranty expired' : 'for now'}`;
}
// #3b: the report's Tomorrow line for MOW-E, ahead of Gary's: the boss eve and the rematch eve. next: bossDay() for
// tomorrow (its venueDay + 1, promo false: a Promotion Day's line replaces this one at the bell); st: the save's mowe.
export const moweEve = (next, st) => next === 'club' ? ((st?.lost ?? 0) > 0 ? BOSS_LINES.rematchEve : BOSS_LINES.eve) : null;

// ---- council round 13 #3e: teach the sidestep -----------------------------------------------------------------------
// Which way to dodge: perpendicular to its heading, toward the side the Rat is already on (+1: its right, i.e. the
// direction (-fwd.z, fwd.x)... see sidestep()). Returns the world-space unit vector to step along.
export function sidestep(s, p) {
  const f = fwd(s), px = -f.z, pz = f.x;   // a perpendicular to the heading
  const k = px * (p.x - s.x) + pz * (p.z - s.z) >= 0 ? 1 : -1;
  return { x: px * k, z: pz * k };
}
// The re-aim's tell: the rev puff comes REV s before each 3 s re-aim in the hunt.
export const REV = 0.5;

// ---- the tame pet ---------------------------------------------------------------------------------------------------
// Which tame pass is due now (0 or 1), or -1. k: the passes already made this shift.
export function tameDue({ venue, endless = false, tame = false, shiftT, shiftSecs, k = 0 } = {}) {
  if (!BOSS.ON || !tame || endless || !(venue >= 1) || k >= TAME.AT.length) return -1;
  return shiftT >= shiftSecs * TAME.AT[k] ? k : -1;
}
// Round 12 #5d: the pass seeks the field's richest spot (richest(), inside TAME.BOX; no RNG) and mows a RUN m drive
// either side of it along x, clipped to the box and kept out of the pond. No spot: the richest of the six old lanes.
// bonus: the whistle's pass (it doesn't use up a scheduled one).
const inTameBox = b => { const B = TAME.BOX, P = BOSS.POND; return b.x >= B.x0 && b.x <= B.x1 && b.z >= B.z0 && b.z <= B.z1 && Math.hypot(b.x - P.x, b.z - P.z) > P.r + 1; };
export function tameRun(balls) {
  const spot = richest({ x: 0, z: -40 }, balls, inTameBox);
  const z = spot ? spot.z : pickLane(balls, () => 0);
  let x0 = spot ? spot.x - TAME.RUN : MOWER.X0, x1 = spot ? spot.x + TAME.RUN : MOWER.X1;
  x0 = Math.max(TAME.BOX.x0, x0); x1 = Math.min(TAME.BOX.x1, x1);
  const P = BOSS.POND, w = Math.abs(z - P.z) < P.r + 2 ? Math.sqrt(Math.max(0, (P.r + 2) ** 2 - (z - P.z) ** 2)) : 0;
  if (w > 0 && P.x + w > x0 && P.x - w < x1) {   // the drive would cross the pond: keep the spot's side
    if (spot && spot.x >= P.x) x0 = Math.max(x0, P.x + w); else x1 = Math.min(x1, P.x - w);
  }
  return { z, x0, x1: Math.max(x0 + 4, x1), spot: spot ? { x: spot.x, z: spot.z, n: spot.n } : null };
}
export function newTame(balls, k = 0, { bonus = false } = {}) {
  const r = tameRun(balls);
  return { kind: 'tame', k, bonus, phase: 'out', lane: r.z, x0: r.x0, x1: r.x1, spot: r.spot, x: BOSS.SHED.x, z: BOSS.SHED.z, yaw: -Math.PI / 2, load: 0, loadW: 0, blocked: false, blockT: 0, beepT: 0, moving: false };
}
// Council round 13 #5a: the whistle's strip, STRIP.L long through `at` (the whistler, server-positioned) toward `ret` (the
// nearest return), STRIP.W wide: a = the far end (MOW-E drives there first), b = the end nearer the return.
export function whistleStrip(at, ret) {
  const dx = ret.x - at.x, dz = ret.z - at.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d, h = WHISTLE.STRIP.L / 2;
  return { at: { x: at.x, z: at.z }, a: { x: at.x - ux * h, z: at.z - uz * h }, b: { x: at.x + ux * h, z: at.z + uz * h } };
}
// Is (x, z) inside the strip (for a test, the bots and builder 2's member balls)?
export function inStrip(st, p) {
  const L = Math.hypot(st.b.x - st.a.x, st.b.z - st.a.z) || 1, ux = (st.b.x - st.a.x) / L, uz = (st.b.z - st.a.z) / L;
  const dx = p.x - st.a.x, dz = p.z - st.a.z, al = dx * ux + dz * uz;
  return al >= -TAME.GATHER_X && al <= L + TAME.GATHER_X && Math.abs(dx * uz - dz * ux) <= WHISTLE.STRIP.W / 2;
}
// May the carrier blow here? MIN_D m or more from the nearest return (ret).
export const canBlow = (p, ret) => !!p && !!ret && Math.hypot(p.x - ret.x, p.z - ret.z) >= WHISTLE.MIN_D;
export function newWhistlePass(at, ret, k = 0, n = 4) {
  const strip = whistleStrip(at, ret);
  return { kind: 'tame', k, bonus: true, whistle: true, strip, cap: whistleCap(n), phase: 'out', lane: strip.at.z, x0: Math.min(strip.a.x, strip.b.x), x1: Math.max(strip.a.x, strip.b.x),
    spot: { x: at.x, z: at.z, n: 0 }, x: WHISTLE.POST.x, z: WHISTLE.POST.z, yaw: Math.PI, load: 0, loadW: 0, blocked: false, blockT: 0, beepT: 0, moving: false };
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
  const X0 = s.x0 ?? MOWER.X0, X1 = s.x1 ?? MOWER.X1;
  const st = s.strip;   // council round 13 #5a: the whistle's strip, A (the far end) → B (toward the return)
  if (st && s.phase === 'out') { if (driveTo(s, st.a, TAME.OUT, dt)) s.phase = 'mow'; }
  else if (st && s.phase === 'mow') {
    const arrived = driveTo(s, st.b, TAME.SPEED, dt, 0.4);
    const L = Math.hypot(st.b.x - st.a.x, st.b.z - st.a.z) || 1, ux = (st.b.x - st.a.x) / L, uz = (st.b.z - st.a.z) / L;
    const prog = (s.x - st.a.x) * ux + (s.z - st.a.z) * uz + TAME.GATHER_X;
    const weigh = ctx.weigh ?? (() => 1), cap = s.cap ?? WHISTLE.CAP;
    const bs = ctx.balls instanceof Map ? ctx.balls.values() : ctx.balls ?? [];
    for (const b of bs) {
      if (s.load >= cap) break;
      const dx = b.x - st.a.x, dz = b.z - st.a.z, al = dx * ux + dz * uz;
      if (al < -TAME.GATHER_X || Math.abs(dx * uz - dz * ux) > WHISTLE.STRIP.W / 2) continue;
      // Builder 2's member ball: fetched as his (crew.mods.signal) once the mowing is within MEMBER_AHEAD m of it (the
      // whistler stands on it, and MOW-E stops short of a Rat: the strip covering it is what counts).
      if (b.member != null) { if (al <= prog + WHISTLE.MEMBER_AHEAD && !b.sunk && !b.carried && !(s.members ??= []).includes(b.id)) { s.members.push(b.id); (out.members ??= []).push(b.id); } continue; }
      if (al > prog) continue;
      if (!eatable(b)) continue;
      out.gathered.push(b.id); s.load++; s.loadW += weigh(b);
    }
    if (arrived || s.load >= cap) s.phase = 'home';
  }
  else if (s.phase === 'out') { if (driveTo(s, { x: X0, z: s.lane }, TAME.OUT, dt)) { s.phase = 'mow'; s.yaw = -Math.PI / 2; } }
  else if (s.phase === 'mow') {
    driveTo(s, { x: X1, z: s.lane }, TAME.SPEED, dt);
    const weigh = ctx.weigh ?? (() => 1);
    const bs = ctx.balls instanceof Map ? ctx.balls.values() : ctx.balls ?? [];
    for (const b of bs) {
      if (s.load >= TAME.CAP) break;
      if (Math.abs(b.z - s.lane) > TAME.HALF || Math.abs(b.x - s.x) > TAME.GATHER_X || !eatable(b)) continue;
      out.gathered.push(b.id); s.load++; s.loadW += weigh(b);
    }
    if (s.x >= X1 - 0.6 || s.load >= TAME.CAP) s.phase = 'home';
  } else if (s.phase === 'home') {
    const r = ctx.returnAt?.(s.x, s.z) ?? { x: 27, z: 1.8 };
    if (driveTo(s, r, TAME.HOME, dt, 2.5)) { if (s.load > 0) out.bank = { n: s.load, w: s.loadW }; s.load = 0; s.loadW = 0; s.phase = 'shed'; }
  } else if (s.phase === 'shed' && driveTo(s, BOSS.SHED, TAME.OUT, dt, 0.8)) { s.phase = 'done'; out.done = true; s.moving = false; }
  return out;
}
export const tameSnap = s => s && s.kind === 'tame' ? { kind: 'tame', phase: s.phase, lane: s.lane, x: s.x, z: s.z, yaw: s.yaw, load: s.load, blocked: s.blocked, moving: s.moving, bonus: !!s.bonus } : null;
export const tameBoard = s => s && s.kind === 'tame' && (s.phase === 'mow' || s.phase === 'home') ? `MOW-E · BRINGING ${s.load} HOME`
  : s && s.kind === 'tame' && s.bonus && s.phase === 'out' ? 'MOW-E · ON HIS WAY' : null;

// Round 12 #5d, the whistle: once a shift, at the MOW-E post, on a day the pet works (tamed, not endless, no boss today).
export const atPost = p => !!p && Math.hypot(p.x - WHISTLE.POST.x, p.z - WHISTLE.POST.z) <= WHISTLE.R;
export const whistleOpen = ({ tame = false, endless = false, venue = 0, boss = false } = {}) => !!BOSS.ON && tame && !endless && venue >= 1 && !boss;

// Any mower state (the boss, the tame pass, the legacy pass, or the boss morning's update) to its snapshot and Board banner.
export const moweSnap = s => !s ? null : s.kind === 'boss' ? bossSnap(s) : s.kind === 'tame' ? tameSnap(s) : s.kind === 'update' ? s : mowerSnap(s);
export const moweBoard = s => !s ? null : s.kind === 'boss' ? bossBoard(s) : s.kind === 'tame' ? tameBoard(s) : s.kind === 'update' ? updateBoard(s) : mowerBoard(s);

// The save's `mowe`: { tame, lost (0–2), encore, memo? } (an old save: untamed, no losses, no encore).
const MEMOS = [BOSS_LINES.eotm, BOSS_LINES.regards, BOSS_LINES.warranty];
export function cleanMowe(o) {
  const lost = Math.max(0, Math.min(2, Math.floor(Number(o?.lost) || 0)));
  const memo = MEMOS.includes(o?.memo) ? o.memo : null;
  return { tame: o?.tame === true || lost >= 2, lost, encore: o?.encore === true, ...(o?.beat === true ? { beat: true } : {}), ...(memo ? { memo } : {}) };   // beat: won since Gary's last Club verdict
}
