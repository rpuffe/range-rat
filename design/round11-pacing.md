# Round 11, builder "pacing": the run's shape and the end of each shift

What I built, from `r11-briefs.md` (builder "pacing"), the expert review (`expert-review-pacing.md` §8 #1, #2, #4b, #5.3, the
solo-Gary XS) and the owner's end-of-day call. It ends with the lead's final pass: I swapped the income compensation for
a busier daytime crowd, made the bowls a buzzer-beater at 2:30, gave the Stadium a Three-Minute Warning, and cleaned up
the other builders' leftovers.

## 1. Late cards: 2 good days (expert #1)

- `goals.js CARDS`: `reviews` n = 2 at the Stadium and the County.
- **The scaled "Drive 20 laps" did not land in 2 shifts.** One driver laps 6–7 times a shift. I cut it to **12** (solo
  5, 2P 8). The 4P bot now finishes it early on shift 2.
- The County's strays had the same problem (58, then 92 by shift 2), so they are now **85** (was 150).
- The County was also limited by its fee (31.8M of 33M at 4P on shift 2). The Orbital fee is now **12.5M** (was 15M).
  I kept this in the final pass: the 4P County fits in 2 shifts on all three seeds.
- After a promotion to a card with a Gary goal (the Club's Seal, the County's pass), Gary comes on the new venue's
  second morning at the latest. Before, the 2–3 day gap could make a 2-shift card wait a third day.

## 2. Promotion Day (expert #2): `web/js/promoday.js` (new, pure)

- `isPromotionDay(crew)` is exported, and builder "today" reads it (no Today modifier that day).
- **Dealt at the bell** (`crew.promoBell`) when `promoDue(rows)` holds: the review row is exactly one short and every
  other row is done, the live fee included. It sets `crew.promoDay = day + 1`, which is saved. The report's tomorrow line
  reads "Tomorrow: Promotion Day. Regional is watching."
- **That morning:**
  - The memo reads "Promotion Day. Regional is watching."
  - `garyDay = day`, so Gary inspects and the Seal can land.
  - Gary rides along all shift, looping behind the fence. It goes on the wire as `garyIntro` with `ride: true`, and
    `main.js` shows it whenever his visit is not active.
  - The target tick is +10 points of the bar (`promoQ`, capped at 90%) on the first try only.
  - The Board's goal strip reads **PROMOTION DAY / NEXT: HIT THE TARGET AT THE BELL**.
- **Pass** (quota hit and card done): a `promoday` event, PA `promoday`, and `promote()` runs at once. There is
  confetti at the return (`round2.js`).
- **Fail**: it is dealt again at the regular target, and the tomorrow line reads "Tomorrow: Promotion Day again.
  Regular target."
- **Measured (final pass, mid bot 4P):**
  - Seed 7: Tiered's Promotion Day failed on the bowls ("Missed: the bowls were full at 2:30."), and the second try
    passed.
  - Seeds 11 and 23: it passed first time, and the crew signed on the spot.

## 3. The owner's end of day: `web/js/dayend.js` (new, pure) and the LAST_CALL / CLEANUP region of sim.js

- `LAST_CALL = { SECS: 150, FROM_DAY: 2, SWING: 1, TAPER: 180, FULL: 420, MIN_RATE: 0.5, DAY_RATE: 1.6 }`,
  `CLEANUP = 120`.
- **Timeline:**
  - **T−3:00:** the taper starts. Busy bays fall as `ceil(n·k)` and the swing rate as 0.5 + 0.5k, both smoothly.
  - **T−2:30:** Last Call: glow balls, the horn and the rally.
  - **T−2:00:** the last customer is out, and two minutes of cleanup begin with the cleanup deal.
  - There is no ×3 rush.
- **Short shifts:** the windows scale by `shiftSecs / 420`, so day 2 (360 s) tapers at T−154. Day 1 has no taper.
- **The busier day (final pass):** `swingRate(k, day)` = DAY_RATE × taperRate(k) from day 2. Day 1 keeps the plain
  rate. Customer balls per shift, idle seeded shifts, against HEAD (pre-round-11):

