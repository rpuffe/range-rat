// A crew: up to 6 players sharing one range. The server owns everything that
// players could fight over (balls, pockets, the cart, cash, the shift clock);
// a player's own position (and the cart's, while they drive it) is theirs to
// report, clamped to a plausible speed.

import crypto from 'node:crypto';
import { SIM, MATS, activeMats, mulberry32, swingGap, launch, spill, advanceBall, ballHitsPlayer, atStand, clampToField,
  SHOP_BY_ID, nextPrice, perks, HELPER_NAMES, CART, BAYS, BAY_REACH, swingLaunch, ballHitsCart,
  gearPerks, HELPER_POCKET, WASH, ballValue, SPRINT } from '../web/js/sim.js';

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: codes get read aloud
export const CODE_LEN = 4;
const COLORS = ['#e8604c', '#4c9be8', '#f2c94c', '#6fcf7c', '#b07ce8', '#f29e4c'];
const GRACE_MS = 60_000;          // an offline player keeps their spot this long (page reloads)
const DRIVER_GRACE_MS = 5_000;    // an offline driver gives up the cart this fast
const NAME_MAX = 16;

// What a ping on the cage pays out, and how often.
export const PING_PRIZES = [['jackpot', 0.4], ['boost', 0.3], ['mult', 0.3]];

