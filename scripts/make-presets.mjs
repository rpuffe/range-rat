// Round 11, "skip ahead (test)": regenerate server/presets/*.json by running bot crews through the real game.
//
//   node scripts/make-presets.mjs [seed] [--out DIR] [--only id,id] [--keep]      (a few minutes; 4 Rats; seed 7 by default)
//
// The bots (scripts/bots/) play the real Crew headlessly: muni.mjs from a fresh crew to the Club promotion, mid.mjs
// from there to the Stadium (FIGHT=55: it stands through the Club boss and tames it, so MOW-E is a pet from then on),
// late11.mjs (JOB=1: it delivers souvenirs and pings by hand) from there through the County, the Orbital, the Last
// Bucket and into endless. Each bot starts from the previous one's end state (START_FILE) and snaps crew.toSave()
// every morning (and the moment the Last Bucket begins) to a JSON-lines file (SNAP_FILE). This script picks each
// starting point's snap and writes it as a preset. Rerun it whenever the upgrades, prices or goal cards change: the
// presets are what a real crew would have, not hand-typed numbers.
//
// Council round 13 #0c: it fails loudly. Every venue has a shift cap (CAPS); a bot over it exits 1 with the stuck
// goal ("stuck at Stadium on requests 0/6 after 6 shifts"), and this script then exits 1 WITHOUT writing anything:
// every preset is picked and checked before the first file is written, so a partial preset set never lands.
// Council round 14 #0d (builder 4): presets per crew size (B #11: club4 is a 4P save, so a solo tester arrived with
// "CARD DONE"). The Muni -> Club chain is replayed by a 1P and a 2P bot crew for club4-1p, club4-2p and tiered1-1p (a
// preset's `players` says its size). New starting points: muni3 (the morning of Muni day 3, the Gold Rush), club2 (Club
// day 2, the Club's Rush) and lastbucket-4p (the 4P finale, named for the smoke run). --sizes 4 skips the 1P/2P chains.
// --out DIR writes somewhere else (a dry run: node scripts/make-presets.mjs 11 --out /tmp/p); --only writes a subset.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESETS } from '../web/js/skip.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BOTS = join(ROOT, 'scripts', 'bots');
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
const OUT = resolve(opt('--out') ?? join(ROOT, 'server', 'presets'));
const ONLY = opt('--only')?.split(',').filter(Boolean) ?? null;
const KEEP = args.includes('--keep'); if (KEEP) args.splice(args.indexOf('--keep'), 1);   // keep the bots' snaps and logs
const SIZES = (opt('--sizes') ?? '1,2,4').split(',').map(Number).filter(n => n >= 1 && n <= 4);
const N = 4, SEED = Number(args[0] ?? 7);
// council round 13 #0c: the shifts a venue may take before the chain is called stuck (venue: shifts)
const CAPS = Object.freeze({ 0: 8, 1: 10, 2: 6, 3: 6, 4: 6, 5: 4 });
const PROMO_TRIES = 8;   // bot seeds tried for stadiumPromo
const CAP_ENV = Object.entries(CAPS).map(([v, n]) => `${v}:${n}`).join(',');

class Stuck extends Error {}
const tmp = mkdtempSync(join(tmpdir(), 'rr-presets-'));

