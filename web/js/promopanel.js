// The report's promotion panel (round2.js), as pure HTML. Council round 10 #1: the venue goal card replaces the
// review stamps: five rows (each a tick or a count, and its reward), today's newly done goals highlighted, and Sign
// only when all five are done (same buttons, same focus rule as owner playtest 3 §7.3). The headline above the
// report reads "3 of 5 done · 2 to go" or "Card done! Sign for Tiered." (goals.js headline).
// No THREE, no DOM: test/promopanel.test.mjs reads it.
import { money } from './sim.js';
import { cardHtml, headline } from './goals.js';

// The card shows from the first report (it is the goal, not a reward for one).
export const showPromo = promo => !!promo;

// promo: crew.snapshot().promo ({ next, fee, ready, signed, done, of }); goals: crew.snapshot().goals ({ rows, reward,
// venue }); signed: did I sign; signedN / onlineN: the counts on the button.
export function promoPanelHtml(promo, { goals = null, cash = 0, signed = false, signedN = 0, onlineN = 1, esc = s => String(s) } = {}) {
  if (!showPromo(promo)) return '';
  const rows = goals?.rows ?? [];
  return '<div class="sheet promo"><h3>The goal card: ' + esc(promo.next) + '</h3>' +
    cardHtml(rows, { rewardNow: goals?.reward ?? 0, esc }) +
    (promo.ready ? '<button id="sign-btn">' + (signed ? 'Unsign' : 'Sign the franchise agreement') + ' (' + signedN + ' of ' + onlineN + ' signed)</button>'
      : rows.length && rows.filter(r => !r.done).every(r => r.kind === 'fee') ? '<p class="note">Fee: ' + money(Math.ceil(Math.max(0, promo.fee - cash))) + ' short</p>'
      : '<p class="note">Every goal done, then sign at the bell.</p>') + '</div>';
}

// The report's headline: the card's count ("3 of 5 done · 2 to go"), '' with no card.
export const cardHeadline = goals => (goals?.rows?.length ? headline(goals.rows, goals.venue) : '');
