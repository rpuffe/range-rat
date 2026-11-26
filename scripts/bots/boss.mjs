// Council round 11 #1 (builder 1): the MOW-E boss bot. A physical crew from a Club day-3 save (club1 moved on two
// days) or the Stadium encore (stadium1 on its day 2) plays the boss fight with one policy:
//   4p-roles   a driver re-blocks with the cart, two hosers chase its back, the hunted Rat decoys it past the cart
//   4p-swarm   four wands, no cart: the hunted Rat sidesteps, the others hose
//   2p         one driver/decoy, one hoser            1p-cart   park the cart, grab the wand, lure it past the cart, hose
//   1p-chase   wand only, sidestep in the hunt        idle      nobody engages (they keep picking up balls)
// Rats walk at real speed (sprint on stamina), hose with crew.wash(p, secs, 'mower'), drive with crew.input (the
// server's own clamps and run-over), hold the plug with p.holding. Before and after the fight every Rat picks up and
// banks balls, so the payout's share of the shift's income is honest.
// Council round 12: the per-Rat meters (spray that counts, a cooled nozzle), the plug drag, every Rat hits, SOFA=1 (a sofa crew's
// field), WHISTLE=90 (the pet's whistle at T-90). Payout counts the fountain at its ×2 (the bounty's per-weight price).
// usage: node scripts/bots/boss.mjs POLICY [seed] [club|stadium] [days]    (POLICY 'all': the §2.8 table at seeds 7/11/23)
//        env V=1 verbose (a line per fight event).  START_FILE: a save to start from instead (snap.mjs).
const REPO = new URL('../../', import.meta.url).href;
import { readFileSync } from 'node:fs';
const { startSave } = await import('./snap.mjs');
const { Crew } = await import(REPO + 'server/crew.mjs');
const S = await import(REPO + 'web/js/sim.js');
const L = await import(REPO + 'web/js/layout.js');
const MW = await import(REPO + 'web/js/mowe.js');
const V = process.env.V === '1';
// Human-ish hands: a Rat notices the build-up REACT s after it starts, and holds the crosshair on the grille AIM_ON of
// every AIM_CYCLE s (a pad on a sofa, on a moving target). PERFECT=1 turns both off (the upper bound).
const PERFECT = process.env.PERFECT === '1', REACT = PERFECT ? 0 : 4, AIM_CYCLE = 2.5, AIM_ON = PERFECT ? 2.5 : 1.5;
// Council round 12: a Rat notices its own ring go grey REACT_COOL s into a cool and stops spraying until it's back.
// WHISTLE=n: on a pet day, Rat0 walks to the MOW-E post and whistles at T-n s (the council's T-90).
// SOFA=1: before the fight each Rat picks up only half the time (a sofa crew swings, chats, shops), so the field holds
// balls the way a human crew's does (the bot crew otherwise vacuums the near lanes: ~1 resting ball near at the burst).
const SOFA = process.env.SOFA === '1';
const REACT_COOL = PERFECT ? 0 : 1, WHISTLE = process.env.WHISTLE ? +process.env.WHISTLE || 90 : 0;
const preset = name => { const j = JSON.parse(readFileSync(new URL(`server/presets/${name}.json`, REPO), 'utf8')); return j.save ?? j; };

// The Club day-3 snap: the Club's first-morning preset, two days on (venue day 2 played, so the next morning is day 3).
export function clubDay3() { const s = preset('club1'); return { ...s, day: s.day + 2, venueDay: 2, pendingReveal: 0, garyDay: s.day + 2 }; }
// The Stadium's day 2 (MOW-E already tamed at the Club).
export function stadiumDay2() { const s = preset('stadium1'); return { ...s, day: s.day + 1, venueDay: 1, pendingReveal: 0, mowe: { tame: true, lost: 0, encore: false } }; }

const ROLES = {
  '4p-roles': { n: 4, roles: ['driver', 'hose', 'hose', 'hose'] },
  '4p-swarm': { n: 4, roles: ['hose', 'hose', 'hose', 'hose'] },
  '3p': { n: 3, roles: ['driver', 'hose', 'hose'] },
  '2p': { n: 2, roles: ['driver', 'hose'] },
  '1p-cart': { n: 1, roles: ['solo-cart'] },
  '1p-chase': { n: 1, roles: ['hose'] },
  idle: { n: 4, roles: ['idle', 'idle', 'idle', 'idle'] },
  'idle-1p': { n: 1, roles: ['idle'] },
};

