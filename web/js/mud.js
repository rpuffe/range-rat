// Mat mud (owner notes: "better animations for cleaning mats"): the pure maths behind the mud overlay
// props.js paints on the customer mats. No three, no DOM; unit-tested (test/mud.test.mjs).
//
// A mat's mud is one number from the server (fixtures['matN'], 0 clean .. 1 filthy). The look is a field
// generated once: `density` says where mud can be (splotches, footprints, smears) and `noise` says in what
// order it washes off. A texel stays muddy while the mat's mud is above its threshold, so as the number
// falls the splotches shrink and break up instead of the whole mat fading. Where my own spray lands, a
// per-mat `mem` (clean memory) raises the threshold along the jet, so those streaks wash off first.
import { rng } from './detail.js';

export const MUD = {
  TEX: 128,          // the shared density/noise field (one canvas, made once)
  MEM: 32,           // the per-mat clean memory (a tiny data texture, uploaded only while I spray that mat)
  BASE: 0.05,        // thresholds: c = BASE + NOISE * noise + MEMK * mem
  NOISE: 0.55,
  MEMK: 0.4,
  EDGE: 0.05,        // the soft edge either side of the threshold
  CLEAN: 0.05,       // the server's "done" line: at or under it the mat is spotless (and the memory resets)
  SIZE: 1.6,         // m, a mat's side
  // Playthrough 4 B10: a filthy mat reads filthy. Above FILL_FROM the mud spreads between the splotches (up to FILL
  // of the bare gap at 1), so 0.8+ covers most of the mat; it still washes in patches (the same thresholds).
  FILL: 0.8,
  FILL_FROM: 0.55,
};

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// The threshold a texel washes clean at: noise in 0..1, mem (sprayed here) in 0..1.
export const cleanThreshold = (noise, mem = 0) => Math.min(0.98, MUD.BASE + MUD.NOISE * noise + MUD.MEMK * mem);
// How much mud shows at a texel (0..1) for the mat's mud value. The shader in props.js mirrors this line.
export const mudAlpha = (density, noise, mem, mud) => {
  const c = cleanThreshold(noise, mem);
  return mudSpread(density, mud) * smoothstep(c - MUD.EDGE, c + MUD.EDGE, mud);
};
// The density a filthy mat shows (playthrough 4 B10): the bare gaps fill as the mud climbs past FILL_FROM.
export const mudSpread = (density, mud) => density + (1 - density) * MUD.FILL * smoothstep(MUD.FILL_FROM, 1, mud);

// Smooth value noise on a size x size torus: `oct` octaves, 0..1.
function valueNoise(size, r, oct = 3) {
  const out = new Float32Array(size * size);
  let amp = 1, total = 0;
  for (let o = 0; o < oct; o++) {
    const cells = 4 << o, grid = Array.from({ length: cells * cells }, r);
    const at = (x, y) => grid[((y + cells) % cells) * cells + ((x + cells) % cells)];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells, fy = (y / size) * cells, ix = Math.floor(fx), iy = Math.floor(fy);
      const tx = smoothstep(0, 1, fx - ix), ty = smoothstep(0, 1, fy - iy);
      const a = at(ix, iy) + (at(ix + 1, iy) - at(ix, iy)) * tx, b = at(ix, iy + 1) + (at(ix + 1, iy + 1) - at(ix, iy + 1)) * tx;
      out[y * size + x] += (a + (b - a) * ty) * amp;
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  // Stretch to the full 0..1 range so the thresholds spread evenly.
  let lo = Infinity, hi = -Infinity;
  for (const v of out) { if (v < lo) lo = v; if (v > hi) hi = v; }
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - lo) / Math.max(1e-6, hi - lo);
  return out;
}

// An ellipse stamp (cx, cy, rx, ry in texels, angle a) into a density field, soft edged, max-combined.
function stamp(f, size, cx, cy, rx, ry, a, k = 1) {
  const c = Math.cos(a), s = Math.sin(a), R = Math.ceil(Math.max(rx, ry)) + 1;
  for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(size - 1, Math.ceil(cy + R)); y++) {
    for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(size - 1, Math.ceil(cx + R)); x++) {
      const dx = x - cx, dy = y - cy, u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
      const d = u * u + v * v;
      if (d < 1) { const i = y * size + x; f[i] = Math.max(f[i], k * (1 - smoothstep(0.55, 1, d))); }
    }
  }
}

