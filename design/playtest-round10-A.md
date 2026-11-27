# Playtest round 10, reviewer A: the sofa crew (4P), Muni day 1 → the ending → endless day 3

**Verdict: whole-game Overall 6.8. This run does NOT meet the §4.3 ship bar.** It fails three items:
- **Bar 1:** Polish is 6.0 for the whole game, and the first hour has Decision density 5.5 and Pacing 6.0.
- **Bar 2:** two High findings are open (H1, H2).
- **Bar 3:** `__centre.overlaps` was above 0 in every stretch except the bank itself.

Things I can speak to:
- bar 4 at 4P: the ending is reached and endless runs;
- bar 2 and bar 3 at 4P;
- perf, unthrottled only. A fronted window held 55–56 fps with p95 18.1–18.3 ms all session, so every visual claim below was taken above 20 fps.

Things I can't speak to: perf with the CPU throttled (that's C's job), and 1P or 2P.

Build f5a95a7. My server ran on :8611 (`RR_DEV=1`), with my own Edge profile over CDP and the window fronted.

**How I played (labelled honestly).**
- **The seats.**
  - Seat 1 was my page. It played on an emulated **standard Xbox pad** (`navigator.getGamepads` faked, so input went through the real `pollPad` path).
  - The pad "thumb" was a script (`scripts/bots/pt10a-page.js`): left stick to walk, right stick to turn, Ⓐ to pick up, Ⓧ to bank, RT to spray, Ⓨ for Ready, and the D-pad in the shop.
  - Seats 2–4 were `scripts/bots/pt10a-seats.mjs`: three HTTP/SSE seats on the real API. They split event balls by "nearest free Rat", work the field, huddle for Gary, hold at the Last Bucket, press **Ready 1.5 s into every report** (the early readiers), and with `--fight` they hose MOW-E's back and hold the plug.
- **Where the run was continuous and where it jumped.**
  - **Continuous:** a new crew (`rangerat.hints.v1` cleared) played Muni days 1–4.
  - **Presets from there** (all 4P crews), because my bot crew banked too slowly to pass the Muni's 2,000-ball goal in my time budget:
    - `club2` → Club day 2 (Gold Rush + Gary) → day 3 boss (**lost on purpose**: everyone worked the field) → day 4 rematch (**won**: four hosers) → day 5 Tournament;
    - `tiered1` (Happy Hour);
    - `stadium1` (the Stretch);
    - `stadiumPromo` (the crash, fought and tamed);
    - `lastbucket-4p` → the bank → the final report → endless days 1–3.
- **Headless.** `mid.mjs` 4P × seeds 7/11/23 from `club1` with `FIGHT=0 POLICY=pt10a-loseonce BUY=1 TOURNEY=1 WHISTLE=aim`. The new `scripts/bots/policy/pt10a-loseonce.mjs` loses the first boss and tames the rematch. For everything else I used the lead's ladder.

**Shots** (`design/shots/`):
- `pt10-A-day1-report.jpg`
- `pt10-A-goldrush-alert.jpg`
- `pt10-A-gary-warn.jpg`
- `pt10-A-boss-loss.jpg`
- `pt10-A-rematch-fight.jpg`
- `pt10-A-tournament.jpg`
- `pt10-A-happyhour.jpg`
- `pt10-A-bank.jpg`

## 2. Scores

