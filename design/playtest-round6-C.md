# Playtest round 6, playtester C: Stadium → County → Orbital → the Last Bucket → epilogue → endless

Build `52af0c2` (round 12 story beats, on top of the `dd2e78d` sky fix).

**How I played:**
- **Headless, through the real `Crew`.**
  - `scripts/bots/late.mjs` from the `stadium1` preset at 1P, 2P and 4P (seed 7) all the way into endless.
  - The round-11 jobs bot (`late11`, which does souvenirs and hazards properly) from `stadium1` at 1/2/4P, with the jobs on and off.
  - An Orbital probe from the `orbital1` preset. It logs the sky row, the strip and `lastBucketLine` every 30 s. I ran it four ways: 1P, 4P, a crew that never buys the tether, and a crew that never rides.
  - A story probe that logs every `{t:'story'}` event, 6 runs.
  - A MOW-E counter on the three late presets.
- **The real client (rr-play-c, :8096):** the `lastbucket` preset played through the huddle, the end card and the **epilogue**, then into endless. I also played the Orbital (Lift ride, EVA), the Stadium (a souvenir carried to the rail) and the County promotion morning.
- **Caveat:** the shared browser pane was hidden most of the time, so rAF stalled. The HUD only redrew on screenshots, and I moved by setting `rr.me` under `?debug` with a screenshot to sync. Timing on screen is therefore not trustworthy; text and order are.

Screenshots are `design/shots/pt6-c-*.jpg`.

---

## 1. Findings

