// The night recap, the endless contracts and the overnight locker (round 11, builder "today"; expert review #8 and
// #10b). DOM only, no THREE. main.js creates it once and calls render() whenever the report may have changed.
//
//   const recap = createRecap({ link, crew, report, me });
//   recap.render();             // the report's panel: Today's line, the contract result, the endless contract
//                               // picker, the stars and the locker, and "Good place to stop" at a promotion
//   recap.welcome(m);           // a saved crew coming back: "Previously on Range Rat" (m.previously)
//   recap.el()                  // the open night card (a menu root for the pad), or null
//   recap.close()               // Ⓑ / the button
//
// Every button is a real <button>, so the pad's D-pad + Ⓐ menu (menufocus.js) drives it; nothing here touches the
// pointer lock or full screen.
import { cardRows, daysText } from './awards.js';
import { MODS, todayName, goalText, starText, COSMETIC_BY_ID, unlockedLooks, nextLook, cycleLook } from './today.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColor = c => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : '#fff8ec');
const money = n => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

const CSS = `
#recapcard { z-index: 86; background: linear-gradient(rgba(14, 12, 28, 0.84), rgba(14, 12, 28, 0.96)); }
#recapcard .sheet { min-width: min(calc(100vw - 32px), 30em); max-width: calc(100vw - 32px); }
#recapcard h1 { margin: 0 0 0.1em; color: #ffb347; font-size: 2em; text-align: center; }
#recapcard .sub { text-align: center; margin: 0 0 0.6em; }
#recapcard .tot { display: flex; justify-content: space-between; gap: 2em; margin: 0.25em 0; }
#recapcard .tot b { color: #ffb347; }
#recapcard .rat { display: flex; justify-content: space-between; gap: 1.2em; margin: 0.4em 0; font-size: 1.05em; text-align: left; }
#recapcard .rat span { color: var(--dim, #e8d6bd); font-weight: 500; text-align: right; font-size: 0.9em; }
#recapcard .next { margin-top: 0.7em; color: #9fd39f; font-weight: 700; text-align: center; }
#recap-panel { display: flex; flex-direction: column; gap: 0.6em; align-items: center; }
#recap-panel .sheet { width: min(calc(100vw - 32px), 30em); font-size: 0.85em; }
#recap-panel .offer { display: block; width: 100%; text-align: left; margin: 0.25em 0; }
#recap-panel .offer.on { outline: 2px solid #ffb347; }
#recap-panel .stars { color: #ffcf5a; letter-spacing: 0.05em; }
#recap-panel .locker { display: flex; flex-wrap: wrap; gap: 0.4em; justify-content: center; }
`;

