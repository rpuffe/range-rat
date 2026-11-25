// Scuba you can follow from the dock (council round 6 #9): the pure bits behind scuba.js's surface boil, the bag
// rising on its line, and the lead and gold glinting in the torch. No three, no DOM: test/scuba.test.mjs.

export const FOLLOW = {
  BOIL_N: 8,          // bubbles in each diver's surface boil
  BOIL_R: 0.6,        // m, the boil's ring
  BOIL_HZ: 1.3,       // each bubble rises and pops this often
  MAX_DIVERS: 6,
  BAG_SECS: 1.6,      // the net bag climbs the line this long
  GLINT_R: 6,         // m, how far the torch picks out lead and gold
  GLINT_COS: Math.cos(0.5),   // the torch cone (main.js diveLight: angle 0.5 rad)
  GLINT_MAX: 20,
  GLINT_KINDS: new Set(['lead', 'gold']),
};

const frac = v => v - Math.floor(v);
const hash = n => frac(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// One bubble of a diver's surface boil at time t: { x, z, rise 0..1, size, alpha }. Procedural (no pool state), so
// every client draws the same boil for the same diver.
export function boilBubble(dx, dz, k, j, t) {
  const u = frac(t * FOLLOW.BOIL_HZ + k / FOLLOW.BOIL_N + hash(j + 1) * 0.5);
  const a = (k / FOLLOW.BOIL_N) * Math.PI * 2 + j * 0.9 + Math.sin(t * 0.7 + k) * 0.25;
  const r = FOLLOW.BOIL_R * (0.35 + 0.65 * hash(k * 7 + j));
  return {
    x: dx + Math.cos(a) * r, z: dz + Math.sin(a) * r, rise: u,
    size: 0.08 + 0.1 * u,
    alpha: u < 0.8 ? 0.5 + 0.5 * u : Math.max(0, 1 - (u - 0.8) / 0.2) * 1.2,   // swells, then pops
  };
}

// The net bag on its line: from the diver on the bed (`from`, with y) up to the dock (`to`), u = elapsed / BAG_SECS.
// It rises nearly straight up first (the line pulls from above), then runs along the line to the dock. null when done.
export function bagAt(from, to, u) {
  if (!(u >= 0) || u > 1) return null;
  const e = u * u * (3 - 2 * u);                                 // smoothstep: a hand over hand haul
  const up = Math.min(1, e * 1.6);                               // most of the climb happens early
  return {
    x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * up,
    z: from.z + (to.z - from.z) * e,
  };
}

// The sunk lead and gold balls the torch picks out: within `r` of the eye and inside the cone round `dir` (unit),
// nearest first, at most `max`. `balls` is any iterable of { x, y, z, kind, sunk }.
export function pickGlints(balls, eye, dir, { r = FOLLOW.GLINT_R, cos = FOLLOW.GLINT_COS, max = FOLLOW.GLINT_MAX } = {}) {
  const out = [];
  for (const b of balls) {
    if (!(b?.creek || (b?.sunk && FOLLOW.GLINT_KINDS.has(b.kind)))) continue;   // council round 10 #5: every creek snag glints
    const dx = b.x - eye.x, dy = (b.y ?? 0) - eye.y, dz = b.z - eye.z, d = Math.hypot(dx, dy, dz);
    if (d > r || d < 1e-6) continue;
    if ((dx * dir.x + dy * dir.y + dz * dir.z) / d < cos) continue;
    out.push({ b, d });
  }
  out.sort((p, q) => p.d - q.d);
  return out.slice(0, max).map(o => o.b);
}

// The Lost & Found reveal: how far the slot has spun (radians) and how big it pops, t seconds into the 2 s reveal.
export function caseSpin(t, secs = 2) {
  if (!(t >= 0) || t >= secs) return null;
  const u = t / secs, out = 1 - (1 - u) ** 3;
  return { turn: out * Math.PI * 6, pop: 1 + 0.35 * Math.sin(Math.PI * u) };
}
