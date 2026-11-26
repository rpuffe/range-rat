// Range Rat settings and first-time hints. The pure parts (defaults, clamping,
// load/save, which hint is due) are unit-tested; render() builds the panel.
// Everything touching storage is wrapped in try/catch: with storage blocked or
// throwing the game still works, it just forgets between visits.

export const KEY = 'rangerat.settings.v1';
export const HINTS_KEY = 'rangerat.hints.v1';

export const DEFAULTS = Object.freeze({ master: 1, sfx: 1, ambience: 1, pa: 1, paMode: 'voice', look: 1, invertY: false, graphics: 'auto', textSize: 100, reduceMotion: false, deckReplays: true });   // deckReplays: council round 10 #4, the Deck Cam
export const TEXT_SIZES = [100, 125, 150];   // percent; scales the whole UI (everything is in em)
export const LIMITS = Object.freeze({ master: [0, 1], sfx: [0, 1], ambience: [0, 1], pa: [0, 1], look: [0.25, 3] });
export const PA_MODES = ['voice', 'captions'];
export const GRAPHICS = ['auto', 'high', 'low'];   // auto: low on Xbox, high elsewhere (perf.js)

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
  out.graphics = GRAPHICS.includes(r.graphics) ? r.graphics : DEFAULTS.graphics;
  const ts = num(r.textSize, 0, 1000, NaN);
  out.textSize = Number.isFinite(ts) ? TEXT_SIZES.reduce((a, b) => (Math.abs(b - ts) < Math.abs(a - ts) ? b : a)) : DEFAULTS.textSize;
  out.reduceMotion = r.reduceMotion === true;
  out.deckReplays = r.deckReplays !== false;
  return out;
}

