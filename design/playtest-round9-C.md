# Playtest round 9, tester C: Stadium → County → Orbital → the Last Bucket → endless day 4

Build `cee02b3` (council round 13 built). Played 2026-11-27.

**How I played.**
- **Bots, through the real `Crew`** (`scripts/bots/late11.mjs`, `STOPV=99 EVENTS=1`, with the shared `calls.mjs` tally).
  - **The ladder:** from `stadium1` to endless day 4, at 1P / 2P / 4P × seeds 7 / 11 / 23, with `BUY=1 POACH=1` (9 runs).
    The 4P control ran with `BUY=0 POACH=0` (3 runs).
  - **The crash:** from `stadiumPromo` at 4P × 3 seeds.
  - **Site 13:** from `endless`, 5 Owners' days, at 1P / 4P × seeds 7 / 11 / 23 × `POACH=0/1` (12 runs, 60 days). I logged
    each day with a read-only policy I added, `scripts/bots/policy/pt9c-rival.mjs` (`POLICY=pt9c-rival`).
- **The real client in my tab (`rr-play-c`, `?debug`), fronted for every timed check.**
  - Runs: `stadiumPromo` (4P, 3 seats) through the crash, and `county1` (4P) through both inspections.
  - `orbital1` (solo) through the promo.
  - `lastbucket` (4P, with one seat carrying Ball No. 1), through the bank, endless day 1 and into endless day 2 with
    a poach.
  - To see the landmarks, I made dev crews (`/api/dev/crew`) from the presets with `up.landmark` raised: 4 at the
    County, 5 at the Orbital and the Last Bucket.
  - The centre log: `__centre.overlaps` and `__centre.log`, plus my own 250 ms sampler of the centre elements.
- **The pane ran at about 1 fps** (rAF counter: mostly 1.0, with bursts to 40 during screenshots). That makes this a
  real low-frame-rate check of Gary in the Lift. The server clock ran at ~0.7× wall time while my bots ran.
- **Caveats:**
  - I couldn't turn the camera without pointer lock, so the views are from the spawn and the game's own cameras.
  - My seat script readies every 5 s, which matters for finding #6.
- Shots: `design/shots/pt9-C-*.jpg`.

---

## 1. Findings

