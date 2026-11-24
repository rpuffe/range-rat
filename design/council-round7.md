# Fun Council, round 7: every venue goal needs the crew, one text at a time

This is the record of Range Rat's seventh Fun Council (2026-11-24, the evening after playthrough 2 on build d66602a).
Rounds 1–6 still bind wherever this record doesn't change them. Where they disagree, this record wins.

**The owner's firm calls (unchanged, binding):** multiplayer first (up to 6, balanced for 4, no assigned roles;
suggestions and nudges are fine) · one day = one shift · knockdowns when a ball hits you · scuba should be fancy · no
named balls · rare PA lines, big events only · the kitchen serves fries, hot dogs and beer · at Tiered, overserving
beer makes a lounger fall off the top deck · the shop opens any time · Xbox controller, Xbox Edge as the performance
floor · every feature "actually worth it and meaningful" · **one text element in the middle of the screen at a time,
about 8 words** · for decisions, the more fun and easier option for a casual crew of 4.

**The council (same seats as rounds 5 and 6).**

| Seat | Lens |
| --- | --- |
| **Game Designer** (G, chair) | Moment-to-moment fun; does each venue play differently? |
| **Systems/Economy Designer** (E) | Prices, quotas, fees, income per shift, pacing |
| **Multiplayer/Co-op Designer** (M) | Join, leave, rejoin, six players, solo |
| **Level Designer** (L) | Readable spaces, one map rule per venue |
| **Technical Director** (T) | Server-authoritative, zero deps, core vs new files, Xbox frame time |
| **Casual Crew of 4** (C) | Four friends on a sofa, some on Xbox pads in Edge |
| **QA Lead** (Q) | Reads the code for bugs, dead ends and softlocks; nothing counts until it's reproduced |

Ties go to the chair.

**What the council read and ran:**
- `design/playtest-round2.md` (three fresh playtesters on the round-6 build, with their "Ideas for council 7"),
  `design/scorecard.md`, round 6, and the last sections of `game-design.md` (round 4's venues, the full-game playtest,
  the round 6 build).
- The code: `server/venues/tiered.mjs`, `stadium.mjs`, `county.mjs`, `orbit.mjs`, `deck.mjs`, `nudge.mjs`;
  `web/js/tiered.js`, `stadium.js`, `county.js`, `orbit.js`, `deck.js`, `rally.js`, `aim.js`, `nudge.js`,
  `promopanel.js`, `pa.js`, `views/tiered.js`; and in `server/crew.mjs`: `startShift`, `rallyNeed`, `stepHelpers`,
  `stepGary`, `beginLastBucket`, `stepLastBucket`, `stepHuddle`, `endShift`; in `web/js/main.js`: `toast`,
  `toastQuiet`, `showMemo`, `textBusy`, the `lastcall`/`rally`/`quota` cases, and the hinter gate.
- **Already in hand, not re-planned here:** every finding marked ✓ in the playtest (commit 5d21581), and playtester A's
  15 listed bugs, which a builder is fixing now (the rally naming the mats as a group and re-checking after 30 s, Gary
  and the huddle ring, the 1.7 s countdown, the record PA in the bell's tick, "Run over", the wand prompt, the Gary
  verdict toast, the ledger, the Club roof, the report bar, the lobby line). Round 7 builds on top of that branch.
- Seven headless scripts against the real `Crew` (scratchpad `council7/`). They edit no game code: rule variants are
  emulated by mutating exported constants (`GUTTERS`, `SLICE`, `DECK`), subclassing `Crew`, or acting on module state
  from outside.
  - **`gutters.mjs`, `gutters2.mjs`**: Tiered, 4P, four teenagers, nobody shooting, seeds 1–3. Cups and Bay
    Utilization at Last Call and the bell, by gutter rule. A shooter is emulated by resting a crew ball in a bowl through
    the real `tiered.onRest`.
  - **`stadium.mjs`, `stadium2.mjs`**: Stadium, 4P. Cart 0 is driven round the Track's ellipse in chosen windows.
    Sentiment at the bell and its 2-minute mean, with and without a 3-laps-a-minute cap.
  - **`county.mjs`, `county2.mjs`**: County, 4P, four teenagers. Strays at the bell for an idle crew and a "tidy" crew (a
    sweeper clears the main field every 15 s), with teenagers on or off the lawns, slice chance 0.40 / 0.20 / 0.15 /
    0.12, one Yards run with a push picker, and drones.
  - **`orbit.mjs`**: two Orbital shifts from 1,958 outstanding, with and without the tether.
  - **`endless.mjs`**: endless at 4P with everything bought, and customers swinging 25% and 56% more often.
  - **`deck.mjs`, `deck2.mjs`**: the Upper Deck with a cook at the shed who pours 16–24 s after an order opens, careless
    or careful, with 20 s or 30 s windows, and with "round" orders.
  - **`muni.mjs`**: Muni days 2–6, 4P and solo, by hosing plan, with mat scuff ×1, ×0.6 and ×0.5.

---

## 0. What the numbers say before any idea is judged

**N1 · Each venue's automation is an off switch, and each venue's chore is either free or impossible.**

| Venue | No automation, nobody on the chore | Today's automation | What one Rat can do by hand |
| --- | --- | --- | --- |
| Tiered | Bay Util **0.00** at every bell (38–58 balls in cups) | Gutters: **1.00** at every bell, cups 0/0/0 | One TARGET at 380 s: 0.00–0.47 (it flushes one cup of three) |
| Stadium | Crowd 0.20 at the bell | (none) | 60 s of laps at Last Call: **0.70**, a pass |
| County | 82–113 strays (0.00) idle; **8–19 (0.37–0.73) if the main field is tidy**, because the teenagers walk into the Yards | Drones | One Yards run at Last Call (60 strays) still leaves 41–52 (0.00) |
| Orbital | 57 debris on day 1, 60 (the cap) by day 2 | Tether: 6–8 debris (0.73–0.80) | An EVA bag of 10–40 |

