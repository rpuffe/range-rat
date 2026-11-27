// Council round 14 #0a (builder 4): a line that's built but never wired is a line no player sees (C #5: STAR_LINE,
// STAR_PLAQUE and HUSTLE_HINT shipped in round 13 and were never shown). Every exported string constant named *_LINE,
// *_PLAQUE, *_HINT or *_MEMO in web/js/ must be imported by some other source file (web/, server/ or scripts/; tests
// don't count). ALLOW holds the deliberate exceptions, each with its reason. PENDING holds the lines a named item of this
// round wires: they show as a TODO (not a failure) until then; delete the entry when the line is wired.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const walk = dir => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : /\.m?js$/.test(n) ? [p] : []; });
const files = ['web', 'server', 'scripts'].flatMap(d => walk(join(ROOT, d)));
const text = new Map(files.map(f => [f, readFileSync(f, 'utf8')]));

export const ALLOW = {
  // name: 'why it is fine that nothing imports it'
  FINAL_MEMO: 'ending.js: retired on purpose in playthrough 2 ("one text at the finale", 5d21581); the end card says it now',
  ONE_DOWN_LINE: "huddlerules.js uses it itself (the Last Bucket's down banner); the export is for its test",
};
export const PENDING = {
};

const DECL = /export const ([A-Z][A-Z0-9_]*_(?:LINE|PLAQUE|HINT|MEMO))\s*=\s*['"`]/g;
export function exportedLines() {
  const out = [];
  for (const f of files) {
    if (!relative(ROOT, f).replace(/\\/g, '/').startsWith('web/js/')) continue;
    for (const m of text.get(f).matchAll(DECL)) out.push({ name: m[1], file: f });
  }
  return out;
}
// Imported elsewhere: another file names it and imports from the defining module (by its file name).
export function wired({ name, file }) {
  const mod = basename(file).replace(/\.m?js$/, ''), word = new RegExp(`\\b${name}\\b`), from = new RegExp(`from\\s+['"][^'"]*\\b${mod}\\.m?js['"]`);
  return files.some(f => f !== file && word.test(text.get(f)) && from.test(text.get(f)));
}

test('the scan finds the round-13 lines (a guard on the scan itself)', () => {
  const names = exportedLines().map(x => x.name);
  for (const n of ['STAR_LINE', 'TOURNEY_MEMO', 'SEAL_LINE']) assert.ok(names.includes(n), n);
});

test('every exported *_LINE / *_PLAQUE / *_HINT / *_MEMO string is wired somewhere', () => {
  const dead = exportedLines().filter(x => !Object.hasOwn(ALLOW, x.name) && !Object.hasOwn(PENDING, x.name) && !wired(x));
  assert.deepEqual(dead.map(x => `${x.name} (${relative(ROOT, x.file)})`), [], 'exported but never imported: wire it, or add it to ALLOW with a reason');
});

for (const [name, why] of Object.entries(PENDING)) {
  const x = exportedLines().find(e => e.name === name);
  const ok = !!x && wired(x);
  test(`pending: ${name} is wired (${why})`, { todo: ok ? false : `not wired yet: ${why}` }, () => {
    assert.ok(x, `${name} is no longer exported: remove it from PENDING`);
    assert.ok(wired(x), `${name} is not imported anywhere`);
  });
}
