// Cash floats, one text at a time (council round 6 #7.1). Pure: no THREE, no DOM. main.js floatPay reads it.
//   - your own banks float over you (or over the cart you drove), as before;
//   - helpers, drones, the night crew, gutters, the tether and a driverless cart roll into ONE float over the stand,
//     at most every ROLL_SECS ("+$1,240 · 31");
//   - other Rats' banks don't float: a feed line in their colour, and only when it's big (>= RAT_FEED_MIN balls).
export const PAYFLOAT = { ROLL_SECS: 2, RAT_FEED_MIN: 20 };

// 'hud' | 'rat' | 'roll' for a { t: 'cash', by, kind } event.
// Council round 14 6.5 (A #5, builder 4): your own banks ('hud') pop by the cash HUD (top left), counting up, and never
// claim the centre: the day-1 checklist blinked on every bank (the own-bank toast was its priority-5 rival).
export function payRoute(e, meId, playerIds) {
  if (e.by != null && e.by === meId) return 'hud';
  if (e.kind == null || e.kind === 'cart') {
    const ids = playerIds instanceof Set ? playerIds : new Set(playerIds ?? []);
    if (ids.has(e.by)) return 'rat';
  }
  return 'roll';
}

// The roll-up: add() machinery cash; the first add starts a ROLL_SECS window, and flush gets { cash, n } at its end.
// schedule(fn, ms) defaults to setTimeout (tests pass their own).
export function createRoller(flush, schedule = (fn, ms) => setTimeout(fn, ms)) {
  let cash = 0, n = 0, armed = false;
  const fire = () => {
    armed = false;
    if (cash > 0 || n > 0) { const out = { cash: Math.round(cash * 100) / 100, n }; cash = 0; n = 0; flush(out); }
  };
  return {
    add(c, k) {
      cash += Math.max(0, Number(c) || 0); n += Math.max(0, k | 0);
      if (!armed) { armed = true; schedule(fire, PAYFLOAT.ROLL_SECS * 1000); }
    },
    get pending() { return { cash, n }; },
  };
}

// Council round 13 #2b (builder 3): the cash pops leave the centre alone.
//   - pops from the same source merge within MERGE_SECS into one float: "+$51.98 ×7" (A #11: 7 deep over the Board);
//   - at most MAX_UP floats on screen (a float lives LIFE s; board.js);
//   - none while hidden() (a priority 0–1 centre item is up, the hush, the epilogue): the cash is on the HUD already.
Object.assign(PAYFLOAT, { MERGE_SECS: 1.5, MAX_UP: 2, LIFE: 1.6 });
// emit({ key, cash, n, k, last }) draws the float (k: pops merged; last: the last pop's event, for its own line).
export function createPayMerge(emit, { now = () => performance.now() / 1000, schedule = (fn, ms) => setTimeout(fn, ms), hidden = () => false } = {}) {
  const open = new Map(), ups = [];
  function fire(key) {
    const m = open.get(key); open.delete(key);
    if (!m || hidden()) return;
    const t = now();
    while (ups.length && t - ups[0] >= PAYFLOAT.LIFE) ups.shift();
    if (ups.length >= PAYFLOAT.MAX_UP) return;
    ups.push(t);
    emit({ key, cash: Math.round(m.cash * 100) / 100, n: m.n, k: m.k, last: m.last });
  }
  return {
    add(key, cash, n, last = null) {
      let m = open.get(key);
      if (!m) { m = { cash: 0, n: 0, k: 0, last: null }; open.set(key, m); schedule(() => fire(key), PAYFLOAT.MERGE_SECS * 1000); }
      m.cash += Math.max(0, Number(cash) || 0); m.n += Math.max(0, n | 0); m.k++; m.last = last;
    },
    get up() { const t = now(); return ups.filter(u => t - u < PAYFLOAT.LIFE).length; },
    get open() { return open.size; },
  };
}
// The merged float's text: one pop keeps its own line (null: the caller's popupLine); more read "+$51.98 ×7".
export const mergedLine = (m, money) => (m.k > 1 ? `+${money(m.cash)} ×${m.k}` : null);

// Council round 14 6.5: the HUD pop's count-up. Adds within HUDPOP.HOLD s of the last one merge into one "+$…" that
// counts from what it showed to the new total over HUDPOP.COUNT s, then fades. Pure state; main.js draws it.
export const HUDPOP = { COUNT: 0.5, HOLD: 1.6, FADE: 0.4 };
export function createHudPop() {
  const st = { from: 0, to: 0, t0: -1e9, last: -1e9 };
  return {
    add(cash, now) {
      const fresh = now - st.last > HUDPOP.HOLD + HUDPOP.FADE;
      st.from = fresh ? 0 : this.value(now); st.to = (fresh ? 0 : st.to) + Math.max(0, Number(cash) || 0); st.t0 = now; st.last = now;
    },
    // the amount shown at `now` (counting up), and its opacity (1 while held, fading after)
    value(now) { const k = Math.min(1, Math.max(0, (now - st.t0) / HUDPOP.COUNT)); return st.from + (st.to - st.from) * k; },
    opacity(now) { const a = now - st.last; return a <= HUDPOP.HOLD ? 1 : Math.max(0, 1 - (a - HUDPOP.HOLD) / HUDPOP.FADE); },
  };
}
