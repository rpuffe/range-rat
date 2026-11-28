// Council round 13 #2b/#2c (builder 3): the centre's non-text rules, pure (main.js and round2.js call them; tested in
// test/centre.test.mjs). The washer tip's gate, the boss's mute and its summary line, the name plates' hush fade.
import { bossOwnsScreen } from './mowe.js';

// 2b: "The washer hopper is empty. Bank some balls." (the crank prompt) shows only when ALL of these hold: the hopper
// has been empty ≥ EMPTY_SECS of shift time, balls are on the field, no priority 0–3 centre item is up, and the crew
// has banked < BANKED_MAX balls lifetime. Effectively a Muni-week tip: never at a late venue.
export const WASHER_TIP = { EMPTY_SECS: 30, BANKED_MAX: 1000 };
export const washerTipOk = ({ emptyFor = 0, ballsOut = 0, centreBusy = false, banked = 0 } = {}) =>
  emptyFor >= WASHER_TIP.EMPTY_SECS && ballsOut > 0 && !centreBusy && banked < WASHER_TIP.BANKED_MAX;

// 2c: the boss owns the screen from the warn to the stamp. The checklist's basket nag, the "No buckets. A customer
// left." feed and the helper feed are muted; after the stamp one summary feed line.
export const fightMuted = mower => !!mower && mower.kind === 'boss' && !!bossOwnsScreen(mower);
export function createFightMute() {
  let left = 0, was = false;
  return {
    // a refused customer during the fight: counted, not fed. -> true when muted (the caller skips its feed line)
    refuse(mower) { if (!fightMuted(mower)) return false; left++; return true; },
    // every frame / snapshot: -> the summary line once the fight is over (or null)
    step(mower) {
      const on = fightMuted(mower);
      let out = null;
      if (was && !on && left > 0) out = `${left} customer${left === 1 ? '' : 's'} left during the fight.`;
      if (!on && was) left = 0;
      was = on;
      return out;
    },
    get left() { return left; },
  };
}

// 2b: name plates (Rats, helpers, Gary) fade to 0 within PLATE_R m of the return during the hush, the note card and
// the epilogue (C #7). -> the plate's opacity multiplier.
export const PLATE_R = 15;
export const plateFade = (x, z, stand, hushing) => (hushing && Math.hypot(x - stand.x, z - stand.z) < PLATE_R ? 0 : 1);

// Hotfix (playtest round 10 A H1/H2): the world text at the return gives way to ANY centre item, not just priority 0–1.
// The pay floats (crewmates', the washer's, Gary's checks) hide while anything holds the centre; the HUD cash still
// counts. Gary's bubble hides then too, except in a chat (the bubble is the exchange, and the checklist steps aside).
export const worldTextHidden = ({ centreUp = false, story = false, hushing = false } = {}) => !!(centreUp || story || hushing);
export const garyBubbleShown = ({ chatting = false, ending = false, says = false, centreUp = false } = {}) => !!chatting || (!!(ending || says) && !centreUp);
