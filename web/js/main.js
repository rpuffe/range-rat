// Range Rat client: draws the crew's shared range and sends what you do.
//
// The server owns the balls, pockets, cash and the shift clock (server/crew.mjs).
// This page owns your own walking and looking, flies balls with the same
// physics as the server (web/js/sim.js) so they look smooth between ticks,
// and hides a ball the moment you grab it (the server can say no).

import * as THREE from 'three';
import { createSky } from './sky.js';
import { readPad, BTN, GLYPH, navTargets, navPick } from './pad.js';
import { SIM, MATS, advanceBall, atStand, clampToField } from './sim.js';
import * as NET from './net.js';

const EYE = 1.65;
const $ = id => document.getElementById(id);

// ---------------------------------------------------------------- scene
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 3000);
const sky = createSky(scene);

const lambert = color => new THREE.MeshLambertMaterial({ color });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), lambert(0x5f8f3a));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
scene.add(ground);

// Mowing stripes and yardage flags so distance reads on a flat field.
for (let i = 0; i < 12; i++) {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(80, 12), lambert(i % 2 ? 0x679a40 : 0x5a8836));
  s.rotation.x = -Math.PI / 2; s.position.set(0, 0.005, -8 - i * 12); s.receiveShadow = true;
  scene.add(s);
}
for (const [z, col] of [[-50, 0xd94a3a], [-90, 0xf2c94c], [-130, 0x3a7bd9]]) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4), lambert(0xeeeeee));
  pole.position.set(0, 1.2, z); scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshLambertMaterial({ color: col, side: THREE.DoubleSide }));
  flag.position.set(0.4, 2.15, z); scene.add(flag);
}

// The mats, each with a customer (stand-ins until real golfers move in).
for (const m of MATS) {
  const mat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.6), lambert(0x2f6b2a));
  mat.position.set(m.x, 0.02, 0); mat.receiveShadow = true; scene.add(mat);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.9, 4, 8), lambert(new THREE.Color().setHSL(m.i / 10, 0.35, 0.6)));
  body.position.set(m.x + 0.6, 0.75, 0.3); body.castShadow = true; scene.add(body);
}

// The bucket stand: where picked balls turn into cash.
const stand = new THREE.Group();
const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.2), lambert(0x8a5a32));
box.position.y = 0.5; box.castShadow = true; stand.add(box);
const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.45, 16, 1, true),
  new THREE.MeshLambertMaterial({ color: 0x2f6fbf, side: THREE.DoubleSide }));
bucket.position.set(0, 1.22, 0); stand.add(bucket);
stand.position.set(SIM.STAND.x, 0, SIM.STAND.z);
scene.add(stand);

// ---------------------------------------------------------------- balls
const ballGeo = new THREE.SphereGeometry(SIM.BALL_R, 12, 8);
const ballMat = lambert(0xf4f1e8);
const balls = new Map();            // id -> { id, x, y, z, vx, vy, vz, rest, acc, mesh, hidden }
const pending = new Set();          // ball ids I grabbed that the server hasn't confirmed yet

function addBall(b) {
  if (balls.has(b.id)) return;
  const mesh = new THREE.Mesh(ballGeo, ballMat);
  mesh.castShadow = true;
  scene.add(mesh);
  balls.set(b.id, { ...b, acc: 0, mesh, hidden: false });
}
function removeBall(id) {
  const b = balls.get(id);
  if (!b) return;
  scene.remove(b.mesh);
  balls.delete(id);
  pending.delete(id);
}
function clearBalls() { for (const id of [...balls.keys()]) removeBall(id); }

// ---------------------------------------------------------------- crew mates
const others = new Map();           // id -> { g, to: {x, z, yaw}, down }

function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '600 34px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(20,16,32,0.65)'; x.beginPath(); x.roundRect(8, 8, 240, 48, 18); x.fill();
  x.fillStyle = color; x.fillText(text, 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1); s.renderOrder = 10;
  return s;
}

function addMate(p) {
  const g = new THREE.Group();
  const body = new THREE.Group();                       // pivots at the feet so a knockdown tips it over
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 10), lambert(p.color));
  torso.position.y = 0.75; torso.castShadow = true; body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), lambert(0xf1c9a5));
  head.position.y = 1.55; head.castShadow = true; body.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.21, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), lambert(p.color));
  cap.position.y = 1.6; body.add(cap);
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.18), lambert(p.color));
  brim.position.set(0, 1.6, -0.25); body.add(brim);
  g.add(body);
  const tag = nameTag(p.name, p.color); tag.position.y = 2.15; g.add(tag);
  g.position.set(p.x, 0, p.z);
  scene.add(g);
  others.set(p.id, { g, body, tag, to: { x: p.x, z: p.z, yaw: p.yaw }, down: 0 });
}
function removeMate(id) { const o = others.get(id); if (o) { scene.remove(o.g); others.delete(id); } }

