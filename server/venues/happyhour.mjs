// Council round 14 #2 (builder 2): Happy Hour on the Tiered deck, and the solo Tiered fix. A venue module (venue 2); it
// runs only while crew.venue === 2 and not endless. The rules are web/js/happyhour.js (the window, the loungers' balls)
// and web/js/deck.js (happyFill, the x1.5 tab); the neon beams and the loungers' wave are web/js/views/happyhour.js.
// Council round 14 #3a: Ⓐ at the Members' Bell (landmark tier 1) rings a bonus Happy Hour here, once a shift.
// Council round 14 #2b: the bowls read scales by crew size (rally.js bowlsPass): at Last Call, a 1P/2P crew that has
// shot the bowls down to half / a quarter of their load at the rally's start passes the gauge (tiered.mjs's frozen read
// is lifted to QUOTA_KPI). This module runs after tiered.mjs in MODULES, so it reads that read the same tick.
// No RNG draw anywhere (hash32 spots).
import { QUOTA_KPI } from '../../web/js/sim.js';
import { nearestReturn } from '../../web/js/layout.js';
import { isPromotionDay } from '../../web/js/promoday.js';
import { markHappy, openCount } from '../../web/js/deck.js';
import { HAPPY, happyDay, happyTime, bonusClear, greenSpots, chipShot, happyBallSecs, happyRow } from '../../web/js/happyhour.js';
import { atBell, bellOpen, hasLandmark, LANDMARK } from '../../web/js/landmarks.js';
import { bowlsPass } from '../../web/js/rally.js';

const fresh = () => ({ at: null, done: false, live: null, k: 0, balls: [], held: {}, n: 0, banked: 0, lapsed: 0, cash: 0,
  pours0: 0, tab0: 0, bell: false, load0: null, eased: false });
const r2 = v => Math.round(v * 100) / 100;
const out = e => e.st === 'out' || e.st === 'air';
const here = crew => crew.venue === HAPPY.VENUE && !crew.endless;
const cupLoad = crew => (crew.mods.state('tiered')?.cups ?? []).reduce((a, c) => a + c, 0);

function addLounger(crew, s) {
  const b = crew.addBall(s) ?? (() => {
    const m = { id: crew.nextBall++, ...s, rest: false, acc: 0 };
    crew.balls.set(m.id, m);
    crew.events.push({ t: 'spawn', id: m.id, x: m.x, y: m.y, z: m.z, vx: m.vx, vy: m.vy, vz: m.vz, kind: m.kind });
    return m;
  })();
  b.hands = true; b.lounger = true;
  return b;
}

// One window: the deck fills, the loungers chip their balls onto the greens. bonus: the bell's.
function start(crew, st, bonus = false) {
  const d = crew.mods.state('deck')?.deck;
  crew.mods.signal('happyhour');                           // deck.mjs fills the queue (and the Tap Wall pours its share)
  const n = crew.onlineCount(), spots = greenSpots(crew.day, crew.venueDay, n, st.k), secs = happyBallSecs(n);
  st.live = { until: crew.shiftT + HAPPY.SECS, bonus };
  // The upper bays' golfers ARE the loungers: for the window they put their clubs down to drink (and chip at the greens),
  // so the bowls don't fill while the crew is out fetching. The bots: without it a 4P crew missed the bowls at 0.43-0.45.
  for (const m of crew.mats ?? []) if (m.upper) m.next = Math.max(0, m.next ?? 0) + HAPPY.SECS;
  st.k++;
  for (const s of spots) {
    const b = addLounger(crew, { ...chipShot(s), kind: 'souvenir' });   // pink-neon, Rats-only: the souvenir's look (no Stadium module here)
    st.balls.push({ id: b.id, k: st.k - 1, st: 'air', left: secs, x: s.x, z: s.z, bowl: s.bowl, by: null });
  }
  st.n += spots.length;
  crew.stats.happyOut = (crew.stats.happyOut ?? 0) + spots.length;
  crew.events.push({ t: 'happy', phase: 'start', call: 'lounger', n: spots.length, bonus, orders: d ? openCount(d) : 0, secs,   // calls.mjs: one call a green
    spots: spots.map(s => ({ x: s.x, z: s.z, bowl: s.bowl })) });
  crew.dirty = true;
}