// Text size scales the root font (a CSS variable the stylesheet multiplies in); reduce
// motion is a class on <html> and a flag other code reads: SET.get().reduceMotion.
export function applyToDocument(s, doc = globalThis.document) {
  const root = doc?.documentElement; if (!root) return;
  root.style.setProperty('--ts', String(s.textSize / 100));
  root.classList.toggle('reduce-motion', !!s.reduceMotion);
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
onChange(applyToDocument);   // text size and reduce motion apply themselves, no main.js hook needed
export function set(patch, storage) {
  current = sanitize({ ...current, ...patch });
  save(current, storage);
  for (const fn of listeners) { try { fn(current); } catch { /* a bad listener must not break the menu */ } }
  return current;
}

// ---- first-time hints: each shown once ever per browser -------------------------
export const HINTS = Object.freeze({
  // Playthrough 4 A16: shop, sprint and bv are 8 words or fewer, and only on the Muni's days 1-2 (EARLY_HINTS).
  shop: { kb: 'Tab opens the shop. The range keeps going.', pad: 'D-pad up: the shop. The range keeps going.' },
  sprint: { kb: 'Hold Shift to sprint. It costs stamina.', pad: 'Click the left stick to sprint. Costs stamina.' },
  cctv: { kb: 'Press C for Corporate CCTV.', pad: 'D-pad down for Corporate CCTV.' },
  wand: { kb: 'The sign is filthy. Grab the pressure washer by the cart bay: E.', pad: 'The sign is filthy. Grab the pressure washer by the cart bay: Ⓧ.' },
  bank: { kb: 'Full. The ball return pays per ball: E there.', pad: 'Full. The ball return pays per ball: Ⓧ there.' },
  // Owner notes (2026-11-24): one tip per new thing, 8 words or fewer; crank and dive fold in "it just appeared".
  crank: { kb: 'Ball washer: hold Click at handle, circle mouse.', pad: 'Ball washer: tap Ⓐ at handle, circle stick.' },
  dive: { kb: 'Walk in to dive. Buddies pump your air.', pad: 'Walk in to dive. Buddies pump your air.' },
  mud: { kb: 'Muddy mat? E: pressure washer. Hold Click: spray.', pad: 'Muddy mat? Ⓧ: pressure washer. Hold Ⓐ: spray.' },
  shed: { kb: 'Snack shed open! Click at the counter: kitchen.', pad: 'Snack shed open! Ⓐ at the counter: kitchen.' },
  cart: { kb: 'New cart! F gets in. W/S drives.', pad: 'New cart! Ⓨ gets in. RT/LT drives.' },
  tube: { kb: 'Red box on the dock: E feeds balls.', pad: 'Red box on the dock: Ⓧ feeds balls.' },
  gutters: { kb: 'Gutters linked: one TARGET drains all three cups.', pad: 'Gutters linked: one TARGET drains all three cups.' },
  lift: { kb: 'The Lift: E on the platform rides up.', pad: 'The Lift: Ⓧ on the platform rides up.' },
  bv: { kb: 'A ball pays more the cleaner it is.', pad: 'A ball pays more the cleaner it is.' },   // owner playtest 3 §1.2
  deck: { kb: 'Fill their orders. Rounds count double.', pad: 'Fill their orders. Rounds count double.' },   // council round 7 #8
  creek: { kb: 'The creek is divable now. Float downstream.', pad: 'The creek is divable now. Float downstream.' },   // council round 10 #5
  green: { kb: 'Land a crew ball on a green: Hustle.', pad: 'Land a crew ball on a green: Hustle.' },   // council round 10 #6 (builder 2)
  drones: { kb: 'Drones! Hold F on foot: "Drones, here!"', pad: 'Drones! Hold Ⓨ on foot: "Drones, here!"' },   // playthrough 5 C4
  souvenir: { kb: 'Pink souvenir balls: carry them to the crowd rail.', pad: 'Pink souvenir balls: carry them to the crowd rail.' },   // round 11 (expert #9)
  hazard: { kb: 'Green hazard ball: spray it, then bag it.', pad: 'Green hazard ball: spray it, then bag it.', again: true },   // round 11 (expert #9); council round 11 #2: re-arms after a hazard DENIED
  bays: { kb: 'New bays built. More golfers, more mud.', pad: 'New bays built. More golfers, more mud.' },                 // round 11 (owner): Build more bays
});
// Context-driven hints (council round 4, §4.2): fires when its condition holds, once ever.
// ctx: { day, playSecs, venue, signMud, pocketFull, washerCash, onDock, beers, deckOrder }, plus tips.js tipCtx:
// { up, myDive, matMudNear, matMudMax } (owner notes: a tip right after buying or when a thing first appears)
export const HINT_WHEN = Object.freeze({
  wand: c => c.day === 1 && c.playSecs >= 20 && (c.signMud ?? 0) > 0.5,
  bank: c => !!c.pocketFull,
  crank: c => (c.up?.washer ?? 0) >= 1 || ((c.washerCash ?? 0) >= 10 && (c.up == null || (c.up.washer ?? 0) >= 1)),   // it appears, or it has money in it
  dive: c => !!c.onDock || (c.myDive ?? 0) >= 1,
  mud: c => (c.matMudNear ?? 0) >= 0.5 || (c.matMudMax ?? 0) >= 0.9,   // a muddy mat near you, or one a customer refuses
  shed: c => (c.up?.shed ?? 0) >= 1,
  cart: c => (c.up?.cart ?? 0) >= 1,
  tube: c => (c.up?.pond ?? 0) >= 1,
  gutters: c => (c.up?.gutters ?? 0) >= 1,
  lift: c => (c.venue ?? 0) >= 5,
  deck: c => (c.venue ?? 0) >= 2 && ((c.beers ?? 0) > 0 || !!c.deckOrder),   // the first order (or the first beer)
  creek: c => (c.venue ?? 0) >= 1 && !!c.creekNear,   // council round 10 #5: near the Club's running creek
  green: c => (c.venue ?? 0) < 2 && !!c.atBay,          // council round 10 #6: at a crew bay at the Muni or the Club
  drones: c => (c.up?.drones ?? 0) >= 1,                // playthrough 5 C4: teach the dispatch once drones are bought
  souvenir: c => (c.venue ?? 0) === 3 && !!c.souvOut,     // round 11: the first souvenir ball is out there
  hazard: c => (c.venue ?? 0) === 4 && !!c.hazOut,        // round 11: the first hazard ball
  bays: c => !!c.baysFresh,                               // round 11 (owner): a tier of Build more bays just went up (bayline.js)
  bv: c => (c.day ?? 1) >= 2 && (c.playSecs ?? 0) >= 8,   // the BV line appears on day 2: say what it is once
});
// Play-seconds before each hint is due; CCTV also needs the crew at venue 1+.
export const HINT_AFTER = Object.freeze({ shop: 10, sprint: 30, cctv: 6 });
export const HINT_ORDER = ['bv', 'wand', 'mud', 'bank', 'crank', 'shed', 'cart', 'dive', 'tube', 'gutters', 'lift', 'deck', 'creek', 'green', 'drones', 'souvenir', 'hazard', 'bays'];   // context hints, first due wins
export const HINT_GAP = 12;   // seconds between hints
export const SHOP_HINT_CASH = 20;
// Playthrough 4 A16: the onboarding tips belong to the Muni's first two days (a Club crew already knows them).
export const EARLY_HINTS = ['shop', 'sprint', 'bv'];
export const earlyDay = ({ venue = 0, day = 1 } = {}) => venue === 0 && (day ?? 1) <= 2;
// Playthrough 4 A16: a just-bought item's tip jumps the queue (and the gap): shop item id -> its tip.
export const BOUGHT_HINT = Object.freeze({ washer: 'crank', shed: 'shed', cart: 'cart', pond: 'tube', gutters: 'gutters', dive: 'dive', drones: 'drones', build: 'bays' });
export const BOUGHT_SECS = 15;   // how long a purchase waits for its tip's condition before it joins the queue as usual   // the shop hint waits for cash >= this (ctx.cash): before that the crew can't buy anything

export function loadSeen(storage = store()) {
  try {
    const a = JSON.parse(storage.getItem(HINTS_KEY));
    return Array.isArray(a) ? a.filter(id => id in HINTS) : [];
  } catch { return []; }
}
export function saveSeen(seen, storage = store()) {
  try { storage.setItem(HINTS_KEY, JSON.stringify([...new Set(seen)])); return true; } catch { return false; }
}
// Council round 11 #2: a hint with `again` can be shown once more (a County DENIED caused by hazards re-arms the
// hazard tip for the next morning). It drops out of the stored seen list and out of every live hinter's.
const hinters = new Set();
export function armAgain(id, storage = store()) {
  if (!HINTS[id]?.again) return false;
  saveSeen(loadSeen(storage).filter(x => x !== id), storage);
  for (const h of hinters) h.again(id);
  return true;
}
// Which hint (if any) is due now. playSecs: seconds actually playing this page load.
// ctx.bought: the tip of something just bought (BOUGHT_HINT), shown first, whatever the gap.
export function nextHint({ seen, playSecs, venue = 0, sinceLast = Infinity, ...ctx }) {
  const b = ctx.bought;
  if (b && !seen.includes(b) && HINT_WHEN[b]?.({ ...ctx, playSecs, venue })) return b;
  if (sinceLast < HINT_GAP) return null;
  const early = earlyDay({ venue, day: ctx.day });
  for (const id of ['shop', 'sprint', 'cctv']) {
    if (seen.includes(id) || playSecs < HINT_AFTER[id]) continue;
    if (EARLY_HINTS.includes(id) && !early) continue;
    if (id === 'cctv' && !(venue >= 1)) continue;
    if (id === 'shop' && !((ctx.cash ?? 0) >= SHOP_HINT_CASH)) continue;   // nothing to buy yet, nothing to say
    return id;
  }
  for (const id of HINT_ORDER) {
    if (EARLY_HINTS.includes(id) && !early) continue;
    if (!seen.includes(id) && HINT_WHEN[id]({ ...ctx, playSecs, venue })) return id;
  }
  return null;
}
export function hintText(id, pad) { return HINTS[id]?.[pad ? 'pad' : 'kb'] ?? ''; }

// One ticker for main.js: call tick(dt, { playing, venue, pad, show }) every frame.
export function createHinter({ storage } = {}) {
  let seen = loadSeen(storage), playSecs = 0, sinceLast = Infinity, bought = null;   // bought: { id, left }
  const h = {
    tick(dt, { playing, venue = 0, pad = false, show, ...ctx }) {
      if (bought && (bought.left -= dt) <= 0) bought = null;
      if (!playing) return null;
      playSecs += dt; sinceLast += dt;
      const id = nextHint({ ...ctx, seen, playSecs, venue, sinceLast, bought: bought?.id ?? null });
      if (!id) return null;
      if (id === bought?.id) bought = null;
      seen = [...seen, id]; sinceLast = 0; saveSeen(seen, storage);
      show?.(hintText(id, pad), id);
      return id;
    },
    // A purchase (shop item id): its tip, if it has one, comes next (playthrough 4 A16).
    bought(itemId) { const id = BOUGHT_HINT[itemId]; if (id && !seen.includes(id)) bought = { id, left: BOUGHT_SECS }; },
    // Round 11, skip ahead (test): the tips a crew at the starting point would already have seen (web/js/skip.js tipsFor).
    markSeen(ids) { const add = (ids ?? []).filter(id => id in HINTS && !seen.includes(id)); if (add.length) { seen = [...seen, ...add]; saveSeen(seen, storage); } },
    get seen() { return seen; },
    again(id) { if (HINTS[id]?.again && seen.includes(id)) seen = seen.filter(x => x !== id); },   // council round 11 #2 (armAgain)
  };
  hinters.add(h);
  return h;
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
    ${SLIDERS.map(([k, label, lo, hi, step, fmt], i) => `<label class="srow"><span>${label}</span>
      <input type="range"${i ? "" : " data-primary"} data-set="${k}" min="${lo}" max="${hi}" step="${step}" value="${s[k]}" aria-label="${label}"><output data-out="${k}">${fmt(s[k])}</output></label>`).join('')}
    <div class="srow"><span>Corporate PA</span><button type="button" class="quiet" data-toggle="paMode"></button><output></output></div>
    <div class="srow"><span>Invert look Y</span><button type="button" class="quiet" data-toggle="invertY"></button><output></output></div>
    <div class="srow"><span>Graphics</span><button type="button" class="quiet" data-toggle="graphics"></button><output></output></div>
    <div class="srow"><span>Text size</span><button type="button" class="quiet" data-toggle="textSize"></button><output></output></div>
    <div class="srow"><span>Reduce motion</span><button type="button" class="quiet" data-toggle="reduceMotion"></button><output></output></div>
    <div class="srow"><span>Deck replays</span><button type="button" class="quiet" data-toggle="deckReplays"></button><output></output></div>
  </div>
  <div class="row"><button type="button" id="settings-back">Back</button></div>
  <p class="keys"><span class="kb">Esc</span><span class="gp">Ⓑ</span> to go back. Settings are kept in this browser.</p>`;
  const paint = () => {
    const c = get();
    root.querySelector('[data-toggle="paMode"]').textContent = c.paMode === 'voice' ? 'Voice + captions' : 'Captions only';
    root.querySelector('[data-toggle="invertY"]').textContent = c.invertY ? 'On' : 'Off';
    root.querySelector('[data-toggle="graphics"]').textContent = { auto: 'Auto', high: 'High', low: 'Low (smoother)' }[c.graphics];
    root.querySelector('[data-toggle="textSize"]').textContent = c.textSize + '%';
    root.querySelector('[data-toggle="reduceMotion"]').textContent = c.reduceMotion ? 'On' : 'Off';
    root.querySelector('[data-toggle="deckReplays"]').textContent = c.deckReplays ? 'On' : 'Off';
  };
  paint();
  root.querySelectorAll('input[data-set]').forEach(inp => inp.addEventListener('input', () => {
    const k = inp.dataset.set, c = set({ [k]: Number(inp.value) });
    root.querySelector(`[data-out="${k}"]`).textContent = SLIDERS.find(r => r[0] === k)[5](c[k]);
  }));
  root.querySelector('[data-toggle="paMode"]').addEventListener('click', () => { set({ paMode: get().paMode === 'voice' ? 'captions' : 'voice' }); paint(); });
  root.querySelector('[data-toggle="invertY"]').addEventListener('click', () => { set({ invertY: !get().invertY }); paint(); });
  root.querySelector('[data-toggle="graphics"]').addEventListener('click', () => { set({ graphics: GRAPHICS[(GRAPHICS.indexOf(get().graphics) + 1) % GRAPHICS.length] }); paint(); });
  root.querySelector('[data-toggle="textSize"]').addEventListener('click', () => { set({ textSize: TEXT_SIZES[(TEXT_SIZES.indexOf(get().textSize) + 1) % TEXT_SIZES.length] }); paint(); });
  root.querySelector('[data-toggle="reduceMotion"]').addEventListener('click', () => { set({ reduceMotion: !get().reduceMotion }); paint(); });
  root.querySelector('[data-toggle="deckReplays"]').addEventListener('click', () => { set({ deckReplays: !get().deckReplays }); paint(); });
  root.querySelector('#settings-back').addEventListener('click', () => onBack?.());
  root.onkeydown = e => { if (e.code === 'Escape') { e.stopPropagation(); e.preventDefault(); onBack?.(); } };
}
