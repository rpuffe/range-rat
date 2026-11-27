# Fun Council, round 13: the middle earns its hour

This is the record of Range Rat's thirteenth Fun Council (2026-11-27). It is based on:
- build `966eace` (council rounds 11 and 12 built);
- playtest round 8, the full-game loop (`design/playtest-round8-A.md`, `-B.md` and `-C.md`, with shots in
  `design/shots/pt8-*`);
- the scorecard's Round 8 section (overall **6.8**);
- `council-round11.md`, `council-round12.md`, and `game-design.md` where needed.

Rounds 1–12 still apply wherever this record doesn't change them. Where they disagree, this record wins.

**This round's job.** Lift Overall past 7 by fixing the part of the game that is now weakest: the middle (the Club's
back half and Tiered). Also close the owner's one-centre-text rule for good, and give money a use again.

**The owner's firm calls (unchanged, binding):**
- keep looping to raise quality; the scorecard is how the reviewers judge it;
- MOW-E is "a big deal, like a boss moment";
- Gary and Ball No. 1 are the heart; Site 13 and Dimples are the comedy;
- one centre text at a time, ~8 words; works on a pad; never drops full screen;
- scales for 1–4 players (balanced for 4), and every upgrade is crew-wide;
- "pick the more fun and easier option for a casual crew of 4".

**The council** (same seats as rounds 5–12; ties go to the chair):

| Seat | Lens |
| --- | --- |
| **Game Designer** (G, chair) | Moment-to-moment fun; does each venue play differently? |
| **Systems/Economy Designer** (E) | Prices, payouts, pacing |
| **Multiplayer/Co-op Designer** (M) | 1–4 Rats, roles, solo |
| **Level Designer** (L) | Readable spaces, lanes, sight lines |
| **Technical Director** (T) | Server-authoritative, zero deps, hot files, Xbox frame time |
| **Casual Crew of 4** (C) | Four friends on a sofa, some on Xbox pads in Edge |
| **QA Lead** (Q) | Bugs, dead ends, softlocks; nothing counts until it's reproduced |

**Code read:** `goals.js` (`CARDS`, the live `fee` goal), `sim.js` (`SHOP`, `nextPrice`, `priceScale`,
`CLOCK_IN`/`clockInSpot`, `memoSecond`), `clubdays.js` (`CLUB_DAY`), `mowe.js` (`TAME`, `WHISTLE`, `BOSS_LINES`,
`bossDay`, `newBoss`), `owner.js` (`OWNER_ROW`), the venue shop rows (`dive.js`, `tiered.js`, `county.js`, `orbit.js`,
`bays.js`), `stadium.js` (`STRETCH`), `county.js` (`INSPECT`), `tips.js` (`emptyBasketRat`), `server/venues/index.mjs`
(the module contract), `crew.mjs` (`buy`, `startShift`'s memo push, `stepMowe`, `endShift`, `tomorrowText`), `main.js`
(the mower prompts, `textBusy`, the checklist gate, the payfloat roller, Gary's plate), and
`scripts/bots/mid.mjs` / `make-presets.mjs`.

**What the council ran:** nothing new. Every number below is a tester's (bots and browser), or is read from the code.
Each build item names the measurement its builder must take before merge.

---

## 1. Diagnosis

### 1.1 Why the middle is now the weak spot

Round 12 gave every late venue a peak in the middle of the shift: the Stretch at the Stadium, Inspection Hour at the
County. The late game now leads (C: 7.0, with Decision density at 6.5). The middle got no peak, and the bar moved past
it. B's slice scored **6.5 overall and 5 on Decision density**. That is the lowest cell on the card, in the stretch
that takes **45–50 % of the whole game's time** (B §2: Club and Tiered take 45–68 of 128–157 minutes at 4P). Four
causes:

1. **The Club's back half is a savings account.**
   - Treasures and reviews are done by Club day 3 in 18 of 18 runs. Day 3 belongs to MOW-E.
   - So days 4–5 have one goal, "Save the $110k fee". The fee is a *live* goal (`goals.js`: ticks while cash ≥ fee),
     so the only way to play it is "earn", and earning is what you were already doing.
   - The Club's staggered schedule (`CLUB_DAY`) runs out on day 4 with the bouncy ball and the splitter. Those are ball
     kinds, not jobs.
   - Calls at day 4 and later: **0.69–0.78 a minute**. Two 7-minute shifts with nothing to decide.
2. **The Club's jobs are crew jobs, not Rat jobs.** A Club shift is 2 deals, 1 wash, 0–2 treasures, 0–2 fry dips and
   the whistle. None of that grows with crew size, so calls a minute are **flat from 1P to 4P** (0.76–0.82 / 0.82–0.85
   / 0.72). The bar is ≥ 1 at 1P and ≥ 1.5 at 4P. At 4P, three Rats are just picking up balls.
3. **The pet is automation again.** Round 12 named automation as cause 1 of the late game's dead minutes. The tame
   MOW-E brings in **84–100 balls a shift with the whistle and 62–75 without**: 12–26 % of all balls banked, against the
   council's 30–60. The whistle is "+25 balls, any time, once", so there's no wrong moment and no decision. The pet
   arrives exactly on the dead days and asks nothing of anyone.
4. **The shop ends at Club day 3.** After the second pond tier ($33k at 4P), `next[]` is empty apart from four sub-$3.3k
   tiers nobody wants. From Tiered on, the fee is the only thing to spend on. From the Stadium on, one shift covers the
   next fee, and the Orbital ends with **$250–265M that can't be spent**. Money becomes a score. "Is there anything worth
   buying?" has been "no" since about minute 45.

> G: "The late game got a reason to look up every minute. The Club got a mower that does its chores for it."

### 1.2 The text leaks, and why the model says zero

Text load holds at 7.3 on average, but C scored it **6.5**. In C's slice, the best two beats in the game share the
screen with four other things:
- the Orbital promotion: a PA card under all three story cards;
- the first endless morning: story card + PA + Gary's bubble + the washer tip + 3–4 cash pops.

`textload.mjs` reported **0 overlaps** across all of it.

**The reason is structural.** Each centre writer has its own rule:
- the PA has `say.js`'s PA-idle rule;
- the checklist has its gate;
- the story card has its queue;
- tips, cash pops and name plates have no rule at all.

`textload` models those rules, so it can only find overlaps between writers it knows about. Every round we patch the
two leaks a tester shot, and the next round finds two more. The fix is one arbiter that every centre writer has to
ask, and a counter that reads the real DOM, not the model.

The boss's leftovers are the same problem in the fight:
- the basket nag and the customer-left feed run during the fight;
- "Hold Space: pull the plug" runs after the stamp.

### 1.3 What lifts Overall past 7

Round 8 was 6.8 (A 6.8, B 6.5, C 7.0). Two moves do most of the work:

1. **Give the Club's back half a peak and an aim** (the Members' Tournament and the aimed whistle, items 1 and 5).
   This targets B's 5 on Decision density, 6 on Pacing and 6.5 on Fun, in the stretch that is half the game. Getting
   the Club to ≥ 1 / ≥ 1.5 calls a minute is worth +0.5 on B's overall by itself. Tournament cash also brings the fee in
   a shift earlier, which shortens the Club.
2. **One centre text, enforced at the source** (item 2). This targets C's 6.5 on Text load, and Polish/Clarity for A
   and C (the plug line, the basket nag, the stacked pops, the washer tip). It also makes the owner's rule true by
   construction, so the final loop doesn't spend its attention on it.

A third move holds the gain: **something worth buying at every venue** (item 4). Meaningful features is 6.3 on every
card, and "money is meaningless" appears in both B's and C's reports.

> E: "The goal isn't more money. It's that cash should mean *a decision* again, every venue."

### 1.4 One number for "calls a minute"

The three testers measured calls three different ways:
- A counted "jobs only", merged within 8 s;
- B counted 13 call kinds with 5–30 s merges;
- C counted builder 2's late tally.

So the cross-venue table compares three rulers. Q's condition for every brief below: **one shared tally,
`scripts/bots/calls.mjs`** (item 0). Its definition:

- **A call** is a moment that asks a Rat to go to a specific place, and that costs something if nobody goes. The kinds:
  - lit request, Stretch section, inspector, member ball, deck order (merged into one standing job per 30 s), treasure,
    Gary arrival, deal, boss phase, whistle ready, fixture > 50 % dirty, basket < 25 %, fries < 30 %.
- **Merges:** repeats of the same kind within 8 s count once.
- **Not calls:** special balls coming to rest are not calls. At the Club one lands every ~10 s, so chasing them is the
  default, not a choice (A).

The bar is unchanged: **≥ 1 a minute at 1P and ≥ 1.5 a minute at 4P, at every venue from the Club on.**

---

## 2. Build this (ranked)

Ranked by fun per effort for a casual crew of 4, with the owner's calls first. Item 0 isn't ranked: it is the gate
for measuring everything else, so it merges first.

- **Sizes:** **XS** < 1 hour · **S** an evening · **M** two evenings.
- **Every item:**
  - adds its tests to `node --test test/`;
  - runs `make preflight` (WSL);
  - appends its section to `game-design.md` in the same commit.
- **No new RNG draws** in anything that runs at the Muni or the Club. Use `hash32(day, venueDay, tag)`, as the Stretch
  does. The seam goldens move only where this record expects. The lead re-records them once, after the merge.
- **Every new centre line:**
  - is ≤ 8 words, with a `test/words.test.mjs` entry;
  - goes through item 2's `centre.js`. Nobody writes to the centre directly.
- **Every browser check is taken with the pane fronted**, and with the `?debug` centre-overlap counter (item 2) read
  at the end of the check.

| # | Item | Size | Builder |
| --- | --- | --- | --- |
| 0 | Fix the bots and presets first; one calls tally | S | 4 (merges first) |
| 1 | The Members' Tournament: the Club's back-half peak | M | 2 |
| 2 | One centre text, enforced at the source | M | 3 |
| 3 | MOW-E: the loss path and report, 2.0 crashes Promotion Day, the payout trim, the leftovers | S–M | 1 |
| 4 | Range landmarks: one thing worth buying at every venue, and a Site 13 poach in endless | M | 2 |
| 5 | The aimed whistle: the pet becomes a call | S | 1 |
| 6 | Spawns that look at the venue, not a roof | S | 3 |
| 7 | Where things are: the inspector's place (7a), Gary in the Lift on wall-clock time (7b) | S | 2 (7a), 3 (7b) |
| 8 | The fixes pack | S | 4 (rows marked → go to their owner) |

**If the night runs short:**
- items 0–3 and 5 ship;
- item 4 ships the Tiered, Stadium and endless rows first, then the rest;
- item 8's Low rows are the first to slip.

---

### 0 · Fix the bots and presets first; one calls tally — S · builder 4

*B #1, B's `'hotdogs'` note, §1.4. We can't regenerate a preset today, and we can't compare calls across venues. Both
block the next loop.*

**0a. `mid.mjs` uses the real goal id.**
- Replace `'hotdogs'` with `'fed'` (four sites: the `dogsOpen` read, the cook job, `needOut`, the cook pick). Port it
  from B's `pt8b-mid.mjs`, which already has it.
- Without the fix, the solo bot sat 30 shifts at the Club on "fed 179/180".

**0b. `make-presets.mjs` runs the Stadium.**
- The chain switches from `late.mjs` to **`late11.mjs` with `JOB=1`**. It delivers souvenirs, and it clears the
  Stadium in 2 shifts.
- `late.mjs` becomes a thin wrapper around `late11.mjs`, so old command lines still work.
- The 2P policy also **pings by hand**. C #11: the 2P ladder bot sat 12–50 shifts on "8 more pings".

**0c. `make-presets.mjs` fails loudly.**
- Each venue gets a shift cap: Muni 8, Club 10, Tiered 6, Stadium 6, County 6, Orbital 4.
- Over the cap, the script exits 1 and prints the stuck goal: "stuck at Stadium on requests 0/6 after 6 shifts".
- It never writes a partial preset set.

**0d. Two new presets** for this round's checks:
- **`club4`**: the morning of Club day 4, with MOW-E tame and the card down to the fee. This is the Tournament's day.
- **`stadiumPromo`**: the Stadium's Promotion Day, with `encore` not yet played. This is item 3's crash.

**0e. `scripts/bots/calls.mjs`:** the one tally from §1.4.
- It's imported by `muni.mjs`, `mid.mjs`, `late11.mjs`, `boss.mjs` and `pt7c-endless.mjs`.
- It prints jobs a minute by venue and crew size.
- It replaces `pt8a-tap.mjs` and B's and C's private tallies, which are kept only for reference.

**0f. Policy hooks.**
- `scripts/bots/policies.mjs` loads `scripts/bots/policy/<name>.mjs` files, switched on by env flags: `TOURNEY=1`,
  `WHISTLE=aim`, `BUY=1`, `POACH=1`.
- Each builder drops in their own policy file (items 1, 4, 5), so no builder edits builder 4's bots.

**Verify:**
- `node scripts/make-presets.mjs` regenerates every preset at 4P, seeds 7 / 11 / 23, with no cap hit.
- `mid.mjs` 1P leaves the Club in ≤ 8 shifts at all three seeds.
- `calls.mjs` reproduces round 8's Club 4P figure from the same seed (within ±0.1 of B's 0.72), so the ruler is
  continuous.

