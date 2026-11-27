// The one centre-text queue (council round 7 #3). Every centre-screen string goes through say(): the bell's stamp,
// the PA card, memos, alerts, your own toasts and first-time hints. Exactly one item shows at a time.
// A pure model (createSayModel: no DOM, injectable clock, node-tested) and a thin DOM adapter (createSay).
// The Board, the banner, the nudge slot, the feed, floats, pins and beams are world or edge text: not here.
// Council round 13 #2 (builder 3): the queue runs on centre.js, the one arbiter. Its ladder (story 0 · stamp and
// ALERT 1 · PA 2 · MEMO 3 · TIP and the checklist 4 · TOAST 5) replaces the old kind order, a higher priority snaps a
// lower one out (a PA card or memo resumes after), and the writers that aren't say() lines (the story card, the
// checklist, the end card) ask the same arbiter through sayer.centre.
import { createCentre, PRI, CENTRE } from './centre.js';

// Priority, high to low (centre.js PRI). STAMP preempts everything; a higher kind snaps a lower one.
export const KINDS = ['STAMP', 'ALERT', 'PA', 'MEMO', 'TIP', 'TOAST'];
const RANK = { STAMP: PRI.STAMP, ALERT: PRI.ALERT, PA: PRI.PA, MEMO: PRI.MEMO, TIP: PRI.TIP, TOAST: PRI.TOAST };
export const SAY = {
  SECS: { STAMP: 1.5, PA: 5, MEMO: 7, ALERT: 3.5, TOAST: 2.5, TIP: 4 },   // how long each shows (PA: the audio's length)
  TTL: { ALERT: 15, TOAST: 3, TIP: 60, PEAK: 45 },   // seconds an item may wait in the queue; stale feedback is dropped, never late
  // Council round 14 (builder 2's bug): a peak's start ALERT (these keys) waits up to TTL.PEAK s, not 15: the Happy Hour
  // ALERT was dropped on Tiered day 1 at 1P behind the reveal morning's cards. The peak runs 40–60 s, so it is still news.
  PEAK_KEYS: ['goldrush', 'happyhour', 'tourney', 'coach'],
  MIN_SHOW: CENTRE.MIN_SECS,     // every item shows at least this long
  GAP: CENTRE.FADE,              // between two items (the outgoing fade)
  TIP_QUIET: 2,      // a tip fires only after this long with nothing showing (quietFor); it never queues (round 13)
  SETTLE: { MEMO: 0.6 },   // a memo settles this long, so the PA line from the same moment (a tick later) goes first
  MAX_WORDS: 8,
  STORY_MEMO: 5,     // council round 11 #3: a story morning's memo shows 5 s, not 7
  FADE_MAX: 0.3,
  FADE_FRAMES: 2,    // round 13 #2e: and at least this many painted frames (a slow page)
  FADE_CAP: 3,       // round 13: a fade is over after this long whatever     // council round 11 8.6: the next card waits for the outgoing one's fade (transitionend), at most this long
  // Council round 12, 4c (builder 4): a story card waits for a PA card that ends within PA_WAIT; a longer one is snapped
  // off (its caption comes back, without the chime or the voice again, when the card ends). whenPaIdle's default cap.
  PA_WAIT: 2,
  PA_MAX_WAIT: CENTRE.MAX_WAIT[PRI.PA],   // round 13: a PA card waits this long (while it could show), then goes to the feed
};
const LOW = new Set(['ALERT', 'TOAST', 'TIP']);     // dropped by the stamp and the bell lock
const HELD = new Set(['PA', 'MEMO']);               // held by the bell lock until the report closes; resume after a snap

// Words as a player reads them: "$1,240" and "3/4" are one; a bare "·" or "—" is none.
export function wordCount(text) {
  return String(text ?? '').split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}

