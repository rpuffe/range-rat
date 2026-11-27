// Playtest round 9: a merge left `mowe.tick(...)` inside a trailing comment in main.js, so MOW-E froze at the origin
// and nothing caught it (main.js has no unit tests). Guard the per-frame calls the views depend on: each must appear as
// live code, not only after a `//`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../web/js/main.js', import.meta.url), 'utf8');
const live = call => src.split('\n').some(line => { const i = line.indexOf(call); return i >= 0 && !line.slice(0, i).includes('//'); });

test('main.js calls the per-frame ticks as live code, not in a comment', () => {
  for (const call of ['mowe.tick(', 'mowe.update(', 'board.tick(', 'confetti.tick(', 'kitchen.tick(']) assert.ok(live(call), call);
});