export function runBoss({ policy = '4p-roles', seed = 7, where = 'club', days = 1, verbose = V, save = null } = {}) {
  const P = ROLES[policy]; if (!P) throw new Error('policy? ' + policy);
  let t = 0;
  const DT = 0.05;
  const crew = new Crew('BOSS', save ?? startSave() ?? (where === 'stadium' ? stadiumDay2() : clubDay3()), { now: () => t * 1000, seed });
  const rats = Array.from({ length: P.n }, (_, i) => { const p = crew.join('Rat' + i); crew.connect(p); p.role = P.roles[i]; p.stam = 4; p.aimOff = i * 0.83 + (seed % 5) * 0.37; return p; });
  const aimOn = p => ((t + p.aimOff) % AIM_CYCLE) < AIM_ON;
  const W = () => crew.world();
  const STAND = S.SIM.STAND, WSTN = S.WASH.STATION;
  const sprintMax = S.sprintSecs(crew.up.shoes ?? 0);
  const fights = [];
  let F = null;

  function walkTo(p, g, dt, sprint = false, cap = Infinity) {
    if (p.down > 0) return false;
    const dx = g.x - p.x, dz = g.z - p.z, d = Math.hypot(dx, dz);
    const run = sprint && p.stam > 0.2;
    p.stam = Math.max(0, Math.min(sprintMax, p.stam + (run ? -dt : dt * 0.6)));
    const sp = Math.min(cap, crew.perks.walk * (run ? S.SPRINT.SPEED : 1));
    const step = Math.min(d, sp * dt);
    if (d > 1e-6) { p.x += dx / d * step; p.z += dz / d * step; p.yaw = Math.atan2(-dx, -dz); }
    S.clampToField(p, W());
    p.movedAt = t * 1000;
    if (p.wand && Math.hypot(p.x - WSTN.x, p.z - WSTN.z) > S.WASH.HOSE) p.wand = false;   // out of hose (input()'s rule)
    return Math.hypot(g.x - p.x, g.z - p.z) < 0.6;
  }
  // ---- the day job: pick up, bank ----
  const claimed = new Set();
  const okBall = b => b.rest && !b.sunk && !b.drifting && !b.creek && !b.cup && !b.hands && b.kind !== 'one' && !(Math.hypot(b.x - S.POND.x, b.z - S.POND.z) < S.POND.r + 0.5);
  function pickJob(p, dt) {
    const g = S.gearPerks(p.gear);
    if (p.pocket >= g.pocket || (p.pocket > 0 && p.bank)) {
      p.bank = true;
      const r = L.nearestReturn(p.x, p.z, crew.perks.returns ?? 0);
      if (r.id === 'main') { if (walkTo(p, STAND, dt)) { crew.deposit(p); p.bank = false; } }
      else if (walkTo(p, r, dt) || L.atFieldReturn(p, crew.perks.returns)) { crew.feedTube(p); p.bank = false; }
      return;
    }
    let b = p.tgt && crew.balls.get(p.tgt);
    if (!b || !okBall(b)) {
      if (p.tgt) claimed.delete(p.tgt);
      b = null; let bd = Infinity;
      for (const o of crew.balls.values()) { if (!okBall(o) || claimed.has(o.id)) continue; const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; b = o; } }
      p.tgt = b?.id; if (b) claimed.add(b.id);
    }
    if (!b) { if (p.pocket > 0) p.bank = true; return; }
    if (walkTo(p, b, dt) || Math.hypot(b.x - p.x, b.z - p.z) < g.reach) {
      for (const o of crew.balls.values()) { if (p.pocket >= g.pocket) break; if (okBall(o) && Math.hypot(o.x - p.x, o.z - p.z) <= g.reach) crew.pickup(p, o.id); }
      claimed.delete(b.id); p.tgt = null;
    }
  }
  // ---- the fight ----
  const fwd = m => ({ x: -Math.sin(m.yaw), z: -Math.cos(m.yaw) });
  const myCart = p => crew.cartOf(p);
  function drive(p, g, dt) {   // through the server's own driveTo (clamps, the creek, run-over)
    const c = myCart(p); if (!c) return false;
    const dx = g.x - c.x, dz = g.z - c.z, d = Math.hypot(dx, dz);
    const step = Math.min(d, crew.perks.cartSpeed * 0.95 * dt);
    const yaw = d > 0.05 ? Math.atan2(-dx, -dz) : c.yaw;
    const nx = c.x + (d > 0 ? dx / d * step : 0), nz = c.z + (d > 0 ? dz / d * step : 0);
    if (rats.some(o => o !== p && !myCart(o) && !(o.down > 0) && Math.hypot(o.x - nx, o.z - nz) < 2.6)) return false;   // a careful driver: never through a crewmate
    crew.input(p, { cart: { x: c.x + (d > 0 ? dx / d * step : 0), z: c.z + (d > 0 ? dz / d * step : 0), yaw } });
    return d < 0.8;
  }
  function getWand(p, dt) {
    if (p.wand) return true;
    if (myCart(p)) crew.leaveCart(p);
    if (walkTo(p, WSTN, dt, true)) crew.toggleWand(p);
    return false;
  }
  // Round 12: every spray on the grille goes through here, so the tally sees what counted (filled a meter or hit).
  function spray(p, m, dt) {
    const cl = MW.coolLeft(m, p.id);
    if (cl > 0 && cl < MW.BOSS.COOL_ME - REACT_COOL) return;   // the ring is grey (and the Rat has noticed): wait it out
    const before = m.meter[p.id] ?? 0, hits = m.hits;
    crew.wash(p, dt, 'mower');
    if (F) { F.sprayT += dt; if (cl > 0) F.coolT += dt; else if (m.hits > hits || (m.meter[p.id] ?? 0) > before) F.countT += dt; }
  }
  function hose(p, m, dt) {   // stay in its rear arc, inside reach, and spray
    const f = fwd(m), reach = (crew.perks.washReach ?? 7) - 1;
    const back = m.stall > 0 || m.stagger > 0 ? 2.5 : 4;
    const side = (p.id.charCodeAt(p.id.length - 1) % 3) - 1;   // spread the hosers a little
    const g = { x: m.x - f.x * back - f.z * side * 1.5, z: m.z - f.z * back + f.x * side * 1.5 };
    const d = Math.hypot(m.x - p.x, m.z - p.z);
    if (!(MW.behind(m, p) && d <= reach)) walkTo(p, g, dt, Math.hypot(g.x - p.x, g.z - p.z) > 6);
    else if (Math.hypot(g.x - p.x, g.z - p.z) > 1) walkTo(p, g, dt);
    if (p.wand && aimOn(p) && MW.behind(m, p) && Math.hypot(m.x - p.x, m.z - p.z) <= reach + 1) spray(p, m, dt);
  }
  function dodge(p, m, dt, toward = null) {   // the hunted Rat: lead it at the cart, or sidestep it
    const dx = p.x - m.x, dz = p.z - m.z, d = Math.hypot(dx, dz) || 1;
    if (toward) {   // put the cart between us: stand 3 m past it, on the far side from MOW-E
      const cx = toward.x - m.x, cz = toward.z - m.z, cd = Math.hypot(cx, cz) || 1;
      const g = { x: toward.x + cx / cd * 3.5, z: toward.z + cz / cd * 3.5 };
      walkTo(p, g, dt, d < 9);
      return;
    }
    const f = fwd(m), ahead = (f.x * dx + f.z * dz) / d;
    if (d < 7 && ahead > 0.3) {   // it's coming: sprint sideways
      const sx = -f.z, sz = f.x, s = sx * dx + sz * dz >= 0 ? 1 : -1;
      walkTo(p, { x: p.x + sx * s * 4, z: p.z + sz * s * 4 }, dt, true);
    } else if (p.wand && aimOn(p) && MW.behind(m, p) && d <= (crew.perks.washReach ?? 7)) spray(p, m, dt);
    else if (d > 6) walkTo(p, { x: m.x - f.x * 4, z: m.z - f.z * 4 }, dt);
  }
  function fightStep(p, m, dt, i) {
    const live = MW.bossLive(m);
    if (!live) { p.holding = false; return false; }
    if (p.role === 'idle') { p.holding = false; return false; }
    if (m.phase === 'warn' && m.t > MW.BOSS.WARN - REACT) return false;   // not noticed yet
    if (m.phase === 'plug') {   // everyone piles in
      if (myCart(p)) crew.leaveCart(p);
      if (p.holding && MW.inRing(m, p)) walkTo(p, m.ring, dt, false, MW.BOSS.HOLD_WALK);   // walk it backwards with the crew (2 m/s)
      else if (walkTo(p, m.ring, dt, true) || MW.inRing(m, p)) p.holding = true;
      return true;
    }
    p.holding = false;
    const cart = crew.carts[0];
    if (p.role === 'driver') {
      if (m.phase === 'warn' && !myCart(p)) { if (walkTo(p, cart, dt, true) || Math.hypot(cart.x - p.x, cart.z - p.z) < 2.5) crew.board(p); return true; }
      if (!myCart(p)) { if (cart.driver) return hose(p, m, dt), true; if (walkTo(p, cart, dt, true) || Math.hypot(cart.x - p.x, cart.z - p.z) < 2.5) crew.board(p); return true; }
      if (m.phase === 'warn') { drive(p, { x: MW.BOSS.X0 + 6, z: MW.BOSS.LANES[0] + 5 }, dt); return true; }
      const f = fwd(m), cool = (m.cool[cart.i] ?? -1) > m.clock;
      if (m.stall > 0) return true;   // sit tight: it's stalled on us
      // Park in its path and wait: a spot ~8 m ahead on its heading, re-picked once it's no longer ahead (or after a shove).
      const ahead = q => { const dx = q.x - m.x, dz = q.z - m.z, d = Math.hypot(dx, dz); return d < 16 && (f.x * dx + f.z * dz) / (d || 1) > 0.6; };
      if (!p.park || !ahead(p.park) || cool) p.park = { x: m.x + f.x * (cool ? 14 : 8), z: m.z + f.z * (cool ? 14 : 8) };
      drive(p, p.park, dt);
      return true;
    }
    if (p.role === 'solo-cart') {
      // Phase 1: park the cart on the first lane, grab the wand, chase. Phase 2: lead it past the parked cart, then hose.
      if (!p.parked) {
        if (!myCart(p)) { if (walkTo(p, cart, dt, true) || Math.hypot(cart.x - p.x, cart.z - p.z) < 2.5) crew.board(p); return true; }
        if (drive(p, { x: 6, z: -22 }, dt)) { crew.leaveCart(p); p.parked = true; }
        return true;
      }
      if (!getWand(p, dt)) return true;
      if (m.phase === 'warn') return walkTo(p, { x: 0, z: -10 }, dt), true;
      if (m.phase === 'hunt' && m.target === p.id && m.stall <= 0) { dodge(p, m, dt, (m.cool[cart.i] ?? -1) > m.clock ? null : cart); return true; }
      hose(p, m, dt);
      return true;
    }
    // a hoser
    if (!getWand(p, dt)) return true;
    if (m.phase === 'warn') return walkTo(p, { x: 10 + i * 4, z: -8 }, dt), true;
    if (m.phase === 'hunt' && m.target === p.id && m.stall <= 0) {
      const drv = rats.find(r => r.role === 'driver' && myCart(r));
      dodge(p, m, dt, drv && !((m.cool[cart.i] ?? -1) > m.clock) ? cart : null);
      return true;
    }
    hose(p, m, dt);
    return true;
  }

  const out = [];
  for (let day = 0; day < days; day++) {
    if (crew.phase !== 'shift') crew.startShift();
    const D = { day: crew.day, venue: crew.venue, vd: crew.venueDay, boss: crew.bossToday(), tameN: 0, tamePasses: 0, gary: crew.garyToday(), today: crew.today?.id ?? null };
    F = null;
    while (crew.phase === 'shift') {
      t += DT;
      const m = crew.mower?.kind === 'boss' ? crew.mower : null;
      rats.forEach((p, i) => {
        p.seenAt = t * 1000;
        if (m && fightStep(p, m, DT, i)) return;
        if (WHISTLE && i === 0 && crew.whistleState() === 1 && crew.shiftT >= crew.shiftSecs - WHISTLE - 30) {   // walk to the post, whistle at T-n
          if (myCart(p)) crew.leaveCart(p);
          if ((walkTo(p, MW.WHISTLE.POST, DT, true) || MW.atPost(p)) && crew.shiftT >= crew.shiftSecs - WHISTLE) { crew.input(p, { a: [{ t: 'whistle' }] }); D.whistleAt = Math.round(crew.shiftSecs - crew.shiftT); }
          return;
        }
        if (myCart(p)) crew.leaveCart(p);
        if (p.wand && !(m && MW.bossLive(m))) crew.toggleWand(p);
        if (SOFA && !(m && m.phase !== 'warn' && MW.bossLive(m)) && ((t + i * 0.7) % 4) < 2) return;
        pickJob(p, DT);
      });
      crew.tick(DT);
      if (F && m && MW.bossFighting(m)) for (const p of rats) if (p.wand && !(p.down > 0)) F.hoseT += DT;   // a hoser's fight time (the cooled-spray share)
      if (process.env.DBG && m && MW.bossLive(m) && Math.round(t * 20) % 20 === 0) { const c = crew.carts[0]; console.log(`DBG t${crew.shiftT.toFixed(0)} ${m.phase} boss(${m.x.toFixed(1)},${m.z.toFixed(1)}) yaw${m.yaw.toFixed(2)} stall${m.stall.toFixed(1)} full${Math.max(0, ...Object.values(m.meter)).toFixed(2)} tgt${m.target ?? '-'} cart(${c.x.toFixed(1)},${c.z.toFixed(1)}) drv${c.driver ? 'Y' : 'n'} cool${((m.cool[c.i] ?? 0) - m.clock).toFixed(1)} rats ` + rats.map(p => `${p.role[0]}(${p.x.toFixed(0)},${p.z.toFixed(0)})${p.wand ? 'w' : ''}${p.down > 0 ? 'X' : ''}`).join(' ')); }
      for (const e of crew.events) {
        if (e.t === 'mower' && e.boss) {
          if (e.phase === 'warn') F = { day: crew.day, encore: !!e.encore, n: rats.length, hp: e.hp, at: crew.shiftT, burst: null, hunt: null, plug: null, end: null, kd: 0, hits: 0, stalls: 0, honks: 0, pay: 0, bounty: 0, eaten: 0, result: null, reboots: 0, sprayT: 0, coolT: 0, countT: 0, hoseT: 0, by: {}, drag: 0 };
          if (!F) continue;
          if (e.phase === 'harvest') { F.burst = crew.shiftT; const rest = [...crew.balls.values()].filter(b => b.rest && !b.sunk); F.field = { all: rest.length, near: rest.filter(b => b.z > -42 && b.z < -8 && b.x > -40 && b.x < 60).length }; }
          if (e.phase === 'hunt') { F.hunt ??= crew.shiftT; F.ateHarvest ??= crew.mower?.eaten ?? 0; if (e.reboot) F.reboots++; }
          if (e.phase === 'plug') F.plug = crew.shiftT;
          if (e.phase === 'tamed') { F.result = 'win'; F.end = crew.shiftT; F.eaten = e.eaten; F.eatenW = e.eatenW ?? e.eaten; F.bounty = e.bounty; F.payN = e.n; F.plugLen = F.plug != null ? +(F.end - F.plug).toFixed(1) : null; const bm = crew.mower; if (bm?.ring0 && bm.burstAt) F.drag = +Math.hypot(bm.burstAt.x - bm.ring0.x, bm.burstAt.z - bm.ring0.z).toFixed(1); }
          if (e.phase === 'fled') { F.result = 'loss'; F.end = crew.shiftT; F.eaten = e.kept; F.final = !!e.final; }
          if (verbose) console.log(`  t${crew.shiftT.toFixed(1)} ${e.phase}${e.reboot ? ' (reboot)' : ''}`);
        }
        if (F && e.t === 'moweHit') { F.hits++; F.by[e.by] = (F.by[e.by] ?? 0) + 1; if (verbose) console.log(`  t${crew.shiftT.toFixed(1)} HIT by ${e.by} hp ${e.hp}`); }
        if (F && e.t === 'knock' && e.by === 'mower') { F.kd++; if (verbose) console.log(`  t${crew.shiftT.toFixed(1)} knocked ${e.id}`); }
        if (F && e.t === 'honk' && e.boss) F.stalls++;
        if (F && e.t === 'cash' && e.mowe && e.kind === 'mowe') F.pay += e.cash + (e.credit ?? 0);
        if (e.t === 'moweBank') { D.tameN += e.n; D.tamePasses++; }
      }
      crew.events = [];
      if (t > 1e6) throw new Error('runaway');
    }
    const r = crew.report;
    D.income = Math.round(r?.cash ?? crew.stats.cash);
    D.st = { ...crew.moweSt };
    if (F && F.day === D.day) {
      F.len = F.end != null && F.burst != null ? Math.round(F.end - F.burst) : null;
      // the payout: the bounty + the gold balls (×10 each) + the fountain (eaten ×2 as MOW-E balls), valued at the bounty's per-weight price
      F.payout = F.result === 'win' ? Math.round(F.bounty * (1 + (Math.min(MW.BOSS.GOLD, F.n) * S.KIND_W.gold + MW.BOSS.PAYX * (F.eatenW ?? 0)) / MW.BOSS.BOUNTY)) : 0;
      F.everyRat = Object.keys(F.by).length >= F.n;
      F.coolPct = F.hoseT > 0 ? +(F.coolT / F.hoseT).toFixed(3) : 0; F.countPct = F.sprayT > 0 ? +(F.countT / F.sprayT).toFixed(3) : 0;
      F.share = +(F.payout / Math.max(1, D.income)).toFixed(3);
      D.fight = F;
    }
    out.push(D);
    if (verbose) console.log(JSON.stringify(D));
  }
  return out;
}

