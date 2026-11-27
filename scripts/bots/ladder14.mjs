// Council round 14 §4.1 step 3: the lead's headless ladder. 1P / 2P / 4P x seeds, Muni day 1 -> endless day 5, chained
// the way scripts/make-presets.mjs chains the bots (muni.mjs -> mid.mjs -> late11.mjs, START_FILE / SNAP_FILE hand-offs),
// with the policy flags on (BUY=1 TOURNEY=1 WHISTLE=aim POACH=1). A measurer: it edits nothing.
//
//   node scripts/bots/ladder14.mjs chain <players> <seed> [--out DIR]   one chain (run several in parallel)
//   node scripts/bots/ladder14.mjs report [--out DIR]                    the tables from every chain in DIR
//
// The calls tally is read through a preload (this same file, imported with LADDER14_HOOK=1 via node --import): it wraps
// CallTally.endShift so every shift record (CALLS_JSON) also carries the bell's cash, the promotion fee, the card, the
// venue at the bell, endless / Last Bucket state, and the longest stretch of the shift with no call.
// Caps are generous (2x make-presets' CAPS) so "slow" and "stuck" can be told apart; the report flags shifts over
// make-presets' caps too.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = fileURLToPath(new URL('./', import.meta.url));

if (process.env.LADDER14_HOOK === '1') {
  const { CallTally } = await import(pathToFileURL(join(HERE, 'calls.mjs')).href);
  const hit0 = CallTally.prototype.hit, end0 = CallTally.prototype.endShift;
  // Round 14 6.7 made the ENDING report hold Ready for the end card's ENDCARD_HOLD s, and the server's tick then starts
  // the countdown. The bots never tick the report phase (they readyUp and expect a shift), so after the Last Bucket
  // they "play" endless shifts of 0 s. Model the crew waiting out the hold: a Ready on the held ending report first
  // ends the hold (this.endingHold = now), as the real tick would ENDCARD_HOLD s later. Counted in the report as
  // +ENDING_WAIT s of lobby time. LADDER14_ENDHOLD=0 turns this off (to show the bot artefact).
  if (process.env.LADDER14_ENDHOLD !== '0') {
    const { Crew } = await import(pathToFileURL(join(HERE, '..', '..', 'server', 'crew.mjs')).href);
    const ready0 = Crew.prototype.readyUp;
    Crew.prototype.readyUp = function (p) {
      if (this.endingHeld?.()) { this.endingHold = this.now(); this._ladderEndWait = true; }
      return ready0.call(this, p);
    };
  }
  CallTally.prototype.hit = function (kind, now, n = 1) {
    const ok = hit0.call(this, kind, now, n);
    if (ok) (this._times ??= []).push(now);
    return ok;
  };
  CallTally.prototype.endShift = function (crew, extra = {}) {
    const ts = [0, ...(this._times ?? []), this.secs];
    let maxGap = 0, gaps180 = 0;
    for (let i = 1; i < ts.length; i++) { const g = ts[i] - ts[i - 1]; if (g > maxGap) maxGap = g; if (g > 180) gaps180++; }
    const interior = (this._times ?? []).length >= 2 ? Math.max(...this._times.slice(1).map((t, i) => t - this._times[i])) : null;
    const promo = crew.promoInfo?.();
    const rows = crew.goalRows?.() ?? [];
    const fields = {
      bot: process.env.LADDER_BOT ?? '?', maxGap: +maxGap.toFixed(1), interiorGap: interior == null ? null : +interior.toFixed(1), gaps180,
      firstCall: this._times?.length ? +this._times[0].toFixed(1) : null,
      cash: Math.round(crew.cash), fee: promo?.fee ?? crew.promoFee?.() ?? null, ready: !!promo?.ready,
      venueAtBell: crew.endless ? 'Endless' : crew.venue, endless: !!crew.endless, lb: crew.lastBucket?.phase ?? null,
      card: rows.map(r => `${r.id}${r.done ? '+' : ':' + (r.kind === 'fee' ? Math.round(r.have) + '/' + Math.round(r.need) : r.have + '/' + r.need)}`).join(' '),
    };
    this._times = [];
    return end0.call(this, crew, { ...extra, ...fields });
  };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = k => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const OUT = resolve(opt('--out') ?? join(HERE, '..', '..', '.ladder14'));
  const mode = args[0];
  if (mode === 'chain') return chain(+args[1], +args[2], OUT);
  // leg <players> <seed> <tag> <bot> <start.json|preset.json>: one extra leg in <n>p-<seed>/ (a continuation or a substitute)
  if (mode === 'leg') { const j = JSON.parse(readFileSync(args[5], 'utf8')); const sv = j.save ?? j; const env0 = args[4] === 'mid' ? { FIGHT: '55' } : { JOB: '1', STOPV: '99', ENDLESS: '5' }; const dir = join(OUT, args[1] + 'p-' + args[2]); const r = runBot(dir, args[3], args[4], +args[1], +args[2], sv, env0); console.log(args[3], 'exit', r.status, r.cap ?? '', r.wall + 's'); return; }
  if (mode === 'late') return lateOnly(+args[1], +args[2], OUT);
  if (mode === 'report') return report(OUT);
  console.error('usage: ladder14.mjs chain <players> <seed> | report  [--out DIR]'); process.exit(2);
}

