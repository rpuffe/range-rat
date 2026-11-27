// Playtest round 10, reviewer C: a tiny CDP toolkit (copied from scripts/smoke.mjs's approach), shared by the
// pt10c-* scripts. Zero dependencies. A reviewer's tool: it edits nothing in the game.
//
//   env PT10C_SERVER (default http://localhost:8731), PT10C_CDP (default 9731)
import { request } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const BASE = process.env.PT10C_SERVER ?? 'http://localhost:8731';
export const CDP = Number(process.env.PT10C_CDP ?? 9731);
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const log = (...a) => console.log(`[pt10c ${new Date().toISOString().slice(11, 19)}]`, ...a);

function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), key = randomBytes(16).toString('base64');
    const req = request({ host: u.hostname, port: u.port, path: u.pathname + u.search, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key } });
    req.on('error', reject);
    req.on('upgrade', (res, sock) => {
      const want = createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
      if (res.headers['sec-websocket-accept'] !== want) { reject(new Error('ws: bad accept')); sock.destroy(); return; }
      let buf = Buffer.alloc(0), parts = [];
      const ws = { onmessage: null, onclose: null,
        send(text) {
          const data = Buffer.from(text), mask = randomBytes(4), n = data.length;
          const head = n < 126 ? Buffer.from([0x81, 0x80 | n]) : n < 65536 ? Buffer.from([0x81, 0xfe, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 0xff, 0, 0, 0, 0]), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; })()]);
          for (let i = 0; i < n; i++) data[i] ^= mask[i & 3];
          sock.write(Buffer.concat([head, mask, data]));
        },
        close() { try { sock.end(Buffer.from([0x88, 0x80, 0, 0, 0, 0])); } catch {} sock.destroy(); } };
      sock.on('data', d => {
        buf = Buffer.concat([buf, d]);
        for (;;) {
          if (buf.length < 2) return;
          const fin = buf[0] & 0x80, op = buf[0] & 0x0f; let n = buf[1] & 0x7f, off = 2;
          if (n === 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); off = 4; }
          else if (n === 127) { if (buf.length < 10) return; n = Number(buf.readBigUInt64BE(2)); off = 10; }
          if (buf.length < off + n) return;
          const payload = buf.subarray(off, off + n); buf = buf.subarray(off + n);
          if (op === 0x8) { sock.destroy(); return; }
          if (op === 0x9) continue;
          if (op === 0x1 || op === 0x0) { parts.push(Buffer.from(payload)); if (fin) { const s = Buffer.concat(parts).toString(); parts = []; ws.onmessage?.(s); } }
        }
      });
      sock.on('close', () => ws.onclose?.());
      resolve(ws);
    });
    req.end();
  });
}
export async function cdp(wsUrl) {
  const ws = await wsConnect(wsUrl);
  let id = 0; const wait = new Map(), handlers = [];
  ws.onmessage = s => {
    const m = JSON.parse(s);
    if (m.id && wait.has(m.id)) { const w = wait.get(m.id); wait.delete(m.id); m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result); }
    else for (const h of handlers) h(m);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; wait.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, on: h => handlers.push(h), close: () => ws.close() };
}
export const http = (method, url, body) => new Promise((resolve, reject) => {
  const u = new URL(url), data = body === undefined ? null : Buffer.from(JSON.stringify(body));
  const req = request({ method, host: u.hostname, port: u.port, path: u.pathname + u.search, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {} }, res => {
    const c = []; res.on('data', d => c.push(d)); res.on('end', () => { const t = Buffer.concat(c).toString(); try { resolve({ status: res.statusCode, json: JSON.parse(t) }); } catch { resolve({ status: res.statusCode, text: t }); } });
  });
  req.on('error', reject); if (data) req.write(data); req.end();
});

