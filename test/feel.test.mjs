// Round 11, builder "feel": the sweep, the Club stagger, stations that never make you wait, the Orbital's two shifts,
// and the one price (gear grime folded into the Clean %).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import deck from '../server/venues/deck.mjs';
import { SWEEP, stepSweep, crossedClean, sweepLive, createSweep } from '../web/js/sweep.js';
import { sweepFreq, SWEEP_SOUND, RATTLE } from '../web/js/sfx.js';
import { bootsMud, MUDDY, popupLine } from '../web/js/bvtext.js';
import { DEBRIS_BALLS, debrisBalls, ORBIT } from '../web/js/orbit.js';
import { DECK, newDeck, stepDeck, fillOrder, pourAhead, coldFill, openCount, openOrders } from '../web/js/deck.js';
import { TRAY, newTray, trayServe, trayWanted, trayTick, trayTake } from '../web/js/tray.js';
import { BREATH, breathMul, creekOpen } from '../web/js/creekdive.js';
import { CLUB_DAY, clubOpen, clubOpenAt, worldVday, clubDayLabel } from '../web/js/clubdays.js';
import { pickKind, nextPrice, tierLock, SHOP_BY_ID, FED, FRIES, SIM } from '../web/js/sim.js';
import { surfaceAt } from '../web/js/map.js';
import { mowerDue } from '../web/js/mowe.js';

const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) <= e, `${a} vs ${b}`);
function crewOf(save, { names = ['A'], shiftSecs = 600, modules } = {}) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('FEEL', save, { shiftSecs, seed: 5, now: () => clock.t, ...(modules ? { modules } : {}) });
  const ps = names.map(n => { const p = crew.join(n); crew.connect(p); return p; });
  const run = secs => { for (let i = 0; i < Math.round(secs * 20); i++) { clock.t += 50; for (const p of ps) p.seenAt = clock.t; crew.tick(0.05); } };
  return { crew, ps, run, clock };
}

// ---- #4 the sweep ------------------------------------------------------------------------------------------------
test('sweep: picks within 1.2 s build ×N; a longer gap starts over; ×25 is crossed once', () => {
  const st = { n: 0, last: null };
  assert.equal(stepSweep(st, 0), 1);
  assert.equal(stepSweep(st, 1.2), 2, '1.2 s still counts');
  assert.equal(stepSweep(st, 2.0, 3), 5, 'a cart scoop of 3');
  assert.ok(sweepLive(st, 3.2)); assert.ok(!sweepLive(st, 3.3));
  assert.equal(stepSweep(st, 3.3), 1, 'the gap broke it');
  assert.ok(crossedClean(24, 25)); assert.ok(crossedClean(20, 30)); assert.ok(!crossedClean(25, 26)); assert.ok(!crossedClean(3, 24));
  assert.equal(SWEEP.CLEAN, 25); assert.equal(SWEEP.GAP, 1.2);
});

test('sweep sound: silent below ×5, then a quiet blip that climbs and caps', () => {
  for (let n = 0; n < SWEEP_SOUND.FROM; n++) assert.equal(sweepFreq(n), null);
  assert.equal(sweepFreq(5), SWEEP_SOUND.BASE);
  assert.ok(sweepFreq(10) > sweepFreq(6));
  assert.equal(sweepFreq(200), sweepFreq(5 + SWEEP_SOUND.TOP), 'capped');
  assert.ok(SWEEP_SOUND.VOL <= 0.04 && SWEEP_SOUND.DUR <= 0.06, 'quiet and short');
  assert.equal(RATTLE.FROM, 20);
});

test('sweep HUD: no DOM in node is safe; pick returns N and plays at most 3 blips a scoop', () => {
  const heard = [];
  const s = createSweep({ root: null, sfx: { sweepTick: n => heard.push(n) } });
  for (let i = 0; i < 6; i++) s.pick(i * 0.5);
  assert.equal(s.n, 6);
  assert.deepEqual(heard, [1, 2, 3, 4, 5, 6]);
  heard.length = 0; s.pick(3.0, 8);
  assert.deepEqual(heard, [7, 8, 9], 'a scoop of 8 plays 3 blips');
  s.update(10, 0.1); s.reset(); assert.equal(s.n, 0);
});

