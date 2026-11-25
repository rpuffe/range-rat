// Range Rat server: serves the client, runs every crew's range, and streams
// it to the browsers.
//
//   POST /api/crew                    {name}           -> {code, p, k}   new crew
//   POST /api/crew/:code/join         {name, p?, k?}   -> {code, p, k}   join or rejoin
//   GET  /api/crew/:code/stream?p=&k=                  -> SSE: welcome, then ticks
//   POST /api/crew/:code/input        {p, k, x, z, yaw, a: [actions]} -> {denied}
//
// Crews live in memory and are saved (day, cash, totals) at the end of each
// shift, every minute while dirty, and when the last player has been gone
// for a while. Deploys are stop-then-start (the manifest has storage), so a
// deploy ends live crews; they reload from their save on the next join.

import http from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Crew, newCode, validCode } from './crew.mjs';
import { newStore } from './store.mjs';
import { SIM } from '../web/js/sim.js';
import { migrateV4 } from '../web/js/goals.js';   // council round 10 #1: DEV_STAMPS 3+ hands a fresh crew a done card

const PORT = Number(process.env.PORT || 8080);
const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const TICK_MS = 50;              // 20 Hz simulation
const SEND_EVERY = 2;            // 10 Hz to the browsers
const SAVE_MS = 60_000;
const UNLOAD_MS = 10 * 60_000;   // a crew with nobody online for this long is saved and dropped
const MAX_CREWS = 200;
const BODY_MAX = 4096;
const SHIFT_SECS = Number(process.env.SHIFT_SECS) || null;  // shorter for local testing; unset = the day lengths
const DEV_START_CASH = Number(process.env.DEV_START_CASH) || 0;       // local shop testing only; never in the manifest
const DEV_START_DAY = Number(process.env.DEV_START_DAY) || 0;         // local testing only: new crews start on this day
const DEV_VENUE = Number(process.env.DEV_VENUE) || 0;                 // local testing only: start at this venue
const DEV_OUTSTANDING = Number(process.env.DEV_OUTSTANDING) || 0;     // local testing only: Balls Outstanding
const DEV_STAMPS = Number(process.env.DEV_STAMPS) || 0;               // local testing only: good days (3+: the goal card done but the fee)

const store = newStore(process.env.STORAGE_BUCKET);
const crews = new Map();         // code -> { crew, subs: Set<{p, res}>, savedAt, saving }
console.log(`storage: ${store.kind}`);

// ---------------------------------------------------------------- crews

async function saveCrew(c) {
  if (c.saving) return;
  c.saving = true;
  c.crew.dirty = false;
  try { await store.save(c.crew.code, c.crew.toSave()); c.savedAt = Date.now(); }
  catch (e) { c.crew.dirty = true; console.log(`save ${c.crew.code} failed: ${e.message}`); }
  finally { c.saving = false; }
}

async function loadCrew(code) {
  if (crews.has(code)) return crews.get(code);
  const save = await store.load(code);
  if (!save || crews.size >= MAX_CREWS) return crews.get(code) ?? null;
  if (!crews.has(code)) crews.set(code, { crew: new Crew(code, save, { shiftSecs: SHIFT_SECS }), subs: new Set(), savedAt: Date.now() });
  return crews.get(code);
}

let tickN = 0;
setInterval(() => {
  tickN++;
  const now = Date.now();
  for (const [code, c] of crews) {
    const before = c.crew.phase;
    c.crew.tick(TICK_MS / 1000);
    if (before === 'shift' && c.crew.phase === 'report') {
      console.log(`shift complete: crew=${code} day=${c.crew.day} picked=${c.crew.report.picked} players=${c.crew.players.size}`);
      saveCrew(c);
    } else if (c.crew.dirty && now - c.savedAt > SAVE_MS) saveCrew(c);
    if (tickN % SEND_EVERY === 0) {
      const line = `data: ${JSON.stringify(c.crew.flush())}\n\n`;
      for (const s of c.subs) s.res.write(line);
    }
    if (c.subs.size === 0 && now - c.crew.lastActive > UNLOAD_MS && !c.saving) {
      crews.delete(code);
      if (c.crew.dirty) saveCrew(c);
    }
  }
}, TICK_MS).unref?.();

