// Range Rat client: draws the crew's shared range and sends what you do.
//
// The server owns the balls, pockets, cash and the shift clock (server/crew.mjs).
// This page owns your own walking and looking, flies balls with the same
// physics as the server (web/js/sim.js) so they look smooth between ticks,
// and hides a ball the moment you grab it (the server can say no).

import * as THREE from 'three';
import { createSky } from './sky.js';
import { readPad, BTN, GLYPH, navTargets, navPick } from './pad.js';
import { padBindings, wandA } from './padbind.js';                                     // owner playtest 3 §7.1-7.2: RT sprays, L3 sprints
import { primaryOf, focusMemo, focusRestore, menuA } from './menufocus.js';            // §7.3: every card works on a pad
import { goalShopIds, shopSort } from './promopanel.js';   // playthrough 5: the shop's order and ✦ GOAL tags
import { createPadlog } from './padlog.js';                                            // §7.3: ?padlog
import { garyParked, garyPlate, chatBit, CHAT_END, CHAT_FEED, SEAL_LINE } from './garyvisit.js';   // owner playtest 3 §6: Gary
import { createBayLine } from './bayline.js';                                          // round 11 (owner): Build more bays
import { fixtureBuilt } from './bays.js';
import { SIM, MATS, LINE, advanceBall, atStand, clampToField, SHOP, nextPrice, shopShows, tierLock, shopDay, shopVday as SHOP_VDAY, priceScale, perks,
  CART, BAYS, atBay, underReels, stepCart, gearPerks, WASH, money, SPRINT, sprintSecs, FIXTURES, FIXTURE_BY_ID, POND, inPond, onDock, FRIES, atShed, KIND_NAMES, KIND_BLURB, debutFloat, lobbyTagline,
  VENUE_RULES, GARY, BANK, BUCKETS } from './sim.js';
import { createBallReturn, createFieldReturns } from './ballreturn.js';   // owner layout: the pipe from the return to the bank, the basket
import { atFieldReturn, FILL_POINT } from './layout.js';   // council round 10 §C: the field ball returns
import { detailFor } from './detail.js';
import { stationsShown } from './stations.js';
import * as NET from './net.js';
import * as SFX from './sfx.js';
import { createSweep } from './sweep.js';
import { worldVday } from './clubdays.js';   // round 11: stagger the Club, one idea a day   // round 11 (builder "feel", expert #4): picking juice
import { createBoard } from './board.js';
import { sharedConfetti, confettiCount } from './confetti.js';   // round 6: one pooled confetti Points, shared (#3 bell, #5 huddle)
import * as AMB from './ambience.js';
import * as SET from './settings.js';
import { createSwing, strikeToLaunch } from './swing.js';
import { createScenery } from './scenery.js';
import { createKitchen } from './kitchen.js';
import { createMower } from './mower.js';
import { moweBoard, laneName, BOSS_LINES, BOSS, inRing as moweRing, behind as moweBehind, bossFighting, atPost as moweAtPost, canBlow as moweCanBlow, stampText as moweStampText, moweRow, mowedLine } from './mowe.js';   // council round 11 #1: the boss; round 13: the loss path, the aimed whistle
import { nearestReturn as moweReturn } from './layout.js';   // council round 13 #5a (builder 1): the whistle blows 20 m or more from the nearest return
import { menuFor, GARY_LINE } from './menu.js';
import { setupRound2 } from './round2.js';
import { garyCountdown, oneBeam, oneBeamScale, ONE_BEAM, huddleLine, HUDDLE_CALL } from './huddlerules.js';   // round 6 #5: the Board's GARY 3 · 2 · 1; council round 12 #3a: Ball No. 1's beam
import { createScuba } from './scuba.js';
import { diveTiers, eyeY, bedAt, TREASURE_BY_ID, atTube, hasTube, PUMP, CREEK_DIVE, waterLook } from './dive.js';
let r2 = null;           // round-2 features, set up at the end of this file
let views = null;        // round-4 venue views (views/index.js), set up at the end of this file
import { buildPerson, animatePerson, personAddress, SWING_IMPACT, SWING_SECS } from './people.js';
import { createCrowd } from './crowd.js';
import { createTerrain } from './terrain.js';
import { wadeFactor, stepDrift, cartSpeedAt, MAP } from './map.js';
import { applyCurrent } from './creekdive.js';   // council round 10 #5: builder 3's creek rules (the server ducks you under)
import { createViews } from './views/index.js';
import { createPerf } from './perf.js';
import { createPace } from './pace.js'; const pace = createPace({ search: location.search, storage: (() => { try { return sessionStorage; } catch { return null; } })(), clipboard: navigator.clipboard }); pace.bind(document.getElementById('pace-copy'));   // ?pace: the pace log
import { setHeavyRate } from './venues.js';
import { createProps } from './props.js';
import { tipCtx, createTipPointer, tipsAllowed, emptyBasketRat, withBasketAlarm } from './tips.js'; const tipPointer = createTipPointer();   // owner notes: a tip per new thing, and the arrow
import { PAYFLOAT, payRoute, createRoller, createHudPop } from './payfloat.js';   // council round 6 #7: only your own cash floats over you
import { bvLine, ceilingOf, priceOf, popupLine, reportRow, sealRow, gainText, signedMoney, targetStamp, kpiNoteOf, debrisHomeText } from './bvtext.js';
import { checkGate } from './morning.js';   // council round 12, 9.4 (builder 4): the checklist's quiet gate
import { clampBubbleY, clampBubbleSize } from './bubbleclamp.js';   // council round 12, 9.5 (builder 4): Gary's bubble clear of the HUD
import { contractLineOf, rivalLineOf, gaugeChip } from './bvtext.js';   // council round 12 (builder 4): the endless Board lines, the HUD gauge
import { goalText, starText } from './today.js';
import { spotlessRow } from './dayend.js';   // round 11: the SPOTLESS RANGE stamp on the report   // owner playtest 3 §1 (builder 1): Ball Value in one look
import { atFill, siloFill } from './basket.js';   // owner playtest 3 §3.3: the bucket basket (builder 2)
import { nudgeLine, nudgeTarget, GARY_STALLED, garyExtra, createGaryLineGate, GARY_LINES } from './nudge.js';    // council round 6 #10 / round 7 #4: day 2, Gary's dealt stops, day 3
import { createStoryCard } from './storycard.js';         // round 12: the story beats' card overlay
import { garyHello, garyBye } from './story.js';           // round 12: Gary's lines change with the venue
import { createSay, SAY } from './say.js';                     // council round 7 #3: the one centre-text queue
import { PRI } from './centre.js';                             // council round 13 #2 (builder 3): the one arbiter's ladder
import { createCentreWatch } from './centrewatch.js';          // council round 13 #2e: ?debug counts real on-screen overlaps
import { createFightMute, fightMuted, plateFade } from './centrehooks.js';   // council round 13 #2b/#2c
import { SPAWN_PITCH } from './spawnlook.js';                  // council round 13 #6: the spawn pitch ease
import { createPayMerge, mergedLine } from './payfloat.js';    // council round 13 #2b: merged pops, at most 2
import { DECKCAM, CUT_LABEL, cutPlan, skips, cutAt } from './deckcam.js';   // council round 10 #4: the Deck Cam
import { AUTO } from './autopilot.js';                     // council round 10 §D: Ⓨ held at an autopilot cart
import { DISPATCH } from './county.js';                    // council round 10 §D: Ⓨ held on foot at the County
import { cardHtml, LAST_CARD } from './goals.js';
import { debrisBalls, LIFT } from './orbit.js';
import { createFallAgg } from './feedagg.js';                // council round 11 8.10: helper falls, one feed line a minute             // council round 11 8.8: "+10 balls home" over a landed piece         // council round 10 #1: the pause menu's Goals panel
import { SIGN_BY_ID, yawOf, tagSign } from './signs.js';   // sign facings (test/signs.test.mjs; ?signs checks the meshes)
import { createDusk } from './duskview.js';                // end of the day: the overhead walk-off between the stamp and the report
import { actPick } from './actpick.js';                    // playthrough 4 C1: Ball No. 1 before a full pocket
import { poachShopTag } from './owner.js';               // council round 14 #5b (builder 3's hand-off): "Counts double today"
import { createRecap, reportRowsHtml } from './recap.js';  // round 11 (builder "today"): the night card, contracts, the locker; round 14 #0b: module rows
import { skyK, floodsOn, lookHex } from './today.js';       // round 11 (builder "today"): Night Range, the cosmetics
import { initSkip } from './skip.js';                      // round 11: skip ahead (test), dev + localhost only
import { createReadyGate, READY } from './readygate.js';
import { createEdgeChevron } from './edgechev.js';          // council round 13 8.6 (builder 4)   // council round 13 8.2/8.3 (builder 4): the Ready press
import * as TEX from './textures.js';                      // the shared textures, preloaded behind the title card's bar
import { prewarm } from './prewarm.js';                    // and every shader compiled behind it (Textures and preloading)

const EYE = 1.65;
const $ = id => document.getElementById(id);
// The one centre-text queue (council round 7 #3): every centre string goes through say(kind, text, opts), one at a time.
// ?debug warns on lines over 8 words; window.rr.say shows the queue and its dropped count.
const sayer = createSay({ $, dev: new URLSearchParams(location.search).has('debug'), feed: t => feed(t) });   // round 13: a PA that waited 6 s goes to the feed
// round 13 #2e: __centre.overlaps; round 14 #0d (builder 4): Gary's bubble and the pay floats count when they sit in the centre
if (new URLSearchParams(location.search).has('debug')) window.__centre = createCentreWatch({ camera: () => camera,
  sprites: () => [...(garyView?.bubble ? [{ id: 'gary-bubble', text: garySays?.text ?? '', sprite: garyView.bubble.sprite, opacity: garyView.bubble.sprite.material.opacity }] : []), ...board.floatSprites()] });
const say = sayer.say;
const garyGate = createGaryLineGate();   // council round 14 6.4 (builder 4): one Gary line at a time (nudge.js)
// Round 12: the story card takes its turn from the same queue (nothing else draws centre text while it's up).
const storyCard = createStoryCard({ sayer, cueReady: cue => r2?.cueReady?.(cue) ?? true /* round 13 #7b */, keys: () => (document.body.classList.contains('pad') ? { next: GLYPH.A, skip: GLYPH.B } : { next: 'Space', skip: 'Esc' }) });
let garySays = null;   // round 12: { text, t } his venue's hello in the bubble while he waits at the gate
const bubbleV = new THREE.Vector3(), bubbleAt = { x: 0, z: 0, half: 0 };   // council round 12, 9.5: his bubble's top ≤ 70 % up the screen (bubbleclamp.js)
const sweep = createSweep({ root: document.getElementById('crosshair')?.parentElement ?? document.body, sfx: SFX });   // round 11: the sweep

// ---------------------------------------------------------------- scene
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
// Graphics tiers + the ?perf overlay (perf.js): pixel ratio / render-height cap come from resize() via perf.size().
const perf = createPerf({ renderer, ua: navigator.userAgent, graphics: SET.get().graphics, search: location.search });
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 3000);
const edgeChev = createEdgeChevron({ camera });   // council round 13 8.6 (builder 4): the huddle call's chevron
const sky = createSky(scene);

// Textures (textures.js): generated a slice at a time behind the title card's bar, uploaded as each lands. Materials
// take them now; until a texture's pixels arrive it shows its plain average, so the scene never goes black.
// The bar: the textures fill the first 70 %, the shader pre-compile (prewarm.js, at the end of this file) the rest.
const loadBar = p => {
  const bar = $('loadbar'); if (!bar) return;
  bar.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  bar.firstElementChild.style.transform = `scaleX(${p.toFixed(3)})`;
  if (p >= 1) bar.classList.add('done');
};
TEX.configure({ low: perf.low });   // Low (Xbox): half-size textures and no bump maps
TEX.setAnisotropy(perf.low ? 2 : 4);
TEX.preload({ renderer, onProgress: p => loadBar(0.7 * p) });

const lambert = color => new THREE.MeshLambertMaterial({ color });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), TEX.mat('grass', 0x5f8f3a, { world: 2.4, mode: 'top', macro: 0.35 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.name = 'ground';
scene.add(ground);

// Mowing stripes so distance reads (the flags are Dimple Creek's, in terrain.js). One merged mesh (it was 16), the
// lane colours as vertex colours, the mow texture's blades lying along the lanes.
{
  const pos = [], col = [], nor = [], idx = [], c = new THREE.Color();
  for (let i = 0; i < 16; i++) {
    const z0 = -8 - i * 12 - 6, z1 = z0 + 12, k = pos.length / 3;
    c.set(i % 2 ? 0x679a40 : 0x5a8836);
    for (const [x, z] of [[-64, z1], [64, z1], [-64, z0], [64, z0]]) { pos.push(x, 0, z); nor.push(0, 1, 0); col.push(c.r, c.g, c.b); }
    idx.push(k, k + 1, k + 2, k + 2, k + 1, k + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));   // world uv replaces it
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const s = new THREE.Mesh(g, TEX.mat('mow', 0xffffff, { world: 2.4, mode: 'top', macro: 0.3, vertexColors: true }));
  s.position.y = 0.005; s.receiveShadow = true; s.name = 'mow-stripes';
  scene.add(s);
}
// Dimple Creek: the creek, its crossings, the flags, Dimples Rock, the Old Tractor (map.js rules).
const terrain = createTerrain({ scene });
let terrainVenue = -1;
const world = () => ({ venue: crew?.venue ?? 0, vday: worldVday(crew?.venue, crew?.venueDay, crew?.endless), ret: crew?.up?.returns ?? 0 });   // round 11: ret, the tube's posts   // round 11: the Club day (clubdays.js)
const shopVday = () => worldVday(crew?.venue, SHOP_VDAY(crew?.phase, crew?.venueDay ?? 0), crew?.endless);   // the Club day the shop shops for (round 14 #0b: the lobby too)

// The mats. Customers (crowd.js) walk in at the gate, grab a bucket at the
// stand, hit it from a mat, and walk out. A filthy mat gets refused.
// Round 11 (owner, bays.js): the whole line (the new wing too); only the built bays show (bayline.js, per snapshot).
const bayMeshes = [];
for (const m of LINE) {
  const mat = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.04, 1.6), TEX.textured(lambert(0x2f6b2a), 'turf'));   // own material: props.js gives each its mud
  mat.position.set(m.x, 0.02, 0); mat.receiveShadow = true; scene.add(mat);
  // The mat's number (1-10) on its back edge, so "Mat 4" is a callout (a waiting customer names it).
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.font = '700 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(m.i + 1), 32, 34);
  const num = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  num.position.set(m.x, 0.045, 0.62); num.renderOrder = 1; scene.add(tagSign(num, `mat.${m.i + 1}`, { x: 0, y: 1, z: 0 }));
  bayMeshes.push({ mat, num });
}
const bayLine = createBayLine({ meshes: bayMeshes });
import { matOfShot } from './customers.js';   // round 10 #3 (builder 2): the swing cue for the upper bays
const crowd = createCrowd({ scene, people: { buildPerson, animatePerson, SWING_IMPACT, SWING_SECS } });
// A ball leaving a mat: that mat's golfer swings (catch the swing just before impact).
// Council round 10 #3: the upper bays too (customers.js matOfShot reads the spawn point).
function customerSwing(x, y, z) {
  const i = matOfShot(x, y, z);
  if (i >= 0) crowd.onMatShot(i);
}

// The ball return (owner layout; it was the bucket stand): the bin by the mats where picked balls turn into cash.
const stand = new THREE.Group();
const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.2), TEX.textured(lambert(0x8a5a32), 'metal', { world: 1.5 }));   // painted steel (its own material: the mud tints it)
box.position.y = 0.5; box.castShadow = true; stand.add(box);
const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.45, 16, 1, true),
  new THREE.MeshLambertMaterial({ color: 0x2f6fbf, side: THREE.DoubleSide }));
bucket.position.set(0, 1.22, 0); stand.add(bucket);
stand.position.set(SIM.STAND.x, 0, SIM.STAND.z);
scene.add(stand);

// Scenery: nets, trees, hills, the parking lot and entrance, the clubhouse, props.
const scenery = createScenery(scene, { lowDetail: perf.low });
let sceneT = 0;
const rightPoles = scenery.rightPoles ?? null;   // and its poles (scenery.js splits them out for the County)
// The right side net, handed to the venue views (the County takes it down). Found, not owned: scenery.js builds it.
let rightNet = null;
scene.getObjectByName('scenery')?.traverse(o => { if (!rightNet && o.isMesh && !o.isInstancedMesh && o.position.x === MAP.NETS.side && o.position.y === 8) rightNet = o; });

// The Board (Ball Value, KPIs, quota, Balls Outstanding) and the ball silo: the bank, on the old stand's spot.
const confetti = sharedConfetti(scene);
const board = createBoard(scene, { x: BANK.x, z: BANK.z + 1.2, onCross: d => { if (d === 'up') SFX.cash(1); } });   // round 6 #3: the target ding
// The pipe from the return to the silo (through the washer once it's bought), and the customers' basket.
const ballReturn = createBallReturn(scene, { pool: detailFor(perf.profile).pipeBalls });
const fieldReturns = createFieldReturns(scene);   // council round 10 §C: the red boxes out in the field (+1 draw call)
// Council round 10 §D: the drone dispatch zone, a thin ring on the ground while it lasts (1 draw call, hidden otherwise).
const dispatchRing = (() => {
  const m = new THREE.Mesh(new THREE.RingGeometry(DISPATCH.R - 0.35, DISPATCH.R, 64).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x7fe3ff, transparent: true, opacity: 0.55, depthWrite: false }));
  m.position.y = 0.06; m.visible = false; m.renderOrder = 2; scene.add(m);
  return {
    show(e) { m.position.x = e.x; m.position.z = e.z; m.visible = true; },
    sync(z) { m.visible = !!z; if (z) { m.position.x = z.x; m.position.z = z.z; m.material.opacity = 0.25 + 0.3 * Math.min(1, z.left / 5); } },
  };
})();
const atFieldRet = p => !driving() && !p.diving && atFieldReturn(p, crew.up?.returns ?? 0);

// Mud on the fixtures customers see (Curb Appeal): the road sign, the stand, the mats.
// Each fixture's material browns as its mud rises; the wand cleans it.
const fixtureMats = {};
let signRef = null;
const pondMeshes = [];
const MUD = new THREE.Color(0x5a3d1e);
{
  const sign = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#1d4d2f'; x.fillRect(0, 0, 512, 256);
  x.fillStyle = '#fff8ec'; x.textAlign = 'center';
  x.font = 'bold 54px system-ui, sans-serif'; x.fillText('MUNI RANGE', 256, 110);
  x.font = '600 26px system-ui, sans-serif'; x.fillText('a Fairway Holdings property', 256, 160);
  x.font = 'italic 24px system-ui, sans-serif'; x.fillText('Every Ball Matters.™', 256, 205);
  TEX.signFinish(x, 512, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshLambertMaterial({ map: tex });
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), signMat);
  panel.position.y = 2.0; sign.add(tagSign(panel, 'road.field'));
  // A second face for the road (and the promotion reveal camera): one DoubleSide plane read mirrored from there.
  const roadFace = tagSign(panel.clone(), 'road.road'); roadFace.rotation.y = Math.PI; sign.add(roadFace);
  for (const px of [-1.4, 1.4]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2), TEX.mat('wood', 0x6b5a45, { repeat: [1, 3] })); post.position.set(px, 1.1, -0.02); sign.add(post); }
  const fx = FIXTURE_BY_ID.sign;
  sign.position.set(fx.x, 0, fx.z); sign.rotation.y = yawOf(SIGN_BY_ID['road.field'].normal);   // faces the field
  scene.add(sign);
  fixtureMats.sign = { mat: signMat, base: new THREE.Color(0xffffff) };
  signRef = { canvas: c, ctx: x, tex };      // repainted per venue (round2.js)
}
fixtureMats.stand = { mat: box.material, base: box.material.color.clone() };
scene.traverse(o => {   // the customer mats were built above; find them by position
  if (o.isMesh && o.geometry?.parameters?.width === 1.6 && o.geometry.parameters.height === 0.04) {
    const m = LINE.find(m => Math.abs(m.x - o.position.x) < 0.01);
    if (m) { o.material = o.material.clone(); fixtureMats['mat' + m.i] = { mat: o.material, base: o.material.color.clone() }; }
  }
});
function paintFixtures(fx) {
  for (const [id, mud] of Object.entries(fx ?? {})) {
    const fm = fixtureMats[id];
    // props.js draws the mats' mud; the sign and the return wear its decals (council round 10 §B), so only a light tint
    if (fm && !fm.mat.userData.mudOverlay) fm.mat.color.copy(fm.base).lerp(MUD, Math.min(1, mud) * (fm.mat.userData.mudDecal ? 0.3 : 0.85));
  }
}

// The pond: a sunken bowl with a murky surface, a muddy bottom and a jetty on the near shore.
// It opens with the Range Club; until then it isn't on the map (round2.js toggles it).
const pondWater = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 48),
  new THREE.MeshLambertMaterial({ color: 0x2f6f73, transparent: true, opacity: 0.78, side: THREE.DoubleSide }));
pondWater.rotation.x = -Math.PI / 2; pondWater.position.set(POND.x, 0.03, POND.z); scene.add(pondWater);
const pondBed = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 48), TEX.mat('stones', 0x3b3322, { world: 1.2, mode: 'top' }));
pondBed.rotation.x = -Math.PI / 2; pondBed.position.set(POND.x, POND.BOTTOM - 0.06, POND.z); scene.add(pondBed);
const pondWall = new THREE.Mesh(new THREE.CylinderGeometry(POND.r, POND.r, -POND.BOTTOM + 0.1, 48, 1, true),
  TEX.mat('dirt', 0x4a3f2a, { side: THREE.BackSide, repeat: [12, 1] }));
pondWall.position.set(POND.x, POND.BOTTOM / 2, POND.z); scene.add(pondWall);
{
  const dock = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 3.6), TEX.mat('wood', 0x8b6b45, { world: 1.2 }));
  dock.position.set(POND.DOCK.x, 0.25, POND.DOCK.z - 0.6); dock.castShadow = true; scene.add(dock);
  const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.9, 10), lambert(0xd9382b));
  pump.position.set(POND.DOCK.x + 0.7, 0.75, POND.DOCK.z + 0.6); scene.add(pump);
  pondMeshes.push(pondWater, pondBed, pondWall, dock, pump);
  for (const m of pondMeshes) m.visible = false;
}
const diveLight = new THREE.SpotLight(0xd8ffe8, 0, 10, 0.5, 0.5, 1);
camera.add(diveLight); camera.add(diveLight.target); diveLight.target.position.set(0, 0, -3);
const surfaceFog = { color: new THREE.Color(), near: 0, far: 0 };
// The underwater world: caustics, light shafts, kelp, fish, a catfish, lost-and-found junk, bubbles.
const scuba = createScuba(scene, camera, POND, { onPing: ({ pan }) => SFX.glint?.(pan) });
pondMeshes.push(scuba.group); scuba.group.visible = false;
let treasureShown = null, lostFoundKey = '';   // what scuba.js is showing: the sunk treasure and the glass case

