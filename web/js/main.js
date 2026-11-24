// Range Rat client: draws the crew's shared range and sends what you do.
//
// The server owns the balls, pockets, cash and the shift clock (server/crew.mjs).
// This page owns your own walking and looking, flies balls with the same
// physics as the server (web/js/sim.js) so they look smooth between ticks,
// and hides a ball the moment you grab it (the server can say no).

import * as THREE from 'three';
import { createSky } from './sky.js';
import { readPad, BTN, GLYPH, navTargets, navPick } from './pad.js';
import { SIM, MATS, advanceBall, atStand, clampToField, SHOP, nextPrice, priceScale, perks,
  CART, BAYS, atBay, underReels, stepCart } from './sim.js';
import * as NET from './net.js';
import * as SFX from './sfx.js';

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

// Crew bays: orange mats with a little flag, for hitting balls at the cart.
for (const b of BAYS) {
  const mat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 1.8), lambert(0xd9822b));
  mat.position.set(b.x, 0.025, b.z); mat.receiveShadow = true; scene.add(mat);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6), lambert(0xeeeeee));
  pole.position.set(b.x - 0.9, 0.8, b.z + 0.9); scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), new THREE.MeshLambertMaterial({ color: 0xff7a1a, side: THREE.DoubleSide }));
  flag.position.set(b.x - 0.6, 1.45, b.z + 0.9); scene.add(flag);
}

// ---------------------------------------------------------------- the cart
// A white utility cart with a wire cage over the seat, gang reels out front,
// a hopper behind, and four bullseye targets on the cage that light up on a ping.
// Origin at the cart's middle on the ground, facing -z.
function buildCart() {
  const g = new THREE.Group();
  const white = lambert(0xf2efe6), dark = lambert(0x2b2b30), green = lambert(0x2e7d4f);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.45, 2.4), white);
  body.position.y = 0.55; body.castShadow = true; g.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.25, 0.7), green);
  hood.position.set(0, 0.88, -0.85); g.add(hood);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.6), dark);
  seat.position.set(0, 0.88, 0.25); g.add(seat);
  for (const [x, z] of [[-0.72, -0.8], [0.72, -0.8], [-0.72, 0.85], [0.72, 0.85]]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 14), dark);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.3, z); w.castShadow = true; g.add(w);
  }
  // The cage: a wire box over the seat.
  const cage = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.55, 1.7, 4, 4, 4), new THREE.MeshBasicMaterial({ color: 0xd7dde3, wireframe: true }));
  cage.position.set(0, 1.55, 0.05); g.add(cage);
  // Bullseyes on the cage: left, right, back, and one on the roof.
  const targets = [];
  const ring = (r, c) => new THREE.Mesh(new THREE.CircleGeometry(r, 20), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
  for (const [pos, rot] of [[[-0.77, 1.55, 0.05], [0, Math.PI / 2, 0]], [[0.77, 1.55, 0.05], [0, -Math.PI / 2, 0]], [[0, 1.55, 0.92], [0, 0, 0]], [[0, 2.34, 0.05], [-Math.PI / 2, 0, 0]]]) {
    const t = new THREE.Group();
    const outer = ring(0.32, 0xd9382b), mid = ring(0.21, 0xffffff), bull = ring(0.1, 0xd9382b);
    mid.position.z = 0.005; bull.position.z = 0.01;
    t.add(outer, mid, bull); t.position.set(...pos); t.rotation.set(...rot);
    t.userData.mats = [outer.material, bull.material];
    targets.push(t); g.add(t);
  }
  // Gang reels out front: a row of wire drums, rebuilt when the tier changes.
  const reels = new THREE.Group(); reels.position.set(0, 0.28, -CART.REEL_AHEAD); g.add(reels);
  // The hopper behind the seat; its white fill rises with the load.
  const hopper = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.6, 3, 2, 2), new THREE.MeshBasicMaterial({ color: 0x9aa3ad, wireframe: true }));
  hopper.position.set(0, 1.05, 1.05); g.add(hopper);
  const fill = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1, 0.54), lambert(0xf4f1e8));
  fill.position.set(0, 0.8, 1.05); fill.scale.y = 0.001; g.add(fill);
  // Whoever's driving.
  const driver = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 4, 10), lambert(0xffffff));
  torso.position.set(0, 1.35, 0.2); driver.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), lambert(0xf1c9a5));
  head.position.set(0, 1.9, 0.2); driver.add(head);
  driver.visible = false; g.add(driver);
  scene.add(g);
  return { g, targets, reels, fill, driver, torso, reelWidth: 0, flash: 0, wheelSpin: 0 };
}
function setReels(c, width) {
  if (c.reelWidth === width) return;
  c.reels.clear();
  const n = Math.max(1, Math.round(width / 0.8)), w = width / n;
  for (let i = 0; i < n; i++) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, w * 0.92, 12, 2, true), new THREE.MeshBasicMaterial({ color: 0xc9d1d9, wireframe: true }));
    d.rotation.z = Math.PI / 2; d.position.x = -width / 2 + w * (i + 0.5);
    c.reels.add(d);
  }
  c.reelWidth = width;
}
let cartView = null;                // the 3D cart, once the crew owns one
const cartPose = { x: CART.PARK.x, z: CART.PARK.z, yaw: CART.PARK.yaw, v: 0 };  // where I draw it
const pendingCart = new Set();      // balls my cart scooped that the server hasn't confirmed
let engine = null;

