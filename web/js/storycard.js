// Round 12: the story card overlay. One card at a time (web/js/story.js holds the beats and the sequence model).
// - The server's { t: 'story', id } queues a beat; the card asks say.js for the centre (sayer.want) and shows only
//   once it is granted, so nothing else draws centre text while a card is up, and it never covers a PA card or memo.
// - Ⓐ / Space / a click advances (after a short grace); Ⓑ / Esc skips the whole beat; with no press a card moves on
//   after STORY.CARD_SECS, so four Rats never wait on one. Each client steps its own cards.
// - It never pauses the sim, never touches the pointer lock or full screen, and is not a menu (no focus is taken:
//   menufocus.js and the pad's menu walk never see it). main.js routes the pad's Ⓐ/Ⓑ and the keys here while it's up.
// - The bell's stamp preempts it (the beat is skipped).
// DOM only, built lazily; ticks on a real-time interval as well as the frame (a background tab pauses rAF).
import { createStoryModel, WHO, STORY } from './story.js';
import { drawSeal } from './pa.js';

const CSS_ID = 'story-style';
const CSS = `
#story-card { position: fixed; top: 14%; left: 50%; transform: translate(-50%, -0.6em); width: min(calc(100vw - 32px), 30em);
  box-sizing: border-box; display: flex; gap: 0.9em; align-items: center; z-index: 61; cursor: pointer;
  background: #fbf6e8; color: #2a2418; border-radius: 0.3em; padding: 0.8em 1.2em 0.6em; box-shadow: 0 0.4em 1.5em #0008;
  font-family: "Courier New", ui-monospace, monospace; opacity: 0; pointer-events: none; transition: opacity 0.25s ease, transform 0.25s ease; }
#story-card.on { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
#story-card canvas { flex: none; width: 3.2em; height: 3.2em; }
#story-card .st-icon { flex: none; width: 2.6em; height: 2.6em; display: grid; place-content: center; font-size: 1.6em; }
#story-card .st-body { min-width: 0; flex: 1; }
#story-card .st-head { font-size: 0.7em; letter-spacing: 0.08em; border-bottom: 2px solid #2a2418; padding-bottom: 0.25em; }
#story-card .st-head:empty { display: none; }
#story-card .st-text { margin: 0.45em 0 0.35em; font-weight: 700; font-size: clamp(1.05em, 2.6vh, 1.5em); line-height: 1.3; }
#story-card.caption { background: #1d1a2c; color: #fff1d0; font-family: Georgia, "Times New Roman", serif; }
#story-card.caption .st-text { font-style: italic; font-weight: 600; }
#story-card.caption .st-head { border-color: #ffb347; color: #ffb347; }
#story-card.gary .st-head { color: #7d1812; }
#story-card .st-foot { display: flex; justify-content: space-between; gap: 1em; font-size: 0.7em; opacity: 0.7; }
#story-card .st-bar { height: 2px; background: currentColor; opacity: 0.35; transform-origin: left; }
`;

// Gary's mark: a clipboard (no seal: he isn't Corporate's mascot, he's Regional's man).
function drawClipboard(canvas) {
  const g = canvas.getContext?.('2d');
  if (!g) return;
  canvas.width = 96; canvas.height = 96;
  g.fillStyle = '#8a5a2b'; g.strokeStyle = '#2a2418'; g.lineWidth = 3;
  g.beginPath(); g.roundRect(20, 14, 56, 74, 6); g.fill(); g.stroke();
  g.fillStyle = '#fffdf6'; g.fillRect(27, 24, 42, 56);
  g.fillStyle = '#9aa0a6'; g.beginPath(); g.roundRect(36, 8, 24, 14, 3); g.fill(); g.stroke();
  g.strokeStyle = '#2a2418'; g.lineWidth = 2;
  for (let y = 34; y <= 70; y += 9) { g.beginPath(); g.moveTo(32, y); g.lineTo(y % 2 ? 58 : 64, y); g.stroke(); }
  g.strokeStyle = '#b3261e'; g.lineWidth = 3; g.beginPath(); g.moveTo(52, 68); g.lineTo(57, 74); g.lineTo(66, 60); g.stroke();
}

