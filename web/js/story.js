// Round 12: the story beats. Two threads through the venue ladder (design/game-design.md "Round 12: story beats"):
//   1. the heart: Gary from Regional was a Range Rat here in 1987, and Ball No. 1 (the founder's, 1958) never came down;
//   2. the comedy: Fairway Holdings' memos, the rival crew Site 13 (always ahead, until FHI acquires it), and Dimples'
//      rebrands.
// Pure: no THREE, no DOM. server/crew.mjs decides when a beat plays (once per crew, the save's `story` list) and emits
// { t: 'story', id }; web/js/storycard.js shows its cards. Every line is 8 words or fewer (say.js wordCount).
//
// A card: { who, line, head?, ...opts }. who: 'MEMO' (the Office of Ball Value, Dimples' seal), 'GARY', 'PA' or 'CAPTION'
// (plain narration). head: an optional header that replaces the speaker's own (the founder's note).
// Council round 11 opts: secs (auto-advance), grace (presses ignored before), min (on screen at least this long: an
// earlier press or skip is kept and acts at min), photo ('sepia' | 'circled': founder.js draws the 1958 photo in the
// card), style ('note': the note from inside Ball No. 1).
// A beat: { id, trigger: { kind, venue }, cards, delay? }. kinds: 'cold' (day 1, the first shift), 'promo' (a venue's
// reveal morning), 'mid' (one later morning at the venue), 'note' (at the bank, inside Ball No. 1), 'epilogue' (the
// first Under New Management morning). delay: seconds the beat waits after it is queued (the note waits for the crack).

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

const card = (who, line, head, opts) => ({ who, line, ...(head ? { head } : {}), ...(opts ?? {}) });
const M = line => card('MEMO', line), G = (line, opts) => card('GARY', line, null, opts), C = (line, head, opts) => card('CAPTION', line, head, opts);
// Council round 11 #4: the note card. Ⓐ works after 2 s, it moves on by itself at 7 s, and it stays at least 5 s.
// The bank, in seconds from the 'banked' event (round2.js): the confetti and the roar at 0, the hush (floods off,
// ambience ducked) at HUSH, the crack (0.6 s hinge, then the paper rises 0.4 m) at CRACK, the note card at NOTE, and
// the $∞ finale when the note's beat ends (or at NOTE + WAIT if it never shows: a save that already saw it).
export const BANK_SEQ = Object.freeze({ HUSH: 1.2, CRACK: 2.0, NOTE: 2.8, WAIT: 14 });
// DELAY: the note waits in the queue while the bank's confetti, the hush and the crack play.
export const NOTE = Object.freeze({ GRACE: 2, MIN: 5, SECS: 7, DELAY: BANK_SEQ.NOTE });

