// The County (venue 4): customers slice into the Yards, Zoning Compliance counts the strays, drones fetch them.
// Council round 4, section 3.3. Pure rules live in web/js/county.js; the look is web/js/views/county.js.
import { SIM, KIND_W, WASH, QUOTA_KPI } from '../../web/js/sim.js';
import { SLICE, ZONING, DRONES, DISPATCH, strayCount, zoning, droneCount, droneTarget, droneStep, newZone, zoneLive,
  HAZ, VAN, hazChance, inHazZone, hazardCount, zoningWith, vanTow, vanPick, hazDealDue, hazPair, zoningLabel,
  INSPECT, INSPECT_MEMO, inspectSecs, inspectDue, inPatch, inspectPatch, secondPatch, zoningInspected, inspectWhere, CHAIN, sweepStep } from '../../web/js/county.js';
import { RALLY_LINES } from '../../web/js/rally.js';
import { nearestReturn } from '../../web/js/layout.js';
import { tubeFeed } from '../../web/js/dive.js';
import { hash32 } from '../../web/js/today.js';   // council round 14 #3c: the second patch's fallback
import { LANDMARK, hasLandmark, INSPECT2, inspect2Due, INSPECTOR_LABEL, INSPECTOR_MEMO } from '../../web/js/landmarks.js';   // council round 13 #4 (builder 2)

const r2 = v => Math.round(v * 100) / 100;
const PARK = { x: SIM.STAND.x, z: SIM.STAND.z, stand: true, idle: true };

function fleet(crew, st) {                      // keep the drone list at the row's size (they spawn at the stand)
  const want = droneCount(crew.up);
  while (st.drones.length < want) {
    const i = st.drones.length;
    st.drones.push({ id: `dr${i}`, x: SIM.STAND.x + (i % 2) * 1.6, y: DRONES.ALT, z: SIM.STAND.z + 1.5 - (i >> 1) * 1.6, yaw: 0, pocket: 0, pocketW: 0, target: null });
  }
}

// stepDrones lives here, NOT in stepHelpers. A drone flies at y 6 ignoring the creek, the kerb and wading; takes strays
// first, then the nearest ball; carries 25; dips to y 1 to grab; banks at the stand. It is never knocked down: it is
// not in crew.helpers or crew.players, so no ball, cart or mower ever asks it.
// Council round 10 §C/§D: a drone banks at the NEAREST return (a field return's pipe THUNKs its load home in 6 s), and a
// dispatch zone (st.zone) is cleared first.
const homeFor = (crew, d) => { const r = nearestReturn(d.x, d.z, crew.perks?.returns ?? 0); return { x: r.x, z: r.z, stand: true, at: r.id }; };
export function stepDrones(crew, st, dt) {
  fleet(crew, st);
  if (!st.drones.length) return;
  const working = crew.working();
  st.t = (st.t ?? 0) + dt;
  if (st.zone && !zoneLive(st.zone, st.t)) { st.zone = null; crew.dirty = true; }
  const zone = st.zone;
  const claimed = new Set(st.drones.map(d => d.target).filter(v => v != null));
  for (const d of st.drones) {
    let goal = null;
    if (d.pocket >= DRONES.POCKET || (d.pocket > 0 && !working)) goal = homeFor(crew, d);
    else if (working) {
      let b = d.target != null ? crew.balls.get(d.target) : null;
      // A dispatch re-aims each drone once (it drops a target outside the zone for one inside).
      if (b && zone && Math.hypot(b.x - zone.x, b.z - zone.z) > zone.r && d.retarget !== zone.until) { d.retarget = zone.until; b = null; }
      if (!b || !b.rest) {
        claimed.delete(d.target); d.target = null;
        b = droneTarget(d, crew.balls.values(), claimed, zone);
        if (b) { d.target = b.id; claimed.add(b.id); }
      }
      if (b) goal = { x: b.x, z: b.z, grab: true, ball: b };
      else if (d.pocket > 0) goal = homeFor(crew, d);
    }
    const there = droneStep(d, goal ?? PARK, dt);
    if (!there || !goal) continue;
    if (goal.stand) {
      if (goal.at && goal.at !== 'main' && crew.tube) {   // a field return: into its pipe, banked at the return 6 s later
        tubeFeed(crew.tube, crew.tubeClock ?? 0, { n: d.pocket, w: d.pocketW || d.pocket, factor: 1 });
        Object.assign(crew.tube.q.at(-1), { by: d.id, kind: 'helper' });
        crew.events.push({ t: 'tube', id: d.id, at: goal.at });
      } else crew.bank(d.pocket, d.id, 'helper', d.pocketW || d.pocket);
      d.pocket = 0; d.pocketW = 0;
    } else if (goal.ball) {
      crew.balls.delete(goal.ball.id);
      const k = crew.loadOf(goal.ball);
      d.pocket += k; d.pocketW += (KIND_W[goal.ball.kind] ?? 1) * (k === 3 ? 3 : 1); d.target = null;
      crew.stats.picked += k; crew.dirty = true;
      crew.events.push({ t: 'gone', id: goal.ball.id, by: d.id });
    }
  }
}

