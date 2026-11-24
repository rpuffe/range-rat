// A crew: up to 6 players sharing one range. The server owns everything that
// players could fight over (balls, pockets, the cart, cash, the shift clock);
// a player's own position (and the cart's, while they drive it) is theirs to
// report, clamped to a plausible speed.
//
// Design records: design/council-round1.md (story, Ball Value, the first five
// features) and design/council-round2.md (promotion, the PA, the ball washer,
// grime, Ready Up, the ledger, records, the venues, the Last Bucket).

import crypto from 'node:crypto';
import { SIM, MATS, activeMats, mulberry32, swingGap, launch, spill, advanceBall, ballHitsPlayer, atStand, clampToField,
  SHOP_BY_ID, nextPrice, perks, HELPER_NAMES, CART, BAYS, BAY_REACH, swingLaunch, ballHitsCart,
  gearPerks, HELPER_POCKET, WASH, ballValue, SPRINT, FIXTURES, FIXTURE_BY_ID, KIND_W, BALLS_OUTSTANDING, payFor,
  upkeepCeiling, quotaQ, LAST_CALL, GARY, POND, inPond, onDock, pondClarity, leadLaunch, FRIES, atShed, pickKind,
  VENUE_RULES, PROMO_STAMPS, ONE_YEAR, venueQuotaF, shiftSecsFor, WASHER, WASHER_HANDLES, atHandle, gearGrimeFactor } from '../web/js/sim.js';
import { keepInField, cartBlocked, driftEvent, stepDrift, wadeFactor, cartSpeedAt } from '../web/js/map.js';
import { VenueHooks, MODULES } from './venues/index.mjs';
import { newMat, openShift as openMats, stepMat, matReady, shoot, matWire } from '../web/js/customers.js';
import { mowerDue, newMower, stepMower, mowerSnap } from '../web/js/mowe.js';
import { menuFor, yieldFor, garyEats } from '../web/js/menu.js';
import { diveTiers, MAX_DIVE_LEVEL, PUMP, pumpGain, airStep, newLine, canSend, sendBag, haulReady, takeLine, nightCrew,
  newTube, tubeFeed, tubeArrivals, hasTube, hasPondPump, atTube, pondPumpStep, sinksDeep, deepEndSpot, bedAt,
  cleanLostFound, rollTreasure, treasureSpot, finderFee, TREASURE_BY_ID } from '../web/js/dive.js';

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: codes get read aloud
export const CODE_LEN = 4;
const COLORS = ['#e8604c', '#4c9be8', '#f2c94c', '#6fcf7c', '#b07ce8', '#3fc1c9'];
const GRACE_MS = 60_000;          // an offline player keeps their spot this long (page reloads)
const DRIVER_GRACE_MS = 5_000;    // an offline driver gives up the cart this fast
const NAME_MAX = 16;
const READY_SECS = 20;            // Ready Up: the next shift starts this long after the first Rat is ready
const REVEAL_SECS = 6;            // a venue reveal holds the clock this long
const PA_CAP = 3, PA_GAP_MS = 20_000;
const HUDDLE_R = 8;

// What a ping on the cage pays out, and how often.
export const PING_PRIZES = [['jackpot', 0.4], ['boost', 0.3], ['mult', 0.3]];
// PA lines that ignore the per-shift cap and the gap (venue reveals and the ending).
const PA_BIG = new Set(['club', 'tiered', 'stadium', 'county', 'orbital', 'one', 'last', 'endless']);
const DEBUT_PA = { glow: 'glow', square: 'square', gold: 'gold', lead: 'lead', splitter: 'splitter', bouncy: 'bouncy' };

