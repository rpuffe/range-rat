// The one centre-text queue (council round 7 #3). Every centre-screen string goes through say(): the bell's stamp,
// the PA card, memos, alerts, your own toasts and first-time hints. Exactly one item shows at a time.
// A pure model (createSayModel: no DOM, injectable clock, node-tested) and a thin DOM adapter (createSay).
// The Board, the banner, the nudge slot, the feed, floats, pins and beams are world or edge text: not here.

// Priority, high to low. STAMP preempts; the rest wait their turn.
export const KINDS = ['STAMP', 'PA', 'MEMO', 'ALERT', 'TOAST', 'TIP'];
const RANK = Object.fromEntries(KINDS.map((k, i) => [k, i]));
export const SAY = {
  SECS: { STAMP: 1.5, PA: 5, MEMO: 7, ALERT: 3.5, TOAST: 2.5, TIP: 4 },   // how long each shows (PA: the audio's length)
  TTL: { ALERT: 15, TOAST: 3, TIP: 60 },   // seconds an item may wait in the queue; stale feedback is dropped, never late
  MIN_SHOW: 1.2,     // every item shows at least this long
  GAP: 0.3,          // between two items
  TIP_QUIET: 2,      // a tip waits for this long with nothing showing
  SETTLE: { MEMO: 0.6 },   // a memo settles this long, so the PA line from the same moment (a tick later) goes first
  MAX_WORDS: 8,
};
const LOW = new Set(['ALERT', 'TOAST', 'TIP']);     // dropped by the stamp and the bell lock
const HELD = new Set(['PA', 'MEMO']);               // held by the bell lock until the report closes

// Words as a player reads them: "$1,240" and "3/4" are one; a bare "·" or "—" is none.
export function wordCount(text) {
  return String(text ?? '').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}

// now(): seconds. warn(text, n): called once per over-long text (dev only; the adapter decides).
export function createSayModel({ now = () => Date.now() / 1000, warn = null } = {}) {
  let queue = [], visible = null, lastHide = -Infinity, seq = 0, lock = 'open', dropped = 0;
  const warned = new Set();

  function hide(t) { visible = null; lastHide = t; }
  function drop(pred) { const keep = queue.filter(i => !pred(i)); dropped += queue.length - keep.length; queue = keep; }

  // kind: one of KINDS. opts: { secs, key, data }. Returns the item, or null when it was dropped.
  function say(kind, text, opts = {}) {
    if (!(kind in RANK)) throw new Error('say: unknown kind ' + kind);
    const t = now();
    text = String(text ?? '');
    const words = wordCount(text);
    if (warn && words > SAY.MAX_WORDS && kind !== 'MEMO' && !warned.has(text)) { warned.add(text); warn(text, words); }
    const secs = Math.max(SAY.MIN_SHOW, opts.secs ?? SAY.SECS[kind]);
    const key = opts.key ?? null;
    // The same key updates in place: the visible one keeps its slot, a queued one keeps its place.
    if (key != null) {
      if (visible && visible.key === key && visible.kind === kind) {
        Object.assign(visible, { text, data: opts.data ?? visible.data, until: t + secs, v: visible.v + 1 });
        return visible;
      }
      const q = queue.find(i => i.key === key && i.kind === kind);
      if (q) { Object.assign(q, { text, secs, data: opts.data ?? q.data, at: t }); return q; }
    }
    const item = { kind, text, secs, key, data: opts.data ?? null, at: t, seq: seq++, v: 0, until: 0 };
    if (kind === 'STAMP') {   // preempts: clears the queued alerts, toasts and tips, and whatever is up
      drop(i => LOW.has(i.kind));
      if (visible) hide(t);
      show(item, t);
      return item;
    }
    if (lock === 'bell' && LOW.has(kind)) { dropped++; return null; }
    queue.push(item);   // shown on the next update(): items from the same tick queue first, so priority decides
    return item;
  }

  function show(item, t) { item.until = t + item.secs; visible = item; }

  // Advance the clock: hide what's done, drop what's stale, show the next. Returns the visible item.
  function update() {
    const t = now();
    if (visible && t >= visible.until) hide(t);
    drop(i => SAY.TTL[i.kind] != null && t - i.at > SAY.TTL[i.kind]);
    if (visible || t < lastHide + SAY.GAP) return visible;
    let best = null;
    for (const i of queue) {
      if (lock !== 'open' && HELD.has(i.kind)) continue;
      if (i.kind === 'TIP' && t - lastHide < SAY.TIP_QUIET) continue;
      if (t - i.at < (SAY.SETTLE[i.kind] ?? 0)) continue;
      if (!best || RANK[i.kind] < RANK[best.kind] || (RANK[i.kind] === RANK[best.kind] && i.seq < best.seq)) best = i;
    }
    if (best) { queue = queue.filter(i => i !== best); show(best, t); }
    return visible;
  }

  return {
    say, update,
    get visible() { return visible; },
    get queued() { return queue.slice(); },
    get dropped() { return dropped; },
    get lock() { return lock; },
    busy: (...kinds) => !!visible && (!kinds.length || kinds.includes(visible.kind)),
    // The bell lock: from the quota event only the stamp shows. Low kinds are dropped; PA and MEMO wait.
    bell() {
      const t = now();
      lock = 'bell';
      drop(i => LOW.has(i.kind));
      if (visible && visible.kind !== 'STAMP') {
        if (visible.kind === 'MEMO') queue.unshift({ ...visible, at: t });   // a memo comes back; a PA (audio) does not replay
        else dropped++;
        hide(t);
      }
    },
    // The report card is open: feedback may show again; PA and MEMO still wait for it to close.
    report() { if (lock === 'bell') lock = 'report'; },
    // The report closed (the next morning, the lobby): everything flows.
    open() { lock = 'open'; },
    clear() { dropped += queue.length; queue = []; if (visible) hide(now()); },
  };
}