---

### 1 · The Members' Tournament: the Club's back-half peak — M · builder 2

*B #3, #4, B's idea 3, and the brief. This is the Club's answer to the Stretch: once the card is down to the fee, the
members come out to play. Their balls are worth chasing, and they land everywhere at once.*

**When.**
- **Club day 4 on** (`CLUB_DAY.tourney = 4`), on any Club day that isn't a boss day (a rematch keeps the day) and isn't
  Promotion Day.
- In 18 of 18 round-8 runs, that is exactly the fee-only days.
- **Two flights a shift:**
  - **T−5:00** (shiftT 120);
  - **T−2:30** (shiftT 270);
  - each moved by up to ±20 s to stay clear of a Last Call deal.

**What happens.**
- **Members tee off.** Three members walk out to the covered bays, the ones nearest the clubhouse. They're `people.js`
  figures in navy blazers, and one of them wears **a Site 13 jacket**.
- **Each member hits one "member's ball"**: a white ball with a navy band, under a **navy-and-gold beam** (the beacon
  instance path, so no new draw call).
  - **How many a flight:** 2 at 1P–2P, 3 at 3P–4P, 4 at 5P–6P.
- **Where they land.**
  - Spots come from `hash32(day, venueDay, flight)`: 60–140 m out, with at least one left and one right of centre.
  - **At 3P and up, one ball in each flight lands in the pond**, so a diver is needed.
- **The clock.** Each ball has **30 s**. The beam shrinks over that time. Then the **members' caddie cart** (a small
  white cart that hums out from the clubhouse) claims it, and the ball is gone.
  - The clock is visible, and there's an actual rival for the ball.
- **The pay.** A member's ball banked at the return pays **×25 Ball Value**.
  - At a 4P Club BV of ~$70, that's ~$1,750 a ball, and two full flights are ~$10k: **~20 % of a $50k shift**.
- **A clean flight** (every ball in a flight banked):
  - the feed line "Clean flight! The members are appalled.";
  - a chime;
  - Dimples doffs his monocle on the Board.
- **Missed balls cost nothing but the cash.** There's no boo and no penalty. It's a party, like the Stretch.

**What you see and hear.**
- **One centre ALERT a flight** (through `centre.js`):
  - flight 1: **"Members' Tournament! Grab their balls first!"** (6 words);
  - flight 2: **"Second flight! Grab the members' balls!"** (6).
- **The Board:** `MEMBERS' TOURNAMENT · ●●○ · 0:22` (the pips show the balls still out).
- **The sound:** a polite golf-clap per ball landed, and a kazoo stinger when the caddie cart claims one.
- **The morning memo's second line** on the first Tournament day: **"Members' Tournament today. Site 13 entered
  anyway."** (7). It goes through `memoSecond`'s `note` slot, a hand-off to builder 4.