export const PAGE_LIB = `
window.__c = {
  ids: ['story-card', 'pa-card', 'memo', 'hint', 'todo', 'toast', 'bell-stamp', 'mowe-stamp', 'endcard', 'ending-flash', 'alert', 'centre-alert'],
  up() {
    const out = [];
    for (const id of (window.__centreIds || this.ids)) {
      const el = document.getElementById(id); if (!el) continue;
      let o = 1;
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') { o = 0; break; } o *= parseFloat(cs.opacity || '1'); }
      const r = el.getBoundingClientRect();
      if (o > 0.3 && r.width > 2 && r.height > 2 && (el.textContent || '').trim()) out.push({ id, text: el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 140) });
    }
    return out;
  },
  fps(ms = 2000) { return new Promise(res => { let n = 0; const t0 = performance.now(); setTimeout(() => res(n * 1000 / (performance.now() - t0)), ms + 1000); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(n * 1000 / (performance.now() - t0)); }; requestAnimationFrame(f); }); },
  frames(ms) { return new Promise(res => { const d = []; let last = 0; const t0 = performance.now(); const f = t => { if (last) d.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else { const a = d.slice().sort((x, y) => x - y); const q = p => a[Math.min(a.length - 1, Math.max(0, Math.ceil(p * a.length) - 1))] ?? 0; res({ n: d.length, avg: d.reduce((s, x) => s + x, 0) / Math.max(1, d.length), p50: q(.5), p95: q(.95), worst: a.at(-1) ?? 0, fps: d.length * 1000 / (t - t0) }); } }; requestAnimationFrame(f); }); },
  perfText() { const p = [...document.querySelectorAll('pre')].find(e => /p95/.test(e.textContent)); return p ? p.textContent : null; },
  perfP95() { const t = this.perfText(); const m = t && /p95 ([\\d.]+)/.exec(t); return m ? +m[1] : null; },
  walkTo(x, z, r = 0.8) {
    return new Promise(res => {
      const me = window.rr.me, t0 = performance.now();
      const iv = setInterval(() => {
        const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
        if (d <= r || performance.now() - t0 > 120000) { clearInterval(iv); res(d); return; }
        const step = Math.min(d, 6 * 0.05);
        me.x += dx / d * step; me.z += dz / d * step; me.yaw = Math.atan2(-dx, -dz);
      }, 50);
    });
  },
  where() { const c = rr.crew; return { phase: c.phase, day: c.day, venue: c.venue, vd: c.venueDay, endless: !!c.endless, t: Math.round(c.shiftT ?? 0), cash: Math.round(c.cash ?? 0), mods: Object.keys(c.mods ?? {}), n: (c.players ?? []).length }; },
};
// a sampler of the centre items every 250 ms, for the whole page life: lines > 8 words and two-at-once
window.__cLog = { long: {}, multi: [], seen: {} };
setInterval(() => { try { const u = __c.up(); for (const x of u) { const w = x.text.split(/\\s+/).filter(Boolean).length; __cLog.seen[x.text] = (__cLog.seen[x.text] || 0) + 1; if (w > 8 && x.id !== 'endcard' && x.id !== 'story-card') __cLog.long[x.id + ': ' + x.text] = w; } if (u.length > 1 && __cLog.multi.length < 200) __cLog.multi.push([+(performance.now() / 1000).toFixed(1), u.map(x => x.id + ': ' + x.text.slice(0, 60))]); } catch {} }, 250);
true`;

// A virtual standard pad (the pad emulation): navigator.getGamepads returns it; __pad.press('A') taps a button.
export const PAD_SHIM = `(() => {
  const btn = () => ({ pressed: false, touched: false, value: 0 });
  const pad = { id: 'Xbox Wireless Controller (pt10c emulated)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    buttons: Array.from({ length: 17 }, btn), axes: [0, 0, 0, 0] };
  const B = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, VIEW: 8, MENU: 9, LS: 10, RS: 11, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };
  window.__pad = { pad, B,
    set(name, on) { const b = pad.buttons[B[name]]; b.pressed = on; b.value = on ? 1 : 0; pad.timestamp = performance.now(); },
    press(name, ms = 120) { this.set(name, true); return new Promise(r => setTimeout(() => { this.set(name, false); r(true); }, ms)); },
    stick(i, x, y) { pad.axes[i * 2] = x; pad.axes[i * 2 + 1] = y; pad.timestamp = performance.now(); } };
  const real = navigator.getGamepads?.bind(navigator);
  Object.defineProperty(Navigator.prototype, 'getGamepads', { configurable: true, value: function () { return [pad, null, null, null]; } });
  addEventListener('load', () => { try { const e = new Event('gamepadconnected'); e.gamepad = pad; dispatchEvent(e); } catch {} });
})();`;

