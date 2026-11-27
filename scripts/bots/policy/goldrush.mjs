// Council round 14 #1 (builder 2): the Gold Rush, as a bot policy (POLICY=goldrush). Each live rush ball gets the nearest
// free Rat who can reach it in time (a 4P crew splits the wave; the pond ball gets a diver); a Rat holding rush balls
// walks to the nearest return. Without it the bot ignores them (Site 13 gets every ball): the comparison run.
// policy/happyhour.mjs reuses the chaser for the loungers' balls.
const REPO = new URL('../../../', import.meta.url).href;
const L = await import(REPO + 'web/js/layout.js');
const S = await import(REPO + 'web/js/sim.js');

// A chaser for a module's hands-balls: st() is the module state ({ balls: [{ id, st, left, x, z, pond? }], held }).
export function chaser(ctx, st, ok = () => true) {
  const { crew, rats, walkTo } = ctx;
  let jobs = new Map();
  const step1 = (p, x, z, dt) => {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), sp = (crew.perks?.walk ?? 4.2) * (p.diving ? 0.6 : 1) * dt;
    if (d > 1e-6) { const k = Math.min(1, sp / d); p.x += dx * k; p.z += dz * k; p.yaw = Math.atan2(-dx, -dz); }
    p.movedAt = ctx.now() * 1000;
    return d < 1.2;
  };
  return {
    reset() { jobs = new Map(); },
    step(dt, skip = []) {
      const s = st();
      if (!s || !ok()) return null;
      if (crew.gary && crew.gary.phase !== 'done') { jobs.clear(); return null; }
      const moved = [];
      const live = s.balls.filter(e => e.st === 'out' || e.st === 'air');
      for (const [id, bid] of jobs) if (!live.some(e => e.id === bid)) jobs.delete(id);
      for (const e of live) {
        if ([...jobs.values()].includes(e.id)) continue;
        let best = null, bd = Infinity;
        for (const p of rats) {
          if (skip.includes(p) || jobs.has(p.id) || p.down > 0 || p.one || (p.diving && !e.pond)) continue;   // a diver stays on the pond's work
          const d = Math.hypot(p.x - e.x, p.z - e.z) + (p.diving && !e.pond ? 50 : 0);
          if (d < bd) { bd = d; best = p; }
        }
        if (best && bd / (crew.perks?.walk ?? 4.2) < e.left + 4) jobs.set(best.id, e.id);
      }
      for (const p of rats) {
        if (skip.includes(p)) continue;
        const bid = jobs.get(p.id);
        if (bid != null) {
          if (crew.cartOf?.(p)) crew.leaveCart?.(p);
          const e = s.balls.find(o => o.id === bid), b0 = crew.balls.get(bid);
          if (!e || !b0) { jobs.delete(p.id); continue; }
          const b = b0.rest || b0.sunk ? b0 : { x: e.x, z: e.z };
          moved.push(p);
          const there = e.pond ? step1(p, b.x, b.z, dt) : (walkTo ? walkTo(p, b.x, b.z) : step1(p, b.x, b.z, dt));
          if (there || Math.hypot(p.x - b.x, p.z - b.z) < 1.5) {
            if (e.pond) { if (p.diving && b0.sunk) crew.pondPickup(p, bid); }
            else if (b0.rest) crew.pickup(p, bid);
          }
          continue;
        }
        if (s.held[p.id] > 0 && !p.diving) {
          const r = L.nearestReturn(p.x, p.z, crew.perks?.returns ?? 0);
          moved.push(p);
          if (walkTo) walkTo(p, r.x, r.z); else step1(p, r.x, r.z, dt);
        } else if (p.diving && s.balls.some(e => e.st === 'dived' && e.by === p.id) && !jobs.size) { moved.push(p); step1(p, S.POND.DOCK.x, S.POND.DOCK.z + 3, dt); }
      }
      return moved;
    },
  };
}

export default function make(ctx) {
  const { crew } = ctx;
  const T = { days: 0, out: 0, got: 0, claimed: 0, cash: 0, share: [] };
  const c = chaser(ctx, () => crew.mods.state('goldrush'), () => crew.venue <= 1 && !crew.endless);
  let on = false;
  return {
    shiftStart() { c.reset(); on = !!crew.mods.state('goldrush')?.which; if (on) T.days++; },
    step: dt => c.step(dt),
    shiftEnd(report) {
      const st = crew.mods.state('goldrush');
      if (!on || !st?.fired) return {};
      const inc = report?.cash ?? crew.stats.cash, got = st.banked + st.dived;
      T.out += st.n; T.got += got; T.claimed += st.claimed; T.cash += st.cash; T.share.push(+(st.cash / Math.max(1, inc)).toFixed(3));
      return { rush: { n: st.n, got, claimed: st.claimed, cash: Math.round(st.cash), share: +(st.cash / Math.max(1, inc)).toFixed(3) } };
    },
    summary: () => [`GOLDRUSH days ${T.days} balls ${T.got}/${T.out} taken (${T.claimed} to Site 13) cash $${Math.round(T.cash).toLocaleString()} share ${T.share.map(v => (v * 100).toFixed(1) + '%').join(' ')}`],
  };
}
