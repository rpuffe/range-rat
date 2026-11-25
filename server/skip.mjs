// Round 11, "skip ahead (test)": a NEW test crew from a preset save (server/presets/<id>.json, made by a bot crew
// playing the real game: node scripts/make-presets.mjs). Only on dev and localhost (web/js/skip.js skipHostOk, by
// the request's Host header). The preset goes through the normal save-load path: server.mjs stores it under the new
// code and loads it like any rejoin, so the Crew constructor's save cleaning and migrations apply.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { presetById, tipsFor } from '../web/js/skip.js';
import { diveTiers, MAX_DIVE_LEVEL } from '../web/js/dive.js';

const DIR = fileURLToPath(new URL('./presets/', import.meta.url));

// The preset file: { id, label, made, bot, players, save }. Null if the id is unknown or the file is missing/bad.
export async function loadPreset(id, dir = DIR) {
  if (!presetById(id)) return null;
  try {
    const p = JSON.parse(await readFile(join(dir, `${id}.json`), 'utf8'));
    return p && typeof p.save === 'object' && p.save ? p : null;
  } catch { return null; }
}

// The save a test crew starts from: the preset's, marked test, under the new code. The goal card is unprinted
// (scale/crew null) so the morning prints it for the crew actually online (1–4 Rats), keeping its counts and ticks
// (goals.js printOver). A preset is made for 4 Rats; the crew-wide rows (the shop) don't care who joins.
export function presetSave(preset, code) {
  const save = structuredClone(preset.save);
  delete save.savedAt;
  save.code = code;
  save.test = true;
  if (save.goals && typeof save.goals === 'object') { save.goals.scale = null; save.goals.crew = null; }
  return save;
}

// Personal dive gear is kept by name (diveByName); the bots' names won't match the players'. On a test crew a Rat
// joining under a new name gets the crew's best dive level, so a skip to the Club or later can dive like the crew
// that got there. Call after crew.join().
export function testJoin(crew, p) {
  if (!crew?.test || !p || Object.hasOwn(crew.diveByName, p.name)) return;
  const lvl = Math.min(MAX_DIVE_LEVEL, Math.max(0, ...Object.values(crew.diveByName)));
  if (!(lvl > 0)) return;
  crew.diveByName[p.name] = lvl;
  p.dive = lvl; p.air = diveTiers(lvl).air;
  crew.dirty = true;
}

export { tipsFor };
