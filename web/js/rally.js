// The Closing Bell (council round 6, #2 and #3): what the crew is short of at Last Call, and why a review missed on
// the venue gauge. Pure rules: no THREE, no DOM. The server picks the line; the client only shows it.
import { QUOTA_KPI, FRIES, POND, FIXTURE_BY_ID, LAST_CALL } from './sim.js';
import { MAP } from './map.js';
import { upkeepMet } from './bvtext.js';   // owner playtest 3 §1.4

// Every line is one centre toast: 8 words or fewer.
export const RALLY_LINES = {
  gauge: {                                   // by venue: the fourth gauge is under QUOTA_KPI
    2: 'Bowls judged at 2:30! Shoot them clear!',   // round 11: the bowls are read at Last Call (T-2:30): a buzzer-beater
    3: 'The crowd is bored. Lap the Track!',
    4: "Zoning's low! Bag hazards, fetch strays!",   // council round 11 #2: hazards are usually the bigger term now
    5: 'Debris overhead. Everyone up the Lift!',   // round 8 #4: the crank is gone, so every Rat rides
  },
  mats: 'Hose the mats before the bell!',
  sign: 'The sign is filthy. Hose it!',
  stand: 'The return is filthy. Hose it!',
  fries: 'Fries are low. Cook!',
  pond: 'The pond is murky. Dive!',
  onTarget: 'On target. Hold it till the bell.',
  keepLapping: 'Keep lapping!',              // playthrough 3: the Stadium re-check, live crowd fine, graded mean short
  pick: 'Grab the last balls!',              // owner playtest 3 §2: the cleanup deal, over RALLY_PICK balls out there
  friesBell: 'Fries for the bell!',          // council round 10 #2: the Club's dusk, on target, the fryer under half
  glowDive: 'Glow in the creek! Dive!',      // council round 10 #5: the Club's dusk, 5+ glow balls snagged in the creek
  hazards: 'Hazards out! Spray and bag!',     // council round 11 #2: the County's live deal (county.js HAZ_DEAL), two Rats
};

// The report's miss line when the gauge, not Upkeep, cost the stamp (by venue).
export const GAUGE_MISS = {
  2: 'Missed: the bowls were full at 2:30.',   // round 11: the bowls are read at Last Call (T-2:30)
  3: 'Missed: the crowd was bored.',
  4: 'Missed: strays in the Yards.',
  5: 'Missed: too much debris overhead.',
};

