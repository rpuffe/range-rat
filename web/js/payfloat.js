// Cash floats, one text at a time (council round 6 #7.1). Pure: no THREE, no DOM. main.js floatPay reads it.
//   - your own banks float over you (or over the cart you drove), as before;
//   - helpers, drones, the night crew, gutters, the tether and a driverless cart roll into ONE float over the stand,
//     at most every ROLL_SECS ("+$1,240 · 31");
//   - other Rats' banks don't float: a feed line in their colour, and only when it's big (>= RAT_FEED_MIN balls).
export const PAYFLOAT = { ROLL_SECS: 2, RAT_FEED_MIN: 20 };

// 'mine' | 'rat' | 'roll' for a { t: 'cash', by, kind } event.
export function payRoute(e, meId, playerIds) {
  if (e.by != null && e.by === meId) return 'mine';
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
