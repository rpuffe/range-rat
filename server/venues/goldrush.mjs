// Council round 14 #1 (builder 2): the Gold Rush. A venue module (venue 0, so it's live at the Muni); it checks venue 0/1
// itself and does nothing anywhere else. The rules are web/js/goldrush.js; the van, the beams and Site 13's cart are
// web/js/views/goldrush.js. Shape: the Tournament's (server/venues/tourney.mjs), not a refactor of it.
//
// No RNG draw anywhere (hash32 spots). On a rush day the gold balls take ball ids, so the later stream's ids shift: an
// expected golden move from Muni day 3 (council round 14 §2a). Muni days 1-2 and Club day 1 never fire.
import { KIND_W, POND, LAST_CALL, GARY } from '../../web/js/sim.js';
import { nearestReturn } from '../../web/js/layout.js';
import { isPromotionDay } from '../../web/js/promoday.js';
import { endWindows } from '../../web/js/dayend.js';
import { RUSH, rushDay, rushTime, rushSpots, rushShot, rushSecs, rushPond, rushRow } from '../../web/js/goldrush.js';

const fresh = () => ({ which: null, at: null, fired: false, balls: [], held: {}, n: 0, banked: 0, dived: 0, claimed: 0, cash: 0, swept: false });
const r2 = v => Math.round(v * 100) / 100;
const out = e => e.st === 'out' || e.st === 'air';
const live = st => st.balls.some(out);
const here = crew => (crew.venue === 0 || crew.venue === 1) && !crew.endless;

// A rush ball always goes in, even on a full field (crew.addBall refuses past SIM.MAX_BALLS). Same shape and event.
function addGold(crew, s) {
  const b = crew.addBall(s) ?? (() => {
    const m = { id: crew.nextBall++, ...s, rest: false, acc: 0 };
    crew.balls.set(m.id, m);
    crew.events.push({ t: 'spawn', id: m.id, x: m.x, y: m.y, z: m.z, vx: m.vx, vy: m.vy, vz: m.vz, kind: m.kind });
    return m;
  })();
  b.hands = true; b.rush = true;
  return b;
}

function drop(crew, st) {
  const n = crew.onlineCount(), spots = rushSpots(crew.day, crew.venueDay, n, crew.venue), secs = rushSecs(n);
  st.fired = true; st.n = spots.length;
  for (const s of spots) {
    const b = addGold(crew, { ...rushShot(s), kind: 'gold' });
    st.balls.push({ id: b.id, st: 'air', left: secs, pond: !!s.pond, x: s.x, z: s.z, by: null });
  }
  crew.stats.rushOut = (crew.stats.rushOut ?? 0) + spots.length;
  crew.events.push({ t: 'rush', phase: 'drop', call: 'gold', n: spots.length, secs, pond: rushPond(n, crew.venue),   // calls.mjs: one call a ball
    spots: spots.map(s => ({ x: s.x, z: s.z, pond: s.pond })) });
  crew.dirty = true;
}

function settled(crew, st) {
  if (st.swept || !st.fired || live(st) || Object.keys(st.held).length) return;
  st.swept = true;
  if (st.banked + st.dived >= st.n && st.n > 0) crew.events.push({ t: 'rush', phase: 'sweep', n: st.n });
}

function bankGold(crew, st, e, by) {
  e.st = 'banked'; st.banked++;
  const p = crew.players.get(by);
  crew.bank(1, p ? p.id : null, p ? null : 'rush', KIND_W.gold, null, { rush: 1 });
  const ev = crew.events.at(-1), got = ev?.t === 'cash' ? r2((ev.cash ?? 0) + (ev.credit ?? 0)) : 0;
  st.cash = r2(st.cash + got);
  crew.stats.rushBanked = (crew.stats.rushBanked ?? 0) + 1;
  crew.events.push({ t: 'rush', phase: 'bank', by: p?.id ?? null, name: p?.name ?? null, cash: got });
  crew.dirty = true;
}

// Who took a sunk rush ball out of the pond (pondPickup doesn't call take()): the diver nearest where it lay. It stays
// in their dive bag, where it's already worth a gold ball (KIND_W.gold): no second pay here.
function diver(crew, e) {
  let best = null, bd = POND.REACH + 2;
  for (const p of crew.players.values()) {
    const d = Math.hypot(p.x - e.x, p.z - e.z);
    if (d < bd && (p.diving || p.bagKinds?.includes('gold'))) { bd = d; best = p; }
  }
  return best;
}