// The snack shed: a little hut with a counter, a sack of potatoes, and a fryer.
const shedSign = (() => {
  const g = new THREE.Group();
  const hut = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.4), TEX.mat('siding', 0xc9b48a, { world: 2, bump: 0.8 })); hut.position.y = 1.2; hut.castShadow = true; g.add(hut);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1, 4), TEX.mat('shingles', 0x8a3b2e, { world: 2.5, bump: 1 })); roof.position.y = 2.9; roof.rotation.y = Math.PI / 4; g.add(roof);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.6), TEX.mat('wood', 0x8b6b45, { world: 1.2 })); counter.position.set(0, 1.0, -1.45); g.add(counter);
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), lambert(0x9c7b4b)); sack.scale.y = 0.8; sack.position.set(-1.6, 0.35, -1.4); g.add(sack);
  const fries = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.4), lambert(0xf2c94c)); fries.position.set(0.7, 1.28, -1.45); g.add(fries);
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d'); x.fillStyle = '#8a3b2e'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff8ec';
  x.font = 'bold 34px system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('SNACK SHED', 128, 44); TEX.signFinish(x, 256, 64, { screws: false });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
  sign.position.set(0, 2.15, -1.22); sign.rotation.y = yawOf(SIGN_BY_ID['shed.sign'].normal); g.add(tagSign(sign, 'shed.sign'));
  const boards = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.05), TEX.mat('wood', 0x6b5a45, { world: 1.2 })); boards.position.set(0, 1.45, -1.23); g.add(boards);
  g.position.set(FRIES.SHED.x, 0, FRIES.SHED.z + 2.25);   // the counter faces the range; you stand in front of it
  scene.add(g);
  return { fries, boards };
})();

// Last Call floodlights: on for the final minute of a shift. Playthrough 5 A8: at 420 with distance decay the near
// grass (20-25 m from the masts) took ~6× the sun's light and read neon lime from 1:30; with no decay, FLOOD_I each
// is a warm lift about the dusk sun's level where all three overlap, near and far alike.
const FLOOD_I = 0.7;
const floods = [-14, 0, 14].map(x => {
  const l = new THREE.SpotLight(0xfff1c8, 0, 140, 0.55, 0.4, 0);
  l.position.set(x, 14, 8); l.target.position.set(x * 0.6, 0, -55);
  scene.add(l, l.target);
  return l;
});

// Crew bays: orange mats with a little flag, for hitting balls at the cart.
for (const b of BAYS) {
  const mat = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 1.8), TEX.mat('turf', 0xd9822b));
  mat.position.set(b.x, 0.025, b.z); mat.receiveShadow = true; scene.add(mat);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6), lambert(0xeeeeee));
  pole.position.set(b.x - 0.9, 0.8, b.z + 0.9); scene.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), new THREE.MeshLambertMaterial({ color: 0xff7a1a, side: THREE.DoubleSide }));
  flag.position.set(b.x - 0.6, 1.45, b.z + 0.9); scene.add(flag);
}

// The wash station: a pressure washer on a cart-sized concrete pad, with a hose reel.
{
  const st = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 4), TEX.mat('concrete', 0x9c9a93, { world: 2.5, bump: 1 }));
  pad.position.set(-3.2, 0.03, 0); pad.receiveShadow = true; st.add(pad);
  const unit = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.8, 0.6), lambert(0x2f6fbf));
  unit.position.y = 0.4; unit.castShadow = true; st.add(unit);
  const reel = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 8, 20), lambert(0xf2c94c));
  reel.position.set(0, 1.0, 0); reel.rotation.y = Math.PI / 2; st.add(reel);
  st.position.set(WASH.STATION.x, 0, WASH.STATION.z);
  scene.add(st);
}

// Spray: a short-lived stream of droplets from the wand along where I'm looking.
const SPRAY_N = 90;
const sprayGeo = new THREE.BufferGeometry();
sprayGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPRAY_N * 3), 3));
const sprayPts = new THREE.Points(sprayGeo, new THREE.PointsMaterial({ color: 0xdff4ff, size: 0.07, transparent: true, opacity: 0.85 }));
sprayPts.frustumCulled = false;
scene.add(sprayPts);
const drops = Array.from({ length: SPRAY_N }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() }));
let dropNext = 0;

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
  // Owner playtest 3 §5.3: the hopper and its fill hang on a hinge at the back edge, so it can tip at the return.
  const tipper = new THREE.Group(); tipper.position.set(0, 0.8, 1.35); g.add(tipper);
  const hopper = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.6, 3, 2, 2), new THREE.MeshBasicMaterial({ color: 0x9aa3ad, wireframe: true }));
  hopper.position.set(0, 0.25, -0.3); tipper.add(hopper);
  const fill = new THREE.Mesh(new THREE.BoxGeometry(1.24, 1, 0.54), lambert(0xf4f1e8));
  fill.position.set(0, 0, -0.3); fill.scale.y = 0.001; tipper.add(fill);
  // Whoever's driving.
  const driver = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 4, 10), lambert(0xffffff));
  torso.position.set(0, 1.35, 0.2); driver.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), lambert(0xf1c9a5));
  head.position.set(0, 1.9, 0.2); driver.add(head);
  driver.visible = false; g.add(driver);
  // Mud: splotches that appear as the mud builds up, each at its own threshold.
  const mudMat = lambert(0x5a3d1e), splotches = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12 + Math.random() * 0.12, 8, 6), mudMat);
    const side = i % 4;
    if (side < 2) m.position.set(side ? 0.71 : -0.71, 0.4 + Math.random() * 0.35, -1.1 + Math.random() * 2.2);
    else m.position.set(-0.6 + Math.random() * 1.2, 0.35 + Math.random() * 0.3, side === 2 ? -1.21 : 1.21);
    m.scale.set(side < 2 ? 0.25 : 1, 1, side < 2 ? 1 : 0.25);
    m.userData.at = (i + 0.5) / 16;
    m.visible = false; splotches.push(m); g.add(m);
  }
  scene.add(g);
  return { g, targets, reels, fill, tipper, tipK: 0, driver, torso, body, cage, splotches, reelWidth: 0, flash: 0, wheelSpin: 0, hood };   // round 11: the hood wears the cart paint
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
// Gary from Regional: a white cart flying a Dimples pennant.
let garyView = null;
const garyPose = { x: 60, z: 14, yaw: 0 };
function buildGary() {
  const v = buildCart();
  v.body.material = lambert(0xffffff);
  v.cage.visible = false; v.targets.forEach(t => (t.visible = false)); v.reels.visible = false;
  v.driver.visible = true; v.torso.material.color.set(0x2b3a67);      // navy blazer
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6), lambert(0xcccccc));
  pole.position.set(0.6, 1.6, 1.0); v.g.add(pole);
  const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.35), new THREE.MeshBasicMaterial({ color: 0x1d4d2f, side: THREE.DoubleSide }));
  pennant.position.set(0.9, 2.2, 1.0); v.g.add(pennant);
  const dimples = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  dimples.position.set(0.9, 2.2, 1.005); v.g.add(dimples);
  // Owner playtest 3 §6.1/6.3: his nameplate ("GARY · REGIONAL MANAGER" on his first visit day, "GARY" after) and his
  // speech bubble (while a Rat chats to him). World sprites: +2 draw calls, only while he's on site.
  v.plate = textSprite({ w: 512, scale: 2.6, bg: 'rgba(20,16,32,0.7)', fg: '#ffffff' }); v.plate.sprite.position.y = 2.6; v.g.add(v.plate.sprite);
  v.bubble = textSprite({ w: 512, scale: 2.6, bg: '#fbf6e8', fg: '#2a2418', italic: true }); v.bubble.sprite.position.y = 3.15; v.bubble.sprite.visible = false; v.g.add(v.bubble.sprite);
  v.bubbleEnd = 0;   // seconds left of "Right, then."
  // Round 6 #5: a hat and a right arm, so he can salute a full huddle (v.salute: 1 → 0 over a second).
  v.hat = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 0.12, 12), lambert(0x1d4d2f));
  v.hat.position.set(0, 2.08, 0.2); v.driver.add(v.hat);
  v.arm = new THREE.Group(); v.arm.position.set(-0.3, 1.6, 0.2); v.driver.add(v.arm);
  const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.42, 3, 8), lambert(0x2b3a67));
  arm.position.y = -0.27; v.arm.add(arm);
  v.salute = 0;
  v.notes = 0;     // council round 8 #2: a stall, "taking notes": the same arm up as a clipboard for GARY.STALL s
  return v;
}
// The fleet (council round 4): one view per cart the crew owns, each { ...buildCart(), pose } (mesh, reels, mud, flash).
const cartViews = [];
const cartPose = { x: CART.PARK.x, z: CART.PARK.z, yaw: CART.PARK.yaw, v: 0 };  // where I draw the first cart (cartViews[0].pose)
const pendingCart = new Set();      // balls my cart scooped that the server hasn't confirmed
const crewCarts = () => crew.carts ?? (crew.cart ? [crew.cart] : []);   // the snapshot's carts (or the legacy single cart)
let engine = null;

// ---------------------------------------------------------------- balls
// Every ball on the field is one instance of one mesh: hundreds of balls, one draw call.
const ballMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(SIM.BALL_R, 12, 8), lambert(0xffffff), SIM.MAX_BALLS + 64);   // tinted per instance by kind
ballMesh.setColorAt(0, new THREE.Color(0xf4f1e8));   // allocate instance colours up front
const glowMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(SIM.BALL_R, 12, 8),
  new THREE.MeshBasicMaterial({ color: 0x9dff6a }), SIM.MAX_BALLS + 64);   // glow balls (Last Call): worth ×2
glowMesh.frustumCulled = false; glowMesh.count = 0; scene.add(glowMesh);
const squareMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(SIM.BALL_R * 1.7, SIM.BALL_R * 1.7, SIM.BALL_R * 1.7), lambert(0xffffff), 400);
squareMesh.frustumCulled = false; squareMesh.count = 0; scene.add(squareMesh);
const KIND_COLOR = { range: 0xf4f1e8, lead: 0x7d8790, gold: 0xffc928, splitter: 0x8fd3ff, bouncy: 0xb36bff, square: 0xf4f1e8,
  souvenir: 0xff4f9a, hazard: 0x8cff1a, hazwet: 0x3fd8ff };   // round 11: Stadium souvenirs; County hazards (hazwet: sprayed, views/county.js)
const kindColor = {}; for (const [k, c] of Object.entries(KIND_COLOR)) kindColor[k] = new THREE.Color(c);
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
// Gold balls get a beacon: a soft pillar of light you can see from the stand.
const beaconMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.35, 9, 10, 1, true).translate(0, 4.5, 0),
  new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), 8);
beaconMesh.frustumCulled = false; beaconMesh.count = 0; scene.add(beaconMesh);
// Council round 11 8.11 (A #9): balls vanished at dusk. From T−90 a resting ball past DUSK_BALL.FAR m from the camera
// draws ×1.25, and the ball material gets an emissive lift of 0.35 (material-wide: no new draw call, no per-instance
// shader), so the closing scramble is a hunt you can see.
const DUSK_BALL = { FROM: 90, FAR: 15, SCALE: 1.25, LIFT: 0.35 };
let duskLift = -1;
const oneBeamAt = { x: 0, z: 0, carried: null };   // council round 12 #3a: huddlerules.js oneBeam's out object
function drawBalls() {
  let i = 0, g = 0, q = 0, beacons = 0;
  const dusk = crew?.phase === 'shift' && (crew.shiftSecs ?? 0) - (crew.shiftT ?? 0) <= DUSK_BALL.FROM;
  if ((dusk ? 1 : 0) !== duskLift) { duskLift = dusk ? 1 : 0; ballMesh.material.emissive.setScalar(dusk ? DUSK_BALL.LIFT : 0); squareMesh.material.emissive.setScalar(dusk ? DUSK_BALL.LIFT : 0); }
  const cx = camera.position.x, cz = camera.position.z, far2 = DUSK_BALL.FAR * DUSK_BALL.FAR;
  // Council round 12 #3a (builder 3): Ball No. 1's gold beam takes the first beacon instance: 25 m on the ball while it's
  // down, a 4 m pillar over its carrier (drawn where I see them) while it's carried. No new draw call.
  const ob = oneBeam(crew, balls.values(), oneBeamAt);
  if (ob) {
    const o = ob.carried && ob.carried !== me.id ? others.get(ob.carried)?.g?.position : null;
    const ox = ob.carried === me.id ? me.x : o ? o.x : ob.x, oz = ob.carried === me.id ? me.z : o ? o.z : ob.z;
    const r = oneBeamScale(!!ob.carried, performance.now() / 1000);
    ballM.compose(ballP.set(ox, ob.carried ? ONE_BEAM.CARRY_Y : 0, oz), ballQ, ballS.set(r, ob.carried ? ONE_BEAM.CARRY_SY : ONE_BEAM.SY, r));
    beaconMesh.setMatrixAt(beacons++, ballM);
  }
  for (const b of balls.values()) {
    if (b.hidden || b.kind === 'one' || i >= ballMesh.instanceMatrix.count) continue;   // Ball No. 1 is drawn by ending.js
    // A real ball is sub-pixel past ~40 m; grow far ones so the field reads as dots.
    const s = Math.max(1, Math.hypot(b.x - me.x, b.z - me.z) / 25) * (b.kind === 'glow' ? 1.3 : 1)
      * (dusk && b.rest && (b.x - cx) * (b.x - cx) + (b.z - cz) * (b.z - cz) > far2 ? DUSK_BALL.SCALE : 1);
    ballM.compose(ballP.set(b.x, b.y, b.z), ballQ, ballS.set(s, s, s));
    if (b.kind === 'glow') glowMesh.setMatrixAt(g++, ballM);
    else if (b.kind === 'square') { if (q < squareMesh.instanceMatrix.count) squareMesh.setMatrixAt(q++, ballM); }
    else { ballMesh.setColorAt(i, kindColor[b.kind] ?? kindColor.range); ballMesh.setMatrixAt(i++, ballM); }
    if ((b.kind === 'gold' || b.kind === 'souvenir') && b.rest && beacons < 8) {   // round 11: a souvenir's gold ring
      const pulse = 1 + 0.08 * Math.sin(performance.now() / 300 + beacons);
      ballM.compose(ballP.set(b.x, 0, b.z), ballQ, ballS.set(pulse, 1, pulse));
      beaconMesh.setMatrixAt(beacons++, ballM);
    }
  }
  beaconMesh.count = beacons; beaconMesh.instanceMatrix.needsUpdate = true;
  glowMesh.count = g; glowMesh.instanceMatrix.needsUpdate = true;
  squareMesh.count = q; squareMesh.instanceMatrix.needsUpdate = true;
  if (ballMesh.instanceColor) ballMesh.instanceColor.needsUpdate = true;
  ballMesh.count = i;
  ballMesh.instanceMatrix.needsUpdate = true;
}
function clearBalls() { for (const id of [...balls.keys()]) removeBall(id); }

// ---------------------------------------------------------------- carrying gear
// Built for a body: hand-held things at hand height on the right, the push
// picker rolling on the grass in front. Origin is the person's feet, facing -z.
const steel = TEX.mat('metal', 0x9aa3ad), wire = new THREE.MeshBasicMaterial({ color: 0xc9d1d9, wireframe: true });
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
  } else if (level === 'wand') {   // pressure-washer wand: a yellow gun and a steel lance
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.22), lambert(0xf2c94c));
    gun.position.set(0.32, 0.95, -0.25); g.add(gun);
    const lance = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), steel);
    lance.rotation.x = Math.PI / 2; lance.position.set(0.32, 1.0, -0.75); g.add(lance);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.06, 8), lambert(0x222222));
    tip.rotation.x = Math.PI / 2; tip.position.set(0.32, 1.0, -1.2); g.add(tip);
    const nozzleTip = new THREE.Object3D(); nozzleTip.name = 'nozzleTip'; nozzleTip.position.set(0.32, 1.0, -1.235); g.add(nozzleTip);   // the spray's origin (updateSpray, props.js)
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
  (level !== 'wand' && level >= 3 ? myGear : fpGear).add(gearModel(level));
  gearLevel = level;
}

// ---------------------------------------------------------------- crew mates
const others = new Map();           // id -> { g, to: {x, z, yaw}, down }

