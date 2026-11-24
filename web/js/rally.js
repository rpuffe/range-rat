// The Closing Bell (council round 6, #2 and #3): what the crew is short of at Last Call, and why a review missed on
// the venue gauge. Pure rules: no THREE, no DOM. The server picks the line; the client only shows it.
import { QUOTA_KPI, FRIES, POND, FIXTURE_BY_ID } from './sim.js';
import { MAP } from './map.js';

// Every line is one centre toast: 8 words or fewer.
export const RALLY_LINES = {
  gauge: {                                   // by venue: the fourth gauge is under QUOTA_KPI
    2: 'Glow rush! Cups fill double. Shoot late!',   // round 8 #1: the Glow Rush (glow balls cup x2 at Tiered)
    3: 'The crowd is bored. Lap the Track!',
    4: 'Strays in the Yards. Go get them!',
    5: 'Debris overhead. Everyone up the Lift!',   // round 8 #4: the crank is gone, so every Rat rides
  },
  mats: 'Hose the mats before the bell!',
  sign: 'The sign is filthy. Hose it!',
  stand: 'The stand is filthy. Hose it!',
  fries: 'Fries are low. Cook!',
  pond: 'The pond is murky. Dive!',
  onTarget: 'On target. Hold it till the bell.',
  keepLapping: 'Keep lapping!',              // playthrough 3: the Stadium re-check, live crowd fine, graded mean short
};

// The report's miss line when the gauge, not Upkeep, cost the stamp (by venue).
export const GAUGE_MISS = {
  2: 'Missed: the glow rush filled the bowls.',
  3: 'Missed: the crowd was bored.',
  4: 'Missed: strays in the Yards.',
  5: 'Missed: too much debris overhead.',
};

// Kept for reference; shortfall() now compares every term by its real Upkeep cost (playtest round 2 #1).
export const FRIES_LOW = 0.5;
export const POND_MURKY = 0.6;

// Is the gauge holding? No gauge (the Muni, the Club) always is.
export const gaugeOk = kpi => kpi == null || kpi + 1e-9 >= QUOTA_KPI;
// The same test the review uses: Upkeep (BV / Rate) against 1 + q.
// margin: Upkeep the rally asks for above that (UPKEEP_MARGIN); the review itself uses 0.
export const upkeepOk = (value, quota, margin = 0) => !quota || value.bv / value.rate + 1e-9 >= 1 + quota.q + margin;
// Playthrough 3 #3: Last Call scuffs ×1.5, so "On target" at the bell was DENIED 25 of 31 times (4P). The rally
// forecasts Upkeep at the bell: it says "On target" only with this much Upkeep to spare. The Last Call rally and the
// 30 s re-check both use it, so they agree.
export const UPKEEP_MARGIN = 0.06;

// The single biggest shortfall, as one line, or null (endless, or no review today).
//   value: the crew's valueNow() (bv, rate, curb, pond, fries); quota: { q }; kpi: the venue gauge or null;
//   fixtures: { id: mud 0..1 }; fries / pond: 0..1 or null (locked); margin: Upkeep to spare (UPKEEP_MARGIN).
export function shortfall({ value, quota, kpi = null, fixtures = {}, fries = value?.fries ?? null, pond = value?.pond ?? null, venue = 0, endless = false, margin = 0 }) {
  if (endless || !value) return null;
  // Round 7 #5: the Orbital has no review, only the sky gate: the line is the debris, or nothing.
  if (venue === 5 && !quota) return gaugeOk(kpi) ? null : RALLY_LINES.gauge[5];
  if (!quota) return null;
  if (!gaugeOk(kpi)) return RALLY_LINES.gauge[venue] ?? null;
  if (upkeepOk(value, quota, margin)) return RALLY_LINES.onTarget;
  // Under target: name the term costing the most Upkeep (playtest round 2 #1). Upkeep = 1 + 0.5 × (Curb + pond +
  // fries + gauge) and Curb = 1 − the mean mud of every fixture, so one fixture costs 0.5 × mud / N and the mats,
  // as one group, 0.5 × their summed mud / N: one filthy sign (1 of 12) rarely outweighs ten scuffed mats.
  const ids = Object.keys(fixtures), n = ids.length;
  const share = id => (n ? 0.5 * (fixtures[id] ?? 0) / n : 0);
  const mats = n ? ids.filter(id => id.startsWith('mat')).reduce((a, id) => a + share(id), 0) : 0.5 * (1 - (value.curb ?? 1));
  const cands = [{ line: RALLY_LINES.mats, loss: mats }];
  for (const id of ids) if (!id.startsWith('mat') && RALLY_LINES[id]) cands.push({ line: RALLY_LINES[id], loss: share(id) });
  if (fries != null) cands.push({ line: RALLY_LINES.fries, loss: 0.5 * (1 - fries) });
  if (pond != null) cands.push({ line: RALLY_LINES.pond, loss: 0.5 * (1 - pond) });
  return cands.reduce((a, b) => (b.loss > a.loss ? b : a)).line;
}

