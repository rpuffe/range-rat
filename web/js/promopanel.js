// The report's promotion panel (round2.js), as pure HTML. Council round 10 #1: the venue goal card replaces the
// review stamps: five rows (each a tick or a count, and its reward), today's newly done goals highlighted, and Sign
// only when all five are done (same buttons, same focus rule as owner playtest 3 §7.3). The headline above the
// report reads "3 of 5 done · 2 to go" or "Card done! Sign for Tiered." (goals.js headline).
// No THREE, no DOM: test/promopanel.test.mjs reads it.
import { money } from './sim.js';
import { cardHtml, headline, GOALS } from './goals.js';

// The card shows from the first report (it is the goal, not a reward for one).
export const showPromo = promo => !!promo;

// promo: crew.snapshot().promo ({ next, fee, ready, signed, done, of }); goals: crew.snapshot().goals ({ rows, reward,
// venue }); signed: did I sign; signedN / onlineN: the counts on the button; declined: the crew chose "Not yet".
// Playthrough 5: the heading names the venue the card is for ("Goals for Tiered", B10); an unsigned Sign is the
// report's primary ([data-primary], A1) with a quiet "Not yet" beside it (the server's decline: stay another day).
export function promoPanelHtml(promo, { goals = null, cash = 0, signed = false, signedN = 0, onlineN = 1, declined = false, esc = s => String(s) } = {}) {
  if (!showPromo(promo)) return '';
  const rows = goals?.rows ?? [];
  return '<div class="sheet promo"><h3>Goals for ' + esc(promo.next) + '</h3>' +
    cardHtml(rows, { rewardNow: goals?.reward ?? 0, esc }) +
    (promo.ready ? '<button id="sign-btn"' + (signed ? '' : ' data-primary') + '>' + (signed ? 'Unsign' : 'Sign the franchise agreement') + ' (' + signedN + ' of ' + onlineN + ' signed)</button>'
        + (signed || declined ? '' : '<button id="notyet-btn" class="quiet" type="button">Not yet: one more day here</button>')
      : rows.length && rows.filter(r => !r.done).every(r => r.kind === 'fee') ? '<p class="note">Fee: ' + money(Math.ceil(Math.max(0, promo.fee - cash))) + ' short</p>'
      : '<p class="note">Every goal done, then sign at the bell.</p>') + '</div>';
}

// Playthrough 5 A1 (client half): on a done, unsigned card, Next waits for Sign ("Sign to move up"), unless the crew
// chose "Not yet" (the server's decline) or the promotion already executed. -> null (Next as usual) or { text }
// (Next disabled, Sign is the primary).
export function nextGate(promo, { signed = false, declined = false, promotedTo = null } = {}) {
  if (!promo?.ready || promotedTo || declined || signed) return null;   // signed: Ready waits on the others (sigWait)
  return { text: 'Sign to move up' };
}

// The report's headline: the card's count ("3 of 5 done · 2 to go"), '' with no card.
export const cardHeadline = goals => (goals?.rows?.length ? headline(goals.rows, goals.venue) : '');

// Playthrough 5 C10 / A idea 4: the shop's order and its goal tags. goalShopIds: the shop rows an open 'buy' goal on
// the card names (the washer, the gutters, the second cart, the drones, the tether). shopSort: maxed rows last (they
// buried the tether), endless's Owner rows first, otherwise the SHOP order. maxed(item) -> bool.
export const goalShopIds = rows => new Set((rows ?? []).filter(r => !r.done && GOALS[r.id]?.kind === 'buy').map(r => GOALS[r.id].row));
export function shopSort(items, { endless = false, maxed = () => false } = {}) {
  return items.map((item, i) => ({ item, i, k: (endless && item.endless ? 0 : 1) * 2 + (maxed(item) ? 1 : 0) }))
    .sort((a, b) => a.k - b.k || a.i - b.i).map(x => x.item);
}
