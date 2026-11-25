// Round 11, "skip ahead (test)": regenerate server/presets/*.json by running bot crews through the real game.
//
//   node scripts/make-presets.mjs [seed]        (about a minute; 4 Rats; seed 7 by default)
//
// The bots (scripts/bots/, from the expert review's ladder scripts) play the real Crew headlessly: muni.mjs from a
// fresh crew to the Club promotion, mid.mjs from there to the Stadium, late.mjs from there through the County, the
// Orbital, the Last Bucket and into endless. Each bot starts from the previous one's end state (START_FILE) and
// snaps crew.toSave() every morning (and the moment the Last Bucket begins) to a JSON-lines file (SNAP_FILE).
// This script picks each starting point's snap and writes it as a preset. Rerun it whenever the upgrades, prices or
// goal cards change: the presets are what a real crew would have, not hand-typed numbers.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS } from '../web/js/skip.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BOTS = join(ROOT, 'scripts', 'bots');
const OUT = join(ROOT, 'server', 'presets');
const N = 4, SEED = Number(process.argv[2] ?? 7);
const tmp = mkdtempSync(join(tmpdir(), 'rr-presets-'));

function run(bot, startSave = null) {
  const snapFile = join(tmp, `${bot}.jsonl`);
  writeFileSync(snapFile, '');
  const env = { ...process.env, SNAP_FILE: snapFile, V: '0' };
  delete env.START; delete env.START_FILE;
  if (startSave) { env.START_FILE = join(tmp, `${bot}-start.json`); writeFileSync(env.START_FILE, JSON.stringify(startSave)); }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(BOTS, `${bot}.mjs`), String(N), String(SEED)], { env, encoding: 'utf8', maxBuffer: 256 << 20 });
  if (r.status !== 0) { console.error(r.stdout?.slice(-4000), r.stderr); throw new Error(`${bot} bot failed (exit ${r.status})`); }
  const snaps = readFileSync(snapFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  console.log(`${bot}: ${snaps.length} snaps in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return snaps;
}
const need = (s, what) => { if (!s) throw new Error(`no snap for ${what}: the bot never got there (check the bot's output)`); return s; };
const morning = (snaps, f) => snaps.find(s => s.tag === 'morning' && f(s));

const muni = run('muni');
const clubStart = need(muni.find(s => s.tag === 'end' && s.venue === 1), 'the Club promotion');
const mid = run('mid', clubStart.save);
const stadStart = need(morning(mid, s => s.venue === 3), 'the Stadium promotion');
const late = run('late', stadStart.save);

const picks = {
  muni4: morning(muni, s => s.venue === 0 && s.day === 4),
  club1: clubStart,
  tiered1: morning(mid, s => s.venue === 2),
  stadium1: stadStart,
  county1: morning(late, s => s.venue === 4 && !s.endless),
  orbital1: morning(late, s => s.venue === 5 && !s.endless),
  lastbucket: late.find(s => s.tag === 'lb'),
  endless: morning(late, s => s.endless),
};

// What every Rat on the bot crew had (dive gear is personal, by name): the best level, under the default names a
// blank name joins as ("Rat 1".."Rat 4"). server/skip.mjs testJoin gives it to anyone else who joins.
function normalise(save) {
  const s = structuredClone(save);
  delete s.code; delete s.savedAt;
  const lvl = Math.max(0, ...Object.values(s.diveByName ?? {}));
  s.diveByName = lvl > 0 ? Object.fromEntries(Array.from({ length: N }, (_, i) => [`Rat ${i + 1}`, lvl])) : {};
  s.test = true;
  return s;
}

mkdirSync(OUT, { recursive: true });
const made = new Date().toISOString().slice(0, 10);
for (const p of PRESETS) {
  const s = need(picks[p.id], p.label);
  const save = normalise(s.save);
  const file = { id: p.id, label: p.label, made, bot: `${N}P seed ${SEED}, ${s.tag} snap`, players: N, save };
  writeFileSync(join(OUT, `${p.id}.json`), JSON.stringify(file, null, 1) + '\n');
  console.log(`  ${p.id.padEnd(10)} day ${String(save.day).padStart(2)} venue ${save.venue} vd ${save.venueDay}${save.endless ? ' endless' : ''} cash $${Math.round(save.cash).toLocaleString()} outstanding ${save.outstanding.toLocaleString()} treasures ${save.lostFound?.length ?? 0} up ${JSON.stringify(save.up)}`);
}
rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${PRESETS.length} presets to server/presets/`);
