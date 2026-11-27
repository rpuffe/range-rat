// Playtest round 10, reviewer B (solo): a persistent driver for ONE headful Edge seat on the live client.
// It starts its own game server (RR_DEV=1) and Edge (its own --user-data-dir), then serves a tiny control API so a
// reviewer can drive the seat step by step:
//   node scripts/bots/pt10b-drv.mjs --port 8731 --cdp 9731 --ctl 8732
//   GET  /new?preset=muni3[&day=+1][&fresh=1]   a dev crew from a preset (or fresh=1: a brand-new crew via the menu)
//   POST /eval   (body: JS expression, awaited)  -> JSON value
//   GET  /shot?name=pt10-B-x                     -> design/shots/<name>.jpg
// Zero dependencies; the WebSocket/CDP client is smoke.mjs's.
import { spawn } from 'node:child_process';
import { request, createServer as httpServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const PORT = +opt('--port', 8731), CDP = +opt('--cdp', 9731), CTL = +opt('--ctl', 8732);
const PROFILE = opt('--profile', join(process.env.TEMP ?? '/tmp', 'rr-pt10b-profile'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function wsConnect(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url), key = randomBytes(16).toString('base64');
    const req = request({ host: u.hostname, port: u.port, path: u.pathname + u.search, headers: { Connection: 'Upgrade', Upgrade: 'websocket', 'Sec-WebSocket-Version': '13', 'Sec-WebSocket-Key': key } });
    req.on('error', reject);
    req.on('upgrade', (res, sock) => {
      let buf = Buffer.alloc(0), parts = [];
      const ws = { onmessage: null,
        send(text) {
          const data = Buffer.from(text), mask = randomBytes(4), n = data.length;
          const head = n < 126 ? Buffer.from([0x81, 0x80 | n]) : n < 65536 ? Buffer.from([0x81, 0xfe, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 0xff, 0, 0, 0, 0]), (() => { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; })()]);
          for (let i = 0; i < n; i++) data[i] ^= mask[i & 3];
          sock.write(Buffer.concat([head, mask, data]));
        } };
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
          if (op === 0x1 || op === 0x0) { parts.push(Buffer.from(payload)); if (fin) { const s = Buffer.concat(parts).toString(); parts = []; ws.onmessage?.(s); } }
        }
      });
      resolve(ws);
    });
    req.end();
  });
}
async function cdp(wsUrl) {
  const ws = await wsConnect(wsUrl);
  let id = 0; const wait = new Map();
  ws.onmessage = s => { const m = JSON.parse(s); if (m.id && wait.has(m.id)) { const w = wait.get(m.id); wait.delete(m.id); m.error ? w.reject(new Error(m.error.message)) : w.resolve(m.result); } };
  return { send: (method, params = {}) => new Promise((resolve, reject) => { const i = ++id; wait.set(i, { resolve, reject }); ws.send(JSON.stringify({ id: i, method, params })); }) };
}
const http = (method, url, body) => new Promise((resolve, reject) => {
  const u = new URL(url), data = body === undefined ? null : Buffer.from(JSON.stringify(body));
  const req = request({ method, host: u.hostname, port: u.port, path: u.pathname + u.search, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {} }, res => {
    const c = []; res.on('data', d => c.push(d)); res.on('end', () => { const t = Buffer.concat(c).toString(); try { resolve({ status: res.statusCode, json: JSON.parse(t) }); } catch { resolve({ status: res.statusCode, text: t }); } });
  });
  req.on('error', reject); if (data) req.write(data); req.end();
});

