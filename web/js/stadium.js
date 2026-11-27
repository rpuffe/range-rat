// The Stadium's pure rules (council round 4, §3.2): the Ping Track's lap gates and Crowd Sentiment.
// No THREE, no DOM, no sim.js import: the server module, the view and the tests share it.
import { MAP, onTrack } from './map.js';
import { hash32 } from './today.js';   // council round 12 #2: the Stretch's sections and the request order (no RNG draw)

export const CROWD = {
  START: 0.5,            // sentiment each morning
  DECAY: 0.0012,         // per second (empty in ~400 s if ignored; playtest: 0.0025 ate every lap)
  PING: 0.08, PING_TRACK: 0.16,   // a paid ping; while that cart is on the Track
  LAP: 0.1, TARGET: 0.06, JACKPOT: 0.10, KNOCK: 0.02,
  KNOCK_CAP: 10,         // knockdowns that count per shift
  LAP_SECS: 25,          // all four gates, in order, within this
  GATE_PAD: 1.5,         // how far off the painted edge still counts as being on the Track
  WINDOW: 120,           // round 7 #7: the graded gauge is the mean of the last 120 s of live sentiment, 1 sample a second
};
const clamp01 = v => Math.max(0, Math.min(1, v));

// The quadrant gate (0 E, 1 S, 2 W, 3 N: by angle on the ellipse) for a spot ON the Track, else -1.
export function gateAt(x, z) {
  if (!onTrack(x, z, CROWD.GATE_PAD)) return -1;
  const T = MAP.TRACK, th = Math.atan2((z - T.z) / T.b, (x - T.x) / T.a);   // -pi..pi, 0 = east
  return ((Math.round(th / (Math.PI / 2)) % 4) + 4) % 4;
}

export const newLap = () => ({ last: -1, dir: 0, n: 0, t0: 0 });

// Feed one gate sighting (g, or -1 off the Track) at time t (seconds). Mutates lap. Returns true on a completed lap.
// Four gates in order (either direction, fixed by the second one) within LAP_SECS is a lap; the last gate is
// then the start of the next. Five sightings = four quarter-turns = the whole oval (playtest 2: four sightings was 3/4).
export function stepLap(lap, g, t) {
  if (g < 0 || g === lap.last) return false;
  if (lap.n > 0 && t - lap.t0 > CROWD.LAP_SECS) lap.n = 0;          // too slow: start over from here
  const restart = () => { lap.last = g; lap.dir = 0; lap.n = 1; lap.t0 = t; return false; };
  if (lap.n === 0) return restart();
  const d = ((g - lap.last) % 4 + 4) % 4;                            // 1 forward, 3 backward, 2 across
  if (lap.n === 1) { if (d === 2) return restart(); lap.dir = d === 1 ? 1 : -1; }
  else if (d === 2) return restart();                                // jumped across the oval: start over
  else if (d !== (lap.dir === 1 ? 1 : 3)) return false;              // a wobble back over the line is ignored
  lap.last = g; lap.n++;
  if (lap.n >= 5) { lap.n = 1; lap.t0 = t; lap.dir = 0; return true; }
  return false;
}

// Round 7 #7, the crowd remembers: a ring of up to CROWD.WINDOW once-a-second samples. pushSample mutates and returns
// the buffer ({ a: [], i: 0 }); windowMean is the mean so far (null before the first sample).
export const newWindow = () => ({ a: [], i: 0 });
export function pushSample(buf, s) {
  if (buf.a.length < CROWD.WINDOW) buf.a.push(s);
  else { buf.a[buf.i] = s; buf.i = (buf.i + 1) % CROWD.WINDOW; }
  return buf;
}
export const windowMean = buf => (buf?.a?.length ? buf.a.reduce((x, y) => x + y, 0) / buf.a.length : null);

// Decay by dt, clamped 0..1.
export const stepSentiment = (s, dt, rate = CROWD.DECAY) => clamp01(s - rate * dt);   // round 11: rate = crowdDecay(n)
export const bump = (s, d) => clamp01(s + d);

// What a paid ping is worth: more on the Track, plus the jackpot bonus.
export const pingDelta = (onTr, prize) => (onTr ? CROWD.PING_TRACK : CROWD.PING) + (prize === 'jackpot' ? CROWD.JACKPOT : 0);

