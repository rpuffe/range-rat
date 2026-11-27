// Council round 12, builder 4 ("look"): one centre text (say.js's PA idle signal, the story card's turn), the memo
// hooks and the venue gauge lines, the Board's endless lines, the late clock-in clear of the deck, and the fixes pack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSayModel, createSay, SAY, wordCount } from '../web/js/say.js';
import { memoSecond, MEMO_LINES, contractMemo, clockInSpot, CLOCK_IN, MEMO_FLAVORS, VENUE_RULES } from '../web/js/sim.js';
import { memoLine, gaugeChip, kpiNoteOf, contractLineOf, rivalLineOf, debrisHomeText } from '../web/js/bvtext.js';
import { checkGate, CHECK } from '../web/js/morning.js';
import { goalText, starText } from '../web/js/today.js';
import { Crew } from '../server/crew.mjs';
import { readFileSync } from 'node:fs';

// ---- 4c: the story card and the PA card ----------------------------------------------------------------------------
test('4c: a story card while a long PA card is up closes the PA card; its caption resumes after, without the audio', () => {
  let t = 0;
  const s = createSayModel({ now: () => t });
  s.say('PA', 'Your Ball Value is on a jumbotron.', { secs: 6 });
  s.update(); assert.equal(s.visible.kind, 'PA');
  t = 1; assert.equal(s.want(), true, 'granted at once: 5 s of PA left is more than PA_WAIT');
  assert.equal(s.visible, null, 'one centre element: the PA card is down');
  t = 3; s.update(); assert.equal(s.visible, null, 'nothing shows under the card');
  assert.equal(s.paIdle, false, 'the PA caption is waiting');
  s.release(); t = 3.4; s.update();
  assert.equal(s.visible?.kind, 'PA'); assert.equal(s.visible.resumed, true, 'resumed: pa.js shows the caption, no chime, no voice');
  assert.ok(Math.abs(s.visible.until - t - 5) < 1e-6, 'with the 5 s it had left');
});

test('4c: a PA card that ends within PA_WAIT goes first; a queued PA line still goes first', () => {
  let t = 0;
  const s = createSayModel({ now: () => t });
  s.say('PA', 'Short line.', { secs: 2.5 }); s.update();
  t = 1; assert.equal(s.want(), false, '1.5 s left: the card waits');
  assert.equal(s.visible.kind, 'PA');
  t = 2.6; s.update(); t = 2.95; s.update(); assert.equal(s.gate, 'on');
  assert.ok(SAY.PA_WAIT === 2);
  const q = createSayModel({ now: () => t });
  q.say('PA', 'Queued line.', { secs: 6 });
  assert.equal(q.want(), false, 'a PA line queued before the card goes first');
});

test('4c: while the story card holds the turn, nothing but the stamp is ever visible', () => {
  let t = 0;
  const s = createSayModel({ now: () => t });
  assert.equal(s.want(), true);
  s.say('MEMO', 'memo'); s.say('ALERT', 'alert'); s.say('PA', 'pa');
  for (t = 0.1; t < 5; t += 0.1) { s.update(); assert.equal(s.visible, null); }
  s.say('STAMP', 'APPROVED'); assert.equal(s.visible.kind, 'STAMP');
});

test('4c: the end card waits for PA idle, at most 2 s (whenPaIdle)', async () => {
  let t = 0;
  const els = {}, el = id => (els[id] ??= { classList: { _s: new Set(), contains(c) { return this._s.has(c); }, toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); } }, style: {}, textContent: '' });
  const sayer = createSay({ $: el, now: () => t, tick: 0, fades: () => false });
  const shown = [];
  sayer.say('PA', 'No more balls. Every ball mattered.', { secs: 5, data: { show: () => { el('pa-card').classList.add('on'); shown.push('on'); }, hide: () => el('pa-card').classList.remove('on') } });
  sayer.sync(); assert.equal(el('pa-card').classList.contains('on'), true);
  assert.equal(sayer.paIdle, false);
  let done = null; sayer.whenPaIdle().then(v => { done = v; });
  t = 1; sayer.sync(); await null; assert.equal(done, null, 'still up');
  t = 2.1; sayer.sync(); await null; await null; assert.equal(done, false, 'the 2 s cap: resolved, not idle (never a stuck end card)');
  let idle = null; t = 5.2; sayer.sync(); sayer.whenPaIdle(2).then(v => { idle = v; }); await null; await null;
  assert.equal(idle, true, 'the PA card closed: idle at once');
  assert.equal(sayer.paIdle, true);
});