| Shift | HEAD | Taper only | Final (DAY_RATE 1.6) |
| --- | --- | --- | --- |
| Muni 4P | 481–503 | 332–341 | 481–490 |
| Muni solo | 291–308 | 197–208 | 284–289 |
| Club 4P | 508–520 | — | 490–500 |
| Club solo | 298–312 | — | 291–299 |
| Tiered 4P | 503–527 | — | 494–511 |
| Tiered solo | 302–312 | — | 288–303 |

  All are within ~5%. The Stadium reads lower only because builder "late"'s booing crowd walks out on an idle crew.
  Glow balls are ~10 a shift (was ~80), because glow is the 30 s Last Call window by design.
- **Undone compensations:** the Muni bank goal is back to **2000** and the Tiered fee back to **50k**. A 4P Muni banks
  1,600–1,700 by day 3 and is promoted on day 4 on every seed.
- **Glow Rush, a buzzer-beater at 2:30 (final pass):**
  - Tiered's bowls are read at **Last Call** (`tiered.mjs`, `kpiAtClose` on `crew.lastCall()`).
  - Tiered rallies at **T−3:00** with "Bowls judged at 2:30! Shoot them clear!" (`RALLY_AT[2] = 180`).
  - A save counts between the taper and Last Call. The miss line is "Missed: the bowls were full at 2:30."
  - `rushShift`, seeds 1–6: a TARGET at T−2:32 gives 6/6, none gives 0/6, and one at T−2:20 changes nothing.
- **Stadium (final pass):** the banner that never showed is now a live **THREE-MINUTE WARNING** (`RALLY_AT[3] = 180`).
  It reads the live crowd at T−3:00, and Last Call rings with no second line. `warnDue` scales `RALLY_AT` like the
  windows; a 300 s shift warns at T−129.
- **Also updated:**
  - `UPKEEP_MARGIN` is 0.06 → 0.02 (no ×1.5 rush to forecast).
  - The cleanup deal re-checks at T−2:00.
  - "N left out there" shows from 2:00.

## 4. SPOTLESS RANGE (expert #4b and the owner)

