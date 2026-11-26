// Copied from the expert review's ladder scripts (round 11) for scripts/make-presets.mjs; see snap.mjs.
// Playtest C, playthrough 5: Stadium day 1 -> County -> Orbital -> Last Bucket -> endless, through the real Crew,
// playing the goal cards. Real cart laps (pose round the Track), real pings (crew.ping on a driven/auto cart),
// the autopilot cart (AP=off|lap|harvest), real Yards pickups (so the strays goal counts), "Drones, here!" (DISP=1),
// a real EVA (rotating riders so every Rat rides the Lift), the real Last Bucket walk + huddle.
// usage: node ladder5.mjs N seed   env: AP=lap|harvest|off  DISP=1|0  PINGR=2 (pings/min by the bay Rat)  ENDLESS=4  V=1
const REPO = new URL('../../', import.meta.url).href;
const { snap, startSave } = await import('./snap.mjs');
const { Crew } = await import(REPO + 'server/crew.mjs');
const S = await import(REPO + 'web/js/sim.js');
const { MAP } = await import(REPO + 'web/js/map.js');
const { isStray } = await import(REPO + 'web/js/county.js');
const { diveTiers, debrisSpot, LIFT, ORBIT, evaSwim } = await import(REPO + 'web/js/orbit.js');
const GL = await import(REPO + 'web/js/goals.js');

const N = +(process.argv[2] ?? 4), SEED = +(process.argv[3] ?? 7);
const AP = process.env.AP ?? 'lap', DISP = process.env.DISP !== '0', PINGR = +(process.env.PINGR ?? 2), ENDLESS = +(process.env.ENDLESS ?? 4);
const V = process.env.V === '1';
const ST = S.SIM.STAND;
let t = 0;
const UP = { shoes: 3, hardhat: 1, helpers: 4, ads: 3, washer: 3, cart: 2, shed: 3, amen: 2, pond: 2, gutters: 1, gear: 3, wand: 2, bucket: 1, returns: 2, bays: 1 };
const START = startSave() ?? (process.env.START ? JSON.parse(process.env.START) : { v: 5, day: 14, venue: 3, venueDay: 0, cash: +(process.env.CASH ?? (N === 1 ? 400000 : 900000)), outstanding: 713366000, reviews: 0, commendations: 6, pendingReveal: 3, up: UP, diveByName: Object.fromEntries(Array.from({ length: N }, (_, i) => ['Rat' + i, 2])) });
const crew = new Crew('SIMC', START, { now: () => t * 1000, seed: SEED });
const rats = [];
for (let i = 0; i < N; i++) { const p = crew.join('Rat' + i); crew.connect(p); rats.push(p); }
const DT = 0.1;
const FM = +(process.env.FOOTMUL ?? 1), CM = +(process.env.CARTMUL ?? 1);
const FOOT = [0.12, 0.25, 0.5, 0.9].map(x => x * FM), CARTR = [0, 3, 4.5, 4.5].map(x => x * CM);
const PRIO = [['build', 3], ['filler', 2], ['cart', 3], ['cart', 4], ['wand', 3], ['dive', 3], ['amen', 3], ['drones', 1], ['tether', 1], ['drones', 2], ['owner', 1], ['owner', 2], ['owner', 3]];
const SKIP = new Set((process.env.SKIP ?? '').split(',').filter(Boolean));
const log = [], out = s => { log.push(s); if (V) console.log(s); };
let sessionSecs = 0;
const venueStart = { 3: 0 }, venueShifts = [0, 0, 0, 0, 0, 0, 0], promoCash = {};
const goalLog = [], cardLog = [], closeLog = [], stadLog = [], countyLog = [], skyLog = [], lbLog = [], endLog = [], garyLog = [];