function step(crew, st, dt) {
  if (st.at != null && !st.fired && crew.shiftT >= st.at) drop(crew, st);
  for (const e of st.balls) {
    if (!out(e)) continue;
    const b = crew.balls.get(e.id);
    if (!b) {
      const p = e.pond ? diver(crew, e) : null;
      if (p) {
        e.st = 'dived'; e.by = p.id; st.dived++;
        const worth = r2(crew.ballPrice() * KIND_W.gold);
        st.cash = r2(st.cash + worth);
        crew.events.push({ t: 'rush', phase: 'dived', by: p.id, name: p.name, answer: 'gold' });
      } else e.st = 'lost';
      crew.dirty = true;
      continue;
    }
    if (b.rest || b.sunk) { e.st = 'out'; e.x = b.x; e.z = b.z; }
    if ((e.left -= dt) > 0) continue;
    crew.balls.delete(e.id);                                   // Site 13's cart claims it
    e.st = 'claimed'; st.claimed++;
    crew.stats.rushClaimed = (crew.stats.rushClaimed ?? 0) + 1;
    crew.events.push({ t: 'gone', id: e.id, by: 'site13' }, { t: 'rush', phase: 'claim', x: r2(e.x), z: r2(e.z) });
    crew.dirty = true;
  }
  for (const id of Object.keys(st.held)) {                   // carriers: at any return, every rush ball in hand banks
    const p = crew.players.get(id);
    if (!p || !(st.held[id] > 0)) { delete st.held[id]; continue; }
    if (p.down > 0 || p.diving) continue;
    const r = nearestReturn(p.x, p.z, crew.perks?.returns ?? 0);
    if (Math.hypot(p.x - r.x, p.z - r.z) > RUSH.BANK_R) continue;
    for (const e of st.balls) if (e.st === 'held' && e.by === id) bankGold(crew, st, e, id);
    delete st.held[id];
  }
  settled(crew, st);
}

// The deals the drop keeps clear of: Last Call and the cleanup (from day 2, as crew.lastCall()).
const dealsOf = crew => {
  if (crew.day < LAST_CALL.FROM_DAY) return [];
  const w = endWindows(crew.shiftSecs);
  return [crew.shiftSecs - w.glow, crew.shiftSecs - w.cleanup];
};

export default {
  id: 'goldrush',
  venue: 0,
  init: () => fresh(),
  startShift(crew, st) {
    Object.assign(st, fresh());
    if (!here(crew)) return;
    st.which = rushDay({ venue: crew.venue, day: crew.day, venueDay: crew.venueDay, endless: crew.endless, promo: isPromotionDay(crew),
      boss: !!crew.bossToday?.(), gary: !!crew.garyToday?.(), reveal: !!crew.pendingReveal });
    const garyAt = st.which === 'club' && crew.garyToday?.() ? crew.shiftSecs * GARY.AT : null;   // Club day 2 is usually Gary's
    if (st.which) st.at = rushTime(st.which, crew.shiftSecs, dealsOf(crew), garyAt, rushSecs(crew.onlineCount()));
  },
  tick(crew, st, dt) {
    if (!here(crew) || !crew.working()) return;
    if (st.at == null && !st.balls.length) return;
    step(crew, st, dt);
  },
  take(crew, st, p, b) {
    if (!b.rush) return false;
    const e = st.balls.find(o => o.id === b.id);
    crew.balls.delete(b.id); crew.stats.picked++;
    crew.events.push({ t: 'gone', id: b.id, by: p.id });
    if (!e || !out(e)) return true;
    e.st = 'held'; e.by = p.id; e.x = b.x; e.z = b.z;
    st.held[p.id] = (st.held[p.id] ?? 0) + 1;
    crew.events.push({ t: 'rush', phase: 'take', by: p.id, name: p.name, answer: 'gold' });
    crew.dirty = true;
    return true;
  },
  // A knocked-down carrier's rush balls go back on the grass, back on the clock.
  knockDown(crew, st, p) {
    if (!(st.held[p.id] > 0)) return;
    delete st.held[p.id];
    let i = 0;
    for (const e of st.balls) {
      if (e.st !== 'held' || e.by !== p.id) continue;
      const a = i++ * 2.1;
      const b = addGold(crew, { x: p.x + Math.cos(a) * 0.6, y: 0.3, z: p.z + Math.sin(a) * 0.6, vx: Math.cos(a), vy: 2.2, vz: Math.sin(a), kind: 'gold' });
      e.id = b.id; e.st = 'air'; e.by = null; e.pond = false; e.left = Math.max(e.left, RUSH.DROPPED_SECS);
    }
    crew.dirty = true;
  },
  // At the bell the carriers bank what they hold; anything still out goes to Site 13.
  endShift(crew, st) {
    if (!here(crew)) return;
    for (const e of st.balls) {
      if (e.st === 'held') bankGold(crew, st, e, e.by);
      else if (out(e)) { crew.balls.delete(e.id); e.st = 'claimed'; st.claimed++; }
    }
    st.held = {};
  },
  reportRows(crew, st) {
    if (!here(crew) || !st.fired) return [];
    const r = rushRow({ n: st.n, got: st.banked + st.dived, cash: st.cash });
    return r ? [r] : [];
  },
  // s.mods.goldrush: the Board's pips and clock, the balls out (the view's beams), who holds one.
  snapshot(crew, st) {
    if (!here(crew) || !st.fired) return undefined;
    const o = {};
    if (live(st)) {
      let t = 0;
      for (const e of st.balls) if (out(e)) t = Math.max(t, e.left);
      o.pips = st.balls.map(e => (out(e) ? '1' : '0')).join(''); o.t = r2(t);
      o.balls = st.balls.filter(out).map(e => ({ id: e.id, t: r2(e.left), pond: e.pond ? 1 : 0, x: r2(e.x), z: r2(e.z) }));
    }
    const held = Object.entries(st.held).filter(([, n]) => n > 0);
    if (held.length) o.held = Object.fromEntries(held);
    o.n = st.n; o.got = st.banked + st.dived; o.claimed = st.claimed;
    return o;
  },
};

