// Owner playtest 3 §7.1-7.2: what the pad does in play that isn't a menu. Pure (no DOM, no three),
// so test/pad.test.mjs can push a fake pad snapshot through it.
//   sprint: L3 (the left stick clicked in, like Call of Duty); R3 is free.
//   spray:  RT while you hold the wand (analog, with a gap between on and off so a resting
//           trigger never flickers). Never while driving (RT is the throttle) or in the CCTV (RT zooms).
import { BTN } from './pad.js';

export const RT_SPRAY = Object.freeze({ ON: 0.35, OFF: 0.2 });

// pad: a readPad() snapshot (or null). s: { wand, driving, cctv, rtSpray } (rtSpray: last frame's answer).
export function padBindings(pad, s = {}) {
  if (!pad) return { sprint: false, rtSpray: false };
  const sprint = !!pad.pressed?.[BTN.LS];
  const can = !!s.wand && !s.driving && !s.cctv;
  const rt = pad.rt ?? 0;
  const rtSpray = can && (s.rtSpray ? rt >= RT_SPRAY.OFF : rt > RT_SPRAY.ON);
  return { sprint, rtSpray };
}

// Ⓐ with the wand (pad only): pick up a ball in reach, else spray, so Ⓐ is never wasted.
export const wandA = ({ ballNear, room }) => (ballNear && room ? 'pick' : 'spray');
