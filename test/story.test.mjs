// Round 12: the story beats (web/js/story.js), the server's once-per-crew triggers (server/crew.mjs storyBeat), the
// card sequence model, and say.js's story turn (want / release).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEATS, BEAT_BY_ID, BEAT_IDS, STORY, WHO, beatFor, cleanStory, coldDue, midDue, createStoryModel, GARY_HELLO, GARY_BYE, garyHello, garyBye } from '../web/js/story.js';
import { createSayModel, wordCount } from '../web/js/say.js';
import { Crew } from '../server/crew.mjs';

const storyEvents = crew => crew.events.filter(e => e.t === 'story').map(e => e.id);
function crewAt(save, { test: isTest = false } = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('STRY', save ? { ...save, ...(isTest ? { test: true } : {}) } : null, { shiftSecs: 60, seed: 3, now: () => clock.t });
  const a = crew.join('A'); crew.connect(a);
  return crew;
}

// ---- the table -------------------------------------------------------------------------------------------------
test('every story line is 8 words or fewer, and every head too', () => {
  for (const b of BEATS) for (const c of b.cards) {
    assert.ok(wordCount(c.line) <= STORY.MAX_WORDS, `${b.id}: "${c.line}" is ${wordCount(c.line)} words`);
    if (c.head) assert.ok(wordCount(c.head) <= STORY.MAX_WORDS, c.head);
  }
  for (const l of [...GARY_HELLO, ...GARY_BYE]) assert.ok(wordCount(l) <= STORY.MAX_WORDS, l);
});

test('every beat has 2-4 cards (the note: one), a known speaker, and a unique id', () => {
  assert.equal(new Set(BEAT_IDS).size, BEATS.length);
  for (const b of BEATS) {
    if (b.id === 'note') assert.equal(b.cards.length, 1);
    else assert.ok(b.cards.length >= 2 && b.cards.length <= 4, b.id);
    for (const c of b.cards) assert.ok(Object.hasOwn(WHO, c.who), `${b.id}: ${c.who}`);
    assert.equal(BEAT_BY_ID[b.id], b);
  }
});

test('every venue 0-5 has a promotion beat (the Muni: the cold open) and a mid-venue beat', () => {
  for (let v = 0; v <= 5; v++) {
    assert.ok(beatFor('promo', v), `promo ${v}`);
    assert.ok(beatFor('mid', v), `mid ${v}`);
  }
  assert.equal(beatFor('promo', 0).id, 'cold');
  for (let v = 1; v <= 5; v++) assert.equal(beatFor('promo', v).id, 'promo:' + v);
});

test('the cold open, the note, the epilogue and the mid beats exist; the cold open is 2-3 cards, the epilogue 3', () => {
  const cold = BEAT_BY_ID.cold, epi = BEAT_BY_ID.epilogue, note = BEAT_BY_ID.note;
  assert.ok(cold && cold.cards.length >= 2 && cold.cards.length <= 3);
  assert.equal(epi.cards.length, 3, 'council round 11 #4: Gary\'s bucket, Dimples retiring, the sign');
  assert.equal(beatFor('epilogue').id, 'epilogue');
  assert.equal(beatFor('note').id, 'note');
  assert.match(note.cards[0].head, /INSIDE BALL No\. 1/);
  assert.match(note.cards[0].line, /Whoever finds this: the range is yours/);
  assert.match(cold.cards.map(c => c.line).join(' '), /Site 12/);
  assert.match(cold.cards.map(c => c.line).join(' '), /probation/);
  const e = [...note.cards, ...epi.cards].map(c => (c.head ?? '') + ' ' + c.line).join(' ');
  for (const k of [/Ball No\. 1/i, /tie/, /Dimples|Site 13/, /Under New Management/]) assert.match(e, k);
});

test('every promotion beat carries both threads: a Gary or founder card, and a Corporate (MEMO) card', () => {
  for (let v = 1; v <= 5; v++) {
    const b = beatFor('promo', v), text = b.cards.map(c => c.line).join(' ');
    assert.ok(b.cards.some(c => c.who === 'GARY') || /1958|founder|Gary/.test(text), `promo ${v}: thread 1`);
    assert.ok(b.cards.some(c => c.who === 'MEMO'), `promo ${v}: thread 2`);
  }
  assert.match(beatFor('promo', 4).cards.map(c => c.line).join(' '), /acquired Site 13/, 'FHI acquires Site 13 at the County');
  assert.match(beatFor('promo', 5).cards.map(c => c.line).join(' '), /always wanted to see it/);
});

