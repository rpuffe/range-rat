// Council round 13 #0f: policy hooks. A builder adds a play policy to the bots by dropping a file in
// scripts/bots/policy/<name>.mjs, switched on by an env flag, so nobody edits another builder's bot.
//
//   TOURNEY=1    -> policy/tourney.mjs    (builder 2: chase the members' balls)
//   WHISTLE=aim  -> policy/whistle.mjs    (builder 1: carry the whistle to the densest strip; any value but 0)
//   BUY=1        -> policy/landmarks.mjs  (builder 2: buy the landmark tiers)
//   POACH=1      -> policy/poach.mjs      (builder 2: poach a Site 13 regular in endless)
//   POLICY=a,b   -> policy/a.mjs, policy/b.mjs (anything else)
//
// A policy file's default export is a factory: make(ctx, value) => hooks. ctx is the bot's
//   { bot, crew, rats, N, DT, now() /* sim seconds */, walkTo?(p, x, z) /* true when there */, log(s) }
// and value is the env flag's string ('1', 'aim', ...). Every hook is optional:
//   shiftStart()        at each shift's first tick
//   step(dt)            each tick after crew.tick, while crew.phase === 'shift'; return the Rats it moved this tick
//                       (an array or Set) and the bot leaves them alone this tick
//   buy()               when the bot shops (morning, and every ~10 s)
//   shiftEnd(report)    at the bell; return an object and its fields join the bot's shift record
//   summary()           at exit; return lines to print
// A flag whose file is missing fails loudly (exit 1): a measurement taken without its policy is worse than none.
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DIR = fileURLToPath(new URL('./policy/', import.meta.url));
export const FLAGS = Object.freeze({ TOURNEY: 'tourney', WHISTLE: 'whistle', BUY: 'landmarks', POACH: 'poach' });

// Which policy files the environment asks for: [{ name, flag, value }]. Pure (env in), for the tests.
export function wanted(env = process.env) {
  const out = [];
  for (const [flag, name] of Object.entries(FLAGS)) { const v = env[flag]; if (v != null && v !== '' && v !== '0') out.push({ name, flag, value: v }); }
  for (const name of String(env.POLICY ?? '').split(',').map(s => s.trim()).filter(Boolean)) if (!out.some(o => o.name === name)) out.push({ name, flag: 'POLICY', value: '1' });
  return out;
}

export async function loadPolicies(ctx, env = process.env, dir = DIR) {
  const list = [];
  for (const w of wanted(env)) {
    const file = dir + w.name + '.mjs';
    if (!existsSync(file)) { console.error(`${w.flag}=${w.value} needs scripts/bots/policy/${w.name}.mjs, which doesn't exist`); process.exit(1); }
    const mod = await import(pathToFileURL(file).href);
    const make = mod.default ?? mod.make;
    if (typeof make !== 'function') { console.error(`policy/${w.name}.mjs has no default export make(ctx, value)`); process.exit(1); }
    list.push({ name: w.name, ...(await make({ log: s => console.log(`[${w.name}] ${s}`), ...ctx }, w.value)) });
  }
  return new Policies(list);
}

export class Policies {
  constructor(list = []) { this.list = list; this.names = list.map(p => p.name); this.started = false; }
  get any() { return this.list.length > 0; }
  // call every tick of the shift; returns the Set of Rats the policies moved (the bot skips them this tick)
  step(crew, dt) {
    const moved = new Set();
    if (crew.phase !== 'shift') { this.started = false; return moved; }
    if (!this.started) { this.started = true; for (const p of this.list) p.shiftStart?.(); }
    for (const p of this.list) { const r = p.step?.(dt); if (r) for (const x of r) moved.add(x); }
    return moved;
  }
  buy() { for (const p of this.list) p.buy?.(); }
  shiftEnd(report) { this.started = false; const o = {}; for (const p of this.list) Object.assign(o, p.shiftEnd?.(report) ?? {}); return o; }
  summary(log = console.log) { for (const p of this.list) for (const l of p.summary?.() ?? []) log(`[${p.name}] ${l}`); }
}
