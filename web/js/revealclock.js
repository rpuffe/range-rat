// Council round 13 #7b (builder 3): the venue reveal on one clock. The reveal camera used to advance by the frame's
// dt while the story cards ran on wall-clock time, so at 1 fps "Gary rides the Lift" played over the gate. Now the
// camera's path is a function of wall-clock seconds since the reveal began (a slow frame jumps the camera to where it
// should be), a card can name a camera cue (CARD_CUES: it waits for the cue's pose, up to CUE_WAIT s), and the camera
// waits on the card's end (revealStory). Pure: no THREE, no DOM (round2.js holds the vectors; test/round2.test.mjs).
export const REVEAL_SHOT = { MOVE: 1.5, CASE_AT: 3, LIFT_WAIT: 14, CAP: 22, CUE_WAIT: 3, IN: 1.2, OUT: 1 };

// The cards that wait for a camera pose: { beatId: { cardIndex: cue } }. A card may also carry its own `cue`.
export const CARD_CUES = { 'promo:5': { 1: 'lift' }, epilogue: { 0: 'case' } };
export const cardCue = (beatId, index, card = null) => card?.cue ?? CARD_CUES[beatId]?.[index] ?? null;

// A new reveal for venue `venue`, begun at wall-clock second `t0`.
export function newReveal(venue, t0) {
  return { t0, t: 0, venue, flipped: false,
    shot: venue === 3 ? 'board' : venue === 5 ? 'lift' : venue === 6 ? 'case' : null,
    shotAt: venue === 6 ? REVEAL_SHOT.CASE_AT : venue === 3 ? 0 : null, endAt: 5 };
}

// Advance to wall-clock second `now`. Returns the blend weights: w (the player's view → the reveal), s (the reveal
// pose → the shot), and done (the reveal is over). Mutates r (its t, endAt, shot).
export function revealStep(r, now) {
  r.t = Math.max(0, now - r.t0);
  // A shot that is coming holds the reveal past 5 s (capped); a Lift shot whose card never came (seen) ends as before.
  if (r.shot === 'lift' && r.shotAt == null && r.t >= REVEAL_SHOT.LIFT_WAIT) { r.shot = null; r.endAt = Math.max(5, r.t); }
  else if (r.shot === 'board' && !r.cardSeen && r.t >= REVEAL_SHOT.LIFT_WAIT) { r.endAt = Math.max(5, r.t); r.cardSeen = true; }   // the beat never came (seen)
  else if (r.shot && r.endAt === 5) r.endAt = REVEAL_SHOT.CAP;
  const k = Math.min(1, r.t / REVEAL_SHOT.IN), back = Math.max(0, Math.min(1, (r.t - r.endAt) / REVEAL_SHOT.OUT));
  const s = r.shot && r.shotAt != null && r.t > r.shotAt ? smooth01((r.t - r.shotAt) / REVEAL_SHOT.MOVE) : 0;
  return { w: k * (1 - back), s, done: r.t >= r.endAt + REVEAL_SHOT.OUT };
}
const smooth01 = x => { const u = Math.max(0, Math.min(1, x)); return u * u * (3 - 2 * u); };

// The story card's cards drive the shot (storycard.js 'rr-story'): promo:5's first card starts the Lift shot, its
// third card (or the beat's end) releases it; the epilogue's second card releases the case shot. Pure on r.
export function revealStory(r, d) {
  if (!r?.shot) return;
  if (r.shot === 'lift' && d.id === 'promo:5') {
    if (d.phase === 'card' && d.index === 0 && r.shotAt == null) r.shotAt = r.t;
    if ((d.phase === 'card' && d.index >= 2) || d.phase === 'end') r.endAt = Math.max(r.t, (r.shotAt ?? r.t) + REVEAL_SHOT.MOVE + 1);
  }
  // 4d: the Board shot holds while the newsreel card (promo:3's first) is up; the second card releases it.
  if (r.shot === 'board' && d.id === 'promo:3') r.cardSeen = true;
  if (r.shot === 'board' && d.id === 'promo:3' && ((d.phase === 'card' && d.index >= 1) || d.phase === 'end')) r.endAt = Math.max(r.t, REVEAL_SHOT.MOVE + 1);
  if (r.shot === 'case' && d.id === 'epilogue' && ((d.phase === 'card' && d.index >= 1) || d.phase === 'end')) r.endAt = Math.max(r.t, REVEAL_SHOT.CASE_AT + REVEAL_SHOT.MOVE + 3);
}

// Is the camera at the cue's pose (the shot's move done)? No reveal, or a reveal without that shot: true (never wait).
export function cueReady(r, cue, now = null) {
  if (!cue || !r || r.shot !== cue) return true;
  const t = now == null ? r.t : Math.max(0, now - r.t0);
  // the Lift shot starts on the beat's first card: before that, the card can't be waiting on it
  return r.shotAt != null && t >= r.shotAt + REVEAL_SHOT.MOVE;
}
