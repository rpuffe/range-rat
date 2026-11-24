// Range Rat ambient soundscape: birds, crickets, wind, distant club strikes,
// Last Call floodlight hum and an underwater filter, all synthesised with Web
// Audio (no files). Imports only sfx.js's setUnderwater (so the SFX bus muffles with the ambience).
//
// Wiring: this module does NOT create its own AudioContext. The host calls
// attach(ctx, destination[, isMutedFn]) once, with sfx.js's context and master
// gain, after sfx.unlock() has created them. Until attach() has been called
// (or if Web Audio is missing / the context is suspended) every export is a
// silent no-op that never throws. Mute is respected through the sfx master
// (our output feeds it) and, if given, isMutedFn is also polled so we skip
// scheduling one-shots while muted.

import { setUnderwater as muffleSfx } from './sfx.js';

const LEVEL = 0.35; // ambience master, relative to the sfx master

let ctx = null;
let dest = null;
let isMutedFn = null;
let noiseBuf = null;

let started = false;
let timer = null;
let lastTick = 0;
let bus = null; // everything ambient feeds this
let lp = null; // underwater low-pass, sits after bus
let out = null; // LEVEL gain
let vol = 1;     // settings volume (web/js/settings.js)
let beds = null; // { wind, windGain, crick, crickGain, hum, humGain, rumble, rumbleGain, nodes[] }

const state = { tod: 0.3, lastCall: false, underwater: false, nearField: 0, crowd: 0 };

// Ambience volume from the settings page, 0..1.
export function setVolume(v) {
  vol = clamp01(v);
  try { if (out && ctx) out.gain.setTargetAtTime(LEVEL * vol * (state.lastCall ? 1.15 : 1), ctx.currentTime, 0.05); } catch { /* ignore */ }
}

// Hand over the sfx context and master gain. Safe to call repeatedly; a new
// context replaces the old one (beds are rebuilt on the next startAmbience).
export function attach(audioCtx, destination, isMuted) {
  try {
    if (audioCtx !== ctx) {
      teardown();
      ctx = audioCtx || null;
      noiseBuf = null;
    }
    dest = destination || null;
    isMutedFn = typeof isMuted === 'function' ? isMuted : null;
    if (started && !bus) build();
  } catch {
    ctx = null;
    dest = null;
  }
}

function live() {
  if (!ctx || !dest || !bus) return null;
  if (ctx.state !== 'running') return null;
  try { if (isMutedFn && isMutedFn()) return null; } catch { /* ignore */ }
  return ctx;
}

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));

// Two seconds of white noise, shared by beds (looped) and bursts (sliced).
function noise(c) {
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function panner(c, pan) {
  if (typeof c.createStereoPanner !== 'function') return null;
  const p = c.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  return p;
}

// Route a node into the bus through an optional random pan; returns a cleanup list.
function toBus(c, node, pan) {
  const p = panner(c, pan);
  if (p) { node.connect(p).connect(bus); return [p]; }
  node.connect(bus);
  return [];
}

function build() {
  const c = ctx;
  bus = c.createGain();
  lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 20000;
  lp.Q.value = 0.7;
  out = c.createGain();
  out.gain.value = LEVEL * vol;
  bus.connect(lp).connect(out).connect(dest);

  const nodes = [];
  const loopNoise = () => {
    const s = c.createBufferSource();
    s.buffer = noise(c);
    s.loop = true;
    nodes.push(s);
    return s;
  };
  const lfo = (freq, depth, target) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = freq;
    g.gain.value = depth;
    o.connect(g).connect(target);
    nodes.push(o, g);
    o.start();
    return o;
  };

  // Wind: low-passed noise through a bandpass, gain slowly swelling.
  const wind = loopNoise();
  const wf = c.createBiquadFilter();
  wf.type = 'bandpass';
  wf.frequency.value = 420;
  wf.Q.value = 0.5;
  const windGain = c.createGain();
  windGain.gain.value = 0.0;
  wind.connect(wf).connect(windGain).connect(bus);
  lfo(0.07, 0.012, windGain.gain);
  lfo(0.11, 90, wf.frequency);
  wind.start(0, Math.random());
  nodes.push(wf, windGain);

  // Crickets: a 4.6 kHz tone chopped by a ~28 Hz pulse, itself gated by a slow
  // ~3 Hz chirp envelope; second detuned voice for width.
  const crickGain = c.createGain();
  crickGain.gain.value = 0;
  crickGain.connect(bus);
  nodes.push(crickGain);
  [4600, 5100].forEach((f, i) => {
    const o = c.createOscillator();
    o.frequency.value = f;
    const chop = c.createGain();
    chop.gain.value = 0.5;
    o.connect(chop).connect(crickGain);
    lfo(i ? 24 : 29, 0.5, chop.gain); // gain swings 0..1 at pulse rate
    lfo(i ? 2.6 : 3.1, 0.25, chop.gain);
    o.start();
    nodes.push(o, chop);
  });

  // Floodlight hum: 50/60 Hz and a few harmonics, very quiet.
  const humGain = c.createGain();
  humGain.gain.value = 0;
  humGain.connect(bus);
  nodes.push(humGain);
  [[50, 1], [60, 0.7], [100, 0.5], [120, 0.45], [180, 0.25], [300, 0.1]].forEach(([f, a]) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = f <= 60 ? 'sine' : 'triangle';
    o.frequency.value = f;
    g.gain.value = a * 0.5;
    o.connect(g).connect(humGain);
    o.start();
    nodes.push(o, g);
  });

  // Underwater rumble: low noise with a bubbly wobble.
  const rumble = loopNoise();
  const rf = c.createBiquadFilter();
  rf.type = 'lowpass';
  rf.frequency.value = 160;
  rf.Q.value = 3;
  const rumbleGain = c.createGain();
  rumbleGain.gain.value = 0;
  rumble.connect(rf).connect(rumbleGain).connect(bus);
  lfo(1.7, 40, rf.frequency);
  lfo(5.3, 0.03, rumbleGain.gain);
  rumble.start(0, Math.random());
  nodes.push(rf, rumbleGain);

  beds = { windGain, crickGain, humGain, rumbleGain, nodes };
  apply(true);
}