// ---- 9.4: the checklist gate ------------------------------------------------------------------------------------------
test('9.4: the checklist stays down while text shows or waits, and for 1 s after the last', () => {
  const st = { lastBusy: -Infinity };
  assert.equal(checkGate(st, { t: 0 }), true, 'nothing ever: shows');
  assert.equal(checkGate(st, { busy: true, t: 1 }), false);
  assert.equal(checkGate(st, { waiting: true, t: 1.5 }), false, 'a queued item or a story beat waiting: down');
  assert.equal(checkGate(st, { t: 1.5 + CHECK.QUIET - 0.1 }), false, 'the quiet second');
  assert.equal(checkGate(st, { t: 1.5 + CHECK.QUIET }), true);
});

// ---- the memo hooks and 7e --------------------------------------------------------------------------------------------
test('memoSecond: news > contract > Today > NEW > MOW-E > note > flavour', () => {
  assert.equal(memoSecond({ flavor: 'f', note: 'n' }).line, 'n');
  assert.equal(memoSecond({ flavor: 'f', note: 'n', mowe: 'm' }).line, 'm');
  assert.equal(memoSecond({ today: 'WINDY', contract: 'Contract: x.' }).line, 'Contract: x.');
  assert.equal(memoSecond({ today: 'WINDY', contract: 'Contract: x.' }).today, null);
  assert.equal(memoSecond({ news: MEMO_LINES.acquired, contract: 'Contract: x.' }).line, MEMO_LINES.acquired);
  assert.equal(memoSecond({ today: 'WINDY', flavor: 'f' }).today, 'WINDY');
  assert.equal(contractMemo(goalText({ k: 'upright', n: 2 })), 'Contract: at most 2 knockdowns.');
  assert.equal(contractMemo(goalText({ k: 'upright', n: 0 })), 'Contract: nobody knocked flat.');
});

test('7e: the Stadium and County memos name their gauge; the HUD chip, red under 50 %', () => {
  assert.equal(memoLine(35, 3), 'Today: 35% clean. Crowd over half.');
  assert.equal(memoLine(35, 4), 'Today: 35% clean. Zoning over half.');
  assert.equal(memoLine(60, 0), 'Today: 60% clean by the bell.', 'the Muni is unchanged');
  assert.deepEqual(gaugeChip(3, 0.82), { text: ' · crowd 82%', red: false });
  assert.deepEqual(gaugeChip(4, 0.41), { text: ' · Zoning 41%', red: true });
  assert.equal(gaugeChip(2, 0.5), null); assert.equal(gaugeChip(3, null), null); assert.equal(gaugeChip(3, 0.5, true), null);
});

test('the Board hooks: Stretch, inspection, contract and Site 13 lines', () => {
  assert.equal(kpiNoteOf({ stadium: { stretch: { secs: ['A', 'C', 'F'], t: 25 }, req: { sec: 'B', t: 9 } } }), 'SEVENTH-INNING STRETCH · A C F · 0:25');
  assert.equal(kpiNoteOf({ stadium: { stretch: { secs: 'AC', t: 4.2 } } }), 'SEVENTH-INNING STRETCH · A C · 0:05');
  assert.equal(kpiNoteOf({ county: { inspect: { yard: 2, t: 45 }, label: '7 HAZARDS' } }), 'INSPECTION · YARD 2 · 0:45');
  assert.equal(kpiNoteOf({ county: { label: '7 HAZARDS' } }), '7 HAZARDS', 'the everyday note is unchanged');
  const c = { stars: 2, goal: { k: 'upright', n: 2 } };
  assert.deepEqual(contractLineOf({ ...c, so: 1 }, goalText, starText), { text: '★★☆ AT MOST 2 KNOCKDOWNS · 1 SO FAR', state: 'live' });
  assert.deepEqual(contractLineOf({ ...c, state: 'met' }, goalText, starText), { text: '★★☆ MET', state: 'met' });
  assert.equal(contractLineOf({ ...c, state: 'lost' }, goalText, starText).state, 'lost');
  assert.equal(contractLineOf(null, goalText, starText), null);
  assert.equal(rivalLineOf({ cash: 41_800_000 }), 'SITE 13 $41.8M (est.)');
  assert.equal(rivalLineOf(null), null);
  assert.equal(debrisHomeText(120, 10), '+1,200 balls home', 'the commas are back');
});