export async function targets(port = CDP) { return (await http('GET', `http://127.0.0.1:${port}/json/list`)).json.filter(t => t.type === 'page'); }

// Attach to a page target by id (or the first whose URL matches `match`) and give it ev/shot helpers.
export async function attach(targetId) {
  const t = (await targets()).find(x => x.id === targetId);
  if (!t) throw new Error('no target ' + targetId);
  const page = await cdp(t.webSocketDebuggerUrl);
  await page.send('Runtime.enable');
  return wrap(page, t.id);
}
function wrap(page, id) {
  const ev = async (expr, timeout = 30000) => {
    const r = await Promise.race([page.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout }),
      sleep(timeout + 5000).then(() => { throw new Error(`page: no answer in ${timeout / 1000 + 5} s to ${expr.slice(0, 60)}`); })]);
    if (r.exceptionDetails) throw new Error(`page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  const waitFor = async (expr, secs, every = 250) => { const t0 = Date.now(); while (Date.now() - t0 < secs * 1000) { let v = null; try { v = await ev(expr); } catch {} if (v) return v; await sleep(every); } return null; };
  const shot = async name => {
    await page.send('Page.bringToFront').catch(() => {});
    const r = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
    const f = join(ROOT, 'design', 'shots', `pt10-C-${name}.jpg`); writeFileSync(f, Buffer.from(r.data, 'base64')); log('shot', f); return f;
  };
  const throttle = rate => page.send('Emulation.setCPUThrottlingRate', { rate });
  return { page, id, ev, waitFor, shot, throttle, close: () => page.close() };
}

// A seat in its own new browser WINDOW: the seat in sessionStorage, the pad shim, /?debug&perf.
export async function openSeat(seat, { pad = true, query = 'debug&perf', newWindow = true, port = CDP } = {}) {
  const ver = (await http('GET', `http://127.0.0.1:${port}/json/version`)).json;
  const br = await cdp(ver.webSocketDebuggerUrl);
  const { targetId } = await br.send('Target.createTarget', { url: 'about:blank', newWindow, ...(newWindow ? { width: 1280, height: 800 } : {}) });
  br.close();
  const t = (await targets(port)).find(x => x.id === targetId);
  const page = await cdp(t.webSocketDebuggerUrl);
  await page.send('Page.enable'); await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { sessionStorage.setItem('range-rat.seat', ${JSON.stringify(JSON.stringify(seat))}); } catch {}` });
  if (pad) await page.send('Page.addScriptToEvaluateOnNewDocument', { source: PAD_SHIM });
  await page.send('Page.bringToFront');
  await page.send('Page.navigate', { url: `${BASE}/?${query}` });
  const w = wrap(page, targetId);
  const ok = await w.waitFor('!!(window.rr && window.rr.crew && window.rr.crew.phase && window.__centre)', 90, 200);
  if (!ok) throw new Error('client never came up');
  await w.waitFor('!!(rr.crew.code || rr.crew.day > 1 || (rr.crew.players ?? []).length)', 15, 200);
  await w.ev(PAGE_LIB);
  return w;
}

export function presetSave(name, tweak = s => s) {
  const file = JSON.parse(readFileSync(join(ROOT, 'server', 'presets', `${name}.json`), 'utf8'));
  return tweak(structuredClone(file.save ?? file));
}
export async function devCrew(save, name = 'Cass') {
  const made = await http('POST', BASE + '/api/dev/crew', { name, save });
  if (made.status !== 200) throw new Error('/api/dev/crew ' + made.status + ' ' + (made.text ?? JSON.stringify(made.json)));
  return { code: made.json.code, p: made.json.p, k: made.json.k };
}
export async function joinCrew(code, name = 'Dot') {
  const r = await http('POST', `${BASE}/api/crew/${code}/join`, { name });
  if (r.status !== 200) throw new Error('join ' + r.status + ' ' + (r.text ?? JSON.stringify(r.json)));
  return { code: r.json.code, p: r.json.p, k: r.json.k };
}
export const startDay = async b => { for (let i = 0; i < 25; i++) { await b.ev('rr.startShift(), true').catch(() => {}); if (await b.waitFor("rr.crew.phase === 'shift'", 2)) return true; } throw new Error('the shift never started'); };
export const closeTarget = (id, port = CDP) => http('GET', `http://127.0.0.1:${port}/json/close/${id}`).catch(() => {});
export const SEAT2_CDP = Number(process.env.PT10C_CDP2 ?? 9732);

// A dumb in-page autoplayer for a seat (a stand-in for a friend on the other pad): nearest ball (special balls first),
// Ⓐ pickup over the link, walk it to the stand, deposit. Ball No. 1 first when it's down. Hold-to-bank: pressAct.
export const AUTO_LIB = `
window.__auto = (() => {
  const S = { on: false, state: 'seek', tgt: null, tries: 0, cap: 3, skip: new Map(), picks: 0, deps: 0, iv: null, holdBank: true };
  const STAND = { x: 27, z: 1.8 };
  const go = (x, z, r) => { const me = rr.me, dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz); if (d <= r) return true; const st = Math.min(d, 5.5 * 0.1); me.x += dx / d * st; me.z += dz / d * st; me.yaw = Math.atan2(-dx, -dz); return false; };
  const special = b => b.kind && b.kind !== 'range' && b.kind !== 'square';
  function pick() {
    const c = rr.crew, me = rr.me, now = performance.now();
    if (c.lastBucket?.phase === 'down') { const one = [...rr.balls.values()].find(b => b.kind === 'one'); if (one) return one; }
    let best = null, bd = 1e9;
    for (const b of rr.balls.values()) {
      if (!b.rest || b.hidden || b.sunk || b.creek || b.drifting || b.y > 0.4 || b.kind === 'one') continue;
      if ((S.skip.get(b.id) ?? 0) > now) continue;
      const d = Math.hypot(b.x - me.x, b.z - me.z) - (special(b) ? 80 : 0);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  function step() {
    try {
      const c = rr.crew, me = rr.me; if (!S.on || !c || c.phase !== 'shift' || me.down > 0) return;
      if (me.diving || me.creek) { if (S.tgt) { S.skip.set(S.tgt.id, performance.now() + 600000); for (const b of rr.balls.values()) if (Math.hypot(b.x - me.x, b.z - me.z) < 25) S.skip.set(b.id, performance.now() + 600000); S.tgt = null; } go(STAND.x, STAND.z, 1.6); return; }
      const lb = c.lastBucket?.phase;
      if (lb === 'huddle') { if (go(STAND.x, STAND.z, 1.5)) { rr.pressAct?.(); } return; }
      if (me.one || lb === 'carried' && c.lastBucket?.by === me.id) { if (go(STAND.x, STAND.z, 1.2)) rr.link.act({ t: 'deposit' }); return; }
      if (S.state === 'deposit') { if (go(STAND.x, STAND.z, 1.6)) { rr.link.act({ t: 'deposit' }); S.deps++; S.state = 'seek'; } return; }
      if (!S.tgt || !rr.balls.has(S.tgt.id) || !rr.balls.get(S.tgt.id).rest) { S.tgt = pick(); S.tries = 0; if (!S.tgt) { if (me.pocket > 0) S.state = 'deposit'; return; } }
      const b = rr.balls.get(S.tgt.id) ?? S.tgt;
      if (go(b.x, b.z, 0.9)) {
        const before = me.pocket;
        rr.link.act({ t: 'pickup', ball: b.id }); S.tries++; S.picks++;
        if (special(b) || b.kind === 'one') { S.state = 'deposit'; S.tgt = null; return; }
        if (S.tries > 4) { S.skip.set(b.id, performance.now() + 20000); S.tgt = null; if (me.pocket > 0) { S.cap = Math.max(1, me.pocket); S.state = 'deposit'; } }
        if (me.pocket >= S.cap + 6) S.state = 'deposit';
        setTimeout(() => { if (rr.me.pocket >= S.cap) S.cap = rr.me.pocket; if (rr.me.pocket > 0 && rr.me.pocket === before && S.tries > 2) S.state = 'deposit'; }, 300);
      }
    } catch (e) { S.err = String(e); }
  }
  S.start = () => { S.on = true; if (!S.iv) S.iv = setInterval(step, 100); return true; };
  S.stop = () => { S.on = false; return true; };
  return S;
})(); true`;
