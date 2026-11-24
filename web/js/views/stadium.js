// The Stadium's look (council round 4, §3.2): the Ping Track paint, the crowd's bob and wave, the jumbotron
// (CROWD ♥, PING!, KNOCKDOWN CAM) and the ambience crowd level. The rules live in ../stadium.js.
import * as THREE from 'three';
import { MAP } from '../map.js';
import { bobFor, ambFor, waving, bored } from '../stadium.js';

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
    const draw = () => {
      const pct = Math.round(s * 100), msg = knock && now < knock.until ? 'k' : ping && now < ping.until ? 'p' : '';
      const key = `${pct}|${laps}|${msg}|${msg === 'k' ? knock.text : msg === 'p' ? ping.text : ''}|${bored(s)}`;
      if (key === lastDraw) return; lastDraw = key;
      x.fillStyle = msg === 'k' ? '#3a0a0a' : '#0a0c12'; x.fillRect(0, 0, CW, CH);
      x.textAlign = 'center'; x.textBaseline = 'middle';
      if (msg === 'k') {
        x.fillStyle = '#ff4a3d'; x.font = 'bold 54px system-ui, sans-serif'; x.fillText('KNOCKDOWN CAM', CW / 2, 70);
        x.fillStyle = '#fff8ec'; x.font = 'bold 44px system-ui, sans-serif'; x.fillText(knock.text, CW / 2, 150);
        x.fillStyle = '#ffd36b'; x.font = '600 28px system-ui, sans-serif'; x.fillText(`${knock.n} TODAY`, CW / 2, 205);
      } else if (msg === 'p') {
        x.fillStyle = '#6bf0ff'; x.font = 'bold 76px system-ui, sans-serif'; x.fillText('PING!', CW / 2, 90);
        x.fillStyle = '#fff8ec'; x.font = 'bold 44px system-ui, sans-serif'; x.fillText(ping.text, CW / 2, 175);
      } else {
        x.fillStyle = bored(s) ? '#8a93a6' : '#fff8ec'; x.font = 'bold 40px system-ui, sans-serif';
        x.fillText(bored(s) ? 'THE CROWD IS BORED' : `LAPS TODAY: ${laps}`, CW / 2, 80);
      }
      // the crowd meter, always at the bottom
      x.fillStyle = '#e63a6e'; x.font = 'bold 34px system-ui, sans-serif'; x.textAlign = 'left';
      x.fillText(`CROWD ♥ ${pct}%`, 28, 250);
      x.fillStyle = '#222836'; x.fillRect(290, 232, 194, 36);
      x.fillStyle = bored(s) ? '#8a93a6' : s > 0.9 ? '#ffd36b' : '#e63a6e'; x.fillRect(290, 232, 194 * s, 36);
      tex.needsUpdate = true;
    };
    draw();

    let warn = false;                     // round 7 #7: the Two-Minute Warning is up (the server's mods.stadium.w)
    return {
      banner: () => (warn ? { text: 'TWO-MINUTE WARNING', bg: '#d98a12', fg: '#1a1203' } : null),   // the Board, T-120 to Last Call
      show(on) {
        group.visible = on;
        if (!on && ctx.venues) ctx.venues.crowdBob = 0.15;
      },
      onSnapshot(_snap, mine) {
        warn = !!mine?.w;
        if (!mine) return;
        s = mine.s; laps = mine.laps; knocks = mine.knocks;   // the jumbotron keeps the live mood (the Board grades k)
        if (bored(s) && !boredSaid) { boredSaid = true; ctx.toast?.('THE CROWD IS BORED', 3); }
        else if (s > 0.4) boredSaid = false;
      },
      onEvent(e) {
        if (e.t !== 'crowd') return;
        if (e.kind === 'ping') ping = { text: e.name ?? 'CART', until: now + 3 };
        else if (e.kind === 'knock') knock = { text: (e.name ?? 'A RAT').toUpperCase(), n: e.n, until: now + 5 };
        else if (e.kind === 'lap') ctx.feed?.('A lap of the Track! The crowd approves.');
      },
      tick(dt, t) {
        now = t;
        // Crowd bob: 0.1 + 0.5 s. Above 90% a wave rolls round: the bob pulses along a travelling sine.
        const v = ctx.venues;
        if (v) {
          wavePh += dt;
          const w = waving(s) ? 0.6 + 0.6 * Math.max(0, Math.sin(wavePh * 2.6)) : 1;
          v.crowdBob = bored(s) ? 0.05 : bobFor(s) * w;
        }
        draw();
      },
      amb: snap => (snap?.phase === 'shift' ? { crowd: ambFor(s) } : {}),
      reportLines: () => ctx.crew?.()?.venue !== 3 ? [] : [`Crowd now ${Math.round(s * 100)}% ♥, ${laps} laps, ${knocks} knockdowns`],
    };
  },
};
