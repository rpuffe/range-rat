// Council round 13 #0e: THE calls-a-minute tally. One ruler for every bot (muni, mid, late11, boss, pt7c-endless), so
// the cross-venue table compares like with like. It replaces pt8a-tap.mjs and the testers' private tallies.
//
// A call (council-round13.md §1.4) is a moment that asks a Rat to go to a specific place, and that costs something
// if nobody goes:
//   lit request · Stretch section · inspector · member ball · deck order (one standing job per 30 s) · treasure ·
//   Gary arrival · deal · boss phase · whistle ready · fixture > 50 % dirty · basket < 25 % · fries < 30 %.
// Repeats of the same kind within 8 s count once. Special balls coming to rest are NOT calls.
//
// New calls from venue modules: put `call: '<kind>'` (and `n` for several places at once) on the event, e.g.
//   this.events.push({ t: 'tourney', phase: 'land', call: 'member' })
// and the tally counts it with no edit here. Or register a matcher: addCall(e => e.t === 'x' ? 'kind' : null).
//
// Use:
//   import { CallTally } from './calls.mjs';
//   const calls = new CallTally(N);
//   ... each step, AFTER crew.tick(dt) and BEFORE crew.events is cleared:  calls.step(crew, dt);
//   ... at each bell:  const rec = calls.endShift(crew);   // { venue, vd, mins, n, perMin, kinds }
//   ... at exit:       calls.print();                       // calls a minute by venue and crew size (CALLS lines)
// Several runs: CALLS_JSON=all.jsonl on each, then  node scripts/bots/calls.mjs all.jsonl  prints the pooled table.
// Env: CALLS=0 silences print(); CALLS_JSON=<file> appends every shift record as a JSON line.
import { appendFileSync } from 'node:fs';
import { FRIES } from '../../web/js/sim.js';
import { basketMax } from '../../web/js/basket.js';

export const MERGE = 8;                          // s: repeats of one kind inside this count once
export const GAPS = { deckOrder: 30 };           // s: kinds with their own merge window
export const VENUES = ['Muni', 'Club', 'Tiered', 'Stadium', 'County', 'Orbital', 'Endless'];
const LOW = { basket: 0.25, fries: 0.3, dirty: 0.5 };
const BOSS_PHASES = new Set(['warn', 'harvest', 'hunt', 'plug']);

const extra = [];
export const addCall = fn => { extra.push(fn); };

// The kind (or [kind, n]) an event is a call of, or null. Pure; test/calls.test.mjs covers it.
export function eventCall(e) {
  if (!e || typeof e !== 'object') return null;
  if (typeof e.call === 'string') return [e.call, Math.max(1, e.n | 0 || 1)];
  if (e.t === 'crowd' && e.kind === 'req') return 'request';
  if (e.t === 'crowd' && e.kind === 'stretch') return ['stretch', Math.max(1, e.n | 0)];
  if (e.t === 'inspect' && e.phase === 'start') return 'inspector';
  if (e.t === 'deckOrder') return 'deckOrder';
  if (e.t === 'treasure' && e.phase === 'sunk') return 'treasure';
  if (e.t === 'gary' && e.phase === 'warn') return 'gary';
  if (e.t === 'lastcall' || e.t === 'rally') return 'deal';
  if (e.t === 'mower' && e.boss && BOSS_PHASES.has(e.phase)) return 'boss';
  for (const fn of extra) { const k = fn(e); if (k) return k; }
  return null;
}

// Council round 14 #0c (builder 4): the "answered" column. A call is ANSWERED when a Rat reaches its place or takes
// its prize before it lapses: a member/gold ball taken, a Stretch section or a lit request delivered to, an order
// poured, the inspector met (a hazard bagged), a treasure carried. Modules tag their own: `answer: '<kind>'` (and `n`)
// on the event, e.g. { t: 'goldrush', phase: 'take', answer: 'gold' }. State calls (a dirty fixture, a low basket or
// fryer) are answered when the state clears. Per kind, answered never exceeds offered. The bars stay on offered.
export function eventAnswer(e) {
  if (!e || typeof e !== 'object') return null;
  if (typeof e.answer === 'string') return [e.answer, Math.max(1, e.n | 0 || 1)];
  if (e.t === 'tourney' && e.phase === 'take') return 'member';
  if (e.t === 'crowd' && e.kind === 'souv' && e.stretch) return 'stretch';
  if (e.t === 'crowd' && e.kind === 'souv' && e.req) return 'request';
  if (e.t === 'inspect' && e.phase === 'done' && e.bagged > 0) return 'inspector';
  if (e.t === 'deckTab' && e.order) return 'deckOrder';
  if (e.t === 'treasure' && e.phase === 'carried') return 'treasure';
  return null;
}

export const venueName = crew => (crew.endless ? 'Endless' : VENUES[crew.venue] ?? 'v' + crew.venue);