| Metric | Whole game | First hour (Muni → boss) | Middle (Club d4 → Stadium) | Late (Stadium → endless) | Why (whole game) |
|---|---|---|---|---|---|
| Fun | 7 | 6.5 | 7.5 | 7 | Four hosers taming MOW-E in 30 s and the Tournament's beams are the best co-op minutes. The Muni's back halves are still empty. |
| Clarity | 6.5 | 7 | 6 | 7 | The ALERTs are short and alone. "Missed, Clean 58 % · needed 35 %" (M6) and the crash day's six asks in 45 s (M3) confuse. |
| Text load | 6.5 | 6.5 | 6 | 7.5 | One text at a time holds, **except** that pay floats and Gary's bubble share the centre at 4P (H1, H2). |
| Pacing | 6.5 | 6 | 7 | 7 | Muni days 2–3 end with 2–2.5 minutes of nothing. The Club and later never sag. The Last Bucket is over in about 70 s. |
| Co-op | 7 | 6.5 | 7.5 | 6.5 | The Gold Rush, the Tournament and Happy Hour all split a 4P crew naturally. The Last Bucket's HOLD SPACE TOGETHER fills in 3 s and asks nothing of the friends. |
| Meaningful features | 7 | 6.5 | 7 | 7 | Every event pays and reads on the report. Washing the mats is still the Muni's whole day. |
| Look & feel | 7 | 7 | 6.5 | 7.5 | The beams, the crowd and the endcard look great. A Happy Hour beam floods the screen pink when you stand in it (M4). |
| Polish | 6 | 6.5 | 6 | 6 | Crewmates' pay floats are in the centre all game (H1). The endcard shows "0 balls · $0" for three friends (M5). |
| One more shift | 7.5 | 8 | 7 | 7 | "MOW-E got away. Rematch tomorrow." plus "Grab a wand early." is the hook of the game. |
| Decision density | 6.5 | 5.5 | 7.5 | 7 | The Muni is 0.82 calls/min offered at 4P (ladder), and its days 2–3 end with 120–147 s of nothing. From Tiered on, there's always an ask. |
| **Overall** | **6.8** | **6.6** | **7.0** | **7.0** | The 4P events are the best the game has been. The centre-box floats and two collision days keep it under the bar. |

## 3. Findings

