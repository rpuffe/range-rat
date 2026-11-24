// Range Rat: the first playable slice. Solo, local only (the shared server
// range comes next; see design/game-design.md).
//
// One shift: customers on the mats hit balls onto the range, and you walk out,
// pick them up by hand (your pocket holds 3), and drop them in the bucket
// stand for cash. The sun moves from opening to sunset.

import * as THREE from 'three';
import { createSky } from './sky.js';
import { readPad, BTN, GLYPH } from './pad.js';

const SHIFT_SECS = 7 * 60;
const POCKET = 3;
const REACH = 1.6;            // m: how close a ball must be to grab it
const STAND = new THREE.Vector3(26, 0, 6);
const STAND_REACH = 3;
const BALL_R = 0.06;          // a touch big, so it reads in first person
const MAX_BALLS = 300;
const G = 9.81;

// ---------------------------------------------------------------- scene
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 3000);
const sky = createSky(scene);

const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 600),
  new THREE.MeshLambertMaterial({ color: 0x5f8f3a }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);

// Mowing stripes and yardage flags so distance reads on a flat field.
for (let i = 0; i < 12; i++) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(80, 12),
    new THREE.MeshLambertMaterial({ color: i % 2 ? 0x679a40 : 0x5a8836 }));
  s.rotation.x = -Math.PI / 2; s.position.set(0, 0.005, -8 - i * 12); s.receiveShadow = true;
  scene.add(s);
}
for (const [z, col] of [[-50, 0xd94a3a], [-90, 0xf2c94c], [-130, 0x3a7bd9]]) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4), new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
  pole.position.set(0, 1.2, z); scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }));
  flag.position.set(0.4, 2.15, z); scene.add(flag);
}

// The mats: a strip of tee boxes along z = 0, with a customer at each.
const MATS = [];
for (let i = 0; i < 10; i++) {
  const x = -18 + i * 4;
  const mat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.6), new THREE.MeshLambertMaterial({ color: 0x2f6b2a }));
  mat.position.set(x, 0.02, 0); mat.receiveShadow = true; scene.add(mat);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 8),
    new THREE.MeshLambertMaterial({ color: new THREE.Color().setHSL(i / 10, 0.5, 0.55) }));
  body.position.set(x + 0.6, 0.75, 0.3); body.castShadow = true; scene.add(body);
  MATS.push({ x, next: 2 + Math.random() * 6 });
}

// The bucket stand: where picked balls turn into cash.
const stand = new THREE.Group();
const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.2), new THREE.MeshLambertMaterial({ color: 0x8a5a32 }));
box.position.y = 0.5; box.castShadow = true; stand.add(box);
const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.45, 16, 1, true),
  new THREE.MeshLambertMaterial({ color: 0x2f6fbf, side: THREE.DoubleSide }));
bucket.position.set(0, 1.22, 0); stand.add(bucket);
stand.position.copy(STAND);
scene.add(stand);

// ---------------------------------------------------------------- balls
const ballGeo = new THREE.SphereGeometry(BALL_R, 12, 8);
const ballMat = new THREE.MeshLambertMaterial({ color: 0xf4f1e8 });
const balls = [];

function hitBall(mat) {
  if (balls.length >= MAX_BALLS) return;
  const m = new THREE.Mesh(ballGeo, ballMat);
  m.castShadow = true;
  m.position.set(mat.x, 0.1, -0.4);
  scene.add(m);
  const speed = 16 + Math.random() * 22,  // muni customers: ~30–140 m carries loft = 0.25 + Math.random() * 0.35, aim = (Math.random() - 0.5) * 0.35;
  balls.push({ m, v: new THREE.Vector3(Math.sin(aim) * speed * Math.cos(loft), speed * Math.sin(loft), -Math.cos(aim) * speed * Math.cos(loft)), rest: false });
}

function stepBalls(dt) {
  for (const b of balls) {
    if (b.rest) continue;
    const p = b.m.position;
    b.v.y -= G * dt;
    p.addScaledVector(b.v, dt);
    if (p.y < BALL_R) {
      p.y = BALL_R;
      if (b.v.y < -1) { b.v.y *= -0.35; b.v.x *= 0.7; b.v.z *= 0.7; }
      else {
        b.v.y = 0;
        const s = Math.hypot(b.v.x, b.v.z), ns = Math.max(0, s - 3.2 * dt);
        if (ns === 0) { b.v.set(0, 0, 0); b.rest = true; } else { b.v.x *= ns / s; b.v.z *= ns / s; }
      }
    }
  }
}

// ---------------------------------------------------------------- player
const player = { pos: new THREE.Vector3(0, 0, -12), yaw: Math.PI, pitch: -0.25, pocket: 0, cash: 0, picked: 0 };
const EYE = 1.65, WALK = 4.2;
const keys = new Set();
addEventListener('keydown', e => { keys.add(e.code); if (e.code === 'KeyE' || e.code === 'Space') act(); if (e.code === 'Escape') pause(true); });
addEventListener('keyup', e => keys.delete(e.code));
// Pointer lock can be refused (embedded views, no user gesture): swallow that
// and fall back to the arrow keys for looking.
function lockMouse() { try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch {} }
canvas.addEventListener('click', () => { if (!started) return; if (document.pointerLockElement !== canvas) lockMouse(); act(); });
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  player.yaw -= e.movementX * 0.0025;
  player.pitch = Math.max(-1.4, Math.min(1.2, player.pitch - e.movementY * 0.0025));
});

