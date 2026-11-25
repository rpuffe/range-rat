// The Upper Deck (council round 4, section 3.1 "Toy 2"): the Tiered deck's loungers drink what the cook pours, and when
// the deck hits six drinks one of them falls off the top row. Pure rules (no THREE, no DOM, no sim.js import): the
// server module (server/venues/deck.mjs), the view (views/deck.js) and the kitchen's mug meter (kitchen.js) read this.

export const DECK = {
  MAX: 6,                       // drinks that cause the INCIDENT
  WARN: 4,                      // the mugs go amber: "The deck is getting loud"
  SOBER_SECS: 60,               // every 60 s of shift time the deck sobers up by 1 (council round 6 #6: was 30)
  FOOD: { fries: 1, hotdog: 2 },// a non-burnt hot dog is -2 ("food helps"), fries -1
  TAB: 5,                       // a non-burnt beer pays a bar tab of 5 x BV in cash
  ORDER_SECS: 30,               // council round 6 #6: a lounger orders every 30 s of working shift time...
  ORDER_LOUD_SECS: 20,          // ...every 20 s once the deck is amber (Drinks >= WARN)
  ORDER_OPEN: 30,               // an order stays open 30 s (council round 7 #8: was 20), then expires quietly
  ORDER_TAB: 10,                // a good beer while an order is open pays 10 x BV
  // Rounds (council round 7 #8): from ROUND_FROM Drinks, every ROUND_EVERY-th order is a ROUND. One good pour fills
  // it: +ROUND_DRINKS Drinks and a ROUND_TAB x BV tab. At 4 Drinks a filled round IS a fall (the overserving joke).
  ROUND_EVERY: 3, ROUND_FROM: 3, ROUND_TAB: 25, ROUND_DRINKS: 2,
  FINE: 50,                     // the Liability fine: 50 x BV (council round 7 #8: was 100)
  FINE_CAP: 4,                  // council round 8 #5: the k-th fall of a shift costs FINE x min(2^(k-1), FINE_CAP)
  RESET_TO: 2,                  // drinks after an incident
  FALL_R: 1.5,                  // a Rat this close to the landing spot is knocked flat
  // Council round 10 #3: the drinkers ARE the six upper-bay customers (customers.js UPPER.X; a test keeps them equal).
  SEATS: [-10, -6, -2, 2, 6, 10],
  SEAT_Y: 3, SEAT_Z: 2.6,       // the deck top, and where an upper-bay golfer stands (behind the low rail)
  LAND_Z: 1.0,                  // between the mat line and the walkway
  DROP: 3,                      // metres fallen
  FALL_SECS: 1.4, LIE_SECS: 3, REPLACE_SECS: 20,
  WOOO_SECS: 6,                 // from WARN, a lounger shouts this often
  STAIRS_X: -27.5,              // a new lounger comes up the stairs from here
  FROM_VENUE: 2,
  LOOK_SECS: 3,                 // council round 10 #4: after a fall, 3 s with no ball hits on foot and no customer swing
};

const clampDrinks = n => Math.max(0, Math.min(DECK.MAX, n));

// The deck's state: Drinks 0..6, the next seat (round robin), the sober-up timer, and the loungers' order (council
// round 6 #6): one open order at a time, { seat, left, round? } or null, raised every orderEvery() seconds by the next
// seat; norders counts the orders raised this shift (every ROUND_EVERY-th from ROUND_FROM Drinks is a round).
// Council round 10 #3: the one Drinks count is split across the seats, d.mugs[6], always summing to drinks. `seats` (every
// rule below takes it, default all six) is the list of upper bays in play (customers.js upperOpen).
export const newDeck = () => ({ drinks: 0, seat: 0, soberT: 0, orderT: 0, oseat: 0, order: null, norders: 0, mugs: DECK.SEATS.map(() => 0) });
const ALL = DECK.SEATS.map((_, i) => i);
const seatsOf = seats => (seats?.length ? seats : ALL);
const mugsOf = d => (d.mugs ??= DECK.SEATS.map(() => 0));
// The drunkest seat in play: most mugs; ties go round robin from d.seat (the seat after the last faller).
export function drunkest(d, seats) {
  const s = seatsOf(seats), m = mugsOf(d), from = d.seat ?? 0;
  const ring = [...s.filter(i => i >= from), ...s.filter(i => i < from)];
  let best = ring[0];
  for (const i of ring) if (m[i] > m[best]) best = i;
  return best;
}
// The most mugs in play, of any seat with at least one (for taking a mug off), or -1.
function drunkestWithMugs(d) {
  const m = mugsOf(d); let best = -1;
  for (let i = 0; i < m.length; i++) if (m[i] > 0 && (best < 0 || m[i] > m[best])) best = i;
  return best;
}
// Make the mugs sum to drinks: extra mugs come off the drunkest; missing ones go to the drunkest in play.
function settleMugs(d, seats, skip = -1) {
  const m = mugsOf(d);
  let sum = m.reduce((a, b) => a + b, 0);
  while (sum > d.drinks) { const i = drunkestWithMugs(d); if (i < 0) break; m[i]--; sum--; }
  const pool = seatsOf(seats).filter(i => i !== skip);
  while (sum < d.drinks) { m[drunkest(d, pool.length ? pool : seats)]++; sum++; }
}
export const isRoundOrder = (n, drinks) => (n | 0) > 0 && (n | 0) % DECK.ROUND_EVERY === 0 && drinks >= DECK.ROUND_FROM;