test('Gary lines by venue: six, clamped', () => {
  assert.equal(GARY_HELLO.length, 6); assert.equal(GARY_BYE.length, 6);
  assert.equal(garyHello(0), GARY_HELLO[0]); assert.equal(garyBye(9), GARY_BYE[5]); assert.equal(garyHello(undefined), GARY_HELLO[0]);
});

test('cleanStory keeps known ids once (an old save has none)', () => {
  assert.deepEqual(cleanStory(undefined), []);
  assert.deepEqual(cleanStory(['cold', 'cold', 'nope', 3, 'promo:2']), ['cold', 'promo:2']);
});

// ---- the trigger rules -------------------------------------------------------------------------------------------
test('coldDue: day 1 at the Muni, not a test crew, not endless', () => {
  assert.equal(coldDue({ day: 1, venue: 0 }), true);
  assert.equal(coldDue({ day: 1, venue: 0, test: true }), false);
  assert.equal(coldDue({ day: 2, venue: 0 }), false);
  assert.equal(coldDue({ day: 1, venue: 1 }), false);
  assert.equal(coldDue({ day: 1, venue: 0, endless: true }), false);
});

test('midDue: from the second morning; never on Promotion Day, a Today day, a reveal morning or the Last Bucket', () => {
  assert.equal(midDue({ venue: 2, venueDay: 2 }), 'mid:2');
  assert.equal(midDue({ venue: 2, venueDay: 1 }), null, 'the reveal morning is the promotion beat');
  assert.equal(midDue({ venue: 2, venueDay: 2, promoDay: true }), null, 'Promotion Day skips it');
  assert.equal(midDue({ venue: 2, venueDay: 2, today: { id: 'windy' } }), null, 'a Today modifier: no second text');
  assert.equal(midDue({ venue: 2, venueDay: 3, reveal: true }), null);
  assert.equal(midDue({ venue: 5, venueDay: 3, lastBucket: true }), null);
  assert.equal(midDue({ venue: 2, venueDay: 2, endless: true }), null);
  assert.equal(midDue({ venue: 0, venueDay: 5 }), 'mid:0');
});

// ---- the server: once per crew, saved -------------------------------------------------------------------------------
test('server: a new crew gets the cold open on day 1, once, and it is saved', () => {
  const crew = crewAt(null);
  crew.startShift();
  assert.deepEqual(storyEvents(crew), ['cold']);
  const ev = crew.events.map(e => e.t === 'pa' ? 'pa:' + e.id : e.t);
  assert.ok(ev.indexOf('story') < ev.indexOf('pa:welcome'), 'the cold open goes before the welcome PA');
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  assert.deepEqual(save.story, ['cold']);
  const again = crewAt({ ...save, day: 1 });   // a reload into day 1 again (a crash): no replay
  again.startShift();
  assert.deepEqual(storyEvents(again), []);
});

test('server: a skip-ahead test crew skips the cold open but sees its venue\'s promotion beat', () => {
  const t = crewAt({ v: 5, day: 1, venue: 0, venueDay: 0 }, { test: true });
  t.startShift();
  assert.deepEqual(storyEvents(t), []);
  const club = crewAt({ v: 5, day: 5, venue: 1, venueDay: 0, pendingReveal: 1 }, { test: true });
  club.startShift();
  assert.deepEqual(storyEvents(club), ['promo:1']);
  const ev = club.events.map(e => e.t === 'pa' ? 'pa' : e.t);
  assert.ok(ev.indexOf('pa') < ev.indexOf('story'), 'the promotion beat follows the reveal\'s PA line');
});

test('server: the mid-venue beat fires on a plain later morning, once; never twice across saves', () => {
  const crew = crewAt({ v: 5, day: 7, venue: 1, venueDay: 1, story: ['cold', 'promo:1'] });
  crew.startShift();
  assert.equal(crew.today, null);
  assert.deepEqual(storyEvents(crew), ['mid:1']);
  const save = JSON.parse(JSON.stringify(crew.toSave()));
  const next = crewAt({ ...save, story: [...(save.story ?? []), 'mid:1'] });
  next.startShift();
  assert.deepEqual(storyEvents(next), []);
});

