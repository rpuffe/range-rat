// Round 11, "skip ahead (test)": start a NEW test crew at a later point of the game, on dev and localhost only.
// The pure parts (the host gate, the starting points, the tips a crew would have seen) are shared by the server
// (server/skip.mjs) and the title card; initSkip() is the title card's DOM side. test/skip.test.mjs covers the pure parts.

// The starting points, in game order. Each has a preset save in server/presets/<id>.json, made by a bot crew
// playing the real game (node scripts/make-presets.mjs).
export const PRESETS = Object.freeze([
  { id: 'muni4', label: 'Muni · day 4 (Gary)', venue: 0 },
  { id: 'club1', label: 'Range Club · day 1', venue: 1 },
  { id: 'tiered1', label: 'Tiered · day 1', venue: 2 },
  { id: 'stadium1', label: 'The Stadium · day 1', venue: 3 },
  { id: 'county1', label: 'The County · day 1', venue: 4 },
  { id: 'orbital1', label: 'The Orbital · day 1', venue: 5 },
  { id: 'lastbucket', label: 'The Last Bucket (finale)', venue: 5 },
  { id: 'endless', label: 'Endless (Range Rats LLC)', venue: 5, endless: true },
]);
export const presetById = id => PRESETS.find(p => p.id === id) ?? null;

// The host gate: localhost / 127.0.0.1 / [::1] (any port), or a dev deployment ("-dev." in the name, like
// range-rat-dev.fd.robertpuffe.com). Prod (range-rat.fd.robertpuffe.com) and everything else: no.
// host: a Host header or location.host ("name:port" allowed).
export function skipHostOk(host) {
  if (typeof host !== 'string' || !host || host.length > 255) return false;
  let h = host.trim().toLowerCase();
  if (h.startsWith('[')) h = h.slice(0, h.indexOf(']') + 1);   // [::1]:8091 -> [::1]
  else h = h.replace(/:\d+$/, '');
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return true;
  return /^[a-z0-9.-]+$/.test(h) && h.includes('-dev.');
}

// The first-time tips (settings.js HINTS ids) a crew at this save would already have seen, so a skip doesn't
// flood the new player with tips for old things. What's NEW at the starting point stays unseen (the Club's creek and
// CCTV on Club day 1, the deck at Tiered, the Lift on the Orbital's first day).
export function tipsFor(save) {
  const up = save?.up ?? {}, v = Math.floor(Number(save?.venue) || 0), end = !!save?.endless;
  const vd = Math.floor(Number(save?.venueDay) || 0);
  const tips = ['shop', 'sprint', 'bv', 'wand', 'bank', 'mud'];
  if (v >= 1 || end || (save?.day ?? 1) >= 3) tips.push('green');
  if (v >= 2 || end) tips.push('cctv', 'creek');
  if (v >= 3 || end) tips.push('deck');
  if (end || (v === 5 && vd >= 2)) tips.push('lift');
  if ((up.washer ?? 0) >= 1) tips.push('crank');
  if ((up.shed ?? 0) >= 1) tips.push('shed');
  if ((up.cart ?? 0) >= 1) tips.push('cart');
  if ((up.pond ?? 0) >= 1) tips.push('tube', 'dive');
  else if (Object.values(save?.diveByName ?? {}).some(n => n >= 1)) tips.push('dive');
  if ((up.gutters ?? 0) >= 1) tips.push('gutters');
  if ((up.drones ?? 0) >= 1) tips.push('drones');
  return tips;
}

// ---- the title card (DOM) ----------------------------------------------------------
// A quiet "Skip ahead (test)" button under Start a crew; it unfolds one button per starting point. Every control is a
// plain <button>, so the pad's menu focus (menufocus.js, pad.js navTargets) walks them like any other.
// onPick(id) starts the crew (main.js). Shown only when this page's host passes the gate.
// Council round 11 8.14 (C #10): the title rejoined the last crew after a skip preset. Picking one clears the seat
// (net.js keeps it in sessionStorage as 'range-rat.seat'), so the title can't rejoin the crew you skipped away from.
export const SEAT_KEY = 'range-rat.seat';
export function clearSeat(storage = globalThis.sessionStorage) {
  try { storage?.removeItem(SEAT_KEY); return true; } catch { return false; }
}
export function initSkip({ doc = globalThis.document, host = globalThis.location?.host, onPick, storage = globalThis.sessionStorage } = {}) {
  const box = doc?.getElementById('skip');
  if (!box || !skipHostOk(host)) return false;
  const toggle = doc.getElementById('skip-toggle'), list = doc.getElementById('skip-list');
  list.innerHTML = PRESETS.map(p => `<button type="button" class="quiet" data-skip="${p.id}">${p.label}</button>`).join('');
  box.classList.remove('hidden');
  toggle.addEventListener('click', () => {
    const open = list.classList.toggle('hidden') === false;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) list.querySelector('button')?.focus();
  });
  list.addEventListener('click', e => {
    const id = e.target?.closest?.('[data-skip]')?.dataset.skip;
    if (id) { clearSeat(storage); onPick?.(id); }
  });
  return true;
}
