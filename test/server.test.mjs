// End to end: boot the real server on a free port, make a crew, join it,
// stream it, and act on it over HTTP. No storage: the in-memory fallback.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const PORT = 18000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${PORT}`;
let proc;

before(async () => {
  const env = { ...process.env, PORT: String(PORT), SHIFT_SECS: '5' };
  delete env.STORAGE_BUCKET;
  proc = spawn(process.execPath, [fileURLToPath(new URL('../server/server.mjs', import.meta.url))], { env, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`${base}/healthz`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
after(() => proc?.kill());

const post = async (path, body) => {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, body: await res.json() };
};

// Reads SSE messages until `until(msg)` is true (or times out).
function stream(path, until, ms = 8000) {
  return new Promise((resolve, reject) => {
    const msgs = [];
    const req = http.get(base + path, res => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`stream HTTP ${res.statusCode}`)); return; }
      let buf = '';
      res.on('data', d => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
          const data = chunk.split('\n').filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n');
          if (!data) continue;
          const m = JSON.parse(data); msgs.push(m);
          if (until(m, msgs)) { req.destroy(); resolve(msgs); return; }
        }
      });
    });
    req.on('error', e => { if (e.code !== 'ECONNRESET') reject(e); });
    setTimeout(() => { req.destroy(); reject(new Error('stream timed out')); }, ms);
  });
}

test('healthz and the page are served with security headers', async () => {
  assert.equal(await (await fetch(`${base}/healthz`)).text(), 'ok\n');
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.match(await page.text(), /Range Rat/);
  assert.equal((await fetch(`${base}/js/`)).status, 404, 'no directory listings');
  assert.equal((await fetch(`${base}/../package.json`)).status, 404);
});

test('a crew: create, join, stream, shift, pick up, report', async () => {
  const a = await post('/api/crew', { name: 'Alice' });
  assert.equal(a.status, 200);
  assert.match(a.body.code, /^[A-HJ-NP-Z]{4}$/);
  const code = a.body.code;

  const b = await post(`/api/crew/${code.toLowerCase()}/join`, { name: 'Bob' });
  assert.equal(b.status, 200, 'codes are case-insensitive');
  assert.notEqual(b.body.p, a.body.p);

  const again = await post(`/api/crew/${code}/join`, { name: 'Alice', p: a.body.p, k: a.body.k });
  assert.equal(again.body.p, a.body.p, 'rejoin keeps your seat');

  assert.equal((await post('/api/crew/ZZZZ/join', { name: 'x' })).status, 404);
  assert.equal((await post(`/api/crew/${code}/input`, { p: a.body.p, k: 'nope' })).status, 403);

  const welcome = (await stream(`/api/crew/${code}/stream?p=${b.body.p}&k=${b.body.k}`, m => m.k === 'welcome'))[0];
  assert.equal(welcome.you, b.body.p);
  assert.deepEqual(welcome.s.players.map(p => p.name).sort(), ['Alice', 'Bob']);
  assert.equal(welcome.s.phase, 'lobby');

  // Alice opens the range; Bob's stream sees balls fly and land, then the report.
  const seen = stream(`/api/crew/${code}/stream?p=${b.body.p}&k=${b.body.k}`,
    (m, all) => all.some(x => x.k === 'tick' && x.ev.some(e => e.t === 'rest')) && m.k === 'tick' && m.s.phase === 'report', 15000);
  await new Promise(r => setTimeout(r, 200));
  await post(`/api/crew/${code}/input`, { p: a.body.p, k: a.body.k, a: [{ t: 'start' }] });
  const msgs = await seen;
  const ev = msgs.filter(m => m.k === 'tick').flatMap(m => m.ev);
  assert.ok(ev.some(e => e.t === 'shift' && e.phase === 'shift'));
  assert.ok(ev.some(e => e.t === 'spawn'));
  const rest = ev.find(e => e.t === 'rest');
  assert.ok(rest);

  // Walk Bob over to it (in steps, like a real walk) and pick it up.
  const bob = welcome.s.players.find(p => p.id === b.body.p);
  let x = bob.x, z = bob.z;
  for (let i = 0; i < 400 && Math.hypot(rest.x - x, rest.z - z) > 0.5; i++) {
    const d = Math.hypot(rest.x - x, rest.z - z), step = Math.min(d, 0.6);
    x += (rest.x - x) / d * step; z += (rest.z - z) / d * step;
    await post(`/api/crew/${code}/input`, { p: b.body.p, k: b.body.k, x, z });
    await new Promise(r => setTimeout(r, 100));
  }
  const pick = await post(`/api/crew/${code}/input`, { p: b.body.p, k: b.body.k, a: [{ t: 'pickup', ball: rest.id }] });
  assert.deepEqual(pick.body.denied, [], 'Bob picked it up');
  const after = (await stream(`/api/crew/${code}/stream?p=${b.body.p}&k=${b.body.k}`, m => m.k === 'welcome'))[0];
  assert.equal(after.s.players.find(p => p.id === b.body.p).pocket, 1);
  assert.equal(after.report.day, 1);
});
