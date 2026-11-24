// Day-2 suggestions (council round 6 #10), server side, as a venue-0 module so crew.mjs needs no new lines. On the
// Muni's day 2 each online Rat is dealt one different suggestion (web/js/nudge.js): at the morning for everyone online,
// later for a late joiner (the next one in the pool). It clears once that Rat has done it, or after NUDGE.SECS of
// working time. The day-1 checklist keeps precedence: nothing is dealt while an unfinished checklist is up.
// Nothing checks or rewards it beyond clearing the line.
import { NUDGE, dealNudge, nudgeDay, nudgeDone } from '../../web/js/nudge.js';

const todoOpen = crew => !!crew.todo && !(crew.todo.pick && crew.todo.bank && crew.todo.sign && crew.todo.buy);
const baseOf = p => ({ banked: p.shift?.banked ?? 0, washAt: p.washAt ?? 0, crankAt: p.crankAt ?? 0 });

function deal(crew, st) {
  if (!nudgeDay(crew) || crew.phase !== 'shift' || todoOpen(crew)) return;
  for (const p of crew.online()) {
    if (st.by[p.id]) continue;
    st.by[p.id] = { id: dealNudge(st.dealt++, crew.up), left: NUDGE.SECS, base: baseOf(p), done: false };
    crew.dirty = true;
  }
}

export default {
  id: 'nudge',
  venue: 0,

  init: () => ({ dealt: 0, by: {} }),
  startShift(crew, st) { st.dealt = 0; st.by = {}; deal(crew, st); },

  tick(crew, st, dt) {
    if (!nudgeDay(crew) || !crew.working()) return;
    deal(crew, st);                                         // late joiners, and the crew once the checklist is done
    const counting = (crew.shiftT ?? 0) >= NUDGE.WAIT;
    for (const [id, n] of Object.entries(st.by)) {
      if (n.done) continue;
      const p = crew.players.get(id);
      if (!p || nudgeDone(n.id, p, n.base, crew.up)) { n.done = true; crew.dirty = true; continue; }
      if (counting && (n.left -= dt) <= 0) { n.done = true; crew.dirty = true; }
    }
  },

  // s.mods.nudge: { [playerId]: 'hose' | 'far' | ... } for the lines still up; nothing on any other day.
  snapshot(crew, st) {
    if (!nudgeDay(crew) || crew.phase !== 'shift') return undefined;
    const out = {};
    for (const [id, n] of Object.entries(st.by)) if (!n.done) out[id] = n.id;
    return Object.keys(out).length ? out : undefined;
  },
};
