// board.js - the Fairway Holdings "Board" (split-flap Ball Value billboard), the Ball Silo
// (acrylic tube of banked balls), and floating text labels. No side effects on import.
//
//   const b = createBoard(scene, { x, z });
//   b.update(state);                       // ~10x/s; redraws only when displayed values change
//     state: { bv, rate, upkeep, hustle, curb, pond, fries, kpiLabel, kpi, slogan, quota, outstanding, lastCall, gary, title, silo }
//     owner playtest 3 §1.1/§6.4 adds: price (BV × Hustle × Seal), seal, ceiling, q (the quota's share), venue,
//     fixtures ({ id: mud }), nMats (mats in play), garyToday (the banner before his warning)
//   b.floatText(x, y, z, 'text', '#fff');  // rises ~1.5 m and fades over 1.6 s
//   b.tick(dt);                            // call every frame (flip animation + float labels)
//   b.stamp(quotaEvent, { low });          // the Closing Bell's APPROVED / DENIED stamp (council round 6, #3)
//   createBoard(scene, { x, z, onCross })  // onCross('up' | 'down'): BV crossed the target (the green flash's ding)
//     state also takes: live (a shift is on: crossings only count then)
//     council round 10 adds: goals (goals.js strip(): { pips: [done], label, next }: the goal strip, left of BALLS
//     OUTSTANDING), fed (the FED factor, the orange chip under Hustle) and fedLeft (0..1 of FED.EVERY to the next 5%
//     loss: the chip's thin ring); the fry gauge reads FRIES 14/20
//     round 11 (builder "today") adds: today (today.js todayChip, e.g. 'WINDY': the TODAY pill by EACH BALL PAYS)
//     council round 11 (builder 4) adds: kpiNote (bvtext kpiNoteOf: '7 HAZARDS', 'SECTION C WANTS A BALL · 0:18'), shown
//     on the venue gauge's label row
//   b.overlay(fn | null)                   // council round 11: fn(ctx, W, H, t) paints over the Board at 20 Hz (t = s since set)
//   council round 12 (builder 4): state.contract ({ text, state: live|met|lost }, bvtext contractLineOf) and
//     state.rival ('SITE 13 $41.8M (est.)', bvtext rivalLineOf) on the endless panel; b.shout(text, secs); b.flash(up)
import * as THREE from 'three';
import { BOARD_YAW } from './signs.js';
import { BELL, crossing, gaugeRed, gaugePass, stampFor } from './closingbell.js';
import { sharedConfetti, confettiCount } from './confetti.js';
import { cleanFrac, targetFrac, pct, barWord, whyLine, pipsOf, PIP_HEX, fedText, friesLabel, shouldFlip } from './bvtext.js';   // owner playtest 3 §1: Ball Value in one look
import { FRIES } from './sim.js';   // council round 10 #2: FRIES 14/20

const W = 1024, H = 512;
const MONO = '"Courier New", ui-monospace, Menlo, Consolas, monospace';
const SANS = 'system-ui, "Segoe UI", Arial, sans-serif';
const FLIP_TIME = 0.3, FLIP_STEP = 0.05;
const SILO_MAX = 2000, BALL_R = 0.05;
const FLOAT_TIME = 1.6, FLOAT_RISE = 1.5;
const SCRAMBLE = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789$#%&';