const base = `http://localhost:${PORT}`;
// never attach to someone else's server or browser: every port must be free before we start
const { createServer: netServer } = await import('node:net');
for (const p of [PORT, CDP, CTL]) { const free = await new Promise(r => { const t = netServer(); t.once('error', () => r(false)); t.listen(p, () => t.close(() => r(true))); }); if (!free) { console.error('port busy: ' + p); process.exit(2); } }
const server = spawn(process.execPath, [join(ROOT, 'server', 'server.mjs')], { env: { ...process.env, PORT: String(PORT), RR_DEV: '1' }, stdio: ['ignore', 'inherit', 'inherit'] });
for (let i = 0; i < 100; i++) { try { if ((await http('GET', base + '/healthz')).status === 200) break; } catch {} await sleep(100); }
mkdirSync(PROFILE, { recursive: true });
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [`--remote-debugging-port=${CDP}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check',
  '--window-size=1280,800', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
let tabs = null;
for (let i = 0; i < 100 && !tabs; i++) { try { const r = await http('GET', `http://127.0.0.1:${CDP}/json/list`); if (Array.isArray(r.json)) tabs = r.json; } catch {} await sleep(150); }
const t0 = tabs.find(t => t.type === 'page');
let pageP = cdp(t0.webSocketDebuggerUrl);
// a hung renderer (and its reload) can drop the session: every call races a deadline, and a dead session is replaced
const page = { async send(m, p, ms = 620000) { const s = await pageP; try { return await Promise.race([s.send(m, p), sleep(ms).then(() => { throw new Error('cdp timeout ' + m); })]); } catch (e) { pageP = cdp(t0.webSocketDebuggerUrl); throw e; } } };
await page.send('Page.enable'); await page.send('Runtime.enable');
await page.send('Page.bringToFront');

const ev = async (expr, timeout = 600000) => {
  const r = await page.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout }, timeout + 15000);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
let seatScript = null;
async function newCrew(q) {
  if (seatScript) await page.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seatScript }).catch(() => {});
  seatScript = null;
  if (q.get('fresh')) {
    // a new crew the way a player makes one: the menu, with the hints cleared
    await page.send('Page.navigate', { url: `${base}/?debug&perf` });
    await sleep(2500);
    await ev("try { localStorage.removeItem('rangerat.hints.v1'); sessionStorage.clear(); } catch {} ; true");
    await page.send('Page.navigate', { url: `${base}/?debug&perf` });
    return { fresh: true };
  }
  const file = JSON.parse(readFileSync(q.get('file') ?? join(ROOT, 'server', 'presets', `${q.get('preset')}.json`), 'utf8'));
  const save = structuredClone(file.save ?? file);
  const dd = +(q.get('day') ?? 0); if (dd) { save.day += dd; save.venueDay += dd; }
  const made = await http('POST', base + '/api/dev/crew', { name: q.get('name') ?? 'Solo', save });
  if (made.status !== 200) throw new Error('dev/crew ' + made.status + ' ' + (made.text ?? JSON.stringify(made.json)));
  const seat = { code: made.json.code, p: made.json.p, k: made.json.k };
  seatScript = (await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { sessionStorage.setItem('range-rat.seat', ${JSON.stringify(JSON.stringify(seat))}); ${q.get('hints') ? "localStorage.removeItem('rangerat.hints.v1');" : ''} } catch {}` })).identifier;
  await page.send('Page.navigate', { url: `${base}/?debug&perf` });
  for (let i = 0; i < 600; i++) { try { if (await ev('!!(window.rr && window.rr.crew && window.rr.crew.phase && window.__centre)', 5000)) break; } catch {} await sleep(100); }
  return seat;
}

httpServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); let body = '';
  for await (const c of req) body += c;
  const out = v => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(v ?? null)); };
  try {
    if (u.pathname === '/new') return out(await newCrew(u.searchParams));
    if (u.pathname === '/eval') return out(await ev(body, +(u.searchParams.get('ms') ?? 60000)));
    if (u.pathname === '/front') { await page.send('Page.bringToFront'); return out(true); }
    if (u.pathname === '/key') {   // a real key event through the browser's input pipeline
      const code = u.searchParams.get('code'), type = u.searchParams.get('type') ?? 'both';
      const key = code === 'Space' ? ' ' : code.replace(/^Key/, '').toLowerCase();
      const kc = { Space: 32, Escape: 27, Enter: 13, Tab: 9 }[code] ?? key.toUpperCase().charCodeAt(0);
      if (type !== 'up') await page.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key, windowsVirtualKeyCode: kc });
      if (type === 'both') await sleep(+(u.searchParams.get('ms') ?? 80));
      if (type !== 'down') await page.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key, windowsVirtualKeyCode: kc });
      return out(true);
    }
    if (u.pathname === '/shot') {
      const r = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
      const f = join(ROOT, 'design', 'shots', `${u.searchParams.get('name')}.jpg`);
      writeFileSync(f, Buffer.from(r.data, 'base64')); return out(f);
    }
    if (u.pathname === '/quit') { out(true); edge.kill(); server.kill(); setTimeout(() => process.exit(0), 300); return; }
    out({ error: 'unknown' });
  } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
}).listen(CTL, () => console.log(`pt10b driver: game ${base}, cdp ${CDP}, control http://127.0.0.1:${CTL}`));