// Council round 10 §D: Ⓨ held on foot (drones owned): "Drones, here!" pins a 20 m zone at you for 30 s.
function dispatch(crew, st, p) {
  if (!st.drones.length || !crew.working() || p.down > 0 || crew.driving(p) || p.diving) return true;
  st.zone = newZone(p.x, p.z, st.t ?? 0);
  for (const d of st.drones) d.retarget = null;
  crew.events.push({ t: 'dispatch', by: p.id, x: +p.x.toFixed(1), z: +p.z.toFixed(1), r: DISPATCH.R, secs: DISPATCH.SECS });
  crew.dirty = true;
  return true;
}

// ---- round 11 (expert #9): the wand on a hazard. a: { t: 'hazspray', id, secs } (crew.wash's 'h:<id>' target) -------
const clock = crew => crew.custT ?? 0;
function wetIds(crew) {                                // the hazards wet right now (a short list: the client's prompt and sheen)
  if (crew.venue !== 4) return [];
  const now = clock(crew), out = [];
  for (const b of crew.balls.values()) if (b.kind === 'hazard' && b.wetUntil > now && out.length < 16) out.push(b.id);
  return out;
}                 // the monotonic server clock (wet timers)
function hazSpray(crew, st, p, a) {
  const b = crew.balls.get(a.id);
  if (!b || b.kind !== 'hazard' || !p.wand || p.down > 0 || !(a.secs > 0)) return true;
  if (Math.hypot(b.x - p.x, b.z - p.z) > (crew.perks?.washReach ?? WASH.RANGE) + 1.5) return true;
  const now = clock(crew);
  if (b.wetUntil > now) { b.wetUntil = now + HAZ.WET; return true; }   // keep it wet while you spray it
  b.spray = (b.spray ?? 0) + Math.min(a.secs, 0.5);
  if (b.spray + 1e-9 >= HAZ.SPRAY) {
    b.spray = 0; b.wetUntil = now + HAZ.WET; b.sprayBy = p.id;
    crew.events.push({ t: 'hazwet', id: b.id, by: p.id, secs: HAZ.WET });
    for (const o of crew.balls.values()) {                     // council round 12 #7b: the spray wets every hazard within CHAIN.R
      if (o === b || o.kind !== 'hazard' || o.sunk || o.wetUntil > now || Math.hypot(o.x - b.x, o.z - b.z) > CHAIN.R) continue;
      o.spray = 0; o.wetUntil = now + HAZ.WET; o.sprayBy = p.id;
      crew.events.push({ t: 'hazwet', id: o.id, by: p.id, secs: HAZ.WET, chain: b.id });
    }
    crew.dirty = true;
  }
  return true;
}

// A hazard nobody bagged in HAZ.LIFE s is written off: a range ball again (not while it's wet).
function expire(crew, st) {
  const now = clock(crew);
  for (const b of crew.balls.values()) {
    if (b.kind !== 'hazard' || b.wetUntil > now || now - (b.hazAt ?? now) < HAZ.LIFE || st?.noted?.has(b.id)) continue;   // round 12 #7a: on his clipboard for good
    b.kind = 'range'; b.hands = false; b.spray = 0;
    crew.events.push({ t: 'hazgone', id: b.id });
  }
}

// ---- round 11 (expert #6): below the line, Zoning's van tows balls off the field every VAN.EVERY s -----------------
function van(crew, st, dt) {
  if (st.van && (st.van.left -= dt) <= 0) { st.van = null; crew.dirty = true; }
  if (!crew.working() || crew.closing?.() || st.kpi + 1e-9 >= VAN.LINE) { st.vanT = 0; return; }
  if ((st.vanT += dt) < VAN.EVERY) return;
  st.vanT = 0;
  const towed = vanPick(crew.balls.values(), vanTow(crew.onlineCount()));
  for (const b of towed) { crew.balls.delete(b.id); crew.events.push({ t: 'gone', id: b.id, by: 'van' }); }
  st.vans++; st.towed += towed.length;
  crew.stats.towed = (crew.stats.towed ?? 0) + towed.length;
  st.van = { left: VAN.SECS };
  crew.events.push({ t: 'van', n: towed.length, k: st.vans });
  crew.dirty = true;
}

