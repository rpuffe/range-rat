// Round 11 (owner): the line shows only the BUILT bays (bays.js). Every bay's mat and number exist from the start (main.js
// builds the whole line once, LINE); this flips their visibility from the snapshot's nMats, drives the Club's dividers
// and wing awning (venues.js parts.setBays), and gives a just-built bay a fresh look (brighter turf, a gold number)
// until the end of its first shift. No per-frame work: it runs per snapshot and only acts when something changed.
import { buildTier } from './bays.js';

const FRESH_TURF = 0x4fae45, TURF = 0x2f6b2a, GOLD = 0xffd34a, WHITE = 0xffffff;

export function createBayLine({ meshes }) {
  let shown = -1, tier = -1;
  let fresh = null;   // { from, to, sawShift }: the bays the latest tier built
  const paint = () => {
    meshes.forEach(({ mat, num }, i) => {
      const f = !!fresh && i >= fresh.from && i < fresh.to;
      mat.material.color.setHex(f ? FRESH_TURF : TURF);
      num.material.color.setHex(f ? GOLD : WHITE);
    });
  };
  return {
    update(s, parts) {
      const n = Math.max(0, Math.min(meshes.length, s?.nMats ?? 10)), t = buildTier(s?.up);
      // A tier bought (here or by a crewmate): the bays it added look fresh through their first shift.
      if (tier >= 0 && t > tier && n > shown && shown >= 0) { fresh = { from: shown, to: n, sawShift: false }; paint(); }
      tier = t;
      if (n !== shown) {
        meshes.forEach(({ mat, num }, i) => { mat.visible = num.visible = i < n; });
        shown = n;
      }
      if (parts?.setBays && parts.bayN !== n) parts.setBays(n);
      if (parts) parts.bayN = n;
      if (fresh) {
        if (s?.phase === 'shift') fresh.sawShift = true;
        else if (fresh.sawShift && s?.phase === 'report') { fresh = null; paint(); }
      }
    },
    get fresh() { return fresh; },
  };
}
