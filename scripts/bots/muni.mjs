// Copied from the expert review's ladder scripts (round 11) for scripts/make-presets.mjs; see snap.mjs.
// Playtester A, playthrough 5: a bot crew from Muni day 1 to the Range Club promotion.
// usage: node bot5.mjs <players> <seed> [flags]   flags: greens chat nobasket nohose v
import { Crew } from '../../server/crew.mjs';
import { swingLaunch, advanceBall, SIM, WASH, WASHER_HANDLES, FIXTURE_BY_ID, gearPerks, nextPrice, shopDay, CART, BAYS, GARY, atStand, BUCKETS } from '../../web/js/sim.js';
import { cartBlocked, MAP } from '../../web/js/map.js';
import { FILL_POINT, nearestReturn, atFieldReturn } from '../../web/js/layout.js';
import { inBowl } from '../../web/js/tiered.js';

const { makeClassifier } = await import('./classify.mjs');
import { snap } from './snap.mjs';
const N = +(process.argv[2] ?? 4), SEED = +(process.argv[3] ?? 7);
const F = new Set(process.argv.slice(4));
const GREENS = F.has('greens'), CHAT = F.has('chat'), NOBASKET = F.has('nobasket'), NOHOSE = F.has('nohose'), VERBOSE = F.has('v');
const MAXDAYS = 14, DT = 0.05;
const clock = { t: 1_000_000 };
const crew = new Crew('BOTA', null, { seed: SEED, now: () => clock.t });
const rats = []; let CL; const NOV = [];
for (let i = 0; i < N; i++) { const p = crew.join('Rat' + i); crew.connect(p); rats.push(p); }
CL = makeClassifier(crew);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const log = [], goalLog = [], garyLog = [], dealLog = [], tomorrow = [];
let promotedDay = null;

function walk(p, tgt) {
  const sp = crew.perks.walk * DT, dx = tgt.x - p.x, dz = tgt.z - p.z, d = Math.hypot(dx, dz);
  if (d < 0.05) return { x: p.x, z: p.z };
  const k = Math.min(1, sp / d);
  return { x: p.x + dx * k, z: p.z + dz * k, yaw: Math.atan2(-dx, -dz) };
}

// ---- a green shot from bay 0 (found once by search) ----
let greenShot = null;
function findGreenShot() {
  const bay = BAYS[0], world = crew.world();
  for (const bowl of MAP.BOWLS) for (let pw = 0.3; pw <= 1.0; pw += 0.02) for (const pitch of [0.05, 0.15, 0.25, 0.35, 0.45]) {
    const yaw = Math.atan2(-(bowl.x - bay.x), -(bowl.z - (bay.z - 0.4)));
    const b = { ...swingLaunch(bay, yaw, pitch, pw), rest: false, curve: 0 };
    for (let t = 0; t < 12 && !b.rest; t += 0.05) { const r = advanceBall(b, 0.05, world); if (r === 'drift') break; }
    if (b.rest && inBowl(b.x, b.z, MAP.BOWLS, 0)) return { yaw, pitch, power: pw, bowl: bowl.id };
  }
  return null;
}

// ---- shop ----
function wishlist() {
  const L = [['gear',1], ['washer',1], ['shoes',1], ['wand',1], ['ads',1], ['helpers',1], ['gear',2], ['washer',2], ['returns',1], ['helpers',2], ['cart',1], ['hardhat',1], ['ads',2], ['wand',2], ['shoes',2], ['gear',3], ['helpers',3], ['cart',2], ['ads',3], ['shoes',3], ['helpers',4]];
  if (N <= 3 && !F.has('nobays')) L.splice(2, 0, ['bays',1]);
  return L;
}
const firstAfford = {};
function shop() {
  const promo = crew.promoInfo(), rows = crew.goalRows();
  const open = rows.filter(r => !r.done && r.kind !== 'fee').length;
  const reserve = promo && (open <= 1 || crew.day >= 4) ? promo.fee : 0;
  for (const [id, tier] of wishlist()) {
    if ((crew.up[id] ?? 0) >= tier) continue;
    const price = nextPrice(id, crew.up, crew.onlineCount(), 0, crew.venue, shopDay(crew.phase, crew.day));
    if (price == null) continue;
    const key = id + ((crew.up[id] ?? 0) + 1);
    if (crew.cash >= price && !firstAfford[key]) firstAfford[key] = `d${crew.day}${crew.phase === 'report' ? 'n' : '@' + Math.round(crew.shiftT)}`;
    if (crew.cash - reserve < price) return;
    const before = crew.cash;
    crew.input(rats[0], { a: [{ t: 'buy', id }] });
    if (crew.cash < before) log.push(`d${crew.day} ${crew.phase === 'report' ? 'night' : Math.round(crew.shiftT) + 's'} bought ${id} ${crew.up[id]} $${price}`);
  }
}

