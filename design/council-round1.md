# Fun Council, round 1: Range Rats, Corporate and Ball Value

This is the record of Range Rat's first Fun Council (November 2026). It follows
the format of Golden Hour Golf's council: personas pitch, judges score, a tally
table, then a decision. None of golf's ideas carry over: no geese, no Old Tom,
no ghosts, no commentator, no named balls.

**What the owner set for this round (binding):**
- The loose story: the players are Range Rats, and Corporate pays per ball.
- Ball value replaces stars as the progression metric, alongside cash.
- Gear is personal.
- Power washing comes next.
- The agreed features need fitting into the story: diving, potatoes, mud,
  the ball types, voice lines, the venue ladder, three cameras, no roles, and
  multiplayer first.
- Then fill the gaps.

**The rule for agreed features:** an agreed feature can't be vetoed. The vote
only decides when it gets built. Gap-filling ideas can be vetoed.

---

## 1. The story bible

**The Range Rats.** They staff the range. They pick up, wash, refill, dive the
pond and peel the potatoes.
- HR calls them *Range Retrieval Associates*. Everyone else calls them Range
  Rats, and after the name tested well in a focus group, so does Corporate.
- Nobody is assigned anything. Corporate simply assumes it will get done.
  That is the no-roles pillar, written as policy.

**Corporate** is **Fairway Holdings International** (FHI), owner of every
driving range you have ever seen and several you haven't.
- It speaks only in memos from **the Office of Ball Value**.
- Every memo is stamped with the mascot, **Dimples**: a golf ball in a
  necktie, smiling, never quite making eye contact.
- The slogan is **"Every Ball Matters."™**
- Its only field presence is **Gary from Regional**, who arrives
  unannounced in a golf cart.
- Corporate is never cruel. It is sincerely, cheerfully absurd. The Rats
  never talk back; the game does it for them.

**Ball Value is the KPI.** Corporate pays the crew per ball banked at the
stand, and the rate per ball is the **Ball Value**, FHI's one true KPI.
- Corporate believes a ball is worth more when it comes from a spotless range
  with a clear pond and fries available, and when a clean Rat banks it.
- Corporate is right, in the sense that it pays more.
- Ball Value is on the Board above the bucket stand at all times. Everything
  the crew does besides picking up raises it.

**The venues are promotions.** FHI promotes crews that keep hitting quota.
Each promotion brings a new site, a higher base rate and usually a new KPI.
Titles change. The work doesn't.