// ---- CLI ----
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('boss.mjs')) {
  const [policy = 'all', seedA, where = 'club', daysA] = process.argv.slice(2);
  if (policy !== 'all') {
    const res = runBoss({ policy, seed: +(seedA ?? 7), where, days: +(daysA ?? 1) });
    for (const d of res) console.log(JSON.stringify(d));
  } else {
    const SEEDS = [7, 11, 23];
    const fmt = f => f ? `${f.result}${f.len != null ? ' ' + f.len + 's' : ''} hp${f.hp} ate${f.eaten} kd${f.kd} hits${f.hits} rats${Object.keys(f.by).length}/${f.n} stalls${f.stalls} plug${f.plugLen ?? '-'}s drag${f.drag}m cool${(f.coolPct * 100).toFixed(0)}% counts${(f.countPct * 100).toFixed(0)}% share${(f.share * 100).toFixed(1)}%${f.reboots ? ' reboots' + f.reboots : ''}` : 'no fight';
    for (const pol of ['4p-roles', '4p-swarm', '3p', '2p', '1p-cart', '1p-chase']) {
      for (const sd of SEEDS) { const [d] = runBoss({ policy: pol, seed: sd }); console.log(`club   ${pol.padEnd(9)} seed ${sd}: ${fmt(d.fight)} · income $${d.income}`); }
    }
    for (const pol of ['idle', 'idle-1p']) for (const sd of SEEDS) {
      const res = runBoss({ policy: pol, seed: sd, days: 4 });
      console.log(`club   ${pol.padEnd(9)} seed ${sd}: ` + res.map(d => `d${d.vd}:${d.boss ?? '-'}:${d.fight ? d.fight.result + (d.fight.final ? '(tamed)' : '') : 'tame ' + d.tameN + '/' + d.tamePasses}`).join(' · ') + ` · end ${JSON.stringify(res.at(-1).st)}`);
    }
    for (const pol of ['4p-roles', '4p-swarm', '1p-cart', '1p-chase']) for (const sd of SEEDS) {
      const [d] = runBoss({ policy: pol, seed: sd, where: 'stadium' });
      console.log(`stadium ${pol.padEnd(9)} seed ${sd}: ${fmt(d.fight)} · income $${d.income}`);
    }
  }
}