// ---------------------------------------------------------------- balls
// Every ball on the field is one instance of one mesh: hundreds of balls, one draw call.
const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(SIM.BALL_R, 12, 8), lambert(0xf4f1e8), SIM.MAX_BALLS + 64);
ballMesh.castShadow = true;
ballMesh.frustumCulled = false;
ballMesh.count = 0;
scene.add(ballMesh);
const balls = new Map();            // id -> { id, x, y, z, vx, vy, vz, rest, acc, hidden }
const pending = new Set();          // ball ids I grabbed that the server hasn't confirmed yet

function addBall(b) {
  if (balls.has(b.id)) return;
  balls.set(b.id, { ...b, acc: 0, hidden: false });
}
function removeBall(id) {
  balls.delete(id);
  pending.delete(id);
}
const ballM = new THREE.Matrix4(), ballQ = new THREE.Quaternion(), ballP = new THREE.Vector3(), ballS = new THREE.Vector3();
function drawBalls() {
  let i = 0;
  for (const b of balls.values()) {
    if (b.hidden || i >= ballMesh.instanceMatrix.count) continue;
    // A real ball is sub-pixel past ~40 m; grow far ones so the field reads as dots.
    const s = Math.max(1, Math.hypot(b.x - me.x, b.z - me.z) / 25);
    ballM.compose(ballP.set(b.x, b.y, b.z), ballQ, ballS.set(s, s, s));
    ballMesh.setMatrixAt(i++, ballM);
  }
  ballMesh.count = i;
  ballMesh.instanceMatrix.needsUpdate = true;
}
function clearBalls() { for (const id of [...balls.keys()]) removeBall(id); }