const tagTmp = new THREE.Vector3();
// A one-line world sign whose text can change (Gary's plate and bubble): redrawn only when the text does.
function textSprite({ w = 512, scale = 2.6, bg, fg, italic = false }) {
  const c = document.createElement('canvas'); c.width = w; c.height = 64;
  const x = c.getContext('2d'), tex = new THREE.CanvasTexture(c);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sprite.scale.set(scale, scale * 64 / w, 1); sprite.renderOrder = 10;
  let shown = null;
  return { sprite, set(text) {
    if (text === shown) return;
    shown = text;
    x.clearRect(0, 0, w, 64);
    x.font = `${italic ? 'italic ' : ''}600 32px system-ui, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    const tw = Math.min(w - 16, x.measureText(text).width + 40);
    x.fillStyle = bg; x.beginPath(); x.roundRect((w - tw) / 2, 8, tw, 48, 18); x.fill();
    x.fillStyle = fg; x.fillText(text, w / 2, 33, w - 40);
    tex.needsUpdate = true;
  } };
}
function nameTag(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '600 34px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(20,16,32,0.65)'; x.beginPath(); x.roundRect(8, 8, 240, 48, 18); x.fill();
  x.fillStyle = color; x.fillText(text, 128, 33);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(1.6, 0.4, 1); s.renderOrder = 10;
  // Up close a tag would fill the screen (playtest 3: a teenager at the next bay): hide it within 3 m.
  s.onBeforeRender = (r, sc, cam) => { s.material.opacity = Math.min(1, Math.max(0, (s.getWorldPosition(tagTmp).distanceTo(cam.position) - 2.5) / 1.5)); };
  return s;
}

function addMate(p) {
  const g = new THREE.Group();
  const seed = [...p.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  const person = buildPerson({ seed, staff: true, shirt: parseInt(p.color.slice(1), 16), hat: lookHex(p.look?.hat) ?? undefined, vest: lookHex(p.look?.vest) ?? undefined });   // round 11: the stars' cosmetics
  const body = person.root;
  g.add(body);
  const tag = nameTag(p.name, p.color); tag.position.y = (body.userData.height ?? 1.8) + 0.35; g.add(tag);
  if (p.helper) { body.scale.setScalar(0.88); tag.position.y -= 0.2; }
  g.position.set(p.x, 0, p.z);
  scene.add(g);
  others.set(p.id, { g, body, person, tag, gear: null, gearLevel: -1, helper: !!p.helper, lookKey: lookKeyOf(p), to: { x: p.x, z: p.z, yaw: p.yaw }, down: 0, last: { x: p.x, z: p.z } });
}
// What a crewmate is carrying: the bucket and tube are held; the push picker rolls ahead.
function setMateGear(o, level) {
  if (o.gearLevel === level) return;
  o.gearLevel = level;
  o.person.setCarry(level === 'wand' ? 'wand' : level === 1 ? 'tube' : level === 2 ? 'bucket' : 'none');
  if (o.gear) { o.body.remove(o.gear); o.gear = null; }
  if (level !== 'wand' && level >= 3) { o.gear = gearModel(level); o.body.add(o.gear); }
}
const lookKeyOf = p => (p.look ? (p.look.hat ?? '') + '|' + (p.look.vest ?? '') : '');   // round 11: a new look rebuilds the mate
function removeMate(id) { const o = others.get(id); if (o) { scene.remove(o.g); others.delete(id); } }

// ---------------------------------------------------------------- me
const me = { id: null, x: SIM.SPAWN.x, z: SIM.SPAWN.z, yaw: Math.PI / 2, pitch: -0.2, pocket: 0, down: 0, placed: false };
let crew = { phase: 'lobby', day: 1, shiftT: 0, shiftSecs: SIM.SHIFT_SECS, cash: 0, players: [] };
let link = null, seat = null, report = null, paused = false;
const nameOf = id => crew.players.find(p => p.id === id)?.name ?? 'Someone';
const recap = createRecap({ link: () => link, crew: () => crew, report: () => report, me });   // round 11 (builder "today")

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
    document.body.classList.toggle('test-crew', !!m.s.test);   // round 11: the TEST CREW tag (skip ahead)
    if (crew.phase !== 'report') sayer.open();   // a rejoin: nothing replays (the PA card never re-queues), nothing stays locked
    if (!m.s.test) recap.welcome(m);   // round 11: a saved crew coming back sees "Previously on Range Rat" (not a skip-ahead test crew: that night was the bots')
    showPhase();
  } else if (m.k === 'tick') {
    for (const e of m.ev) onEvent(e);
    applySnapshot(m.s);
  } else if (m.k === 'ack') {
    for (const id of m.denied ?? []) { const b = balls.get(id); if (b) b.hidden = false; pending.delete(id); pendingCart.delete(id); }
  }
}

// Round 11, builder "feel": the sweep's word, the bank rattle, the warm tray and the bar's cold mugs.
function feelEvent(e) {
  if (e.t === 'sweep') (e.by === me.id ? m => say('TOAST', m, { key: 'sweep' }) : feed)(e.by === me.id ? (e.bonus ? 'Clean sweep! +1% Hustle.' : 'Clean sweep!') : `${nameOf(e.by)}: clean sweep!`);
  else if (e.t === 'cash' && e.n >= SFX.RATTLE.FROM && e.kind !== 'helper' && e.kind !== 'machine') SFX.rattle(e.n);
  else if (e.t === 'tray') { if (!e.on && e.by === me.id) toast('You carried a hot dog out. Crew fed.', 2); else if (e.on && e.by === me.id) toast(`Spare dog on the warm tray (${e.n}).`, 1.6); }
  else if (e.t === 'deckCold' && e.by === me.id) toast(`On the bar, cold (${e.n}). The next order takes it.`, 1.8);
}
function onEvent(e) {
  r2?.onEvent(e);
  views?.onEvent(e);
  if (e.t === 'story') storyCard.add(e.id);   // round 12: once per crew, the server decides when
  feelEvent(e);
  if (e.t === 'deckFall') onDeckFall(e);   // council round 10 #4: the Deck Cam (views/deck.js plays the fall)
  if (e.t === 'tube' && e.at) { fieldReturns.thunk(); fieldReturns.whoosh(e.at, e.n ?? 8, camera.position); }   // round 11: the batch whooshes home   // council round 10 §C: a pocket went in a field return
  if (e.t === 'auto') { if (e.by === me.id) toast(e.mode === 'harvest' ? 'Autopilot: harvesting.' : 'Autopilot: lapping the Track.', 2); else feed(`${nameOf(e.by)} set the cart to ${e.mode}`); }
  if (e.t === 'clockout' && e.on && e.by !== me.id && e.of > 1) feed(`${nameOf(e.by)} wants to clock out (${e.n} / ${e.of}). Hold ${document.body.classList.contains('pad') ? GLYPH.Y : 'F'} to agree.`);
  if (e.t === 'poach') board.rivalTick('−5 %', 3);   // round 14 #5b (builder 3's hand-off): SITE 13's red tick, 3 s
  if (e.t === 'dispatch') { if (e.by === me.id) { toast('Drones, here!', 2); } else feed(`${nameOf(e.by)}: "Drones, here!"`); dispatchRing.show(e); }
  switch (e.t) {
    case 'spawn': addBall({ id: e.id, x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, rest: false, kind: e.kind, curve: e.curve ?? 0 }); customerSwing(e.x, e.y, e.z); break;
    case 'sink': {
      let b = balls.get(e.id);
      if (!b) { addBall({ id: e.id, x: e.x, y: bedAt(e.x, e.z), z: e.z, vx: 0, vy: 0, vz: 0, rest: true, kind: e.kind }); b = balls.get(e.id); }
      Object.assign(b, { x: e.x, z: e.z, y: bedAt(e.x, e.z), vx: 0, vy: 0, vz: 0, rest: true, sunk: true, drifting: false, drift: null });
      break;
    }
    case 'dive': {
      if (e.id === me.id) toast(e.on ? 'Under the pond. Grab balls before your air runs out.' : 'Surfaced. Bank what you found.', 2);
      const who = e.id === me.id ? me : crew.players.find(p => p.id === e.id);
      if (who && crew.pond?.unlocked) e.on ? scuba.plunge(who.x, who.z, e.id === me.id) : scuba.surface(who.x, who.z, { mine: e.id === me.id, bag: e.bag ?? 0 });
      break;
    }
    case 'sent': {
      e.id === me.id ? toast(`Sent up: ${e.n}.`, 1.6) : feed(`${nameOf(e.id)} sent up ${e.n}`); SFX.scoop();
      const who = e.id === me.id ? me : crew.players.find(p => p.id === e.id);
      if (who) scuba.sendBag(who.x, who.z);   // round 6 #9: the net bag climbs the line to the dock
      break;
    }
    case 'hauled': e.id === me.id ? toast(`Hauled up: ${e.n}. Bank them at the return.`, 2) : feed(`${nameOf(e.id)} hauled up ${e.n}`); SFX.scoop(); break;
    case 'thunk': SFX.bonk(); break;
    case 'treasure':
      if (e.phase === 'carried') (e.by === me.id ? toast : feed)(`${e.by === me.id ? 'You have' : nameOf(e.by) + ' has'} ${TREASURE_BY_ID[e.id]?.name ?? 'something'}. Take it to the return.`, 3);
      if (e.phase === 'sunk') feed(`Something glints in the Deep End: ${TREASURE_BY_ID[e.id]?.name ?? 'an item'}`);
      if (e.phase === 'banked') {
        SFX.jackpot(); scuba.reveal(e.id);   // round 6 #9: its slot in the case spins under a sparkle
        const t = TREASURE_BY_ID[e.id];
        toast(`Recovered: ${t?.name ?? 'an item'}. ${t?.blurb ?? ''} Finder's fee ${money(e.fee ?? 0)}, as a gesture.`, 6);
      }
      break;
    case 'gasp':
      SFX.bonk();
      if (e.id === me.id) { me.placed = false; toast('Out of air! Your bag spilled.', 3); }   // the server put us on the dock: take its position
      else feed(`${nameOf(e.id)} ran out of air`);
      break;
    case 'rest': { const b = balls.get(e.id); if (b) { b.x = e.x; b.z = e.z; b.y = SIM.BALL_R; b.vx = b.vy = b.vz = 0; b.rest = true; b.drifting = false; b.drift = null; } break; }
    case 'drift': {   // the server's word on a ball floating down the creek
      const b = balls.get(e.id);
      if (b) Object.assign(b, { drifting: true, rest: false, vx: 0, vy: 0, vz: 0, y: SIM.BALL_R, drift: { branch: e.branch, s0: e.s0, v: e.v, s: Math.max(e.s0, b.drift?.s ?? e.s0), ...(e.snag != null ? { snag: e.snag } : {}) } });
      break;
    }
    case 'snag': {   // council round 10 #5: on the creekbed, divers only (the glint shows it)
      const b = balls.get(e.id);
      if (b) Object.assign(b, { x: e.x, y: e.y, z: e.z, vx: 0, vy: 0, vz: 0, rest: true, drifting: false, creek: true });
      break;
    }
    case 'mower':
      if (!e.boss && e.phase === 'warn' && e.lane != null) { SFX.horn('mower'); say('ALERT', `MOW-E mows ${laneName(e.lane)} in 12 s. Move!`); }   // the legacy pass (BOSS.ON = 0)
      mowe.event(e); moweEvent(e);   // council round 11 #1 (builder 1): the boss's phases (one centre line each, once a fight)
      break;
    case 'moweHit': case 'moweShove': case 'moweTarget': case 'moweYank': mowe.event(e); break;   // round 13: the yank's creak was never wired
    case 'moweWhistle': mowe.event(e); moweEvent(e); break;   // round 13 #5c: the whistle's sound and its feed line
    case 'moweBank': SFX.scoop(); moweEvent(e); break;   // the tame pet banks at a return: THUNK (the Board said BRINGING n HOME)
    case 'rake':
      for (const m of e.moves ?? []) { const b = balls.get(m.id); if (b) { b.x = m.x; b.z = m.z; b.y = SIM.BALL_R; b.vx = b.vy = b.vz = 0; b.rest = true; } }
      break;
    case 'honk': if (!e.tame || Math.hypot((crew.mower?.x ?? 1e3) - me.x, (crew.mower?.z ?? 1e3) - me.z) < 25) SFX.horn('mower'); break;   // the tame pet's beep is a local one
    case 'garyFed': (e.by === me.id ? toast : feed)(GARY_LINE, 3); break;
    case 'freehelper': if (!fightMuted(crew.mower)) feed(`${e.name} has clocked in to pick up balls. Paid in pizza.`); break;
    case 'custwait': if (playing()) feed(`A customer is waiting for a clean mat (Mat ${e.mat + 1}).`); break;
    case 'refuse': if (playing() && !fightMute.refuse(crew.mower)) feed(e.why === 'nobucket' ? 'No buckets. A customer left.' : `A customer gave up on Mat ${e.mat + 1} and left. Hose the mats!`); break;
    case 'bucket': ballReturn.bucketIn(e.by); if (e.by === me.id) SFX.scoop(); break;   // owner playtest 3 §3.3: a bucket you filled dropped in
    case 'gone':
      if (pendingCart.delete(e.id)) SFX.scoop();
      removeBall(e.id);
      break;
    case 'cash':
      floatPay(e);
      if (e.n > 0) ballReturn.banked(e.n);   // owner layout: they roll down the pipe to the bank
      if (e.by === me.id && !e.target) SFX.cash(e.n);   // round 14 6.5: the cash HUD's pop says it (no centre toast)
      break;
    case 'enthusiasm':
      SFX.ping();
      if (e.stall) {   // council round 8 #2: a crew ball stalls him for GARY.STALL s (3 a visit)
        if (garyView) garyView.notes = GARY.STALL;
        if (e.by === me.id) toast(GARY_STALLED, 2.5); else feed(`${nameOf(e.by)} stalled Gary. He's taking notes.`, 2.5);
      } else (e.by === me.id ? toast : feed)(e.by === me.id ? 'DING. Gary has noted your enthusiasm.' : `${nameOf(e.by)} hit Gary's cart. Gary has noted their enthusiasm.`, 2.5);
      break;
    case 'ping': {
      SFX.ping();
      if (cartViews[e.cart ?? 0]) cartViews[e.cart ?? 0].flash = 1;   // each cart pings on its own
      if (!e.prize) break;
      SFX.jackpot();
      const who = e.by === me.id ? 'You' : nameOf(e.by);
      toast(e.prize === 'jackpot' ? `PING! ${who} hit the cart. JACKPOT: ${e.n} balls hoovered up`
        : e.prize === 'boost' ? `PING! ${who} hit the cart. TURBO for ${CART.BOOST_SECS} seconds`
        : `PING! ${who} hit the cart. Balls are worth ×${e.mult} for the rest of the day`, 3);
      break;
    }
    case 'board': break;
    case 'gary':
      // Playthrough 4 A17: no seconds in the warning (solo's is longer), and no "stay out of his way" while stall lines are up.
      if (e.phase === 'warn') { SFX.horn('gary'); garyGate.reset(); say('ALERT', "Gary's coming: clean up, then huddle.", { key: 'gary' }); garySays = { text: garyHello(crew.venue), t: Infinity, near: false, pop: 0 }; }   // round 12: his hello, in his bubble (council round 11 8.9: his whole wait)
      // Council round 14 6.4 (builder 4): the drive's line only when it can hold its 3 s (nothing at ALERT up or queued),
      // else it's skipped (it was up < 1 s)
      else if (!sayer.centre.busy(PRI.ALERT)) say('ALERT', Object.values(crew.mods?.nudge ?? {}).includes('gary:stall') ? "Gary's driving. Ping him or huddle." : 'Gary is inspecting. Stay out of his way.', { key: 'gary', secs: Math.max(SAY.SECS.ALERT, GARY_LINES.INSPECT_HOLD) });
      break;
    case 'garyChat':   // §6.3: no PA, no centre text: the chatter's feed line, and his "Right, then." when it ends
      if (e.on && e.by === me.id) feed(CHAT_FEED);
      if (!e.on && garyView) garyView.bubbleEnd = 1;
      break;
    case 'garyIntro':   // §6.1: he lifts his clipboard at the crew as he passes the return
      if (e.phase === 'wave' && garyView) garyView.notes = GARY.STALL;
      break;
    case 'check': {
      const names = { sign: 'Sign', mats: 'Mats', cart: 'Cart', stand: 'Stand', kitchen: 'Kitchen' };
      board.floatText(e.x, 3.2, e.z, `${e.ok ? '✓' : '✗'} ${names[e.stop] ?? e.stop}`, e.ok ? '#6fcf7c' : '#ff6b5b');
      (e.ok ? SFX.cash : SFX.bonk)(1);
      if (!e.ok) garyGate.failedCheck();   // round 14 6.4: the stall/chat lines may show from now on (once each)
      break;
    }
    case 'huddleCall':   // council round 13 8.6 (builder 4, B #11): the far and diving Rats are called to Gary's huddle
      feed(huddleLine(e.calls, nameOf));
      if (e.calls?.some(c => c.id === me.id)) edgeChev.show(SIM.STAND.x, SIM.STAND.z, HUDDLE_CALL.CHEVRON);
      break;
    case 'verdict':
      if (e.gained) SFX.jackpot();
      garySays = null; { const won = !!(e.moweWon ?? crew.moweBeat); setTimeout(() => feed('Gary: “' + garyBye(crew.venue, won) + '”'), 4200); }   // round 12: "Saw the mower" once after a Club win (builder 1's moweBeat)   // round 12: his sign-off (the feed: edge text), after his verdict line
      if (e.huddle && garyView) garyView.salute = 1;   // round 6 #5: hat up, arm up (round2.js adds the confetti puff)
      say('ALERT', e.seal ? SEAL_LINE   // owner playtest 3 §6.4: a sealed huddle (replaces the verdict line, never stacks)
        : e.gained   // playtest round 2 #11: 8 words or fewer
        ? `Gary approves. +${e.gained} commendation${e.gained > 1 ? 's' : ''}.`
        : `Gary found ${e.fails} problems. No commendation.`, { key: 'gary', secs: 4 });
      break;
    case 'served':
      if (e.item === 'beer' && e.quality !== 'burnt') beersPoured++;
      if (e.by === me.id && e.n) toast(`+${e.n} for Fry Satisfaction`, 1.5);
      if (e.by === me.id && e.float) kitchen.payoff(e.float);   // playthrough 5 B12: the SERVED card shows the payoff
      break;
    case 'fries':
      if (e.by === me.id) { SFX.scoop(); toast(`A basket of fries (${e.stock}/${FRIES.MAX})`, 1.2, 'fries'); }
      break;
    case 'debut':   // council round 11 #3: the morning memo said it; the first ball only floats "NEW ×1.5" (no memo)
      SFX.jackpot();
      debutFloatOn(e.id, debutFloat(e.kind, e.told !== false), e.x, e.z);
      break;
    case 'landed': case 'winch': {   // council round 11 8.8: what a piece of debris brings home (only the Orbital's climb counts it)
      const n = e.t === 'winch' ? 1 : e.n ?? 0;
      if (n > 0 && crew?.venue === 5 && !crew.endless) board.floatText(LIFT.x, 3.2, LIFT.z, debrisHomeText(n, debrisBalls(1, crew.goals?.crew ?? crew.players.filter(p => p.online).length)), '#9fe8ff');
      break;
    }
    case 'kick': { const b = balls.get(e.id); if (b) Object.assign(b, { x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz, rest: false, acc: 0 }); break; }
    case 'memo':
      if (!e.quiet) showMemo(e.text, e.target, e.story ? SAY.STORY_MEMO : SAY.SECS.MEMO, e.today ? 'TODAY · ' + e.today : e.flavor);   // council round 11 #3: 5 s on a story morning   // round 11: Today's line takes the flavour's slot   // a PA line in the same tick still goes first (PA outranks MEMO)
      break;
    case 'rally': rallyLine(e); break;   // the gauge slipped, or the 30 s re-check (the bell lock drops it after the bell)
    case 'lastcall': {   // the Closing Bell (round 6 #3): the horn, then the server's one-line rally (null when endless)
      SFX.horn();
      rallyLine(e);   // an ALERT: waits behind a PA card or a memo (15 s at most); never after the bell
      break;
    }
    case 'quota':   // the bell's verdict: one short line (the stamp's slot); the report card waits 2 s and carries the numbers
      stampUntil = performance.now() + 2000; setTimeout(showPhase, 2050);
      // The bell, then the stamp (board.js): the one centre element, so any toast clears. APPROVED: jackpot + confetti;
      // DENIED: the trombone, with the reason (<= 8 words) under it.
      SFX.bell?.();
      sayer.bell();   // the bell lock: queued toasts drop, PA cards and memos wait for the report to close
      setTimeout(() => {
        const st = { ...e, why: e.why ?? (e.idle ? 'Missed: nothing was banked today.' : 'Missed: Upkeep under the target.') };
        say('STAMP', e.hit ? 'APPROVED' : `DENIED. ${st.why}`, { data: { show: () => { board.stamp(st, { low: perf.low }); (e.hit ? SFX.jackpot : SFX.trombone)?.(); } } });
      }, 450);
      break;
    case 'spotless':
      SFX.jackpot();
      toast(e.target && !/^cart\d?$/.test(e.target)
        ? `Spotless ${e.target.startsWith('mat') ? 'mat' : e.target}! Curb Appeal is up`
        : 'Spotless! The cart pays full price again.', 3);   // owner playtest 3 §1.4: the one price
      // §1.3: "+$0.05 a ball" over the fixture, green, for the hoser only (world text; the others see its pip turn green).
      if (e.gain && e.by === me.id && FIXTURE_BY_ID[e.target]) board.floatText(FIXTURE_BY_ID[e.target].x, 2.2, FIXTURE_BY_ID[e.target].z, gainText(e.gain), '#6fd36f');
      break;
    case 'buy': {
      const item = SHOP.find(i => i.id === e.id);
      // Playthrough 4 A16/A19: one short toast, then the item's tip jumps the queue (about 3 s after the buy).
      (e.by === me.id ? toast : feed)(`${e.by === me.id ? 'You' : nameOf(e.by)} bought: ${item?.tiers[e.level]?.name ?? e.id}`, 1.4);
      hinter.bought(e.id);
      break;
    }
    case 'knock': {
      SFX.bonk();
      const how = e.by === 'cart' ? 'got run over by the cart' : e.by === 'gary' ? 'got run over by Gary from Regional' : 'got knocked flat';
      if (e.id === me.id && e.by === 'mower') { const t = mowedLine(moweMowed, performance.now() / 1000); if (t) toast(t, 2.4); }   // council round 14 #4d (builder 1): the long line once a fight, then "Mowed again!" at most every 20 s
      else if (e.id === me.id) toast(e.by === 'cart' ? 'You got run over by the cart.' : e.by === 'gary' ? 'Gary ran you over. He did not slow down.' : 'BONK. You got knocked flat.', 2.4);
      else if (nameOf(e.id) === 'Someone' && crew.helpers?.some(h => h.id === e.id)) {   // council round 11 8.10: helper falls aggregate, one feed line a minute
        const line = helperFalls.add(`${crew.helpers.find(h => h.id === e.id).name} ${how}`);
        if (line) feed(line); else if (!helperFallsT) helperFallsT = setTimeout(function due() { const l = helperFalls.due(); if (l) feed(l); helperFallsT = helperFalls.held ? setTimeout(due, 1000) : 0; }, Math.max(0, helperFalls.until - performance.now() / 1000) * 1000 + 50);
      } else feed(`${nameOf(e.id)} ${how}`);
      break;
    }
    case 'join': if (e.id !== me.id) { feed(`${e.name} joined the crew`); if (crew.phase === 'shift') toast(`${e.name} joined mid-shift`, 2.2); } break;
    case 'leave': removeMate(e.id); break;
    case 'shift':
      report = e.report ?? null;
      if (e.phase === 'report') pace.record(report, { venueName: VENUE_RULES[report?.venue ?? 0]?.name, value: crew.value, debris: crew.mods?.orbit?.d?.length });
      if (e.phase === 'shift') me.placed = false;   // no 'range is open' toast: the PA line and the memo say it (one thing at a time)
      crew.phase = e.phase;
      if (e.phase !== 'report') sayer.open();   // the report closed: held PA cards and memos go
      if (e.phase !== 'report') dusk.stop();    // clock-in: the stand-ins go, the real avatars and the camera are back
      else stampUntil = dusk.queue({ at: stampUntil, ending: !!report?.ending, left: report?.left ?? null /* round 12, 9.9: the server's count */, onDone: () => { stampUntil = 0; showPhase(); } }) ?? stampUntil;   // the walk-off, then the card
      showPhase();
      break;
  }
}

// The Last Call rally line (round 6 #3; dealt per Rat in round 7 #4): one ALERT, keyed so a re-check updates it.
function rallyLine(e) {
  const line = e.needs?.[me.id] ?? e.need;
  if (line && crew.phase === 'shift') say('ALERT', line, { key: 'rally' });
}

// Your own banks: the cash HUD's pop (round 14 6.5, below); they were "+$32.50 · 8 × $4.06" over you (council round 6 #7). Helpers, drones, gutters, the tether
// and a driverless cart roll into one "+$1,240 · 31" over the stand every 2 s; other Rats' big banks go to the feed.
// Council round 13 #2b: no pops while a priority 0–1 centre item, the hush or a story card is up; at most 2 up; one
// source's pops within 1.5 s merge into "+$51.98 ×7".
const popsHidden = () => (sayer.centre.up()?.pri ?? 9) <= PRI.ALERT || storyCard.up || !!r2?.hushing;
const payRoll = createRoller(({ cash, n }) => { if (!popsHidden()) board.floatText(SIM.STAND.x, 2.4, SIM.STAND.z, `+${money(cash)} · ${n}`, '#ffd54a'); });
// Council round 14 6.5 (A #5, builder 4): your own banks pop by the cash HUD (top left), counting up, and never claim
// the centre (no own-bank toast, no world float over you). payfloat.js createHudPop; drawn by a short rAF loop that
// stops once the pop has faded (no per-frame cost while idle).
const hudPop = createHudPop();
let hudPopEl = null, hudPopOn = false, hudPopWash = false;
function hudPopDraw() {
  const now = performance.now() / 1000, o = hudPop.opacity(now);
  if (!hudPopEl) { hudPopEl = document.createElement('span'); hudPopEl.id = 'cash-pop'; hudPopEl.style.cssText = 'margin-left:0.5em;color:#ffd54a;font-weight:800;transition:none;pointer-events:none'; $('cash')?.after(hudPopEl); }
  hudPopEl.textContent = o > 0 ? `+${money(hudPop.value(now))}${hudPopWash ? ' + wash' : ''}` : '';
  hudPopEl.style.opacity = String(o);
  if (o > 0) requestAnimationFrame(hudPopDraw); else { hudPopOn = false; hudPopWash = false; }
}
function floatPay(e) {
  const route = payRoute(e, me.id, crew.players.map(p => p.id));
  if (route === 'roll') { payRoll.add(e.cash, e.n); return; }
  if (route === 'rat') { if (e.n >= PAYFLOAT.RAT_FEED_MIN) feed(`${nameOf(e.by)} banked ${money(e.cash)} · ${e.n}`, crew.players.find(p => p.id === e.by)?.color); return; }
  hudPop.add(e.cash, performance.now() / 1000); if (popupLine(e).wash) hudPopWash = true;
  if (!hudPopOn) { hudPopOn = true; requestAnimationFrame(hudPopDraw); }
}
// Council round 11 #3: a kind's first ball wears a world float once it lands (polled, ≤ 6 s; no per-frame work).
function debutFloatOn(id, text, x, z, n = 0) {
  const b = id != null ? balls.get(id) : null;
  if (b && !b.rest && n < 40) { setTimeout(() => debutFloatOn(id, text, x, z, n + 1), 150); return; }
  board.floatText(b?.x ?? x ?? SIM.STAND.x, (b?.y ?? 0) + 1.4, b?.z ?? z ?? SIM.STAND.z, text, '#ffd54a');
}
// Memos (the morning memo, reveal cards) are MEMO items in the queue: they wait their turn, never knock.
function showMemo(text, target, secs = 7, flavor = '') {
  // Owner playtest 3 §1.2: the memo's target is the bar's % ("Today: 60% clean by the bell." already says it).
  say('MEMO', text, { secs, data: { flavor: flavor ?? '', target: target != null && !text.includes(target + '%') ? `TARGET  ${target}%` : '' } });
}

