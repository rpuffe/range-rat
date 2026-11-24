// The report's "Request promotion" panel (round2.js), as pure HTML (council round 6 #7.3, the one-text pack): the panel
// appears from the first stamp, and the franchise fee only from the second (or once the crew is ready to sign).
// No THREE, no DOM: test/promopanel.test.mjs reads it.
import { money } from './sim.js';

export const FEE_FROM_STAMPS = 2;

export const showPromo = promo => !!promo && (promo.stamps > 0 || !!promo.ready);
export const showFee = promo => !!promo && (promo.stamps >= FEE_FROM_STAMPS || !!promo.ready);

// promo: crew.snapshot().promo; cash: the crew's cash; signed: did I sign; signedN / onlineN: the counts on the button.
export function promoPanelHtml(promo, { cash = 0, signed = false, signedN = 0, onlineN = 1, esc = s => String(s) } = {}) {
  if (!showPromo(promo)) return '';
  const dots = '●'.repeat(Math.min(promo.stamps, promo.need)) + '○'.repeat(Math.max(0, promo.need - promo.stamps));
  return '<div class="sheet promo"><h3>Request promotion: ' + esc(promo.next) + '</h3>' +
    '<p>Review stamps <b>' + dots + '</b></p>' +
    (showFee(promo) ? '<p>Franchise fee <b>' + money(promo.fee) + (promo.ready ? '' : ' · you have ' + money(cash)) + '</b></p>' : '') +
    (promo.ready ? '<button id="sign-btn">' + (signed ? 'Unsign' : 'Sign the franchise agreement') + ' (' + signedN + ' of ' + onlineN + ' signed)</button>'
      : '<p class="note">Earn ' + promo.need + ' review stamps (hit the daily quota), then sign at the bell.</p>') + '</div>';
}