// The DOM adapter: #toast for ALERT and TOAST, #hint for TIP, #memo for MEMO; PA and STAMP bring their own show/hide
// in data (the PA card, the board's stamp). It ticks on a real-time interval: a background tab pauses rAF.
export function createSay({ $ = id => document.getElementById(id), dev = false, onChange = null } = {}) {
  const model = createSayModel({
    now: () => performance.now() / 1000,
    warn: dev ? (text, n) => console.warn(`say: ${n} words (max ${SAY.MAX_WORDS}): ${text}`) : null,
  });
  let shown = null, shownV = -1;
  function render(item, on) {
    const d = item.data ?? {};
    if (item.kind === 'PA' || item.kind === 'STAMP') { (on ? d.show : d.hide)?.(item); return; }
    if (item.kind === 'MEMO') {
      if (on) {
        $('memo-text').textContent = item.text;
        $('memo-flavor').textContent = d.flavor ?? '';
        $('memo-target').textContent = d.target ?? '';
      }
      $('memo').classList.toggle('hidden', !on);
      return;
    }
    const el = $(item.kind === 'TIP' ? 'hint' : 'toast');
    if (!el) return;
    if (on) el.textContent = item.text;
    el.classList.toggle('show', on);
    el.classList.toggle('alert', on && item.kind === 'ALERT');
  }
  function sync() {
    const v = model.update();
    if (v === shown && (!v || v.v === shownV)) return;
    if (shown && shown !== v) render(shown, false);
    if (v) render(v, true);
    shown = v; shownV = v?.v ?? -1;
    onChange?.(v);
  }
  const iv = setInterval(sync, 100);
  // One sync after the current task, never mid-message: a memo, a phase change and a PA from one server tick all
  // queue first, so priority (not arrival order) decides what shows.
  let soon = false;
  const later = () => { if (!soon) { soon = true; queueMicrotask(() => { soon = false; sync(); }); } };
  const wrap = f => (...a) => { const r = f(...a); later(); return r; };
  return {
    say: wrap(model.say),
    bell: wrap(model.bell), report: wrap(model.report), open: wrap(model.open), clear: wrap(model.clear),
    busy: model.busy,
    get dropped() { return model.dropped; },
    get visible() { return model.visible; },
    sync, stop: () => clearInterval(iv),
    model,
  };
}
