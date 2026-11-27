// Council round 12, 9.5 (C #6, builder 4): a speech bubble over a figure never covers the HUD. Its top stays under
// BUBBLE.TOP of the screen's height (NDC y 0.4 = 70 % up), lowered (down to BUBBLE.MIN m) when the camera is close or
// looking up. No allocation: the caller passes a scratch Vector3. Used by main.js (Gary at the gate) and, as a
// hand-off, views/garycameo.js (Gary at the return, "Where do these go, boss?").
//
//   clampBubbleY(y, { x, z, half }, camera, v)  → the bubble's centre height to use (≤ y)
//     y: the height it wants; x, z: its world position; half: half its world height (sprite.scale.y / 2)
export const BUBBLE = { TOP: 0.4, MIN: 1.9, STEPS: 6 };
export function clampBubbleY(y, { x, z, half = 0 }, camera, v) {
  const top = h => { v.set(x, h + half, z).project(camera); return v.z > 1 ? -1 : v.y; };   // behind the camera: no clamp
  if (top(y) <= BUBBLE.TOP) return y;
  let lo = Math.min(BUBBLE.MIN, y), hi = y;
  for (let i = 0; i < BUBBLE.STEPS; i++) { const m = (lo + hi) / 2; if (top(m) > BUBBLE.TOP) hi = m; else lo = m; }
  return lo;
}

// Council round 14 6.2 (C #2, builder 4): the giant bubble. Up close (Gary at the case, a Rat clocked in beside him)
// his bubble filled the top of the screen for a minute. Its on-screen height is capped at BUBBLE.SIZE of the viewport
// (the sprite is scaled down from its base size bw × bh to fit), and it fades out inside BUBBLE.FADE m (0 at FADE_IN,
// whole at FADE), like the name plates. No allocation: v is a scratch Vector3.
//   clampBubbleSize(sprite, camera, v, bw, bh, { fade = true }) -> the opacity multiplier (0..1); sets sprite.scale
Object.assign(BUBBLE, { SIZE: 0.09, FADE: 2.5, FADE_IN: 1.5 });
export function bubbleSizeK(worldH, dist, fovDeg, cap = BUBBLE.SIZE) {
  const frac = worldH / (2 * Math.max(0.05, dist) * Math.tan((fovDeg * Math.PI / 180) / 2));
  return frac > cap ? cap / frac : 1;
}
export const bubbleFade = dist => Math.min(1, Math.max(0, (dist - BUBBLE.FADE_IN) / (BUBBLE.FADE - BUBBLE.FADE_IN)));
export function clampBubbleSize(sprite, camera, v, bw, bh, { fade = true } = {}) {
  sprite.getWorldPosition(v);
  const d = v.distanceTo(camera.position);
  const k = bubbleSizeK(bh, d, camera.fov ?? 70);
  sprite.scale.set(bw * k, bh * k, 1);
  return fade ? bubbleFade(d) : 1;
}
