// Round-2 client features (design/council-round2.md), kept out of main.js:
// the Corporate PA, the ball washer crank, promotion and venue reveals and
// re-dress, Ready Up, the ledger and awards, gear grime with Hose a Friend and
// the New Hire Kit, Corporate CCTV, and the Last Bucket ending.
// main.js hands over a context of the things it owns and calls these hooks.

import * as THREE from 'three';
import { WASHER_HANDLES, WASHER, atHandle, WASH, VENUE_RULES, money, FIXTURES, SIM, POND, revealCards, BALLS_OUTSTANDING } from './sim.js';
import { createPA } from './pa.js';
import { streakLine, rivalLine, rivalWeekLine } from './owner.js';                                         // council round 8 #3: racing yesterday
import { showPromo, promoPanelHtml, cardHeadline, nextGate } from './promopanel.js';   // council round 10 #1: the goal card (round 7 #10.1: the headline)
import { cardHtml, doneToast } from './goals.js';
import { createWasher, createCrank } from './washer.js';
import { washerPrompt } from './hoppertext.js';   // round 11: the hopper counts in plain words
import { siloFill } from './basket.js';   // round 11: the silo's fill (the washer's chute drops to it)
import { createVenues, paintSign } from './venues.js';
import { createEnding } from './ending.js';
import { createCCTV } from './cctv.js';
import { createHuddleRing, roar } from './huddle.js';                          // round 6 #5: the huddle beat
import { HUDDLE, ringSlots, garyRingSlots, sweepNow, lastBucketLine } from './huddlerules.js';
import { sharedConfetti, confettiCount } from './confetti.js';
import { BANK_SEQ } from './story.js';                                         // council round 11 #4: the note at the huddle
import { drawNewsreel, NEWSREEL } from './founder.js';                         // council round 11 #7: the jumbotron's newsreel
import { MAP } from './map.js';                                                 // council round 12 #3c: the Lift's spot
import { CASE, HUSH, hushWeight, starTiltWeight } from './caserules.js';
import { landmarkTier, LANDMARK, STAR_TILT } from './landmarks.js';   // council round 14 #5c (builder 3): the star in frame   // council round 12 #3b/#3d: the case, the hush
import { washerTipOk } from './centrehooks.js';                                // council round 13 #2b: the washer tip's gate
import { PRI } from './centre.js';
import { newReveal, revealStep, revealStory as revealStoryOf, cueReady as cueReadyOf } from './revealclock.js';   // council round 13 #7b: one clock

