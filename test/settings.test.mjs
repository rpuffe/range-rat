// Settings and first-time hints (council round 3, build item 13): the pure parts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, KEY, HINTS_KEY, sanitize, load, save, loadSeen, saveSeen, nextHint, createHinter, hintText, HINT_GAP } from '../web/js/settings.js';

const mem = (init = {}) => { const d = { ...init }; return { d, getItem: k => (k in d ? d[k] : null), setItem: (k, v) => { d[k] = String(v); } }; };
const throwing = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };

test('defaults: full volume, voice PA, normal look, not inverted', () => {
  assert.deepEqual(sanitize(null), DEFAULTS);
  assert.deepEqual(sanitize(undefined), DEFAULTS);
  assert.deepEqual(sanitize('junk'), DEFAULTS);
});
test('sanitize clamps ranges and rejects bad types', () => {
  const s = sanitize({ master: 7, sfx: -1, ambience: '0.5', pa: NaN, look: 99, paMode: 'shouting', invertY: 'yes' });
  assert.equal(s.master, 1); assert.equal(s.sfx, 0); assert.equal(s.ambience, 0.5);
  assert.equal(s.pa, 1); assert.equal(s.look, 3); assert.equal(s.paMode, 'voice'); assert.equal(s.invertY, false);
  assert.equal(sanitize({ look: 0.01 }).look, 0.25);
  assert.equal(sanitize({ paMode: 'captions' }).paMode, 'captions');
  assert.equal(sanitize({ invertY: true }).invertY, true);
});
test('load: missing, corrupt, or throwing storage gives defaults', () => {
  assert.deepEqual(load(mem()), DEFAULTS);
  assert.deepEqual(load(mem({ [KEY]: '{not json' })), DEFAULTS);
  assert.deepEqual(load(mem({ [KEY]: '42' })), DEFAULTS);
  assert.deepEqual(load(throwing), DEFAULTS);
  assert.deepEqual(load(null), DEFAULTS);
});
test('save then load round-trips; save never throws', () => {
  const st = mem();
  assert.equal(save({ ...DEFAULTS, master: 0.4, invertY: true, look: 1.5 }, st), true);
  const s = load(st);
  assert.equal(s.master, 0.4); assert.equal(s.invertY, true); assert.equal(s.look, 1.5);
  assert.equal(save(DEFAULTS, throwing), false);
  assert.equal(save(DEFAULTS, null), false);
});
test('load keeps valid fields when others are corrupt', () => {
  const s = load(mem({ [KEY]: JSON.stringify({ master: 0.3, sfx: 'loud' }) }));
  assert.equal(s.master, 0.3); assert.equal(s.sfx, 1);
});
test('hints: seen list survives junk and throwing storage', () => {
  assert.deepEqual(loadSeen(mem()), []);
  assert.deepEqual(loadSeen(mem({ [HINTS_KEY]: 'nope' })), []);
  assert.deepEqual(loadSeen(mem({ [HINTS_KEY]: '["shop","bogus"]' })), ['shop']);
  assert.deepEqual(loadSeen(throwing), []);
  assert.equal(saveSeen(['shop'], throwing), false);
});
test('nextHint: shop first, then sprint, CCTV only at venue 1+', () => {
  assert.equal(nextHint({ seen: [], playSecs: 1 }), null);
  assert.equal(nextHint({ seen: [], playSecs: 15 }), 'shop');
  assert.equal(nextHint({ seen: ['shop'], playSecs: 15 }), null);
  assert.equal(nextHint({ seen: ['shop'], playSecs: 40 }), 'sprint');
  assert.equal(nextHint({ seen: ['shop', 'sprint'], playSecs: 100, venue: 0 }), null);
  assert.equal(nextHint({ seen: ['shop', 'sprint'], playSecs: 100, venue: 1 }), 'cctv');
  assert.equal(nextHint({ seen: ['shop', 'sprint', 'cctv'], playSecs: 999, venue: 3 }), null);
  assert.equal(nextHint({ seen: [], playSecs: 99, sinceLast: HINT_GAP - 1 }), null);
});
test('hint text differs for keyboard and pad', () => {
  assert.match(hintText('shop', false), /Tab/); assert.match(hintText('shop', true), /D-pad up/);
  assert.match(hintText('sprint', false), /Shift/); assert.match(hintText('sprint', true), /right stick/);
  assert.match(hintText('cctv', false), /Press C/); assert.match(hintText('cctv', true), /D-pad down/);
});
test('hinter shows each hint once ever, persisting across instances', () => {
  const st = mem(), shown = [];
  const run = (h, venue = 0) => { for (let i = 0; i < 400; i++) h.tick(1, { playing: true, venue, show: (t, id) => shown.push(id) }); };
  run(createHinter({ storage: st }));
  assert.deepEqual(shown, ['shop', 'sprint']);
  run(createHinter({ storage: st }), 1);
  assert.deepEqual(shown, ['shop', 'sprint', 'cctv']);
  run(createHinter({ storage: st }), 2);
  assert.equal(shown.length, 3);
});
test('hinter does not count time while not playing, and works with throwing storage', () => {
  const shown = [], h = createHinter({ storage: throwing });
  for (let i = 0; i < 100; i++) h.tick(1, { playing: false, show: (t, id) => shown.push(id) });
  assert.equal(shown.length, 0);
  for (let i = 0; i < 20; i++) h.tick(1, { playing: true, show: (t, id) => shown.push(id) });
  assert.deepEqual(shown, ['shop']);
});
