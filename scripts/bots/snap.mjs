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