function tryBuy() {
  let any = true;
  while (any) {
    any = false;
    for (const [id, max] of PRIO) {
      if (SKIP.has(id + max) || SKIP.has(id)) continue;
      if (id === 'dive') {
        for (const p of rats) { if (p.dive >= max) continue; const price = S.nextPrice('dive', crew.up, crew.onlineCount(), p.dive, crew.venue); if (price != null && price <= crew.cash && crew.buy(p, 'dive')) any = true; }
        continue;
      }
      if ((crew.up[id] ?? 0) >= max) continue;
      // a goal-aware crew keeps the fee: don't spend below it once every other goal is done (except card purchases)
      const price = S.nextPrice(id, crew.up, crew.onlineCount(), 0, crew.venue, Infinity, crew.endless);
      if (price == null || price > crew.cash) continue;
      const cardBuy = crew.goals && GL.CARDS[crew.goals.venue].some(g => GL.GOALS[g.id].kind === 'buy' && GL.GOALS[g.id].row === id);
      const fee = crew.promoFee() ?? 0;
      if (!cardBuy && !crew.endless && crew.cash - price < fee && id !== 'owner') continue;
      if (crew.buy(rats[0], id)) { any = true; out(`     buy v${crew.venue} vd${crew.venueDay} T-${(crew.shiftSecs - crew.shiftT).toFixed(0)} ${id}${crew.up[id]} $${price.toLocaleString()} (left $${Math.round(crew.cash).toLocaleString()})`); }
    }
  }
}

const restBalls = () => [...crew.balls.values()].filter(b => b.rest && !b.sunk && !b.drifting && !b.creek && b.kind !== 'one');
function takeBall(b, carrier, kind = null, gearOv = null) {
  crew.balls.delete(b.id);
  crew.events.push({ t: 'gone', id: b.id, by: carrier });
  const k = b.kind === 'splitter' ? 3 : 1, w = (S.KIND_W[b.kind] ?? 1) * (k === 3 ? 3 : 1);
  crew.bank(k, carrier, kind, w, gearOv);
}
const T = MAP.TRACK;
const rowsStr = () => crew.goalRows().map(r => `${r.id}:${r.done ? 'OK' : r.kind === 'fee' ? Math.round(r.have / 1e3) + 'k/' + Math.round(r.need / 1e3) + 'k' : r.have + '/' + r.need}`).join(' ');

let lapper = null, pingAcc = 0, yards = null, eva = null, evaNext = 0, lb = null;
const skyCrew = new Map();
let stad = null, cty = null;

