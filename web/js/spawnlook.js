// Council round 13 #6 (builder 3): the first look at a new venue is the venue. At venues ≥ 1 a shift's first
// SECS seconds ease the camera pitch from FROM to TO (less ceiling, more field). main.js adds the ease's per-frame
// delta to the pitch, so the player's own look input still counts (control is never taken). Pure.
export const SPAWN_PITCH = {
  FROM: -0.2, TO: -0.28, SECS: 1.5, VENUE_FROM: 1,
  // the eased pitch at `t` seconds since the shift's clock-in, or null (the Muni, or the ease is over)
  pitchAt(venue, t) {
    if ((venue ?? 0) < SPAWN_PITCH.VENUE_FROM || !(t >= 0) || t > SPAWN_PITCH.SECS) return null;
    const k = t / SPAWN_PITCH.SECS, e = k * k * (3 - 2 * k);   // smoothstep
    return SPAWN_PITCH.FROM + (SPAWN_PITCH.TO - SPAWN_PITCH.FROM) * e;
  },
  // the pitch change for the frame from t - dt to t (0 outside the ease). No allocation.
  delta(venue, t, dt) {
    const b = SPAWN_PITCH.pitchAt(venue, Math.min(t, SPAWN_PITCH.SECS));
    if (b == null || t - dt > SPAWN_PITCH.SECS) return 0;
    const a = SPAWN_PITCH.pitchAt(venue, Math.max(0, t - dt));
    return a == null ? 0 : b - a;
  },
};
