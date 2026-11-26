# Playtest round 7, tester B: the Stadium and the County

Build `e44e93e`. Preview `rr-play-b` (:8095).

**How I played**
- **Bots.** I used round 13's jobs bot (`late11.mjs`, round-13 builder 3's copy, with `START_FILE`) through the real `Crew`. I ran it from the `stadium1` and `county1` presets at 1P, 2P and 4P, seeds 7, 11 and 23: 72 runs.
  - Stadium modes:
    - `JOB1`: does souvenirs, carries to the lit section if one is up;
    - `WAIT`: holds the bundle for a lit section;
    - `NOREQ`: nearest rail, ignores requests;
    - `JOB0`: no souvenirs, but laps when the crowd sags;
    - `IDLE`: no souvenirs, no reactive laps; the autopilot only.
  - County modes:
    - `JOB1`: sprays and bags;
    - `LEARN`: ignores hazards until the first bell names them;
    - `JOB0`: ignores hazards.
  - A copy with an event tally (`late11s.mjs`) logged story beats, MOW-E, rallies, vans, requests and hazards, through the Orbital to endless day 1, at seed 11.
  - `scripts/bots/textload.mjs` ran at 1P and 4P.
- **Client.** I ran Skip ahead → Stadium day 1, and Skip ahead → County day 1, both solo, with a 150 ms poll logging the story card, PA, memo, toast and feed.
  - The pane's screenshot capture flipped between full frame and a 2× top-left crop. Some shots are low-res for that reason.
  - Keyboard-only steering in the pane was too blind to reach the Yards. **I did not spray or bag a hazard by hand.** My spray-then-bag notes are from rules and bot numbers.
- **Shots** (in `design/shots/`):
  - `pt7-b-stadium-memo.jpg`: the spawn view, the black slab, and the memo naming only "clean";
  - `pt7-b-stadium-request-under-canopy.jpg`: "WE WANT A BALL! SECTION C" seen from under the deck;
  - `pt7-b-county-spawn-slab.jpg`: the same slab and pole at the County.

## 1. Findings