- **Tiered.** Cups fill at only 0.03–0.05 balls/s each (0.10–0.14/s in all), so any drain rate holds the gauge. 1.0/s,
  0.5/s and 0.2/s (B's proposal) all end at 0.97–1.00. 0.1/s ends at 0.73–0.87, still a free pass. Only 0.03/s is in
  play, and it is erratic (0.00–0.77). Switching the gutters off for Last Call gives 0.50–0.60: a coin flip.
- **Stadium.** The crowd is a level that a sprint can top up, so the last minute is the only minute that matters
  (C's finding, reproduced). A cap of 3 full-value laps a minute still passes a 60 s rally (0.54). What fails a pure
  last-minute rally is grading **the last two minutes' mean**: 60 s of laps at Last Call gives a mean of 0.37–0.39; 60 s
  starting at the 2-minute mark gives 0.63–0.64; a 30 s stint every 2 minutes gives 0.90–0.95.
- **County.** Today's slice (40% of shots, curve 1.0–2.0) sends ~100 balls a shift into the Yards at 4P with the
  blimp. With teenagers kept off the lawns, the chore is impossible by hand. At **slice 0.15** with teenagers off the
  lawns, an idle or tidy crew ends at 30–43 strays (0.00), one Yards run at Last Call ends at 4–7 (0.77–0.87), and two
  drones hold 0.87–1.00 (measured at slice 0.12 and 0.20).
- **Orbital.** The stamp pays only the 15% bonus ($2.4–2.8M a shift with the tether). The Last Bucket arrives on day 3
  with or without it. The gauge's real effect is on Ball Value (Upkeep +0.5 × gauge): 1,958 × BV is **$27.4M without
  the tether, $32.8–33.3M with it**.

**N2 · The Upper Deck's 20 s window is a cliff.** A cook who pours 16–18 s after the order fills 14 of 15 orders. At
24 s (a 10–14 s pour plus the walk, B's measurement) the same cook fills 0 of 13, so drinks never climb and nothing
falls.
- A **30 s window** at 24 s: a careless cook (no food) fills 14 of 14 and has 1 incident. A careful cook (a hot dog at
  amber) fills 13 of 14 and has 0.
- The fine (100 × BV) is 22–23% of an idle crew's shift cash, against a tab of 8–10%. One fall wipes out the whole
  evening's tabs, so a careless cook isn't "about even" as round 6 intended.

**N3 · More customers don't break the endless record.** With everything bought and the crew idle, endless banks
$20.8–22.7M a shift. Swinging 25% more often gives **$17.8–18.3M**: the field fills (435 balls left, not 228), mats
scuff and the pond sinks. C's active crew made $63–67M, and the difference is Hustle (pings and TARGETs). In endless,
skill is the limit, not supply. Round 6's "second blimp" sketch would *lower* the record.

**N4 · The Muni rhythm works if anyone hoses after the morning** (A's idea 3, measured with an idealised hoser at
0.08 mud/s and 3 s between fixtures):
- One Rat on the hose all day: **1.48**, which passes days 2–6 (targets 1.30–1.40).
- A 60 s hosing lap every 2 minutes: 1.44–1.48.
- All four hosing only for the last 60 s: 1.49.
- The plan that fails is morning-only: day 2 passes at 1.33, then days 3–6 end at **1.30** against 1.30–1.40 (missing
  by less than 0.01 on days 3–4).
- "10 mats scuff faster than one Rat can hose" is not reproduced. The day-3 miss is a crew that stopped hosing, and
  the fixed rally ("Hose the mats before the bell!") now names it 60 s out.
- Softening scuff to ×0.6 makes morning-only pass days 2–5: it would *remove* the mid-shift job.

**N5 · Text load (5.0) is a plumbing problem, not a copy problem.** Seven separate DOM elements can put text in the
middle of the screen: the PA card, the memo, the toast, the hint chip, the context prompt, the bell stamp and the
rally (a toast). They're ordered by five ad-hoc waits: `textBusy`, `toastQuiet`, the memo queue, the hinter gate and
`setTimeout(…, 400)` retries. There are 47 call sites (`main.js` 28, `round2.js` 10, views 9). Every stack the testers
saw was two of these racing. Fixing them one at a time is how rounds 3–6 went, and it keeps coming back.

---

## 1. The playtesters' ideas: verdicts

**Adopt** = build as proposed · **Adapt** = build the council's version · **Reject** = no, with the reason ·
**In hand** = already fixed or being fixed. "→ #n" points at the build list (§2).

### Playtester A (a new crew to the Range Club)

| # | Idea | Verdict | Why, and the seats that mattered |
| --- | --- | --- | --- |
| A1 | The rally names the biggest Upkeep loss (the mats grouped); re-check after 30 s | **In hand; extended** (→ #4) | The A-bug builder is landing exactly this (`shortfall` compares each term's real Upkeep cost; `RALLY_RECHECK` 30). #4 deals the ranked list round the crew, so the second-biggest job gets a Rat too |
| A2 | Gary never runs over the huddle on any leg; 3·2·1 from when he leaves the mats | **In hand** | A's bugs #2 and #3 |
| A3 | A 4P hosing rhythm: soften mat scuff at 4P, or a day-3 memo "Someone stays on the hose" | **Adapt** (→ #4) | N4: the rhythm already works for anyone who keeps hosing. Softening scuff deletes the mid-shift job, and **E** won't trade a chore for a free stamp. A memo is one more centre text. **M:** the co-op problem is that nothing tells *two different* Rats to do *two different* things before the bell. #4 deals jobs round the crew at Last Call and at Gary's warning, as nudges, never roles |
| A4 | One queue for every centre-screen text; at the bell, nothing but the stamp | **Adopt** (→ #3) | N5. This is the round's structural fix |
| A5 | Show the fee shortfall on the report once the stamps are complete ("$895 short") | **Adopt** (→ #10) | `feeShort()` already exists in `promopanel.js`. With 3 stamps it becomes the report's headline line, so a crew knows the 5th Muni shift is the fee, not a miss |
| A-cut | "Run over by the cart" → "Run over"; the welcome PA replaying on rejoin | **In hand / Adopt** (→ #3) | The award is A's bug #8. The replay is a PA card the queue (#3) drops on rejoin |

### Playtester B (the Club and Tiered)

| # | Idea | Verdict | Why |
| --- | --- | --- | --- |
| B1 | A ring you can see at 50–150 m: a vertical marker at the predicted rest, in your colour, the bowl's when it'd score | **Adopt** (→ #2) | A ground ring 150 m away is 9 × 0.1 px. The prediction is exact (0.000 m median), so only the drawing fails. **T:** a fixed-pixel sprite plus a thin beam: 2 draw calls, no new maths |
| B2 | Gutters stop being an off switch: drain slowly (0.2/s), or pay at a discount with a TARGET premium | **Adapt** (→ #1) | N1: 0.2/s still ends at 0.97–1.00, because the cups only fill at 0.03–0.05/s. The council's rule is **linked gutters**: they no longer drain on their own at Tiered, and with them **a TARGET drains every cup**. One shot in Last Call passes (0.63–0.87); no shot fails (0.00). **G:** the purchase now makes the venue's verb three times as strong instead of switching it off. **C:** "one shot at the bell is the most fun thing at Tiered anyway" |
| B3 | The Last Call line forecasts the rush; re-fire one line when the gauge crosses the tick | **In hand ✓** | 5d21581 (`RALLY_MARGIN` 0.25 at Tiered, one re-rally) |
| B4 | The bay prompt names the greens; one queue for memo and rally | **In hand ✓ / Adopt** (→ #3) | The prompt is fixed. The queue is #3 |
| B5 | Deck orders a human can fill and overdo: 30 s windows, a "round for the deck" (double beer, 25 × BV, +2 drinks) | **Adopt, plus a fine cut** (→ #8) | N2: 20 s is a cliff and 30 s fixes it. The round is the overserving lever the firm call wants: at amber, filling it *is* a fall. **E:** the fine drops to 50 × BV so a careless cook breaks about even (round 6's intent) instead of losing the evening |
| B-cut | The default-power ground ring before your first swing (0.7 lands ~150 m out) | **Adopt** (→ #2) | The marker shows only while winding up, and after your first swing at that swing's power |
| B-nw | Not worth it: the dive scooter | **Agree; no price change** | Its payback arrives with #5: the scooter's 40-ball bag clears the Orbital sky in one EVA trip |

### Playtester C (Stadium → County → Orbital → the Last Bucket → endless)

| # | Idea | Verdict | Why |
| --- | --- | --- | --- |
| C1 | The finale one text at a time | **In hand ✓; made structural** (→ #3) | 5d21581 fixed the finale. #3 makes it the rule everywhere |
| C2 | Laps worth less after 3 a minute, or the gauge is the last 2 minutes' mean, so the second cart earns its place | **Adapt: the mean, not the cap** (→ #7) | N1: the cap still passes a 60 s rally (0.54). The mean fails it (0.37). The council adds the Stadium's own beat, the **Two-Minute Warning** at T−120 s, so the crew is told when the graded window opens. **L:** "a sports venue with a two-minute warning reads instantly." The second cart's description already says "one laps for the crowd, one harvests" |
| C3 | The Orbital stamp should matter, or drop the review there (debris left on the end card) | **Adapt: both** (→ #5) | There's nothing to promote to, so the review goes. The gauge gets the one job that matters at the Orbital: **Ball No. 1 won't fall through debris.** At 1 outstanding, if debris > 15, the crew clears the sky (EVA rider plus pumper, or the tether) before Ball No. 1 falls. **M:** "the last co-op beat before the huddle, and everyone has a job." **C:** "the scooter finally matters" |
| C4 | Endless Board: TODAY big, the target as a bar, commas, no cents; pace on the record's own banking curve | **Adopt** (→ #9) | XS. The linear pace is a lie early in a shift: the record banked slowly in the first minute too |
| C5 | "Buy Site 12 back" in endless | **Adapt** (→ #9) | Round 6 deferred it to now. N3 kills the "second blimp" tier: more customers lower the record. The middle tier becomes the **Owner's Hustle**: the Hustle cap goes from ×2 to ×3 in endless, so the record is beaten by playing the toys (pings, TARGETs), which is the only thing that moves it (N3). Named **"Owner's projects"**, because the end card already says Site 12 is yours |
| C-cut | The second cart as a Stadium buy, unless C2 lands | **Reject the cut** | C2 lands as #7. The second cart is how a crew laps through the Two-Minute Warning without stopping the harvest |

---

## 2. The build list (ranked)

Ranked by fun per effort, flattest moments first. **XS** < 1 hour · **S** an evening · **M** two evenings.
**Core** = edits `crew.mjs`, `main.js` or `sim.js` (merge hotspots). Every item adds its tests to `node --test test/`
and updates `game-design.md` in the same commit.

**The one-text rule, as every item applies it:** after #3, every centre-screen string goes through `say()`, with a
kind and a time to live. Nothing writes `#toast`, `#memo` or `#hint` directly. Every new line is ≤ 8 words. The Board,
the banner, the nudge slot (top-left), the feed (left), pins, beams and confetti are world or edge text and stay
outside the queue.

**Xbox:** every new mesh is one draw call or merges into one, and nothing renders to a texture. The low tier
(`perf.js` `profileFor`) drops what's marked "low: off". The `?perf` p95 budget stays ≤ 20 ms on Edge.

---

### #1 · Linked gutters: a TARGET drains every cup (S, leaf)

**Behaviour.**
- **At Tiered (venue 2), the gutters no longer drain on their own.** With gutters bought, **a TARGET drains all three
  cups**, not just its own, banked to the shooter at gear ×1 as today. It's still one TARGET: Hustle +0.25, one
  `stats.targets`, one Stadium `'target'` signal.
- Without gutters, a TARGET flushes its own cup, as today.
- **From the Stadium on** (venue ≥ 3, where Bay Utilization isn't graded), the gutters drain 1 ball/s a cup as today.
  It's pure convenience there.
- The row's description becomes: "Linked pipes under every green. A TARGET drains all three cups." (≤ 2 lines in the
  shop.) Price unchanged ($50k base).
- The view: on a linked TARGET, all three glass sections THUNK in sequence (A, B, C, 0.15 s apart) and every flag
  counts down to 0.
- The TARGET toast becomes "TARGET! Every cup drained." (4 words) when linked.

**Numbers (gutters2.mjs, 4P idle crew, four teenagers).**

| Rule | Bay Util at the bell |
| --- | --- |
| Linked gutters, nobody shoots | 0.00 (fail) |
| Linked gutters, one TARGET at 380 s | **0.63–0.87** (pass) |
| No gutters, one TARGET on C at 380 s | 0.00–0.47 |
| Today (1.0/s drain) | 1.00 every bell |

- **E:** the gutters stop banking ~$15–20k a shift of drained balls, but a linked flush banks the whole field's cups
  (40–58 balls) at once, plus Hustle. The pace target holds: gutters plus one Last Call TARGET is B's 3-shift Tiered.
- **Q:** the cupped balls stay ordinary resting balls, so pickers and teenagers still take them. No softlock: by hand
  is still possible.

**Files.** `web/js/tiered.js` (`GUTTERS.LINKED_VENUE = 2`, the row text, pure `drainsAll(up, venue)`),
`server/venues/tiered.mjs` (`tick` drains only when `crew.venue > 2`; `onRest` flushes every bowl's cup when
`drainsAll`), `web/js/views/tiered.js` (the THUNK sequence on `target.all`).

**Tests.** `test/tiered.test.mjs`:
- At venue 2 with gutters, cups don't drain over 60 s of shift.
- A crew ball in Bowl A with gutters empties A, B and C, banks every ball to the shooter, adds Hustle once and counts
  one TARGET.
- Without gutters it flushes A only.
- At venue 3 with gutters, cups drain 1/s.
- The `target` event carries `all: true` and the total `n`.

**One text / Xbox.** One 4-word toast (it replaces today's). No new meshes.

---

### #2 · A landing marker you can see from the bay (S, leaf)

**Behaviour.**
- The 1.2 m ground ring is replaced by a **marker**:
  - A camera-facing disc sprite at the predicted rest, **constant 28 px on a 1080p screen** (`sizeAttenuation: false`,
    scaled by the canvas height). It has a 3 px dark outline, is drawn on top (`depthTest: false`), and is in your
    colour.
  - Plus a **6 m vertical beam** (0.12 m, additive, 40% opacity) from the ground up through it, so depth reads at
    54–150 m.
- **Inside a bowl's lip** (`ringBowl`): the disc and beam turn the bowl's flag colour and pulse at 2 Hz (scale
  1.0 ↔ 1.25).
- **When it shows:**
  - while you wind up (power > 0.05), at the live backswing power;
  - for 1.5 s after release;
  - and afterwards, while you stand at a crew bay with balls, at your last swing's power.
  - **Never before your first swing at this venue** (B-cut: 0.7 lands ~150 m out and teaches the wrong spot).
- The prediction, rate limits and costs are unchanged (`createAimer`, 10 Hz, 5 Hz on low).

**Files.** `web/js/aim.js` (`AIM.MARK_PX 28`, `AIM.BEAM_H 6`, pure `markerState({ power, lastPower, swung, sinceRelease,
rest, bowl })` → `{ visible, power, color, pulse }`), `web/js/views/tiered.js` (the sprite, the beam, removing the ring).

**Tests.** `test/aim.test.mjs`:
- `markerState`: hidden before the first swing at rest, visible while winding up, visible 1.5 s after release then at
  the last power, the bowl colour and pulse inside the lip, hidden with no balls or off the bay.
- `predictRest` parity is unchanged.

**One text / Xbox.** No text. Sprite plus beam = 2 draw calls (the ring was 1). Low tier: the sprite only, with no beam.
Playthrough 3 measures the pixel size on a TV at 3 m.

---

### #3 · One centre-text queue for the whole game (M, core: `main.js`)

**Behaviour.** A new module `web/js/say.js` owns the one centre slot. It has a pure model, `createSayModel({ now })`,
and a thin DOM adapter.

| Kind (priority, high → low) | What goes in it | Shows for | Time to live in the queue |
| --- | --- | --- | --- |
| `STAMP` | The bell's APPROVED / DENIED | 1.5 s, then the report | n/a: it **preempts** and clears every queued `ALERT`/`TOAST`/`TIP` |
| `PA` | The PA card (a ≤ 8-word **caption**; the voice still speaks the full line) | the audio's length | none (waits) |
| `MEMO` | The morning memo, ball debuts, venue reveal cards | 7 s (debuts 5 s) | none (waits) |
| `ALERT` | Rally lines (#4), "Gary in 45 s", a customer waiting, MOW-E's lane, the bored crowd | 3.5 s | 15 s |
| `TOAST` | Your own feedback: Spotless!, TARGET!, Bought!, BONK | 2.5 s | **3 s** (stale feedback is dropped, never shown late) |
| `TIP` | First-time hints | 4 s | 60 s, and only after 2 s with nothing showing |

**Rules.**
1. **Exactly one item is visible.** A new item never replaces the visible one, except `STAMP`, or an item with the same
   `key` (the fries count, a cash roll), which updates in place.
2. **Order:** kind first, then first-in-first-out. Each item shows for at least 1.2 s, with a 0.3 s gap between items.
3. **The bell lock:** from the `quota` event until the report card opens, only `STAMP` shows. Queued
   `ALERT`/`TOAST`/`TIP` items are dropped, and `PA`/`MEMO` wait until the report closes.
4. **The context prompt** (`#prompt`, "Hold Ⓐ to pour") is ambient: it hides while any item is visible. The nudge slot,
   feed, Board, banner and floats are outside the queue.
5. **Words:** `say()` counts words (`$1,240` and `3/4` count as one). Over 8, it warns in dev. PA entries in `pa.js`
   become `{ line, caption }`, with every caption ≤ 8 words ("Gary from Regional is on site." for the 11-word line).
6. **Rejoin:** the PA card never replays on rejoin (the `welcome` snapshot doesn't re-queue it; A-cut).
7. **The record PA** fires only in endless, where the record is the game. On review days the report card carries
   "Record shift" instead. That ends A's flattest moment (a record PA over DENIED) for good, not one tick at a time.
8. **What it removes:** `textBusy`, `toastQuiet`, `memoQ`, the hinter's `!textBusy() && toastT <= 0` gate, and every
   `setTimeout(…, 400)` retry. `ctx.toast` / `ctx.showMemo` in the views route through `say()`.

**Files.** New `web/js/say.js`. `web/js/main.js` (28 call sites, the `lastcall`/`rally`/`quota`/`memo`/`debut`
cases, the hinter gate). `web/js/round2.js` (10). `web/js/views/*.js` (via ctx). `web/js/pa.js` (captions, card hook).
`web/js/board.js` (the stamp calls `say` as `STAMP`). `server/crew.mjs` (`endShift`: the record PA only when
`this.endless`).

**Tests.**
- New `test/say.test.mjs` on the pure model:
  - Two items never show at once.
  - `STAMP` preempts and drops queued alerts, toasts and tips.
  - A toast queued behind a 6 s PA is dropped, not shown late.
  - The same key updates in place.
  - A `TIP` waits for 2 s of quiet.
  - The bell lock holds `PA`/`MEMO` until `report()`.
  - Order by kind, then first in, first out.
- New `test/words.test.mjs`: every `RALLY_LINES`, `GAUGE_MISS`, `NUDGE_TEXT`, PA caption, `TODO_DONE` and every
  string literal passed to `say(` in `web/js` (a source scan) is ≤ 8 words.
- `test/round2.test.mjs`: no `record` PA on a review day; one in endless.

**One text / Xbox.** This *is* the one-text rule, made structural. Fewer DOM writes a frame: a small Xbox win.

---

### #4 · Dealt jobs: a different line for each Rat at Last Call and at Gary's warning (S, core-light)

**Behaviour.** No roles: nudges, dealt by distance.
1. **The Last Call rally is dealt round the crew.**
   - `shortfalls(state)` in `rally.js` returns the *ranked list* of real shortfalls (the gauge first if under 0.5,
     then each Upkeep term costing ≥ 0.01, by cost), not just the top one.
   - The server deals it: the biggest job gets ⌈N/2⌉ Rats (the nearest ones), then each next job gets the nearest
     undealt Rat, until every online Rat has a line.
   - Job positions:
     - the mats (0, 3.5), the sign, the stand;
     - the shed (`FRIES.SHED`), the dock (`POND.DOCK`);
     - the worst bowl (Tiered), the Track (Stadium), Yard 2 (County), the Lift (Orbital).
   - If everything's on target, every Rat gets "On target. Hold it till the bell."
   - `lastcall` and `rally` carry `needs: { ratId: line }` (and `need`, the top line, for old clients and solo).
   - Each client says its own line as an `ALERT` through #3. One line on each screen, ≤ 8 words.
   - The 30 s re-check re-deals.
2. **Gary's warning is dealt** (day 4+, every venue, at 43% of the shift: a mid-shift split).
   - When Gary's 45 s warning starts, each Rat's nudge slot (top-left, with the yellow world arrow) gets one *failing*
     stop (`inspectBase` false), nearest first.
   - Lines: "Gary checks the sign. Hose it!" · "Gary checks the mats. Hose them!" · "Gary checks the stand. Hose
     it!" · "Gary checks the cart. Hose it!" · "Gary's hungry. Serve a hot dog!"
   - Extra Rats double up on the mats. A stop that passes clears its line ("Spotless!" is already the toast). All lines
     clear when Gary reaches his first stop.
   - Nothing checks or rewards who did what.
3. **Day 3 at the Muni** (A3): the nudge pool deals once more, at 50% of the shift, "Keep the mats clean." to the Rat
   nearest the mats only if mat mud > 0.3. That's the rhythm, as a nudge.

**Why (M, C).** The scorecard's co-op line hasn't moved because the game always names *one* job. Gary's warning is the
game's built-in mid-shift crisis (four stops, 45 s, four Rats), and today it shows one line to everybody. **C:** "if my
screen says sign and yours says mats, we split without talking about it, then we shout about it."

**Files.** `web/js/rally.js` (`shortfalls`, `dealJobs(jobs, rats)`, `JOB_AT`), `server/crew.mjs` (`rallyNeed` →
`rallyNeeds`; the `lastcall`/`rally` pushes), `web/js/nudge.js` (`GARY_TEXT`, `dealGary(stops, rats)`, the day-3
line), `server/venues/nudge.mjs` (deals on Gary's `warn`, clears per stop; it's a venue-0 module, so it's active at
every venue), `web/js/main.js` (reads `needs[me.id] ?? need`).

**Tests.**
- `test/rally.test.mjs`:
  - The ranked list order.
  - 4 Rats and 2 jobs → 2 + 1 + 1, nearest first.
  - On target → everyone gets the same line.
  - Solo → the top line.
  - 6 Rats.
  - Every line ≤ 8 words.
- `test/onboarding.test.mjs` (or a new `test/dealt.test.mjs`):
  - Gary's warning deals only failing stops.
  - A stop that passes clears its line.
  - All clear at his first stop.
  - A late joiner gets one.
  - No deal on Muni days 1–3 (Gary is day 4+).
  - The day-3 line fires only over 0.3 mud.

**One text / Xbox.** One `ALERT` per screen (rally). Gary's lines sit in the nudge slot, not the centre. Zero render
cost.

---

### #5 · Clear the sky: Ball No. 1 won't fall through debris (M, core)

**Behaviour.**
1. **No review at the Orbital.** At venue 5 (not endless), `quota` is null: no stamps, no bonus, no promotion panel.
   - The memo: "Today: bring them home. 1,123 to go." (the live count).
   - The reveal's `howto`: "The Lift is open. Keep the sky clear."
   - The Board's 50% tick stays: it now marks "clear".
2. **The sky gate.** When Balls Outstanding reaches 1 (`countDown`, or a morning with ≤ 1), `beginLastBucket()` checks
   Orbital Debris.
   - If the gauge is ≥ 0.50 (≤ 15 pieces), Ball No. 1 falls as today.
   - Otherwise `lastBucket.phase = 'sky'`:
     - **The clock keeps running.** `paused()` and `working()` treat `'sky'` as live, so the tether winches and the
       Lift runs.
     - **Orbit shots stop** (`launchMod` returns nothing while `crew.lastBucket`).
     - **Riders aren't sent home** (the orbit module's "Last Bucket brings everyone down" rule skips `'sky'`).
     - The banner: **"CLEAR THE SKY · 23 UP"**. The Board banner and the Last Bucket banner both use it.
     - Ball No. 1 glints gold at the centre of the debris disc, at the top of the Lift.
     - The rally line (dealt, #4) at Last Call: "Debris overhead. Ride the Lift!"
   - When debris is ≤ 15: the phase becomes `'falling'` and the existing fall → carry → huddle → $∞ runs. Anyone still
     aloft rides down (5 s) as the ball falls.
   - **The bell during `'sky'`:** a normal report (no review). Debris is saved, so the next morning reopens the gate.
3. **The finale's co-op:** two riders (the Lift already takes several) and two pumpers (`orbpump`'s cap is two) is the
   4P shape. Every Rat has a job, then everyone huddles.

**Numbers (orbit.mjs, 4P).**
- Without the tether, debris is at the cap (57–60), so the crew must clear **42–45 pieces**:
  - two Rats on twin tanks (25 a bag) or one on the dive scooter (40): **one trip each, ~60–90 s** (5 s up, ~40 s
    grabbing, 5 s down);
  - solo on a mask (10 a bag, 20 s of air): **4–5 trips, ~3–4 min**, and the tether adds 7.5 a minute.
- With the tether (6–8 debris), Ball No. 1 falls at once: no change.
- **E:** losing the Orbital stamp costs $2.4–2.8M a shift of bonus, so end cash, not pace. The Last Bucket still
  arrives on day 3. The gate adds 0–4 minutes to it.

**Seat views.**
- **G:** "the venue's chore finally gates the venue's ending."
- **M:** "two up, two pumping, then the huddle: the best four-player minute in the game."
- **Q:** the gate must never softlock. The Lift needs only `working()`, a solo Rat can always ride, the tether drains
  it anyway, and a disconnected rider reels down (existing). No new waits on an absent Rat.
- **C:** dissent recorded ("we've been waiting all game for the ball and now we wait more?"), outvoted 6–1 on the
  numbers: a crew that bought the tether never sees the gate, and one that didn't gets a 1–2 minute set piece.

**Files.**
- `server/crew.mjs`: `startShift` (quota null at 5, the memo), `beginLastBucket`, `paused`, `stepLastBucket` (the
  `'sky'` step), `snapshot` (`lastBucket.debris`).
- `server/venues/orbit.mjs`: `launchMod`, the riders-home rule, an exported `debrisLeft(st)`.
- `web/js/orbit.js`: `ORBIT.SKY_CLEAR = 15`.
- `web/js/rally.js`: the venue-5 line without a quota.
- `web/js/ending.js`: the banner string.
- `web/js/views/orbit.js`: the gold glint.
- `web/js/sim.js`: `VENUE_RULES[5].howto`.

**Tests.** `test/ending.test.mjs`:
- At 1 outstanding with 30 debris the phase is `'sky'`, the clock runs, no orbit shots spawn, and the tether winches.
- The ball falls once ≤ 15.
- The bell during `'sky'`, then the next morning reopens `'sky'`.
- A rider aloft during `'sky'` isn't sent down; when it clears, they are.
- The self-heal doesn't fire in `'sky'`.
- Solo with no gear can ride.

`test/orbit.test.mjs`: no shots while `lastBucket`. `test/gauge.test.mjs`: no quota entry at venue 5; venues 2–4 are
unchanged.

**One text / Xbox.** The banner is the existing Last Bucket banner (top, not centre). One rally `ALERT`. The glint
reuses the gold-ball beacon material: 1 draw call.

---

### #6 · The County: teenagers stay off the lawns (XS, core: one line)

**Behaviour.**
- **Teenagers ignore strays** (balls past the kerb). The shop line reads: "They don't do lawns. There's a dog." Rats,
  push pickers and drones still take them.
- **Fewer slices:** `SLICE.CHANCE` 0.40 → **0.15** (the curve stays 1.0–2.0), so about 4–5% of shots land in the Yards:
  ~30–45 strays a shift at 4P with the blimp.
- The Yards become one Rat's errand near the bell, or the drones' job.

**Numbers (county2.mjs, 4P, four teenagers).**

| Crew | Strays at the bell (Zoning) |
| --- | --- |
| Idle or tidy crew, nobody in the Yards | 30–43 (0.00), fail |
| One push-picker run through the Yards at Last Call | **4–7 (0.77–0.87)**, pass |
| Two drones | 0.87–1.00 |
| Today (teens on lawns, slice 0.40), tidy crew | 8–19, passing for free |

- **E:** this pairs with #1: each venue's automation now *does* the chore, and the chore by hand is one trip.
- **L:** the Yards (the gnome, the pool, the mailboxes) finally get a visitor.

**Files.** `server/crew.mjs` (`stepHelpers`: skip `isStray(c)` from venue 4), `web/js/county.js` (`SLICE.CHANCE`),
`web/js/sim.js` (the helpers row's tier-1 description gains the dog).

**Tests.** `test/county.test.mjs`:
- Re-pin the slice share past the kerb to 3–7% over 2,000 seeded shots.
- A teenager with only a stray in range doesn't target it; a drone does.
- A seeded 4P County shift with four teenagers and no Yards visit ends with ≥ 16 strays.

`test/seam.test.mjs`: venues 0–3 are unchanged (the helper rule checks `crew.venue >= 4`).

**One text / Xbox.** The County's rally line already exists. No cost.

---

### #7 · The Stadium: the Two-Minute Warning (S, mostly leaf)

**Behaviour.**
- **The crowd remembers.**
  - Crowd Sentiment (the live mood: the jumbotron heart, the crowd bob, ambience) is unchanged.
  - **The gauge on the Board, and the one the bell grades, is the mean of the last 120 s of live sentiment**, sampled
    once a second (a 120-slot ring buffer).
  - Before 120 s of shift, it's the mean so far.
- **The Two-Minute Warning** (Stadium only, from day 2 there):
  - at T−120 s: the horn, the Board banner "TWO-MINUTE WARNING", and the dealt rally (#4);
  - the rally reads the *live* sentiment minus 0.1 as its forecast.
  - Last Call at T−60 still brings ×1.5 swings and glow balls, with no second line unless the 30 s re-check finds a
    slip.
  - `RALLY_AT = { 3: 120 }`, default 60.
- No lap cap. Laps stay +0.1, pings +0.08/+0.16.

**Numbers (stadium.mjs, stadium2.mjs).**

| Lapping | Graded 2-minute mean |
| --- | --- |
| None | 0.25–0.27, fail |
| 60 s of laps only at Last Call | 0.37–0.39, fail (today it passes at 0.70) |
| 60 s of laps right after the warning | **0.63–0.64**, pass |
| The whole last 2 minutes | 0.74–0.75 |
| A 30 s stint every 2 minutes (one cart, shared) | 0.90–0.95 |
| A second cart lapping all shift | 0.91–0.93 |

- **G:** the Stadium becomes "keep the show going", its round-4 chore, with a sports beat to start it.
- **E:** the second cart ($660k at 4P) now buys "lap without stopping the harvest": a real choice, not a requirement.

**Files.** `web/js/stadium.js` (`CROWD.WINDOW 120`, pure `pushSample(buf, s)` and `windowMean(buf)`),
`server/venues/stadium.mjs` (the buffer, `kpi` → the mean, snapshot `k`), `web/js/views/stadium.js` (the jumbotron
keeps `s`), `web/js/rally.js` (`RALLY_AT`), `server/crew.mjs` (the `lastcall` tick uses `RALLY_AT[venue]` for the
rally; the Last Call rules stay at 60), `web/js/board.js` (the banner string, if the view's `banner()` can't carry it).

**Tests.** `test/stadium.test.mjs`:
- `windowMean` over a partial and a full buffer.
- A seeded shift: no laps → kpi < 0.3; 60 s of laps at T−60 → kpi < 0.5; at T−120 → ≥ 0.5.
- The snapshot carries both `s` and `k`.

`test/rally.test.mjs`: the Stadium rally fires at T−120 once, other venues at T−60. `test/gauge.test.mjs`: the review
reads the mean.

**One text / Xbox.** One dealt `ALERT` at T−120 instead of T−60; the banner is on the Board. A 120-number buffer:
nothing.

---

### #8 · The Upper Deck: orders a human can fill, and rounds a careless cook can overdo (S, leaf)

**Behaviour.**
- **Orders stay open 30 s** (was 20). Orders still come every 30 s, or every 20 s at amber.
- **Rounds:** from Drinks ≥ 3, every third order is a **ROUND**.
  - One good or perfect pour fills it: **+2 Drinks, a 25 × BV tab**.
  - Ignoring it lapses quietly.
  - At 4 Drinks a filled round *is* a fall: that's the overserving joke, chosen on purpose.
- **The fine is 50 × BV** (was 100), so one fall costs about five ordinary tabs or two rounds.
- The kitchen's BEER card shows **"ROUND ×2"** in gold with the 30 s timer ring.
- The view: two loungers raise their mugs on a round order, with a double WOOO.
- The deck hint becomes "Fill their orders. Rounds count double." (6 words).

**Numbers (deck2.mjs, cook pours 24 s after the order). Shares are of an idle crew's ~$70k shift; an active crew's is
about double, so halve them.**

| Cook | Fills | Incidents | Tab | Fines |
| --- | --- | --- | --- | --- |
| Today (20 s window) | 0 of 13 | 0 | 0% | 0% |
| 30 s window, careless (no food) | 14 of 14 | 1 | 8% | 22%, so **11% at 50 × BV**: about even |
| 30 s window, careful (hot dog at amber) | 13 of 14 | 0 | **23–24%** | 0% |
| 30 s window + rounds, greedy (takes every round) | 14, with 3 rounds | **2** | ~25% | ~25% at 50 × BV: even, and two falls to watch |

These hit playtest 2's goals: 0–1 incidents for a careful cook, 1–3 for a careless one, and a tab of 10–15% of an
active crew's income.

**Files.** `web/js/deck.js` (`ORDER_OPEN 30`, `ROUND_EVERY 3`, `ROUND_FROM 3`, `ROUND_TAB 25`, `ROUND_DRINKS 2`,
`FINE 50`, `stepDeck` marks `order.round`, `fillOrder` returns it), `server/venues/deck.mjs` (the round pays and adds
+2; `deckOrder {seat, round}`; the snapshot's `order.round`), `web/js/kitchen.js` (the ROUND card), `web/js/views/deck.js`
(the double mug).

**Tests.** `test/deck.test.mjs`:
- A 30 s window.
- Rounds only from 3 Drinks, every third order.
- A filled round is +2 and 25 × BV.
- A round at 4 Drinks → an incident.
- An unfilled round lapses with no penalty.
- The fine is 50 × BV.
- A cook filling every order 24 s late with no food has 1 incident in a shift; with a hot dog at amber, none.

**One text / Xbox.** The hint chip only (a `TIP` through #3). The mug rig is reused: zero draw calls.

---

### #9 · Endless: Owner's projects, and a Board that races the record (M, mostly leaf)

**Behaviour.**
1. **Owner's projects:** one crew row, shown **only in endless** (`shopShows` gains an `endless` argument; the row has
   `endless: true`). Three tiers, each a visible moment. Prices are base, ×2.2 at 4P, against ~$65M a shift for an
   active 4P crew:

| Tier | Base (4P) | What it does |
| --- | --- | --- |
| **Crew colours** | $25M ($55M, ~0.85 shift) | The stand, the Board frame and the carts repaint in the crew's colours (stripes in join order) |
| **The Owner's Hustle** | $60M ($132M, ~2 shifts) | The Hustle cap goes from ×2 to **×3** in endless. Pings and TARGETs are how the record moves (N3), so the record becomes a thing a crew beats by playing |
| **The statue** | $150M ($330M, ~5 shifts) | A bronze Rat holding Ball No. 1 by the stand, the crew's names on the plinth. A once-ever PA ("Corporate has commissioned a statue. Of you. Reluctantly.", caption "A statue. Of you. Reluctantly.") |

   About 8 shifts (~1 hour) of goals after the ending, then the ×3 record chase.
2. **The endless Board** (C4):
   - **TODAY $X** at 64 px, whole dollars with commas.
   - Under it, a bar from $0 to the record, with a tick at **the record's own pace**: the record shift's cumulative
     cash is saved at 14 checkpoints (every 30 s) in `records.curve`, and the tick interpolates it.
   - The bar flashes green when today passes the pace tick (the #3 crossing flash in `closingbell.js`, reused).
   - A record saved before the curve existed falls back to linear.

**Why it's rank 9.** Only crews past ~2.5 hours see it. But C's "one more shift" was 5, the lowest late-game score.
Round 6 deferred this to now, and N3 tells us exactly what moves the record.

**Files.** New `web/js/owner.js` (`OWNER_ROW`, `ownerTier`, `maxMult(up, endless)`; no `sim.js` import, the
`GUTTERS_ROW` rule). `web/js/sim.js` (its `SHOP` slot, `shopShows`/`nextPrice` take `endless`). `server/crew.mjs`
(`buy` passes `endless`; Hustle caps read `maxMult`; `endShift` writes `records.curve`; the snapshot's `pace` reads the
curve). `server/venues/tiered.mjs` (the TARGET cap reads `maxMult`). New `web/js/views/owner.js` (paint, statue).
`web/js/board.js` (the endless rows). `web/js/pa.js` (the statue line).

**Tests.** New `test/owner.test.mjs`:
- The row is hidden outside endless and shown in it.
- Prices scale ×2.2 at 4P.
- `maxMult` is 2 before tier 2 and 3 after, and 2 outside endless whatever the tier.
- `records.curve` has 14 rising points.
- Pace interpolation.
- An old record falls back to linear.

`test/shop.test.mjs`: no row leaks into venues 0–5.

**One text / Xbox.** One PA caption (once ever). The Board is in-world. The statue is one merged mesh (≤ 2k triangles).
Paint is material colour only.

---

### #10 · The small pack (XS)

1. **The fee line leads when the stamps are done** (A5). With 3 stamps and the fee unpaid, the report's first line is
   "3 stamps. $895 short." (`feeShort`, 4 words). Files: `web/js/promopanel.js`, `web/js/round2.js`.
2. **The huddle waits less for a missing Rat** (C #9).
   - In the huddle and Gary's ring only, an idle Rat counts as present and holding after **20 s** (was 60).
     `HUDDLE_IDLE_MS` is split from `GRACE_MS`.
   - A carrier who goes offline drops Ball No. 1 where they stood after **5 s** (as `DRIVER_GRACE_MS`), so anyone can
     carry it.
   - Files: `server/crew.mjs` (`stepHuddle`, `stepLastBucket`).
3. **Tests.**
   - `test/promopanel.test.mjs`: the headline appears at 3 stamps only.
   - `test/ending.test.mjs`: an offline carrier drops the ball at 5 s; another Rat picks it up and banks it; a 20 s
     idle Rat counts; a reconnect inside 5 s keeps the ball.

**One text / Xbox.** One report line. No cost.

---

**Votes on the list:** G yes · E yes (#1 and #6 are the economy fix round 6's gauge rule needed) · M yes (wants #4's
6-Rat deal and #10's carrier tests first) · L yes · T yes (#3 lands before anything else adds a toast) · C yes on all
but #5 ("we'll see"), with "#1, #2 and #4 are the ones we'll feel" · Q yes (#5's softlock set before merge). **7–0 on
the list, 6–1 on #5.**

---

## 3. Cuts and deferrals

**Cut in this round (folded into the items above):**
- The Tiered gutters' continuous drain (#1). They still drain from the Stadium on.
- The 1.2 m ground landing ring and the default-power ring before your first swing (#2).
- The Orbital review: stamps, the 15% bonus and `GAUGE_MISS[5]` (#5).
- The `record` PA on review days (#3). It plays in endless only, and the report carries "Record shift".
- `textBusy`, `toastQuiet`, the memo queue and the 400 ms retries (#3).
- Teenagers in the Yards, and 60% of the County slices (#6).
- The deck fine from 100 to 50 × BV (#8).

**Rejected with numbers (so nobody re-litigates them):**
- **Slow-draining gutters at 0.2/s** (B2a): they still end at 0.97–1.00, because cups fill at only 0.03–0.05/s.
- **Gutters off during Last Call:** 0.50–0.60, a coin flip that's hard to explain.
- **The lap cap of 3 a minute** (C2a): a 60 s rally still passes (0.54).
- **Softer mat scuff at 4P** (A3a): it deletes the mid-shift job (N4).
- **The day-3 "someone stays on the hose" memo** (A3b): one more centre text. #4's nudge does it.
- **The "second blimp" endless tier** (round 6 sketch): +25% swings *lowers* idle endless income by 15–20% (N3).
- **The knockdown replay** (round 6): a render to texture every frame. Still no.

**Deferred:**
- **The Jumbotron 2× and above the roofline** (round 6 C5, S): still a `signs.js` row and its facing test. Do it if
  #7's builder has an evening left. The jumbotron is where the live crowd now reads.
- **Kitchen tickets** (round 6 B3): #8 makes the shed busy at Tiered. Revisit only if the Club's kitchen still feels
  like a leak in playthrough 3.
- **The EVA finale variant** (Ball No. 1 waits in orbit and a rider fetches it): a bigger rewrite of the fall → carry →
  huddle flow that playtest 2 found solid (no softlocks in 13 attacks). #5 gets most of the co-op value for less.

**Left alone on purpose:** `PROMO_STAMPS` (3), the quota curves (`quotaQ`, `venueQuotaF`), `QUOTA_KPI` (0.5), every
fee and shop price except the deck fine, `CUP_FULL` (30), the crowd's decay and lap values, the knockdown rules, and
Gary's schedule (day 4, 43%).

---

## 4. What playthrough 3 must check

A real 4P night (two on Xbox pads in Edge) and one solo run, with `?pace` and `?perf` on, plus the headless bots from
playthrough 2 re-run on the new build. Paste the numbers into the scorecard.

1. **One text (#3).** Screenshots at every Last Call, every bell, Gary's arrival, the reveal, the finale and a rejoin.
   **Count the centre elements in every frame: never more than one.** Count dropped toasts in the console (a dev
   counter), and record any line the crew said they missed. Goal: **Text load ≥ 7.**
2. **Tiered (#1, #2).**
   - Did the crew buy the gutters, and did they still shoot? TARGETs a shift with gutters (goal ≥ 1 in every Last
     Call), and stamps missed on the gauge.
   - The marker: its pixel size on a TV at 3 m for Bowls A and C. Minutes from arriving to the first TARGET (goal < 2).
   - Did anyone aim before the first swing? It shouldn't be possible.
3. **Co-op (#4).**
   - At each Last Call and each Gary warning, where did each Rat go in the first 10 s? Goal: ≥ 3 different places at
     4P.
   - Gary's verdicts passed (goal ≥ 75% from day 5).
   - Did anyone feel *assigned*? Ask: it must read as a suggestion. Goal: **Co-op ≥ 7.**
4. **The Orbital (#5).**
   - Debris when Balls Outstanding hit 1, and the seconds in `'sky'` (goal 0 with the tether, ≤ 120 s at 4P without,
     ≤ 300 s solo).
   - How many Rats were up and how many pumping. Any stall at all is a blocker.
5. **The County (#6).** Strays at each bell. Who went into the Yards, and when (goal: one run in the last 90 s, or
   drones)? Stamps missed on the gauge.
6. **The Stadium (#7).**
   - The graded mean at each bell. Did the crew lap at the Two-Minute Warning or wait for Last Call?
   - Was the second cart bought, and was it used for laps? Pace target unchanged: no venue over 4 shifts at 4P.
7. **The deck (#8).** Orders filled, rounds taken, incidents a shift (careful 0–1, careless 1–3) and the tab's share of
   income (10–15%).
8. **Endless (#9).** Shifts to each Owner's tier. Did the ×3 Hustle record fall, and by how much? Did the pace tick
   read right in the first minute? Goal: **One more shift ≥ 6.5** for C's slice.
9. **The pace ladder.** 4P Last Bucket at 145–170 min (#5 can add up to 4 min), solo at ≤ 185 min. Re-run
   `ladder.mjs`.
10. **Xbox Edge, low tier.** Frame p95 ≤ 20 ms at a Tiered bay while winding up (marker plus beam), at the Lift with two
    riders, and at the stand during the statue's first morning.
11. **Regression:** `node --test test/` green, `make preflight` green in WSL, and 60 minutes with no console errors.

---

## 5. Who runs what

Four builders, starting from the branch where playtester A's 15 bugs land (`rally.js` and `crew.mjs` are mid-edit
there now). **Nobody starts until that merges.**

| Builder | Items, in order | Owns (only they edit) | Touches, after the owner merges |
| --- | --- | --- | --- |
| **1 · rules (core, serial)** | #5 → #6 → #7 → #10.2 | `server/venues/orbit.mjs`, `web/js/orbit.js`, `web/js/ending.js`, `views/orbit.js`, `server/venues/stadium.mjs`, `web/js/stadium.js`, `views/stadium.js`, `web/js/county.js`; **first lock on `server/crew.mjs`** (`startShift`, `beginLastBucket`, `paused`, `stepLastBucket`, `stepHuddle`, `stepHelpers`, the Last Call tick) and on `rally.js` (`RALLY_AT`, the venue-5 line) | `sim.js` (`VENUE_RULES[5].howto`, the helpers row text) |
| **2 · Tiered** | #1 → #2 → #8 | `web/js/tiered.js`, `server/venues/tiered.mjs`, `views/tiered.js`, `web/js/aim.js`, `web/js/deck.js`, `server/venues/deck.mjs`, `views/deck.js`, `web/js/kitchen.js` | none in core |
| **3 · text and co-op** | #3 → #4 | **`web/js/main.js`** (sole owner this round), new `web/js/say.js`, `round2.js`, `pa.js`, `views/index.js` (the ctx), `web/js/nudge.js`, `server/venues/nudge.mjs` | `rally.js` (`shortfalls`, `dealJobs`) and `crew.mjs` (`rallyNeeds`, the `lastcall`/`rally` pushes, the record PA in `endShift`) **after builder 1's #5–#7 merge**; `board.js` (the stamp's `say` call) after builder 4 |
| **4 · endless and the report** | #10.1 → #9 | new `web/js/owner.js`, new `views/owner.js`, `web/js/board.js`, `web/js/promopanel.js`, `web/js/closingbell.js` | `sim.js` (`SHOP` slot, `shopShows`), `crew.mjs` (`buy`, `records.curve`, Hustle `maxMult`), `tiered.mjs` (the cap) **after builders 1 and 2**; the statue's PA line in `pa.js` after builder 3's caption format |

**Order of merge:**
1. Builder 1's #5, and builder 3's #3 (the queue: everything after it says through `say()`).
2. Builder 2's #1 and #2 (no core overlap) and builder 1's #6 and #7.
3. Builder 3's #4, which reads #5's and #7's rally changes.
4. Builder 2's #8 and builder 4's #9 and #10.

Any toast added by builders 1, 2 or 4 before #3 lands uses `ctx.toast`, which #3 reroutes, never `$('toast')`.

**About five evenings of agent work** (#3, #5 and #9 are M). Every builder's done line: `node --test test/` green,
`make preflight` green (in WSL), `game-design.md` updated in the same commit, and the scratchpad's `council7/` script
for their item re-run against the real rule (not the emulation), with its numbers in the commit message.
