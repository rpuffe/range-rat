// The snack shed's menu by venue and the serve yields (council round 3, build item 6). Pure.
import { FED, money } from './sim.js';
import { friesServeValue } from './food.js';

export const FRIES_MENU = [['fries'], ['fries', 'hotdog'], ['fries', 'hotdog', 'beer']];   // by venue index: Muni, Club, Tiered
export const MENU_ALL = ['fries', 'hotdog', 'beer'];
export const MENU_UNLOCK = { fries: 'Muni Range', hotdog: 'Range Club', beer: 'Tiered Entertainment Range' };
export const MENU_VENUE = { fries: 0, hotdog: 1, beer: 2 };
export const menuFor = venue => FRIES_MENU[Math.max(0, Math.min(FRIES_MENU.length - 1, venue | 0))];

export const FRIES_YIELD = {
  fries: { perfect: 3, good: 2, burnt: 0, onePeel: 1 },
  hotdog: { perfect: 0, good: 0, burnt: 0, onePeel: 0 },   // council round 10 #2: a dog FEDs the crew instead (food.js)
  beer: { perfect: 2, good: 1, burnt: 0, onePeel: 0 },
};
export const yieldFor = (item, quality, onePeel = false) => {
  const y = FRIES_YIELD[item]; if (!y) return 0;
  const n = y[quality] ?? 0;
  return quality === 'perfect' && onePeel ? n + y.onePeel : n;
};

// Gary eats one: a (non-burnt) hot dog served while Gary is on site (warning or driving) and
// his kitchen stop hasn't happened yet. Mark gary.fed = true; the kitchen stop then passes
// whatever the stock. The eaten dog comes off the yield. gary: the crew's {phase, checks, fed}.
export const garyHungry = g => !!g && (g.phase === 'warn' || g.phase === 'drive') && !g.fed && !(g.checks || []).some(c => c.stop === 'kitchen');
export function garyEats(g, item, quality) {
  const fed = item === 'hotdog' && quality !== 'burnt' && garyHungry(g);
  return { fed, take: fed ? 1 : 0 };   // yield = max(0, n - take)
}
export const GARY_LINE = 'Gary had a hot dog. Gary is reasonable now.';

// Council round 10 #2: each card prints its one payoff in money (live values from the snapshot).
// v = the crew's value ({rate, hustle, seal?, fed?}); stock = baskets in the fryer; fed = the crew's FED;
// tab = an open beer order's live tab in $ (null: no order, the plain tab is shown).
export function menuPayoff(item, { v = null, stock = 0, fed = 1, tab = null } = {}) {
  if (item === 'fries') { const add = friesServeValue(v, FRIES_YIELD.fries.perfect, stock); return add > 0 ? `+${money(add)} A BALL` : 'FRYER FULL'; }
  if (item === 'hotdog') return fed >= FED.MAX - 1e-9 ? `×${FED.MAX.toFixed(2)} FED · FULL` : `+${Math.round(FED.GOOD * 100)}% EVERY BALL`;
  if (item === 'beer') return tab != null ? `${money(Math.round(tab))} TAB` : null;
  return null;
}
// The float over the shed on a serve (world text, never centre text): "+$1.41 a ball", "+5% a ball".
export function serveFloat(item, quality, { v = null, stockBefore = 0, fedGain = 0 } = {}) {
  if (quality === 'burnt') return null;
  if (item === 'fries') { const add = friesServeValue(v, yieldFor('fries', quality), stockBefore); return add > 0 ? `+${money(add)} a ball` : null; }
  if (item === 'hotdog') return fedGain > 0 ? `+${Math.round(fedGain * 100)}% a ball` : null;
  return null;
}
