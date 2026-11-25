# Round 11, builder "late": the Stadium and the County bite, and every Rat gets a job

Expert review #6 (make the late gauges bite) and #9 (one hands-on job per late venue that grows with the crew).
Reviews were left alone (builder "pacing" owns them; the bot ran with their Stadium/County `reviews` n = 2).

## What I built

### 1. Crowd Sentiment bites (Stadium)
- **The drain grows with the crew:** `crowdDecay(n) = 0.0025 + 0.00067 × (n − 1)` per second (1P 0.0025, 4P 0.0045;
  it was a flat 0.0012). From a full crowd, the live mood crosses the 0.5 line in **201 s solo and 111 s at 4P**. The
  graded 2-minute mean (the Board, the bell) crosses 40–50 s after that. One Rat lapping the Track (+0.1 per ~11 s
  lap) still beats the 4P drain alone, so holding the gauge is one Rat's job.
- **The consequence, the boo:** below the line (graded), after the shift's first minute (`BOO.GRACE`: the crowd
  opens at 0.5), every 20 s the crowd boos. The seated customer with the most bucket left sulks and walks out
  (`booOut`, the same shape as a refusal), and their bay stays empty for 30 s. The first boo of a shift says "The crowd
  is booing. Customers are leaving." as a TOAST, and later boos go to the feed. There's no RNG draw.
- The flat `CROWD.DECAY` and `stepSentiment`'s default are kept for old readers. `stepSentiment` takes an optional rate.

### 2. Zoning bites (County)
- **Hazard balls (the County's hands-on job).** A customer range ball that comes to rest inside the hose's reach
  turns hazard with `hazChance(n)`: 0.14 × [0.4, 0.65, 0.85, 1] by crew size. The reach is 62 m of the washer,
  short of the kerb (`HAZ.ZONE_R` ≤ `WASH.HOSE` + `WASH.RANGE`, pinned by a test). The ball is bright green. Drones,
  teenagers, carts, the autopilot and the jackpot all refuse it (`b.hands`).
- **Zoning = 1 − strays / 30 − hazards / 12**, clamped (`zoningWith`). With no hazards it's the old `zoning()`. An
  unbagged hazard is written off after 120 s of open range (it turns back into a range ball), but never in the
  cleanup, so you bag what's left before the bell. Unattended, a 4P crew's hazards arrive at ~5 a minute, so Zoning
  crosses the line in ~70–90 s, then hovers round it. A solo crew's hazards come ~2.5× slower.
- **The consequence, the van:** below the line, every 30 s Zoning's van drives down the kerb (a white van with a
  green band and an orange light bar, `views/county.js`) and tows `4 + 2n` resting balls, kerb side first, unpaid.
  The van never takes hazards: they're yours to bag. The first tow of a shift is a TOAST, and later tows go to the
  feed. The strays goal doesn't count the van's tows.

### 3. Hands-on jobs
- **Stadium, souvenir balls:** 6% of a Stadium customer's range balls are pink souvenirs, with the gold-ball beacon
  as their ring. Machines leave them. A Rat picks one up, and it rides in their hands (up to 3, outside the pocket).
  Walk it to the crowd rail (the side nets in front of either stand, |x| ≥ 60, z −122…−18) and it's delivered
  automatically: +0.07 crowd and 12 ball-weights of pay each. **The relay:** walk past a mate whose hands are empty
  and the bundle passes to them on its own. A relayed bundle pays ×2 and cheers ×2, and it doesn't pass again. A
  knockdown drops your souvenirs as souvenirs. Delivery and the hand-off need no new button, so they work on the pad.
- **County, hazard balls:** to spray one, aim the wand at it. The existing spray target picker gets one line, an
  `'h:<id>'` target that `crew.wash` hands to `county.mjs`. 1 s of spray makes it wet for 8 s (it shows cyan). A
  Rat who picks up a wet hazard bags it on the spot, which pays 40 ball-weights ("Corporate bills the county"). A dry
  hazard is refused. A solo Rat sprays, then bags, which is slower. A pair bags while the sprayer moves on, and the
  feed calls it a "team job".