// ---- council round 11 #2: the live hazard deal (two Rats: a sprayer and a bagger), at most every HAZ_DEAL.EVERY s ------
// Last Call's own rally deals first; the hazard deal then goes out on the same tick to the two nearest the hazards.
function hazDeal(crew, st, dt) {
  st.dealT = (st.dealT ?? Infinity) + dt;
  if (crew.lastCall?.() && !st.dealLC) { st.dealLC = true; st.dealT = Infinity; }   // Last Call re-deals at once
  if (!hazDealDue({ haz: st.haz, kpi: st.kpi, line: QUOTA_KPI, since: st.dealT })) return;
  const rats = crew.online().map(p => ({ id: p.id, x: p.x, z: p.z, wand: !!p.wand }));
  const hz = [];
  for (const b of crew.balls.values()) if (b.kind === 'hazard' && b.rest) hz.push(b);
  const ids = hazPair(rats, hz);
  if (!ids.length) return;
  st.dealT = 0; st.deals = (st.deals ?? 0) + 1;
  crew.events.push({ t: 'rally', needs: Object.fromEntries(ids.map(id => [id, RALLY_LINES.hazards])), haz: st.haz });
}

// ---- council round 12 #7a: Inspection Hour --------------------------------------------------------------------------
// Zoning: strays, hazards (the noted ones twice), and the inspection's bonuses and notes.
function notedOut(crew, st) {
  if (!st.noted?.size) return 0;
  let n = 0;
  for (const id of st.noted) { const b = crew.balls.get(id); if (b && b.kind === 'hazard' && !b.sunk) n++; else st.noted.delete(id); }
  return n;
}
// A noted hazard costs -INSPECT.NOTED while it's still out (bag it after he's gone and that comes back); the bonuses stay.
// Lead's call (round 14): the sting is within the shift only. From the cleanup (T-1:00) to the bell the noted hazards are
// on his clipboard, not your Zoning (they don't count at all), so a crew that ignores hazards takes a DENIED or two but is
// never walled. (Counting them once still left a 4P ignorer at 6 / 7 / 12 shifts: design/round14-venues.md.)
const gaugeOf = (crew, st) => {
  if (crew.venue !== 4) return zoningWith(st.strays, st.haz);
  const n = notedOut(crew, st);
  if (crew.closing?.() || !crew.working()) return zoningInspected(st.strays, Math.max(0, st.haz - n), 0, st.zAdj ?? 0);
  return zoningInspected(st.strays, st.haz, n, (st.zAdj ?? 0) - INSPECT.NOTED * n);
};
const inPatchHaz = (crew, ins) => { let n = 0; for (const b of crew.balls.values()) if (b.kind === 'hazard' && !b.sunk && inPatch(ins, b.x, b.z)) n++; return n; };
function inspection(crew, st, dt) {
  if (st.ins) {
    st.ins.n = inPatchHaz(crew, st.ins);
    if ((st.ins.left -= dt) > 0) return;
    const ins = st.ins; st.ins = null;
    const noted = [];
    for (const b of crew.balls.values()) if (b.kind === 'hazard' && !b.sunk && inPatch(ins, b.x, b.z)) { st.noted.add(b.id); noted.push(b.id); }
    st.insNoted = noted.length;
    crew.stats.inspNoted = (crew.stats.inspNoted ?? 0) + noted.length;
    if (!noted.length) crew.stats.inspClean = (crew.stats.inspClean ?? 0) + 1;
    if (!noted.length && ins.bagged > 0) crew.memoNote = INSPECT_MEMO;   // tomorrow's memo flavour (builder 4's memoNote slot): "The inspector was impressed."
    crew.events.push({ t: 'inspect', phase: 'done', noted: noted.length, bagged: ins.bagged, clean: !noted.length });
    st.kpi = gaugeOf(crew, st); crew.dirty = true;
    return;
  }
  const left = crew.shiftSecs - crew.shiftT;
  // Council round 13 #4 (builder 2): Site 13's inspector on retainer (landmark tier 4): a second visit at T-5:30, 45 s, ×4.
  const second = hasLandmark(crew.up, LANDMARK.INSPECTOR) && inspect2Due({ left, done: st.ins2Done });
  if (!second && !inspectDue({ left, done: st.insDone })) return;
  if (second) st.ins2Done = true; else st.insDone = true;
  const hz = [];
  for (const b of crew.balls.values()) if (b.kind === 'hazard' && !b.sunk) hz.push(b);
  // Council round 14 #3c (C #10): the shift's second visit goes somewhere else (county.js secondPatch).
  const p = st.patch1 ? secondPatch(hz, st.patch1, hash32(crew.day, crew.venueDay, 'insp', 2)) : inspectPatch(hz);
  st.patch1 ??= { x: p.x, z: p.z };
  const secs = second ? INSPECT2.SECS : inspectSecs(crew.onlineCount());
  st.ins = { x: p.x, z: p.z, r: p.r, left: secs, secs, bagged: 0, n: 0, pay: second ? INSPECT2.PAY : INSPECT.PAY, ...(second ? { site13: true } : {}) };
  st.ins.n = inPatchHaz(crew, st.ins);
  crew.events.push({ t: 'inspect', phase: 'start', x: +p.x.toFixed(1), z: +p.z.toFixed(1), r: p.r, secs, n: st.ins.n, where: inspectWhere(p.x, p.z), ...(second ? { site13: true } : {}) });
  crew.dirty = true;
}

