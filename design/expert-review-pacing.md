# Expert review: pacing and things to do (2026-11-25)

An outside review of Range Rat's pacing and activity design. My background is co-op party and management games
(Overcooked, PowerWash Simulator, Lethal Company, Deep Rock Galactic, Stardew-style daily loops, incrementals). I'm
not part of the fun council. I read the README, the design doc (closely from owner playtest 3 on), the scorecard,
playtest round 5, council round 10, the owner-playtest-3 spec and the code. Then I measured the game myself against
the real `Crew`.

**The short version.** The first hour is good, and in places very good. A 7-minute shift with a glow rush, a cleanup
minute and a walk-off is a strong unit. The game's problems are in the shape of the whole run, not in any one system:

1. **From the Stadium to the County is a 45–50 minute sag.** Nothing there can fail, money stops mattering, and
   two of four Rats have nothing that changes the outcome.
2. **Every venue has a built-in dead day.** The third "good day" can only land at the bell, so clocking out early
   can't help it.
3. **Every one of the ~19 shifts has the same shape.** New things arrive in lumps (the Club dumps about 14 in one
   shift), and nothing makes a Tuesday different from a Wednesday.

Each of these has cheap fixes (§8).

---

## 1. What I measured, and how

Scripts are in the session scratchpad, `expert/`. No game code was edited.

| Script | What it does |
| --- | --- |
| `classify.mjs` | Files every Rat's state, every tick, under one activity: seek (walking to a ball), carry (walking it home), pick, bank, fill, hose, crank, cook, dive, drive, shoot, Gary, space, knocked down, idle. It also tracks field supply (time with fewer resting balls than Rats). |
| `muni.mjs` | Playtester A's round-5 physical bot (real walking, picking, hosing, cart, basket, Gary huddle), from Muni day 1 to the Club, with the classifier and a log of new things. Flags: `prep` (a solo Rat cleans for Gary before his warning). |
| `mid.mjs` | Playtester B's round-5 physical bot, from the Club to the Stadium promotion (cooking, diving the pond and the creek, aiming at Tiered, deck orders), with the classifier. `GOAL2P=1` plays the card at 2P. |
| `late.mjs` | Playtester C's round-5 ladder (abstracted picking, real laps, pings, Yards, EVA and Last Bucket), from the Stadium to endless. `FOOTMUL` / `CARTMUL` switch off the Rats' own picking. |
| `avg.mjs`, `idle.mjs` | Average the activity split over seeds; find where idle time sits. |

Seeds 7, 11 and 23; 1, 2 and 4 Rats. **Caveat:** bots never get lost, never chat, never all run to the new toy, and
never spend 3 minutes in the shop. Treat every time below as a **lower bound** for humans.

### 1.1 Minutes per venue

| | Muni | Club | Tiered | Stadium | County | Orbital | **Orbital starts** | **The Last Bucket** |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **4P shifts** | 4 (all seeds) | 3 / 4 / 5 | 3 | 3 (4 if nobody drives laps) | 3 | 1 + ~3 min | | |
| 4P minutes, 40 s overnights | 26 | 31 | 23 | 23 | 23 | ~11 | **~123 min** | **~2 h 14** |
| 4P minutes, 60 s overnights | 28 | 32 | 24 | 24 | 24 | ~11 | ~132 min | ~2 h 23 |
| **Solo shifts** | 5 (prepping for Gary) / never (reacting to his warning) | 3 | 3–5 | 4 | 3 | 2 | | ~2 h 30–2 h 45 |
| **2P shifts** | 4 | 4–5 (card-aware) / 5–6 (naive) | 3–4 (card-aware) / **9–10** (naive) | – | – | – | | |

**The earlier numbers check out**, if you assume ~40 s overnights. 4P reaches the Club in 4 shifts (they said 4–5),
the Orbital at ~123–127 min, and the ending at ~2 h 14–2 h 18. Shifts are 4, 6, then 7 minutes (day 1 is 240 s, day 2
is 360 s, every other day 420 s).

What the earlier numbers leave out:

