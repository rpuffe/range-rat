// Stations appear when they matter (owner notes, 2026-11-24): the ball washer isn't in the world until the
// crew owns the Ball washer row, and the snack shed isn't until it's open. When either appears mid-game it
// pops up (a quick overshoot scale) with a confetti puff. No three import: it toggles `.visible` and `.scale`
// on objects other modules built (washer.js createWasher, main.js shedSign, venues.js's KITCHEN board), so
// the pure parts are unit-tested (test/stations.test.mjs). props.js drives it once a frame.
import { WASHER_HANDLES, FRIES } from './sim.js';

export const WASHER_AT = { x: (WASHER_HANDLES.L.x + WASHER_HANDLES.R.x) / 2, z: WASHER_HANDLES.L.z };
export const SHED_AT = { x: FRIES.SHED.x, z: FRIES.SHED.z + 2.25 };   // main.js shedSign's group origin
export const REVEAL = { SECS: 0.7, CONFETTI: 70, CONFETTI_LOW: 24 };

// Which stations exist in the world for this snapshot.
export function stationsShown(s) {
  const up = s?.up ?? {};
  return { washer: (up.washer ?? 0) >= 1, shed: (up.shed ?? 0) >= 1 || !!s?.fries?.open };
}

// The pop: 0 -> 1 over REVEAL.SECS with a little overshoot (ease-out-back), never quite 0 (a zero scale
// makes a singular matrix).
export function popScale(t, secs = REVEAL.SECS) {
  const k = Math.max(0, Math.min(1, t / secs));
  if (k >= 1) return 1;
  const c1 = 1.70158, c3 = c1 + 1, m = k - 1;
  return Math.max(0.02, 1 + c3 * m * m * m + c1 * m * m);
}

// Find the station objects by position (props.js does the same for its decorations).
export function findStations(scene) {
  const out = { washer: null, shed: null, tube: null };
  const near = (o, p) => Math.abs(o.position.x - p.x) < 0.01 && Math.abs(o.position.z - p.z) < 0.01;
  for (const o of scene?.children ?? []) {
    if (o.isGroup && near(o, WASHER_AT) && o.children.length > 8) out.washer = o;
    else if (o.isGroup && near(o, SHED_AT)) out.shed = o;
    else if (o.isMesh && o.geometry?.type === 'TubeGeometry' && Math.abs(o.geometry.parameters?.path?.points?.[0]?.x - (WASHER_AT.x + 0.45)) < 0.01) out.tube = o;
  }
  return out;
}

// The client: update(snapshot) toggles visibility only when a station's state changes; tick(dt) runs the pop.
//   refs: { washer, shed, tube } (findStations), scene (for the lazily built KITCHEN board), burst(x, y, z)
//   onToggle(name, shown): props.js hides the station's contact shadow and worn dirt with it.
export function createStations({ scene = null, washer = null, shed = null, tube = null, burst = null, onToggle = null } = {}) {
  const st = { washer: null, shed: null };
  const pops = [];                           // { g, t }
  let kitchen = null, lastVenue = null, primed = false;   // primed: a snapshot with `up` was applied (no pop on joining)
  const findKitchen = () => {
    kitchen = null;
    scene?.traverse?.(o => { if (!kitchen && o.userData?.sign === 'kitchen') kitchen = o; });
    return kitchen;
  };
  const objs = { washer: () => [washer, tube], shed: () => [shed, kitchen] };
  const at = { washer: WASHER_AT, shed: SHED_AT };
  function apply(name, on, animate) {
    for (const o of objs[name]()) if (o) o.visible = on;
    onToggle?.(name, on);
    const g = name === 'washer' ? washer : shed;
    if (!g) return;
    if (on && animate) { g.scale.setScalar(popScale(0)); pops.push({ g, t: 0 }); burst?.(at[name].x, name === 'shed' ? 3.2 : 2.2, at[name].z); }
    else g.scale.setScalar(1);
  }
  return {
    get shown() { return { washer: !!st.washer, shed: !!st.shed }; },
    update(s) {
      if (!s) return;
      const want = stationsShown(s);
      // The KITCHEN board is built with the Club's venue group (venues.js, lazily): look again on a venue change.
      if ((s.venue ?? 0) !== lastVenue) { lastVenue = s.venue ?? 0; if (findKitchen()) kitchen.visible = !!want.shed; }
      for (const name of ['washer', 'shed']) {
        if (st[name] === want[name]) continue;
        apply(name, want[name], primed && st[name] === false);
        st[name] = want[name];
      }
      if (s.up) primed = true;
    },
    tick(dt) {
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]; p.t += dt;
        p.g.scale.setScalar(popScale(p.t));
        if (p.t >= REVEAL.SECS) { p.g.scale.setScalar(1); pops.splice(i, 1); }
      }
    },
  };
}
