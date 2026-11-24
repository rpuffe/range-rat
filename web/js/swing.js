// The player's golf swing for Range Rat: mouse drag-and-flick, or the right stick.
// Adapted from the golf game (mouse drag/flick) and pad.js (stick swing).
//
// The pure parts (strikeToLaunch, CURVE_ACCEL, applyCurve) touch no DOM and no
// THREE, so the server can import them. createSwing() only touches the DOM when
// it is called / rendered, never at import time.
import { newStickSwing, stepStickSwing, BTN } from './pad.js';

export const SWING_PX = 220;        // pixels of backswing for 100% power
export const OVER_MAX = 1.15;       // overswing ceiling
export const MAX_YAW_BEND = 0.18;   // rad of yaw at full drift
export const CURVE_ACCEL = 6;       // sideways m/s^2 per unit of ball.curve (curve = drift, -1..1)

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// strike {power, tempo, drift} -> {power, yaw, pitch} for swingLaunch(bay, yaw, pitch, power).
// Effective power = power * (0.6 + 0.4 * tempo): a pure strike keeps all of it,
// a fully slack one keeps 60%. Yaw bends by -drift * 0.18 rad (this game's
// forward is (-sin yaw, -cos yaw), so a smaller yaw turns right: a slice,
// drift > 0, starts right and a hook starts left). Pitch passes through.
// Send `curve: strike.drift` along with it and run applyCurve each tick.
export function strikeToLaunch(strike, yaw, pitch) {
  const power = clamp(strike?.power ?? 0, 0, OVER_MAX);
  const tempo = clamp(strike?.tempo ?? 1, 0, 1);
  const drift = clamp(strike?.drift ?? 0, -1, 1);
  return { power: power * (0.6 + 0.4 * tempo), yaw: yaw - drift * MAX_YAW_BEND, pitch };
}

// Sideways acceleration while airborne, perpendicular to the horizontal
// velocity: +curve bends right of travel (slice), -curve left (hook).
// ball: {x, y, z, vx, vy, vz, curve, rest?}. Mutates vx/vz. Call before integrating position.
export function applyCurve(ball, dt) {
  const c = ball.curve;
  if (!c || ball.rest || !(ball.y > 0.12)) return;
  const h = Math.hypot(ball.vx, ball.vz);
  if (h < 1) return;
  // right of travel with forward f=(fx,fz) is (-fz, fx)
  const a = CURVE_ACCEL * c * dt / h;
  const vx = ball.vx, vz = ball.vz;
  ball.vx = vx - vz * a;
  ball.vz = vz + vx * a;
}

// Tempo from the top to the strike, as in golf: a quick smooth flick is pure.
function mouseTempo(dur, peak) {
  const ideal = 0.08 + 0.14 * peak;
  return clamp(1 - (dur - ideal) / (0.45 + (1 - Math.min(1, peak)) * 0.6), 0, 1);
}