// now(): seconds. warn(text, n): called once per over-long text (dev only; the adapter decides).
// onDrop(item, why): an item left without showing (centre.js); a PA that waited past PA_MAX_WAIT is why === 'wait'.
export function createSayModel({ now = () => Date.now() / 1000, warn = null, onDrop = null } = {}) {
  let lock = 'open', holdUntil = -Infinity, extra = 0;
  // Round 12: the story card's turn (storycard.js). 'off'; 'want' (only a PA may still show: the queue drains to it);
  // 'on' (the card owns the centre: a priority-0 claim; nothing shows but the bell's stamp, which preempts as ever).
  let gate = 'off';
  const eligible = (i, t) => {
    if (gate === 'on') return i.kind === 'CARD';
    if (gate === 'want') return i.kind === 'PA' && !i.resumed;   // round 12: a story card waits only for the PA lines
    if (!i.say) return true;
    if ((lock !== 'open' || t < holdUntil) && HELD.has(i.kind)) return false;   // the bell lock, or a hold (the Deck Cam)
    if (t - i.at < (SAY.SETTLE[i.kind] ?? 0)) return false;
    return true;
  };
  const c = createCentre({ now, eligible, onDrop });
  const sayVis = () => (c.visible?.say ? c.visible : null);
  const paBlocks = t => c.queued.some(i => i.kind === 'PA' && !i.resumed && lock === 'open' && t >= holdUntil);   // round 12: a snapped-off caption waits for the card
  function tryGrant(t) {
    if (gate === 'want') {
      if (c.visible?.idle) c.snap(0);   // the checklist line steps aside at once
      if (!c.visible && !c.fading && !paBlocks(t)) {
        gate = 'on';
        c.request({ id: 'story', pri: PRI.STORY, kind: 'CARD', hold: true, now: true });
      }
    }
    return gate === 'on';
  }
  const warned = new Set();

  // kind: one of KINDS. opts: { secs, key, data }. Returns the item, or null when it was dropped.
  function say(kind, text, opts = {}) {
    if (!(kind in RANK)) throw new Error('say: unknown kind ' + kind);
    text = String(text ?? '');
    const words = wordCount(text);
    if (warn && words > SAY.MAX_WORDS && kind !== 'MEMO' && !warned.has(text)) { warned.add(text); warn(text, words); }
    const secs = Math.max(SAY.MIN_SHOW, opts.secs ?? SAY.SECS[kind]);
    const key = opts.key ?? null;
    const id = key != null ? kind + ':' + key : null;   // the same key updates in place (per kind)
    if (kind === 'STAMP') c.drop(i => LOW.has(i.kind));   // preempts: clears the queued alerts, toasts and tips, and whatever is up
    else if (lock === 'bell' && LOW.has(kind)) { extra++; return null; }
    const item = c.request({ id, pri: RANK[kind], kind, text, secs, data: opts.data ?? null, ttl: opts.ttl ?? (kind === 'ALERT' && SAY.PEAK_KEYS.includes(key) ? SAY.TTL.PEAK : SAY.TTL[kind] ?? Infinity),
      resume: HELD.has(kind), force: kind === 'STAMP', maxWait: kind === 'TIP' ? 0 : undefined });
    item.say = true; item.key = key;
    return item.state === 'dropped' ? null : item;
  }

  return {
    say,
    update() { c.update(); if (gate === 'want') tryGrant(now()); return sayVis(); },
    get visible() { return sayVis(); },
    get queued() { return c.queued.filter(i => i.say); },
    // Council round 12, 9.4: items waiting that will show (tips excluded: they wait for quiet themselves). No allocation.
    get pending() { let n = 0; for (const i of c.queued) if (i.say && i.kind !== 'TIP') n++; return n; },
    get dropped() { return c.dropped + extra; },
    get lock() { return lock; },
    busy: (...kinds) => { const v = sayVis(); return !!v && (!kinds.length || kinds.includes(v.kind)); },
    // The bell lock: from the quota event only the stamp shows. Low kinds are dropped; PA and MEMO wait.
    bell() {
      lock = 'bell';
      c.drop(i => LOW.has(i.kind));
      const v = c.visible;
      if (v && v.kind !== 'STAMP' && v.kind !== 'CARD') {
        if (v.kind === 'MEMO') c.snap(SAY.GAP);   // a memo comes back; a PA (audio) does not replay
        else { extra++; c.hide(); }
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
      holdUntil = secs > 0 ? now() + secs : -Infinity;
      if (secs > 0 && c.visible && HELD.has(c.visible.kind)) c.snap(SAY.GAP);
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
        const v = c.visible;
        if (v?.kind === 'PA' && v.until - t > SAY.PA_WAIT && !paBlocks(t)) c.snap(0);
      }
      return tryGrant(t);
    },
    // Council round 12, 4c: no PA card up and none waiting to show (the end card and the like wait on this).
    get paIdle() { return c.visible?.kind !== 'PA' && !c.queued.some(i => i.kind === 'PA'); },
    release() { if (gate === 'off') return; gate = 'off'; if (!c.release('story')) c.lastHide = now(); },
    get gate() { return gate; },
    clear() { c.clear(); },
    // Playthrough 4 C6: a keyed line that stopped being true leaves (queued or showing).
    forget(key) {
      const vis = !!c.visible?.say && c.visible.key === key;
      c.drop(i => i.say && i.key === key);
      if (vis) c.hide();
    },
    // Round 13: nothing up or waiting, for `secs` (a tip fires only then: it never queues).
    quietFor(secs = SAY.TIP_QUIET) { return c.quiet && now() - c.lastHide >= secs; },
    centre: c,
  };
}