let spawnT = Infinity;               // council round 13 #6: seconds since clock-in, for the pitch ease
let wandAt = 0;                     // when I grabbed the wand (playtest round 2 #10: the full prompt for 3 s, then "Click spray")
let my = perks();                   // what the crew's upgrades add up to
let gp = gearPerks(0);              // what my own carrying gear adds up to
function applySnapshot(s) {
  crew = s;
  { const el = $('cash'); if (el) el.textContent = money(s.cash ?? 0); }   // playthrough 5 B9: a rejoin's first snapshot shows the real cash (not $0 until it changes)
  if (paused) pauseGoals();   // council round 10 #1: the Goals panel stays live while paused
  my = perks(s.up);
  if (s.mats) crowd.sync(s.mats, s.ct);
  bayLine.update(s, r2?.venueParts);   // round 11 (owner): only the built bays exist; a new one looks fresh for its first day
  const mine = s.players.find(p => p.id === me.id);
  if (mine && !me.placed) { me.x = mine.x; me.z = mine.z; me.yaw = mine.yaw; me.pitch = (s.venue ?? 0) >= SPAWN_PITCH.VENUE_FROM ? SPAWN_PITCH.FROM : 0; me.placed = true; spawnT = s.phase === 'shift' ? 0 : Infinity; }   // clocked in at the yard (round 13 #6: the pitch eases down at venues ≥ 1)
  me.gear = mine?.gear ?? 0; if (!!mine?.wand && !me.wand) wandAt = performance.now(); me.wand = !!mine?.wand;   // the wand's full prompt runs 3 s from here
  me.diving = !!mine?.diving; me.creek = !!mine?.creek; me.dive = mine?.dive ?? 0; me.air = mine?.air ?? diveTiers(me.dive).air; me.bag = mine?.bag ?? 0; me.treasure = mine?.treasure ?? null;
  { // the Lost & Found case and the treasure glinting in the Deep End
    const lf = s.pond?.lostFound ?? [], lk = lf.join(',');
    if (lk !== lostFoundKey) { lostFoundKey = lk; scuba.setFound(lf); }
    const t = s.pond?.treasure, tk = t ? `${t.id}@${t.x.toFixed(2)},${t.z.toFixed(2)}` : '';
    if (tk !== treasureShown) { treasureShown = tk; t ? scuba.setTreasure(t.id, t.x, t.z) : scuba.setTreasure(null); }
    scuba.setMates(s.players.filter(p => p.diving));   // round 6 #9: the surface boil over every diver
  }
  me.grime = mine?.grime ?? 0; me.one = !!mine?.one;
  shedSign.boards.visible = !s.fries?.open;
  shedSign.fries.scale.y = Math.max(0.05, (s.fries?.stock ?? 0) / FRIES.MAX);
  gp = gearPerks(me.gear);
  const held = me.wand ? 'wand' : me.gear;
  if (held !== gearLevel) setMyGear(held);
  applyCarts(s.carts ?? (s.cart ? [s.cart] : []));
  paintFixtures(s.fixtures);
  const v = s.value ?? {};
  board.update({ bv: v.bv, rate: v.rate, upkeep: v.upkeep, hustle: v.hustle, curb: v.curb, pond: s.pond?.unlocked ? v.pond ?? 0 : null, fries: s.fries?.open ? v.fries ?? 0 : null,
    kpiLabel: VENUE_RULES[s.venue ?? 0]?.kpi ?? null, kpi: v.kpi ?? null, kpiNote: kpiNoteOf(s.mods), slogan: views?.banner(s) ?? null,   // round 4: the venue's own gauge
    quota: s.quota?.target ?? null, pace: s.pace ?? null, outstanding: s.outstanding, lastCall: s.lastCall, title: s.title, silo: siloFill(s.silo, s.filled), live: s.phase === 'shift',
    // Owner playtest 3 §1.1/§6.4 (builder 1): the price, the bar's ceiling and target share, the pips, the Seal, the banner.
    price: priceOf(v, s.seal ?? v.seal ?? 1), seal: s.seal ?? v.seal ?? 1, ceiling: ceilingOf(v), q: s.quota?.q ?? null, venue: s.venue ?? 0,
    fixtures: s.fixtures, nMats: s.nMats, garyToday: s.phase === 'shift' && !!s.garyToday && !s.gary,
    // Council round 10 (builder 1): the goal strip (goals.js strip), the FED chip and its ring.
    goals: s.goals?.strip ?? null, fed: v.fed ?? 1, fedLeft: s.fedRing ?? 0,
    today: s.phase === 'shift' ? s.today?.chip ?? null : null, stars: s.endless ? s.stars ?? 0 : null,   // round 11 (builder "today"): the Board's TODAY chip, endless stars
    contract: s.endless && s.phase === 'shift' ? contractLineOf(s.contract, goalText, starText) : null, rival: s.endless ? rivalLineOf(s.rival) : null,   // council round 12 (builder 4): 6c, 8
    gary: s.gary?.phase === 'warn' ? `GARY FROM REGIONAL · 0:${String(Math.ceil(s.gary.t)).padStart(2, '0')}` : s.gary?.phase === 'drive' ? garyCountdown(s.gary) ?? 'GARY IS INSPECTING' : moweBoard(s.mower) });   // council round 11 #1: the boss, the tame pet
  // Owner playtest 3 §6: he's on show through his warning too (parked at the gate, where you can chat to him), and
  // on the once-ever drive-by (s.garyIntro).
  // Round 11: on Promotion Day he rides along again once his verdict is in (s.garyIntro.ride).
  const gw = (s.gary && !(s.gary.phase === 'done' && s.garyIntro?.ride) ? s.gary : null) ?? (s.garyIntro ? { ...s.garyIntro, phase: 'intro' } : null);
  if (gw) {
    if (!garyView) { garyView = buildGary(); Object.assign(garyPose, { x: gw.x, z: gw.z, yaw: gw.yaw }); }
    garyView.g.visible = gw.phase === 'drive' || gw.phase === 'warn' || gw.phase === 'intro' || garyView.salute > 0;   // he stays for his salute
    garyView.to = gw;
    garyView.plate.set(garyPlate(!!gw.first));
  } else if (garyView) garyView.g.visible = false;
  floods.forEach(l => { l.intensity = floodsOn(s.phase === 'shift' ? s.today : null, s.lastCall) ? FLOOD_I : 0; });   // round 11: Night Range keeps them on
  const seen = new Set();
  const people = [...s.players, ...(s.helpers ?? []).map(h => ({ ...h, helper: true, color: '#b9c0c8', online: true }))];
  for (const p of people) {
    seen.add(p.id);
    if (p.id === me.id) { me.pocket = p.pocket; me.down = p.down; continue; }
    if (others.has(p.id) && others.get(p.id).lookKey !== lookKeyOf(p)) removeMate(p.id);   // round 11: they changed hats overnight
    if (!others.has(p.id)) addMate(p);
    const o = others.get(p.id);
    o.to = { x: p.x, z: p.z, yaw: p.yaw }; o.down = p.down;
    o.g.visible = (p.online || p.down > 0) && !p.diving && !(s.carts ?? [s.cart]).some(c => c?.driver === p.id);   // drivers are drawn in their cart; divers are the boil
    setMateGear(o, p.helper ? 1 : p.wand ? 'wand' : p.gear ?? 0);
  }
  for (const id of [...others.keys()]) if (!seen.has(id)) removeMate(id);
  renderRoster();
  renderShop();
  r2?.onSnapshot(s);
  recap.render();   // round 11 (builder "today"): the report's Today / contract / locker panel
  views?.onSnapshot(s);     // after r2: venues.js has built this venue's parts by now
}

// The carts from the server. While I drive one, my own pose is the truth and the
// server's is only for everyone else; when I climb in, I start from its pose.
let wasCart = -1;                   // the cart I drove last snapshot (-1: on foot)
const myCartIdx = () => crewCarts().findIndex(c => c.driver === me.id);
const driving = () => myCartIdx() >= 0;
const myPose = () => cartViews[myCartIdx()]?.pose ?? cartPose;        // the pose of the cart I drive
function applyCarts(list) {
  list.forEach((c, i) => {
    let v = cartViews[i];
    if (!v) {
      v = cartViews[i] = buildCart();
      v.pose = Object.assign(i ? {} : cartPose, { x: c.x, z: c.z, yaw: c.yaw, v: 0 });
    }
    setReels(v, my.cartReel);
    const d = c.driver && crew.players.find(p => p.id === c.driver);
    v.driver.visible = !!d;
    if (d) v.torso.material.color.set(d.color);
    v.hood?.material.color.setHex(lookHex(crew.cartPaint) ?? 0x2e7d4f);   // round 11: the crew's cart paint (stars)
  });
  const mine = list.findIndex(c => c.driver === me.id);
  if (mine >= 0 && mine !== wasCart) { const c = list[mine]; Object.assign(cartViews[mine].pose, { x: c.x, z: c.z, yaw: c.yaw, v: 0 }); pendingCart.clear(); }
  if (mine < 0 && wasCart >= 0) {
    // I got out (or lost the cart): stand on the driver's side, facing where it faces.
    const P = cartViews[wasCart]?.pose ?? cartPose;
    me.x = P.x - Math.cos(P.yaw) * 1.4; me.z = P.z + Math.sin(P.yaw) * 1.4; me.yaw = P.yaw;
    pendingCart.clear();
  }
  wasCart = mine;
}

// ---------------------------------------------------------------- the shop
// Rendered into the lobby and the overnight report. Only re-rendered when
// something it shows changes, so controller focus survives the 10 Hz ticks.
let shopKey = '';
function renderShop() {
  const size = Math.max(1, crew.players.filter(p => p.online).length);   // the server prices by Rats online
  const day = shopDay(crew.phase, crew.day ?? 1), vday = shopVday();
  const goalIds = goalShopIds(crew.goals?.rows);   // playthrough 5: a row the card asks for wears ✦ GOAL
  const key = JSON.stringify([crew.cash, crew.up, size, crew.phase, me.gear, me.dive, crew.venue, day, vday, [...goalIds], crew.mods?.poach?.price, crew.mods?.poach?.dbl]);
  if (key === shopKey) return;
  shopKey = key;
  const root0 = menuRoot(), memo = focusMemo(document.activeElement, root0);   // §7.3: focus survives the re-render
  const order = root0 ? [...root0.querySelectorAll('[data-buy]')].map(el => el.dataset.buy) : [];
  const scale = priceScale(size);
  const html = `<h3>${crew.phase === 'report' ? 'Overnight shop' : 'Shop'} <span>${money(crew.cash)} to spend</span></h3>
    ${size > 1 ? `<p class="note">Prices are ×${scale.toFixed(1)} for a crew of ${size}.</p>` : ''}
    <ul>${shopSort(SHOP.filter(item => shopShows(item, crew.venue ?? 0, day, crew.endless, size, vday)),   // playthrough 3: the Owner's projects first in endless
      { endless: !!crew.endless, maxed: item => !item.tiers[(item.personal ? (item.id === 'dive' ? me.dive ?? 0 : me.gear ?? 0) : crew.up?.[item.id] ?? 0) + 1] })   // playthrough 5: maxed rows last
      .map(item => {
      const mineLvl = item.id === 'dive' ? me.dive ?? 0 : me.gear ?? 0;
      const lvl = item.personal ? mineLvl : crew.up?.[item.id] ?? 0, now = item.tiers[lvl], next = item.tiers[lvl + 1];
      const price = item.repeat === 'day' ? crew.mods?.poach?.price ?? null : nextPrice(item.id, crew.up, size, mineLvl, crew.venue ?? 0, day, crew.endless, vday);   // council round 13 #4b (builder 2): the poach is priced off yesterday (s.mods.poach)
      return `<li>
        <div><b>${item.title}</b>${next && goalIds.has(item.id) ? ' <span class="goal-tag">✦ GOAL</span>' : ''}: ${now.name}${next ? `<small>Next: <i>${next.name}</i><span class="desc">. ${next.desc}</span></small>` : `<small>${now.desc} (maxed out)</small>`}</div>
        ${!next ? '<span class="max">✓</span>' : price == null ? `<span class="max">🔒 ${item.repeat === 'day' ? 'Tomorrow' : tierLock(item, lvl, crew.venue ?? 0, day, vday) ?? VENUE_RULES[next.minVenue ?? item.minVenue ?? 0]?.name ?? 'later'}</span>` : `${item.repeat === 'day' && poachShopTag(crew.mods?.poach) ? `<span class="goal-tag">${poachShopTag(crew.mods?.poach)}</span> ` : ''}<button data-buy="${item.id}" ${price > crew.cash ? 'disabled' : ''}>${money(price)}</button>`}
      </li>`;
    }).join('')}</ul>`;
  for (const el of document.querySelectorAll('.shop')) el.innerHTML = html;
  // A Buy you can no longer afford hands focus to the next Buy along, never to Next shift (menufocus.js).
  if (memo?.buy && root0 && !root0.contains(document.activeElement)) focusRestore(memo, navTargets(root0), root0.id, order)?.focus();
}
// Owner playtest 3: the report's and the lobby's shop sit collapsed behind a Shop button beside Next / Open the
// range (the in-shift store is unchanged). Ⓐ on it opens the shop, again (or Ⓑ) folds it; a new card opens folded.
function setShopOpen(card, on) {
  const shop = card?.querySelector('.shop'), btn = card?.querySelector('.shop-toggle');
  if (!shop || !btn) return;
  shop.classList.toggle('collapsed', !on);
  btn.setAttribute('aria-expanded', String(!!on));
  btn.textContent = on ? 'Hide shop' : 'Shop';
}
const shopOpenIn = card => !!card?.querySelector('.shop') && !card.querySelector('.shop').classList.contains('collapsed');
document.addEventListener('click', e => {
  const tg = e.target.closest?.('.shop-toggle');
  if (tg) { const card = tg.closest('.card'); setShopOpen(card, !shopOpenIn(card)); }
});
document.addEventListener('click', e => {
  const id = e.target.closest?.('[data-buy]')?.dataset.buy;
  if (id && link) link.act({ t: 'buy', id });
});