- **Real overnights run longer.** A crew of 4 reads the report, argues over the shop, hits Ready, then waits the
  20 s countdown. That's 60–120 s, which adds 6–25 minutes to a run. Add human slack (a missed target here, a
  forgotten fee there, about one extra shift every other venue) and **a real casual crew of 4 takes about 2.5–3 hours
  to reach the ending.** That's two nights, not one.
- **2P is fragile.** A 2P crew that doesn't camp the kitchen sits at Tiered for 9–10 shifts, waiting on "Fill N deck
  orders". A crew that reads the card does it in 3–4. The pour-line fix helps, but the goal still needs one Rat to
  stand at the bar.
- **Solo Gary is all or nothing.** The solo warning is 60 s. The sign starts at mud 1.0 and alone takes ~55 s to hose.
  The cart starts at 1.0 too. My naive solo bot, which reacts to the warning, failed **11 visits in a row** (3–4 of 4
  stops) and never left the Muni, with "Gary will be back tomorrow" every day. The same bot passed on the first visit
  (with the Seal) once it hosed in the morning of a Gary day. The tomorrow line hints at this, but a solo player who
  misses the hint is soft-locked.

### 1.2 Where a Rat's shift goes (share of Rat-time, mean of 3 seeds)

| Activity | Muni 4P | Muni solo | Club 4P | Tiered 4P | Club solo | Tiered solo |
| --- | --- | --- | --- | --- | --- | --- |
| **Walking to balls (seek)** | **42%** | 29% | 18% | 13% | 21% | 26% |
| **Walking balls home (carry)** | **29%** | 13% | 10% | 3% | 2% | 7% |
| Driving the cart | 11% | 34% | 23% | 21% | 18% | – |
| Hosing (holding the wand) | 5% | 13% | 12% | 17% | 8% | 6% |
| Cooking / bar (incl. waiting for orders) | – | – | 12% | 21% | 19% | 22% |
| Diving (pond and creek) | – | – | 7% | 6% | 13% | 2% |
| Shooting at a bay | 0% | 0% | 0% | 4% | – | 19% |
| Cranking / filling the basket | 7% | 8% | 1% | 1% | 2% | – |
| Gary (huddle, waiting) | 3% | 1% | 1% | 1% | 1% | 1% |
| Knocked down | 1% | 0% | 1% | 1% | 0% | 0% |
| **Standing idle** | 0% | 0% | **13%** | **12%** | 17% | 16% |

The pick-up itself is instant (pick 1–2%), so **at the Muni the core verb is walking: 71% of a 4P Rat's shift.**
From the Club on, stations take over: the cart, the kitchen and the wand. "Idle" at the Club and Tiered is mostly the
diver standing on the creek bank getting their air back, plus Rats at the return with nothing in reach. The
bartender's wait counts under cooking: about **100–140 s of every 420 s Tiered shift standing at the bar** waiting for
the next order.

Field supply is never the problem. Fewer resting balls than Rats only 1–2.4% of the time, at every crew size.

### 1.3 What the Rats' own picking is worth late

`late.mjs`, 4P, seed 11, income per shift:

| | Normal | Rats never pick on foot | Rats never pick at all (no foot, no driven cart) |
| --- | --- | --- | --- |
| Stadium | $3.1M / $6.5M / $4.3M | $3.1M / $6.7M / $4.3M | $1.5M / $2.2M / $1.4M |
| County | $19.8M / $20.4M / $20.2M | $19.8M / $19.5M / $19.6M | $14.9M / $19.3M / $18.6M |
| Orbital | $100M / $99M | $97M / $101M | $89M / $114M |

**From the Stadium on, picking balls on foot is worth 0%.** From the County on, the whole crew picking is worth 0–10%,
which is inside the noise. Helpers, gutters, drones and the tether cover the supply. That's the pillar ("automate
what nobody wants to do") working as written. But it means the core verb is gone, and each late venue offers a 4-Rat
crew one or two jobs that matter: the lap, the ping, the Yards, the EVA.

### 1.4 Stakes late

- **The gauges never bite.** In every Stadium shift I ran, Crowd Sentiment read 0.98–0.99 at 1:30, at 1:00 and at
  the bell, even with only the autopilot lapping. Zoning at the County read 0.73–1.00 and always recovered by the
  bell. Every Stadium and County shift I ran was APPROVED (about 40 shifts, 1P and 4P, 3 seeds each), as were all of playtester C's ~40.
