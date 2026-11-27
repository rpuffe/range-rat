// Council round 14 #2a (builder 2): Happy Hour's look and sound at Tiered. A neon beam (Tiered's magenta and cyan) over
// every lounger's ball on the target greens, shrinking with its clock; the one centre ALERT; the feed lines. The deck's
// tickets are views/deck.js's (the queue fills at once, server side). The rules are ../happyhour.js; the server is
// server/venues/happyhour.mjs. Xbox budget: the beams are one InstancedMesh, built once; no per-frame allocations.
import * as THREE from 'three';
import { HAPPY, HAPPY_ALERT, HAPPY_BONUS_ALERT, HAPPY_LAPSE_LINE, happyCarryLine } from '../happyhour.js';

const MAXB = 6, BEAM_H = 14;
const PINK = 0xff3fb4, CYAN = 0x3ff0ff;

function beamGeometry() {               // an open cylinder, pink with a cyan band (vertex colours: one draw call)
  const g = new THREE.CylinderGeometry(0.6, 1.0, BEAM_H, 12, 4, true); g.translate(0, BEAM_H / 2, 0);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.setHex(Math.floor(pos.getY(i) / (BEAM_H / 4) + 1e-6) === 2 ? CYAN : PINK);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

export default {
  id: 'happyhour',
  venue: HAPPY.VENUE,
  create(ctx) {
    const root = new THREE.Group(); root.name = 'happyhour'; root.visible = false; ctx.scene.add(root);
    const beams = new THREE.InstancedMesh(beamGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide }), MAXB);
    beams.frustumCulled = false; beams.count = 0; beams.renderOrder = 3; root.add(beams);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3();
    let list = [], held = 0, venue = 0;
    const who = id => (id === ctx.me?.id ? 'You' : ctx.nameOf?.(id) ?? 'A Rat');

    return {
      show(v) { root.visible = v; },
      onSnapshot(s, mine) {
        venue = s?.endless ? 6 : s?.venue ?? 0;
        const on = venue === HAPPY.VENUE && s?.phase === 'shift';
        list = on ? mine?.balls ?? [] : [];
        held = on ? mine?.held?.[ctx.me?.id] ?? 0 : 0;
      },
      onEvent(e) {
        if (e.t !== 'happy') return;
        if (e.phase === 'start') {
          ctx.say?.('ALERT', e.bonus ? HAPPY_BONUS_ALERT : HAPPY_ALERT, { key: 'happyhour' });   // the one centre ALERT (say.js -> centre.js)
          ctx.SFX?.organ?.();
          setTimeout(() => ctx.SFX?.scoop?.(), 1800);                                         // the chips land
        } else if (e.phase === 'bell') { ctx.SFX?.bell?.(784); ctx.feed?.(`${who(e.by)} rang the Members' Bell.`, '#ffd36b'); }
        else if (e.phase === 'take') { if (e.by === ctx.me?.id) ctx.SFX?.glint?.(); }
        else if (e.phase === 'bank') { ctx.feed?.(`${e.by ? who(e.by) : 'Someone'} returned a lounger's ball! ×${HAPPY.BALL_PAY}`, '#ff9be0'); ctx.SFX?.jackpot?.(); }
        else if (e.phase === 'lapse') ctx.feed?.(HAPPY_LAPSE_LINE);
      },
      tick(dt, t) {
        let n = 0;
        if (root.visible && venue === HAPPY.VENUE) {
          const balls = ctx.balls?.();
          for (const e of list) {
            if (n >= MAXB) break;
            const b = balls?.get?.(e.id);
            const k = Math.max(0.25, Math.min(1, e.t / HAPPY.BALL_SECS_1P)) * (1 + 0.07 * Math.sin(t * 7 + n));
            p3.set(b ? b.x : e.x, 0, b ? b.z : e.z); s3.set(k, 0.4 + 0.6 * k, k); q.identity();
            beams.setMatrixAt(n++, m4.compose(p3, q, s3));
          }
        }
        beams.count = n; beams.instanceMatrix.needsUpdate = n > 0;
      },
      prompt() { return held > 0 && venue === HAPPY.VENUE ? happyCarryLine(held) : null; },
    };
  },
};