// ---------------------------------------------------------------- me
const me = { id: null, x: SIM.STAND.x - 3, z: SIM.STAND.z - 4, yaw: Math.PI / 2, pitch: -0.2, pocket: 0, down: 0, placed: false };
let crew = { phase: 'lobby', day: 1, shiftT: 0, shiftSecs: SIM.SHIFT_SECS, cash: 0, players: [] };
let link = null, seat = null, report = null, paused = false;
const nameOf = id => crew.players.find(p => p.id === id)?.name ?? 'Someone';

function onMsg(m) {
  if (m.k === 'welcome') {
    me.id = m.you;
    clearBalls();
    for (const b of m.balls) addBall(b);
    report = m.report;
    applySnapshot(m.s);
    const mine = m.s.players.find(p => p.id === me.id);
    if (mine && !me.placed) { me.x = mine.x; me.z = mine.z; me.yaw = mine.yaw; me.placed = true; }
    $('code').textContent = m.code;
    showPhase();
  } else if (m.k === 'tick') {
    for (const e of m.ev) onEvent(e);
    applySnapshot(m.s);
  } else if (m.k === 'ack') {
    for (const id of m.denied ?? []) { const b = balls.get(id); if (b) b.hidden = false; pending.delete(id); }
  }
}

function onEvent(e) {
  switch (e.t) {
    case 'spawn': addBall({ id: e.id, x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, rest: false }); break;
    case 'rest': { const b = balls.get(e.id); if (b) { b.x = e.x; b.z = e.z; b.y = SIM.BALL_R; b.vx = b.vy = b.vz = 0; b.rest = true; } break; }
    case 'gone': removeBall(e.id); break;
    case 'cash': toast(e.by === me.id ? `+$${e.cash}` : `${nameOf(e.by)} banked $${e.cash}`); break;
    case 'knock':
      if (e.id === me.id) toast('BONK. You got knocked flat.', 2.4);
      else toast(`${nameOf(e.id)} got knocked flat`);
      break;
    case 'join': if (e.id !== me.id) toast(`${e.name} joined the crew`); break;
    case 'leave': removeMate(e.id); break;
    case 'shift':
      report = e.report ?? null;
      if (e.phase === 'shift') { toast(`Day ${e.day}: the range is open`, 2.4); }
      crew.phase = e.phase;
      showPhase();
      break;
  }
}

function applySnapshot(s) {
  crew = s;
  const seen = new Set();
  for (const p of s.players) {
    seen.add(p.id);
    if (p.id === me.id) { me.pocket = p.pocket; me.down = p.down; continue; }
    if (!others.has(p.id)) addMate(p);
    const o = others.get(p.id);
    o.to = { x: p.x, z: p.z, yaw: p.yaw }; o.down = p.down;
    o.g.visible = p.online || p.down > 0;
  }
  for (const id of [...others.keys()]) if (!seen.has(id)) removeMate(id);
  renderRoster();
}

