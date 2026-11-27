// Council round 13 #2 (builder 3): one centre text, enforced at the source. The one arbiter every centre writer asks.
// Pure: no DOM, injectable clock (test/centre.test.mjs). say.js's queue runs on it, and so do the writers that are not
// say() lines: the story card (priority 0, a held claim), the checklist line (an idle claim), the end card.
//
// The ladder, from highest:
//   0  the story card (and the note card, the epilogue cards, the end card)
//   1  the boss stamp, the bell's stamp and the venue ALERTs (MOW-E phases, the Stretch, Inspection, the Tournament)
//   2  PA cards
//   3  the memo
//   4  tips and the checklist line
//   5  toasts (your own feedback)
//
// The rules:
//   - only one item draws (`up`);
//   - a higher priority arriving snaps the lower one out in CENTRE.SNAP; an item marked `resume` (a PA card, a memo)
//     goes back to the front of the queue with the time it had left (a PA's caption, no chime or voice again);
//   - a lower priority waits, up to its `maxWait` of waiting while it could otherwise show (PA 6 s, then onDrop hands
//     its caption to the feed); `maxWait: 0` never queues (a tip fires now or not at all); `ttl` is an absolute life;
//   - an outgoing item's fade (CENTRE.FADE) finishes before the next item starts;
//   - `hold: true` stays up until release(id) (the story card, the end card); `idle: true` is a standing line that
//     draws only while nothing else is up or waiting, and steps aside for anything (the checklist).
//
// API: request({ id, pri, text, minSecs, secs, maxWait, ttl, hold, idle, resume, data, kind }) → the ticket (its
// `state`: 'queued' | 'up' | 'out' | 'dropped'); up() → the one item on screen; busy(pri) → anything at that priority
// or higher is up or queued; release(id); update() advances the clock.
export const PRI = { STORY: 0, NOTE: 0, END: 0, STAMP: 1, BOSS: 1, ALERT: 1, PA: 2, MEMO: 3, TIP: 4, CHECK: 4, TOAST: 5 };
export const CENTRE = {
  SNAP: 0.15,        // s: a higher priority snaps the lower one out this fast
  FADE: 0.3,         // s: the outgoing item's fade, finished before the next one draws (say.js SAY.GAP)
  MIN_SECS: 1.2,     // every item shows at least this long
  MAX_WAIT: { 2: 6, 4: 0 },   // by priority: a PA waits 6 s (then its caption goes to the feed); a tip never queues
  // The ?debug DOM counter (centrewatch.js): the centre-zone elements, sampled every SAMPLE s, "up" over OPACITY.
  ZONE: ['story-card', 'pa-card', 'memo', 'hint', 'todo', 'toast', 'bell-stamp', 'mowe-stamp', 'endcard', 'ending-flash'],
  SAMPLE: 0.1,
  OPACITY: 0.3,
  // Council round 14 #0d (C #12): the centre zone on screen, as viewport fractions (x0, y0 top-left .. x1, y1). A world
  // text sprite (Gary's bubble, the pay floats) whose screen box meets it counts as a centre item in the counter.
  BOX: { x0: 0.2, y0: 0.12, x1: 0.8, y1: 0.72 },
};
export const LEVELS = 6;

const defaultNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

