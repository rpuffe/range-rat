# Playtest round 8, tester C: Stadium → County → Orbital → the Last Bucket → endless day 4

Build `966eace` (council round 12 built). Played 2026-11-27.

**How I played.**
- **Bots, through the real `Crew`.**
  - The ladder: B's `late11.mjs` with builder 2's calls-a-minute tally. I copied it to my scratchpad as `pt8c.mjs` and
    added an endless contract pick (`PICK=1`) and a contract and Site 13 log.
  - Runs: from `stadium1` through 4 endless days, at 1P / 2P / 4P × seeds 7 / 11 / 23. That's 9 runs and 21 endless
    days.
  - Endless: `pt7c-endless.mjs` from the `endless` preset, 5 days, at 1P / 4P × `PICK=0/1/2` × seeds 7 / 11. That's 12
    runs and 48 settled contracts.
- **The real client in my preview tab (`rr-play-c`, port 8096).**
  - Presets: Stadium day 1, County day 1, Orbital day 1, and the Last Bucket, which I played on through the bank into
    the first endless morning.
  - Seats: a small script (`seats.mjs`) joined 1–3 extra seats over the crew API, so I could see 2P and 4P scaling and
    an AFK Rat in the huddle. A second script (`carrier.mjs`) walked one seat out to Ball No. 1 and carried it home.
  - Shots are in `design/shots/pt8-C-*.jpg`.
- **Caveat: the browser pane ran at about 1 frame a second** (measured with a rAF counter). It's shared by six testers,
  and the machine was also running my bots. So I read **text, layout and order** from the browser, but not timing or
  feel.
  - The server clock ran at about 0.7× wall time.
  - Screenshots sometimes came back as a 2× crop (a DPR quirk in the pane, not the game).
  - I couldn't move my Rat without pointer lock, so the browser views come from the spawn and from the game's own
    cameras.

---

## 1. Findings