// The field: density (where mud can be) and noise (the order it washes off), both size x size, 0..1.
export function mudField(size = MUD.TEX, seed = 7) {
  const r = rng(seed);
  const density = new Float32Array(size * size), noise = valueNoise(size, r, 3);
  const S = size / 128;   // stamps are authored for 128
  // Splotches: big soft blobs, clustered toward the hitting end (the mat's front half, low v).
  for (let i = 0; i < 9; i++) stamp(density, size, r() * size, size * (0.15 + r() * 0.75), (10 + r() * 16) * S, (7 + r() * 12) * S, r() * Math.PI, 0.75 + r() * 0.25);
  // Footprints: two walking lines of shoe prints (an oval and a heel), alternating left/right.
  for (let w = 0; w < 2; w++) {
    let x = size * (0.25 + r() * 0.5), y = size * (0.92 - w * 0.1);
    const a = -Math.PI / 2 + (r() - 0.5) * 0.7;
    for (let s = 0; s < 6; s++) {
      const side = s % 2 ? 1 : -1, ox = Math.cos(a + Math.PI / 2) * 5 * S * side, oy = Math.sin(a + Math.PI / 2) * 5 * S * side;
      stamp(density, size, x + ox, y + oy, 4.5 * S, 8 * S, a + Math.PI / 2, 0.9);
      stamp(density, size, x + ox + Math.cos(a) * 10 * S, y + oy + Math.sin(a) * 10 * S, 3.5 * S, 3.5 * S, 0, 0.9);
      x += Math.cos(a) * 19 * S; y += Math.sin(a) * 19 * S;
    }
  }
  // Smears: long thin drags where a club or a shoe slid.
  for (let i = 0; i < 6; i++) stamp(density, size, r() * size, r() * size, (14 + r() * 18) * S, (1.5 + r() * 2.5) * S, r() * Math.PI, 0.8);
  // Grit everywhere, light, so the mat reads dusty between the splotches.
  for (let i = 0; i < density.length; i++) density[i] = Math.max(density[i], 0.22 * noise[(i * 7 + 13) % density.length]);
  return { size, density, noise };
}

// Where my spray lands on mat-local (u, v) (0..1 across the mat), moving along (du, dv) (any length):
// add an elongated streak to the clean memory. Returns true if anything changed. `reach` scales the streak (a
// surface whose memory spans more than a mat's 1.6 m passes < 1, so the jet stays the same size in metres).
export function paintClean(mem, size, u, v, du, dv, amount = 0.25, reach = 1) {
  if (!(u >= -0.1 && u <= 1.1 && v >= -0.1 && v <= 1.1)) return false;
  const len = Math.hypot(du, dv) || 1, ax = du / len, ay = dv / len;
  const cx = u * size, cy = v * size, along = size * 0.22 * reach, across = size * 0.07 * reach, R = Math.ceil(along) + 1;
  let changed = false;
  for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(size - 1, Math.ceil(cy + R)); y++) {
    for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(size - 1, Math.ceil(cx + R)); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = (dx * ax + dy * ay) / along, c = (-dx * ay + dy * ax) / across;
      const d = a * a + c * c;
      if (d >= 1) continue;
      const i = y * size + x, nv = Math.min(1, mem[i] + amount * (1 - d));
      if (nv !== mem[i]) { mem[i] = nv; changed = true; }
    }
  }
  return changed;
}

// A world point on a mat's top -> mat-local (u, v), or null if it isn't on that mat.
export function matUV(px, pz, mx, mz = 0, size = MUD.SIZE) {
  const u = (px - mx) / size + 0.5, v = (pz - mz) / size + 0.5;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { u, v } : null;
}

// Which mat (index into mats) a world point lands on, or -1.
export function matAt(px, pz, mats, mz = 0, size = MUD.SIZE) {
  for (let i = 0; i < mats.length; i++) if (matUV(px, pz, mats[i].x, mz, size)) return i;
  return -1;
}

// Did this mat just come clean? (the sparkle): it was over the line and now it isn't.
export const cameClean = (before, now) => before > MUD.CLEAN && now <= MUD.CLEAN;

// ---- council round 10 §B: dirt you can see on the sign and the ball return ----------------------------------
// The mats' overlay on any w x h m quad (the sign's faces; the return's front, hopper lip and pipe). mudSurface
// gives the quad's local (u, v) (0..1, v up) its spot in the shared field at the mats' texel size, so a sign's
// splotches are mat-sized, and `seed` shifts each surface to its own patch of the field (the two sign faces differ).
// A standing surface is muddier low down (the splash off the ground): its thresholds drop by SURF.LOW * (1 - v), so
// the bottom edge washes last. Never below CLEAN + EDGE, so at the server's CLEAN line every surface is spotless.
export const SURF = { LOW: 0.18 };
const frac = v => v - Math.floor(v);
export function mudSurface(w, h, seed = 0) {
  const su = w / MUD.SIZE, sv = h / MUD.SIZE, ou = frac(seed * 0.618034), ov = frac(seed * 0.414214);
  return { w, h, su, sv, ou, ov, reach: 1 / Math.max(su, sv), uv: (u, v) => [ou + u * su, ov + v * sv] };
}
export const surfaceThreshold = (noise, mem = 0, v = 1) => Math.max(MUD.CLEAN + MUD.EDGE, cleanThreshold(noise, mem) - SURF.LOW * (1 - clamp01(v)));
// The shader in props.js (surface decals) mirrors this line.
export const surfaceAlpha = (density, noise, mem, mud, v) => {
  const c = surfaceThreshold(noise, mem, v);
  return mudSpread(density, mud) * smoothstep(c - MUD.EDGE, c + MUD.EDGE, mud);
};
// Sample a field ({ size, density, noise }) at field (u, v) (wrapping, nearest texel).
export function fieldAt(F, u, v) {
  const n = F.size, x = ((Math.floor(u * n) % n) + n) % n, y = ((Math.floor(v * n) % n) + n) % n, i = y * n + x;
  return { density: F.density[i], noise: F.noise[i] };
}
