// End of the day: the walk-off (owner playtest: "zoom out overhead to see how many balls we missed, watch the
// people walk away"). The pure half: the timeline, the camera path, the "left out there" count, the walk route
// and the hold maths. No three, no DOM (test/dusk.test.mjs). duskview.js draws it.
//
// The beat runs after the bell's stamp (main.js stampUntil) and before the report card:
//   0.0 s  the camera starts lifting out of first person (3 s, ease in-out) to a high three-quarter view
//   0.5 s  the crew and the hired teenagers turn and walk to the gate, then the car park
//   0.6 s  every ball still on the field starts to glow;  1.2 s  "142 left out there" at the bottom edge
//   5.5 s  the report card opens (any key, click or pad button gets there at once)
// Reduce Motion: no camera move, a 2.2 s dim and the count. The ending's own finale and a rejoin skip it.

export const DUSK = {
  SECS: 5.5,           // the whole beat, after the stamp
  CALM_SECS: 2.2,      // Reduce Motion: the dim and the count only
  CAM_SECS: 3,         // the lift
  WALK_AT: 0.5,        // the crew turns for the gate
  ME_WALK_AT: 1.4,     // your own body waits until the camera is well above it
  GLOW_AT: 0.6, GLOW_IN: 0.8,
  LABEL_AT: 1.2,
  DIM: 0.45,           // Reduce Motion's fade (opacity of the dark veil)
  WALK_SPEED: 1.7,     // m/s, an end-of-shift amble
  END: { x: 0, y: 105, z: 62 },    // high over the car-park side of the stand, looking down the range
  LOOK: { x: 0, y: 0, z: -55 },
  // scenery.js ENTRANCE (copied: scenery.js imports three): inside the gate, the gate, the lot
  ROUTE: [[-3, 5.5], [-3, 9.5], [-3, 20], [-3, 31]],
  LOT: { x: -10, z: 31 },
};

const clamp01 = v => Math.min(1, Math.max(0, v));
// Smooth at both ends (cubic in-out): 0 -> 0, 0.5 -> 0.5, 1 -> 1, zero slope at 0 and 1.
export const easeInOut = t => { t = clamp01(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

// The camera at time t (s) into the beat: from the first-person eye to DUSK.END. The height leads a little
// (it is up and clear of the nets before it travels), both eased, so it never snaps. w: the look blend (0..1).
export function camPath(t, from, to = DUSK.END, secs = DUSK.CAM_SECS) {
  const u = clamp01(t / secs), w = easeInOut(u), wy = easeInOut(Math.min(1, u * 1.25));
  return { x: from.x + (to.x - from.x) * w, y: from.y + (to.y - from.y) * wy, z: from.z + (to.z - from.z) * w, w };
}

// Should the beat run, and how? The ending keeps its own finale; a rejoin into the report shows the card at once.
export function duskPlan({ ending = false, rejoin = false, reduceMotion = false } = {}) {
  if (ending || rejoin) return { run: false, cam: false, secs: 0 };
  return reduceMotion ? { run: true, cam: false, secs: DUSK.CALM_SECS } : { run: true, cam: true, secs: DUSK.SECS };
}

// When the report card may open (performance.now ms): after the stamp's hold, plus the beat.
export function holdEnd(now, stampUntil, plan) {
  return plan?.run ? Math.max(now, stampUntil || 0) + plan.secs * 1000 : stampUntil || 0;
}

// What shows at time t (s) into the beat.
export function duskStage(t, plan) {
  const calm = !plan.cam;
  return {
    cam: plan.cam ? easeInOut(t / DUSK.CAM_SECS) : 0,
    glow: clamp01((t - (calm ? 0.2 : DUSK.GLOW_AT)) / DUSK.GLOW_IN),
    label: t >= (calm ? 0.3 : DUSK.LABEL_AT),
    dim: calm ? DUSK.DIM * clamp01(t / 0.6) : 0,
    walk: t >= DUSK.WALK_AT, meWalk: plan.cam && t >= DUSK.ME_WALK_AT,
    done: t >= plan.secs,
  };
}

// Is this ball still out there? Not picked (hidden), not sunk in the pond, not Ball No. 1 (the ending's).
export const outThere = b => !!b && !b.hidden && !b.sunk && b.kind !== 'one';
export function leftOut(balls) {
  let n = 0;
  for (const b of balls.values ? balls.values() : balls) if (outThere(b)) n++;
  return n;
}
export const leftLine = n => n <= 0 ? 'Not a ball left out there' : n === 1 ? '1 ball left out there' : `${n} left out there`;

// The glow's budget by perf tier (detail.js detailFor): one Points draw call either way.
export const glowBudget = d => d?.hi ? { max: 1500, pulse: true, size: 4.5 } : { max: 500, pulse: false, size: 5 };

// The walk off: from where you stand, to the gate, up the path, to a spot in the lot (n spreads them out).
export function walkRoute(from, n = 0) {
  const pts = [[from.x, from.z]];
  // On the field side of the gate: along the stand to the gate first. Already past it: up the path to the cars.
  if (from.z < 9.5) for (const p of DUSK.ROUTE) pts.push(p);
  else pts.push([-3, Math.max(from.z, 20)]);
  pts.push([DUSK.LOT.x + ((n * 1.7) % 7) - 3, DUSK.LOT.z + ((n * 2.3) % 4) - 1]);
  return pts;
}
// Where a walker is after d metres along the route; yaw faces the way it walks (people.js figures face -z at 0).
export function walkAt(route, d) {
  let left = Math.max(0, d);
  for (let i = 1; i < route.length; i++) {
    const [ax, az] = route[i - 1], [bx, bz] = route[i], L = Math.hypot(bx - ax, bz - az);
    if (L < 1e-6) continue;
    const yaw = Math.atan2(-(bx - ax), -(bz - az));
    if (left <= L) return { x: ax + (bx - ax) * left / L, z: az + (bz - az) * left / L, yaw, done: false };
    left -= L;
  }
  const [lx, lz] = route[route.length - 1], [px, pz] = route[Math.max(0, route.length - 2)];
  return { x: lx, z: lz, yaw: Math.atan2(-(lx - px), -(lz - pz)), done: true };
}

// A fresh press of any pad button (held ones from before the beat don't count).
export function padEdge(prev, now) {
  let hit = false;
  for (let i = 0; i < now.length; i++) if (now[i] && !prev[i]) hit = true;
  return hit;
}
