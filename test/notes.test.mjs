// Owner notes (2026-11-24): stations appear when they matter, first-time tips for new things, mats that wash
// off in streaks, and the spray out of the nozzle. The pure parts: stations.js, tips.js, mud.js, settings.js hints.
import test from 'node:test';
import assert from 'node:assert/strict';
import { stationsShown, popScale, createStations, REVEAL, WASHER_AT, SHED_AT } from '../web/js/stations.js';
import { tipCtx, tipTarget, createTipPointer, TIP } from '../web/js/tips.js';
import { MUD, mudField, mudAlpha, cleanThreshold, paintClean, matUV, matAt, cameClean } from '../web/js/mud.js';
import { HINTS, HINT_ORDER, HINT_WHEN, nextHint, hintText } from '../web/js/settings.js';
import { wordCount, SAY } from '../web/js/say.js';
import { MATS, WASHER_HANDLES, FRIES } from '../web/js/sim.js';

// ---- stations
test('stations: the washer shows from the Ball washer row, the shed once it opens', () => {
  assert.deepEqual(stationsShown({ up: {} }), { washer: false, shed: false });
  assert.deepEqual(stationsShown({ up: { washer: 1 } }), { washer: true, shed: false });
  assert.deepEqual(stationsShown({ up: { shed: 1 } }), { washer: false, shed: true });
  assert.deepEqual(stationsShown({ up: { shed: 0 }, fries: { open: true } }), { washer: false, shed: true });
  assert.deepEqual(stationsShown(null), { washer: false, shed: false });
  assert.equal(WASHER_AT.x, (WASHER_HANDLES.L.x + WASHER_HANDLES.R.x) / 2);
  assert.equal(SHED_AT.z, FRIES.SHED.z + 2.25);
});

test('stations: the pop starts tiny, overshoots, lands on 1', () => {
  assert.ok(popScale(0) > 0 && popScale(0) < 0.1);
  const mid = [0.2, 0.3, 0.4, 0.5, 0.6].map(t => popScale(t));
  assert.ok(Math.max(...mid) > 1, 'a little overshoot');
  assert.equal(popScale(REVEAL.SECS), 1);
  assert.equal(popScale(99), 1);
});

const fakeObj = () => ({ visible: true, scale: { v: 1, setScalar(s) { this.v = s; } } });
test('stations: hidden on a fresh crew, no pop on joining, a pop and a puff when bought mid-game', () => {
  const washer = fakeObj(), shed = fakeObj(), tube = fakeObj(), bursts = [], toggles = [];
  const st = createStations({ washer, shed, tube, burst: (x, y, z) => bursts.push([x, z]), onToggle: (n, on) => toggles.push(`${n}:${on}`) });
  st.update({ phase: 'lobby' });   // main.js's placeholder crew: no `up` yet
  assert.equal(washer.visible, false); assert.equal(shed.visible, false); assert.equal(tube.visible, false);
  st.update({ up: { washer: 0, shed: 0 } });
  assert.equal(washer.visible, false);
  st.update({ up: { washer: 1, shed: 0 } });   // bought
  assert.equal(washer.visible, true); assert.equal(tube.visible, true);
  assert.ok(washer.scale.v < 0.1, 'it pops from small');
  assert.equal(bursts.length, 1);
  for (let i = 0; i < 20; i++) st.tick(0.05);
  assert.equal(washer.scale.v, 1);
  const n = toggles.length;
  st.update({ up: { washer: 1, shed: 0 } }); st.update({ up: { washer: 1, shed: 0 } });
  assert.equal(toggles.length, n, 'no work while nothing changes');

  // Joining a crew that already owns both: they're just there.
  const w2 = fakeObj(), s2 = fakeObj(), b2 = [];
  const st2 = createStations({ washer: w2, shed: s2, burst: () => b2.push(1) });
  st2.update({ phase: 'lobby' }); st2.update({ up: { washer: 2, shed: 1 } });
  assert.equal(w2.visible, true); assert.equal(s2.visible, true); assert.equal(b2.length, 0); assert.equal(w2.scale.v, 1);
});

test('stations: the KITCHEN board (built later with the Club) follows the shed', () => {
  const kitchen = { visible: true, userData: { sign: 'kitchen' } };
  const children = [];
  const scene = { traverse(fn) { for (const c of children) fn(c); } };
  const st = createStations({ scene, shed: fakeObj() });
  st.update({ venue: 0, up: {} });
  children.push(kitchen);                    // the Range Club's venue group arrives
  st.update({ venue: 1, up: { shed: 0 } });
  assert.equal(kitchen.visible, false);
  st.update({ venue: 1, up: { shed: 1 } });
  assert.equal(kitchen.visible, true);
});

