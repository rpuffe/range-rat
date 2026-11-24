// Range Rat snack shed: the fry-making minigame.
//
// Four steps on a 2D canvas inside a DOM overlay: PEEL a potato, SLICE it,
// FRY it, SERVE it. main.js feeds it input (handlePointer / handleKey /
// stepPad) and a per-frame tick(dt); it reports a served portion through
// onServe({ quality, onePeel, chops, secs}) and asks for sounds by name through
// onSound(name): peel, chop, sizzle-on, sizzle-off, ding, salt, serve.
//
// No top-level DOM access: the overlay is built lazily on first open().

const W = 640, H = 420;
const INK = '#fff8ec', DIM = '#e8d6bd', ACCENT = '#ffb347', BAD = '#ff8a7a';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const STEPS = ['PEEL', 'SLICE', 'FRY', 'SERVE'];

// tunables
const PEEL_NEED = 2.5 * Math.PI * 2;     // radians of circling to strip a potato
const KEY_STEP = 0.95;                   // radians per alternating A/D press
const STREAK_SLACK = 0.5;                // radians of backwards motion tolerated before the streak breaks
const KNIFE_SPEED = 380;                 // px/s
const CHOP_TOL = 26;                     // px from the dashed line for a clean chop
const FRY = { pale: 0.4, goldLo: 0.55, goldHi: 0.82, burnt: 1.0, max: 1.25, rate: 0.22 };
const SALT_TAPS = 3;

const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

const JOKES = {
  perfect: ['Compliant with all known fry standards.', 'Dimples has approved this. Dimples approves nothing.', 'Synergy, but make it crispy.'],
  good: ['Edible. Fairway Holdings notes it as "edible".', 'Meets expectations. Exceeds nothing.', 'A solid B-minus of a fry.'],
  burnt: ['Corporate has noted the smell.', 'An incident report has been filed. In triplicate.', 'This fry has been put on a performance plan.'],
};
const LABEL = { perfect: 'PERFECT ✦', good: 'GOOD', burnt: 'BURNT' };

