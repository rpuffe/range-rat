// Reviewer B: a hang watchdog on MY seat's page. Keeps the Debugger enabled; when the page stops answering for 4 s,
// pauses it and prints the JS stack (scripts + lines), then resumes. node --experimental-websocket pt10b-watch.mjs <cdp port>
import { request } from 'node:http';
const port = +(process.argv[2] ?? 19741);
const list = await new Promise((res, rej) => request({ host: '127.0.0.1', port, path: '/json/list' }, r => { let s = ''; r.on('data', d => s += d); r.on('end', () => res(JSON.parse(s))); }).on('error', rej).end());
const ws = new WebSocket(list.find(x => x.type === 'page').webSocketDebuggerUrl);
let id = 0; const wait = new Map();
const send = (m, p = {}) => new Promise(r => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method: m, params: p })); });
const scripts = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); return; }
  if (m.method === 'Debugger.scriptParsed') scripts.set(m.params.scriptId, m.params.url);
  if (m.method === 'Debugger.paused') { console.log(new Date().toISOString(), 'PAUSED', m.params.reason); for (const f of m.params.callFrames.slice(0, 20)) console.log('  ', f.functionName || '(anon)', (f.url || scripts.get(f.location.scriptId) || '?').split('/').pop(), f.location.lineNumber + 1 + ':' + f.location.columnNumber); send('Debugger.resume'); }
};
await new Promise(r => ws.onopen = r);
await send('Debugger.enable'); await send('Runtime.enable');
console.log('watching');
let hung = false, samples = 0;
for (;;) {
  const ok = await Promise.race([send('Runtime.evaluate', { expression: '1' }).then(() => true), new Promise(r => setTimeout(() => r(false), 4000))]);
  if (!ok && (!hung || samples < 8)) { hung = true; samples++; console.log(new Date().toISOString(), 'no answer in 4 s: pausing'); ws.send(JSON.stringify({ id: ++id, method: 'Debugger.pause' })); }
  if (ok && hung) { hung = false; console.log(new Date().toISOString(), 'answering again'); }
  await new Promise(r => setTimeout(r, 1000));
}
