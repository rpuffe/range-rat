// Council round 11 #3 (builder 4): text load, measured. (Council round 13: builder 3 owns it; it runs centre.js.) Replays every morning's events through the client's own
// centre-text queue (say.js createSayModel) and story card (storycard.js createStoryCard, 4 s a card), the way main.js
// and round2.js wire them, along a 4P ladder: Muni days 1–5 (fresh crew), Club days 1–5 (club1 preset), each later
// promotion morning (tiered1, stadium1, county1, orbital1) and its next morning, the Last Bucket morning, and endless
// days 1–2. Seeds 7 / 11 / 23. Rats stand still (text load doesn't depend on play; the days advance on idle shifts).
//
// A morning's text block: from the shift's start, centre text back to back (gaps under 1.5 s merge). Reported: its
// seconds, its centre items (a story beat counts once; its cards are listed), and when the memo (the day's target) shows.
//
// usage: node scripts/bots/textload.mjs [seeds=7,11,23] [N=4]     env REPO=<a checkout> measures another tree (a baseline)
//        env V=1 prints each morning's item timeline; env FULL=1 watches every whole shift
//
// Council round 12, 9.2 (builder 4): it measures what matters.
//   - overlaps: two centre items up at once (a say.js item other than the bell's stamp while a story card is up, or a
//     story card and a say item swapping in the same 0.1 s with no gap counts as nothing; only true co-presence counts).
//     Counted as episodes over the whole watched window, not just the morning block. Target 0 everywhere.
//   - the watch widens to the whole shift on boss days (crew.bossToday()), and at the Stadium and the County (the
//     Stretch and Inspection Hour fire at T−3:30). `alerts` counts the ALERTs in the watched window.
//   - the endless preset is a true first endless morning (council round 12, 9.1): the epilogue's story beat plays.
import { readFileSync } from 'node:fs';
const REPO = process.env.REPO ? new URL('file:///' + process.env.REPO.replace(/\\/g, '/').replace(/\/?$/, '/')).href : new URL('../../', import.meta.url).href;
const { Crew } = await import(REPO + 'server/crew.mjs');
const SAYM = await import(REPO + 'web/js/say.js');
const { createStoryCard } = await import(REPO + 'web/js/storycard.js');
const PAM = await import(REPO + 'web/js/pa.js'), { PA_LINES } = PAM;
const S = await import(REPO + 'web/js/sim.js');
const presetDir = new URL('server/presets/', REPO);

const SEEDS = (process.argv[2] ?? '7,11,23').split(',').map(Number), N = +(process.argv[3] ?? 4), V = process.env.V === '1';
const DT = 0.1, WINDOW = 120, MERGE = 1.5;
const paSecs = line => (Math.max(PAM.MIN_SHOW_MS ?? 4000, line.split(/\s+/).filter(Boolean).length * 380 + 1000) + 700) / 1000;   // pa.js secsFor
const preset = id => { const j = JSON.parse(readFileSync(new URL(id + '.json', presetDir), 'utf8')); return j.save ?? j; };

function makeCrew(save, seed) {
  const clock = { t: 0 };
  const crew = new Crew('TXLD', save ? structuredClone(save) : null, { now: () => clock.t * 1000, seed });
  const rats = Array.from({ length: N }, (_, i) => { const p = crew.join('Rat' + i); crew.connect(p); return p; });
  return { crew, rats, clock };
}
const keepAlive = (crew, rats, clock) => { for (const p of rats) { p.seenAt = clock.t * 1000; p.movedAt = clock.t * 1000; } };