test('server: a Today modifier holds the mid beat (one text a morning) until a plain morning', () => {
  const crew = crewAt({ v: 5, day: 6, venue: 2, venueDay: 2, garyDay: 99, story: ['promo:2'] });
  crew.startShift();
  assert.ok(crew.today, 'a Today day');
  assert.deepEqual(storyEvents(crew), []);
  assert.equal(crew.story.has('mid:2'), false);
});

test('server: the mid beat skips Promotion Day', () => {
  const crew = crewAt({ v: 5, day: 9, venue: 2, venueDay: 2, promoDay: 9, story: ['promo:2'] });
  crew.startShift();
  assert.equal(crew.promoDay, crew.day);
  assert.deepEqual(storyEvents(crew), []);
  assert.equal(crew.story.has('mid:2'), false, 'still to come');
});

test('server: an old save with no story list loads (every beat still to come) and keeps no empty key', () => {
  const crew = crewAt({ v: 5, day: 3, venue: 0, venueDay: 2 });
  assert.equal(crew.story.size, 0);
  assert.equal('story' in crewAt({ v: 5, day: 3, venue: 0, venueDay: 2 }).toSave(), false);
  assert.deepEqual([...crewAt({ v: 5, day: 3, venue: 0, story: ['junk', 'cold'] }).story], ['cold']);
});

test('server: the epilogue plays on the first Under New Management morning, before its PA', () => {
  const crew = crewAt({ v: 5, day: 21, venue: 5, venueDay: 3, story: ['promo:5', 'mid:5', 'note'] });
  crew.endless = true; crew.endlessFresh = true; crew.phase = 'report';
  crew.startShift();
  assert.deepEqual(storyEvents(crew), ['epilogue']);
  const ev = crew.events.map(e => e.t === 'pa' ? 'pa:' + e.id : e.t);
  assert.ok(ev.indexOf('story') < ev.indexOf('pa:endless'));
});

test('storyBeat draws no RNG', () => {
  const crew = crewAt(null);
  let draws = 0; const r = crew.rng; crew.rng = () => { draws++; return r(); };
  crew.storyBeat('mid:3'); crew.storyBeat('mid:3');
  assert.equal(draws, 0);
  assert.equal(storyEvents(crew).length, 1);
});

// ---- the card sequence -----------------------------------------------------------------------------------------------
test('story model: press advances after the grace, auto-advance after CARD_SECS, skip ends the beat', () => {
  let t = 0;
  const m = createStoryModel({ now: () => t });
  assert.equal(m.add('cold'), true); assert.equal(m.add('cold'), false, 'no double queue');
  assert.equal(m.add('nope'), false);
  m.begin();
  assert.equal(m.index, 0);
  m.press(); assert.equal(m.index, 0, 'a mashed press inside the grace is ignored');
  t = 1; m.press(); assert.equal(m.index, 1);
  t = 1 + STORY.CARD_SECS - 0.1; m.tick(); assert.equal(m.index, 1);
  t = 1 + STORY.CARD_SECS; m.tick(); assert.equal(m.index, 2);
  t += STORY.CARD_SECS; m.tick(); assert.equal(m.up, false, 'the last card ends the beat');
  m.add('mid:0'); m.begin(); assert.equal(m.up, true); m.skip(); assert.equal(m.up, false);
});

// ---- say.js: the story turn --------------------------------------------------------------------------------------------
test('say: the story turn waits for the PA line, then nothing else shows until release', () => {
  let t = 0;
  const s = createSayModel({ now: () => t });
  s.say('PA', 'Promoted to the Range Club.', { secs: 4 });
  s.say('MEMO', 'Reveal memo', { secs: 5 });
  assert.equal(s.want(), false, 'a PA line waits: not granted');
  s.update(); assert.equal(s.visible.kind, 'PA');
  t = 4.1; s.update(); t = 4.5; s.update();
  assert.equal(s.gate, 'on'); assert.equal(s.visible, null, 'the memo waits behind the card');
  s.say('TOAST', 'hi'); t = 5; s.update(); assert.equal(s.visible, null);
  s.say('STAMP', 'APPROVED'); assert.equal(s.visible.kind, 'STAMP', 'the stamp still preempts');
  t = 7; s.update();
  s.release(); t = 7.5; s.update();
  assert.equal(s.visible?.kind, 'MEMO');
});

