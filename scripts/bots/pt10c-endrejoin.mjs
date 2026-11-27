// Reviewer C: repro. A solo seat carries Ball No. 1 home; when the end card is up, the window closes and the seat
// rejoins (a reload, a dropped Wi-Fi, the Xbox app suspended). Is there an end card, a report, a Ready? Does the crew
// ever get to endless day 1?
import { openSeat, devCrew, presetSave, log, sleep, startDay, closeTarget, AUTO_LIB } from './pt10c-lib.mjs';
const s1 = await devCrew(presetSave('lastbucket'), 'Cass');
let b = await openSeat(s1);
await b.ev(AUTO_LIB); await b.ev('__auto.start()');
await startDay(b);
const card = await b.waitFor("!!document.getElementById('endcard')", 300, 300);
log('end card up:', !!card, JSON.stringify(await b.ev('__c.where()')));
await sleep(3000);
await b.shot('endrejoin-before');
await closeTarget(b.id); await sleep(4000);
b = await openSeat(s1);
await sleep(4000);
const st = () => b.ev(`JSON.stringify({ w: __c.where(), endcard: !!document.getElementById('endcard'), report: !document.getElementById('report').classList.contains('hidden'), up: __c.up() })`);
log('after rejoin:', await st());
await b.shot('endrejoin-after');
await b.ev("__pad.press('A', 200)"); await sleep(1000); await b.ev("__pad.press('Y', 200)"); await sleep(1000);
for (const key of ['Space', 'Enter']) {
  await b.page.send('Input.dispatchKeyEvent', { type: 'keyDown', code: key, key: key === 'Space' ? ' ' : 'Enter', windowsVirtualKeyCode: key === 'Space' ? 32 : 13 });
  await sleep(150);
  await b.page.send('Input.dispatchKeyEvent', { type: 'keyUp', code: key, key: key === 'Space' ? ' ' : 'Enter', windowsVirtualKeyCode: key === 'Space' ? 32 : 13 });
  await sleep(800);
}
log('after A, Y, Space, Enter:', await st());
await sleep(90000);
log('90 s later:', await st());
process.exit(0);
