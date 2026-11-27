// Reviewer C: a new 2P crew from scratch (Muni day 1), two windows, hints cleared. Pad Ready, then watch the shift.
import { BASE, http, openSeat, joinCrew, log, sleep, startDay } from './pt10c-lib.mjs';
const r = await http('POST', BASE + '/api/crew', { name: 'Cass' });
const s1 = { code: r.json.code, p: r.json.p, k: r.json.k };
const s2 = await joinCrew(s1.code, 'Dot');
log('crew', s1.code);
const b2 = await openSeat(s2);
const b1 = await openSeat(s1);
await b1.ev("try { localStorage.removeItem('rangerat.hints.v1') } catch {}; true");
await b1.page.send('Page.bringToFront');
log('fps (lobby)', (await b1.ev('__c.fps(2000)', 10000)).toFixed(1));
log('lobby', JSON.stringify(await b1.ev('__c.where()')), JSON.stringify(await b1.ev('__c.up()')));
await b1.shot('muni1-lobby');
// pad: Ⓐ on the lobby
await b1.ev("__pad.press('A', 150)"); await sleep(800); await b2.ev("__pad.press('A', 150)"); await sleep(3000);
log('after pad A', JSON.stringify(await b1.ev('__c.where()')));
if ((await b1.ev('rr.crew.phase')) !== 'shift') { log('pad A did not start the day; using startShift'); await startDay(b1); await b2.ev('rr.startShift(), true'); }
await b1.page.send('Page.bringToFront');
const t0 = Date.now(); const seen = [];
while (Date.now() - t0 < 300000) {
  const w = await b1.ev('__c.where()').catch(() => null); const u = await b1.ev('__c.up()').catch(() => []);
  const line = `${w?.phase} t${w?.t} $${w?.cash} | ` + u.map(x => x.id + ': ' + x.text.slice(0, 70)).join(' || ');
  if (seen.at(-1) !== line.replace(/t\d+ \$\d+/, '')) { console.log(line); seen.push(line.replace(/t\d+ \$\d+/, '')); }
  if (w?.phase === 'report') break;
  await sleep(1000);
}
log('frames', JSON.stringify(await b1.ev('__c.frames(4000)', 15000)));
await b1.shot('muni1-day1');
log('centre', JSON.stringify(await b1.ev('({ overlaps: __centre.overlaps, log: __centre.log, long: __cLog.long })')));
console.log(JSON.stringify({ s1, s2, t1: b1.id, t2: b2.id }));
process.exit(0);