export class CallTally {
  constructor(n = 4) { this.n = n; this.rows = []; this.reset(); }
  reset() { this.secs = 0; this.kinds = {}; this.answered = {}; this.open = {}; this.last = {}; this.edge = {}; this.armed = {}; this.venue = null; this.vd = null; this.bossLater = 0; }
  hit(kind, now, n = 1) {
    const gap = GAPS[kind] ?? MERGE;
    if (n === 1 && now - (this.last[kind] ?? -1e9) < gap) return false;   // several places at once (a Stretch) never merge
    this.last[kind] = now;
    this.kinds[kind] = (this.kinds[kind] ?? 0) + n;
    return true;
  }
  answer(kind, n = 1) {
    const room = (this.kinds[kind] ?? 0) - (this.answered[kind] ?? 0);
    if (room > 0) this.answered[kind] = (this.answered[kind] ?? 0) + Math.min(n, room);
  }
  // a state call: counts when it becomes true (a rising edge), merged like the rest
  // falling: the state must have been off earlier this shift (the morning's empty basket is the fill chore, not a call)
  level(kind, on, now, falling = false) {
    if (!on) this.armed[kind] = true;
    if (on && !this.edge[kind] && (!falling || this.armed[kind]) && this.hit(kind.split(':')[0], now)) this.open[kind] = true;
    if (!on && this.edge[kind] && this.open[kind]) { this.open[kind] = false; this.answer(kind.split(':')[0]); }   // round 14 #0c: the state cleared
    this.edge[kind] = on;
  }
  step(crew, dt) {
    if (crew.phase !== 'shift') return;
    if (this.venue == null) { this.venue = venueName(crew); this.vd = crew.venueDay; }   // a Promotion Day promotes mid-shift
    this.secs += dt;
    const now = this.secs;
    for (const e of crew.events) {
      const k = eventCall(e); if (!k) continue;
      const hit = Array.isArray(k) ? this.hit(k[0], now, k[1]) : this.hit(k, now);
      if (hit && k === 'boss' && e.phase !== 'warn') this.bossLater++;
    }
    for (const e of crew.events) { const a = eventAnswer(e); if (Array.isArray(a)) this.answer(a[0], a[1]); else if (a) this.answer(a); }
    if (!crew.working?.()) return;
    const ws = crew.whistleState?.();
    this.level('whistle', ws === 1, now);
    for (const [k, v] of Object.entries(crew.fixtures ?? {})) this.level('wash:' + k, v > LOW.dirty, now);
    const b = crew.basket;
    if (b) this.level('basket', b.n < basketMax(b) * LOW.basket, now, true);
    if (crew.perks?.shed > 0) this.level('fries', crew.fries < FRIES.MAX * LOW.fries, now);
  }
  endShift(crew, extraFields = {}) {
    const n = Object.values(this.kinds).reduce((a, b) => a + b, 0), mins = this.secs / 60;
    // r8: the same shift on playtest round 8's (B's) kinds: no Gary visit, no basket, the boss's warn only. For continuity.
    const ans = Object.values(this.answered).reduce((a, b) => a + b, 0);
    const r8 = n - (this.kinds.gary ?? 0) - (this.kinds.basket ?? 0) - this.bossLater;
    const rec = { venue: this.venue ?? venueName(crew), vd: this.vd ?? crew.venueDay, day: crew.day, players: this.n, mins: +mins.toFixed(2), n,
      perMin: mins > 0 ? +(n / mins).toFixed(2) : 0, ans, ansPerMin: mins > 0 ? +(ans / mins).toFixed(2) : 0, r8, kinds: { ...this.kinds }, answered: { ...this.answered }, ...extraFields };
    this.rows.push(rec);
    if (process.env.CALLS_JSON) appendFileSync(process.env.CALLS_JSON, JSON.stringify(rec) + '\n');
    this.reset();
    return rec;
  }
  // calls a minute by venue (time-weighted: all calls / all minutes), with the per-shift min-max
  // plus "Club d4+": the Club's days 4 on (the Tournament's days, council round 13 #1)
  table() { return summarise(this.rows); }
  print(log = console.log) {
    if (process.env.CALLS === '0') return;
    for (const r of this.table()) log(fmtRow(r));
  }
}

export const fmtRow = r => `CALLS ${r.venue.padEnd(8)} ${r.players}P shifts ${String(r.shifts).padStart(2)} calls/min ${r.perMin.toFixed(2)} (${r.min.toFixed(2)}–${r.max.toFixed(2)}) offered/answered ${r.perMin.toFixed(2)} / ${r.ansPerMin.toFixed(2)} r8 ${r.r8PerMin.toFixed(2)} | ${Object.entries(r.kinds).map(([k, v]) => `${k} ${v}`).join(' ')}`;

// rows: endShift records (from any number of runs). Time-weighted: all calls / all minutes, per venue and crew size.
export function summarise(rows) {
  const by = new Map();
  const all = [...rows, ...rows.filter(r => r.venue === 'Club' && r.vd >= 4).map(r => ({ ...r, venue: 'Club d4+' }))];
  for (const r of all) {
    const k = r.venue + '|' + r.players;
    const a = by.get(k) ?? { r8: 0, ans: 0, venue: r.venue, players: r.players, shifts: 0, n: 0, mins: 0, min: Infinity, max: -Infinity, kinds: {} };
    a.shifts++; a.n += r.n; a.ans += r.ans ?? 0; a.r8 += r.r8 ?? r.n; a.mins += r.mins; a.min = Math.min(a.min, r.perMin); a.max = Math.max(a.max, r.perMin);
    for (const [kk, v] of Object.entries(r.kinds)) a.kinds[kk] = (a.kinds[kk] ?? 0) + v;
    by.set(k, a);
  }
  const order = v => (v === 'Club d4+' ? 1.5 : VENUES.indexOf(v));
  return [...by.values()].map(a => ({ ...a, perMin: a.mins > 0 ? a.n / a.mins : 0, r8PerMin: a.mins > 0 ? a.r8 / a.mins : 0, ansPerMin: a.mins > 0 ? a.ans / a.mins : 0 }))
    .sort((a, b) => order(a.venue) - order(b.venue) || a.players - b.players);
}

// node scripts/bots/calls.mjs <file.jsonl>...   the pooled table from CALLS_JSON files
if (process.argv.length > 2 && /calls\.mjs$/.test(process.argv[1] ?? '')) {
  const { readFileSync } = await import('node:fs');
  const rows = process.argv.slice(2).flatMap(f => readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)));
  for (const r of summarise(rows)) console.log(fmtRow(r));
}
