# Round 13 build, builder 4 ("fixes"): one morning, one memo, and the fixes pack

Council round 11 items #3 and #8 (`design/council-round11.md`). Builder 4 owns `say.js`, `board.js`, `bvtext.js`,
`goals.js`, `huddlerules.js`, `morning.js`, `server/venues/nudge.mjs`, `sim.js`, `clubdays.js`, `skip.js`, `venues.js`
and `index.html`. In `crew.mjs`, the work stays in the memo push in `startShift` and the two debut sites (plus one new
method, below). In `main.js`, it stays in the regions the council listed.

## #3: one morning, one memo

**The rule, enforced on the server.** A morning has at most one PA line, then the story beat, then one memo. Everything
else the morning used to say goes into the memo's second line, through `sim.js memoSecond`. The second line takes one
of these, by priority:

1. Today's line;
2. a NEW line: the venue on a reveal morning, or the kinds that open today;
3. MOW-E's line (`crew.moweMemo`, set by builder 1 and used for one morning only);
4. the flavour.

The flavour is still drawn every morning, so the RNG order doesn't change.

- **Reveal memos fold.** `VENUE_RULES[v].memo` is now the venue's NEW line, as the council's table words it (each line
  is 8 words or fewer). `revealCards()` returns `[]`, so the reveal plays no memo cards (`round2.js` needed no edit).
- **Kinds are told in the morning.**
  - `sim.js` adds `kindOpen`, `kindsOpening(day, venue, vday, seen)`, `KIND_NEW`, and `kindNewLine`. When two kinds
    open the same morning, they get one combined line: "NEW: bouncy balls ×1.5 and splitters.".
  - `pickKind` reads `kindOpen`. It still takes one draw, as before.
  - The kinds that open today join `debuts` at the morning, and the memo event carries `kinds`.
  - New method `crew.debutHit(kind, b)`, next to `storyBeat`. A kind's first hit emits
    `{t:'debut', kind, told, id, x, z}`.
  - The client shows no memo for a debut. It plays the jackpot sting and floats "NEW ×1.5" over the ball once it lands.
    If the memo didn't name the kind (it lost to the venue line or to Today), the float names it:
    "NEW: square ×2".
  - Only glow keeps its PA (the Last Call cue). The square, gold, lead, splitter and bouncy PAs are cut.
- **Club day 3 belongs to MOW-E.** `CLUB_DAY.bouncy` moves from 3 to **4**, and `CLUB_DAY.splitter` is new at **4**.
  The splitter stays at global day ≥ 7 outside the Club.
- **A story morning's memo shows for 5 s** (`SAY.STORY_MEMO`). The server flags the memo `story: true`, using the same
  pure checks (`coldDue`, `midDue`) that `startShift` uses.
- **The Last Bucket morning is quiet** (8.4). The memo is `quiet` when Ball No. 1 begins (or is already on the ground)
  this morning, so the BALL NO. 1 banner is the one text.

### Measured: `scripts/bots/textload.mjs` (new)

The bot replays each morning's real server events through the client's own `createSayModel` and
`createStoryCard` (4 s a card). It covers a 4P ladder:
- Muni days 1–5 (a fresh crew);
- Club days 1–5 (`club1`);
- each later promotion morning (`tiered1`, `stadium1`, `county1`, `orbital1`) and the morning after it;
- the Last Bucket morning;
- endless days 1–2.

It uses seeds 7, 11 and 23. `REPO=<tree>` measures another checkout: the baseline is `git archive HEAD`.

