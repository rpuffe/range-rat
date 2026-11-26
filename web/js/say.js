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
  STORY_MEMO: 5,     // council round 11 #3: a story morning's memo shows 5 s, not 7
  FADE_MAX: 0.3,     // council round 11 8.6: the next card waits for the outgoing one's fade (transitionend), at most this long
  // Council round 12, 4c (builder 4): a story card waits for a PA card that ends within PA_WAIT; a longer one is snapped
  // off (its caption comes back, without the chime or the voice again, when the card ends). whenPaIdle's default cap.
  PA_WAIT: 2,
};
const LOW = new Set(['ALERT', 'TOAST', 'TIP']);     // dropped by the stamp and the bell lock
const HELD = new Set(['PA', 'MEMO']);               // held by the bell lock until the report closes

// Words as a player reads them: "$1,240" and "3/4" are one; a bare "·" or "—" is none.
export function wordCount(text) {
  return String(text ?? '').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}

// now(): seconds. warn(text, n): called once per over-long text (dev only; the adapter decides).
export function createSayModel({ now = () => Date.now() / 1000, warn = null } = {}) {
  let queue = [], visible = null, lastHide = -Infinity, seq = 0, lock = 'open', dropped = 0, holdUntil = -Infinity;
  // Round 12: the story card's turn (storycard.js). 'off'; 'want' (only a PA may still show: the queue drains to it);
  // 'on' (the card owns the centre: nothing shows but the bell's stamp, which preempts as ever).
  let gate = 'off';
  const paBlocks = t => queue.some(i => i.kind === 'PA' && !i.resumed && lock === 'open' && t >= holdUntil);   // round 12: a snapped-off caption waits for the card
  function tryGrant(t) {
    if (gate === 'want' && !visible && t >= lastHide + SAY.GAP && !paBlocks(t)) gate = 'on';
    return gate === 'on';
  }
  const warned = new Set();

  function hide(t) { visible = null; lastHide = t; }
  // Council round 12, 4c: the PA card (or a memo) gives the centre to the story card. It goes back to the front of the
  // queue with the time it had left, flagged `resumed` (pa.js shows the caption again without replaying the audio).
  function yieldToCard(t) {
    const v = visible; if (!v || v.kind === 'STAMP') return;
    v.preempted = true;
    if (HELD.has(v.kind)) queue.unshift({ ...v, secs: Math.max(SAY.MIN_SHOW, v.until - t), at: t, seq: -1 - seq++, preempted: false, resumed: v.kind === 'PA' || v.resumed, v: 0 });
    else dropped++;
    visible = null; lastHide = t - SAY.GAP;   // the card may take the turn at once
  }
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
    if (gate === 'on' && visible && visible.kind !== 'STAMP') yieldToCard(t);   // round 12, 4c: never under a story card
    if (gate === 'want') tryGrant(t);
    if (gate === 'on' || visible || t < lastHide + SAY.GAP) return visible;
    let best = null;
    for (const i of queue) {
      if (gate === 'want' && (i.kind !== 'PA' || i.resumed)) continue;   // round 12: a story card waits only for the PA lines
      if ((lock !== 'open' || t < holdUntil) && HELD.has(i.kind)) continue;   // the bell lock, or a hold (the Deck Cam)
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
    // Council round 12, 9.4: items waiting that will show (tips excluded: they wait for quiet themselves). No allocation.
    get pending() { let n = 0; for (const i of queue) if (i.kind !== 'TIP') n++; return n; },
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
    // Council round 10 #4: the Deck Cam's cut. For `secs` a queued PA card or memo waits (as the memo waits for the PA);
    // hold(0) lets them go at once (the cut was skipped). Playthrough 5 B3: a PA card or memo already up goes back to
    // the front of the queue (it shows again after the cut) instead of sitting over the fall.
    hold(secs) {
      const t = now();
      holdUntil = secs > 0 ? t + secs : -Infinity;
      if (secs > 0 && visible && HELD.has(visible.kind)) { queue.unshift({ ...visible, at: t, seq: -1 - seq++ }); hide(t); }
    },
    get held() { return now() < holdUntil; },
    // Round 12: the story card asks for the centre (granted at once when nothing is up and no PA line is waiting),
    // and gives it back when its beat ends. want() returns true when the turn is granted now.
    // Council round 12, 4c: a PA card already up with more than PA_WAIT to go is snapped off for the card (its caption
    // resumes after); one that ends within PA_WAIT, or a PA line still queued, goes first as before.
    want() {
      const t = now();
      if (gate === 'off') {
        gate = 'want';
        if (visible?.kind === 'PA' && visible.until - t > SAY.PA_WAIT && !paBlocks(t)) yieldToCard(t);
      }
      return tryGrant(t);
    },
    // Council round 12, 4c: no PA card up and none waiting to show (the end card and the like wait on this).
    get paIdle() { return visible?.kind !== 'PA' && !queue.some(i => i.kind === 'PA'); },
    release() { if (gate === 'off') return; gate = 'off'; lastHide = now(); },
    get gate() { return gate; },
    clear() { dropped += queue.length; queue = []; if (visible) hide(now()); },
    // Playthrough 4 C6: a keyed line that stopped being true leaves (queued or showing).
    forget(key) { drop(i => i.key === key); if (visible && visible.key === key) hide(now()); },
  };
}

