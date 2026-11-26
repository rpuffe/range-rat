# Playtest round 6, playtester A: a new crew's first night (Muni day 1 → Range Club day 3)

Build 52af0c2 (Round 12 story beats). I played the real client in the browser pane (rr-play-a, :8094, 800×600, keyboard).
For the Muni day 1 cold open I used a new crew. For the later mornings I made real (non-test) crews from bot saves
(`POST /api/dev/crew`), so each morning plays as it would for a real crew. I traced the centre text with a 200 ms DOM
poll plus a class MutationObserver. The headless bot is `scripts/bots/pt6a-story.mjs`, a copy of `muni.mjs` that keeps
the morning events (the stock bot's first `flush()` threw away the memo, story and reveal events) and runs on to Club
day 4. I ran it at 4P (seeds 7 and 11), 2P (seed 3) and 1P (seed 7, `chat prep`).

Shots: `design/shots/pt6-a-cold-open.jpg`, `pt6-a-muni-mid-photo.jpg`, `pt6-a-club-promo-gary.jpg`,
`pt6-a-club-mid-overlap.jpg`, `pt6-a-mowe-lane.jpg`, `pt6-a-muni-balls-dusk.jpg`, `pt6-a-muni-dusk-tex.jpg`.

## When each beat fires (bots, all four runs agree)

| Morning | 4P / 2P | 1P | What else is on that morning |
|---|---|---|---|
| Cold open | Muni d1 | Muni d1 | quiet memo (skipped), welcome PA, checklist |
| Muni mid | **Muni d2** | Muni d2 | day memo, "Fill the bucket basket!" nudge, `glow` PA late |
| Club promotion | d5 (Club d1) | d6 | reveal PA, reveal memos, day memo, square-ball memo |
| Club mid | **Club d2** | Club d2 | Gary day, `lead` PA (pond fills), day memo, lead-ball memo, treasure glint |
| MOW-E | **Club d3**, t105 | Club d3 | Gary day, `bouncy` PA + memo, splitter memo, creek dive and Back return open |

The Muni mid beat always lands on day 2. Day 2 has a quota but no Today modifier, and Gary's first visit is day 4. So
the "photo, 1958" is never held back.

## 1. Findings

1. **The MOW-E alert is stale when it shows (Medium).** At warn (t105) the server sends `mower warn` and the `mower` PA
   in the same tick. say.js ranks PA above ALERT, so the PA card plays first. The PA is 13 words: 13×380 + 1000 + 700
   chime ≈ 6.6 s. Only then does "MOW-E mows the Rock in 12 s. Move!" appear, with about 5 s actually left. On debut
   day the one actionable line comes second and is wrong. Fix: drop "in 12 s" from the ALERT ("MOW-E: clear the Rock
   lane!"), or show the ALERT first and let the PA follow while it drives.
2. **MOW-E barely does anything (Medium, design).** It rakes 3–11 of ~260–310 resting balls (2–4 %): 8 and 7 at 4P
   seed 7; 9 and 8 at 2P; 7 and 3 at 1P; 11 and 7 at 4P seed 11. It knocked nobody down in any run. In the browser it
   picked lane −156 ("the Rock"), 156 m downrange: from the mats it's a speck, and it was gone from my frame within ~4 s
   while I stood 7 m from the lane. See §MOW-E.
3. **Club day 3 is overloaded (Medium, pacing).** One morning brings the creek dive, the Back return, MOW-E, the
   super-bouncy ball (PA + memo), the splitter memo and a Gary visit (t181). Browser trace: memo 0.9–7.9 s, bouncy PA
   15.5 s, bouncy memo 23–28 s, splitter memo 28.7–33.7 s, mower PA ~105 s, Gary warn 181 s. That breaks the owner's
   "one idea a day" rule that clubdays.js says it follows. The splitter isn't in `CLUB_DAY` at all. MOW-E is the
   biggest set piece and gets the fewest words.
4. **The Club mid beat stacks on a Gary day (Low–Medium, text load).** Club day 2: story (3 cards) 0.3–12.5 s →
   `lead` PA 12.9–19 s → day memo ("Gary visits today…") 19.7–26.7 s → lead-ball memo 27–32 s. That's **32 s of
   back-to-back centre text**, and the day's target only reads at 20 s. It is one text at a time, but it's a lot. The
   Club promotion morning is about the same: PA 0–7.6 s → story 7.7–20 s → memo 20–27 s → square memo 35–40 s.
5. **A card fades in over the previous card (Low, cosmetic).** The classes are correct: story-card off at 12.46 s,
   pa-card on at 12.85 s. But in the pane the 0.25 s fade is slowed down by the frame rate, and two screenshots show
   both cards readable at once (`pt6-a-club-mid-overlap.jpg`, and Gary's promo card over the fading "Parking
   unchanged" PA). On a slow frame (Xbox Edge under load) the eye reads two texts. Fix: make the incoming card wait for
   the outgoing card's `transitionend`, or snap it off with no fade when a story card takes the turn.
6. **The shift clock runs through the cold open (Low).** Muni day 1 is 240 s. Cold open 10–22.8 s, welcome PA
   22.8–32 s: 32 s (13 %) of the first shift is reading before "Pick up a ball · Click". That's fine for a first
   shift, but customers are already hitting.
7. **Gary's venue hello is easy to miss (Low).** `garySays` shows for 6 s at the warn, in his 3D bubble at the gate.
   The same moment brings the horn, the ALERT and the `gary` PA (Muni d4 t181), when Rats are usually out in the field.
   He then waits another 39 s (4P) or 84 s (1P) with nothing in the bubble. I never caught the hello on screen. The
   sign-off goes to the feed 4.2 s after the verdict. It's readable, but it's edge text under the verdict ALERT. Fix:
   show the hello for the whole wait, or have him say it when the first Rat comes within 6 m.
8. **Gary every Club day for a crew without the Seal (Low, note for B).** Every bot run had "Gary visits today" on Club
   d2, d3 and d4 (`garyBack` while `seal` is open, crew.mjs:1711). With the mid beat and MOW-E, it's the same Gary
   rhythm every day.
9. **Balls don't pop at dusk (Low–Medium, look).** In daylight, resting balls read grey-lavender, not white, on the
   mottled grass (`pt6-a-muni-balls-dusk.jpg`). In the last minute ("132 left out there", LAST CALL) I couldn't pick
   out a single ball past ~15 m, with or without `?notex` (`pt6-a-muni-dusk-tex.jpg`). The textures don't make it
   worse. The grass itself reads well: the mow stripes, the target rings and MOW-E's hazard-striped lane are clear.

The rules check:
- **One centre text:** yes by class, but see #5.
- **~8 words:** every story card is ≤ 8. The PA captions are short, but the mower ALERT is now wrong (#1).
- **Pad:** the card footer swaps glyphs (`keys()`), and Esc skipped without opening the pause menu (verified in R12).
  I didn't test a real pad.
- **Full screen:** never dropped.
- **1–4 Rats:** the beat timing is identical at 1P, 2P and 4P.

## 2. The story

**Cold open (lands).** The MEMO card with Dimples' seal on a bright morning sky (`pt6-a-cold-open.jpg`) is a strong
first image. "Welcome to Site 12. You are on probation." sets the tone in 7 words. "Every ball hit since 1958 is
outstanding." is the best line in the opening: it's a joke about debt and a hook for Ball No. 1 at once. "Site 13 is
already ahead of you. Somehow." gets the "Somehow." laugh. The 3 cards × 4 s and then the welcome PA ("Corporate is
counting.") go cleanly. No collision with the checklist: it waited until 32 s.

**Muni mid, day 2 (half lands).** "Found behind the shed: a photo, 1958." / "The founder, mid-swing. The ball never
landed." This is the emotional hook, but it's a caption about a photo we never see. A dark serif card with ✦ saying
"a photo" with no photo is the beat's weak spot. "Site 13 doubled you. Be more Site 13." is funny. It played before
the day memo and didn't collide.

**Club promotion (lands).** Gary's clipboard card, "The Club. I raked this pond once.", while the reveal camera
sweeps the new bays (`pt6-a-club-promo-gary.jpg`), is the best story moment in my stretch. It's the first hint that
Gary was one of us. "Dimples now wears a monocle. For the members." is a good laugh. "Site 13 made the Club last
week." is fine.

**Club mid, day 2 (lands, crowded).** "Club minutes, 1958: the founder's ball, still airborne." is good continuity.
Gary's "Don't dive the north end. Just don't." comes the day before the creek dive opens (day 3): nice foreshadowing,
if anyone remembers it. "Site 13's fries are crispier. We checked." is good. It sits inside 32 s of text (#4).

Never seen live: Gary's hello bubble (#7). Not in my stretch: the epilogue.

**Overall:** the cards are short, well voiced and never pause play. With 3 cards per beat, 4 s each, the reading time
is right. The problem is the neighbours: each beat lands on a morning that already has a PA and 1–2 memos.

## 3. The fun

- **Best minute:** the Club reveal. The camera sweeps over the new bays, Gary's clipboard card says he raked this pond,
  and then the first square ball drops. That's a new place, a secret and a new toy, in the right order.
- **Dead minute:** Club day 3, from 0:35 to 1:45. Three "NEW:" memos have gone by, and MOW-E then crosses a lane
  150 m away that you only know about from a Board countdown, rakes eight balls 2.4 m, and leaves. Nobody's plan
  changes.

## MOW-E: what it does, why it doesn't land, and the boss pitch

**What it does now** (`mowe.js`, crew.mjs:1720–1750). Once a shift, from Club day 3, at 25 % of the shift:
- 12 s warn: the PA, then the ALERT, the Board countdown and a hazard-striped lane.
- It drives one lane at 4 m/s (32 s). It picks the lane with the most resting balls within ±2 m.
- It nudges those balls 2.4 m into a "windrow" that stays on the field: no banking, no value.
- It knocks flat any Rat within 1.3 m, and honks and waits if a cart blocks it.
- It has no engine sound, only two beeps. The rake teleports balls with no effect.

**Why it doesn't land:**
1. Nothing is at stake. A typical lane holds 4–9 balls, so it can't help or hurt in any way you'd notice.
2. It's far away. 4 of the 6 lanes are ≥ 120 m out, and the crew lives at 0 to −40.
3. There's no verb. The only interaction is "stay out of its lane", and the alert that tells you that is late (#1).
4. Nothing is felt: no engine, no clippings you notice, no pay-off line.
5. The PA promises "Trained on your movements", and it never tracks anyone.

**The boss pitch: "MOW-E Goes Rogue"** (the owner: "make the mower a big deal, like a boss moment"). Once, on its
debut (Club day 3), at ~40 % of the shift. About 90 s. Built on the existing pieces: `stepMower` lanes and
knock-downs, the cart block and its `honk`, the hose's `wash` action, `say`/PA, the Board line, `SFX.horn`, confetti.

- **Build-up (15 s).**
  - The PA: "MOW-E has achieved autonomy. Corporate is thrilled."
  - The shed doors rattle, and an engine loop starts low and rises (a sawtooth through a low-pass, its pitch on speed).
  - The Board turns red: "MOW-E · ROGUE · 0:15".
  - All six lane stripes flicker, then it bursts out of the shed.
  - The centre text, 3 words: "MOW-E is loose!"
- **Phase 1: The Pattern (30 s).**
  - It runs a serpentine across three lanes *near the mats* (−24, −36 and a new −12): close enough to see and feel.
  - It **eats** balls instead of raking them. A Board gauge shows "MOW-E HAS 18 OF YOUR BALLS". Balls eaten count as
    not clean, so the target now has a stake.
  - The beat: **roadblock it with the cart** (the existing `CART_STOP` honk-and-stall). A stalled MOW-E shows a glowing
    intake grille.
- **Phase 2: Trained on Your Movements (30 s).**
  - It picks the lane nearest a Rat (a `pickLane` variant: nearest Rat, not most balls) and re-aims every 6 s, at 5 then
    6 m/s. It hunts.
  - Knock-downs are now the danger, and the PA joke finally pays off.
  - A **decoy** Rat can kite it. The **hosers** hit the intake while it's stalled or turning: the wash wand on target
    `mower`, about 4 s per hit.
  - Three hits per phase. Each hit is a cough of black smoke and a pitch drop in the engine.
- **Phase 3: The Pond (finisher).**
  - With one hit left it bolts for the shed. If a Rat lures it across the pond bank (from Club day 2), it drives in and
    sinks with a gurgle.
  - Otherwise the last hose hit stops it.
  - The catcher bag bursts. **Every eaten ball fountains out**, plus 5 gold balls and confetti.
  - The PA: "MOW-E is in a better place. The pond."
  - Gary's feed line: "Told you. I raked this pond once."
- **Each Rat at 4P:**
  - **Driver:** the cart roadblock.
  - **Two hosers:** they hit the intake.
  - **Decoy:** lures it in phase 2 and to the pond.
  - Everyone grabs the fountain balls afterwards. It's a natural split, and people will shout ("Park NOW!").
- **Solo:**
  - The HP scales to 2 hits a phase.
  - A parked, empty cart still blocks it, so solo is "park the cart in its path, run round, hose the grille".
  - The hunt targets you, so you are always the decoy. Solo gets a 1.5 m wider knock-down grace.
- **Win and lose.**
  - Win: the "MOW-E Tamed" commendation, and the balls back plus gold.
  - **From then on MOW-E is tame.** On later days it rakes its lane *into the nearest return* (a real auto-bank of
    20–40 balls). It becomes the crew's pet: "MOW-E sends his regards."
  - Lose (it reaches the shed): it keeps the eaten balls for the day and comes back rogue tomorrow, once.
- **Music and sound.**
  - A two-note PA chime turns into a 4-bar ostinato: synth bass plus a hi-hat on the engine RPM. Tempo up one step a
    phase.
  - The engine loop is spatialised and ducked under the PA. The honk beeps stay.
  - A cough on each hit. On defeat: a power-down pitch fall, then the jackpot sting and confetti.
- **Text.** One centre line per phase, ≤ 4 words ("Block it with the cart!", "It's hunting you!", "Lure it to the
  pond!"). The rest goes on the Board.
- **Pacing.** Move the bouncy ball and the splitter off Club day 3 (#3), so the boss owns its morning. The mid beat
  could even foreshadow it: Gary's "Don't dive the north end" → "Never trust the mower."

## 4. Top 5 improvement ideas (ranked)

1. **MOW-E Goes Rogue: the boss set piece above** (M–L). It gives the Club its one memorable, co-op, shouty moment.
   It uses verbs the crew already has (cart, hose, run), it pays off the "trained on your movements" joke and Gary's
   pond, and it ends with a fountain of balls. A tame MOW-E afterwards is a reward you keep using.
2. **Show the 1958 photo** (S). On the Muni mid beat, the first card shows a small sepia "photo": the founder
   mid-swing, the ball a dot at the top, as a canvas drawing in the caption card's slot. It's the one image that the
   whole Ball No. 1 thread hangs on. Reuse it at the Orbital ("Up here, one ball glints").
3. **One idea a day at the Club, for real** (XS). Day 1: the kitchen and the square ball. Day 2: the pond, lead, gold
   and the Club mid beat. Day 3: MOW-E only (with the creek dive). Day 4: the bouncy ball and the splitter. Each new
   thing gets its own morning to shine.
4. **Thin the busy mornings** (S). On a story morning, fold the "NEW: ball" memo into the PA caption (the PA already
   says it), and put the day's target on the Board chip, not in a 7 s memo. Club days 1 and 2 drop from ~35 s of
   centre text to ~20 s.
5. **A glow and size boost for balls in the last 60 s and at dusk** (XS). A rim/emissive lift (or +20 % scale past
   15 m) during LAST CALL, so "132 left out there" is a hunt you can see, not a guess. It makes the closing scramble
   fun instead of blind.

## 5. Scores

| Metric | Score | Why |
|---|---|---|
| Fun | 7 | The cold open and the Club reveal are delightful. Club day 3 sags. |
| Clarity | 7 | The checklist and nudges lead well. The MOW-E alert is late and wrong; the day's target arrives 20 s in. |
| Text load | 6 | One at a time, but 32–40 s of stacked cards on the Club mornings. |
| Pacing | 6.5 | The Muni is perfect, one idea a day. Club day 3 dumps five things. |
| Co-op | 6.5 | The Muni splits naturally. MOW-E asks nothing of a crew. |
| Meaningful features | 6 | MOW-E moves 3–11 balls once a day: filler as built. |
| Look & feel | 7 | The grass, mow stripes and the lane hazard stripes read well. Balls are grey not white, invisible at dusk. |
| Polish | 7 | No hard bugs. The stale alert and the double-card fade are small. |
| One more shift | 7 | The Gary pond hint makes me want the Club. Club day 3 doesn't pull me to day 4. |
| Decision density | 5.5 | On story mornings the first 20–35 s are reading. MOW-E has no decision. |
| **Overall** | **6.5** | The story opening is a real lift; MOW-E is the hole in the stretch. |
