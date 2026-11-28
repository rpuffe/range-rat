// Hotfix after the round 10 final review (council-round14 §4.3): the named Highs only, each with a test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { endCardOnRejoin, ENDCARD_AT, ENDCARD_HOLD } from '../web/js/dayend.js';

test('C #1: a seat that rejoins during the ending report gets the end card back, and its Ready still ends the report', () => {
  const clock = { t: 1e6 };
  const crew = new Crew('HF10', { venue: 5, day: 18, venueDay: 2 }, { seed: 7, now: () => clock.t });
  const a = crew.join('A'); crew.connect(a);
  crew.startShift(); crew.endShift(true);
  assert.ok(crew.report.ending && crew.phase === 'report');
  const w = crew.welcome(a);   // the reload
  assert.ok(w.report?.ending, 'the welcome carries the ending report');
  assert.equal(endCardOnRejoin(w.s.phase, w.report, false), true, 'the rejoin builds the end card');
  assert.equal(endCardOnRejoin(w.s.phase, w.report, true), false, 'not twice');
  assert.equal(endCardOnRejoin('report', { day: 3 }, false), false, 'a normal report keeps its own panel');
  assert.equal(endCardOnRejoin('shift', w.report, false), false, 'endless day 1 has begun: no card');
  crew.readyUp(a);   // the rebuilt card's "Clock in tomorrow"
  for (let i = 0; i < (ENDCARD_AT + ENDCARD_HOLD + 2) * 10; i++) { clock.t += 100; a.seenAt = clock.t; crew.tick(0.1); }
  assert.equal(crew.phase, 'shift', 'the crew is not stuck');
});

test('A H1: pay floats hide while ANY centre item is up (a toast, the checklist), not just priority 0–1', async () => {
  const { worldTextHidden } = await import('../web/js/centrehooks.js');
  assert.equal(worldTextHidden({}), false, 'a clear centre: the floats show');
  assert.equal(worldTextHidden({ centreUp: true }), true, 'a toast or the checklist line: hidden');
  assert.equal(worldTextHidden({ story: true }), true);
  assert.equal(worldTextHidden({ hushing: true }), true);
  const src = (await import('node:fs')).readFileSync(new URL('../web/js/main.js', import.meta.url), 'utf8');
  assert.match(src, /const popsHidden = \(\) => worldTextHidden\(\{ centreUp: !!sayer\.centre\.up\(\)/, 'main.js gates on any centre item');
  const board = (await import('node:fs')).readFileSync(new URL('../web/js/board.js', import.meta.url), 'utf8');
  assert.match(board, /sp\.visible = !floatsHidden;/, 'a float born while the centre is taken starts hidden');
});

test('A H2: Gary\'s bubble steps aside for a centre item, except in a chat', async () => {
  const { garyBubbleShown } = await import('../web/js/centrehooks.js');
  assert.equal(garyBubbleShown({ says: true }), true, 'his hello with a clear centre');
  assert.equal(garyBubbleShown({ says: true, centreUp: true }), false, 'his hello under "Gary checks the return": hidden');
  assert.equal(garyBubbleShown({ ending: true, centreUp: true }), false);
  assert.equal(garyBubbleShown({ chatting: true, centreUp: true }), true, 'a chat: the bubble is the exchange');
  assert.equal(garyBubbleShown({}), false, 'nothing to say');
});
