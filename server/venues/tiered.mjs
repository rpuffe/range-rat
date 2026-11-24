// Tiered Entertainment Range (venue 2), server side: the Target Greens (council-round4.md §3.1, build item 4).
// A ball that comes to rest inside a bowl rolls into its cup; a CREW ball in a bowl is a TARGET (flushes the cup to
// the shooter, Hustle +0.25); the gutters drain 1 ball a second from each cup. The Upper Deck is another module.
import { KIND_W, CART } from '../../web/js/sim.js';
import { MAP } from '../../web/js/map.js';
import { inBowl, cupSpot, bayUtil, TARGET, GUTTERS, hasGutters } from '../../web/js/tiered.js';

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
    if (i >= 0) cups[i] += ballCount(b);
  }
  st.cups = cups;
  st.kpi = bayUtil(cups.reduce((a, c) => a + c, 0));
}
function remove(crew, b, by) {
  crew.balls.delete(b.id);
  crew.events.push({ t: 'gone', id: b.id, ...(by ? { by } : {}) });
}

export default {
  id: 'tiered',
  venue: 2,

  init: () => ({ cups: MAP.BOWLS.map(() => 0), kpi: 1, gt: MAP.BOWLS.map(() => 0), rc: 0 }),

  startShift(crew, st) { st.cups = MAP.BOWLS.map(() => 0); st.kpi = 1; st.gt = MAP.BOWLS.map(() => 0); st.rc = 0; },

  tick(crew, st, dt) {
    if ((st.rc += dt) >= 0.25) { st.rc = 0; recount(crew, st); }      // balls are picked up elsewhere: recount
    if (!crew.working() || !hasGutters(crew.up)) return;
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
    if (b.kind === 'one' || b.sunk || b.drifting) return;
    delete b.cup;
    const bowl = inBowl(b.x, b.z);
    if (!bowl) return;
    const shooter = b.by != null ? crew.players.get(b.by) : null;
    if (shooter && crew.phase === 'shift') {
      // TARGET! Flush the cup (and this ball) to the shooter at gear x1.
      const cup = cupBalls(crew, bowl.id);
      let n = ballCount(b), w = ballWeight(b);
      for (const o of cup) { n += ballCount(o); w += ballWeight(o); remove(crew, o, shooter.id); }
      remove(crew, b, shooter.id);
      crew.bank(n, shooter.id, null, w, TARGET.GEAR);
      crew.mult = Math.min(CART.MAX_MULT, crew.mult + TARGET.HUSTLE);
      crew.stats.targets = (crew.stats.targets ?? 0) + 1;
      shooter.shift.targets = (shooter.shift.targets ?? 0) + 1;
      crew.events.push({ t: 'target', by: shooter.id, bowl: bowl.id, n, x: bowl.x, z: bowl.z, mult: crew.mult });
      crew.mods.signal('target', { by: shooter.id, bowl: bowl.id, n });
      recount(crew, st);
      return;
    }
    const s = cupSpot(b.id, bowl);
    b.x = s.x; b.z = s.z; b.cup = bowl.id;
    crew.events.push({ t: 'cup', id: b.id, bowl: bowl.id, x: s.x, z: s.z });
    recount(crew, st);
  },

  kpi: (crew, st) => st.kpi,
  awards: () => [['Bullseye (Noted)', 'targets']],
  snapshot: (crew, st) => ({ cups: st.cups, util: Math.round(st.kpi * 100) / 100 }),
};