export const newCode = () => Array.from(crypto.randomBytes(CODE_LEN), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
export const validCode = c => typeof c === 'string' && c.length === CODE_LEN && [...c].every(ch => CODE_CHARS.includes(ch));

export function cleanName(s) {
  s = String(s ?? '').replace(/[\p{C}]/gu, '').trim();
  return [...s].slice(0, NAME_MAX).join('').trim();
}

const freshStats = () => ({ picked: 0, deposited: 0, cash: 0, knockdowns: 0, helped: 0, carted: 0, swings: 0, pings: 0, runOver: 0, washed: 0 });
const cents = v => Math.round(v * 100) / 100;

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

export class Crew {
  constructor(code, save = null, { shiftSecs = SIM.SHIFT_SECS, now = Date.now, seed } = {}) {
    this.code = code;
    this.shiftSecs = shiftSecs;
    this.now = now;
    this.rng = mulberry32(seed ?? crypto.randomBytes(4).readUInt32LE());
    this.players = new Map();
    this.balls = new Map();
    this.nextBall = 1;
    this.day = save?.day ?? 1;
    this.cash = save?.cash ?? 0;
    this.totals = { ...freshStats(), ...(save?.totals ?? {}) };
    this.up = cleanUpgrades(save?.up);
    this.gearByName = cleanGear(save?.gear);
    this.perks = perks(this.up);
    this.helpers = [];
    this.cart = null;
    this.mult = 1;                 // Hit the Cart's price multiplier, for the rest of the shift
    this.applyUpgrades();
    this.phase = 'lobby';          // lobby -> shift -> report -> shift ...
    this.shiftT = 0;
    this.stats = freshStats();
    this.report = null;
    this.mats = MATS.map(m => ({ ...m, next: 1 + this.rng() * 5 }));
    this.events = [];
    this.dirty = false;
    this.lastActive = now();
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
      pocket: 0, down: 0, online: 0, seenAt: this.now(), movedAt: this.now(), swungAt: 0,
      gear: 0, wand: false, washAt: 0,
    };
    p.gear = this.gearByName[p.name] ?? 0;
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
  driving(p) { return !!this.cart && this.cart.driver === p.id; }

  // ---- money -------------------------------------------------------------------

  ballPrice() { return ballValue({ perks: this.perks, mult: this.mult, cart: this.cart }).value; }

  bank(n, by, kind = null) {
    if (n <= 0) return;
    const cash = cents(n * this.ballPrice());
    this.cash = cents(this.cash + cash); this.stats.deposited += n; this.stats.cash += cash; this.dirty = true;
    if (kind === 'helper') this.stats.helped += n;
    this.events.push({ t: 'cash', by, n, cash, kind });
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
      p.x += dx; p.z += dz; clampToField(p);
      p.movedAt = now;
    }
    if (Number.isFinite(msg.yaw) && !this.driving(p)) p.yaw = msg.yaw;
    if (p.wand && Math.hypot(p.x - WASH.STATION.x, p.z - WASH.STATION.z) > WASH.HOSE) p.wand = false;   // out of hose
    for (const a of Array.isArray(msg.a) ? msg.a.slice(0, 8) : []) {
      if (a?.t === 'pickup') { if (!(a.cart ? this.cartPickup(p, a.ball) : this.pickup(p, a.ball))) denied.push(a.ball); }
      else if (a?.t === 'deposit') this.deposit(p);
      else if (a?.t === 'start') this.startShift();
      else if (a?.t === 'buy') this.buy(p, a.id);
      else if (a?.t === 'board') this.board(p);
      else if (a?.t === 'leave') this.leaveCart(p);
      else if (a?.t === 'swing') this.swing(p, a);
      else if (a?.t === 'wand') this.toggleWand(p);
      else if (a?.t === 'wash') this.wash(p, a.secs);
    }
    return { denied };
  }

  pickup(p, id) {
    const b = this.balls.get(id);
    const g = gearPerks(p.gear);
    if (!b || p.down > 0 || this.driving(p) || p.pocket >= g.pocket || this.phase === 'lobby') return false;
    if (b.y > 0.4) return false;                           // still in the air
    if (Math.hypot(b.x - p.x, b.z - p.z) > g.reach + 1) return false;  // slack for a rolling ball
    this.balls.delete(id);
    p.pocket++; this.stats.picked++; this.dirty = true;
    this.events.push({ t: 'gone', id, by: p.id });
    return true;
  }

  deposit(p) {
    if (p.pocket <= 0 || p.down > 0 || !atStand(p)) return;
    const n = p.pocket;
    p.pocket = 0;
    this.bank(n, p.id);
  }

  // The shop is open any time (Tab / D-pad up mid-shift): the range keeps going while you browse.
  buy(p, id) {
    const item = SHOP_BY_ID[id];
    if (!item) return false;
    const price = nextPrice(id, this.up, this.players.size, p.gear);
    if (price === null || price > this.cash) return false;
    this.cash = cents(this.cash - price);
    let level;
    if (item.personal) { level = ++p.gear; this.gearByName[p.name] = p.gear; }
    else { level = this.up[id] = (this.up[id] ?? 0) + 1; this.applyUpgrades(); }
    this.dirty = true;
    this.events.push({ t: 'buy', by: p.id, id, level, price, personal: !!item.personal });
    return true;
  }

  applyUpgrades() {
    this.perks = perks(this.up);
    this.hireHelpers();
    if (this.perks.cart && !this.cart) {
      this.cart = { ...CART.PARK, v: 0, driver: null, load: 0, boostT: 0, movedAt: this.now(), mud: 0 };
    }
  }

  // ---- the cart --------------------------------------------------------------

  board(p) {
    const c = this.cart;
    if (!c || c.driver || p.down > 0 || Math.hypot(c.x - p.x, c.z - p.z) > CART.BOARD_REACH) return false;
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
    p.x = c.x - Math.cos(c.yaw) * 1.4; p.z = c.z + Math.sin(c.yaw) * 1.4; clampToField(p);
    p.yaw = c.yaw; p.movedAt = this.now();
    this.events.push({ t: 'unboard', by: p.id });
    return true;
  }

  // The driver reports where the cart is; the server keeps it plausible.
  driveTo(p, pose, now) {
    const c = this.cart;
    if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return;
    const dt = Math.min(1, Math.max(0.05, (now - c.movedAt) / 1000));
    const vmax = this.perks.cartSpeed * (c.boostT > 0 ? CART.BOOST : 1);
    const max = vmax * 1.3 * dt + 0.6;
    let dx = pose.x - c.x, dz = pose.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d > max) { dx *= max / d; dz *= max / d; }
    c.x += dx; c.z += dz;
    c.x = Math.max(SIM.FIELD.xMin, Math.min(SIM.FIELD.xMax, c.x));
    c.z = Math.max(SIM.FIELD.zMin, Math.min(SIM.FIELD.zMax + 6, c.z));
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

  cartPickup(p, id) {
    const c = this.cart, b = this.balls.get(id);
    if (!b || !c || c.driver !== p.id || c.load >= this.perks.cartCap || this.phase === 'lobby') return false;
    if (b.y > 0.4) return false;
    const rx = c.x - Math.sin(c.yaw) * CART.REEL_AHEAD, rz = c.z - Math.cos(c.yaw) * CART.REEL_AHEAD;
    if (Math.hypot(b.x - rx, b.z - rz) > this.perks.cartReel / 2 + 1.5) return false;   // slack for lag
    this.balls.delete(id);
    c.load++; this.stats.picked++; this.stats.carted++; this.dirty = true;
    this.events.push({ t: 'gone', id, by: p.id });
    return true;
  }

  // ---- power washing ---------------------------------------------------------
  // Grab the wand at the station, then spray the cart while it's in reach.
  // The client says how long it sprayed on target; the server checks reach.

  toggleWand(p) {
    if (p.wand) { p.wand = false; return true; }
    if (this.driving(p) || p.down > 0 || Math.hypot(p.x - WASH.STATION.x, p.z - WASH.STATION.z) > WASH.GRAB) return false;
    p.wand = true; p.washAt = this.now();
    return true;
  }

  wash(p, secs) {
    const c = this.cart, now = this.now();
    if (!c || !p.wand || p.down > 0 || !Number.isFinite(secs) || secs <= 0) return false;
    if (Math.hypot(c.x - p.x, c.z - p.z) > WASH.RANGE + 1.5) return false;
    const s = Math.min(secs, 0.5, (now - p.washAt) / 1000 + 0.1);
    p.washAt = now;
    if (s <= 0) return false;
    const before = c.mud;
    c.mud = Math.max(0, c.mud - WASH.RATE * s);
    this.stats.washed = Math.round((this.stats.washed + s) * 10) / 10;
    if (before > 0.05 && c.mud <= 0.05) { c.mud = 0; this.events.push({ t: 'spotless', by: p.id }); }
    this.dirty = true;
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
    p.pocket--; p.swungAt = now;
    this.stats.swings++;
    const b = this.addBall(swingLaunch(bay, a.yaw, a.pitch, a.power));
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
    let r = this.rng(), prize = PING_PRIZES[PING_PRIZES.length - 1][0];
    for (const [name, w] of PING_PRIZES) { if (r < w) { prize = name; break; } r -= w; }
    let n = 0;
    if (prize === 'jackpot') {
      for (const o of [...this.balls.values()]) {
        if (c.load >= this.perks.cartCap) break;
        if (!o.rest || Math.hypot(o.x - c.x, o.z - c.z) > CART.JACKPOT_R) continue;
        this.balls.delete(o.id); c.load++; n++;
        this.stats.picked++; this.stats.carted++;
        this.events.push({ t: 'gone', id: o.id, by: c.driver });
      }
    } else if (prize === 'boost') c.boostT = CART.BOOST_SECS;
    else this.mult = Math.min(CART.MAX_MULT, this.mult + CART.MULT_STEP);
    this.events.push({ t: 'ping', by: b.by, prize, n, mult: this.mult });
  }

  // ---- hired help ----------------------------------------------------------
  // Helpers walk to the nearest ball nobody else is after, fill up (with the
  // crew's gear, up to a bucket), walk them to the bucket stand, and bank
  // them. They get hit too.

  hireHelpers() {
    while (this.helpers.length < this.perks.helpers) {
      const i = this.helpers.length;
      this.helpers.push({ id: `h${i}`, name: HELPER_NAMES[i] ?? `Helper ${i + 1}`, helper: true,
        x: SIM.STAND.x + 2 + i * 1.2, z: SIM.STAND.z + 1.5, yaw: Math.PI, pocket: 0, down: 0, target: null });
    }
  }

  stepHelpers(dt) {
    const claimed = new Set(this.helpers.map(h => h.target).filter(Boolean));
    const cap = HELPER_POCKET;                      // a beat-up tube
    for (const h of this.helpers) {
      if (h.down > 0) continue;
      const working = this.phase === 'shift';
      let goal = null;
      if (h.pocket >= cap || (h.pocket > 0 && !working)) goal = SIM.STAND;
      else if (working) {
        let b = h.target && this.balls.get(h.target);
        if (!b || !b.rest) {
          claimed.delete(h.target);
          h.target = null; b = null;
          let bd = Infinity;
          for (const c of this.balls.values()) {
            if (!c.rest || claimed.has(c.id)) continue;
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
        this.bank(h.pocket, h.id, 'helper');
        h.pocket = 0;
        continue;
      }
      if (goal !== SIM.STAND && d < 0.5) {
        this.balls.delete(goal.id);
        h.pocket++; h.target = null; this.stats.picked++; this.dirty = true;
        this.events.push({ t: 'gone', id: goal.id, by: h.id });
        continue;
      }
      const step = Math.min(d, SIM.HELPER_WALK * dt);
      h.x += dx / d * step; h.z += dz / d * step;
      h.yaw = Math.atan2(-dx, -dz);
    }
  }

  startShift() {
    if (this.phase === 'shift') return;
    if (this.phase === 'report') this.day++;
    // The night crew clears the field: every morning starts clean.
    for (const id of this.balls.keys()) this.events.push({ t: 'gone', id });
    this.balls.clear();
    this.phase = 'shift'; this.shiftT = 0; this.stats = freshStats(); this.report = null; this.mult = 1;
    if (this.cart) { this.cart.boostT = 0; if (!this.cart.driver) Object.assign(this.cart, CART.PARK, { v: 0 }); }
    for (const m of this.mats) m.next = 1 + this.rng() * 5;
    this.dirty = true;
    this.events.push({ t: 'shift', phase: 'shift', day: this.day });
  }

  // ---- the clock -------------------------------------------------------------

  addBall(s) {
    if (this.balls.size >= SIM.MAX_BALLS) return null;
    const b = { id: this.nextBall++, ...s, rest: false, acc: 0 };
    this.balls.set(b.id, b);
    this.events.push({ t: 'spawn', id: b.id, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz });
    return b;
  }

  tick(dt) {
    const now = this.now();
    if (this.phase === 'shift') {
      this.shiftT += dt;
      const n = activeMats(this.onlineCount());
      for (let i = 0; i < n; i++) {
        const m = this.mats[i];
        if ((m.next -= dt) <= 0 && this.balls.size < SIM.MAX_BALLS) {
          this.addBall(launch(m, this.rng));
          m.next = swingGap(this.rng) * this.perks.swingGapMult;
        }
      }
    }

    this.stepHelpers(dt);

    const c = this.cart;
    for (const b of this.balls.values()) {
      if (b.rest) continue;
      const x0 = b.x, y0 = b.y, z0 = b.z;
      const stopped = advanceBall(b, dt);
      if (c && !b.pinged && ballHitsCart(x0, y0, z0, b, c)) { this.ping(b); continue; }
      for (const p of [...this.players.values(), ...this.helpers]) {
        if (!p.helper && this.driving(p)) continue;            // the cage keeps the driver safe
        if (b.by === p.id) continue;                           // your own swing leaves from your feet
        if (!ballHitsPlayer(x0, y0, z0, b, p)) continue;
        this.knockDown(p);
        b.vx *= -0.25; b.vz *= -0.25; b.vy = Math.abs(b.vy) * 0.3;  // it bounces off you
        break;
      }
      if (stopped) this.events.push({ t: 'rest', id: b.id, x: b.x, z: b.z });
    }

    if (c) {
      if (c.boostT > 0) c.boostT = Math.max(0, c.boostT - dt);
      const d = c.driver && this.players.get(c.driver);
      if (c.driver && (!d || (d.online === 0 && now - d.seenAt > DRIVER_GRACE_MS))) { c.driver = null; c.v = 0; }
      // Pull up to the stand and the hopper empties itself.
      if (c.load > 0 && Math.hypot(c.x - SIM.STAND.x, c.z - SIM.STAND.z) < SIM.STAND_REACH + 2.5) {
        this.bank(c.load, c.driver ?? 'cart', 'cart');
        c.load = 0;
      }
    }

    for (const p of this.players.values()) {
      if (p.down > 0) p.down = Math.max(0, p.down - dt);
      if (p.online === 0 && now - p.seenAt > GRACE_MS) this.removePlayer(p);
    }
    for (const h of this.helpers) if (h.down > 0) h.down = Math.max(0, h.down - dt);

    if (this.phase === 'shift' && this.shiftT >= this.shiftSecs) this.endShift();
  }

  knockDown(p, by = null) {
    p.down = this.perks.knockSecs;
    if (p.helper) p.target = null;
    this.stats.knockdowns++; this.dirty = true;
    this.events.push({ t: 'knock', id: p.id, by });
    // Whatever you were carrying goes everywhere.
    for (const s of spill(p.x, p.z, p.pocket, this.rng)) this.addBall(s);
    p.pocket = 0;
  }

  removePlayer(p) {
    if (this.driving(p)) { this.cart.driver = null; this.cart.v = 0; }
    for (const s of spill(p.x, p.z, p.pocket, this.rng)) this.addBall(s);
    this.players.delete(p.id);
    this.events.push({ t: 'leave', id: p.id });
  }

  endShift() {
    this.phase = 'report';
    // Closing time: hired help and the cart turn in what they're carrying, so it counts today.
    for (const h of this.helpers) { this.bank(h.pocket, h.id, 'helper'); h.pocket = 0; h.target = null; }
    if (this.cart) { this.bank(this.cart.load, this.cart.driver ?? 'cart', 'cart'); this.cart.load = 0; this.cart.boostT = 0; }
    for (const k of Object.keys(this.stats)) this.totals[k] = (this.totals[k] ?? 0) + this.stats[k];
    this.report = { day: this.day, ...this.stats, left: this.balls.size, bank: this.cash };
    this.dirty = true;
    this.events.push({ t: 'shift', phase: 'report', day: this.day, report: this.report });
  }

  // ---- what goes over the wire ----------------------------------------------

  snapshot() {
    const c = this.cart;
    return {
      phase: this.phase, day: this.day, shiftT: Math.round(this.shiftT * 10) / 10, shiftSecs: this.shiftSecs, cash: this.cash,
      mult: this.mult,
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, color: p.color, x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3),
        pocket: p.pocket, down: +p.down.toFixed(2), online: p.online > 0, gear: p.gear, wand: p.wand,
      })),
      value: ballValue({ perks: this.perks, mult: this.mult, cart: this.cart }),
      helpers: this.helpers.map(h => ({ id: h.id, name: h.name, x: +h.x.toFixed(2), z: +h.z.toFixed(2), yaw: +h.yaw.toFixed(3), pocket: h.pocket, down: +h.down.toFixed(2) })),
      cart: c && { x: +c.x.toFixed(2), z: +c.z.toFixed(2), yaw: +c.yaw.toFixed(3), driver: c.driver, load: c.load, boost: +c.boostT.toFixed(1), mud: +c.mud.toFixed(3) },
      up: this.up,
    };
  }

  // Everything a fresh (or reconnecting) browser needs to draw the range.
  welcome(you) {
    return {
      k: 'welcome', code: this.code, you, report: this.report, s: this.snapshot(),
      balls: [...this.balls.values()].map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, rest: b.rest })),
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
    return { v: 1, code: this.code, day, cash: this.cash, totals: this.totals, up: this.up, gear: this.gearByName, savedAt: new Date(this.now()).toISOString() };
  }
}
