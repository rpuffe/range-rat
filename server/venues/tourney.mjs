// Council round 13 #1 (builder 2): the Members' Tournament, the Club's back-half peak. A venue module (venue 1): it runs
// only while crew.venue === 1 (the Club), from Club day 4, never on a boss day or Promotion Day. The rules are in
// web/js/tourney.js; the members, the beams and the caddie cart are web/js/views/tourney.js.
// Council round 13 #4: the Members' Bell (landmarks.js tier 1) rings a bonus flight here, once a shift.
//
// No RNG draw anywhere (hash32 spots): the seam's Club days 1-3 don't move. On a Tournament day the member balls take
// ball ids, so the later stream's ids shift (an expected golden move, council round 13 §2a).
import { SIM, POND, LAST_CALL } from '../../web/js/sim.js';
import { nearestReturn } from '../../web/js/layout.js';
import { bossLive } from '../../web/js/mowe.js';
import { isPromotionDay } from '../../web/js/promoday.js';
import { endWindows } from '../../web/js/dayend.js';
import { TOURNEY, tourneyDay, flightTimes, memberSpots, dropShot, pondBall, TOURNEY_MEMO } from '../../web/js/tourney.js';
import { BELL, atBell, bellOpen, hasLandmark, LANDMARK } from '../../web/js/landmarks.js';

const fresh = () => ({
  on: false, at: [], k: 0, balls: [], flights: [], held: {}, bell: false, bonus: 0,
  banked: 0, claimed: 0, clean: 0, cash: 0, launched: 0,
});

const r2 = v => Math.round(v * 100) / 100;
const live = st => st.balls.some(b => b.st === 'out' || b.st === 'air');
const returnsOf = (crew, x, z) => nearestReturn(x, z, crew.perks?.returns ?? 0);

// A member's ball always goes in, even on a full field (crew.addBall refuses past SIM.MAX_BALLS: at 4P late in a shift
// the field is often full, and the Tournament mustn't silently vanish). Same shape and event as crew.addBall.
function addMember(crew, s) {
  const b = crew.addBall(s);
  if (b) return b;
  const m = { id: crew.nextBall++, ...s, rest: false, acc: 0 };
  crew.balls.set(m.id, m);
  crew.events.push({ t: 'spawn', id: m.id, x: m.x, y: m.y, z: m.z, vx: m.vx, vy: m.vy, vz: m.vz, kind: m.kind });
  return m;
}

// One flight: the members tee off. `bonus`: the bell's flight.
function fly(crew, st, bonus = false) {
  const f = st.flights.length, n = crew.onlineCount();
  const spots = memberSpots(crew.day, crew.venueDay, f, n);
  st.flights.push({ k: f, bonus, n: spots.length, banked: 0, done: false });
  spots.forEach((s, j) => {
    const b = addMember(crew, { ...dropShot(s, j), kind: 'member' });
    b.hands = true; b.member = f;
    st.balls.push({ id: b.id, f, j, st: 'air', left: TOURNEY.SECS, pond: !!s.pond, x: s.x, z: s.z, by: null });
    st.launched++;
  });
  crew.stats.memberOut = (crew.stats.memberOut ?? 0) + spots.length;
  crew.events.push({ t: 'tourney', phase: 'flight', call: 'member', k: f, bonus, n: spots.length,   // calls.mjs: one call a ball
    pond: pondBall(n), main: bonus ? -1 : st.k - 1, secs: TOURNEY.SECS,
    spots: spots.map(s => ({ x: s.x, z: s.z, pond: s.pond })) });
  crew.dirty = true;
}

// A member's ball reached a return (or MOW-E fetched it): ×PAY Ball Value, and the flight's clean check.
function bankMember(crew, st, e, by) {
  e.st = 'banked'; st.banked++;
  const p = by != null ? crew.players.get(by) : null;
  crew.bank(1, p ? p.id : null, p ? null : 'mowe', TOURNEY.PAY, null, { member: 1 });
  const ev = crew.events.at(-1), got = r2((ev?.cash ?? 0) + (ev?.credit ?? 0));   // the full price: paid now + the washer's share
  st.cash = r2(st.cash + got);
  crew.stats.memberCash = r2((crew.stats.memberCash ?? 0) + got);
  crew.stats.memberBanked = (crew.stats.memberBanked ?? 0) + 1;
  const fl = st.flights[e.f];
  fl.banked++;
  crew.events.push({ t: 'tourney', phase: 'bank', by: p ? p.id : 'mowe', name: p?.name ?? 'MOW-E', k: e.f, cash: got });
  if (!fl.done && fl.banked >= fl.n) {
    fl.done = true; st.clean++;
    crew.stats.cleanFlights = (crew.stats.cleanFlights ?? 0) + 1;
    crew.events.push({ t: 'tourney', phase: 'clean', k: e.f });
  }
  crew.dirty = true;
}

