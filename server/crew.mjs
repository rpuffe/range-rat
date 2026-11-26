// A crew: up to 6 players sharing one range. The server owns everything that
// players could fight over (balls, pockets, the cart, cash, the shift clock);
// a player's own position (and the cart's, while they drive it) is theirs to
// report, clamped to a plausible speed.
//
// Design records: design/council-round1.md (story, Ball Value, the first five
// features) and design/council-round2.md (promotion, the PA, the ball washer,
// grime, Ready Up, the ledger, records, the venues, the Last Bucket).

import { atFieldReturn } from '../web/js/layout.js';   // council round 10 §C: the field ball returns
import crypto from 'node:crypto';
import { migrateBays, syncBayFixtures, fixtureBuilt, matIndex, BASE_LINE } from '../web/js/bays.js';   // round 11 (owner): Build more bays
import { SIM, LINE, activeMats, activeUpper, mulberry32, swingGap, launch, spill, advanceBall, ballHitsPlayer, atStand, clampToField,
  SHOP_BY_ID, nextPrice, shopDay, perks, HELPER_NAMES, CART, BAYS, BAY_REACH, swingLaunch, ballHitsCart,
  gearPerks, HELPER_POCKET, WASH, ballValue, SPRINT, FIXTURES, FIXTURE_BY_ID, KIND_W, BALLS_OUTSTANDING, payFor,
  upkeepCeiling, quotaQ, LAST_CALL, CLEANUP, MAT_NIGHT_CAP, BUCKETS, GARY, POND, inPond, onDock, pondClarity, leadLaunch, FRIES, atShed, pickKind,
  VENUE_RULES, ONE_YEAR, venueQuotaF, shiftSecsFor, WASHER, WASHER_HANDLES, atHandle, gearGrimeFactor, cartGearOf, BANK } from '../web/js/sim.js';
import { keepInField, cartBlocked, driftEvent, stepDrift, wadeFactor, cartSpeedAt, MAP, creekProject, creekPoint } from '../web/js/map.js';
import { VenueHooks, MODULES } from './venues/index.mjs';
import { halfLapPose } from '../web/js/autopilot.js';   // playthrough 5 C6
import { debrisLeft } from './venues/orbit.mjs';
import { ORBIT, debrisBalls, skyToClear } from '../web/js/orbit.js';
import { isStray } from '../web/js/county.js';
import { shortfall, shortfalls, clubDuskJobs, dealJobs, gaugeOk as gaugeHolds, gaugeMiss, RALLY_LINES, RALLY_MARGIN, RALLY_RECHECK, RALLY_PICK, rallyAt, RALLY_AT, UPKEEP_MARGIN } from '../web/js/rally.js';
import { GARY_INTRO, introDue, newIntro, stepIntro, garyNext, garyMorning, stepChat, pingStall, commendFor, bossSlip } from '../web/js/garyvisit.js';   // owner playtest 3 §6
import { GARY_COUNT } from '../web/js/huddlerules.js';   // playthrough 3 #2: the Board's count is the last 5 s
import { maxMult, curveStep, finishCurve, cleanCurve, paceAt, OWNER, yesterdayPace, cleanYesterday, raceYesterday, ownerRecord, cleanOwner,
  rivalTarget, rivalPace, rivalBell, cleanRival, RIVAL } from '../web/js/owner.js';   // round 7 #9: endless; round 8 #3: yesterday
import { QUOTA_KPI } from '../web/js/sim.js';
import { endWindows, endScale, taperK, taperBays, swingRate, spotlessBonus } from '../web/js/dayend.js';   // round 11: the taper and the two-minute cleanup
import { newMat, openShift as openMats, stepMat, matReady, shoot, matWire, UPPER, UPPER_MATS, upperOpen, upperLaunch } from '../web/js/customers.js';
const UPPER_VENUE = 2;   // council round 10 #3: the Upper Deck's bays seat customers from Tiered on
import { targetPct, memoLine, spotlessGain, reviewPcts, upkeepMet, bootsMud } from '../web/js/bvtext.js';   // owner playtest 3 §1: Ball Value in one look
import { basketMax } from '../web/js/basket.js';   // round 11 (builder "today"): Ball Shortage
import { newBasket, takeBucket, holdFill, stepBasket, machineProgress } from '../web/js/basket.js';   // owner playtest 3 §3.3
import { machineSecs } from '../web/js/sim.js';   // round 11: the filler row's seconds a bucket
import { mowerDue, newMower, stepMower, BOSS, bossDay, bossDue, newBoss, stepBoss, hoseBoss, bossPayout, bossLive, BOSS_LINES, tameDue, newTame, stepTame, moweSnap, cleanMowe, updateSnap, atPost, whistleOpen } from '../web/js/mowe.js';   // council round 11 #1: the boss, the tame pet; round 12: the update bar, the whistle
import { nearestReturn } from '../web/js/layout.js';
import { menuFor, yieldFor, garyEats, serveFloat } from '../web/js/menu.js';
import { newFed, fedServe, fedTick, fedShare, fedRing } from '../web/js/food.js';   // council round 10 #2: hot dogs FED the crew
import { newTray, trayServe, trayTick, trayWanted, trayTake } from '../web/js/tray.js';   // round 11: the shed's warm tray
import { SWEEP, stepSweep, sweepLive, crossedClean } from '../web/js/sweep.js';
import { clubOpen, worldVday } from '../web/js/clubdays.js';
import { kindsOpening, kindNewLine, memoSecond, MEMO_LINES, contractMemo, clockInSpot, MEMO_FLAVORS, RAT_MEMOS, MEMO_DAY_FLAVOR } from '../web/js/sim.js';   // council round 12 (builder 4): the memo hooks
import { goalText } from '../web/js/today.js';   // council round 12 (builder 4): the endless memo names the contract
//     council round 11 #3 (builder 4): one morning, one memo   // round 11: stagger the Club, one idea a day            // round 11: the sweep's bonus
import { creekStep, bankSpot, creekAir, breathMul } from '../web/js/creekdive.js';   // council round 10 #5: the creek dive
import { diveTiers, MAX_DIVE_LEVEL, PUMP, pumpGain, airStep, newLine, canSend, sendBag, haulReady, takeLine, nightCrew,
  newTube, tubeFeed, tubeArrivals, hasTube, hasPondPump, atTube, pondPumpStep, sinksDeep, deepEndSpot, bedAt,
  cleanLostFound, rollTreasure, treasureSpot, treasureSpotFor, CREEK_DIVE, finderFee, TREASURE_BY_ID, TREASURE } from '../web/js/dive.js';
// Council round 10 #1: the venue goal card replaces the review stamps (web/js/goals.js, pure).
import { printCard, printOver, cleanCard, migrateV4, rowsOf, cardDone, doneCount, strip, headline, rewardFor, tomorrowLine,
  onCard, RISE_REVIEWS, hasCard, LAST_CARD, moreText } from '../web/js/goals.js';
// Round 11 (builder "today"): Corporate's Today, the endless contracts and cosmetics, the night recap and awards.
import { todayFor, todayMemo, todayChip, todayName, todayReport, todayKind, todayShot, ballMul, mudMul, basketCap, orderBoost,
  juniorDay, hash32, contractsFor, contractMet, contractLive, newlyUnlocked, canWear, cleanLooks, swingMul } from '../web/js/today.js';
import { addNight, nightCard, cleanCard as cleanNightCard } from '../web/js/awards.js';
import { cleanStory, coldDue, midDue, beatFor, EPILOGUE_HOLD } from '../web/js/story.js';
import { newCase, addRecordLine, cleanCase } from '../web/js/caserules.js';   // council round 12 #3d (builder 3): the glass case   // round 12: the story beats (council round 11: the epilogue's hold)
import { isPromotionDay, PROMO_DAY, promoDue, promoQ, promoStrip, newRide, stepRide } from '../web/js/promoday.js';   // round 11 (builder "pacing")

export const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O: codes get read aloud
export const CODE_LEN = 4;
const COLORS = ['#e8604c', '#4c9be8', '#f2c94c', '#6fcf7c', '#b07ce8', '#3fc1c9'];
const GRACE_MS = 60_000;          // an offline player keeps their spot this long (page reloads)
const DRIVER_GRACE_MS = 5_000;    // an offline driver gives up the cart this fast
const NAME_MAX = 16;
const READY_SECS = 20;            // Ready Up: the next shift starts this long after the first Rat is ready
const READY_HOLD_SECS = 120;      // ...held (for signatures) at most this long when a promotion is ready
const REVEAL_SECS = 6;            // a venue reveal holds the clock this long
const PA_CAP = 3, PA_GAP_MS = 20_000;
// Round 7 #10.2: an idle Rat counts as present (and holding) in the huddle and Gary's ring after 20 s, not GRACE_MS.
export const SKY_HOLD_SECS = 90;   // playthrough 3: the longest the bell waits on the sky gate
const GARY_CART_LEG = 30;   // playthrough 5 C1: s, the longest Gary chases a cart a Rat is driving about
const HUDDLE_R = 8, HUDDLE_IDLE_MS = 20_000, HUDDLE_HOLD = 3.0;   // the huddle beat: everyone holds Use this long (round 6 #5)

// What a ping on the cage pays out, and how often.
export const PING_PRIZES = [['jackpot', 0.4], ['boost', 0.3], ['mult', 0.3]];
// PA lines that ignore the per-shift cap and the gap (venue reveals and the ending).
const PA_BIG = new Set(['club', 'tiered', 'stadium', 'county', 'orbital', 'one', 'last', 'endless']);
const DEBUT_PA = { glow: 'glow', square: 'square', gold: 'gold', lead: 'lead', splitter: 'splitter', bouncy: 'bouncy' };

export const newCode = () => Array.from(crypto.randomBytes(CODE_LEN), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
export const validCode = c => typeof c === 'string' && c.length === CODE_LEN && [...c].every(ch => CODE_CHARS.includes(ch));

export function cleanName(s) {
  s = String(s ?? '').replace(/[\p{C}]/gu, '').trim();
  return [...s].slice(0, NAME_MAX).join('').trim();
}

const cartWire = c => ({ i: c.i, x: +c.x.toFixed(2), z: +c.z.toFixed(2), yaw: +c.yaw.toFixed(3), driver: c.driver, load: c.load, boost: +c.boostT.toFixed(1), mud: +c.mud.toFixed(3), ...(c.tipT > 0 ? { tip: +c.tipT.toFixed(2) } : {}) });
const freshStats = () => ({ picked: 0, deposited: 0, cash: 0, knockdowns: 0, helped: 0, carted: 0, swings: 0, pings: 0, runOver: 0, washed: 0,
  scrubbed: 0, unwashed: 0, lostPremium: 0 });
const freshShift = () => ({ banked: 0, cash: 0, knockdowns: 0, dived: 0, cooked: 0, scrubbed: 0, hosed: 0, pings: 0, mowed: 0 });
const cents = v => Math.round(v * 100) / 100;
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.floor(Number(v) || 0)));

// Only known items, only whole tiers inside the catalog.
function cleanUpgrades(up) {
  const out = {};
  up = migrateBays(up);   // round 11: an old "Open every bay" (up.bays 1) is Build more bays tier 2 (bays.js)
  for (const [id, item] of Object.entries(SHOP_BY_ID)) {
    const n = Math.floor(Number(up?.[id]) || 0);
    if (n > 0 && !item.personal) out[id] = Math.min(n, item.tiers.length - 1);
  }
  return out;
}

// Personal gear by Range Rat name, so it follows you back to the crew.
function cleanGear(g) {
  const out = {}, max = SHOP_BY_ID.gear.tiers.length - 1;
  for (const [name, lvl] of Object.entries(g ?? {})) {
    const n = Math.floor(Number(lvl) || 0);
    if (n > 0 && typeof name === 'string' && name.length <= 16) out[name] = Math.min(n, max);
  }
  return out;
}

// Owner playtest 3 §5.2: carrying gear is the crew row up.gear. An old save's personal gear by name (save.gear) is read
// for this one migration and no longer written: the crew gets the best anyone had, so nobody loses gear.
// §5.1 (saves before v4): the Club's turbo nozzle (amen 1) became the wand row's turbo (wand 2); covered bays (amen 2)
// are now amenities' only tier (amen 1).
function migrateShop(up, save) {
  const g = Math.max(up.gear ?? 0, ...Object.values(cleanGear(save?.gear)));
  if (g > 0) up.gear = Math.min(g, SHOP_BY_ID.gear.tiers.length - 1);
  const amen = Math.floor(Number(save?.up?.amen) || 0);
  if (Number.isFinite(save?.v) && save.v < 4 && amen >= 1) {
    up.wand = Math.max(up.wand ?? 0, 2);
    if (amen >= 2) up.amen = 1; else delete up.amen;
  }
  // Round 11: the old `bucket` row (1 = the Club's 10 s machine) is the `filler` row's tier 2 now.
  if (Math.floor(Number(save?.up?.bucket) || 0) >= 1) up.filler = Math.max(up.filler ?? 0, 2);
  return up;
}

// Dive gear by name (Scuba v2): same idea as cleanGear, levels 1..MAX_DIVE_LEVEL.
function cleanDive(g) {
  const out = {};
  for (const [name, lvl] of Object.entries(g && typeof g === 'object' ? g : {})) {
    const n = Math.floor(Number(lvl) || 0);
    if (n > 0 && typeof name === 'string' && name.length <= 16) out[name] = Math.min(n, MAX_DIVE_LEVEL);
  }
  return out;
}

export class Crew {
  constructor(code, save = null, { shiftSecs = null, now = Date.now, seed, modules = MODULES } = {}) {
    this.code = code;
    this.shiftOverride = shiftSecs;      // the env override wins over the day lengths
    this.shiftSecs = shiftSecs ?? SIM.SHIFT_SECS;
    this.now = now;
    this.rng = mulberry32(seed ?? crypto.randomBytes(4).readUInt32LE());
    this.players = new Map();
    this.balls = new Map();
    this.nextBall = 1;
    this.day = save?.day ?? 1;
    this.cash = save?.cash ?? 0;
    this.totals = { ...freshStats(), reviews: 0, ...(save?.totals ?? {}) };
    if (this.totals.stamps != null) { this.totals.reviews = (Number(this.totals.reviews) || 0) + (Number(this.totals.stamps) || 0); delete this.totals.stamps; }   // save v5
    this.up = cleanUpgrades(save?.up);
    migrateShop(this.up, save);      // owner playtest 3 §5.1–5.2: old saves' personal gear and the Club's turbo
    this.diveByName = cleanDive(save?.diveByName);         // save v3
    this.lostFound = cleanLostFound(save?.lostFound);      // save v3: the treasure ids in the glass case
    this.treasure = null;            // the one lying in the Deep End now: { id, x, z }
    this.treasureSeed = (seed ?? 1) | 0;
    this.line = newLine();           // the bag line: sent by divers, hauled up from the dock
    this.tube = newTube(); this.tubeClock = 0;
    this.commendations = int(save?.commendations, 0, 10);
    // Owner playtest 3 §6.2: the global day of Gary's next visit (an old save: null, and the morning makes it today).
    this.garyDay = Number.isFinite(save?.garyDay) ? Math.max(1, Math.floor(save.garyDay)) : null;
    // Round 11: Promotion Day (promoday.js): the day it was dealt for, and the tries at this venue ({ venue, n }).
    this.promoDay = Number.isInteger(save?.promoDay) ? save.promoDay : null;
    this.promoTry = Number.isInteger(save?.promoTry?.venue) && Number.isInteger(save?.promoTry?.n) ? { venue: save.promoTry.venue, n: Math.max(0, Math.min(99, save.promoTry.n)) } : null;
    this.garyRide = null;
    this.seal = 1; this.garyIntro = null;   // §6.4 Gary's Seal (×1.25 till the bell), §6.1 the drive-by
    this.fedSt = newFed();   // council round 10 #2: FED (a hot dog's ×, its own factor like the Seal)
    this.tray = newTray();   // round 11: spare dogs on the shed's warm tray (web/js/tray.js)
    this.venue = int(save?.venue, 0, 5);
    this.venueDay = int(save?.venueDay, 0, 10_000);
    this.endless = !!save?.endless; this.endlessFresh = this.endless && !!save?.endlessFresh; this.endlessArmed = this.endlessFresh;   // council round 12, 9.1 (builder 4): the first endless morning survives a save (and the endless preset)
    this.test = save?.test === true;   // round 11: a skip-ahead test crew (server/skip.mjs)
    this.debuts = new Set(Array.isArray(save?.debuts) ? save.debuts.filter(k => typeof k === 'string').slice(0, 20) : []);
    this.story = new Set(cleanStory(save?.story));   // round 12: the story beats this crew has seen (once each; an old save: none)
    this.voiced = new Set(Array.isArray(save?.voiced) ? save.voiced.filter(k => typeof k === 'string').slice(0, 40) : []);
    // Round 11 (builder "today"): today's modifier ({ id, bay?, wind? } or null) and its counters; the endless
    // contracts (offers for the next morning, the crew's pick, today's), the lifetime stars and the cosmetics (looks by
    // Rat name, the crew's cart paint); this session's night (the recap) and the last session's card ("Previously on").
    this.today = null; this.todayN = {}; this.todayKey = hash32(code, (seed ?? 1) | 0);
    this.offers = null; this.contractPick = null; this.contract = null;
    this.stars = int(save?.stars, 0, 1e6); this.looks = cleanLooks(save?.looks);
    this.cartPaint = canWear(save?.cartPaint, 'cart', this.stars) ? save?.cartPaint ?? null : null;
    this.glassCase = cleanCase(save?.glassCase);   // council round 12 #3d (builder 3): Ball No. 1's glass case and its plaque
    this.previously = cleanNightCard(save?.night);
    this.night = null;
    // Council round 10 #1 (save v5): `reviews` is this venue's APPROVED count (it was `stamps`); the goal card is
    // `goals` ({ venue, scale, crew, need, n, done, who }). A v4 save migrates to its venue's card (goals.js migrateV4:
    // 3 stamps or more is grandfathered, so nobody loses a promotion they'd earned).
    const v5 = (save?.v ?? 0) >= 5;
    this.reviews = int(v5 ? save?.reviews : save?.stamps, 0, 100);
    this.goals = this.endless ? null : v5 ? cleanCard(save?.goals, this.venue) : save ? migrateV4(save) : null;
    this.goalsToday = []; this.goalSeen = new WeakSet(); this.garyBack = false; this.strayIds = null;
    this.moweSt = cleanMowe(save?.mowe); this.moweMemo = this.moweSt.memo ?? null; delete this.moweSt.memo;   // council round 11 #1 (builder 1): { tame, lost, encore }
    this.records = { cash: Number(save?.records?.cash) || 0, banked: int(save?.records?.banked, 0, 1e9), day: int(save?.records?.day, 0, 1e6) };
    { const c = cleanCurve(save?.records?.curve); if (c) this.records.curve = c; }   // round 7 #9: the record's own pace
    { const y = cleanYesterday(save?.records?.yesterday); if (y) this.records.yesterday = y; const st = int(save?.records?.streak, 0, 1e6); if (st) this.records.streak = st; const o = cleanOwner(save?.records?.owner); if (o) this.records.owner = o;
      const rv = cleanRival(save?.records?.rival); if (rv) this.records.rival = rv; }   // council round 12 #8 (builder 3): Site 13   // round 8 #3; council round 11 #6: the Owners' book
    if (this.endless) this.up.owner = Math.max(this.up.owner ?? 0, OWNER.PAINT);   // round 8 #3: an endless save from before the deed
    // Balls Outstanding is a stored count (write-offs live here). Old saves derive it.
    this.outstanding = Number.isFinite(save?.outstanding) ? Math.max(0, Math.floor(save.outstanding)) : BALLS_OUTSTANDING - (this.totals.deposited ?? 0);
    const pr = Math.floor(Number(save?.pendingReveal));
    this.pendingReveal = pr >= 1 && pr <= 5 ? pr : 0;
    this.quota = null;               // { q } once a shift sets it; the target follows the live Rate
    this.fries = Math.max(0, Math.min(FRIES.MAX, Number(save?.fries) || 0));   // baskets in stock
    this.swingsToEat = FRIES.EAT_EVERY; this.autoFryT = 0;
    this.fixtures = {};              // fixture id -> mud 0..1 (Curb Appeal)
    // Owner playtest 3 §3.1: the mats keep their mud overnight (the save's optional `fixtures`; an old save: clean mats).
    for (const fx of FIXTURES) if (Number.isFinite(save?.fixtures?.[fx.id])) this.fixtures[fx.id] = Math.max(0, Math.min(1, save.fixtures[fx.id]));
    this.basket = newBasket();       // §3.3: the bucket basket by the dispenser, empty every morning
    this.hopper = { n: 0, credit: 0, frac: 0 };            // the ball washer: dirty balls and the premium they'll pay
    this.washBatch = new Map();      // who washed how much, flushed as events every 0.5 s
    this.washFlushT = 0;
    this.signed = new Set(); this.ready = new Set(); this.readyAt = 0;
    this.revealT = 0;
    this.lastBucket = null;          // the ending: { phase: 'falling' | 'down' | 'carried', t, id, by }
    this.paShift = 0; this.paAt = 0;
    this.perks = perks(this.up);
    this.helpers = [];
    this.todo = null;
    this.carts = [];                 // the fleet (council round 4): [0] is "the cart", [1] the Stadium's second
    this.mult = 1;                   // Hustle (Hit the Cart), for the rest of the shift
    this.applyUpgrades();
    this.phase = 'lobby';            // lobby -> shift -> report -> shift ...
    this.shiftT = 0;
    this.stats = freshStats();
    this.report = null;
    // Round 11 (bays.js): the whole line; the new wing (10..15) draws no RNG here, so a ten-bay crew is untouched.
    this.mats = LINE.map((m, i) => ({ ...newMat(m.i ?? i), ...m, next: m.i < BASE_LINE ? 1 + this.rng() * 5 : 1 + 0.5 * (m.i - BASE_LINE) }));
    // Council round 10 #3: the Upper Deck's six bays ride at the end (indices 16..21), Tiered on. No RNG draw here, so
    // the Muni and the Club are untouched.
    for (const m of UPPER_MATS) this.mats.push({ ...newMat(m.i), ...m, next: 1 + 0.8 * (m.i - UPPER.FROM) });
    this.custT = 0; this.nextCust = 0;     // customers walk on their own clock: it never pauses
    this.events = [];
    this.dirty = false;
    this.lastActive = now();
    this.morningMud();
    const sunk = this.pondOpen() ? int(save?.pondSunk, 0, POND.MAX_SUNK) : 0;
    for (let i = 0; i < sunk; i++) this.sinkNew('range');
    // The venue seam (council round 4): venue modules (server/venues/), each with its own save key.
    this.mods = new VenueHooks(this, modules, save?.mods);
  }

  // ---- membership ----------------------------------------------------------

  join(name) {
    if (this.players.size >= SIM.MAX_PLAYERS) return null;
    const used = new Set([...this.players.values()].map(p => p.color));
    const p = {
      id: crypto.randomBytes(6).toString('hex'),
      token: crypto.randomBytes(16).toString('hex'),
      name: cleanName(name) || `Rat ${this.players.size + 1}`,
      color: COLORS.find(c => !used.has(c)) ?? COLORS[0],
      x: SIM.SPAWN.x - this.players.size * 1.2, z: SIM.SPAWN.z, yaw: Math.PI / 2,
      pocket: 0, pocketW: 0, down: 0, online: 0, seenAt: this.now(), movedAt: this.now(), swungAt: 0,
      gear: 0, wand: false, washAt: 0, diving: false, air: POND.AIR, bag: 0, bagW: 0, bagKinds: [], pumping: false,
      dive: 0, treasure: null, pumpTurns: 0, pumpHeld: false, pumpAt: 0, haulHeld: 0, haulAt: 0,
      grime: 0, hoseAcc: 0, rinseAcc: 0, crankAt: 0, one: false, shift: freshShift(),
    };
    if (Object.hasOwn(this.diveByName, p.name)) p.dive = this.diveByName[p.name];
    p.air = diveTiers(p.dive).air;
    p.gear = this.up.gear ?? 0;      // owner playtest 3 §5.2: the crew's carrying gear (late joiners too); p.gear is a copy
    this.players.set(p.id, p);
    this.events.push({ t: 'join', id: p.id, name: p.name });
    return p;
  }

