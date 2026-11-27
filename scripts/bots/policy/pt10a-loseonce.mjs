// Playtest round 10, reviewer A (POLICY=pt10a-loseonce, with FIGHT=0): the sofa crew loses the FIRST Club boss on
// purpose (works the field and ignores MOW-E), then wins the rematch: the crew stands still in the fight for 55 s and
// tames it, the way mid.mjs's FIGHT=55 does. Logs each boss day: the outcome, the fight's seconds, and the shift clock.
const REPO = new URL('../../../', import.meta.url).href;
const MW = await import(REPO + 'web/js/mowe.js');
export default function make(ctx) {
  const { crew, rats } = ctx;
  let bossDays = 0, at = null, today = false, log = [];
  return {
    shiftStart() { today = false; at = null; },
    step(dt) {
      const mw = crew.mower;
      if (crew.venue !== 1 || mw?.kind !== 'boss') return null;
      if (!today) { today = true; bossDays++; log.push(`d${crew.day} boss#${bossDays} warn@${Math.round(crew.shiftT)}`); }
      if (bossDays < 2 || !MW.bossLive(mw) || mw.phase === 'warn') return null;
      at ??= crew.shiftT;
      for (const p of rats) { if (crew.cartOf(p)) crew.leaveCart(p); }
      if (crew.shiftT - at >= 55 && mw.phase !== 'plug' && mw.phase !== 'tamed') { mw.phase = 'tamed'; mw.t = 0; crew.moweFightPhase('tamed'); log.push(`d${crew.day} tamed@${Math.round(crew.shiftT)}`); }
      return rats;
    },
    shiftEnd(rep) { if (today) log.push(`d${crew.day} bell: mower=${JSON.stringify(rep?.mowe ?? rep?.mower ?? null)?.slice(0, 80)}`); return {}; },
    summary: () => ['LOSEONCE ' + log.join(' | ')],
  };
}
