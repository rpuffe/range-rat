// The texture pass (web/js/texgen.js pure, web/js/textures.js the GPU side): the Xbox budget, seamless tiling, the
// brightness the materials are compensated for, and that the preload's slices make the same pixels as one go.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TEX_SPECS, SPEC_BY_ID, isPow2, texBytes, totalBytes, texJob, generate, vnoise, hash2, LOW_SCALE, sizeOf } from '../web/js/texgen.js';

const src = f => readFileSync(new URL('../web/js/' + f, import.meta.url), 'utf8');

test('every texture is a power of two, at most 512 px; High stays under 7 MB of GPU memory and Low (Xbox) under 2 MB', () => {
  for (const s of TEX_SPECS) {
    assert.ok(isPow2(s.size) && s.size <= 512, `${s.id} width ${s.size}`);
    assert.ok(isPow2(s.h ?? s.size) && (s.h ?? s.size) <= 512, `${s.id} height`);
  }
  assert.equal(texBytes(SPEC_BY_ID.grass), Math.round(512 * 512 * 4 * 4 / 3), 'mipmapped RGBA8');
  assert.equal(texBytes(SPEC_BY_ID.sign), 0, 'the sign layer is canvas-only');
  assert.ok(totalBytes() < 7 * 1024 * 1024, `total ${totalBytes()}`);
  // Low: every GPU texture at half size (a quarter of the bytes): less than the 4 MB the first pass cost every tier.
  assert.ok(totalBytes(TEX_SPECS, LOW_SCALE) < 2 * 1024 * 1024, `low ${totalBytes(TEX_SPECS, LOW_SCALE)}`);
  for (const s of TEX_SPECS.filter(t => t.gpu)) {
    const lo = sizeOf(s, LOW_SCALE);
    assert.ok(isPow2(lo.w) && isPow2(lo.h) && lo.w <= 256, `${s.id} low ${lo.w}x${lo.h}`);
  }
  assert.deepEqual(sizeOf(SPEC_BY_ID.sign, LOW_SCALE), { w: 256, h: 128 }, 'the canvas-only sign layer keeps its size');
  assert.ok(TEX_SPECS.length <= 16, 'a small shared set');
});

test('the generated average matches each spec MEAN (materials are lifted by 1 / MEAN)', () => {
  for (const s of TEX_SPECS) {
    const m = generate(s).mean();
    assert.ok(Math.abs(m - s.mean) < 0.015, `${s.id}: generated ${m.toFixed(3)} vs spec ${s.mean}`);
  }
});

test('textures tile seamlessly: the wrap edge is no harsher than any neighbouring column', () => {
  for (const s of TEX_SPECS.filter(t => t.id !== 'sign' && t.id !== 'turf')) {   // the sign has edges on purpose; turf has seams
    const j = generate(s), w = j.w, h = j.h, d = j.data;
    let wrap = 0, inner = 0;
    for (let y = 0; y < h; y++) {
      wrap += Math.abs(d[(y * w) * 4 + 1] - d[(y * w + w - 1) * 4 + 1]);
      for (const x of [w / 4, w / 2, (3 * w) / 4]) inner += Math.abs(d[(y * w + x) * 4 + 1] - d[(y * w + x - 1) * 4 + 1]) / 3;
    }
    assert.ok(wrap <= inner * 1.6 + h, `${s.id}: wrap ${wrap} vs inner ${inner.toFixed(0)}`);
  }
  // the lattice itself wraps
  assert.ok(Math.abs(vnoise(0.3, 0.7, 8, 8, 5) - vnoise(8.3, 0.7, 8, 8, 5)) < 1e-9);
  assert.ok(Math.abs(vnoise(0.3, 0.7, 8, 8, 5) - vnoise(0.3, 8.7, 8, 8, 5)) < 1e-9);
});

test('deterministic, and the preload slices make exactly the pixels one go does', () => {
  for (const s of TEX_SPECS) {
    const a = generate(s), b = texJob(s);
    let n = 0;
    while (!b.done) { b.step(7); n++; }
    assert.ok(n > 1);
    assert.deepEqual(b.data, a.data, s.id);
  }
  assert.equal(hash2(3, 4, 5), hash2(3, 4, 5));
  assert.notEqual(hash2(3, 4, 5), hash2(4, 3, 5));
});

test('a slice is small: no single step of the preload is a whole 512 texture', () => {
  const t = src('textures.js');
  assert.match(t, /j\.step\(Math\.max\(4, 8192 \/ j\.w \| 0\)\)/, 'about 8k pixels a step');
  assert.match(t, /sliceMs = 10/, 'a ~10 ms budget per slice');
  assert.match(t, /setTimeout\(slice, 0\)/, 'yields between slices (not rAF: it stalls when hidden)');
});

