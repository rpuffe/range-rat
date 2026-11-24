// The crowd: the client's view of the customer lifecycle (see customers.js).
// It never decides anything. Each snapshot hands it the per-mat states; every
// frame it places each customer from custPos(state, t0, t) and drives a people.js
// figure: walk with a bucket, grab it at the stand, set it down, swing when the mat
// fires a ball, sulk on a refusal, walk out.
//
// Budget: at most `maxFull` full people.js figures (the nearest ones), the rest are
// lite capsules. Nothing casts a shadow. Full figures animate every frame within
// `nearM` metres of the camera and every third frame beyond.
//
//   const crowd = createCrowd({ scene, people: { buildPerson, animatePerson, SWING_IMPACT, SWING_SECS } });
//   crowd.sync(snap.mats, snap.ct);          // on every snapshot (cheap)
//   crowd.update(dt, camera);                // every frame
//   crowd.onMatShot(i);                      // when a ball leaves mat i
//   crowd.clear();                           // new shift / phase reset

import * as THREE from 'three';
import { custPos, CUST } from './customers.js';

const PASTELS = [0xf2b6c0, 0xb8d8f0, 0xc9e4b5, 0xf5dfa0, 0xd5c3ec, 0xf4c7a4, 0xa9dcd6, 0xe3e3e3];
const TURN = 7;          // rad/s a figure may turn
const CHASE = 3;         // m/s a figure may close on its deterministic spot (absorbs snapshot jitter)

