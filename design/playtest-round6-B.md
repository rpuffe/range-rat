# Playtest round 6, tester B: the Club → Tiered → the Stadium's first morning

Build `52af0c2` (round 12 story beats). Preview `rr-play-b` (:8095).

**How I played**
- **Bots.** I copied `scripts/bots/mid.mjs` to `scripts/bots/pt6b-mid.mjs` and added counters for MOW-E (warn/drive/done, balls raked, knockdowns), the story ids and the morning text events. One fix: the bot looked for the old `hotdogs` goal id, now `fed`. Without that fix the solo bot sat at FED 179/180 for 30 shifts, which is a bot artefact, not a game bug.
  - Runs from `club1.save` at 4P (seeds 7 and 11), 2P (naive, and `GOAL2P=1`) and 1P.
  - I also snapped the 4P seed-11 run's mornings (`SNAP_FILE`) and loaded them through `/api/dev/crew`. That put the real client on Club day 2, Club day 3 (MOW-E's first day), Tiered day 2, and the Stadium reveal morning with a carried-over crew.
- **Client.** I joined the Club and Tiered from Skip ahead, plus the four snapped mornings.
  - A logger polled `#story-card`, `#pa-card`, `#memo`, `#toast` and `#feed` every 150 ms, so the morning timings below are measured.
  - The shared pane was often hidden (other testers' tabs were in front). Screenshots are from the windows when mine was fronted.
- **Shots:** `design/shots/pt6-b-tiered-bay.jpg`, `pt6-b-mowe-warn.jpg`, `pt6-b-mowe-drive-unseen.jpg`, `pt6-b-newsreel-card.jpg`, `pt6-b-newsreel-jumbotron.jpg`.

## 1. Findings

| # | Finding | Repro / evidence | Severity |
|---|---|---|---|
| 1 | **MOW-E barely exists.** In 65 bot passes it raked a mean of **11.7 balls** (range 4–22) against about 400 banked a shift, which is ~3%. It moves those balls only **2.4 m**. It knocked down a Rat **2 times in 65 passes**, and the bots don't even try to dodge. It runs at exactly 1:45 into every shift (shiftT 105 s), on the same lanes (−36 / −120 every other day). | pt6b-mid at 1P, 2P and 4P, the `raked` / `mowKd` columns | Design: high (the owner's note is right) |
| 2 | **MOW-E is invisible from where the crew works.** At Tiered it mowed "the Tractor" (z −120). From the bays the warn toast showed ("MOW-E mows the Tractor in 12 s. Move!"), but during the drive no mower was in view: no sound I could judge, no clippings, nothing. No line marks "done", and the mower just parks at x +64. | `pt6-b-mowe-warn.jpg` then `pt6-b-mowe-drive-unseen.jpg`, 5 s apart | Med |
| 3 | **On MOW-E's first day, its PA hides the actionable warning.** The `mower` event queues an ALERT ("…in 12 s. Move!") and then the PA. The PA outranks the ALERT, so it shows first for 6.6 s ("A robot mower. Trained on your movements."). The "12 s" alert then appears at 7.0 s, with 5 s actually left. In the browser on Club day 3 I saw the PA but never caught the ALERT, though the hidden pane may explain that. | Node replay of `createSayModel`: `0.00 PA` → `7.00 ALERT … in 12 s` | Low-Med |
| 4 | **The Stadium Board's headline number is almost always scrambled.** It showed `$V,&W3`, `$V,WBT`, `$1,P7T` and `$1,01D a ball` in 4 of 5 screenshots. The board.js flip restarts on every BV change, and at the Stadium BV changes constantly. The HUD read `$1,094 a ball` correctly. | Stadium day 1, any screenshot of the jumbotron (`pt6-b-newsreel-jumbotron.jpg`) | Med (the Board is the venue's centrepiece) |
| 5 | **The newsreel beat says the jumbotron plays a 1958 newsreel, but it doesn't.** The card is a text caption, and right beside it the real jumbotron keeps showing Ball Value. This is the best chance in the game for a *shown* story beat, and it is told instead. | `pt6-b-newsreel-card.jpg` | Med (missed moment) |
| 6 | **Club day 3 is five ideas at once.** The creek dive, the Back return, MOW-E and the super-bouncy ball open, and the splitter debuts too. Two NEW memos run back to back (splitter, then bouncy), and MOW-E's PA follows at 1:45. The owner's rule is one idea a day. The creek dive and MOW-E get no memo at all. | Club day 3 morning log: memo 7.7 s → PA 15.0 s → memo 21.0 s → memo 26.4 s | Low-Med |
| 7 | **Dead days are still there.** 4P seed 11: no goal completes on Club days 4–5; the crew only saves up the fee. 4P seed 7 and solo: the card waits on Gary's Seal until **Club day 7** (fee done on day 4–6), because the Seal needs a huddle and the card row says only "Earn Gary's Seal". Tiered day 2 at 4P: no goal lands. | Summary `goalVd`: `v1d1:fed v1d3:treasures v1d3:reviews v1d7:seal` (4P s7 and 1P) | Med (pacing) |
| 8 | Every helper fall goes to the feed ("Madison got knocked flat"), one every 20–40 s for the whole shift. That's noise beside the story. | Feed log, Tiered and Stadium | Low |
| 9 | The lobby tagline is the Muni's at every venue: "Pick up balls. Bank them. Hit the target." | Lobby at Club day 3, Tiered, Stadium | Low |

