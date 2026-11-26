// Round 12: the story beats. Two threads through the venue ladder (design/game-design.md "Round 12: story beats"):
//   1. the heart: Gary from Regional was a Range Rat here in 1987, and Ball No. 1 (the founder's, 1958) never came down;
//   2. the comedy: Fairway Holdings' memos, the rival crew Site 13 (always ahead, until FHI acquires it), and Dimples'
//      rebrands.
// Pure: no THREE, no DOM. server/crew.mjs decides when a beat plays (once per crew, the save's `story` list) and emits
// { t: 'story', id }; web/js/storycard.js shows its cards. Every line is 8 words or fewer (say.js wordCount).
//
// A card: { who, line, head? }. who: 'MEMO' (the Office of Ball Value, Dimples' seal), 'GARY', 'PA' or 'CAPTION'
// (plain narration). head: an optional header that replaces the speaker's own (the founder's note).
// A beat: { id, trigger: { kind, venue }, cards }. kinds: 'cold' (day 1, the first shift), 'promo' (a venue's reveal
// morning), 'mid' (one later morning at the venue), 'epilogue' (the first Under New Management morning).

export const WHO = Object.freeze({
  MEMO: 'FAIRWAY HOLDINGS · OFFICE OF BALL VALUE',
  GARY: 'GARY FROM REGIONAL',
  PA: 'FAIRWAY HOLDINGS · CORPORATE PA',
  CAPTION: '',
});
export const STORY = Object.freeze({
  CARD_SECS: 4,       // a card auto-advances after this, so four Rats never wait on one
  GRACE_SECS: 0.4,    // a press this soon after a card shows is ignored (a mashed Ⓐ can't skip a card unread)
  MID_FROM: 2,        // the mid-venue beat: from the venue's second morning
  MAX_WORDS: 8,
});

const card = (who, line, head) => (head ? { who, line, head } : { who, line });
const M = line => card('MEMO', line), G = line => card('GARY', line), C = (line, head) => card('CAPTION', line, head);

export const BEATS = Object.freeze([
  // ---- the Muni (venue 0): the cold open is its arrival ---------------------------------------------------------
  { id: 'cold', trigger: { kind: 'cold', venue: 0 }, cards: [
    M('Welcome to Site 12. You are on probation.'),
    M('Every ball hit since 1958 is outstanding.'),
    M('Site 13 is already ahead of you. Somehow.'),
  ] },
  { id: 'mid:0', trigger: { kind: 'mid', venue: 0 }, cards: [
    C('Found behind the shed: a photo, 1958.'),
    C('The founder, mid-swing. The ball never landed.'),
    M('Site 13 doubled you. Be more Site 13.'),
  ] },
  // ---- the Range Club (1) ------------------------------------------------------------------------------------------
  { id: 'promo:1', trigger: { kind: 'promo', venue: 1 }, cards: [
    G('The Club. I raked this pond once.'),
    M('Site 13 made the Club last week.'),
    M('Dimples now wears a monocle. For the members.'),
  ] },
  { id: 'mid:1', trigger: { kind: 'mid', venue: 1 }, cards: [
    C('Club minutes, 1958: the founder’s ball, still airborne.'),
    G('Don’t dive the north end. Just don’t.'),
    M('Site 13’s fries are crispier. We checked.'),
  ] },
  // ---- Tiered (2) ----------------------------------------------------------------------------------------------------
  { id: 'promo:2', trigger: { kind: 'promo', venue: 2 }, cards: [
    C('Corporate archive: Ball Retrieval Training, 1987.'),
    C('The Rat on the tape looks like Gary.'),
    M('Dimples is now dimpl. Lowercase. Experiential.'),
  ] },
  { id: 'mid:2', trigger: { kind: 'mid', venue: 2 }, cards: [
    G('That tape is not me. Watch your bays.'),
    M('Site 13 reports 140% Bay Utilization.'),
    M('Corporate did not know that was possible.'),
  ] },
  // ---- the Stadium (3) -----------------------------------------------------------------------------------------------
  { id: 'promo:3', trigger: { kind: 'promo', venue: 3 }, cards: [
    C('The jumbotron plays a 1958 newsreel. By mistake.'),
    C('The founder swings. The camera never finds it.'),
    M('Site 13 has two jumbotrons. Do better.'),
  ] },
  { id: 'mid:3', trigger: { kind: 'mid', venue: 3 }, cards: [
    G('Off the record? That was a good lap.'),
    M('Dimples now has a mascot. It is Dimples.'),
  ] },
  // ---- the County (4): FHI acquires Site 13; Gary says it ----------------------------------------------------------
  { id: 'promo:4', trigger: { kind: 'promo', venue: 4 }, cards: [
    M('FHI has acquired Site 13. Welcome, colleagues.'),
    M('Their numbers were, it turns out, estimates.'),
    G('I was a Range Rat. Here. 1987.'),
  ] },
  { id: 'mid:4', trigger: { kind: 'mid', venue: 4 }, cards: [
    C('County records, 1958: “small, dimpled, still rising.”'),
    G('Club Champion, ’87. Then came the clipboard.'),
    M('Dimples has been rezoned. Dimples is a park.'),
  ] },
  // ---- the Orbital (5) -----------------------------------------------------------------------------------------------
  { id: 'promo:5', trigger: { kind: 'promo', venue: 5 }, cards: [
    G('I always wanted to see it.'),
    C('Gary rides the Lift. Tie flapping.'),
    M('Dimples has been rebranded as a moon.'),
  ] },
  { id: 'mid:5', trigger: { kind: 'mid', venue: 5 }, cards: [
    C('Up here, one ball glints: FHI · 1958.'),
    G('He hit it so we’d keep looking.'),
    M('Former Site 13 asks to borrow the Lift.'),
  ] },
  // ---- the epilogue: the first Under New Management morning ------------------------------------------------------
  { id: 'epilogue', trigger: { kind: 'epilogue', venue: 6 }, cards: [
    C('“Whoever finds this: the range is yours.”', 'INSIDE BALL No. 1 · 1958'),
    C('Gary loosens his tie. He grabs a bucket.'),
    M('Dimples is retiring. He finally makes eye contact.'),
    C('The sign is repainted. Under New Management.'),
  ] },
]);
export const BEAT_BY_ID = Object.freeze(Object.fromEntries(BEATS.map(b => [b.id, b])));
export const BEAT_IDS = Object.freeze(BEATS.map(b => b.id));

