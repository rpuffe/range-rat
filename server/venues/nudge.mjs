// Day-2 suggestions (council round 6 #10), server side, as a venue-0 module so crew.mjs needs no new lines. On the
// Muni's day 2 each online Rat is dealt one different suggestion (web/js/nudge.js): at the morning for everyone online,
// later for a late joiner (the next one in the pool). It clears once that Rat has done it, or after NUDGE.SECS of
// working time. The day-1 checklist keeps precedence: nothing is dealt while an unfinished checklist is up.
// Nothing checks or rewards it beyond clearing the line.
// Round 7 #4: the same slot carries Gary's warning, dealt (one failing stop per Rat, nearest first, at every venue:
// a venue-0 module runs everywhere), and the Muni's day-3 rhythm line ("Keep the mats clean." at half-shift).
import { NUDGE, DAY3, dealFor, nudgeDay, nudgeDone, redealGary, GARY_SPOTLESS, GARY_EXTRA, GARY_LINE_HOLD } from '../../web/js/nudge.js';
import { FRIES, GARY, activeMats, pondClarity } from '../../web/js/sim.js';
import { MORNING, morningJobs, morningDone, dealMorning, goalJob, goalNudgeId, GOAL_AT } from '../../web/js/morning.js';   // owner playtest 3 §3.4; round 10 #1 the goal deal

const todoOpen = crew => !!crew.todo && !(crew.todo.pick && crew.todo.bank && crew.todo.sign && crew.todo.buy);
const baseOf = p => ({ banked: p.shift?.banked ?? 0, washAt: p.washAt ?? 0, crankAt: p.crankAt ?? 0 });
const MATS_AT = GARY.STOPS.find(s => s.id === 'mats');

function deal(crew, st) {
  if (!nudgeDay(crew) || crew.phase !== 'shift' || todoOpen(crew) || crew.lastCall?.()) return;   // Last Call is the rally's (playtest round 2 #7)
  for (const p of crew.online()) {
    if (st.by[p.id] || (st.am?.by?.[p.id] && !st.am.by[p.id].done)) continue;   // the morning deal goes first (owner playtest 3 §3.4)
    const { id, used } = dealFor(st.dealt, p, crew.up);    // skip what this Rat already does (the host always got "hose")
    st.dealt += used;
    st.by[p.id] = { id, left: NUDGE.SECS, base: baseOf(p), done: id == null };
    crew.dirty = true;
  }
}