// ---------------------------------------------------------------- actions
function nearestBall(reach = gp.reach) {
  let best = null, bd = reach;
  for (const b of balls.values()) {
    if (b.hidden || b.y > 0.4 || !!b.sunk !== !!me.diving) continue;
    const d = Math.hypot(b.x - me.x, b.z - me.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
const carrying = () => me.pocket + pending.size;
const playing = () => link && crew.phase !== 'lobby' && !paused && !menuOpen();

// A free cart within reach (the server boards the nearest one).
const nearCart = () => crewCarts().some((c, i) => !c.driver && cartViews[i] && Math.hypot(cartViews[i].pose.x - me.x, cartViews[i].pose.z - me.z) < CART.BOARD_REACH);
const canSwing = () => crew.phase === 'shift' && atBay(me) && me.pocket > 0 && !driving() && !me.wand;
// Council round 10 §D: Ⓨ / F held. At an undriven cart with Autopilot owned, a tap still climbs in and a 0.6 s hold
// switches it lap <-> harvest. On foot at the County with drones and no cart near, a 0.6 s hold is "Drones, here!".
let yHold = null;   // { kind: 'auto' | 'dispatch' | 'clockout', t, sent? }
// Playthrough 5: "Card done · clock out". The server offers it (crew.clockOut = { n, of }) once the card is done; a Rat
// votes by holding Ⓨ / F away from a cart (CLOCKOUT_HOLD s first, so a stray tap never rings the bell), and letting
// go takes the vote back. Every online Rat holding rings the bell now (solo: at once). It outranks "Drones, here!".
const CLOCKOUT_HOLD = 0.6;
const canClockOut = () => !!crew.clockOut && playing() && !driving() && !nearCart() && !me.diving;
function clockOutRelease() { if (yHold?.kind === 'clockout' && yHold.sent) link?.act({ t: 'clockout', on: false }); }
const autoOwned = () => !!my.autopilot && (crew.venue ?? 0) >= 3;
const dronesOwned = () => !!crew.mods?.county?.drones?.length && crew.phase === 'shift';
const nearAutoMode = () => {   // the mode of the undriven cart in reach ('lap' | 'harvest'), or null
  const i = crewCarts().findIndex((c, k) => !c.driver && cartViews[k] && Math.hypot(cartViews[k].pose.x - me.x, cartViews[k].pose.z - me.z) < CART.BOARD_REACH);
  return i < 0 ? null : crew.mods?.stadium?.auto?.[i] ?? 'lap';
};
function cartPress() {
  if (!playing() || me.down > 0) return;
  if (canClockOut()) { yHold = { kind: 'clockout', t: 0 }; return; }
  if (!driving() && nearCart() && autoOwned()) { yHold = { kind: 'auto', t: 0 }; return; }
  if (!driving() && !nearCart() && dronesOwned() && !me.diving) { yHold = { kind: 'dispatch', t: 0 }; return; }
  interact('cart');
}
function cartRelease() {
  clockOutRelease();
  const h = yHold; yHold = null;
  if (h?.kind === 'auto' && h.t < AUTO.HOLD_SECS) interact('cart');   // a tap: climb in
}
function cartHoldTick(dt) {
  if (!yHold) return;
  if (!playing() || me.down > 0 || driving()) { clockOutRelease(); yHold = null; return; }
  if (yHold.kind === 'clockout') {   // held: the vote stays in until release (the server clears it at the bell)
    if (!crew.clockOut) { yHold = null; return; }
    if ((yHold.t += dt) >= CLOCKOUT_HOLD && !yHold.sent) { yHold.sent = true; link.act({ t: 'clockout', on: true }); }
    return;
  }
  if ((yHold.t += dt) < (yHold.kind === 'auto' ? AUTO.HOLD_SECS : DISPATCH.HOLD_SECS)) return;
  link.act({ t: yHold.kind === 'auto' ? 'auto' : 'dispatch' });
  yHold = null;
}   // owner playtest 3 §7.1: no swinging a pressure washer

// Separate buttons, so no action ever has to guess:
//   use    (left click / Space / Ⓐ): pick up a ball, or hold at a crew bay to swing
//   bucket (E / Ⓧ): drop balls in the bucket stand, grab or stow the washer wand
//   cart   (F / Ⓨ): get in or out of the cart (it parks right by the washer)
function interact(only = null) {
  if (!playing() || me.down > 0) return;
  if (only !== 'cart' && views?.interact()) return;      // a venue view's own action (ride the Lift, ...)
  if (only !== 'bucket') {
    if (driving()) { link.act({ t: 'leave' }); return; }
    if (nearCart()) { link.act({ t: 'board' }); return; }
  }
  if (only === 'cart') return;
  if (me.diving) { if (me.bag > 0) link.act({ t: 'send' }); return; }                      // clip the bag to the line
  if (dockOpen(me) && (crew.pond?.line ?? 0) > 0) { r2?.haulBegin(); return; }            // hold to haul the bag up
  if (crew.pond?.unlocked && hasTube(crew.up) && atTube(me) && (carrying() > 0 || me.treasure)) { link.act({ t: 'feed' }); return; }
  if (atFieldRet(me) && (carrying() > 0 || me.treasure)) { link.act({ t: 'feed' }); return; }   // council round 10 §C: send them home
  if (atStand(me) && (carrying() > 0 || me.one || me.treasure)) { link.act({ t: 'deposit' }); return; }   // Ball No. 1 rides outside the pocket
  if (me.wand || nearStation()) link.act({ t: 'wand' });
}
// The pond is drained (and its dock closed) until the Club turns the water on.
const wetPond = p => !!crew.pond?.unlocked && inPond(p), dockOpen = p => !!crew.pond?.unlocked && onDock(p);
// Council round 10 #5: diving in Dimple Creek (from the Club; the server ducks you under after 2 s in the water).
const creekDiving = p => !!p.diving && !!p.creek;   // the snapshot's players[].creek (crew.mjs creekStep)
const nearStation = () => Math.hypot(me.x - WASH.STATION.x, me.z - WASH.STATION.z) < WASH.GRAB;
function act() {
  if (!playing() || me.down > 0 || driving()) return;
  if (me.diving) {
    const tr = crew.pond?.treasure;
    if (tr && !me.treasure && Math.hypot(tr.x - me.x, tr.z - me.z) <= POND.REACH + 0.5) { link.act({ t: 'treasure' }); return; }
    if (me.bag + pending.size >= diveTiers(me.dive).bag) { toast(`Bag full: send it up (${document.body.classList.contains('pad') ? GLYPH.X : 'E'}) or surface`); return; }
    const b = nearestBall(POND.REACH);
    if (b) grab(b);
    return;
  }
  // Playthrough 4 C1: Ball No. 1 rides outside the pocket, so a full one never blocks it (actpick.js).
  const pick = actPick({ near: nearestBall(), carrying: carrying(), pocket: gp.pocket, scoop: !!gp.scoop, holdingOne: me.one });
  if (pick?.full) { toast('Full: take them to the ball return'); return; }
  if (pick?.grab) grab(pick.grab);
}

// ---- swinging at a crew bay ------------------------------------------------
let spraying = false, washSecs = 0, washSent = 0;
// Round 6 #4: what the landing ring needs each frame (the Tiered view draws it): your aim and the backswing's power,
// or your last swing's power before you wind up. null away from a crew bay or with empty pockets.
let aimPower = 0.7;
function aimInput() {
  if (!playing() || !canSwing() || me.down > 0) return null;
  const bay = BAYS.find(b => Math.hypot(me.x - b.x, me.z - b.z) < 1.4);
  if (!bay) return null;
  const st = swing.state, power = st.phase !== 'idle' && st.power > 0.04 ? st.power : aimPower;
  return { bay, yaw: me.yaw, pitch: me.pitch, power, color: crew.players?.find(p => p.id === me.id)?.color, world: world() };
}
// A real golf swing at the crew bays (swing.js): drag down and flick up, or
// pull the right stick back and push it through. Tempo and drift matter.
const swing = createSwing({ canvas, onStrike(strike) {
  if (!canSwing()) return;
  aimPower = Math.max(0.05, strike.power ?? aimPower);   // round 6 #4: the landing ring uses your last swing's power
  const l = strikeToLaunch(strike, me.yaw, me.pitch);
  link.act({ t: 'swing', yaw: +l.yaw.toFixed(3), pitch: +l.pitch.toFixed(3), power: +l.power.toFixed(3), curve: +(strike.drift ?? 0).toFixed(3) });
  SFX.swing(Math.min(1, l.power));
} });
// The snack shed's kitchen (kitchen.js): peel, slice, fry, serve. Each serve is baskets of fries.
const SIZZLE = { on: null };
const kitchen = createKitchen({
  state: () => crew,   // the live snapshot, for venue additions to the kitchen (the Upper Deck mug meter reads state().mods?.deck)
  root: document.body,
  onServe({ item, quality, onePeel, ahead }) { link?.act({ t: 'serve', item: item ?? 'fries', quality, onePeel: !!onePeel, ...(ahead ? { ahead: true } : {}) }); },   // round 11: pour ahead
  onSound(name) {
    if (name === 'peel' || name === 'salt') SFX.scoop();
    else if (name === 'chop' || name === 'roll') SFX.swing(0.15);
    else if (name === 'clink') SFX.cash(1);
    else if (name === 'squirt' || name === 'pour') SFX.scoop();
    else if (name === 'grill') { SIZZLE.on ??= SFX.sprayLoop(); SIZZLE.on.set(1); setTimeout(() => SIZZLE.on?.set(0), 600); }
    else if (name === 'ding') SFX.cash(1);
    else if (name === 'serve') SFX.jackpot();
    else if (name === 'sizzle-on') { SIZZLE.on ??= SFX.sprayLoop(); SIZZLE.on.set(1); }
    else if (name === 'sizzle-off') SIZZLE.on?.set(0);
  },
});
function openKitchen() { releaseMouse(); keys.clear(); kitchen.open({ menu: menuFor(crew.venue ?? 0) }); }
// MOW-E, the Club's mower: it rakes a lane of balls into a tidy row and flattens Rats.
const mowe = createMower({ scene, confetti });
mowe.setTargets(id => id === me.id ? me : others.get(id)?.g.position ?? null);
// Council round 11 #1 (builder 1): the boss. One plug hold (Ⓐ / Space / Click held in the ring at its back); one centre
// line per phase, once a fight (the build-up's is the PA caption); the win's STAMP and cannons; a loss only feeds.
let plugging = false, moweFront = -1e9, moweSaid = new Set();
const moweMowed = { n: 0, at: 0 };   // council round 14 #4d: the mowed line's per-fight state (mowedLine), reset on the warn
const canPlug = () => playing() && me.down <= 0 && !driving() && !me.diving && crew.mower?.kind === 'boss' && crew.mower.phase === 'plug' && moweRing(crew.mower, me);
// Council round 12 #5d (builder 1): the whistle at the MOW-E post, once a shift on a pet day (crew.moweWhistle 1: ready).
// Council round 13 #5a: the whistle on a lanyard. Ⓐ at the post takes it (state 1); the carrier (state 3) blows it out in
// the field, 20 m or more from the nearest return, with no ball in reach (Ⓐ picks up first).
const canWhistle = () => playing() && crew.phase === 'shift' && crew.moweWhistle === 1 && me.down <= 0 && !driving() && !me.diving && !me.wand && moweAtPost(me);
const canBlowWhistle = () => playing() && crew.phase === 'shift' && crew.moweWhistle === 3 && crew.moweWhistleBy === me.id && me.down <= 0 && !driving() && !me.diving && !me.wand
  && !nearestBall() && moweCanBlow(me, moweReturn(me.x, me.z, crew.up?.returns ?? 0));
const ratName = id => id === me.id ? 'You' : crew.players?.find(p => p.id === id)?.name ?? 'A Rat';
function moweEvent(e) {
  if (e.t === 'moweWhistle') { feed(e.take ? BOSS_LINES.took(ratName(e.by)) : BOSS_LINES.blew(ratName(e.by))); return; }   // round 13 #5c
  if (e.t === 'moweBank') { if (e.whistle) feed(BOSS_LINES.brought(e.n)); return; }
  if (!e.boss) return;
  const pad = document.body.classList.contains('pad');
  if (e.phase === 'warn') { moweSaid = new Set(); moweMowed.n = 0; }
  const once = (k, text) => { if (!moweSaid.has(k)) { moweSaid.add(k); say('ALERT', text, { key: 'mowe' }); } };   // one key: a new phase's line replaces the last
  if (e.phase === 'tamed' || e.phase === 'fled') sayer.forget('mowe');   // the stamp never shares the screen with a phase line
  if (e.phase === 'harvest') once('loose', BOSS_LINES.loose);
  else if (e.phase === 'hunt') once('hunt', (crew.mower?.crew ?? 4) <= 2 ? BOSS_LINES.huntSolo : BOSS_LINES.hunt);   // round 13 #3e: 1–2 Rats learn the sidestep
  else if (e.phase === 'plug') once('plug', BOSS_LINES.plug(pad ? GLYPH.A : 'Space'));
  else if (e.phase === 'tamed') {
    const text = moweStampText({ won: true, encore: !!e.crash });
    say('STAMP', text, { secs: 3, data: { show: () => { mowe.stamp(true, text); SFX.jackpot(); }, hide: () => mowe.stamp(false) } });
    for (const dx of [-2.5, 2.5]) confetti.burst(SIM.STAND.x + dx, 1.2, SIM.STAND.z, { n: confettiCount(140, perf.low, 70), secs: 2.5, speed: 5, up: 11 });
    if (e.n) feed(`MOW-E's catcher burst: ${e.n} ball${e.n === 1 ? '' : 's'}, ×${BOSS.PAYX} each.`);   // round 12 #5b: they're on the grass round the plug
  } else if (e.phase === 'fled') {   // round 13 #3a: the loss is a beat: the red twin stamp (~2 s), then one line
    const text = moweStampText({ won: false, encore: !!e.encore });
    say('STAMP', text, { secs: 2, data: { show: () => { mowe.stamp(true, text, true); SFX.trombone?.(); }, hide: () => mowe.stamp(false) } });
    if (e.line) say('ALERT', e.line, { key: 'moweLost', secs: 3.5 });
    feed(BOSS_LINES.kept(e.kept ?? 0));
  }
}
let pumping = false;
// Owner playtest 3 §6.3: hold Ⓐ / Click / Space within GARY.CHAT_R of a parked Gary to keep him talking (it comes
// before picking up). The server checks the reach, the budget and that he's parked; this only decides the press.
let chatting = false;
const canChat = () => playing() && me.down <= 0 && !driving() && !me.diving && garyParked(crew.gary) && crew.gary.stalled < GARY.STALL_BUDGET
  && Math.hypot(crew.gary.x - me.x, crew.gary.z - me.z) <= GARY.CHAT_R;
// Owner playtest 3 §3.3: hold Use at the dispenser's side to fill buckets (the server checks the reach and the chutes).
let filling = false;
const canFill = () => playing() && crew.phase === 'shift' && me.down <= 0 && !driving() && !me.diving && !me.wand && atFill(me);
function pressAct(fromPad = false) {
  SFX.unlock();
  if (canPlug()) { plugging = true; link.act({ t: 'hold', on: true }); return; }   // council round 11 #1: pull MOW-E's plug
  if (canWhistle() || canBlowWhistle()) { link.act({ t: 'whistle' }); return; }   // council round 12 #5d; round 13 #5a: take it at the post, blow it in the field
  if (canChat()) { chatting = true; link.act({ t: 'chat', on: true }); return; }
  if (canFill()) { filling = true; link.act({ t: 'fill', on: true }); return; }
  if (fromPad && r2?.unlatch()) return;                  // a latched crank or pump: this tap lets go
  if (playing() && me.down <= 0 && views?.use(fromPad)) return; // a venue view's own use (grab debris, ...)
  if (playing() && crew.fries?.open && atShed(me) && !me.wand) { openKitchen(); return; }
  if (playing() && dockOpen(me) && !me.diving && crew.players.some(p => p.diving && p.id !== me.id)) { pumping = true; r2?.pumpBegin(fromPad); return; }   // round2.js cranks (mouse or right stick) and sends {t:'pump', turns}
  if (me.wand && playing() && me.down <= 0) {   // §7.1: on a pad, Ⓐ with the wand picks up a ball in reach and sprays otherwise
    if (fromPad && wandA({ ballNear: !!nearestBall(), room: carrying() < gp.pocket }) === 'pick') { act(); return; }
    spraying = true; return;
  }
  if (playing() && r2?.press(fromPad)) return;           // the ball washer crank (the pad latches it)
  if (playing() && me.down <= 0 && canSwing()) return;   // the swing module handles the bay
  act();
}
function releaseAct(fromPad = false) {
  spraying = false;
  if (plugging) { plugging = false; link?.act({ t: 'hold', on: false }); }   // council round 11 #1
  if (chatting) { chatting = false; link?.act({ t: 'chat', on: false }); }
  if (filling) { filling = false; link?.act({ t: 'fill', on: false }); }
  if (fromPad && r2?.latched()) return;                  // latched: the crank or pump stays on until Ⓐ or Ⓑ is tapped
  r2?.release();
  if (pumping) { pumping = false; r2?.pumpEnd(); }
}
function releaseBucket() { r2?.haulEnd(); }

// ---- driving -----------------------------------------------------------------
function driveCart(dt, px, py, lt, rt) {
  const throttle = Math.max(-1, Math.min(1, (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) + rt - lt - py));
  const steer = Math.max(-1, Math.min(1, (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) + px));
  const i = myCartIdx(), c = crewCarts()[i], P = cartViews[i]?.pose;
  if (!c || !P) return;
  const vmax = my.cartSpeed * ((c.boost ?? 0) > 0 ? CART.BOOST : 1) * cartSpeedAt(P.x, P.z, world());   // x1.3 on the Ping Track
  stepCart(P, throttle, steer, dt, vmax, world());
  me.x = P.x; me.z = P.z;
  // The gang reels scoop whatever they roll over.
  const room = my.cartCap - (c.load ?? 0) - pendingCart.size;
  let n = 0;
  for (const b of balls.values()) {
    if (n >= 8 || n >= room) break;
    if (b.hidden || b.y > 0.4 || b.kind === 'square' || !underReels(P, b, my.cartReel)) continue;   // squares jam the reels (round 6 #8)
    b.hidden = true; pendingCart.add(b.id); n++;
    link.act({ t: 'pickup', ball: b.id, cart: true });
  }
  if (n) sweep.pick(performance.now() / 1000, n);   // round 11: the reels sweep too
  if (engine) engine.set(Math.min(1, Math.abs(P.v) / my.cartSpeed));   // §7.4: over the base top speed, so turbo never raises the pitch
}
function grab(b) {
  b.hidden = true; pending.add(b.id);
  // Round 11 (sweep.js): ×N by the crosshair, the climbing blip. Not for pond-dive grabs: they go to the dive bag, which
  // the server's sweep doesn't count, so the ×N would show a bonus that is never paid.
  if (!b.sunk && !me.diving) sweep.pick(performance.now() / 1000);
  link.act(b.sunk ? { t: 'pickup', ball: b.id, pond: true } : { t: 'pickup', ball: b.id });
}
// The push picker scoops up whatever you roll over, no button needed.
function scoop() {
  if (!gp.scoop || !playing() || me.down > 0) return;
  for (let n = 0; n < 4 && carrying() < gp.pocket; n++) {
    const b = nearestBall(gp.scoop);
    if (!b) return;
    grab(b);
  }
}
const startShift = () => link?.act({ t: 'start' });

// ---------------------------------------------------------------- joining
async function enter(how, preset) {
  // Never waits on the preload (owner): a texture still generating shows its flat average until it lands.
  const name = $('name').value.trim();
  const code = $('join-code').value.trim().toUpperCase();
  $('join-error').textContent = '';
  try {
    seat = how === 'create' ? await NET.createCrew(name) : how === 'skip' ? await NET.skipCrew(name, preset) : await NET.joinCrew(code, name);
  } catch (e) { if (/No crew/.test(e.message)) crewClosed(); else $('join-error').textContent = e.message; return; }
  if (seat.tips) { hinter.markSeen(seat.tips); delete seat.tips; }   // round 11: skip ahead (test): old things' tips are seen
  NET.rememberUsed(seat.code, name);
  go();
}

// Playthrough 5 A9: a stale code (an old link, a crew that closed) says so kindly and offers the way on.
function crewClosed() {
  $('join-error').textContent = 'That crew has closed. Start a new one?';
  $('join-code').value = '';
  $('create').focus();
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
    crewClosed();   // playthrough 5 A9 (it read "Couldn't get back into crew ABCD. It may have closed.")
  })().finally(() => { rejoining = null; });
  return rejoining;
}

// Night one (council round 4, §4.5): the live lobby roster, the share link, the crew code on
// the report and pause cards, and the late-joiner's what-to-do toast.
let joinToastFor = null;
function renderLobby() {
  const code = $('code').textContent;
  document.querySelectorAll('.crew-code-text').forEach(el => { el.textContent = code; });
  if (crew.phase !== 'lobby') return;
  $('lobby-code').textContent = code;
  $('lobby-link').textContent = NET.joinLink(code).replace(/^https?:\/\//, '');
  $('lobby-roster').innerHTML = crew.players.map(p => `<li style="--c:${p.color}" class="${p.online ? '' : 'off'}"><span class="dot"></span>${esc(p.name)}${p.id === me.id ? ' <i>(you)</i>' : ''}</li>`).join('');
  const n = crew.players.filter(p => p.online).length || crew.players.length;
  $('start').textContent = `Open the range (${n} Rat${n === 1 ? '' : 's'} here)`;
  $('lobby').querySelector('.shop')?.classList.toggle('hidden', (crew.day ?? 1) <= 1 && (crew.venue ?? 0) === 0);   // no shop before there is money
  $('lobby').querySelector('.shop-toggle')?.classList.toggle('hidden', (crew.day ?? 1) <= 1 && (crew.venue ?? 0) === 0);
  const goal = $('lobby').querySelector('.goal-line');   // playtest round 2 #15: day 1 has no target
  if (goal) goal.textContent = lobbyTagline(crew.venue ?? 0, !!crew.endless, crew.day ?? 1);   // council round 11 8.13: one per venue
}
function copyJoinLink() {
  const url = NET.joinLink($('code').textContent);
  const done = () => { $('copy-link').textContent = 'Copied!'; setTimeout(() => { $('copy-link').textContent = 'Copy link'; }, 1800); };
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).then(done, () => {});
  else { const t = document.createElement('textarea'); t.value = url; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch {} t.remove(); }
}
$('copy-link').addEventListener('click', copyJoinLink);
let stampUntil = 0;   // the bell's stamp holds the report card this long (round 6 #3); the 'quota' event sets it
function showPhase() {
  $('hud').classList.toggle('in-lobby', crew.phase === 'lobby');   // the lobby card owns the screen
  $('lobby').classList.toggle('hidden', crew.phase !== 'lobby' || !link);
  $('report').classList.toggle('hidden', crew.phase !== 'report' || !report || !!report?.ending || performance.now() < stampUntil);   // the ending has its own card
  document.body.classList.toggle('report-open', !$('report').classList.contains('hidden'));   // playthrough 5 A9: the toast moves up
  $('crewline').classList.toggle('hidden', crew.phase === 'report');   // playtest round 2 #14: the report's panels would sit on the crew list
  renderLobby();
  if (crew.phase === 'shift' && link && joinToastFor !== link) {
    joinToastFor = link;
    const left = Math.max(0, crew.shiftSecs - crew.shiftT);
    if (crew.shiftT > 3 && left > 5) toast(`Joined day ${crew.day}, ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')} left. Pick up balls.`, 4);
  }
  if (crew.phase === 'report' && !$('report').classList.contains('hidden')) sayer.report();   // the card is open: feedback may show again
  if (crew.phase === 'report' && report) {
    $('report-body').innerHTML = `<h2>Day ${report.day} is done</h2>
      <p class="big-stat">${signedMoney(report.cash)} <small>${report.deposited} balls banked</small></p>
      ${report.helped ? `<p>Banked by hired help <b>${report.helped}</b></p>` : ''}
      ${report.carted ? `<p>Scooped by the cart <b>${report.carted}</b></p>` : ''}
      ${report.swings ? `<p>Hit the Cart <b>${report.pings ?? 0} pings from ${report.swings} swings</b></p>` : ''}
      ${report.knockdowns ? `<p>Knockdowns <b>${report.knockdowns}</b></p>` : ''}
      ${report.runOver ? `<p>Run over <b>${report.runOver}</b></p>` : ''}
      ${report.unwashed > 0 ? `<p>Unwashed at the bell: ${report.unwashed} <b>(missed washer bonus ${money(report.lostPremium ?? 0)})</b></p>` : ''}
      <p>In the bank <b id="report-bank">${money(crew.promotedTo ? crew.cash : report.bank)}</b></p>
      ${report.mowe ? `<p class="stamp ${report.mowe.won ? 'hit' : 'miss'}"><b>${moweRow(report.mowe)}</b></p>` : ''}
      ${reportRowsHtml(report.rows)}
      ${report.quota ?`<p class="stamp ${report.quota.hit ? 'hit' : 'miss'}">${targetStamp(report.quota)} <b${!report.quota.hit && (report.quota.need != null ? report.quota.clean >= report.quota.need : report.quota.bv >= report.quota.target) ? ' class="pass"' : ''}>${report.quota.need != null ? reportRow(report.quota) : `BV ${money(report.quota.bv >= 100 ? Math.round(report.quota.bv) : report.quota.bv)} / ${money(report.quota.target >= 100 ? Math.round(report.quota.target) : report.quota.target)}`}${report.quota.hit ? ` · bonus ${money(report.quota.bonus)}` : ''}</b></p>` : ''}
      ${report.quota?.gauge != null ? `<p${report.quota.gaugeOk ? '' : ' class="stamp miss"'}>${crew.venue === 3 ? 'Crowd (last 2 min)' : crew.venue === 4 ? 'Zoning at the bell' : 'Venue gauge at the bell'} <b>${Math.round(report.quota.gauge * 100)}% · ${report.quota.gaugeOk ? 'held' : report.quota.out ?? report.quota.why ?? 'under 50%'}</b></p>` : ''}
      ${report.sealCash > 0 ? `<p>${sealRow(report.sealCash).replace(': ', ': <b>')}</b></p>` : ''}
      ${report.spotless ? `<p class="stamp hit"><b>${spotlessRow(report.spotless, money)}</b></p>` : ''}
      ${report.tomorrow ? `<p class="dim">${report.tomorrow}</p>` : ''}`;
  }
  if (crew.phase === 'shift') relockMouse();
  else releaseMouse();
}

$('create').addEventListener('click', () => enter('create'));
initSkip({ onPick: id => enter('skip', id) });   // round 11: "Skip ahead (test)" on dev + localhost only (web/js/skip.js)
$('join').addEventListener('click', () => enter('join'));
$('join-code').addEventListener('keydown', e => { if (e.key === 'Enter') enter('join'); });
$('start').addEventListener('click', startShift);
// Council round 13 8.2/8.3 (builder 4): Next shift / Ready ignores Ⓐ/Space for 1.5 s after a card closes and wants a
// fresh press (a held Space's key-up skipped the final report); it shows pressed at once, and a double press is one.
const readyGate = createReadyGate();
const readyNow = () => performance.now() / 1000;
setInterval(() => readyGate.frame(readyNow(), !!document.querySelector('#story-card.on') || !!$('endcard')), 100);
for (const [ev, fn] of [['keydown', e => readyGate.keyDown(readyNow(), e.repeat)], ['keyup', e => readyGate.keyUp(readyNow())]])
  document.addEventListener(ev, e => { if (e.key === ' ' || e.key === 'Enter') fn(e); }, true);
$('next').addEventListener('click', e => {
  if (!readyGate.allow(readyNow(), e.detail > 0 ? 'mouse' : null)) return;
  const b = $('next'); b.style.filter = 'brightness(0.75)'; b.style.transform = 'scale(0.96)';
  setTimeout(() => { b.style.filter = ''; b.style.transform = ''; }, READY.PRESSED * 1000);
  startShift();
});
// The clock-out button with a free mouse (the pointer is usually locked: F does it then): press holds the vote.
$('clockout').addEventListener('pointerdown', e => { e.preventDefault(); if (canClockOut()) yHold = { kind: 'clockout', t: 0 }; });
for (const ev of ['pointerup', 'pointerleave']) $('clockout').addEventListener(ev, () => { if (yHold?.kind === 'clockout') { clockOutRelease(); yHold = null; } });
$('resume').addEventListener('click', () => pause(false));
$('settings-open').addEventListener('click', () => openSettings(true));
$('store-close').addEventListener('click', () => toggleStore(false));
$('leave').addEventListener('click', () => { link?.close(); link = null; try { sessionStorage.clear(); } catch {} location.reload(); });
{
  const last = NET.lastUsed();
  if (last.name) $('name').value = last.name;
  if (last.code) $('join-code').value = last.code;
  const s = NET.seatInTab();
  const linked = NET.codeFromUrl();    // the ?c=CODE share link: prefill the code, ask for a name
  if (linked) { $('join-code').value = linked; if (!(s && s.code === linked)) { if (last.name) enter('join'); else $('name').focus(); } }
  if (s && (!linked || s.code === linked)) { seat = s; rejoin(); }       // a reload: back into the same seat
}

// ---------------------------------------------------------------- input
const keys = new Set();
const typing = () => ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName);
addEventListener('keydown', e => {
  lastInput = 'mouse';   // keyboard and mouse are one device here
  if (typing()) return;
  if (kitchen.isOpen) { if (kitchen.handleKey('down', e)) e.preventDefault(); if (!kitchen.isOpen && crew.phase === 'shift') lockMouse(); return; }
  if (deckCam.on && !e.repeat) { deckCamEnd(); e.preventDefault(); return; }   // council round 10 #4: any key skips the Deck Cam
  // Round 12: a story card up (and no menu): Space / Enter next, Esc skips the beat. Nothing else sees the key.
  if (storyCard.up && !menuOpen() && ['Space', 'Enter', 'Escape'].includes(e.code)) { if (!e.repeat) (e.code === 'Escape' ? storyCard.skip() : storyCard.press()); e.preventDefault(); return; }
  SFX.unlock();
  keys.add(e.code);
  if (e.code === 'Space' && !e.repeat) pressAct();
  if (e.code === 'KeyE' && !e.repeat) interact('bucket');
  if (e.code === 'KeyF' && !e.repeat) cartPress();   // council round 10 §D: a tap boards, a hold drives the automation
  if (e.code === 'Escape' && link) { if (storeOpen) toggleStore(false); else pause(!paused); }
  if (e.code === 'Tab' && link) { e.preventDefault(); toggleStore(); }
  if (e.code === 'KeyC' && !e.repeat && link && !r2?.cctvOn) r2?.toggleCCTV();   // Corporate CCTV (from the Club)
});
addEventListener('keyup', e => { if (kitchen.isOpen) { kitchen.handleKey('up', e); return; } keys.delete(e.code); if (e.code === 'Space') releaseAct(); if (e.code === 'KeyE') releaseBucket(); if (e.code === 'KeyF') cartRelease(); });
addEventListener('blur', () => keys.clear());
addEventListener('pointerdown', () => SFX.unlock());
// Pointer lock can be refused (embedded views, no user gesture): swallow that
// and fall back to the arrow keys for looking.
function lockMouse() { try { canvas.requestPointerLock?.()?.catch?.(() => {}); } catch {} }
// Owner playtest 3 §7.3: on a pad the pointer lock is never touched. Releasing it on Xbox Edge shows the system
// cursor ("it releases the mouse"), and a pad press is no user gesture to get it back. The game never leaves full screen (test/pad.test.mjs).
let lastInput = 'mouse';   // 'pad' | 'mouse': the device that moved last
function releaseMouse() { if (lastInput === 'mouse' && document.pointerLockElement === canvas) document.exitPointerLock?.(); }
function relockMouse() { if (lastInput === 'mouse') lockMouse(); }
addEventListener('mousedown', () => { lastInput = 'mouse'; }, true);
addEventListener('mousemove', e => { if (e.movementX || e.movementY) lastInput = 'mouse'; }, true);
canvas.addEventListener('pointerdown', e => { if (playing()) swing.pointerDown(e); });
addEventListener('pointerdown', e => { if (kitchen.isOpen) kitchen.handlePointer('down', e); });
addEventListener('pointermove', e => { if (kitchen.isOpen) kitchen.handlePointer('move', e); else if (swing.enabled) swing.pointerMove(e); });
addEventListener('pointerup', e => { if (kitchen.isOpen) kitchen.handlePointer('up', e); else if (swing.enabled) swing.pointerUp(e); });
canvas.addEventListener('mousedown', e => {
  if (deckCam.on) { deckCamEnd(); return; }   // council round 10 #4: a click skips the Deck Cam
  if (storyCard.up && e.button === 0) { storyCard.press(); return; }   // round 12: a click moves the story card on
  if (e.button !== 0 || !playing()) return;
  if (document.pointerLockElement !== canvas) lockMouse();
  pressAct();
});
addEventListener('mouseup', e => { if (e.button === 0) releaseAct(); r2?.setMouseDown(false); });
addEventListener('mousedown', e => { if (e.button === 0) r2?.setMouseDown(true); });
addEventListener('wheel', e => r2?.wheel(e), { passive: true });
addEventListener('mousemove', e => {
  r2?.mouseMove(e);
  if (r2?.capturing()) return;                      // cranking, CCTV, or a venue reveal
  if (document.pointerLockElement !== canvas || driving() || swing.dragging) return;
  me.yaw -= e.movementX * 0.0025 * SET.get().look;
  me.pitch = Math.max(-1.4, Math.min(1.2, me.pitch - e.movementY * 0.0025 * SET.get().look * (SET.get().invertY ? -1 : 1)));
});
// The store: open any time with Tab / D-pad up. The range keeps going while you shop.
let storeOpen = false;
function toggleStore(on = !storeOpen) {
  if (!link || (on && (menuOpen() || crew.phase === 'lobby'))) return;
  storeOpen = on;
  $('store').classList.toggle('hidden', !on);
  shopKey = '';
  renderShop();
  if (on) { releaseMouse(); keys.clear(); focusFirst($('store')); } else if (crew.phase === 'shift') relockMouse();
}
// Settings (web/js/settings.js): a card of its own, reached from the pause menu.
function openSettings(on) {
  $('settings').classList.toggle('hidden', !on);
  $('pause').classList.toggle('hidden', on || !paused);
  if (on) { SET.render($('settings'), { onBack: () => openSettings(false) }); focusFirst($('settings')); }
  else focusFirst($('pause'));
}
SET.onChange(s => {
  SFX.setVolumes({ master: s.master, sfx: s.sfx }); AMB.setVolume(s.ambience);
  const pa = r2?.pa; if (pa) { pa.setVolume(s.pa); pa.setVoiceEnabled(s.paMode === 'voice'); }
  perf.setGraphics(s.graphics);
});
const hinter = SET.createHinter();
// First-time hints are TIP items: the lowest kind, shown only after 2 s of quiet, dropped after 60 s in the queue.
let beersPoured = 0;
function showHint(msg) { say('TIP', msg); }
// The pause menu's Goals panel (council round 10 #1; builder 1's goals.js card): what the crew needs, as the report shows it.
let pauseGoalsKey = '';
function pauseGoals() {
  const root = $('pause'), rows = crew.goals?.rows ?? [];
  let el = root?.querySelector('.pause-goals');
  if (!root || !rows.length) { el?.remove(); pauseGoalsKey = ''; return; }
  if (!el) { el = document.createElement('div'); el.className = 'sheet promo pause-goals'; const row = root.querySelector('.row'); if (row) row.before(el); else root.append(el); }
  const v = crew.venue ?? 0, title = v >= LAST_CARD ? 'The Last Bucket' : `The goal card: ${VENUE_RULES[v + 1]?.name ?? 'the next range'}`;
  const key = JSON.stringify([title, rows, crew.goals.reward]);
  if (key !== pauseGoalsKey) { pauseGoalsKey = key; el.innerHTML = '<h3>' + esc(title) + '</h3>' + cardHtml(rows, { rewardNow: crew.goals.reward ?? 0, esc }); }
}
function pause(on) {
  if (!link) return;
  if (!on) $('settings').classList.add('hidden');
  paused = on;
  if (on) pauseGoals();
  $('pause').classList.toggle('hidden', !on);
  if (on) { releaseMouse(); focusFirst($('pause')); } else if (crew.phase === 'shift') relockMouse();
}

