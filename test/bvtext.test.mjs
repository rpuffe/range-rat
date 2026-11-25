// Owner playtest 3 §1: Ball Value in one look (bvtext.js), the one price (§1.4), and the Seal's display inputs (§6.4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Crew } from '../server/crew.mjs';
import { SIM, FIXTURES, FIXTURE_BY_ID, quotaQ, upkeepCeiling, venueQuotaF, ballValue, perks, payFor, gearGrimeFactor, cartGearOf } from '../web/js/sim.js';
import { targetPct, cleanFrac, pct, bvLine, popupLine, pipColour, pipsOf, memoLine, reportRow, sealRow, reviewPcts,
  spotlessGain, gainText, priceOf, ceilingOf, barWord, whyLine, shortMoney, upkeepMet } from '../web/js/bvtext.js';
import { wordCount } from '../web/js/say.js';
import { HINTS } from '../web/js/settings.js';

function makeCrew(save = null, shiftSecs = 600, seed = 11) {
  const clock = { t: 1_000_000 };
  const crew = new Crew('BVTX', save, { shiftSecs, seed, now: () => clock.t });
  const run = secs => { for (let i = 0; i < secs * 20; i++) { clock.t += 50; crew.tick(0.05); } };
  return { crew, clock, run };
}
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

// ---- §1.1 the target and the bar -----------------------------------------------------------------------------------
test('the Muni target prints 60% on days 2-4, 70% on day 5, 80% from day 6; the Club venue day 1 prints 35%', () => {
  const muni = d => targetPct(quotaQ(d, 1.5), 1.5);
  assert.deepEqual([2, 3, 4, 5, 6, 7].map(muni), [60, 60, 60, 70, 80, 80]);
  assert.equal(targetPct(null, 1.5), null, 'day 1: no target');
  for (const ceil of [2, 2.5]) assert.equal(targetPct((ceil - 1) * venueQuotaF(1), ceil), 35);
  assert.deepEqual([1, 2, 3, 4, 5, 20].map(vd => targetPct(1.5 * venueQuotaF(vd), 2.5)), [35, 40, 45, 50, 53, 70]);
});

test('the bar is (Upkeep - 1) / (ceiling - 1): clean at the Muni, the gauges from the Club', () => {
  assert.equal(pct(cleanFrac(1.31, 1.5)), 62);
  assert.equal(pct(cleanFrac(1, 1.5)), 0);
  assert.equal(pct(cleanFrac(2.5, 2.5)), 100);
  assert.equal(pct(cleanFrac(1.72, 2.5)), 48);
  assert.equal(ceilingOf({ pond: null, fries: null }), 1.5);
  assert.equal(ceilingOf({ pond: 0, fries: 0.4 }), 2.5, 'an empty pond still counts as a gauge');
  assert.equal(ceilingOf({ pond: 1, fries: 1, kpi: 0 }), 3);
  assert.equal(barWord(0), 'CLEAN'); assert.equal(barWord(1), 'CLEAN', 'council round 10: "clean" everywhere');
  assert.equal(whyLine(0), 'Clean grounds pay up to +50%');
  assert.equal(whyLine(3), 'Each gauge pays up to +50%');
  for (const v of [0, 1]) assert.ok(wordCount(whyLine(v)) <= 6);
});

test('the price is BV x Hustle x Seal', () => {
  assert.equal(priceOf({ bv: 2.62, hustle: 1 }), 2.62);
  assert.equal(priceOf({ bv: 2.62, hustle: 1.25 }, 1.25), 4.09);
  assert.equal(priceOf({ bv: 2, hustle: 1, seal: 1.25 }), 2.5, 'the value\'s own seal');
});