What I didn't see:
- Gary's world-bubble hello and feed sign-off. No Gary verdict finished while my pane was in front.
- The Stadium mid beat, which is outside my stretch.

The owner rules held:
- One centre text at a time was always true in the logs.
- The story card never touched full screen.
- Esc/Space were not exercised on a pad.

## 2. The story (Club → Tiered → Stadium)

**Measured promotion mornings** (sim running, card auto-advancing every 4 s):

| Morning | Sequence | Free of centre text at |
|---|---|---|
| Club day 1 (promo) | PA 7 s → 3 cards 12 s → square-ball PA 6.6 s → Today memo 7 s → NEW memo 5 s | ~50 s |
| Club day 2 (mid) | 3 cards 12 s → lead PA 6.4 s → memo 7 s → NEW memo | ~37 s |
| Tiered day 1 (promo) | PA 5 s → 3 cards 12 s → memo 7 s | ~30 s |
| Tiered day 2 (mid) | 3 cards 12 s → memo 7 s | ~22 s |
| Stadium day 1 (promo) | PA 7 s → 3 cards 12 s → memo 7 s | ~34 s |

The beat itself is fine at 12 s. It's the stacking with NEW memos that makes the Club mornings long. 50 s is 12% of a 7-minute shift. The sim runs underneath, so it doesn't block play, but nobody reads a memo while they're working.

**Did the beats land?**
- **Club promo.** It works. *"The Club. I raked this pond once."* is a perfect first hint, and it pays off the next morning when the trophy glints ("Engraved: GARY") and Gary says *"Don't dive the north end. Just don't."* That line comes on Club day 2, the day the pond opens, which is great timing. *"Dimples now wears a monocle. For the members."* gets a laugh.
- **Club mid.** *"Site 13's fries are crispier. We checked."* is the best Site 13 line in my stretch: specific and petty.
- **Tiered promo (the 1987 tape).** *"Dimples is now dimpl. Lowercase. Experiential."* is the funniest card in the game. The tape itself is two plain captions ("Corporate archive: Ball Retrieval Training, 1987." / "The Rat on the tape looks like Gary."). It reads, but it's *told*.
- **Tiered mid.** *"That tape is not me. Watch your bays."* is Gary's best line. The denial is the comedy and the heart at once. *"Site 13 reports 140% Bay Utilization." / "Corporate did not know that was possible."* lands as a two-beat joke.
- **Stadium promo (the newsreel).** It reads, but it falls flat because the jumbotron is *right there* showing Ball Value (finding 5). *"Site 13 has two jumbotrons. Do better."* is the weakest Site 13 line: it's the same joke as the Club's.
- **Gary's turn, tyrant to ally.** It half reads.
  - The cards carry the secret well: raked the pond, avoids the north end, denies the tape.
  - But his softening lives in his visit lines, the bubble and the feed. Those are the lowest-attention text in the game, and Gary comes 1–2 days a venue.
  - His Club sign-off is already warm ("Not bad. Don't tell Regional."), so the turn is front-loaded.
  - From Tiered to the Stadium his only *card* is the denial, and the Stadium promo has no Gary card at all.
  - On the cards alone, a player sees "Gary has a secret", not "Gary is coming round". The ally half needs one card in my stretch, e.g. Stadium promo: GARY *"Nice jumbotron. Don't let it go to your head."*