function teardown() {
  if (timer) { clearInterval(timer); timer = null; }
  if (beds) {
    for (const n of beds.nodes) {
      try { if (typeof n.stop === 'function') n.stop(); } catch { /* ignore */ }
      try { n.disconnect(); } catch { /* ignore */ }
    }
  }
  for (const n of [bus, lp, out]) {
    try { if (n) n.disconnect(); } catch { /* ignore */ }
  }
  beds = null;
  bus = lp = out = null;
}

// Push the current state into the beds' parameters (smoothed).
function apply(instant) {
  if (!ctx || !beds) return;
  try {
    const t = ctx.currentTime;
    const tau = instant ? 0.01 : 0.6;
    const s = state;
    const crick = Math.min(1, Math.max(0, (s.tod - 0.75) / 0.2));
    const wind = (0.05 + 0.02 * s.nearField) * (s.lastCall ? 1.35 : 1);
    beds.windGain.gain.setTargetAtTime(wind, t, tau);
    beds.crickGain.gain.setTargetAtTime(0.012 * crick * (s.underwater ? 0.5 : 1), t, tau);
    beds.humGain.gain.setTargetAtTime(s.lastCall ? 0.014 : 0, t, tau * 2);
    beds.rumbleGain.gain.setTargetAtTime(s.underwater ? 0.09 : 0, t, tau);
    lp.frequency.setTargetAtTime(s.underwater ? 400 : 20000, t, instant ? 0.01 : 0.15);
    out.gain.setTargetAtTime(LEVEL * vol * (s.lastCall ? 1.15 : 1), t, tau);
  } catch { /* ignore */ }
}

// ---- one-shots ------------------------------------------------------------