const CAPS = { 0: 8, 1: 10, 2: 6, 3: 6, 4: 6, 5: 4 };   // make-presets.mjs
const LOOSE = process.env.LADDER_CAPS ?? Object.entries(CAPS).map(([v, n]) => `${v}:${n * 2}`).join(',');
const POL = { BUY: '1', TOURNEY: '1', WHISTLE: 'aim', POACH: '1' };
const readJsonl = f => { try { return readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean).map(l => JSON.parse(l)); } catch { return []; } };

function runBot(dir, tag, bot, n, seed, startSave, env0) {
  const snapFile = join(dir, `${tag}.snaps.jsonl`), callsFile = join(dir, `${tag}.calls.jsonl`);
  writeFileSync(snapFile, ''); writeFileSync(callsFile, '');
  const env = { ...process.env, ...POL, SNAP_FILE: snapFile, CALLS_JSON: callsFile, SHIFT_CAPS: LOOSE, V: '0', LADDER14_HOOK: '1', LADDER_BOT: bot, ...env0 };
  delete env.START; delete env.POLICY; delete env.START_FILE;
  if (startSave) { env.START_FILE = join(dir, `${tag}.start.json`); writeFileSync(env.START_FILE, JSON.stringify(startSave)); }
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--import', pathToFileURL(fileURLToPath(import.meta.url)).href, join(HERE, `${bot}.mjs`), String(n), String(seed)],
    { env, encoding: 'utf8', maxBuffer: 512 << 20 });
  writeFileSync(join(dir, `${tag}.out`), (r.stdout ?? '') + '\n--- stderr ---\n' + (r.stderr ?? ''));
  const cap = /CAP (.*)/.exec(r.stderr ?? '');
  return { tag, bot, status: r.status, signal: r.signal, cap: cap?.[1] ?? null, err: r.status !== 0 && !cap ? (r.stderr ?? '').slice(-1500) : null,
    wall: Math.round((Date.now() - t0) / 1000), snaps: readJsonl(snapFile), calls: readJsonl(callsFile) };
}

