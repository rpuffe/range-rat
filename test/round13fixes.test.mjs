// Council round 11, builder 4: one morning, one memo (#3) and the fixes pack (#8). Pure rules plus the server's
// morning; design/round13-fixes.md has the measurements (scripts/bots/textload.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { VENUE_RULES, KIND_NEW, kindNewLine, kindsOpening, kindOpen, memoSecond, debutFloat, pickKind, LOBBY_TAGLINE, lobbyTagline, MORNING_KINDS } from '../web/js/sim.js';
import { CLUB_DAY, clubOpen } from '../web/js/clubdays.js';
import { wordCount, createSay, createSayModel, SAY } from '../web/js/say.js';
import { skeleton, shouldFlip, kpiNoteOf, debrisHomeText } from '../web/js/bvtext.js';
import { rowsOf, strip, CARDS, winchLine, skyPieces } from '../web/js/goals.js';
import { createFallAgg } from '../web/js/feedagg.js';

const words = t => wordCount(t);

// ---- #3: one morning, one memo -------------------------------------------------------------------------------------
test('#3: every NEW line, venue memo and pair line is 8 words or fewer', () => {
  for (const v of [1, 2, 3, 4, 5]) { assert.ok(VENUE_RULES[v].memo.startsWith('NEW: '), v); assert.ok(words(VENUE_RULES[v].memo) <= 8, VENUE_RULES[v].memo); }
  for (const [k, t] of Object.entries(KIND_NEW)) assert.ok(words(t) <= 8, `${k}: ${t}`);
  for (const a of MORNING_KINDS) for (const b of MORNING_KINDS) if (a !== b) assert.ok(words(kindNewLine([a, b])) <= 8, kindNewLine([a, b]));
  assert.equal(kindNewLine(['bouncy', 'splitter']), 'NEW: bouncy balls ×1.5 and splitters.');
  assert.equal(kindNewLine([]), null);
  for (const t of LOBBY_TAGLINE) assert.ok(words(t) <= 8, t);
  assert.equal(lobbyTagline(4), 'Bag the hazards. Sweep the Yards.');
  assert.equal(lobbyTagline(0, false, 1), 'Pick up balls. Bank them.');
  assert.equal(lobbyTagline(5, true), LOBBY_TAGLINE[6]);
});

test('#3: Club day 4 debuts bouncy and the splitter; day 3 belongs to MOW-E; the splitter stays day 7 elsewhere', () => {
  assert.equal(CLUB_DAY.bouncy, 4); assert.equal(CLUB_DAY.splitter, 4); assert.equal(CLUB_DAY.mower, 3);
  assert.equal(clubOpen('splitter', 1, 3), false); assert.equal(clubOpen('splitter', 1, 4), true);
  assert.equal(pickKind(9, 1, () => 0.02, 3), 'square', 'Club day 3: no splitter, no bouncy (the draw falls through)');
  assert.equal(pickKind(9, 1, () => 0.02, 4), 'splitter');
  assert.equal(pickKind(6, 2, () => 0.02), 'bouncy', 'Tiered, global day 6: no splitter yet');
  assert.equal(pickKind(7, 2, () => 0.02), 'splitter');
  assert.equal(kindOpen('lead', 5, 1, 1), false); assert.equal(kindOpen('lead', 5, 1, 2), true);
  assert.deepEqual(kindsOpening(8, 1, 4, ['square', 'gold', 'lead']), ['bouncy', 'splitter']);
  assert.deepEqual(kindsOpening(8, 1, 3, new Set(['square', 'gold', 'lead'])), []);
});

test('#3: the memo second line: Today > a NEW line > MOW-E > the flavour; a NEW line that loses to Today floats instead', () => {
  assert.deepEqual(memoSecond({ today: 'Windy today.', kindNew: 'NEW: x', flavor: 'f' }), { today: 'Windy today.', line: null, lost: 'NEW: x' });
  assert.deepEqual(memoSecond({ venueNew: 'NEW: v', kindNew: 'NEW: k', mowe: 'm', flavor: 'f' }), { today: null, line: 'NEW: v', lost: null });
  assert.equal(memoSecond({ kindNew: 'NEW: k', mowe: 'm', flavor: 'f' }).line, 'NEW: k');
  assert.equal(memoSecond({ mowe: 'MOW-E sends his regards.', flavor: 'f' }).line, 'MOW-E sends his regards.');
  assert.equal(memoSecond({ flavor: 'f' }).line, 'f');
  assert.equal(debutFloat('bouncy'), 'NEW ×1.5');
  assert.equal(debutFloat('square', false), 'NEW: square ×2');
  assert.equal(debutFloat('splitter'), 'NEW');
});

function crewAt(save, n = 4) {
  const clock = { t: 1e6 };
  const crew = new Crew('R13F', save, { seed: 7, now: () => clock.t });
  for (let i = 0; i < n; i++) crew.connect(crew.join('R' + i));
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, run };
}