export function setupRound2(ctx) {
  const { scene, camera, $, toast, board, SFX, nameOf, me } = ctx;
  const link = () => ctx.link();
  const crew = () => ctx.crew();
  const onDockNow = () => !!crew().pond?.unlocked && Math.hypot(me.x - POND.DOCK.x, me.z - POND.DOCK.z) < POND.DOCK_R;
  const now = () => performance.now();
  let machineCash = 0, machineAt = -1e9;   // the washer's rolling popup

  // The PA card is a PA item in the one centre-text queue (round 7 #3): the card shows the caption when its turn comes.
  const pa = createPA({ root: document.body, audio: () => SFX.audioHandle?.() ?? null,
    enqueue: it => ctx.say('PA', it.caption, { secs: it.secs, data: { show: it.show, hide: it.hide } }) });
  const washer = createWasher(scene, { onTick: () => SFX.scoop() });
  const venues = createVenues(scene);
  const ending = createEnding({ scene, camera });   // its overlays mount on document.body; `root` would be a 3D parent
  const cctv = createCCTV({ camera, root: $('hud'), onFlag: ({ x, z }) => link()?.act({ t: 'mark', x, z }) });
  // The huddle beat (council round 6 #5): the ring round the stand, the shared confetti pool, Use held at the stand.
  const ring = createHuddleRing(scene, SIM.STAND);
  const confetti = sharedConfetti(scene);
  const low = () => !!ctx.perfLow?.();
  let holdingUse = false, lbAt = 0;
  const inRing = p => Math.hypot(p.x - SIM.STAND.x, p.z - SIM.STAND.z) < HUDDLE.R;

  let venueShown = -1, endlessShown = false;
  let cranking = null, crankTurns = 0, crankSent = 0;
  // Buddy Air v2: the same crank helper pumps air on the dock; Ⓧ held there hauls the bag line up.
  const pumpCrank = createCrank();
  let pumpOn = false, pumpTurns = 0, pumpSent = 0, pumpRateNow = 0, haulOn = false, haulSecs = 0, haulSent = 0;
  let reveal = null;                // { t, venue, from: {pos, quat}, memo, title }
  let mouse = { dx: 0, dy: 0, wheel: 0, down: false, click: false };
  let oneId = null, endingCard = null, ledgerKey = '';
  let finaleUp = false, lastWaits = false;   // playthrough 4 C3: the $∞ flash, and the last PA held behind it

  // ---- council round 11 #4: the bank → the hush → the crack → the note → the $∞ finale → the end card ---------------
  // The server sends 'banked', then { t: 'story', id: 'note' } (once per crew), then the last PA (held here until the
  // digits fade) and the report. The note card's delay (story.js NOTE.DELAY) lets the crack play first; its beat's end
  // (storycard's 'rr-story' event) starts the finale; the end card waits on the finale's promise, not a fixed 7 s.
  let bank = null;   // { timers, note: the note is coming, finale: started, done: Promise, resolve }
  const BANK_PA_GAP = 600, END_PA_WAIT = 2;   // council round 12 4c: ms after the fade; the end card's PA-idle cap (s)
  const NOTE_CAP = 20;   // smoke, loop 4: s past BANK_SEQ.WAIT a coming note may still hold the $∞ flash
  // Council round 12 #3b (builder 3): the hush frames the crack. From the bank to the note's end every Rat within
  // HUSH.NEAR m of the return eases (0.8 s) to look at the hopper lip from 1 m further back and 0.3 m higher, and
  // main.js hides the carried bucket and wand (r2.hushing). A look-at, not a cut: walking still works; it lets go.
  const hush = { on: null, off: null, w: 0 };
  const lipV = new THREE.Vector3(SIM.STAND.x, HUSH.LIP_Y, SIM.STAND.z), hushQ = new THREE.Quaternion(), hushM = new THREE.Matrix4();
  function tickHush() {
    if (hush.on == null) { hush.w = 0; return; }
    const t = (now() - hush.on) / 1000, toff = hush.off == null ? null : (now() - hush.off) / 1000;
    hush.w = hushWeight(t, toff);
    if (toff != null && toff > HUSH.EASE) { hush.on = hush.off = null; hush.w = 0; return; }
    if (hush.w <= 0 || reveal || Math.hypot(me.x - SIM.STAND.x, me.z - SIM.STAND.z) > HUSH.NEAR) return;
    const dx = camera.position.x - lipV.x, dz = camera.position.z - lipV.z, d = Math.hypot(dx, dz) || 1;
    camera.position.x += dx / d * HUSH.BACK * hush.w; camera.position.z += dz / d * HUSH.BACK * hush.w; camera.position.y += HUSH.UP * hush.w;
    hushM.lookAt(camera.position, lipV, camera.up); hushQ.setFromRotationMatrix(hushM);
    camera.quaternion.slerp(hushQ, hush.w);
  }
  const hushing = () => hush.w > 0 && Math.hypot(me.x - SIM.STAND.x, me.z - SIM.STAND.z) <= HUSH.NEAR;
  function bankBegin() {
    bankEnd();
    let resolve; const done = new Promise(r => { resolve = r; });
    const b = bank = { timers: [], note: false, finale: false, done, resolve, ducked: false };
    const at = (s, fn) => b.timers.push(setTimeout(fn, s * 1000));
    hush.on = now(); hush.off = null;   // council round 12 #3b: the camera frames the crack until the note's beat ends
    at(BANK_SEQ.HUSH, () => {   // 0.8 s of near-silence: the floods go off, the ambience ducks (the roar with it)
      ctx.floods?.forEach((l, i) => setTimeout(() => { l.intensity = 0; }, 120 * i));
      SFX.duck?.(true); b.ducked = true;
    });
    // Council round 12 #3b: lifted clear of the chute's glass (y HUSH.LIP_Y), opening toward this Rat's camera.
    at(BANK_SEQ.CRACK, () => { ending.crack(SIM.STAND.x, HUSH.LIP_Y, SIM.STAND.z, Math.atan2(-(camera.position.z - SIM.STAND.z), camera.position.x - SIM.STAND.x)); SFX.bonk?.(); });
    at(BANK_SEQ.NOTE + 0.3, () => { if (!b.note) bankFinale(); });                           // no note (seen): straight on
    // Never stuck behind a card, but never under it either (smoke, loop 4): a note that is coming (its turn held by a
    // PA line) keeps the $∞ flash waiting, NOTE_CAP s at most past WAIT; its 'end' starts the finale itself.
    const late = () => (b.note && bank === b && !b.finale && performance.now() - b.t0 < (BANK_SEQ.NOTE + BANK_SEQ.WAIT + NOTE_CAP) * 1000) ? at(1, late) : bankFinale();
    b.t0 = performance.now();
    at(BANK_SEQ.NOTE + BANK_SEQ.WAIT, late);
  }
  function bankFinale() {
    const b = bank;
    if (!b || b.finale) return;
    b.finale = true;
    if (hush.on != null && hush.off == null) hush.off = now();   // council round 12 #3b: the look-at lets go
    if (b.ducked) { SFX.duck?.(false); b.ducked = false; }
    finaleUp = true;
    // Council round 12 4c (builder 4's hand-off): the last PA ~600 ms after the $∞ fade, never under the digits.
    ending.finale({}, () => { finaleUp = false; if (lastWaits) { lastWaits = false; setTimeout(() => pa.say('last'), BANK_PA_GAP); } }).then(() => b.resolve());
  }
  function bankEnd() {
    if (!bank) return;
    bank.timers.forEach(clearTimeout);
    if (bank.ducked) SFX.duck?.(false);
    bank.resolve();
    bank = null;
  }
  // The story card's cards and ends (storycard.js 'rr-story'): the note's bell and its end; the Stadium's newsreel.
  let reelOff = null;
  const onStory = ev => {
    const d = ev?.detail;
    if (!d) return;
    revealStory(d);   // council round 12 #3c/#3d: the reveal's last shot follows the cards
    if (d.id === 'note' && d.phase === 'card') SFX.bell?.(392);                  // one soft bell strike
    if (d.id === 'note' && d.phase === 'end') bankFinale();
    if (d.id === 'promo:3' && d.phase === 'card' && d.index === 0 && board.overlay) {   // the jumbotron plays it, 12 s
      board.overlay(drawNewsreel);
      clearTimeout(reelOff); reelOff = setTimeout(() => board.overlay(null), NEWSREEL.SECS * 1000);
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('rr-story', onStory);

  // ---- the road sign, per venue ---------------------------------------------------
  function repaintSign(v) {
    ctx.arch?.(v === 6 ? 'Range Rats LLC' : VENUE_RULES[v]?.name);   // playthrough 4 B9: the entrance arch follows the venue
    const s = ctx.sign;
    if (!s) return;
    paintSign(s.ctx, s.canvas.width, s.canvas.height, v);
    s.tex.needsUpdate = true;
  }

  // ---- events ---------------------------------------------------------------------
  function onEvent(e) {
    const c = crew();
    switch (e.t) {
      case 'pa': if (e.id === 'last' && finaleUp) lastWaits = true; else pa.say(e.id); break;   // playthrough 4 C3: the last line waits for the $∞ digits
      case 'kit':
        if (e.id === me.id) toast(e.level >= 2 ? 'New Hire Kit: a bucket. Not your name.' : 'New Hire Kit: a sticky hand-me-down tube.', 3.5);
        break;
      case 'washed':
        washer.washed(Math.min(10, e.n));
        if (e.by === me.id) SFX.cash(e.n);
        // The machine washes every 0.5 s: one rolling popup every 2 s instead of a stack (playtest).
        if (e.cash > 0 && e.by === 'machine') { machineCash += e.cash; if (now() - machineAt > 2000) { board.floatText(WASHER.x, 2.6, WASHER.z, '+' + money(Math.round(machineCash * 100) / 100) + ' · washer', '#9fe8ff'); machineCash = 0; machineAt = now(); } }
        else if (e.cash > 0) board.floatText(WASHER.x, 2.6, WASHER.z, '+' + money(e.cash), '#9fe8ff');
        break;
      case 'grime':
        // Playthrough 3 #10: plain words. Round 11: grime no longer cuts your pay; it lowers the crew's Clean % (bvtext bootsMud).
        if (e.id === me.id && e.v > 0) toast(['', 'Your boots are muddy. Hose them.', 'Filthy boots: the range looks dirtier. Hose them.', 'Caked boots drag Clean % down. Hose them.'][e.v], 2.4);
        break;
      case 'hosed':
        SFX.scoop();
        if (e.id === me.id) { me.x += e.dx; me.z += e.dz; toast('Hosed by ' + nameOf(e.by) + '.', 1.4); }
        break;
      case 'sign': toast(e.on ? nameOf(e.by) + ' signed the franchise agreement (' + e.n + ' of ' + e.of + ')' : nameOf(e.by) + ' unsigned', 2.5); renderReport(); break;
      case 'promoted':
        SFX.jackpot();
        // Playthrough 3 #6: the report's "Promoted!" panel says it; a centre toast there sat on the Next button.
        if (c.phase !== 'report') ctx.say('ALERT', 'PROMOTED: ' + VENUE_RULES[e.venue].name + '. Fee ' + money(e.fee) + '.', { secs: 4 });
        renderReport(true);
        break;
      case 'ready': renderReport(); break;
      // Council round 10 #1: a goal completed: one toast ("Goal done! 30 hot dogs. +$1,450"), a ping; the Board's pip
      // fills from the snapshot. Two in one tick queue in say() (the second waits its turn).
      // Playthrough 5 B3: the goal line waits for Gary's verdict (the same tick's 'gary' ALERT queues first; an ALERT
      // may wait 15 s, a toast only 3, so it isn't dropped behind his 4 s line).
      case 'goal': { const line = doneToast(e.id, e.need, e.reward); setTimeout(() => ctx.say('ALERT', line, { secs: 3, key: 'goal:' + e.id }), 150); SFX.cash(e.reward > 0 ? 6 : 2); renderReport(true); break; }
      case 'reveal': startReveal(e); break;
      case 'mark': cctv.showFlag({ x: e.x, z: e.z, by: nameOf(e.by), color: e.color }); break;
      case 'huddle': break;   // the Last Bucket banner (tick) shows who is still missing
      case 'lastbucket':
        if (e.phase === 'falling') toast('Corporate has paused the sun.', 3);
        if (e.phase === 'carried' && !e.back) ctx.say('ALERT', e.by === me.id ? 'You have Ball No. 1. Walk it home.' : nameOf(e.by) + ' has Ball No. 1. To the return!', { key: 'one', secs: 4 });
        if (e.phase === 'banked') {
          ring.hide(); holdingUse = false;
          // Two confetti cannons at the stand and the crowd's roar, then the $∞ finale (round 6 #5).
          for (const dx of [-2.5, 2.5]) confetti.burst(SIM.STAND.x + dx, 1.2, SIM.STAND.z, { n: confettiCount(160, low(), 80), secs: 2.5, speed: 5, up: 11 });
          roar(SFX.audioHandle?.());
          // Council round 11 #4: then the hush, the crack, the note, and only then the $∞ finale (bankBegin).
          ending.huddle(null); finaleUp = true; bankBegin();
        }
        break;
      case 'story': if (e.id === 'note' && bank) bank.note = true; break;   // the note is coming: the finale waits for it
      case 'promoday':   // round 11: Promotion Day passed: two confetti cannons at the return (the PA says it; the report shows it)
        if (e.pass) for (const dx of [-2.5, 2.5]) confetti.burst(SIM.STAND.x + dx, 1.2, SIM.STAND.z, { n: confettiCount(160, low(), 80), secs: 2.5, speed: 5, up: 11 });
        break;
      case 'verdict': {   // Gary saw the huddle: a small puff over his cart (main.js lifts his hat)
        const g = crew()?.gary;
        if (e.huddle && g) confetti.burst(g.x, 2.6, g.z, { n: confettiCount(60, low(), 30), secs: 1.6, speed: 3, up: 5 });
        break;
      }
      case 'rest': if (e.one) { ending.land(); SFX.bonk(); } break;
      case 'shift':
        // Council round 11 #4: the end card waits on the finale (the note may hold it); a rejoin into it: at once.
        if (e.phase === 'report' && e.report?.ending) (bank?.done ?? Promise.resolve())
          .then(() => ctx.whenPaIdle?.(END_PA_WAIT)).then(() => showEndCard(e.report));   // council round 12 4c: no PA card under it
        if (e.phase === 'shift') { if (endingCard) ctx.centre?.release('end'); endingCard?.remove?.(); endingCard = null; ending.crack(null); bankEnd(); finaleUp = false; }
        break;
    }
  }

  // ---- snapshot ---------------------------------------------------------------------
  function onSnapshot(s) {
    lbAt = now();                     // the huddle sweep runs on locally from here (sweepNow)
    if (s.venue !== venueShown || !!s.endless !== endlessShown) {
      if (!reveal) {                  // a reveal flips the sign mid-sequence instead
        venues.setVenue(s.venue, !!s.endless);
        repaintSign(s.endless ? 6 : s.venue);
      }
      venueShown = s.venue; endlessShown = !!s.endless;
    }
    for (const m of ctx.pondMeshes ?? []) m.visible = !!s.pond?.unlocked;
    washer.update(s.washer ?? { n: 0, credit: 0, auto: 0, L: null, R: null, rateL: 0, rateR: 0 });
    washer.silo(siloFill(s.silo, s.filled));   // round 11
    // Muddy fixtures show on CCTV.
    if (cctv.isOn) cctv.markers(FIXTURES.filter(f => (s.fixtures?.[f.id] ?? 0) > 0.5).map(f => ({ x: f.x, y: 1, z: f.z, label: f.id.startsWith('mat') ? 'mat' : f.id })));
    renderReport();
  }

  // ---- inputs: crank, CCTV ------------------------------------------------------
  // Returns true if the use press was consumed here.
  // latch (pad only): a tap grabs the handle / pump and it stays grabbed, so the right thumb is free to circle
  // (either stick feeds it, movement is frozen by capturing()). A second tap of Ⓐ or Ⓑ lets go (unlatch).
  let latched = false;
  function press(latch = false) {
    const c = crew();
    if (c.phase !== 'shift' || me.down > 0 || ctx.driving()) return false;
    // The Last Bucket huddle: Use held anywhere in the ring is your hand on the pile (round 6 #5).
    if (c.lastBucket?.phase === 'huddle' && inRing(me)) { holdingUse = true; link()?.act({ t: 'hold', on: true }); return true; }
    if (c.up?.washer) for (const side of ['L', 'R']) {
      if (atHandle(me, side)) { cranking = side; latched = !!latch; washer.crank.begin(side); return true; }
    }
    return false;
  }
  function release() {
    if (cranking) { washer.crank.end(); cranking = null; }
    if (holdingUse) { holdingUse = false; link()?.act({ t: 'hold', on: false }); }
    latched = false;
  }
  // Let go of a latched crank or pump. Returns true if something was latched.
  function unlatch() {
    if (!latched) return false;
    release(); pumpEnd();
    return true;
  }
  // Both sticks: whichever is pushed harder feeds the crank (the stick not circled sits near the centre).
  const feedPad = (crank, pad) => {
    const r = Math.hypot(pad.rx, pad.ry), l = Math.hypot(pad.lx ?? 0, pad.ly ?? 0);
    if (l > r) crank.feedStick(pad.lx, pad.ly); else crank.feedStick(pad.rx, pad.ry);
  };
  const capturing = () => !!cranking || pumpOn || cctv.isOn || !!reveal;
  function mouseMove(e) {
    mouse.dx += e.movementX ?? 0; mouse.dy += e.movementY ?? 0;
    if (cranking) washer.crank.feedMouse(e.movementX ?? 0, e.movementY ?? 0);
    if (pumpOn) pumpCrank.feedMouse(e.movementX ?? 0, e.movementY ?? 0);
  }
  function pumpBegin(latch = false) { pumpOn = true; latched = !!latch; pumpCrank.begin('L'); pumpTurns = 0; pumpSent = 0; }
  function pumpEnd() {
    if (!pumpOn) return;
    pumpOn = false; latched = false; pumpCrank.end(); pumpRateNow = 0;
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
    // Council round 13 #7b: on one clock (revealclock.js): the path runs on wall-clock seconds since this moment.
    reveal = { ...newReveal(e.venue, now() / 1000), memo: e.memo, title: e.title,
      from: { pos: camera.position.clone(), quat: camera.quaternion.clone() } };
    SFX.jackpot();
  }
  const REVEAL_POS = new THREE.Vector3(20, 6, 22), REVEAL_LOOK = new THREE.Vector3(18, 2.5, 8);
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion();
  // Council round 12 #3c/#3d (builder 3): the reveal's last shot. The Lift: ~15 m off the car on the range's side,
  // looking up at its roof as it climbs (Gary rides it during the beat's card 2). The case: beside the return on the
  // crew's side, Gary and the glass case in one frame. Each holds until its card has played (capped at CAP s).
  const REVEAL_POSE = {
    LIFT_POS: new THREE.Vector3(MAP.LIFT.x + 12, 4, MAP.LIFT.z + 9), LIFT_RISE: 0.6, CASE_OFF: new THREE.Vector3(-5.5, 2.0, -0.6),
    // 4d: the Board (BANK 26, 7.2 at 35°) from the field side, 7 m off at its −x end. A grid search over poses (projected
    // at fov 70, 800 × 600) found this the widest Board (≈ 285 px) with the Stadium jumbotron's three posts (x 20.6,
    // 26, 31.4 at z 14) all outside the middle band (x 250–550); the old pose (20, 6, 22) put its left post at x ≈ 500.
    BOARD_POS: new THREE.Vector3(19, 5.5, 6), BOARD_LOOK: new THREE.Vector3(26, 5.2, 7.2) };
  const shotPos = new THREE.Vector3(), shotLook = new THREE.Vector3(), shotQ = new THREE.Quaternion(), revealPos = new THREE.Vector3();
  function shotPose(r) {
    if (r.shot === 'board') { shotPos.copy(REVEAL_POSE.BOARD_POS); shotLook.copy(REVEAL_POSE.BOARD_LOOK); }
    else if (r.shot === 'lift') {
      const carY = venues.parts?.carY ?? 1.5;   // the camera climbs with the car (0.6 m a metre): Gary stays ≥ 50 px tall
      shotPos.copy(REVEAL_POSE.LIFT_POS); shotPos.y += REVEAL_POSE.LIFT_RISE * carY;
      shotLook.set(MAP.LIFT.x, carY + 2.4, MAP.LIFT.z);   // the car's roof, where Gary stands
    } else {
      shotPos.set(CASE.x, 0, CASE.z).add(REVEAL_POSE.CASE_OFF);
      shotLook.set(CASE.x + 0.1, 1.2, CASE.z - 0.95);   // between Gary and the case
      // Council round 14 #5c: with the star named Gary owned, the shot tilts up 2 s to the star over the case, then back.
      const tw = r.shotAt != null && landmarkTier(crew()?.up) >= LANDMARK.STAR ? starTiltWeight(r.t - r.shotAt) : 0;
      if (tw > 0) { shotLook.x += (CASE.x - shotLook.x) * tw; shotLook.y += (STAR_TILT.Y - shotLook.y) * tw; shotLook.z += (CASE.z - shotLook.z) * tw; }
    }
    tmpM.lookAt(shotPos, shotLook, camera.up); shotQ.setFromRotationMatrix(tmpM);
  }
  const revealStory = d => revealStoryOf(reveal, d);   // round 13 #7b: pure, in revealclock.js
  function tickReveal() {
    const r = reveal;
    const { w, s: sw, done } = revealStep(r, now() / 1000);   // wall-clock: a slow frame jumps, never lags (round 13 #7b)
    tmpM.lookAt(REVEAL_POS, REVEAL_LOOK, camera.up); tmpQ.setFromRotationMatrix(tmpM);
    revealPos.copy(REVEAL_POS);
    if (sw > 0) { shotPose(r); tmpQ.slerp(shotQ, sw); revealPos.lerp(shotPos, sw); }
    camera.position.copy(r.from.pos).lerp(revealPos, w);
    camera.quaternion.copy(r.from.quat).slerp(tmpQ, w);
    if (!r.waterOn && r.t > 1.5) { r.waterOn = true; ctx.terrain?.setVenue(r.venue === 6 ? 5 : r.venue); }   // the water comes back on
    if (!r.flipped && r.t > 1) { r.flipped = true; const c = crew(); venues.setVenue(r.venue === 6 ? 5 : r.venue, r.venue === 6 || !!c.endless); repaintSign(r.venue); SFX.cash(10); }
    if (r.t > 3 && !r.memoShown) {
      r.memoShown = true;
      if (r.venue !== 6) revealCards(r.venue, r.memo).forEach((text, i) => ctx.showMemo(text, null, i ? 10 : 9));   // round 4: a second card says what is new; venue 6: the PA card says it (playthrough 4 C4)
    }
    if (done) {
      reveal = null;   // council round 12 9.6 (builder 4's hand-off): the late "Day N · venue · you are a…" toast is gone
    }
  }

  // ---- the report: promotion, Ready Up, the ledger ---------------------------------------
  // Round 7 #10.1: the fee headline sits above the report's columns (its own element: main.js owns #report-body).
  function feeHead(text) {
    const card = $('report');
    let el = $('fee-head');
    if (!el && card && text) {
      el = document.createElement('p'); el.id = 'fee-head';
      el.style.cssText = 'font-size:1.6em;font-weight:800;color:#ffcf5a;margin:0 0 0.4em;text-align:center';
      card.insertBefore(el, card.firstChild);
    }
    if (el) { el.textContent = text; el.classList.toggle('hidden', !text); }
  }
  function renderReport(force) {
    const c = crew(), r = ctx.report();
    const el = $('report-extra');
    if (!el || c.phase !== 'report' || !r) return;
    const promo = c.promo, mine = c.players?.find(p => p.id === me.id);
    const online = (c.players ?? []).filter(p => p.online);
    // Owner playtest 3 §7.3: the Ready countdown only rewrites #next's text; it never rebuilds the panels (that
    // destroyed a focused Sign button every second, and the next Ⓐ fell through to the first Buy).
    const readyN = online.filter(p => p.ready).length;
    const btn = $('next');
    // Playthrough 5 A1: a done, unsigned card holds Next ("Sign to move up") and Sign is the primary; "Not yet" frees it.
    const declined = !!(c.notYet ?? c.declined);
    const gate = nextGate(promo, { signed: !!mine?.signed, declined, promotedTo: c.promotedTo });
    if (btn) { btn.disabled = !!gate; btn.toggleAttribute('data-primary', !gate); }
    if (btn && gate) btn.textContent = gate.text;
    else if (btn) btn.textContent = online.length > 1 ? (mine?.ready ? 'Ready ✓ (' + readyN + ' / ' + online.length + ')' : 'Ready (' + readyN + ' / ' + online.length + ')') + (c.sigWait ? ' · waiting for signatures (' + c.sigWait.n + ' of ' + c.sigWait.of + ')' : c.readyIn != null ? ' · starts in ' + c.readyIn + 's' : '') : 'Next shift';
    const key = JSON.stringify([promo, c.goals?.rows, c.cash, online.map(p => [p.id, p.ready, p.signed]), r.day, c.venue, c.promotedTo, declined]);
    if (key === ledgerKey && !force) return;
    ledgerKey = key;
    const hadFocus = el.contains(document.activeElement) ? document.activeElement.id : '';   // refocus it after the rebuild
    const esc = s => String(s).replace(/[&<>"']/g, ch => '&#' + ch.charCodeAt(0) + ';');
    let html = '';
    // Council round 8 #3: in endless the headline races yesterday ("Beat yesterday · 4 in a row.", owner.js streakLine).
    // Council round 12 #8: from the Owners' day 2 Site 13's race is the headline; yesterday stays as a row below.
    const head = c.promotedTo ? '' : c.endless && r.rival ? rivalLine(r.rival) : c.endless && r.race ? streakLine(r.race) : cardHeadline(c.goals);
    feeHead(head);   // round 10 #1: "3 of 5 done · 2 to go" leads the report (round 7 #10.1: it was the fee)
    if (r.ledger?.length) {
      html += '<div class="sheet ledger"><h3>The ledger</h3>' + r.ledger.map(l =>
        '<p style="color:' + l.color + '"><span>' + esc(l.name) + ' · banked ' + l.banked + ' · ' + money(l.cash) + (l.hosed ? ' · hosed ' + l.hosed : '') + ' · knocked down ' + l.knockdowns + '</span><b>' + esc(l.award) + ' — Corporate</b></p>').join('') + '</div>';
    }
    // Playthrough 3 #5: endless only, where the record is the game ("Record shift! (was $0)" sat by QUOTA MISSED).
    // Council round 12 9.17: in endless it is the Owners' record (records.owner), not the Orbital's "Record shift".
    if (r.record && c.endless) html += '<p class="note">' + (r.record.owner ? 'Owners’ record! ' : 'Record shift! Best shift: ') + money(r.record.cash) + ' (was ' + money(r.record.was) + ').</p>';
    if (c.endless && r.rival) {   // council round 12 #8: their number, the week, and yesterday as a row
      html += '<p class="note">Site 13 (est.): ' + money(r.rival.target) + ' · you: ' + money(r.rival.cash) + '.</p>';
      if (r.rival.week) html += '<p class="note">' + esc(r.rival.week.acquired ? 'Site 13 acquired. Their sign is yours.' : rivalWeekLine(r.rival.week)) + '</p>';
      if (r.race && !r.race.first) html += '<p class="note">' + esc(streakLine(r.race)) + '</p>';
    }
    for (const line of ctx.views?.()?.reportLines(r) ?? []) html += '<p class="note">' + esc(line) + '</p>';   // round 4: venue report lines
    if (c.promotedTo) {
      html += '<div class="sheet promo"><h3>Promoted!</h3><p>The ' + esc(c.promotedTo) + ' opens tomorrow.</p></div>';
      const tm = document.querySelector('#report-body .dim'); if (tm) tm.textContent = 'Tomorrow: the ' + c.promotedTo + '.';
      const bank = $('report-bank'); if (bank) bank.textContent = money(c.cash);   // playthrough 5 A6: the balance after the fee
    } else if (showPromo(promo)) {   // council round 10 #1: the goal card, Sign only when all five are done
      html += promoPanelHtml(promo, { goals: c.goals, cash: c.cash, signed: !!mine?.signed, signedN: promo.signed.length, onlineN: online.length, declined, esc });
    } else if (c.goals?.rows?.length) {   // the Orbital: the Last Bucket's four steps
      html += '<div class="sheet promo"><h3>The Last Bucket</h3>' + cardHtml(c.goals.rows, { rewardNow: c.goals.reward, esc }) + '</div>';
    }
    el.innerHTML = html;
    $('sign-btn')?.addEventListener('click', () => link()?.act({ t: 'sign', on: !mine?.signed }));
    $('notyet-btn')?.addEventListener('click', () => link()?.act({ t: 'notyet' }));   // the server's decline (Builder S)
    if (hadFocus) ($(hadFocus) ?? (gate ? $('sign-btn') : btn))?.focus();   // gone (the panel closed): the primary
    else if (gate && !$('report').classList.contains('hidden') && (!$('report').contains(document.activeElement) || document.activeElement === btn)) $('sign-btn')?.focus();
  }

  function showEndCard(report) {
    const c = crew();
    const players = (report.ledger ?? []).map(l => ({ name: l.name, color: l.color, banked: l.banked, cash: l.cash, knockdowns: l.knockdowns }));
    ctx.centre?.request({ id: 'end', pri: PRI.END, kind: 'END', hold: true });   // round 13 #2a: the end card holds the centre (priority 0)
    endingCard = ending.endCard({ players, ...(report.ending ?? {}) }, () => { ctx.centre?.release('end'); endingCard?.remove?.(); endingCard = null; link()?.act({ t: 'start' }); });
  }

  // ---- per frame ----------------------------------------------------------------------
  // The Last Bucket: one persistent line that says where Ball No. 1 is and who the stand is waiting for.
  let lbKey = '';
  function lastBucketBanner() {
    const glyph = document.body.classList.contains('pad') ? 'Ⓐ' : 'SPACE';
    const html = lastBucketLine(crew(), me.id, glyph, SIM.STAND);   // huddlerules.js: "HOLD Ⓐ TOGETHER · 3 / 4" once at the stand
    if (html === lbKey) return;
    lbKey = html;
    ending.huddle(html || null);
    if (crew()?.lastBucket?.phase === 'huddle') ctx.unsay?.('one');   // playthrough 4 C6: the huddle banner is up; 'Walk it home' goes
  }
  // The huddle ring: the Last Bucket's (slots fill, the gold sweep runs) or Gary's (slots only, no hold).
  function huddleRing() {
    const c = crew(), lb = c?.lastBucket, g = c?.gary;
    if (c?.phase === 'shift' && lb?.phase === 'huddle') ring.show(ringSlots(lb, c.players), sweepNow(lb, (performance.now() - lbAt) / 1000));
    else if (c?.phase === 'shift' && (g?.phase === 'warn' || g?.phase === 'drive')) ring.show(garyRingSlots(c.players, SIM.STAND));
    else ring.hide();
  }

  let hopperEmptyFor = 0;   // round 13 #2b: shift seconds the washer hopper has sat empty
  function tick(dt, now) {
    { const c0 = crew(); hopperEmptyFor = c0?.phase === 'shift' && !(c0.washer?.n > 0) ? hopperEmptyFor + dt : 0; }
    lastBucketBanner();
    huddleRing();
    confetti.tick(dt);         // the shared pool: a no-op if something else stepped it this frame
    const c = crew();
    washer.tick(dt);
    venues.tick(dt, now / 1000);
    // Cranking: the right stick or the mouse turns the handle; 1 turn = 1 ball.
    if (cranking) {
      if (!atHandle(me, cranking) || c.phase !== 'shift') release();
      else {
        const pad = ctx.pad();
        if (pad) feedPad(washer.crank, pad);
        crankTurns += washer.crank.step(dt);
      }
    }
    // Pumping: 1 turn = 1.5 s of air, capped at 2.5 turns/s. Holding without rotating (the crank helper's slow 1 turn/s) is the trickle path.
    if (pumpOn) {
      if (!onDockNow() || me.diving || c.phase !== 'shift') pumpEnd();
      else {
        const pad = ctx.pad();
        if (pad) feedPad(pumpCrank, pad);
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
    tickHush();   // council round 12 #3b
    if (shake?.lengthSq() > 0) camera.position.add(shake);
    if (reveal) tickReveal();
    if (cctv.isOn) {
      if (me.down > 0 || c.phase !== 'shift') cctv.exit();
      else cctv.update(dt, { pad: ctx.pad(), keys: ctx.keys, mouse: { ...mouse }, width: innerWidth, height: innerHeight });
    } else cctv.update(dt, { pad: null, keys: new Set(), mouse: { dx: 0, dy: 0, wheel: 0, down: false, click: false }, width: innerWidth, height: innerHeight });
    mouse = { dx: 0, dy: 0, wheel: 0, down: mouse.down, click: false };
  }

  // HUD bits: the next goal. Owner playtest 3 §1.4: the gear factor left the HUD (the clean kit is in the price;
  // muddy boots show on your bank popup instead).
  function hudLine() {
    const c = crew(), parts = [];
    if (c.promo?.ready) parts.push('CARD DONE');   // council round 10 #1 (it was PROMOTION READY)
    return parts.join(' · ');
  }
  function prompt(btn) {
    const c = crew();
    if (pumpOn) return 'Pumping: circle ' + (ctx.pad() ? 'either stick' : 'the mouse') + ' to send air down (1 turn = 1.5 s)' + (latched ? ' · ' + btn + ' lets go' : '');
    if (haulOn) return 'Hauling up the bag… ' + Math.min(100, Math.round(haulSecs / 1.5 * 100)) + '%';
    const owed = c.washer?.credit ?? 0, n = c.washer?.n ?? 0;
    // Round 11 (owner: the hopper count "doesn't make a whole lot of sense"): say what the hopper holds, in balls.
    if (c.up?.washer && c.phase === 'shift') for (const side of ['L', 'R']) if (atHandle(me, side)) {
      // Council round 13 #2b: the empty-hopper line is a Muni-week tip (centrehooks.js washerTipOk), not a late-venue fixture.
      if (!n && !cranking && !washerTipOk({ emptyFor: hopperEmptyFor, ballsOut: ctx.balls?.()?.size ?? 0, centreBusy: !!ctx.centreBusy?.(PRI.MEMO), banked: BALLS_OUTSTANDING - (c.outstanding ?? BALLS_OUTSTANDING) })) return null;
      return washerPrompt({ cranking: !!cranking, n, owed, btn, pad: ctx.pad(), latched });
    }
    return null;
  }

  return {
    pa, onEvent, onSnapshot, press, release, unlatch, latched: () => latched, capturing, mouseMove, wheel, toggleCCTV, tick, hudLine, prompt,
    venueParts: venues.parts,   // round 4: what the venue views animate (venues.js parts)
    pumpBegin, pumpEnd, haulBegin, haulEnd, pumpRate: () => (pumpOn ? pumpRateNow : 0.6),
    get cctvOn() { return cctv.isOn; }, get revealing() { return !!reveal; }, cueReady: cue => cueReadyOf(reveal, cue, now() / 1000) /* round 13 #7b: storycard waits on the shot */, get hushing() { return hushing(); },
    setMouseDown(v) { mouse.down = v; if (v) mouse.click = true; },
  };
}