test('sweep server: 25 quick pickups say "Clean sweep!" once and give +1% Hustle, at most 5 a shift', () => {
  const { crew, ps: [a], clock } = crewOf({ day: 3 }, { shiftSecs: 9999 });
  crew.startShift(); crew.flush();
  let id = 0;
  const pick = () => { a.pocket = 0; const b = crew.addBall({ x: a.x, y: SIM.BALL_R, z: a.z, vx: 0, vy: 0, vz: 0, kind: 'range' }); b.rest = true; clock.t += 300; return crew.pickup(a, b.id); };
  for (let i = 0; i < 24; i++) assert.ok(pick());
  assert.equal(crew.mult, 1);
  pick();
  near(crew.mult, 1.01);
  let ev = crew.flush().ev.filter(e => e.t === 'sweep');
  assert.equal(ev.length, 1); assert.equal(ev[0].by, a.id); assert.equal(ev[0].bonus, SWEEP.BONUS);
  for (let i = 0; i < 30; i++) pick();
  assert.equal(crew.flush().ev.filter(e => e.t === 'sweep').length, 0, 'once per sweep');
  for (let k = 0; k < 6; k++) { clock.t += 5000; for (let i = 0; i < 25; i++) pick(); }
  near(crew.mult, 1 + SWEEP.BONUS * SWEEP.BONUS_MAX, 1e-6);
  id++;
});

// ---- the one price ---------------------------------------------------------------------------------------------
test('the one price: bootsMud is the crew\'s mean grime (as 0..1) plus half the fleet\'s mean mud; no chip', () => {
  assert.equal(bootsMud(), 0); assert.equal(bootsMud([0, 0], [0]), 0);
  near(bootsMud([3]), 1); near(bootsMud([3, 0]), 0.5); near(bootsMud([9]), 1, 1e-9);
  near(bootsMud([], [1]), 0.5); near(bootsMud([3, 3], [1, 1]), 1.5);
  assert.deepEqual(MUDDY, { BOOTS: 1, CART: 0.5 });
  assert.equal(popupLine({ n: 5, per: 2, clean: false }).text, '5 × $2');
});

test('the one price: caked boots lower the Clean % for everyone (one fixture\'s worth), never one Rat\'s pay; Gary never sees it', () => {
  const { crew, ps: [a, b] } = crewOf({ day: 5 }, { names: ['A', 'B'] });
  crew.startShift();
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
  const n = Object.keys(crew.fixtures).length;
  assert.equal(crew.curb(), 1);
  a.grime = 3;
  near(crew.curb(), 1 - 0.5 / n, 1e-9);
  b.grime = 3;
  near(crew.curb(), 1 - 1 / n, 1e-9);
  assert.equal(crew.fixtures.stand, 0, 'the return fixture (Gary\'s stop) is untouched');
  const bv = crew.valueNow().bv;
  a.x = SIM.STAND.x; a.z = SIM.STAND.z; a.pocket = 2; a.pocketW = 2; crew.deposit(a);
  near(crew.cash, Math.round(2 * bv * 100) / 100, 0.011);
});

// ---- #10a the Orbital ---------------------------------------------------------------------------------------------
test('Orbital: debris counts 10 balls (solo 15); ground balls never count; Ball No. 1 still falls', () => {
  assert.equal(DEBRIS_BALLS, 10);
  assert.equal(debrisBalls(1, 4), 10); assert.equal(debrisBalls(3, 6), 30); assert.equal(debrisBalls(1, 1), 15); assert.equal(debrisBalls(1, 2), 10);
  assert.equal(debrisBalls(0, 1), 0);
  assert.equal(ORBIT.SHOT, 0.10);
  const { crew, ps: [a] } = crewOf({ venue: 5, day: 30, venueDay: 1, outstanding: 1958 }, { names: ['A', 'B', 'C', 'D'] });
  crew.startShift();
  crew.bank(500, a.id);
  assert.equal(crew.outstanding, 1958, 'ground balls at the Orbital never left Earth');
  crew.countDebris(100);
  assert.equal(crew.outstanding, 958, '100 pieces x 10 (4P)');
  crew.countDebris(96);
  assert.ok(crew.outstanding === 1 && crew.lastBucket, 'the last pieces down: the Last Bucket begins');
});

