// Playtest round 10, reviewer A (review only): the reviewer's own fronted Edge window, held open over CDP, with a tiny
// control server so successive commands drive the same page. The CDP approach is scripts/smoke.mjs's (copied, not
// imported: smoke runs on import).
//
//   node scripts/bots/pt10a-drive.mjs --base http://localhost:8611 --cdp 9611 --ctl 7611 --profile <dir>
//   then: POST :7611/seat {code,p,k}     load the seat in the tab (sessionStorage) and open /?debug&perf
//         POST :7611/eval {expr, timeout} evaluate in the page (awaitPromise, returnByValue)
//         POST :7611/shot {name}          save design/shots/<name>.jpg (fronted first)
// The page gets scripts/bots/pt10a-page.js on every new document (the fake pad, the centre log, the pad autopilot).
import { spawn } from 'node:child_process';
import { request, createServer as httpServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d = null) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
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
          if (op === 0x9) continue;   // ping: the browser doesn't need a pong on a debugging socket
          if (op === 0x1 || op === 0x0) { parts.push(Buffer.from(payload)); if (fin) { const s = Buffer.concat(parts).toString(); parts = []; ws.onmessage?.(s); } }
        }
      });
      sock.on('close', () => ws.onclose?.());
      resolve(ws);
    });
    req.end();
  });
}

// ---------------------------------------------------------------- the DevTools protocol over it
async function cdp(wsUrl) {
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
const http = (method, url, body) => new Promise((resolve, reject) => {
  const u = new URL(url), data = body === undefined ? null : Buffer.from(JSON.stringify(body));
  const req = request({ method, host: u.hostname, port: u.port, path: u.pathname + u.search, headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : {} }, res => {
    const c = []; res.on('data', d => c.push(d)); res.on('end', () => { const t = Buffer.concat(c).toString(); try { resolve({ status: res.statusCode, json: JSON.parse(t) }); } catch { resolve({ status: res.statusCode, text: t }); } });
  });
  req.on('error', reject); if (data) req.write(data); req.end();
});
const freePort = () => new Promise(r => { const s = createServer(); s.listen(0, () => { const p = s.address().port; s.close(() => r(p)); }); });

const base = opt('--base'), cdpPort = +opt('--cdp', '9611'), ctlPort = +opt('--ctl', '7611'), profile = opt('--profile');
const exe = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
spawn(exe, [`--remote-debugging-port=${cdpPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,800',
  '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `${base}/healthz`], { stdio: 'ignore', detached: true }).unref();
let ver = null;
for (let i = 0; i < 100 && !ver; i++) { try { ver = (await http('GET', `http://127.0.0.1:${cdpPort}/json/version`)).json; } catch {} if (!ver) await sleep(150); }
const list = (await http('GET', `http://127.0.0.1:${cdpPort}/json/list`)).json;
const tgt = list.find(t => t.type === 'page');
const page = await cdp(tgt.webSocketDebuggerUrl);
await page.send('Page.enable'); await page.send('Runtime.enable');
await page.send('Page.addScriptToEvaluateOnNewDocument', { source: readFileSync(join(ROOT, 'scripts/bots/pt10a-page.js'), 'utf8') });
const consoleLog = [];
page.on(m => { if (m.method === 'Runtime.consoleAPICalled' && ['warning', 'error'].includes(m.params.type)) { consoleLog.push(new Date().toISOString().slice(11, 19) + ' ' + m.params.type + ' ' + m.params.args.map(a => a.value ?? a.description ?? '').join(' ').slice(0, 300)); if (consoleLog.length > 500) consoleLog.shift(); } });
const ev = async (expr, timeout = 30000) => {
  const r = await Promise.race([page.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout }), sleep(timeout + 5000).then(() => ({ result: { value: 'TIMEOUT' } }))]);
  if (r.exceptionDetails) return 'EXC ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result?.value;
};
const read = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => { try { r(JSON.parse(Buffer.concat(c).toString() || '{}')); } catch { r({}); } }); });
httpServer(async (req, res) => {
  const body = await read(req); let out;
  try {
    if (req.url === '/seat') {
      await page.send('Page.navigate', { url: base + '/healthz' }); await sleep(800);
      await ev(`sessionStorage.setItem('range-rat.seat', ${JSON.stringify(JSON.stringify(body.seat))}); ${body.clearHints ? "localStorage.removeItem('rangerat.hints.v1');" : ''} true`);
      await page.send('Page.bringToFront');
      await page.send('Page.navigate', { url: base + '/?debug&perf' + (body.query ?? '') });
      out = 'ok';
    } else if (req.url === '/eval') out = await ev(body.expr, body.timeout ?? 30000);
    else if (req.url === '/shot') {
      await page.send('Page.bringToFront');
      const r = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
      writeFileSync(join(ROOT, 'design/shots', body.name + '.jpg'), Buffer.from(r.data, 'base64')); out = 'saved ' + body.name;
    } else if (req.url === '/front') { await page.send('Page.bringToFront'); out = 'ok'; }
    else if (req.url === '/console') out = consoleLog.splice(0);
    else if (req.url === '/cdp') out = await page.send(body.method, body.params ?? {});
    else out = 'unknown';
  } catch (e) { out = 'ERR ' + e.message; }
  res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(out));
}).listen(ctlPort, () => console.log(`[drive] ctl :${ctlPort} cdp :${cdpPort} page ${tgt.id}`));
