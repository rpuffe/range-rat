// The Upper Deck, server side (council round 4, section 3.1 "Toy 2", build item 5). Beer pays a bar tab, the deck's
// Drinks count climbs, hot dogs sober it, and at six a lounger falls off the top row: a Liability fine, a knockdown
// for any Rat underneath, and Gary's kitchen stop fails. Active at Tiered and every later venue; the rules are pure
// (web/js/deck.js).
import { DECK, newDeck, stepDeck, applyServe, afterIncident, paysTab, tabFor, fineFor, landingSpot, hitByFall } from '../../web/js/deck.js';

const int = (v, lo, hi, d) => Number.isFinite(Number(v)) && v != null ? Math.max(lo, Math.min(hi, Math.floor(Number(v)))) : d;

function incident(crew, st, p) {
  const seat = afterIncident(st.deck), spot = landingSpot(seat);
  const fine = Math.abs(crew.payCash(-fineFor(crew.valueNow().bv)));          // never below $0: the change is what was really taken
  crew.stats.incidents = (crew.stats.incidents ?? 0) + 1;
  crew.stats.deckFines = (crew.stats.deckFines ?? 0) + fine;
  if (p?.shift) p.shift.lastOrders = (p.shift.lastOrders ?? 0) + 1;
  st.last = crew.day; st.today = true;
  if (crew.gary && (crew.gary.phase === 'warn' || crew.gary.phase === 'drive')) st.garyFail = true;
  crew.events.push({ t: 'deckFall', seat, x: spot.x, z: spot.z, by: p?.id ?? null, fine });
  for (const o of [...crew.players.values(), ...crew.helpers]) if (hitByFall(o, spot)) crew.knockDown(o, 'customer');
  crew.pa('deck', { once: true, big: true });
  crew.dirty = true;
}

export default {
  id: 'deck',
  venue: DECK.FROM_VENUE,

  init(crew, saved) {
    return { deck: newDeck(), last: int(saved?.last, 1, 1e6, crew.day || 1), today: false, garyFail: false };
  },
  startShift(crew, st) { st.deck = newDeck(); st.today = false; st.garyFail = false; },   // the deck resets each morning
  tick(crew, st, dt) { if (crew.working()) stepDeck(st.deck, dt); },

  serve(crew, st, p, { item, quality }) {
    if (paysTab(item, quality)) {
      const tab = crew.payCash(tabFor(crew.valueNow().bv), p.id);
      if (tab) crew.events.push({ t: 'deckTab', by: p.id, n: tab });
    }
    if (applyServe(st.deck, item, quality).incident) incident(crew, st, p);
  },

  inspect(crew, st, stopId) { if (stopId === 'kitchen' && st.garyFail) return false; },   // somebody fell off on his watch

  awards: () => [['Last Orders', 'lastOrders']],
  snapshot: (crew, st) => ({ drinks: st.deck.drinks, last: st.last, today: st.today }),
  toSave: (crew, st) => ({ last: st.last }),
};