// View helpers: the crowd bob (metres), the ambience level, and the mood.
export const bobFor = s => 0.1 + 0.5 * s;
export const ambFor = s => 0.2 + 0.8 * s;
export const waving = s => s > 0.9;
export const bored = s => s < 0.25;

// ---- round 11 (expert #6, #9): the crowd bites, and the souvenir balls -------------------------------------------
// The live mood drains faster with more Rats (gentle solo, real at 4P): from full, the live mood crosses the line in
// ~200 s solo and ~110 s at 4P (the graded 2-minute mean the Board shows lags it by up to a minute). One Rat lapping
// the Track (+0.1 a lap, ~11 s a lap) still out-runs the 4P drain on their own: the gauge is one Rat's job.
// CROWD.DECAY above stays the old flat rate (stepSentiment's default) for old readers.
export const CROWD_LINE = 0.5;   // sim.js QUOTA_KPI (pinned equal by test/late.test.mjs): stadium.js must not import sim.js
export const crowdDecay = n => 0.0025 + 0.00067 * (Math.max(1, Math.min(4, n | 0 || 1)) - 1);

// Below the line the crowd BOOS: every EVERY s of working shift one seated customer sulks and walks out, and their
// bay stays empty for EMPTY s. Not in the cleanup (they're all leaving anyway).
export const BOO = { EVERY: 20, EMPTY: 30, GRACE: 60 };   // GRACE: no boos in the shift's first minute (the crowd opens at 0.5)

// Souvenir balls: a customer ball is gold-ringed pink with CHANCE (Stadium only). Machines won't take them (b.hands):
// a Rat picks one up (it rides in your hands, up to HANDS, outside the pocket) and walks it to the crowd rail (the
// side nets in front of either stand). Each one delivered: +CROWD to the live mood and pays W ball-weights (fans pay
// for them; council round 11 #5: W 12 -> 25 and CHANCE 0.06 -> 0.10, measured: the council's W 20 gave 13-16% at 4P). Walk past a mate with empty hands and your souvenirs pass to them (HANDOFF_R): a relayed bundle feeds the
// crowd ×RELAY and pays ×RELAY. Tuned so the job is 18-20% of a 4P Stadium shift's income with the requests (design/round13-late.md).
export const SOUV = { CHANCE: 0.10, HANDS: 3, CROWD: 0.07, RELAY: 2, W: 25, HANDOFF_R: 1.8, RAIL_X: 64, RAIL_Z0: -118, RAIL_Z1: -22, RAIL_R: 4 };
export const atRail = (x, z) => z >= SOUV.RAIL_Z0 - SOUV.RAIL_R && z <= SOUV.RAIL_Z1 + SOUV.RAIL_R && Math.abs(x) >= SOUV.RAIL_X - SOUV.RAIL_R;
// The rail point nearest a spot (the tip's arrow, the bot).
export const railPoint = (x, z) => ({ x: (x < 0 ? -1 : 1) * (SOUV.RAIL_X - 1), z: Math.max(SOUV.RAIL_Z0, Math.min(SOUV.RAIL_Z1, z)) });
// What delivering n souvenirs does to the live mood.
export const souvCrowd = (n, relayed) => n * SOUV.CROWD * (relayed ? SOUV.RELAY : 1);

// A seated customer walks out on a boo (the refusal's shape: sulk, leave, the bay stays empty). Mutates the mat like
// customers.js fellOff. Returns the events (none if the mat had nobody playing).
export function booOut(mat, now, empty = BOO.EMPTY) {
  if (!mat || mat.st !== 'playing' || mat.balls <= 0) return [];
  mat.st = 'sulk'; mat.t0 = now; mat.balls = 0; mat.fin = 0;
  mat.noBefore = Math.max(mat.noBefore ?? 0, now + empty);
  return [{ t: 'refuse', mat: mat.i, cust: mat.cust, why: 'boo' }];
}

