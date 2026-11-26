// The one-text rule (council round 7 #3): every centre line is 8 words or fewer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { wordCount, SAY } from '../web/js/say.js';
import { RALLY_LINES, GAUGE_MISS } from '../web/js/rally.js';
import { NUDGE_TEXT, GARY_TEXT, GARY_STALLED } from '../web/js/nudge.js';
import { PA_LINES } from '../web/js/pa.js';

const MAX = SAY.MAX_WORDS;
const over = lines => lines.filter(([, s]) => wordCount(s) > MAX);
const flat = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [[pre + k, v]] : flat(v, pre + k + '.')));

test('rally lines, gauge misses and nudges are 8 words or fewer', () => {
  assert.deepEqual(over(flat(RALLY_LINES)), []);
  assert.deepEqual(over(flat(GAUGE_MISS)), []);
  assert.deepEqual(over(flat(NUDGE_TEXT)), []);
  assert.deepEqual(over([...flat(GARY_TEXT), ['stalled', GARY_STALLED]]), []);   // council round 8 #2
});

test('every PA entry is { line, caption } and every caption is 8 words or fewer', () => {
  for (const [id, e] of Object.entries(PA_LINES)) {
    assert.equal(typeof e.line, 'string', id);
    assert.equal(typeof e.caption, 'string', id);
  }
  assert.deepEqual(over(Object.entries(PA_LINES).map(([id, e]) => [id, e.caption])), []);
  assert.equal(PA_LINES.gary.caption, 'Gary from Regional is on site.');
});

// The string literals inside one call's parentheses (quotes and templates; ${…} reads as one word).
function literalsIn(src, from) {
  const out = [];
  let depth = 0, i = from;
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '(') depth++;
    else if (c === ')') { if (--depth === 0) break; }
    else if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; }
    else if (c === "'" || c === '"' || c === '`') {
      let j = i + 1, s = '', d = 0;
      for (; j < src.length; j++) {
        const ch = src[j];
        if (ch === '\\') { s += src[++j]; continue; }
        if (c === '`' && ch === '$' && src[j + 1] === '{') { d++; j++; s += 'X'; continue; }
        if (d > 0) { if (ch === '{') d++; else if (ch === '}') d--; continue; }
        if (ch === c) break;
        s += ch;
      }
      out.push(s); i = j;
    }
  }
  return out;
}

test('every string literal passed to say( in web/js is 8 words or fewer (a source scan)', () => {
  const dirs = ['../web/js/', '../web/js/views/'];
  const bad = [];
  let calls = 0;
  for (const d of dirs) {
    const url = new URL(d, import.meta.url);
    for (const f of readdirSync(url).filter(f => f.endsWith('.js'))) {
      const src = readFileSync(new URL(f, url), 'utf8');
      for (const m of src.matchAll(/(?<![\w.])(?:ctx\.)?say\(\s*'(STAMP|PA|MEMO|ALERT|TOAST|TIP)'/g)) {
        calls++;
        for (const s of literalsIn(src, m.index + m[0].indexOf('('))) if (wordCount(s) > MAX) bad.push(`${d}${f}: ${s}`);
      }
    }
  }
  assert.ok(calls >= 8, 'the scan found the say() calls (' + calls + ')');
  assert.deepEqual(bad, []);
});

test("main.js TODO_DONE lines are 8 words or fewer", () => {
  const src = readFileSync(new URL('../web/js/main.js', import.meta.url), 'utf8');
  const m = src.match(/const TODO_DONE = \{([^}]*)\}/);
  assert.ok(m, 'TODO_DONE found');
  const lines = [...m[1].matchAll(/(\w+): '([^']*)'/g)].map(x => [x[1], x[2]]);
  assert.ok(lines.length >= 4);
  assert.deepEqual(over(lines), []);
});

test('nothing writes the centre elements directly any more: no textBusy, toastQuiet or memo queue', () => {
  const src = readFileSync(new URL('../web/js/main.js', import.meta.url), 'utf8');
  for (const gone of ['toastQuiet', 'memoQ', 'memoHold', 'paOffT', "$('toast')", "$('memo')", "$('hint')", 'setTimeout(rally', 'setTimeout(again']) assert.ok(!src.includes(gone), gone);
  const pa = readFileSync(new URL('../web/js/pa.js', import.meta.url), 'utf8');
  assert.ok(!pa.includes("getElementById('memo')"), 'pa.js no longer waits on the memo itself');
});

