// End of the day: the walk-off, drawn (the rules and numbers are in dusk.js). After the bell's stamp the camera
// lifts out of first person to a high three-quarter view, every ball still out there glows (one Points, one draw
// call, sized by the perf tier), "142 left out there" sits on the bottom edge, and the crew and the hired
// teenagers walk off to the car park. Then the report card. The walkers are stand-ins built here (cached per id):
// the real avatars in main.js are only hidden, never moved, so the next clock-in has nothing stale to undo.
//
//   const dusk = createDusk({ scene, camera, me, others, balls, crew, buildPerson, animatePerson, perf, settings, fpGear, myGear });
//   const end = dusk.queue({ at: stampUntil, ending, onDone });   // performance.now() ms the card may open, or null
//   dusk.tick(dt);   // every frame, after everything else has placed the camera
//   dusk.stop();     // a new shift (or the lobby): everything back as it was
// Owner playtest 3 §2: from 1:00 (the snapshot's `closing`) the same label shows live on the top edge and counts down
// as the crew picks: the cleanup minute's scoreboard. The walk-off then shows the final number as before.
import * as THREE from 'three';
import { DUSK, duskPlan, duskStage, camPath, leftOut, outThere, leftLine, glowBudget, holdEnd, walkRoute, walkAt, padEdge } from './dusk.js';
import { detailFor } from './detail.js';

