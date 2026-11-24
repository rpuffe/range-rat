// The Upper Deck (council round 4, section 3.1 "Toy 2"): the Tiered deck's loungers drink what the cook pours, and when
// the deck hits six drinks one of them falls off the top row. Pure rules (no THREE, no DOM, no sim.js import): the
// server module (server/venues/deck.mjs), the view (views/deck.js) and the kitchen's mug meter (kitchen.js) read this.

export const DECK = {
  MAX: 6,                       // drinks that cause the INCIDENT
  WARN: 4,                      // the mugs go amber: "The deck is getting loud"
  SOBER_SECS: 30,               // every 30 s of shift time the deck sobers up by 1
  FOOD: { fries: 1, hotdog: 2 },// a non-burnt hot dog is -2 ("food helps"), fries -1
  TAB: 5,                       // a non-burnt beer pays a bar tab of 5 x BV in cash
  FINE: 100,                    // the Liability fine: 100 x BV
  RESET_TO: 2,                  // drinks after an incident
  FALL_R: 1.5,                  // a Rat this close to the landing spot is knocked flat
  SEATS: [-14, -6, 6, 14],      // lounger x at the rail
  SEAT_Y: 3, SEAT_Z: 2.4,       // the deck top, and the rail
  LAND_Z: 1.0,                  // between the mat line and the walkway
  DROP: 3,                      // metres fallen
  FALL_SECS: 1.4, LIE_SECS: 3, REPLACE_SECS: 20,
  WOOO_SECS: 6,                 // from WARN, a lounger shouts this often
  STAIRS_X: -27.5,              // a new lounger comes up the stairs from here
  FROM_VENUE: 2,
};

const clampDrinks = n => Math.max(0, Math.min(DECK.MAX, n));

// The deck's state: Drinks 0..6, the next seat (round robin), and the sober-up timer.
export const newDeck = () => ({ drinks: 0, seat: 0, soberT: 0 });

// Time passes (call only while the shift clock runs). Returns true when the deck sobered up by one.
export function stepDeck(d, dt) {
  if (!(dt > 0)) return false;
  d.soberT += dt;
  let sobered = false;
  while (d.soberT >= DECK.SOBER_SECS) {
    d.soberT -= DECK.SOBER_SECS;
    if (d.drinks > 0) { d.drinks = clampDrinks(d.drinks - 1); sobered = true; }
  }
  return sobered;
}

// What one serve does to the Drinks count. A burnt (or unknown) serve changes nothing.
export function serveEffect(item, quality) {
  if (quality !== 'perfect' && quality !== 'good') return 0;
  if (item === 'beer') return 1;
  return -(DECK.FOOD[item] ?? 0);
}
// Does this serve pay the deck's bar tab?
export const paysTab = (item, quality) => item === 'beer' && (quality === 'perfect' || quality === 'good');
export const tabFor = bv => DECK.TAB * Math.max(0, bv);
export const fineFor = bv => DECK.FINE * Math.max(0, bv);

// Apply a serve. Returns { delta, incident }; on an incident the caller pays the fine, then calls afterIncident.
export function applyServe(d, item, quality) {
  const delta = serveEffect(item, quality);
  d.drinks = clampDrinks(d.drinks + delta);
  return { delta, incident: d.drinks >= DECK.MAX };
}
// An incident happened: the lounger at the next seat (round robin) fell. Returns that seat's index.
export function afterIncident(d) {
  const seat = d.seat % DECK.SEATS.length;
  d.seat = (seat + 1) % DECK.SEATS.length;
  d.drinks = DECK.RESET_TO;
  return seat;
}

export const landingSpot = seat => ({ x: DECK.SEATS[((seat % DECK.SEATS.length) + DECK.SEATS.length) % DECK.SEATS.length], z: DECK.LAND_Z });
export const hitByFall = (p, spot) => Math.hypot(p.x - spot.x, p.z - spot.z) < DECK.FALL_R;

// The mug meter and the lounger mood: 'ok' (0-3), 'loud' (4, amber), 'cut' (5+, red).
export const mugTone = drinks => drinks >= DECK.MAX - 1 ? 'cut' : drinks >= DECK.WARN ? 'loud' : 'ok';
export const MUG_CAPTION = { ok: '', loud: 'The deck is getting loud', cut: 'CUT THEM OFF' };

// The fall, for u in 0..1 over FALL_SECS: from the rail (x, 3, 2.4) to the ground at (x, 0, 1.0). A half spin.
export function fallPose(seat, u) {
  u = Math.max(0, Math.min(1, u));
  const x = DECK.SEATS[seat % DECK.SEATS.length];
  const g = u < 0.25 ? 0 : ((u - 0.25) / 0.75) ** 2;                 // first a lean over the rail, then gravity
  const zu = u < 0.25 ? 0.2 * (u / 0.25) : 0.2 + 0.8 * ((u - 0.25) / 0.75);
  return { x, y: DECK.SEAT_Y - DECK.DROP * g, z: DECK.SEAT_Z + (DECK.LAND_Z - DECK.SEAT_Z) * zu, spin: -Math.PI * g };
}

// A replacement lounger's walk: up the stairs (x -25..-20 rising to y 3), then along the deck to the seat.
export function climbPath(seat) {
  const sx = DECK.SEATS[seat % DECK.SEATS.length];
  return [[DECK.STAIRS_X, 0, 4], [-25, 0, 4], [-20, DECK.SEAT_Y, 4], [sx, DECK.SEAT_Y, DECK.SEAT_Z]];
}
export const pathLength = path => path.slice(1).reduce((s, b, i) => s + Math.hypot(b[0] - path[i][0], b[1] - path[i][1], b[2] - path[i][2]), 0);
export function pointAlong(path, dist) {
  let d = Math.max(0, dist);
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1], b = path[i], len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (d <= len || i === path.length - 1) {
      const u = len ? Math.min(1, d / len) : 1;
      return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, z: a[2] + (b[2] - a[2]) * u, dx: b[0] - a[0], dz: b[2] - a[2], done: i === path.length - 1 && d >= len };
    }
    d -= len;
  }
  const e = path[path.length - 1];
  return { x: e[0], y: e[1], z: e[2], dx: 0, dz: 0, done: true };
}

// "DAYS WITHOUT AN INCIDENT: N", counted from the last incident's day. Red and 0 on an incident day.
export function bannerFor(day, last, today) {
  if (today) return { text: 'DAYS WITHOUT AN INCIDENT: 0', bg: '#9c1f1f', fg: '#ffe9e6' };
  return { text: `DAYS WITHOUT AN INCIDENT: ${Math.max(0, (day | 0) - (last | 0))}` };
}

export const money = n => '$' + Math.round(n).toLocaleString('en-US');
