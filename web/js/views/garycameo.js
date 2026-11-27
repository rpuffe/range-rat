// Council round 11 #7: Gary in the world. A lightweight Gary on foot (people.js, a navy blazer, a red tie quad that
// flaps), seen twice, never as centre text:
//   * the Orbital's promotion morning: he rides the Lift car up and back once (~30 s) standing on its roof, tie
//     flapping, while the beat's cards play ("I always wanted to see it.");
//   * the first endless morning: he stands at the return all shift, tie loose, holding a blue bucket. The first Rat
//     within 3 m gets his bubble, "Where do these go, boss?" (world text).
// Driven by views/orbit.js (active at the Orbital and in endless). The rules (the ride's height, the spot, who is near)
// are pure and exported for tests; the figure is built on first use (only on those two mornings).
// Xbox: the figure is people.js's merged-per-limb person (shared material) + the tie + one bubble sprite, only while
// he's on show. No per-frame allocation.
import * as THREE from 'three';
import { buildPerson, animatePerson } from '../people.js';
import { clampBubbleY, clampBubbleSize } from '../bubbleclamp.js';
import { STAR_LINE } from '../landmarks.js';   // council round 14 #5c (builder 3): with the star owned, he says it first   // council round 12 9.5 (builder 4's hand-off): the bubble never covers the HUD

export const CAMEO = Object.freeze({
  RIDE_SECS: 30,          // the whole ride: board, up, the view, down, step off
  RIDE_TOP: 26,           // metres above the platform: high enough to be a ride, low enough to see him from the range
  NEAR: 3,                // a Rat this close to him at the return gets his bubble
  BUBBLE: 'Where do these go, boss?',
  BUBBLE_SECS: 5,
  RIDE_SCALE: 1.3,       // council round 12 #3c: he reads at 800 × 600 from the reveal camera's Lift shot
  FACE: -1.45,            // council round 12 #3d: at the return he faces the crew (−x) and the reveal's case shot (C #11: his back was to them)
  ROOF: 1.65,             // the car's roof above its centre (venues.js: a 2.4 m box + the 0.5 m green cap at +1.4)
  SPOT: Object.freeze({ dx: -2.4, dz: 1.3 }),   // at the return (SIM.STAND), beside it, facing the mats
});
const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };

// The ride's height above the platform at t seconds (0 before and after): board 0-3 s, up 3-11, the view 11-19,
// down 19-27, step off 27-30.
export function liftRideY(t) {
  if (!(t >= 0) || t >= CAMEO.RIDE_SECS) return 0;
  return CAMEO.RIDE_TOP * (smooth(3, 11, t) - smooth(19, 27, t));
}
// Where he stands at the return.
export const returnSpot = stand => ({ x: stand.x + CAMEO.SPOT.dx, z: stand.z + CAMEO.SPOT.dz });
// The first of these positions within NEAR of the spot (or null). pos: [{ x, z, ok }].
export function firstNear(list, spot, r = CAMEO.NEAR) {
  for (const p of list ?? []) if (p && p.ok !== false && Math.hypot(p.x - spot.x, p.z - spot.z) <= r) return p;
  return null;
}

// A one-line world bubble (the same look as his bubble at the gate).
function bubbleSprite(text) {
  const w = 512, c = document.createElement('canvas'); c.width = w; c.height = 64;
  const x = c.getContext('2d');
  x.font = 'italic 600 32px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const tw = Math.min(w - 16, x.measureText(text).width + 40);
  x.fillStyle = '#fbf6e8'; x.beginPath(); x.roundRect((w - tw) / 2, 8, tw, 48, 18); x.fill();
  x.fillStyle = '#2a2418'; x.fillText(text, w / 2, 33, w - 40);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(2.6, 2.6 * 64 / w, 1); s.renderOrder = 10;
  return s;
}

