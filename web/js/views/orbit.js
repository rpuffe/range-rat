// The Orbital (venue 5), client side: the ride up, the spacewalk, the debris, the tether (council round 4, §3.4,
// build item 9). The rules are web/js/orbit.js (pure) and the server half is server/venues/orbit.mjs; the visor,
// the breathing and the O2 gauge are createEva() in scuba.js (the dive code, reused).
//
//   * The Lift: Ⓧ on the platform. The car rises with you in it (venues.js parts.carY), the camera climbs from 1.7 m
//     to 120 m over 5 s, the sky fades to stars, an Earth limb curves in and the fog pushes out.
//   * The EVA: you float in an 11 m disc round the car (WASD / left stick, with a little inertia), Ⓐ grabs the nearest
//     debris within 2.2 m, a tether line runs back to the car, Ⓧ rides down. A buddy on the platform cranks your O2
//     (tap Ⓐ / click, or circle the right stick).
//   * Everyone sees the car go up, and the debris ring (slowly tumbling) above the Lift.
import * as THREE from 'three';
import { ORBIT, LIFT, debrisSpot, rideHeight, spaceness, clampDisc, atLift, evaSwim } from '../orbit.js';
import { diveTiers } from '../dive.js';
import { perks } from '../sim.js';
import { createEva } from '../scuba.js';
import * as SET from '../settings.js';

const PH = ['up', 'out', 'down'];
const SPACE_TOP = new THREE.Color(0x00020a), SPACE_MID = new THREE.Color(0x070618), SPACE_HORIZON = new THREE.Color(0x5a3552);
const TETHER_SEGS = 26;
const FIELD_YAW = Math.atan2(-(0 - LIFT.x), -(-60 - LIFT.z));   // the yaw that faces the middle of the range from the Lift
// Either stick feeds the crank: whichever is pushed further.
export const padStick = pad => !pad ? [0, 0] : Math.hypot(pad.rx ?? 0, pad.ry ?? 0) >= Math.hypot(pad.lx ?? 0, pad.ly ?? 0) ? [pad.rx ?? 0, pad.ry ?? 0] : [pad.lx ?? 0, pad.ly ?? 0];
const clamp01 = v => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// A ring of stars on a sphere (colour-varied), a faint band for the Milky Way, and a few bright ones.
function makeStars() {
  let s = 20260, r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const pts = (n, size, band) => {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      let u = r() * 2 - 1, a = r() * Math.PI * 2, y = u;
      if (band) { y = (r() + r() + r() - 1.5) * 0.28; u = y; }       // squeezed round a tilted great circle
      const rad = Math.sqrt(Math.max(0, 1 - y * y)), R = 1650;
      let x = Math.cos(a) * rad * R, z = Math.sin(a) * rad * R, yy = y * R;
      if (band) { const t = 0.9, cy = Math.cos(t), sy = Math.sin(t); const y2 = yy * cy - z * sy, z2 = yy * sy + z * cy; yy = y2; z = z2; }
      pos.set([x, yy, z], i * 3);
      const k = r(); c.setHSL(k < 0.15 ? 0.58 : k < 0.3 ? 0.08 : 0.12, k < 0.3 ? 0.5 : 0.1, band ? 0.5 : 0.7 + r() * 0.3);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false });
    const p = new THREE.Points(g, m); p.frustumCulled = false; p.renderOrder = -0.5;
    return p;
  };
  const group = new THREE.Group();
  const small = pts(1500, 1.6, false), bright = pts(140, 3.2, false), band = pts(2600, 1.3, true);
  band.userData.base = 0.45;
  group.add(small, bright, band);
  group.visible = false;
  return { group, small, bright, band };
}

// The Earth limb: a big dark sphere under the range (so the horizon curves away) and a thin additive atmosphere shell.
function makeEarth() {
  const R = 5200;
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), new THREE.MeshBasicMaterial({ color: 0x1b2a2a, fog: false }));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R + 90, 96, 48), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); f = pow(f, 3.2); vec3 c = mix(vec3(0.95,0.5,0.28), vec3(0.3,0.55,1.0), smoothstep(0.55, 1.0, f)); gl_FragColor = vec4(c * f * 1.35, f); }',
  }));
  g.add(ball, shell); g.visible = false; g.position.y = -R - 2;
  return { group: g, R };
}

