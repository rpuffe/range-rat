# Playtest round 8, playtester A: a new crew's first night (Muni day 1 → the Range Club → MOW-E on Club day 3)

Build 966eace. Preview `rr-play-a` (:8094, 800×600, `?debug`).

**How I played**
- **Browser, solo.** I made a real new crew and played Muni days 1–2: the cold open, the checklist, the day-1 report and shop, and the mid beat.
- **Dev saves.** I used `POST /api/dev/crew` for:
  - a Muni day-4 Gary day;
  - Skip ahead → Range Club day 1 (the promotion beat);
  - a Club day-3 save (`clubDay3()`'s shape). I played the boss fight there, lost it, then won the day-8 rematch.
- **How my Rat moved.** The shared pane was hidden most of the time (rAF ran at about 1 fps, even when I fronted my tab). So an in-page script moved my Rat:
  - it sent `link.move`, `act`, `interact` and `wash` itself;
  - during the fight it sprayed only from behind, on 65 % of ticks.
- **What I logged.** A DOM poller logged every centre text with the shift clock. All the timings below come from it.
- **Headless.**
  - `muni.mjs` at 1P / 2P / 4P (seeds 7, 11, 23; 1P also with `chat prep`).
  - `mid.mjs` at 1P / 2P / 4P (seeds 7, 11).
  - `boss.mjs all` (also with `SOFA=1`), and `textload.mjs 7 4`.
- **My preload, `scripts/bots/pt8a-tap.mjs`.** It is read-only and counts **calls**, merged within 8 s:
  - special balls coming to rest;
  - a fixture crossing 0.5 mud;
  - the basket under 25 %;
  - the fryer under 50 %;
  - rally/last-call needs;
  - Gary's warn;
  - creek snags;
  - boss phases.
  - Run it as `node --import ./scripts/bots/pt8a-tap.mjs scripts/bots/muni.mjs 4 7`.
- **What I didn't do.** I didn't play 2P or 4P in the browser. It's one tab per tester, and the stalled pane made it impractical. The 2P and 4P numbers are from the bots.

**Shots** (`design/shots/`):
- `pt8-A-cold-open.jpg`
- `pt8-A-day1-report.jpg`
- `pt8-A-no-basket-alarm.jpg`
- `pt8-A-club-reveal.jpg`
- `pt8-A-boss-warn.jpg`
- `pt8-A-boss-loose.jpg`
- `pt8-A-boss-harvest.jpg`
- `pt8-A-boss-hunt.jpg`
- `pt8-A-boss-plug.jpg`
- `pt8-A-boss-after-tame.jpg`
- `pt8-A-boss-loss-report.jpg`

## The numbers

**Shifts per venue (bots, to the card done)**

| Crew | Muni | Club | Boss reached at (shift-minutes, excluding reports) |
|---|---|---|---|
| 1P (`chat prep`) | 5 (31 min) | 5 (seed 7) | ~47 min |
| 2P | 4–5 (24–31 min) | 6 | ~40–47 min |
| 4P | 4 (24 min) | 5–6 | ~40 min |

- The boss lands inside the first hour at every crew size.
- **At the Muni, "Bank 800 balls" is the 1P binding goal (day 5).** At 2P and 4P everything closes on day 4.
- **1P without prep never leaves the Muni.** The plain 1P `muni.mjs` (no `prep`) failed Gary 3–4 checks every day for 14 days. That's a bot artefact: it stays in the cart at the warn. With `prep` it passes on day 4 every seed.
- **Where Muni time goes** (4P / 1P-prep):
  - seek 41 % / 34 %;
  - carry 29 % / 16 %;
  - hose 7 % / 13 %;
  - drive 10 % / 26 %;
  - fill 2 % / 5 %.
  - The Muni is mostly walking to balls.

**Calls a minute** (`pt8a-tap.mjs`). "Jobs" counts dirty + basket + fries + rally + Gary + boss phases. Specials and creek snags are counted on their own because they're a steady stream.

| | Jobs only | + special balls | + creek snags |
|---|---|---|---|
| Muni 1P | 0.71–0.81 | 2.3–2.4 | – |
| Muni 2P | 0.77–0.88 | 1.8–2.5 | – |
| Muni 4P | 0.79 | 1.5–1.7 | – |
| Club 1P | 0.91 | 5.5 | 7.1 |
| Club 2P | 1.05–1.14 | 5.5 | 7.6 |
| Club 4P | 1.31 | 6.0 | 8.0 |

- **Read.** Counting only real "who goes where" jobs, the Muni is under the bar at every size (~0.8). The Club reaches it at 1P–2P (~1.0) and falls just short at 4P (1.3 against 1.5).
- Special balls make the number look big, but they aren't decisions. At the Club one lands every ~10 s, so "chase it" is the default, not a choice.

**MOW-E, Club day 3** (`boss.mjs all`, seeds 7 / 11 / 23; SOFA in brackets)

| Crew | Wins | Fight | Plug | Rats landing a hit | Payout share |
|---|---|---|---|---|---|
| 4P roles | 3/3 | 56–60 s | 3.0–3.1 s | 3/4 (the driver never hoses) | 12–16 % |
| 4P swarm | 3/3 | 48–55 s | 3.2–3.4 s | **4/4** | 9–19 % |
| 3P | 3/3 (3/3) | 58–65 s | 3.3–3.4 s | 2/3 | 14–21 % |
| 2P | 3/3 (3/3) | 44–69 s | 3.0–3.3 s | 1/2 | 6–16 % |
| 1P cart / chase | 6/6 (6/6) | 51–78 s | 3.0–3.4 s | 1/1 | 4–16 % |
| Idle crew | loses d3, loses d4, tamed anyway | – | – | – | – |
| **Me, browser, 1P, d7** | **loss** (1 hit of 3 in 100 s) | – | – | – | "MOW-E kept 26 balls." |
| **Me, browser, 1P rematch d8 (HP 2)** | win | 31 s (141→172) | 3.4 s | – | "catcher burst: 1 ball" |

- Round 7's three main complaints are fixed:
  - the 4P fight is no longer a 12 s cooldown timer (hits land 2–7 s apart, e.g. seed 7: 149.7 / 151.0 / 156.8 / 160.3 / …);
  - every swarm Rat lands hits;
  - the plug is a real 3 s tug, not 0.8 s.
- The payout share is still above the 8–12 % target at 3P/4P when the catcher fills.

**Text load** (`textload.mjs 7 4`):
- Muni #1: 12 s.
- Muni #2: 24 s (the mid beat plus the memo).
- Club #1: 21.8 s.
- Club #2: 17.3 s.
- **Club #3, the boss morning: 7.6 s, 1 item: "MOW-E is downloading an update."**
- 0 overlaps, and 0 two-memo mornings.
- Memo folding and the one-memo rule hold in my stretch.

## 1. Findings

1. **The report's "Tomorrow" line lies on the eve of the rematch (Medium, clarity).**
   - Repro: lose the Club day-3 fight (my d7).
   - The report says **"Tomorrow: Gary visits. Clean, then huddle."** But day 8 was the rematch: the update bar was running, `garyToday` was false, and the boss slips Gary.
   - `tomorrowText` (crew.mjs ~2703) has no MOW-E branch. The boss eve, the rematch eve and a loss never get a line.
   - The loss itself is only a 3 s feed line, "MOW-E kept 26 balls." The report never mentions MOW-E (`pt8-A-boss-loss-report.jpg`).
   - "MOW-E WINS · REMATCH NEXT CLUB DAY" is only on the Board.
2. **The fight shares the screen with day chores (Medium, text load and owner rule).** In both fights, while MOW-E was loose:
   - the checklist line **"↑ Fill the bucket basket!"** came back 4–6 times (e.g. 144.6, 156.9, 160.9, 172.4 s);
   - the feed said **"No buckets. A customer left."** several times;
   - the helper feed said "Helpers flattened ×1".
   - `pt8-A-boss-harvest.jpg` and `pt8-A-boss-hunt.jpg` each show the boss toast area plus the checklist plus a feed line.
   - The boss is the one minute that should own the screen. The basket nag and the customer feed could stand down from the warn to the stamp, the way the memos already do.
3. **"Hold Space: pull the plug" stays on after MOW-E is tamed (Medium, polish).**
   - Repro: win at the plug. The prompt came back at 175.7, 184.4 and 194.9 s, swapping with the checklist, for 20+ s after the stamp (`pt8-A-boss-after-tame.jpg`).
   - The plug prompt should check `phase === 'plug'`, not only that a ring exists.
   - Right after it, the Rat was knocked flat by a customer ball ("BONK", 191.6 s), so the look window ends while the player is still standing in the field.
4. **The empty-basket alarm is muted while the day-1 checklist carries into day 2 (Medium, teaching).**
   - Repro: a new solo crew that doesn't spray the sign on day 1. Then on day 2:
     - the checklist still reads "↑ Grab the pressure washer · E";
     - the basket was 0/12;
     - five or more "No buckets. A customer left." lines scrolled past;
     - no alarm fired. `emptyBasketRat` returns null while any `todo` step is open (tips.js:97).
   - A new player gets no hint that the bucket basket is a job (`pt8-A-no-basket-alarm.jpg`).
   - The checklist could add a "Fill the bucket basket" step once the basket first empties, or the alarm could ignore an unfinished `sign` step.
5. **Solo, the hunt is hard to read and easy to lose (Low–Medium, design).**
   - My first solo fight landed 1 hit in 15 s of harvest. Then MOW-E hunted me for 85 s and I never got behind it.
   - It kept eating while hunting: 6 → 26 balls.
   - "Lead it into a cart!" assumes a parked cart near you. Mine was at the bay.
   - The bots' 1p-chase sidestep wins 6/6, and my second policy (sprint sideways when it's ahead and within 7 m) won the rematch. So the counter exists, but nothing on screen teaches the sidestep. The hunted red edge says "run", not "step aside, then hose".
