// Copied from the expert review's ladder scripts (round 11) for scripts/make-presets.mjs; see snap.mjs.
// Playtester B, playthrough 5: a physical bot crew from the Range Club's first day to the Stadium promotion,
// playing the GOAL CARD for real. Rats walk at real speed, pick with real pickup(), bank at the stand (or a field
// return), fill the bucket basket, hose with the wand, cook real serves (fries / hot dogs for FED + the card / beer
// for deck orders), dive the pond AND the creek (snags, the Cart Bridge treasure, real air, real gasp), huddle for
// Gary, drive the cart, and at Tiered a shooter AIMS at the greens with the landing ring (predictRest + human noise).
// usage: node bot.mjs N [seed] [start]   env V=1 verbose, FOLLOW=1 follow the dealt dusk lines
const REPO = new URL('../../', import.meta.url).href;
const { snap, startSave } = await import('./snap.mjs');
const { Crew } = await import(REPO + 'server/crew.mjs');
const S = await import(REPO + 'web/js/sim.js');
const M = await import(REPO + 'web/js/map.js');
const D = await import(REPO + 'web/js/dive.js');
const AIMJ = await import(REPO + 'web/js/aim.js');
const SW = await import(REPO + 'web/js/swing.js');
const DK = await import(REPO + 'web/js/deck.js');
const L = await import(REPO + 'web/js/layout.js');
const CD = await import(REPO + 'web/js/creekdive.js');
const { makeClassifier } = await import('./classify.mjs');
// council round 13 #0: the shared calls tally, the policy hooks, the shift caps, and the boss shortcut (from pt8b-mid)
const { CallTally } = await import('./calls.mjs');
const { loadPolicies } = await import('./policies.mjs');
const { capCheck } = await import('./snap.mjs');
const MW = await import(REPO + 'web/js/mowe.js');
const FIGHT = +(process.env.FIGHT ?? 0);   // FIGHT=secs: the crew stands still that long in the Club boss fight, then tames it (0: ignore it)
const SKILL = +(process.env.SKILL ?? 1), FOLLOW = process.env.FOLLOW !== '0', SHOOT = process.env.SHOOT !== '0';
const N = +(process.argv[2] ?? 4), SEED = +(process.argv[3] ?? 7), START = process.argv[4] ?? 'grad';
const V = process.env.V === '1';
let t = 0;
const names = Array.from({ length: N }, (_, i) => 'Rat' + i);
// A Muni graduate (what the council ladder walks into the Club with), by crew size.
const SAVES = {
  grad: { v: 5, day: 6, venue: 1, venueDay: 0, pendingReveal: 1, cash: N >= 3 ? 3200 : 1200, commendations: 4,
    up: N >= 3 ? { gear: 3, washer: 2, wand: 2, ads: 3, shoes: 3, hardhat: 1, helpers: 4, cart: 2, returns: 1, shed: 1 }
      : { gear: 3, washer: 2, wand: 2, ads: 3, shoes: 2, hardhat: 1, helpers: 2, cart: 1, returns: 1, bays: 1, shed: 1 } },
};
const crew = new Crew('BOTB', startSave() ?? SAVES[START], { now: () => t * 1000, seed: SEED });
const rats = names.map(n => { const p = crew.join(n); crew.connect(p); return p; });
const CL = makeClassifier(crew); const NOV = [];
const calls = new CallTally(N);
const fightLog = []; let fightAt = null;
const DT = 0.1;
const W = () => crew.world();
const STAND = S.SIM.STAND, SHED = S.FRIES.SHED, WSTN = S.WASH.STATION, DOCK = S.POND.DOCK;
const sideOf = (x, z) => M.creekProject(x, z).side;
const HOME = sideOf(STAND.x, STAND.z);
const BR_NEAR = { x: 19.5, z: -94 }, BR_FAR = { x: 16.5, z: -104.5 };
const counters = {};
const C = (k, n = 1) => { counters[k] = (counters[k] ?? 0) + n; };

// ---- movement ------------------------------------------------------------------------------------------------
function walkTo(p, g, dt, speedMul = 1) {
  if (p.down > 0) return false;
  let tx = g.x, tz = g.z;
  if (!g.dive && !p.diving) {   // walkers keep out of the pond
    const dx = tx - p.x, dz = tz - p.z, Lq = Math.hypot(dx, dz);
    if (Lq > 0.1) {
      const t0 = Math.max(0, Math.min(1, ((S.POND.x - p.x) * dx + (S.POND.z - p.z) * dz) / (Lq * Lq)));
      const cx = p.x + dx * t0, cz = p.z + dz * t0;
      if (Math.hypot(cx - S.POND.x, cz - S.POND.z) < S.POND.r + 1.5 && t0 > 0 && t0 < 1) {
        const sgn = p.x < S.POND.x ? -1 : 1; tx = S.POND.x + sgn * (S.POND.r + 3); tz = S.POND.z;
      }
    }
  }
  const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
  const sp = p.diving ? crew.perks.walk * D.diveTiers(p.dive).swim : crew.perks.walk * M.wadeFactor(p.x, p.z, W());
  const step = Math.min(d, sp * speedMul * dt);
  if (d > 1e-6) { p.x += dx / d * step; p.z += dz / d * step; p.yaw = Math.atan2(-dx, -dz); }
  if (p.creekDiving) CD.applyCurrent(p, dt, W());   // the client's current (main.js) on a creek diver
  S.clampToField?.(p, W());
  p.movedAt = t * 1000;
  return Math.hypot(g.x - p.x, g.z - p.z) < 0.6;
}