// ---- behaviours ----
const claimed = new Map();
function nearestBall(p, cap = Infinity) {
  let best = null, bd = cap;
  const taken = new Set([...claimed.entries()].filter(([k]) => k !== p.id).map(([, v]) => v));
  for (const b of crew.balls.values()) {
    if (!b.rest || b.sunk || b.drifting || b.y > 0.4 || taken.has(b.id) || b.kind === 'one') continue;
    const d = dist(b, p); if (d < bd) { bd = d; best = b; }
  }
  return best;
}
const S = {};   // per-shift stats
function bankAt(p) {   // walk to the nearest return; feed a field return
  const r = nearestReturn(p.x, p.z, crew.perks.returns ?? 0);
  if (r.id !== 'main') {
    if (atFieldReturn(p, crew.perks.returns ?? 0)) { crew.input(p, { a: [{ t: 'feed' }] }); S.feeds++; return; }
    crew.input(p, walk(p, r)); return;
  }
  if (atStand(p)) { crew.input(p, { a: [{ t: 'deposit' }] }); return; }
  crew.input(p, walk(p, SIM.STAND));
}
function picker(p) {
  const g = gearPerks(crew.up.gear ?? 0);
  if (p.wand) crew.input(p, { a: [{ t: 'wand' }] });
  const late = crew.shiftT > crew.shiftSecs - 12;
  if (p.pocket >= g.pocket || (late && p.pocket > 0)) { claimed.delete(p.id); return bankAt(p); }
  let b = crew.balls.get(claimed.get(p.id));
  if (!b || !b.rest) { b = nearestBall(p); if (b) claimed.set(p.id, b.id); else claimed.delete(p.id); }
  if (!b) { if (p.pocket > 0) return bankAt(p); crew.input(p, walk(p, { x: 0, z: -15 })); return; }
  if (dist(p, b) <= g.reach) {
    const a = [];
    for (const o of crew.balls.values()) if (o.rest && !o.sunk && dist(o, p) <= g.reach && a.length < 8 && p.pocket + a.length < g.pocket) a.push({ t: 'pickup', ball: o.id });
    crew.input(p, { a }); claimed.delete(p.id); return;
  }
  crew.input(p, walk(p, b));
}
function filler(p, upTo) {   // hold Use at the dispenser until the basket has upTo
  if (crew.basket.n >= upTo) { if (p._fill) { crew.input(p, { a: [{ t: 'fill', on: false }] }); p._fill = false; } return false; }
  if (p.wand) crew.input(p, { a: [{ t: 'wand' }] });
  if (dist(p, FILL_POINT) > 0.8) { if (p._fill) { crew.input(p, { a: [{ t: 'fill', on: false }] }); p._fill = false; } crew.input(p, walk(p, FILL_POINT)); return true; }
  if (!p._fill || !(p.id in crew.basket.fill)) { crew.input(p, { a: [{ t: 'fill', on: true }] }); p._fill = true; }
  S.fillSecs += DT;
  return true;
}
let hoseT = null;
function dirtiest(p, only) {
  if (only) { if (only === 'mats') { let b = null, bv = 0.05; for (const [id, v] of Object.entries(crew.fixtures)) if (id.startsWith('mat') && v > bv) { bv = v; b = id; } return b; } return (crew.fixtures[only] ?? 0) > 0.05 ? only : null; }
  if (hoseT && (hoseT === 'cart' ? (crew.carts[0]?.mud ?? 0) > 0.05 && !crew.carts[0].driver : crew.fixtures[hoseT] > 0.05)) return hoseT;
  let best = null, bs = -1e9;
  for (const [id, v] of Object.entries(crew.fixtures)) { if (v <= 0.15) continue; const f = FIXTURE_BY_ID[id]; const s = v - Math.hypot(f.x - p.x, f.z - p.z) / 200; if (s > bs) { bs = s; best = id; } }
  const c = crew.carts[0]; if (c && c.mud > 0.4 && !c.driver && dist(c, WASH.STATION) < 45) best = 'cart';
  return hoseT = best;
}
function hoser(p, only) {
  const target = dirtiest(p, only);
  if (!target) { if (p.wand) crew.input(p, { a: [{ t: 'wand' }] }); return false; }
  if (!p.wand) {
    if (p.pocket > 0 && dist(p, SIM.STAND) < 12) { if (atStand(p)) crew.input(p, { a: [{ t: 'deposit' }] }); else crew.input(p, walk(p, SIM.STAND)); return true; }
    if (dist(p, WASH.STATION) > 2) { crew.input(p, walk(p, WASH.STATION)); return true; }
    crew.input(p, { a: [{ t: 'wand' }] }); return true;
  }
  const where = target === 'cart' ? crew.carts[0] : FIXTURE_BY_ID[target];
  if (dist(p, where) > Math.min(6, crew.perks.washReach - 1)) { crew.input(p, walk(p, where)); return true; }
  crew.input(p, { x: p.x, z: p.z, a: [{ t: 'wash', secs: DT, target }] });
  S.hoseSecs += DT;
  return true;
}
function cranker(p) {
  const w = crew.hopper;
  if (!crew.perks.washer || w.n < 1) return false;
  if (crew.perks.washAuto >= 1 && w.n < 30) return false;
  const h = WASHER_HANDLES.L;
  if (p.wand) crew.input(p, { a: [{ t: 'wand' }] });
  if (dist(p, h) > 1.2) { crew.input(p, walk(p, h)); return true; }
  crew.input(p, { a: [{ t: 'crank', side: 'L', turns: 2.5 * DT }] });
  return true;
}
let cartTarget = null, stuck = 0, lastCartPos = null; const cartBan = new Set();
function driver(p) {
  const c = crew.cartOf(p) ?? null;
  if (!c) {
    if (!crew.carts[0] || crew.carts[0].driver) return false;
    if (dist(p, crew.carts[0]) > 2.5) { crew.input(p, walk(p, crew.carts[0])); return true; }
    if (p.pocket > 0 && atStand(p)) crew.input(p, { a: [{ t: 'deposit' }] });
    crew.input(p, { a: [{ t: 'board' }] }); return true;
  }
  const late = crew.shiftT > crew.shiftSecs - (N === 1 ? 160 : 20);
  let goal;
  if (late && N === 1 && dist(c, SIM.STAND) < 6) { crew.input(p, { a: [{ t: 'leave' }] }); return false; }
  if (c.load >= crew.perks.cartCap * 0.9 || late) { goal = { x: SIM.STAND.x + 2, z: SIM.STAND.z + 2 }; if (!c._going) { c._going = true; S.cartTrips++; } }
  else {
    c._going = false;
    let b = cartTarget && crew.balls.get(cartTarget);
    if (!b || !b.rest || cartBan.has(b.id)) { let best = null, bs = -Infinity; for (const o of crew.balls.values()) { if (!o.rest || o.sunk || cartBan.has(o.id)) continue; const s = -dist(o, c); if (s > bs) { bs = s; best = o; } } b = best; cartTarget = b?.id ?? null; stuck = 0; }
    goal = b ?? { x: 0, z: -20 };
  }
  const sp = crew.perks.cartSpeed * (c.boostT > 0 ? CART.BOOST : 1) * 0.8 * DT;
  const dx = goal.x - c.x, dz = goal.z - c.z, d = Math.hypot(dx, dz);
  let ang = Math.atan2(dx, dz), moved = false, nx = c.x, nz = c.z;
  for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) { const a = ang + off, tx = c.x + Math.sin(a) * Math.min(sp, d + 0.01), tz = c.z + Math.cos(a) * Math.min(sp, d + 0.01); if (!cartBlocked(tx, tz, crew.world())) { nx = tx; nz = tz; moved = true; break; } }
  const yaw = Math.atan2(-(nx - c.x), -(nz - c.z)), acts = [];
  const rx = c.x - Math.sin(c.yaw) * CART.REEL_AHEAD, rz = c.z - Math.cos(c.yaw) * CART.REEL_AHEAD;
  for (const o of crew.balls.values()) if (o.rest && !o.sunk && Math.hypot(o.x - rx, o.z - rz) < crew.perks.cartReel / 2 + 0.6 && acts.length < 8) acts.push({ t: 'pickup', ball: o.id, cart: true });
  crew.input(p, { cart: { x: nx, z: nz, yaw: Number.isFinite(yaw) && moved ? yaw : c.yaw }, a: acts });
  if (lastCartPos && Math.hypot(c.x - lastCartPos.x, c.z - lastCartPos.z) < 0.02) { if (++stuck > 40 && cartTarget) { cartBan.add(cartTarget); cartTarget = null; stuck = 0; } }
  lastCartPos = { x: c.x, z: c.z };
  return true;
}
function golfer(p) {   // up to 5 green shots a shift from bay 0
  if (!greenShot || S.greenShots >= 6 || crew.shiftT < 20 || crew.shiftT > crew.shiftSecs - 70) return false;
  if (p.pocket < 1) return false;
  const bay = BAYS[0];
  if (p.wand) crew.input(p, { a: [{ t: 'wand' }] });
  if (dist(p, bay) > 0.8) { crew.input(p, walk(p, bay)); return true; }
  if (crew.input(p, { a: [{ t: 'swing', yaw: greenShot.yaw, pitch: greenShot.pitch, power: greenShot.power }] }) !== false) S.greenShots++;
  return true;
}
function chatter(p) {   // hold chat at a parked Gary
  const g = crew.gary;
  if (!g || g.phase !== 'drive') { if (p._chat) { crew.input(p, { a: [{ t: 'chat', on: false }] }); p._chat = false; } return false; }
  if (g.stop >= 3) { if (p._chat) { crew.input(p, { a: [{ t: 'chat', on: false }] }); p._chat = false; } return false; }
  if (dist(p, g) > 2) { crew.input(p, walk(p, g)); return true; }
  if (!p._chat) { crew.input(p, { a: [{ t: 'chat', on: true }] }); p._chat = true; }
  crew.input(p, {}); return true;
}

