// The Closing Bell (council round 6, #2 and #3): what the crew is short of at Last Call, and why a review missed on
// the venue gauge. Pure rules: no THREE, no DOM. The server picks the line; the client only shows it.
import { QUOTA_KPI } from './sim.js';

// Every line is one centre toast: 8 words or fewer.
export const RALLY_LINES = {
  gauge: {                                   // by venue: the fourth gauge is under QUOTA_KPI
    2: 'Bowls are full. Shoot or empty them!',
    3: 'The crowd is bored. Lap the Track!',
    4: 'Strays in the Yards. Go get them!',
    5: 'Debris overhead. Ride the Lift!',
  },
  mats: 'Hose the mats before the bell!',
  sign: 'The sign is filthy. Hose it!',
  stand: 'The stand is filthy. Hose it!',
  fries: 'Fries are low. Cook!',
  pond: 'The pond is murky. Dive!',
  onTarget: 'On target. Hold it till the bell.',
};

// The report's miss line when the gauge, not Upkeep, cost the stamp (by venue).
export const GAUGE_MISS = {
  2: 'Missed: the bowls were full.',
  3: 'Missed: the crowd was bored.',
  4: 'Missed: strays in the Yards.',
  5: 'Missed: too much debris overhead.',
};

export const FRIES_LOW = 0.5;
export const POND_MURKY = 0.6;

// Is the gauge holding? No gauge (the Muni, the Club) always is.
export const gaugeOk = kpi => kpi == null || kpi + 1e-9 >= QUOTA_KPI;
// The same test the review uses: Upkeep (BV / Rate) against 1 + q.
export const upkeepOk = (value, quota) => !quota || value.bv / value.rate + 1e-9 >= 1 + quota.q;

// The single biggest shortfall, as one line, or null (endless, or no review today).
//   value: the crew's valueNow() (bv, rate, curb, pond, fries); quota: { q }; kpi: the venue gauge or null;
//   fixtures: { id: mud 0..1 }; fries / pond: 0..1 or null (locked).
export function shortfall({ value, quota, kpi = null, fixtures = {}, fries = value?.fries ?? null, pond = value?.pond ?? null, venue = 0, endless = false }) {
  if (endless || !quota || !value) return null;
  if (!gaugeOk(kpi)) return RALLY_LINES.gauge[venue] ?? null;
  if (upkeepOk(value, quota)) return RALLY_LINES.onTarget;
  // Under target: name the worst term (the one costing the most Upkeep).
  let worst = null, dirt = 0;
  for (const [id, mud] of Object.entries(fixtures)) if (mud > dirt) { dirt = mud; worst = id; }
  const curbLoss = 1 - (value.curb ?? 1);
  const cands = [{ line: worst == null ? RALLY_LINES.mats : worst.startsWith('mat') ? RALLY_LINES.mats : RALLY_LINES[worst] ?? RALLY_LINES.mats, loss: curbLoss }];
  if (fries != null && fries < FRIES_LOW) cands.push({ line: RALLY_LINES.fries, loss: 1 - fries });
  if (pond != null && pond < POND_MURKY) cands.push({ line: RALLY_LINES.pond, loss: 1 - pond });
  return cands.reduce((a, b) => (b.loss > a.loss ? b : a)).line;
}

// Last Call swings x1.5, so the cups (Tiered) refill during the rush: the line reads the gauge this far ahead
// (playtest 2: 6 of 9 "On target" bells at Tiered were then DENIED on the gauge).
export const RALLY_MARGIN = Object.freeze({ 2: 0.25, 3: 0.1, 4: 0.1, 5: 0.1 });