// sayer: say.js createSay (want/release/visible). keys(): { next, skip } glyph text for the foot (pad or keyboard).
export function createStoryCard({ sayer, keys = () => ({ next: 'Space', skip: 'Esc' }), now = () => performance.now() / 1000, tick = 100, onChange = null } = {}) {
  const model = createStoryModel({ now });
  const doc = typeof document !== 'undefined' ? document : null;
  let el = null, iconEl = null, headEl = null, textEl = null, footEl = null, barEl = null, shown = null, shownWho = null;

  function build() {
    if (el || !doc?.body) return !!el;
    if (!doc.getElementById(CSS_ID)) { const st = doc.createElement('style'); st.id = CSS_ID; st.textContent = CSS; doc.head.appendChild(st); }
    el = doc.createElement('div'); el.id = 'story-card'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
    iconEl = doc.createElement('div'); iconEl.className = 'st-icon'; iconEl.setAttribute('aria-hidden', 'true');
    const body = doc.createElement('div'); body.className = 'st-body';
    headEl = doc.createElement('div'); headEl.className = 'st-head';
    textEl = doc.createElement('p'); textEl.className = 'st-text';
    barEl = doc.createElement('div'); barEl.className = 'st-bar';
    footEl = doc.createElement('div'); footEl.className = 'st-foot';
    body.append(headEl, textEl, barEl, footEl); el.append(iconEl, body);
    // A click on the card advances (pointer-events only while it's on). mousedown, so the canvas handler never sees it.
    el.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); press(); });
    doc.body.appendChild(el);
    return true;
  }
  function icon(who) {
    if (who === shownWho) return;
    shownWho = who;
    iconEl.textContent = '';
    if (who === 'MEMO' || who === 'PA' || who === 'GARY') {
      const cv = doc.createElement('canvas'); (who === 'GARY' ? drawClipboard : drawSeal)(cv); iconEl.appendChild(cv);
    } else iconEl.textContent = '✦';
  }
  function render() {
    const c = model.card, beat = model.beat;
    if (c === shown) { if (c) bar(); return; }   // nothing changed (and no class write while idle)
    shown = c;
    if (!c) { el?.classList.remove('on'); onChange?.(null); return; }
    if (!build()) return;
    el.className = 'on ' + c.who.toLowerCase();
    icon(c.who);
    headEl.textContent = c.head ?? WHO[c.who] ?? '';
    textEl.textContent = c.who === 'GARY' ? '“' + c.line + '”' : c.line;
    const n = beat.cards.length, k = keys();
    footEl.innerHTML = `<span>${'●'.repeat(model.index + 1)}${'○'.repeat(n - model.index - 1)}</span><span>${k.next} next · ${k.skip} skip</span>`;
    bar();
    onChange?.(c);
  }
  let shownAt = 0;
  function bar() {
    if (!barEl) return;
    if (shown !== barEl._card) { barEl._card = shown; shownAt = now(); }
    barEl.style.transform = `scaleX(${Math.max(0, 1 - (now() - shownAt) / STORY.CARD_SECS).toFixed(3)})`;
  }
  // The loop: start a queued beat once say.js grants the turn; step the card; give the turn back at the end.
  function step() {
    if (model.up && sayer?.visible?.kind === 'STAMP') model.skip();   // the bell's stamp preempts a card
    if (!model.up && model.pending) {
      const granted = !sayer || sayer.gate === 'on' || sayer.want();
      if (!granted) { render(); return; }
      model.begin();
    }
    if (model.up) model.tick();
    if (!model.up && !model.pending && sayer?.gate !== 'off') sayer?.release?.();
    render();
  }
  function add(id) {
    if (!model.add(id)) return false;
    step();   // granted at once when nothing is up (the cold open and the epilogue go before their PA line)
    return true;
  }
  function press() { if (!model.up) return false; model.press(); step(); return true; }
  function skip() { if (!model.up) return false; model.skip(); step(); return true; }
  const iv = tick && typeof setInterval !== 'undefined' ? setInterval(step, tick) : null;
  return {
    add, press, skip, step,
    get up() { return model.up; },
    get card() { return model.card; },
    get beat() { return model.beat; },
    stop: () => iv && clearInterval(iv),
    model,
  };
}