// ---- §1.2 the HUD, the memo, the report -----------------------------------------------------------------------------
test('bvLine: the Muni, the Club and endless', () => {
  assert.equal(bvLine({ value: { bv: 2.62, hustle: 1, upkeep: 1.31, pond: null, fries: null }, quota: { q: 0.3 }, venue: 0 }),
    '$2.62 a ball · 62% clean · need 60%');
  assert.equal(bvLine({ value: { bv: 30, hustle: 1, upkeep: 1.72, pond: 1, fries: 1 }, quota: { q: 0.6 }, venue: 1 }),
    '$30 a ball · 48% clean · need 40%');
  assert.equal(bvLine({ value: { bv: 19240, hustle: 1, upkeep: 2, pond: 1, fries: 1, kpi: 1 }, endless: true, pace: { cash: 3_100_000 } }),
    '$19,240 a ball · today $3.1M');
  assert.equal(bvLine({ value: { bv: 1.25, hustle: 1, upkeep: 1, pond: null, fries: null }, venue: 0 }), '$1.25 a ball · 0% clean', 'day 1: no need');
  assert.equal(bvLine({}), '');
  assert.equal(shortMoney(412_000), '$412k');
  assert.equal(shortMoney(9870), '$9,870');
});

test('the memo, the hint and the report rows', () => {
  assert.equal(memoLine(60, 0), 'Today: 60% clean by the bell.');
  assert.equal(memoLine(60, 0, true), 'Gary visits today. 60% clean by the bell.');
  assert.equal(memoLine(40, 1), 'Today: 40% clean by the bell.');
  for (const s of [memoLine(60, 0), memoLine(60, 0, true), memoLine(40, 1, true)]) assert.ok(wordCount(s) <= 8, s);
  assert.equal(HINTS.bv.kb, 'A ball pays more the cleaner it is.');
  assert.equal(HINTS.bv.pad, HINTS.bv.kb);
  assert.ok(wordCount(HINTS.bv.kb) <= 8);
  assert.equal(reportRow({ clean: 64, need: 60, venue: 0 }), 'Clean 64% · needed 60%');
  assert.equal(reportRow({ clean: 41, need: 40, venue: 1 }), 'Clean 41% · needed 40%');
  assert.equal(sealRow(1240), "Gary's Seal: +$1,240");
  assert.deepEqual(reviewPcts(1.2999, 0.3, 1.5, false), { clean: 59, need: 60 }, 'a miss never prints 60% · needed 60%');
  assert.deepEqual(reviewPcts(1.2975, 0.3, 1.5, true), { clean: 60, need: 60 }, 'a hit never prints 59%');
  assert.deepEqual(reviewPcts(1.32, 0.3, 1.5, true), { clean: 64, need: 60 });
});

// ---- §1.3 the floats -----------------------------------------------------------------------------------------------
test('popupLine: "8 x $2.62", "+ wash" with a washer, no "muddy boots" chip (round 11: grime muddies the return)', () => {
  assert.equal(popupLine({ n: 8, per: 2.62, credit: 0, clean: true }).text, '8 × $2.62');
  const w = popupLine({ n: 8, per: 1.31, credit: 10.48, clean: true });
  assert.equal(w.text, '8 × $1.31 + wash'); assert.equal(w.wash, true); assert.equal(w.base, '8 × $1.31');
  const m = popupLine({ n: 8, per: 2.1, credit: 0, clean: false });
  assert.equal(m.text, '8 × $2.10'); assert.equal(m.boots, false);
  assert.equal(popupLine({ n: 3, cash: 6, kind: 'cart' }).text, '3 × $2', 'no per: cash / n; the cart has no boots');
});

test('the fixture pips: green to 0.34, amber to 0.6, brown above; sign, return, then the mats in play', () => {
  assert.equal(pipColour(0), 'green');
  assert.equal(pipColour(0.34), 'green');
  assert.equal(pipColour(0.35), 'amber');
  assert.equal(pipColour(0.6), 'amber');
  assert.equal(pipColour(0.61), 'brown');
  const fx = Object.fromEntries(FIXTURES.map(f => [f.id, 0]));
  fx.sign = 0.9; fx.stand = 0.5;
  const p = pipsOf(fx, 6);
  assert.deepEqual(p.map(x => x.id), ['sign', 'stand', 'mat0', 'mat1', 'mat2', 'mat3', 'mat4', 'mat5']);
  assert.deepEqual(p.map(x => x.group), ['SIGN', 'RETURN', 'MATS', 'MATS', 'MATS', 'MATS', 'MATS', 'MATS']);
  assert.deepEqual(p.slice(0, 3).map(x => x.colour), ['brown', 'amber', 'green']);
  assert.equal(pipsOf(fx, 10).length, 12);
  assert.deepEqual(pipsOf(null), []);
});