function runShift() {
  const acc = new Map(rats.map(p => [p.id, 0]));
  let washAcc = 0, cookT = 0, cookStep = 0, diveAcc = 0, secs = 0;
  lapper = null; yards = null; eva = null; pingAcc = 0;
  const v = crew.endless ? 6 : crew.venue;
  stad = { laps: 0, autoLaps: 0, pings: 0, autoPings: 0, harvested: 0, apOn: null }; cty = { disp: 0, droneStrays: 0, ratStrays: 0, yardTrips: 0 };
  let at90 = null, at60 = null, left60 = null, apSet = false;
  while (crew.phase === 'shift') {
    t += DT; secs += DT;
    crew.tick(DT);
    if (crew.lastBucket && !crew._lbSnap) { crew._lbSnap = true; snap(crew, 'lb'); }
    for (const e of crew.events) {
      if (e.t === 'goal') goalLog.push(`v${v} vd${crew.venueDay} T-${(crew.shiftSecs - crew.shiftT).toFixed(0)} GOAL ${e.id} (${e.need}) +$${Math.round(e.reward).toLocaleString()}  [${GL.doneToast(e.id, e.need, e.reward)}] words ${GL.doneToast(e.id, e.need, e.reward).split(/\s+/).length}`);
      if (e.t === 'crowd' && e.kind === 'lap') { if (e.auto) stad.autoLaps++; else stad.laps++; }
      if (e.t === 'gone' && e.by && typeof e.by === 'string' && e.by.startsWith?.('d') && v === 4) cty.droneStrays++;
      if (e.t === 'gary' || e.t === 'check') garyLog.push(`v${v} d${crew.day} vd${crew.venueDay} T-${(crew.shiftSecs - crew.shiftT).toFixed(0)} ${e.t} ${e.phase ?? ''}${e.stop ?? ''} ${e.ok ?? ''} gary@${crew.gary?.x?.toFixed(0)},${crew.gary?.z?.toFixed(0)}`);
      if (e.t === 'verdict') garyLog.push(`v${v} d${crew.day} vd${crew.venueDay} verdict fails ${e.fails} huddle ${e.huddle} seal ${!!e.seal}`);
      if (e.t === 'lastbucket') skyLog.push(`  lastbucket ${e.phase} day ${crew.day} T-${(crew.shiftSecs - crew.shiftT).toFixed(0)} debris ${e.debris ?? ''} rows ${rowsStr()}`);
    }
    crew.events = [];
    const left = crew.shiftSecs - crew.shiftT;
    if (at90 == null && crew.lastCall()) at90 = { g: crew.mods.kpi(), left };
    if (at60 == null && crew.closing()) { at60 = { g: crew.mods.kpi(), left }; left60 = crew.ballsLeft?.() ?? null; }
    if (crew.lastBucket && crew.lastBucket.phase !== 'done') { const r = lastBucket(); if (r === 'stuck') return { secs, stuck: true }; continue; }
    for (const p of rats) if (!(lapper && lapper.p === p) && !(eva && eva.p === p && eva.ph === 'up') && !(yards && yards.p === p)) { p.seenAt = t * 1000; p.x = -6 + rats.indexOf(p) * 3; p.z = 12; }
    for (const p of rats) p.seenAt = t * 1000;
    if (!crew.working()) continue;
    const solo = N === 1;
    const shed = crew.perks.shed > 0, pond = crew.pondOpen();
    // ---- the Stadium
    const auto = crew.perks.autopilot && AP !== 'off';
    const autoCart = auto && crew.carts.length > 1 ? crew.carts[crew.carts.length - 1] : null;
    if (v === 3 || v >= 4 && autoCart) {
      if (autoCart && !apSet) { autoCart.driver = null; if (AP === 'harvest') { const p = rats[0]; const ox = p.x, oz = p.z; p.x = autoCart.x + 1; p.z = autoCart.z; crew.input(p, { a: [{ t: 'auto' }] }); p.x = ox; p.z = oz; } apSet = true; stad.apOn = left; }
      if (v === 3) stadiumChore(solo, autoCart);
    }
    if (v === 4) countyChore(solo);
    if (v === 5) orbitChore(solo);
    const busy = new Set([lapper?.p, yards?.p, eva?.p].filter(Boolean));
    // the pinger: a Rat at a crew bay pings a driven or autopilot cart
    const pingTarget = crew.carts.find(c => (c.driver && lapper && lapper.cart === c) || (c.auto && !c.driver));
    const pinger = rats[N - 1];
    const wantPing = pingTarget && v === 3 && (crew.goalOpen('pings') || PINGR > 0 && autoCart) && !busy.has(pinger);
    if (wantPing) {
      pingAcc += PINGR / 60 * DT;
      if (pingAcc >= 1) { pingAcc -= 1; crew.ping({ by: pinger.id, vx: 0, vy: -1, vz: 0 }, pingTarget); if (pingTarget.auto) stad.autoPings++; stad.pings++; }
      busy.add(pinger);
    }
    const chores = { wash: 0, cook: 0, dive: 0 };
    if (solo) { chores.wash = 0.12; chores.cook = shed && crew.perks.autoFry === 0 ? 0.12 : shed ? 0.05 : 0; chores.dive = pond ? 0.1 : 0; }
    else { chores.wash = 0.3 * N / 4; chores.cook = shed ? (N >= 3 ? 0.7 : 0.35) : 0; chores.dive = pond ? 0.5 * N / 4 : 0; }
    if (solo && busy.size) for (const k in chores) chores[k] = 0;
    const choreSum = Object.values(chores).reduce((a, b) => a + b, 0);
    let rb = restBalls().filter(b => !(v >= 4 && isStray(b)));
    rb.sort((a, b) => (a.cup ? 0 : 1) - (b.cup ? 0 : 1));
    const cartBalls = [...rb];
    const freeCarts = crew.carts.filter(c => !(lapper && lapper.cart === c) && c !== autoCart);
    const pickers = rats.filter(p => !busy.has(p));
    pickers.forEach((p, i) => {
      const drives = i < freeCarts.length && !(solo && busy.size);
      const nFoot = Math.max(1, pickers.length - freeCarts.length);
      const share = solo ? Math.max(0, 1 - choreSum) : drives ? 1 : Math.max(0, 1 - choreSum / nFoot);
      if (drives) {
        const c = freeCarts[i]; c.driver = p.id;     // a driven cart is not on autopilot
        acc.set(p.id, acc.get(p.id) + CARTR[Math.min(2, crew.perks.cart)] * share * DT);
        while (acc.get(p.id) >= 1 && cartBalls.length) {
          const b = cartBalls.pop(); if (!crew.balls.has(b.id)) continue;
          c.mud = 0.3; takeBall(b, p.id, 'cart', S.cartGearOf(c)); acc.set(p.id, acc.get(p.id) - 1);
        }
        if (acc.get(p.id) > 5) acc.set(p.id, 5);
      } else {
        acc.set(p.id, acc.get(p.id) + FOOT[Math.min(3, p.gear)] * share * DT);
        while (acc.get(p.id) >= 1 && rb.length) {
          const b = rb.shift(); if (!crew.balls.has(b.id)) continue;
          takeBall(b, p.id); acc.set(p.id, acc.get(p.id) - 1);
        }
        if (acc.get(p.id) > 3) acc.set(p.id, 3);
      }
    });
    for (const c of crew.carts) if (c !== autoCart && !freeCarts.slice(0, pickers.length).includes(c) && !(lapper && lapper.cart === c)) c.driver = null;
    washAcc += chores.wash * 0.08 * 1.6 * (crew.perks.washRate ?? 1) * DT * 0.6;
    const nAct = S.activeMats(crew.onlineCount(), crew.up);
    const fx = ['sign', 'stand', ...Array.from({ length: nAct }, (_, i) => 'mat' + i)];
    while (washAcc > 0.001) {
      const f = fx.reduce((m, k) => ((crew.fixtures[k] ?? 0) > (crew.fixtures[m] ?? 0) ? k : m), fx[0]);
      if ((crew.fixtures[f] ?? 0) <= 0.02) { washAcc = 0; break; }
      const d = Math.min(washAcc, crew.fixtures[f]); crew.fixtures[f] -= d; washAcc -= d;
    }
    if (shed) {
      cookT += chores.cook * DT;
      if (cookT >= 6) {
        cookT -= 6;
        const cook = rats[Math.min(1, N - 1)];
        const ox = cook.x, oz = cook.z; cook.x = S.FRIES.SHED.x; cook.z = S.FRIES.SHED.z; cook.servedAt = 0;
        const item = ['fries', 'hotdog', 'beer'][cookStep++ % 3];
        crew.serve(cook, { item, quality: crew.rng() < 0.5 ? 'perfect' : 'good' });
        cook.x = ox; cook.z = oz;
      }
    }
    if (pond) {
      diveAcc += chores.dive * 0.4 * (1 + 0.3 * Math.min(2, rats[0].dive)) * DT;
      while (diveAcc >= 1) {
        const b = [...crew.balls.values()].find(o => o.sunk && o.kind !== 'one');
        if (!b) { diveAcc = 0; break; }
        diveAcc -= 1; takeBall(b, rats[Math.min(1, N - 1)].id);
      }
    }
    if ((secs % 10) < DT) tryBuy();
  }
  if (lapper) { lapper.cart.driver = null; lapper = null; }
  for (const c of crew.carts) c.driver = null;
  return { secs, at90, at60, left60 };
}