**The decision this creates.**
- At 4P: "you take the far left, I've got the right, Pip dives". Every flight is a four-way split with a 30 s clock.
- Solo: two balls, 30 s each. Which one first, and is the far one worth the run?
- With item 5's aimed whistle, **MOW-E can fetch a member's ball**. It counts if his strip covers it, and that's the
  whistle's best use on these days.

**Why it's fun.**
- The quiet days become the Club's busiest minutes.
- The members and the Site 13 gatecrasher are the comedy.
- The ball's value is big enough to bring the fee in a day early, so the Club gets *shorter* as well as busier.

C: "Mine! No — *mine!* The caddie's coming!"

**Files** (all new, or b2-owned):
- `server/venues/tourney.mjs` (a venue module, `venue: 1`, active only while `crew.venue === 1`; plugged in with one
  line in `server/venues/index.mjs`);
- `web/js/tourney.js` (`TOURNEY = { DAY: 4, AT: [120, 270], DODGE: 20, SECS: 30, PAY: 25, N: [2, 2, 3, 3, 4, 4],
  POND_FROM: 3 }`, `memberSpots`);
- `web/js/views/tourney.js` (the members, the beams, the caddie cart);
- `scripts/bots/policy/tourney.mjs`;
- `test/tourney.test.mjs`.

**Hand-offs:**
- `clubdays.js` `CLUB_DAY.tourney`: one line, b2 edits it (pure, no other owner this round);
- the Board line → b4 (`board.js`);
- the memo note → b4 (`sim.js`);
- the client view's one import and one update call → b3's `main.js` region (venue views list).

**Verify:**
- **`test/tourney.test.mjs`:**
  - no flight on a boss day, on Promotion Day, or before Club day 4;
  - the two flights fire at 120 / 270 s, dodging a deal;
  - N by crew size;
  - one ball in the pond at 3P+;
  - spots on both sides, with no RNG draw (the seam golden for Club days 1–3 is unchanged);
  - a claim at 30 s;
  - ×25 on bank;
  - a clean flight fires once.
- **Bot** (`mid.mjs` from `club4` and from `club1`, `TOURNEY=0/1`, 1P / 2P / 4P × seeds 7 / 11 / 23):

  | Measure | Target | Round 8 |
  | --- | --- | --- |
  | Club calls a minute, days 4+ (`calls.mjs`) | **≥ 1.0 at 1P, ≥ 1.5 at 4P** | 0.69–0.78 |
  | Club calls a minute, whole venue | ≥ 1.0 / ≥ 1.3 | 0.76–0.82 / 0.72 |
  | Member balls banked, `TOURNEY=1`, 4P | 4–6 of 6 a shift | — |
  | Tournament share of a Tournament day's income | 15–25 % | — |
  | Club length, 4P W-mode (huddles, wins the boss) | **≤ 4–5 shifts, never longer than round 8** | 4–5 |
  | `TOURNEY=0` (ignores it) loses vs `TOURNEY=1` | ≥ 10 % of the day's income | — |

- **`textload.mjs`:** a Tournament day adds at most two centre items (the two ALERTs) and 0 overlaps.
- **Browser** (`club4`, solo, then 3 seats via `seats.mjs`), shots:
  - flight 1 landing: beams up and the ALERT;
  - the caddie cart claiming a ball;
  - the Board's pips.

---

### 2 · One centre text, enforced at the source — M · builder 3

*C #1, #4, #7; A #2, #3, #8, #11; the brief. This is the owner's rule. We stop patching leaks one at a time and make
overlap impossible.*

**2a. `web/js/centre.js`: one arbiter, one ladder** (new, pure, and testable with no DOM).
- **Priority, from highest:**
  0. the story card (and the note card, the epilogue cards);
  1. the boss stamp and the venue ALERTs (MOW-E phases, the Stretch, Inspection, the Tournament);
  2. PA cards;
  3. the memo;
  4. tips and the checklist line;
  5. toasts.
- **The API:**
  - `centre.request({ id, pri, text, minSecs, maxWait })` returns a ticket;
  - `centre.up()` names the one item on screen;
  - `centre.busy(pri)` is true while anything at that priority or higher is up or queued.
