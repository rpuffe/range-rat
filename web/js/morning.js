// The morning deal (owner playtest 3 §3.4; council 9 Q1): every morning, at every venue, each online Rat is dealt
// one opening line from what is actually short, nearest first, in the nudge slot. It clears once the job is done or
// after MORNING.SECS of working time. Day 1's checklist keeps precedence. Pure: no THREE, no DOM. The server side is
// server/venues/nudge.mjs (it builds the plain `view` below from the crew); main.js shows it through nudgeLine().
// Nudge ids: 'am:<job>'.
import { FIXTURE_BY_ID, FRIES, POND, SIM, BUCKETS, BAYS } from './sim.js';
import { GOALS, dealGoal, dealLine } from './goals.js';   // council round 10 #1: the goal card joins the deal
import { MAP } from './map.js';
import { FILL_POINT } from './layout.js';
import { bossLive } from './mowe.js';   // council round 11 8.5: the deal stands down while the boss is live

export const MORNING = {
  SECS: 45,       // the line goes after 45 s of working time (counted from NUDGE.WAIT, like the day-2 deal)
  DIRTY: 0.3,     // a sign, return or mat over this is short...
  CLEAN: 0.1,     // ...and done at this or under
  FRIES: 0.5,     // fries stock under half: short
  POND: 0.9,      // pond clarity under this: short
  CROWD: 0.6,     // the Stadium's live crowd under this: short ("cold"); done at it
};

// Council round 12, 9.4 (C #10): the checklist (and the nudge slot) flickered up between two centre texts. It stays
// down while a centre text shows or waits (say.js's queue, the story card's next beat), and for QUIET s after the last.
// st: { lastBusy } (the caller's, starts at -Infinity). Returns true when the slot may show now.
export const CHECK = { QUIET: 1.0 };
export function checkGate(st, { busy = false, waiting = false, t = 0 } = {}) {
  if (busy || waiting) { st.lastBusy = t; return false; }
  return t - (st.lastBusy ?? -Infinity) >= CHECK.QUIET;
}

// Every line is ≤ 7 words (§8). The sign, return and mats reuse the rally's and the day-3 lines.
export const MORNING_TEXT = {
  basket: 'Fill the bucket basket!',
  sign: 'The sign is filthy. Hose it!',
  stand: 'The return is filthy. Hose it!',
  mats: 'Keep the mats clean.',
  fries: 'Fries went cold. Peel!',
  pond: "The pond's full. Dive!",
  deck: "The deck's open. Pour the first round!",
  crowd: "Crowd's cold. Lap the Ping Track!",
  strays: 'Strays in the Yards. Sweep them!',
  debris: 'Debris overnight. Ride the Lift!',
};

// Where each job is (the yellow arrow, and "nearest first").
export const MORNING_AT = {
  basket: { x: FILL_POINT.x, z: FILL_POINT.z, y: 2.2 },
  sign: { x: FIXTURE_BY_ID.sign.x, z: FIXTURE_BY_ID.sign.z, y: 3.4 },
  stand: { x: SIM.STAND.x, z: SIM.STAND.z, y: 2.6 },
  mats: { x: 0, z: 0, y: 2.2 },
  fries: { x: FRIES.SHED.x, z: FRIES.SHED.z, y: 2.6 },
  pond: { x: POND.DOCK.x, z: POND.DOCK.z, y: 2.2 },
  deck: { x: FRIES.SHED.x, z: FRIES.SHED.z, y: 2.6 },   // the beer comes from the kitchen
  crowd: { x: MAP.TRACK.x, z: MAP.TRACK.z + MAP.TRACK.b, y: 2.6 },
  strays: { x: (MAP.YARDS.xMin + MAP.YARDS.xMax) / 2, z: (MAP.YARDS.FENCES[0] + MAP.YARDS.FENCES[1]) / 2, y: 3 },
  debris: { x: MAP.LIFT.x, z: MAP.LIFT.z, y: 3 },
};

// ---- Council round 10 #1: the goal card in the deal ---------------------------------------------------------------
// When a feature goal is open, ONE Rat can be dealt "Goal: 12 more hot dogs." (the open goal nearest done), below the
// venue's own short jobs: only a Rat the jobs leave over gets it (every short job keeps its Rat). Never over the
// day-1 checklist (nudge.mjs deals nothing while it's up). The nudge id carries the goal and what's left:
// 'am:goal:<goalId>:<left>', so the line counts down live.
export const GOAL_AT = {
  bank: { x: SIM.STAND.x, z: SIM.STAND.z, y: 2.6 }, huddle: { x: SIM.STAND.x, z: SIM.STAND.z, y: 2.6 },
  seal: { x: SIM.STAND.x, z: SIM.STAND.z, y: 2.6 }, pass: { x: SIM.STAND.x, z: SIM.STAND.z, y: 2.6 },
  fed: { x: FRIES.SHED.x, z: FRIES.SHED.z, y: 2.6 }, orders: { x: FRIES.SHED.x, z: FRIES.SHED.z, y: 2.6 },
  treasures: { x: POND.DOCK.x, z: POND.DOCK.z, y: 2.2 },
  targets: { x: BAYS[0].x, z: BAYS[0].z, y: 2.2 }, pings: { x: BAYS[0].x, z: BAYS[0].z, y: 2.2 },
  laps: { x: MAP.TRACK.x, z: MAP.TRACK.z + MAP.TRACK.b, y: 2.6 },
  strays: { x: (MAP.YARDS.xMin + MAP.YARDS.xMax) / 2, z: (MAP.YARDS.FENCES[0] + MAP.YARDS.FENCES[1]) / 2, y: 3 },
  lift: { x: MAP.LIFT.x, z: MAP.LIFT.z, y: 3 }, debris: { x: MAP.LIFT.x, z: MAP.LIFT.z, y: 3 },
};
export const goalJob = rows => dealGoal(rows);
export const goalNudgeId = r => (r ? 'am:goal:' + r.id + ':' + Math.max(0, r.need - r.have) : null);
const goalOf = id => {
  const [, , gid, left] = id.split(':');
  const d = GOALS[gid];
  return d ? { id: gid, kind: d.kind, need: Math.max(0, Number(left) || 0), have: 0 } : null;
};