// FM-sine bird call: a short run of notes, each a gliding carrier with a
// fast-decaying modulator, at one random pan per phrase.
function chirp(c) {
  const pan = rnd(-0.9, 0.9);
  const base = rnd(2200, 5200);
  const notes = 2 + Math.floor(Math.random() * 5);
  const ratio = [1.5, 2, 2.5, 3.01][Math.floor(Math.random() * 4)];
  const trill = Math.random() < 0.3;
  let t = c.currentTime + 0.01;
  for (let i = 0; i < notes; i++) {
    const dur = trill ? rnd(0.03, 0.05) : rnd(0.05, 0.13);
    const f0 = base * rnd(0.85, 1.25);
    const f1 = f0 * (Math.random() < 0.5 ? rnd(1.15, 1.6) : rnd(0.6, 0.9));
    const car = c.createOscillator();
    const mod = c.createOscillator();
    const mg = c.createGain();
    const g = c.createGain();
    car.frequency.setValueAtTime(f0, t);
    car.frequency.exponentialRampToValueAtTime(f1, t + dur);
    mod.frequency.setValueAtTime(f0 * ratio, t);
    mod.frequency.exponentialRampToValueAtTime(f1 * ratio, t + dur);
    mg.gain.setValueAtTime(f0 * rnd(0.2, 0.8), t);
    mg.gain.exponentialRampToValueAtTime(1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(rnd(0.012, 0.03), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    mod.connect(mg).connect(car.frequency);
    car.connect(g);
    const extra = toBus(c, g, pan);
    car.onended = () => {
      try { car.disconnect(); mod.disconnect(); mg.disconnect(); g.disconnect(); extra.forEach((n) => n.disconnect()); } catch { /* ignore */ }
    };
    car.start(t);
    mod.start(t);
    car.stop(t + dur + 0.02);
    mod.stop(t + dur + 0.02);
    t += dur + (trill ? rnd(0.02, 0.04) : rnd(0.05, 0.16));
  }
}

// Far-off club strike: faint whoosh, then a soft low thwack.
function strike(c) {
  const pan = rnd(-1, 1);
  const t0 = c.currentTime + 0.01;
  const gain = rnd(0.35, 1);
  const whoosh = 0.12;

  const s = c.createBufferSource();
  const f = c.createBiquadFilter();
  const g = c.createGain();
  s.buffer = noise(c);
  f.type = 'bandpass';
  f.Q.value = 1;
  f.frequency.setValueAtTime(500, t0);
  f.frequency.exponentialRampToValueAtTime(1800, t0 + whoosh);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.025 * gain, t0 + whoosh * 0.8);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + whoosh + 0.03);
  s.connect(f).connect(g);
  const e1 = toBus(c, g, pan);
  s.onended = () => { try { s.disconnect(); f.disconnect(); g.disconnect(); e1.forEach((n) => n.disconnect()); } catch { /* ignore */ } };
  s.start(t0, Math.random() * 1.5);
  s.stop(t0 + whoosh + 0.05);

  const th = t0 + whoosh;
  const o = c.createOscillator();
  const og = c.createGain();
  o.frequency.setValueAtTime(rnd(260, 380), th);
  o.frequency.exponentialRampToValueAtTime(110, th + 0.08);
  og.gain.setValueAtTime(0.0001, th);
  og.gain.linearRampToValueAtTime(0.05 * gain, th + 0.003);
  og.gain.exponentialRampToValueAtTime(0.0001, th + 0.1);
  const n = c.createBufferSource();
  const nf = c.createBiquadFilter();
  const ng = c.createGain();
  n.buffer = noise(c);
  nf.type = 'lowpass';
  nf.frequency.value = rnd(1200, 2200); // distance dulls the crack
  ng.gain.setValueAtTime(0.0001, th);
  ng.gain.linearRampToValueAtTime(0.06 * gain, th + 0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, th + 0.05);
  const mix = c.createGain();
  o.connect(og).connect(mix);
  n.connect(nf).connect(ng).connect(mix);
  const e2 = toBus(c, mix, pan);
  o.onended = () => {
    try { o.disconnect(); og.disconnect(); n.disconnect(); nf.disconnect(); ng.disconnect(); mix.disconnect(); e2.forEach((x) => x.disconnect()); } catch { /* ignore */ }
  };
  o.start(th);
  o.stop(th + 0.12);
  n.start(th, Math.random() * 1.5);
  n.stop(th + 0.06);
}

// Poisson-ish scheduler, run on a slow interval.
function tick() {
  try {
    const now = Date.now();
    const dt = Math.min(1, (now - lastTick) / 1000);
    lastTick = now;
    const c = live();
    if (!c) return;
    const s = state;
    // Birds: busy at dawn, thinning toward dusk, gone once crickets own the evening.
    const birdRate = Math.max(0, 0.9 * Math.pow(1 - s.tod, 1.5) + 0.05) * (s.tod > 0.85 ? 0.3 : 1);
    if (Math.random() < birdRate * dt) chirp(c);
    // Distant swings follow the crowd.
    const strikeRate = 0.05 + s.crowd * 0.9;
    if (Math.random() < strikeRate * dt) strike(c);
  } catch { /* ignore */ }
}

// ---- public API -----------------------------------------------------------

export function startAmbience() {
  try {
    if (started) return;
    if (!ctx || !dest) return; // not attached yet; call again after attach()
    started = true;
    if (!bus) build();
    else apply(true); // restarted during a stop fade-out
    lastTick = Date.now();
    timer = setInterval(tick, 200);
  } catch {
    started = false;
  }
}

export function setAmbience(p) {
  try {
    if (!p || typeof p !== 'object') return;
    const s = state;
    if (p.timeOfDay01 !== undefined) s.tod = clamp01(p.timeOfDay01);
    if (p.lastCall !== undefined) s.lastCall = !!p.lastCall;
    if (p.underwater !== undefined) { s.underwater = !!p.underwater; muffleSfx(s.underwater); }
    if (p.nearField !== undefined) s.nearField = clamp01(p.nearField);
    if (p.crowd !== undefined) s.crowd = clamp01(p.crowd);
    if (started) apply(false);
  } catch { /* ignore */ }
}

export function stopAmbience() {
  try {
    started = false;
    if (!beds) { teardown(); return; }
    // Fade out, then release the nodes.
    const b = beds;
    const o = out;
    if (o && ctx) o.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    if (timer) { clearInterval(timer); timer = null; }
    setTimeout(() => { if (beds === b && !started) teardown(); }, 600);
  } catch { /* ignore */ }
}
