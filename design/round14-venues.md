# Round 14, builder 2 ("venues"): the Stadium and the County ask something every minute

Council round 12, items 2 (the Stadium) and 7a–7d (the County), plus fix 9.16. Builder 4 owns 7e (the memo and HUD
lines) and the Board drawing; my side sends the snapshot fields and events they read.

## What I built

### The Stadium (item 2)
- **2a. The autopilot has a ceiling.**
  - The autopilot cart's laps, and pings on an autopilot cart, lift the live crowd only to **0.60** (`AUTO_CEIL`).
  - Each missed request lowers that ceiling by **0.04** for the rest of the shift (`CEIL_MISS`, `autoCeil(missed)`).
  - `bumpAuto` never pulls a crowd that's already above the ceiling back down. Rats' laps, pings and souvenirs still
    lift it to 1.0.
  - The first drop of a shift sends a feed line, "The crowd's bored of the robot." (a `crowd/robot` event). There's
    no centre text.
  - The snapshot carries `ceil` while the autopilot row is owned.
- **2b. The card.** The Stadium card is now `[requests, pings, cart2, reviews 2, fee]`.
  - `requests` counts any souvenir delivered into a lit section, Stretch sections included.
  - It needs 6 at 4P, scaled by `SCALE` (1P 3, 2P 4, 3P 5).
  - The module ticks it with `crew.goalTick('requests')`, so there's no `crew.mjs` edit.
  - `laps` stays in `GOALS` for old saves; `cleanCard` drops it from a Stadium card.