// ---- 4a: the late clock-in clears the Tiered deck --------------------------------------------------------------------
test('4a: from the Stadium on, every clock-in spot is clear of the deck and its corner is outside the view', () => {
  const half = Math.atan(Math.tan(35 * Math.PI / 180) * 4 / 3);   // 70° vertical FOV at 4:3: ~43° horizontal half-angle
  for (const v of [3, 4, 5]) for (let k = 0; k < 6; k++) {
    const c = clockInSpot(v, k);
    assert.ok(c.x > 20.5, `venue ${v} slot ${k} x ${c.x} is past the deck's right end`);
    const ang = Math.atan2(c.x - 20, c.z - 2) - Math.abs(c.yaw ?? 0);   // the deck's front corner (20, z 2), seen facing -z turned by the clock-in yaw (round 14 6.3)
    assert.ok(ang > half, `slot ${k}: the deck corner is ${(ang * 180 / Math.PI).toFixed(0)}° off, outside the view`);
  }
  assert.deepEqual(clockInSpot(0, 1), { x: CLOCK_IN.X + CLOCK_IN.STEP, z: CLOCK_IN.Z }, 'the Muni is unchanged (goldens)');
  assert.deepEqual({ ...clockInSpot(2, 0), yaw: undefined }, { x: CLOCK_IN.LATE_XS[0], z: 4, yaw: undefined }, 'council round 13 #6: the Club and Tiered use the late row too');
  assert.equal(clockInSpot(1, 0, true).x, CLOCK_IN.ENDLESS_XS[0], 'round 14 6.1: endless clocks in on its own row');
  for (let k = 0; k < 6; k++) { const x = clockInSpot(3, k).x; assert.ok(x > 23.5 && !(x > 25.9 && x < 29.1), `slot ${k} x ${x}: past the awning, off the washer`); }
});

test('4a: a Stadium shift clocks the crew in on the late row', () => {
  const crew = new Crew('LK12', { venue: 3, venueDay: 2, day: 15 }, { seed: 7, now: () => 1e6 });
  for (let i = 0; i < 4; i++) crew.join('Rat' + i);
  crew.startShift();
  for (const p of crew.players.values()) assert.ok(CLOCK_IN.LATE_XS.includes(p.x) && p.z === 4, `${p.x},${p.z}`);
});

// ---- the fixes pack ---------------------------------------------------------------------------------------------------
test('9.3: the Orbital memo says 1,958 once; 9.8: every memo flavour is 8 words or fewer', () => {
  assert.ok(!/1,958/.test(VENUE_RULES[5].memo));
  for (const f of MEMO_FLAVORS) assert.ok(wordCount(f) <= 8, f);
});

test('9.1: the endless preset is a true first endless morning and plays the epilogue', () => {
  const j = JSON.parse(readFileSync(new URL('../server/presets/endless.json', import.meta.url), 'utf8'));
  assert.equal(j.save.endlessFresh, true); assert.equal(j.save.offers, undefined); assert.equal(j.save.records?.owner, undefined);
  const crew = new Crew('LK13', structuredClone(j.save), { seed: 7, now: () => 1e6 });
  assert.equal(crew.endlessFresh, true, 'loaded');
  crew.join('Rat'); crew.startShift();
  const ev = crew.flush().ev ?? crew.events;
  assert.ok(ev.some(e => e.t === 'story' && e.id === 'epilogue'), 'the epilogue plays');
  assert.equal(crew.contract ?? null, null, 'no contract from the Orbital record on the first endless morning');
  assert.equal(new Crew('LK14', crew.toSave?.() ?? null, { seed: 7 }).endlessFresh, false, 'spent once the morning starts');
});

test('the boss morning names the update; the endless memo names the contract', () => {
  const j = JSON.parse(readFileSync(new URL('../server/presets/endless.json', import.meta.url), 'utf8'));
  const save = structuredClone(j.save); delete save.endlessFresh;
  const crew = new Crew('LK15', save, { seed: 7, now: () => 1e6 });
  crew.join('Rat'); crew.startShift();
  const memo = (crew.flush().ev ?? []).find(e => e.t === 'memo');
  if (crew.contract) assert.match(memo.flavor, /^Contract: /);
  assert.equal(memo.today ?? null, null, 'the contract takes Today\'s slot');
});

// ---- 9.5: the bubble clamp (a fake camera at the origin looking down -z, 70° vertical FOV) ---------------------------
import { clampBubbleY, BUBBLE } from '../web/js/bubbleclamp.js';
test('9.5: a bubble near the camera is lowered until its top is under 70 % of the screen', () => {
  const tanH = Math.tan(35 * Math.PI / 180), eye = 1.65;
  const v = { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; },
    project() { const d = -this.z; this.y = d > 0 ? (this.y - eye) / (d * tanH) : 0; this.z = d > 0 ? 0.5 : 2; return this; } };
  const near = clampBubbleY(3.15, { x: 0, z: -1.5, half: 0.16 }, null, v);
  assert.ok(near < 3.15 && near >= BUBBLE.MIN, `lowered to ${near.toFixed(2)}`);
  assert.ok((near + 0.16 - eye) / (1.5 * tanH) <= BUBBLE.TOP + 1e-6, 'its top is under the line');
  assert.equal(clampBubbleY(3.15, { x: 0, z: -12, half: 0.16 }, null, v), 3.15, 'far away: unchanged');
  assert.equal(clampBubbleY(3.15, { x: 0, z: 3, half: 0.16 }, null, v), 3.15, 'behind the camera: unchanged');
});
