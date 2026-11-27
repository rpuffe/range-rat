// Council round 13 #4b (builder 2): poach a Site 13 regular (endless). crew.buyPoach() takes the money and sets
// crew.poachDay; this module runs that day: a bay of Site 13's regulars hits at your range (EXTRA of the day's customer
// balls, from their own bay at REG_BAY), Site 13's live target drops CUT once, and the feed says so. The rules are
// web/js/owner.js (POACH, poachPrice, poachTarget); the week's double count is rivalBell(..., poached).
// No crew.rng() draw: the regulars' shots come from their own mulberry32 seeded by hash32(day, k).
import { launch, mulberry32 } from '../../web/js/sim.js';
import { hash32 } from '../../web/js/today.js';
import { POACH, poachTarget, POACH_FEED, poachPrice } from '../../web/js/owner.js';

export const REG_BAY = { x: 22 };   // their bay: just past the right end of the old line (the regulars brought their own mat)
const today = crew => !!crew.endless && Number.isInteger(crew.poachDay) && crew.poachDay === crew.day;

export default {
  id: 'poach',
  venue: 5,
  init(crew, saved) { if (Number.isInteger(saved?.day) && crew.poachDay == null) crew.poachDay = saved.day; return { cut: false, acc: 0, l0: null, k: 0, said: false }; },
  startShift(crew, st) { Object.assign(st, { cut: false, acc: 0, l0: null, k: 0, said: false }); },
  tick(crew, st, dt) {
    if (!today(crew) || !crew.working()) return;
    if (!st.cut && crew.rivalT > 0) { st.cut = true; crew.rivalT = poachTarget(crew.rivalT); crew.dirty = true; }
    if (!st.said) {
      st.said = true; crew.stats.poached = 1;
      crew.events.push({ t: 'poach', text: POACH_FEED, ...(crew.rivalT > 0 ? { target: crew.rivalT } : {}) });
    }
    if (crew.closing?.()) return;
    const launched = crew.stats.launched ?? 0;
    if (st.l0 == null) st.l0 = launched;
    st.acc += Math.max(0, launched - st.l0) * POACH.EXTRA; st.l0 = launched;
    while (st.acc >= 1) {
      st.acc -= 1;
      const rng = mulberry32(hash32(crew.day, 'poach', st.k++));
      const b = crew.addBall({ ...launch(REG_BAY, rng), kind: 'range' });
      if (!b) break;
      crew.stats.poachBalls = (crew.stats.poachBalls ?? 0) + 1;
    }
    void dt;
  },
  // s.mods.poach: today's price for the shop (null: bought today, or no yesterday yet), and whether their bay is here.
  snapshot(crew) {
    if (!crew.endless) return undefined;
    const day = crew.phase === 'report' ? crew.day + 1 : crew.day;   // the shop's day (sim.js shopDay)
    const price = poachPrice({ endless: true, records: crew.records, day, poachDay: crew.poachDay ?? null });
    return { price, ...(today(crew) ? { on: 1 } : {}) };
  },
  toSave: crew => (Number.isInteger(crew.poachDay) ? { day: crew.poachDay } : undefined),
};
