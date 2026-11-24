# Fun Council, round 4: the last mile

This is the record of Range Rat's fourth Fun Council (November 2026). Rounds
1–3 (`design/council-round1.md` … `council-round3.md`) stay binding wherever
this record doesn't change them. Where they disagree, this record wins.

**What the owner set for this round (binding):** a fully working, pretty
automation game that's fun, not too hard, and **essentially done**; every
feature worth it; venues 2–5 each get a live KPI, a chore, a toy and a map
change, and each must *feel* different; at Tiered, **overserving beer makes a
customer fall off the top row** as a penalty; night one for a casual crew of
four has to be fun.

**The owner's firm calls (unchanged):** multiplayer first, no assigned roles; one day = one shift;
knockdowns when hit by a ball; scuba is cool and fancy; no named balls; rare
absurd PA lines only on big events; the inside jokes (power washing, peeling
potatoes → the kitchen with fries, hot dogs and beer); the shop opens any
time (Tab / D-pad up); sprint; controller support.

**The council.**

| Seat | Lens |
| --- | --- |
| **Game Designer** (G, chair) | Moment-to-moment fun; does each venue play differently? |
| **Systems/Economy Designer** (E) | Numbers: income per shift, prices, KPI scales, quotas |
| **Multiplayer/Co-op Designer** (M) | Four people splitting up and regrouping, solo still working |
| **Level Designer** (L) | Readable spaces, routes, piles, callouts, one map rule per venue |
| **Technical Director** (T) | Buildable well: server-authoritative, zero npm deps, new files over core edits, Xbox frame time |
| **Casual Crew of 4** (C) | Four friends on a sofa, some on Xbox pads in Edge, first night, no manual |

Ties go to the chair.

**What the council read:** `design/game-design.md`; round 3 §1, §6, §7; the
code (`sim.js`, `crew.mjs`, `map.js`, `dive.js`, `venues.js`, `menu.js`,
`mowe.js`, `customers.js`, `main.js`, `round2.js`, `board.js`,
`settings.js`, `scuba.js`, `kitchen.js`); and the test run.

**State at the start of the round:** round 3 items 1–7 are built, and so is
item 13 (settings and first-time hints, commit `79f3170`, landed while the
council sat). `node --test test/` passes **396 of 396**.

---

## 1. The 1.0 checklist, re-scored against the code

Legend: ✅ built · ◐ partly built · ☐ missing. "Round 3" is the previous
score.

### A. The ladder is real

| Item | Round 3 | Now | Evidence and what's left |
| --- | --- | --- | --- |
| Promotion, franchise agreement, reveal, write-offs, titles | ✅ | ✅ | `promote()`, `VENUE_RULES` |
| The Last Bucket, end card, endless | ✅ | ✅ | `beginLastBucket`, `depositOne` |
| Each venue has its full seven | ◐ | ◐ | Muni ✅. **Club ✅** (water on, MOW-E, pond, hot dogs, Pond Clarity live). Tiered ◐ (beer and the scooter only). Stadium, County, Orbital ☐: rate, write-off, title, PA and a dressing group in `venues.js`, but no KPI, chore, toy or map rule. The shop has **nothing new to buy after the Club** except the dive scooter |
| Endless has a target (the record-pace line) | ☐ | ☐ | `startShift` sets `quota = null` in endless; the Board shows `TARGET --` |

### B. Every feature earns its place

