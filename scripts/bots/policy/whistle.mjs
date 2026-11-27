// Council round 13 #5 (builder 1): the aimed whistle, as a bot policy (scripts/bots/policies.mjs: WHISTLE=<value>).
//   WHISTLE=aim    Rat 0 takes the whistle at the post, then at BLOW_K of the shift carries it to the densest 10 m strip
//                  20 m or more from a return (or to a member's ball, builder 2's Tournament, when one is resting) and blows.
//   WHISTLE=post   the lazy whistler: takes it, walks 22 m straight out from the post, blows (no aim).
// Anything else (WHISTLE=1, a number): treated as aim. The whistler goes back to the bot's day job once it's blown.
// Pure helpers (densest, memberBall) are exported for the tests and other bots.
const REPO = new URL('../../../', import.meta.url).href;
const MW = await import(REPO + 'web/js/mowe.js');
const L = await import(REPO + 'web/js/layout.js');

export const BLOW_K = 0.45;   // between the two scheduled passes (30 % and 65 %)
const restable = b => MW.eatable(b);
// The densest strip: every resting ball ≥ MIN_D from its nearest return is a candidate spot; count the eatable balls in
// that spot's strip (capped at WHISTLE.CAP). Returns { x, z, n } or null.
export function densest(balls, tier = 0) {
  const bs = []; for (const b of balls instanceof Map ? balls.values() : balls ?? []) if (restable(b)) bs.push(b);
  let best = null;
  for (const a of bs) {
    const ret = L.nearestReturn(a.x, a.z, tier);
    if (!MW.canBlow(a, ret)) continue;
    const st = MW.whistleStrip(a, ret);
    let n = 0; for (const b of bs) if (Math.abs(b.x - a.x) <= 20 && Math.abs(b.z - a.z) <= 20 && MW.inStrip(st, b)) n++;
    n = Math.min(n, MW.WHISTLE.CAP);
    if (!best || n > best.n) best = { x: a.x, z: a.z, n };
  }
  return best;
}
// A member's ball (builder 2's Tournament: kind 'member' or b.member), resting and far enough out to whistle on.
// near: the nearest one to that point (the whistler). Its blow spot: 12 m from it toward its return, so the strip covers it
// and the walk is shorter (memberSpot).
export function memberBall(balls, tier = 0, near = null) {
  let best = null, bd = Infinity;
  for (const b of balls instanceof Map ? balls.values() : balls ?? []) {
    if (!(b.kind === 'member' || b.member != null) || b.sunk || !(b.rest || Math.abs(b.vy ?? 0) < 0.5 && (b.y ?? 0) < 0.3)) continue;
    if (!MW.canBlow(b, L.nearestReturn(b.x, b.z, tier))) continue;
    const d = near ? Math.hypot(b.x - near.x, b.z - near.z) : 0;
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
export function memberSpot(b, tier = 0) {
  const r = L.nearestReturn(b.x, b.z, tier), dx = r.x - b.x, dz = r.z - b.z, d = Math.hypot(dx, dz) || 1, k = Math.min(12, d - MW.WHISTLE.MIN_D);
  return { x: b.x + dx / d * Math.max(0, k), z: b.z + dz / d * Math.max(0, k) };
}

export default function make(ctx, value = 'aim') {
  const { crew, rats } = ctx;
  const mode = value === 'post' ? 'post' : 'aim';
  let goal = null, done = false, tally = { shifts: 0, whistled: 0, aimN: 0, fetchedMember: 0, whistleBalls: 0, petBalls: 0 };
  let shift = { whistle: 0, pet: 0, aimN: null, member: false, fetched: 0 }, pass = null, banked = 0, shares = [];
  return {
    shiftStart() { goal = null; done = false; shift = { whistle: 0, pet: 0, aimN: null, member: false, fetched: 0 }; tally.shifts++; if (crew.venue === 1 && crew.venueDay >= 4) tally.tdays = (tally.tdays ?? 0) + 1; },
    step(dt) {
      // The pet's take, from state (a bot may clear crew.events before the policies run): a pass's load when it banks.
      const m = crew.mower;
      if (m?.kind === 'tame' && m.whistle && m.members?.length) shift.fetched = m.members.length;   // member balls MOW-E actually fetched
      if (m?.kind === 'tame') {
        if (m.phase === 'mow' || m.phase === 'home') pass = { m, load: m.load, whistle: !!m.whistle };
        else if (pass?.m === m && (m.phase === 'shed' || m.phase === 'done')) { shift.pet += pass.load; if (pass.whistle) shift.whistle += pass.load; pass = null; }
      }
      const p = rats[0];
      if (!p || done || p.down > 0) return null;
      const s = crew.whistleState();
      if (s === 0 || s === 2) return null;
      if (s === 1) {   // go and take it
        if (crew.shiftT < crew.shiftSecs * BLOW_K - 40 && !(crew.venue === 1 && crew.venueDay >= 4)) return null;   // a Tournament day: take it early
        if (crew.cartOf?.(p)) crew.leaveCart(p);
        if (p.wand) crew.toggleWand(p);
        if (ctx.walkTo(p, MW.WHISTLE.POST.x, MW.WHISTLE.POST.z) || MW.atPost(p)) crew.input(p, { a: [{ t: 'whistle' }] });
        return [p];
      }
      if (crew.whistleCarrier() !== p.id) return null;
      const tier = crew.perks?.returns ?? 0;
      // A Tournament day (the Club from day 4): hold it for a member's ball (both flights), else blow after flight 2 lands.
      const tday = crew.venue === 1 && crew.venueDay >= 4, member = mode === 'aim' && !goal ? memberBall(crew.balls, tier, p) : null;
      if (!goal && !member && crew.shiftT < crew.shiftSecs * (tday ? 0.7 : BLOW_K)) return null;   // carry it, keep picking up
      if (!goal) {
        const mb = member;
        const d = mb ? { ...memberSpot(mb, tier), n: 1, member: true, id: mb.id } : mode === 'aim' ? densest(crew.balls, tier) : null;
        goal = d ?? { x: MW.WHISTLE.POST.x - 4, z: MW.WHISTLE.POST.z - 24, n: 0 };
        shift.aimN = goal.n; shift.member = !!goal.member;
      }
      if (crew.cartOf?.(p)) crew.leaveCart(p);   // on foot to blow it (a driver can't)
      if (p.wand) crew.toggleWand(p);
      if (p.diving) return null;
      if (goal.member && !crew.balls.has(goal.id)) { goal = null; return [p]; }   // gone (banked or the caddie's): pick again
      const there = ctx.walkTo(p, goal.x, goal.z);
      if (there || Math.hypot(goal.x - p.x, goal.z - p.z) < 1.2) {
        if (crew.moweWhistle(p)) { done = true; tally.whistled++; tally.aimN += goal.n ?? 0; if (goal.member) tally.fetchedMember++; }
        else if (!MW.canBlow(p, L.nearestReturn(p.x, p.z, tier))) goal = { x: p.x - 6, z: p.z - 20, n: 0 };
      }
      return [p];
    },
    shiftEnd(r) { tally.whistleBalls += shift.whistle; tally.fetched = (tally.fetched ?? 0) + shift.fetched; if (shift.fetched) tally.fetchShifts = (tally.fetchShifts ?? 0) + 1; tally.petBalls += shift.pet; const dep = r?.deposited ?? 0; banked += dep; if (dep) shares.push(shift.pet / dep); return { petN: shift.pet, whistleN: shift.whistle, aimN: shift.aimN, member: shift.member }; },
    summary() {
      const share = tally.petBalls ? tally.whistleBalls / tally.petBalls : 0;
      const med = shares.length ? [...shares].sort((a, b) => a - b)[shares.length >> 1] : 0;
      return [`pet share of banked: median ${(med * 100).toFixed(1)}% max ${(Math.max(0, ...shares) * 100).toFixed(1)}%`, `${tally.shifts} shifts, whistled ${tally.whistled}, pet ${tally.petBalls} (${(tally.petBalls / Math.max(1, tally.shifts)).toFixed(1)}/shift), whistle share ${(share * 100).toFixed(0)}%, aimed at a member ${tally.fetchedMember}, members fetched ${tally.fetched ?? 0} in ${tally.fetchShifts ?? 0} of ${tally.tdays ?? 0} Tournament-day shifts`];
    },
  };
}