export default {
  id: 'orbit',
  venue: 5,
  create(ctx) {
    const { scene, camera, me } = ctx;
    const root = new THREE.Group(); root.name = 'orbit'; scene.add(root);
    const stars = makeStars(); scene.add(stars.group);
    const earth = makeEarth(); scene.add(earth.group);

    // ---- the debris ring: golf balls with a red band, instanced, tumbling round the top of the Lift
    const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshStandardMaterial({ color: 0xf4f4f0, roughness: 0.5, emissive: 0x30302c }), ORBIT.CAP);
    const bandMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.205, 0.03, 6, 20), new THREE.MeshStandardMaterial({ color: 0xd9382b, emissive: 0x5a0e08 }), ORBIT.CAP);
    ballMesh.userData.k = -1;
    for (const m of [ballMesh, bandMesh]) { m.count = 0; m.frustumCulled = false; root.add(m); }
    // A faint sparkle over each, so the ring reads from the ground too.
    const glintPts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xfff6dc, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false, fog: false }));
    const glintPos = new Float32Array(ORBIT.CAP * 3);
    glintPts.geometry.setAttribute('position', new THREE.BufferAttribute(glintPos, 3)); glintPts.geometry.setDrawRange(0, 0); glintPts.frustumCulled = false;
    root.add(glintPts);

    // ---- the tether: little cylinders strung from the car to your suit
    const tether = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.022, 0.022, 1, 5), new THREE.MeshBasicMaterial({ color: 0xffc058 }), TETHER_SEGS);
    tether.visible = false; tether.frustumCulled = false; root.add(tether);
    const clip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe9b0 })); clip.visible = false; root.add(clip);

    const eva = createEva({ audio: ctx.SFX?.audioHandle });
    const tmp = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1), p: new THREE.Vector3(), e: new THREE.Euler(),
      a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), c: new THREE.Color() };

    let snap = null;                       // s.mods.orbit: { d: [ids], r: { id: [ph, t, air, bag] }, p, w }
    let ids = [];
    let ph = null, rt = 0, air = 0, bag = 0;   // my ride, from the snapshot, with the clock run on locally
    let wasRiding = false, v = { x: 0, z: 0 }, carY = 1.5, pumpUntil = 0, latched = false, lastAng = null, turnAcc = 0, turnSend = 0, heldSend = 0;
    const hidden = new Set();                // first-person gear on the camera: out of sight while you're up there
    let speed01 = 0, fov0 = camera.fov, fovOn = false, shake = 0, clock = 0;
    const baseFog = { near: 120, far: 900 };

    const mine = () => ph != null;
    const someoneOut = () => { for (const k in snap?.r ?? {}) if (k !== me.id && snap.r[k][0] === 1) return true; return false; };
    const reach = () => (me.x - LIFT.x) ** 2 + (me.z - LIFT.z) ** 2;
    const canRide = () => ctx.playing() && ctx.crew()?.phase === 'shift' && me.down <= 0 && !ctx.driving() && atLift(me, 2.4);
    const kitCap = () => diveTiers(me.dive).bag;

    function enter() {                      // the helmet goes on
      wasRiding = true; eva.setOn(true); v.x = v.z = 0;
      me.x = LIFT.x; me.z = LIFT.z; shake = 1;
    }
    function leave() {                      // back on the grass
      wasRiding = false; eva.setOn(false);
      for (const c of hidden) c.visible = true;
      hidden.clear();
      me.x = LIFT.x + 1.6; me.z = LIFT.z + 0.4;
      if (fovOn) { camera.fov = fov0; camera.updateProjectionMatrix(); fovOn = false; }
    }

    return {
      show(on) { root.visible = on; if (!on) { stars.group.visible = false; earth.group.visible = false; } },

      onSnapshot(s, m) {
        snap = m ?? null;
        ids = m?.d ?? [];
        const r = m?.r?.[me.id];
        if (r) {
          if (ph == null) { ph = PH[r[0]]; rt = r[1]; }
          else if (PH[r[0]] !== ph) { ph = PH[r[0]]; rt = r[1]; }
          else if (Math.abs(rt - r[1]) > 0.2) rt = r[1];
          air = r[2]; bag = r[3];
        } else if (ph != null) ph = null;
      },

      onEvent(e) {
        if (e.t === 'lift' && e.id !== me.id) ctx.feed?.(`${ctx.nameOf(e.id)} rides the Lift ${e.dir === 'up' ? 'up' : 'down'}`);
        else if (e.t === 'grabbed' && e.id === me.id) ctx.SFX?.ping?.();
        else if (e.t === 'reel' && e.id === me.id) { ctx.toast('The tether reels you in.', 3); ctx.SFX?.bonk?.(); }
        else if (e.t === 'landed' && e.id === me.id) ctx.toast(e.n > 0 ? `Back on the grass: ${e.n} debris in your pocket` : 'Back on the grass. Empty-handed.', 3);
        else if (e.t === 'winch') ctx.SFX?.ping?.();
      },

      prompt(btn, ibtn) {
        if (mine()) {
          if (ph === 'out') return `${btn}  Grab debris (${bag}/${kitCap()})   ${ibtn}  Ride down`;
          return ph === 'up' ? 'Riding the Lift...' : 'Riding down...';
        }
        if (latched) return `Cranking their oxygen: circle either stick   ${btn} or Ⓑ  Let go`;
        if (!canRide()) return null;
        return someoneOut() ? `Tap ${btn} to crank their oxygen   ${ibtn}  Ride the Lift` : `${ibtn}  Ride the Lift`;
      },
      interact() {
        if (mine()) { if (ph === 'out') ctx.act({ t: 'ridedown' }); return true; }
        if (!canRide()) return false;
        ctx.act({ t: 'lift' }); return true;
      },
      use(fromPad) {
        if (mine()) { if (ph === 'out') ctx.act({ t: 'grab' }); return true; }
        if (latched) { latched = false; return true; }     // a second tap lets go
        if (!someoneOut() || !atLift(me, 3.4)) return false;
        if (fromPad) { latched = true; lastAng = null; turnAcc = 0; return true; }   // the pad latches the crank (like the dock pump)
        pumpUntil = clock + 1.2; return true;          // a tap keeps the crank held for a moment
      },
      unlatch() { if (!latched) return false; latched = false; return true; },     // Ⓑ
      lockLook() { return latched; },                    // the camera stays put while you crank
      capturing() { return mine() || latched; },
      amb() { return mine() ? { underwater: true, crowd: 0, nearField: 0 } : null; },
      reportLines(r) { return r?.debris ? [`Debris retrieved: ${r.debris}`] : []; },

      tick(dt, t) {
        clock += dt;
        const riding = mine();
        if (riding && !wasRiding) enter();
        if (!riding && wasRiding) leave();

        // ---- my ride: the clock, the float
        let h = 0, k = 0;
        if (riding) {
          for (const c of camera.children) if ((c.isGroup || c.isMesh) && c.visible) { hidden.add(c); c.visible = false; }   // (main.js re-shows its own each frame)
          if (ph !== 'out') rt = Math.min(ORBIT.RIDE, rt + dt); else rt += dt;
          h = rideHeight(ph, rt);
          k = spaceness(h);
          if (ph === 'out') this._float(dt);
          else { me.x = LIFT.x; me.z = LIFT.z; }
          if (ph === 'out') air = Math.max(0, air - dt);      // run the O2 clock on between snapshots
          // the ride takes your eyes to the range; the mouse and stick can still look about
          if (ph !== 'out') {
            const kk = 1 - Math.exp(-dt * 1.4);
            let dy = FIELD_YAW - me.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
            me.yaw += dy * kk; me.pitch += (-0.2 - 0.5 * k - me.pitch) * kk;
          }
          const tier = diveTiers(me.dive);
          eva.tick(dt, t, { air01: tier.air ? air / tier.air : 1, secs: air, ph, speed01, space01: k });
        }

        // ---- the car: it follows the highest rider (the snapshot's riders, mine from the local clock)
        let want = 1.5;
        for (const id in snap?.r ?? {}) {
          const r = snap.r[id];
          const hh = id === me.id && riding ? h : rideHeight(PH[r[0]], r[1]);
          want = Math.max(want, hh - 0.2);
        }
        carY += (want - carY) * (want > carY ? Math.min(1, dt * 14) : Math.min(1, dt * 14));
        if (ctx.venues) ctx.venues.carY = carY;

        // ---- the sky: stars, the Earth limb, the fog (after main.js set the daytime sky this frame)
        const space = k;
        if (space <= 0.01 && scene.fog && !stars.group.visible) { baseFog.near = scene.fog.near; baseFog.far = scene.fog.far; }
        else if (space <= 0.01 && scene.fog) { scene.fog.near = baseFog.near; scene.fog.far = baseFog.far; }
        if (space > 0.01 || stars.group.visible) {   // (the last frame back down puts the fog and the stars away)
          const u = ctx.sky?.sky?.material?.uniforms;
          if (u) { u.top.value.lerp(SPACE_TOP, space); u.mid.value.lerp(SPACE_MID, space); u.horizon.value.lerp(SPACE_HORIZON, space * 0.8); }
          if (scene.fog) {
            scene.fog.far = lerp(baseFog.far, 3000, space); scene.fog.near = lerp(baseFog.near, 700, space);
            scene.fog.color.lerp(SPACE_HORIZON, space * 0.55);
          }
          const sOp = smooth(0.2, 0.85, space);
          stars.group.visible = sOp > 0.01; earth.group.visible = space > 0.25;
          const tw = 0.9 + 0.1 * Math.sin(t * 2.3);
          stars.small.material.opacity = sOp * tw; stars.bright.material.opacity = sOp; stars.band.material.opacity = sOp * stars.band.userData.base;
          stars.group.position.copy(camera.position); stars.group.rotation.y = t * 0.004;
          earth.group.position.x = camera.position.x; earth.group.position.z = camera.position.z;
        }

        // ---- the debris ring: tumbling, with a little bob
        const n = Math.min(ids.length, ORBIT.CAP);
        const near = riding || reach() < 150 * 150;
        ballMesh.count = bandMesh.count = n;
        if (n && (near || (clock * 8 | 0) !== (ballMesh.userData.k | 0))) {     // far away: refresh a few times a second
          ballMesh.userData.k = clock * 8 | 0;
          for (let i = 0; i < n; i++) {
            const id = ids[i], s = debrisSpot(id), tt = t * 0.35 + id;
            tmp.p.set(LIFT.x + s.x, ORBIT.TOP + s.y + Math.sin(t * 0.5 + id * 1.3) * 0.18, LIFT.z + s.z);
            tmp.e.set(tt * 0.7, tt, tt * 0.4); tmp.q.setFromEuler(tmp.e);
            ballMesh.setMatrixAt(i, tmp.m.compose(tmp.p, tmp.q, tmp.s));
            bandMesh.setMatrixAt(i, tmp.m);
            glintPos[i * 3] = tmp.p.x; glintPos[i * 3 + 1] = tmp.p.y; glintPos[i * 3 + 2] = tmp.p.z;
          }
          ballMesh.instanceMatrix.needsUpdate = bandMesh.instanceMatrix.needsUpdate = true;
          glintPts.geometry.attributes.position.needsUpdate = true;
        }
        glintPts.geometry.setDrawRange(0, n);
        glintPts.material.opacity = 0.55 + 0.25 * Math.sin(t * 3);

        // ---- the tether
        const showTether = riding && ph === 'out';
        tether.visible = clip.visible = showTether;
        if (showTether) this._tether(t);

        // ---- the crank: a held tap, and the right stick circled (the pond's pump rules, server side)
        this._crank(dt);
      },

      // Drifting: WASD / the left stick with some inertia, inside the disc.
      _float(dt) {
        if (!ctx.playing() || me.down > 0) return;
        const keys = ctx.keys, pad = ctx.pad?.();
        let fx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + (pad?.lx ?? 0);
        let fz = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0) + (pad?.ly ?? 0);
        const m = Math.hypot(fx, fz); if (m > 1) { fx /= m; fz /= m; }
        const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
        const sp = perks(ctx.crew()?.up).walk * evaSwim(diveTiers(me.dive));
        const tx = (fx * cy + fz * sy) * sp, tz = (-fx * sy + fz * cy) * sp, ease = 1 - Math.exp(-dt * (m > 0.05 ? 3.2 : 1.6));
        v.x += (tx - v.x) * ease; v.z += (tz - v.z) * ease;
        me.x += v.x * dt; me.z += v.z * dt;
        clampDisc(me);
        speed01 = clamp01(Math.hypot(v.x, v.z) / Math.max(0.1, sp));
        me.yaw += ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * 2.2 * dt;
        me.pitch = Math.max(-1.4, Math.min(1.2, me.pitch + ((keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)) * 1.5 * dt));
      },

      // A slack line from the car to your suit: it drifts, loops when you're close, and goes taut at the edge of the disc.
      _tether(t) {
        const ax = LIFT.x, ay = ORBIT.TOP - 1.0, az = LIFT.z;
        const bx = me.x, by = ORBIT.TOP - 0.75 + Math.sin(t * 0.8) * 0.06, bz = me.z;
        const len = Math.hypot(bx - ax, bz - az), slack = (1 - clamp01(len / ORBIT.R)) * 1.6 + 0.15;
        let px = ax, py = ay, pz = az;
        const nx = len > 0.01 ? -(bz - az) / len : 1, nz = len > 0.01 ? (bx - ax) / len : 0;
        for (let i = 1; i <= TETHER_SEGS; i++) {
          const s = i / TETHER_SEGS, bow = Math.sin(Math.PI * s) * slack;
          const qx = lerp(ax, bx, s) + nx * bow * Math.sin(t * 0.6 + s * 4.0) * 0.8;
          const qy = lerp(ay, by, s) - bow * 0.7 + Math.sin(t * 0.9 + s * 5) * bow * 0.25;
          const qz = lerp(az, bz, s) + nz * bow * Math.sin(t * 0.6 + s * 4.0) * 0.8;
          tmp.a.set(px, py, pz); tmp.b.set(qx, qy, qz);
          const d = tmp.a.distanceTo(tmp.b) || 0.001;
          tmp.p.copy(tmp.a).add(tmp.b).multiplyScalar(0.5);
          tmp.q.setFromUnitVectors(tmp.up, tmp.b.sub(tmp.a).normalize());
          tmp.s.set(1, d * 1.04, 1);
          tether.setMatrixAt(i - 1, tmp.m.compose(tmp.p, tmp.q, tmp.s));
          px = qx; py = qy; pz = qz;
        }
        tmp.s.set(1, 1, 1);
        tether.instanceMatrix.needsUpdate = true;
        clip.position.set(ax, ay, az);
      },

      // Buddies on the platform: a tap of Ⓐ holds the crank for a moment; circling the right stick sends whole turns.
      _crank(dt) {
        if (mine() || !snap || !someoneOut() || !atLift(me, 3.4) || !ctx.playing()) { lastAng = null; turnAcc = 0; latched = false; return; }
        heldSend -= dt; turnSend -= dt;
        const pad = ctx.pad?.();
        const [sx, sy] = padStick(pad);
        if (pad && Math.hypot(sx, sy) > 0.5) {
          const a = Math.atan2(sy, sx);
          if (lastAng != null) { let d = a - lastAng; d = Math.atan2(Math.sin(d), Math.cos(d)); turnAcc += Math.abs(d) / (Math.PI * 2); }
          lastAng = a;
        } else lastAng = null;
        if (turnAcc > 0.02 && turnSend <= 0) { ctx.act({ t: 'orbpump', turns: Math.min(1, turnAcc) }); turnAcc = 0; turnSend = 0.1; heldSend = 0.25; }
        else if (clock < pumpUntil && heldSend <= 0) { ctx.act({ t: 'orbpump', held: true }); heldSend = 0.25; }
      },

      // main.js calls this after its own camera: the height, and a little rumble on the way up.
      camera(cam, dt) {
        if (!mine()) return false;
        const h = rideHeight(ph, rt);
        const calm = SET.get().reduceMotion;
        cam.position.y = h + (ph === 'out' ? Math.sin(clock * 0.7) * 0.05 : 0);
        if (ph !== 'out') {
          cam.position.x = LIFT.x; cam.position.z = LIFT.z;
          const moving = smooth(0, 0.25, rt / ORBIT.RIDE) * (1 - smooth(0.75, 1, rt / ORBIT.RIDE));   // fastest mid-ride
          if (!calm) {
            const a = 0.012 * moving * (1 - spaceness(h) * 0.8);
            cam.position.x += Math.sin(clock * 53) * a; cam.position.y += Math.sin(clock * 47) * a;
            cam.fov = fov0 + 10 * moving; cam.updateProjectionMatrix(); fovOn = true;
          }
        } else if (fovOn) { cam.fov = fov0; cam.updateProjectionMatrix(); fovOn = false; }
        return true;
      },
    };
  },
};
