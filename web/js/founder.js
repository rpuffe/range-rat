// Council round 11 #7: the founder, drawn once. A 1958 golfer mid-swing, the ball a white dot climbing off the top of
// the frame, in sepia with film grain and a vignette. Pure canvas 2D: no THREE, no DOM (a stub context draws in tests).
//
//   drawFounder(g, w, h, t, { sepia, grain, circle, seed })   t 0..1: address → top → impact → finish (the ball leaves)
//     the Muni mid beat's photo (storycard.js, 160 × 100), and the Orbital mid beat's with the dot circled in red pencil.
//   drawNewsreel(g, W, H, t)   t: seconds. The Stadium's promotion morning: the Board plays a 12 s 1958 newsreel
//     (board.overlay, redrawn at the flip's 20 Hz): a leader, the founder swings, the camera pans up into an empty sky.
// No allocation per call beyond what the 2D context itself does (no arrays, no objects).

export const PHOTO = Object.freeze({ W: 160, H: 100 });
export const NEWSREEL = Object.freeze({ SECS: 12, LEADER: 1.6, SWING: 6.4, PAN: 10.6 });

const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a, b, x) => { const u = clamp01((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const lerp = (a, b, u) => a + (b - a) * u;

// Sepia tones, darkest to lightest (the photo's whole palette; mono with grain for the newsreel).
const INK = '#2b1d10', DARK = '#4a3420', MID = '#8a6a45', LIGHT = '#c9ab7c', PAPER = '#e9d6b0';
const MONO_INK = '#141414', MONO_MID = '#6d6d6d', MONO_LIGHT = '#b9b9b9', MONO_PAPER = '#d8d8d4';

// A small deterministic hash (grain), so a frame is reproducible and nothing allocates.
function hash(n) { n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15; return (n >>> 0) / 4294967296; }

// The swing: shoulder turn and club angle by t (0 address, 0.35 top, 0.55 impact, 1 finish).
function swingAngles(t) {
  const back = smooth(0, 0.35, t), down = smooth(0.35, 0.55, t), through = smooth(0.55, 0.85, t);
  // club angle from straight down (radians, + = toward the target side, swinging up behind the head)
  const club = lerp(lerp(0, -2.6, back), 0, down) + through * 2.9;
  const turn = lerp(lerp(0, -0.35, back), 0, down) + through * 0.3;
  return { club, turn };
}

// The figure: a 1950s golfer (flat cap, plus-fours) at (x, ground), height s, in ink colours.
function figure(g, x, ground, s, t, ink, mid) {
  const { club, turn } = swingAngles(t);
  const hipY = ground - s * 0.5, shY = ground - s * 0.82, headY = ground - s * 0.93;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // legs (plus-fours: a little wider at the knee)
  g.strokeStyle = ink; g.lineWidth = Math.max(1, s * 0.07);
  g.beginPath(); g.moveTo(x - s * 0.05, hipY); g.lineTo(x - s * 0.1, ground - s * 0.24); g.lineTo(x - s * 0.11, ground); g.stroke();
  g.beginPath(); g.moveTo(x + s * 0.05, hipY); g.lineTo(x + s * 0.1, ground - s * 0.24); g.lineTo(x + s * 0.12, ground); g.stroke();
  // body
  g.lineWidth = Math.max(1, s * 0.12);
  g.beginPath(); g.moveTo(x, hipY); g.lineTo(x + turn * s * 0.08, shY); g.stroke();
  // head and flat cap
  g.fillStyle = mid; g.beginPath(); g.arc(x + turn * s * 0.1, headY, s * 0.06, 0, Math.PI * 2); g.fill();
  g.fillStyle = ink; g.beginPath(); g.ellipse(x + turn * s * 0.1 + s * 0.02, headY - s * 0.04, s * 0.075, s * 0.03, 0, 0, Math.PI * 2); g.fill();
  // arms to the hands, then the club
  const hx = x + Math.sin(club * 0.5) * s * 0.28, hy = shY + Math.cos(club * 0.5) * s * 0.28;
  g.lineWidth = Math.max(1, s * 0.05);
  g.beginPath(); g.moveTo(x + turn * s * 0.08, shY + s * 0.03); g.lineTo(hx, hy); g.stroke();
  g.lineWidth = Math.max(1, s * 0.025);
  g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx + Math.sin(club) * s * 0.42, hy + Math.cos(club) * s * 0.42); g.stroke();
}

// The grain and the vignette, over whatever is drawn.
function filmLook(g, w, h, seed, grain, dark) {
  if (grain) {
    const n = Math.max(8, Math.round(w * h / 260));
    g.fillStyle = dark;
    for (let i = 0; i < n; i++) {
      const r1 = hash(seed * 7919 + i * 31), r2 = hash(seed * 104729 + i * 17 + 3);
      g.globalAlpha = 0.08 + 0.18 * hash(i * 13 + seed);
      g.fillRect(r1 * w, r2 * h, 1, 1);
    }
    // a scratch or two
    g.globalAlpha = 0.25; g.fillRect(hash(seed + 5) * w, 0, 1, h);
    g.globalAlpha = 1;
  }
  const vg = g.createRadialGradient?.(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
  if (vg) { vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,12,4,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, w, h); }
}

// The photo. t 0..1 plays the swing; the ball (a white dot) climbs off the top of the frame after impact.
export function drawFounder(g, w, h, t = 0.6, { sepia = true, grain = true, circle = false, seed = 0 } = {}) {
  if (!g) return;
  t = clamp01(Number(t) || 0);
  const ink = sepia ? INK : MONO_INK, mid = sepia ? MID : MONO_MID, light = sepia ? LIGHT : MONO_LIGHT, paper = sepia ? PAPER : MONO_PAPER;
  // sky and grass
  g.fillStyle = paper; g.fillRect(0, 0, w, h);
  g.fillStyle = light; g.fillRect(0, h * 0.72, w, h * 0.28);
  // a far tree line and the old clubhouse roof
  g.fillStyle = mid; g.fillRect(0, h * 0.66, w, h * 0.07);
  g.fillStyle = sepia ? DARK : MONO_INK; g.fillRect(w * 0.72, h * 0.55, w * 0.2, h * 0.12);
  g.beginPath(); g.moveTo(w * 0.7, h * 0.56); g.lineTo(w * 0.82, h * 0.47); g.lineTo(w * 0.94, h * 0.56); g.fill();
  // the founder
  const s = h * 0.62, fx = w * 0.36, ground = h * 0.86;
  figure(g, fx, ground, s, t, ink, mid);
  // the ball: on the tee until impact, then a white dot climbing up and off the top of the frame (it never lands)
  const fly = smooth(0.55, 1, t);
  const bx = lerp(fx + s * 0.12, w * 0.58, fly), by = lerp(ground - 2, -h * 0.15, fly);
  g.fillStyle = '#fffdf4'; g.beginPath(); g.arc(bx, by, Math.max(1.4, h * 0.022), 0, Math.PI * 2); g.fill();
  if (circle) {   // the Orbital: the dot circled in red pencil (drawn where the ball left the frame)
    const cx = fly > 0.85 ? w * 0.57 : bx, cy = fly > 0.85 ? h * 0.1 : by;
    g.strokeStyle = '#b3261e'; g.lineWidth = 1.6; g.globalAlpha = 0.9;
    g.beginPath(); g.ellipse(cx, cy, h * 0.11, h * 0.08, -0.2, 0.2, Math.PI * 2.1); g.stroke();
    g.globalAlpha = 1;
  }
  filmLook(g, w, h, seed, grain, ink);
  g.strokeStyle = ink; g.lineWidth = 1; g.strokeRect(0.5, 0.5, w - 1, h - 1);
}

// The newsreel, on the Board's canvas (W × H, 1024 × 512). t: seconds since it started (0..12).
export function drawNewsreel(g, W, H, t = 0) {
  if (!g) return;
  t = Math.max(0, Number(t) || 0);
  const frame = (t * 20) | 0;
  g.save?.();
  g.fillStyle = MONO_INK; g.fillRect(0, 0, W, H);
  if (t < NEWSREEL.LEADER) {   // the leader: a countdown circle and a sweep
    const n = 3 - Math.min(2, Math.floor(t / (NEWSREEL.LEADER / 3)));
    g.fillStyle = MONO_MID; g.fillRect(0, 0, W, H);
    g.strokeStyle = MONO_PAPER; g.lineWidth = 6;
    g.beginPath(); g.arc(W / 2, H / 2, H * 0.36, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke();
    g.fillStyle = MONO_PAPER; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 ${Math.round(H * 0.42)}px Georgia, serif`; g.fillText(String(n), W / 2, H / 2 + H * 0.02);
  } else {
    // the founder swings; then the camera pans up after the ball into an empty sky (the photo drawn taller, sliding down)
    const k = clamp01((t - NEWSREEL.LEADER) / (NEWSREEL.SWING - NEWSREEL.LEADER));
    const pan = smooth(NEWSREEL.SWING, NEWSREEL.PAN, t);
    const vw = H * 1.6, vx = (W - vw) / 2;   // the 1.6:1 picture, centred, black bars at the sides
    g.save?.();
    g.translate?.(vx, pan * H * 1.1);
    drawFounder(g, vw, H, k, { sepia: false, grain: false });
    g.restore?.();
    if (pan > 0) {   // the sky the camera finds: empty, a little lighter at the top
      g.fillStyle = MONO_PAPER; g.fillRect(vx, 0, vw, pan * H * 1.1 + 1);
      // the ball, still climbing faster than the camera: it slips off the top, and the camera never finds it
      const by = H * (-0.1 + 0.55 * Math.sin(pan * Math.PI));   // the camera catches it up, then it climbs away again
      if (by > -10) { g.fillStyle = '#fffdf4'; g.strokeStyle = MONO_MID; g.lineWidth = 2; g.beginPath(); g.arc(vx + vw * 0.58, by, 9 * (1 - 0.5 * pan), 0, Math.PI * 2); g.fill(); g.stroke(); }
    }
    g.fillStyle = MONO_INK; g.textAlign = 'left'; g.textBaseline = 'top';   // ink on the pale sky
    g.font = `700 ${Math.round(H * 0.06)}px Georgia, serif`;
    g.fillText('FAIRWAY HOLDINGS NEWSREEL · 1958', vx + 18, 14);
    if (t > NEWSREEL.PAN) { g.textAlign = 'center'; g.font = `italic 700 ${Math.round(H * 0.09)}px Georgia, serif`; g.fillText('…and it never came down.', W / 2, H * 0.72); }
    filmLook(g, W, H, frame, true, MONO_INK);
  }
  // the flicker: the whole frame breathes a little
  g.fillStyle = '#000'; g.globalAlpha = 0.06 + 0.08 * hash(frame + 99); g.fillRect(0, 0, W, H); g.globalAlpha = 1;
  g.restore?.();
}