// The beat for a trigger at a venue (null if none). The Muni has no reveal: its arrival is the cold open.
export function beatFor(kind, venue = 0) {
  if (kind === 'promo' && venue === 0) kind = 'cold';
  return BEATS.find(b => b.trigger.kind === kind && (kind === 'epilogue' || b.trigger.venue === venue)) ?? null;
}

// The save's seen list: known ids only, no duplicates (an old save has none: every beat is still to come).
export const cleanStory = a => [...new Set(Array.isArray(a) ? a : [])].filter(id => typeof id === 'string' && Object.hasOwn(BEAT_BY_ID, id));

// ---- the triggers (the server's morning, after the reveal and Today are dealt) -----------------------------------
// The cold open: day 1 at the Muni, a real crew (a skip-ahead test crew never sees it).
export const coldDue = ({ day, venue, endless = false, test = false }) => !endless && !test && day === 1 && venue === 0;
// The mid-venue morning: the first morning from the venue's second on that is NOT Promotion Day, has no Today modifier
// (the memo already carries Today's line: one text at a time), is not a reveal morning, and is not the Last Bucket's
// morning. A crew promoted before such a morning comes skips that venue's mid beat (the promotion beats stand alone).
export function midDue({ venue, venueDay, endless = false, promoDay = false, today = null, reveal = false, lastBucket = false }) {
  if (endless || reveal || promoDay || today || lastBucket || !(venueDay >= STORY.MID_FROM)) return null;
  return beatFor('mid', venue)?.id ?? null;
}

// ---- Gary's visit lines, by venue (reuses his visits: no new mechanic) -----------------------------------------------
// hello: his bubble while he's parked at the gate for his warning (world text, not centre text).
// bye: the feed line after his verdict (edge text). The clipboard tyrant warms to a quiet ally up the ladder.
// Venue 5 (the Orbital) has no Gary visits; he's on the Lift.
export const GARY_HELLO = Object.freeze(['Clipboard’s ready. Are you?', 'Mind the pond. Things sink.', 'Experiential. Right. Show me.',
  'The crowd’s watching. So am I.', 'Right. Let’s see the county.', 'I always wanted to see it.']);
export const GARY_BYE = Object.freeze(['Noted. Everything is noted.', 'Not bad. Don’t tell Regional.', 'Back in my day: one mat.',
  'Good crew. Better than mine was.', 'You’d have liked 1987.', 'Keep the sky clear, Rats.']);
const clampV = v => Math.max(0, Math.min(5, Math.floor(Number(v) || 0)));
export const garyHello = venue => GARY_HELLO[clampV(venue)];
export const garyBye = venue => GARY_BYE[clampV(venue)];

// ---- the card sequence (the client's overlay model; pure, injectable clock) ------------------------------------------
// A beat plays one card at a time: press() advances (after the grace), skip() ends the beat, tick() auto-advances
// after CARD_SECS. Beats that arrive while one plays wait their turn. Returns the card showing, or null.
export function createStoryModel({ now = () => Date.now() / 1000, secs = STORY.CARD_SECS, grace = STORY.GRACE_SECS } = {}) {
  const queue = [];
  let beat = null, i = 0, at = 0;
  const cur = () => (beat ? beat.cards[i] : null);
  function start() { beat = queue.shift() ?? null; i = 0; at = now(); return cur(); }
  function next() { i++; at = now(); if (!beat || i >= beat.cards.length) { beat = null; return null; } return cur(); }
  return {
    // Queue a beat by id (unknown ids and a beat already queued or playing are ignored). True if queued.
    add(id) {
      const b = BEAT_BY_ID[id];
      if (!b || beat?.id === id || queue.some(q => q.id === id)) return false;
      queue.push(b); return true;
    },
    get pending() { return queue.length; },
    get beat() { return beat; },
    get index() { return i; },
    get card() { return cur(); },
    get up() { return !!beat; },
    // Start the next queued beat (the adapter calls this when say.js grants the turn).
    begin() { return beat ? cur() : start(); },
    press() { if (!beat || now() - at < grace) return cur(); return next(); },
    skip() { beat = null; i = 0; return null; },
    tick() { if (beat && now() - at >= secs) return next(); return cur(); },
  };
}
