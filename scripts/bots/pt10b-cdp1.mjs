// Reviewer B: one CDP call on MY seat's page: node --experimental-websocket pt10b-cdp1.mjs <port> <Method> '<json params>'
import { request } from 'node:http';
const [port, method, params = '{}'] = process.argv.slice(2);
const list = await new Promise((res, rej) => request({ host: '127.0.0.1', port: +port, path: '/json/list' }, r => { let s = ''; r.on('data', d => s += d); r.on('end', () => res(JSON.parse(s))); }).on('error', rej).end());
const ws = new WebSocket(list.find(x => x.type === 'page').webSocketDebuggerUrl);
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id === 1) { console.log(JSON.stringify(m).slice(0, 2000)); process.exit(0); } };
ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params: JSON.parse(params) }));
setTimeout(() => { console.log('timeout'); process.exit(1); }, 20000);
