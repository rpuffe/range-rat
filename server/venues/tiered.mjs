// Tiered Entertainment Range (venue 2), server side: the Target Greens (council-round4.md §3.1, build item 4).
// A ball that comes to rest inside a bowl rolls into its cup; a CREW ball in a bowl is a TARGET (flushes the cup to
// the shooter, Hustle +0.25). Council round 7 (#1): at Tiered the gutters are linked (a TARGET drains all three cups);
// from the Stadium on they drain 1 ball a second from each cup. The Upper Deck is another module.
import { KIND_W, CART, QUOTA_KPI } from '../../web/js/sim.js';
import { MAP } from '../../web/js/map.js';
import { inBowl, cupSpot, bayUtil, cupFull, TARGET, GUTTERS, drainsAll, guttersDrain, cupWeight } from '../../web/js/tiered.js';

// Council round 10 #3: the dial's size, 30 + 2 x the upper bays in play (42 at 4P, 38 at 2P, 34 solo).
export const fullFor = crew => cupFull(crew.upperSeats?.().length ?? 0);
import { maxMult } from '../../web/js/owner.js';   // round 7 #9: the Owner's Hustle (x3 in endless)

const ballWeight = b => (KIND_W[b.kind] ?? 1) * (b.kind === 'splitter' ? 3 : 1);
const ballCount = b => (b.kind === 'splitter' ? 3 : 1);

function cupBalls(crew, id) {
  const out = [];
  for (const b of crew.balls.values()) if (b.cup === id && b.rest) out.push(b);
  return out;
}
function recount(crew, st) {
  const cups = MAP.BOWLS.map(() => 0);
  for (const b of crew.balls.values()) {
    if (!b.cup || !b.rest) continue;
    const i = MAP.BOWLS.findIndex(w => w.id === b.cup);
    if (i >= 0) cups[i] += cupWeight(b, crew.venue);   // round 8 #1: a glow ball counts 2 at Tiered (the Glow Rush)
  }
  st.cups = cups;
  st.full = fullFor(crew);
  st.kpi = bayUtil(cups.reduce((a, c) => a + c, 0), st.full);
  if (st.saved && st.kpiAtClose == null && st.kpi + 1e-9 < QUOTA_KPI) st.saved = null;     // round 8 #6: a later dip under the tick undoes the save
}
function remove(crew, b, by) {
  crew.balls.delete(b.id);
  crew.events.push({ t: 'gone', id: b.id, ...(by ? { by } : {}) });
}