- **The rules:**
  - **Only one item draws.**
  - A higher priority arriving **snaps the lower one out in 150 ms** (8.6's card snap). A PA keeps its audio and
    caption queued, and plays after.
  - A lower priority **waits**, up to its `maxWait`:
    - PA 6 s, then its caption goes to the feed;
    - tips 0 s: a tip never queues; it fires later or not at all;
    - the memo waits for the story card, as now.
  - **An outgoing item's fade finishes before the next one starts** (A #8: half-opacity cards under the next one).
- **Every existing writer is routed through it:** `say.js` (PA, MEMO, STAMP, ALERT, TOAST), `storycard.js`, the
  checklist gate in `main.js`, `tips.js`, the boss lines in `main.js`, and the end card. `textBusy()` becomes
  `centre.busy(…)`.

**2b. The non-text clutter.** These items aren't text, but they sit in the centre during the beats that matter.
- **Cash pops** (`payfloat.js`):
  - pops from the same source merge within 1.5 s into one float that counts up: "+$51.98 ×7" (A #11: 7 deep over the
    Board);
  - at most **2 floats on screen**;
  - **hidden** while a priority 0–1 item is up, and during the hush and the epilogue.
- **Name plates** (Rats, helpers, Gary's plate): faded to 0 within 15 m of the return during the hush, the note card
  and the epilogue (C #7).
- **The washer tip** ("The washer hopper is empty. Bank some balls."; C #4: the second centre text in almost every late
  shot). It fires only when **all** of these hold:
  - the hopper has been empty for ≥ 30 s of shift time;
  - balls are on the field;
  - no priority 0–3 item is up;
  - **the crew has banked < 1,000 balls lifetime.**

  Effectively it's a Muni-week tip, and it never shows at a late venue.

**2c. The boss owns the screen** (A #2, #3).
- From the warn to the stamp (`bossOwnsScreen(mower)`, a pure predicate builder 1 exports from `mowe.js`):
  - the checklist's basket nag, the "No buckets. A customer left." feed and the helper feed are muted;
  - after the stamp, one summary feed line: "3 customers left during the fight."
- **The plug prompt** shows only while `phase === 'plug'` and you're in the ring. Every prompt path reads `canPlug()`,
  including the one that came back 20 s after the stamp.

**2d. The named leaks, each with a test.**
- the Orbital promo's "Earth is fully retrieved. Please look up." under all three promo:5 cards;
- the first endless morning's PA, story card, Gary's bubble, the tip and the pops;
- the bank PA "No more balls. Every ball mattered." under the note card;
- the Stadium day-1 and end-card cases from round 12 (regression).

**2e. Count the real screen, not the model.**
- **In `?debug`:**
  - a DOM watcher (`window.__centre`) samples every 100 ms;
  - it counts **overlap frames**: two or more centre-zone elements at opacity > 0.3 (story, PA, memo, tip, checklist,
    toast, stamp, and the boss toast);
  - it logs each overlap with both texts.
- **`textload.mjs`** (builder 3 owns it this round) models `centre.js` itself, so the model and the client run the same
  rules.

**Why it's fun.**
- The note over the gold ball, Gary at the glass case and the Orbital promotion all get the clean frame they were built
  for.
- The boss minute is the boss's.
- The rule stops being a whack-a-mole list each loop.

**Files:**
- new `web/js/centre.js`;
- `say.js`, `pa.js`, `storycard.js`, `tips.js`, `payfloat.js`, `morning.js`;
- `scripts/bots/textload.mjs`;
- `test/centre.test.mjs`, `test/say.test.mjs`.
- **`main.js` regions:**
  - `textBusy` and the checklist gate (~l.1619–1690);
  - the payfloat roller;
  - the plates (Gary's plate ~l.2133, helper and Rat plates);
  - the PA and story hookup;
  - the venue-views list (one line for b2).

**Verify:**
- **`test/centre.test.mjs`:**
  - only one item draws;
  - a higher priority snaps a lower one and the PA replays after;
  - a tip never queues;
  - the fade finishes before the next item shows;
  - the boss predicate mutes the nag;
  - the plug prompt is phase-gated.
- **`test/say.test.mjs`:** each 2d leak, scripted, gives one centre element.
- **`textload.mjs`** over **every morning of the game** plus the boss, Stretch, Inspection, Tournament, bank and
  epilogue windows, at 1P and 4P, seeds 7 / 11 / 23:
  - **0 overlaps**;
  - promotion mornings ≤ 28 s;
  - Club day 1 ≤ 22 s.
- **Browser** (fronted, `?debug`): `orbital1` promo, `lastbucket` → bank → first endless morning, and the `club3` boss
  fight to the stamp + 30 s.
  - The `__centre.overlaps` counter reads **0** at the end of each run.
  - Shots: the note card with no pops, plates or tip; Gary at the case with one centre element; mid-fight with no
    basket line.

---

### 3 · MOW-E: the loss path and report, 2.0 crashes Promotion Day, the payout trim, the leftovers — S–M · builder 1

*A #1, #5, #11; C #2; A's payout row. This is the owner's boss moment. The win works; the loss is silent and points the
wrong way; and the best crews never meet the sequel.*

**3a. A loss you feel.**
- **On a loss, MOW-E gets its own stamp.** **"MOW-E WINS"** uses the TAMED stamp's twin, in red, for ~2 s. MOW-E then
  drives into its shed with the catcher rattling, and the door slams.
- **Then one centre line:** **"MOW-E got away. Rematch tomorrow."** (5 words).
  - If tomorrow isn't a Club boss day (a Promotion Day, or the second loss), the line is **"MOW-E got away. For
    now."** (5), and the warranty line follows the next morning as now.
- **The Board:** `MOW-E 1 · CREW 0` until the rematch.
- **The report** gets a **MOW-E row** above the goals, whether you won or lost:
  - lost: `MOW-E: got away · kept 26 balls · rematch tomorrow`;
  - won: `MOW-E: tamed · 18 balls · 4 gold`.

**3b. `tomorrowText` knows about MOW-E** (A #1: "Tomorrow: Gary visits" on the rematch eve).
- A MOW-E branch comes **ahead of Gary's**:
  - the boss eve (Club day 2): **"Tomorrow: MOW-E finishes its update."** (5);
  - the rematch eve: **"Tomorrow: MOW-E's rematch. Wands at the bell."** (7);
  - the eve of 3c's crash: the promo line stands (the crash is a surprise).

**3c. MOW-E 2.0 crashes Promotion Day** (C #2: fast 4P crews finish the Stadium card on day 1 and never meet the
sequel, 2 of 3 runs).
- **`bossDay`** allows `promo` at the Stadium when `!s.encore` (and the crew has a tame MOW-E, as for the encore).
- **The warn comes at T−4:00** (shiftT 180), so it falls after the ceremony's morning, and the bell still promotes.
- **The fiction:**
  - the PA caption: **"MOW-E heard about the ceremony."** (5);
  - the Board's banner reads `PROMOTION DAY · MOW-E 2.0 UPDATE ▓▓░`.
- **Gary's Stadium mid beat (`mid:3`) plays that morning too** if it hasn't played: "Saw that lap. Don't tell
  Regional." It's one card, and it keeps the morning ≤ 28 s.
- **The outcome:**
  - **a win** pays as the encore does, and the stamp says **"MOW-E 2.0 TAMED"**;
  - **a loss doesn't block promotion.** MOW-E 2.0 drives off through the stands: **"MOW-E 2.0 left. It took the
    bunting."** (7). `encore` is marked played either way, so the County never gets a mower.
- The 1P/2P path (the encore on Stadium day 2) is unchanged.

**3d. The payout trim** (A: 12–21 % at 3P/4P against the 8–12 % target).
- The fountain's MOW-E balls go from **×2 to ×1.5**.
- If 3P still has a median over 12 % after that, the catcher's cap goes from **30 to 24 at 3P+**.
- The gold balls are unchanged: they're the trophy.

**3e. Teach the sidestep** (A #5: solo, the hunt reads as "run").
- The first time a Rat is the hunt target in a shift:
  - the red edge pulses on **the side to dodge toward**;
  - the hunt line reads **"Step aside, then hose its back!"** (6) for a crew of 1–2. 3P+ keep "Lead it into a cart!",
    since someone is usually near one.
- **The tell:** before each 3 s re-aim, MOW-E's exhaust gives a visible **rev puff** (two smoke sprites), so the dodge
  has a rhythm.

**3f. Small leftovers.**
- **The "MOW-E is loose!" toast** (A #11: pale and low-contrast at the bottom) is drawn in the PA-card style, as a
  priority-1 ALERT.
- **`bossOwnsScreen(mower)`** is exported for item 2c.

**Why it's fun.**
- The loss becomes a cliffhanger with a scoreline, not a feed line.
- The best crews get the owner's boss moment, in the funniest possible place.
- Solo players learn the counter from the fight itself.

**Files:**
- `web/js/mowe.js` (`bossDay`'s promo branch, `PROMO_AT 180`, `BOSS_LINES.lost / lostLater / crash / crashLeft`,
  `BURST_MULT 1.5`, `bossOwnsScreen`, the dodge side);
- `web/js/mower.js` (the shed retreat, the rev puff, the stands exit);
- `web/js/sfx.js` (the door slam);
- `web/js/awards.js`;
- `web/js/story.js` (b1 owns it this round: `mid:3` on the crash morning);
- `scripts/bots/boss.mjs`, `pt7a-boss.mjs`;
- `test/boss.test.mjs`.
- **`crew.mjs`:**
  - the `stepMowe` region (~l.1794–1940: win, lose, the promo gate);
  - **`tomorrowText`** (~l.2704: the MOW-E branch; b1 owns the function this round);
  - the report's MOW-E row (one entry in `endShift`'s report object).
- **`main.js`:**
  - the mower cases and prompts (~l.1197–1230, ~l.1754);
  - the red/amber edge (dodge side);
  - the loss stamp.

**Hand-offs:** the Board's scoreline and promo banner go to b4 (`board.js`) through `bossBoard`, as now.

**Verify:**
- **`test/boss.test.mjs`:**
  - a loss fires the stamp and then one line, and the line's "tomorrow" is true for the next day's `bossDay`;
  - `tomorrowText` on the boss eve and the rematch eve;
  - `bossDay` returns `'encore'` on a Stadium Promotion Day with `!encore`, and null after;
  - the crash warns at 180 s;
  - a crash loss still promotes and sets `encore`;
  - the burst is ×1.5;
  - the dodge side is perpendicular to the hunt's heading.
- **Bot** (`pt7a-boss.mjs`, seeds 7 / 11 / 23 / 31 / 41 / 53, every policy; and `late11.mjs` from `stadium1` at 4P):

  | Measure | Target | Round 8 |
  | --- | --- | --- |
  | Payout share, median, 3P/4P | **9–12 %** (max 14 %) | 12–21 % |
  | Win rates | unchanged (4P roles 100 %, swarm ≥ 90 %, 2P ≥ 85 %, 1p-cart ≥ 85 %, 1p-chase ≥ 60 %) | met |
  | 4P runs that meet MOW-E 2.0 | **3 of 3 seeds** | 1 of 3 |
  | 4P runs that see `story:mid:3` | 3 of 3 | 1 of 3 |
  | Stadium length, 4P | unchanged (2 shifts) | 2 |

- **Browser** (`club3`, solo): lose on purpose, then shots of the red stamp, the shed door, and the report's MOW-E row
  and its Tomorrow line. Then `stadiumPromo`: a shot at the crash warn with one centre element.

---

### 4 · Range landmarks: one thing worth buying at every venue, and a Site 13 poach in endless — M · builder 2

*B #2, C §3 ("$295M at endless day 4"), C's idea 4, the brief. Money should buy something you can see, that changes
how a shift goes, at every venue from the Club to endless.*

**4a. One new crew row: "Range landmarks".**
- One tier per venue. The tiers are sequential (you build the Club's before the Tiered one).
- **Each is a visible build that stays at every later venue**, like the bays: concrete, crew-wide.
- Prices are base × `priceScale` (4P ×2.2), as for every crew row.

| Tier | Venue | Price (base → 4P) | ≈ 4P shifts of income | What it is | What it does |
| --- | --- | --- | --- | --- | --- |
| 1 | Club (from Club day 4) | $15k → **$33k** | ~0.7 | **The Members' Bell**: a brass bell on a post by the return | **Ring it (Ⓐ) for a bonus flight** of the Tournament, once a shift, from T−6:00 to T−1:30. ALERT: "Bonus flight! The bell has spoken." (6). At later venues it rings for the venue's peak and at the bank (sound only). |
| 2 | Tiered | $200k → **$440k** | ~0.75 | **The dimpl Tap Wall**: a neon tap wall on the deck, lower-case logo | **Every third deck order pours itself** ("TAP WALL GOT IT" on the ticket), so the cook can leave the deck for one order in three. |
| 3 | Stadium | $5M → **$11M** | ~1.4 | **Stretch fireworks**: launch racks on the stand roof | **The Stretch lights one more section** (3 at 1–2P, 4 at 3P+). Each answered section fires a firework over its stand. All of them answered: a **GRAND SLAM** volley and +0.10 crowd. Later: a volley at the bank. |
| 4 | County | $20M → **$44M** | ~1.5 | **Site 13's inspector, on retainer**: he wears their jacket | **A second Inspection Hour** at T−5:30 (45 s, ×4 in his Yard). Board: `INSPECTOR (EX-SITE 13)`. Next memo: "Site 13's inspector works for us now." (7). |
| 5 | Orbital | $60M → **$132M** | ~1.3 | **A star named Gary**: five stars spelling GARY over the Lift (one sprite) | Nothing in play: it's the heart. Gary's next bubble: **"A star. Named Gary. I'll allow it."** In endless the star hangs over the glass case, and the plaque gets a line, "A star named Gary". |

- **Why the prices sit where they do** (E): the middle must not get longer. The fee is a live goal, so any purchase
  delays it.
  - **At the Club and Tiered, the price fits inside the 4P surplus at the venue's last bell**: Club $122k against a
    $110k fee; Tiered $1.9M against a $1.32M fee. Buy it and you still promote on schedule.
  - **From the Stadium on, ~1.5 shifts.** Those venues are 2 shifts at 4P and pace well, so "buy the fireworks and
    promote a shift later" is a real, optional trade. A crew that skips a landmark can build it at the next venue for
    much less: by then the next tier is the aspirational one.

**4b. Endless: "Poach a Site 13 regular".**
- **A repeatable row, endless only, once a day.**
- **Price:** 25 % of yesterday's bank ($10–25M at 4P).
- **Today:**
  - a bay of Site 13's regulars, in their jackets, hits at your range (+1 bay hitting, ~+6–8 % balls);
  - **Site 13's live target drops 5 %**;
  - the feed says "Site 13 lost a regular. To you.";
  - the Board's `SITE 13 (est.)` ticks down once.
- **The week:** a day you poach *and* win counts as **2 of the "4 of 7"** toward the acquisition. C: the acquisition
  was reached in 0 of 33 runs inside 4–5 endless days; this makes it reachable by day 4–5 for a crew that spends.
- **The report hint** (C): **"Hustle days beat Site 13."** (5), once, the first time a Hustle contract wins against
  them.
- **The statue** ($300M) and the Owner's Hustle are unchanged. Poaching competes with saving for them, which is the
  point.

**Why it's fun.**
- Money buys a *thing* on the range, and usually a new call: the bell's flight, the tap wall freeing the cook, a fourth
  Stretch beam, a second inspection.
- The Orbital's tier is a Gary beat, and endless gets a daily "spend or save?" with Site 13's face on it.

**Files:**
- new `web/js/landmarks.js` (`LANDMARK_ROW`, `landmarkTier`, the perks' constants) and `web/js/views/landmarks.js`
  (the bell, the tap wall, the racks, the star: built once, shown by tier);
- `server/venues/deck.mjs` (the tap wall), `server/venues/stadium.mjs` + `web/js/stadium.js` (the extra section and
  the fireworks), `server/venues/county.mjs` + `web/js/county.js` (the second inspection),
  `server/venues/tourney.mjs` (the bell flight);
- `web/js/owner.js` (b2 owns it this round: `POACH`, `rivalTarget`'s −5 %, the double-count);
- `scripts/bots/policy/landmarks.mjs`, `policy/poach.mjs`;
- `test/landmarks.test.mjs`, `test/owner.test.mjs` (the poach block).
- **`crew.mjs`:** the `buy()` region (~l.573): a `poach` branch for a once-a-day repeatable, the only new buy shape.
  The rival's week count, in `endShift`'s records block, is one line, handed to b4 (records are b4's this round).

**Hand-offs:**
- the SHOP list line (`LANDMARK_ROW`, `POACH_ROW`) and `perks()`'s `landmark` field → b4 (`sim.js`);
- the Board lines (the poach tick, the inspector label) → b4 (`board.js`);
- the memo line → b4;
- Gary's star line → b1 (`story.js`) or b4 (`garyvisit.js`), whichever holds the bubble.

**Verify:**
- **`test/landmarks.test.mjs`:**
  - tiers are sequential;
  - each tier shows from its venue (the bell from Club day 4);
  - the bell flight fires once a shift inside its window;
  - every third order self-pours;
  - the Stretch gets +1 section and GRAND SLAM fires only on all answered;
  - the second inspection runs at T−5:30 for 45 s at ×4;
  - the star draws once.
- **`test/owner.test.mjs`:** the poach costs 25 % of yesterday, works once a day, sets −5 % today, and a poached win
  counts 2.
- **Bot** (the whole ladder, 4P × seeds 7 / 11 / 23, `BUY=1` and `BUY=0`; then `pt7c-endless.mjs` 6 days,
  `POACH=0/1`):

  | Measure | Target | Round 8 |
  | --- | --- | --- |
  | Shifts with nothing worth buying (no unbought tier ≤ 2 shifts of income), Club day 1 → endless day 4 | **0** | every shift from Club day 3 |
  | Club / Tiered length, `BUY=1` vs `BUY=0` | **equal** | — |
  | Stadium / County length, `BUY=1` | ≤ +1 shift each | 2 / 2 |
  | Orbital last-bell cash, `BUY=1` | **≤ $100M** | $250–265M |
  | Statue bought by endless day | 4–7 | ~4–5 |
  | Site 13 acquired by endless day 5, `POACH=1` | ≥ 1 of 3 runs | 0 of 33 |
  | Site 13 beat rate, `POACH=0` | 45–65 % (unchanged) | 60–64 % |

- **Browser:** a shot of each landmark built: the bell (Club), the tap wall (Tiered), the racks firing (Stadium), the
  inspector's jacket (County), the GARY star (Orbital).

---

### 5 · The aimed whistle: the pet becomes a call — S · builder 1

*B #6, #7; B's ideas 1 and 5; the brief. The pet is a 20 % passive income that nobody notices. Make it smaller, aimed,
and talked about.*

**5a. The whistle goes on a lanyard.**
- **At the MOW-E post, Ⓐ takes the whistle.** Prompt: **"Ⓐ: take MOW-E's whistle"** (4).
  - It's carried like the wand: it doesn't block picking, and one Rat holds it.
- **Out in the field (≥ 20 m from the return), with no ball in reach, Ⓐ blows it.** Prompt: **"Ⓐ: whistle MOW-E
  here"** (4).
- **MOW-E drives to the whistler** and mows **a 10 m-wide strip, 30 m long, through that spot toward the return**. He
  gathers up to **30**.
  - That's the aim. You whistle where the balls are, or where a member's ball is (item 1).
- **Once a shift.** The whistle goes back on its post.

**5b. Smaller passes.**
- The automatic passes go from 3 (20 / 45 / 70 %) to **2 (30 / 65 %)**, at **12 a pass** (`TAME.CAP 25 → 12`).
- The whistle is where the pet's value lives: **≥ 40 % of its take.**

**5c. Told and credited.**
- The memo after the win: **"MOW-E sends his regards. Whistle at the post."** (8).
- **The feed:** "Pip has the whistle." → "Pip whistled. MOW-E's on his way." → "MOW-E brought 28 home."
- **The HUD:** a small MOW-E icon by the cash while the whistle is on the post, dimmed while someone carries it, and gone
  once it's used.

**Why it's fun.**
- The pet becomes a "who goes and stands where the balls are" call every shift, and a tool for the Tournament.
- You can love a pet you point.

**Files:**
- `web/js/mowe.js` (`TAME.AT [0.3, 0.65]`, `CAP 12`, `WHISTLE = { POST, R, CARRY: true, MIN_D: 20, STRIP: { W: 10, L:
  30 }, CAP: 30 }`, `BOSS_LINES.take / blow`);
- `web/js/mower.js` (the strip drive);
- `scripts/bots/policy/whistle.mjs` (`WHISTLE=aim`: carry to the densest 10 m strip ≥ 20 m out, or a member's ball);
- `test/boss.test.mjs`.
- **`crew.mjs`:** `stepMowe`'s tame pass and the whistle input (`act` `'whistle'` gains `{ x, z }` from the server's own
  player position, not the client's).
- **`main.js`:** the whistle prompts (~l.1198–1227, ~l.1754) and the carried-whistle mesh.

**Hand-offs:** the HUD icon → b4 (`bvtext.js`/HUD strip); the memo text → b4 (`sim.js`).

**Verify:**
- **`test/boss.test.mjs`:**
  - take, carry and blow;
  - no blow within 20 m of the return;
  - the strip geometry and the 30 cap;
  - 2 passes of 12;
  - once a shift;
  - the whistle is server-positioned.
- **Bot** (`mid.mjs` from `club4`, 1P / 4P × 3 seeds, `WHISTLE=0/post/aim`):

  | Measure | Target | Round 8 |
  | --- | --- | --- |
  | Pet balls a shift, `aim` | **30–55** | 84–100 |
  | Pet balls a shift, never whistled | 18–24 | 62–75 |
  | Whistle share of the pet's take, `aim` | ≥ 40 % | ~25 % |
  | Pet share of all balls banked | **≤ 8 %** | 12–26 % |
  | Member balls fetched by MOW-E, `aim` + `TOURNEY=1` | ≥ 1 a shift in ≥ half the shifts | — |

- **Browser:** a shot of the whistle carried in the field, and one of MOW-E mowing the strip toward the whistler.

---

### 6 · Spawns that look at the venue, not a roof — S · builder 3

*B #8, C #8. The first look at a new venue is the venue.*

**The cause.**
- `CLOCK_IN` puts the Muni-to-Tiered row at x 18 + 2.4 per slot, z 4. That's under the Club's covered-bay roof, and,
  from Tiered on, under the deck's right end.
- Round 12 moved only venues ≥ 3 (`LATE_FROM: 3`) to `LATE_XS`, by the washer.

**The fix, in order** (stop when the check passes):
1. **`CLOCK_IN.LATE_FROM: 3 → 1`.** The Club and Tiered use `LATE_XS`. The Muni is unchanged, so its seam golden holds.
   L checks the washer handles, the MOW-E post (x 31.5) and the Club's kitchen pole against the six slots.
2. **The spawn pitch** eases from −0.2 to **−0.28** over the first 1.5 s of a shift at venues ≥ 1. That's less
   ceiling and more field, and the player keeps control.
3. **The deck cutaway** (round 12's step 3, not built): while the camera is within 4 m of the deck's footprint, the deck
   floor's material fades to 35 % opacity. It's one material, so no new draw call. This is C's County/Orbital 25–30 %
   slab.
4. **Tiered's lamp post** (B: dead centre at spawn) moves 3 m along the rail, out of the centre 20 % of the frame.

**Why it's fun.** The promotion reveal hands back to a Rat who's looking at the new range: the pond, the deck, the
stands.

**Files:**
- `web/js/sim.js`'s **`CLOCK_IN`/`clockInSpot` block only** (b3 owns that block this round; b4 owns the rest of
  `sim.js`);
- `web/js/venues.js` (the cutaway, the lamp post);
- `main.js`'s `me` spawn pitch (~l.633) and its ease.

**Verify:**
- **A test:** `clockInSpot(1|2, k)` is outside the awning's and the deck's footprint for k = 0..5.
- **Browser, pixel pass in `?debug`** (canvas readback): first-person at the **Club day 1, Tiered day 1, Stadium,
  County and Orbital** spawns.
  - Roof or underside pixels are **≤ 10 % of the frame**.
  - No post sits in the centre 20 %.
  - Shots of each.

---

### 7 · Where things are: the inspector's place, Gary in the Lift on wall-clock time — S · builder 2 (7a), builder 3 (7b)

*C #3 and #6. Two late beats that are told but can't be found or seen.*

**7a. The inspector has a place and a light** — builder 2.
- **A white clipboard-beam** over the inspector for his 60 s. It uses the beacon instance path, so there's no new draw
  call.
- **The ALERT names the place**, by the patch centre's side and depth from the mats:
  - **"Inspector at the far left Yard!"** (6);
  - the template is "Inspector at the {near|far} {left|middle|right} Yard!" (≤ 7).
- **The Board:** `INSPECTION · FAR LEFT · 0:45` (the label is `where`, which today is "6 HAZARDS").
- **A 3 s screen-edge chevron** toward him at the ALERT. It reuses builder 1's pond-chevron element through a
  `chevron(x, z, secs)` call. b1 exports it; this is a one-line hand-off.
- **At 1P only:** his visit is preceded by a 2 s look-at nudge (the camera eases 15° toward him, and control isn't lost).
- **Files:** `web/js/county.js` (`inspectWhere`), `server/venues/county.mjs`, `web/js/views/county.js` (the beam). The
  Board line → b4.
- **Verify:**
  - `test/late11.test.mjs`: `inspectWhere` maps (11.3, −42.2) to the right words; the ALERT is ≤ 8 words.
  - **Browser** (`county1`, 3 seats, T−3:30): a shot from the mats with the beam in frame and one ALERT.

**7b. Gary in the Lift, on one clock** — builder 3.
- **The cause:** the reveal camera (`round2.js`) advances by frame `dt`, while the story cards run on wall-clock time.
  At 1 fps, card 2 ("Gary rides the Lift. Tie flapping.") played over the gate.
- **The fix:** both run on **one clock**.
  - The camera's path is parameterised by **wall-clock seconds since the reveal began**, so a slow frame jumps the
    camera to where it should be. It doesn't fall behind.
  - **Each card can name a camera cue** (`cue: 'lift'`). The card waits for the cue's pose to be reached, up to 3 s,
    and the camera waits on the card's end.
- This applies to every reveal (the Club's bay sweep, the Stadium's newsreel facing the Board, the endless case), not
  just the Orbital.
- **Files:** `web/js/round2.js`, `web/js/storycard.js` (`cue`).
- **Verify:**
  - `test/round2.test.mjs`: with a fake clock stepping at **1 fps and at 60 fps**, card 2 is up while the camera is
    within 30 m of the Lift, both times.
  - **Browser** (`orbital1`, fronted): Gary ≥ 40 px tall in a shot during card 2.

---

### 8 · The fixes pack — S · builder 4 (rows marked → go to their owner)

Every small bug the testers listed, in one brief.

| # | Fix | From | Detail | Owner, file |
| --- | --- | --- | --- | --- |
| 8.1 | **The empty-basket alarm is muted on day 2** | A #4 | When the basket first empties while the checklist is open, the checklist adds **"↑ Fill the bucket basket"** (4) as its next step. `emptyBasketRat` ignores an unfinished `sign` step. | → b3, `tips.js`, `morning.js` |
| 8.2 | **A double press skips the story card** | A #6 | The first card of a beat after a menu or report button gets a **1.2 s** input grace (the 1958 photo card 1.8 s). The report's Next shift button shows its pressed state at once, so nobody clicks twice. | → b3 `storycard.js` (grace); b4 `dayend.js`/report button |
| 8.3 | **The final report can be skipped by a held Ⓐ** | C #14 | Ready ignores Ⓐ/Space for 1.5 s after any card closes, and needs a fresh press (key-up seen). | b4, `ending.js`, `main.js` (the ready press) |
| 8.4 | **The reward shown isn't the reward paid** | A #7 | A `buy` goal's ✦ shows the reward at the Ball Value it will pay at (after the washer lands), so "+$54.88" shows as "+$54.88". | b4, `goals.js` |
| 8.5 | **"1 more minute" for 1 second** | B #10 | `mins()`: under 60 s reads "under a minute". "1 more minute" only covers 60–119 s. | b4, `goals.js` |
| 8.6 | **A diver misses Gary's huddle** | B #11 | When the huddle opens, every Rat > 40 m away or diving gets a 3 s chevron and the feed "Huddle! Pip, surface!". The huddle waits up to 10 s more for a diving Rat. | b4, `garyvisit.js`, `huddlerules.js` |
| 8.7 | **The Stadium lobby line is stale** | C #10 | "Answer souvenir requests. Keep the crowd happy." | b4, the lobby tagline (`sim.js` `lobbyTagline`) |
| 8.8 | **The endless report's fold** | C #13 | The 2★/3★ contract rows go above the fold. "(missed washer bonus $44,033)" wraps inside its column. | b4, `recap.js` |
| 8.9 | **3★ contracts are a 1-in-16** | C #9 | "Nobody knocked flat" → "at most 1 knockdown". Target 25–40 % with the contract-aware bot. | b4, `today.js` |
| 8.10 | **The rival's week count for a poached win** | item 4b | One line in `endShift`'s records block. | b4, `crew.mjs` |
| 8.11 | **Club mid card 1 restates the Muni photo** | B §3 | Left alone this round (§3). Listed so it isn't lost. | — |
| 8.12 | **The pay floats stack 7 deep; the hush pops** | A #11, C #7 | In item 2b. | → b3 |
| 8.13 | **The plug prompt after the stamp; the basket nag in the fight** | A #2, #3 | In items 2c and 3f. | → b3, b1 |

**Verify:**
- unit tests for 8.1, 8.2 (the grace), 8.3 (a held key doesn't ready), 8.4, 8.5 and 8.9;
- `pt7c-endless.mjs` for 8.9's band;
- **browser:**
  - a new solo crew that skips the sign on day 1 sees "Fill the bucket basket" on day 2 (shot);
  - a double click on Next shift still shows the photo card for ≥ 1.8 s.

**Why it's fun:** Polish (6.3) and Clarity (6.7) are where a squint costs the most points. Each row is a moment a
tester stopped.

---

### Votes

- **G yes:** "The Club gets a peak on its quiet days, and the pet gets an aim. That's the middle's Stretch."
- **E yes:** "Landmarks are priced against the surplus at the Club and Tiered, so the middle doesn't lengthen. I re-run
  the money table after merge. The Orbital must end under $100M."
- **M yes:** "Member balls split a crew four ways with a pond ball for the diver, and the whistle is a fifth job. Solo
  gets two balls and a pet to point."
- **L yes:** "I check the six `LATE_XS` slots at the Club against the kitchen pole and the MOW-E post, and the member
  balls' spots against the creek."
- **T yes:** "+0 draws for the member beams and the inspector beam (the instance path). +4 for the landmarks, built
  once. `centre.js` is pure, so it's tested without a DOM. The reveal on wall-clock time removes a frame-rate bug
  class."
- **C yes:** "The caddie cart is the villain we needed."
- **Q yes:** "Item 0 first, and one calls tally, or none of the next loop's numbers mean anything. Then the overlap
  counter reads the real screen."

**7–0.**

---

## 2a. Who builds what

Four builders.
- **Only a file's owner edits it.** Anyone else hands their lines to the owner.
- The two hot files are split **by region**, below. Line numbers are at `966eace`. If a merge has moved a region, find
  it by its name.
- **Nobody edits outside their region.**

| Builder | Items, in order | Owns (only they edit) | `server/crew.mjs` region | `web/js/main.js` region | Hands to another owner |
| --- | --- | --- | --- | --- | --- |
| **1 · MOW-E** | #3 → #5 | `mowe.js`, `mower.js`, `sfx.js`, `awards.js`, `story.js`, `scripts/bots/boss.mjs`, `pt7a-boss.mjs`, `policy/whistle.mjs`, `test/boss.test.mjs` | the `stepMowe` region (~l.1794–1940: fight, win, lose, the promo gate, the tame pass, the whistle input); **`tomorrowText`** (~l.2704+); the report's MOW-E row in `endShift` (one entry) | the mower cases and boss prompts (~l.1197–1230); the prompt line list's whistle/plug entries (~l.1754); the red/amber edge and the pond chevron (exports `chevron()` for b2); the loss stamp; the carried whistle | the Board scoreline, the promo banner and the HUD icon → b4; the memo lines → b4 (`sim.js`); `bossOwnsScreen` → b3 (an export, not an edit) |
| **2 · Club and economy** | #1 → #4 → 7a | new `server/venues/tourney.mjs`, `web/js/tourney.js`, `views/tourney.js`, `landmarks.js`, `views/landmarks.js`; `clubdays.js`; `server/venues/index.mjs` (one line); `server/venues/deck.mjs`; `stadium.js`, `server/venues/stadium.mjs`; `county.js`, `server/venues/county.mjs`, `views/county.js`; `owner.js`; `policy/tourney.mjs`, `policy/landmarks.mjs`, `policy/poach.mjs`; `test/tourney.test.mjs`, `test/landmarks.test.mjs`, `test/late11.test.mjs`, `test/owner.test.mjs` | **`buy()`** (~l.573): the `poach` branch only | **none** (the view's one import and one update call → b3's venue-views line) | SHOP list lines and `perks()` → b4 (`sim.js`); the Board lines → b4; the memo lines → b4; the records line → b4 (8.10); Gary's star bubble → b1 (`story.js`) |
| **3 · Text and look** | #2 → #6 → 7b, plus 8.1, 8.2 (grace), 8.12, 8.13 (the nag) | new `web/js/centre.js`; `say.js`, `pa.js`, `storycard.js`, `tips.js`, `payfloat.js`, `morning.js`, `round2.js`, `venues.js`; `sim.js`'s `CLOCK_IN` block only; `scripts/bots/textload.mjs`; `test/centre.test.mjs`, `test/say.test.mjs`, `test/round2.test.mjs` | **none** | `textBusy` and the checklist gate (~l.1619–1690); the payfloat roller; the plates (Gary ~l.2133, Rats, helpers); the PA and story hookup; the spawn pitch (`me`, ~l.633); the venue-views list (b2's line) | — |
| **4 · Tools and fixes** | #0 (first) → #8, plus every hand-off above | `scripts/bots/*` (except boss bots, `textload.mjs` and the `policy/*` files), `scripts/bots/calls.mjs`, `policies.mjs`, `scripts/make-presets.mjs`, `server/presets/*.json`; `sim.js` (except `CLOCK_IN`), `board.js`, `bvtext.js`, `goals.js`, `recap.js`, `dayend.js`, `garyvisit.js`, `huddlerules.js`, `ending.js`, `today.js`, `signs.js`, `skip.js` | `startShift`'s memo push (~l.1170–1185); `MEMOS`; `endShift`'s records block (8.10) | the ready press on the report and end card (8.3); the HUD strip (`bvLine`, b1's icon); the huddle chevron call (8.6) | — |

**Merge order.**
1. **Builder 4's item 0** lands first, on its own. It changes no game behaviour: bots, tally, presets script, policy
   loader.
2. **Builder 3's `centre.js` API** (the module and `say.js` routed through it; no `main.js` yet) lands next, so builders
   1 and 2 send their new lines through `centre.request` from the start.
3. **The hot files: builder 4 → builder 2 → builder 1 → builder 3.**
   - Builder 2's `crew.mjs` footprint is one branch.
   - Builder 1's is `stepMowe` and `tomorrowText`.
   - **Builder 3 goes last**, because its `main.js` sweep re-routes every centre writer. Going last means it catches
     builders 1 and 2's new lines and closes the overlap counter on the finished build.
4. **The lead:**
   - regenerates the presets with item 0's script (now including `club4` and `stadiumPromo`);
   - re-records the seam goldens once. Expected moves: the Club spawn row (item 6), Club day 4+ (the Tournament), and
     the Stadium promo day (the crash). The Muni and Club days 1–3 must not move.

**Shared tests:** `test/words.test.mjs` takes everyone's new lines. Append only, one block per builder; the lead
resolves conflicts there.

**Done lines** (each in the commit message):
- **Builder 1:** item 3's boss table at 6 seeds. 4P meets MOW-E 2.0 in 3 of 3. The pet table at 3 seeds. Loss-path and
  crash shots.
- **Builder 2:** item 1's calls table (Club days 4+ ≥ 1.0 / ≥ 1.5). The money table (`BUY=1`: Orbital ≤ $100M, Club and
  Tiered lengths unchanged). Inspector beam shot.
- **Builder 3:** `textload` 0 overlaps on every window. The `__centre` counter reads 0 on the three browser runs. The
  spawn pixel pass ≤ 10 % at five spawns. The Lift shot.
- **Builder 4:** make-presets regenerates every preset at 3 seeds with no cap hit. `calls.mjs` reproduces round 8's
  Club figure. Every 8.x row is tested.

---

## 3. Deferred (and why)

- **A Muni day-3 mini-call** (A's idea 3: one timed gold ball, or "3 CUSTOMERS WAITING"). Muni day 3 is a real lull
  (~0.8 jobs a minute). But the first hour scored 6.8–7, and the boss lands inside it. The Muni's seam goldens are the
  game's regression anchor, and this round already moves the Club. With item 0's tally, the next playtest measures
  whether the Muni is still under the bar on one ruler. **First candidate for the next council.**
- **Tiered's deck orders as one camping job** (B #5: 1.3–1.4 calls a minute at 4P counting orders as one). The tap wall
  (item 4) loosens it for crews that buy it. Re-measure with `calls.mjs` before designing a Tiered peak. Glow Rush
  already gives Tiered its buzzer-beater.
- **The 1P County spot check** (C's idea 5). The County landmark adds a second inspection for any crew that buys it,
  and item 7a's look-at nudge helps solo players find him. Re-measure 1P County calls on the shared ruler first (C's
  1.06 mean came from a different tally).
- **The boss build-up camera nudge at 75 %** (A's idea 5). Round 12's update bar, stripes and amber edge are there. A
  says they're not in frame from a far green, but a camera grab during play is a control-loss risk on a pad. Revisit
  after the Xbox session.
- **The Club mid beat's first card** (B: "restates the Muni photo"). Story lines are left alone except the new ones.
  This goes to the next story pass, with the Tiered Gary lines nobody saw.
- **Greatest Hits theme days / a MOW-E Rematch in endless.** Still the best long-term endless idea, and still an L.
  The poach and the star give endless days 3+ something to buy and someone to beat for an S.
- **Gary as a slow fifth Rat in endless.** The star line and the glass case carry the heart this round. Next story
  pass.
- **"Previously on Range Rat."** The final review loop plays the whole game in one sitting and judges whether it's
  needed.
- **A 4P boss fight in a real browser crew.** Still a tooling gap. `seats.mjs` (C) gives the closest substitute; the
  owner's sofa is the real test.

**Left alone on purpose:**
- the fees and the venue cards (the Tournament isn't a card goal: it's cash and fun, not a gate);
- the statue's and the Owner's Hustle's prices;
- the boss's HP table and fight rules (A: "the high point of the first hour");
- the note at the huddle and the epilogue's lines (C: "the best moment in the game");
- every story line not named above.

---

## 4. The next loop, and the final one

Two loops remain:
1. **One more playtest → council → build loop** (playtest round 9, council 14).
2. **A final, review-only scorecard loop across the full game.** No build follows it. It's the verdict.

### 4.1 Playtest round 9: what the testers focus on

**The split.** It's the usual A / B / C by stretch, with B's stretch tightened to the middle:
- **A:** the Muni → the Club through the boss (win *and* lose);
- **B:** Club day 4 → Tiered → Stadium day 1;
- **C:** the Stadium → endless day 5.

One tester runs the **whole game at 4P headless** with `BUY=1 TOURNEY=1 WHISTLE=aim`, seeds 7 / 11 / 23, for the
pacing and money tables. **Everyone uses `calls.mjs` and the `?debug` centre counter.** No private tallies.

**What they check:**
1. **The middle.**
   - Club days 4+ calls a minute at 1P / 2P / 4P: is the Tournament a peak, or noise?
   - Does the caddie cart read as a rival?
   - Does a 4P crew split for the member balls and send a diver to the pond ball?
   - Is the Club shorter or the same?
2. **The pet.** Who carried the whistle, where did they blow it, and did MOW-E fetch a member ball? The pet's share of
   balls banked.
3. **Money.**
   - Cash against fee at every venue's last bell.
   - The first shift with nothing worth buying (target: never).
   - Which landmark each tester bought first, and whether they could *see* it afterwards.
   - Did poaching change an endless day's plan?
4. **One centre text, end to end.** The `__centre.overlaps` count for every stretch, which must read 0. Every overlap
   gets a shot and both texts. Specifically re-check the Orbital promo, the first endless morning, the boss fight and
   the bank.
5. **MOW-E.**
   - The loss path: stamp, line, report row, Tomorrow line.
   - The rematch.
   - The Promotion Day crash at 4P: did it land, and was it funny?
   - The payout share.
   - Did a solo player learn the sidestep without being told twice?
6. **Look.**
   - The spawn pixel pass at all six venues.
   - Gary in the Lift at a throttled frame rate (DevTools CPU ×6).
   - The inspector's beam from the mats.
7. **Regressions.** Muni days 1–3 and Club days 1–3 play as in round 8, which the seam goldens confirm. Boss win rates
   hold. The late venues' calls stay at or above round 8 on the new ruler.

**Goals for the round-9 card:**
- **overall ≥ 7.2**;
- **decision density ≥ 6.5 in every slice** (B was 5);
- text load ≥ 7.5;
- meaningful features ≥ 7.0;
- no metric under 6.5 in any slice.

### 4.2 The final review-only scorecard loop

**The setup.**
- The reviewers play **the whole game in one sitting**, as the owner's crew will.
- The split: a 4P sofa simulation (`seats.mjs` + bots for three seats), plus one solo run and one 2P run.
- They score the ten metrics against Round 8 and Round 9.
- **No council and no build follow.** Any finding is logged for the owner, not fixed.

**What they focus on:**
1. **The whole arc**, Muni to endless day 5. Is there a stretch longer than 10 minutes with no call? Does any venue
   feel like a cliff (too hard) or a coast (nothing to do)? Total time to the ending at 1P / 2P / 4P, against 2 h 05–2
   h 15 at 4P.
2. **The heart and the comedy, as a through-line.**
   - Does Gary's thread (the clipboard → "I raked this pond once" → the 1987 tape → "I was a Range Rat" → the Lift →
     the star → the case) land as one story?
   - Do Site 13 and Dimples stay funny without crowding it?
   - Does Ball No. 1's ending still land after two hours?
3. **The owner's rules, end to end.**
   - One centre text, ~8 words: the `__centre` counter is 0 for the whole run.
   - The pad works for every verb: the whistle, the bell, the plug walk, the Stretch, the Tournament.
   - Nothing drops full screen.
   - Every upgrade is crew-wide.
   - 1–4 players all reach the ending.
4. **"One more shift" at three points:** after the first boss, after the Club, and at endless day 3. Would the crew
   keep going?
5. **Performance as the Xbox sees it.** `?perf` p95 ≤ 20 ms with the CPU throttled: the Stretch with fireworks, boss
   phase 2, the Tournament's beams, and the return with the case.
6. **Softlocks and saves.** Quit and rejoin mid-boss, mid-Tournament, mid-bank, and on Promotion Day. Every save
   restores.

The final card's verdict is the game's: **overall ≥ 7.0 with no metric under 6.5 means ship it to the sofa.**