function chain(n, seed, OUT) {
  const dir = join(OUT, `${n}p-${seed}`); mkdirSync(dir, { recursive: true });
  const legs = [], notes = [];
  const log = s => { console.log(`[${n}P s${seed}] ${s}`); notes.push(s); };
  const save = () => writeFileSync(join(dir, 'chain.json'), JSON.stringify({ n, seed, notes, legs: legs.map(({ snaps, ...l }) => ({ ...l, lastSnap: snaps.at(-1) ? { ...snaps.at(-1), save: summ(snaps.at(-1).save) } : null })) }, null, 1));
  // 1. Muni
  const muni = runBot(dir, 'muni', 'muni', n, seed, null, {});
  muni.label = `${n}P muni.mjs`; legs.push(muni);
  let clubStart = muni.snaps.find(s => s.tag === 'end' && s.venue === 1);
  if (!clubStart) {
    log(`Muni: ${n}P muni.mjs never promoted (exit ${muni.status}${muni.cap ? ', ' + muni.cap : ''})`);
    if (n === 4) { save(); return; }
    const sub = runBot(dir, 'muni4p', 'muni', 4, seed, null, {});
    sub.label = `SUBSTITUTE 4P muni.mjs (seed ${seed})`; sub.substitute = true; legs.push(sub);
    clubStart = sub.snaps.find(s => s.tag === 'end' && s.venue === 1);
    if (!clubStart) { log('the 4P substitute Muni also failed'); save(); return; }
    log(`Muni substitute: the 4P crew's Club day 1 (as make-presets.mjs does), played on by ${n}P`);
  }
  // 2. Club + Tiered
  const mid = runBot(dir, 'mid', 'mid', n, seed, clubStart.save, { FIGHT: '55' });
  mid.label = `${n}P mid.mjs`; legs.push(mid);
  const stad = mid.snaps.filter(s => s.tag === 'morning' && s.venue === 3).at(0);
  if (!stad) { log(`Club/Tiered: ${n}P mid.mjs never reached the Stadium (exit ${mid.status}${mid.cap ? ', ' + mid.cap : ''}${mid.err ? ', error' : ''})`); save(); return; }
  // 3. Stadium -> endless day 5
  const late = runBot(dir, 'late', 'late11', n, seed, stad.save, { JOB: '1', STOPV: '99', ENDLESS: '5' });
  late.label = `${n}P late11.mjs`; legs.push(late);
  if (late.status !== 0) log(`Stadium on: late11.mjs exit ${late.status}${late.cap ? ', ' + late.cap : ''}`);
  save();
  console.log(`[${n}P s${seed}] done: ${legs.map(l => `${l.tag} ${l.wall}s`).join(', ')}`);
}

// rerun only the Stadium -> endless leg from an existing chain's mid snaps (after the ending-hold fix in the hook)
function lateOnly(n, seed, OUT) {
  const dir = join(OUT, `${n}p-${seed}`), cf = join(dir, 'chain.json');
  const c = JSON.parse(readFileSync(cf, 'utf8'));
  const stad = readJsonl(join(dir, 'mid.snaps.jsonl')).filter(s => s.tag === 'morning' && s.venue === 3).at(0);
  if (!stad) { console.log(`[${n}P s${seed}] no Stadium snap`); return; }
  const late = runBot(dir, 'late', 'late11', n, seed, stad.save, { JOB: '1', STOPV: '99', ENDLESS: '5' });
  late.label = `${n}P late11.mjs`;
  const { snaps, ...l } = late;
  c.legs = [...c.legs.filter(x => x.tag !== 'late'), { ...l, lastSnap: snaps.at(-1) ? { ...snaps.at(-1), save: summ(snaps.at(-1).save) } : null }];
  c.notes = c.notes.filter(x => !/^Stadium on/.test(x)); if (late.status !== 0) c.notes.push(`Stadium on: late11.mjs exit ${late.status}${late.cap ? ', ' + late.cap : ''}`);
  writeFileSync(cf, JSON.stringify(c, null, 1));
  console.log(`[${n}P s${seed}] late redone: ${late.wall}s exit ${late.status}`);
}

function summ(s) { return s && { day: s.day, venue: s.venue, venueDay: s.venueDay, cash: Math.round(s.cash ?? 0), endless: !!s.endless, up: s.up }; }

