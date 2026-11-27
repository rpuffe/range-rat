// Range Rat sound effects: everything is synthesised with Web Audio (no audio
// files, since the CSP is same-origin only and we'd rather not ship any).
// Browsers keep audio suspended until a user gesture, so nothing sounds until
// the game calls unlock(); before that, and wherever Web Audio is missing,
// every export is a silent no-op that never throws.

const MASTER_LEVEL = 0.7;

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
let out = null;                 // master volume -> destination; `master` below is the SFX bus feeding it
let vMaster = 1, vSfx = 1;      // settings volumes (web/js/settings.js)
let duckG = null;               // SFX + ambience meet here: PA ducking sits on it. master -> sfxLP -> duckG -> out
let sfxLP = null;               // low-pass on the SFX bus only (underwater / EVA)
let hornBus = null;             // +3 dB and a high shelf, so Gary's and MOW-E's horns cut through
let ducked = false, muffled = false;

// ---- pure helpers (tested in test/audiomix.test.mjs) ----
export const DUCK_DB = -9;          // the PA ducks SFX and ambience by this much while it speaks
export const HORN_DB = 3;           // horns sit this far above the rest of the SFX bus
export const MAX_DRONE_VOICES = 3;  // the drone buzz never has more voices than this
export const MUFFLE_HZ = 450;       // SFX low-pass cutoff underwater / on EVA
export const dbToGain = (db) => Math.pow(10, (Number(db) || 0) / 20);
export const droneVoices = (n) => Math.max(0, Math.min(MAX_DRONE_VOICES, Math.floor(Number(n) || 0)));

// Create or resume the context. Call from click / keydown / gamepad handlers.
export function unlock() {
  try {
    if (!ctx) {
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = muted ? 0 : MASTER_LEVEL * vMaster;
      out.connect(ctx.destination);
      duckG = ctx.createGain();
      duckG.gain.value = ducked ? dbToGain(DUCK_DB) : 1;
      duckG.connect(out);
      sfxLP = ctx.createBiquadFilter();
      sfxLP.type = 'lowpass'; sfxLP.Q.value = 0.7;
      sfxLP.frequency.value = muffled ? MUFFLE_HZ : 20000;
      sfxLP.connect(duckG);
      master = ctx.createGain();
      master.gain.value = vSfx;
      master.connect(sfxLP);
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch {
    ctx = null;
    master = null;
    out = null;
    duckG = sfxLP = hornBus = null;
  }
}

// The PA is speaking: pull SFX and ambience down 9 dB (smooth in, slower out).
export function duck(on) {
  ducked = !!on;
  try { if (duckG) duckG.gain.setTargetAtTime(ducked ? dbToGain(DUCK_DB) : 1, ctx.currentTime, ducked ? 0.05 : 0.4); } catch { /* ignore */ }
}

// Underwater (scuba) or on EVA (orbit): low-pass the SFX bus. Ambience has its own underwater filter.
export function setUnderwater(on) {
  const m = !!on;
  if (m === muffled) return;
  muffled = m;
  try { if (sfxLP) sfxLP.frequency.setTargetAtTime(muffled ? MUFFLE_HZ : 20000, ctx.currentTime, 0.15); } catch { /* ignore */ }
}

export function setMuted(m) {
  muted = !!m;
  try {
    if (out) out.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL * vMaster, ctx.currentTime, 0.01);
  } catch { /* ignore */ }
}

// Settings volumes, 0..1: master scales everything (ambience and the PA chime too), sfx only the effects.
export function setVolumes({ master: m = vMaster, sfx = vSfx } = {}) {
  vMaster = Math.min(1, Math.max(0, +m || 0)); vSfx = Math.min(1, Math.max(0, +sfx || 0));
  try {
    if (out) out.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL * vMaster, ctx.currentTime, 0.02);
    if (master) master.gain.setTargetAtTime(vSfx, ctx.currentTime, 0.02);
  } catch { /* ignore */ }
}

export function isMuted() {
  return muted;
}

// The audio context only if it is actually running. While suspended we skip
// scheduling so a pile of stale sounds doesn't burst out on resume.
function live() {
  return ctx && master && !muted && ctx.state === 'running' ? ctx : null;
}

// One shared second of white noise; each burst just plays a slice of it.
function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