| Item | Round 3 | Now | Evidence and what's left |
| --- | --- | --- | --- |
| Round 3's cuts done, no dead paths | ☐ | ◐ | Foam, peel, the old swing meter, `KIND_DEBUT`, `loadsSince`: gone. **Left:** the server's `wash(…, 'self')` exists but the client never sends `'self'`, so solo grime can't be cleared mid-shift |
| Every station names its verb and payoff | ☐ | ◐ | The washer, dock, tube and kitchen do. The wand still says "Hold Ⓐ to spray **the cart**" when you're aiming at the sign |
| Every shop row changes something visible in one shift | ☐ | ✅ | Every row through the Club does. (Tiered+ has no rows; that's A) |
| Nothing the player is told about is impossible | ☐ | ◐ | The wand works without a cart. **Left:** Gary's mats check counts all 10 mats, so solo (6 mats) must wash 4 mats nobody uses |

### C. The map

| Item | Round 3 | Now | Evidence and what's left |
| --- | --- | --- | --- |
| The Muni field is Dimple Creek | ☐ | ✅ | `map.js`, `terrain.js`, drift to the Delta and the Grate |
| Each venue adds exactly one map rule | ☐ | ◐ | Muni and Club ✅; 2–5 ☐ (§3) |
| Every landmark is a callout a new player uses | ☐ | ◐ | Landmarks exist and CCTV labels them, but MOW-E announces **"LANE z −132"**: a coordinate, not a callout |

### D. The first hour

| Item | Round 3 | Now | Evidence and what's left |
| --- | --- | --- | --- |
| Day 1 ≤ 4 min, teaches pick/bank/Board/shop/wand | ☐ | ✅ | `shiftSecsFor`, the clinic, clock-in, the nudge |
| Days 1–8 each introduce 1–2 new things | ☐ | ◐ | Built per round 3 §6.2; unverified without a pace log |
| The Club at minutes 30–42 (4P) and 35–45 (solo) | ☐ | ☐ | **Unmeasured.** There is no pace log (`?debug` only exposes `window.rr`) |

### E. Multiplayer

| Item | Round 3 | Now | Evidence and what's left |
| --- | --- | --- | --- |
| 4 distinct jobs from day 3; ≥ 3 regroups a shift | ◐ | ✅ | Clock-in at the yard, Gary's huddle, the bell; Club adds diver, pit crew, MOW-E |
| Solo works: every chore automates by its venue's 3rd day | ◐ | ◐ | Picking, crank, cooking, mats, pond ✅. Grime has no solo cure (B) |
| Late join, reconnect, 6 players, resume after deploy | ◐ | ◐ | New Hire Kit, rejoin, v3 save ✅; the 6th colour is teal ✅. A mid-shift joiner gets no "where am I" line |
| Customers come and go, refuse filthy mats | ☐ | ◐ | `customers.js` built. But morning mats are mud **0.85**, under the refusal line of **0.9**, so the first refusal arrives minutes later and reads as random (§2.1) |

### F. Controller and TV

| Item | Round 3 | Now | Evidence and what's left |
| --- | --- | --- | --- |
| Every verb works on the pad | ✅ | ◐ | **Cranking and pumping need Ⓐ held while circling the right stick: one thumb, two controls** (§2.5) |
| Settings: volumes, PA mode, look sensitivity, invert Y | ☐ | ✅ | `settings.js`, Pause → Settings |
| First-time hints: shop, sprint, CCTV | ☐ | ✅ | `createHinter`. The shop hint now fires twice (the hinter at 10 s *and* the `$20` nudge in `hud()`) |
| HUD fits one line; toasts prioritised | ☐ | ✅ | `BV · target · gear`, the 3-line feed |
| Text big enough on a TV | — | ☐ | No text-size setting; the feed is 0.8 em |

### G. Feel and performance

| Item | Round 3 | Now | Evidence and what's left |
| --- | --- | --- | --- |
| Diving looks like a highlight | ✅ | ✅ | |
| Diving plays like one | ☐ | ◐ | Deep End, gear ladder, pump and haul, treasure, tube, pump: all built and tested. Unplaytested |
| Xbox ≤ 20 ms a frame, measured | ☐ | ☐ | Not measured. `renderer.setPixelRatio(min(dpr, 2))` and full shadows on Xbox |
| Audio mix pass | ☐ | ◐ | Volume sliders exist; no ducking pass; the ambience crowd level is a constant 0.6 |

### H. Quality

| Item | Round 3 | Now | Evidence and what's left |
| --- | --- | --- | --- |
| Tests for every rule | ◐ | ✅ | 396 tests, with map, scuba, mower, customers and settings suites |
| Save v3, v2 migrates | ☐ | ✅ | `toSave()` is v3; `cleanDive`, `cleanLostFound` |
| `make preflight` green, no console errors in 60 min | ☐ | ☐ | Unverified |
| `game-design.md` and README current | ☐ | ◐ | `game-design.md` has the round-3 section. **The README is stale:** "lead from day 4", "hold to wind up", "Next: the potato line" |

**The score:** 12 ✅, 14 ◐, 5 ☐ (31 items), against round 3's 4 ✅. The ☐s that matter
most: **venues 2–5 are hollow, the Xbox is unmeasured, the pace is
unmeasured.**

---

## 2. Audit of what round 3 built

The owner's test again: is it worth it, is it meaningful, will a player find
it, does it duplicate another loop? Every finding has a fix and goes into
build item 1 (the fix pack) unless noted.

### 2.1 Customers (`customers.js`, `crowd.js`)

**Verdict: keep, tune two numbers, and add one state.** Watching a customer
walk in, grab a bucket and hit it answers "where do balls come from?" in ten
seconds. That's the feature working.

| Finding | Why it hurts | Fix |
| --- | --- | --- |
| Morning mud on 5 mats is **0.85**; customers refuse at **0.9**. The early bird plays the filthy mat; the *next* customer refuses minutes later | Cause and effect are minutes apart, so nobody connects "dirty mat" to "lost customer" | Morning mats start at **0.95**. `openShift` seats no early bird on a mat at ≥ 0.9. Instead a customer **waits** on the walkway behind it (new state `wait`, at `APPROACH_Z` 2.2, arms crossed) for up to **25 s**. Hose the mat under **0.6** and they step on; otherwise they sulk and leave as today (30 s empty). Feed line: *"A customer is waiting for a clean mat (Mat 4)."* |
| Mats have no names, so "Mat 4" isn't a callout | The waiting customer needs a callout | Paint **1–10** on the mats' back edge (`scenery.js`, a canvas decal) |
| Gary's `inspect('mats')` counts all 10 mats | Solo uses 6; morning mud lands on any of 10, so solo washes mats nobody plays | Count only `i < activeMats(online)` |
| The Club bucket is **50 balls**. At 8 s a ball that's 400 s, nearly the whole shift | At the Club without ads, nobody sees a customer leave | `BUCKET_CLUB` **40**. With ads it's still a turnover every 3–4 min a mat |

### 2.2 MOW-E (`mowe.js`)

**Verdict: keep.** The windrow is a co-op gift to the driver, and the telegraph
reads. Three problems:

| Finding | Fix |
| --- | --- |
| The warning names a coordinate: "MOW-E · LANE z −132". Nobody knows where z −132 is | Name lanes after landmarks: the Board reads **"MOW-E · BY THE TRACTOR · 0:12"**, and so does the toast. Add `LANE_NAMES` to `mowe.js` |
| Lane **−148** drives through Dimples Rock (34, −150, r 2.2). At Tiered, lanes **−132** and **−148** cut through Bowl C (−6, −140, r 9) | `LANES` becomes **[−24, −36, −120, −156, −166, −178]**, named *the Short Grass*, *Short of Red*, *the Tractor*, *the Rock*, *the Long Grass*, *the Back Net*. They clear the rock (≥ 3.8 m), the tractor (≥ 7 m) and the bowls; −36 still skims the creek mouth at the left net, as today |
| From the yard, a 4 m striped decal 130 m away is a few pixels | Two **4 m orange-and-white cones** at x ±64 on the lane during the warning (`mower.js` view) |

### 2.3 The kitchen menu by venue (`menu.js`, `kitchen.js`)

**Verdict: keep, and give beer a real job.** The hot dog has one (Gary eats
it). But by the Tiered venue, the **fry conveyor** ($2,000 at the Muni) makes a
basket every 3 s, about 140 a shift, against customers eating about 190. So
**nobody needs to cook at Tiered at all**, and a beer-overserving penalty
would never fire. The fix is §3.1's Upper Deck: from Tiered on, **beer pays a
bar tab in cash**, and overserving is the brake on it. That re-hires the cook
at Tiered as a deliberate choice, with a real risk.

Also: the Muni shows one item and locked COMING SOON cards. Keep that; it
reads as a promise, not a choice.

### 2.4 Dimple Creek (`map.js`, `terrain.js`)

**Verdict: keep.** It works, and it gives later venues somewhere to put their
map changes. Small items:
- `map.js` line 14 still says `SIM.FIELD` is ±150; it's ±64. Fix the comment.
- The Grate at (63, −114) sits on the right net. County (§3.3) drops that
  net, so the Grate becomes a **culvert** in the kerb and its pile stays put.
- Every venue map change below lives in `MAP` (round 3 note 2: one table).

### 2.5 Scuba v2 (`dive.js`, `scuba.js`)

**Verdict: keep. It's the best-looking minute in the game.** One real bug and
two tunings:

| Finding | Fix |
| --- | --- |
| **Pad: crank and pump mean holding Ⓐ while circling the right stick.** Both are under the right thumb. On a TV with a pad it's a claw grip, and the owner's sofa crew will drop it in five seconds | **Latch on the pad.** Tap Ⓐ to grab the handle (or the pump); circle **either** stick (movement is frozen while you're `capturing()`); tap Ⓐ or Ⓑ to let go. Mouse stays hold-and-circle. The "hold without rotating" trickle stays as the accessibility path. Files: `round2.js` (`press`/`release`, `feedStick(pad.lx, pad.ly)` too), `main.js` (`pressAct`) |
| `TREASURE` gives the 1958 scorecard `minVenue: 2`, and the comment says "2 = County and up". 2 is **Tiered** | Set **4** (County), as round 3 §4.4 says |
| The finder's fee is 200 × BV: about $6,600 at the Club, roughly a quarter of a 4-player shift | Keep. It's the "most memorable minute" and it's capped at one a shift |
| The dive scooter, $40k personal at Tiered, is about a quarter of one Tiered shift | Keep. It's a treat, not a gate |

### 2.6 The pacing changes

**Verdict: keep.** Day 1 is 240 s, the clinic halves carries, clock-in works.
- **Two shop hints.** `createHinter`'s `shop` fires at 10 s of play, when the
  crew has $0 and can't buy anything; then `hud()`'s nudge fires again at
  $20. Make the hinter's `shop` condition `cash ≥ 20`, and delete `nudged`
  from `hud()`.
- **The wand prompt** still says "spray the cart". Make it *"Hold Ⓐ to spray:
  sign · mats · stand · cart · a crewmate · look down to rinse your boots"*.
  When pitch < −1.0, `updateSpray` sends target `'self'`. That's the dead
  path from §1 B, and solo's grime cure.
- **Nobody can measure the pacing.** Build item 11 adds the pace log, so round
  5 reads numbers, not guesses.

---

## 3. Venues 2–5: the smallest builds that make each one different

### 3.0 The shared shape (one seam, then four modules)

**The problem.** Venues 2–5 change only a rate multiplier and the dressing.
Session 2 and 3 replay the Club with bigger numbers.

**The rule** (the Technical Director's, adopted 6–0): build **one seam** in the
core files, once. Then each venue is new files only, built in parallel.

**The seam (build item 3):**
- **A fourth gauge.** `ballValue({…, kpi})` adds `0.5 × kpi` to Upkeep, and
  `upkeepCeiling` gains the slot, so the ceiling is **3.0** from Tiered on
  (the quota already scales with it). The Board's gauge column fits **4 rows
  at 44 px**; the fourth carries *this venue's* label (BAY UTILIZATION, CROWD
  SENTIMENT, ZONING COMPLIANCE, ORBITAL DEBRIS). **Only the current venue's
  KPI counts:** earlier toys stay in the world (the bowls are still there at
  the Stadium) but stop being graded.
- **Hooks.** `crew.mjs` calls the modules registered in
  `server/venues/index.mjs` at `startShift`, `tick`, `endShift`, `serve`,
  `ping`, `knockDown`, `input`, a customer launch (`launchMod`), a ball coming
  to rest, `snapshot` and `toSave` (one key each). `main.js` does the same
  with `web/js/views/index.js`: `onEvent`, `tick`, and `prompt` (ahead of the
  generic prompts).
- **World-dependent geometry in `MAP`:** `BOWLS`, `TRACK`, `YARDS`, `LIFT`;
  `fieldFor(world)` for walkers, `netsFor(world)` for balls,
  `ballFeatures(b, world)`, `cartSpeedAt(x, z, world)` (×1.3 on the Track),
  and the County kerb in `cartBlocked`. All of it is identical to today at
  venues 0–1, pinned by a golden test.
- **`venues.js`, done once here so nobody else touches it:** the Tiered deck
  shortened to x ±20 (it sits over the washer at 21.5); the Stadium
  grandstands split into left and right; the Orbital elevator moved to
  `MAP.LIFT` (−44, 5); `jumbo` and `crowd` exposed.
- **New shop rows** go in via data files, the way `DIVE_ROW` and `POND_ROW`
  already do.

**The economy these modules are priced against.** These are the Systems
Designer's estimates for 4 players with ads, about 950 customer shots and 760
balls banked a shift. **The pace log (build item 11) replaces them with
measurements.**

| Venue | Rate | BV (typical) | Income / shift | Next fee (×2.2 at 4P) | Shifts to save it |
| --- | --- | --- | --- | --- | --- |
| Club | ×5 | ~$33 | ~$25k | $88k | ~3.5 |
| Tiered | ×25 | ~$200 | ~$150k | $440k | ~3 |
| Stadium | ×100 | ~$800 | ~$600k | $2.2M | ~3.7 |
| County | ×500 | ~$4,000 | ~$3M | $11M | ~3.7 |
| Orbital | ×2,500 | ~$20,000 | ~$15M | — (the Last Bucket) | — |

**The pricing rule:** each venue's automation row costs **0.5–1 shift** of
that venue's income at 4P. Fines and fees are quoted in **× BV**, so they scale
on their own.

### 3.1 Tiered Entertainment Range (venue 2): **targets and the Upper Deck**

*It feels like:* neon, aiming, and a bar that gets loud.

**Map change: three Target Greens.** No heightfield (round 3 item 8's L is
cut). The flags become neon pins over shallow bowl decals:

| Bowl | Centre | Radius r | Cup radius |
| --- | --- | --- | --- |
| A, at Red | (−4, −48) | 7 m | 1.0 m |
| B, at Yellow | (26, −76) | 8 m | 1.0 m |
| C, at Blue | (−6, −140) | 9 m | 1.0 m |

- **The rule.** A ball that comes to rest inside a bowl's r rolls into its
  cup. The server moves it to `cupSpot(id, bowl)` (a deterministic disc
  scatter inside the cup radius), sets `b.cup`, and emits `{t:'cup', id,
  bowl, x, z}`; the client tweens it over `dist / 4` s (the MOW-E rake hop).
  No new physics: fairway arithmetic is untouched, and golden tests guard it.
- **Clearances:** the creek by ≥ 13 m, the pond by ≥ 30 m, the Ping Track
  (§3.2) by 2.5 m, and the new MOW-E lanes (§2.2) clear all three bowls.
- **Callouts:** *Bowl A, Bowl B, Bowl C*, added to `MAP.LANDMARKS` with
  `minVenue: 2`.

**Live KPI: Bay Utilization** = `1 − cupBalls / 40`.
- *"Balls in a target block its sensors. Corporate calls this
  underutilisation."*
- About **5%** of customer balls end in a cup: about 48 a shift at 4P and 29
  solo. Untended, the dial is empty by about 5:50 of a 7:00 shift at 4P. One
  emptying run mid-shift, and another at Last Call, keeps it at ~0.7.
- The cups are dense piles: push-picker heaven. Helpers already target them,
  because they're just resting balls.

**Chore: empty the cups.** A Bowl A → B → C circuit from the stand is about
230 m: about 45 s sprinting in spikes.

**Toy 1: Target Practice** (the crew bays get a reason besides the cart).
- A **crew** ball (`b.by` is a player) that comes to rest in a bowl scores
  **TARGET!**:
  1. **The cup flushes.** Every ball in that cup banks to the shooter at gear
     ×1, with the usual float at the stand. *"Direct hit. The cup has been
     emptied by the sensors. There are no sensors."*
  2. **Hustle +0.25.** It shares the ×2 cap with pings.
  3. The neon pin strobes for 3 s, plus a SFX sting.
- It works **solo** (no driver needed), so Tiered gives solo its first Hustle
  source.
- **The chore and the toy interlock:** a good shot *is* a cup emptied. Bowl A
  at 48 m is the beginner target, and Bowl C at 140 m is the bragging one.

**Toy 2: the Upper Deck and overserving** (the owner's call, made concrete).

*The setup:*
- The Tiered deck (venue 2's existing slab, top at y 3, z 2–6, now x ±20)
  gets **four Deck Loungers**: cosmetic `people.js` figures with a mug, at
  the rail at **x −14, −6, 6, 14** (y 3, z 2.4), facing the field.
- From Tiered on, **a non-burnt beer** does two things:
  - it adds its baskets (2 for perfect, 1 for good) to Fry Satisfaction, as
    today;
  - it pays a **bar tab** of **5 × BV** in cash (about $1,000 at Tiered),
    because the deck drinks it.
- Well played, a cook pouring beer earns about what a picker banks (about
  $5k a minute). That's why anyone pours beer once the conveyor runs the
  fries.

*The rule.* The deck has a **Drinks** count, 0–6, server-side
(`crew.deck.drinks`). It resets to 0 each morning.

| Event | Drinks |
| --- | --- |
| A beer served (good or perfect) | **+1** |
| Every 30 s of shift time | **−1** (the deck sobers up) |
| A hot dog served (not burnt) | **−2** ("food helps") |
| Fries served (not burnt) | **−1** |
| Drinks reach **6** | **INCIDENT** |

*The incident:*
- The lounger at the next seat (round robin) leans over the rail, tips and
  **falls 3 m** (1.4 s, a half spin, a thud, a gasp) to land on their back at
  **(x, 0, 1.0)**, between the mat line and the walkway. They lie there 3 s
  with 💫, then walk out through the gate. A new lounger comes up the stairs
  (x −27.5) 20 s later.
- **Any Rat within 1.5 m** of the landing spot is knocked flat
  (`knockDown(p, 'customer')`): *"A customer fell on you. Corporate is
  reviewing the footage."* That gives grime as usual.
- **The penalty:** a **Liability fine of 100 × BV** (about $20k at Tiered,
  about 13% of a 4-player shift; never below $0). Drinks drop to **2**,
  `stats.incidents++`, and **if Gary is on site, his kitchen stop fails**,
  whatever the stock.
- **The PA**, once ever (a big event, by the round-2 rules):
  *"A guest has left the Upper Deck by the fastest available route.
  Corporate reminds you that beer is not a ladder."*
- **The Board banner.** At Tiered and up, when there's no Gary and no Last
  Call, the slogan reads **"DAYS WITHOUT AN INCIDENT: N"**, counted from
  `crew.lastIncidentDay`. On an incident day it turns red and reads 0. It's
  the running joke of the whole session.
- **The ledger award:** *Last Orders* goes to whoever poured the sixth
  drink.
- **The report line:** "Upper Deck incidents: 1 · fine $19,850".

*How players see it coming and prevent it:*
- **The kitchen's beer card** shows six mug icons for Drinks. At 4 they go
  amber ("The deck is getting loud"); at 5 they go red ("CUT THEM OFF").
- **The loungers sway** with amplitude `drinks / 6` and, from 4, shout a
  "WOOO!" every 6 s. It's audible from the yard, so the cook isn't the only
  one who knows.
- **A first-time hint** on the first beer at Tiered: *"Beer pays a tab. Six
  drinks on the deck and somebody falls off. Hot dogs sober them up."*
- **The sustainable pattern:** *two beers, one hot dog* (net 0 per cycle,
  about 20 s, two tabs). A cook who only pours beer has an incident about
  every 36 s and **loses money**: six tabs are about 30 × BV against a
  100 × BV fine. The math rewards the mix, not the spam.
- **Co-op:** two cooks at the shed split it, one pouring and one grilling.
  (Hosing a lounger off the rail was proposed and cut: spraying customers is
  out of character.)

**Automation: the ball-return gutters** (a new crew row, `gutters`,
`minVenue: 2`, in `web/js/tiered.js`).
- One tier at **$50,000** base (×2.2 = $110k at 4P, about 0.7 of a shift;
  round 3's $150k was 2+ shifts, too slow). It drains **1 ball a second from
  each cup** to the stand, banked as kind `gutter` at gear ×1, with a THUNK.
- The pipes are buried, with a glass section at each cup and at the deck, and
  no collision. Bay Utilization matters for the first two Tiered shifts, and
  Target Practice still pays after.

**Story:** the reveal memo gets a second card: *"New: Target Greens. Balls in
a cup block the sensors. Bay Utilization is now on the Board. The Upper Deck
is now serving."*

### 3.2 Stadium Range (venue 3): **the Ping Track and the crowd**

*It feels like:* a show. Every ping gets a roar, every knockdown gets a
replay.

**Map change: the Ping Track.** A painted oval in the near field: centre
**(0, −24)**, centreline half-axes **32 × 12**, **5 m** wide (so x ±34.5, z −9.5
to −38.5).
- **Clearances:** Bowl A by 2.5 m, the creek inflow by more than 15 m, the
  mats by 9.5 m.
- **The rule:** the cart is **×1.3** on the Track (`cartSpeedAt`). Ball
  physics is unchanged (painted turf).
- **Laps:** four quadrant gates (N, W, S, E) by angle on the ellipse. All four
  in order, either direction, in ≤ **25 s**, is a **lap** (about 152 m, about
  13 s flat out).
- **Callouts:** *the Track*, *the Turn* (the west end). MOW-E's lanes −24 and
  −36 cross it; keep that, MOW-E mowing the Track mid-race is a gift.

**Live KPI: Crowd Sentiment**, 0–1, server-side. It starts each shift at
**0.5** and decays **0.0025 a second** (empty in 200 s if ignored).

| Event | Sentiment |
| --- | --- |
| A ping (crew ball on a driven cart) | +0.08 |
| A ping while that cart is **on the Track** | **+0.16** |
| A lap of the Track | +0.06 |
| A TARGET! (the bowls are still there) | +0.06 |
| A jackpot | +0.10 on top |
| A Rat knocked flat, any cause (at most 10 a shift) | **+0.02**: the crowd loves a knockdown |

- **Solo can hold it:** a lap every ~15 s is +0.004/s against −0.0025/s, and
  the reels still pick up what's on the Track.
- **At 4P,** a driver lapping and two shooters at the bays pin it at 1.0.

**How it shows** (`web/js/views/stadium.js`): the crowd bob is `0.1 + 0.5 × s`;
a wave rolls round both stands above 0.9; below 0.25 there's a slow BOO and
*"THE CROWD IS BORED"*; the ambience `crowd` level is `0.2 + 0.8 × s` (today a
constant 0.6). **The jumbotron** (built, at (26, 14), a black plane today)
becomes a 512 × 300 canvas: CROWD ♥ 72%, *"PING! <name>"* on a ping, and
**KNOCKDOWN CAM: <name> · 3 TODAY** on a knockdown.

**Chore: keep the show going.** Laps and pings decay, so someone keeps doing
them, and the crowd tells you when they stop.

**Toy: the second cart (the fleet).** The `cart` row gains tier 3, *"A second
cart"*, `minVenue: 3`, **$150,000** base ($330k at 4P, about half a shift),
parked at (35, 10). It's round 3 item 9's plan (`cart` → `carts[]`, about 20
sites), with a `cart` alias in the snapshot for one release. Each cart pings
on its own; the `fleet` PA line exists. **Why here:** the Track wants two
carts. One laps for the crowd, one harvests, and two drivers race.

**Story:** the reveal card reads *"New: the Ping Track. The crowd grades you
now. The crowd has never played golf."*

### 3.3 County Range (venue 4): **the Yards and the drones**

*It feels like:* the walls come down, and the job is suddenly in people's
gardens.

**Map change: the right net comes down.**
- At venue ≥ 4, `netsFor` moves the right ball net from x 64.5 to **96.5**,
  and `fieldFor` lets walkers go to x 96. A **kerb** at x 64.5 blocks
  vehicles: *"County Ordinance 1971: no vehicles on residential lawns."*
- Between x 64.5 and 96, z −30 to −189, lie **four back yards** split by picket
  fences (open gates) at z −70, −110 and −150. Each has a mailbox at x 90
  (z −50, −90, −130, −170). Yard 3 has a paddling pool and the Gnome
  (84, −128).
- **The right grandstand hides** (*"relocated to the County Fair"*); the left
  one and the jumbotron stay. **The Grate** becomes a culvert in the kerb, its
  pile at (63, −114) unchanged.
- **Callouts:** *the Yards, Yard 1–4, the Mailboxes, the Gnome*.

**The rule: County customers slice.** **40%** of customer shots get `curve`
**0.6–1.4**, the crew swing's existing curve physics, bending right (+x).
Tuning target: **10–15%** of shots end in the Yards; a test runs 2,000 seeded
shots and asserts [0.08, 0.18]. *"Customers at the County fade the ball.
Corporate does not use the word 'slice'."*

**Live KPI: Zoning Compliance** = `1 − strays / 30`, where `strays` is resting
balls at x > 64.5 (about 95–140 a shift at 4P: the most demanding dial yet),
recomputed every 0.5 s.

**Chore: walk the Yards.** The cart can't follow, so it's on foot with a push
picker. Yard 3 and back is about 150 m: the County's "diver" job, chosen by
one Rat, the way the pond is.

**Toy: drones** (a crew row `drones`, `minVenue: 4`, in `web/js/county.js`;
`stepDrones` lives in `server/venues/county.mjs`, **not** in `stepHelpers`).
Tier 1, *two drones*, **$600,000** base ($1.32M at 4P, about 0.45 shift); tier
2, *four drones*, **$1,500,000**.
- A drone flies at y 6 at **10 m/s**, ignoring the creek, the kerb and wading.
  It takes **strays first**, then the nearest ball, carries **25**, dips to
  y 1 to grab, and banks at the stand. It's **never knocked down**.
- The view: a quadcopter with a dangling basket, and a buzz that pitches up
  when it's loaded.
- **The PA**, once: *"Corporate has deployed drones. They are not watching
  you. They are watching the balls. Mostly."*

**Story:** the reveal card reads *"New: the Yards. Your customers now hit
into the county. The county has noticed."*

### 3.4 Orbital Range (venue 5): **the Lift and the EVA**

*It feels like:* the quietest, prettiest minute in the game, 120 m up,
looking down at all of Dimple Creek at dusk.

**Map change: the Lift.** The elevator (today at (32, 18), outside the field)
moves to **`MAP.LIFT` (−44, 5)**, a 2.6 m platform beside the Mower Shed. The
car rests on the platform and rises only with riders. Callout: *the Lift*.

**The rule: orbit shots.** **5%** of customer shots at the Orbital launch
straight up (vy 70) and leave above y 150: about 48 a shift at 4P. Each adds a
**debris id** (a saved `Set`, cap 60; not a ball entity). The client draws
each id in a slow ring round the top of the Lift at `debrisSpot(id)`: angle
id × 2.39996 rad (the golden angle), radius 3 + (id mod 7) × 1.2 m, height
±1.5 m. Deterministic, never streamed.

**Live KPI: Orbital Debris** = `1 − debris / 30`.

**Chore and toy: the EVA.** The Deep End's code, reused: the "fancy" the owner
asked for, at the top of the ladder.
- **Up.** Ⓧ on the platform, *"Ride the Lift"*: a 5 s ride, the camera rising
  from 1.7 to 120 m over the field while the sky fades to stars (`sky.js`
  night override). Others see the car go up with you in it.
- **Out.** You float in a disc of **11 m** around the car (local position
  client-reported, server-clamped, like walking) at your dive tier's swim
  × 1.2. Ⓐ grabs debris within **2.2 m**. The bag is your **dive tier's bag**
  (10/15/25/40), so the dive ladder pays off again.
- **Oxygen** is your dive tier's air, with no Deep End drain. **A buddy on the
  platform cranks the O₂** with the pump rules (`pumpGain`, `onLift` instead
  of `onDock`): the pond's pit crew re-forms here.
- **Down.** Ⓧ, *"Ride down"*, 5 s. The bag goes to your pocket at **weight 3**
  a ball (`KIND_W.debris = 3`); bank at the stand. **Out of O₂:** *"The tether
  reels you in"*, the bag spills back into orbit and you ride down (the gasp
  rule).
- **The view:** the real scene from 120 m with fog pushed to 600 m;
  instanced, slowly spinning debris; the tether line; `scuba.js`'s low-air
  vignette under its existing `eva` flag; breathing over the underwater
  low-pass.
- **The PA**, once: *"A Range Rat has left the atmosphere. Corporate will
  hold their locker."*

**Automation: the orbital tether winch** (crew row `tether`, `minVenue: 5`,
**$3,000,000** base, about 0.45 shift). It clears 1 debris every **8 s**
(about 52 a shift), roughly the inflow. Then the EVA is optional: the ride you
take to watch Ball No. 1 come home.

**The fallback, if the EVA runs long: Orbital lite (S).** No ride. Every 30 s, six
debris balls re-enter at a telegraphed ring (a red decal 5 s ahead, at a random
fairway spot), worth ×3; Orbital Debris counts what is still up. The council
prefers the EVA (5–1; the Technical Director voted lite). The owner decides at
build time.

### 3.5 Side by side: does each venue feel different?

| | Tiered | Stadium | County | Orbital |
| --- | --- | --- | --- | --- |
| **Map change** | 3 Target Greens (cups) | The Ping Track | The right net comes down: the Yards | The Lift at (−44, 5) |
| **Live KPI** | Bay Utilization `1 − cup/40` | Crowd Sentiment (decays) | Zoning Compliance `1 − strays/30` | Orbital Debris `1 − debris/30` |
| **Chore** | Empty the cups | Keep the show going (laps, pings) | Walk the Yards (no carts) | EVA: collect the debris ring |
| **Toy** | Target Practice; the Upper Deck bar tab | The second cart, racing the Track | Drones | The ride itself, and Ball No. 1 |
| **Automation** | Gutters $50k | (the fleet is the toy) | Drones | The tether winch $3M |
| **New verb** | Aiming at a target | Lapping | Leaving the field | Floating |
| **New sound** | "WOOO!" from the deck | The crowd roar, the BOO | The drone buzz, a dog barking two yards over | Breathing, silence |
| **PA (once)** | `overserved` | `fleet` (exists) | `drones` | `eva` |
| **Solo path** | Target Practice is solo | Laps hold the crowd | The push picker, then drones | EVA solo with twin tanks; the tether |

**The Level Designer's test:** each venue moves the crew's attention somewhere
new: Tiered *up* (the deck) and at *targets*; the Stadium to the *near field*;
the County *sideways*, out of the field; the Orbital *up*, literally. The hub
(the stand, the washer, the shed, the dock) never moves.

---

## 4. Settings, hints, accessibility, the Xbox, and night one

### 4.1 Settings: built, plus three rows

`settings.js` now has master/SFX/ambience/PA volumes, PA voice or captions,
look sensitivity and invert Y, all stick-navigable. Add these (all
`localStorage` behind try/catch, as now):

| Row | Values | Why |
| --- | --- | --- |
| **Text size** | 100 / 125 / 150% (a CSS variable on `body`) | The sofa is 3 m from the TV; the feed is 0.8 em |
| **Reduce motion** | Off / On: no knockdown camera roll, no reveal shake, the fall's tilt × 0.3 | A knockdown spins the view about 60°; some players get queasy |
| **Graphics** | Auto / Quality / Performance (§4.4) | The Xbox and an old laptop need a lever |

The cranking latch on the pad (§2.5) is a fix, not a setting.

### 4.2 First-time hints: built for three, extend to eight

`createHinter` shows each hint once per browser, at most one every 12 s.
Extend `nextHint` to take a context object (conditions, not just seconds):

| Hint | When it fires | Text (pad / keyboard) |
| --- | --- | --- |
| `shop` (change) | cash ≥ $20 (replaces the `hud()` nudge) | "D-pad up / Tab: the shop. Buy a retriever tube." |
| `sprint` | exists | |
| `wand` | day 1, 20 s in, sign mud > 0.5 | "The sign is filthy. Grab the pressure washer by the cart bay: Ⓧ / E." |
| `bank` | the first time your pocket is full | "Full. The bucket stand pays per ball: Ⓧ / E there." |
| `crank` | the washer holds ≥ $10 | "The ball washer has money in it. Tap Ⓐ at a handle and circle a stick." |
| `dive` | venue 1, first time on the dock | "Walk in to dive. A buddy on the dock can pump your air." |
| `cctv` | exists | |
| `deck` | venue 2, the first beer pour | "Beer pays a tab. Six drinks and somebody falls off the deck. Hot dogs sober them up." |

Hints use the toast today. Give them **their own chip** above the prompt, so
a hint and a cash toast don't overwrite each other.

### 4.3 Accessibility, beyond the settings

- **Colour isn't the only signal.** Gold has its beacon; lead gets a matte
  finish and a heavier "plonk"; the bouncy ball gets a faint ring; the four
  Board gauges are labelled, not just coloured.
- **Captions:** the PA is always captioned (`pa.js`). Gary's horn, MOW-E's
  horn and the deck's WOOO each have a toast or a feed line.
- **Hold actions:** crank and pump latch on the pad; sprint toggles on a
  stick click (as now); haul stays a 1.5 s hold, and there's a ring on the
  prompt showing progress (it's already a percent).

### 4.4 The Xbox performance plan

**The target:** on the owner's Xbox in Edge, with 4 players, 14 customers, 800
balls and the Stadium crowd, an average frame of **≤ 16.7 ms** and a p95 of
**≤ 20 ms**, measured over a 7-minute shift and **written in the README**.

**The tools (build item 6):**
1. **A `?perf` overlay** in a new `web/js/perf.js`: frame ms (average, p95,
   worst) over 5 s, draw calls and triangles from `renderer.info`,
   `performance.memory` where present, and a `[perf]` console line every
   10 s. P toggles it.
2. **A dev fixture route.** With `RR_DEV=1` in the environment (never set in
   the manifest), `POST /api/dev/crew` accepts a save body. `tools/fixtures/`
   gets `club-day8.json`, `stadium-day2.json` and `orbital-day3.json`, so
   anyone can load "the Stadium with everything" in one click.

**The levers, in order of expected win:**

| # | Lever | Where | Why |
| --- | --- | --- | --- |
| 1 | **Render scale.** On Xbox: pixel ratio 1, and the internal size capped at 1920 × 1080 (CSS-scaled up) | `main.js` renderer init | Today it's `min(dpr, 2)`. A 4K TV can mean 2–4× the pixels |
| 2 | **Shadows.** Map 2048 → 1024; `shadowMap.autoUpdate = false`, updated every 2nd frame; only the sun casts; customers, balls and the crowd never cast | `main.js`, `scenery.js` | Shadow passes double the draw calls |
| 3 | **Per-frame garbage.** `sky.follow(new THREE.Vector3(…))` every frame; `new THREE.Vector3` per spray drop; `cartCentre.clone()` in `consider()` | `main.js` | GC pauses show as hitches on Xbox. Reuse vectors |
| 4 | **Customers.** `maxFull` 14 → 8 and `nearM` 50 → 30 on Xbox | `crowd.js` options from `main.js` | Skinned figures are the heaviest meshes |
| 5 | **Scuba.** On low detail: no light shafts, half the silt, half the kelp | `scuba.js` (`lowDetail` option) | Only while diving, but it's the highlight; don't let it stutter |
| 6 | **Venue animation at 20 Hz.** The neon `setColorAt` loop and the stadium crowd matrices | `venues.js` tick | 280 matrix writes a frame for a bob |
| 7 | **Auto mode.** If p95 > 22 ms for 10 s, step down one tier (scale 0.85 → shadows off → customers 6), once, with a toast: *"Lowered graphics to keep it smooth"* | `perf.js` + the Graphics setting | The sofa crew never opens settings |

**Detection:** `lowDetail` today is `/Xbox/i` in the user agent. Keep it as the
**Auto** default; the Graphics setting overrides it.

### 4.5 Night one for a casual crew of four

The Casual Crew seat walked the first ten minutes as four friends: one on the
living-room Xbox, three on laptops. Here's what broke, and the fix for each.

| Moment | What happens today | Fix (build item 2) |
| --- | --- | --- |
| "Can we all play on the TV?" | No. Each Rat needs a screen, and nothing says so | The title card says: *"Each Rat plays on their own screen: an Xbox, a PC or a laptop. Up to 6 per crew."* (Touch is in pillar 4 but unverified; until it's checked on a phone, don't promise it.) Split-screen is post-1.0 |
| Joining on Xbox | Type the URL, then the code, with the on-screen keyboard | A **`?c=CODE` deep link**: it prefills the code and focuses the name. The lobby shows **`<host>/?c=KQPZ`** big, plus the code at 4 em. (A server `/c/KQPZ` redirect is a nice-to-have, XS) |
| The lobby | A code, a sentence and "Open the range" | Add: **the roster** (names and colours, live as people join); a **3-line goal card**; and the controls for this device |
| Somebody presses Open before everyone's in | Day 1 starts; late joiners walk in mid-day | Keep it; late join already works. The button reads *"Open the range (2 Rats here)"*, and a mid-shift joiner gets a toast: *"You've joined day 1 with 3:12 left. Pick up balls, bank them at the bucket stand (by the big board)."* |
| "What's the point?" | The day-1 memo is three sentences, and the Board says BALL VALUE | The memo stays. The lobby card carries the goal (below) |
| End of the night | Close the tab; the code is only remembered on the creator's device | The report and the pause card both show *"Crew code **KQPZ**: this is your save. Come back with it."* Every device that joined remembers it (`rememberUsed`, already) |
| The crank on the Xbox | One thumb, two controls | The latch (§2.5) |

**The lobby's goal card** (three lines, no more):
> **Customers hit balls. You pick them up and bank them at the bucket stand.**
> **Keep the place clean and Corporate pays more per ball.** That's Ball
> Value, on the big board.
> **Hit Corporate's daily target three times, pay the fee, and the whole crew
> gets promoted.**

**The night-one script the council expects (4 players, 60 min):** unchanged
from round 3 §6.2, plus the fixes. The checks: the crew is in the range within
**3 minutes** of the first person opening the page; nobody asks "what do we
do?" after day 1; and the Club lands at **34–42 min**, *measured with the pace
log*.

---

## 5. The final build list (ranked)

Sizes: **XS** < 1 hour · **S** an evening · **M** one or two sessions · **L**
more.

**The ranking:** harm to night one first; then what makes sessions 2–3 real;
then polish. Dependencies are marked. Item 3 (the seam) gates items 4–9.

**The merge-conflict hotspots** are `server/crew.mjs`, `web/js/main.js` and
`web/js/sim.js`. Every item says whether it edits them (**core**) or lives in
**new files** (safe to run in a parallel subagent). §5.2 has the waves.

### 1. The audit fix pack · S · core

- **Spec** (§2): the pad latch for crank and pump (either stick feeds it);
  the wand's `'self'` target at pitch < −1.0 and a prompt that names its
  targets; customers (morning mats at 0.95, the `wait` state, `BUCKET_CLUB`
  40, mat numbers); Gary checks active mats only; MOW-E's new `LANES`,
  `LANE_NAMES` and cones; the shop hint at cash ≥ $20 (delete `nudged`); the
  scorecard at `minVenue: 4`; the `map.js` FIELD comment.
- **Files:** `round2.js`, `washer.js`, `main.js` (`pressAct`, `updateSpray`,
  `hud`), `customers.js`, `crew.mjs` (`inspect`), `mowe.js`, `mower.js`,
  `board.js`, `scenery.js`, `settings.js`, `dive.js`, `map.js`.
- **Tests:** a muddy mat at the opening has a waiting customer, who is seated
  once it's washed and refuses after 25 s; no MOW-E lane comes within
  2.2 + RAKE_HALF of a rock, box or bowl; the solo Gary mats check ignores
  mats ≥ 6; `shop` is due only at cash ≥ 20; no scorecard at venues 2–3.
- **Playtest check:** an Xbox player cranks for 20 s without complaining;
  someone hoses a mat *because a customer is waiting*; MOW-E gets called by
  name ("it's coming by the Tractor!").

### 2. The night-one pack · S · new files, plus one `main.js` region

- **Spec** (§4.1, §4.2, §4.5): the lobby roster, the goal card and
  `<host>/?c=CODE`; "Open the range (n Rats here)"; the `?c=` deep link; the
  code on the report and pause cards; the mid-shift-join toast; text size and
  reduce motion; hints `wand`, `bank`, `crank`, `dive` and `deck` in their own
  chip; the "own screen" line on the title.
- **Files:** `index.html`, `settings.js`, `net.js`, and in `main.js` **only**
  `showPhase()`, the lobby render and the `hinter.tick` context.
- **Tests:** text size and reduce motion sanitise and round-trip; each new
  hint fires on its condition, once.
- **Playtest check:** four friends, one on an Xbox, are in the crew within
  3 minutes; on day 2 the Xbox player can say what Ball Value is.

### 3. The venue seam · S–M · core, one agent alone

- **Spec** (§3.0): the `kpi` term and the 4-row gauge column; the registries
  `server/venues/index.mjs` and `web/js/views/index.js` at the listed hook
  points; `MAP.BOWLS`, `TRACK`, `YARDS`, `LIFT`, `KERB_X`; `fieldFor`,
  `netsFor`, `ballFeatures(b, world)`, `cartSpeedAt`, the kerb in
  `cartBlocked`, and `clampToField(p, world)` at every caller; the
  `venues.js` edits; one optional save key per module; `VENUE_RULES[v].howto`
  as a second reveal memo card.
- **Files:** `sim.js`, `map.js`, `crew.mjs`, `main.js`, `board.js`,
  `venues.js`, `round2.js`; **new** `server/venues/index.mjs` and
  `web/js/views/index.js`.
- **Tests:** **golden** (at venues 0–1, landings, `cartBlocked`, `fieldFor`
  and BV are unchanged); `kpi: 1` gives a ceiling of 3.0; a dummy module's
  hooks fire in order; at venue 4 a ball at x 80 isn't clamped and a cart at
  x 66 is blocked.
- **Playtest check:** nothing changes at the Muni or the Club. That's the
  point.

### 4. Tiered: the Target Greens, Bay Utilization, Target Practice, gutters · M · new files (after 3)

- **Spec:** §3.1, except the deck.
- **Files** (all **new**): `web/js/tiered.js` (`inBowl`, `cupSpot`, `bayUtil`,
  `GUTTERS_ROW`, the TARGET prize); `server/venues/tiered.mjs` (on rest → cup
  or TARGET, the gutter tick, `bowls` in the snapshot); `web/js/views/tiered.js`
  (decals, neon pins, the cup tween, gutter glass, the strobe); plus one line
  in each registry and one `SHOP` import.
- **Tests** (`test/tiered.test.mjs`): a ball resting at r 6.9 of A moves into
  the cup, one at r 7.5 doesn't; `bayUtil(40)` = 0; a crew ball in a bowl
  flushes the cup to the shooter at gear ×1 with Hustle +0.25 (cap ×2); the
  gutters drain 1 a second per cup; golden fairway landings are unchanged.
- **Playtest check:** someone says "Bowl B's full"; a bay player shouts
  "TARGET!"; Bay Utilization sits at 0.5–0.8 at the bell for a 4P crew that
  tends it.

### 5. Tiered: the Upper Deck and overserving · S–M · new files plus `kitchen.js` (after 3; parallel with 4)

- **Spec:** §3.1's Upper Deck, in full.
- **Files:** **new** `web/js/deck.js` (pure: `DECK = {MAX: 6, WARN: 4,
  SOBER_SECS: 30, FOOD: {fries: 1, hotdog: 2}, TAB: 5, FINE: 100, RESET_TO: 2,
  FALL_R: 1.5, SEATS: [−14, −6, 6, 14]}`, `stepDeck`, `serveEffect`,
  `landingSpot`); **new** `server/venues/deck.mjs` (the `serve` and `tick`
  hooks, the incident, `lastIncidentDay` saved); **new** `web/js/views/deck.js`
  (loungers, sway, WOOO, the fall); `kitchen.js` (the mug meter; this item
  **owns** `kitchen.js`); one line each in `pa.js` and `board.js`.
- **Tests** (`test/deck.test.mjs`): six beers inside 30 s cause an incident,
  five don't; 30 s sobers by 1; a hot dog is −2 and fries −1, floored at 0; a
  burnt beer adds nothing; the fine is 100 × BV and never takes cash below 0; a
  Rat 1.2 m from the landing spot is knocked down, one at 2 m isn't; Gary's
  kitchen stop fails during an incident; the deck is inert at venues 0–1.
- **Playtest check:** the cook eases off when the mugs go red, *or* someone
  falls and the room screams; "DAYS WITHOUT AN INCIDENT: 0" gets read out
  loud; tabs are 10–25% of a session's income.

### 6. The Xbox performance pass · S–M · mostly new files

- **Spec:** §4.4. The `?perf` overlay, the `RR_DEV` fixture route, levers
  1–7, the Graphics setting, and the numbers in the README.
- **Files:** **new** `web/js/perf.js` and `tools/fixtures/*.json`;
  `server.mjs` (the dev route); `main.js` (**only** the renderer init and the
  vector reuse); the `crowd.js` and `scuba.js` options; the `venues.js` tick
  throttle; `settings.js`.
- **Tests:** the dev route is 404 without `RR_DEV`; Graphics sanitises.
- **Playtest check:** **measured** p95 ≤ 20 ms on the Xbox at the Stadium
  fixture with 4 clients, recorded in the README.

### 7. The Stadium: the Ping Track, Crowd Sentiment, the jumbotron · S–M · new files (after 3)

- **Spec:** §3.2, except the fleet.
- **Files** (all **new**): `web/js/stadium.js` (`onTrack`, the lap gates,
  `stepSentiment`); `server/venues/stadium.mjs` (the `ping`, `knockDown` and
  `tick` hooks, laps off the cart pose); `web/js/views/stadium.js` (the paint,
  the crowd bob and wave, the jumbotron canvas, ambience `crowd`).
- **Tests** (`test/stadium.test.mjs`): `onTrack` at the centreline and both
  edges; a lap needs all 4 gates in order within 25 s; decay, the deltas and
  the knockdown cap of 10; ×1.3 only on the Track at venue ≥ 3.
- **Playtest check:** the show-off laps the Track while two Rats ping; the
  room cheers KNOCKDOWN CAM.

### 8. The County: the Yards, the slice, Zoning Compliance, drones · M · new files (after 3)

- **Spec:** §3.3.
- **Files:** **new** `web/js/county.js` (`SLICE`, `strayCount`, `DRONES_ROW`,
  `droneStep`); **new** `server/venues/county.mjs` (the slice through
  `launchMod`, the stray count, `stepDrones`); **new** `web/js/views/county.js`
  (yards, fences, mailboxes, the gnome, drones); one line in `pa.js`.
- **Tests** (`test/county.test.mjs`): 2,000 seeded shots put 8–18% in the
  Yards; a ball at x 80 rests and a cart at x 66 is blocked; drones take strays
  first, are never knocked down, and bank; venues 0–3 have no slice.
- **Playtest check:** one Rat adopts the Yards as their job; someone yells
  "Yard 3!"; buying drones gets a cheer.

### 9. The Orbital: the Lift, orbit shots, the EVA, the tether · M (or the S lite) · new files plus `scuba.js` (after 3)

- **Spec:** §3.4.
- **Files:** **new** `web/js/orbit.js` (`ORBIT = {SHOT: 0.05, CAP: 60, RIDE: 5,
  R: 11, GRAB: 2.2, TETHER_EVERY: 8}`, `debrisSpot`, `TETHER_ROW`, `evaStep`
  reusing `airStep` and `pumpGain`); **new** `server/venues/orbit.mjs` (the
  `lift`, `grab` and `ridedown` inputs via the `input` hook, O₂, the tether);
  **new** `web/js/views/orbit.js` (the ride camera, debris, tether line, star
  sky); `scuba.js` (the `eva` vignette and breathing; this item **owns**
  `scuba.js`); one line in `pa.js`.
- **Tests** (`test/orbit.test.mjs`): 5% of shots become debris, capped at 60;
  `debrisSpot` is deterministic and inside R; a grab at 2.2 m works and at 3 m
  doesn't; the bag is capped by dive tier; running out of O₂ returns the ids;
  the tether clears 1 every 8 s; the save keeps the debris ids.
- **Playtest check:** the room goes quiet on the first ride up; a pit crew
  forms at the Lift unprompted; Ball No. 1 still lands and banks.

### 10. The second cart (the fleet) · M · core, alone (after 7)

- **Spec:** `cart` → `carts[]` with a `cart` alias for one release; the row's
  tier 3 at `minVenue: 3`, $150k, parked at (35, 10); per-cart drivers, reels,
  hoppers, mud and pings; Gary checks the muddier cart; MOW-E honks at any
  cart; `cartViews[]` on the client.
- **Files:** `crew.mjs`, `main.js`, `sim.js`, `mowe.js`, `test/cart.test.mjs`.
- **Tests:** two drivers at once; independent pings; both hoppers unload; a
  one-cart v3 save loads; the alias.
- **Playtest check:** two drivers race the Track while two Rats shoot.

### 11. The pace log, docs and README · S · mostly new

- **Spec:** `?pace` records, per shift, day, venue, session minutes, cash,
  banked, stamps, KPIs at the bell, incidents and debris, kept in
  `sessionStorage` and copyable from the pause card. `game-design.md` gets a
  round-4 section (§3.5's table, the deck rules). The README gets the controls
  (the real swing, the latch, settings), venues, map, diving and perf numbers.
- **Files:** **new** `web/js/pace.js`; `design/game-design.md`, `README.md`;
  two lines in `main.js`.
- **Tests:** `pace.js`'s record shape.
- **Playtest check:** the next council reads numbers, not guesses.

### 12. The endless target · S · core-light

- **Spec:** in endless, the Board's target bar becomes **RECORD PACE**:
  today's cash against `records.cash × shiftT / shiftSecs`. The red line is
  the record. Beating it at the bell gives the existing `record` PA.
- **Files:** `board.js`, `crew.mjs` (a snapshot field),
  `test/round2.test.mjs`.
- **Playtest check:** in the first endless shift, someone says "we're ahead
  of the record."

### 13. The audio mix pass · S

- **Spec:** the PA ducks SFX and ambience by −9 dB while it speaks;
  underwater and EVA low-pass the SFX bus; the Stadium crowd follows
  Sentiment; Gary's and MOW-E's horns get +3 dB and a high shelf; the drone
  buzz is capped at 3 voices.
- **Files:** `sfx.js`, `ambience.js`, `pa.js`.
- **Playtest check:** a PA line is understandable over a 4-player Stadium
  shift on TV speakers.

### 5.1 Not in 1.0 (parked)

Split-screen on one Xbox; the heightfield and the Lookout Knoll; the Quarry;
the yellow submarine; intercepting drifting balls; the customer queue; QR
codes in the lobby; touch controls, until they're verified on a phone.

### 5.2 Waves, and who may run in parallel

| Wave | Items | Parallel? | Why |
| --- | --- | --- | --- |
| **A** | 1 (fix pack) and 2 (night one) | **Two agents, yes**, with region ownership: item 2 owns `index.html`, `settings.js`, `net.js` and `main.js`'s `showPhase`/lobby/`hinter.tick` lines; item 1 owns everything else it lists. Merge 1 first | Both touch `main.js`, in different functions |
| **A′** | 6 (perf) | **Yes, alongside A**, if it owns only the renderer-init and vector-reuse lines in `main.js`; otherwise right after A | Perf is mostly `perf.js`, the server dev route and option flags |
| **B** | 3 (the seam) | **No. One agent, alone** | It edits all three hotspots and defines the registries everyone else plugs into |
| **C** | 4, 5, 7, 8, 9 | **Five agents, yes.** Each writes only its own new files, plus one line in each registry and one `SHOP` import. Item 5 alone owns `kitchen.js`; item 9 alone owns `scuba.js`; `pa.js` gets one-line adds (trivial merges); `board.js` banner text goes to item 5 only | The seam moved every shared edit into item 3 |
| **D** | 10 (the fleet) | **No, alone**, after wave C merges | It rewrites cart sites in `crew.mjs` and `main.js` that item 7's hooks read |
| **E** | 11, 12, 13 | **Yes**: three agents. Docs, the Board/endless field, and the audio files don't overlap | |

**The critical path:** A → B → C (the longest is item 8 or 9, M) → D → E.
That's about **5–6 sessions** to "essentially done", with C's five builds in
one go.

**Every agent's done line:** `node --test test/` and `make preflight` are
green; the item's playtest check is in the commit message as *to verify* until
somebody plays it; `game-design.md` is updated in the same commit (round 1's
note 8 still stands).

---

## 6. Contested calls (votes)

| Call | G | E | M | L | T | C | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cut the heightfield; bowls are a flat "rest inside r → cup" rule | yes | yes | yes | no | yes | yes | **Adopted 5–1.** The Level Designer wanted real slopes; the tween reads the same from the bays at a fraction of the cost (about 12 core sites saved) |
| Beer pays a bar tab (5 × BV) from Tiered on | yes | yes | yes | yes | yes | yes | **Adopted 6–0.** Without it, the conveyor makes the cook redundant and overserving never fires |
| The overserve penalty is cash (100 × BV), not a lost stamp | yes | yes | yes | yes | yes | yes | **Adopted 6–0.** A stamp is too harsh for a joke; cash plus a falling customer plus a red banner is the right sting |
| Rats under a falling customer are knocked down | yes | no | yes | yes | yes | yes | **Adopted 5–1.** The Systems Designer called it double jeopardy; the room called it the funniest thing in the round |
| Only the current venue's KPI counts | yes | yes | no | yes | yes | yes | **Adopted 5–1.** The Co-op seat wanted all four live; four gauges is the TV's limit |
| Second cart at the Stadium, not Tiered | yes | yes | no | yes | yes | yes | **Adopted 5–1.** Tiered already gets bowls, the deck and beer; the Track is the second cart's reason to exist |
| EVA over Orbital lite | yes | yes | yes | yes | no | yes | **EVA, 5–1**, with lite as the named fallback |
| County Yards on the right only (the slice), not both sides | yes | yes | yes | yes | yes | no | **Adopted 5–1.** The Casual seat asked for symmetry; one destination reads like the pond, and the left grandstand stays |

## 7. Story and PA additions

**New PA lines** (each `once`, big events only, by the round-2 rules):

| id | Trigger | Line |
| --- | --- | --- |
| `overserved` | The first Upper Deck incident | "A guest has left the Upper Deck by the fastest available route. Corporate reminds you that beer is not a ladder." |
| `drones` | The first drone tier bought | "Corporate has deployed drones. They are not watching you. They are watching the balls. Mostly." |
| `eva` | The first ride up the Lift | "A Range Rat has left the atmosphere. Corporate will hold their locker." |

**Lines on cards and in toasts:**
- **Target Greens:** *"Balls in a cup block the sensors. There are no
  sensors."*
- **The Deck Loungers:** *"Corporate's Experiential Hospitality Program. The
  railing is decorative."*
- **The Yards:** *"County Ordinance 1971: no vehicles on residential lawns.
  Ordinance 1972: no golf balls either. Unenforced."*
- **The Gnome** (at (84, −128), Yard 3): *"He was here first."*
- **The Lift:** *"FHI Vertical Retrieval Asset. Weight limit: one Rat, one
  bag, no opinions."*