const idSeed = id => [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);   // main.js addMate's seed

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,235,1)'); g.addColorStop(0.25, 'rgba(255,230,150,0.85)'); g.addColorStop(1, 'rgba(255,190,90,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createDusk({ scene, camera, me, others, balls, crew, buildPerson, animatePerson, perf, settings, fpGear, myGear }) {
  let run = null, glow = null, label = null, veil = null;
  const figs = new Map();                      // id -> people.js figure (kept between days)
  const root = new THREE.Group(); root.name = 'dusk'; root.visible = false; scene.add(root);
  const endQ = new THREE.Quaternion(), mtx = new THREE.Matrix4(), eye = new THREE.Vector3(), look = new THREE.Vector3();
  mtx.lookAt(eye.set(DUSK.END.x, DUSK.END.y, DUSK.END.z), look.set(DUSK.LOOK.x, DUSK.LOOK.y, DUSK.LOOK.z), new THREE.Vector3(0, 1, 0));
  endQ.setFromRotationMatrix(mtx);

  // A report or end card is open (playthrough 4 C7): the 'left out there' label must not draw over it.
  const cardUp = () => { const r = document.getElementById('report'); return (!!r && !r.classList.contains('hidden')) || !!document.getElementById('endcard'); };
  function el(css) { const d = document.createElement('div'); d.style.cssText = css; d.setAttribute('aria-live', 'polite'); document.body.appendChild(d); return d; }

  function buildGlow(budget) {
    if (glow && glow.userData.max === budget.max) return glow;
    if (glow) { root.remove(glow); glow.geometry.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(budget.max * 3), 3));
    geo.setDrawRange(0, 0);
    glow = new THREE.Points(geo, new THREE.PointsMaterial({ size: budget.size, map: glow?.material.map ?? glowTexture(), transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    glow.frustumCulled = false; glow.renderOrder = 5; glow.userData.max = budget.max;
    root.add(glow);
    return glow;
  }
  function fillGlow() {
    const pos = glow.geometry.attributes.position, max = glow.userData.max;
    let i = 0;
    for (const b of balls.values()) {
      if (!outThere(b) || i >= max) continue;
      pos.setXYZ(i++, b.x, (b.y ?? 0) + 0.35, b.z);
    }
    pos.needsUpdate = true; glow.geometry.setDrawRange(0, i);
  }

  // The walkers: every Rat in view (not driving, not diving) and every hired teenager; you, where you stood.
  function walker(id, opts, from, n, delay) {
    let p = figs.get(id);
    if (!p) {
      p = buildPerson({ seed: idSeed(id), staff: true, shirt: opts.shirt });
      p.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      figs.set(id, p); root.add(p.root);
    }
    p.root.scale.setScalar(opts.helper ? 0.88 : 1);
    p.setCarry?.(opts.carry ?? 'none');
    p.root.visible = true;
    p.root.position.set(from.x, 0, from.z); p.root.rotation.y = from.yaw ?? 0;
    return { id, p, route: walkRoute(from, n), d: 0, delay, yaw: from.yaw ?? 0, gone: false };
  }
  function gather(plan) {
    const out = [], c = crew(), hidden = [];
    const color = id => { const s = c.players?.find(p => p.id === id)?.color; return s ? parseInt(s.slice(1), 16) : 0xb9c0c8; };
    let n = 0;
    for (const [id, o] of others) {
      if (!o.g.visible) continue;                // drivers are in their carts, divers are the boil, the offline are gone
      hidden.push(o);
      out.push(walker(id, { shirt: color(id), helper: o.helper, carry: o.helper ? 'tube' : 'none' },
        { x: o.g.position.x, z: o.g.position.z, yaw: o.body.rotation.y }, n++, 0.15 * n));
    }
    if (plan.cam && me.id && !me.diving && fpGear.visible !== false) {   // fpGear hides while you drive or dive
      out.push(walker(me.id, { shirt: color(me.id) }, { x: me.x, z: me.z, yaw: me.yaw }, n++, DUSK.ME_WALK_AT - DUSK.WALK_AT));
    }
    return { walkers: out, hidden };
  }

  function makeLabel() {
    label = label ?? el('position:fixed;left:50%;top:11%;transform:translateX(-50%);padding:0.45em 1.1em;border-radius:1em;'
      + 'background:rgba(20,16,32,0.72);color:#ffe7a8;font:600 1.35em system-ui,sans-serif;letter-spacing:0.02em;pointer-events:none;'
      + 'z-index:30;opacity:0;transition:opacity 0.5s;white-space:nowrap');
    return label;
  }
  let liveT = 0, liveOn = false;
  function live(dt) {
    const c = crew(), on = c?.phase === 'shift' && !!c.closing && !cardUp();
    if (!on) { if (liveOn) { liveOn = false; if (label) label.style.opacity = '0'; } return; }
    if (!liveOn || (liveT -= dt) <= 0) { liveT = 0.5; makeLabel().textContent = leftLine(leftOut(balls)); }
    if (!liveOn) { liveOn = true; label.style.opacity = '1'; }
  }

  function begin() {
    liveOn = false;
    const plan = run.plan, budget = glowBudget(detailFor(perf?.profile));
    run.from = { pos: camera.position.clone(), quat: camera.quaternion.clone() };
    run.budget = budget;
    Object.assign(run, gather(plan));
    buildGlow(budget); fillGlow(); run.fillT = 0.5;
    run.count = leftOut(balls);
    root.visible = true;
    makeLabel().textContent = leftLine(run.count);
    if (!plan.cam) veil = veil ?? el('position:fixed;inset:0;background:#120d24;pointer-events:none;z-index:29;opacity:0');
    run.pads = padState();
    addEventListener('keydown', onSkip, true); addEventListener('pointerdown', onSkip, true);
    run.t = 0;
  }
  function padState() {
    const out = [];
    for (const g of navigator.getGamepads?.() ?? []) if (g) for (const b of g.buttons) out.push(!!b.pressed);
    return out;
  }
  function onSkip(e) {
    if (!run || run.t < 0 || run.finished) return;
    e.preventDefault(); e.stopImmediatePropagation();
    skip();
  }
  function skip() { if (run && !run.finished) { run.t = Math.max(run.t, run.plan.secs); step(0); } }
  function unlisten() { removeEventListener('keydown', onSkip, true); removeEventListener('pointerdown', onSkip, true); }

  // The beat is over: the card opens. The overhead view and the walkers stay behind the card until the next shift.
  function finish() {
    if (run.finished) return;
    run.finished = true; unlisten(); clearTimeout(run.safety);
    if (label) label.style.opacity = '0';
    if (veil) veil.style.opacity = '0';
    const done = run.onDone; run.onDone = null; done?.();
  }

  function step(dt) {
    const plan = run.plan, s = duskStage(run.t, plan);
    if (plan.cam) {
      const c = camPath(run.t, run.from.pos, DUSK.END);
      camera.position.set(c.x, c.y, c.z);
      camera.quaternion.copy(run.from.quat).slerp(endQ, c.w);
    }
    fpGear.visible = false;
    if (plan.cam) myGear.visible = false;
    for (const o of run.hidden) o.g.visible = false;   // applySnapshot shows them again each tick; the stand-ins walk instead
    for (const w of run.walkers) {
      if (w.gone) continue;
      const go = (w.id === me.id ? s.meWalk : s.walk) && run.t >= DUSK.WALK_AT + w.delay;
      if (go) {
        w.d += DUSK.WALK_SPEED * dt;
        const at = walkAt(w.route, w.d);
        if (at.done) { w.gone = true; w.p.root.visible = false; continue; }   // in the car
        const dy = Math.atan2(Math.sin(at.yaw - w.yaw), Math.cos(at.yaw - w.yaw));
        w.yaw += Math.sign(dy) * Math.min(Math.abs(dy), 6 * dt);
        w.p.root.position.set(at.x, 0, at.z); w.p.root.rotation.y = w.yaw;
      }
      animatePerson(w.p, dt, go ? { mode: 'walk', speed: DUSK.WALK_SPEED } : { mode: 'idle' });
    }
    if ((run.fillT -= dt) <= 0) { run.fillT = 0.5; fillGlow(); run.count = leftOut(balls); if (label) label.textContent = leftLine(run.count); }
    const b = run.budget, pulse = b.pulse ? 1 + 0.22 * Math.sin(run.t * 4.2) : 1;
    glow.material.opacity = 0.9 * s.glow;
    glow.material.size = b.size * pulse * (plan.cam ? 1 : 0.3);
    if (!run.finished) {
      if (label) label.style.opacity = s.label && !cardUp() ? '1' : '0';   // playthrough 4 B/C7: never over the report card
      if (veil) veil.style.opacity = String(s.dim);
      if (s.done) finish();
      else if (plan.cam || run.pads) {
        const now = padState();
        if (padEdge(run.pads, now)) skip();
        run.pads = now;
      }
    }
  }

  return {
    // Arm the beat for when the stamp's hold ends (`at`, performance.now ms). Returns when the card may open, or null.
    queue({ at = 0, ending = false, rejoin = false, onDone = null } = {}) {
      this.stop();
      const plan = duskPlan({ ending, rejoin, reduceMotion: !!settings?.()?.reduceMotion });
      if (!plan.run) return null;
      const end = holdEnd(performance.now(), at, plan);
      run = { plan, at: Math.max(performance.now(), at), t: -1, onDone, finished: false, walkers: [], hidden: [] };
      // rAF stalls in a hidden tab: the card must still open on time.
      run.safety = setTimeout(() => { if (run && !run.finished) { if (run.t < 0) begin(); skip(); } }, end - performance.now() + 400);
      return end;
    },
    tick(dt) {
      if (!run) { live(Math.min(dt, 0.1)); return; }
      if (run.t < 0) { if (performance.now() < run.at) return; begin(); }
      else run.t += Math.min(dt, 0.1);
      step(Math.min(dt, 0.1));
    },
    skip,
    stop() {
      if (!run) return;
      clearTimeout(run.safety); unlisten();
      for (const o of run.hidden) o.g.visible = true;   // the next snapshot sets the real rule again
      for (const w of run.walkers) w.p.root.visible = false;
      root.visible = false;
      if (label) label.style.opacity = '0';
      if (veil) veil.style.opacity = '0';
      run = null; liveOn = false;
    },
    get active() { return !!run; },
    get state() { return run ? { t: run.t, finished: run.finished, count: run.count, walkers: run.walkers.length, cam: run.plan.cam } : null; },
  };
}