| # | Sev | Finding | Repro / what I saw / evidence |
|---|---|---|---|
| H1 | **High** (bar 3) | **At 4P, pay floats share the centre with a centre text in every venue.** 6.5 moved *your own* cash pops to the HUD. The washer's floats ("+$68.49 · washer"), crewmates' banks ("+$729 · 2", "+$4,878 · 11"), Curb Appeal's "+$0.03 a ball", Gary's "✓ Cart" / "✗ Sign" and "NEW ×1.5" are still world sprites at the return, and a 4P crew is always at the return. | Play any 4P shift and bank at the main return. `__centre.overlaps` (the widened zone) counted **6** on Muni d1–4, **14** on Club d2, **36** on Club d7–9, **5** on Tiered d1, **13** on Stadium d1, **17** by t257 on the crash day, and **19** over endless days 1–3. The bank itself had **0**. Of 91 logged episodes, 81 are `payfloat` + a toast/todo/PA. Examples: `pa-card "MOW-E is in a better place. The pond." ‖ payfloat "+$1,150 · 3"` (crash-day tame), and `toast "Happy Hour! Drinks, and fetch the greens!" ‖ payfloat "+$2,100 · washer"`. Each episode lasts 1–2 s, so I couldn't screenshot one at my poll rate. The texts above are from `__centre.log`. Fix idea: route crew, washer and Gary-check floats to the feed or the HUD while any centre item is up, or hide them as 6.6 does for priority 0–1. |
| H2 | **High** (centre text on text) | **Gary's speech bubble sits in the centre box over his own checklist line for 25+ s.** | Club day 2 at 4P (`club2`): `gary-bubble "Mind the pond. Things sink."` was up with "Gary's coming: clean up, then huddle." (t255–257), with "Full: take them to the ball return", and then for ≥4 samples with "↑ Gary checks the return. Hose it!" (Club d9 too). On Muni d4: `todo "All clean. Meet Gary at the return!" ‖ gary-bubble "Clipboard's ready. Are you?"`. 6.2 capped the bubble's size, but it still lands mid-screen whenever you face him, and that is exactly when the checklist talks about him. |
| M1 | Medium | **Losing the first boss usually costs the 4P crew the Tournament.** The rematch takes the Club day that the Tournament would use, and a working crew then promotes at that bell. | Headless (`pt10a-loseonce`, 4P, from `club1`): the Club took 4 / 4 / 5 shifts and there were **0 / 0 / 1 Tournament days** (seeds 7 / 11 / 23). The lead's win-first ladder has 1–2. The owner's "lose, then win" sofa run is the one that never sees the members' flights. In my browser run, the bot crew missed the card, so I did get day 5's Tournament (4 of 6 balls, +$6,910). |
| M2 | Medium | **Club day 2 stacks the Gold Rush and Gary back to back.** | `club2` 4P: the rush ALERT came at t146, its clocks ran out at ~176, and "Gary's coming: clean up, then huddle." fired at t181. The rush is *meant* to send four Rats 45–110 m out, and five seconds later Gary wants the sign, mats and return clean and everyone in the ring. Result: "Gary found 3 problems. No commendation." By design (`goldrush.js` `GARY_PAD`), but on a sofa it reads as being punished for answering the first call. |
| M3 | Medium | **The crash day's three peaks overlap when a 4P crew tames MOW-E early.** | `stadiumPromo` 4P, fought: crash PA t60 → loose t75 → **tamed t143** → Gary t181 → **Stretch ALERT t210, during Gary's inspection** → "Gary is inspecting" t226 → "Stall Gary: ping his cart!" t239 → "The crowd is bored. Lap the Track!" t240 → "Keep Gary talking: hold Ⓐ!" t250. That's six different asks in 45 s. Each line was alone on screen, but they're competing orders. 4a tuned the *loss* path (fight ends by 245 s). A fast tame lands Gary's 80 s inspection on top of the Stretch. |
| M4 | Medium | **Standing in a Happy Hour beam floods the whole screen pink.** | Tiered, `tiered1` 4P, at the lounger ball you're picking up (`pt10-A-happyhour.jpg`): the neon beam is a `DoubleSide` cylinder around the camera, so the view turns into a flat pink wash with the ALERT on top. Every carrier sees this at the moment of the grab. The Gold Rush and Tournament beams use the same material (`views/goldrush.js:39`, `views/tourney.js:44`), but I didn't get a shot of those. Suggestion: fade a beam to 0 inside ~2.5 m, as the name plates and the bubble do. |
| M5 | Medium | **The final report's per-Rat rows are the last shift's ledger, not the crew's game.** | `lastbucket-4p` → bank → endcard (`pt10-A-bank.jpg`): "Rob A 1 ball · $66,164,344 · 0 knockdowns" and "Sofa B/C/D 0 balls · $0 · 0 knockdowns". `round2.js showEndCard` maps `report.ledger` (the shift). The totals rows (days 18, balls 13,953) are lifetime. On the owner's sofa, three friends read zeros on "a final report for Fairway Holdings". From a full chain they'd see one Orbital shift's numbers, which is still not their two hours. |
| M6 | Medium | **The Tiered report contradicts itself.** | `tiered1` 4P report: "DAILY TARGET MISSED · Clean 58% · needed 35%", then "Venue gauge at the bell 43% · Missed: the bowls were full at 2:30." The header shows a number above the need. Lead with the real miss. |
| L1 | Low | **The boss fight's mute lets boot and tip nags through.** | Rematch, mid-hunt: "Filthy boots: the range looks dirtier. Hose them." (t188), "Caked boots drag Clean % down. Hose them." (t193). Crash day: "Caked boots…" at t99. Loss day: the tip "Walk in to dive. Buddies pump your air." at t208, mid-hunt. |
| L2 | Low | **"Fill the bucket basket!" blinks.** | Crash day after the tame: shown 4 times between t147 and t173, 1–2 s each. Club days: every 5–30 s all day when nobody fills the basket (my seats never did). |
| L3 | Low | **Muni memos over 8 words.** | "Today: 60% clean by the bell. Corporate has sent a teenager to help." (13). "Today: 60% clean by the bell. NEW: gold balls. ×10. Dimples watches." (12). "Gary visits today. 60% clean by the bell. Smiling is not required, b…" (truncated in the card). |
| L4 | Low (data, n=1) | **The Gold Rush share is high at the Muni.** | Muni d3 report, 4P: "Gold Rush: 3 of 4 · +$106" of +$552 (19 %), against E's < 10 %. At the Club it was +$1,130 of $28,685 (4 %). |
| L5 | Low | **Early readiers shrink the normal report to about 15 s.** | Ready from 3 seats at 1.5 s starts the 20 s countdown, so seat 1 had "Ready (3 / 4) · starts in 10s" by the time the report had drawn (`pt10-A-day1-report.jpg`). It works as designed. On a sofa, the person who wants to shop gets 15 s. **The ending's hold works:** the endcard stayed up 46 s with 3/4 ready from 1.5 s, the countdown appeared only after the hold (`readyIn` null → 25), and there were 0 overlaps from the bank to endless. |

