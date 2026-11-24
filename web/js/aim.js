// The landing-ring predictor for the Target Greens (council round 6, #4). Pure: no THREE, no DOM.
// A leaf: it imports sim.js and tiered.js, and nothing imports it but the client and the tests (no cycle).
//
//   predictRest({ bay, yaw, pitch, power }, world) -> { x, z, steps } | null
//     Where a PURE strike (no curve, full tempo) with this aim comes to rest, by the very physics the server runs
//     (swingLaunch -> advanceBall). null for no power, or a ball that drifts off down the creek / never settles.
//   createAimer({ predict, now, hz }) -> { update(input) -> rest|null }: the per-frame gate. It recomputes at most
//     hz (AIM.HZ; the low tier passes AIM.LOW_HZ) times a second, and only when power moved by more than AIM.DPOW or the aim by more than AIM.DANG.
//   flagNormal(bowl) -> unit {x, y, z}: the way a bowl's flag faces (the midpoint of the two crew bays).
import { SIM, BAYS, swingLaunch, advanceBall } from './sim.js';
import * as SIMNS from './sim.js';   // QUOTA_KPI (builder A, #2) read softly: 0.5 until it lands
import { MAP } from './map.js';
import { inBowl, TARGET, CUP_FULL } from './tiered.js';

export const AIM = {
  HZ: 10,                      // recomputes a second, at most
  LOW_HZ: 5,                   // ...on the low tier (Xbox Edge): a worst-case predict is ~1,500 steps
  DPOW: 0.01,                  // power change that forces a recompute
  DANG: 0.5 * Math.PI / 180,   // aim change (yaw or pitch, rad) that forces a recompute
  MAX_STEPS: 2400,             // 20 s of fixed steps: a 1.15-power drive lands and stops in ~1,000
  DEFAULT_POWER: 0.7,          // before your first swing
  RING_R: 1.2, RING_W: 0.15,   // m, the ground ring
};

export function predictRest(launch, world = { venue: 2 }) {
  const power = launch?.power;
  if (!launch?.bay || !(power > 0) || !Number.isFinite(launch.yaw) || !Number.isFinite(launch.pitch)) return null;
  const b = { ...swingLaunch(launch.bay, launch.yaw, launch.pitch, power), curve: 0, rest: false, acc: 0 };
  // Step one fixed step at a time: exactly the server's sequence, whatever its tick length.
  for (let i = 1; i <= AIM.MAX_STEPS; i++) {
    const r = advanceBall(b, SIM.STEP, world);
    if (r === 'drift') return null;
    if (r === true) return { x: b.x, z: b.z, steps: i };
  }
  return null;
}

// Which bowl the ring sits in (the crew lip counts: that's where a TARGET scores), or null.
export const ringBowl = (rest, bowls = MAP.BOWLS) => (rest ? inBowl(rest.x, rest.z, bowls, TARGET.LIP) : null);

// The bay you stand at, or null.
export const bayAt = (x, z) => BAYS.find(b => Math.hypot(x - b.x, z - b.z) < 1.4) ?? null;

export function createAimer({ predict = predictRest, now = () => Date.now(), hz = AIM.HZ } = {}) {
  let last = null, at = -Infinity, rest = null;
  return {
    get rest() { return rest; },
    update(input) {
      if (!input) { last = null; rest = null; return null; }
      const t = now();
      if (last && input.bay === last.bay && Math.abs(input.power - last.power) <= AIM.DPOW
        && Math.abs(input.yaw - last.yaw) <= AIM.DANG && Math.abs(input.pitch - last.pitch) <= AIM.DANG) return rest;
      if (last && t - at < 1000 / hz) return rest;
      last = { ...input }; at = t;
      rest = predict(input, input.world);
      return rest;
    },
  };
}

// The flag faces the midpoint of the two crew bays, flat (y = 0), so both bays read it.
export function flagNormal(bowl) {
  const mx = (BAYS[0].x + BAYS[1].x) / 2, mz = (BAYS[0].z + BAYS[1].z) / 2;
  const dx = mx - bowl.x, dz = mz - bowl.z, l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, y: 0, z: dz / l };
}

// A cup's count goes red at its share of the pass line: the gauge passes at QUOTA_KPI (0.5), i.e. CUP_FULL x 0.5 balls
// over all the cups, so one cup is "full" at that / bowls (5 at CUP_FULL 30). Read from tiered.js, never hard-coded.
export const KPI_PASS = SIMNS.QUOTA_KPI ?? 0.5;
export const cupWarn = (bowls = MAP.BOWLS.length, full = CUP_FULL) => Math.max(1, Math.round(full * (1 - KPI_PASS) / Math.max(1, bowls)));