| # | Finding | Repro / evidence | Severity |
|---|---|---|---|
| 1 | **The crowd gauge only bites at 4P.** The autopilot cart holds the crowd alone at 1P and 2P. 4P is where it does fail. | **IDLE** (no laps, no souvenirs, autopilot only): **1P and 2P never fail on the crowd.** Crowd at the bell was 0.61–0.99 across 160 shifts, and the gauge never went under 0.64.<br>**At 4P it drains:** DENIED from day 3–4, with the crowd at 0.00–0.48 at the bell.<br>**Every non-idle mode at every size passed the gauge**, with 0.71–1.00 at the bell. | High (design) |
| 2 | **4P has a cash glut at the Stadium.** Money decisions stop mattering there. | 4P `JOB1` seed 7: the fee of $6.6M is met on day 1, and the crew leaves with $45M cash. The card's gate is the human **laps** goal (12), not money. | Med–High (design) |
| 3 | **Souvenirs pay hugely, but the gain doesn't change progression at 4P.** It does at 1P. | **Income per shift:**<br>1P: $0.8M ignoring → $1.3M attending → $2.1M holding for the lit section;<br>2P: $2.8M → $4.0M;<br>4P: $3.6M → $8.7–8.9M.<br>**The souvenir cash share is only 14–22 %.** Most of the gap isn't explained by souvenir cash. Some may come from how the bot uses its Rats, so it needs a builder's look.<br>**Stadium shifts:**<br>1P: **3 → 2**. Souvenirs save a shift, because 1P is fee-gated.<br>4P: 2–3 → **4**. In the bot the souvenir runner is also the lapper, so human laps fell to 3 a day and the laps goal gated.<br>**Request hit rates:** 1P 6/24 hits → 15/24 holding; 4P 59/96 → 80/96 holding. | Med (design) |
| 4 | **The County is fair and decisive now. "Does the bell say the true cause?" Yes, 31 of 31.** | **Bags hazards:** **2 shifts** at 1P, 2P and 4P, 0 DENIED, Zoning 1.00 at the bell. Income ≈ +60 % at 4P ($22–26M against $13–16M).<br>**Learns after the first bell:** 2–3 shifts, exactly 1 DENIED.<br>**Ignores hazards:**<br>1P: 2–3 shifts, still passes, Zoning 0.50–0.58;<br>2P: 3–4 shifts;<br>4P: **6, 7 and 12 shifts**, with 4–10 DENIED.<br>**The cause:** every one of the 31 County DENIEDs read "Missed: N hazards left out. Spray, then bag." In every run, strays at the bell were **0**: the drones eat them. | Info (good) |
| 5 | **"Is a crew ever stuck?"** Not physically. But an ignoring 4P crew sees the same morning for up to 10 days. | 4P seed 23 `JOB0`: the card reads "4 of 5 done · 1 to go \| Tomorrow: one goal left for the Orbital." from County day 3 to day 11. It never names the goal (**reviews 2**, which the Zoning gauge gates). Promotion Day eventually lets it through.<br>Gary visited 7 times in that run. | Med |
| 6 | **The Stadium mid beat is skipped whenever the Stadium takes ≤ 2 shifts.** | Day 2 is MOW-E 2.0's encore (`bossDay`), and `midDue` holds on a boss morning. So `mid:3` ("Off the record? That was a good lap.") plays only on day 3.<br>It was seen in **2 of 6** event-tally runs. Stadium length across 72 runs: 1P 2–3, 2P 2, 4P 2–4 (2P `JOB1` excluded: bot pinger stall, see Notes). | Med (story) |
| 7 | **Neither venue's second fail condition is in the memo or the HUD.** | **Stadium morning:** memo "Today: 35% clean by the bell. NEW: the Ping Track. Keep the crowd happy." The HUD reads "$1,295 a ball · 69% clean · need 35%". There is no crowd number anywhere except the jumbotron Board and toasts ("THE CROWD IS BORED", "The crowd is bored. Lap the Track!").<br>**County:** the same, with Zoning only on the Board.<br>A crew can hit "35% clean" and still be DENIED by a number its memo never mentioned. | Med (clarity) |
| 8 | **The known black slab is confirmed at both venues' spawn.** The deck canopy underside reads as a flat black slab across the left half of the view, plus a black pole dead centre. | Stadium day 1 and County day 1 spawn (`pt7-b-stadium-memo.jpg`, `pt7-b-county-spawn-slab.jpg`). Under the canopy, the top half of the view is black or magenta trim (`pt7-b-stadium-request-under-canopy.jpg`). | Med (look) |
| 9 | **The hazard tip doesn't say how to spray.** | "Green hazard ball: spray it, then bag it." No button, no "with the wand". On a fresh skip-ahead profile, 17 hints were marked seen in the first ~3 minutes, and the hazard tip was the last of them. The flood is skip-ahead only; the missing button affects everyone. | Low–Med |
| 10 | **The "Day N · venue · you are a …" toast lands late.** | It appeared about 95 s into the shift at the Stadium and about 130 s at the County, after the story card, the memo and (at the County) the first hazard alert. Stale by then. | Low |
| 11 | **Souvenir requests always come in the same order:** C, E, A, F, B, D (`REQ.ORDER`). | Section C was first both times I opened a Stadium shift (0:30). After two shifts a crew can pre-park at C. | Low |
| 12 | **Requests are easy to miss solo.** | "Section C wants a ball!" goes to the feed only (by design: no centre text). The banner and hoop are readable from the mats, but from under the deck they're a sliver at the bottom of the screen. My idle solo shift missed both requests without ever noticing. | Low–Med |

Owner rules:
- **One centre text at a time:** held in every log.
- **~8 words:** held. The bell's "Missed: 9 hazards left out. Spray, then bag." is 8.
- **Full screen:** nothing dropped it.
- **Scales 1–4:** the hazard spawn and the request cadence scale well. The crowd doesn't (finding 1).

Notes:
- **2P `JOB1` / `WAIT` / `NOREQ` stayed 6–26 shifts at the Stadium.** This is the known bot artefact (the souvenir Rat is the pinger, so pings stall at 0/8). It isn't a game bug.
- **`IDLE` never leaves the Stadium,** because the laps goal needs human laps. That is by design, but note that the autopilot can't do the card.

## 2. The story (Stadium and County)

Text load (`textload.mjs`, seed 7; the same at 1P and 4P):

| Morning | Centre text | Items |
|---|---|---|
| Stadium #1 (promo) | 24.8 s: PA → 3 cards → memo at 19.8 s | 3 |
| Stadium #2 (MOW-E 2.0 day) | 7.6 s: memo only | 1 |
| County #1 (promo) | 24.0 s: PA → 3 cards → memo at 19.0 s | 3 |
| County #2 (mid) | 17.3 s: 3 cards → memo | 2 |