**Checked and fine:**
- **The ALERTs:** the Gold Rush ALERT was alone (`pt10-A-goldrush-alert.jpg`); so were the Tournament, Happy Hour and the Stretch.
- **Event outcomes at 4P (my bot split):**
  - Muni Gold Rush 3 of 4;
  - Club Gold Rush 3 of 4;
  - Happy Hour 3 of 3 greens;
  - Tournament 4 of 6, with "Second flight!" at t320.
- **The loss beat:** "MOW-E WINS" → "MOW-E got away. Rematch tomorrow." (alone, about 4 s) → the report row → "Tomorrow: MOW-E's rematch. Grab a wand early.".
- **The mowed lines:** shown once, then "Mowed again!" 17 s and 34 s later.
- **The Club spawn** faces the field.
- **The Gary day-4 lines** were one at a time. "Gary is inspecting. Stay out of his way." was held 3 s.
- **No softlock or dead end** in about 1 h 45 of play. Every report started a shift. The Last Bucket huddle completed.

**Harness artefacts, not game bugs:**
- My pad thumb kept the left stick forward while the shop was open, so the D-pad focus "walked" by itself. Fixed in my script, and the shop's pad focus is fine.
- My seats reached Gary's huddle late (Muni d4 +1 commendation, not 3) and never filled the basket or cooked ("0 pours").

## 4. What §4.2 asks everyone to record

**`__centre.overlaps`** (widened zone, reset at each preset):

| Stretch | Count | Detail |
|---|---|---|
| First hour (Muni d1–4) | 6 | 4 Curb-Appeal floats with toasts, 1 sign float, 1 Gary bubble + todo |
| First hour (Club d2) | 14 | Gary's bubble 5×, the rest washer floats |
| First hour (Club d7 boss) to the middle (d8–9) | 36 | 4 Gary bubble + todo, 32 floats |
| Middle (Tiered d1) | 5 | |
| Middle (Stadium d1) | 13 | |
| Middle (crash day, to t257) | 17 | |
| Late (the bank → endcard) | **0** | |
| Late (endless d1–d3, to d3 t184) | 19 | all pay floats with a BONK or boots toast |

Shots: none. Each episode is a 1–2 s float, gone before a CDP capture, so the texts are logged in H1/H2.

**The longest gap with no call** (ladder, 4P): Muni 240 s, in 7 of 12 shifts with a gap over 3 minutes; Club 205 s. My browser run had no centre text at all for these stretches:
- Muni d2: t240 → t360 (120 s);
- Muni d3: t273 → t420 (**147 s**);
- Club d9: t323 → t406 (83 s).

**Softlocks and dead ends:** none.

**Centre lines over 8 words:** the three memos in L3. No toast, ALERT or todo was over 8.

**Best minute and dead minute:**

| Stretch | Best minute | Dead minute |
|---|---|---|
| First hour | The Muni Gold Rush (t250–280): four beams, the crew splits two left and two right, 3 of 4 banked, "For research." | Muni d3, t273 → the bell: "On target. Hold it till the bell." and then 147 s of nothing. |
| Middle | The rematch (t164–213): four Rats get wands, the hp falls 11 → 9 → 5 → 2 in 20 s, "Pull the plug!", "MOW-E TAMED", the pond PA. | Club d2, t181–263: answering the Rush made the crew fail Gary (M2). |
| Late | Ball No. 1: down → carried → "Whoever finds this: the range is yours." → the $∞ flash → "No more balls. Every ball mattered." → the endcard. | Endless d1's first 2 minutes: the memo "Fries are free. For us. — the Rats" and then work with no event. |