export function createSwing({ canvas, onStrike }) {
  let enabled = false;
  const st = { phase: 'idle', power: 0, over: false, progress: 0, tempo: 1, drift: 0, src: '', result: null, resultAt: 0 };
  const m = { active: false, pos: 0, peak: 0, tTop: 0, drift: 0, lastY: 0, lastX: 0, id: null };
  const pad = newStickSwing();
  let cv = null, ctx = null;

  const locked = () => typeof document !== 'undefined' && !!document.pointerLockElement;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  function reset() { m.active = false; m.pos = m.peak = m.drift = 0; Object.assign(st, { phase: 'idle', power: 0, over: false, progress: 0 }); }
  function result(label) { st.result = label; st.resultAt = now(); }

  function strike(power, tempo, drift, over, src) {
    const label = tempo < 0.4 ? 'SLACK' : Math.abs(drift) > 0.3 ? (drift < 0 ? 'HOOK' : 'SLICE') : 'PURE';
    Object.assign(st, { tempo, drift, src });
    reset();
    result(label);
    onStrike?.({ power, tempo, drift, over: over || power > 1.0001 });
  }

  function pointerDown(e) {
    if (!enabled || (e.button != null && e.button !== 0)) return false;
    Object.assign(m, { active: true, pos: 0, peak: 0, drift: 0, tTop: 0, lastY: e.clientY ?? 0, lastX: e.clientX ?? 0 });
    Object.assign(st, { phase: 'back', power: 0, over: false, progress: 0, src: 'mouse' });
    return true;
  }

  function pointerMove(e) {
    if (!m.active) return false;
    let dx, dy;
    if (locked()) { dx = e.movementX || 0; dy = e.movementY || 0; }
    else { dx = (e.clientX ?? m.lastX) - m.lastX; dy = (e.clientY ?? m.lastY) - m.lastY; }
    m.lastX = e.clientX ?? m.lastX; m.lastY = e.clientY ?? m.lastY;
    if (st.phase === 'back') {
      m.pos = Math.max(0, m.pos + dy);
      if (m.pos > m.peak) { m.peak = m.pos; m.tTop = now(); }
      const power = Math.min(OVER_MAX, m.peak / SWING_PX);
      st.power = power; st.over = power > 1;
      // a flick up from the top: more than 3 px back toward the start
      if (power > 0.04 && m.peak - m.pos > 3 && dy < 0) { st.phase = 'down'; m.tTop = now(); m.drift = 0; }
      else return true;
    }
    if (st.phase === 'down') {
      m.pos += dy;
      m.drift += dx / (SWING_PX * 0.8);
      st.progress = clamp(1 - m.pos / Math.max(1, m.peak), 0, 1);
      if (m.pos <= 0) {
        const power = Math.min(OVER_MAX, m.peak / SWING_PX);
        strike(power, mouseTempo((now() - m.tTop) / 1000, power), clamp(m.drift, -1, 1), power > 1, 'mouse');
      }
    }
    return true;
  }

  // Letting go before the flick cancels; letting go well into the flick still strikes.
  function pointerUp() {
    if (!m.active) return false;
    if (st.phase === 'down' && m.peak > 0 && st.progress >= 0.6) {
      const power = Math.min(OVER_MAX, m.peak / SWING_PX);
      strike(power, mouseTempo((now() - m.tTop) / 1000, power), clamp(m.drift, -1, 1), power > 1, 'mouse');
    } else reset();
    return true;
  }

  // pad: readPad snapshot (rx, ry, rt, pressed) or null. dt in seconds, tNow in ms.
  function stepPad(p, dt, tNow = now()) {
    if (!p || m.active) return;
    if (p.pressed?.[BTN.B] && pad.phase !== 'idle') { Object.assign(pad, newStickSwing()); reset(); return; }
    const over = (p.rt ?? 0) > 0.5;
    const ev = stepStickSwing(pad, { x: p.rx ?? 0, y: p.ry ?? 0 }, tNow, { over, allowed: enabled });
    if (!enabled && pad.phase !== 'idle') { Object.assign(pad, newStickSwing()); reset(); return; }
    if (!ev) return;
    st.src = 'pad';
    if (ev.type === 'begin' || ev.type === 'back') { Object.assign(st, { phase: 'back', power: ev.back, over: ev.back > 1, progress: 0 }); }
    else if (ev.type === 'down') { st.phase = 'down'; st.progress = 0.3; }
    else if (ev.type === 'cancel') reset();
    else if (ev.type === 'strike') strike(ev.power, ev.tempo, ev.drift, ev.power > 1, 'pad');
    if (st.phase === 'down' && ev.type !== 'down') st.progress = clamp(-(p.ry ?? 0), 0, 1);
  }

  function setEnabled(v) {
    enabled = !!v;
    if (!enabled) { Object.assign(pad, newStickSwing()); reset(); }
  }

  // ---- HUD arc ------------------------------------------------------------
  const A0 = Math.PI * 0.75, SWEEP = Math.PI * 1.5;   // 135deg .. 405deg, gap at the bottom
  function render(el) {
    if (!el || typeof document === 'undefined') return;
    if (!cv || cv.parentNode !== el) {
      cv = document.createElement('canvas'); cv.width = 200; cv.height = 200;
      cv.style.cssText = 'width:200px;height:200px;display:block';
      el.appendChild(cv); ctx = cv.getContext('2d');
    }
    const t = now();
    const showResult = st.result && t - st.resultAt < 1000;
    const visible = st.phase !== 'idle' || showResult;
    el.style.opacity = enabled && visible ? '1' : '0';
    el.style.transition = 'opacity .15s';
    if (!ctx) return;
    ctx.clearRect(0, 0, 200, 200);
    if (!visible) return;
    const cx = 100, cy = 100, r = 74;
    ctx.fillStyle = 'rgba(20,16,10,0.62)';
    ctx.beginPath(); ctx.arc(cx, cy, 96, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(255,244,214,0.16)';
    ctx.beginPath(); ctx.arc(cx, cy, r, A0, A0 + SWEEP); ctx.stroke();
    const frac = st.phase === 'idle' ? 0 : clamp(st.power / OVER_MAX, 0, 1);
    if (frac > 0.005) {
      ctx.strokeStyle = st.over ? '#ff7a45' : '#ffbf3a';
      ctx.beginPath(); ctx.arc(cx, cy, r, A0, A0 + SWEEP * frac); ctx.stroke();
    }
    // 100% tick
    const a100 = A0 + SWEEP * (1 / OVER_MAX);
    ctx.strokeStyle = '#fff4d6'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a100) * (r - 12), cy + Math.sin(a100) * (r - 12));
    ctx.lineTo(cx + Math.cos(a100) * (r + 12), cy + Math.sin(a100) * (r + 12)); ctx.stroke();
    // tempo marker on the downswing: runs back down the arc, green when smooth, red when slow
    if (st.phase === 'down') {
      const aa = A0 + SWEEP * frac * (1 - st.progress);
      const dur = m.active ? (t - m.tTop) / 1000 : 0;
      const q = m.active ? mouseTempo(dur, st.power) : 1;
      ctx.fillStyle = q > 0.7 ? '#9be37a' : q > 0.35 ? '#ffd24a' : '#ff6a4a';
      ctx.beginPath(); ctx.arc(cx + Math.cos(aa) * r, cy + Math.sin(aa) * r, 11, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#2a2014'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (showResult) {
      const bad = st.result !== 'PURE';
      ctx.fillStyle = bad ? '#ffb070' : '#fff4d6';
      ctx.font = '900 38px system-ui, sans-serif';
      ctx.fillText(st.result, cx, cy - 4);
      ctx.fillStyle = 'rgba(255,244,214,0.75)'; ctx.font = '700 18px system-ui, sans-serif';
      ctx.fillText(Math.round(clamp(st.tempo, 0, 1) * 100) + '% tempo', cx, cy + 28);
    } else {
      ctx.fillStyle = '#fff4d6'; ctx.font = '900 40px system-ui, sans-serif';
      ctx.fillText(Math.round(st.power * 100) + '%', cx, cy - 2);
      ctx.fillStyle = 'rgba(255,244,214,0.7)'; ctx.font = '700 17px system-ui, sans-serif';
      ctx.fillText(st.phase === 'back' ? 'FLICK UP' : st.over ? 'OVERSWING' : '', cx, cy + 30);
    }
  }

  return {
    get enabled() { return enabled; },
    setEnabled, pointerDown, pointerMove, pointerUp, stepPad, state: st, render,
    // true while a mouse drag is in progress (main.js: suspend mouse look)
    get dragging() { return m.active; },
  };
}