// Who took a sunk member ball out of the pond: the diver nearest where it lay (pondPickup doesn't call take()).
// It leaves their dive bag (worth one ball there) and rides in their hands like any member's ball.
function divedBy(crew, e) {
  let best = null, bd = POND.REACH + 2;
  for (const p of crew.players.values()) {
    const d = Math.hypot(p.x - e.x, p.z - e.z);
    if (d < bd && (p.diving || p.bagKinds?.includes('member'))) { bd = d; best = p; }
  }
  if (!best) return null;
  const i = best.bagKinds?.lastIndexOf('member') ?? -1;
  if (i >= 0) { best.bagKinds.splice(i, 1); best.bag = Math.max(0, best.bag - 1); best.bagW = Math.max(0, (best.bagW ?? 1) - 1); }
  return best;
}

function step(crew, st, dt) {
  if (st.on && st.k < st.at.length && crew.shiftT >= st.at[st.k]) { st.k++; fly(crew, st, false); }
  for (const e of st.balls) {
    if (e.st === 'air' || e.st === 'out') {
      const b = crew.balls.get(e.id);
      if (!b) {                                                  // gone without take(): a diver, or the pond was full
        const p = e.pond ? divedBy(crew, e) : null;
        if (p) { e.st = 'held'; e.by = p.id; st.held[p.id] = (st.held[p.id] ?? 0) + 1; crew.events.push({ t: 'tourney', phase: 'take', by: p.id, k: e.f }); }
        else e.st = 'lost';
        crew.dirty = true;
        continue;
      }
      if (b.rest || b.sunk) { e.st = 'out'; e.x = b.x; e.z = b.z; }
      if ((e.left -= dt) > 0) continue;
      crew.balls.delete(e.id);                                   // the members' caddie cart claims it
      e.st = 'claimed'; st.claimed++;
      crew.stats.memberClaimed = (crew.stats.memberClaimed ?? 0) + 1;
      crew.events.push({ t: 'gone', id: e.id, by: 'caddie' }, { t: 'tourney', phase: 'claim', k: e.f, x: r2(e.x), z: r2(e.z) });
      crew.dirty = true;
    }
  }
  // Carriers: at a return, every member's ball in hand is banked.
  for (const id of Object.keys(st.held)) {
    const p = crew.players.get(id);
    if (!p || !(st.held[id] > 0)) { delete st.held[id]; continue; }
    if (p.down > 0 || p.diving) continue;
    const r = returnsOf(crew, p.x, p.z);
    if (Math.hypot(p.x - r.x, p.z - r.z) > TOURNEY.BANK_R) continue;
    for (const e of st.balls) if (e.st === 'held' && e.by === id) bankMember(crew, st, e, id);
    delete st.held[id];
  }
}

// The deals the flights keep clear of: Last Call and the cleanup (from day 2, as crew.lastCall()).
const dealsOf = crew => {
  if (crew.day < LAST_CALL.FROM_DAY) return [];
  const w = endWindows(crew.shiftSecs);
  return [crew.shiftSecs - w.glow, crew.shiftSecs - w.cleanup];
};