// Sine/other tone with a fast attack and exponential decay. Disconnects itself.
function tone(c, { freq, endFreq, type = 'sine', t = 0, dur = 0.2, vol = 0.2, attack = 0.003, pan, dest }) {
  const t0 = c.currentTime + t;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const p = pan !== undefined && typeof c.createStereoPanner === 'function' ? c.createStereoPanner() : null;
  if (p) p.pan.value = Math.max(-1, Math.min(1, Number(pan) || 0));
  if (p) o.connect(g).connect(p).connect(dest || master); else o.connect(g).connect(dest || master);
  o.onended = () => { o.disconnect(); g.disconnect(); if (p) p.disconnect(); };
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

// Filtered noise burst. `fEnd` sweeps the filter frequency over the burst.
function burst(c, { t = 0, dur = 0.05, vol = 0.2, type = 'bandpass', f = 2000, fEnd, q = 1, attack = 0.002, dest }) {
  const t0 = c.currentTime + t;
  const s = c.createBufferSource();
  const flt = c.createBiquadFilter();
  const g = c.createGain();
  s.buffer = noise(c);
  flt.type = type;
  flt.Q.value = q;
  flt.frequency.setValueAtTime(f, t0);
  if (fEnd) flt.frequency.exponentialRampToValueAtTime(fEnd, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(flt).connect(g).connect(dest || master);
  s.onended = () => { s.disconnect(); flt.disconnect(); g.disconnect(); };
  s.start(t0, Math.random() * 0.5);
  s.stop(t0 + dur + 0.02);
}

// Ball on a steel wire cage: inharmonic bright partials, a hit click and a
// little scattered rattle as the wires settle.
export function ping() {
  const c = live();
  if (!c) return;
  const j = 1 + (Math.random() - 0.5) * 0.03; // slight variation per hit
  tone(c, { freq: 1850 * j, dur: 0.65, vol: 0.2 });
  tone(c, { freq: 2470 * j, dur: 0.5, vol: 0.14 });
  tone(c, { freq: 3190 * j, dur: 0.32, vol: 0.1 });
  tone(c, { freq: 925 * j, dur: 0.25, vol: 0.06 });
  burst(c, { dur: 0.015, vol: 0.25, type: 'highpass', f: 4000 });
  for (let i = 0; i < 3; i++) {
    burst(c, { t: 0.03 + i * 0.035 + Math.random() * 0.02, dur: 0.03, vol: 0.05, type: 'bandpass', f: 5000 + Math.random() * 2500, q: 4 });
  }
}

// Rising arpeggio (C6 E6 G6 C7) layered over a ping for a prize.
export function jackpot() {
  const c = live();
  if (!c) return;
  [1047, 1319, 1568, 2093].forEach((f, i) => {
    tone(c, { freq: f, type: 'triangle', t: i * 0.1, dur: i === 3 ? 0.3 : 0.18, vol: 0.14 });
    tone(c, { freq: f * 2, t: i * 0.1, dur: 0.12, vol: 0.04 });
  });
}

// Comic bonk: sine dropping in pitch plus a small noise click.
export function bonk() {
  const c = live();
  if (!c) return;
  tone(c, { freq: 340, endFreq: 90, dur: 0.25, vol: 0.4, attack: 0.002 });
  burst(c, { dur: 0.02, vol: 0.2, type: 'lowpass', f: 1800 });
}

// Coin blip: two quick rising notes; a third, fuller chord for big sums.
export function cash(n = 1) {
  const c = live();
  if (!c) return;
  const big = n > 10;
  tone(c, { freq: 988, type: 'square', dur: 0.07, vol: 0.05 });
  tone(c, { freq: 1319, type: 'square', t: 0.07, dur: big ? 0.2 : 0.14, vol: 0.05 });
  tone(c, { freq: 1319, t: 0.07, dur: big ? 0.2 : 0.14, vol: 0.12 });
  if (big) {
    tone(c, { freq: 1976, t: 0.12, dur: 0.22, vol: 0.08 });
    tone(c, { freq: 2637, t: 0.12, dur: 0.22, vol: 0.05 });
  }
}

// Whoosh scaled by power (0..1), then a crisp club tick as it meets the ball.
export function swing(power = 0.5) {
  const c = live();
  if (!c) return;
  const p = Math.min(1, Math.max(0, Number(power) || 0));
  const dur = 0.12 + p * 0.16;
  burst(c, { dur, vol: 0.06 + p * 0.2, f: 500 + p * 400, fEnd: 1800 + p * 2200, q: 1.2, attack: dur * 0.6 });
  burst(c, { t: dur, dur: 0.03, vol: 0.18, type: 'highpass', f: 3000 });
  tone(c, { freq: 1500, t: dur, dur: 0.04, vol: 0.08, type: 'triangle' });
}

// Barely-there click for ball pickup; may fire 10+ times a second.
export function scoop() {
  const c = live();
  if (!c) return;
  burst(c, { dur: 0.025, vol: 0.04, f: 3000 + Math.random() * 2000, q: 3 });
}

// Round 11 (expert #4, the sweep): the pickup blip that climbs with the sweep. Quiet and short (audio fatigue): off
// below SWEEP_SOUND.FROM, a semitone a step up a pentatonic-ish ladder, capped at TOP steps, 45 ms, -30 dB-ish.
export const SWEEP_SOUND = { FROM: 5, BASE: 660, STEP: 1, TOP: 20, VOL: 0.03, DUR: 0.045 };
// Pure: the blip's frequency at sweep ×n (null: silent).
export function sweepFreq(n) {
  const S = SWEEP_SOUND, k = Math.floor(Number(n) || 0) - S.FROM;
  if (k < 0) return null;
  return S.BASE * Math.pow(2, Math.min(S.TOP, k * S.STEP) / 12);
}
export function sweepTick(n) {
  const f = sweepFreq(n), c = f && live();
  if (!c) return;
  tone(c, { freq: f, type: 'triangle', dur: SWEEP_SOUND.DUR, vol: SWEEP_SOUND.VOL });
}
// Round 11: a big pocket rattles at the bank: a scatter of ball clicks, more and louder with n (20 balls up).
export const RATTLE = { FROM: 20, MAX_CLICKS: 14, VOL0: 0.04, VOL1: 0.11 };
export function rattle(n = 0) {
  const c = live();
  if (!c || n < RATTLE.FROM) return;
  const k = Math.min(1, (n - RATTLE.FROM) / 130), clicks = Math.round(5 + k * (RATTLE.MAX_CLICKS - 5)), vol = RATTLE.VOL0 + k * (RATTLE.VOL1 - RATTLE.VOL0);
  for (let i = 0; i < clicks; i++) burst(c, { t: 0.02 + i * (0.035 + Math.random() * 0.03), dur: 0.03, vol: vol * (0.6 + Math.random() * 0.4), f: 2200 + Math.random() * 2600, q: 5 });
  tone(c, { freq: 180, endFreq: 120, t: 0.02, dur: 0.18, vol: vol * 0.8, type: 'triangle' });   // the bin's thud
}

// The cart's engine (owner playtest 3 §7.4): a little petrol motor, not a reed. Two square waves an octave
// apart (detuned ±4 cents; squares have no even harmonics) at 70 → 160 Hz, a lowpass at 400 → 900 Hz that
// never opens the top end, a gentle tanh saturation (warmth, not fuzz), a "putt" tremolo at 12 → 28 Hz,
// and tyre noise. Every parameter glides (0.25 s), so throttle stabs slur. Nodes persist across set() calls
// and only their parameters ramp, so per-frame calls stay cheap. Built lazily so it still works if the cart
// spawns before the first unlock. speed01 is speed ÷ the base top speed, clamped, so turbo never raises the pitch.
export const ENGINE = Object.freeze({ F0: 70, F1: 160, LP0: 400, LP1: 900, Q: 0.7, DRIVE: 1.5, TREM0: 12, TREM1: 28, TREM_DEPTH: 0.25,
  TYRE_HZ: 250, TYRE_GAIN: 0.012, GAIN0: 0.012, GAIN1: 0.028, DETUNE: 4, GLIDE: 0.25 });
// Pure: the engine's parameters at a speed (tested in test/audiomix.test.mjs).
export function engineParams(speed01) {
  const s = Math.min(1, Math.max(0, Number(speed01) || 0)), E = ENGINE, lerp = (x, y) => x + (y - x) * s;
  return { freq: lerp(E.F0, E.F1), lowpass: lerp(E.LP0, E.LP1), trem: lerp(E.TREM0, E.TREM1),
    gain: s < 0.02 ? 0 : E.GAIN0 + E.GAIN1 * s, tyres: E.TYRE_GAIN * s };
}
// tanh curve for the WaveShaper
export function tanhCurve(drive = ENGINE.DRIVE, n = 256) {
  const k = new Float32Array(n), norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; k[i] = Math.tanh(drive * x) / norm; }
  return k;
}
export function cartEngine() {
  let nodes = null;
  let stopped = false;

  function build() {
    const c = live();
    if (!c) return false;
    const E = ENGINE;
    const lo = c.createOscillator(), hi = c.createOscillator();
    lo.type = hi.type = 'square';
    lo.frequency.value = E.F0; hi.frequency.value = E.F0 * 2;
    lo.detune.value = -E.DETUNE; hi.detune.value = E.DETUNE;
    const hiG = c.createGain(); hiG.gain.value = 0.5;              // the upper octave sits under the fundamental
    const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = E.LP0; flt.Q.value = E.Q;
    const sat = c.createWaveShaper(); sat.curve = tanhCurve(); sat.oversample = '2x';
    const trem = c.createGain(); trem.gain.value = 1 - E.TREM_DEPTH;   // the LFO swings it ±depth around 1 - depth
    const lfo = c.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = E.TREM0;
    const lfoG = c.createGain(); lfoG.gain.value = E.TREM_DEPTH;
    const gain = c.createGain(); gain.gain.value = 0;
    lo.connect(flt); hi.connect(hiG).connect(flt);
    flt.connect(sat).connect(trem).connect(gain).connect(master);
    lfo.connect(lfoG).connect(trem.gain);
    // tyres: the shared noise through a band-pass
    const tyre = c.createBufferSource(); tyre.buffer = noise(c); tyre.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = E.TYRE_HZ; bp.Q.value = 1;
    const tyreG = c.createGain(); tyreG.gain.value = 0;
    tyre.connect(bp).connect(tyreG).connect(master);
    for (const o of [lo, hi, lfo, tyre]) o.start();
    nodes = { lo, hi, hiG, flt, sat, trem, lfo, lfoG, gain, tyre, bp, tyreG };
    return true;
  }

  return {
    set(speed01) {
      if (stopped) return;
      try {
        if (!nodes && !build()) return;
        const t = ctx.currentTime, p = engineParams(speed01), G = ENGINE.GLIDE, n = nodes;
        n.lo.frequency.setTargetAtTime(p.freq, t, G);
        n.hi.frequency.setTargetAtTime(p.freq * 2, t, G);
        n.flt.frequency.setTargetAtTime(p.lowpass, t, G);
        n.lfo.frequency.setTargetAtTime(p.trem, t, G);
        n.gain.gain.setTargetAtTime(p.gain, t, G);
        n.tyreG.gain.setTargetAtTime(p.tyres, t, G);
      } catch { /* ignore */ }
    },
    stop() {
      stopped = true;
      if (!nodes) return;
      try {
        const t = ctx.currentTime, n = nodes;
        n.gain.gain.setTargetAtTime(0, t, 0.03); n.tyreG.gain.setTargetAtTime(0, t, 0.03);
        for (const o of [n.lo, n.hi, n.lfo, n.tyre]) o.stop(t + 0.2);
        n.lo.onended = () => { for (const k of Object.values(n)) { try { k.disconnect(); } catch {} } };
      } catch { /* ignore */ }
      nodes = null;
    },
  };
}

// Pressure-washer hiss: a looping band of high noise, faded in and out.
// set(1) while spraying, set(0) when not; cheap to call every frame.
export function sprayLoop() {
  let src = null, gain = null;
  function build() {
    const c = live();
    if (!c) return false;
    src = c.createBufferSource();
    src.buffer = noise(c); src.loop = true;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2200;
    const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 5200; pk.gain.value = 6;
    gain = c.createGain(); gain.gain.value = 0;
    src.connect(hp).connect(pk).connect(gain).connect(master);
    src.start();
    return true;
  }
  return {
    set(on) {
      try {
        if (!src && !build()) return;
        gain.gain.setTargetAtTime(on ? 0.06 : 0, ctx.currentTime, on ? 0.03 : 0.08);
      } catch { /* ignore */ }
    },
  };
}

// Treasure glint: a short bright bell, stereo-panned (scuba.js pings with the treasure's side).
export function glint(pan = 0) {
  const c = live();
  if (!c) return;
  const j = 1 + (Math.random() - 0.5) * 0.02;
  tone(c, { freq: 2637 * j, dur: 0.5, vol: 0.12, pan });
  tone(c, { freq: 3951 * j, t: 0.06, dur: 0.38, vol: 0.08, pan });
  tone(c, { freq: 5274 * j, t: 0.12, dur: 0.25, vol: 0.04, pan });
}

function hornDest(c) {
  if (!hornBus) {
    const sh = c.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 2000; sh.gain.value = 6;
    const g = c.createGain(); g.gain.value = dbToGain(HORN_DB);
    sh.connect(g).connect(master);
    hornBus = sh;
  }
  return hornBus;
}

// Gary's cart horn (who = 'gary': a flat two-note parp) and MOW-E's (who = 'mower': two quick beeps).
export function horn(who = 'gary') {
  const c = live();
  if (!c) return;
  const d = hornDest(c);
  if (who === 'mower') {
    [0, 0.17].forEach((t) => {
      tone(c, { freq: 880, type: 'square', t, dur: 0.12, vol: 0.09, dest: d });
      tone(c, { freq: 1320, type: 'triangle', t, dur: 0.12, vol: 0.08, dest: d });
    });
  } else {
    tone(c, { freq: 311, type: 'sawtooth', dur: 0.28, vol: 0.12, dest: d });
    tone(c, { freq: 392, type: 'sawtooth', t: 0.3, dur: 0.4, vol: 0.12, dest: d });
    tone(c, { freq: 622, type: 'square', t: 0.3, dur: 0.4, vol: 0.04, dest: d });
  }
}

// The Closing Bell (council round 6, #3): a struck bronze bell. Inharmonic partials (hum, prime, tierce, quint,
// nominal...) with long, staggered decays, struck twice like a shop's closing bell. Synthesised like horn().
export const BELL_PARTIALS = [[0.5, 0.10, 2.6], [1, 0.16, 2.2], [1.19, 0.07, 1.6], [1.5, 0.05, 1.3], [2, 0.08, 1.1], [2.52, 0.04, 0.8], [3.01, 0.03, 0.6]];
export function bell(f0 = 587) {
  const c = live();
  if (!c) return;
  const d = hornDest(c);
  for (const t of [0, 0.55]) {
    for (const [r, vol, dur] of BELL_PARTIALS) tone(c, { freq: f0 * r, t, dur, vol: vol * (t ? 0.8 : 1), attack: 0.002, dest: d });
    burst(c, { t, dur: 0.02, vol: 0.12, type: 'highpass', f: 3500 });   // the clapper's strike
  }
}

// DENIED: the sad two-note trombone (wah... wahhh), a muted sawtooth through a low-pass that sags on the second note.
export const TROMBONE_NOTES = [[233, 233, 0, 0.42], [220, 196, 0.45, 0.95]];   // [from Hz, to Hz, start s, length s]
export function trombone() {
  const c = live();
  if (!c) return;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2;
  lp.connect(master);
  for (const [f, to, t, dur] of TROMBONE_NOTES) {
    tone(c, { freq: f, endFreq: to !== f ? to : undefined, type: 'sawtooth', t, dur, vol: 0.16, attack: 0.06, dest: lp });
    tone(c, { freq: f * 2, endFreq: to !== f ? to * 2 : undefined, type: 'triangle', t, dur, vol: 0.04, attack: 0.06, dest: lp });
  }
  setTimeout(() => lp.disconnect(), 1800);
}

// Round 11: the Stadium crowd's boo (views/stadium.js, when a booed customer walks out). A handful of detuned low
// "ooo" voices sagging in pitch through a vowel-ish low-pass, over a murmur of noise. At most one every BOO.GAP s.
export const BOO = Object.freeze({ VOICES: [[131, 0], [147, 0.04], [123, 0.09], [165, 0.13], [139, 0.06]], DUR: 1.1, SAG: 0.82, VOL: 0.05, GAP: 1.5 });
let booAt = -Infinity;
export function boo() {
  const c = live();
  if (!c || c.currentTime - booAt < BOO.GAP) return;
  booAt = c.currentTime;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650; lp.Q.value = 3;
  lp.connect(master);
  for (const [f, t] of BOO.VOICES) tone(c, { freq: f, endFreq: f * BOO.SAG, type: 'sawtooth', t, dur: BOO.DUR, vol: BOO.VOL, attack: 0.15, dest: lp });
  burst(c, { dur: BOO.DUR, vol: 0.05, type: 'bandpass', f: 500, q: 0.8, attack: 0.2 });
  setTimeout(() => lp.disconnect(), (BOO.DUR + 0.5) * 1000);
}

// Drone buzz: call every frame with how many drones are flying. Never more than MAX_DRONE_VOICES
// detuned buzz voices however many drones; fades itself out if the caller stops calling.
let buzz = null;
export function droneBuzz(count = 0) {
  const n = droneVoices(count);
  try {
    if (!n && !buzz) return;
    const c = live();
    if (!c) return;
    if (!buzz) {
      const gain = c.createGain(); gain.gain.value = 0;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      gain.connect(lp).connect(master);
      buzz = { gain, lp, voices: [], last: 0, watch: null };
    }
    const b = buzz;
    while (b.voices.length < n) {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.value = 150 + b.voices.length * 11 + Math.random() * 6;
      o.connect(b.gain); o.start();
      b.voices.push(o);
    }
    while (b.voices.length > n) { const o = b.voices.pop(); try { o.stop(); o.disconnect(); } catch { /* ignore */ } }
    b.gain.gain.setTargetAtTime(n ? 0.012 : 0, c.currentTime, 0.2);
    b.last = Date.now();
    if (n && !b.watch) b.watch = setInterval(() => { if (Date.now() - b.last > 600) droneBuzz(0); }, 300);
    if (!n) {
      clearInterval(b.watch);
      setTimeout(() => { if (buzz === b && !b.voices.length) { try { b.gain.disconnect(); b.lp.disconnect(); } catch { /* ignore */ } buzz = null; } }, 600);
    }
  } catch { /* ignore */ }
}

// Hand the live context and buses to other audio modules. `master` is where ambience plugs in (it is
// ducked along with the SFX); `pa` bypasses the duck (the PA chime itself).
export function audioHandle() { return ctx && master ? { ctx, master: duckG, pa: out, isMuted, duck } : null; }

// ---- Council round 11 #1 (builder 1): MOW-E the boss -----------------------------------------------------------------
// The engine: a sibling of cartEngine. Two detuned saws at 50 → 120 Hz on speed, a lowpass 300 → 800 Hz, a tanh drive
// of 2.5; gain 0.03 / (1 + distance / 15), so you hear it coming. A stall idles it at 45 Hz with a rattle (the tremolo
// LFO deepens); cough() is a 0.4 s noise cough and a 30 % pitch dip; unplug() glides to 20 Hz over 1.2 s, then silence.
export const MOWE_ENGINE = Object.freeze({ F0: 50, F1: 120, IDLE: 45, LP0: 300, LP1: 800, DRIVE: 2.5, GAIN: 0.03, FALLOFF: 15, DETUNE: 9, GLIDE: 0.2, QUIET: 0.5 });
// Pure: the engine at a speed (0..1) and a distance (m). quiet: the tame pet and the legacy pass (half as loud).
// out: an object to fill (the engine passes its own, so a frame allocates nothing).
export function moweEngineParams(speed01, dist = 0, stall = false, quiet = false, out = {}) {
  const s = Math.min(1, Math.max(0, Number(speed01) || 0)), E = MOWE_ENGINE;
  const near = 1 / (1 + Math.max(0, Number(dist) || 0) / E.FALLOFF);
  out.freq = stall ? E.IDLE : E.F0 + (E.F1 - E.F0) * s; out.lowpass = E.LP0 + (E.LP1 - E.LP0) * s;
  out.gain = E.GAIN * near * (quiet ? E.QUIET : 1) * (stall || s > 0 ? 1 : 0.6); out.rattle = stall ? 1 : 0;
  return out;
}
export function moweEngine() {
  let n = null, stopped = false, dipUntil = 0, dead = false;
  const p = {};
  function build() {
    const c = live();
    if (!c) return false;
    const a = c.createOscillator(), b = c.createOscillator();
    a.type = b.type = 'sawtooth'; a.frequency.value = b.frequency.value = MOWE_ENGINE.F0;
    a.detune.value = -MOWE_ENGINE.DETUNE; b.detune.value = MOWE_ENGINE.DETUNE;
    const flt = c.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = MOWE_ENGINE.LP0; flt.Q.value = 0.9;
    const sat = c.createWaveShaper(); sat.curve = tanhCurve(MOWE_ENGINE.DRIVE); sat.oversample = '2x';
    const trem = c.createGain(); trem.gain.value = 0.85;
    const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 9;
    const lfoG = c.createGain(); lfoG.gain.value = 0;
    const gain = c.createGain(); gain.gain.value = 0;
    a.connect(flt); b.connect(flt); flt.connect(sat).connect(trem).connect(gain).connect(master);
    lfo.connect(lfoG).connect(trem.gain);
    for (const o of [a, b, lfo]) o.start();
    n = { a, b, flt, sat, trem, lfo, lfoG, gain };
    return true;
  }
  const ok = () => !stopped && (n || build());
  return {
    set(speed01 = 0, dist = 0, stall = false, quiet = false) {
      if (dead) return;
      try {
        if (!ok()) return;
        const t = ctx.currentTime, G = MOWE_ENGINE.GLIDE;
        moweEngineParams(speed01, dist, stall, quiet, p);
        const f = p.freq * (performance.now() < dipUntil ? 0.7 : 1);
        n.a.frequency.setTargetAtTime(f, t, G); n.b.frequency.setTargetAtTime(f, t, G);
        n.flt.frequency.setTargetAtTime(p.lowpass, t, G);
        n.gain.gain.setTargetAtTime(p.gain, t, G);
        n.lfoG.gain.setTargetAtTime(p.rattle * 0.35, t, 0.05);
      } catch { /* ignore */ }
    },
    cough() {   // a hit: a 0.4 s noise cough and a 30 % pitch dip
      const c = live(); if (!c) return;
      dipUntil = performance.now() + 400;
      burst(c, { dur: 0.4, vol: 0.12, type: 'lowpass', f: 900, fEnd: 200, q: 0.8, attack: 0.01 });
      burst(c, { t: 0.12, dur: 0.22, vol: 0.07, type: 'bandpass', f: 400, q: 1.2 });
    },
    choke() {   // HP 0: it sputters
      const c = live(); if (!c) return;
      for (let i = 0; i < 4; i++) burst(c, { t: i * 0.18, dur: 0.12, vol: 0.09, type: 'lowpass', f: 600, q: 0.7 });
    },
    unplug() {  // the plug: a 1.2 s glide down to 20 Hz, then silence (the jackpot follows)
      dead = true;
      try {
        if (!n) return; const t = ctx.currentTime;
        n.a.frequency.exponentialRampToValueAtTime(20, t + 1.2); n.b.frequency.exponentialRampToValueAtTime(20, t + 1.2);
        n.gain.gain.setTargetAtTime(0, t + 1.0, 0.08);
      } catch { /* ignore */ }
    },
    stop() {
      stopped = true;
      if (!n) return;
      try {
        const t = ctx.currentTime, k = n;
        k.gain.gain.setTargetAtTime(0, t, 0.05);
        for (const o of [k.a, k.b, k.lfo]) o.stop(t + 0.3);
        k.a.onended = () => { for (const v of Object.values(k)) { try { v.disconnect(); } catch { /* ignore */ } } };
      } catch { /* ignore */ }
      n = null;
    },
  };
}

// The boss loop: a 4-bar ostinato. A square-wave bass on A–C–E–G (one note a bar, in 8ths) and noise hats on the 8ths;
// 112 BPM in the harvest, 128 in the hunt, 144 at the plug (the bass drops out: hats and a heartbeat kick). Gain 0.03 on
// the SFX bus (so the PA ducks it, audiomix). stop(fade): dead on a win, a 1.5 s fade on a loss. A look-ahead
// scheduler on a 50 ms timer (it keeps time with no rAF, so a background tab doesn't stutter it).
// Round 12 (builder 1): 'warn' is the build-up's low drone (no hats, no bass line); the plug's heartbeat speeds up with the
// pull bar (PULL_BPM more at a full bar).
export const BOSS_LOOP = Object.freeze({ BPM: { warn: 96, harvest: 112, hunt: 128, plug: 144 }, BASS: [110, 130.81, 164.81, 196], GAIN: 0.03, AHEAD: 0.2, PULL_BPM: 56 });
export const bossTempo = (phase, pull = 0) => (BOSS_LOOP.BPM[phase] ?? BOSS_LOOP.BPM.harvest) + (phase === 'plug' ? BOSS_LOOP.PULL_BPM * Math.max(0, Math.min(1, pull)) : 0);
export function bossLoop() {
  let phase = 'harvest', step = 0, next = 0, timer = null, bus = null, stopped = false, pull = 0;
  function ensure() {
    const c = live();
    if (!c) return null;
    if (!bus) { bus = c.createGain(); bus.gain.value = BOSS_LOOP.GAIN / 0.2; bus.connect(master); next = c.currentTime + 0.05; }   // tone()'s vol 0.2 = the loop's 0.03
    return c;
  }
  function schedule() {
    const c = ensure(); if (!c || stopped) return;
    const eighth = 60 / bossTempo(phase, pull) / 2;
    while (next < c.currentTime + BOSS_LOOP.AHEAD) {
      const t = next - c.currentTime, bar = Math.floor(step / 8) % 4, beat = step % 8;
      if (phase === 'warn') { if (beat === 0) tone(c, { freq: 55, endFreq: 52, type: 'sawtooth', t, dur: eighth * 8, vol: 0.12, attack: eighth * 2, dest: bus }); next += eighth; step++; continue; }
      burst(c, { t, dur: 0.035, vol: beat % 2 ? 0.05 : 0.08, type: 'highpass', f: 7000, q: 0.7, dest: bus });
      if (phase !== 'plug') tone(c, { freq: BOSS_LOOP.BASS[bar] * (beat === 3 || beat === 7 ? 2 : 1), type: 'square', t, dur: eighth * 0.8, vol: 0.2, dest: bus });
      else if (beat === 0 || beat === 1) tone(c, { freq: 60, endFreq: 38, t, dur: 0.16, vol: 0.5, dest: bus });   // the heartbeat: lub-dub
      next += eighth; step++;
    }
  }
  return {
    pull(k) { pull = Number(k) || 0; },
    set(p) {
      if (stopped) return;
      phase = BOSS_LOOP.BPM[p] ? p : phase;
      if (!timer) { schedule(); timer = setInterval(schedule, 50); }
    },
    stop(fade = false) {
      stopped = true; clearInterval(timer); timer = null;
      try { if (bus) { const b = bus; b.gain.setTargetAtTime(0, ctx.currentTime, fade ? 0.5 : 0.01); setTimeout(() => { try { b.disconnect(); } catch { /* ignore */ } }, fade ? 2500 : 200); } } catch { /* ignore */ }
      bus = null;
    },
  };
}

// The pond: a low gurgle and three bubble pops (noise through a resonant bandpass).
export function gurgle() {
  const c = live();
  if (!c) return;
  burst(c, { dur: 1.4, vol: 0.12, type: 'bandpass', f: 180, fEnd: 90, q: 6, attack: 0.15 });
  [0.5, 0.85, 1.25].forEach((t, i) => tone(c, { freq: 420 + i * 90, endFreq: 900 + i * 120, t, dur: 0.09, vol: 0.08 }));
}

// ---- council round 12 (builder 1) ----
// The plug's rope creak: a resonant noise scrape that rises in pitch with the pull bar (k 0..1); a yank is louder.
export function creak(k = 0, yank = false) {
  const c = live();
  if (!c) return;
  const f = 260 + 520 * Math.max(0, Math.min(1, k));
  burst(c, { dur: yank ? 0.32 : 0.2, vol: yank ? 0.16 : 0.08, type: 'bandpass', f, fEnd: f * 1.35, q: 9, attack: 0.03 });
  tone(c, { freq: f / 2, endFreq: f / 1.7, type: 'sawtooth', dur: yank ? 0.25 : 0.16, vol: yank ? 0.05 : 0.025 });
}
// The whistle at the MOW-E post: two notes, up.
export function whistle() {
  const c = live();
  if (!c) return;
  tone(c, { freq: 1568, endFreq: 1760, dur: 0.16, vol: 0.12 });
  tone(c, { freq: 1760, endFreq: 2350, t: 0.2, dur: 0.3, vol: 0.12 });
}
// ---- council round 13 (builder 1) ----
// The shed door slams on a lost fight: a low thud, a sheet-metal clang and a short rattle.
export function slam() {
  const c = live();
  if (!c) return;
  tone(c, { freq: 90, endFreq: 45, dur: 0.35, vol: 0.3, attack: 0.002 });
  burst(c, { dur: 0.25, vol: 0.22, type: 'bandpass', f: 1400, fEnd: 700, q: 4, attack: 0.001 });
  [0.12, 0.2, 0.27].forEach((t, i) => burst(c, { t, dur: 0.05, vol: 0.08 - i * 0.02, type: 'bandpass', f: 2200, q: 6 }));
}
// Your nozzle cools after your hit: a hiss and a sputter.
export function sputter() {
  const c = live();
  if (!c) return;
  burst(c, { dur: 0.5, vol: 0.09, type: 'highpass', f: 3500, attack: 0.01 });
  [0.08, 0.2, 0.34].forEach(t => burst(c, { t, dur: 0.04, vol: 0.08, type: 'bandpass', f: 900, q: 2 }));
}
// For builder 2 (the Seventh-Inning Stretch): a ballpark organ riff, the charge (G C E G · E G).
export const ORGAN_RIFF = Object.freeze([[392, 0, 0.14], [523.25, 0.16, 0.14], [659.25, 0.32, 0.14], [783.99, 0.48, 0.26], [659.25, 0.8, 0.12], [783.99, 0.94, 0.5]]);
export function organ() {
  const c = live();
  if (!c) return;
  for (const [f, t, d] of ORGAN_RIFF) for (const [m, v] of [[1, 0.09], [2, 0.04], [3, 0.025]]) tone(c, { freq: f * m, t, dur: d, vol: v, type: 'sine', attack: 0.01 });
}
// For builder 2 (the first souvenir request of a shift): a crowd chant, "LET'S GO, RANG-ERS" — three swelling crowd
// shouts (band-passed noise, a vowel each) and two claps. CHANT: [time s, vowel formant Hz, length s].
export const CHANT = Object.freeze([[0, 700, 0.22], [0.28, 900, 0.22], [0.62, 600, 0.18], [0.84, 750, 0.18], [1.06, 500, 0.32]]);
export function chant() {
  const c = live();
  if (!c) return;
  for (const [t, f, d] of CHANT) {
    burst(c, { t, dur: d, vol: 0.14, type: 'bandpass', f, fEnd: f * 0.9, q: 3, attack: 0.04 });
    burst(c, { t, dur: d, vol: 0.06, type: 'bandpass', f: f * 2.6, q: 4, attack: 0.04 });
  }
  for (const t of [1.5, 1.75]) burst(c, { t, dur: 0.05, vol: 0.18, type: 'bandpass', f: 1800, q: 1.2 });
}
