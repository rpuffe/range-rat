// The snack shed's menu by venue and the serve yields (council round 3, build item 6). Pure.
export const FRIES_MENU = [['fries'], ['fries', 'hotdog'], ['fries', 'hotdog', 'beer']];   // by venue index: Muni, Club, Tiered
export const MENU_ALL = ['fries', 'hotdog', 'beer'];
export const MENU_UNLOCK = { fries: 'Muni Range', hotdog: 'Range Club', beer: 'Tiered Entertainment Range' };
export const MENU_VENUE = { fries: 0, hotdog: 1, beer: 2 };
export const menuFor = venue => FRIES_MENU[Math.max(0, Math.min(FRIES_MENU.length - 1, venue | 0))];

export const FRIES_YIELD = {
  fries: { perfect: 3, good: 2, burnt: 0, onePeel: 1 },
  hotdog: { perfect: 2, good: 1, burnt: 0, onePeel: 0 },
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
