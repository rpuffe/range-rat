// Council round 13 #2e (builder 3): count the real screen, not the model. In ?debug, window.__centre samples the
// centre-zone elements (centre.js CENTRE.ZONE) every CENTRE.SAMPLE s and counts overlap frames: two or more at an
// effective opacity over CENTRE.OPACITY. Each overlap episode is logged with the texts. A real-time interval (rAF
// pauses in a background tab). The pure half is centre.js overlapOf.
//
// Council round 14 #0d (builder 4, C #12): the zone is the SCREEN, not just the DOM. `sprites()` (main.js) lists the
// world-text sprites ({ id, text, sprite, opacity }: Gary's bubble, the pay floats) and `camera()` the camera; a
// sprite whose projected box meets CENTRE.BOX counts as a centre item. All the pay floats together count as ONE item
// (they stack on each other by design), so "0 overlaps" means nothing else shared the centre with a centre text.
import { CENTRE, overlapOf, inCentreBox } from './centre.js';

// A sprite's screen box as viewport fractions (y down), or null when it is behind the camera or hidden. Debug only.
export function spriteBox(sprite, camera) {
  if (!sprite?.visible || !camera) return null;
  for (let o = sprite; o; o = o.parent) if (o.visible === false) return null;
  const V = sprite.position.constructor, c = new V(), up = new V();
  sprite.getWorldPosition(c);
  const s = new V(); sprite.getWorldScale?.(s) ?? s.copy(sprite.scale);
  up.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(s.y / 2).add(c);
  c.project(camera); up.project(camera);
  if (c.z > 1 || c.z < -1) return null;
  const hh = Math.abs(up.y - c.y), hw = hh * (s.x / Math.max(1e-6, s.y));   // NDC half sizes (aspect-free: the sprite faces the camera)
  const asp = camera.aspect ?? 1, hwx = hw / asp;
  return { x0: (c.x - hwx + 1) / 2, x1: (c.x + hwx + 1) / 2, y0: (1 - (c.y + hh)) / 2, y1: (1 - (c.y - hh)) / 2 };
}

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

export function createCentreWatch({ win = window, doc = document, ids = CENTRE.ZONE, every = CENTRE.SAMPLE * 1000, sprites = null, camera = null } = {}) {
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
    try {
      const cam = camera?.();
      let pay = null;
      for (const x of (cam && sprites?.()) ?? []) {
        if (!(x.opacity > CENTRE.OPACITY) || !inCentreBox(spriteBox(x.sprite, cam))) continue;
        if (x.id === 'payfloat') { if (!pay || x.opacity > pay.opacity) pay = { id: 'payfloat', text: String(x.text ?? '').slice(0, 80), opacity: x.opacity }; }
        else s.push({ id: x.id, text: String(x.text ?? '').slice(0, 80), opacity: x.opacity });
      }
      if (pay) s.push(pay);
    } catch { /* a view not built yet */ }
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