export default {
  id: 'tourney',
  venue: 1,
  init: (crew, saved) => ({ ...fresh(), seen: !!saved?.seen }),
  startShift(crew, st) {
    Object.assign(st, fresh(), { seen: st.seen });
    if (crew.venue !== 1) return;
    st.on = tourneyDay({ venue: crew.venue, venueDay: crew.venueDay, endless: crew.endless, promo: isPromotionDay(crew), boss: !!crew.bossToday?.() });
    if (!st.on) return;
    st.at = flightTimes(crew.shiftSecs, dealsOf(crew));
    // The morning memo's second line on the first Tournament day (memoSecond's note slot: builder 4's; only if empty).
    if (!st.seen) { st.seen = true; crew.memoNote ??= TOURNEY_MEMO; }
  },
  tick(crew, st, dt) {
    if (crew.venue !== 1 || crew.endless || !crew.working()) return;
    if (!st.on && !st.balls.length) return;
    step(crew, st, dt);
  },
  // A Rat picks up a member's ball: into their hands (no limit, outside the pocket); the clock stops.
  take(crew, st, p, b) {
    if (b.kind !== 'member') return false;
    const e = st.balls.find(o => o.id === b.id);
    crew.balls.delete(b.id); crew.stats.picked++;
    crew.events.push({ t: 'gone', id: b.id, by: p.id });
    if (!e || (e.st !== 'out' && e.st !== 'air')) return true;
    e.st = 'held'; e.by = p.id; e.x = b.x; e.z = b.z;
    st.held[p.id] = (st.held[p.id] ?? 0) + 1;
    crew.events.push({ t: 'tourney', phase: 'take', by: p.id, name: p.name, k: e.f });
    crew.dirty = true;
    return true;
  },
  // A knocked-down carrier's member balls go back on the grass, back on the clock.
  knockDown(crew, st, p) {
    if (!(st.held[p.id] > 0)) return;
    delete st.held[p.id];
    let i = 0;
    for (const e of st.balls) {
      if (e.st !== 'held' || e.by !== p.id) continue;
      const a = i++ * 2.1;
      const b = addMember(crew, { x: p.x + Math.cos(a) * 0.6, y: 0.3, z: p.z + Math.sin(a) * 0.6, vx: Math.cos(a), vy: 2.2, vz: Math.sin(a), kind: 'member' });
      b.hands = true; b.member = e.f;
      e.id = b.id; e.st = 'air'; e.by = null; e.pond = false; e.left = Math.max(e.left, TOURNEY.DROPPED_SECS);
    }
    crew.dirty = true;
  },
  // Ⓐ at the Members' Bell (landmark tier 1): a bonus flight. Council round 13 #5: MOW-E's aimed whistle fetching a
  // member's ball calls crew.mods.signal('member', { id }) and it is banked as his.
  input(crew, st, p, a) {
    if (a.t !== 'bell') return false;
    if (!hasLandmark(crew.up, LANDMARK.BELL) || !atBell(p) || p.down > 0 || !crew.working()) return true;
    const boss = crew.mower?.kind === 'boss' && bossLive(crew.mower);
    if (boss || !bellOpen({ left: crew.shiftSecs - crew.shiftT, rung: st.bell, live: live(st), venue: crew.venue, endless: crew.endless })) {
      crew.events.push({ t: 'tourney', phase: 'bellno', by: p.id });
      return true;
    }
    st.bell = true; st.bonus++;
    crew.stats.bellRung = (crew.stats.bellRung ?? 0) + 1;
    crew.events.push({ t: 'tourney', phase: 'bell', by: p.id, name: p.name });
    fly(crew, st, true);
    return true;
  },
  signal(crew, st, name, data) {
    if (name !== 'member' || crew.venue !== 1) return;
    const e = st.balls.find(o => o.id === data?.id && (o.st === 'out' || o.st === 'air'));
    if (!e) return;
    crew.balls.delete(e.id);
    crew.events.push({ t: 'gone', id: e.id, by: 'mowe' });
    bankMember(crew, st, e, null);
  },
  // At the bell the carriers bank what they hold (like the helpers); anything still out goes to the caddie.
  endShift(crew, st) {
    if (crew.venue !== 1) return;
    for (const e of st.balls) {
      if (e.st === 'held') bankMember(crew, st, e, e.by);
      else if (e.st === 'out' || e.st === 'air') { crew.balls.delete(e.id); e.st = 'claimed'; st.claimed++; }
    }
    st.held = {};
  },
  // s.mods.tourney: the live flight (the Board's pips and clock), the balls out (the view's beams), who holds one, the bell.
  snapshot(crew, st) {
    if (crew.venue !== 1 || crew.endless) return undefined;
    const bell = hasLandmark(crew.up, LANDMARK.BELL);
    if (!st.on && !st.balls.length && !bell) return undefined;
    const out = {};
    if (st.on) out.on = 1;
    if (bell) out.bell = st.bell ? 2 : bellOpen({ left: crew.shiftSecs - crew.shiftT, rung: st.bell, live: live(st), venue: crew.venue, endless: crew.endless }) ? 1 : 0;
    if (live(st)) {
      const f = st.flights.length - 1, mine = st.balls.filter(e => e.f === f);
      let t = 0;
      for (const e of mine) if (e.st === 'out' || e.st === 'air') t = Math.max(t, e.left);
      out.flight = { k: f, bonus: st.flights[f]?.bonus ? 1 : 0, pips: mine.map(e => (e.st === 'out' || e.st === 'air' ? '1' : '0')).join(''), t: r2(t) };
      out.balls = st.balls.filter(e => e.st === 'out' || e.st === 'air').map(e => ({ id: e.id, t: r2(e.left), pond: e.pond ? 1 : 0, x: r2(e.x), z: r2(e.z) }));
    }
    const held = Object.entries(st.held).filter(([, n]) => n > 0);
    if (held.length) out.held = Object.fromEntries(held);
    if (st.banked || st.claimed) { out.banked = st.banked; out.claimed = st.claimed; out.clean = st.clean; }
    return out;
  },
  toSave: (crew, st) => (st.seen ? { seen: 1 } : undefined),
};

// The bell constants are re-exported for the bot and the view.
export { BELL, SIM };