function ratStep(p, i) {
  if (p.down > 0) return;
  const g = crew.gary, solo = N === 1;
  const nd = S.nudge?.[p.id] ?? null;
  // Gary: chatter keeps him at the sign/mats; everyone else huddles at the return before he gets there.
  if (CHAT && i === N - 1 && N > 1 && chatter(p)) return;
  if (g && (g.phase === 'drive' && g.stop >= 1 || g.phase === 'drive' && dist(p, SIM.STAND) > 40 || g.phase === 'warn' && g.t < 20 && dist(p, SIM.STAND) > 60)) {
    if (crew.cartOf(p)) { crew.input(p, { a: [{ t: 'leave' }] }); return; }
    if (g.phase === 'warn' || g.stop < 3) { if (!NOHOSE && hoser(p, ['sign', 'mats', 'cart', 'stand'][Math.min(i, 3)] === 'cart' ? 'stand' : ['sign', 'mats', 'stand', 'stand'][i % 4])) return; }
    if (p.wand) crew.input(p, { a: [{ t: 'wand' }] });
    if (atStand(p) && p.pocket) crew.input(p, { a: [{ t: 'deposit' }] });
    crew.input(p, walk(p, { x: 26 + (i % 3) - 1, z: 6 + Math.floor(i / 3) })); return;
  }
  if (g && g.phase === 'warn' && !NOHOSE) {   // Gary warned: hose his stops (or the dealt line)
    if (crew.cartOf(p) && (solo || F.has('leavecart'))) { crew.input(p, { a: [{ t: 'leave' }] }); return; }
    const only = typeof nd === 'string' && nd.startsWith('gary:') ? nd.slice(5) : null;
    if (only && only !== 'stall' && only !== 'meet' && hoser(p, only === 'cart' ? 'cart' : only)) return;
    if ((i === 0 || solo) && hoser(p)) return;
  }
  if (F.has('prep') && solo && crew.garyToday?.() && !g && crew.shiftT > 60 && !NOHOSE) { if (crew.cartOf(p)) { crew.input(p, { a: [{ t: 'leave' }] }); return; } if (hoser(p)) return; }
  // The basket: rat 1 (or the solo Rat) fills the morning basket to 12, and tops it up under 4.
  if (!NOBASKET && (i === Math.min(1, N - 1))) {
    const tgt = crew.shiftT < 60 ? BUCKETS.BASKET : (!F.has('amonly') && crew.basket.n < 4 && crew.shiftT < crew.shiftSecs - 70 ? 10 : 0);
    if (tgt && filler(p, tgt)) return;
  }
  if (!NOBASKET && !F.has('amonly') && nd === 'am:basket' && filler(p, 8)) return;
  // Morning deal: a hose line
  if (!NOHOSE && typeof nd === 'string' && nd.startsWith('am:') && ['sign', 'stand', 'mats'].includes(nd.slice(3)) && hoser(p, nd.slice(3))) return;
  if (GREENS && i === N - 1 && golfer(p)) return;
  const hoseRole = !NOHOSE && (i === 0 && !solo || solo && (crew.shiftT > crew.shiftSecs - (F.has('hose150') ? 150 : 110) || crew.lastCall?.()));
  if (hoseRole && dirtiest(p)) { if (crew.cartOf(p)) { crew.input(p, { a: [{ t: 'leave' }] }); return; } if (hoser(p)) return; }
  if ((i === 1 || solo || (N === 2 && i === 0)) && cranker(p)) return;
  if ((i === 2 || (N <= 2 && i === N - 1 && crew.up.cart)) && driver(p)) return;
  picker(p);
}