| Venue | In the story | New KPI |
| --- | --- | --- |
| Muni Range | "Site 12." Probation. *Welcome to the family.* A shed, a pond, ten mats. | Curb Appeal, Pond Clarity, Fry Satisfaction (once the snack shed reopens) |
| Range Club | FHI acquires a country club. The members expect fries, so the shed becomes a kitchen. | none (the kitchen's automation ladder starts) |
| Tiered Entertainment Range | FHI discovers the word "experiential." | Bay Utilization |
| Stadium Range | The KPI is now on a jumbotron, so everyone can see it. | Crowd Sentiment |
| County Range | FHI acquires the county. Zoning is a KPI now. | Zoning Compliance |
| Orbital Range | *Earth has been fully retrieved.* Customers drive into low orbit. | Orbital Debris |

**Balls Outstanding and the Last Bucket.** The Board shows a second number,
**Balls Outstanding**: FHI's count of every golf ball ever hit and never
retrieved.
- It starts at 4,117,203,558.
- It ticks down with every ball you bank, and drops in big write-offs at each
  promotion ("2.1 billion balls reclassified as *the county*").
- At the Orbital Range, the last outstanding balls are in orbit. The oldest
  is **Ball No. 1**, hit by FHI's founder in 1958. It never came down.
- **The Last Bucket** is the bucket that brings it home.

**The ending.** When the Last Bucket is banked:
- Balls Outstanding reads 0.
- Ball Value divides by zero, and the Board shows **$∞ / ball**.
- Corporate sends its last memo: there are no more balls, so FHI no longer
  needs a range, and effective immediately the range belongs to the Rats.

Next morning the sign says *Under New Management*. A customer hits a ball and
Balls Outstanding reads **1**. That's endless mode.

---

## 2. The ball-value model

### The formula

```
pay for one deposit = Σ ball weights × BV × Hustle × Gear(carrier)

BV     = Rate × Upkeep                        Corporate's KPI: the big number on the Board
Rate   = venue rate × (1 + washer tier) × (1 + 0.05 × commendations)
Upkeep = 1 + 0.5 × (Curb + Pond + Fries + …)  each KPI is 0..1; a locked KPI counts 0
Hustle = 1 + 0.25 × crew pings today, max ×2  (Hit the Cart; resets every morning)
Gear   = 1 + 0.25 × (1 − grime / 3)           grime is 0..3 layers on the carrier's own gear
```

- **Shared wallet:** every deposit lands in the crew's one wallet.
- **Personal gear:** Gear is the depositor's own multiplier. Your clean
  bucket earns the crew more, and the report credits you with it.
- **The cart and helpers:** the cart has its own grime. Helpers are always
  ×1.0. They're teenagers; their gear is never clean.
- **Personal purchases** (carrying gear, dive gear) come out of the crew
  wallet, belong to the buyer, and are **not** scaled by crew size. Crew
  purchases (cart, washer, ads, helpers, the snack shed) keep `priceScale`.
- **It matches today's build at the Muni.** A venue rate of $1 with washer
  tiers 0, 1 and 2 gives $1, $2 and $3, the same as now.

**Worked example.** A Rat with a clean tube banks 8 range balls. BV is $2.60
and the crew has one ping today.
`8 × 2.60 × 1.25 × 1.25 = $32.50`.

### What feeds it

| Activity | Feeds | How much | How it decays or resets |
| --- | --- | --- | --- |
| Venue promotion | Rate | Muni $1, Club $5, Tiered $25, Stadium $100, County $500, Orbital $2,500 | Permanent |
| Ball washer (bought) | Rate | ×1, then ×2, then ×3 | Permanent |
| Gary's commendations (see 4.6) | Rate | +5% each, max 10 (+50%) | Permanent and saved |
| **Power washing** the mats, sign and stand | Curb Appeal, then Upkeep | +0 to +50% | Morning mud, then about −35%/shift from divots, the sprinkler, the truck |
| **Diving** | Pond Clarity, then Upkeep | +0 to +50% | `1 − sunk/30`. Every ball in the pond counts, lead balls always land there, and **sunk balls stay overnight** |
| **Potatoes** (once the snack shed reopens) | Fry Satisfaction, then Upkeep | +0 to +50% | Stock of 20 baskets. Customers eat one basket every 8 swings, and the stock halves overnight (the fries go cold) |
| Hit the Cart | Hustle | +25% a ping, max ×2 | Resets every morning |
| Washing your own gear, or the cart | Gear | ×1.0 to ×1.25 | +1 grime layer per knockdown (you land in the mud) and per 30 balls picked. The cart gains one per 40 m driven, three times as fast near the pond |
| Ball type | Weight | range 1, square 1, foam 0.5, bouncy 1.5, lead 3, glow 2, gold 10, splitter 3 × 1 | — |

**Design intent:**
- Upkeep never drops below ×1.0. Chores only ever *raise* pay, which keeps
  the game cozy.
- The upkeep bonus drains all shift, so one Rat spending about 1–2 minutes a
  shift on each chore keeps it high. Ignore a chore and you leave money on
  the table, but nothing is ever taken away.
- Each new KPI raises the ceiling by +50%, so the maximum Upkeep grows with
  the ladder: ×2.5 at the Muni, ×4.5 at Orbital. That is the incremental curve
  for ball value.
- **Why Hustle drops from ×3 to ×2:** at ×3, two lucky pings outearn every
  chore combined, and the crew learns to skip the chores and just ring the
  cage. Ball value is the story, so it has to win.

### Starting numbers (Muni, day 1)

- Rate is $1.
- Curb Appeal starts at 50%: mud on the sign and on three mats.
- Upkeep is ×1.25, so **BV starts at $1.25**.
- Pond and Fries are locked, so the Board shows them as dark dials marked
  *COMING SOON — Corporate*.
- Hosing down the sign is the first visible lever: the Board flips
  $1.25 → $1.29 in front of you.

### The quota (the venue gate)

The quota replaces stars as the venue gate.
- **Target:** each morning, Corporate sets *BV at the closing bell ≥
  Rate × (1 + q)*. Hustle and Gear don't count toward it.
- **q by day:** none on day 1, then 0.15, 0.20, 0.30, 0.35, then +0.05 a day
  up to 80% of the current Upkeep ceiling.
- **Hitting it** pays **15% of the day's take** and one **review stamp**.
- **Promotion** takes three stamps plus a franchise fee: Club $2,500 solo
  (×`priceScale` for the crew).

---

## 3. Power washing, version 1

### Where mud comes from (v1: the mats, the sign, the stand, the cart and your gear)

| Source | What it dirties | Rate |
| --- | --- | --- |
| **Morning mud** (the overnight weather) | Every facility cell | 25% of cells start with 1–3 layers. On a *rain day* (1 day in 4, forecast in the report) it's 60%. |
| **Divots** | The mat that swung | 10% chance per customer swing of +1 layer on one of that mat's 4 cells. More crew means more customers, so more mud. |
| **The sprinkler malfunction** | 8 cells around the mats | Once a shift, at a random time from 2 to 5 min. +2 layers. Loud hiss. |
| **The gravel truck** | The road sign | Once a shift. It drives past and splats 3–6 sign cells. **While the sign is more than half mud, Advertising works at half strength.** |
| **Driving** | The cart | +1 layer on a random cart cell per 40 m driven, three times as fast within 10 m of the pond |
| **Getting knocked flat** | Your own gear | +1 layer. You landed in the mud. Also +1 per 30 balls picked up. |

**The grid.** Facility cells: 10 mats × 4, the sign × 6 and the stand × 6, 52
cells in all. Each cell holds 0–3 layers.
`Curb = 1 − Σ layers / (52 × 3)`. The cart has 12 cells of its own, and its
grime (for Gear and for Gary) is the average of those cells.

### What spraying feels like

- **The wand.** v1 has one shared wand, which hangs on the wash pad next to
  the stand. Grab it with Use. While you hold it, Use (Ⓐ / left click /
  Space) sprays instead of picking up. Drop it with Bucket (Ⓧ / E). It stays
  where you dropped it, and anyone can pick it up. One wand per crew makes
  handing it over a real moment. A second wand is a later shop tier.
- **Spraying is aimed by your view.** A white particle jet with a 4 m reach
  (the garden hose). Each muddy cell inside the cone loses one layer every
  0.35 s. The pressure washer upgrade gives 6 m and 0.15 s.
- **The reveal.** Under the mud there's always something:
  - the sign reads **RANGE · EVERY BALL MATTERS™**;
  - each mat has a Dimples stencil;
  - the cart reads **PROPERTY OF FHI. PLEASE DO NOT HIT.** (It is hit
    constantly.)
- **The ding.** When an object comes fully clean:
  - a chime plays and sparkles pop;
  - a short pad rumble fires (`gamepad.vibrationActuator`, guarded);
  - the Board ticks with "+3% Curb Appeal" floating up.
  The hiss's pitch rises while you're hitting mud and drops when you're
  spraying air, so you can *hear* when you've missed.
- **Hose a Friend.** Spraying a crewmate takes one grime layer off their
  gear per 0.35 s and pushes them back half a metre (no knockdown). The crew
  lines up at the wash pad to get hosed. Solo, you rinse your own gear by
  holding Use at the pad's spigot, at 2 s per layer.
- **The cart wash.** The driver parks on the pad and a crewmate sprays the
  cage. Or the driver gets out and does it alone, more slowly.

### How it ties to value

- Curb Appeal is worth up to **+50% on BV** for everyone.
- Clean personal gear is up to **×1.25** on what *you* bank.
- A clean cart is up to **×1.25** on what the cart unloads.
- A clean sign keeps Advertising at full strength.

### v1 scope (small)

**In:**
- Cells on the mats, sign, stand and cart, plus personal gear grime.
- Morning mud, divots, the sprinkler and the truck.
- One wand, the reveal stencils, the ding.
- Curb Appeal on the Board.

**Out until later:**
- the pressure washer tiers;
- a second wand;
- reel clogging;
- the power-washing truck (that's the job's absurd endgame).

**Server data:**
- State: `mud = { mats: '0120…', sign, stand, cart }`, digit strings so the
  snapshot stays tiny; `p.grime` (0–3); `wand = { holder, x, z }`.
- Input: `{t:'spray', on, yaw, pitch}`. The server cleans cells inside the
  cone each tick.
- Events: `{t:'mud', obj, cell, v}`, `{t:'clean', obj}` (ding), and
  `{t:'hose', by, target}`.

**Client:**
- One canvas texture per object, painted from the cell string.
- The jet particles, drawn from `spray on` and the holder's view.

**Playtest check:** a first-time player washes something within their first
two shifts **without being told**, because a Board dial is low. Cleaning one
object takes 4–8 s and ends on the ding. In a 4-player session, someone hoses
a crewmate unprompted.

---

## 4. The council

### 4.1 Five pitchers, 40 pitches

| Persona | Leaned on |
| --- | --- |
| Incremental / idle designer | Cookie Clicker, Universal Paperclips, Factorio, Shapez |
| Co-op chaos designer | Overcooked, Lethal Company, PlateUp, Moving Out |
| Cozy job-sim designer | PowerWash Simulator, Stardew Valley, Unpacking |
| Comedy / absurdist writer | corporate satire, Severance, The Stanley Parable |
| Live-ops / retention designer | session pacing, "one more shift" |

**Incremental / idle designer**
- **I1 · The Board.** Ball Value as a giant number on a wall that flips
  whenever it moves. Every chore shows up as a dial.
- **I2 · Daily Quota.** A target every morning, so every shift has a finish
  line.
- **I3 · Buy Out a Job.** Each job gets a visible automation ladder (hand,
  helper, machine, factory). Locked tiers show as silhouettes.
- **I4 · The Potato Line as a nested incremental.** Potatoes become baskets,
  baskets fill the Fry stock, and the farm makes potatoes from nothing.
- **I5 · Franchise Pins.** Prestige: each promotion awards permanent pins
  that boost rates.
- **I6 · The Ball Catalogue.** The first time each ball type is banked, the
  Rate goes up permanently.
- **I7 · Ball Gutters.** Overnight build mode: place gutters and conveyors
  that roll balls to the stand.
- **I8 · Night Crew.** Offline earnings: helpers keep working while the crew
  is away.

**Co-op chaos designer**
- **C1 · The Regional Manager Walkthrough.** Corporate's man inspects the
  range mid-shift, so the crew scatters to clean ahead of him.
- **C2 · Happy Hour.** A 60 s rush: every mat full, swings doubled, BV
  doubled.
- **C3 · Buddy Air.** A teammate on the dock pumps air to the diver.
- **C4 · Hot Fries.** Fries have to be carried out to the mats before they go
  cold. Get knocked flat and there are fries everywhere.
- **C5 · Complaint Tickets.** Overcooked-style tickets pop up at places on
  the range with timers.
- **C6 · The Cart Wash Lane.** The driver rolls the cart through while a
  teammate sprays.
- **C7 · The Overflowing Hopper.** An overfull cart spills balls on bumps.
- **C8 · Hose a Friend.** Spraying a crewmate cleans their gear and shoves
  them.

**Cozy job-sim designer**
- **Z1 · The Reveal.** The mud hides a stencil. Finishing an object gets a
  ding and a rumble.
- **Z2 · Lost and Found.** The pond turns up absurd junk for a shelf that
  persists: car keys, a 1987 trophy, a Dimples pin.
- **Z3 · Peel by Stick.** Rotate the right stick to peel. An unbroken peel
  spiral gets a bonus.
- **Z4 · Opening Chores.** A diegetic opening ritual: flip the OPEN sign,
  raise the flag, unlock the ball machine.
- **Z5 · Weather Days.** Rain means mud, sun means customers, and the
  forecast is in the report.
- **Z6 · The Break Room.** The shop becomes a room with a corkboard, the
  catalogue and the lost and found.
- **Z7 · Curb Appeal Decor.** Flower boxes, flags and a fountain that raise
  Curb Appeal's floor.
- **Z8 · The Ball Silo.** A clear silo by the stand fills with every ball
  banked today. The score, made physical.

**Comedy / absurdist writer**
- **W1 · The Overnight Memo.** One memo from Corporate each night, carrying
  the quota.
- **W2 · Dimples on the Range.** A Rat in a golf-ball suit wanders the field.
  Hit him and HR sends a memo.
- **W3 · Employee of the Shift.** Absurd per-player awards ("Most Horizontal
  Associate").
- **W4 · Policy of the Day.** Memo-driven modifiers ("Casual Friday: all
  balls are foam").
- **W5 · The Performance Review.** The venue gate is a deadpan review.
- **W6 · KPI Names.** Every metric gets a Corporate name: Curb Appeal, Fry
  Satisfaction…
- **W7 · Balls Outstanding.** A ticker counting down every ball ever hit,
  which pays off the Last Bucket.
- **W8 · The Huddle.** Corporate wants the whole crew at the stand for team
  synergy.

**Live-ops / retention designer**
- **L1 · The Tomorrow Tease.** The report ends with tomorrow: the weather,
  the next ball type, the quota.
- **L2 · The Quota Streak.** Consecutive quota hits stack up.
- **L3 · The Unlock Cadence.** Every shift unlocks at least one new shop row.
- **L4 · The Personal Ledger.** Each Rat's own line in the report.
- **L5 · The New Hire Kit.** Late joiners get a hand-me-down tube, so
  personal gear doesn't strand them.
- **L6 · Crew Records.** Best shift, best BV. A record shift triggers a voice
  line.
- **L7 · Last Call.** The last minute of every shift is a dusk climax.
- **L8 · Corporate Event Day.** Every fifth day is a special event day with
  its own rules.

### 4.2 Merging: 40 pitches, 24 on the ballot

**Folded into the agreed designs (not on the ballot):**
- Into power washing (section 3): C6 Cart Wash Lane, C8 Hose a Friend, Z1
  The Reveal.
- Into the Potato Line: Z3 Peel by Stick and C4 Hot Fries.
- Into the Quota: W1 Overnight Memo, W5 Performance Review, L1 Tomorrow
  Tease, L2 Quota Streak.
- Into the Board: W6 KPI Names and W7 Balls Outstanding.
- Into Policy of the Day: Z5 Weather Days. (The weather survives anyway, as
  power washing's morning mud.)

The incremental designer's I1 and the writer's W7 turned out to be the same
idea: one number to watch and one to finish. I2 was pitched three times.

| # | Idea | Sources | Agreed? |
| --- | --- | --- | --- |
| 1 | **The Board** (Ball Value, KPI dials, Balls Outstanding) | I1, W6, W7 | |
| 2 | **Daily Quota & Performance Review** (memo, stamps, tomorrow tease) | I2, W1, W5, L1, L2 | |
| 3 | Policy of the Day & Weather | W4, Z5 | |
| 4 | **Regional Manager Walkthrough** | C1 | |
| 5 | **Last Call** (the dusk rush) | C2, L7 | |
| 6 | Buy Out a Job + unlock silhouettes | I3, L3 | |
| 7 | The Potato Line | I4, Z3, C4 | agreed |
| 8 | Pond Diving (Buddy Air, Lost and Found) | C3, Z2 | agreed |
| 9 | Franchise Pins (prestige) | I5 | |
| 10 | Ball Debuts & Catalogue | I6 | agreed (ball types) |
| 11 | Ball Gutters (build mode) | I7 | |
| 12 | Night Crew (offline earnings) | I8 | |
| 13 | Complaint Tickets | C5 | |
| 14 | Overflowing Hopper | C7 | |
| 15 | Opening Chores | Z4 | |
| 16 | The Break Room | Z6 | |
| 17 | Curb Appeal Decor | Z7 | |
| 18 | The Ball Silo | Z8 | |
| 19 | Dimples on the Range | W2 | |
| 20 | Employee of the Shift + Personal Ledger | W3, L4 | |
| 21 | The Huddle | W8 | |
| 22 | New Hire Kit | L5 | |
| 23 | Crew Records | L6 | |
| 24 | Corporate Event Day | L8 | |

### 4.3 Judging: five council members

| Judge | Lens |
| --- | --- |
| **Fun Expert (chair)** (F) | Moment-to-moment fun, and the pacing of the incremental curve |
| Technical Director (T) | Buildable *well* tonight: Three.js, server-authoritative, zero npm dependencies |
| Player Advocate (P) | Clarity on a TV with an Xbox pad, the first session, readability with 4 players |
| Story Keeper (S) | Does it serve the Range Rats, Corporate and the ball-value story? |
| Co-op Advocate (C) | Does it create moments between players, and give 4 people a reason to split up and regroup? |

**Scores (1–5):**

| # | Idea | F | T | P | S | C | Sum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | The Board | 4 | 5 | 5 | 5 | 3 | 22 |
| 2 | Daily Quota & Review | 4 | 4 | 4 | 5 | 4 | 21 |
| 3 | Policy of the Day & Weather | 3 | 3 | 2 | 4 | 3 | 15 |
| 4 | Regional Manager Walkthrough | 5 | 4 | 4 | 5 | 5 | **23** |
| 5 | Last Call | 5 | 5 | 5 | 3 | 4 | 22 |
| 6 | Buy Out a Job | 4 | 3 | 4 | 3 | 4 | 18 |
| 7 | The Potato Line | 4 | 3 | 3 | 4 | 4 | 18 |
| 8 | Pond Diving | 4 | 3 | 3 | 4 | 5 | 19 |
| 9 | Franchise Pins | 3 | 4 | 2 | 3 | 2 | 14 |
| 10 | Ball Debuts & Catalogue | 4 | 4 | 4 | 4 | 3 | 19 |
| 11 | Ball Gutters | 4 | 1 | 2 | 2 | 3 | 12 |
| 12 | Night Crew | 2 | 4 | 3 | 1 | 1 | 11 |
| 13 | Complaint Tickets | 3 | 4 | 3 | 3 | 3 | 16 |
| 14 | Overflowing Hopper | 3 | 5 | 2 | 1 | 3 | 14 |
| 15 | Opening Chores | 2 | 4 | 2 | 3 | 3 | 14 |
| 16 | The Break Room | 2 | 2 | 2 | 4 | 3 | 13 |
| 17 | Curb Appeal Decor | 2 | 4 | 3 | 3 | 2 | 14 |
| 18 | The Ball Silo | 4 | 5 | 5 | 3 | 3 | 20 |
| 19 | Dimples on the Range | 3 | 4 | 4 | 5 | 3 | 19 |
| 20 | Employee of the Shift | 3 | 5 | 4 | 4 | 3 | 19 |
| 21 | The Huddle | 3 | 5 | 3 | 4 | 5 | 20 |
| 22 | New Hire Kit | 2 | 5 | 5 | 3 | 4 | 19 |
| 23 | Crew Records | 3 | 5 | 4 | 3 | 3 | 18 |
| 24 | Corporate Event Day | 3 | 2 | 3 | 4 | 4 | 16 |

### 4.4 Picks and vetoes

**Fun Expert (chair).**
1. **Walkthrough.** It's the only idea that gives the shift a middle.
2. **Last Call.** It gives the shift an end.
3. **The Board.**
4. **Quota.**
5. **Pond Diving.**

*Vetoes:*
- **Night Crew.** Idle income kills the reason to show up together.
- **Overflowing Hopper.** It punishes the best toy in the game.
- **Opening Chores.** Thirty dead seconds in a seven-minute shift.

**Technical Director.**
1. **The Board.** Snapshot fields and one canvas texture.
2. **Last Call.** A timer and a ball flag.
3. **Quota.**
4. **The Huddle.**
5. **The Ball Silo.** An instanced mesh.

*Vetoes:*
- **Ball Gutters.** Placement, slope physics and saving a layout: that's L,
  and it isn't tonight.
- **The Break Room.** A second scene just to hold a menu.
- **Corporate Event Day.** A second rule set to maintain forever.

*Warning on the Potato Line:* the kitchen is an indoor space with its own
camera framing. Build it as a counter on the outside of the shed, not as an
interior.

**Player Advocate.**
1. **The Board.** It answers "what do I do now?" from the sofa.
2. **Last Call.**
3. **Quota.**
4. **New Hire Kit.** Personal gear strands anyone who joins late.
5. **Walkthrough.**

*Vetoes:*
- **Franchise Pins.** A prestige reset confuses a crew where somebody missed
  the night it happened.
- **Complaint Tickets.** Four players' worth of tickets is clutter on a TV,
  and the Board's dials already say what's slipping.
- **Policy of the Day.** Rule changes on day 2 break the first session.

**Story Keeper.**
1. **Quota & Performance Review.** It *is* Corporate.
2. **The Board.**
3. **Walkthrough.** Gary is Corporate with a face.
4. **Dimples on the Range.**
5. **The Potato Line.**

*Vetoes:*
- **Night Crew.** Corporate pays per ball a Rat banks. Unwatched work is a
  different story.
- **Ball Gutters.** Gutters are Tier 3 content in the ladder. Building them
  at the Muni flattens it.

**Co-op Advocate.**
1. **Walkthrough.** Split up to clean ahead of Gary, regroup for the verdict.
2. **Pond Diving.** The one job that takes someone *out* of the crew, so
   coming back matters.
3. **The Huddle.**
4. **Last Call.**
5. **The Potato Line.**

*Vetoes:*
- **Night Crew.**
- **Franchise Pins.**

### 4.5 Tally

Rank points are 5 for 1st down to 1 for 5th. The sum is the total of the five
1–5 scores.

| Idea | Picked by | Rank pts | Score sum | Vetoed by |
| --- | --- | --- | --- | --- |
| **The Board** | F, T, P, S | **17** | 22 | — |
| **Regional Manager Walkthrough** | F, P, S, C | **14** | **23** | — |
| **Last Call** | F, T, P, C | **14** | 22 | — |
| **Daily Quota & Review** | F, T, P, S | **13** | 21 | — |
| The Huddle | T, C | 5 | 20 | — |
| **Pond Diving** | F, C | 5 | 19 | — (agreed) |
| The Potato Line | S, C | 2 | 18 | — (agreed) |
| New Hire Kit | P | 2 | 19 | — |
| Dimples on the Range | S | 2 | 19 | — |
| The Ball Silo | T | 1 | 20 | — |
| Night Crew | — | 0 | 11 | F, S, C |
| Franchise Pins | — | 0 | 14 | P, C |
| Ball Gutters | — | 0 | 12 | T, S |
| Overflowing Hopper, Opening Chores, Break Room, Event Day, Complaint Tickets, Policy of the Day | — | 0 | — | one veto each |

**The rule, as in golf:** a veto removes an idea unless at least three judges
picked it. No vetoed idea had three picks, so all nine are out. Ties on rank
points break on the score sum, which puts the Walkthrough (23) above Last Call
(22).

**Merges the judges proposed, all adopted:**
- **The Co-op Advocate merged the Huddle into the Walkthrough.** Gary's
  verdict is delivered at the stand, and the Huddle bonus goes to a crew that
  is all standing there for it. That gives the Walkthrough its "regroup"
  half and frees the fifth slot. The Huddle and Pond Diving were tied on
  5 points.
- **The Fun Expert merged the Ball Silo into the Board.** The number and the
  pile are the same reward.
- **The Story Keeper merged Last Call with the glow ball's debut.** The glow
  ball is an agreed ball type and appears only at dusk, so it becomes Last
  Call's content.

**One rider was adopted outside the five: the New Hire Kit.** Personal gear
needs it on day one. A Rat who joins after day 1 starts with a free
hand-me-down tube ("from the lost and found"). It's XS, and it ships with the
personal-gear change.

### 4.6 Decision: the five to build next

The ranking is the vote. The **build order** follows dependencies:
**1 → 4 → 3 → 2 → 5**. The quota reads the Board, and Gary inspects the mud.
After the five, the agreed Potato Line goes next, then the Ball Debuts.

Sizes: **S** is an evening, **M** is one or two sessions, **L** is more.

---

#### 1. The Board (with the Ball Silo) · S

**Spec.** A big split-flap board on the bucket-stand roof faces the field,
with a mini copy in the HUD. It shows:
- **Ball Value** ($X.XX, which flaps whenever it changes);
- one dial per KPI: Curb Appeal now, with Pond and Fries dark and marked
  *COMING SOON — Corporate*;
- Hustle ×;
- today's quota, as a red line on the BV bar;
- **Balls Outstanding**, ticking down.

Every deposit floats "+$32.50 · 8 × $2.60" over the depositor's head in their
colour. Gear multipliers show as a small "✦ clean" when they apply. Beside the
stand, a clear acrylic silo fills with today's banked balls (instanced, up to
2,000 visible, then it scales), and FHI trucks it away overnight.

**Data:**
- **Server, snapshot:** `bv`, `kpi: {curb, pond, fries}` (null when locked),
  `hustle`, `quota: {target}`, `outstanding`, `silo` (balls banked today).
  `bv` is computed in one shared `ballValue(state)` in `sim.js`.
- **Events:** `cash` gains `per` (pay per weighted ball), `w` (the summed
  weight) and `gear`.
- **Client:** a canvas texture on the board with a flap animation per digit
  (re-render only on change), floating sprite text, and the silo as one
  `InstancedMesh`.

**Playtest check:** show the TV view to someone who has never played. Within
5 s they can say what Ball Value is and which dial is lowest. In a 4-player
session, someone calls out a falling dial unprompted ("curb appeal's
dropping").

---

#### 2. The Regional Manager Walkthrough (with the Huddle) · M

**Spec.** Once a shift, Gary from Regional comes to inspect.
1. **Warning (3:00).** From day 3, at 3:00 into the 7:00 shift, a siren light spins on
   the stand and the Board flips **GARY FROM REGIONAL · 0:45**. His route
   appears on the ground as a dotted line: the road sign, behind the ten
   mats, the cart, the pond (once built), then the stand.
2. **The drive (3:45).** Gary drives the route at 5 m/s in a white cart with
   a Dimples flag. He's a cart, so he knocks Rats flat at speed (reuses
   `knockDown`).
3. **Inspections.** He pauses 3 s at each stop, and each stop is pass or
   fail:
   - sign: at most 1 muddy cell;
   - mats: at least 80% of mat cells clean;
   - cart: grime of 1 layer or less;
   - pond: 5 sunk balls or fewer;
   - stand: clean.
   Each result pops a ✓ or ✗ above the stop.
4. **Verdict (about 4:50) at the stand.** If he finds at most one failure, the
   crew earns a **Commendation**: +5% Rate, permanent and saved, up to 10.
5. **The Huddle.** If every online Rat is within 8 m of the stand when he
   arrives, the commendation counts twice and plays its voice line.

A ball that hits Gary's cart doesn't count as a PING. It rings, and a caption
reads *Gary has noted your enthusiasm.*

**Data:**
- **Server:** `gary: {phase: 'warn'|'drive'|'verdict'|null, t, x, z, yaw, stop, checks: []}` in the snapshot. `WALK_ROUTE` and `WALK_AT` (180 s) live in `sim.js`. The save gains `commendations`.
- **Events:** `{t:'gary', phase}`, `{t:'check', stop, ok}`,
  `{t:'verdict', fails, huddle, commendations}`.
- **Client:** Gary's cart (the cart mesh, white, with a flag), the route
  decal during the warning, ✓ and ✗ sprites, the siren light, and a horn SFX.

**Playtest check:** in a 4-player session, during the 45 s warning the crew
splits to at least 3 different places, and at least 3 of the 4 are at the
stand for the verdict. Afterwards, players name Gary as a highlight. Solo, a
reasonably tidy player earns a commendation on about half of shifts 3–6.

---

#### 3. Last Call (the glow ball's debut) · S

**Spec.** The final 60 s of every shift, from day 2 on:
- the floodlights come on and the Board flips **LAST CALL**;
- a bell rings;
- customers swing 1.5× as often, and every customer ball is a **glow ball**
  (emissive, worth ×2).

Glow balls still on the field at the bell are lost: the night crew keeps
them. The quota is measured *at the bell*. So in the last minute the crew has
to choose between grabbing glow balls and pushing BV over the line, and that
choice splits them up one more time.

**Data:**
- **Server:** `lastCall` derived from `shiftT ≥ shiftSecs − 60`. Balls gain
  `kind` (`'glow'`) in `spawn` events. Pockets carry a weighted value,
  `p.pocketW` (needed for all ball types anyway).
- **Events:** `{t:'lastcall'}`.
- **Client:** an emissive material for glow balls, floodlight `SpotLight`s
  switched on, a bell SFX, the board flip. Golden hour's sky already supplies
  the dusk.

**Playtest check:**
- Deposits in the final minute are at least 2× the per-minute average.
- On at least half of shifts, the crew starts the next shift within 30 s of
  the report. That's the "one more shift" pull.

---

#### 4. Daily Quota & Performance Review · M

**Spec.** Each morning a **memo card** appears: Dimples letterhead, at most
25 words and one number. For example: *"Today's Ball Value target is $2.60
at closing. Rain is forecast. Corporate believes in you, statistically."* Any
button dismisses it.
- **The target** is `Rate × (1 + q[day])`, set when the shift starts (after
  the shop, so buying a washer can't move the goalposts). It appears as the
  red line on the Board.
- **At the bell:** HIT pays 15% of the day's take and stamps the review card
  in the report. MISSED gets a deadpan line and nothing else.
- **Three stamps** (not necessarily in a row) unlock **Request Promotion** in
  the shop for the franchise fee. Until the Club exists, a promotion grants
  a title (Range Rat II, then Senior Range Rat) and the next shop row.
- **The tomorrow tease:** the report's last line previews tomorrow: the
  weather (rain means more morning mud) and any ball type arriving.

**Data:**
- **Server:** `quota: {q, target}` in the snapshot. The save gains `stamps`,
  `title`, `venue` and `forecast`.
- **Events:** `{t:'memo', text, target}` at the start of a shift, and
  `{t:'quota', hit, bonus, stamps}` at the bell. The report gains `quota` and
  `tomorrow`.
- **Client:** the memo card (TV-sized type, dismissed with Ⓐ), the stamp
  animation in the report, and the promotion row in the shop.

**Playtest check:**
- A fresh crew hits quota on 70–85% of shifts 2–5. Not every shift, and
  never trivially.
- In the last minute, at least one player switches jobs *because of the red
  line*.

---

#### 5. Pond Diving (lead balls, Buddy Air) · M

**The pond.**
- It sits at about (−35, −85), 14 m across, where many customer carries
  land.
- Balls that land in it sink and join `pond.sunk`, capped at 60. The count
  is saved, and positions are re-scattered when the save loads.
- From day 4, the memo announces **lead balls**: 6% of customer shots, aimed
  to land in the pond. Each pays ×3.
- **Pond Clarity** = `1 − sunk/30`.

**Diving.**
- Walk into the pond and the view goes under: thick green fog, a flashlight
  cone, and glints from balls within 4 m.
- The air bar starts at 20 s.
- The bag is personal gear: a mesh bag holding 10.
- Use grabs a ball. Walk out to surface, then bank at the stand as usual.
- If the air runs out, you pop up coughing and the bag spills back to the
  bottom.

**Buddy Air** (optional; solo still works). A crewmate on the dock holding
Use cranks the pump, which refills the diver's air at 2 s per second. The
diver's bubbles boil at the surface so everyone can see where they are. Rare
junk turns up (car keys, a 1987 trophy) for a lost-and-found shelf on the
stand: cosmetic, and saved.

**Gear ladder** (personal): mask (20 s) → tank (35 s) → twin tanks (60 s).
The pond pump and the submarine are later.

**Data:**
- **Server:** `pond: {sunk: [{id, x, z, kind}]}`, `p.diving`, `p.air`,
  `p.bag`. Save `pondSunk` (a count) and `lostFound`.
- **Inputs:** `pickup` with `pond: true`, and `{t:'pump', on}`.
- **Events:** `{t:'sink', id}`, `{t:'dive', id, on}`, `{t:'gasp', id}`,
  `{t:'found', item}`.
- **Client:** a water plane and a dock. Underwater, swap `scene.fog` for a
  short green fog, a blue-green tint and a `SpotLight` on the camera.
  Bubble particles, the air bar, and a muffled low-pass on the SFX bus.

**Playtest check:**
- In a 4-player session with lead balls on, one player chooses to dive for
  at least 2 minutes in a row, unprompted, and says they liked it.
- Solo, a 20 s dive yields 4–8 balls, and with lead at ×3 it beats the same
  20 s on the field.
- If nobody dives for two shifts, the Pond dial is visibly empty.

### 4.7 The agreed features, placed

- **Potatoes (next after the five).**
  - The Muni's shed reopens as the **snack shed**: a crew purchase of $200
    solo, which unlocks Fry Satisfaction.
  - By hand, it's a counter on the outside of the shed: rotate the right
    stick to peel (one potato is about 6 turns, about 3 s), and a long
    unbroken peel spiral earns a "✦ one peel" bonus.
  - At the Club the kitchen's automation ladder goes absurd: peeler, fry
    conveyor (a belt of fries runs to the mats, so C4's Hot Fries becomes
    its visual), then the potato farm at the County.
  - Corporate never explains why a driving range needs this many fries.
- **Ball types** debut by memo:
  - day 3: square (easy money) and gold (1 in 200 shots, ×10);
  - day 4: lead (the pond);
  - day 2 on: glow (Last Call);
  - day 6: foam (×0.5, drifts in the wind);
  - day 7: splitter (one ball becomes three);
  - the Club: super-bouncy (×1.5, rolls away from whoever's chasing it).
  - The first one of each type gets a voice line.
- **Cameras:**
  - First-person on foot.
  - Chase cam in the cart.
  - **Overview**, unlocked with the second cart, is "Corporate's CCTV": a
    grainy, timestamped feed from a mast by the stand.
- **No roles.** The Board's dials say what's slipping. Nobody tells anyone to
  fix it.
- **Multiplayer first.** With 4 players, customer supply caps at 10 mats from
  about shift 3, so picking up stops being the ceiling and **Ball Value
  becomes the lever**. That is exactly what gives four people chores to split
  up for. Solo stays labour-bound and leans on helpers. That asymmetry is the
  design working, not a bug.

---

## 5. Pacing sketch: the first five shifts

These are tuning targets, so measure them in playtest.

**The estimates:**
- **Ball supply:** about 0.75 customer balls a second solo (6 mats), about
  1.25 at 4 players (10 mats). Advertising adds to both.
- **Hand pick-up rate:** about 35 balls a shift by hand, about 85 with a
  tube.
- **Prices:** solo prices as listed. Four players pay ×2.2 on crew items and
  ×1 each on personal gear.
- **New items assumed:** garden hose free, pressure washer $50, mask $40,
  tank $120.

**1 player**

| Shift | Kit going in | Banked | Avg pay/ball | Earned | Buys | What's new |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Hands, the hose | ~35 | $1.35 | ~$47 | Tube $20, sneakers $15 | The Board. A muddy sign. No quota. |
| 2 | Tube | ~85 | $1.50 | ~$145 (with bonus) | Hand-crank washer $40, Kyle $60 | First memo and quota. Last Call and glow balls. |
| 3 | Tube, Kyle | ~150 | $3.00 | ~$500 | Range bucket $75, road sign $30, pressure washer $50, Madison $150, hard hat $35 | First Gary. Square and gold balls. |
| 4 | Bucket, 2 teens, sign | ~240 | $3.30 | ~$900 (about $1,100 in the bank) | Electric washer $160, **caged cart $600**, mask $40, radio $90 | Lead balls and the pond. Pond Clarity lights up nearly empty: balls have been sinking since day 1. |
| 5 | Cart, 2 teens, mask | ~420 + ~15 lead | $5.80 (no Hustle solo: nobody's at a bay) | ~$2,600 | Wide reels $1,500, Tanner $400, tank $120 | First cart voice line. Probably the third stamp, so a Performance Review. |

**4 players**

| Shift | Kit going in | Banked | Avg pay/ball | Earned | Buys | What's new |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 4 × hands | ~140 | $1.35 | ~$190 | 4 tubes $80, hand-crank washer $88 | Everyone learns pick-up. Someone finds the hose. |
| 2 | 4 tubes | ~330 | $2.90 | ~$1,100 | 2 buckets $150, Kyle $132, sign $66, pressure washer $110, hard hats $77, sneakers × 4 $60 | Quota. Last Call. Someone discovers that mud is money. |
| 3 | 2 buckets, 2 tubes, Kyle, sign | ~520 (supply about 650) | $3.10 | ~$1,850 (about $2,400 in the bank) | Electric washer $352, radio $198, **caged cart $1,320** | First Gary and a Huddle. **Supply is now the ceiling: BV is the lever.** |
| 4 | Cart, 2 buckets, 2 tubes, Kyle, radio | ~760 (supply about 815) | $5.00 | ~$4,300 | 2 buckets $150, Madison $330, 2 masks $80, push picker $250 (one Rat) | The pond. Diving becomes someone's job. The first PING jackpot. |
| 5 | Cart, a diver, the lot | ~800 + ~30 lead | $7.50 (with Hustle) | ~$6,500 | Wide reels $3,300, blimp $550, a tank $120 | Third stamp. The Club's fee ($5,500 for 4) is the next goal. |

**What this shows:**
- **Each shift has an unlock.** Solo: tools, then automation, then the cart.
  Four players: tools, then upkeep, then the cart.
- **Four players reach the cart a shift earlier,** but they earn it through
  Ball Value, not ball count.
- **The shift has a shape** from day 3: open on the memo, Gary at the middle,
  Last Call at the end.

---

## 6. Corporate memo voice lines (big events only)

Each line is spoken once and captioned. Every line gets a visual stamp: the
Dimples seal, on screen.

| Event | Line |
| --- | --- |
| First cart | "Corporate has issued you a vehicle. Corporate has not issued you a license." |
| Cart jackpot | "A jackpot has occurred. Please do not get used to this." |
| Record shift | "A record shift. Congratulations. This is now the baseline." |
| First lead ball | "Corporate has sourced a heavier ball. The pond is now a department." |
| First gold ball | "A gold ball has been hit. It belongs to Corporate. You may hold it briefly." |
| Gary's commendation, with a full Huddle | "Gary from Regional is satisfied. Gary has never been satisfied." |
| Promotion to the Club | "Congratulations on your promotion. Your duties, pay and parking are unchanged." |
| First fleet | "You now operate more carts than Corporate has parking. That is a you problem." |
| The Orbital Range | "Earth has been fully retrieved. Please look up." |
| The Last Bucket | "There are no more balls. Corporate has no further use for a range. Every ball mattered." |

---

## 7. Notes for the build (the council's concerns)

These are things the council thinks will bite if they aren't handled now,
while personal gear and power washing are being built.

1. **Personal gear will get wiped.**
   - `removePlayer` deletes a Rat 60 s after they disconnect.
   - The save stores no players at all, so every deploy and every server
     restart empties `players`.
   - Gear must be saved in the crew save, keyed by a stable identity (a hash
     of the player's token, or their name within the crew), and restored on
     rejoin.
2. **Helpers read crew gear that no longer exists.** `stepHelpers` uses
   `this.perks.pocket`. With gear personal, give helpers their own capacity
   through the hired-help tiers (8, 12, 20, 25), or they quietly drop back to
   3.
3. **`priceScale` must not apply to personal gear.** Otherwise four Rats each
   pay ×2.2 for their own tube, ×8.8 in total.
4. **The pocket needs to carry value, not just a count.** Ball types,
   per-carrier gear and glow balls all need a weighted pocket (`pocketW`)
   and pricing per deposit: `bank(n, by, kind, w, gear)`. Make the change
   now, while gear is open; retrofitting it after five ball types is worse.
5. **Cap Hit the Cart's multiplier.** Today's +1× up to ×3 will swamp the
   ball-value story (see section 2). Use +0.25 a ping, up to ×2.
6. **Keep mud coarse and server-side.** Use cells with layers, as digit
   strings in the snapshot, not textures. Send spray as on/off plus aim;
   never stream particles. The client paints the cells.
7. **Leave day 1 alone.** No quota and no Last Call until day 2, and no Gary until day 3.
   Day 1 is picking up, the Board, and one muddy sign.
8. **The design doc still describes stars.** `game-design.md` says it's the
   source of truth, so replace *Range Rating (stars)* with Ball Value and
   the quota in the same commit that lands them.
