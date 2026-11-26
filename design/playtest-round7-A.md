# Playtest round 7, playtester A: the MOW-E boss (Club day 3), MOW-E 2.0 (Stadium) and the Stadium's first days

Build e44e93e. Preview `rr-play-a` (:8094, 800×600).

**How I played**
- **Browser, solo.** I played two fights from saves loaded through `POST /api/dev/crew`:
  - Club day 3: `clubDay3()` from `boss.mjs`.
  - Stadium day 2 encore: `stadiumDay2()`, already tamed.
- **Stadium day 1.** I used Skip ahead (test) → "The Stadium · day 1".
- **How my Rat moved.** An in-page script drove it through `window.rr` (`?debug`): walk to the washer, grab the wand, stay in the rear arc, `pressAct` to spray or hold the plug.
  - The shared pane was hidden for most of the session, so rAF stalled.
  - While it was stalled, the script also sent `link.move` and the `wash` acts that the frame loop normally sends. That means the aim was perfect.
  - Screenshots come from the moments my tab was fronted.
- **Headless bots.** 2P and 4P (and more 1P) use `scripts/bots/boss.mjs`. I also used my own copy, `scripts/bots/pt7a-boss.mjs`, which adds:
  - where each Rat's fight time goes;
  - who lands the hits;
  - the crowd.
- **Seeds.** 7 / 11 / 23 (+31/41/53 for 2P) at both venues. I also ran 4-day runs for the pet, and `textload.mjs` (seed 7, 4P).

**Shots:** `design/shots/`
- `pt7-A-buildup.jpg`
- `pt7-A-harvest.jpg`
- `pt7-A-hunt.jpg`
- `pt7-A-scanpulse.jpg`
- `pt7-A-tamed.jpg`
- `pt7-A-encore-plug.jpg`
- `pt7-A-stadium-slab.jpg`
- `pt7-A-stadium-slab2.jpg`
- `pt7-A-stadium-two-texts.jpg`

## The numbers

**Club day 3** (3 seeds per policy; plus `boss.mjs all`)

| Crew | Wins | Fight (burst→tamed) | Plug lasts | Eaten (cap 30) | Payout / shift |
|---|---|---|---|---|---|
| 4P roles | 6/6 | 44–45 s | 0.8–0.9 s | 30, 30, 5, 30, 30, 8 | 10–20 % |
| 4P swarm | 6/6 | 43–45 s | 0.8–1.0 s | 30, 30, 7, 30, 29, 30 | 11–21 % |
| 3P | 3/3 | 40–43 s | – | 5–18 | 9–15 % |
| 2P | 8/9 | 39–49 s (the loss: 100 s cap, 2 hits) | 1.2–1.3 s | 0–17 | 5–11 % |
| 1P cart / chase | 6/6 + 6/6 | 48–74 s | 2.4–2.7 s | 2–30 | 4–16 % |
| Me, browser, solo, perfect aim | win | **32 s** (141→173) | ~2.4 s | 3 | "catcher: 6 balls home" |

**Stadium encore**

| Crew | Wins | Fight | Payout |
|---|---|---|---|
| 4P | 18/18 (my 6 + the 12 in the stock bot) | 56–67 s | 4–9 % of the shift |
| 2P | 3/4 (seed 23 lost, 2 hits) | – | – |
| 1P | 14/14 | 44–73 s | – |
| Me, solo, perfect aim | win | 31 s | – |

**Where 4P fight time goes** (`pt7a-boss.mjs`, Rat-seconds from burst to tamed)

| | Behind the grille, spraying into the **vent** (lands, does nothing) | Spray that counts | Being hunted | Elsewhere / driving / walking |
|---|---|---|---|---|
| Club 4P roles | 45–47 % | 4–5 % | 11–12 % | 35–40 % |
| Club 4P swarm | 57–67 % | 4–7 % | 12 % | 15–27 % |
| Stadium 4P | 35–53 % | 2–4 % | 12–15 % | 29–50 % |