export const newCode = () => Array.from(crypto.randomBytes(CODE_LEN), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
export const validCode = c => typeof c === 'string' && c.length === CODE_LEN && [...c].every(ch => CODE_CHARS.includes(ch));

export function cleanName(s) {
  s = String(s ?? '').replace(/[\p{C}]/gu, '').trim();
  return [...s].slice(0, NAME_MAX).join('').trim();
}

const freshStats = () => ({ picked: 0, deposited: 0, cash: 0, knockdowns: 0, helped: 0, carted: 0, swings: 0, pings: 0, runOver: 0, washed: 0,
  scrubbed: 0, unwashed: 0, lostPremium: 0 });
const freshShift = () => ({ banked: 0, cash: 0, knockdowns: 0, dived: 0, cooked: 0, scrubbed: 0, hosed: 0, pings: 0, mowed: 0 });
const cents = v => Math.round(v * 100) / 100;
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

// Only known items, only whole tiers inside the catalog.
function cleanUpgrades(up) {
  const out = {};
  for (const [id, item] of Object.entries(SHOP_BY_ID)) {
    const n = Math.floor(Number(up?.[id]) || 0);
    if (n > 0 && !item.personal) out[id] = Math.min(n, item.tiers.length - 1);
  }
  return out;
}

// Personal gear by Range Rat name, so it follows you back to the crew.
function cleanGear(g) {
  const out = {}, max = SHOP_BY_ID.gear.tiers.length - 1;
  for (const [name, lvl] of Object.entries(g ?? {})) {
    const n = Math.floor(Number(lvl) || 0);
    if (n > 0 && typeof name === 'string' && name.length <= 16) out[name] = Math.min(n, max);
  }
  return out;
}

// Dive gear by name (Scuba v2): same idea as cleanGear, levels 1..MAX_DIVE_LEVEL.
function cleanDive(g) {
  const out = {};
  for (const [name, lvl] of Object.entries(g && typeof g === 'object' ? g : {})) {
    const n = Math.floor(Number(lvl) || 0);
    if (n > 0 && typeof name === 'string' && name.length <= 16) out[name] = Math.min(n, MAX_DIVE_LEVEL);
  }
  return out;
}

export class Crew {
  constructor(code, save = null, { shiftSecs = null, now = Date.now, seed, modules = MODULES } = {}) {
    this.code = code;
    this.shiftOverride = shiftSecs;      // the env override wins over the day lengths
    this.shiftSecs = shiftSecs ?? SIM.SHIFT_SECS;
    this.now = now;
    this.rng = mulberry32(seed ?? crypto.randomBytes(4).readUInt32LE());
    this.players = new Map();
    this.balls = new Map();
    this.nextBall = 1;
    this.day = save?.day ?? 1;
    this.cash = save?.cash ?? 0;
    this.totals = { ...freshStats(), stamps: 0, ...(save?.totals ?? {}) };
    this.up = cleanUpgrades(save?.up);
    this.gearByName = cleanGear(save?.gear);
    this.diveByName = cleanDive(save?.diveByName);         // save v3
    this.lostFound = cleanLostFound(save?.lostFound);      // save v3: the treasure ids in the glass case
    this.treasure = null;            // the one lying in the Deep End now: { id, x, z }
    this.treasureSeed = (seed ?? 1) | 0;
    this.line = newLine();           // the bag line: sent by divers, hauled up from the dock
    this.tube = newTube(); this.tubeClock = 0;
    this.commendations = int(save?.commendations, 0, 10);
    this.venue = int(save?.venue, 0, 5);
    this.venueDay = int(save?.venueDay, 0, 10_000);
    this.endless = !!save?.endless;
    this.debuts = new Set(Array.isArray(save?.debuts) ? save.debuts.filter(k => typeof k === 'string').slice(0, 20) : []);
    this.voiced = new Set(Array.isArray(save?.voiced) ? save.voiced.filter(k => typeof k === 'string').slice(0, 40) : []);
    this.stamps = int(save?.stamps, 0, 100);
    this.records = { cash: Number(save?.records?.cash) || 0, banked: int(save?.records?.banked, 0, 1e9), day: int(save?.records?.day, 0, 1e6) };
    // Balls Outstanding is a stored count (write-offs live here). Old saves derive it.
    this.outstanding = Number.isFinite(save?.outstanding) ? Math.max(0, Math.floor(save.outstanding)) : BALLS_OUTSTANDING - (this.totals.deposited ?? 0);
    const pr = Math.floor(Number(save?.pendingReveal));
    this.pendingReveal = pr >= 1 && pr <= 5 ? pr : 0;
    this.quota = null;               // { q } once a shift sets it; the target follows the live Rate
    this.fries = Math.max(0, Math.min(FRIES.MAX, Number(save?.fries) || 0));   // baskets in stock
    this.swingsToEat = FRIES.EAT_EVERY; this.autoFryT = 0;
    this.fixtures = {};              // fixture id -> mud 0..1 (Curb Appeal)
    this.hopper = { n: 0, credit: 0, frac: 0 };            // the ball washer: dirty balls and the premium they'll pay
    this.washBatch = new Map();      // who washed how much, flushed as events every 0.5 s
    this.washFlushT = 0;
    this.signed = new Set(); this.ready = new Set(); this.readyAt = 0;
    this.revealT = 0;
    this.lastBucket = null;          // the ending: { phase: 'falling' | 'down' | 'carried', t, id, by }
    this.paShift = 0; this.paAt = 0;
    this.perks = perks(this.up);
    this.helpers = [];
    this.cart = null;
    this.mult = 1;                   // Hustle (Hit the Cart), for the rest of the shift
    this.applyUpgrades();
    this.phase = 'lobby';            // lobby -> shift -> report -> shift ...
    this.shiftT = 0;
    this.stats = freshStats();
    this.report = null;
    this.mats = MATS.map((m, i) => ({ ...newMat(m.i ?? i), ...m, next: 1 + this.rng() * 5 }));
    this.custT = 0; this.nextCust = 0;     // customers walk on their own clock: it never pauses
    this.events = [];
    this.dirty = false;
    this.lastActive = now();
    this.morningMud();
    const sunk = this.pondOpen() ? int(save?.pondSunk, 0, POND.MAX_SUNK) : 0;
    for (let i = 0; i < sunk; i++) this.sinkNew('range');
    // The venue seam (council round 4): venue modules (server/venues/), each with its own save key.
    this.mods = new VenueHooks(this, modules, save?.mods);
  }

  // ---- membership ----------------------------------------------------------

  join(name) {
    if (this.players.size >= SIM.MAX_PLAYERS) return null;
    const used = new Set([...this.players.values()].map(p => p.color));
    const p = {
      id: crypto.randomBytes(6).toString('hex'),
      token: crypto.randomBytes(16).toString('hex'),
      name: cleanName(name) || `Rat ${this.players.size + 1}`,
      color: COLORS.find(c => !used.has(c)) ?? COLORS[0],
      x: SIM.STAND.x - 3 - this.players.size * 1.2, z: SIM.STAND.z - 4, yaw: Math.PI / 2,
      pocket: 0, pocketW: 0, down: 0, online: 0, seenAt: this.now(), movedAt: this.now(), swungAt: 0,
      gear: 0, wand: false, washAt: 0, diving: false, air: POND.AIR, bag: 0, bagW: 0, bagKinds: [], pumping: false,
      dive: 0, treasure: null, pumpTurns: 0, pumpHeld: false, pumpAt: 0, haulHeld: 0, haulAt: 0,
      grime: 0, hoseAcc: 0, rinseAcc: 0, crankAt: 0, one: false, shift: freshShift(),
    };
    if (Object.hasOwn(this.diveByName, p.name)) p.dive = this.diveByName[p.name];
    p.air = diveTiers(p.dive).air;
    if (Object.hasOwn(this.gearByName, p.name)) p.gear = this.gearByName[p.name];
    else if (this.day > 1) {         // the New Hire Kit (council round 2, §4.5)
      p.gear = this.gearByName[p.name] = this.venue >= 1 ? 2 : 1;
      this.events.push({ t: 'kit', id: p.id, level: p.gear });
    }
    this.players.set(p.id, p);
    this.events.push({ t: 'join', id: p.id, name: p.name });
    return p;
  }

  auth(id, token) {
    const p = this.players.get(id);
    if (!p || typeof token !== 'string' || token.length !== p.token.length) return null;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(p.token)) ? p : null;
  }

  // A stream opened or closed for this player (they may have two tabs).
  connect(p) { p.online++; p.seenAt = this.now(); this.lastActive = this.now(); }
  disconnect(p) { p.online = Math.max(0, p.online - 1); p.seenAt = this.now(); }
  onlineCount() { let n = 0; for (const p of this.players.values()) if (p.online > 0) n++; return n; }
  online() { return [...this.players.values()].filter(p => p.online > 0); }
  world() { return { venue: this.venue }; }   // what the map's rules depend on (Dimple Creek: dry or running)
  driving(p) { return !!this.cart && this.cart.driver === p.id; }
  working() { return this.phase === 'shift' && !this.paused(); }   // the shift clock is running
  pondOpen() { return this.venue >= POND.FROM_VENUE; }

  // ---- the Corporate PA (council round 2, §4.3) --------------------------------
  // The server picks the moment; every client speaks the same line. Rare by rule.
  pa(id, { once = false, chance = 1, big: bigOpt = false } = {}) {
    const now = this.now(), big = PA_BIG.has(id) || bigOpt;   // a venue module's once-ever line passes big: true
    if (once && this.voiced.has(id)) return false;
    if (!big && (this.paShift >= PA_CAP || now - this.paAt < PA_GAP_MS)) return false;
    if (chance < 1 && this.voiced.has(id) && this.rng() > chance) return false;
    this.voiced.add(id); this.dirty = true;
    if (!big) { this.paShift++; this.paAt = now; }
    this.events.push({ t: 'pa', id });
    return true;
  }

  // ---- money -------------------------------------------------------------------

  curb() {
    const v = Object.values(this.fixtures);
    return v.length ? 1 - v.reduce((a, b) => a + b, 0) / v.length : 1;
  }
  valueNow() {
    return ballValue({ perks: this.perks, mult: this.mult, cart: this.cart, curb: this.curb(), commendations: this.commendations,
      venue: this.venue,
      pond: this.pondOpen() ? pondClarity(this.sunkCount()) : null,
      fries: this.perks.shed ? this.fries / FRIES.MAX : null,
      kpi: this.mods.kpi() });
  }
  ballPrice() { return this.valueNow().value; }
  title() { return this.endless ? 'Owner' : VENUE_RULES[this.venue].title; }
  ceiling() { return upkeepCeiling({ pond: this.pondOpen() ? 1 : null, fries: this.perks.shed ? 1 : null, kpi: this.mods.kpi() == null ? null : 1 }); }

  // n balls (count) worth w (summed weights). The carrier's gear factor: the cart
  // pays for its cleanliness, a Rat for theirs (grime), helpers never.
  // With a ball washer, the muddy price is paid now and the washer's share waits
  // in the hopper as credit, paid out as balls are washed (council round 2, §4.4).
  bank(n, by, kind = null, w = n, gearOv = null) {
    if (n <= 0) return;
    const v = this.valueNow();
    const who = kind == null ? this.players.get(by) : null;
    const gear = gearOv ?? (kind === 'cart' ? v.cartGear : who ? gearGrimeFactor(who.grime) : 1);
    const full = payFor(w, v, gear);
    const muddy = this.perks.washer ? cents(full / this.perks.price) : full;
    const credit = cents(full - muddy);
    if (credit > 0) { this.hopper.n += n; this.hopper.credit = cents(this.hopper.credit + credit); }
    this.cash = cents(this.cash + muddy); this.stats.deposited += n; this.stats.cash = cents(this.stats.cash + muddy); this.dirty = true;
    if (kind === 'helper') this.stats.helped += n;
    if (who) { who.shift.banked += n; who.shift.cash = cents(who.shift.cash + muddy); }
    this.countDown(n);
    this.events.push({ t: 'cash', by, n, cash: muddy, credit, kind, per: cents(muddy / Math.max(1, n)), clean: who ? who.grime === 0 : undefined });
  }

  // Cash in (a bar tab) or out (a fine) that isn't banked balls: never takes the crew below $0. Returns the change.
  // The caller emits its own event. `by` is a player id (their ledger gets the income) or null.
  payCash(amount, by = null) {
    if (!Number.isFinite(amount) || amount === 0) return 0;
    const d = cents(Math.max(-this.cash, amount));
    this.cash = cents(this.cash + d); this.stats.cash = cents(this.stats.cash + d); this.dirty = true;
    const who = by != null ? this.players.get(by) : null;
    if (who && d > 0) who.shift.cash = cents(who.shift.cash + d);
    return d;
  }

  // Balls Outstanding: down with every banked ball. At the Orbital Range it
  // stops at 1, and reaching 1 starts the Last Bucket. In endless mode it's live.
  countDown(n) {
    if (this.venue === 5 && !this.endless) {
      this.outstanding = Math.max(1, this.outstanding - n);
      if (this.outstanding === 1 && !this.lastBucket) this.beginLastBucket();
    } else this.outstanding = Math.max(0, this.outstanding - n);
  }

  // Washing x balls pays the waiting credit for them (cranked, or the electric washer).
  washBalls(x, by) {
    const h = this.hopper;
    x = Math.min(x, h.n);
    if (x <= 0) return 0;
    const pay = cents(h.credit * x / h.n);
    h.n -= x; h.credit = cents(h.credit - pay);
    if (h.n === 0) h.credit = 0;
    this.cash = cents(this.cash + pay); this.stats.cash = cents(this.stats.cash + pay); this.stats.scrubbed += x; this.dirty = true;
    const p = this.players.get(by);
    if (p) { p.shift.scrubbed += x; p.shift.cash = cents(p.shift.cash + pay); }
    const b = this.washBatch.get(by) ?? { n: 0, cash: 0 };
    b.n += x; b.cash = cents(b.cash + pay); this.washBatch.set(by, b);
    return x;
  }

  // Overnight the mud comes back: the sign, the stand, and some of the mats.
  morningMud() {
    for (const fx of FIXTURES) this.fixtures[fx.id] = 0;
    this.fixtures.sign = 0.9; this.fixtures.stand = 0.5;
    if (this.perks?.covered) return;     // covered bays: the members never see a muddy mat
    const mats = FIXTURES.filter(x => x.id.startsWith('mat'));
    for (let i = 0; i < 5; i++) this.fixtures[mats[Math.floor(this.rng() * mats.length)].id] = 0.95;   // over the 0.9 refusal line: a customer waits for the hose
  }

  // ---- inputs ----------------------------------------------------------------

  input(p, msg) {
    const now = this.now();
    p.seenAt = now; this.lastActive = now;
    const denied = [];
    if (this.driving(p)) this.driveTo(p, msg.cart, now);
    else if (Number.isFinite(msg.x) && Number.isFinite(msg.z) && p.down <= 0) {
      // Trust the reported position up to a generous walking speed.
      const dt = Math.min(1, Math.max(0.05, (now - p.movedAt) / 1000));
      const max = this.perks.walk * SPRINT.SPEED * 1.3 * dt + 0.5;   // room for a sprint
      let dx = msg.x - p.x, dz = msg.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > max) { dx *= max / d; dz *= max / d; }
      p.x += dx; p.z += dz;
      if (!this.mods.first('clamp', p)) clampToField(p, this.world());
      p.movedAt = now;
    }
    if (Number.isFinite(msg.yaw) && !this.driving(p)) p.yaw = msg.yaw;
    if (p.wand && Math.hypot(p.x - WASH.STATION.x, p.z - WASH.STATION.z) > WASH.HOSE) p.wand = false;   // out of hose
    for (const a of Array.isArray(msg.a) ? msg.a.slice(0, 8) : []) {
      if (a?.t === 'pickup') { if (!(a.cart ? this.cartPickup(p, a.ball) : a.pond ? this.pondPickup(p, a.ball) : this.pickup(p, a.ball))) denied.push(a.ball); }
      else if (a?.t === 'pump') this.pumpInput(p, a);
      else if (a?.t === 'send') this.sendBagUp(p);
      else if (a?.t === 'haul') this.haulInput(p, a);
      else if (a?.t === 'feed') this.feedTube(p);
      else if (a?.t === 'treasure') this.treasurePickup(p);
      else if (a?.t === 'serve') this.serve(p, a);
      else if (a?.t === 'deposit') this.deposit(p);
      else if (a?.t === 'start') this.readyUp(p);
      else if (a?.t === 'buy') this.buy(p, a.id);
      else if (a?.t === 'board') this.board(p);
      else if (a?.t === 'leave') this.leaveCart(p);
      else if (a?.t === 'swing') this.swing(p, a);
      else if (a?.t === 'wand') this.toggleWand(p);
      else if (a?.t === 'wash') this.wash(p, a.secs, a.target);
      else if (a?.t === 'crank') this.crank(p, a.side, a.turns);
      else if (a?.t === 'sign') this.sign(p, !!a.on);
      else if (a?.t === 'cctv') { if (this.venue >= 1) this.pa('cctv', { once: true }); }
      else if (a?.t === 'mark') this.mark(p, a);
      else if (a && typeof a.t === 'string') this.mods.first('input', p, a);   // a venue module's own action
    }
    return { denied };
  }

  pickup(p, id) {
    const b = this.balls.get(id);
    const g = gearPerks(p.gear);
    if (!b || p.down > 0 || this.driving(p) || this.phase === 'lobby') return false;
    if (b.y > 0.4 || b.sunk || b.drifting) return false;   // in the air, at the bottom of the pond, or floating down the creek
    if (Math.hypot(b.x - p.x, b.z - p.z) > g.reach + 1) return false;  // slack for a rolling ball
    if (b.kind === 'one') {                                // Ball No. 1 rides in your hands, outside the pocket
      if (p.one || p.diving) return false;
      this.balls.delete(id); p.one = true;
      if (this.lastBucket) { this.lastBucket.phase = 'carried'; this.lastBucket.by = p.id; }
      this.events.push({ t: 'gone', id, by: p.id }, { t: 'lastbucket', phase: 'carried', by: p.id });
      return true;
    }
    if (p.pocket >= g.pocket) return false;
    this.balls.delete(id);
    p.pocket++; p.pocketW = (p.pocketW ?? 0) + (KIND_W[b.kind] ?? 1); this.stats.picked++; this.dirty = true;
    this.events.push({ t: 'gone', id, by: p.id });
    if (b.kind === 'splitter') for (const s of spill(b.x, b.z, 2, this.rng)) this.addBall({ ...s, y: 0.3, vy: 2.5, kind: 'range' });
    return true;   // grime comes only from knockdowns (council round 3)
  }

  deposit(p) {
    if (p.down > 0 || !atStand(p)) return;
    if (p.treasure) this.bankTreasure(p);
    if (p.one) return this.depositOne(p);
    if (p.pocket <= 0) return;
    const n = p.pocket, w = p.pocketW ?? n;
    p.pocket = 0; p.pocketW = 0;
    this.bank(n, p.id, null, w);
  }

  // The shop is open any time (Tab / D-pad up): the range keeps going while you browse.
  buy(p, id) {
    const item = Object.hasOwn(SHOP_BY_ID, id) ? SHOP_BY_ID[id] : null;
    if (!item) return false;
    const price = nextPrice(id, this.up, this.onlineCount(), id === 'dive' ? p.dive : p.gear, this.venue);
    if (price === null || price > this.cash) return false;
    this.cash = cents(this.cash - price);
    let level;
    if (id === 'dive') { level = ++p.dive; this.diveByName[p.name] = p.dive; }
    else if (item.personal) { level = ++p.gear; this.gearByName[p.name] = p.gear; }
    else { level = this.up[id] = (this.up[id] ?? 0) + 1; this.applyUpgrades(); }
    this.dirty = true;
    this.events.push({ t: 'buy', by: p.id, id, level, price, personal: !!item.personal });
    if (id === 'cart' && level === 1) this.pa('cart', { once: true });
    return true;
  }

  applyUpgrades() {
    this.perks = perks(this.up);
    this.hireHelpers();
    if (this.perks.cart && !this.cart) {
      this.cart = { ...CART.PARK, v: 0, driver: null, load: 0, loadW: 0, boostT: 0, movedAt: this.now(), mud: 0 };
    }
  }

  // ---- promotion (council round 2, §4.1) ------------------------------------------
  promoInfo() {
    const next = VENUE_RULES[this.venue + 1];
    if (!next || this.endless) return null;
    const fee = Math.round(next.fee * (1 + 0.4 * (Math.max(1, this.onlineCount()) - 1)));
    return { next: next.name, fee, stamps: this.stamps, need: PROMO_STAMPS,
      ready: this.stamps >= PROMO_STAMPS && this.cash >= fee, signed: [...this.signed] };
  }

  // The franchise agreement: every online Rat signs at the report, then it executes.
  sign(p, on) {
    const info = this.promoInfo();
    if (!info || this.phase !== 'report' || !info.ready) return false;
    if (on) this.signed.add(p.id); else this.signed.delete(p.id);
    const online = this.online();
    for (const id of [...this.signed]) if (!online.some(o => o.id === id)) this.signed.delete(id);
    this.events.push({ t: 'sign', by: p.id, on, n: this.signed.size, of: online.length });
    if (online.length && online.every(o => this.signed.has(o.id))) this.promote();
    return true;
  }

  promote() {
    const info = this.promoInfo();
    if (!info?.ready) return false;
    const to = this.venue + 1, rules = VENUE_RULES[to];
    this.cash = cents(this.cash - info.fee);
    this.totals.stamps = (this.totals.stamps ?? 0) + this.stamps;
    this.stamps = 0;
    this.venue = to; this.venueDay = 0;
    const before = this.outstanding;
    this.outstanding = rules.writeOff === 'rest' ? ONE_YEAR : Math.max(ONE_YEAR + 1, this.outstanding - rules.writeOff);
    this.pendingReveal = to;
    if (to === 1 && !this.up.shed) { this.up.shed = 1; this.applyUpgrades(); }   // the members expect fries
    this.signed.clear();
    this.dirty = true;
    this.events.push({ t: 'promoted', venue: to, fee: info.fee, writeOff: before - this.outstanding, title: this.title() });
    return true;
  }

  // ---- Ready Up (council round 2, §5.1) -----------------------------------------
  // From the lobby the range opens at once; at the report the next shift starts
  // when every online Rat is ready, or 20 s after the first one is.
  readyUp(p) {
    if (this.phase === 'lobby') return this.startShift();
    if (this.phase !== 'report') return;
    this.ready.add(p.id);
    if (!this.readyAt) this.readyAt = this.now();
    const online = this.online();
    this.events.push({ t: 'ready', n: this.ready.size, of: online.length, t0: READY_SECS });
    if (online.every(o => this.ready.has(o.id))) this.startShift();
  }

  // ---- the cart --------------------------------------------------------------

  board(p) {
    const c = this.cart;
    if (!c || c.driver || p.down > 0 || p.one || Math.hypot(c.x - p.x, c.z - p.z) > CART.BOARD_REACH) return false;
    c.driver = p.id; c.movedAt = this.now(); c.v = 0;
    p.x = c.x; p.z = c.z;
    this.events.push({ t: 'board', by: p.id });
    return true;
  }

  leaveCart(p) {
    const c = this.cart;
    if (!c || c.driver !== p.id) return false;
    c.driver = null; c.v = 0;
    // Step out on the driver's side.
    p.x = c.x - Math.cos(c.yaw) * 1.4; p.z = c.z + Math.sin(c.yaw) * 1.4;
    if (!this.mods.first('clamp', p)) clampToField(p, this.world());
    p.yaw = c.yaw; p.movedAt = this.now();
    this.events.push({ t: 'unboard', by: p.id });
    return true;
  }

  // The driver reports where the cart is; the server keeps it plausible.
  driveTo(p, pose, now) {
    const c = this.cart;
    if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return;
    const dt = Math.min(1, Math.max(0.05, (now - c.movedAt) / 1000));
    const vmax = this.perks.cartSpeed * (c.boostT > 0 ? CART.BOOST : 1) * cartSpeedAt(c.x, c.z, this.world());   // x1.3 on the Ping Track
    const max = vmax * 1.3 * dt + 0.6;
    let dx = pose.x - c.x, dz = pose.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d > max) { dx *= max / d; dz *= max / d; }
    // Sweep the move in half-metre steps: the creek, the pond, the rock and the tractor stop the cart
    // (only the Cart Bridge crosses), and a laggy jump can't hop the creek.
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.5)), w = this.world();
    for (let i = 0; i < n; i++) {
      const nx = c.x + dx / n, nz = c.z + dz / n;
      if (cartBlocked(nx, nz, w)) break;
      c.x = nx; c.z = nz;
    }
    keepInField(c, 6);
    if (Number.isFinite(pose.yaw)) c.yaw = pose.yaw;
    c.v = Math.min(d, max) / dt;
    c.mud = Math.min(1, c.mud + Math.min(d, max) * WASH.MUD_PER_M);   // the field is wet
    c.movedAt = now;
    p.x = c.x; p.z = c.z; p.yaw = c.yaw;
    // Anyone on foot in the way goes flying.
    if (c.v > CART.RUN_OVER_SPEED) {
      for (const o of [...this.players.values(), ...this.helpers]) {
        if (o === p || o.down > 0 || this.driving(o)) continue;
        if (Math.hypot(o.x - c.x, o.z - c.z) < 1.3) { this.knockDown(o, 'cart'); this.stats.runOver++; }
      }
    }
  }

  // A splitter through the cart, the jackpot, a helper or the pond loads as three.
  loadOf(b) { return b.kind === 'splitter' ? 3 : 1; }

  cartPickup(p, id) {
    const c = this.cart, b = this.balls.get(id);
    if (!b || !c || c.driver !== p.id || c.load >= this.perks.cartCap || this.phase === 'lobby') return false;
    if (b.y > 0.4 || b.kind === 'one' || b.drifting || b.sunk) return false;
    const rx = c.x - Math.sin(c.yaw) * CART.REEL_AHEAD, rz = c.z - Math.cos(c.yaw) * CART.REEL_AHEAD;
    if (Math.hypot(b.x - rx, b.z - rz) > this.perks.cartReel / 2 + 1.5) return false;   // slack for lag
    this.balls.delete(id);
    const k = this.loadOf(b);
    c.load += k; c.loadW = (c.loadW ?? 0) + (KIND_W[b.kind] ?? 1) * (k === 3 ? 3 : 1); this.stats.picked += k; this.stats.carted += k; this.dirty = true;
    this.events.push({ t: 'gone', id, by: p.id });
    return true;
  }

  // ---- power washing ---------------------------------------------------------
  // Grab the wand at the station, then spray the cart, a fixture or a crewmate.

  toggleWand(p) {
    if (p.wand) { p.wand = false; return true; }
    if (this.driving(p) || p.down > 0 || Math.hypot(p.x - WASH.STATION.x, p.z - WASH.STATION.z) > WASH.GRAB) return false;
    p.wand = true; p.washAt = this.now();
    return true;
  }

  // target: 'cart' (default), a fixture id (the sign, the stand, a mat), or 'p:<id>' (Hose a Friend).
  wash(p, secs, target = 'cart') {
    const now = this.now();
    if (!p.wand || p.down > 0 || !Number.isFinite(secs) || secs <= 0) return false;
    const reach = WASH.RANGE * (this.perks.turbo ? 9 / 7 : 1) + 1.5;
    const s = Math.min(secs, 0.5, (now - p.washAt) / 1000 * 1.15);
    if (target === 'self') {   // look down and hose your own boots: a layer every 1.5 s
      p.washAt = now;
      if (s <= 0 || p.grime <= 0) return false;
      p.rinseAcc += s;
      if (p.rinseAcc >= 1.5) { p.rinseAcc = 0; this.addGrime(p, -1); }
      return true;
    }
    if (typeof target === 'string' && target.startsWith('p:')) {
      const o = this.players.get(target.slice(2));
      if (!o || o === p || Math.hypot(o.x - p.x, o.z - p.z) > reach) return false;
      p.washAt = now;
      if (s <= 0) return false;
      o.hoseAcc += s;
      const d = Math.max(0.01, Math.hypot(o.x - p.x, o.z - p.z));
      if (o.hoseAcc >= 0.5) {
        o.hoseAcc = 0;
        if (o.grime > 0) { this.addGrime(o, -1); p.shift.hosed++; }
        this.events.push({ t: 'hosed', id: o.id, by: p.id, dx: (o.x - p.x) / d * 0.5, dz: (o.z - p.z) / d * 0.5 });
      }
      return true;
    }
    const isCart = target === 'cart' || target == null;
    const where = isCart ? this.cart : Object.hasOwn(FIXTURE_BY_ID, target) ? FIXTURE_BY_ID[target] : null;
    if (!where || Math.hypot(where.x - p.x, where.z - p.z) > reach + (where.r ?? 0)) return false;
    p.washAt = now;
    if (s <= 0) return false;
    const rate = WASH.RATE * (isCart ? 1 : 1.6) * (this.perks.turbo ? 2 : 1);   // fixtures are smaller than a cart
    const before = isCart ? this.cart.mud : this.fixtures[target];
    const after = Math.max(0, before - rate * s);
    const done = before > 0.05 && after <= 0.05;
    if (isCart) this.cart.mud = done ? 0 : after; else this.fixtures[target] = done ? 0 : after;
    this.stats.washed = Math.round((this.stats.washed + s) * 10) / 10;
    if (done) this.events.push({ t: 'spotless', by: p.id, target: isCart ? 'cart' : target });
    this.dirty = true;
    return true;
  }


  addGrime(p, d) {
    const v = Math.max(0, Math.min(3, p.grime + d));
    if (v === p.grime) return;
    p.grime = v; this.dirty = true;
    this.events.push({ t: 'grime', id: p.id, v });
  }

  // ---- the ball washer (council round 2, §4.4) ---------------------------------------
  crank(p, side, turns) {
    const now = this.now();
    if ((side !== 'L' && side !== 'R') || !this.perks.washer || p.down > 0 || !atHandle(p, side) || !Number.isFinite(turns) || turns <= 0) return false;
    const dt = Math.min(1, (now - (p.crankAt || now - 250)) / 1000);
    p.crankAt = now;
    const t = Math.min(turns, WASHER.CRANK_MAX * dt * 1.15);   // a little jitter room, never free turns at dt = 0
    p.crankFrac = (p.crankFrac ?? 0) + t;
    const whole = Math.floor(p.crankFrac);
    p.crankFrac -= whole;
    if (whole > 0) this.washBalls(whole, p.id);
    this.cranking = this.cranking ?? {}; this.cranking[side] = { id: p.id, at: now, rate: t / Math.max(dt, 0.05) };
    return true;
  }

  // ---- Hit the Cart ----------------------------------------------------------
  // From a crew bay you hit the balls you're carrying. One that rings the cage
  // while someone's driving pays the whole crew.

  swing(p, a) {
    const now = this.now();
    if (this.phase !== 'shift' || p.down > 0 || this.driving(p) || p.pocket <= 0) return false;
    if (now - p.swungAt < SIM.SWING_COOLDOWN * 1000) return false;
    const bay = BAYS.find(b => Math.hypot(p.x - b.x, p.z - b.z) < BAY_REACH);
    if (!bay || ![a.yaw, a.pitch, a.power].every(Number.isFinite)) return false;
    p.pocket--; p.pocketW = Math.max(0, (p.pocketW ?? 1) - 1); p.swungAt = now;
    this.stats.swings++;
    const curve = Number.isFinite(a.curve) ? Math.max(-1, Math.min(1, a.curve)) : 0;
    const b = this.addBall({ ...swingLaunch(bay, a.yaw, a.pitch, a.power), curve });
    if (b) b.by = p.id;
    return true;
  }

  ping(b) {
    const c = this.cart;
    b.pinged = true;
    b.vx *= -0.3; b.vz *= -0.3; b.vy = Math.abs(b.vy) * 0.4;    // it rattles off the cage
    if (!b.by || !c.driver || this.phase !== 'shift') {          // a customer's ball, or nobody driving: just noise
      this.events.push({ t: 'ping', by: b.by ?? null });
      return;
    }
    this.stats.pings++; this.dirty = true;
    const shooter = this.players.get(b.by);
    if (shooter) shooter.shift.pings++;
    let r = this.rng(), prize = PING_PRIZES[PING_PRIZES.length - 1][0];
    for (const [name, w] of PING_PRIZES) { if (r < w) { prize = name; break; } r -= w; }
    let n = 0;
    if (prize === 'jackpot') {
      for (const o of [...this.balls.values()]) {
        if (c.load >= this.perks.cartCap) break;
        if (!o.rest || o.sunk || o.kind === 'one' || Math.hypot(o.x - c.x, o.z - c.z) > CART.JACKPOT_R) continue;
        const k = this.loadOf(o);
        this.balls.delete(o.id); c.load += k; c.loadW = (c.loadW ?? 0) + (KIND_W[o.kind] ?? 1) * (k === 3 ? 3 : 1); n += k;
        this.stats.picked += k; this.stats.carted += k;
        this.events.push({ t: 'gone', id: o.id, by: c.driver });
      }
      if (!this.jackpotSaid) { this.jackpotSaid = this.pa('jackpot', { chance: 0.25 }); }
    } else if (prize === 'boost') c.boostT = CART.BOOST_SECS;
    else this.mult = Math.min(CART.MAX_MULT, this.mult + CART.MULT_STEP);
    this.events.push({ t: 'ping', by: b.by, prize, n, mult: this.mult });
    this.mods.call('ping', b, { prize, n, cart: c });
  }

  // Corporate CCTV (council round 2, §4.6): a flag the whole crew sees for 10 s.
  mark(p, a) {
    if (this.venue < 1 || !Number.isFinite(a.x) || !Number.isFinite(a.z)) return false;
    const now = this.now();
    if (now - (p.markAt ?? 0) < 2000) return false;
    p.markAt = now;
    this.events.push({ t: 'mark', by: p.id, x: +a.x.toFixed(1), z: +a.z.toFixed(1), color: p.color });
    return true;
  }

  // ---- hired help ----------------------------------------------------------
  // Helpers walk to the nearest ball nobody else is after, fill up (a beat-up
  // tube), walk them to the bucket stand, and bank them. They get hit too.

  hireHelpers() {
    while (this.helpers.length < this.perks.helpers) {
      const i = this.helpers.length;
      this.helpers.push({ id: `h${i}`, name: HELPER_NAMES[i] ?? `Helper ${i + 1}`, helper: true,
        x: SIM.STAND.x + 2 + i * 1.2, z: SIM.STAND.z + 1.5, yaw: Math.PI, pocket: 0, down: 0, target: null });
    }
  }

  stepHelpers(dt) {
    const claimed = new Set(this.helpers.map(h => h.target).filter(Boolean));
    const cap = HELPER_POCKET;
    for (const h of this.helpers) {
      if (h.down > 0) continue;
      const working = this.phase === 'shift' && !this.paused();
      let goal = null;
      if (h.pocket >= cap || (h.pocket > 0 && !working)) goal = SIM.STAND;
      else if (working) {
        let b = h.target && this.balls.get(h.target);
        if (!b || !b.rest) {
          claimed.delete(h.target);
          h.target = null; b = null;
          let bd = Infinity;
          for (const c of this.balls.values()) {
            if (!c.rest || c.sunk || c.kind === 'one' || claimed.has(c.id)) continue;
            const d = Math.hypot(c.x - h.x, c.z - h.z);
            if (d < bd) { bd = d; b = c; }
          }
          if (b) { h.target = b.id; claimed.add(b.id); }
        }
        if (b) goal = b;
        else if (h.pocket > 0) goal = SIM.STAND;
      }
      if (!goal) continue;
      const dx = goal.x - h.x, dz = goal.z - h.z, d = Math.hypot(dx, dz);
      if (goal === SIM.STAND && atStand(h)) {
        this.bank(h.pocket, h.id, 'helper', h.pocketW ?? h.pocket);
        h.pocket = 0; h.pocketW = 0;
        continue;
      }
      if (goal !== SIM.STAND && d < 0.5) {
        this.balls.delete(goal.id);
        const k = this.loadOf(goal);
        h.pocket += k; h.pocketW = (h.pocketW ?? 0) + (KIND_W[goal.kind] ?? 1) * (k === 3 ? 3 : 1); h.target = null; this.stats.picked += k; this.dirty = true;
        this.events.push({ t: 'gone', id: goal.id, by: h.id });
        continue;
      }
      const step = Math.min(d, SIM.HELPER_WALK * wadeFactor(h.x, h.z, this.world()) * dt);
      h.x += dx / d * step; h.z += dz / d * step;
      h.yaw = Math.atan2(-dx, -dz);
    }
  }

  startShift() {
    if (this.phase === 'shift') return;
    if (this.phase === 'report') this.day++;
    this.venueDay++;
    // The night crew clears the field: every morning starts clean (the pond keeps what sank).
    for (const [id, b] of this.balls) if (!b.sunk) { this.balls.delete(id); this.events.push({ t: 'gone', id }); }
    this.shiftSecs = this.shiftOverride ?? (this.endless || this.venue > 0 ? SIM.SHIFT_SECS : shiftSecsFor(this.day));
    this.phase = 'shift'; this.shiftT = 0; this.stats = freshStats(); this.report = null; this.mult = 1; this.lastCallRung = false;
    this.gary = null; this.mower = null; this.paShift = 0; this.jackpotSaid = false;
    this.ready.clear(); this.readyAt = 0; this.signed.clear();
    this.hopper = { n: 0, credit: 0, frac: 0 };
    // The locker room, then clock in at the yard: everyone starts each shift together.
    let slot = 0;
    for (const p of this.players.values()) {
      p.shift = freshShift(); p.grime = 0;
      if (this.cart?.driver === p.id) this.cart.driver = null;
      p.diving = false; p.wand = false;
      p.x = 18 + (slot++ % 6) * 2.4; p.z = 4; p.yaw = 0;
    }
    if (this.day > 1) { this.morningMud(); this.fries = Math.floor(this.fries / 2); }   // the fries went cold overnight
    this.mods.call('startShift');      // venue modules' mornings: after the reset, before the quota is set
    // Corporate's memo and today's quota. Judged on Upkeep, so a mid-shift purchase can't buy it.
    if (this.endless) this.quota = null;
    else if (this.venue === 0) { const q = quotaQ(this.day, this.ceiling()); this.quota = q == null ? null : { q }; }
    else this.quota = { q: (this.ceiling() - 1) * venueQuotaF(this.venueDay) };
    this.events.push({ t: 'memo', day: this.day, target: this.quota ? this.quotaTarget() : null, text: memoText(this.day, this.quota && this.quotaTarget(), this.endless, this.rng) });
    if (this.cart) { this.cart.boostT = 0; if (!this.cart.driver) Object.assign(this.cart, CART.PARK, { v: 0 }); }
    for (const m of this.mats) m.next = 1 + this.rng() * 5;
    for (const e of openMats(this.mats, { now: this.custT, rng: this.rng, venue: this.venue, nOpen: activeMats(this.onlineCount()), nextCust: () => ++this.nextCust, mud: i => this.fixtures['mat' + i] ?? 0 })) {
      if (e.t === 'wait') this.events.push({ t: 'custwait', mat: e.mat });
    }
    this.rollTreasureToday();
    this.revealT = 0;
    if (this.pendingReveal) {        // a promotion: the next morning plays the reveal
      const v = this.pendingReveal;
      this.pendingReveal = 0; this.revealT = REVEAL_SECS;
      this.events.push({ t: 'reveal', venue: v, memo: VENUE_RULES[v].memo, title: this.title() });
      this.pa(VENUE_RULES[v].pa);
    }
    if (this.endlessFresh) { this.endlessFresh = false; this.events.push({ t: 'reveal', venue: 6, memo: 'Under New Management.', title: 'Owner' }); }
    this.dirty = true;
    this.events.push({ t: 'shift', phase: 'shift', day: this.day });
    if (this.day === 1 || !this.voiced.has('welcome')) this.pa('welcome', { once: true });
  }

  quotaTarget() { return this.quota ? cents(this.valueNow().rate * (1 + this.quota.q)) : null; }

  // The clock holds for venue reveals and for the Last Bucket's moment.
  paused() { return this.revealT > 0 || (this.lastBucket && this.lastBucket.phase !== 'done'); }

  // Super-bouncy balls don't want to be picked up: get close and they hop away.
  stepBouncy() {
    for (const b of this.balls.values()) {
      if (b.kind !== 'bouncy' || !b.rest || b.sunk || (b.hops ?? 0) >= 4) continue;
      for (const p of this.players.values()) {
        const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
        if (d > 2.6 || d < 0.01 || this.driving(p)) continue;
        b.rest = false; b.acc = 0; b.hops = (b.hops ?? 0) + 1;
        b.vx = dx / d * 3.5; b.vz = dz / d * 3.5; b.vy = 3;
        this.events.push({ t: 'kick', id: b.id, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz });
        break;
      }
    }
  }

  // ---- the snack shed ------------------------------------------------------------
  // The kitchen minigame: fries, hot dogs and beer. The client plays it, the server rate-limits it.
  serve(p, a) {
    const now = this.now();
    if (!this.perks.shed || !atShed(p) || p.down > 0 || this.driving(p)) return false;
    if (now - (p.servedAt ?? 0) < FRIES.SERVE_MIN_SECS * 1000) return false;
    p.servedAt = now;
    const item = menuFor(this.venue).includes(a.item) ? a.item : 'fries';   // a locked item can't be served
    const q = ['perfect', 'good', 'burnt'].includes(a.quality) ? a.quality : 'burnt';
    let n = yieldFor(item, q, !!a.onePeel);
    const { fed, take } = garyEats(this.gary, item, q);
    if (fed) { this.gary.fed = true; n = Math.max(0, n - take); this.events.push({ t: 'garyFed', by: p.id }); this.dirty = true; }
    this.stats.served = (this.stats.served ?? 0) + 1;
    if (item === 'beer') this.stats.beers = (this.stats.beers ?? 0) + (q === 'burnt' ? 0 : 1);   // counted for the Tiered deck (overserving, later)
    this.events.push({ t: 'served', by: p.id, item, quality: q, n });
    if (n) { this.addFries(n, p.id); p.shift.cooked += n; }
    this.mods.call('serve', p, { item, quality: q, n });
    return true;
  }
  addFries(n, by) {
    if (this.fries >= FRIES.MAX) return;
    this.fries = Math.min(FRIES.MAX, this.fries + n);
    this.stats.fries = (this.stats.fries ?? 0) + n; this.dirty = true;
    this.events.push({ t: 'fries', by, stock: this.fries });
  }

  // ---- the pond (opens with the Range Club) ------------------------------------------
  sunkCount() { let n = 0; for (const b of this.balls.values()) if (b.sunk) n++; return n; }

  sink(b) {
    if (this.sunkCount() >= POND.MAX_SUNK) { this.balls.delete(b.id); this.events.push({ t: 'gone', id: b.id }); return; }
    b.sunk = true; b.rest = true; b.vx = b.vy = b.vz = 0; b.y = bedAt(b.x, b.z);
    if (sinksDeep(b.kind)) { const s = deepEndSpot(this.rng); b.x = s.x; b.z = s.z; b.y = s.y; }   // lead and gold roll into the Deep End
    this.events.push({ t: 'sink', id: b.id, x: b.x, z: b.z, kind: b.kind });
  }

  // A ball at a random spot on the bottom (from a save, or spilled from a gasping diver's bag).
  sinkNew(kind, near = null) {
    const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * (near ? 1.5 : POND.r - 0.8);
    const cx = near?.x ?? POND.x, cz = near?.z ?? POND.z;
    let x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y;
    if (sinksDeep(kind)) { const s = deepEndSpot(this.rng); x = s.x; z = s.z; y = s.y; }
    else if (!inPond({ x, z })) return this.sinkNew(kind);
    else y = bedAt(x, z);
    const b = this.addBall({ x, y, z, vx: 0, vy: 0, vz: 0, kind });
    if (b) { b.sunk = true; b.rest = true; this.events.push({ t: 'sink', id: b.id, x, z, kind }); }
  }

  pondPickup(p, id) {
    const b = this.balls.get(id);
    if (!b || !b.sunk || !p.diving || p.down > 0 || p.bag >= diveTiers(p.dive).bag) return false;
    if (Math.hypot(b.x - p.x, b.z - p.z) > POND.REACH + 1) return false;
    this.balls.delete(id);
    const k = this.loadOf(b);
    p.bag += k; p.bagW += (KIND_W[b.kind] ?? 1) * k; for (let i = 0; i < k; i++) p.bagKinds.push(k === 3 ? 'range' : b.kind ?? 'range');
    this.stats.picked++; this.stats.dived = (this.stats.dived ?? 0) + 1; p.shift.dived++; this.dirty = true;
    this.events.push({ t: 'gone', id, by: p.id });
    return true;
  }

  stepPond(dt) {
    if (!this.pondOpen()) { for (const p of this.players.values()) p.diving = false; return; }
    // Buddy Air v2: air comes from cranking. Every pumper on the dock adds their turns (or the held-button trickle);
    // the sum goes to every diver, capped at two pumpers' worth.
    const nowMs = this.now();
    let gain = 0;
    for (const p of this.players.values()) {
      const live = p.online > 0 && onDock(p) && !p.diving;
      const turns = live ? Math.min(p.pumpTurns, PUMP.MAX_TPS * dt) : 0;
      p.pumpTurns = live ? Math.max(0, p.pumpTurns - turns) : 0;
      const held = live && p.pumpHeld;
      p.pumping = live && (held || nowMs - p.pumpAt < 400);
      if (live) gain += pumpGain({ turns, held: held && turns === 0, dt });
    }
    gain = Math.min(gain, PUMP.MAX_TPS * PUMP.SECS_PER_TURN * 2 * dt);
    this.tubeClock += dt;
    for (const p of this.players.values()) {
      const wet = inPond(p) && !this.driving(p) && !p.one;
      if (wet !== p.diving) {
        p.diving = wet;
        const up = p.bag;
        if (!wet && p.bag > 0) {   // surfaced with the bag: it's yours to bank
          p.pocket += p.bag; p.pocketW = (p.pocketW ?? 0) + p.bagW; p.bag = 0; p.bagW = 0; p.bagKinds = [];
        }
        this.events.push({ t: 'dive', id: p.id, on: wet, bag: wet ? 0 : up });
      }
      const tier = diveTiers(p.dive);
      if (p.treasure && p.down > 0) this.dropTreasure(p);      // a knockdown drops it at your feet
      if (p.diving) {
        const st = airStep({ air: p.air, dt, tier, x: p.x, z: p.z, gain });
        p.air = st.air;
        if (st.gasp) {             // out of air: pop up coughing on the dock, the bag spills back down (kinds kept); a bag on the line is safe
          for (const k of p.bagKinds) this.sinkNew(k, p);
          if (p.treasure) { this.dropTreasure(p, true); }
          p.bag = 0; p.bagW = 0; p.bagKinds = []; p.air = tier.air * 0.5; p.diving = false;
          p.x = POND.DOCK.x; p.z = POND.DOCK.z + 1.5; p.movedAt = this.now();
          this.events.push({ t: 'gasp', id: p.id }, { t: 'dive', id: p.id, on: false });
        }
      } else p.air = Math.min(tier.air, p.air + POND.AIR_REFILL * dt * Math.max(1, tier.air / POND.AIR));
    }
    // The pneumatic tube: balls fed in arrive at the stand 6 s later, at the gear factor they were fed with.
    for (const e of tubeArrivals(this.tube, this.tubeClock)) {
      this.bank(e.n, e.by, null, e.w, e.factor);
      this.events.push({ t: 'thunk', n: e.n, by: e.by });
    }
    // The pond pump (crew row, tier 2): clears one sunk ball into the tube every 8 s, all shift.
    if (this.phase === 'shift' && hasPondPump(this.up)) {
      for (let k = pondPumpStep(this.tube, dt); k > 0; k--) {
        const b = [...this.balls.values()].find(o => o.sunk && o.kind !== 'one');
        if (!b) break;
        this.balls.delete(b.id); this.events.push({ t: 'gone', id: b.id });
        const w = KIND_W[b.kind] ?? 1;
        tubeFeed(this.tube, this.tubeClock, { n: 1, w, factor: 1 });
        this.tube.q.at(-1).by = 'pump';
        this.stats.picked++; this.dirty = true;
      }
    }
  }

  // {t:'pump', turns, held} (or the old {on}): turns are crank turns since the last message.
  pumpInput(p, a) {
    if (!onDock(p) || p.diving) { p.pumping = false; p.pumpHeld = false; p.pumpTurns = 0; return; }
    const turns = Number(a.turns);
    if (Number.isFinite(turns) && turns > 0) { p.pumpTurns = Math.min(1, p.pumpTurns + Math.min(turns, 1)); p.pumpAt = this.now(); }
    p.pumpHeld = !!(a.held || a.on);
    p.pumping = p.pumpHeld || this.now() - p.pumpAt < 400;
  }

  // Ⓧ underwater: clip the bag to the line.
  sendBagUp(p) {
    if (!canSend(p)) return false;
    const n = sendBag(p, this.line);
    this.events.push({ t: 'sent', id: p.id, n }); this.dirty = true;
    return true;
  }

  // Ⓧ held on the dock: land the whole line into your pocket (capacity ignored, like surfacing).
  haulInput(p, a) {
    if (p.down > 0 || p.diving || !onDock(p) || this.line.n <= 0 || a.held === false) { p.haulHeld = 0; return false; }
    const now = this.now();
    // `secs` is how long the client has held the button; the server also caps it by its own clock.
    const own = p.haulAt && now - p.haulAt < 1000 ? p.haulHeld + (now - p.haulAt) / 1000 : 0;
    p.haulAt = now;
    p.haulHeld = Math.min(Number.isFinite(+a.secs) ? +a.secs : own, own + 0.3);
    if (!haulReady(p.haulHeld)) return false;
    const got = takeLine(this.line);
    p.pocket += got.n; p.pocketW = (p.pocketW ?? 0) + got.w; p.haulHeld = 0; p.haulAt = 0; this.dirty = true;
    this.events.push({ t: 'hauled', id: p.id, n: got.n });
    return true;
  }

  // Ⓧ at the red box on the dock: your carried balls (and any treasure) go in the tube.
  feedTube(p) {
    if (p.down > 0 || p.diving || !hasTube(this.up) || !atTube(p)) return false;
    if (p.treasure) this.bankTreasure(p);
    if (p.pocket <= 0) return true;
    tubeFeed(this.tube, this.tubeClock, { n: p.pocket, w: p.pocketW ?? p.pocket, factor: gearGrimeFactor(p.grime) });
    this.tube.q.at(-1).by = p.id;
    p.pocket = 0; p.pocketW = 0; this.dirty = true;
    this.events.push({ t: 'tube', id: p.id });
    return true;
  }

  // ---- treasure (Lost & Found) ----
  // Mornings: at most one treasure a shift, a 50% roll, from the Club on.
  rollTreasureToday() {
    for (const p of this.players.values()) if (p.treasure) this.dropTreasure(p, true);   // anything still carried goes back down
    if (this.treasure || !this.pondOpen()) return;
    const t = rollTreasure(this.lostFound, this.venue, this.rng);
    if (!t) return;
    const s = treasureSpot(this.treasureSeed + this.lostFound.length, t.id);
    this.treasure = { id: t.id, x: s.x, z: s.z };
    this.events.push({ t: 'treasure', id: t.id, phase: 'sunk' });
  }

  treasurePickup(p) {
    const t = this.treasure;
    if (!t || !p.diving || p.down > 0 || p.treasure || p.one) return false;
    if (Math.hypot(t.x - p.x, t.z - p.z) > POND.REACH + 1) return false;
    p.treasure = t.id; this.treasure = null; this.dirty = true;
    this.events.push({ t: 'treasure', id: t.id, phase: 'carried', by: p.id });
    return true;
  }

  // Put a carried treasure back: at the carrier's feet (knockdown) or in the Deep End (gasp / the bell).
  dropTreasure(p, deep = false) {
    if (!p.treasure) return;
    const id = p.treasure; p.treasure = null;
    if (this.treasure) return;       // (only one lies down there at a time)
    let x, z;
    if (!deep && inPond(p)) { x = p.x; z = p.z; }
    else { const s = treasureSpot(this.treasureSeed + this.lostFound.length, id); x = s.x; z = s.z; }
    this.treasure = { id, x, z }; this.dirty = true;
    this.events.push({ t: 'treasure', id, phase: 'sunk' });
  }

  // At the stand (or the tube): the finder's fee, 200 x BV, "as a gesture", and the case gets the item.
  bankTreasure(p) {
    const id = p.treasure;
    if (!id || !TREASURE_BY_ID[id]) return false;
    p.treasure = null;
    if (!this.lostFound.includes(id)) this.lostFound.push(id);
    const fee = cents(finderFee(id, this.valueNow().bv));
    this.cash = cents(this.cash + fee); this.stats.cash = cents(this.stats.cash + fee); this.dirty = true;
    p.shift.cash = cents(p.shift.cash + fee);
    this.events.push({ t: 'treasure', id, phase: 'banked', by: p.id, fee });
    this.pa('treasure', { once: true });
    return true;
  }

  // ---- Gary from Regional --------------------------------------------------------
  garyStops() {
    const stops = [...GARY.STOPS];
    if (this.venue >= 1) stops.splice(stops.length - 1, 0, { id: 'kitchen', x: FRIES.SHED.x, z: FRIES.SHED.z + 0.5 });
    return stops;
  }

  stepGary(dt) {
    if (this.phase !== 'shift' || this.endless || this.day < GARY.FROM_DAY || this.paused()) return;
    const g = this.gary;
    if (!g) {
      if (this.shiftT >= this.shiftSecs * GARY.AT) {
        this.gary = { phase: 'warn', t: GARY.WARN_SECS, x: GARY.START.x, z: GARY.START.z, yaw: Math.PI / 2, stop: 0, pause: 0, fails: 0, checks: [] };
        this.events.push({ t: 'gary', phase: 'warn' });
        this.pa('gary', { once: true });
      }
      return;
    }
    if (g.phase === 'warn') {
      if ((g.t -= dt) <= 0) { g.phase = 'drive'; g.t = 0; this.events.push({ t: 'gary', phase: 'drive' }); }
      return;
    }
    if (g.phase !== 'drive') return;
    if (g.pause > 0) { g.pause -= dt; return; }
    const stops = this.garyStops();
    let stop = stops[g.stop];
    if (stop?.id === 'cart' && !this.cart) { g.stop++; stop = stops[g.stop]; }
    if (!stop) return;
    const tx = stop.id === 'cart' ? this.cart.x + 3 : stop.x, tz = stop.id === 'cart' ? this.cart.z + 3 : stop.z;
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz), step = GARY.SPEED * dt;
    if (d > 0.3) {
      const k = Math.min(1, step / d);
      g.x += dx * k; g.z += dz * k; g.yaw = Math.atan2(-dx, -dz);
      for (const o of [...this.players.values(), ...this.helpers]) {     // he drives like he owns the place
        if (o.down > 0 || this.driving(o)) continue;
        if (Math.hypot(o.x - g.x, o.z - g.z) < 1.3) { this.knockDown(o, 'gary'); this.stats.runOver++; }
      }
      return;
    }
    // Arrived: inspect.
    const ok = this.inspect(stop.id);
    if (stop.id !== 'stand' && !ok) g.fails++;
    g.checks.push({ stop: stop.id, ok });
    this.events.push({ t: 'check', stop: stop.id, ok, x: g.x, z: g.z });
    g.pause = GARY.PAUSE; g.stop++;
    if (stop.id === 'stand') {
      const fails = g.fails + (ok ? 0 : 1);
      const online = this.online();
      const huddle = online.length > 0 && online.every(p => Math.hypot(p.x - 26, p.z - 6) < GARY.HUDDLE_R);
      const gained = fails <= 1 ? Math.min(10 - this.commendations, huddle ? 2 : 1) : 0;
      this.commendations += gained;
      g.phase = 'done';
      this.dirty = true;
      this.events.push({ t: 'verdict', fails, huddle, gained, commendations: this.commendations });
      if (gained && huddle) this.pa('huddle', { chance: 1 / 3 });
    }
  }

  // ---- MOW-E, the Club's autonomous mower (council round 3, §3.5) ---------------------
  stepMowe(dt) {
    if (this.phase !== 'shift' || this.endless || this.paused()) return;
    if (!this.mower) {
      if (mowerDue({ venue: this.venue, venueDay: this.venueDay, shiftT: this.shiftT, shiftSecs: this.shiftSecs, mower: this.mower, endless: this.endless })) {
        this.mower = newMower(this.balls, this.rng);
        this.events.push({ t: 'mower', phase: 'warn', lane: this.mower.lane });
        this.pa('mower', { once: true });
        this.dirty = true;
      }
      return;
    }
    if (this.mower.phase === 'done') return;
    const people = [...this.players.values(), ...this.helpers].map(o => ({ id: o.id, x: o.x, z: o.z, down: o.down, driving: this.driving(o) }));
    const r = stepMower(this.mower, dt, { balls: this.balls, players: people, cart: this.cart, rng: this.rng });
    const ids = [];
    for (const m of r.raked) {
      const b = this.balls.get(m.id);
      if (!b || b.sunk || b.kind === 'one') continue;
      b.x = m.x; b.z = m.z; b.rest = true; b.vx = b.vy = b.vz = 0;
      ids.push(m.id);
    }
    if (ids.length) this.events.push({ t: 'rake', ids, moves: r.raked.filter(m => ids.includes(m.id)) });
    for (const id of r.knocked) {
      const o = this.players.get(id) ?? this.helpers.find(h => h.id === id);
      if (!o || o.down > 0) continue;
      this.knockDown(o, 'mower'); this.stats.runOver++;
      if (o.shift) o.shift.mowed = (o.shift.mowed ?? 0) + 1;
    }
    if (r.honk) this.events.push({ t: 'honk' });
    if (r.phaseChange) this.events.push({ t: 'mower', phase: r.phaseChange, lane: this.mower.lane });
  }

  // A stop passes on its own rule, unless a venue module vetoes it (the Upper Deck incident fails the kitchen).
  inspect(id) { return this.inspectBase(id) && !this.mods.veto('inspect', id); }
  inspectBase(id) {
    const f = this.fixtures;
    if (id === 'sign') return f.sign <= GARY.CLEAN;
    if (id === 'stand') return f.stand <= GARY.CLEAN;
    if (id === 'cart') return !this.cart || this.cart.mud <= GARY.CLEAN;
    if (id === 'kitchen') return !!this.gary?.fed || this.fries >= FRIES.MAX * 0.5;   // Gary had a hot dog
    if (id === 'mats') {
      const nAct = activeMats(this.onlineCount());   // only the mats in play: solo never washes mats nobody uses
      const mats = Object.entries(f).filter(([k]) => k.startsWith('mat') && +k.slice(3) < nAct);
      return mats.filter(([, v]) => v <= GARY.CLEAN).length >= mats.length * 0.8;
    }
    return true;
  }

  lastCall() {
    return this.phase === 'shift' && this.day >= LAST_CALL.FROM_DAY && this.shiftT >= this.shiftSecs - LAST_CALL.SECS;
  }

  // ---- the Last Bucket (council round 2, §4.8) -------------------------------------------
  beginLastBucket() {
    this.lastBucket = { phase: 'falling', t: 3 };
    this.events.push({ t: 'lastbucket', phase: 'falling' });
    this.pa('one', { once: true });
    this.dirty = true;
  }

  stepLastBucket(dt) {
    const lb = this.lastBucket;
    if (!lb) return;
    if (lb.phase === 'falling' && (lb.t -= dt) <= 0 && !lb.id) {
      // Ball No. 1 comes home: high above the field, landing 90–120 m out, away from the pond.
      const tx = (this.rng() - 0.5) * 70, tz = -(90 + this.rng() * 30), secs = 6;
      const vy = (0 - 120 + 0.5 * SIM.G * secs * secs) / secs;
      const b = this.addBall({ x: tx, y: 120, z: tz + 8, vx: 0, vy, vz: -8 / secs, kind: 'one' });
      if (b) { lb.id = b.id; lb.phase = 'down'; }
    }
  }

  // Banking Ball No. 1 needs the whole crew at the stand.
  depositOne(p) {
    const online = this.online();
    const near = online.filter(o => Math.hypot(o.x - SIM.STAND.x, o.z - SIM.STAND.z) < HUDDLE_R).length;
    if (near < online.length) { this.events.push({ t: 'huddle', n: near, of: online.length, by: p.id }); return false; }
    p.one = false;
    const v = this.valueNow();
    const pay = cents(ONE_YEAR * v.bv);
    this.cash = cents(this.cash + pay); this.stats.cash = cents(this.stats.cash + pay); this.stats.deposited++;
    this.outstanding = 0;
    this.lastBucket = { phase: 'done', by: p.id };
    this.endless = true; this.endlessFresh = true; this.endlessArmed = true;
    this.events.push({ t: 'lastbucket', phase: 'banked', by: p.id, cash: pay });
    this.pa('last', { once: true });
    this.endShift(true);
    return true;
  }

  // ---- the clock -------------------------------------------------------------

  addBall(s) {
    if (this.balls.size >= SIM.MAX_BALLS) return null;
    const b = { id: this.nextBall++, ...s, rest: false, acc: 0 };
    this.balls.set(b.id, b);
    this.events.push({ t: 'spawn', id: b.id, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, kind: b.kind, curve: b.curve || undefined });
    return b;
  }

  tick(dt) {
    const now = this.now();
    if (this.revealT > 0) this.revealT = Math.max(0, this.revealT - dt);
    this.stepLastBucket(dt);
    const paused = this.paused();
    const lastCall = this.lastCall();
    if (lastCall && !this.lastCallRung) { this.lastCallRung = true; this.events.push({ t: 'lastcall' }); }
    // Customers: arrive at the gate, grab a bucket, hit it, walk out. A filthy mat is refused.
    this.custT += dt;
    const nOpen = this.phase === 'shift' ? activeMats(this.onlineCount()) : 0;
    this.mats.forEach((m, i) => {
      for (const e of stepMat(m, dt, { now: this.custT, rng: this.rng, venue: this.venue, mud: this.fixtures['mat' + m.i] ?? 0, open: i < nOpen,
        gap: 8 * this.perks.swingGapMult, nextCust: () => ++this.nextCust })) {
        if (e.t === 'wait') this.events.push({ t: 'custwait', mat: m.i });
        if (e.t === 'refuse') { this.events.push({ t: 'refuse', mat: m.i }); this.stats.refused = (this.stats.refused ?? 0) + 1; }
      }
    });
    if (this.phase === 'shift' && !paused) {
      this.shiftT += dt;
      this.fixtures.sign = Math.min(1, this.fixtures.sign + dt * 0.0008);    // dust off the road
      this.fixtures.stand = Math.min(1, this.fixtures.stand + dt * 0.0006);
      const n = activeMats(this.onlineCount());
      const eatEvery = VENUE_RULES[this.venue].eatEvery ?? FRIES.EAT_EVERY;
      for (let i = 0; i < n; i++) {
        const m = this.mats[i];
        if ((m.next -= dt) > 0) continue;
        if (!matReady(m, this.custT)) { m.next = 0.5; continue; }   // nobody on the mat yet
        if (this.balls.size < SIM.MAX_BALLS) {
          const lead = !lastCall && this.pondOpen() && this.rng() < POND.LEAD_CHANCE;
          const kind = lead ? 'lead' : lastCall ? 'glow' : pickKind(this.day, this.venue, this.rng);
          let shot = lead ? { ...leadLaunch(m, this.rng), kind } : { ...launch(m, this.rng, { beginner: this.day === 1 && this.venue === 0 }), kind };
          shot = this.mods.pipe('launchMod', shot, { mat: m, kind, lead });   // the County slice, orbit shots
          const b = this.addBall(shot);
          if (b && kind !== 'range' && !this.debuts.has(kind)) {
            this.debuts.add(kind); this.dirty = true; this.events.push({ t: 'debut', kind });
            if (DEBUT_PA[kind]) this.pa(DEBUT_PA[kind], { once: true });
          }
          if (b && this.endless) {     // Under New Management: Balls Outstanding is a live count
            this.outstanding++;
            if (this.endlessArmed) { this.endlessArmed = false; this.outstanding = 1; this.pa('endless', { once: true }); }
          }
          m.next = swingGap(this.rng) * this.perks.swingGapMult / (lastCall ? LAST_CALL.SWING : 1);
          if (this.perks.shed && --this.swingsToEat <= 0) { this.swingsToEat = eatEvery; this.fries = Math.max(0, this.fries - 1); }
          const id = 'mat' + m.i;
          if (b) this.fixtures[id] = Math.min(1, this.fixtures[id] + 0.006 * (this.perks.covered ? 0.5 : 1));   // every swing scuffs the mat
          if (b) shoot(m, this.custT);
        }
      }
    }

    this.stepHelpers(dt);
    this.stepGary(dt);
    this.stepMowe(dt);
    this.stepPond(dt);
    this.stepBouncy();
    this.mods.call('tick', dt);
    if (this.phase === 'shift' && !paused && this.perks.autoFry && (this.autoFryT += dt) >= this.perks.autoFry) { this.autoFryT = 0; this.addFries(1, 'machine'); }
    // The electric / industrial ball washer works through the hopper on its own.
    if (this.phase === 'shift' && this.perks.washAuto && this.hopper.n > 0) {
      this.hopper.frac += this.perks.washAuto * dt;
      const k = Math.floor(this.hopper.frac);
      if (k > 0) { this.hopper.frac -= k; this.washBalls(k, 'machine'); }
    }
    if ((this.washFlushT += dt) >= 0.5) {
      this.washFlushT = 0;
      for (const [by, b] of this.washBatch) this.events.push({ t: 'washed', by, n: b.n, cash: b.cash, left: this.hopper.n });
      this.washBatch.clear();
    }

    const c = this.cart;
    for (const b of this.balls.values()) {
      if (b.rest) continue;
      const x0 = b.x, y0 = b.y, z0 = b.z;
      const stopped = advanceBall(b, dt, this.world());
      if (stopped === 'drift') { this.events.push(driftEvent(b)); continue; }   // into the running creek
      if (c && b.kind !== 'one' && !b.pinged && ballHitsCart(x0, y0, z0, b, c)) { this.ping(b); continue; }
      // Gary's cart rings too, but it isn't a PING. Gary has noted your enthusiasm.
      if (this.gary?.phase === 'drive' && b.kind !== 'one' && !b.pinged && ballHitsCart(x0, y0, z0, b, this.gary)) {
        b.pinged = true;
        this.events.push({ t: 'enthusiasm', by: b.by ?? null, x: this.gary.x, z: this.gary.z });
        const shooter = this.players.get(b.by); if (shooter) shooter.shift.pings++;
      }
      for (const p of [...this.players.values(), ...this.helpers]) {
        if (!p.helper && this.driving(p)) continue;            // the cage keeps the driver safe
        if (b.by === p.id || b.kind === 'one') continue;       // your own swing leaves from your feet
        if (!ballHitsPlayer(x0, y0, z0, b, p)) continue;
        this.knockDown(p);
        b.vx *= -0.25; b.vz *= -0.25; b.vy = Math.abs(b.vy) * 0.3;  // it bounces off you
        break;
      }
      if (this.pondOpen() && b.kind !== 'one' && b.y <= SIM.BALL_R + 0.05 && inPond(b)) { this.sink(b); continue; }
      if (stopped) { this.events.push({ t: 'rest', id: b.id, x: b.x, z: b.z, ...(b.kind === 'one' ? { one: true } : {}) }); this.mods.call('onRest', b); }
    }
    // The creek carries balls: inflow to the Delta (they sink: the diver's pile), outflow to the Grate (the cart's pile).
    for (const b of this.balls.values()) {
      if (!b.drifting) continue;
      const end = stepDrift(b, dt);
      if (end === 'sink') this.sink(b);
      else if (end === 'rest') { this.events.push({ t: 'rest', id: b.id, x: b.x, z: b.z }); this.mods.call('onRest', b); }
    }

    if (c) {
      if (c.boostT > 0) c.boostT = Math.max(0, c.boostT - dt);
      const d = c.driver && this.players.get(c.driver);
      if (c.driver && (!d || (d.online === 0 && now - d.seenAt > DRIVER_GRACE_MS))) { c.driver = null; c.v = 0; }
      // Pull up to the stand and the hopper empties itself.
      if (c.load > 0 && Math.hypot(c.x - SIM.STAND.x, c.z - SIM.STAND.z) < SIM.STAND_REACH + 2.5) {
        this.bank(c.load, c.driver ?? 'cart', 'cart', c.loadW ?? c.load);
        c.load = 0; c.loadW = 0;
      }
    }

    for (const p of this.players.values()) {
      if (p.down > 0) p.down = Math.max(0, p.down - dt);
      if (p.online === 0 && now - p.seenAt > GRACE_MS) this.removePlayer(p);
    }
    for (const h of this.helpers) if (h.down > 0) h.down = Math.max(0, h.down - dt);

    // Ready Up: 20 s after the first Rat is ready, the next shift starts anyway.
    if (this.phase === 'report' && this.readyAt && now - this.readyAt >= READY_SECS * 1000) this.startShift();
    if (this.phase === 'shift' && this.shiftT >= this.shiftSecs) this.endShift();
  }

  knockDown(p, by = null) {
    p.down = this.perks.knockSecs;
    if (p.helper) p.target = null;
    this.stats.knockdowns++; this.dirty = true;
    if (p.shift) p.shift.knockdowns++;
    this.events.push({ t: 'knock', id: p.id, by });
    // Whatever you were carrying goes everywhere.
    for (const s of spill(p.x, p.z, p.pocket, this.rng)) this.addBall(s);
    p.pocket = 0; p.pocketW = 0;
    if (p.one) {                     // Ball No. 1 drops at your feet. It doesn't fly.
      p.one = false;
      const b = this.addBall({ x: p.x + 0.4, y: SIM.BALL_R, z: p.z, vx: 0, vy: 0, vz: 0, kind: 'one' });
      if (b) { b.rest = true; this.events.push({ t: 'rest', id: b.id, x: b.x, z: b.z, one: true }); }
      if (this.lastBucket) { this.lastBucket.phase = 'down'; this.lastBucket.id = b?.id; }
    }
    if (!p.helper) this.addGrime(p, 1);   // you landed in the mud
    this.mods.call('knockDown', p, by);
  }

  removePlayer(p) {
    if (this.driving(p)) { this.cart.driver = null; this.cart.v = 0; }
    for (const s of spill(p.x, p.z, p.pocket, this.rng)) this.addBall(s);
    if (p.one) { const b = this.addBall({ x: p.x, y: SIM.BALL_R, z: p.z, vx: 0, vy: 0, vz: 0, kind: 'one' }); if (b) b.rest = true; }
    this.players.delete(p.id);
    this.signed.delete(p.id); this.ready.delete(p.id);
    this.events.push({ t: 'leave', id: p.id });
  }

  endShift(ending = false) {
    this.phase = 'report';
    // Closing time: hired help and the cart turn in what they're carrying, so it counts today.
    for (const h of this.helpers) { this.bank(h.pocket, h.id, 'helper', h.pocketW ?? h.pocket); h.pocket = 0; h.pocketW = 0; h.target = null; }
    // The night crew takes the pond's line at half pay, and the tube delivers what is still in it.
    if (this.line.n > 0) { const nc = nightCrew(this.line); this.line = newLine(); this.bank(nc.n, 'night', 'helper', nc.w * nc.mult); }
    for (const e of tubeArrivals(this.tube, Infinity)) this.bank(e.n, e.by, null, e.w, e.factor);
    if (this.cart) { this.bank(this.cart.load, this.cart.driver ?? 'cart', 'cart', this.cart.loadW ?? this.cart.load); this.cart.load = 0; this.cart.loadW = 0; this.cart.boostT = 0; }
    // The ball washer at the bell: the night crew washes half of what's left at half pay; the rest goes dirty.
    if (this.hopper.n > 0) {
      const half = Math.floor(this.hopper.n / 2), payHalf = cents(this.hopper.credit * 0.5 * 0.5);
      this.stats.unwashed = this.hopper.n - half;
      this.stats.lostPremium = cents(this.hopper.credit - payHalf);
      this.cash = cents(this.cash + payHalf); this.stats.cash = cents(this.stats.cash + payHalf);
      this.hopper = { n: 0, credit: 0, frac: 0 };
    }
    this.mods.call('endShift', ending);   // venue modules settle up before the review reads the gauges
    // The performance review: Upkeep at the bell against Corporate's target (council round 2, §1.2).
    let quota = null;
    if (this.quota && !ending) {
      const v = this.valueNow(), target = this.quotaTarget();
      const hit = this.stats.deposited > 0 && v.bv / v.rate + 1e-9 >= 1 + this.quota.q;
      const bonus = hit ? cents(this.stats.cash * 0.15) : 0;
      if (hit) { this.stamps++; this.cash = cents(this.cash + bonus); }
      quota = { target, bv: v.bv, hit, bonus, stamps: this.stamps, title: this.title(), ...(this.stats.deposited > 0 ? {} : { idle: true }) };
      this.events.push({ t: 'quota', ...quota });
    }
    // Crew records (from day 3).
    let record = null;
    if (this.day >= 3 && this.stats.cash > this.records.cash) {
      record = { cash: this.stats.cash, was: this.records.cash };
      this.records = { cash: this.stats.cash, banked: this.stats.deposited, day: this.day };
      this.pa('record');
    }
    for (const k of Object.keys(this.stats)) this.totals[k] = (this.totals[k] ?? 0) + this.stats[k];
    this.report = { day: this.day, ...this.stats, left: this.balls.size, bank: this.cash, quota, record,
      ledger: this.ledger(), promo: this.promoInfo(), venue: this.venue, title: this.title(),
      tomorrow: tomorrowText(this.day + 1, this.venue, this.endless) };
    if (ending) this.report.ending = { days: this.day, banked: this.totals.deposited, commendations: this.commendations, quotas: this.totals.stamps + this.stamps };
    this.dirty = true;
    this.events.push({ t: 'shift', phase: 'report', day: this.day, report: this.report });
  }

  // Employee of the Shift and the personal ledger (council round 2, §5.2).
  ledger() {
    const rats = this.online().length ? this.online() : [...this.players.values()];
    const AWARDS = [['Employee of the Shift', 'banked'], ['Most Horizontal Associate', 'knockdowns'], ['Department of Wet', 'dived'],
      ['Fry Laureate', 'cooked'], ['Crank Operator of the Shift', 'scrubbed'], ['Hydration Officer', 'hosed'], ['Enthusiasm (Noted)', 'pings'], ['Mown Down (Twice)', 'mowed'],
      ...this.mods.collect('awards')];   // venue modules' awards key off their own p.shift counters
    const award = new Map();
    for (const [name, key] of AWARDS) {
      const best = rats.filter(r => !award.has(r.id) && (key === 'banked' || r.shift[key] > 0))
        .sort((a, b) => b.shift[key] - a.shift[key])[0];
      if (best) award.set(best.id, name);
    }
    return rats.map(r => ({ id: r.id, name: r.name, color: r.color, ...r.shift, award: award.get(r.id) ?? 'Present' }));
  }

  // ---- what goes over the wire ----------------------------------------------

  snapshot() {
    const c = this.cart, now = this.now();
    const cr = this.cranking ?? {};
    const rateOf = s => (cr[s] && now - cr[s].at < 400 ? +cr[s].rate.toFixed(2) : 0);
    return {
      phase: this.phase, day: this.day, shiftT: Math.round(this.shiftT * 10) / 10, shiftSecs: this.shiftSecs, cash: this.cash,
      mult: this.mult, venue: this.venue, venueDay: this.venueDay, endless: this.endless,
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, color: p.color, x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3),
        pocket: p.pocket, down: +p.down.toFixed(2), online: p.online > 0, gear: p.gear, wand: p.wand,
        diving: p.diving, air: +p.air.toFixed(1), bag: p.bag, pumping: p.pumping, dive: p.dive, treasure: p.treasure, grime: p.grime, one: p.one,
        ready: this.ready.has(p.id), signed: this.signed.has(p.id),
      })),
      value: this.valueNow(),
      quota: this.quota && { q: +this.quota.q.toFixed(4), target: this.quotaTarget() },
      stamps: this.stamps, title: this.title(), commendations: this.commendations,
      outstanding: this.outstanding, records: this.records,
      silo: this.stats.deposited, lastCall: this.lastCall(),
      promo: this.promoInfo(), revealT: +this.revealT.toFixed(1),
      readyIn: this.phase === 'report' && this.readyAt ? Math.max(0, Math.ceil(READY_SECS - (now - this.readyAt) / 1000)) : null,
      lastBucket: this.lastBucket && { phase: this.lastBucket.phase, by: this.lastBucket.by ?? null },
      washer: this.perks.washer ? { n: this.hopper.n, credit: this.hopper.credit, auto: this.perks.washAuto,
        L: cr.L && now - cr.L.at < 400 ? cr.L.id : null, R: cr.R && now - cr.R.at < 400 ? cr.R.id : null, rateL: rateOf('L'), rateR: rateOf('R') } : null,
      mower: mowerSnap(this.mower),
      ct: +this.custT.toFixed(2), mats: this.mats.map(matWire),
      gary: this.gary && { phase: this.gary.phase, t: +this.gary.t.toFixed(1), x: +this.gary.x.toFixed(2), z: +this.gary.z.toFixed(2), yaw: +this.gary.yaw.toFixed(3) },
      pond: { sunk: this.sunkCount(), unlocked: this.pondOpen(), lostFound: this.lostFound, treasure: this.treasure,
        line: this.line.n, tube: this.tube.q.reduce((s, e) => s + e.n, 0), clarity: this.pondOpen() ? pondClarity(this.sunkCount()) : null },
      fries: { stock: this.fries, max: FRIES.MAX, open: !!this.perks.shed },
      fixtures: Object.fromEntries(Object.entries(this.fixtures).map(([k, v]) => [k, +v.toFixed(2)])),
      helpers: this.helpers.map(h => ({ id: h.id, name: h.name, x: +h.x.toFixed(2), z: +h.z.toFixed(2), yaw: +h.yaw.toFixed(3), pocket: h.pocket, down: +h.down.toFixed(2) })),
      cart: c && { x: +c.x.toFixed(2), z: +c.z.toFixed(2), yaw: +c.yaw.toFixed(3), driver: c.driver, load: c.load, boost: +c.boostT.toFixed(1), mud: +c.mud.toFixed(3) },
      up: this.up,
      mods: this.mods.snapshot(),      // { [module id]: its snapshot } (round 4 venue modules)
    };
  }

  // Everything a fresh (or reconnecting) browser needs to draw the range.
  welcome(you) {
    return {
      k: 'welcome', code: this.code, you, report: this.report, s: this.snapshot(),
      balls: [...this.balls.values()].map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, rest: b.rest, kind: b.kind, sunk: !!b.sunk })),
    };
  }

  // The events since the last flush, with the current snapshot.
  flush() {
    const ev = this.events;
    this.events = [];
    return { k: 'tick', s: this.snapshot(), ev };
  }

  toSave() {
    // `day` is the next day to play: a finished shift has been banked.
    const day = this.phase === 'report' ? this.day + 1 : this.day;
    const mods = this.mods.toSave();
    return { v: 3, code: this.code, day, cash: this.cash, totals: this.totals, up: this.up, gear: this.gearByName,
      diveByName: this.diveByName, lostFound: this.lostFound,
      commendations: this.commendations, stamps: this.stamps, pondSunk: this.sunkCount(), fries: this.fries,
      venue: this.venue, venueDay: this.venueDay, outstanding: this.outstanding, pendingReveal: this.pendingReveal,
      endless: this.endless, records: this.records, voiced: [...this.voiced], debuts: [...this.debuts],
      ...(mods ? { mods } : {}),       // one key per venue module, only when one has something to keep
      savedAt: new Date(this.now()).toISOString() };
  }
}