function bankLounger(crew, st, e, by) {
  e.st = 'banked'; st.banked++;
  const p = crew.players.get(by);
  crew.bank(1, p ? p.id : null, p ? null : 'happy', HAPPY.BALL_PAY, null, { happy: 1 });
  const ev = crew.events.at(-1), got = ev?.t === 'cash' ? r2((ev.cash ?? 0) + (ev.credit ?? 0)) : 0;
  st.cash = r2(st.cash + got);
  crew.stats.happyBanked = (crew.stats.happyBanked ?? 0) + 1;
  crew.events.push({ t: 'happy', phase: 'bank', by: p?.id ?? null, name: p?.name ?? null, cash: got });
  crew.dirty = true;
}

// The solo Tiered fix: lift tiered.mjs's frozen Last Call read to the tick when a small crew shot the bowls down enough.
function bowls(crew, st) {
  const t = crew.mods.state('tiered');
  if (!t || isPromotionDay(crew)) return;
  if (st.load0 == null && crew.warned) st.load0 = cupLoad(crew);   // the T-3:00 rally just fired (crew.warnDue)
  if (st.eased || t.kpiAtClose == null) return;
  st.eased = true;
  if (t.kpiAtClose + 1e-9 >= QUOTA_KPI) return;
  if (bowlsPass({ n: crew.onlineCount(), load0: st.load0 ?? 0, load: cupLoad(crew) })) {
    t.kpiAtClose = QUOTA_KPI;
    crew.stats.bowlsEased = (crew.stats.bowlsEased ?? 0) + 1;
    crew.dirty = true;
  }
}

function step(crew, st, dt) {
  if (st.at != null && !st.done && !st.live && crew.shiftT >= st.at) { st.done = true; start(crew, st, false); }
  if (st.live) {
    const d = crew.mods.state('deck')?.deck;
    if (d) markHappy(d);                                    // an order raised mid-window is a Happy Hour order too
    if (crew.shiftT >= st.live.until) { st.live = null; crew.events.push({ t: 'happy', phase: 'end' }); crew.dirty = true; }
  }
  for (const e of st.balls) {
    if (!out(e)) continue;
    const b = crew.balls.get(e.id);
    if (!b) { e.st = 'lost'; continue; }
    if (b.rest) { e.st = 'out'; e.x = b.x; e.z = b.z; }
    if ((e.left -= dt) > 0) continue;
    crew.balls.delete(e.id);                                 // the lounger shrugs
    e.st = 'lapsed'; st.lapsed++;
    crew.events.push({ t: 'gone', id: e.id, by: 'lounger' }, { t: 'happy', phase: 'lapse', x: r2(e.x), z: r2(e.z) });
    crew.dirty = true;
  }
  for (const id of Object.keys(st.held)) {
    const p = crew.players.get(id);
    if (!p || !(st.held[id] > 0)) { delete st.held[id]; continue; }
    if (p.down > 0) continue;
    const r = nearestReturn(p.x, p.z, crew.perks?.returns ?? 0);
    if (Math.hypot(p.x - r.x, p.z - r.z) > HAPPY.BANK_R) continue;
    for (const e of st.balls) if (e.st === 'held' && e.by === id) bankLounger(crew, st, e, id);
    delete st.held[id];
  }
}

const bellNow = (crew, st) => bellOpen({ left: crew.shiftSecs - crew.shiftT, rung: st.bell, venue: crew.venue, endless: crew.endless,
  live: !bonusClear({ t: crew.shiftT, at: st.at, done: st.done, live: !!st.live }) });