**"One more shift?"**
- **After the first boss: yes, strongly (8).** "Rematch tomorrow" plus "Grab a wand early" is the best hook in the game.
- **Leaving the Club: probably (7).** I jumped by preset, so this one is unverified. The Tournament report's "Gary will be back tomorrow." is a weak cliffhanger for the Club's last day.
- **At endless day 3: a soft yes (6.5).** See the addendum.

**The heart through-line.**

What I saw, in order:
- the 1958 photo (Muni d2, still the best beat);
- "Club minutes, 1958: the founder's ball, still airborne.";
- the jumbotron's 1958 newsreel;
- "INSIDE BALL No. 1 · 1958: Whoever finds this: the range is yours.";
- endless: "Gary loosens his tie. He grabs a bucket.".

That reads as one story.

Not seen (presets skipped the beats): "I raked this pond once", the 1987 tape, "I was a Range Rat", the Lift ride, the star and the case.

**Ball No. 1's ending lands, but it's quick.** It's about 70 s from the ball landing to the endcard at 4P. HOLD SPACE TOGETHER filled in about 3 s, because idle Rats count as holding, so the "together" never needs the friends.

**Site 13 and Dimples stay funny without crowding.** They show up as one card each ("Site 13 doubled you.", "Site 13's fries are crispier. We checked.", "Dimples now has a mascot. It is Dimples.", "Dimples is retiring. He finally makes eye contact.").

## 5. Top 5 for the owner

1. **Clear the centre box at 4P (H1 + H2).**
   - Crewmates', washer and Gary-check pay floats go to the feed or the HUD (or hide) while any centre item is up.
   - Gary's bubble gives way (fades) while a Gary checklist line or a Gary toast is up.
   - This is the one thing that fails bar 3 in every stretch.
2. **Don't let the "lose, then win" crew miss the Tournament (M1).**
   - Either hold promotion for one Club day after a rematch, or run the first Tournament flight on the rematch day once MOW-E is tamed.
3. **Split the collision days (M2, M3).**
   - On Club day 2, move Gary's warn to ≥ 60 s after the rush's clocks end, or skip the rush on Gary days, as at the Muni.
   - On the crash day, hold the Stretch until Gary's verdict (`garyLive`), not a fixed T−3:30.
4. **Make the final report the crew's game (M5).** Show career balls, cash and knockdowns per Rat on the endcard. Keep the last-shift ledger on the normal report.
5. **Give the Muni's back half one call (decision density 5.5).**
   - Muni d2 and d3 end with 120–147 s of silence after "On target. Hold it till the bell."
   - A small T−1:30 beat would fix it, for example a "last-bucket rush" customer wave or the Dimples cart sweeping the far field.
   - Also fade any beam you stand inside (M4).

## Addendum: endless days 1–3

- **The days.** Days 19–21 ran as Range Rats LLC at 4P, with 0 softlocks.
- **The centre was mostly noise.** Endless d3's log to t184 is twelve toasts, every one "BONK. You got knocked flat." or a boots nag ("Your boots are muddy", "Filthy boots…", "Caked boots…"). The game's real stakes sat on the Board:
  - the contract ("bank $33,520,300 · $11.9M SO FAR");
  - Site 13 at $13.27M against our $11.9M;
  - yesterday's pace.
- **The memo repeated.** "Fries are free. For us. — the Rats" came up on day 19 and again on day 21.
- **The contract pick was rushed.** With the seats readying early, the endless report gave seat 1 about 16 s to choose between three offers (rain ★, wind ★★, junior ★★★).
- **One more shift? A soft yes (6.5).** The race against Site 13 is a good reason to play on, but nothing in the centre ever says "Site 13 is ahead". At 4P the endless day is a calm work loop with no event of its own, after a game that taught the crew to expect one every few minutes.
- **Owner idea:** one ALERT when Site 13 passes the crew ("Site 13 just passed you. For research."), and Ready held until the contract is picked.
