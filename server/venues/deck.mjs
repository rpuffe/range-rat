// The Upper Deck, server side (council round 4, section 3.1 "Toy 2", build item 5). Beer pays a bar tab, the deck's
// Drinks count climbs, hot dogs sober it, and at six a lounger falls off the top row: a Liability fine, a knockdown
// for any Rat underneath, and Gary's kitchen stop fails. Active at Tiered and every later venue; the rules are pure
// (web/js/deck.js).
import { DECK, newDeck, stepDeck, applyServe, afterIncident, paysTab, tabFor, fillOrder, fineFor, landingSpot, hitByFall } from '../../web/js/deck.js';

const int = (v, lo, hi, d) => Number.isFinite(Number(v)) && v != null ? Math.max(lo, Math.min(hi, Math.floor(Number(v)))) : d;

function incident(crew, st, p) {
  const seat = afterIncident(st.deck), spot = landingSpot(seat);
  const k = st.falls = (st.falls ?? 0) + 1;                                     // round 8 #5: the k-th fall today costs more
  const fine = Math.abs(crew.payCash(-fineFor(crew.valueNow().bv, k)));       // never below $0: the change is what was really taken
  crew.stats.incidents = (crew.stats.incidents ?? 0) + 1;
  crew.stats.deckFines = (crew.stats.deckFines ?? 0) + fine;
  if (p?.shift) p.shift.lastOrders = (p.shift.lastOrders ?? 0) + 1;
  st.last = crew.day; st.today = true;
  if (crew.gary && (crew.gary.phase === 'warn' || crew.gary.phase === 'drive')) st.garyFail = true;
  crew.events.push({ t: 'deckFall', seat, x: spot.x, z: spot.z, by: p?.id ?? null, fine, k });
  for (const o of [...crew.players.values(), ...crew.helpers]) if (hitByFall(o, spot)) crew.knockDown(o, 'customer');
  crew.pa('deck', { once: true, big: true });
  crew.dirty = true;
}

export default {
  id: 'deck',
  venue: DECK.FROM_VENUE,

  init(crew, saved) {
    return { deck: newDeck(), last: int(saved?.last, 1, 1e6, crew.day || 1), today: false, garyFail: false, falls: 0 };
  },
  startShift(crew, st) { st.deck = newDeck(); st.today = false; st.garyFail = false; st.falls = 0; },   // the deck resets each morning
  // Council round 6 #6: the loungers order. Only while the shift clock runs; an unfilled order lapses quietly.
  tick(crew, st, dt) {
    if (!crew.working()) return;
    const r = stepDeck(st.deck, dt);
    if (r.order) { crew.events.push({ t: 'deckOrder', seat: st.deck.order.seat, ...(st.deck.order.round ? { round: true } : {}) }); crew.dirty = true; }
    if (r.expired || r.sobered) crew.dirty = true;
  },

  serve(crew, st, p, { item, quality }) {
    let filled = null;
    if (paysTab(item, quality)) {
      // An open order pays 10 x BV, a round 25 x BV (and is two drinks), an unordered beer 5 x BV.
      filled = fillOrder(st.deck, item, quality);
      const tab = crew.payCash(tabFor(crew.valueNow().bv, filled), p.id);
      if (filled) crew.stats.deckOrders = (crew.stats.deckOrders ?? 0) + 1;
      if (filled?.round) crew.stats.deckRounds = (crew.stats.deckRounds ?? 0) + 1;
      if (tab) crew.events.push({ t: 'deckTab', by: p.id, n: tab, ...(filled ? { order: true, seat: filled.seat } : {}), ...(filled?.round ? { round: true } : {}) });
    }
    if (applyServe(st.deck, item, quality, filled).incident) incident(crew, st, p);
  },

  inspect(crew, st, stopId) { if (stopId === 'kitchen' && st.garyFail) return false; },   // somebody fell off on his watch

  awards: () => [['Last Orders', 'lastOrders']],
  snapshot: (crew, st) => ({ drinks: st.deck.drinks, last: st.last, today: st.today,
    order: st.deck.order ? { seat: st.deck.order.seat, left: Math.max(0, Math.round(st.deck.order.left * 10) / 10), ...(st.deck.order.round ? { round: true } : {}) } : null }),
  toSave: (crew, st) => ({ last: st.last }),
};
