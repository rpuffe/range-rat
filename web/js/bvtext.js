// Ball Value in one look (owner playtest 3 §1): every word and number the Board, the HUD, the memo, the report and the
// floats say about what a ball pays. Pure: no THREE, no DOM (node tests it; board.js, main.js and crew.mjs call it).
//
//   The price  = BV × Hustle × Gary's Seal (× FED): what one ball pays right now ("$2.62 A BALL"), whoever carries it
//                (round 11: gear grime folded into the Clean %, see returnMud).
//   The bar    = (Upkeep − 1) / (ceiling − 1): the grounds' cleanliness at the Muni ("CLEAN 62%"), the average of the
//                unlocked gauges from the Club ("UPKEEP 48%").
//   The tick   = q / (ceiling − 1): today's target on the same bar ("TARGET 60%").
import { upkeepCeiling, money, SIM } from './sim.js';

const clamp01 = v => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
const c2 = v => Math.round(v * 100) / 100;

// The fixture pips: green at Gary's pass mark or cleaner, amber to the night cap, brown above it.
export const PIP = { GREEN: 0.34, AMBER: 0.6 };
export const PIP_HEX = { green: '#6fd36f', amber: '#e8b04a', brown: '#8a5a2b' };
export const pipColour = mud => (mud <= PIP.GREEN + 1e-9 ? 'green' : mud <= PIP.AMBER + 1e-9 ? 'amber' : 'brown');

// The most Upkeep can be from a snapshot's `value` (pond, fries and kpi are null while locked).
export const ceilingOf = v => upkeepCeiling({ pond: v?.pond ?? null, fries: v?.fries ?? null, kpi: v?.kpi ?? null });
// The bar's fill (0..1) and the target tick's place on it (0..1).
export const cleanFrac = (upkeep, ceiling) => clamp01(((upkeep ?? 1) - 1) / Math.max(1e-9, (ceiling ?? 1.5) - 1));
export const targetFrac = (q, ceiling) => (q == null ? null : clamp01(q / Math.max(1e-9, (ceiling ?? 1.5) - 1)));
export const pct = f => Math.round(clamp01(f) * 100);
// Whole-% target: the Muni's day 2–4 read 60%, day 5 70%, day 6+ 80%; the Club's venue day 1 35%.
export const targetPct = (q, ceiling) => (q == null ? null : pct(targetFrac(q, ceiling)));

// The bar's word: CLEAN everywhere (council round 10, main session: player-facing text says "clean"; it was UPKEEP
// from the Club, council 9). Upkeep stays the code's name for it.
export const barWord = () => 'CLEAN';
export const whyLine = venue => ((venue ?? 0) === 0 ? 'Clean grounds pay up to +50%' : 'Each gauge pays up to +50%');

// What one ball pays right now. `seal` defaults to the value's own (crew.mjs valueNow), else 1; so does `fed`
// (council round 10 #2: the hot dogs' FED factor, v.fed while fed, a separate factor like the Seal).
export const priceOf = (v, seal = v?.seal ?? 1, fed = v?.fed ?? 1) => c2((v?.bv ?? 0) * (v?.hustle ?? 1) * (seal ?? 1) * (fed ?? 1));
// "×1.2", "×1.15": the FED factor, trailing zeros dropped (the HUD's "· ×1.2 fed", the Board's chip).
export const fedText = f => '×' + (Math.round((f ?? 1) * 100) / 100).toFixed(2).replace(/0$/, '').replace(/.0$/, '');

// "$3.1M", "$412k", "$9,870": the endless HUD's short money.
export function shortMoney(n) {
  n = Number.isFinite(n) ? n : 0;
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (a >= 1e4) return '$' + Math.round(n / 1e3) + 'k';
  return money(Math.round(n * 100) / 100);
}