// view: { venue, basket, fixtures: { id: mud }, nMats, shed, fries, pondOpen, clarity, deck, crowd, strays, debris }
// (null / undefined: that venue doesn't have it). Is job `id` short right now?
const matsMax = v => { let m = 0; for (let i = 0; i < (v.nMats ?? 10); i++) m = Math.max(m, v.fixtures?.['mat' + i] ?? 0); return m; };
export function morningShort(id, v) {
  switch (id) {
    case 'basket': return (v.basket ?? 0) < (v.basketCap ?? BUCKETS.BASKET);   // round 11: Ball Shortage's 6
    case 'sign': case 'stand': return (v.fixtures?.[id] ?? 0) > MORNING.DIRTY;
    case 'mats': return matsMax(v) > MORNING.DIRTY;
    case 'fries': return !!v.shed && (v.fries ?? 0) < FRIES.MAX * MORNING.FRIES;
    case 'pond': return !!v.pondOpen && v.clarity != null && v.clarity < MORNING.POND;
    case 'deck': return !!v.deck;
    case 'crowd': return v.crowd != null && v.crowd < MORNING.CROWD;
    case 'strays': return (v.strays ?? 0) > 0;
    case 'debris': return (v.debris ?? 0) > 0;
    default: return false;
  }
}
// Is a dealt job done? (Hosing goes to CLEAN, not just under DIRTY; the deck once the first round is poured.)
export function morningDone(id, v) {
  switch (id) {
    case 'sign': case 'stand': return (v.fixtures?.[id] ?? 0) <= MORNING.CLEAN;
    case 'mats': return matsMax(v) <= MORNING.DIRTY;
    case 'deck': return !!v.poured;
    default: return !morningShort(id, v);
  }
}

// The pool by venue (§3.4): the Muni's four, the Club adds the kitchen and the pond, Tiered the deck, then each later
// venue its own gauge line (the basket, the fixtures, the kitchen and the pond stay in the pool everywhere).
export function morningPool(venue) {
  const pool = ['basket', 'sign', 'stand', 'mats'];
  if (venue >= 1) pool.push('fries', 'pond');
  if (venue >= 2) pool.push('deck');
  if (venue === 3) pool.push('crowd');
  if (venue === 4) pool.push('strays');
  if (venue === 5) pool.push('debris');
  return pool;
}
export const morningJobs = v => morningPool(v.venue ?? 0).filter(id => morningShort(id, v));

// Council round 11 8.5 (C #4): at the game's climax and during the boss, nobody is told to fill the basket. The morning
// deal, the day's suggestions and their re-deals stand down while Ball No. 1 is down, carried or in the huddle, and
// while MOW-E's boss fight is live (warn → plug). Gary's own lines are never stood down (he never visits then).
export const LB_LIVE = ['down', 'carried', 'huddle'];
export const standDown = ({ lastBucket = null, mower = null } = {}) => LB_LIVE.includes(lastBucket?.phase) || bossLive(mower);

// Deal jobs round the crew, nearest first: the closest (Rat, job) pair, then the next closest among the rest, until
// every job has a Rat; more Rats than jobs go round the jobs again (nearest). rats: [{ id, x, z }]. { ratId: jobId }.
export function dealMorning(jobs, rats) {
  const out = {};
  if (!jobs.length) return out;
  const d = (r, j) => Math.hypot(r.x - MORNING_AT[j].x, r.z - MORNING_AT[j].z);
  let left = [...rats];
  while (left.length) {
    const open = [...jobs];
    while (open.length && left.length) {
      let best = null;
      for (const r of left) for (const j of open) if (!best || d(r, j) < best.d) best = { r, j, d: d(r, j) };
      out[best.r.id] = best.j;
      left.splice(left.indexOf(best.r), 1); open.splice(open.indexOf(best.j), 1);
    }
  }
  return out;
}

export const morningLine = id => (id?.startsWith('am:goal:') ? dealLine(goalOf(id)) : id?.startsWith('am:') ? MORNING_TEXT[id.slice(3)] ?? null : null);
export const morningTarget = id => {
  if (id?.startsWith('am:goal:')) { const at = GOAL_AT[id.split(':')[2]]; return at ? { ...at, s: 1 } : null; }   // a purchase: the shop is a menu
  return id?.startsWith('am:') ? (({ x, z, y }) => ({ x, z, y, s: 1 }))(MORNING_AT[id.slice(3)] ?? {}) : null;
};
