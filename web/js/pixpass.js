// Council round 13 #6 (builder 3): the spawn pixel pass, a ?debug console tool (not loaded by the game).
// In ?debug: await import('/js/pixpass.js'); then __pixSlots() measures every clock-in slot of the current venue:
// the share of the frame that is roof or underside (geometry above eye height within 25 m, rendered with an override
// shader and read back) at the eased pitch (-0.28), at -0.2 and at 0, and how much of the centre 20 % is within 8 m.
// __go(presetId) starts a skip-ahead preset from the title screen.
const THREE = await import('three');
window.__pixR = (() => {
  const W = 256, H = 160, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const r = new THREE.WebGLRenderer({ canvas: cv, preserveDrawingBuffer: true });
  const mat = new THREE.ShaderMaterial({ uniforms: { cam: { value: new THREE.Vector3() } }, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vW; void main(){ vec4 p = vec4(position,1.0);
      #ifdef USE_INSTANCING
      p = instanceMatrix * p;
      #endif
      vec4 w = modelMatrix * p; vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 cam; varying vec3 vW; void main(){ float d = distance(vW, cam);
      float roof = (vW.y > cam.y + 0.2 && d < 25.0) ? 1.0 : 0.0; float post = (d < 8.0 && vW.y > 0.3) ? 1.0 : 0.0;
      gl_FragColor = vec4(roof, post, 1.0, 1.0); }` });
  return () => {
    const cam = rr.camera, scene = rr.todoArrow.g.parent;
    mat.uniforms.cam.value.copy(cam.position);
    const hid = []; scene.traverse(o => { if ((o.isSprite || o.isPoints || o.isLine) && o.visible) { o.visible = false; hid.push(o); } });
    const bg = scene.background, ov = scene.overrideMaterial; scene.background = new THREE.Color(0); scene.overrideMaterial = mat;
    const c2 = cam.clone(); c2.aspect = W / H; c2.updateProjectionMatrix();
    r.render(scene, c2);
    scene.background = bg; scene.overrideMaterial = ov; hid.forEach(o => o.visible = true);
    const px = new Uint8Array(W * H * 4); const gl = r.getContext(); gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let roof = 0, cn = 0, cnear = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (px[i] > 127) roof++;
      if (Math.abs(x / W - 0.5) < 0.1 && Math.abs(y / H - 0.5) < 0.1) { cn++; if (px[i + 1] > 127) cnear++; } }
    return { roofPct: +(100 * roof / (W * H)).toFixed(1), centreNearPct: +(100 * cnear / cn).toFixed(1) };
  };
})();
window.__pixAt = (x, z, pitch = -0.28, y = 1.65, yaw = 0) => { const c = rr.camera; c.position.set(x, y, z); c.rotation.set(pitch, yaw, 0, 'YXZ'); c.updateMatrixWorld(); return __pixR(); };
window.__pixSlots = async () => {
  const S = await import('./sim.js'); const v = rr.crew.venue, out = { venue: v, vday: rr.crew.venueDay, slots: [] };
  const c = rr.camera, P = c.position.clone(), R = c.rotation.clone();
  for (let k = 0; k < 6; k++) { const s = S.clockInSpot(v, k, rr.crew.endless); const a = __pixAt(s.x, s.z, -0.28), b = __pixAt(s.x, s.z, -0.2), z0 = __pixAt(s.x, s.z, 0); out.slots.push(`${s.x}: ${a.roofPct}% roof (−0.2: ${b.roofPct}, 0: ${z0.roofPct}), centre-near ${a.centreNearPct}%`); }
  c.position.copy(P); c.rotation.copy(R); return JSON.stringify(out);
};
window.__go = async (id) => { document.getElementById('skip-toggle').click(); document.querySelector(`[data-skip="${id}"]`).click(); for (let i = 0; i < 60 && (document.getElementById('lobby')?.classList.contains('hidden') ?? true); i++) await new Promise(r => setTimeout(r, 200)); await new Promise(r => setTimeout(r, 800)); document.getElementById('start').click(); return 'started ' + id; };
'ok';
