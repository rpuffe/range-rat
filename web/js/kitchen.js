// Range Rat snack shed: the three-item order minigame (fries, hot dog, beer).
//
// A menu card picks the order, then a few steps on a 2D canvas inside a DOM overlay:
//   FRIES   PEEL a potato, SLICE it, FRY it, SERVE it.
//   HOT DOG GRILL the sausage (roll it to brown 4 sides), BUN it, MUSTARD it, SERVE it.
//   BEER    TILT and POUR to the line with a 1-2 cm head, SERVE it.
// main.js feeds it input (handlePointer / handleKey / stepPad) and a per-frame
// tick(dt); it reports a served order through
//   onServe({ item: 'fries'|'hotdog'|'beer', quality: 'perfect'|'good'|'burnt', onePeel, chops, secs })
// (onePeel and chops are fries-only: false and 0 for the others) and asks for
// sounds by name through onSound(name):
//   peel, chop, sizzle-on, sizzle-off, ding, salt, serve   (original)
//   grill, roll, squirt, pour, clink                        (hot dog and beer)
//
// No top-level DOM access: the overlay is built lazily on first open().

import { MENU_UNLOCK, menuPayoff } from './menu.js';
import { DECK, mugTone, MUG_CAPTION, tabFor } from './deck.js';
import { FRIES } from './sim.js';
const PAYOFF = '#7fe07f';   // council round 10 #2: the card's one payoff, in money

const W = 640, H = 420;
const INK = '#fff8ec', DIM = '#e8d6bd', ACCENT = '#ffb347', BAD = '#ff8a7a';
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const ITEMS = ['fries', 'hotdog', 'beer'];
const ITEM_LABEL = { fries: 'FRIES', hotdog: 'HOT DOG', beer: 'BEER' };
const STAGES = { fries: ['peel', 'slice', 'fry', 'serve'], hotdog: ['grill', 'bun', 'mustard', 'serve'], beer: ['pour', 'serve'] };
const NAMES = { fries: ['PEEL', 'SLICE', 'FRY', 'SERVE'], hotdog: ['GRILL', 'BUN', 'MUSTARD', 'SERVE'], beer: ['TILT', 'SERVE'] };
const CARD = { w: 180, h: 250, y: 80, x: i => 30 + i * 200 };

// tunables: fries
const PEEL_NEED = 2.5 * Math.PI * 2;     // radians of circling to strip a potato
const KEY_STEP = 0.95;                   // radians per alternating A/D press
const STREAK_SLACK = 0.5;                // radians of backwards motion tolerated before the streak breaks
const KNIFE_SPEED = 380;                 // px/s
const CHOP_TOL = 26;                     // px from the dashed line for a clean chop
const FRY = { pale: 0.4, goldLo: 0.55, goldHi: 0.82, burnt: 1.0, max: 1.25, rate: 0.22 };
const SALT_TAPS = 3;
// tunables: hot dog
const HD = { rate: 0.38, doneLo: 0.5, doneHi: 0.92, char: 1.0, max: 1.4 };   // underside browning per second; a side is done at doneLo, chars past char
const BUN = { speed: 340, lo: 90, hi: 550, perfect: 24, ok: 60 };            // px/s, travel, px from the sausage for each grade
const MUS = { x0: 185, x1: 455, y0: 206, y1: 252, cols: 14, rows: 3, fill: 0.03, glop: 0.6, max: 5.5, min: 0.35, speed: 300 };
const DOG = { x: 320, y: 232, len: 270, r: 26 };
// tunables: beer (glass is 14 cm tall, so 1 cm of head = 1/14)
const BEER = { tilt0: 0.7, tiltMax: 0.8, ease: 0.13, lineLo: 0.74, lineHi: 0.86, headLo: 1 / 14, headHi: 2 / 14, over: 1.02, minStop: 0.6, settle: 0.008, cm: 14 };

const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

const JOKES = {
  fries: {
    perfect: ['Compliant with all known fry standards.', 'Dimples has approved this. Dimples approves nothing.', 'Synergy, but make it crispy.'],
    good: ['Edible. Fairway Holdings notes it as "edible".', 'Meets expectations. Exceeds nothing.', 'A solid B-minus of a fry.'],
    burnt: ['Corporate has noted the smell.', 'An incident report has been filed. In triplicate.', 'This fry has been put on a performance plan.'],
  },
  hotdog: {
    perfect: ['Fairway Holdings classifies this as a sandwich.', 'Four sides, fully actualised.', 'Mustard coverage within tolerance.'],
    good: ['Fairway Holdings classifies this as a sandwich.', 'Technically a hot dog. Technically.', 'Meets the definition of "handheld".'],
    burnt: ['Charred beyond classification.', 'The sausage has been escalated to Facilities.', 'Smoke detector has filed a grievance.'],
  },
  beer: {
    perfect: ['Your pour has been logged.', 'Head within regulation tolerance. Your pour has been logged.', 'A textbook meniscus. Noted.'],
    good: ['Your pour has been logged.', 'Adequate. Foam is a state of mind.', 'The glass is neither half full nor half empty. Logged.'],
    burnt: ['A foam incident has been recorded.', 'Facilities has been notified of the puddle.', 'Spilled beer is not a covered expense.'],
  },
};
const LABEL = {
  fries: { perfect: 'PERFECT ✦', good: 'GOOD', burnt: 'BURNT' },
  hotdog: { perfect: 'PERFECT ✦', good: 'GOOD', burnt: 'CHARRED' },
  beer: { perfect: 'PERFECT ✦', good: 'GOOD', burnt: 'FOAM-OVER' },
};
const RESPONSIBLY = 'Corporate reminds you to serve responsibly.';