// ---- tips
test('tips: every new tip is 8 words or fewer, with keyboard and pad versions', () => {
  for (const id of ['mud', 'crank', 'shed', 'cart', 'dive', 'tube', 'gutters', 'lift']) {
    for (const pad of [false, true]) {
      const t = hintText(id, pad);
      assert.ok(t, `${id} ${pad}`);
      assert.ok(wordCount(t) <= SAY.MAX_WORDS, `${id}: ${t}`);
    }
    assert.ok(HINT_ORDER.includes(id) && HINT_WHEN[id], id);
  }
  assert.match(hintText('mud', false), /E: pressure washer\. Hold Click/);
  assert.match(hintText('mud', true), /Ⓧ: pressure washer\. Hold Ⓐ/);
  assert.match(hintText('cart', false), /F gets in/); assert.match(hintText('cart', true), /Ⓨ gets in/);
  assert.match(hintText('shed', false), /Click at the counter/); assert.match(hintText('shed', true), /Ⓐ at the counter/);
  assert.match(hintText('lift', false), /E on the platform/); assert.match(hintText('lift', true), /Ⓧ on the platform/);
  for (const id of Object.keys(HINTS)) assert.ok(id in HINT_WHEN || ['shop', 'sprint', 'cctv'].includes(id), id);
});

test('tips: each fires on its condition, once (the hinter keeps the seen list)', () => {
  const base = { seen: ['shop', 'sprint', 'cctv', 'bv'], playSecs: 100, day: 3 };
  assert.equal(nextHint({ ...base, up: {} }), null);
  assert.equal(nextHint({ ...base, up: { washer: 1 } }), 'crank', 'right after buying the washer');
  assert.equal(nextHint({ ...base, up: { washer: 0 }, washerCash: 20 }), null, 'no washer tips while it is hidden');
  assert.equal(nextHint({ ...base, up: { shed: 1 } }), 'shed');
  assert.equal(nextHint({ ...base, up: { cart: 1 } }), 'cart');
  assert.equal(nextHint({ ...base, up: { pond: 1 } }), 'tube');
  assert.equal(nextHint({ ...base, up: { gutters: 1 } }), 'gutters');
  assert.equal(nextHint({ ...base, up: {}, venue: 5 }), 'lift');
  assert.equal(nextHint({ ...base, up: {}, myDive: 1 }), 'dive', 'dive gear bought');
  assert.equal(nextHint({ ...base, up: {}, matMudNear: 0.4 }), null);
  assert.equal(nextHint({ ...base, up: {}, matMudNear: 0.6 }), 'mud', 'a muddy mat near you');
  assert.equal(nextHint({ ...base, up: {}, matMudMax: 0.95 }), 'mud', 'a customer refuses a mat');
  assert.equal(nextHint({ ...base, seen: [...base.seen, 'mud'], up: {}, matMudMax: 0.95 }), null, 'once ever');
});

test('tips: tipCtx reads the mats near me and the worst one', () => {
  const crew = { up: { washer: 1 }, fixtures: { mat0: 0.7, mat9: 0.95 } };
  const near0 = tipCtx(crew, { x: MATS[0].x, z: 2, dive: 1 });
  assert.equal(near0.matMudNear, 0.7); assert.equal(near0.matMudMax, 0.95); assert.equal(near0.myDive, 1); assert.deepEqual(near0.up, { washer: 1 });
  assert.equal(tipCtx(crew, { x: 100, z: 100 }).matMudNear, 0);
  assert.deepEqual(tipCtx(null, null), { up: null, myDive: 0, matMudNear: 0, matMudMax: 0 });
});

test('tips: the pointer points for a while, then goes (or when you get there)', () => {
  const crew = { fixtures: { mat3: 0.8 } };
  assert.deepEqual(tipTarget('mud', crew, { wand: false }).x, 36, 'no wand: the pressure washer first');
  assert.equal(tipTarget('mud', crew, { wand: true }).x, MATS[3].x, 'with the wand: the muddiest mat');
  assert.equal(tipTarget('bank', crew, {}), null);
  const p = createTipPointer();
  const me = { x: 0, z: 30 };
  assert.equal(p.target(0.1, crew, me), null, 'nothing to point at yet');
  p.point('crank');
  assert.ok(p.target(0.1, crew, me));
  assert.equal(p.target(0.1, crew, me, false), null, 'hidden while another text holds the centre');
  assert.equal(p.target(TIP.POINT_SECS, crew, me), null, 'gone after its time');
  p.point('crank');
  assert.equal(p.target(0.1, crew, { x: WASHER_HANDLES.R.x, z: WASHER_HANDLES.R.z }), null, 'gone when you get there');
  assert.equal(p.target(0.1, crew, me), null);
});