- **First-time tips** (settings.js `HINTS`, the tips.js context, one each, 8 words or fewer):
  - "Pink souvenir balls: carry them to the crowd rail."
  - "Green hazard ball: spray it, then bag it."

  The souvenir tip's arrow points at the nearest rail. HUD prompts:
  - Carrying souvenirs: "Souvenir ×N: to the crowd rail (side nets), pass to a mate ×2".
  - Next to a hazard: "Ⓐ Bag the hazard (it's wet)" or "Hazard ball: spray it, then bag it".

### Seam additions
- New module hook **`take(crew, st, p, b) -> true`** (index.mjs `HOOKS`). `crew.pickup` hands any `b.hands` ball to
  the venue module. Stadium takes souvenirs, and the County takes wet hazards.
- New stats on the report: `booed`, `souvenirs`, `souvCash`, `bagged`, `hazCash`, `towed`.
- New snapshot fields:
  - `mods.stadium`: `hands` {id: n, negative = relayed}, `sv`, `boos`.
  - `mods.county`: `hz`, `haz`, `wet` [ids], `van` (seconds into its drive), `vans`, `towed`.
- New events:
  - `crowd` with kind `boo`, `souv` or `relay`.
  - `hazard`, `hazwet`, `hazbag`, `hazgone`, `van`.

## The numbers (headless ladder bot, 4P and 1P, seeds 7 / 11 / 23)

The bot is the expert's `late.mjs`, extended as `scratchpad/late11/late11.mjs`. It adds a souvenir runner (with a
relay partner at 4P) and a sprayer + bagger, with switches JOB (do the jobs) and TEND (react to the gauge). It walks
its job Rats at `perks.walk`, and all pickups, sprays and deliveries go through the real `crew` calls. It starts at
Stadium day 1 and stops at the Orbital.

