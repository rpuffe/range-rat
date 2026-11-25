// Range Rat textures, the pure half: every surface texture is generated here, pixel by pixel, from seeded tileable
// noise. No THREE, no DOM, so test/textures.test.mjs runs it in node. textures.js turns the pixels into GPU textures
// during the title card (a progress bar, a slice at a time) and hands out the few shared materials that use them.
//
// The textures are DETAIL MULTIPLIERS: near-white, linear (not sRGB), a little warm or cool. The material's own colour
// still carries the hue, so the mud tints, venue colours and instance colours keep working; textures.js multiplies a
// material's colour by 1 / MEAN so the scene keeps its overall brightness.
//
// Budget (Xbox Edge): every size a power of two and ≤ 512, mipmapped on the GPU. See TEX_SPECS and texBytes().

// ---- seeded hashing and tileable value noise -------------------------------------------------------------------
export function hash2(ix, iy, seed) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iy | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const mod = (a, p) => ((a % p) + p) % p;
const fade = t => t * t * (3 - 2 * t);
// Value noise on an integer lattice that wraps every px × py cells, so a texture of whole periods tiles seamlessly.
export function vnoise(x, y, px, py, seed) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = fade(x - x0), fy = fade(y - y0);
  const a = mod(x0, px), b = mod(x0 + 1, px), c = mod(y0, py), d = mod(y0 + 1, py);
  const v00 = hash2(a, c, seed), v10 = hash2(b, c, seed), v01 = hash2(a, d, seed), v11 = hash2(b, d, seed);
  return (v00 + (v10 - v00) * fx) * (1 - fy) + (v01 + (v11 - v01) * fx) * fy;
}
// Fractal sum over u, v in [0, 1): fx × fy cells at the first octave, doubling each octave. Result 0..1.
export function fbm(u, v, fx, fy, oct, seed) {
  let s = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < oct; o++) {
    s += amp * vnoise(u * fx, v * fy, fx, fy, seed + o * 101); norm += amp;
    amp *= 0.5; fx *= 2; fy *= 2;
  }
  return s / norm;
}
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---- the generators: (u, v, out) writes linear rgb 0..1 into out ------------------------------------------------
// Grass: clumps, blades streaked along one axis (mow: along u, the lanes' direction), a speckle, dry flecks.
function grass(seed, along) {
  return (u, v, o) => {
    const patch = fbm(u, v, 4, 4, 3, seed);                                  // broad tonal patches (a metre or so)
    const clump = fbm(u, v, 16, 16, 2, seed + 13);                           // clumps (~30 cm)
    const L = along === 'u' ? 96 : 176, S = 256;                              // blades: mow lanes lie ~3:1, rough ~1.5:1
    const blade = along === 'u' ? vnoise(u * L, v * S, L, S, seed + 7) : vnoise(u * S, v * L, S, L, seed + 7);
    const fine = hash2(Math.floor(u * 512), Math.floor(v * 512), seed + 3);
    // (fbm sits near 0.5, std ~0.1: these gains make each layer read once lit and sRGB-encoded)
    let l = 0.8 + (patch - 0.5) * 0.6 + (clump - 0.5) * 0.5 + (blade - 0.5) * 0.45 + (fine - 0.5) * 0.22;
    const dry = smooth(0.62, 0.8, patch) * 0.6 + (fine > 0.985 ? 0.5 : 0);   // straw-coloured bits in the light patches
    o[0] = l * (1 + 0.07 * dry); o[1] = l; o[2] = l * (1 - 0.12 * dry);
  };
}
// Artificial turf on the hitting mats: a grid of fibre tufts, row seams, a scuffed hitting zone in the middle.
function turf(seed) {
  return (u, v, o) => {
    const N = 64, cx = u * N, cy = v * N, ix = Math.floor(cx), iy = Math.floor(cy);
    const dx = cx - ix - 0.5, dy = cy - iy - 0.5, r = Math.sqrt(dx * dx + dy * dy);
    const tuft = 1 - smooth(0.18, 0.5, r);                                    // a bright tuft centre, darker backing
    const t = hash2(ix, iy, seed);
    const seam = (iy % 16 === 0) ? 0.93 : 1;                                  // the turf's stitched rows
    const wear = smooth(0.3, 0.05, Math.hypot(u - 0.5, (v - 0.55) * 1.4));   // the tee spot, rubbed flat and pale
    const l = (0.66 + 0.34 * tuft * (0.6 + 0.4 * t)) * seam + wear * 0.12 + (fbm(u, v, 4, 4, 2, seed + 9) - 0.5) * 0.3;
    o[0] = l; o[1] = l * 1.02; o[2] = l * 0.98;
  };
}
// Dirt: clods, damp patches, pebbles (bright tops, dark undersides), a few root-dark cracks.
function dirt(seed) {
  return (u, v, o) => {
    const p = fbm(u, v, 4, 4, 4, seed), q = fbm(u, v, 16, 16, 2, seed + 5);
    let l = 0.84 + (p - 0.5) * 0.7 + (q - 0.5) * 0.35;
    const N = 24, cx = u * N, cy = v * N, ix = Math.floor(cx), iy = Math.floor(cy);
    const h = hash2(ix, iy, seed + 11);
    if (h > 0.45) {                                                            // a pebble in this cell
      const px = 0.25 + 0.5 * hash2(ix, iy, seed + 12), py = 0.25 + 0.5 * hash2(ix, iy, seed + 13), pr = 0.12 + 0.18 * hash2(ix, iy, seed + 14);
      const dx = cx - ix - px, dy = cy - iy - py, d = Math.sqrt(dx * dx + dy * dy) / pr;
      if (d < 1) l = 0.78 + 0.3 * (1 - d) * (dy < 0 ? 1 : 0.4) + (h - 0.7) * 0.2;
      else if (d < 1.35 && dy > 0) l *= 0.85;                                  // its little shadow
    }
    const crack = Math.abs(fbm(u, v, 6, 6, 3, seed + 21) - 0.5);
    if (crack < 0.006 && p < 0.48) l *= 0.8;                                   // hairline cracks where it's dry
    const damp = smooth(0.55, 0.75, p);
    o[0] = l * (1.04 - 0.04 * damp); o[1] = l; o[2] = l * (0.93 + 0.03 * damp);
  };
}
// Wood decking: 4 boards a tile (running along u), each its own tone, grain lines, butt joints, nail heads.
function wood(seed) {
  return (u, v, o) => {
    const B = 4, bi = Math.floor(v * B), bv = v * B - bi;                     // board index, position across it
    const tone = hash2(bi, 0, seed), off = hash2(bi, 1, seed);
    const warp = fbm(u, v, 2, 8, 3, seed + 3);
    const ring = 0.5 + 0.5 * Math.sin((bv * 7 + warp * 5 + tone * 3) * Math.PI * 2);
    const streak = vnoise(u * 8, v * 128, 8, 128, seed + 5);
    let l = 0.82 + (tone - 0.5) * 0.14 + (ring - 0.5) * 0.1 + (streak - 0.5) * 0.08;
    if (bv < 0.04 || bv > 0.96) l *= 0.45;                                    // the gap between boards
    const ju = mod(u - off, 1);                                               // one butt joint per board per tile
    if (ju < 0.006 || ju > 0.994) l *= 0.5;
    for (const nu of [0.012, 0.988]) {                                         // two nails each side of the joint
      const du = (mod(ju - nu + 0.5, 1) - 0.5) * 4, dn1 = bv - 0.25, dn2 = bv - 0.75;
      if (du * du + dn1 * dn1 < 0.0012 || du * du + dn2 * dn2 < 0.0012) l = 0.45;
    }
    o[0] = l * 1.05; o[1] = l; o[2] = l * 0.9;
  };
}
// Galvanised / brushed metal: fine streaks along u, spangle cells, scuffs.
function metal(seed) {
  return (u, v, o) => {
    const streak = vnoise(u * 4, v * 256, 4, 256, seed);
    const N = 16, sp = hash2(mod(Math.floor(u * N + fbm(u, v, 4, 4, 2, seed + 4) * 0.8), N), Math.floor(v * N), seed + 2);
    const scuff = fbm(u, v, 3, 3, 4, seed + 8);
    const l = 0.88 + (streak - 0.5) * 0.3 + (sp - 0.5) * 0.12 - smooth(0.6, 0.8, scuff) * 0.2;
    o[0] = l * 0.99; o[1] = l; o[2] = l * 1.02;
  };
}
// Signage weathering (blitted over sign canvases with 'multiply', so text stays crisp): paint grain, edge grime,
// rain streaks down from the top edge, a few rust freckles.
function sign(seed) {
  return (u, v, o) => {
    const e = Math.min(u, 1 - u, v * 0.5, (1 - v) * 0.5);                     // distance to the nearest edge
    const g = fbm(u, v, 8, 4, 3, seed);
    const edge = smooth(0.09, 0, e) * (0.5 + 0.5 * g);
    const rain = smooth(0.25, 0, v) * smooth(0.6, 0.75, vnoise(u * 64, v * 2, 64, 2, seed + 3)) * 0.12;
    const grain = (hash2(Math.floor(u * 256), Math.floor(v * 128), seed + 5) - 0.5) * 0.05;
    const rust = smooth(0.82, 0.9, fbm(u, v, 16, 8, 2, seed + 9)) * 0.35;
    const l = clamp01(1 - edge * 0.32 - rain + grain);
    o[0] = l * (1 - rust * 0.15); o[1] = l * (1 - rust * 0.45); o[2] = l * (1 - rust * 0.7);
  };
}

