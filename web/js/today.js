// Corporate's "Today" (round 11, expert review #3) and the endless contracts (#10b). Pure: no THREE, no DOM. The
// server (crew.mjs) deals one modifier each morning from Muni day 5 and applies it through the hooks below; the client
// shows the memo line, the Board chip and the report line.
//
// Each modifier reuses a system that already exists and is tuned to stay inside ±15% of a plain day's income:
//   windy     customer shots curve (the crew swing's hook/slice push): light balls drift a lot, heavy ones a little
//   rain      double mud on the mats and the stand, and glow balls start early
//   league    every bay swings faster (25% more balls); from Tiered the deck's orders also come twice as often
//   junior    beginner shots from every other bay (launch's `beginner`): short shots, lots of balls near the mats
//   celeb     one bay's balls pay ×3, the celebrity aims at Rats, and swings half as often
//   shortage  the bucket basket holds 6
//   night     glow balls all day (worth a little more than a range ball today), the floodlights on, the sky dark
// None on a Gary day, on Promotion Day (promoday.js isPromotionDay), on a venue's reveal morning, or at the Orbital.
// Deterministic: the pick is a hash of the crew's key and the day, so a reload deals the same modifier.

export const TODAY = {
  FROM_DAY: 5,           // from Muni day 5 (the global day)
  WIND: 0.32,            // windy: the curve a light ball gets (a crew swing's hook is ±1)
  WIND_HEAVY: 0.12,      // ...and a heavy one (lead, square, gold)
  RAIN_MUD: 2,           // rain: the mats scuff and the stand dusts this much faster
  RAIN_GLOW: 0.45,       // rain: glow balls from this share of the shift before the bell (Last Call's own: T-2:30 of 7:00)
  LEAGUE_SWING: 0.85,    // league: a lower bay's gap between swings × this (~18% more balls)
  LEAGUE_ORDERS: 2,      // league from Tiered: deck orders come this much faster
  JUNIOR_GAP: 1.3,       // junior: a clinic bay swings this much slower (the kids take their time)
  CELEB_PAY: 3,          // the celebrity's balls pay ×3...
  CELEB_GAP: 2,          // ...and they take their time (signing autographs): their bay's gap between swings × this
  BASKET: 6,             // ball shortage: the basket holds this many
  NIGHT_W: 0.55,         // night: a glow ball (×2) pays this share of itself today, so ×1.1 a range ball
  NIGHT_SKY: 0.985,      // night: the sky's time of day all shift (sky.js lightAt: 1 is the bell)
};
export const HEAVY = new Set(['lead', 'square', 'gold']);

export const MODS = {
  windy: { name: 'Windy', chip: 'WINDY', memo: 'Windy today. Light balls drift.' },
  rain: { name: 'Rain', chip: 'RAIN', memo: 'Rain today. Double mud, early glow.' },
  league: { name: 'League Night', chip: 'LEAGUE NIGHT', memo: 'League Night. Every bay swings faster.', memoDeck: 'League Night. Fast swings, double deck orders.' },
  junior: { name: 'Junior Clinic', chip: 'JUNIOR CLINIC', memo: 'Junior Clinic. Short shots, balls near the mats.' },
  celeb: { name: 'Celebrity', chip: 'CELEB', memo: 'A celebrity at Bay {bay}. Pays ×3. Duck.' },
  shortage: { name: 'Ball Shortage', chip: 'BALL SHORTAGE', memo: 'Ball Shortage. The basket holds six.' },
  night: { name: 'Night Range', chip: 'NIGHT RANGE', memo: 'Night Range. Glow balls all day.' },
};
export const MOD_IDS = Object.keys(MODS);
const DECK_VENUE = 2;   // the Upper Deck opens at Tiered

// The modifiers that fit a venue (in a fixed order: the pick indexes into it).
export function todayPool(venue = 0, endless = false) {
  return MOD_IDS.filter(id => {
    if (id === 'junior') return endless || venue <= 2;   // the Stadium and the County don't host clinics
    return true;
  });
}