export default {
  id: 'happyhour',
  venue: HAPPY.VENUE,
  init: () => fresh(),
  startShift(crew, st) {
    Object.assign(st, fresh());
    if (!here(crew)) return;
    if (happyDay({ venue: crew.venue, endless: crew.endless, promo: isPromotionDay(crew) })) st.at = happyTime(crew.shiftSecs, crew.onlineCount());
    st.pours0 = crew.stats.happyPours ?? 0; st.tab0 = crew.stats.happyTab ?? 0;
  },
  tick(crew, st, dt) {
    if (!here(crew) || !crew.working()) return;
    bowls(crew, st);
    if (st.at == null && !st.live && !st.balls.length) return;
    step(crew, st, dt);
  },
  take(crew, st, p, b) {
    if (!b.lounger) return false;
    const e = st.balls.find(o => o.id === b.id);
    crew.balls.delete(b.id); crew.stats.picked++;
    crew.events.push({ t: 'gone', id: b.id, by: p.id });
    if (!e || !out(e)) return true;
    e.st = 'held'; e.by = p.id;
    st.held[p.id] = (st.held[p.id] ?? 0) + 1;
    crew.events.push({ t: 'happy', phase: 'take', by: p.id, name: p.name, answer: 'lounger' });
    crew.dirty = true;
    return true;
  },
  knockDown(crew, st, p) {
    if (!(st.held[p.id] > 0)) return;
    delete st.held[p.id];
    let i = 0;
    for (const e of st.balls) {
      if (e.st !== 'held' || e.by !== p.id) continue;
      const a = i++ * 2.1;
      const b = addLounger(crew, { x: p.x + Math.cos(a) * 0.6, y: 0.3, z: p.z + Math.sin(a) * 0.6, vx: Math.cos(a), vy: 2.2, vz: Math.sin(a), kind: 'souvenir' });
      e.id = b.id; e.st = 'air'; e.by = null; e.left = Math.max(e.left, HAPPY.DROPPED_SECS);
    }
    crew.dirty = true;
  },
  // Ⓐ at the Members' Bell at Tiered: a bonus Happy Hour, once a shift, never inside (or on top of) today's.
  input(crew, st, p, a) {
    if (a.t !== 'bell' || !here(crew)) return false;
    if (!hasLandmark(crew.up, LANDMARK.BELL) || !atBell(p) || p.down > 0 || !crew.working()) return true;
    if (!bellNow(crew, st)) { crew.events.push({ t: 'happy', phase: 'bellno', by: p.id }); return true; }
    st.bell = true;
    crew.stats.bellRung = (crew.stats.bellRung ?? 0) + 1;
    crew.events.push({ t: 'happy', phase: 'bell', by: p.id, name: p.name });
    start(crew, st, true);
    return true;
  },
  endShift(crew, st) {
    if (!here(crew)) return;
    for (const e of st.balls) {
      if (e.st === 'held') bankLounger(crew, st, e, e.by);
      else if (out(e)) { crew.balls.delete(e.id); e.st = 'lapsed'; st.lapsed++; }
    }
    st.held = {}; st.live = null;
  },
  reportRows(crew, st) {
    if (!here(crew) || !st.k) return [];
    const pours = (crew.stats.happyPours ?? 0) - st.pours0, tab = (crew.stats.happyTab ?? 0) - st.tab0;
    const r = happyRow({ pours, got: st.banked, n: st.n, cash: st.cash + tab });
    return r ? [r] : [];
  },
  // s.mods.happyhour: the window (the Board's line), the balls out (the view's beams), who holds one, the bell
  // (landmarks.js bellStateOf: 1 open, 2 rung, 0 shut).
  snapshot(crew, st) {
    if (!here(crew)) return undefined;
    const bell = hasLandmark(crew.up, LANDMARK.BELL);
    const live = st.balls.some(out);
    if (!st.live && !live && !bell && !st.k) return undefined;
    const o = {};
    if (bell) o.bell = st.bell ? 2 : bellNow(crew, st) ? 1 : 0;
    if (st.live) {
      const d = crew.mods.state('deck')?.deck;
      o.on = 1; o.t = r2(Math.max(0, st.live.until - crew.shiftT)); o.orders = d ? openCount(d) : 0;
      if (st.live.bonus) o.bonus = 1;
    }
    if (live) {
      o.pips = st.balls.filter(e => e.k === st.k - 1).map(e => (out(e) ? '1' : '0')).join('');
      o.balls = st.balls.filter(out).map(e => ({ id: e.id, t: r2(e.left), x: r2(e.x), z: r2(e.z) }));
    }
    const held = Object.entries(st.held).filter(([, n]) => n > 0);
    if (held.length) o.held = Object.fromEntries(held);
    if (st.k) { o.n = st.n; o.got = st.banked; }
    return o;
  },
};