function runShift() {
  snap(crew, 'morning'); crew.startShift();
  Object.assign(S, { feeds: 0, fillSecs: 0, hoseSecs: 0, cartTrips: 0, greenShots: 0, onGreen: 0, nobucket: 0, refuse: {}, firstBucket: null, buckets: 0, custwait: 0, nudge: null, seenDeal: {}, gary: null, chat: 0, intro: null, goals: [] });
  for (const p of rats) p._fill = p._chat = false;
  crew.flush();
  let tSec = 0, at100 = null, at60 = null;
  while (crew.phase === 'shift') {
    clock.t += 50; crew.tick(DT);
    rats.forEach(ratStep); CL.step(rats, DT);
    if ((tSec += DT) >= 1) { tSec = 0; shop(); }
    const left = crew.shiftSecs - crew.shiftT;
    if (at100 == null && left <= 60) at60 = at100 = crew.balls.size;
    const fl = crew.flush();
    S.nudge = fl.s?.mods?.nudge ?? null;
    if (S.nudge) for (const [id, v] of Object.entries(S.nudge)) { const k = id + v; if (!S.seenDeal[k]) { S.seenDeal[k] = 1; if (String(v).startsWith('am:') || String(v).startsWith('gary:')) dealLog.push(`d${crew.day} t${Math.round(crew.shiftT)} ${crew.players.get(+id)?.name ?? id}: ${v}`); } }
    for (const e of fl.ev) {
      if (['debut','buy','pa','reveal','garyIntro','treasure','promoted'].includes(e.t)) NOV.push(`d${crew.day} v${crew.venue} t${Math.round(crew.shiftT)} ${e.t} ${e.kind ?? e.id ?? e.line ?? e.key ?? ''}${e.tier ?? ''}`);
      if (e.t === 'bucket') { S.buckets++; if (S.firstBucket == null) S.firstBucket = Math.round(crew.shiftT); }
      if (e.t === 'refuse') S.refuse[e.why ?? '?'] = (S.refuse[e.why ?? '?'] ?? 0) + 1;
      if (e.t === 'leave' && e.why === 'nobucket') S.nobucket++;
      if (e.t === 'custwait') S.custwait++;
      if (e.t === 'onGreen') S.onGreen++;
      if (e.t === 'garyIntro') S.intro = Math.round(crew.shiftT);
      if (e.t === 'garyChat' && e.on) S.chat++;
      if (e.t === 'goal') { goalLog.push(`d${crew.day} t${Math.round(crew.shiftT)} ${e.id} +$${e.reward}`); S.goals.push(e.id); }
      if (e.t === 'verdict') { S.gary = `fails${e.fails} huddle${e.huddle ? 'Y' : 'N'}${e.seal ? ' SEAL' : ''} stalled${(crew.gary?.stalled ?? 0).toFixed(1)}s`; garyLog.push(`d${crew.day} ${S.gary}`); }
      if (e.t === 'check') garyLog.push(`d${crew.day} chk ${e.stop} ${e.ok} mud=${JSON.stringify(Object.fromEntries(Object.entries(crew.fixtures).map(([k,v])=>[k,+v.toFixed(2)])))} cart=${crew.carts[0]?.mud?.toFixed(2)} gm=${JSON.stringify(crew.gary?.mats)}`);
      if (e.t === 'gary' && e.phase === 'warn') garyLog.push(`d${crew.day} warn @${Math.round(crew.shiftT)}`);
    }
  }
  const leftAtBell = crew.report?.left;
  const r = crew.report;
  shop();
  const promo = crew.promoInfo();
  const rows = crew.goalRows();
  tomorrow.push(`d${r.day}: ${r.tomorrow}`);
  if (promo?.ready) { for (const p of rats) crew.input(p, { a: [{ t: 'sign', on: true }] }); promotedDay = crew.day; }
  crew.flush();
  return { day: r.day, secs: crew.shiftSecs, banked: r.deposited, earned: Math.round(r.cash), bank: Math.round(r.bank), fee: promo?.fee ?? '-',
    quota: r.quota ? (r.quota.hit ? `HIT(${r.quota.clean}/${r.quota.need})` : `miss(${r.quota.clean}/${r.quota.need})`) : '-',
    card: rows.map(x => x.id + (x.done ? '+' : `${x.kind === 'fee' ? '' : ':' + x.have + '/' + x.need}`)).join(' '),
    basket1: S.firstBucket, buckets: S.buckets, nobucket: S.nobucket, wait: S.custwait, refuse: JSON.stringify(S.refuse), fillS: Math.round(S.fillSecs), hoseS: Math.round(S.hoseSecs),
    feeds: S.feeds, cartTrips: S.cartTrips, green: `${S.onGreen}/${S.greenShots}`, intro: S.intro, gary: S.gary, chats: S.chat, out60: at60, outBell: leftAtBell, goals: S.goals.join(',') };
}

if (GREENS) { greenShot = findGreenShot(); console.log('greenShot', JSON.stringify(greenShot)); }
const rows = [];
for (let d = 0; d < MAXDAYS; d++) { const row = runShift(); rows.push(row); if (crew.venue > 0) break; }
snap(crew, 'end');
console.log(`== ${N}P seed ${SEED} ${[...F].join(' ')}`);
let cum = 0;
for (const r of rows) { cum += r.secs; console.log(Object.entries(r).map(([k, v]) => k + '=' + v).join(' '), `min=${(cum / 60).toFixed(1)}`); }
console.log('GOALS', goalLog.join(' | '));
console.log('GARY', garyLog.join(' | '));
console.log('TOMORROW', tomorrow.join(' | '));
if (VERBOSE) { console.log(log.join('\n')); console.log(dealLog.join('\n')); }
console.log('first affordable', JSON.stringify(firstAfford));
console.log(CL.report()); console.log('NOV ' + NOV.join(' | '));
console.log('SUMMARY', N + 'P', SEED, [...F].join(' '), 'promoDay', promotedDay, 'venue', crew.venue, 'cashAfter', crew.cash, 'up', JSON.stringify(crew.up));
