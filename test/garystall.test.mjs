// Council round 8 #2: Gary goes further. Every Rat a different job at his warning, and a crew ball on his cart while
// he drives stalls him ("taking notes"): GARY.STALL s, at most GARY.STALLS times a visit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { dealGary } from '../web/js/nudge.js';
import { GARY } from '../web/js/sim.js';

const rat = (id, x, z) => ({ id, x, z });
const STOPS = [{ id: 'sign', x: 14, z: 13 }, { id: 'mats', x: 0, z: 3.5 }, { id: 'cart', x: 30, z: 20 }, { id: 'stand', x: 26, z: 10 }];

test('dealt lines: never a duplicate stop; extras stall, or meet him when nothing fails', () => {
  const four = [rat('a', 0, 0), rat('b', 14, 12), rat('c', 25, 10), rat('d', 50, 50)];
  const one = dealGary([STOPS[0]], four);
  assert.equal(Object.values(one).filter(v => v === 'sign').length, 1);
  assert.equal(Object.values(one).filter(v => v === 'stall').length, 3, '4 Rats, 1 failing: 1 stop + 3 stall');
  assert.deepEqual(Object.values(dealGary([], four)), ['meet', 'meet', 'meet', 'meet'], '0 failing: everyone meets him');
  const all = dealGary(STOPS, four);
  assert.equal(new Set(Object.values(all)).size, 4, '4 failing: 4 different stops');
  assert.ok(Object.values(all).every(v => STOPS.some(s => s.id === v)));
  const six = dealGary(STOPS.slice(0, 2), [...four, rat('e', 1, 1), rat('f', 2, 2)]);
  assert.equal(Object.values(six).filter(v => v === 'stall').length, 4, '6 Rats, 2 failing: 2 + 4 stall');
  assert.equal(new Set(Object.values(six).filter(v => v !== 'stall')).size, 2);
  assert.deepEqual(dealGary(STOPS.slice(0, 3), [rat('a', 14, 12)]), { a: 'sign' }, 'solo: the nearest stop');
});

function driving(save = { day: 5 }) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('STAL', { voiced: ['welcome', 'gary'], ...save }, { shiftSecs: 200, seed: 5, now: () => clock.t });
  const p = crew.join('Al'); crew.connect(p);
  crew.startShift();
  for (const m of crew.mats) m.next = 1e9;
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
  const tick = () => { clock.t += 50; crew.tick(0.05); };
  crew.shiftT = crew.shiftSecs * GARY.AT; tick();
  assert.equal(crew.gary?.phase, 'warn');
  return { crew, p, tick };
}
const goDrive = m => { m.crew.gary.t = 0; m.tick(); assert.equal(m.crew.gary.phase, 'drive'); m.crew.gary.pause = 0; };
// A ball 0.4 m short of his cart, flying into it.
function shoot(m, by) {
  const g = m.crew.gary;
  const b = m.crew.addBall({ x: g.x, y: 1, z: g.z - 0.4, vx: 0, vy: 0, vz: 12, kind: 'range' });
  if (by) b.by = by;
  m.crew.events.length = 0;
  m.tick();
  return m.crew.events.find(e => e.t === 'enthusiasm');
}

test('a crew ball on his cart, parked or driving: 3 s of notes, 3 times a visit; customers do nothing', () => {
  const m = driving();
  const g = m.crew.gary;
  g.t = 5;                                     // playthrough 4 A12: parked through the warning, a ping counts too
  const w = shoot(m, m.p.id);
  assert.equal(w?.stall, 1, "'warn': the 'Stall Gary' line is true while he's parked");
  assert.equal(g.stalls, 1);
  assert.ok(Math.abs(g.pause - GARY.STALL) < 1e-9, 'the notes bank up for when he sets off');
  m.crew.balls.clear();
  goDrive(m);
  const p0 = g.pause;
  const cust = shoot(m, null);
  assert.ok(cust && cust.stall === undefined, 'a customer ball notes nothing');
  assert.ok(g.pause <= p0 + 1e-9, 'and adds no pause');
  assert.equal(g.stalls, 1);
  const e2 = shoot(m, m.p.id);
  assert.equal(e2.stall, 2, 'the event carries the stall count (one visit: the warning stall counts)');
  assert.ok(Math.abs(g.pause - (p0 + GARY.STALL)) < 0.06, `pause +3 (${g.pause})`);
  assert.equal(shoot(m, m.p.id).stall, 3);
  const before = g.pause;
  const e4 = shoot(m, m.p.id);
  assert.ok(e4 && e4.stall === undefined, 'the fourth hit: the old line, no stall');
  assert.ok(g.pause <= before, 'no more pause past the cap');
  assert.equal(g.stalls, GARY.STALLS);
});

test("a stall grows his ETA by 3 s and doesn't change the verdict", () => {
  const verdict = stall => {
    const m = driving();
    goDrive(m);
    const g = m.crew.gary;
    // Put him on his last leg, 3 m from the stand, so the count is live.
    const stops = m.crew.garyStops();
    g.stop = stops.length - 1; g.x = stops[g.stop].x + 3; g.z = stops[g.stop].z;
    const eta = m.crew.garyEta();
    assert.ok(eta != null && eta < 1, `the count is live (${eta})`);
    if (stall) {
      assert.equal(shoot(m, m.p.id).stall, 1);
      const eta2 = m.crew.garyEta();
      assert.ok(Math.abs(eta2 - (eta + GARY.STALL)) < 0.2 , `eta +3 (${eta} → ${eta2})`);
    }
    m.crew.events.length = 0;
    let v;
    for (let i = 0; i < 400 && !v; i++) { m.tick(); v = m.crew.events.find(e => e.t === 'verdict'); }
    return v;
  };
  const a = verdict(false), b = verdict(true);
  assert.ok(a && b);
  assert.equal(b.fails, a.fails);
  assert.equal(b.gained, a.gained);
});
