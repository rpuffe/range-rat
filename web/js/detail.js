// Range Rat station detail: the pure numbers behind props.js (no three, no DOM), unit-tested.
// How much small-detail work each quality profile buys, and the little bits of maths the
// in-use animations share (particle emission, wetness, sagging hoses, reel spin, gauges).

// What the props layer may spend, from the perf.js profile (tier + Auto steps).
// Low (and Xbox Auto) keeps today's cost: no new particles beyond a token few, no per-frame
// hose, hard shadow edges, Lambert everywhere. Auto steps on High peel the extras off in order.
export function detailFor(profile = {}) {
  const low = !!profile.low, steps = profile.steps | 0;
  const hi = !low && steps < 2;            // High, or High after one Auto step
  return {
    hi,
    standard: !low,                         // MeshStandard (roughness/metalness) for new prop parts; Lambert on Low
    shadowRadius: low ? 1 : 2.5,            // PCF kernel radius (softer shadow edges, same cost)
    mist: low ? 0 : steps >= 1 ? 24 : 48,   // pressure-washer mist sprites
    bubbles: low ? 6 : steps >= 1 ? 12 : 24,// ball-washer soap bubbles
    steam: low ? 4 : 14,                    // snack-shed steam puffs
    clippings: low ? 0 : 24,                // MOW-E grass clippings
    hoseSegs: low ? 0 : 14,                 // the live hose from the washer to the wand (0: none)
    clouds: low ? 6 : 12,                   // billboard cloud clusters
    cloudHz: low ? 4 : 15,                  // how often the cloud billboards re-face the camera
    animHz: low ? 20 : 0,                   // prop animation rate; 0 = every frame
    wetSheen: !low,                         // glossy wet overlay on what the spray hits
    rings: !low,                            // target-green rings
    // Owner notes (mats and spray): the mud overlay itself runs on every tier (one texture lookup in the mat's own
    // material, no new draw calls); the streaks, wet sheen, splashes and a big sparkle are the extras.
    matStreaks: !low,                       // my spray washes streaks off where it lands (a 32x32 memory per mat)
    matWet: !low,                           // the mat darkens and shimmers while wet
    splash: low ? 0 : steps >= 1 ? 10 : 20, // droplets per second bouncing up where the spray lands
    sparkle: low ? 5 : 14,                  // glints when a mat comes clean
    jet: low ? 16 : 48,                     // crewmates' spray droplets (from their nozzle)
    pipeBalls: low ? 8 : 24,                // owner layout: balls rolling down the return's pipe at once (one InstancedMesh)
  };
}

// A fractional emitter: rate per second -> whole particles this frame, carrying the remainder.
export function emit(rate, dt, carry = 0) {
  const t = carry + Math.max(0, rate) * Math.max(0, dt);
  const n = Math.floor(t);
  return { n, carry: t - n };
}

// Wetness 0..1: rises fast while sprayed, dries over about four seconds.
export const WET = { RISE: 2.5, DRY: 0.25 };
export function wetStep(w, hit, dt) {
  const v = hit ? w + WET.RISE * dt : w - WET.DRY * dt;
  return Math.max(0, Math.min(1, v));
}

// Points along a hanging hose from a to b: a parabola sagging by `sag` metres at the middle,
// never below the ground (y >= floor). Returns n+1 points as [x, y, z] arrays.
export function sagPoints(a, b, n, sag = 0.6, floor = 0.03) {
  const pts = [];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const s = sag * Math.min(1, len / 3) + len * 0.12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const y = a[1] + (b[1] - a[1]) * t - s * 4 * t * (1 - t);
    pts.push([a[0] + (b[0] - a[0]) * t, Math.max(floor, y), a[2] + (b[2] - a[2]) * t]);
  }
  return pts;
}

// How far a reel or wheel of radius r turns for a ground distance d (radians).
export const rollAngle = (d, r) => (r > 0 ? d / r : 0);

// The pump gauge needle (radians from the rest stop): idle near zero with a tremble at
// pressure, up to ~3/4 of the dial while spraying. p is the eased pressure 0..1.
export const GAUGE = { REST: -2.2, SWEEP: 3.4 };
export function gaugeAngle(p, t = 0) {
  const k = Math.max(0, Math.min(1, p));
  return GAUGE.REST + GAUGE.SWEEP * 0.75 * k + (k > 0.05 ? Math.sin(t * 37) * 0.04 * k : 0);
}

// Ease a value toward a target at `rate` per second (exponential), frame-rate independent.
export const ease = (v, target, rate, dt) => v + (target - v) * (1 - Math.exp(-rate * dt));

// Throttle: given an accumulator and a rate (Hz, 0 = every frame), say whether to run now.
export function throttle(acc, dt, hz) {
  if (!hz) return { run: true, acc: 0, dt };
  const a = acc + dt;
  return a >= 1 / hz ? { run: true, acc: 0, dt: a } : { run: false, acc: a, dt: 0 };
}

// Deterministic 0..1 noise for canvas textures and scatter (mulberry32).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The light balance pass: multipliers on sky.js's per-moment sun and hemisphere values
// (a touch more sun, a touch less flat fill, so shadows and forms read), warmer late on.
export function lightBalance(L, k = 0) {
  const late = Math.max(0, Math.min(1, (k - 0.35) / 0.65));
  return { sunI: L.sunI * (1.08 + 0.06 * late), hemiI: L.hemi * (0.82 - 0.04 * late), warm: 0.12 + 0.2 * late };
}
