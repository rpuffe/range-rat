// Playthrough 4 C1: what a tap of the act button picks up on land (pure, so node can test it).
// Ball No. 1 rides in your hands outside the pocket, so it is checked before a full pocket.
// near: the nearest reachable ball (or null); carrying: pocket + pending; pocket: capacity; scoop: the push picker is on;
// holdingOne: you already carry Ball No. 1.
// Returns { grab: ball } | { full: true } | null.
export function actPick({ near, carrying, pocket, scoop = false, holdingOne = false }) {
  if (near?.kind === 'one') return holdingOne ? null : { grab: near };
  if (carrying >= pocket) return { full: true };
  if (scoop || !near) return null;
  return { grab: near };
}
