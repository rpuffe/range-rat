// A crew: up to 6 players sharing one range. The server owns everything that
// players could fight over (balls, pockets, cash, the shift clock); a player's
// own position is theirs to report, clamped to a plausible walking speed.

import crypto from 'node:crypto';
import { SIM, MATS, activeMats, mulberry32, swingGap, launch, spill, advanceBall, ballHitsPlayer, atStand, clampToField } from '../web/js/sim.js';

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: codes get read aloud
export const CODE_LEN = 4;
const COLORS = ['#e8604c', '#4c9be8', '#f2c94c', '#6fcf7c', '#b07ce8', '#f29e4c'];
const GRACE_MS = 60_000;          // an offline player keeps their spot this long (page reloads)
const NAME_MAX = 16;

export const newCode = () => Array.from(crypto.randomBytes(CODE_LEN), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
export const validCode = c => typeof c === 'string' && c.length === CODE_LEN && [...c].every(ch => CODE_CHARS.includes(ch));

export function cleanName(s) {
  s = String(s ?? '').replace(/[\p{C}]/gu, '').trim();
  return [...s].slice(0, NAME_MAX).join('').trim();
}

const freshStats = () => ({ picked: 0, deposited: 0, cash: 0, knockdowns: 0 });

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
      pocket: 0, down: 0, online: 0, seenAt: this.now(), movedAt: this.now(),
    };
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

  // ---- inputs ----------------------------------------------------------------

  input(p, msg) {
    const now = this.now();
    p.seenAt = now; this.lastActive = now;
    const denied = [];
    if (Number.isFinite(msg.x) && Number.isFinite(msg.z) && p.down <= 0) {
      // Trust the reported position up to a generous walking speed.
      const dt = Math.min(1, Math.max(0.05, (now - p.movedAt) / 1000));
      const max = SIM.WALK * 1.5 * dt + 0.5;
      let dx = msg.x - p.x, dz = msg.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > max) { dx *= max / d; dz *= max / d; }
      p.x += dx; p.z += dz; clampToField(p);
      p.movedAt = now;
    }
    if (Number.isFinite(msg.yaw)) p.yaw = msg.yaw;
    for (const a of Array.isArray(msg.a) ? msg.a.slice(0, 8) : []) {
      if (a?.t === 'pickup' && !this.pickup(p, a.ball)) denied.push(a.ball);
      else if (a?.t === 'deposit') this.deposit(p);
      else if (a?.t === 'start') this.startShift();
    }
    return { denied };
  }

  pickup(p, id) {
    const b = this.balls.get(id);
    if (!b || p.down > 0 || p.pocket >= SIM.POCKET || this.phase === 'lobby') return false;
    if (b.y > 0.4) return false;                           // still in the air
    if (Math.hypot(b.x - p.x, b.z - p.z) > SIM.REACH + 1) return false;  // slack for a rolling ball
    this.balls.delete(id);
    p.pocket++; this.stats.picked++; this.dirty = true;
    this.events.push({ t: 'gone', id, by: p.id });
    return true;
  }

  deposit(p) {
    if (p.pocket <= 0 || p.down > 0 || !atStand(p)) return;
    const n = p.pocket, cash = n * SIM.BALL_PRICE;
    p.pocket = 0;
    this.cash += cash; this.stats.deposited += n; this.stats.cash += cash; this.dirty = true;
    this.events.push({ t: 'cash', by: p.id, n, cash });
  }

  startShift() {
    if (this.phase === 'shift') return;
    if (this.phase === 'report') this.day++;
    // The night crew clears the field: every morning starts clean.
    for (const id of this.balls.keys()) this.events.push({ t: 'gone', id });
    this.balls.clear();
    this.phase = 'shift'; this.shiftT = 0; this.stats = freshStats(); this.report = null;
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
        if ((m.next -= dt) <= 0) { this.addBall(launch(m, this.rng)); m.next = swingGap(this.rng); }
      }
    }

    for (const b of this.balls.values()) {
      if (b.rest) continue;
      const x0 = b.x, y0 = b.y, z0 = b.z;
      const stopped = advanceBall(b, dt);
      for (const p of this.players.values()) {
        if (!ballHitsPlayer(x0, y0, z0, b, p)) continue;
        this.knockDown(p);
        b.vx *= -0.25; b.vz *= -0.25; b.vy = Math.abs(b.vy) * 0.3;  // it bounces off you
        break;
      }
      if (stopped) this.events.push({ t: 'rest', id: b.id, x: b.x, z: b.z });
    }

    for (const p of this.players.values()) {
      if (p.down > 0) p.down = Math.max(0, p.down - dt);
      if (p.online === 0 && now - p.seenAt > GRACE_MS) this.removePlayer(p);
    }

    if (this.phase === 'shift' && this.shiftT >= this.shiftSecs) this.endShift();
  }

  knockDown(p) {
    p.down = SIM.KNOCK_SECS;
    this.stats.knockdowns++; this.dirty = true;
    this.events.push({ t: 'knock', id: p.id });
    // Whatever you were carrying goes everywhere.
    for (const s of spill(p.x, p.z, p.pocket, this.rng)) this.addBall(s);
    p.pocket = 0;
  }

  removePlayer(p) {
    for (const s of spill(p.x, p.z, p.pocket, this.rng)) this.addBall(s);
    this.players.delete(p.id);
    this.events.push({ t: 'leave', id: p.id });
  }

  endShift() {
    this.phase = 'report';
    for (const k of Object.keys(this.stats)) this.totals[k] = (this.totals[k] ?? 0) + this.stats[k];
    this.report = { day: this.day, ...this.stats, left: this.balls.size, bank: this.cash };
    this.dirty = true;
    this.events.push({ t: 'shift', phase: 'report', day: this.day, report: this.report });
  }

  // ---- what goes over the wire ----------------------------------------------

  snapshot() {
    return {
      phase: this.phase, day: this.day, shiftT: Math.round(this.shiftT * 10) / 10, shiftSecs: this.shiftSecs, cash: this.cash,
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, color: p.color, x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3),
        pocket: p.pocket, down: +p.down.toFixed(2), online: p.online > 0,
      })),
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
    return { v: 1, code: this.code, day, cash: this.cash, totals: this.totals, savedAt: new Date(this.now()).toISOString() };
  }
}
