# Fun Council, round 10: the mid-game, and a goal card in place of stamps

This is the record of Range Rat's tenth Fun Council (2026-11-24). It sits on top of the owner-playtest-3 build, which
is mid-build in the tree (`design/owner-playtest-3.md`: Ball Value, the day's rhythm, the basket, upgrades, Gary).
Rounds 1–9 and the owner-playtest-3 spec still bind wherever this record doesn't change them. Where they disagree, this
record wins.

**This round's job is the mid-game, the Club → Tiered stretch.** The owner finds it boring. In the owner's words:
- *"The mid-game is kind of boring."*
- *"The food is kind of confusing for what it does. The fry satisfaction rate, I'm not sure what that is supposed to
  do. With the hot dogs, I'm not sure what the benefit is… money or multipliers or something like that, for food."*
- *"With the beer thing, I'd like to see where the beers go and whether the people are getting drunk on top of the
  Topgolf thing… or we should get cutscenes if somebody falls off the top of it."*
- *"When we moved to the Topgolf thing where you have the second row, it's not more people hitting balls… Basically
  more bays."*
- *"With the scuba diving, we should be able to scuba dive through the river too, not just the middle pond piece."*

Partway through the round, the owner added six more notes (A–F). They are ranked alongside the mid-game items:
- **(A)** *"I don't know when I can move to the stadium range. I have 3 review stamps, I'm not sure what that means… Maybe
  a series of goals… and those goals give rewards."* This is the biggest note.
- **(B)** Dirt you can see on the sign and the ball return.
- **(C)** A second ball return out in the field, with a pneumatic tube home.
- **(D)** Late automation that changes how a late shift plays.
- **(E/F)** *"I'm not sure what the middle thing does."* The owner clarified: *"the greens… it's not really clear what the
  second flags on the same green do."*

**The owner's firm calls (unchanged, binding):**
- multiplayer first (up to 6, balanced for 4, no assigned roles)
- one day = one shift
- a ball that hits you knocks you down
- scuba is fancy
- no named balls
- rare PA lines
- the kitchen serves fries, hot dogs and beer
- the Tiered beer fall
- the shop is open any time
- an Xbox controller, with Xbox Edge as the performance floor
- every feature is worth it
- one centre text at a time, about 8 words
- choose what's more fun and easier for a casual crew of 4

**The council (same seats as rounds 5–9).**

| Seat | Lens |
| --- | --- |
| **Game Designer** (G, chair) | Moment-to-moment fun; does each venue play differently? |
| **Systems/Economy Designer** (E) | Prices, quotas, fees, income per shift, pacing |
| **Multiplayer/Co-op Designer** (M) | Join, leave, rejoin, six players, solo |
| **Level Designer** (L) | Readable spaces, one map rule per venue |
| **Technical Director** (T) | Server-authoritative, zero deps, core vs new files, Xbox frame time |
| **Casual Crew of 4** (C) | Four friends on a sofa, some on Xbox pads in Edge |
| **QA Lead** (Q) | Reads the code for bugs, dead ends and softlocks; nothing counts until it's reproduced |

Ties go to the chair.

**What the council read:**
- `council-round9.md`, `owner-playtest-3.md`, `scorecard.md`, `playtest-round4.md`, and `game-design.md`. In
  `game-design.md` it read closely the Club, Tiered, Upper Deck, kitchen, Dimple Creek and Scuba v2 sections, and the
  owner-playtest-3 build notes.
- The code for each system:
  - the kitchen: `kitchen.js`, `menu.js`, `sim.js` `FRIES`/`VENUE_RULES`, `crew.mjs` `serve`/`addFries` and the eat
    loop;
  - the deck: `deck.js`, `server/venues/deck.mjs`, `views/deck.js`;
  - Tiered: `tiered.js`, `server/venues/tiered.mjs`, `views/tiered.js`, and `venues.js` (the deck building);
  - the water: `map.js` (the creek and drift), `dive.js`, `scuba.js` (outline), `terrain.js` (the creek ribbon and the
    flags), and `crew.mjs` `stepPond`/`sink`/the treasure;
  - promotion: `crew.mjs` `promoInfo`/`promote`/`endShift`/`tomorrowText` and `PROMO_STAMPS`;
  - dirt: `mud.js` (the mat overlay).

**What the council ran.** Headless node scripts against the real `Crew` from the main repo. The tree is mid-build, so
every number is approximate. The scripts live in the scratchpad's `council10/`, with harness `h.mjs`. The harness keeps
the new basket stocked, standing in for a crew that fills it. The scripts edit no game code. Rule variants are emulated
from outside.

| Script | What it measures |
| --- | --- |
| `ladder.mjs` (+ `tally.mjs`, `uphook.mjs`) | The round-8 whole-ladder bot, ported to the tree: crew gear, the new rows, and the basket stocked. `tally.mjs` writes per-shift tallies: income, banked, reviews, fee, serves, deck orders, Gary. `uphook.mjs` adds the Upper Deck bays (`UP`, `CUPFULL`). Run for 1, 2 and 4 Rats, seeds 7, 11 and 23 |
| `goals.mjs` | Reads the tallies and gives the venue day on which each measurable goal-card goal would complete |
| `food.mjs` | What a cook is worth at the Club and Tiered. 4P: three foot pickers, plus a fourth who picks or cooks. Fries, hot dogs (with the FED rule emulated through `crew.seal`), a mix, or beer. Knobs: `EAT` (the eat rate) and `DOGFRY` (whether a hot dog fills the fryer) |
| `upper.mjs` | Tiered with customers on the Upper Deck too. The idle, cups-first and leave-the-cups crews, with a TARGET at T−90…T−50, and Bay Utilization read at 1:00 with `CUP_FULL` 30/40/45/48 |
| `creek.mjs` | Balls that land in Dimple Creek a shift, by branch and kind, at the Muni, the Club and Tiered |
| `return2.mjs` | The mean walk from where balls rest to the nearest ball return, for candidate field returns |

---

## 0. What the numbers say

**N1 · Fries feel pointless because a hand cook can't win.**
- At the Club, customers eat a basket every 5 swings (`VENUE_RULES[1].eatEvery`). With ads, that's about 150 baskets
  a shift at 4P.
- A hand cook with the electric peeler makes 34 serves a shift (one every 12 s). That only lifts the fryer from 6% to
  17%.
- So the owner's "Fry Satisfaction" sits near empty whatever the cook does.
- A full fryer is worth a lot: **+28%** income (empty fryer $27.3k, full fryer $34.9k, Club venue day 2, 4P). No one
  can see that, and a cook can't reach it by hand.

| Club vd2, 4P, three foot pickers + a fourth Rat (`food.mjs`, seeds 1–4) | Income | Fryer (mean) |
| --- | --- | --- |
| Fourth Rat picks too (peeler) | $27,266 | 6% |
| Fourth Rat cooks fries (peeler), today's eat rate | $28,574 (**+5%**) | 17% |
| …at **one basket every 8 swings** | **$34,873 (+27%)** | **83%** |
| Conveyor bought, fourth Rat picks | $35,595 | 97% |

**N2 · A hot dog is a worse basket of fries.**
- Today a hot dog yields 2 or 1 baskets (fries yield 3 or 2), so it's simply a weaker fry.
- Its only real uses are Gary's kitchen check and −2 deck drinks.
- Give dogs a crew multiplier instead (**FED**): a good dog +0.05, a perfect one +0.10, capped at ×1.25, wearing off by
  0.05 every 20 s. A cook serving one every 12 s holds **×1.21 on average**.

| 4P, the fourth Rat cooks dogs, FED emulated (`food.mjs`) | Income | vs a fourth picker |
| --- | --- | --- |
| Club, conveyor | $35,595 → **$43,909** | **+23%** |
| Club, peeler (the fryer then drains to 7%) | $27,421 → $33,827 | +23%, but the fryer is lost: fries or dogs is a real choice |
| Tiered, conveyor | $218,129 → **$270,202** | **+24%** |
| Tiered, beer (dog at amber), today's rule | $218,129 → $283,532 | +30% |

So under these rules each food is worth a Rat's whole shift:
- fries before the conveyor (+27%);
- dogs after it (+23%);
- beer at Tiered (+30%).

**N3 · Every venue has the same supply, and Tiered and later are supply-bound.** The 4P ladder bot banks about
1,000–1,100 balls a shift at every venue from the Muni's day 3 on. The 10 mats are the ceiling. Customers on the Upper
Deck are the "more bays" the owner asked for:

| 4P ladder bot, median income a shift | Today | + 6 upper bays (UP 0.6), `CUP_FULL` 48 |
| --- | --- | --- |
| Tiered | $646k | **$910k (+41%)** |
| Stadium | $2.45M | $3.61M (+47%) |
| County | $13.1M | $19.4M (+48%) |
| Orbital | $67.5M | $95.8M |

With a crew that picks, the balls a Tiered shift rise from 1,033 to **1,675** (`upper.mjs`). With an idle crew, the
field's `MAX_BALLS` 800 caps it: customers wait. More customers are only more money if the crew picks faster.

**N4 · More customers means more cupped balls. `CUP_FULL` 30 becomes too hard.**

| `upper.mjs`, 4P, a crew that picks but leaves the cups alone, 6 seeds | No TARGET | TARGET T−75 | T−70 | T−65 |
| --- | --- | --- | --- | --- |
| Today (no upper bays), `CUP_FULL` 30 | 4/6 | 6/6 | 6/6 | 6/6 |
| 6 upper bays, `CUP_FULL` 30 | **2/6** | 5/6 | 3/6 | 6/6 |
| 6 upper bays, `CUP_FULL` 40 | **4/6** | 5/6 | 6/6 | 6/6 |
| 6 upper bays, `CUP_FULL` 48 | 4/6 | 5/6 | 6/6 | 6/6 |

- In the ladder bot (which never aims and empties cups first), 6 upper bays at `CUP_FULL` 30 cost one Tiered shift at
  4P on one seed. At 2P, Tiered then takes 4–20 shifts. At 48, 4P is back to 3 and 2P to 4–5 (today 3–5).
- Upper-bay **lead** balls tank Pond Clarity, because they sink with no extra diving share. So the deck hits no lead.
- The Glow Rush keeps its teeth in every variant: a TARGET at 1:05 passes 6/6, and one after 1:00 can't help.

**N5 · Dimple Creek carries a lot of balls, and none of them can be collected in it.**
- A Club shift (4P, ads) puts **~104 balls in the creek**: 81 run out to the Grate and 23 run in to the Delta, where
  they sink in the pond.
- **21 of them are glow balls** from Last Call.
- 60 lead balls sink in the pond besides.
- The branches are 58.6 m (in) and 77.9 m (out), at 1.5 m/s, so a ball drifts 39–52 s.
- A drifting ball can't be picked up at all today.

**N6 · Walking home is half of hand-picking.**
- The mean straight-line walk from a resting ball to the return is **100 m** (Muni day 4) and **99 m** (Club).
- A field return at **(10, −62)**, between the Red and Yellow flags and north of both creek branches, cuts it to
  **41 m / 48 m**. That puts 51% / 43% of balls within 30 m of a return.
- A third, by Blue at **(−6, −128)**, cuts it to **26 m / 30 m** (68% / 64%).

**N7 · The pace today, and why a goal card must keep "three good days".**

| Ladder bot, today's rules | Muni | Club | Tiered | Stadium | County | Orbital starts |
| --- | --- | --- | --- | --- | --- | --- |
| 4P (seeds 7/11/23) | 5 | 3 | 3 | 3 | 3 | **127 min** (Last Bucket ~135–143) |
| 2P | 4 | 3 | 3–5 | 3 | 3 | 119–134 min |

- `goals.mjs` on the tallies shows **"review hit 2×" lands on venue day 2** at the Club to the County, at every crew
  size.
- At 4P the fee lands on day 3 at the Club and **day 2 from Tiered on**.
- So a card of "the fee, 2 reviews and some light goals" would promote after 2 shifts from Tiered on. That is −3
  shifts, about −23 min, at 4P.
- The three review stamps are what sets the pace today, so the card keeps them, as **"Hit the daily target 3×"**.
- With the upper bays, the fee lands on day 1–2. With the late fees ×1.5 (§1 item 3), it's back to day 2 at every
  crew size.
- (The solo bot sticks at the Stadium for 32–48 shifts because its lap share can't hold the crowd. That's a bot
  artefact: playtest 4's solo run reached the Last Bucket in 150 min.)

**N8 · What the owner's own examples cost.**
- "Bring up 3 treasures": a treasure sinks on a 50% roll each morning, one at a time. Three would take about 6 Club
  shifts.
- "Pass Gary's inspection" or "Full huddle for Gary": Gary comes every 2–3 days (owner-playtest-3 §6.2), so a crew
  sees **one** visit in three Club shifts. One miss costs 2–3 days.
- Both need a rule fix to be fair goals (§1 item A).

**N9 · The "second flag".**
- At the Muni and the Club, each green is a ground disc with a 6 m flag (`terrain.js`). They're landmarks, with no
  rule.
- At Tiered, the target pin goes up at `b.x + 0.55 r`, beside the landmark flag, with a 10 m pole and a cup-count flag
  (`views/tiered.js`). So one green carries two flags.

---

## 1. Verdicts

**Adopt** = build as proposed · **Adapt** = build the council's version · "→ #n" points at the build list (§2).

### A · Promotion: a venue goal card replaces the review stamps — **Adopt, with five refinements** (→ #1)

The owner: "I have 3 review stamps, I'm not sure what that means." C agrees: four friends can't say what "3 of 3
stamps plus a fee" asks of them. A card of five things to do, each named and counted, is the fix. It is also the
mid-game's best cure: each Club day gets its own reason to exist.

**The rule.**
- Every venue from the Muni to the County shows **one goal card of 5 goals**.
  - The last goal is always **"Save the $X fee"**. It is live: it ticks when cash ≥ fee and un-ticks if cash drops
    below it.
  - One goal is always **"Hit the daily target N×"**: the Closing Bell's APPROVED, counted at this venue. N is 2 at the
    Muni and **3 from the Club on** (N7: that's what holds the pace).
  - The other three are feature goals chosen so the crew uses what the venue is for.
- **All 5 done → the crew can sign** at the report, as today (every online Rat signs, then the fee is paid). C wanted
  "4 of 5". G and E said no: the owner wants to "experience all the things", and every goal below is guaranteed
  doable at every crew size. That vote went 5–2 (C and M for 4 of 5).
- **Each feature goal pays a reward when it completes: 50 × BV in cash** (about $1,450 at the Club, $15k at Tiered,
  $75k at the Stadium), plus a ping. The review and fee goals pay nothing extra:
  - APPROVED keeps its 15%-of-the-day bonus;
  - the fee is the fee.
- **APPROVED/DENIED, the target tick and the bonus are unchanged.** The daily target is now "a daily bonus, and one
  goal on the card".
- **Counts scale with the crew** like this, and only like this:
  - 4P is the printed number;
  - solo ×0.4, 2P ×0.6, 3P ×0.8, 5P ×1.2, 6P ×1.4, rounded up;
  - the card is printed on the venue's first morning for the crew online then, and never moves.
  - M: "a late joiner never raises the bar, and a crew that shrinks keeps what it was printed".
  - Prices still scale live (unchanged).

**Two rule fixes so the owner's examples are fair (N8):**
- **A forced treasure.** While a card's treasure goal is open, a treasure sinks every morning, whenever none is already
  down there. Today that is a 50% roll.
- **Gary comes back tomorrow.** While a Gary goal is open and a visit didn't complete it, his next visit is the next
  day. The tomorrow line is "Gary will be back tomorrow." (5 words). Otherwise the owner-playtest-3 §6.2 schedule
  stands.

**The cards** (4P numbers; ✦ = pays 50 × BV):

| Venue | Goal 1 ✦ | Goal 2 ✦ | Goal 3 ✦ | Goal 4 | Goal 5 |
| --- | --- | --- | --- | --- | --- |
| **Muni** | Bank 2,000 balls | Buy the ball washer | Huddle for Gary (every online Rat in the ring when he arrives; a pass isn't needed) | Hit the daily target 2× | Save the $5,500 fee |
| **Club** | Serve 30 hot dogs | Bring up 2 treasures (the second lies in the creek, under the Bridge) | Earn Gary's Seal (a pass with a full huddle) | Hit the daily target 3× | Save the fee |
| **Tiered** | Land 8 TARGETs | Fill 24 deck orders | Buy the ball-return gutters | Hit the daily target 3× | Save the fee |
| **Stadium** | Drive 20 laps of the Ping Track | Ping the cart 12 times | Buy the second cart | Hit the daily target 3× | Save the fee |
| **County** | Sweep 150 strays from the Yards | Buy the drones | Pass Gary's inspection (late Gary gets a stake: C's ask) | Hit the daily target 3× | Save the fee |
| **Orbital** (the Last Bucket card) | Every Rat rides the Lift | Bring down 60 debris | Buy the tether winch | Clear the sky (today's sky gate) | – |

- **The Orbital card is the ending.** Ball No. 1 falls when all four are done.
  - Measured: the tether (13.2M at 4P) costs a fifth of an Orbital shift, and 60 debris is two EVA trips.
  - So the card adds nothing to today's Orbital time. It just names the steps.
- **Endless has no card.** The yesterday race stays, and C's endless ask stays open.

**Why these numbers** (`goals.mjs`, 4P bot, seeds 7/11/23):
- "Bank 2,000 balls" lands on Muni day 4 at every crew size, after scaling: solo 800 on day 4, 2P 1,200 on days 3–4.
- The fee and the reviews then set the Muni at 5 shifts at 4P and 4 at 2P and solo, as today.
- "24 deck orders": the bot fills 13 a shift. Humans fill about 8–10 (one order every 30 s, one cook), so 2–3 shifts.
- "30 hot dogs": a dog cook makes 34 a shift (N2), so about 1–2 shifts once a crew cooks them for FED.
- The other counts are sized at 2–3 shifts of normal play. G judged them, because the bot never aims, laps or dives
  for treasure. Q wants them re-measured in the playtest (§4).
- **The pace is unchanged by construction:** "Hit the daily target 3×" is today's three stamps, and every other goal
  is sized to land by venue day 3 at 4P.

**The UI.**
- **The Board.** A goal strip replaces the BALLS OUTSTANDING line's left half:
  - **five pips** (filled when done);
  - **"3 OF 5 GOALS"**;
  - the next open goal with its count: **"NEXT: 18 MORE HOT DOGS"**. "Next" is the first open goal in card order,
    except that the fee only shows when it's the last one left.
  - BALLS OUTSTANDING keeps the right half.
  - At the Orbital the strip reads "THE LAST BUCKET 2 OF 4".
- **The report.** "REVIEW STAMPS" and the promo panel's "3 stamps. $895 short." headline (`promopanel.js`) become **the
  card**:
  - five rows, each with a tick or a count ("Serve 30 hot dogs · 18 / 30") and its reward;
  - today's newly done goals highlighted;
  - the headline: **"3 of 5 done · 2 to go"** (Club and up), or **"Card done! Sign for Tiered."**;
  - Sign appears only when all 5 are done (same buttons, same focus rule as owner-playtest-3 §7.3).
- **The pause menu** gets a **Goals** panel with the same five rows, so the card can be read mid-shift on a pad.
- **When a goal completes**: one TOAST, **"Goal done! 30 hot dogs. +$1,450"** (6 words), plus a ping and the Board's pip
  filling.
  - If two complete in the same tick, the second waits its turn (the existing say() queue).
  - The fee goal ticking says nothing (the strip shows it).
- **The tomorrow line** (`tomorrowText`): **"Tomorrow: two goals left for Tiered."** (6 words), or **"Tomorrow: sign at
  the bell for Tiered."** when 5/5. "three review stamps plus the fee" is gone.
- **The morning deal** (`morning.js`) adds the card to its pool. When a feature goal is open, one Rat can be dealt
  **"Goal: 12 more hot dogs."** (4 words), nearest goal first, below the venue's own short jobs. It is never dealt over
  the checklist (day 1).
- **The memo** is unchanged ("Today: 60% clean by the bell.").

**Save migration** (save v5):
- `stamps` becomes `reviews`, the venue's APPROVED count. The quota curve's `stamps < PROMO_STAMPS` reads `reviews < 3`,
  so the target still climbs with good days, as today.
- `PROMO_STAMPS` is deleted. `this.goals = { venue, scale, n: { id: count }, done: [ids] }` is saved.
- A v4 save is migrated to the card for its current venue:
  - the review goal's count is `min(N, stamps)`;
  - purchase goals tick if the row is already owned (washer, gutters, second cart, drones, tether);
  - the count goals start at 0;
  - Gary and treasure goals start open;
  - **a v4 save with `stamps ≥ 3` is grandfathered**: its card is marked done (except the live fee), so nobody loses a
    promotion they'd already earned.
- The ending's "quotas" line reads total reviews.

**Counters** (`crew.mjs`, one call at each existing site, `goalTick(id, n)`):
- `bank` counts balls banked;
- `buy` counts purchases;
- `endShift` counts reviews;
- the verdict counts Gary's huddle, pass and Seal;
- `serve` counts hot dogs (not burnt; Gary's dog counts);
- `bankTreasure` counts treasures;
- `tiered.onRest` counts TARGETs;
- `deck.serve` counts orders (filled and round);
- the stadium lap event counts laps;
- `ping` counts pings;
- a County stray banked counts sweeps;
- an Orbital debris landed counts debris;
- the Lift ride counts riders.

The pure card lives in **`web/js/goals.js`**: `CARDS`, `crewScale`, `goalLine`, `nextGoal`, `rewardFor`, `migrateV4`,
`cardDone`.

**Conflicts.**
- **Gary's Seal and commendations** are unchanged. The Club's Seal goal is one more reason to huddle.
- **The Closing Bell's crossing flash** is unchanged.
- **"PROMOTION READY"** in the HUD line becomes "CARD DONE".
- **One text:** the only new centre line is the goal toast, and goals complete at most 4 times a venue.

### 1 · Food: one food, one payoff, printed in money — **Adapt** (→ #2)

G: "The owner asked what each food *does*. The answer has to fit on the menu card."

| Food | What it does (the one effect) | The number | Where you see it |
| --- | --- | --- | --- |
| **Fries** | **Raise what every ball pays**: the fryer is one of the Upkeep gauges, as today | A full fryer is +50% of the Rate. At the Club that's **+$9.40 a ball**, and each basket is +$0.47 | The menu card: **"FRIES · +$1.41 A BALL"** (the live value of a 3-basket serve). A green **"+$1.41 a ball"** float over the shed on serve. The Board gauge is renamed **FRIES 14/20**. A carton on each fed bay's bench |
| **Hot dogs** | **FED: every ball the crew banks pays more, for a while** | Good +5%, perfect +10%, up to **×1.25**, wearing off 5% every 20 s. A separate factor like Gary's Seal: past the Hustle cap, and Upkeep never sees it | The menu card: **"HOT DOG · +5% EVERY BALL"**. An orange **"×1.20 FED"** chip on the Board under Hustle, with a thin ring that empties toward the next 5% loss. The HUD line gains "· ×1.2 fed". A **"+5% a ball"** float over the shed. The report row "Hot dogs: +$8,300" |
| **Beer** (Tiered on) | **Cash now: the bar tab**, unchanged (5 / 10 / 25 × BV) | +30% of a Tiered shift for a careful cook (N2) | The menu card: **"BEER · $2,900 TAB"** (an open order's live value). The tab float now rises **over the lounger when the mug arrives** (item 2), not as a toast to the cook |

**Rule changes** (E):
- **Customers eat a basket every 8 swings at the Club and up** (`eatEvery` 5 → 8). This is the Muni's own default,
  which was never used because the Muni has no kitchen.
  - A hand cook with the peeler now holds the fryer at 83%: +27% income, not +5% (N1).
  - The conveyor still fills it on its own. So the kitchen has three stages: fries by hand, then (with the conveyor)
    dogs for FED, then beer at Tiered. The cook always has a real job, and each stage is visibly worth a Rat.
- **A hot dog no longer adds fry baskets** (`FRIES_YIELD.hotdog` → 0 / 0). One item, one effect. It keeps its other
  jobs:
  - Gary's kitchen pass (his dog gives no FED: Gary ate it);
  - −2 deck drinks.
- Gary's kitchen check (`fries ≥ 50%`, or he had a dog) is unchanged.
- **FED constants** (`sim.js`): `FED = { GOOD: 0.05, PERFECT: 0.10, MAX: 1.25, DECAY: 0.05, EVERY: 20 }`.
  - The decay clock runs on working time only.
  - It resets each morning.
  - The cleanup minute counts, so a crew can bank its last pockets FED.
  - `stats.fedCash` is the report row.
- **The shed's blurb** loses "Fry Satisfaction (Upkeep up to +50%)" and reads "Reopens the shed. Fries raise what every
  ball pays."

**Food in the Club's dusk** (B's top idea: a Club Last Call with its own job).
- From 1:30 customers swing ×3, so they eat ×3, and the fryer drains fast just as the review approaches.
- The rally (`rally.js`) at the Club now **always deals jobs**, never "On target. Hold it till the bell." to everyone:

  | Line | Dealt when |
  | --- | --- |
  | **"Fries for the bell!"** (4 words) | The fryer is under 50% |
  | **"Glow in the creek! Dive!"** (5 words, item 4) | 5+ glow balls are snagged in the creek |
  | **"Grab the last balls!"** | 30+ balls are left |
  | The hose line | A fixture is short |

- After 1:00 nobody eats, so a fryer filled in the cleanup minute counts at the bell.

**Why not the other options.**
- "A fed customer hits a bigger bucket": more balls is only money if someone picks (N3), so the cook's work would pay
  through somebody else, invisibly.
- "Fries keep customers longer": same problem, and it fights the basket.
- Hot dogs as Hustle: Hustle is capped at ×2 and already filled by pings and TARGETs, so a dog would often add nothing.
  A separate FED factor always shows.

**Conflicts.**
- The Seal and FED stack: up to 1.25 × 1.25 on a sealed day. E: "fine. Both are earned, and both reset at night."
- Teenagers, drones and the night crew bank at FED too: it's "every ball". The cart does too.
- No new centre text: the floats are world text, the chip is the Board, the HUD line is the edge.

### 2 · The deck you can see: drinkers are golfers, mugs, the beer line — **Adopt** (→ #3)

(Built together with item 3, the upper bays: the people drinking on the deck are the upper bays' customers.)

- **Who drinks.** The deck's four loungers become the **six upper-bay customers** (item 3), at x −10, −6, −2, 2, 6 and
  10. `DECK.SEATS` grows to 6. They swing, and they drink between swings.
- **Mugs per drinker.**
  - The deck keeps its one Drinks count: 0–6, the incident at 6, sobering, orders, rounds and the escalating fine all
    unchanged and tuned by rounds 6–8.
  - It is **split across the seats** (`d.mugs[6]`, summing to `drinks`):
    - an ordered beer goes to the seat that ordered;
    - an unordered beer goes to the **drunkest** seat ("they always want another");
    - food and sobering come off the drunkest seat;
    - **on an incident the drunkest seat falls** (ties go round robin from the last faller), and their mugs leave with
      them.
  - So the crew can see who's next: "the one in pink has three".
- **What you see per seat:**
  - **empty steins on their bay's ledge** (0.3 m, readable from the return), one per mug;
  - **a sway** of amplitude 0.2 rad × min(1, mugs / 3);
  - at 3+ mugs, a hiccup bubble every 4 s;
  - their swing **sprays wider**: aim spread × (1 + 0.15 × mugs), so a drunk bay's balls go into the creek and the
    nets. That is a visible, cheap, slightly funny cost.
  - The kitchen's six-mug meter and its captions ("The deck is getting loud", "CUT THEM OFF") are unchanged.
- **Where each beer goes: the beer line.**
  - A cable runs from the shed's roof (42, 3.6, 6) to the deck's right end (20, 4.6, 3.4).
  - On every paying beer, a mug **zips up the line in 1.5 s**, then **slides along the rail** to its seat at 20 m/s,
    and lands on their ledge.
  - The tab float rises there: **"+$2,900 tab"** (world text, everyone sees it, gold for an order, red-gold for a
    round).
  - The cook sees the mug leave the window on the kitchen card as today.
  - The tab is paid on serve (server). The flight is the view's own 1.5–3 s animation, so there's no extra traffic.
- **Q:**
  - `fallPose`, `climbPath` and `landingSpot` read `DECK.SEATS`. Six seats move every deck golden: re-record with one
    cause.
  - The stale comment on `stats.beers` ("overserving, later") goes.

### 2b · When someone falls: the Deck Cam — **Adopt** (→ #4)

- **What plays.** On `deckFall`, each client cuts its own camera for **2.6 s** (**1.8 s** for a shift's 2nd and later
  falls):
  - the shot is fixed, from (x + 3.5, 1.4, −2.5) looking at (x, 2.2, 1.8): up at the rail, from the mat line;
  - the lean plays at ×1, then **the drop plays at ×0.4**;
  - it cuts back on the BONK.
  - Letterbox bars (DOM, 8% top and bottom) and the edge label **"DECK CAM · Ⓑ skip"** (bottom-left, not centre).
  - No render-to-texture: it is the main camera, moved, then put back exactly.
- **Who gets it.** Everyone **except** a Rat who is:
  - driving;
  - diving;
  - riding the Lift or in the EVA;
  - in the kitchen overlay (the cook gets the 1.8 s version after they close it, if within 5 s);
  - in a menu;
  - already knocked down.
  - A setting **"Deck replays: on / off"** (default on).
- **Control.**
  - Any button, or a stick past 0.5, skips at once.
  - During the cut your movement input is ignored, so you stand still.
- **The world pauses with you** (server, `deck.mjs`). For 3 s after a `deckFall`:
  - Rats on foot are **immune to ball hits** ("everyone stops to look");
  - every customer's next swing is pushed back 3 s, and they turn to the deck.
  - That is ~5 balls of supply, and nobody gets floored blind.
- **One text.** The once-ever PA card waits for the cut, as the memo waits for the PA.
- **Xbox.** Zero new draw calls.
- **C:** "two and a half seconds of a man falling off a building in slow motion is the best thing in this game". **M:**
  "and nobody loses control for longer than a knockdown".

### 3 · Tiered: more bays, top and bottom — **Adopt, six upper bays** (→ #3)

- **The rule.**
  - The Upper Deck's **6 middle bays** (above mats 2–7, x −10…10) seat customers who hit from y 3.1, at the deck's
    front edge (L places the tee clear of the low rail).
  - They use the same `stepMat` customer, the same swing gap, the same Last Call ×3 and the same cleanup minute.
  - They walk up the stairs from x −27.5 and leave the same way.
  - Upper bays are active from Tiered on (it's the same building at every later venue).
  - Crew size: **`activeUpper(N) = min(6, 2 × N)`**, so solo 2, 2P 4, 3P+ 6. "Open every bay" opens all 6.
- **What they don't do:**
  - no mats to scuff, so they're not fixtures and not in Upkeep;
  - **no lead balls** (N4: the pond can't take it);
  - **no basket**: the bar sells them their buckets, so the morning basket job is unchanged.
- **The economy** (N3): +60% balls, **+41–48% income** from Tiered on, for a crew that picks. `MAX_BALLS` 800 still
  caps an idle field.
- **Bay Utilization** (N4): **`CUP_FULL` = 30 + 2 × upper bays in play**: 42 at 4P, 38 at 2P, 34 solo.
  - Measured 40 and 48 behave the same, and 30 is too hard.
  - The Glow Rush keeps its shape: cups ×2 for glow, judged at 1:00. A TARGET at 1:05 passes 6/6. A TARGET after 1:00
    doesn't count.
  - `aim.js`'s red cup warning reads the same formula.
- **The late fees rise ×1.5** so "Save the fee" stays a two-shift goal with the bigger income (N7): Stadium $400k →
  **$600k**, County $2M → **$3M**, Orbital $10M → **$15M** base.
  - The Tiered fee (paid from Club money) is unchanged.
  - `goals.mjs w 1.5`: the fee lands on venue day 2 at every crew size, as today.
- **Conflicts.**
  - The deck's falls land at z 1.0, among the mat line's customers: unchanged, and now from 6 seats.
  - Gary's mats stop reads lower mats only.
  - The County slice applies to upper shots too (`launchMod`).
  - The Orbital's 5% orbit shots: upper bays never orbit (keeps the debris tuned).
  - E: re-check the endless prices with +45% late income in playtest; the council left them alone.

### 4 · Scuba in Dimple Creek — **Adopt, the whole creek, as a lazy river** (→ #5)

The owner wants to scuba "through the river". G: "Ride it." From the Club, the creek's running water is divable end to
end.

- **Going under.**
  - Walk into the creek water (off the bridges) and stay in it for **2 s**, and you duck under. A quick crossing (the
    creek is 3.2 m wide) never dunks you.
  - Any dive tier works: everyone has the mask from the Club.
  - Walk out of the channel sideways to surface.
- **The current.**
  - Under, you drift downstream at **0.8 m/s** on top of your swim. The bed is slower than the 1.5 m/s surface the
    balls ride.
  - The mask and the tank (swim 0.6–0.7) can't beat it upstream. The scooter (1.3) can, slowly.
  - So you **enter upstream and float down**, grabbing as you go.
  - The in-branch carries you **into the pond**, and the dive carries on there, a 40 s ride from the left net to the
    Delta.
  - The out-branch holds you at the Grate's net until you climb out.
  - You float under the Plank, the Cart Bridge and the Stones.
- **Air.**
  - Shallow, so the snorkel breaks the surface: air drains at **×0.5** in the creek. The mask lasts 40 s.
  - There is no pump in the creek (it's at the pond's dock).
  - Out of air, you pop up on the nearest bank, and your bag spills back onto the creekbed there.
- **Collectables: snags.**
  - From the Club, **a drifting ball snags on the creekbed** at a point fixed by its id: `s* = s0 + hash(id) × (end −
    s0)`, so server and client agree with no new traffic.
  - Which balls snag:
    - **1 in 3 range balls**;
    - **every gold ball** ("it's heavy");
    - **every glow ball** ("it sinks and glows"). That's ~21 a Club shift at dusk, the Club's dusk dive job (item 1),
      worth ×2.
  - That is ~45 snags a Club shift at 4P (N5). It also cuts the pond's creek inflow by a third, which offsets the upper
    bays' extra supply at the Delta.
  - Snagged balls rest at `BED` −0.95 within the channel. They can only be picked by a diver, and they show the
    torch-cone glint like sunk gold.
  - They aren't saved: "the night crew rakes the creek".
  - `driftAt` gains the end kind `'snag'`. A snagged ball is `b.creek = true`: not `sunk` (so Pond Clarity never counts
    it), never cupped (`tiered.onRest` skips it), never picked by a cart, teenager or drone.
- **The treasure.** The Club card's second treasure lies **under the Cart Bridge** (18, −99), on the creekbed.
- **The camera, the air and the boil all work there:**
  - `main.js`: `under = wetPond(me) || creekDiving(me)`;
  - the eye sits at `BED + 0.55`;
  - fog far 9 m (the pond's), tinted from `waterLook(1)` (the creek runs clear teal, against the murky pond);
  - the boil (`scubafollow.boilBubble`) and the low-air vignette are unchanged.
  - The send-bag line stays a pond thing: in the creek the bank is 2 m away.
- **Xbox.**
  - The creek gets a trench: a bed ribbon plus two wall ribbons from y 0 to −0.95, built once with `terrain.js`'s
    `ribbon()` helper and merged into **one mesh (+1 draw call)**.
  - From below, the ground plane is back-face culled, so the walls, the bed and the water ribbon (made DoubleSide)
    enclose the view. From above, nothing changes.
  - There are no caustics in the creek: the bed takes the flow texture, scrolled.
  - The 9 m fog keeps the frame cheap. `?perf` p95 ≤ 20 ms on Edge while floating.
- **Words.**
  - The first-time tip at the Club (`settings.js`): **"The creek is divable now. Float downstream."** (7 words).
  - The snag glint has no text.
  - The feed line on a gasp is the pond's.
- **Only from the Club**, when the water runs. At the Muni the creek is dry gravel, as today.

### 5 · More to do from the Club to Tiered — **Adopt the card and the dusk jobs; nothing else new** (→ #1, #2, #5)

The council's reading of "boring":
- three Club shifts of "On target. Hold it till the bell";
- a kitchen that can't win;
- a pond that's the only water.

The fixes are already above:
- the **goal card** gives each Club day a named purpose (dogs, two treasures, the Seal);
- **food that pays** gives the cook a job worth a Rat at every stage;
- **the Club's dusk deals real jobs** (fries for the bell, glow in the creek, the last balls);
- **the creek** is a second, different dive.

G declined to add a sixth system. M checked the split: a 4P Club now naturally runs a picker or driver, a cook, a diver
and a hoser, and each one's work shows on the Board.

### B · Dirt you can see on the sign and the ball return — **Adopt** (→ #7)

- `mud.js`'s overlay (the density and noise field, the patch-wise wash-off, the per-surface clean memory) gets a
  **surface variant**: `mudSurface(w, h)` takes the field's UV for a w × h quad.
- Decals:
  - **the sign**: one decal quad on each face;
  - **the return**: the front face, the hopper lip and the pipe's lower half, as one merged decal mesh.
- They use the same shader as the mats (`uMud` = `fixtures.sign` / `fixtures.stand`). The clean memory uploads only
  while someone sprays that fixture.
- +2 draw calls, only at the yard.
- The Board's pips already name them. Now the world agrees.

### C · A second ball return in the field — **Adopt, Muni day 3; a third at the Club** (→ #7)

- **The Field return** (crew row, `minDay: 3`, **$150 base**, $330 at 4P).
  - It's at **(10, −62)**, between Red and Yellow, north of both creek branches. It clears Bowl A (19.8 m), Bowl B
    (21 m), the pond (27 m), the Track and every MOW-E lane.
  - It reuses the pond tube's red FHI box look, taller, with a "RETURN 2" sign.
  - A Rat on foot presses **Ⓧ** (the bank button) to send their pocket. The balls THUNK into the main return **6 s**
    later (`tubeFeed`, at the Rat's gear factor) and go through the washer like any bank.
  - Halves the walk: 100 → 41 m (N6).
  - Blurb: "A second return by the Yellow flag. Its pipe runs home. THUNK."
  - Prompt: **"Ⓧ send them home"** (3 words).
- **The Back return** (the same row's tier 2, Club, **$1,500 base**). It's at (−6, −128) by Blue: 48 → 30 m.
- **Not a fourth.** Late venues pick by cart and drone (item D gives the drones a reason to use them).
- **Who uses them.**
  - Rats on foot and **drones** (item D) use them.
  - **The cart doesn't**: it unloads at the main return, so its trips still pass the crew bays.
  - **Teenagers don't**: "Teenagers don't trust the pipe." That keeps the Muni pace the ladder measured. E would
    otherwise expect +60% teenager throughput and a Muni shift lost.
- **Effort** S, `layout.js`, `ballreturn.js`, `sim.js` row, `crew.mjs` `feedTube` generalised to any return.

### D · Late automation that changes the shift — **Adapt: two you play with, and the truck** (→ #8)

C's finding: the second cart, the drones and the tether add little. The council wants automation you *play with*.

1. **Autopilot** (Stadium; the cart row's tier 4 after "A second cart", **$250k base**).
   - An undriven cart drives the Ping Track by itself. Its laps count at half (+0.03 crowd).
   - Crew bays can ping it, so **one Rat at a bay is the Stadium show**: the crowd gets +0.08 a ping, and every ping
     prize works.
   - Hold Ⓨ at the parked cart to switch it to "Harvest": lanes up and down the open field, scooping like a driver at
     ×0.6.
   - The second cart and Hit the Cart, both under-used, become the Stadium's core.
2. **Drone dispatch** (County, free with the drones).
   - On foot, **hold Ⓨ: "Drones, here!"** That pins a 20 m zone for 30 s, and every drone clears it first.
   - Drones now bank at the **nearest** return (item C), so a field return is a late asset.
   - One Rat "spots" in the Yards, and the swarm follows them.
3. **The power-washing truck** (Stadium, $300k): already specified in owner-playtest-3 §5.1. The council moves it into
   this round's build. Hosing becomes driving.

The tether is left alone (it's the Orbital card's purchase goal).

Measured: nothing here. The bot can't play these. E estimates that each frees one Rat's shift, which is 15–25% of
income. The playtest checks (§4).

### F · One flag per green, and what the greens mean before Tiered — **Adopt: "on the green" from the Muni** (→ #6)

- **One flag per green, always.**
  - From Tiered, the landmark flag **becomes** the target pin:
    - `views/tiered.js` puts its pin at the green's centre (b.x, b.z), which is where the landmark flag stands and
      where the cup is;
    - it keeps the bowl's colour, the cup-count flag and the light pillar;
    - `terrain.js` hides its own pole, pennant and disc there.
  - The cup's balls scatter around the pole's base as in real golf.
  - A test pins exactly one pole per green at every venue.
  - `flagNormal` still faces the flag to both crew bays. Any flag text keeps `signs.js`'s facing rows correct (the
    test is extended).
- **The greens get a light purpose from day 1: "on the green".**
  - A **crew** ball (from a crew bay) that comes to rest on a green (inside the bowl's `r`, the same `MAP.BOWLS`
    geometry) at the Muni or the Club: **"ON THE GREEN!"** (world float over the flag), the pennant waves, and
    **Hustle +0.1**.
  - It shares the cap. It counts **5 times a shift**, so it can't be farmed.
  - It's the same verb as Tiered's TARGET, promoted: at Tiered the green has a cup, and a crew ball there is a TARGET
    (+0.25, and it flushes the cups).
  - The ball itself is ordinary: someone still picks it up.
  - **The landing marker** (`aim.js`, 10 Hz, 1 draw call) shows at crew bays from the Muni, so the crew learns to aim
    early.
  - The first-time tip: **"Land a crew ball on a green: Hustle."** (8 words).
- **Why not just make them obvious landmarks.** C: "a flag that does nothing for 15 shifts, then suddenly matters,
  is the confusion the owner described". G: a light rule turns Tiered's greens into a promotion of something known.
  6–1 (L wanted landmarks only, to keep the Muni simple).

---

## 2. Build this (ranked)

Ranked by fun per effort for a casual crew of 4, with the owner's biggest note first.
- Sizes: **XS** < 1 hour · **S** an evening · **M** two evenings.
- **Core** = edits `crew.mjs`, `main.js` or `sim.js`.
- Every item adds its tests to `node --test test/`, runs `make preflight` (WSL), and updates `game-design.md` in the
  same commit.

| # | Item | Size | Behaviour and numbers | Files | Tests |
| --- | --- | --- | --- | --- | --- |
| **1** | **The goal card** (A) | M, core | §1 A: five goals per venue (the Orbital four), all needed; rewards of 50 × BV; counts × crew scale (solo 0.4 … 6P 1.4), printed on the venue's first morning; "Hit the daily target 2× / 3×"; the live fee goal; the forced treasure; Gary back tomorrow; the Board strip, report card, pause panel, toast, tomorrow and morning-deal lines; save v5 with the grandfathering migration | new `web/js/goals.js` (pure); `server/crew.mjs` (`goalTick` at each site, `promoInfo.ready = cardDone`, the save, `reviews`, `tomorrowText`, `rollTreasureToday`, the Gary schedule); `web/js/board.js`, `bvtext.js`; `web/js/round2.js`, `promopanel.js`; `main.js` (the pause panel); `web/js/morning.js`, `server/venues/nudge.mjs`; `sim.js` (`PROMO_STAMPS` deleted) | `test/goals.test.mjs` (new): every card has 5 goals (Orbital 4) with the fee last; scale rounding; `nextGoal`; `cardDone`; a v4 save with 3 stamps is grandfathered; with 1 stamp the review count is 1 and owned rows tick. `test/crew.test.mjs`: Sign is refused until 5/5; a hot dog, a TARGET, a lap and a treasure each tick their goal once; the reward is paid once; the forced treasure sinks every morning while open; Gary returns the next day after a failed Seal. `test/words.test.mjs`: the toast, tomorrow and deal lines. `test/seam.test.mjs`: re-record (cause: the forced treasure's RNG draw) |
| **2** | **Food that pays, and says so** (item 1) | S, core-light | `eatEvery` 8 from the Club; hot dogs → FED (+0.05 / +0.10, ×1.25 cap, −0.05 per 20 s, a separate factor, reset each morning), with no fry baskets; menu cards print the live payoff; the "+$1.41 a ball" and "+5% a ball" floats; the ×FED chip; FRIES 14/20; the fed-bay cartons (one InstancedMesh, 10 slots); the report row; the Club dusk deals | `sim.js` (`FED`, `VENUE_RULES[1–5].eatEvery`, the shed blurb); `menu.js` (`FRIES_YIELD.hotdog`); `crew.mjs` (`serve`, `this.fed`, `valueNow` × fed, `stats.fedCash`); `kitchen.js` (cards); `board.js` / `bvtext.js` (chip, label); `rally.js` (the Club's dusk deal); `props.js` (cartons) | `test/food.test.mjs` (new): a dog lifts FED by 0.05 / 0.10, it caps at 1.25 and decays 0.05 per 20 s of working time; Gary's dog gives no FED; a dog adds 0 baskets; `payFor` × fed; Upkeep is unchanged by FED. `test/rally.test.mjs`: the Club deals jobs at T−90 when on target. Re-run `food.mjs` on the real rule: within ±3% of N2 |
| **3** | **Tiered: six upper bays, and the deck you can see** (items 2 and 3) | M, core | `activeUpper(N) = min(6, 2N)`; upper customers hit from y 3.1, with no lead, no basket and no scuff; `CUP_FULL` = 30 + 2 × upper; `DECK.SEATS` = the 6 upper bays; `d.mugs[6]`; the drunkest falls; steins on the ledges; sway; wider drunk spray (× (1 + 0.15 × mugs)); the beer line (1.5 s zip, rail slide) with the tab float over the seat; late fees ×1.5 | `customers.js` (upper mats, the stairs route); `crew.mjs` (the customer loop over upper mats); `tiered.js` (`cupFull(upper)`), `server/venues/tiered.mjs`; `deck.js`, `server/venues/deck.mjs`, `views/deck.js`; `venues.js` (tees, ledges, the cable); `sim.js` (fees, `activeUpper`) | `test/tiered.test.mjs`: `CUP_FULL` 42 at 4P, 34 solo; an upper shot never cups as lead. `test/deck.test.mjs`: mugs sum to drinks; an order goes to its seat; an unordered beer to the drunkest; the incident fells the drunkest; re-record the goldens. `test/customers.test.mjs`: upper bays seat 2/4/6. Re-run `upper.mjs` and the ladder with the real rule: Tiered 3 shifts at 4P, 4–5 at 2P; Glow Rush T−65 6/6 |
| **4** | **The Deck Cam** (item 2b) | S | 2.6 s (1.8 s later) camera cut on `deckFall`, slow drop ×0.4, letterbox, "DECK CAM · Ⓑ skip", any input skips; who's excluded; the setting; server: 3 s of ball immunity on foot and a 3 s customer pause; the PA waits | `main.js` (the cut, input gate); `views/deck.js` (the slow-motion fall, the cut's look-at point via `ctx`); `server/venues/deck.mjs` (immunity, pause); `settings.js` (the toggle) | `test/deck.test.mjs`: no knockdown for 3 s after a fall; customers' next swing +3 s. `test/deckcam.test.mjs` (new, pure `cutPlan(e, me, k)`): the length by k, exclusions (driving, diving, kitchen, down), skip on input |
| **5** | **Scuba in Dimple Creek** (item 4) | M, core | Duck under after 2 s in creek water; 0.8 m/s current; air ×0.5; in-branch into the pond, out-branch held at the Grate; snags (1 in 3 range, every gold and glow) at `s*` from the id hash; `b.creek`; the treasure under the Bridge; the trench mesh; the dive camera, fog, boil | `map.js` (`creekCurrent`, `SNAG`, `driftAt` 'snag', `inCreekWater`); `dive.js` (`CREEK_DIVE` constants, `creekAirMult`); `crew.mjs` (`stepPond` → `stepDive` for pond and creek, `pondPickup` for snags, gasp to the bank, the forced creek treasure); `terrain.js` (the trench); `scuba.js` (the creek tint and fog); `main.js` (camera, current on your own movement) | `test/map.test.mjs`: a snag point is deterministic and inside the branch; a gold ball always snags. `test/scuba.test.mjs`: 2 s in the water dives you, 1.5 s doesn't; air drains ×0.5; the current carries a still diver 0.8 m/s downstream; a snag is pickable underwater only; a snag is not `sunk` (Pond Clarity unchanged). `test/seam.test.mjs`: the Club golden moves (cause: snags); put `SNAG` to 0 and the old fingerprint comes out. Re-run `creek.mjs`: ~45 snags a Club shift |
| **6** | **One flag per green; "on the green"** (F) | S | The pin at the green's centre, the terrain flag hidden from Tiered; "ON THE GREEN!" +0.1 Hustle (5 a shift) at the Muni and the Club; the landing marker at every venue's crew bays; the tip | `views/tiered.js`, `terrain.js` (hide hook), new `server/venues/greens.mjs` (venues 0–1, `onRest`), `aim.js`, `settings.js` | `test/greens.test.mjs` (new): a crew ball on a green adds 0.1, never a customer's, at most 5 a shift, never at Tiered (TARGET instead). `test/signs.test.mjs`: one pole per green at every venue, the flag faces the bays |
| **7** | **The yard pack: the field returns and visible dirt** (C, B) | S each | The Field return (10, −62), Muni day 3, $150 base; the Back return (−6, −128), Club, $1,500; Ⓧ sends your pocket home in 6 s; teenagers and the cart don't use them, drones do. `mud.js`'s surface variant on the sign and the return | `layout.js`, `ballreturn.js`, `sim.js` (the row), `crew.mjs` (`feedTube` → any return); `mud.js`, `props.js` | `test/layout.test.mjs`: the returns clear the bowls, pond, track and lanes. `test/crew.test.mjs`: a pocket fed at the field return banks 6 s later through the washer; a teenager never feeds it. `test/mud.test.mjs`: the surface UVs; the sign washes in patches |
| **8** | **Late automation: Autopilot, drone dispatch, the truck** (D) | M | §1 D | `crew.mjs` (an undriven cart's drive and harvest), `server/venues/stadium.mjs` (half laps), `county.js` / `server/venues/county.mjs` (the zone), `main.js` (Ⓨ), `sim.js` (rows), `washer.js` / new `views/truck.js` | `test/stadium.test.mjs`: an autopilot lap counts +0.03; a crew ping on it pays the prize. `test/county.test.mjs`: drones clear the zone first and bank at the nearest return |

**One text.**
- New centre text: the goal toast, and the Club's dusk deal lines, which are the existing dealt ALERT.
- Everything else goes elsewhere:
  - world text: the food floats, the tab over the seat, ON THE GREEN!, the glint;
  - the Board: the goal strip, the FED chip;
  - the edge: DECK CAM;
  - the nudge slot: the goal deal;
  - the bottom prompt.
- No item stacks a second centre element. The Deck Cam delays the PA card. It never overlaps it.

**Xbox draw calls added:**
- the fed-bay cartons (+1);
- the steins (+1, one InstancedMesh of 36);
- the beer-line mug (+1, pooled);
- the creek trench (+1);
- the sign and return dirt (+2, at the yard);
- the field returns (+1 merged).

That's about 7, none of them where the stadium crowd draws. The `?perf` p95 budget stays ≤ 20 ms on Edge.

**Votes:**
- G yes.
- E yes ("#1 holds the pace by keeping the three good days; #3's fees ×1.5 are measured; re-run the whole ladder after
  #1–#3 land").
- M yes (dissent recorded: 4 of 5 on the card).
- L yes (dissent recorded: greens as landmarks only).
- T yes ("#1, #3 and #5 are the core ones; merge them in order").
- C yes ("the card is the thing the owner needed; the Deck Cam is the thing we'll talk about").
- Q yes ("the v4 → v5 save migration and the six-seat deck goldens before merge").

**7–0 on the list; 5–2 on all-5-to-sign; 6–1 on "on the green".**

### Cut or rejected (so nobody re-litigates them)

- **"Fee + 2 reviews" cards**: −3 shifts at 4P (N7). The card keeps "Hit the daily target 3×" from the Club.
- **"4 of 5 to sign"**: the owner wants every feature seen, and every goal is guaranteed doable.
- **Owner's "Bring up 3 treasures"**: ~6 Club shifts on today's roll (N8). It became 2, with a forced roll.
- **Fed customers buying bigger buckets / staying longer**: more balls only pays if someone picks (N3). The cook's
  work would pay invisibly.
- **Hot dogs as Hustle**: Hustle is already capped by pings and TARGETs. FED is its own factor.
- **Per-lounger fall limits** (fall at 3 of your own mugs): it would retune the whole deck. The deck-wide count stays,
  split per seat for the eye.
- **Picture-in-picture replays**: render-to-texture (Xbox). The Deck Cam moves the main camera.
- **Ten upper bays**: +100% supply and harder cups. Six balance it. `activeUpper` can grow later.
- **Creek pools only** (three deep spots): the owner asked to dive "through the river". The whole creek, as a ride.
- **A pump in the creek**: shallow water, a snorkel, ×0.5 air. The pump stays the pond's.
- **Teenagers at the field return**: +60% teenager throughput loses a Muni shift of pace. "Teenagers don't trust the
  pipe."
- **A vacuum on the field return**: only ~6% of balls rest within 10 m of it (`return2.mjs`). It would be a magnet for
  nothing.

**Left alone on purpose:**
- the quota curves (now read through `reviews`), `QUOTA_KPI`, the 15% APPROVED bonus;
- the Tiered fee, every Muni and Club price;
- the deck's fines, sobering and orders;
- Gary's visit time and the Seal;
- the tether, the endless prices, hard hats.

---

## 3. Who builds what

Four builders.
- File ownership: only the owner of a file edits it. Anyone else hands their lines to the owner.
- `server/crew.mjs` is taken in locks, in the order below.
- Every builder adds their tests, runs `make preflight` in WSL, and updates `game-design.md` in the same commit.

| Builder | Items, in order | Owns (only they edit) | Hands to another owner |
| --- | --- | --- | --- |
| **1 · The goal card and the Board** | #1, then the Board halves of #2 (FED chip, FRIES label) | new `web/js/goals.js`, `web/js/board.js`, `web/js/bvtext.js`, `web/js/round2.js`, `web/js/promopanel.js`, `web/js/morning.js`, `server/venues/nudge.mjs`; **`crew.mjs` third lock** (`goalTick` sites, `promoInfo`, `reviews`, the save v5, `tomorrowText`, the forced treasure, Gary's revisit) | the pause-menu Goals panel → builder 4 (`main.js`); deleting `PROMO_STAMPS` → builder 3 (`sim.js`) |
| **2 · Tiered, the deck, the greens** | #3 → #4 (server and view halves) → #6 | `web/js/customers.js`, `web/js/tiered.js`, `server/venues/tiered.mjs`, `web/js/views/tiered.js`, `web/js/deck.js`, `server/venues/deck.mjs`, `web/js/views/deck.js`, `web/js/venues.js`, `web/js/aim.js`, new `server/venues/greens.mjs`; **`crew.mjs` first lock** (the customer loop over upper mats) | `activeUpper`, the late fees → builder 3 (`sim.js`); the Deck Cam's camera cut → builder 4 (`main.js`); hiding the terrain flag → builder 3 (`terrain.js`, a one-line hook) |
| **3 · Food, the creek and the shop** | sim.js constants first (XS commit: `FED`, `eatEvery`, `activeUpper`, the fees, the return rows, `CREEK_DIVE`), then #2 (rules) → #5 | **`web/js/sim.js`** (sole owner), `web/js/menu.js`, `web/js/kitchen.js`, `web/js/map.js`, `web/js/dive.js`, `web/js/scuba.js`, `web/js/scubafollow.js`, `web/js/terrain.js`, `web/js/rally.js`, `web/js/settings.js`; **`crew.mjs` second lock** (`serve`, FED, `stepDive`, snags, the creek gasp) | the creek camera and current on your own movement → builder 4; the menu payoffs' live values come from `bvtext.js` → builder 1 |
| **4 · The yard, the camera and late automation** | #7 → the client half of #4 → #8 | **`web/js/main.js`** (sole owner: the Deck Cam cut, the creek camera, the current, the pause Goals panel, Ⓧ at the field return, Ⓨ dispatch), `web/js/mud.js`, `web/js/props.js`, `web/js/layout.js`, `web/js/ballreturn.js`, `web/js/county.js`, `server/venues/county.mjs`, `server/venues/stadium.mjs`, `web/js/washer.js`, new `web/js/views/truck.js`; **`crew.mjs` fourth lock** (`feedTube` → any return, the autopilot cart) | the field-return and autopilot rows → builder 3 |

**Order of merge.**
1. Builder 3's `sim.js` constants (XS), so every other builder imports real names.
2. In parallel, with no shared files: builder 2's #3 (`crew.mjs` first), builder 4's #7 (leaf files), and builder 1's
   `goals.js` plus the Board strip (leaf files).
3. Builder 3's #2 and #5 (`crew.mjs` second).
4. Builder 1's #1 server half (`crew.mjs` third). It needs every counter site to exist: TARGETs, orders, laps,
   treasures and dogs.
5. Builder 2's #4 and #6, then builder 4's #4 client half and #8 (`crew.mjs` fourth).

**Done lines.**
- Builder 1: the 4P ladder bot with the card (port `goals.mjs` into the bot as the promotion rule) reaches the
  Orbital within ±1 shift of today's 127 min. The v4 grandfather test is green.
- Builder 2: `upper.mjs` and the ladder on the real rule give Tiered 3 shifts at 4P and ≤ 5 at 2P.
- Builder 3: `food.mjs` within ±3% of N2. `creek.mjs` gives 40–50 snags a Club shift.
- Builder 4: the `?perf` p95 at the yard with both dirty fixtures, and while floating in the creek, each ≤ 20 ms on
  Edge (in the commit message).

---

## 4. What the next playtest checks

A real 4P night (two on Xbox pads in Edge) and one solo run, with `?pace` and `?perf` on. Goals: Fun ≥ 7.5 in the
Club/Tiered slice (playtester B's slice scored 7), Clarity ≥ 7.5, Pacing ≥ 7.

1. **The card (the owner's question).**
   - Ask after Muni day 2: "What do you need to do to reach the Club?" Goal: the crew names the card's goals, not
     "stamps".
   - Shifts per venue at 4P: 5 / 3 / 3 / 3 / 3, ±1.
   - Which goal finished last at each venue? If one feature goal is last every time, resize it.
   - Did anyone open the pause Goals panel?
   - Any old save that lost a promotion is a blocker.
2. **Food.**
   - Ask after Club day 1: "What does each food do?" Goal: three answers in money words.
   - The fryer's mean % with a hand cook (expect 70–85%).
   - FED's mean while someone cooks dogs (expect ×1.15–1.25).
   - Did the crew call out "dog's up"?
   - The report's "Hot dogs: +$X" against the cook's own sense of worth.
3. **The deck.**
   - Can a crewmate on the field say who's drunkest?
   - Did anyone watch a mug ride the beer line?
   - Deck Cam: skipped or watched, and did anyone get floored during or right after one (goal: 0)?
4. **Tiered.**
   - Balls a shift (expect ~1,600 at 4P), and income against N3.
   - The Glow Rush: when the last TARGET landed vs 1:00, and the pass rate (goal ≥ 80% for crews that shoot in the
     rush, and it can still fail).
5. **The creek.**
   - Did anyone ride the creek into the pond?
   - Snags picked per Club shift.
   - The glow dive at dusk.
   - The creek treasure found by Club day 3.
   - `?perf` while floating.
6. **The greens.** Count "ON THE GREEN!"s at the Muni. Does the crew aim at Tiered's greens on day 1 there without
   being told?
7. **The returns.**
   - When the Field return was bought, and pockets fed per shift at 1P and 4P.
   - Muni shifts to the Club (goal 4–5 at 4P, ≤ 6 solo, unchanged).
8. **Late automation.** Autopilot pings per Stadium shift, drone dispatches per County shift, and C's question: "does
   late automation change what you do?"
9. **One text.** Screenshots at a goal toast, the Club's 1:30 deal, a Deck Cam (with and without the PA card), and the
   morning deal with a goal line. Never more than one centre element.
10. **Regression.** `node --test test/` green, `make preflight` green in WSL, 60 minutes with no console errors.
