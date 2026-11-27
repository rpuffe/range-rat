// Playtest round 9: a merge left `mowe.tick(...)` inside a trailing comment in main.js, so MOW-E froze at the origin
// and nothing caught it (main.js has no unit tests). Guard the per-frame calls the views depend on: each must appear as
// live code, not only after a `//`.
//
// Council round 14 #0a (builder 4): the list is every per-frame `.tick(` / `.update(` call that was live in main.js at
// 097c941 (the hotfix), built once from that file (`git show 097c941:web/js/main.js`, the code before any `//`, matched
// with /(?<![\w.?])([\w]+(?:\??\.[\w]+)*)(\??\.)(tick|update)\(/g), plus the pay floats (the roller and the merge are
// timer-driven: their `add` is the call), the ready gate's frame and the views' aim/camera. A call renamed on purpose
// leaves this list in the same commit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../web/js/main.js', import.meta.url), 'utf8');
const liveIn = (text, call) => text.split('\n').some(line => { const i = line.indexOf(call); return i >= 0 && !line.slice(0, i).includes('//'); });

const LIVE_AT_097C941 = [
  'bayLine.update(', 'board.update(', 'padlog.update(', 'sweep.update(', 'terrain.tick(', 'crowd.update(', 'scuba.tick(',
  'views?.tick(', 'r2?.tick(', 'dusk.tick(', 'hinter.tick(', 'board.tick(', 'confetti.tick(', 'mowe.update(', 'mowe.tick(',
  'kitchen.tick(', 'scenery.tick(', 'ballReturn.update(', 'ballReturn.tick(', 'fieldReturns.update(', 'fieldReturns.tick(',
  'props.tick(', 'perf.tick(',
  'payRoll.add(', 'hudPop.add(',     // the payfloat roller; your own banks' HUD pop (round 14 6.5: it replaced payMerge.add)
  'readyGate.frame(',                // the report's ready gate
  'views?.aim(', 'views?.camera(',   // the venue views, right after views?.tick
];

test('main.js calls the per-frame ticks as live code, not in a comment', () => {
  for (const call of ['mowe.tick(', 'mowe.update(', 'board.tick(', 'confetti.tick(', 'kitchen.tick(']) assert.ok(liveIn(src, call), call);
});

test('council round 14 #0a: every call live at 097c941 is still live', () => {
  const dead = LIVE_AT_097C941.filter(c => !liveIn(src, c));
  assert.deepEqual(dead, [], `no longer live in main.js (moved into a comment, or renamed without updating this list): ${dead.join(' ')}`);
});

test('council round 14 #0a: the guard is red on round 9 (cee02b3: mowe.tick inside the comment)', () => {
  const r9 = "  mowe.update(crew.mower ?? null, me.id); mowe.setPost(a, b, c);   // round 13 #5a: the whistle on its post, or on a mate's lanyard mowe.tick(dt, sceneT, me);\n  kitchen.tick(dt);";
  assert.equal(liveIn(r9, 'mowe.tick('), false);
  assert.equal(liveIn(r9, 'mowe.update('), true);
});
