// Copied from the expert review's ladder scripts (round 11) for scripts/make-presets.mjs; see snap.mjs.
// Expert review: a state-based activity classifier for any bot driving the real Crew.
// Each tick it looks at every Rat's observable state (position, pocket, wand, cart, dive, Lift) and files the tick
// under one activity. It also tracks field supply (resting pickable balls) so "starved" time can be measured.
const REPO = new URL('../../', import.meta.url).href;
const S = await import(REPO + 'web/js/sim.js');
const L = await import(REPO + 'web/js/layout.js');

const near = (p, q, r) => Math.hypot(p.x - q.x, p.z - q.z) < r;
export const ACTS = ['seek', 'pick', 'carry', 'bank', 'fill', 'hose', 'crank', 'cook', 'dive', 'drive', 'shoot', 'gary', 'space', 'knocked', 'idle'];

export const IDL = {};
export function makeClassifier(crew) {
  const prev = new Map();
  const tot = {}; const byVenue = {};   // venue -> act -> secs
  const supply = { secs: 0, starved: 0, zero: 0 };   // working seconds; seconds with < N resting balls; with 0
  const phases = {};   // venue -> { shiftSecs, closingSecs, preWorkSecs }
  function add(v, a, dt) { tot[a] = (tot[a] ?? 0) + dt; (byVenue[v] ??= {})[a] = (byVenue[v][a] ?? 0) + dt; }
  function step(rats, dt) {
    if (crew.phase !== 'shift') return;
    const v = crew.endless ? 6 : crew.venue;
    const ph = (phases[v] ??= { secs: 0, closing: 0, notWorking: 0 });
    ph.secs += dt;
    if (crew.closing?.()) ph.closing += dt;
    if (!crew.working()) ph.notWorking += dt;
    // supply
    let rest = 0;
    for (const b of crew.balls.values()) if (b.rest && !b.sunk && !b.drifting && !b.creek && b.kind !== 'one' && !(b.y > 0.4)) rest++;
    supply.secs += dt; if (rest < rats.length) supply.starved += dt; if (rest === 0) supply.zero += dt;
    const ret = crew.perks.returns ?? 0;
    for (const p of rats) {
      const q = prev.get(p.id) ?? { x: p.x, z: p.z, pocket: p.pocket ?? 0, dRet: 0 };
      const moved = Math.hypot(p.x - q.x, p.z - q.z) > 0.02;
      const r = L.nearestReturn(p.x, p.z, ret);
      const dRet = Math.hypot(p.x - r.x, p.z - r.z);
      let a;
      const orbit = crew.mods?.state?.('orbit');
      if (p.down > 0) a = 'knocked';
      else if (orbit?.riders?.has?.(p.id)) a = 'space';
      else if (p.diving || p.creekDiving) a = 'dive';
      else if (crew.cartOf?.(p) || [...(crew.carts ?? [])].some(c => c.driver === p.id)) a = 'drive';
      else if (p.wand) a = 'hose';
      else if (crew.basket?.fill && (p.id in crew.basket.fill)) a = 'fill';
      else if (near(p, S.FRIES.SHED, 3.2) && crew.perks.shed > 0) a = 'cook';
      else if (crew.perks.washer && (near(p, S.WASHER_HANDLES.L, 1.3) || near(p, S.WASHER_HANDLES.R, 1.3))) a = 'crank';
      else if (S.BAYS.some(b => near(p, b, 1.2))) a = 'shoot';
      else if (crew.gary && crew.gary.phase === 'drive' && !moved && near(p, S.SIM.STAND, S.GARY.HUDDLE_R)) a = 'gary';
      else if ((p.pocket ?? 0) < q.pocket && !moved) a = 'bank';
      else if ((p.pocket ?? 0) > q.pocket) a = 'pick';
      else if (moved && (p.pocket ?? 0) > 0 && dRet < q.dRet - 0.005) a = 'carry';
      else if (moved) a = 'seek';
      else a = 'idle';
      add(v, a, dt);
      if (a === 'idle' && process.env.IDLEDBG) { const k = `v${v} ${Math.round(p.x/5)*5},${Math.round(p.z/5)*5} pk${p.pocket} job${p.job ?? ''} i${rats.indexOf(p)}`; IDL[k] = (IDL[k] ?? 0) + dt; }
      prev.set(p.id, { x: p.x, z: p.z, pocket: p.pocket ?? 0, dRet });
    }
  }
  function report() {
    const fmt = o => { const s = Object.values(o).reduce((x, y) => x + y, 0); return ACTS.filter(a => o[a]).map(a => `${a} ${(100 * o[a] / s).toFixed(1)}%`).join(' · '); };
    const lines = ['ACT all: ' + fmt(tot)];
    for (const [v, o] of Object.entries(byVenue)) lines.push(`ACT v${v}: ` + fmt(o));
    lines.push(`SUPPLY: working-tick secs ${supply.secs.toFixed(0)}, starved (< N resting balls) ${(100 * supply.starved / supply.secs).toFixed(1)}%, empty field ${(100 * supply.zero / supply.secs).toFixed(1)}%`);
    lines.push('PHASES: ' + JSON.stringify(Object.fromEntries(Object.entries(phases).map(([v, p]) => [v, { min: +(p.secs / 60).toFixed(1), closingPct: +(100 * p.closing / p.secs).toFixed(1), notWorkingPct: +(100 * p.notWorking / p.secs).toFixed(1) }]))));
    lines.push('ACTJSON ' + JSON.stringify({ tot, byVenue }));
    return lines.join('\n');
  }
  return { step, report, tot, byVenue };
}