// The DOM adapter: #toast for ALERT and TOAST, #hint for TIP, #memo for MEMO; PA and STAMP bring their own show/hide
// in data (the PA card, the board's stamp). It ticks on a real-time interval: a background tab pauses rAF.
// now / tick: injectable for tests (a fake clock, no interval).
// Council round 11 8.6: fade(el) → does the element have a fade running (default: a non-zero CSS transition); test-injectable.
const cssFades = el => {
  try { return !!el && typeof getComputedStyle === 'function' && getComputedStyle(el).transitionDuration.split(',').some(d => parseFloat(d) > 0); } catch { return false; }
};
// Round 13: feed(text) takes a PA caption that waited past SAY.PA_MAX_WAIT (centre.js) instead of showing it late.
export function createSay({ $ = id => document.getElementById(id), dev = false, onChange = null, now = () => performance.now() / 1000, tick = 100, fades = cssFades, feed = null } = {}) {
  const model = createSayModel({
    now,
    onDrop: (item, why) => { if (item.kind === 'PA' && why === 'wait') feed?.(item.text); },
    warn: dev ? (text, n) => console.warn(`say: ${n} words (max ${SAY.MAX_WORDS}): ${text}`) : null,
  });
  let shown = null, shownV = -1;
  // Main session, council round 10: what is physically up (an item's card can outlive its turn if a render threw
  // mid-swap). Before anything shows, everything else that is up comes down: a MEMO never shares the screen with
  // a PA card, or the reverse.
  const up = new Set();
  // Round 13 #2e: before an item draws, any other centre element that is logically off but still fading (a slow frame,
  // a stalled transitionend) goes in one step, so no painted frame ever holds two. Only on a show, never per frame.
  const OFF = { 'story-card': e => !e.classList.contains('on'), 'pa-card': e => !e.classList.contains('on'), memo: e => e.classList.contains('hidden'), toast: e => !e.classList.contains('show'), hint: e => !e.classList.contains('show') };
  function clearOthers(keep) {
    if (typeof getComputedStyle !== 'function') return;
    for (const id in OFF) {
      const e = $(id);
      if (!e || e === keep || !e.style || !OFF[id](e)) continue;
      let o = 0; try { o = parseFloat(getComputedStyle(e).opacity); } catch { /* ignore */ }
      if (!(o > 0.01)) continue;
      const tr = e.style.transition; e.style.transition = 'none'; afterPaint(() => { e.style.transition = tr; });
    }
  }
  function render(item, on) {
    if (on) for (const o of [...up]) if (o !== item) render(o, false);
    if (on) clearOthers(elOf(item));
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
  let fading = null, fadeAt = 0, fadeUntil = null, fadeEl = null, fadeFrame = 0;
  // Council round 13 #2e: painted frames. On a slow or throttled page (1 fps, a hidden pane) a 0.25 s CSS fade is still at
  // full opacity on the next painted frame, so a fade is over only once FADE_FRAMES frames have painted since it began
  // (and its transitionend or FADE_MAX), capped at FADE_CAP s whatever (never a stuck queue). A snapped element gets its
  // transition back only after two painted frames, so it goes in one step at any frame rate.
  let painted = 0;
  const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null;
  if (raf && tick) { const f = () => { painted++; raf(f); }; raf(f); }
  const afterPaint = fn => (raf && tick ? raf(() => raf(fn)) : setTimeout(fn, 60));
  const framesOk = () => !raf || !tick || painted - fadeFrame >= SAY.FADE_FRAMES;
  function endFade() { fading = null; fadeUntil = null; }
  function startFade(item, el = elOf(item)) {
    if (!el || !fades(el)) return;
    fading = item; fadeAt = now(); fadeUntil = null; fadeEl = el; fadeFrame = painted;
    const done = ev => { if (ev && ev.target !== el) return; el.removeEventListener?.('transitionend', done); if (fading === item) { endFade(); sync(); } };
    el.addEventListener?.('transitionend', done);
  }
  function snap() {   // the story card took the turn: the outgoing card goes at once
    const el = fadeEl; endFade(); fadeEl = null;
    if (!el?.style) return;
    const tr = el.style.transition; el.style.transition = 'none';
    afterPaint(() => { el.style.transition = tr; });
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
  let cardGuarded = false;
  function guardCard() {
    if (model.gate !== 'on') { cardGuarded = false; return; }
    if (!cardGuarded) { cardGuarded = true; clearOthers($('story-card')); }   // round 13: the card's first frame is its own
    const pc = $('pa-card'), me = $('memo');
    if (pc?.classList?.contains('on')) { const tr = pc.style.transition; pc.style.transition = 'none'; pc.classList.remove('on'); afterPaint(() => { pc.style.transition = tr; }); }
    if (me?.classList && !me.classList.contains('hidden')) me.classList.add('hidden');
  }
  function sync() {
    const v = model.update();
    guardCard(); checkIdle();
    if (model.gate === 'on' && fadeEl) snap();
    if (v === shown && (!v || v.v === shownV)) return;
    if (shown && shown !== v) { render(shown, false); if (v?.kind !== 'STAMP') startFade(shown); shown = null; shownV = -1; if (model.gate === 'on' && fadeEl) snap(); }
    if (fading && now() - fadeAt > SAY.FADE_CAP) endFade();
    if (v && v !== shown && fading && v.kind !== 'STAMP') {   // wait out the fade (transitionend, or FADE_MAX after it's due)
      fadeUntil ??= now() + SAY.FADE_MAX;
      if (now() < fadeUntil || !framesOk()) return;
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
    clearOthers,   // round 13: a non-say writer (the checklist) about to draw takes any fading say element out in one step
    // Round 13 #2: the arbiter, for the writers that aren't say() lines (centre.js request / release / up / busy).
    centre: {
      request: wrap(o => model.centre.request(o)), release: wrap(id => model.centre.release(id)),
      up: () => model.centre.up(), busy: pri => model.centre.busy(pri), get quiet() { return model.centre.quiet; },
      quietFor: s => model.quietFor(s),
    },
  };
}