test('no per-frame work, one GPU copy per texture, mipmaps on', () => {
  const t = src('textures.js');
  assert.doesNotMatch(t, /requestAnimationFrame|tick\(/, 'textures.js has nothing per frame');
  assert.match(t, /generateMipmaps = true/);
  assert.match(t, /LinearMipmapLinearFilter/);
  assert.match(t, /map\(id\)\.clone\(\)/, 'variants clone (and so share) the base source');
});

test('main.js: the mow stripes are one mesh, the bar fills, Start never waits on the preload', () => {
  const m = src('main.js');
  assert.doesNotMatch(m, /new THREE\.PlaneGeometry\(128, 12\)/, 'the 16 stripe planes are merged');
  assert.match(m, /name = 'mow-stripes'/);
  assert.match(m, /TEX\.preload\(\{ renderer/);
  assert.doesNotMatch(m, /await TEX\.ready/, 'enter() never waits (owner: never block creating or joining a crew)');
  assert.match(m, /TEX\.configure\(\{ low: perf\.low \}\);[^\n]*\nTEX\.setAnisotropy/, 'the tier is set before the first texture');
  const html = readFileSync(new URL('../web/index.html', import.meta.url), 'utf8');
  const bar = html.match(/<div id="loadbar"[^>]*>/)?.[0] ?? '';
  assert.match(bar, /role="progressbar"/);
  assert.doesNotMatch(bar, /tabindex/, 'the bar never takes pad focus');
  assert.match(html, /#loadbar\.done \{ opacity: 0; \}/, 'it fades but keeps its space (nothing moves under a focused button)');
});

test('the ground is calm (owner: "a little too busy and a bit hard to see"): soft variation, no texel speckle', () => {
  // std: overall contrast; step: mean change between neighbouring texels, the grain that shimmers when minified
  // on the Low tier (anisotropy 2). The first pass was grass std 0.150 / step 0.087, turf 0.113 / 0.068.
  for (const [id, maxStd, maxStep] of [['grass', 0.07, 0.006], ['mow', 0.07, 0.006], ['turf', 0.07, 0.025]]) {
    const j = generate(SPEC_BY_ID[id]), d = j.data, w = j.w;
    let a = 0, b = 0, n = 0, step = 0;
    for (let y = 0; y < j.h; y++) for (let x = 1; x < w; x++) {
      const v = d[(y * w + x) * 4 + 1]; a += v; b += v * v; n++; step += Math.abs(v - d[(y * w + x - 1) * 4 + 1]);
    }
    const m = a / n, std = Math.sqrt(b / n - m * m) / 255;
    assert.ok(std < maxStd, `${id}: contrast ${std.toFixed(3)} (max ${maxStd})`);
    assert.ok(step / n / 255 < maxStep, `${id}: grain ${(step / n / 255).toFixed(4)} (max ${maxStep})`);
  }
  const m = src('main.js');
  assert.match(m, /TEX\.mat\('grass', 0x5f8f3a, \{ world: 2\.4, mode: 'top', macro: 0\.35 \}\)/, 'big soft tiles, a gentle macro');
});

test('the Low tier: half-size pixels with the same look, and no bump maps (its shaders are the ones it had)', () => {
  for (const s of TEX_SPECS.filter(t => t.gpu)) {
    const hi = generate(s), lo = generate(s, LOW_SCALE);
    assert.equal(lo.w, hi.w / 2, s.id);
    assert.ok(Math.abs(lo.mean() - hi.mean()) < 0.02, `${s.id}: low mean ${lo.mean().toFixed(3)} vs ${hi.mean().toFixed(3)}`);
  }
  const t = src('textures.js');
  assert.match(t, /scale = low \? LOW_SCALE : 1; bumpOn = !low;/);
  assert.match(t, /if \(bump && bumpOn && 'bumpMap' in m\)/, 'bump maps only when the tier allows');
  assert.match(t, /vBumpMapUv = vMapUv;/, 'a bump map follows the world-space uv');
  assert.match(t, /texJob\(SPEC_BY_ID\[id\], scale\)/);
});

test('the pre-warm: every venue built hidden, every shader compiled behind the title card, never blocking a join', () => {
  const w = src('prewarm.js');
  assert.match(w, /renderer\.compileAsync/, 'parallel compile where the browser has it');
  assert.match(w, /renderer\.initTexture\(t\)/, 'textures uploaded up front');
  assert.match(w, /setTimeout\(r, 0\)/, 'yields (not rAF: it stalls when hidden)');
  assert.doesNotMatch(w, /requestAnimationFrame|tick\(/, 'nothing per frame');
  const v = src('venues.js');
  assert.match(v, /live\.prebuild = \(\) => \{ for \(const k of Object\.keys\(builders\)\) ensure\(k\); \};/);
  assert.match(v, /g\.visible = false; scene\.add\(g\)/, 'groups start hidden: prebuilt venues draw nothing until reached');
  const m = src('main.js');
  assert.match(m, /prewarm\(\{ renderer, scene, camera, sun: sky\.sun, build: \[r2\.venueParts\.prebuild\]/);
  assert.match(w, /export function warmShadows/, 'and the shadow pass depth shaders (the balls cast only in a shift)');
  assert.match(m, /TEX\.preload\(\{ renderer, onProgress: p => loadBar\(0\.7 \* p\) \}\)/, 'one bar: textures then shaders');
});
