// Owner playtest 3 §7.3: every card works on a pad. Pure helpers over element-like objects
// (anything with getAttribute / dataset / id), so test/menu.test.mjs runs them on a tiny stub.
//
// The rules:
// - When a card becomes the menu root, focus its primary button: [data-primary] (the report's Next / Ready,
//   the lobby's Open the range, the pause card's Back to work), the shop's first affordable Buy, else the first target.
// - Focus survives re-renders: remember the focused element's id or data-buy, refocus it after; if it's gone
//   (a Buy you can no longer afford), the next Buy along, then the previous, then nothing (Ⓐ then only focuses).
// - Ⓐ never clicks a button that wasn't already focused: with nothing in the card focused, Ⓐ only focuses the primary.
// - Ⓐ is ignored for a moment after a card opens, so a Ⓐ mashed at the bell can't press Next.

export const MENU_A_GRACE = 0.5;   // seconds after a card opens before Ⓐ clicks

const attr = (el, name) => (el?.getAttribute ? el.getAttribute(name) : null);
const buyOf = el => el?.dataset?.buy ?? attr(el, 'data-buy') ?? null;

export function primaryOf(targets, rootId = '') {
  return targets.find(el => attr(el, 'data-primary') != null)
    ?? (rootId === 'store' ? targets.find(el => buyOf(el)) : null)
    ?? targets[0] ?? null;
}

// What to remember about the focused element before HTML is replaced.
export function focusMemo(active, root) {
  if (!active || !root?.contains?.(active)) return null;
  const buy = buyOf(active);
  if (buy) return { buy };
  return active.id ? { id: active.id } : null;
}

// After a re-render: the element to refocus (or null to leave focus alone). order: the data-buy ids
// in the order they were before the re-render (to find "the next Buy along").
export function focusRestore(memo, targets, rootId = '', order = []) {
  if (!memo) return null;
  if (memo.id) return targets.find(el => el.id === memo.id) ?? primaryOf(targets, rootId);
  const byBuy = id => targets.find(el => buyOf(el) === id);
  const same = byBuy(memo.buy);
  if (same) return same;
  const i = order.indexOf(memo.buy);
  if (i >= 0) {
    for (let j = i + 1; j < order.length; j++) { const el = byBuy(order[j]); if (el) return el; }
    for (let j = i - 1; j >= 0; j--) { const el = byBuy(order[j]); if (el) return el; }
  }
  return null;   // nothing left to buy: leave nothing focused, so the next Ⓐ only focuses the primary (never presses Next)
}

// What Ⓐ does on a card: 'wait' (it just opened), 'focus' (nothing focused: focus the primary), 'click', or 'input'.
export function menuA({ focused, sinceOpen = Infinity }) {
  if (sinceOpen < MENU_A_GRACE) return 'wait';
  if (!focused) return 'focus';
  return focused.tagName === 'BUTTON' ? 'click' : 'input';
}
