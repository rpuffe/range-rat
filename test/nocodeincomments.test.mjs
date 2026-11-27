// Council round 14 #0a (builder 4): the lint behind the live-call guard. Round 9 lost a slice to one call that a merge
// pushed into a trailing comment: "…setPost(…);   // round 13 #5a: … lanyard mowe.tick(dt, sceneT, me);". In the hot
// files, no `//` comment may END in a call statement. Write the call on its own line, or end the comment with prose.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

export const CALL_IN_COMMENT = /\/\/.*\b[\w.]+\([^)]*\);\s*$/;
export const HOT = ['web/js/main.js', 'server/crew.mjs', 'server/venues/index.mjs', 'scripts/smoke.mjs'];   // the smoke's walkTo lost its step to a comment too
export const offenders = text => text.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => CALL_IN_COMMENT.test(l));

for (const f of HOT) {
  test(`${f}: no call statement at the end of a // comment`, () => {
    const bad = offenders(readFileSync(new URL('../' + f, import.meta.url), 'utf8'));
    assert.deepEqual(bad.map(([n, l]) => `${f}:${n}: ${l.trim().slice(0, 160)}`), []);
  });
}

test('the lint is red on round 9 (the cee02b3 line), and quiet on prose', () => {
  const r9 = "  mowe.update(crew.mower ?? null, me.id); mowe.setPost(a, b, c);   // round 13 #5a: the whistle on its post, or on a mate's lanyard mowe.tick(dt, sceneT, me);";
  assert.equal(offenders(r9).length, 1);
  assert.equal(offenders('  mowe.tick(dt, sceneT, me);   // playtest round 9: this call had slipped into the comment').length, 0);
  assert.equal(offenders('  // see sim.js memoSecond (the slot order)').length, 0);
  assert.equal(offenders('  // old: board.tick(dt);').length, 1, 'commented-out code is flagged too: delete it instead');
});
