// Range Rat performance: the ?perf overlay, the Graphics tiers, and Auto mode.
// The numbers and decisions (profileFor, percentile, createAuto) are pure and unit-tested;
// createPerf() is the thin DOM / renderer shell around them. design/council-round4.md §4.4.
//
//   ?perf       shows the overlay (frame ms avg / p95 / worst over 5 s, draw calls, triangles,
//               heap where available) and logs a [perf] line every 10 s. P toggles it.
//   Graphics    Settings > Graphics: Auto (Low on Xbox, High elsewhere, and Auto steps down by
//               itself if frames run long), High, or Low.

export const WINDOW_MS = 5000;        // the overlay's sampling window
export const AUTO_P95_MS = 22;        // Auto steps down when p95 stays above this...
export const AUTO_HOLD_S = 10;        // ...for this long
export const AUTO_SETTLE_S = 6;       // ignore the first seconds (shader compiles) and the seconds after a step
export const AUTO_MAX_STEPS = 3;
export const isXbox = ua => /Xbox/i.test(ua || '');

// Which base tier a setting means on this device.
export const baseTier = (graphics, ua) => graphics === 'high' ? 'high' : graphics === 'low' ? 'low' : isXbox(ua) ? 'low' : 'high';

// The whole quality profile for a tier plus Auto's steps (0..3):
//   1: render scale 0.85, 2: shadows off, 3: customers down to 6.
export function profileFor(tier, steps = 0) {
  const low = tier === 'low';
  const p = {
    tier, low,
    pixelRatioCap: low ? 1 : 2,       // 4K TVs can mean 2-4x the pixels
    maxH: low ? 1080 : Infinity,      // internal render height; the canvas is CSS-scaled up
    renderScale: 1,
    shadows: true,
    shadowSize: low ? 1024 : 2048,
    shadowEvery: low ? 2 : 1,         // refresh the shadow map every Nth frame
    ballShadows: !low,                // 800 balls never cast on Low; only the sun and fixtures do
    maxFull: low ? 8 : 14,            // skinned customers
    nearM: low ? 30 : 50,
    scubaLow: low,                    // no light shafts, half the silt, half the kelp
    venueHz: low ? 20 : 0,            // venue animation rate; 0 = every frame
    steps: 0,
  };
  const n = Math.max(0, Math.min(AUTO_MAX_STEPS, steps | 0));
  p.steps = n;
  if (n >= 1) p.renderScale = 0.85;
  if (n >= 2) p.shadows = false;
  if (n >= 3) p.maxFull = Math.min(p.maxFull, 6);
  return p;
}

// Device pixel ratio to render at, given the viewport's CSS height.
export function pixelRatioFor(profile, dpr, cssH) {
  let r = Math.min(dpr || 1, profile.pixelRatioCap) * profile.renderScale;
  if (cssH > 0 && cssH * r > profile.maxH) r = profile.maxH / cssH;
  return Math.max(0.25, r);
}

// q in 0..1 of an array of numbers (nearest-rank, no interpolation).
export function percentile(values, q) {
  if (!values.length) return 0;
  const a = Array.from(values).sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.max(0, Math.ceil(q * a.length) - 1))];
}

export function summarize(values) {
  if (!values.length) return { n: 0, avg: 0, p50: 0, p95: 0, worst: 0 };
  let sum = 0, worst = 0;
  for (const v of values) { sum += v; if (v > worst) worst = v; }
  return { n: values.length, avg: sum / values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95), worst };
}

// Auto mode's decision: feed it (p95, seconds since last call); it says true when it's time
// to step down. Sustained pressure only: one good reading resets the hold.
export function createAuto({ limit = AUTO_P95_MS, hold = AUTO_HOLD_S, settle = AUTO_SETTLE_S, max = AUTO_MAX_STEPS } = {}) {
  let over = 0, quiet = settle, steps = 0;
  return {
    get steps() { return steps; },
    update(p95, dt) {
      if (steps >= max) return false;
      if (quiet > 0) { quiet -= dt; over = 0; return false; }
      over = p95 > limit ? over + dt : 0;
      if (over >= hold) { steps++; over = 0; quiet = settle; return true; }
      return false;
    },
    reset() { over = 0; quiet = settle; steps = 0; },
  };
}

