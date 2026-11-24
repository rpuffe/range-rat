// The one-text rule (council round 7 #3): every centre line is 8 words or fewer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { wordCount, SAY } from '../web/js/say.js';
import { RALLY_LINES, GAUGE_MISS } from '../web/js/rally.js';
import { NUDGE_TEXT } from '../web/js/nudge.js';
import { PA_LINES } from '../web/js/pa.js';

const MAX = SAY.MAX_WORDS;
const over = lines => lines.filter(([, s]) => wordCount(s) > MAX);
const flat = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [[pre + k, v]] : flat(v, pre + k + '.')));

test('rally lines, gauge misses and nudges are 8 words or fewer', () => {
  assert.deepEqual(over(flat(RALLY_LINES)), []);
  assert.deepEqual(over(flat(GAUGE_MISS)), []);
  assert.deepEqual(over(flat(NUDGE_TEXT)), []);
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