// ---------------------------------------------------------------- report
const VN = ['Muni', 'Club', 'Tiered', 'Stadium', 'County', 'Orbital'];
const LOBBY = { muni: 0, mid: 30, late11: 40 };   // s per shift each bot adds for the report/lobby (muni models none)
function report(OUT) {
  const res = [];
  for (const d of readdirSync(OUT).filter(d => /^\dp-\d+$/.test(d)).sort()) {
    const f = join(OUT, d, 'chain.json'); if (!existsSync(f)) continue;
    const c = JSON.parse(readFileSync(f, 'utf8'));
    const shifts = [];
    for (const l of c.legs) {
      if (l.substitute === undefined && l.tag === 'muni' && c.legs.some(x => x.substitute)) continue;   // the stalled small Muni: reported separately
      for (const r of readJsonl(join(OUT, d, `${l.tag}.calls.jsonl`))) shifts.push({ ...r, leg: l.tag, sub: !!l.substitute });
    }
    const stalledMuni = c.legs.find(l => l.tag === 'muni' && c.legs.some(x => x.substitute));
    const per = {};
    let mins = 0, lobby = 0, endAt = null, endLobby = null, endless = 0;
    for (const r of shifts) {
      mins += r.mins; lobby += LOBBY[r.bot] ?? 0;
      const v = r.venue;
      const p = per[v] ??= { shifts: 0, mins: 0, n: 0, ans: 0, maxGap: 0, gaps180: 0, over: false, sub: r.sub, last: null };
      p.shifts++; p.mins += r.mins; p.n += r.n; p.ans += r.ans; p.maxGap = Math.max(p.maxGap, r.maxGap); p.gaps180 += r.gaps180; p.last = r;
      if (v === 'Endless') endless++;
      if (endAt == null && r.endless && v !== 'Endless') { endAt = mins; endLobby = mins + lobby / 60; }
    }
    for (const [v, p] of Object.entries(per)) { const i = VN.indexOf(v); if (i >= 0 && p.shifts > CAPS[i]) p.over = true; }
    res.push({ ...c, d, shifts, per, endAt, endLobby, endless, stalledMuni });
  }
  const L = [];
  const hm = m => m == null ? '—' : `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, '0')}`;
  for (const r of res) {
    L.push(`### ${r.n}P seed ${r.seed}`, '');
    if (r.stalledMuni) L.push(`- Muni at ${r.n}P: ${r.stalledMuni.cap ?? 'never promoted (exit ' + r.stalledMuni.status + ')'}. ${readJsonl(join(OUT, r.d, 'muni.calls.jsonl')).length} shifts played; the Club start below is the **4P crew's** Club day 1 (substitute).`);
    for (const n of r.notes) L.push(`- ${n}`);
    L.push(`- Ending (Last Bucket banked): **${r.endAt != null ? 'yes' : 'NO'}**${r.endAt != null ? ` at ${r.endAt.toFixed(0)} shift-min (${hm(r.endAt)}), ${hm(r.endLobby)} with the bots' lobby time` : ''}; endless shifts played: ${r.endless}${r.endless >= 5 ? ' (day 5 reached)' : ''}`, '');
    L.push('| Venue | Shifts | Shift-min | Calls/min offered | answered | Longest no-call gap (s) | Gaps > 3 min | Cash at last bell | Fee | Card at last bell |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const v of [...VN, 'Endless']) {
      const p = r.per[v]; if (!p) continue;
      const lb = p.last;
      L.push(`| ${v}${p.sub ? ' (4P sub)' : ''} | ${p.shifts}${p.over ? ' ⚠ over cap ' + CAPS[VN.indexOf(v)] : ''} | ${p.mins.toFixed(1)} | ${(p.n / p.mins).toFixed(2)} | ${(p.ans / p.mins).toFixed(2)} | ${p.maxGap.toFixed(0)} | ${p.gaps180} | $${lb.cash.toLocaleString()} | ${lb.fee != null ? '$' + Math.round(lb.fee).toLocaleString() : '—'} | ${v === 'Endless' ? '' : lb.card} |`);
    }
    L.push('');
  }
  writeFileSync(join(OUT, 'report.md'), L.join('\n'));
  writeFileSync(join(OUT, 'report.json'), JSON.stringify(res.map(({ shifts, ...r }) => r), null, 1));
  console.log(L.join('\n'));
}

if (process.env.LADDER14_HOOK !== '1') await main();