| # | Sev | Finding | Repro / evidence |
|---|---|---|---|
| 1 | **High** | **The PA card still shows under the story card** on two promotion-style mornings. The say.js PA-idle rule doesn't cover these. **Orbital promo:** the PA card "Earth is fully retrieved. Please look up." stays up (opacity 1, `#pa-body`) under all three promo:5 cards for their whole run, and one Space clears both. **First endless morning:** the story card, the PA card ("Under New Management. Approved by nobody."), Gary's bubble, the washer tip and 3–4 floating "+$24,380 · washer" pops are all on screen at once. | `orbital1` preset, open the range: `pt8-C-orbital-two-cards.jpg`. `lastbucket` preset, bank it, next morning: `pt8-C-endless-morning-clutter.jpg`. The text log also had the bank PA "No more balls. Every ball mattered." up while the note card was up. |
| 2 | **High** | **Fast 4P crews never meet MOW-E 2.0, or Gary's Stadium mid beat.** A 4P crew that finishes the Stadium card on day 1 plays day 2 as Promotion Day (`venueDay 0`). `bossDay()` returns null on a promo day, and needs `venueDay ≥ 2` anyway, and `mid:3` doesn't play either. The owner's "boss moment" disappears for the best crews. | Bot, 4P: seeds 7 and 23 went Stadium vd1 → vd0 (promo day): no `mower:*:enc` event and no `story:mid:3`. Seed 11 (card not done on day 1) got both. Round 14 measured "4P Stadium 2 shifts in 9 of 9" too, so this is the common case. |
| 3 | Med | **Inspection Hour doesn't say where.** The ALERT reads "Inspection! Bag the hazards by the inspector!", and the patch label is `6 HAZARDS`. Neither names a Yard or a side (the council asked for "Clean Yard 2"). The inspector is a person and a flat chalk ring 40–50 m out, with no beam. From the mats I couldn't find him; the feed line "FHI inspector on site: 6 hazards in his patch." doesn't place him either. | `county1` with 3 seats, T−3:30: `pt8-C-county-inspection-alert.jpg`. Snapshot: `inspect: {x: 11.3, z: −42.2, r: 15, where: "6 HAZARDS"}`. |
| 4 | Med | **The washer tip ("The washer hopper is empty. Bank some balls.") sits mid-screen at every late-venue start.** It's under the story cards, under the LB's "BALL NO. 1 DOWN" banner, and under the epilogue. It's the second centre text in almost every shot I took. On a 7-day-old crew with a full washer kit it isn't news. | Every shot: `pt8-C-stadium-newsreel.jpg`, `-lb-goldbeam.jpg`, `-endless-morning-clutter.jpg`. |
| 5 | Med | **The 1P County drops under the calls bar.** In 3 of 9 1P County shifts the tally was under 1 call a minute (0.57, 0.86, 0.86; mean 1.06). The Stadium's 1P calls are a fixed schedule: 7 calls every shift at 1P, 8 at 2P, 11 at 4P (5 / 6 / 8 requests plus the Stretch), so the count never varies. | §3's table. |
| 6 | Med | **Gary in the Lift: card 2 played over the gate, not the Lift.** "Gary rides the Lift. Tie flapping." showed with the camera on the entrance sign (`pt8-C-orbital-lift-card-nolift.jpg`). The camera reached the Lift only ~10 s after the cards ended. **Caveat:** the pane ran at ~1 fps. But the cause is real: the reveal camera advances by frame `dt`, while the cards run on wall-clock time. Any slow frame rate (Xbox Edge under load) desyncs them, and Gary is the beat that's lost. | `orbital1` preset, rAF counter: camera `23,2,8 → 21,3,14` across card 2, then `−6,5,17` after the cards. |
| 7 | Low–Med | **The hush is busy around the ball.** The note card sits high and the gold ball is in frame (good), but the name plates ("Dot", "Kyle", "Madison", "Tanner"), the confetti and the "+$12,219 · washer" pops float over and beside the ball and the card. | `pt8-C-lb-note.jpg`. |
| 8 | Low–Med | **The deck is still a slab, now grey instead of black.** At the County and Orbital clock-in, the deck's underside fills the top ~25–30 % of the first-person view (`pt8-C-county-inspection-alert.jpg`), and it reads as a wall. It's better than black, but the stands and the Lift still sit behind it. | County / Orbital spawn, first person. |
| 9 | Low | **The endless contract is met by playing for it, not by accident.** That's good, but the bot shows the stakes. A crew that ignores the contract (my ladder bot picking 2★) met **4 of 21**. The contract-aware bot met **1★ 12/16, 2★ 9/16, 3★ 1/16**. 3★ ("nobody knocked flat", "×3 Hustle before T−3:00") is under the council's 25–40 % band in my sample (builder: 29 % over more seeds). | `e*-p*-*.txt`. |
| 10 | Low | **The Stadium lobby line still says "Lap the Ping Track. Keep the crowd happy."** The card is "Answer 6 souvenir requests" now. | `stadium1` lobby. |
| 11 | Low (bot, not game) | **The 2P ladder bot sat at the Stadium for 12, 28 and 50 shifts**, stuck on "8 more pings for the County.". The 2P policy never pings by hand, and the autopilot's pings count only on its lap shifts. A real crew pings, so this isn't a softlock. But it's the only Stadium goal that can't be done by just playing the venue's job (requests, laps). | `r2-*.txt`; the card text was clear throughout. |
| 12 | Low | **Endless works on its own: hired help banked 1,064 of 1,242 balls** on my idle crew's first endless day (+$42.3M, SPOTLESS). The crew's hands barely move the number; only the Hustle does. | `pt8-C-endless-report-contracts.jpg`. |
| 13 | Low | **Endless report and Board read well, with a small layout issue.** The three contracts show, with "Next: Teal cap at 3 ★". Picking 2★ gave the next memo "Contract: reach ×2 Hustle." ✓. The Board shows `SITE 13 $382k (est.)` under `TODAY ★0` (`pt8-C-endless-d2-board-site13.jpg`). The report's 2★ and 3★ rows sit below the panel's fold, and the "(missed washer bonus $44,033)" value overflows its column. | Endless day 1 → 2 in the browser. |
| 14 | Info | **Possible skip of the final report.** In my run the "Site 12 is yours" report was up for under 1 s. My synthetic Space was still held after the note card, which readied me. A pad player mashing Ⓐ through the note card could do the same, because Ready is on the same button. Not reproduced with a real pad. | `lastbucket` run, text log. |

**Softlocks: none.**
- 21 ladder runs and 12 endless runs finished.
- In the browser, the Last Bucket banked with an AFK seat on the crew (idle Rats count as holding: `huddleIn`).
- Ball No. 1 always landed 102–130 m out, and the carrier reached the return 18–23 s after pickup.