// Council round 11 #2: the County's DENIED names its bigger term. Zoning = 1 - strays / 30 - hazards / 12
// (county.js zoningWith), so a hazard costs 2.5 strays. st: the county module's state ({ haz, strays }) at the bell.
// Hazards win ties (haz / 12 >= strays / 30). Nothing out (a stubbed gauge, an old caller): GAUGE_MISS[venue].
export const ZONE_COST = Object.freeze({ HAZ: 12, STRAY: 30 });   // county.js HAZ.CAP and ZONING.STRAY_CAP (pinned by test)
export function zoningCause(st) {
  const haz = Math.max(0, st?.haz | 0), strays = Math.max(0, st?.strays | 0);
  if (!haz && !strays) return null;
  return haz / ZONE_COST.HAZ >= strays / ZONE_COST.STRAY ? { cause: 'haz', n: haz } : { cause: 'strays', n: strays };
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
export function missLine(venue, st) {
  const c = venue === 4 ? zoningCause(st) : null;
  if (!c) return GAUGE_MISS[venue];
  return c.cause === 'haz' ? `Missed: ${plural(c.n, 'hazard', 'hazards')} left out. Spray, then bag.` : `Missed: ${plural(c.n, 'stray', 'strays')} in the Yards.`;
}
// The quota's miss fields: why (the stamp's line), and at the County out ('9 hazards out', the report row's tail)
// and cause ('haz' | 'strays': the hazard tip re-arms on 'haz').
export function gaugeMiss(venue, st) {
  const c = venue === 4 ? zoningCause(st) : null;
  return { why: missLine(venue, st), ...(c ? { cause: c.cause, out: c.cause === 'haz' ? plural(c.n, 'hazard', 'hazards') + ' out' : plural(c.n, 'stray', 'strays') + ' out' } : {}) };
}

// Kept for reference; shortfall() now compares every term by its real Upkeep cost (playtest round 2 #1).
export const FRIES_LOW = 0.5;
export const POND_MURKY = 0.6;

// Is the gauge holding? No gauge (the Muni, the Club) always is.
export const gaugeOk = kpi => kpi == null || kpi + 1e-9 >= QUOTA_KPI;
// The same test the review uses: Upkeep (BV / Rate) against 1 + q.
// margin: Upkeep the rally asks for above that (UPKEEP_MARGIN); the review itself uses 0.
// Owner playtest 3 §1.4: judged on Upkeep itself (BV / Rate lost a cent of rounding once Rate carried the clean kit).
export const upkeepOk = (value, quota, margin = 0) => !quota || upkeepMet(value, quota.q, margin);
// Playthrough 3 #3: Last Call scuffs ×1.5, so "On target" at the bell was DENIED 25 of 31 times (4P). The rally
// forecasts Upkeep at the bell: it says "On target" only with this much Upkeep to spare. The Last Call rally and the
// 30 s re-check both use it, so they agree.
// Round 11: the taper replaced the x3 rush, so Last Call (T-2:30) leaves ~30 s of thin scuffing: 0.06 -> 0.02.
export const UPKEEP_MARGIN = 0.02;

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
// The re-check is the cleanup deal at the cleanup's start (round 11: T-2:00); over this many balls out there it deals 'pick'.
export const RALLY_PICK = 30;

// Round 7 #7: when the rally fires, in seconds before the bell, by venue (default: Last Call's, T-2:30 since round 11).
// Round 11: Tiered and the Stadium rally at T-3:00, as the crowd starts to thin: Tiered's bowls are read at Last Call
// (T-2:30), so its rally gives the shooters 30 s; the Stadium's Three-Minute Warning reads the live crowd. An entry at or
// under Last Call's (scaled) never fires on its own (crew.warnDue).
export const RALLY_AT = Object.freeze({ 2: 180, 3: 180 });
export const rallyAt = venue => RALLY_AT[venue] ?? LAST_CALL.SECS;

// Council round 14 #2b (the solo Tiered fix): the bowls read at Last Call scales by crew size. A small crew passes when
// it has shot the bowls down to this share of their load at the rally's start (T-3:00): half at 1P, a quarter at 2P.
// 3P+ keep the plain read (the gauge at or over QUOTA_KPI). It only ever adds a pass: the plain read still counts.
export const BOWLS_EASE = Object.freeze({ 1: 0.5, 2: 0.25 });
export const bowlsEase = n => BOWLS_EASE[Math.max(1, n | 0)] ?? null;
// load0: the bowls' load at the rally's start; load: at Last Call (both in cup weights, tiered.mjs st.cups summed).
export function bowlsPass({ n = 4, load0 = 0, load = 0 } = {}) {
  const k = bowlsEase(n);
  return k != null && load0 > 0 && load <= load0 * k + 1e-9;
}

// ---- Round 7 #4: dealt jobs. The ranked shortfalls, dealt round the crew by distance: no roles, only nudges. ----------
// Where each job is. The gauge's place is per venue: the worst bowl (Tiered), the Track (Stadium), Yard 2 (County),
// the Lift (Orbital).
export const JOB_AT = Object.freeze({
  mats: { x: 0, z: 3.5 }, pick: { x: 0, z: -40 }, sign: { x: FIXTURE_BY_ID.sign.x, z: FIXTURE_BY_ID.sign.z }, stand: { x: FIXTURE_BY_ID.stand.x, z: FIXTURE_BY_ID.stand.z },
  fries: { x: FRIES.SHED.x, z: FRIES.SHED.z }, friesBell: { x: FRIES.SHED.x, z: FRIES.SHED.z }, glowDive: { x: 18, z: -99 }, pond: { x: POND.DOCK.x, z: POND.DOCK.z },
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
// left: the balls out there (owner playtest 3 §2's cleanup deal): over RALLY_PICK adds 'pick', last.
export function shortfalls({ value, quota, kpi = null, fixtures = {}, fries = value?.fries ?? null, pond = value?.pond ?? null, venue = 0, endless = false, cups = null, margin = 0, left = 0 }) {
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
  if (out.length && left > RALLY_PICK) out.push({ id: 'pick', line: RALLY_LINES.pick, loss: 0, at: JOB_AT.pick });
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

// ---- Council round 10 #2/#5: the Club's dusk always deals jobs. ----------------------------------------------
// On target at the Club (from 1:30 customers swing x3 and eat x3), nobody is told to hold it: the rally deals
// the fryer under half, 5+ glow balls snagged in the creek, 30+ balls left, then any short fixture's hose line.
// After 1:00 nobody eats, so a fryer filled in the cleanup minute counts at the bell. [] = nothing to do.
export const CLUB_GLOW_DIVE = 5;
export function clubDuskJobs({ value, fixtures = {}, fries = value?.fries ?? null, left = 0, glowSnags = 0, glowAt = null }) {
  const out = [];
  if (fries != null && fries < FRIES_LOW) out.push({ id: 'friesBell', line: RALLY_LINES.friesBell, loss: 0.5 * (1 - fries), at: JOB_AT.friesBell });
  if (glowSnags >= CLUB_GLOW_DIVE) out.push({ id: 'glowDive', line: RALLY_LINES.glowDive, loss: 0, at: glowAt ?? JOB_AT.glowDive });
  if (left >= RALLY_PICK) out.push({ id: 'pick', line: RALLY_LINES.pick, loss: 0, at: JOB_AT.pick });
  const ids = Object.keys(fixtures), n = ids.length;
  if (n) {
    const share = id => 0.5 * (fixtures[id] ?? 0) / n;
    const hose = [{ id: 'mats', loss: ids.filter(id => id.startsWith('mat')).reduce((a, id) => a + share(id), 0) }];
    for (const id of ids) if (!id.startsWith('mat') && RALLY_LINES[id]) hose.push({ id, loss: share(id) });
    for (const t of hose.sort((a, b) => b.loss - a.loss)) if (t.loss >= JOB_MIN_LOSS) out.push({ ...t, line: RALLY_LINES[t.id], at: JOB_AT[t.id] });
  }
  return out;
}
