// "Corporate CCTV": the overview camera (design/council-round2.md section 4.6).
// While on, update() drives the caller's camera directly. The caller owns
// opening it (D-pad down / C), the unlock, and exiting when the Rat is knocked
// flat; this module owns feeds, pan/zoom, flagging and the grainy overlay.
import * as THREE from 'three';

// Fixed feed poses. Council doc wins over the brief: MAST / POND / FAR FIELD.
export const FEEDS = [
  { name: 'STAND MAST', pos: [26, 18, 14],   look: [8, 0, -110] },
  { name: 'POND',       pos: [-30, 10, -58], look: [-12, 0, -78] },
  { name: 'FAR FIELD',  pos: [0, 22, -188],  look: [0, 0, 0] },
];
const FOV_WIDE = 60, FOV_TIGHT = 25;
const YAW_MAX = 35 * Math.PI / 180, PITCH_MAX = 15 * Math.PI / 180;
const FIELD = { x: 120, zMin: -320, zMax: 40 };   // flag clamp (generous box around the range)
const FLAG_SECS = 10;
const BTN = { A: 0, B: 1, LB: 4, RB: 5, LEFT: 14, RIGHT: 15, DOWN: 13 };

const has = (keys, ...names) => !!keys && names.some(n => keys.has(n));
const pad2 = n => String(n).padStart(2, '0');

