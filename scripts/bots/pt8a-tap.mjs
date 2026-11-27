// Playtester A, round 8: a preload that taps the Crew (reads only, no sim change) and counts "calls": a new thing a
// Rat could go and act on. Usage: node --import ./scripts/bots/pt8a-tap.mjs scripts/bots/muni.mjs 4 7 chat prep
// A call (same type merged within MERGE s):
//   special  a special ball (not 'range') comes to rest on the field          gary     Gary's warn (horn)
//   wait     a customer waits at a mat (empty basket)                          rally    a dealt rally / last-call need
//   basket   the bucket basket drops under 25 %                                fries    the fryer drops under 50 % (Club)
//   dirty    a fixture crosses 0.5 mud (a hose job)                            treasure a new treasure glint (Club)
//   boss     a boss phase (warn, harvest, hunt, plug)                          snag     a ball snags in the creek (Club)
import { Crew } from '../../server/crew.mjs';
import { basketMax } from '../../web/js/basket.js';
const MERGE = +(process.env.MERGE ?? 8);
const seen = new WeakSet(); const V = {};
const key = (c) => c.endless ? 'endless' : 'v' + c.venue;
const orig = Crew.prototype.tick;
Crew.prototype.tick = function (dt) {
  const r = orig.call(this, dt);
  const k = key(this), v = (V[k] ??= { min: 0, days: new Set(), calls: {}, n: 0, perDay: {} });
  const st = (this.__pt8 ??= { last: {}, dirty: {}, basketLow: false, friesLow: false, tre: null });
  const working = this.phase === 'shift';
  const now = this.day * 1000 + (this.shiftT ?? 0);
  const call = (type) => { if (!working) return; if (now - (st.last[type] ?? -1e9) < MERGE) return; st.last[type] = now; v.calls[type] = (v.calls[type] ?? 0) + 1; v.n++; v.perDay[this.day] = (v.perDay[this.day] ?? 0) + 1; };
  if (working) { v.min += dt / 60; v.days.add(this.day); }
  for (const e of this.events ?? []) {
    if (!e || typeof e !== 'object' || seen.has(e)) continue; seen.add(e);
    if (e.t === 'custwait') call('wait');
    else if (e.t === 'rally' || e.t === 'lastcall') call('rally');
    else if (e.t === 'gary' && e.phase === 'warn') call('gary');
    else if (e.t === 'mower' && e.boss && ['warn', 'harvest', 'hunt', 'plug'].includes(e.phase)) call('boss:' + e.phase);
    else if (e.t === 'snag') call('snag');
  }
  if (working) {
    for (const b of this.balls.values()) if (b.rest && b.kind && b.kind !== 'range' && !b.__pt8) { b.__pt8 = 1; call('special'); }
    for (const [id, m] of Object.entries(this.fixtures ?? {})) { const d = m > 0.5; if (d && !st.dirty[id]) call('dirty'); st.dirty[id] = d; }
    if (this.basket?.n != null) { const low = this.basket.n / Math.max(1, basketMax(this.basket)) < 0.25; if (low && !st.basketLow) call('basket'); st.basketLow = low; }
    if (this.venue >= 1 && this.fries != null) { const low = this.fries < 20 * 0.5; if (low && !st.friesLow) call('fries'); st.friesLow = low; }
    const tr = this.pond?.treasure?.id ?? null; if (tr && tr !== st.tre) call('treasure'); st.tre = tr;
  }
  return r;
};
process.on('exit', () => { for (const v of Object.values(V)) { v.days = v.days.size; v.min = +v.min.toFixed(1); v.perMin = +(v.n / Math.max(0.1, v.min)).toFixed(2); } console.log('TAP ' + JSON.stringify(V)); });