Both promos are within the ≤ 28 s target, and no morning has two memos. This is much better than round 6's 30–50 s mornings.

**What I saw in the browser:**
- **Stadium:** PA → "The jumbotron plays a 1958 newsreel. By mistake." → GARY "Nice jumbotron. Don't get a big head." → MEMO "Site 13 sells tickets to its jumbotron." → memo.
- **County:** GARY "I was a Range Rat. Here. 1987." → "FHI has acquired Site 13. Welcome, colleagues." → "Their numbers were, it turns out, estimates." → memo.

**Did the beats land?**
- **Stadium promo.** Gary's card fixes round 6's gap: the ally half of his arc now has a card here. "Don't get a big head" is warm and dry. "Site 13 sells tickets to its jumbotron" is a better Site 13 joke than last round's "two jumbotrons".
  - I didn't catch the jumbotron newsreel itself: my pane was in its cropped-capture state when the card ran. Someone should eyeball it.
- **Stadium mid ("Off the record? That was a good lap.").** It's a nice line, but it's missed in about half of runs (finding 6). It also echoes the Club boss's "Off the record? That was something." Two "off the record"s from Gary dilute both.
- **County promo.** The strongest morning in the late game. Gary's confession going first, with a 5 s minimum, gives it weight. "Their numbers were, it turns out, estimates." pays off three venues of Site 13 bragging in one line. That's the best comedy beat in my stretch.
- **County mid.** It always plays (County day 2 is always a plain morning).
  - *"County records, 1958: 'small, dimpled, still rising.'"* is lovely and quietly sets up the Orbital.
  - *"Club Champion, '87. Then came the clipboard."* is the most touching Gary line in the game: six words that explain him.
  - *"Dimples has been rezoned. Dimples is a park."* ties the comedy to the venue's mechanic.
- **Never seen:** the Stadium mid beat at 4P seeds 11 and 23 (2-shift Stadiums), plus the Stadium Gary visit lines ("The crowd's watching. So am I." / "Good crew. Better than mine was."). The bubble and feed weren't on screen during my short browser shifts.

## 3. Best minute / dead minute

- **Best:** the County at 4P with a crew that bags. Hazards appear about 4 a minute (27–32 a shift). One Rat sprays and one bags behind, every ~15 s, while the drones clear the Yards. The gauge sits at 1.00, income runs 60 % over a crew that ignores them, and the bell says nothing bad because nothing went wrong. It's the only stretch in my venues where every minute has a "who goes where" call.
- **Dead:** the Stadium at 1P/2P once the autopilot is on.
  - The crowd never needs you, so the crowd gauge asks nothing.
  - Requests come every 90 s (solo) and are easy to miss. In my solo shift the feed said "Section C wanted a ball." and nothing else changed.
  - Between requests, the minute is "pick up balls".
  - At 4P the dead minute is different: the money doesn't matter ($45M against a $6.6M fee), so a souvenir run is for the score, not for progress.
- **Decision density by minute (bot cadence):**
  - **Stadium:** a request every 45 s (4P) to 90 s (1P), with 30 s to answer. Plus the human-laps chore at 4P, and MOW-E 2.0 once (ignorable: the bot never fought it and nothing bad happened).
  - **County, hazards attended:** a hazard every 15 s (4P) to 45 s (1P).
  - **County, hazards ignored:** a "Hazards out! Spray and bag!" alert every 45 s (6–11 a shift) and a van tow every 30 s. That's pressure, but the only answer is the same job.

**Pacing:**

| Venue | 1P | 2P | 4P | Note |
|---|---|---|---|---|
| Stadium | 2–3 shifts | 2 | 2–4 | — |
| County, bagging | 2 | 2 | 2 | — |
| County, ignoring | 2–3 | 3–4 | 6–12 | — |

Stadium plus County is about 4–6 shifts (30–45 minutes) for a crew that learns. That's well sized. The 4P ignore-tail is a cliff, not a curve.

## 4. Top 5 improvement ideas (ranked)