// Start the next morning (everyone readies up) and replay its first WINDOW seconds of centre text.
function morning(env, tag) {
  const { crew, rats, clock } = env;
  crew.flush();
  for (const p of rats) crew.readyUp(p);
  // council round 14 6.7: the ending report holds Ready until the end card has had its 10 s
  for (let g = 0; g < 600 && crew.phase === 'report' && crew.report?.ending; g++) { keepAlive(crew, rats, clock); clock.t += DT; crew.tick(DT); }
  if (crew.phase !== 'shift') return null;
  // Council round 13 #2 (builder 3): also the Tournament days (the Club from day 4) and the Last Bucket (the bank, the
  // note, the epilogue), and the queue is say.js on centre.js: the model and the client run the same arbiter.
  // council round 14 (builder 4): the peaks' windows too: Muni day 3 and Club day 2 (the Gold Rush), Tiered (Happy Hour)
  const peakDay = !crew.endless && ((crew.venue === 0 && crew.day === 3) || (crew.venue === 1 && crew.venueDay === 2) || crew.venue === 2);
  const whole = process.env.FULL === '1' || peakDay || !!crew.bossToday?.() || (!crew.endless && (crew.venue === 3 || crew.venue === 4 || (crew.venue === 1 && (crew.venueDay ?? 0) >= 4))) || !!crew.lastBucket || tag.startsWith('lastbucket');
  const WIN = whole ? Math.max(WINDOW, crew.shiftSecs ?? 420) : WINDOW;
  let t = 0;
  const sayer = SAYM.createSayModel({ now: () => t });
  const card = createStoryCard({ sayer, now: () => t, tick: 0 });
  const later = [], log = [], peaks = [];
  const memoSecs = e => (e.story && SAYM.SAY.STORY_MEMO ? SAYM.SAY.STORY_MEMO : 7);
  const feed = (e, at) => {
    switch (e.t) {
      case 'pa': if (PA_LINES[e.id]) sayer.say('PA', PA_LINES[e.id].caption, { secs: paSecs(PA_LINES[e.id].line), data: { id: e.id } }); break;
      case 'memo': if (!e.quiet) sayer.say('MEMO', e.text, { secs: memoSecs(e), data: { memo: true, second: e.today ? 'TODAY · ' + e.today : e.flavor } }); break;
      case 'debut': if (e.told === undefined) sayer.say('MEMO', `NEW: the ${S.KIND_NAMES[e.kind] ?? e.kind}.`, { secs: 5, data: { debut: e.kind } }); break;   // the old client's debut memo
      case 'reveal':
        if (e.venue !== 6) later.push({ at: at + 3, fn: () => S.revealCards(e.venue, e.memo).forEach((text, i) => sayer.say('MEMO', text, { secs: i ? 10 : 9, data: { reveal: true } })) });
        later.push({ at: at + 6, fn: () => sayer.say('TOAST', 'Day · venue · you are a …', { secs: 4 }) });
        break;
      case 'story': card.add(e.id); break;
      // council round 14: the peaks' start ALERTs, as their views say them (views/goldrush.js, happyhour.js, tourney.js)
      case 'rush': if (e.phase === 'drop') { peaks.push({ key: 'goldrush', at }); sayer.say('ALERT', "Gold Rush! Beat Site 13's cart!", { key: 'goldrush' }); } break;
      case 'happy': if (e.phase === 'start') { peaks.push({ key: 'happyhour', at }); sayer.say('ALERT', e.bonus ? 'Bonus round! The bell has spoken.' : 'Happy Hour! Drinks, and fetch the greens!', { key: 'happyhour' }); } break;
      case 'tourney': if (e.phase === 'flight') { peaks.push({ key: 'tourney', at }); sayer.say('ALERT', "Members' Tournament! Grab their balls first!", { key: 'tourney' }); } break;
    }
  };
  const busy = [];   // [t, what] samples
  let prevVis = null, prevCard = null;
  const shown = [];
  let overlaps = 0, overlapT = 0, inOverlap = false, alerts = 0;
  for (; t <= WIN && crew.phase === 'shift'; t = Math.round((t + DT) * 1000) / 1000) {
    for (const e of crew.flush().ev ?? []) feed(e, t);
    for (let i = later.length - 1; i >= 0; i--) if (later[i].at <= t) { later[i].fn(); later.splice(i, 1); }
    sayer.update(); card.step();
    const vis = sayer.visible, c = card.card;
    if (vis && vis !== prevVis) { shown.push({ t, kind: vis.kind, text: vis.text, data: vis.data }); if (vis.kind === 'ALERT') alerts++;
      for (const pk of peaks) if (!pk.shownAt && vis.kind === 'ALERT' && vis.key === pk.key) pk.shownAt = t; }
    const both = !!(vis && vis.kind !== 'STAMP' && c && card.up);   // two centre items at once
    if (both) { overlapT += DT; if (!inOverlap) { overlaps++; if (V) console.log(`      !! overlap at ${t.toFixed(1)}: ${vis.kind} "${vis.text}" under "${c.line}"`); } }
    inOverlap = both;
    if (c && card.beat && c !== prevCard) shown.push({ t, kind: 'CARD', text: c.line, beat: card.beat.id });
    prevVis = vis; prevCard = c;
    busy.push(vis || c ? 1 : 0);
    keepAlive(crew, rats, clock);
    clock.t += DT; crew.tick(DT);
  }
  // The first block of back-to-back centre text.
  let end = 0, gap = 0, started = false;
  for (let i = 0; i < busy.length; i++) {
    const ti = i * DT;
    if (busy[i]) { started = true; end = ti + DT; gap = 0; }
    else if (started) { gap += DT; if (gap > MERGE) break; }
  }
  const inBlock = shown.filter(s => s.t < end);
  const beats = new Set(inBlock.filter(s => s.kind === 'CARD').map(s => s.beat));
  const items = inBlock.filter(s => s.kind !== 'CARD').length + beats.size;
  const memos = inBlock.filter(s => s.kind === 'MEMO').length;
  const memoAt = inBlock.find(s => s.kind === 'MEMO' && s.data?.memo)?.t ?? null;
  return { tag, day: crew.day, venue: crew.venue, vday: crew.venueDay, secs: +end.toFixed(1), items, memos, cards: inBlock.filter(s => s.kind === 'CARD').length, memoAt, shown: inBlock,
    overlaps, overlapT: +overlapT.toFixed(1), alerts, peaks: peaks.map(p => ({ key: p.key, at: +p.at.toFixed(1), shown: p.shownAt != null, wait: p.shownAt != null ? +(p.shownAt - p.at).toFixed(1) : null })), win: whole ? 'shift' : WINDOW + ' s', epilogue: shown.some(s => s.beat === 'epilogue') };
}
// Play out the rest of the shift idle (to the bell and the report) so the next morning can start.
function finishShift(env) {
  const { crew, rats, clock } = env;
  let guard = 0;
  while (crew.phase === 'shift' && guard++ < 20000) { keepAlive(crew, rats, clock); clock.t += 0.25; crew.tick(0.25); }
  crew.flush();
}