// ---------------------------------------------------------------- carrying gear
// Built for a body: hand-held things at hand height on the right, the push
// picker rolling on the grass in front. Origin is the person's feet, facing -z.
const steel = lambert(0x9aa3ad), wire = new THREE.MeshBasicMaterial({ color: 0xc9d1d9, wireframe: true });
function gearModel(level) {
  const g = new THREE.Group();
  if (level === 1) {           // ball retriever tube
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.0, 8), steel);
    tube.position.set(0.38, 0.55, -0.25); tube.rotation.x = -0.5; g.add(tube);
    const cage = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), wire);
    cage.position.set(0.38, 0.1, -0.5); g.add(cage);
  } else if (level === 2) {    // range bucket
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 14, 1, true),
      new THREE.MeshLambertMaterial({ color: 0x2f6fbf, side: THREE.DoubleSide }));
    b.position.set(0.42, 0.62, -0.05); g.add(b);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 16, Math.PI), steel);
    handle.position.set(0.42, 0.77, -0.05); g.add(handle);
  } else if (level >= 3) {     // push picker: a wire drum on an axle, a long handle
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.9, 12, 3, true), wire);
    drum.rotation.z = Math.PI / 2; drum.position.set(0, 0.28, -1.6); drum.name = 'drum'; g.add(drum);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.55, 6), steel);
    handle.position.set(0, 0.62, -0.9); handle.rotation.x = 1.12; g.add(handle);
  }
  return g;
}
let gearLevel = -1;
const myGear = new THREE.Group();   // my own picker, placed in the world at my feet each frame
scene.add(myGear);
const fpGear = new THREE.Group();   // hand-held gear, hung off the camera so it sits in view
fpGear.position.set(0.05, -1.12, -0.85);
camera.add(fpGear);
scene.add(camera);
function setMyGear(level) {
  myGear.clear(); fpGear.clear();
  (level >= 3 ? myGear : fpGear).add(gearModel(level));
  gearLevel = level;
}

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
  if (p.helper) { torso.scale.setScalar(0.85); head.position.y = 1.4; cap.position.y = 1.45; brim.position.y = 1.45; tag.position.y = 1.95; }
  g.position.set(p.x, 0, p.z);
  scene.add(g);
  others.set(p.id, { g, body, tag, gear: null, gearLevel: -1, helper: !!p.helper, to: { x: p.x, z: p.z, yaw: p.yaw }, down: 0 });
}
function setMateGear(o, level) {
  if (o.gearLevel === level) return;
  if (o.gear) o.body.remove(o.gear);
  o.gear = gearModel(level); o.body.add(o.gear); o.gearLevel = level;
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
    for (const id of m.denied ?? []) { const b = balls.get(id); if (b) b.hidden = false; pending.delete(id); pendingCart.delete(id); }
  }
}