export function createRecap({ link, crew, report, me }) {
  let styled = false, cardEl = null, panelKey = '', shownPrev = false;
  const doc = typeof document !== 'undefined' ? document : null;
  const $ = id => doc?.getElementById(id);
  function style() {
    if (styled || !doc) return;
    styled = true;
    const s = doc.createElement('style'); s.textContent = CSS; doc.head.appendChild(s);
  }

  // ---- the night card ----------------------------------------------------------------------------------------
  function showNight(c, { previously = false } = {}) {
    if (!doc || !c) return;
    style();
    close();
    cardEl = doc.createElement('div');
    cardEl.id = 'recapcard'; cardEl.className = 'card';
    const rats = (c.rats ?? []).map(r => `<p class="rat" style="color:${safeColor(r.color)}"><b>${esc(r.name)}</b><span>${esc(r.award)}<br>${esc(r.line)}</span></p>`).join('');
    const rows = cardRows(c).map(([k, v]) => `<p class="tot">${esc(k)} <b>${esc(v)}</b></p>`).join('');
    cardEl.innerHTML = `<div class="sheet">
      <h1>${previously ? 'Previously on Range Rat' : 'Good place to stop'}</h1>
      <p class="sub">${esc(daysText(c))}${c.title ? ' · ' + esc(c.title) : ''}${c.cash ? ' · ' + money(c.cash) : ''}</p>
      ${rows}${rats}
      ${previously && c.next ? `<p class="next">${esc(c.next)}</p>` : ''}
    </div>
    <div class="row"><button type="button" id="recap-close" data-primary>${previously ? 'Back to work' : 'Back to the report'}</button></div>
    <p class="keys"><span class="gp">Ⓐ or Ⓑ</span><span class="kb">Esc</span> to close${previously ? '' : '. The crew code is your save.'}</p>`;
    doc.body.appendChild(cardEl);
    $('recap-close')?.addEventListener('click', close);
  }
  function close() {
    if (!cardEl) return;
    const back = !!$('report') && !$('report').classList.contains('hidden');
    cardEl.remove(); cardEl = null;
    if (back) $('recap-stop')?.focus();
  }
  doc?.addEventListener('keydown', e => { if (cardEl && e.key === 'Escape') { close(); e.stopPropagation(); } }, true);

  // A saved crew coming back (the server's welcome): once a page, never over a shift in progress.
  function welcome(m) {
    if (!m?.previously || shownPrev) return;
    shownPrev = true;
    const c = crew();
    if (c?.phase === 'shift') return;
    let seen = false;
    try { seen = sessionStorage.getItem('rr-prev') === String(m.code); sessionStorage.setItem('rr-prev', String(m.code)); } catch {}
    if (!seen) showNight(m.previously, { previously: true });
  }

  // ---- the report's panel -------------------------------------------------------------------------------------
  function panelHtml(c, r) {
    let html = '';
    const lines = [];
    if (r.today?.line) lines.push(esc(r.today.line));
    if (r.contract) {
      const k = r.contract;
      lines.push(k.met ? `Contract met: <b>+${k.stars} ★</b> (${k.total} total).` : `Contract missed: ${esc(goalText(k.goal))}.`);
      if (k.unlocked && COSMETIC_BY_ID[k.unlocked]) lines.push(`<b>Unlocked: ${esc(COSMETIC_BY_ID[k.unlocked].name)}!</b> Wear it below.`);
    }
    if (lines.length) html += `<div class="sheet">${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
    // Endless: tomorrow's three contracts (any Rat picks; the last pick stands).
    if (Array.isArray(c.offers) && c.offers.length) {
      html += `<div class="sheet"><h3>Tomorrow's contract</h3>` + c.offers.map((o, i) =>
        `<button type="button" class="offer quiet${(c.pick ?? 0) === i ? ' on' : ''}" id="contract-${i}"><span class="stars">${starText(o.stars)}</span> ${esc(todayName(o.mod) ?? MODS[o.mod?.id]?.name ?? '')} · ${esc(goalText(o.goal))}${(c.pick ?? 0) === i ? ' ✓' : ''}</button>`).join('') + '</div>';
    }
    // The stars and the locker (council round 12 #6d: a cosmetic at 3 stars, then every 5; each Rat picks their own hat and vest, the crew one paint).
    const stars = c.stars ?? 0;
    if (c.endless || stars > 0) {
      const nx = nextLook(stars);
      html += `<div class="sheet"><h3><span class="stars">★ ${stars}</span> lifetime stars</h3>${nx ? `<p class="note">Next: ${esc(nx.name)} at ${nx.stars} ★</p>` : ''}`;
      const owned = unlockedLooks(stars, (c.site13 ?? 0) > 0);   // council round 12 #8: the Site 13 jacket
      if (owned.length) {
        const mine = c.players?.find(p => p.id === me.id)?.look ?? {};
        const btn = (part, label, cur) => owned.some(o => o.part === part)
          ? `<button type="button" class="quiet" id="look-${part}">${label}: ${esc(COSMETIC_BY_ID[cur]?.name ?? 'standard')}</button>` : '';
        html += `<div class="locker">${btn('hat', 'Hat', mine.hat)}${btn('vest', 'Vest', mine.vest)}${btn('cart', 'Cart', c.cartPaint)}</div>`;
      }
      html += '</div>';
    }
    // At a promotion: the night card.
    if ((c.promotedTo || c.promo?.ready) && r.night) html += `<button type="button" class="quiet" id="recap-stop">Good place to stop</button>`;
    return html;
  }
  function render() {
    if (!doc) return;
    const c = crew(), r = report();
    const host = $('report-extra');
    let el = $('recap-panel');
    if (c?.phase !== 'report' || !r || !host) { if (el) { el.innerHTML = ''; panelKey = ''; } if (cardEl && c?.phase === 'shift') close(); return; }
    style();
    if (!el) { el = doc.createElement('div'); el.id = 'recap-panel'; host.after(el); }
    const mine = c.players?.find(p => p.id === me.id)?.look ?? null;
    const key = JSON.stringify([r.day, r.today, r.contract, c.offers, c.pick, c.stars, c.cartPaint, mine, !!(c.promotedTo || c.promo?.ready), !!r.night, c.endless]);
    if (key === panelKey) return;
    panelKey = key;
    const had = el.contains(doc.activeElement) ? doc.activeElement.id : '';
    el.innerHTML = panelHtml(c, r);
    (c.offers ?? []).forEach((o, i) => $('contract-' + i)?.addEventListener('click', () => link()?.act({ t: 'contract', i })));
    for (const part of ['hat', 'vest', 'cart']) {
      $('look-' + part)?.addEventListener('click', () => {
        const cc = crew(), cur = part === 'cart' ? cc.cartPaint : cc.players?.find(p => p.id === me.id)?.look?.[part];
        link()?.act({ t: 'look', part, id: cycleLook(cur, part, cc.stars ?? 0, (cc.site13 ?? 0) > 0) });
      });
    }
    $('recap-stop')?.addEventListener('click', () => showNight(report()?.night));
    if (had) $(had)?.focus();
  }

  return { render, welcome, showNight, close, el: () => cardEl };
}
