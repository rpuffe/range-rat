// Day-2 suggestions (council round 6 #10), server side, as a venue-0 module so crew.mjs needs no new lines. On the
// Muni's day 2 each online Rat is dealt one different suggestion (web/js/nudge.js): at the morning for everyone online,
// later for a late joiner (the next one in the pool). It clears once that Rat has done it, or after NUDGE.SECS of
// working time. The day-1 checklist keeps precedence: nothing is dealt while an unfinished checklist is up.
// Nothing checks or rewards it beyond clearing the line.
// Round 7 #4: the same slot carries Gary's warning, dealt (one failing stop per Rat, nearest first, at every venue:
// a venue-0 module runs everywhere), and the Muni's day-3 rhythm line ("Keep the mats clean." at half-shift).
import { NUDGE, DAY3, dealFor, nudgeDay, nudgeDone, dealGary, redealGary, GARY_SPOTLESS } from '../../web/js/nudge.js';
import { FRIES, GARY, activeMats } from '../../web/js/sim.js';

const todoOpen = crew => !!crew.todo && !(crew.todo.pick && crew.todo.bank && crew.todo.sign && crew.todo.buy);
const baseOf = p => ({ banked: p.shift?.banked ?? 0, washAt: p.washAt ?? 0, crankAt: p.crankAt ?? 0 });
const MATS_AT = GARY.STOPS.find(s => s.id === 'mats');

function deal(crew, st) {
  if (!nudgeDay(crew) || crew.phase !== 'shift' || todoOpen(crew) || crew.lastCall?.()) return;   // Last Call is the rally's (playtest round 2 #7)
  for (const p of crew.online()) {
    if (st.by[p.id]) continue;
    const { id, used } = dealFor(st.dealt, p, crew.up);    // skip what this Rat already does (the host always got "hose")
    st.dealt += used;
    st.by[p.id] = { id, left: NUDGE.SECS, base: baseOf(p), done: id == null };
    crew.dirty = true;
  }
}

// Gary's stops that would fail right now, with where they are: [{ id, x, z }] in route order.
export function failingStops(crew) {
  const out = [];
  for (const s of crew.garyStops()) {
    if (crew.inspectBase(s.id)) continue;
    if (s.id === 'cart') { const c = crew.cart ? crew.muddiestCart() : null; if (c) out.push({ id: 'cart', x: c.x, z: c.z }); continue; }
    if (s.id === 'kitchen') { out.push({ id: 'kitchen', x: FRIES.SHED.x, z: FRIES.SHED.z }); continue; }
    out.push({ id: s.id, x: s.x, z: s.z });
  }
  return out;
}

// Gary's warning: deal while it runs (a late joiner gets one too), clear a stop's lines once it's Spotless, clear them all
// when he reaches his first stop. st.gary: { by: { ratId: stopId }, seen: { ratId: true }, over }.
function stepGary(crew, st) {
  const g = crew.gary;
  if (!g || g.phase === 'done' || crew.phase !== 'shift') { if (st.gary?.by && Object.keys(st.gary.by).length) crew.dirty = true; if (st.gary) st.gary.by = {}; return; }
  st.gary ??= { by: {}, seen: {}, over: false };
  const G = st.gary;
  if (G.over) return;
  if (g.phase !== 'warn' && (g.checks?.length ?? 0) > 0) { G.over = true; G.by = {}; crew.dirty = true; return; }   // his first stop
  // Playthrough 3 #1: a line clears once its stop is Spotless, not merely passing (it scuffed back and failed).
  for (const [id, stop] of Object.entries(G.by)) if (crew.inspectBase(stop, GARY_SPOTLESS)) { delete G.by[id]; crew.dirty = true; }
  if (g.phase !== 'warn') return;   // only the warning deals; the drive to his first stop only clears
  const at = p => ({ id: p.id, x: p.x, z: p.z });
  const fresh = crew.online().filter(p => !G.seen[p.id]);
  if (fresh.length) {
    for (const p of fresh) G.seen[p.id] = true;
    Object.assign(G.by, dealGary(failingStops(crew), fresh.map(at)));
    crew.dirty = true;
  }
  // Playthrough 3 #1/#12: a Rat whose stop went Spotless takes the next failing stop nobody holds (a stop that
  // failed again is dealt again; solo works down the list).
  const free = crew.online().filter(p => G.seen[p.id] && !G.by[p.id]);
  if (!free.length) return;
  const more = redealGary(failingStops(crew), free.map(at), Object.values(G.by));
  if (Object.keys(more).length) { Object.assign(G.by, more); crew.dirty = true; }
}

