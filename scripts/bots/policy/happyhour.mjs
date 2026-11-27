// Council round 14 #2 (builder 2): Happy Hour, as a bot policy (POLICY=happyhour). The loungers' balls get the nearest
// free Rat (policy/goldrush.mjs's chaser); the Members' Bell (BUY=1 bought it) is rung at Tiered as soon as it's open
// (council round 14 #3a: a bonus Happy Hour). The deck orders are the bot's own cook.
import { chaser } from './goldrush.mjs';
const REPO = new URL('../../../', import.meta.url).href;
const LM = await import(REPO + 'web/js/landmarks.js');
const H = await import(REPO + 'web/js/happyhour.js');

export default function make(ctx) {
  const { crew, rats } = ctx;
  const T = { shifts: 0, out: 0, got: 0, pours: 0, cash: 0, bell: 0, bellOwned: 0, eased: 0, share: [] };
  const c = chaser(ctx, () => crew.mods.state('happyhour'), () => crew.venue === 2 && !crew.endless);
  const step1 = (p, x, z, dt) => {
    const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz), sp = (crew.perks?.walk ?? 4.2) * dt;
    if (d > 1e-6) { const k = Math.min(1, sp / d); p.x += dx * k; p.z += dz * k; p.yaw = Math.atan2(-dx, -dz); }
    p.movedAt = ctx.now() * 1000;
    return d < 1;
  };
  let ringer = null;
  return {
    shiftStart() {
      c.reset(); ringer = null;
      if (crew.venue === 2 && !crew.endless) { T.shifts++; if (LM.hasLandmark(crew.up, LM.LANDMARK.BELL)) T.bellOwned++; }
    },
    step(dt) {
      if (crew.venue !== 2 || crew.endless) return null;
      const st = crew.mods.state('happyhour'), moved = [];
      const open = LM.hasLandmark(crew.up, LM.LANDMARK.BELL) && LM.bellOpen({ left: crew.shiftSecs - crew.shiftT, rung: st.bell, venue: 2,
        live: !H.bonusClear({ t: crew.shiftT, at: st.at, done: st.done, live: !!st.live }) });
      if (open && process.env.HH_BELL !== '0' && !(crew.gary && crew.gary.phase !== 'done')) {
        ringer ??= rats.find(r => !r.diving && !crew.driving?.(r) && !(st.held[r.id] > 0)) ?? null;
        if (ringer) {
          moved.push(ringer);
          if (step1(ringer, LM.BELL.POST.x, LM.BELL.POST.z, dt) || LM.atBell(ringer)) { crew.mods.first('input', ringer, { t: 'bell' }); if (st.bell) { T.bell++; ringer = null; } }
        }
      } else ringer = null;
      return [...moved, ...(c.step(dt, moved) ?? [])];
    },
    shiftEnd(report) {
      const st = crew.mods.state('happyhour');
      if (!st || crew.venue !== 2 || !st.k) return {};
      const pours = crew.stats.happyPours ?? 0, cash = st.cash + (crew.stats.happyTab ?? 0), inc = report?.cash ?? crew.stats.cash;
      T.out += st.n; T.got += st.banked; T.pours += pours; T.cash += cash; T.eased += crew.stats.bowlsEased ?? 0; T.share.push(+(cash / Math.max(1, inc)).toFixed(3));
      return { happy: { n: st.n, got: st.banked, pours, cash: Math.round(cash), share: +(cash / Math.max(1, inc)).toFixed(3), bell: st.bell ? 1 : 0, eased: crew.stats.bowlsEased ?? 0 } };
    },
    summary: () => [`HAPPYHOUR shifts ${T.shifts} greens ${T.got}/${T.out} pours ${T.pours} cash $${Math.round(T.cash).toLocaleString()} bell ${T.bell}/${T.bellOwned} owned shifts, bowls eased ${T.eased} share ${T.share.map(v => (v * 100).toFixed(1) + '%').join(' ')}`],
  };
}
