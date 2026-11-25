// The Upper Deck, client side (council round 4, section 3.1 "Toy 2"; council round 10 #3 and #4).
// Round 10: the drinkers ARE the six upper-bay customers (crowd.js draws them swinging and swaying with their mugs).
// This view draws what is the deck's own:
//   - the empty steins on each bay's ledge (the low rail), one per mug: ONE InstancedMesh of 36;
//   - the beer line: a cable from the shed's roof to the deck's right end, and a mug that zips up it in 1.5 s on every
//     paying beer, slides along the rail at 20 m/s to its seat and lands on the ledge (one pooled InstancedMesh), then
//     the tab floats up there ("+$2,900 tab": gold for an order, red-gold for a round);
//   - a hiccup bubble over a bay at 3+ mugs every 4 s (not on the low tier), WOOO from 4 Drinks, the order's mug sign;
//   - the fall: when the server says the drunkest fell, a figure dressed as that bay's customer tips over the rail, lands
//     on its back, sees stars and walks out (the bay's next customer climbs the stairs in the crowd). While the Deck Cam
//     runs (main.js, ctx.deckCam.on) the drop plays at DECKCAM.SLOW, and the BONK calls ctx.deckCam.bonk() (cut back).
// Server module: server/venues/deck.mjs. Pure rules: web/js/deck.js, web/js/customers.js (UPPER), web/js/deckcam.js.
import * as THREE from 'three';
import { buildPerson, animatePerson } from '../people.js';
import { DECK, fallPose, bannerFor, money, mugTone, ordinal } from '../deck.js';
import { UPPER } from '../customers.js';
import { DECKCAM, fallRate } from '../deckcam.js';

// The beer line (council round 10 §2): shed roof -> the deck's right end, then along the rail to the seat.
export const LINE = { FROM: { x: 42, y: 3.6, z: 6 }, TO: { x: 20, y: 4.6, z: 3.4 }, ZIP_SECS: 1.5, SLIDE: 20, RAIL_Y: 4.6, RAIL_Z: 2.3, DROP_SECS: 0.2 };
// The ledge: the low rail's top (venues.js: a bar at y 3.5, z 2.1). Six stein slots right of each bay's ball.
export const LEDGE = { Y: 3.55, Z: 2.1, DX: 0.45, STEP: 0.24, H: 0.3, R: 0.075, SLOTS: 6 };
export const steinAt = (seat, j) => ({ x: DECK.SEATS[seat] + LEDGE.DX + j * LEDGE.STEP, y: LEDGE.Y + LEDGE.H / 2, z: LEDGE.Z });
const HIC_SECS = 4, FLOAT_SECS = 1.8, MAX_FLIGHTS = 4;
const TAB_COL = { plain: '#fff1c1', order: '#ffd54a', round: '#ff8a3d' };

