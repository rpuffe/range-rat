// Reviewer B: attach to MY seat's page (CDP port arg) and pause it, to print where a hung page is spinning.
import { request } from 'node:http';
const port = +(process.argv[2] ?? 19741);
const list = await new Promise((res, rej) => request({ host: '127.0.0.1', port, path: '/json/list' }, r => { let s = ''; r.on('data', d => s += d); r.on('end', () => res(JSON.parse(s))); }).on('error', rej).end());
const t = list.find(x => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
let id = 0; const send = (m, p = {}) => ws.send(JSON.stringify({ id: ++id, method: m, params: p }));
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.method === 'Debugger.paused') { for (const f of m.params.callFrames.slice(0, 15)) console.log(f.functionName || '(anon)', f.url.split('/').pop(), f.location.lineNumber + 1, f.location.columnNumber); send('Debugger.resume'); setTimeout(() => process.exit(0), 300); }
};
ws.onopen = () => { send('Debugger.enable'); setTimeout(() => send('Debugger.pause'), 500); };
setTimeout(() => { console.log('no pause in 15 s'); process.exit(1); }, 15000);
