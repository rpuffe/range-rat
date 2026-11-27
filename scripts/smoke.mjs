// Council round 14 #0e (builder 4): the smoke run. One headful browser seat drives five scripted beats on the LIVE
// client and asserts what a player would see. The lead runs it before the review loop (council-round14.md §4.1); it
// exits 1 on any failed assertion, and the candidate isn't reviewed until it exits 0.
//
//   node scripts/smoke.mjs [--only boss,rush,happy,crash,bank] [--url http://localhost:8094] [--browser <exe>]
//                          [--headless] [--min-fps 20] [--keep]
//
// Zero dependencies: it starts the game server (RR_DEV=1, a free port) unless --url is given, launches Edge or Chrome
// with --remote-debugging-port, and talks the DevTools protocol over a tiny WebSocket client below (Node 20 has no
// global WebSocket). Each beat makes a fresh dev crew from a preset (POST /api/dev/crew), puts the seat in the tab's
// sessionStorage and loads /?debug&perf, so window.rr and window.__centre (the widened zone, #0d) are live.
//
// The beats (each on its own crew, in real time: a full run takes ~15 minutes):
//   boss   Club day 3 (club2 + one day): the `mower` root moves ≥ 10 m within 20 s of showing up.
//   rush   Muni day 3 (muni3): the Gold Rush's beams are up, and its ALERT is the only centre item.
//   happy  Tiered (tiered1): Happy Hour fires (s.mods.happyhour, and its ALERT shows).
//   crash  The Stadium's Promotion Day (stadiumPromo), an idle seat: the loss line is shown ≥ 2.5 s, alone.
//   bank   The Last Bucket (lastbucket-4p): the seat carries Ball No. 1 to the stand; through the bank to the end card,
//          __centre.overlaps === 0, and the end card is up ≥ 10 s with Ready pressed early.
// Every beat first reads the frame rate (rAF over 2 s) and fails under --min-fps (default 20): a check taken in a
// hidden or throttled pane proves nothing (round 9). The browser window must stay fronted.
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d = null) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const flag = k => args.includes(k);
const BEATS = ['boss', 'rush', 'happy', 'crash', 'bank'];
const ONLY = (opt('--only') ?? BEATS.join(',')).split(',').filter(b => BEATS.includes(b));
const MIN_FPS = Number(opt('--min-fps', '20'));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(`[smoke ${new Date().toISOString().slice(11, 19)}]`, ...a);

// ---------------------------------------------------------------- a minimal WebSocket client (RFC 6455, text only)
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

// ---------------------------------------------------------------- the run
const fails = [], passes = [];
const check = (beat, ok, what) => { (ok ? passes : fails).push(`${beat}: ${what}`); log(ok ? 'PASS' : 'FAIL', beat, what); };