// ---- the set -----------------------------------------------------------------------------------------------------
// id, size, generator, MEAN (the design-average brightness textures.js compensates for), gpu (false: canvas use only).
export const TEX_SPECS = Object.freeze([
  { id: 'grass', size: 512, mean: 0.78, gpu: true, make: () => grass(1962, 'v') },
  { id: 'mow', size: 512, mean: 0.8, gpu: true, make: () => grass(4417, 'u') },
  { id: 'turf', size: 256, mean: 0.78, gpu: true, make: () => turf(77) },
  { id: 'dirt', size: 256, mean: 0.86, gpu: true, make: () => dirt(305) },
  { id: 'wood', size: 256, mean: 0.77, gpu: true, make: () => wood(1188) },
  { id: 'metal', size: 256, mean: 0.87, gpu: true, make: () => metal(612) },
  { id: 'sign', size: 256, h: 128, mean: 0.93, gpu: false, make: () => sign(29) },
]);
export const SPEC_BY_ID = Object.freeze(Object.fromEntries(TEX_SPECS.map(s => [s.id, s])));
export const isPow2 = n => n > 0 && (n & (n - 1)) === 0;
// GPU bytes for a mipmapped RGBA8 texture: the full chain is 4/3 of the base level.
export const texBytes = s => s.gpu ? Math.round(s.size * (s.h ?? s.size) * 4 * 4 / 3) : 0;
export const totalBytes = (specs = TEX_SPECS) => specs.reduce((a, s) => a + texBytes(s), 0);

// A texture being generated in slices: job.step(rows) fills the next rows of job.data (RGBA8); job.done when full.
export function texJob(spec) {
  const w = spec.size, h = spec.h ?? spec.size, data = new Uint8Array(w * h * 4), f = spec.make(), o = [0, 0, 0];
  const job = { spec, w, h, data, row: 0, done: false, sum: 0,
    step(rows = h) {
      const end = Math.min(h, job.row + rows);
      for (let y = job.row; y < end; y++) {
        const v = (y + 0.5) / h;
        for (let x = 0; x < w; x++) {
          f((x + 0.5) / w, v, o);
          const i = (y * w + x) * 4;
          data[i] = clamp01(o[0]) * 255 + 0.5; data[i + 1] = clamp01(o[1]) * 255 + 0.5; data[i + 2] = clamp01(o[2]) * 255 + 0.5; data[i + 3] = 255;
          job.sum += data[i + 1];
        }
      }
      job.row = end; job.done = end >= h;
      return job;
    },
    mean() { return job.sum / (w * job.row || 1) / 255; },
  };
  return job;
}
// Whole texture at once (tests, and a canvas user that needs it before the preload got there).
export const generate = spec => texJob(spec).step();