// ---------------------------------------------------------------- actions
function nearestBall() {
  let best = null, bd = SIM.REACH;
  for (const b of balls.values()) {
    if (b.hidden || b.y > 0.4) continue;
    const d = Math.hypot(b.x - me.x, b.z - me.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
const carrying = () => me.pocket + pending.size;
const playing = () => link && crew.phase !== 'lobby' && !paused && !menuOpen();

function act() {
  if (!playing() || me.down > 0) return;
  if (atStand(me) && carrying() > 0) { link.act({ t: 'deposit' }); return; }
  if (carrying() >= SIM.POCKET) { toast('Pocket full: take them to the bucket stand'); return; }
  const b = nearestBall();
  if (!b) return;
  b.hidden = true; pending.add(b.id);
  link.act({ t: 'pickup', ball: b.id });
}
const startShift = () => link?.act({ t: 'start' });

// ---------------------------------------------------------------- joining
async function enter(how) {
  const name = $('name').value.trim();
  const code = $('join-code').value.trim().toUpperCase();
  $('join-error').textContent = '';
  try {
    seat = how === 'create' ? await NET.createCrew(name) : await NET.joinCrew(code, name);
  } catch (e) { $('join-error').textContent = e.message; return; }
  NET.rememberUsed(seat.code, name);
  go();
}

function go() {
  link?.close();
  me.placed = false;
  link = NET.connect(seat, onMsg, status => {
    $('net').textContent = status === 'online' ? '' : status === 'kicked' ? 'This crew is gone. Reload to start over.' : 'Reconnecting…';
  });
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
}

function showPhase() {
  $('lobby').classList.toggle('hidden', crew.phase !== 'lobby' || !link);
  $('report').classList.toggle('hidden', crew.phase !== 'report' || !report);
  if (crew.phase === 'lobby') $('lobby-code').textContent = $('code').textContent;
  if (crew.phase === 'report' && report) {
    $('report-body').innerHTML = `<h2>Day ${report.day} is done</h2>
      <p>Balls picked up <b>${report.picked}</b></p>
      <p>Balls banked <b>${report.deposited}</b></p>
      <p>Cash earned <b>$${report.cash}</b></p>
      <p>Knockdowns <b>${report.knockdowns}</b></p>
      <p>Balls left out there <b>${report.left}</b></p>
      <p>In the bank <b>$${report.bank}</b></p>`;
  }
  if (crew.phase === 'shift') lockMouse();
  else document.exitPointerLock?.();
}

$('create').addEventListener('click', () => enter('create'));
$('join').addEventListener('click', () => enter('join'));
$('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') enter('join'); });
$('start').addEventListener('click', startShift);
$('next').addEventListener('click', startShift);
$('resume').addEventListener('click', () => pause(false));
$('leave').addEventListener('click', () => { link?.close(); link = null; try { sessionStorage.clear(); } catch {} location.reload(); });
{
  const last = NET.lastUsed();
  if (last.name) $('name').value = last.name;
  if (last.code) $('join-code').value = last.code;
  const s = NET.seatInTab();
  if (s) { seat = s; go(); }           // a reload: straight back in
}

// ---------------------------------------------------------------- input
const keys = new Set();
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
addEventListener('keydown', e => {
  if (typing()) return;
  keys.add(e.code);
  if (e.code === 'KeyE' || e.code === 'Space') act();
  if (e.code === 'Escape' && link) pause(!paused);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
// Pointer lock can be refused (embedded views, no user gesture): swallow that
// and fall back to the arrow keys for looking.
function lockMouse() { try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch {} }
canvas.addEventListener('click', () => { if (!playing()) return; if (document.pointerLockElement !== canvas) lockMouse(); act(); });
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas) return;
  me.yaw -= e.movementX * 0.0025;
  me.pitch = Math.max(-1.4, Math.min(1.2, me.pitch - e.movementY * 0.0025));
});
function pause(on) {
  if (!link) return;
  paused = on;
  $('pause').classList.toggle('hidden', !on);
  if (on) { document.exitPointerLock?.(); focusFirst($('pause')); } else if (crew.phase === 'shift') lockMouse();
}

// ---------------------------------------------------------------- controller
// Menus are driven with the D-pad or left stick plus Ⓐ, like a console app.
const menuOpen = () => ['title', 'lobby', 'report', 'pause'].some(id => !$(id).classList.contains('hidden'));
const menuRoot = () => ['pause', 'report', 'lobby', 'title'].map($).find(el => !el.classList.contains('hidden')) ?? null;
function focusFirst(root) { const t = navTargets(root); if (t.length && !root.contains(document.activeElement)) t[0].focus(); }

let pad = null, navHeld = 0;
function pollPad(dt) {
  pad = readPad(navigator.getGamepads?.(), pad);
  if (!pad) return [0, 0];
  if (pad.active) document.body.classList.add('pad');
  const root = menuRoot();
  if (root) {
    const dx = (pad.down[BTN.RIGHT] ? 1 : 0) - (pad.down[BTN.LEFT] ? 1 : 0) || Math.round(pad.lx);
    const dy = (pad.down[BTN.DOWN] ? 1 : 0) - (pad.down[BTN.UP] ? 1 : 0) || Math.round(pad.ly);
    if (dx || dy) {
      if ((navHeld -= dt) <= 0) {
        const targets = navTargets(root), cur = root.contains(document.activeElement) ? document.activeElement : null;
        navPick(cur, targets, dx, dy)?.focus();
        navHeld = navHeld < -1 ? 0.12 : 0.28;   // first step slow, then repeat
      }
    } else navHeld = 0;
    if (pad.pressed[BTN.A]) {
      const el = root.contains(document.activeElement) ? document.activeElement : (focusFirst(root), document.activeElement);
      if (el?.tagName === 'BUTTON') el.click(); else el?.focus();   // on Xbox, a focused input opens the keyboard
    }
    if (pad.pressed[BTN.B] && root.id === 'pause') pause(false);
    if (pad.pressed[BTN.MENU] && root.id === 'pause') pause(false);
    return [0, 0];
  }
  if (pad.pressed[BTN.A]) act();
  if (pad.pressed[BTN.MENU]) pause(true);
  me.yaw -= pad.rx * 2.6 * dt;
  me.pitch = Math.max(-1.4, Math.min(1.2, me.pitch - pad.ry * 1.8 * dt));
  return [pad.lx, pad.ly];
}