1. **Make the crowd the Stadium's co-op partner at every size.**
   - Cap the autopilot so it holds the crowd at ~0.6, not ~0.95. A crew then has to *do* something above the line at 1P and 2P too.
   - Swap half the human-laps goal for **"Answer 6 requests"**. That puts the Stadium's signature job on the card and removes the 4P laps gate.
   - Make an answered request loud and personal: that section does the wave, the jumbotron shouts the Rat's name ("RAT 2 · LEGEND · SECTION C") for 3 s, and the crowd's cheer swells.
   - Shuffle `REQ.ORDER` per shift (seeded).
   - Why it's fun: the crowd becomes something you play *to*, not a bar that the autopilot keeps full. (S–M: `stadium.mjs` constants, `goals.js`, the Board canvas, `souvreq.js` crowd arms.)
2. **The Zoning van becomes the County's antagonist, not a feed line.** Give it a real truck that drives the kerb road every 30 s while Zoning is under the line, visible from the mats with a light bar and a horn.
   - A Rat standing in its lane stops it for 5 s (the `CART_STOP` logic), which buys the bagger time.
   - It tows the nearest balls, as now. Sprayed-but-unbagged hazards it reaches cost a $ fine with a stamp ("FINED · WET HAZARD").
   - Why it's fun: the County gets a MOW-E-style rhythm without a boss. The 4P ignore-crew's 6–12 shifts become a *chase* they can see and lose, not a bell they read once a day. (M)
3. **Spray chains.** A spray wets every hazard within 3 m. Bagging three wet hazards within 6 s is a "CLEAN SWEEP" streak, ×2 on the last one.
   - Also fix the tip: "Green ball: hold Ⓧ with the wand, then bag it." (or the real binding).
   - Why it's fun: spray-then-bag becomes a two-Rat rhythm with a skill ceiling (herd the sprays, then sweep), not 20 separate errands. Solo, it rewards waiting for clusters. (S)
4. **One scripted peak per shift at both venues, at about T−3:30.**
   - **Stadium, the Seventh-Inning Stretch:** three sections light at once for 20 s, each paying ×5.
   - **County, Inspection Hour:** the inspector walks one Yard, and hazards in it count double at the bell for 60 s.
   - Why it's fun: these venues have no "moment" between the open and the bell once MOW-E 2.0 has run. A peak fills the dead middle and forces a 4P split: "you two take A and B, I've got F". (S–M)
5. **The clarity pack.**
   - The memo and HUD name the venue gauge: "Today: 35% clean. Crowd over half." and "$1,295 a ball · 69% clean · crowd 82%". County: "· Zoning 62%".
   - The card's "one goal left" names it: "Tomorrow: hit Zoning twice for the Orbital."
   - Let `mid:3` play on the encore morning, since the boss starts at 1:45 and the beat is over by 0:20. Or move it to the next plain morning even after promotion.
   - Fix the canopy slab and pole at spawn.
   - Why it's fun: nobody should lose a review to a number their memo didn't mention, or miss Gary's lap line because they were good at the Stadium. (XS–S)

## 5. Scores

| Metric | Score | Why |
|---|---|---|
| Fun | 6.5 | The County with hazards is good co-op work. The Stadium at 1P/2P coasts on the autopilot. |
| Clarity | 6.5 | The County bell is now 31/31 correct and the request banner reads. But neither venue's second gauge is in the memo or HUD, and "1 goal left" doesn't say which. |
| Text load | 7.5 | Promos are 24–25 s, ≤ 3 items, one memo a morning. The "you are a …" toast lands 1.5–2 min late. |
| Pacing | 6.5 | 4–6 shifts across the two venues for a learning crew. A 4P crew ignoring hazards falls off a 6–12-shift cliff, and the Stadium length at 4P is set by a human-laps chore. |
| Co-op | 7 | The sprayer and bagger pair, the souvenir relay, and the hazard deal sent to the two nearest Rats all work. Solo is fine. |
| Meaningful features | 6.5 | Hazards: yes, they gate the card and +60 % income. Souvenirs: big income, but only change progress at 1P. The crowd gauge: only at 4P idle. Vans: a punishment with no decision. MOW-E 2.0: ignorable. |
| Look & feel | 6.5 | The request hoop and banner read from the mats. The spawn view is half black slab at both venues. |
| Polish | 6.5 | The late toast, the fixed request order, a tip with no button, and the slab. |
| One more shift | 7 | The County promo and mid beats pull you to the Orbital ("small, dimpled, still rising"). |
| Decision density | 5.5 | The County, attended: high. The Stadium between requests, and any 4P money choice: none. |
| **Overall** | **6.5** | The County now works and tells the truth. The Stadium needs the crowd to matter at every size and a moment in its middle. |