// ---- mud
test('mud: the field is deterministic, in range, with splotches and bare patches', () => {
  const a = mudField(64, 7), b = mudField(64, 7);
  assert.deepEqual(a.density, b.density);
  let lo = 1, hi = 0, heavy = 0;
  for (const v of a.density) { lo = Math.min(lo, v); hi = Math.max(hi, v); if (v > 0.6) heavy++; }
  assert.ok(lo >= 0 && hi <= 1); assert.ok(hi > 0.9, 'real splotches');
  const frac = heavy / a.density.length;
  assert.ok(frac > 0.15 && frac < 0.85, `splotchy, not a flat tint (${frac.toFixed(2)})`);
  let nlo = 1, nhi = 0; for (const v of a.noise) { nlo = Math.min(nlo, v); nhi = Math.max(nhi, v); }
  assert.ok(nlo === 0 && nhi === 1, 'noise spans 0..1');
});

test('mud: it washes off in patches as the mud falls, not as one fade', () => {
  const F = mudField(64, 7);
  const cover = (mud, mem = null) => { let s = 0; for (let i = 0; i < F.density.length; i++) s += mudAlpha(F.density[i], F.noise[i], mem ? mem[i] : 0, mud); return s / F.density.length; };
  const full = cover(1), half = cover(0.4), none = cover(MUD.CLEAN - 0.01);
  assert.ok(full > half && half > none);
  assert.ok(none < 0.02 * full + 1e-6, 'spotless at the clean line');
  // Patches: at a middle mud, texels are mostly fully on or off (not all at the same half alpha).
  let mids = 0, n = 0; for (let i = 0; i < F.density.length; i++) { if (F.density[i] < 0.8) continue; n++; const k = mudAlpha(F.density[i], F.noise[i], 0, 0.4) / F.density[i]; if (k > 0.15 && k < 0.85) mids++; }
  assert.ok(mids / n < 0.35, `patchy: ${mids}/${n} half-washed texels`);
  assert.ok(cleanThreshold(0.5, 1) > cleanThreshold(0.5, 0), 'sprayed texels wash first');
  assert.ok(cleanThreshold(1, 1) <= 0.98);
});

test('mud: the spray paints a streak along its direction, where it lands', () => {
  const S = MUD.MEM, mem = new Float32Array(S * S);
  assert.equal(paintClean(mem, S, 2, 2, 1, 0), false, 'off the mat: nothing');
  assert.ok(paintClean(mem, S, 0.5, 0.5, 1, 0, 0.5));
  const at = (u, v) => mem[Math.floor(v * S) * S + Math.floor(u * S)];
  assert.ok(at(0.5, 0.5) > 0.4);
  assert.ok(at(0.65, 0.5) > at(0.5, 0.65), 'longer along the jet than across it');
  assert.equal(at(0.05, 0.05), 0);
  for (let i = 0; i < 20; i++) paintClean(mem, S, 0.5, 0.5, 1, 0, 0.5);
  assert.ok(Math.max(...mem) <= 1);
  // Washing with a streak shows less mud there than elsewhere at the same mud level.
  const F = mudField(S, 7);
  const i0 = Math.floor(0.5 * S) * S + Math.floor(0.5 * S);
  assert.ok(mudAlpha(1, F.noise[i0], mem[i0], 0.6) <= mudAlpha(1, F.noise[i0], 0, 0.6));
});

test('mud: mats by position, and the clean moment', () => {
  assert.deepEqual(matUV(MATS[2].x, 0, MATS[2].x), { u: 0.5, v: 0.5 });
  assert.equal(matUV(MATS[2].x + 1, 0, MATS[2].x), null);
  assert.equal(matAt(MATS[4].x + 0.3, -0.2, MATS), 4);
  assert.equal(matAt(MATS[4].x + 2, 0, MATS), -1, 'between mats');
  assert.ok(cameClean(0.3, 0.04)); assert.ok(!cameClean(0.04, 0)); assert.ok(!cameClean(0.3, 0.2));
});

// ---- the spray: mates see it (snapshot players[].spray while their wash acts land)
import { Crew } from '../server/crew.mjs';
import { WASH, FIXTURE_BY_ID } from '../web/js/sim.js';
test('spray: the snapshot says who is spraying, for 400 ms after their last wash', () => {
  const clock = { t: 1_000_000 };
  const crew = new Crew('NOTE', null, { shiftSecs: 600, seed: 3, now: () => clock.t });
  const p = crew.join('W'); crew.connect(p); p.x = WASH.STATION.x; p.z = WASH.STATION.z;
  crew.input(p, { a: [{ t: 'wand' }] });
  assert.equal(p.wand, true);
  clock.t += 1000;
  const me = () => crew.snapshot().players.find(q => q.id === p.id);
  assert.equal(me().spray, false, 'holding the wand is not spraying');
  const sg = FIXTURE_BY_ID.sign; p.x = sg.x; p.z = sg.z - 3;
  crew.fixtures.sign = 0.8;
  assert.equal(crew.wash(p, 0.25, 'sign'), true);
  assert.equal(me().spray, true);
  clock.t += 500;
  assert.equal(me().spray, false);
});