6. **A double press on "Next shift" skips the story card (Low–Medium, pad).**
   - On the day-1 report the first click on Next shift seemed to do nothing for about a second, so I clicked again.
   - The day-2 Muni mid beat then ran its three cards in 3 s: photo 462.8 → card 2 464.8 → card 3 465.8.
   - The 1958 photo card, the best image in the story, was gone before I saw it.
   - On a pad, Ⓐ to start the shift and Ⓐ to advance the card are the same button. The card's 0.4 s grace isn't enough to cover a double press, and the photo card could take a 1.5–2 s grace.
7. **The goal reward shown is not the reward paid (Low, clarity).** The report row said "Buy the ball washer ✦ +$27.52"; buying it paid **"+$54.88"**. The ball value doubles when the washer lands. It's a nice surprise, but the number on the card was wrong.
8. **Outgoing cards linger under the next one (Low, unconfirmed).**
   - In the stalled pane I logged both cards visible at once:
     - the PA "Promoted to the Range Club…" until 18.0 s under Gary's story card from 16.0 s;
     - the Club story card until 30.5 s under the memo from 28.8 s.
   - The cold-open screenshot shows the story card and the "Good morning" PA both at half opacity.
   - textload's model says 0 overlaps, so this is probably slow fades in a 1 fps pane. Check it on the Xbox.