  auth(id, token) {
    const p = this.players.get(id);
    if (!p || typeof token !== 'string' || token.length !== p.token.length) return null;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(p.token)) ? p : null;
  }

  // A stream opened or closed for this player (they may have two tabs).
  connect(p) { p.online++; p.seenAt = this.now(); this.lastActive = this.now(); }
  disconnect(p) { p.online = Math.max(0, p.online - 1); p.seenAt = this.now(); }
  onlineCount() { let n = 0; for (const p of this.players.values()) if (p.online > 0) n++; return n; }
  // Council round 10 #3: the Upper Deck's bays. upperSeats(): the seat indices (0..5) in play, [] before Tiered.
  upperMats() { return this.mats.slice(UPPER.FROM); }
  upperSeats() { return this.venue >= UPPER_VENUE ? upperOpen(activeUpper(this.onlineCount(), this.up)) : []; }
  // Round 11 (builder "today"): the Rats out on the field on foot (the celebrity aims at the nearest), and today's counters.
  fieldRats() { return this.online().filter(p => p.down <= 0 && !p.diving && !this.driving(p) && !this.aloft(p)).map(p => ({ x: p.x, z: p.z })); }
  todayCount(b, i, lastCall) {
    const n = this.todayN, t = this.today;
    if (b.curve && t.id === 'windy') n.curved = (n.curved ?? 0) + 1;
    if (b.kind === 'glow' && !lastCall && (t.id === 'rain' || t.id === 'night')) n.glow = (n.glow ?? 0) + 1;
    if (b.celeb) n.celeb = (n.celeb ?? 0) + 1;
    if (t.id === 'junior' && i % 2 === 0) n.short = (n.short ?? 0) + 1;
    if (t.id === 'league') n.extra = (n.extra ?? 0) + 1;
  }
  // The snapshot's mats: the ten lower ones; from Tiered the six upper bays too, each with its seat's mugs (the sway).
  wireMats() {
    if (this.venue < UPPER_VENUE) return this.mats.slice(0, UPPER.FROM).map(matWire);
    const mugs = this.mods.state('deck')?.deck?.mugs;
    return this.mats.map(m => m.upper ? { ...matWire(m), mug: mugs?.[m.i - UPPER.FROM] ?? 0 } : matWire(m));
  }
  online() { return [...this.players.values()].filter(p => p.online > 0); }
  world() { return { venue: this.venue, vday: worldVday(this.venue, this.venueDay, this.endless), ret: this.up.returns ?? 0 }; }   // round 11: ret, the tube's posts (map.js)   // what the map's rules depend on (Dimple Creek: dry or running; round 11: the Club day, clubdays.js)
  driving(p) { return !!this.cartOf(p); }
  aloft(p) { return !!this.mods.state('orbit')?.riders?.has(p.id); }   // on the Lift or floating on the EVA: nothing on the ground reaches you
  cartOf(p) { return this.carts.find(c => c.driver === p.id) ?? null; }   // the cart this Rat drives, if any
  // The legacy alias (one release): "the cart" is the first one. Venue modules and old code read it.
  get cart() { return this.carts[0] ?? null; }
  set cart(c) { if (c) { c.i ??= 0; this.carts[0] = c; } else this.carts = []; }
  // Playthrough 5 C1: Gary is on his cart leg heading for (or parked inspecting) cart c: an autopilot cart waits.
  garyHolds(c) {
    const g = this.gary;
    if (!g || g.phase !== 'drive' || !c) return false;
    const leg = this.garyStops()[g.stop]?.id === 'cart' && g.cart === c, parked = g.pause > 0 && g.checks?.at(-1)?.stop === 'cart' && g.cart === c;
    return leg || parked;
  }
  muddiestCart() { return this.carts.reduce((m, c) => (!m || c.mud > m.mud ? c : m), null); }
  working() { return this.phase === 'shift' && !this.paused(); }   // the shift clock is running
  pondOpen() { return this.venue >= POND.FROM_VENUE && clubOpen('pond', this.venue, worldVday(this.venue, this.venueDay, this.endless)); }   // round 11: the pond fills on Club day 2

  // ---- the Corporate PA (council round 2, §4.3) --------------------------------
  // The server picks the moment; every client speaks the same line. Rare by rule.
  pa(id, { once = false, chance = 1, big: bigOpt = false } = {}) {
    const now = this.now(), big = PA_BIG.has(id) || bigOpt;   // a venue module's once-ever line passes big: true
    if (once && this.voiced.has(id)) return false;
    if (!big && (this.paShift >= PA_CAP || now - this.paAt < PA_GAP_MS)) return false;
    if (chance < 1 && this.voiced.has(id) && this.rng() > chance) return false;
    this.voiced.add(id); this.dirty = true;
    if (!big) { this.paShift++; this.paAt = now; }
    this.events.push({ t: 'pa', id });
    return true;
  }

  // ---- the story beats (round 12, web/js/story.js) --------------------------------
  // Once per crew: the client's story card shows the beat's cards. Draws no RNG and touches no sim state.
  // Council round 11 #3 (builder 4): a kind's first ball. Told in this morning's memo: `told` (the client floats "NEW ×1.5",
  // no memo). Not told (a kind that opened another way): the float names it. Only glow keeps its PA (Last Call's cue).
  debutHit(kind, b = null) {
    const told = !!this.toldKinds?.get(kind); this.toldKinds?.delete(kind);
    this.debuts.add(kind); this.dirty = true; this.events.push({ t: 'debut', kind, told, ...(b ? { id: b.id, x: b.x, z: b.z } : {}) });
    if (kind === 'glow' && DEBUT_PA[kind]) this.pa(DEBUT_PA[kind], { once: true });
  }

  storyBeat(id) {
    if (!id || this.story.has(id)) return false;
    this.story.add(id); this.dirty = true;
    this.events.push({ t: 'story', id });
    return true;
  }

  // ---- money -------------------------------------------------------------------

  curb() {
    const v = Object.values(this.fixtures);
    if (!v.length) return 1;
    // Round 11 (the one price, bvtext.js bootsMud): the crew's muddy boots and the carts' mud count as one more
    // fixture's worth of dirt on the average (never a slot of their own: clean gear changes nothing).
    const grimes = []; for (const p of this.players.values()) if (p.online > 0 && !p.helper) grimes.push(p.grime ?? 0);
    const boots = bootsMud(grimes, this.carts.map(c => c.mud ?? 0));
    return Math.max(0, 1 - (v.reduce((a, b) => a + b, 0) + boots) / v.length);
  }
  // How many fixtures Curb averages over (a Spotless's share): the 12 it always was, plus each built wing bay (bays.js).
  curbSlots() { return Object.keys(this.fixtures).length; }
  // Round 11 (bays.js): unbuilt bays hold no mud and a wing bay is a fixture only while built. In a shift (the crew
  // size is known); `force` at the opening bell.
  syncBays(force = false) {
    const n = this.openBays();
    if (!force && n === this.bayN) return;
    this.bayN = n;
    if (syncBayFixtures(this.fixtures, n)) this.dirty = true;
  }
  valueNow() {
    return { ...(this.seal > 1 ? { seal: this.seal } : {}), ...(this.fedSt?.fed > 1 ? { fed: this.fedSt.fed } : {}), ...ballValue({ perks: this.perks, mult: this.mult, cart: this.cart, curb: this.curb(), commendations: this.commendations,
      venue: this.venue,
      pond: this.pondOpen() ? pondClarity(this.sunkCount()) : null,
      fries: this.perks.shed ? this.fries / FRIES.MAX : null,
      kpi: this.mods.kpi() }) };   // owner playtest 3 §6.4: v.seal while sealed (bank() pays it; Upkeep never sees it)
  }
  ballPrice() { return this.valueNow().value; }
  title() { return this.endless ? 'Owner' : VENUE_RULES[this.venue].title; }
  ceiling() { return upkeepCeiling({ pond: this.pondOpen() ? 1 : null, fries: this.perks.shed ? 1 : null, kpi: this.mods.kpi() == null ? null : 1 }); }

  // n balls (count) worth w (summed weights). The carrier's gear factor: the cart
  // pays for its cleanliness, a Rat for theirs (grime), helpers never.
  // With a ball washer, the muddy price is paid now and the washer's share waits
  // in the hopper as credit, paid out as balls are washed (council round 2, §4.4).
  bank(n, by, kind = null, w = n, gearOv = null, extra = null) {
    if (n <= 0) return;
    this.goalTick('bank', n);   // council round 10 #1: the Muni's "Bank 2,000 balls"
    const v = this.valueNow();
    const who = kind == null ? this.players.get(by) : null;
    const gear = gearOv ?? 1;   // round 11 (the one price): no gear factor; muddy gear counts in the Clean % (curb)
    const full = payFor(w, v, gear * (v.seal ?? 1) * (v.fed ?? 1));   // owner playtest 3 §6.4: the Seal is its own factor, past the Hustle cap; council round 10 #2: so is FED
    if ((v.fed ?? 1) > 1) this.stats.fedCash = cents((this.stats.fedCash ?? 0) + fedShare(full, v.fed));   // the report's "Hot dogs: +$X"
    if ((v.seal ?? 1) > 1) this.stats.sealCash = cents((this.stats.sealCash ?? 0) + full * (1 - 1 / v.seal));   // the report's "Gary's Seal: +$X"
    const muddy = this.perks.washer ? cents(full / this.perks.price) : full;
    const credit = cents(full - muddy);
    if (credit > 0) { this.hopper.n += n; this.hopper.credit = cents(this.hopper.credit + credit); }
    this.cash = cents(this.cash + muddy); this.stats.deposited += n; this.stats.cash = cents(this.stats.cash + muddy); this.dirty = true;
    if (kind === 'helper') this.stats.helped += n;
    if (who) { who.shift.banked += n; who.shift.cash = cents(who.shift.cash + muddy); }
    this.countDown(n);
    this.events.push({ t: 'cash', by, n, cash: muddy, credit, kind, per: cents(muddy / Math.max(1, n)), clean: who ? who.grime === 0 : undefined, ...extra });
  }


  // Cash in (a bar tab) or out (a fine) that isn't banked balls: never takes the crew below $0. Returns the change.
  // The caller emits its own event. `by` is a player id (their ledger gets the income) or null.
  payCash(amount, by = null) {
    if (!Number.isFinite(amount) || amount === 0) return 0;
    const d = cents(Math.max(-this.cash, amount));
    this.cash = cents(this.cash + d); this.stats.cash = cents(this.stats.cash + d); this.dirty = true;
    const who = by != null ? this.players.get(by) : null;
    if (who && d > 0) who.shift.cash = cents(who.shift.cash + d);
    return d;
  }

  // Balls Outstanding: down with every banked ball. At the Orbital Range it
  // stops at 1, and reaching 1 starts the Last Bucket. In endless mode it's live.
  // Round 11 (expert #10a): at the Orbital only debris brought down counts (orbit.mjs calls countDebris); a banked
  // ground ball counts nothing there ("They are all in orbit").
  countDown(n, debris = false) {
    if (this.venue === 5 && !this.endless && !debris) return;
    if (this.venue === 5 && !this.endless) {
      this.outstanding = Math.max(1, this.outstanding - n);
      // Only mid-shift: a bank at the bell (the report) waits for the next morning (startShift), so
      // Ball No. 1 never lands under the report card or into the night crew's sweep.
      if (this.outstanding === 1 && !this.lastBucket && this.phase === 'shift') this.beginLastBucket();
    } else this.outstanding = Math.max(0, this.outstanding - n);
  }

  // Round 11: n pieces of debris came down (the EVA or the winch): DEBRIS_BALLS each (÷ the card's crew scale).
  countDebris(n) { if (n > 0) this.countDown(debrisBalls(n, this.goals?.crew ?? this.onlineCount()), true); }

  // Washing x balls pays the waiting credit for them (cranked, or the electric washer).
  washBalls(x, by) {
    const h = this.hopper;
    x = Math.min(x, h.n);
    if (x <= 0) return 0;
    const pay = cents(h.credit * x / h.n);
    h.n -= x; h.credit = cents(h.credit - pay);
    if (h.n === 0) h.credit = 0;
    this.cash = cents(this.cash + pay); this.stats.cash = cents(this.stats.cash + pay); this.stats.scrubbed += x; this.dirty = true;
    const p = this.players.get(by);
    if (p) { p.shift.scrubbed += x; p.shift.cash = cents(p.shift.cash + pay); }
    const b = this.washBatch.get(by) ?? { n: 0, cash: 0 };
    b.n += x; b.cash = cents(b.cash + pay); this.washBatch.set(by, b);
    return x;
  }

  // Overnight the mud comes back on the sign and the stand. Owner playtest 3 §3.1: the mats keep theirs, capped at
  // MAT_NIGHT_CAP ("the night crew knocks the worst off"): a mat hosed in the cleanup minute opens clean.
  morningMud() {
    for (const fx of FIXTURES) {
      if (matIndex(fx.id) >= BASE_LINE && !(fx.id in this.fixtures)) continue;   // round 11: a wing bay is a fixture once built (bays.js syncBayFixtures)
      this.fixtures[fx.id] = fx.id.startsWith('mat') ? Math.min(MAT_NIGHT_CAP, this.fixtures[fx.id] ?? 0) : 0;
    }
    this.fixtures.sign = 0.9; this.fixtures.stand = 0.5;
  }

  // ---- inputs ----------------------------------------------------------------

  input(p, msg) {
    const now = this.now();
    p.seenAt = now; this.lastActive = now;
    const denied = [];
    if (this.driving(p)) this.driveTo(p, msg.cart, now);
    else if (Number.isFinite(msg.x) && Number.isFinite(msg.z) && p.down <= 0) {
      // Trust the reported position up to a generous walking speed.
      const dt = Math.min(1, Math.max(0.05, (now - p.movedAt) / 1000));
      const max = this.perks.walk * SPRINT.SPEED * 1.3 * dt + 0.5;   // room for a sprint
      let dx = msg.x - p.x, dz = msg.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > max) { dx *= max / d; dz *= max / d; }
      p.x += dx; p.z += dz;
      if (!this.mods.first('clamp', p)) clampToField(p, this.world());
      p.movedAt = now;
    }
    if (Number.isFinite(msg.yaw) && !this.driving(p)) p.yaw = msg.yaw;
    if (p.wand && Math.hypot(p.x - WASH.STATION.x, p.z - WASH.STATION.z) > WASH.HOSE) p.wand = false;   // out of hose
    for (const a of Array.isArray(msg.a) ? msg.a.slice(0, 8) : []) {
      if (a?.t === 'pickup') { if (!(a.cart ? this.cartPickup(p, a.ball) : a.pond ? this.pondPickup(p, a.ball) : this.pickup(p, a.ball))) denied.push(a.ball); }
      else if (a?.t === 'pump') this.pumpInput(p, a);
      else if (a?.t === 'send') this.sendBagUp(p);
      else if (a?.t === 'haul') this.haulInput(p, a);
      else if (a?.t === 'feed') this.feedTube(p);
      else if (a?.t === 'treasure') this.treasurePickup(p);
      else if (a?.t === 'serve') this.serve(p, a);
      else if (a?.t === 'deposit') this.deposit(p);
      else if (a?.t === 'hold') p.holding = !!a.on;    // Use held for the Last Bucket huddle (stepHuddle)
      else if (a?.t === 'whistle') this.moweWhistle(p);   // council round 12 #5d (builder 1): the MOW-E post
      else if (a?.t === 'fill') this.fillInput(p, !!a.on);   // owner playtest 3 §3.3: Use held at the dispenser
      else if (a?.t === 'start') this.readyUp(p);
      else if (a?.t === 'buy') this.buy(p, a.id);
      else if (a?.t === 'board') this.board(p);
      else if (a?.t === 'chat') p.chatHeld = !!a.on;   // owner playtest 3 §6.3: Ⓐ held to chat to a parked Gary (stepChat)
      else if (a?.t === 'leave') this.leaveCart(p);
      else if (a?.t === 'swing') this.swing(p, a);
      else if (a?.t === 'wand') this.toggleWand(p);
      else if (a?.t === 'wash') this.wash(p, a.secs, a.target);
      else if (a?.t === 'crank') this.crank(p, a.side, a.turns);
      else if (a?.t === 'sign') this.sign(p, !!a.on);
      else if (a?.t === 'clockout') this.clockOutInput(p, a.on !== false);   // playthrough 5: "Card done · clock out" (held)
      else if (a?.t === 'contract') this.contractInput(p, a.i);   // round 11: the endless report's contract pick
      else if (a?.t === 'look') this.lookInput(p, a.part, a.id);    // round 11: the overnight locker (stars' cosmetics)
      else if (a?.t === 'notyet') this.notYetInput(p);                        // playthrough 5 A1: decline the promotion today
      else if (a?.t === 'cctv') { if (this.venue >= 1) this.pa('cctv', { once: true }); }
      else if (a?.t === 'mark') this.mark(p, a);
      else if (a && typeof a.t === 'string') this.mods.first('input', p, a);   // a venue module's own action
    }
    return { denied };
  }

  pickup(p, id) {
    const b = this.balls.get(id);
    const g = gearPerks(p.gear);
    if (!b || p.down > 0 || this.driving(p) || this.phase === 'lobby') return false;
    if (b.y > 0.4 || b.sunk || b.drifting || b.creek) return false;   // in the air, at the bottom of the pond, or floating down (or snagged in) the creek
    if (Math.hypot(b.x - p.x, b.z - p.z) > g.reach + 1) return false;  // slack for a rolling ball
    if (b.hands) return this.mods.first('take', p, b);   // round 11: a Rats-only ball (a souvenir, a hazard): its venue module takes it
    if (b.kind === 'one') {                                // Ball No. 1 rides in your hands, outside the pocket
      if (p.one || p.diving) return false;
      this.balls.delete(id); p.one = true;
      if (this.lastBucket) { this.lastBucket.phase = 'carried'; this.lastBucket.by = p.id; }
      this.events.push({ t: 'gone', id, by: p.id }, { t: 'lastbucket', phase: 'carried', by: p.id });
      return true;
    }
    if (p.pocket >= g.pocket) return false;
    this.balls.delete(id);
    p.pocket++; p.pocketW = (p.pocketW ?? 0) + (KIND_W[b.kind] ?? 1) * ballMul(b); this.stats.picked++; p.shift.picked = (p.shift.picked ?? 0) + 1; this.dirty = true;
    this.events.push({ t: 'gone', id, by: p.id });
    if (b.kind === 'splitter') for (const s of spill(b.x, b.z, 2, this.rng)) this.addBall({ ...s, y: 0.3, vy: 2.5, kind: 'range' });
    this.sweepStep(p, 1);
    return true;   // grime comes only from knockdowns (council round 3)
  }

  // Round 11 (expert #4, web/js/sweep.js): the server's own sweep count (pickups within SWEEP.GAP s). Crossing ×25 is
  // a "Clean sweep!": +1% Hustle for the shift (the Hustle cap holds), at most SWEEP.BONUS_MAX a shift.
  sweepStep(p, k) {
    if (this.phase !== 'shift') return;
    const now = this.now() / 1000;
    p.sweep ??= { n: 0, last: null };
    const before = sweepLive(p.sweep, now) ? p.sweep.n : 0, n = stepSweep(p.sweep, now, k);
    if (!crossedClean(before, n)) return;
    const give = (this.sweeps ?? 0) < SWEEP.BONUS_MAX;
    if (give) { this.sweeps = (this.sweeps ?? 0) + 1; this.mult = Math.min(Math.max(this.mult, maxMult(this.up, this.endless, CART.MAX_MULT)), cents(this.mult + SWEEP.BONUS)); this.dirty = true; }
    if (p.shift) p.shift.sweeps = (p.shift.sweeps ?? 0) + 1;
    this.events.push({ t: 'sweep', by: p.id, n, ...(give ? { bonus: SWEEP.BONUS } : {}) });
  }

  deposit(p) {
    if (p.down > 0 || !atStand(p)) return;
    if (p.treasure) this.bankTreasure(p);
    if (p.one) return this.depositOne(p);
    if (p.pocket <= 0) return;
    const n = p.pocket, w = p.pocketW ?? n;
    p.pocket = 0; p.pocketW = 0;
    this.bank(n, p.id, null, w);
  }

  // Owner playtest 3 §3.3: start or stop filling buckets at the dispenser. A third Rat gets 'fillbusy' (the prompt).
  fillInput(p, on) {
    if (on && (this.phase !== 'shift' || p.down > 0 || this.driving(p) || p.diving)) return;
    const r = holdFill(this.basket, p.id, on, p);
    if (r === 'busy') this.events.push({ t: 'fillbusy', id: p.id });
    this.dirty = true;
  }

  // The shop is open any time (Tab / D-pad up): the range keeps going while you browse.
  buy(p, id) {
    const item = Object.hasOwn(SHOP_BY_ID, id) ? SHOP_BY_ID[id] : null;
    if (!item) return false;
    const price = nextPrice(id, this.up, this.onlineCount(), id === 'dive' ? p.dive : p.gear, this.venue, shopDay(this.phase, this.day), this.endless, worldVday(this.venue, shopDay(this.phase, this.venueDay), this.endless));
    if (price === null || price > this.cash) return false;
    if (this.todo) this.todo.buy = true;
    this.cash = cents(this.cash - price);
    let level;
    if (id === 'dive') { level = ++p.dive; this.diveByName[p.name] = p.dive; }
    else { level = this.up[id] = (this.up[id] ?? 0) + 1; this.applyUpgrades(); }
    this.dirty = true;
    this.events.push({ t: 'buy', by: p.id, id, level, price, personal: !!item.personal });
    if (id === 'cart' && level === 1) this.pa('cart', { once: true });
    if (id === 'cart' && level === 3) this.pa('fleet', { once: true });
    if (id === 'owner' && level === OWNER.STATUE) this.pa('statue', { once: true, big: true });   // round 7 #9: once ever
    this.goalCheck();   // council round 10 #1: a purchase goal ticks (and pays) at once
    return true;
  }

  applyUpgrades() {
    // Owner playtest 3 §5.2: the New Hire Kit's bucket is now a floor: from the Club, the crew's gear is a bucket or better.
    if (this.venue >= 1 && (this.up.gear ?? 0) < 2) this.up.gear = 2;
    for (const p of this.players?.values() ?? []) p.gear = this.up.gear ?? 0;
    this.perks = perks(this.up);
    this.hireHelpers();
    while (this.carts.length < (this.perks.carts ?? 0)) {
      const i = this.carts.length;
      this.carts.push({ i, ...(i ? CART.PARK2 : CART.PARK), v: 0, driver: null, load: 0, loadW: 0, boostT: 0, movedAt: this.now(), mud: 0 });
    }
  }

  // ---- the goal card (council round 10 #1) -----------------------------------------
  // The legacy alias (one release): `stamps` was the venue's APPROVED count; it is `reviews` now.
  get stamps() { return this.reviews; }
  set stamps(v) { this.reviews = v; }
  // Print the card on the venue's first morning for the crew online then (a migrated card prints over its counts).
  printGoals() {
    if (!hasCard(this.venue, this.endless)) { this.goals = null; return; }
    const opts = { treasuresLeft: TREASURE.filter(t => t.minVenue <= this.venue && !this.lostFound.includes(t.id)).length };
    if (this.goals?.venue === this.venue && this.goals.scale != null) return;
    this.goals = this.goals?.venue === this.venue ? printOver(this.goals, this.onlineCount(), opts) : printCard(this.venue, this.onlineCount(), opts);
    // A row already owned on the printing morning ticks quietly (no reward): the card asks for what's still to buy.
    for (const r of this.goalRows()) if (r.kind === 'buy' && r.done && !this.goals.done.includes(r.id)) this.goals.done.push(r.id);
  }
  // The card's live rows (goals.js rowsOf): counts, the shop, the live fee, the Orbital's sky.
  goalRows() {
    if (!this.goals || this.endless) return [];
    const sky = this.venue === LAST_CARD && this.outstanding <= 1 && this.skyDebris() <= ORBIT.SKY_CLEAR;
    // Playthrough 5 C3: once the sky stops refilling (the Last Bucket is on: no orbit shots), the debris goal asks for no
    // more than was brought down plus what's still up there (or in a rider's bag), so it can always be finished.
    let cap;
    if (this.venue === LAST_CARD && this.lastBucket && this.lastBucket.phase !== 'done' && onCard(LAST_CARD, 'debris')) {
      let bags = 0; for (const r of this.mods.state('orbit')?.riders?.values() ?? []) bags += r.bag?.length ?? 0;
      cap = { debris: (this.goals.n.debris ?? 0) + this.skyDebris() + bags };
    }
    const skyLive = this.venue === LAST_CARD ? { skyOut: this.outstanding, skyUp: skyToClear(this.skyDebris()) } : {};   // round 12: the sky row's words
    return rowsOf(this.goals, { up: this.up, cash: this.cash, fee: this.promoFee() ?? 0, sky, ...skyLive, ...(cap ? { cap } : {}) }, this.goalsToday);
  }
  goalOpen(id) { return !!this.goals && onCard(this.goals.venue, id) && !this.goalRows().find(r => r.id === id)?.done; }
  // One call at each counting site: n more of goal `id` (only if it's on this venue's card and still open).
  goalTick(id, n = 1) {
    const g = this.goals;
    if (!g || g.venue !== this.venue || !onCard(g.venue, id) || g.done.includes(id) || !(n > 0)) return;
    g.n[id] = (g.n[id] ?? 0) + n; this.dirty = true;
  }
  // Newly completed goals: marked done (for good), the reward paid once (50 × BV), one 'goal' event each (the toast).
  // The live fee and the sky never mark: they read the wallet and the sky.
  goalCheck() {
    const g = this.goals;
    if (!g || g.venue !== this.venue || !this.mods) return;
    const force = new Set();
    // Playthrough 5 C3: the debris goal is never force-ticked (goalRows sizes it to what's in the sky instead).
    // Every Rat rides the Lift: the Rats printed on the card, or every Rat still here (a crew that shrank).
    if (onCard(g.venue, 'lift')) { const on = this.online(); if (on.length && on.every(p => g.who.includes(p.name))) force.add('lift'); }
    for (const r of this.goalRows()) {
      if (!(r.done || force.has(r.id)) || r.kind === 'fee' || r.kind === 'sky' || g.done.includes(r.id)) continue;
      g.done.push(r.id); this.goalsToday.push(r.id); this.dirty = true;
      const reward = r.reward ? rewardFor(this.valueNow().bv, this.venue, this.onlineCount()) : 0;   // round 11: ~7% of a shift
      if (reward) this.cash = cents(this.cash + reward);
      this.events.push({ t: 'goal', id: r.id, need: r.need, reward });
    }
  }
  // The counters that ride on events other code already pushes (venue modules included): each event counted once.
  goalScan() {
    const g = this.goals;
    if (!g || g.venue !== this.venue) return;
    const strays = this.venue === 4 && onCard(4, 'strays') && !g.done.includes('strays');
    for (const e of this.events) {
      if (this.goalSeen.has(e)) continue;
      this.goalSeen.add(e);
      switch (e.t) {
        case 'treasure': if (e.phase === 'banked') this.goalTick('treasures'); break;
        case 'target': this.goalTick('targets'); break;
        case 'deckTab': if (e.order || e.round) this.goalTick('orders'); break;
        case 'crowd': if (e.kind === 'lap' && !e.auto) this.goalTick('laps'); break;   // playthrough 5 C2: driven laps only
        case 'ping': if (e.prize) this.goalTick('pings'); break;
        case 'landed': this.goalTick('debris', e.n ?? 1); break;
        case 'winch': this.goalTick('debris'); break;   // playthrough 5 C3: the tether winch's pieces count too
        case 'lift': if (e.dir === 'up') { const p = this.players.get(e.id); if (p && !g.who.includes(p.name) && g.who.length < 6) { g.who.push(p.name); this.dirty = true; } } break;
        case 'gone': if (strays && e.by && e.by !== 'van' && this.strayIds?.has(e.id)) this.goalTick('strays'); break;   // round 11: Zoning's van doesn't sweep for you   // a County stray swept (a Rat, the cart, a drone)
      }
    }
    if (strays) { this.strayIds = new Set(); for (const b of this.balls.values()) if (isStray(b)) this.strayIds.add(b.id); }
    this.goalCheck();
  }
  // The card for the wire: rows, the Board's strip, the report's headline, and what a feature goal pays now.
  goalWire() {
    const rows = this.goalRows();
    if (!rows.length) return null;
    const promo = isPromotionDay(this) && this.phase === 'shift';   // round 11: the Board's PROMOTION DAY chip is the strip's label
    return { venue: this.venue, rows, strip: promo ? promoStrip(strip(rows, this.venue)) : strip(rows, this.venue), head: headline(rows, this.venue), reward: rewardFor(this.valueNow().bv, this.venue, this.onlineCount()), ...(promo ? { promoDay: true } : {}) };
  }

  // ---- promotion (council round 2, §4.1; round 10 #1: the goal card decides) ----------
  promoFee() {
    const next = VENUE_RULES[this.venue + 1];
    if (!next || this.endless) return null;
    return Math.round(next.fee * (1 + 0.4 * (Math.max(1, this.onlineCount()) - 1)));
  }
  promoInfo() {
    const next = VENUE_RULES[this.venue + 1];
    if (!next || this.endless) return null;
    const rows = this.goalRows();
    return { next: next.name, fee: this.promoFee(), reviews: this.reviews, done: doneCount(rows), of: rows.length,
      ready: cardDone(rows), signed: [...this.signed] };
  }

  // The franchise agreement: every online Rat signs at the report, then it executes.
  sign(p, on) {
    const info = this.promoInfo();
    if (!info || this.phase !== 'report' || !info.ready) return false;
    if (on) this.signed.add(p.id); else this.signed.delete(p.id);
    const online = this.online();
    for (const id of [...this.signed]) if (!online.some(o => o.id === id)) this.signed.delete(id);
    this.events.push({ t: 'sign', by: p.id, on, n: this.signed.size, of: online.length });
    if (online.length && online.every(o => this.signed.has(o.id))) this.promote();
    return true;
  }

  promote() {
    const info = this.promoInfo();
    if (!info?.ready) return false;
    const to = this.venue + 1, rules = VENUE_RULES[to];
    this.cash = cents(this.cash - info.fee);
    this.totals.reviews = (this.totals.reviews ?? 0) + this.reviews;
    this.reviews = 0; this.goals = null; this.goalsToday = [];   // round 10 #1: the next venue's card prints on its first morning
    this.venue = to; this.venueDay = 0;
    const before = this.outstanding;
    this.outstanding = rules.writeOff === 'rest' ? ONE_YEAR : Math.max(ONE_YEAR + 1, this.outstanding - rules.writeOff);
    this.pendingReveal = to;
    if (to === 1 && !this.up.shed) { this.up.shed = 1; this.applyUpgrades(); }   // the members expect fries
    this.applyUpgrades();            // owner playtest 3 §5.2: the Club's gear floor
    this.signed.clear();
    this.dirty = true;
    this.events.push({ t: 'promoted', venue: to, fee: info.fee, writeOff: before - this.outstanding, title: this.title() });
    return true;
  }

  // ---- Ready Up (council round 2, §5.1) -----------------------------------------
  // From the lobby the range opens at once; at the report the next shift starts
  // when every online Rat is ready, or 20 s after the first one is.
  // Playthrough 5 A1: Ready never starts the next shift while the card is done and the promotion unsigned (solo and pad
  // crews lost a day at the same venue): it waits for the signatures, or for a Rat's explicit "Not yet" (notYetInput).
  readyUp(p) {
    if (this.phase === 'lobby') return this.startShift();
    if (this.phase !== 'report') return;
    this.ready.add(p.id);
    if (!this.readyAt) this.readyAt = this.now();
    const online = this.online();
    this.events.push({ t: 'ready', n: this.ready.size, of: online.length, t0: READY_SECS, ...(this.promoHolds() ? { held: true } : {}) });
    if (online.every(o => this.ready.has(o.id)) && !this.promoHolds()) this.startShift();
  }

  // A promotion is ready to sign and not every online Rat has signed: { n, of }, else null.
  awaitingSignatures() {
    if (this.phase !== 'report' || !this.promoInfo()?.ready) return null;
    const online = this.online();
    const n = online.filter(o => this.signed.has(o.id)).length;
    return n < online.length ? { n, of: online.length } : null;
  }
  // The signatures hold Ready (and its 20 s timer) until they're in, or the crew said "Not yet".
  promoHolds() { return !this.notYet && !!this.awaitingSignatures(); }
  // Playthrough 5 A1: "Not yet" at the report: the crew stays at this venue another day (any one Rat's call; the card
  // stays done, so tomorrow's report asks again). Ready then works as usual.
  notYetInput(p) {
    if (this.phase !== 'report' || !this.promoInfo()?.ready || this.notYet) return false;
    this.notYet = true; this.signed.clear(); this.dirty = true;
    this.events.push({ t: 'notyet', by: p.id });
    const online = this.online();
    if (online.length && online.every(o => this.ready.has(o.id))) this.startShift();
    return true;
  }

  // ---- Clock out early (playthrough 5, all three testers' top ask) ------------------------------------------------
  // Once the venue's card is done (promoInfo().ready), the crew can ring the bell now: every online Rat holds "Clock
  // out" (solo: at once) and the normal bell runs (the review, the stamp, the report). Releasing takes your vote back.
  canClockOut() { return this.phase === 'shift' && !this.paused() && !this.endless && this.shiftT > 0 && !!this.promoInfo()?.ready; }
  clockOutInput(p, on) {
    this.clockOut ??= new Set();
    if (on && !this.canClockOut()) return false;
    if (on) this.clockOut.add(p.id); else if (!this.clockOut.delete(p.id)) return false;
    const online = this.online();
    for (const id of [...this.clockOut]) if (!online.some(o => o.id === id)) this.clockOut.delete(id);
    this.dirty = true;
    this.events.push({ t: 'clockout', by: p.id, on, n: this.clockOut.size, of: online.length });
    this.checkClockOut();
    return true;
  }
  // Everyone in: the bell rings now. The card went undone (a purchase took the fee): the votes clear.
  checkClockOut() {
    if (!this.clockOut?.size) return false;
    if (!this.canClockOut()) { this.clockOut.clear(); this.dirty = true; return false; }
    const online = this.online();
    if (!online.length || !online.every(o => this.clockOut.has(o.id))) return false;
    const early = Math.max(0, Math.round(this.shiftSecs - this.shiftT));
    this.clockOut.clear();
    this.shiftT = this.shiftSecs;
    this.events.push({ t: 'clockedout', early });
    this.earlyBell = early;
    this.endShift();
    return true;
  }

  // ---- the cart --------------------------------------------------------------

  // Climb into the nearest free cart within reach.
  board(p) {
    if (p.down > 0 || p.one || this.driving(p)) return false;
    let c = null, best = CART.BOARD_REACH;
    for (const o of this.carts) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (!o.driver && d <= best) { c = o; best = d; } }
    if (!c) return false;
    c.driver = p.id; c.movedAt = this.now(); c.v = 0;
    p.wand = false;   // owner playtest 3 §7.1: the wand goes back on its reel when you climb in (RT is the throttle now)
    p.x = c.x; p.z = c.z;
    this.events.push({ t: 'board', by: p.id, cart: c.i });
    return true;
  }

  leaveCart(p) {
    const c = this.cartOf(p);
    if (!c) return false;
    c.driver = null; c.v = 0;
    // Step out on the driver's side.
    p.x = c.x - Math.cos(c.yaw) * 1.4; p.z = c.z + Math.sin(c.yaw) * 1.4;
    if (!this.mods.first('clamp', p)) clampToField(p, this.world());
    p.yaw = c.yaw; p.movedAt = this.now();
    this.events.push({ t: 'unboard', by: p.id });
    return true;
  }

  // The driver reports where the cart is; the server keeps it plausible.
  driveTo(p, pose, now) {
    const c = this.cartOf(p);
    if (!c || !pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.z)) return;
    const dt = Math.min(1, Math.max(0.05, (now - c.movedAt) / 1000));
    const vmax = this.perks.cartSpeed * (c.boostT > 0 ? CART.BOOST : 1) * cartSpeedAt(c.x, c.z, this.world());   // x1.3 on the Ping Track
    const max = vmax * 1.3 * dt + 0.6;
    let dx = pose.x - c.x, dz = pose.z - c.z;
    const d = Math.hypot(dx, dz);
    if (d > max) { dx *= max / d; dz *= max / d; }
    // Sweep the move in half-metre steps: the creek, the pond, the rock and the tractor stop the cart
    // (only the Cart Bridge crosses), and a laggy jump can't hop the creek.
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.5)), w = this.world();
    for (let i = 0; i < n; i++) {
      const nx = c.x + dx / n, nz = c.z + dz / n;
      if (cartBlocked(nx, nz, w)) break;
      c.x = nx; c.z = nz;
    }
    keepInField(c, 6);
    if (Number.isFinite(pose.yaw)) c.yaw = pose.yaw;
    c.v = Math.min(d, max) / dt;
    c.mud = Math.min(1, c.mud + Math.min(d, max) * WASH.MUD_PER_M);   // the field is wet
    c.movedAt = now;
    p.x = c.x; p.z = c.z; p.yaw = c.yaw;
    // Anyone on foot in the way goes flying.
    if (c.v > CART.RUN_OVER_SPEED) {
      for (const o of [...this.players.values(), ...this.helpers]) {
        if (o === p || o.down > 0 || this.driving(o) || this.aloft(o)) continue;
        if (Math.hypot(o.x - c.x, o.z - c.z) < 1.3) { this.knockDown(o, 'cart'); this.stats.runOver++; }
      }
    }
  }

  // A splitter through the cart, the jackpot, a helper or the pond loads as three.
  loadOf(b) { return b.kind === 'splitter' ? 3 : 1; }

  cartPickup(p, id) {
    const c = this.cartOf(p), b = this.balls.get(id);
    if (!b || !c || c.load >= this.perks.cartCap || c.tipT > 0 || this.phase === 'lobby') return false;   // §5.3: not while it tips
    if (b.y > 0.4 || b.kind === 'one' || b.drifting || b.sunk || b.creek) return false;
    if (b.kind === 'square') return false;   // round 6 #8: squares jam the reels; walkers, teenagers and drones fetch them
    if (b.hands) return false;               // round 11: souvenirs and hazards are Rats only
    const rx = c.x - Math.sin(c.yaw) * CART.REEL_AHEAD, rz = c.z - Math.cos(c.yaw) * CART.REEL_AHEAD;
    if (Math.hypot(b.x - rx, b.z - rz) > this.perks.cartReel / 2 + 1.5) return false;   // slack for lag
    this.balls.delete(id);
    const k = this.loadOf(b);
    c.load += k; c.loadW = (c.loadW ?? 0) + (KIND_W[b.kind] ?? 1) * ballMul(b) * (k === 3 ? 3 : 1); this.stats.picked += k; this.stats.carted += k; this.dirty = true;
    this.events.push({ t: 'gone', id, by: p.id });
    this.sweepStep(p, 1);   // round 11: driven-cart pickups sweep too
    return true;
  }

  // A cart's hopper banks at the one price, then empties. Round 11: a muddy cart muddies the return instead.
  unloadCart(c) {
    c.tipT = 0;
    if (c.load > 0) this.bank(c.load, c.driver ?? 'cart', 'cart', c.loadW ?? c.load, 1, { cart: c.i });
    c.load = 0; c.loadW = 0;
  }

  // ---- power washing ---------------------------------------------------------
  // Grab the wand at the station, then spray the cart, a fixture or a crewmate.

  toggleWand(p) {
    if (p.wand) { p.wand = false; return true; }
    if (this.driving(p) || p.down > 0 || Math.hypot(p.x - WASH.STATION.x, p.z - WASH.STATION.z) > WASH.GRAB) return false;
    p.wand = true; p.washAt = this.now();
    return true;
  }

  // target: 'cart' (default: the first cart), 'cart1' (the second), a fixture id (the sign, the stand, a mat),
  // or 'p:<id>' (Hose a Friend).
  wash(p, secs, target = 'cart') {
    const now = this.now();
    if (!p.wand || p.down > 0 || !Number.isFinite(secs) || secs <= 0) return false;
    const reach = this.perks.washReach + 1.5;   // owner playtest 3 §5.1: 7 m, 9 m with the turbo nozzle
    const s = Math.min(secs, 0.5, (now - p.washAt) / 1000 * 1.15);
    if (target === 'self') {   // look down and hose your own boots: a layer every 1.5 s
      p.washAt = now;
      if (s <= 0 || p.grime <= 0) return false;
      p.rinseAcc += s;
      if (p.rinseAcc >= 1.5) { p.rinseAcc = 0; this.addGrime(p, -1); }
      return true;
    }
    if (typeof target === 'string' && target.startsWith('h:')) {   // round 11: the wand on a County hazard ball (county.mjs)
      p.washAt = now;
      return s > 0 && this.mods.first('input', p, { t: 'hazspray', id: +target.slice(2), secs: s });
    }
    if (target === 'mower') {   // council round 11 #1 (builder 1): hose MOW-E's grille (mowe.js hoseBoss)
      p.washAt = now;
      return s > 0 && this.moweHose(p, s, reach);
    }
    if (typeof target === 'string' && target.startsWith('p:')) {
      const o = this.players.get(target.slice(2));
      if (!o || o === p || Math.hypot(o.x - p.x, o.z - p.z) > reach) return false;
      p.washAt = now;
      if (s <= 0) return false;
      o.hoseAcc += s;
      const d = Math.max(0.01, Math.hypot(o.x - p.x, o.z - p.z));
      if (o.hoseAcc >= 0.5) {
        o.hoseAcc = 0;
        if (o.grime > 0) { this.addGrime(o, -1); p.shift.hosed++; }
        this.events.push({ t: 'hosed', id: o.id, by: p.id, dx: (o.x - p.x) / d * 0.5, dz: (o.z - p.z) / d * 0.5 });
      }
      return true;
    }
    const isCart = target === 'cart' || target == null || /^cart\d$/.test(target);
    const cart = isCart ? this.carts[target === 'cart' || target == null ? 0 : +target.slice(4)] : null;
    const where = isCart ? cart : Object.hasOwn(FIXTURE_BY_ID, target) ? FIXTURE_BY_ID[target] : null;
    if (!where || Math.hypot(where.x - p.x, where.z - p.z) > reach + (where.r ?? 0)) return false;
    if (!isCart && (!(target in this.fixtures) || !fixtureBuilt(target, this.openBays()))) return false;   // round 11: an unbuilt bay isn't there
    p.washAt = now;
    if (s <= 0) return false;
    const rate = WASH.RATE * (isCart ? 1 : 1.6) * this.perks.washRate;   // fixtures are smaller than a cart; §5.1 fan ×1.5, turbo ×2
    const before = isCart ? cart.mud : this.fixtures[target];
    const after = Math.max(0, before - rate * s);
    const done = before > 0.05 && after <= 0.05;
    if (isCart) cart.mud = done ? 0 : after; else this.fixtures[target] = done ? 0 : after;
    this.stats.washed = Math.round((this.stats.washed + s) * 10) / 10;
    // Owner playtest 3 §1.3: "+$0.05 a ball" over a fixture made Spotless: what its mud (when this hosing run began) cost a ball.
    if (!isCart) { this.washFrom ??= {}; this.washFrom[target] = Math.max(this.washFrom[target] ?? 0, before); }
    let gain = null;
    if (done && !isCart) { const v = this.valueNow(); gain = spotlessGain({ rate: v.rate, hustle: v.hustle, seal: this.seal ?? 1, washFrom: this.washFrom[target], fixtures: this.curbSlots() }); delete this.washFrom[target]; }
    if (done) this.events.push({ t: 'spotless', by: p.id, target: isCart ? (cart.i ? 'cart' + cart.i : 'cart') : target, ...(gain ? { gain } : {}) });
    if (done && !isCart) p.shift.hosed++;   // playtest round 2 #12: the ledger credits the Rat who hosed a fixture clean
    if (!isCart && this.perks.foam) this.foamCone(p, where, target, rate * s, reach);
    this.dirty = true;
    return true;
  }


  // Owner playtest 3 §5.1: the foam cannon. Every other fixture within WASH.FOAM_R of the spray line (from the Rat
  // through the target, out to the reach) is cleaned at the same time: sweep a row of mats in one pass.
  foamCone(p, at, target, amount, reach) {
    const dx = at.x - p.x, dz = at.z - p.z, len = Math.hypot(dx, dz) || 1, ux = dx / len, uz = dz / len;
    for (const fx of FIXTURES) {
      if (fx.id === target || !(this.fixtures[fx.id] > 0)) continue;
      const along = (fx.x - p.x) * ux + (fx.z - p.z) * uz;
      if (along < 0 || along > reach) continue;
      if (Math.abs((fx.x - p.x) * uz - (fx.z - p.z) * ux) > WASH.FOAM_R) continue;
      const before = this.fixtures[fx.id], after = Math.max(0, before - amount);
      const done = before > 0.05 && after <= 0.05;
      this.fixtures[fx.id] = done ? 0 : after;
      if (done) { this.events.push({ t: 'spotless', by: p.id, target: fx.id, foam: true }); p.shift.hosed++; }
    }
  }

  addGrime(p, d) {
    const v = Math.max(0, Math.min(3, p.grime + d));
    if (v === p.grime) return;
    p.grime = v; this.dirty = true;
    this.events.push({ t: 'grime', id: p.id, v });
  }

  // ---- the ball washer (council round 2, §4.4) ---------------------------------------
  crank(p, side, turns) {
    const now = this.now();
    if ((side !== 'L' && side !== 'R') || !this.perks.washer || p.down > 0 || !atHandle(p, side) || !Number.isFinite(turns) || turns <= 0) return false;
    const dt = Math.min(1, (now - (p.crankAt || now - 250)) / 1000);
    p.crankAt = now;
    const t = Math.min(turns, WASHER.CRANK_MAX * dt * 1.15);   // a little jitter room, never free turns at dt = 0
    p.crankFrac = (p.crankFrac ?? 0) + t;
    const whole = Math.floor(p.crankFrac);
    p.crankFrac -= whole;
    if (whole > 0) this.washBalls(whole, p.id);
    this.cranking = this.cranking ?? {}; this.cranking[side] = { id: p.id, at: now, rate: t / Math.max(dt, 0.05) };
    return true;
  }

  // ---- Hit the Cart ----------------------------------------------------------
  // From a crew bay you hit the balls you're carrying. One that rings the cage
  // while someone's driving pays the whole crew.

  swing(p, a) {
    const now = this.now();
    if (this.phase !== 'shift' || p.down > 0 || this.driving(p) || p.pocket <= 0) return false;
    if (now - p.swungAt < SIM.SWING_COOLDOWN * 1000) return false;
    const bay = BAYS.find(b => Math.hypot(p.x - b.x, p.z - b.z) < BAY_REACH);
    if (!bay || ![a.yaw, a.pitch, a.power].every(Number.isFinite)) return false;
    p.pocket--; p.pocketW = Math.max(0, (p.pocketW ?? 1) - 1); p.swungAt = now;
    this.stats.swings++;
    const curve = Number.isFinite(a.curve) ? Math.max(-1, Math.min(1, a.curve)) : 0;
    const b = this.addBall({ ...swingLaunch(bay, a.yaw, a.pitch, a.power), curve });
    if (b) b.by = p.id;
    return true;
  }

  ping(b, c = this.cart) {
    b.pinged = true;
    b.vx *= -0.3; b.vz *= -0.3; b.vy = Math.abs(b.vy) * 0.4;    // it rattles off the cage
    // Council round 10 §D: an autopilot cart (c.auto, stadium.mjs) pays like a driven one.
    if (!b.by || (!c.driver && !c.auto) || this.phase !== 'shift') {   // a customer's ball, or nobody driving: just noise
      this.events.push({ t: 'ping', by: b.by ?? null, cart: c.i });
      return;
    }
    this.stats.pings++; this.dirty = true;
    const shooter = this.players.get(b.by);
    if (shooter) shooter.shift.pings++;
    let r = this.rng(), prize = PING_PRIZES[PING_PRIZES.length - 1][0];
    for (const [name, w] of PING_PRIZES) { if (r < w) { prize = name; break; } r -= w; }
    let n = 0;
    if (prize === 'jackpot') {
      for (const o of [...this.balls.values()]) {
        if (c.load >= this.perks.cartCap) break;
        if (!o.rest || o.sunk || o.creek || o.kind === 'one' || o.hands || Math.hypot(o.x - c.x, o.z - c.z) > CART.JACKPOT_R) continue;
        const k = this.loadOf(o);
        if (c.load + k > this.perks.cartCap) continue;   // owner playtest 3 §5.3: the jackpot clamps at the cap
        this.balls.delete(o.id); c.load += k; c.loadW = (c.loadW ?? 0) + (KIND_W[o.kind] ?? 1) * ballMul(o) * (k === 3 ? 3 : 1); n += k;
        this.stats.picked += k; this.stats.carted += k;
        this.events.push({ t: 'gone', id: o.id, by: c.driver });
      }
      if (!this.jackpotSaid) { this.jackpotSaid = this.pa('jackpot', { chance: 0.25 }); }
    } else if (prize === 'boost') c.boostT = CART.BOOST_SECS;
    else this.mult = Math.min(maxMult(this.up, this.endless, CART.MAX_MULT), this.mult + CART.MULT_STEP);   // round 7 #9: x3 with the Owner's Hustle
    this.events.push({ t: 'ping', by: b.by, prize, n, mult: this.mult, cart: c.i });
    this.mods.call('ping', b, { prize, n, cart: c });
  }

  // Corporate CCTV (council round 2, §4.6): a flag the whole crew sees for 10 s.
  mark(p, a) {
    if (this.venue < 1 || !Number.isFinite(a.x) || !Number.isFinite(a.z)) return false;
    const now = this.now();
    if (now - (p.markAt ?? 0) < 2000) return false;
    p.markAt = now;
    this.events.push({ t: 'mark', by: p.id, x: +a.x.toFixed(1), z: +a.z.toFixed(1), color: p.color });
    return true;
  }

  // ---- hired help ----------------------------------------------------------
  // Helpers walk to the nearest ball nobody else is after, fill up (a beat-up
  // tube), walk them to the bucket stand, and bank them. They get hit too.

  hireHelpers() {
    while (this.helpers.length < this.perks.helpers) {
      const i = this.helpers.length;
      this.helpers.push({ id: `h${i}`, name: HELPER_NAMES[i] ?? `Helper ${i + 1}`, helper: true,
        x: SIM.STAND.x + 2 + i * 1.2, z: SIM.STAND.z - 0.5, yaw: Math.PI, pocket: 0, down: 0, target: null });   // they wait beside the return, on the field side
    }
  }

  stepHelpers(dt) {
    const claimed = new Set(this.helpers.map(h => h.target).filter(Boolean));
    const cap = HELPER_POCKET;
    const lawns = this.venue >= 4;     // round 7 #6: from the County, teenagers stay off the lawns (strays are the drones' and the Rats')
    for (const h of this.helpers) {
      if (h.down > 0) continue;
      const working = this.phase === 'shift' && !this.paused();
      let goal = null;
      if (h.pocket >= cap || (h.pocket > 0 && !working)) goal = SIM.STAND;
      else if (working) {
        let b = h.target && this.balls.get(h.target);
        if (!b || !b.rest) {
          claimed.delete(h.target);
          h.target = null; b = null;
          let bd = Infinity;
          for (const c of this.balls.values()) {
            if (!c.rest || c.sunk || c.creek || c.kind === 'one' || c.hands || claimed.has(c.id) || (lawns && isStray(c))) continue;   // round 11: b.hands is Rats only
            const d = Math.hypot(c.x - h.x, c.z - h.z);
            if (d < bd) { bd = d; b = c; }
          }
          if (b) { h.target = b.id; claimed.add(b.id); }
        }
        if (b) goal = b;
        else if (h.pocket > 0) goal = SIM.STAND;
      }
      if (!goal) continue;
      const dx = goal.x - h.x, dz = goal.z - h.z, d = Math.hypot(dx, dz);
      if (goal === SIM.STAND && atStand(h)) {
        this.bank(h.pocket, h.id, 'helper', h.pocketW ?? h.pocket);
        h.pocket = 0; h.pocketW = 0;
        continue;
      }
      if (goal !== SIM.STAND && d < 0.5) {
        this.balls.delete(goal.id);
        const k = this.loadOf(goal);
        h.pocket += k; h.pocketW = (h.pocketW ?? 0) + (KIND_W[goal.kind] ?? 1) * ballMul(goal) * (k === 3 ? 3 : 1); h.target = null; this.stats.picked += k; this.dirty = true;
        this.events.push({ t: 'gone', id: goal.id, by: h.id });
        continue;
      }
      const step = Math.min(d, SIM.HELPER_WALK * wadeFactor(h.x, h.z, this.world()) * dt);
      h.x += dx / d * step; h.z += dz / d * step;
      h.yaw = Math.atan2(-dx, -dz);
    }
  }

  startShift() {
    if (this.phase === 'shift') return;
    if (this.phase === 'report') this.day++;
    this.venueDay++;
    // The night crew clears the field: every morning starts clean (the pond keeps what sank).
    // Ball No. 1 is never swept: losing it would hold the clock for ever.
    for (const [id, b] of this.balls) if (!b.sunk && b.kind !== 'one') { this.balls.delete(id); this.events.push({ t: 'gone', id }); }
    this.shiftSecs = this.shiftOverride ?? (this.endless || this.venue > 0 ? SIM.SHIFT_SECS : shiftSecsFor(this.day));
    this.phase = 'shift'; this.shiftT = 0; this.stats = freshStats(); this.report = null; this.mult = 1; this.sweeps = 0; this.lastCallRung = false; this.reRallied = false; this.rallyDeal = null; this.gaugeWas = null; this.warned = false; this.skyHoldT = 0;
    this.gary = null; this.mower = null; this.paShift = 0; this.jackpotSaid = false;
    // Owner playtest 3 §6: the Seal resets each morning; a missed visit comes today, one on a reveal morning slips a day.
    this.seal = 1; this.garyIntro = null;
    this.fedSt = newFed();   // council round 10 #2: FED resets each morning
    this.tray = newTray();   // round 11: and the tray is binned overnight
    this.garyDay = garyMorning(this.garyDay, this.day, !!this.pendingReveal);
    this.garyRide = null;
    if (isPromotionDay(this)) this.garyDay = this.day;   // round 11: Regional is watching (Gary inspects as on any Gary day)
    this.garyDay = bossSlip(this.garyDay, this.day, !!this.bossToday());   // council round 11 #1 (builder 1): the boss owns its day
    // Round 11: with 2 good days late, a card's Gary goal (the Club's Seal, the County's pass) can't wait on a 3-day gap:
    // after a promotion he comes on the new venue's second morning at the latest.
    if (this.pendingReveal && !this.endless && ['huddle', 'seal', 'pass'].some(id => onCard(this.venue, id))) this.garyDay = Math.min(this.garyDay ?? Infinity, this.day + 1);
    this.ready.clear(); this.readyAt = 0; this.signed.clear(); this.notYet = false; this.clockOut?.clear(); this.earlyBell = 0; this.fedAcc = 0;
    this.hopper = { n: 0, credit: 0, frac: 0 };
    this.basket = newBasket();       // owner playtest 3 §3.3: "the night crew doesn't do buckets"
    // The locker room, then clock in at the yard: everyone starts each shift together.
    let slot = 0;
    for (const p of this.players.values()) {
      p.shift = freshShift(); p.grime = 0;
      const own = this.cartOf(p); if (own) own.driver = null;
      p.diving = false; p.wand = false;
      { const c = clockInSpot(this.venue, slot++, this.endless); p.x = c.x; p.z = c.z; p.yaw = 0; }   // council round 12, 4a (builder 4): late venues clear the deck
    }
    if (this.day > 1) { this.morningMud(); this.fries = Math.floor(this.fries / 2); }   // the fries went cold overnight
    // Round 11 (expert XS): a solo Rat who only reacts to Gary's warning must be able to pass. On a solo Gary morning the
    // night crew leaves the sign and the cart at his pass line (they still dust and muddy up before he comes).
    if (this.garyDay === this.day && !this.endless && this.venue !== 5 && this.onlineCount() === 1) {
      this.fixtures.sign = Math.min(this.fixtures.sign, GARY.SOLO_START);
      for (const c of this.carts) c.mud = Math.min(c.mud, GARY.SOLO_START);
    }
    // Day 1 at the Muni is training: a shared checklist (snapshot `todo`) teaches the loop.
    const unfinished = this.todo && !(this.todo.pick && this.todo.bank && this.todo.sign && this.todo.buy);
    this.todo = this.venue !== 0 || this.endless ? null
      : this.day === 1 ? { pick: false, bank: false, sign: false, buy: false }
      : this.day === 2 && unfinished ? this.todo : null;            // a solo day 1 rarely finishes: carry it over (playtest)
    if (this.day === 1 && this.todo) for (const k of Object.keys(this.fixtures)) if (k.startsWith('mat')) this.fixtures[k] = 0;   // no mat refusals while training
    // Day 2: Corporate sends a teenager, so every crew meets automation early (owner playtest).
    if (this.day === 2 && this.venue === 0 && !this.endless && (this.up.helpers ?? 0) < SHOP_BY_ID.helpers.tiers.length - 1) {
      this.up.helpers = (this.up.helpers ?? 0) + 1; this.applyUpgrades();
      this.events.push({ t: 'freehelper', name: this.helpers.at(-1)?.name ?? 'A teenager' });
    }
    this.printGoals(); this.goalsToday = []; this.garyBack = false; this.strayIds = null;   // council round 10 #1: the card (first morning: printed)
    this.mods.call('startShift');      // venue modules' mornings: after the reset, before the quota is set
    // Corporate's memo and today's quota. Judged on Upkeep, so a mid-shift purchase can't buy it.
    if (this.endless || this.venue === 5) this.quota = null;   // round 7 #5: no review at the Orbital, only Ball No. 1
    // Playthrough 5 A10: at the Muni the target holds (day 4's) while the card's review goal is open, so a slow crew
    // isn't chasing a target that climbs with the calendar.
    else if (this.venue === 0) { const q = quotaQ(this.goalOpen('reviews') ? Math.min(this.day, 4) : this.day, this.ceiling()); this.quota = q == null ? null : { q }; }
    // The target climbs with the good days earned, not just the days served (playtest: a crew that kept missing
    // got targets it could never reach). After three it climbs with the days again (round 10: reviews, not stamps).
    else this.quota = { q: (this.ceiling() - 1) * venueQuotaF(this.reviews < RISE_REVIEWS ? Math.min(this.venueDay, this.reviews + 1) : this.venueDay) };
    if (isPromotionDay(this) && this.quota) this.quota = { ...this.quota, q: promoQ(this.quota.q, this.ceiling(), this.promoTries()) };   // round 11: +10 points, the first try
    this.dealToday();   // round 11 (builder "today"): Corporate's Today, or the endless contract the crew picked
    // Day 1 at the Muni is quiet (the checklist teaches it): the memo still fires, flagged `quiet`, and the client skips the card.
    // Round 11: Today's line rides in the memo (`today`, shown in the flavour's slot): one memo line, one Board chip.
    // Council round 11 #3 (builder 4): one morning, one memo. Everything else the morning used to say rides in the memo's
    // second line (sim.js memoSecond: Today > a NEW line > MOW-E's line > the flavour). The kinds opening today are told
    // here (and join debuts now), so their first hit only floats "NEW ×1.5" (`toldKinds`). The Last Bucket's morning is quiet.
    const vdayAM = worldVday(this.venue, this.venueDay, this.endless), opening = kindsOpening(this.day, this.venue, vdayAM, this.debuts);
    const lbAM = this.venue === 5 && !this.endless && (this.lastBucket ? this.lastBucket.phase !== 'sky' : this.outstanding <= 1);
    const memoLine1 = this.venue === 5 && !this.endless ? orbitMemo(this.outstanding) : memoText(this.day, this.quota && this.quotaPct(), this.endless, this.rng, this.venue, this.garyToday());   // first: the rng order stands
    const second = memoSecond({ today: this.today ? todayMemo(this.today, this.venue) : null, venueNew: this.pendingReveal ? VENUE_RULES[this.pendingReveal]?.memo ?? null : null,
      kindNew: kindNewLine(opening), mowe: this.moweMemo ?? (this.bossToday() ? MEMO_LINES.moweUpdate : null), flavor: memoFlavor(this.day, this.venue, this.endless, this.rng),
      // Council round 12 (builder 4's hooks): the endless contract names itself (6c); memoNote (builder 2: the inspector)
      // and memoNews (builder 3: Site 13's week) are one-morning lines other modules set on the crew.
      contract: this.endless && this.contract ? contractMemo(goalText(this.contract.goal)) : null, note: this.memoNote ?? null, news: this.memoNews ?? null });
    this.moweMemo = null; this.memoNote = null; this.memoNews = null;   // builder 1's MOW-E line (Employee of the Month, sends his regards): one morning only
    const told = !this.pendingReveal && !second.lost;   // a kind the memo didn't name floats its name on its first hit
    this.toldKinds = new Map(opening.map(k => [k, told])); for (const k of opening) this.debuts.add(k);
    const midAM = midDue({ venue: this.venue, venueDay: this.venueDay, endless: this.endless, promoDay: isPromotionDay(this), today: this.today, reveal: !!this.pendingReveal || !!this.endlessFresh, lastBucket: lbAM || !!this.lastBucket, boss: !!this.bossToday() });
    const storyAM = !!this.pendingReveal || !!this.endlessFresh || coldDue(this) || (!!midAM && !this.story.has(midAM));
    this.events.push({ t: 'memo', day: this.day, target: this.quota ? this.quotaPct() : null, text: memoLine1,
      flavor: second.line ?? '', quiet: (this.day === 1 && !!this.todo) || lbAM, ...(storyAM ? { story: true } : {}), ...(second.today ? { today: second.today } : {}), ...(opening.length ? { kinds: opening } : {}) });
    if (isPromotionDay(this)) { const m = this.events.at(-1); m.text = PROMO_DAY.MEMO; m.promoDay = true; }   // round 11: the memo's one line
    for (const c of this.carts) { c.boostT = 0; if (!c.driver) Object.assign(c, c.i ? CART.PARK2 : CART.PARK, { v: 0 }); }
    // Playthrough 5 C6: with autopilot, the second cart starts on the Ping Track half a lap from the first (no lockstep).
    if (this.perks.autopilot && this.venue >= MAP.TRACK.FROM && this.carts[1] && !this.carts[1].driver) Object.assign(this.carts[1], halfLapPose(CART.PARK));
    this.syncBays(true);   // round 11 (bays.js): only built bays carry mud (the crew size is known now)
    const nBays = this.openBays();   // round 11: an unbuilt wing bay draws nothing (a ten-bay crew's RNG is untouched)
    for (const m of this.mats) m.next = m.upper ? 1 + 0.8 * (m.i - UPPER.FROM) : m.i >= BASE_LINE && m.i >= nBays ? 1 : 1 + this.rng() * 5;   // the upper bays draw nothing
    for (const e of openMats(this.mats, { now: this.custT, rng: this.rng, venue: this.venue, nOpen: activeMats(this.onlineCount(), this.up), nextCust: () => ++this.nextCust, mud: i => this.fixtures['mat' + i] ?? 0 })) {
      if (e.t === 'wait') this.events.push({ t: 'custwait', mat: e.mat });
    }
    if (this.venue >= UPPER_VENUE) {   // council round 10 #3: early birds on the upper bays in play too
      const open = new Set(this.upperSeats().map(k => UPPER.FROM + k));
      openMats(this.upperMats(), { now: this.custT, rng: this.rng, venue: this.venue, isOpen: i => open.has(i), nextCust: () => ++this.nextCust });
    }
    this.rollTreasureToday();
    this.revealT = 0;
    const revealMorning = !!this.pendingReveal || !!this.endlessFresh;   // round 12: no mid-venue beat on a reveal morning
    if (this.pendingReveal) {        // a promotion: the next morning plays the reveal
      const v = this.pendingReveal;
      this.pendingReveal = 0; this.revealT = REVEAL_SECS;
      this.events.push({ t: 'reveal', venue: v, memo: VENUE_RULES[v].memo, title: this.title() });
      if (VENUE_RULES[v].pa) this.pa(VENUE_RULES[v].pa);   // council round 12, 4c: the Stadium's reveal has no PA (the newsreel card says it)
      this.storyBeat(beatFor('promo', v)?.id);   // round 12: after the reveal's PA line (the card waits for it)
    }
    // Playthrough 4 C4: the PA card is the first endless morning's one text (the client's reveal shows no memo card for it).
    // Council round 11 #4: a crew that reloaded between the bank and this morning missed the note: it goes first. While
    // the epilogue's cards play, the clock, the customers and the Today deal hold (the reveal's held clock, EPILOGUE_HOLD).
    this.firstOwnerDay = !!this.endlessFresh;   // council round 12 #3d: the snapshot restores Gary at the return on a rejoin
    if (this.endless && !this.glassCase) this.glassCase = newCase(this.online().map(o => o.name), this.day - 1);   // an old save past the bank
    if (this.endlessFresh) { this.storyBeat('note'); if (this.storyBeat('epilogue')) this.revealT = Math.max(this.revealT, EPILOGUE_HOLD); }   // round 12: before the Under New Management PA (the card goes first)
    if (this.endlessFresh) { this.endlessFresh = false; this.events.push({ t: 'reveal', venue: 6, memo: 'Under New Management.', title: 'Owner' }); this.pa('endless'); }
    // The Last Bucket that came due at the bell (or a reload saved at 1) begins this morning. A sky that wasn't
    // cleared by the bell (round 7 #5) reopens its gate: the debris was saved.
    if (this.lastBucket?.phase === 'sky') this.lastBucket = null;
    if (this.venue === 5 && !this.endless && this.outstanding <= 1 && !this.lastBucket) { this.outstanding = 1; this.beginLastBucket(); }
    // Round 12: the cold open (day 1, before the welcome PA) and the venue's one mid-venue story morning.
    if (coldDue(this)) this.storyBeat('cold');
    else this.storyBeat(midDue({ venue: this.venue, venueDay: this.venueDay, endless: this.endless, promoDay: isPromotionDay(this), today: this.today, reveal: revealMorning, lastBucket: !!this.lastBucket, boss: !!this.bossToday() }));
    this.dirty = true;
    this.events.push({ t: 'shift', phase: 'shift', day: this.day });
    if (this.day === 1 || !this.voiced.has('welcome')) this.pa('welcome', { once: true });   // day 1: the one voice line; the checklist waits for it
  }

  // ---- Round 11 (builder "today"): Corporate's Today, the endless contracts --------------------------------------
  // Deal this morning's modifier (today.js todayFor: none on a Gary day, Promotion Day, a reveal morning, or at the
  // Orbital), or in endless the contract the crew picked at the report (nobody picked: the first offer).
  dealToday() {
    this.todayN = {}; this.nightAt ??= this.now();   // the night's clock starts at this session's first morning
    if (this.endless) {
      const offers = this.endlessFresh ? [] : this.offers ?? this.contractOffers();
      this.contract = offers[this.contractPick ?? 0] ?? offers[0] ?? null;
      this.today = this.contract?.mod ?? null;
    } else {
      this.contract = null;
      this.today = todayFor({ key: this.todayKey, day: this.day, venue: this.venue, gary: this.garyToday(), promo: isPromotionDay(this), boss: !!this.bossToday(),
        reveal: !!this.pendingReveal, nMats: activeMats(this.onlineCount(), this.up) });
    }
    this.offers = null; this.contractPick = null;
    this.hustleAt = null; this.contractLost = false;   // council round 12 #6c: the contract live (stepContract)
    // Council round 12 #8: Site 13 races the Owners from their day 2 (records.rival.last is empty on day 1).
    this.rivalT = this.endless && !this.endlessFresh ? rivalTarget(this.records.rival, this.day) : null; this.rivalPassed = false; this.rivalAhead = false;
    if (this.today?.id === 'rain') this.fixtures.stand = Math.min(1, (this.fixtures.stand ?? 0) * mudMul(this.today));   // the rain's mud
    if (this.today?.id === 'shortage') this.basket.cap = basketCap(this.today, BUCKETS.BASKET);
  }
  // The three contracts for an endless morning (today.js contractsFor), against yesterday's cash.
  contractOffers(day = this.day) {
    return contractsFor({ key: this.todayKey, day, yesterday: this.records.yesterday?.cash ?? this.records.cash ?? 0, nMats: activeMats(this.onlineCount(), this.up),
      hustleCap: maxMult(this.up, true, CART.MAX_MULT) });   // council round 12 #6b: ×3 only with the Owner's Hustle
  }
  // Council round 12 #6: the contract's numbers, one count for "left" (ballsLeft: the report, the Spotless bonus, the dusk).
  contractStats(left = null) {
    return { cash: this.stats.cash, knockdowns: this.stats.knockdowns, left: left ?? (this.contract?.goal.k === 'spotless' ? this.ballsLeft() : 0),
      mult: this.mult, hustleAt: this.hustleAt ?? null, shiftT: this.shiftT, secs: this.shiftSecs };
  }
  // Every tick in an endless shift: when the Hustle reached the goal, and "Contract lost." once (the feed; the Board strikes it).
  stepContract() {
    this.stepRival();
    const c = this.contract;
    if (!c || !this.endless || this.phase !== 'shift') return;
    if (c.goal.k === 'hustle' && this.hustleAt == null && this.mult >= c.goal.n - 1e-9) { this.hustleAt = this.shiftT; this.dirty = true; }
    if (!this.contractLost && contractLive(c, this.contractStats())?.state === 'lost') { this.contractLost = true; this.events.push({ t: 'contractLost' }); this.dirty = true; }
  }
  // Council round 12 #8: Site 13's live number, and the first time you pass them (after they led: a feed line and one
  // Board flash, views/glasscase.js; no PA, no centre text).
  rivalNow() { return this.rivalT ? rivalPace(this.rivalT, this.records, this.shiftT, this.shiftSecs) : null; }
  stepRival() {
    if (!this.rivalT || !this.endless || this.phase !== 'shift' || this.rivalPassed || this.shiftT < RIVAL.PASS_AFTER) return;
    const them = this.rivalNow();
    if (them > this.stats.cash) this.rivalAhead = true;
    else if (this.rivalAhead) { this.rivalPassed = true; this.events.push({ t: 'rival', passed: true }); this.dirty = true; }
  }
  // The lower bays in play (round 11, bays.js: the line that exists today, the snapshot's nMats). League Night below
  // Tiered no longer adds bays (an unbuilt bay doesn't exist): its bays swing faster instead (today.js swingMul).
  openBays() { return activeMats(this.onlineCount(), this.up); }
  // The endless report: any Rat picks tomorrow's contract (the last pick stands).
  contractInput(p, i) {
    if (this.phase !== 'report' || !this.endless || !this.offers) return;
    const k = Math.floor(Number(i));
    if (k >= 0 && k < this.offers.length) { this.contractPick = k; this.dirty = true; this.events.push({ t: 'contract', by: p.id, i: k }); }
  }
  // The overnight locker: a Rat's hat or vest (theirs, by name), or the crew's cart paint. Only what the stars unlocked.
  lookInput(p, part, id) {
    id = id ?? null;
    if (!['hat', 'vest', 'cart'].includes(part) || !canWear(id, part, this.stars, (this.records.rival?.acquired ?? 0) > 0)) return;   // council round 12 #8: the jacket
    if (part === 'cart') this.cartPaint = id;
    else { const l = { ...(this.looks[p.name] ?? {}) }; if (id) l[part] = id; else delete l[part]; if (l.hat || l.vest) this.looks[p.name] = l; else delete this.looks[p.name]; }
    this.dirty = true;
  }
  // At the bell: every Rat's shift into the night (the recap's counters), the report's Today line, the night card;
  // in endless, the contract's stars (and a cosmetic every 10) and tomorrow's three offers.
  settleToday(ending = false) {
    const r = this.report;
    const n = this.night ??= { startedAt: this.nightAt ?? this.now(), fromDay: this.day, shifts: 0, balls: 0, cash: 0, knockdowns: 0, falls: 0, treasures: 0, rats: {} };
    n.shifts++; n.balls += this.stats.deposited; n.cash = cents(n.cash + this.stats.cash); n.knockdowns += this.stats.knockdowns;
    n.falls += this.mods.state('deck')?.falls ?? 0;
    for (const p of this.players.values()) { addNight(n.rats, p.name, p.color, p.shift); n.treasures += p.shift.treasures ?? 0; }
    r.night = this.nightNow();
    if (this.today) r.today = { id: this.today.id, name: todayName(this.today), line: todayReport(this.today, { ...this.todayN, orders: this.stats.deckOrders ?? 0 }, this.venue) };
    if (this.endless && !ending) {
      if (this.contract) {
        const met = contractMet(this.contract, this.contractStats(r.left));
        const was = this.stars;
        if (met) this.stars += this.contract.stars;
        const un = newlyUnlocked(was, this.stars);
        r.contract = { ...this.contract, met, total: this.stars, ...(un ? { unlocked: un.id } : {}) };
      }
      this.offers = this.contractOffers(this.day + 1); this.contractPick = null;
    }
  }
  // The night so far (awards.js nightCard), for the report and the save.
  nightNow() {
    const n = this.night;
    return n ? nightCard({ ...n, now: this.now(), day: this.day, venue: this.venue, title: this.title() }) : null;
  }

  quotaTarget() { return this.quota ? cents(this.valueNow().rate * (1 + this.quota.q)) : null; }
  // Owner playtest 3 §1.1: the target as a whole % of the bar (the memo's `target`: 60 means 60% clean by the bell).
  quotaPct() { return this.quota ? targetPct(this.quota.q, this.ceiling()) : null; }
  // Is today a Gary day? (§6.2: builder 4's garyDay schedule when present; until then every day from GARY.FROM_DAY.)
  garyToday() { return !this.endless && this.venue !== 5 && (this.garyDay != null ? this.garyDay === this.day : this.day >= GARY.FROM_DAY); }
  // The Closing Bell (round 6 #3): the single biggest shortfall at Last Call, as one line (null when endless).
  rallyNeed(kpi = this.mods.kpi(), margin = UPKEEP_MARGIN) {
    const value = this.valueNow();
    // Forecast the rush (playtest 2: "On target", then DENIED): Last Call swings x1.5, so read the gauge with a margin.
    const ahead = kpi == null ? null : kpi - (RALLY_MARGIN[this.venue] ?? 0.1);
    // Playthrough 3 #3: and Upkeep too ("On target" only with UPKEEP_MARGIN to spare for the x1.5 scuff).
    return shortfall({ value, quota: this.quota, kpi: ahead, fixtures: this.fixtures, venue: this.venue, endless: this.endless, margin });
  }
  // Round 7 #4: the rally dealt round the crew. { need: the top line (solo, old clients), needs: { ratId: line } }.
  // prev: the last deal (playthrough 3 #4: the 30 s re-check keeps each Rat's line while its job is still short).
  // Owner playtest 3 §2: the cleanup deal (T-60) passes margin 0 and left (the balls out there: 'pick' over RALLY_PICK).
  rallyNeeds(kpi = this.mods.kpi(), prev = null, { margin = UPKEEP_MARGIN, left = 0 } = {}) {
    const need = this.rallyNeed(kpi, margin);
    if (need == null) { this.rallyDeal = null; return { need }; }
    const ahead = kpi == null ? null : kpi - (RALLY_MARGIN[this.venue] ?? 0.1);
    const jobs = shortfalls({ value: this.valueNow(), quota: this.quota, kpi: ahead, fixtures: this.fixtures, venue: this.venue, endless: this.endless, cups: this.mods.state('tiered')?.cups, margin, left });
    if (this.venue === 1 && need === RALLY_LINES.onTarget) {   // council round 10 #2/#5: the Club's dusk always deals jobs
      const glow = [...this.balls.values()].filter(b => b.creek && b.kind === 'glow');
      const glowAt = glow.length ? { x: glow.reduce((a, b) => a + b.x, 0) / glow.length, z: glow.reduce((a, b) => a + b.z, 0) / glow.length } : null;
      const dusk = clubDuskJobs({ value: this.valueNow(), fixtures: this.fixtures, left: left || this.ballsLeft(), glowSnags: glow.length, glowAt });
      if (dusk.length) {
        const needs = dealJobs(dusk, this.online().map(p => ({ id: p.id, x: p.x, z: p.z })), undefined, prev);
        this.rallyDeal = needs;
        return { need: dusk[0].line, needs };
      }
    }
    if (left > RALLY_PICK && need === RALLY_LINES.onTarget) {   // on target, balls out there: everyone picks
      const needs = Object.fromEntries(this.online().map(p => [p.id, RALLY_LINES.pick]));
      this.rallyDeal = needs;
      return { need: RALLY_LINES.pick, needs };
    }
    const needs = dealJobs(jobs, this.online().map(p => ({ id: p.id, x: p.x, z: p.z })), undefined, prev);
    this.rallyDeal = needs;
    return { need, needs };
  }
  // Playthrough 3 #2: the T-30 re-check at the Stadium reads the LIVE crowd (less the margin), not the graded 2-minute
  // mean, so Rats lapping at 100% live aren't told the crowd is bored. Live fine, graded still short: "Keep lapping!".
  // Playthrough 3 #4: the re-check keeps the last deal's lines that are still short (rallyDeal) and deals only new jobs.
  // Owner playtest 3 §2: this is the cleanup deal at T-60 (margin 0, 'pick'); Tiered's bowls are judged then, so its
  // gauge is no longer a job (kpi null: only the Upkeep terms are dealt).
  recheckNeeds() {
    const live = this.venue === 3 ? this.mods.state('stadium')?.s : null;
    const prev = this.rallyDeal ?? null;
    const opt = { margin: 0, left: this.ballsLeft() };
    if (live == null) return this.rallyNeeds(this.venue === 2 ? null : undefined, prev, opt);
    const r = this.rallyNeeds(live, prev, opt);
    if ((r.need == null || r.need === RALLY_LINES.onTarget) && !gaugeHolds(this.mods.kpi())) {
      const need = RALLY_LINES.keepLapping;
      return { need, needs: Object.fromEntries(this.online().map(p => [p.id, need])) };
    }
    return r;
  }

  // The clock holds for venue reveals and for the Last Bucket's moment.
  // Round 7 #5: while the crew clears the sky ('sky') the clock runs, so the Lift and the tether work.
  paused() { return this.revealT > 0 || (this.lastBucket && this.lastBucket.phase !== 'done' && this.lastBucket.phase !== 'sky'); }

  // Super-bouncy balls don't want to be picked up: get close and they hop away.
  stepBouncy() {
    for (const b of this.balls.values()) {
      if (b.kind !== 'bouncy' || !b.rest || b.sunk || (b.hops ?? 0) >= 4) continue;
      for (const p of this.players.values()) {
        const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz);
        if (d > 2.6 || d < 0.01 || this.driving(p)) continue;
        b.rest = false; b.acc = 0; b.hops = (b.hops ?? 0) + 1;
        b.vx = dx / d * 3.5; b.vz = dz / d * 3.5; b.vy = 3;
        this.events.push({ t: 'kick', id: b.id, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz });
        break;
      }
    }
  }

  // ---- the snack shed ------------------------------------------------------------
  // Round 11: the warm tray. Dogs go cold after TRAY.HOLD_SECS; once FED has room, whoever walks past takes one out.
  stepTray(dt) {
    if (!this.tray.dogs.length) return;
    if (trayTick(this.tray, dt)) this.dirty = true;
    if (!trayWanted(this.tray, this.fedSt.fed)) return;
    for (const p of this.players.values()) {
      if (p.online <= 0 || p.down > 0 || p.diving || this.driving(p) || !atShed(p)) continue;
      const q = trayTake(this.tray), gain = fedServe(this.fedSt, q);
      this.dirty = true;
      this.events.push({ t: 'tray', on: false, by: p.id, n: this.tray.dogs.length, fed: this.fedSt.fed, gain });
      return;
    }
  }

  // The kitchen minigame: fries, hot dogs and beer. The client plays it, the server rate-limits it.
  serve(p, a) {
    const now = this.now();
    if (this.phase !== 'shift' || !this.perks.shed || !atShed(p) || p.down > 0 || this.driving(p)) return false;   // playthrough 5 B8: no beer pays in the lobby
    if (now - (p.servedAt ?? 0) < FRIES.SERVE_MIN_SECS * 1000) return false;
    p.servedAt = now;
    const item = menuFor(this.venue).includes(a.item) ? a.item : 'fries';   // a locked item can't be served
    const q = ['perfect', 'good', 'burnt'].includes(a.quality) ? a.quality : 'burnt';
    let n = yieldFor(item, q, !!a.onePeel);
    const { fed, take } = garyEats(this.gary, item, q);
    if (fed) { this.gary.fed = true; n = Math.max(0, n - take); this.events.push({ t: 'garyFed', by: p.id }); this.dirty = true; }
    this.stats.served = (this.stats.served ?? 0) + 1;
    if (item === 'beer') this.stats.beers = (this.stats.beers ?? 0) + (q === 'burnt' ? 0 : 1);   // the report's beer count (the deck itself is server/venues/deck.mjs)
    // Council round 10 #2: a dog FEDs the crew (Gary's gives none: Gary ate it). The float says what the serve paid.
    const vBefore = this.valueNow(), stockBefore = this.fries;
    const fedGain = item === 'hotdog' && !fed ? fedServe(this.fedSt, q) : 0;
    if (item === 'hotdog' && !fed && q !== 'burnt') this.stats.dogs = (this.stats.dogs ?? 0) + 1;
    if (fedGain) this.dirty = true;
    if (item === 'hotdog' && !fed && trayServe(this.tray, q, fedGain)) { this.dirty = true; this.events.push({ t: 'tray', on: true, by: p.id, n: this.tray.dogs.length }); }   // round 11: a spare dog waits on the tray
    const float = serveFloat(item, q, { v: vBefore, stockBefore, fedGain });
    this.events.push({ t: 'served', by: p.id, item, quality: q, n, ...(fedGain ? { fed: this.fedSt.fed } : {}), ...(float ? { float } : {}) });
    if (n) { this.addFries(n, p.id); p.shift.cooked += n; }
    this.mods.call('serve', p, { item, quality: q, n, ahead: a.ahead === true });   // round 11: ahead = pour a cold mug (deck.mjs)
    return true;
  }
  addFries(n, by) {
    if (this.fries >= FRIES.MAX) return;
    this.fries = Math.min(FRIES.MAX, this.fries + n);
    this.stats.fries = (this.stats.fries ?? 0) + n; this.dirty = true;
    this.events.push({ t: 'fries', by, stock: this.fries });
  }

  // ---- the pond (opens with the Range Club) ------------------------------------------
  sunkCount() { let n = 0; for (const b of this.balls.values()) if (b.sunk) n++; return n; }

  sink(b) {
    if (this.sunkCount() >= POND.MAX_SUNK) { this.balls.delete(b.id); this.events.push({ t: 'gone', id: b.id }); return; }
    b.sunk = true; b.rest = true; b.vx = b.vy = b.vz = 0; b.y = bedAt(b.x, b.z);
    if (sinksDeep(b.kind)) { const s = deepEndSpot(this.rng); b.x = s.x; b.z = s.z; b.y = s.y; }   // lead and gold roll into the Deep End
    this.events.push({ t: 'sink', id: b.id, x: b.x, z: b.z, kind: b.kind });
  }

  // A ball at a random spot on the bottom (from a save, or spilled from a gasping diver's bag).
  sinkNew(kind, near = null) {
    const a = this.rng() * Math.PI * 2, r = Math.sqrt(this.rng()) * (near ? 1.5 : POND.r - 0.8);
    const cx = near?.x ?? POND.x, cz = near?.z ?? POND.z;
    let x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, y;
    if (sinksDeep(kind)) { const s = deepEndSpot(this.rng); x = s.x; z = s.z; y = s.y; }
    else if (!inPond({ x, z })) return this.sinkNew(kind);
    else y = bedAt(x, z);
    const b = this.addBall({ x, y, z, vx: 0, vy: 0, vz: 0, kind });
    if (b) { b.sunk = true; b.rest = true; this.events.push({ t: 'sink', id: b.id, x, z, kind }); }
  }

  // Council round 10 #5: a ball spilled from a gasping creek diver's bag rests on the creekbed beside them.
  snagNew(kind, near) {
    const q = creekProject(near.x, near.z), a = this.rng() * 2 - 1, off = a * (MAP.CREEK.HW - 0.5);
    const p = creekPoint(q.branch, Math.max(0, q.s + (this.rng() - 0.5) * 2));
    const b = this.addBall({ x: p.x - p.dz * off, y: CREEK_DIVE.BED + SIM.BALL_R, z: p.z + p.dx * off, vx: 0, vy: 0, vz: 0, kind });
    if (b) { b.rest = true; b.creek = true; this.events.push({ t: 'snag', id: b.id, x: b.x, y: b.y, z: b.z }); }
  }

  pondPickup(p, id) {
    const b = this.balls.get(id);
    if (!b || !(b.sunk || b.creek) || !p.diving || p.down > 0 || p.bag >= diveTiers(p.dive).bag) return false;   // council round 10 #5: creek snags too
    if (Math.hypot(b.x - p.x, b.z - p.z) > POND.REACH + 1) return false;
    this.balls.delete(id);
    const k = this.loadOf(b);
    p.bag += k; p.bagW += (KIND_W[b.kind] ?? 1) * k; for (let i = 0; i < k; i++) p.bagKinds.push(k === 3 ? 'range' : b.kind ?? 'range');
    this.stats.picked++; this.stats.dived = (this.stats.dived ?? 0) + 1; p.shift.dived++; this.dirty = true;
    this.events.push({ t: 'gone', id, by: p.id });
    return true;
  }

  stepPond(dt) {
    if (!this.pondOpen()) {
      for (const p of this.players.values()) p.diving = false;
      // Council round 10 §C: the field returns' pipes run at the Muni too (the pond's tube waits for the Club).
      this.tubeClock += dt;
      for (const e of tubeArrivals(this.tube, this.tubeClock)) { this.bank(e.n, e.by, e.kind ?? null, e.w, e.factor); this.events.push({ t: 'thunk', n: e.n, by: e.by }); }
      return;
    }
    // Buddy Air v2: air comes from cranking. Every pumper on the dock adds their turns (or the held-button trickle);
    // the sum goes to every diver, capped at two pumpers' worth.
    const nowMs = this.now();
    let gain = 0;
    for (const p of this.players.values()) {
      const live = p.online > 0 && onDock(p) && !p.diving;
      const turns = live ? Math.min(p.pumpTurns, PUMP.MAX_TPS * dt) : 0;
      p.pumpTurns = live ? Math.max(0, p.pumpTurns - turns) : 0;
      const held = live && p.pumpHeld;
      p.pumping = live && (held || nowMs - p.pumpAt < 400);
      if (live) gain += pumpGain({ turns, held: held && turns === 0, dt });
    }
    gain = Math.min(gain, PUMP.MAX_TPS * PUMP.SECS_PER_TURN * 2 * dt);
    this.tubeClock += dt;
    for (const p of this.players.values()) {
      // Council round 10 #5: 2 s in the running creek and you duck under; out of the channel sideways, you surface.
      creekStep(p, dt, this.world(), this.driving(p) || !!p.one);
      const wet = (inPond(p) || !!p.creekDiving) && !this.driving(p) && !p.one;
      if (wet !== p.diving) {
        p.diving = wet;
        const up = p.bag;
        if (!wet && p.bag > 0) {   // surfaced with the bag: it's yours to bank
          p.pocket += p.bag; p.pocketW = (p.pocketW ?? 0) + p.bagW; p.bag = 0; p.bagW = 0; p.bagKinds = [];
        }
        this.events.push({ t: 'dive', id: p.id, on: wet, bag: wet ? 0 : up, ...(wet && p.creekDiving ? { creek: true } : {}) });
      }
      const tier = diveTiers(p.dive);
      if (p.treasure && p.down > 0) this.dropTreasure(p);      // a knockdown drops it at your feet
      const breath = breathMul(p, dt);   // round 11: after a creek dive, walking to the next snag refills air ×3
      if (p.diving) {
        const inCreek = !!p.creekDiving;   // the snorkel breaks the surface: air x0.5, and no pump in the creek
        p.lastCreek = inCreek;
        const st = airStep({ air: p.air, dt: inCreek ? creekAir(dt) : dt, tier, x: p.x, z: p.z, gain: inCreek ? 0 : gain });
        p.air = st.air;
        if (st.gasp && inCreek) {   // out of air in the creek: up on the nearest bank, the bag spills back onto the creekbed there
          for (const k of p.bagKinds) this.snagNew(k, p);
          if (p.treasure) { this.dropTreasure(p, true); }
          p.bag = 0; p.bagW = 0; p.bagKinds = []; p.air = tier.air * 0.5; p.diving = false; p.creekDiving = false; p.creekT = 0;
          const q = bankSpot(p.x, p.z); p.x = q.x; p.z = q.z; p.movedAt = this.now();
          this.events.push({ t: 'gasp', id: p.id, creek: true, x: +p.x.toFixed(2), z: +p.z.toFixed(2) }, { t: 'dive', id: p.id, on: false });
        } else if (st.gasp) {             // out of air: pop up coughing on the dock, the bag spills back down (kinds kept); a bag on the line is safe
          for (const k of p.bagKinds) this.sinkNew(k, p);
          if (p.treasure) { this.dropTreasure(p, true); }
          p.bag = 0; p.bagW = 0; p.bagKinds = []; p.air = tier.air * 0.5; p.diving = false;
          p.x = POND.DOCK.x; p.z = POND.DOCK.z + 1.5; p.movedAt = this.now();
          this.events.push({ t: 'gasp', id: p.id }, { t: 'dive', id: p.id, on: false });
        }
      } else p.air = Math.min(tier.air, p.air + POND.AIR_REFILL * dt * Math.max(1, tier.air / POND.AIR) * breath);
    }
    // The pneumatic tube: balls fed in arrive at the stand 6 s later, at the gear factor they were fed with.
    for (const e of tubeArrivals(this.tube, this.tubeClock)) {
      this.bank(e.n, e.by, e.kind ?? null, e.w, e.factor);   // a drone's load banks as helper balls (council round 10 §C)
      this.events.push({ t: 'thunk', n: e.n, by: e.by });
    }
    // The pond pump (crew row, tier 2): clears one sunk ball into the tube every 8 s, all shift.
    if (this.phase === 'shift' && hasPondPump(this.up)) {
      for (let k = pondPumpStep(this.tube, dt); k > 0; k--) {
        const b = [...this.balls.values()].find(o => o.sunk && o.kind !== 'one');
        if (!b) break;
        this.balls.delete(b.id); this.events.push({ t: 'gone', id: b.id });
        const w = KIND_W[b.kind] ?? 1;
        tubeFeed(this.tube, this.tubeClock, { n: 1, w, factor: 1 });
        this.tube.q.at(-1).by = 'pump';
        this.stats.picked++; this.dirty = true;
      }
    }
  }

  // {t:'pump', turns, held} (or the old {on}): turns are crank turns since the last message.
  pumpInput(p, a) {
    if (!onDock(p) || p.diving) { p.pumping = false; p.pumpHeld = false; p.pumpTurns = 0; return; }
    const turns = Number(a.turns);
    if (Number.isFinite(turns) && turns > 0) { p.pumpTurns = Math.min(1, p.pumpTurns + Math.min(turns, 1)); p.pumpAt = this.now(); }
    p.pumpHeld = !!(a.held || a.on);
    p.pumping = p.pumpHeld || this.now() - p.pumpAt < 400;
  }

  // Ⓧ underwater: clip the bag to the line.
  sendBagUp(p) {
    if (!canSend(p)) return false;
    const n = sendBag(p, this.line);
    this.events.push({ t: 'sent', id: p.id, n }); this.dirty = true;
    return true;
  }

  // Ⓧ held on the dock: land the whole line into your pocket (capacity ignored, like surfacing).
  haulInput(p, a) {
    if (p.down > 0 || p.diving || !onDock(p) || this.line.n <= 0 || a.held === false) { p.haulHeld = 0; return false; }
    const now = this.now();
    // `secs` is how long the client has held the button; the server also caps it by its own clock.
    const own = p.haulAt && now - p.haulAt < 1000 ? p.haulHeld + (now - p.haulAt) / 1000 : 0;
    p.haulAt = now;
    p.haulHeld = Math.min(Number.isFinite(+a.secs) ? +a.secs : own, own + 0.3);
    if (!haulReady(p.haulHeld)) return false;
    const got = takeLine(this.line);
    p.pocket += got.n; p.pocketW = (p.pocketW ?? 0) + got.w; p.haulHeld = 0; p.haulAt = 0; this.dirty = true;
    this.events.push({ t: 'hauled', id: p.id, n: got.n });
    return true;
  }

  // Ⓧ at the red box on the dock, or (council round 10 §C) on foot at a field return the crew owns: your carried balls
  // (and any treasure) go in the pipe and THUNK into the main return 6 s later, through the washer like any bank.
  // Teenagers and the cart never come here; drones feed the same queue (county.mjs).
  feedTube(p) {
    const field = p.down > 0 || p.diving || this.driving(p) ? null : atFieldReturn(p, this.perks.returns);
    if (p.down > 0 || p.diving || (!field && (!hasTube(this.up) || !atTube(p)))) return false;
    if (p.treasure) this.bankTreasure(p);
    if (p.pocket <= 0) return true;
    tubeFeed(this.tube, this.tubeClock, { n: p.pocket, w: p.pocketW ?? p.pocket, factor: 1 });
    this.tube.q.at(-1).by = p.id;
    p.pocket = 0; p.pocketW = 0; this.dirty = true;
    this.events.push({ t: 'tube', id: p.id, ...(field ? { at: field.id, n: this.tube.q.at(-1).n } : {}) });   // round 11: n, the batch's size (the whoosh)
    return true;
  }

  // ---- treasure (Lost & Found) ----
  // Mornings: at most one treasure a shift, a 50% roll, from the Club on.
  rollTreasureToday() {
    for (const p of this.players.values()) if (p.treasure) this.dropTreasure(p, true);   // anything still carried goes back down
    if (this.treasure || !this.pondOpen()) return;
    // Council round 10 #1: while the card's treasure goal is open, the 50% roll always lands (the same one RNG draw).
    const t = rollTreasure(this.lostFound, this.venue, this.goalOpen('treasures') ? () => (this.rng(), 0) : this.rng);
    if (!t) return;
    const s = treasureSpotFor(this.treasureSeed + this.lostFound.length, t.id);   // council round 10 #5: the trophy lies under the Cart Bridge
    this.treasure = { id: t.id, x: s.x, z: s.z };
    this.events.push({ t: 'treasure', id: t.id, phase: 'sunk' });
  }

  treasurePickup(p) {
    const t = this.treasure;
    if (!t || !p.diving || p.down > 0 || p.treasure || p.one) return false;
    if (Math.hypot(t.x - p.x, t.z - p.z) > POND.REACH + 1) return false;
    p.treasure = t.id; this.treasure = null; this.dirty = true;
    this.events.push({ t: 'treasure', id: t.id, phase: 'carried', by: p.id });
    return true;
  }

  // Put a carried treasure back: at the carrier's feet (knockdown) or in the Deep End (gasp / the bell).
  dropTreasure(p, deep = false) {
    if (!p.treasure) return;
    const id = p.treasure; p.treasure = null;
    if (this.treasure) return;       // (only one lies down there at a time)
    let x, z;
    if (!deep && inPond(p)) { x = p.x; z = p.z; }
    else { const s = treasureSpotFor(this.treasureSeed + this.lostFound.length, id); x = s.x; z = s.z; }
    this.treasure = { id, x, z }; this.dirty = true;
    this.events.push({ t: 'treasure', id, phase: 'sunk' });
  }

  // At the stand (or the tube): the finder's fee, 200 x BV, "as a gesture", and the case gets the item.
  bankTreasure(p) {
    const id = p.treasure;
    if (!id || !TREASURE_BY_ID[id]) return false;
    p.treasure = null;
    if (!this.lostFound.includes(id)) this.lostFound.push(id);
    const fee = cents(finderFee(id, this.valueNow().bv));
    this.cash = cents(this.cash + fee); this.stats.cash = cents(this.stats.cash + fee); this.dirty = true;
    p.shift.cash = cents(p.shift.cash + fee); p.shift.treasures = (p.shift.treasures ?? 0) + 1;   // round 11: the night's treasures
    this.events.push({ t: 'treasure', id, phase: 'banked', by: p.id, fee });
    this.pa('treasure', { once: true });
    return true;
  }

  // ---- Gary from Regional --------------------------------------------------------
  garyStops() {
    const stops = [...GARY.STOPS];
    if (this.venue >= 1) stops.splice(stops.length - 1, 0, { id: 'kitchen', x: FRIES.SHED.x, z: FRIES.SHED.z + 0.5 });
    return stops;
  }

  // Seconds until Gary reaches the stand, for the Board's GARY 3 · 2 · 1 (playtest round 2 #2): the legs still to
  // drive at GARY.SPEED plus the pauses still to sit. Playthrough 3 #2: only the last GARY_COUNT (5) seconds, so the
  // count lasts ~5 s at every venue, cart or no cart; null before then, or when he isn't driving.
  garyEta() {
    const g = this.gary;
    if (!g || g.phase !== 'drive') return null;
    const stops = this.garyStops();
    let t = Math.max(0, g.pause), x = g.x, z = g.z;
    for (let i = g.stop; i < stops.length; i++) {
      const st = stops[i];
      if (st.id === 'cart' && !this.cart) continue;
      const c = st.id === 'cart' ? (g.cart ?? this.muddiestCart()) : null;
      const tx = c ? c.x + 3 : st.x, tz = c ? c.z + 3 : st.z;
      t += Math.max(0, Math.hypot(tx - x, tz - z) - 0.3) / GARY.SPEED + (st.id === 'stand' ? 0 : GARY.PAUSE);
      x = tx; z = tz;
    }
    return t > GARY_COUNT ? null : t;
  }

  // { eta, span } for the snapshot: span is the eta when the count began, so the client splits it into 3 · 2 · 1.
  garyEtaWire() {
    const eta = this.garyEta(), g = this.gary;
    if (eta == null) { if (g) g.span = null; return {}; }
    if (!g.span) g.span = eta;
    return { eta: +eta.toFixed(2), span: +g.span.toFixed(2) };
  }

  // Owner playtest 3 §6.1: the once-ever drive-by at 0:20 on Muni day 4, with the PA card.
  stepGaryIntro(dt) {
    if (!this.garyIntro) {
      if (!introDue({ day: this.day, venue: this.venue, endless: this.endless, shiftT: this.shiftT, voiced: this.voiced.has('garyIntro') })) return;
      this.garyIntro = newIntro();
      this.pa('garyIntro', { once: true, big: true });
    }
    if (this.garyIntro.done) return;
    const e = stepIntro(this.garyIntro, dt);
    this.dirty = true;
    if (e === 'wave') this.events.push({ t: 'garyIntro', phase: 'wave' });
  }
  stepGary(dt) {
    if (this.phase !== 'shift' || this.endless || this.paused()) return;
    this.stepGaryIntro(dt);
    this.stepPromoRide(dt);   // round 11: Promotion Day's ride-along
    if (this.garyDay !== this.day) return;   // owner playtest 3 §6.2: every 2–3 days (garyDay), from Muni day 4 (the Orbital too)
    const g = this.gary;
    if (!g) {
      if (this.shiftT >= this.shiftSecs * GARY.AT) {
        // Playthrough 4 A18: solo, he inspects only the two muddiest mats in play (named now) and warns for longer.
        const solo = this.onlineCount() === 1;
        this.gary = { phase: 'warn', t: solo ? GARY.SOLO_WARN : GARY.WARN_SECS, x: GARY.START.x, z: GARY.START.z, yaw: Math.PI / 2, stop: 0, pause: 0, fails: 0, checks: [], stalls: 0,
          ...(solo ? { mats: this.muddiestMats(GARY.SOLO_MATS) } : {}) };
        this.events.push({ t: 'gary', phase: 'warn' });
        this.pa('gary', { once: true });
      }
      return;
    }
    // Owner playtest 3 §6.3: a Rat holding Ⓐ within CHAT_R of him while he's parked keeps him talking (garyvisit.js).
    const chatWas = !!g.chat;
    for (const e of stepChat(g, this.online().map(p => ({ id: p.id, x: p.x, z: p.z, held: !!p.chatHeld && !this.driving(p) && !p.diving, down: p.down })), dt)) this.events.push(e);
    if (chatWas || g.chat) this.dirty = true;
    if (g.phase === 'warn') {
      if ((g.t -= dt) <= 0) { g.phase = 'drive'; g.t = 0; this.events.push({ t: 'gary', phase: 'drive' }); }
      return;
    }
    if (g.phase !== 'drive') return;
    if (g.pause > 0) { g.pause -= dt; return; }
    const stops = this.garyStops();
    let stop = stops[g.stop];
    if (stop?.id === 'cart' && !this.cart) { g.stop++; stop = stops[g.stop]; }
    if (!stop) return;
    // Gary checks the muddier cart (the fleet), picked once at the leg's start. Playthrough 5 C1: an autopilot cart he's
    // heading for waits for him (garyHolds, stadium.mjs), and a leg that runs past GARY_CART_LEG (a Rat driving it about)
    // ends where he is: he inspects that cart anyway, so every visit reaches a verdict.
    if (stop.id === 'cart' && !g.cart) { g.cart = this.muddiestCart(); g.legT = 0; }
    if (stop.id === 'cart') g.legT = (g.legT ?? 0) + dt;
    const tx = stop.id === 'cart' ? g.cart.x + 3 : stop.x, tz = stop.id === 'cart' ? g.cart.z + 3 : stop.z;
    const dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz), step = GARY.SPEED * dt;
    if (d > 0.3 && !(stop.id === 'cart' && g.legT > GARY_CART_LEG)) {
      const k = Math.min(1, step / d);
      g.x += dx * k; g.z += dz * k; g.yaw = Math.atan2(-dx, -dz);
      for (const o of [...this.players.values(), ...this.helpers]) {     // he drives like he owns the place
        if (stop.id === 'stand') break;          // ...except into the huddle he asked for (playtest)
        if (o.down > 0 || this.driving(o) || this.aloft(o)) continue;
        if ((g.spare ?? []).includes(o.id)) continue;   // owner playtest 3 §6.3: nor over a Rat he chatted to
        if (Math.hypot(o.x - SIM.STAND.x, o.z - SIM.STAND.z) < GARY.HUDDLE_R) continue;   // nor over anyone in the ring (round the return), on any leg (playtest round 2 #2)
        if (Math.hypot(o.x - g.x, o.z - g.z) < 1.3) { this.knockDown(o, 'gary'); this.stats.runOver++; }
      }
      return;
    }
    // Arrived: inspect.
    const ok = this.inspect(stop.id);
    if (stop.id !== 'stand' && !ok) g.fails++;
    g.checks.push({ stop: stop.id, ok });
    this.events.push({ t: 'check', stop: stop.id, ok, x: g.x, z: g.z });
    g.pause = GARY.PAUSE; g.stop++;
    if (stop.id === 'stand') {
      const fails = g.fails + (ok ? 0 : 1);
      const online = this.online();
      const now = this.now();
      const huddle = online.length > 0 && online.every(p => Math.hypot(p.x - SIM.STAND.x, p.z - SIM.STAND.z) < GARY.HUDDLE_R || now - (p.movedAt ?? now) > HUDDLE_IDLE_MS);   // the huddle is at the return
      // Owner playtest 3 §6.2/6.4: a pass with the full huddle earns 3 commendations (1 without) and Gary's Seal:
      // every ball pays ×1.25 until the bell. The next visit is 2 or 3 days on.
      const gained = commendFor({ pass: fails <= 1, huddle, have: this.commendations });
      const seal = fails <= 1 && huddle;
      if (seal) this.seal = GARY.SEAL;
      this.commendations += gained;
      this.garyDay = garyNext(this.day, this.treasureSeed);
      // Council round 10 #1: the card's Gary goals (the Muni's huddle, the Club's Seal, the County's pass). While one is
      // still open after his visit, he comes back tomorrow ("Gary will be back tomorrow.").
      if (huddle && fails <= 1) this.goalTick('huddle');   // playthrough 5 A2: "Pass Gary with a huddle"
      if (seal) this.goalTick('seal');
      if (fails <= 1) this.goalTick('pass');
      if (['huddle', 'seal', 'pass'].some(id => this.goalOpen(id))) { this.garyDay = this.day + 1; this.garyBack = true; }
      g.phase = 'done'; g.chat = null;
      this.dirty = true;
      const moweWon = this.venue === 1 && !!this.moweSt.beat; if (moweWon) this.moweSt.beat = false;   // round 12 (builder 1, for builder 3's GARY_BYE_MOWE): once, at his next Club verdict
      this.events.push({ t: 'verdict', fails, huddle, gained, commendations: this.commendations, ...(seal ? { seal: GARY.SEAL } : {}), ...(moweWon ? { moweWon } : {}) });
      if (gained && huddle) this.pa('huddle', { chance: 1 / 3 });
    }
  }

  // ---- MOW-E (council round 3 §3.5; council round 11 #1, builder 1: the boss, the tame pet, MOW-E 2.0) ------------
  // Rules live in web/js/mowe.js (pure). this.moweSt is the save's { tame, lost, encore }; this.mower is today's state:
  // a boss ({ kind: 'boss' }), a tame pass ({ kind: 'tame' }), or (BOSS.ON = 0) the legacy daily pass.
  // Today's boss, if any: 'club' (the fight, or its rematch), 'encore' (the Stadium's MOW-E 2.0) or null.
  bossToday() { return bossDay({ venue: this.venue, venueDay: this.venueDay, endless: this.endless, promo: isPromotionDay(this), st: this.moweSt }); }
  stepMowe(dt) {
    if (!BOSS.ON) return this.stepMoweLegacy(dt);
    if (this.phase !== 'shift') { if (bossLive(this.mower)) this.moweLose(); return; }   // the bell (or a clock-out) mid-fight is a loss: never stuck
    if (this.endless || this.paused()) return;
    const st = this.moweSt;
    const m = this.mower;
    if (!m && bossDue({ venue: this.venue, venueDay: this.venueDay, endless: this.endless, promo: isPromotionDay(this), st, shiftT: this.shiftT, shiftSecs: this.shiftSecs })) return this.moweStart();
    if (!m || (m.kind === 'tame' && m.phase === 'done')) {
      const next = !m ? 0 : m.bonus ? m.k : m.k + 1;   // round 12 #5d: the whistle's bonus pass doesn't use up a scheduled one
      if (this.whistleQ) { this.whistleQ = false; this.mower = newTame(this.balls, next, { bonus: true }); this.dirty = true; return; }
      const k = tameDue({ venue: this.venue, endless: this.endless, tame: st.tame && !this.bossToday(), shiftT: this.shiftT, shiftSecs: this.shiftSecs, k: next });
      if (k >= 0) { this.mower = newTame(this.balls, k); this.dirty = true; }
      return;
    }
    if (m.kind === 'tame') return this.stepTamePass(dt);
    if (m.kind === 'boss') return this.stepBossFight(dt);
  }
  moweWeigh(b) { return (KIND_W[b.kind] ?? 1) * ballMul(b); }
  moweStart() {
    const encore = this.bossToday() === 'encore';
    const m = this.mower = newBoss({ n: this.onlineCount(), encore, lost: encore ? 0 : this.moweSt.lost });
    m.cap = Math.min(BOSS.CAP, Math.max(30, this.shiftSecs * (1 - BOSS.AT) - BOSS.WARN - 20));   // a short (dev) shift still ends the fight before the bell
    this.events.push({ t: 'mower', phase: 'warn', boss: true, encore, hp: m.hpMax });
    this.pa(encore ? 'rogue2' : 'rogue', { big: true });   // the build-up's one centre text (its caption)
    this.dirty = true;
  }
  stepBossFight(dt) {
    const m = this.mower;
    if (bossLive(m)) this.lookUntil = this.moweLookUntil = Math.max(this.lookUntil ?? 0, this.custT + 1);   // customers' balls can't flatten a Rat (or, 9.10, a helper) mid-fight
    const rats = [];
    for (const p of this.players.values()) rats.push({ id: p.id, x: p.x, z: p.z, down: p.down, driving: this.driving(p), diving: !!p.diving, aloft: this.aloft(p), online: p.online > 0, holding: !!p.holding });
    const r = stepBoss(m, dt, { balls: this.balls, rats, carts: this.carts, weigh: b => this.moweWeigh(b) });
    for (const id of r.eaten) { this.balls.delete(id); this.events.push({ t: 'gone', id, by: 'mower' }); }
    if (r.eaten.length) this.dirty = true;
    for (const id of r.knocked) {
      const p = this.players.get(id);
      if (!p || p.down > 0) continue;
      if (p.pocket > 0) {   // a flattened Rat's pocket goes in the catcher (up to BOSS.SPILL; the rest goes everywhere, as ever)
        const k = Math.min(BOSS.SPILL, p.pocket, Math.max(0, BOSS.CATCHER - m.eaten)), w = (p.pocketW ?? p.pocket) * k / p.pocket;
        m.eaten += k; m.eatenW += w; p.pocket -= k; p.pocketW = Math.max(0, (p.pocketW ?? 0) - w);
      }
      this.knockDown(p, 'mower'); this.stats.runOver++;
      p.shift.mowed = (p.shift.mowed ?? 0) + 1;
    }
    if (r.shove) {
      const c = this.carts.find(k => k.i === r.shove.i);
      if (c) {
        c.x += r.shove.dx; c.z += r.shove.dz; keepInField(c, 6); c.mud = Math.min(1, (c.mud ?? 0) + BOSS.SHOVE_MUD);
        const d = c.driver && this.players.get(c.driver); if (d) { d.x = c.x; d.z = c.z; }
        this.events.push({ t: 'moweShove', cart: c.i, x: c.x, z: c.z }); this.dirty = true;
      }
    }
    if (r.honk) this.events.push({ t: 'honk', boss: true });
    if (r.target !== undefined) this.events.push({ t: 'moweTarget', id: r.target });
    if (r.yank) this.events.push({ t: 'moweYank', plug: m.plug, holders: m.holders });   // round 12 #1c: the lurch (creak, ring jerk)
    if (r.phase) this.moweFightPhase(r.phase, r.reboot);
    if (r.sunk) { this.events.push({ t: 'mower', phase: 'pond', encore: m.encore }); this.pa('pond', { big: true }); }   // round 12 #5b: on the splash
    if (r.home) this.events.push({ t: 'mower', phase: 'home', encore: m.encore });
  }
  moweFightPhase(ph, reboot = false) {
    const m = this.mower;
    this.dirty = true;
    if (ph === 'tamed') return this.moweWin();
    if (ph === 'fled') return this.moweLose();
    this.events.push({ t: 'mower', phase: ph, boss: true, encore: m.encore, ...(reboot ? { reboot: true } : {}) });
  }
  // A spray on the grille (wash()'s 'mower' target). True when it landed (from behind, in reach).
  moweHose(p, secs, reach) {
    const m = this.mower;
    if (m?.kind !== 'boss' || p.down > 0 || this.driving(p)) return false;
    const r = hoseBoss(m, p, secs, { rate: this.perks.washRate ?? 1, reach });
    if (!r.ok) return false;
    if (r.hit) {
      p.shift.moweHits = (p.shift.moweHits ?? 0) + 1;   // the night's MOW-E Wrangler (awards.js)
      this.events.push({ t: 'moweHit', by: p.id, hp: r.hp, x: m.x, z: m.z });
      if (r.phase) this.moweFightPhase(r.phase);
      this.dirty = true;
    }
    return true;
  }
  // The win (council round 12 #5b): the catcher bursts on the spot (every eaten ball a MOW-E ball worth ×2, within 8 m
  // of the ring; the bell banks leftovers ×1), a gold ball a Rat within 6 m of the ring, the bounty, +1 commendation.
  moweWin() {
    const m = this.mower, pay = bossPayout(m), v = this.valueNow(), at = m.burstAt ?? { x: m.x, z: m.z };
    this.moweSt.tame = true;
    if (m.encore) this.moweSt.encore = true; else { this.moweMemo = BOSS_LINES.regards; this.moweSt.beat = true; }   // beat: Gary saw it (his next Club sign-off)
    const bounty = this.payCash(payFor(pay.bounty, v, (v.seal ?? 1) * (v.fed ?? 1)));
    this.lookUntil = this.moweLookUntil = Math.max(this.lookUntil ?? 0, this.custT + 4);   // the fountain never flattens anyone
    const mul = m.eaten > 0 ? BOSS.PAYX * m.eatenW / m.eaten : BOSS.PAYX, GA = 2.39996;   // the golden angle: an even spread, no RNG
    for (let i = 0; i < m.eaten; i++) {   // horizontal 1.2–3.0 m/s, up 5.5 m/s: ~1.1 s of flight, so they land 1.5–4 m out
      const a = i * GA, sp = 1.2 + 1.8 * ((i * 0.618) % 1);
      this.addBall({ x: at.x, y: 1.0, z: at.z, vx: Math.cos(a) * sp, vy: 5.5, vz: Math.sin(a) * sp, kind: 'range', mul, mowe: true });
    }
    for (let i = 0; i < pay.gold; i++) {   // the gold: a ring of arcs round the plug
      const a = i / Math.max(1, pay.gold) * Math.PI * 2 + 0.4, sp = 1.6;
      this.addBall({ x: at.x, y: 1.2, z: at.z, vx: Math.cos(a) * sp, vy: 4.5, vz: Math.sin(a) * sp, kind: 'gold' });
    }
    this.commendations = Math.min(GARY.COMMEND_CAP, this.commendations + 1);
    const top = Object.entries(m.by).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    this.events.push({ t: 'mower', phase: 'tamed', boss: true, encore: m.encore, eaten: m.eaten, eatenW: m.eatenW, n: m.eaten, bounty, gold: pay.gold, by: top, x: at.x, z: at.z });
  }
  // The bell (endShift calls this before the review): MOW-E balls nobody picked up bank ×1, so the Spotless count and
  // the report never punish a crew for cheering.
  moweBell() {
    let n = 0, w = 0;
    for (const b of this.balls.values()) if (b.mowe && !b.sunk) { n++; w += this.moweWeigh(b) / BOSS.PAYX; this.balls.delete(b.id); }
    if (n > 0) this.bank(n, null, 'mowe', w, 1, { mowe: true });
  }
  // Round 12 #5d: the whistle at the MOW-E post (once a shift): a bonus pass to the richest spot now (or right after
  // the pass that's out). 0: no pet today; 1: ready; 2: used.
  whistleState() {
    if (this.phase !== 'shift' || !whistleOpen({ tame: this.moweSt.tame, endless: this.endless, venue: this.venue, boss: !!this.bossToday() })) return 0;
    return this.whistleDay === this.day ? 2 : 1;
  }
  moweWhistle(p) {
    if (this.whistleState() !== 1 || !atPost(p) || p.down > 0 || this.driving(p)) return false;
    this.whistleDay = this.day; this.dirty = true;
    const m = this.mower;
    if (m?.kind === 'tame' && m.phase !== 'done') this.whistleQ = true;
    else if (!m || m.kind === 'tame') this.mower = newTame(this.balls, !m ? 0 : m.bonus ? m.k : m.k + 1, { bonus: true });
    this.events.push({ t: 'moweWhistle', by: p.id });
    return true;
  }
  // The loss: the eaten balls are gone (never "left out"); the rematch comes on the next Club day, a second loss tames him anyway.
  moweLose() {
    const m = this.mower, st = this.moweSt;
    if (m.phase !== 'fled') { m.phase = 'fled'; m.out = 'gone'; m.t = 0; m.goneT = 0; m.target = null; m.ring = null; }   // the bell beat it: straight home
    if (m.encore) st.encore = true;
    else {
      st.lost = Math.min(2, st.lost + 1);
      if (st.lost >= 2) { st.tame = true; m.final = true; this.moweMemo = BOSS_LINES.warranty; } else this.moweMemo = BOSS_LINES.eotm;
    }
    this.dirty = true;
    this.events.push({ t: 'mower', phase: 'fled', boss: true, encore: m.encore, kept: m.eaten, final: !!m.final });
  }
  // The tame pet's pass: it never knocks anyone down, it banks what it gathers at the nearest owned return.
  stepTamePass(dt) {
    const m = this.mower, people = [];
    for (const p of this.players.values()) if (p.online > 0 && !p.diving && !this.aloft(p)) people.push(p);
    for (const h of this.helpers) people.push(h);
    const r = stepTame(m, dt, { balls: this.balls, people, returnAt: (x, z) => nearestReturn(x, z, this.perks.returns ?? 0), weigh: b => this.moweWeigh(b) });
    for (const id of r.gathered) { this.balls.delete(id); this.events.push({ t: 'gone', id, by: 'mower' }); }
    if (r.gathered.length) this.dirty = true;
    if (r.bank) { this.bank(r.bank.n, null, 'helper', r.bank.w, 1, { mowe: true }); this.events.push({ t: 'moweBank', n: r.bank.n }); }
    if (r.beep) this.events.push({ t: 'honk', tame: true });
  }
  // The legacy daily rogue pass (council round 3 §3.5), kept for BOSS.ON = 0.
  stepMoweLegacy(dt) {
    if (this.phase !== 'shift' || this.endless || this.paused()) return;
    if (!this.mower) {
      if (mowerDue({ venue: this.venue, venueDay: this.venueDay, shiftT: this.shiftT, shiftSecs: this.shiftSecs, mower: this.mower, endless: this.endless })) {
        this.mower = newMower(this.balls, this.rng);
        this.events.push({ t: 'mower', phase: 'warn', lane: this.mower.lane });
        this.pa('mower', { once: true });
        this.dirty = true;
      }
      return;
    }
    if (this.mower.phase === 'done') return;
    const people = [...this.players.values(), ...this.helpers].filter(o => !this.aloft(o)).map(o => ({ id: o.id, x: o.x, z: o.z, down: o.down, driving: this.driving(o) }));
    const r = stepMower(this.mower, dt, { balls: this.balls, players: people, carts: this.carts, rng: this.rng });
    const ids = [];
    for (const m of r.raked) {
      const b = this.balls.get(m.id);
      if (!b || b.sunk || b.kind === 'one') continue;
      b.x = m.x; b.z = m.z; b.rest = true; b.vx = b.vy = b.vz = 0;
      ids.push(m.id);
    }
    if (ids.length) this.events.push({ t: 'rake', ids, moves: r.raked.filter(m => ids.includes(m.id)) });
    for (const id of r.knocked) {
      const o = this.players.get(id) ?? this.helpers.find(h => h.id === id);
      if (!o || o.down > 0) continue;
      this.knockDown(o, 'mower'); this.stats.runOver++;
      if (o.shift) o.shift.mowed = (o.shift.mowed ?? 0) + 1;
    }
    if (r.honk) this.events.push({ t: 'honk' });
    if (r.phaseChange) this.events.push({ t: 'mower', phase: r.phaseChange, lane: this.mower.lane });
  }

  // A stop passes on its own rule, unless a venue module vetoes it (the Upper Deck incident fails the kitchen).
  inspect(id) { return this.inspectBase(id) && !this.mods.veto('inspect', id); }
  // clean: the mud a stop may carry (playthrough 3 #1: Gary's lines clear only at GARY_SPOTLESS, nudge.js).
  inspectBase(id, clean = GARY.CLEAN) {
    const f = this.fixtures;
    if (id === 'sign') return f.sign <= clean;
    if (id === 'stand') return f.stand <= clean;
    if (id === 'cart') return !this.cart || (this.gary?.cart ?? this.muddiestCart()).mud <= clean;   // playthrough 5 C1: the cart he picked
    if (id === 'kitchen') return !!this.gary?.fed || this.fries >= FRIES.MAX * 0.5;   // Gary had a hot dog
    if (id === 'mats') {
      if (this.gary?.mats) return this.gary.mats.every(k => (f[k] ?? 0) <= clean);   // solo (playthrough 4 A18): his two mats
      const nAct = activeMats(this.onlineCount(), this.up);   // only the mats in play: solo never washes mats nobody uses
      const mats = Object.entries(f).filter(([k]) => k.startsWith('mat') && +k.slice(3) < nAct);
      return mats.filter(([, v]) => v <= clean).length >= mats.length * 0.8;
    }
    return true;
  }

  // The n muddiest mats in play (fixture ids), muddiest first.
  muddiestMats(n) {
    const nAct = activeMats(this.onlineCount(), this.up);
    return Object.entries(this.fixtures).filter(([k]) => k.startsWith('mat') && +k.slice(3) < nAct).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  }

  lastCall() {
    return this.phase === 'shift' && this.day >= LAST_CALL.FROM_DAY && this.shiftT >= this.shiftSecs - endWindows(this.shiftSecs).glow;
  }
  // Round 11 (owner): how much of the crowd is still here (dayend.js taperK): 1 all day, falling from T-3:00 to 0 at
  // T-2:00. Day 1 (training) has no taper, as it has no Last Call.
  custK() { return this.phase === 'shift' && this.day >= LAST_CALL.FROM_DAY ? taperK(this.shiftT, this.shiftSecs) : 1; }
  // Owner playtest 3 §2: the cleanup minute. From T-CLEANUP every customer walks out, no customer ball is launched,
  // and the mats stop scuffing (nobody's on them). Day 1 (training) has none, as it has no Last Call; nor has a
  // shift too short to hold both (a dev / test override under LAST_CALL.SECS + CLEANUP).
  // Council round 10 #3: one upper bay's swing timer. The same customer, gap, Last Call x3 and glow as a lower mat; no
  // lead (the pond can't take it), no scuff (no mat), never an orbit shot (orbit.mjs reads `upper`). A drunk bay sprays
  // wider: the seat's mugs widen the aim (customers.js upperLaunch).
  upperSwing(m, k, dt, lastCall, eatEvery) {
    if ((m.next -= dt) > 0) return;
    if (!matReady(m, this.custT)) { m.next = 0.5; return; }
    if (this.balls.size >= SIM.MAX_BALLS) return;
    const kind = lastCall ? 'glow' : pickKind(this.day, this.venue, this.rng, worldVday(this.venue, this.venueDay, this.endless));
    const mugs = this.mods.state('deck')?.deck?.mugs?.[k] ?? 0;
    const shot = this.mods.pipe('launchMod', { ...upperLaunch(m, this.rng, mugs), kind }, { mat: m, kind, lead: false, upper: true });
    const b = this.addBall(shot);
    if (b && kind !== 'range' && (!this.debuts.has(kind) || this.toldKinds?.has(kind))) this.debutHit(kind, b);   // council round 11 #3
    if (b && this.endless) { this.outstanding++; if (this.endlessArmed) { this.endlessArmed = false; this.outstanding = 1; } }
    m.next = swingGap(this.rng) * this.perks.swingGapMult / swingRate(this.custK(), this.day);   // round 11: the busier day, then the taper
    if (b) this.stats.launched = (this.stats.launched ?? 0) + 1;
    if (this.perks.shed && --this.swingsToEat <= 0) { this.swingsToEat = eatEvery; this.fries = Math.max(0, this.fries - 1); }
    if (b) shoot(m, this.custT);
  }

  closing() {
    return this.phase === 'shift' && this.day >= LAST_CALL.FROM_DAY && this.shiftT >= this.shiftSecs - endWindows(this.shiftSecs).cleanup;
  }
  // The balls still out there (the walk-off's "N left out there", live from 1:00; the cleanup deal's 'pick').
  ballsLeft() {
    let n = 0;
    for (const b of this.balls.values()) if (!b.sunk && !b.drifting && !b.creek && b.kind !== 'one' && !b.cup) n++;
    return n;
  }
  // The bucket basket's prompt state for one Rat (main.js shows it at the dispenser): 'fill' | 'filling' | 'full' | 'busy'.
  basketFor(p) {
    const b = this.basket;
    if (p.id in b.fill) return 'filling';
    if (b.n >= basketMax(b)) return 'full';   // round 11: Ball Shortage's 6
    return Object.keys(b.fill).length >= BUCKETS.CHUTES ? 'busy' : 'fill';
  }
  // Round 7 #7: a rally earlier than Last Call (rally.js RALLY_AT: Tiered's and the Stadium's T-3:00). Playthrough 3 #1: from the
  // venue's day 1 too (day 1 was always DENIED without it), once the reveal is over.
  warnDue() {
    // Round 11: only a venue's own early rally (RALLY_AT), and only when it comes before Last Call (scaled windows).
    const at = (RALLY_AT[this.venue] ?? 0) * endScale(this.shiftSecs);   // scaled like the windows (a short shift's T-3:00)
    return at > endWindows(this.shiftSecs).glow && at < this.shiftSecs && !this.endless && this.phase === 'shift' && this.venueDay >= 1 && !(this.revealT > 0) && this.day >= LAST_CALL.FROM_DAY
      && this.shiftT >= this.shiftSecs - at;
  }

  // ---- the Last Bucket (council round 2, §4.8) -------------------------------------------
  // Round 7 #5, the sky gate: at the Orbital Ball No. 1 won't fall through more than ORBIT.SKY_CLEAR pieces of
  // debris. Until the crew (or the tether) clears it, the phase is 'sky': the clock runs, orbit shots stop.
  beginLastBucket() {
    if (this.skyBlocked()) {
      this.lastBucket = { phase: 'sky' };
      this.events.push({ t: 'lastbucket', phase: 'sky', debris: this.skyDebris() });
      this.dirty = true;
      return;
    }
    this.lastBucket = { phase: 'falling', t: 3 };
    this.events.push({ t: 'lastbucket', phase: 'falling' });
    this.pa('one', { once: true });
    this.dirty = true;
  }

  skyDebris() { return debrisLeft(this.mods.state('orbit')); }
  // Round 12 (owner: "the sky never cleared"): the sky is clear enough but a card step is still open. The banner names it
  // ("buy the tether winch") instead of reading CLEAR THE SKY · 0 UP with nothing left to do.
  skyStep() { const r = this.goalRows().find(o => !o.done && o.kind !== 'sky'); return r ? moreText(r) : null; }
  // Council round 10 #1: and while the Orbital card's other steps (the Lift, the debris, the tether) are open.
  skyBlocked() { return this.venue === 5 && !this.endless && (this.skyDebris() > ORBIT.SKY_CLEAR || this.lastStepsOpen()); }
  lastStepsOpen() { return !!this.goals && this.goals.venue === LAST_CARD && this.goalRows().some(r => !r.done && r.kind !== 'sky'); }

  stepLastBucket(dt) {
    let lb = this.lastBucket;
    if (!lb || this.phase !== 'shift') return;
    if (lb.phase === 'sky') {        // round 7 #5: the sky is clear enough: Ball No. 1 falls
      if (this.skyBlocked()) return;
      this.beginLastBucket();
      return;
    }
    // Round 7 #10.2: a carrier offline for DRIVER_GRACE_MS drops Ball No. 1 where they stood, so anyone can carry it.
    const now = this.now();
    for (const p of this.players.values()) if (p.one && p.online === 0 && now - p.seenAt > DRIVER_GRACE_MS) this.dropOne(p);
    lb = this.lastBucket;
    // Self-healing: if Ball No. 1 is neither on the field nor in anyone's hands, find it or send it again.
    if ((lb.phase === 'down' || lb.phase === 'carried' || lb.phase === 'huddle') && !this.balls.has(lb.id) && ![...this.players.values()].some(p => p.one)) {
      const b = [...this.balls.values()].find(o => o.kind === 'one');
      if (b) { lb.phase = 'down'; lb.id = b.id; }
      else { lb = this.lastBucket = { phase: 'falling', t: 3 }; this.dirty = true; }
    }
    if (lb.phase === 'falling' && (lb.t -= dt) <= 0 && !lb.id) {
      // Ball No. 1 comes home: high above the field, landing 90–120 m out, away from the pond.
      const tx = (this.rng() - 0.5) * 70, tz = -(90 + this.rng() * 30), secs = 6;
      const vy = (0 - 120 + 0.5 * SIM.G * secs * secs) / secs;
      const b = this.addBall({ x: tx, y: 120, z: tz + 8, vx: 0, vy, vz: -8 / secs, kind: 'one' });
      if (b) { lb.id = b.id; lb.phase = 'down'; }
    }
    if (lb.phase === 'carried' || lb.phase === 'huddle') this.stepHuddle(lb, dt);
  }

  // The huddle beat (council round 6 #5). The carrier at the stand turns 'carried' into 'huddle': one ring slot per
  // online Rat, and while every slot is full and held, a 3 s sweep fills. Any release, exit, join or leave resets it.
  // A knockdown drops Ball No. 1 (dropOne: back to 'down'); the carrier walking out of the ring or going offline
  // returns it to 'carried'. Idle Rats count as present and holding (playtest: one AFK Rat stalled the ending).
  huddleIn(o, now) { return Math.hypot(o.x - SIM.STAND.x, o.z - SIM.STAND.z) < HUDDLE_R || now - (o.movedAt ?? now) > HUDDLE_IDLE_MS; }
  huddleHeld(o, now) { return now - (o.movedAt ?? now) > HUDDLE_IDLE_MS || (!!o.holding && o.down <= 0 && this.huddleIn(o, now)); }
  stepHuddle(lb, dt) {
    const carrier = [...this.players.values()].find(p => p.one);
    const ring = carrier && Math.hypot(carrier.x - SIM.STAND.x, carrier.z - SIM.STAND.z);
    const there = carrier && carrier.online > 0 && carrier.down <= 0 && (lb.phase === 'huddle' ? ring < HUDDLE_R : atStand(carrier));
    if (!there) {
      if (lb.phase === 'huddle') {
        Object.assign(lb, { phase: 'carried', sweep: 0, slots: null, in: null, held: null, key: null });
        this.events.push({ t: 'lastbucket', phase: 'carried', by: carrier?.id ?? lb.by, back: true });
      }
      return;
    }
    if (lb.phase !== 'huddle') {
      Object.assign(lb, { phase: 'huddle', by: carrier.id, sweep: 0, key: null });
      this.events.push({ t: 'lastbucket', phase: 'huddle', by: carrier.id });
    }
    const now = this.now(), online = this.online();
    const key = online.map(o => o.id).join();
    if (key !== lb.key) { lb.key = key; lb.sweep = 0; }      // a slot added or removed: the ring starts again
    lb.slots = online.map(o => o.id);
    lb.in = online.filter(o => this.huddleIn(o, now)).map(o => o.id);
    lb.held = online.filter(o => this.huddleHeld(o, now)).map(o => o.id);
    lb.sweep = lb.held.length === online.length ? lb.sweep + dt : 0;
    if (lb.sweep >= HUDDLE_HOLD - 1e-6) this.depositOne(carrier);
  }

  // Banking Ball No. 1: the huddle's sweep calls this at 3 s. The bucket button alone only says who is missing.
  depositOne(p) {
    const online = this.online(), now = this.now(), lb = this.lastBucket;
    const near = online.filter(o => this.huddleIn(o, now)).length;
    if (near < online.length) { this.events.push({ t: 'huddle', n: near, of: online.length, by: p.id }); return false; }
    if (lb?.phase !== 'huddle' || !(lb.sweep >= HUDDLE_HOLD - 1e-6)) return false;
    for (const o of this.players.values()) o.holding = false;
    p.one = false;
    const v = this.valueNow();
    const pay = cents(ONE_YEAR * v.bv);
    p.shift.banked++; p.shift.cash = cents(p.shift.cash + pay);   // the end card credits the Rat who carried it
    this.cash = cents(this.cash + pay); this.stats.cash = cents(this.stats.cash + pay); this.stats.deposited++;
    this.outstanding = 0;
    this.lastBucket = { phase: 'done', by: p.id };
    this.endless = true; this.endlessFresh = true; this.endlessArmed = true;
    this.up.owner = Math.max(this.up.owner ?? 0, OWNER.PAINT);   // round 8 #3: the crew colours are the deed
    this.events.push({ t: 'lastbucket', phase: 'banked', by: p.id, cash: pay });
    this.storyBeat('note');   // council round 11 #4: the note inside Ball No. 1, read in the huddle (the PA waits for it)
    { const { yesterday, streak, owner, rival, ...keep } = this.records; this.records = keep; }
    this.glassCase = newCase([p.name, ...online.filter(o => o !== p).map(o => o.name)], this.day);   // council round 12 #3d: FOUND BY   // council round 11 #6 (b3): the Owners keep their own book
    this.pa('last', { once: true });
    this.endShift(true, pay);
    return true;
  }

  // ---- the clock -------------------------------------------------------------

  addBall(s) {
    if (this.balls.size >= SIM.MAX_BALLS) return null;
    const b = { id: this.nextBall++, ...s, rest: false, acc: 0 };
    this.balls.set(b.id, b);
    this.events.push({ t: 'spawn', id: b.id, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, kind: b.kind, curve: b.curve || undefined });
    return b;
  }

  tick(dt) {
    const now = this.now();
    if (this.revealT > 0) this.revealT = Math.max(0, this.revealT - dt);
    this.stepLastBucket(dt);
    this.stepContract();   // council round 12 #6c (builder 3): the endless contract, live
    const paused = this.paused();
    const lastCall = this.lastCall();
    // Round 7 #7: an early rally (RALLY_AT; round 11: Tiered and the Stadium at T-3:00): the horn and the rally, read off
    // the LIVE gauge (the Stadium's graded one is a 2-minute mean and lags). Last Call then rings with no second line.
    if (!this.warned && this.warnDue()) {
      this.warned = true;
      this.events.push({ t: 'lastcall', ...this.rallyNeeds(this.mods.state('stadium')?.s ?? this.mods.kpi()), warning: true });
    }
    if (lastCall && !this.lastCallRung) { this.lastCallRung = true; this.gaugeWas = this.mods.kpi(); if (!this.warned) this.events.push({ t: 'lastcall', ...this.rallyNeeds() }); }
    if (lastCall && this.lastCallRung && !this.reRallied && !this.endless) {   // the gauge slipped under the tick mid-rush: say it once
      const k = this.mods.kpi();
      if (k != null && this.gaugeWas != null && this.gaugeWas >= QUOTA_KPI && k < QUOTA_KPI) { this.reRallied = true; this.events.push({ t: 'rally', ...this.rallyNeeds() }); }   // dealt like the rest (playtest 3)
      if (k != null) this.gaugeWas = k;
      // Playtest round 2 #1: a second look ~30 s into Last Call. Still short: one more line, on the same 'rally' event.
      // Owner playtest 3 §2: that's T-60, the cleanup deal: Upkeep margin 0 (nothing scuffs after it), and 'pick'
      // ("Grab the last balls!") while more than RALLY_PICK balls are out there.
      // Round 11: the cleanup deal rides the cleanup's start (T-2:00 on a full shift), however the windows scale.
      if (!this.reRallied && this.shiftT >= this.shiftSecs - endWindows(this.shiftSecs).cleanup) {
        this.reRallied = true;
        const r = this.recheckNeeds();   // round 7 #4: the re-check re-deals
        if (r.need && r.need !== RALLY_LINES.onTarget) this.events.push({ t: 'rally', ...r });
      }
    }
    // Customers: arrive at the gate, grab a bucket, hit it, walk out. A filthy mat is refused.
    this.custT += dt;
    const closing = this.closing();   // owner playtest 3 §2: from T-60 every customer walks out ('closed')
    const custK = this.custK();   // round 11 (owner): from T-3:00 the busy bays taper to none at T-2:00
    if (this.phase === 'shift') this.syncBays();   // round 11 (bays.js): a Rat left or a tier was bought: the line follows
    const nOpen = this.phase === 'shift' && !closing ? taperBays(activeMats(this.onlineCount(), this.up), custK) : 0;
    // §3.2: an arrival picks a clean mat (pickMat); §3.3: it takes a bucket from the basket (bottomless on day 1's training).
    const lower = this.mats.slice(0, UPPER.FROM);
    const matCtx = { mats: lower, mudOf: i => this.fixtures['mat' + i] ?? 0, isOpen: i => i < nOpen,
      takeBucket: this.phase === 'shift' && !(this.day === 1 && this.todo) ? () => takeBucket(this.basket) : null };
    // Council round 10 #3: the upper bays (Tiered on): no mud, no basket (the bar sells the bucket), their own pick list.
    if (this.venue >= UPPER_VENUE) {
      const seats = this.upperSeats(), nUp = taperBays(seats.length, custK);
      const open = new Set(this.phase === 'shift' && !closing ? seats.slice(0, nUp).map(k => UPPER.FROM + k) : []), ups = this.upperMats();
      const upCtx = { mats: ups, isOpen: i => open.has(i) };
      for (const m of ups) stepMat(m, dt, { ...upCtx, now: this.custT, rng: this.rng, venue: this.venue, open: open.has(m.i),
        gap: 8 * this.perks.swingGapMult, nextCust: () => ++this.nextCust });
    }
    lower.forEach((m, i) => {
      for (const e of stepMat(m, dt, { ...matCtx, now: this.custT, rng: this.rng, venue: this.venue, mud: this.fixtures['mat' + m.i] ?? 0, open: i < nOpen,
        gap: 8 * this.perks.swingGapMult, nextCust: () => ++this.nextCust })) {
        if (e.t === 'wait') this.events.push({ t: 'custwait', mat: m.i });
        if (e.t === 'refuse') { this.events.push({ t: 'refuse', mat: m.i, ...(e.why ? { why: e.why } : {}) }); this.stats.refused = (this.stats.refused ?? 0) + 1; }
      }
    });
    if (this.phase === 'shift' && !paused) {
      this.shiftT += dt;
      if (this.curveDay !== this.day) { this.curveDay = this.day; this.curve = []; }   // round 7 #9: cash at every 14th of the shift
      curveStep(this.curve, this.shiftT, this.shiftSecs, this.stats.cash);
      this.fixtures.sign = Math.min(1, this.fixtures.sign + dt * 0.0008);    // dust off the road
      this.fixtures.stand = Math.min(1, this.fixtures.stand + dt * 0.0006 * mudMul(this.today));   // round 11: rain doubles it
      const n = closing ? 0 : nOpen;   // round 11: the tapering bays; no customer ball after T-2:00, so no scuffing either
      const eatEvery = VENUE_RULES[this.venue].eatEvery ?? FRIES.EAT_EVERY;
      // §3.3: the dispenser's two chutes and the filler (SHOP `filler`: 20 s at the Muni, 10 s from the Club).
      for (const e of stepBasket(this.basket, dt, { where: id => { const p = this.players.get(id); return p && p.online > 0 && p.down <= 0 && !this.driving(p) ? p : null; }, machine: machineSecs(this.up.filler) })) {
        this.stats.filled = (this.stats.filled ?? 0) + 1; this.dirty = true;
        const p = this.players.get(e.by); if (p) p.shift.buckets = (p.shift.buckets ?? 0) + 1;
        if (this.today) this.todayN.buckets = (this.todayN.buckets ?? 0) + 1;   // round 11: the report's Ball Shortage line
        this.events.push(e);
      }
      for (let i = 0; i < n; i++) {
        const m = this.mats[i];
        if ((m.next -= dt) > 0) continue;
        if (!matReady(m, this.custT)) { m.next = 0.5; continue; }   // nobody on the mat yet
        if (this.balls.size < SIM.MAX_BALLS) {
          const lead = !lastCall && this.pondOpen() && this.rng() < POND.LEAD_CHANCE;
          // Round 11 (builder "today"): todayKind runs after pickKind (the seeded draws never change); Junior Clinic is
          // beginner shots; todayShot curves (windy), aims the celebrity's bay at a Rat and sets a ball's pay (b.mul).
          const kind = lead ? 'lead' : lastCall ? 'glow' : todayKind(this.today, pickKind(this.day, this.venue, this.rng, worldVday(this.venue, this.venueDay, this.endless)), this.shiftT, this.shiftSecs);
          let shot = lead ? { ...leadLaunch(m, this.rng), kind } : { ...launch(m, this.rng, { beginner: (this.day === 1 && this.venue === 0) || juniorDay(this.today, m.i) }), kind };
          shot = this.mods.pipe('launchMod', shot, { mat: m, kind, lead });   // the County slice, orbit shots
          if (this.today) shot = todayShot(this.today, shot, m, m.i === this.today.bay ? this.fieldRats() : undefined, { lastCall });
          const b = this.addBall(shot);
          if (b && this.today) this.todayCount(b, i, lastCall);
          if (b && kind !== 'range' && (!this.debuts.has(kind) || this.toldKinds?.has(kind))) this.debutHit(kind, b);   // council round 11 #3
          if (b && this.endless) {     // Under New Management: Balls Outstanding is a live count
            this.outstanding++;
            if (this.endlessArmed) { this.endlessArmed = false; this.outstanding = 1; }   // the PA played at the reveal (playthrough 4 C4)
          }
          m.next = swingGap(this.rng) * this.perks.swingGapMult * swingMul(this.today, m.i) / swingRate(custK, this.day);   // round 11: the busier day, then the taper
          if (this.perks.shed && --this.swingsToEat <= 0) { this.swingsToEat = eatEvery; this.fries = Math.max(0, this.fries - 1); }
          const id = 'mat' + m.i;
          if (b) this.fixtures[id] = Math.min(1, this.fixtures[id] + 0.006 * (this.perks.covered ? 0.5 : 1) * mudMul(this.today));   // every swing scuffs the mat (round 11: rain ×2)
          if (b) this.stats.launched = (this.stats.launched ?? 0) + 1;   // round 11 (pacing): the day's customer balls (SPOTLESS RANGE)
          if (b) shoot(m, this.custT);
        }
      }
      if (!closing) for (const k of this.upperSeats().slice(0, taperBays(this.upperSeats().length, custK))) this.upperSwing(this.mats[UPPER.FROM + k], k, dt, lastCall, eatEvery);
    }

    this.stepHelpers(dt);
    this.stepGary(dt);
    this.stepMowe(dt);
    this.stepPond(dt);
    this.stepBouncy();
    this.mods.call('tick', dt);
    if (this.today && this.phase === 'shift' && !paused) {   // round 11 (builder "today")
      // League Night from Tiered: the deck's orders come twice as fast (deck.js stepDeck's order clock, read next tick).
      const dk = orderBoost(this.today, this.venue) > 1 ? this.mods.state('deck')?.deck : null;
      if (dk && Number.isFinite(dk.orderT)) dk.orderT += dt * (orderBoost(this.today, this.venue) - 1);   // the queue's cap (deck.js QUEUE) still holds
    }
    if (this.gary?.chat?.by && this.phase === 'shift') { const c = this.players.get(this.gary.chat.by); if (c) c.shift.gary = (c.shift.gary ?? 0) + dt; }   // round 11: "Talked to Gary the longest"
    if (this.phase === 'shift' && !paused) {
      // Playthrough 5 B5: the Club's "Keep the crew fed for 3 minutes" counts working seconds with FED up.
      if (this.fedSt.fed > 1 && this.goals) { this.fedAcc = (this.fedAcc ?? 0) + dt; const k = Math.floor(this.fedAcc); if (k > 0) { this.fedAcc -= k; this.goalTick('fed', k); } }
      fedTick(this.fedSt, dt);   // council round 10 #2: FED wears off on working time (the cleanup minute counts)
      this.stepTray(dt);         // round 11: a Rat walking past the shed carries out a waiting dog (web/js/tray.js)
    }
    if (this.phase === 'shift' && !paused && this.perks.autoFry && (this.autoFryT += dt) >= this.perks.autoFry) { this.autoFryT = 0; this.addFries(this.perks.autoFry <= 3 ? 2 : 1, 'machine'); }   // the conveyor drops 2 (playtest: 4P out-ate it)
    // The electric / industrial ball washer works through the hopper on its own.
    if (this.phase === 'shift' && this.perks.washAuto && this.hopper.n > 0) {
      this.hopper.frac += this.perks.washAuto * dt;
      const k = Math.floor(this.hopper.frac);
      if (k > 0) { this.hopper.frac -= k; this.washBalls(k, 'machine'); }
    }
    if ((this.washFlushT += dt) >= 0.5) {
      this.washFlushT = 0;
      for (const [by, b] of this.washBatch) this.events.push({ t: 'washed', by, n: b.n, cash: b.cash, left: this.hopper.n });
      this.washBatch.clear();
    }

    for (const b of this.balls.values()) {
      if (b.rest) continue;
      const x0 = b.x, y0 = b.y, z0 = b.z;
      const stopped = advanceBall(b, dt, this.world());
      if (stopped === 'drift') { this.events.push(driftEvent(b)); continue; }   // into the running creek
      const hit = b.kind !== 'one' && !b.pinged ? this.carts.find(c => ballHitsCart(x0, y0, z0, b, c)) : null;
      if (hit) { this.ping(b, hit); continue; }
      // Gary's cart rings too, but it isn't a PING. Gary has noted your enthusiasm.
      // Playthrough 4 A12: parked through the warning counts too (the 'Stall Gary' line is dealt then); the stalls bank up.
      if ((this.gary?.phase === 'drive' || this.gary?.phase === 'warn') && b.kind !== 'one' && !b.pinged && ballHitsCart(x0, y0, z0, b, this.gary)) {
        b.pinged = true;
        // Council round 8 #2: a crew ball stalls him ("taking notes"): GARY.STALL s, GARY.STALLS times a visit.
        // Owner playtest 3 §6.3: the stall comes out of the visit's 12 s budget, shared with chatting (pingStall).
        const g = this.gary, add = b.by && (g.stalls ?? 0) < GARY.STALLS ? pingStall(g) : 0;
        const stall = add > 0 ? (g.stalls = (g.stalls ?? 0) + 1) : 0;
        if (stall) { g.pause = Math.max(0, g.pause) + add; g.stalled = (g.stalled ?? 0) + add; this.dirty = true; }
        this.events.push({ t: 'enthusiasm', by: b.by ?? null, x: g.x, z: g.z, ...(stall ? { stall } : {}) });
        const shooter = this.players.get(b.by); if (shooter) shooter.shift.pings++;
      }
      for (const p of [...this.players.values(), ...this.helpers]) {
        if (!p.helper && (this.driving(p) || this.aloft(p))) continue;   // the cage keeps the driver safe; riders are 120 m up
        if (b.by === p.id || b.kind === 'one') continue;       // your own swing leaves from your feet
        if (p.helper && b.by) continue;                          // crew swings sail over the teenagers (playtest 2: they walk the line of fire)
        if (this.custT < (this.lookUntil ?? 0) && (!p.helper || this.custT < (this.moweLookUntil ?? 0))) continue;   // council round 10 #4: everyone stops to look at the deck (9.10: helpers too, in the boss fight)
        if (!ballHitsPlayer(x0, y0, z0, b, p)) continue;
        // Round 11: the night's awards count knockdowns dealt (a crew ball's shooter); Today counts the celebrity's.
        { const by = b.by && this.players.get(b.by); if (by && !p.helper) by.shift.dealt = (by.shift.dealt ?? 0) + 1; if (b.celeb && !p.helper) this.todayN.celebKnocks = (this.todayN.celebKnocks ?? 0) + 1; }
        this.knockDown(p);
        b.vx *= -0.25; b.vz *= -0.25; b.vy = Math.abs(b.vy) * 0.3;  // it bounces off you
        break;
      }
      if (this.pondOpen() && b.kind !== 'one' && b.y <= SIM.BALL_R + 0.05 && inPond(b)) { this.sink(b); continue; }
      if (stopped) { this.events.push({ t: 'rest', id: b.id, x: b.x, z: b.z, ...(b.kind === 'one' ? { one: true } : {}) }); this.mods.call('onRest', b); }
    }
    // The creek carries balls: inflow to the Delta (they sink: the diver's pile), outflow to the Grate (the cart's pile).
    for (const b of this.balls.values()) {
      if (!b.drifting) continue;
      const end = stepDrift(b, dt);
      if (end === 'sink' && !this.pondOpen()) { b.drifting = false; b.drift = null; b.rest = true; b.y = SIM.BALL_R; this.events.push({ t: 'rest', id: b.id, x: b.x, z: b.z }); }   // round 11: the pond is still a mud flat (Club day 1)
      else if (end === 'sink') this.sink(b);
      else if (end === 'snag') { this.stats.snags = (this.stats.snags ?? 0) + 1; this.events.push({ t: 'snag', id: b.id, x: b.x, y: b.y, z: b.z }); }   // council round 10 #5: on the creekbed, divers only
      else if (end === 'rest') { this.events.push({ t: 'rest', id: b.id, x: b.x, z: b.z }); this.mods.call('onRest', b); }
    }

    for (const c of this.carts) {
      if (c.boostT > 0) c.boostT = Math.max(0, c.boostT - dt);
      const d = c.driver && this.players.get(c.driver);
      if (c.driver && (!d || (d.online === 0 && now - d.seenAt > DRIVER_GRACE_MS))) { c.driver = null; c.v = 0; }
      // Pull up to the stand and the hopper empties itself.
      // Owner playtest 3 §5.3: the hopper tips over CART.UNLOAD_SECS ('tip' for the animation); the bank lands at the end.
      if (c.tipT > 0) { if ((c.tipT -= dt) <= 1e-9) this.unloadCart(c); }
      else if (c.load > 0 && Math.hypot(c.x - SIM.STAND.x, c.z - SIM.STAND.z) < SIM.STAND_REACH + 2.5) {
        c.tipT = CART.UNLOAD_SECS; this.dirty = true;
        if (c.auto) c.mud = 0;   // playthrough 5 C5: an autopilot cart rinses itself at the return each tip
        this.events.push({ t: 'tip', cart: c.i, secs: CART.UNLOAD_SECS });
      }
    }

    for (const p of this.players.values()) {
      if (p.down > 0) p.down = Math.max(0, p.down - dt);
      if (p.online === 0 && now - p.seenAt > GRACE_MS) this.removePlayer(p);
    }
    for (const h of this.helpers) if (h.down > 0) h.down = Math.max(0, h.down - dt);

    this.goalScan();   // council round 10 #1: this tick's counted events, before the bell reads the card
    // Ready Up: 20 s after the first Rat is ready, the next shift starts anyway.
    // It holds while a promotion is ready and the signatures aren't all in (the promotion must not slip).
    // Playthrough 5 A1: it never starts the day over an unsigned promotion. After READY_HOLD_SECS, once at least one
    // Rat has signed, the ones who signed carry it (one Rat gone idle at the keyboard can't stall the crew for ever);
    // with nobody signed it waits for a signature or a "Not yet".
    if (this.phase === 'report' && this.readyAt && now - this.readyAt >= READY_HOLD_SECS * 1000 && this.promoHolds() && this.signed.size > 0) this.promote();
    if (this.phase === 'report' && this.readyAt && now - this.readyAt >= READY_SECS * 1000 && !this.promoHolds()) this.startShift();
    if (this.phase === 'shift' && this.clockOut?.size) this.checkClockOut();   // playthrough 5: a Rat left, or the card went undone
    if (this.phase === 'shift' && this.shiftT >= this.shiftSecs) {
      // Playthrough 3 #3: the sky gate at the bell holds the clock (the Lift and the tether keep working) so the finale
      // stays one beat, up to SKY_HOLD_SECS: a crew where nobody rides still gets its bell. Once the sky clears inside
      // the hold, Ball No. 1's fall and huddle run on the held clock to the bank.
      const lb = this.lastBucket?.phase;
      if (lb === 'sky' && (this.skyHoldT ?? 0) < SKY_HOLD_SECS) { this.skyHoldT = (this.skyHoldT ?? 0) + dt; this.shiftT = this.shiftSecs; }
      else if (!(this.skyHoldT > 0 && lb && lb !== 'sky' && lb !== 'done')) this.endShift();
    }
  }

  knockDown(p, by = null) {
    p.down = this.perks.knockSecs;
    if (p.helper) p.target = null;
    this.stats.knockdowns++; this.dirty = true;
    if (p.shift) p.shift.knockdowns++;
    this.events.push({ t: 'knock', id: p.id, by });
    // Whatever you were carrying goes everywhere.
    for (const s of spill(p.x, p.z, p.pocket, this.rng)) this.addBall(s);
    p.pocket = 0; p.pocketW = 0;
    if (p.one) this.dropOne(p, 0.4);   // Ball No. 1 drops at your feet. It doesn't fly.
    if (!p.helper) this.addGrime(p, 1);   // you landed in the mud
    this.mods.call('knockDown', p, by);
  }

  // Ball No. 1 leaves your hands at rest beside you, or on the dock if that's in the pond: a diver can't
  // pick it up, so a ball in the water would be lost for good.
  dropOne(p, off = 0) {
    p.one = false;
    let x = p.x + off, z = p.z;
    if (inPond({ x, z })) { x = POND.DOCK.x; z = POND.DOCK.z + 1.5; }
    const b = this.addBall({ x, y: SIM.BALL_R, z, vx: 0, vy: 0, vz: 0, kind: 'one' });
    if (b) { b.rest = true; this.events.push({ t: 'rest', id: b.id, x: b.x, z: b.z, one: true }); }
    if (this.lastBucket && this.lastBucket.phase !== 'done') { this.lastBucket.phase = 'down'; this.lastBucket.id = b?.id; }
    this.dirty = true;
    return b;
  }

  removePlayer(p) {
    const own = this.cartOf(p); if (own) { own.driver = null; own.v = 0; }
    for (const s of spill(p.x, p.z, p.pocket, this.rng)) this.addBall(s);
    if (p.one) this.dropOne(p);
    if (p.treasure) this.dropTreasure(p, true);   // a carried treasure goes back to the Deep End
    this.players.delete(p.id);
    this.signed.delete(p.id); this.ready.delete(p.id);
    this.events.push({ t: 'leave', id: p.id });
  }

  // `onePay`: Ball No. 1's payout, which stays out of the crew record (the endless pace target).
  endShift(ending = false, onePay = 0) {
    this.phase = 'report';
    // Closing time: hired help and the cart turn in what they're carrying, so it counts today.
    for (const h of this.helpers) { this.bank(h.pocket, h.id, 'helper', h.pocketW ?? h.pocket); h.pocket = 0; h.pocketW = 0; h.target = null; }
    // The night crew takes the pond's line at half pay, and the tube delivers what is still in it.
    if (this.line.n > 0) { const nc = nightCrew(this.line); this.line = newLine(); this.bank(nc.n, 'night', 'helper', nc.w * nc.mult); }
    for (const e of tubeArrivals(this.tube, Infinity)) this.bank(e.n, e.by, null, e.w, e.factor);
    for (const c of this.carts) { this.unloadCart(c); c.boostT = 0; }
    // The ball washer at the bell: the night crew washes half of what's left at half pay; the rest goes dirty.
    if (this.hopper.n > 0) {
      const half = Math.floor(this.hopper.n / 2), payHalf = cents(this.hopper.credit * 0.5 * 0.5);
      this.stats.unwashed = this.hopper.n - half;
      this.stats.lostPremium = cents(this.hopper.credit - payHalf);
      this.cash = cents(this.cash + payHalf); this.stats.cash = cents(this.stats.cash + payHalf);
      this.hopper = { n: 0, credit: 0, frac: 0 };
    }
    this.moweBell();   // council round 12 #5b (builder 1): MOW-E balls left out bank ×1
    this.mods.call('endShift', ending);   // venue modules settle up before the review reads the gauges
    // The performance review: Upkeep at the bell against Corporate's target (council round 2, §1.2).
    let quota = null;
    if (this.quota && !ending) {
      const v = this.valueNow(), target = this.quotaTarget();
      // Round 6 #2: from Tiered on, the venue gauge must hold too (no gauge at the Muni or the Club: unchanged there).
      const gauge = this.mods.kpi(), gaugeOk = gaugeHolds(gauge);
      const upOk = upkeepMet(v, this.quota.q);   // owner playtest 3 §1.4: on Upkeep, with the old half-cent slack (bvtext.js)
      const hit = this.stats.deposited > 0 && upOk && gaugeOk;
      const bonus = hit ? cents(this.stats.cash * 0.15) : 0;
      if (hit) { this.reviews++; this.cash = cents(this.cash + bonus); this.goalTick('reviews'); }   // round 10 #1: "Hit the daily target N×"
      // Owner playtest 3 §1.2: the report reads the bar's percentages ("Clean 64% · needed 60%").
      const pcts = reviewPcts(v.upkeep, this.quota.q, this.ceiling(), upOk);
      quota = { target, bv: v.bv, hit, bonus, reviews: this.reviews, title: this.title(), clean: pcts.clean, need: pcts.need, venue: this.venue, ...(this.stats.deposited > 0 ? {} : { idle: true }),
        ...(gauge == null ? {} : { gauge: Math.round(gauge * 100) / 100, gaugeOk, ...(gaugeOk ? {} : gaugeMiss(this.venue, this.mods.state('county'))) }) };   // council round 11 #2: the County names hazards or strays
      this.events.push({ t: 'quota', ...quota });
    }
    this.goalScan();   // round 10 #1: the review's tick (no reward), then the report reads the card
    // Round 11: SPOTLESS RANGE: nothing left out there after the cleanup (from day 2, when there is one) pays a bonus.
    const spotless = !ending && this.day >= LAST_CALL.FROM_DAY ? spotlessBonus({ left: this.ballsLeft(), launched: this.stats.launched ?? 0, reward: rewardFor(this.valueNow().bv, this.venue, this.onlineCount()) }) : null;
    if (spotless) { this.cash = cents(this.cash + spotless.cash); this.stats.spotless = spotless.cash; this.events.push({ t: 'spotlessRange', ...spotless }); }
    // Crew records (from day 3).
    let record = null;
    const dayCash = cents(this.stats.cash - onePay);
    // Round 8 #3: an endless bell races yesterday (the ending's shift and review days never write it).
    const race = this.endless && !ending ? raceYesterday(this.records, dayCash, finishCurve(this.curveDay === this.day ? this.curve : [], dayCash)) : null;
    if (this.day >= 3 && dayCash > this.records.cash) {
      if (!race) record = { cash: dayCash, was: this.records.cash };   // council round 11 #6: in endless the Owners' book decides (below)
      this.records = { ...this.records, cash: dayCash, banked: this.stats.deposited - (onePay ? 1 : 0), day: this.day, curve: finishCurve(this.curveDay === this.day ? this.curve : [], dayCash) };
    }
    if (race) { this.records.yesterday = race.yesterday; this.records.streak = race.streak; }
    // Council round 11 #6: the Owners keep their own book (records.owner); records.cash stays the 'Best ever'. Endless day 1
    // opens it; from day 2 beating it is the record. Round 7 #3: the record PA plays only in endless, where the record is
    // the game (no stamp to land on); on review days the report card's "Record shift!" line says it.
    // Council round 12 #3d: the day that opens the Owners' book and every record after it add a line to the case's plaque.
    if (race) { const opened = !cleanOwner(this.records.owner), o = ownerRecord(this.records, dayCash); this.records.owner = o.owner; if (o.record) { record = o.record; this.pa('record', { big: true }); }
      if ((o.record || opened) && this.glassCase) this.glassCase = addRecordLine(this.glassCase, this.day, dayCash); }
    // Council round 12 #8: Site 13's bell. The race replaces "beat yesterday" as the report's headline (yesterday stays a
    // row); a week won is the next morning's memo (sim.js MEMO_LINES), the second day of a new week says they're back.
    let rivalRes = null;
    if (race) {
      const rb = rivalBell(this.records.rival, this.rivalT, dayCash);
      this.records.rival = rb.rival; rivalRes = rb.result;
      if (rb.acquired) this.memoNews = MEMO_LINES.acquired;
      else if (rb.result && rb.rival.week >= 2 && rb.rival.days === 1) this.memoNews = MEMO_LINES.rivalBack;
      if (rivalRes) rivalRes.week = { wins: rb.rival.wins, days: rb.rival.days, acquired: rb.acquired };
    }
    for (const k of Object.keys(this.stats)) this.totals[k] = (this.totals[k] ?? 0) + this.stats[k];
    this.report = { day: this.day, ...this.stats, left: this.ballsLeft(), bank: this.cash, quota, record, ...(spotless ? { spotless } : {}), ...(race ? { race: race.result } : {}),
      ...(rivalRes ? { rival: rivalRes } : {}),   // council round 12 #8: Site 13's bell
      ledger: this.ledger(), promo: this.promoInfo(), venue: this.venue, title: this.title(), ...(this.earlyBell ? { early: this.earlyBell } : {}),   // playthrough 5: clocked out early (s)
      // Playthrough 4 C2: a held bell where the sky stayed up says what's left, not "more balls".
      tomorrow: this.lastBucket?.phase === 'sky' && !this.endless ? 'Tomorrow: clear the sky. Ball No. 1 waits.'
        : tomorrowText(this.day + 1, this.venue, this.endless, !!this.promoInfo()?.ready, !this.endless && this.venue !== 5 && garyMorning(this.garyDay, this.day + 1) === this.day + 1,
          this.endless ? null : tomorrowLine(this.goalRows(), this.venue), this.garyBack) };
    if (ending) this.report.ending = { days: this.day, banked: this.totals.deposited, commendations: this.commendations, quotas: (this.totals.reviews ?? 0) + this.reviews };
    this.settleToday(ending);   // round 11 (builder "today"): Today's line, the endless contract, the night card
    this.dirty = true;
    this.events.push({ t: 'shift', phase: 'report', day: this.day, report: this.report });
    if (!ending) this.promoBell(quota);   // round 11: Promotion Day signs on the spot, or deals tomorrow's
  }

  // ---- Round 11 (builder "pacing"): Promotion Day (promoday.js) ----------------------------------------------------
  promoTries() { return this.promoTry?.venue === this.venue ? this.promoTry.n : 0; }
  // At the bell: Promotion Day passed (the card is done) signs on the spot; failed, it comes again tomorrow (the next
  // try at the regular target). Any other bell: a card one good day short, every other goal done, deals tomorrow's.
  promoBell(quota) {
    if (this.endless || !this.report) return;
    const today = isPromotionDay(this);
    if (today) {
      const pass = !!quota?.hit && !!this.promoInfo()?.ready;
      this.report.promoDay = { pass, try: this.promoTries() + 1 };
      this.events.push({ t: 'promoday', pass, venue: this.venue });
      this.promoDay = null; this.dirty = true;
      if (pass) { this.pa('promoday', { big: true }); this.promoTry = null; this.promote(); return; }
      this.promoTry = { venue: this.venue, n: this.promoTries() + 1 };
    }
    const due = promoDue(this.goalRows());
    this.promoDay = due ? this.day + 1 : null;
    if (due) this.report.tomorrow = today ? PROMO_DAY.AGAIN : PROMO_DAY.TOMORROW;
  }
  // Gary rides along all Promotion Day: a loop behind the fence, except while he warns, drives and inspects.
  stepPromoRide(dt) {
    if (!isPromotionDay(this) || this.phase !== 'shift' || (this.gary && this.gary.phase !== 'done')) { if (this.gary && this.gary.phase !== 'done') this.garyRide = null; return; }
    if (!this.garyRide) this.garyRide = newRide(this.gary ?? null);
    if (stepRide(this.garyRide, dt) === 'wave') this.events.push({ t: 'garyIntro', phase: 'wave' });
    this.dirty = true;
  }

  racePace() {
    const y = yesterdayPace(this.records);
    return y ? { record: y.cash, now: cents(paceAt(y, this.shiftT, this.shiftSecs)), cash: this.stats.cash, vs: y.vs, best: this.records.cash } : null;
  }

  // Employee of the Shift and the personal ledger (council round 2, §5.2).
  ledger() {
    const rats = this.online().length ? this.online() : [...this.players.values()];
    const AWARDS = [['Employee of the Shift', 'banked'], ['Most Horizontal Associate', 'knockdowns'], ['Department of Wet', 'dived'],
      ['Fry Laureate', 'cooked'], ['Crank Operator of the Shift', 'scrubbed'], ['Hydration Officer', 'hosed'], ['Enthusiasm (Noted)', 'pings'], ['Mown Down (Twice)', 'mowed'],
      ...this.mods.collect('awards')];   // venue modules' awards key off their own p.shift counters
    const award = new Map();
    for (const [name, key] of AWARDS) {
      const best = rats.filter(r => !award.has(r.id) && (key === 'banked' || r.shift[key] > 0))
        .sort((a, b) => b.shift[key] - a.shift[key])[0];
      if (best) award.set(best.id, name);
    }
    return rats.map(r => ({ id: r.id, name: r.name, color: r.color, ...r.shift, award: award.get(r.id) ?? 'Present' }));
  }

  // ---- what goes over the wire ----------------------------------------------

  // The day-1 checklist: crew-wide, ticks off when anyone does it. Null once training is over.
  todoWire() {
    if (!this.todo || this.phase !== 'shift') return null;
    if ((this.fixtures.sign ?? 1) <= 0.05) this.todo.sign = true;
    const picked = Math.min(TODO_PICK, this.stats.picked), banked = Math.min(TODO_BANK, this.stats.deposited);
    if (picked >= TODO_PICK || banked >= TODO_BANK) this.todo.pick = true;
    if (banked >= TODO_BANK) this.todo.bank = true;
    return [
      { id: 'pick', n: this.todo.pick ? TODO_PICK : picked, of: TODO_PICK, done: !!this.todo.pick },
      { id: 'bank', n: this.todo.bank ? TODO_BANK : banked, of: TODO_BANK, done: !!this.todo.bank },
      { id: 'sign', done: this.todo.sign },
      { id: 'buy', done: this.todo.buy },
    ];
  }

  snapshot() {
    const now = this.now();
    const cr = this.cranking ?? {};
    const rateOf = s => (cr[s] && now - cr[s].at < 400 ? +cr[s].rate.toFixed(2) : 0);
    return {
      phase: this.phase, day: this.day, shiftT: Math.round(this.shiftT * 10) / 10, shiftSecs: this.shiftSecs, cash: this.cash,
      mult: this.mult, venue: this.venue, venueDay: this.venueDay, endless: this.endless, ...(this.test ? { test: true } : {}),   // round 11: skip-ahead test crew
      players: [...this.players.values()].map(p => ({
        id: p.id, name: p.name, color: p.color, x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3),
        pocket: p.pocket, down: +p.down.toFixed(2), online: p.online > 0, gear: p.gear, wand: p.wand,
        spray: !!p.wand && now - p.washAt < 400,   // owner notes: mates see your spray (wash acts land every 250 ms)
        diving: p.diving, ...(p.creekDiving ? { creek: true } : {}), air: +p.air.toFixed(1), bag: p.bag, pumping: p.pumping, dive: p.dive, treasure: p.treasure, grime: p.grime, one: p.one,
        ready: this.ready.has(p.id), signed: this.signed.has(p.id), ...(this.looks[p.name] ? { look: this.looks[p.name] } : {}), ...(this.clockOut?.has(p.id) ? { clockOut: true } : {}),
      })),
      value: this.valueNow(),
      quota: this.quota && { q: +this.quota.q.toFixed(4), target: this.quotaTarget() },
      reviews: this.reviews, title: this.title(), commendations: this.commendations,
      goals: this.goalWire(),   // council round 10 #1: the card (rows, the Board's strip, the headline, the reward now)
      outstanding: this.outstanding, records: this.records,
      // Endless target: today's cash against the record's pace (round 7 #9: the record shift's own curve; linear for an old record).
      // Round 8 #3: it races yesterday when there is one (yesterdayPace); `best` is the all-time record, a small line.
      pace: this.endless && this.phase === 'shift' && this.shiftSecs > 0 ? this.racePace() : null,
      silo: this.stats.deposited, lastCall: this.lastCall(),
      nMats: this.openBays(), garyToday: this.garyToday(), seal: this.seal ?? 1,   // owner playtest 3 §1.1/§6.4: the Board's pips, banner and chip; round 11 (bays.js): nMats is the bays that exist
      ...(this.fedSt.fed > 1 ? { fedRing: +fedRing(this.fedSt).toFixed(2) } : {}),   // council round 10 #2: the Board's FED chip ring (value.fed is the factor)
      ...(this.tray?.dogs.length ? { tray: this.tray.dogs.length } : {}),   // round 11: dogs waiting on the shed's warm tray
      // Owner playtest 3: §2 the cleanup minute (closing, and the live "N left out there" from 1:00); §3.3 the basket.
      closing: this.closing(), left: this.closing() ? this.ballsLeft() : null,
      basket: this.basket.n, basketMax: basketMax(this.basket), filling: Object.keys(this.basket.fill), filled: this.stats.filled ?? 0,   // round 11: Ball Shortage's 6
      machT: (k => (k == null ? null : +k.toFixed(2)))(machineProgress(this.basket, machineSecs(this.up.filler))),   // round 11: the filler's bucket, 0..1
      promo: this.promoInfo(), revealT: +this.revealT.toFixed(1),
      promotedTo: this.phase === 'report' && this.pendingReveal ? VENUE_RULES[this.pendingReveal]?.name ?? null : null,   // the report says so (playtest)
      // While the signatures hold the Ready Up timer: no countdown, and `sigWait` {n, of} ("Waiting for signatures").
      readyIn: this.phase === 'report' && this.readyAt && !this.promoHolds() ? Math.max(0, Math.ceil(READY_SECS - (now - this.readyAt) / 1000)) : null,
      sigWait: this.phase === 'report' && this.readyAt && this.promoHolds() ? this.awaitingSignatures() : null,
      // Playthrough 5 A1: the crew said "Not yet" to the promotion at this report (Ready then starts the day).
      ...(this.phase === 'report' && this.notYet ? { notYet: true } : {}),
      // Playthrough 5: "Card done · clock out" — null unless the card is done mid-shift; n of `of` Rats are holding it.
      clockOut: this.canClockOut() ? { n: this.clockOut?.size ?? 0, of: this.onlineCount() } : null,
      lastBucket: this.lastBucket && { phase: this.lastBucket.phase, by: this.lastBucket.by ?? null,
        ...(this.lastBucket.phase === 'sky' ? { debris: this.skyDebris(), step: this.skyStep() } : {}),
        ...(this.lastBucket.phase === 'huddle' ? { sweep: +this.lastBucket.sweep.toFixed(2), slots: this.lastBucket.slots ?? [], in: this.lastBucket.in ?? [], held: this.lastBucket.held ?? [] } : {}) },
      washer: this.perks.washer ? { n: this.hopper.n, credit: this.hopper.credit, auto: this.perks.washAuto,
        L: cr.L && now - cr.L.at < 400 ? cr.L.id : null, R: cr.R && now - cr.R.at < 400 ? cr.R.id : null, rateL: rateOf('L'), rateR: rateOf('R') } : null,
      mower: moweSnap(this.mower) ?? (this.phase === 'shift' && BOSS.ON ? updateSnap(this.bossToday(), this.shiftT, this.shiftSecs) : null),   // council round 11 #1: the boss, the tame pass or the legacy pass; round 12 #5a: the update bar
      moweWhistle: this.whistleState(), moweBeat: !!this.moweSt.beat,   // round 12 #5d: 0 no pet today, 1 the whistle's ready, 2 used
      ct: +this.custT.toFixed(2), mats: this.wireMats(),
      gary: this.gary && { phase: this.gary.phase, t: +this.gary.t.toFixed(1), x: +this.gary.x.toFixed(2), z: +this.gary.z.toFixed(2), yaw: +this.gary.yaw.toFixed(3),
        to: this.gary.phase === 'drive' ? this.garyStops()[this.gary.stop]?.id ?? null : null, ...this.garyEtaWire(),
        // owner playtest 3 §6.1/6.3: parked or not (pause), the stall budget used, who's chatting, the long nameplate
        pause: +Math.max(0, this.gary.pause ?? 0).toFixed(2), stalled: +(this.gary.stalled ?? 0).toFixed(2),
        chat: this.gary.chat?.by ?? null, chatT: +(this.gary.chat?.t ?? 0).toFixed(2), first: this.venue === GARY_INTRO.VENUE && this.day === GARY_INTRO.DAY },
      garyIntro: this.garyIntro && !this.garyIntro.done ? { x: +this.garyIntro.x.toFixed(2), z: +this.garyIntro.z.toFixed(2), yaw: +this.garyIntro.yaw.toFixed(3), first: true }
        : this.garyRide ? { x: +this.garyRide.x.toFixed(2), z: +this.garyRide.z.toFixed(2), yaw: +this.garyRide.yaw.toFixed(3), first: true, ride: true } : null,   // round 11: Promotion Day's ride-along   // round 6 #5: the Board's GARY 3 · 2 · 1
      pond: { sunk: this.sunkCount(), unlocked: this.pondOpen(), lostFound: this.lostFound, treasure: this.treasure,
        line: this.line.n, tube: this.tube.q.reduce((s, e) => s + e.n, 0), clarity: this.pondOpen() ? pondClarity(this.sunkCount()) : null },
      fries: { stock: this.fries, max: FRIES.MAX, open: !!this.perks.shed },
      todo: this.todoWire(),
      fixtures: Object.fromEntries(Object.entries(this.fixtures).map(([k, v]) => [k, +v.toFixed(2)])),
      helpers: this.helpers.map(h => ({ id: h.id, name: h.name, x: +h.x.toFixed(2), z: +h.z.toFixed(2), yaw: +h.yaw.toFixed(3), pocket: h.pocket, down: +h.down.toFixed(2) })),
      carts: this.carts.map(cartWire),
      cart: this.cart && cartWire(this.cart),   // the legacy alias (one release): the first cart
      up: this.up,
      mods: this.mods.snapshot(),      // { [module id]: its snapshot } (round 4 venue modules)
      // Round 11 (builder "today"): today's modifier (the Board chip), the lifetime stars, the endless report's
      // offers and pick, today's contract, the crew's cart paint (players carry their own look).
      ...(this.today ? { today: { ...this.today, chip: todayChip(this.today) } } : {}),
      ...(this.endless || this.stars ? { stars: this.stars } : {}),
      ...(this.offers && this.phase === 'report' ? { offers: this.offers, pick: this.contractPick ?? 0 } : {}),
      ...(this.contract && this.phase === 'shift' ? { contract: { ...this.contract, ...contractLive(this.contract, this.contractStats()) } } : {}),   // council round 12 #6c: state, so
      ...(this.cartPaint ? { cartPaint: this.cartPaint } : {}),
      // Council round 12 (builder 3): the glass case (#3d), Gary at the return on a rejoin, Site 13 live (#8, bvtext
      // rivalLineOf) and how often it was acquired (signs.js repaints their fence sign; the locker's jacket).
      ...(this.glassCase ? { glassCase: this.glassCase } : {}),
      ...(this.firstOwnerDay && this.phase === 'shift' ? { firstOwnerDay: true } : {}),
      ...(this.rivalT && this.endless && this.phase === 'shift' ? { rival: { cash: Math.round(this.rivalNow()), est: true } } : {}),
      ...(this.records.rival?.acquired ? { site13: this.records.rival.acquired } : {}),
    };
  }

  // Everything a fresh (or reconnecting) browser needs to draw the range.
  welcome(you) {
    return {
      k: 'welcome', code: this.code, you, report: this.report, s: this.snapshot(),
      // Round 11: a saved crew coming back (no shift yet this session): "Previously on Range Rat" and the next goal.
      ...(this.previously && !this.night ? { previously: { ...this.previously, next: this.goalWire()?.strip?.next ?? (this.endless ? 'NEXT: PICK A CONTRACT' : null) } } : {}),
      balls: [...this.balls.values()].map(b => ({ id: b.id, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, rest: b.rest, kind: b.kind, sunk: !!b.sunk, ...(b.creek ? { creek: true } : {}) })),
    };
  }

  // The events since the last flush, with the current snapshot.
  flush() {
    const ev = this.events;
    this.events = [];
    return { k: 'tick', s: this.snapshot(), ev };
  }

  toSave() {
    // `day` is the next day to play: a finished shift has been banked.
    const day = this.phase === 'report' ? this.day + 1 : this.day;
    const mods = this.mods.toSave();
    return { v: 5, code: this.code, day, cash: this.cash, totals: this.totals, up: this.up,
      diveByName: this.diveByName, lostFound: this.lostFound,
      commendations: this.commendations, reviews: this.reviews, pondSunk: this.sunkCount(), fries: this.fries,
      ...(this.goals ? { goals: this.goals } : {}),   // council round 10 #1 (save v5)
      venue: this.venue, venueDay: this.venueDay, outstanding: this.outstanding, pendingReveal: this.pendingReveal,
      endless: this.endless, ...(this.endlessFresh ? { endlessFresh: true } : {}), ...(this.garyDay != null ? { garyDay: this.garyDay } : {}),
      ...(this.promoDay != null ? { promoDay: this.promoDay } : {}), ...(this.promoTry ? { promoTry: this.promoTry } : {}),   // round 11: Promotion Day   // owner playtest 3 §6.2
      ...(this.test ? { test: true } : {}),   // round 11: a skip-ahead test crew (server/skip.mjs) stays marked
      fixtures: Object.fromEntries(Object.entries(this.fixtures).map(([k, v]) => [k, +v.toFixed(3)])),   // owner playtest 3 §3.1
      records: this.records, voiced: [...this.voiced], debuts: [...this.debuts], mowe: { ...this.moweSt, ...(this.moweMemo ? { memo: this.moweMemo } : {}) },   // council round 11 #1 (builder 1)
      ...(this.story.size ? { story: [...this.story] } : {}),   // round 12: the story beats seen   // (restored: an edit had folded them into the comment)
      ...(mods ? { mods } : {}),       // one key per venue module, only when one has something to keep
      // Round 11 (builder "today"): the lifetime stars and cosmetics, and the night card ("Previously on" next time).
      ...(this.glassCase ? { glassCase: this.glassCase } : {}),   // council round 12 #3d (builder 3)
      ...(this.stars ? { stars: this.stars } : {}), ...(Object.keys(this.looks).length ? { looks: this.looks } : {}), ...(this.cartPaint ? { cartPaint: this.cartPaint } : {}),
      ...((this.night ? this.nightNow() : this.previously) ? { night: this.night ? this.nightNow() : this.previously } : {}),
      savedAt: new Date(this.now()).toISOString() };
  }
}

