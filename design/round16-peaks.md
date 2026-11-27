# Council round 14, builder 2 ("peaks"): the Gold Rush, Happy Hour, the Bell's bonus round at Tiered, the solo bowls

Brief: `design/council-round14.md` items 1 and 2, and builder 2's part of item 3a (the Bell ringing a bonus Happy Hour).
Item 3b (the Tournament memo, row and solo clock) and 3c (landmarks at the next venue) were already being built by other
builders in their own files (`tourney.*`, `county.*`, `orbit.*`) while I worked, so I left them alone (see Open issues).
Item 7 (the Coach Party) was not built.

## What I built

### 1. The Gold Rush (Muni day 3, Club day 2)
- **When.** Muni day 3 at T-2:45, moved 20 s clear of Last Call by the Tournament's dodge rule, so it lands at **T-2:50
  (shiftT 250)**. Club day 2 at **T-3:00 (240)**. Never endless, a boss day, Promotion Day or a reveal morning, and
  never a Gary day at the Muni.
- **Change from the brief: the Club's Gary day.** Club day 2 is nearly always a Gary day: a visit due on the reveal
  morning slips a day (`garyMorning`). With the brief's "never on a Gary day", the rush never fired at the Club in any
  bot run (Club d2 4P stayed at 1.00 calls a minute). So on a Club Gary day the wave runs **ahead of Gary's warn
  instead**: its clocks run out 5 s before it (T-4:35 at 2P+, T-4:45 solo).
- **What happens.** Site 13's red van backs up to the left net and tips a crate over it. Each ball lands under a short
  gold beam with a 30 s clock (40 s solo). Spots come from `hash32(day, vday, 'rush', j, k)` (no RNG draw), 45–110 m
  out, on alternating sides. At the Club at 3P+, one ball lands in the pond.
- **Site 13's cart.** It looks like the caddie cart: a white body under a red "13" canopy. It hums out for the last 6 s
  of a clock, claims the ball, then hums back. Claims within 3 s merge into one feed line: "Site 13 took 2. For
  research."
- **Change from the brief: 3 balls solo, not 2.** The bar is 0.8 calls a minute at 1P, and 2 balls measured 0.71. With
  3, all landing within 30 m of the first, it measures 0.86. One solo Rat still makes one trip.
- **The pay.** The balls are ordinary gold (`b.hands`, `b.rush`), carried in hands and banked ×10 at any return. There
  is no new pay rule. A pond ball goes into the diver's bag, which already pays it as gold.
- **What you see and read.**
  - One centre ALERT: "Gold Rush! Beat Site 13's cart!"
  - Every ball taken: "Clean sweep. Site 13 is furious."
  - The report row (`reportRows`): "Gold Rush: 3 of 4 · +$214" or "Site 13 took all 4. For research."
  - The Board line `GOLD RUSH · ●●○ · 0:22` and the eve line are exported for builder 4 (`rushLine`, `RUSH_EVE`); see
    Hand-offs.
  - Events carry `call: 'gold'` (one call a ball) and `answer: 'gold'` on a take.

### 2a. Happy Hour (Tiered)
- **When.** Every Tiered shift except Promotion Day: **T-4:00 for 60 s at 2P+**.
- **Change from the brief: solo runs at T-5:30.** At T-4:00 a solo crew lost the bowls on Happy Hour days, and 1P
  Tiered ran 4/6/8 shifts. At T-5:30 the one Rat is back on the bowls well before the T-3:00 rally.
- **The deck.** The queue fills to 3 at once (`deck.js happyFill`, called through a `deck.mjs` signal, so the Tap Wall
  still pours every third ticket). Every order open during the window is a Happy Hour order (`o.happy`), and `tabFor`
  pays it ×1.5. Happy Hour orders count toward the card's `orders` goal like any other order (`stats.deckOrders`).
- **The loungers' balls.** 1 at 1P (always green A, the nearest), 2 at 2P, 3 at 3P+, one per green and off the cup. Each
  sits under a pink-and-cyan neon beam with a 30 s clock (40 s solo). Returned, each pays ×20 Ball Value. Lapsed: "The
  lounger shrugs. Experiential."