- **Site 13 / Dimples.** The comedy lands; Dimples' rebrands are the stronger thread.

## 3. Best minute / dead minute

- **Best:** Tiered day 1's first minute. "Please be experiential." → "dimpl. Lowercase." → straight into a shift worth $585k with targets popping (37 targets at 4P, the first at 0:36). Then Club day 2: Gary's north-end line, and the trophy glint in the feed 3 s later.
- **Dead:** Club days 4–5 at 4P (no goal lands; the crew saves $110k), and Club days 4–6 for a crew that doesn't know the Seal needs a huddle. MOW-E's 1:45 slot ought to liven that dead middle, and it doesn't (findings 1 and 2).

**Pace (bots playing the card).**
- 4P: Club 5–7 shifts, Tiered 3 (38–53 min to Tiered, 60–75 min to the Stadium).
- Goal-aware 2P: 5 / 3 (60 min).
- Naive 2P: 5 / 10, stuck on deck orders 1/15, as in round 5.
- Solo: 7 / 4.

## 4. MOW-E: what it is now, and the boss pitch (owner: "make it a big deal, like a boss moment")

**Now:** a 12 s warning, then a 32 s drive down one far lane. It nudges about 12 balls 2.4 m and almost never touches a Rat. Every day it's the same time and nearly the same lane. It has no beginning or end the crew can see, and no reward. It is scenery with a toast.

**The pitch: "MOW-E Goes Rogue."** It happens once per venue, Club day 3 (its debut) and Tiered day 2, and stays the plain daily mower after that. It's built on what already exists:
- `mowe.js`'s phases and lanes;
- `pickLane` (it already hunts the richest lane);
- `CART_STOP` (it already stops and honks at a cart);
- `knockDown('mower')`, the huddle's "hold Use together" ring, the wand, the Board's countdown line, and `say` ALERT and STAMP.

**Build-up (30 s, replaces the 12 s warn).**
- The Board reads `MOW-E · FIRMWARE UPDATE · 0:30`.
- The shed doors rattle, the beacon goes red, and the PA says *"Corporate has pushed an update to MOW-E."*
- Cones drop on **three** lanes, not one.
- One ALERT: *"MOW-E is coming. Get to the shed!"*
- Sound: the mower horn's two beeps repeat and speed up through the countdown (`horn('mower')` on a shrinking interval). The cart engine synth (`cartEngine`, `engineParams`) on MOW-E's position climbs in pitch with its speed.

**Phase 1, the Sweep (~40 s).** MOW-E mows its three richest lanes back to back at 1.5× speed, raking a real windrow: every ball within ±4 m, not ±2 m.
- The windrow balls are **Fresh Cut**, worth ×2 while they glint (30 s).
- So the crew's job is to *chase it*: pick up behind it while dodging its front.
- 4P: two Rats run the windrow and two keep the stand and kitchen going.
- Solo: the windrow is the money; you trail it.

**Phase 2, the Chase (~30 s).**
- Its bag is full and it turns on the nearest Rat. This is the same chase targeting as Gary's cart (re-aim each tick at the closest non-aloft Rat), at walking pace plus 10%, so sprinting outruns it.
- A knockdown spills that Rat's pocket into its catcher.
- To stop it, **park a cart in its path**. `CART_STOP` already freezes it with a honk. While it's stuck (5 s), a Rat runs behind it to the **kill switch** (hold Use, like the huddle ring).
  - 4P: one Rat drives the cart, one baits, two go for the switch, and the hold is faster with two.
  - Solo: bait it into the pond's edge or the creek bank (`map.inCreekWater`). It bogs down for 6 s, and you hold the switch alone (3 s).