// Last Call swings x1.5, so the cups (Tiered) refill during the rush: the line reads the gauge this far ahead
// (playtest 2: 6 of 9 "On target" bells at Tiered were then DENIED on the gauge).
// Round 8 #1: Tiered 0.25 -> 0.5, so the Glow Rush deals the bowls job almost every bell.
export const RALLY_MARGIN = Object.freeze({ 2: 0.5, 3: 0.1, 4: 0.1, 5: 0.1 });

// Playtest round 2 #1: a second look this many seconds into Last Call. If the crew is still short, the server posts
// one more line (the 'rally' event), at most once a shift.
export const RALLY_RECHECK = 30;

// Round 7 #7: when the rally fires, in seconds before the bell, by venue (default: Last Call's 60). The Stadium's
// Two-Minute Warning rallies at T-120; its Last Call rules (x1.5 swings, glow balls) still start at T-60.
export const RALLY_AT = Object.freeze({ 3: 120 });
export const rallyAt = venue => RALLY_AT[venue] ?? 60;

// ---- Round 7 #4: dealt jobs. The ranked shortfalls, dealt round the crew by distance: no roles, only nudges. ----------
// Where each job is. The gauge's place is per venue: the worst bowl (Tiered), the Track (Stadium), Yard 2 (County),
// the Lift (Orbital).
export const JOB_AT = Object.freeze({
  mats: { x: 0, z: 3.5 }, sign: { x: FIXTURE_BY_ID.sign.x, z: FIXTURE_BY_ID.sign.z }, stand: { x: FIXTURE_BY_ID.stand.x, z: FIXTURE_BY_ID.stand.z },
  fries: { x: FRIES.SHED.x, z: FRIES.SHED.z }, pond: { x: POND.DOCK.x, z: POND.DOCK.z },
  gauge: {
    3: { x: MAP.TRACK.x, z: MAP.TRACK.z + MAP.TRACK.b },                    // the Track's near side
    4: { x: (MAP.YARDS.xMin + MAP.YARDS.xMax) / 2, z: (MAP.YARDS.FENCES[0] + MAP.YARDS.FENCES[1]) / 2 },   // Yard 2
    5: { x: MAP.LIFT.x, z: MAP.LIFT.z },
  },
});
// Tiered: the fullest cup's bowl (cups: the tiered module's st.cups, in MAP.BOWLS order).
export function gaugeAt(venue, cups = null) {
  if (venue === 2) {
    let i = 0;
    if (cups) for (let k = 1; k < MAP.BOWLS.length; k++) if ((cups[k] ?? 0) > (cups[i] ?? 0)) i = k;
    return { x: MAP.BOWLS[i].x, z: MAP.BOWLS[i].z };
  }
  return JOB_AT.gauge[venue] ?? JOB_AT.mats;
}