test('spotlessGain: rate x hustle x seal x 0.5 x washFrom / 12; under a cent, no float', () => {
  assert.equal(spotlessGain({ rate: 1, washFrom: 1 }), 0.04, "M6: $0.04 a ball before the washer");
  assert.equal(spotlessGain({ rate: 1.25, washFrom: 1 }), 0.05, 'with the one price');
  assert.equal(spotlessGain({ rate: 2.5, washFrom: 1 }), 0.1, 'the hand washer');
  assert.equal(spotlessGain({ rate: 1.25, washFrom: 0.05 }), null);
  assert.equal(spotlessGain({ rate: 6.25, hustle: 1.25, seal: 1.25, washFrom: 0.6 }), 0.24);
  assert.equal(gainText(0.05), '+$0.05 a ball');
});

// ---- the crew ------------------------------------------------------------------------------------------------------
test('a fixture hosed Spotless carries the gain the spray earned; a cart does not', () => {
  const { crew, clock } = makeCrew({ day: 2 });
  crew.startShift();
  for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
  crew.fixtures.mat3 = 0.6;
  const p = crew.join('A'); crew.connect(p);
  const m = FIXTURE_BY_ID.mat3; p.x = m.x; p.z = m.z + 2; p.wand = true; p.washAt = crew.now();
  crew.flush();
  let ev = [];
  for (let i = 0; i < 40 && crew.fixtures.mat3 > 0; i++) { clock.t += 500; crew.wash(p, 0.5, 'mat3'); ev.push(...crew.flush().ev); }
  const sp = ev.find(e => e.t === 'spotless');
  assert.ok(sp, 'spotless');
  assert.equal(sp.target, 'mat3');
  const v = crew.valueNow();
  assert.equal(sp.gain, spotlessGain({ rate: v.rate, washFrom: 0.6 }), 'from the mud the run began at, not the last 0.5 s');
  assert.equal(sp.gain, 0.03);
});

test('the memo carries the %, the quota event carries clean and need, the snapshot carries the Board\'s inputs', () => {
  const { crew, run } = makeCrew({ day: 2 }, 5);
  crew.startShift();
  const memo = crew.flush().ev.find(e => e.t === 'memo');
  assert.equal(memo.target, 60);
  assert.equal(memo.text, 'Today: 60% clean by the bell.');
  const s = crew.snapshot();
  assert.equal(s.nMats, 6, 'solo: six mats in play');
  assert.equal(s.seal, 1);
  assert.equal(s.garyToday, false, 'day 2: no Gary');
  crew.bank(5, 'x');
  run(6);
  const q = crew.report.quota;
  assert.equal(typeof q.clean, 'number'); assert.equal(q.need, 60); assert.equal(q.venue, 0);
  assert.equal(q.hit, q.clean >= q.need);
});

test('on a Gary day the memo says so', () => {
  const { crew } = makeCrew({ day: 4 });
  crew.startShift();
  assert.equal(crew.garyToday(), true);
  const memo = crew.flush().ev.find(e => e.t === 'memo');
  assert.equal(memo.text, 'Gary visits today. 60% clean by the bell.');
});

// ---- §1.4 the one price --------------------------------------------------------------------------------------------
test('the one price: a clean Rat pays exactly n x the Board; a caked one 0.8 of it; the cart 1 - 0.2 x mud', () => {
  assert.equal(SIM.CLEAN_KIT, 1.25);
  assert.equal(gearGrimeFactor(0), 1);
  near(gearGrimeFactor(3), 0.8);
  near(cartGearOf({ mud: 1 }), 0.8);
  assert.equal(cartGearOf(null), 1);
  for (const curb of [0, 0.37, 0.8, 1]) {
    const v = ballValue({ perks: perks({}), curb });
    assert.equal(payFor(8, v, gearGrimeFactor(0)), Math.round(8 * v.value * 100) / 100, `8 x ${v.value}`);
    near(payFor(8, v, gearGrimeFactor(3)), Math.round(8 * v.value * 0.8 * 100) / 100, 0.0051);
  }
  assert.equal(ballValue({ perks: perks({}), curb: 0 }).value, 1.25, 'the Muni day 1: "$1.25 A BALL"');
});