- **Addition: the upper deck rests.** The upper-bay golfers are the loungers, so they put their clubs down for the 60 s
  window. Without this a 4P crew missed the bowls at 0.43–0.45 and Tiered ran 4 shifts.
- **What you see and read.**
  - One ALERT: "Happy Hour! Drinks, and fetch the greens!"
  - The report row: "Happy Hour: 3 pours, 2 of 3 greens · +$41k".
  - The Board line is exported for builder 4 (`happyLine`); see Hand-offs.
  - Events carry `call: 'lounger'` and `answer: 'lounger'`.

### 2b. The solo bowls read
- `rally.js bowlsPass`: at Last Call the bowls pass at 1P when they hold ≤ 50 % of their load at the T-3:00 rally, and
  at 2P ≤ 25 %. 3P+ keep the plain read. It only adds a pass.
- `happyhour.mjs` runs after `tiered.mjs` in MODULES and lifts the frozen Last Call read to `QUOTA_KPI` when the eased
  rule passes. The miss line is unchanged on a real miss.
- In the bots it never fired. The solo misses were bowls at 0 % (full), not near misses.
- Step 3 (the per-size Tiered `reviews` goal) was not needed: 1P Tiered now has a median of 3–4 shifts.

### 3a (my part). The Bell rings a bonus Happy Hour at Tiered
- Ⓐ at the bell rings a bonus Happy Hour once a shift, T-6:00..T-1:30. It is refused inside a live Happy Hour, and when
  it would overlap today's (`bonusClear`). ALERT: "Bonus round! The bell has spoken."
- `s.mods.happyhour.bell` (1 open, 2 rung, 0 shut) is the shape builder 3's `bellStateOf` reads. The Tournament's bell
  handler now answers only at the Club, so a Tiered ring never flies a member flight.

## Files
- **New:**
  - `web/js/goldrush.js`, `server/venues/goldrush.mjs`, `web/js/views/goldrush.js`
  - `web/js/happyhour.js`, `server/venues/happyhour.mjs`, `web/js/views/happyhour.js`
  - `scripts/bots/policy/goldrush.mjs` (exports `chaser`), `scripts/bots/policy/happyhour.mjs`
  - `test/goldrush.test.mjs`, `test/happyhour.test.mjs`
- **Mine, edited:** `web/js/deck.js` (`HAPPY_X`, `happyFill`, `markHappy`, the `tabFor` ×1.5) and
  `server/venues/deck.mjs` (the `signal('happyhour')` fill, Happy Hour pour stats, `o.n` for the Tap Wall, the snapshot's
  `happy`); `web/js/rally.js` (`BOWLS_EASE`, `bowlsEase`, `bowlsPass`).
- **Registered as builder 4 asked:** one import and one MODULES entry each in `server/venues/index.mjs` and
  `web/js/views/index.js`.
- **Shared:** one appended block in `test/words.test.mjs`, and one appended section in `design/game-design.md`.
- **Not touched:** `crew.mjs`, `main.js`, the `tourney.*` files (someone else's 3b edits were already in them,
  including the venue-1 guard on the bell), `tiered.mjs`, the bots builder 4 owns.

## Tests
- `test/goldrush.test.mjs` (7): the days (with the Club Gary-day rule), the times and the dodge, N and the clock by
  size, the solo cluster, the pond ball, the Board line and report row, an in-crew claim (with the `call` tag), an
  in-crew take and bank as gold (hands, not the pocket) with the clean sweep, and no fire on Muni days 1–2 or Club day 1.
- `test/happyhour.test.mjs` (8): the days and times (solo T-5:30), `happyFill` with ×1.5, the greens by size (solo is
  green A), `bonusClear`, the Board line and row, an in-crew window (the fill, the call tag, ×20 BV on a bank), the
  bell's bonus once a shift and never on top of today's, and the bowls read at 1P versus 4P.
