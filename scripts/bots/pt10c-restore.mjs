// Reviewer C (playtest round 10): quit and rejoin, and save -> restore, at five live moments, through the real Crew.
// A 2P crew (Cass, Dot), idle but online. For each moment:
//   live:  both seats disconnect for 30 s (the crew stays in memory), then reconnect: what ran on without them?
//   save:  toSave() mid-moment (what the server writes every minute while dirty, and on unload), JSON round-trip,
//          new Crew(save), two fresh joins (a restored crew has no players: old seats can't auth), then play the day
//          to its bell: does the moment come back, is anything lost or duplicated, does it finish?
// node scripts/bots/pt10c-restore.mjs [only]
import { readFileSync } from 'node:fs';
const REPO = new URL('../../', import.meta.url);
const { Crew } = await import(new URL('server/crew.mjs', REPO).href);
const preset = n => { const j = JSON.parse(readFileSync(new URL(`server/presets/${n}.json`, REPO), 'utf8')); return structuredClone(j.save ?? j); };

let t = 0;
const mk = save => { const c = new Crew('PTCR', save, { now: () => t * 1000, seed: 7 }); return c; };
const seat = (c, n) => { const p = c.join(n); c.connect(p); return p; };
const tick = (c, s) => { for (let i = 0; i < s * 10; i++) { t += 0.1; c.tick(0.1); } };
const ready = (c, ps) => { for (let i = 0; i < 40 && c.phase !== 'shift'; i++) { for (const p of ps) if (c.phase !== 'shift') c.readyUp(p); tick(c, 1); } return c.phase === 'shift'; };
const sum = c => ({ phase: c.phase, day: c.day, venue: c.venue, vd: c.venueDay, endless: !!c.endless, T: +(c.shiftT ?? 0).toFixed(1), cash: Math.round(c.cash),
  promoDay: c.promoDay ?? null, mods: Object.keys(c.mods?.live?.() ?? c.mods?.state?.() ?? {}), mower: c.mower ? `${c.mower.kind}:${c.mower.phase}` : null,
  lb: c.lastBucket?.phase ?? null, online: c.onlineCount(), players: c.players.size });
const modsOf = c => { try { const s = c.snapshot(); return Object.keys(s.mods ?? {}).filter(k => s.mods[k]); } catch (e) { return ['ERR ' + e.message]; } };

const MOMENTS = {
  boss: { preset: 'club2', tweak: s => ({ ...s, day: s.day + 1, venueDay: s.venueDay + 1 }), at: c => c.mower?.kind === 'boss' && /hunt|phase2|2/.test(String(c.mower.phase)) || (c.mower?.kind === 'boss' && c.shiftT > 230), what: 'Club day-3 MOW-E, phase 2' },
  tourney: { preset: 'club4-2p', at: c => (c.snapshot().mods?.tourney?.balls?.length ?? 0) > 0, what: 'a Tournament flight with balls out' },
  happy: { preset: 'tiered1', at: c => { const h = c.snapshot().mods?.happyhour; return !!h && (h.on || h.live || (h.balls?.length ?? 0) > 0); }, what: 'Happy Hour live' },
  bank: { preset: 'lastbucket', at: c => ['down', 'carried', 'huddle'].includes(c.lastBucket?.phase), what: 'the Last Bucket: Ball No. 1 down', carry: true },
  promo: { preset: 'stadiumPromo', at: c => c.mower?.kind && c.shiftT > 200, what: 'Stadium Promotion Day, mid-crash' },
};
const only = process.argv[2];
for (const [k, m] of Object.entries(MOMENTS)) {
  if (only && k !== only) continue;
  console.log(`\n=== ${k}: ${m.what} (${m.preset})`);
  t = 0;
  try {
    const c = mk((m.tweak ?? (x => x))(preset(m.preset)));
    const ps = [seat(c, 'Cass'), seat(c, 'Dot')];
    if (!ready(c, ps)) { console.log('  never started', sum(c)); continue; }
    let hit = false; for (let i = 0; i < 4400 && !hit; i++) { tick(c, 0.1); hit = m.at(c); if (c.phase !== 'shift') break; }
    console.log('  moment:', hit, JSON.stringify(sum(c)), 'mods', modsOf(c).join(','));
    if (!hit) continue;
    if (m.carry && c.lastBucket?.phase === 'down') {
      const ball = [...c.balls.values()].find(b => b.kind === 'one');
      if (ball) { const p = ps[1]; p.x = ball.x; p.z = ball.z; c.input(p, { p: p.id, x: ball.x, z: ball.z, yaw: 0, a: [{ t: 'pickup', ball: ball.id }] }); tick(c, 0.5); }
      console.log('  carry:', c.lastBucket?.phase, 'by', c.lastBucket?.by === ps[1].id ? 'Dot' : c.lastBucket?.by);
    }
    const save = JSON.parse(JSON.stringify(c.toSave()));
    const before = sum(c);
    // live: both quit for 30 s
    for (const p of ps) c.disconnect(p);
    tick(c, 30);
    const away = sum(c);
    for (const p of ps) c.connect(p);
    tick(c, 1);
    console.log('  live quit 30 s:', `T ${before.T} -> ${away.T}`, `phase ${away.phase}`, `mower ${before.mower} -> ${away.mower}`, `lb ${before.lb} -> ${away.lb}`, `cash ${before.cash} -> ${away.cash}`, 'back:', JSON.stringify(sum(c)), 'mods', modsOf(c).join(','));
    // save -> restore
    console.log('  save: day', save.day, 'venue', save.venue, 'vd', save.venueDay, 'cash', Math.round(save.cash), 'promoDay', save.promoDay ?? '-', 'endless', !!save.endless, 'keys', Object.keys(save.mods ?? {}).join(','), 'mowe', JSON.stringify(save.mowe ?? {}).slice(0, 120));
    t = 0;
    const r = mk(save);
    const rs = [seat(r, 'Cass'), seat(r, 'Dot')];
    console.log('  restored lobby:', JSON.stringify(sum(r)));
    if (!ready(r, rs)) { console.log('  RESTORED CREW NEVER STARTS', JSON.stringify(sum(r))); continue; }
    let again = false, ended = false, maxT = 0, lbSeen = new Set();
    for (let i = 0; i < 9000; i++) { tick(r, 0.1); maxT = Math.max(maxT, r.shiftT ?? 0); if (r.lastBucket?.phase) lbSeen.add(r.lastBucket.phase); if (!again && m.at(r)) again = true; if (r.phase === 'report') { ended = true; break; } }
    console.log('  restored day:', 'moment again', again, 'reached bell', ended, 'maxT', maxT.toFixed(0), 'lb phases', [...lbSeen].join('>'), JSON.stringify(sum(r)), 'report cash', Math.round(r.report?.cash ?? r.cash));
  } catch (e) { console.log('  ERROR', e.stack.split('\n').slice(0, 4).join(' | ')); }
}