// ---- Corporate's voice (Fairway Holdings International) ----------------------
const MEMOS = [
  'Corporate believes in you, statistically.',
  'Remember: Every Ball Matters.™ Some matter more than others.',
  'Gary from Regional sends his regards. Gary is always watching.',
  'Smiling is not required, but it is tracked.',
  'Dimples asks that you keep the mats clean. Dimples is a golf ball.',
];
const RAT_MEMOS = ["Today's target: whatever. — the Rats", 'Reminder: we are Corporate now. Please do not tell us.', 'Fries are free. For us. — the Rats'];
function memoText(day, target, endless, rng) {
  if (endless) return RAT_MEMOS[Math.floor(rng() * RAT_MEMOS.length)];
  const line = MEMOS[Math.floor(rng() * MEMOS.length)];
  if (target == null) return day === 1 ? 'Welcome to the Muni Range. Pick up balls. Bank them. Corporate pays per ball. Corporate has scheduled a beginners’ clinic. Balls will land closer. Corporate will not.' : 'Pick up balls. Bank them. Corporate pays per ball. ' + line;
  return "Today's Ball Value target is $" + target.toFixed(2) + ' at the closing bell. ' + line;
}
function tomorrowText(day, venue, endless) {
  if (endless) return 'Tomorrow: Range Rats LLC opens as usual. The job never ends.';
  if (day === 2) return 'Tomorrow: Corporate sets your first Ball Value target. Last Call begins at dusk.';
  if (day === 3) return 'Tomorrow: Gary from Regional inspects. Clean the sign, the mats, the cart and the stand, and huddle at the stand when he arrives.';
  if (venue === 0) return 'Tomorrow: three review stamps and the franchise fee earn a promotion to the Range Club.';
  return 'Tomorrow: more balls. Corporate thanks you for your continued compliance.';
}