// ---------------------------------------------------------------- controller
// Menus are driven with the D-pad or left stick plus Ⓐ, like a console app.
const menuOpen = () => kitchen.isOpen || !!$('endcard') || !!recap.el() || ['title', 'lobby', 'report', 'pause', 'settings', 'store'].some(id => !$(id).classList.contains('hidden'));
const menuRoot = () => $('endcard') ?? recap.el() ?? ['settings', 'pause', 'store', 'report', 'lobby', 'title'].map($).find(el => !el.classList.contains('hidden')) ?? null;
// Owner playtest 3 §7.3: a card's primary button ([data-primary], the shop's first affordable Buy) takes focus.
const focusPrimary = root => { if (root) primaryOf(navTargets(root), root.id)?.focus(); };
function focusFirst(root) { if (root && !root.contains(document.activeElement)) focusPrimary(root); }
// Whenever a different card becomes the menu root, focus its primary (not the title: its first target is the
// name box, and focusing that on Xbox opens the system keyboard), and hold Ⓐ off for a moment (menufocus.js).
let menuWas = null, menuAt = 0;
function trackMenu(root) {
  if (root === menuWas) return;
  menuWas = root; menuAt = performance.now(); navHeld = 0.28;
  if (root?.id === 'report' || root?.id === 'lobby') setShopOpen(root, false);   // the report opens on Ready / Next, the shop folded
  if (root && root.id !== 'title') focusFirst(root);
}

let pad = null, navHeld = 0, rtSpray = false;
const padlog = createPadlog(new URLSearchParams(location.search).has('padlog'));
function pollPad(dt) {
  pad = readPad(navigator.getGamepads?.(), pad);
  const root = menuRoot();
  trackMenu(root);
  padlog.update({ down: pad?.down, root, active: document.activeElement, fullscreen: document.fullscreenElement, lock: document.pointerLockElement });
  if (!pad) { rtSpray = false; return [0, 0]; }
  if (pad.active) { document.body.classList.add('pad'); lastInput = 'pad'; }
  if (kitchen.isOpen) { rtSpray = false; kitchen.stepPad(pad, dt); return [0, 0]; }
  if (root) {
    rtSpray = false;
    const dx = (pad.down[BTN.RIGHT] ? 1 : 0) - (pad.down[BTN.LEFT] ? 1 : 0) || Math.round(pad.lx);
    const dy = (pad.down[BTN.DOWN] ? 1 : 0) - (pad.down[BTN.UP] ? 1 : 0) || Math.round(pad.ly);
    if (dx || dy) {
      if ((navHeld -= dt) <= 0) {
        const targets = navTargets(root), cur = root.contains(document.activeElement) ? document.activeElement : null;
        const to = dx && !dy && SET.padAdjust(cur, dx) ? cur : navPick(cur, targets, dx, dy);   // a focused slider eats left/right
        if (to && to !== cur) to.focus();
        else if (!to && root.id === 'store' && pad.pressed[BTN.UP]) { toggleStore(false); return [0, 0]; }   // D-pad ↑ at the top closes the shop
        navHeld = navHeld < -1 ? 0.12 : 0.28;   // first step slow, then repeat
      }
    } else navHeld = 0;
    if (pad.pressed[BTN.A]) {   // Ⓐ never clicks a button that wasn't already focused (menufocus.js)
      const focused = root.contains(document.activeElement) && document.activeElement !== root ? document.activeElement : null;
      const what = menuA({ focused, sinceOpen: (performance.now() - menuAt) / 1000 });
      if (what === 'focus') focusPrimary(root);
      else if (what === 'click') focused.click();
      else if (what === 'input') focused.focus();   // on Xbox, a focused input opens the keyboard
    }
    if (pad.pressed[BTN.Y] && root.id === 'report' && crew.players.filter(p => p.online).length > 1) $('next').click();   // Ⓨ: Ready
    if (pad.pressed[BTN.B] && (root.id === 'report' || root.id === 'lobby') && shopOpenIn(root)) { setShopOpen(root, false); root.querySelector('.shop-toggle')?.focus(); }   // Ⓑ folds the shop
    if (pad.pressed[BTN.B] && root.id === 'pause') pause(false);
    if (pad.pressed[BTN.B] && root.id === 'recapcard') recap.close();   // round 11: the night card
    if ((pad.pressed[BTN.B] || pad.pressed[BTN.MENU]) && root.id === 'settings') openSettings(false);
    if (pad.pressed[BTN.B] && root.id === 'store') toggleStore(false);   // §7.3: View no longer opens or closes the shop
    if (pad.pressed[BTN.MENU] && root.id === 'pause') pause(false);
    return [0, 0];
  }
  if (pad.pressed.some(Boolean)) SFX.unlock();
  if (storyCard.up) {   // round 12: Ⓐ next card, Ⓑ skip the beat (eaten here: no pick-up, no unlatch); you can still walk
    if (pad.pressed[BTN.A]) { storyCard.press(); pad.pressed[BTN.A] = false; }
    if (pad.pressed[BTN.B]) { storyCard.skip(); pad.pressed[BTN.B] = false; }
  }
  if (deckCamPad(pad)) { rtSpray = false; return [0, 0]; }   // council round 10 #4: the cut eats the pad (and a press skips it)
  if (pad.pressed[BTN.A]) pressAct(true);
  if (pad.pressed[BTN.B]) { r2?.unlatch(); views?.unlatch(); }
  if (pad.released[BTN.A]) releaseAct(true);
  if (pad.released[BTN.X]) releaseBucket();
  if (pad.pressed[BTN.X]) interact('bucket');
  if (pad.pressed[BTN.Y]) cartPress();
  if (pad.released[BTN.Y]) cartRelease();
  if (pad.pressed[BTN.MENU]) pause(true);
  if (pad.pressed[BTN.UP]) toggleStore(true);
  if (pad.pressed[BTN.DOWN] && !r2?.cctvOn) r2?.toggleCCTV();
  const pb = padBindings(pad, { wand: me.wand, driving: driving(), cctv: !!r2?.cctvOn, rtSpray });   // §7.1-7.2 (padbind.js)
  rtSpray = pb.rtSpray;
  if (pb.sprint) padSprint = true;
  if (swing.enabled) swing.stepPad(pad, dt, performance.now());
  else if (!driving() && !r2?.capturing() && !views?.lockLook()) {
    me.yaw -= pad.rx * 2.6 * dt * SET.get().look;
    me.pitch = Math.max(-1.4, Math.min(1.2, me.pitch - pad.ry * 1.8 * dt * SET.get().look * (SET.get().invertY ? -1 : 1)));
  }
  return [pad.lx, pad.ly];
}

// ---------------------------------------------------------------- HUD
// Your own feedback: a TOAST in the queue (3 s to live: stale feedback is dropped, never shown late). `key` updates in place.
function toast(msg, secs = 2.5, key) { say('TOAST', msg, { secs: Math.min(4, secs ?? 2.5), key }); }
// The checklist and the nudge slot step aside while the PA card, a memo or the stamp holds the centre (owner playtest).
// Council round 13 #2a: the arbiter decides. textBusy: a memo or anything above it (story, stamp, ALERT, PA) up or waiting.
const textBusy = () => sayer.centre.busy(PRI.MEMO) || storyCard.up;
const fightMute = createFightMute();   // round 13 #2c: the boss owns the screen (the nags wait; one summary line after)
// Council round 12, 9.4 (builder 4): the checklist slot stays down while any centre text shows or waits, and for 1 s
// after the last (morning.js checkGate), so it never flickers up between two of them.
const checkSt = { lastBusy: -Infinity };
const checkClear = () => checkGate(checkSt, { busy: sayer.centre.busy() || storyCard.up, waiting: sayer.pending > 0 || !!storyCard.model?.ready, t: performance.now() / 1000 });
// The checklist line is an idle claim on the arbiter (priority 4, steps aside for anything): it draws only while it is up.
let checkClaim = false;
function checkUp(want) {
  if (want !== checkClaim) { checkClaim = want; if (want) sayer.centre.request({ id: 'check', pri: PRI.CHECK, idle: true, kind: 'CHECK' }); else sayer.centre.release('check'); }
  const up = want && sayer.centre.up()?.id === 'check';
  if (up && !checkDrawn) sayer.clearOthers($('todo'));   // its first frame is its own, at any frame rate
  checkDrawn = up;
  return up;
}
let checkDrawn = false;
// Other Rats' news: a quiet 3-line feed on the left, 3 s a line (council round 3).
const helperFalls = createFallAgg({ now: () => performance.now() / 1000 });   // council round 11 8.10
let helperFallsT = 0;
function feed(msg, color) {
  const el = $('feed'); if (!el) return;
  const line = document.createElement('div'); line.textContent = msg; if (typeof color === 'string') line.style.color = color; el.appendChild(line);
  while (el.children.length > 3) el.firstElementChild.remove();
  setTimeout(() => line.remove(), 3000);
}

// Day 1's shared checklist (crew.todo from the server): one step at a time, ticked off by anyone on
// the crew, with a bobbing arrow over the thing to go to (owner playtest: show, don't tell).
const TODO_TEXT = {
  pick: (t, k) => `Pick up a ball · ${k.btn}`,
  bank: (t, k) => `Bank them at the return · ${k.ibtn}  ${t.n}/${t.of}`,
  sign: (t, k) => me.wand ? `Spray the sign · hold ${k.btn === GLYPH.A ? 'RT' : k.btn}` : `Grab the pressure washer · ${k.ibtn}`,
  buy: (t, k) => { const p = cheapest(); return crew.cash >= p ? `Buy something · ${k.shop}` : `Bank ${money(p)}, then shop · ${money(crew.cash)}`; },
};
// The cheapest thing in the shop right now (prices scale with the Rats online).
function cheapest() {
  const size = Math.max(1, crew.players.filter(p => p.online).length), day = shopDay(crew.phase, crew.day ?? 1);
  let best = Infinity;
  const vday = shopVday();
  for (const item of SHOP) if (shopShows(item, crew.venue ?? 0, day, crew.endless, 1, vday)) { const p = nextPrice(item.id, crew.up, size, item.id === 'dive' ? me.dive ?? 0 : me.gear ?? 0, crew.venue ?? 0, day, crew.endless, vday); if (p != null && p < best) best = p; }
  return Number.isFinite(best) ? best : 15;
}
const TODO_DONE = { pick: 'Picked up!', bank: 'Banked!', sign: 'Spotless!', buy: 'Bought!' };
const todoArrow = (() => {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthTest: false });
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.8, 16), mat); head.rotation.x = Math.PI; head.position.y = 0.4;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.8, 10), mat); shaft.position.y = 1.2;
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.95, 32), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthTest: false }));
  ring.rotation.x = -Math.PI / 2;
  g.add(head, shaft); head.renderOrder = shaft.renderOrder = ring.renderOrder = 999;
  scene.add(g); scene.add(ring); ring.visible = g.visible = false;
  return { g, ring };
})();
let todoKey = '', todoSeen = null, todoDoneT = 0, todoT = 0, basketStocked = false;
function todoTarget(id) {
  const ball = () => { const b = nearestBall(80); return b ? { x: b.x, z: b.z, y: 0.6, s: 0.6 } : null; };
  if (id === 'pick') return ball();
  if (id === 'bank') return carrying() === 0 ? ball() : { x: SIM.STAND.x, z: SIM.STAND.z, y: 2.6, s: 1 };
  if (id === 'sign') { const sg = FIXTURE_BY_ID.sign; return me.wand ? { x: sg.x, z: sg.z, y: 3.4, s: 1 } : { x: WASH.STATION.x, z: WASH.STATION.z, y: 2.2, s: 1 }; }
  return null;
}
function renderTodo(dt) {
  const el = $('todo'); if (!el) return;
  todoT += dt;
  const list = crew.todo, pad = document.body.classList.contains('pad');
  let doneNow = null;
  if (list) {
    const done = new Set(list.filter(t => t.done).map(t => t.id));
    if (todoSeen) for (const id of done) if (!todoSeen.has(id)) { SFX.ping(); doneNow = id; }
    todoSeen = done;
    todoDoneT = list.every(t => t.done) ? todoDoneT + dt : 0;
  } else { todoSeen = null; todoDoneT = 0; }
  const cur = list?.find(t => !t.done) ?? null;
  // Day 2's one-line suggestion (council round 6 #10) uses this slot and arrow, only once the checklist is gone.
  basketStocked = crew.phase === 'shift' && (basketStocked || (crew.basket ?? 0) > 0);   // playthrough 5 A5: it held buckets this shift
  const basketRat = fightMuted(crew.mower) ? null : emptyBasketRat(crew, basketStocked, FILL_POINT);   // round 13 #2c: muted in the fight
  { const sum = fightMute.step(crew.mower); if (sum) feed(sum); }   // "3 customers left during the fight."
  ballReturn.alarm(!!basketRat);   // the dispenser's lamp
  const nudgeWant = !list || todoDoneT >= 3 ? garyExtra(withBasketAlarm(crew.mods?.nudge?.[me.id] ?? null, basketRat === me.id), garyParked(crew.gary)) : basketRat === me.id ? 'am:basket' : null;   // round 13 8.1: the alarm is the checklist's next line; §6.3: parked, chat him
  // Council round 14 6.4 (builder 4): one Gary line at a time, held ≥ 4 s; the stall/chat lines once, after a failed check
  const garyLine = garyGate.pick(nudgeWant, performance.now() / 1000);
  const nudge = garyLine ?? (typeof nudgeWant === 'string' && nudgeWant.startsWith('gary:') ? null : nudgeWant);
  const clear = checkClear();   // round 12, 9.4: every frame, so the 1 s quiet counts from the last text (was !textBusy())
  const show = checkUp((!!list && todoDoneT < 3 || !!nudge) && playing() && clear);   // round 13 #2a: through the arbiter
  const tg = show && nudge ? nudgeTarget(nudge, me.wand, me, { cart: crewCarts().reduce((m, c) => (!m || (c.mud ?? 0) > (m.mud ?? 0) ? c : m), null), gary: crew.gary ? (crew.gary.phase === 'drive' ? garyPose : crew.gary) : null, nMats: crew.nMats ?? 10 }) : show && cur ? todoTarget(cur.id)
    : !list && !nudge ? tipPointer.target(dt, crew, me, playing() && !textBusy()) : null;   // owner notes: the arrow points at a new thing's tip
  todoArrow.g.visible = todoArrow.ring.visible = !!tg;
  if (tg) {
    const bob = Math.sin(todoT * 4) * 0.2;
    const dist = Math.hypot(tg.x - me.x, tg.z - me.z), far = dist > 8 ? dist / 8 : Math.max(0.45, dist / 8);   // grows with distance; small when you're on it
    tg.s *= far; tg.y *= Math.sqrt(far);
    todoArrow.g.position.set(tg.x, tg.y + bob * far, tg.z); todoArrow.g.scale.setScalar(tg.s);
    const dir = document.getElementById('todo-dir');
    if (dir) { let rel = Math.atan2(-(tg.x - me.x), -(tg.z - me.z)) - me.yaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel)); dir.style.transform = `rotate(${-rel}rad)`; }
    todoArrow.ring.position.set(tg.x, 0.05, tg.z); todoArrow.ring.scale.setScalar(tg.s * (1 + 0.15 * Math.sin(todoT * 4)));
  }
  if (doneNow && show && doneNow !== 'buy') toast(TODO_DONE[doneNow], 1.4);   // playthrough 4 A19: a purchase's one toast is "You bought: X"
  const k = { btn: pad ? GLYPH.A : 'Click', ibtn: pad ? GLYPH.X : 'E', shop: pad ? 'D-pad ↑' : 'Tab' };
  const key = show ? JSON.stringify([nudge, cur?.id, cur?.n, pad, me.wand, crew.cash >= cheapest(), cur?.id === 'buy' ? crew.cash : 0, todoDoneT > 0, !!tg]) : '';
  if (key === todoKey) return;
  todoKey = key;
  el.innerHTML = !show ? '' : nudge ? `<b>${tg ? '<span id="todo-dir">↑</span> ' : ''}${(nudgeLine(nudge) ?? '').replace('Ⓐ', k.btn)}${nudge === 'shop' ? ` · ${k.shop}` : ''}</b>`
    : todoDoneT > 0 || !cur ? '<b>You know the job. Go.</b>'
    : `<b>${todoTarget(cur.id) ? '<span id="todo-dir">↑</span> ' : ''}${TODO_TEXT[cur.id](cur, k)}</b><span class="dots">${list.map(t => t.done ? '●' : '○').join(' ')}</span>`;
}

