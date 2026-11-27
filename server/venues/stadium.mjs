// The Stadium (venue 3): the Ping Track and Crowd Sentiment (council round 4, §3.2, build item 7).
// The crowd's mood is this venue's KPI. Pings, laps, targets and knockdowns feed it; time drains it.
import { onTrack, cartSpeedAt } from '../../web/js/map.js';
import { CROWD, gateAt, newLap, stepLap, stepSentiment, bump, pingDelta, newWindow, pushSample, windowMean,
  CROWD_LINE, crowdDecay, BOO, SOUV, atRail, souvCrowd, booOut,
  REQ, SECTIONS, reqDue, reqSection, inSection, souvPay, reqCrowd, reqMiss,
  autoCeil, bumpAuto, ROBOT_LINE, STRETCH, stretchDue, reqPaused, stretchSections, stretchPay, stretchCrowd, reqRot } from '../../web/js/stadium.js';
import { AUTO, newAuto, stepAutopilot, nextMode } from '../../web/js/autopilot.js';
import { bossLive } from '../../web/js/mowe.js';
import { LANDMARK, hasLandmark, FIREWORKS, GRAND_SLAM } from '../../web/js/landmarks.js';   // council round 13 #4 (builder 2): Stretch fireworks   // council round 11 §2.7: MOW-E 2.0, the encore (builder 1)

// Council round 11 §2.7: while MOW-E 2.0 is a live boss the crowd doesn't drain; each hit +HIT; a win fills it.
export const BOSS_CROWD = { HIT: 0.08, WIN: 1 };
import { SIM, CART, WASH, KIND_W, underReels } from '../../web/js/sim.js';

// Round 7 #7: st.s is the live mood (the jumbotron, the bob, the ambience); the gauge the Board shows and the bell grades
// is the mean of the last 120 s of it (st.win, sampled once a second of working shift; before the first sample, st.s).
// One lap tracker per cart (the fleet: two drivers can race). `lap` is the first cart's, kept for old readers.
const fresh = () => { const lapBy = [newLap(), newLap()]; return { s: CROWD.START, laps: 0, knocks: 0, lapBy, lap: lapBy[0], t: 0, lastKnock: null, lastPing: null, win: newWindow(), acc: 0,
  auto: [], autoLaps: 0,   // council round 10 §D: each cart's autopilot (autopilot.js), and its half-credit laps
  hands: {}, booT: 0, boos: 0, souv: 0, sv: false,
  req: null, reqN: 0, reqLast: null, reqHit: 0, reqMissed: 0, bossHits: 0, bossWon: false,
  rot: 0, stretch: null, stretchDone: false, stretchHit: 0, stretchMissed: 0, robotSaid: false }; };   // council round 12 #2: the request order's rotation, the Stretch ({ secs: [i], left }), the robot's first drop   // council round 11 #5: the lit section ({ i, sec, left }), how many so far, the last start   // round 11: souvenirs in hands ({ [player id]: { n, relay } }), the boo clock

// Council round 10 §D: the cart row's tier 4. An undriven cart drives itself during the shift (it laps, or harvests
// after someone holds Ⓨ at it); c.auto is its mode while it does ('lap' | 'harvest', null when driven or parked), which
// crew.mjs reads to let a crew ping on it pay.
const autoOn = crew => !!crew.perks?.autopilot && crew.working();
function autopilot(crew, st, c, i, dt) {
  const a = st.auto[i] ??= newAuto();
  const people = [...crew.players.values()].filter(o => o.online > 0 && !crew.driving(o) && o.down <= 0).concat(crew.helpers ?? []);
  const r = stepAutopilot(c, a, { dt, t: st.t, world: crew.world(), speed: crew.perks.cartSpeed, mul: (x, z) => cartSpeedAt(x, z, crew.world()),
    cap: crew.perks.cartCap, balls: crew.balls.values(), people, stand: SIM.STAND, reach: SIM.STAND_REACH + 2,
    avoid: { x: SIM.STAND.x, z: SIM.STAND.z, r: SIM.STAND_REACH + AUTO.STOP_R },   // playthrough 5 C6: lap routes swing round the return
    underReels: (cc, b) => underReels(cc, b, crew.perks.cartReel) });
  for (const b of r.scooped) {
    if (!crew.balls.has(b.id) || c.load >= crew.perks.cartCap) continue;
    crew.balls.delete(b.id);
    const k = crew.loadOf(b);
    c.load += k; c.loadW = (c.loadW ?? 0) + (KIND_W[b.kind] ?? 1) * (k === 3 ? 3 : 1); crew.stats.picked += k; crew.stats.carted += k;
    crew.events.push({ t: 'gone', id: b.id, by: 'cart' });
  }
  if (r.moved > 0) { c.mud = Math.min(1, (c.mud ?? 0) + r.moved * WASH.MUD_PER_M); c.v = r.moved / Math.max(dt, 1e-3); crew.dirty = true; }
  else c.v = 0;
  return a;
}
const graded = st => windowMean(st.win) ?? st.s;

