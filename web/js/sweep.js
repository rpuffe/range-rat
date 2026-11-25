// Round 11 (expert #4): give picking feel, "the sweep". Balls picked within SWEEP.GAP seconds of each other build a
// sweep counter by the crosshair ("×14"); the pickup blip climbs in pitch with it (sfx.js sweepTick, off below ×5);
// at ×25 the crew hears "Clean sweep!" (a TOAST) and the shift's Hustle gets +1% (the server's own count grants it,
// so nobody can claim it). Driven-cart pickups count too. A big pocket rattles louder at the bank (sfx.js rattle).
//
// The pure counter (stepSweep) is shared: the client runs it for the juice, the server (crew.mjs) for the bonus.
// createSweep is the client's HUD piece: one absolutely positioned <div>, text set only when N changes, no per-frame
// allocation. It never takes focus, so the pad and full screen are untouched.

export const SWEEP = {
  GAP: 1.2,          // s: a pickup within this of the last one keeps the sweep going
  SHOW_FROM: 3,      // the ×N appears from ×3 (a single pick is not a sweep)
  CLEAN: 25,         // "Clean sweep!" and the bonus, once per sweep
  BONUS: 0.01,       // +1% Hustle for the shift (crew.mjs; capped by the Hustle cap like the pings)
  BONUS_MAX: 5,      // at most 5 a shift (+5%)
  FADE: 0.6,         // s: the ×N fades out after the sweep ends
};

// A sweep state: { n, last } (last: seconds, any clock). Returns the new n. `k` balls at once (a splitter, the cart).
export function stepSweep(st, now, k = 1) {
  const kk = Math.max(1, k | 0);
  st.n = st.last != null && now - st.last <= SWEEP.GAP + 1e-9 ? (st.n ?? 0) + kk : kk;
  st.last = now;
  return st.n;
}
// Did this step cross the "Clean sweep!" line? (n before and after the step.)
export const crossedClean = (before, after) => before < SWEEP.CLEAN && after >= SWEEP.CLEAN;
// Is the sweep still live at `now`?
export const sweepLive = (st, now) => st.last != null && now - st.last <= SWEEP.GAP + 1e-9;

// ---- the client HUD -----------------------------------------------------------------------------------------------
// opts: { root (default document.body), sfx: { sweepTick(n) } }.
export function createSweep({ root = globalThis.document?.body, sfx = null } = {}) {
  const st = { n: 0, last: null };
  let el = null, shown = 0, alpha = 0, lastNow = 0, popped = false, lit = false;
  if (root && globalThis.document) {
    el = document.createElement('div');
    el.id = 'sweep';
    el.setAttribute('aria-hidden', 'true');
    // By the crosshair (index.html #crosshair is the centre dot), down and right, small; pointer-events off.
    el.style.cssText = 'position:absolute;left:calc(50% + 18px);top:calc(50% + 10px);font:700 20px/1 system-ui,sans-serif;'
      + 'color:#fff6d8;text-shadow:0 1px 2px #000,0 0 6px rgba(0,0,0,0.6);pointer-events:none;opacity:0;z-index:5;'
      + 'transition:transform 80ms ease-out;will-change:opacity,transform;';
    root.appendChild(el);
  }
  return {
    // k balls picked now (seconds, performance clock).
    pick(now, k = 1) {
      const before = sweepLive(st, now) ? st.n : 0;
      const n = stepSweep(st, now, k);
      lastNow = now;
      for (let i = before + 1; i <= n && i <= before + 3; i++) sfx?.sweepTick?.(i);   // a cart scoop of 8 plays ≤3 blips
      // "Clean sweep!" is the server's word (its own count grants the bonus): main.js shows the 'sweep' event.
      if (el && n >= SWEEP.SHOW_FROM && n !== shown) {
        shown = n; el.textContent = '×' + n;
        el.style.transform = n >= SWEEP.CLEAN ? 'scale(1.25)' : 'scale(1.1)'; popped = true;
      }
      if (n >= SWEEP.SHOW_FROM) alpha = 1;
      return n;
    },
    // Each frame: fade the ×N once the sweep has ended.
    update(now, dt) {
      if (!el || alpha <= 0) return;
      if (sweepLive(st, now)) {                       // live: one style write when the pop settles, else nothing
        if (popped && now - lastNow > 0.1) { el.style.transform = 'scale(1)'; popped = false; }
        if (!lit) { el.style.opacity = '1'; lit = true; }
        return;
      }
      alpha = Math.max(0, alpha - dt / SWEEP.FADE); lit = false;   // the fade (0.6 s): the only per-frame writes
      el.style.opacity = String(Math.round(alpha * 20) / 20);
      if (alpha <= 0) shown = 0;
    },
    reset() { st.n = 0; st.last = null; alpha = 0; shown = 0; lit = false; if (el) el.style.opacity = '0'; },
    get n() { return st.n; },
  };
}
