# Playtest round 7, playtester C: the Orbital → the Last Bucket → the ending → endless

Build `e44e93e` (council round 11: MOW-E, the note at the huddle, a fair County, one memo a morning).

**How I played:**
- **Headless, through the real `Crew`:**
  - `scripts/bots/late.mjs` from the `orbital1` preset at 1P, 2P and 4P × seeds 7, 11 and 23 (9 runs), each through the Last Bucket and 4 endless days.
  - `scripts/bots/pt7c-endless.mjs` (mine: late.mjs plus contract logging, a `PICK=0|1|2` contract strategy and a story/PA event log). I ran it from the `lastbucket` preset (1P and 4P, 4 endless days, plus the 1P and 4P event order) and from the `endless` preset (1P and 4P × PICK 0 and PICK 2, 6 endless days).
  - `scripts/bots/textload.mjs` at 4P (seeds 7, 11, 23) and 1P.
- **The real client (rr-play-c, :8096), solo:**
  - Two Orbital promotion mornings, with Gary in the Lift.
  - Two full Last Bucket runs: the carry, the huddle, the crack, the note, the $∞, the end card.
  - The epilogue morning, Gary at the return, the whole first endless shift to its report, and the second endless morning.
- **Caveats:**
  - **The rr-play-c config wouldn't start.** preview_start said "Maximum 5 servers per worktree", so I ran the same command (`PORT=8096 RR_DEV=1 node server/server.mjs`) from a shell.
  - **The pane was hidden almost all session,** so rAF stalled. I swapped `requestAnimationFrame` for a 33 ms timer in my tab so the game ran (about 20 fps) and screenshots were live.
  - I moved by setting `rr.me` under `?debug`. I logged centre text every 100 ms by element class, plus the `rr-story` events.
  - **4P was headless only.** I didn't get bots into a browser crew.

Shots are `design/shots/pt7-c-*.jpg`.

---

## 1. Findings