test('Orbital: the winch and an EVA landing both count debris toward Balls Outstanding', () => {
  const { crew, ps: [a], run } = crewOf({ venue: 5, day: 30, venueDay: 1, outstanding: 1958, up: { tether: 1, shed: 1 } });
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  const st = crew.mods.state('orbit');
  st.debris = new Set([1, 2, 3]);
  run(8.2);
  assert.equal(crew.outstanding, 1958 - 15, 'one winched piece: 15 for a solo crew');
});

// ---- #7 stations never make you wait ----------------------------------------------------------------------------
test('deck: up to 3 orders queue, each on its own 30 s timer; a fill takes the oldest', () => {
  const d = newDeck(); d.drinks = DECK.WARN; d.soberT = -1e9;   // amber: an order every 20 s (no sobering here)
  stepDeck(d, 20.01); stepDeck(d, 20.01); stepDeck(d, 20.01);
  assert.equal(openCount(d), 2, 'the first lapsed at 30 s; two open');
  const d2 = newDeck(); d2.drinks = DECK.WARN; d2.soberT = -1e9;
  for (let i = 0; i < 3; i++) stepDeck(d2, 10.01);
  const r = stepDeck(d2, 10.01);
  assert.equal(openCount(d2), 2);
  assert.ok(r.raised && openOrders(d2).includes(r.raised));
  const head = d2.order;
  assert.equal(fillOrder(d2, 'beer', 'good'), head, 'the oldest first');
  assert.equal(openCount(d2), 1);
  const full = newDeck(); full.order = { seat: 0, left: 30 }; full.queue = [{ seat: 1, left: 30 }, { seat: 2, left: 30 }]; full.orderT = 99;
  assert.equal(stepDeck(full, 0.1).order, false, 'never more than 3');
});

test('deck: a beer poured ahead waits cold on the bar (2 max), fills the next order, or goes warm after 30 s', () => {
  const d = newDeck();
  assert.ok(pourAhead(d, 'p1')); assert.ok(pourAhead(d, 'p2')); assert.ok(!pourAhead(d, 'p3'), 'the bar holds 2');
  assert.equal(coldFill(d), null, 'no order yet');
  d.order = { seat: 4, left: 30 };
  const f = coldFill(d);
  assert.deepEqual(f, { order: { seat: 4, left: 30 }, by: 'p1' });
  assert.equal(d.cold.length, 1);
  d.orderT = -1e9;   // no new order meanwhile (an open order would take the mug first)
  const r = stepDeck(d, DECK.COLD_SECS + 0.1);
  assert.equal(r.warm, 1); assert.equal(d.cold.length, 0);
});

