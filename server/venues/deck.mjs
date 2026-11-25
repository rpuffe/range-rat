// The Upper Deck, server side (council round 4, section 3.1 "Toy 2", build item 5). Beer pays a bar tab, the deck's
// Drinks count climbs, hot dogs sober it, and at six a lounger falls off the top row: a Liability fine, a knockdown
// for any Rat underneath, and Gary's kitchen stop fails. Active at Tiered and every later venue; the rules are pure
// (web/js/deck.js).
import { DECK, newDeck, stepDeck, applyServe, afterIncident, paysTab, tabFor, fillOrder, fineFor, landingSpot, hitByFall,
  pourAhead, coldFill } from '../../web/js/deck.js';
import { UPPER, fellOff } from '../../web/js/customers.js';

// Council round 10 #3: the drinkers are the upper bays' customers; only the bays in play order and drink.
const seatsOf = crew => { const s = crew.upperSeats?.(); return s?.length ? s : undefined; };

const int = (v, lo, hi, d) => Number.isFinite(Number(v)) && v != null ? Math.max(lo, Math.min(hi, Math.floor(Number(v)))) : d;

function incident(crew, st, p) {
  const seat = afterIncident(st.deck, seatsOf(crew)), spot = landingSpot(seat);
  const k = st.falls = (st.falls ?? 0) + 1;                                     // round 8 #5: the k-th fall today costs more
  const fine = Math.abs(crew.payCash(-fineFor(crew.valueNow().bv, k)));       // never below $0: the change is what was really taken
  crew.stats.incidents = (crew.stats.incidents ?? 0) + 1;
  crew.stats.deckFines = (crew.stats.deckFines ?? 0) + fine;
  if (p?.shift) p.shift.lastOrders = (p.shift.lastOrders ?? 0) + 1;
  st.last = crew.day; st.today = true;
  if (crew.gary && (crew.gary.phase === 'warn' || crew.gary.phase === 'drive')) st.garyFail = true;
  crew.events.push({ t: 'deckFall', seat, x: spot.x, z: spot.z, by: p?.id ?? null, fine, k });
  for (const o of [...crew.players.values(), ...crew.helpers]) if (hitByFall(o, spot)) crew.knockDown(o, 'customer');
  // Round 10 #3: the faller was that bay's customer; the bay stays empty until the replacement has climbed the stairs.
  const now = crew.custT ?? 0;
  if (crew.mats) fellOff(crew.mats[UPPER.FROM + seat], now, DECK.REPLACE_SECS);
  // Round 10 #4: the world pauses with the Deck Cam. For LOOK_SECS Rats on foot can't be hit (crew.mjs reads lookUntil),
  // and every customer's next swing waits LOOK_SECS (they turn to look).
  crew.lookUntil = now + DECK.LOOK_SECS;
  for (const m of crew.mats ?? []) m.next = Math.max(0, m.next ?? 0) + DECK.LOOK_SECS;
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
    const r = stepDeck(st.deck, dt, seatsOf(crew));
    if (r.order) { crew.events.push({ t: 'deckOrder', seat: r.raised.seat, ...(r.raised.round ? { round: true } : {}) }); crew.dirty = true; }
    if (r.expired || r.sobered || r.warm) crew.dirty = true;
    if (r.warm) crew.events.push({ t: 'deckWarm', n: r.warm });
    // Round 11: a cold mug on the bar fills an open order at once (credited to whoever poured it).
    for (let f = coldFill(st.deck); f; f = coldFill(st.deck)) pour(crew, st, crew.players.get(f.by) ?? null, 'beer', 'good', f.order, true);
  },

  serve(crew, st, p, { item, quality, ahead = false }) {
    if (paysTab(item, quality)) {
      // An open order pays 10 x BV, a round 25 x BV (and is two drinks), an unordered beer 5 x BV.
      const filled = fillOrder(st.deck, item, quality);
      // Round 11: poured ahead (the kitchen's beer card says POUR AHEAD while no order is open) with room on the bar:
      // the mug waits there, cold, for the next order (deck.js pourAhead). A plain unordered beer is still 5 x BV.
      if (!filled && ahead && pourAhead(st.deck, p.id)) { crew.events.push({ t: 'deckCold', by: p.id, n: st.deck.cold.length }); crew.dirty = true; return; }
      pour(crew, st, p, item, quality, filled);
      return;
    }
    if (applyServe(st.deck, item, quality, null, seatsOf(crew)).incident) incident(crew, st, p);
  },

  inspect(crew, st, stopId) { if (stopId === 'kitchen' && st.garyFail) return false; },   // somebody fell off on his watch

  awards: () => [['Last Orders', 'lastOrders']],
  snapshot: (crew, st) => ({ drinks: st.deck.drinks, mugs: st.deck.mugs, last: st.last, today: st.today,
    order: st.deck.order ? { seat: st.deck.order.seat, left: Math.max(0, Math.round(st.deck.order.left * 10) / 10), ...(st.deck.order.round ? { round: true } : {}) } : null,
    // Round 11: how many orders wait behind the head, and the cold mugs on the bar.
    queue: st.deck.queue?.length ?? 0, cold: st.deck.cold?.length ?? 0 }),
  toSave: (crew, st) => ({ last: st.last }),
};

// A paying beer lands: the tab (an order 10 x BV, a round 25 x BV, unordered 5 x BV), the stats, the drink, the event,
// and a fall if that was one too many. p: the pourer (null if they've left). cold: it came off the bar (round 11).
function pour(crew, st, p, item, quality, filled, cold = false) {
  const tab = crew.payCash(tabFor(crew.valueNow().bv, filled), p?.id ?? null);
  if (filled) crew.stats.deckOrders = (crew.stats.deckOrders ?? 0) + 1;
  if (filled?.round) crew.stats.deckRounds = (crew.stats.deckRounds ?? 0) + 1;
  const r = applyServe(st.deck, item, quality, filled, seatsOf(crew));
  // Round 10 #3: the event names the seat the mug flies to (the beer line, views/deck.js), so the tab floats there.
  if (tab) crew.events.push({ t: 'deckTab', by: p?.id ?? null, n: tab, seat: r.seat, ...(filled ? { order: true } : {}), ...(filled?.round ? { round: true } : {}), ...(cold ? { cold: true } : {}) });
  if (r.incident) incident(crew, st, p);
  crew.dirty = true;
}
