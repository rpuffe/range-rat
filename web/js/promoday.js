// Promotion Day (round 11, expert review #2): the last good day is an event with stakes. When a venue card is one
// good day ("Hit the daily target N×") short and every other goal is done, the next morning is Promotion Day:
//   - the memo says "Promotion Day. Regional is watching." and the Board's goal strip reads PROMOTION DAY;
//   - Gary rides along all shift (his cart loops behind the fence) and inspects as on any Gary day (the Seal can land);
//   - the target's tick sits EXTRA (10 points) higher, the first attempt only;
//   - pass at the bell and the crew signs on the spot (confetti, a PA); fail and it comes again tomorrow.
// No Today modifier that day (today.js reads isPromotionDay). Pure: no THREE, no DOM. server/crew.mjs runs it.

export const PROMO_DAY = Object.freeze({
  EXTRA: 0.10,       // of the bar: the first attempt's tick is 10 points higher
  CAP: 0.9,          // ...but never past 90% of the bar
  MEMO: 'Promotion Day. Regional is watching.',
  TOMORROW: 'Tomorrow: Promotion Day. Regional is watching.',
  AGAIN: 'Tomorrow: Promotion Day again. Regular target.',
  LABEL: 'PROMOTION DAY',
  NEXT: 'NEXT: HIT THE TARGET AT THE BELL',
  // Gary's ride-along: out past the fence, along the back of the range and back, a clipboard lift behind the Board.
  SPEED: 3,
  ROUTE: Object.freeze([{ x: 58, z: 13 }, { x: 27, z: 12.5, wave: true }, { x: -30, z: 12.5 }, { x: 50, z: 12.5 }]),
  WAVE: 2,
});

// Is today Promotion Day for this crew? (builder "today" reads this: no Today modifier on Promotion Day.)
// crew.promoDay is the day number the server dealt Promotion Day for (null/undefined: none).
export const isPromotionDay = crew => !!crew && !crew.endless && Number.isInteger(crew.promoDay) && crew.promoDay === crew.day;

// Is the card one good day short with every other goal done? rows: goals.js rowsOf (the live fee included).
export function promoDue(rows) {
  if (!rows?.length) return false;
  const r = rows.find(x => x.kind === 'reviews');
  if (!r || r.done || r.need - r.have !== 1) return false;
  return rows.every(x => x === r || x.done);
}

// Today's quota on Promotion Day: q (Upkeep over Rate) moved EXTRA of the bar (ceiling − 1) higher on the first
// attempt, capped at CAP of the bar and never lower than it was. A later attempt keeps the regular target.
export function promoQ(q, ceiling, attempt = 0) {
  if (q == null || attempt > 0) return q;
  const bar = Math.max(1e-9, (ceiling ?? 1.5) - 1);
  return Math.max(q, Math.min(q + PROMO_DAY.EXTRA * bar, PROMO_DAY.CAP * bar));
}

// The Board's goal strip on Promotion Day: the label is the chip, the next line the one thing left.
export const promoStrip = s => (s ? { ...s, label: PROMO_DAY.LABEL, next: PROMO_DAY.NEXT, promo: true } : s);

// ---- the ride-along (a loop, not the once-ever drive-by) -------------------------------------------------------
export const newRide = (from = null) => {
  const p = PROMO_DAY.ROUTE[0];
  return { leg: 1, x: from?.x ?? p.x, z: from?.z ?? p.z, yaw: Math.PI / 2, wave: 0 };
};
// One step round the loop. Returns 'wave' on the frame he lifts his clipboard, else null. Never ends.
export function stepRide(r, dt) {
  if (r.wave > 0) { r.wave = Math.max(0, r.wave - dt); return null; }
  const R = PROMO_DAY.ROUTE, to = R[r.leg % R.length];
  const dx = to.x - r.x, dz = to.z - r.z, d = Math.hypot(dx, dz), step = PROMO_DAY.SPEED * dt;
  if (d > step) { r.x += dx / d * step; r.z += dz / d * step; r.yaw = Math.atan2(-dx, -dz); return null; }
  r.x = to.x; r.z = to.z; r.leg = (r.leg + 1) % R.length || 1;   // leg 0 is the gate: the loop skips it after the first lap
  if (to.wave) { r.wave = PROMO_DAY.WAVE; return 'wave'; }
  return null;
}