let server = null, browser = null, profile = null, base = opt('--url');
async function startServer() {
  if (base) return;
  const port = await freePort();
  server = spawn(process.execPath, [join(ROOT, 'server', 'server.mjs')], { env: { ...process.env, PORT: String(port), RR_DEV: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  base = `http://localhost:${port}`;
  for (let i = 0; i < 100; i++) { try { if ((await http('GET', base + '/healthz')).status === 200) return; } catch {} await sleep(100); }
  throw new Error('the game server did not come up');
}
async function startBrowser() {
  const exe = opt('--browser') ?? ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => existsSync(p));
  if (!exe) throw new Error('no browser found: pass --browser <path to Edge or Chrome>');
  const port = await freePort();
  profile = mkdtempSync(join(tmpdir(), 'rr-smoke-'));
  browser = spawn(exe, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,800',
    '--autoplay-policy=no-user-gesture-required', ...(flag('--headless') ? ['--headless=new'] : []), 'about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 100; i++) { try { const r = await http('GET', `http://127.0.0.1:${port}/json/version`); if (r.json) return port; } catch {} await sleep(100); }
  throw new Error('the browser did not open its debugging port');
}

// In-page helpers, installed once per page.
const PAGE_LIB = `
window.__smoke = {
  up() {
    const out = [];
    for (const id of ${JSON.stringify(['story-card', 'pa-card', 'memo', 'hint', 'todo', 'toast', 'bell-stamp', 'mowe-stamp', 'endcard', 'ending-flash'])}) {
      const el = document.getElementById(id); if (!el) continue;
      let o = 1;
      for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') { o = 0; break; } o *= parseFloat(cs.opacity || '1'); }
      const r = el.getBoundingClientRect();
      if (o > 0.3 && r.width > 2 && r.height > 2 && (el.textContent || '').trim()) out.push({ id, text: el.textContent.trim().slice(0, 100) });
    }
    return out;
  },
  fps(ms = 2000) { return new Promise(res => { let n = 0; const t0 = performance.now(); setTimeout(() => res(n * 1000 / (performance.now() - t0)), ms + 1000); const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else res(n * 1000 / (performance.now() - t0)); }; requestAnimationFrame(f); }); },   // no frames (a hidden window): it still answers, with the low number
  walkTo(x, z, r = 0.8) {
    return new Promise(res => {
      const me = window.rr.me, t0 = performance.now();
      const iv = setInterval(() => {
        const dx = x - me.x, dz = z - me.z, d = Math.hypot(dx, dz);
        if (d <= r || performance.now() - t0 > 120000) { clearInterval(iv); res(d); return; }
        const step = Math.min(d, 7 * 0.05);   // 7 m/s: inside the server's sprint allowance (walk × 1.75 × 1.3)
        me.x += dx / d * step; me.z += dz / d * step; me.yaw = Math.atan2(-dx, -dz);
      }, 50);
    });
  },
};`;

async function beatPage(cdpPort, preset, tweak = s => s) {
  const file = JSON.parse(readFileSync(join(ROOT, 'server', 'presets', `${preset}.json`), 'utf8'));
  const save = tweak(structuredClone(file.save));
  const made = await http('POST', base + '/api/dev/crew', { name: 'Smoke', save });
  if (made.status !== 200) throw new Error(`/api/dev/crew: ${made.status} ${made.text ?? JSON.stringify(made.json)} (is RR_DEV set on the server?)`);
  const seat = { code: made.json.code, p: made.json.p, k: made.json.k };
  const t = await http('PUT', `http://127.0.0.1:${cdpPort}/json/new?about:blank`);
  const page = await cdp(t.json.webSocketDebuggerUrl);
  await page.send('Page.enable'); await page.send('Runtime.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { sessionStorage.setItem('range-rat.seat', ${JSON.stringify(JSON.stringify(seat))}); } catch {}` });
  await page.send('Page.bringToFront');
  await page.send('Page.navigate', { url: `${base}/?debug&perf` });
  const ev = async (expr, timeout = 30000) => {
    // a page that hangs (a navigation, a stuck promise) can't hang the run: the call races its own deadline
    const r = await Promise.race([page.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout }),
      sleep(timeout + 5000).then(() => { throw new Error(`page: no answer in ${(timeout / 1000 + 5).toFixed(0)} s to ${expr.slice(0, 60)}`); })]);
    if (r.exceptionDetails) throw new Error(`page: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  };
  let ready = false;
  for (let i = 0; i < 900 && !ready; i++) { try { ready = await ev('!!(window.rr && window.rr.crew && window.rr.crew.phase && window.__centre)'); } catch {} if (!ready) await sleep(100); }
  if (!ready) throw new Error('the client never came up (window.rr / __centre missing after 90 s: is ?debug on, did the page load?)');
  await ev(PAGE_LIB);
  const waitFor = async (expr, secs, every = 200) => { const t0 = Date.now(); while (Date.now() - t0 < secs * 1000) { const v = await ev(expr); if (v) return v; await sleep(every); } return null; };
  const close = async () => { page.close(); await http('GET', `http://127.0.0.1:${cdpPort}/json/close/${t.json.id}`).catch(() => {}); };
  return { ev, waitFor, close, seat, page };
}
// Ready (re-pressed every 2 s until the shift is on: a press during the page's first seconds can be lost); throws if not
const startDay = async b => { for (let i = 0; i < 20; i++) { await b.ev('rr.startShift(), true'); if (await b.waitFor("rr.crew.phase === 'shift'", 2)) return true; } throw new Error('the shift never started (Ready pressed for 40 s)'); };
const where = b => b.ev("JSON.stringify({ phase: rr.crew.phase, day: rr.crew.day, venue: rr.crew.venue, vd: rr.crew.venueDay, shiftT: Math.round(rr.crew.shiftT), mods: Object.keys(rr.crew.mods ?? {}) })").catch(e => e.message);
const fpsCheck = async (beat, b) => { const fps = await b.ev('__smoke.fps(2000)', 10000); check(beat, fps >= MIN_FPS, `frame rate ${fps.toFixed(1)} fps (≥ ${MIN_FPS}; front the window)`); return fps; };

const BEAT = {
  // 1. The Club day-3 boss: the mower root moves (round 9's frozen MOW-E).
  async boss(port) {
    const b = await beatPage(port, 'club2', s => ({ ...s, day: s.day + 1, venueDay: s.venueDay + 1 }));
    try {
      await startDay(b); await fpsCheck('boss', b);
      await b.ev("window.__smokeMower = (() => { let r = null; rr.scene.traverse(o => { if (o.name === 'mower') r = o; }); return !!r && (window.__smokeM = r, true); })()");
      // timed from the end of its warn (it sits at the shed while it warns): a frozen root moves 0 m
      const shown = await b.waitFor("!!(window.__smokeM && __smokeM.visible && rr.crew.mower && rr.crew.mower.kind === 'boss' && rr.crew.mower.phase !== 'warn')", 300, 250);
      check('boss', !!shown, 'MOW-E shows up on Club day 3' + (shown ? '' : ' ' + await where(b)));
      if (!shown) return;
      const moved = await b.ev(`new Promise(res => { const m = __smokeM, x0 = m.position.x, z0 = m.position.z; let best = 0;
        const iv = setInterval(() => { best = Math.max(best, Math.hypot(m.position.x - x0, m.position.z - z0)); }, 100);
        setTimeout(() => { clearInterval(iv); res(best); }, 20000); })`, 30000);
      check('boss', moved >= 10, `the mower root moved ${moved.toFixed(1)} m in 20 s (≥ 10)`);
    } finally { await b.close(); }
  },
  // 2. Muni day 3's Gold Rush: beams up, and the ALERT is the only centre item.
  async rush(port) {
    const b = await beatPage(port, 'muni3');
    try {
      await startDay(b); await fpsCheck('rush', b);
      const on = await b.waitFor('(rr.crew.mods?.goldrush?.balls?.length ?? 0) > 0', 400, 250);
      check('rush', !!on, 'the Gold Rush fires on Muni day 3 (balls out under beams)' + (on ? '' : ' ' + await where(b)));
      if (!on) return;
      const seen = await b.ev(`new Promise(res => { const log = []; const iv = setInterval(() => log.push(__smoke.up()), 100);
        setTimeout(() => { clearInterval(iv); res(log); }, 3000); })`, 10000);
      const alert = seen.some(u => u.some(x => /Gold Rush/.test(x.text)));
      const crowd = seen.filter(u => u.length > 1).length;
      check('rush', alert, 'its ALERT shows');
      check('rush', crowd === 0, `the ALERT is the only centre item (${crowd} of ${seen.length} samples had two)`);
    } finally { await b.close(); }
  },
  // 3. A Tiered Happy Hour.
  async happy(port) {
    const b = await beatPage(port, 'tiered1');
    try {
      await startDay(b); await fpsCheck('happy', b);
      const on = await b.waitFor('!!rr.crew.mods?.happyhour && (rr.crew.mods.happyhour.on || rr.crew.mods.happyhour.live || (rr.crew.mods.happyhour.balls?.length ?? 0) > 0)', 260, 250);
      check('happy', !!on, 'Happy Hour fires at Tiered (s.mods.happyhour live)' + (on ? '' : ' ' + await where(b)));
      const alert = on && await b.waitFor("__smoke.up().some(x => /Happy Hour/.test(x.text))", 8, 100);
      check('happy', !!alert, 'its ALERT shows');
    } finally { await b.close(); }
  },
  // 4. The Stadium crash: the loss line owns ≥ 2.5 s, alone.
  async crash(port) {
    const b = await beatPage(port, 'stadiumPromo');
    try {
      await startDay(b); await fpsCheck('crash', b);
      const res = await b.ev(`new Promise(res => { const t0 = performance.now(); let since = null, best = 0, shared = 0;
        const iv = setInterval(() => { const u = __smoke.up(), on = u.some(x => /It took the bunting|MOW-E 2\\.0 left/.test(x.text));
          if (on) { since ??= performance.now(); best = Math.max(best, (performance.now() - since) / 1000); if (u.length > 1) shared++; } else since = null;
          if ((!on && best > 0) || performance.now() - t0 > 330000) { clearInterval(iv); res({ best, shared }); } }, 100); })`, 340000);
      check('crash', res.best >= 2.5, `the loss line was shown ${res.best.toFixed(1)} s (≥ 2.5)`);
      check('crash', res.shared === 0, `alone in the centre (${res.shared} shared samples)`);
    } finally { await b.close(); }
  },
  // 5. The bank to the end card: 0 overlaps, and the end card holds ≥ 10 s with Ready pressed early.
  async bank(port) {
    const b = await beatPage(port, 'lastbucket-4p');
    try {
      await startDay(b); await fpsCheck('bank', b);
      await b.ev('__centre.reset(), true');
      // the bank's timeline, printed with an overlap: the story card's events and the $∞ flash's first frame
      await b.ev(`window.__bankLog = []; const T = () => +(performance.now() / 1000).toFixed(2);
        addEventListener('rr-story', e => __bankLog.push([T(), 'story', e.detail?.id, e.detail?.phase]));
        let fo = null, pa = null; new MutationObserver(() => { const f = document.getElementById('ending-flash'); if (f && !f.classList.contains('hidden') && !window.__flashSeen) { window.__flashSeen = 1; __bankLog.push([T(), 'flash']); } const o = f ? (f.classList.contains('hidden') ? 'hidden' : f.style.opacity) : null; if (o !== fo) { fo = o; __bankLog.push([T(), 'flash-op', o]); } const p = document.getElementById('pa-card'), pon = !!p?.classList.contains('on'); if (pon !== pa) { pa = pon; __bankLog.push([T(), 'pa', pon]); } }).observe(document.body, { childList: true, subtree: true, attributes: true });
        true`);
      const down =await b.waitFor("(() => { const lb = rr.crew.lastBucket; if (!lb || lb.phase !== 'down') return null; const ball = [...rr.balls.values()].find(x => x.kind === 'one'); return ball && ball.y <= 0.4 && ball.rest ? { x: ball.x, z: ball.z, id: ball.id } : null; })()", 300, 250);
      check('bank', !!down, 'Ball No. 1 comes down and lands' + (down ? '' : ' ' + await where(b)));
      if (!down) return;
      const off = await b.ev(`__smoke.walkTo(${down.x}, ${down.z}, 0.6)`, 130000);
      // the server's own pickup (the client's Ⓐ is gated on its prompts); still checked for reach on the server
      const got = await b.waitFor(`(rr.link.act({ t: 'pickup', ball: ${JSON.stringify(down.id)} }), ['carried', 'huddle'].includes(rr.crew.lastBucket?.phase))`, 15, 300);
      check('bank', !!got, `the seat picks up Ball No. 1 (walked to ${Number(off).toFixed(1)} m of it)` + (got ? '' : ' ' + await where(b)));
      if (!got) return;
      await b.ev('__smoke.walkTo(27, 1.8, 1.0)', 130000);   // sim.js SIM.STAND
      // HOLD SPACE TOGETHER (idle Rats count as holding): a press before the huddle phase lands is lost, so press
      // again (release first) until the server lists the seat as holding or the huddle is over
      await b.waitFor("(() => { const lb = rr.crew.lastBucket; if (lb && lb.phase !== 'huddle' && lb.phase !== 'carried') return true; if (lb?.phase === 'huddle' && (lb.held ?? []).length) return true; rr.releaseAct?.(); rr.pressAct(); return false; })()", 30, 1000);
      const card = await b.waitFor("!!document.getElementById('endcard') && __smoke.up().some(x => x.id === 'endcard')", 240, 200);
      check('bank', !!card, 'the end card comes up' + (card ? '' : ' ' + await where(b) + ' ' + await b.ev("JSON.stringify({ lb: rr.crew.lastBucket, me: [rr.me.x, rr.me.z].map(Math.round) })").catch(e => e.message)));
      if (!card) return;
      await b.ev('rr.releaseAct?.(), true');
      await sleep(2000); await b.ev('rr.startShift(), true');   // Ready, early
      const held = await b.ev(`new Promise(res => { const t0 = performance.now(); const iv = setInterval(() => {
        const up = __smoke.up().some(x => x.id === 'endcard');
        if (!up || performance.now() - t0 > 9000) { clearInterval(iv); res((performance.now() - t0) / 1000 + 2); } }, 100); })`, 20000);
      check('bank', held >= 10, `the end card held ${held.toFixed(1)} s with Ready pressed at 2 s (≥ 10)`);
      // a world-space pay float drifting through the centre box is logged, not failed: the gate is text on text
      const ov = await b.ev(`(() => { const all = __centre.log.slice(); const text = all.filter(o => !o.up.some(u => /^payfloat/.test(u)));
        return { n: text.length, floats: all.length - text.length, log: text.slice(0, 3), bank: __bankLog }; })()`);
      if (ov.floats) log('WARN', 'bank', `${ov.floats} pay float(s) crossed the centre box with a centre text`);
      check('bank', ov.n === 0, `no centre text overlaps through the bank (${ov.n}${ov.n ? ': ' + JSON.stringify(ov.log) + ' timeline ' + JSON.stringify(ov.bank) : ''})`);
    } finally { await b.close(); }
  },
};

let code = 0;
try {
  await startServer();
  const port = await startBrowser();
  log(`server ${base}, beats ${ONLY.join(' ')}`);
  for (const beat of ONLY) {
    log(`beat ${beat}`);
    try { await BEAT[beat](port); } catch (e) { check(beat, false, `crashed: ${e.message}`); }
  }
} catch (e) { fails.push(`setup: ${e.message}`); log('FAIL setup', e.message); }
finally {
  if (!flag('--keep')) browser?.kill();
  server?.kill();
  await sleep(300);
  if (profile && !flag('--keep')) try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
console.log(`\nSMOKE ${fails.length ? 'FAILED' : 'OK'}: ${passes.length} passed, ${fails.length} failed`);
for (const f of fails) console.log('  FAIL ' + f);
code = fails.length ? 1 : 0;
process.exit(code);