| # | Severity | Finding |
|---|---|---|
| 1 | **High** | **The County tells a crew the wrong reason for a DENIED.** The bell's miss line is always `GAUGE_MISS[4]` = "Missed: strays in the Yards." (rally.js:31). Since round 11 the real cause is the **hazard balls**: `zoningWith` charges 1/12 a hazard against 1/30 a stray. A 4P crew that ignores hazards (late11, JOB=0, seed 11) has the strays goal done, drones sweeping 190–230 balls a shift and 0–2 strays out, and is **DENIED 8 shifts running** (gauge 0.00–0.33, 8–13 hazards out, $117M in the bank). It is effectively soft-locked at the County, and the only text pointing at hazards is the second van's feed line ("Bag the hazards!") plus a one-time per-device tip. The County's reveal memo ("New: the Yards…") also never mentions hazards. Fix: make the miss line name the bigger term ("Missed: hazards left out. Spray, then bag."), and put the hazards in the reveal memo or the card. |
| 2 | Medium | **The Orbital: no softlock found, and the words now track the state.** <ul><li>**Normal crews:** every 1P/2P/4P run cleared the sky in 2 shifts. Ball No. 1 fell on Orbital day 2 at T-5:00 (1P), T-3:39 (4P) and T-3:06 (2P).</li><li>**Every state reads correctly:** the sky row counts down ("Clear the sky · 1,957 balls still in orbit" … "· 97 …"), and the strip names the open step ("NEXT: 3 MORE RATS ON THE LIFT", "NEXT: BUY THE TETHER WINCH").</li><li>**A crew that never buys the tether:** Balls Outstanding reaches 1 on day 2, the phase goes to `sky`, and the banner reads **"SKY CLEAR · NOW BUY THE TETHER WINCH"** for 2½ shifts, which is accurate.</li><li>**A crew that never rides:** 40 shifts at "0 of 4 · NEXT: 4 MORE RATS ON THE LIFT". That's by design, and the strip says it.</li><li>The `riders` force-tick covers a shrinking crew, and the debris cap covers the Last Bucket.</li></ul>Two rough edges remain:<ul><li>**(a)** In the `sky` phase, waiting on a purchase, there is nothing to do but buy. The row shows "Clear the sky" ticked (3 of 4) while Ball No. 1 still doesn't come, so a crew that can't afford the winch yet stands idle with orbit shots stopped.</li><li>**(b)** The sky row counts *balls* (1,957), the debris goal counts *pieces* (24/60), and one piece = 10 balls (15 solo). That conversion is shown nowhere, so "1,957 balls still in orbit" next to "57 debris up" reads oddly.</li></ul> |
| 3 | Medium | **The Last Bucket banner overflows.** "BALL NO. 1 → THE RETURN · 0 / 1 · waiting: you" is clipped at the right edge at 800 px ("waiting: y"). At 4P it grows to "3 / 4 · waiting: Rat2, Rat3", which is also over the 8-word rule. Shot: `pt6-c-carry-banner-clipped.jpg`. |
| 4 | Medium | **Two texts over the finale.** <ul><li>**At the Last Bucket morning:** the memo "Today: clear the sky. 1 to bring home." sits under the "BALL NO. 1 IS DOWN · follow the beam" banner. The sky is already clear, so the memo is wrong, and there are two centre texts. This happens on any run whose Outstanding hits 1 at the bell (the morning path in `startShift`) and on the `lastbucket` preset. Shot: `pt6-c-lb-banner-memo.jpg`.</li><li>**During the carry and the huddle:** the "↑ Fill the bucket basket!" checklist stays up at the game's climax (`pt6-c-huddle-solo.jpg`). The nudge should stand down while `lastBucket` is live.</li></ul> |
| 5 | Medium | **Endless opens with a loss.** The Orbital's last full shift sets the cash record (debris bank at weight 3), and endless days earn 15–28% less. At 4P: record $84.7M; endless $70.8M, $71.1M, $71.6M. At 1P: $61.0M, then $43.6–44.4M. So the first endless report reads "race: beat false" against the record, and in 3 days no crew set a "NEW" record. The only fresh goals are the contract stars, at 10 stars per recolour. Measured in late.mjs at 1/2/4P. |
| 6 | Low–Med | **The PA card stays on screen under the story card on every promotion morning I saw** (Stadium, County, Orbital). My visible-text log had `pa-card` at ≥0.3 opacity alongside story cards 1–3 for about 9 s. Shot: `pt6-c-stadium-pa-and-story.jpg`. With the pane's stalled rAF this may be a CSS transition that never got frames, as round12-story.md suspects, so it needs one look on the Xbox before anyone codes. |
| 7 | Low–Med | **A promotion morning is about 7 centre texts in a row:** the reveal PA, three story cards, the morning memo ("Today: 35% clean by the bell."), then two reveal memos. The morning memo comes *before* the memo that explains the venue. Two reveal memos break the 8-word rule: "New: the Ping Track. The crowd grades you now. The crowd has never played golf." (15 words) and "Earth has been fully retrieved. 1,958 balls remain. They are all in orbit." (13). |
| 8 | Low | **The autopilot's "A lap of the Track! The crowd approves." toast fires at the County, the Orbital and in endless,** including in the middle of the epilogue cards (log: the "Under New Management" card plus that toast). |
| 9 | Low | **The skip-ahead lobby camera sits inside the bay canopy's pillars** at the Orbital and Last Bucket (`pt6-c-*`: a big grey column fills the right third). On the Lift ride up, the bay canopy's top is a flat black slab that fills the lower half of the view. |
| 10 | Low | **The title screen silently rejoins the last crew** (`sessionStorage range-rat.seat`), even after clicking a skip-ahead preset. I had to clear sessionStorage to start a new test crew. That's a dev irritant only. |
| 11 | Low | **The souvenir counts toward the HUD pocket** ("1 / 60") while the server pocket is 0 (it's in `hands`). The carry prompt "Souvenir ×1: to the crowd rail (side nets), pass to a mate ×2" is 11 words. |
| 12 | Info | **MOW-E at the late venues** runs once a shift from venue day 2 and rakes only 8–24 balls (measured on the stadium1, county1 and orbital1 presets, 1P and 4P). At 4P each late venue has one MOW-E pass, on its last day, against drones, the autopilot and helpers clearing hundreds. It is invisible here. |

Owner rules:
- **One centre text at a time:** fails at #4, possibly at #6.
- **~8 words:** fails at #3, #7 and #11.
- **Works on a pad:** souvenirs and the huddle need no new button, so they pass by design. Not tried on a real pad.
- **Never drops full screen:** not observed.
- **1 → 4 players:** the Orbital scales cleanly (the riders need equals the crew, and solo debris is worth 15). The County gauge only bites at 3–4P, as designed.

---

## 2. The story

**Every beat fires, every time.** In 6 headless runs (1P, 2P and 4P × seeds 7 and 23), the beats came in this order, each on its first possible morning:
1. promo:3 (Stadium)
2. mid:3
3. promo:4 (County)
4. mid:4
5. promo:5 (Orbital)
6. mid:5
7. the epilogue

No Promotion Day or Today modifier ate a mid beat in these runs.

**The epilogue, seen live** (`lastbucket` preset, solo; shots `pt6-c-finale-inf.jpg`, `pt6-c-site12-yours.jpg`, `pt6-c-epilogue-note.jpg`):
- **The sequence:** carry Ball No. 1 → "HOLD SPACE" → the $∞ / BALL scramble → PA "No more balls. Every ball mattered." → "Site 12 is yours" (1 ball · $71.6M) → **Clock in tomorrow** → the next morning's shift is already running → the epilogue cards → PA "Under New Management. Approved by nobody." → memo "Reminder: we are Corporate now. Please do not tell us."
- **What landed:**
  - The note card ("INSIDE BALL No. 1 · 1958", dark serif): *"Whoever finds this: the range is yours."* This is the best line in the game. It pays off "UP" and "the ball never landed" in one sentence.
  - *"Dimples is retiring. He finally makes eye contact."* is the right laugh straight after it.
  - "Gary loosens his tie. He grabs a bucket." is touching on paper.
- **What didn't:**
  - **Timing.** The note is read a whole end card and a new morning after you banked the ball. By then customers are swinging, the clock is running and an autopilot toast cuts in. The emotional peak (the huddle sweep) and the reveal of what was *inside* the ball are separated by two screens.
  - **Gary.** Gary is never shown. The caption describes him grabbing a bucket, but there's no Gary in the world on that morning.
  - **The ending as a whole.** It feels earned mechanically: the $∞ scramble and "Balls Outstanding: 0." are great. It is not yet emotional, because the most emotional card arrives after the credits, mid-shift.

**The Stadium** (promo, live): "The jumbotron plays a 1958 newsreel. By mistake." / "The founder swings. The camera never finds it." / "Site 13 has two jumbotrons. Do better." Funny and quick. The jumbotron gag would land harder if the jumbotron *showed* it.

**The County** (promo, live): "FHI has acquired Site 13. Welcome, colleagues." / "Their numbers were, it turns out, estimates." Both are good jokes. Then Gary's **"I was a Range Rat. Here. 1987."** is the third card, straight after two acquisition gags, and is followed at once by "Today: 35% clean by the bell. Smiling is not required, but it is tracked." (`pt6-c-county-gary-under-memo.jpg`). The confession deserves its own beat. As it is, it reads as card 3 of a Corporate memo stack.

**The Orbital** (promo, live): Gary's clipboard card first, **"I always wanted to see it."**, then "Gary rides the Lift. Tie flapping." That's the right order and it's lovely. But the Lift ride that follows is yours, not Gary's: nothing in the world shows him going up. The mid beat (day 2: "Up here, one ball glints: FHI · 1958" / "He hit it so we'd keep looking") plays about 3 minutes before Ball No. 1 falls. Good placement (headless only).

**Not seen live:**
- Gary's late visit hello and sign-off. No Gary day came up in my browser sessions, and the bots don't render them.
- The Stadium and County mid beats. These are headless only.

**Length:** 2–3 cards a beat is right. The beat itself is never the problem; the problem is the stack of memos around it (finding #7).

---

## 3. My stretch's fun

**Best minute:** the Last Bucket from the beam to the scramble. You follow the pink beam, pick up Ball No. 1, the banner flips to "→ THE RETURN", you hold Space at the bucket, and "$∞ / BALL" scrambles in letter by letter, then "Site 12 is yours … Balls Outstanding: 0." It is still the game's best moment. The epilogue's note line is the best single line.

**Dead minutes:**
- The `sky` phase when the winch is unbought. In the no-tether run that meant 2½ shifts of "SKY CLEAR · NOW BUY THE TETHER WINCH" with orbit shots stopped and no job.
- Solo Stadium days 3–4: in late.mjs every card goal was done on day 2 and the crew earned the $3M fee for two more shifts. Fee-only days happen at 1P (4 Stadium shifts); at 4P every late venue is 2 shifts.
- The first endless report losing to your own Orbital record.

**The late jobs:**
- **Souvenir balls (the Stadium) are legible and pleasant but optional.**
  - *Legible:* a pink ball under the gold beacon, a tip, a big yellow arrow and ring at the rail (`pt6-c-souvenir-rail.jpg`), and an automatic delivery.
  - *Pay:* $4,797 for one, against ~$700k a solo shift. Bots put the job at 4–10% of income: 37 souvenirs = $0.6M of $6.0M at 4P.
  - *For the crowd:* one souvenir is +0.07, about 28 s of solo drain. A lapping Rat does that every ~11 s.
  - *Verdict:* a 4P crew that ignores souvenirs still passes (autopilot plus pings, 8 boos, APPROVED). So it's a nice-to-have, not a decision.
- **Hazard balls (the County) are the opposite: they decide promotion at 3–4P.**
  - *Attended:* ~10% of income (21–23 bagged a shift, $2.3–2.6M) and a gauge of 1.00.
  - *Ignored:* DENIED every day. With the wrong miss reason (#1), this is the late game's most likely "locked out" report after the sky.
  - *Pay difference:* attended $23.9M a shift against $15.2M ignored, at 4P.
- **Zoning vans:** they only show for a crew that's already failing, and the first one's toast ("Zoning's van towed 6 balls.") doesn't say why.
- **Gauges:** the Stadium's crowd falls under the line within about a minute solo if nobody laps (live: 0.39 at 1:00), which teaches lapping well. The County's gauge is invisible as a problem until the bell.

---

## 4. Top 5 improvement ideas (ranked)

1. **Read the Ball No. 1 note at the huddle, not the next morning (S).** When the sweep completes, play the epilogue's first card ("INSIDE BALL No. 1 · 1958 / Whoever finds this: the range is yours.") *before* the $∞ scramble, with a beat of silence and the ball cracking open in the carrier's hands. Keep Gary, Dimples and the sign for the first endless morning, and pause that morning's clock until the cards end. *Why it's fun:* the crew is huddled together, holding a button, at the emotional peak. A line read together there is the moment people remember.
2. **Make the County say "hazards" (XS–S).** Base the miss line on the bigger term (`strays/30` vs `hazards/12`): "Missed: 9 hazards left out." Add "Green hazards: spray, then bag" to the reveal memo, and put the live hazard count on the Board's Zoning gauge. *Why it's fun:* it turns the one real late-game fail state into a clear team job (sprayer + bagger), instead of an unexplained wall.
3. **Show Gary going up (M).** On the Orbital's promotion morning, Gary rides the Lift car once, tie flapping, while "I always wanted to see it" is on screen. On the epilogue morning, Gary stands at the bucket stand with a bucket and his tie loose for that shift. *Why it's fun:* the story's heart is told in captions about things the player never sees. One visible Gary per beat makes it land, and players will screenshot it.
4. **Give endless a record it can beat on day 1 (S).** Either the Orbital's debris shifts don't set `records.cash` (count it from the first endless day), or endless gets a visible "Balls Outstanding climbing" chase: the morning names yesterday's number, and the crew races to hold it under N. *Why it's fun:* "one more shift" needs a winnable target, and today the first endless report is a loss.
5. **Give the `sky` phase a job (S).** If the winch is unbought, let EVA riders still bring debris (so they're not idle), or let the sky phase show a one-line price ("Tether winch: $6M · you have $4.1M"). And show "1 piece = 10 balls" once, as "Each piece of debris: 10 balls". *Why it's fun:* the final gate should be a crew sprint to the finale, not a wait.

Honourable mention: **MOW-E at the late venues** could tow the County's *hazards* into the van lane, or mow the Stadium Track mid-lap (honk, cart stops). It would be a late-venue hazard that interacts with the job each venue already has, instead of raking 10 balls nobody notices.

---

## 5. Scores (my stretch, this build)

| Metric | Score | Why |
|---|---|---|
| Fun | 7 | The finale and the EVA are still the best set pieces, and the County hazards make a real team job. The Stadium's souvenirs are pleasant but optional. |
| Clarity | 6.5 | The Orbital now always says what it waits on. The County's miss line names the wrong cause, and the sky row's balls-vs-pieces maths is unexplained. |
| Text load | 6 | A promotion morning is about 7 texts. Two memos are 13–15 words, the banner is clipped, and two texts stack at the finale. |
| Pacing | 7 | At 4P each late venue is 2 shifts and the finale falls mid-day 2. Solo Stadium has two fee-only days. |
| Co-op | 7 | Spray + bag and the souvenir relay give 4P real roles. The huddle is a lovely group beat. |
| Meaningful features | 6.5 | Hazards matter (they decide promotion); souvenirs barely do. MOW-E is invisible late. |
| Look & feel | 7.5 | The $∞ scramble, the beam, the space sky and the note card look great. The canopy's black slab from the Lift and the lobby camera inside pillars don't. |
| Polish | 6.5 | No softlock in the Orbital. Wrong County miss line, banner overflow, the wrong "clear the sky" memo at the finale, and the checklist over the huddle. |
| One more shift | 6 | Endless opens with a loss to your own record, and the only new goal is a recolour every ~4 days. |
| Decision density | 6 | The County (spray or sweep, who bags) and the Orbital (who rides, when to buy the winch) offer choices. The Stadium mostly runs itself under the autopilot. |
| **Overall** | **7** | The story finally gives the ending a heart. Move its best card into the huddle, fix the County's message, and the late game is close to done. |