function renderRoster() {
  renderLobby();   // the lobby's roster is live too
  $('roster').innerHTML = crew.players.map(p => `<li style="--c:${p.color}" class="${p.online ? '' : 'off'}">
    <span class="dot"></span>${esc(p.name)}${p.id === me.id ? ' <i>(you)</i>' : ''}
    <span class="pk">${p.down > 0 ? '💫' : p.pocket > 3 ? p.pocket : '●'.repeat(p.pocket)}</span></li>`).join('')
    + (crew.helpers?.length ? `<li class="help">${crew.helpers.map(h => esc(h.name) + (h.down > 0 ? ' 💫' : '')).join(', ')} <i>(hired)</i></li>` : '');
}
const esc = s => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

let hudGaugeKey = null;   // council round 12, 7e (builder 4): the HUD gauge's last text (DOM only on change)
function hud(dt = 0) {
  renderTodo(dt);
  $('cash').textContent = money(crew.cash);
  const v = crew.value;
  // One line: BV · target · gear (the KPIs live on the Board, council round 3).
  $('value').classList.toggle('hidden', !!crew.todo);
  $('storehint').classList.toggle('hidden', !!crew.todo && crew.todo.find(t => !t.done)?.id !== 'buy');
  // Owner playtest 3 §1.2 (builder 1): "$2.62 a ball · 62% clean · need 60%" (bvtext.js bvLine), then CARD DONE (round 10) / LAST CALL.
  const r2line = r2 ? r2.hudLine() : '';
  { // council round 12, 7e (builder 4): the venue gauge after the line ("· crowd 82%"), red under 50 %; DOM only on change
    const gc = v ? gaugeChip(crew.venue ?? 0, v.kpi, !!crew.endless) : null, gk = gc ? gc.text + (gc.red ? '!' : '') : '';
    if (gk !== hudGaugeKey) { hudGaugeKey = gk; const el = $('value-gauge'); el.textContent = gc ? gc.text : ''; el.classList.toggle('red', !!gc?.red); }
  }
  $('value-main').textContent = v ? `${bvLine({ value: v, quota: crew.quota, venue: crew.venue ?? 0, endless: !!crew.endless, pace: crew.pace, seal: crew.seal ?? v.seal ?? 1 })}${r2line ? ' · ' + r2line : ''}${crew.lastCall ? ' · LAST CALL' : ''}` : '';
  const n = carrying(), cap = gp.pocket, pad = document.body.classList.contains('pad');
  const btn = pad ? GLYPH.A : 'Click';          // use: pick up, swing
  const ibtn = pad ? GLYPH.X : 'E';             // the bucket stand
  const cbtn = pad ? GLYPH.Y : 'F';             // the cart
  const mc = crewCarts()[myCartIdx()];          // the cart I drive, if any
  if (mc) {
    const load = (mc.load ?? 0) + pendingCart.size;
    $('pocket').textContent = `Cart ${load} / ${my.cartCap}${(mc.boost ?? 0) > 0 ? `  TURBO ${Math.ceil(mc.boost)}s` : ''}`;
  } else {   // council round 11 8.12 (C #11): the pocket is the server's pocket (a souvenir or hazard in hand is not in it)
    let pn = me.pocket; for (const id of pending) { const k = balls.get(id)?.kind; if (k !== 'souvenir' && k !== 'hazard' && k !== 'hazwet') pn++; }
    const sv = Math.abs(crew.mods?.stadium?.hands?.[me.id] ?? 0);   // souvenirs in hand: their own ×2 chip by the pocket
    $('pocket').textContent = (cap <= 8 ? '●'.repeat(Math.min(pn, cap)) + '○'.repeat(Math.max(0, cap - pn)) : `${pn} / ${cap}`) + (sv ? `  ★${sv} ×2` : '');
  }
  const left = Math.max(0, crew.shiftSecs - crew.shiftT);
  $('clock').textContent = crew.phase === 'shift' ? `Day ${crew.day} · ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : `Day ${crew.day}`;
  const load = (mc?.load ?? 0) + pendingCart.size;
  $('prompt').textContent = !playing() || r2?.cctvOn || sayer.busy() || storyCard.up || crew.phase !== 'shift' || dusk.active ? ''   // ambient: it hides while any centre item shows (round 7 #3), and in the walk-off (playthrough 5 A9: a stale "Full")
    : me.down > 0 ? 'Seeing stars…'
    : canPlug() || (plugging && crew.mower?.phase === 'plug') ? BOSS_LINES.prompt(pad ? GLYPH.A : 'Space')   // council round 11 #1: the plug
    : canWhistle() ? BOSS_LINES.whistle(pad ? GLYPH.A : 'Space')   // council round 12 #5d; round 13 #5a: take it
    : canBlowWhistle() ? BOSS_LINES.blow(pad ? GLYPH.A : 'Space')   // round 13 #5a: blow it here
    : me.wand && performance.now() - moweFront < 600 ? BOSS_LINES.back
    : crew.lastBucket?.phase === 'huddle' ? ''          // round 6 #5: the banner says HOLD Ⓐ TOGETHER (one text)
    : me.one ? ''   // the Last Bucket banner says it
    : nearestBall()?.kind === 'one' ? `${btn}  Pick up Ball No. 1`
    : chatting ? ''   // §6.3: his bubble is the exchange
    : canChat() ? `Hold ${btn}: chat to Gary`
    : canFill() ? (crew.filling?.includes(me.id) ? `Basket ${crew.basket ?? 0}/${crew.basketMax ?? BUCKETS.BASKET}` : (crew.basket ?? 0) >= (crew.basketMax ?? BUCKETS.BASKET) ? 'Basket full' : (crew.filling?.length ?? 0) >= 2 ? 'Both chutes busy' : `Hold ${btn}: fill a bucket`)
    : views?.prompt(btn, ibtn) ? views.prompt(btn, ibtn)
    : r2?.prompt(btn) ? r2.prompt(btn)
    : me.diving ? `${crew.pond?.treasure && !me.treasure && Math.hypot(crew.pond.treasure.x - me.x, crew.pond.treasure.z - me.z) <= POND.REACH + 0.5 ? `${btn}  Take the ${TREASURE_BY_ID[crew.pond.treasure.id]?.name ?? 'treasure'}` : nearestBall(POND.REACH) ? `${btn}  Grab` : 'Feel around for balls'}${me.bag > 0 ? `  ·  ${ibtn}  Send up ${me.bag}/${diveTiers(me.dive).bag}` : ''}`   // air is the bar
    : dockOpen(me) && (crew.pond?.line ?? 0) > 0 ? `Hold ${ibtn}  Haul up the bag (${crew.pond.line})`
    : dockOpen(me) && crew.players.some(p => p.diving && p.id !== me.id) ? pad ? `Tap ${btn}, then circle either stick to pump air to your diver` : `Hold ${btn} and circle the mouse to pump air to your diver`
    : crew.pond?.unlocked && hasTube(crew.up) && atTube(me) && (carrying() > 0 || me.treasure) ? `${ibtn}  Feed the tube${crew.pond.tube ? ` (${crew.pond.tube} in flight)` : ''}`
    : atFieldRet(me) && (carrying() > 0 || me.treasure) ? `${ibtn}  Send them home`   // council round 10 §C (3 words)
    : dockOpen(me) ? 'Walk into the pond to dive for sunk balls'
    : atShed(me) && crew.fries?.open ? `${btn}: kitchen · fries ${crew.fries.stock}/${crew.fries.max}`
    : atShed(me) && (crew.up?.shed ?? 0) >= 1 ? 'The snack shed is boarded up'   // owner notes: no shed in the world until it opens (stations.js)
    : driving() ? (load >= my.cartCap ? 'Hopper full: drive to the ball return' : `${pad ? 'RT/LT drive · stick steer' : 'W/S drive · A/D steer'} · ${cbtn} get out`)
    : atStand(me) && n ? `${ibtn}  Drop ${n} in the bucket`
    : me.wand ? pad ? performance.now() - wandAt < 3000 ? `RT spray · ${btn} pick up · ${ibtn} put it back` : 'RT spray'   // §7.1
      : performance.now() - wandAt < 3000 ? `Hold ${btn} to spray · look down to rinse your boots · ${ibtn} put it back` : `${btn} spray`
    : nearStation() ? `${ibtn}  Grab the pressure washer${crewCarts().some(c => (c.mud ?? 0) > 0.05) ? crewCarts().length > 1 ? ' (a cart is muddy)' : ' (the cart is muddy)' : ''}`
    : n < cap && !gp.scoop && nearestBall() ? `${btn}  Pick up${nearCart() ? `   ·   ${cbtn}  Drive the cart` : ''}`
    : nearCart() && autoOwned() ? `${cbtn}  Drive · hold ${cbtn}: ${nearAutoMode() === 'harvest' ? 'lap the Track' : 'harvest'}`   // council round 10 §D
    : nearCart() ? `${cbtn}  Drive the cart`
    : atBay(me) && crew.phase === 'shift' ? (me.pocket > 0 ? `${pad ? 'Pull back, push through' : 'Flick'} to swing · ${(crew.venue ?? 0) >= 2 ? 'land it in a green' : 'hit the cart'} (${me.pocket})` : 'Bring balls to hit them')
    : n < cap && !gp.scoop && nearestBall() ? `${btn}  Pick up`
    : n >= cap ? 'Full: head to the ball return' : '';
  { // playthrough 5: the clock-out button (the server offers it once the card is done)
    const co = $('clockout'), offer = crew.clockOut && playing() ? crew.clockOut : null;
    co.classList.toggle('hidden', !offer);
    if (offer) {
      const held = yHold?.kind === 'clockout', many = (offer.of ?? 1) > 1;
      co.classList.toggle('holding', held);
      co.textContent = held && !yHold.sent ? 'Clocking out… keep holding'
        : held ? (many ? `Clocking out · ${offer.n} / ${offer.of} holding` : 'Clocking out…')
        : `Card done · clock out (${pad ? `${GLYPH.Y} hold` : 'hold F'})${many && offer.n ? ` · ${offer.n} / ${offer.of}` : ''}`;
    }
  }
  $('air').classList.toggle('hidden', !me.diving);
  $('air').firstElementChild.style.width = `${((me.air ?? POND.AIR) / diveTiers(me.dive).air) * 100}%`;
  const maxStam = sprintSecs(crew.up?.shoes);
  $('stamina').classList.toggle('hidden', stamina >= maxStam - 0.01 || driving());
  $('stamina').firstElementChild.style.width = `${(stamina / maxStam) * 100}%`;
  swing.setEnabled(playing() && canSwing() && me.down <= 0);
  swing.render($('swinghud'));
}

// ---------------------------------------------------------------- spraying
const sprayRay = new THREE.Raycaster(), sprayDir = new THREE.Vector3(), sprayFrom = new THREE.Vector3(), cartCentre = new THREE.Vector3();
let washTarget = 'cart';
function flushWash(now) {
  if (washSecs > 0) link.act({ t: 'wash', secs: +washSecs.toFixed(3), target: washTarget });
  sprayStats.sent += washSecs; washSecs = 0; washSent = now;
}
const sprayAim = new THREE.Vector3(), sprayV = new THREE.Vector3();
function updateSpray(dt, now) {
  const on = (spraying || rtSpray) && me.wand && playing() && me.down <= 0 && !r2?.cctvOn && !driving() && !chatting;   // §7.1: RT or Ⓐ / Click
  if (sprayHiss) sprayHiss.set(on ? 1 : 0);
  if (on) {
    camera.getWorldDirection(sprayDir);
    // Owner notes: the droplets leave the nozzle tip (gearModel's 'nozzleTip') and fly to where the crosshair lands.
    const tipObj = fpGear.getObjectByName('nozzleTip');
    if (tipObj) tipObj.getWorldPosition(sprayFrom); else sprayFrom.set(0.37, -0.12, -2.08).applyQuaternion(camera.quaternion).add(camera.position);
    const R = my.washReach ?? WASH.RANGE, foam = !!my.foam;   // owner playtest 3 §5.1: 7 m, 9 m with the turbo nozzle; the foam cannon
    const reach = sprayDir.y < -0.02 ? Math.min(R + 2, (camera.position.y - 0.04) / -sprayDir.y) : R;
    sprayAim.copy(camera.position).addScaledVector(sprayDir, reach);
    sprayV.copy(sprayAim).sub(sprayFrom);
    const flight = sprayV.length() / 16;
    sprayV.normalize().multiplyScalar(16); sprayV.y += 4.9 * flight;   // lob it a touch so gravity brings it onto the aim point
    // The foam cannon: a wide, slow, white cone of fat foam (twice the droplets, three times the spread).
    sprayPts.material.size = foam ? 0.2 : 0.11; sprayPts.material.color.setHex(washTarget === 'mower' && mowe.cooling() ? 0x8a8a8a : foam ? 0xffffff : 0xdff4ff);   // round 12 #1a: a cooling nozzle sputters grey
    const jit = foam ? 3.6 : 1.2, nDrops = foam ? 8 : 4;
    for (let i = 0; i < nDrops; i++) {
      const d = drops[dropNext++ % SPRAY_N];
      d.life = Math.min(foam ? 0.8 : 0.6, flight + (foam ? 0.2 : 0.08)); d.p.copy(sprayFrom);
      d.v.copy(sprayV).multiplyScalar(foam ? 0.85 : 1).add(sprayJit.set((Math.random() - 0.5) * jit, (Math.random() - 0.5) * jit * 0.6, (Math.random() - 0.5) * jit));
    }
    // On target? The nearest of the cart (a ~1.5 m sphere) and the fixtures along the spray, within reach.
    sprayRay.set(camera.position, sprayDir);
    let best = null, bestD = Infinity;
    const consider = (id, x, y, z, r) => {
      cartCentre.set(x, y, z);
      const along = cartRel.copy(cartCentre).sub(camera.position).dot(sprayDir);
      if (along < 0 || along > R + r) return;
      if (sprayRay.ray.distanceToPoint(cartCentre) < r && along < bestD) { bestD = along; best = id; }
    };
    crewCarts().forEach((c, i) => { const P = cartViews[i]?.pose; if (P) consider(i ? 'cart' + i : 'cart', P.x, 1.0, P.z, 1.5); });   // 'cart' is the first
    for (const [id, o] of others) if (!o.helper && o.g.visible) consider('p:' + id, o.g.position.x, 1.0, o.g.position.z, 0.6);   // Hose a Friend
    for (const fx of FIXTURES) if (fixtureBuilt(fx.id, crew?.nMats ?? 10)) consider(fx.id, fx.x, fx.id === 'sign' ? 2.0 : fx.id === 'stand' ? 0.6 : 0.1, fx.z, fx.r);   // round 11: no unbuilt bay
    if (crew?.venue === 4) for (const b of balls.values()) if (b.rest && (b.kind === 'hazard' || b.kind === 'hazwet')) consider('h:' + b.id, b.x, 0.1, b.z, 0.7);   // round 11: County hazards
    if (bossFighting(crew?.mower)) consider('mower', crew.mower.x, 0.9, crew.mower.z, 1.5);   // council round 11 #1: MOW-E (the server checks its back)
    if (me.pitch < -1.0 && (me.grime ?? 0) > 0) best = 'self';   // looking down at your boots: the server rinses a layer every 1.5 s
    if (best) { if (washTarget !== best) { flushWash(now); washTarget = best; } washSecs += dt; }
    if (best === 'mower' && !moweBehind(crew.mower, me)) moweFront = now;   // council round 11 #1: hosing its nose, the prompt says where the grille is
    sprayStats.frames++; if (best) sprayStats.hits++;
  }
  if (washSecs > 0 && now - washSent > 250) flushWash(now);
  const pos = sprayGeo.attributes.position.array;
  drops.forEach((d, i) => {
    if (d.life > 0) { d.life -= dt; d.v.y -= 9.8 * dt; d.p.addScaledVector(d.v, dt); }
    const vis = d.life > 0;
    pos[i * 3] = vis ? d.p.x : 0; pos[i * 3 + 1] = vis ? d.p.y : -50; pos[i * 3 + 2] = vis ? d.p.z : 0;
  });
  sprayGeo.attributes.position.needsUpdate = true;
}
let sprayHiss = null;
const sprayStats = { frames: 0, hits: 0, sent: 0 };

// ---------------------------------------------------------------- loop
function resize() {
  const w = innerWidth, h = innerHeight;
  perf.size(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

let last = performance.now(), fall = 0;
const skyAt = new THREE.Vector3(), sprayJit = new THREE.Vector3(), cartRel = new THREE.Vector3();   // reused every frame (no GC hitches)
let ambOn = false, ambT = 0;
let stamina = sprintSecs(0), restT = 0, sprinting = false, padSprint = false;
// ---------------------------------------------------------------- the Deck Cam (council round 10 #4)
// On a deckFall each client cuts its own camera to a fixed shot of the fall (deckcam.js: 2.6 s, 1.8 s for the shift's
// later falls), letterboxed, "DECK CAM · Ⓑ skip" at the bottom-left edge (edge text, never centre). It is the main
// camera, moved after everything else placed it; the next frame puts it back exactly. Movement input is ignored while
// it runs; any key, mouse button or pad button, or a stick pushed past 0.5, skips it. The once-ever PA card (and any
// memo) waits for the cut (say.js hold). views/deck.js reads ctx.deckCam.on to slow the drop and calls
// ctx.deckCam.bonk() on the BONK, which cuts back. No new draw calls: two DOM bars and a label.
const deckCam = { on: false, t: 0, secs: 0, from: null, at: null, wait: null, bonked: false, armed: false, el: null,
  bonk() { if (deckCam.on) deckCam.bonked = true; } };
function deckCamDom() {
  if (deckCam.el) return deckCam.el;
  const st = document.createElement('style');
  st.textContent = `#deckcam { position: fixed; inset: 0; pointer-events: none; z-index: 55; display: none; }
#deckcam.on { display: block; }
#deckcam i { position: absolute; left: 0; right: 0; height: ${DECKCAM.BARS * 100}%; background: #000; }
#deckcam i.top { top: 0; } #deckcam i.bot { bottom: 0; }
#deckcam span { position: absolute; left: max(16px, 2vw); bottom: calc(${DECKCAM.BARS * 100}% + 0.6em); color: #fbf6e8;
  font: 700 clamp(0.8em, 2vh, 1.1em) "Courier New", ui-monospace, monospace; letter-spacing: 0.08em; text-shadow: 0 1px 3px #000; }
#deckcam span::before { content: "● "; color: #e53935; }`;
  document.head.append(st);
  const el = document.createElement('div');
  el.id = 'deckcam'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = '<i class="top"></i><i class="bot"></i><span></span>';
  document.body.append(el);
  return (deckCam.el = el);
}
function deckCamStart(p) {
  Object.assign(deckCam, { on: true, t: 0, secs: p.secs, from: p.from, at: p.at, bonked: false, armed: false, wait: null });
  sayer.hold(p.secs + 3);   // the PA card waits for the cut, as the memo waits for the PA (released when it ends; this is a cap)
  const el = deckCamDom();
  el.querySelector('span').textContent = document.body.classList.contains('pad') ? CUT_LABEL.pad : CUT_LABEL.kb;
  el.classList.add('on');
}
function deckCamEnd() {
  if (!deckCam.on) return;
  deckCam.on = false;
  deckCam.el?.classList.remove('on');
  sayer.hold(0);   // skipped or done: the PA card goes now
}
function onDeckFall(e) {
  const p = cutPlan(e, { driving: driving(), diving: !!me.diving, lift: !!views?.capturing?.(), kitchen: kitchen.isOpen,
    menu: !kitchen.isOpen && menuOpen(), down: me.down, replays: SET.get().deckReplays !== false });
  if (!p) return;
  if (p.wait) { deckCam.wait = { ...p, until: performance.now() / 1000 + p.until }; sayer.hold(p.until + p.secs); return; }   // the cook
  deckCamStart(p);
}
// Once a frame, after the camera is placed (and before the walk-off, which never overlaps a shift's fall).
function deckCamTick(dt) {
  if (deckCam.wait) {
    const w = deckCam.wait;
    if (performance.now() / 1000 > w.until) deckCam.wait = null;
    else if (!kitchen.isOpen) { deckCam.wait = null; if (playing() && me.down <= 0 && !driving()) deckCamStart(w); else sayer.hold(0); }
  }
  if (!deckCam.on) return;
  deckCam.t += dt;
  if (!cutAt(deckCam.t, deckCam.secs, deckCam.bonked).on || me.down > 0 || driving() || !playing()) { deckCamEnd(); return; }
  camera.position.set(deckCam.from.x, deckCam.from.y, deckCam.from.z);
  camera.lookAt(deckCam.at.x, deckCam.at.y, deckCam.at.z);
}
// A pad during the cut: a fresh press or a stick pushed past 0.5 (a stick already held when it started must come
// back first, so a Rat who was walking still sees it) skips. Returns true while the cut eats the pad.
function deckCamPad(p) {
  if (!deckCam.on) return false;
  const sticks = [p.lx, p.ly, p.rx, p.ry];
  if (!deckCam.armed) deckCam.armed = sticks.every(v => Math.abs(v) <= DECKCAM.STICK);
  if (skips({ buttons: p.pressed, sticks: deckCam.armed ? sticks : [] })) deckCamEnd();
  return true;
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  sweep.update(now / 1000, dt);   // round 11: the ×N fades after the sweep
  const [px, py] = pollPad(dt);

  const drivingNow = driving();
  if (drivingNow && playing()) driveCart(dt, px, py, pad?.lt ?? 0, pad?.rt ?? 0);
  else if (engine) engine.set(0);
  if (!drivingNow && playing() && me.down <= 0 && !r2?.capturing() && !views?.capturing() && !deckCam.on) {   // the Deck Cam: you stand still
    let fx = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0) + px;
    let fz = (keys.has('KeyS') ? 1 : 0) - (keys.has('KeyW') ? 1 : 0) + py;
    const m = Math.hypot(fx, fz); if (m > 1) { fx /= m; fz /= m; }
    const sy = Math.sin(me.yaw), cy = Math.cos(me.yaw);
    // Sprint: hold Shift, or click the left stick (it lasts until you stop or run out).
    const moving = m > 0.2;
    if (!moving) padSprint = false;
    const wantSprint = (keys.has('ShiftLeft') || keys.has('ShiftRight') || padSprint) && moving;
    const maxStam = sprintSecs(crew.up?.shoes);
    if (wantSprint && stamina > 0) { stamina = Math.max(0, stamina - dt); restT = 0; if (!stamina) padSprint = false; }
    else if ((restT += dt) > SPRINT.REGEN_DELAY) stamina = Math.min(maxStam, stamina + dt * maxStam / 3);
    sprinting = wantSprint && stamina > 0;
    const speed = plugging ? Math.min(BOSS.HOLD_WALK, my.walk) : my.walk * (sprinting ? SPRINT.SPEED : 1) * (wetPond(me) || creekDiving(me) ? diveTiers(me.dive).swim : views?.speedMul(me) ?? wadeFactor(me.x, me.z, world()));   // round 12 #1c: holding the plug, you walk it home at 2 m/s
    me.x += (fx * cy + fz * sy) * speed * dt;
    me.z += (-fx * sy + fz * cy) * speed * dt;
    if (m > 0.05) { const drum = myGear.getObjectByName('drum'); if (drum) drum.rotation.x -= m * my.walk * dt / 0.28; }
    if (!views?.clamp(me)) clampToField(me, world());
    me.yaw += ((keys.has('ArrowLeft') ? 1 : 0) - (keys.has('ArrowRight') ? 1 : 0)) * 2.2 * dt;
    me.pitch = Math.max(-1.4, Math.min(1.2, me.pitch + ((keys.has('ArrowUp') ? 1 : 0) - (keys.has('ArrowDown') ? 1 : 0)) * 1.5 * dt));
  }
  // Council round 10 #5: under in the creek, the current carries you downstream (0.8 m/s; the server does the same).
  if (!drivingNow && playing() && me.down <= 0 && creekDiving(me)) {
    applyCurrent(me, dt, world());
  }
  if (link && me.placed) link.move(me.x, me.z, me.yaw, drivingNow ? myPose() : null);
  if (crew.phase === 'shift') crew.shiftT += dt;        // smooth between server ticks

  for (const b of balls.values()) { if (b.drifting) stepDrift(b, dt); else advanceBall(b, dt, world()); }
  if (terrainVenue !== (crew.venue ?? 0) && !r2?.revealing) { terrainVenue = crew.venue ?? 0; terrain.setVenue(terrainVenue); }
  terrain.tick(dt, sceneT);
  scoop();
  drawBalls();
  // My own gear: hand-held things hang below the view, the picker rolls ahead.
  myGear.position.set(me.x, 0, me.z);
  myGear.rotation.set(0, me.yaw, 0);
  myGear.visible = fpGear.visible = me.down <= 0 && !drivingNow && !r2?.cctvOn && !r2?.revealing && !me.diving && !deckCam.on
    && !r2?.hushing;   // council round 12 #3b (builder 3): the bank's hush frames the crack, no bucket in the way
  if (!sprayHiss && me.wand) sprayHiss = SFX.sprayLoop?.() ?? null;
  updateSpray(dt, now);

  // The carts: my own pose for the one I drive, the others eased toward the server's.
  const myIdx = myCartIdx();
  crewCarts().forEach((c, i) => {
    const v = cartViews[i];
    if (!v) return;
    const P = v.pose, mine = i === myIdx;
    if (!mine) {
      const kc = 1 - Math.exp(-dt * 10);
      P.x += (c.x - P.x) * kc; P.z += (c.z - P.z) * kc;
      let dy = c.yaw - P.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      P.yaw += dy * kc;
    }
    v.g.position.set(P.x, 0, P.z);
    v.g.rotation.y = P.yaw;
    const spin = mine ? P.v : 0;
    for (const r of v.reels.children) r.rotation.x -= spin * dt / 0.26;
    v.fill.scale.y = Math.max(0.001, Math.min(1, ((c.load ?? 0) + (mine ? pendingCart.size : 0)) / Math.max(1, my.cartCap)) * 0.45);
    v.fill.position.y = v.fill.scale.y / 2;   // in the tipper's frame (its hinge is at y 0.8)
    // §5.3: c.tip counts the 1.5 s tip down; the hopper swings up and back over it (eased, so the 10 Hz snapshot reads smooth).
    const tipGoal = (c.tip ?? 0) > 0 ? Math.sin(Math.PI * Math.min(1, 1 - c.tip / CART.UNLOAD_SECS + 0.12)) : 0;
    v.tipK += (tipGoal - v.tipK) * (1 - Math.exp(-dt * 10));
    v.tipper.rotation.x = 1.05 * v.tipK;
    const mud = c.mud ?? 0;
    for (const m of v.splotches) m.visible = mud > m.userData.at;
    v.body.material.color.setRGB(0.95 - 0.45 * mud, 0.94 - 0.55 * mud, 0.9 - 0.65 * mud);
    // A ping lights the bullseyes up, then they fade back.
    v.flash = Math.max(0, v.flash - dt * 1.5);
    const glow = v.flash > 0 && (v.flash * 12) % 2 > 1;
    for (const t of v.targets) for (const m of t.userData.mats) m.color.set(glow ? 0xfff27a : 0xd9382b);
  });
  if (!engine && drivingNow) engine = SFX.cartEngine();

  const k = 1 - Math.exp(-dt * 12);
  for (const o of others.values()) {
    o.g.position.x += (o.to.x - o.g.position.x) * k;
    o.g.position.z += (o.to.z - o.g.position.z) * k;
    o.body.rotation.y = o.to.yaw;
    const speed = Math.hypot(o.g.position.x - o.last.x, o.g.position.z - o.last.z) / Math.max(dt, 1e-3);
    o.last.x = o.g.position.x; o.last.z = o.g.position.z;
    const mode = o.down > 0 ? 'knocked' : speed > 0.4 ? (o.gearLevel === 2 ? 'carry' : 'walk') : 'idle';
    animatePerson(o.person, dt, { mode, speed });
  }
  crowd.update(dt, camera);

  // Knocked flat: the camera drops to the grass and tips over, then gets up.
  fall += ((me.down > 0 ? 1 : 0) - fall) * Math.min(1, dt * (me.down > 0 ? 12 : 4));
  sky.setTime(crew.phase === 'shift' ? skyK(crew.today, crew.shiftT / crew.shiftSecs) : crew.phase === 'report' ? 1 : 0);   // round 11: Night Range holds the dusk
  sky.follow(skyAt.set(me.x, 0, me.z));
  if (drivingNow) {
    // Chase cam: behind and above my cart, looking a little ahead of it.
    const P = myPose(), fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    camera.position.set(P.x - fx * 7, 3.6, P.z - fz * 7);
    camera.lookAt(P.x + fx * 6, 0.8, P.z + fz * 6);
  } else {
    const creek = !drivingNow && creekDiving(me), under = (wetPond(me) && !drivingNow) || creek;
    // eyeY follows the bed down into the Deep End; in the creek the eye sits BED + 0.55 (council round 10 #5)
    camera.position.set(me.x, creek ? CREEK_DIVE.BED + CREEK_DIVE.EYE : under ? eyeY(me.x, me.z) : EYE - fall * (EYE - 0.25), me.z);
    if (crew.phase === 'lobby' && (crew.venue ?? 0) >= 2) camera.position.z += 6;   // council round 11 8.15 (C #9): the lobby view clears the deck's pillars
    if (under !== !!scene.userData.under) {    // murky green, a flashlight, the surface overhead
      scene.userData.under = under;
      // Owner (Xbox): after leaving the pond everything stayed faded. The fog's distances were set for the
      // water and never put back (the sky only resets its colour): save them going under, restore them coming up.
      if (under) { surfaceFog.color.copy(scene.fog.color); surfaceFog.near = scene.fog.near; surfaceFog.far = scene.fog.far; scene.fog.color.set(0x1f4a3a); }
      else { scene.fog.near = surfaceFog.near || 120; scene.fog.far = surfaceFog.far || 900; scene.fog.color.copy(surfaceFog.color); }
      document.body.classList.toggle('underwater', under);
      diveLight.intensity = under ? 60 : 0;
      scuba.setUnder(under);   // a creek dive (council round 10 #5) takes this same path, so its fog is restored on surfacing too
    }
    // The creek runs clear teal (waterLook(1)) against the murky pond; the same 9 m fog keeps the frame cheap.
    if (under) { scene.fog.near = 0.5; scene.fog.far = creek ? CREEK_DIVE.FOG_FAR : 9; scene.fog.color.set(creek ? waterLook(1).fog : 0x1f4a3a); }
    if (spawnT <= SPAWN_PITCH.SECS) { spawnT += dt; me.pitch += SPAWN_PITCH.delta(crew.venue, spawnT, dt); }   // round 13 #6: added, so the stick still counts
    { const tilt = SET.get().reduceMotion ? 0.3 : 1; camera.rotation.set(me.pitch + fall * 1.1 * tilt, me.yaw, fall * 0.6 * tilt, 'YXZ'); }
  }

  if (scuba.group.visible) {
    const tier = diveTiers(me.dive);
    scuba.tick(dt, now / 1000, { creek: creekDiving(me), air01: (me.air ?? tier.air) / tier.air, pumping: crew.players?.some(p => p.pumping),
      pumpRate: r2?.pumpRate?.() ?? 0.6, clarity: crew.pond?.clarity ?? 1, glintR: tier.glintR, light: tier.light, balls });   // balls: the torch glints (round 6 #9)
  }
  views?.tick(dt, sceneT);  // round-4 venue views, after the camera is placed
  views?.aim(aimInput());   // round 6 #4: the landing ring at a crew bay
  views?.camera(camera, dt);
  r2?.tick(dt, now);       // after the camera: CCTV and the venue reveal drive it when active
  deckCamTick(dt);         // council round 10 #4: the Deck Cam moves the main camera while it runs
  cartHoldTick(dt);        // council round 10 §D: Ⓨ held at an autopilot cart, or for the drones
  dusk.tick(dt);           // the end-of-day walk-off: last word on the camera while it runs
  hinter.tick(dt, { playing: !!playing() && !menuOpen() && tipsAllowed(crew, me.id) && sayer.centre.quietFor() && !storyCard.up,   // round 13 #2a: a tip never queues   // tips.js (playthrough 4 A15: a carried-over day's finished checklist no longer blocks them)
    // (owner notes: venue/pad/show used to sit inside the comment above, so every hint was marked seen and never shown)
    venue: crew.venue ?? 0, pad: document.body.classList.contains('pad'), show: (msg, id) => { showHint(msg); tipPointer.point(id); },
    day: crew.day, cash: crew.cash, signMud: crew.fixtures?.sign ?? 0, pocketFull: gp.pocket > 0 && carrying() >= gp.pocket, washerCash: crew.washer?.credit ?? 0, onDock: dockOpen(me), beers: beersPoured, deckOrder: !!crew.mods?.deck?.order,
    baysFresh: !!bayLine.fresh,   // round 11 (owner): a just-built bay (bayline.js) gets its one tip
    ...tipCtx(crew, me) });   // owner notes: up, myDive, mats' mud (tips.js)
  board.tick(dt);
  board.hideFloats(popsHidden());   // round 14 6.6: pay floats gone at once while a priority 0–1 item is up
  confetti.tick(dt);        // the shared confetti pool (round 6: the bell's stamp, the huddle)
  mowe.update(crew.mower ?? null, me.id); mowe.setPost(crew.moweWhistle > 0, crew.moweWhistle === 1, crew.moweWhistle === 3 && crew.moweWhistleBy !== me.id ? crew.moweWhistleBy : null);   // round 13 #5a: the whistle on its post, or on a mate's lanyard
  mowe.tick(dt, sceneT, me);   // playtest round 9: this call had slipped into the comment above (MOW-E froze at the origin)
  kitchen.tick(dt);
  if (kitchen.isOpen && (!atShed(me) || me.down > 0)) kitchen.close();
  scenery.tick(dt, sceneT += dt, crew.phase === 'shift' ? crew.shiftT / crew.shiftSecs : crew.phase === 'report' ? 1 : 0);
  // Ambience: birds by morning, crickets at dusk, distant thwacks, the floodlight hum, muffled underwater.
  if (!ambOn) { const h = SFX.audioHandle(); if (h) { AMB.attach(h.ctx, h.master, h.isMuted); AMB.startAmbience(); ambOn = true; } }
  if (ambOn && (ambT -= dt) <= 0) {
    ambT = 0.3;
    AMB.setAmbience({ timeOfDay01: crew.phase === 'shift' ? crew.shiftT / crew.shiftSecs : crew.phase === 'report' ? 1 : 0.1, lastCall: !!crew.lastCall,
      underwater: !!scene.userData.under, nearField: me.z < -5 ? 1 : 0, crowd: crew.phase === 'shift' ? 0.6 : 0, ...views?.amb(crew) });
  }
  if (garyView?.g.visible && garyView.to) {
    const kg = 1 - Math.exp(-dt * 8);
    garyPose.x += (garyView.to.x - garyPose.x) * kg; garyPose.z += (garyView.to.z - garyPose.z) * kg;
    let dy = garyView.to.yaw - garyPose.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); garyPose.yaw += dy * kg;
    garyView.g.position.set(garyPose.x, 0, garyPose.z); garyView.g.rotation.y = garyPose.yaw;
    if (garyView.salute > 0) {   // round 6 #5: the salute, ~1.2 s: the arm comes up to the brim and the hat lifts
      garyView.salute = Math.max(0, garyView.salute - dt / 1.2);
      const k = Math.sin(Math.PI * (1 - garyView.salute));
      garyView.arm.rotation.z = -2.6 * k; garyView.arm.rotation.x = -0.5 * k;
      garyView.hat.position.y = 2.08 + 0.18 * k; garyView.hat.rotation.x = -0.35 * k;
      if (garyView.salute <= 0 && garyView.to.phase !== 'drive') garyView.g.visible = false;
    } else if (garyView.notes > 0) {   // round 8 #2: stalled, the arm up in front of him (his clipboard), then down
      garyView.notes = Math.max(0, garyView.notes - dt);
      const k = Math.min(1, garyView.notes * 3, (GARY.STALL - garyView.notes) * 3);
      garyView.arm.rotation.x = -1.3 * k; garyView.arm.rotation.z = -0.3 * k;
    }
    // §6.3: his side of the chat, a three-word bit every 2 s, then "Right, then." for a second.
    const ch = garyView.to.chat;
    garyView.bubbleEnd = Math.max(0, garyView.bubbleEnd - dt);
    if (ch) { garyView.chatT = (garyView.chatT ?? garyView.to.chatT ?? 0) + dt; garyView.bubble.set(chatBit(garyView.chatT)); }
    else { garyView.chatT = null; if (garyView.bubbleEnd > 0) garyView.bubble.set(CHAT_END); else if (garySays?.t > 0) garyView.bubble.set(garySays.text); }
    if (garySays) { garySays.t -= dt; if (garySays.t <= 0 || garyView.to.phase !== 'warn') garySays = null; }   // round 12: his hello, only while he waits at the gate
    // Council round 11 8.9 (A #7): easy to miss. It stays up for his whole wait, and says it again (a 0.5 s pop) once,
    // when a Rat first comes within 8 m.
    if (garySays && !garySays.near && Math.hypot(garyPose.x - me.x, garyPose.z - me.z) < 8) { garySays.near = true; garySays.pop = 0.5; }
    { const k = 2.6 * (1 + 0.25 * Math.sin(Math.PI * Math.min(1, (garySays?.pop ?? 0) / 0.5))); if (garySays?.pop > 0) garySays.pop = Math.max(0, garySays.pop - dt); garyView.bubble.sprite.scale.set(k, k * 64 / 512, 1); }   // textSprite's 2.6 × 64/512
    garyView.bubble.sprite.visible = !!ch || garyView.bubbleEnd > 0 || !!garySays;
    if (garyView.bubble.sprite.visible) {   // playthrough 5 A7: in chat reach (1-2.5 m) a bubble at 3.15 m sat off the top of the screen
      const d = Math.hypot(garyPose.x - camera.position.x, garyPose.z - camera.position.z);
      garyView.bubble.sprite.position.y = Math.max(2.3, Math.min(3.15, camera.position.y + 0.45 * d));   // ≤ ~29° above level
      // Council round 12, 9.5 (C #6, builder 4): the bubble's top stays under 70 % of the screen's height (NDC y 0.4),
      // clear of the HUD, whatever the pitch: lower it (down to 1.9 m) until its top projects there. No allocation.
      const sp = garyView.bubble.sprite;
      // Council round 14 6.2 (builder 4): at most 9 % of the screen tall, and it fades out inside 2.5 m (not in a chat: the
      // bubble IS the exchange there, so it only shrinks)
      sp.material.opacity = clampBubbleSize(sp, camera, bubbleV, sp.scale.x, sp.scale.y, { fade: !ch });
      bubbleAt.x = garyView.g.position.x + sp.position.x; bubbleAt.z = garyView.g.position.z + sp.position.z; bubbleAt.half = sp.scale.y / 2;
      sp.position.y = clampBubbleY(sp.position.y, bubbleAt, camera, bubbleV);   // bubbleclamp.js
    }
    garyView.plate.sprite.visible = !garyView.bubble.sprite.visible;   // one label over him at a time (the bubble may sit at the plate's height)
  }
  // Council round 13 #2b (C #7): name plates (Rats, helpers, Gary) go within 15 m of the return during the hush, the
  // note card and the epilogue. One pass, no allocation.
  {
    const bid = storyCard.up ? storyCard.beat?.id : null, hush = !!r2?.hushing || bid === 'note' || bid === 'epilogue';
    for (const o of others.values()) if (o.tag) o.tag.visible = plateFade(o.g.position.x, o.g.position.z, SIM.STAND, hush) > 0;
    if (garyView && hush && !plateFade(garyView.g.position.x, garyView.g.position.z, SIM.STAND, hush)) garyView.plate.sprite.visible = garyView.bubble.sprite.visible = false;
  }
  if (link) hud(dt);
  ballReturn.update(stationsShown(crew).washer); ballReturn.basket(crew.basket ?? 0, crew.filling?.length ?? 0, crew.basketMax ?? BUCKETS.BASKET); ballReturn.machine(crew.up?.filler ?? 0, crew.machT ?? null); ballReturn.bays(crew.phase === 'shift' ? crew.mats : null, crew.venue); ballReturn.silo(siloFill(crew.silo, crew.filled)); ballReturn.tick(dt); fieldReturns.update(crew.up?.returns ?? 0); fieldReturns.tick(dt, camera.position); dispatchRing.sync(crew.mods?.county?.zone);   // §3.3: the basket's heap   // the pipe runs through the washer once it's in the world
  props.tick(dt, sceneT, crew.phase === 'shift' ? crew.shiftT / crew.shiftSecs : crew.phase === 'report' ? 1 : 0);   // station details (props.js)
  perf.tick(now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
// Round-2 features (round2.js) get the things main.js owns.
r2 = setupRound2({
  scene, camera, $, toast, say, unsay: sayer.forget, centre: sayer.centre, centreBusy: p => sayer.centre.busy(p) /* round 13 #2b: the washer tip */, whenPaIdle: sayer.whenPaIdle /* council round 12, 4c: the end card waits on it */, arch: scenery.setArch, board, SFX, nameOf, me, keys, floods, showMemo, pondMeshes, terrain,
  get sign() { return signRef; },
  link: () => link, crew: () => crew, report: () => report, driving, pad: () => pad, balls: () => balls,
  views: () => views,
  perfLow: () => perf.low,   // round 6 #5: half the confetti on the low tier
});
// Round 4: the venue views (views/index.js). Everything a view may touch comes in through this ctx.
views = createViews({
  scene, camera, me, board, SFX, keys, terrain, sky, rightNet, rightPoles, cartPose, cartViews, world, nameOf, toast, say, feed, showMemo,
  perf,                      // round 6: views read perf.low (the Tiered flags drop to 32 px, the ring re-aims at 5 Hz)
  chevron: (x, z, secs) => edgeChev.show(x, z, secs),   // council round 13 #7a (builder 2): the screen-edge chevron toward the inspector
  venues: r2.venueParts,     // venues.js parts: the deck, both stands and crowds (crowdBob), the jumbotron, the Lift car (carY)
  crew: () => crew, balls: () => balls, pad: () => pad, act: msg => link?.act(msg),
  playing: () => !!playing(), driving: () => !!driving(),
  dusking: () => !!dusk.state?.cam,   // playthrough 4 C5: the end-of-day overhead camera is up (the Orbital view hides the Lift tower)
  deckCam,                   // council round 10 #4: views/deck.js slows the drop while deckCam.on and calls deckCam.bonk() on the BONK
});
perf.attach({ sun: sky.sun, crowd, scuba, ballMesh, venueRate: setHeavyRate, toast: m => toast(m, 3) });
// Station details and the cheap graphics pass (props.js), scaled by the perf profile.
const props = createProps({ scene, camera, renderer, perf, sky, me, cartViews, fpGear, myGear, others,
  crew: () => crew, sprayOn: () => (spraying || rtSpray) && me.wand && playing() && me.down <= 0, ballCount: () => balls.size });
const dusk = createDusk({ scene, camera, me, others, balls, crew: () => crew, buildPerson, animatePerson, perf, settings: SET.get, fpGear, myGear,
  quiet: () => sayer.busy('STAMP', 'MEMO') || sayer.visible?.key === 'rally' });   // playthrough 5 B3: the pill steps aside
SET.set({});   // re-apply saved settings now the PA exists
requestAnimationFrame(frame);
// Textures and preloading: once the textures are in, build every venue's group (hidden) and compile every shader
// behind the title card, so the first shift and a venue's reveal don't hitch. Never blocks a join. ?noprewarm: A/B.
if (!/[?&]noprewarm/.test(location.search)) TEX.ready.then(() => prewarm({ renderer, scene, camera, sun: sky.sun, build: [r2.venueParts.prebuild], onProgress: k => loadBar(0.7 + 0.3 * k) }))
  .then(s => console.info(`[prewarm] ${s.programs} shaders${s.async ? ' (async)' : ''}, ${s.textures} textures, ${s.ms} ms (compile ${s.compileMs})`))
  .catch(e => { console.warn('[prewarm]', e); loadBar(1); });
else TEX.ready.then(() => loadBar(1));

// Dev hook: /?debug exposes live state for poking at from the console.
if (new URLSearchParams(location.search).has('debug')) window.rr = { me, balls, others, act, interact, cartPose, cartViews, pressAct, releaseAct, get crew() { return crew; }, startShift, get link() { return link; }, camera, sprayStats, todoArrow, say: sayer, ballReturn, fieldReturns, deckCam, onDeckFall, pauseGoals,
  scene, mowe };   // round 14 #0e: scripts/smoke.mjs reads the mower root
// ?signs: draw each sign's facing and log any mesh whose world normal disagrees with signs.js (loaded only then).
if (new URLSearchParams(location.search).has('signs')) import('./signsdebug.js').then(m => m.installSignDebug({ scene, venue: () => crew ? (crew.endless ? 6 : crew.venue ?? 0) : 0 }));
