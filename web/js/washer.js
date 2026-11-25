// The ball washer station (council round 2, section 4.4): the classic range pedestal washer
// at WASHER, with a crank handle on each side, a hopper of dirty balls, a brush drum, and a
// clear chute on to the bank's silo (owner layout: the pipe from the return feeds its hopper). Client visuals
// plus a pure-logic crank input helper.
// No top-level side effects: everything happens inside createWasher().
import * as THREE from 'three';
import { WASHER_YAW, SIGN_BY_ID, yawOf, tagSign } from './signs.js';
import { WASHER, SILO } from './sim.js';
import { washerBoard } from './hoppertext.js';   // round 11: the board in plain words
import { siloLevelY } from './layout.js';        // round 11: clean balls drop to the silo's fill

export const WASHER_POS = { x: WASHER.x, z: WASHER.z };
// Where a Rat stands to crank: about 0.9 m out from each side of the box.
export const HANDLES = { L: { x: WASHER_POS.x - 1.4, z: WASHER_POS.z }, R: { x: WASHER_POS.x + 1.4, z: WASHER_POS.z } };

// Washed balls leave by the back (world +z, the bank side) and run into the silo's side, low down.
const SILO_IN = (() => { const dx = SILO.x - WASHER.x, dz = SILO.z - (WASHER.z + 0.45), d = Math.hypot(dx, dz);
  return { x: SILO.x - dx / d * (SILO.R + 0.02), y: 0.85, z: SILO.z - dz / d * (SILO.R + 0.02) }; })();
const HEAP_MAX = 80;
const CHUTE_POOL = 10;
const SUDS_POOL = 8;
const TAU = Math.PI * 2;
const lambert = (color, extra) => new THREE.MeshLambertMaterial({ color, ...(extra || {}) });

// ---------------------------------------------------------------- crank input helper (pure logic)
export function createCrank(onTick) {
  const MAX_TPS = 2.5, SLOW_TPS = 1, MOUSE_R = 60, MOUSE_MIN = 20, STICK_MIN = 0.5;
  const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
  let stickAng = null, mx = 0, my = 0, mouseAng = null;
  let pending = 0, fed = false, quarters = 0;

  const c = {
    active: false,
    side: null,
    begin(side) {
      c.active = true; c.side = side === 'R' ? 'R' : 'L';
      stickAng = null; mouseAng = null; mx = 0; my = 0; pending = 0; fed = false; quarters = 0;
    },
    end() {
      c.active = false; c.side = null;
      stickAng = null; mouseAng = null; pending = 0; fed = false;
    },
    feedStick(x, y) {
      if (!c.active) return;
      if (Math.hypot(x, y) <= STICK_MIN) { stickAng = null; return; }
      const a = Math.atan2(y, x);
      if (stickAng !== null) {
        const d = Math.abs(wrap(a - stickAng)) / TAU;
        if (d > 0) { pending += d; fed = true; }
      }
      stickAng = a;
    },
    feedMouse(dx, dy) {
      if (!c.active) return;
      mx += dx; my += dy;
      const len = Math.hypot(mx, my);
      if (len > MOUSE_R) { mx *= MOUSE_R / len; my *= MOUSE_R / len; }
      if (Math.hypot(mx, my) < MOUSE_MIN) { mouseAng = null; return; }
      const a = Math.atan2(my, mx);
      if (mouseAng !== null) {
        const d = Math.abs(wrap(a - mouseAng)) / TAU;
        if (d > 0) { pending += d; fed = true; }
      }
      mouseAng = a;
    },
    // Returns the turns this frame (1 turn = 1 ball). Rotation is capped at 2.5 turns/s; with the
    // handle held and no rotation, a slow crank of 1 turn/s (the accessibility path).
    step(dt) {
      if (!c.active) { pending = 0; fed = false; return 0; }
      let turns;
      if (fed || pending > 0) turns = Math.min(pending, MAX_TPS * dt);
      else turns = SLOW_TPS * dt;
      pending = 0; fed = false;
      const before = quarters;
      quarters += turns * 4;
      const n = Math.floor(quarters) - Math.floor(before);
      if (n > 0 && onTick) for (let i = 0; i < n; i++) onTick(c.side);
      if (quarters > 1e6) quarters -= Math.floor(quarters);
      return turns;
    },
  };
  return c;
}