- **The fees never bind.** 4P cash at the promotion was $16–26M against a $6.6M Stadium fee, and $70–81M against a
  $33M County fee. At the Orbital the crew holds $136–238M with one row left to buy.
- **Purchases dry up.** The 4P bots bought ~20 things over 4 Muni shifts (~5 a shift), ~10 over the Club, 3 at
  Tiered, 3 at the Stadium, 2 at the County, 1 at the Orbital, then the Owner rows.
- **Endless is flat.** Income ran $97–106M a shift. "NEW record" came up on 2 of 4 shifts, and ±5% noise decided it.

### 1.5 How often something new arrives (4P, 60 s overnights)

| Stretch | Minutes | New things (mechanics, items, venues) | Rate |
| --- | --- | --- | --- |
| Muni day 1 | 0–4 | Pick, bank, the wand and the sign, the shop | 1 a minute (the checklist paces it) |
| Muni days 2–4 | 5–28 | The free teenager, the washer and crank, ads, the fan nozzle, the basket, the Clean % target, Last Call glow, the cleanup minute, the morning deal; gold balls, the cart, Hit the Cart, the field return, "on the green"; Gary's intro, visit, huddle and chat, the turbo nozzle | **~1 every 1.5 min** |
| The Club, first 1–2 shifts | 28–43 | The reveal, the kitchen (fries, dogs), FED, the peeler and the conveyor, the pond, scuba and buddy pump, treasures, **lead, bouncy, square and gold balls (all four debut 2–13 s into the first Club shift)**, the bucket machine, the back return, the industrial washer, the creek dive, MOW-E, covered bays, the splitter | **~14 in one shift and a bit** |
| The Club, the rest | 43–60 | Nothing new; save the fee, hit the target | 0 |
| Tiered | 60–84 | The greens and the landing ring, Bay Utilization, the Upper Deck (beer, orders, mugs, falls), the Deck Cam, the Glow Rush, the gutters, the foam cannon | ~7 in 3 shifts: about right |
| The Stadium | 84–108 | The Ping Track, laps, Crowd Sentiment, the second cart, autopilot | ~4, all "the cart, again" |
| The County | 108–132 | The Yards, strays, Zoning, drones, "Drones, here!" | ~4, all "walk further" |
| The Orbital and the ending | 132–143 | The Lift, the EVA, the O2 crank, debris, the tether, Ball No. 1, the Last Bucket | ~7 in 10 minutes: a spike |
| Endless | 143+ | The Owner rows | ~0 |

That's about 44 introductions in the first 2 hours, one every ~2.7 minutes on average. The average hides the shape:
**overload at minute 28, a 15-minute drought straight after, and from minute 84 a long run of variants on verbs the
crew already has.**

---

## 2. The core loop

**Is "walk, pick, walk home, bank" enough to carry 2+ hours? On its own, no, and the game rightly doesn't ask it to.**
At the Muni it's the whole job (71% of a Rat's time is walking), and it works for about 30 minutes for three reasons:
the gear ladder changes how it feels every shift (3 → 8 → 25 → 60 balls, then the push picker scoops what you walk
over), the field return halves the walk home, and the cart turns it into mowing. After that the game rightly hands
the verb to automation.

What it lacks is **feel feedback on the most common action**. PowerWash Simulator's verb is less exciting than
picking balls, but it never stops paying out: dirt peels in real time, every object pings when done, and a progress
bar fills. Range Rat's hosing already has that shape, with patches, sparkle, "Spotless!" and "+$0.05 a ball", which is
probably why testers like it. Picking doesn't: a ball disappears, a count goes up, and the walk home is silent. There's
no streak, no sound that climbs, and no "field clear" moment until the walk-off's "142 left out there".

**The second-order verbs** are hose, crank, fill, drive, cook, dive (with a buddy on the pump), shoot (Hit the Cart,
greens, TARGETs), pour, lap, walk the Yards, the EVA, chatting with Gary and the huddle. That's a big, varied set, and
it rotates well **within** a venue: a 4P crew at the Club splits naturally into driver, cook, hoser and diver (§1.2).
Two weaknesses:

