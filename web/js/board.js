// board.js - the Fairway Holdings "Board" (split-flap Ball Value billboard), the Ball Silo
// (acrylic tube of banked balls), and floating text labels. No side effects on import.
//
//   const b = createBoard(scene, { x, z });
//   b.update(state);                       // ~10x/s; redraws only when displayed values change
//   b.floatText(x, y, z, 'text', '#fff');  // rises ~1.5 m and fades over 1.6 s
//   b.tick(dt);                            // call every frame (flip animation + float labels)
import * as THREE from 'three';

const W = 1024, H = 512;
const MONO = '"Courier New", ui-monospace, Menlo, Consolas, monospace';
const SANS = 'system-ui, "Segoe UI", Arial, sans-serif';
const FLIP_TIME = 0.3, FLIP_STEP = 0.05;
const SILO_MAX = 2000, BALL_R = 0.05;
const FLOAT_TIME = 1.6, FLOAT_RISE = 1.5;
const SCRAMBLE = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789$#%&';

const money = n => '$' + (Number.isFinite(n) ? n : 0).toFixed(2);
const commas = n => String(Math.max(0, Math.round(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const clamp01 = v => Math.max(0, Math.min(1, v));

function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scramble(text, progress) {          // left-to-right settle; spaces and punctuation stay put
  let out = '';
  const settled = Math.floor(text.length * progress);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    out += (i < settled || !/[A-Za-z0-9]/.test(ch)) ? ch : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
  }
  return out;
}

function drawDimples(g, cx, cy, r) {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9cfd8';
  for (const [dx, dy] of [[-0.4, -0.35], [0.1, -0.5], [0.45, -0.2], [-0.5, 0.05], [-0.1, -0.1], [0.3, 0.2], [-0.3, 0.4], [0.1, 0.5]]) {
    g.beginPath(); g.arc(cx + dx * r, cy + dy * r, r * 0.09, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#d33';                       // tiny necktie
  g.beginPath(); g.moveTo(cx - r * 0.12, cy + r * 0.62); g.lineTo(cx + r * 0.12, cy + r * 0.62);
  g.lineTo(cx + r * 0.18, cy + r * 1.05); g.lineTo(cx, cy + r * 1.2); g.lineTo(cx - r * 0.18, cy + r * 1.05); g.closePath(); g.fill();
}

export function createBoard(scene, { x, z }) {
  const root = new THREE.Group();
  scene.add(root);
  const disposables = [];

  // ---------- The Board ----------
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  disposables.push(tex);

  const BW = 6, BH = 3, BOTTOM = 3.5, cy = BOTTOM + BH / 2;
  const boardMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), boardMat);
  front.position.set(0, cy, 0.06);            // faces +z (stand side)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), boardMat);
  back.position.set(0, cy, -0.06); back.rotation.y = Math.PI;   // faces -z (the field), un-mirrored
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x20242c });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.2, BH + 0.2, 0.1), frameMat);
  frame.position.set(0, cy, 0);
  root.add(frame, front, back);
  for (const sx of [-2.6, 2.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, BOTTOM + 0.2, 0.16), frameMat);
    post.position.set(sx, (BOTTOM + 0.2) / 2, 0); root.add(post);
  }
  root.position.set(x, 0, z);
  disposables.push(boardMat, frameMat, front.geometry, back.geometry, frame.geometry);

  let s = null;                // last state
  let key = '';
  let flipT = 0, flipAcc = 0;
  const prev = { bv: '', quota: '', banner: '' };
  const flipping = { bv: false, quota: false, banner: false };

  function fit(text, font, maxW, px) {         // shrink font until the text fits
    g.font = font(px);
    while (g.measureText(text).width > maxW && px > 10) { px -= 2; g.font = font(px); }
    return px;
  }

  function bar(bx, by, bw, bh, v, color) {
    g.fillStyle = '#0b0d11'; g.fillRect(bx, by, bw, bh);
    g.fillStyle = color; g.fillRect(bx + 2, by + 2, (bw - 4) * clamp01(v), bh - 4);
    g.strokeStyle = '#4a4f5a'; g.lineWidth = 2; g.strokeRect(bx, by, bw, bh);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1;
    for (let i = 1; i < 10; i++) { const tx = bx + bw * i / 10; g.beginPath(); g.moveTo(tx, by + 2); g.lineTo(tx, by + bh - 2); g.stroke(); }
  }

  function draw() {
    const st = s; if (!st) return;
    const flipP = 1 - flipT / FLIP_TIME;      // 0 -> 1 across the flip
    const show = (name, text) => flipping[name] ? scramble(text, flipP) : text;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#12151b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b1f27'; g.fillRect(0, 0, W, 76);
    g.fillStyle = '#e8b04a'; g.fillRect(0, 76, W, 3);

    // header
    drawDimples(g, 48, 34, 24);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = '#f2ead3'; g.font = `700 34px ${SANS}`;
    g.fillText('FAIRWAY HOLDINGS · BALL VALUE', 88, 40);
    if (st.title) {
      g.textAlign = 'right'; g.fillStyle = '#e8b04a';
      const px = fit(String(st.title).toUpperCase(), p => `600 ${p}px ${SANS}`, 300, 24);
      g.font = `600 ${px}px ${SANS}`; g.fillText(String(st.title).toUpperCase(), W - 24, 40);
    }

    // BV big
    g.textAlign = 'left';
    const bvText = money(st.bv);
    g.fillStyle = '#1d2129'; g.fillRect(24, 96, 560, 170);
    g.fillStyle = '#f5e6b8';
    const bpx = fit(show('bv', bvText), p => `700 ${p}px ${MONO}`, hustleShown(st) ? 360 : 530, 160);
    g.font = `700 ${bpx}px ${MONO}`; g.textBaseline = 'alphabetic';
    g.fillText(show('bv', bvText), 40, 96 + 170 - 28);
    g.fillStyle = '#7d8594'; g.font = `600 22px ${SANS}`; g.textBaseline = 'middle';
    g.fillText('BALL VALUE', 36, 108);
    if (hustleShown(st)) {
      g.fillStyle = '#6fd36f'; g.textAlign = 'right'; g.font = `700 56px ${MONO}`;
      g.fillText('×' + st.hustle.toFixed(2), 572, 130);
      g.font = `600 18px ${SANS}`; g.fillStyle = '#7d8594'; g.fillText('HUSTLE', 572, 170);
    }
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `600 24px ${MONO}`;
    g.fillStyle = '#6fd36f'; g.fillText(`+${money(st.rate)}/s`, 40, 284);
    g.fillStyle = '#e06a5a'; g.fillText(`UPKEEP -${money(st.upkeep)}/s`, 250, 284);

    // gauges (right column)
    const gx = 612, gw = 388;
    const gauges = [['CURB APPEAL', st.curb, '#6fd36f'], ['POND CLARITY', st.pond, '#4fb3e8'], ['FRY SATISFACTION', st.fries, '#f0a93a']];
    gauges.forEach(([label, v, color], i) => {
      const gy = 98 + i * 58;
      g.textAlign = 'left'; g.font = `600 20px ${SANS}`;
      g.fillStyle = v == null ? '#4a4f5a' : '#cfc8b0'; g.textBaseline = 'alphabetic';
      g.fillText(label, gx, gy + 18);
      if (v != null) { g.textAlign = 'right'; g.font = `700 20px ${MONO}`; g.fillText(Math.round(clamp01(v) * 100) + '%', gx + gw, gy + 18); }
      bar(gx, gy + 24, gw, 24, v == null ? 0 : v, color);
      if (v == null) {
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#6b7180'; g.font = `600 15px ${SANS}`;
        g.fillText('COMING SOON — CORPORATE', gx + gw / 2, gy + 36);
      }
    });

    // target
    g.textBaseline = 'middle';
    const hasQuota = st.quota != null;
    g.textAlign = 'left'; g.font = `700 30px ${MONO}`;
    g.fillStyle = hasQuota ? '#f5e6b8' : '#4a4f5a';
    g.fillText(hasQuota ? show('quota', 'TARGET ' + money(st.quota)) : 'TARGET  --', 24, 322);
    const tx = 360, tw = 640;
    bar(tx, 308, tw, 28, hasQuota ? st.bv / Math.max(st.quota, 0.0001) : 0, '#e8b04a');
    if (hasQuota) {
      const mx = tx + tw - 4;                 // quota marks the bar's end; the bar is BV / quota
      g.fillStyle = '#e03a3a'; g.fillRect(mx - 3, 300, 6, 44);
    }

    // outstanding
    g.fillStyle = '#1d2129'; g.fillRect(24, 358, W - 48, 72);
    g.textAlign = 'left'; g.fillStyle = '#7d8594'; g.font = `600 26px ${SANS}`;
    g.fillText('BALLS OUTSTANDING', 44, 394);
    g.textAlign = 'right'; g.fillStyle = '#f5e6b8'; g.font = `700 56px ${MONO}`;
    g.fillText(commas(st.outstanding), W - 44, 396);

    // banner
    let banner = '', bcol = '#e8b04a', bg = '#1b1f27', fg = '#8f98a8';
    if (st.lastCall) { banner = 'LAST CALL'; bg = '#d98a12'; fg = '#1a1203'; }
    else if (st.gary) { banner = String(st.gary); bg = '#9c1f1f'; fg = '#ffe9e6'; }
    else { banner = 'EVERY BALL MATTERS.™'; }
    void bcol;
    g.fillStyle = bg; g.fillRect(24, 444, W - 48, 50);
    g.textAlign = 'center'; g.fillStyle = fg;
    const shown = show('banner', banner);
    const px = fit(shown, p => `700 ${p}px ${MONO}`, W - 80, 34);
    g.font = `700 ${px}px ${MONO}`; g.fillText(shown, W / 2, 470);

    tex.needsUpdate = true;
  }
  const hustleShown = st => st.hustle > 1;

  function bannerOf(st) { return st.lastCall ? 'LAST CALL' : st.gary ? String(st.gary) : 'SLOGAN'; }

  // ---------- The Ball Silo ----------
  const SILO_H = 2.5, SILO_R = 0.5;
  const silo = new THREE.Group();
  silo.position.set(2.5, 0, 0);               // 2.5 m to the side of the board/stand
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(SILO_R, SILO_R, SILO_H, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0.25, roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false }));
  tube.position.y = SILO_H / 2; tube.renderOrder = 2;
  const metal = new THREE.MeshLambertMaterial({ color: 0x3a4250 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(SILO_R + 0.06, SILO_R + 0.08, 0.1, 40), metal);
  base.position.y = 0.05;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(SILO_R + 0.05, SILO_R + 0.05, 0.1, 40), metal);
  cap.position.y = SILO_H + 0.05;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), new THREE.MeshLambertMaterial({ color: 0xe8b04a }));
  knob.position.y = SILO_H + 0.14;
  silo.add(tube, base, cap, knob);

  // Deterministic packing: concentric rings per layer, ring-offset per layer, seeded jitter.
  const rand = mulberry32(0xBA11);
  const slots = [];
  const ringR = [0, 0.1, 0.2, 0.3, 0.4];
  const ringN = [1, 6, 12, 18, 25];
  const perLayer = ringN.reduce((a, b) => a + b, 0);
  const layers = Math.ceil(SILO_MAX / perLayer);
  const y0 = 0.1 + BALL_R, usable = SILO_H - 0.1 - 2 * BALL_R - 0.02;
  const dy = usable / (layers - 1);
  for (let L = 0; L < layers && slots.length < SILO_MAX; L++) {
    const twist = L * 0.7;
    for (let r = 0; r < ringR.length; r++) {
      for (let k = 0; k < ringN[r] && slots.length < SILO_MAX; k++) {
        const a = twist * (r + 1) + (k / ringN[r]) * Math.PI * 2 + (rand() - 0.5) * 0.12;
        const rr = ringR[r] + (r ? (rand() - 0.5) * 0.015 : 0);
        slots.push([Math.cos(a) * rr, y0 + L * dy + (rand() - 0.5) * 0.012, Math.sin(a) * rr]);
      }
    }
  }
  const ballGeo = new THREE.SphereGeometry(BALL_R, 10, 8);
  const ballMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const balls = new THREE.InstancedMesh(ballGeo, ballMat, SILO_MAX);
  const m4 = new THREE.Matrix4();
  slots.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); balls.setMatrixAt(i, m4); });
  balls.instanceMatrix.needsUpdate = true;
  balls.count = 0; balls.frustumCulled = false;
  silo.add(balls);
  root.add(silo);
  disposables.push(ballGeo, ballMat, tube.geometry, tube.material, base.geometry, cap.geometry, metal, knob.geometry, knob.material);

  // ---------- Floating text ----------
  const floats = [];
  function floatText(fx, fy, fz, text, color = '#ffffff') {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x2 = c.getContext('2d');
    x2.font = `700 38px ${SANS}`; x2.textAlign = 'center'; x2.textBaseline = 'middle';
    x2.lineJoin = 'round'; x2.lineWidth = 8; x2.strokeStyle = 'rgba(15,12,25,0.85)';
    const t = String(text);
    let px = 38; while (x2.measureText(t).width > 240 && px > 14) { px -= 2; x2.font = `700 ${px}px ${SANS}`; }
    x2.strokeText(t, 128, 34); x2.fillStyle = color; x2.fillText(t, 128, 34);
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map, depthTest: false, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(1.6, 0.4, 1); sp.position.set(fx, fy, fz); sp.renderOrder = 11;
    scene.add(sp);
    floats.push({ sp, mat, map, y0: fy, t: 0 });
  }

  // ---------- API ----------
  function update(state) {
    // silo
    const n = Math.min(SILO_MAX, Math.max(0, Math.floor(state.silo || 0)));
    if (balls.count !== n) balls.count = n;

    // board
    const k = [
      money(state.bv), money(state.rate), money(state.upkeep), state.hustle > 1 ? state.hustle.toFixed(2) : '-',
      state.curb == null ? 'x' : Math.round(clamp01(state.curb) * 100),
      state.pond == null ? 'x' : Math.round(clamp01(state.pond) * 100),
      state.fries == null ? 'x' : Math.round(clamp01(state.fries) * 100),
      state.quota == null ? 'x' : money(state.quota), commas(state.outstanding),
      state.lastCall ? 'L' : '', state.gary || '', state.title || ''
    ].join('|');
    if (k === key) return;
    key = k;
    const next = { bv: money(state.bv), quota: state.quota == null ? '' : money(state.quota), banner: bannerOf(state) };
    if (s) {                                   // no flip on the very first draw
      for (const f of ['bv', 'quota', 'banner']) if (next[f] !== prev[f]) { flipping[f] = true; flipT = FLIP_TIME; }
    }
    Object.assign(prev, next);
    s = state;
    draw();
  }

  function tick(dt) {
    if (flipT > 0) {
      flipT -= dt; flipAcc += dt;
      if (flipT <= 0) { flipT = 0; flipping.bv = flipping.quota = flipping.banner = false; flipAcc = 0; draw(); }
      else if (flipAcc >= FLIP_STEP) { flipAcc = 0; draw(); }
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.t += dt;
      const u = f.t / FLOAT_TIME;
      if (u >= 1) {
        scene.remove(f.sp); f.map.dispose(); f.mat.dispose(); floats.splice(i, 1);
        continue;
      }
      f.sp.position.y = f.y0 + FLOAT_RISE * (1 - (1 - u) * (1 - u));
      f.mat.opacity = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45;
    }
  }

  return { update, floatText, tick };
}