export const BEATS = Object.freeze([
  // ---- the Muni (venue 0): the cold open is its arrival ---------------------------------------------------------
  { id: 'cold', trigger: { kind: 'cold', venue: 0 }, cards: [
    M('Welcome to Site 12. You are on probation.'),
    M('Every ball hit since 1958 is outstanding.'),
    M('Site 13 is already ahead of you. Somehow.'),
  ] },
  { id: 'mid:0', trigger: { kind: 'mid', venue: 0 }, cards: [
    C('Found behind the shed: a photo, 1958.', null, { photo: 'sepia' }),   // council round 11 #7: the photo, drawn
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
    C('The jumbotron plays a 1958 newsreel. By mistake.'),   // council round 11 #7: and it does (round2.js, founder.js)
    G('Nice jumbotron. Don’t get a big head.'),
    M('Site 13 sells tickets to its jumbotron.'),
  ] },
  { id: 'mid:3', trigger: { kind: 'mid', venue: 3 }, cards: [
    G('Off the record? That was a good lap.'),
    M('Dimples now has a mascot. It is Dimples.'),
  ] },
  // ---- the County (4): FHI acquires Site 13; Gary says it ----------------------------------------------------------
  { id: 'promo:4', trigger: { kind: 'promo', venue: 4 }, cards: [
    G('I was a Range Rat. Here. 1987.', { min: 5 }),   // council round 11 #7: Gary's confession goes first
    M('FHI has acquired Site 13. Welcome, colleagues.'),
    M('Their numbers were, it turns out, estimates.'),
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
    C('Up here, one ball glints: FHI · 1958.', null, { photo: 'circled' }),
    G('He hit it so we’d keep looking.'),
    M('Former Site 13 asks to borrow the Lift.'),
  ] },
  // ---- the note: at the bank, in the huddle, before the $∞ finale (council round 11 #4) ---------------------------
  { id: 'note', trigger: { kind: 'note', venue: 6 }, delay: NOTE.DELAY, cards: [
    C('“Whoever finds this: the range is yours.”', 'INSIDE BALL No. 1 · 1958', { style: 'note', grace: NOTE.GRACE, min: NOTE.MIN, secs: NOTE.SECS }),
  ] },
  // ---- the epilogue: the first Under New Management morning (its clock holds while it plays) --------------------
  { id: 'epilogue', trigger: { kind: 'epilogue', venue: 6 }, cards: [
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
  return BEATS.find(b => b.trigger.kind === kind && (kind === 'epilogue' || kind === 'note' || b.trigger.venue === venue)) ?? null;
}

// The save's seen list: known ids only, no duplicates (an old save has none: every beat is still to come). Council
// round 11: the note was the epilogue's first card, so a save that saw the epilogue has seen the note.
export function cleanStory(a) {
  const out = [...new Set(Array.isArray(a) ? a : [])].filter(id => typeof id === 'string' && Object.hasOwn(BEAT_BY_ID, id));
  if (out.includes('epilogue') && !out.includes('note')) out.push('note');
  return out;
}
// The first endless morning's clock holds while the epilogue's cards play (council round 11 #4): its card count × the
// card time, plus a breath. 3 cards × 4 s + 2 = 14 s.
export const EPILOGUE_HOLD = BEAT_BY_ID.epilogue.cards.length * STORY.CARD_SECS + 2;

// ---- the triggers (the server's morning, after the reveal and Today are dealt) -----------------------------------
// The cold open: day 1 at the Muni, a real crew (a skip-ahead test crew never sees it).
export const coldDue = ({ day, venue, endless = false, test = false }) => !endless && !test && day === 1 && venue === 0;
// The mid-venue morning: the first morning from the venue's second on that is NOT Promotion Day, has no Today modifier
// (the memo already carries Today's line: one text at a time), is not a reveal morning, and is not the Last Bucket's
// morning. A crew promoted before such a morning comes skips that venue's mid beat (the promotion beats stand alone).
export function midDue({ venue, venueDay, endless = false, promoDay = false, today = null, reveal = false, lastBucket = false, boss = false }) {
  if (endless || reveal || promoDay || today || lastBucket || boss ||   // council round 11: the MOW-E boss owns its day
      !(venueDay >= STORY.MID_FROM)) return null;
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
// Council round 11: a card's own secs / grace / min override the defaults; a press or skip inside a card's min is
// kept and acts when the min is reached; a beat's delay holds it in the queue (not ready) until it has passed.
export function createStoryModel({ now = () => Date.now() / 1000, secs = STORY.CARD_SECS, grace = STORY.GRACE_SECS } = {}) {
  const queue = [];   // [{ b, at }]: at = when it may begin
  let beat = null, i = 0, at = 0, want = null;
  const cur = () => (beat ? beat.cards[i] : null);
  const secsOf = c => c?.secs ?? secs, graceOf = c => c?.grace ?? grace, minOf = c => c?.min ?? 0;
  function start() { const q = queue.shift(); beat = q?.b ?? null; i = 0; at = now(); want = null; return cur(); }
  function next() { i++; at = now(); want = null; if (!beat || i >= beat.cards.length) { beat = null; return null; } return cur(); }
  function end() { beat = null; i = 0; want = null; return null; }
  return {
    // Queue a beat by id (unknown ids and a beat already queued or playing are ignored). True if queued.
    add(id) {
      const b = BEAT_BY_ID[id];
      if (!b || beat?.id === id || queue.some(q => q.b.id === id)) return false;
      queue.push({ b, at: now() + (b.delay ?? 0) }); return true;
    },
    get pending() { return queue.length; },
    get ready() { return queue.length > 0 && now() >= queue[0].at; },   // the next beat's delay has passed
    get beat() { return beat; },
    get index() { return i; },
    get card() { return cur(); },
    get up() { return !!beat; },
    get secs() { return secsOf(cur()); },   // this card's auto-advance time (the card's bar)
    get canPress() { return !!beat && now() - at >= graceOf(cur()); },
    // Start the next queued beat (the adapter calls this when say.js grants the turn).
    begin() { return beat ? cur() : start(); },
    press() {
      const c = cur();
      if (!beat || now() - at < graceOf(c)) return c;
      if (now() - at < minOf(c)) { want ??= 'next'; return c; }
      return next();
    },
    skip() {
      const c = cur();
      if (beat && now() - at < minOf(c)) { want = 'skip'; return c; }
      return end();
    },
    tick() {
      if (!beat) return null;
      const age = now() - at, c = cur();
      if (want && age >= minOf(c)) return want === 'skip' ? end() : next();
      if (age >= secsOf(c)) return next();
      return c;
    },
  };
}