// ---------------------------------------------------------------- HUD
let toastT = 0;
function toast(msg, secs = 1.6) { $('toast').textContent = msg; $('toast').classList.add('show'); toastT = secs; }

function renderRoster() {
  $('roster').innerHTML = crew.players.map(p => `<li style="--c:${p.color}" class="${p.online ? '' : 'off'}">
    <span class="dot"></span>${esc(p.name)}${p.id === me.id ? ' <i>(you)</i>' : ''}
    <span class="pk">${p.down > 0 ? '💫' : '●'.repeat(p.pocket)}</span></li>`).join('');
}
const esc = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function hud() {
  $('cash').textContent = `$${crew.cash}`;
  const n = carrying();
  $('pocket').textContent = '●'.repeat(Math.min(n, SIM.POCKET)) + '○'.repeat(Math.max(0, SIM.POCKET - n));
  const left = Math.max(0, crew.shiftSecs - crew.shiftT);
  $('clock').textContent = crew.phase === 'shift' ? `Day ${crew.day} · ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : `Day ${crew.day}`;
  const btn = document.body.classList.contains('pad') ? GLYPH.A : 'E';
  $('prompt').textContent = !playing() ? ''
    : me.down > 0 ? 'Seeing stars…'
    : atStand(me) && n ? `${btn}  Drop ${n} in the bucket`
    : n < SIM.POCKET && nearestBall() ? `${btn}  Pick up` : '';
}

// ---------------------------------------------------------------- loop
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let last = performance.now(), fall = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const [px, py] = pollPad(dt);

  if (playing() && me.down <= 0) {
    let fx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + px;
    let fz = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0) + py;
    const m = Math.hypot(fx, fz); if (m > 1) { fx /= m; fz /= m; }
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    me.x += (fx * cy + fz * sy) * SIM.WALK * dt;
    me.z += (-fx * sy + fz * cy) * SIM.WALK * dt;
    clampToField(me);
    me.yaw += ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * 2.2 * dt;
    me.pitch = Math.max(-1.4, Math.min(1.2, me.pitch + ((keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)) * 1.5 * dt));
  }
  if (link && me.placed) link.move(me.x, me.z, me.yaw);
  if (crew.phase === 'shift') crew.shiftT += dt;        // smooth between server ticks

  for (const b of balls.values()) {
    advanceBall(b, dt);
    b.mesh.visible = !b.hidden;
    b.mesh.position.set(b.x, b.y, b.z);
    // A real ball is sub-pixel past ~40 m; grow far ones so the field reads as dots.
    b.mesh.scale.setScalar(Math.max(1, Math.hypot(b.x - me.x, b.z - me.z) / 25));
  }

  const k = 1 - Math.exp(-dt * 12);
  for (const o of others.values()) {
    o.g.position.x += (o.to.x - o.g.position.x) * k;
    o.g.position.z += (o.to.z - o.g.position.z) * k;
    o.body.rotation.y = o.to.yaw;
    o.body.rotation.x += ((o.down > 0 ? -Math.PI / 2 : 0) - o.body.rotation.x) * Math.min(1, dt * 14);
  }

  // Knocked flat: the camera drops to the grass and tips over, then gets up.
  fall += ((me.down > 0 ? 1 : 0) - fall) * Math.min(1, dt * (me.down > 0 ? 12 : 4));
  sky.setTime(crew.phase === 'shift' ? crew.shiftT / crew.shiftSecs : crew.phase === 'report' ? 1 : 0);
  sky.follow(new THREE.Vector3(me.x, 0, me.z));
  camera.position.set(me.x, EYE - fall * (EYE - 0.25), me.z);
  camera.rotation.set(me.pitch + fall * 1.1, me.yaw, fall * 0.6, 'YXZ');

  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('show');
  if (link) hud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Dev hook: /?debug exposes live state for poking at from the console.
if (new URLSearchParams(location.search).has('debug')) window.rr = { me, balls, others, act, get crew() { return crew; }, startShift };