export function createCrowd({ scene, people, maxFull = 14, nearM = 50, farM = 180 }) {
  const { buildPerson, animatePerson, SWING_IMPACT, SWING_SECS } = people;
  const root = new THREE.Group(); root.name = 'crowd'; scene.add(root);
  const figs = new Map();                              // cust id -> figure
  let t = 0, synced = false, frame = 0, rankT = 0;
  const liteGeo = new THREE.CapsuleGeometry(0.2, 1.05, 3, 8);
  const liteMats = PASTELS.map(c => new THREE.MeshLambertMaterial({ color: c }));

  function makeLite(f) {
    const m = new THREE.Mesh(liteGeo, liteMats[f.look % liteMats.length]);
    m.castShadow = false; m.receiveShadow = false; m.visible = false; root.add(m); return m;
  }
  function makeFull(f) {
    const p = buildPerson({ seed: 'c' + (f.look % 64) });
    p.setClub(true, f.look % 2 ? 'iron' : 'driver');
    p.setCarry(f.carry ? 'bucket' : 'none');
    p.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
    p.root.visible = false; root.add(p.root); return p;
  }
  function upsert(cust, mat, st, t0, look, hold) {
    let f = figs.get(cust);
    if (!f) {
      f = { cust, mat, st, t0, look, hold, x: 0, z: 0, yaw: 0, carry: false, k: -1, acc: 0, speed: 0, lite: null, person: null, placed: false, d: 0 };
      figs.set(cust, f);
    } else { f.mat = mat; f.st = st; f.t0 = t0; f.hold = hold; }
    return f;
  }
  function drop(f) {
    if (f.lite) { root.remove(f.lite); f.lite = null; }
    if (f.person) { root.remove(f.person.root); f.person = null; }
    figs.delete(f.cust);
  }

  // Per snapshot: mats[i] = { cust, st, t0, look, inc: {cust, look, t0} | null }, serverT = the shared clock.
  function sync(mats, serverT) {
    if (!synced || Math.abs(serverT - t) > 0.75) { t = serverT; synced = true; } else t += (serverT - t) * 0.25;
    const seen = new Set();
    mats.forEach((w, i) => {
      if (!w) return;
      const taken = w.st === 'playing' || w.st === 'sulk';
      if (w.cust && w.st && w.st !== 'empty') { upsert(w.cust, i, w.st, w.t0, w.look, false); seen.add(w.cust); }
      if (w.inc) { upsert(w.inc.cust, i, 'arrive', w.inc.t0, w.inc.look, taken); seen.add(w.inc.cust); }
    });
    for (const f of [...figs.values()]) {
      if (seen.has(f.cust) || f.st === 'leave') continue;
      if (f.st === 'arrive') drop(f);                    // the mat closed on them
      else { f.st = 'leave'; f.t0 = t; }                 // vanished from the wire mid-play: walk out
    }
  }

  function onMatShot(i) {
    for (const f of figs.values()) if (f.mat === i && f.st === 'playing') f.k = SWING_IMPACT * 0.8;
  }

  // nearest maxFull get a full figure (a little hysteresis so the same two don't swap every pass)
  function rank(cam) {
    const list = [...figs.values()];
    for (const f of list) f.d = Math.hypot(f.x - cam.position.x, f.z - cam.position.z);
    list.sort((a, b) => (a.d - (a.person ? 6 : 0)) - (b.d - (b.person ? 6 : 0)));
    list.forEach((f, n) => {
      const full = n < maxFull;
      if (full && !f.person) { f.person = makeFull(f); f.placed = false; if (f.lite) f.lite.visible = false; }
      else if (!full && f.person) { root.remove(f.person.root); f.person = null; }
      if (!full && !f.lite) f.lite = makeLite(f);
    });
  }

  function update(dt, camera) {
    dt = Math.min(dt, 0.1); t += dt; frame++;
    if ((rankT -= dt) <= 0) { rankT = 0.4; if (camera) rank(camera); }
    for (const f of [...figs.values()]) {
      if (!f.person && !f.lite) f.lite = makeLite(f);        // before the first rank pass
      const dx = f.person ? f.person.ball.x : CUST.PLAY_DX;
      const c = custPos(f, t, { dx });
      if (c.done) { drop(f); continue; }
      if (!f.placed) { f.x = c.x; f.z = c.z; f.yaw = c.yaw; f.placed = true; f.speed = 0; }
      const ex = c.x - f.x, ez = c.z - f.z, dist = Math.hypot(ex, ez);
      let moved = 0;
      if (dist > 6) { f.x = c.x; f.z = c.z; }
      else if (dist > 1e-4) { moved = Math.min(dist, CHASE * dt); f.x += ex / dist * moved; f.z += ez / dist * moved; }
      const wantYaw = moved > 1e-3 && c.act !== 'play' && c.act !== 'set' && c.act !== 'sulk' ? Math.atan2(-ex, -ez) : c.yaw;
      const dy = Math.atan2(Math.sin(wantYaw - f.yaw), Math.cos(wantYaw - f.yaw));
      f.yaw += Math.sign(dy) * Math.min(Math.abs(dy), TURN * dt);
      f.speed += (moved / Math.max(dt, 1e-3) - f.speed) * Math.min(1, dt * 8);
      f.carry = c.carry;

      const dCam = camera ? Math.hypot(f.x - camera.position.x, f.z - camera.position.z) : 0;
      const show = dCam < farM;
      if (f.person) {
        const p = f.person;
        p.root.visible = show;
        if (!show) continue;
        p.root.position.set(f.x, 0, f.z); p.root.rotation.y = f.yaw;
        if (f.carry !== (p.carry === 'bucket')) p.setCarry(f.carry ? 'bucket' : 'none');
        f.acc += dt;
        if (dCam > nearM && (frame + f.cust) % 3) continue;      // far: every third frame
        const adt = f.acc; f.acc = 0;
        let state;
        if (c.act === 'sulk') state = { mode: 'sulk' };
        else if (f.speed > 0.35) state = { mode: 'walk', speed: Math.min(f.speed, 2.2) };
        else if (c.act === 'set' || c.act === 'play') {
          if (f.k >= 0) { f.k += adt / SWING_SECS; if (f.k >= 1) f.k = -1; }
          state = f.k >= 0 ? { mode: 'swing', k: Math.min(1, f.k) } : { mode: 'address' };
        } else state = { mode: 'idle' };
        if (f.st !== 'playing') f.k = -1;
        animatePerson(p, adt, state);
      } else if (f.lite) {
        const m = f.lite; m.visible = show;
        m.position.set(f.x, 0.75 + (f.speed > 0.35 ? 0.03 * Math.abs(Math.sin(t * 7 + f.cust)) : 0), f.z);
        m.rotation.y = f.yaw;
      }
    }
  }

  function clear() { for (const f of [...figs.values()]) drop(f); synced = false; }
  return {
    sync, update, onMatShot, clear, root,
    get size() { return figs.size; },
    stats() { let full = 0; for (const f of figs.values()) if (f.person) full++; return { figs: figs.size, full, lite: figs.size - full }; },
    // who is at mat i right now ({cust, st, ...} or null); handy for PA lines or Gary
    at(i) { for (const f of figs.values()) if (f.mat === i && (f.st === 'playing' || f.st === 'sulk')) return f; return null; },
    get time() { return t; },
  };
}