- `dayend.js spotlessBonus`, settled in `endShift` from day 2:
  - **0 balls out** pays 0.75 × a ✦ goal reward (BV × the venue's share × crewScale), ~5% of a shift.
  - **Nearly spotless** (≤ 2% of the day's customer balls, and ≤ 12) pays 0.3 ×.
  - A day with fewer than 30 customer balls gets nothing.
- `stats.launched`, `report.spotless`, a green stamp row on the report ("SPOTLESS RANGE! +$X"), and a `spotlessRange`
  event.
- The 4P Muni bots end most days with 0 balls out, so it is a common, earned bonus at 4P and rare solo.

## 5. Solo Gary (expert XS)

- `GARY.SOLO_WARN` is 60 → 90 s. On a solo Gary morning, the sign and the cart(s) start at his pass line
  (`GARY.SOLO_START` 0.34).
- **Proof:** a solo bot that only reacts to the warning (`scratchpad/pacing/muni.mjs`, flag `react`) passes on its
  **first visit** with the huddle (fails 1) on seeds 7, 11 and 23. This still holds after the final pass. Before, the
  expert's reactive bot failed 11 visits in a row.

## 6. ✦ goal rewards (expert #5.3)

`REWARD_BV = [40, 60, 120, 180, 150, 130]` by venue, × BV × crewScale (`rewardFor(bv, venue, crew)`). That is 6–9% of
a 4P shift at every venue (was 2% late).

## 7. Final-pass leftovers from the other builders

- **a. Buckets:** leaving customers (lower and upper bays) now walk out empty-handed (`customers.js custPos`,
  `carry: false`). The held bucket model is always full, and the emptied bucket stays at the bay.
- **b. Tube posts block the cart:**
  - `layout.js TUBE_POSTS` (trunk tier 1, Back branch tier 2) is one list for the drawing (`ballreturn.js`) and the
    collision.
  - `map.js cartBlocked` blocks within 1.3 m of an owned post. It reads `world.ret`, the 'returns' tier, now in
    `crew.world()` and `main.js world()`.
  - The cart still fits between the x = 50 posts (9 m apart). The cart-grid golden did not move.
- **c. Ball Shortage:** the snapshot carries `basketMax`. The prompt ("Basket n/6", "Basket full") and the filler's
  busy wobble read it.
- **d. `sfx.js boo()`:** five detuned low "ooo" voices sagging through a low-pass, over a murmur, throttled to one
  every 1.5 s. `views/stadium.js` already calls it.
- **e. The sweep's ×N** is no longer shown for pond- or creek-dive grabs. They go to the dive bag, which the server's
  sweep doesn't count.

## Measurements: 4P time to the ending (final pass, expert scripts, 40 s overnights)

| | Muni | Club | Tiered | Stadium | County | Orbital | Last Bucket |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Before (expert) | 4 | 3 / 4 / 5 | 3 | 3–4 | 3 | 1 + ~3 min | ~2 h 14–2 h 23 |
| Seed 7 | 4 | 3 | 4 (Promotion Day failed once) | 2 | 2 | 1 + ~5 min | **~2 h 03** |
| Seed 11 | 4 | 6 (the bot's huddle) | 3 | 2 | 2 | 1 + ~5 min | ~2 h 20 (~2 h 04 with a Seal on the fee day) |
| Seed 23 | 4 | 4 | 3 | 2 | 2 | 1 + ~5 min | **~2 h 05** |

- **Stadium d1 → Last Bucket:** 4P 43–45 min (was 57–65); solo 59–60 min (was 65; the solo Stadium is still limited
  by its fee, 4 shifts).
- **The Club** is 3–4 shifts at 4P, set by its fee (110k) under builder "feel"'s day-1 stagger (Club day 1 earns
  ~26–31k). Seed 11's Seal stalls only because the mid bot's creek diver stays 94 m from the huddle on three Gary
  visits.
- **Solo Muni** (reactive bot): Gary passes on the first visit; promoted on day 6.

## Files touched

- **New:** `web/js/promoday.js`, `web/js/dayend.js`, `test/pacing11.test.mjs` (17 tests).
- **Code:**
  - `server/crew.mjs`
  - `server/venues/tiered.mjs` and `server/venues/stadium.mjs` (comment)
  - `web/js/sim.js` (LAST_CALL, CLEANUP, GARY, the Orbital fee)
  - `web/js/goals.js`, `web/js/rally.js`, `web/js/main.js`, `web/js/round2.js`, `web/js/pa.js`, `web/js/duskview.js`
  - `web/js/customers.js`, `web/js/layout.js`, `web/js/map.js`, `web/js/ballreturn.js`, `web/js/sfx.js`
  - `web/js/views/stadium.js`, `web/js/views/registry.js` (comment)
- **Tests updated:**
  - council, playtest2a, playtest3a, playtest4, rally, gauge, round2, stadium, tiered
  - goals, goalcard, promopanel
  - late (the van test's hazard count, since the busier day spawns a few more), range11 (empty-handed walk-out)

## Goldens

The three Muni / Club seam goldens moved. My changes that move them:

- the end of day (taper, DAY_RATE, the cleanup from T−2:00);
- the reward and SPOTLESS cash.

Other builders' changes move them too. I did not re-record them.

`node --test test/`: 1033 tests, only those 3 fail.

## Open issues

- **Glow balls** are now ~10 a shift. Rain (builder "today") starts glow earlier, which brings some back.
- **The busier day** fills the basket chore and fry consumption as fast as the old whole day did, just earlier. Watch
  the 1–2P basket in a real playtest.
- **The ride-along, the boo and the basket prompt** have not been checked in the browser.
