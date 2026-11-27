// Council round 13 8.6 (builder 4): a screen-edge chevron toward a world point for a few seconds (the huddle call:
// "Huddle! Pip, surface!"). It runs its own requestAnimationFrame only while it shows; one reused element and vector.
import * as THREE from 'three';

const CSS = `#edge-chev { position: fixed; z-index: 24; pointer-events: none; font-size: 2.6em; font-weight: 900; color: #ffcf5a;
  text-shadow: 0 0 0.25em #000c; transform-origin: 50% 50%; opacity: 0; transition: opacity 0.2s; }
#edge-chev.on { opacity: 1; }`;

export function createEdgeChevron({ camera, doc = typeof document !== 'undefined' ? document : null }) {
  let el = null, until = 0, tx = 0, tz = 0, raf = 0;
  const v = new THREE.Vector3();
  function ensure() {
    if (el || !doc) return el;
    const st = doc.createElement('style'); st.textContent = CSS; doc.head.appendChild(st);
    el = doc.createElement('div'); el.id = 'edge-chev'; el.textContent = '➤'; doc.body.appendChild(el);
    return el;
  }
  function step() {
    raf = 0;
    if (!el) return;
    const now = performance.now() / 1000;
    if (now > until) { el.classList.remove('on'); return; }
    v.set(tx, 1, tz).project(camera);
    let dx = v.x, dy = -v.y;
    if (v.z > 1) { dx = -dx; dy = -dy; }               // behind the camera: point the other way
    const ang = Math.atan2(dy, dx), w = innerWidth, h = innerHeight, m = 48;
    const k = Math.min((w / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(ang))), (h / 2 - m) / Math.max(1e-6, Math.abs(Math.sin(ang))));
    const onScreen = v.z <= 1 && Math.abs(v.x) < 0.85 && Math.abs(v.y) < 0.85;
    const x = onScreen ? (v.x + 1) / 2 * w : w / 2 + Math.cos(ang) * k, y = onScreen ? (1 - v.y) / 2 * h - 40 : h / 2 + Math.sin(ang) * k;
    el.style.left = (x - 18) + 'px'; el.style.top = (y - 22) + 'px';
    el.style.transform = `rotate(${onScreen ? 90 : ang * 180 / Math.PI}deg)`;
    el.classList.add('on');
    raf = requestAnimationFrame(step);
  }
  return {
    show(x, z, secs = 3) {
      if (!ensure()) return;
      tx = x; tz = z; until = performance.now() / 1000 + secs;
      if (!raf) raf = requestAnimationFrame(step);
    },
  };
}
