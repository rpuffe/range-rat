// Round 11 (owner): "Build more bays". The owner, playing: "we should legitimately add more bays instead of just
// keeping a few of them closed and empty and really not understanding why golfers aren't on those ones."
// A bay that isn't built doesn't exist: no mat, no divider, no number, no mud, nobody walks to it. The crew row
// 'build' adds BUILD.STEP bays a tier at every crew size, so a crew of four can grow past the old ten.
// Pure rules: no THREE, no DOM (test/bays.test.mjs).
// DELIBERATELY imports nothing from sim.js: sim.js imports BUILD_ROW and the line from here (see tiered.js: a cycle
// is a TDZ crash when this file loads first).

// The line, in BUILD ORDER (a mat's index is when it gets built). The first ten are the old line (x -18..18, step 4,
// sim.js MATS); the new wing runs west past the left crew bay (x -23), 4 m apart: clear of the Tiered stairs
// (x -25..-19.6 at z 2.5..5.5, behind the walkway), the Lift (-44, 5, Orbital) and the mower shed (-58, 4).
export const BASE_LINE = 10;
export const WING_X = [-28, -32, -36, -40, -44, -48];
export const LINE_LEN = BASE_LINE + WING_X.length;
export const WING_WALK_X = -21;          // a wing customer walks out along the walkway to here before cutting to the gate

// The row: +STEP bays a tier, every crew size. Tier 3 at 4P is all sixteen.
export const BUILD = { STEP: 2, TIERS: 3, UPPER_MAX: 6 };
export const BUILD_ROW = { id: 'build', title: 'Build more bays', minDay: 2, tiers: [
  { name: 'The bays you have', desc: 'More of you, more bays. Build more and more golfers come.' },
  { name: 'Two new bays', cost: 50, minDay: 2, desc: 'Two more mats on the line, open at once. Two more golfers hitting.' },
  { name: 'Two more bays', cost: 250, minDay: 3, desc: 'Two more. More balls out there, more mats to hose.' },
  { name: 'The new wing', cost: 4000, minVenue: 1, desc: 'Two more bays. Three or more of you: sixteen bays, the wing full.' },
] };

// The bays a crew gets for free: 6 solo, 8 for two, 10 for three or more (the old line).
export const baseMats = players => Math.min(BASE_LINE, 4 + 2 * Math.max(1, players | 0));
export const buildTier = up => Math.max(0, Math.min(BUILD.TIERS, Math.floor(Number(up?.build) || 0)));
// How many line bays are built: mats 0..n-1.
export const builtMats = (players, up = null) => Math.min(LINE_LEN, baseMats(players) + BUILD.STEP * buildTier(up));
// The Upper Deck (Tiered on): 2 a Rat, and each tier opens 2 more of its six.
export const builtUpper = (players, up = null) => Math.min(BUILD.UPPER_MAX, 2 * Math.max(1, players | 0) + BUILD.STEP * buildTier(up));

// Save migration. The old row 'bays' ("Open every bay", one tier) put all ten in play at any crew size. An old save
// with up.bays >= 1 becomes tier 2 of 'build': solo 6 + 4 = 10, so nobody loses a bay (2P: 12, 3P+: 14).
export const LEGACY_TIER = 2;
export function migrateBays(up) {
  if (!up || typeof up !== 'object') return up;
  const old = Math.floor(Number(up.bays) || 0);
  if (!('bays' in up)) return up;
  const { bays: _drop, ...rest } = up;
  if (old >= 1) rest.build = Math.max(buildTier(rest), LEGACY_TIER);
  return rest;
}

// 'mat7' -> 7, anything else -> -1.
export const matIndex = id => (typeof id === 'string' && /^mat\d+$/.test(id) ? +id.slice(3) : -1);
// Is this fixture there? Every non-mat fixture is; a mat only while built.
export const fixtureBuilt = (id, nMats) => { const i = matIndex(id); return i < 0 || i < nMats; };

// Keep the crew's fixture mud in step with the line (server, in a shift: the crew size is known). The old ten keep
// their slots in Curb (an unbuilt one at 0 mud, which is exactly how a closed mat always counted: balance unchanged);
// a wing bay joins Curb when built and leaves it when not. Unbuilt mats hold no mud, so nothing (Gary, the rally, a
// tip, the hose, the Board's pips) can point at one. Mutates `fixtures`; true if anything changed.
export function syncBayFixtures(fixtures, nMats) {
  let changed = false;
  for (let i = 0; i < LINE_LEN; i++) {
    const id = 'mat' + i, built = i < nMats;
    if (i < BASE_LINE) { if (!built && fixtures[id] > 0) { fixtures[id] = 0; changed = true; } }
    else if (built && !(id in fixtures)) { fixtures[id] = 0; changed = true; }
    else if (!built && id in fixtures) { delete fixtures[id]; changed = true; }
  }
  return changed;
}