test('say: the story turn is granted at once when nothing is up (the cold open goes before the PA)', () => {
  let t = 10;
  const s = createSayModel({ now: () => t });
  s.say('MEMO', 'Morning memo');
  assert.equal(s.want(), true);
  s.say('PA', 'Good morning.');
  t = 12; s.update(); assert.equal(s.visible, null);
  s.release(); t = 12.4; s.update(); assert.equal(s.visible?.kind, 'PA');
});

// ---- council round 11 #4: the note at the huddle, the epilogue's held clock ----------------------------------------
import { readFileSync } from 'node:fs';
import { NOTE, BANK_SEQ, EPILOGUE_HOLD } from '../web/js/story.js';
import { SIM } from '../web/js/sim.js';

// The lastbucket preset (server/presets), at 1-4 Rats, run to Ball No. 1 on the field.
function lastBucket(n = 1) {
  const save = JSON.parse(readFileSync(new URL('../server/presets/lastbucket.json', import.meta.url), 'utf8')).save;
  let t = 0;
  const c = new Crew('NOTE', JSON.parse(JSON.stringify(save)), { now: () => t * 1000, seed: 7 });
  const ps = Array.from({ length: n }, (_, i) => { const p = c.join('R' + i); c.connect(p); return p; });
  const log = [];
  const run = secs => { for (let i = 0; i < Math.round(secs * 10); i++) { t += 0.1; for (const p of c.players.values()) if (p.online > 0) p.seenAt = t * 1000; c.tick(0.1); log.push(...c.events); c.events = []; } };
  if (c.phase !== 'shift') { for (const p of ps) c.readyUp(p); run(1); }
  for (let i = 0; i < 400 && ![...c.balls.values()].some(b => b.kind === 'one' && b.y <= 0.4); i++) run(0.5);   // landed
  return { c, ps, run, log };
}
function bank({ c, ps, run, log }) {
  const b = [...c.balls.values()].find(x => x.kind === 'one');
  assert.ok(b, 'Ball No. 1 is on the field');
  ps[0].x = b.x; ps[0].z = b.z; assert.ok(c.pickup(ps[0], b.id));
  for (const p of ps) { p.x = SIM.STAND.x + 0.3; p.z = SIM.STAND.z; c.input(p, { a: [{ t: 'hold', on: true }] }); }
  log.length = 0;
  run(3.4);
  return log;
}

test('the note: one card that waits for the crack, reads at least 5 s, Ⓐ after 2 s, moves on at 7 s', () => {
  const c = BEAT_BY_ID.note.cards[0];
  assert.equal(c.style, 'note');
  assert.deepEqual([c.grace, c.min, c.secs], [NOTE.GRACE, NOTE.MIN, NOTE.SECS]);
  assert.deepEqual([NOTE.GRACE, NOTE.MIN, NOTE.SECS], [2, 5, 7]);
  assert.equal(BEAT_BY_ID.note.delay, BANK_SEQ.NOTE);
  assert.ok(BANK_SEQ.HUSH + 0.8 <= BANK_SEQ.CRACK + 1e-9, '0.8 s of near-silence before the crack');
  assert.ok(BANK_SEQ.CRACK + 0.6 <= BANK_SEQ.NOTE + 1e-9, 'the halves are open before the card');
});

test('story model: a beat\'s delay holds it; a card\'s min keeps an early press until it is reached', () => {
  let t = 0;
  const m = createStoryModel({ now: () => t });
  m.add('note');
  assert.equal(m.pending, 1); assert.equal(m.ready, false, 'the crack plays first');
  t = NOTE.DELAY - 0.01; assert.equal(m.ready, false);
  t = NOTE.DELAY; assert.equal(m.ready, true);
  m.begin(); const t0 = t;
  t = t0 + 1; m.press(); m.tick(); assert.equal(m.up, true, 'inside the 2 s grace: ignored');
  t = t0 + 2.5; m.press(); m.tick(); assert.equal(m.up, true, 'a press at 2.5 s is kept...');
  t = t0 + 4.9; m.tick(); assert.equal(m.up, true);
  t = t0 + 5; m.tick(); assert.equal(m.up, false, '...and acts at the 5 s minimum');
  // no press: it moves on by itself at 7 s
  m.add('note'); t += NOTE.DELAY; m.begin(); const t1 = t;
  t = t1 + 6.9; m.tick(); assert.equal(m.up, true);
  t = t1 + 7; m.tick(); assert.equal(m.up, false);
  // a skip inside the minimum also waits for it
  m.add('note'); t += NOTE.DELAY; m.begin(); const t2 = t;
  t = t2 + 0.5; m.skip(); m.tick(); assert.equal(m.up, true);
  t = t2 + 5; m.tick(); assert.equal(m.up, false);
  // a plain card keeps the old rules (grace 0.4 s, no minimum)
  m.add('cold'); m.begin(); t += 0.5; m.press(); assert.equal(m.index, 1);
});