**Who lands the hits at 4P** (4 HP; 5 at the Stadium)
- **Club:** `[3,1]`, `[1,2,1]`, `[1,2,1]`, `[2,2]`, `[2,2]`, `[3,1]`. In every 4P Club fight, one or two Rats never land a hit.
- **Stadium:** `[3,1,1]`, `[3,2]`, `[3,2]`, `[3,2]`, `[4,1]`, `[1,1,3]`.

**The pet**, days after a 4P Club win (seeds 7, 11):
- 6–10 balls a shift, in 1–2 passes;
- about 1–2 % of a shift's supply, against the council's 30–80 balls (3–6 %).

**Text load** (`textload.mjs`, 4P seed 7):
- Club #3 (the boss morning): 7.6 s, 1 item.
- Every promotion morning is ≤ 24.8 s and ≤ 3 items; no morning has two memos.
- The fight is at 126 s, after the tool's 120 s window. Counted by hand, it shows 6 centre items over ~50 s, one at a time, all ≤ 8 words:
  1. the rogue PA caption, 6 words;
  2. "loose", 8;
  3. "hunt", 7;
  4. "plug", 7;
  5. the STAMP, 2;
  6. the pond caption, 8.

## 1. Findings

1. **At 4P the fight is a cooldown timer, and the hosers' job is waiting (High, design).**
   - The 12 s vent at 4P (6 + 2 × 3) sets the pace. Hits land 12–13 s apart; the verbose seed-7 timeline has hits at 147, 160, 173 and 185 s. Every 4P Club fight lasts 43–45 s whatever the crew does.
   - Half to two-thirds of the hosers' time goes on spraying a shut grille. Only 4–7 % of their spray counts.
   - One or two Rats per 4P fight never land a hit. They are holding RT on a boss that can't be hurt.
   - Solo, the same rule makes the fight 31–32 s with good aim, faster than the 4P fight.
   - The fix is to change the shape of the vent rule, not the number (idea #1).
2. **The finisher is over in under a second at 4P (Medium).**
   - The plug takes 2.4 s ÷ min(3, holders), and the hosers already stand at its back. Plug → TAMED measured 0.8–1.0 s at 4P and 1.2–1.4 s at 2P.
   - The "everyone piles in" moment never forms: one Rat is holding before the others have read "Pull the plug!".
   - The 10 s reboot never fired in 40+ fights.
3. **"Let it eat or block it" isn't a decision at 4P (Medium, design).**
   - The catcher hit its cap of 30 in 8 of 12 4P Club fights, inside the ~18 s harvest, whatever the cart did. The 4p-swarm runs never block and the 4p-roles runs always do, and they ate the same.
   - A full catcher pushes the payout to 19–21 % of the shift, against the 8–12 % target. The Stadium's 4–9 % is fine.
4. **The win's payoff happens off-screen (Medium).**
   - My Club fight ended at about (−20, −24). Then:
     - MOW-E limps about 55 m to the pond at (−12, −78);
     - the gold balls arc down at the return, about 45 m the other way.
   - From where I stood after the STAMP (`pt7-A-tamed.jpg`), neither was in frame. I got the stamp, the feed line "MOW-E's catcher: 6 balls home." and, about 12 s later, the pond PA.
   - The best visual gag, the mower sinking nose-first, needs the player to turn round and look for it.
5. **The build-up is heard, not seen, from the usual spots (Low–Medium).**
   - At the warn I stood by the washer (36, 3), facing the field (`pt7-A-buildup.jpg`). On screen:
     - the PA card;
     - the Board, edge-on and unreadable;
     - no shed, and no striped lanes.
   - The shed is at (−58, 4), behind most Rats.
   - Nothing in the morning sets the boss day up: the boss-day memo has no tease. The boss loop only starts at the burst, and the warn has the beeps alone.
6. **Two centre texts at once on Stadium day 1 (Medium, owner rule).** The PA card "Your Ball Value is on a jumbotron." stayed up while the story card "The jumbotron plays a 1958 newsreel. By mistake." showed above it (`pt7-A-stadium-two-texts.jpg`).
7. **The black slab, confirmed (Medium, look).**
   - Stadium day 2 morning, first person at the mat: the deck canopy fills the top ~37 % of the frame (`pt7-A-stadium-slab.jpg`).
   - Stadium day 1: a black vertical bar cuts through the middle of the reveal camera for the whole intro, through Gary's card (`pt7-A-stadium-slab2.jpg`).
8. **The Stadium floodlights draw as black squares with grey discs (Low–Medium, look).** In `pt7-A-encore-plug.jpg` they look like a texture without alpha.
9. **The newsreel may play to nobody (Low confidence).**
   - The newsreel plays on the Board when the promo's first card shows. In my frames the reveal camera was looking at the path and the deck, not the Board, while that card was up. By the time the Board came into frame, the cards were over.
   - My pane was stalling rAF, so the timing may be off. Check it on the Xbox: is the Board in view during "The jumbotron plays a 1958 newsreel"?
10. **A hired helper was flattened during the harvest (Low).** The feed said "Tanner got knocked flat" ~2 s after the burst (`pt7-A-harvest.jpg`). `lookUntil` protects Rats from customer balls, but it looks as if helpers aren't covered.
11. **The 2P losses are fair but a bit random (Low).**
    - Both losses (Club seed 11, Stadium seed 23) were the hoser landing only 2 hits. At 2P the hoser is hunted 24–42 % of the fight, so they spend most of it running.
    - The loss is quiet, the rematch has HP −1, and two losses still tame him. That's fair.
    - "REMATCH TOMORROW" is only true if the crew is still at the Club tomorrow.
12. **Verified good:**
    - each phase shows one line, and a new phase's line replaces the last (the say key works);
    - the keyboard plug line says "Hold Space";
    - the hunted Rat's red screen edge plus the scan line are a clear threat with no text (`pt7-A-scanpulse.jpg`);
    - there was no Today modifier on either boss morning;
    - the encore crowd hook is in code: +0.08 a hit, 1.0 on a win, no drain while live.
13. **Not verified:**
    - **Sound.** The pane was hidden, so I couldn't hear the engine, the loop or the gurgle. They are wired in `mower.js`: the loop starts at the burst, stops dead on a win, and fades on a loss.
    - **A cart stall in the browser.**
    - **A 4P fight in the browser.**

## 2. The story

- **Rogue PA, "MOW-E updated itself. Please stand back."** Lands. The corporate-firmware joke is the right fiction.
- **"Now it hunts. Lead it into a cart!"** The best line: it tells you the threat and the counter in 7 words.
- **"Pull the plug! Hold Space at its back!"** Clear.
- **The MOW-E TAMED stamp.** Big, red and satisfying (`pt7-A-tamed.jpg`).
- **"MOW-E is in a better place. The pond."** Funny. It arrives ~12 s after the stamp, when the fight energy has gone and the sinking itself is out of frame.
- **"MOW-E mowed you. It has been trained on your movements."** It pays off the PA, but it's 10 words. It's a toast, so it doesn't count against the centre rule.
- **The encore, "MOW-E 2.0. The crowd is thrilled."** Fine. The jumbotron's HP bar wasn't readable at my distance.
- **Stadium day 1** is too dense:
  1. "Your Ball Value is on a jumbotron." (PA);
  2. the newsreel card;
  3. "Nice jumbotron. Don't get a big head." (Gary, a good line);
  4. "Site 13 sells tickets to its jumbotron." (a good line);
  5. a "Something glints in the Deep End" toast on the next morning, during the memo.

  That's four jumbotron jokes in ~20 s, and two of them overlapped.
- **Never seen:**
  - the "MOW-E is loose!" line and the burst: my pane was hidden at that second both times;
  - the next morning's "MOW-E sends his regards." (I didn't play the next day);
  - the loss Board in the browser.

