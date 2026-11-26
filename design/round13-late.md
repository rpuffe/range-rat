# Council round 11, builder 3 ("late"): the County says "hazards", souvenir requests, endless opens with a win

Brief: `council-round11.md` items #2, #5 and #6, plus the MOW-E 2.0 crowd hook (§2.7). Built on the shared checkout
alongside builders 1, 2 and 4. Nothing is committed; the lead commits.

## What I built

### #2 · The County says "hazards" (the High)
- **The miss line names the bigger term.** `rally.js` gains `zoningCause(st)`, `missLine(venue, st)` and
  `gaugeMiss(venue, st)`. At the County it compares `haz / 12` with `strays / 30`; hazards win ties.
  - Hazards bigger: "Missed: 9 hazards left out. Spray, then bag." (8 words; "1 hazard" when there is one).
  - Strays bigger: "Missed: 14 strays in the Yards."
  - Nothing out (a stubbed gauge, or an old caller): `GAUGE_MISS[venue]`, as before.
  - `ZONE_COST` mirrors `HAZ.CAP` and `ZONING.STRAY_CAP`, and a test pins them equal.
- **The quota carries the cause.** `endShift` spreads in `gaugeMiss(...)`, which adds `why`, `cause` ('haz' or 'strays')
  and `out` ('9 hazards out'). The report row reads "Zoning at the bell 41% · 9 hazards out".
- **The live deal.** `county.js` gains `HAZ_DEAL { MIN 3, OVER 0.1, EVERY 45 }`, `hazDealDue` and `hazPair`. The county
  module deals it.
  - It fires whenever Zoning is under QUOTA_KPI + 0.1 with 3 or more hazards out.
  - It sends `{ t: 'rally', needs: { sprayer, bagger }, haz }` with "Hazards out! Spray and bag!" to the two Rats nearest
    the hazards' centroid. A wand holder is preferred as the sprayer. Solo, the one Rat gets it.
  - The other Rats get no line (the event has no `need`).
  - It re-deals at most every 45 s. Last Call resets the timer, so the T−1:30 rally is followed on the same tick by the
    hazard deal.
  - It works through the cleanup too, because hazards count at the bell. It is off in endless.
- **The Last Call rally line for the County** changed from "Strays in the Yards. Go get them!" to "Zoning's low! Bag
  hazards, fetch strays!". The old line sent half the crew to Yard 2 even when hazards were the problem.
- **The Board label.** `mods.county.label` is `ZONING 62% · 7 HAZARDS` (`zoningLabel`), sent at venue 4 only.
- **The first van tow's toast** is "Zoning towed 6 balls. Bag the hazards!" (`vanToast`). Later tows stay in the feed.
- **The tip re-arms.** `HINTS.hazard` gains `again: true`. `settings.armAgain(id)` drops an `again` hint from the stored
  seen list and from every live hinter. `views/county.js` calls it on a County `quota` event with `cause === 'haz'` and
  no hit. The tip then shows again when the next shift's first hazard appears.