// ---- round 11 (expert #6): below the line the crowd boos, and a customer walks out every BOO.EVERY s ----------------
function boo(crew, st, dt) {
  if (crew.closing?.() || st.t < BOO.GRACE || graded(st) + 1e-9 >= CROWD_LINE) { st.booT = 0; return; }
  if ((st.booT += dt) < BOO.EVERY) return;
  st.booT = 0;
  // The seated customer with the most bucket left (no RNG draw: the seam's RNG stays as it was).
  let m = null;
  for (const o of crew.mats ?? []) if (o.st === 'playing' && o.balls > 0 && (!m || o.balls > m.balls)) m = o;
  const ev = m ? booOut(m, crew.custT ?? 0) : [];
  st.boos++;
  crew.stats.booed = (crew.stats.booed ?? 0) + (ev.length ? 1 : 0);
  crew.events.push({ t: 'crowd', kind: 'boo', mat: ev.length ? m.i : null, n: st.boos });
  crew.dirty = true;
}

// ---- round 11 (expert #9): souvenir balls -------------------------------------------------------------------------
// Rats only: walk one to the crowd rail and the crowd cheers; pass it to a mate on the way and it counts double.
function souvenirs(crew, st) {
  const ids = Object.keys(st.hands);
  if (!ids.length) return;
  for (const id of ids) {
    const h = st.hands[id], p = crew.players.get(id);
    if (!h) continue;
    if (!p || p.online <= 0) { delete st.hands[id]; continue; }
    if (p.down > 0) continue;
    if (atRail(p.x, p.z)) {                                           // delivered: the crowd, and the pay
      if (crew.working() && st.stretch) { stretchDeliver(crew, st, p, h); continue; }   // council round 12 #2c: one section a souvenir; the rest stay in hand
      delete st.hands[id];
      if (!crew.working()) continue;
      const lit = !!st.req && inSection(SECTIONS[st.req.i], p.x, p.z);   // council round 11 #5: the lit section pays x3
      st.s = bump(st.s, lit ? reqCrowd(h.n) : souvCrowd(h.n, h.relay)); st.souv += h.n;
      crew.stats.souvenirs = (crew.stats.souvenirs ?? 0) + h.n;
      const c0 = crew.stats.cash;
      crew.bank(h.n, p.id, null, souvPay(h.n, h.relay, lit), null, { souv: h.n, ...(lit ? { req: true } : h.relay ? { relay: true } : {}) });
      crew.stats.souvCash = Math.round(((crew.stats.souvCash ?? 0) + crew.stats.cash - c0) * 100) / 100;   // the report (and the bot): what the job paid
      crew.events.push({ t: 'crowd', kind: 'souv', by: p.id, name: p.name, n: h.n, ...(lit ? { req: st.req.sec } : h.relay ? { relay: true } : {}) });
      if (lit) { st.req = null; st.reqHit++; crew.stats.reqHit = (crew.stats.reqHit ?? 0) + 1; crew.goalTick?.('requests'); }   // council round 12 #2b
      crew.dirty = true;
      continue;
    }
    if (h.relay || crew.driving?.(p)) continue;                      // a relayed bundle doesn't pass again
    for (const o of crew.players.values()) {                         // the hand-off: a mate with empty hands, close by
      if (o === p || o.online <= 0 || o.down > 0 || st.hands[o.id] || crew.driving?.(o) || o.diving) continue;
      if (Math.hypot(o.x - p.x, o.z - p.z) > SOUV.HANDOFF_R) continue;
      delete st.hands[id]; st.hands[o.id] = { n: h.n, relay: true, from: p.id };
      crew.events.push({ t: 'crowd', kind: 'relay', by: p.id, to: o.id, n: h.n });
      crew.dirty = true;
      break;
    }
  }
}
// ---- council round 11 #5: souvenir requests. One section lit at a time; answered in souvenirs(), missed here. -------
function requests(crew, st, dt) {
  const n = crew.onlineCount();
  if (st.req) {
    if ((st.req.left -= dt) > 0) return;
    const sec = st.req.sec; st.req = null; st.reqMissed++;
    st.s = bump(st.s, -reqMiss(n));
    crew.events.push({ t: 'crowd', kind: 'reqmiss', sec, ceil: Math.round(autoCeil(st.reqMissed) * 100) / 100 });
    if (!st.robotSaid) { st.robotSaid = true; crew.events.push({ t: 'crowd', kind: 'robot', text: ROBOT_LINE }); }   // council round 12 #2a: feed only
    crew.dirty = true;
    return;
  }
  const left = crew.shiftSecs - crew.shiftT;
  if (st.stretch || (!st.stretchDone && reqPaused(left)) || !reqDue({ t: st.t, left, last: st.reqLast, n })) return;   // council round 12 #2c: nothing lit overlaps the Stretch
  const sec = reqSection(st.reqN++ + st.rot);   // council round 12 #2e: rotated per shift
  st.req = { i: sec.i, sec: sec.name, left: REQ.SECS }; st.reqLast = st.t;
  crew.events.push({ t: 'crowd', kind: 'req', sec: sec.name, i: sec.i, secs: REQ.SECS });
  crew.dirty = true;
}
// ---- council round 12 #2c: the Seventh-Inning Stretch. Once a shift at T-3:30, 2-3 sections light at once for 25 s. ----
function stretch(crew, st, dt) {
  if (st.stretch) {
    if ((st.stretch.left -= dt) > 0) return;
    const missed = st.stretch.secs.map(i => SECTIONS[i].name);
    st.stretchMissed += missed.length;
    if (missed.length) st.s = bump(st.s, -STRETCH.MISS * missed.length);   // no boo: it's a party
    crew.events.push({ t: 'crowd', kind: 'stretchend', missed: missed.join(''), hit: st.stretchHit });
    if (!missed.length && st.stretch.fw) {                             // council round 13 #4: every section answered, with fireworks
      st.s = bump(st.s, FIREWORKS.SLAM); crew.stats.grandSlams = (crew.stats.grandSlams ?? 0) + 1;
      crew.events.push({ t: 'crowd', kind: 'grandslam', text: GRAND_SLAM });
    }
    st.stretch = null; crew.dirty = true;
    return;
  }
  const busy = !!st.req || bossLive(crew.mower?.kind === 'boss' ? crew.mower : null);
  if (!stretchDue({ left: crew.shiftSecs - crew.shiftT, done: st.stretchDone, busy })) return;
  st.stretchDone = true;
  const fw = hasLandmark(crew.up, LANDMARK.FIREWORKS);                // council round 13 #4: one more section
  const secs = stretchSections(crew.day, crew.venueDay, crew.onlineCount(), fw ? FIREWORKS.EXTRA : 0);
  st.stretch = { secs, left: STRETCH.SECS, fw };
  crew.events.push({ t: 'crowd', kind: 'stretch', secs: secs.map(i => SECTIONS[i].name).join(''), i: [...secs], n: secs.length, left: STRETCH.SECS });
  crew.dirty = true;
}
// During the Stretch, at the rail: in a lit section, ONE souvenir from the bundle answers it (x5, +0.15) and the rest stay
// in your hands for the next section along (lead's call, round 14); outside one, nothing is delivered until it's over.
// True when a section was answered.
function stretchDeliver(crew, st, p, h) {
  if (!st.stretch) return false;
  const k = st.stretch.secs.findIndex(i => inSection(SECTIONS[i], p.x, p.z));
  if (k < 0) return false;
  const sec = SECTIONS[st.stretch.secs[k]];
  st.stretch.secs.splice(k, 1);
  if (--h.n <= 0) delete st.hands[p.id];
  st.s = bump(st.s, stretchCrowd(1)); st.souv += 1; st.stretchHit++;
  crew.stats.souvenirs = (crew.stats.souvenirs ?? 0) + 1;
  crew.stats.reqHit = (crew.stats.reqHit ?? 0) + 1;
  const c0 = crew.stats.cash;
  crew.bank(1, p.id, null, stretchPay(1), null, { souv: 1, req: true });
  crew.stats.souvCash = Math.round(((crew.stats.souvCash ?? 0) + crew.stats.cash - c0) * 100) / 100;
  crew.events.push({ t: 'crowd', kind: 'souv', by: p.id, name: p.name, n: 1, req: sec.name, stretch: true, ...(h.n > 0 ? { left: h.n } : {}) });
  crew.goalTick?.('requests');
  crew.dirty = true;
  return true;
}
// A knocked-down Rat's souvenirs go everywhere (still souvenirs).
function dropHands(crew, st, p) {
  const h = st.hands?.[p.id];
  if (!h) return;
  delete st.hands[p.id];
  for (let i = 0; i < h.n; i++) {
    const a = i * 2.1;
    const b = crew.addBall({ x: p.x + Math.cos(a) * 0.6, y: 0.3, z: p.z + Math.sin(a) * 0.6, vx: Math.cos(a), vy: 2.2, vz: Math.sin(a), kind: 'souvenir' });
    if (b) b.hands = true;
  }
}

