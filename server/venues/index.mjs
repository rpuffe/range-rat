// The venue seam, server side (council round 4, §3.0 and build item 3).
//
// Venues 2-5 are built as MODULES: new files only, plugged in with ONE line here. crew.mjs calls every active
// module at fixed hook points; a module never edits crew.mjs. The contract is in design/game-design.md
// ("How to add a venue module"); the short version:
//
//   export default {
//     id: 'tiered',        // unique, lower-case; also the module's save key (save.mods.tiered)
//     venue: 2,            // active from this venue up: its toys stay in the world at later venues
//     init(crew, saved)                    -> state     once, in the Crew constructor (saved: your last toSave, or undefined)
//     startShift(crew, st)                             each morning, after the reset, before the quota is set
//     tick(crew, st, dt)                               every server tick (check crew.working() yourself)
//     endShift(crew, st, ending)                       at the bell, after the carriers bank, before the quota is judged
//     serve(crew, st, p, { item, quality, n })         a kitchen serve went through
//     ping(crew, st, b, { prize, n, cart })            a crew ball rang a driven cart's cage (a paid ping)
//     knockDown(crew, st, p, by)                       someone (Rat or helper) was knocked flat
//     input(crew, st, p, a)                -> true     an action crew.mjs doesn't know ({t: 'lift'} ...); true = handled
//     launchMod(crew, st, shot, { mat, kind, lead }) -> shot | undefined   reshape a customer's shot before it spawns
//     onRest(crew, st, b)                              a ball came to rest (after the 'rest' event went out)
//     clamp(crew, st, p)                   -> true     you placed this walker yourself (else clampToField runs)
//     inspect(crew, st, stopId)            -> false    veto one of Gary's stops (false fails it)
//     signal(crew, st, name, data)                     a message from another module (crew.mods.signal(name, data))
//     awards(crew, st)                     -> [[title, shiftKey], ...]   extra ledger awards
//     kpi(crew, st)                        -> 0..1 | null   this venue's Board gauge; read only at venue === crew.venue
//     snapshot(crew, st)                   -> JSON         sent every tick as s.mods[id] (keep it small)
//     toSave(crew, st)                     -> JSON | undefined   kept as save.mods[id]; undefined = nothing to keep
//   }
//
// Every hook is optional. `st` is whatever init returned (an object; {} if there is no init). Hooks run in
// MODULES order. Nothing here keeps module-level state: one Node process runs many crews.

// ---- the production list: one import and one entry per venue module (wave C) ----------------------------------
import tiered from './tiered.mjs';
//
import deck from './deck.mjs';
//
import stadium from './stadium.mjs';
//
import county from './county.mjs';
//
import orbit from './orbit.mjs';
//
import nudge from './nudge.mjs';
import greens from './greens.mjs';   // council round 10 #6: on the green (venues 0-1; Tiered on, tiered.mjs's TARGET)   // council round 6 #10: the Muni day-2 suggestions (venue 0)

export const MODULES = [
  tiered,
  //
  deck,
  //
  stadium,
  //
  county,
  //
  orbit,
  //
  nudge,
  //
  greens,
];

export const HOOKS = ['init', 'startShift', 'tick', 'endShift', 'serve', 'ping', 'knockDown', 'input', 'launchMod', 'onRest',
  'clamp', 'inspect', 'signal', 'awards', 'kpi', 'snapshot', 'toSave'];
const ID_RE = /^[a-z][a-z0-9]{0,15}$/;
const clamp01 = v => Math.max(0, Math.min(1, v));