// ---- Stadium: the lapper drives laps while the laps goal is open or the crowd is low
function stadiumChore(solo, autoCart) {
  const g = crew.mods.kpi();
  const want = crew.goalOpen('laps') && !autoCart || g < 0.62 || (lapper && g < 0.8);
  if (!want) { if (lapper) { lapper.cart.driver = null; lapper = null; } return; }
  if (!lapper) {
    const free = crew.carts.filter(c => c !== autoCart);
    if (!free.length) return;
    const cart = free[free.length - 1];
    const p = solo ? rats[0] : rats[1];
    cart.driver = p.id; lapper = { cart, p, th: 0, transit: 4 };
  }
  const c = lapper.cart, p = lapper.p;
  if (lapper.transit > 0) { lapper.transit -= DT; return; }
  const sp = crew.perks.cartSpeed * 1.3, r = Math.sqrt((T.a ** 2 + T.b ** 2) / 2);
  lapper.th += sp / r * DT;
  c.x = T.x + T.a * Math.cos(lapper.th); c.z = T.z + T.b * Math.sin(lapper.th); c.driver = p.id;
  p.x = c.x; p.z = c.z; p.seenAt = t * 1000; p.movedAt = t * 1000;
}

// ---- County: a Yards walk with real pickups; with drones, "Drones, here!" every 30 s from the Yards
function countyChore(solo) {
  const strays = () => restBalls().filter(isStray);
  const drones = (crew.up.drones ?? 0) > 0;
  if (!yards) {
    const need = crew.goalOpen('strays') ? 3 : 8;
    if (strays().length < need) return;
    yards = { p: solo ? rats[0] : rats[Math.min(2, N - 1)], ph: 'out', t: 14, acc: 0, dispT: 0 };
    cty.yardTrips++;
  }
  const y = yards, p = y.p, cap = S.gearPerks(p.gear).pocket;
  if (y.ph === 'out') { if ((y.t -= DT) <= 0) y.ph = 'pick'; p.x = 75; p.z = -100; p.movedAt = t * 1000; return; }
  if (y.ph === 'pick') {
    if (drones && DISP) {
      if ((y.dispT -= DT) <= 0) {
        const st = strays(); const b = st[0];
        if (b) { p.x = b.x; p.z = b.z; crew.input(p, { a: [{ t: 'dispatch' }] }); cty.disp++; y.dispT = 30; }
      }
    }
    y.acc += FOOT[Math.min(3, p.gear)] * DT;
    const st = strays();
    while (y.acc >= 1 && st.length && p.pocket < cap) { const b = st.shift(); p.x = b.x; p.z = b.z; if (crew.pickup(p, b.id)) cty.ratStrays++; y.acc -= 1; }
    if (y.acc > 2) y.acc = 2;
    p.movedAt = t * 1000;
    if (!st.length || p.pocket >= cap || (crew.shiftSecs - crew.shiftT < 15)) { y.ph = 'back'; y.t = 14; }
    return;
  }
  if ((y.t -= DT) <= 0) { p.x = ST.x; p.z = ST.z; crew.deposit(p); yards = null; }
}

