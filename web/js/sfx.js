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
function burst(c, { t = 0, dur = 0.05, vol = 0.2, type = 'bandpass', f = 2000, fEnd, q = 1, attack = 0.002 }) {
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
  s.connect(flt).connect(g).connect(master);
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

// Quiet electric-cart whine. Nodes persist across set() calls and only their
// parameters ramp, so per-frame calls stay cheap. Built lazily so it still
// works if the cart spawns before the first unlock.
export function cartEngine() {
  let osc = null;
  let gain = null;
  let flt = null;
  let stopped = false;

  function build() {
    const c = live();
    if (!c) return false;
    osc = c.createOscillator();
    flt = c.createBiquadFilter();
    gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 120;
    flt.type = 'lowpass';
    flt.frequency.value = 900;
    gain.gain.value = 0;
    osc.connect(flt).connect(gain).connect(master);
    osc.start();
    return true;
  }

  return {
    set(speed01) {
      if (stopped) return;
      try {
        if (!osc && !build()) return;
        const c = ctx;
        const s = Math.min(1, Math.max(0, Number(speed01) || 0));
        const t = c.currentTime;
        osc.frequency.setTargetAtTime(110 + s * 330, t, 0.08);
        flt.frequency.setTargetAtTime(600 + s * 1400, t, 0.08);
        gain.gain.setTargetAtTime(s < 0.02 ? 0 : 0.015 + s * 0.035, t, 0.08);
      } catch { /* ignore */ }
    },
    stop() {
      stopped = true;
      if (!osc) return;
      try {
        const t = ctx.currentTime;
        gain.gain.setTargetAtTime(0, t, 0.03);
        osc.stop(t + 0.2);
        const o = osc, f = flt, g = gain;
        o.onended = () => { o.disconnect(); f.disconnect(); g.disconnect(); };
      } catch { /* ignore */ }
      osc = null;
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
