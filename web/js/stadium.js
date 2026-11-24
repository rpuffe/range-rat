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
export const stepSentiment = (s, dt) => clamp01(s - CROWD.DECAY * dt);
export const bump = (s, d) => clamp01(s + d);

// What a paid ping is worth: more on the Track, plus the jackpot bonus.
export const pingDelta = (onTr, prize) => (onTr ? CROWD.PING_TRACK : CROWD.PING) + (prize === 'jackpot' ? CROWD.JACKPOT : 0);

// View helpers: the crowd bob (metres), the ambience level, and the mood.
export const bobFor = s => 0.1 + 0.5 * s;
export const ambFor = s => 0.2 + 0.8 * s;
export const waving = s => s > 0.9;
export const bored = s => s < 0.25;