// ---- Orbital: a real EVA, riders rotating so every Rat rides the Lift
function orbitChore(solo) {
  const st = crew.mods.state('orbit');
  if (!eva) {
    if (st.debris.size < (crew.goalOpen('debris') || crew.goalOpen('lift') ? 1 : 10)) return;
    eva = { p: solo ? rats[0] : rats[evaNext++ % N], ph: 'walk', t: 12 };
  }
  const e = eva, p = e.p;
  if (e.ph === 'walk') { if ((e.t -= DT) <= 0) { p.x = LIFT.x; p.z = LIFT.z; crew.input(p, { a: [{ t: 'lift' }] }); e.ph = st.riders.has(p.id) ? 'up' : 'fail'; } return; }
  if (e.ph === 'fail') { eva = null; return; }
  if (e.ph === 'up') {
    const r = st.riders.get(p.id);
    if (!r) { e.ph = 'bank'; e.t = 16; return; }
    if (r.ph !== 'out') return;
    const tier = diveTiers(p.dive), sw = evaSwim(tier);
    if (r.bag.length >= tier.bag || r.air < 8 || !st.debris.size) { crew.input(p, { a: [{ t: 'ridedown' }] }); return; }
    let best = null, bd = Infinity;
    for (const id of st.debris) { const s = debrisSpot(id); const d = Math.hypot(s.x - (p.x - LIFT.x), s.z - (p.z - LIFT.z)); if (d < bd) { bd = d; best = s; } }
    if (bd > ORBIT.GRAB * 0.8) { const k = Math.min(1, sw * DT / bd); p.x += (best.x + LIFT.x - p.x) * k; p.z += (best.z + LIFT.z - p.z) * k; p.movedAt = t * 1000; }
    else crew.input(p, { a: [{ t: 'grab' }] });
    return;
  }
  if (e.ph === 'bank') { if ((e.t -= DT) <= 0) { p.x = ST.x; p.z = ST.z; crew.deposit(p); eva = null; } }
}