function onEvent(e) {
  switch (e.t) {
    case 'spawn': addBall({ id: e.id, x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, rest: false }); break;
    case 'rest': { const b = balls.get(e.id); if (b) { b.x = e.x; b.z = e.z; b.y = SIM.BALL_R; b.vx = b.vy = b.vz = 0; b.rest = true; } break; }
    case 'gone':
      if (pendingCart.delete(e.id)) SFX.scoop();
      removeBall(e.id);
      break;
    case 'cash':
      if (e.by === me.id) { toast(e.kind === 'cart' ? `Cart unloaded: +$${e.cash}` : `+$${e.cash}`); SFX.cash(e.n); }
      else if (e.kind !== 'helper') toast(`${e.kind === 'cart' ? 'The cart' : nameOf(e.by)} banked $${e.cash}`);   // helpers bank quietly
      break;
    case 'ping': {
      SFX.ping();
      if (cartView) cartView.flash = 1;
      if (!e.prize) break;
      SFX.jackpot();
      const who = e.by === me.id ? 'You' : nameOf(e.by);
      toast(e.prize === 'jackpot' ? `PING! ${who} hit the cart. JACKPOT: ${e.n} balls hoovered up`
        : e.prize === 'boost' ? `PING! ${who} hit the cart. TURBO for ${CART.BOOST_SECS} seconds`
        : `PING! ${who} hit the cart. Balls are worth ×${e.mult} for the rest of the day`, 3);
      break;
    }
    case 'board': if (e.by !== me.id) toast(`${nameOf(e.by)} is driving the cart`); break;
    case 'buy': {
      const item = SHOP.find(i => i.id === e.id);
      toast(`${e.by === me.id ? 'You' : nameOf(e.by)} bought: ${item?.tiers[e.level]?.name ?? e.id}`, 2.2);
      break;
    }
    case 'knock': {
      SFX.bonk();
      const how = e.by === 'cart' ? 'got run over by the cart' : 'got knocked flat';
      if (e.id === me.id) toast(e.by === 'cart' ? 'You got run over by the cart.' : 'BONK. You got knocked flat.', 2.4);
      else toast(`${nameOf(e.id) === 'Someone' ? crew.helpers?.find(h => h.id === e.id)?.name ?? 'Someone' : nameOf(e.id)} ${how}`);
      break;
    }
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

let my = perks();                   // what the crew's upgrades add up to
function applySnapshot(s) {
  crew = s;
  my = perks(s.up);
  const gear = s.up?.gear ?? 0;
  if (gear !== gearLevel) setMyGear(gear);
  applyCart(s.cart);
  const seen = new Set();
  const people = [...s.players, ...(s.helpers ?? []).map(h => ({ ...h, helper: true, color: '#b9c0c8', online: true }))];
  for (const p of people) {
    seen.add(p.id);
    if (p.id === me.id) { me.pocket = p.pocket; me.down = p.down; continue; }
    if (!others.has(p.id)) addMate(p);
    const o = others.get(p.id);
    o.to = { x: p.x, z: p.z, yaw: p.yaw }; o.down = p.down;
    o.g.visible = (p.online || p.down > 0) && s.cart?.driver !== p.id;   // drivers are drawn in the cart
    setMateGear(o, p.helper ? 0 : gear);
  }
  for (const id of [...others.keys()]) if (!seen.has(id)) removeMate(id);
  renderRoster();
  renderShop();
}

// The cart from the server. While I drive, my own pose is the truth and the
// server's is only for everyone else; when I climb in, I start from its pose.
let wasDriving = false;
const driving = () => !!crew.cart && crew.cart.driver === me.id;
function applyCart(c) {
  if (!c) return;
  if (!cartView) { cartView = buildCart(); Object.assign(cartPose, { x: c.x, z: c.z, yaw: c.yaw, v: 0 }); }
  setReels(cartView, my.cartReel);
  const mine = c.driver === me.id;
  if (mine && !wasDriving) { Object.assign(cartPose, { x: c.x, z: c.z, yaw: c.yaw, v: 0 }); pendingCart.clear(); }
  if (!mine && wasDriving) {
    // I got out (or lost the cart): stand on the driver's side, facing where it faces.
    me.x = cartPose.x - Math.cos(cartPose.yaw) * 1.4; me.z = cartPose.z + Math.sin(cartPose.yaw) * 1.4; me.yaw = cartPose.yaw;
    pendingCart.clear();
  }
  wasDriving = mine;
  const d = c.driver && crew.players.find(p => p.id === c.driver);
  cartView.driver.visible = !!d;
  if (d) cartView.torso.material.color.set(d.color);
}

// ---------------------------------------------------------------- the shop
// Rendered into the lobby and the overnight report. Only re-rendered when
// something it shows changes, so controller focus survives the 10 Hz ticks.
let shopKey = '';
function renderShop() {
  const size = crew.players.length;
  const key = JSON.stringify([crew.cash, crew.up, size, crew.phase]);
  if (key === shopKey) return;
  shopKey = key;
  const focused = document.activeElement?.dataset?.buy;
  const scale = priceScale(size);
  const html = `<h3>${crew.phase === 'report' ? 'Overnight shop' : 'Shop'} <span>$${crew.cash} to spend</span></h3>
    ${size > 1 ? `<p class="note">Prices are ×${scale.toFixed(1)} for a crew of ${size}.</p>` : ''}
    <ul>${SHOP.map(item => {
      const lvl = crew.up?.[item.id] ?? 0, now = item.tiers[lvl], next = item.tiers[lvl + 1];
      const price = nextPrice(item.id, crew.up, size);
      return `<li>
        <div><b>${item.title}</b>: ${now.name}${next ? `<small>Next: <i>${next.name}</i>. ${next.desc}</small>` : `<small>${now.desc} (maxed out)</small>`}</div>
        ${next ? `<button data-buy="${item.id}" ${price > crew.cash ? 'disabled' : ''}>$${price}</button>` : '<span class="max">✓</span>'}
      </li>`;
    }).join('')}</ul>`;
  for (const el of document.querySelectorAll('.shop')) el.innerHTML = html;
  if (focused) {
    const root = menuRoot();
    const again = root?.querySelector(`[data-buy="${focused}"]:not([disabled])`);
    (again ?? navTargets(root)[0])?.focus();
  }
}
document.addEventListener('click', e => {
  const id = e.target.closest?.('[data-buy]')?.dataset.buy;
  if (id && link) link.act({ t: 'buy', id });
});

// ---------------------------------------------------------------- actions
function nearestBall(reach = my.reach) {
  let best = null, bd = reach;
  for (const b of balls.values()) {
    if (b.hidden || b.y > 0.4) continue;
    const d = Math.hypot(b.x - me.x, b.z - me.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
const carrying = () => me.pocket + pending.size;
const playing = () => link && crew.phase !== 'lobby' && !paused && !menuOpen();

const nearCart = () => crew.cart && !crew.cart.driver && Math.hypot(cartPose.x - me.x, cartPose.z - me.z) < CART.BOARD_REACH;
const canSwing = () => crew.phase === 'shift' && atBay(me) && me.pocket > 0 && !driving();

// Separate buttons, so no action ever has to guess:
//   use    (left click / Space / Ⓐ): pick up a ball, or hold at a crew bay to swing
//   bucket (E / Ⓧ): drop balls in the bucket stand
//   cart   (E / Ⓨ): get in or out of the cart
// On a keyboard E does both: the stand and the cart are never in the same spot.
function interact(only = null) {
  if (!playing() || me.down > 0) return;
  if (only !== 'bucket') {
    if (driving()) { link.act({ t: 'leave' }); return; }
    if (nearCart()) { link.act({ t: 'board' }); return; }
  }
  if (only !== 'cart' && atStand(me) && carrying() > 0) link.act({ t: 'deposit' });
}
function act() {
  if (!playing() || me.down > 0 || driving()) return;
  if (carrying() >= my.pocket) { toast('Full: take them to the bucket stand'); return; }
  const b = !my.scoop ? nearestBall() : null;
  if (b) grab(b);
}

// ---- swinging at a crew bay: hold to wind up, let go to hit ----------------
// Power follows how long you held (a full second is a full swing); aim is
// wherever you're looking, and looking up lofts it.
const SWING_FULL = 1.0;
let charging = null;                 // performance.now() when the wind-up started
function pressAct() {
  SFX.unlock();
  if (playing() && me.down <= 0 && canSwing()) { charging = performance.now(); return; }
  act();
}
function releaseAct() {
  if (charging === null) return;
  const power = Math.min(1, (performance.now() - charging) / 1000 / SWING_FULL);
  charging = null;
  if (!canSwing()) return;
  link.act({ t: 'swing', yaw: +me.yaw.toFixed(3), pitch: +me.pitch.toFixed(3), power: +power.toFixed(3) });
  SFX.swing(power);
}

// ---- driving -----------------------------------------------------------------
function driveCart(dt, px, py, lt, rt) {
  const throttle = Math.max(-1, Math.min(1, (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + rt - lt - py));
  const steer = Math.max(-1, Math.min(1, (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + px));
  const vmax = my.cartSpeed * ((crew.cart?.boost ?? 0) > 0 ? CART.BOOST : 1);
  stepCart(cartPose, throttle, steer, dt, vmax);
  me.x = cartPose.x; me.z = cartPose.z;
  // The gang reels scoop whatever they roll over.
  const room = my.cartCap - (crew.cart?.load ?? 0) - pendingCart.size;
  let n = 0;
  for (const b of balls.values()) {
    if (n >= 8 || n >= room) break;
    if (b.hidden || b.y > 0.4 || !underReels(cartPose, b, my.cartReel)) continue;
    b.hidden = true; pendingCart.add(b.id); n++;
    link.act({ t: 'pickup', ball: b.id, cart: true });
  }
  if (engine) engine.set(Math.min(1, Math.abs(cartPose.v) / vmax));
}
function grab(b) {
  b.hidden = true; pending.add(b.id);
  link.act({ t: 'pickup', ball: b.id });
}
// The push picker scoops up whatever you roll over, no button needed.
function scoop() {
  if (!my.scoop || !playing() || me.down > 0) return;
  for (let n = 0; n < 4 && carrying() < my.pocket; n++) {
    const b = nearestBall(my.scoop);
    if (!b) return;
    grab(b);
  }
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
    if (status === 'lost' || status === 'kicked') rejoin();
    else $('net').textContent = status === 'online' ? '' : 'Reconnecting…';
  });
  $('title').classList.add('hidden');
  $('hud').classList.remove('hidden');
}

// After a deploy or a long nap the server may not have this crew loaded (or
// may have dropped this player). Joining again loads the crew from its save
// and gets a seat, the same one if it still exists.
let rejoining = null;
function rejoin() {
  if (rejoining) return rejoining;
  $('net').textContent = 'Reconnecting…';
  rejoining = (async () => {
    for (let i = 0; i < 5; i++) {
      try {
        seat = await NET.joinCrew(seat.code, NET.lastUsed().name ?? '');
        go();
        return;
      } catch (e) {
        if (/No crew/.test(e.message)) break;
        await new Promise(r => setTimeout(r, 1500 * (i + 1)));
      }
    }
    link?.close(); link = null;
    $('net').textContent = '';
    $('hud').classList.add('hidden');
    $('title').classList.remove('hidden');
    $('join-error').textContent = `Couldn't get back into crew ${seat.code}. It may have closed.`;
  })().finally(() => { rejoining = null; });
  return rejoining;
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
      ${report.helped ? `<p>Banked by hired help <b>${report.helped}</b></p>` : ''}
      ${report.carted ? `<p>Scooped by the cart <b>${report.carted}</b></p>` : ''}
      ${report.swings ? `<p>Hit the Cart <b>${report.pings ?? 0} pings from ${report.swings} swings</b></p>` : ''}
      <p>Knockdowns <b>${report.knockdowns}</b></p>
      ${report.runOver ? `<p>Run over by the cart <b>${report.runOver}</b></p>` : ''}
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
  if (s) { seat = s; rejoin(); }       // a reload: back into the same seat
}

// ---------------------------------------------------------------- input
const keys = new Set();
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
addEventListener('keydown', e => {
  if (typing()) return;
  SFX.unlock();
  keys.add(e.code);
  if (e.code === 'Space' && !e.repeat) pressAct();
  if (e.code === 'KeyE' && !e.repeat) interact();
  if (e.code === 'Escape' && link) pause(!paused);
});
addEventListener('keyup', e => { keys.delete(e.code); if (e.code === 'Space') releaseAct(); });
addEventListener('blur', () => { keys.clear(); charging = null; });
addEventListener('pointerdown', () => SFX.unlock());
// Pointer lock can be refused (embedded views, no user gesture): swallow that
// and fall back to the arrow keys for looking.
function lockMouse() { try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch {} }
canvas.addEventListener('mousedown', e => {
  if (e.button !== 0 || !playing()) return;
  if (document.pointerLockElement !== canvas) lockMouse();
  pressAct();
});
addEventListener('mouseup', e => { if (e.button === 0) releaseAct(); });
addEventListener('mousemove', e => {
  if (document.pointerLockElement !== canvas || driving()) return;
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
  if (pad.pressed.some(Boolean)) SFX.unlock();
  if (pad.pressed[BTN.A]) pressAct();
  if (pad.released[BTN.A]) releaseAct();
  if (pad.pressed[BTN.X]) interact('bucket');
  if (pad.pressed[BTN.Y]) interact('cart');
  if (pad.pressed[BTN.MENU]) pause(true);
  if (!driving()) {
    me.yaw -= pad.rx * 2.6 * dt;
    me.pitch = Math.max(-1.4, Math.min(1.2, me.pitch - pad.ry * 1.8 * dt));
  }
  return [pad.lx, pad.ly];
}

// ---------------------------------------------------------------- HUD
let toastT = 0;
function toast(msg, secs = 1.6) { $('toast').textContent = msg; $('toast').classList.add('show'); toastT = secs; }

function renderRoster() {
  $('roster').innerHTML = crew.players.map(p => `<li style="--c:${p.color}" class="${p.online ? '' : 'off'}">
    <span class="dot"></span>${esc(p.name)}${p.id === me.id ? ' <i>(you)</i>' : ''}
    <span class="pk">${p.down > 0 ? '💫' : p.pocket > 3 ? p.pocket : '●'.repeat(p.pocket)}</span></li>`).join('')
    + (crew.helpers?.length ? `<li class="help">${crew.helpers.map(h => esc(h.name) + (h.down > 0 ? ' 💫' : '')).join(', ')} <i>(hired)</i></li>` : '');
}
const esc = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

function hud() {
  $('cash').textContent = `$${crew.cash}${crew.mult > 1 ? `  ×${crew.mult}` : ''}`;
  const n = carrying(), cap = my.pocket, pad = document.body.classList.contains('pad');
  const btn = pad ? GLYPH.A : 'Click';          // use: pick up, swing
  const ibtn = pad ? GLYPH.X : 'E';             // the bucket stand
  const cbtn = pad ? GLYPH.Y : 'E';             // the cart
  if (driving()) {
    const load = (crew.cart?.load ?? 0) + pendingCart.size;
    $('pocket').textContent = `Cart ${load} / ${my.cartCap}${(crew.cart?.boost ?? 0) > 0 ? `  TURBO ${Math.ceil(crew.cart.boost)}s` : ''}`;
  } else $('pocket').textContent = cap <= 8 ? '●'.repeat(Math.min(n, cap)) + '○'.repeat(Math.max(0, cap - n)) : `${n} / ${cap}`;
  const left = Math.max(0, crew.shiftSecs - crew.shiftT);
  $('clock').textContent = crew.phase === 'shift' ? `Day ${crew.day} · ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : `Day ${crew.day}`;
  const load = (crew.cart?.load ?? 0) + pendingCart.size;
  $('prompt').textContent = !playing() ? ''
    : me.down > 0 ? 'Seeing stars…'
    : driving() ? (load >= my.cartCap ? 'Hopper full: drive to the bucket stand' : `${pad ? 'RT/LT drive · stick steer' : 'W/S drive · A/D steer'} · ${cbtn} get out`)
    : atStand(me) && n ? `${ibtn}  Drop ${n} in the bucket`
    : n < cap && !my.scoop && nearestBall() ? `${btn}  Pick up${nearCart() ? `   ·   ${cbtn}  Drive the cart` : ''}`
    : nearCart() ? `${cbtn}  Drive the cart`
    : atBay(me) && crew.phase === 'shift' ? (me.pocket > 0 ? `Hold ${btn} to swing, aim at the cart (${me.pocket} to hit)` : 'Bring balls to hit them')
    : n < cap && !my.scoop && nearestBall() ? `${btn}  Pick up`
    : n >= cap ? 'Full: head to the bucket stand' : '';
  const meter = $('meter');
  meter.classList.toggle('hidden', charging === null);
  if (charging !== null) meter.firstElementChild.style.width = `${Math.min(1, (performance.now() - charging) / 1000 / SWING_FULL) * 100}%`;
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

  const drivingNow = driving();
  if (drivingNow && playing()) driveCart(dt, px, py, pad?.lt ?? 0, pad?.rt ?? 0);
  else if (engine) engine.set(0);
  if (!drivingNow && playing() && me.down <= 0) {
    let fx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + px;
    let fz = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0) + py;
    const m = Math.hypot(fx, fz); if (m > 1) { fx /= m; fz /= m; }
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    me.x += (fx * cy + fz * sy) * my.walk * dt;
    me.z += (-fx * sy + fz * cy) * my.walk * dt;
    if (m > 0.05) { const drum = myGear.getObjectByName('drum'); if (drum) drum.rotation.x -= m * my.walk * dt / 0.28; }
    clampToField(me);
    me.yaw += ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * 2.2 * dt;
    me.pitch = Math.max(-1.4, Math.min(1.2, me.pitch + ((keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)) * 1.5 * dt));
  }
  if (link && me.placed) link.move(me.x, me.z, me.yaw, drivingNow ? cartPose : null);
  if (crew.phase === 'shift') crew.shiftT += dt;        // smooth between server ticks

  for (const b of balls.values()) advanceBall(b, dt);
  scoop();
  drawBalls();
  // My own gear: hand-held things hang below the view, the picker rolls ahead.
  myGear.position.set(me.x, 0, me.z);
  myGear.rotation.set(0, me.yaw, 0);
  myGear.visible = fpGear.visible = me.down <= 0 && !drivingNow;

  // The cart: my own pose while I drive, otherwise eased toward the server's.
  if (cartView && crew.cart) {
    if (!drivingNow) {
      const c = crew.cart, kc = 1 - Math.exp(-dt * 10);
      cartPose.x += (c.x - cartPose.x) * kc; cartPose.z += (c.z - cartPose.z) * kc;
      let dy = c.yaw - cartPose.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      cartPose.yaw += dy * kc;
    }
    cartView.g.position.set(cartPose.x, 0, cartPose.z);
    cartView.g.rotation.y = cartPose.yaw;
    const spin = drivingNow ? cartPose.v : 0;
    for (const r of cartView.reels.children) r.rotation.x -= spin * dt / 0.26;
    cartView.fill.scale.y = Math.max(0.001, Math.min(1, ((crew.cart.load ?? 0) + (drivingNow ? pendingCart.size : 0)) / Math.max(1, my.cartCap)) * 0.45);
    cartView.fill.position.y = 0.8 + cartView.fill.scale.y / 2;
    // A ping lights the bullseyes up, then they fade back.
    cartView.flash = Math.max(0, cartView.flash - dt * 1.5);
    const glow = cartView.flash > 0 && (cartView.flash * 12) % 2 > 1;
    for (const t of cartView.targets) for (const m of t.userData.mats) m.color.set(glow ? 0xfff27a : 0xd9382b);
    if (!engine && drivingNow) engine = SFX.cartEngine();
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
  if (drivingNow) {
    // Chase cam: behind and above the cart, looking a little ahead of it.
    const fx = -Math.sin(cartPose.yaw), fz = -Math.cos(cartPose.yaw);
    camera.position.set(cartPose.x - fx * 7, 3.6, cartPose.z - fz * 7);
    camera.lookAt(cartPose.x + fx * 6, 0.8, cartPose.z + fz * 6);
  } else {
    camera.position.set(me.x, EYE - fall * (EYE - 0.25), me.z);
    camera.rotation.set(me.pitch + fall * 1.1, me.yaw, fall * 0.6, 'YXZ');
  }

  if (toastT > 0 && (toastT -= dt) <= 0) $('toast').classList.remove('show');
  if (link) hud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Dev hook: /?debug exposes live state for poking at from the console.
if (new URLSearchParams(location.search).has('debug')) window.rr = { me, balls, others, act, interact, cartPose, pressAct, releaseAct, get crew() { return crew; }, startShift, get link() { return link; } };