const results = [];
function run(label, save, seed, days, promo = []) {
  const env = makeCrew(save, seed);
  for (let d = 0; d < days; d++) {
    const r = morning(env, `${label}${days > 1 ? ' #' + (d + 1) : ''}`);
    if (!r) break;
    r.seed = seed; r.promo = promo.includes(d); r.label = label; r.i = d;
    results.push(r);
    finishShift(env);
  }
}
for (const seed of SEEDS) {
  run('muni', null, seed, 5);
  run('club', preset('club1'), seed, 5, [0]);
  for (const v of ['tiered1', 'stadium1', 'county1', 'orbital1']) run(v.replace('1', ''), preset(v), seed, 2, [0]);
  run('lastbucket', preset('lastbucket'), seed, 1);
  run('endless', preset('endless'), seed, 2);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`text load (${N}P, seeds ${SEEDS.join('/')}${process.env.REPO ? ', REPO ' + process.env.REPO : ''})`);
console.log(pad('morning', 16) + pad('seed', 6) + pad('day', 5) + pad('v/vd', 7) + pad('secs', 7) + pad('items', 7) + pad('memos', 7) + pad('cards', 7) + pad('memo at', 9) + pad('overlap', 9) + pad('alerts', 8) + 'watched');
for (const r of results) {
  console.log(pad(r.tag + (r.promo ? ' *' : ''), 16) + pad(r.seed, 6) + pad(r.day, 5) + pad(`${r.venue}/${r.vday}`, 7) + pad(r.secs, 7) + pad(r.items, 7) + pad(r.memos, 7) + pad(r.cards, 7) + pad(r.memoAt ?? '-', 9) + pad(r.overlaps + (r.overlaps ? ` (${r.overlapT}s)` : ''), 9) + pad(r.alerts, 8) + r.win + (r.epilogue ? ' · epilogue' : ''));
  if (V) for (const s of r.shown) console.log(`      ${s.t.toFixed(1).padStart(5)} ${pad(s.kind, 6)} ${s.text}${s.kind === 'MEMO' && s.data?.second ? '  / ' + s.data.second : ''}`);
}
const promos = results.filter(r => r.promo), club = results.filter(r => r.label === 'club' && r.i < 4);
const max = (a, k) => Math.max(...a.map(r => r[k]));
console.log(`\npromotion mornings: max ${max(promos, 'secs')} s, max ${max(promos, 'items')} items  (target ≤ 28 s, ≤ 3 items)`);
console.log(`Club days 1–4: max ${max(club, 'secs')} s  (target ≤ 22 s)`);
console.log(`mornings with two or more memos: ${results.filter(r => r.memos > 1).length} of ${results.length}  (target 0)`);
console.log(`overlaps (two centre items at once): ${results.reduce((a, r) => a + r.overlaps, 0)} in ${results.filter(r => r.overlaps).length} of ${results.length} watched windows  (target 0)`);
{ const pk = results.flatMap(r => (r.peaks ?? []).map(p => ({ ...p, tag: r.tag, seed: r.seed })));   // council round 14 (builder 4)
  const lost = pk.filter(p => !p.shown);
  console.log(`peak ALERTs shown: ${pk.length - lost.length} of ${pk.length}; max wait ${pk.length ? Math.max(0, ...pk.filter(p => p.shown).map(p => p.wait)) : '-'} s  (target: all)${lost.length ? '  LOST: ' + lost.map(p => `${p.key} ${p.tag} s${p.seed} @${p.at}`).join(', ') : ''}`); }
const ep = results.filter(r => r.label === 'endless' && r.i === 0);
console.log(`the first endless morning plays the epilogue: ${ep.filter(r => r.epilogue).length} of ${ep.length}; max ${ep.length ? max(ep, 'secs') : '-'} s  (target ≤ 28 s)`);