const mix = (c1, c2, t) => c1.map((v, i) => Math.round(lerp(v, c2[i], clamp(t, 0, 1))));
const COL_PALE = [246, 227, 161], COL_GOLD = [240, 180, 60], COL_BROWN = [150, 88, 30], COL_BURNT = [40, 24, 16];
const COL_PINK = [232, 128, 120], COL_SBR = [168, 86, 40], COL_SDK = [104, 50, 22], COL_SCH = [30, 20, 16];
function fryColour(g) {
  let c;
  if (g < FRY.goldLo) c = mix(COL_PALE, COL_GOLD, g / FRY.goldLo);
  else if (g < FRY.burnt) c = mix(COL_GOLD, COL_BROWN, (g - FRY.goldLo) / (FRY.burnt - FRY.goldLo));
  else c = mix(COL_BROWN, COL_BURNT, (g - FRY.burnt) / (FRY.max - FRY.burnt));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function sausColour(b) {
  let c;
  if (b < 0.55) c = mix(COL_PINK, COL_SBR, b / 0.55);
  else if (b < HD.char) c = mix(COL_SBR, COL_SDK, (b - 0.55) / (HD.char - 0.55));
  else c = mix(COL_SDK, COL_SCH, (b - HD.char) / (HD.max - HD.char));
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

export function createKitchen({ root, onServe, onSound, state } = {}) {
  let opened = false, built = false;
  let wrapEl = null, cv = null, c = null;
  let S = null;                  // state of the current order (or the menu card)
  let dev = 'mouse';             // last input kind: mouse | touch | key | pad
  const held = { key: false, ptr: false, pad: false };
  const lastAng = {};            // peel angle trackers per source
  const kv = { l: false, r: false, u: false, d: false };   // direction keys (mustard nozzle, tilt)
  const pv = { x: 0, y: 0 };     // left stick (mustard nozzle, tilt)
  let padNav = 0;                // menu stick edge detector
  let ptrDownSalted = false;
  let flash = 0;                 // streak-broken flash timer
  let lastItem = 'fries', menuSel = 0, ordered = false;   // remembered pick
  let menu = ITEMS.slice();      // unlocked items (open({menu})); the rest show as COMING SOON cards
  const isOpen = it => menu.includes(it);

  const snd = n => { try { onSound && onSound(n); } catch { /* sound must never break the shed */ } };
  const isHeld = () => held.key || held.ptr || held.pad;

  // ---- order lifecycle -----------------------------------------------------------
  function base(item) {
    return {
      item, stage: 'menu', t: 0, st: 0, lock: 0.35, seed: Math.random() * 6, parts: [],
      trayX: 200, sliding: false, slideV: 0, needRelease: false,
      quality: null, joke: '', onePeel: false, chops: 0, secs: 0, stampT: 0,
    };
  }
  function resetInputs() {
    for (const k in lastAng) delete lastAng[k];
    flash = 0; padNav = 0; pv.x = pv.y = 0;
  }
  function openMenu() {
    S = base(null);
    if (!isOpen(lastItem)) lastItem = menu[0] ?? 'fries';
    menuSel = Math.max(0, ITEMS.indexOf(lastItem));
    resetInputs();
  }
  function startItem(item) {
    lastItem = item; ordered = true; menuSel = ITEMS.indexOf(item);
    if (item === 'hotdog') newHotdog(); else if (item === 'beer') newBeer(); else newPotato();
    S.lock = 0.35;
    resetInputs();
    if (item === 'hotdog') snd('grill');
  }
  function newPotato() {
    S = Object.assign(base('fries'), {
      stage: 'peel', lock: 0.3,
      // peel
      peeled: 0, curAng: -Math.PI / 2, streakDir: 0, rev: 0, broken: false, spawnAcc: 0, soundAcc: 0, lastKey: '', mouth: 0,
      // slice
      knifeX: 100, knifeDir: 1, drop: 0, cuts: [], lines: [], falling: null, pieces: [],
      // fry
      d: 0, g: 0, sizzle: false, dinged: false, fryDone: false, fryQ: null, tooPale: 0,
      // serve
      salt: 0, shake: 0, specks: [],
    });
    for (let i = 0; i < 5; i++) S.lines.push(130 + ((i + 1) * 380) / 6);
  }
  function newHotdog() {
    S = Object.assign(base('hotdog'), {
      stage: 'grill',
      // grill
      face: 0, side: [0, 0, 0, 0], rollA: 0, steamAcc: 0,
      // bun
      bunX: BUN.lo, bunDir: 1, bunPlaced: false, bunErr: 999, bunSettle: 0,
      // mustard
      nx: DOG.x, ny: DOG.y, px: DOG.x, py: DOG.y, dots: [], cells: new Array(MUS.cols * MUS.rows).fill(0),
      squirtT: 0, wasted: 0, sqSnd: 0, wasSq: false, mustDone: false,
      // result
      sidesOk: 0, charCnt: 0, cov: 0, glopFrac: 0,
    });
  }
  function newBeer() {
    S = Object.assign(base('beer'), {
      stage: 'pour', tilt: BEER.tilt0, flow: 0, liq: 0, foam: 0, wasPour: false, finished: false, over: false, endT: 0, pSnd: 0,
      fin: null,
    });
  }
  function goStage(name) {
    S.stage = name; S.st = 0; S.lock = 0.35;
    if (name === 'fry' || name === 'mustard' || name === 'pour') S.needRelease = isHeld();
    if (name === 'serve' && S.item === 'fries') S.salt = 0;
    if (name === 'grill') snd('grill');
  }
  const serveReady = () => S.stage === 'serve' && !S.sliding && (S.item !== 'fries' || S.salt >= SALT_TAPS);

  // ---- menu ------------------------------------------------------------------------
  function menuNav(dir) {
    if (!S) return;
    if (S.stage === 'menu') { for (let i = 0; i < ITEMS.length; i++) { menuSel = (menuSel + dir + ITEMS.length) % ITEMS.length; if (isOpen(ITEMS[menuSel])) break; } }
    else if (S.stage === 'result' && S.stampT > 0.6) openMenu();
  }
  function cardAt(p) {
    if (!p) return -1;
    for (let i = 0; i < ITEMS.length; i++) {
      const x = CARD.x(i);
      if (p.x >= x && p.x <= x + CARD.w && p.y >= CARD.y && p.y <= CARD.y + CARD.h) return i;
    }
    return -1;
  }

  // ---- fries input ------------------------------------------------------------------
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

  // The use button (Space / click / tap / Ⓐ), by edge.
  function usePress(src) {
    if (!S || S.lock > 0) return;
    if (S.stage === 'menu') { if (isOpen(ITEMS[menuSel])) startItem(ITEMS[menuSel]); return; }
    if (S.stage === 'result') { if (S.stampT > 0.9) startItem(S.item); return; }   // same again
    if (S.item === 'fries') {
      if (src === 'ptr' && S.stage === 'serve' && S.salt >= SALT_TAPS) return;   // slide is handled on release
      if (S.stage === 'slice') chop();
      else if (S.stage === 'serve') {
        if (S.sliding) return;
        if (S.salt < SALT_TAPS) saltTap(); else slide();
      }
    } else if (S.item === 'hotdog') {
      if (S.stage === 'grill') roll();
      else if (S.stage === 'bun') placeBun();
      else if (S.stage === 'serve' && !S.sliding) slide();
    } else if (S.item === 'beer') {
      if (S.stage === 'serve' && !S.sliding) slide();
    }
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

  // ---- hot dog input -------------------------------------------------------------------
  function roll() {
    S.face = (S.face + 1) % 4; snd('roll');
    for (let i = 0; i < 5; i++) S.parts.push({ type: 'chip', x: 320 + rnd(-120, 120), y: 262, vx: rnd(-40, 40), vy: -rnd(40, 110), life: 0.45, max: 0.45, r: rnd(2, 4), g: 300, col: 'rgba(255,255,255,0.6)' });
  }
  function placeBun() {
    if (S.bunPlaced) return;
    S.bunPlaced = true; S.bunErr = Math.abs(S.bunX - DOG.x); S.bunSettle = 0; snd('clink');
  }
  function mustCov() { return S.cells.filter(v => v >= MUS.fill).length / S.cells.length; }
  function finishMustard() {
    S.mustDone = true; S.cov = mustCov();
    S.glopFrac = S.cells.filter(v => v >= MUS.glop).length / S.cells.length;
    goStage('serve');
  }

  // ---- serve + grading -----------------------------------------------------------------
  function slide() { S.sliding = true; S.slideV = 120; snd(S.item === 'beer' ? 'clink' : 'serve'); }
  function grade() {
    if (S.item === 'hotdog') {
      S.sidesOk = S.side.filter(v => v >= HD.doneLo && v <= HD.doneHi).length;
      S.charCnt = S.side.filter(v => v > HD.char).length;
      if (S.charCnt > 0) return 'burnt';
      return S.sidesOk >= 3 && S.bunErr <= BUN.ok && S.cov >= 0.55 && S.glopFrac <= 0.1 && S.wasted <= 1.2 ? 'perfect' : 'good';
    }
    if (S.item === 'beer') {
      if (S.over) return 'burnt';
      const { liq, foam } = S.fin;
      const liqOk = liq >= BEER.lineLo && liq <= BEER.lineHi, headOk = foam >= BEER.headLo && foam <= BEER.headHi;
      return liqOk && headOk ? 'perfect' : 'good';
    }
    const g = S.fryQ;
    let q = g > FRY.burnt ? 'burnt' : (g >= FRY.goldLo && g <= FRY.goldHi ? 'perfect' : 'good');
    if (q === 'perfect' && S.chops < 3) q = 'good';
    return q;
  }
  function finishServe() {
    const q = grade();
    S.quality = q;
    S.joke = pick(JOKES[S.item][q]);
    S.secs = Math.round(S.t * 10) / 10;
    S.stage = 'result'; S.st = 0; S.stampT = 0; S.lock = 0;
    // Playthrough 5 B12: the SERVED card says what the serve paid. The server's 'served' float replaces this guess
    // (payoff()); beer's is the live tab from the menu card.
    S.payoff = q === 'burnt' ? null : S.item === 'beer' ? payoffFor('beer') : null;
    if (q === 'perfect') snd('ding');
    const fries = S.item === 'fries';
    try { onServe && onServe({ item: S.item, quality: q, onePeel: fries ? S.onePeel : false, chops: fries ? S.chops : 0, secs: S.secs }); } catch { /* host callback must not wedge the shed */ }
  }

  function setHeld(src, v) {
    const was = held[src];
    held[src] = v;
    if (v && !was) usePress(src);
    if (!v && was && src === 'ptr' && S && S.item === 'fries' && S.stage === 'serve' && S.lock <= 0 && ptrDownSalted && !S.sliding) slide();
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
    const p = pointerPos(e);
    if (S.stage === 'menu') {
      const i = cardAt(p);
      if (type === 'move' && i >= 0) { if (isOpen(ITEMS[i])) menuSel = i; }
      else if (type === 'down' && i >= 0 && S.lock <= 0 && isOpen(ITEMS[i])) { menuSel = i; startItem(ITEMS[i]); }
      return;                                           // a click on the menu never counts as a held button
    }
    if (type === 'move') {
      if (p && S.stage === 'peel') {
        const dx = p.x - 320, dy = p.y - 215;
        if (Math.hypot(dx, dy) > 40) feedAngle(Math.atan2(dy, dx), 'ptr'); else lastAng.ptr = null;
      } else if (p && S.stage === 'mustard') {
        S.nx = clamp(p.x, 120, 520); S.ny = clamp(p.y, 150, 330);
      }
    } else if (type === 'down') {
      ptrDownSalted = S.item === 'fries' && S.stage === 'serve' && S.salt >= SALT_TAPS;
      if (S.stage === 'peel' && p) lastAng.ptr = Math.atan2(p.y - 215, p.x - 320);
      if (S.stage === 'mustard' && p) { S.nx = clamp(p.x, 120, 520); S.ny = clamp(p.y, 150, 330); }
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
    const L = k === 'ArrowLeft' || k === 'KeyA' || e.key === 'ArrowLeft' || e.key === 'a', R = k === 'ArrowRight' || k === 'KeyD' || e.key === 'ArrowRight' || e.key === 'd';
    const U = k === 'ArrowUp' || k === 'KeyW' || e.key === 'ArrowUp', D = k === 'ArrowDown' || k === 'KeyS' || e.key === 'ArrowDown';
    const lowAD = e.key === 'a' || e.key === 'd';
    if (!(L || R || U || D || lowAD)) return false;
    if (L) kv.l = down; if (R) kv.r = down; if (U) kv.u = down; if (D) kv.d = down;
    if ((L || R) && (S.stage === 'menu' || S.stage === 'result')) {
      if (down && !e.repeat) menuNav(R ? 1 : -1);
      return true;
    }
    if (down && !e.repeat && S.stage === 'peel' && (L || R) && (k === 'KeyA' || k === 'KeyD' || e.key === 'a' || e.key === 'd')) {
      const which = L ? 'a' : 'd';
      if (S.lastKey !== which) { S.lastKey = which; applyPeel(KEY_STEP, S.curAng + KEY_STEP); }
      return true;
    }
    return S.stage === 'mustard' || S.stage === 'pour' || (S.stage === 'peel' && (k === 'KeyA' || k === 'KeyD'));
  }

  function stepPad(pad, dt) {
    if (!opened || !S) return;
    if (!pad) { if (held.pad) setHeld('pad', false); lastAng.rs = lastAng.ls = null; padNav = 0; pv.x = pv.y = 0; return; }
    const down = pad.down || [], pressed = pad.pressed || [];
    if (pressed[1]) { close(); return; }
    dev = 'pad';
    // menu navigation: D-pad edge or left-stick flick
    const sx = pad.lx || 0, dirNow = sx > 0.6 ? 1 : sx < -0.6 ? -1 : 0;
    let nav = (pressed[15] ? 1 : 0) - (pressed[14] ? 1 : 0);
    if (!nav && dirNow && dirNow !== padNav) nav = dirNow;
    padNav = dirNow;
    if (nav) menuNav(nav);
    const hold = !!(down[0] || down[7]);
    setHeld('pad', hold);
    const lx = pad.lx || 0, ly = pad.ly || 0;
    pv.x = Math.abs(lx) > 0.2 ? lx : 0; pv.y = Math.abs(ly) > 0.2 ? ly : 0;
    // a stick flick also serves from the window
    if (serveReady() && S.lock <= 0 && Math.abs(pad.rx || 0) > 0.8) slide();
    if (S.stage === 'peel') {
      for (const [src, x, y] of [['rs', pad.rx || 0, pad.ry || 0], ['ls', lx, ly]]) {
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
    if (S.mouth !== undefined) S.mouth = Math.max(0, S.mouth - dt);
    if (S.drop !== undefined) S.drop = Math.max(0, S.drop - dt);
    if (S.shake !== undefined) S.shake = Math.max(0, S.shake - dt);

    if (S.stage === 'result') {
      S.stampT += dt;
      if (S.stampT > 3.2) openMenu();
    } else if (S.item === 'fries') tickFries(dt);
    else if (S.item === 'hotdog') tickHotdog(dt);
    else if (S.item === 'beer') tickBeer(dt);
    if (S.stage === 'serve' && S.sliding) {
      S.slideV += 1600 * dt; S.trayX += S.slideV * dt;
      if (S.trayX > 760) finishServe();
    }

    for (const p of S.parts) {
      p.life -= dt; p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
      p.vy += (p.g || 0) * dt; if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
    }
    S.parts = S.parts.filter(p => p.life > 0 && !(p.type === 'bubble' && p.y < 250));
    if (S.parts.length > 300) S.parts.splice(0, S.parts.length - 300);

    draw();
  }

  function tickFries(dt) {
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
    }
  }

  function tickHotdog(dt) {
    if (S.stage === 'grill') {
      S.rollA += (S.face * Math.PI / 2 - S.rollA) * Math.min(1, dt * 14);
      const b = S.side[S.face], nb = Math.min(HD.max, b + dt * HD.rate);
      S.side[S.face] = nb;
      if (b < HD.doneLo && nb >= HD.doneLo) snd('grill');
      S.steamAcc += dt;
      if (S.steamAcc > 0.06) {
        S.steamAcc = 0;
        const smoky = nb > HD.char;
        S.parts.push({ type: 'chip', x: 320 + rnd(-140, 140), y: 258, vx: rnd(-10, 10), vy: -rnd(40, 90), life: 0.9, max: 0.9, r: rnd(4, 9), g: 0, col: smoky ? 'rgba(60,55,60,0.7)' : 'rgba(255,255,255,0.4)' });
      }
      if (S.side.every(v => v >= HD.doneLo)) goStage('bun');
    } else if (S.stage === 'bun') {
      if (!S.bunPlaced) {
        S.bunX += S.bunDir * BUN.speed * dt;
        if (S.bunX > BUN.hi) { S.bunX = BUN.hi; S.bunDir = -1; }
        if (S.bunX < BUN.lo) { S.bunX = BUN.lo; S.bunDir = 1; }
      } else {
        S.bunSettle += dt;
        if (S.bunSettle > 0.7) goStage('mustard');
      }
    } else if (S.stage === 'mustard') {
      if (!isHeld()) S.needRelease = false;
      let vx = (kv.r ? 1 : 0) - (kv.l ? 1 : 0) + pv.x, vy = (kv.d ? 1 : 0) - (kv.u ? 1 : 0) + pv.y;
      const m = Math.hypot(vx, vy);
      if (m > 1) { vx /= m; vy /= m; }
      if (m > 0.05) { S.nx = clamp(S.nx + vx * MUS.speed * dt, 120, 520); S.ny = clamp(S.ny + vy * MUS.speed * dt, 150, 330); }
      const sq = isHeld() && !S.needRelease && S.lock <= 0 && !S.mustDone;
      if (sq) {
        S.wasSq = true; S.squirtT += dt;
        if ((S.sqSnd -= dt) <= 0) { S.sqSnd = 0.2; snd('squirt'); }
        // sweep the segment since last frame so fast strokes still count every cell they cross
        const dist = Math.hypot(S.nx - S.px, S.ny - S.py), steps = Math.max(1, Math.ceil(dist / 6));
        for (let k = 1; k <= steps; k++) {
          const x = lerp(S.px, S.nx, k / steps), y = lerp(S.py, S.ny, k / steps);
          const inside = x >= MUS.x0 && x <= MUS.x1 && y >= MUS.y0 && y <= MUS.y1;
          if (inside) {
            const ci = clamp(Math.floor((x - MUS.x0) / (MUS.x1 - MUS.x0) * MUS.cols), 0, MUS.cols - 1);
            const ri = clamp(Math.floor((y - MUS.y0) / (MUS.y1 - MUS.y0) * MUS.rows), 0, MUS.rows - 1);
            S.cells[ri * MUS.cols + ci] += dt / steps;
          } else S.wasted += dt / steps;
          const last = S.dots[S.dots.length - 1];
          if (!last || Math.hypot(last.x - x, last.y - y) >= 6) S.dots.push({ x, y, r: 3.5, off: !inside });
          else last.r = Math.min(12, last.r + (dt / steps) * 10);
        }
        if (S.dots.length > 500) S.dots.splice(0, S.dots.length - 500);
        if (S.squirtT >= MUS.max) finishMustard();
      } else if (S.wasSq && !isHeld()) {
        S.wasSq = false;
        if (mustCov() >= MUS.min) finishMustard();
      }
      S.px = S.nx; S.py = S.ny;
    }
  }

  function tickBeer(dt) {
    if (S.stage !== 'pour') return;
    if (!isHeld()) S.needRelease = false;
    const iy = ((kv.d ? 1 : 0) - (kv.u ? 1 : 0)) + pv.y;
    S.tilt = clamp(S.tilt + (Math.abs(iy) > 0.15 ? iy * 0.9 * dt : 0) - BEER.ease * dt, 0, BEER.tiltMax);
    const holding = isHeld() && !S.needRelease && S.lock <= 0 && !S.finished;
    S.flow += ((holding ? 1 : 0) - S.flow) * Math.min(1, dt * (holding ? 2.5 : 14));
    if (holding) S.wasPour = true;
    if (!S.finished) {
      if (S.flow > 0.02) {
        const rate = 0.38 * S.flow, u = 1 - S.tilt / BEER.tiltMax;
        const k = 0.04 + 0.62 * u * u * (0.3 + 0.7 * S.flow);   // upright and fast makes foam
        S.liq += rate * dt; S.foam += rate * dt * k;
        if ((S.pSnd -= dt) <= 0 && S.flow > 0.3) { S.pSnd = 0.35; snd('pour'); }
      }
      S.foam = Math.max(0, S.foam - BEER.settle * dt);
      if (S.liq + S.foam > BEER.over) {
        S.over = true; S.finished = true; S.endT = 0.8; snd('clink');
      } else if (!holding && S.wasPour && S.flow < 0.05 && S.liq >= BEER.minStop) {
        S.finished = true; S.endT = 0.55;
      }
    } else {
      S.endT -= dt;
      if (S.over && Math.random() < dt * 90) S.parts.push({ type: 'chip', x: 330 + rnd(-30, 30), y: 135, vx: rnd(-110, 110), vy: -rnd(20, 120), life: 1.0, max: 1.0, r: rnd(4, 9), g: 600, col: '#fff6dc' });
      if (S.endT <= 0) { S.fin = { liq: S.liq, foam: S.foam }; goStage('serve'); }
    }
  }

  // ---- drawing ---------------------------------------------------------------------
  function hint() {
    const padOn = (typeof document !== 'undefined' && document.body && document.body.classList.contains('pad')) || dev === 'pad';
    const d = padOn ? 'pad' : dev;
    const use = d === 'pad' ? 'Ⓐ' : d === 'touch' ? 'Tap' : 'Space or click';
    const leave = d === 'pad' ? 'Ⓑ to leave' : 'Esc to leave';
    if (S.stage === 'menu') return `${d === 'pad' ? 'D-pad or stick' : d === 'touch' ? 'Tap a card' : '← → or click'} to choose  ·  ${d === 'touch' ? 'tap again' : use} to order  ·  ${leave}`;
    if (S.stage === 'result') return `${use} for same again  ·  or wait for the menu  ·  ${leave}`;
    if (S.item === 'hotdog') {
      switch (S.stage) {
        case 'grill': return `Press ${use} to roll a quarter turn. Brown all four sides.`;
        case 'bun': return `Press ${use} when the bun is under the sausage`;
        case 'mustard': return S.wasSq || S.squirtT > 0 ? (S.cells && mustCov() < MUS.min ? 'More! Cover the sausage' : 'Release when covered. Do not overdo it.')
          : d === 'pad' ? 'Hold Ⓐ and wave the left stick to squiggle' : d === 'touch' ? 'Hold your finger down and drag to squiggle'
            : d === 'key' ? 'Hold Space and steer with the arrow keys' : 'Hold click (or Space) and move the mouse to squiggle';
        default: return `${use === 'Tap' ? 'Tap' : 'Press ' + use} to slide it out the window`;
      }
    }
    if (S.item === 'beer') {
      if (S.stage === 'pour') {
        if (S.over) return 'Foam-over!';
        if (!S.finished && S.liq > 0.05 && S.liq < BEER.minStop && S.flow < 0.05) return 'Top it up to the line';
        return d === 'pad' ? 'Hold Ⓐ to pour. Left stick up/down tilts the glass.' : d === 'touch' ? 'Hold your finger down to pour. Stop at the line.'
          : d === 'key' ? 'Hold Space to pour, ↑ ↓ tilts. Stop at the line.' : 'Hold Space or click to pour. Stop at the line.';
      }
      return `${use === 'Tap' ? 'Tap' : 'Press ' + use} to slide it across`;
    }
    switch (S.stage) {
      case 'peel':
        return d === 'pad' ? 'Circle the right stick to peel' : d === 'touch' ? 'Circle your finger around the potato'
          : d === 'key' ? 'Tap A and D, one then the other, to peel' : 'Circle the mouse around the potato (or tap A and D)';
      case 'slice': return `Press ${use} as the knife crosses a dashed line`;
      case 'fry': return S.tooPale > 0 ? 'Too pale. Lower it again.' : `${d === 'pad' ? 'Hold Ⓐ' : d === 'touch' ? 'Hold your finger down' : 'Hold Space or click'} to lower the basket. Let go when golden.`;
      default: return S.salt < SALT_TAPS ? `${use === 'Tap' ? 'Tap' : 'Press ' + use} to shake the salt (${S.salt}/${SALT_TAPS})`
        : `${d === 'touch' ? 'Flick' : d === 'pad' ? 'Flick the stick or press Ⓐ' : 'Flick or press ' + use} to slide it out the window`;
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

  function drawCarton(tx, top) {
    c.fillStyle = '#d94a3d'; c.strokeStyle = '#7d211a'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(tx - 52, top); c.lineTo(tx + 52, top); c.lineTo(tx + 38, top + 54); c.lineTo(tx - 38, top + 54); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff8ec'; c.fillRect(tx - 45, top + 16, 90, 14);
    text(c, 'FAIRWAY', tx, top + 23, 11, '#7d211a');
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

  // -- menu --
  function drawIcon(item, cx, cy) {
    c.save(); c.translate(cx, cy);
    if (item === 'fries') {
      drawFries(0, 22, 0.5, 7, 66);
      drawCarton(0, 18);
    } else if (item === 'hotdog') {
      c.fillStyle = '#e9b86c'; c.strokeStyle = '#9a6428'; c.lineWidth = 4;
      rrect(c, -78, 0, 156, 54, 24); c.fill(); c.stroke();
      c.fillStyle = sausColour(0.62); c.strokeStyle = '#5a2a14';
      rrect(c, -92, -20, 184, 36, 18); c.fill(); c.stroke();
      c.strokeStyle = '#f2c21b'; c.lineWidth = 5; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath();
      for (let i = 0; i <= 8; i++) { const x = -70 + i * 17.5, y = -2 + (i % 2 ? 10 : -10); if (i) c.lineTo(x, y); else c.moveTo(x, y); }
      c.stroke();
      c.fillStyle = '#f3c97e'; c.strokeStyle = '#9a6428'; c.lineWidth = 4;
      rrect(c, -78, 16, 156, 38, 18); c.fill(); c.stroke();
    } else {
      c.fillStyle = '#f0a81c'; c.strokeStyle = '#dff0ff'; c.lineWidth = 5;
      rrect(c, -40, -20, 80, 84, 10); c.fill(); c.stroke();
      c.strokeStyle = '#dff0ff'; c.lineWidth = 7; c.beginPath(); c.arc(44, 24, 24, -1.3, 1.3); c.stroke();
      c.fillStyle = '#fff6dc';
      for (const [x, y, r] of [[-28, -24, 16], [-8, -34, 18], [14, -30, 17], [32, -22, 14], [0, -20, 20]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-30, 4, 8, 50);
    }
    c.restore();
  }
  // The Upper Deck's mug meter (round 4): six mugs for the deck's Drinks. Amber at 4, red at 5 and up. Only where the
  // deck exists (the live snapshot carries s.mods.deck from Tiered on).
  function deckDrinks() { try { const m = state?.()?.mods?.deck; return m && Number.isFinite(m.drinks) ? m.drinks : null; } catch { return null; } }
  function drawMugs(cx, cy, n, size = 1) {
    const tone = mugTone(n), col = tone === 'cut' ? '#ff4a3d' : tone === 'loud' ? '#ffa31a' : '#ffe08a';
    const gap = 27 * size, x0 = cx - gap * (DECK.MAX - 1) / 2;
    for (let i = 0; i < DECK.MAX; i++) {
      const x = x0 + i * gap, full = i < n, w = 16 * size, h = 20 * size;
      c.save(); c.lineWidth = 2.5; c.strokeStyle = full ? col : 'rgba(255,248,236,0.35)';
      c.fillStyle = full ? col : 'rgba(255,248,236,0.06)';
      rrect(c, x - w / 2, cy - h / 2, w, h, 4); c.fill(); c.stroke();
      c.beginPath(); c.arc(x + w / 2, cy, h * 0.28, -Math.PI / 2, Math.PI / 2); c.stroke();     // the handle
      if (full) { c.fillStyle = '#fffaf0'; c.fillRect(x - w / 2 + 2, cy - h / 2 + 2, w - 4, 4 * size); }  // the head
      c.restore();
    }
  }
  // Council round 6 #6: a lounger's open order (seconds left, counted down locally between snapshots), or null.
  // Round 7 #8: deckOrderRound() says whether that order is a ROUND (two drinks, a 25 x BV tab).
  let ordSeen = null, ordAt = 0;
  function deckOrderRound() { try { return !!state?.()?.mods?.deck?.order?.round; } catch { return false; } }
  function deckOrderLeft() {
    let o = null; try { o = state?.()?.mods?.deck?.order ?? null; } catch { o = null; }
    if (!o || !Number.isFinite(o.left)) { ordSeen = null; return null; }
    if (o !== ordSeen) { ordSeen = o; ordAt = Date.now(); }
    return Math.max(0, o.left - (Date.now() - ordAt) / 1000);
  }
  // The order timer: a gold ring that empties over DECK.ORDER_OPEN seconds.
  function drawOrderRing(cx, cy, r, left) {
    const u = Math.max(0, Math.min(1, left / DECK.ORDER_OPEN));
    c.save(); c.lineCap = 'round'; c.lineWidth = 6;
    c.strokeStyle = 'rgba(255,248,236,0.18)'; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
    c.shadowColor = '#ffd34a'; c.shadowBlur = 10; c.strokeStyle = '#ffd34a';
    c.beginPath(); c.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + u * Math.PI * 2); c.stroke();
    c.restore();
  }
  // Council round 10 #2: "+$1.41 A BALL", "+5% EVERY BALL", "$2,900 TAB" from the live snapshot.
  function payoffFor(item) {
    try {
      const s = state?.(), v = s?.value;
      if (!v) return null;
      const order = s?.mods?.deck?.order ?? null;
      return menuPayoff(item, { v, stock: (v.fries ?? 0) * FRIES.MAX, fed: v.fed ?? 1, tab: tabFor(v.bv ?? 0, order ?? false) });
    } catch { return null; }
  }
  function deckCaption() { const n = deckDrinks(); return n == null ? '' : MUG_CAPTION[mugTone(n)]; }

  function drawMenu() {
    for (let i = 0; i < ITEMS.length; i++) {
      const x = CARD.x(i), locked = !isOpen(ITEMS[i]), sel = !locked && i === menuSel, cx = x + CARD.w / 2, bob = sel ? Math.sin(S.t * 5) * 3 : 0;
      c.save(); c.translate(cx, CARD.y + CARD.h / 2); const k = sel ? 1.05 : 1; c.scale(k, k); c.translate(-cx, -(CARD.y + CARD.h / 2));
      c.fillStyle = sel ? 'rgba(255,179,71,0.22)' : 'rgba(255,248,236,0.07)';
      c.strokeStyle = sel ? ACCENT : 'rgba(255,248,236,0.25)'; c.lineWidth = sel ? 7 : 3;
      rrect(c, x, CARD.y, CARD.w, CARD.h, 18); c.fill(); c.stroke();
      if (locked) c.globalAlpha = 0.28;
      drawIcon(ITEMS[i], cx, CARD.y + 112 + bob);
      if (!locked) text(c, ITEM_LABEL[ITEMS[i]], cx, CARD.y + 206, 34, sel ? ACCENT : INK, 'center', CARD.w - 16);
      if (locked) {
        c.globalAlpha = 1;
        c.fillStyle = 'rgba(20,16,30,0.55)'; rrect(c, x, CARD.y, CARD.w, CARD.h, 18); c.fill();
        text(c, 'COMING SOON', cx, CARD.y + 120, 24, ACCENT, 'center', CARD.w - 16);
        text(c, '— Corporate', cx, CARD.y + 146, 18, DIM, 'center', CARD.w - 16);
        text(c, ITEM_LABEL[ITEMS[i]], cx, CARD.y + 206, 34, DIM, 'center', CARD.w - 16);
        text(c, MENU_UNLOCK[ITEMS[i]] ?? '', cx, CARD.y + 232, 14, DIM, 'center', CARD.w - 12);
      } else {
        const pay = payoffFor(ITEMS[i]);
        if (pay) text(c, pay, cx, CARD.y + 234, 17, PAYOFF, 'center', CARD.w - 12);
        if (ordered && ITEMS[i] === lastItem && !(ITEMS[i] === 'beer' && deckOrderRound())) text(c, 'LAST ORDER', cx, CARD.y + 168, 14, DIM);
      }
      if (ITEMS[i] === 'beer' && !locked) { const n = deckDrinks(); if (n != null) drawMugs(cx, CARD.y + 30, n, 0.85); }
      if (ITEMS[i] === 'beer' && !locked) {                      // an open order: the BEER card glows gold, with its timer
        const left = deckOrderLeft();
        if (left != null) {
          c.save(); c.shadowColor = '#ffd34a'; c.shadowBlur = 22 + Math.sin(S.t * 6) * 8; c.strokeStyle = '#ffd34a'; c.lineWidth = 6;
          rrect(c, x, CARD.y, CARD.w, CARD.h, 18); c.stroke(); c.restore();
          drawOrderRing(x + CARD.w - 26, CARD.y + 66, 15, left);
          if (deckOrderRound()) {                                  // round 7 #8: a ROUND, in gold
            c.save(); c.shadowColor = '#ffd34a'; c.shadowBlur = 8;
            text(c, 'ROUND ×2', cx, CARD.y + 168, 22, '#ffd34a', 'center', CARD.w - 16);
            c.restore();
          }
        }
      }
      c.restore();
    }
  }

  // -- fries --
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

  // -- hot dog --
  // A sausage seen side-on: horizontal bands sample a rolling cylinder, so the browning of each side slides past as it rolls.
  function drawSausage(cx, cy, len, r, rollA, sides) {
    c.save();
    rrect(c, cx - len / 2, cy - r, len, 2 * r, r); c.clip();
    const n = 26;
    for (let i = 0; i < n; i++) {
      const y0 = -r + (i / n) * 2 * r, y1 = -r + ((i + 1) / n) * 2 * r, ym = (y0 + y1) / 2;
      const phi = Math.acos(clamp(ym / r, -1, 1));               // 0 = underside, PI = top
      const idx = (((Math.round((phi + rollA) / (Math.PI / 2))) % 4) + 4) % 4;
      c.fillStyle = sausColour(sides[idx]); c.fillRect(cx - len / 2, cy + y0, len, y1 - y0 + 0.8);
      c.fillStyle = `rgba(0,0,0,${0.32 * (1 - Math.sin(phi))})`; c.fillRect(cx - len / 2, cy + y0, len, y1 - y0 + 0.8);
    }
    c.fillStyle = 'rgba(255,255,255,0.22)'; c.fillRect(cx - len / 2 + r, cy - r * 0.55, len - 2 * r, 4);
    c.restore();
    c.strokeStyle = '#4a2010'; c.lineWidth = 4; rrect(c, cx - len / 2, cy - r, len, 2 * r, r); c.stroke();
  }
  function drawDog(withDots) {
    const bx = DOG.x, by = DOG.y + 12;
    c.fillStyle = '#e9b86c'; c.strokeStyle = '#9a6428'; c.lineWidth = 4;
    rrect(c, bx - 125, by, 250, 56, 26); c.fill(); c.stroke();
    drawSausage(DOG.x, DOG.y, DOG.len, DOG.r, S.rollA, S.side);
    c.fillStyle = '#f3c97e'; c.strokeStyle = '#9a6428'; c.lineWidth = 4;
    rrect(c, bx - 125, by + 8, 250, 48, 22); c.fill(); c.stroke();
    if (withDots) drawDots();
  }
  function drawDots() {
    for (const d of S.dots) {
      c.fillStyle = '#f2c21b'; c.strokeStyle = '#c28f08'; c.lineWidth = 1.5;
      c.beginPath(); c.arc(d.x, d.y, d.r, 0, 7); c.fill(); c.stroke();
    }
  }
  function drawGrill() {
    // pan and coals
    c.fillStyle = '#2c2a32'; rrect(c, 70, 270, 500, 78, 14); c.fill();
    const glow = 0.3 + 0.12 * Math.sin(S.t * 6);
    c.fillStyle = `rgba(255,90,30,${glow})`; rrect(c, 80, 296, 480, 44, 10); c.fill();
    c.strokeStyle = '#8b8f99'; c.lineWidth = 6; c.lineCap = 'round';
    for (let i = 0; i < 14; i++) { const x = 100 + i * 36; c.beginPath(); c.moveTo(x, 266); c.lineTo(x, 336); c.stroke(); }
    drawSausage(320, 238, 300, 30, S.rollA, S.side);
    drawParts();
    // the four sides
    const done = S.side.filter(v => v >= HD.doneLo).length;
    for (let i = 0; i < 4; i++) {
      const x = 206 + i * 64, v = S.side[i];
      c.fillStyle = sausColour(v); c.strokeStyle = i === S.face ? '#fff' : 'rgba(255,248,236,0.3)'; c.lineWidth = i === S.face ? 6 : 3;
      rrect(c, x, 68, 52, 44, 8); c.fill(); c.stroke();
      if (v > HD.char) text(c, '✕', x + 26, 90, 28, BAD);
      else if (v >= HD.doneLo) text(c, '✓', x + 26, 90, 28, v <= HD.doneHi ? '#fff' : '#ffd9a0');
    }
    text(c, `${done}/4 sides`, 320, 134, 22, DIM);
    // underside gauge
    const gx = 170, gy = 356, gw = 300, gh = 14, f = v => gx + (v / HD.max) * gw;
    for (const [a, b, col] of [[0, HD.doneLo, '#e88f86'], [HD.doneLo, HD.doneHi, '#5fbf6a'], [HD.doneHi, HD.char, '#8a4a22'], [HD.char, HD.max, '#241812']]) { c.fillStyle = col; c.fillRect(f(a), gy, f(b) - f(a), gh); }
    c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(gx, gy, gw, gh);
    text(c, 'UNDERSIDE', gx - 10, gy + 7, 15, DIM, 'right');
    const v = S.side[S.face];
    c.fillStyle = v > HD.char ? BAD : '#fff'; c.beginPath(); c.moveTo(f(v), gy - 2); c.lineTo(f(v) - 8, gy - 14); c.lineTo(f(v) + 8, gy - 14); c.closePath(); c.fill();
    if (v > HD.char) text(c, 'CHARRING', gx + gw + 14, gy + 7, 16, BAD, 'left');
    else if (v >= HD.doneLo && v <= HD.doneHi) text(c, 'ROLL!', gx + gw + 14, gy + 7, 18, '#fff', 'left');
  }
  function drawBunStage() {
    const by = 244, dropK = S.bunPlaced ? clamp(S.bunSettle / 0.25, 0, 1) : 0;
    // timing window
    c.fillStyle = 'rgba(255,179,71,0.18)'; c.fillRect(DOG.x - BUN.ok, 150, BUN.ok * 2, 190);
    c.fillStyle = 'rgba(95,191,106,0.30)'; c.fillRect(DOG.x - BUN.perfect, 150, BUN.perfect * 2, 190);
    c.setLineDash([8, 7]); c.strokeStyle = ACCENT; c.lineWidth = 3; c.beginPath(); c.moveTo(DOG.x, 150); c.lineTo(DOG.x, 340); c.stroke(); c.setLineDash([]);
    // bun (slides, then holds still)
    const bx = S.bunPlaced ? S.bunX : S.bunX;
    c.fillStyle = '#e9b86c'; c.strokeStyle = '#9a6428'; c.lineWidth = 4;
    rrect(c, bx - 125, by, 250, 56, 26); c.fill(); c.stroke();
    // sausage drops into the bun where it was caught
    const sx = lerp(DOG.x, bx, dropK), sy = lerp(130, DOG.y, dropK);
    drawSausage(sx, sy, DOG.len, DOG.r, S.rollA, S.side);
    c.fillStyle = '#f3c97e'; rrect(c, bx - 125, by + 8, 250, 48, 22); c.fill(); c.stroke();
    if (S.bunPlaced) {
      const w = S.bunErr <= BUN.perfect ? 'PERFECT' : S.bunErr <= BUN.ok ? 'GOOD' : 'SLOPPY';
      text(c, w, 320, 90, 34, S.bunErr <= BUN.ok ? '#fff' : BAD);
    }
    drawParts();
  }
  function drawMustardStage() {
    drawDog(true);
    // coverage meter
    const cov = mustCov(), mx = 160, my = 336, mw = 320;
    c.fillStyle = 'rgba(255,248,236,0.14)'; rrect(c, mx, my, mw, 14, 7); c.fill();
    c.fillStyle = cov >= 0.55 ? '#f2c21b' : '#c9a14a'; rrect(c, mx, my, Math.max(14, mw * cov), 14, 7); c.fill();
    c.strokeStyle = INK; c.lineWidth = 3; rrect(c, mx, my, mw, 14, 7); c.stroke();
    text(c, 'COVERAGE', mx - 10, my + 7, 15, DIM, 'right');
    const left = 1 - S.squirtT / MUS.max;
    text(c, left < 0.25 ? 'LOW!' : 'MUSTARD', mx + mw + 12, my + 7, 15, left < 0.25 ? BAD : DIM, 'left');
    // the squeezy bottle
    const sq = S.wasSq && isHeld();
    c.save(); c.translate(S.nx, S.ny - 8); c.rotate(0.35);
    c.fillStyle = '#f2c21b'; c.strokeStyle = '#9a6e04'; c.lineWidth = 4;
    c.beginPath(); c.moveTo(-5, 0); c.lineTo(5, 0); c.lineTo(15, -26); c.lineTo(-15, -26); c.closePath(); c.fill(); c.stroke();
    rrect(c, -22, -108, 44, 84, 12); c.fill(); c.stroke();
    c.fillStyle = '#e0452f'; rrect(c, -16, -72, 32, 22, 4); c.fill();
    c.restore();
    if (sq) { c.fillStyle = '#f2c21b'; c.beginPath(); c.arc(S.nx, S.ny + 2, 4, 0, 7); c.fill(); }
    c.strokeStyle = 'rgba(255,248,236,0.5)'; c.lineWidth = 2; c.beginPath(); c.arc(S.nx, S.ny, 9, 0, 7); c.stroke();
    // out-of-bounds hint zone
    c.setLineDash([6, 6]); c.strokeStyle = 'rgba(255,179,71,0.5)'; c.strokeRect(MUS.x0, MUS.y0, MUS.x1 - MUS.x0, MUS.y1 - MUS.y0); c.setLineDash([]);
  }

  // -- beer --
  function drawGlassPath(Wt, Wb, Hh) {
    c.beginPath(); c.moveTo(-Wt / 2, 0); c.lineTo(Wt / 2, 0); c.lineTo(Wb / 2, Hh); c.lineTo(-Wb / 2, Hh); c.closePath();
  }
  function drawPour() {
    const px = 330, py = 135, Hh = 190, Wt = 104, Wb = 84, t = S.tilt, ct = Math.cos(t), st = Math.sin(t);
    // tap
    c.fillStyle = '#b9c0cb'; c.strokeStyle = '#555c68'; c.lineWidth = 3;
    rrect(c, 110, 54, 240, 28, 8); c.fill(); c.stroke();
    rrect(c, 316, 78, 28, 22, 6); c.fill(); c.stroke();
    c.fillStyle = '#e0452f'; rrect(c, 150, 28, 22, 30, 6); c.fill(); c.stroke();
    // liquid and foam, clipped to the (tilted) glass but levelled to the world
    const botY = py + Hh * ct + (Wb / 2) * st;
    const ys = botY - S.liq * Hh * ct * 0.95, fh = S.foam * Hh * ct * 0.95;
    c.save();
    c.translate(px, py); c.rotate(-t); drawGlassPath(Wt, Wb, Hh);
    c.fillStyle = 'rgba(220,235,255,0.10)'; c.fill();
    c.clip(); c.rotate(t); c.translate(-px, -py);
    c.fillStyle = '#f0a81c'; c.fillRect(0, ys, W, H);
    c.fillStyle = 'rgba(255,230,140,0.45)'; c.fillRect(0, ys, W, 5);
    c.fillStyle = '#fff6dc'; c.fillRect(0, ys - fh, W, fh + 2);
    c.restore();
    // stream
    if (S.flow > 0.04) {
      const endY = Math.max(py + 6, Math.min(ys - fh, py + 30 + 90 * (1 - t / BEER.tiltMax)));
      c.strokeStyle = '#f0a81c'; c.lineWidth = 3 + 7 * S.flow; c.lineCap = 'butt';
      c.setLineDash([14, 5]); c.lineDashOffset = -S.t * 120;
      c.beginPath(); c.moveTo(px, 100); c.lineTo(px, endY); c.stroke(); c.setLineDash([]);
    }
    // glass outline
    c.save(); c.translate(px, py); c.rotate(-t); drawGlassPath(Wt, Wb, Hh);
    c.strokeStyle = '#dff0ff'; c.lineWidth = 5; c.lineJoin = 'round'; c.stroke(); c.restore();
    drawParts();
    // the line gauge: fixed, so it reads the same whatever the tilt
    const gx = 536, gw = 34, gtop = py, gbot = py + Hh, yv = v => gbot - v * Hh;
    c.fillStyle = 'rgba(255,248,236,0.10)'; c.fillRect(gx, gtop, gw, Hh);
    c.fillStyle = '#f0a81c'; c.fillRect(gx, yv(S.liq), gw, S.liq * Hh);
    const fTop = Math.max(gtop, yv(S.liq + S.foam));
    c.fillStyle = '#fff6dc'; c.fillRect(gx, fTop, gw, yv(S.liq) - fTop);
    c.fillStyle = 'rgba(95,191,106,0.45)'; c.fillRect(gx - 8, yv(BEER.lineHi), gw + 16, (BEER.lineHi - BEER.lineLo) * Hh);
    c.strokeStyle = BAD; c.lineWidth = 3; c.beginPath(); c.moveTo(gx - 10, gtop); c.lineTo(gx + gw + 10, gtop); c.stroke();
    c.strokeStyle = INK; c.lineWidth = 4; c.strokeRect(gx, gtop, gw, Hh);
    text(c, 'LINE', gx - 14, yv((BEER.lineLo + BEER.lineHi) / 2), 17, '#8fe0a0', 'right');
    text(c, 'RIM', gx - 14, gtop, 14, BAD, 'right');
    const cm = S.foam * BEER.cm, headOk = S.foam >= BEER.headLo && S.foam <= BEER.headHi;
    text(c, `HEAD ${cm.toFixed(1)} cm`, gx + gw / 2, gbot + 22, 18, headOk ? '#fff' : S.foam > BEER.headHi ? BAD : DIM);
    text(c, '(want 1 to 2)', gx + gw / 2, gbot + 40, 13, DIM);
    // tilt bar
    const tx = 44, tw = 22;
    c.fillStyle = 'rgba(255,248,236,0.10)'; c.fillRect(tx, gtop, tw, Hh);
    c.fillStyle = ACCENT; const th = (S.tilt / BEER.tiltMax) * Hh; c.fillRect(tx, gbot - th, tw, th);
    c.strokeStyle = INK; c.lineWidth = 3; c.strokeRect(tx, gtop, tw, Hh);
    text(c, 'TILT', tx + tw / 2, gbot + 22, 16, DIM);
    if (S.over) text(c, 'FOAM-OVER!', 330, 372, 30, BAD);
  }
  function drawMug(tx, baseY, liq, foam, over) {
    const Hh = 110, Wt = 76, Wb = 62, top = baseY - Hh;
    c.fillStyle = '#7a5a3a'; c.beginPath(); c.ellipse(tx, baseY + 2, 54, 9, 0, 0, 7); c.fill();
    c.save(); c.translate(tx, top); drawGlassPath(Wt, Wb, Hh);
    c.fillStyle = 'rgba(220,235,255,0.12)'; c.fill(); c.clip();
    c.fillStyle = '#f0a81c'; c.fillRect(-Wt / 2, Hh - liq * Hh, Wt, liq * Hh);
    c.fillStyle = '#fff6dc'; c.fillRect(-Wt / 2, Hh - (liq + foam) * Hh, Wt, foam * Hh + 2);
    c.restore();
    c.save(); c.translate(tx, top); drawGlassPath(Wt, Wb, Hh); c.strokeStyle = '#dff0ff'; c.lineWidth = 4; c.lineJoin = 'round'; c.stroke(); c.restore();
    if (over) {
      c.fillStyle = '#fff6dc';
      for (const [dx, r] of [[-40, 14], [-22, 10], [30, 13], [46, 9]]) { c.beginPath(); c.arc(tx + dx, baseY - 4, r, 0, 7); c.fill(); }
      c.beginPath(); c.ellipse(tx, baseY + 6, 66, 10, 0, 0, 7); c.fill();
    }
  }

  // -- serve + result --
  function drawServe() {
    // serving window
    c.fillStyle = '#241c33'; rrect(c, 372, 96, 236, 190, 10); c.fill();
    c.strokeStyle = ACCENT; c.lineWidth = 6; c.stroke();
    for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#fff8ec' : '#e0452f'; c.fillRect(366 + i * 41, 76, 41, 24); }
    text(c, 'NEXT!', 490, 190, 34, 'rgba(255,248,236,0.35)');
    // counter
    c.fillStyle = '#6b4a2a'; c.fillRect(0, 306, W, 14); c.fillStyle = '#4a3220'; c.fillRect(0, 320, W, 50);
    const tx = S.trayX;
    if (S.item === 'fries') {
      drawFries(tx, 300, S.fryQ ?? 0.6, 9, 60, Math.max(0, 5 - S.chops));
      c.fillStyle = '#f3efe6';
      for (const s of S.specks) { c.beginPath(); c.arc(tx + s.x, 300 + s.y, 2, 0, 7); c.fill(); }
      drawCarton(tx, 252);
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
    } else if (S.item === 'hotdog') {
      c.fillStyle = '#fff8ec'; c.strokeStyle = '#7d211a'; c.lineWidth = 3;
      rrect(c, tx - 108, 292, 216, 16, 6); c.fill(); c.stroke();
      c.save(); c.translate(tx, 296); c.scale(0.78, 0.78); c.translate(-DOG.x, -(DOG.y + 56)); drawDog(true); c.restore();
    } else {
      const f = S.fin || { liq: 0.85, foam: 0.1 };
      drawMug(tx, 306, f.liq, f.foam, S.over);
    }
    drawParts();
    if (serveReady()) {
      const a = 0.6 + 0.4 * Math.sin(S.t * 8);
      c.globalAlpha = a; text(c, 'SLIDE  →', 200, 130, 30, ACCENT); c.globalAlpha = 1;
    }
  }

  function drawResult() {
    const col = S.quality === 'perfect' ? ACCENT : S.quality === 'good' ? INK : BAD;
    const k = clamp(S.stampT / 0.25, 0, 1), ease = 1 + (1 - k) * 2.2;
    c.save(); c.translate(320, 180); c.rotate(-0.1); c.scale(ease, ease); c.globalAlpha = k;
    c.strokeStyle = col; c.lineWidth = 9; rrect(c, -230, -66, 460, 132, 14); c.stroke();
    c.lineWidth = 3; rrect(c, -218, -54, 436, 108, 10); c.stroke();
    text(c, LABEL[S.item][S.quality], 0, -4, 74, col, 'center', 400);
    c.restore(); c.globalAlpha = 1;
    if (S.payoff) text(c, S.payoff.toUpperCase(), 320, 84, 28, PAYOFF, 'center', 560);   // playthrough 5 B12
    const beer = S.item === 'beer';
    text(c, S.joke, 320, beer ? 276 : 292, 22, INK, 'center', 580);
    const bits = [];
    if (S.item === 'fries') {
      if (S.onePeel) bits.push('✦ ONE PEEL');
      bits.push(`${S.chops}/5 clean chops`);
    } else if (S.item === 'hotdog') {
      bits.push(`${S.sidesOk}/4 sides`, `bun ${S.bunErr <= BUN.perfect ? 'perfect' : S.bunErr <= BUN.ok ? 'ok' : 'sloppy'}`, `mustard ${Math.round(S.cov * 100)}%${S.glopFrac > 0.1 ? ' (heavy)' : ''}`);
    } else {
      bits.push(`fill ${Math.round(S.fin.liq * 100)}%`, `head ${(S.fin.foam * BEER.cm).toFixed(1)} cm`);
    }
    bits.push(`${S.secs.toFixed(1)} s`);
    text(c, bits.join('   ·   '), 320, beer ? 316 : 334, 20, S.onePeel ? '#ffe08a' : DIM, 'center', 600);
    if (beer) text(c, RESPONSIBLY, 320, 352, 16, DIM, 'center', 600);
  }

  function draw() {
    if (!c) return;
    c.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    c.clearRect(0, 0, W, H);
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(46,38,66,0.96)'); g.addColorStop(1, 'rgba(26,20,38,0.98)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // step label and pips
    if (S.stage === 'menu') text(c, "WHAT'LL IT BE?", 22, 34, 36, ACCENT, 'left');
    else {
      const names = NAMES[S.item], n = names.length;
      const idx = S.stage === 'result' ? n - 1 : Math.max(0, STAGES[S.item].indexOf(S.stage));
      text(c, `${idx + 1}  ${S.stage === 'result' ? 'SERVED' : names[idx]}`, 22, 34, 36, ACCENT, 'left');
      for (let i = 0; i < n; i++) {
        c.fillStyle = i < idx || S.stage === 'result' ? ACCENT : i === idx ? INK : 'rgba(255,248,236,0.2)';
        c.beginPath(); c.arc(586 - (n - 1 - i) * 30, 34, i === idx ? 10 : 8, 0, 7); c.fill();
      }
    }
    const st = S.stage;
    if (st === 'menu') drawMenu();
    else if (st === 'result') drawResult();
    else if (st === 'serve') drawServe();
    else if (st === 'peel') drawPeel();
    else if (st === 'slice') drawSlice();
    else if (st === 'fry') drawFry();
    else if (st === 'grill') drawGrill();
    else if (st === 'bun') drawBunStage();
    else if (st === 'mustard') drawMustardStage();
    else if (st === 'pour') drawPour();
    const dn = deckDrinks();   // the deck's mugs stay in view while you pour
    if (dn != null && S.item === 'beer' && st !== 'menu') { const ol = deckOrderLeft(); if (ol != null) drawOrderRing(450, 34, 13, ol); drawMugs(345, 34, dn, 0.85); const cap = deckCaption(); if (cap) text(c, cap, 345, 62, 16, mugTone(dn) === 'cut' ? '#ff4a3d' : '#ffa31a', 'center', 260); }
    else if (dn != null && st === 'menu' && menu.includes('beer')) { const cap = deckCaption(); if (cap) text(c, cap, CARD.x(2) + CARD.w / 2, CARD.y + CARD.h + 18, 17, mugTone(dn) === 'cut' ? '#ff4a3d' : '#ffa31a', 'center', 330); }
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

  // open({menu: ['fries','hotdog']}): the unlocked items for this venue (default: all three).
  function open(opts) {
    const m = opts && Array.isArray(opts.menu) ? opts.menu.filter(x => ITEMS.includes(x)) : ITEMS;
    menu = m.length ? m : ['fries'];
    if (!built) build();
    opened = true;
    wrapEl.style.display = 'flex';
    held.key = held.ptr = held.pad = false;
    kv.l = kv.r = kv.u = kv.d = false;
    ptrDownSalted = false;
    openMenu();
    draw();
  }
  function close() {
    if (!opened) return;
    opened = false;
    if (wrapEl) wrapEl.style.display = 'none';
    held.key = held.ptr = held.pad = false;
    kv.l = kv.r = kv.u = kv.d = false;
  }

  // The server's float for my serve ("+$1.41 a ball"): onto the SERVED card while it shows.
  function payoff(textOf) { if (S.stage === 'result' && textOf) S.payoff = String(textOf); }

  return {
    open, close, payoff,
    get isOpen() { return opened; },
    handlePointer, handleKey, stepPad, tick,
  };
}