- **2c. The Seventh-Inning Stretch.** It comes once a shift at **T−3:30**.
  - **Sections (lead's call, round 14):** 3 light at once for 25 s (2 at 1–2P), **adjacent and on the same side**
    (ABC or DEF; a pair is AB/BC or DE/EF). They come from `hash32(day, venueDay, 's')`.
  - **One section per souvenir (lead's call):** at the rail during the Stretch, a lit section takes **one** souvenir
    from your bundle and the rest stay in your hands. One runner with 3 walks the rail and lights all three. Outside a
    lit section nothing is delivered while the Stretch is on.
  - **Pay:** each section pays **×5** (125 ball-weights) and +0.15 crowd.
  - **Miss:** each missed section is −0.03 crowd, with no boo.
  - **Request pause:** normal requests don't start from T−4:00 until 5 s after the Stretch ends, so nothing lit
    overlaps it.
  - **Delays:** a live MOW-E 2.0 boss or a lit request holds the Stretch back, but never later than T−2:00.
  - **Snapshot:** `mods.stadium.stretch = { i: [..], secs: 'ACF', t }`. Builder 4's `kpiNoteOf` already reads it:
    `SEVENTH-INNING STRETCH · A C F · 0:25`.
  - **Look:** a beam over every lit section; the whole stand stands up (the bob goes to max); the jumbotron shows
    `SEVENTH-INNING STRETCH / A C F / 0:25`.
  - **Sound:** `SFX.organ()` if builder 1 has landed it, else `jackpot` + `bell(784)`.
  - **Centre text:** one ALERT, "Seventh-inning stretch! Three sections want balls!" (7 words; "Two" at 1–2P).
- **2d. The name on the jumbotron.** A lit or Stretch delivery shows `PIP · LEGEND · SECTION C` on the jumbotron for
  3 s, with a sub-line (`SOUVENIR DELIVERED · ×3` / `SEVENTH-INNING STRETCH · ×5`). It also calls builder 4's
  `ctx.board.shout(...)` for the Board's gold band. The `souv` event carries `name`, `req` and `stretch`.
- **2e. Requests you can't miss, in an order you can't learn.**
  - **Order:** `REQ.ORDER` is rotated per shift by `hash32(day, venueDay, 'r')`. A test checks that the crew's RNG is
    never asked.
  - **The beam:** `views/souvreq.js` now draws a gold beam, 20 m tall and pulsing, over each lit section. It's one
    `InstancedMesh` of up to 3, so +1 draw call.
  - **Up to 3 lit at once:** the rings became one `InstancedMesh`, the fans' arms cover every lit section (96 arms),
    and the banner shows for single requests only. Still no per-frame allocations.
  - **Chant:** the first request of a shift plays `SFX.chant()` if it exists, else `bell(659)`.
- **2f. The crowd stops at the Stadium.**
  - The drain runs only at venue 3 outside endless.
  - The jumbotron's "THE CROWD IS BORED" text and toast show only at venue 3.
- **Tuning I changed:** `REQ.EVERY` went from [90, 75, 60, 45] to **[65, 55, 45, 38]** (1P→4P). The Stretch's pause
  ate one request a shift, which left 1P at 0.86 calls a minute. With the new spacing it's ≥ 1.0.

### The County (item 7)
- **7a. Inspection Hour.** It comes once a shift at **T−3:30**, for 60 s (75 s solo).
  - **A design catch:** hazards only spawn short of the kerb (`inHazZone`: x < 61.5), and the Yards are past it
    (x > 64.5). So "the Yard with the most hazards" never exists.
  - **What he walks instead:** a 15 m patch round the busiest hazard (the hazard with the most others within 15 m).
    With no hazards out, he walks the middle of the hose's ground. He's drawn as a white ring on the grass and an FHI
    inspector (people.js: grey suit, sunglasses, clipboard) walking a slow loop round it.
  - **Inside the patch while he's there:** a bagged hazard pays **×3** and gives **+0.04 Zoning**. The bonus is kept
    for the shift.
  - **Noted hazards:** any hazard still in the patch when he leaves is "noted". From then until the cleanup (T−1:00)
    it costs **−0.05 Zoning** and counts **double** while it lies out, and it is never written off. Bag it after he's
    gone and both come back. That's the within-shift sting: Zoning drops, and the van tows.
  - **At the bell (lead's call, round 14):** from the cleanup on, the noted hazards are "on his clipboard" and don't
    count at all, so a crew that ignores hazards is never walled. Counting them once at the bell was tried first and
    still left a 4P ignorer at 6 / 7 / 12 shifts.
  - **The Board:** `mods.county.inspect = { x, z, r, t, n, where: '4 HAZARDS' }` reads
    `INSPECTION · 4 HAZARDS · 0:45`. The live count shrinks as you bag. This needed a one-line edit in
    builder 4's `bvtext.js` (see "Outside my files").
  - **Centre text:** one ALERT, "Inspection! Bag the hazards by the inspector!" (7 words). The council's "Clean Yard 2"
    would have sent Rats over the kerb to an empty Yard.
  - **Feed:** "The inspector noted 2 hazards. They count double." or "...left impressed".
  - **Memo:** a clean inspection with at least one bag sets `crew.memoNote`, builder 4's memo slot. The next morning's
    flavour reads "The inspector was impressed. He's from Site 13."
- **7b. Spray chains.**
  - A spray that wets a hazard wets every dry hazard within 3 m (`CHAIN.R`). Each one sends a `hazwet` event with
    `chain`.
  - One Rat bagging 3 wet hazards within 6 s is a **CLEAN SWEEP**: the third pays ×2, with a feed line and a chime.
    It's counted in `stats.sweeps` and `hazbag.sweep`.
- **7c. The tip names the button.** The tip reads "Green hazard: hold RT to spray, then bag." on a pad (RT is
  padbind.js's spray binding), and "...hold Click to spray..." on a keyboard. Both are 8 words, and it still re-arms
  after a hazard DENIED.
- **7d. The card names the missing goal.**
  - With exactly one goal open, `tomorrowLine` names it: "Tomorrow: one more good day for the Orbital.",
    "Tomorrow: 40 more strays for the Orbital.", "Tomorrow: $6,600,000 more to sign for the County.", "Tomorrow: buy
    the drones for the Orbital."
  - If that's over 8 words, it drops "for X" ("Tomorrow: pass Gary with a huddle."). Two or more open goals keep the
    count line.
- **9.16, the Orbital card.**
  - The "undefined" in the testers' bot log was the bot printing `goalWire()` after Ball No. 1 had fallen (endless
    has no card), not a game bug.
  - With every step done, the strip now reads `NEXT: FIND BALL NO. 1` (it was "BALL NO. 1 IS COMING"). The tomorrow
    line reads "Tomorrow: find Ball No. 1." (it was null).

## Measurements (headless bots, through the real Crew)

**The bot.** It's playtest B's `late11s.mjs` with an event tally, copied to `scratchpad/c12b2/late11.mjs`. My
additions:
- a calls-a-minute tally (a call is a lit request, a Stretch section, the inspector, a new hazard cluster with no
  hazard within 6 m, or a Stadium boss phase);
- Stretch-aware delivery;
- `SWAIT` (hold a bundle for the Stretch);
- `SQUAD` (from T−5:00, souvenirs are passed out one per Rat; at the Stretch each holder runs to a different section);
- `INSPECT=1` (the hazard pair works the inspector's patch first);
- `INSPONLY=1` (ignores hazards except during the inspection);
- `MAXS` (a shift cap).

Presets `stadium1` and `county1` (unwrapped), seeds 7 / 11 / 23, 1P / 2P / 4P, 117 runs in all.

### The Stadium

**Against the council's table:**

| Mode | Target | Round 7 | Now |
| --- | --- | --- | --- |
| `IDLE` (autopilot only), 1P and 2P | crowd under the line at the bell in ≥ 1 of 2 shifts | never (≥ 0.64) | **36 of 36 shifts** under the line. Bell crowd: 1P 0.33–0.39, 2P 0.26–0.31, 4P 0.00–0.21. |
| 1P that does anything | APPROVED ≥ 90 % | — | **100 %** for `JOB1` (9/9), `WAIT` (8/8) and `JOB0`-with-laps (18/18). The 1P bot answers only 27–40 % of requests, so "≥ half" is a stricter bar than it needs. |
| `JOB1` / `WAIT`, 4P | Stadium length 2–3 shifts (no laps gate) | 2–4 | **2 shifts in 9 of 9** runs |
| 4P, answers ≥ 2 of 3 Stretch sections in ≥ 2 of 3 shifts | (target) | — | **Met after the lead's round-14 rule** (same side, adjacent, one section per souvenir): `JOB1` 8/18 sections, ≥ 2 in **4 of 6** shifts; `SQUAD` 12/18, ≥ 2 in **4 of 6** (3/3 in four shifts). `WAIT` 5/18, ≥ 2 in only 2 of 6 (it spends its bundle on the normal request before the Stretch). Before the rule: `WAIT` 0 of 6, `SQUAD` 2 of 6. |
| Calls a minute | ≥ 1 at 1P, ≥ 1.5 at 4P | ~0.7 / 1.3 | **1P 1.14 (min 1.00); 2P 1.18; 4P 1.62 (min 1.57)** |
| Souvenir share of 4P income | 18–28 % | 17–19 % | `JOB1` 18.1 %, `WAIT` 17.8 %, `SQUAD` 18.9 % (single shifts 9–22 %) |

**The Stretch, before and after the lead's call:**
- **Before:** the sections were spread across both rails (128 m apart), and a delivery handed over the whole bundle.
  Answering 2–3 sections needed 2–3 Rats each holding a souvenir, and the target wasn't met (`WAIT` 0 of 6 shifts).
- **After:** the sections sit adjacent on one side, and each takes one souvenir. One runner with a bundle of 3 walks
  ~32 m of rail and lights them all.
- **The decision it leaves:** hold a bundle for T−3:30 (×5 a ball, three at once) or spend it now at ×3. The bot that
  delivers whenever it can (`JOB1`) still meets the bar. The shifts it misses are the ones where it held nothing at
  T−3:30.
- 2P: `WAIT` 59/72 sections, ≥ 2 in 28 of 36 shifts.

**Shifts per venue (Stadium):**
- **1P:** `JOB1` 3/3/3, `WAIT` 2/3/3.
- **2P:** 12 (the cap). This is the known bot artefact: the pinger is the souvenir Rat, so pings sit at 0/8 for six
  shifts. requests and reviews were done by day 2.
- **4P:** 2/2/2.
- **New gate:** a crew that never delivers a souvenir (`JOB0` and `IDLE`) can't finish the card. That's the council's
  intent: the requests goal replaced the laps goal, which already gated `IDLE`.

**What ignoring costs:**
- **Ignore the crowd, let the autopilot play** (`IDLE`): every bell is under the line, so every shift is DENIED, at
  every size.
- **Ignore souvenirs but lap** (`JOB0`): the gauge passes (0.69–1.00), but the card can't be finished, and the crew
  forgoes the 18 % souvenir share.

### The County

| Mode | Target | Now |
| --- | --- | --- |
| `JOB1` | clears in 2 shifts | **2 shifts, 9 of 9** runs (1P/2P/4P) |
| `JOB0` (ignores hazards) | 4P ≤ 6 shifts, never walled (lead) | **Met:** 4P **2 / 3 / 4 shifts** (0 / 1 / 2 DENIED); 2P 2/2/2; 1P 2/2/2. Round 7 was 6–12; the first build of this round walled it at 14+ (gauge 0.00). Counting noted hazards once at the bell gave 4P 6 / 7 / 12. |
| `INSPECT=1` vs `JOB1` | income +10–20 % | **±1 %**: 1P 13.18M vs 13.17M, 2P 17.60M vs 17.82M, 4P 25.61M vs 25.74M |
| `INSPONLY` (ignores hazards except the inspection) | (new) | **clears in 2 shifts at 1P, 2P and 4P**, 18/18 APPROVED. 4P income 23.6M vs `JOB0` 14.8M (+60 %). |
| `LEARN` (job on after the first hazard DENIED) | (round 7: one more DENIED than `JOB1`) | 1P/2P 2 shifts (no DENIED to learn from); 4P 3 / 3 / 2 |
| Calls a minute | ≥ 1 at 1P, ≥ 1.5 at 4P | **1P 1.22–1.45 (some single shifts 0.71–0.86); 2P 1.8–2.0; 4P 2.2–3.6** |

**How to read it:**
- **The inspector is the ignore tail's fix, if a crew answers him.** A crew that bags only while he's on site (about
  6 bags at 4P, ×3 each) clears in 2 shifts, like a diligent crew.
- **What ignoring costs now:** money and a DENIED or two, never the venue.
  - Income a shift, `JOB0` vs `JOB1`: 4P 14.4M vs 25.7M (−44 %), 2P 11.9M vs 17.8M (−33 %), 1P 10.0M vs 13.2M
    (−24 %).
  - Within the shift the noted hazards' −0.05 and double count drop Zoning under the line, so the van tows (≥ 10 % lost
    by a wide margin).
- **The inspector's income:** ±1 % for a crew that already bags (lead: leave it).
- **Why attending earns nothing extra:** a crew that already does the job leaves 0.3–1.0 hazards in his patch when
  he arrives, so the ×3 has almost nothing to multiply. The +10–20 % target assumed hazards pile up. They don't for
  `JOB1`, but they do for everyone else (`INSPONLY` +60 % over `JOB0`).

**Spray chains:**
- 4P `JOB1` sweeps 1.5 a shift; `INSPONLY` 2.2; 1P 0.3–0.5.
- The bot sprays one target at a time, so chains come only from natural clusters. A human who waits for clusters
  will sweep more.

### Browser (pane fronted, `rr-play-b`)
- `design/shots/c12-venues-stretch-alert.jpg`: a Stadium shift at T−3:29 (Day 14, solo, a `stadium1` save at
  venueDay 3 loaded through `/api/dev/crew`). The one ALERT is "Seventh-inning stretch! Two sections want balls!",
  with the feed line "Seventh-inning stretch: Sections C, D. Five times!" and the beams over the rails.
  - The deck's underside still covers the top of the spawn view (builder 4's item 4 had not landed in that server).
- `design/shots/c12-venues-inspector.jpg`: County day 16 at T−2:31. The inspector's ring on the hose's ground and the
  inspector walking it. `mods.county.inspect` read `{ x: 27.3, z: -56.2, r: 15, secs: 75, where: '1 HAZARD' }`.
- **A bug the browser caught, now fixed:** the first County view crashed on create. people.js's `parts.armR` is a
  `{ up, fo }` pair, not a node, so the clipboard couldn't attach to it. That crash took down the whole County view
  (no drones, no hazards repaint). The clipboard now rides on the torso. Nothing in `node --test` constructs THREE
  views, so only the browser shows this class of bug.
- **Not shot:** the Board countdown lines (builder 4 draws them; the snapshot fields are in place), and the HUD
  "crowd 82%" (7e, builder 4).
- **The ALERT can be lost:** on the County day the morning memo card was still waiting for Space (the pane had been
  hidden). The inspection ALERT then waited past its 15 s TTL and was dropped. On a fronted pane the memo closes
  itself, so this is a test artefact, but it shows a story card can swallow the peak's one centre line.

## Files touched
- **Mine:**
  - `web/js/stadium.js` (`AUTO_CEIL`, `CEIL_MISS`, `autoCeil`, `bumpAuto`, `ROBOT_LINE`, `STRETCH` and friends,
    `legendLine`, `reqRot`, and `REQ.EVERY` retuned; it imports `hash32` from today.js, which imports nothing);
  - `server/venues/stadium.mjs`, `web/js/views/stadium.js`, `web/js/views/souvreq.js` (rewritten: instanced rings and
    beams, up to 3 lit);
  - `web/js/county.js` (`INSPECT`, `inspectPatch`, `zoningInspected`, `inspectAlert`, `INSPECT_MEMO`, `CHAIN`,
    `sweepStep`), `server/venues/county.mjs`, `web/js/views/county.js`;
  - `web/js/goals.js` (`requests`, the Stadium card, `tomorrowLine`, 9.16), `web/js/settings.js` (the hazard tip).
- **Outside my files (one line):** `web/js/bvtext.js` `kpiNoteOf` now reads `INSPECTION · ${ins.where ?? 'YARD ' +
  ins.yard}` (builder 4's file). The patch has a hazard count, not a Yard number. The old `yard` field still works.
- **Untouched:** neither hot file (`crew.mjs`, `main.js`).

## Tests
- **Added:**
  - `test/late.test.mjs`: 4 tests (the ceiling and the robot line; the Stretch's rules plus a live crew delivery at
    ×5 that ticks the goal and is once a shift; the requests goal scale and the rotation with no RNG draw; no drain past
    the Stadium).
  - `test/late11.test.mjs`: 5 tests (the inspector's rules; a live County inspection with ×3, +0.04, noted, double and
    once a shift; chains and CLEAN SWEEP; the tip and the tomorrow line; 9.16).
  - `test/words.test.mjs`: one appended block for my centre lines.
- **Updated, because the card changed:**
  - `goalcard.test.mjs` (the laps row is gone);
  - `pacing11.test.mjs` (requests on the card; Promotion Day's helper ticks `requests`);
  - `stadium.test.mjs` (the lapper's s and k can both end at 1 now; the shape and k are still pinned);
  - `late11.test.mjs` (`reqEvery` [38, 45, 55, 65]);
  - `playtest3a.test.mjs` (the fee is named: "Tomorrow: $2,500 more to sign for the Club.").
  - After the lead's calls: a new `late.test.mjs` test (one runner with 3 walks the rail and answers all three
    Stretch sections, one souvenir each; nothing is delivered outside a lit section while it's on), the Stretch test
    now pins "one side, adjacent", and the live inspection test checks that the noted hazards don't count at the bell.
- **Full run (after the lead's calls):** **1172 pass, 0 fail.**
- **Seam goldens:** not moved. `seam.test.mjs` passes; nothing of mine runs before the Stadium.

## Lead's calls (round 14), applied
- **Stretch:** same side, adjacent, one section per souvenir. Met: ≥ 2 of 3 in 4 of 6 shifts at 4P.
- **County wall:** the noted hazards don't count from the cleanup to the bell. Met: 4P ignorers clear in 2–4 shifts.
- **Inspector income:** left alone (±1 %).

## Open issues
1. **The organ riff and the chant are fallbacks** until builder 1 adds `SFX.organ` / `SFX.chant`; the views call them
   if they exist.
2. **`textload.mjs` (builder 4's) was not re-run by me.** Each venue adds exactly one centre item: the Stretch ALERT
   and the inspection ALERT. Both are 7 words.
3. **The 2P Stadium bot stall** (the pinger is the souvenir Rat) still hides 2P Stadium length. It's a bot artefact,
   as in round 7.
