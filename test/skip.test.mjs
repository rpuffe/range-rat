// Round 11, skip ahead (test): the host gate, the starting points' presets through the save path, and the HTTP
// route on a real server (dev and localhost Hosts allowed, prod refused).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { PRESETS, presetById, skipHostOk, tipsFor } from '../web/js/skip.js';
import { loadPreset, presetSave, testJoin } from '../server/skip.mjs';
import { MemoryStore } from '../server/store.mjs';
import { Crew } from '../server/crew.mjs';
import { HINTS } from '../web/js/settings.js';

test('host gate: localhost and dev allowed, prod and anything else refused', () => {
  for (const h of ['localhost', 'localhost:8091', '127.0.0.1:8080', '[::1]:8091', 'range-rat-dev.fd.robertpuffe.com', 'RANGE-RAT-DEV.fd.robertpuffe.com:443'])
    assert.equal(skipHostOk(h), true, h);
  for (const h of ['range-rat.fd.robertpuffe.com', 'range-rat.fd.robertpuffe.com:443', 'fd.robertpuffe.com', 'evil.com', 'localhost.evil.com',
    'dev.range-rat.fd.robertpuffe.com', '', undefined, null, 'range rat-dev.x', 'a'.repeat(300) + '-dev.x'])
    assert.equal(skipHostOk(h), false, String(h));
});

test('every starting point has a preset that loads through the save path into a valid crew', async () => {
  const store = new MemoryStore();
  for (const def of PRESETS) {
    const preset = await loadPreset(def.id);
    assert.ok(preset, `server/presets/${def.id}.json (run node scripts/make-presets.mjs)`);
    const code = 'TS' + String.fromCharCode(65 + PRESETS.indexOf(def)) + 'Z';
    await store.save(code, presetSave(preset, code));
    for (const n of [1, 2, 4]) {
      const crew = new Crew(code, await store.load(code), { seed: 3 });
      assert.equal(crew.test, true, def.id);
      assert.equal(crew.venue, def.venue, `${def.id} venue`);
      assert.equal(crew.endless, !!def.endless, `${def.id} endless`);
      assert.ok(crew.cash >= 0 && Number.isFinite(crew.cash), `${def.id} cash`);
      assert.ok(crew.day >= (def.id === 'muni3' ? 3 : 4), `${def.id} day ${crew.day}`);   // round 14 #0d: muni3 is day 3
      const rats = [];
      for (let i = 0; i < n; i++) { const p = crew.join(i === 0 ? '' : `Tester${i}`); testJoin(crew, p); crew.connect(p); rats.push(p); }
      if (def.venue >= 2) assert.ok(rats.every(p => p.dive >= 1), `${def.id}: every Rat gets the crew's dive gear`);
      crew.readyUp(rats[0]);
      assert.equal(crew.phase, 'shift', `${def.id} ${n}P starts a shift`);
      if (!def.endless) { assert.ok(crew.goals, `${def.id} has a goal card`); assert.equal(crew.goals.crew, n, `${def.id}: the card prints for ${n}`); }
      for (let i = 0; i < 40; i++) crew.tick(0.1);
      assert.equal(crew.toSave().test, true);
      assert.equal(crew.snapshot().test, true);
      if (def.id === 'lastbucket') assert.ok(crew.lastBucket, 'the Last Bucket begins on the first shift');
    }
  }
});

test('a real crew is not a test crew, and testJoin leaves it alone', () => {
  const crew = new Crew('ABCD', { v: 5, day: 8, venue: 2, diveByName: { Ann: 2 } }, { seed: 1 });
  assert.equal(crew.test, false);
  assert.equal('test' in crew.toSave(), false);
  assert.equal('test' in crew.snapshot(), false);
  const p = crew.join('Bob'); testJoin(crew, p);
  assert.equal(p.dive, 0);
  assert.equal(new Crew('ABCD', { test: 'yes' }).test, false);   // only a literal true marks a test crew
});

