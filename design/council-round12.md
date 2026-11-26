# Fun Council, round 12: every late minute asks the crew something

This is the record of Range Rat's twelfth Fun Council (2026-11-26). It is based on build `e44e93e` (council round 11
built), playtest round 7 (`design/playtest-round7-A.md`, `-B.md` and `-C.md`, with shots in `design/shots/pt7-*`),
the scorecard's Round 7 section, and the round-13 builders' notes (`round13-mowe.md`, `-late.md`, `-story.md` and
`-fixes.md`).

Rounds 1–11, the owner-playtest-3 spec and round 12's beat sheet still apply wherever this record doesn't change them.
Where they disagree, this record wins.

**This round's job.** This is the second, and last, late-game loop tonight. The next loop is the **full-game loop with
the scorecard** (§4). The owner's calls:
- *A better late game.*
- *MOW-E is "a big deal, like a boss moment".*

**The owner's firm calls (unchanged, binding):**
- one centre text at a time, ~8 words;
- works on a pad, and never drops full screen;
- scales for 1–4 players (balanced for 4), and every upgrade is crew-wide;
- Gary and Ball No. 1 are the heart; Site 13 and Dimples are the comedy;
- rare PA lines, only on big events;
- "pick the more fun and easier option for a casual crew of 4".

**The council** (same seats as rounds 5–11; ties go to the chair):

| Seat | Lens |
| --- | --- |
| **Game Designer** (G, chair) | Moment-to-moment fun; does each venue play differently? |
| **Systems/Economy Designer** (E) | Prices, payouts, pacing |
| **Multiplayer/Co-op Designer** (M) | 1–4 Rats, roles, solo |
| **Level Designer** (L) | Readable spaces, lanes, sight lines |
| **Technical Director** (T) | Server-authoritative, zero deps, hot files, Xbox frame time |
| **Casual Crew of 4** (C) | Four friends on a sofa, some on Xbox pads in Edge |
| **QA Lead** (Q) | Bugs, dead ends, softlocks; nothing counts until it's reproduced |

**What the council read:**
- the three round-7 reports and their shots;
- the scorecard's Round 7 section;
- `council-round11.md` and the four round-13 builder notes;
- `game-design.md` where needed.

Code read: `mowe.js` (`BOSS`, `TAME`, `crewHP`, `bossDay`), `today.js` (the contracts), `stadium.js` (`CROWD`,
`SOUV`, `REQ`, `crowdDecay`), `goals.js` (`CARDS`, `tomorrowLine`), `venues.js` (`tiered()`, the deck), `crew.mjs`
(region map, `contractOffers`, `settleToday`, `endShift`'s `left`, `ballsLeft`), `main.js` (the beacon pass, Gary's
bubble, `textBusy`, the floodlights) and `dusk.js` (`outThere`).

**What the council ran:** nothing new. Every number below is a tester's (bots and browser), a builder's, or read from
the code. Each build item names the bot measurement or browser check its builder must take before merge.

---

## 1. Diagnosis

### 1.1 Decision density: why the late game runs itself between beats

Decision density is the weakest number (5.3, −0.4). All three testers describe the same shape: **a loud beat, then
minutes where the crew does nothing different whatever it chooses.** The council found five causes. Each one is a
rule that makes the decision for the crew.

1. **The automation out-plays the crew.**
   - At 1P and 2P the autopilot cart holds the Stadium crowd on its own. In B's IDLE runs the gauge never went under
     0.64 in 160 shifts.
   - At the County the drones eat every stray (0 strays at all 31 bells).
   - So the venue's second gauge only asks something of a 4P crew.
2. **Timers are standing in for choices.**
   - MOW-E's shared 12 s vent at 4P sets the fight's pace. Every 4P Club fight lasts 43–45 s whatever the crew does,
     and hosers spend 45–67 % of their time spraying a shut grille.
   - The plug is a 0.8 s tap.
   - Souvenir requests come in the same order every shift (C, E, A, F, B, D), so after two shifts nobody has to read
     them.
3. **The goal is out of sight.**
   - Endless contracts appear only on the report.
   - The crowd and Zoning are on the Board, but not in the memo or the HUD.
   - The County card says "one goal left" without naming it, for up to nine mornings.
   - A crew can't trade off a target it can't see.
4. **No peak in the middle of a shift.**
   - Once MOW-E 2.0 has run, every late venue's interesting moments are the morning and the bell.
   - The middle of the shift (T−5:00 to T−2:00) is "pick up balls", and that is where the dead minutes are.
5. **Money stops mattering from the Stadium on.**
   - A 4P crew leaves the Stadium with $45M against a $6.6M fee, and the Orbital piles up $226M with nothing to buy.
   - This is real, but it runs through the whole ladder, so the council hands it to the full-game loop (§3, §4).

> G: "A decision is two good options and a clock. Right now the late game has the clock and one option."

### 1.2 What each late venue should ask, every minute

This is the bar for this round's builds. Every late minute should put **one "who goes where" call** on the sofa, and
ignoring it must cost something a crew can see at the bell or in the payout.

| Venue | The call, every minute | The peak (once a shift) | What ignoring it costs |
| --- | --- | --- | --- |
| **Club, boss day** | Who hoses, who blocks, who decoys? Let it eat, or block it now? | The fight, then **the plug scrum** | The catcher's balls; a rematch |
| **The Stadium** | Deliver this souvenir now (×3), or hold it for the Stretch (×5)? Who's nearest the lit section? Lap, or deliver? | **The Seventh-Inning Stretch** (T−3:30) | The crowd falls under the line at **every** crew size |
| **The County** | Spray here, or wait for a cluster to chain? Go to the inspector's Yard, or the busy one? | **Inspection Hour** (T−3:30) | Zoning; a doubled hazard count at the bell |
| **The Orbital** | Debris, tether or Lift (already fine: B and C called it brisk) | Ball No. 1's fall, now **a race to a gold beam** | — |
| **Endless** | Play safe for the contract, or push cash to catch Site 13? | **Site 13's live number** passing yours, or yours passing theirs | Stars, the week against Site 13 |

**Measure it** (Q, for every brief that touches a venue): the bot's event tally counts **calls a minute**. A call is
any lit request, Stretch section, inspector Yard, hazard cluster, boss phase or contract tick that a Rat can act on.
- Target: **≥ 1 a minute at 1P and ≥ 1.5 a minute at 4P**, at the Stadium and the County.
- Plus a consequence check: a bot that ignores the call must lose **≥ 10 %** of the payout, or the gauge.

### 1.3 The rest, briefly