// ---- council round 11 #5: souvenir requests, "WE WANT A BALL!" -------------------------------------------------------
// One rail section at a time lights up (a gold ring, its fans stand and wave, a world banner) for SECS s, from FROM s into
// the shift until TO s before the bell, one every EVERY[n] s (n = Rats online). A souvenir delivered there while it's lit:
// +CROWD (plus SOUV.CROWD for each extra ball in the bundle), and it pays ×PAY (the relay's ×2 doesn't stack: ×3 is the
// best). It goes out unanswered: -MISS (solo -MISS_SOLO), a boo, a feed line. No centre text: the Board says it.
// Six sections of LEN m: A B C down the left rail (x < 0), D E F down the right, in ORDER (no RNG: the seam's draws
// stay as they were).
// Council round 12 #2: EVERY [90, 75, 60, 45] -> [65, 55, 45, 38], so the Stretch's 65 s pause still leaves a call a minute
// solo and 1.5 at 4P (design/round14-venues.md).
export const REQ = { FROM: 30, TO: 60, EVERY: [65, 55, 45, 38], SECS: 30, CROWD: 0.15, PAY: 3, MISS: 0.06, MISS_SOLO: 0.03, LEN: 16, ORDER: [2, 4, 0, 5, 1, 3] };
const SEC_Z = [-30, -70, -110];   // each side's three section centres along the rail (SOUV.RAIL_Z0..RAIL_Z1)
export const SECTIONS = Object.freeze([0, 1, 2, 3, 4, 5].map(i => Object.freeze({
  i, name: 'ABCDEF'[i], side: i < 3 ? -1 : 1, z0: SEC_Z[i % 3] - REQ.LEN / 2, z1: SEC_Z[i % 3] + REQ.LEN / 2, zc: SEC_Z[i % 3] })));
export const reqEvery = n => REQ.EVERY[Math.max(1, Math.min(4, n | 0 || 1)) - 1];
// Is a new request due? t: seconds of working shift; left: seconds to the bell; last: the last one's start (null: none
// yet); live: one is lit now.
export const reqDue = ({ t, left, last = null, n = 4, live = false }) =>
  !live && t >= REQ.FROM && left > REQ.TO && (last == null || t - last >= reqEvery(n));