- **Too many of them are "hold a button at a station"**: crank, fill, chat, huddle, pump, clock out, the bar wait.
  Overcooked has hold-to-chop too, but there it's under an order timer and you're juggling three of them. Here nothing
  is on a clock, so holding is just waiting.
- **They rotate badly across venues.** Each late venue swaps the whole job list for one new chore, while the early
  verbs are bought out. By the County, a crew of four has one Yards walker plus Gary days.

---

## 3. The pacing curve

A rough intensity and novelty chart for a 4P crew (█ = a lot, ▌ = a little):

```
              Muni     Club      Tiered   Stadium  County   Orbital  Endless
minutes       0–28     28–60     60–84    84–108   108–132  132–143  143+
novelty       ████▌    █████▌▁▁  ███▌     █▌       █▌       ████     ·
stakes        ██▌      ██        ███      ▌        ▌        ███▌     ·
shop choices  █████    ███       █▌       █        ▌        ▌        ▌
who's busy    4 of 4   4 of 4    4 of 4   2–3 of 4 1–2 of 4 4 of 4   1 of 4
my rating     8        7         8        5        4.5      9        3
```

- **The early ramp (Muni) is the best-paced stretch.** A new thing every 1.5 minutes, the shop growing by day, Gary
  as a set piece on day 4, and a clean promotion at ~28 minutes. The day-1 checklist and the "one idea at a time" rule
  are textbook. Keep it.
- **The mid-game starts with a firehose.** The Club opens with the kitchen, the pond, the creek, four new ball kinds
  in 13 seconds, treasures and the mower all at once. The owner's own rule ("one idea at a time") is broken at the
  exact moment the game most needs it. Then come two shifts of saving for the fee with nothing new. Tiered is paced
  well: the deck is the best mid-game joke, and the Glow Rush gives the dusk a buzzer-beater.
- **The late game sags from about minute 84 to 132.** The Stadium and the County are 6 shifts and 45–50 minutes in
  which:
  - nothing can fail: the gauges read 0.9–1.0 and there have been 0 DENIEDs in ~80 shifts across two testers;
  - money doesn't matter: the fee is covered 2.5× and there are 2–3 purchases a venue;
  - the core verb is economically dead (§1.3);
  - the new verbs are "the cart in an ellipse" and "a longer walk".

  The scorecard agrees: C's Pacing fell to 6 in round 5, and "Stadium/County play like the Club with bigger numbers"
  has been in every C report since round 1.
- **The ending is the best 10 minutes in the game, and it's too short.** One Orbital shift plus three minutes. The
  Lift, the EVA and "BALL NO. 1 IS DOWN · follow the beam" are the moments people will retell, and they get the
  least time of any venue.
- **Endless has no pull.** Income is flat, the record is a coin flip, there's no card and no mutator.

**Is ~2 h 15 (really 2.5–3 h) right for a casual crew of 4?** The total is fine; the distribution is wrong. As a
two-night campaign, 2.5 hours is a good length for a party game (an Overcooked world, or a Lethal Company night that
runs long). But I would take **15–20 minutes out of the Stadium and County** and give **5–10 to the Orbital**. A game
that peaks at 2 h 10 after a 45-minute plateau asks too much of a casual crew. A game that ends at ~2 h with a
20-minute finale leaves them wanting more.