export function createGaryCameo(scene) {
  let fig = null, tie = null, bubble = null, root = null;
  let rideT = -1, atReturn = null, bubbleT = 0, bubbled = false, clock = 0;
  let starBubble = null, starNext = false, starSaid = false;   // council round 14 #5c: "A star. Named Gary. I'll allow it." once
  const BUBBLE_Y = 2.35, scratch = new THREE.Vector3();
  function build() {
    if (root) return;
    root = new THREE.Group(); root.name = 'gary-cameo'; root.visible = false; scene.add(root);
    fig = buildPerson({ seed: 'gary-regional', shirt: 0x2b3a67, pants: 0x474a52, skin: 0xe0ac86, hat: false });
    root.add(fig.root);
    // The tie: a red quad hung from the collar, pivoting at the knot so it can flap.
    tie = new THREE.Group(); tie.position.set(0, 0.47, 0.135);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.36), new THREE.MeshLambertMaterial({ color: 0xb3261e, side: THREE.DoubleSide }));
    quad.position.y = -0.18; tie.add(quad);
    fig.parts.torso.add(tie);
    bubble = bubbleSprite(CAMEO.BUBBLE); bubble.position.y = BUBBLE_Y; bubble.visible = false; root.add(bubble);
  }
  return {
    // The Lift ride starts now (the Orbital's promotion beat).
    ride() { build(); rideT = 0; atReturn = null; fig.setCarry('none'); root.scale.setScalar(CAMEO.RIDE_SCALE); },
    // He stands at the return (spot: {x, z}) until stand(null). star: the crew owns the star named Gary (landmark tier 5):
    // his first bubble is the star line (once a session), then "Where do these go, boss?".
    stand(spot, { star = false } = {}) {
      if (!spot) { atReturn = null; if (root && rideT < 0) root.visible = false; return; }
      build(); atReturn = spot; rideT = -1; bubbled = false; bubbleT = 0; fig.setCarry('bucket'); root.scale.setScalar(1);
      if (star && !starSaid) {
        if (!starBubble) { starBubble = bubbleSprite(STAR_LINE); starBubble.position.y = BUBBLE_Y; starBubble.visible = false; root.add(starBubble); }
        starNext = true;
      }
    },
    get riding() { return rideT >= 0 && rideT < CAMEO.RIDE_SECS; },
    get standing() { return !!atReturn; },
    // The Lift car's height this ride wants (0 when he isn't riding): views/orbit.js lifts the car with it.
    rideY() { return this.riding ? liftRideY(rideT) : 0; },
    // Every frame. lift: { x, z, carY } (the car's centre now); rats: [{ x, z, ok }] (for the bubble).
    tick(dt, { lift = null, rats = null, camera = null } = {}) {
      if (!root) return;
      clock += dt;
      if (rideT >= 0) {
        rideT += dt;
        if (rideT >= CAMEO.RIDE_SECS) { rideT = -1; root.visible = !!atReturn; }
        else if (lift) {
          root.visible = true; bubble.visible = false;
          root.position.set(lift.x, lift.carY + CAMEO.ROOF, lift.z);
          root.rotation.y = clock * 0.25;   // he turns slowly, taking in the view
          const wind = clamp01(liftRideY(rideT) / CAMEO.RIDE_TOP);
          tie.rotation.x = -0.25 - wind * (0.9 + 0.35 * Math.sin(clock * 11));   // tie flapping, harder up top
          tie.rotation.z = wind * 0.3 * Math.sin(clock * 7.3);
          animatePerson(fig, dt, { mode: 'idle' });
        }
        return;
      }
      if (!atReturn) { root.visible = false; return; }
      root.visible = true;
      root.position.set(atReturn.x, 0, atReturn.z);
      root.rotation.y = CAMEO.FACE;   // council round 12 #3d: facing the crew, beside the glass case
      tie.rotation.x = -0.35; tie.rotation.z = 0.25 + 0.04 * Math.sin(clock * 1.3);   // tie loose
      animatePerson(fig, dt, { mode: 'idle' });
      const near = firstNear(rats, atReturn);
      if (!bubbled && near) { bubbled = true; bubbleT = CAMEO.BUBBLE_SECS * (starNext ? 2 : 1); }
      if (bubbleT > 0) bubbleT = Math.max(0, bubbleT - dt);
      // Council round 14 #5c: the star line for the first BUBBLE_SECS, then his usual line (one bubble at a time).
      const starUp = starNext && bubbleT > CAMEO.BUBBLE_SECS;
      if (starNext && bubbled && !starUp) { starNext = false; starSaid = true; }
      if (starBubble) starBubble.visible = starUp;
      bubble.visible = bubbleT > 0 && !starUp;
      const shown = starUp ? starBubble : bubble;
      // At the return the root is at ground level, scale 1: the bubble's local y is its world height.
      if (shown.visible && camera) shown.position.y = clampBubbleY(BUBBLE_Y, { x: atReturn.x, z: atReturn.z, half: shown.scale.y / 2 }, camera, scratch);
      if (shown.visible && camera) shown.material.opacity = clampBubbleSize(shown, camera, scratch, 2.6, 2.6 * 64 / 512);   // council round 14 6.2 (builder 4's hand-off): the giant bubble
    },
  };
}