// ---- Owner playtest 3 §3.4: the morning deal --------------------------------------------------------------------
// What the morning pool reads (web/js/morning.js), as plain numbers.
export function morningView(crew) {
  const v = crew.venue ?? 0;
  return {
    venue: v, basket: crew.basket?.n ?? 0, ...(Number.isFinite(crew.basket?.cap) ? { basketCap: crew.basket.cap } : {}), fixtures: crew.fixtures, nMats: activeMats(crew.onlineCount(), crew.up),
    shed: !!crew.perks?.shed, fries: crew.fries, pondOpen: !!crew.pondOpen?.(), clarity: crew.pondOpen?.() ? pondClarity(crew.sunkCount()) : null,
    deck: !!crew.mods?.state('deck'), poured: (crew.mods?.state('deck')?.deck?.drinks ?? 0) > 0 || (crew.stats?.deckOrders ?? 0) > 0,
    crowd: v === 3 ? crew.mods?.state('stadium')?.s ?? null : null,
    strays: v === 4 ? crew.mods?.state('county')?.strays ?? 0 : 0,
    debris: v === 5 ? crew.skyDebris?.() ?? 0 : 0,
  };
}
// Deal at the morning (and to a late joiner while the deal is still up): each Rat one job, nearest first.
function dealAm(crew, st) {
  if (crew.phase !== 'shift' || crew.endless || todoOpen(crew) || crew.lastCall?.()) return;
  st.am ??= { by: {} };
  if (amOver(crew)) return;                                              // the morning is over
  const free = crew.online().filter(p => !(p.id in st.am.by));
  if (!free.length) return;
  const jobs = morningJobs(morningView(crew));
  // Council round 10 #1: one Rat the jobs leave over takes the card's open feature goal (once a morning).
  const goal = !st.am.goal ? goalJob(crew.goalRows?.() ?? []) : null;
  let rest = free;
  // Playthrough 5 B1: at 2P the jobs always take both Rats, so the goal never got dealt: there, one Rat takes it anyway.
  if (goal && (free.length > jobs.length || (crew.onlineCount() === 2 && free.length > 0))) {
    const at = GOAL_AT[goal.id] ?? { x: 0, z: 0 }, d = p => Math.hypot(p.x - at.x, p.z - at.z);
    const p = free.reduce((a, b) => (d(b) < d(a) ? b : a));
    st.am.by[p.id] = { id: 'goal', goal: goal.id, done: false }; st.am.goal = goal.id;
    rest = free.filter(o => o !== p);
  }
  const dealt = dealMorning(jobs, rest.map(p => ({ id: p.id, x: p.x, z: p.z })));
  for (const p of rest) st.am.by[p.id] = dealt[p.id] ? { id: dealt[p.id], done: false } : { id: null, done: true };
  crew.dirty = true;
}
// The lines go after MORNING.SECS of working time from NUDGE.WAIT (shiftT only runs while the crew works).
const amOver = crew => (crew.shiftT ?? 0) >= NUDGE.WAIT + MORNING.SECS;
function stepAm(crew, st) {
  if (!st.am) return;
  const v = morningView(crew), over = amOver(crew);
  const rows = Object.values(st.am.by).some(n => n.goal && !n.done) ? crew.goalRows?.() ?? [] : null;
  for (const n of Object.values(st.am.by)) {
    if (n.done) continue;
    if (n.goal) { if (over || !rows?.find(r => r.id === n.goal && !r.done)) { n.done = true; crew.dirty = true; } continue; }   // round 10 #1
    if (over || morningDone(n.id, v)) { n.done = true; crew.dirty = true; }
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

// Gary's warning: deal while it runs (a late joiner gets one too), clear a stop's lines once it's Spotless, and at
// each stop clear the lines for the stops he has inspected. st.gary: { by: { ratId: stopId | 'stall' | 'meet' }, pend }.
// Council round 8 #2: no stop is ever dealt twice. A Rat with no stop (an extra, a late joiner, a Spotless stop with
// nothing left to take) gets 'stall' while a stop still ahead of him fails or anyone still holds a stop line, else
// 'meet'; those two lines last the whole drive, until his verdict.
// Playthrough 4 A13: a stop line stays up until Gary has inspected that stop (not just his first one).
// Playthrough 4 A14: a Rat's stall/meet line switches only once the other one has been wanted GARY_LINE_HOLD s running.
function stepGary(crew, st, dt = 0) {
  const g = crew.gary;
  if (!g || g.phase === 'done' || crew.phase !== 'shift') { if (st.gary?.by && Object.keys(st.gary.by).length) crew.dirty = true; if (st.gary) { st.gary.by = {}; st.gary.pend = {}; } return; }
  st.gary ??= { by: {}, pend: {} };
  const G = st.gary;
  G.pend ??= {};
  const extra = v => GARY_EXTRA.includes(v);
  const set = (id, v) => { if (G.by[id] !== v) { G.by[id] = v; crew.dirty = true; } };
  const inspected = new Set((g.checks ?? []).map(c => c.stop));
  for (const [id, v] of Object.entries(G.by)) if (!extra(v) && inspected.has(v)) { delete G.by[id]; crew.dirty = true; }
  // Playthrough 3 #1: a line clears once its stop is Spotless, not merely passing (it scuffed back and failed).
  for (const [id, stop] of Object.entries(G.by)) if (!extra(stop) && crew.inspectBase(stop, GARY_SPOTLESS)) { delete G.by[id]; crew.dirty = true; }
  for (const id of Object.keys(G.pend)) if (!extra(G.by[id])) delete G.pend[id];
  const at = p => ({ id: p.id, x: p.x, z: p.z });
  const free = crew.online().filter(p => !G.by[p.id] || extra(G.by[p.id]));
  if (!free.length) return;
  // A stall/meet line: a Rat with none (or a stop line just gone) takes it now; a switch waits for a steady want.
  const offer = (id, v) => {
    const cur = G.by[id];
    if (!cur || !extra(cur) || cur === v) { delete G.pend[id]; set(id, v); return; }
    const p = G.pend[id];
    if (p?.v !== v) { G.pend[id] = { v, t: 0 }; return; }
    if ((p.t += dt) >= GARY_LINE_HOLD - 1e-9) { delete G.pend[id]; set(id, v); }
  };
  const holds = () => Object.values(G.by).some(v => !extra(v));
  if (g.phase === 'warn') {
    // Playthrough 3 #1/#12: a free Rat takes a failing stop nobody holds (a stop that failed again is dealt again;
    // solo works down the list), nearest first; the rest stall him, or meet him when nothing fails and nobody holds one.
    const failing = failingStops(crew);
    const more = redealGary(failing, free.map(at), Object.values(G.by).filter(v => !extra(v)));
    for (const [id, v] of Object.entries(more)) if (!extra(v)) { delete G.pend[id]; set(id, v); }
    const want = failing.length > 0 || holds() ? 'stall' : 'meet';
    for (const [id, v] of Object.entries(more)) if (extra(v)) offer(id, want);
    return;
  }
  // The drive deals no stops: stall him while a stop still ahead fails (or a Rat still holds a stop line), else meet
  // him at the stand.
  const ahead = new Set(crew.garyStops().slice(g.stop).map(s => s.id));
  const v = holds() || failingStops(crew).some(s => ahead.has(s.id)) ? 'stall' : 'meet';
  for (const p of free) offer(p.id, v);
}

// The Muni's day 3 (A3): at half-shift, "Keep the mats clean." to the Rat nearest the mats, if they're over 0.3 mud.
export function matsMud(crew) {
  const n = activeMats(crew.onlineCount(), crew.up), mats = Object.entries(crew.fixtures).filter(([k]) => k.startsWith('mat') && +k.slice(3) < n);
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

// Playthrough 5 B1: "Deck order! Pour a beer!" to the Rat nearest the kitchen while a deck order is open and the card's
// order goal is open (2P stalled with nobody at the kitchen). Clears when the order is filled or lapses.
function stepOrder(crew, st) {
  const order = crew.mods?.state('deck')?.deck?.order;
  const want = !!order && crew.phase === 'shift' && !crew.lastCall?.() && !!crew.goalOpen?.('orders');
  if (!want) { if (st.order) { st.order = null; crew.dirty = true; } return; }
  if (st.order && crew.players.get(st.order)?.online > 0) return;
  const rats = crew.online().filter(p => !crew.driving(p) && !p.diving);
  if (!rats.length) return;
  const d = p => Math.hypot(p.x - FRIES.SHED.x, p.z - FRIES.SHED.z);
  st.order = rats.reduce((a, b) => (d(b) < d(a) ? b : a)).id;
  crew.dirty = true;
}

export default {
  id: 'nudge',
  venue: 0,

  init: () => ({ dealt: 0, by: {}, gary: null, d3: null, am: null, order: null }),
  startShift(crew, st) { st.dealt = 0; st.by = {}; st.gary = null; st.d3 = null; st.am = null; st.order = null; dealAm(crew, st); deal(crew, st); },

  tick(crew, st, dt) {
    if (!crew.working()) return;
    stepGary(crew, st, dt);
    stepDay3(crew, st, dt);
    dealAm(crew, st);                                       // late joiners, and the crew once the checklist is done
    stepAm(crew, st);
    stepOrder(crew, st);
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
    const rows = Object.values(st.am?.by ?? {}).some(n => n.goal && !n.done) ? crew.goalRows?.() ?? [] : null;
    for (const [id, n] of Object.entries(st.am?.by ?? {})) if (!n.done) out[id] = n.goal ? goalNudgeId(rows.find(r => r.id === n.goal)) ?? 'am:goal:' + n.goal + ':0' : 'am:' + n.id;   // owner playtest 3 §3.4; round 10 #1 'am:goal:hotdogs:12'
    if (nudgeDay(crew)) for (const [id, n] of Object.entries(st.by)) if (!n.done) out[id] = n.id;
    if (st.d3?.id) out[st.d3.id] = 'mats3';
    if (st.order) out[st.order] = 'order';   // playthrough 5 B1: over the morning line, under Gary's
    for (const [id, stop] of Object.entries(st.gary?.by ?? {})) out[id] = 'gary:' + stop;   // Gary outranks the rest
    return Object.keys(out).length ? out : undefined;
  },
};
