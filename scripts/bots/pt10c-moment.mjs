// Reviewer C: one live moment in the real client, 2P (two windows, both seats autoplaying as pickers), then
//   perf: rAF frame times + the ?perf overlay's p95, unthrottled and with the CPU throttled x6 (Emulation.setCPUThrottlingRate);
//   quit + rejoin: close seat 2's window mid-moment, reopen it on the same seat; then the same for seat 1 (the fronted one);
//   to the bell: the centre timeline, __centre.overlaps, lines over 8 words, the report.
// node scripts/bots/pt10c-moment.mjs <name> <preset|file.json[@index]> "<in-page predicate>" [waitSecs] [--tweak "<js on s>"] [--no-rejoin] [--no-bell] [--perf-at "<predicate>"]
import { readFileSync } from 'node:fs';
import { openSeat, joinCrew, devCrew, presetSave, log, sleep, startDay, closeTarget, AUTO_LIB, SEAT2_CDP } from './pt10c-lib.mjs';

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = k => { const i = args.indexOf(k); if (i < 0) return false; args.splice(i, 1); return true; };
const tweakSrc = opt('--tweak'), perfAt = opt('--perf-at'), bellWait = Number(opt('--bell') ?? 480);
const noRejoin = flag('--no-rejoin'), noBell = flag('--no-bell'), noAuto = flag('--no-auto');
const [name, src, pred, waitS = '420'] = args;
let save;
if (/\.jsonl?(@\d+)?$/.test(src)) {
  const [f, idx] = src.split('@');
  const txt = readFileSync(f, 'utf8');
  if (f.endsWith('.jsonl')) { const rows = txt.split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)); save = rows[+idx].save; }
  else { const j = JSON.parse(txt); save = j.save ?? j; }
} else save = presetSave(src);
if (tweakSrc) save = new Function('s', tweakSrc + '; return s;')(save);
log(name, 'save: day', save.day, 'venue', save.venue, 'vd', save.venueDay, 'endless', !!save.endless, 'cash', Math.round(save.cash), 'landmark', save.up?.landmark ?? 0, 'promoDay', save.promoDay ?? '-');

const s1 = await devCrew(save, 'Cass');
const s2 = await joinCrew(s1.code, 'Dot');
let b2 = await openSeat(s2, { port: SEAT2_CDP });
let b1 = await openSeat(s1);
const auto = async b => { if (noAuto) return; await b.ev(AUTO_LIB); await b.ev('__auto.start()'); };
await auto(b1); await auto(b2);
await b1.ev("try { localStorage.removeItem('rangerat.hints.v1') } catch {}; true");
const fps0 = await b1.ev('__c.fps(2000)', 10000);
log('fps (fronted seat 1, lobby)', fps0.toFixed(1));
await b2.ev('rr.startShift(), true').catch(() => {});
await startDay(b1);
await b2.ev('rr.startShift(), true').catch(() => {});
await b1.page.send('Page.bringToFront');

// the centre timeline of seat 1, until `until` or secs
const tl = [];
async function watch(secs, until = null) {
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < secs * 1000) {
    const w = await b1.ev('__c.where()').catch(() => null); const u = await b1.ev('__c.up()').catch(() => []);
    const line = u.map(x => x.id + ': ' + x.text.slice(0, 90)).join(' || ');
    if (line !== last) { const s = `${w?.phase} v${w?.venue} vd${w?.vd} T${w?.t} | ${line}`; console.log(s); tl.push(s); last = line; }
    if (until && await b1.ev(until).catch(() => false)) return true;
    if (w?.phase === 'report' && !until?.includes('report')) return false;
    await sleep(700);
  }
  return false;
}
const hit = await watch(+waitS, pred);
log('moment', name, hit ? 'HIT' : 'NOT SEEN', JSON.stringify(await b1.ev('__c.where()')));
if (hit) await b1.shot(`${name}-moment`);