// eligible(item, t): a client's extra "may this show now?" rule (say.js: the bell lock, the Deck Cam hold, the story
// gate, a tip's quiet, a memo's settle). onDrop(item, why): 'stale' | 'wait' | 'busy' | 'snapped' | 'cleared'.
export function createCentre({ now = defaultNow, eligible = null, onDrop = null } = {}) {
  let queue = [], visible = null, lastHide = -Infinity, gap = CENTRE.FADE, seq = 0, dropped = 0, lastT = null;

  const drop = (item, why) => { item.state = 'dropped'; dropped++; try { onDrop?.(item, why); } catch { /* a feed can't stop the queue */ } };
  const ok = (i, t) => !eligible || eligible(i, t);
  function hide(t, after = CENTRE.FADE) {
    if (visible) visible.state = 'out';
    visible = null; lastHide = t; gap = after;
  }
  const free = t => !visible && t >= lastHide + gap;
  function show(item, t) {
    item.state = 'up'; item.shownAt = t;
    item.until = item.hold || item.idle ? Infinity : t + item.secs;
    visible = item;
    const k = queue.indexOf(item); if (k >= 0) queue.splice(k, 1);
  }
  // The visible item gives way: back to the front of the queue with what it had left (resume), or gone.
  function snap(t, after = CENTRE.SNAP) {
    const v = visible; if (!v) return;
    v.preempted = true;
    if (v.force) return;
    if (v.resume || v.hold || v.idle) {
      const left = v.until === Infinity ? v.secs : Math.max(CENTRE.MIN_SECS, v.until - t);
      queue.unshift({ ...v, secs: left, at: t, waited: 0, seq: -1 - seq++, preempted: false, resumed: v.resume ? true : v.resumed, v: 0, state: 'queued' });
    } else drop(v, 'snapped');
    hide(t, after);
  }
  const better = (a, b) => !b || a.pri < b.pri || (a.pri === b.pri && a.seq < b.seq);
  function best(t, below = Infinity) {
    let b = null;
    for (const i of queue) if (i.pri < below && !i.idle && ok(i, t) && better(i, b)) b = i;
    if (!b && below === Infinity && !queue.some(i => !i.idle)) for (const i of queue) if (i.idle && ok(i, t) && better(i, b)) b = i;
    return b;
  }
  const busyAt = p => (!!visible && !visible.idle && visible.pri <= p) || queue.some(i => !i.idle && i.pri <= p);

  function request(o = {}) {
    const t = now();
    const pri = Math.max(0, Math.min(LEVELS - 1, o.pri ?? PRI.TOAST));
    const minSecs = o.minSecs ?? CENTRE.MIN_SECS;
    const secs = Math.max(minSecs, o.secs ?? minSecs);
    const id = o.id ?? null;
    if (id != null) {   // the same id updates in place: the visible one keeps its slot, a queued one keeps its place
      if (visible && visible.id === id) {
        Object.assign(visible, { text: o.text ?? visible.text, data: o.data ?? visible.data, v: visible.v + 1 });
        if (visible.until !== Infinity) visible.until = t + secs;
        return visible;
      }
      const q = queue.find(i => i.id === id);
      if (q) { Object.assign(q, { text: o.text ?? q.text, secs, data: o.data ?? q.data, at: t }); return q; }
    }
    const item = { id, pri, kind: o.kind ?? null, text: String(o.text ?? ''), secs, data: o.data ?? null, at: t, seq: seq++, v: 0, until: 0,
      maxWait: o.maxWait ?? CENTRE.MAX_WAIT[pri] ?? Infinity, ttl: o.ttl ?? Infinity, waited: 0,
      hold: !!o.hold, idle: !!o.idle, resume: !!o.resume, force: !!o.force, state: 'queued' };
    if (o.force) {   // the bell's stamp: shows at once over anything
      if (visible) hide(t, 0);
      show(item, t);
      return item;
    }
    // A tip never queues: it shows now (nothing up or waiting, the fade done) or not at all.
    if (item.maxWait <= 0 && (!free(t) || busyAt(LEVELS) || !ok(item, t))) { drop(item, 'busy'); return item; }
    queue.push(item);
    if (o.now && free(t) && best(t) === item) show(item, t);   // granted on the spot (the story card's want())
    return item;
  }

  // Advance: hide what's done, drop what's stale or waited too long, snap for a higher priority, show the next.
  function update() {
    const t = now(), from = lastT ?? t;
    lastT = t;
    if (visible && t >= visible.until) hide(t);
    for (const i of queue.slice()) if (t - i.at > i.ttl) { queue.splice(queue.indexOf(i), 1); drop(i, 'stale'); }
    if (visible && visible.idle && queue.some(i => !i.idle && ok(i, t))) snap(t, CENTRE.SNAP);   // a standing line steps aside
    else if (visible && !visible.force) { const b = best(t, visible.pri); if (b) snap(t); }
    if (free(t)) { const b = best(t); if (b) show(b, t); }
    // What could have shown but waited (eligible, still queued) counts its wait; past maxWait it leaves.
    for (const i of queue.slice()) {
      if (i.maxWait === Infinity || i.idle || !ok(i, t)) continue;
      i.waited += Math.max(0, t - Math.max(from, i.at));
      if (i.waited >= i.maxWait - 1e-9 && (i.maxWait > 0 || t > i.at)) { queue.splice(queue.indexOf(i), 1); drop(i, 'wait'); }
    }
    return visible;
  }

  function release(id) {
    const t = now();
    if (visible && visible.id === id) { hide(t); return true; }
    const k = queue.findIndex(i => i.id === id);
    if (k >= 0) { queue[k].state = 'out'; queue.splice(k, 1); return true; }
    return false;
  }

  return {
    request, update, release,
    forget: release,
    snap: (after = CENTRE.SNAP) => snap(now(), after),
    hide: (after = CENTRE.FADE) => hide(now(), after),
    // the one item on screen (null between items)
    up: () => visible,
    get visible() { return visible; },
    get queued() { return queue.slice(); },
    get dropped() { return dropped; },
    // the outgoing item's fade is still running (the next one waits for it)
    get fading() { return !visible && now() < lastHide + gap; },
    get lastHide() { return lastHide; },
    set lastHide(v) { lastHide = v; gap = CENTRE.FADE; },
    // anything at this priority or higher (a lower number) up or queued; idle lines (the checklist) don't count
    busy: (pri = LEVELS - 1) => busyAt(pri),
    // nothing up, nothing waiting, no fade running: a never-queue item (a tip) would show now
    get quiet() { const t = now(); return free(t) && !busyAt(LEVELS); },
    // remove queued items matching pred (counted as dropped)
    drop(pred, why = 'cleared') { const keep = []; for (const i of queue) (pred(i) ? drop(i, why) : keep.push(i)); queue = keep; },
    // a held item (the story card) made way for the bell's stamp and so on
    clear() { for (const i of queue) drop(i, 'cleared'); queue = []; if (visible) hide(now()); },
  };
}

// The ?debug overlap counter's pure half: given the centre zone's samples ([{ id, text, opacity }]), is this an
// overlap frame (two or more up over CENTRE.OPACITY)? Returns the up elements, or null.
// Council round 14 #0d: does a screen box (viewport fractions { x0, y0, x1, y1 }) meet the centre zone?
export const inCentreBox = (b, z = CENTRE.BOX) => !!b && b.x1 > z.x0 && b.x0 < z.x1 && b.y1 > z.y0 && b.y0 < z.y1;
export function overlapOf(samples, cut = CENTRE.OPACITY) {
  let n = 0;
  for (const s of samples) if (s.opacity > cut) n++;
  return n >= 2 ? samples.filter(s => s.opacity > cut) : null;
}