export const reqSection = k => SECTIONS[REQ.ORDER[((k | 0) % REQ.ORDER.length + REQ.ORDER.length) % REQ.ORDER.length]];
// Standing at the rail inside section sec (with the rail's own reach on either end).
export const inSection = (sec, x, z) => !!sec && atRail(x, z) && Math.sign(x) === sec.side && z >= sec.z0 - SOUV.RAIL_R && z <= sec.z1 + SOUV.RAIL_R;
// What a delivery pays (ball-weights) and does to the crowd: lit (req) beats the relay, never both.
export const souvPay = (n, relayed, req = false) => n * SOUV.W * (req ? REQ.PAY : relayed ? SOUV.RELAY : 1);
export const reqCrowd = n => REQ.CROWD + Math.max(0, (n | 0) - 1) * SOUV.CROWD;
export const reqMiss = n => ((n | 0) <= 1 ? REQ.MISS_SOLO : REQ.MISS);
// The Board's crowd-gauge line while one is lit (builder 4's board.js): "SECTION C WANTS A BALL · 0:18".
export const reqLine = req => {
  if (!req) return null;
  const s = Math.max(0, Math.ceil(req.left ?? 0));
  return `SECTION ${req.sec ?? SECTIONS[req.i]?.name ?? '?'} WANTS A BALL · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
// The carry prompt (C #11: ≤ 8 words): "Souvenirs ×2 → crowd rail", or the lit section.
export const carryLine = (n, req = null) => `Souvenir${n === 1 ? '' : 's'} ×${n} → ${req ? `Section ${req.sec}, lit!` : 'crowd rail'}`;

// ---- council round 12 #2: the crowd needs you at every size; the Seventh-Inning Stretch ------------------------------
// 2a. The autopilot's laps (and pings on an autopilot cart) lift the live crowd only up to AUTO_CEIL; every missed request
// lowers that ceiling by CEIL_MISS for the rest of the shift ("The crowd's bored of the robot."). Rats lift it to 1.0.
export const AUTO_CEIL = 0.60, CEIL_MISS = 0.04;
export const autoCeil = (missed = 0) => Math.max(0, AUTO_CEIL - CEIL_MISS * Math.max(0, missed | 0));
// A robot bump: never past the ceiling, and never pulls a crowd that's already over it back down.
export const bumpAuto = (s, d, ceil) => (s >= ceil ? s : Math.min(ceil, clamp01(s + d)));
export const ROBOT_LINE = "The crowd's bored of the robot.";

// 2c. The Seventh-Inning Stretch: once a shift at T-3:30 (AT s left), N sections light together for SECS s; each pays
// ×PAY and +CROWD; each one missed costs -MISS (no boo: it's a party). Normal requests don't start from REQ.SECS before
// it until PAUSE s after it (nothing lit overlaps it). Sections: hash32(day, venueDay, 's'). Lead's call (round 14): they
// sit on the SAME side, adjacent, and a delivery answers one section per souvenir carried, so one runner with a bundle
// walks the rail and lights them all up (stadium.mjs stretchDeliver).
// A live boss fight (MOW-E 2.0's encore) or a lit request holds it back until it's over, but never past LATEST s left.
export const STRETCH = { AT: 210, SECS: 25, PAY: 5, CROWD: 0.15, MISS: 0.03, PAUSE: 5, LATEST: 120, N: [2, 2, 3, 3] };
export const stretchN = n => STRETCH.N[Math.max(1, Math.min(4, n | 0 || 1)) - 1];
export const stretchDue = ({ left, done = false, busy = false }) => !done && !busy && left <= STRETCH.AT && left > STRETCH.LATEST;
export const reqPaused = left => left <= STRETCH.AT + REQ.SECS && left > STRETCH.AT - STRETCH.SECS - STRETCH.PAUSE;
// The Stretch's sections (indices into SECTIONS, sorted): k adjacent sections on one side, from a hash (no RNG draw).
// Council round 13 #4 (builder 2): extra = the fireworks landmark's +1 (3 at 1-2P, 4 at 3P+). Four is the whole of one
// side plus the other side's nearest section (A or D, by the mats): a bundle runner walks the three, a mate takes the one.
export function stretchSections(day, vday, n = 4, extra = 0) {
  const k = Math.min(4, stretchN(n) + Math.max(0, extra | 0)), h = hash32(day | 0, vday | 0, 's');
  const side = h & 1 ? 3 : 0, start = k >= 3 ? 0 : (h >>> 3) % (4 - k);   // 3 of 3, or a pair: AB / BC (DE / EF)
  const out = Array.from({ length: Math.min(3, k) }, (_, j) => side + start + j);
  if (k >= 4) out.push(3 - side);
  return out.sort((a, b) => a - b);
}
export const stretchPay = n => n * SOUV.W * STRETCH.PAY;
export const stretchCrowd = n => STRETCH.CROWD + Math.max(0, (n | 0) - 1) * SOUV.CROWD;
const clockOf = t => { const s = Math.max(0, Math.ceil(t ?? 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
// The jumbotron and the Board (bvtext.js kpiNoteOf): "SEVENTH-INNING STRETCH · A C F · 0:25".
export const stretchLine = sx => (sx ? `SEVENTH-INNING STRETCH · ${[...(sx.secs ?? '')].join(' ')} · ${clockOf(sx.t ?? sx.left)}` : null);
export const stretchAlert = k => `Seventh-inning stretch! ${k <= 2 ? 'Two' : k === 3 ? 'Three' : 'Four'} sections want balls!`;   // 7 words, the one centre ALERT

// 2d. The answered request, on the jumbotron for LEGEND_SECS: "PIP · LEGEND · SECTION C".
export const LEGEND_SECS = 3;
export const legendLine = (name, sec) => `${String(name ?? 'A RAT').toUpperCase()} · LEGEND · SECTION ${sec}`;

// 2e. Requests in an order you can't learn: REQ.ORDER rotated per shift by hash32(day, venueDay, 'r') (no RNG draw).
export const reqRot = (day, vday) => hash32(day | 0, vday | 0, 'r') % REQ.ORDER.length;
export const reqSectionAt = (k, rot = 0) => reqSection((k | 0) + (rot | 0));
