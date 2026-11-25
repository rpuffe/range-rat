// Owner playtest 3 §7.1-7.2: spray on RT, sprint on L3 (web/js/padbind.js), and no exitFullscreen anywhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { BTN } from '../web/js/pad.js';
import { padBindings, RT_SPRAY, wandA } from '../web/js/padbind.js';
import { hintText } from '../web/js/settings.js';
import { wordCount } from '../web/js/say.js';

const snap = ({ pressed = [], rt = 0 } = {}) => {
  const p = Array(16).fill(false); for (const i of pressed) p[i] = true;
  return { pressed: p, down: p, rt, lt: 0 };
};

test('sprint is L3, not R3', () => {
  assert.equal(padBindings(snap({ pressed: [BTN.LS] })).sprint, true);
  assert.equal(padBindings(snap({ pressed: [BTN.RS] })).sprint, false);
  assert.equal(padBindings(null).sprint, false);
});

test('RT sprays only with the wand, never while driving or in the CCTV', () => {
  const full = snap({ rt: 1 });
  assert.equal(padBindings(full, { wand: true }).rtSpray, true);
  assert.equal(padBindings(full, { wand: false }).rtSpray, false);
  assert.equal(padBindings(full, { wand: true, driving: true }).rtSpray, false);
  assert.equal(padBindings(full, { wand: true, cctv: true }).rtSpray, false);
});

test('RT starts above 0.35 and stops below 0.2 (no flicker in between)', () => {
  assert.equal(RT_SPRAY.ON, 0.35); assert.equal(RT_SPRAY.OFF, 0.2);
  let on = false;
  const step = rt => (on = padBindings(snap({ rt }), { wand: true, rtSpray: on }).rtSpray);
  assert.deepEqual([0.3, 0.36, 0.25, 0.21, 0.19, 0.3, 0.4].map(step), [false, true, true, true, false, false, true]);
});

test('Ⓐ with the wand picks up a ball in reach, else sprays', () => {
  assert.equal(wandA({ ballNear: true, room: true }), 'pick');
  assert.equal(wandA({ ballNear: false, room: true }), 'spray');
  assert.equal(wandA({ ballNear: true, room: false }), 'spray');
});

test('the pad sprint tip names the left stick, in 8 words', () => {
  assert.equal(hintText('sprint', true), 'Click the left stick to sprint. Costs stamina.');
  assert.ok(wordCount(hintText('sprint', true)) <= 8);
});

test('the game never calls exitFullscreen (web/js, a source scan)', () => {
  const bad = [];
  const walk = dir => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = new URL(e.name + (e.isDirectory() ? '/' : ''), dir);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js') && /exitFullscreen|webkitExitFullscreen/.test(readFileSync(p, 'utf8'))) bad.push(e.name);
    }
  };
  walk(new URL('../web/js/', import.meta.url));
  assert.deepEqual(bad, []);
});

test('main.js: View no longer opens the shop, and R3 no longer sprints', () => {
  const src = readFileSync(new URL('../web/js/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /pressed\[BTN\.VIEW\]/);
  assert.doesNotMatch(src, /pressed\[BTN\.RS\]/);
  assert.doesNotMatch(src, /document\.exitPointerLock\?\.\(\); (keys|focus)/, 'cards release the pointer through releaseMouse()');
});