test('the County beat opens with Gary\'s confession (5 s minimum); the Stadium beat has Gary and the new memo', () => {
  const county = beatFor('promo', 4).cards;
  assert.equal(county[0].who, 'GARY'); assert.match(county[0].line, /I was a Range Rat\. Here\. 1987\./); assert.equal(county[0].min, 5);
  const stadium = beatFor('promo', 3).cards;
  assert.match(stadium[0].line, /jumbotron plays a 1958 newsreel/);
  assert.ok(stadium.some(c => c.who === 'GARY' && /jumbotron/i.test(c.line)), 'the ally half in this stretch');
  assert.ok(stadium.some(c => c.who === 'MEMO' && /Site 13 sells tickets to its jumbotron/.test(c.line)));
  assert.ok(!stadium.some(c => /founder swings/.test(c.line)), 'the jumbotron shows it now');
  assert.equal(BEAT_BY_ID['mid:0'].cards[0].photo, 'sepia');
  assert.equal(BEAT_BY_ID['mid:5'].cards[0].photo, 'circled');
});

test('an old save that saw the epilogue has seen the note (no replay); one that banked but missed it gets it first', () => {
  assert.deepEqual(cleanStory(['epilogue']).sort(), ['epilogue', 'note']);
  const seen = crewAt({ v: 5, day: 21, venue: 5, venueDay: 3, story: ['epilogue'] });
  assert.equal(seen.story.has('note'), true);
  assert.equal(seen.storyBeat('note'), false);
  const missed = crewAt({ v: 5, day: 21, venue: 5, venueDay: 3, story: ['promo:5'] });
  missed.endless = true; missed.endlessFresh = true; missed.phase = 'report';
  missed.startShift();
  assert.deepEqual(storyEvents(missed), ['note', 'epilogue']);
});

for (const n of [1, 2, 4]) {
  test(`the bank at ${n}P: banked → story note → pa last, once; the Owners' book starts clean`, () => {
    const m = lastBucket(n);
    m.c.records.yesterday = { cash: 5, curve: [] }; m.c.records.streak = 3;
    const log = bank(m);
    const order = log.filter(e => (e.t === 'lastbucket' && e.phase === 'banked') || e.t === 'story' || (e.t === 'pa' && e.id === 'last'))
      .map(e => e.t === 'story' ? 'story ' + e.id : e.t === 'pa' ? 'pa last' : 'banked');
    assert.deepEqual(order, ['banked', 'story note', 'pa last']);
    assert.equal(m.c.records.yesterday, undefined); assert.equal(m.c.records.streak, undefined);
    assert.ok(m.c.records.cash > 0, 'the Orbital\'s record stays as "Best ever"');
  });
}

for (const n of [1, 2, 4]) {
  test(`the first endless morning at ${n}P: the clock holds ${EPILOGUE_HOLD} s while the epilogue plays; no customer swings`, () => {
    const m = lastBucket(n);
    bank(m);
    m.run(2);
    const { c, ps, run, log } = m;
    assert.equal(c.phase, 'report');
    log.length = 0;
    for (const p of ps) c.readyUp(p);
    log.push(...c.events); c.events = [];   // the morning's events (readyUp starts the shift at once)
    assert.equal(c.phase, 'shift');
    assert.ok(log.some(e => e.t === 'story' && e.id === 'epilogue'));
    assert.ok(!log.some(e => e.t === 'story' && e.id === 'note'), 'the note played at the bank');
    log.length = 0;
    const shift0 = c.shiftT;
    run(13);
    assert.equal(c.shiftT, shift0, 'still held at 13 s');
    assert.equal(log.filter(e => e.t === 'spawn').length, 0, 'no customer swings during the hold');
    run(2);
    assert.ok(c.shiftT > shift0, 'moving at 15 s');
  });
}

test('council round 11: the mid-venue beat waits out a MOW-E boss day', async () => {
  const { midDue } = await import('../web/js/story.js');
  assert.ok(midDue({ venue: 1, venueDay: 3 }));
  assert.equal(midDue({ venue: 1, venueDay: 3, boss: true }), null);
});
