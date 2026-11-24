// Round-2 client features (design/council-round2.md), kept out of main.js:
// the Corporate PA, the ball washer crank, promotion and venue reveals and
// re-dress, Ready Up, the ledger and awards, gear grime with Hose a Friend and
// the New Hire Kit, Corporate CCTV, and the Last Bucket ending.
// main.js hands over a context of the things it owns and calls these hooks.

import * as THREE from 'three';
import { WASHER_HANDLES, atHandle, WASH, VENUE_RULES, gearGrimeFactor, money, FIXTURES, SIM, POND } from './sim.js';
import { createPA } from './pa.js';
import { createWasher, createCrank } from './washer.js';
import { createVenues, paintSign } from './venues.js';
import { createEnding } from './ending.js';
import { createCCTV } from './cctv.js';

export function setupRound2(ctx) {
  const { scene, camera, $, toast, board, SFX, nameOf, me } = ctx;
  const link = () => ctx.link();
  const crew = () => ctx.crew();
  const onDockNow = () => !!crew().pond?.unlocked && Math.hypot(me.x - POND.DOCK.x, me.z - POND.DOCK.z) < POND.DOCK_R;

  const pa = createPA({ root: document.body, audio: () => SFX.audioHandle?.() ?? null });
  const washer = createWasher(scene, { onTick: () => SFX.scoop() });
  const venues = createVenues(scene);
  const ending = createEnding({ scene, camera });   // its overlays mount on document.body; `root` would be a 3D parent
  const cctv = createCCTV({ camera, root: $('hud'), onFlag: ({ x, z }) => link()?.act({ t: 'mark', x, z }) });

  let venueShown = -1, endlessShown = false;
  let cranking = null, crankTurns = 0, crankSent = 0;
  // Buddy Air v2: the same crank helper pumps air on the dock; Ⓧ held there hauls the bag line up.
  const pumpCrank = createCrank();
  let pumpOn = false, pumpTurns = 0, pumpSent = 0, pumpRateNow = 0, haulOn = false, haulSecs = 0, haulSent = 0;
  let reveal = null;                // { t, venue, from: {pos, quat}, memo, title }
  let mouse = { dx: 0, dy: 0, wheel: 0, down: false, click: false };
  let oneId = null, endingCard = null, ledgerKey = '';

  // ---- the road sign, per venue ---------------------------------------------------
  function repaintSign(v) {
    const s = ctx.sign;
    if (!s) return;
    paintSign(s.ctx, s.canvas.width, s.canvas.height, v);
    s.tex.needsUpdate = true;
  }

  // ---- events ---------------------------------------------------------------------
  function onEvent(e) {
    const c = crew();
    switch (e.t) {
      case 'pa': pa.say(e.id); break;
      case 'kit':
        if (e.id === me.id) toast(e.level >= 2 ? 'New Hire Kit: a bucket with someone else\'s name on it.' : 'New Hire Kit: a hand-me-down tube from the lost and found. It\'s sticky.', 3.5);
        break;
      case 'washed':
        washer.washed(Math.min(10, e.n));
        if (e.by === me.id) SFX.cash(e.n);
        if (e.cash > 0) board.floatText(21.5, 2.6, 6, '+' + money(e.cash) + (e.by === 'machine' ? ' · washer' : ''), '#9fe8ff');
        break;
      case 'grime':
        if (e.id === me.id && e.v > 0) toast(['', 'Your gear is grubby (×1.17).', 'Your gear is filthy (×1.08).', 'Your gear is caked in mud (×1.00). Hose off at the wash pad.'][e.v], 2.4);
        break;
      case 'hosed':
        SFX.scoop();
        if (e.id === me.id) { me.x += e.dx; me.z += e.dz; toast('Hosed by ' + nameOf(e.by) + '.', 1.4); }
        break;
      case 'sign': toast(e.on ? nameOf(e.by) + ' signed the franchise agreement (' + e.n + ' of ' + e.of + ')' : nameOf(e.by) + ' unsigned', 2.5); renderReport(); break;
      case 'promoted':
        SFX.jackpot();
        toast('PROMOTED: ' + VENUE_RULES[e.venue].name + '. Fee ' + money(e.fee) + '. Reveal tomorrow morning.', 4);
        renderReport(true);
        break;
      case 'ready': renderReport(); break;
      case 'reveal': startReveal(e); break;
      case 'mark': cctv.showFlag({ x: e.x, z: e.z, by: nameOf(e.by), color: e.color }); break;
      case 'huddle': ending.huddle(e.n, e.of); setTimeout(() => ending.huddle(null), 2500); if (e.by === me.id) toast('Everyone to the stand: ' + e.n + ' / ' + e.of, 2); break;
      case 'lastbucket':
        if (e.phase === 'falling') toast('Corporate has paused the sun.', 3);
        if (e.phase === 'carried') toast(e.by === me.id ? 'You have Ball No. 1. Walk it home. Everyone to the stand.' : nameOf(e.by) + ' has Ball No. 1. Everyone to the stand!', 4);
        if (e.phase === 'banked') { ending.huddle(null); ending.finale({}); ctx.floods?.forEach((l, i) => setTimeout(() => { l.intensity = 0; }, 400 * i)); }
        break;
      case 'rest': if (e.one) { ending.land(); SFX.bonk(); } break;
      case 'shift':
        if (e.phase === 'report' && e.report?.ending) setTimeout(() => showEndCard(e.report), 7000);
        if (e.phase === 'shift') { endingCard?.remove?.(); endingCard = null; }
        break;
    }
  }

  // ---- snapshot ---------------------------------------------------------------------
  function onSnapshot(s) {
    if (s.venue !== venueShown || !!s.endless !== endlessShown) {
      if (!reveal) {                  // a reveal flips the sign mid-sequence instead
        venues.setVenue(s.venue, !!s.endless);
        repaintSign(s.endless ? 6 : s.venue);
      }
      venueShown = s.venue; endlessShown = !!s.endless;
    }
    for (const m of ctx.pondMeshes ?? []) m.visible = !!s.pond?.unlocked;
    washer.update(s.washer ?? { n: 0, credit: 0, auto: 0, L: null, R: null, rateL: 0, rateR: 0 });
    // Muddy fixtures show on CCTV.
    if (cctv.isOn) cctv.markers(FIXTURES.filter(f => (s.fixtures?.[f.id] ?? 0) > 0.5).map(f => ({ x: f.x, y: 1, z: f.z, label: f.id.startsWith('mat') ? 'mat' : f.id })));
    renderReport();
  }

  // ---- inputs: crank, CCTV ------------------------------------------------------
  // Returns true if the use press was consumed here.
  function press() {
    const c = crew();
    if (c.phase !== 'shift' || me.down > 0 || ctx.driving()) return false;
    if (c.up?.washer) for (const side of ['L', 'R']) {
      if (atHandle(me, side)) { cranking = side; washer.crank.begin(side); return true; }
    }
    return false;
  }
  function release() {
    if (cranking) { washer.crank.end(); cranking = null; }
  }
  const capturing = () => !!cranking || pumpOn || cctv.isOn || !!reveal;
  function mouseMove(e) {
    mouse.dx += e.movementX ?? 0; mouse.dy += e.movementY ?? 0;
    if (cranking) washer.crank.feedMouse(e.movementX ?? 0, e.movementY ?? 0);
    if (pumpOn) pumpCrank.feedMouse(e.movementX ?? 0, e.movementY ?? 0);
  }
  function pumpBegin() { pumpOn = true; pumpCrank.begin('L'); pumpTurns = 0; pumpSent = 0; }
  function pumpEnd() {
    if (!pumpOn) return;
    pumpOn = false; pumpCrank.end(); pumpRateNow = 0;
    link()?.act({ t: 'pump', turns: +pumpTurns.toFixed(3), held: false });
    pumpTurns = 0;
  }
  function haulBegin() { haulOn = true; haulSecs = 0; haulSent = 0; }
  function haulEnd() { if (haulOn) { haulOn = false; haulSecs = 0; link()?.act({ t: 'haul', held: false }); } }
  function wheel(e) { mouse.wheel += Math.sign(e.deltaY); }
  function toggleCCTV() {
    const c = crew();
    if (c.venue < 1 || c.phase !== 'shift' || ctx.driving() || me.diving) { if (c.venue < 1) toast('Corporate CCTV is installed with the Range Club.', 2); return; }
    if (cctv.isOn) { cctv.exit(); return; }
    cctv.enter(); link()?.act({ t: 'cctv' });
  }

  // ---- the venue reveal: a 6 s camera move to the sign and the Board -------------------
  function startReveal(e) {
    reveal = { t: 0, venue: e.venue, memo: e.memo, title: e.title, flipped: false,
      from: { pos: camera.position.clone(), quat: camera.quaternion.clone() } };
    SFX.jackpot();
  }
  const REVEAL_POS = new THREE.Vector3(20, 6, 22), REVEAL_LOOK = new THREE.Vector3(18, 2.5, 8);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion();
  function tickReveal(dt) {
    const r = reveal;
    r.t += dt;
    const k = Math.min(1, r.t / 1.2), back = Math.max(0, Math.min(1, (r.t - 5) / 1));
    tmpM.lookAt(REVEAL_POS, REVEAL_LOOK, camera.up); tmpQ.setFromRotationMatrix(tmpM);
    const w = k * (1 - back);
    camera.position.copy(r.from.pos).lerp(REVEAL_POS, w);
    camera.quaternion.copy(r.from.quat).slerp(tmpQ, w);
    if (!r.waterOn && r.t > 1.5) { r.waterOn = true; ctx.terrain?.setVenue(r.venue === 6 ? 5 : r.venue); }   // the water comes back on
    if (!r.flipped && r.t > 1) { r.flipped = true; const c = crew(); venues.setVenue(r.venue === 6 ? 5 : r.venue, r.venue === 6 || !!c.endless); repaintSign(r.venue); SFX.cash(10); }
    if (r.t > 3 && !r.memoShown) { r.memoShown = true; ctx.showMemo(r.memo, null); }
    if (r.t >= 6) {
      reveal = null;
      const c = crew();
      toast('Day ' + c.day + ' · ' + (r.venue === 6 ? 'Range Rats LLC' : VENUE_RULES[r.venue].name) + ' · you are ' + (/^[AEIOU]/.test(r.title) ? 'an ' : 'a ') + r.title + '.', 4);
    }
  }

  // ---- the report: promotion, Ready Up, the ledger ---------------------------------------
  function renderReport(force) {
    const c = crew(), r = ctx.report();
    const el = $('report-extra');
    if (!el || c.phase !== 'report' || !r) return;
    const promo = c.promo, mine = c.players?.find(p => p.id === me.id);
    const online = (c.players ?? []).filter(p => p.online);
    const key = JSON.stringify([promo, c.cash, online.map(p => [p.id, p.ready, p.signed]), r.day, c.venue, c.readyIn]);
    if (key === ledgerKey && !force) return;
    ledgerKey = key;
    const esc = s => String(s).replace(/[&<>"']/g, ch => '&#' + ch.charCodeAt(0) + ';');
    let html = '';
    if (r.ledger?.length) {
      html += '<div class="sheet ledger"><h3>The ledger</h3>' + r.ledger.map(l =>
        '<p style="color:' + l.color + '"><span>' + esc(l.name) + ' · banked ' + l.banked + ' · ' + money(l.cash) + (l.hosed ? ' · hosed ' + l.hosed : '') + ' · flat ' + l.knockdowns + '</span><b>' + esc(l.award) + ' — Corporate</b></p>').join('') + '</div>';
    }
    if (r.record) html += '<p class="note">Crew record! Best shift: ' + money(r.record.cash) + ' (was ' + money(r.record.was) + ').</p>';
    if (promo) {
      const dots = '●'.repeat(Math.min(promo.stamps, promo.need)) + '○'.repeat(Math.max(0, promo.need - promo.stamps));
      const signedN = promo.signed.length;
      html += '<div class="sheet promo"><h3>Request promotion: ' + esc(promo.next) + '</h3>' +
        '<p>Review stamps <b>' + dots + '</b></p><p>Franchise fee <b>' + money(promo.fee) + (promo.ready ? '' : ' · you have ' + money(c.cash)) + '</b></p>' +
        (promo.ready ? '<button id="sign-btn">' + (mine?.signed ? 'Unsign' : 'Sign the franchise agreement') + ' (' + signedN + ' of ' + online.length + ' signed)</button>' : '<p class="note">Earn ' + promo.need + ' review stamps (hit the daily quota), then sign at the bell.</p>') + '</div>';
    }
    el.innerHTML = html;
    $('sign-btn')?.addEventListener('click', () => link()?.act({ t: 'sign', on: !mine?.signed }));
    const readyN = online.filter(p => p.ready).length;
    const btn = $('next');
    if (btn) btn.textContent = online.length > 1 ? (mine?.ready ? 'Ready ✓ (' + readyN + ' / ' + online.length + ')' : 'Ready (' + readyN + ' / ' + online.length + ')') + (c.readyIn != null ? ' · starts in ' + c.readyIn + 's' : '') : 'Next shift';
  }

  function showEndCard(report) {
    const c = crew();
    const players = (report.ledger ?? []).map(l => ({ name: l.name, color: l.color, banked: l.banked, cash: l.cash, knockdowns: l.knockdowns }));
    endingCard = ending.endCard({ players, ...(report.ending ?? {}) }, () => { endingCard?.remove?.(); endingCard = null; link()?.act({ t: 'start' }); });
  }

  // ---- per frame ----------------------------------------------------------------------
  function tick(dt, now) {
    const c = crew();
    washer.tick(dt);
    venues.tick(dt, now / 1000);
    // Cranking: the right stick or the mouse turns the handle; 1 turn = 1 ball.
    if (cranking) {
      if (!atHandle(me, cranking) || c.phase !== 'shift') release();
      else {
        const pad = ctx.pad();
        if (pad) washer.crank.feedStick(pad.rx, pad.ry);
        crankTurns += washer.crank.step(dt);
      }
    }
    // Pumping: 1 turn = 1.5 s of air, capped at 2.5 turns/s. Holding without rotating (the crank helper's slow 1 turn/s) is the trickle path.
    if (pumpOn) {
      if (!onDockNow() || me.diving || c.phase !== 'shift') pumpEnd();
      else {
        const pad = ctx.pad();
        if (pad) pumpCrank.feedStick(pad.rx, pad.ry);
        const t = pumpCrank.step(dt), slow = Math.abs(t - dt) < 1e-6;
        pumpRateNow = slow ? 0.2 : Math.min(1, t / Math.max(dt, 1e-3) / 2.5);
        if (!slow) pumpTurns += t;
        if (now - pumpSent > 120) { link()?.act({ t: 'pump', turns: +pumpTurns.toFixed(3), held: true }); pumpTurns = 0; pumpSent = now; }
      }
    }
    if (haulOn) {
      if (!onDockNow() || me.diving || (c.pond?.line ?? 0) <= 0) haulOn = false;
      else {
        haulSecs += dt;
        if (now - haulSent > 120) { link()?.act({ t: 'haul', secs: +haulSecs.toFixed(2) }); haulSent = now; }
      }
    }
    if (crankTurns > 0 && now - crankSent > 250) { link()?.act({ t: 'crank', side: cranking ?? 'L', turns: +crankTurns.toFixed(3) }); crankTurns = 0; crankSent = now; }
    // Ball No. 1: drawn here, big and gold, not by the instanced balls.
    const one = [...ctx.balls().values()].find(b => b.kind === 'one');
    if (one) ending.ballOne(one.x, one.y, one.z); else ending.hideBall();
    const shake = ending.tick(dt);
    if (shake?.lengthSq() > 0) camera.position.add(shake);
    if (reveal) tickReveal(dt);
    if (cctv.isOn) {
      if (me.down > 0 || c.phase !== 'shift') cctv.exit();
      else cctv.update(dt, { pad: ctx.pad(), keys: ctx.keys, mouse: { ...mouse }, width: innerWidth, height: innerHeight });
    } else cctv.update(dt, { pad: null, keys: new Set(), mouse: { dx: 0, dy: 0, wheel: 0, down: false, click: false }, width: innerWidth, height: innerHeight });
    mouse = { dx: 0, dy: 0, wheel: 0, down: mouse.down, click: false };
  }

  // HUD bits: the gear factor (grime) and the next goal.
  function hudLine() {
    const c = crew(), parts = [];
    parts.push('gear ×' + gearGrimeFactor(me.grime ?? 0).toFixed(2) + ((me.grime ?? 0) === 0 ? ' ✦' : ''));
    if (c.promo?.ready) parts.push('PROMOTION READY');
    return parts.join(' · ');
  }
  function prompt(btn) {
    const c = crew();
    if (pumpOn) return 'Pumping: circle the ' + (ctx.pad() ? 'right stick' : 'mouse') + ' to send air down (1 turn = 1.5 s)';
    if (haulOn) return 'Hauling up the bag… ' + Math.min(100, Math.round(haulSecs / 1.5 * 100)) + '%';
    const owed = c.washer?.credit ?? 0, n = c.washer?.n ?? 0;
    if (c.up?.washer && c.phase === 'shift') for (const side of ['L', 'R']) if (atHandle(me, side)) return cranking ? 'Cranking… circle the right stick or the mouse · ' + money(owed) + ' left in the washer'
      : n ? 'Hold ' + btn + ' to crank ' + money(owed) + ' out of the washer (' + n + ' balls)' : 'The ball washer is empty. Bank some balls.';
    return null;
  }

  return {
    pa, onEvent, onSnapshot, press, release, capturing, mouseMove, wheel, toggleCCTV, tick, hudLine, prompt,
    pumpBegin, pumpEnd, haulBegin, haulEnd, pumpRate: () => (pumpOn ? pumpRateNow : 0.6),
    get cctvOn() { return cctv.isOn; }, get revealing() { return !!reveal; },
    setMouseDown(v) { mouse.down = v; if (v) mouse.click = true; },
  };
}