export default {
  id: 'stadium',
  venue: 3,
  init: () => fresh(),
  // Playthrough 5 C9: each cart's autopilot mode (harvest) carries over the night.
  startShift(crew, st) { const modes = (st.auto ?? []).map(a => a?.mode); Object.assign(st, fresh()); modes.forEach((m, i) => { if (m) st.auto[i] = newAuto(m); }); st.rot = reqRot(crew.day, crew.venueDay); },
  tick(crew, st, dt) {
    if (!crew.working()) return;
    st.t += dt;
    const boss = crew.venue === 3 && crew.mower?.kind === 'boss' ? crew.mower : null;   // council round 11 §2.7: the encore
    if (boss) {
      const h = boss.hits | 0;
      if (h > st.bossHits) st.s = bump(st.s, BOSS_CROWD.HIT * (h - st.bossHits));
      st.bossHits = h;
      if (boss.phase === 'tamed' && !st.bossWon) { st.bossWon = true; st.s = BOSS_CROWD.WIN; }
    }
    const home = crew.venue === 3 && !crew.endless;                   // council round 12 #2f: the crowd stops at the Stadium
    if (home && !bossLive(boss)) st.s = stepSentiment(st.s, dt, crowdDecay(crew.onlineCount()));   // round 11 (expert #6): the drain grows with the crew
    if (crew.venue === 3) { boo(crew, st, dt); souvenirs(crew, st); if (!crew.endless) { requests(crew, st, dt); stretch(crew, st, dt); } }
    st.acc += dt;
    while (st.acc >= 1 - 1e-9) { st.acc -= 1; pushSample(st.win, st.s); }
    const carts = crew.carts ?? (crew.cart ? [crew.cart] : []);
    const self = autoOn(crew);
    carts.forEach((c, i) => {                                         // every driven cart's pose
      const lap = st.lapBy[i] ??= newLap();
      c.auto = self && !c.driver ? (st.auto[i] ??= newAuto()).mode : null;
      if (c.auto && crew.garyHolds?.(c)) { c.v = 0; return; }         // playthrough 5 C1: Gary is coming to inspect it: it waits
      if (c.auto) {                                                   // council round 10 §D: on autopilot
        const a = autopilot(crew, st, c, i, dt);
        if (a.mode === 'lap' && stepLap(lap, gateAt(c.x, c.z), st.t)) {   // half credit: +0.03, and it counts as half a lap
          st.autoLaps++; st.s = bumpAuto(st.s, AUTO.LAP_CROWD, autoCeil(st.reqMissed));   // council round 12 #2a: the robot's ceiling
          crew.events.push({ t: 'crowd', kind: 'lap', by: null, auto: true, cart: i, laps: st.laps });
        } else if (a.mode !== 'lap') Object.assign(lap, newLap());
        return;
      }
      if (!c.driver) { Object.assign(lap, newLap()); return; }      // a parked cart is not racing
      if (stepLap(lap, gateAt(c.x, c.z), st.t)) {
        st.laps++; st.s = bump(st.s, CROWD.LAP);
        crew.events.push({ t: 'crowd', kind: 'lap', by: c.driver, laps: st.laps });
      }
    });
  },
  ping(crew, st, b, { prize, cart }) {
    // Council round 10 §D: a ping on an autopilot cart is the Stadium show: +0.08 wherever it is (and every prize works).
    if (cart && !cart.driver && cart.auto) st.s = bumpAuto(st.s, CROWD.PING + (prize === 'jackpot' ? CROWD.JACKPOT : 0), autoCeil(st.reqMissed));   // council round 12 #2a
    else st.s = bump(st.s, pingDelta(!!cart && onTrack(cart.x, cart.z), prize));
    st.lastPing = crew.players.get(b.by)?.name ?? null;
    crew.events.push({ t: 'crowd', kind: 'ping', by: b.by, name: st.lastPing });
  },
  knockDown(crew, st, p) {
    dropHands(crew, st, p);
    if (!crew.working()) return;
    st.knocks++;
    if (st.knocks <= CROWD.KNOCK_CAP) st.s = bump(st.s, CROWD.KNOCK);
    st.lastKnock = p.name;
    crew.events.push({ t: 'crowd', kind: 'knock', id: p.id, name: p.name, n: st.knocks });
  },
  // Council round 10 §D: Ⓨ held at an undriven cart (autopilot owned) switches it lap <-> harvest.
  input(crew, st, p, a) {
    if (a.t !== 'auto') return false;
    if (!crew.perks?.autopilot || p.down > 0 || crew.driving(p)) return true;
    const carts = crew.carts ?? [];
    let best = -1, bd = CART.BOARD_REACH + 1;
    carts.forEach((c, i) => { const d = Math.hypot(c.x - p.x, c.z - p.z); if (!c.driver && d <= bd) { bd = d; best = i; } });
    if (best < 0) return true;
    const au = st.auto[best] ??= newAuto();
    au.mode = nextMode(au.mode); au.target = null;
    crew.events.push({ t: 'auto', cart: best, mode: au.mode, by: p.id }); crew.dirty = true;
    return true;
  },
  signal(crew, st, name) {
    if (name === 'target' && crew.working()) st.s = bump(st.s, CROWD.TARGET);   // Tiered's TARGET! (the bowls are still there)
  },
  // Round 11: a Stadium customer's range ball is a souvenir with SOUV.CHANCE (only at the Stadium itself).
  launchMod(crew, st, shot, { lead, upper }) {
    if (crew.venue !== 3 || lead || upper || shot.kind !== 'range' || crew.endless) return shot;
    if (crew.rng() >= SOUV.CHANCE) return shot;
    if (!st.sv) { st.sv = true; crew.dirty = true; }
    return { ...shot, kind: 'souvenir', hands: true };
  },
  // A Rat picks up a souvenir: into their hands (up to SOUV.HANDS), not the pocket.
  take(crew, st, p, b) {
    if (b.kind !== 'souvenir') return false;
    const h = st.hands[p.id];
    if (h && h.n >= SOUV.HANDS) return false;
    crew.balls.delete(b.id); crew.stats.picked++;
    if (h) { h.n++; h.relay = false; } else st.hands[p.id] = { n: 1, relay: false };   // a fresh one makes the bundle passable again
    crew.events.push({ t: 'gone', id: b.id, by: p.id });
    crew.dirty = true;
    return true;
  },
  kpi: (crew, st) => graded(st),
  // s: the live mood; k: the graded 2-minute mean; w: the Three-Minute Warning is up (round 11: T-3:00) (until Last Call takes the Board).
  // auto (council round 10 §D, only once the row is owned): each cart's mode ('lap' | 'harvest'), and the half laps.
  snapshot: (crew, st) => ({ s: Math.round(st.s * 1000) / 1000, k: Math.round(graded(st) * 1000) / 1000, laps: st.laps, knocks: st.knocks,
    ...(crew.perks?.autopilot ? { auto: (crew.carts ?? []).map((c, i) => st.auto[i]?.mode ?? 'lap'), autoLaps: st.autoLaps } : {}),
    ...(crew.warned && !crew.lastCall() ? { w: 1 } : {}),
    ...(Object.keys(st.hands ?? {}).length ? { hands: Object.fromEntries(Object.entries(st.hands).map(([id, h]) => [id, h.relay ? -h.n : h.n])) } : {}),   // round 11: n (negative: relayed)
    ...(st.sv ? { sv: 1 } : {}), ...(st.boos ? { boos: st.boos } : {}),
    ...(st.req ? { req: { i: st.req.i, sec: st.req.sec, left: Math.round(st.req.left * 10) / 10 } } : {}),
    ...(st.stretch ? { stretch: { ...(st.stretch.fw ? { fw: 1 } : {}), i: [...st.stretch.secs], secs: st.stretch.secs.map(i => SECTIONS[i].name).join(''), t: Math.round(st.stretch.left * 10) / 10 } } : {}),   // council round 12 #2c (bvtext.js kpiNoteOf)
    ...(crew.perks?.autopilot && crew.venue === 3 ? { ceil: Math.round(autoCeil(st.reqMissed) * 100) / 100 } : {}) }),   // council round 11 #5 (board.js: reqLine)
};