// A small, stable integer hash (FNV-1a over the parts' text).
export function hash32(...parts) {
  let h = 0x811c9dc5;
  for (const ch of parts.join('|')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return h >>> 0;
}

// Make a dealt modifier: { id, bay? (celeb: the mat index), wind? (windy: ±1) }.
export function dealMod(id, key, day, nMats = 10) {
  if (!MODS[id]) return null;
  const t = { id };
  if (id === 'celeb') t.bay = hash32(key, day, 'bay') % Math.max(1, Math.min(10, nMats | 0));
  if (id === 'windy') t.wind = hash32(key, day, 'wind') & 1 ? 1 : -1;
  return t;
}

// Today's modifier, or null. ctx: { key, day, venue, endless, gary, promo, reveal, nMats }.
export function todayFor({ key = 0, day = 1, venue = 0, endless = false, gary = false, promo = false, reveal = false, nMats = 10, boss = false } = {}) {
  if (endless || venue >= 5 || day < TODAY.FROM_DAY || gary || promo || reveal || boss) return null;   // council round 11 #1: no Today on a boss day
  const pool = todayPool(venue);
  // Never the same two days running: walk the last month's deals (bounded, so it stays cheap and deterministic).
  let id = null;
  for (let d = Math.max(TODAY.FROM_DAY, day - 30); d <= day; d++) {
    const prev = id;
    id = pool[hash32(key, d, 'today') % pool.length];
    if (id === prev) id = pool[(pool.indexOf(id) + 1) % pool.length];
  }
  return dealMod(id, key, day, nMats);
}

// ---- the words ------------------------------------------------------------------------------------------------
export const todayMemo = (t, venue = 0) => {
  const m = t && MODS[t.id];
  if (!m) return null;
  const line = t.id === 'league' && venue >= DECK_VENUE ? m.memoDeck : m.memo;
  return line.replace('{bay}', String((t.bay ?? 0) + 1));
};
export const todayChip = t => (t && MODS[t.id] ? (t.id === 'celeb' ? `CELEB · BAY ${(t.bay ?? 0) + 1}` : MODS[t.id].chip) : null);
export const todayName = t => (t && MODS[t.id] ? (t.id === 'celeb' ? `Celebrity at Bay ${(t.bay ?? 0) + 1}` : MODS[t.id].name) : null);

// The shift report's line: how the modifier went. n: the server's counters for today
// { curved, glow, celeb, celebKnocks, buckets, short, extra }.
export function todayReport(t, n = {}, venue = 0) {
  if (!t || !MODS[t.id]) return null;
  const k = v => Math.max(0, Math.round(v || 0)).toLocaleString('en-US');
  switch (t.id) {
    case 'windy': return `Windy: ${k(n.curved)} balls blew off line.`;
    case 'rain': return `Rain: ${k(n.glow)} early glow balls in the wet.`;
    case 'league': return venue >= DECK_VENUE ? `League Night: ${k(n.orders)} deck orders.` : `League Night: ${k(n.extra)} balls off the league.`;
    case 'junior': return `Junior Clinic: ${k(n.short)} short shots.`;
    case 'celeb': return `${todayName(t)}: ${k(n.celeb)} balls at ×3, ${k(n.celebKnocks)} Rats flattened.`;
    case 'shortage': return `Ball Shortage: ${k(n.buckets)} buckets filled, six at a time.`;
    case 'night': return `Night Range: ${k(n.glow)} glow balls under the lights.`;
    default: return null;
  }
}

// ---- the effects (the server calls these) --------------------------------------------------------------------
// A customer ball's kind: night turns range balls to glow all day; rain from RAIN_GLOW of the shift before the bell.
// Returns the kind (call it after pickKind, so the seeded draws never change).
export function todayKind(t, kind, shiftT = 0, secs = 1) {
  if (!t || kind !== 'range') return kind;
  if (t.id === 'night') return 'glow';
  if (t.id === 'rain' && shiftT >= secs * (1 - TODAY.RAIN_GLOW)) return 'glow';
  return kind;
}
// A customer shot after the venue's own launchMod: windy curves it, the celebrity's bay aims at a Rat and pays ×3,
// a night glow pays NIGHT_W of itself (not Last Call's own glows). mat: { i, x }; rats: [{ x, z }] (on foot, on the
// field). Mutates and returns.
export function todayShot(t, shot, mat, rats = [], { lastCall = false } = {}) {
  if (!t || !shot) return shot;
  if (t.id === 'windy') shot.curve = (t.wind ?? 1) * (HEAVY.has(shot.kind) ? TODAY.WIND_HEAVY : TODAY.WIND);
  if (t.id === 'night' && shot.kind === 'glow' && !lastCall) shot.mul = TODAY.NIGHT_W;
  if (t.id === 'celeb' && mat && mat.i === t.bay) {
    shot.mul = TODAY.CELEB_PAY; shot.celeb = true;
    let best = null, bd = Infinity;
    for (const r of rats) {
      const dz = (shot.z ?? -0.4) - r.z;   // downrange is -z
      if (dz < 6) continue;                 // only Rats out on the field
      const d = Math.hypot(r.x - mat.x, dz);
      if (d < bd) { bd = d; best = r; }
    }
    if (best) {
      const h = Math.hypot(shot.vx, shot.vz), a = Math.atan2(best.x - mat.x, (shot.z ?? -0.4) - best.z);
      shot.vx = Math.sin(a) * h; shot.vz = -Math.cos(a) * h;
    }
  }
  return shot;
}
// What a picked ball weighs: its kind's weight times today's multiplier (the celebrity's ×3, a night glow's NIGHT_W).
export const ballMul = b => (Number.isFinite(b?.mul) && b.mul > 0 ? b.mul : 1);
export const mudMul = t => (t?.id === 'rain' ? TODAY.RAIN_MUD : 1);
export const basketCap = (t, cap) => (t?.id === 'shortage' ? Math.min(cap, TODAY.BASKET) : cap);
// A lower bay's swing gap factor: League Night's bays swing faster, the celebrity's bay slower. matI: the mat index.
export const swingMul = (t, matI = -1) => (t?.id === 'league' ? TODAY.LEAGUE_SWING : t?.id === 'celeb' && matI === t.bay ? TODAY.CELEB_GAP
  : t?.id === 'junior' && matI % 2 === 0 ? TODAY.JUNIOR_GAP : 1);
export const orderBoost = (t, venue = 0) => (t?.id === 'league' && venue >= DECK_VENUE ? TODAY.LEAGUE_ORDERS : 1);
// Junior Clinic: the even bays (half the line) hit beginner shots. matI: the mat index.
export const juniorDay = (t, matI = 0) => t?.id === 'junior' && matI % 2 === 0;
// The client: the sky's time of day (night holds it at dusk) and the floodlights.
export const skyK = (t, k) => (t?.id === 'night' ? Math.max(k, TODAY.NIGHT_SKY) : k);
export const floodsOn = (t, lastCall) => !!lastCall || t?.id === 'night';

// ---- endless contracts (#10b) ---------------------------------------------------------------------------------
// Each endless morning offers three contracts: a modifier and a goal, one of each star count (1, 2, 3). The crew
// picks one at the overnight report (any Rat; the last pick stands; nobody picking takes the first). A contract met
// at the bell adds its stars to the crew's lifetime count; every 10 stars unlocks a cosmetic.
export const CONTRACT = { OFFERS: 3, PER_UNLOCK: 10 };
// Goals by stars: cash against yesterday (× f), knockdowns at most n, balls left at the bell at most n.
const GOALS_BY_STARS = {
  1: [{ k: 'cash', f: 0.85 }, { k: 'upright', n: 6 }, { k: 'spotless', n: 40 }],
  2: [{ k: 'cash', f: 1.0 }, { k: 'upright', n: 2 }, { k: 'spotless', n: 12 }],
  3: [{ k: 'cash', f: 1.15 }, { k: 'upright', n: 0 }, { k: 'spotless', n: 0 }],
};
// ctx: { key, day, yesterday (cash), nMats }. Returns [{ mod, goal: { k, n }, stars }] × 3, stars 1, 2, 3.
export function contractsFor({ key = 0, day = 1, yesterday = 0, nMats = 10 } = {}) {
  const pool = todayPool(5, true), out = [], used = new Set();
  for (let s = 1; s <= CONTRACT.OFFERS; s++) {
    let i = hash32(key, day, 'c', s) % pool.length;
    while (used.has(pool[i])) i = (i + 1) % pool.length;
    used.add(pool[i]);
    const opts = GOALS_BY_STARS[s].filter(g => g.k !== 'cash' || yesterday > 0);
    const g = opts[hash32(key, day, 'g', s) % opts.length];
    const goal = g.k === 'cash' ? { k: 'cash', n: Math.max(1, Math.round(yesterday * g.f)) } : { k: g.k, n: g.n };
    out.push({ mod: dealMod(pool[i], key, day, nMats), goal, stars: s });
  }
  return out;
}
export function goalText(goal) {
  if (!goal) return '';
  if (goal.k === 'cash') return 'Bank $' + Math.round(goal.n).toLocaleString('en-US');
  if (goal.k === 'upright') return goal.n === 0 ? 'Nobody knocked flat' : `At most ${goal.n} knockdowns`;
  if (goal.k === 'spotless') return goal.n === 0 ? 'Spotless at the bell' : `At most ${goal.n} balls left out`;
  return '';
}
export const starText = n => '★'.repeat(Math.max(0, n | 0)) + '☆'.repeat(Math.max(0, 3 - (n | 0)));
// stats: { cash, knockdowns, left } at the bell.
export function contractMet(c, stats = {}) {
  const g = c?.goal;
  if (!g) return false;
  if (g.k === 'cash') return (stats.cash ?? 0) >= g.n;
  if (g.k === 'upright') return (stats.knockdowns ?? Infinity) <= g.n;
  if (g.k === 'spotless') return (stats.left ?? Infinity) <= g.n;
  return false;
}
// A saved/wired contract, or null.
export function cleanContract(c) {
  if (!c || !MODS[c.mod?.id] || !c.goal || !['cash', 'upright', 'spotless'].includes(c.goal.k)) return null;
  const stars = Math.max(1, Math.min(3, Math.floor(Number(c.stars) || 1)));
  const mod = { id: c.mod.id };
  if (c.mod.id === 'celeb') mod.bay = Math.max(0, Math.min(9, Math.floor(Number(c.mod.bay) || 0)));
  if (c.mod.id === 'windy') mod.wind = Number(c.mod.wind) < 0 ? -1 : 1;
  return { mod, goal: { k: c.goal.k, n: Math.max(0, Number(c.goal.n) || 0) }, stars };
}

// ---- cosmetics: cheap recolours, one every 10 stars -----------------------------------------------------------
export const COSMETICS = [
  { id: 'hat-teal', part: 'hat', name: 'Teal cap', hex: 0x2bb3a3, stars: 10 },
  { id: 'cart-gold', part: 'cart', name: 'Gold cart paint', hex: 0xd4a017, stars: 20 },
  { id: 'vest-pink', part: 'vest', name: 'Pink vest', hex: 0xff6fae, stars: 30 },
  { id: 'hat-black', part: 'hat', name: 'Black cap', hex: 0x22252b, stars: 40 },
  { id: 'cart-red', part: 'cart', name: 'Fire-engine cart paint', hex: 0xc8281e, stars: 50 },
  { id: 'vest-navy', part: 'vest', name: 'Navy vest', hex: 0x1f3a6b, stars: 60 },
  { id: 'hat-gold', part: 'hat', name: 'Gold cap', hex: 0xe8b04a, stars: 70 },
  { id: 'cart-midnight', part: 'cart', name: 'Midnight cart paint', hex: 0x1b1f3a, stars: 80 },
  { id: 'vest-lime', part: 'vest', name: 'Lime vest', hex: 0x9ad83a, stars: 90 },
  { id: 'hat-white', part: 'hat', name: 'Tour-white cap', hex: 0xf4f1e8, stars: 100 },
];
export const COSMETIC_BY_ID = Object.fromEntries(COSMETICS.map(c => [c.id, c]));
export const unlockedLooks = stars => COSMETICS.filter(c => (stars | 0) >= c.stars);
export const nextLook = stars => COSMETICS.find(c => (stars | 0) < c.stars) ?? null;
// The cosmetic newly unlocked going from `was` to `now` stars (the last one, if several), or null.
export const newlyUnlocked = (was, now) => COSMETICS.filter(c => (was | 0) < c.stars && (now | 0) >= c.stars).at(-1) ?? null;
// May this crew wear it? (null clears the part.)
export const canWear = (id, part, stars) => id == null || (COSMETIC_BY_ID[id]?.part === part && (stars | 0) >= COSMETIC_BY_ID[id].stars);
// Looks by Rat name, cleaned: { name: { hat?, vest? } }.
export function cleanLooks(l) {
  const out = {};
  for (const [name, v] of Object.entries(l && typeof l === 'object' ? l : {})) {
    if (typeof name !== 'string' || name.length > 16 || !v || typeof v !== 'object') continue;
    const o = {};
    if (COSMETIC_BY_ID[v.hat]?.part === 'hat') o.hat = v.hat;
    if (COSMETIC_BY_ID[v.vest]?.part === 'vest') o.vest = v.vest;
    if (o.hat || o.vest) out[name] = o;
  }
  return out;
}
// The next option for a part, cycling none → each unlocked → none (the overnight locker's one button per part).
export function cycleLook(cur, part, stars) {
  const opts = [null, ...unlockedLooks(stars).filter(c => c.part === part).map(c => c.id)];
  const i = opts.indexOf(cur ?? null);
  return opts[(i + 1) % opts.length];
}
export const lookHex = id => COSMETIC_BY_ID[id]?.hex ?? null;
