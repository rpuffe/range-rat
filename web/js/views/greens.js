// The greens, client side, at every venue (council round 10 #6). Server: server/venues/greens.mjs.
//   - the landing marker (council round 7 #2, moved here from views/tiered.js so it shows from the Muni): where a PURE
//     strike with your aim rests, a constant-size disc at a crew bay, 1 draw call, re-aimed at most 10 Hz (5 on the
//     low tier). Inside a green it takes the flag's colour and pulses: from Tiered the TARGET lip counts, before Tiered
//     the green itself ("on the green");
//   - "ON THE GREEN!" (Muni and Club): world text over the flag when a crew ball comes to rest on a green, and the
//     pennant waves hard for a moment. Nothing in the centre.
import * as THREE from 'three';
import { MAP } from '../map.js';
import { inBowl } from '../tiered.js';
import { AIM, createAimer, ringBowl, markerState, markerPulse, markerScale } from '../aim.js';
import { GREENS } from '../greens.js';

const FLAG = { red: 0xff3b5c, yellow: 0xffe14a, blue: 0x4aa8ff };
const MARK_Y = 0.6, FLOAT_SECS = 2.2, WAVE_SECS = 2;

export default {
  id: 'greens',
  venue: 0,
  create(ctx) {
    const root = new THREE.Group(); root.name = 'greens'; ctx.scene.add(root);
    const low = !!ctx.perf?.low;
    // The landing marker: a camera-facing disc, MARK_PX on a 1080p screen whatever the distance, drawn on top, with a
    // dark outline, in your colour (the bowl's inside it, pulsing).
    const dc = document.createElement('canvas'); dc.width = dc.height = 64;
    {
      const g = dc.getContext('2d'), ow = 64 * AIM.MARK_OUTLINE_PX / AIM.MARK_PX;
      g.fillStyle = '#14161c'; g.beginPath(); g.arc(32, 32, 31, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(32, 32, 31 - ow, 0, Math.PI * 2); g.fill();
    }
    const dtex = new THREE.CanvasTexture(dc); dtex.colorSpace = THREE.SRGBColorSpace;
    const markMat = new THREE.SpriteMaterial({ map: dtex, color: 0xffffff, sizeAttenuation: false, depthTest: false, depthWrite: false, transparent: true });
    const mark = new THREE.Sprite(markMat); mark.visible = false; mark.renderOrder = 10; mark.frustumCulled = false;
    root.add(mark);
    // Your swings at this venue, read from the snapshot: a pocket that drops while you stand at a bay is a release.
    const aimSt = { venue: null, swung: false, releasedAt: -Infinity, lastPower: null, idleP: null, pocket: null, atBayAt: -Infinity, rest: null, color: null };
    const hideMark = () => { mark.visible = false; };
    const aimer = createAimer({ hz: low ? AIM.LOW_HZ : AIM.HZ, now: () => performance.now() });

    // ON THE GREEN!: one world sprite, reused.
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    {
      const g = cv.getContext('2d');
      g.font = '900 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 12; g.strokeStyle = '#000d'; g.strokeText('ON THE GREEN!', 256, 64); g.fillStyle = '#b8ff6a'; g.fillText('ON THE GREEN!', 256, 64);
    }
    const float = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
    float.scale.set(8, 2, 1); float.visible = false; float.renderOrder = 6; root.add(float);
    let floatT = 0, wave = null, t = 0;

    return {
      show(on) { root.visible = on; if (!on) { hideMark(); aimer.update(null); } },
      // main.js, every frame: { bay, yaw, pitch, power, color, world } while you stand at a crew bay with balls, else null.
      aim(input) {
        const a = aimSt, s = ctx.crew?.(), venue = s?.endless ? 5 : s?.venue ?? null;
        if (venue !== a.venue) Object.assign(a, { venue, swung: false, releasedAt: -Infinity, lastPower: null, idleP: null, rest: null });
        const pocket = s?.players?.find(p => p.id === ctx.me.id)?.pocket ?? null;
        if (input) {
          if (a.idleP == null) a.idleP = input.power;                 // main.js holds this until you wind up
          a.atBayAt = t;
          a.color = input.color ?? a.color;
        } else a.idleP = null;
        if (pocket != null && a.pocket != null && pocket < a.pocket && t - a.atBayAt < 0.5) {
          a.swung = true; a.releasedAt = t; a.idleP = null;           // released: main.js now holds the strike's power
        }
        a.pocket = pocket;
        // Before the first swing here, winding = the power left main.js's held value; after it, the input already
        // carries the live power while winding and your last swing's otherwise.
        const winding = input && (a.swung ? input.power : (Math.abs(input.power - a.idleP) > 1e-9 ? input.power : 0));
        if (input && a.swung) a.lastPower = input.power;
        else if (input && winding > AIM.WIND_MIN) a.lastPower = winding;
        const q = { power: a.swung ? 0 : winding || 0, lastPower: a.lastPower, swung: a.swung, sinceRelease: t - a.releasedAt, bay: !!input };
        const want = markerState(q);
        let rest = null;
        if (want.power != null && input) rest = a.rest = aimer.update({ ...input, power: want.power });
        else if (want.power != null) rest = a.rest;                     // just released with your last ball: hold it
        else { aimer.update(null); a.rest = null; }
        // From Tiered the TARGET lip counts; before it, the green itself (council round 10 #6: "on the green").
        const bowl = rest ? ((venue ?? 0) >= GREENS.TARGET_VENUE ? ringBowl(rest) : inBowl(rest.x, rest.z)) : null;
        const m = markerState({ ...q, rest, bowl });
        if (!m.visible) { hideMark(); return; }
        const col = m.color ? FLAG[m.color] ?? 0xffffff : a.color ?? '#ffffff';
        mark.visible = true;
        mark.position.set(rest.x, MARK_Y, rest.z);
        mark.scale.setScalar(markerScale(ctx.camera?.fov ?? 60) * markerPulse(m.pulse, t));
        markMat.color.set(col);
      },
      onEvent(e) {
        if (e.t !== 'onGreen') return;
        const b = MAP.BOWLS.find(w => w.id === e.bowl); if (!b) return;
        float.position.set(b.x, 8, b.z); float.visible = true; floatT = 0; float.material.opacity = 1;
        const pen = MAP.FLAGS?.[MAP.BOWLS.indexOf(b)];
        wave = { obj: pen ? ctx.terrain?.root?.getObjectByName?.(`flag-${pen.id}`) : null, t: 0 };
        if (e.by === ctx.me?.id) ctx.SFX?.glint?.();
        else ctx.feed?.(`${ctx.nameOf?.(e.by) ?? 'Someone'} landed one on the green.`, 2.5);
      },
      tick(dt, now) {
        t = now ?? t + dt;
        if (float.visible) {
          floatT += dt;
          float.position.y = 8 + floatT * 0.8;
          float.material.opacity = Math.max(0, 1 - Math.max(0, floatT - FLOAT_SECS * 0.6) / (FLOAT_SECS * 0.4));
          if (floatT >= FLOAT_SECS) float.visible = false;
        }
        if (wave?.obj) {   // the pennant waves hard (terrain.js sets a gentle flutter each frame; this adds on top)
          wave.t += dt;
          wave.obj.rotation.y += 0.9 * Math.sin(wave.t * 14) * Math.max(0, 1 - wave.t / WAVE_SECS);
          if (wave.t >= WAVE_SECS) wave = null;
        }
      },
    };
  },
};
