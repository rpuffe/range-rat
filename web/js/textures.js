// Range Rat textures, the GPU half (texgen.js makes the pixels). One small shared set: grass, mow lanes, mat turf,
// dirt, deck wood, galvanised metal, and a weathering layer for the signs.
//
//   TEX.preload({ renderer, onProgress })   // once, at boot: generates a slice at a time behind the title card's bar,
//                                            // uploads each texture (mipmaps too) as it finishes. Returns TEX.ready.
//   TEX.map('wood')                          // the shared texture (materials can take it at once: it shows the plain
//                                            // average colour until its pixels arrive, so nothing goes black)
//   TEX.mat('wood', 0x8b6b45, { world: 2 })  // a shared Lambert material: the map, the colour lifted by 1 / MEAN,
//                                            // world-space uv (one tile per 2 m) so scaled boxes and instances don't smear
//   TEX.textured(mat, 'metal', { world })    // the same, on a material someone else owns (it keeps its colour's look)
//   TEX.signFinish(ctx, w, h)                // weather a sign canvas after its text is painted (paint grain, edge grime)
//
// ?notex: A/B the look and the cost: no maps, no weathering, flat colours as before (the bar still shows and fills).
//
// Xbox budget: ≤ 512 px, power of two, mipmapped, one GPU copy per texture (variants share it), no per-frame work.
import * as THREE from 'three';
import { TEX_SPECS, SPEC_BY_ID, texJob, totalBytes, LOW_SCALE } from './texgen.js';

const jobs = new Map();          // id -> texgen job (its .data is the texture's own pixel buffer)
const base = new Map();          // id -> THREE.DataTexture
const variants = new Map();      // id -> [every texture sharing that source] (all flagged when the pixels land)
const matCache = new Map();
let renderer = null, started = false, resolveReady, aniso = 1;
let scale = 1, bumpOn = false;   // configure(): Low halves every texture; High alone gets bump maps
const OFF = /[?&]notex/.test(globalThis.location?.search ?? '');
const stats = { work: 0, slices: 0, ms: 0, bytes: totalBytes(), count: TEX_SPECS.length, done: false, t0: 0 };
export const ready = new Promise(r => { resolveReady = r; });
export const isReady = () => stats.done;
export const texStats = () => ({ ...stats });

// The quality tier, once, before the first texture or material is asked for (main.js, from perf.js's profile).
// Low (Xbox Edge through Auto): half-size textures, no bump maps, so its shaders are the ones it had before.
// High: full size, and the materials that ask for it get a bump map (the same texture, no second download).
// Like props.js, it is read at load: switching tiers in Settings applies after a reload.
export function configure({ low = false } = {}) {
  if (jobs.size) return;
  scale = low ? LOW_SCALE : 1; bumpOn = !low;
  stats.bytes = totalBytes(TEX_SPECS, scale);
}

function job(id) {
  let j = jobs.get(id);
  if (!j) {
    j = texJob(SPEC_BY_ID[id], scale);
    const g = Math.round(j.spec.mean * 255);                     // until generated: the flat average, so no pop to black
    for (let i = 0; i < j.data.length; i += 4) { j.data[i] = j.data[i + 1] = j.data[i + 2] = g; j.data[i + 3] = 255; }
    jobs.set(id, j);
  }
  return j;
}
// The pixels, generated now if the preload hasn't got there (a canvas user at build time).
export function pixels(id) { const j = job(id); if (!j.done) { j.step(); landed(j); } return j; }