test('tips: old things seen, the starting point\'s new things not; every id is a real hint', () => {
  for (const def of PRESETS) assert.ok(presetById(def.id));
  const all = PRESETS.map(d => d.venue);
  assert.deepEqual(all, [...all].sort((a, b) => a - b));
  const club = tipsFor({ venue: 1, day: 6, up: { washer: 1, cart: 1 } });
  assert.ok(club.includes('crank') && club.includes('cart') && club.includes('shop'));
  assert.ok(!club.includes('creek') && !club.includes('cctv'), 'the Club day 1 still teaches the creek and CCTV');
  assert.ok(!tipsFor({ venue: 2, up: {} }).includes('deck'));
  assert.ok(!tipsFor({ venue: 5, venueDay: 0, up: {} }).includes('lift'));
  assert.ok(tipsFor({ venue: 5, endless: true, up: { drones: 1 } }).includes('lift'));
  for (const id of tipsFor({ venue: 5, endless: true, up: { washer: 1, shed: 1, cart: 1, pond: 1, gutters: 1, drones: 1 } }))
    assert.ok(id in HINTS, id);
});

// ---- the HTTP route on a real server ----
const PORT = 19000 + Math.floor(Math.random() * 1000);
let proc;
before(async () => {
  const env = { ...process.env, PORT: String(PORT) };
  delete env.STORAGE_BUCKET;
  proc = spawn(process.execPath, [fileURLToPath(new URL('../server/server.mjs', import.meta.url))], { env, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(`http://127.0.0.1:${PORT}/healthz`)).ok) return; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
after(() => proc?.kill());

function req(method, path, host, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const r = http.request({ host: '127.0.0.1', port: PORT, method, path, headers: { host, 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) } }, res => {
      let buf = ''; res.on('data', d => { buf += d; }); res.on('end', () => resolve({ status: res.statusCode, body: buf ? JSON.parse(buf) : null }));
    });
    r.on('error', reject); r.end(data);
  });
}

test('route: prod host refused (404), dev and localhost make a NEW test crew at the starting point', async () => {
  const prod = await req('POST', '/api/skip', 'range-rat.fd.robertpuffe.com', { name: 'Rob', preset: 'stadium1' });
  assert.equal(prod.status, 404);
  assert.equal((await req('GET', '/api/skip', 'range-rat.fd.robertpuffe.com')).status, 404);
  const list = await req('GET', '/api/skip', 'range-rat-dev.fd.robertpuffe.com');
  assert.equal(list.status, 200);
  assert.deepEqual(list.body.presets.map(p => p.id), PRESETS.map(p => p.id));
  assert.equal((await req('POST', '/api/skip', 'localhost:8091', { preset: 'nope' })).status, 404);
  const a = await req('POST', '/api/skip', 'range-rat-dev.fd.robertpuffe.com', { name: 'Rob', preset: 'stadium1' });
  assert.equal(a.status, 200);
  assert.equal(a.body.test, true);
  assert.match(a.body.code, /^[A-Z]{4}$/);
  assert.ok(a.body.tips.includes('shop'));
  const b = await req('POST', '/api/skip', `localhost:${PORT}`, { name: 'Rob', preset: 'stadium1' });
  assert.equal(b.status, 200);
  assert.notEqual(a.body.code, b.body.code, 'every skip is a new crew');
  // A friend joins the test crew with the code, like any crew.
  const j = await req('POST', `/api/crew/${a.body.code}/join`, 'range-rat-dev.fd.robertpuffe.com', { name: 'Pal' });
  assert.equal(j.status, 200);
});

// Council round 11 8.14 (builder 4): picking a skip preset clears the saved seat (no rejoin of the last crew).
test('8.14: picking a skip-ahead preset clears range-rat.seat first', async () => {
  const { initSkip, clearSeat, SEAT_KEY } = await import('../web/js/skip.js');
  assert.equal(SEAT_KEY, 'range-rat.seat');
  const store = new Map([[SEAT_KEY, '{"code":"OLD"}']]);
  const storage = { removeItem: k => store.delete(k) };
  const els = {}, listeners = {};
  const el = id => (els[id] ??= { id, innerHTML: '', classList: { remove() {}, toggle: () => false }, setAttribute() {}, querySelector: () => null,
    addEventListener: (t, f) => { listeners[id + ':' + t] = f; } });
  const doc = { getElementById: el };
  let picked = null;
  assert.equal(initSkip({ doc, host: 'localhost:8091', storage, onPick: id => { picked = id; assert.equal(store.has(SEAT_KEY), false, 'cleared before the pick'); } }), true);
  listeners['skip-list:click']({ target: { closest: () => ({ dataset: { skip: 'club1' } }) } });
  assert.equal(picked, 'club1');
  assert.equal(clearSeat({ removeItem() { throw new Error('blocked'); } }), false, 'blocked storage never throws');
});
