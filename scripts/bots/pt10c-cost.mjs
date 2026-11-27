// Reviewer C: the main-thread cost per frame of a live page (unthrottled), from CDP Performance.getMetrics over N s:
// what a CPU x6 throttle multiplies. node scripts/bots/pt10c-cost.mjs <targetIdPrefix> [secs]
import { targets, attach, sleep } from './pt10c-lib.mjs';
const [sel, secs = '6'] = process.argv.slice(2);
const t = (await targets()).find(x => x.id.startsWith(sel));
const b = await attach(t.id);
await b.page.send('Performance.enable');
const m = async () => Object.fromEntries((await b.page.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
const f0 = await b.ev('window.__fc ??= (() => { const o = { n: 0 }; const f = () => { o.n++; requestAnimationFrame(f); }; requestAnimationFrame(f); return o; })(), __fc.n');
const a = await m(); await sleep(+secs * 1000); const z = await m();
const f1 = await b.ev('__fc.n');
const fr = f1 - f0;
const per = k => ((z[k] - a[k]) * 1000 / fr).toFixed(2);
console.log(JSON.stringify({ frames: fr, fps: (fr / +secs).toFixed(1), taskMsPerFrame: per('TaskDuration'), scriptMsPerFrame: per('ScriptDuration'), layoutMsPerFrame: per('LayoutDuration'), styleMsPerFrame: per('RecalcStyleDuration'), where: await b.ev('JSON.stringify(__c.where())') }));
process.exit(0);
