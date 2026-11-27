// Council round 13 #3 (builder 1): a watch-only policy (POLICY=moweobs) for any bot: it logs MOW-E's fights (the Club
// fight, the encore, the Promotion Day crash), the mid:3 story beat, the promotions, and the fountain's share of the
// shift. It moves nobody. Summary: "MOW-E 2.0 met: yes (crash, day 16, loss) · story:mid:3 seen: yes".
export default function make(ctx) {
  const { crew } = ctx;
  const fights = [], beats = new Set(), promos = [];
  let cur = null;
  return {
    step() {
      // State, not events (a bot may clear crew.events before the policies run): today's boss, once per day.
      const m = crew.mower;
      if (m?.kind === 'boss' && !(cur && cur.day === crew.day)) { cur = { day: crew.day, venue: crew.venue, vd: crew.venueDay, encore: !!m.encore, crash: !!m.crash, at: Math.round(crew.shiftT) }; fights.push(cur); }
      if (cur && cur.day === crew.day && m?.kind === 'boss' && (m.phase === 'tamed' || m.phase === 'fled')) cur.result = m.phase === 'tamed' ? 'win' : 'loss';
      if (crew.phase === 'shift' && crew.promoDay === crew.day && !promos.some(p => p.day === crew.day)) promos.push({ day: crew.day, venue: crew.venue });
      for (const e of crew.events) {
        // (the warn is read from state above)
        if (cur && e.t === 'mower' && e.boss && (e.phase === 'tamed' || e.phase === 'fled')) cur.result = e.phase === 'tamed' ? 'win' : 'loss';
        if (e.t === 'story' || e.t === 'storyBeat') beats.add(e.id ?? e.beat);
        if (e.t === 'promoday') promos.push({ day: crew.day, venue: crew.venue, pass: e.pass, mowe: !!cur && cur.day === crew.day });
      }
      return null;
    },
    shiftEnd() { return {}; },
    summary() {
      const two = fights.filter(f => f.encore);
      const seen = [...crew.story ?? crew.seen ?? []];
      return [`fights ${JSON.stringify(fights)}`, `promotion days ${JSON.stringify(promos)}`,
        `MOW-E 2.0 met: ${two.length ? 'yes' : 'no'}${two.length ? ` (${two.map(f => `${f.crash ? 'crash' : 'encore'} d${f.day} vd${f.vd} ${f.result ?? '?'}`).join(', ')})` : ''} · story:mid:3 seen: ${seen.includes('mid:3') || beats.has('mid:3') ? 'yes' : 'no'}`];
    },
  };
}
