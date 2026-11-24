// The Upper Deck, client side (council round 4, section 3.1 "Toy 2", build item 5): four loungers at the Tiered deck's
// rail with a mug each. They sway with the Drinks count, shout WOOO from 4, and when the server says somebody fell
// they tip over the rail, land on their back, lie there seeing stars, walk out, and a new one climbs the stairs.
// Server module: server/venues/deck.mjs. Pure rules: web/js/deck.js.
import * as THREE from 'three';
import { buildPerson, animatePerson } from '../people.js';
import { DECK, fallPose, climbPath, pathLength, pointAlong, bannerFor, money, mugTone } from '../deck.js';

const LOOKS = ['deck-a', 'deck-b', 'deck-c', 'deck-d'];
const CLOTHES = [0xff4fa3, 0x35d6c8, 0xf2c230, 0x8a6bff];     // neon-ish, to match the Tiered signs

// A text sprite (WOOO!, a star swirl). Cached per string.
const spriteCache = new Map();
function textSprite(s, color = '#fff', size = 64) {
  let tex = spriteCache.get(s + color);
  if (!tex) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    const g = cv.getContext('2d');
    g.font = `800 ${size}px system-ui, "Segoe UI Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = '#000c'; g.strokeText(s, 128, 64); g.fillStyle = color; g.fillText(s, 128, 64);
    tex = new THREE.CanvasTexture(cv); spriteCache.set(s + color, tex);
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(2.4, 1.2, 1); sp.visible = false;
  return sp;
}

// A little mug for the lounger's right hand (cosmetic).
function mugMesh() {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.065, 0.16, 8), new THREE.MeshLambertMaterial({ color: 0xf2b630 }));
  const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.07, 0.03, 8), new THREE.MeshLambertMaterial({ color: 0xfffaf0 }));
  foam.position.y = 0.09;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 8), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
  handle.position.x = 0.085; handle.scale.set(1, 1.2, 1);
  g.add(glass, foam, handle);
  return g;
}

// A short synthesised "WOOO" or gasp, if the audio context is up (sfx.js has no voice). Never throws.
function voice(SFX, kind, vol = 0.07) {
  try {
    const h = SFX.audioHandle?.(); if (!h || h.isMuted?.()) return;
    const { ctx, master } = h, t = ctx.currentTime;
    const o = ctx.createOscillator(), v = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; lfo.frequency.value = 6; lg.gain.value = 14; lfo.connect(lg); lg.connect(o.frequency);
    if (kind === 'wooo') { o.frequency.setValueAtTime(260, t); o.frequency.linearRampToValueAtTime(420, t + 0.35); o.frequency.linearRampToValueAtTime(300, t + 0.8); }
    else { o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.35); }   // gasp
    const len = kind === 'wooo' ? 0.85 : 0.4;
    v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(vol, t + 0.08); v.gain.linearRampToValueAtTime(0, t + len);
    o.connect(v); v.connect(master); o.start(t); lfo.start(t); o.stop(t + len + 0.05); lfo.stop(t + len + 0.05);
  } catch { /* sound must never break the deck */ }
}

export default {
  id: 'deck',
  venue: DECK.FROM_VENUE,

  create(ctx) {
    const root = new THREE.Group(); root.name = 'upper-deck'; ctx.scene.add(root);
    const seats = DECK.SEATS.map((x, i) => {
      const person = buildPerson({ seed: LOOKS[i], shirt: CLOTHES[i], hat: i % 2 ? 'visor' : false });
      person.root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      const mug = mugMesh(); mug.position.set(-0.3, 0.42, 0.3); person.parts.torso.add(mug);
      const pivot = new THREE.Group();                     // the fall spins about the body's middle
      person.root.position.y = -0.9; pivot.add(person.root);
      pivot.position.set(x, DECK.SEAT_Y + 0.9, DECK.SEAT_Z);
      root.add(pivot);
      return { x, person, pivot, mug, state: 'seated', t: 0, ph: i * 1.7, mode: 'idle', cheerT: 0, path: null, len: 0, replaceT: 0,
        since: 0, stars: textSprite('💫', '#fff', 70), wooo: textSprite('WOOO!', '#ffe14a', 54) };
    });
    for (const s of seats) { root.add(s.stars, s.wooo); }

    let drinks = 0, shown = true, woooT = DECK.WOOO_SECS, nextWooo = 0, hinted = false;
    let snap = null, orderSeat = -1;   // council round 6 #6: the seat with an open order raises its mug

    const place = (s, x, y, z, yaw, spin = 0) => {
      s.pivot.position.set(x, y + 0.9, z); s.pivot.rotation.set(spin, 0, 0); s.person.root.rotation.y = yaw;
    };
    const reseat = s => { s.state = 'seated'; place(s, s.x, DECK.SEAT_Y, DECK.SEAT_Z, 0); s.person.root.rotation.z = 0; s.pivot.visible = true; };
    for (const s of seats) reseat(s);

    return {
      show(on) { shown = on; root.visible = on; },

      onSnapshot(s, mine) {
        snap = s; drinks = mine?.drinks ?? 0; orderSeat = mine?.order ? mine.order.seat : -1;
        if (s.phase !== 'shift') for (const q of seats) if (q.state !== 'seated') reseat(q);   // the morning: everyone is back
      },

      onEvent(e) {
        if (e.t === 'deckFall') {
          const s = seats[e.seat % seats.length];
          if (s.state === 'seated') { s.state = 'fall'; s.t = 0; s.since = 0; voice(ctx.SFX, 'gasp', 0.1); }
          const who = e.by === ctx.me?.id ? 'You' : ctx.nameOf?.(e.by) ?? 'Someone';
          // One message: the PA card says it. Others get a short feed line with the fine.
          if (e.by !== ctx.me?.id) ctx.feed?.(`${who} overserved the deck. Fine ${money(e.fine)}.`);
        } else if (e.t === 'deckOrder') {          // a lounger orders: WOOO and a raised mug, no centre text
          const s = seats[e.seat % seats.length]; orderSeat = e.seat % seats.length;
          if (s?.state === 'seated') { s.cheerT = 1.2; s.wooo.userData.t = 1.4; voice(ctx.SFX, 'wooo', 0.08); }
        } else if (e.t === 'deckTab') {
          if (e.order) orderSeat = -1;
          if (e.by === ctx.me?.id) ctx.toast?.(`${e.order ? 'Order filled' : 'Bar tab'}: +${money(e.n)}`, 1.4);
        } else if (e.t === 'served') {
          if (e.item === 'beer' && e.by === ctx.me?.id && !hinted) {
            hinted = true;
            // (the first-time hint chip in settings.js owns the "beer pays a tab" tip)
          }
        } else if (e.t === 'knock' && e.by === 'customer' && e.id === ctx.me?.id) {
          ctx.toast?.('A customer fell on you. Corporate is reviewing the footage.', 3.2);
        }
      },

      tick(dt, t) {
        if (!shown) return;
        const k = Math.min(1, drinks / DECK.MAX), tone = mugTone(drinks);
        // WOOO: from 4 drinks, a lounger shouts every 6 s, loudest when it is red.
        if (snap?.phase === 'shift' && drinks >= DECK.WARN) {
          woooT -= dt;
          if (woooT <= 0) {
            woooT = DECK.WOOO_SECS;
            const live = seats.filter(s => s.state === 'seated');
            const s = live[nextWooo++ % Math.max(1, live.length)];
            if (s) { s.cheerT = 1.2; s.wooo.userData.t = 1.4; voice(ctx.SFX, 'wooo', tone === 'cut' ? 0.11 : 0.07); }
          }
        } else woooT = Math.min(woooT, 1.5);

        for (const s of seats) {
          s.t += dt; if (s.state !== 'seated') s.since += dt; const p = s.person;
          if (s.state === 'seated') {
            s.cheerT = Math.max(0, s.cheerT - dt);
            const up = seats[orderSeat] === s;                              // the order: mug held high, bobbing
            s.mug.position.set(-0.3, up ? 0.95 + Math.sin(t * 5) * 0.05 : 0.42, up ? 0.15 : 0.3);
            animatePerson(p, dt, { mode: s.cheerT > 0 ? 'cheer' : 'idle' });
            // sway, amplitude drinks / 6 (a gentle lean from the first drink)
            p.root.rotation.z = Math.sin(t * 1.7 + s.ph) * 0.2 * k + Math.sin(t * 0.9 + s.ph * 2) * 0.06 * k;
            s.pivot.position.y = DECK.SEAT_Y + 0.9;
          } else if (s.state === 'fall') {
            const u = s.t / DECK.FALL_SECS, f = fallPose(DECK.SEATS.indexOf(s.x), u);
            animatePerson(p, dt, { mode: 'cheer' });                        // arms up: the classic
            p.root.rotation.z = 0; place(s, f.x, f.y, f.z, 0, f.spin);
            if (u >= 1) {
              s.state = 'lie'; s.t = 0; place(s, f.x, 0, DECK.LAND_Z, 0, 0);
              ctx.SFX.bonk?.(); voice(ctx.SFX, 'gasp', 0.06);
            }
          } else if (s.state === 'lie') {
            animatePerson(p, dt, { mode: 'knocked' }); place(s, s.x, 0, DECK.LAND_Z, 0, 0);
            if (s.t >= DECK.LIE_SECS) { s.state = 'leave'; s.t = 0; }
          } else if (s.state === 'leave') {          // gets up and walks out through the gate (left, toward the stairs)
            animatePerson(p, dt, { mode: 'walk', speed: 1.6 });
            const x = s.x - s.t * 3; place(s, x, 0, DECK.LAND_Z, Math.PI / 2);
            if (x < DECK.STAIRS_X - 3) { s.state = 'gone'; s.t = 0; s.pivot.visible = false; }
          } else if (s.state === 'gone') {
            if (s.since >= DECK.REPLACE_SECS) {   // a new lounger comes up the stairs 20 s after the fall
              s.state = 'climb'; s.t = 0; s.path = climbPath(DECK.SEATS.indexOf(s.x)); s.len = pathLength(s.path); s.pivot.visible = true;
            }
          } else if (s.state === 'climb') {
            const q = pointAlong(s.path, s.t * 2.0);
            animatePerson(p, dt, { mode: 'walk', speed: 1.6 });
            place(s, q.x, q.y, q.z, Math.atan2(-q.dx, -q.dz));
            if (q.done) reseat(s);
          }
          // the star swirl over the one lying down, WOOO over a shouter
          s.stars.visible = s.state === 'lie';
          if (s.stars.visible) s.stars.position.set(s.x, 1.5 + Math.sin(t * 6) * 0.08, DECK.LAND_Z);
          const wt = s.wooo.userData.t ?? 0;
          s.wooo.userData.t = Math.max(0, wt - dt);
          s.wooo.visible = wt > 0 && s.state === 'seated';
          if (s.wooo.visible) { s.wooo.position.set(s.x, DECK.SEAT_Y + 2.7 + (1.4 - wt) * 0.4, DECK.SEAT_Z); s.wooo.material.opacity = Math.min(1, wt * 2); }
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