// The HUD's line: "$2.62 a ball · 62% clean · need 60%" (Muni), "$30 a ball · 48% upkeep · need 40%" (Club and up),
// "$19,240 a ball · today $3.1M" (endless). No quota (day 1): just the price and the bar.
// Council round 10 #2: "· ×1.2 fed" while the crew is FED (fed > 1; the value's own v.fed when not passed).
export function bvLine({ value, quota = null, venue = 0, endless = false, pace = null, seal, fed } = {}) {
  if (!value) return '';
  const f = fed ?? value.fed ?? 1;
  const price = money(priceOf(value, seal, f)), fedPart = f > 1 + 1e-9 ? ` · ${fedText(f)} fed` : '';
  if (endless || (quota == null && pace)) return `${price} a ball${fedPart}${pace ? ' · today ' + shortMoney(pace.cash) : ''}`;
  const ceil = ceilingOf(value), word = barWord(venue).toLowerCase();
  const now = `${pct(cleanFrac(value.upkeep, ceil))}% ${word}`;
  return quota?.q != null ? `${price} a ball${fedPart} · ${now} · need ${targetPct(quota.q, ceil)}%` : `${price} a ball${fedPart} · ${now}`;
}

// The morning memo (≤ 8 words): "Today: 60% clean by the bell." / "Gary visits today. 60% clean by the bell."
export function memoLine(targetPctV, venue = 0, gary = false) {
  const goal = `${targetPctV}% ${barWord(venue).toLowerCase()} by the bell.`;
  return gary ? `Gary visits today. ${goal}` : `Today: ${goal}`;
}

// The report's row: "Clean 64% · needed 60%" (Muni), "Upkeep 41% · needed 40%" (Club and up).
export function reportRow({ clean, need, venue = 0 }) {
  const w = barWord(venue);
  return `${w[0]}${w.slice(1).toLowerCase()} ${clean}% · needed ${need}%`;
}
// Is Upkeep at the target? Judged on Upkeep (council round 2), with the half-cent slack the old BV / Rate check had
// (BV rounds to cents on the pre-§1.4 rate), so folding the clean kit into the price moves no stamp.
export const upkeepMet = (v, q, margin = 0) => (v.upkeep ?? v.bv / v.rate) + 0.005 * SIM.CLEAN_KIT / Math.max(0.01, v.rate ?? 1) + 1e-9 >= 1 + q + margin;

// The review's two whole percentages, kept honest at the rounding edge: a missed Upkeep never prints "60% · needed
// 60%", a met one never prints "59% · needed 60%". `ok` is the server's own Upkeep comparison.
export function reviewPcts(upkeep, q, ceiling, ok) {
  const need = targetPct(q, ceiling);
  let clean = pct(cleanFrac(upkeep, ceiling));
  if (ok && clean < need) clean = need;
  if (!ok && clean >= need) clean = need - 1;
  return { clean, need };
}
export const sealRow =cash => `Gary's Seal: +${money(Math.round((cash ?? 0) * 100) / 100)}`;

// The bank popup over you: "8 × $2.62"; a washer holding part of it: "8 × $1.31 + wash".
// Round 11 (expert, "simplify the price stack"): no "· muddy boots" chip any more. Grime no longer cuts a carrier's
// pay; it muddies the ball return instead (returnMud below), so it shows in the Clean % like any other dirt.
// `boots` stays in the result, always false. Returns { text, wash } so the caller can colour "+ wash" in blue.
export function popupLine(e) {
  const n = Math.max(1, e?.n | 0), per = e?.per ?? (e?.cash ?? 0) / n;
  const base = `${n} × ${money(c2(per))}`;
  const wash = (e?.credit ?? 0) > 0;
  return { text: base + (wash ? ' + wash' : ''), base, wash, boots: false };
}

// Round 11, the one price: "muddy boots make you dirtier, not cheaper". A ball pays BV × Hustle × Gary's Seal × FED
// whoever carries it. The crew's muddy gear counts in the Clean % instead, as if it were one more dirty fixture on the
// Curb average: bootsMud = BOOTS × the mean grime of the Rats online (0..3 layers, as 0..1) + CART × the fleet's mean
// mud (0..1). A whole crew caked is one fully muddy fixture (Curb -1/12 at the Muni: -4% on every ball); clean gear
// changes nothing. Gary's stops never see it (his return stop is the fixture). Hose your boots, wash the cart: the
// Clean % comes back for everybody. (A first cut muddied the ball return instead; measured with mid.mjs it made a
// 2P crew that never hoses its boots fail Gary's return stop for 3-25 extra Club shifts, so it moved here.)
export const MUDDY = { BOOTS: 1, CART: 0.5 };
export function bootsMud(grimes = [], carts = []) {
  let g = 0, gn = 0, c = 0, cn = 0;
  for (const x of grimes) { g += Math.max(0, Math.min(3, Number(x) || 0)) / 3; gn++; }
  for (const m of carts) { c += clamp01(m); cn++; }
  return (gn ? MUDDY.BOOTS * g / gn : 0) + (cn ? MUDDY.CART * c / cn : 0);
}