## 3. Your stretch's fun

- **Best minute: the hunt.**
  - The screen edge pulses red, a red line runs from the mower to you, and the bass speeds up.
  - "Lead it into a cart" is a plan a sofa crew can shout.
  - For a few seconds it's a real chase.
- **Dead minute: the 4P harvest-to-hunt stretch.**
  - Three hosers stand at its back holding RT into a shut grille for 12 s at a time. The only feedback that it's shut is a dark grille.
  - Then the finish is a 0.8 s tap.
  - Solo, the dead part is the walk-back after it bolts.
- **The Stadium's first days** are the same as before: lap, ping, carry. The lit section "WE WANT A BALL!" gives a souvenir carry a target, but I didn't get a delivery in the browser. The encore is the loudest minute at the Stadium; everything around it coasts.

## 4. Top 5 improvement ideas (ranked)

1. **A per-Rat vent, more HP.**
   - Make the vent per hoser: the Rat who scored waits 8 s, and everyone else can still hit.
   - Raise 4P HP to 6–7 so the fight stays ~45 s.
   - Optionally, a hit needs 2 hosers on the grille at once at 3P+ (the bar fills only with two streams).
   - Why it's fun: every Rat lands hits, a missed hit is your fault and not the timer's, and the hosers co-ordinate ("both on it NOW").