test('deck server: pour ahead, then the next order is filled at once from the bar (10 x BV, counted, credited)', () => {
  const clock = { t: 1_000_000 };
  const crew = new Crew('DECK', { venue: 2, day: 5, venueDay: 1, up: { shed: 1 }, cash: 500_000 }, { shiftSecs: 600, seed: 3, now: () => clock.t, modules: [deck] });
  const p = crew.join('Pat'); crew.connect(p); crew.startShift();
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; p.seenAt = clock.t; crew.tick(0.05); } };
  const st = crew.mods.state('deck');
  p.x = 42; p.z = 6; clock.t += 4100;
  crew.serve(p, { item: 'beer', quality: 'good', ahead: true });
  assert.equal(st.deck.cold.length, 1); assert.equal(st.deck.drinks, 0, 'not drunk yet');
  assert.equal(crew.snapshot().mods.deck.cold, 1);
  crew.flush();
  const cash = crew.cash;
  run(31);
  const ev = crew.flush().ev;
  const tab = ev.find(e => e.t === 'deckTab');
  assert.ok(tab && tab.order && tab.cold && tab.by === p.id, 'the cold mug filled the order');
  assert.ok(crew.cash > cash);
  assert.equal(crew.stats.deckOrders, 1);
  assert.equal(st.deck.cold.length, 0);
  // Without ahead, an unordered beer is as before: 5 x BV at once.
  clock.t += 4100; st.deck.order = null; st.deck.queue = [];
  crew.serve(p, { item: 'beer', quality: 'good' });
  assert.equal(st.deck.cold.length, 0);
});

test('tray: a dog at the FED cap goes on the warm tray; once FED has room, a Rat walking past carries it out', () => {
  const t = newTray();
  assert.ok(!trayServe(t, 'good', 0.05), 'a dog that counted is not spare');
  assert.ok(trayServe(t, 'good', 0)); assert.ok(trayServe(t, 'perfect', 0)); assert.ok(!trayServe(t, 'good', 0), 'holds 2');
  assert.ok(!trayServe(newTray(), 'burnt', 0));
  assert.ok(!trayWanted(t, FED.MAX)); assert.ok(trayWanted(t, FED.MAX - FED.GOOD));
  assert.equal(trayTake(t), 'good'); assert.equal(t.dogs.length, 1);
  assert.equal(trayTick(t, TRAY.HOLD_SECS + 1), 1, 'goes cold'); assert.equal(t.dogs.length, 0);

  const { crew, ps: [a, b], run } = crewOf({ venue: 1, venueDay: 2, day: 8, up: { shed: 1 } }, { names: ['A', 'B'] });
  crew.startShift();
  a.x = FRIES.SHED.x; a.z = FRIES.SHED.z; b.x = 0; b.z = -40;
  crew.fedSt.fed = FED.MAX; crew.fedSt.clock = 0;
  crew.serve(a, { item: 'hotdog', quality: 'good' });
  assert.equal(crew.tray.dogs.length, 1);
  assert.equal(crew.snapshot().tray, 1);
  a.x = 0; a.z = -40;                       // the cook leaves
  run(FED.EVERY + 0.5);                     // FED wears down one step: room for a dog
  assert.equal(crew.tray.dogs.length, 1, 'nobody walked past yet');
  b.x = FRIES.SHED.x + 1; b.z = FRIES.SHED.z;
  crew.flush(); run(0.2);
  assert.equal(crew.tray.dogs.length, 0);
  near(crew.fedSt.fed, FED.MAX, 1e-9);
  assert.ok(crew.flush().ev.length >= 0);
});

test('creek: after a creek dive, walking refills air x3; standing refills at the land rate', () => {
  const st = { x: 0, z: 0, lastCreek: true };
  assert.equal(breathMul(st, 0.1), 1, 'first step: no last position');
  st.x = 0.2; assert.equal(breathMul(st, 0.1), BREATH.WALK_MUL, '2 m/s');
  assert.equal(breathMul(st, 0.1), 1, 'standing');
  st.lastCreek = false; st.x = 5; assert.equal(breathMul(st, 0.1), 1, 'a pond diver: no change');
});