async function perf(tag) {
  const f = x => `p95 ${x.p95.toFixed(1)} ms, p50 ${x.p50.toFixed(1)}, worst ${x.worst.toFixed(1)}, ${x.fps.toFixed(1)} fps (n ${x.n})`;
  const un = await b1.ev('__c.frames(3000)', 15000);
  await b1.throttle(6); await sleep(1000);
  const th = await b1.ev('__c.frames(8000)', 40000);
  const ov = await b1.ev('__c.perfP95()');
  const ovt = await b1.ev('__c.perfText()');
  await b1.throttle(1);
  log(`PERF ${tag} [Auto/High]: unthrottled ${f(un)} | CPU x6: ${f(th)} | overlay p95 (x6, 5 s window) ${ov} | ${String(ovt).split('\n').slice(1).join(' / ')}`);
  // Graphics: Low (the Xbox's tier): set it and reload this seat (it rejoins from sessionStorage), then x6 and x4
  await b1.ev(`(() => { const k = 'rangerat.settings.v1'; let s = {}; try { s = JSON.parse(localStorage.getItem(k)) || {}; } catch {} s.graphics = 'low'; localStorage.setItem(k, JSON.stringify(s)); return true; })()`);
  await closeTarget(b1.id); b1 = await openSeat(s1); await auto(b1);
  await b1.throttle(6); await sleep(1500);
  const lo6 = await b1.ev('__c.frames(8000)', 40000);
  const lot = await b1.ev('__c.perfText()');
  await b1.throttle(4); await sleep(1000);
  const lo4 = await b1.ev('__c.frames(5000)', 30000);
  await b1.throttle(1);
  log(`PERF ${tag} [Low]: CPU x6: ${f(lo6)} | CPU x4: ${f(lo4)} | ${String(lot).split('\n').slice(1).join(' / ')} | still in the moment: ${await b1.ev(pred).catch(e => e.message)}`);
  await b1.ev(`(() => { const k = 'rangerat.settings.v1'; let s = {}; try { s = JSON.parse(localStorage.getItem(k)) || {}; } catch {} s.graphics = 'auto'; localStorage.setItem(k, JSON.stringify(s)); return true; })()`);
  return { un, th, ov, lo6, lo4 };
}
if (hit) {
  if (perfAt) { const ok = await watch(120, perfAt); log('perf-at', ok); }
  await perf(name);
}

if (hit && !noRejoin) {
  // seat 2 quits (its window closes) and rejoins on the same seat after 12 s
  const before = await b1.ev('__c.where()');
  await closeTarget(b2.id, SEAT2_CDP); await sleep(12000);
  const away = await b1.ev('({ w: __c.where(), online: (rr.crew.players ?? []).filter(p => p.online !== false).length, names: (rr.crew.players ?? []).map(p => p.name + (p.online === false || p.on === false ? "(off)" : "")) })');
  log('seat 2 gone 12 s:', JSON.stringify(away), 'moment still', await b1.ev(pred).catch(e => e.message));
  b2 = await openSeat(s2, { port: SEAT2_CDP }); await auto(b2);
  const back = await b2.ev('({ w: __c.where(), me: [Math.round(rr.me.x), Math.round(rr.me.z)], up: __c.up() })');
  log('seat 2 back:', JSON.stringify(back), 'moment on seat 2', await b2.ev(pred).catch(e => e.message));
  await b2.shot(`${name}-rejoin2`).catch(() => {});
  // seat 1 (fronted) quits and rejoins
  await closeTarget(b1.id); await sleep(8000);
  b1 = await openSeat(s1); await auto(b1);
  const back1 = await b1.ev('({ w: __c.where(), up: __c.up(), hints: localStorage.getItem("rangerat.hints.v1") })');
  log('seat 1 back:', JSON.stringify(back1), 'moment on seat 1', await b1.ev(pred).catch(e => e.message), 'before quit', JSON.stringify(before));
  await sleep(4000);
  log('seat 1 centre 4 s after rejoin', JSON.stringify(await b1.ev('__cLog.multi.slice(-5)')));
}
if (!noBell) {
  await watch(bellWait, "rr.crew.phase === 'report'");
  await sleep(3000);
  await b1.shot(`${name}-report`);
  const rep = await b1.ev("(() => { const r = document.getElementById('report') || document.querySelector('[id*=report]'); return r ? r.innerText.replace(/\\s+/g, ' ').slice(0, 900) : null; })()");
  log('report text:', rep);
}
log('CENTRE seat 1 (since its last load):', JSON.stringify(await b1.ev('({ overlaps: __centre.overlaps, log: __centre.log.slice(0, 8), long: __cLog.long })')));
log('CENTRE seat 2:', JSON.stringify(await b2.ev('({ overlaps: __centre.overlaps, log: __centre.log.slice(0, 8) })').catch(e => e.message)));
log('auto', JSON.stringify(await b1.ev('({ picks: __auto?.picks, deps: __auto?.deps, err: __auto?.err })').catch(() => null)));
console.log(JSON.stringify({ s1, s2, t1: b1.id, t2: b2.id }));
process.exit(0);