| # | Sev | Finding | Repro / evidence |
|---|---|---|---|
| 1 | **High** | **MOW-E 2.0's loss line never shows.** The `fled` event carries "MOW-E 2.0 left. It took the bunting.", but the line never reached the centre. The red **MOW-E 2.0 WINS** stamp did show (good). Gary's inspection warn comes **0.1 s later** (fled T295.1, `gary warn` T295.2), and its toast "Gary's coming: clean up, then huddle." took the slot. The overlap counter logged it under the stamp (`toast 0.32 + mowe-stamp 1.00`, 1 overlap). The crash fight always times out at T295 and Gary always warns at ~T295 on Promotion Day, so a losing crew never reads the punchline. | `stadiumPromo`, 4 seats idle, `pt9-C-mowe2-wins-stamp.jpg`. Seat log: `T295.1 mower fled … line "MOW-E 2.0 left…"`, `T295.2 gary warn`. |
| 2 | **High** | **The first endless morning: Rat 1 clocks in inside Gary and the glass case.** `CASE` is (STAND.x − 2.6, STAND.z + 3.2) = (24.4, 5.0). `clockInSpot` slot 0 is now (24.6, 4.0), after round 13 #6 moved the late row there. So the first Rat spawns 1 m from the case, where Gary stands all shift. In first person:<br>• during epilogue card 3 the frame is Gary's back;<br>• then his bubble "Where do these go, boss?" is drawn **huge across the top of the screen**, over the cash, the clock and the crew list, for over a minute;<br>• he fills the centre of the view until the bell.<br>The DOM overlap counter can't see any of this: the bubble and Gary are in-world. | `lastbucket` → bank → endless day 1, idle at the spawn: `pt9-C-endless-gary-in-face.jpg`, `pt9-C-endless-giant-bubble.jpg`. Day 2 was fine, because Gary had gone. |
| 3 | **Med–High** | **The Site 13 poach is too easy.** A poached win counts 2 of the "4 of 7", so **two poached wins acquire Site 13**. The week then resets, and two more acquire it again. All the numbers are in §3. | `E-*-p1.txt`, `L-*.txt` (`pt9c-rival` rows). |
| 4 | **Med** | **The poach is invisible in the client.**<br>• `main.js` has no case for the `poach` event, so "Site 13 lost a regular. To you." never shows. The event is in the stream (`T0.1 {"t":"poach","text":"Site 13 lost a regular. To you."}`).<br>• The regulars have no view: their balls launch from `REG_BAY` x 22, with no figures and no jackets.<br>• The only trace is the feed line "You bought: Poach a regular".<br>• The shop row is buyable and priced right ($10.9M on a $288M bank). It sits at the bottom of the report panel's shop, below the fold, so I bought it over the API before the 20 s Ready ran out. | `lastbucket` → endless day 2. |
| 5 | **Med** | **Three new story lines are defined but never used.**<br>• `STAR_LINE` ("A star. Named Gary. I'll allow it."): Gary's bubble after the star.<br>• `STAR_PLAQUE` ("A star named Gary"): the endless case plaque.<br>• `HUSTLE_HINT` ("Hustle days beat Site 13."): the report hint.<br>Each is only `export const`'d. So the Orbital landmark, sold as "the heart", has no Gary beat, and the Hustle lever is still untaught. | `grep -rn "STAR_LINE\|STAR_PLAQUE\|HUSTLE_HINT" web/js server` finds only the definitions. |
| 6 | **Med** | **Landmark tiers 3 and 4 land a venue late for most crews.** With `BUY=1` (keep the fee), **in 9 of 9 runs the County's second inspection never fired at the County**:<br>• 4P bought "Site 13's inspector" ($44M) at the **Orbital**;<br>• 1P bought it on the County's last bell;<br>• `inspector` calls were 1 per County shift in every run.<br>The **fireworks** came at the County for 1P and 2P. At 4P they came on Stadium day 2, which in all 3 runs was the crash Promotion Day, where the Stretch ran 2/3, 1/4 or 0/0. The perks only work at their own venue, so a crew that saves for the promotion buys a toy for a range it has left. | `L-*.txt` `[landmarks] bought:` rows, and the `CALLS County … inspector` counts. |
| 7 | Med | **Two centre overlaps at the bank** (the counter read 2):<br>• the note card "Whoever finds this: the range is yours." with the `$∞` Ball Value flash (`ending-flash`) under it at 119.5 s;<br>• the bank PA "No more balls. Every ball mattered." under the endcard "Site 12 is yours" at 128.5 s.<br>Also, cash pops ("…$2,705 · washer", "+$11,382") still float behind the note card, fading rather than hidden. | `lastbucket`: `pt9-C-lb-note.jpg`; `__centre.log`. |
| 8 | Med | **The crash day piles three peaks into one minute.** On Promotion Day:<br>• the crash runs T−4:00 → ~T−2:05;<br>• the Stretch is due at T−3:30, and in the bots it ran mid-fight in 4 of 6 crash days (2/3, 1/4), was skipped in 2 (0/0);<br>• Gary's inspection warns at the same tick the fight ends (#1).<br>Mid-fight, the crowd nag "The crowd is bored. Lap the Track!" and the feed "Booed. A customer walked out." still run, so 2c's "the boss owns the screen" doesn't cover the Stadium's own lines. | `stadiumPromo` browser log; `P-*`, `L-4-*` STADIUM rows. |
| 9 | Low–Med | **The final report can still be cut short.** "Site 12 is yours" was up ~4 s (128.5 → 132.3), and endless day 1 started. That was because my seats readied during the ending cinematic, which started the 20 s countdown before the endcard drew. A friend who skips the note card and presses Ready shortens everyone's final report the same way. 8.3 fixed the held Space, not this. | `lastbucket` run, `__tl`. |
| 10 | Low | **Both County inspections use the same patch.** The retainer's T−5:30 visit and the T−3:30 one both went to (−2.2, −40.9), "NEAR MIDDLE". The second is a repeat, not a new place. | `county1` + landmark 4, seat log `inspect start` ×2. |
| 11 | Low | **The crash day can deny the promotion.** My idle crew's crowd fell to 2 %, so the day failed and the report said "Tomorrow: Promotion Day again." That's correct (the crash didn't block it, the crowd did), but a 115 s boss fight in the middle of a gauge day makes a real crew likely to lose the crowd. All 3 working bot crews still promoted (bell crowd 0.90–0.97). | `stadiumPromo` report: "MOW-E 2.0: got away · kept 24 balls · took the bunting" ✓. |
| 12 | Info | **The `?debug` counter's zone misses the in-world clutter.** Gary's bubble (#2) and the pay floats (#7) aren't in `CENTRE.ZONE`, so "0 overlaps" on the endless morning was true of the DOM but not of the screen. | — |

**What's fixed since round 8 (seen):**
- **Orbital promo, zero overlaps.** PA "Earth is fully retrieved. Please look up." → card 1 → card 2 → card 3, each alone.
- **First endless morning, clean in the DOM:** PA → the three epilogue cards → memo "Today's target: whatever. — the
  Rats", one at a time. No washer tip anywhere in my stretch (2b works).
- **Gary in the Lift at ~1 fps:** "Gary rides the Lift. Tie flapping." is up while the camera sits at the Lift, with Gary
  on the car ~60 px tall at 800×600 (`pt9-C-orbital-gary-lift-card.jpg`). That's the 7b fix holding at a low frame rate.
- **The inspector's beam and place:**
  - a white beam with the inspector under it, and a yellow chevron (`pt9-C-county-inspector-beam.jpg`);
  - the ALERT "Inspector at the near middle Yard!" (6 words) is alone in the centre.
- **MOW-E 2.0 reaches the 4P crews:** in 3 of 3 seeds `stadiumPromo` gave warn T180 → harvest T195 → hunt T235 → fled
  T295, with `story:mid:3` that morning. In the full ladder, **12 of 12 runs** (every crew size) met MOW-E 2.0. "MOW-E
  heard about the ceremony." (PA) then "MOW-E is loose! Block it. Hose its back!" then "Now it hunts. Lead it into a
  cart!" each showed alone.

**Softlocks: none.** 12 ladder runs, 3 crash runs and 12 endless runs all finished. In the browser, the Last Bucket banked
with three idle seats. My Space-hold made it 4/4, and idle Rats count after 20 s.

---

## 2. The story

**Landed:**
- **"Saw that lap. Don't tell Regional."** now plays on the crash morning: a 4P crew finally sees it (`pt9-C-promo-mid3.jpg`).
- **"MOW-E heard about the ceremony."** is the funniest PA in the game, and the red **MOW-E 2.0 WINS** stamp reads at a
  glance. But the punchline, "It took the bunting.", is lost every time (#1). It survives only in the report row "took
  the bunting".
- **County promo:** "I was a Range Rat. Here. 1987." and "Their numbers were, it turns out, estimates." are still the
  best pair in the late game.
- **Orbital promo:** "I always wanted to see it." → "Gary rides the Lift. Tie flapping." (now actually showing Gary at
  the Lift) → "Dimples has been rebranded as a moon." It's clean, warm and funny.
- **The bank:**
  - "BALL NO. 1 DOWN · follow the gold beam" → "Dot has Ball No. 1. To the return!" → "BALL NO. 1 · HOME · 3/4 ·
    WAITING: DOT" → "HOLD SPACE TOGETHER · 3 / 4" → the note over the gold ball.
  - Naming who you're waiting on is a great add for a sofa crew.
- **The epilogue:** "Gary loosens his tie. He grabs a bucket." / "Dimples is retiring. He finally makes eye contact." /
  "The sign is repainted. Under New Management." Three short cards, alone this time.

**Didn't land:**
- Gary's "Where do these go, boss?" is touching at the case (`pt9-C-endless-case.jpg`) and then grotesque a second later,
  billboard-sized in your face (#2).
- **Never seen:**
  - the GARY star beat (#5 — no line exists to show);
  - the star itself (it hangs at y 150 over the Lift / y 34 over the case, out of the first-person frame, and no camera
    visits it);
  - the inspector memo "Site 13's inspector works for us now." (my landmark was set in the save, not bought, so no
    memo).

---

## 3. My stretch's fun, measured

**Calls a minute** (`calls.mjs`, pooled over my 9 `BUY=1` ladder runs; full / r8 columns):

| Venue | 1P | 2P | 4P | Bar (1P / 4P) |
|---|---|---|---|---|
| Stadium | **3.87** / 3.45 | 4.30 / 3.81 | **4.68** / 4.16 | met |
| County | **2.81** / 2.31 | 2.81 / 2.17 | **2.46** / 2.08 | met |
| Orbital | 2.07 / 1.82 | 2.75 / 2.12 | 2.59 / 2.31 | met |
| Endless | 2.24 / 1.79 | 2.18 / 1.75 | 2.08 / 1.81 | — |

- **A caution on the ruler:** deck orders are 10 a shift everywhere (1.43 a minute). Take them out, and the 4P County is
  **~1.05** a minute, the Orbital **~1.0**, and endless **~0.7**. Endless's calls are mostly the deck, the basket and
  the washer.
- On round 8's builder-2 ruler (requests + Stretch + inspector + clusters + boss), the 1P Stadium is 1.00–1.43 and the
  4P Stadium is 1.57–2.14. That's as in round 8.

**The ladder** (shifts at the Stadium / County / Orbital, then minutes from Stadium day 1 to the bank):

| Crew | Shifts | Bank |
|---|---|---|
| 4P, `BUY=1` | 2 / 2 / 2 | 42–44 min |
| 4P, `BUY=0` | 2 / 2 / 2 | 43–44 min |
| 2P | 2 / 2 / 2 | 43–44 min |
| 1P | 2–3 / 3 / 2 | 49–56 min |

- The landmarks never lengthened a venue.
- Orbital last-bell cash with `BUY=1` at 4P is **$75–82M** (target ≤ $100M ✓; round 8: $250–265M).
- "Shifts with nothing worth buying": **0** in all 9 runs ✓. But see #6: what's worth buying is often a perk for the
  venue you just left.

**MOW-E 2.0:** met in 12 of 12 ladder runs and 3 of 3 crash runs. The fight is 115 s (T180–T295). The idle bots always lose,
and the promotion still stands ✓.

**Site 13** (from `endless`, Owners' days 2–6, 3 seeds each):

| | 1P | 4P |
|---|---|---|
| Beat rate, `POACH=0` | 8 / 15 (53 %) | 10 / 15 (67 %) |
| Beat rate, `POACH=1` | 10 / 15 | 12 / 15 |
| Acquired by Owners' day 3, `POACH=1` | 3 of 3 | 3 of 3 (one on day 4) |
| Acquired **twice** by Owners' day 5, `POACH=1` | 1 of 3 | 3 of 3 |
| Acquired at all, `POACH=0` | 0 of 3 | 1 of 3 (day 5) |

- The ladder runs agree: `POACH=1` acquired Site 13 by endless day 4 in **9 of 9**.
- **The price:** $11–25M a day against $120–476M in the bank, so it's never a real "spend or save".
- **The verdict: too easy.** Council round 13 asked for "≥ 1 of 3 by day 5". The poach turns a week-long race into a
  two-day formality, and you can repeat it.

**Best minute:** the bank. Ball No. 1 down → the gold beam → "WAITING: DOT" → "HOLD SPACE TOGETHER · 3 / 4" → the note.
Close second: the crash warn on Promotion Day. The PA "MOW-E heard about the ceremony." over a full Stadium is the
game's best surprise.

**Dead minute:** endless day 2 onward, mid-shift. The calls are the deck, the basket and the washer. Site 13 is decided
by the morning purchase, and the poach shows nothing on the range. Second: a solo first-person view on endless day 1,
staring at Gary's back.

**One more shift through day 4?**
- **Days 1–2: yes.** The contract pick, the poach and the race number are all visible on the report.
- **From day 3: thin.** Site 13 has already been bought, and money only waits for the statue: $360–476M at 4P by day 5,
  with the Hustle owned.

---

## 4. Top 5 improvement ideas (ranked)

1. **Let the crash's punchline land: move Gary off the crash day's bell.**
   - On a crash Promotion Day, Gary's inspection warns at T−1:30, not ~T−2:05. Or the fight's timeout moves to T280,
     so "fled" lands 15 s clear.
   - Queue the loss line as a STAMP-follow item (pri 1, `after: stamp`), so nothing at pri ≥ 1 can take its slot.
   - Skip the Stretch on a crash day.
   - **Why it's fun:** "MOW-E 2.0 left. It took the bunting." is the payoff of the owner's boss moment. Today every
     losing crew gets a stamp and then a huddle nag.
2. **Make the poach a real bet: the double count once a week, and the regulars on the range.**
   - A poached win counts double **once per week**, so the poach brings the acquisition from ~day 5 to ~day 3–4, not 2.
   - The price is 50 % of yesterday's bank, or the price grows ×1.5 per poach in a week.
   - Draw the bay of regulars at `REG_BAY`: three `people.js` figures in Site 13 jackets.
   - Wire the feed line (#4).
   - **Why it's fun:** you see what you bought, it's a call you argue about, and it can't be repeated into a formality.
3. **Landmark perks follow the crew one venue on.**
   - The fireworks also fire for the County's inspection: +1 hazard patch lit, GRAND SLAM if all are bagged.
   - The inspector on retainer also visits the Orbital as a "debris auditor": a ×4 beam on one debris drop.
   - **Or:** price tiers 3 and 4 inside one shift's surplus, as at the Club and Tiered.
   - **Why it's fun:** a crew that saves for its promotion (the bots' sensible rule, 9 of 9 runs) gets the call it paid
     for instead of a souvenir.
4. **Move the glass case (or the slot-0 spawn), and wire the star lines.**
   - The case moves off (24.4, 5.0), or `LATE_XS[0]` moves to 23.4.
   - Gary's bubble gets a max on-screen size, or a near-camera fade like the name plates.
   - `STAR_LINE` plays as Gary's next bubble after the star, and `STAR_PLAQUE` goes on the case.
   - The reveal camera gives the GARY star its 2 s (the endless case shot can tilt up to it).
   - **Why it's fun:** the most touching beat in the game gets its clean frame, and the $132M "heart" purchase pays off
     with a Gary line.
5. **The final report holds for everyone.**
   - Ready presses before the endcard has been up 3 s don't start the countdown, and the countdown is 30 s after the
     finale.
   - Wire `HUSTLE_HINT` on the first Hustle win against Site 13.
   - **Why it's fun:** "Site 12 is yours" is the game's credits screen, and four friends should all get to read their
     own line.

---

## 5. Scores (my stretch: Stadium → endless day 4)

| Metric | Score | Why |
|---|---|---|
| Fun | 7.5 | The crash, the inspection beam and the bank are great. Endless after day 2 is thin. |
| Clarity | 7 | The inspector now has a place and a light, and "WAITING: DOT" is clear. The poach does nothing you can see, and the crash's loss line is lost. |
| Text load | 7.5 | The Orbital promo and the endless morning are one-at-a-time now (0 DOM overlaps). There are still 2 overlaps at the bank, 1 at the crash stamp, and the giant in-world bubble. |
| Pacing | 7.5 | 2 / 2 / 2 at 4P (bank 42–44 min), 1P 49–56. The landmarks never lengthen a venue. Promotion Day is overstuffed (#8). |
| Co-op | 7 | The bank's "WAITING: DOT" and the inspector split work. The final report can be cut short by one Rat. |
| Meaningful features | 6.5 | Money buys things again, but tier 3/4 perks arrive after their venue for most crews, the star has no beat, and the poach is invisible and too strong. |
| Look & feel | 7 | The beam, the red stamp and Gary on the Lift look good. Spawning inside Gary on the best morning hurts. |
| Polish | 6.5 | No softlocks. There are three defined-but-unwired lines, an unhandled `poach` event and a spawn/case collision. |
| One more shift | 7 | Endless days 1–2 pull. The poach ends the Site 13 race by day 3, and money waits for the statue. |
| Decision density | 6.5 | The Stadium and County clear the bar at every size, but half the endless/County/Orbital calls are deck orders (endless ~0.7 without them). |
| **Overall** | **7.1** | The round's fixes work on screen. The losses are the crash's lost punchline, the endless spawn and a poach that's both invisible and decisive. |