export default {
  id: 'county',
  venue: 4,

  init(crew, saved) { return { drones: [], strays: 0, z: 0, kpi: 1, said: false, haz: 0, hz: false, vanT: 0, vans: 0, towed: 0, bagged: 0, retained: !!saved?.retained }; },

  startShift(crew, st) {
    st.ins2Done = false;   // council round 13 #4: the retainer's visit; the first morning after buying, the memo note says so
    if (!st.retained && hasLandmark(crew.up, LANDMARK.INSPECTOR)) { st.retained = true; crew.memoNote ??= INSPECTOR_MEMO; }
    st.z = 0; st.strays = 0; st.kpi = 1; st.zone = null; st.haz = 0; st.hz = false; st.vanT = 0; st.vans = 0; st.towed = 0; st.bagged = 0; st.van = null; st.dealT = Infinity; st.dealLC = false; st.deals = 0;
    st.ins = null; st.patch1 = null; st.insDone = false; st.insNoted = 0; st.noted = new Set(); st.zAdj = 0; st.sweep = {}; st.sweeps = 0;   // council round 12 #7a/#7b
    for (const d of st.drones) { d.x = SIM.STAND.x; d.z = SIM.STAND.z + 1.5; d.y = DRONES.ALT; d.pocket = 0; d.pocketW = 0; d.target = null; }
  },

  tick(crew, st, dt) {
    stepDrones(crew, st, dt);
    if (!st.said && st.drones.length) { st.said = true; crew.pa('drones', { once: true, big: true }); }
    if ((st.z += dt) >= ZONING.EVERY) {          // the stray count, recomputed every half second
      st.z = 0;
      st.strays = strayCount(crew.balls.values());
      // Round 11 (expert #6): at the County itself, every hazard lying out counts against Zoning too.
      if (crew.venue === 4 && !crew.closing?.()) expire(crew, st);   // the cleanup doesn't write them off: bag them before the bell
      st.haz = crew.venue === 4 ? hazardCount(crew.balls.values()) : 0;
      st.kpi = gaugeOf(crew, st);
    }
    if (crew.venue === 4) van(crew, st, dt);
    if (crew.venue === 4 && !crew.endless && crew.working()) { hazDeal(crew, st, dt); inspection(crew, st, dt); }   // council round 11 #2 (the cleanup too: hazards count at the bell); round 12 #7a
  },

  // Round 11 (expert #9): a County customer ball that rests inside the hose's reach turns hazard with HAZ.CHANCE.
  onRest(crew, st, b) {
    if (crew.venue !== 4 || crew.endless || !crew.working() || b.by != null || b.kind !== 'range' || b.sunk || b.creek || b.drifting) return;
    if (!inHazZone(b.x, b.z, WASH.STATION) || crew.rng() >= hazChance(crew.onlineCount())) return;
    b.kind = 'hazard'; b.hands = true; b.hazAt = crew.custT ?? 0;
    if (!st.hz) st.hz = true;
    crew.events.push({ t: 'hazard', id: b.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2) });
    crew.dirty = true;
  },

  // The wand on a hazard ('h:<id>' wash target): HAZ.SPRAY s of spray makes it wet for HAZ.WET s.
  input(crew, st, p, a) {
    if (a.t === 'hazspray') return hazSpray(crew, st, p, a);
    if (a.t !== 'dispatch') return false;
    return dispatch(crew, st, p);
  },

  // A Rat picks up a hazard: wet, it's bagged on the spot (it pays HAZ.W); dry, it's refused.
  take(crew, st, p, b) {
    if (b.kind !== 'hazard') return false;
    if (!(b.wetUntil > clock(crew))) return false;
    crew.balls.delete(b.id); crew.stats.picked++;
    st.bagged++; crew.stats.bagged = (crew.stats.bagged ?? 0) + 1;
    const team = b.sprayBy && b.sprayBy !== p.id;
    const insp = !!st.ins && inPatch(st.ins, b.x, b.z);              // council round 12 #7a: ×3 and +0.04 in his patch
    const sweep = sweepStep(st.sweep[p.id] ??= [], clock(crew));      // council round 12 #7b: 3 in 6 s, ×2 on the third
    if (insp) { st.ins.bagged++; st.zAdj = (st.zAdj ?? 0) + INSPECT.BONUS; }
    if (sweep) { st.sweeps = (st.sweeps ?? 0) + 1; crew.stats.sweeps = (crew.stats.sweeps ?? 0) + 1; }
    crew.events.push({ t: 'gone', id: b.id, by: p.id }, { t: 'hazbag', id: b.id, by: p.id, name: p.name, ...(team ? { team: b.sprayBy } : {}), ...(insp ? { insp: true } : {}), ...(sweep ? { sweep: true } : {}) });
    const c0 = crew.stats.cash;
    crew.bank(1, p.id, null, HAZ.W * (insp ? st.ins.pay ?? INSPECT.PAY : 1) * (sweep ? CHAIN.PAY : 1), null, { haz: 1 });
    crew.stats.hazCash = Math.round(((crew.stats.hazCash ?? 0) + crew.stats.cash - c0) * 100) / 100;
    st.haz = Math.max(0, st.haz - 1); st.kpi = gaugeOf(crew, st);
    crew.dirty = true;
    return true;
  },

  endShift(crew, st) {                           // the drones bank what they carry, like the helpers
    for (const d of st.drones) { crew.bank(d.pocket, d.id, 'helper', d.pocketW || d.pocket); d.pocket = 0; d.pocketW = 0; d.target = null; }
  },

  // 40% of customer shots slice: curve 1.0-2.0 (see SLICE), bending right. The pond's heavy lead balls keep their line.
  launchMod(crew, st, shot, { lead }) {
    if (lead) return shot;
    if (crew.rng() < SLICE.CHANCE) return { ...shot, curve: SLICE.MIN + crew.rng() * (SLICE.MAX - SLICE.MIN) };
    return shot;
  },

  kpi: (crew, st) => st.kpi,
  toSave: (crew, st) => (st.retained ? { retained: 1 } : undefined),   // council round 13 #4: the retainer memo said once

  snapshot: (crew, st) => ({
    strays: st.strays, kpi: r2(st.kpi),
    ...(st.zone ? { zone: { x: r2(st.zone.x), z: r2(st.zone.z), r: st.zone.r, left: r2(st.zone.until - (st.t ?? 0)) } } : {}),
    drones: st.drones.map(d => ({ id: d.id, x: r2(d.x), y: r2(d.y), z: r2(d.z), yaw: r2(d.yaw), n: d.pocket })),
    ...(crew.venue === 4 ? { label: zoningLabel(st.kpi, st.haz) } : {}),   // council round 11 #2: the Board's Zoning line (board.js, builder 4)
    ...(st.ins ? { inspect: { x: r2(st.ins.x), z: r2(st.ins.z), r: st.ins.r, t: r2(st.ins.left), secs: st.ins.secs, n: st.ins.n, where: inspectWhere(st.ins.x, st.ins.z), ...(st.ins.site13 ? { who: INSPECTOR_LABEL } : {}) } } : {}),   // council round 13 #7a: where he is; #4: the retainer's label   // council round 12 #7a (bvtext.js kpiNoteOf)
    ...(st.retained ? { site13: 1 } : {}),   // council round 13 #4: the inspector's on retainer (the view: his jacket)
    ...(st.hz ? { hz: 1, haz: st.haz, wet: wetIds(crew) } : {}), ...(st.van ? { van: r2(VAN.SECS - st.van.left) } : {}), ...(st.vans ? { vans: st.vans, towed: st.towed } : {}),
  }),
};
