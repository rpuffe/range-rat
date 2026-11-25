// "On the green" (council round 10 #6), server side: at the Muni and the Club a crew ball that comes to rest on a green
// adds Hustle +0.1 (the shared cap), 5 times a shift. From Tiered the green has a cup and tiered.mjs makes it a TARGET.
// The ball itself is ordinary: somebody still picks it up. Pure rule: web/js/greens.js.
import { CART } from '../../web/js/sim.js';
import { maxMult } from '../../web/js/owner.js';
import { GREENS, onGreen } from '../../web/js/greens.js';

export default {
  id: 'greens',
  venue: 0,

  init: () => ({ n: 0 }),
  startShift(crew, st) { st.n = 0; },

  onRest(crew, st, b) {
    const shooter = b?.by != null ? crew.players.get(b.by) : null;
    const bowl = onGreen(b, { venue: crew.venue, crew: !!shooter, n: st.n, shift: crew.phase === 'shift' });
    if (!bowl) return;
    st.n++;
    crew.mult = Math.min(maxMult(crew.up, crew.endless, CART.MAX_MULT), crew.mult + GREENS.HUSTLE);
    shooter.shift.greens = (shooter.shift.greens ?? 0) + 1;
    crew.stats.greens = (crew.stats.greens ?? 0) + 1;
    crew.events.push({ t: 'onGreen', by: shooter.id, bowl: bowl.id, x: bowl.x, z: bowl.z, mult: crew.mult, n: st.n });
    crew.dirty = true;
  },
};