export default {
  id: 'tiered',
  venue: 2,

  // kpiAtClose (owner playtest 3 §2): "the last customer out reads the bowls". At T-60 the gauge is stored and the
  // review reads it from then on (the purple bar freezes with a padlock tick, views/tiered.js).
  init: () => ({ cups: MAP.BOWLS.map(() => 0), kpi: 1, gt: MAP.BOWLS.map(() => 0), rc: 0, saved: null, kpiAtClose: null }),

  startShift(crew, st) { st.cups = MAP.BOWLS.map(() => 0); st.kpi = 1; st.gt = MAP.BOWLS.map(() => 0); st.rc = 0; st.saved = null; st.kpiAtClose = null; },

  tick(crew, st, dt) {
    if ((st.rc += dt) >= 0.25) { st.rc = 0; recount(crew, st); }      // balls are picked up elsewhere: recount
    if (st.kpiAtClose == null && crew.closing?.()) { recount(crew, st); st.kpiAtClose = st.kpi; crew.dirty = true; }
    if (!crew.working() || !guttersDrain(crew.up, crew.venue)) return;
    MAP.BOWLS.forEach((bowl, i) => {
      st.gt[i] = Math.min(st.gt[i] + dt * GUTTERS.PER_SEC, 1 + 1e-9);
      while (st.gt[i] >= 1) {
        const b = cupBalls(crew, bowl.id)[0];                         // oldest first (Map keeps insertion order)
        if (!b) { st.gt[i] = Math.min(st.gt[i], 1); break; }
        st.gt[i] -= 1;
        remove(crew, b);
        crew.bank(ballCount(b), 'gutter', 'gutter', ballWeight(b), TARGET.GEAR);
        crew.events.push({ t: 'gutter', bowl: bowl.id, x: bowl.x, z: bowl.z });
        recount(crew, st);
      }
    });
  },

  onRest(crew, st, b) {
    if (b.kind === 'one' || b.sunk || b.drifting || b.creek) return;
    delete b.cup;
    const shooter = b.by != null ? crew.players.get(b.by) : null;
    const target = !!shooter && crew.phase === 'shift';
    // The forgiving lip (council round 6, #4): a crew ball within r + LIP is a TARGET; customer balls cup inside r only.
    const bowl = inBowl(b.x, b.z, MAP.BOWLS, target ? TARGET.LIP : 0);
    if (!bowl) return;
    if (target) {
      // TARGET! Flush the cup (and this ball) to the shooter at gear x1; with linked gutters, every cup.
      recount(crew, st);
      const before = st.kpi;                                          // round 8 #6: the gauge this TARGET lifts
      const all = drainsAll(crew.up, crew.venue);
      const cup = all ? MAP.BOWLS.flatMap(w => cupBalls(crew, w.id)) : cupBalls(crew, bowl.id);
      let n = ballCount(b), w = ballWeight(b);
      for (const o of cup) { n += ballCount(o); w += ballWeight(o); remove(crew, o, shooter.id); }
      remove(crew, b, shooter.id);
      crew.bank(n, shooter.id, null, w, TARGET.GEAR, { target: true });   // the TARGET toast carries the cash (playtest 3)
      const paid = crew.events.at(-1)?.t === 'cash' ? crew.events.at(-1).cash : null;
      crew.mult = Math.min(maxMult(crew.up, crew.endless, CART.MAX_MULT), crew.mult + TARGET.HUSTLE);
      crew.stats.targets = (crew.stats.targets ?? 0) + 1;
      shooter.shift.targets = (shooter.shift.targets ?? 0) + 1;
      crew.events.push({ t: 'target', by: shooter.id, bowl: bowl.id, n, x: bowl.x, z: bowl.z, mult: crew.mult, cash: paid, ...(all ? { all: true } : {}) });
      crew.mods.signal('target', { by: shooter.id, bowl: bowl.id, n });
      recount(crew, st);
      // Round 8 #6 (B2): in Last Call at Tiered, a TARGET that lifts Bay Utilization from under the tick to over it saved
      // the stamp ("Saved by Cy's TARGET at 0:12." on a stamped bell). A later save replaces it; a dip clears it.
      if (crew.venue === 2 && crew.lastCall() && st.kpiAtClose == null && before + 1e-9 < QUOTA_KPI && st.kpi + 1e-9 >= QUOTA_KPI) {
        st.saved = { by: shooter.id, name: shooter.name, left: Math.max(0, Math.round(crew.shiftSecs - crew.shiftT)) };
        crew.events.push({ t: 'tieredsave', by: shooter.id });   // playthrough 4 B11: the live 'SAVED!' toast (views/tiered.js)
      }
      return;
    }
    const s = cupSpot(b.id, bowl);
    b.x = s.x; b.z = s.z; b.cup = bowl.id;
    crew.events.push({ t: 'cup', id: b.id, bowl: bowl.id, x: s.x, z: s.z });
    recount(crew, st);
  },

  kpi: (crew, st) => st.kpiAtClose ?? st.kpi,
  awards: () => [['Bullseye (Noted)', 'targets']],
  // saved (round 8 #6): { by, name, left } until the next morning, so the report card can name the save.
  // judged: the bowls were read at T-60 (util is then the frozen value).
  snapshot: (crew, st) => ({ cups: st.cups, full: st.full ?? fullFor(crew), util: Math.round((st.kpiAtClose ?? st.kpi) * 100) / 100, ...(st.kpiAtClose != null ? { judged: 1 } : {}), ...(st.saved ? { saved: st.saved } : {}) }),
};