// Keep SSE connections alive through proxies when nothing else is moving.
setInterval(() => { for (const c of crews.values()) for (const s of c.subs) s.res.write(': ping\n\n'); }, 15_000).unref?.();

// ---------------------------------------------------------------- http

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.txt': 'text/plain' };
const SECURITY = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const send = (res, status, obj) => {
  res.writeHead(status, { ...SECURITY, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
};

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', d => { size += d.length; if (size > BODY_MAX) { reject(new Error('too big')); req.destroy(); } else chunks.push(d); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
}

// Dev fixtures (perf testing): only when RR_DEV is set in the environment, never in the manifest.
//   POST /api/dev/crew  {name?, fixture: 'stadium-day2'}  or  {name?, save: {...}}  or a bare save body
//   -> {code, p, k}: a new crew loaded from tools/fixtures/<fixture>.json (or the save), with you on it.
//   GET  /api/dev/fixtures -> {fixtures: [names]}
const FIXTURES = fileURLToPath(new URL('../tools/fixtures/', import.meta.url));
async function devApi(req, res, parts) {
  if (!process.env.RR_DEV) return send(res, 404, { error: 'not found' });
  if (parts[2] === 'fixtures' && req.method === 'GET') {
    const names = (await readdir(FIXTURES).catch(() => [])).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
    return send(res, 200, { fixtures: names });
  }
  if (parts[2] !== 'crew' || req.method !== 'POST') return send(res, 404, { error: 'not found' });
  const body = await readJson(req);
  let save = body.save;
  if (body.fixture !== undefined) {
    if (!/^[a-z0-9-]{1,40}$/.test(String(body.fixture))) return send(res, 400, { error: 'bad fixture name' });
    try { save = JSON.parse(await readFile(join(FIXTURES, `${body.fixture}.json`), 'utf8')); }
    catch { return send(res, 404, { error: 'no such fixture' }); }
  } else if (!save) { const { name: _n, ...rest } = body; save = rest; }
  if (crews.size >= MAX_CREWS) return send(res, 503, { error: 'The range is full right now. Try again soon.' });
  let code;
  for (let i = 0; i < 20 && !code; i++) { const c = newCode(); if (!crews.has(c) && !(await store.load(c))) code = c; }
  if (!code) return send(res, 503, { error: 'Could not find a free crew code.' });
  const c = { crew: new Crew(code, save, { shiftSecs: SHIFT_SECS }), subs: new Set(), savedAt: Date.now() };
  crews.set(code, c);
  const p = c.crew.join(body.name);
  saveCrew(c);
  return send(res, 200, { code, p: p.id, k: p.token });
}

async function api(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);   // ['api', 'crew', CODE?, verb?]
  if (parts[1] === 'dev') return devApi(req, res, parts);
  if (parts[1] !== 'crew') return send(res, 404, { error: 'not found' });

  if (parts.length === 2 && req.method === 'POST') {          // new crew
    const body = await readJson(req);
    if (crews.size >= MAX_CREWS) return send(res, 503, { error: 'The range is full right now. Try again soon.' });
    let code;
    for (let i = 0; i < 20 && !code; i++) { const c = newCode(); if (!crews.has(c) && !(await store.load(c))) code = c; }
    if (!code) return send(res, 503, { error: 'Could not find a free crew code.' });
    const c = { crew: new Crew(code, DEV_START_DAY || DEV_VENUE || DEV_OUTSTANDING ? { day: DEV_START_DAY || 1, venue: DEV_VENUE, venueDay: DEV_VENUE ? 1 : 0, ...(DEV_OUTSTANDING ? { outstanding: DEV_OUTSTANDING } : {}) } : null, { shiftSecs: SHIFT_SECS }), subs: new Set(), savedAt: Date.now() };
    crews.set(code, c);
    c.crew.cash = DEV_START_CASH;
    if (DEV_STAMPS) { c.crew.reviews = DEV_STAMPS; c.crew.goals = migrateV4({ venue: c.crew.venue, stamps: DEV_STAMPS }); }
    const p = c.crew.join(body.name);
    saveCrew(c);   // so the code can be rejoined even before the first shift ends
    return send(res, 200, { code, p: p.id, k: p.token });
  }

  const code = String(parts[2] ?? '').toUpperCase();
  if (!validCode(code)) return send(res, 404, { error: 'No crew with that code.' });
  const verb = parts[3];

  if (verb === 'join' && req.method === 'POST') {
    const body = await readJson(req);
    const c = await loadCrew(code);
    if (!c) return send(res, 404, { error: 'No crew with that code.' });
    const again = c.crew.auth(body.p, body.k);
    if (again) return send(res, 200, { code, p: again.id, k: again.token });
    const p = c.crew.join(body.name);
    if (!p) return send(res, 409, { error: `That crew is full (${SIM.MAX_PLAYERS} max).` });
    return send(res, 200, { code, p: p.id, k: p.token });
  }

  const c = crews.get(code);
  if (!c) return send(res, 404, { error: 'No crew with that code.' });

  if (verb === 'stream' && req.method === 'GET') {
    const p = c.crew.auth(url.searchParams.get('p'), url.searchParams.get('k'));
    if (!p) return send(res, 403, { error: 'Not on this crew.' });
    res.writeHead(200, { ...SECURITY, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    res.write('retry: 2000\n\n');
    res.write(`data: ${JSON.stringify(c.crew.welcome(p.id))}\n\n`);
    const sub = { p, res };
    c.subs.add(sub); c.crew.connect(p);
    req.on('close', () => { c.subs.delete(sub); c.crew.disconnect(p); });
    return;
  }

  if (verb === 'input' && req.method === 'POST') {
    const body = await readJson(req);
    const p = c.crew.auth(body.p, body.k);
    if (!p) return send(res, 403, { error: 'Not on this crew.' });
    return send(res, 200, c.crew.input(p, body));
  }

  return send(res, 404, { error: 'not found' });
}

async function staticFile(req, res, url) {
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { res.writeHead(400, SECURITY).end(); return; }
  if (path !== '/' && path.endsWith('/')) { res.writeHead(404, SECURITY).end('not found'); return; }  // no listings
  const file = normalize(join(WEB, path === '/' ? 'index.html' : path));
  if (!file.startsWith(normalize(WEB)) || file.split(sep).some(s => s.startsWith('.'))) { res.writeHead(404, SECURITY).end('not found'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { ...SECURITY, 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      // The pinned library is immutable per release; everything else revalidates.
      'Cache-Control': path.startsWith('/lib/') ? 'public, max-age=86400' : 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(404, SECURITY).end('not found'); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  // Healthcheck: static and dependency-free. It must never touch storage.
  if (url.pathname === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok\n'); return; }
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else if (req.method === 'GET' || req.method === 'HEAD') await staticFile(req, res, url);
    else send(res, 405, { error: 'method not allowed' });
  } catch (e) {
    if (!res.headersSent) send(res, 400, { error: 'bad request' });
    else res.end();
    if (!(e instanceof SyntaxError) && e.message !== 'too big') console.log(`error ${req.method} ${url.pathname}: ${e.message}`);
  }
});
server.requestTimeout = 0;          // SSE streams stay open
server.keepAliveTimeout = 65_000;    // longer than the load balancer's 60 s idle timeout
server.headersTimeout = 66_000;
server.listen(PORT, '0.0.0.0', () => console.log(`range-rat listening on 0.0.0.0:${PORT}`));

// Fargate stops tasks with SIGTERM: bank every dirty crew on the way out.
process.on('SIGTERM', async () => {
  await Promise.allSettled([...crews.values()].filter(c => c.crew.dirty).map(saveCrew));
  process.exit(0);
});
