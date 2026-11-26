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