**Early-game regression checks** (the ones I could see from my stretch):
- **Memo folding:** one memo a morning at every late venue (the Stadium, County and Orbital memos read "Today: 35%
  clean. Crowd over half." / "…Zoning over half." / "Today: clear the sky. 1,958 to bring home.").
- **PA-idle rule:** fixed on Stadium day 1 (the newsreel card had no PA under it), but not on the Orbital promo or the
  first endless morning (#1).
- **Spawn moves:** the late clock-in is out from under the deck line, but the deck still fills the top of the frame
  (#8).
- I didn't see the Club day-3 boss (stretch A/B).

---

## 2. The story

**What landed.**
- **County promo:** Gary's "I was a Range Rat. Here. 1987." It's touching, short and well placed. "FHI has acquired
  Site 13. Welcome, colleagues." → "Their numbers were, it turns out, estimates." is the best Site 13 joke in the game.
- **Orbital promo:** "I always wanted to see it." and "Dimples has been rebranded as a moon." both work. "Gary rides the
  Lift. Tie flapping." is a great line that, in my run, nobody saw happen (#6).
- **The bank:**
  - The gold beam appears from the stand the moment Ball No. 1 is down, and the Target Greens' beams are gone. The
    banner "BALL NO. 1 DOWN · follow the gold beam" is clear, and the carrier's pillar shows who has it.
  - "HOLD SPACE TOGETHER · 1 / 2" on the Board is simple.
  - The note card, "Whoever finds this: the range is yours.", in the upper third over the glowing ball in the hopper,
    is still the best moment in the game (`pt8-C-lb-note.jpg`).
- **The epilogue:** "Gary loosens his tie. He grabs a bucket." / "Dimples is retiring. He finally makes eye contact." /
  "The sign is repainted. Under New Management." Three short cards, all funny or warm. Then Gary stands by the glass
  case, the two gold halves are in the foreground, and his bubble asks "Where do these go, boss?". That is the
  screenshot the council wanted.
- "Today's target: whatever. — the Rats" is a perfect memo.

**What didn't.**
- The epilogue's screen is the most cluttered in the game: two cards, a bubble, a tip and cash pops (#1, #4). The
  touching beat is fighting a washer hint.
- **Never seen:**
  - The Stadium mid beat ("Saw that lap. Don't tell Regional.") and MOW-E 2.0, at 4P in 2 of 3 runs (#2).
  - The Inspection memo ("The inspector was impressed. He's from Site 13."): my browser County crew stood idle, and
    the bot doesn't log memos.
  - The Site 13 acquisition. Nobody reaches 4 wins of 7 inside 4–5 endless days (0 of 33 runs). It's a day 5–8 payoff
    my stretch can't reach.

---

## 3. My stretch's fun, measured

**Calls a minute** (builder 2's tally: a lit request, a Stretch section, the inspector, a new hazard cluster, a boss
phase). Shifts are 7 min.

| Venue | 1P | 2P | 4P | Bar (1P / 4P) |
|---|---|---|---|---|
| Stadium | **1.14** mean, min 1.00 (9 shifts) | 1.15 (most shifts exactly 1.14) | **1.64** (1.57–2.00, 6 shifts) | ≥ 1 / ≥ 1.5: **met, barely at 1P** |
| County | **1.06** mean, 0.57–1.57; **3 of 9 under 1** | 2.40 (2.0–3.3) | **3.27** (2.4–3.9) | 1P **marginal**, 4P well over |
| Orbital | not tallied: debris drifts in every 12 s, plus the tether and the Lift | — | — | (B and C called it brisk in round 7) |
| Endless | one contract pick a day, a live Site 13 number | — | — | — |

**The ladder** (shifts at the Stadium / County / Orbital, then minutes from Stadium day 1 to the bank):
- **1P:** 3 / 3 / 2, the bank at **56–58 min**.
- **4P:** 2 / 2 / 2, the bank at **42–44 min**.
- **2P:** after the bot's ping stall (#11), 2 / 2.

**Each venue's numbers:**
- **Stadium, 4P:**
  - Stretch sections answered: 8 of 18 (2/3 in 4 of 6 shifts);
  - souvenir share of income 19.5–20.5 %;
  - bell crowd 0.88–0.97.
  - **Idle in the browser:** the crowd fell to **9 %** at the Stretch and 2 % by T−2:48. The gauge really does fail if
    you ignore it.
- **County, 4P:**
  - 1–2 inspected hazards bagged a shift, 0–1 noted;
  - 0–2 CLEAN SWEEPs a shift.
  - **Idle in the browser:** Zoning was 0 % by T−3:30 ("Zoning towed 12 more balls. Bag the hazards!").
- **Endless, money:** a 4P crew had **$295M at endless day 4** (the statue is $300M; the Owner's Hustle $120M). After
  the statue there is nothing to buy.

**Site 13 (endless days 2–5):**
- **Overall:** beaten on **44 of 69** days (64 %).
  - The contract-aware bot: 29 of 48 (60 %, in the 45–65 % band).
  - My ladder bot: 15 of 21; **1P 8 of 9, too easy**.
- **Losses are close:** 0.84–0.98 of their target.
- **Wins on Hustle-contract days are blowouts** (1.69–1.96×), because the ×3 Hustle is what beats Site 13. That's the
  right lever, and the game should say so.

**Best minute: the bank**, from "BALL NO. 1 DOWN · follow the gold beam" to the note card.
- One beam on the field with the Target beams gone, a 20 s carry with a pillar over the carrier, "HOLD SPACE TOGETHER",
  then the note over the gold ball.
- Close behind it: the 4P Seventh-Inning Stretch, with three gold beams going up over the stands.

**Dead minute: the 1P County from T−6:00 to the inspection**, and in endless, any minute on a cash contract.
- **1P County:** the drones eat every stray, and hazards come 0–1 a minute.
- **Endless cash contract:** "bank 1.1× yesterday" asks nothing different of you.

**One more shift?** Yes for a 4P crew to about endless day 3, and then it's thin.
- **What pulls you on:**
  - Site 13's number is close every day;
  - a Hustle contract is a real "let's go for it";
  - the first cosmetic arrives on day 3–5 (2★ picker, 4P).
- **What it lacks:**
  - money has no use after the statue;
  - Site 13's acquisition is 4 of 7 away;
  - nothing new happens on the range.

---

## 4. Top 5 improvement ideas (ranked)

1. **MOW-E crashes Promotion Day.**
   - If the Stadium encore hasn't happened by Promotion Day, MOW-E 2.0 arrives at T−4:00 of the promo shift.
   - The fiction: "MOW-E heard about the ceremony." Play `mid:3` that morning too.
   - Builds on `bossDay` (allow `promo` at the Stadium when `!s.encore`).
   - **Why it's fun:** the owner's boss moment reaches every crew, including the good ones (#2), and a ceremony
     interrupted by a mower is funnier than one that isn't.
2. **The inspector gets a beam and a place name.**
   - A white clipboard-beam (the beacon instance path, no new draw call) over the inspector for his 60 s.
   - The ALERT names the side: "Inspector by the far Yard! Clean it!" (7 words).
   - The Board label reads `INSPECTION · FAR LEFT · 0:45`.
   - **Why it's fun:** the peak becomes a race to a light, like the gold beam, and a 4P split ("you two go") needs a
     place to say (#3).
3. **One centre text, enforced at the source.**
   - The story card queue owns the centre. While it's up:
     - PA cards queue (audio and caption after);
     - tips and the washer hint are suppressed;
     - floating cash pops and name plates are hidden within 15 m of the return during the hush and the epilogue.
   - **Why it's fun:** the two best beats in the game (the note, Gary at the case) get the clean frame they were built
     for (#1, #4, #7). It's the owner's rule.
4. **Endless gets a money lever that makes Site 13 personal.**
   - After the statue, a repeatable **"Poach a Site 13 customer" ($25M)**: one extra bay of their regulars for today,
     with their jackets.
   - Plus the hint on the report: "Hustle days beat Site 13." (5 words).
   - **Why it's fun:** $295M finally buys something visible, the race gets a "spend or save" call, and it teaches the
     ×3 Hustle lever that already decides the race.
5. **The 1P County gets a second, smaller inspection.**
   - At 1P only, a 30 s "spot check" at T−5:30 on the busiest patch (×2, no noted penalty).
   - **Why it's fun:** it lifts 1P calls from 1.06 (3 of 9 shifts under 1) to the bar, and gives the solo player's dead
     T−6:00–T−3:30 stretch a reason to look up from the drones.

---

## 5. Scores (my stretch: Stadium → endless day 4)

| Metric | Score | Why |
|---|---|---|
| Fun | 7.5 | The Stretch and the bank are great. The County at 4P is busy in a good way. Endless days 1–3 have a rival worth racing. |
| Clarity | 6.5 | The gold beam and "HOLD SPACE TOGETHER" are clear, but the inspector has no place, the lobby line is stale, and two morning screens have two centre cards. |
| Text load | 6.5 | The Orbital promo and the first endless morning break the one-centre rule (card + PA + tip + pops); the washer tip is everywhere. |
| Pacing | 7 | The 4P ladder is 2 / 2 / 2 shifts and the bank comes at 42–44 min (1P 56–58). The ending is ~20 s of carry. |
| Co-op | 7 | The Stretch and inspection split a 4P crew, and the huddle tolerates an AFK Rat. Solo County is thin. |
| Meaningful features | 6.5 | Contracts are winnable and they're the lever on Site 13, but money is meaningless past the statue, and 3★ is a 1-in-16. |
| Look & feel | 7.5 | The note over the gold ball, Gary at the glass case and the Stretch beams look great. The deck is still a grey slab. |
| Polish | 6.5 | No softlocks in 33 runs. The PA-under-card leak, the floating pops in the hush and a stale lobby line remain. |
| One more shift | 6.5 | Site 13 races close and Hustle days are exciting. After day 3, there's nothing to buy and the acquisition is out of reach. |
| Decision density | 6.5 | The Stadium and County meet the bar at 4P (1.64 / 3.27) and are marginal at 1P (1.14 / 1.06). Endless has one real pick a day. |
| **Overall** | **7.0** | Both late loops work. The losses are text overlap on the best beats and the boss skipped for fast crews. |
