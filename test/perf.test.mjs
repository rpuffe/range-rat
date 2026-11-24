// The Xbox performance pass (council round 4, build item 6): the pure decisions in perf.js,
// the Graphics setting, and the RR_DEV fixture route (404 unless RR_DEV is set).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readFileSync, readdirSync } from 'node:fs';
import { sanitize, DEFAULTS, GRAPHICS } from '../web/js/settings.js';
import { baseTier, profileFor, pixelRatioFor, percentile, summarize, createAuto, isXbox } from '../web/js/perf.js';

test('Graphics sanitises to auto / high / low and defaults to auto', () => {
  assert.equal(DEFAULTS.graphics, 'auto');
  assert.deepEqual(GRAPHICS, ['auto', 'high', 'low']);
  for (const g of GRAPHICS) assert.equal(sanitize({ graphics: g }).graphics, g);
  for (const junk of ['ultra', 3, null, undefined, {}, 'LOW']) assert.equal(sanitize({ graphics: junk }).graphics, 'auto');
});

test('Auto means Low on Xbox and High elsewhere; the setting overrides', () => {
  const xbox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; Xbox; Xbox One) Edge/44';
  assert.ok(isXbox(xbox));
  assert.equal(baseTier('auto', xbox), 'low');
  assert.equal(baseTier('auto', 'Mozilla/5.0 Chrome/130'), 'high');
  assert.equal(baseTier('high', xbox), 'high');
  assert.equal(baseTier('low', 'Chrome'), 'low');
});

test('profiles: Low is cheaper than High on every lever; Auto steps stack', () => {
  const hi = profileFor('high'), lo = profileFor('low');
  assert.ok(lo.pixelRatioCap < hi.pixelRatioCap && lo.maxH === 1080);
  assert.ok(lo.shadowSize < hi.shadowSize && lo.shadowEvery > hi.shadowEvery);
  assert.ok(lo.maxFull < hi.maxFull && lo.nearM < hi.nearM);
  assert.ok(lo.scubaLow && !hi.scubaLow && lo.venueHz === 20 && hi.venueHz === 0);
  assert.equal(profileFor('low', 1).renderScale, 0.85);
  assert.equal(profileFor('low', 1).shadows, true);
  assert.equal(profileFor('low', 2).shadows, false);
  assert.equal(profileFor('low', 3).maxFull, 6);
  assert.equal(profileFor('low', 99).steps, 3);
});

test('render size: Low caps the internal height at 1080 whatever the TV reports', () => {
  const lo = profileFor('low');
  assert.equal(pixelRatioFor(lo, 2, 1080), 1);              // 4K TV, 2x dpr, 1080 css px
  assert.equal(pixelRatioFor(lo, 1, 2160), 0.5);            // 4K TV, dpr 1, 2160 css px -> 1080 rows
  assert.equal(pixelRatioFor(profileFor('high'), 3, 800), 2);
  assert.ok(Math.abs(pixelRatioFor(profileFor('high', 1), 1, 1000) - 0.85) < 1e-9);
});

test('percentile and summarize', () => {
  const v = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(v, 0.95), 95);
  assert.equal(percentile([], 0.95), 0);
  const s = summarize([10, 20, 30, 40]);
  assert.equal(s.avg, 25); assert.equal(s.worst, 40); assert.equal(s.n, 4);
});

test('auto mode: needs sustained pressure, settles, steps at most three times', () => {
  const a = createAuto({ settle: 2, hold: 10, max: 3, limit: 22 });
  for (let i = 0; i < 2; i++) assert.equal(a.update(40, 1), false);       // settling
  for (let i = 0; i < 9; i++) assert.equal(a.update(40, 1), false);
  a.update(15, 1);                                                          // one good second resets the hold
  for (let i = 0; i < 9; i++) assert.equal(a.update(40, 1), false);
  assert.equal(a.update(40, 1), true); assert.equal(a.steps, 1);
  for (let i = 0; i < 2; i++) assert.equal(a.update(40, 1), false);       // settles again after a step
  let steps = 1;
  for (let i = 0; i < 100; i++) if (a.update(40, 1)) steps++;
  assert.equal(steps, 3); assert.equal(a.steps, 3);
  const b = createAuto({ settle: 0, hold: 10 });
  for (let i = 0; i < 50; i++) assert.equal(b.update(18, 1), false);       // fine frames never step
});

test('fixtures are valid JSON saves', () => {
  const dir = new URL('../tools/fixtures/', import.meta.url);
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  assert.ok(files.length >= 3);
  for (const f of files) {
    const s = JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
    assert.ok(s.venue >= 0 && s.venue <= 5 && s.day >= 1, f);
  }
});

// ---- the dev route ------------------------------------------------------------------
const serverPath = fileURLToPath(new URL('../server/server.mjs', import.meta.url));
async function withServer(extraEnv, fn) {
  const port = 19000 + Math.floor(Math.random() * 900);
  const env = { ...process.env, PORT: String(port), ...extraEnv };
  delete env.STORAGE_BUCKET; if (!extraEnv.RR_DEV) delete env.RR_DEV;
  const proc = spawn(process.execPath, [serverPath], { env, stdio: 'pipe' });
  const base = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; ; i++) {
      try { if ((await fetch(`${base}/healthz`)).ok) break; } catch {}
      if (i > 50) throw new Error('server did not start');
      await new Promise(r => setTimeout(r, 100));
    }
    await fn(base);
  } finally { proc.kill(); }
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('the dev route is 404 without RR_DEV', async () => {
  await withServer({}, async base => {
    assert.equal((await post(`${base}/api/dev/crew`, { fixture: 'stadium' })).status, 404);
    assert.equal((await fetch(`${base}/api/dev/fixtures`)).status, 404);
  });
});

test('with RR_DEV a fixture (or a raw save) becomes a crew you can join', async () => {
  await withServer({ RR_DEV: '1' }, async base => {
    const list = await (await fetch(`${base}/api/dev/fixtures`)).json();
    assert.ok(list.fixtures.includes('stadium'));
    const res = await post(`${base}/api/dev/crew`, { fixture: 'stadium', name: 'Perf' });
    assert.equal(res.status, 200);
    const { code, p, k } = await res.json();
    assert.match(code, /^[A-Z0-9]+$/);
    // the welcome message carries the loaded venue
    const ctl = new AbortController();
    const sse = await fetch(`${base}/api/crew/${code}/stream?p=${p}&k=${k}`, { signal: ctl.signal });
    const text = (await sse.body.getReader().read()).value;
    ctl.abort();
    assert.match(new TextDecoder().decode(text), /"venue":3/);
    assert.equal((await post(`${base}/api/dev/crew`, { fixture: '../server' })).status, 400);
    assert.equal((await post(`${base}/api/dev/crew`, { fixture: 'nope' })).status, 404);
    assert.equal((await post(`${base}/api/dev/crew`, { name: 'Raw', save: { day: 2, venue: 1 } })).status, 200);
  });
});