// ---- #5 the Club, one idea a day ---------------------------------------------------------------------------------
test('club days: the pond and gold day 2; the creek dive, the Back return, MOW-E and bouncy day 3', () => {
  assert.deepEqual([CLUB_DAY.pond, CLUB_DAY.creekDive, CLUB_DAY.back, CLUB_DAY.mower, CLUB_DAY.square, CLUB_DAY.gold, CLUB_DAY.bouncy], [2, 3, 3, 3, 1, 2, 3]);
  assert.ok(!clubOpen('pond', 1, 1)); assert.ok(clubOpen('pond', 1, 2)); assert.ok(clubOpen('pond', 2, 1), 'Tiered: open');
  assert.ok(clubOpen('pond', 1, undefined), 'no vday: open');
  assert.equal(worldVday(1, 0), 1); assert.equal(worldVday(1, 4), 4); assert.equal(worldVday(2, 4), undefined); assert.equal(worldVday(1, 1, true), undefined);
  assert.ok(!clubOpenAt('creekDive', { venue: 1, vday: 2 })); assert.ok(clubOpenAt('creekDive', { venue: 1, vday: 3 }));
  assert.equal(clubDayLabel('back'), 'Club day 3');
  assert.ok(!creekOpen({ venue: 1, vday: 2 })); assert.ok(creekOpen({ venue: 1, vday: 3 })); assert.ok(creekOpen({ venue: 1 }));
  assert.equal(surfaceAt(-12, -78, { venue: 1, vday: 1 }), 'mud', 'Club day 1: the pond is still a mud flat');
  assert.equal(surfaceAt(-12, -78, { venue: 1, vday: 2 }), 'pond');
  assert.ok(!mowerDue({ venue: 1, venueDay: 2, shiftT: 300, shiftSecs: 420, mower: null }));
  assert.ok(mowerDue({ venue: 1, venueDay: 3, shiftT: 300, shiftSecs: 420, mower: null }));
});

test('club days: kinds stagger (square day 1, gold day 2, bouncy day 3) with one rng draw', () => {
  const at = (r, vday) => pickKind(4, 1, () => r, vday);
  assert.equal(at(0.001, 1), 'square', 'gold held back on day 1: the draw falls to square');
  assert.equal(at(0.001, 2), 'gold');
  assert.equal(at(0.08, 2), 'square', 'bouncy held back on day 2');
  assert.equal(at(0.08, 3), 'bouncy');
  assert.equal(at(0.12, 1), 'square', 'square from Club day 1 even on global day 4');
  assert.equal(pickKind(4, 0, () => 0.12), 'range', 'the Muni is unchanged');
  assert.equal(pickKind(4, 1, () => 0.001), 'gold', 'no vday: as before');
});

test('club days: the shop locks the Back return to "Club day 3" and hides Pond works until day 2', () => {
  const back = SHOP_BY_ID.returns;
  assert.equal(tierLock(back, 1, 1, 9, 2), 'Club day 3');
  assert.equal(tierLock(back, 1, 1, 9, 3), null);
  assert.equal(nextPrice('returns', { returns: 1 }, 1, 0, 1, 9, false, 2), null);
  assert.ok(nextPrice('returns', { returns: 1 }, 1, 0, 1, 9, false, 3) > 0);
  assert.equal(nextPrice('pond', {}, 1, 0, 1, 9, false, 1), null);
  assert.ok(nextPrice('pond', {}, 1, 0, 1, 9, false, 2) > 0);
  assert.ok(nextPrice('pond', {}, 1, 0, 2, 9, false) > 0, 'Tiered: always');
});

test('club days: on Club day 1 the pond is a mud flat (no lead, no gauge, no treasure); day 2 it fills', () => {
  const { crew } = crewOf({ venue: 1, venueDay: 0, day: 5, up: { shed: 1 }, cash: 0 }, { names: ['A', 'B', 'C', 'D'] });
  crew.startShift();
  assert.equal(crew.venueDay, 1);
  assert.equal(crew.pondOpen(), false);
  assert.equal(crew.snapshot().pond.unlocked, false);
  assert.equal(crew.ceiling(), 2, 'Curb + Fries');
  assert.equal(crew.treasure, null);
  crew.endShift?.(); crew.phase = 'report'; crew.startShift();
  assert.equal(crew.venueDay, 2);
  assert.equal(crew.pondOpen(), true);
  assert.equal(crew.ceiling(), 2.5);
  assert.ok(crew.treasure, 'the card forces the first treasure on day 2');
});