function skyChore() {
  const st = crew.mods.state('orbit');
  if (lb.sky0 == null) { lb.sky0 = t; skyCrew.clear(); skyLog.push(`  sky phase day ${crew.day} T-${(crew.shiftSecs - crew.shiftT).toFixed(0)} debris ${crew.skyDebris()} rows ${rowsStr()}`); }
  for (const p of rats) {
    p.seenAt = t * 1000;
    let s = skyCrew.get(p.id); if (!s) { s = { ph: 'walk', t: 15 }; skyCrew.set(p.id, s); }
    if (s.ph === 'walk') { if ((s.t -= DT) <= 0) { p.x = LIFT.x; p.z = LIFT.z; crew.input(p, { a: [{ t: 'lift' }] }); s.ph = st.riders.has(p.id) ? 'up' : 'walk'; s.t = 1; } continue; }
    const r = st.riders.get(p.id);
    if (!r) { s.ph = 'walk'; s.t = 3; continue; }
    if (r.ph !== 'out') continue;
    const tier = diveTiers(p.dive), sw = evaSwim(tier);
    if (r.bag.length >= tier.bag || r.air < 6 || !st.debris.size) { crew.input(p, { a: [{ t: 'ridedown' }] }); continue; }
    let best = null, bd = Infinity;
    for (const id of st.debris) { const sp = debrisSpot(id); const d = Math.hypot(sp.x - (p.x - LIFT.x), sp.z - (p.z - LIFT.z)); if (d < bd) { bd = d; best = sp; } }
    if (bd > ORBIT.GRAB * 0.8) { const k = Math.min(1, sw * DT / bd); p.x += (best.x + LIFT.x - p.x) * k; p.z += (best.z + LIFT.z - p.z) * k; p.movedAt = t * 1000; }
    else crew.input(p, { a: [{ t: 'grab' }] });
  }
}
function lastBucket() {
  const now = t * 1000, walk = crew.perks.walk;
  if (!lb) {
    lb = { t0: t, carrierAt: null, day: crew.day };
    rats.forEach((p, i) => { p.x = -20 + i * 15; p.z = -40 - i * 10; p.movedAt = now; p.holding = false; });
    if (lapper) { lapper.cart.driver = null; lapper = null; } for (const c of crew.carts) c.driver = null; yards = null; eva = null;
    lbLog.push(`Last Bucket begins day ${crew.day} T-${(crew.shiftSecs - crew.shiftT).toFixed(0)} phase ${crew.lastBucket.phase}`);
  }
  if (crew.lastBucket.phase === 'sky') { if (crew.phase !== 'shift') { skyLog.push(`  BELL during sky, debris ${crew.skyDebris()}`); lb = null; return 'done'; } skyChore(); return; }
  if (lb.sky0 != null && lb.skyEnd == null) { lb.skyEnd = t; skyLog.push(`  sky cleared after ${(t - lb.sky0).toFixed(0)} s, T-${(crew.shiftSecs - crew.shiftT).toFixed(0)}`); }
  const L = crew.lastBucket, one = [...crew.balls.values()].find(b => b.kind === 'one');
  const step = (p, gx, gz) => { const d = Math.hypot(gx - p.x, gz - p.z); if (d < 0.05) return true; const k = Math.min(1, walk * DT / d); p.x += (gx - p.x) * k; p.z += (gz - p.z) * k; p.movedAt = now; p.seenAt = now; return d < 0.3; };
  const carrier = rats[0];
  for (const p of rats) p.seenAt = now;
  if (L.phase === 'down' && one?.rest) { if (lb.landed == null) { lb.landed = t; lbLog.push(`  Ball No. 1 at rest ${(t - lb.t0).toFixed(1)} s in, ${Math.hypot(one.x - ST.x, one.z - ST.z).toFixed(0)} m from the return`); } if (step(carrier, one.x, one.z) || Math.hypot(one.x - carrier.x, one.z - carrier.z) < 1) crew.pickup(carrier, one.id); }
  if (carrier.one) { if (lb.picked == null) lb.picked = t; step(carrier, ST.x, ST.z + 0.5); crew.deposit(carrier); }
  for (const p of rats.slice(1)) { const a = rats.indexOf(p) * 1.4; step(p, ST.x + Math.cos(a) * 4, ST.z + Math.sin(a) * 4); }
  if (L.phase === 'huddle' && lb.carrierAt == null) { lb.carrierAt = t; lbLog.push(`  carrier at the return ${(t - lb.picked).toFixed(1)} s after pickup`); }
  if (L.phase === 'huddle') for (const p of rats) if (Math.hypot(p.x - ST.x, p.z - ST.z) < 8) crew.input(p, { a: [{ t: 'hold', on: true }] });
  if (crew.lastBucket.phase === 'done' || crew.phase !== 'shift') { lbLog.push(`  BANKED ${(t - (lb.carrierAt ?? t)).toFixed(1)} s after carrier at return; ${(t - lb.t0).toFixed(0)} s from start`); return 'done'; }
  if (t - lb.t0 > 900) { lbLog.push('  STUCK ' + JSON.stringify(L) + ' carrier ' + JSON.stringify({x:carrier.x,z:carrier.z,down:carrier.down,one:carrier.one,pocket:carrier.pocket,rider:crew.mods.state('orbit').riders.has(carrier.id)}) + ' ball ' + JSON.stringify(one)); return 'stuck'; }
}