- **The boss at 4P is a cooldown timer** (A #1–#4): one shared vent, a 0.8 s plug, a payoff that happens 55 m away,
  and a build-up you hear but can't see. The pet brings in 6–10 balls a shift against the council's 30–80. Solo, the
  boss is good. At 4P it is waiting.
- **The ending lands, but it is described more than seen** (C #1, #3, #4):
  - "follow the beam" points at the Target Greens' beams;
  - the crack is half-covered by your own bucket;
  - Gary rides a Lift nobody can see.
- **Endless has no reason to play past day 3** (C #2):
  - the 3★ contracts can't be won (0 of 10);
  - "left" is counted three different ways;
  - the first cosmetic is 10★ away, and the best crew had 4★ after six days.
- **The look** (A #7, #8; B #8; C #3): the Tiered deck's underside is a black slab over the top third of the
  first-person view at the Stadium, the County and the Orbital spawns. It also hides the Lift. The Stadium
  floodlights draw as black squares.
- **Text load is fixed** (7.3). Two places still break the one-centre-text rule:
  - the PA card under the story card on Stadium day 1 (A #6);
  - the PA card under the end card (C #7).

  New centre text this round is budgeted line by line: **two new ALERTs a shift at most** (§2, items 2 and 7).

---

## 2. Build this (ranked)

Ranked by fun per effort for a casual crew of 4, with the owner's calls first.
- Sizes: **XS** < 1 hour · **S** an evening · **M** two evenings.
- Every item adds its tests to `node --test test/`, runs `make preflight` (WSL), and appends its section to
  `game-design.md` in the same commit.
- **No new RNG draws** in anything that runs at the Muni or the Club before the boss. Use `hash32` from the day and
  venue day, as `contractsFor` does, so the seam goldens move only where the council expects. The lead re-records them
  once, after the merge.
- Every new centre line is ≤ 8 words, with a `test/words.test.mjs` entry.
- **Every browser check is taken with the pane fronted.** Round 7's testers lost timing and shots to a hidden pane's
  rAF stall.

| # | Item | Size | Builder |
| --- | --- | --- | --- |
| 1 | MOW-E at 4P: your own hit meter, more HP, the plug tug-of-war | M | 1 |
| 2 | The Stadium: the crowd needs you at every size; the Seventh-Inning Stretch | M | 2 |
| 3 | The ending, on camera: the gold beam, the crack, Gary in the Lift, the glass case | M | 3 |
| 4 | The look: the black slab, the floodlights, one centre text (Stadium day 1, the end card) | S–M | 4 |
| 5 | MOW-E: a build-up you can see, the payoff in frame, a pet worth having | S–M | 1 |
| 6 | Endless contracts you can see and win | S | 3 |
| 7 | The County: Inspection Hour and spray chains; both venues name their gauge | S | 2 (+4 for the memo and HUD) |
| 8 | Site 13, the live endless rival | S–M | 3 |
| 9 | The fixes pack | S | 4 (lines to 1, 2, 3) |

**The cut line, if the night runs short:** items 1–7 ship. Item 8 is the first to slip, then item 9's Low rows.

---

### 1 · MOW-E at 4P: your own hit meter, more HP, the plug tug-of-war — M · builder 1

*The owner's call. A #1–#3. Solo and 2P already work; 4P is a cooldown timer.*

**1a. Your own hit meter (this replaces the shared vent).**
- **Each Rat has their own hit meter** on the grille. Your spray fills *your* meter:
  - it takes 2.0 s ÷ your nozzle's `washRate`;
  - it's twice as fast while MOW-E is stalled, as now.
- **A full meter is your hit.** One pip goes, credited to you, and **your** nozzle cools for **8 s**: your stream
  sputters grey, with a hiss.
  - Everyone else keeps spraying. **There is no shared vent.**
- **Crossfire.** While 2 or more Rats are spraying the grille in the same tick, every meter fills **×1.25**. That's
  "both on it NOW" as a reward, not a gate, so a casual swarm still wins.
- **A global stagger of 1.0 s** after any hit: no meter fills. This keeps three pips from going in the same 0.1 s.
- **Meters decay** at 0.5/s after 1 s without spray, so nobody banks a 90 % meter across a bolt.
- **The bolt** (5.5 m/s for 2.5 s after a harvest hit) fires **at most once every 8 s** (`BOLT_COOL 8`), so the
  hosers aren't chasing for the whole fight.
- **What you see (no text):**
  - a thin ring around your crosshair fills with your meter;
  - when it cools, the ring goes grey and empties over 8 s;
  - the grille's glow follows the **fullest** meter on it, so the crew sees a hit coming.

**1b. HP by crew size** (`crewHP`). This keeps the 4P fight long enough to *share*, not long enough to drag.

| Crew | HP now | **HP** | Hunt speed | Fight target (s) |
| --- | --- | --- | --- | --- |
| 1P | 3 | **3** | 4.0 | 45–75 |
| 2P | 3 | **4** | 4.2 | 45–70 |
| 3P | 4 | **6** | 4.4 | 50–70 |
| 4P | 4 | **7** | 4.6 | **50–70** |
| 5–6P | 5 | **8** | 4.8 / 5.0 | 50–75 |

The encore (MOW-E 2.0) keeps **+1 HP** and +10 % speed. Phase 2 still starts at half HP (rounded up), or after 40 s.

**1c. The plug, a tug-of-war.**
- At HP 0 it chokes, and the ring appears at its back as now. Then **MOW-E tries to crawl home**: it moves toward its
  shed at **1.0 m/s**, dragging the ring with it.
- **The pull bar** fills from 0 to 1 at **(holders ÷ crew online) ÷ 3 s**:
  - everyone holding finishes it in **3 s** at any crew size (solo 3 s; 4P with all four, 3 s);
  - 3 of 4 holding take 4 s; 2 of 4, 6 s.
- **A Rat holding Ⓐ in the ring walks at 2.0 m/s**, so the holders walk with it. Step out of the ring (1 m of slack)
  and you stop counting.
- **It yanks.** Every 1.5 s it lurches: the ring jerks 0.5 m and the bar loses **0.06** *unless at least half the crew
  is holding*. A lone holder at 4P still wins, but slowly (~20 s), and it's obvious why.
- Let go entirely and the bar drains 0.1/s. The 10 s idle reboot stays (it never fired in 40+ fights, and it's the
  safety net).
- **The look and sound:**
  - the ring's gold sweep is the bar;
  - the Board reads `PULL! ■■■□`;
  - a rope creak rises in pitch with the bar, the bass drops out (`bossLoop` 144 BPM), and the heartbeat kick gets
    faster.
- The centre line is unchanged ("Pull the plug! Hold Ⓐ at its back!").

**Why it's fun.**
- Every hoser lands hits, and a missed hit is your aim, not the clock.
- "Both on it NOW" pays.
- The finish is the three-second scrum the round-11 council wanted, with all four Rats walking a smoking mower
  backwards while it yanks.

C: "That's the bit we'll do the voices for."

**Files:** `web/js/mowe.js` (`BOSS`: `METER`, `COOL_ME 8`, `CROSSFIRE 1.25`, `STAGGER_ALL 1.0`, `DECAY 0.5`,
`BOLT_COOL 8`, `PULL_SECS 3`, `CRAWL 1.0`, `YANK 1.5 / 0.06`, `HOLD_WALK 2.0`; `crewHP`; `hoseBoss`; `stepBoss`'s
plug), `web/js/mower.js` (the ring sweep, the yank jerk), `web/js/sfx.js` (the creak). Plus `server/crew.mjs`'s
`stepMowe` region and `main.js`'s mower regions (see §2a).

**Verify:**
- `test/boss.test.mjs`:
  - meters are per Rat, and a hit cools only the scorer;
  - crossfire ×1.25;
  - the global 1.0 s stagger;
  - decay;
  - the bolt cooldown;
  - the HP table;
  - the pull rate by holders ÷ crew;
  - the yank needs half the crew to resist;
  - holders walk at 2.0 m/s;
  - the reboot still fires after 10 s idle.
- **Bot.** Use `scripts/bots/pt7a-boss.mjs` (A's time and credit tally): Club day 3 and the Stadium encore, seeds
  7 / 11 / 23 plus 31 / 41 / 53, every policy.

  | Measure | Target | Round 7 |
  | --- | --- | --- |
  | 4P fight (burst → tamed) | 50–70 s | 43–45 s |
  | Hoser time spraying a cooled nozzle | ≤ 15 % | 45–67 % (vent) |
  | Spray that counts | ≥ 25 % | 4–7 % |
  | Every Rat lands ≥ 1 hit, 4P | ≥ 5 of 6 fights | 0 of 6 |
  | Plug, 4P (`4p-swarm`, all holding) | 3–5 s | 0.8–1.0 s |
  | Win rates | unchanged targets (`4p-roles` 100 %, swarm ≥ 90 %, 2P ≥ 85 %, `1p-cart` ≥ 85 %, `1p-chase` ≥ 60 %) | met |
  | Solo, `PERFECT=1` | ≥ 38 s (not faster than the 4P floor by much) | 32 s |

- **Browser:** a 4P fight. Use the dev crew endpoint with three bot seats if the pane can't seat four Rats, or play
  solo and 2P if not. Take shots of:
  - your meter ring mid-fill;
  - a cooled ring;
  - the plug with the ring dragged ≥ 2 m from where it started.

  Each must show at most one centre element.

---

### 2 · The Stadium: the crowd needs you at every size; the Seventh-Inning Stretch — M · builder 2

*B #1–#3, #11, #12. The crowd is the Stadium's co-op partner, and today the autopilot plays it alone.*

**2a. The autopilot has a ceiling, and missed requests lower it.**
- The autopilot's laps and pings can lift the crowd **only up to 0.60** (`AUTO_CEIL`). Above that, its credit is 0.
  Human laps, pings and souvenirs lift it to 1.0 as now.
- **Each missed request lowers the autopilot's ceiling by 0.04 for the rest of the shift.** The fiction: the crowd
  gets bored of the robot.
  - Feed line on the first drop: "The crowd's bored of the robot."
  - No centre text.
- The numbers:
  - **Solo**, ~4 requests a shift: ignore them all and the ceiling falls to 0.44, under the 0.50 line, so DENIED.
    Answer one and it's 0.48 + the answer's +0.15 bump, which passes for a crew that does anything.
  - **4P**, ~7 requests: ignore them all and the ceiling falls to ~0.32. 4P's drain already bites, so this mainly
    stops the autopilot rescuing it.
- E: "The line moves from 'the robot handles it' to 'answer one in four and you're fine'. Easy, but not free."

**2b. "Answer 6 requests" goes on the card; the laps goal comes off.**
- The Stadium card is `[laps, pings, cart2, reviews 2, fee]` → **`[requests, pings, cart2, reviews 2, fee]`**.
- `requests` is a `count` goal: **6** at 4P, scaled by `SCALE`, so 3P 5, 2P 4, 1P 3 (rounded up).
  - It counts any souvenir delivered into a lit section, Stretch sections included.
  - Text: "Answer 6 souvenir requests" · more "2 more requests" · short "6 requests".
- **Why:** this removes the 4P human-laps gate (B #2–#3: a 4P crew's Stadium length was set by a laps chore) and puts
  the venue's signature job on the card. Laps stay the crowd's tool, not a goal.

**2c. The Seventh-Inning Stretch: the Stadium's peak.**
- **When:** once a shift at **T−3:30** (shiftT 210 s of 420). Normal requests pause for 30 s around it.
- **What:**
  - **Three sections light at once** for **25 s** (two at 1P and 2P);
  - each pays **×5** (W 25 × 5 = 125 ball-weights a souvenir) and **+0.15 crowd**.
  - A missed Stretch section costs −0.03 crowd, with no boo (it's a party).
  - Which sections: `hash32(day, venueDay, 's')`, and at least one on each side.
- **The look:**
  - every lit section waves;
  - the stands' crowd stands up (the bob goes to max for 25 s);
  - the jumbotron reads `SEVENTH-INNING STRETCH · A C F · 0:25`;
  - an organ riff (`sfx.js` owner: builder 1, a hand-off; until it lands, use `jackpot` + `bell(784)`).
- **One centre ALERT:** "Seventh-inning stretch! Three sections want balls!" (7 words; "Two sections" at 1–2P).
- **The decision this creates:** souvenirs drop at random (`SOUV.CHANCE` 0.10) and a Rat holds up to 3. "Deliver
  this one now at ×3, or sit on three for the Stretch at ×5?" At 4P it's a split: "you two take A and C, I've got F".

**2d. The answered request is loud and personal.**
- On a lit delivery the jumbotron shows **`<NAME> · LEGEND · SECTION C`** for 3 s. The section waves (already built)
  and the crowd cheer swells.
- The line comes through builder 4's `board.overlay` (a hand-off: builder 2 sends `{ t: 'crowd', kind: 'req', by }`;
  builder 4 draws it).

**2e. Requests you can't miss, in an order you can't learn.**
- `REQ.ORDER` is rotated per shift by `hash32(day, venueDay, 'r')`. There's no RNG draw.
- **A gold beam over the lit section**: `views/souvreq.js`, one cylinder, the beacon look at 20 m tall, pulsing. It's
  visible from under the deck and from the mats (B #12: the banner was a sliver at the bottom of the screen).
- The first request each shift plays a short crowd chant. Later ones are feed-only, as now.

**2f. The crowd stops at the Stadium.**
- The Stadium crowd's drain and its "THE CROWD IS BORED" toast stop after venue 3 (C #8: it fired in endless).
- The County keeps its own stand hidden as now.

**Why it's fun.** The crowd becomes something you play *to*, at every size, with one moment in the middle of the
shift that everyone runs for. It also gives souvenirs a decision (hold, or deliver now) instead of a habit.

**Files:**
- `web/js/stadium.js` (`AUTO_CEIL`, `CEIL_MISS`, `STRETCH`, the rotated `reqSection`);
- `server/venues/stadium.mjs` (the ceiling, the Stretch, the venue gate);
- `web/js/views/stadium.js` and `web/js/views/souvreq.js` (the beam, the Stretch's three sections, the crowd standing);
- `web/js/crowd.js` if the standing bob lives there;
- `web/js/goals.js` (the `requests` goal and the Stadium card; builder 2 owns `goals.js` this round).

**Verify:**
- `test/late.test.mjs`:
  - the autopilot can't lift past 0.60;
  - a miss lowers the ceiling by 0.04;
  - the Stretch fires once at 210 s, lights 3 sections (2 at 1–2P) on both sides, pays ×5, and pauses requests;
  - the order rotates by day with no RNG draw;
  - the requests goal is scaled by `SCALE`;
  - no crowd drain or bored toast past venue 3.
- **Bot** (`late11.mjs` from `stadium1`, 1P / 2P / 4P × seeds 7 / 11 / 23):

  | Mode | Target | Round 7 |
  | --- | --- | --- |
  | `IDLE` (autopilot only), 1P and 2P | crowd under the line at the bell in **≥ 1 of 2** shifts | never |
  | Answers ≥ half the requests, 1P | APPROVED ≥ 90 % | — |
  | `JOB1` / `WAIT`, 4P | Stadium length **2–3 shifts** (no laps gate) | 2–4 (gated on laps) |
  | `WAIT` (holds for lit sections), 4P | answers ≥ 2 of 3 Stretch sections in ≥ 2 of 3 shifts | — |
  | Calls a minute (§1.2) | ≥ 1 at 1P, ≥ 1.5 at 4P | ~0.7 / 1.3 |
  | Souvenir share of 4P income | 18–28 % | 17–19 % |

- `textload.mjs`: Stadium shifts get **at most one new centre item**, the Stretch.
- **Browser:** a Stadium shift at T−3:30 (shot of the Stretch: three beams, one ALERT), and a lit section seen from the
  spawn under the deck (after item 4's fix).

---

### 3 · The ending, on camera — M · builder 3

*C #1, #3, #4, #11 and C's glass-case idea. The ending is the best 10 seconds in the game; three of its moments
happen off-screen.*

**3a. A real gold beam on Ball No. 1.**
- While `lb.phase === 'down'`, Ball No. 1 gets **a gold beacon 25 m tall**. It uses the `beaconMesh` instance path
  (scale y ×2.8, radius ×2, pulse ±12 % at 0.5 Hz, colour `#ffcf5a`), so it costs no new draw call.
- While it's **carried**, a short 4 m gold pillar rides over the carrier, so the rest of the crew can see who has it
  and walk with them to the return.
- **While Ball No. 1 is down or carried, the Target Greens' beams are hidden.** They're the beams players followed
  the wrong way (C #1).
- The banner reads **"BALL NO. 1 IS DOWN · follow the gold beam"** (`huddlerules.js`; builder 3 owns it this round).

**3b. Frame the crack.**
- On the bank, for the hush and the note (about 10 s), **the carried bucket and wand are hidden** for every Rat
  within 15 m of the return.
- **Every Rat's camera eases over 0.8 s** to look at the hopper lip from 1 m further back and 0.3 m higher. This is a
  look-at, not a cut: no control is lost, and it releases when the note card ends.
- **Lift the crack** out of the chute's glass: y ≈ 1.9, rotated to face the stand's front (round13-story open issue
  4). The paper curl rises in frame.
- **The note card draws in the upper third** during this beat (`storycard.js` `pos: 'high'`). The halves and the paper
  stay in the middle of the frame. It's still one centre element.
- **At 4P**, the huddle ring stands farther off. The look-at target is the same lip, so every Rat sees it.

**3c. Gary in the Lift, in the shot.**
- On the Orbital promotion morning, the reveal camera's path (`round2.js`) **ends on the Lift**:
  - a pose ~25 m from (−44, 5), framing the car;
  - timed so the car is in the air with Gary on the roof during card 2, "Gary rides the Lift. Tie flapping.";
  - Gary's cameo is scaled ×1.3 for this ride, so he reads at 800 × 600.
- Then the camera hands back to the Rat as usual. Item 4's slab fix also opens the Lift to the spawn's view.

**3d. The opened Ball No. 1 in a glass case at the return.**
- From the bank on, **the two gold halves sit in a small glass case by the return** (`views/glasscase.js`, new):
  - a plinth;
  - a transparent box;
  - a canvas plaque reading **"BALL No. 1 · 1958–2026 · FOUND BY"** and the crew's names.
- **Each owner record day adds a line** to the plaque ("Day 4 · $91.2M"). It shows the newest four, so the crew's
  history visibly grows.
- **On the first endless morning:**
  - the reveal camera ends on Gary standing beside the case, **facing the stand** (C #11: he stood with his back to
    the crew);
  - his bubble is the existing "Where do these go, boss?".
- **Save:** `story.case = { names, year, lines[] }`. An old save past the bank builds it from the crew's current
  names.
- **Rejoin:** a `firstOwnerDay` flag in the snapshot restores Gary at the return (round13-story open issue 3).
- **Cost:** +3 draw calls, built once, with the plaque redrawn only when a line is added.

**Why it's fun.**
- The hunt becomes a race to a light.
- The crack is in frame for every Rat.
- Gary's two best visual beats get seen, not described.
- The glass case keeps the game's heart on the range for the whole of endless.

C: "That's the screenshot."

**Files:**
- `web/js/ending.js` (the crack's pose, the case's halves);
- `web/js/round2.js` (the reveal camera's Lift pose and its endless end pose; the lastbucket hush hide and look-at, if
  that lives there);
- `web/js/views/orbit.js`, `web/js/views/garycameo.js` (scale, facing);
- new `web/js/views/glasscase.js`;
- `web/js/storycard.js` (`pos: 'high'`);
- `web/js/huddlerules.js`;
- `web/js/story.js`.
- `main.js`: only the beacon pass (~l.474–503) and the carried-gear hide.
- `crew.mjs`: `depositOne` (the case's names), the epilogue lines in `startShift`, and one snapshot line
  (`firstOwnerDay`).

**Verify:**
- Tests:
  - the beacon count includes Ball No. 1 while it's down, and excludes the Target beams then;
  - the banner is ≤ 28 characters per segment and ≤ 8 words;
  - the case's plaque lines cap at 4;
  - the save round-trips `story.case`;
  - an old save builds the case.
- **Browser** (fronted pane, `lastbucket` preset, solo):
  - from the stand, the gold beam is visible the moment Ball No. 1 lands (shot);
  - at the hush, the halves and the paper are both in frame with no bucket (shot);
  - the note card sits above them.
- **Browser** (`orbital1` promotion morning): Gary is **≥ 40 px tall** in a shot taken during card 2.
- **Browser** (first endless morning, made properly; see item 9's preset fix): the reveal ends on Gary and the case,
  with one centre element.
- `?perf` p95 ≤ 20 ms at the return with the case in view.

---

### 4 · The look: the black slab, the floodlights, one centre text — S–M · builder 4

*A #6–#8, B #8, C #3, #7, #11. The owner sees the slab every shift from the Stadium on.*

**4a. The black slab.**
- The Tiered deck (`venues.js` `tiered()`) has its floor box at y 2.85, z 2–6, x ±20, and legs every 3.92 m. The
  spawn is (23, 2), and Rats line up leftward at 1.2 m each. So the deck's right end, its last leg (x ≈ 19.6) and its
  unlit underside sit right in front of the clock-in view.
- **The fix, in order** (stop when the check passes):
  1. **Light the underside.** The floor gets a separate underside face: wood, `emissive 0x2a2218`. The back wall goes
     from `0x23252d` to a mid grey. Black-on-black is what reads as a void.
  2. **Move the late venues' clock-in** (venues ≥ 3) 4 m toward +z, out from under the deck's line. Check it against
     the stairs, the washer and the Stadium rails (L).
  3. **A cutaway:** when the camera is under the deck (x within ±20, z 2–6), the deck floor's material fades to 35 %
     opacity. It's one material, so there's no new draw call.
- **The Lift sight line.** From the spawn, the Lift (−44, 5) must be visible above the deck at the Orbital. Check
  after step 1 or 2.

**4b. The Stadium floodlights.** These are the black squares with grey discs: a texture without alpha. Give the
flare sprite `transparent: true` with an alpha-edged canvas (or additive blending, `depthWrite: false`). Also trace
the `THREE.Quaternion.setFromEuler unknown order` warning that floods the console at the Stadium (round13-fixes).

**4c. One centre text, everywhere.**
- **Stadium day 1** (A #6): a story card must never show while a PA card is up.
  - `say.js` gains a **"PA idle" signal**.
  - A story card that takes the turn first **closes the PA card** (a 150 ms snap, as 8.6 does for cards) and holds
    the PA's audio caption until the card ends. Or it waits for the PA to close, if that's ≤ 2 s away.
- **Under the end card** (C #7, round13-story open issue 1): the end card waits for the PA idle signal (cap 2 s), and
  the $∞ flash's fade finishes before the PA card shows.
- **The first endless morning** (round13-story open issue 2): the PA card and the memo showed together once. That's
  the same signal.
- **Stadium day 1's density** (A: four jumbotron jokes in ~20 s): cut the reveal PA "Your Ball Value is on a
  jumbotron." The newsreel card says it. (`pa.js`; builder 4 owns it this round.)

**4d. The newsreel plays to somebody** (A #9). On the Stadium promo, the reveal camera faces the Board while card 1
("The jumbotron plays a 1958 newsreel") is up. That's a pose number in `round2.js`, a one-line hand-off to builder 3.

**Why it's fun.** The late game's best looks (the stands, the jumbotron, the Lift) are behind a black slab today.
And the owner's one rule about text has two leaks.

**Files:** `web/js/venues.js`, `web/js/say.js`, `web/js/pa.js`, `web/js/sim.js` (`SIM.SPAWN`: the late-venue
clock-in offset; if the offset has to be applied in `crew.mjs`'s join line, it's a one-line hand-off to the lead), and
the floodlight flare (`venues.js` `stadium()` or `main.js` ~l.294; builder 4 owns both regions).

**Verify:**
- **Browser** (fronted pane): first-person shots at the Stadium, County and Orbital spawns, and at mat 5. The deck
  underside covers **≤ 10 % of the frame**, and nothing in frame is pure black over more than 5 %. Count it with a
  pixel pass over a canvas readback in `?debug`.
- **Browser:** a Last Call at the Stadium shows no black squares.
- `test/say.test.mjs`:
  - a story card while a PA card is up closes the PA card (one centre element);
  - the end card waits ≤ 2 s for PA idle.
- `textload.mjs`, extended (item 9): **0 overlaps** on Stadium #1, the bank sequence and the first endless morning.

---

### 5 · MOW-E: a build-up you can see, the payoff in frame, a pet worth having — S–M · builder 1

*A #3–#5, round13-mowe open issue 1. A boss moment is dread before, a bang during, and a trophy after.*

**5a. Dread all morning.**
- **The boss morning's memo, second line:** **"MOW-E is downloading an update."** (5 words). It goes through
  `memoSecond`'s MOW-E slot, which is already in the priority order, and builder 4 adds the text to `sim.js`.
- **The Board's banner, from the bell to the warn:** `MOW-E UPDATE ▓▓▓░ 64 %`. It ticks to 100 % at the warn, through
  `bossBoard`, and needs no new Board code.
- **The near lanes' red stripes show from the morning**, not just in the warn: something is coming, and you can see
  where.
- **The warn (15 s):**
  - every Rat gets **an amber screen-edge pulse on the side facing the shed**, 3 pulses, 2 s apart. It reuses the red
    edge element in amber.
  - The boss loop's low drone starts at 0:15, under the beeps.
- No new centre text: the PA caption is still the warn's one line.

**5b. The payoff where the crew is.**
- **On TAMED, the catcher bursts on the spot.** Every eaten ball fountains out within 8 m of the plug ring as a
  resting **"MOW-E ball"**, worth ×2 (the ×2 moves from an auto-bank to a pickup). That's a 10–15 s grab, right
  there.
  - Any not picked up by the bell bank ×1 at the bell (no Spotless penalty), so nobody is punished for cheering.
- **The gold balls** (one per Rat) land **within 6 m of the ring**, not at the return.
- **MOW-E limps past the crew to the pond** at 6 m/s (`LIMP` 4 → 6), so it takes ~9 s. Every Rat gets a 2 s
  screen-edge chevron pointing at it. **The pond PA plays on the splash**: ≤ 10 s after the stamp, against 12 s and out
  of frame today.
- Centre text: the stamp, then the pond caption. Nothing in between.

**5c. Letting it eat becomes a choice.**
- **It eats one ball every 0.6 s** (`EAT_EVERY`), not everything within 3 m at once. An unblocked harvest fills the
  catcher of 30 in ~18 s, and an early block really does shrink it.
- **The Board shows the catcher:** `MOW-E · ■■■■□□□ · ATE 12`.
- E's payout target (A #3, round13-mowe open issue 2): **median ≤ 14 %** of the 4P Club shift (round 7: 17.6–19.1 %).
  The ×2 now has to be picked up, which trims it.

**5d. A pet worth having.**
- **Three passes a shift** (20 %, 45 %, 70 %), not two.
- **Each pass seeks the richest spot** (the harvest's `richest`, within the field box), not the old six lanes. It
  gathers ±3 m along its drive, up to 25 a pass, and banks at the nearest return.
- **The whistle, once a shift:**
  - a "MOW-E" post at the return;
  - Ⓐ / Space there gives the prompt "Ⓐ: whistle for MOW-E";
  - he makes a bonus pass to the richest spot **now**.
  - The decision is *when*: save it for the dusk scramble and it buys Spotless.
  - The Board says `MOW-E · ON HIS WAY`.
- E's target: **30–60 balls a shift** (3–6 % of supply) with the whistle used. It's a pet, not a drone fleet.

**Why it's fun.** You see the update coming all morning. The fight's reward lands at your feet in the same breath as
the stamp. The mower you beat is the crew's dog for the rest of the game, with one button that's yours to time.

**Files:** `web/js/mowe.js` (`EAT_EVERY`, `LIMP`, `TAME.AT` × 3, `TAME.SEEK`, `TAME.CAP 25`, `WHISTLE`, `bossBoard`'s
update bar), `web/js/mower.js` (the morning stripes, the fountain at the ring), `web/js/sfx.js` (the drone, the
whistle). Plus `crew.mjs`'s `stepMowe` region, and `main.js`'s mower regions (the amber edge, the chevron, the whistle
prompt).

**Verify:**
- `test/boss.test.mjs`:
  - eating is one per 0.6 s;
  - MOW-E balls land within 8 m and gold within 6 m of the ring;
  - the pond event comes ≤ 10 s after `tamed`;
  - the tame pass has 3 passes and seeks the richest spot;
  - the whistle works once a shift;
  - the update bar reaches 100 % at the warn.
- **Bot** (`boss.mjs` and `pt7a-boss.mjs`, then 4-day runs):
  - eaten at 4P differs between `4p-roles` (blocks) and `4p-swarm` (doesn't) by **≥ 8 balls** median (round 7: no
    difference);
  - payout median ≤ 14 %;
  - pet **30–60 balls a shift** with the whistle at T−90 (round 7: 6–10).
- **Browser:**
  - a shot at the warn from the washer (36, 3): the amber edge on the shed's side, the striped lanes in frame;
  - a shot 1 s after the stamp: balls in the air around the ring;
  - a shot of the splash, taken by following the chevron.

---

### 6 · Endless contracts you can see and win — S · builder 3

*C #2. The daily pick is the only endless decision, and today it picks from goals you can't see or meet.*

**6a. One count for "left".** `ballsLeft()` everywhere:
- the report's `left` (`endShift`, today `balls.size`);
- the contract (`settleToday`);
- the Spotless bonus (already);
- the dusk's "N left out there", which reads the server's `left`.

`dusk.js` `outThere` stays as the client's draw filter. A test pins the report, the contract and the dusk line to one
number. Round 7's report read "SPOTLESS RANGE" under "49 left out there".

**6b. Goals you can meet, three tiers.** First, log `ballsLeft()` at the bell over 12 endless shifts (an attentive
bot, 1P and 4P). Then set each tier at a percentile, so:

| Stars | Meet rate (attentive bot) | Goal pool |
| --- | --- | --- |
| 1★ | 80–90 % | Bank yesterday × 0.85 · at most 6 knockdowns · at most *P75* balls left |
| 2★ | 50–65 % | Bank yesterday × 1.0 · at most 2 knockdowns · at most *P40* left · **reach ×2 Hustle** |
| 3★ | 25–40 % | Bank yesterday × 1.1 · nobody knocked flat · at most *P10* left · **×3 Hustle before T−3:00** |

The Hustle goals give the ping game a reason to exist in endless (C: the mult stayed at 1 all endless). Check that
`hustle` reaches ×3 in an endless shift with pings; if it can't, use "a 6-ping streak".

**6c. See it all shift.**
- **The memo's second line** on an endless morning names the contract: **"Contract: at most 2 knockdowns."** It takes
  the Today slot, since the contract carries the modifier anyway.
- **The Board** shows a contract line under the price: `★★☆ AT MOST 2 KNOCKDOWNS · 1 SO FAR`. When it's met it turns
  gold (`★★☆ MET`). When it's broken mid-shift it's struck through, and the feed says "Contract lost."
- **Pause** shows it too (the recap panel's existing contract row).

**6d. Cosmetics more often.**
- `CONTRACT.PER_UNLOCK` 10 → **5**, and the first at **3★**.
- The `COSMETICS` ladder is re-spaced at 3, 8, 13, … (ten looks over ~45★).
- At ~2★ a day that's a new look every 2–3 days. The report's unlock line already exists.

**6e. The preset.** Builder 4's preset fix (item 9) makes "Skip ahead → Endless" start a true first endless morning,
with no "Bank $71M" 1★ built from the Orbital record.

**Why it's fun.** The daily pick becomes a real "safe or greedy?" vote. Every shift has a target ticking on the Board
that changes how you play: careful near customers on a knockdown day, chasing pings on a Hustle day.

**Files:** `web/js/today.js` (builder 3 owns it this round: `GOALS_BY_STARS`, `goalText`, `contractMet`, `CONTRACT`,
`COSMETICS`), `web/js/recap.js`. In `crew.mjs`: the Today/contracts region (~l.1220–1280) and `endShift`'s `left`
(~l.2398). The Board line is a hand-off to builder 4 (`board.js`), and the memo line to builder 4 (`sim.js`
`memoSecond`'s `contract`).

**Verify:**
- `test/today.test.mjs`:
  - one left count;
  - goal text ≤ 8 words;
  - the Hustle goals;
  - every 5★ unlocks, the first at 3.
- **Bot** (`pt7c-endless.mjs`, `PICK=0|1|2`, 1P and 4P, 6 endless days from the fixed `endless` preset):
  - meet rates by tier inside the table's bands;
  - **≥ 1 cosmetic by endless day 3** at 4P, picking 2★;
  - the report's `left` equals the dusk line in every run.

---

### 7 · The County: Inspection Hour and spray chains; both venues name their gauge — S · builder 2 (+ builder 4)

*B #4, #5, #7, #9 and B's ideas 3–5. The County is the late game's best co-op (B: "every minute has a 'who goes
where' call"), so it gets a peak and a skill ceiling. Both late venues then say what they judge.*

**7a. Inspection Hour: the County's peak.**
- **When:** once a shift at **T−3:30** (210 s), for **60 s** (75 s solo).
- **Who:** an FHI inspector (the `people.js` figure, clipboard, sunglasses) walks **the Yard with the most hazards**.
- **In that Yard, for those 60 s:**
  - a bagged hazard pays **×3** and gives **+0.04 Zoning**;
  - any hazard still in it when he leaves is **"noted"**: −0.05 Zoning, and it **counts double at the bell**.
- **The Board:** `INSPECTION · YARD 2 · 0:45`.
- **One centre ALERT:** "Inspection! Clean Yard 2 before he leaves!" (7 words).
- **The decision:** at 4P, two Rats go to the inspector's Yard and two keep the others. Solo: "his Yard, or the one
  that's overflowing?"
- The fiction is Site 13 comedy: the memo after a clean inspection reads "The inspector was impressed. He's from
  Site 13." (8 words, the flavour slot).

**7b. Spray chains.**
- **A spray wets every hazard within 3 m** of the one you hit, not just that one.
- **Bag 3 wet hazards within 6 s** for a "CLEAN SWEEP": a feed line, a chime, and ×2 on the third.
- Solo, it rewards waiting for clusters. At 4P it's a sprayer-and-sweeper rhythm.

**7c. The tip names the button** (B #9). "Green hazard: hold RT with the wand, then bag it." Use the real binding
from `padbind.js`, and "Click" on a keyboard. (`settings.js` HINTS; builder 2 owns `settings.js` this round.)

**7d. The card names the missing goal** (B #5).
- `goals.js` `tomorrowLine`, when **one** goal is open, names it: **"Tomorrow: one more good day for the Orbital."**
  (8 words). It uses the goal's `more()` text: "Tomorrow: 40 more strays for the Orbital.", and so on.
- When the open goal is `reviews` at the Stadium or the County, the report's gauge row adds what failed ("Zoning 41 %
  at the bell"), which already exists.

**7e. The memo and the HUD name the venue's gauge** (B #7) — **builder 4**:
- **The memo's first line:**
  - Stadium: **"Today: 35% clean. Crowd over half."** (6 words);
  - County: **"Today: 35% clean. Zoning over half."**
- **The HUD strip** (`bvLine`) adds the gauge: `$1,295 a ball · 69% clean · crowd 82%` / `· Zoning 62%`. The gauge
  turns red under 50 %.

**Why it's fun.** The County gets the Stadium's mid-shift moment, and a 4P crew ignoring hazards has something to
chase (round 7: 6–12 shifts of the same bell). Spray chains turn 20 errands into a rhythm. And nobody loses a review
to a number the morning never mentioned.

**Files:**
- `web/js/county.js` (`INSPECT`, `CHAIN`), `server/venues/county.mjs`, `web/js/views/county.js` (the inspector);
- `web/js/goals.js` (`tomorrowLine`);
- `web/js/settings.js` (HINTS).
- **Builder 4:** `sim.js` (`memoText` by venue), `bvtext.js` (`bvLine`), `main.js`'s HUD strip.

**Verify:**
- `test/late11.test.mjs`:
  - the inspector comes once at 210 s to the busiest Yard;
  - ×3 and +0.04 inside it;
  - a noted hazard is −0.05 and counts double;
  - a chain wets within 3 m;
  - CLEAN SWEEP on 3 in 6 s;
  - `tomorrowLine` names a single open goal in ≤ 8 words.
- `test/sim.test.mjs`: the venue memo lines.
- **Bot** (`late11.mjs` from `county1`, 1P / 2P / 4P × 7 / 11 / 23):
  - `JOB1` still clears in 2 shifts;
  - 4P `JOB0` (ignores hazards) **≤ 6 shifts** (round 7: 6–12);
  - with `INSPECT=1` (attends the inspector), income +10–20 % over `JOB1`;
  - calls a minute ≥ 1 at 1P and ≥ 1.5 at 4P.
- `textload.mjs`: at most one new centre item (the inspection ALERT).
- **Browser:** the inspector in a Yard with the Board countdown (shot); the Stadium memo naming the crowd; the HUD
  with "crowd 82%" (shots).

---

### 8 · Site 13, the live endless rival — S–M · builder 3

*C's idea 3. Endless needs a reason to play days 3+, and the comedy thread has a face ready.*

**What to build.**
- **From endless day 2, the Board shows Site 13 racing you live:** `SITE 13 $41.8M (est.)` under your total.
  - Their number climbs through the shift on the same curve as yours (`owner.js` `racePace`, with a Last Call surge).
  - It aims at **1.04 × your average for the last 3 owner days**, with ±6 % from `hash32(day)`. On day 2 it's your
    day 1.
- **The race replaces "beat yesterday"** as the report's headline. Yesterday stays as a row. This is one race, and
  it's clearer.
- **The live moment:** the first time your total passes theirs, the feed says "Passed Site 13." and the Board flashes
  once. No PA, and no centre text.
- **The bell:**
  - win: "Site 13 revised its estimate." (5 words);
  - lose: "Site 13 sends a fruit basket." (6 words).

  These are the report's first line, not centre text.
- **The week:**
  - beat them on **4 of 7** endless days (days 2–8, then 9–15, …);
  - the next morning's memo second line is **"Site 13 has been acquired. By you."** (7 words);
  - their sign on the far fence is repainted in the crew's teal;
  - a cosmetic unlocks: the **Site 13 jacket**, the vest slot.
- **Week 2:** "Site 13 is back. With a jumbotron." Their target goes to 1.08 ×.
- **Save:** `records.rival = { week, wins, days }`, one line in load and one in save, inside builder 3's records block.

**Why it's fun.**
- A rival with a face beats a ghost of yesterday.
- "(est.)" is the joke, and the weekly acquisition is a payoff you can see on the range.
- It gives endless the pacing a week has, without a new system: it's the race rows plus one Board line.

**Files:** `web/js/owner.js` (`rivalTarget`, `rivalPace`, `rivalWeek`), `web/js/recap.js` (the report line). In
`crew.mjs`: `endShift`'s records block (~l.2380–2400) and one snapshot line (`rival`). The Board line goes to builder
4 (`board.js`), the sign repaint is a `signs.js` hand-off to builder 4, the memo line goes to builder 4 (`sim.js`),
and the jacket goes in `today.js` `COSMETICS` (builder 3).

**Verify:**
- `test/owner.test.mjs`:
  - no rival on day 1;
  - the target is 1.04 × the 3-day average ± 6 %;
  - 4 of 7 acquires;
  - week 2 is 1.08 ×;
  - the save round-trips.
- **Bot** (`pt7c-endless.mjs`, 8 endless days, 1P and 4P × 3 seeds):
  - beat Site 13 on **45–65 %** of days (round 7's coin-flip against yesterday was 59 %, but now with a face and a
    week);
  - the week won in **≥ 1 of 3** runs at each size.
- **Browser:** the Board mid-shift with both totals (shot).

---

### 9 · The fixes pack — S · builder 4 (rows marked → go to their owner)

Every small bug the testers and builders listed, in one brief.

| # | Fix | From | Detail | Owner, file |
| --- | --- | --- | --- | --- |
| 9.1 | **The `endless` preset starts a real first endless morning** | C #5 | The save gets `story` with `epilogue` unplayed, `endlessFresh`, `records.owner` empty, and no `offers`. "Skip ahead → Endless" plays the epilogue. | b4, `server/presets/endless.json`, `skip.js` |
| 9.2 | **`textload.mjs` measures what matters** | A, C #5 | Measure the true epilogue morning (9.1). Widen the window to the whole shift on boss, Stretch and inspection days. Flag **overlaps** (two centre items at once), not just counts. | b4, `scripts/bots/textload.mjs` |
| 9.3 | **The Orbital memo: 17 words, "1,958" twice** | C #9 | "Today: clear the sky. 1,958 to bring home." (8 words) | b4, `sim.js` (`orbitMemo`) |
| 9.4 | **The checklist flickers between texts** | C #10 | The checklist stays down until **1.0 s after** the last centre text, and while say.js or the story queue has anything waiting. | b4, `main.js` (`textBusy`), `morning.js` |
| 9.5 | **Gary's bubble covers the HUD** | C #6 | The bubble sprite's top stays under 70 % of screen height: clamp its scale and height by distance, as the plate does. | b4, `main.js` (Gary region ~l.2083–2096) |
| 9.6 | **The "Day N · venue · you are a…" toast lands 95–130 s late** | B #10 | Fire it with the memo's close, or drop it on any morning with a story beat (its words are on the sign). | b4, `main.js` / `round2.js` hand-off |
| 9.7 | **Club day 1 is 24.8 s against 22** | round13-fixes | Trim the `club` reveal PA to one sentence. | b4, `pa.js` |
| 9.8 | **Memo flavours over 8 words** | round13-fixes | Rewrite `MEMOS` flavours ≤ 8 words (e.g. "Dimples asks that you keep the mats clean."). | b4, `crew.mjs` (`MEMOS` ~l.2589) |
| 9.9 | **The dusk count reads the server's `left`** | C #2 | Part of item 6's one count. | b4, `main.js` / `duskview.js` |
| 9.10 | **A helper flattened during the harvest** | A #10 | Customer balls can't flatten a helper while `lookUntil` holds, as for Rats. | → b1, the helper check beside `lookUntil` |
| 9.11 | **"REMATCH TOMORROW" isn't always true** | A #11 | The Board reads `MOW-E WINS · REMATCH NEXT CLUB DAY`. | → b1, `mowe.js` |
| 9.12 | **Smoke puffs read as paper squares up close** | round13-mowe #5 | A soft round sprite tint for the smoke burst. If time. | → b1, `confetti.js` (two lines) |
| 9.13 | **The Stadium mid beat is skipped on short Stadiums** | B #6 | Let `mid:3` play on the encore morning (the beat ends ~20 s in; the warn is at 111 s). Reword it to avoid the second "off the record": GARY **"Saw that lap. Don't tell Regional."** (6). | → b3, `story.js` |
| 9.14 | **The epilogue card over the Board's strip** | C #11 | Fixed by 3d's end pose on Gary and the case. | → b3 |
| 9.15 | **Gary's next Club sign-off after a win** | round13-mowe hand-off | "Saw the mower. Off the record: nice." as a one-time `GARY_BYE` override. | → b3, `story.js` / `garyvisit.js` (b3 owns it this round) |
| 9.16 | **The Orbital day 2 card reads "undefined"** | C §3 | Day 2's card row reads "Find Ball No. 1" while the sky phase runs. | → b2, `goals.js` |
| 9.17 | **"Records" wording in endless** | round13-late | The report says "Owners' record", not "Record shift". | → b3, `round2.js` |

**Why it's fun:** Polish (6.3) and Clarity (6.7) are the numbers the full-game loop will feel first. Each row is a
moment a tester stopped to squint.

**Verify:**
- unit tests for 9.3, 9.4 (the checklist gate), 9.8 (every flavour ≤ 8 words) and 9.11;
- `textload.mjs` (9.2), with the new overlap column, at 1P and 4P, seeds 7 / 11 / 23:
  - **0 overlaps** on every morning;
  - promotion mornings ≤ 28 s;
  - Club day 1 ≤ 22 s;
  - the epilogue morning ≤ 28 s;
- **Browser:** Gary at the return with his bubble clear of the HUD (shot).

---

### Votes

- **G yes:** "Every late venue now has a call a minute and a peak in the middle."
- **E yes:** "Re-check the boss payout (≤ 14 %) and the souvenir share (18–28 %) after merge. The money glut is the full
  loop's job."
- **M yes:** "Per-Rat meters and the tug-of-war are the first boss rules where all four Rats matter. The Stretch and
  the inspector are the first late jobs that *split* a crew on purpose."
- **L yes:** "The slab fix comes first in item 4. I check the clock-in move against the stairs and the washer, and
  the case's spot against the return's pickup ring."
- **T yes:** "+3 draws for the case, +1 for the request beam, 0 for Ball No. 1's beam. The hot-file regions in §2a
  don't overlap."
- **C yes:** "PULL! PULL! — and I want the jacket."
- **Q yes:** "One count for 'left', the preset fix and an overlap column in `textload` come before any new tuning."

**7–0.**

---

## 2a. Who builds what

Four builders.
- **Only a file's owner edits it.** Anyone else hands their lines to the owner.
- The two hot files are split **by region**, below. Line numbers are at `e44e93e`. Find the region by its name if a
  merge has moved it.
- **Nobody edits outside their region.** Builder 2 touches neither hot file.

| Builder | Items, in order | Owns (only they edit) | `server/crew.mjs` region | `web/js/main.js` region | Hands to another owner |
| --- | --- | --- | --- | --- | --- |
| **1 · MOW-E** | #1 → #5, then 9.10–9.12 | `mowe.js`, `mower.js`, `sfx.js`, `confetti.js` (smoke only), `awards.js`, `scripts/bots/boss.mjs`, `scripts/bots/pt7a-boss.mjs`, `test/boss.test.mjs` | the `stepMowe` region (~l.1750–1905: fight, hose, win, lose, tame pass); the `'mower'` branch in `wash()`; the plug hold read; `mowe` in load and save (one line each); `moweSnap` in the snapshot; the helper check beside `lookUntil` (9.10) | the `mower` / `honk` cases (~l.709–718); the Board banner `moweBoard` expression (~l.926); the spray-target picker's `'mower'`; the plug prompt and hold; the red/amber edge pulse and the pond chevron; **the crosshair meter ring** (new, beside the crosshair draw); the whistle prompt | the memo tease text → b4 (`sim.js`); the organ riff for the Stretch is b1's `sfx.js` work **for** b2 (`SFX.organ()`) |
| **2 · Late venues** | #2 → #7 (7a–7d), then 9.16 | `stadium.js`, `server/venues/stadium.mjs`, `views/stadium.js`, `views/souvreq.js`, `crowd.js`, `county.js`, `server/venues/county.mjs`, `views/county.js`, `goals.js`, `settings.js`, `test/late.test.mjs`, `test/late11.test.mjs`, `late11.mjs` (bot copy) | **none** | **none** | the jumbotron name line, the Stretch and inspection Board lines → b4 (`board.js`); the County/Stadium memo lines and HUD gauge → b4 (7e) |
| **3 · Ending and endless** | #3 → #6 → #8, then 9.13–9.15, 9.17 | `ending.js`, `round2.js`, `story.js`, `storycard.js`, `huddlerules.js`, `garyvisit.js`, `views/orbit.js`, `views/garycameo.js`, new `views/glasscase.js`, `today.js`, `recap.js`, `owner.js`, `scripts/bots/pt7c-endless.mjs` | the Today/contracts region (~l.1220–1280); `endShift`'s report `left` and records block (~l.2380–2400); `depositOne` (~l.2064–2086); the epilogue lines in `startShift` (~l.1205–1208); two snapshot lines (`firstOwnerDay`, `rival`) | the beacon pass (~l.474–503); the carried-gear hide during the hush | the contract and Site 13 Board lines → b4 (`board.js`); the contract memo line and the acquisition memo → b4 (`sim.js`); the Site 13 sign repaint → b4 (`signs.js`) |
| **4 · Look, text and fixes** | #4 → 7e → #9, plus every hand-off above | `venues.js`, `say.js`, `pa.js`, `board.js`, `bvtext.js`, `sim.js` (sole owner), `signs.js`, `morning.js`, `skip.js`, `server/presets/*.json`, `scripts/bots/textload.mjs`, `index.html` | `startShift`'s memo push (~l.1150–1172); `MEMOS` (~l.2589+) | the HUD strip (`bvLine`, ~l.1702); `textBusy` and the checklist gate (~l.1599–1665); Gary's bubble (~l.2083–2096); the floodlights (~l.294); the "Day N" toast; the dusk count's `left` | the newsreel's Board-facing pose → b3 (`round2.js`) |

**Merge order** for both hot files: **builder 4 → builder 3 → builder 1.** The largest goes last, so its rebase is
onto settled regions. Builder 2 merges any time: it touches neither file.

**Shared tests:** `test/words.test.mjs` takes everyone's new lines. Append only, one block per builder, and the lead
resolves conflicts there.

**Done lines** (each in the commit message):
- **Builder 1:** `pt7a-boss.mjs` meets item 1's table and item 5's eaten, payout and pet targets at 6 seeds. There's
  a browser 2P+ fight with the meter, the dragged plug and the fountain shots. `?perf` p95 ≤ 20 ms in phase 2, with
  the pane fronted.
- **Builder 2:** `late11` meets item 2's table and item 7's County targets, including calls a minute. There are Stretch
  and inspector shots.
- **Builder 3:** the `lastbucket` preset is played to the end card in a fronted pane, with beam, hush and note shots.
  Gary is ≥ 40 px in the Lift shot. The contract meet rates are in their bands. The Site 13 beat rate is 45–65 %.
- **Builder 4:** the slab check is ≤ 10 % of the frame at three spawns. `textload` shows 0 overlaps on every morning.
  Club day 1 is ≤ 22 s.

---

## 3. Deferred (and why)

- **Greatest Hits theme days** (C's idea 4: Stadium Night, County Fair, MOW-E Rematch). The best long-term endless
  idea, but it re-runs venue modules (the crowd, the hazards, the boss arena) in endless. Their lifecycles assume a
  venue index, so it's an L with seam risk. Site 13 (item 8) and winnable contracts (item 6) give days 3+ a reason for
  a fraction of the cost. **First candidate next time: MOW-E Rematch**, since the boss is self-contained in `mowe.js`.
- **The Zoning van as a truck you can body-block** (B's idea 2). Inspection Hour gives the County its peak more
  cheaply. Revisit if the County's 4P ignore tail is still > 6 shifts.
- **Two streams required for a hit at 3P+** (A's option). The council took the soft version (crossfire ×1.25): a hard
  gate punishes the casual swarm, which must keep winning ≥ 90 %.
- **The Board turning to face the mats during the warn** (A's idea 4). The morning-long update bar on the Board and
  the amber edge do the job without moving the Board.
- **Gary as a slow fifth Rat in endless** (C's idea 5). A heart beat worth doing once the glass case and his return
  scene have been seen. Next story pass.
- **The money glut from the Stadium on** (B #2, C: $45M against a $6.6M fee; $226M at the Orbital with nothing to
  buy). Real, but it runs through the whole ladder (fees, the statue, the late shop). **The full-game loop measures it
  first** (§4) so the fix is tuned once, not venue by venue.
- **The Stadium souvenir income gap** that isn't souvenir cash (B #3: the share is 14–22 % but income doubles). That's
  probably the bot's use of its Rats. Builder 2 notes what it finds, and re-measures after item 2.
- **A crowd chant voice** and **MOW-E eating souvenirs** (round13-mowe/late hand-offs). Nice, but low on the fun
  scale next to the Stretch.
- **"Previously on Range Rat"** (still deferred from round 11). It's needed once the full game is played in one
  sitting, so the full-game loop judges whether it is.
- **A 4P boss fight in a real browser crew.** It's a tooling gap, not a game change. Builder 1 tries the dev crew
  endpoint with bot seats; otherwise it waits for the owner's sofa.

**Left alone on purpose:**
- every story line not named above;
- the County's `HAZ` constants;
- the late fees;
- the Orbital's card;
- the note at the huddle and its timing (C: "the best 10 seconds in the game"; only its framing changes);
- the hunt (A's best minute).

---

## 4. Next loop: the full-game loop with the scorecard

This was the last late-game loop. The next loop plays **the whole game**, Muni to endless, and scores it on the usual
ten metrics against Round 6 (the last full-game card, 6.8) and Round 7 (late only, 6.5).

**Setup.**
- Three testers, the usual A / B / C split by stretch:
  - **A**: the Muni → the Club (with the boss);
  - **B**: Tiered → the Stadium → the County;
  - **C**: the Orbital → the Last Bucket → endless day 4.
- At least **one tester plays 4P headless across the whole game** (`late.mjs` / `mid.mjs` / `muni.mjs` chained, seeds
  7 / 11 / 23) for the pacing table.
- **The pane is fronted for every timed measurement and every shot.**

**Goals for the full card:** overall **≥ 7.0**; decision density **≥ 6.5**; text load **≥ 7.0** (hold it); clarity,
co-op, look & feel and polish **≥ 7.0**; one more shift **≥ 7.0** at endless day 3.

**What the testers check:**
1. **Whole-game pacing.** Shifts and minutes per venue at 1P / 2P / 4P, and the total to the end card. Is any venue
   now a cliff or a coast? Did the late changes (the requests goal, the inspector) shorten or lengthen the Stadium and
   the County?
2. **Decision density by venue.** Use the bot's calls-a-minute tally at every venue, not just the late ones. Where is
   the longest stretch with no call? The early game has had no attention for four loops.
3. **The money curve** (deferred above). At each venue's last shift, record cash against fee, and the first shift
   where nothing on sale is worth buying. That sets the economy pass.
4. **The boss at 4P.** Does every Rat land a hit? Does the plug scrum form and feel like a scrum? Does the fountain
   land in frame? Does the crew *choose* to let it eat? Count the pet's balls on the days after, and whether anyone
   used the whistle and when.
5. **The Stadium and the County at 1P as well as 4P.** Does the crowd need you solo now? Did anyone hold souvenirs for
   the Stretch? Did the inspector split a 4P crew? Does the memo and HUD name the gauge before it bites?
6. **The ending.** Was the gold beam followed straight away? Were the crack, the paper and the note card all in frame?
   Was Gary seen in the Lift and at the case? Does the glass case read, with names on its plaque?
7. **Endless to day 4+.** Were contracts seen during play and met at the expected rates? When was the first cosmetic?
   Did Site 13's number change how anyone played? Would you play day 5?
8. **The owner's rules, end to end.** Run `textload.mjs` over every morning of the game with the overlap column: 0
   overlaps, no line over 8 words, and promotion mornings ≤ 28 s. Check that the pad works for every new verb (the
   plug walk, the whistle, the Stretch) and that nothing drops full screen.
9. **The look on the Xbox, or as close as the pane gets.** No black slab at any spawn, no black squares at Last Call,
   and `?perf` p95 ≤ 20 ms at the Stadium during the Stretch, in boss phase 2, and at the return with the case.
10. **Regressions.** Did the early venues lose anything? The seam goldens are re-recorded once by the lead, and the
    testers confirm that the Muni and Club days 1–2 play exactly as in round 7.
