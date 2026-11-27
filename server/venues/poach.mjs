// Council round 13 #4b (builder 2): poach a Site 13 regular (endless). crew.buyPoach() takes the money and sets
// crew.poachDay; this module runs that day: a bay of Site 13's regulars hits at your range (EXTRA of the day's customer
// balls, from their own bay at REG_BAY), Site 13's live target drops CUT once, and the feed says so. The rules are
// web/js/owner.js (POACH, poachPrice, poachTarget); the week's double count is rivalBell(..., poached).
// No crew.rng() draw: the regulars' shots come from their own mulberry32 seeded by hash32(day, k).
import { launch, mulberry32 } from '../../web/js/sim.js';
import { hash32 } from '../../web/js/today.js';
import { POACH, POACH_BAY, poachTarget, POACH_FEED, poachPrice, poachDouble, POACH_ROW_LINE, HUSTLE_HINT } from '../../web/js/owner.js';

const CARD_AT = 9;   // s into the shift: the memo (SAY.SECS.MEMO 7 + its settle) has had its turn
export const REG_BAY = { x: POACH_BAY.x };   // their bay: just past the right end of the old line (the regulars brought their own mat)
const today = crew => !!crew.endless && Number.isInteger(crew.poachDay) && crew.poachDay === crew.day;

export default {
  id: 'poach',
  venue: 5,
  init(crew, saved) { if (Number.isInteger(saved?.day) && crew.poachDay == null) crew.poachDay = saved.day; return { cut: false, acc: 0, l0: null, k: 0, said: false }; },
  startShift(crew, st) { Object.assign(st, { cut: false, acc: 0, l0: null, k: 0, said: false, pa: false }); },
  tick(crew, st, dt) {
    if (!today(crew) || !crew.working()) return;
    if (!st.cut && crew.rivalT > 0) { st.cut = true; crew.rivalT = poachTarget(crew.rivalT); crew.dirty = true; }
    if (!st.said) {
      st.said = true; crew.stats.poached = 1;
      crew.events.push({ t: 'poach', text: POACH_FEED, ...(crew.rivalT > 0 ? { target: crew.rivalT } : {}) });
    }
    // Council round 14 #5b (builder 3; C #4): the one PA card (pa.js PA_LINES.poach), after the morning memo's 7 s.
    if (!st.pa && crew.shiftT >= CARD_AT) { st.pa = true; crew.pa('poach', { big: true }); }
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
    // Council round 14 #5b: dbl: the week's double is unused ("Counts double today" on the shop row).
    return { price, ...(price != null && poachDouble(crew.records?.rival) ? { dbl: 1 } : {}), ...(today(crew) ? { on: 1 } : {}) };
  },
  // Council round 14 #5b/#5c (builder 3): the report rows. A poach day: "Poached a regular · Site 13 −5 %". Once ever, the
  // first Hustle contract day that beats Site 13: HUSTLE_HINT (crew.voiced 'hustlehint', saved).
  reportRows(crew) {
    if (!crew.endless) return [];
    const rows = [];
    if (today(crew)) rows.push({ text: POACH_ROW_LINE });
    const beat = crew.rivalT > 0 && (+crew.records?.yesterday?.cash || 0) > crew.rivalT;
    if (beat && crew.contract?.goal?.k === 'hustle' && !crew.voiced?.has('hustlehint')) {
      crew.voiced.add('hustlehint'); crew.dirty = true;
      rows.push({ text: HUSTLE_HINT });
    }
    return rows;
  },
  toSave: crew => (Number.isInteger(crew.poachDay) ? { day: crew.poachDay } : undefined),
};