// ---------------------------------------------------------------------------------
// The browser shell. Created once, early (the renderer init); attach() once the rest exists.
export function createPerf({ renderer, ua = '', graphics = 'auto', search = '', doc = globalThis.document, win = globalThis, now = () => globalThis.performance.now() } = {}) {
  const params = new URLSearchParams(search);
  const overlayAllowed = params.has('perf');
  let setting = graphics, profile = profileFor(baseTier(setting, ua), 0);
  const auto = createAuto();
  let hooks = null, frameN = 0, lastT = 0;
  let w = 0, h = 0;

  // ring buffer of the last few seconds of frame times
  const CAP = 1200, ms = new Float32Array(CAP), at = new Float32Array(CAP);
  let head = 0, count = 0;
  const windowed = () => {
    const out = [], t = now();
    for (let i = 0; i < count; i++) { const j = (head - 1 - i + CAP) % CAP; if (t - at[j] > WINDOW_MS) break; out.push(ms[j]); }
    return out;
  };

  // ---- renderer / hooks application --------------------------------------------
  function size(width = w, height = h) {
    w = width; h = height;
    renderer.setPixelRatio(pixelRatioFor(profile, win.devicePixelRatio, h));
    renderer.setSize(w, h, false);
  }
  function applyShadows() {
    if (!hooks?.sun) return;
    const s = hooks.sun.shadow;
    if (s.mapSize.x !== profile.shadowSize) {
      s.mapSize.set(profile.shadowSize, profile.shadowSize);
      if (s.map) { s.map.dispose(); s.map = null; }
    }
    hooks.sun.castShadow = profile.shadows;
    renderer.shadowMap.autoUpdate = profile.shadowEvery <= 1;
    renderer.shadowMap.needsUpdate = true;
    if (hooks.ballMesh) hooks.ballMesh.castShadow = profile.ballShadows && profile.shadows;
  }
  function apply() {
    if (w) size();
    applyShadows();
    hooks?.crowd?.setBudget?.({ maxFull: profile.maxFull, nearM: profile.nearM });
    hooks?.scuba?.setLowDetail?.(profile.scubaLow);
    hooks?.venueRate?.(profile.venueHz);
  }

  function setGraphics(g) {
    if (g === setting) return;
    setting = g; auto.reset();
    profile = profileFor(baseTier(setting, ua), 0);
    apply();
  }

  // ---- overlay -----------------------------------------------------------------
  let box = null, shown = false, overlayT = 0, logT = 0;
  function showOverlay(on) {
    shown = !!on;
    if (shown && !box && doc) {
      box = doc.createElement('pre');
      box.style.cssText = 'position:fixed;left:8px;top:8px;margin:0;padding:6px 8px;z-index:99999;pointer-events:none;' +
        'font:12px/1.35 ui-monospace,Consolas,monospace;color:#d8ffd8;background:rgba(0,0,0,.65);border-radius:4px;white-space:pre';
      doc.body.appendChild(box);
    }
    if (box) box.style.display = shown ? 'block' : 'none';
  }
  const readout = () => {
    const s = summarize(windowed()), r = renderer.info.render, mem = globalThis.performance?.memory;
    return { ...s, calls: r.calls, tris: r.triangles, heapMB: mem ? mem.usedJSHeapSize / 1048576 : null };
  };
  const fmt = r => `${r.avg.toFixed(1)} ms avg  p50 ${r.p50.toFixed(1)}  p95 ${r.p95.toFixed(1)}  worst ${r.worst.toFixed(1)}`;
  if (overlayAllowed) {
    showOverlay(true);
    win.addEventListener?.('keydown', e => { if (e.code === 'KeyP' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) showOverlay(!shown); });
  }

  // Call once per frame, just before renderer.render().
  function tick(t = now()) {
    frameN++;
    if (lastT) {
      const dt = t - lastT;
      if (dt < 1000 && !doc?.hidden) { ms[head] = dt; at[head] = t; head = (head + 1) % CAP; if (count < CAP) count++; }
      const dts = Math.min(dt, 250) / 1000;
      // Auto: only in Auto, only while the page is actually being watched.
      if (setting === 'auto' && !doc?.hidden && (overlayT = overlayT + dts) >= 1) {
        overlayT = 0;
        const p95 = percentile(windowed(), 0.95);
        if (auto.update(p95, 1)) {
          profile = profileFor(baseTier(setting, ua), auto.steps);
          apply();
          hooks?.toast?.('Lowered graphics to keep it smooth');
          if (overlayAllowed) console.log(`[perf] auto step ${auto.steps}: p95 ${p95.toFixed(1)} ms`, profile);
        }
      }
    }
    lastT = t;
    if (profile.shadowEvery > 1 && profile.shadows && frameN % profile.shadowEvery === 0) renderer.shadowMap.needsUpdate = true;
    if (overlayAllowed && frameN % 15 === 0) {
      const r = readout();
      if (shown && box) box.textContent = `${fmt(r)}\ncalls ${r.calls}  tris ${r.tris.toLocaleString()}` +
        (r.heapMB != null ? `  heap ${r.heapMB.toFixed(0)} MB` : '') + `\n${profile.tier}${profile.steps ? ' -' + profile.steps : ''}  ${renderer.domElement.width}x${renderer.domElement.height}  (${setting})`;
      if (t - logT > 10000) { logT = t; console.log(`[perf] ${fmt(r)}  calls ${r.calls}  tris ${r.tris}  ${profile.tier}/${profile.steps}  ${renderer.domElement.width}x${renderer.domElement.height}`); }
    }
  }

  return {
    get profile() { return profile; },
    get low() { return profile.low; },
    size, tick, setGraphics, readout,
    toggleOverlay: () => showOverlay(!shown),
    // hooks: { sun, crowd, scuba, ballMesh, venueRate(hz), toast(msg) }; applies the profile to them now.
    attach(hk) { hooks = hk; apply(); },
  };
}
