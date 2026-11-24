// Range Rat settings and first-time hints. The pure parts (defaults, clamping,
// load/save, which hint is due) are unit-tested; render() builds the panel.
// Everything touching storage is wrapped in try/catch: with storage blocked or
// throwing the game still works, it just forgets between visits.

export const KEY = 'rangerat.settings.v1';
export const HINTS_KEY = 'rangerat.hints.v1';

export const DEFAULTS = Object.freeze({ master: 1, sfx: 1, ambience: 1, pa: 1, paMode: 'voice', look: 1, invertY: false });
export const LIMITS = Object.freeze({ master: [0, 1], sfx: [0, 1], ambience: [0, 1], pa: [0, 1], look: [0.25, 3] });
export const PA_MODES = ['voice', 'captions'];

const num = (v, lo, hi, d) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

// Any junk in, a complete valid settings object out.
export function sanitize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const out = { ...DEFAULTS };
  for (const k of Object.keys(LIMITS)) out[k] = num(r[k], LIMITS[k][0], LIMITS[k][1], DEFAULTS[k]);
  out.paMode = PA_MODES.includes(r.paMode) ? r.paMode : DEFAULTS.paMode;
  out.invertY = r.invertY === true;
  return out;
}

const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };

export function load(storage = store()) {
  try { return sanitize(JSON.parse(storage.getItem(KEY))); } catch { return sanitize(null); }
}
export function save(s, storage = store()) {
  try { storage.setItem(KEY, JSON.stringify(sanitize(s))); return true; } catch { return false; }
}

// ---- live state + change hook ---------------------------------------------------
let current = load();
const listeners = new Set();
export const get = () => current;
// fn(settings) runs on every change, and once immediately so callers can apply the saved values.
export function onChange(fn) { listeners.add(fn); try { fn(current); } catch { /* ignore */ } return () => listeners.delete(fn); }
export function set(patch, storage) {
  current = sanitize({ ...current, ...patch });
  save(current, storage);
  for (const fn of listeners) { try { fn(current); } catch { /* a bad listener must not break the menu */ } }
  return current;
}

// ---- first-time hints: each shown once ever per browser -------------------------
export const HINTS = Object.freeze({
  shop: { kb: 'Tab opens the shop. The range keeps going while you shop.', pad: 'D-pad up opens the shop. The range keeps going while you shop.' },
  sprint: { kb: 'Hold Shift to sprint. It costs stamina.', pad: 'Click the right stick to sprint. It costs stamina.' },
  cctv: { kb: 'Press C for Corporate CCTV.', pad: 'D-pad down for Corporate CCTV.' },
});
// Play-seconds before each hint is due; CCTV also needs the crew at venue 1+.
export const HINT_AFTER = Object.freeze({ shop: 10, sprint: 30, cctv: 6 });
export const HINT_GAP = 12;   // seconds between hints

export function loadSeen(storage = store()) {
  try {
    const a = JSON.parse(storage.getItem(HINTS_KEY));
    return Array.isArray(a) ? a.filter(id => id in HINTS) : [];
  } catch { return []; }
}
export function saveSeen(seen, storage = store()) {
  try { storage.setItem(HINTS_KEY, JSON.stringify([...new Set(seen)])); return true; } catch { return false; }
}
// Which hint (if any) is due now. playSecs: seconds actually playing this page load.
export function nextHint({ seen, playSecs, venue = 0, sinceLast = Infinity }) {
  if (sinceLast < HINT_GAP) return null;
  for (const id of ['shop', 'sprint', 'cctv']) {
    if (seen.includes(id) || playSecs < HINT_AFTER[id]) continue;
    if (id === 'cctv' && !(venue >= 1)) continue;
    return id;
  }
  return null;
}
export function hintText(id, pad) { return HINTS[id]?.[pad ? 'pad' : 'kb'] ?? ''; }

// One ticker for main.js: call tick(dt, { playing, venue, pad, show }) every frame.
export function createHinter({ storage } = {}) {
  let seen = loadSeen(storage), playSecs = 0, sinceLast = Infinity;
  return {
    tick(dt, { playing, venue = 0, pad = false, show }) {
      if (!playing) return null;
      playSecs += dt; sinceLast += dt;
      const id = nextHint({ seen, playSecs, venue, sinceLast });
      if (!id) return null;
      seen = [...seen, id]; sinceLast = 0; saveSeen(seen, storage);
      show?.(hintText(id, pad), id);
      return id;
    },
    get seen() { return seen; },
  };
}

// ---- the panel -------------------------------------------------------------------
const pct = v => Math.round(v * 100) + '%';
const SLIDERS = [
  ['master', 'Master volume', 0, 1, 0.05, pct],
  ['sfx', 'Sound effects', 0, 1, 0.05, pct],
  ['ambience', 'Ambience', 0, 1, 0.05, pct],
  ['pa', 'Corporate PA volume', 0, 1, 0.05, pct],
  ['look', 'Look sensitivity', 0.25, 3, 0.05, v => v.toFixed(2) + '×'],
];

// Step a focused slider with the D-pad / left stick (dx -1 or 1). True if it handled it.
export function padAdjust(el, dx) {
  if (!el || el.tagName !== 'INPUT' || el.type !== 'range' || !dx) return false;
  const step = Number(el.step) || 0.05;
  el.value = String(Math.min(Number(el.max), Math.max(Number(el.min), Number(el.value) + Math.sign(dx) * step)));
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

// Fill `root` with the settings controls. onBack: the Back button or Esc (B is handled by main.js).
export function render(root, { onBack } = {}) {
  const s = get();
  root.innerHTML = `<h1>Settings</h1>
  <div class="settings-grid">
    ${SLIDERS.map(([k, label, lo, hi, step, fmt]) => `<label class="srow"><span>${label}</span>
      <input type="range" data-set="${k}" min="${lo}" max="${hi}" step="${step}" value="${s[k]}" aria-label="${label}"><output data-out="${k}">${fmt(s[k])}</output></label>`).join('')}
    <div class="srow"><span>Corporate PA</span><button type="button" class="quiet" data-toggle="paMode"></button><output></output></div>
    <div class="srow"><span>Invert look Y</span><button type="button" class="quiet" data-toggle="invertY"></button><output></output></div>
  </div>
  <div class="row"><button type="button" id="settings-back">Back</button></div>
  <p class="keys"><span class="kb">Esc</span><span class="gp">Ⓑ</span> to go back. Settings are kept in this browser.</p>`;
  const paint = () => {
    const c = get();
    root.querySelector('[data-toggle="paMode"]').textContent = c.paMode === 'voice' ? 'Voice + captions' : 'Captions only';
    root.querySelector('[data-toggle="invertY"]').textContent = c.invertY ? 'On' : 'Off';
  };
  paint();
  root.querySelectorAll('input[data-set]').forEach(inp => inp.addEventListener('input', () => {
    const k = inp.dataset.set, c = set({ [k]: Number(inp.value) });
    root.querySelector(`[data-out="${k}"]`).textContent = SLIDERS.find(r => r[0] === k)[5](c[k]);
  }));
  root.querySelector('[data-toggle="paMode"]').addEventListener('click', () => { set({ paMode: get().paMode === 'voice' ? 'captions' : 'voice' }); paint(); });
  root.querySelector('[data-toggle="invertY"]').addEventListener('click', () => { set({ invertY: !get().invertY }); paint(); });
  root.querySelector('#settings-back').addEventListener('click', () => onBack?.());
  root.onkeydown = e => { if (e.code === 'Escape') { e.stopPropagation(); e.preventDefault(); onBack?.(); } };
}
