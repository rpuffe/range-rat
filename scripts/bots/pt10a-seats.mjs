// Playtest round 10, reviewer A (review only): three bot seats that join a LIVE crew over the real HTTP/SSE API, the
// way a browser seat does, so a 4P sofa crew can be played from one fronted browser seat.
//
//   node scripts/bots/pt10a-seats.mjs <base url> <crew code> [n=3] [--ready early|late|off] [--nobank]
//
// Each seat: joins, streams the snapshots, tracks the range balls (welcome + spawn/rest/gone), and plays a simple
// policy: an event's hands-balls first (any venue module whose snapshot has `balls`: the Gold Rush, the Tournament,
// Happy Hour), the nearest free range ball next, the nearest return when full (deposit at the main one). At the
// Last Bucket huddle it walks to the stand and holds. At a report it signs a ready promotion and presses Ready
// (`--ready early`: at once; `late`: 25 s in; `off`: never). It never fights MOW-E (the human seat decides the boss).
// Writes a one-line status every 10 s to stdout. No game file is touched.
const [base, code, nArg] = process.argv.slice(2);
const N = +(nArg ?? 3);
const opt = (k, d) => { const i = process.argv.indexOf(k); return i < 0 ? d : process.argv[i + 1]; };
const READY = opt('--ready', 'early');
const FIGHT = process.argv.includes('--fight');   // fight MOW-E: wand, its back, the plug (the rematch)
const REPO = new URL('../../', import.meta.url).href;
const { nearestReturn } = await import(REPO + 'web/js/layout.js');
const { SIM, gearPerks } = await import(REPO + 'web/js/sim.js');
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const CREDS = (await import('node:path')).join((await import('node:os')).tmpdir(), 'pt10a-seats-' + code + '.json');
const SAVED = existsSync(CREDS) ? JSON.parse(readFileSync(CREDS, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(path, body) {
  const r = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, json: await r.json().catch(() => ({})) };
}

class Seat {
  constructor(i) { this.i = i; this.name = ['Sofa B', 'Sofa C', 'Sofa D'][i] ?? 'Sofa ' + i; this.balls = new Map(); this.s = null; this.acts = []; this.claim = null; this.readyAtPhase = null; this.sent = {}; }
  me() { return this.s?.players.find(p => p.id === this.p); }
  async join() {
    const r = await post(`/api/crew/${code}/join`, { name: this.name, ...(SAVED[this.i] ?? {}) });
    if (r.status !== 200) throw new Error('join ' + r.status + ' ' + JSON.stringify(r.json));
    this.p = r.json.p; this.k = r.json.k; SAVED[this.i] = { p: this.p, k: this.k }; writeFileSync(CREDS, JSON.stringify(SAVED));
    this.stream();
  }
  async stream() {
    for (;;) {
      try {
        const res = await fetch(`${base}/api/crew/${code}/stream?p=${this.p}&k=${this.k}`);
        const rd = res.body.getReader(); let buf = '';
        for (;;) {
          const { value, done } = await rd.read(); if (done) break;
          buf += Buffer.from(value).toString();
          let i; while ((i = buf.indexOf('\n\n')) >= 0) { const chunk = buf.slice(0, i); buf = buf.slice(i + 2); for (const line of chunk.split('\n')) if (line.startsWith('data: ')) this.onMsg(JSON.parse(line.slice(6))); }
        }
      } catch (e) { /* reconnect */ }
      await sleep(1000);
    }
  }
  onMsg(m) {
    if (m.k === 'welcome') { this.s = m.s; this.balls = new Map(m.balls.filter(b => b.rest).map(b => [b.id, b])); if (!this.pos) { const me = this.me(); this.pos = { x: me.x, z: me.z }; } return; }
    if (m.k !== 'tick') return;
    const prevPhase = this.s?.phase; this.s = m.s;
    for (const e of m.ev ?? []) {
      if (e.t === 'rest' && !e.one) this.balls.set(e.id, { id: e.id, x: e.x, z: e.z });
      else if (e.t === 'gone') this.balls.delete(e.id);
      else if (e.t === 'shift') this.balls.clear();
    }
    if (prevPhase !== this.s.phase) { this.readyAtPhase = Date.now(); this.sent = {}; }
    const me = this.me(); if (me && (!this.pos || Math.hypot(me.x - this.pos.x, me.z - this.pos.z) > 3)) this.pos = { x: me.x, z: me.z };   // the server corrected us
  }
  step(dt) {
    const s = this.s, me = this.me(); if (!s || !me || !this.pos) return null;
    if (s.phase === 'report' || s.phase === 'lobby') {
      const t = (Date.now() - (this.readyAtPhase ?? Date.now())) / 1000;
      if (s.promo?.ready && !this.sent.sign) { this.sent.sign = 1; this.acts.push({ t: 'sign', on: true }); }
      if (s.phase === 'report' && READY !== 'off' && !this.sent.ready && t > (READY === 'early' ? 1.5 : 25)) { this.sent.ready = 1; this.acts.push({ t: 'start' }); }
      if (this.sent.ready && !me.ready && t > 5 && (t | 0) % 5 === 0 && this.lastRe !== (t | 0)) { this.lastRe = t | 0; this.acts.push({ t: 'start' }); }   // a press lost in a held report
      return { x: this.pos.x, z: this.pos.z };
    }
    if (s.phase !== 'shift' || me.down > 0) return { x: this.pos.x, z: this.pos.z };
    const pk = me.pocket ?? 0, cap = gearPerks(me.gear ?? 0).pocket;
    let tgt = null, mode = 'idle';
    const lb = s.lastBucket;
    if (lb && (lb.phase === 'huddle' || lb.phase === 'carried')) {
      tgt = { x: SIM.STAND.x + Math.cos(this.i * 2.1) * 1.6, z: SIM.STAND.z + 1.5 + Math.sin(this.i * 2.1) * 1.0 }; mode = 'huddle';
      if (!this.sent.hold && Math.hypot(this.pos.x - tgt.x, this.pos.z - tgt.z) < 0.6) { this.sent.hold = 1; this.acts.push({ t: 'hold', on: true }); }
    }
    const g = s.gary; if (!tgt && g && g.phase === 'drive' && g.to) { tgt = { x: SIM.STAND.x + Math.cos(this.i * 2.1) * 3, z: SIM.STAND.z + 2 + Math.sin(this.i * 2.1) * 2 }; mode = 'garyhuddle'; }
    const m = s.mower;
    if (!tgt && FIGHT && m && m.kind === 'boss' && !['warn', 'fled', 'tamed', 'gone', 'home'].includes(m.phase) && Math.hypot(m.x - 36, m.z - 3) < 80) {
      const sx = Math.sin(m.yaw), cz = Math.cos(m.yaw), a = (this.i - 1) * 0.5;
      if (m.phase === 'plug') { tgt = { x: m.x + sx * 2.4, z: m.z + cz * 2.4 }; mode = 'plug'; if (!this.holdOn && Math.hypot(this.pos.x - tgt.x, this.pos.z - tgt.z) < 1.8) { this.holdOn = 1; this.acts.push({ t: 'hold', on: true }); } }
      else if (!me.wand) { tgt = { x: 36, z: 3 }; mode = 'getwand'; if (Math.hypot(this.pos.x - 36, this.pos.z - 3) < 2) this.acts.push({ t: 'wand' }); }
      else { const bx = Math.sin(m.yaw + a), bz = Math.cos(m.yaw + a); tgt = { x: m.x + bx * 4.5, z: m.z + bz * 4.5 }; mode = 'hose'; if (Math.hypot(this.pos.x - m.x, this.pos.z - m.z) < 7.5) this.acts.push({ t: 'wash', secs: 0.066, target: 'mower' }); }
    } else if (this.holdOn) { this.holdOn = 0; this.acts.push({ t: 'hold', on: false }); }
    let held = 0;
    for (const v of Object.values(s.mods ?? {})) if (v && typeof v === 'object' && v.held?.[this.p]) held += v.held[this.p];
    if (!tgt && (held > 0 || pk >= cap)) { const r = nearestReturn(this.pos.x, this.pos.z, s.up?.returns ?? 0); tgt = r; mode = 'return'; }
    if (!tgt) {   // an event's hands-balls: split them (seat i takes the i-th nearest unclaimed one, by a shared rule)
      const ev = [];
      for (const v of Object.values(s.mods ?? {})) if (v && Array.isArray(v.balls)) for (const b of v.balls) if (!b.pond && (b.t ?? 9) > 0) ev.push(b);
      if (ev.length) {
        // everyone online (humans too) ranks by distance; this seat takes the ball where it is the nearest free Rat
        const rats = s.players.filter(p => p.online && p.down <= 0), taken = new Set(); let mine = null;
        const pairs = []; for (const b of ev) for (const p of rats) pairs.push({ b, p, d: Math.hypot(b.x - p.x, b.z - p.z) });
        pairs.sort((a, b) => a.d - b.d); const used = new Set();
        for (const q of pairs) { if (taken.has(q.b.id) || used.has(q.p.id)) continue; taken.add(q.b.id); used.add(q.p.id); if (q.p.id === this.p) mine = q.b; }
        if (mine) { tgt = mine; mode = 'event'; if (Math.hypot(this.pos.x - mine.x, this.pos.z - mine.z) < 1.6) this.acts.push({ t: 'pickup', ball: mine.id }); }
      }
    }
    if (!tgt && pk < cap) {
      let best = null, bd = 1e9;
      for (const b of this.balls.values()) { if (Math.abs(b.x) > 140 || b.z < -170 || b.z > -4) continue; const d = Math.hypot(b.x - this.pos.x, b.z - this.pos.z) + (b.claimBy && b.claimBy !== this.i ? 30 : 0); if (d < bd) { bd = d; best = b; } }
      if (best) { tgt = best; mode = 'ball'; best.claimBy = this.i; if (bd < 1.4) this.acts.push({ t: 'pickup', ball: best.id }); }
      else if (pk > 0) { tgt = nearestReturn(this.pos.x, this.pos.z, s.up?.returns ?? 0); mode = 'return'; }
    }
    this.mode = mode;
    if (!tgt) return { x: this.pos.x, z: this.pos.z };
    const dx = tgt.x - this.pos.x, dz = tgt.z - this.pos.z, d = Math.hypot(dx, dz), sp = 4.4 * dt;
    if (mode === 'return' && d < 1.2) { this.acts.push({ t: 'deposit' }); this.acts.push({ t: 'feed' }); }
    if (d > 0.05) { const k = Math.min(1, sp / d); this.pos.x += dx * k; this.pos.z += dz * k; this.yaw = Math.atan2(-dx, -dz); }
    return { x: this.pos.x, z: this.pos.z, yaw: this.yaw };
  }
  async send(dt) {
    const pos = this.step(dt); if (!pos || this.busy) return;
    this.busy = true; const a = this.acts.splice(0, 8);
    try { const r = await post(`/api/crew/${code}/input`, { p: this.p, k: this.k, a, ...pos }); for (const id of r.json?.denied ?? []) this.balls.delete(id); } catch {}
    this.busy = false;
  }
}

const seats = [];
for (let i = 0; i < N; i++) { const s = new Seat(i); await s.join(); seats.push(s); }
console.log(`[seats] ${N} joined ${code}: ${seats.map(s => s.p).join(',')} ready=${READY}`);
let last = Date.now(), lastLog = 0;
setInterval(() => {
  const now = Date.now(), dt = Math.min(0.2, (now - last) / 1000); last = now;
  for (const s of seats) s.send(dt);
  if (now - lastLog > 10000) { lastLog = now; const s0 = seats[0].s; console.log(`[seats] ${new Date().toISOString().slice(11, 19)} ${s0?.phase} d${s0?.day} v${s0?.venue}.${s0?.venueDay} t${s0?.shiftT} $${Math.round(s0?.cash ?? 0)} ` + seats.map(s => `${s.name}:${s.mode ?? '-'}/${s.me()?.pocket ?? '?'}${s.me()?.ready ? 'R' : ''}`).join(' ')); }
}, 66);