export function map(id) {
  let t = base.get(id);
  if (t) return t;
  const j = job(id);
  t = new THREE.DataTexture(j.data, j.w, j.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.colorSpace = THREE.NoColorSpace;                             // linear multipliers (texgen.js)
  t.anisotropy = aniso; t.name = 'rr.' + id;
  t.needsUpdate = true;
  base.set(id, t); variants.set(id, [t]);
  return t;
}
// A repeat variant: its own uv repeat, the same pixels and the same GPU copy (three keys uploads by source).
export function variant(id, rx = 1, ry = 1) {
  const t = map(id).clone(); t.repeat.set(rx, ry); t.needsUpdate = true;
  variants.get(id).push(t);
  return t;
}

// World-space uv: top faces by x/z, side faces by z/y or x/y, so a 40 m slab and a 1 m bench share one texel size.
// mode 'top' (ground-ish planes: x/z only) or 'box'. One shader variant per mode (customProgramCacheKey).
// 'top' also multiplies in a second, 7× larger sample of the same texture (one more fetch), so ground tiles a metre or
// two across for crisp blades without the repeat showing: the big sample breaks the grid up into ~10 m patches.
// macro: how strongly (0..1). Grass keeps it low: soft variation, nothing blotchy (owner: "too busy").
function worldUv(m, metres, mode, id, macro = 0.7) {
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey?.call(m) ?? '';
  const U = { uWuv: { value: 1 / metres }, uMacroInv: { value: 1 / SPEC_BY_ID[id].mean }, uMacro: { value: macro } };
  m.onBeforeCompile = (sh, r) => {
    prev?.call(m, sh, r);
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWuv;')
      .replace('#include <fog_vertex>', `#include <fog_vertex>
#ifdef USE_MAP
{ vec4 rw = vec4(transformed, 1.0); vec3 rn = objectNormal;
#ifdef USE_INSTANCING
  rw = instanceMatrix * rw; rn = mat3(instanceMatrix) * rn;
#endif
  rw = modelMatrix * rw; rn = abs(mat3(modelMatrix) * rn);
  vec2 wuv = ${mode === 'top' ? 'rw.xz' : '(rn.y >= max(rn.x, rn.z)) ? rw.xz : (rn.x > rn.z ? rw.zy : rw.xy)'};
  vMapUv = (mapTransform * vec3(wuv * uWuv, 1.0)).xy;
#ifdef USE_BUMPMAP
  vBumpMapUv = vMapUv;
#endif
  }
#endif`);
    if (mode === 'top') sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uMacroInv; uniform float uMacro;')
      .replace('#include <map_fragment>', `#include <map_fragment>
#ifdef USE_MAP
  diffuseColor.rgb *= mix(1.0, texture2D(map, vMapUv * 0.137 + vec2(0.31, 0.71)).g * uMacroInv, uMacro);
#endif`);
  };
  m.customProgramCacheKey = () => key + '|rr-wuv-' + mode;
  m.userData.wuv = U;
}

// How much a material's colour is lifted for texture `id` (1 for none): for code that re-sets a textured colour.
export const lift = id => SPEC_BY_ID[id] ? 1 / SPEC_BY_ID[id].mean : 1;

// Put texture `id` on a material: the map, the colour lifted so the average brightness stays put, world uv if asked.
// bump: on High only, the same texture as a bump map at this strength (joints, laps, bark and shingles catch the sun).
export function textured(m, id, { world = 0, mode = 'box', repeat = null, macro, bump = 0 } = {}) {
  if (!m || m.userData.rrTex || OFF) return m;
  m.map = repeat ? variant(id, repeat[0], repeat[1]) : map(id);
  m.color?.multiplyScalar(1 / SPEC_BY_ID[id].mean);
  if (bump && bumpOn && 'bumpMap' in m) { m.bumpMap = m.map; m.bumpScale = bump; }
  if (world) worldUv(m, world, mode, id, macro);
  m.userData.rrTex = id; m.userData.rrLift = 1 / SPEC_BY_ID[id].mean;   // for code that re-sets the colour
  m.needsUpdate = true;
  return m;
}
// A shared textured Lambert, cached by (texture, colour, options).
export function mat(id, color, { world = 0, mode = 'box', repeat = null, macro, bump = 0, ...extra } = {}) {
  const key = `${id}|${color}|${world}|${mode}|${repeat}|${macro}|${bump}|${JSON.stringify(extra)}`;
  let m = matCache.get(key);
  if (!m) { m = textured(new THREE.MeshLambertMaterial({ color, ...extra }), id, { world, mode, repeat, macro, bump }); matCache.set(key, m); }
  return m;
}

// ---- signage ----------------------------------------------------------------------------------------------------
// A texture's pixels drawn into a canvas (an atlas that wants a band of metal, say), scaled to the rectangle.
const pixCanvas = new Map();
export function paintPixels(ctx, id, x, y, w, h) {
  if (!ctx || typeof document === 'undefined' || OFF) return;
  let c = pixCanvas.get(id);
  if (!c) {
    const j = pixels(id);
    c = document.createElement('canvas'); c.width = j.w; c.height = j.h;
    const g = c.getContext('2d'), img = g.createImageData(j.w, j.h);
    img.data.set(j.data); g.putImageData(img, 0, 0);
    pixCanvas.set(id, c);
  }
  ctx.drawImage(c, x, y, w, h);
}
// After the text: multiply the weathering over the whole face, then four screw heads in the corners.
export function signFinish(ctx, w, h, { screws = true } = {}) {
  if (!ctx || typeof document === 'undefined' || OFF) return;
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  paintPixels(ctx, 'sign', 0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
  if (screws) {
    const r = Math.max(2, Math.min(w, h) * 0.022), m = r * 2.6;
    for (const [x, y] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) {
      const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
      gr.addColorStop(0, '#f2f2ee'); gr.addColorStop(1, '#6b6b66');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(40,40,40,0.7)'; ctx.lineWidth = Math.max(1, r * 0.3);
      ctx.beginPath(); ctx.moveTo(x - r * 0.6, y); ctx.lineTo(x + r * 0.6, y); ctx.stroke();
    }
  }
  ctx.restore();
}

// ---- the preload ------------------------------------------------------------------------------------------------
function landed(j) {
  if (!j.spec.gpu) return;
  for (const t of variants.get(j.spec.id) ?? []) t.needsUpdate = true;
  const t = base.get(j.spec.id);
  if (t && renderer) renderer.initTexture(t);                    // upload + mipmaps now, on the title card
}
export function setAnisotropy(n) { aniso = n; for (const list of variants.values()) for (const t of list) t.anisotropy = n; }

// Generate every texture, a ~10 ms slice at a time (the title card stays live and the pad keeps working), and
// report progress 0..1. Rows are the unit of work: 512 px textures cost 4× a 256 one, and the bar says so.
export function preload({ renderer: r = null, onProgress = null, sliceMs = 10 } = {}) {
  if (started) return ready;
  started = true; renderer = r; stats.t0 = performance.now();
  if (OFF) { stats.done = true; stats.bytes = 0; onProgress?.(1); resolveReady(stats); return ready; }
  const list = TEX_SPECS.map(s => job(s.id));
  for (const s of TEX_SPECS) if (s.gpu) map(s.id);
  const total = list.reduce((a, j) => a + j.h * j.w, 0);
  const report = () => onProgress?.(list.reduce((a, j) => a + j.row * j.w, 0) / total);
  const slice = () => {
    const t0 = performance.now();
    for (const j of list) {
      while (!j.done && performance.now() - t0 < sliceMs) { j.step(Math.max(4, 8192 / j.w | 0)); if (j.done) landed(j); }
      if (!j.done) break;
    }
    report();
    stats.work += performance.now() - t0; stats.slices++;   // time spent generating + uploading (ms: wall clock)
    if (list.every(j => j.done)) {
      stats.work = Math.round(stats.work);
      stats.ms = Math.round(performance.now() - stats.t0); stats.done = true;
      console.info(`[textures] ${stats.count} textures, ${(stats.bytes / 1048576).toFixed(2)} MB on the GPU, ${stats.work} ms of work in ${stats.slices} slices, ready ${stats.ms} ms after boot`);
      resolveReady(stats);
    } else setTimeout(slice, 0);
  };
  setTimeout(slice, 0);
  return ready;
}