// ---------------------------------------------------------------- the station
export function createWasher(scene, opts = {}) {
  const crank = createCrank(opts.onTick);
  const g = new THREE.Group();
  g.position.set(WASHER_POS.x, 0, WASHER_POS.z);
  // The front (+z here: window, drum, UNWASHED board) faces the field, so the group turns by WASHER_YAW (pi).
  // That puts local -x on the world's +x side: `out` below maps a world side (-1 = L) to local x.
  g.rotation.y = WASHER_YAW;
  const out = Math.cos(WASHER_YAW) < 0 ? -1 : 1;
  scene.add(g);

  const green = lambert(0x2e7d4f), darkGreen = lambert(0x1f5a38), steel = lambert(0x9aa3ad);
  const glassMat = new THREE.MeshLambertMaterial({ color: 0xbfe6f2, transparent: true, opacity: 0.35 });

  // Post and base plate.
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.9), darkGreen);
  base.position.y = 0.04; g.add(base);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.9, 0.36), green);
  post.position.y = 0.53; post.castShadow = true; g.add(post);

  // Box top, with a window onto the brush drum on the front (+z).
  const boxTop = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.7), green);
  boxTop.position.y = 1.2; boxTop.castShadow = true; g.add(boxTop);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.34, 0.02), darkGreen);
  frame.position.set(0, 1.2, 0.356); g.add(frame);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 14), lambert(0x3b6fb8));
  drum.rotation.z = Math.PI / 2; drum.position.set(0, 1.2, 0.2); g.add(drum);
  // Bristles: a few stripes so the drum's spin is visible.
  for (let i = 0; i < 6; i++) {
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.03), lambert(0xf2c94c));
    const a = (i / 6) * TAU;
    br.position.set(0, Math.sin(a) * 0.14, Math.cos(a) * 0.14);
    br.rotation.x = -a;
    drum.add(br);
  }
  const window_ = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), glassMat);
  window_.position.set(0, 1.2, 0.368); g.add(window_);

  // Funnel hopper on top: an open cone, wide at the top.
  const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.12, 0.42, 16, 1, true),
    new THREE.MeshLambertMaterial({ color: 0x2e7d4f, side: THREE.DoubleSide }));
  funnel.position.y = 1.7; g.add(funnel);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.025, 6, 20), steel);
  rim.rotation.x = Math.PI / 2; rim.position.y = 1.91; g.add(rim);

  // The heap of dirty balls: up to 80 instances, mounded inside the funnel.
  const ballR = 0.062;
  const heap = new THREE.InstancedMesh(new THREE.SphereGeometry(ballR, 8, 6), lambert(0x6b4a2b), HEAP_MAX);
  heap.frustumCulled = false;
  heap.count = 0;
  g.add(heap);
  // Precompute a mound: ring layers from the funnel floor up, wide at the bottom, narrow at the top.
  const slots = [];
  {
    let layer = 0;
    while (slots.length < HEAP_MAX && layer < 12) {
      const ringR = Math.max(0, 0.33 - layer * 0.032);
      const count = layer === 0 ? 9 : Math.max(1, Math.round((TAU * ringR) / (ballR * 2.1)));
      const rr = ringR;
      for (let i = 0; i < count && slots.length < HEAP_MAX; i++) {
        const a = (i / count) * TAU + layer * 0.7;
        slots.push({ x: Math.cos(a) * rr * (layer === 0 ? 0.8 : 1), y: layer, z: Math.sin(a) * rr * (layer === 0 ? 0.8 : 1) });
      }
      layer++;
    }
    while (slots.length < HEAP_MAX) slots.push({ x: 0, y: layer, z: 0 });
  }
  const _m = new THREE.Matrix4();
  function layoutHeap(n) {
    const visible = Math.min(HEAP_MAX, Math.max(0, Math.round(n)));
    heap.count = visible;
    // Height grows with n: the mound is compressed when n is small and rises as it fills.
    const hs = 0.55 + 0.45 * Math.min(1, n / 200);
    for (let i = 0; i < visible; i++) {
      const s = slots[i];
      _m.makeTranslation(s.x, 1.55 + ballR + s.y * ballR * 1.45 * hs + 0.03, s.z);
      heap.setMatrixAt(i, _m);
    }
    heap.instanceMatrix.needsUpdate = true;
  }
  layoutHeap(0);

  // Crank handles, one each side: an axle through the box side, an arm, and a knob.
  const handleRigs = {};
  for (const [side, wx] of [['L', -1], ['R', 1]]) {   // L on the world's -x side (sim.js WASHER_HANDLES)
    const sx = wx * out;
    const rig = new THREE.Group();
    rig.position.set(sx * 0.5, 1.2, 0.0);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 8), steel);
    axle.rotation.z = Math.PI / 2; axle.position.x = sx * 0.04; rig.add(axle);
    const arm = new THREE.Group();
    arm.position.x = sx * 0.1;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.045), steel);
    bar.position.y = 0.13; arm.add(bar);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.14, 8), lambert(0xd9382b));
    knob.rotation.z = Math.PI / 2; knob.position.set(sx * 0.07, 0.28, 0); arm.add(knob);
    rig.add(arm);
    g.add(rig);
    handleRigs[side] = { arm, ang: 0 };
  }

  // Sign above: BALL WASHER.
  {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#1d4d2f'; x.fillRect(0, 0, 256, 64);
    x.strokeStyle = '#fff8ec'; x.lineWidth = 3; x.strokeRect(3, 3, 250, 58);
    x.fillStyle = '#fff8ec'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = 'bold 34px system-ui, sans-serif'; x.fillText('BALL WASHER', 128, 34);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    // Two single-sided faces (a DoubleSide plane reads mirrored from behind), the front angled toward the path
    // and the drop-in spot (signs.js 'washer.sign'). Yaws are world yaws less the group's.
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.225), new THREE.MeshLambertMaterial({ map: tex }));
    sign.position.set(0, 2.3, 0); sign.rotation.y = yawOf(SIGN_BY_ID['washer.sign'].normal) - WASHER_YAW; g.add(tagSign(sign, 'washer.sign'));
    const signBack = tagSign(sign.clone(), 'washer.sign.back'); signBack.rotation.y += Math.PI; g.add(signBack);
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), steel);
    bracket.position.set(0, 2.1, 0); g.add(bracket);
  }

  // The front board: UNWASHED n . $credit, amber above 100.
  const boardCanvas = document.createElement('canvas'); boardCanvas.width = 256; boardCanvas.height = 64;
  const bctx = boardCanvas.getContext('2d');
  const boardTex = new THREE.CanvasTexture(boardCanvas); boardTex.colorSpace = THREE.SRGBColorSpace;
  const boardMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.155), new THREE.MeshBasicMaterial({ map: boardTex }));
  boardMesh.position.set(0, 0.85, 0.19); g.add(tagSign(boardMesh, 'washer.board'));
  let lastN = -1, lastCredit = -1;
  // Round 11: two plain lines (hoppertext.js): "34 DIRTY BALLS" / "WAITING TO WASH · +$68".
  function drawBoard(n, credit) {
    const b = washerBoard(n, credit);
    bctx.fillStyle = '#14181c'; bctx.fillRect(0, 0, 256, 64);
    bctx.strokeStyle = b.amber ? '#f2a516' : '#3c7a52'; bctx.lineWidth = 4; bctx.strokeRect(2, 2, 252, 60);
    bctx.fillStyle = b.amber ? '#ffb629' : '#d8f3e2';
    bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
    bctx.font = 'bold 26px system-ui, sans-serif';
    bctx.fillText(b.top, 128, 24);
    bctx.font = '600 14px system-ui, sans-serif';
    bctx.fillText(b.sub, 128, 50);
    boardTex.needsUpdate = true;
  }
  drawBoard(0, 0);

  // The clear chute: a tube along a sagging curve from the back of the box to the silo (stations.js finds it by
  // its first point).
  const chuteStart = new THREE.Vector3(WASHER_POS.x, 1.05, WASHER_POS.z + 0.45);
  const chuteEnd = new THREE.Vector3(SILO_IN.x, SILO_IN.y, SILO_IN.z);
  const mid = new THREE.Vector3().lerpVectors(chuteStart, chuteEnd, 0.5); mid.y -= 0.12;
  const curve = new THREE.CatmullRomCurve3([chuteStart, new THREE.Vector3().lerpVectors(chuteStart, chuteEnd, 0.2).add(new THREE.Vector3(0, -0.12, 0)), mid,
    new THREE.Vector3().lerpVectors(chuteStart, chuteEnd, 0.8).add(new THREE.Vector3(0, -0.02, 0)), chuteEnd]);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.095, 8, false),
    new THREE.MeshLambertMaterial({ color: 0xcfeaf5, transparent: true, opacity: 0.28, side: THREE.DoubleSide }));
  scene.add(tube);
  const chuteBalls = [];
  const cbGeo = new THREE.SphereGeometry(0.06, 10, 8), cbMat = lambert(0xffffff);
  for (let i = 0; i < CHUTE_POOL; i++) {
    const m = new THREE.Mesh(cbGeo, cbMat);
    m.visible = false; scene.add(m);
    chuteBalls.push({ mesh: m, t: 0, delay: 0, on: false, fall: 0 });
  }
  const _p = new THREE.Vector3();

  // Suds: a few white puffs rising from the drum window.
  const sudsMat = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const sudsGeo = new THREE.SphereGeometry(0.06, 8, 6);
  const suds = [];
  for (let i = 0; i < SUDS_POOL; i++) {
    const m = new THREE.Mesh(sudsGeo, sudsMat());
    m.visible = false; g.add(m);
    suds.push({ mesh: m, life: 0, max: 1, vx: 0, vy: 0, vz: 0 });
  }
  function puff(count) {
    let made = 0;
    for (const s of suds) {
      if (made >= count) break;
      if (s.life > 0) continue;
      s.life = s.max = 0.6 + Math.random() * 0.4;
      s.vx = (Math.random() - 0.5) * 0.3; s.vy = 0.35 + Math.random() * 0.3; s.vz = 0.1 + Math.random() * 0.2;
      s.mesh.position.set((Math.random() - 0.5) * 0.4, 1.35, 0.3);
      s.mesh.scale.setScalar(0.6 + Math.random() * 0.6);
      s.mesh.visible = true;
      made++;
    }
  }

  // ------------------------------------------------------------ state and animation
  const st = { n: 0, credit: 0, auto: false, L: false, R: false, rateL: 0, rateR: 0 };
  let drumAng = 0, siloY = siloLevelY(400);
  const CHUTE_SECS = 1.1;

  return {
    crank,
    // Round 11: the silo's banked supply (basket.js siloFill), so washed balls drop to its level.
    silo(n) { siloY = siloLevelY(n); },
    update(state) {
      if (!state) return;
      st.n = state.n ?? 0; st.credit = state.credit ?? 0; st.auto = !!state.auto;
      st.L = !!state.L; st.R = !!state.R; st.rateL = state.rateL || 0; st.rateR = state.rateR || 0;
      if (st.n !== lastN) layoutHeap(st.n);
      if (st.n !== lastN || Math.round(st.credit) !== lastCredit) {
        drawBoard(Math.max(0, Math.round(st.n)), st.credit);
        lastN = st.n; lastCredit = Math.round(st.credit);
      }
    },
    // k balls were just washed: send them down the chute, staggered, and puff suds.
    washed(k) {
      const want = Math.max(0, Math.min(k | 0, CHUTE_POOL));
      let launched = 0;
      for (const b of chuteBalls) {
        if (launched >= want) break;
        if (b.on) continue;
        b.on = true; b.t = 0; b.fall = 0; b.delay = launched * 0.09; b.mesh.visible = false;
        launched++;
      }
      puff(Math.min(3, 1 + (k > 2 ? 1 : 0) + (k > 6 ? 1 : 0)));
    },
    tick(dt) {
      // Drum: spins with the cranking, and steadily when automated.
      const rate = st.rateL + st.rateR + (st.auto ? 1.2 : 0);
      drumAng += (0.6 + rate * 2.5) * TAU * dt * (rate > 0 ? 1 : 0.15);
      drum.rotation.x = drumAng;
      // Handles spin at their rate (turns/s), idle ones sit still.
      for (const side of ['L', 'R']) {
        const h = handleRigs[side];
        const r = side === 'L' ? st.rateL : st.rateR;
        const sign = side === 'L' ? 1 : -1;   // mirrored so both crank the same way from outside
        h.ang += sign * r * TAU * dt;
        h.arm.rotation.x = h.ang * out;       // same world spin whichever way the group faces
      }
      // Chute balls ride the curve, then (round 11) drop inside the clear silo down to its fill.
      for (const b of chuteBalls) {
        if (!b.on) continue;
        if (b.delay > 0) { b.delay -= dt; if (b.delay > 0) continue; }
        b.mesh.visible = true;
        if (b.t < 1) {
          b.t = Math.min(1, b.t + dt / CHUTE_SECS);
          curve.getPoint(b.t * b.t * 0.4 + b.t * 0.6, _p);
          b.mesh.position.copy(_p);
          continue;
        }
        b.fall += dt;
        const k = Math.min(1, b.fall * 3) * 0.6, y = chuteEnd.y - 4.9 * b.fall * b.fall;
        if (y <= siloY || b.fall > 0.8) { b.on = false; b.mesh.visible = false; continue; }
        b.mesh.position.set(chuteEnd.x + (SILO.x - chuteEnd.x) * k, y, chuteEnd.z + (SILO.z - chuteEnd.z) * k);
      }
      // Suds.
      for (const s of suds) {
        if (s.life <= 0) continue;
        s.life -= dt;
        if (s.life <= 0) { s.mesh.visible = false; s.mesh.material.opacity = 0; continue; }
        const k = s.life / s.max;
        s.mesh.position.x += s.vx * dt; s.mesh.position.y += s.vy * dt; s.mesh.position.z += s.vz * dt;
        s.mesh.material.opacity = 0.8 * k;
        s.mesh.scale.multiplyScalar(1 + dt * 0.8);
      }
    },
  };
}
