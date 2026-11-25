// Council round 10 #2: food that clearly pays. Pure, no THREE, no DOM: the server (crew.mjs) runs the
// rules, the kitchen and the Board read the same numbers.
//
// Fries raise what every ball pays (the fryer is an Upkeep gauge, as before). A hot dog FEDs the crew:
// every ball the crew banks pays × fed, a factor of its own like Gary's Seal (past the Hustle cap; Upkeep
// never sees it). Good +0.05, perfect +0.10, capped at ×1.25, wearing off 0.05 every 20 s of working time.
import { FED, FRIES } from './sim.js';

const c2 = v => Math.round(v * 100) / 100;

// The crew's FED state: { fed: 1..FED.MAX, clock: seconds of working time since the last 5% loss }.
export const newFed = () => ({ fed: 1, clock: 0 });

// A served dog. Burnt (or Gary's) gives nothing. Returns the gain actually added (0 at the cap).
export function fedServe(st, quality) {
  const add = quality === 'perfect' ? FED.PERFECT : quality === 'good' ? FED.GOOD : 0;
  if (!add) return 0;
  const was = st.fed;
  st.fed = Math.min(FED.MAX, c2(st.fed + add));
  if (was <= 1) st.clock = 0;       // a fresh FED starts a full 20 s before its first loss
  return c2(st.fed - was);
}

// Working time passes (the shift and the cleanup minute; never the report or the morning).
export function fedTick(st, dt) {
  if (st.fed <= 1) { st.fed = 1; st.clock = 0; return; }
  st.clock += dt;
  while (st.clock >= FED.EVERY - 1e-9 && st.fed > 1) { st.clock -= FED.EVERY; st.fed = Math.max(1, c2(st.fed - FED.DECAY)); }
  if (st.fed <= 1) st.clock = 0;
}

// 0..1: how much of the ring is left before the next 5% loss (the Board's chip).
export const fedRing = st => (st && st.fed > 1 ? Math.max(0, Math.min(1, 1 - st.clock / FED.EVERY)) : 0);

// The FED share of a payout that already includes × fed (the report's "Hot dogs: +$X").
export const fedShare = (full, fed) => (fed > 1 ? c2(full * (1 - 1 / fed)) : 0);

// "×1.20 FED" (the Board chip) and "· ×1.2 fed" (the HUD line). Null when not fed.
export const fedChip = fed => (fed > 1 ? `×${fed.toFixed(2)} FED` : null);
export const fedHud = fed => (fed > 1 ? ` · ×${+fed.toFixed(2)} fed` : '');

// What one basket of fries adds to every ball, at today's value v ({rate, hustle, seal?, fed?}).
// A full fryer is +50% of the Rate, so a basket is 0.5 × rate / FRIES.MAX.
export const basketValue = v => c2(0.5 * (v?.rate ?? 0) / FRIES.MAX * (v?.hustle ?? 1) * (v?.seal ?? 1) * (v?.fed ?? 1));
// What a serve of n baskets adds, limited by the room left in the fryer (stock = baskets now).
export const friesServeValue = (v, n = 3, stock = 0) => c2(basketValue(v) * Math.max(0, Math.min(n, FRIES.MAX - (stock ?? 0))));
