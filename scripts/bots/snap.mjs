// Preset capture for the bot crews (round 11, "skip ahead"): scripts/make-presets.mjs runs the bots with
// SNAP_FILE set, and every snap appends one JSON line { tag, day, venue, venueDay, endless, save } to it.
// START_FILE: a save to start the bot from (the previous bot's end state), instead of its built-in start.
import { appendFileSync, readFileSync } from 'node:fs';

export function snap(crew, tag) {
  const f = process.env.SNAP_FILE;
  if (!f) return;
  const save = crew.toSave();
  appendFileSync(f, JSON.stringify({ tag, day: save.day, venue: crew.venue, venueDay: crew.venueDay, endless: crew.endless,
    lastBucket: crew.lastBucket?.phase ?? null, save }) + '\n');
}

export function startSave() {
  const f = process.env.START_FILE;
  return f ? JSON.parse(readFileSync(f, 'utf8')) : null;
}

// Council round 13 #0c: shift caps. SHIFT_CAPS="0:8,1:10,2:6,3:6,4:6,5:4" (venue:shifts). Call after every bell (after
// the bot signs for a promotion) with the shifts played at the crew's current venue; still there at the cap (it would
// need one more) the bot prints the stuck goal and exits 1, so
// make-presets.mjs never writes a preset set from a crew that didn't get there.
const VNAME = ['Muni', 'Club', 'Tiered', 'Stadium', 'County', 'Orbital'];
export function parseCaps(s = process.env.SHIFT_CAPS) {
  const caps = {};
  for (const part of String(s ?? '').split(',')) { const [v, n] = part.split(':').map(Number); if (Number.isInteger(v) && n > 0) caps[v] = n; }
  return caps;
}
export function stuckLine(crew, shifts) {
  const open = (crew.goalRows?.() ?? []).filter(r => !r.done);
  const what = open.map(r => `${r.id} ${r.kind === 'fee' ? Math.round(r.have) + '/' + Math.round(r.need) : r.have + '/' + r.need}`).join(', ') || 'no open goal (the bot never signed)';
  return `stuck at ${crew.endless ? 'Endless' : VNAME[crew.venue] ?? 'venue ' + crew.venue} on ${what} after ${shifts} shifts`;
}
export function capCheck(crew, shiftsHere, caps = parseCaps()) {
  if (crew.endless) return;
  const cap = caps[crew.venue];
  if (cap && shiftsHere >= cap) { console.error('CAP ' + stuckLine(crew, shiftsHere)); process.exit(1); }
}