// Checks a module's shape. Throws on a mistake, so a broken module fails the tests, not a live crew.
export function checkModule(m) {
  if (!m || typeof m !== 'object') throw new Error('venue module: not an object');
  if (!ID_RE.test(m.id ?? '')) throw new Error(`venue module: bad id ${JSON.stringify(m.id)}`);
  if (!Number.isInteger(m.venue) || m.venue < 0 || m.venue > 5) throw new Error(`venue module ${m.id}: venue must be 0..5`);
  for (const [k, v] of Object.entries(m)) {
    if (k === 'id' || k === 'venue') continue;
    if (!HOOKS.includes(k)) throw new Error(`venue module ${m.id}: unknown hook ${k} (hooks: ${HOOKS.join(', ')})`);
    if (typeof v !== 'function') throw new Error(`venue module ${m.id}: ${k} must be a function`);
  }
  return m;
}

// One crew's view of the modules: their states, and the calls crew.mjs makes.
export class VenueHooks {
  constructor(crew, modules = MODULES, saved = null) {
    this.crew = crew;
    const seen = new Set();
    this.list = modules.map(m => {
      checkModule(m);
      if (seen.has(m.id)) throw new Error(`venue module ${m.id}: duplicate id`);
      seen.add(m.id);
      return { m, st: {} };
    });
    const bag = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    // Keys for modules this build doesn't have are carried through untouched, so they come back with the module.
    this.orphans = Object.fromEntries(Object.entries(bag).filter(([id]) => !seen.has(id) && ID_RE.test(id)));
    for (const e of this.list) {
      const mine = Object.hasOwn(bag, e.m.id) ? bag[e.m.id] : undefined;
      if (e.m.init) e.st = e.m.init(crew, mine) ?? {};
    }
  }

  // Modules live at the crew's venue: their venue or any later one.
  active() { const v = this.crew.venue; return this.list.filter(e => e.m.venue <= v); }
  state(id) { return this.list.find(e => e.m.id === id)?.st; }

  // Run a hook on every active module, in order.
  call(name, ...args) {
    for (const e of this.active()) if (e.m[name]) e.m[name](this.crew, e.st, ...args);
  }
  // The first active module that returns true handled it (input, clamp).
  first(name, ...args) {
    for (const e of this.active()) if (e.m[name] && e.m[name](this.crew, e.st, ...args) === true) return true;
    return false;
  }
  // Any active module returning exactly false vetoes (inspect).
  veto(name, ...args) {
    let no = false;
    for (const e of this.active()) if (e.m[name] && e.m[name](this.crew, e.st, ...args) === false) no = true;
    return no;
  }
  // Thread a value through every active module (launchMod): each may return a replacement, or mutate it.
  pipe(name, value, ...args) {
    for (const e of this.active()) if (e.m[name]) value = e.m[name](this.crew, e.st, value, ...args) ?? value;
    return value;
  }
  // Concatenate list results (awards).
  collect(name, ...args) {
    const out = [];
    for (const e of this.active()) if (e.m[name]) out.push(...(e.m[name](this.crew, e.st, ...args) ?? []));
    return out;
  }
  // Cross-module messages: e.g. Tiered signals 'target' and the Stadium's crowd cheers.
  signal(name, data) { this.call('signal', name, data); }

  // The current venue's KPI, 0..1, or null if this venue has none (yet). Only the module whose venue IS the
  // crew's venue is asked: earlier venues' toys stay in the world but stop being graded.
  kpi() {
    const v = this.crew.venue;
    for (const e of this.list) {
      if (e.m.venue !== v || !e.m.kpi) continue;
      const k = e.m.kpi(this.crew, e.st);
      if (k != null && Number.isFinite(k)) return clamp01(k);
    }
    return null;
  }

  // s.mods: { [id]: snapshot } for the active modules that have one.
  snapshot() {
    const out = {};
    for (const e of this.active()) if (e.m.snapshot) { const s = e.m.snapshot(this.crew, e.st); if (s !== undefined) out[e.m.id] = s; }
    return out;
  }
  // save.mods: every module (active or not: a County save keeps the Tiered deck's record), one key each.
  toSave() {
    const out = { ...this.orphans };
    for (const e of this.list) if (e.m.toSave) { const s = e.m.toSave(this.crew, e.st); if (s !== undefined) out[e.m.id] = s; }
    return Object.keys(out).length ? out : undefined;
  }
}