// ---- council round 12, builder 2 (venues): the Stretch and the inspection ALERTs, the hazard tip, the card's tomorrow line
import { stretchAlert as b2StretchAlert, ROBOT_LINE as b2Robot } from '../web/js/stadium.js';
import { inspectAlert as b2InspectAlert, INSPECT_MEMO as b2InspectMemo } from '../web/js/county.js';
import { HINTS as b2Hints } from '../web/js/settings.js';
test('round 12 builder 2: the Stretch and inspection ALERTs, the robot line, the hazard tip are 8 words or fewer', () => {
  assert.deepEqual(over([['stretch2', b2StretchAlert(2)], ['stretch3', b2StretchAlert(3)], ['inspect', b2InspectAlert], ['robot', b2Robot],
    ['inspectMemo', b2InspectMemo], ['hazard.kb', b2Hints.hazard.kb], ['hazard.pad', b2Hints.hazard.pad]]), []);
});

// ---- council round 12, builder 4 (look): the memo hooks, the venue memo lines, the memo flavours, the Orbital's NEW line
import { MEMO_LINES as b4MemoLines, MEMO_FLAVORS as b4Flavors, RAT_MEMOS as b4RatMemos, MEMO_DAY_FLAVOR as b4DayFlavor, contractMemo as b4ContractMemo, VENUE_RULES as b4Rules } from '../web/js/sim.js';
import { memoLine as b4MemoLine } from '../web/js/bvtext.js';
test('round 12 builder 4: memo hooks, venue memo lines, flavours and NEW lines are 8 words or fewer', () => {
  const lines = [...Object.entries(b4MemoLines), ...b4Flavors.map((l, i) => ['flavor' + i, l]), ...b4RatMemos.map((l, i) => ['rat' + i, l]),
    ...Object.entries(b4DayFlavor).map(([k, l]) => ['day' + k, l]), ['stadium', b4MemoLine(35, 3)], ['county', b4MemoLine(35, 4)],
    ['stadiumGary', b4MemoLine(35, 3, true)], ['contract', b4ContractMemo('At most 2 knockdowns')], ['contractCash', b4ContractMemo('Bank $41,234,567')],
    ...b4Rules.filter(r => r.memo).map(r => [r.name, r.memo])];
  assert.deepEqual(over(lines), []);
});

// ---- council round 12, builder 1 (MOW-E): no new centre lines; the whistle prompt and the boss lines stay 8 words or fewer
import { BOSS_LINES as b1BossLines } from '../web/js/mowe.js';
test('round 12 builder 1: the whistle prompt and the MOW-E lines are 8 words or fewer', () => {
  assert.deepEqual(over([['whistle.pad', b1BossLines.whistle('Ⓐ')], ['whistle.kb', b1BossLines.whistle('Space')], ['plug', b1BossLines.plug('Ⓐ')],
    ['loose', b1BossLines.loose], ['hunt', b1BossLines.hunt], ['prompt', b1BossLines.prompt('Ⓐ')]]), []);
});

// ---- council round 12, builder 3 (ending, contracts, Site 13): the new lines, 8 words or fewer ----
test('council round 12 builder 3: the gold-beam banner, the contract goals, Site 13 and Gary\'s lines are 8 words or fewer', async () => {
  const { ONE_DOWN_LINE } = await import('../web/js/huddlerules.js');
  const { goalText } = await import('../web/js/today.js');
  const { rivalLine } = await import('../web/js/owner.js');
  const { GARY_BYE_MOWE } = await import('../web/js/story.js');
  const lines = [['banner', ONE_DOWN_LINE], ['win', rivalLine({ win: true })], ['lose', rivalLine({ win: false })], ['lost', 'Contract lost.'],
    ['passed', 'Passed Site 13.'], ['gary', GARY_BYE_MOWE], ['h3', goalText({ k: 'hustle', n: 3, by: 120 })], ['h2', goalText({ k: 'hustle', n: 2 })],
    ['memo', 'Contract: ' + goalText({ k: 'hustle', n: 3, by: 120 }).toLowerCase() + '.']];
  assert.deepEqual(over(lines), []);
});