// Seconds between orders: 30, or 20 once the deck is amber ("they're getting loud").
export const orderEvery = drinks => drinks >= DECK.WARN ? DECK.ORDER_LOUD_SECS : DECK.ORDER_SECS;

// Time passes (call only while the shift clock runs). Returns { sobered, order, expired }: sobered when the deck
// sobered up by one, order when a lounger just ordered (d.order is the new order), expired when an order lapsed.
export function stepDeck(d, dt, seats) {
  const out = { sobered: false, order: false, expired: false };
  if (!(dt > 0)) return out;
  d.soberT += dt;
  while (d.soberT >= DECK.SOBER_SECS) {
    d.soberT -= DECK.SOBER_SECS;
    if (d.drinks > 0) { d.drinks = clampDrinks(d.drinks - 1); settleMugs(d, seats); out.sobered = true; }   // off the drunkest
  }
  if (d.order) {
    d.order.left -= dt;
    if (d.order.left <= 0) { d.order = null; out.expired = true; }
  }
  d.orderT = (d.orderT ?? 0) + dt;
  if (!d.order && d.orderT >= orderEvery(d.drinks)) {
    d.orderT = 0;
    const s = seatsOf(seats), k = s.findIndex(i => i >= (d.oseat ?? 0)), seat = s[k < 0 ? 0 : k];   // round robin over the bays in play
    d.oseat = (seat + 1) % DECK.SEATS.length;
    d.norders = (d.norders ?? 0) + 1;
    d.order = { seat, left: DECK.ORDER_OPEN, ...(isRoundOrder(d.norders, d.drinks) ? { round: true } : {}) };
    out.order = true;
  }
  return out;
}

// What one serve does to the Drinks count. A burnt (or unknown) serve changes nothing.
export function serveEffect(item, quality) {
  if (quality !== 'perfect' && quality !== 'good') return 0;
  if (item === 'beer') return 1;
  return -(DECK.FOOD[item] ?? 0);
}
// Does this serve pay the deck's bar tab?
export const paysTab = (item, quality) => item === 'beer' && (quality === 'perfect' || quality === 'good');
// ordered: false (an unordered beer), true or an order (a filled order), or an order with round: true (a round).
export const tabFor = (bv, ordered = false) => (ordered?.round ? DECK.ROUND_TAB : ordered ? DECK.ORDER_TAB : DECK.TAB) * Math.max(0, bv);
// A paying beer fills the open order, if there is one. Returns the filled order (or null) and closes it.
export function fillOrder(d, item, quality) {
  if (!d.order || !paysTab(item, quality)) return null;
  const o = d.order; d.order = null;
  return o;
}
// Council round 8 #5: Liability escalates. The k-th fall of a shift (1-based) costs 50, 100, 200, 200... x BV: the first
// fall stays the cheap joke, the third is a lawsuit.
export const fineMult = k => Math.min(2 ** Math.max(0, (k | 0) - 1), DECK.FINE_CAP);
export const fineFor = (bv, k = 1) => DECK.FINE * fineMult(k) * Math.max(0, bv);
// "2nd", "3rd", "11th": the feed line's fall count.
export const ordinal = k => { const n = k | 0, t = n % 100; return n + (t >= 11 && t <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"); };

// Apply a serve. Returns { delta, incident }; on an incident the caller pays the fine, then calls afterIncident.
// filled: the order this serve filled (fillOrder), if any; a round is ROUND_DRINKS drinks, not 1.
// Council round 10 #3: an ordered beer goes to the seat that ordered, an unordered one to the drunkest ("they always want
// another"); food comes off the drunkest. Returns { delta, incident, seat } (seat: where a beer went, else -1).
export function applyServe(d, item, quality, filled = null, seats) {
  const delta = filled?.round && serveEffect(item, quality) > 0 ? DECK.ROUND_DRINKS : serveEffect(item, quality);
  const before = d.drinks;
  d.drinks = clampDrinks(d.drinks + delta);
  let seat = -1;
  if (d.drinks > before) {
    seat = filled && Number.isInteger(filled.seat) ? filled.seat : drunkest(d, seats);
    mugsOf(d)[seat] += d.drinks - before;
  } else if (d.drinks < before) settleMugs(d, seats);
  return { delta, incident: d.drinks >= DECK.MAX, seat };
}
// An incident happened: the drunkest seat in play fell (ties round robin from the last faller), and their mugs leave
// with them. Drinks resets to RESET_TO as before; the mugs are settled to match. Returns the faller's seat index.
export function afterIncident(d, seats) {
  const seat = drunkest(d, seats);
  d.seat = (seat + 1) % DECK.SEATS.length;
  mugsOf(d)[seat] = 0;
  d.drinks = DECK.RESET_TO;
  settleMugs(d, seats, seat);
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
