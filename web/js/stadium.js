// The Stadium's pure rules (council round 4, §3.2): the Ping Track's lap gates and Crowd Sentiment.
// No THREE, no DOM, no sim.js import: the server module, the view and the tests share it.
import { MAP, onTrack } from './map.js';

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
// for them). Walk past a mate with empty hands and your souvenirs pass to them (HANDOFF_R): a relayed bundle feeds the
// crowd ×RELAY and pays ×RELAY. Tuned so the job is ~10% of a 4P Stadium shift's income (design/round11-late.md).
export const SOUV = { CHANCE: 0.06, HANDS: 3, CROWD: 0.07, RELAY: 2, W: 12, HANDOFF_R: 1.8, RAIL_X: 64, RAIL_Z0: -118, RAIL_Z1: -22, RAIL_R: 4 };
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
