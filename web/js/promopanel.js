// The report's "Request promotion" panel (round2.js), as pure HTML (council round 6 #7.3, the one-text pack): the panel
// appears from the first stamp, and the franchise fee only from the second (or once the crew is ready to sign).
// No THREE, no DOM: test/promopanel.test.mjs reads it.
import { money } from './sim.js';

export const FEE_FROM_STAMPS = 2;

export const showPromo = promo => !!promo && (promo.stamps > 0 || !!promo.ready);
export const showFee = promo => !!promo && (promo.stamps >= FEE_FROM_STAMPS || !!promo.ready);

// Playtest round 2, idea 5: stamps complete but the wallet isn't: say by how much.
export const feeShort = (promo, cash = 0) => 'Fee: ' + money(Math.ceil(Math.max(0, promo.fee - cash))) + ' short';

// Council round 7 #10.1 (A5): with every stamp in and the fee unpaid, the report LEADS with the shortfall:
// "3 stamps. $895 short." (4 words). '' otherwise (fewer stamps, ready to sign, or the fee covered).
export const feeHeadline = (promo, cash = 0) =>
  !promo || promo.ready || promo.stamps < promo.need || !(promo.fee > cash) ? ''
    : promo.stamps + ' stamps. ' + money(Math.ceil(promo.fee - cash)) + ' short.';

// promo: crew.snapshot().promo; cash: the crew's cash; signed: did I sign; signedN / onlineN: the counts on the button.
// headShown: the report's #fee-head headline already says the shortfall (playthrough 3 #9: say it once, not twice).
export function promoPanelHtml(promo, { cash = 0, signed = false, signedN = 0, onlineN = 1, esc = s => String(s), headShown = false } = {}) {
  if (!showPromo(promo)) return '';
  const dots = '●'.repeat(Math.min(promo.stamps, promo.need)) + '○'.repeat(Math.max(0, promo.need - promo.stamps));
  return '<div class="sheet promo"><h3>Request promotion: ' + esc(promo.next) + '</h3>' +
    '<p>Review stamps <b>' + dots + '</b></p>' +
    (showFee(promo) ? '<p>Franchise fee <b>' + money(promo.fee) + (promo.ready ? '' : ' · you have ' + money(cash)) + '</b></p>' : '') +
    (!headShown && !promo.ready && promo.stamps >= promo.need && promo.fee > cash ? '<p class="note">' + feeShort(promo, cash) + '</p>' : '') +
    (promo.ready ? '<button id="sign-btn">' + (signed ? 'Unsign' : 'Sign the franchise agreement') + ' (' + signedN + ' of ' + onlineN + ' signed)</button>'
      : promo.stamps >= promo.need ? ''
      : '<p class="note">Earn ' + promo.need + ' review stamps (hit the daily quota), then sign at the bell.</p>') + '</div>';
}
