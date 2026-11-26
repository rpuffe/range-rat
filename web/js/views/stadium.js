// The Stadium's look (council round 4, §3.2): the Ping Track paint, the crowd's bob and wave, the jumbotron
// (CROWD ♥, PING!, KNOCKDOWN CAM) and the ambience crowd level. The rules live in ../stadium.js.
import * as THREE from 'three';
import { MAP } from '../map.js';
import { bobFor, ambFor, waving, bored, carryLine, stretchLine, stretchAlert, legendLine, LEGEND_SECS } from '../stadium.js';
import { createSouvReq } from './souvreq.js';   // council round 11 #5: WE WANT A BALL!

// C #8: is a story card up? (storycard.js's #story-card.on): the lap feed line stands down under one.
const storyUp = () => typeof document !== 'undefined' && !!document.getElementById('story-card')?.classList.contains('on');

const CW = 512, CH = 300;

export default {
  id: 'stadium',
  venue: 3,
  create(ctx) {
    const T = MAP.TRACK;
    const group = new THREE.Group(); group.name = 'ping_track';
    // ---- the paint: a flat ribbon round the centreline ellipse, with a white line at each edge
    const ribbon = (off, half, color, y) => {
      const N = 96, pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const t = (i / N) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
        const nx = c / T.a, nz = s / T.b, nl = Math.hypot(nx, nz);            // outward normal of the ellipse
        for (const o of [off - half, off + half]) pos.push(T.x + T.a * c + (nx / nl) * o, y, T.z + T.b * s + (nz / nl) * o);
        if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.renderOrder = 1; m.frustumCulled = false; return m;
    };
    group.add(ribbon(0, T.w / 2, 0xb5482f, 0.04));
    group.add(ribbon(T.w / 2 - 0.1, 0.1, 0xfff8ec, 0.05)); group.add(ribbon(-T.w / 2 + 0.1, 0.1, 0xfff8ec, 0.05));
    ctx.scene.add(group);

    // ---- the jumbotron: its black plane becomes a 512 x 300 canvas (readable from the field side, -z)
    const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
    const x = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;   // the plane itself faces -z (venues.js)
    let screen = null;
    ctx.venues?.jumbo?.traverse(o => { if (o.isMesh && o.geometry?.type === 'PlaneGeometry') screen = o; });
    if (screen) { screen.material.map = tex; screen.material.color.set(0xffffff); screen.material.needsUpdate = true; }

    let s = 0.5, laps = 0, knocks = 0, ping = null, knock = null, lastDraw = '', boredSaid = false, now = 0, wavePh = 0;
    let stretch = null, legend = null;   // council round 12 #2c/#2d: the Stretch ({ i, secs, t }), the answered request's name line
    let venue = 3;
    const isBored = () => venue === 3 && bored(s);   // council round 12 #2f: the crowd stops at the Stadium
    const draw = () => {
      const pct = Math.round(s * 100), msg = legend && now < legend.until ? 'l' : stretch ? 's' : knock && now < knock.until ? 'k' : ping && now < ping.until ? 'p' : '';
      const key = `${pct}|${laps}|${msg}|${msg === 'k' ? knock.text : msg === 'p' ? ping.text : msg === 'l' ? legend.text : msg === 's' ? stretchLine(stretch) : ''}|${isBored()}`;
      if (key === lastDraw) return; lastDraw = key;
      x.fillStyle = msg === 'k' ? '#3a0a0a' : '#0a0c12'; x.fillRect(0, 0, CW, CH);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      if (msg === 'l') {                                                  // round 12 #2d: "PIP · LEGEND · SECTION C"
        x.fillStyle = '#ffd36b'; x.font = 'bold 40px system-ui, sans-serif'; x.fillText(legend.text, CW / 2, 110, CW - 24);
        x.fillStyle = '#fff8ec'; x.font = '600 28px system-ui, sans-serif'; x.fillText(legend.sub, CW / 2, 170);
      } else if (msg === 's') {                                           // round 12 #2c: SEVENTH-INNING STRETCH · A C F · 0:25
        const [head, secs, clock] = stretchLine(stretch).split(' · ');
        x.fillStyle = '#ffd36b'; x.font = 'bold 40px system-ui, sans-serif'; x.fillText(head, CW / 2, 60, CW - 24);
        x.fillStyle = '#fff8ec'; x.font = 'bold 58px system-ui, sans-serif'; x.fillText(secs, CW / 2, 125);
        x.fillStyle = '#6bf0ff'; x.font = 'bold 40px system-ui, sans-serif'; x.fillText(clock, CW / 2, 185);
      } else if (msg === 'k') {
        x.fillStyle = '#ff4a3d'; x.font = 'bold 54px system-ui, sans-serif'; x.fillText('KNOCKDOWN CAM', CW / 2, 70);
        x.fillStyle = '#fff8ec'; x.font = 'bold 44px system-ui, sans-serif'; x.fillText(knock.text, CW / 2, 150);
        x.fillStyle = '#ffd36b'; x.font = '600 28px system-ui, sans-serif'; x.fillText(`${knock.n} TODAY`, CW / 2, 205);
      } else if (msg === 'p') {
        x.fillStyle = '#6bf0ff'; x.font = 'bold 76px system-ui, sans-serif'; x.fillText('PING!', CW / 2, 90);
        x.fillStyle = '#fff8ec'; x.font = 'bold 44px system-ui, sans-serif'; x.fillText(ping.text, CW / 2, 175);
      } else {
        x.fillStyle = isBored() ? '#8a93a6' : '#fff8ec'; x.font = 'bold 40px system-ui, sans-serif';
        x.fillText(isBored() ? 'THE CROWD IS BORED' : `LAPS TODAY: ${laps}`, CW / 2, 80);
      }
      // the crowd meter, always at the bottom
      x.fillStyle = '#e63a6e'; x.font = 'bold 34px system-ui, sans-serif'; x.textAlign = 'left';
      x.fillText(`CROWD ♥ ${pct}%`, 28, 250);
      x.fillStyle = '#222836'; x.fillRect(290, 232, 194, 36);
      x.fillStyle = isBored() ? '#8a93a6' : s > 0.9 ? '#ffd36b' : '#e63a6e'; x.fillRect(290, 232, 194 * s, 36);
      tex.needsUpdate = true;
    };
    draw();

    let warn = false;                     // round 7 #7: the Three-Minute Warning is up (round 11: T-3:00; the server's mods.stadium.w)
    let hands = 0, booSaid = false, firstReq = true;   // round 11: my souvenirs (negative: relayed), the first boo of the shift; round 12: the first request's chant
    const sreq = createSouvReq(ctx, group); let req = null;   // council round 11 #5: the lit section (mods.stadium.req)
    return {
      banner: () => (warn ? { text: 'THREE-MINUTE WARNING', bg: '#d98a12', fg: '#1a1203' } : null),   // the Board, T-3:00 to Last Call (T-2:30)
      show(on) {
        group.visible = on;
        if (!on) { sreq.hide(); req = null; stretch = null; }
        if (!on && ctx.venues) ctx.venues.crowdBob = 0.15;
      },
      onSnapshot(_snap, mine) {
        warn = !!mine?.w;
        venue = _snap?.venue ?? venue;
        hands = mine?.hands?.[ctx.me?.id] ?? 0;
        if (_snap?.phase !== 'shift') { booSaid = false; firstReq = true; }
        req = venue === 3 && _snap?.phase === 'shift' ? mine?.req ?? null : null;
        stretch = venue === 3 && _snap?.phase === 'shift' ? mine?.stretch ?? null : null;
        sreq.set(req, stretch);
        if (!mine) return;
        s = mine.s; laps = mine.laps; knocks = mine.knocks;   // the jumbotron keeps the live mood (the Board grades k)
        if (isBored() && !boredSaid) { boredSaid = true; ctx.toast?.('THE CROWD IS BORED', 3); }
        else if (s > 0.4) boredSaid = false;
      },
      onEvent(e) {
        if (e.t !== 'crowd') return;
        // Round 11: the boo (a customer walks out), the souvenirs delivered, the hand-off.
        const who = id => (id === ctx.me?.id ? 'You' : ctx.nameOf?.(id) ?? 'A Rat');
        if (e.kind === 'boo') {
          if (!booSaid) { booSaid = true; ctx.toast?.('The crowd is booing. Customers are leaving.', 3); }
          else if (e.mat != null) ctx.feed?.('Booed. A customer walked out.');
          ctx.SFX?.boo?.();   // sfx.js boo(): the crowd's low "ooo" (throttled)
          return;
        }
        // Council round 11 #5: a section lights up (the Board and the world say it; the feed notes it), goes unanswered (a
        // boo, a feed line, no centre text), or is answered (confetti in the section, the chant).
        if (e.kind === 'req') {
          ctx.feed?.(`Section ${e.sec} wants a ball!`, '#ffd36b');
          if (firstReq) { firstReq = false; if (ctx.SFX?.chant) ctx.SFX.chant(); else ctx.SFX?.bell?.(659); }   // round 12 #2e: the first one each shift
          return;
        }
        // Council round 12 #2c: the Seventh-Inning Stretch, the one centre ALERT; the organ riff (builder 1's SFX.organ).
        if (e.kind === 'stretch') {
          ctx.say?.('ALERT', stretchAlert(e.n ?? 3), { key: 'stretch' });
          if (ctx.SFX?.organ) ctx.SFX.organ(); else { ctx.SFX?.jackpot?.(); ctx.SFX?.bell?.(784); }
          ctx.feed?.(`Seventh-inning stretch: Sections ${[...(e.secs ?? '')].join(', ')}. Five times!`, '#ffd36b');
          return;
        }
        if (e.kind === 'stretchend') { ctx.feed?.(e.missed ? `Stretch over. ${e.hit ?? 0} answered.` : 'Stretch over. Every section answered!'); return; }
        if (e.kind === 'robot') { ctx.feed?.(e.text ?? "The crowd's bored of the robot."); return; }   // round 12 #2a: feed only
        if (e.kind === 'reqmiss') { ctx.feed?.(`Section ${e.sec} wanted a ball.`); ctx.SFX?.boo?.(); return; }
        if (e.kind === 'souv' && e.req) {
          ctx.feed?.(`${who(e.by)}: souvenir to Section ${e.req}! ${e.stretch ? 'Five times!' : 'Triple!'}`, '#ffd36b'); sreq.puff('ABCDEF'.indexOf(e.req)); ctx.SFX?.jackpot?.(); ctx.SFX?.bell?.(784);
          legend = { text: legendLine(e.name ?? ctx.nameOf?.(e.by), e.req), sub: e.stretch ? 'SEVENTH-INNING STRETCH · ×5' : 'SOUVENIR DELIVERED · ×3', until: now + LEGEND_SECS };   // round 12 #2d
          ctx.board?.shout?.(legend.text, LEGEND_SECS);   // and the Board's gold band (builder 4's board.shout)
          return;
        }
        if (e.kind === 'souv') { ctx.feed?.(`${who(e.by)}: ${e.n} souvenir${e.n === 1 ? '' : 's'} to the crowd${e.relay ? '. Relay, double!' : '!'}`); if (e.by === ctx.me?.id) ctx.SFX?.jackpot?.(); return; }
        if (e.kind === 'relay') { if (e.to === ctx.me?.id || e.by === ctx.me?.id) ctx.feed?.(`Hand-off! ${e.to === ctx.me?.id ? 'Run it to the rail' : 'Your mate runs it'}: double.`); return; }
        if (e.kind === 'ping') ping = { text: e.name ?? 'CART', until: now + 3 };
        else if (e.kind === 'knock') knock = { text: (e.name ?? 'A RAT').toUpperCase(), n: e.n, until: now + 5 };
        else if (e.kind === 'lap' && venue === 3 && !storyUp()) ctx.feed?.('A lap of the Track! The crowd approves.');   // C #8: the Stadium only, never under a story card
      },
      tick(dt, t) {
        now = t;
        // Crowd bob: 0.1 + 0.5 s. Above 90% a wave rolls round: the bob pulses along a travelling sine.
        const v = ctx.venues;
        if (v) {
          wavePh += dt;
          const w = waving(s) ? 0.6 + 0.6 * Math.max(0, Math.sin(wavePh * 2.6)) : 1;
          v.crowdBob = stretch ? bobFor(1) * (0.8 + 0.2 * Math.sin(wavePh * 5)) : isBored() ? 0.05 : bobFor(s) * w;   // round 12 #2c: the Stretch stands them all up
        }
        draw();
        sreq.tick(dt, t);
      },
      // Round 11: carrying souvenirs, the HUD says where they go.
      prompt() {
        if (venue !== 3 || !hands) return null;
        const n = Math.abs(hands);
        return carryLine(n, req);   // C #11: 'Souvenirs ×2 → crowd rail' (≤ 8 words), or the lit section
      },
      amb: snap => (snap?.phase === 'shift' ? { crowd: ambFor(s) } : {}),
      reportLines: () => ctx.crew?.()?.venue !== 3 ? [] : [`Crowd now ${Math.round(s * 100)}% ♥, ${laps} laps, ${knocks} knockdowns`],
    };
  },
};