// ---- Corporate's voice (Fairway Holdings International) ----------------------
// Council round 12, 9.8 (builder 4): the flavours live in sim.js (MEMO_FLAVORS, RAT_MEMOS), every one ≤ 8 words.
const MEMOS = MEMO_FLAVORS;
const TODO_PICK = 1, TODO_BANK = 3;   // the day-1 checklist: one ball, then a pocketful banked
// The memo is one short line (the owner: less text at once); the joke rides along as `flavor`, in small type.
// The Orbital's memo (round 7 #5): no review there, only the countdown.
const orbitMemo = n => 'Today: clear the sky. ' + Math.max(0, n | 0).toLocaleString('en-US') + ' to bring home.';   // playthrough 3: name the sky
function memoText(day, target, endless, rng, venue = 0, gary = false) {
  if (endless) return RAT_MEMOS[Math.floor(rng() * RAT_MEMOS.length)];
  if (target == null) return day === 1 ? 'Welcome to the Muni Range. Pick up balls.' : 'Pick up balls. Bank them. Corporate pays per ball.';
  return memoLine(target, venue, gary);   // owner playtest 3 §1.2: "Today: 60% clean by the bell." (the target is a % of the bar)
}
function memoFlavor(day, venue, endless, rng) {
  if (endless) return '';
  const line = MEMOS[Math.floor(rng() * MEMOS.length)];      // always one draw: the seeded goldens depend on it
  if (day === 1 && venue === 0) return MEMO_DAY_FLAVOR[1];
  if (day === 2 && venue === 0) return MEMO_DAY_FLAVOR[2];
  return line;
}
// ready: the card is done (playthrough 3 #10: don't re-explain it, say what's left). Council round 10 #1: `card` is the
// card's own line (goals.js tomorrowLine: "Tomorrow: two goals left for Tiered." / "...sign at the bell for Tiered.");
// garyBack: a Gary goal is still open after his visit, so he comes back tomorrow.
function tomorrowText(day, venue, endless, ready = false, gary = false, card = null, garyBack = false) {
  if (endless) return 'Tomorrow: Range Rats LLC opens as usual. The job never ends.';
  if (day === 2) return 'Tomorrow: a target. Hose before the bell.';
  if (day === 3) return 'Tomorrow: the first gold balls. Worth ten.';
  if (day === 4 && venue === 0) return 'Tomorrow: Gary from Regional. Clean, then huddle.';   // owner playtest 3 §6.1 (it was 13 words)
  if (ready && card) return card;
  if (garyBack) return 'Gary will be back tomorrow.';   // round 10 #1: a Gary goal still open
  if (gary) return 'Tomorrow: Gary visits. Clean, then huddle.';   // §6.2: a visit's eve
  if (card) return card;
  return 'Tomorrow: more balls. Corporate thanks you for your continued compliance.';
}