export function createCCTV({ camera, root, onFlag }) {
  let on = false, feed = 0, yaw = 0, pitch = 0, fov = FOV_WIDE, savedFov = camera.fov;
  let ui = null, noiseCtx = null, noiseT = 0, clock = 0, tsT = 0, canvasEl = null, savedFilter = '';
  let prevDown = null, prevKeys = new Set(), flagCooldown = 0;
  let pts = [];            // marker world points
  const flags = [];        // {x, z, by, color, until, el}
  const mPool = [];
  const v = new THREE.Vector3(), dir = new THREE.Vector3();
  const base = FEEDS.map(f => {
    const dx = f.look[0] - f.pos[0], dy = f.look[1] - f.pos[1], dz = f.look[2] - f.pos[2];
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
  });

  function build() {
    if (ui) return;
    const css = document.createElement('style');
    css.textContent = `
      .cctv{position:absolute;inset:0;pointer-events:none;z-index:40;display:none;overflow:hidden;font-family:ui-monospace,Menlo,Consolas,monospace;color:#d6ffd6;text-shadow:0 0 3px #000,1px 1px 0 #000}
      .cctv.on{display:block}
      .cctv .scan{position:absolute;inset:0;background:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0,rgba(0,0,0,0) 2px,rgba(0,0,0,.28) 3px,rgba(0,0,0,0) 4px)}
      .cctv .vig{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(0,0,0,.55) 100%)}
      .cctv .noise{position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated;opacity:.16;mix-blend-mode:overlay}
      .cctv .hdr{position:absolute;top:14px;left:18px;font-size:15px;letter-spacing:.06em;line-height:1.5}
      .cctv .rec{color:#ff4a4a;animation:cctvblink 1.2s steps(2,start) infinite}
      @keyframes cctvblink{to{visibility:hidden}}
      .cctv .ts{position:absolute;bottom:14px;right:18px;font-size:15px;letter-spacing:.06em}
      .cctv .help{position:absolute;bottom:14px;left:18px;font-size:12px;opacity:.8}
      .cctv .ret{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;border:1px solid rgba(214,255,214,.8);border-radius:50%}
      .cctv .ret:before,.cctv .ret:after{content:"";position:absolute;background:rgba(214,255,214,.8)}
      .cctv .ret:before{left:12px;top:-6px;width:1px;height:38px}
      .cctv .ret:after{top:12px;left:-6px;height:1px;width:38px}
      .cctv .mk{position:absolute;transform:translate(-50%,-50%);color:#ff2a2a;font-weight:900;font-size:26px;display:none}
      .cctv .mk small{display:block;font-size:11px;font-weight:400;text-align:center;color:#ffb0b0}
      .cctv .fl{position:absolute;transform:translate(-50%,-100%);display:none;font-weight:700;font-size:12px;text-align:center;white-space:nowrap}
      .cctv .fl b{display:block;font-size:26px;line-height:1;animation:cctvpulse 1s ease-in-out infinite}
      @keyframes cctvpulse{50%{transform:scale(1.25)}}`;
    const el = document.createElement('div');
    el.className = 'cctv';
    el.innerHTML = '<canvas class="noise" width="128" height="72"></canvas><div class="scan"></div><div class="vig"></div>' +
      '<div class="ret"></div><div class="hdr"></div><div class="ts"></div>' +
      '<div class="help">LB/RB feed · R-stick pan · LT/RT zoom · Ⓐ flag · Ⓑ leave</div><div class="layer"></div>';
    el.prepend(css);
    root.appendChild(el);
    const n = el.querySelector('.noise');
    noiseCtx = n.getContext('2d');
    ui = { el, hdr: el.querySelector('.hdr'), ts: el.querySelector('.ts'), layer: el.querySelector('.layer'), noise: n };
  }

  function header() {
    ui.hdr.innerHTML = `FHI SECURITY · CAM ${feed + 1} · ${FEEDS[feed].name}<br><span class="rec">REC ●</span> ZOOM ${Math.round(FOV_WIDE / fov * 10) / 10}x`;
  }

  function stamp() {
    const d = new Date();
    ui.ts.textContent = `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  }

  function paintNoise() {
    const w = 128, h = 72, img = noiseCtx.createImageData(w, h), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const g = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255; }
    noiseCtx.putImageData(img, 0, 0);
  }

  function setFeed(i) {
    feed = ((i % FEEDS.length) + FEEDS.length) % FEEDS.length;
    yaw = 0; pitch = 0;
    if (ui) header();
  }

  function enter() {
    if (on) return;
    build();
    on = true; savedFov = camera.fov; fov = FOV_WIDE;
    prevDown = null; prevKeys = new Set();
    canvasEl = root.querySelector('canvas:not(.noise)') || document.querySelector('canvas');
    if (canvasEl) { savedFilter = canvasEl.style.filter; canvasEl.style.filter = 'saturate(0.35) contrast(1.15) sepia(0.25) hue-rotate(60deg) brightness(0.95)'; }
    ui.el.classList.add('on');
    setFeed(feed);
    stamp(); paintNoise();
  }

  function exit() {
    if (!on) return;
    on = false;
    camera.fov = savedFov; camera.updateProjectionMatrix();
    if (canvasEl) { canvasEl.style.filter = savedFilter; canvasEl = null; }
    if (ui) ui.el.classList.remove('on');
  }

  function groundHit() {
    camera.getWorldDirection(dir);
    if (dir.y > -1e-4) return null;
    const t = -camera.position.y / dir.y;
    return {
      x: Math.max(-FIELD.x, Math.min(FIELD.x, camera.position.x + dir.x * t)),
      z: Math.max(FIELD.zMin, Math.min(FIELD.zMax, camera.position.z + dir.z * t)),
    };
  }

  function project(p, w, h) {
    v.set(p.x, p.y ?? 0, p.z).project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.05 || Math.abs(v.y) > 1.05) return null;
    return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h];
  }

  function showFlag({ x, z, by, color }) {
    build();
    const el = document.createElement('div');
    el.className = 'fl';
    const c = typeof color === 'number' ? '#' + color.toString(16).padStart(6, '0') : (color || '#ffd23a');
    el.style.color = c;
    el.innerHTML = `<b>⚑</b>LOOK HERE${by ? ' · ' + String(by).replace(/[<>&]/g, '') : ''}`;
    ui.layer.appendChild(el);
    flags.push({ x, z, until: clock + FLAG_SECS, el });
  }

  function markers(points) { pts = points || []; }

  function update(dt, input) {
    clock += dt;
    // Flags expire even while CCTV is off.
    for (let i = flags.length - 1; i >= 0; i--) if (clock > flags[i].until) { flags[i].el.remove(); flags.splice(i, 1); }
    if (!on) return;
    const { pad, keys, mouse, width: w = 1, height: h = 1 } = input;
    flagCooldown = Math.max(0, flagCooldown - dt);

    // Edge detection (the first frame after enter only records state, so the
    // press that opened CCTV can't also close it).
    const down = (pad && pad.down) || [];
    const pressed = i => !!down[i] && prevDown !== null && !prevDown[i];
    const keyHit = (...n) => has(keys, ...n) && !n.some(k => prevKeys.has(k));
    const first = prevDown === null;
    let leave = false, flag = false, step = 0;
    if (pressed(BTN.B) || pressed(BTN.DOWN) || keyHit('Escape')) leave = true;
    if (pressed(BTN.A)) flag = true;
    if (pressed(BTN.RB) || pressed(BTN.RIGHT) || keyHit('KeyE', 'e', 'E')) step = 1;
    if (pressed(BTN.LB) || pressed(BTN.LEFT) || keyHit('KeyQ', 'q', 'Q')) step = -1;
    if (keyHit('Digit1', '1')) setFeed(0);
    if (keyHit('Digit2', '2')) setFeed(1);
    if (keyHit('Digit3', '3')) setFeed(2);
    // 'C' toggles on a keyboard, but only after a release (enter() resets prevKeys).
    if (!first && keyHit('KeyC', 'c', 'C')) leave = true;
    if (mouse && mouse.click) flag = true;
    prevDown = Array.from(down, Boolean);
    prevKeys = new Set(keys || []);
    if (first && keys) prevKeys = new Set(keys);   // keep the opening key from re-firing
    if (leave) { exit(); return; }
    if (step) setFeed(feed + step);

    // Pan (finer when zoomed in) and zoom.
    const k = fov / FOV_WIDE;
    if (pad) { yaw -= (pad.rx || 0) * 0.9 * dt * k; pitch -= (pad.ry || 0) * 0.7 * dt * k; }
    if (mouse && mouse.down) { yaw -= (mouse.dx || 0) * 0.003 * k; pitch -= (mouse.dy || 0) * 0.003 * k; }
    if (keys) {
      if (has(keys, 'KeyA', 'a', 'ArrowLeft')) yaw += 0.7 * dt * k;
      if (has(keys, 'KeyD', 'd', 'ArrowRight')) yaw -= 0.7 * dt * k;
      if (has(keys, 'KeyW', 'w', 'ArrowUp')) pitch += 0.5 * dt * k;
      if (has(keys, 'KeyS', 's', 'ArrowDown')) pitch -= 0.5 * dt * k;
    }
    yaw = Math.max(-YAW_MAX, Math.min(YAW_MAX, yaw));
    pitch = Math.max(-PITCH_MAX, Math.min(PITCH_MAX, pitch));
    if (pad) fov += ((pad.lt || 0) - (pad.rt || 0)) * 35 * dt;   // RT zooms in, LT out
    if (mouse && mouse.wheel) {
      if (has(keys, 'ShiftLeft', 'ShiftRight', 'Shift')) setFeed(feed + (mouse.wheel > 0 ? 1 : -1));
      else fov += Math.sign(mouse.wheel) * 3;                    // wheel down zooms out
    }
    fov = Math.max(FOV_TIGHT, Math.min(FOV_WIDE, fov));

    // Drive the camera.
    const f = FEEDS[feed], b = base[feed];
    camera.position.set(f.pos[0], f.pos[1], f.pos[2]);
    camera.rotation.set(b.pitch + pitch, b.yaw + yaw, 0, 'YXZ');
    camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);

    if (flag && flagCooldown <= 0) {
      const g = groundHit();
      if (g) { flagCooldown = 2; if (onFlag) onFlag({ x: g.x, z: g.z }); }
    }

    // Overlay.
    header();
    tsT -= dt; if (tsT <= 0) { tsT = 0.25; stamp(); }
    noiseT -= dt; if (noiseT <= 0) { noiseT = 0.08; paintNoise(); }
    while (mPool.length < pts.length) {
      const m = document.createElement('div'); m.className = 'mk'; m.innerHTML = '✗<small></small>';
      ui.layer.appendChild(m); mPool.push(m);
    }
    for (let i = 0; i < mPool.length; i++) {
      const m = mPool[i], p = pts[i], s = p && project(p, w, h);
      if (!s) { m.style.display = 'none'; continue; }
      m.style.display = 'block'; m.style.left = s[0] + 'px'; m.style.top = s[1] + 'px';
      m.lastChild.textContent = p.label || '';
    }
    for (const fl of flags) {
      const s = project({ x: fl.x, y: 0, z: fl.z }, w, h);
      if (!s) { fl.el.style.display = 'none'; continue; }
      fl.el.style.display = 'block'; fl.el.style.left = s[0] + 'px'; fl.el.style.top = s[1] + 'px';
    }
  }

  return {
    get isOn() { return on; },
    get feed() { return feed; },
    enter, exit, toggle() { on ? exit() : enter(); },
    setFeed, update, markers, showFlag,
  };
}