| | HEAD (before) | now | target |
| --- | --- | --- | --- |
| promotion mornings, longest | **46.4 s, 5 items** | **24.8 s, 3 items** | ≤ 28 s, ≤ 3 |
| Club day 1 (the promotion morning) | 41.4 s | 24.8 s | ≤ 22 s ✗ |
| Club days 2 / 3 / 4 | 31.3 / 7.6 / 7.6 s | 17.3 / 7.6 / 7.6 s | ≤ 22 s ✓ |
| Tiered / Stadium / County / Orbital promo | 44.4 / 46.4 / 45.6 / 44.1 s | 22.8 / 24.8 / 24.0 / 22.5 s | ≤ 28 s ✓ |
| Last Bucket morning | 7.6 s (the wrong "clear the sky" memo) | 0 s (the banner only) | quiet ✓ |
| mornings with 2+ memos | 22 of 63 | **0 of 63** | 0 ✓ |
| the memo (today's target) first reads | 17.5–19.8 s on promo mornings | same | |

**One miss: Club day 1 is 24.8 s, against the 22 s target.** It is a promotion morning, and it makes that morning's
28 s target. The morning is made of:

| Item | Time |
| --- | --- |
| The `club` PA | 7.4 s (its spoken line is 15 words) |
| Three 4 s story cards | 12 s |
| The 5 s memo | 5 s |
| The gaps between them | ~0.4 s |

None of these is mine to cut. Two cuts would fix it:
- a shorter `club` PA line (`pa.js`, builder 1), which saves about 2.4 s;
- a 2-card Club promo beat (`story.js`, builder 2).

I didn't shorten the memo below 5 s. It carries the day's target.

## #8: the fixes pack

| # | Fix | What was done | File |
| --- | --- | --- | --- |
| 8.1 | Jumbotron flip | `bvtext.js` adds `skeleton`, `shouldFlip` and `kpiNoteOf`. A flip restarts only when a field's skeleton changes (digits read as `#`), never in the middle of a flip, and never for a price move under 1 %. | `board.js`, `bvtext.js` |
| 8.1 | Hooks | **`board.overlay(fn \| null)`**, built early for builder 2's newsreel. `fn(ctx, W, H, t)` paints over the canvas at the flip's 20 Hz. A throwing `fn` is dropped. | `board.js` |
| 8.1 | Venue gauge note | The venue gauge's label shows a live note from `kpiNote` (`main.js` passes `kpiNoteOf(s.mods)`): the County's `mods.county.label` ("ZONING 37% · 4 HAZARDS"), or the Stadium's `mods.stadium.req` (a string, `{label}` or `{sec, t}`, giving "SECTION C WANTS A BALL · 0:18"). | `board.js`, `main.js` |
| 8.3 | Carry banner | Reads `BALL NO. 1 · HOME · 3/4 · WAITING: RAT2 +1`. It names one Rat ("YOU" first, names cut to 8 characters) plus a count. Solo reads `BALL NO. 1 → THE RETURN`. At most 46 characters at 1–6 Rats, and `index.html` adds a `max-width` with an ellipsis as a backstop. | `huddlerules.js`, `index.html` |
| 8.4 | Last Bucket memo | Quiet (see #3). | `crew.mjs` memo |
| 8.5 | Basket line during the huddle | `morning.js standDown`. The morning deal and the day's suggestions stand down, with no deal and no snapshot line, while Ball No. 1 is down, carried or in the huddle, and while `bossLive(crew.mower)`. Gary's lines are kept. | `morning.js`, `nudge.mjs` |
| 8.6 | Card fading in over another | The DOM adapter waits for the outgoing card's `transitionend`, at most 0.3 s after the next card is due. The stamp never waits. A story card taking the turn snaps the outgoing card off (`transition: none`). The story card's own fade-out counts as an outgoing card when it releases the turn. **Browser-verified** on a County promo morning: the PA card's opacity goes to 0 the moment card 1 shows. Before, it stayed at 1.0 under the cards (C #6). | `say.js` |
| 8.7 | Seal row | "Earn Gary's Seal: huddle at the return". | `goals.js` |
| 8.8 | Sky row | "Clear the sky · 57 debris up" (`skyPieces`: 10 balls a piece, 15 solo). A landed bag or a winched piece floats "+10 balls home" over the Lift. While Ball No. 1 waits on an unbought winch, the strip reads `SKY CLEAR · WINCH $13.2M · YOU HAVE $9.1M`: buy rows now carry `price` and `cash`. | `goals.js`, `bvtext.js`, `main.js` |
| 8.9 | Gary's hello | His bubble holds the hello for his whole wait at the gate. It pops once (a 0.5 s scale bump) when I first come within 8 m. | `main.js` (Gary region) |
| 8.10 | Helper falls | New `feedagg.js`. The first fall shows at once; the rest of that minute fold into one "Helpers flattened ×N" line. | `main.js` (feed) |
| 8.11 | Balls at dusk | From T−90, resting balls more than 15 m from the camera draw ×1.25. The ball material gets an emissive lift of 0.35. The lift is material-wide: no new draw call and no per-instance shader. | `main.js` (`drawBalls`) |
| 8.12 | HUD pocket | Counts the server pocket plus pending picks that aren't souvenirs or hazards. Souvenirs in hand show as their own `★N ×2` chip. | `main.js` (HUD) |
| 8.13 | Lobby tagline | One per venue (`sim.js LOBBY_TAGLINE`, each 8 words or fewer). Browser-verified at the Stadium. | `sim.js`, `main.js` |
| 8.14 | Rejoin after a skip | Picking a skip preset clears `range-rat.seat` (`skip.js clearSeat`). | `skip.js` |
| 8.15 | Lobby camera | The camera sits 6 m back (+z) from Tiered on. That's broader than "Orbital and Last Bucket", because the Stadium lobby was inside the deck pillars too. Browser-verified: a clear view at the Stadium (`c11-fixes-lobby-stadium.jpg`). **Not done:** the black canopy slab seen from the Lift. I couldn't identify the mesh without a Lift ride, and the council marked it "if time". | `main.js` |
| 8.2, 8.16 | | Builders 1 and 3. | |

## Tests

- New file **`test/round13fixes.test.mjs`** (10 tests):
  - word counts: every NEW line, venue memo, pair line and tagline is 8 words or fewer;
  - Club day 4;
  - the `memoSecond` priority;
  - a server morning: one memo, the kinds told, `told` on the first hit, no kind PA;
  - the Last Bucket morning is quiet, and a story morning's memo is flagged;
  - 8.1 flips;
  - 8.6 (the fade wait and the story snap);
  - 8.7 and 8.8;
  - 8.10.
- Additions to existing files:
  - `test/huddle.test.mjs`: 8.3 width at 1–6 Rats; 8.5 stand-down (pure and server).
  - `test/skip.test.mjs`: 8.14.
- Edited existing assertions, each for a change the council ordered:
  - `kinds.test.mjs`: debuts join at the morning;
  - `feel.test.mjs`: bouncy is on Club day 4;
  - `round2.test.mjs`: the gold PA is cut;
  - `seam.test.mjs` (the `revealCards` assertion only, not a golden);
  - `sky12.test.mjs`: pieces.

## Goldens

The Club fingerprint moved. Its **only** cause from my changes is `CLUB_DAY.bouncy` going from 3 to 4. I checked this:
putting `bouncy` back to 3 (with the splitter held back) gives exactly `ba21dc31` again. My Club value was `3b901b8a`
(snags off: `fb8d71a0`). Builder 1's MOW-E work also moves it, so the lead re-records once. The Muni golden is
unchanged.

## Full suite at hand-off

1097 pass, 6 fail. None of the failures is mine:
- **Builder 1's `stepMowe`.** `deck.test` "a filled order pays…" fails. With `Crew.prototype.stepMowe` stubbed to a
  no-op it passes, so the cause is the tame pass at every venue. The record-PA and endless-pace failures I saw earlier
  also pass with that stub.
- **`round2.test` "Gary visits the kitchen…"** expects no Gary on that Club day. It looks like the boss-day Gary slip
  (`garyvisit.js`, builder 1).
- **The three seam goldens** (above).
- **`server.test` "a crew: create, join…"** fails only in the full run. It passes alone.

## Open issues

- **Club day 1 is 24.8 s, against the 22 s target** (see the table). Needs a shorter `club` PA or a 2-card beat.
- **Flavours longer than 8 words.** The memo flavour lines in `crew.mjs` `MEMOS` (e.g. "Dimples asks that you keep the
  mats clean. Dimples is a golf ball.") are over the second line's 8 words. They're outside my region.
- **The Stadium Board shots.**
  - The County Board read **5 of 5** in a fronted pane: the price ticks in place with no scramble, and the Zoning note
    shows (`c11-fixes-county-board.jpg`).
  - The Stadium shots couldn't be finished. Other builders' tabs kept taking the pane, the Stadium reveal camera stalled
    with it (rAF), and the view never left the reveal pose.
  - **Re-check the Stadium Board in a fronted pane**, and the reveal camera along with it. A
    `THREE.Quaternion.setFromEuler unknown order` warning floods the console at the Stadium; I didn't trace it, and the
    code isn't mine.
- **8.6 on the Xbox.** It still needs its one Xbox check (council: a slow frame).
- **8.11's emissive lift is material-wide.** A per-instance lift for far balls only would need a shader patch.
- **8.15's canopy slab.** Open (see the fixes table).
- **`game-design.md`** isn't updated by me. That's for the lead's merge commit.
