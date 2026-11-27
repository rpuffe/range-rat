// Council round 13 #1 (builder 2): the Members' Tournament, as a bot policy (scripts/bots/policies.mjs: TOURNEY=1).
// Each live member's ball gets the nearest free Rat (a 4P crew splits the flight); the pond ball gets a diver (the Rat
// walks into the pond and picks it off the bottom). A Rat holding member balls walks to the nearest return. At 1P the
// one Rat takes the nearest ball first. The Members' Bell (BUY=1 bought it) is rung as soon as it's open.
// TOURNEY=0 (no flag): the bot ignores them (the caddie gets every ball) — that's the comparison run.
const REPO = new URL('../../../', import.meta.url).href;
const L = await import(REPO + 'web/js/layout.js');
const S = await import(REPO + 'web/js/sim.js');
const LM = await import(REPO + 'web/js/landmarks.js');

export default function make(ctx) {
  const { crew, rats, walkTo } = ctx;
  const T = { shifts: 0, days: 0, out: 0, banked: 0, claimed: 0, clean: 0, cash: 0, mowe: 0, bell: 0, dayIncome: [] };
  let jobs = new Map();   // rat id -> ball id
  let day0 = null;
  const step1 = (p, x, z, dt) => {   // straight-line walk (into the pond too)
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), sp = (crew.perks?.walk ?? 4.2) * (p.diving ? 0.6 : 1) * dt;
    if (d > 1e-6) { const k = Math.min(1, sp / d); p.x += dx * k; p.z += dz * k; p.yaw = Math.atan2(-dx, -dz); }
    p.movedAt = ctx.now() * 1000;
    return d < 1.2;
  };
  return {
    shiftStart() {
      T.shifts++; jobs = new Map();
      const st = crew.mods.state('tourney');
      day0 = st?.on ? { cash0: crew.stats.cash ?? 0, member0: 0 } : null;
      if (st?.on) T.days++;
    },
    step(dt) {
      const st = crew.mods.state('tourney');
      if (!st || crew.venue !== 1) return null;
      if (crew.gary && crew.gary.phase !== 'done') { jobs.clear(); return null; }   // Gary's visit (the Seal's huddle) comes first
      const moved = [];
      // The bell: ring it as soon as it's open (someone walks over).
      if (LM.hasLandmark(crew.up, LM.LANDMARK.BELL) && !st.bell && st.on) {
        const left = crew.shiftSecs - crew.shiftT;
        if (LM.bellOpen({ left, rung: st.bell, live: st.balls.some(e => e.st === 'out' || e.st === 'air') })) {
          const p = rats.find(r => !jobs.has(r.id) && !r.diving && !crew.driving?.(r) && !(st.held[r.id] > 0)) ;
          if (p) { moved.push(p); if (step1(p, LM.BELL.POST.x, LM.BELL.POST.z, dt) || LM.atBell(p)) { crew.mods.first('input', p, { t: 'bell' }); if (st.bell) T.bell++; } }
        }
      }
      const live = st.balls.filter(e => e.st === 'out' || e.st === 'air');   // the spot is known at the tee: set off at once
      for (const [id, bid] of jobs) if (!live.some(e => e.id === bid)) jobs.delete(id);
      for (const e of live) {
        if ([...jobs.values()].includes(e.id)) continue;
        let best = null, bd = Infinity;
        for (const p of rats) {
          if (jobs.has(p.id) || p.down > 0 || crew.driving?.(p) || p.one) continue;
          const d = Math.hypot(p.x - e.x, p.z - e.z) + (p.diving && !e.pond ? 50 : 0);
          if (d < bd) { bd = d; best = p; }
        }
        if (best && bd / (crew.perks?.walk ?? 4.2) < e.left + 4) jobs.set(best.id, e.id);   // only if it can get there
      }
      for (const p of rats) {
        if (moved.includes(p)) continue;
        const bid = jobs.get(p.id);
        if (bid != null) {
          if (crew.cartOf?.(p)) crew.leaveCart?.(p);
          const e = st.balls.find(o => o.id === bid), b0 = crew.balls.get(bid);
          if (!e || !b0) { jobs.delete(p.id); continue; }
          const b = b0.rest || b0.sunk ? b0 : { x: e.x, z: e.z };   // in the air: run to where it'll land
          moved.push(p);
          const there = e.pond ? step1(p, b.x, b.z, dt) : (walkTo ? walkTo(p, b.x, b.z) : step1(p, b.x, b.z, dt));
          if (there || Math.hypot(p.x - b.x, p.z - b.z) < 1.5) {
            if (e.pond) { if (p.diving && b0.sunk) crew.pondPickup(p, bid); }
            else if (b0.rest) crew.pickup(p, bid);
          }
          continue;
        }
        if (st.held[p.id] > 0 && !p.diving) {   // carrying: home to the nearest return
          const r = L.nearestReturn(p.x, p.z, crew.perks?.returns ?? 0);
          moved.push(p);
          if (walkTo) walkTo(p, r.x, r.z); else step1(p, r.x, r.z, dt);
        } else if (st.held[p.id] > 0 && p.diving) { moved.push(p); step1(p, S.POND.DOCK.x, S.POND.DOCK.z + 3, dt); }
      }
      return moved;
    },
    shiftEnd(report) {
      const st = crew.mods.state('tourney');
      if (!st || !day0) return {};
      const inc = report?.cash ?? crew.stats.cash;
      T.out += st.launched; T.banked += st.banked; T.claimed += st.claimed; T.clean += st.clean; T.cash += st.cash;
      T.dayIncome.push({ income: Math.round(inc), member: Math.round(st.cash), share: +(st.cash / Math.max(1, inc)).toFixed(3) });
      return { tourney: { out: st.launched, banked: st.banked, claimed: st.claimed, clean: st.clean, cash: Math.round(st.cash), share: +(st.cash / Math.max(1, inc)).toFixed(3), bell: st.bell ? 1 : 0 } };
    },
    summary() {
      const sh = T.dayIncome.map(d => d.share);
      return [`TOURNEY days ${T.days} balls ${T.banked}/${T.out} banked (${T.claimed} to the caddie) clean ${T.clean} cash $${Math.round(T.cash).toLocaleString()} bell ${T.bell}`,
        `TOURNEY share of a Tournament day's income: ${sh.map(v => (v * 100).toFixed(1) + '%').join(' ')}`];
    },
  };
}
