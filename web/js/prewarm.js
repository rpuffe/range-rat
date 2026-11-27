// Range Rat pre-warm: while the title card (or the lobby) is up, upload every texture and compile every shader the
// game will draw, so the first shift, a venue's reveal and a station popping in don't stall on the GPU.
// design/game-design.md, "Textures and preloading".
//
//   prewarm({ renderer, scene, camera, build: [fn], extras: [object3D], onProgress: k => ..., })  -> Promise<stats>
//
// build:  functions that add hidden meshes now that would otherwise appear later (venues.js prebuild: every venue's
//         group). Hidden meshes still compile (three's compile walks the whole scene, visible or not).
// extras: detached objects that only exist later (a customer, ...), compiled against the scene's own lights and then
//         dropped. A shader program is shared by every material with the same features, so one of each kind covers
//         every later copy.
// Never blocks the player: it yields between steps, and compileAsync (KHR_parallel_shader_compile) links in the
// background where the browser has it. A crew can be created or joined at any point; the warm just carries on.
import * as THREE from 'three';

const MAPS = ['map','alphaMap', 'bumpMap', 'normalMap', 'emissiveMap', 'aoMap', 'lightMap', 'specularMap', 'gradientMap'];
const nextTask = () => new Promise(r => setTimeout(r, 0));   // not rAF: it stalls while the tab is hidden

// Every texture the materials under `root` use, once each (render-target textures upload themselves).
export function texturesOf(root, into = new Set()) {
  root.traverse(o => {
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of ms) for (const k of MAPS) {
      const t = m[k];
      if (t?.isTexture && !t.isRenderTargetTexture && t.image) into.add(t);
    }
  });
  return into;
}

// The shadow pass's own depth shaders: three makes them on the first frame a kind of caster is drawn into the shadow
// map, and the instanced balls only cast once a shift is on (the first-shift hitch was mostly these). Their programs
// are keyed by the scene's lights, so the warm happens in the real scene: a throwaway caster of each kind added for one
// ordinary frame (to the canvas, under the title card: a render target would compile a second, linear-output set of
// every shader), then removed.
export function warmShadows(renderer, scene, camera, sun) {
  if (!renderer.shadowMap.enabled || !sun?.castShadow) return;
  const g = new THREE.BoxGeometry(0.01, 0.01, 0.01), m = new THREE.MeshBasicMaterial(), m2 = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const one = new THREE.InstancedMesh(g, m, 1), tinted = new THREE.InstancedMesh(g, m, 1);
  tinted.setColorAt(0, new THREE.Color(1, 1, 1));
  const casters = [one, tinted, new THREE.Mesh(g, m), new THREE.Mesh(g, m2)];
  for (const o of casters) { o.castShadow = true; o.frustumCulled = false; o.position.set(0, -50, 0); scene.add(o); }
  renderer.shadowMap.needsUpdate = true;
  try { renderer.render(scene, camera); } finally { for (const o of casters) scene.remove(o); }
  renderer.shadowMap.needsUpdate = true;
  g.dispose(); m.dispose(); m2.dispose(); one.dispose(); tinted.dispose();
}

export async function prewarm({ renderer, scene, camera, sun = null, build = [], extras = [], onProgress = null, sliceMs = 8 } = {}) {
  const now = () => performance.now(), t0 = now(), p0 = renderer.info.programs?.length ?? 0;
  const report = k => { try { onProgress?.(k); } catch { /* the bar is cosmetic */ } };
  for (const f of build) { try { f?.(); } catch (e) { console.warn('[prewarm] build', e); } }
  report(0.15);
  await nextTask();

  // Textures: upload (and mipmap) each once now, a slice at a time.
  const tex = texturesOf(scene);
  for (const x of extras) texturesOf(x, tex);
  let i = 0, ts = now();
  for (const t of tex) {
    renderer.initTexture(t);
    if (now() - ts > sliceMs) { report(0.15 + 0.35 * (++i / tex.size)); await nextTask(); ts = now(); } else i++;
  }
  report(0.5);
  await nextTask();

  // Shaders: the scene (hidden venue groups included), then each extra against the scene's lights.
  const compile = (root, target) => renderer.compileAsync
    ? renderer.compileAsync(root, camera, target)
    : Promise.resolve(renderer.compile(root, camera, target));
  const tc = now();
  await compile(scene, scene);
  report(0.85);
  for (const x of extras) { await nextTask(); await compile(x, scene); }
  await nextTask();
  if (sun) warmShadows(renderer, scene, camera, sun);
  report(1);
  return {
    ms: Math.round(now() - t0), compileMs: Math.round(now() - tc), textures: tex.size,
    programs: (renderer.info.programs?.length ?? 0) - p0, async: !!renderer.compileAsync,
  };
}