function run(bot, startSave = null, env0 = {}, seed = SEED, n = N) {
  const tag = bot + (seed === SEED ? '' : '-' + seed) + (n === N ? '' : '-' + n + 'p');
  const snapFile = join(tmp, `${tag}.jsonl`);
  writeFileSync(snapFile, '');
  const env = { ...process.env, SNAP_FILE: snapFile, V: '0', CALLS: '0', SHIFT_CAPS: CAP_ENV, ...env0 };
  for (const k of ['START', 'START_FILE', 'TOURNEY', 'WHISTLE', 'BUY', 'POACH', 'POLICY', 'CALLS_JSON']) delete env[k];   // presets are plain play
  if (startSave) { env.START_FILE = join(tmp, `${tag}-start.json`); writeFileSync(env.START_FILE, JSON.stringify(startSave)); }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(BOTS, `${bot}.mjs`), String(n), String(seed)], { env, encoding: 'utf8', maxBuffer: 256 << 20 });
  if (r.status !== 0) {
    const cap = /CAP (.*)/.exec(r.stderr ?? '');
    const partial = (() => { try { return readFileSync(snapFile, 'utf8').split(String.fromCharCode(10)).filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } })();
    if (cap) throw Object.assign(new Stuck(`${bot}.mjs ${cap[1]} (caps ${CAP_ENV}, ${n}P seed ${seed})`), { snaps: partial });
    console.error(r.stdout?.slice(-4000), r.stderr);
    throw new Stuck(`${bot}.mjs failed (exit ${r.status}${r.signal ? ' ' + r.signal : ''})`);
  }
  if (KEEP) writeFileSync(join(tmp, `${tag}.out`), r.stdout + r.stderr);
  const snaps = readFileSync(snapFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  console.log(`${tag}: ${snaps.length} snaps in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return snaps;
}
const need = (s, what) => { if (!s) throw new Stuck(`no snap for ${what}: the bot never got there (check the bot's output)`); return s; };
const morning = (snaps, f) => snaps.find(s => s.tag === 'morning' && f(s));
// a morning snap's venueDay counts the days played there: venueDay 3 is the morning of day 4
const isPromo = s => !s.endless && Number.isInteger(s.save.promoDay) && s.save.promoDay === s.save.day;

function pickAll() {
  const muni = run('muni');
  const clubStart = need(muni.find(s => s.tag === 'end' && s.venue === 1), 'the Club promotion');
  const mid = run('mid', clubStart.save, { FIGHT: '55' });
  const stadStart = need(morning(mid, s => s.venue === 3), 'the Stadium promotion');
  const late = run('late11', stadStart.save, { JOB: '1', STOPV: '99', ENDLESS: '1' });
  // council round 13 #0d: the Stadium's Promotion Day with MOW-E 2.0 (the encore) not played yet (item 3's crash). A crew
  // that clears the Stadium's card in order never gets one, so if this seed's crew didn't, the same Stadium-day-1 crew
  // replays the Stadium under other bot seeds (STOPV=4: it stops at the County) until one does.
  const promoOf = snaps => morning(snaps, s => s.venue === 3 && isPromo(s) && !s.save.mowe?.encore);
  let stadiumPromo = promoOf([...mid, ...late]);
  for (let k = 1; !stadiumPromo && k <= PROMO_TRIES; k++) stadiumPromo = promoOf(run('late11', stadStart.save, { JOB: '1', STOPV: '4', ENDLESS: '0' }, SEED + 1000 * k));
  // council round 14 #0d: the smaller crews' Muni -> Club chain (one muni and one mid run per size)
  const small = {};
  // The small crews start from the 4P crew's Club day 1 (the 1P muni bot never passes Gary's huddle, at 097c941 too) and
  // play the Club themselves, so the card a 1P / 2P tester meets on Club day 4 is a 1P / 2P crew's. A stuck seed tries
  // the next, as for stadiumPromo.
  for (const n of SIZES.filter(k => k < N)) {
    let last = null;
    for (let k = 0; k <= PROMO_TRIES && !small[n]; k++) {
      try {
        const sd = SEED + 1000 * k;
        // a small crew may stall LATER (2P at Tiered): its snaps up to there still give its Club day 4 / Tiered day 1
        let md; try { md = run('mid', clubStart.save, { FIGHT: '55' }, sd, n); } catch (e) { if (!(e instanceof Stuck) || !e.snaps?.length) throw e; md = e.snaps; console.log(`  ${n}P: ${e.message} (its earlier snaps kept)`); }
        const got = { club4: morning(md, s => s.venue === 1 && s.venueDay === 3), tiered1: morning(md, s => s.venue === 2) };
        if (got.club4 && (n > 1 || got.tiered1)) small[n] = got;
      } catch (e) { if (!(e instanceof Stuck)) throw e; last = e; console.log(`  ${n}P: ${e.message}; next seed`); }
    }
    if (!small[n]) throw last ?? new Stuck(`no ${n}P chain reached Club day 4`);
  }
  return {
    'club4-1p': small[1]?.club4, 'club4-2p': small[2]?.club4, 'tiered1-1p': small[1]?.tiered1,
    muni3: morning(muni, s => s.venue === 0 && s.day === 3),
    club2: morning(mid, s => s.venue === 1 && s.venueDay === 1),
    'lastbucket-4p': late.find(s => s.tag === 'lb'),
    muni4: morning(muni, s => s.venue === 0 && s.day === 4),
    club1: clubStart,
    club4: morning(mid, s => s.venue === 1 && s.venueDay === 3),   // council round 13 #0d: the Tournament's day, MOW-E tame
    tiered1: morning(mid, s => s.venue === 2),
    stadium1: stadStart,
    stadiumPromo,
    county1: morning(late, s => s.venue === 4 && !s.endless),
    orbital1: morning(late, s => s.venue === 5 && !s.endless),
    lastbucket: late.find(s => s.tag === 'lb'),
    endless: morning(late, s => s.endless),
  };
}

// What every Rat on the bot crew had (dive gear is personal, by name): the best level, under the default names a
// blank name joins as ("Rat 1".."Rat 4"). server/skip.mjs testJoin gives it to anyone else who joins.
function normalise(save, n = N) {
  const s = structuredClone(save);
  delete s.code; delete s.savedAt;
  const lvl = Math.max(0, ...Object.values(s.diveByName ?? {}));
  s.diveByName = lvl > 0 ? Object.fromEntries(Array.from({ length: n }, (_, i) => [`Rat ${i + 1}`, lvl])) : {};
  s.test = true;
  return s;
}

// The starting point a preset claims to be, checked before anything is written.
function check(id, save) {
  const fail = why => { throw new Stuck(`preset ${id}: ${why}`); };
  const base = id.replace(/-\dp$/, '');
  if (base === 'club4' && (save.venue !== 1 || save.venueDay !== 3)) fail('not the morning of Club day 4');
  if (id === 'club4' && !save.mowe?.tame) fail('MOW-E is not tame (the bot lost or skipped the Club boss)');   // a small crew's club4 may have lost it
  if (id === 'muni3' && (save.venue !== 0 || save.day !== 3)) fail('not the morning of Muni day 3');
  if (id === 'club2' && (save.venue !== 1 || save.venueDay !== 1)) fail('not the morning of Club day 2');
  if (base === 'tiered1' && save.venue !== 2) fail('not Tiered');
  if (id === 'stadiumPromo' && (save.venue !== 3 || save.promoDay !== save.day || save.mowe?.encore)) fail('not a Stadium Promotion Day with the encore unplayed');
}

let code = 0;
try {
  const picks = pickAll();
  const files = [];
  const made = new Date().toISOString().slice(0, 10);
  for (const p of PRESETS) {
    if (ONLY && !ONLY.includes(p.id)) continue;
    if (/-[12]p$/.test(p.id) && !SIZES.includes(+p.id.at(-2))) continue;   // --sizes 4: no small-crew presets this run
    const s = need(picks[p.id], p.label);
    const players = p.players ?? N;
    const save = normalise(s.save, players);
    // Council round 12, 9.1: the endless preset is a true first endless morning (the epilogue plays; no offers, no owners' book).
    if (p.id === 'endless') { save.endlessFresh = true; delete save.offers; delete save.contractPick; for (const k of ['yesterday', 'streak', 'owner', 'rival']) delete save.records?.[k]; }
    check(p.id, save);
    files.push({ p, s, save });
  }
  mkdirSync(OUT, { recursive: true });
  for (const { p, s, save } of files) {
    const file = { id: p.id, label: p.label, made, bot: `${p.players ?? N}P seed ${SEED}, ${s.tag} snap`, players: p.players ?? N, save };
    writeFileSync(join(OUT, `${p.id}.json`), JSON.stringify(file, null, 1) + '\n');
    console.log(`  ${p.id.padEnd(12)} day ${String(save.day).padStart(2)} venue ${save.venue} vd ${save.venueDay}${save.endless ? ' endless' : ''}${save.promoDay === save.day ? ' promo' : ''} cash $${Math.round(save.cash).toLocaleString()} tame ${!!save.mowe?.tame} encore ${!!save.mowe?.encore} treasures ${save.lostFound?.length ?? 0} up ${JSON.stringify(save.up)}`);
  }
  console.log(`wrote ${files.length} presets to ${OUT}`);
} catch (e) {
  if (!(e instanceof Stuck)) throw e;
  console.error(`make-presets FAILED, nothing written: ${e.message}`);
  code = 1;
} finally {
  if (KEEP) console.log(`kept the bots' snaps and logs in ${tmp}`); else rmSync(tmp, { recursive: true, force: true });
}
process.exit(code);