**Phase 3, the Dump.** The switch pops the catcher.
- Every ball it raked or stole fountains out at the stand: the confetti pool plus the rake event, auto-banked at ×2.
- STAMP: **MOW-E WRANGLED**. Award *MOW-E Wrangler*. Gary, if he's on site: *"Off the record? That was something."*
- If the crew fails (the bell comes first, or it knocks everyone down), it returns to its shed with its catcher. Its balls are lost, and it gets a MEMO: *"MOW-E has been named Employee of the Month."*

**After the boss.** A wrangled MOW-E is **tamed**: from then on, its daily pass rakes its lane *toward the stand* (z offset toward the mats grows from 2.4 m to ~15 m). That makes it a real helper, and the boss pays out every day.

**Size:** M. Most of the server is `stepMower` growing a phase list. The client needs the Board line, the speed-tied beeps, a catcher mesh that visibly fills, and the fountain.

## 5. Top 5 improvement ideas (ranked)

1. **MOW-E Goes Rogue** (section 4). It turns the one scripted mover after Gary into the Club's signature moment, and it gives the dead middle of the Club a reason to shout. The tamed helper afterwards makes it *meaningful*, not just loud. (M)
2. **Play the newsreel on the jumbotron.** For the Stadium promo beat, swap the Board's canvas for 10 s: sepia, a little founder swinging, the camera panning up into empty sky. The two captions then sit *under* a picture. "Shown, not told", in the one place the venue already has a screen. Do the 1987 tape the same way on Tiered's Deck Cam monitor if there is one. (S–M)
3. **Fold the NEW memos into the morning card.** On promotion and debut mornings, the morning memo carries the debut as one extra line instead of separate NEW memos. Move the Club day 3 splitter or bouncy debut to day 4. That cuts the Club mornings from ~50 s to ~30 s of centre text, and keeps the owner's one-idea-a-day rule. (S)
4. **Give Gary's turn a card in my stretch, and lift his sign-off out of the feed.**
   - Add a Gary card to the Stadium promo (*"Nice jumbotron. Don't let it go to your head."*).
   - Show his venue sign-off as the verdict line on the report card, where everyone reads it.
   - Then the ally half of the arc is seen, not buried in the feed. (XS)
5. **Close the Board flip and the dead days.**
   - Don't restart the Board flip while one is running, and only flip on a change of ≥1%. That way the Stadium's hero number is readable (finding 4).
   - Make the Seal row say *"Earn Gary's Seal: huddle at the stand"*, so the card doesn't stall to day 7.
   - Both are small, and both remove a reason to stand around. (XS)

## 6. Scores

| Metric | Score | Why |
|---|---|---|
| Fun | 7 | The Tiered opening and the Club pond days are good. MOW-E adds nothing, and the Club days 4–6 sag. |
| Clarity | 7 | The cards and goals read. The Seal row hides that it needs a huddle, and MOW-E's warn names a lane nobody can see. |
| Text load | 6.5 | One at a time holds, but Club mornings run ~50 s of centre text (PA, 3 cards, PA, 2 memos). |
| Pacing | 6.5 | 4P is Club 5–7 / Tiered 3. 2–3 dead Club days; a promotion morning is ~30–50 s before the crew is free. |
| Co-op | 7 | Kitchen, field and diver split naturally. Naive 2P still stalls on deck orders (Tiered took 10 shifts). |
| Meaningful features | 6 | MOW-E is filler as built: 12 balls, 2 knockdowns in 65 passes. |
| Look & feel | 7.5 | The Stadium reveal and the story cards' styles look great. The Board scramble and an unseen mower hurt. |
| Polish | 6.5 | The Board scramble, the stale "12 s" alert, the feed spam, the Muni tagline everywhere. |
| One more shift | 7 | The story pulls you to the next venue ("That tape is not me" makes you want the County). |
| Decision density | 5.5 | On dead Club days the only choice is "keep doing it". MOW-E asks for no decision. |
| **Overall** | **7** | A solid mid-game with a story that now has jokes and a secret. It needs one showpiece moment, and MOW-E is the obvious candidate. |
