// Day-2 suggestions (council round 6 #10): on the Muni's day 2, after the memo, each online Rat gets ONE different
// suggestion, a single line with the checklist's yellow arrow over the place. Dealt round the crew from a pool that
// depends on what the crew owns; it goes once you've done it, or after 45 s. No roles: nothing rewards it.
// Pure (no THREE, no DOM): server/venues/nudge.mjs deals and clears it, main.js shows it in the checklist's slot.
import { MAP } from './map.js';
import { SIM, WASHER_HANDLES, WASH, MATS } from './sim.js';

export const NUDGE = {
  SECS: 45,          // the line goes after 45 s of working time...
  WAIT: 10,          // ...counted from 10 s into the shift, once the memo and the PA card have had their turn
  DAY: 2, VENUE: 0,
  FAR_Z: -60,        // "the far field": past the red flag, toward Yellow
};
export const NUDGE_TEXT = {
  hose: 'Try hosing the mats.',
  far: 'Try picking the far field.',
  stand: 'Try banking at the stand.',
  washer: 'Try the ball washer crank.',
  shop: 'Try the shop: get a washer.',
};

// The pool, in dealing order: the washer line depends on whether the crew owns one.
export const nudgePool = up => ['hose', 'far', 'stand', (up?.washer ?? 0) > 0 ? 'washer' : 'shop'];
// The i-th Rat dealt today (0-based) gets this one: 4 Rats get 4 different, a 5th repeats from the top.
export const dealNudge = (i, up) => { const pool = nudgePool(up); return pool[((i % pool.length) + pool.length) % pool.length]; };

// Is today a nudge day?
export const nudgeDay = crew => crew.venue === NUDGE.VENUE && crew.day === NUDGE.DAY && !crew.endless;

// Has this Rat done it once since it was dealt? base: what was true at the deal ({ banked, washAt, crankAt }).
export function nudgeDone(id, p, base, up) {
  switch (id) {
    case 'hose': return (p.washAt ?? 0) > (base.washAt ?? 0);                 // sprayed something with the wand
    case 'far': return (p.z ?? 0) < NUDGE.FAR_Z && (p.pocket ?? 0) > 0;      // out in the far field with a ball
    case 'stand': return (p.shift?.banked ?? 0) > (base.banked ?? 0);
    case 'washer': return (p.crankAt ?? 0) > (base.crankAt ?? 0);
    case 'shop': return (up?.washer ?? 0) > 0;                               // somebody bought the washer
    default: return true;
  }
}

// Playtest round 2 #7: does this Rat already do it (so dealing it would only nag)? Ever sprayed, or holding the wand;
// banked today; out in the far field with a ball; ever cranked; the crew owns the washer.
export const nudgeSatisfied = (id, p, up) => (id === 'hose' && !!p?.wand) || nudgeDone(id, p ?? {}, { banked: 0, washAt: 0, crankAt: 0 }, up);

// The next suggestion for this Rat from the i-th deal on, skipping any it already satisfies: { id, used } (used: deals
// consumed, so the crew still gets different lines), or { id: null } when it satisfies all of them.
export function dealFor(i, p, up) {
  const n = nudgePool(up).length;
  for (let k = 0; k < n; k++) { const id = dealNudge(i + k, up); if (!nudgeSatisfied(id, p, up)) return { id, used: k + 1 }; }
  return { id: null, used: 1 };
}

// Where the yellow arrow goes (client). wand: does this Rat hold the wand; at: where they stand (the nearest mat).
// null = no place (the shop is a menu).
export function nudgeTarget(id, wand = false, at = { x: 0, z: 0 }) {
  if (id === 'hose') return wand ? { x: MATS.reduce((b, m) => Math.abs(m.x - at.x) < Math.abs(b.x - at.x) ? m : b).x, z: 0, y: 2.2, s: 1 } : { x: WASH.STATION.x, z: WASH.STATION.z, y: 2.2, s: 1 };
  if (id === 'far') { const f = MAP.FLAGS.find(g => g.id === 'yellow'); return { x: f.x, z: f.z, y: 3, s: 1 }; }
  if (id === 'stand') return { x: SIM.STAND.x, z: SIM.STAND.z, y: 2.6, s: 1 };
  if (id === 'washer') return { x: (WASHER_HANDLES.L.x + WASHER_HANDLES.R.x) / 2, z: WASHER_HANDLES.L.z, y: 2.4, s: 1 };
  return null;
}