test('#3: a kind told in the morning joins debuts, emits told on its first hit, and no second memo or kind PA', () => {
  const { crew, run } = crewAt({ venue: 1, day: 9, venueDay: 3, debuts: ['glow', 'gold', 'square', 'lead'], voiced: ['welcome'] });
  crew.flush();
  crew.startShift();   // Club day 4
  let ev = crew.flush().ev;
  const memos = ev.filter(e => e.t === 'memo');
  assert.equal(memos.length, 1, 'one memo');
  assert.deepEqual(memos[0].kinds, ['bouncy', 'splitter']);
  if (!memos[0].today) assert.equal(memos[0].flavor, 'NEW: bouncy balls ×1.5 and splitters.');
  assert.ok(crew.debuts.has('bouncy') && crew.debuts.has('splitter'), 'told kinds join debuts at the morning');
  for (const m of crew.mats) m.next = 0;
  const seen = [];
  for (let s = 0; s < 240 && seen.length < 2; s++) { run(1); for (const e of crew.flush().ev) { if (e.t === 'debut') seen.push(e); assert.ok(!(e.t === 'pa' && ['bouncy', 'splitter', 'square', 'gold', 'lead'].includes(e.id)), 'no kind PA'); assert.notEqual(e.t, 'memo'); } }
  assert.ok(seen.length >= 1, 'a debut fired');
  for (const e of seen) { assert.equal(e.told, !memos[0].today, `${e.kind} told`); assert.ok(e.id != null); }
  assert.equal(new Set(seen.map(e => e.kind)).size, seen.length, 'once each');
});

test('#3 / 8.4: the Last Bucket morning memo is quiet; a story morning flags its memo (5 s)', () => {
  const lb = crewAt({ venue: 5, day: 20, venueDay: 2, outstanding: 1, voiced: ['welcome'] });
  lb.crew.flush(); lb.crew.startShift();
  const m = lb.crew.flush().ev.find(e => e.t === 'memo');
  assert.equal(m.quiet, true, 'BALL NO. 1 is the one text');
  assert.ok(lb.crew.lastBucket, 'the Last Bucket began this morning');
  const promo = crewAt({ venue: 2, day: 12, venueDay: 0, pendingReveal: 2, voiced: ['welcome'] });
  promo.crew.flush(); promo.crew.startShift();
  const ev = promo.crew.flush().ev, pm = ev.find(e => e.t === 'memo');
  assert.equal(pm.story, true);
  assert.equal(pm.flavor, VENUE_RULES[2].memo, 'the reveal folds into the memo');
  assert.equal(SAY.STORY_MEMO, 5);
  assert.equal(ev.filter(e => e.t === 'memo').length, 1);
});

// ---- 8.1: the jumbotron flip ---------------------------------------------------------------------------------------
test('8.1: a countdown or a BV tick never flips; a new word does; a < 1 % price move never does', () => {
  assert.equal(skeleton('GARY FROM REGIONAL · 0:12'), 'GARY FROM REGIONAL · #:##');
  assert.equal(shouldFlip('GARY FROM REGIONAL · 0:12', 'GARY FROM REGIONAL · 0:11'), false);
  assert.equal(shouldFlip('MOW-E · ROGUE · 0:15', 'MOW-E · ROGUE · 0:09'), false);
  assert.equal(shouldFlip('$2,410', '$2,420', 2410, 2420), false, 'same skeleton');
  assert.equal(shouldFlip('$999', '$1,000', 999, 1000), false, '< 1 %: no flip even with a new skeleton');
  assert.equal(shouldFlip('$95', '$105', 95, 105), true, 'a real jump with a new skeleton flips');
  assert.equal(shouldFlip('EVERY BALL MATTERS', 'LAST CALL'), true);
  assert.equal(shouldFlip('S:DAYS WITHOUT AN INCIDENT: 3', 'S:DAYS WITHOUT AN INCIDENT: 4'), false);
  assert.equal(kpiNoteOf({ county: { label: '7 HAZARDS' } }), '7 HAZARDS');
  assert.equal(kpiNoteOf({ stadium: { req: { sec: 'C', t: 17.2 } } }), 'SECTION C WANTS A BALL · 0:18');
  assert.equal(kpiNoteOf({ stadium: { req: 'SECTION B WANTS A BALL · 0:05' } }), 'SECTION B WANTS A BALL · 0:05');
  assert.equal(kpiNoteOf({}), null);
});