9. **The Muni Gary day works as written.**
   - The PA introduces him ("Gary. Regional Manager. He has a clipboard."), then "Gary from Regional is on site.", then the toast "Gary's coming: clean up, then huddle."
   - The checklist then switches to "Gary checks the sign. Hose it!", "Stall Gary: ping his cart!" and "Keep Gary talking: hold Click!". Clear and well paced.
   - I only huddled and got "Gary found 3 problems. No commendation." plus "Noted. Everything is noted." Fair, and funny.
10. **Day 1 is clean.**
    - The cold open's three memo cards, then the PA, then the checklist arrow.
    - The day-1 report fits on one screen (`pt8-A-day1-report.jpg`).
    - The shop at 800×600 shows one row until you scroll. Fine at 1080p.
    - "Employee of the Shift — Corporate" when you're solo is a good gag.
11. **Small things.**
    - The "+$51.98 · washer" pay floats stacked 7 deep over the Board while the helpers cranked (`pt8-A-boss-loose.jpg`).
    - "MOW-E is loose! Block it. Hose its back!" rendered as a pale, low-contrast toast at the bottom of the screen. The big PA-card style would suit the burst better.
    - At the warn my view (by a target green) showed none of the build-up (`pt8-A-boss-warn.jpg`): no shed, and the Board not in frame. Round 7 #5 still stands for the visuals.
    - The amber edge pulses weren't checked; the pane was stalled.