// The "+$0.05 a ball" float when a spray makes a fixture Spotless: what that fixture's mud was costing every ball.
//   rate × hustle × seal × 0.5 × washFrom / fixtures. Under a cent: null (no float).
export function spotlessGain({ rate, hustle = 1, seal = 1, washFrom = 0, fixtures = 12 }) {
  const g = c2((rate ?? 0) * (hustle ?? 1) * (seal ?? 1) * 0.5 * clamp01(washFrom) / Math.max(1, fixtures));
  return g >= 0.01 ? g : null;
}
export const gainText = g => `+${money(g)} a ball`;

// ---- Council round 10 #2: food that pays, and says so (the menu cards' live values; kitchen.js and the floats) ----
// Fries raise what every ball pays: a full fryer is one Upkeep gauge, +50% of the Rate, so each basket in stock is
// rate × 0.5 / FRIES.MAX a ball (+$0.47 at the Club), times Hustle, the Seal and FED. `baskets` is what a serve adds
// (capped at the fryer's room when `stock`/`max` are given).
export function friesGain({ rate, baskets = 3, stock = null, max = 20, hustle = 1, seal = 1, fed = 1 }) {
  const b = stock == null ? baskets : Math.max(0, Math.min(baskets, max - stock));
  return c2((rate ?? 0) * 0.5 * b / Math.max(1, max) * (hustle ?? 1) * (seal ?? 1) * (fed ?? 1));
}
export const friesCard = g => `FRIES · +${money(g)} A BALL`;                       // "FRIES · +$1.41 A BALL"
export const dogCard = step => `HOT DOG · +${Math.round((step ?? 0.05) * 100)}% EVERY BALL`;   // "HOT DOG · +5% EVERY BALL"
export const beerCard = tab => `BEER · ${money(Math.round(tab ?? 0))} TAB`;          // "BEER · $2,900 TAB"
export const fedFloat = step => `+${Math.round((step ?? 0.05) * 100)}% a ball`;        // the float over the shed on a dog
export const tabFloat = tab => `+${money(Math.round(tab ?? 0))} tab`;                // over the lounger when the mug lands
// The Board's fryer label: "FRIES 14/20" (baskets in stock / the fryer's size).
export const friesLabel = (stock, max = 20) => `FRIES ${Math.max(0, Math.floor(stock ?? 0))}/${max}`;
// The report row: "Hot dogs: +$8,300" (stats.fedCash).
export const fedRow = cash => `Hot dogs: +${money(Math.round(cash ?? 0))}`;

// The pips, left to right: the sign, the return, then each mat in play. [{ id, group, colour }]
export function pipsOf(fixtures, nMats = 10) {
  if (!fixtures) return [];
  const out = [];
  const add = (id, group) => { if (fixtures[id] != null) out.push({ id, group, colour: pipColour(fixtures[id]) }); };
  add('sign', 'SIGN'); add('stand', 'RETURN');
  for (let i = 0; i < nMats; i++) add('mat' + i, 'MATS');
  return out;
}

// ---- Playthrough 5 labels ----
// B7: a day's take with its sign in front ("+$1,200", "−$3,800"; it read "+$-3,800"). The minus is U+2212.
export const signedMoney = v => ((v ?? 0) < 0 ? '−' : '+') + money(Math.abs(v ?? 0));
// A4: the report's stamp says "daily target", the card's word for it (it said QUOTA).
export const targetStamp = q => (q?.hit ? 'DAILY TARGET HIT' : q?.idle ? 'DAILY TARGET MISSED: nothing was banked' : 'DAILY TARGET MISSED');