test('the one price: for a Rat and the cart the money is today\'s; machinery gets +25%', () => {
  const v = ballValue({ perks: perks({}), curb: 0.62 });
  const old = { ...v, bv: Math.round(v.bv / SIM.CLEAN_KIT * 100) / 100 };   // the pre-fold BV
  near(payFor(10, v, gearGrimeFactor(0)), payFor(10, old, 1.25), 0.06);                  // a clean Rat: within rounding
  near(payFor(10, v, gearGrimeFactor(3)), payFor(10, old, 1), 0.06);                     // caked
  near(payFor(10, v, cartGearOf({ mud: 0.5 })), payFor(10, old, 1.125), 0.06);           // the cart
  near(payFor(10, v) / payFor(10, old), 1.25, 0.01);                                     // a helper, a drone, the night crew
  // ...end to end: a teenager's bank is 1.25 x what it was.
  const bankHelper = kit => {
    const was = SIM.CLEAN_KIT; SIM.CLEAN_KIT = kit;
    try {
      const { crew } = makeCrew();
      crew.startShift();
      for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
      crew.bank(20, 'h0', 'helper', 20);
      return crew.cash;
    } finally { SIM.CLEAN_KIT = was; }
  };
  near(bankHelper(1.25) / bankHelper(1), 1.25, 0.005);
});

test('the one price moves no stamp: a seeded 4P Muni, days 2-5, stamps the same with and without the fold', () => {
  const stamps = kit => {
    const was = SIM.CLEAN_KIT; SIM.CLEAN_KIT = kit;
    try {
      const { crew, run } = makeCrew({ day: 2 }, null, 7);
      const ps = ['A', 'B', 'C', 'D'].map((n, i) => { const p = crew.join(n); crew.connect(p); p.x = 20 + i; p.z = 2; return p; });
      const out = [];
      for (let d = 2; d <= 5; d++) {
        crew.startShift();
        if (crew.basket) crew.basket.n = 99;
        let t = 0;
        while (crew.phase === 'shift') {
          run(1); t++;
          if (crew.basket) crew.basket.n = 99;
          if (t % 20 === 0) crew.bank(5, 'x');
          // a crew that hoses some days: day 2 and 4 every fixture at 2:00
          if ((d === 2 || d === 4) && t === 120) for (const k of Object.keys(crew.fixtures)) crew.fixtures[k] = 0;
        }
        out.push({ day: d, hit: crew.report.quota?.hit ?? null, clean: crew.report.quota?.clean });
      }
      void ps;
      return out;
    } finally { SIM.CLEAN_KIT = was; }
  };
  const a = stamps(1.25), b = stamps(1);
  assert.deepEqual(a.map(x => x.hit), b.map(x => x.hit));
  assert.deepEqual(a.map(x => x.clean), b.map(x => x.clean), 'Upkeep is the same whatever the price');
  assert.ok(a.some(x => x.hit) && a.some(x => !x.hit), JSON.stringify(a));
});

test('upkeepMet keeps the old half-cent slack', () => {
  assert.equal(upkeepMet({ upkeep: 1.3, rate: 1.25 }, 0.3), true);
  assert.equal(upkeepMet({ upkeep: 1.2951, rate: 1.25 }, 0.3), true, 'BV 1.2951 rounded to $1.30 on the old $1 rate');
  assert.equal(upkeepMet({ upkeep: 1.2949, rate: 1.25 }, 0.3), false);
  assert.equal(upkeepMet({ upkeep: 1.299, rate: 6.25 }, 0.3), true, 'the Club: a tenth of a cent on $5');
  assert.equal(upkeepMet({ upkeep: 1.298, rate: 6.25 }, 0.3), false);
});