// The DOM adapter: #toast for ALERT and TOAST, #hint for TIP, #memo for MEMO; PA and STAMP bring their own show/hide
// in data (the PA card, the board's stamp). It ticks on a real-time interval: a background tab pauses rAF.
// now / tick: injectable for tests (a fake clock, no interval).
// Council round 11 8.6: fade(el) → does the element have a fade running (default: a non-zero CSS transition); test-injectable.
const cssFades = el => {
  try { return !!el && typeof getComputedStyle === 'function' && getComputedStyle(el).transitionDuration.split(',').some(d => parseFloat(d) > 0); } catch { return false; }
};
export function createSay({ $ = id => document.getElementById(id), dev = false, onChange = null, now = () => performance.now() / 1000, tick = 100, fades = cssFades } = {}) {
  const model = createSayModel({
    now,
    warn: dev ? (text, n) => console.warn(`say: ${n} words (max ${SAY.MAX_WORDS}): ${text}`) : null,
  });
  let shown = null, shownV = -1;
  // Main session, council round 10: what is physically up (an item's card can outlive its turn if a render threw
  // mid-swap). Before anything shows, everything else that is up comes down: a MEMO never shares the screen with
  // a PA card, or the reverse.
  const up = new Set();
  function render(item, on) {
    if (on) for (const o of [...up]) if (o !== item) render(o, false);
    if (on) up.add(item); else up.delete(item);
    try { draw(item, on); } catch (err) { console.error('say: render', err); }
  }
  function draw(item, on) {
    const d = item.data ?? {};
    // Playthrough 5 B3: a memo and the PA card never share the screen, whatever a card's own show/hide did.
    if (on && item.kind !== 'MEMO') $('memo')?.classList.toggle('hidden', true);
    if (on && item.kind !== 'PA') $('pa-card')?.classList.toggle('on', false);
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
  // Council round 11 8.6: a card fading in over one fading out read as two texts on a slow frame. The outgoing element's
  // fade finishes (transitionend, at most SAY.FADE_MAX) before the next shows. The bell's stamp never waits, and a story
  // card taking the turn snaps the outgoing card off with no fade.
  const elOf = item => (!item ? null : item.kind === 'MEMO' ? $('memo') : item.kind === 'PA' ? $('pa-card') : item.kind === 'TIP' ? $('hint') : item.kind === 'STAMP' ? null : $('toast'));
  // fadeUntil: the next card waits at most FADE_MAX from when it is due (null until one is); a fade with no
  // transitionend is over after 1 s anyway (never a stuck queue).
  let fading = null, fadeAt = 0, fadeUntil = null, fadeEl = null;
  function endFade() { fading = null; fadeUntil = null; }
  function startFade(item, el = elOf(item)) {
    if (!el || !fades(el)) return;
    fading = item; fadeAt = now(); fadeUntil = null; fadeEl = el;
    const done = ev => { if (ev && ev.target !== el) return; el.removeEventListener?.('transitionend', done); if (fading === item) { endFade(); sync(); } };
    el.addEventListener?.('transitionend', done);
  }
  function snap() {   // the story card took the turn: the outgoing card goes at once
    const el = fadeEl; endFade(); fadeEl = null;
    if (!el?.style) return;
    const tr = el.style.transition; el.style.transition = 'none';
    setTimeout(() => { el.style.transition = tr; }, 60);
  }
  // Council round 12, 4c: the "PA idle" signal. whenPaIdle(cap) resolves once no PA card is up, queued or fading out,
  // or after `cap` seconds whatever (never a stuck end card). Checked on every sync.
  let idleWaits = [];
  const paFading = () => !!fading && fading.kind === 'PA';
  const paIdleNow = () => model.paIdle && !paFading() && !$('pa-card')?.classList?.contains('on');
  function checkIdle() {
    if (!idleWaits.length) return;
    const t = now(), idle = paIdleNow();
    idleWaits = idleWaits.filter(w => { if (idle || t >= w.until) { w.resolve(idle); return false; } return true; });
  }
  function whenPaIdle(cap = SAY.PA_WAIT) {
    return new Promise(resolve => { idleWaits.push({ resolve, until: now() + Math.max(0, cap) }); checkIdle(); });
  }
  // The DOM side of the story turn: while the card owns the centre, no PA card or memo element stays lit, whatever a
  // card's own show/hide did (Stadium day 1, A #6). Class writes only when something is actually on.
  function guardCard() {
    if (model.gate !== 'on') return;
    const pc = $('pa-card'), me = $('memo');
    if (pc?.classList?.contains('on')) { const tr = pc.style.transition; pc.style.transition = 'none'; pc.classList.remove('on'); setTimeout(() => { pc.style.transition = tr; }, 60); }
    if (me?.classList && !me.classList.contains('hidden')) me.classList.add('hidden');
  }
  function sync() {
    const v = model.update();
    guardCard(); checkIdle();
    if (model.gate === 'on' && fadeEl) snap();
    if (v === shown && (!v || v.v === shownV)) return;
    if (shown && shown !== v) { render(shown, false); if (v?.kind !== 'STAMP') startFade(shown); shown = null; shownV = -1; if (model.gate === 'on' && fadeEl) snap(); }
    if (fading && now() - fadeAt > 1) endFade();
    if (v && v !== shown && fading && v.kind !== 'STAMP') {   // wait out the fade (transitionend, or FADE_MAX after it's due)
      fadeUntil ??= now() + SAY.FADE_MAX;
      if (now() < fadeUntil) return;
    }
    if (fading && v) endFade();
    if (v) render(v, true);
    shown = v; shownV = v?.v ?? -1;
    onChange?.(v);
  }
  const iv = tick ? setInterval(sync, tick) : null;
  // One sync after the current task, never mid-message: a memo, a phase change and a PA from one server tick all
  // queue first, so priority (not arrival order) decides what shows.
  let soon = false;
  const later = () => { if (!soon) { soon = true; queueMicrotask(() => { soon = false; sync(); }); } };
  const wrap = f => (...a) => { const r = f(...a); later(); return r; };
  return {
    say: wrap(model.say),
    bell: wrap(model.bell), report: wrap(model.report), open: wrap(model.open), clear: wrap(model.clear), forget: wrap(model.forget), hold: wrap(model.hold),
    // Council round 11 8.6: the story card's own fade-out is an outgoing card too (the memo after a beat waited on nothing).
    want: wrap(model.want), release: wrap(() => { const was = model.gate; model.release(); if (was !== 'off') startFade({ kind: 'CARD' }, $('story-card')); }), get gate() { return model.gate; },   // round 12: the story card's turn
    get held() { return model.held; },
    get paIdle() { return paIdleNow(); }, whenPaIdle,   // council round 12, 4c: the "PA idle" signal
    get pending() { return model.pending; },
    get up() { return [...up]; },
    busy: model.busy,
    get dropped() { return model.dropped; },
    get visible() { return model.visible; },
    sync, stop: () => iv && clearInterval(iv),
    model,
  };
}