const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], clamp(t, 0, 1))));
const COL_PALE = [246, 227, 161], COL_GOLD = [240, 180, 60], COL_BROWN = [150, 88, 30], COL_BURNT = [40, 24, 16];
function fryColour(g) {
  let c;
  if (g < FRY.goldLo) c = mix(COL_PALE, COL_GOLD, g / FRY.goldLo);
  else if (g < FRY.burnt) c = mix(COL_GOLD, COL_BROWN, (g - FRY.goldLo) / (FRY.burnt - FRY.goldLo));
  else c = mix(COL_BROWN, COL_BURNT, (g - FRY.burnt) / (FRY.max - FRY.burnt));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

function blob(c, cx, cy, rx, ry, seed) {
  c.beginPath();
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2, k = 1 + 0.05 * Math.sin(3 * t + seed) + 0.035 * Math.sin(5 * t + seed * 2.3);
    const x = cx + Math.cos(t) * rx * k, y = cy + Math.sin(t) * ry * k;
    if (i) c.lineTo(x, y); else c.moveTo(x, y);
  }
  c.closePath();
}
function rrect(c, x, y, w, h, r) {
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
function text(c, s, x, y, size, col = INK, align = 'center', maxW) {
  c.font = `800 ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle'; c.fillStyle = col;
  if (maxW) c.fillText(s, x, y, maxW); else c.fillText(s, x, y);
}

export function createKitchen({ root, onServe, onSound } = {}) {
  let opened = false, built = false;
  let wrapEl = null, cv = null, c = null;
  let S = null;                  // state of the current potato
  let dev = 'mouse';             // last input kind: mouse | touch | key | pad
  const held = { key: false, ptr: false, pad: false };
  const lastAng = {};            // peel angle trackers per source
  let ptrDownSalted = false;
  let flash = 0;                 // streak-broken flash timer

  const snd = n => { try { onSound && onSound(n); } catch { /* sound must never break the shed */ } };
  const isHeld = () => held.key || held.ptr || held.pad;

  // ---- potato lifecycle ---------------------------------------------------------
  function newPotato() {
    S = {
      stage: 'peel', t: 0, st: 0, lock: 0.3, seed: Math.random() * 6,
      parts: [],
      // peel
      peeled: 0, curAng: -Math.PI / 2, streakDir: 0, rev: 0, broken: false, spawnAcc: 0, soundAcc: 0, lastKey: '', mouth: 0,
      // slice
      knifeX: 100, knifeDir: 1, drop: 0, cuts: [], lines: [], chops: 0, falling: null, pieces: [],
      // fry
      d: 0, g: 0, sizzle: false, dinged: false, needRelease: false, fryDone: false, fryQ: null, tooPale: 0,
      // serve
      salt: 0, shake: 0, trayX: 200, sliding: false, slideV: 0, specks: [],
      // result
      quality: null, joke: '', onePeel: false, secs: 0, stampT: 0,
    };
    for (let i = 0; i < 5; i++) S.lines.push(130 + ((i + 1) * 380) / 6);
    for (const k in lastAng) delete lastAng[k];
    flash = 0;
  }
  function goStage(name) {
    S.stage = name; S.st = 0; S.lock = 0.35;
    if (name === 'fry') { S.needRelease = isHeld(); }
    if (name === 'serve') S.salt = 0;
  }

  // ---- input ---------------------------------------------------------------------
  function feedAngle(a, src) {
    if (S.stage !== 'peel') return;
    const last = lastAng[src];
    lastAng[src] = a;
    if (last === undefined || last === null) return;
    const d = wrap(a - last);
    if (Math.abs(d) > 1.3) return;                    // teleport, not a stroke
    applyPeel(d, a);
  }
  function applyPeel(d, a) {
    if (S.stage !== 'peel') return;
    const m = Math.abs(d);
    if (m < 0.003) return;
    const dir = Math.sign(d);
    if (!S.streakDir) S.streakDir = dir;
    else if (dir !== S.streakDir) {
      S.rev += m;
      if (S.rev > STREAK_SLACK && !S.broken) { S.broken = true; flash = 1.2; }
    } else S.rev = Math.max(0, S.rev - m);
    S.curAng = a ?? S.curAng + d;
    S.peeled = Math.min(1, S.peeled + m / PEEL_NEED);
    S.mouth = 0.25;
    S.spawnAcc += m; S.soundAcc += m;
    while (S.spawnAcc > 0.4) { S.spawnAcc -= 0.4; spawnStrip(); }
    if (S.soundAcc > 1.1) { S.soundAcc = 0; snd('peel'); }
    if (S.peeled >= 1) { for (let i = 0; i < 6; i++) spawnStrip(); S.onePeel = !S.broken; goStage('slice'); }
  }
  function spawnStrip() {
    const a = S.curAng + rnd(-0.2, 0.2), cx = 320, cy = 215;
    const sp = rnd(110, 210);
    S.parts.push({ type: 'strip', x: cx + Math.cos(a) * 112, y: cy + Math.sin(a) * 92, vx: Math.cos(a) * sp + rnd(-30, 30), vy: Math.sin(a) * sp - rnd(80, 190), life: 1.1, max: 1.1, rot: rnd(0, 6), vr: rnd(-8, 8), r: rnd(9, 15), g: 520 });
  }

  function usePress(src) {
    if (!S || S.lock > 0) return;
    if (src === 'ptr' && S.stage === 'serve' && S.salt >= SALT_TAPS) return;   // slide is handled on release
    if (S.stage === 'slice') chop();
    else if (S.stage === 'serve') {
      if (S.sliding) return;
      if (S.salt < SALT_TAPS) saltTap(); else slide();
    } else if (S.stage === 'result' && S.stampT > 0.9) newPotato();
  }
  function chop() {
    if (S.falling || S.cuts.length >= 5) return;
    const open = S.lines.map((x, i) => ({ x, i })).filter(l => !S.cuts.some(k => k.line === l.i));
    let best = open[0];
    for (const l of open) if (Math.abs(l.x - S.knifeX) < Math.abs(best.x - S.knifeX)) best = l;
    const clean = Math.abs(best.x - S.knifeX) <= CHOP_TOL;
    if (clean) S.chops++;
    const cx = clean ? best.x : S.knifeX;
    S.cuts.push({ line: best.i, x: cx, clean, skew: clean ? 0 : (Math.random() < 0.5 ? -1 : 1) * rnd(0.22, 0.4) });
    S.drop = 0.18; snd('chop');
    for (let i = 0; i < 7; i++) S.parts.push({ type: 'chip', x: cx, y: 205, vx: rnd(-130, 130), vy: rnd(-220, -60), life: 0.6, max: 0.6, r: rnd(3, 6), g: 600, col: clean ? '#fff0b8' : '#f2c35a' });
    if (S.cuts.length >= 5) startFall();
  }
  function startFall() {
    const xs = [100, ...S.cuts.map(k => k.x).sort((a, b) => a - b), 540];
    const wonkyAt = x => S.cuts.find(k => k.x === x && !k.clean);
    S.pieces = [];
    for (let i = 0; i < 6; i++) {
      const w = xs[i + 1] - xs[i], mid = (xs[i] + xs[i + 1]) / 2;
      const wonky = !!(wonkyAt(xs[i]) || wonkyAt(xs[i + 1]));
      S.pieces.push({ x: mid, y: 205, w: Math.max(10, w - 6), vy: -rnd(0, 60), rot: 0, vr: wonky ? rnd(-3, 3) : 0, wonky, tx: 255 + i * 26 + rnd(-4, 4) });
    }
    S.falling = { t: 0 };
  }
  function saltTap() {
    S.salt++; S.shake = 0.35; snd('salt');
    for (let i = 0; i < 14; i++) S.parts.push({ type: 'salt', x: S.trayX + rnd(-12, 12), y: 130, vx: rnd(-25, 25), vy: rnd(40, 120), life: 0.7, max: 0.7, r: rnd(1.5, 3), g: 300 });
    for (let i = 0; i < 6; i++) S.specks.push({ x: rnd(-34, 34), y: rnd(-52, -20) });
  }
  function slide() { S.sliding = true; S.slideV = 120; snd('serve'); }
  function finishServe() {
    const wonkyHeavy = S.chops < 3;
    const g = S.fryQ;
    let q = g > FRY.burnt ? 'burnt' : (g >= FRY.goldLo && g <= FRY.goldHi ? 'perfect' : 'good');
    if (q === 'perfect' && wonkyHeavy) q = 'good';
    S.quality = q;
    S.joke = JOKES[q][Math.floor(Math.random() * JOKES[q].length)];
    S.secs = Math.round(S.t * 10) / 10;
    S.stage = 'result'; S.st = 0; S.stampT = 0; S.lock = 0;
    if (q === 'perfect') snd('ding');
    try { onServe && onServe({ quality: q, onePeel: S.onePeel, chops: S.chops, secs: S.secs }); } catch { /* host callback must not wedge the shed */ }
  }

  function setHeld(src, v) {
    const was = held[src];
    held[src] = v;
    if (v && !was) usePress(src);
    if (!v && was && src === 'ptr' && S && S.stage === 'serve' && S.lock <= 0 && ptrDownSalted && !S.sliding) slide();
  }

  function pointerPos(e) {
    if (!cv) return null;
    const r = cv.getBoundingClientRect();
    if (!r.width) return null;
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  function handlePointer(type, e) {
    if (!opened || !S) return;
    if (e && e.pointerType === 'touch') dev = 'touch'; else if (!document.body.classList.contains('pad')) dev = 'mouse';
    if (type === 'move') {
      const p = pointerPos(e);
      if (p && S.stage === 'peel') {
        const dx = p.x - 320, dy = p.y - 215;
        if (Math.hypot(dx, dy) > 40) feedAngle(Math.atan2(dy, dx), 'ptr'); else lastAng.ptr = null;
      }
    } else if (type === 'down') {
      ptrDownSalted = S.stage === 'serve' && S.salt >= SALT_TAPS;
      const p = pointerPos(e);
      if (S.stage === 'peel' && p) lastAng.ptr = Math.atan2(p.y - 215, p.x - 320);
      setHeld('ptr', true);
    } else if (type === 'up') {
      lastAng.ptr = null;
      setHeld('ptr', false);
    }
  }

  function handleKey(type, e) {
    if (!opened || !S || !e) return false;
    const k = e.code || e.key;
    const down = type === 'down';
    dev = 'key';
    if (down && (k === 'Escape' || e.key === 'Escape')) { close(); return true; }
    if (k === 'Space' || k === 'Enter' || e.key === ' ' || e.key === 'Enter') {
      if (down && e.repeat) return true;
      setHeld('key', down);
      return true;
    }
    if (down && !e.repeat && S.stage === 'peel' && (k === 'KeyA' || k === 'KeyD' || e.key === 'a' || e.key === 'd')) {
      const which = (k === 'KeyA' || e.key === 'a') ? 'a' : 'd';
      if (S.lastKey !== which) { S.lastKey = which; applyPeel(KEY_STEP, S.curAng + KEY_STEP); }
      return true;
    }
    return false;
  }

  function stepPad(pad, dt) {
    if (!opened || !S) return;
    if (!pad) { if (held.pad) setHeld('pad', false); lastAng.rs = lastAng.ls = null; return; }
    const down = pad.down || [], pressed = pad.pressed || [];
    if (pressed[1]) { close(); return; }
    dev = 'pad';
    const hold = !!(down[0] || down[7]);
    setHeld('pad', hold);
    // a stick flick also serves from the window
    if (S.stage === 'serve' && S.salt >= SALT_TAPS && !S.sliding && S.lock <= 0 && Math.abs(pad.rx || 0) > 0.8) slide();
    if (S.stage === 'peel') {
      for (const [src, x, y] of [['rs', pad.rx || 0, pad.ry || 0], ['ls', pad.lx || 0, pad.ly || 0]]) {
        if (Math.hypot(x, y) > 0.45) feedAngle(Math.atan2(y, x), src); else lastAng[src] = null;
      }
    }
  }

  // ---- simulation ------------------------------------------------------------------
  function tick(dt) {
    if (!opened || !S) return;
    dt = clamp(dt || 0, 0, 0.05);
    S.t += dt; S.st += dt; S.lock = Math.max(0, S.lock - dt);
    flash = Math.max(0, flash - dt);
    S.mouth = Math.max(0, S.mouth - dt);
    S.drop = Math.max(0, S.drop - dt);
    S.shake = Math.max(0, S.shake - dt);

    if (S.stage === 'slice') {
      if (!S.falling) {
        S.knifeX += S.knifeDir * KNIFE_SPEED * dt;
        if (S.knifeX > 540) { S.knifeX = 540; S.knifeDir = -1; }
        if (S.knifeX < 100) { S.knifeX = 100; S.knifeDir = 1; }
      } else {
        S.falling.t += dt;
        for (const p of S.pieces) {
          p.vy += 900 * dt; p.y += p.vy * dt; p.x += (p.tx - p.x) * Math.min(1, dt * 6); p.rot += p.vr * dt;
          if (p.y > 318) { p.y = 318; p.vy = 0; p.vr *= 0.8; }
        }
        if (S.falling.t > 1.0) goStage('fry');
      }
    } else if (S.stage === 'fry') {
      if (!isHeld()) S.needRelease = false;
      const lowering = !S.fryDone && isHeld() && !S.needRelease && S.lock <= 0;
      S.d = clamp(S.d + (lowering ? dt / 0.45 : -dt / 0.35), 0, 1);
      const now = S.d > 0.6;
      if (now !== S.sizzle) { S.sizzle = now; snd(now ? 'sizzle-on' : 'sizzle-off'); }
      if (now && !S.fryDone) {
        S.g = Math.min(FRY.max, S.g + dt * FRY.rate * (0.6 + 0.4 * S.d));
        if (S.g >= FRY.goldLo && !S.dinged) { S.dinged = true; snd('ding'); }
        if (S.g >= FRY.max) { S.fryDone = true; S.fryQ = S.g; }
      }
      if (S.d < 0.45 && S.dinged && S.g < FRY.goldLo) S.dinged = false;
      if (now && Math.random() < dt * 40) S.parts.push({ type: 'bubble', x: rnd(150, 490), y: 400 - rnd(0, 40), vx: rnd(-8, 8), vy: -rnd(60, 130), life: rnd(0.5, 1), max: 1, r: rnd(3, 8), g: 0 });
      // releasing with enough colour on it: that is the fry, lift it
      if (!S.fryDone && S.d > 0.6 && !isHeld() && !S.needRelease) {
        if (S.g >= FRY.pale) { S.fryDone = true; S.fryQ = S.g; }
        else S.tooPale = 1.6;
      }
      S.tooPale = Math.max(0, S.tooPale - dt);
      if (S.fryDone && S.d <= 0.01) goStage('serve');
    } else if (S.stage === 'serve') {
      if (S.sliding) {
        S.slideV += 1600 * dt; S.trayX += S.slideV * dt;
        if (S.trayX > 760) finishServe();
      }
    } else if (S.stage === 'result') {
      S.stampT += dt;
      if (S.stampT > 3.2) newPotato();
    }

    for (const p of S.parts) {
      p.life -= dt; p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      p.vy += (p.g || 0) * dt; if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
    }
    S.parts = S.parts.filter(p => p.life > 0 && !(p.type === 'bubble' && p.y < 250));
    if (S.parts.length > 300) S.parts.splice(0, S.parts.length - 300);

    draw();
  }

  // ---- drawing ---------------------------------------------------------------------
  function hint() {
    const padOn = (typeof document !== 'undefined' && document.body && document.body.classList.contains('pad')) || dev === 'pad';
    const d = padOn ? 'pad' : dev;
    const use = d === 'pad' ? 'Ⓐ' : d === 'touch' ? 'Tap' : 'Space or click';
    const leave = d === 'pad' ? 'Ⓑ to leave' : 'Esc to leave';
    switch (S.stage) {
      case 'peel':
        return d === 'pad' ? 'Circle the right stick to peel' : d === 'touch' ? 'Circle your finger around the potato'
          : d === 'key' ? 'Tap A and D, one then the other, to peel' : 'Circle the mouse around the potato (or tap A and D)';
      case 'slice': return `Press ${use} as the knife crosses a dashed line`;
      case 'fry': return S.tooPale > 0 ? 'Too pale. Lower it again.' : `${d === 'pad' ? 'Hold Ⓐ' : d === 'touch' ? 'Hold your finger down' : 'Hold Space or click'} to lower the basket. Let go when golden.`;
      case 'serve': return S.salt < SALT_TAPS ? `${use === 'Tap' ? 'Tap' : 'Press ' + use} to shake the salt (${S.salt}/${SALT_TAPS})`
        : `${d === 'touch' ? 'Flick' : d === 'pad' ? 'Flick the stick or press Ⓐ' : 'Flick or press ' + use} to slide it out the window`;
      default: return `${use} for the next potato  ·  ${leave}`;
    }
  }

  function drawFries(x, y, g, n, spread, wonkyN = 0) {
    c.fillStyle = fryColour(g);
    c.strokeStyle = 'rgba(80,40,10,0.55)'; c.lineWidth = 1.5;
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5, wonky = i < wonkyN;
      c.save(); c.translate(x + t * spread, y);
      c.rotate(t * 0.5 + (wonky ? (i % 2 ? 0.35 : -0.3) : 0));
      const h = (wonky ? 38 : 52) + ((i * 7) % 9);
      rrect(c, -5, -h, 10, h, 3); c.fill(); c.stroke();
      c.restore();
    }
  }

  function drawBasket(x, y, g, withFries, wonkyN) {
    if (withFries) drawFries(x, y - 4, g, 9, 70, wonkyN);
    c.strokeStyle = '#c9ced6'; c.lineWidth = 4; c.fillStyle = 'rgba(200,206,214,0.18)';
    c.beginPath(); c.moveTo(x - 62, y - 30); c.lineTo(x - 48, y + 34); c.lineTo(x + 48, y + 34); c.lineTo(x + 62, y - 30); c.closePath(); c.fill(); c.stroke();
    c.lineWidth = 2;
    for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 22, y - 28); c.lineTo(x + i * 18, y + 33); c.stroke(); }
    c.beginPath(); c.moveTo(x - 56, y + 4); c.lineTo(x + 56, y + 4); c.stroke();
  }

  function drawEyes(cx, cy, look, mouth, p) {
    for (const s of [-1, 1]) {
      c.fillStyle = '#fff'; c.strokeStyle = '#4a2a10'; c.lineWidth = 3;
      c.beginPath(); c.arc(cx + s * 30, cy - 16, 17, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#222'; c.beginPath(); c.arc(cx + s * 30 + Math.cos(look) * 6, cy - 16 + Math.sin(look) * 6, 7, 0, 7); c.fill();
    }
    c.strokeStyle = '#4a2a10'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath();
    if (mouth > 0) c.arc(cx, cy + 22, 9, 0, 7);
    else if (p > 0.85) c.arc(cx, cy + 14, 16, 0.2, Math.PI - 0.2);
    else { c.moveTo(cx - 12, cy + 24); c.lineTo(cx + 12, cy + 24); }
    c.stroke();
  }

  function drawParts() {
    for (const p of S.parts) {
      const a = clamp(p.life / p.max, 0, 1);
      c.globalAlpha = Math.min(1, a * 1.6);
      if (p.type === 'strip') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.strokeStyle = '#c28a4a'; c.lineWidth = 5; c.lineCap = 'round';
        c.beginPath(); c.arc(0, 0, p.r, 0, Math.PI * 3.2); c.stroke();
        c.strokeStyle = '#8d5a28'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, p.r, 0.5, Math.PI * 2.2); c.stroke();
        c.restore();
      } else if (p.type === 'bubble') {
        c.strokeStyle = 'rgba(255,240,200,0.9)'; c.fillStyle = 'rgba(255,230,150,0.35)'; c.lineWidth = 2;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); c.stroke();
      } else {
        c.fillStyle = p.type === 'salt' ? '#fff' : p.col;
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill();
      }
    }
    c.globalAlpha = 1;
  }

  function drawPeel() {
    const cx = 320, cy = 215, p = S.peeled;
    // progress ring
    c.lineCap = 'round'; c.lineWidth = 12; c.strokeStyle = 'rgba(255,248,236,0.14)';
    c.beginPath(); c.arc(cx, cy, 142, 0, 7); c.stroke();
    const live = !S.broken && p > 0.04;
    c.save();
    if (live) { c.shadowColor = '#ffe08a'; c.shadowBlur = 14; }
    c.strokeStyle = live ? '#ffe08a' : ACCENT;
    c.beginPath(); c.arc(cx, cy, 142, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2); c.stroke();
    c.restore();
    // potato
    c.save();
    blob(c, cx, cy, 112, 92, S.seed); c.fillStyle = '#f4dd9a'; c.fill(); c.clip();
    c.fillStyle = '#a8723d'; c.beginPath(); c.moveTo(cx, cy);
    c.arc(cx, cy, 220, -Math.PI / 2 + p * Math.PI * 2, Math.PI * 1.5); c.closePath(); c.fill();
    c.fillStyle = 'rgba(70,40,15,0.35)';
    for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(cx + Math.cos(i * 2.4 + S.seed) * 70, cy + Math.sin(i * 1.7 + S.seed) * 55, 4, 0, 7); c.fill(); }
    c.restore();
    blob(c, cx, cy, 112, 92, S.seed); c.strokeStyle = '#6d4520'; c.lineWidth = 5; c.stroke();
    drawEyes(cx, cy + 4, S.curAng, S.mouth, p);
    // peeler on the rim
    const px = cx + Math.cos(S.curAng) * 128, py = cy + Math.sin(S.curAng) * 104;
    c.save(); c.translate(px, py); c.rotate(S.curAng + Math.PI / 2);
    c.fillStyle = '#d7dce3'; c.strokeStyle = '#555c68'; c.lineWidth = 3;
    rrect(c, -18, -8, 36, 16, 6); c.fill(); c.stroke();
    c.fillStyle = '#e0452f'; rrect(c, -7, 6, 14, 30, 6); c.fill(); c.stroke();
    c.restore();
    drawParts();
    if (live && p > 0.25) text(c, '✦ ONE PEEL', cx, 66, 22, '#ffe08a');
    else if (flash > 0) { c.globalAlpha = Math.min(1, flash); text(c, 'streak broken', cx, 66, 20, BAD); c.globalAlpha = 1; }
  }

  function drawSlice() {
    const cy = 205;
    // potato
    c.save(); blob(c, 320, cy, 222, 64, S.seed); c.fillStyle = '#f4dd9a'; c.fill();
    c.strokeStyle = '#c9a85a'; c.lineWidth = 5; c.stroke(); c.restore();
    // dashed guides
    c.lineWidth = 3; c.setLineDash([8, 7]); c.lineCap = 'butt';
    for (let i = 0; i < 5; i++) {
      if (S.cuts.some(k => k.line === i)) continue;
      c.strokeStyle = ACCENT; c.beginPath(); c.moveTo(S.lines[i], cy - 92); c.lineTo(S.lines[i], cy + 92); c.stroke();
    }
    c.setLineDash([]);
    // cuts
    for (const k of S.cuts) {
      c.save(); c.translate(k.x, cy); c.rotate(k.skew);
      c.strokeStyle = k.clean ? '#2a2238' : '#5a3418'; c.lineWidth = k.clean ? 6 : 9; c.lineCap = 'round';
      c.beginPath(); c.moveTo(0, -72); c.lineTo(0, 72); c.stroke(); c.restore();
    }
    if (!S.falling) {
      // knife
      const kx = S.knifeX, ky = 78 + S.drop * 280;
      c.save(); c.translate(kx, ky);
      c.fillStyle = '#e4e8ee'; c.strokeStyle = '#555c68'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-12, 0); c.lineTo(12, 0); c.lineTo(12, 100); c.lineTo(-12, 118); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#5a3418'; rrect(c, -12, -46, 24, 48, 6); c.fill(); c.stroke();
      c.restore();
    } else {
      drawBasket(320, 345, 0.1, false, 0);
      for (const p of S.pieces) {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.fillStyle = '#f6e3a1'; c.strokeStyle = '#c9a85a'; c.lineWidth = 2;
        rrect(c, -p.w / 2, -9, p.w, 18, 3); c.fill(); c.stroke(); c.restore();
      }
    }
    text(c, `${S.chops}/5 clean`, 320, 372, 20, DIM);
    drawParts();
  }

  function drawFry() {
    const oilY = 262, g = S.g;
    // pot
    c.fillStyle = '#3a3340'; rrect(c, 110, oilY - 14, 420, 142, 18); c.fill();
    const hot = S.sizzle ? 1 : 0;
    // basket handle and basket
    const by = lerp(96, oilY + 34, S.d);
    c.strokeStyle = '#c9ced6'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(320, by - 30); c.lineTo(320, 54); c.stroke();
    c.fillStyle = '#e0452f'; rrect(c, 296, 40, 48, 22, 8); c.fill();
    drawBasket(320, by, g, true, Math.max(0, 5 - S.chops));
    // oil (drawn over the basket so the lower part looks submerged)
    c.fillStyle = hot ? 'rgba(236,150,30,0.72)' : 'rgba(214,150,40,0.62)';
    rrect(c, 118, oilY, 404, 112, 12); c.fill();
    c.fillStyle = hot ? 'rgba(255,240,190,0.85)' : 'rgba(255,230,150,0.4)';
    c.fillRect(120, oilY - 3, 400, 6);
    if (hot) for (let i = 0; i < 9; i++) { c.beginPath(); c.arc(140 + ((i * 53 + S.t * 70) % 360), oilY, 4 + (i % 3) * 2, 0, 7); c.fill(); }
    drawParts();
    // doneness meter
    const mx = 566, my = 80, mh = 270, mw = 36, tot = FRY.max;
    const zones = [[0, FRY.pale, '#f6e3a1'], [FRY.pale, FRY.goldLo, '#f5cf70'], [FRY.goldLo, FRY.goldHi, '#f0b43c'], [FRY.goldHi, FRY.burnt, '#96581e'], [FRY.burnt, tot, '#2a1810']];
    for (const [a, b, col] of zones) { c.fillStyle = col; c.fillRect(mx, my + mh - (b / tot) * mh, mw, ((b - a) / tot) * mh); }
    c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(mx, my, mw, mh);
    const goldMid = my + mh - ((FRY.goldLo + FRY.goldHi) / 2 / tot) * mh;
    c.fillStyle = INK; c.font = `800 14px ${FONT}`; c.textAlign = 'right'; c.fillText('GOLDEN', mx - 8, goldMid);
    const ny = my + mh - (g / tot) * mh;
    c.fillStyle = g >= FRY.goldLo && g <= FRY.goldHi ? '#fff' : ACCENT;
    c.beginPath(); c.moveTo(mx - 4, ny); c.lineTo(mx - 24, ny - 12); c.lineTo(mx - 24, ny + 12); c.closePath(); c.fill();
    if (g > FRY.burnt) text(c, 'BURNING', mx - 70, ny, 18, BAD, 'right');
    else if (g >= FRY.goldLo && g <= FRY.goldHi && S.d > 0.6 && !S.fryDone) text(c, 'NOW!', mx - 70, ny - 16, 24, '#fff', 'right');
  }

  function drawServe() {
    // serving window
    c.fillStyle = '#241c33'; rrect(c, 372, 96, 236, 190, 10); c.fill();
    c.strokeStyle = ACCENT; c.lineWidth = 6; c.stroke();
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#fff8ec' : '#e0452f'; c.fillRect(366 + i * 41, 76, 41, 24); }
    text(c, 'NEXT!', 490, 190, 34, 'rgba(255,248,236,0.35)');
    // counter
    c.fillStyle = '#6b4a2a'; c.fillRect(0, 306, W, 14); c.fillStyle = '#4a3220'; c.fillRect(0, 320, W, 50);
    const tx = S.trayX;
    // fries + carton
    drawFries(tx, 300, S.fryQ ?? 0.6, 9, 60, Math.max(0, 5 - S.chops));
    c.fillStyle = '#f3efe6';
    for (const s of S.specks) { c.beginPath(); c.arc(tx + s.x, 300 + s.y, 2, 0, 7); c.fill(); }
    c.fillStyle = '#d94a3d'; c.strokeStyle = '#7d211a'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(tx - 52, 252); c.lineTo(tx + 52, 252); c.lineTo(tx + 38, 306); c.lineTo(tx - 38, 306); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff8ec'; c.fillRect(tx - 45, 268, 90, 14);
    text(c, 'FAIRWAY', tx, 275, 11, '#7d211a');
    // salt shaker
    if (S.salt < SALT_TAPS || S.shake > 0) {
      c.save(); c.translate(tx, 96); c.rotate(S.shake > 0 ? Math.sin(S.shake * 60) * 0.5 + 2.6 : 0.2);
      c.fillStyle = '#f3f6fa'; c.strokeStyle = '#69707c'; c.lineWidth = 3;
      rrect(c, -16, -28, 32, 50, 8); c.fill(); c.stroke();
      c.fillStyle = '#9aa2b0'; rrect(c, -14, -38, 28, 14, 6); c.fill(); c.stroke();
      c.restore();
    }
    for (let i = 0; i < SALT_TAPS; i++) {
      c.fillStyle = i < S.salt ? '#fff' : 'rgba(255,248,236,0.18)'; c.strokeStyle = DIM; c.lineWidth = 3;
      c.beginPath(); c.arc(300 + i * 40, 352, 12, 0, 7); c.fill(); c.stroke();
    }
    drawParts();
    if (S.salt >= SALT_TAPS && !S.sliding) {
      const a = 0.6 + 0.4 * Math.sin(S.t * 8);
      c.globalAlpha = a; text(c, 'SLIDE  →', 200, 130, 30, ACCENT); c.globalAlpha = 1;
    }
  }

  function drawResult() {
    const col = S.quality === 'perfect' ? ACCENT : S.quality === 'good' ? INK : BAD;
    const k = clamp(S.stampT / 0.25, 0, 1), ease = 1 + (1 - k) * 2.2;
    c.save(); c.translate(320, 190); c.rotate(-0.1); c.scale(ease, ease); c.globalAlpha = k;
    c.strokeStyle = col; c.lineWidth = 9; rrect(c, -230, -66, 460, 132, 14); c.stroke();
    c.lineWidth = 3; rrect(c, -218, -54, 436, 108, 10); c.stroke();
    text(c, LABEL[S.quality], 0, -4, 74, col);
    c.restore(); c.globalAlpha = 1;
    text(c, S.joke, 320, 300, 22, INK, 'center', 580);
    const bits = [];
    if (S.onePeel) bits.push('✦ ONE PEEL');
    bits.push(`${S.chops}/5 clean chops`, `${S.secs.toFixed(1)} s`);
    text(c, bits.join('   ·   '), 320, 340, 20, S.onePeel ? '#ffe08a' : DIM);
  }

  function draw() {
    if (!c) return;
    c.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    c.clearRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(46,38,66,0.96)'); g.addColorStop(1, 'rgba(26,20,38,0.98)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // step label and pips
    const idx = Math.max(0, STEPS.indexOf(S.stage === 'result' ? 'SERVE' : S.stage.toUpperCase()));
    text(c, `${idx + 1}  ${S.stage === 'result' ? 'SERVED' : STEPS[idx]}`, 22, 34, 36, ACCENT, 'left');
    for (let i = 0; i < 4; i++) {
      c.fillStyle = i < idx || S.stage === 'result' ? ACCENT : i === idx ? INK : 'rgba(255,248,236,0.2)';
      c.beginPath(); c.arc(496 + i * 30, 34, i === idx ? 10 : 8, 0, 7); c.fill();
    }
    if (S.stage === 'peel') drawPeel();
    else if (S.stage === 'slice') drawSlice();
    else if (S.stage === 'fry') drawFry();
    else if (S.stage === 'serve') drawServe();
    else drawResult();
    // hint
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.fillRect(0, H - 40, W, 40);
    text(c, hint(), 320, H - 20, 19, DIM, 'center', 610);
  }

  // ---- overlay -----------------------------------------------------------------------
  function build() {
    built = true;
    wrapEl = document.createElement('div');
    wrapEl.className = 'kitchen-overlay';
    wrapEl.style.cssText = 'position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(10,8,20,0.55);z-index:60;touch-action:none;user-select:none;-webkit-user-select:none';
    cv = document.createElement('canvas');
    cv.width = W * 2; cv.height = H * 2;
    cv.style.cssText = `width:min(94vw,${Math.round((90 * W) / H)}vh);aspect-ratio:${W}/${H};height:auto;border:4px solid var(--accent,${ACCENT});border-radius:20px;background:var(--panel,rgba(28,22,40,0.82));box-shadow:0 12px 40px #000a;touch-action:none;cursor:crosshair`;
    c = cv.getContext('2d');
    wrapEl.appendChild(cv);
    (root || document.body).appendChild(wrapEl);
  }

  function open() {
    if (!built) build();
    opened = true;
    wrapEl.style.display = 'flex';
    held.key = held.ptr = held.pad = false;
    ptrDownSalted = false;
    newPotato();
    draw();
  }
  function close() {
    if (!opened) return;
    opened = false;
    if (wrapEl) wrapEl.style.display = 'none';
    held.key = held.ptr = held.pad = false;
  }

  return {
    open, close,
    get isOpen() { return opened; },
    handlePointer, handleKey, stepPad, tick,
  };
}
