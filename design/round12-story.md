# Round 12: story beats

The owner asked for "better story beats" and picked both threads: **the heart** (Gary was a Range Rat in 1987, and
the founder's Ball No. 1 never came down) and **the comedy** (Corporate's memos, the rival crew Site 13, Dimples'
rebrands). The full beat sheet, every card's text, is in `game-design.md` under "Round 12: story beats".

## What was built

- **A pure beat table** (`web/js/story.js`, no THREE, no DOM). 13 beats: the cold open, a promotion beat for each of
  venues 1 to 5 (the Muni's arrival is the cold open), a mid-venue beat for each venue 0 to 5, and the epilogue. Each
  has 2 to 4 cards of 8 words or fewer, spoken by MEMO (the Office of Ball Value, with Dimples' seal), GARY, PA or a
  plain caption. It also holds the trigger rules (`coldDue`, `midDue`), Gary's venue lines (`garyHello`, `garyBye`)
  and the card sequence model (`createStoryModel`).
- **The server** (`server/crew.mjs`). `storyBeat(id)` plays a beat once per crew: it records the id in `this.story`,
  which is saved as `story` (an old save loads with none, and unknown ids are dropped), and emits `{t:'story', id}`.
  The triggers all run in `startShift`:
  - the cold open on day 1 at the Muni, for a real crew only (`test` crews never see it);
  - a promotion beat after the reveal's PA line;
  - the epilogue on the first Under New Management morning, before its PA;
  - the mid-venue beat on the first plain morning from the venue's second (see the rules below).
  It draws no RNG and touches no sim state.
- **The client card** (`web/js/storycard.js`). One card at a time; Ⓐ / Space / Enter / a click advances (after a
  0.4 s grace), Ⓑ / Esc skips the beat, and a card moves on by itself after 4 s. It is styled like the PA card and the
  memo: paper and Courier with Dimples' seal for MEMO and PA, a clipboard for Gary, and a dark serif card for
  captions. It has progress dots and a draining bar. It is not a menu: it takes no focus, the pad's menu walk never
  sees it, and it never touches full screen or the pointer lock. A menu that is open keeps its Ⓐ.
- **say.js: the story turn.** `want()` / `release()` / `gate`. While the card waits, only PA lines may still show,
  and a memo already up finishes. Once the turn is granted, nothing else shows until release, except the bell's stamp,
  which preempts and skips the card. When nothing is up, the turn is granted at once. That is why the cold open and
  the epilogue go before their PA lines, while a promotion beat waits for the reveal's PA. `textBusy` includes the
  card, so the checklist and the nudge step aside.
- **Gary** (`web/js/main.js`). His hello shows in his world bubble while he waits at the gate, and his sign-off goes
  to the feed after his verdict. Both change with the venue, and both use his existing visit events.
- **Treasures** (`web/js/dive.js`). Three blurbs are reworded: the memo (1958, "UP"), the VHS (1987, a young Gary) and
  the Dimples pin ("From before the monocle"). Ids, order and mechanics are unchanged, and the trophy and scorecard
  lines stay as they were.
- `pa.js` now exports `drawSeal`, so the card can reuse the Dimples seal.

## The trigger rules

- **Cold open:** `day === 1 && venue === 0`, not endless, not a test crew.
- **Promotion:** the reveal morning of venue 1 to 5. A skip-ahead preset carries `pendingReveal`, so a test crew sees
  its starting venue's beat.
- **Mid-venue:** `venueDay >= 2`, and none of the following that morning: Promotion Day, a Today modifier, a reveal
  morning, endless, or the Last Bucket. If a morning doesn't qualify, the beat waits for the next one that does.
- **Epilogue:** the morning `endlessFresh` is set, after the $∞ finale and the end card's "Clock in tomorrow". The
  existing finale sequence is untouched.

## Files

New: `web/js/story.js`, `web/js/storycard.js`, `test/story.test.mjs`, `design/round12-story.md`,
`design/shots/story-cold.jpg`, `design/shots/story-promo-stadium.jpg`, `design/shots/story-gary-orbital.jpg`.
Changed: `server/crew.mjs`, `web/js/say.js`, `web/js/main.js`, `web/js/pa.js` (export only), `web/js/dive.js`
(blurbs), `design/game-design.md`.

## Tests

`test/story.test.mjs` has 20 tests:
- every line is 8 words or fewer;
- the beat shape (2 to 4 cards, known speakers);
- each venue 0 to 5 has a promotion beat and a mid-venue beat;
- the cold open and the epilogue have the right content;
- every promotion beat carries both threads;
- the trigger rules, including that Promotion Day and a Today modifier hold the mid beat;
- the server plays a beat once and saves it, and a reload doesn't replay it;
- a test crew skips the cold open but gets its promotion beat;
- the event order against the PA lines;
- old saves load;
- storyBeat draws no RNG;
- the card model's grace, auto-advance and skip;
- the say turn.

`node --test test/`: 1064 pass (1044 before). The seam goldens did not move.

## Verified in the browser (rr-play-a, :8094)

- A new crew: the cold open shows first, Space advances it, and the welcome PA follows.
- Skip ahead to the County, the Stadium and the Orbital: each venue's promotion beat follows the reveal PA. Esc
  skipped the beat without opening the pause menu, and the morning memo came next.
- The Orbital's beat opens with Gary's clipboard card.

## Open issues

- **The epilogue was not played through in the browser.** That needs the Last Bucket huddle. Server tests cover its
  trigger and its order before the PA.
- **The pad path was not tried on a real controller.** Ⓐ and Ⓑ go through the same `press` and `skip` as Space and
  Esc, which were checked.
- **Gary's bubble hello and feed sign-off were not seen live,** because no Gary day was played.
- **The reveal's "Day N · venue · you are a …" toast (a TOAST, 3 s to live) is usually dropped** while the promotion
  beat holds the centre. Its venue name and title are also on the reveal memos and the sign.
- **A busy promotion morning is text-heavy:** the reveal PA, three story cards, two reveal memos, then the morning
  memo, one at a time. If that feels long, the reveal's first memo (the write-off line) could make way for the beat.
- **In the browser pane the PA card's fade-out could still be on screen** in a screenshot taken just as a story card
  appeared. The class trace shows the PA card turned off 0.4 s before the story card turned on. The pane renders a slow
  frame rate under WebGL load, so this is a fade still finishing, not a real overlap.
- **A crew promoted before a plain later morning skips that venue's mid beat.** This is by design, and it can happen
  at the County with its two good days. The Gary reveal ("I was a Range Rat") is in the County's promotion beat, so
  it always plays.
- **The "Previously on Range Rat" card does not recap the story so far.** A line for the last beat seen could go there
  later.
