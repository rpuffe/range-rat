# Round 13 build, builder 2 ("story"): the note at the huddle, and show, don't tell

Council round 11 items #4 and #7 (`design/council-round11.md`). Both story threads kept word for word except where
the council named a change; the delivery moved to where the crew is already looking.

## What I built

### #4 The note at the huddle
- **`story.js`**: the epilogue is split. `note` is one card, INSIDE BALL No. 1 · 1958, "Whoever finds this: the
  range is yours.", in the new `note` style. Ⓐ works after 2 s, it stays at least 5 s (an earlier Ⓐ or Ⓑ is kept and
  acts at 5 s), and it moves on by itself at 7 s. `epilogue` is the other three cards (Gary's bucket, Dimples retiring,
  the sign).
  - `cleanStory` counts `note` as seen when a save saw `epilogue`.
  - A save that banked but reloaded before the note gets `note` first on the first endless morning.
- **The story model** gained per-card `secs` / `grace` / `min` and a per-beat `delay`. The note waits 2.8 s in the
  queue so the crack plays first. `ready` replaces `pending` in the card's turn request.
- **The bank sequence** (`round2.js`, timings in `story.js BANK_SEQ`):
  1. At 0 s: confetti and the roar, as before.
  2. At 1.2 s: the hush. The floods go off and the ambience ducks (`SFX.duck`). That leaves 0.8 s of near-silence.
  3. At 2.0 s: `ending.crack()`. Two gold halves hinge apart over 0.6 s, a curl of paper rises 0.4 m, and a warm
     light comes up. That's 3 meshes, built only now.
  4. At 2.8 s: the note card and one bell strike (`SFX.bell(392)`).
  5. When the note's beat ends: the $∞ scramble. The PA "No more balls. Every ball mattered." still waits for the
     digits.
  6. The end card waits on the finale's promise (the fixed 7 s is gone).
  - With no note coming (already seen), the finale starts at 3.1 s. A 16.8 s cap means nothing can stick.
- **Server** (`crew.mjs`):
  - `depositOne` emits `banked` → `story note` → `pa last`.
  - The epilogue morning sets `revealT = EPILOGUE_HOLD` (14 s), which is the held clock the reveal already uses.
    Shift time, customers and the Today deal stand still until it runs out.
  - It holds only when the epilogue actually plays.
- **The storycard → world seam.** `storycard.js` fires a window event, `rr-story` `{id, index, phase: 'card'|'end'}`,
  for each card shown and each beat that ends. `round2.js` and `views/orbit.js` follow the cards through it, so
  `main.js` needed no change.

### #7 Show, don't tell
- **`founder.js`** (new, pure canvas):
  - `drawFounder(g, w, h, t, {sepia, grain, circle, seed})`: a flat-cap golfer swings, and the ball is a white dot that
    climbs off the top of the frame.
  - `drawNewsreel(g, W, H, t)`: 12 s. A 3-2-1 leader, the founder swings in black and white, the camera pans up, the
    ball slips away, and "…and it never came down." ends on an empty sky. It has grain, a flicker and a scratch.
- **The photo cards.**
  - Muni mid card 1 shows the 160 × 100 sepia photo inside the caption card, still one centre element. The swing plays
    once across the card's life at the card's 10 Hz tick.
  - Orbital mid card 1 shows the same photo with the dot circled in red pencil.
- **The jumbotron newsreel.** When the Stadium promo's first card shows, `round2.js` calls
  `board.overlay(drawNewsreel)`, then `overlay(null)` after 12 s. This uses builder 4's hook, which redraws at the
  flip's 20 Hz.
- **Story edits:**
  - Stadium promo: the caption stays. "The founder swings…" is cut. GARY **"Nice jumbotron. Don't get a big head."**
    and MEMO **"Site 13 sells tickets to its jumbotron."** are added.
  - County promo: GARY "I was a Range Rat. Here. 1987." goes first (5 s min), then the two acquisition memos.
- **Gary in the world** (`views/garycameo.js`, new, driven from `views/orbit.js`, which is live at the Orbital and in
  endless):
  - **Orbital promo**: from the beat's first card, Gary rides the Lift car's **roof** up and back once: 30 s, 26 m up.
    He turns slowly, and the tie flaps harder near the top. He's on the roof because the car is a closed box.
  - **First endless morning**: from the epilogue's first card until the bell, Gary stands beside the return with a
    blue bucket and a loose tie. The first Rat (any Rat) within 3 m gets his world bubble, "Where do these go, boss?",
    for 5 s, once.

