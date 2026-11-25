// First-time tips for new things (owner notes, 2026-11-24): the context settings.js's hinter needs to decide
// them, and a soft pointer at the thing a tip names (main.js reuses the day-1 yellow arrow for it).
// Pure: no three, no DOM (test/tips.test.mjs).
import { FIXTURES, WASH, WASHER_HANDLES, FRIES, POND, BAYS } from './sim.js';
import { TUBE } from './dive.js';
import { LIFT } from './orbit.js';
import { MAP, creekProject } from './map.js';

export const TIP = {
  NEAR_MAT: 7,        // m: a muddy mat this close to me is "near you"
  MUDDY: 0.5,         // a mat this muddy is worth a tip
  REFUSE: 0.9,        // customers.js CUST.REFUSE_MUD: a customer won't step on it
  POINT_SECS: 10,     // how long the arrow points after a tip
  ARRIVED: 2.5,       // m: close enough, the arrow goes
};

const MAT_FX = FIXTURES.filter(f => f.id.startsWith('mat'));

// Playthrough 4 A15: tips may play in a shift unless a checklist step is still open (a carried-over day keeps a
// finished checklist: that must not silence them), my nudge slot holds a line, or I'm up the Lift.
export const tipsAllowed = (crew, meId) => crew?.phase === 'shift' && !crew.todo?.some(t => !t.done)
  && !crew.mods?.nudge?.[meId] && !crew.mods?.orbit?.r?.[meId];   // no ball-washer tips at 120 m

// The extra hint context from a snapshot and me (spread into hinter.tick's ctx in main.js).
export function tipCtx(crew, me) {
  const fx = crew?.fixtures ?? {};
  let near = 0, worst = 0;
  for (const m of MAT_FX) {
    const mud = fx[m.id] ?? 0;
    if (mud > worst) worst = mud;
    if (me && Math.hypot(m.x - me.x, m.z - me.z) <= TIP.NEAR_MAT && mud > near) near = mud;
  }
  // Council round 10 #5: near the running creek (the Club and up), for its first-time tip.
  const creekNear = !!me && (crew?.venue ?? 0) >= 1 && creekProject(me.x, me.z).d < MAP.CREEK.HW + 4;
  // Council round 10 #6: standing at a crew bay (the 'on the green' tip, Muni and Club).
  const atBay = !!me && BAYS.some(b => Math.hypot(me.x - b.x, me.z - b.z) < 1.4);
  return { up: crew?.up ?? null, myDive: me?.dive ?? 0, matMudNear: near, matMudMax: worst, ...(creekNear ? { creekNear } : {}), ...(atBay ? { atBay } : {}) };
}

// The muddiest mat (for the pointer), or null.
function muddiestMat(crew) {
  let best = null, bm = TIP.MUDDY * 0.5;
  for (const m of MAT_FX) { const mud = crew?.fixtures?.[m.id] ?? 0; if (mud > bm) { bm = mud; best = m; } }
  return best;
}

// Where the arrow points for a tip id ({ x, y, z, s } like main.js todoTarget), or null for none.
export function tipTarget(id, crew, me) {
  switch (id) {
    case 'mud': {
      if (!me?.wand) return { x: WASH.STATION.x, z: WASH.STATION.z, y: 2.2, s: 1 };
      const m = muddiestMat(crew);
      return m ? { x: m.x, z: m.z, y: 1.6, s: 0.8 } : null;
    }
    case 'crank': return { x: WASHER_HANDLES.R.x, z: WASHER_HANDLES.R.z, y: 2.4, s: 1 };
    case 'shed': return { x: FRIES.SHED.x, z: FRIES.SHED.z, y: 2.6, s: 1 };
    case 'cart': {
      const c = (crew?.carts ?? [crew?.cart]).find(Boolean);
      return c && c.x != null ? { x: c.x, z: c.z, y: 2.6, s: 1 } : null;
    }
    case 'dive': return { x: POND.DOCK.x, z: POND.DOCK.z, y: 2.2, s: 1 };
    case 'tube': return { x: TUBE.BOX.x, z: TUBE.BOX.z, y: 2, s: 0.8 };
    case 'lift': return { x: LIFT.x, z: LIFT.z, y: 4, s: 1.2 };
    case 'gutters': { const f = MAP.FLAGS?.[0]; return f ? { x: f.x, z: f.z, y: 4, s: 2 } : null; }
    default: return null;
  }
}

// The pointer: point(id) after a tip shows; target(dt, crew, me, ok) is the arrow's spot this frame (or null).
// It goes after POINT_SECS, when you get there, or while `ok` is false (another text holds the centre).
export function createTipPointer() {
  let id = null, left = 0;
  return {
    point(tipId) { id = tipId; left = TIP.POINT_SECS; },
    get id() { return left > 0 ? id : null; },
    target(dt, crew, me, ok = true) {
      if (left <= 0 || !id) return null;
      left -= dt;
      if (left <= 0 || !ok) return null;
      const tg = tipTarget(id, crew, me);
      if (!tg) return null;
      if (me && Math.hypot(tg.x - me.x, tg.z - me.z) < TIP.ARRIVED) { left = 0; return null; }
      return tg;
    },
  };
}

// Playthrough 5 A5: the empty-basket alarm. Mid-day (the basket held buckets earlier this shift: `stocked`) the basket
// runs dry: the dispenser's lamp lights and the nearest able Rat (online, not down, not diving) is re-dealt "Fill the
// bucket basket!" ('am:basket'). -> that Rat's id, or null (no alarm). `at`: the fill point (layout.js FILL_POINT).
export function emptyBasketRat(c, stocked, at) {
  if (!stocked || c?.phase !== 'shift' || (c.basket ?? 0) > 0 || c.lastBucket || c.todo?.some(t => !t.done)) return null;
  let best = null, bd = Infinity;
  for (const p of c.players ?? []) {
    if (!p.online || p.down > 0 || p.diving) continue;
    const d = Math.hypot(p.x - at.x, p.z - at.z);
    if (d < bd) { bd = d; best = p.id; }
  }
  return best;
}
// The dealt line: the alarm outranks the morning deal and the goal line, never Gary's lines.
export const withBasketAlarm = (serverNudge, alarmMine) => (alarmMine && (!serverNudge || serverNudge.startsWith('am:')) ? 'am:basket' : serverNudge ?? null);
