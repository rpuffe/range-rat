// Council round 13 #4b (builder 2): poach a Site 13 regular, as a bot policy (scripts/bots/policies.mjs: POACH=1).
// In endless, each morning there's a race (a yesterday), poach if the crew can afford it and still keep STATUE_SAVE of
// the statue's price in view (it never blocks the statue for more than a day or two). Logs the poaches and acquisitions.
// Council round 14 #5a (builder 3): it poaches only when it's "worth it": the week's double is still unused (a poached
// win counts double once a rival week). POACH=every keeps the old every-day policy for comparison.
const REPO = new URL('../../../', import.meta.url).href;
const O = await import(REPO + 'web/js/owner.js');

export default function make(ctx, value = '1') {
  const { crew, rats } = ctx;
  const log = [];
  return {
    buy() {
      const pr = O.poachPrice({ endless: crew.endless, records: crew.records, day: crew.phase === 'report' ? crew.day + 1 : crew.day, poachDay: crew.poachDay ?? null });
      if (pr == null || pr > crew.cash) return;
      if (value !== 'every' && !O.poachDouble(crew.records?.rival)) return;
      if (crew.buy(rats[0], 'poach')) log.push(`d${crew.day} $${Math.round(pr / 1e6)}M`);
    },
    shiftEnd() { return { poached: crew.poachDay === crew.day ? 1 : 0, acquired: crew.records?.rival?.acquired ?? 0 }; },
    summary() { const r = crew.records?.rival ?? {}; return [`POACH ${log.length} poaches: ${log.join(' ')} · acquired ${r.acquired ?? 0} · week ${r.week} wins ${r.wins}/${r.days}`]; },
  };
}