const money = n => { n = Number.isFinite(n) ? n : 0; return '$' + (Math.abs(n) >= 100 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2)); };   // $1.23, $4,247, $60,000,000
const commas = n => String(Math.max(0, Math.round(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const clamp01 = v => Math.max(0, Math.min(1, v));

function mulberry32(a) {
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scramble(text, progress) {          // left-to-right settle; spaces and punctuation stay put
  let out = '';
  const settled = Math.floor(text.length * progress);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    out += (i < settled || !/[A-Za-z0-9]/.test(ch)) ? ch : SCRAMBLE[(Math.random() * SCRAMBLE.length) | 0];
  }
  return out;
}

function drawDimples(g, cx, cy, r) {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c9cfd8';
  for (const [dx, dy] of [[-0.4, -0.35], [0.1, -0.5], [0.45, -0.2], [-0.5, 0.05], [-0.1, -0.1], [0.3, 0.2], [-0.3, 0.4], [0.1, 0.5]]) {
    g.beginPath(); g.arc(cx + dx * r, cy + dy * r, r * 0.09, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#d33';                       // tiny necktie
  g.beginPath(); g.moveTo(cx - r * 0.12, cy + r * 0.62); g.lineTo(cx + r * 0.12, cy + r * 0.62);
  g.lineTo(cx + r * 0.18, cy + r * 1.05); g.lineTo(cx, cy + r * 1.2); g.lineTo(cx - r * 0.18, cy + r * 1.05); g.closePath(); g.fill();
}

// From $100 up the Board shows whole dollars, so cents of drift don't restart the split-flap (playtest: it
// never stopped scrambling at the Stadium).
// Playthrough 3: from $10,000 it flaps in $10 steps (endless BV ~$19k moved every 1–2 s).
const boardMoney = v => (v >= 10_000 ? '$' + (Math.round(v / 10) * 10).toLocaleString('en-US') : v >= 100 ? '$' + Math.round(v).toLocaleString('en-US') : money(v));

export function createBoard(scene, { x, z, onCross = null }) {
  const root = new THREE.Group();
  scene.add(root);
  const disposables = [];

  // ---------- The Board ----------
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const g = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  disposables.push(tex);

  const BW = 6, BH = 3, BOTTOM = 3.5, cy = BOTTOM + BH / 2;
  const boardMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const front = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), boardMat);
  front.position.set(0, cy, 0.06);            // faces +z (stand side)
  const back = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), boardMat);
  back.position.set(0, cy, -0.06); back.rotation.y = Math.PI;   // faces -z (the field), un-mirrored
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x20242c });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.2, BH + 0.2, 0.1), frameMat);
  frame.position.set(0, cy, 0);
  front.userData.sign = 'board.front'; back.userData.sign = 'board.back';   // signs.js (checked by ?signs)
  root.add(frame, front, back);
  for (const sx of [-2.6, 2.6]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, BOTTOM + 0.2, 0.16), frameMat);
    post.position.set(sx, (BOTTOM + 0.2) / 2, 0); root.add(post);
  }
  root.position.set(x, 0, z); root.rotation.y = BOARD_YAW;   // faces the path and the mats (signs.js)
  disposables.push(boardMat, frameMat, front.geometry, back.geometry, frame.geometry);

  let s = null;                // last state
  const cross = { above: null, at: -Infinity }, flash = { t: 0, up: true };   // round 6 #3: the crossing flash
  let stampT = 0, stampNow = null, stampEl = null, clock = 0;
  let key = '';
  let rivalMark = '', rivalMarkT = 0;   // council round 14 #5b / 6.13: the poach's red "−5 %" beside SITE 13 for 3 s
  let flipT = 0, flipAcc = 0;
  let overlayFn = null, overlayT = 0, overlayAcc = 0;   // council round 11: board.overlay (the Stadium newsreel)
  let shoutText = '', shoutT = 0;                        // council round 12: board.shout (the jumbotron's LEGEND line)
  let prevPrice = null;
  const prev = { bv: '', quota: '', banner: '' };
  const flipping = { bv: false, quota: false, banner: false };

  function fit(text, font, maxW, px) {         // shrink font until the text fits
    g.font = font(px);
    while (g.measureText(text).width > maxW && px > 10) { px -= 2; g.font = font(px); }
    return px;
  }

  function bar(bx, by, bw, bh, v, color) {
    g.fillStyle = '#0b0d11'; g.fillRect(bx, by, bw, bh);
    g.fillStyle = color; g.fillRect(bx + 2, by + 2, (bw - 4) * clamp01(v), bh - 4);
    g.strokeStyle = '#4a4f5a'; g.lineWidth = 2; g.strokeRect(bx, by, bw, bh);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1;
    for (let i = 1; i < 10; i++) { const tx = bx + bw * i / 10; g.beginPath(); g.moveTo(tx, by + 2); g.lineTo(tx, by + bh - 2); g.stroke(); }
  }

  // Endless (council round 7 #9, C4): TODAY at 64 px in whole dollars, a bar from $0 to the record under it, and a
  // pale tick where the record shift itself stood at this point (crew.mjs reads records.curve; owner.js paceAt). The
  // bar flashes green when today passes the tick (the round 6 #3 crossing flash, fed pace.cash vs pace.now).
  function drawEndless(pace) {
    const rec = Math.max(pace.record, 0.0001), dollars = v => '$' + commas(v);
    g.fillStyle = '#1d2129'; g.fillRect(24, 296, W - 48, 140);
    g.textBaseline = 'middle'; g.textAlign = 'left'; g.fillStyle = '#7d8594'; g.font = `600 22px ${SANS}`;
    const ct = s?.contract?.text ? s.contract : null, rv = s?.rival ? String(s.rival) : '';
    // Council round 12 (item 6c): with a contract line in the middle, the lifetime stars ride beside TODAY.
    g.fillText(ct && s?.stars != null ? 'TODAY · ★' + s.stars : 'TODAY', 44, 316);
    // Item 8: Site 13's live number under ours ("SITE 13 $41.8M (est.)"): the total shrinks a little to make room.
    g.fillStyle = '#f5e6b8'; g.font = `700 ${rv ? 54 : 64}px ${MONO}`; g.fillText(dollars(pace.cash), 40, rv ? 350 : 360);
    if (rv) { g.fillStyle = '#e39a9a'; g.font = `700 19px ${SANS}`; g.fillText(rv, 44, 384);
      if (rivalMark) { const w = g.measureText(rv + '  ').width; g.fillStyle = '#ff4a3a'; g.font = `800 19px ${SANS}`; g.fillText(rivalMark, 44 + w, 384); } }
    g.textAlign = 'right'; g.fillStyle = '#7d8594'; g.font = `600 22px ${SANS}`;
    // Council round 8 #3: the bar races yesterday (pace.vs); the all-time BEST moves to a small line under it.
    const vsYday = pace.vs === 'yesterday';
    g.fillText(vsYday ? 'YESTERDAY' : 'RECORD', W - 44, 316);
    if (ct) {                                   // item 6c: "★★☆ AT MOST 2 KNOCKDOWNS · 1 SO FAR"; gold when met, struck when lost
      g.textAlign = 'center';
      const cpx = fit(ct.text, p => `700 ${p}px ${SANS}`, 520, 22);
      g.font = `700 ${cpx}px ${SANS}`; g.fillStyle = ct.state === 'met' ? '#ffcf5a' : ct.state === 'lost' ? '#6b7180' : '#f5e6b8';
      g.fillText(ct.text, W / 2, 316);
      if (ct.state === 'lost') { const tw = g.measureText(ct.text).width; g.fillRect(W / 2 - tw / 2 - 4, 315, tw + 8, 3); }
      g.textAlign = 'right'; g.fillStyle = '#7d8594'; g.font = `600 22px ${SANS}`;
    } else if (s?.stars != null) { g.textAlign = 'center'; g.fillStyle = '#ffcf5a'; g.fillText('★ ' + s.stars + ' STARS', W / 2, 316); g.textAlign = 'right'; g.fillStyle = '#7d8594'; }   // round 11: the endless contracts' lifetime stars
    g.fillStyle = '#e06a5a'; g.font = `700 34px ${MONO}`; g.fillText(dollars(pace.record), W - 44, vsYday ? 350 : 356);
    if (vsYday && pace.best > 0) { g.fillStyle = '#7d8594'; g.font = `600 17px ${SANS}`; g.fillText('BEST ' + dollars(pace.best), W - 44, 377); }
    const bx = 44, bw = W - 88, by = 396, bh = 28;
    bar(bx, by, bw, bh, pace.cash / rec, pace.cash >= pace.now ? '#6fd36f' : '#e8b04a');
    const px = bx + 2 + (bw - 4) * clamp01(pace.now / rec);
    g.fillStyle = '#f5e6b8'; g.fillRect(px - 2, by - 6, 4, bh + 12);           // the record's own pace
    g.fillStyle = '#e03a3a'; g.fillRect(bx + bw - 5, by - 8, 6, bh + 16);       // the record
    if (flash.t > 0) {
      g.globalAlpha = Math.min(1, flash.t / BELL.FLASH_SECS) * 0.85;
      g.fillStyle = flash.up ? BELL.GREEN : BELL.AMBER; g.fillRect(bx - 6, by - 8, bw + 12, bh + 16);
      g.globalAlpha = 1;
    }
  }

  function draw() {
    const st = s; if (!st) return;
    const flipP = 1 - flipT / FLIP_TIME;      // 0 -> 1 across the flip
    const show = (name, text) => flipping[name] ? scramble(text, flipP) : text;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#12151b'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1b1f27'; g.fillRect(0, 0, W, 76);
    g.fillStyle = '#e8b04a'; g.fillRect(0, 76, W, 3);

    // header
    drawDimples(g, 48, 34, 24);
    g.textBaseline = 'middle'; g.textAlign = 'left';
    g.fillStyle = '#f2ead3'; g.font = `700 34px ${SANS}`;
    g.fillText('FAIRWAY HOLDINGS · BALL VALUE', 88, 40);
    if (st.title) {
      g.textAlign = 'right'; g.fillStyle = '#e8b04a';
      const px = fit(String(st.title).toUpperCase(), p => `600 ${p}px ${SANS}`, 300, 24);
      g.font = `600 ${px}px ${SANS}`; g.fillText(String(st.title).toUpperCase(), W - 24, 40);
    }

    // gauges (right column). Three rows at 58 px at the Muni and the Club; from Tiered on, a fourth row for the
    // current venue's own KPI (VENUE_RULES[v].kpi), so four at 44 px (council round 4, §3.0).
    const gx = 612, gw = 388;
    const gauges = [['GROUNDS', st.curb, '#6fd36f'], ['POND CLARITY', st.pond, '#4fb3e8'],
      [st.fries == null ? 'FRIES' : friesLabel(Math.round(clamp01(st.fries) * FRIES.MAX), FRIES.MAX), st.fries, '#f0a93a']];   // round 10 #2: what the fryer holds
    if (st.kpiLabel) {                                    // council round 11: the gauge's live note (ZONING · 7 HAZARDS)
      const kl = String(st.kpiLabel).toUpperCase(), note = st.kpiNote ? String(st.kpiNote).toUpperCase() : '';
      const head = kl.split(' ')[0];   // the County's label may already say ZONING 62% · 7 HAZARDS; a bare '7 HAZARDS' gets the word
      gauges.push([!note ? kl : /WANTS/.test(note) || note.startsWith(head) ? note : head + ' · ' + note, st.kpi, '#c77dff']);
    }
    const four = gauges.length > 3, rowH = four ? 44 : 58, lab = four ? 17 : 20, barY = four ? 20 : 24, barH = four ? 18 : 24;
    gauges.forEach(([label, v, color], i) => {
      const gy = 98 + i * rowH;
      g.textAlign = 'left'; g.font = `600 ${fit(label, p => `600 ${p}px ${SANS}`, gw - 64, lab)}px ${SANS}`;
      g.fillStyle = v == null ? '#4a4f5a' : four && i === 3 && st.kpiNote ? '#ffd27a' : '#cfc8b0'; g.textBaseline = 'alphabetic';
      g.fillText(label, gx, gy + lab - 2);
      if (v != null) { g.textAlign = 'right'; g.font = `700 ${lab}px ${MONO}`; g.fillText(Math.round(clamp01(v) * 100) + '%', gx + gw, gy + lab - 2); }
      const isKpi = four && i === 3;                       // round 6 #2/#3: the venue gauge decides the stamp
      bar(gx, gy + barY, gw, barH, v == null ? 0 : v, isKpi && gaugeRed(v, st.lastCall) ? '#e03a3a' : color);
      if (isKpi && v != null) {                            // a white tick at the pass line (50%)
        const kx = gx + 2 + (gw - 4) * gaugePass();
        g.fillStyle = '#ffffff'; g.fillRect(kx - 2, gy + barY - 4, 4, barH + 8);
      }
      if (v == null) {
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#6b7180'; g.font = `600 ${four ? 13 : 15}px ${SANS}`;
        g.fillText('COMING SOON — CORPORATE', gx + gw / 2, gy + barY + barH / 2);
      }
    });

    const pace = st.quota == null ? st.pace : null;         // endless: record pace instead of a target
    // The price, big (owner playtest 3 §1.1): what one ball pays right now = BV × Hustle × Gary's Seal ("$2.62 A BALL").
    g.textAlign = 'left';
    const bvText = boardMoney(priceShown(st));
    const chips = hustleShown(st) || sealShown(st) || fedShown(st);
    g.fillStyle = '#1d2129'; g.fillRect(24, 92, 560, 136);
    g.font = `700 34px ${SANS}`; const aBallW = g.measureText(' A BALL').width;
    g.fillStyle = '#f5e6b8';
    const bpx = fit(show('bv', bvText), p => `700 ${p}px ${MONO}`, (chips ? 410 : 530) - aBallW, 104);
    g.font = `700 ${bpx}px ${MONO}`; g.textBaseline = 'alphabetic';
    const bvBase = 92 + 136 - 22;
    g.fillText(show('bv', bvText), 36, bvBase);
    const numW = g.measureText(show('bv', bvText)).width;
    g.font = `700 34px ${SANS}`; g.fillStyle = '#cfc8b0'; g.fillText(' A BALL', 36 + numW, bvBase);
    g.fillStyle = '#7d8594'; g.font = `600 22px ${SANS}`; g.textBaseline = 'middle';
    g.fillText('EACH BALL PAYS', 36, 108);
    if (st.today) drawToday(String(st.today), 36 + g.measureText('EACH BALL PAYS').width + 18, 108);   // round 11: Corporate's Today
    g.textAlign = 'right';
    // The chips down the right of the price: Hustle (green), Gary's Seal (gold, §6.4), FED (orange, round 10 #2,
    // with a thin ring that empties toward the next 5% loss). Three at once sit tighter.
    const chipList = [];
    if (hustleShown(st)) chipList.push({ text: '×' + st.hustle.toFixed(2), col: '#6fd36f', lab: 'HUSTLE', labCol: '#7d8594' });
    if (sealShown(st)) chipList.push({ text: '×' + st.seal.toFixed(2), col: '#f2c94c', lab: 'GARY', labCol: '#c9a640' });
    if (fedShown(st)) chipList.push({ text: '×' + st.fed.toFixed(2), col: '#ff9a3c', lab: 'FED', labCol: '#c9803c', ring: st.fedLeft ?? 1 });
    const tight = chipList.length > 2, step = tight ? 42 : 62, cpx = tight ? 30 : 40, lpx = tight ? 13 : 16;
    chipList.forEach((c, i) => {
      const y = (tight ? 116 : 124) + i * step, ly = y + (tight ? 20 : 28);
      g.fillStyle = c.col; g.font = `700 ${cpx}px ${MONO}`; g.textAlign = 'right'; g.fillText(c.text, 572, y);
      g.font = `600 ${lpx}px ${SANS}`; g.fillStyle = c.labCol; g.fillText(c.lab, 572, ly);
      if (c.ring != null) {                    // the ring: full just after a dog, empty at the next 5% loss
        const rr = tight ? 5 : 7, rx = 572 - g.measureText(c.lab).width - rr - 6;
        g.strokeStyle = 'rgba(255,154,60,0.25)'; g.lineWidth = 3; g.beginPath(); g.arc(rx, ly, rr, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = c.col; g.beginPath(); g.arc(rx, ly, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * clamp01(c.ring)); g.stroke();
      }
    });

    // The bar (§1.1): CLEAN at the Muni, UPKEEP from the Club, as a percentage, with today's target as a red tick.
    const ceil = st.ceiling ?? 1.5, fill = cleanFrac(st.upkeep, ceil);
    const tgt = st.quota == null || st.q == null ? null : targetFrac(st.q, ceil);
    const bx = 24, bw = 560, by = 256, bh = 26;
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.font = `700 26px ${MONO}`; g.fillStyle = '#f5e6b8';
    const barLab = `${barWord(st.venue)} ${pct(fill)}%`;
    g.fillText(barLab, bx, 238);
    const labW = g.measureText(barLab).width;
    bar(bx, by, bw, bh, fill, tgt == null || fill + 1e-9 >= tgt ? '#6fd36f' : '#e8b04a');
    if (tgt != null) {
      const kx = bx + 2 + (bw - 4) * tgt;
      g.fillStyle = '#e03a3a'; g.fillRect(kx - 3, by - 8, 6, bh + 16);
      g.font = `700 20px ${MONO}`;
      const tt = show('quota', `TARGET ${pct(tgt)}%`), ttw = g.measureText(tt).width;
      g.textAlign = 'center'; g.fillStyle = '#ff8a7a';
      g.fillText(tt, Math.min(bx + bw - ttw / 2, Math.max(bx + labW + 26 + ttw / 2, kx)), 238);
    }
    if (flash.t > 0 && !pace) {               // round 6 #3: the fill crossed the tick: green over, amber back under
      g.globalAlpha = Math.min(1, flash.t / BELL.FLASH_SECS) * 0.85;
      g.fillStyle = flash.up ? BELL.GREEN : BELL.AMBER; g.fillRect(bx - 6, by - 8, bw + 12, bh + 16);
      g.globalAlpha = 1;
    }

    // endless: record pace instead of a target (round 7 #9, C4: TODAY big, a bar to the record, the pace tick)
    if (pace) drawEndless(pace);
    else {
    // The why line, then the fixture pips (§1.1: what do I hose? green ≤ 0.34, amber ≤ 0.6, brown above).
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#9aa3b2'; g.font = `600 20px ${SANS}`;
    g.fillText(whyLine(st.venue), bx, 302);
    if (!st.kpiLabel) {                       // from Tiered on, the fourth gauge row matters more
      const wide = (st.nMats ?? 10) > 10, P = wide ? 15 : 20, GAP = wide ? 4 : 6, GG = 18, groups = [];   // round 11: up to 16 built bays fit
      for (const p of pipsOf(st.fixtures, st.nMats ?? 10)) {
        if (groups.at(-1)?.name !== p.group) groups.push({ name: p.group, pips: [] });
        groups.at(-1).pips.push(p);
      }
      g.font = `600 15px ${SANS}`; g.textBaseline = 'middle';
      let px = bx;
      for (const grp of groups) {                 // each group as wide as its pips or its label, whichever is wider
        const pw = grp.pips.length * (P + GAP) - GAP, lw = g.measureText(grp.name).width, w = Math.max(pw, lw);
        let x = px + (w - pw) / 2;
        for (const p of grp.pips) {
          g.fillStyle = PIP_HEX[p.colour]; g.fillRect(x, 318, P, P);
          g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.strokeRect(x + 0.5, 318.5, P - 1, P - 1);
          x += P + GAP;
        }
        g.textAlign = 'center'; g.fillStyle = '#7d8594'; g.fillText(grp.name, px + w / 2, 350);
        px += w + GG;
      }
    }

    // outstanding (council round 10 #1: the goal strip takes the left half: five pips, "3 OF 5 GOALS", the next goal)
    g.fillStyle = '#1d2129'; g.fillRect(24, 368, W - 48, 64);
    if (st.goals?.pips?.length) {
      const gs = st.goals, P = 16, lx = 40 + gs.pips.length * (P + 6) + 6;
      gs.pips.forEach((on, i) => {
        const x = 40 + i * (P + 6);
        g.fillStyle = on ? '#6fd36f' : '#0b0d11'; g.fillRect(x, 378, P, P);
        g.strokeStyle = on ? '#3d8a3d' : '#4a4f5a'; g.lineWidth = 2; g.strokeRect(x + 1, 379, P - 2, P - 2);
      });
      g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillStyle = '#f5e6b8';
      const lp = fit(gs.label, p => `700 ${p}px ${MONO}`, 540 - lx, 22);
      g.font = `700 ${lp}px ${MONO}`; g.fillText(gs.label, lx, 387);
      const np = fit(gs.next, p => `700 ${p}px ${SANS}`, 520, 20);
      g.fillStyle = '#9fd39f'; g.font = `700 ${np}px ${SANS}`; g.fillText(gs.next, 40, 416);
      g.textAlign = 'right'; g.fillStyle = '#7d8594'; g.font = `600 16px ${SANS}`;
      g.fillText('BALLS OUTSTANDING', W - 44, 383);
      const op = fit(commas(st.outstanding), p => `700 ${p}px ${MONO}`, 380, 34);
      g.fillStyle = '#f5e6b8'; g.font = `700 ${op}px ${MONO}`; g.fillText(commas(st.outstanding), W - 44, 413);
    } else {
      g.textAlign = 'left'; g.fillStyle = '#7d8594'; g.font = `600 24px ${SANS}`; g.textBaseline = 'middle';
      g.fillText('BALLS OUTSTANDING', 44, 400);
      g.textAlign = 'right'; g.fillStyle = '#f5e6b8'; g.font = `700 48px ${MONO}`;
      g.fillText(commas(st.outstanding), W - 44, 402);
    }
    }

    // banner
    let banner = '', bcol = '#e8b04a', bg = '#1b1f27', fg = '#8f98a8';
    if (st.lastCall) { banner = 'LAST CALL'; bg = '#d98a12'; fg = '#1a1203'; }
    else if (st.gary) { banner = String(st.gary); bg = '#9c1f1f'; fg = '#ffe9e6'; }
    else if (st.garyToday) { banner = 'GARY VISITS TODAY'; bg = '#5e1717'; fg = '#ffe9e6'; }   // owner playtest 3 §6.2: until his warning
    else if (st.slogan) {         // a venue view's slogan (round 4), e.g. DAYS WITHOUT AN INCIDENT
      const sl = typeof st.slogan === 'string' ? { text: st.slogan } : st.slogan;
      banner = String(sl.text ?? ''); if (sl.bg) bg = sl.bg; if (sl.fg) fg = sl.fg;
    }
    else { banner = 'EVERY BALL MATTERS.™'; }
    void bcol;
    g.fillStyle = bg; g.fillRect(24, 444, W - 48, 50);
    g.textAlign = 'center'; g.fillStyle = fg;
    const shown = show('banner', banner);
    const px = fit(shown, p => `700 ${p}px ${MONO}`, W - 80, 34);
    g.font = `700 ${px}px ${MONO}`; g.fillText(shown, W / 2, 470);

    if (stampT > 0 && stampNow) {             // the Board wears the stamp too (world space, for the Rats out on the range)
      g.save(); g.translate(304, 190); g.rotate(-0.14);
      g.strokeStyle = stampNow.ink; g.fillStyle = stampNow.ink; g.lineWidth = 10;
      g.font = `900 96px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      const sw = g.measureText(stampNow.text).width + 48;
      g.strokeRect(-sw / 2, -64, sw, 128); g.fillText(stampNow.text, 0, 4);
      g.restore();
    }
    if (overlayFn) { g.save(); try { overlayFn(g, W, H, overlayT); } catch (err) { console.warn('board overlay', err); overlayFn = null; } g.restore(); }
    if (shoutT > 0 && shoutText) {             // council round 12 (2d): "<NAME> · LEGEND · SECTION C", a gold band over the middle
      g.fillStyle = 'rgba(10,12,16,0.92)'; g.fillRect(0, 150, W, 170);
      g.fillStyle = '#e8b04a'; g.fillRect(0, 150, W, 6); g.fillRect(0, 314, W, 6);
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffcf5a';
      const spx = fit(shoutText, p => `800 ${p}px ${SANS}`, W - 80, 72);
      g.font = `800 ${spx}px ${SANS}`; g.fillText(shoutText, W / 2, 236);
    }
    tex.needsUpdate = true;
  }
  // Round 11 (builder "today"): the TODAY chip, a pill right of EACH BALL PAYS ("TODAY · WINDY"). It sits clear of
  // the multiplier chips (right-aligned at 572) and above the big price. Promotion Day never has a Today.
  function drawToday(text, x, y) {
    const label = 'TODAY · ' + text.toUpperCase();
    const px = fit(label, p => `700 ${p}px ${SANS}`, 400 - x + 60, 18);
    g.font = `700 ${px}px ${SANS}`;
    const w = g.measureText(label).width + 20, h = px + 10;
    g.fillStyle = '#2b6cb0'; g.beginPath(); g.roundRect?.(x, y - h / 2, w, h, h / 2); if (!g.roundRect) g.rect(x, y - h / 2, w, h); g.fill();
    g.fillStyle = '#eaf4ff'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(label, x + 10, y + 1);
    g.fillStyle = '#7d8594'; g.font = `600 22px ${SANS}`;   // put the label style back
  }
  const hustleShown = st => st.hustle > 1;
  const sealShown = st => st.seal > 1;          // Gary's Seal (owner playtest 3 §6.4)
  const fedShown = st => st.fed > 1 + 1e-9;     // council round 10 #2: FED
  const priceShown = st => st.price ?? (st.bv ?? 0) * (st.hustle ?? 1) * (st.seal ?? 1) * (st.fed ?? 1);

  const sloganText = sl => (sl == null ? '' : typeof sl === 'string' ? sl : String(sl.text ?? '') + '|' + (sl.bg ?? '') + '|' + (sl.fg ?? ''));
  function bannerOf(st) { return st.lastCall ? 'LAST CALL' : st.gary ? String(st.gary) : st.garyToday ? 'GARY VISITS TODAY' : st.slogan ? 'S:' + sloganText(st.slogan) : 'SLOGAN'; }

  // ---------- The Ball Silo ----------
  const SILO_H = 2.5, SILO_R = 0.5;
  const silo = new THREE.Group();
  silo.position.set(2.5, 0, 0);               // 2.5 m to the side of the board/stand
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(SILO_R, SILO_R, SILO_H, 40, 1, true),
    new THREE.MeshStandardMaterial({ color: 0xcfe8f5, transparent: true, opacity: 0.25, roughness: 0.1, metalness: 0, side: THREE.DoubleSide, depthWrite: false }));
  tube.position.y = SILO_H / 2; tube.renderOrder = 2;
  const metal = new THREE.MeshLambertMaterial({ color: 0x3a4250 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(SILO_R + 0.06, SILO_R + 0.08, 0.1, 40), metal);
  base.position.y = 0.05;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(SILO_R + 0.05, SILO_R + 0.05, 0.1, 40), metal);
  cap.position.y = SILO_H + 0.05;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10), new THREE.MeshLambertMaterial({ color: 0xe8b04a }));
  knob.position.y = SILO_H + 0.14;
  silo.add(tube, base, cap, knob);

  // Deterministic packing: concentric rings per layer, ring-offset per layer, seeded jitter.
  const rand = mulberry32(0xBA11);
  const slots = [];
  const ringR = [0, 0.1, 0.2, 0.3, 0.4];
  const ringN = [1, 6, 12, 18, 25];
  const perLayer = ringN.reduce((a, b) => a + b, 0);
  const layers = Math.ceil(SILO_MAX / perLayer);
  const y0 = 0.1 + BALL_R, usable = SILO_H - 0.1 - 2 * BALL_R - 0.02;
  const dy = usable / (layers - 1);
  for (let L = 0; L < layers && slots.length < SILO_MAX; L++) {
    const twist = L * 0.7;
    for (let r = 0; r < ringR.length; r++) {
      for (let k = 0; k < ringN[r] && slots.length < SILO_MAX; k++) {
        const a = twist * (r + 1) + (k / ringN[r]) * Math.PI * 2 + (rand() - 0.5) * 0.12;
        const rr = ringR[r] + (r ? (rand() - 0.5) * 0.015 : 0);
        slots.push([Math.cos(a) * rr, y0 + L * dy + (rand() - 0.5) * 0.012, Math.sin(a) * rr]);
      }
    }
  }
  const ballGeo = new THREE.SphereGeometry(BALL_R, 10, 8);
  const ballMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const balls = new THREE.InstancedMesh(ballGeo, ballMat, SILO_MAX);
  const m4 = new THREE.Matrix4();
  slots.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); balls.setMatrixAt(i, m4); });
  balls.instanceMatrix.needsUpdate = true;
  balls.count = 0; balls.frustumCulled = false;
  silo.add(balls);
  root.add(silo);
  disposables.push(ballGeo, ballMat, tube.geometry, tube.material, base.geometry, cap.geometry, metal, knob.geometry, knob.material);

  // ---------- Floating text ----------
  const floats = [];
  function floatText(fx, fy, fz, text, color = '#ffffff') {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const x2 = c.getContext('2d');
    x2.font = `700 38px ${SANS}`; x2.textAlign = 'center'; x2.textBaseline = 'middle';
    x2.lineJoin = 'round'; x2.lineWidth = 8; x2.strokeStyle = 'rgba(15,12,25,0.85)';
    // text is a string, or [[text, colour], ...] segments drawn side by side (owner playtest 3 §1.3: "8 × $1.31 + wash").
    const segs = Array.isArray(text) ? text.map(([t, c]) => [String(t), c ?? color]) : [[String(text), color]];
    const t = segs.map(q => q[0]).join('');
    let px = 38; while (x2.measureText(t).width > 240 && px > 14) { px -= 2; x2.font = `700 ${px}px ${SANS}`; }
    x2.textAlign = 'left';
    let sx = 128 - x2.measureText(t).width / 2;
    for (const [st, sc] of segs) { x2.strokeText(st, sx, 34); x2.fillStyle = sc; x2.fillText(st, sx, 34); sx += x2.measureText(st).width; }
    const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({ map, depthTest: false, transparent: true });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(1.6, 0.4, 1); sp.position.set(fx, fy, fz); sp.renderOrder = 11;
    scene.add(sp);
    floats.push({ sp, mat, map, y0: fy, t: 0, text: t });
  }

  // ---------- API ----------
  function update(state) {
    // silo
    const n = Math.min(SILO_MAX, Math.max(0, Math.floor(state.silo || 0)));
    if (balls.count !== n) balls.count = n;

    // round 6 #3: BV crossing the target flashes the bar (at most once every 3 s); 'up' also rings onCross
    const endlessPace = state.quota == null && state.pace ? state.pace : null;   // round 7 #9: endless races the record's pace
    const cr = crossing(cross, endlessPace ? { bv: endlessPace.cash, quota: endlessPace.now, live: state.live !== false, t: clock }
      : { bv: state.bv, quota: state.quota, live: state.live !== false, t: clock });
    if (cr) { flash.t = BELL.FLASH_SECS; flash.up = cr === 'up'; onCross?.(cr); if (s) draw(); }

    // board
    const k = [
      boardMoney(priceShown(state)), state.hustle > 1 ? state.hustle.toFixed(2) : '-', state.seal > 1 ? state.seal.toFixed(2) : '-',
      // owner playtest 3 §1.1: the bar's whole %, the tick's, the venue's word and the pips' colours
      pct(cleanFrac(state.upkeep, state.ceiling ?? 1.5)), state.q == null ? 'x' : pct(targetFrac(state.q, state.ceiling ?? 1.5)), barWord(state.venue),
      pipsOf(state.fixtures, state.nMats ?? 10).map(p => p.colour[0]).join(''), state.garyToday ? 'G' : '',
      state.curb == null ? 'x' : Math.round(clamp01(state.curb) * 100),
      state.pond == null ? 'x' : Math.round(clamp01(state.pond) * 100),
      state.fries == null ? 'x' : Math.round(clamp01(state.fries) * 100),
      state.quota == null ? 'x' : money(state.quota), state.pace ? `${money(state.pace.now)}/${money(state.pace.record)}/${money(state.pace.cash)}/${state.pace.vs}/${state.pace.best}` : '', commas(state.outstanding),
      state.lastCall ? 'L' : '', state.gary || '', state.title || '',
      state.kpiLabel || '', state.kpi == null ? 'x' : Math.round(clamp01(state.kpi) * 100), sloganText(state.slogan),
      // council round 10: the goal strip, the FED chip and its ring (in 10% steps, so the ring redraws ~every 2 s)
      state.goals ? state.goals.pips.map(Number).join('') + state.goals.label + state.goals.next : '',
      state.fed > 1 + 1e-9 ? state.fed.toFixed(2) + ':' + Math.round(clamp01(state.fedLeft ?? 1) * 10) : '',
      state.today ?? '', state.stars ?? '',   // round 11: the TODAY chip, the endless stars
      state.kpiNote ?? '',                   // council round 11: the gauge's live note
      state.contract ? state.contract.text + ':' + state.contract.state : '', state.rival ?? '',   // council round 12: 6c, 8
    ].join('|');
    if (k === key) return;
    key = k;
    const next = { bv: boardMoney(priceShown(state)), quota: state.quota == null || state.q == null ? '' : String(pct(targetFrac(state.q, state.ceiling ?? 1.5))), banner: bannerOf(state) };
    // Council round 11, 8.1: flip only on a new skeleton (digits as '#'), never on a < 1 % price move, never mid-flip.
    const price = priceShown(state);
    if (s && flipT <= 0) {                     // no flip on the very first draw
      for (const f of ['bv', 'quota', 'banner']) {
        if (f === 'bv' ? shouldFlip(prev.bv, next.bv, prevPrice, price) : shouldFlip(prev[f], next[f])) { flipping[f] = true; flipT = FLIP_TIME; }
      }
    }
    prevPrice = price;
    Object.assign(prev, next);
    s = state;
    draw();
  }

  function tick(dt) {
    clock += dt;
    if (rivalMarkT > 0 && (rivalMarkT -= dt) <= 0) { rivalMarkT = 0; rivalMark = ''; if (s) draw(); }
    if (flash.t > 0) {                         // fade the flash at the flip's 20 Hz, not every frame
      flash.t = Math.max(0, flash.t - dt); flash.acc = (flash.acc ?? 0) + dt;
      if (flipT <= 0 && (flash.acc >= FLIP_STEP || flash.t === 0)) { flash.acc = 0; draw(); }
    }
    if (shoutT > 0 && (shoutT -= dt) <= 0) { shoutT = 0; shoutText = ''; if (s) draw(); }
    if (stampT > 0 && (stampT -= dt) <= 0) {
      stampT = 0; stampNow = null; draw();
      if (stampEl) stampEl.style.opacity = '0';
    }
    if (overlayFn) {                           // the overlay redraws at the flip's 20 Hz, not every frame
      overlayT += dt; overlayAcc += dt;
      if (overlayAcc >= FLIP_STEP && flipT <= 0) { overlayAcc = 0; if (s) draw(); }
    }
    if (flipT > 0) {
      flipT -= dt; flipAcc += dt;
      if (flipT <= 0) { flipT = 0; flipping.bv = flipping.quota = flipping.banner = false; flipAcc = 0; draw(); }
      else if (flipAcc >= FLIP_STEP) { flipAcc = 0; draw(); }
    }
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.t += dt;
      const u = f.t / FLOAT_TIME;
      if (u >= 1) {
        scene.remove(f.sp); f.map.dispose(); f.mat.dispose(); floats.splice(i, 1);
        continue;
      }
      f.sp.position.y = f.y0 + FLOAT_RISE * (1 - (1 - u) * (1 - u));
      f.mat.opacity = u < 0.55 ? 1 : 1 - (u - 0.55) / 0.45;
    }
  }

  // The Closing Bell's stamp (round 6 #3): the one centre element at the bell, 1.5 s, then the report card.
  // APPROVED: red ink, confetti over the Board. DENIED: grey ink, and the server's reason (<= 8 words) under it.
  let stampHide = 0;
  function stamp(e, { low = false } = {}) {
    const st = stampFor(e);
    if (!st) return null;
    stampNow = st; stampT = BELL.STAMP_SECS;
    if (s) draw();
    if (typeof document !== 'undefined') {
      if (!stampEl) {
        stampEl = document.createElement('div'); stampEl.id = 'bell-stamp';
        stampEl.style.cssText = 'position:fixed;left:50%;top:42%;z-index:40;pointer-events:none;text-align:center;opacity:0;'
          + 'transition:opacity .2s;font:900 clamp(48px,9vw,112px)/1 system-ui,sans-serif;letter-spacing:.04em';
        document.body.appendChild(stampEl);
      }
      stampEl.innerHTML = '';
      const word = document.createElement('div');
      word.textContent = st.text;
      word.style.cssText = `color:${st.ink};border:.09em solid ${st.ink};border-radius:.08em;padding:.06em .3em;`
        + 'background:rgba(255,250,235,.82);mix-blend-mode:normal;box-shadow:0 .05em .3em rgba(0,0,0,.35)';
      stampEl.appendChild(word);
      if (st.why) {
        const why = document.createElement('div'); why.textContent = st.why;
        why.style.cssText = 'margin-top:.4em;font:800 clamp(16px,2.2vw,26px)/1.2 system-ui,sans-serif;color:#fff;text-shadow:0 2px 6px #000';
        stampEl.appendChild(why);
      }
      // the slam: big and faint, then down hard with a slight tilt
      stampEl.animate?.([{ transform: 'translate(-50%,-50%) rotate(-12deg) scale(2.4)', opacity: 0 },
        { transform: 'translate(-50%,-50%) rotate(-8deg) scale(0.94)', opacity: 1, offset: 0.55 },
        { transform: 'translate(-50%,-50%) rotate(-8deg) scale(1)', opacity: 1 }], { duration: 220, easing: 'ease-in' });   // no fill: a held frame overrode the fade (playtest 2: a watermark behind the report)
      stampEl.style.transform = 'translate(-50%,-50%) rotate(-8deg)';
      stampEl.style.opacity = '1';
      clearTimeout(stampHide); stampHide = setTimeout(() => { if (stampEl) stampEl.style.opacity = '0'; }, BELL.STAMP_SECS * 1000);   // real time
    }
    if (st.ok) {                               // confetti over the Board (≤ 160 points for 2 s; low tier 60)
      const p = new THREE.Vector3(0, BOTTOM + BH + 0.4, 0.3); root.localToWorld(p);
      sharedConfetti(scene).burst(p.x, p.y, p.z, { n: confettiCount(BELL.CONFETTI, low, BELL.CONFETTI_LOW), secs: BELL.CONFETTI_SECS, speed: 5, up: 5 });
    }
    return st;
  }

  // Round 7 #9 (views/owner.js): the crew's colours on the frame. attach(obj) parents a mesh to the Board (Board-local
  // coordinates: x across, y up from the ground, +z the stand side); frameColor(hex | null) tints the frame and posts.
  const frameBase = frameMat.color.getHex();
  const attach = obj => root.add(obj);
  const frameColor = hex => frameMat.color.setHex(hex ?? frameBase);
  // Council round 11 (item 7, builder 2's newsreel): overlay(fn) paints fn(ctx, W, H, t) over the Board's canvas at 20 Hz
  // until overlay(null) snaps it back. A throwing fn is dropped (the Board must never go dark).
  function overlay(fn) {
    overlayFn = typeof fn === 'function' ? fn : null; overlayT = 0; overlayAcc = 0;
    if (s) draw();
  }
  // Council round 12 (builder 4's hand-off hooks):
  //   shout(text, secs = 3): a gold band across the Board's middle (item 2d: "<NAME> · LEGEND · SECTION C"); a new one
  //     replaces the old; shout('') clears. It sits over the newsreel overlay, under nothing. Builder 2 calls it from
  //     views/stadium.js as ctx.board.shout(...).
  //   flash(up = true): the crossing flash once (item 8: "Passed Site 13." flashes the Board once, builder 3).
  function shout(text, secs = 3) {
    shoutText = String(text ?? '').toUpperCase(); shoutT = shoutText ? Math.max(0.5, secs) : 0;
    if (s) draw();
  }
  function flashOnce(up = true) { flash.t = BELL.FLASH_SECS; flash.up = !!up; if (s) draw(); }
  // Council round 14 #0d: the live float texts for the ?debug centre counter (centrewatch.js). Debug only: allocates.
  const floatSprites = () => floats.map(f => ({ id: 'payfloat', text: f.text, sprite: f.sp, opacity: f.mat.opacity }));
  // the poach event: SITE 13's line wears a red mark for `secs` (main.js calls it on the 'poach' event)
  // Council round 14 6.6 (C #7): the floats vanish AT ONCE (no fade) while a priority 0–1 centre item is up, and come
  // back when it's gone. Per frame from main.js; no allocation.
  let floatsHidden = false;
  const hideFloats = on => { on = !!on; if (on === floatsHidden && !on) return; floatsHidden = on; for (let i = 0; i < floats.length; i++) floats[i].sp.visible = !on; };
  const rivalTick = (mark = '−5 %', secs = 3) => { rivalMark = mark; rivalMarkT = secs; if (s) draw(); };
  return { update, floatText, floatSprites, rivalTick, hideFloats, tick, stamp, attach, frameColor, overlay, shout, flash: flashOnce, dims: { BW, BH, BOTTOM } };
}