**Shift length (7 minutes) is right.** It's longer than an Overcooked level (3–5 minutes) and much shorter than a DRG
mission, which suits a game where you build up a field and then sweep it. The 4- and 6-minute first days are a good
ramp. What's wrong is that **19 shifts share one template.** Gary days are the only texture, and Stardew, Lethal
Company and DRG all show that daily variation is what keeps a fixed-length day fresh (§8, #3).

---

## 4. Things to do

**Is there always a meaningful choice for each of 4 players?**

| Stretch | 4 players | 2 players | Solo |
| --- | --- | --- | --- |
| Muni | Yes: picker, cart, hoser, cranker or filler. All four matter (the Clean % decides the target). | Yes | Yes, maybe slightly too much: Gary needs morning prep the game only hints at (§1.1). |
| Club / Tiered | Yes, and the best stretch for roles: driver, cook/bartender, hoser, diver, shooter. The bartender idles ~30% of the shift between orders. | Too much: the card's cook goals need someone camping the kitchen, and a naive 2P crew stalls 9–10 shifts at Tiered. | Busy, but OK (3/3) |
| Stadium | 2–3 jobs: lap, ping, maybe a picker who adds nothing (§1.3) | Fine | Fine |
| County | 1 job (the Yards walker) plus Gary days. **2–3 idle Rats.** | Fine | Fine |
| Orbital | Everyone takes a turn on the EVA, a buddy cranks the O2: great | Great | Great |

**How roles emerge:** from stations, which is the right model ("no assignments" is a good pillar; Overcooked and
PowerWash do the same). Two things undercut it:

- **Stations that make you wait.** The bar, the creek bank, the huddle. In Overcooked you never stand at a station
  with nothing to do: there's always a plate to wash. Give every station a "while you wait" job.
- **Late venues that need fewer people than the early ones.** Lethal Company works at 4 because the job grows with
  the crew (more to scavenge, more danger, someone must run the ship). Range Rat's late jobs don't grow with the crew;
  automation shrinks them.

**Too much for 1–2 players?** Mostly no. The goal-card scaling (×0.4 solo, ×0.6 2P) is sound. The two exceptions are
solo Gary at the Muni and the cook goals at 2P. Both are the same failure: **a goal that needs one Rat to stay at
one place for a long time**, which a small crew can't spare.

**Compared with the reference games:**

- **Overcooked:** constant pressure, a star grade every level, and a new gimmick every level. Range Rat has the
  level length but not the grade or the gimmick.
- **PowerWash Simulator:** the verb is its own reward. Range Rat's hosing gets there; picking doesn't.
- **Lethal Company:** an escalating quota, real danger, and roles that grow with the crew. Range Rat's knockdowns are
  its Lethal-style comedy and are underused (1% of time).
- **Deep Rock Galactic:** mission variety and mutators, plus the "Rock and Stone" ritual. **The Gary huddle is Range
  Rat's ritual, and it's a good one.**

---

## 5. Goals and progression

**Short-term goals (within a shift):** good. The Clean % bar with a red tick, the morning deal, the Last Call rally
and "N left out there" give every minute a nearest target. The Board's one price with its chips reads well.

**Medium-term goals (the card):** a big improvement on stamps. It answers "how do I move up?" in one look, and the
playtests show it. Three structural issues:

1. **The card is lopsided in time.** The feature goals land on venue day 1–2 (measured: the Club's FED on day 1, the
   treasures on day 2; Tiered's TARGETs and gutters on day 1, the orders on day 2), and the purchase goals tick on day
   1 at 4P. The day count is set by "Hit the daily target 3×", which by construction lands at the **third bell**.
   Clocking out early can't fire that day, because `canClockOut` needs a done card and `reviews` only ticks in
   `endShift`. So at most venues the last shift is a guaranteed formality, and clocking out only rescues the rarer
   "waiting on the fee or Gary" day. The playtesters' shared complaint will survive the fix.
2. **"Hit the daily target" never fails** from the Club on (every late shift HIT). A goal that can't fail isn't a
   goal; it's a timer.
3. **The ✦ rewards (50 × BV) don't feel like anything late.** $400k at the County, when the crew holds $80M.

**Long-term goals:** Balls Outstanding counting down to the Last Bucket is a lovely spine. It's a single absurd number
that tells the story. But nothing between the venues accumulates: no lifetime stars, no collection apart from the
treasure case, no cosmetics, no record that persists.

**Is the economy legible?** Within a venue, yes: "$2.62 a ball" and the bar finally make sense. Across venues the
numbers inflate about ×5–10 per venue (income a shift ~$4k → $50k → $600k → $5M → $20M → $100M), and by the Stadium the
crew can't feel the difference between $6M and $16M. That's normal for an incremental. But incrementals keep big
numbers meaningful by **spending constantly**, and Range Rat's spending falls from ~5 purchases a shift to under one.
The original design promised **range expansions** ("built overnight and shown off the next morning"). They were never
built, and they're the missing money sink.

---

## 6. Session structure

A group plays one night. With 60 s overnights at 4P:

| Stop point | Minute | What it feels like |
| --- | --- | --- |
| Promotion to the Club | ~28 | A strong stop: Gary passed, the reveal. Too early for a night. |
| Promotion to Tiered | ~60 | **The ideal 60-minute night.** Ends on the Tiered reveal. |
| Promotion to the Stadium | ~84 | **The ideal 90-minute night.** The deck, the Deck Cam, a Glow Rush save. |
| Promotion to the County | ~108 | Weak: the Stadium was samey. |
| Promotion to the Orbital | ~132 | – |
| The ending | ~143 | A great finale, but only if night 2 survives the sag. |

**Night 1 has a satisfying arc**, in 60 or 90 minutes: tutorial → Gary → the Club reveal → the kitchen and diving →
the Tiered deck. **Night 2 opens on the weakest 45 minutes in the game** and only then reaches the best 10. That's
backwards. Night 2's first 15 minutes decide whether the crew comes back for night 3.

**Reasons to come back:** the save and the crew code work (saved every shift). Missing:

- **A "previously on" card** for a returning crew. The goal card half-does this.
- **An end-of-night recap** at a promotion ("Stop here? Here's your night"), with per-Rat awards.
- **Anything after the ending.** With no card, flat income and nothing to buy, the save is done after the Last
  Bucket. That's acceptable for a 2-night campaign, but a campaign that cheap to extend (§8, #10) shouldn't stop there.

---

## 7. What the in-house process can't see

The agent playtests and the council are thorough on rules, bugs and text. They're structurally blind to:

1. **Feel.** 71% of the Muni is walking. Is walking in first person on a pad on a 4K TV pleasant for 30 minutes?
   Does sprinting on L3 with stamina feel like a chore? Is pressing Ⓐ near a ball satisfying or fiddly? No bot can
   answer that, and it's the most-used verb in the game. The README's Xbox frame-time table is still "_todo_": a
   choppy frame rate on the target device turns walking into a chore.
2. **Social fun.** The funniest things in this game are probably knocking a friend flat with a crew-bay ball, the
   deck fall and the huddle. Bots knock each other down 1% of the time by accident; humans will do it on purpose. Does
   the game reward it, or punish it (spilled pockets) so hard that people stop? The council never asks "what will
   four friends laugh at?"
3. **Herding.** Bots split jobs perfectly. Humans all run to the new toy (the cart, the dive, the Lift) and leave the
   basket empty. The game's soft fail states hide this; a real night will show it.
4. **Menu time.** "The shop is open any time, and the range keeps going" means a Rat in the shop is idle, and on a
   pad that can be minutes. The bots buy instantly.
5. **Fatigue.** Bots don't get bored on shift 14. The scorecard's "One more shift" (6.0–6.7 for five rounds)
   is the metric to watch, and agents are poor judges of it.
6. **A closed loop.** The same model family designs, builds, plays and scores. The Overall has sat at 6.8 for two
   rounds while the systems grew. That plateau says the next gains won't come from another council round. They'll
   come from one real 4-player night, recorded with `?pace`, with someone noting when people laughed, shouted, and
   reached for their phones.
7. **What the bots measure.** They measure throughput, not **decision density** (how often a player faces a real
   choice). I'd add that as a scorecard metric: "In the last minute, did I choose something?"

---

## 8. Top 10 recommendations, ranked by fun per effort

Effort: XS < a day, S a few days, M a week or two, L more.

### 1. Cut the late plateau: "Hit the daily target 2×" at the Stadium and the County (cut) · XS

- **What:** in `goals.js CARDS`, set `reviews` to 2 at venues 3 and 4. Keep every feature goal.
- **Why:** that's 2 shifts and ~16 minutes out of the flattest 48 minutes in the game, and the Last Bucket lands at
  ~2 h 0–2 h 05 at 4P. Council 10 kept 3× to "hold the pace", but here length is the cost, not the benefit. Nothing
  late fails, so the third day is a timer. Check that "Drive 20 laps" (scaled) still lands in 2 shifts; a human who
  drives for it does it in 2–3.
- **Risk:** low. Lower cash at the Orbital doesn't matter, because nothing there costs money. If the owner wants the
  minutes back, spend them on #10's Orbital day, not on the County.

### 2. Promotion Day: the last good day is an event with stakes · S

- **What:** when a card is one review short with every other goal done, tomorrow's memo says "Promotion Day. Regional
  is watching." It uses the existing Gary-and-Seal machinery: Gary rides along the whole shift, the target tick moves
  up 10 points, and the Board shows PROMOTION DAY. Pass at the bell and the crew signs on the spot, with confetti and
  a PA. Fail, and it simply comes again tomorrow.
- **Why:** it turns the measured dead day (§5.1) into the venue's climax, every venue, for one reused system. Overcooked
  ends each world on a harder level; Lethal Company's quota day is the night everyone remembers.
- **Risk:** a crew that fails twice gets frustrated. Cap it: the second attempt drops the extra 10 points.

### 3. Corporate's "Today": one daily modifier from Muni day 5 · M

- **What:** the morning memo deals one modifier, as one line and one Board chip. Some examples, each using systems
  that already exist:
  - **Windy:** the foam balls drift.
  - **Rain:** mud ×2, glow from 2:30.
  - **League Night:** the upper deck is full and orders come ×2.
  - **Junior Clinic:** short beginner shots (`launch` already has `beginner`), lots of balls near the mats.
  - **Celebrity at Bay 5:** pays ×3, aims at Rats.
  - **Ball Shortage:** the basket holds 6.
  - **Night Range:** glow balls all day.
  - **Gary's Boss:** six stops.

  No modifier on Promotion Day (#2) or on Gary days.
- **Why:** it's the single biggest lever against "19 shifts, one template". DRG's mutators, Lethal Company's moons and
  weather, and Stardew's weather and festivals all exist to make day N+1 feel different from day N without new
  content. It also gives each late shift a reason to re-plan.
- **Risk:** balance (keep each within ±15% income), test load, and the one-text rule (a memo line plus a chip only).
  Start with 4 modifiers and see whether the crew talks about them.

### 4. Give picking feel: the sweep · S

- **What:** balls picked within 1.2 s of each other build a sweep counter by your crosshair ("×14"), with a pickup
  sound that climbs in pitch and a small bonus when it ends (+1% of Hustle, or simply a toast at ×25: "Clean sweep!").
  At the bank, the pipe-ball roll is already there; make it rattle louder with a big pocket. At the bell, 0 balls left
  pays a "SPOTLESS RANGE" stamp on the report.
- **Why:** it's the most-used verb in the game (71% of the Muni). PowerWash Simulator proves a dull verb carries hours
  with continuous feedback, and Katamari proves "more at once" is its own reward. It's cheap, client-side juice.
- **Risk:** audio fatigue. Keep it quiet and short, and off below ×5.

### 5. Stagger the Club, one idea a day · S

- **What:** give Club rows and debuts a `minVenueDay` like the Muni's `minDay`:
  - **day 1:** the kitchen and FED;
  - **day 2:** the pond, the buddy pump and the first treasure;
  - **day 3:** the creek dive, the Back return and MOW-E.

  Spread the four new ball kinds over days 1–3 (lead with the pond). The card's treasure goal already needs day 2.
- **Why:** it fixes the ~14-things-in-one-shift dump and the 15-minute drought after it, using the owner's own rule
  ("one idea at a time"), which works brilliantly at the Muni.
- **Risk:** low. Check the 2P/solo cook goals still land; FED is day 1 anyway.

### 6. Make late gauges bite · XS–S

- **What:** at the Stadium and the County, decay the venue gauge so an unattended gauge crosses its line in ~90–120 s
  (today it sits at 0.9–1.0 all shift). Add one visible consequence mid-shift: below the line, customers leave (the
  crowd boos, Zoning sends a van).
- **Why:** the late game has 0 failure in ~80 measured shifts. Overcooked's order timer is what makes four people
  shout at each other. One gauge that needs tending gives one Rat a real job at each venue and gives "Hit the daily
  target" meaning.
- **Risk:** frustration at 1–2P. Scale the decay with crew size, as the goal counts already are.

### 7. Stations never make you wait · S

- **What:**
  - **The bar:** let deck orders queue (up to 3, each with a 20 s timer), and let the bartender pour ahead (one mug
    stays cold for 30 s).
  - **The creek bank:** "catch your breath" refills while you walk to the next snag, not while you stand.
  - **2P cook goals:** "Fill N deck orders" counts a beer anyone pours, and the kitchen hands a full tray to whoever
    walks past.
- **Why:** the bartender idles ~30% of the shift, and naive 2P sits 9–10 shifts at Tiered. Overcooked's lesson is
  that downtime at a station should become prep. That turns waiting into a juggling choice.
- **Risk:** more beer means more falls. Keep the deck's existing drink limits.

### 8. End-of-night recap and awards · S

- **What:** at every promotion report, a "Good place to stop" button opens a night card. It shows minutes played,
  balls, knockdowns, the deck falls, and one award per Rat, drawn from stats the server already keeps: most
  knockdowns dealt, Fry Lord, Deepest Diver, Most Sprayed, "Talked to Gary the longest". When the crew returns,
  "Previously on Range Rat" shows the same card plus the next goal.
- **Why:** it makes the natural stopping points (~60 and ~90 minutes) feel like an ending, not an abandonment, and
  gives the returning night a hook. End-of-game awards are the cheapest social glue in party games (Mario Party,
  Jackbox, Fall Guys). It also rewards hitting your friends, the game's comedy.
- **Risk:** text load. It's a report-card variant, not centre text, so the one-text rule is safe.

### 9. One hands-on job per late venue that grows with the crew · M

- **What:** a ball kind or chore at the Stadium and the County that only Rats can do and that scales with how many
  are doing it. Two ideas:
  - **Stadium, "Souvenir balls":** gold-ringed balls that must be carried to the crowd rail, not the return. They
    feed Crowd Sentiment, and a relay between two Rats doubles it.
  - **County, "Hazard balls":** drones refuse them; they need two Rats with the wand (one sprays, one bags).

  Keep the same 2-person shape as the dive buddy pump, which testers consistently love.
- **Why:** from the Stadium on, foot picking is worth 0% (§1.3), and the County has 2–3 idle Rats. DRG gives every
  class a tool that matters, and Lethal Company's work grows with the crew.
- **Risk:** scope and complexity. Do it after #1 and #6 and only if the late game still sags in a real playtest.

### 10. Spend the saved minutes on the Orbital, and give endless contracts · M

- **What:**
  - **The Orbital:** make it 2 full shifts plus the finale. The council-round-5 idea already on file fits: each piece
    of debris counts 10 balls toward Balls Outstanding, so the EVA races the countdown. The EVA is the best minute in
    the game, and it currently gets one shift.
  - **Endless:** replace the yesterday race with a contract board. Each morning, pick one of three Today modifiers
    (#3), each with a 1–3 star goal; stars add up to a lifetime count shown on the arch, and every 10 stars unlocks a
    Rat cosmetic (hats, a cart paint).
- **Why:** move playtime from the weakest stretch to the strongest. Overcooked's stars and PowerWash's bonus jobs give
  a finished campaign a second life for little new content.
- **Risk:** cosmetics are new art (keep them to recolours and hats). Contracts depend on #3.

**Also consider (cheaper or narrower):**

- **Solo Gary at the Muni:** start the sign and the cart at Gary's pass line on a solo Gary morning, or make the solo
  warning 90 s. Today a solo Rat who reacts to the warning can't pass, and loops "Gary will be back tomorrow" forever.
  XS.
- **Simplify the price stack.** A ball's pay is now BV × Hustle × Gary's Seal × FED × gear grime, with the Clean %
  inside BV. Each chip is defensible; together they're a spreadsheet. If one has to go, fold grime into the Clean %
  ("muddy boots" makes you dirtier, not cheaper). XS–S.
- **Range expansions** (the original design's money sink) would fix late money, but they're L. Revisit after a human
  playtest.

---

## 9. What I'd test on the first real 4-player night

1. Minutes per venue with `?pace`, against this table. I expect 30 / 35 / 28 / 28 / 28 / 12.
2. When people reach for their phones. I'd bet on Club day 3–4 and Stadium day 2 onward.
3. What they laugh at. I'd bet on knockdowns, the deck fall, Gary's chat bubble and the EVA.
4. Whether anyone feels the walking (71% of the Muni) as fun, neutral or a chore.
5. Whether night 2 happens at all, and how long after night 1.