## Numbers
- Note: grace 2 s, min 5 s, auto 7 s, delay 2.8 s. Bank: hush 1.2 s, crack 2.0 s (0.6 s hinge, paper 0.45–1.4 s).
- Epilogue hold: 14 s (3 × 4 + 2).
- Newsreel: 12 s (leader 0–1.6, swing 1.6–6.4, pan 6.4–10.6, end card 10.6–12).
- Lift ride: 30 s (board 0–3, up 3–11, view 11–19, down 19–27). Bubble radius 3 m, 5 s.

## Measurements
- **Headless, the `lastbucket` preset at 1P, 2P and 4P** (`test/story.test.mjs`, seed 7):
  - the order is `banked → story note → pa last` at every size;
  - on the first endless morning, shiftT is still at its start value at 13 s and moving at 15 s;
  - **0 customer spawns during the hold**;
  - the note does not replay.
- **Browser** (rr-tex2, `lastbucket` preset, solo; the pane was *hidden*, so rAF ran at ~1 fps and the timers ran on
  time):
  - the bank → the note → the scramble → the end card played in order;
  - the clock read `T 0` with `revealT` counting 3.8 → 0.6, then `T 2.6` after it;
  - Gary stood at the return, and his bubble showed when I walked up.
- **Shots:**
  - `design/shots/c11-story-note.jpg`: the note card, the only centre element.
  - `c11-story-scramble.jpg`: $∞ with the PA card under it as the digits fade (see open issues).
  - `c11-story-endcard.jpg`.
  - `c11-story-gary-return.jpg`: Gary at the return with his bubble.
  - `c11-story-newsreel-frames.jpg`: four newsreel frames drawn to a test canvas in the page, not on the Board.
- **Gary in the Lift**: confirmed in the scene graph on a live `orbital1` crew. `gary-cameo` is visible at
  (−44, 3.15, 5), the car's roof. I couldn't screenshot it, because the hidden pane's ~1 fps rAF kept the reveal
  camera for minutes.
- `?perf` not measured (hidden pane). The newsreel costs one 1024 × 512 canvas redraw at 20 Hz, through b4's
  throttle.

## Files touched
- Mine:
  - `web/js/story.js`, `web/js/storycard.js`, `web/js/ending.js`, `web/js/round2.js`, `web/js/views/orbit.js`;
  - new: `web/js/founder.js`, `web/js/views/garycameo.js`.
- `server/crew.mjs`, my regions only:
  - the epilogue line in `startShift` (note-if-missed and the hold);
  - `depositOne` (the note beat, plus **builder 3's records reset**: `yesterday`, `streak` and `owner` are cleared,
    `cash` stays as "Best ever").
  - **Outside my regions:** one word added to the `story.js` import line (`EPILOGUE_HOLD`).
- Tests:
  - `test/story.test.mjs`: updated for the split, plus 9 new tests: the note card, the delay/min model, the County and
    Stadium edits and the photo flags, old-save migration, the bank order at 1/2/4P, and the held morning at 1/2/4P;
  - new `test/founder.test.mjs` (3 tests);
  - `test/round2.test.mjs`: the endless test now runs 14.5 s for the reveal (the hold), not 6.5 s.
- `design/game-design.md`: a "Council round 11 (builder 2)" section appended.

## Goldens
**Not moved by my changes.** The story beat draws no RNG. The note and the hold only touch the bank and the first
endless morning, and the Muni/Club goldens never reach either. The three GOLDEN failures, the deck order test and the
Gary-kitchen test were red in the shared checkout before I finished. They sit in other builders' areas.

## Open issues
1. **The $∞ flash and the PA card overlap** for ~0.6 s while the digits fade (pre-existing `afterFlash` timing). The
   PA card is also still up, dimmed, under the end card. The end card could wait for the PA card to close too. That
   needs a say.js "PA idle" signal (builder 4).
2. **The first endless morning: the PA card and the morning memo showed together** in one screenshot after the
   epilogue released the turn (`Fries are free…` over `Under New Management…`). That's the say.js queue (builder 4's
   8.6), not the story card.
3. **Gary at the return isn't restored on a rejoin.** He's started by the client's own epilogue card. A Rat who
   reloads mid-morning doesn't see him. A snapshot flag (`firstOwnerDay`) would fix it.
4. **The crack** shows at the hopper's lip behind the chute's glass from most angles. It reads as a gold glow, not a
   clear locket. Lifting it to y ≈ 1.9 or angling it toward the stand's front would help. Needs a fronted-pane look.
5. **Wording deviation.** The council's Gary line "Nice jumbotron. Don't let it go to your head." is 9 words. I used
   **"Nice jumbotron. Don't get a big head."** (7).
6. **Still to check with the pane fronted:** the Lift ride, the photo card in place, the jumbotron mid-newsreel with a
   card under it, `?perf` at the Stadium, and the note's Ⓐ on a pad.
