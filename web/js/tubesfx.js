// Round 11 (owner): the field returns' pneumatic tube makes a sound. A pocket going in: a rising WHOOSH (band-passed
// noise sweeping up, with a little suction pop); the batch arriving over the main return: a falling whoosh. Plugs into
// sfx.js's bus (audioHandle), so mute, volume and the PA duck all apply. Quiet with distance (tubeGain, pure).
import { audioHandle } from './sfx.js';

export const TUBE_SFX = { NEAR: 6, FAR: 90, VOL: 0.22 };
// Gain for a listener d metres away: full inside NEAR, silent past FAR, linear between.
export const tubeGain = d => Math.max(0, Math.min(1, 1 - (Math.max(0, d) - TUBE_SFX.NEAR) / (TUBE_SFX.FAR - TUBE_SFX.NEAR)));

let buf = null;
function noiseBuf(c) {
  if (!buf) {
    buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

// up: true for the send (suck up and away), false for the arrival (rush in, then down).
export function whoosh(d = 0, up = true) {
  const h = audioHandle();
  const k = tubeGain(d);
  if (!h || k <= 0 || h.isMuted?.() || h.ctx.state !== 'running') return;
  try {
    const c = h.ctx, t0 = c.currentTime, dur = up ? 1.1 : 0.8, vol = TUBE_SFX.VOL * k;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf(c);
    f.type = 'bandpass'; f.Q.value = 2.2;
    f.frequency.setValueAtTime(up ? 300 : 2600, t0);
    f.frequency.exponentialRampToValueAtTime(up ? 2800 : 260, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + (up ? 0.25 : 0.08));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(h.master);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
    s.start(t0, Math.random() * 0.4); s.stop(t0 + dur + 0.05);
    if (up) {   // the suction pop as the flap shuts
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(180, t0); o.frequency.exponentialRampToValueAtTime(60, t0 + 0.12);
      og.gain.setValueAtTime(0.0001, t0); og.gain.linearRampToValueAtTime(vol * 0.9, t0 + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.14);
      o.connect(og).connect(h.master); o.onended = () => { o.disconnect(); og.disconnect(); };
      o.start(t0); o.stop(t0 + 0.16);
    }
  } catch { /* audio is optional */ }
}