// ---- jobs ----------------------------------------------------------------------------------------------------
const claimed = new Set();
const okBall = b => b.rest && !b.sunk && !b.drifting && !b.creek && !b.cup && b.kind !== 'one' && !M.inPondArea(b.x, b.z, 0.5);
function nearestBall(p, filter = () => true) {
  let best = null, bd = Infinity;
  for (const b of crew.balls.values()) {
    if (!okBall(b) || claimed.has(b.id) || !filter(b)) continue;
    const d = Math.hypot(b.x - p.x, b.z - p.z);
    if (d < bd) { bd = d; best = b; }
  }
  return best;
}
function grabAround(p) {
  const g = S.gearPerks(p.gear);
  for (const b of crew.balls.values()) {
    if (p.pocket >= g.pocket) break;
    if (!b.rest || b.sunk || b.drifting || b.creek || b.kind === 'one') continue;
    if (Math.hypot(b.x - p.x, b.z - p.z) <= g.reach) crew.pickup(p, b.id);
  }
}
function bankJob(p, dt) {        // the nearest owned return: the main one or a field return (pipe)
  const r = L.nearestReturn(p.x, p.z, crew.perks.returns ?? 0);
  if (r.id === 'main') { if (walkTo(p, STAND, dt)) { crew.deposit(p); p.job_bank = false; C('bankMain'); } }
  else if (walkTo(p, r, dt) || L.atFieldReturn(p, crew.perks.returns)) { if (crew.feedTube(p)) C('bankField'); p.job_bank = false; }
}
function pickJob(p, dt) {
  const g = S.gearPerks(p.gear);
  if (p.pocket >= g.pocket || (p.pocket > 0 && p.job_bank) || p.treasure) { p.job_bank = true; return bankJob(p, dt); }
  let b = p.tgt && crew.balls.get(p.tgt);
  if (!b || !okBall(b)) { if (p.tgt) claimed.delete(p.tgt); b = nearestBall(p); p.tgt = b?.id; if (b) claimed.add(b.id); }
  if (!b) { if (p.pocket > 0) p.job_bank = true; else C('idleSecs', dt); return; }
  C('pickSecs', dt);
  if (walkTo(p, b, dt) || Math.hypot(b.x - p.x, b.z - p.z) < g.reach) { grabAround(p); claimed.delete(b.id); p.tgt = null; }
  if (g.scoop) grabAround(p);
}
function fillJob(p, dt) {         // the morning basket (until the Bucket machine)
  if ((crew.up.bucket ?? 0) >= 1 && crew.basket.n >= 3) return false;
  const want = p.filling ? crew.basket.n < S.BUCKETS.BASKET : crew.basket.n <= 3;
  if (!want) { if (p.filling) { crew.fillInput(p, false); p.filling = false; } return false; }
  if (!walkTo(p, L.FILL_POINT, dt)) return true;
  if (!p.filling) { crew.fillInput(p, true); p.filling = true; }
  C('fillSecs', dt);
  return true;
}
function dirtyFixture() {
  const nAct = S.activeMats(crew.onlineCount(), crew.up);
  const list = [];
  for (let i = 0; i < nAct; i++) list.push(['mat' + i, crew.fixtures['mat' + i]]);
  list.push(['sign', crew.fixtures.sign], ['stand', crew.fixtures.stand]);
  if (crew.carts[0]) list.push(['cart', crew.carts[0].mud]);
  list.sort((a, b) => b[1] - a[1]);
  return list[0][1] > 0.25 ? list[0][0] : null;
}
function washJob(p, dt) {
  const mud = k => k === 'cart' ? crew.carts[0]?.mud ?? 0 : crew.fixtures[k];
  if (!p.wtgt || mud(p.wtgt) <= 0.05) p.wtgt = dirtyFixture();
  const tgt = p.wtgt;
  if (!tgt) { if (p.wand) crew.toggleWand(p); return false; }
  if (!p.wand) { if (walkTo(p, WSTN, dt)) crew.toggleWand(p); return true; }
  const where = tgt === 'cart' ? crew.carts[0] : S.FIXTURE_BY_ID[tgt];
  const reach = crew.perks.washReach ?? 7;
  if (Math.hypot(where.x - p.x, where.z - p.z) > reach - 1) walkTo(p, { x: where.x, z: where.z + 3 }, dt);
  else { crew.wash(p, dt, tgt); C('wandSecs', dt); }
  return true;
}
// The kitchen: what a decent human cook serves, and how long it takes (the minigame).
const COOK_SECS = { fries: 13, hotdog: 12, beer: 6 };
function cookJob(p, dt) {
  if (!crew.perks.shed) return false;
  const deck = crew.mods.state('deck')?.deck;
  const g = crew.goalRows();
  const dogsOpen = g.some(r => r.id === 'fed' && !r.done);
  const ordersOpen = g.some(r => r.id === 'orders' && !r.done);
  const garyHungry = crew.gary && (crew.gary.phase === 'warn' || crew.gary.phase === 'drive') && !crew.gary.fed && !(crew.gary.checks || []).some(c => c.stop === 'kitchen') && crew.fries < S.FRIES.MAX * 0.5;
  const fedLow = (crew.fedSt?.fed ?? 1) < 1.2;
  let item;
  if (p.cooking) item = p.cooking;
  else if (garyHungry) item = 'hotdog';
  else if (process.env.COOK === 'reckless' && crew.venue >= 2 && deck) item = 'beer';
  else if (crew.venue >= 2 && deck && deck.drinks >= DK.DECK.WARN) item = 'hotdog';                       // sober them
  else if (crew.venue >= 2 && deck && deck.order && !(deck.order.round && deck.drinks >= 3) && deck.order.left > COOK_SECS.beer + 1) item = 'beer';
  else if (!crew.perks.autoFry && crew.fries < S.FRIES.MAX * 0.6) item = 'fries';
  else if (dogsOpen || fedLow) item = 'hotdog';
  else if (crew.fries < S.FRIES.MAX - 2) item = 'fries';
  else if (crew.venue >= 2 && deck && N >= 3) { walkTo(p, SHED, dt); C('barWait', dt); return true; }   // the bartender waits
  else return false;
  p.cooking = item;
  if (!walkTo(p, SHED, dt)) return true;
  p.cookT = (p.cookT ?? 0) + dt; C('kitchenSecs', dt);
  if (p.cookT >= COOK_SECS[item]) {
    p.cookT = 0;
    const r = crew.rng();
    const quality = r < 0.55 ? 'perfect' : r < 0.93 ? 'good' : 'burnt';
    p.servedAt = 0;
    if (crew.serve(p, { item, quality })) C('serve_' + item);
    p.cooking = null;
  }
  return true;
}
// The pond: walk in, swim to the nearest sunk ball (or the treasure), surface when full / low on air, bank.
function surfaceBank(p, dt) {
  if (p.wasDiving && !p.diving) { p.fromDive = true; C('dives'); }
  p.wasDiving = p.diving;
  if (!p.diving && (p.pocket > 0 || p.treasure) && p.fromDive) {
    if (p.treasure) { if (walkTo(p, STAND, dt)) { crew.deposit(p); p.fromDive = false; } return true; }
    if (D.hasTube(crew.up) && Math.hypot(p.x - D.TUBE.BOX.x, p.z - D.TUBE.BOX.z) < 25) { if (walkTo(p, D.TUBE.BOX, dt)) { crew.feedTube(p); p.fromDive = false; } }
    else { bankJob(p, dt); if (p.pocket === 0) p.fromDive = false; }
    return true;
  }
  if (!p.diving) p.fromDive = false;
  return false;
}
function diveJob(p, dt, minSunk) {
  if (!crew.pondOpen()) return false;
  if (p.creekMode) return creekJob(p, dt);
  const tier = D.diveTiers(p.dive);
  if (surfaceBank(p, dt)) return true;
  const pondTreasure = crew.treasure && M.inPondArea(crew.treasure.x, crew.treasure.z);
  const sunk = [...crew.balls.values()].filter(b => b.sunk && b.kind !== 'one');
  if (!p.diving && sunk.length < minSunk && !pondTreasure) return false;
  if (!p.diving) {
    if (p.air < tier.air * 0.95) { walkTo(p, DOCK, dt); return true; }
    walkTo(p, { x: S.POND.x, z: S.POND.z + S.POND.r - 1, dive: true }, dt);
    return true;
  }
  const dShore = S.POND.r - Math.hypot(p.x - S.POND.x, p.z - S.POND.z);
  const swim = crew.perks.walk * tier.swim;
  const drain = D.drainMult(tier, p.x, p.z);
  if (p.bag >= tier.bag || p.treasure || p.air < (dShore + 0.5) / swim * drain + 2.5 || (sunk.length === 0 && !pondTreasure)) {
    walkTo(p, { x: DOCK.x, z: DOCK.z + 1, dive: true }, dt);
    return true;
  }
  if (pondTreasure && !p.treasure) {
    if (walkTo(p, { ...crew.treasure, dive: true }, dt) || Math.hypot(crew.treasure.x - p.x, crew.treasure.z - p.z) < S.POND.REACH) { if (crew.treasurePickup(p)) C('treasurePond'); }
    return true;
  }
  let b = null, bd = Infinity;
  for (const o of sunk) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; b = o; } }
  if (!b) return true;
  if (bd < S.POND.REACH) { if (crew.pondPickup(p, b.id)) C('pondBalls'); }
  else walkTo(p, { x: b.x, z: b.z, dive: true }, dt);
  return true;
}
// The creek (council round 10 #5): enter upstream of the snags / the Cart Bridge treasure, duck under (2 s),
// float down grabbing, step out sideways to surface; bank. The current is applied in walkTo, as the client does.
const creekTargets = () => {
  const out = [];
  for (const b of crew.balls.values()) if (b.creek && b.rest) out.push(b);
  return out;
};
function creekJob(p, dt) {
  if (surfaceBank(p, dt)) return true;
  const tier = D.diveTiers(p.dive);
  const tr = crew.treasure && !M.inPondArea(crew.treasure.x, crew.treasure.z) ? crew.treasure : null;
  const snags = creekTargets();
  if (!p.diving) {
    if (!tr && snags.length < 3) { p.creekMode = false; return false; }
    // the entry: 3 m upstream of the target (the treasure, else the nearest snag to the Rat)
    let tgt = tr; if (!tgt) { let bd = Infinity; for (const b of snags) { const d = Math.hypot(b.x - p.x, b.z - p.z); if (d < bd) { bd = d; tgt = b; } } }
    const q = M.creekProject(tgt.x, tgt.z), e = M.creekPoint(q.branch, Math.max(0, q.s - 3));
    if (p.air < tier.air * 0.9) { C('creekAirWait', dt); return true; }   // get your breath back on the bank
    if (walkTo(p, { x: e.x, z: e.z, dive: true }, dt)) C('creekWade', dt);
    return true;
  }
  if (p.diving && !p.creekDiving) { p.creekMode = false; return diveJob(p, dt, 0); }   // carried into the pond
  C('creekSecs', dt);
  const out = () => { const q = CD.bankSpot(p.x, p.z); walkTo(p, { x: q.x, z: q.z, dive: true }, dt); };
  if (p.bag >= tier.bag || p.treasure || p.air < 5) { out(); return true; }
  if (tr && !p.treasure) {
    if (Math.hypot(tr.x - p.x, tr.z - p.z) < S.POND.REACH) { if (crew.treasurePickup(p)) C('treasureCreek'); }
    else walkTo(p, { x: tr.x, z: tr.z, dive: true }, dt);
    return true;
  }
  let b = null, bd = Infinity;
  for (const o of snags) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < bd) { bd = d; b = o; } }
  if (!b || bd > 25) { out(); return true; }
  if (bd < S.POND.REACH) { if (crew.pondPickup(p, b.id)) C('snagBalls'); }
  else walkTo(p, { x: b.x, z: b.z, dive: true }, dt);
  return true;
}
// The cart: harvest the nearest pile, routed over the Cart Bridge; unload at the stand.
function driveTowards(p, c, g, dt) {
  const vmax = crew.perks.cartSpeed * (c.boostT > 0 ? S.CART.BOOST : 1) * 0.85;
  const dx = g.x - c.x, dz = g.z - c.z, d = Math.hypot(dx, dz);
  const step = Math.min(d, vmax * dt);
  const yaw = Math.atan2(-dx, -dz);
  const before = { x: c.x, z: c.z };
  crew.input(p, { cart: { x: c.x + dx / (d || 1) * step, z: c.z + dz / (d || 1) * step, yaw } });
  if (Math.hypot(c.x - before.x, c.z - before.z) < step * 0.3 && step > 0.05) { p.stuck = (p.stuck ?? 0) + dt; } else p.stuck = 0;
  return Math.hypot(g.x - c.x, g.z - c.z) < 1.5;
}
function cartJob(p, dt) {
  let c = crew.cartOf(p);
  if (!c) {
    c = crew.carts.find(k => !k.driver);
    if (!c) return false;
    walkTo(p, c, dt); if (Math.hypot(c.x - p.x, c.z - p.z) < 2.5) crew.board(p);
    return true;
  }
  C('driveSecs', dt);
  if (c.load >= crew.perks.cartCap * 0.9 || (p.cartHome && c.load > 0)) {
    p.cartHome = true;
    const route = sideOf(c.x, c.z) !== HOME ? (Math.hypot(c.x - BR_FAR.x, c.z - BR_FAR.z) > 2 && !p.onBridge ? BR_FAR : BR_NEAR) : STAND;
    if (route === BR_FAR && Math.hypot(c.x - BR_FAR.x, c.z - BR_FAR.z) < 2) p.onBridge = true;
    if (driveTowards(p, c, route === BR_NEAR && p.onBridge ? BR_NEAR : route, dt) && route === BR_NEAR) p.onBridge = false;
    if (c.load === 0) { p.cartHome = false; C('cartTrips'); }
    return true;
  }
  let b = p.ctgt && crew.balls.get(p.ctgt);
  if (!b || !okBall(b) || (p.stuck ?? 0) > 2) {
    if ((p.stuck ?? 0) > 2) { C('stuckCart'); p.ban = p.ban ?? new Set(); if (p.ctgt) p.ban.add(p.ctgt); p.stuck = 0; }
    b = nearestBall(c, o => !M.cartBlocked(o.x, o.z, W()) && !(p.ban?.has(o.id)));
    p.ctgt = b?.id; p.leg = null;
  }
  if (!b) { if (c.load > 0) p.cartHome = true; return true; }
  const far = sideOf(b.x, b.z) !== sideOf(c.x, c.z);
  if (far) {
    const here = sideOf(c.x, c.z) === HOME ? BR_NEAR : BR_FAR, there = here === BR_NEAR ? BR_FAR : BR_NEAR;
    if (!p.leg) p.leg = 1;
    if (driveTowards(p, c, p.leg === 1 ? here : there, dt)) p.leg++;
    if (p.leg > 2) p.leg = null;
  } else {
    const yaw = Math.atan2(-(b.x - c.x), -(b.z - c.z));
    driveTowards(p, c, { x: b.x + Math.sin(yaw) * S.CART.REEL_AHEAD * 0.5, z: b.z + Math.cos(yaw) * S.CART.REEL_AHEAD * 0.5 }, dt);
  }
  for (const o of crew.balls.values()) {
    if (!o.rest || o.sunk || o.drifting || o.creek || o.kind === 'one') continue;
    if (Math.abs(o.x - c.x) < 4 && Math.abs(o.z - c.z) < 4 && S.underReels(c, o, crew.perks.cartReel)) crew.cartPickup(p, o.id);
  }
  return true;
}
// ---- the Target Greens: a Rat who aims with the landing ring ---------------------------------------------------
const BOWLS = M.MAP.BOWLS;
const planCache = new Map();
const shots = { swings: 0, ringIn: 0 };
function gauss() { let u = 0, v = 0; while (!u) u = crew.rng(); v = crew.rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function plan(bay, bowl) {
  const k = bay.x + ':' + bowl.id;
  if (planCache.has(k)) return planCache.get(k);
  const yaw0 = Math.atan2(-(bowl.x - bay.x), -(bowl.z - (bay.z - 0.4)));
  let best = null;
  for (const power of [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0, 1.1]) for (let pitch = 0.0; pitch <= 0.6; pitch += 0.025) for (let dy = -0.08; dy <= 0.08; dy += 0.01) {
    const r = AIMJ.predictRest({ bay, yaw: yaw0 + dy, pitch, power }, W());
    if (!r) continue;
    const d = Math.hypot(r.x - bowl.x, r.z - bowl.z);
    const score = d + Math.abs(power - 0.75) * 0.5;
    if (!best || score < best.score) best = { yaw: yaw0 + dy, pitch, power, d, score };
  }
  planCache.set(k, best);
  return best;
}
function shootJob(p, dt, want) {
  if (crew.venue !== 2 || !SHOOT) return false;
  const tm = crew.mods.state('tiered'); if (!tm) return false;
  const total = tm.cups.reduce((a, b) => a + b, 0);
  if (!p.shooting && !want(total, tm)) return false;
  p.shooting = true;
  const g = S.gearPerks(p.gear);
  if (p.pocket === 0 && !p.loading) p.loading = true;
  if (p.loading) {
    if (p.pocket >= Math.min(g.pocket, 8)) p.loading = false;
    else {
      const b = nearestBall(p);
      if (!b) { p.loading = false; if (p.pocket === 0) { p.shooting = false; return false; } }
      else { if (walkTo(p, b, dt) || Math.hypot(b.x - p.x, b.z - p.z) < g.reach) grabAround(p); C('shootLoad', dt); return true; }
    }
  }
  const bay = S.BAYS.reduce((a, b) => Math.hypot(b.x - p.x, b.z - p.z) < Math.hypot(a.x - p.x, a.z - p.z) ? b : a);
  if (!walkTo(p, bay, dt)) return true;
  C('shootSecs', dt);
  p.x = bay.x; p.z = bay.z;
  let bi = 0; for (let i = 1; i < BOWLS.length; i++) if (tm.cups[i] > tm.cups[bi]) bi = i;
  const bowl = BOWLS[bi];
  if (p.aimBowl !== bowl.id) { p.aimBowl = bowl.id; p.aimT = 4; }
  if ((p.aimT -= dt) > 0) return true;
  p.aimT = 1.5;
  const pl = plan(bay, bowl); if (!pl) { p.shooting = false; return false; }
  const yaw = pl.yaw + gauss() * 0.006 * SKILL, pitch = pl.pitch + gauss() * 0.008 * SKILL;
  const power = pl.power * (1 + gauss() * 0.02 * SKILL);
  const tempo = Math.max(0, Math.min(1, 1 - Math.abs(gauss()) * 0.07 * SKILL));
  const drift = Math.max(-1, Math.min(1, gauss() * 0.1 * SKILL));
  const l = SW.strikeToLaunch({ power, tempo, drift }, yaw, pitch);
  p.swungAt = -1e9;
  if (crew.swing(p, { yaw: l.yaw, pitch: l.pitch, power: l.power, curve: drift })) {
    shots.swings++; C('swings');
    const ringPred = AIMJ.predictRest({ bay, yaw, pitch, power }, W());
    if (ringPred && AIMJ.ringBowl(ringPred)) shots.ringIn++;
  }
  if (p.pocket === 0) { p.shooting = false; p.aimBowl = null; }
  return true;
}
// ---- Gary: run to the return before he gets there (the huddle) --------------------------------------------------
function huddleJob(p, dt) {
  const g = crew.gary;
  if (!g || g.phase !== 'drive') return false;
  const stops = crew.garyStops(), stop = stops[g.stop];
  if (!stop || stop.id !== 'stand') {
    // the stop before the stand: start walking when he's on his way
    if (g.stop < stops.length - 2) return false;
  }
  if (crew.cartOf(p)) { const c = crew.cartOf(p); if (Math.hypot(c.x - STAND.x, c.z - STAND.z) < 6 || c.load === 0) crew.leaveCart(p); else { p.cartHome = true; cartJob(p, dt); return true; } }
  if (p.wand) crew.toggleWand(p);
  if (p.diving) { if (p.creekMode) { const q = CD.bankSpot(p.x, p.z); walkTo(p, { ...q, dive: true }, dt); } else walkTo(p, { x: STAND.x, z: STAND.z, dive: true }, dt); return true; }
  if (Math.hypot(p.x - STAND.x, p.z - STAND.z) < S.GARY.HUDDLE_R - 2) { if (p.pocket) crew.deposit(p); C('huddleWait', dt); return true; }
  walkTo(p, STAND, dt); return true;
}

// ---- the crew's plan ---------------------------------------------------------------------------------------------
const dealtLine = p => p.dealt ?? '';
function ratStep(p, i, dt) {
  if (p.down > 0) return;
  if (crew.phase !== 'shift' || !crew.working()) { if (crew.phase === 'shift' && crew.closing?.()) return pickJob(p, dt); return; }
  if (huddleJob(p, dt)) return;
  const tiered = crew.venue === 2;
  const left = crew.shiftSecs - crew.shiftT;
  // the dealt dusk line, followed
  if (FOLLOW && crew.lastCallRung && p.dealt) {
    const Ln = dealtLine(p);
    const onFoot = () => { if (crew.cartOf(p)) { const c = crew.cartOf(p); if (c.load === 0 || Math.hypot(c.x - STAND.x, c.z - STAND.z) < 6) crew.leaveCart(p); else { p.cartHome = true; cartJob(p, dt); return false; } } return true; };
    if (/^(Glow rush|Bowls)/.test(Ln)) { if (onFoot() && shootJob(p, dt, () => true)) return; }
    else if (/Hose|filthy/.test(Ln)) { if (onFoot() && washJob(p, dt)) return; }
    else if (/^Fries/.test(Ln)) { if (onFoot() && cookJob(p, dt)) return; }
    else if (/creek/.test(Ln)) { if (onFoot()) { p.creekMode = true; if (diveJob(p, dt, 0)) return; } }
    else if (/murky/.test(Ln)) { if (onFoot() && diveJob(p, dt, 1)) return; }
  }
  if (crew.shiftT < 90 && fillJob(p, dt) && (N === 1 || i === Math.min(2, N - 1))) return;
  if (N >= 3) {
    if (i === 0) { if (crew.carts.length && cartJob(p, dt)) return; return pickJob(p, dt); }
    if (i === 1) { if (cookJob(p, dt)) return; return pickJob(p, dt); }
    if (i === 2) {
      if (tiered && shootJob(p, dt, tot => tot >= 4 || crew.goalRows().some(r => r.id === 'targets' && !r.done) && crew.shiftT > 30)) return;
      if (fillJob(p, dt)) return;
      if (washJob(p, dt)) return; return pickJob(p, dt);
    }
    if (i === 3) {
      const tr = crew.treasure;
      if (tr || creekTargets().length >= 8 || p.creekMode) { if (tr && !M.inPondArea(tr.x, tr.z)) p.creekMode = true; if (creekTargets().length >= 8 && !tr) p.creekMode = true; if (diveJob(p, dt, 10)) return; }
      if (diveJob(p, dt, 10)) return;
      return pickJob(p, dt);
    }
    return pickJob(p, dt);
  }
  if (N === 2) {
    // Rat0: the cart / picking, and the shooter at Tiered. Rat1: the basket, the kitchen, the hose, the water.
    if (i === 0) {
      if (tiered && shootJob(p, dt, (tot, st) => tot >= 8 || (crew.lastCallRung && st.kpi < 0.7) || (crew.goalRows().some(r => r.id === 'targets' && !r.done) && tot >= 3))) { if (crew.cartOf(p)) crew.leaveCart(p); return; }
      if (crew.carts.length && cartJob(p, dt)) return; return pickJob(p, dt);
    }
    if (fillJob(p, dt)) return;
    // GOAL2P=1: a crew that reads the Board's NEXT line: the cook goals (hot dogs, deck orders) get a camping cook,
    // broken only by a filthy fixture, a Gary morning, or a treasure lying down there.
    const rowsG = crew.goalRows(), open = id => rowsG.some(r => r.id === id && !r.done);
    const garyDay = crew.garyToday?.() && !crew.gary;
    if (process.env.GOAL2P === '1') {
      if (p.job === 'wash' || (!p.job && dirtyFixture() && (crew.fixtures[dirtyFixture()] > (garyDay ? 0.3 : 0.7)))) { p.job = 'wash'; if (!washJob(p, dt)) p.job = null; return; }
      if (p.job === 'dive' || (!p.job && crew.treasure && open('treasures'))) { p.job = 'dive'; if (crew.treasure && !M.inPondArea(crew.treasure.x, crew.treasure.z)) p.creekMode = true; if (!diveJob(p, dt, 1) || !crew.treasure && !p.diving && !p.fromDive) { p.job = null; p.creekMode = false; } return; }
      if ((open('fed') || open('orders')) && cookJob(p, dt)) return;
    }
    if (p.job === 'wash' || (!p.job && dirtyFixture() && crew.fixtures[dirtyFixture()] > 0.45)) { p.job = 'wash'; if (!washJob(p, dt)) p.job = null; return; }
    if (p.job === 'cook' || (!p.job && crew.perks.shed)) { p.job = 'cook'; p.cookN = (p.cookN ?? 0); if (!cookJob(p, dt) || (p.cookN++ > 300 && !crew.mods.state('deck')?.deck?.order)) { p.job = null; p.cookN = 0; } else return; }
    if (p.job === 'dive' || (!p.job && (crew.treasure || crew.sunkCount() > 15 || creekTargets().length > 10))) { p.job = 'dive'; if (crew.treasure && !M.inPondArea(crew.treasure.x, crew.treasure.z)) p.creekMode = true; else if (!crew.treasure && creekTargets().length > 10 && crew.sunkCount() < 15) p.creekMode = true; if (!diveJob(p, dt, 1)) { p.job = null; p.creekMode = false; } return; }
    return pickJob(p, dt);
  }
  // solo: a rota
  if (p.job === 'cart' && crew.cartOf(p)) {
    const c = crew.cartOf(p);
    const tm = crew.mods.state('tiered');
    const needOut = (crew.shiftT < 90 && crew.basket.n <= 2 && !(crew.up.bucket >= 1)) || crew.fixtures.sign > 0.4 || (crew.perks.shed && crew.fries < 5 && !crew.perks.autoFry) || crew.sunkCount() > 25 || crew.treasure || (tiered && SHOOT && (tm?.cups.reduce((a, b) => a + b, 0) ?? 0) >= 8) || (crew.goalRows().some(r => r.id === 'fed' && !r.done) && crew.fries > 12 && (p.dogT ?? 0) > 120) || (crew.mods.state('deck')?.deck?.order && crew.goalRows().some(r => r.id === 'orders' && !r.done));
    p.dogT = (p.dogT ?? 0) + dt;
    if (needOut && c.load === 0 && Math.hypot(c.x - STAND.x, c.z - STAND.z) < 10) { crew.leaveCart(p); p.job = null; return; }
    if (needOut && c.load > 0) p.cartHome = true;
    cartJob(p, dt); return;
  }
  if (fillJob(p, dt)) return;
  if (p.job === 'shoot' || (!p.job && tiered && SHOOT)) { if (shootJob(p, dt, (tot, st) => tot >= 8 || (crew.lastCallRung && st.kpi < 0.6))) { p.job = 'shoot'; return; } if (p.job === 'shoot') p.job = null; }
  if (p.job === 'wash' || (!p.job && dirtyFixture() && crew.fixtures[dirtyFixture()] > 0.5)) { p.job = 'wash'; if (!washJob(p, dt)) p.job = null; return; }
  if (p.job === 'cook' || (!p.job && crew.perks.shed && (crew.fries < 6 || crew.goalRows().some(r => r.id === 'fed' && !r.done) && (p.dogT ?? 0) > 120 || crew.mods.state('deck')?.deck?.order))) {
    p.job = 'cook'; p.dogT = 0; p.cookN = (p.cookN ?? 0) + dt;
    if (p.cookN > 50 || !cookJob(p, dt)) { p.job = null; p.cookN = 0; } return;
  }
  if (p.job === 'dive' || (!p.job && (crew.treasure || crew.sunkCount() > 20))) { p.job = 'dive'; if (crew.treasure && !M.inPondArea(crew.treasure.x, crew.treasure.z)) p.creekMode = true; if (!diveJob(p, dt, 1)) { p.job = null; p.creekMode = false; } return; }
  if (crew.carts.length) { p.job = 'cart'; cartJob(p, dt); return; }
  pickJob(p, dt);
}

// ---- shopping ----------------------------------------------------------------------------------------------------
const PRIO = [['bucket', 1], ['filler', 2], ['build', 3], ['shed', 2],   // round 12: the round-11 rows (presets had none)
  ['returns', 2], ['washer', 3], ['shed', 3], ['dive', 1], ['pond', 1], ['amen', 1], ['dive', 2], ['pond', 2], ['gutters', 1], ['wand', 3], ['dive', 3]];
const buys = [];
function tryBuy(reserve) {
  for (const [id, max] of PRIO) {
    if (id === 'dive') {
      const p = N >= 4 ? rats[3] : rats[N - 1];
      if (p.dive >= max) continue;
      const price = S.nextPrice('dive', crew.up, crew.onlineCount(), p.dive, crew.venue);
      if (price != null && price <= crew.cash - reserve && crew.buy(p, 'dive')) buys.push(`d${crew.day} v${crew.venue} dive->${p.dive} $${price}`);
      continue;
    }
    if ((crew.up[id] ?? 0) >= max) continue;
    const price = S.nextPrice(id, crew.up, crew.onlineCount(), 0, crew.venue);
    if (price == null) continue;
    // the gutters are a card goal at Tiered: buy them with the fee reserve's leftovers, or first thing if affordable
    if (price <= crew.cash - reserve && crew.buy(rats[0], id)) buys.push(`d${crew.day} v${crew.venue} ${id}->${crew.up[id]} $${price.toLocaleString()}`);
  }
}
function reserve() {
  const info = crew.promoInfo(); if (!info) return 0;
  const rows = crew.goalRows();
  const otherOpen = rows.filter(r => !r.done && r.kind !== 'fee' && r.kind !== 'buy').length;
  return otherOpen <= 1 ? info.fee : 0;   // save once the card is nearly done
}

const policies = await loadPolicies({ bot: 'mid', crew, rats, N, DT, now: () => t, walkTo: (p, x, z) => walkTo(p, { x, z }, DT) });
// ---- run ---------------------------------------------------------------------------------------------------------
const rows = [];
let sess = 0;
const atVenue = {};
const evc = {};
const goalLog = [];
snap(crew, 'morning'); crew.readyUp(rats[0]);
for (let shift = 0; shift < 30 && crew.venue < 3; shift++) {
  const v0 = crew.venue;
  for (const k of Object.keys(counters)) delete counters[k];
  const X = { deals: [], deckOrders: 0, filled: 0, tab: 0, falls: 0, fallFine: 0, floorAfterFall: 0, lastFall: -99, targets: 0, tLeft: [], verdict: null, quota: null,
    snagsMade: 0, creekDunks: 0, gasps: 0, creekGasps: 0, goals: [], fedSum: 0, fedN: 0, friesSum: 0, kd: 0, refused: 0, empty: 0, glowSnag: 0, morning: null, memo: null, upperCust: 0, rally: [] };
  let secs = 0;
  for (const p of rats) { p.dealt = null; p.job = null; p.creekMode = false; }
  while (crew.phase === 'shift') {
    t += DT; secs += DT;
    const mw = crew.mower, fighting = FIGHT > 0 && mw?.kind === 'boss' && MW.bossLive(mw) && mw.phase !== 'warn';
    const held = policies.step(crew, DT);
    if (fighting) {   // stand still for FIGHT s, then tame it (the measured 4P fight is 49-67 s)
      fightAt ??= t;
      for (const p of rats) { p.seenAt = t * 1000; if (crew.cartOf(p)) crew.leaveCart(p); }
      if (t - fightAt >= FIGHT && mw.phase !== 'plug') { mw.phase = 'tamed'; mw.t = 0; crew.moweFightPhase('tamed'); fightLog.push('d' + crew.day + ' tamed@' + Math.round(t - fightAt)); fightAt = null; }
    } else rats.forEach((p, i) => { p.seenAt = t * 1000; if (!held.has(p)) ratStep(p, i, DT); });
    CL.step(rats, DT);
    crew.tick(DT);
    calls.step(crew, DT);
    for (const e of crew.events) {
      evc[e.t] = (evc[e.t] ?? 0) + 1;
      if (['debut','buy','pa','reveal','garyIntro','treasure','promoted'].includes(e.t)) NOV.push(`d${crew.day} v${crew.venue} t${Math.round(crew.shiftT)} ${e.t} ${e.kind ?? e.id ?? e.line ?? e.key ?? ''}${e.tier ?? ''}`);
      if (e.t === 'lastcall' || e.t === 'rally') { for (const p of rats) p.dealt = e.needs?.[p.id] ?? e.need ?? p.dealt; X.deals.push(e.t[0] + '@' + Math.round(crew.shiftSecs - crew.shiftT) + ':' + rats.map(p => p.dealt).join(' / ')); }
      if (e.t === 'deal' || e.t === 'morning') X.morning = JSON.stringify(e).slice(0, 300);
      if (e.t === 'deckOrder') X.deckOrders++;
      if (e.t === 'deckTab' && e.order) { X.filled++; X.tab += e.n; }
      if (e.t === 'deckFall') { X.falls++; X.fallFine += e.fine; X.lastFall = secs; }
      if (e.t === 'knock') { X.kd++; X.kb = X.kb ?? {}; const kk = (String(e.id).startsWith('h') ? 'help:' : 'rat:') + (e.by ?? e.cause ?? 'ball'); X.kb[kk] = (X.kb[kk] ?? 0) + 1; if (secs - X.lastFall < 3.5) { X.floorAfterFall++; X.fb = X.fb ?? {}; const kk = (String(e.id).startsWith('h') ? 'help:' : 'rat:') + (e.by ?? 'ball') + ':' + (secs - X.lastFall < 0.15 ? 'same' : 'after'); X.fb[kk] = (X.fb[kk] ?? 0) + 1; } }
      if (e.t === 'target') { X.targets++; X.tLeft.push(Math.round(crew.shiftSecs - crew.shiftT)); }
      if (e.t === 'verdict') X.verdict = { fails: e.fails, huddle: e.huddle, seal: !!e.seal, where: rats.map(p => Math.round(Math.hypot(p.x - STAND.x, p.z - STAND.z)) + (p.diving ? 'D' : '') + (crew.cartOf(p) ? 'C' : '') + (p.down > 0 ? 'X' : '')).join(','), checks: (crew.gary?.checks ?? []).map(c => c.stop + (c.ok ? '+' : '-')).join(' ') };
      if (e.t === 'quota') X.quota = e;
      if (e.t === 'snag') X.snagsMade++;
      if (e.t === 'dive' && e.on && e.creek) { const p = crew.players.get(e.id); if (p && !p.creekMode) X.creekDunks++; }
      if (e.t === 'gasp') { X.gasps++; if (e.creek) X.creekGasps++; }
      if (e.t === 'goal') { X.goals.push(`${e.id}@${Math.round(crew.shiftT)}s+$${e.reward}`); goalLog.push({ day: crew.day, venue: crew.venue, vd: crew.venueDay, id: e.id, reward: e.reward }); }
      if (e.t === 'refuse') X.refused++;
      if (e.t === 'memo') X.memo = e.text;
      if (e.t === 'leave' && e.empty) X.empty++;
    }
    crew.events = [];
    if (crew.working()) { X.fedSum += crew.fedSt?.fed ?? 1; X.fedN++; X.friesSum += crew.fries / S.FRIES.MAX; }
    if (Math.round(secs * 10) % 300 === 0) { tryBuy(reserve()); policies.buy(); }
  }
  atVenue[v0] = (atVenue[v0] ?? 0) + 1;
  sess += secs + 30;
  const r = crew.report, q = r.quota, v = crew.valueNow();
  const rowsG = r.goals?.rows ?? crew.goalRows();
  const row0vd = crew.venueDay;
  const row = { day: r.day, venue: v0, vd: crew.venueDay, min: Math.round(sess / 60), income: Math.round(r.cash), banked: r.deposited,
    bvEnd: +v.bv.toFixed(1), q: q ? (q.hit ? 'HIT' : 'miss') : '-', gauge: q?.gauge, why: q?.why, reviews: crew.reviews, cash: Math.round(crew.cash), fee: r.promo?.fee,
    card: rowsG.map(g => `${g.id}:${g.have}/${g.need}${g.done ? '✓' : ''}`).join(' '), goals: X.goals.join(' '), head: crew.goalWire()?.head,
    fedMean: +(X.fedSum / Math.max(1, X.fedN)).toFixed(3), fryMean: +(X.friesSum / Math.max(1, X.fedN)).toFixed(2), fedCash: Math.round(r.fedCash ?? crew.stats.fedCash ?? 0), dogs: crew.stats.dogs ?? 0,
    deckOrders: `${X.filled}/${X.deckOrders}`, tab: Math.round(X.tab), falls: X.falls, fallFine: Math.round(X.fallFine), floorAfterFall: X.floorAfterFall, fb: X.fb,
    targets: X.targets, tLeft: X.tLeft.join(','), verdict: X.verdict, snags: `${counters.snagBalls ?? 0}/${X.snagsMade}`, creekDunks: X.creekDunks, gasps: `${X.creekGasps}/${X.gasps}`,
    treasures: crew.lostFound.length, kd: X.kd, kb: X.kb, refused: X.refused, deals: X.deals.join(' | '), memo: X.memo, tomorrow: r.tomorrow,
    c: Object.fromEntries(Object.entries(counters).map(([k, v]) => [k, Math.round(v)])),
    calls: calls.endShift(crew, { vd: row0vd }), ...policies.shiftEnd(r) };
  rows.push(row);
  if (V) console.log(JSON.stringify(row));
  tryBuy(reserve());
  if (crew.promoInfo()?.ready) {
    const fee = crew.promoInfo().fee, before = crew.cash;
    for (const p of rats) crew.sign(p, true);
    rows.push({ promoted: crew.venue, fee, cashBefore: Math.round(before), cashAfter: Math.round(crew.cash), atMin: Math.round(sess / 60) });
    if (V) console.log('PROMOTED', JSON.stringify(rows.at(-1)));
  }
  if (crew.venue === v0) capCheck(crew, atVenue[v0]);
  snap(crew, 'morning'); for (const p of rats) crew.readyUp(p);
}
console.log(`N=${N} seed=${SEED} start=${START}`);
if (!V) for (const r of rows) console.log(JSON.stringify(r));
const prom = rows.filter(r => r.promoted);
console.log('SUMMARY', JSON.stringify({ N, SEED, club: rows.filter(r => r.venue === 1).length, tiered: rows.filter(r => r.venue === 2).length, cashAtTiered: prom[0]?.cashAfter, cashAtStadium: prom[1]?.cashAfter, min: prom[1]?.atMin,
  lastGoal: [1, 2].map(v => goalLog.filter(g => g.venue === v).at(-1)?.id), goalVd: goalLog.map(g => `v${g.venue}d${g.vd}:${g.id}`).join(' ') }));
console.log(CL.report()); console.log('NOV ' + NOV.join(' | '));
console.log('SHOTS', JSON.stringify(shots));
if (fightLog.length) console.log('FIGHTS', fightLog.join(' '));
calls.print(); policies.summary();
console.log('buys:', buys.join(' | '));
console.log('events:', JSON.stringify(evc));
console.log('up:', JSON.stringify(crew.up), 'dive:', rats.map(p => p.dive).join(','), 'lostFound:', crew.lostFound.join(','));