// Every real shortfall, ranked: the gauge first when it's under, then each Upkeep term costing 0.01 or more, by
// cost (Upkeep's biggest term always, when Upkeep is under target). [] = on target (or no review). [{ id, line, loss, at }].
// shortfall() is this list's head (or the on-target line): the solo line and old clients' `need`.
export const JOB_MIN_LOSS = 0.01;
export function shortfalls({ value, quota, kpi = null, fixtures = {}, fries = value?.fries ?? null, pond = value?.pond ?? null, venue = 0, endless = false, cups = null, margin = 0 }) {
  if (endless || !value) return [];
  if (venue === 5 && !quota) return gaugeOk(kpi) ? [] : [{ id: 'gauge', line: RALLY_LINES.gauge[5], loss: 1, at: gaugeAt(5) }];
  if (!quota) return [];
  const out = [];
  if (!gaugeOk(kpi) && RALLY_LINES.gauge[venue]) out.push({ id: 'gauge', line: RALLY_LINES.gauge[venue], loss: 1, at: gaugeAt(venue, cups) });
  if (!out.length && upkeepOk(value, quota, margin)) return out;   // on target. A short gauge still deals the Upkeep terms to the rest
  const ids = Object.keys(fixtures), n = ids.length;
  const share = id => (n ? 0.5 * (fixtures[id] ?? 0) / n : 0);
  const terms = [{ id: 'mats', loss: n ? ids.filter(id => id.startsWith('mat')).reduce((a, id) => a + share(id), 0) : 0.5 * (1 - (value.curb ?? 1)) }];
  for (const id of ids) if (!id.startsWith('mat') && RALLY_LINES[id]) terms.push({ id, loss: share(id) });
  if (fries != null) terms.push({ id: 'fries', loss: 0.5 * (1 - fries) });
  if (pond != null) terms.push({ id: 'pond', loss: 0.5 * (1 - pond) });
  terms.sort((a, b) => b.loss - a.loss);   // stable: ties keep the mats first, as shortfall() does
  const under = !upkeepOk(value, quota, margin);
  const real = terms.filter((t, i) => (under && i === 0) || t.loss >= JOB_MIN_LOSS);   // under target names at least its biggest term
  for (const t of real) out.push({ ...t, line: RALLY_LINES[t.id], at: JOB_AT[t.id] });
  return out;
}

// Deal the ranked jobs round the crew: the biggest job gets ceil(N/2) Rats (the nearest), then each next job the
// nearest undealt Rat, round the other jobs again until every Rat has a line. No jobs: everyone gets `none` (the on-target
// line). rats: [{ id, x, z }]. Returns { [ratId]: line }.
// Playthrough 3 #4: prev ({ [ratId]: line }, the last deal) keeps each Rat's line while that job is still short, and
// deals only the new jobs to the rest (with no new job, the rest go round the open ones), so the 30 s re-check
// doesn't swap the sign and the stand between Rats by where they stand.
export function dealJobs(jobs, rats, none = RALLY_LINES.onTarget, prev = null) {
  const out = {};
  if (!rats.length) return out;
  if (!jobs.length) { for (const r of rats) out[r.id] = none; return out; }
  let left = [...rats];
  if (prev) {
    const open = new Set(jobs.map(j => j.line));
    for (const r of rats) if (open.has(prev[r.id])) out[r.id] = prev[r.id];
    left = rats.filter(r => !(r.id in out));
    if (!left.length) return reassign(jobs, rats, out);   // round 8: a brand-new job never goes to nobody
    const held = new Set(Object.values(out)), fresh = jobs.filter(j => !held.has(j.line));
    if (fresh.length) jobs = fresh;
  }
  const take = job => {
    let bi = 0, bd = Infinity;
    left.forEach((r, i) => { const d = Math.hypot(r.x - job.at.x, r.z - job.at.z); if (d < bd) { bd = d; bi = i; } });
    out[left[bi].id] = job.line; left.splice(bi, 1);
  };
  for (let k = Math.ceil(left.length / 2); k > 0 && left.length; k--) take(jobs[0]);
  const rest = jobs.length > 1 ? jobs.slice(1) : jobs;   // the biggest job keeps its half; the rest go round
  for (let j = 0; left.length; j = (j + 1) % rest.length) take(rest[j]);
  return out;
}

// Round 8: every Rat kept its line and a brand-new job opened (the gauge going short at the re-check, say). The new
// job still gets a Rat: the nearest one off a doubled-up job (the lowest-ranked such job, the one closest to done),
// else the holder of the lowest-ranked job, when the new job outranks it. A new job below every held one stays
// undealt, as in a fresh deal with more jobs than Rats. jobs: ranked (index = priority); out: the kept lines.
function reassign(jobs, rats, out) {
  const rank = new Map(jobs.map((j, i) => [j.line, i]));
  for (const job of jobs) {
    const count = {};
    for (const l of Object.values(out)) count[l] = (count[l] ?? 0) + 1;
    if (count[job.line]) continue;
    const lines = Object.keys(count).sort((a, b) => rank.get(b) - rank.get(a));   // lowest-ranked (closest to done) first
    const donor = lines.find(l => count[l] > 1) ?? (rank.get(lines[0]) > rank.get(job.line) ? lines[0] : null);
    if (donor == null) continue;
    let best = null, bd = Infinity;
    for (const r of rats) {
      if (out[r.id] !== donor) continue;
      const d = Math.hypot(r.x - job.at.x, r.z - job.at.z);
      if (d < bd) { bd = d; best = r; }
    }
    out[best.id] = job.line;
  }
  return out;
}