### #5 · Souvenir requests: "WE WANT A BALL!"
- **Pure rules in `stadium.js`:**
  - `REQ { FROM 30, TO 60, EVERY [90, 75, 60, 45], SECS 30, CROWD 0.15, PAY 3, MISS 0.06, MISS_SOLO 0.03, LEN 16 }`.
  - Six `SECTIONS` of 16 m: A, B and C down the left rail; D, E and F down the right.
  - Helpers: `reqDue`, `reqSection` (a fixed order with no RNG draw, so the seam's draws are untouched), `inSection`,
    `souvPay`, `reqCrowd`, `reqMiss`, `reqLine` (the Board's "SECTION C WANTS A BALL · 0:18") and `carryLine`.
- **The server (`stadium.mjs` `requests()`).**
  - One request is lit at a time, start to start every 45/60/75/90 s by crew size, from 0:30 until T−60.
  - A delivery inside the lit section gives +0.15 crowd, plus 0.07 for each extra ball in the bundle. It pays ×3, and
    the relay's ×2 does not stack.
  - An unanswered request costs −0.06 crowd (−0.03 solo), plays a boo and adds a feed line. There is no centre text.
  - The snapshot carries `req: { i, sec, left }`. New events: `crowd` with kind `req`, `reqmiss`, or `souv` with `req`.
- **The look (`views/souvreq.js`, new).** It adds four meshes, built once and hidden when idle:
  - a pulsing gold hoop standing on the lit stretch of rail;
  - arms waving over that section's stand crowd: one InstancedMesh of 48, which reads the venues.js crowd `base`
    positions with no edit to venues.js;
  - a canvas banner "WE WANT A BALL! / SECTION C" over the stand;
  - a confetti puff (an InstancedMesh of 40) when the request is answered.

  It makes no per-frame allocations.
- **Feed lines:** "Section C wants a ball!", "Section C wanted a ball." and "Rat: souvenir to Section C! Triple!".
- **Fixes:**
  - C #11: the carry prompt is now "Souvenirs ×2 → crowd rail", or "→ Section C, lit!".
  - C #8: the autopilot's "A lap of the Track!" feed line fires only at the Stadium, and never while `#story-card.on`.
- **Tuning.** `SOUV.W` is 12 → **25** and `SOUV.CHANCE` is 0.06 → **0.10**. The council's W 20 measured only 13–16 %
  at 4P (see below). Both are thresholds on existing draws, so no RNG call was added.
- **The MOW-E 2.0 crowd hook (§2.7).** It reads builder 1's `crew.mower` (`kind 'boss'`) and `bossLive` at the Stadium:
  - the crowd doesn't drain while the boss is live;
  - each new hit (`s.hits`) adds +0.08 (`BOSS_CROWD.HIT`);
  - `phase 'tamed'` (a win) sets the crowd to 1.0.

### #6 · Endless opens with a win
- **`owner.js`.**
  - `yesterdayPace` no longer falls back to `records.cash`, so there is no race without a yesterday.
  - `raceYesterday` with no yesterday returns `{ first: true, target }` and a streak of 0.
  - `streakLine` reads "Day 1 as Owners. Beat $70.8M tomorrow." (7 words).
  - New `ownerRecord`, `cleanOwner` and `ownerBook` (the reset for `depositOne`).
  - New `winchLine(price, cash)` → `SKY CLEAR · WINCH $13.2M · YOU HAVE $9.1M`, for builder 4.
- **`crew.mjs` records block.**
  - In endless, `records.cash` still updates as "Best ever" but no longer makes the report's `record`.
  - `records.owner` opens on endless day 1 with no NEW.
  - From day 2, beating it is the record: `record.owner`, plus the record PA.
- **Load (one line, see "outside my region")** reads `records.owner` through `cleanOwner`. The save already carries
  `records` whole.

## The numbers (headless, through the real Crew)

The bot is the round-11 jobs bot `late11.mjs` (playtest C's copy, with `START_FILE`), in
`scratchpad/c11b3/late11.mjs`. I added these switches:
- `LEARN=1`: JOB turns on after the first County miss line that says "hazard".
- `REQ` (on by default): the souvenir runner runs to the lit section.
- `REQWAIT=1`: hold the bundle until a section lights, unless it's T−75.
- `SCH` and `SW`: override the chance and W, for the sweep.

It also logs the bell's cause and counts. The presets are unwrapped from `server/presets/*.json`.

### County (`county1`, seeds 7 / 11 / 23)
| | 3P DENIED | 4P DENIED |
| --- | --- | --- |
| JOB=1 (does the job) | 0 / 0 / 0 | 0 / 0 / 0 |
| LEARN (job on after the first "hazards" line) | 1 / 1 / 1 | 1 / 1 / 1 |
| JOB=0 (ignores hazards) | 2 / 3 / 1 | 10 / 1 / 2 |

- **Miss line accuracy: 23 of 23** County DENIEDs had hazards as the bigger term, and all 23 lines named hazards
  (target 100 %). No run produced a strays-bigger DENIED.
- **The learner** is DENIED exactly once more than JOB=1 in all six runs (target ≤ 1).
- JOB=0 at 4P seed 7 is still DENIED 10 times. The hard wall is unchanged by design (`HAZ` is left alone), but every
  bell now names it.
- The live deal fires about 9–10 times a shift for a crew that never bags. That's the 45 s cap. A crew that bags stops
  getting it.

### Stadium (`stadium1`, seeds 7 / 11 / 23, the first two to four Stadium shifts each)
| | souvenir share of income | review |
| --- | --- | --- |
| 4P attended, holds for the lit section | **17.3–19.1 %** (mean 18.5 %), 6–7 of 8 requests answered | all APPROVED |
| 4P attended, delivers to the nearest rail | 5–20 % (one 5 % shift where the bot found only 5 souvenirs) | all APPROVED |
| 2P attended | 11–16 % | all APPROVED |
| 1P attended | 9–24 % | all APPROVED |
| 4P ignores souvenirs, autopilot + pings only (TEND=0) | 0 % | **DENIED in 8 of 10 shifts after day 1** (crowd 0.08–0.41 at the bell) |
| 4P ignores souvenirs but laps (TEND=1) | 0 % | all APPROVED (crowd 0.84–0.91) |
| 1P ignores souvenirs (either) | 0 % | **100 % APPROVED** (target ≥ 80 %) |

Tuning sweep at 4P (hold strategy):

| chance / W | 4P share |
| --- | --- |
| 0.06 / 20 (the council's) | 13–16 % |
| 0.08 / 25 | 16.6–18.5 % |
| 0.08 / 30 | 15.7–21.3 %, with one 4 % outlier |
| **0.10 / 25 (shipped)** | **16.8–19.6 %** |

Notes on the Stadium numbers:
- **Ignored with laps:** a crew that laps the Track instead of delivering still passes. One lapper's +0.1 a lap
  out-runs the 4P drain plus the misses. I read that as the council's "lapping vs delivering is a real choice", not a
  failure: the target "under the line in ≥ 1 of 2" holds for a 4P crew that ignores the crowd jobs and lets the
  autopilot run it (C's complaint).
- **The 4P share** sits at the bottom of 18–25 %. Raising W further adds variance faster than mean. Next lever if
  wanted: W 28.
- **A bot artifact:** at 2P with JOB=1 the pings goal stalls (the pinger is the souvenir Rat), so the bot stays 13–20
  shifts at the Stadium. That's the same as in playtest C's baseline (`jobs_2_1`: 25 shifts), and not a game problem.

### Endless (`scripts/bots/late.mjs` from `orbital1`, 4 endless days, seeds 7 / 11 / 23)
- **Day 1:** in 9 of 9 runs the report reads "Day 1 as Owners. Beat $X tomorrow."; no run shows a loss line.
- **An owner NEW record in endless days 2–4:**
  - 1P: 3 of 3 runs;
  - 2P: 3 of 3;
  - 4P: 2 of 3 (seed 23 trended down from day 1, $76.1M → $66.7M).

  Target: ≥ 2 of 3 at each size.

### Browser (rr-play-c, :8096, pane fronted)
The Stadium day-1 skip preset, a request lit at 0:30 and again at 2:00 (solo, so 90 s apart). The hoop, the banner
and the waving section read from mid-field. Shot: `design/shots/c11-late-souvenir-request.jpg`.
- The first try had the banner clipped ("VE WANT A BAL") and a flat ground ring that was invisible at range. Both are
  fixed: the banner uses fillText's maxWidth, and the hoop stands up.
- During the session, builder 1's half-done `mower.js` (`SFX.moweEngine` not yet exported) killed the frame loop once.
  It was fine after builder 1's sfx.js landed.

## Files touched
- Mine:
  - `web/js/rally.js`, `web/js/county.js`, `server/venues/county.mjs`, `web/js/views/county.js`;
  - `web/js/stadium.js`, `server/venues/stadium.mjs`, `web/js/views/stadium.js`, new `web/js/views/souvreq.js`;
  - `web/js/owner.js`, `web/js/settings.js`.
- **`server/crew.mjs`**, in my region (`endShift`'s quota `why` and the records block), plus two small lines next to
  it:
  - the `rally.js` and `owner.js` import lists (`gaugeMiss`, `ownerRecord`, `cleanOwner`);
  - **outside my region, one line:** the load's records line also reads `records.owner` (`cleanOwner`). Without it the
    Owners' book wouldn't survive a save.
- **`web/js/main.js`, outside my region (I have none there), one expression in the report card:** the gauge row reads
  "Zoning at the bell" at venue 4 and shows `quota.out` before `quota.why`.
- Tests:
  - new `test/late11.test.mjs` (12 tests);
  - `test/rally.test.mjs`: the County's gauge rally line;
  - `test/owner.test.mjs`: no race before a yesterday, and day 1 opens the book;
  - `test/round2.test.mjs`: the record-PA test gets an open owner book, and the pace test gets a yesterday. Both pinned
    the old "race the record" fallback.

## Tests
- `node --test test/` → 1103 tests, 1098 pass, 5 fail. None of the failures are mine:
  - `deck.test` "a filled order pays 10 × BV" is Tiered (venue 2) cash, off by $337. My modules don't run there, and the
    venue-2 miss line is unchanged.
  - `round2.test` "Gary visits the kitchen…" is Gary's stops list. That's builder 1 or 4 (`garyvisit.js`).
  - The three seam GOLDENs are Muni and Club runs with no modules.

## Goldens
- **I didn't re-record them.** My changes touch only:
  - venue 3+ modules (the Stadium and the County);
  - the gauge miss fields, which venues 0–1 never set;
  - the records block, which only differs in endless.

  So the Muni and Club goldens did not move because of me. The failing GOLDENs move for other builders' Muni and Club
  work.
- If a Stadium or County fingerprint exists elsewhere, it will move from `SOUV.CHANCE` and `W`, the requests' crowd
  changes, the `reqHit` stat, the county `label` in the snapshot and the deal's `rally` events.

## Hand-offs
- **Builder 4, `board.js`:**
  - draw `mods.county.label` on the Zoning gauge;
  - draw `reqLine(mods.stadium.req)` (from `stadium.js`) on the crowd gauge while one is lit.
- **Builder 4, the winch strip (`huddlerules.js` `lastBucketLine` / `goals.js`):** while `lb.step` is the tether, show
  `winchLine(nextPrice('tether', …), c.cash)` from `owner.js`.
- **Builder 4, `sim.js`:** the County NEW line "NEW: the Yards. Spray green hazards, then bag."
- **Builder 2, `depositOne`:** one line on banking Ball No. 1: `this.records = ownerBook(this.records);` (from
  `owner.js`). It isn't strictly needed on a normal run, because nothing writes yesterday or owner before endless. It
  matters for replays and old saves.
- **Builder 1 (optional):** a crowd "chant" sound in `sfx.js`. The answered request plays `jackpot` + `bell(784)` for
  now.
- **The lead:** add the three items to `game-design.md`, which isn't in any builder's ownership list.

## Open issues
- The live deal's ALERT can come every 45 s for a crew that won't bag. That's correct by the brief, but worth watching
  in the text-load pass.
- The 4P share sits at the low end of the target (mean 18.5 %).
- An endless report's "Record shift! Best shift: $X (was $Y)" (in `round2.js`) now compares against the owner book.
  "Owners' record" wording would be clearer; that's builder 2's file.