2. **A plug tug-of-war.**
   - The pull takes a fixed 3 s of crew effort. It fills faster with more holders, but MOW-E drags the ring 1 m/s away from the shed, so the holders walk with it.
   - At 4P, let go and it snaps back a little.
   - Why it's fun: the finisher becomes the 3–4 s "everyone pile in" scrum the council wanted, not a 0.8 s tap.
3. **The payoff where the crew is.**
   - On TAMED, the catcher bursts on the spot: the balls fountain out where it died, and the gold balls land within 6 m of the plug ring.
   - Then MOW-E limps past the crew to the pond, with a 2 s look-at nudge (a screen-edge arrow).
   - Why it's fun: the reward is something you see and grab in the same breath as the stamp.
4. **A build-up you can see.**
   - The boss-day memo's second line teases it: "MOW-E is downloading an update. 87 %."
   - During the warn every Rat gets an amber screen-edge pulse toward the shed, and the boss loop's low drone starts at 0:15.
   - The Board faces the mats during the warn.
   - Why it's fun: dread before the burst is half of a boss moment, and right now the build-up is a card and some beeps you can't place.
5. **Make eating a choice, and make the pet worth having.**
   - Eat 1 ball per 0.6 s instead of everything within 3 m, so blocking early really does shrink the catcher.
   - Show the catcher count on the Board.
   - The pet should seek the richest spot, as the harvest does, and come to a whistle once a shift (Ⓨ at the shed).
   - Why it's fun: a real risk/reward call in phase 1, and the trophy you keep becomes a choice every shift instead of 6–10 invisible balls.

## 5. Scores

| Metric | Score | Why |
|---|---|---|
| Fun | 7 | The hunt and the stamp are great; at 4P too much of it is waiting on the vent |
| Clarity | 7.5 | One short line per phase, and the red edge and scan line explain the hunt with no text |
| Text load | 8 | The fight is one centre item at a time, all ≤ 8 words; Stadium day 1 overlapped two texts |
| Pacing | 6.5 | The 4P fight is fixed at 44 s by the vent; the plug is 0.8 s; the pond line comes 12 s late |
| Co-op | 6 | There are roles, but at 4P 1–2 Rats never land a hit; the plug is too fast to share |
| Meaningful features | 6.5 | The boss is meaningful; the pet (6–10 balls) and the eat-or-block choice aren't yet |
| Look & feel | 6.5 | Stamp, catcher bag, smoke and scan line are good; black slab, black-square floodlights, payoff off-screen |
| Polish | 6 | Overlapping centre texts, slab, helper knocked in the harvest; no softlock or stuck fight in 40+ runs |
| One more shift | 7 | Both fights make you want the next day; the encore gives the Stadium a reason |
| Decision density | 5.5 | In the fight: chase, sidestep, plug. The eat-or-block decision makes no difference at 4P |
| **Overall** | **6.5** | A real boss moment solo and at 2P; at 4P it needs a per-Rat vent and a longer finisher |