| | 4P attended (JOB, TEND) | 4P ignores the gauge | 1P attended | 1P without the job |
| --- | --- | --- | --- | --- |
| Stadium reviews | 10/10 APPROVED, 0 boos | **10 of 18 DENIED**, 6–15 boos a shift (no laps, no souvenirs; autopilot + pings only) | 8/8 APPROVED | not measured (solo ignore runs hit another builder's half-done edit); 8/8 APPROVED with no souvenir job |
| County reviews | 9/9 APPROVED, gauge 1.0 | **8 of 14 DENIED** (gauge 0–0.58, 5–12 hazards out, 0–17 towed) | 6/6 APPROVED | 6/6 APPROVED (gauge 0.75–0.92) |
| Stadium share of income from the job | 6–10% at W 10 (8–12% at the shipped W 12) | – | 0–14% (avg ~7%) | – |
| County share of income from the job | 5.5–14% | – | 5–10% | – |
| County income, attended vs ignoring | $19–22M vs $12–14M a shift (job pay + the 15% review bonus + Upkeep's KPI term) | | $8.8–10.5M vs $6.1–8.4M | |
| Stadium d1 → Orbital | 46 / 46 / 54 min (expert's baseline 46) | Stadium never cleared (the bot's laps goal stalls with no lapper, a bot artifact) | 54 min | 54 min |

Before this round, every one of ~80 late shifts was APPROVED, and foot picking was worth 0% (expert §1.3).
Attended crews now pass every time, at the same pace to the Orbital. A 4P crew that ignores the gauge is DENIED about
half the time at both venues. Solo is gentle: an ignoring solo crew still passes. The hands-on job is now roughly
10% of a shift's direct income. At the County, doing the job versus ignoring it is a much bigger gap, because
ignoring also costs the review bonus and Upkeep.

Measured, not shipped: the County's first tuning (hazard W 4, no write-off, the van towing hazards) never denied
anyone, because the van "fixed" the gauge. That's why the van now leaves hazards and hazards are written off only on
open range.

## Files touched
- `web/js/stadium.js`: `CROWD_LINE`, `crowdDecay`, `BOO`, `SOUV`, `atRail`, `railPoint`, `souvCrowd`, `booOut`.
  `stepSentiment` takes an optional rate.
- `web/js/county.js`: `HAZ`, `hazChance`, `inHazZone`, `isHazard`, `hazardCount`, `zoningWith`, `VAN`, `vanTow`,
  `vanPick`. `droneTarget` skips `b.hands`.
- `server/venues/stadium.mjs`: scaled drain, boos, souvenirs (launchMod, take, delivery, relay, knockdown drop),
  snapshot.
- `server/venues/county.mjs`: hazards (onRest, the spray, take, write-off), zoning with hazards, the van, snapshot.
  `input` now routes `dispatch()` and `hazspray`.
- `server/venues/index.mjs`: the `take` hook.
- `server/crew.mjs` (5 small lines):
  - `pickup` hands `b.hands` balls to `mods.first('take')`.
  - Helpers, `cartPickup` and the jackpot skip `b.hands`.
  - `wash()` routes the `'h:'` target.
  - The strays goal ignores `by: 'van'`.
- `web/js/autopilot.js`: harvest and scoop skip `b.hands`.
- `server/venues/tiered.mjs`: one line, so a souvenir never cups.
- `web/js/main.js` (3 lines):
  - `KIND_COLOR` gets souvenir, hazard and hazwet.
  - The beacon now also marks souvenirs.
  - The spray target picker considers County hazards.
- `web/js/views/stadium.js`: boo toast and feed, souvenir and relay feed, the carry prompt.
- `web/js/views/county.js`: hazard repaint (hazard, hazwet, range), the van mesh and drive, feeds, the hazard prompt.
- `web/js/settings.js`, `web/js/tips.js`: the `souvenir` and `hazard` first-time tips.
- `web/js/crowd.js`: not touched. Walk-outs come from the mat state, which crowd.js already draws as sulk, then leave.
- Tests:
  - New `test/late.test.mjs` (12 tests).
  - `test/stadium.test.mjs`: the decay test now reads `crowdDecay(1)`. The seeded-shift test is now "one Rat lapping
    all shift passes": a late burst of laps can't lift an empty 4P crowd any more, by design.
  - `test/county.test.mjs`: the 4P teenagers test counts strays + towed, because the van tows the strays of an
    untended County.

## Goldens
The seam goldens did **not** move because of me. Every change is gated to venue 3/4 or to `b.hands` balls, which
don't exist at venues 0–1, and there are no new RNG draws below venue 3. The golden failures in the tree at the time
of writing (seam 862–864, the Muni card print, the Tiered T-65/T-60 tests, and the Two-Minute Warning) come from
the other builders' in-flight timing changes: Last Call at T-150, a 2-minute cleanup, and customer taper.

## Open issues
- **No boo sound.** `views/stadium.js` calls `ctx.SFX?.boo?.()`, which does nothing until builder "feel" adds one
  to sfx.js.
- **The client's pickup prediction knows nothing about hands balls.** A Rat with a full pocket may not be offered a
  souvenir pickup, and a dry hazard flickers (hidden, then restored by the server's `denied`). The server is right in
  both cases.
- **The crowd rail is the side net line,** with no paint. A rail stripe on the nets in front of the stands would read
  better (the tip's arrow points there).
- **Wet hazards repaint from the snapshot's `wet` list,** capped at 16 ids.
- **The Two-Minute Warning (T-120) now comes after pacing's Last Call (T-150).** The two need reconciling: either
  pacing's rally takes it over, or the Stadium's warning moves.
- **Not checked in the browser.** That's for the lead: the van's look and path, souvenir and hazard colours, prompts.
- **The bot's ignore-the-gauge Stadium crew never clears the Stadium card** (no lapper, so the driven-laps goal
  stalls). That's a bot artifact, not a game rule; a real crew laps for the goal.
