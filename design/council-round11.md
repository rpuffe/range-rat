# Fun Council, round 11: MOW-E becomes a boss, and the late game gets its reasons

This is the record of Range Rat's eleventh Fun Council (2026-11-26). It sits on build `52af0c2` (round 12 story beats)
plus `84f3fad` (the calmer grass), and on playtest round 6 (`design/playtest-round6-A.md`, `-B.md`, `-C.md`, the
scorecard's Round 6 section). Rounds 1–10, the owner-playtest-3 spec and round 12's beat sheet still bind wherever
this record doesn't change them. Where they disagree, this record wins.

**This round's job.** Two owner calls:
- *MOW-E becomes a big deal, "like a boss moment".* Testers A and B both pitched "MOW-E Goes Rogue". This record
  designs the definitive version (§2).
- *A better late game.* Tonight's loops focus on the Stadium, the County, the Orbital, the Last Bucket, the ending
  and endless. A full-game loop with the scorecard comes at the end of the night.

**The owner's firm calls (unchanged, binding):**
- one centre text at a time, ~8 words;
- works on a pad, never drops full screen;
- scales for 1–4 players (balanced for 4), every upgrade crew-wide;
- no named balls;
- rare PA lines, only on big events;
- the inside jokes stay (power washing, the kitchen);
- both story threads stay (Gary + Ball No. 1 as the heart, Site 13 / Dimples as the comedy): improve the delivery,
  don't replace it;
- "pick the more fun and easier option for a casual crew of 4".

**The council (same seats as rounds 5–10).**

| Seat | Lens |
| --- | --- |
| **Game Designer** (G, chair) | Moment-to-moment fun; does each venue play differently? |
| **Systems/Economy Designer** (E) | Prices, payouts, pacing |
| **Multiplayer/Co-op Designer** (M) | 1–4 Rats, roles, solo |
| **Level Designer** (L) | Readable spaces, lanes, clearances |
| **Technical Director** (T) | Server-authoritative, zero deps, hot files, Xbox frame time |
| **Casual Crew of 4** (C) | Four friends on a sofa, some on Xbox pads in Edge |
| **QA Lead** (Q) | Bugs, dead ends, softlocks; nothing counts until it's reproduced |

Ties go to the chair.

**What the council read:** the three round-6 reports and their screenshots; the scorecard; `council-round10.md`;
`game-design.md` from "Owner playtest 3 build" to the end (round 12's beat sheet included); `round12-story.md`;
`round11-late.md`; `expert-review-pacing.md` §8. Code: `mowe.js`, `mower.js`, `clubdays.js`, `crew.mjs` (`stepMowe`,
`startShift`, `depositOne`, `endShift`'s records, `wash`, `toggleWand`), `main.js` (the `mower`, `debut` and `memo`
cases, the Board banner), `round2.js` (the `lastbucket` case), `ending.js` (`finale`), `rally.js` (`GAUGE_MISS`),
`county.js` (`HAZ`, `zoningWith`), `stadium.js` (`SOUV`), `board.js` (the flip), `huddlerules.js`, `pa.js`,
`sim.js` (`pickKind`, `KIND_BLURB`), `owner.js` (`raceYesterday`).

**What the council ran:** nothing new. Every number below is the testers' (bots and browser) or read from the code.
Each build item names the bot measurement its builder must take before merge.

---

## 1. What the testers agree on

All three testers, independently:
1. **The story beats are good; the mornings around them are not.** Every beat fires every time, the cards are short
   and well voiced, and the best line in the game is now the note inside Ball No. 1. But each beat lands on a morning
   that already has a PA and one or two memos.
2. **MOW-E "barely exists".** A: 3–11 balls raked of ~300 (2–4 %), 0 knockdowns. B: 11.7 balls a pass, moved 2.4 m,
   2 knockdowns in 65 passes, always at 1:45. C: 8–24 balls late, invisible. Nobody's plan ever changes.
3. **Too much is told, not shown.** A photo we never see (A), a newsreel the jumbotron doesn't play (B, C), Gary
   riding a Lift he isn't in (C), Gary grabbing a bucket nobody sees (C).
4. **The late jobs are lopsided.** County hazards decide promotion, but the bell blames strays (C, High). Stadium
   souvenirs are pleasant and ignorable (4–10 % of income; a 4P crew that ignores them still passes).
5. **The ending's peak and its best line are two screens apart** (C), and endless opens with a loss (C).

### Why each score dipped

**Text load −0.6 (6.8 → 6.2).**
- Promotion and Club mornings run **30–50 s of back-to-back centre text**:
  - Club day 1: PA → 3 story cards → square-ball PA → Today memo → NEW memo, ~50 s (B).
  - Club day 2: 32 s, and the day's target first reads at 20 s (A).
  - Every promotion morning: ~7 centre items in a row (C).
- Two reveal memos are 13 and 15 words (C #7).
- The finale stacks two texts: "Today: clear the sky" under the BALL NO. 1 banner, and the basket checklist over the
  huddle (C #4).
- The Last Bucket banner overflows the screen at 800 px (C #3).
- A card fading in over a card fading out reads as two texts on a slow frame (A #5, C #6).
- The rule "one at a time" holds by class. It fails by *volume*: the queue is honest, but it's full.

**Clarity −0.5 (7.3 → 6.8).**
- The MOW-E alert names a lane nobody can see. It shows ~7 s late with "12 s" still printed: the PA outranks it
  (A #1, B #3).
- The County tells a crew the wrong reason for DENIED (C #1). That's the round's one High.
- "Earn Gary's Seal" hides that it needs a huddle: the card stalls to Club day 7 (B #7).
- The sky row counts balls while the debris goal counts pieces, and nothing converts them (C #2b).
- The day's target arrives 20 s into a story morning (A).

**Meaningful features −0.5 (6.7 → 6.2).**
- MOW-E is filler as built: ~3 % of a shift's balls, 2.4 m.
- Souvenirs are 4–10 % of Stadium income and change no outcome.
- MOW-E at the late venues is invisible.

**Decision density 5.7 (new metric; A 5.5, B 5.5, C 6).** In the last minute, did I choose something?
- On story mornings the first 20–50 s are reading, not choosing.
- MOW-E asks for no decision at all.
- Fee-only days: Club days 4–6 (B), solo Stadium days 3–4 (C).
- The Stadium "mostly runs itself under the autopilot" (C).
- The Orbital's sky phase with the winch unbought is a wait, not a choice (C).

G's reading: **the game has more story and more systems than ever, and fewer choices per minute than it should.**
This round adds one big shouty choice (the boss) and two small ones (souvenir requests, the hazard deal). It takes
reading time *out* of the mornings, and puts the story where the crew is already looking.

---

## 2. MOW-E Goes Rogue — the definitive boss

**Adopt, the council's merge of A's and B's pitches.** From A: the cart roadblock, the hose on the grille, the hunt
that pays off "trained on your movements", the pond, the fountain of balls, and the tame MOW-E. From B: the
firmware-update fiction, the speeding beeps, "faster with more hands" at the finish, Employee of the Month on a
loss, and a raked-to-the-stand helper afterwards. **Cut:** A's pond lure as a mechanic (too fiddly for a sofa; the
pond is the cutscene instead), and B's Fresh-Cut windrow (the boss already gives the crew a reason to chase it).

G: "A boss is a moment you tell your friends about. It needs three things: you see it coming, everyone has a job,
and it ends with a bang and a reward you keep."

### 2.1 When

- **"MOW-E Goes Rogue"**: **Club venue day 3** (its debut day, `CLUB_DAY.mower` 3), at **30 % of the shift**
  (shiftT 126 s of 420). The fight is capped at 100 s, so it ends by ~4:10, well before Last Call (T−90 = 5:30).
- **Rematch**: if the crew loses, it runs once more on the next Club day. Lost twice, MOW-E is tamed anyway ("MOW-E's
  warranty expired. He's yours now."). Nobody is ever locked behind a fight.
- **"MOW-E 2.0", the encore**: the first **Stadium day ≥ 2** that isn't Promotion Day. Same machine, a little
  harder, and the crowd watches (§2.7).
- **So: two boss fights a campaign (three at most), never in endless** (deferred, §4).
- **The boss owns its day.**
  - Gary slips off a boss day to the next (as he already slips off a reveal morning).
  - No Today modifier is dealt on a boss day.
  - No mid-venue story beat plays on a boss morning.
  - Promotion Day moves the boss to the next eligible day.
  - Club day 3 keeps the creek dive (it has a tip and no memo). The super-bouncy ball and the splitter move to
    Club day 4 (§3, item 3).

### 2.2 The fight, phase by phase

Constants (4P printed; the scaling is in §2.3). Lanes are new "near lanes" at z **−14, −24, −36** (L checks
clearance against the mats' customer arc, the bowls, the pond and the Field return at (10, −62); −24 and −36 are
already cleared lanes). The drive runs along x **−36 … +56**, so every point is inside the hose's 86 m from the
washer at (36, 3); the farthest corner is 82 m out.

**Build-up (15 s, replaces the 12 s warn).**
- **The PA** (a big event, so it earns a PA): *"Corporate has pushed an update to MOW-E. It has learned your
  movements. Please stand back."* Caption: **"MOW-E updated itself. Please stand back."** (6 words). This is the only
  centre text in the build-up. There is **no ALERT in the warn**, so the stale "12 s" bug can't happen.
- **The Board**: `MOW-E · ROGUE · 0:15`, counting down (readable once the flip fix lands, item 8).
- **In the world**:
  - the shed door rattles;
  - the beacon goes from amber to red;
  - all three near lanes get the red hazard stripes;
  - customers keep hitting, but customer balls can't knock a Rat down until the fight ends (`crew.lookUntil`, the
    Deck Cam's "everyone stops to look" rule, reused).
- **Sound**: MOW-E's two beeps repeat and speed up across the 15 s (every 2.0 s → 0.4 s). Its engine starts low.

**Phase 1, "The Harvest" (up to 40 s).**
- MOW-E bursts out and runs a serpentine along the three near lanes at **3.5 m/s**: a walking Rat (4.2 m/s) can keep
  up with it.
- It **eats** every resting ball within **±3 m** into a catcher bag that visibly swells at its back. The Board reads
  `MOW-E · ■■■■ · ATE 37`.
- **To hurt it, hose its back.**
  - Its intake grille is on the rear. Spray it with the wand from within reach (7 m, or 9 m with the Turbo nozzle),
    standing in its rear arc (more than 110° off its nose).
  - **One hit = 2.0 s of spray**, divided by your nozzle's `washRate`: the Fan ×1.5 makes it 1.33 s, the Turbo ×2
    makes it 1.0 s. Several hosers add up.
  - A hit is a cough of grey smoke, an engine pitch drop, one HP pip gone, and a 1 s stagger (it stops).
  - Every upgrade the crew bought for power washing now makes the boss easier. The inside joke is the weapon.
- **To stop it, block it with a cart.**
  - A cart within `CART_STOP` 3 m in front stalls it, as it does today, driven or parked and empty.
  - While stalled, its grille glows red and **hits take half the spray**.
  - After **6 s** it shoves the cart 4 m aside (three angry honks, cart mud +0.4) and carries on. That cart can't
    block it again for 8 s.
  - A Rat in the cart is safe: drivers are never knocked down.
- **The decision.** Every eaten ball comes back **×2** if you win (§2.4). Block it early and win small, or let it
  harvest and win big. Lose and the balls are gone.
- **Phase 2 starts** when HP ≤ half (rounded up), or after 40 s.
- **Centre text, once, as it bursts out**: **"MOW-E is loose! Block it. Hose its back!"** (8 words, ALERT).

**Phase 2, "Trained on Your Movements" (until HP 0, inside the 100 s cap).**
- The PA's joke finally pays. MOW-E **hunts the nearest Rat on foot**: online, not down, not driving, not diving,
  not aloft.
  - It re-aims every 3 s, and turns at 120°/s, so a sidestep works.
  - Speed **4.6 m/s**: you can't outwalk it, but you can outsprint it (7.35 m/s on stamina).
  - It keeps eating as it goes.
- **A red scan line** runs from its sensor to its current target (world, 1 draw call while live). The target's screen
  edge pulses red with a beep. That's a per-Rat cue with no text.
- **Knock radius** 1.3 m (solo 1.0 m).
  - A knocked-down Rat **spills their pocket into its catcher**, which raises the stakes.
  - That Rat can't be re-targeted for 5 s.
- **The play:** the hunted Rat (the decoy) leads it past a parked cart. It stalls, and the hosers hit it from behind.
- **Centre text, once**: **"Now it hunts. Lead it into a cart!"** (8 words, ALERT).

**Phase 3, "Pull the plug" (the finisher).**
- At HP 0, MOW-E chokes: black smoke, the engine sputters, the beacon goes amber, and it stops.
- A ring (the huddle ring's visual, reused) appears behind it, 2.5 m across.
- **Hold Ⓐ / Space in the ring.** The pull takes **2.4 s divided by the number of Rats holding** (up to 3), so solo
  is 2.4 s and three or more is 0.8 s. Everyone piles in: that's the moment.
- Nobody holds within 10 s: it **reboots with 1 HP** into phase 2, and the cap extends 15 s.
- **Centre text, once**: **"Pull the plug! Hold Ⓐ at its back!"** (8 words; "Hold Space" on a keyboard).
- The bottom prompt near it: "Hold Ⓐ: pull the plug".

**Win, "MOW-E TAMED".**
- **The STAMP**: **MOW-E TAMED** (the bell's stamp element, one centre item). Two confetti cannons at the return, the
  jackpot sting.
- **The catcher bursts at the return.** Every eaten ball, spilled pockets included, fountains into the hopper and is
  **auto-banked ×2** as crew balls (the bank float shows it).
- **5 gold balls** arc onto the grass within 6 m of the return: everyone grabs one.
- **Corporate's bounty: 100 × BV** (about $3k at the Club).
- **+1 commendation**, and the night recap's **"MOW-E Wrangler"** award goes to the Rat who landed the most hits.
- **The cutscene**: MOW-E limps, smoking, to the pond's nearest bank and drives in, with a gurgle and bubbles. Then
  the PA (a big event): *"MOW-E has been retired to the pond. Corporate thanks it for its service. And you,
  slightly."* Caption: **"MOW-E is in a better place. The pond."** (8 words).
- **Gary's next Club sign-off** is replaced once: "Saw the mower. Off the record: nice."
- E: the total is **about 8–12 % of the Club day-3 shift's income** at 4P (~40 balls × 2, 5 gold, the bounty). That's
  big enough to cheer about, but it can't skip a day.

**Lose, "MOW-E WINS".**
- The cap runs out (100 s, or 115 s after a reboot). MOW-E drives home to its shed with its catcher full.
- **The eaten balls are gone.** They are not counted as left out, so they don't cost SPOTLESS RANGE.
- **The Board**: `MOW-E WINS · REMATCH TOMORROW`. **The feed**: "MOW-E kept 37 balls." **No centre text**: a loss
  shouldn't shout.
- **Next morning**, the memo's second line reads **"MOW-E is Employee of the Month."** (6 words), and the rematch runs
  on the next Club day with **HP −1** ("it's tired").

### 2.3 Every Rat's job, at every crew size

| Crew | HP | Phase 2 speed | What it looks like |
| --- | --- | --- | --- |
| **4P** | 4 | 4.6 m/s | **The driver** parks in its lane and re-blocks after each shove. **Two hosers** chase its back with wands. **The decoy** is whoever it hunts, and runs it into the cart. All four pull the plug. A casual swarm (four wands, no plan) also wins: that's the bot's `4p-swarm` policy. |
| **3P** | 4 | 4.4 m/s | One driver, two hosers; the hunted hoser decoys. |
| **2P** | 3 | 4.2 m/s | One driver/decoy, one hoser. Or two hosers and no cart: slower, still winnable. |
| **Solo** | 3 | 4.0 m/s, knock radius 1.0 m | Phase 1: chase it with the wand (3.5 m/s is slower than your walk). Phase 2: park the cart in its lane first, then let it chase you past the cart, turn and hose. The plug is 2.4 s alone. |

5–6P use HP 5 and 4.8 / 5.0 m/s (M: "the printed 4P numbers, one more pip").

**The pad.** Every verb is one the crew already has: RT sprays, driving is driving, and Ⓐ hold is the huddle's hold.
There's no new button, nothing opens a menu, and nothing touches full screen.

### 2.4 After the boss: MOW-E, the crew's pet (the reward you keep)

- **From the next day, at every venue, a tamed MOW-E makes two passes a shift**, at 25 % and 60 %.
- On each pass it takes the richest of the six old lanes (`pickLane`), gathers every resting ball within ±3 m into
  its catcher, drives to the **nearest owned return** (a field return if one is closer) and **banks them** as helper
  balls. THUNK.
- **It never knocks anyone down**: it stops 1.5 m short of a Rat and beeps.
- It has **no warning, no PA and no ALERT**. The Board reads `MOW-E · BRINGING 24 HOME`.
- The first tame morning, the memo's second line is **"MOW-E sends his regards."** He wears a small white flag where
  the FHI flag was.
- It's crew-wide, it's earned, and it's visible every day. E's target: **30–80 balls a shift** (3–6 % of supply).
  It's a pet, not a drone fleet.
- **This replaces today's rogue daily pass at every venue**, so the stale-alert bug (A #1, B #3) goes with it.

### 2.5 Sound and music

- **The engine** (`sfx.js moweEngine`): a sibling of `cartEngine`.
  - Two detuned saws at 50 → 120 Hz on speed, a lowpass 300 → 800 Hz, a tanh drive of 2.5.
  - Gain is 0.03 × 1 / (1 + distance / 15), so you hear it coming.
  - A stall idles it at 45 Hz with a rattle.
  - A hit is a 0.4 s noise cough and a 30 % pitch dip.
  - The plug is a 1.2 s glide down to 20 Hz, then silence, then the jackpot.
- **The boss loop** (`sfx.js bossLoop(phase)`): a 4-bar ostinato.
  - A square-wave bass on A–C–E–G and noise hi-hats on 8ths.
  - **112 BPM** in phase 1, **128** in phase 2, **144** at the plug, where the bass drops out and leaves hats and a
    heartbeat kick.
  - Gain 0.03, ducked under the PA (`audiomix`). It stops dead on a win and fades on a loss.
- **The build-up beeps** speed up (`horn('mower')`). Gary's horn is untouched.
- **The pond** is a low gurgle and three bubble pops (noise through a resonant bandpass).

### 2.6 What you see (Xbox budget)

`mower.js` gains:
- the catcher bag (a box at the rear, scaled 0.4 → 1.2 with eaten / 80);
- an emissive red grille (pulsing while stalled);
- the red beacon and headlights;
- the three striped lanes;
- the scan line (one `Line`);
- smoke puffs from the shared confetti pool, tinted grey (no new pool);
- a shed door quad that rattles;
- the sink animation.

**At most +3 draw calls, only while a boss is live.** `?perf` p95 ≤ 20 ms on Edge at the Club during phase 2.

### 2.7 MOW-E 2.0 at the Stadium (the encore)

- It's the same machine, built in the same commit series.
  - The PA: *"Corporate has pushed MOW-E two point oh. Now with stadium mode."* Caption: **"MOW-E 2.0. The crowd is
    thrilled."**
  - HP +1, speeds +10 %, and the near lanes are re-checked against the Ping Track (L).
- **The jumbotron is the HP bar**: the Board banner reads `MOW-E 2.0 VS SITE 12 · ■■■■□`.
- **The crowd watches**: it doesn't drain during the fight, each hit is **+0.08 crowd** (a ping's worth), and a win
  fills it to 1.0.
- **It eats souvenirs too**, and they fountain back out as souvenirs. That feeds builder 3's souvenir requests.
- C: "The Stadium was the venue that ran itself. Now it has the loudest two minutes in the game."

### 2.8 Files and verification

- **Files:**
  - `web/js/mowe.js`: a pure phase machine. `bossDue`, `newBoss`, `stepBoss` (phases `warn`, `harvest`, `hunt`,
    `plug`, `tamed`, `fled`), `crewHP`, `bossSnap`, `bossBoard`, the tame pass `stepTame`, and the near-lane
    constants. The old `stepMower` stays for its tests until the tame pass replaces it.
  - `web/js/mower.js`: the view.
  - `web/js/sfx.js`: `moweEngine`, `bossLoop`, the cough, the gurgle.
  - `web/js/pa.js`: `rogue`, `rogue2`, `pond`; the old `mower` line is retired.
  - `web/js/awards.js`: MOW-E Wrangler.
  - `web/js/garyvisit.js`: the boss-day slip.
  - `web/js/today.js`: no Today on a boss day.
  - `server/crew.mjs`, **only** its `stepMowe` region, plus:
    - a 4-line `'mower'` branch in `wash()`;
    - the hold read for the plug;
    - `mowe` in the save (`{ tame, lost, encore }`, one line in load and one in save).
  - `web/js/main.js`, **only**:
    - the `mower` / `honk` event cases;
    - the Board banner expression (`mowerBoard` → `bossBoard`);
    - the spray-target picker learning `'mower'`;
    - the plug prompt and hold;
    - the target's red edge pulse.
- **Tests:**
  - `test/boss.test.mjs` (new):
    - the HP and speed table by crew size;
    - a hit takes 2.0 s ÷ washRate, halved while stalled;
    - the rear-arc rule;
    - the cart stall lasts 6 s, then the shove and an 8 s cooldown;
    - phase 2 starts at half HP or 40 s;
    - the hunt picks the nearest on-foot Rat and never a driver or diver;
    - the plug takes 2.4 s ÷ min(3, holders), and a reboot after 10 s idle;
    - a win banks eaten × 2 plus the bounty;
    - a loss loses them;
    - two losses tame it;
    - the tame pass never knocks anyone down;
    - no boss on a Gary, Today or Promotion Day morning;
    - an old save loads untamed.
  - `test/words.test.mjs`: every new centre line is ≤ 8 words.
  - `test/seam.test.mjs`: the Club golden moves (cause: the boss's RNG and the tame pass). With the boss off, the old
    fingerprint comes out.
- **The bot** (`scripts/bots/boss.mjs`, new, from the Club day-3 snaps, seeds 7 / 11 / 23):

  | Policy | Target |
  | --- | --- |
  | `4p-roles` (driver, two hosers, decoy) | wins 100 %, fight 45–75 s |
  | `4p-swarm` (four wands, no cart) | wins ≥ 90 %, ≤ 90 s |
  | `2p` | wins ≥ 85 % |
  | `1p-cart` (park, lure, hose) | wins ≥ 85 % |
  | `1p-chase` (wand only) | wins ≥ 60 % (the rematch's HP −1 then wins ≥ 85 %) |
  | `idle` | loses, rematch, loses, tamed on the 2nd loss, no softlock |

  Also report:
  - eaten balls per fight (target 30–80 at 4P);
  - the win payout as a share of the shift's income (8–12 %);
  - knockdowns per fight (4P 1–4);
  - tame-pass balls per shift (30–80);
  - the Stadium encore's win rate at 4P and 1P.
- **The browser:** a 4P Club day-3 snap, screenshots at the build-up, a stall, phase 2's scan line, the plug ring,
  the STAMP and the pond. Each must show exactly one centre element.

Votes: **7–0.**
- G: "the Club finally has a story you retell".
- E: "8–12 % is a cheer, not a skip".
- M: "the cart, the hose and the hunt split four people without assigning anyone; solo has a real plan".
- L: "near lanes, or it's still a speck".
- T: "one pure file, one crew.mjs region, +3 draws while live".
- C: "we will be screaming PARK. NOW."
- Q: "the double-loss tame means nobody is ever stuck behind it".

---

## 3. Build this (ranked)

Ranked by fun per effort for a casual crew of 4, with the owner's call first.
- Sizes: **XS** < 1 hour · **S** an evening · **M** two evenings · **L** three.
- Every item adds its tests to `node --test test/`, runs `make preflight` (WSL), and updates `game-design.md` in the
  same commit.

### 1 · MOW-E Goes Rogue, the tame pet, MOW-E 2.0 — L · builder 1

§2 in full. **Why it's fun:**
- It's the Club's one shouty co-op moment, made of verbs the crew already has (hose, cart, run, hold).
- It pays off a joke the PA made 10 shifts earlier.
- It ends in a fountain of balls and a pond.
- The pet is a reward you see every day after.

**Files, verification:** §2.8.

### 2 · The County says "hazards" — XS–S · builder 3 (High, C finding 1)

The bell blames strays for a DENIED that hazards caused. A 4P crew that ignores hazards was DENIED 8 shifts running
with $117M in the bank: a near-softlock with the wrong signpost.

- **The miss line names the bigger term.** `rally.js` gains `missLine(venue, st)`, replacing `GAUGE_MISS[4]`. At the
  bell, compare `haz / HAZ.CAP` (12) with `strays / STRAY_CAP` (30):
  - hazards bigger: **"Missed: 9 hazards left out. Spray, then bag."** (8 words);
  - strays bigger: **"Missed: 14 strays in the Yards."**
  - The report row reads "Zoning at the bell 41% · 9 hazards out".
- **The Board's Zoning gauge shows the count**: `ZONING 62% · 7 HAZARDS`. The county module adds `label` to
  `mods.county`, and builder 4's `board.js` draws it (hand-off).
- **A live deal.** At the County, whenever Zoning is under the line + 0.1 and **3+ hazards** are out (and, as now,
  from T−90), the rally deals **"Hazards out! Spray and bag!"** (5 words) to the two Rats nearest the hazards'
  centroid. A Rat already holding the wand is preferred as the sprayer. It's re-dealt at most every 45 s.
- **The first van tow's toast says why**: "Zoning towed 6 balls. Bag the hazards!" (7 words).
- **The reveal names them**: the County's morning NEW line is "NEW: the Yards. Spray green hazards, then bag."
  (item 3).
- **The tip re-arms**: after a County DENIED caused by hazards, the per-device hazard tip shows once more the next
  morning (`settings.js` HINTS gains `again`).
- **Why it's fun:** the late game's one real fail state becomes a clear two-Rat job (sprayer + bagger) instead of an
  unexplained wall. It also adds decision density: who bags, and when.
- **Files:**
  - `web/js/rally.js`;
  - `web/js/county.js`, `server/venues/county.mjs` (the label, the deal trigger, the tow toast);
  - `web/js/views/county.js`;
  - `web/js/settings.js`.
  - The `crew.mjs` `endShift` quota line reads `missLine`: one expression, in builder 3's records region.
- **Verify:**
  - `test/rally.test.mjs`: the miss line picks hazards when `haz/12 ≥ strays/30` and strays otherwise; the deal fires
    at 3 hazards under line + 0.1, not at 2.
  - `test/words.test.mjs`.
  - **Bot:** `late11` at the County, 4P, `JOB=0`, seeds 7 / 11 / 23. The miss line names hazards in **100 %** of the
    DENIEDs where hazards were the bigger term.
  - **The "learner" variant** (`JOB` flips on after the first miss line that says "hazards") passes the County with
    **≤ 1 DENIED** more than `JOB=1` at 3P and 4P.

### 3 · One morning, one memo — S · builder 4 (Text load, Club day 3 overload)

**The rule** (T: enforce it in the server's event order, not in the client's patience). Every morning has **at most
three centre items, in this order: one PA line → the story beat → one memo.** Everything a morning used to say in
extra memos goes into the memo's second line, the slot the flavour and Today already share.

- **The memo's second line**, ≤ 8 words. It takes one line, by priority:
  1. Today's modifier;
  2. a NEW line (the venue on a reveal morning, or the ball kind that opens today);
  3. a MOW-E line (Employee of the Month, sends his regards);
  4. the flavour.

  A NEW line that loses to Today shows as the first hit's world float instead (below).
- **The reveal memos fold.** Each venue's two reveal memos (13–15 words) are replaced by one NEW line in the morning
  memo, from `VENUE_RULES[v].memo`:

  | Venue | NEW line |
  | --- | --- |
  | Club | NEW: the kitchen. Fries raise every ball. |
  | Tiered | NEW: target greens. Land a crew ball there. |
  | Stadium | NEW: the Ping Track. Keep the crowd happy. |
  | County | NEW: the Yards. Spray green hazards, then bag. |
  | Orbital | NEW: the Lift. 1,958 balls are in orbit. |

- **Ball kinds are announced in the morning, never mid-shift.**
  - The server knows which kind opens today (`sim.js kindsOpening(day, venue, vday)`, read from `pickKind`'s own
    rules). It puts the NEW line in the morning memo and adds the kind to `debuts` at the morning.
  - So the first hit of that kind emits `{t:'debut', kind, told: true}`. The client plays the jackpot sting and a
    **world float "NEW ×1.5"** over the ball, with **no memo**.
  - The kind PA lines (square, gold, lead, splitter, bouncy) are **cut**: rare PAs only on big events. Their jokes
    live on in the NEW lines:
    - "NEW: square balls. ×2. They don't roll."
    - "NEW: gold balls. ×10. Dimples watches."
    - "NEW: lead balls. ×3. The pond's a department."
    - "NEW: splitters. Pick one up, get three."
    - "NEW: bouncy balls. ×1.5. Don't chase them."
  - The glow PA at Last Call stays: it's a timing cue.
- **Club day 3 belongs to MOW-E.** `CLUB_DAY.bouncy` 3 → **4**, and the splitter becomes a Club-staggered kind at
  **Club day 4** (`clubOpen('splitter')`). Elsewhere it stays global day ≥ 7. It's one RNG draw either way, so only
  the Club golden moves (re-record with one cause).
  - The Club is now: d1 the kitchen + square; d2 the pond, lead, gold + the mid beat; **d3 MOW-E** (+ the creek
    dive); d4 bouncy + splitter.
- **Shorter memos on a story morning**: 5 s, not 7.
- **The Last Bucket morning is quiet.** No "Today: clear the sky" memo when the Last Bucket begins this morning
  (`quiet: true`): the BALL NO. 1 banner is the one text (C #4, `pt6-c-lb-banner-memo.jpg`).
- **Why it's fun:** the crew gets its hands back 20–30 s sooner on the mornings that matter most, and each new thing
  is said once, in the one place everyone reads.
- **Files:**
  - `server/crew.mjs`, **only** the memo push in `startShift` (~l.1146–1150) and the two debut sites (~l.1796,
    ~l.2028);
  - `web/js/sim.js` (`kindsOpening`, the NEW lines, `VENUE_RULES[].memo`, `pickKind`'s splitter);
  - `web/js/clubdays.js`;
  - `web/js/main.js`, **only** the `debut` and `memo` cases (~l.773–780);
  - `web/js/say.js` (the 5 s memo).
- **Verify:**
  - `test/words.test.mjs`: every NEW line and venue memo is ≤ 8 words.
  - `test/clubdays.test.mjs`: bouncy and splitter at Club day 4.
  - `test/crew.test.mjs`: a kind told in the morning emits `told` and no second memo; the Last Bucket morning's memo
    is quiet.
  - **Bot** (`scripts/bots/textload.mjs`, new): it replays every morning's events through `createSayModel` (B's
    method, plus 4 s per story card), along the 4P ladder, seeds 7 / 11 / 23, from Muni day 1 to endless day 2.
    Targets:
    - **every promotion morning ≤ 28 s and ≤ 3 centre items** (today 30–50 s, ~7);
    - **Club days 1–4 ≤ 22 s**;
    - no morning has two memos.

### 4 · The note at the huddle — S · builder 2 (C's top idea; the ending's heart)

The best line in the game is read a whole end card and a new morning after its moment. **Move it into the huddle.**

- **Split the epilogue** in `story.js`:
  - **`note`** is one card: INSIDE BALL No. 1 · 1958, *"Whoever finds this: the range is yours."*
  - **`epilogue`** is the other three: Gary's bucket, Dimples retiring, the sign repainted.
  - An old save that saw `epilogue` counts `note` as seen.
- **The sequence at the bank** (`round2.js`'s `lastbucket banked` case, `ending.js`):
  1. Confetti cannons and the crowd's roar, as now.
  2. **0.8 s of near-silence**: floods off, ambience ducked to 30 %.
  3. **Ball No. 1 cracks open on the return's lip**: two gold halves hinge apart over 0.6 s, a curl of paper rises
     0.4 m in a warm light (`ending.crack()`, 3 meshes, only now).
  4. **The note card**: the dark serif note style. Ⓐ works after 2 s, it moves on by itself at 7 s, minimum 5 s on
     screen. One soft bell strike.
  5. On the card's release: the **$∞ / BALL** scramble → the PA "No more balls. Every ball mattered." → the end card.
     `showEndCard` waits on the finale's promise, not a fixed 7 s.
- **Server**: `depositOne` calls `storyBeat('note')` straight after its `banked` event and before `pa('last')`. The
  say turn already makes the PA wait.
- **The first endless morning holds its clock** while the three epilogue cards play. `this.storyHold` = 14 s: the
  shift clock, the customers and the Today deal don't advance. It goes on the held-clock path the Last Bucket already
  uses (C: "pause that morning's clock until the cards end").
- **Why it's fun:** four friends in a ring, all holding a button, and the ball opens in front of them. That's the
  moment people remember. The morning after gets to be the quiet, funny coda.
- **Files:**
  - `web/js/story.js`, `web/js/storycard.js` (the note's 5 s minimum);
  - `web/js/round2.js`, `web/js/ending.js`;
  - `server/crew.mjs`, **only** `depositOne` (~l.1916–1935) and the story lines of `startShift` (~l.1166–1183, the
    hold).
- **Verify:**
  - `test/story.test.mjs`: `note` is one card and plays at the bank; `epilogue` is three cards on the first endless
    morning; an old save with `epilogue` seen doesn't replay `note`.
  - `test/crew.test.mjs`: the event order `banked` → `story note` → `pa last`; on the epilogue morning shiftT is still
    0 at 13 s and moving at 15 s.
  - **Bot:** the `lastbucket` preset headless at 1P, 2P and 4P: the order holds, and no customer swings during the
    hold.
  - **Browser:** the `lastbucket` preset, screenshots at the crack, the note, the scramble and the end card, with one
    centre element each, **taken with the pane fronted** (C's rAF caveat).

### 5 · Souvenir requests: "WE WANT A BALL!" — S · builder 3 (late jobs' weight)

Souvenirs are legible and ignorable (4–10 % of income, +0.07 crowd when a lap is +0.1). Give them a *when* and a
*where*: a decision.

- **A request.** One stretch of a stand's rail (one of six sections, 16 m each, left and right) lights up:
  - a pulsing gold ring on the rail;
  - the section's crowd stands and waves;
  - a world banner "WE WANT A BALL!".
- **When:** one at a time, from 0:30 to T−60, every **45 s at 4P** (60 s 3P, 75 s 2P, 90 s solo). Each lasts **30 s**.
- **Deliver a souvenir there while it's lit:**
  - **+0.15 crowd**;
  - it pays **×3**: 60 ball-weights at the new base W (below);
  - a confetti puff in the section and a chant.
  - The relay's ×2 does **not** stack with a request: the best is ×3.
- **Miss it:** −0.06 crowd (solo −0.03), one boo sound, and the feed line "Section C wanted a ball." **No centre
  text.**
- **Plain deliveries elsewhere** keep today's rule. `SOUV.W` 12 → **20**.
- **The Board's crowd gauge** shows `SECTION C WANTS A BALL · 0:18` while one is lit, from `mods.stadium.req`
  (hand-off to builder 4's `board.js`).
- **Fixes in this file:** the carry prompt becomes "Souvenirs ×2 → crowd rail" (C #11); the autopilot's "A lap of the
  Track!" toast fires only at the Stadium, and never while a story card is up (C #8).
- **Why it's fun:** a timer you can see and a place you can run to. "I've got one, who's near B?" makes 4P shout,
  and lapping vs delivering becomes a real choice each minute.
- **Files:**
  - `web/js/stadium.js` (`SOUV`, `REQ`, pure);
  - `server/venues/stadium.mjs`;
  - `web/js/views/stadium.js` (the ring, the wave, the banner, the toast fix);
  - `web/js/crowd.js` if the wave lives there.
  - Plus the MOW-E 2.0 crowd hook (§2.7: no drain while `crew.mower` is a live boss, +0.08 a hit, 1.0 on a win; read
    from builder 1's `bossSnap`).
- **Verify:**
  - `test/late.test.mjs`: the request cadence by crew size; a lit delivery pays ×3 and +0.15; a miss costs 0.06; the
    relay doesn't stack.
  - **Bot** (`late11` at the Stadium, 1P / 2P / 4P, seeds 7 / 11 / 23, souvenirs on and off):
    - attended, souvenirs are **18–25 % of 4P Stadium income** (today 4–10 %);
    - ignored at 4P, the crowd is under the line at the bell in **≥ 1 of 2** Stadium shifts;
    - ignored solo still **passes ≥ 80 %** (gentle solo, as round 11 tuned it).

### 6 · Endless opens with a win — XS–S · builder 3 (C finding 5)

The Orbital's last shift sets a cash record (debris at weight 3) that endless days can't reach (−15 to −28 %). So the
first endless report is a loss, and no "NEW record" ever comes.

- **The Owners keep their own book.**
  - On banking Ball No. 1, `records.yesterday` and `streak` are cleared, and `records.owner` starts empty.
  - The Orbital's `records.cash` stays as the report's "Best ever".
- **Endless day 1 has no race.** Its report's first line is **"Day 1 as Owners. Beat $70.8M tomorrow."** (7 words).
- **From endless day 2**, the race is yesterday as today, and the record PA fires on beating `records.owner`, not
  the Orbital's number.
- **The sky phase gets a price.** While Ball No. 1 waits on an unbought winch, the strip reads `SKY CLEAR · WINCH
  $13.2M · YOU HAVE $9.1M`. It's a `goals.js` line, so it goes to builder 4 (hand-off).
- **Why it's fun:** "one more shift" needs a winnable target. Day 1 as Owners is a fresh book, not a loss to your own
  ghost.
- **Files:** `web/js/owner.js` (`raceYesterday` with no yesterday → no result; `ownerRecord`), and `server/crew.mjs`,
  **only** `endShift`'s records block (~l.2236–2248) plus the reset line in `depositOne`. The reset is one line,
  handed to builder 2, who owns `depositOne`.
- **Verify:**
  - `test/owner.test.mjs`: no race on endless day 1; the owner record is separate from `records.cash`.
  - **Bot:** `late.mjs` 1P / 2P / 4P into 4 endless days. Day 1 has no loss line, and at least one owner "NEW record"
    in endless days 2–4 in ≥ 2 of 3 runs at each size.

### 7 · Show, don't tell: the founder, the jumbotron, Gary in the world — M · builder 2

Round 12's threads stay word for word where they work. Three beats get a picture, and Gary gets a body.

- **The founder, drawn once** (`web/js/founder.js`, new, pure canvas):
  - `drawFounder(ctx, w, h, t, { sepia, grain })`: a 1958 golfer mid-swing, pose by `t`, the ball a white dot
    climbing off the top of the frame, film grain and vignette.
  - **Muni mid, card 1** ("Found behind the shed: a photo, 1958.") shows it as a **160 × 100 sepia photo** inside the
    caption card. It's still one card and one centre element (A #2).
  - **Orbital mid, card 1** ("Up here, one ball glints") shows the same photo, the dot circled in red pencil.
- **The jumbotron plays the newsreel** (B #5, C).
  - On the Stadium's promotion morning the Board's canvas plays a **12 s sepia newsreel** while the beat's three
    cards run: the founder swings, and the camera pans up into an empty sky.
  - Then it snaps back to Ball Value.
  - It goes through builder 4's new `board.overlay(drawFn | null)` hook.
- **Story card edits** (`story.js`):
  - **Stadium promo**:
    - caption "The jumbotron plays a 1958 newsreel. By mistake.";
    - GARY **"Nice jumbotron. Don't let it go to your head."** (B: the ally half needs a card in this stretch);
    - MEMO **"Site 13 sells tickets to its jumbotron."** (B: the old line was the Club's joke twice).
    - "The founder swings…" is cut: the jumbotron now shows it.
  - **County promo**: **Gary's confession goes first**, "I was a Range Rat. Here. 1987." (minimum 5 s on screen).
    Then the two acquisition memos (C: it read as card 3 of a memo stack; the Orbital's Gary-first order is the one
    C loved).
  - Both threads still appear in every promotion beat (the test stands).
- **Gary in the world** (`web/js/views/garycameo.js`, new: a lightweight Gary figure from `people.js`, a tie quad
  that flaps):
  - **Orbital promotion morning**: Gary rides the Lift car up and back once during the beat (~30 s), tie flapping.
    The hook is in `views/orbit.js`, at the car's ride.
  - **The first endless morning**: Gary stands at the return all shift, tie loose, holding a blue bucket. The first
    Rat within 3 m gets his bubble: **"Where do these go, boss?"** (5 words, world text).
- **Why it's fun:** the story's heart has been captions about things nobody sees. One picture or one visible Gary
  per beat is the screenshot people send each other.
- **Files:**
  - `web/js/founder.js` (new), `web/js/storycard.js`, `web/js/story.js`;
  - `web/js/round2.js` (it starts and stops the newsreel overlay on the Stadium beat);
  - `web/js/views/orbit.js`, `web/js/views/garycameo.js` (new).
- **Verify:**
  - `test/story.test.mjs`: the new lines are ≤ 8 words; both threads are in every promo beat; the County beat opens
    with GARY.
  - `test/founder.test.mjs`: it draws to a stub context without throwing at t 0, 0.5 and 1.
  - **Browser** (pane fronted): screenshots of the photo card, the jumbotron mid-newsreel with a card under it, Gary
    in the Lift, and Gary at the return.
  - `?perf` p95 ≤ 20 ms at the Stadium during the newsreel (the overlay redraws at the flip's 20 Hz, not every
    frame).

### 8 · The fixes pack — S · builder 4

Every bug the testers found, in one brief. Builder 4 makes each fix unless a line says otherwise.

| # | Fix | From | Detail | File |
| --- | --- | --- | --- | --- |
| 8.1 | **The jumbotron flip** | B #4 | Restart a flip only when the text's *skeleton* changes: compare with digits replaced by `#`, so countdowns and BV ticks redraw in place with no scramble. Never restart one mid-flip. A BV change < 1 % never flips. Also adds `board.overlay(fn)` (item 7) and draws the County's `label` and the Stadium's `req` lines (items 2, 5). | `board.js` |
| 8.2 | **The MOW-E alert** | A #1, B #3 | Gone with the daily warn (§2.4); the boss has no ALERT in its warn. → **builder 1** | `main.js` (b1) |
| 8.3 | **The clipped Last Bucket banner** | C #3 | `BALL NO. 1 · HOME · 3/4 · WAITING: RAT2 +1`: one name plus a count, ≤ 28 characters, and CSS `max-width` with an ellipsis as a backstop. Solo: `BALL NO. 1 → THE RETURN`. | `huddlerules.js` |
| 8.4 | **"Today: clear the sky" under BALL NO. 1** | C #4 | The Last Bucket morning's memo is quiet (item 3). | `crew.mjs` memo region |
| 8.5 | **The basket line during the huddle** | C #4 | The morning deal, the checklist and the empty-basket re-deal stand down while `lastBucket` is `down`, `carried` or `huddle`, and while a boss is live. | `morning.js`, `nudge.mjs` |
| 8.6 | **A card fading in over another** | A #5, C #6 | say.js's DOM adapter waits for the outgoing card's `transitionend` (max 300 ms) before showing the next. A story card taking the turn snaps the outgoing card off with no fade. Check once on the Xbox before closing. | `say.js` |
| 8.7 | **"Earn Gary's Seal" hides the huddle** | B #7 | The row reads "Earn Gary's Seal: huddle at the return". | `goals.js` |
| 8.8 | **The sky row's balls vs pieces** | C #2b | The sky row counts pieces: "Clear the sky · 57 debris up". A landed piece floats "+10 balls home" (+15 solo). Also the winch price line (item 6). | `goals.js`, `bvtext.js` |
| 8.9 | **Gary's hello is easy to miss** | A #7 | His bubble shows the hello for his whole wait at the gate, and says it again (once) when a Rat first comes within 8 m. | `main.js` (Gary region) |
| 8.10 | **Helper falls spam the feed** | B #8 | Helper knockdowns aggregate: at most one feed line a minute, "Helpers flattened ×3". | `main.js` (feed) |
| 8.11 | **Balls vanish at dusk** | A #9 | From T−90, resting balls past 15 m from the camera draw at ×1.25 scale with an emissive lift of 0.35, so the closing scramble is a hunt you can see. No new draw call (the ball InstancedMesh). | `main.js` (~l.479) |
| 8.12 | **The HUD counts souvenirs in the pocket** | C #11 | The pocket reads the server pocket. Souvenirs show as their own "×2" chip by the pocket. | `main.js` (HUD) |
| 8.13 | **The lobby tagline is the Muni's everywhere** | B #9 | One tagline per venue, ≤ 8 words (e.g. the County: "Bag the hazards. Sweep the Yards."). | `main.js` lobby / `index.html` |
| 8.14 | **The title rejoins the last crew after a skip preset** | C #10 | Picking a skip-ahead preset clears `range-rat.seat`. | `skip.js` |
| 8.15 | **The lobby camera inside the canopy's pillars; the black slab from the Lift** | C #9 | Lobby camera +6 m back at the Orbital and the Last Bucket. The canopy top gets the canopy's own material on its upper face. If time. | `main.js` lobby, `venues.js` |
| 8.16 | **The autopilot lap toast** | C #8 | → **builder 3** (`views/stadium.js`, item 5). | |

- **Why it's fun:** Polish is the metric players feel without naming it. Each of these was a moment a tester stopped
  playing to read, squint or wonder.
- **Verify:**
  - unit tests for 8.1 (a countdown doesn't flip; a new word does), 8.3 (the width at 1–6 Rats), 8.5, 8.7, 8.8, and
    8.14;
  - `test/say.test.mjs` for 8.6;
  - **browser** screenshots of the Stadium Board during play (≥ 4 of 5 readable, against B's 1 of 5), the 4P carry
    banner at 800 px, the huddle with no checklist, and a dusk field.

### Votes

- G yes.
- E yes ("re-run the 4P ladder after items 1 and 3 land: the Club stays 5–7 shifts").
- M yes ("the boss and the requests are the first jobs that call for a *named* second Rat").
- L yes ("near lanes and rail sections need a clearance test each").
- T yes ("item 1 is the only L; the hot-file regions in §3a don't overlap").
- C yes ("the note at the huddle is the one I'd show my mum").
- Q yes ("a double-loss tame and a quiet Last Bucket memo first, then everything else").

**7–0.**

---

## 3a. Who builds what

Four builders.
- **Only a file's owner edits it.** Anyone else hands their lines to the owner.
- The two hot files are split **by region**, below. Nobody edits outside their region.
- **Merge order** for `server/crew.mjs`: builder 4 → builder 2 → builder 3 → builder 1 (the largest, last, so the
  rebase is onto settled regions).

| Builder | Items, in order | Owns (only they edit) | `crew.mjs` region | `main.js` region | Hands to another owner |
| --- | --- | --- | --- | --- | --- |
| **1 · MOW-E** | #1: the boss → the tame pass → MOW-E 2.0 | `mowe.js`, `mower.js`, `sfx.js`, `pa.js`, `awards.js`, `garyvisit.js`, `today.js`, new `scripts/bots/boss.mjs`, new `test/boss.test.mjs` | `stepMowe` (~l.1719–1750); the `'mower'` branch in `wash()` (~l.888); `mowe` in load (~l.176) and save (~l.2430), one line each | the `mower` / `honk` cases (~l.698–704); the Board banner expression (~l.898); `mowe.update` (~l.1993); the spray-target picker's `'mower'`; the plug prompt and hold; the red edge pulse | the `boss` flag for `midDue` → b2 (`story.js`); the crowd hook → b3 (`stadium.mjs`), reading `bossSnap` |
| **2 · The story and the ending** | #4 → #7 | `story.js`, `storycard.js`, new `founder.js`, `ending.js`, `round2.js`, `views/orbit.js`, new `views/garycameo.js` | `startShift`'s story lines (~l.1166–1183, the hold); `depositOne` (~l.1916–1935, plus b3's one reset line) | none | the newsreel needs `board.overlay` → b4 |
| **3 · Late jobs and endless** | #2 → #5 → #6 | `rally.js`, `county.js`, `server/venues/county.mjs`, `views/county.js`, `stadium.js`, `server/venues/stadium.mjs`, `views/stadium.js`, `crowd.js`, `owner.js`, `settings.js` | `endShift`'s quota `why` and records block (~l.2228–2248) | none | the Zoning label, the request line and the winch price → b4 (`board.js`, `goals.js`); the County NEW line → b4 (`sim.js`); the records reset in `depositOne` → b2 |
| **4 · Text and fixes** | #3 → #8 | `say.js`, `board.js`, `bvtext.js`, `goals.js`, `huddlerules.js`, `morning.js`, `server/venues/nudge.mjs`, **`sim.js`** (sole owner), `clubdays.js`, `skip.js`, `venues.js`, `index.html` | `startShift`'s memo push (~l.1146–1150); the two debut sites (~l.1796, ~l.2028) | the `debut` / `memo` cases (~l.773–780); `textBusy`; the HUD pocket; Gary's bubble; the feed aggregation; the ball dusk lift (~l.479); the lobby camera and tagline | none |

**Done lines.**
- **Builder 1:** `boss.mjs` meets every target in §2.8 at seeds 7 / 11 / 23. A 4P browser fight is screenshotted
  start to pond. `?perf` p95 ≤ 20 ms in phase 2 (in the commit message).
- **Builder 2:** the `lastbucket` preset played to the end card in a fronted pane, with one centre element per
  screenshot. The epilogue morning's clock holds 14 s.
- **Builder 3:** the `late11` County learner (≤ 1 extra DENIED) and the Stadium souvenir share (18–25 % at 4P;
  solo ≥ 80 % when ignored) are in the commit message.
- **Builder 4:** `textload.mjs`: every promotion morning ≤ 28 s and ≤ 3 items; Club days 1–4 ≤ 22 s. The Stadium
  Board is readable in 4 of 5 screenshots.

---

## 4. Deferred (and why)

- **MOW-E in endless** (a "Rematch" contract every ~7 days). It's a good replay hook, but the boss must prove itself
  at the Club and the Stadium first. Next loop, if the fights score.
- **A's pond lure as a mechanic** (steer it into the pond to finish it). Too fiddly with pads on a sofa. The pond is
  the win's cutscene instead.
- **B's Fresh-Cut windrow** (×2 balls behind the mower). The boss's "let it eat, then win ×2" is the same decision
  with fewer rules.
- **MOW-E towing County hazards** (C's honourable mention). It would undercut item 2's sprayer + bagger job, the late
  game's best co-op split.
- **The 1987 tape on a Tiered monitor** (B). Tiered isn't tonight's focus. `founder.js` makes it cheap later.
- **"Previously on Range Rat" story recap** (round12-story open issue). Worth it once the beats are shown, not just
  told. Next story pass.
- **Gary on every Club day while the Seal is open** (A #8). The boss-day slip and the clearer Seal row (8.7) should
  shorten that run. Re-measure before redesigning his schedule.
- **Club days 4–6 dead at 4P** (B #7). Day 4 now debuts bouncy + splitter, and the Seal row says how. Re-measure in
  the full-game loop before adding anything.
- **Solo Stadium fee-only days** (C). "Clock out early" already covers them. Souvenir requests and the encore add
  play to the days that remain.
- **The sky phase with the winch unbought** beyond a price line (C #2a: EVA debris without the winch). The price line
  (item 6) tells the crew what to save for. A crew that can't afford it is still earning at the range. Revisit if the
  next tester idles there.
- **The power-washing truck.** Still not built (rounds 10–11). Not a late-game fix tonight.
- **The reveal's "Day N · venue" toast that the beat drops** (round12-story). Its words are on the sign and the NEW
  line.

**Left alone on purpose:**
- every story line not named above;
- the goal cards and their counts;
- the late fees;
- the County's `HAZ` constants (only the message changes);
- Gary's visit lines;
- the finale's $∞ scramble itself.

---

## 5. What the next late-game playtest loop checks

Three testers on the late stretch, with **the pane fronted for every timed measurement** (C's rAF stall made round 6's
on-screen timing untrustworthy). One plays MOW-E at the Club from a day-3 snap first.

Goals for the late slice:
- Text load ≥ 7.0;
- Clarity ≥ 7.3;
- Meaningful features ≥ 7.0;
- Decision density ≥ 6.5;
- One more shift ≥ 7.

1. **MOW-E.**
   - 4P and solo from the Club day-3 snap, and the Stadium encore from the `stadium1` preset (day 2).
   - Did the crew shout? Who drove, who hosed, who got hunted?
   - Win or loss, fight length, eaten balls, knockdowns.
   - Did anyone *choose* to let it eat?
   - Tame-pass balls a shift on the following days.
   - Is every centre line readable in time?
2. **The County.** Play one shift ignoring hazards on purpose. Does the bell's line and the Board make the fix
   obvious? How many DENIEDs before the crew bags them?
3. **The Stadium.**
   - Do souvenir requests change who does what, minute to minute?
   - Souvenir share of income.
   - Can every Board screenshot be read?
   - Does the newsreel read as the founder's swing?
4. **The Orbital.**
   - Gary in the Lift: seen, screenshotted?
   - The sky row in pieces: does it read?
   - The winch price line during a wait.
5. **The Last Bucket and the ending.**
   - At 4P and solo: the crack, the note in the huddle, then the scramble.
   - Ask after: "What was inside Ball No. 1?" Goal: every Rat answers.
   - Count the centre elements per screenshot (goal: one).
6. **Endless, 3 days.**
   - Day 1's report line.
   - Was any owner record set?
   - Did Gary at the return land?
   - "Do you want a fourth day?"
7. **Text load, measured.** `textload.mjs` on the new build, plus a stopwatch on every late promotion morning: time
   until the crew is free (goal ≤ 28 s).
8. **Then the full-game loop** with the scorecard, all three slices, as the night's last pass. Watch for:
   - the Club's 4P pace (5–7 shifts; the boss must not add one);
   - Club day 3's new shape;
   - the Muni mid photo.
9. **Regression.** `node --test test/` green, `make preflight` green in WSL, 60 minutes with no console errors, and one
   real pad session on the Xbox (the boss's RT spray and Ⓐ hold, the note card's Ⓐ, the card fade on a slow frame).