// A text sprite (WOOO!, a star swirl, hic!). Cached per string.
const spriteCache = new Map();
function textTex(s, color, size) {
  const key = s + color + size;
  let tex = spriteCache.get(key);
  if (!tex) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    g.font = `800 ${size}px system-ui, "Segoe UI Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = '#000c'; g.strokeText(s, 128, 64); g.fillStyle = color; g.fillText(s, 128, 64);
    tex = new THREE.CanvasTexture(cv); spriteCache.set(key, tex);
  }
  return tex;
}
function textSprite(s, color = '#fff', size = 64) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTex(s, color, size), transparent: true, depthWrite: false }));
  sp.scale.set(2.4, 1.2, 1); sp.visible = false;
  return sp;
}

// A short synthesised "WOOO", gasp or hiccup, if the audio context is up (sfx.js has no voice). Never throws.
function voice(SFX, kind, vol = 0.07) {
  try {
    const h = SFX.audioHandle?.(); if (!h || h.isMuted?.()) return;
    const { ctx, master } = h, t = ctx.currentTime;
    const o = ctx.createOscillator(), v = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; lfo.frequency.value = 6; lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency);
    if (kind === 'wooo') { o.frequency.setValueAtTime(260, t); o.frequency.linearRampToValueAtTime(420, t + 0.35); o.frequency.linearRampToValueAtTime(300, t + 0.8); }
    else if (kind === 'hic') { o.frequency.setValueAtTime(380, t); o.frequency.exponentialRampToValueAtTime(700, t + 0.08); }
    else { o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.35); }   // gasp
    const len = kind === 'wooo' ? 0.85 : kind === 'hic' ? 0.12 : 0.4;
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(vol, t + Math.min(0.08, len / 3)); v.gain.linearRampToValueAtTime(0, t + len);
    o.connect(v); v.connect(master); o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
  } catch { /* sound must never break the deck */ }
}

// Where a beer-line mug is, s seconds after the pour, for seat `seat` and ledge slot j. { x, y, z, done }.
// Up the cable in ZIP_SECS, over to the rail, along it at SLIDE m/s, then a short drop onto the ledge.
export function flightAt(s, seat, j) {
  const A = LINE.FROM, B = LINE.TO, end = steinAt(seat, j);
  if (s < LINE.ZIP_SECS) { const u = Math.max(0, s / LINE.ZIP_SECS); return { x: A.x + (B.x - A.x) * u, y: A.y + (B.y - A.y) * u, z: A.z + (B.z - A.z) * u, done: false }; }
  const l1 = Math.hypot(LINE.RAIL_Z - B.z, LINE.RAIL_Y - B.y), l2 = Math.abs(end.x - B.x);
  const d = (s - LINE.ZIP_SECS) * LINE.SLIDE;
  if (d < l1) { const u = d / l1; return { x: B.x, y: B.y + (LINE.RAIL_Y - B.y) * u, z: B.z + (LINE.RAIL_Z - B.z) * u, done: false }; }
  if (d < l1 + l2) { const u = (d - l1) / l2; return { x: B.x + (end.x - B.x) * u, y: LINE.RAIL_Y, z: LINE.RAIL_Z, done: false }; }
  const u = Math.min(1, (s - LINE.ZIP_SECS - (l1 + l2) / LINE.SLIDE) / LINE.DROP_SECS);
  return { x: end.x, y: LINE.RAIL_Y + (end.y - LINE.RAIL_Y) * u, z: LINE.RAIL_Z + (end.z - LINE.RAIL_Z) * u, done: u >= 1 };
}

export default {
  id: 'deck',
  venue: DECK.FROM_VENUE,

  create(ctx) {
    const root = new THREE.Group(); root.name = 'upper-deck'; ctx.scene.add(root);
    const low = () => !!ctx.perf?.low;
    const n = DECK.SEATS.length;

    // ---- the steins: 36 instances, one draw call ----------------------------------------------------------------
    const steinGeo = new THREE.CylinderGeometry(LEDGE.R, LEDGE.R * 0.9, LEDGE.H, 8);
    const steins = new THREE.InstancedMesh(steinGeo, new THREE.MeshLambertMaterial({ color: 0xe9cf7a, transparent: true, opacity: 0.85 }), n * LEDGE.SLOTS);
    steins.frustumCulled = false; steins.castShadow = false; steins.count = 0; root.add(steins);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), pv = new THREE.Vector3();
    let steinKey = '';
    const drawSteins = shown => {
      const key = shown.join(','); if (key === steinKey) return; steinKey = key;
      let c = 0;
      shown.forEach((k, seat) => { for (let j = 0; j < Math.min(k, LEDGE.SLOTS); j++) { const p = steinAt(seat, j); steins.setMatrixAt(c++, m4.compose(pv.set(p.x, p.y, p.z), q, one)); } });
      steins.count = c; steins.instanceMatrix.needsUpdate = true;
    };

    // ---- the beer line: the cable (1 mesh) and the pooled mugs (1 InstancedMesh) ---------------------------------
    {
      const a = new THREE.Vector3(LINE.FROM.x, LINE.FROM.y, LINE.FROM.z), b = new THREE.Vector3(LINE.TO.x, LINE.TO.y, LINE.TO.z);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, a.distanceTo(b), 4), new THREE.MeshBasicMaterial({ color: 0x2a2a2a }));
      cable.position.copy(a).add(b).multiplyScalar(0.5);
      cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      root.add(cable);
    }
    const flyMugs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.08, 0.22, 8), new THREE.MeshLambertMaterial({ color: 0xf2b630, emissive: 0x3a2400 }), MAX_FLIGHTS);
    flyMugs.frustumCulled = false; flyMugs.count = 0; root.add(flyMugs);
    const flights = [];          // { seat, slot, s, kind, n, k }
    const inflight = DECK.SEATS.map(() => 0);

    // ---- the tab floats (world text, everyone sees them) -------------------------------------------------------
    const floats = [];           // { sp, t }
    const dropFloat = f => { root.remove(f.sp); f.sp.material.map.dispose(); f.sp.material.dispose(); };
    function tabFloat(seat, cash, kind) {
      if (!(cash > 0)) return;
      const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
      const g = cv.getContext('2d'), s = `+${money(cash)} tab`;
      g.font = '900 68px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 12; g.strokeStyle = '#000d'; g.strokeText(s, 256, 64); g.fillStyle = TAB_COL[kind] ?? TAB_COL.plain; g.fillText(s, 256, 64);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
      sp.scale.set(4, 1, 1); sp.renderOrder = 5;
      sp.position.set(DECK.SEATS[seat], 5.2, LEDGE.Z); root.add(sp);
      floats.push({ sp, t: 0 });
      while (floats.length > 3) dropFloat(floats.shift());
    }

    // ---- the per-seat signs: WOOO, hic!, the order's mug ------------------------------------------------------
    const seats = DECK.SEATS.map((x, i) => {
      const s = { x, i, hicT: HIC_SECS * (i / n), wooo: textSprite('WOOO!', '#ffe14a', 54), hic: textSprite('hic!', '#d8f3ff', 50), look: 0 };
      s.hic.scale.set(1.4, 0.7, 1);
      root.add(s.wooo, s.hic);
      return s;
    });
    const orderSign = textSprite('🍺?', '#fff', 70); orderSign.scale.set(1.6, 0.8, 1); root.add(orderSign);

    // ---- the fallers: two pooled figures, dressed as the bay's customer (the crowd's look seed) ------------------
    const fallers = [0, 1].map(() => {
      const pivot = new THREE.Group(); pivot.visible = false; root.add(pivot);
      const stars = textSprite('💫', '#fff', 70); root.add(stars);
      return { pivot, person: null, seed: null, seat: 0, state: 'gone', t: 0, stars };
    });
    function dress(f, look) {
      const seed = 'c' + ((look | 0) % 64);
      if (f.person && f.seed === seed) return;
      if (f.person) f.pivot.remove(f.person.root);
      const p = buildPerson({ seed });
      p.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      p.root.position.y = -0.9; f.pivot.add(p.root); f.person = p; f.seed = seed;
    }
    const place = (f, x, y, z, yaw, spin = 0) => {
      f.pivot.position.set(x, y + 0.9, z); f.pivot.rotation.set(spin, 0, 0); f.person.root.rotation.y = yaw;
    };

    let drinks = 0, mugs = DECK.SEATS.map(() => 0), shown = true, woooT = DECK.WOOO_SECS, nextWooo = 0;
    let snap = null, orderSeat = -1, orderRound = false, inPlay = new Set(DECK.SEATS.map((_, i) => i));

    return {
      show(on) { shown = on; root.visible = on; },

      onSnapshot(s, mine) {
        snap = s; drinks = mine?.drinks ?? 0; orderSeat = mine?.order ? mine.order.seat : -1; orderRound = !!mine?.order?.round;
        if (Array.isArray(mine?.mugs)) mugs = mine.mugs.slice(0, n);
        const up = s.mats?.slice(UPPER.FROM);
        if (up?.length) {
          inPlay = new Set();
          up.forEach((w, k) => { if (!w) return; if (w.cust && w.st !== 'fell') seats[k].look = w.look; if (w.st !== 'empty' || w.inc) inPlay.add(k); });
        }
        if (s.phase !== 'shift') {   // the morning: the deck is swept
          for (const f of fallers) { f.state = 'gone'; f.pivot.visible = false; f.stars.visible = false; }
          flights.length = 0; inflight.fill(0);
        }
      },

      onEvent(e) {
        if (e.t === 'deckFall') {
          const seat = ((e.seat % n) + n) % n;
          const f = fallers.find(x => x.state === 'gone') ?? fallers[0];
          dress(f, seats[seat].look);
          Object.assign(f, { seat, state: 'fall', t: 0 }); f.pivot.visible = true;
          voice(ctx.SFX, 'gasp', 0.1);
          const who = e.by === ctx.me?.id ? 'You' : ctx.nameOf?.(e.by) ?? 'Someone';
          // One message: the PA card says it (once ever). Others get a short feed line with the fine; from the 2nd fall
          // of a shift (round 8 #5: the fine escalates) everyone does, the cook too, so the sting is seen.
          if (e.k > 1) ctx.feed?.(`Liability: -${money(e.fine)} (${ordinal(e.k)} fall today).`);
          else if (e.by !== ctx.me?.id) ctx.feed?.(`${who} overserved the deck. Fine ${money(e.fine)}.`);
        } else if (e.t === 'deckOrder') {          // a drinker orders: WOOO and the mug sign, no centre text
          const s = seats[e.seat % n]; orderSeat = e.seat % n; orderRound = !!e.round;
          if (s) { s.wooo.userData.t = 1.4; voice(ctx.SFX, 'wooo', e.round ? 0.1 : 0.08); }
        } else if (e.t === 'deckTab') {
          if (e.order) { orderSeat = -1; orderRound = false; }
          // Round 10 #3: the beer line. The mug flies to the seat that drank it; the tab floats there when it lands
          // (world text in place of the old centre toast).
          const seat = Number.isInteger(e.seat) && e.seat >= 0 ? e.seat % n : -1;
          if (seat < 0) return;
          const kind = e.round ? 'round' : e.order ? 'order' : 'plain', k = e.round ? DECK.ROUND_DRINKS : 1;
          if (flights.length >= MAX_FLIGHTS) { const f = flights.shift(); inflight[f.seat] = Math.max(0, inflight[f.seat] - f.k); tabFloat(f.seat, f.n, f.kind); }
          const slot = Math.max(0, Math.min(LEDGE.SLOTS - 1, (mugs[seat] | 0) + inflight[seat]));
          flights.push({ seat, slot, s: 0, kind, n: e.n, k });
          inflight[seat] += k;
        } else if (e.t === 'knock' && e.by === 'customer' && e.id === ctx.me?.id) {
          ctx.toast?.('A customer fell on you. Corporate is watching.', 3.2);
        }
      },

      tick(dt, t) {
        if (!shown) return;
        const tone = mugTone(drinks);
        // the ledges: what has landed (the mugs still on the line are not there yet)
        drawSteins(mugs.map((m, k) => Math.max(0, (m | 0) - inflight[k])));

        // the beer line
        let c = 0;
        for (let i = flights.length - 1; i >= 0; i--) {
          const f = flights[i]; f.s += dt;
          const p = flightAt(f.s, f.seat, Math.min(f.slot, LEDGE.SLOTS - 1));
          if (p.done) { flights.splice(i, 1); inflight[f.seat] = Math.max(0, inflight[f.seat] - f.k); tabFloat(f.seat, f.n, f.kind); continue; }
          flyMugs.setMatrixAt(c++, m4.compose(pv.set(p.x, p.y, p.z), q, one));
        }
        flyMugs.count = c; if (c) flyMugs.instanceMatrix.needsUpdate = true;
        for (let i = floats.length - 1; i >= 0; i--) {
          const f = floats[i]; f.t += dt;
          f.sp.position.y = 5.2 + f.t * 0.7; f.sp.material.opacity = Math.max(0, 1 - Math.max(0, f.t - FLOAT_SECS * 0.6) / (FLOAT_SECS * 0.4));
          if (f.t >= FLOAT_SECS) { dropFloat(f); floats.splice(i, 1); }
        }

        // WOOO: from 4 drinks, a drinker shouts every 6 s, loudest when it is red.
        if (snap?.phase === 'shift' && drinks >= DECK.WARN) {
          woooT -= dt;
          if (woooT <= 0) {
            woooT = DECK.WOOO_SECS;
            const live = seats.filter(s => inPlay.has(s.i) && mugs[s.i] > 0);
            const s = live[nextWooo++ % Math.max(1, live.length)];
            if (s) { s.wooo.userData.t = 1.4; voice(ctx.SFX, 'wooo', tone === 'cut' ? 0.11 : 0.07); }
          }
        } else woooT = Math.min(woooT, 1.5);

        const headY = DECK.SEAT_Y + 2.2, me = ctx.me;
        for (const s of seats) {
          const wt = s.wooo.userData.t ?? 0;
          s.wooo.userData.t = Math.max(0, wt - dt);
          s.wooo.visible = wt > 0;
          if (s.wooo.visible) { s.wooo.position.set(s.x - 0.6, headY + 0.5 + (1.4 - wt) * 0.4, DECK.SEAT_Z); s.wooo.material.opacity = Math.min(1, wt * 2); }
          // a hiccup bubble at 3+ mugs, every 4 s (not on the low tier)
          const ht = s.hic.userData.t ?? 0;
          s.hic.userData.t = Math.max(0, ht - dt);
          if (!low() && snap?.phase === 'shift' && inPlay.has(s.i) && (mugs[s.i] | 0) >= 3 && (s.hicT -= dt) <= 0) {
            s.hicT = HIC_SECS; s.hic.userData.t = 0.7;
            if (me && Math.hypot(me.x - s.x, me.z - DECK.SEAT_Z) < 20) voice(ctx.SFX, 'hic', 0.04);
          }
          s.hic.visible = s.hic.userData.t > 0 && !s.wooo.visible;
          if (s.hic.visible) { s.hic.position.set(s.x - 0.3, headY + 0.2 + (0.7 - s.hic.userData.t) * 0.5, DECK.SEAT_Z - 0.1); s.hic.material.opacity = Math.min(1, s.hic.userData.t * 3); }
        }
        orderSign.visible = orderSeat >= 0 && snap?.phase === 'shift';
        if (orderSign.visible) {
          const tex = textTex(orderRound ? '🍻!' : '🍺?', '#fff', 70);
          if (orderSign.material.map !== tex) { orderSign.material.map = tex; orderSign.material.needsUpdate = true; }
          orderSign.position.set(DECK.SEATS[orderSeat] - 0.6, headY + 0.9 + Math.sin(t * 5) * 0.08, DECK.SEAT_Z);
        }

        // the fall (round 10 #4: the drop slows while this client's Deck Cam runs; the BONK cuts back)
        for (const f of fallers) {
          if (f.state === 'gone' || !f.person) { f.stars.visible = false; continue; }
          const p = f.person, x = DECK.SEATS[f.seat];
          if (f.state === 'fall') {
            // the lean plays at x1 (x3 in the short cut, playthrough 5 B4), the drop slowed (deckcam.js fallRate)
            f.t += dt * (ctx.deckCam?.on ? fallRate(f.t / DECK.FALL_SECS, ctx.deckCam.secs ?? DECKCAM.SECS) : 1);
            const u = f.t / DECK.FALL_SECS, k = fallPose(f.seat, u);
            animatePerson(p, dt, { mode: 'cheer' });              // arms up: the classic
            p.root.rotation.z = 0; place(f, k.x, k.y, k.z, 0, k.spin);
            if (u >= 1) {
              f.state = 'lie'; f.t = 0; place(f, x, 0, DECK.LAND_Z, 0, 0);
              ctx.SFX.bonk?.(); voice(ctx.SFX, 'gasp', 0.06); ctx.deckCam?.bonk?.();
            }
          } else if (f.state === 'lie') {
            f.t += dt;
            animatePerson(p, dt, { mode: 'knocked' }); place(f, x, 0, DECK.LAND_Z, 0, 0);
            if (f.t >= DECK.LIE_SECS) { f.state = 'leave'; f.t = 0; }
          } else if (f.state === 'leave') {                     // gets up and walks out, left toward the stairs
            f.t += dt;
            animatePerson(p, dt, { mode: 'walk', speed: 1.6 });
            const wx = x - f.t * 3; place(f, wx, 0, DECK.LAND_Z, Math.PI / 2);
            if (wx < DECK.STAIRS_X - 3) { f.state = 'gone'; f.pivot.visible = false; }
          }
          f.stars.visible = f.state === 'lie';
          if (f.stars.visible) f.stars.position.set(x, 1.5 + Math.sin(t * 6) * 0.08, DECK.LAND_Z);
        }
      },

      // The Board's slogan when there is no Last Call and no Gary.
      banner(s) {
        const m = s?.mods?.deck; if (!m) return null;
        return bannerFor(s.day, m.last, m.today);
      },

      reportLines(r) {
        return r?.incidents ? [`Upper Deck incidents: ${r.incidents} · fine ${money(r.deckFines ?? 0)}`] : [];
      },
    };
  },
};
