// Council round 13 #2e (builder 3): count the real screen, not the model. In ?debug, window.__centre samples the
// centre-zone elements (centre.js CENTRE.ZONE) every CENTRE.SAMPLE s and counts overlap frames: two or more at an
// effective opacity over CENTRE.OPACITY. Each overlap episode is logged with the texts. A real-time interval (rAF
// pauses in a background tab). The pure half is centre.js overlapOf.
import { CENTRE, overlapOf } from './centre.js';

function effOpacity(el, win) {
  let o = 1;
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    const cs = win.getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    o *= parseFloat(cs.opacity || '1');
    if (o <= 0) return 0;
  }
  const r = el.getBoundingClientRect?.();
  if (r && (r.width < 2 || r.height < 2)) return 0;
  return (el.textContent ?? '').trim() || el.querySelector?.('canvas') ? o : 0;
}

export function createCentreWatch({ win = window, doc = document, ids = CENTRE.ZONE, every = CENTRE.SAMPLE * 1000 } = {}) {
  const state = { overlaps: 0, frames: 0, samples: 0, log: [], last: null, running: true };
  let inOverlap = false, frames = 0, seen = -1;
  // Only painted frames count: with no frame since the last sample (a hidden pane, a background tab) the screen shows
  // nothing new, and a CSS fade that can't advance would read as an overlap that no one can see.
  const raf = win.requestAnimationFrame?.bind(win);
  if (raf) { const f = () => { frames++; if (state.running) raf(f); }; raf(f); }
  function sample() {
    if (!state.running) return;
    if (raf) { if (frames === seen) { state.skipped = (state.skipped ?? 0) + 1; return; } seen = frames; }
    state.samples++;
    const s = [];
    for (const id of ids) { const el = doc.getElementById(id); if (el) s.push({ id, text: (el.textContent ?? '').trim().slice(0, 80), opacity: effOpacity(el, win) }); }
    const up = overlapOf(s);
    state.last = s.filter(x => x.opacity > CENTRE.OPACITY).map(x => x.id);
    if (up) {
      state.frames++;
      if (!inOverlap) { state.overlaps++; state.log.push({ at: +(performance.now() / 1000).toFixed(1), up: up.map(x => `${x.id} (${x.opacity.toFixed(2)}): ${x.text}`) }); if (state.log.length > 50) state.log.shift(); console.warn('centre overlap', up.map(x => x.id + ': ' + x.text).join(' | ')); }
    }
    inOverlap = !!up;
  }
  const iv = setInterval(sample, every);
  state.reset = () => { state.overlaps = 0; state.frames = 0; state.samples = 0; state.log.length = 0; inOverlap = false; };
  state.stop = () => { state.running = false; clearInterval(iv); };
  state.sample = sample;
  return state;
}