function nearestBall() {
  let best = null, bd = REACH;
  for (const b of balls) {
    const d = Math.hypot(b.m.position.x - player.pos.x, b.m.position.z - player.pos.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
const atStand = () => Math.hypot(player.pos.x - STAND.x, player.pos.z - STAND.z) < STAND_REACH;

function act() {
  if (!started || paused || shiftOver) return;
  if (atStand() && player.pocket > 0) {
    player.cash += player.pocket; player.pocket = 0;
    toast(`+$${player.cash - lastCash}`); lastCash = player.cash;
    return;
  }
  if (player.pocket >= POCKET) { toast('Pocket full: take them to the bucket stand'); return; }
  const b = nearestBall();
  if (!b) return;
  scene.remove(b.m);
  balls.splice(balls.indexOf(b), 1);
  player.pocket++; player.picked++;
}
let lastCash = 0;

// ---------------------------------------------------------------- controller
let pad = null;
function pollPad(dt) {
  pad = readPad(navigator.getGamepads?.(), pad);
  if (!pad) return [0, 0];
  if (pad.pressed[BTN.A]) act();
  if (pad.pressed[BTN.MENU]) pause(!paused);
  if (pad.pressed[BTN.A] && !started) start();
  player.yaw -= pad.rx * 2.6 * dt;
  player.pitch = Math.max(-1.4, Math.min(1.2, player.pitch - pad.ry * 1.8 * dt));
  if (pad.active) document.body.classList.add('pad');
  return [pad.lx, pad.ly];
}

// ---------------------------------------------------------------- HUD
const $ = id => document.getElementById(id);
let toastT = 0;
function toast(msg) { $('toast').textContent = msg; $('toast').classList.add('show'); toastT = 1.6; }
function hud() {
  $('cash').textContent = `$${player.cash}`;
  $('pocket').textContent = '●'.repeat(player.pocket) + '○'.repeat(POCKET - player.pocket);
  const left = Math.max(0, SHIFT_SECS - shiftT);
  $('clock').textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
  const b = !shiftOver && nearestBall();
  const btn = document.body.classList.contains('pad') ? GLYPH.A : 'E';
  $('prompt').textContent = atStand() && player.pocket ? `${btn}  Drop ${player.pocket} in the bucket`
    : b && player.pocket < POCKET ? `${btn}  Pick up` : '';
}

// ---------------------------------------------------------------- shift
let started = false, paused = false, shiftOver = false, shiftT = 0;
function start() {
  if (started) return;
  started = true; $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
  lockMouse();
}
function pause(on) { if (!started || shiftOver) return; paused = on; $('pause').classList.toggle('hidden', !on); }
$('play').addEventListener('click', start);
$('resume').addEventListener('click', () => { pause(false); lockMouse(); });

function endShift() {
  shiftOver = true; document.exitPointerLock?.();
  $('report').innerHTML = `<h2>Shift over</h2>
    <p>Balls picked up <b>${player.picked}</b></p>
    <p>Cash earned <b>$${player.cash}</b></p>
    <p>Balls still out there <b>${balls.length}</b></p>
    <p class="dim">Upgrades, the crew, and the shared range come next.</p>`;
  $('report').classList.remove('hidden');
}

// ---------------------------------------------------------------- loop
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const [px, py] = pollPad(dt);
  if (started && !paused && !shiftOver) {
    shiftT += dt;
    if (shiftT >= SHIFT_SECS) endShift();
    for (const m of MATS) if ((m.next -= dt) <= 0) { hitBall(m); m.next = 4 + Math.random() * 8; }
    let fx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + px;
    let fz = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0) + py;
    const m = Math.hypot(fx, fz); if (m > 1) { fx /= m; fz /= m; }
    const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
    player.pos.x += (fx * cy + fz * sy) * WALK * dt;
    player.pos.z += (-fx * sy + fz * cy) * WALK * dt;
    player.pos.z = Math.min(player.pos.z, 9);
    player.yaw += ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * 2.2 * dt;
    player.pitch = Math.max(-1.4, Math.min(1.2, player.pitch + ((keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)) * 1.5 * dt));
  }
  stepBalls(dt);
  // A real ball is sub-pixel past ~40 m; grow far ones so the field reads as
  // white dots you can walk toward.
  for (const b of balls) b.m.scale.setScalar(Math.max(1, Math.hypot(b.m.position.x - player.pos.x, b.m.position.z - player.pos.z) / 25));
  sky.setTime(shiftT / SHIFT_SECS);
  sky.follow(player.pos);
  camera.position.set(player.pos.x, EYE, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('show');
  if (started) hud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Dev hook: /?debug exposes live state for poking at from the console.
if (new URLSearchParams(location.search).has('debug')) window.rr = { player, balls, act, start, stepBalls };