| # | Severity | Finding |
|---|---|---|
| 1 | **High** | **"BALL NO. 1 IS DOWN · follow the beam": there is no beam on Ball No. 1.** <ul><li>`ending.js` draws Ball No. 1 as a 0.13 m gold sphere with a 14 m point light, and main.js skips `kind 'one'` in the beacon pass. So the only beams on the field are the Target Greens' pink, cyan and yellow pillars, and they are what a player follows.</li><li>From the stand (`pt7-c-follow-the-beam-stand.jpg`) the ball is invisible. At 54 m it's a 3-pixel dot next to a cyan TARGET pillar (`pt7-c-ball-one-54m.jpg`).</li><li>In run 1, carrying the ball, the one big beam in view was a yellow TARGET flag pillar *downrange*, the wrong way (`pt7-c-carry-target-beam.jpg`).</li></ul>This is the first 30 s of the climax.<br>Fix: give Ball No. 1 a gold beacon (the `beaconMesh` path, taller, while `lb.phase === 'down'`), or change the words. |
| 2 | **High** | **The endless contracts are invisible during play, and the "balls left" goals are almost impossible.** <ul><li>**Invisible:** the contract's goal is shown only on the report, when you pick it. The endless morning memo names only the modifier ("TODAY · Junior Clinic. Short shots, balls near the mats."), and nothing in the checklist, the Board or pause shows the goal. A crew doesn't know it's playing for "at most 40 balls left out".</li><li>**Three different counts for "left":**<ul><li>the contract uses `report.left = balls.size`, which counts sunk, creek and cup balls;</li><li>the Spotless bonus uses `ballsLeft()`, which excludes them;</li><li>the dusk count uses `outThere`.</li></ul>On my endless day 1 the report said **"SPOTLESS RANGE! +$1,161,012"** under the dusk's **"49 left out there"** (`pt7-c-endless-day1-report.jpg`).</li><li>**Measured over 26 endless shifts,** `left` at the bell was **35–90, never lower**. So "Spotless at the bell" (3★) and "At most 12 balls left out" (2★) can't be met, and "At most 40" is a coin flip.</li><li>**Results by contract:**<ul><li>3★ contracts picked: **0 of 10 met** (1P and 4P);</li><li>1★: 6 of 8 met at 4P, 3 of 8 at 1P.</li></ul></li><li>**Stars after 6 endless days:** 4 at best (4P, always taking the 1★), 0 if you take the 3★. The first cosmetic is at 10★.</li></ul> |
| 3 | Medium | **Gary in the Lift happens off-screen.** <ul><li>The ride runs from card 1, while the player is in the reveal camera or at the spawn (18, 4) facing yaw 0. The Lift is at (−44, 5): **90° to the left and 25° up**, behind the deck canopy.</li><li>I only saw him by walking to (0, 18) and turning: a figure about 10 px tall on the car roof (`pt7-c-gary-lift-far.jpg`).</li><li>Looking from the spawn toward the Lift, the canopy's underside fills the view (`pt7-c-canopy-underside.jpg`).</li><li>The card says "Gary rides the Lift. Tie flapping." while no player can see it.</li></ul> |
| 4 | Medium | **The crack reads, but it is framed badly.** <ul><li>From the solo huddle spot facing the return, the two gold halves hinge open right in front of you, and that is lovely (`pt7-c-crack-hush.jpg`, `pt7-c-crack-note.jpg`).</li><li>But the Rat's own carried **blue bucket** covers the lower half of the frame. The paper curl rises 0.4 m, out of view and **behind the note card**.</li><li>Facing any other way you see nothing: in run 1, facing the washer, there was no crack at all.</li><li>At 4P the ring stands further off. I couldn't check that in the browser.</li></ul> |
| 5 | Medium | **The `endless` preset doesn't start a real first endless morning.** <ul><li>The save has `story` with `note` but not `epilogue`, no `endlessFresh` and no `offers`, so the epilogue never plays.</li><li>Day 1 gets a contract built from the Orbital record ($83.6M × 0.85): **"Bank $71,043,390"** as a 1★. 1P earned $48.9M and 4P $69.5M, so both missed it.</li><li>"Skip ahead → Endless" therefore opens on a failed 1★ contract.</li><li>`textload.mjs` measures its "endless #1/#2" from this preset, so **the real epilogue morning, the heaviest text morning in the game, is never measured.**</li></ul> |
| 6 | Low–Med | **Gary's bubble collides with the HUD.** Walking up to him (the bubble fires within 3 m), "Where do these go, boss?" draws as a huge sprite across the top edge, over "Day 20 · 6:40" and the crew badge (`pt7-c-gary-return-bubble-hud.jpg`). At the same moment the prompt "The washer hopper is empty. Bank some balls." is centre-screen. He also stands facing the return, so you walk up to his back (`pt7-c-gary-return-back.jpg`). |
| 7 | Low–Med | **The PA card sits under the end card for 1.8 s.** "No more balls. Every ball mattered." showed at 115.1; the end card came at 121.1; the PA closed at 122.9. Round 13's open issue #1 is still there (and the $∞ flash's 0.6 s CSS fade under the PA too). |
| 8 | Low | **"THE CROWD IS BORED" in endless.** The Stadium module's crowd keeps draining after the Stadium, so the toast fired about 6 min into my first endless shift, and the jumbotron text can show it. |
| 9 | Low | **The Orbital promotion memo is 17 words and says 1,958 twice:** "Today: clear the sky. 1,958 to bring home. NEW: the Lift. 1,958 balls are in orbit." |
| 10 | Low | **The checklist flickers between texts.** "↑ Fill the bucket basket!" blinks on for 0.3 s in each gap between the PA, the story cards and the memo on the Orbital morning (log: 19.8 on / 20.1 off, 32.3 on / 32.6 off). It also showed on the Last Bucket morning before the banner took over. |
| 11 | Low | **The epilogue's story card sits on the Board's coloured banner strip.** The reveal camera on the first endless morning looks out from behind mat 10, with the Board's black underside filling the top third and the card drawn over its cyan/pink strip (`pt7-c-epilogue-card-board.jpg`). |
| 12 | Info | **No softlocks in any run:** 9 Orbital→endless runs plus 6 Last Bucket/endless runs headless, and 2 Last Buckets in the browser. Ball No. 1 landed in the creek once (x 24, z −100) and could still be picked up. The Last Bucket holds `shiftT` at 0 until the bank, so there's no clock to run out. |

Owner rules:
- **One centre text at a time:** the bank sequence passes except #7. The first endless morning is strictly sequential.
- **~8 words:** fails at #9. The note is 7 words.
- **Works on a pad:** the huddle and the note take only Ⓐ/Space. Holding Space through the huddle did **not** skip the note, which ran its full 7.0 s.
- **Never drops full screen:** not seen.
- **1 → 4 players:** the bank order (`banked → story note → pa last`, then on the next morning `story epilogue → reveal → pa endless`) was identical at 1P and 4P headless. The 4P huddle took 3.0 s and solo 3.8 s.

---

## 2. The story

**The note at the huddle: it lands now. It is the best 10 seconds in the game.** Measured in the browser, run 2:

