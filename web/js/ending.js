// "The Last Bucket" ending visuals (design/council-round2.md §4.8).
// Ball No. 1 mesh + trail, landing thump, huddle banner, $∞ finale, end card.
// No top-level DOM access: everything is created lazily inside createEnding().
import * as THREE from 'three';

export const FINAL_MEMO = 'There are no more balls. Site 12 belongs to the Range Rats. Every Ball Mattered.™';

const TRAIL_N = 48;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeColor = c => (/^#[0-9a-f]{3,8}$/i.test(c) || /^[a-z]+$/i.test(c) ? c : '#fff8ec');

const CSS = `
#ending-flash { position: fixed; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none; z-index: 40;
  font-size: clamp(48px, 14vmin, 220px); font-weight: 900; color: #ffe9a8; letter-spacing: 0.04em;
  text-shadow: 0 0 0.25em #ffb347, 0 0 0.7em #ffb347aa, 0 0.05em 0.2em #000a; transition: opacity 0.6s; }
#ending-flash small { display: block; font-size: 0.22em; letter-spacing: 0.3em; color: #fff8ec; }
#ending-glow { position: fixed; inset: 0; pointer-events: none; z-index: 39; opacity: 0;
  background: radial-gradient(circle at 50% 55%, rgba(255, 236, 170, 0.75), rgba(255, 179, 71, 0.25) 45%, rgba(255, 179, 71, 0) 75%); }
#ending-huddle { position: fixed; top: 9%; left: 50%; transform: translateX(-50%); z-index: 30; pointer-events: none; text-align: center;
  background: rgba(28, 22, 40, 0.86); color: #fff8ec; border: 0.12em solid #ffb347; border-radius: 0.5em; padding: 0.3em 1em;
  font-size: clamp(16px, min(5vmin, 4.2vw), 64px); font-weight: 800; letter-spacing: 0.08em; text-shadow: 0 0.06em 0.25em #000a; max-width: calc(100vw - 32px);
  white-space: nowrap; }
#ending-huddle b { color: #ffb347; }
#endcard { z-index: 85; background: linear-gradient(rgba(14, 12, 28, 0.82), rgba(14, 12, 28, 0.95)); }
#endcard .sheet { min-width: min(calc(100vw - 32px), 30em); }
#endcard .sheet h1 { margin: 0 0 0.2em; color: #ffb347; font-size: 2.2em; text-align: center; }
#endcard .rat { display: flex; justify-content: space-between; gap: 2em; margin: 0.35em 0; font-size: 1.15em; }
#endcard .rat span { color: var(--dim, #e8d6bd); font-weight: 500; text-align: right; }
#endcard .tot { display: flex; justify-content: space-between; gap: 2em; margin: 0.3em 0; }
#endcard .tot b { color: #ffb347; }
#endcard .zero { font-size: 1.6em; color: #ffb347; margin-top: 0.5em; text-align: center; letter-spacing: 0.04em; }
#endcard .sig { color: var(--dim, #e8d6bd); font-weight: 500; font-size: 0.85em; text-align: center; }
`;

function ballTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff3c4'; g.fillRect(0, 0, 512, 256);
  // dimples
  g.fillStyle = 'rgba(190, 150, 60, 0.28)';
  for (let y = 8; y < 256; y += 16) for (let x = ((y / 16) % 2) * 8; x < 512; x += 16) { g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#6b4a10'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 54px Georgia, serif';
  // text on both halves of the equirect map so it reads from either side
  for (const cx of [128, 384]) {
    g.fillText('FHI · 1958', cx, 128);
    g.font = '700 22px Georgia, serif'; g.fillText('BALL No. 1', cx, 176); g.font = '800 54px Georgia, serif';
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createEnding({ scene, root, camera }) {
  const parent = root ?? scene;
  const group = new THREE.Group(); group.name = 'ending'; parent.add(group);
  let styleEl = null;
  const ensureStyle = () => {
    if (styleEl || typeof document === 'undefined') return;
    styleEl = document.createElement('style'); styleEl.textContent = CSS; document.head.appendChild(styleEl);
  };

  // ---- Ball No. 1 ----
  let ball = null, trail = null, trailPos = null, trailCol = null, trailAge = null, trailHead = 0;
  const lastP = new THREE.Vector3(); let haveLast = false, trailFade = 0;
  function makeBall() {
    const tex = ballTexture();
    const mat = new THREE.MeshStandardMaterial({ color: 0xfff1c0, map: tex, emissive: 0xffd878, emissiveMap: tex, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.1 });
    ball = new THREE.Mesh(new THREE.SphereGeometry(0.13, 32, 20), mat); // ~3× a normal ball
    ball.visible = false; ball.name = 'ball-one'; group.add(ball);
    const light = new THREE.PointLight(0xffd878, 6, 14, 2); ball.add(light); ball.userData.light = light;
    trailPos = new Float32Array(TRAIL_N * 3); trailCol = new Float32Array(TRAIL_N * 3); trailAge = new Float32Array(TRAIL_N).fill(99);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
    trail = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.5, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    trail.frustumCulled = false; group.add(trail);
  }
  function ballOne(x, y, z) {
    if (!ball) makeBall();
    ball.visible = true; ball.position.set(x, y, z);
    if (haveLast && lastP.distanceToSquared(ball.position) > 0.0004) {
      const i = trailHead; trailHead = (trailHead + 1) % TRAIL_N;
      trailPos[i * 3] = lastP.x; trailPos[i * 3 + 1] = lastP.y; trailPos[i * 3 + 2] = lastP.z; trailAge[i] = 0;
      trailFade = 1;
    }
    lastP.copy(ball.position); haveLast = true;
  }
  function hideBall() { if (ball) ball.visible = false; haveLast = false; }

  // ---- landing: shake + dust ring ----
  let shakeT = 0; const SHAKE = 0.6; const shake = new THREE.Vector3();
  const dust = [];
  function land() {
    shakeT = SHAKE;
    const p = ball ? ball.position : new THREE.Vector3();
    const m = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48),
      new THREE.MeshBasicMaterial({ color: 0xe8d6bd, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.06, p.z); group.add(m);
    dust.push({ m, t: 0 });
  }

  // ---- huddle banner ----
  let huddleEl = null;
  function huddle(n, of) {
    if (n == null) { if (huddleEl) huddleEl.classList.add('hidden'); return; }
    ensureStyle();
    if (!huddleEl) { huddleEl = document.createElement('div'); huddleEl.id = 'ending-huddle'; huddleEl.setAttribute('role', 'status'); document.body.appendChild(huddleEl); }
    huddleEl.classList.remove('hidden');
    huddleEl.innerHTML = typeof n === 'string' ? n : `ALL TO THE STAND · <b>${n} / ${of}</b>`;
  }

  // ---- finale ----
  let flashEl = null, glowEl = null, glowT = 0, finaleTimers = [];
  // afterFlash: called once the digits fade (playthrough 4 C3: the last PA card queues there, never on top of them).
  function finale(stats = {}, afterFlash = null) {
    ensureStyle(); huddle(null);
    finaleTimers.forEach(clearTimeout); finaleTimers = [];
    const after = (ms, fn) => finaleTimers.push(setTimeout(fn, ms));
    if (!flashEl) { flashEl = document.createElement('div'); flashEl.id = 'ending-flash'; flashEl.setAttribute('aria-live', 'polite'); document.body.appendChild(flashEl); }
    if (!glowEl) { glowEl = document.createElement('div'); glowEl.id = 'ending-glow'; document.body.appendChild(glowEl); }
    flashEl.style.opacity = '1'; flashEl.classList.remove('hidden');
    const FINAL = '$∞ / BALL', GLYPHS = '0123456789$%#&@?!';
    const t0 = performance.now();
    const iv = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / 1500);
      // characters settle left to right; the rest scramble
      const settled = Math.floor(k * FINAL.length);
      let s = '';
      for (let i = 0; i < FINAL.length; i++) s += (i < settled || FINAL[i] === ' ' || k >= 1) ? FINAL[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      flashEl.innerHTML = `${esc(s)}<small>FAIRWAY HOLDINGS INTERNATIONAL · BALL VALUE</small>`;
      if (k >= 1) clearInterval(iv);
    }, 50);
    finaleTimers.push(iv);
    glowT = 0.0001; // starts the golden pulse in tick()
    // memo, after the digits settle
    return new Promise(resolve => {
      after(1600, () => {
        flashEl.style.opacity = '0';
        afterFlash?.();
        const memo = document.getElementById('memo'), txt = document.getElementById('memo-text'), tgt = document.getElementById('memo-target');
        // One text at a time (playtest 2): the PA card speaks the final line; no memo on top of it.
        void txt; void tgt;
        after(6000, () => {
          void memo;   // the say() queue owns #memo (round 7): never hide it from here
          if (flashEl) flashEl.classList.add('hidden');
          resolve();
        });
      });
    });
  }

  // ---- end card ----
  let cardEl = null;
  function endCard(stats = {}, onClockIn) {
    ensureStyle();
    if (cardEl) cardEl.remove();
    const players = stats.players ?? [];
    cardEl = document.createElement('div');
    cardEl.id = 'endcard'; cardEl.className = 'card';
    const lines = players.map(p => `<div class="rat" style="color:${safeColor(p.color)}"><b>${esc(p.name)}</b>
      <span>${p.banked ?? 0} ball${p.banked === 1 ? '' : 's'} · $${Math.round(p.cash ?? 0).toLocaleString('en-US')} · ${p.knockdowns ?? 0} knockdowns</span></div>`).join('');
    cardEl.innerHTML = `<div class="sheet">
      <h1>Site 12 is yours</h1>
      <div class="sig">Range Rats, a final report for Fairway Holdings International</div>
      ${lines}
      <div class="tot"><span>Days worked</span><b>${stats.days ?? 0}</b></div>
      <div class="tot"><span>Balls banked</span><b>${stats.banked ?? 0}</b></div>
      <div class="tot"><span>Commendations</span><b>${stats.commendations ?? 0}</b></div>
      <div class="tot"><span>Quotas hit</span><b>${stats.quotas ?? 0}</b></div>
      <div class="zero">Balls Outstanding: 0.</div>
    </div>
    <div class="row"><button type="button" id="clock-in">Clock in tomorrow</button></div>`;
    document.body.appendChild(cardEl);
    const btn = cardEl.querySelector('#clock-in');
    btn.addEventListener('click', () => { if (typeof onClockIn === 'function') onClockIn(); });
    setTimeout(() => btn.focus(), 0);
    return cardEl;
  }

  // ---- per-frame ----
  function tick(dt) {
    if (ball?.visible) { ball.rotation.y += dt * 1.5; ball.userData.light.intensity = 5 + Math.sin(performance.now() * 0.01); }
    if (trail) {
      let any = false;
      for (let i = 0; i < TRAIL_N; i++) {
        trailAge[i] += dt;
        const f = Math.max(0, 1 - trailAge[i] / 1.2);
        trailCol[i * 3] = f; trailCol[i * 3 + 1] = f * 0.85; trailCol[i * 3 + 2] = f * 0.4;
        if (f > 0) any = true;
      }
      trail.geometry.attributes.position.needsUpdate = true; trail.geometry.attributes.color.needsUpdate = true;
      trail.visible = any;
    }
    for (let i = dust.length - 1; i >= 0; i--) {
      const d = dust[i]; d.t += dt; const k = d.t / 1.4;
      d.m.scale.setScalar(1 + k * 18); d.m.material.opacity = Math.max(0, 0.8 * (1 - k));
      if (k >= 1) { group.remove(d.m); d.m.geometry.dispose(); d.m.material.dispose(); dust.splice(i, 1); }
    }
    if (glowT > 0 && glowEl) {
      glowT += dt; const k = glowT / 2.4;
      glowEl.style.opacity = k >= 1 ? '0' : String(Math.sin(k * Math.PI) * 0.9);
      if (k >= 1) glowT = 0;
    }
    if (shakeT > 0) {
      shakeT = Math.max(0, shakeT - dt); const a = (shakeT / SHAKE) ** 2 * 0.45;
      shake.set((Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * 2 * a, (Math.random() - 0.5) * a);
    } else shake.set(0, 0, 0);
    return shake;
  }

  return { ballOne, hideBall, land, huddle, finale, endCard, tick };
}