- `test/words.test.mjs`: every new line is ≤ 8 words (the report rows before the number).
- **The whole suite:** green except one test in `test/landmarks.test.mjs`. The Tap Wall test failed after Happy Hour
  started filling the deck at 90 s solo; that is fixed (`o.n`) and the file is green. A goals 8.4 test failed once on
  another builder's in-flight edit and passed on re-run.

## Measurements
All runs use the bots. "base" means the same bot with my two modules removed from MODULES (a scratch wrapper). "on"
means `POLICY=goldrush,happyhour BUY=1 TOURNEY=1`. `mid.mjs` starts from `club1`; `muni.mjs` starts from Muni day 1
(seeds 7/11/23).

**Calls a minute, offered (answered from builder 4's new column):**

| Measure | Target | Base | Now |
| --- | --- | --- | --- |
| Muni day 3, 1P / 4P (`muni.mjs`) | ≥ 0.8 / ≥ 1.1 | 0.43 / 0.71 | **0.86 / 1.29** (2P 1.00) |
| Muni whole venue, 1P (days 1–5) / 4P | ≥ 0.7 / ≥ 0.8 | 0.63 / 0.65 | **0.73 / 0.82** |
| Club day 2, 1P / 2P / 4P | 4P ≥ 1.4 | 0.95 / 1.19 / 1.00 | 1.38 / 1.29 / **1.57** |
| Tiered without deck orders, 1P / 2P / 4P | ≥ 1.0 / – / ≥ 1.5 | 0.75 / 1.16 / 1.52 | **1.20 / 1.59 / 1.94** |
| Tiered, all calls, 1P / 2P / 4P | – | 2.17 / 2.59 / 2.95 | 2.70 / 3.01 / 3.36 |

**Rush and loungers:**

| Measure | Target | Now |
| --- | --- | --- |
| Rush balls answered, Muni day 3, 1P / 2P / 4P (`mid.mjs` from a Muni day-3 save) | ≥ 60 % / – / ≥ 75 % | **6/9 (67 %) / 8/9 / 11/12 (92 %)** |
| Rush balls answered, Club day 2, 1P / 2P / 4P | – | 9/9 / 9/9 / 11/12 |
| Gold Rush share of the day's income | < 10 % | 4–5 % (Club day 2); ≈ 7 % solo at the Muni (+$53 of a ~$770 day) |
| Happy Hour share of a Tiered day's income, 4P | 8–15 % | median ≈ 14.7 % gross (×1.5 tabs + balls); the uplift over plain orders is ≈ 7 % |
| Lounger balls answered, 1P / 2P / 4P | – | 24/24 / 43/56 / 35/45 |

**Venue length (shifts) by seed, 7 / 11 / 23:**

| Venue | Target | Base | Now |
| --- | --- | --- | --- |
| Tiered, 1P | ≤ 5 median, max 6 | 3 / 4 / 4 | **3 / 3 / 10** |
| Tiered, 1P, extra seeds 5 / 13 / 29 / 31 / 37 | – | 3 / 3 / 4 / 10 / 5 | 5 / 5 / 4 / 3 / 3 |
| Tiered, 2P | ≤ 5 | 6 / 6 / 5 | **5 / 5 / 4** |
| Tiered, 4P | 3, never longer | 3 / 3 / 3 | **3 / 3 / 3** |
| Club, 1P | unchanged | 5 / 5 / 5 | 5 / 5 / 5 |
| Club, 2P | unchanged | 5 / 7 / 7 | 6 / 6 / 11 |
| Club, 4P | unchanged | 5 / 4 / 6 | 6 / 5 / 4 |
| Muni (`muni.mjs`), 2P / 4P | unchanged | identical | identical |

- **Tiered 1P across all 8 seeds:** base median 3.5; now median 3.5 (3, 3, 3, 3, 4, 5, 5, 10).
- **The 10-shift solo outlier is a bot loop.** I traced it: on Promotion Day (no Happy Hour runs that day) the bot's
  diver idles at the pond edge with a full pocket from T-3:45 to T-2:15, every day. Base seed 31 shows the same
  10-shift loop.
- **The Club 2P seed 23 (11 shifts)** is the bot's Seal huddle failing over and over, with one Rat 94 m out. The same
  failure hit a 4P seed in an earlier run.
- **`muni.mjs` 1P never promotes, in base or now.** It's a pre-existing bot limit, which is why the 1P whole-Muni row
  uses days 1–5.
- **The Bell at Tiered** was rung in 9 of 14 owned shifts at 2P, and 5 of 6 at 4P. The rest were Gary or Promotion Day
  windows and the overlap rule. Builder 3 owns the ≥ 80 % target.
- **Tiered bell cash against the fee, 4P:** every 4P crew still promoted after its third Tiered shift.

## Seam goldens
- Unchanged: `test/seam.test.mjs` passes as is.
- The Muni day-1 crew run and the Club run (`CLUB_SAVE`: day 6, venueDay 2, so the shift is Club day 3) don't reach a
  rush.
- Short test shifts (90 s) get no rush (`MIN_AT`).
- Expected moves when the lead re-records the longer goldens: Muni day 3+, Club day 2+, and Tiered (Happy Hour's ball
  ids, the upper bays' 60 s rest).

## Browser (rr-play-b, pane shown and tab fronted, p50 17.6–18.0 ms ≈ 55 fps)
- **`muni3`, solo, idle:**
  - The ALERT "Gold Rush! Beat Site 13's cart!" was the only centre item, with the three gold beams down-range:
    `design/shots/c14-peaks-rush-beams.jpg`.
  - Site 13 claimed all 3. The report row "Site 13 took all 3. For research." is in
    `design/shots/c14-peaks-rush-report.jpg`.
  - The van (outside the left net) and the red cart are out of frame from the spawn. I didn't get a cart shot: the claim
    lands about 90 m out, and I couldn't turn the camera.
- **`tiered1-1p`, solo:**
  - Happy Hour fired at T-5:30: the deck queue filled to 3 (head ticket `happy`), and one lounger ball sat on green A
    under the pink neon beam (`design/shots/c14-peaks-happyhour-beam.jpg`).
  - **The Happy Hour ALERT was not on screen at T-5:26, and say.js reported 1 dropped item.** It was most likely dropped
    after waiting 15 s (`TTL.ALERT`) behind the Tiered reveal morning's cards. See Open issues.
- **Perf:** worst-frame spikes (440–990 ms) line up with my screenshots; p50 held at about 18 ms.

## Hand-offs (builder 4)
- **The Board:** `rushLine(s.mods.goldrush)` → `GOLD RUSH · ●●○ · 0:22`, and `happyLine(s.mods.happyhour)` →
  `HAPPY HOUR · ORDERS 3 · ●●○ · 0:41` (`board.js`).
- **The eve line:** `tomorrowText`'s Muni day-3 branch (the night of day 2) → `RUSH_EVE` ("Tomorrow: a Gold Rush. Gold
  balls, worth ten.").
- **The deck's tickets:** `views/deck.js` could tint a Happy Hour ticket (`s.mods.deck.happy`, the head ticket). It's
  optional, and the file isn't mine.

## Open issues
- **Item 3b (the Tournament memo, row and solo clock) isn't in this report.** Another builder's edits were already in
  `tourney.js` / `tourney.mjs` (`SECS_1P`, `PAIR_1P`, the Gary window, the bell's venue-1 guard). I didn't touch them.
- **Item 3c (the County fireworks, the Orbital audit) was in my brief but is builder 3's in the council doc.** Builder 3
  is editing `county.*` / `orbit.*`, so I didn't duplicate it.
- **Item 7 (the Coach Party)** was not built.
- **Four deviations from the council's numbers** are described above: 3 rush balls solo, the Club Gary-day timing, the
  solo Happy Hour at T-5:30, and the upper deck resting during Happy Hour.
- **The Happy Hour ALERT can be dropped on Tiered day 1 (the reveal morning) at 1P.** The solo window opens at T-5:30
  (90 s), and the reveal's cards can hold the centre past the ALERT's 15 s queue TTL. Builder 4's textload window check
  (or skipping the reveal morning at 1P) would settle it. Days 2+ are unaffected.
- **The deck's tickets don't look different in Happy Hour yet** (`views/deck.js` isn't mine).