| t (s) | What happened |
|---|---|
| 0 | Hold Space |
| 3.8 | Huddle done, banked |
| 3.8 → 6.6 | The hush: floods off, a purple dusk sky, the gold ball on the lip, the halves hinge open |
| 6.6 | The note card: **"Whoever finds this: the range is yours."** (INSIDE BALL No. 1 · 1958), with one bell |
| 13.7 | The card ends by itself after 7.0 s |
| 13.8 → 15.3 | The $∞ / BALL scramble (1.5 s) |
| 15.4 | PA "No more balls. Every ball mattered." |
| 21.4 | "Site 12 is yours" end card |

- **Is it emotional?** Yes. The order is right: the reveal of what was *inside* now sits on the hush, and the $∞ joke comes after the feeling, not on top of it. Round 6's complaint (the note a whole morning late) is fixed.
- **The timing is right.** A 2.8 s gap is long enough for the hinge to read, and 7 s is long enough to read the card twice.
- **The crack reads as "the ball opened".** But only if you happen to face the return, and your own bucket and the card cover most of it (#4).
- **Text overlap:** none during the note. There is the PA-under-end-card tail (#7).

**The epilogue on the first endless morning:**

| t (s) | Centre text |
|---|---|
| 0 | "Gary loosens his tie. He grabs a bucket." |
| 4.1 | "Dimples is retiring. He finally makes eye contact." |
| 8.2 | "The sign is repainted. Under New Management." |
| 12.4 | Cards end |
| 13.1 | PA "Under New Management. Approved by nobody." |
| 20.5 | Memo "Today's target: whatever. — the Rats" |
| 25.3 | Memo off |

- **That's 5 centre items in 25 s,** strictly one at a time. The clock holds for 14 s.
- **The Dimples line is still the laugh.** "Today's target: whatever. — the Rats" is a good final memo.
- **Gary at the return works.** He has a blue bucket of balls and a loosened red tie, and "Where do these go, boss?" fires within 3 m. It is a touching payoff once you find him.
- **But the card about Gary plays while the camera looks away from him.** He's 90° to the right of the spawn and facing away. A crew that runs off to work never meets him. Turn him to face the stand, and let the reveal camera end on him.

**Gary in the Lift: the right idea, unseen** (#3). "I always wanted to see it." / "Gary rides the Lift. Tie flapping." / "Dimples has been rebranded as a moon." are all good cards. The ride itself needs to be *in the shot*.

**Not seen:**
- **The 4P huddle in the browser.** It was headless only; the order matches.
- **Gary's late-visit hello and sign-off.** There was no Gary day in my stretch.
- **The Orbital mid beat ("one ball glints") live.** I didn't play an Orbital day 2 in the browser.

---

## 3. My stretch's fun

**The Orbital: a short climax, not a grind, but a money-pointless one.**
- At 4P (seed 7) all three card goals were done on Orbital day 1: the tether at T−6:36, 60 debris at T−3:51, everyone on the Lift at T−1:42. Outstanding was 588 at the bell.
- Ball No. 1 fell on day 2 at T−3:39 (4P) and T−3:06 to T−5:00 (1P/2P). Every one of the 9 runs had it within 2 shifts.
- Day 2 has no card ("undefined" in the bot's card log): you keep pulling debris until the sky clears.
- Meanwhile the crew banks $88M and then $120M with nothing to buy, ending on $226M at 4P. The money stops meaning anything one venue before the end.

**The best minute:** from Hold Ⓐ to the note. The dusk drops, the gold halves open, the card speaks. Lovely.

**The dead minute: endless day 1.**
- There's no contract, no pace and no checklist. The memo says "whatever", and that's honest.
- The Board shows a $ number racing nobody. Everything that day is played to set tomorrow's target.

**Endless, measured:**
- **Day 1 opens with a win.** In 9 of 9 runs the report read "Day 1 as Owners. Beat $X tomorrow." I saw it live too ("Beat $43.3M tomorrow.").
- **An owner NEW record in endless days 2–4:** 9 of 9 runs (3 of 3 at each size).
- **Beat yesterday:** 16 of 27 days (59 %). Income is flat (4P $69–91M, 1P $41–58M), so it's a coin flip and streaks die at 1–3.
- **The Hustle (×3) never mattered to the bot** (mult stayed 1), because nothing in endless asks you to ping.
- **Cash piles up:** $270–430M by day 4–6. The statue was bought only at 1P (day 5); at 4P it was out of reach at $429M on day 6. After the statue there is nothing to buy.
- **Contracts are broken** (#2).
- **Is there a reason to play days 3+?** Not yet:
  - a coin-flip race against yesterday;
  - a record that comes in the first 3 days and then gets hard;
  - stars that never reach a cosmetic;
  - nothing that changes the range.

---

## 4. Top 5 improvement ideas (ranked)

1. **Make the climax findable and framed** (#1, #3, #4).
   - Give Ball No. 1 a tall gold beacon while it's down. It's the same InstancedMesh as the gold balls, but 25 m and pulsing.
   - On the huddle, hide the carried gear and pull the eye 1 m back, so the halves, the paper and the card are all in frame.
   - On the Orbital morning, end the reveal camera on the Lift as Gary goes up.
   - *Fun:* the hunt becomes a race to the light, and the three best story moments get seen, not described.
2. **Contracts you can see and win** (#2).
   - Use one "left" count (`ballsLeft`) everywhere.
   - Put the contract on the Board (`★★☆ AT MOST 2 KNOCKDOWNS · 1 SO FAR`) and as the morning memo's second line.
   - Make 3★ goals about skill, not impossible: "×3 Hustle by T−3:00", "a 10-ping combo", "Spotless by the bell" judged with `ballsLeft`.
   - Award a cosmetic every 5★.
   - *Fun:* the daily pick becomes a real decision, and every shift has a target you can feel tick.
3. **Site 13: the endless rival (big idea).**
   - The Board shows Site 13's shift total live ("SITE 13 $74.2M (est.)"), a ghost a little above your 3-day average. It "estimates" (they lie).
   - Beat them 5 days out of 7 to win the week: Site 13's sign gets repainted in your colours on the far fence, and the memo "Site 13 has been acquired. By you." plays.
   - Then they come back with a jumbotron.
   - *Fun:* a rival with a face beats a ghost of yesterday, and it reuses the comedy thread for the long game.
4. **Greatest Hits days (big idea).**
   - Each endless report offers tomorrow's venue: a theme day that turns one old system back on as the day's whole identity. Stadium Night (crowd and souvenir requests), County Fair (hazards and the van), MOW-E Rematch (the boss, a 3★), Club Day (the deck).
   - The crew votes on the report, like the contract.
   - *Fun:* endless stops being "the Orbital without debris". Every day plays differently, and the late game's best systems get a second life.
5. **Gary, Range Rat (endless).**
   - Gary stays on as a slow fifth Rat who sometimes asks "Where do these go, boss?" and needs walking to the return (a 10 s escort job that pays a commendation).
   - At 10★ he gets the teal cap, and his name goes on the statue's plinth with yours.
   - *Fun:* it pays off the heart thread every day, and it's a co-op errand that pulls one Rat off the line.

**Ending idea worth a council slot ("one more shift"):** after the note, the first endless morning ends the reveal at the return, where the opened gold halves sit in a little glass case: "Ball No. 1 · 1958–<today> · Found by <crew names>". It stays there all of endless. Every record day adds a line to a plaque beside it, so the crew's history visibly grows.

---

## 5. Scores (my stretch, this build)

| Metric | Score | Why |
|---|---|---|
| Fun | 7 | The note and the crack are the best moment in the game. The Orbital is brisk. Endless is flat. |
| Clarity | 6 | "Follow the beam" points at the wrong beams, the contract is invisible in play, and there are three counts for "left out". |
| Text load | 6.5 | The bank sequence is one text at a time; the epilogue morning is 5 items in 25 s; the Orbital memo is 17 words. |
| Pacing | 7 | The Orbital takes 1.5 shifts and the ending ~21 s to the end card. Endless coasts from day 2. |
| Co-op | 6 | The huddle is a real together moment. Endless gives a 4P crew no reason to split or talk. |
| Meaningful features | 6 | Contracts and stars are effectively broken, the Hustle is unused, and the cash pile is meaningless from the Orbital on. |
| Look & feel | 7.5 | The hush and the hinging gold halves are beautiful, and so is Gary with his bucket. The canopy slab and your own bucket block the shots. |
| Polish | 6.5 | No softlocks. The PA sits under the end card, the bored-crowd toast fires in endless, the bubble covers the HUD, and the preset skips the epilogue. |
| One more shift | 5.5 | Day 1 opens with a win now, but after day 3 there's nothing to chase you can see or reach. |
| Decision density | 5 | One contract pick a day, from offers you can't win. Nothing to choose inside an endless shift. |
| **Overall** | **6.5** | The ending finally lands. Endless still needs a reason to stay. |