// ---- 8.6: a card fading in over a card fading out -------------------------------------------------------------------
function fakeDom() {
  const els = {};
  const el = id => (els[id] ??= { id, textContent: '', cls: new Set(id === 'memo' ? ['hidden'] : []), style: { transition: '' }, on: {},
    classList: { toggle(c, on) { on ? this.o.cls.add(c) : this.o.cls.delete(c); }, contains(c) { return this.o.cls.has(c); } },
    addEventListener(t, f) { this.on[t] = f; }, removeEventListener(t) { delete this.on[t]; } });
  const $ = id => { const e = el(id); e.classList.o = e; return e; };
  return { $, els };
}
test('8.6: the next card waits for the outgoing card\'s fade (transitionend, ≤ 0.3 s); the stamp never waits', () => {
  let t = 0;
  const dom = fakeDom();
  const s = createSay({ $: dom.$, now: () => t, tick: 0, fades: el => el.id === 'toast' });
  s.say('TOAST', 'one', { secs: 1.2 }); s.sync();
  assert.equal(dom.$('toast').textContent, 'one');
  s.say('ALERT', 'two', { secs: 2 });
  t = 1.25; s.sync(); t = 1.6; s.sync();   // 'one' is done; the gap passed: 'two' is due but 'one' is still fading
  assert.equal(dom.$('toast').classList.contains('show'), false, 'the outgoing card is fading');
  assert.equal(dom.$('toast').textContent, 'one', 'two waits');
  dom.$('toast').on.transitionend({ target: dom.$('toast') });   // the fade ends
  assert.equal(dom.$('toast').textContent, 'two');
  // No transitionend: at most SAY.FADE_MAX.
  s.say('TOAST', 'three', { secs: 1.2 });
  t = 3.7; s.sync(); t = 4.1; s.sync();
  assert.notEqual(dom.$('toast').textContent, 'three');
  t = 4.1 + SAY.FADE_MAX + 0.01; s.sync();
  assert.equal(dom.$('toast').textContent, 'three');
  // The stamp preempts at once.
  s.say('TOAST', 'four', { secs: 2 }); t += 0.5; s.sync();
  s.say('STAMP', 'APPROVED', { data: { show() {}, hide() {} } }); s.sync();
  assert.equal(s.visible.kind, 'STAMP');
  s.stop();
});
test('8.6: a story card taking the turn snaps the outgoing card off (no fade)', () => {
  let t = 0;
  const dom = fakeDom();
  const s = createSay({ $: dom.$, now: () => t, tick: 0, fades: el => el.id === 'toast' });
  s.say('TOAST', 'one', { secs: 1.2 }); s.sync();
  t = 1.25; s.sync();
  assert.equal(s.model.want(), false, 'the gap first');
  t = 1.6; s.sync();
  assert.equal(s.gate, 'on');
  assert.equal(dom.$('toast').style.transition, 'none', 'snapped');
  s.stop();
});

// ---- 8.7 / 8.8: the goal rows --------------------------------------------------------------------------------------
test('8.7: the Seal row says it needs a huddle; 8.8: the sky row counts pieces and the strip names the winch price', () => {
  const club = rowsOf({ venue: 1, scale: 1, crew: 4, need: {}, n: {}, done: [], who: [] }, {}).find(r => r.id === 'seal');
  if (club) assert.equal(club.text, "Earn Gary's Seal: huddle at the return");
  assert.ok(words("Earn Gary's Seal: huddle at the return") <= 8);
  assert.equal(skyPieces(570, 4), 57); assert.equal(skyPieces(570, 1), 38);
  const card = { venue: 5, scale: 1, crew: 4, need: { debris: 60 }, n: {}, done: ['lift', 'debris'], who: [] };
  const rows = rowsOf(card, { up: {}, cash: 9.1e6, sky: true, skyOut: 1, skyUp: 0 });
  const tether = rows.find(r => r.id === 'tether');
  assert.ok(tether.price > 0, 'the winch row carries its price');
  assert.equal(strip(rows, 5).next, winchLine(tether.price, 9.1e6));
  assert.match(strip(rows, 5).next, /^SKY CLEAR · WINCH \$[\d.]+M · YOU HAVE \$9\.1M$/);
  assert.notEqual(strip(rowsOf(card, { up: {}, cash: 1, sky: false, skyOut: 100 }), 5).next.slice(0, 9), 'SKY CLEAR', 'not while the sky is up');
  assert.equal(debrisHomeText(1, 10), '+10 balls home'); assert.equal(debrisHomeText(2, 15), '+30 balls home');
  assert.equal(CARDS[5].at(-1).id, 'sky');
});

// ---- 8.10: helper falls ---------------------------------------------------------------------------------------------
test('8.10: helper falls: the first at once, the rest of the minute in one "Helpers flattened ×N" line', () => {
  let t = 0;
  const a = createFallAgg({ now: () => t });
  assert.equal(a.add('Kev got knocked flat'), 'Kev got knocked flat');
  t = 5; assert.equal(a.add('Sal got knocked flat'), null);
  t = 9; assert.equal(a.add('Kev got knocked flat'), null);
  t = 30; assert.equal(a.due(), null, 'not before the minute');
  t = 60; assert.equal(a.due(), 'Helpers flattened ×2');
  t = 61; assert.equal(a.add('Bo got knocked flat'), null, 'the minute line counts as the minute');
  t = 121; assert.equal(a.due(), 'Helpers flattened ×1');
  t = 200; assert.equal(a.add('Bo got knocked flat'), 'Bo got knocked flat');
});