let shifts = 0, endlessN = 0, lastBucketAt = null;
snap(crew, 'morning'); crew.readyUp(rats[0]);
while (shifts < 80) {
  const v0 = crew.endless ? 6 : crew.venue;
  tryBuy();
  const r = runShift(); if (r.stuck) break;
  shifts++; venueShifts[v0]++;
  const rep = crew.report, q = rep.quota;
  sessionSecs += r.secs + 40;
  if (v0 >= 3 && v0 <= 5) closeLog.push(`v${v0} vd${crew.venueDay} gauge@1:30 ${r.at90?.g?.toFixed(2) ?? '-'} @1:00 ${r.at60?.g?.toFixed(2) ?? '-'} @bell ${q?.gauge?.toFixed?.(2) ?? '-'} ${q ? (q.hit ? 'HIT' : 'miss') : ''} gaugeOk ${q?.gaugeOk} left@1:00 ${r.left60 ?? '-'} out ${crew.outstanding}`);
  if (v0 === 3) stadLog.push(`vd${crew.venueDay} laps ${stad.laps} autoLaps ${stad.autoLaps} pings ${stad.pings} (auto ${stad.autoPings}) apOn T-${stad.apOn?.toFixed(0) ?? '-'} crowdLaps ${crew.mods.state('stadium')?.laps} autoLapsMod ${crew.mods.state('stadium')?.autoLaps} income $${Math.round(crew.stats.cash).toLocaleString()} carts ${crew.carts.length}`);
  if (v0 === 4) countyLog.push(`vd${crew.venueDay} yardTrips ${cty.yardTrips} ratStrays ${cty.ratStrays} droneGone ${cty.droneStrays} dispatches ${cty.disp} strays-goal ${crew.goals?.n?.strays ?? '-'} drones ${crew.up.drones ?? 0} income $${Math.round(crew.stats.cash).toLocaleString()}`);
  const line = `d${String(rep.day).padStart(2)} v${v0} vd${crew.venueDay} ${(sessionSecs / 60).toFixed(0).padStart(4)}min income $${Math.round(crew.stats.cash).toLocaleString().padStart(11)} q ${q ? (q.hit ? 'HIT ' : 'miss') : '--  '} cash $${Math.round(crew.cash).toLocaleString()} fee ${crew.promoFee()?.toLocaleString() ?? '-'} | ${rowsStr()}`;
  out(line);
  if (v0 <= 5 && crew.goals) cardLog.push(`v${v0} vd${crew.venueDay}: ${crew.goalWire()?.head} | ${GL.tomorrowLine(crew.goalRows(), crew.venue)}`);
  if (crew.endless && v0 !== 6 && lastBucketAt == null) { lastBucketAt = sessionSecs; out(`   *** LAST BUCKET banked at ${(sessionSecs / 60).toFixed(0)} min (day ${rep.day})`); }
  if (v0 === 6) { endLog.push(`  e${endlessN + 1} d${rep.day} income ${(crew.stats.cash / 1e6).toFixed(1)}M race ${JSON.stringify(rep.race)} record ${rep.record ? 'NEW' : '-'} owner ${crew.up.owner ?? 0} cash ${(crew.cash / 1e6).toFixed(1)}M mult ${crew.mult}`); if (++endlessN >= ENDLESS) break; }
  tryBuy();
  if (crew.promoInfo()?.ready) {
    promoCash[v0] = Math.round(crew.cash);
    for (const p of rats) crew.sign(p, true);
    if (crew.venue !== v0) { venueStart[crew.venue] = sessionSecs; out(`   >>> PROMOTED to ${crew.venue} at ${(sessionSecs / 60).toFixed(0)} min (cash before fee $${promoCash[v0].toLocaleString()})`); }
  }
  snap(crew, 'morning'); for (const p of rats) crew.readyUp(p);
}
if (!V) console.log(log.join('\n'));
console.log(`\nN=${N} seed=${SEED} AP=${AP} DISP=${DISP} PINGR=${PINGR}`);
console.log('venue start (min):', Object.entries(venueStart).map(([v, s]) => `${v}:${(s / 60).toFixed(0)}`).join(' '));
console.log('shifts per venue (3,4,5,endless):', venueShifts.slice(3).join(' '));
console.log('last bucket at (min from Stadium d1):', lastBucketAt ? (lastBucketAt / 60).toFixed(0) : 'never', ' total shifts', shifts);
console.log('GOALS:'); goalLog.forEach(x => console.log('  ' + x));
console.log('CARD:'); cardLog.forEach(x => console.log('  ' + x));
console.log('CLOSE:'); closeLog.forEach(x => console.log('  ' + x));
console.log('STADIUM:'); stadLog.forEach(x => console.log('  ' + x));
console.log('COUNTY:'); countyLog.forEach(x => console.log('  ' + x));
console.log('GARY:'); garyLog.filter(x => /^v[345]/.test(x)).forEach(x => console.log('  ' + x));
console.log('SKY:'); skyLog.forEach(x => console.log(x));
console.log('LB:'); lbLog.forEach(x => console.log(x));
console.log('ENDLESS:'); endLog.forEach(x => console.log(x));
console.log('upgrades:', JSON.stringify(crew.up));