// The Muni's day 3 (A3): at half-shift, "Keep the mats clean." to the Rat nearest the mats, if they're over 0.3 mud.
export function matsMud(crew) {
  const n = activeMats(crew.onlineCount()), mats = Object.entries(crew.fixtures).filter(([k]) => k.startsWith('mat') && +k.slice(3) < n);
  return mats.length ? mats.reduce((a, [, v]) => a + v, 0) / mats.length : 0;
}
function stepDay3(crew, st, dt) {
  if (crew.venue !== DAY3.VENUE || crew.day !== DAY3.DAY || crew.endless || crew.phase !== 'shift') return;
  if (!st.d3) {
    if (crew.shiftT < crew.shiftSecs * DAY3.AT) return;
    st.d3 = { id: null, left: NUDGE.SECS, washAt: 0 };   // once a shift, whatever the mud said
    const rats = crew.online();
    if (rats.length && matsMud(crew) > DAY3.MUD) {
      const dm = r => Math.hypot(r.x - MATS_AT.x, r.z - MATS_AT.z);
      const p = rats.reduce((a, r) => (dm(r) < dm(a) ? r : a));
      Object.assign(st.d3, { id: p.id, washAt: p.washAt ?? 0 });
      crew.dirty = true;
    }
    return;
  }
  if (st.d3.id) {
    const p = crew.players.get(st.d3.id);
    if (!p || (p.washAt ?? 0) > st.d3.washAt || (st.d3.left -= dt) <= 0) { st.d3.id = null; crew.dirty = true; }
  }
}

export default {
  id: 'nudge',
  venue: 0,

  init: () => ({ dealt: 0, by: {}, gary: null, d3: null }),
  startShift(crew, st) { st.dealt = 0; st.by = {}; st.gary = null; st.d3 = null; deal(crew, st); },

  tick(crew, st, dt) {
    if (!crew.working()) return;
    stepGary(crew, st);
    stepDay3(crew, st, dt);
    if (!nudgeDay(crew)) return;
    deal(crew, st);                                         // late joiners, and the crew once the checklist is done
    const counting = (crew.shiftT ?? 0) >= NUDGE.WAIT;
    for (const [id, n] of Object.entries(st.by)) {
      if (n.done) continue;
      const p = crew.players.get(id);
      if (!p || nudgeDone(n.id, p, n.base, crew.up)) { n.done = true; crew.dirty = true; continue; }
      if (counting && (n.left -= dt) <= 0) { n.done = true; crew.dirty = true; }
    }
  },

  // s.mods.nudge: { [playerId]: 'hose' | 'far' | ... | 'gary:sign' | 'mats3' } for the lines still up.
  snapshot(crew, st) {
    if (crew.phase !== 'shift') return undefined;
    const out = {};
    if (nudgeDay(crew)) for (const [id, n] of Object.entries(st.by)) if (!n.done) out[id] = n.id;
    if (st.d3?.id) out[st.d3.id] = 'mats3';
    for (const [id, stop] of Object.entries(st.gary?.by ?? {})) out[id] = 'gary:' + stop;   // Gary outranks the rest
    return Object.keys(out).length ? out : undefined;
  },
};