12. **Verified good:**
    - one memo a morning;
    - the boss morning is 7.6 s of text;
    - the welcome PA waits for the cold open;
    - the reveal holds the clock (shiftT stayed 0 to ~19 s at the Club reveal);
    - each boss phase has one line;
    - the MOW-E TAMED stamp shows for ~3 s, then the pond PA comes 5 s later;
    - every 4P swarm Rat hits;
    - the plug is a ~3 s tug at every crew size.

## 2. The story

- **The cold open** lands, and it's quick (12 s): "Welcome to Site 12. You are on probation." → "Every ball hit since 1958 is outstanding." → "Site 13 is already ahead of you. Somehow."
  - Three dry corporate lines set up the whole game: probation, 1958 and the rival.
  - The view is a calm, empty field (`pt8-A-cold-open.jpg`).
  - The clock does tick through it (3:59 → 3:52), about 5 % of a 240 s day 1. Day 1 has slack, so that's fine.
- **The Muni mid beat** (day 2): "Found behind the shed: a photo, 1958." → "The founder, mid-swing. The ball never landed." → "Site 13 doubled you. Be more Site 13."
  - The best-written beat in my stretch. I lost the photo card to a double press (#6).
  - "Be more Site 13" is the funniest line in the first hour.
- **Gary's Muni intro** works. "He has a clipboard." is a perfect 6 words.
- **The Club promotion:** "Promoted to the Range Club. Parking unchanged." → Gary: "The Club. I raked this pond once." → "Site 13 made the Club last week." → "Dimples now wears a monocle. For the members."
  - It still lands. The reveal camera sweeping the bays under Gary's card is lovely (`pt8-A-club-reveal.jpg`).
  - "I raked this pond once" is the first crack in Gary.
- **MOW-E** (from the code and textload, plus my two fights):
  - The tease, "MOW-E is downloading an update.", is the right setup at 6 words.
  - "MOW-E updated itself. Please stand back." is the best PA in the hour.
  - "Now it hunts. Lead it into a cart!" is clear.
  - The pond line, "MOW-E is in a better place. The pond.", arrived 5 s after the stamp, which is better than round 7's 12 s.
  - The loss doesn't land at all (#1).
- **Missed:** Club mid beat cards 2–3 live (my save skipped mid:1; textload shows them on Club #2). Gary's bubble hello (the pane was stalled).
- **Too many cards?** No. Every story morning is ≤ 24 s, and the boss morning is 7.6 s.

## 3. My stretch's fun

- **Best minute:** the rematch. Burst at 141 s; then a 2.5 s sidestep as it lunged; 3 s of hosing its back while the ring filled; the plug tug; the red MOW-E TAMED stamp; and the PA sending it to the pond. It's 31 seconds from burst to tame, and it's the first time the game asks for your hands, not your route. It's the high point of the first hour, with one catch: the first attempt (a loss) is quiet and confusing, and the report then sends you the wrong way (#1).
- **Dead minute:** Muni day 3. The target is met early. 70 % of the time goes on seek and carry (4P), and calls are ~0.8 a minute. Nothing new happens until gold balls and Gary on day 4. The Club's first two days are busier: fries, treasures, creek snags and Gary.

## 4. Top 5 improvement ideas (for the fun council)

1. **The boss owns the screen and the report.**
   - From the warn to the stamp, mute the basket nag, the customer-left feed and the helper feed.
   - On a loss, show one centre line: "MOW-E got away. Rematch tomorrow." (6 words).
   - Add a report row: "MOW-E: lost · kept 26 balls · rematch tomorrow" or "MOW-E: tamed · 18 balls ×2".
   - Give `tomorrowText` a boss line ahead of Gary: "Tomorrow: MOW-E. Grab a wand at the bell."
   - Why it's fun: the high point of the hour gets a before and an after. The loss becomes a cliffhanger, not a feed line.
2. **Teach the sidestep with the hunt itself.**
   - The first time you're the target, the red edge pulses on the side to dodge toward, and the toast reads "Step aside, then hose its back!".
   - Turn the hunt's re-aim beat (every 3 s) into a visible "rev" puff, so a dodge has a rhythm.
   - Why it's fun: solo, the hunt becomes a skill duel (dodge, punish) instead of an 85 s chase that ends in a quiet loss.
3. **A Muni day-3 mini-call: the first "who goes where".**
   - Day 3 is the dead stretch (~0.8 calls a minute).
   - Make the first gold ball a timed call: one gold at a time lands far out, lit and worth ten, and sinks into the grass after 20 s.
   - Or put a once-a-day "basket's empty, customers waiting" moment on the Board: "3 CUSTOMERS WAITING · FILL".
   - Why it's fun: it lifts Muni calls to ~1 a minute and teaches splitting up before the Club, where it matters.
4. **Put the basket on the checklist when it first empties.** On day 2 (or whenever it first runs dry with the checklist open), add "↑ Fill the bucket basket" as the next step instead of muting the alarm. Why it's fun: new players learn the second core job from the arrow, not by losing customers silently.
5. **Pay the boss's build-up where Rats are looking.**
   - When the update bar passes 75 %, a short world event: the shed door rattles in a 2 s camera nudge toward it, or a big "MOW-E UPDATE 75 %" line on the Board.
   - At the warn, the amber edge pulse plus a ghost arrow to the shed.
   - Why it's fun: the 15 s warn turns into dread you can see, and Rats run for wands instead of finishing their pickup.

## 5. Scores (first night → the Club → MOW-E)

| Metric | Score | Why |
|---|---|---|
| Fun | 7 | The boss rematch is a genuine thrill and the Club is busy; Muni day 3 is still flat. |
| Clarity | 6.5 | The checklist and Gary prompts are excellent. The report lies after a boss loss, the basket alarm is muted on day 2, and the plug prompt sticks around. |
| Text load | 7.5 | One memo a morning, mornings ≤ 24 s, a boss morning of 7.6 s. The fight shares the screen with the basket nag and feed lines. |
| Pacing | 7 | The boss is at ~40–47 min, inside the first hour; promotion on day 4–5. Muni day 3 sags. |
| Co-op | 6.5 | 4P swarm: every Rat hits, and the plug needs half the crew. At the Muni a crew still mostly fans out picking. |
| Meaningful features | 6.5 | The boss now matters (hits spread, a real tug). Specials are constant noise, not choices. |
| Look & feel | 6.5 | The Club reveal is lovely; the stamp is big. The yellow beam fills a third of the screen after a tame; the pay floats stack. |
| Polish | 6 | A stale plug prompt, a wrong Tomorrow line, a double press skipping the photo, the advertised reward ≠ the paid one. |
| One more shift | 7 | Losing to MOW-E made me want the rematch. Winning it made me want to see the pond. |
| Decision density | 6 | Muni ~0.8 calls a minute; Club 0.9–1.3 jobs a minute; the boss minute is dense. |
| **Overall** | **6.8** | The first hour now has a climax. Fix its loss path and the Muni lull and it's a 7.5. |
