# Fun Council, round 3: Done, Dimple Creek, and the Deep End

This is the record of Range Rat's third Fun Council (November 2026). It keeps
the format of rounds 1 and 2, with the same five judges and one new seat.
Rounds 1 and 2 (`design/council-round1.md`, `design/council-round2.md`) stay
binding wherever this record doesn't change them. Where they disagree, this
record wins.

**What the owner set for this round (binding):**
1. **"Keep going until the game is essentially done."** Define 1.0 and rank
   every remaining gap.
2. **"If there is a feature, it's actually worth it and meaningful."** Audit
   every built feature: keep, rework, merge or cut.
3. **"Make the map kinda novel."** Design a buildable map that changes how
   four Rats move and split up, with a per-venue evolution and a
   buildability verdict for tonight.
4. **"Make the scuba diving pretty cool and fancy"**, without turning it into
   a time sink.
5. **Multiplayer first:** check the simultaneous jobs and the regroup moments
   at 4 players, and check that solo still works.
6. **Pacing:** the first 60 minutes for 4 players and for 1 player, with
   everything in. The owner called day 1 too slow.

**What the owner changed since round 2:**
- The pond opens with the Range Club, not on day 4.
- The owner added:
  - a three-item kitchen (fries, hot dogs, beer);
  - a real golf swing at the crew bays;
  - golfers who swing at the mats;
  - scenery and ambient audio;
  - sprint;
  - the shop, open any time.

**The council.**

| Seat | Judge | Lens |
| --- | --- | --- |
| Chair | **Fun Expert** (F) | Moment-to-moment fun, and the pacing of the incremental curve |
| | Technical Director (T) | Buildable *well*: Three.js, server-authoritative, zero npm dependencies |
| | Player Advocate (P) | Clarity on a TV with an Xbox pad, the first session, readability with 4 players |
| | Story Keeper (S) | Does it serve the Range Rats, Corporate and the ball-value story? |
| | Co-op Advocate (C) | Does it create moments between players, and give 4 people a reason to split up and regroup? |
| **New** | **Level Designer** (L) | Memorable multiplayer spaces: Overcooked kitchens, Mario Kart tracks, Deep Rock caves, Lethal Company moons, Fall Guys rounds. Is the space readable? Does it make routes, chokepoints, callouts and piles, and does it change as you progress? |

With six judges a vote can tie. The chair breaks ties.

---

## 0. What the council found in the code

The judges read `sim.js`, `crew.mjs`, `main.js`, `round2.js`, `scenery.js`,
`venues.js`, `kitchen.js` and the newly landed `scuba.js` before judging.
These findings drive the audit (§2) and the fix pack (build item 1).

**Bugs a player will hit:**
1. **You can't grab the pressure washer until the crew owns a cart.**
   - In `main.js`, `nearStation()` is `!!crew.cart && …`, so the wand is
     unreachable on days 1–3.
   - The server's `toggleWand` has no such gate.
   - So Curb Appeal, the first KPI and round 1's "first visible lever"
     (hose the sign, watch BV flip), can't be raised until the $600 cart.
   - It also makes the day-2 and day-3 quotas hard to hit at the Muni.
   - The prompt says "spray the cart" even when you're aiming at the sign.
2. **At the Muni, walking over the hidden pond puts you underwater.** In
   `main.js`'s `frame()`:
   - the walking speed applies `POND.SWIM` whenever `inPond(me)`;
   - the camera drops to the pond bed with green fog whenever `inPond(me)`;
   - neither checks `crew.pond.unlocked`.
   - The dock prompt ("Walk into the pond to dive…") also shows at the
     Muni, where there's no dock.
3. **Golfers stand on idle mats forever.** All 10 mats get a golfer, but
   solo uses 6 mats and two players use 8. The other golfers address the
   ball and never swing.

**Dead code:**
4. **Hold-to-peel is dead.**
   - `pressAct()` opens the kitchen instead.
   - `peeling` is never set true, so `peelSecs` never grows.
   - The server's `peel()` (and `FRIES.PEEL_SECS`) is reachable only by a
     hand-crafted request.
5. **The old hold-to-swing path is dead.**
   - `swing.js` owns the bay now.
   - `charging` is never set, so `SWING_FULL`, the `#meter` bar and the
     swing branch of `releaseAct()` never run.
6. **Unused data.**
   - `KIND_DEBUT` is unused, and still says lead arrives on day 4.
   - `stats.beers` is counted, but nothing reads it.

**Specced in rounds 1–2 but never built.** Each gets a verdict in §2:
- the sprinkler malfunction, the gravel truck, rain days and the forecast;
- "a muddy sign halves advertising";
- Gary's pond stop, and the "Gary has noted your enthusiasm" ring;
- the dive gear ladder (mask → tank → twin tanks);
- the customer lifecycle (round 2 §7).

**Noise on screen:**
- **Toasts.** Every crewmate's deposit, cart boarding, serve and fries
  basket raises a centre toast, and there's only one toast slot. At 4
  players the important ones (Gary, a gasp, a jackpot) get overwritten
  within a second.
- **The HUD value line** repeats the whole Board:
  `BV · curb · pond · fries · target · cart · LAST CALL · gear · next · unwashed`.
  That's ten fields in one line on a TV.

**What `scuba.js` already does** (it landed during this round). It's
visual, and it's good:
- caustics, light shafts and a Snell's-window surface;
- kelp, lily pads, a fish school and a very large catfish;
- the air hose from the dock, silt, bubbles and a panic vignette;
- eight pieces of cosmetic junk on the bed, including a gold *1987 Club
  Champion* trophy.

None of it touches the rules. §4 builds the mechanics on top of it and
reuses the junk as treasure.

---

## 1. The 1.0 definition of done

**Range Rat 1.0 is done when** a fresh crew of four can play from the lobby
to the Last Bucket in about three 60-minute sessions, and one player in about
four, with:
- no dev switches;
- no dead ends;
- nothing on screen that doesn't do something;
- and every venue playing differently, not just paying more.

Legend: ✅ built · ◐ partly built · ☐ missing.

### 1.1 The checklist

**A. The ladder is real**
- ✅ Promotion, the franchise agreement, the reveal, write-offs and titles.
- ✅ The Last Bucket, the end card and endless mode.
- ◐ **Each venue has its full seven:**
  - rate, write-off, title and voice line are built;
  - a *live* KPI, its chore, its toy and **its map change** are not.
  - Muni ✅, Club ◐ (it needs the creek and MOW-E), Tiered ☐, Stadium ☐,
    County ☐, Orbital ☐.
- ☐ Endless has a target: the Board's red line reads the crew's record pace.
  Verify on the Board, then mark ✅.

**B. Every feature earns its place**
- ☐ This record's cuts are done, and no dead code paths remain (§0 items
  4–6).
- ☐ Every station has a diegetic prompt that names its verb and its payoff.
- ☐ Every shop row changes something a player can see within one shift.
- ☐ Nothing the player is told about is impossible (§0 item 1).

**C. The map**
- ☐ The Muni field is **Dimple Creek** (§3): the creek, three crossings,
  landmarks, nets that catch, and the drained pond.
- ☐ Each venue adds exactly one map rule (§3.6).
- ☐ Every landmark is a callout a new player uses in their first session.

**D. The first hour**
- ☐ Day 1 is at most 4 minutes. It teaches pick up, bank, the Board, the
  shop and the wand, without a text wall.
- ☐ Days 1–8 each introduce one or two new things, never zero and never
  five.
- ☐ The Club lands at minutes 30–42 for four players and 35–45 for one (§6).

**E. Multiplayer**
- ◐ Four players have at least 4 distinct useful jobs at any moment from day
  3, and at least 3 regroup moments a shift (§5).
- ◐ Solo works: every chore has an automation tier by its venue's third
  day, except diving, which needs the tank and the tube from §4.
- ◐ Joining late, reconnecting, six players, and a crew resuming after a
  deploy all work. Six players need a check on the HUD and roster.
- ☐ Customers come and go, and refuse filthy mats, so Curb Appeal is
  something you *see* (build item 7).

**F. Controller and TV**
- ✅ Every verb works on the pad, and menus are driven by the stick.
- ☐ A settings menu: volumes, the PA mode (voice and captions, or captions
  only; specced in round 2, unbuilt), look sensitivity and invert Y.
- ☐ First-time hints for the hidden buttons: the shop (☰ / Tab), sprint
  (RS / Shift), CCTV (D-pad down).
- ☐ The HUD line fits on one line at 1080p, and the toasts are prioritised.

**G. Feel and performance**
- ✅ Diving looks like a highlight (`scuba.js`).
- ☐ Diving *plays* like one (§4).
- ☐ On the Xbox in Edge, a frame takes at most 20 ms with 4 players, 14
  customers, 800 balls and the Stadium crowd. **Measured, not assumed.**
- ☐ An audio mix pass: the PA ducking, ambience against SFX, underwater.

**H. Quality**
- ◐ There are tests for every rule. About 300 tests today, and the map, the
  dive and MOW-E need suites.
- ☐ The save is v3 (the new fields in §8), and v2 saves migrate.
- ☐ `make preflight` is green, and there are no console errors in a
  60-minute session.
- ☐ `game-design.md` and the README are current: controls, venues, the map
  and diving.

### 1.2 Every remaining gap, ranked

The ranking is by harm to a 4-player first session, then by everything else.

| # | Gap | Why it ranks here | Build item |
| --- | --- | --- | --- |
| 1 | The wand is gated on the cart | It blocks the first KPI for 3 days and makes early quotas a coin toss | 1 |
| 2 | Day 1 is too slow | 7 minutes, three balls per 100 m round trip, nothing new after minute 2 | 2 |
| 3 | The map has no identity | A flat rectangle: no routes, no callouts, no reason to split except "balls are over there" | 3 |
| 4 | The underwater-at-the-Muni bug and the phantom dock prompt | The first time someone walks there, it reads as broken | 1 |
| 5 | Noise: toasts, the HUD line, dead code, foam, the spigot | It costs readability on a TV and maintenance forever | 1 |
| 6 | Diving is thin | AFK Buddy Air, no gear ladder, and an 84 m walk home dominates the job | 4 |
| 7 | The Club has no new space | The water should turn on; the mower and the pond stop give the Club its own shape | 3, 5 |
| 8 | Kitchen items are interchangeable | Three minigames, one payout: choice without meaning | 6 |
| 9 | Customers are static | Curb Appeal is a dial, not something you see; idle mats look broken | 1, 7 |
| 10 | Venues 2–5 are hollow | A rate multiplier and a dark dial; session 2 and 3 replay the Club | 8–12 |
| 11 | One cart for four players | The best toy has one seat until Tiered | 9 |
| 12 | Settings and first-time hints | PA mode, volumes, sensitivity; hidden buttons | 13 |
| 13 | Xbox performance unmeasured | Customers + crowd + 800 balls haven't been profiled on target | 14 |
| 14 | Docs and pace logging drift | `game-design.md` lags; tuning needs per-shift numbers | 15 |

---

## 2. The feature audit

Every built feature, judged against the owner's test: **is it worth it, is it
meaningful, will a player find it, and does it duplicate another loop?**

Verdicts: **Keep** (as is) · **Rework** (keep, change how) · **Merge** (fold
into another feature) · **Cut**.

### 2.1 The verdict table

**The core loop**

| Feature | Verdict | Why | Concrete change |
| --- | --- | --- | --- |
| Hand pick-up, pocket of 3 | Keep | Pillar 3's opening: one ball by hand | None. Day 1's beginner carries (§6) make it pleasant |
| Personal carrying gear (tube, bucket, push picker) | Keep | The tool ladder, and the first purchase | None |
| The bucket stand (the one bank) | Keep | It's the crew's regroup point, all shift | Never add a second bank. The Pneumatic Ball Tube (§4) banks *at* the stand |
| Sprint and stamina | Keep | The owner's day-1 fix, and it feels good | Show the hint "RS / Shift sprint" on days 1–2 |
| Shoes | Keep | Stretches sprint, a cheap early buy | None |
| Hard hats | Keep | One row, a real BONK, a $35 joke that pays | None |
| The shop, open any time | Keep | Removes report-screen dead time | Add a corner glyph "☰ Shop" on days 1–2 |
| Hired help | Keep | Solo's lifeline | Helpers wade the creek at ×0.5 (§3) |
| Advertising | Keep | The supply lever | **Cut** round 1's unbuilt "a muddy sign halves ads". It's an invisible rule |
| Picker cart, reels, self-unload | Keep | The best toy in the game | The creek blocks it except at the Cart Bridge (§3) |
| Wide gang reels | Keep | A clean tier 2 | None |
| Run-over knockdowns | Keep | The cart's comedy, and stand-side chaos | None |
| Crew bays plus the real swing (`swing.js`) | Keep | A real verb, and it makes Hit the Cart a skill | **Cut** the dead hold-to-swing path: `charging`, `SWING_FULL`, `#meter`, and `releaseAct`'s swing branch |
| Ping prizes and Hustle (capped ×2) | Keep | The co-op trick shot | None |
| Knockdowns and the spill | Keep | Readable, funny, and the reason for hard hats and grime | None |

**Upkeep and washing.** The owner's question was whether three wash verbs
are too many. The answer is that there are really **two** verbs and one
redundant button:
- **The wand** cleans *things*: the sign, the mats, the stand, the cart and
  your crewmates. Spraying the cart and spraying a fixture are the same
  verb with a different target, not two verbs.
- **The crank** turns dirty balls into *money*. It's the cash-out verb, not
  a cleaning chore, and it should say so.
- **The spigot** (hold Ⓐ at the wash pad to rinse yourself) is the third
  button. It's redundant, so it goes.

The rule players learn: **"The wand cleans things. The washer cleans balls."**

| Feature | Verdict | Why | Concrete change |
| --- | --- | --- | --- |
| The Board, the silo, the pay floats | Keep | Answers "what do I do?" from the sofa | None |
| Curb Appeal fixtures (morning mud, scuffs, dust) | Keep | The first KPI, and Gary's checklist | None |
| The pressure-washer wand | Rework | The cart gate is a blocker (§0 item 1) | Grab it from the pad on day 1, cart or not. The prompt names targets: "Hold Ⓐ to spray · sign · mats · stand · cart · a crewmate" |
| The spigot rinse | **Merge** into the wand | A third button for the same job | Look straight down (pitch < −1.0) while spraying to rinse your own boots: target `self`, 1 layer per 1.5 s. Delete `rinse()` and the `round2.js` spigot hooks |
| Gear grime from every 4 loads | Rework | Grime that creeps up as you work is invisible and feels like a tax | **Grime comes only from knockdowns** ("you landed in the mud"). It's caused by something you saw, so it's visible, and it's what Hose a Friend is for. Delete `loadsSince` |
| Hose a Friend | Keep | The Co-op Advocate's favourite moment | None |
| Cart mud and the cart wash | Keep (it's the wand) | The same verb, and ×1.25 on cart loads is a real reason | None |
| The ball washer crank and hopper credit | Keep | A slot machine you build yourself; a station for one Rat at 4 players | Use money-first language so it isn't read as a third wash chore: "Hold Ⓐ: crank $84 out of the washer". The Board's line reads `WASHER $84 WAITING` |
| Electric and industrial washers ("Brent") | Keep | Pillar 3: the crank job gets bought out | None |
| Turbo nozzle, covered bays | Keep | Club money sinks that change the chores | None |

**Corporate**

| Feature | Verdict | Why | Concrete change |
| --- | --- | --- | --- |
| Memo, quota, stamps, titles | Keep | The shift's finish line | None |
| Last Call and glow balls | Keep | The shift's end | None |
| Gary, the huddle, commendations | Keep | The shift's middle | Add the **pond stop** at the Club (built with the map). Add the XS **"Gary has noted your enthusiasm"** ring when a crew ball hits his cart |
| Promotion, the franchise agreement, the reveal | Keep | The session's climax | The Club reveal gains the **water-on beat** (§3.6) |
| Later venues, reveal-only | Rework | A rate and a dark dial is a hollow promotion | Each venue gets its map rule, live KPI and toy (§3.6, build items 8–12) |
| The Corporate PA | Keep | Rare and loud, as pillar 5 asks | Add the settings toggle (voice or captions only) |
| Ball debut memos | Keep | Each new ball is an event | None |
| The ledger and awards | Keep | Read out loud, as intended | None |
| Crew records | Keep | Feeds the record line and endless | None |
| Ready Up | Keep | Nobody loses the report | None |
| New Hire Kit | Keep | Late joiners aren't stranded | None |
| The Last Bucket, endless mode | Keep | The punchline | None |
| CCTV and flags | Rework | Good job, undiscoverable button | The Club reveal toast names it: *"D-pad down: Corporate CCTV."* CCTV shows the map's callout labels. Move feed 3 (FAR FIELD) to (0, 22, −188) at the new back net |

**The kitchen**

| Feature | Verdict | Why | Concrete change |
| --- | --- | --- | --- |
| Fries, hot dogs, beer | Rework | Three good minigames, but all three pay the same baskets, so the choice is cosmetic | **A menu by venue, and a role for each item** (build item 6): fries at the Muni, hot dogs from the Club, beer from Tiered |
| Hold-to-peel `peel` | **Cut** | Dead since the kitchen opened (§0 item 4) | Delete `Crew.peel`, the `peel` input, `FRIES.PEEL_SECS`, and the `peeling`/`peelSecs`/`peelSent` variables in `main.js` |
| Electric peeler, fry conveyor | Keep | The kitchen's automation ladder | None |
| Fries go cold overnight | Keep | Keeps the cook employed every day | None |

**The pond**

| Feature | Verdict | Why | Concrete change |
| --- | --- | --- | --- |
| Diving (20 s of air, a bag of 10, lead) | Rework | The walk home is longer than the dive | §4 |
| Buddy Air (hold Ⓐ on the dock) | Rework | Holding Ⓐ gives the diver infinite air, and the pumper is AFK | Crank to pump, and haul the bag up (§4) |
| Lead balls | Keep | The diver's money | Lead settles in the Deep End (§4) |
| `scuba.js` visuals | Keep | It's the "fancy" | Tint the water by Pond Clarity, and the junk becomes treasure (§4) |

**Balls**

| Feature | Verdict | Why | Concrete change |
| --- | --- | --- | --- |
| Range, glow, lead, splitter, bouncy | Keep | Each changes what you do: a rush, a dive, a surprise, a chase | None |
| Gold | Rework | 1 in 200, but nobody sees where it lands | A **beacon**: a vertical sparkle column, visible from 100 m for 10 s after it lands, so someone calls "GOLD by the Rock!" |
| Square | Keep | It's free, and it's a joke | **Move its debut to day 5.** Day 3 already has Gary and gold |
| Foam | **Cut** | The only ball that makes the crew poorer. Its drift is a constant push nobody reads. Pink, worth half: noise | Remove it from `pickKind`, `KIND_W`, `KIND_PHYS`, `KIND_NAMES`, `KIND_BLURB`, `DEBUT_PA`, `PA_LINES.foam`, `KIND_COLOR` and the tests. An old save's `debuts` may still list `foam`, which is harmless |
| `KIND_DEBUT` | **Cut** | Unused, and stale | Delete it |

**Presentation**

| Feature | Verdict | Why | Concrete change |
| --- | --- | --- | --- |
| Golfers at the mats (`people.js`) | Rework | Golfers on idle mats look broken; the lifecycle is unbuilt | **Now:** hide the golfers on mats ≥ `activeMats(online)`. **Later:** the lite lifecycle (build item 7) |
| Scenery | Keep, then adjust for the map | Pretty, and it frames the range | Move the target-green decals to the flags. Mowing stripes 128 m wide (the nets), not 80. Keep the tufts out of the creek. Back net to z −190 (§3) |
| Yardage flags (in `main.js`) | **Merge** into the map's landmarks | Two marker systems (flags in `main.js`, greens in `scenery.js`) that disagree | Red, Yellow and Blue become 6 m landmark flags at the §3 coordinates |
| Ambience | Keep | Cheap, and it sells the place | Duck it underwater (it already does) |
| Toasts | Rework | One slot, overwritten every second at 4 players | Your own events stay centre-screen. A **3-line feed** (bottom left, 3 s each) takes other players' events. Drop others' deposits entirely (the float already shows them), and drop `board` and `fries` toasts |
| The HUD value line | Rework | Ten fields that repeat the Board | Trim it to `BV $x · target $y · gear ×1.17`. The Board carries the rest |

**Specced earlier, never built**

| Item | Verdict | Why |
| --- | --- | --- |
| Sprinkler malfunction, gravel truck | Cut | MOW-E (§3.5) is the Club's field hazard, and morning mud already varies the chores |
| Rain days and the forecast | Cut | Policy of the Day was vetoed in round 1. Morning mud is enough weather |
| A muddy sign halves advertising | Cut | Invisible rule |
| Gary's pond stop | Build | With the map (build item 3) |
| The enthusiasm ring | Build (XS) | One branch in `ballHitsCart` for Gary's cart |
| The dive gear ladder | Build | §4 |
| The customer lifecycle | Build, lite | Build item 7 |

### 2.2 Contested calls (votes)

| Call | F | T | P | S | C | L | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cut the foam ball | yes | yes | yes | no | yes | yes | **Cut** (5–1). The Story Keeper wanted it kept as Casual Friday and lost |
| Grime only from knockdowns, and cut the spigot | yes | yes | yes | yes | yes | — | **Adopted**. The Level Designer abstained |
| The kitchen menu by venue | yes | yes | yes | yes | no | yes | **Adopted** (5–1). The Co-op Advocate wanted all three items at the Muni so the cook has choices. The answer: the Muni has one cook and fewer customers |
| Square debut moves to day 5 | yes | yes | yes | no | yes | yes | **Adopted** (5–1) |
| The Lost & Found case returns | lifts veto | yes | yes | yes | yes | yes | **Adopted**. The chair vetoed the shelf in round 2 because "nobody looks at a shelf". Now it pays a finder's fee and comes with a dive moment (§4.4), and the case is just where the trophy ends up |

---

## 3. The map: Dimple Creek

### 3.1 Three pitches

The Level Designer pitched three concepts for the Muni field. All judges
scored all three.

**A. Dimple Creek.**
- A creek crosses the field on a diagonal, feeds the pond, and drains to a
  grate at the right net.
- It splits the field into a **Near Field** and a **Far Field**, with three
  crossings: a plank, a cart bridge and stepping stones.
- It's dry at the Muni, a gravel bed that traps balls into a pile line.
- The Club turns the water on, and the creek becomes a free conveyor to the
  pond.
- The physics stays flat, plus a surface lookup.

**B. The Bowl.**
- The whole landing area is a shallow amphitheatre, so every ball rolls
  toward a central drain.
- Carts circle the rim.
- It needs a heightfield from day 1.

**C. The Quarry Terraces.**
- The far field is an old quarry floor, 4 m lower, reached by two ramps.
- Balls that roll over the lip drop down.

| Concept | F | T | P | S | C | L | Sum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **A. Dimple Creek** | 4 | 4 | 4 | 4 | 5 | 5 | **26** |
| B. The Bowl | 2 | 2 | 4 | 3 | 3 | 3 | 17 |
| C. The Quarry Terraces | 4 | 1 | 3 | 3 | 4 | 4 | 19 |

- **Fun Expert on B:** "If everything rolls to one spot, there's no
  searching. The bowl solves the game you're supposed to play."
- **Technical Director on C:** "A cliff is a discontinuity. Balls, players,
  carts, helpers and Gary all need collision with it. That's L, and it isn't
  tonight." (A veto on C *for now*. The two-level idea is parked for
  post-1.0.)
- **Level Designer:** "A wins because it gives the crew **lanes**. B's
  bowls are a great *Tiered* feature: Topgolf targets are bowls. They go
  there."

**Adopted: A.** B's bowls move to the Tiered range (§3.6). C is parked.

**Hazard and shortcut pitches**, scored the same way:

| Pitch | F | T | P | S | C | L | Sum | Result |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **MOW-E**, the autonomous mower: it rakes a lane of balls into a tidy row and flattens anyone in it | 5 | 4 | 4 | 5 | 5 | 5 | **28** | **Adopted for the Club** (§3.5) |
| Plank, Stones and wading as crossings | 4 | 5 | 4 | 3 | 4 | 5 | 25 | Adopted, as part of A |
| Sprinkler zones: they rinse you and mud the mats | 3 | 4 | 3 | 3 | 3 | 3 | 19 | Cut: a third wash interaction, the thing the owner warned about |
| The Culvert: a pipe you walk through where balls can't hit you | 3 | 4 | 3 | 2 | 2 | 4 | 18 | Cut: it rewards avoiding the field |
| A zipline off a hill | 4 | 2 | 3 | 3 | 3 | 3 | 18 | Cut until the heightfield exists. Revisit with the Knoll (§3.7) |

Geese were raised and ruled out of order. They're Golden Hour Golf's, and
round 1 excludes them.

### 3.2 The Level Designer's rules for this map

1. **One hub, three lanes.**
   - The yard behind the mats is the hub; never move it.
   - The field has a **left lane** (on foot), a **centre lane** (the pond)
     and a **right lane** (the cart).
   - Four Rats naturally take one lane each, plus the yard.
2. **Every landmark is a callout *and* a pile spot.** If a place has a name,
   balls collect there or something happens there.
3. **Shortcuts trade speed for exposure.**
   - Wading is anywhere-but-slow.
   - The Plank and the Stones are fast but narrow.
   - The Cart Bridge is the only way a vehicle crosses.
4. **Telegraph every hazard for at least 10 s with a ground decal**, the way
   Gary's route already does.
5. **One new rule per venue.** The map evolves by *adding* (Lethal Company
   moons, not new levels), so a crew never relearns the hub.
6. **Cut dead space.**
   - Customers' longest carries stop by about z −160.
   - The back 30 m behind the net at z −220 is empty walking.
   - The back net comes in to z −190.

### 3.3 The Muni field, top-down

Axes:
- x runs left to right, −64 to +64, inside the side nets.
- z runs down range, from +9 (the fence) to −190 (the back net).
- Customers hit toward −z.
- One column is 4 m and one row is 8 m.

```
        x: -64                       +64
   z      ------------- fence -------------
    8   |                       S         |     S  the stand / the yard (inset below)
    0   |  M       b ==========b          |     == the 10 mats   b crew bays (±23, 0)
   -8   |                                 |     M  Mower Shed (Club+)
  -16   |                                 |
  -24   |                                 |  <- MOW-E lanes, near field: z -24 / -36
  -32   |                                 |
  -40   |~~~~                             |     ~  Dimple Creek (inflow branch)
  -48   |   ~~~~        R                 |     R  Red flag (-4, -48)
  -56   |       P~~                       |     P  the Plank (foot bridge)
  -64   |         ~~~                     |
  -72   |           OdDOO                 |     O  the pond   D dock   d the Delta
  -80   |           OOOOO       Y         |     Y  Yellow flag (26, -76)
  -88   |            OOO~~~               |     ~  Dimple Creek (outflow branch)
  -96   |                 ~~~~H           |     H  the Cart Bridge
 -104   |                     ~~~~~s~     |     s  the Stones
 -112   |                            ~~~~G|     G  the Grate (right net)
 -120   |                                 |  <- MOW-E lanes, far field: z -120 ... -160
 -128   |    T                            |     T  the Old Tractor
 -136   |                                 |
 -144   |               U                 |     U  Blue flag (-6, -140)
 -152   |                         @       |     @  Dimples Rock
 -160   |                                 |
 -168   |                                 |
 -176   |                                 |
 -184   |                                 |
-190   |#################################|     the Back Net (it catches; balls pile here)

        NEAR FIELD = between the mats and the creek     FAR FIELD = beyond the creek
        left lane: Mower Shed -> Plank -> Tractor       right lane: yard -> Yellow -> Cart Bridge -> Rock
        centre lane: Red -> the dock and the Delta -> Blue
```

**The yard (the hub), unchanged.** It's the inset, at about 2 m a
character, for reference:

```
 z\x   12   16   20   24   28   32   36   40   44
 +11   [SIGN 14,11]   (outside the fence; spray it from inside)
 +9.5  ------------fence----------  cart gap 28..34.5  ------
 +10                            [CART PARK 31,10]
  +6         [WASHER 21.5,6]  [STAND+BOARD 26,6]          [SHED counter 42,6]
              L 20.1   R 22.9
  +3                                  [WASH PAD + WAND 36,3]
   0   =mat 18=      [BAY 1  23,0]
```

### 3.4 Coordinates and rules

All of this lives in **one table, `MAP`, in `sim.js`**. The client's
`terrain.js` only draws it.

```js
export const MAP = {
  FIELD: { xMin: -64, xMax: 64, zMin: -189, zMax: 9 },        // inside the nets (was ±150 × -290..9)
  NETS:  { side: 64.5, back: -190 },                          // they catch everything; no fly-overs
  CREEK: {
    HW: 1.6,                                                  // half-width, m (3.2 m wide)
    IN:  [[-64, -38], [-46, -46], [-30, -58], [-17.3, -72]],  // inflow: left net -> the pond's inlet (58.6 m)
    OUT: [[-5, -82], [8, -96], [28, -102], [46, -108], [64, -114]], // outflow: the pond's outlet -> the Grate (78 m)
    DRIFT: 1.5,                                               // m/s, the current (Club+)
  },
  DELTA: { x: -17, z: -72, r: 2.5 },                          // where creek-fed balls settle in the pond
  GRATE: { x: 63, z: -114, r: 2.5 },                          // where outflow balls pile up, at the right net
  BRIDGES: [
    { id: 'plank', x: -38, z: -52, len: 5, w: 1.4, cart: false },   // across IN seg 1, foot only
    { id: 'cart',  x: 18,  z: -99, len: 6, w: 5.0, cart: true  },   // across OUT seg 1, the only vehicle crossing
    { id: 'stones',x: 40,  z: -106,len: 4.5,w: 1.2, cart: false },  // across OUT seg 2, foot only
  ],
  FLAGS: [{ id: 'red', x: -4, z: -48 }, { id: 'yellow', x: 26, z: -76 }, { id: 'blue', x: -6, z: -140 }],
  ROCKS: [{ id: 'dimples', x: 34, z: -150, r: 2.2, h: 2.2 }],      // a 1962 promotional boulder in a necktie
  BOXES: [{ id: 'tractor', x: -48, z: -128, w: 3.2, d: 1.8, h: 2.0 }], // FHI Grounds Unit 1, retired 1971
  MOWER_SHED: { x: -58, z: 4 },                                // Club+
};
```

Each bridge spans its creek segment at right angles. The yaw comes from the
segment direction, so it isn't stored.

**Surfaces** (shared physics). There's a 1 m grid built at import from
`MAP`, a `Uint8Array` of 128 × 199 cells. The lookup is
`surfaceAt(x, z, world)`.

| Surface | Where | Ball physics | Walking |
| --- | --- | --- | --- |
| fairway | everywhere else, and bridge decks | as today | ×1 |
| **gravel** | the creek bed at the **Muni** | it lands dead: roll ×6, bounce ×0.4 | ×0.8 |
| **mud** | the drained pond at the **Muni** | sticks where it lands, like a square ball | ×0.8 |
| **water** | the creek at the **Club and up** | **drifts** (below) | wading ×0.5 |
| (pond) | the pond at the Club and up | sinks, as today | dives, as today |
| track | the Ping Track (Stadium, §3.6) | roll ×0.6, so it runs on | ×1 |

**The nets** catch everything.
- When a ball crosses x = ±64.5 or z = −190, it's clamped to the net.
- Its normal velocity reverses at ×0.1 and its tangential velocity is kept
  at ×0.4, so it drops at the net.
- That gives the field two new pile lines, **the Back Net** and **the side
  nets**, and it stops crew drives from vanishing into the trees.

**Obstacles.**
- **Balls** reflect off Dimples Rock (a circle) and the Old Tractor (a box)
  below their heights, at ×0.5. Balls pile on their uphill sides.
- **Players** are pushed out on the client only (it's a cooperative trust
  model, as with walking today).
- **The cart** is blocked by `cartBlocked`.

**The creek at the Club and up: the free conveyor.** A ball that lands in
the water doesn't sink. It **drifts**:
- **On the inflow branch**, it floats along the polyline at 1.5 m/s to the
  **Delta** and sinks there. That's at most 39 s, and the Delta is a pile
  for the diver, 5 m from the dock.
- **On the outflow branch**, it floats to **the Grate** and rests in a pile
  at the right net. That's at most 52 s, and it's a cart run along the
  near bank.
- **Rules for drifting balls:**
  - The path is deterministic: `creekPoint(branch, s)` is shared, so the
    server and the client agree with no streaming.
  - A drifting ball can't be picked up tonight. It can be grabbed from
    the bank in a later version.
  - Every bulk path skips it, as it does for kind `one`: reels, scoop,
    jackpot, helpers and MOW-E.
- **The event:** `{t: 'drift', id, branch, s0, v}`. It ends in `sink` (at
  the Delta) or `rest` (at the Grate).
- **The story:** *"Corporate has turned the water back on. Please do not
  drink the creek."* (This is the reveal memo, §3.6.)

**At the Muni the creek is dry.** The gravel bed stops every ball that lands
in it, so it becomes a **pile line** 3 m wide from the left net to the
pond, and on from the pond to the Grate.
- On day 1, with beginner carries (§6), the left half of the bed is in
  easy walking range: that's the crew's first "everybody, the creek's
  full!"
- The drained pond is a mud flat behind CLOSED tape. Its FHI sign reads
  **POND · CLOSED FOR SYNERGY**, which matches the Board's dark Pond dial.
  Balls stick in the mud, and nobody dives.

**The cart and the creek:** `cartBlocked(x, z, world)` is true when the cart
is:
- within `HW + 1.0` of the creek (2.6 m) and not on the Cart Bridge's deck;
- inside the pond (or the mud flat) plus 1 m;
- inside a rock or box plus 1.2 m;
- outside `FIELD`.

`stepCart` (the client's prediction) and `driveTo` (the server) both call
it. A blocked step reverts and bumps (`v *= −0.2`). It's the same rule wet
or dry, because the Muni's bridges "were built for the old creek." The
route the cart learns on day 4 is the route it keeps.

**People and the creek.**
- Rats wade anywhere, at ×0.8 dry or ×0.5 wet. The bridges and stones are
  full speed.
- The server's walking clamp already allows the top sprint speed, so it
  needs no change.
- Helpers wade too: in `stepHelpers`, `HELPER_WALK × 0.5` in the water.
- Gary drives straight through. *"Gary does not use bridges."*

**Gary at the Club** adds the **pond stop** `{id: 'pond', x: −12, z: −64}`,
just behind the dock. It passes with `sunk ≤ 8`. His route is now:
sign → mats → cart → **pond** → kitchen → stand. That's about 30 s longer,
and the warning still gives 45 s.

**Gold beacons** and **CCTV labels** use the landmark names: Red, Yellow,
Blue, the Plank, the Bridge, the Stones, the Grate, the Delta, the Rock, the
Tractor and the Back Net.

### 3.5 MOW-E, the Club's hazard

FHI Autonomous Mower Unit E. It's Gary's pattern again: a scheduled moving
thing with a telegraph. The twist is that **it helps**.

**When:**
- once a shift, from the Club's 2nd day;
- at 25% of the shift, which is 105 s in;
- Gary comes at 43%, so they never overlap.

**The warning (12 s):**
- a two-tone horn;
- the Board flips **MOW-E · LANE z −132 · 0:12**;
- a 4 m-wide striped decal appears across the field at the lane.

**The lane** is the candidate with the most resting balls. The candidates
avoid the creek and the pond:
- near field: z −24, −36;
- far field: z −120, −132, −148, −160.

**The drive:**
- MOW-E rolls out of the **Mower Shed** at (−58, 4), crosses from
  x = −64 to x = +64 at 4 m/s (32 s), and parks at the right net. The
  night crew brings it home.
- **Balls** within ±2 m of the lane that it reaches get **raked into a
  windrow**: moved to z = lane + 2.4, toward the mats, keeping their x,
  with ±0.3 m of jitter, and set to rest.
  - Scattered balls become one tidy row, which is a single pass for the
    cart's reels. *"MOW-E has organised your balls."*
  - It sends one batched event a tick: `{t: 'rake', ids, z}`. The client
    hops each ball to the row in 0.3 s.
- **Rats and helpers** within 1.3 m are knocked flat (`knockDown(p,
  'mower')`). That means grime, so someone gets hosed.
- **The cart** in its path: MOW-E stops and honks (`{t: 'honk'}`) until the
  cart is 3 m clear. The cage is safe.
- **A crew ball** hitting MOW-E: *"MOW-E has logged the impact."* It's a
  ring, with no prize.

**The PA** (once): *"Corporate has deployed an autonomous mower. It has been
trained on your movements."*

**Why it works for four players:**
- The lane decal makes the crew split in two: clear the lane, or get out of
  it.
- The windrow then gives the cart driver an obvious target.
- It's Fall Guys' readable telegraph, and the payoff is co-op, not a
  punishment.

### 3.6 How the map evolves per venue

There's one new rule per venue, and the hub never moves.

| Venue | Map change | The rule it adds | New callouts | Build |
| --- | --- | --- | --- | --- |
| **Muni** | Dry creek (gravel), the drained pond (mud), the Plank, the Cart Bridge, the Stones, the flags, the Rock, the Tractor, the nets at ±64 and −190 | The creek bed is a pile line. The cart crosses only at the Bridge | Red, Yellow, Blue, Plank, Bridge, Stones, Rock, Tractor, Back Net | Item 3, tonight |
| **Range Club** | **The water turns on.** The reveal gets a new beat at 1.5 s: a wash of water runs down the creek bed from the left net and the pond fills. Painted rails go on the bridges, a **Dive Shack** goes on the dock, and the **Mower Shed** appears at (−58, 4) | The creek drifts balls to the Delta (the diver's pile) or the Grate (the cart's pile). MOW-E's lane, from Club day 2 | the Delta, the Grate, the Shack, "MOW-E!" | Items 3 and 5 |
| **Tiered** | **The heightfield arrives.** Three **target bowls** replace the flags: A at Red (−4, −48), r 7, 1.0 m deep; B at Yellow (26, −76), r 8, 1.1 m; C at Blue (−6, −140), r 9, 1.2 m. They have neon rims, and slick turf (roll ×0.35), so balls roll to the cups | **Bay Utilization** = `1 − ballsInBowls / 40`. Balls in a target block its sensors, and Corporate calls that underutilisation. The chore: empty the cups. The toy: **ball-return gutters**, pipes from each cup to the deck that drain 1 ball a second each to the stand | Bowl A, B, C | Item 8 |
| **Stadium** | **The Ping Track**: a painted paved oval in the near field (centre (0, −30), 34 × 16 m half-axes, 5 m wide). The grandstands are outside the side nets (`venues.js` already has them at ±75) | The cart is ×1.3 on the track, and a ping on the track counts double for **Crowd Sentiment**. Hit the Cart becomes a set piece | the Track, the Turn | Item 10 |
| **County** | **The side nets come down.** `FIELD` widens to x ±134. The picket fences at ±122 (already in `venues.js`) mark **residential strips**, and the creek runs on into the back yards at both ends | Customers spray wider (aim ×2.2), so about 10% land in the strips. Vehicles are blocked at the fences: walk or drone. **Zoning Compliance** = `1 − strays / 30` | the Yards, the Mailboxes | Item 11 |
| **Orbital** | The elevator moves into the **left yard** at (−44, 5). `venues.js` has it at (32, 18), outside the walkable field | **EVA** is the dive code re-skinned (§4.6). The debris ring circles the elevator | the Lift | Item 12 |

**Technical Director's note on the Tiered deck:** `venues.js` builds it
across x ±23.5 at z 2–6. That's on top of the washer (21.5, 6) and beside
bay 1. When Tiered is built for real, shorten it to x ±20.

### 3.7 Parked for later

The **Lookout Knoll** goes in once the heightfield has proven itself on the
Tiered bowls:
- a 3 m grassy rise at (−44, −22), r 12, at the Muni;
- balls roll off it into a ring at its foot;
- it's a vantage point for spotting piles without CCTV;
- revisit the zipline idea there.

The two-level Quarry (pitch C) is post-1.0.

```
 Tiered and up (heightfield): bowls a/A, y/B, c/C; the Knoll k/K (parked)
    8   |                       S         |
    0   |  M       b ==========b          |
   -8   |    kkk                          |
  -16   |  kkkkkkk                        |
  -24   |  kkkKkkk                        |
  -32   |   kkkkkk                        |
  -40   |~~~~          aaa                |
  -48   |   ~~~~       aAaa               |
  -56   |       P~~    aaa                |
  -64   |         ~~~                     |
  -72   |           OdDOO     yyyy        |
  -80   |           OOOOO     yyBy        |
  -88   |            OOO~~~               |
  -96   |                 ~~~~H           |
 -104   |                     ~~~~~s~     |
 -112   |                            ~~~~G|
 -120   |                                 |
 -128   |    T                            |
 -136   | ::::::::::::ccccc:::::::::::::: |   : an example MOW-E lane (z -132)
 -144   |             ccCcc               |
 -152   |              ccc        @       |
 -160   |                                 |
 -168   |                                 |
 -176   |                                 |
 -184   |                                 |
-190   |#################################|
```

### 3.8 The Technical Director's buildability verdict

**Tonight: yes to Phase 1, the flat creek.** It's M, one session.

What it changes:
- **Ball physics stays a flat plane.** The changes:
  - `stepOnce` reads `surfaceAt(b.x, b.z, world)`, only when the ball is
    touching the ground;
  - nets clamp the ball;
  - the rock and tractor reflect it.
- **Fairway balls behave exactly as today.** A golden test pins it: a
  `launch()` ball that lands outside every feature lands at the same spot,
  to the millimetre, before and after.
- **Pass `world` in, never use module state.** One Node process runs many
  crews at different venues, so the surface (gravel or water) has to come in
  as an argument: `advanceBall(b, dt, world)` and `stepOnce(b, world)`, with
  `world = {venue}`. The client passes `crew.venue`.
- **The surface grid** is built once at import from `MAP`. It's
  deterministic, 25 KB, and an O(1) lookup.
- **Drifting** is a new ball state with a shared path function. It's the
  same idea as round 2's customer paths: state plus a timestamp, never
  streamed positions.
- **Not tonight:** intercepting drifting balls from the bank.

**MOW-E:** S. It reuses Gary's state machine, `knockDown`, and a batch
event. **Tonight if time allows**; otherwise it's first next session.

**Not tonight: Phase 2, the heightfield.** It's M, its own session, and
lands with Tiered. The plan:
- `groundY(x, z, world)` and `groundGrad(x, z, world)` are a sum of smooth
  cosine features from a `TERRAIN` table in `sim.js`:
  - `h · (1 + cos(πd/r)) / 2` for d < r;
  - bowls have negative h;
  - the Knoll has h = +3.
- `stepOnce` lands on `groundY`, not `BALL_R`, and adds `−G · grad` to the
  rolling velocity. Bowls use roll ×0.35, so a ball on a 12° wall keeps
  rolling to the cup.
- **Every absolute-height check becomes relative to the ground** (about 12
  sites):
  - `stepOnce`'s ground contact;
  - `ballHitsPlayer` (`cy < HIT_H`) and `ballHitsCart` (`cy` between 0.2
    and `CAGE_H`);
  - `pickup` and `cartPickup` (`b.y > 0.4`);
  - the pond landing check (`b.y ≤ R + 0.05`);
  - `spill`'s y of 1.0;
  - the client camera's `EYE`;
  - placing mates, helpers, customers, the cart, Gary and MOW-E;
  - `nearestBall`.
- A golden test: with `TERRAIN` empty, every existing test passes unchanged.

---

## 4. Scuba, properly

**Where it stands.** `scuba.js` already makes the pond beautiful. The *job*
is thin:
- **Air isn't the limit.** The pond is 16 m across. A 20 s mask fills the
  bag of 10 in about 15 s.
- **The walk is the job.** Dock to stand is 84 m (about 20 s each way). A
  trip is 60 s for 10 balls, and two-thirds of it is walking.
- **Buddy Air is AFK.** The pump gives +2 s of air a second against −1, so
  any held Ⓐ means infinite air, and the pumper just stands there.
- **There's no gear ladder.** Round 1 specced mask → tank → twin tanks, and
  it was never built.
- **The junk is set dressing.** The trophy, the sunglasses and the rubber
  duck sit on the bed and do nothing.

**The goals:**
- Diving becomes **the most memorable minute of a shift**.
- It's a real job for one or two Rats at four players.
- It never takes more than about 2 minutes a shift once the crew has the
  right kit.

**How much work the pond makes.** At the Club, four players and no ads:
- lead is 6% of 1.25 swings a second, about 31 a shift;
- the pond's own catch is about 14;
- the creek's inflow is about 12.

That's **about 55 balls a shift** against a clarity scale of 30. Untended,
the dial is empty by the bell. The targets:

| Kit | Time to clear 55 |
| --- | --- |
| Mask, walking | about 5.5 min: a full-time job, which is the "before" |
| Tank, plus the tube | about 2.5 min solo |
| A diver and a hauler | about 2 min |

### 4.1 The Deep End

- A 3 m-radius sinkhole at the far side of the pond, at (−15, −83). The bed
  drops from −1.1 to **−4.5**.
  - In `scuba.js`, the bed becomes a lathe profile, the kelp stays on the
    shelf, and the catfish lives down here.
- **Lead and gold always end up in the Deep End.** In `sink()`, a lead or
  gold ball is placed at a random spot inside it ("they roll"). Treasure
  lives here too.
- **It's dark down there:** the fog's far distance halves.
- **The pressure:** air drains ×2, unless you have twin tanks.
- **Why it works:** the shelf is easy money, and the Deep End is the
  ×3/×10/treasure money. One verb, two risk levels: Deep Rock's "one more
  minute down here."

### 4.2 The dive gear ladder

This is a new personal row in the shop, `dive`, with `minVenue: 1`. Like
carrying gear, it's bought from the crew wallet, it's not price-scaled, and
it's kept by name (`diveByName` in the save).

| Tier | Price | Air | Swim | Bag | In the Deep End | Light |
| --- | --- | --- | --- | --- | --- | --- |
| Mask and snorkel | free at the Club | 20 s | ×0.6 | 10 | air ×2 | none |
| **Scuba tank** | $1,200 | 40 s | ×0.7 | 15 | air ×2 | none |
| **Twin tanks and a dive light** | $5,000 | 70 s | ×0.75 | 25 | **air ×1** | glints at 8 m, and a cone in the Deep End |
| **Dive scooter** (`minVenue: 2`) | $40,000 | 70 s | **×1.3** | 40 | air ×1 | yes |

- **Everyone sees your kit.** Mates render it: a mask, a yellow tank, twin
  tanks, or a scooter in your hands.
- **The air bar** shows your tier's capacity.

### 4.3 Buddy Air v2: pump and haul

Two crewmates on the dock become a pit crew.

**Pump:**
- Pumping uses the **crank input** (it reuses `washer.js`'s crank helper,
  so it's the same feel):
  - **1 turn = +1.5 s of air**, capped at 2.5 turns a second;
  - holding Ⓐ without rotating pumps +0.5 s a second (the accessibility
    path).
- No more infinite AFK air: the pumper works, and the diver feels it.
- **Input:** `{t: 'pump', turns}`, replacing `{t: 'pump', on}`.
- **The hose bubbles** in `scuba.js` boil faster as the cranking speeds up.

**Haul:**
- **The diver:** underwater, with at least one ball in the bag, Bucket
  (Ⓧ / E) **clips the bag to the line**: *"Sent up: 12."* The diver gets a
  fresh empty bag and keeps diving.
- **The buddy:** "Ⓧ Haul up the bag (12)" on the dock. Holding Ⓧ for 1.5 s
  lands it on the dock.
- **The haul goes into the hauler's pocket**, ignoring capacity, the same
  as surfacing does today.
- **If nobody hauls by the bell,** the night crew banks it at half pay.
- **If the diver gasps,** a bag already on the line is safe.
- **Inputs:** `{t: 'send'}` and `{t: 'haul'}`.

**The pit crew, playing:** the diver never surfaces. The hauler runs bags
to the stand, or into the tube (§4.5). Two Rats, one rhythm. That's the
Co-op Advocate's split-and-regroup in a single station.

### 4.4 Treasure and the Lost & Found case

`scuba.js` already models eight pieces of junk. They become **12
treasures**: the 8 modelled, plus 4 more.

**How a treasure appears:**
- At most one per shift, from the Club on, at a 50% chance each morning.
- It's the next unfound item, in order. **The 1958 scorecard is always
  last**, and only appears from the County on.
- It sinks into the Deep End and glints gold at 6 m (8 m with the light).

**Carrying it:**
- It rides outside the bag, like Ball No. 1 (`p.treasure`).
- A knockdown drops it at your feet, and a gasp sends it back to the Deep
  End.

**Banking it:**
- Bank it at the stand, or by the tube, for a **finder's fee of 200 × BV**
  (about $2,000 at the Club). Corporate pays it *"as a gesture."*
- A memo card shows the item's blurb.
- It goes into the **Lost & Found case**, a glass case on the stand with
  one mesh per item. The found item is hidden from the pond bed.
- The report reads *"Lost & Found 4 / 12."*
- It's saved as `lostFound: [ids]`.

| # | Item | Blurb on the memo card |
| --- | --- | --- |
| 1 | Car keys | "A 1994 Buick. Still unlocked." |
| 2 | The 1987 Club Champion trophy | "Engraved: GARY. Corporate has no comment." |
| 3 | Sunglasses | "Gary's. He has other pairs. He has many pairs." |
| 4 | A rubber duck in a necktie | "Middle management." |
| 5 | One boot | "Size 13, left. The right is still out there." |
| 6 | A golf club | "Thrown in anger, 1991. The anger remains." |
| 7 | A traffic cone | "Nobody knows. Corporate has stopped asking." |
| 8 | A tyre | "From a cart that is no longer with us." |
| 9 | A Dimples lapel pin | "One eye scratched out. Dimples has forgiven you." |
| 10 | A waterlogged memo | "Stamped URGENT. Unreadable. Corporate confirms it was important." |
| 11 | A VHS tape | "*Ball Retrieval Training (1979).* You are already doing it wrong." |
| 12 | The 1958 scorecard | "Hole 1: LOST BALL. Signed by the founder." This foreshadows Ball No. 1, so it's County and up only |

**The time-sink guard:** one treasure a shift, so a crew never stays down
just to farm junk.

### 4.5 The pond's automation ladder

Diving gets pillar 3's ladder, like every other job. It's a new crew row,
`pond`, with `minVenue: 1`, and it's price-scaled.

| Tier | Price | What it does |
| --- | --- | --- |
| **Pneumatic ball tube** | $4,000 | A red FHI box on the dock. Ⓧ feeds your carried balls in, and they bank at the stand 6 s later with a THUNK and the usual float, at the gear factor you had when you fed them. *"Installed 1987. Works, mostly."* |
| **Pond pump** | $15,000 | Clears one sunk ball every 8 s through the tube, all shift. Diving becomes the Deep End and the treasure |
| Yellow submarine | Stadium, post-1.0 | The design doc's absurd endgame, parked |

**The Co-op Advocate's rider (adopted):**
- The tube removes the diver's walk, and with it a regroup at the stand.
- So the haul (§4.3) is **free and comes first**, and the tube is a real
  purchase.
- Gary's huddle and the report still bring everyone to the stand.

### 4.6 Making it look and sound like a highlight

`scuba.js` already has the base. These go on top of it:
- **The water's colour is Pond Clarity.**
  - The surface plane and the underwater fog lerp from clear teal at
    clarity 1 to murky brown-green at 0.
  - The fog's far distance is `6 + 8 × clarity` metres.
  - It's the KPI you can see from the yard. Pass `clarity` into
    `scuba.tick(state)`.
- **The plunge:**
  - stepping off the dock edge plays a splash ring, a 0.3 s camera dip and
    a muffled thump as ambience switches to underwater;
  - surfacing plays a gasp, a spray of droplets, and a float showing the
    bag count.
- **Sound:**
  - a **glint ping** (a soft bell, panned) when gold or a treasure comes
    within light range;
  - a heartbeat under 5 s of air, alongside the vignette `scuba.js`
    already has.
- **The catfish** circles the Deep End and scatters the fish as you pass.
  It's cosmetic. *It has no name.* It's not golf's.
- **The Orbital reuse (EVA):**
  - the same module with a palette swap: black water, stars and the Earth's
    glow;
  - the air bar becomes oxygen, and hauling becomes the winch at the
    elevator car;
  - it's one flag in `createScuba(…, {mode: 'eva'})`.

### 4.7 Playtest checks

- At 4 players at the Club, two Rats form a pit crew (one pumping or
  hauling, one diving) unprompted by Club day 2.
- Afterwards, someone names the dive as the highlight of the session.
- With twin tanks and a hauler, the pond goes from 55 sunk to under 8 in at
  most 2.5 minutes.
- Solo with the tank and the tube, the pond clears in at most 3 minutes, and
  the shift still has time for everything else.
- The first treasure gets read out loud.
- Nobody dives longer than 4 minutes in a shift **unless** they chose to be
  the diver.

---

## 5. Multiplayer first: the check

### 5.1 Jobs at the same time, 4 players

| When | The distinct useful jobs | Count | Verdict |
| --- | --- | --- | --- |
| Muni day 1 (4 min) | Pick (anyone), the wand on the sign (one wand) | 2 | Thin but short. It's a tutorial day; the wand fix makes it 2, not 1 |
| Muni day 2 | + crank (2 handles), the creek-bed pile run, Last Call | 3–4 | OK |
| Muni day 3 | + Gary prep (sign, mats, stand), the cook (if the shed's bought) | 4–5 | Good |
| Muni day 4–5 | + cart driver, + the bays (Hit the Cart), the Bridge route | 6–7 | Good. The cart has one seat, but two bays give it a supporting cast |
| Club | + diver, pump/haul, CCTV, MOW-E lanes, the Grate run | 9–10 | Rich. The Club spree buys out crank (industrial), cook (conveyor), mats (covered) |
| Tiered and up | + second cart, bowl cups, beer | 9–10 | Each venue retires a job and adds one |

The Level Designer's lane test, Club, 4 players:
- **left lane:** a Rat picking the creek bed and the Plank side;
- **centre:** the diver at the Delta;
- **right lane:** the cart at the Grate and the Bridge;
- **the yard:** cook, crank and wand.

That's four Rats doing four different things in four places, with the stand
as the crossroads.

### 5.2 Regroup moments per shift

| Moment | Built? | When |
| --- | --- | --- |
| **Clock in at the yard** | **New** (XS, build item 2) | Each morning, every online Rat starts on the yard line (x 18–30, z 4), facing the field, and the memo plays. It's the locker room grime reset made visible, a fair start, and the reveal's framing |
| Banking at the stand | ✅ | All shift |
| Gary's huddle | ✅ | Day 3 on, mid-shift |
| The bell, the report, Ready Up, signing | ✅ | End of shift |
| The reveal | ✅ | After each promotion |
| The Last Bucket | ✅ | Once |

That's at least 3 per shift from day 3 (clock-in, Gary, the bell), plus
banking. **It passes.**

### 5.3 Solo

- **Every chore has an automation tier by its venue's third day:**

  | Chore | Automation |
  | --- | --- |
  | picking | helpers, then the cart |
  | the crank | the electric washer |
  | cooking | the peeler, then the conveyor |
  | the mats | covered bays |
  | the pond | the tank, the tube, then the pump |

  The wand has no automation tier, and doesn't need one: the sign and the
  stand dust slowly.
- **Hit the Cart needs two Rats** (a driver and a shooter), so solo never
  earns Hustle. That's accepted. It's round 1's "the asymmetry is the design
  working," and solo's lever is helpers.
- **Diving solo:** the Deep End's ×2 drain makes the twin tanks a real
  goal. The tube removes the walk.
- **MOW-E solo:** one lane, one Rat. The windrow is still a win.

### 5.4 Six players

Mats cap at 10 from 3 players, so the 5th and 6th Rat are upkeep labour,
which the design wants. **Check:**
- the roster fits 6 rows;
- the six colours are distinct on a TV (`#e8604c`, `#4c9be8`, `#f2c94c`,
  `#6fcf7c`, `#b07ce8`, `#f29e4c`: the 1st and 6th are close, so swap the
  6th for a teal `#3fc1c9`);
- the ledger fits 6 lines.

---

## 6. Pacing

### 6.1 Is day 1 too slow? Yes, and here's why

1. **It's 7 minutes long**, but it teaches its last new thing (buying a
   tube) by about minute 2.
2. **Picking is three balls per 60–100 m round trip.** Customer carries run
   12–140 m.
3. **The wand is gated on the cart**, so the one other verb on day 1 is
   missing.
4. **Nothing new happens after the first purchase:** no quota, no Last Call,
   no Gary. By design, but that left 5 empty minutes.

Sprint and the shop-any-time fixed the symptoms. The council fixes the
causes.

**The fix: build item 2.**
- **Day lengths 4 / 6 / 7.** Day 1 is 240 s, day 2 is 360 s, and day 3 on is
  420 s. `SHIFT_SECS` still overrides all of them for testing.
- **Beginner carries on day 1.**
  - Customer launch speed is ×0.7, so carries are about half: 6–70 m.
  - Hand picking roughly doubles, and the dry creek bed's left half fills
    within reach.
  - Story: *"Corporate has scheduled a beginners' clinic."*
- **The wand from minute 0** (build item 1).
- **A first-purchase nudge.** The first time crew cash reaches $20 on day 1,
  a toast reads *"☰ / Tab: buy a retriever tube."*
- **The square ball debut moves to day 5.**

### 6.2 The first 60 minutes, 4 players

A shift plus its report: day 1 is about 4:40, day 2 about 6:40, and day 3 on
about 7:40.

| Minute | Day | Venue | What happens |
| --- | --- | --- | --- |
| 0:00 | 1 | Muni | Clock in at the yard. The `welcome` line. Beginner carries. Someone grabs the wand and hoses the sign: the Board flips. Tubes all round by about 1:30. "The creek bed's full!" Earned about $250–350 |
| 4:40 | 2 | Muni | The first memo and quota. The hand-crank washer: "$X waiting" teaches the crank. Sneakers. Last Call and glow (the `glow` line). The Next Goal strip |
| 11:20 | 3 | Muni | **Gary's first walkthrough** and the huddle. The first gold ball (with its beacon). The snack shed, so the cook appears. The first record shift. Buckets |
| 19:00 | 4 | Muni | **The cart.** The driver learns the Cart Bridge. Hit the Cart from the bays, and the first PING. The electric washer |
| 26:40 | 5 | Muni | Square balls. Helpers, a push picker. Usually the third stamp |
| 33:40 | 5 (report) | Muni | **The franchise agreement:** all four sign. Fee $5,500. The bookmark: "Range Club tomorrow" |
| 34:20 | 6 | **Club** | **The reveal and the water-on beat.** The ×5 spree: industrial wash, covered bays, the conveyor. The pond opens: masks, lead, the Delta. Bouncy balls. CCTV ("D-pad down") |
| 42:00 | 7 | Club | **MOW-E's first lane.** Splitters (day 7). The scuba tank. The first pit crew (pump and haul). Gary's pond stop |
| 49:40 | 8 | Club | **Hot dogs on the menu** (Gary eats one). The first treasure, perhaps. Twin tanks or the tube |
| 57:20 | 9 | Club | The session ends mid-Club: *"Tiered Entertainment Range: 2 stamps to go."* |

**When the Club lands:**
- usually at **minutes 34–42**;
- as early as minute 27 if all three of days 2–4 hit quota and the crew
  saves the fee;
- that's within the 30–42 target, and earlier than round 2's 40. That's on
  purpose: the Club is where the map changes.

### 6.3 The first 60 minutes, 1 player

| Minute | Day | What happens |
| --- | --- | --- |
| 0:00 | 1 | 6 mats, beginner carries. Wash the sign. Tube by about 2:00. About $70 |
| 4:40 | 2 | Quota, Last Call. The hand-crank washer ($40), Kyle ($60) |
| 11:20 | 3 | Gary. Bucket, Madison. Maybe the snack shed ($200) |
| 19:00 | 4 | The electric washer. Saving for the cart |
| 26:40 | 5 | **The cart ($600).** Usually the third stamp |
| 34:20 | 6 | Fee $2,500. Promotion at this report, or the next |
| 35–43 | 6–7 | **The Club reveal.** The pond with the mask; the tank first. Covered bays |
| 43–60 | 7–8 | MOW-E, splitters. The tube. Hot dogs |

**Solo lands the Club around minutes 35–43.**

### 6.4 The ladder across sessions (tuning targets)

| Session | 4 players | Solo |
| --- | --- | --- |
| 1 (60 min) | Muni → Club (days 1–8) | Muni → Club (days 1–8) |
| 2 (60 min) | Club → Tiered (bowls, the second cart) → early Stadium | Club → Tiered |
| 3 (60–75 min) | Stadium (the Track) → County (the Yards) → Orbital (EVA) | Tiered → Stadium → County |
| 4 (60 min) | Endless | Orbital → **the Last Bucket** |

These are unchanged from round 2 for four players. Solo gains a 4th session,
which is honest: the fees are about 3 shifts of solo income each.

---

## 7. The build list (ranked)

Sizes: **XS** is under an hour, **S** is an evening, **M** is one or two
sessions, **L** is more.

**The order bends to dependencies:**
- the fix pack first, because it unblocks the first KPI;
- the map before MOW-E and before the scuba Deep End, which needs the Delta;
- the heightfield (item 8) before any Tiered feature.

### 1. Cut and fix pack · S

**Spec:**
- **Fix: the wand without a cart.**
  - `nearStation()` drops `!!crew.cart`.
  - The wand prompt names its targets.
  - The pad hint reads "Ⓧ Grab the pressure washer".
- **Fix: the Muni pond.**
  - Swim speed, the underwater camera and the dock prompt all require
    `crew.pond?.unlocked`.
  - With the map (item 3), the Muni pond is mud at ×0.8.
- **Fix: golfers on idle mats.** Hide `customers[i]` for
  `i ≥ activeMats(onlineCount)`.
- **Cut** the following:
  - `Crew.peel`, the `peel` input, `FRIES.PEEL_SECS`, and the `peeling`,
    `peelSecs` and `peelSent` variables;
  - `charging`, `SWING_FULL`, the `#meter` element, and `releaseAct`'s
    swing branch;
  - `KIND_DEBUT` and `stats.beers`;
  - the foam ball, everywhere (§2);
  - the spigot (`Crew.rinse`, and the rinse hooks in `round2.js`), replaced
    by the wand's `self` target: pitch below −1.0, 1 layer per 1.5 s;
  - grime per load (`loadsSince`). Grime now comes only from knockdowns.
- **Rework the toasts.**
  - Your own events stay centre-screen.
  - Other players' events go to a 3-line feed, 3 s each.
  - Drop other players' `cash`, `board` and `fries` toasts.
- **Rework the HUD line** to `BV · target · gear`.
- **The ball washer's money-first prompt** and its Board line.
- **The Gary enthusiasm ring** (XS).
- **The gold beacon** (XS).
- **The 6th player colour** changes to `#3fc1c9`.

**Files:**
- `web/js/main.js`, `web/js/round2.js`, `web/js/sim.js`, `server/crew.mjs`
- `web/index.html` (the meter and the feed)
- `web/js/pa.js` (drop `foam`)
- `test/kinds.test.mjs`, `test/council.test.mjs`, `test/round2.test.mjs`,
  `test/economy.test.mjs`

**Playtest check:**
- A fresh solo crew hoses the sign on day 1 before buying anything.
- Nobody goes underwater at the Muni.
- In a 4-player shift, nobody says "what was that?" about a vanished toast.
- The HUD fits on one line on a 1080p TV.

### 2. The day-one pacing pack · S

**Spec:**
- **Day lengths:** `shiftSecsFor(day)` returns 240, 360, then 420. The env
  override still wins.
- **Beginner carries:** `launch(mat, rng, {beginner: day === 1})` scales
  the speed by ×0.7.
- **Clock in at the yard:** `startShift` moves every online Rat to the yard
  line (x 18–30, z 4, yaw toward the field) and unboards any driver. The
  cart goes home, as today.
- **Hints:** a corner glyph strip on days 1–2 reads `☰ Shop · RS Sprint`,
  and the first-purchase nudge fires at $20.
- **The square ball** debuts on day 5.
- **The memo** on day 1: *"Corporate has scheduled a beginners' clinic.
  Balls will land closer. Corporate will not."*

**Files:** `web/js/sim.js` (`shiftSecsFor`, `launch`, `pickKind`),
`server/crew.mjs` (`startShift`, the tick), `web/js/main.js`,
`web/index.html`, `test/sim.test.mjs`, `test/crew.test.mjs`.

**Playtest check:**
- Four new players all hold tubes by 1:30.
- The crew earns $250–350 on day 1.
- Nobody asks "what now?" after minute 2.
- A solo first-timer starts day 2 within 30 s of the report.

### 3. Map phase 1: Dimple Creek · M (tonight)

**Spec:** everything in §3.3–3.4.
- `MAP` in `sim.js`, the surface grid, `surfaceAt`, `creekProject`,
  `creekPoint`, `cartBlocked`, the nets, the obstacles, the smaller
  `FIELD`, and `advanceBall(b, dt, world)`.
- **Server:**
  - creek landings become drift → sink at the Delta, or rest at the Grate;
  - every bulk pickup path skips drifting balls;
  - helpers wade;
  - the cart is blocked in `driveTo`;
  - Gary gets the pond stop.
- **Client, a new `terrain.js`:**
  - the creek ribbon (gravel or water, by venue), with banks;
  - the Plank, the Cart Bridge with rails, and the Stones;
  - Dimples Rock, the Old Tractor, and the three 6 m flags with ground
    discs;
  - the Grate, and the drained pond's CLOSED dressing;
  - `setVenue(v)`, which toggles the water.
- **The reveal** gets the water-on beat at 1.5 s. Its memo line reads
  *"Corporate has turned the water back on. Please do not drink the
  creek."*
- **Scenery:**
  - the greens move to the flags;
  - the stripes go to 128 m;
  - the tufts stay out of the creek;
  - the back net moves to −190 (`netGeo` and the poles).
- **CCTV:** feed 3 goes to (0, 22, −188), and the landmark labels show.

**Files:**
- `web/js/sim.js`, `server/crew.mjs`
- **new** `web/js/terrain.js`
- `web/js/main.js` (wire up the terrain, the wading speed, the yardage
  flags removed, `stepCart` blocked)
- `web/js/scenery.js`, `web/js/round2.js` (the reveal beat),
  `web/js/cctv.js`
- **new** `test/map.test.mjs`:
  - golden fairway landings;
  - gravel stops a ball within 0.5 m;
  - wet drift reaches the Delta and sinks after `len/DRIFT`;
  - the cart is blocked off the bridge and passes on it;
  - the nets keep every ball inside `FIELD`.

**Playtest check:**
- In a 4-player Muni session, players use at least 3 landmark names
  unprompted ("by the Plank", "Blue", "the Rock").
- The driver finds the Cart Bridge without being told.
- At the Club, someone says the creek is feeding the pond.
- Frame time is unchanged to within 1 ms.

### 4. Scuba v2: the Deep End, gear, pit crew, treasure · M

**Spec:** §4.1–4.6.
- **`sim.js`:**
  - `POND.DEEP`;
  - the `dive` row (personal) and the `pond` row (crew);
  - `diveTiers`;
  - `TREASURE` (12 entries);
  - the tube's `TUBE` constants.
- **`crew.mjs`:**
  - `stepPond` takes the tier's air, swim and bag, the Deep End's drain,
    and pump turns;
  - the `send` and `haul` inputs;
  - the tube queue;
  - `sink()` places lead and gold in the Deep End;
  - treasure spawns, carrying it, the finder's fee, and `lostFound`;
  - the pond pump tick;
  - save v3 gains `diveByName` and `lostFound`.
- **`scuba.js`:**
  - the Deep End lathe;
  - the clarity tint;
  - glints and the ping;
  - the plunge and surfacing effects;
  - found junk hidden from the bed;
  - the Lost & Found case mesh;
  - the `eva` mode flag (stubbed).
- **`main.js` and `round2.js`:** prompts, crank-to-pump (it reuses the
  `washer.js` crank helper), and send and haul on Ⓧ.

**Files:** `web/js/sim.js`, `server/crew.mjs`, `web/js/scuba.js`,
`web/js/main.js`, `web/js/round2.js`, `web/js/washer.js` (export the crank
helper if it isn't already), **new** `test/scuba.test.mjs`.

**Playtest check:** §4.7.

### 5. MOW-E · S

**Spec:** §3.5.
- **`MOWER` in `sim.js`:**
  - from venue 1, from venue day 2;
  - at 25% of the shift;
  - 12 s of warning;
  - 4 m/s;
  - the lane candidates;
  - the rake offset, 2.4.
- **`stepMower`** in `crew.mjs`, on Gary's pattern:
  - `rake` batches;
  - knockdowns;
  - the honk at the cart.
- **The client:** a ride-on mower mesh (a white body, a FHI flag and a
  rotating blade deck), the lane decal, the Board flip, and the PA line
  `mower`.
- **The ledger award:** *"Mown Down (Twice)"* for the most mower
  knockdowns.

**Files:** `web/js/sim.js`, `server/crew.mjs`, `web/js/main.js` (or a new
`mower.js` view module), `web/js/venues.js` (the Mower Shed),
`web/js/pa.js`, `web/js/board.js` (the flip), **new**
`test/mower.test.mjs`.

**Playtest check:**
- During the 12 s warning, at least 2 of 4 Rats move out of the lane or
  sprint into it to grab balls.
- The cart driver drives the windrow within 30 s of MOW-E passing.
- Players laugh at the first rake.

### 6. The kitchen menu by venue · S

**Spec:**
- **The menu by venue:**
  - Muni: fries;
  - Club: + hot dogs;
  - Tiered: + beer.
- **Yields:**

  | Item | Perfect | Good | Burnt | Its role |
  | --- | --- | --- | --- | --- |
  | Fries | 3 (+1 for one peel) | 2 | 0 | The workhorse |
  | Hot dog | 2 | 1 | 0 | About half the time of fries. **Gary eats one:** serve a hot dog while Gary is on site (warning or driving) and his kitchen stop passes, whatever the stock. *"Gary had a hot dog. Gary is reasonable now."* |
  | Beer | 2 | 1 | 0 | The fastest, about 5 s: the rescue when stock is crashing |

- The 4 s serve rate limit stays.
- **The menu card** shows locked items as *"COMING SOON — Corporate"* with
  the venue name, so the next promotion has one more visible promise.

**Files:** `web/js/kitchen.js` (`open({menu})`, the locked cards),
`server/crew.mjs` (`serve()` yields, `garyFed`, `inspect('kitchen')`),
`web/js/sim.js` (`FRIES.MENU`, `FRIES.YIELD`), `web/js/main.js`,
`test/round2.test.mjs`.

**Playtest check:**
- At the Club, a cook serves a hot dog *because Gary is coming*.
- At Tiered, a cook switches to beer when the dial is red.
- At the Muni, no new player is confused by three choices.

### 7. The customer lifecycle, lite · M

**Spec.** Round 2's §7, cut down.
- **Arriving:** customers walk in from the gate (−3, 9.5) along
  `ENTRANCE.path` to their mat, at 1.3 m/s.
- **Playing:** each hits a bucket of 30 balls (50 at the Club and up) on
  the existing per-mat timer, then walks out the gate.
- **Refusing:**
  - A mat with mud ≥ 0.9 is **refused**: the arriving customer sulks for
    2 s and leaves.
  - The mat stays empty for 30 s, with no balls. That's Curb Appeal made
    visible.
- **Deterministic paths:** `custPos(c, t)` in `sim.js`. State and t0 cross
  the wire, never positions.
- **No queue tonight.** The early birds take every open mat at the opening.
- **Performance:**
  - at most 14 full figures, with lite capsules over the cap;
  - no shadows;
  - animate every frame within 50 m, and every third frame beyond.

**Files:** `web/js/sim.js` (`CUST`, `custPos`), `server/crew.mjs` (mat
state: `cust`, `st`, `t0`, `look`; the refusal), `web/js/main.js` (the
customers array becomes a per-mat lifecycle), `web/js/people.js` (a bucket
prop on walks; already supported), **new** `test/customers.test.mjs`.

**Playtest check:**
- A first-time player can explain where the balls come from after watching
  one customer.
- In a 4-player session, someone washes a mat *because a customer sulked
  at it*.
- Frame time on the Xbox stays under 20 ms.

### 8. The heightfield and the Tiered bowls · L (M + M)

**Spec, part a (M): the heightfield.** §3.8:
- `TERRAIN`, `groundY` and `groundGrad`;
- slope rolling;
- every relative-height site;
- a golden test with an empty `TERRAIN`.

**Spec, part b (M): the bowls.**
- Three bowls at the flags (§3.6), with neon rims.
- **Bay Utilization** = `1 − ballsInBowls / 40`, as a live dial at
  venue ≥ 2, which raises the ceiling to ×3.0.
- **The ball-return gutters**: a new crew row, `gutters`, with
  `minVenue: 2`.
  - Tier 1 costs $150,000. It drains 1 ball a second from each cup to the
    stand, banked as kind `gutter` at gear ×1.
  - The pipes are drawn from the cups to the deck.
- **Beer unlocks** (item 6).
- **Shorten the Tiered deck** to x ±20.

**Files:** `web/js/sim.js`, `server/crew.mjs`, `web/js/terrain.js`,
`web/js/main.js`, `web/js/venues.js`, `web/js/board.js` (the dial), every
site listed in §3.8, **new** `test/terrain.test.mjs`.

**Playtest check:**
- At Tiered, balls visibly roll into the cups.
- Someone says "Bowl B's full."
- After buying the gutters, the crew watches the first ball roll home and
  cheers.
- Every pre-heightfield test still passes.

### 9–15. The rest of the list

| # | Item | Size | Spec | Files | Playtest check |
| --- | --- | --- | --- | --- | --- |
| 9 | **The second cart (the fleet)** | M | `this.cart` becomes `this.carts[]` (round 2 counted about 20 sites). It's Tiered's toy at $60k. The `fleet` PA line | `server/crew.mjs`, `web/js/main.js`, `web/js/sim.js`, `test/cart.test.mjs` | Two drivers and two shooters at once. Nobody waits more than a shift for a seat |
| 10 | **The Stadium: Crowd Sentiment and the Ping Track** | M | Round 2's §4.2 KPI, plus the `track` surface (an oval centred at (0, −30), 34 × 16 m, 5 m wide). Cart ×1.3 on it; a ping on the track counts double. The crowd stands up on a ping (`venues.js` already bobs) | `sim.js`, `crew.mjs`, `terrain.js`, `venues.js`, `board.js` | The show-off player drives laps of the Track while two Rats ping |
| 11 | **The County: the Yards, strays and drones** | M | `FIELD` widens to x ±134 at venue ≥ 4, and the side nets hide. Customer aim spreads ×2.2. **Zoning Compliance** = `1 − strays/30`. Vehicles are blocked at x ±122. Drones are helpers that fly, ×3 speed, strays first, and never get knocked down | `sim.js`, `crew.mjs`, `terrain.js`, `scenery.js`, `venues.js` | One Rat chooses the long walks to the Yards, the way the diver chooses the pond |
| 12 | **The Orbital: EVA and the debris ring** | M | The elevator moves to (−44, 5). EVA is `scuba.js` in `eva` mode plus the pond rules on a ring around the elevator. **Orbital Debris** = `1 − debris/30` | `sim.js`, `crew.mjs`, `scuba.js`, `venues.js` | The pit crew from the pond reforms at the elevator without being told how |
| 13 | **Settings and first-time hints** | S | A pause-menu settings page: the master, SFX, ambience and PA volumes; the PA mode (voice and captions, or captions only); look sensitivity; invert Y. All of it in `localStorage` behind try/catch. First-time hints for the shop, sprint and CCTV, each shown once | `web/index.html`, `web/js/main.js`, `web/js/pa.js`, `web/js/ambience.js`, `web/js/sfx.js` | A sofa player finds the PA setting without help |
| 14 | **The Xbox performance pass** | S | Profile 4 players, 14 customers, 800 balls and the Stadium crowd on the Xbox in Edge. Use the `lowDetail` path for scenery, customers and `scuba.js` (cut the light shafts and the silt first) | `web/js/scenery.js`, `web/js/people.js`, `web/js/scuba.js`, `web/js/main.js` | At most 20 ms a frame, measured and recorded in `README.md` |
| 15 | **Docs and the pace log** | XS | `game-design.md`: the map, diving, the kitchen menu, the cuts, the day lengths. README: the controls. A dev-only pace log: `?debug` prints per-shift cash, banked, stamps and minutes elapsed, for tuning against §6 | `design/game-design.md`, `README.md`, `web/js/main.js` | The next council reads the numbers, not guesses |

**Post-1.0, parked:**
- the Lookout Knoll and its zipline;
- the Quarry Terraces;
- the yellow submarine;
- intercepting drifting balls from the bank;
- the customer queue.

### 7.1 Tonight

The Technical Director's call: **items 1, 2 and 3**, in that order.
- That's S + S + M, a full session.
- MOW-E (item 5) comes next, if the creek lands early.
- **If the night runs short, stop after item 2.** The first hour is
  already better without the map.

---

## 8. Notes for the build (the council's concerns)

1. **World-dependent physics is passed in, never held in module state.**
   One Node process runs many crews at different venues.
   - `advanceBall(b, dt, world)`, `stepOnce(b, world)`, `surfaceAt(x, z,
     world)`, `cartBlocked(x, z, world)`, and later `groundY(x, z, world)`.
   - `world` is `{venue}` for now.
2. **One `MAP` table, one `TERRAIN` table.** Both live in `sim.js`.
   `terrain.js` only draws them.
3. **New ball states skip the bulk paths.** `drifting` (and, later,
   `treasure`) join kind `one`: the reels, the scoop, the jackpot, helpers,
   MOW-E and spills all skip them.
4. **Save v3:**
   - new fields: `diveByName` (personal, like `gearByName`), `lostFound`,
     and the crew rows `up.pond` and `up.gutters` via `SHOP`;
   - v2 saves load with empty defaults;
   - a v2 save that had bought foam debuts loads fine;
   - `cleanUpgrades` already ignores unknown ids.
5. **The Muni's cart route never changes.** `cartBlocked` is identical wet
   or dry, so what the driver learns on day 4 is still true at the Orbital.
6. **Golden tests guard the flat world.** Before the creek and before the
   heightfield, record a set of `launch()` landings, and assert them after.
7. **Move the things that are outside the walkable field:**
   - the Orbital elevator, to (−44, 5);
   - the Tiered deck, to x ±20;
   - CCTV feed 3, to the new back net.
8. **The docs go in the same commits.** Round 1's note 8 and round 2's note
   8 still stand.

---

## 9. Story additions

- **Dimple Creek.** It was on the 1958 survey. Corporate drained it in 1971
  to "streamline the water." The Range Club's members asked for it back.
  - Muni sign: *POND · CLOSED FOR SYNERGY*.
  - Club memo: *"Corporate has turned the water back on. Please do not drink
    the creek."*
- **Dimples Rock.** *"A 1962 promotional boulder. It has been asked to
  leave."*
- **The Old Tractor.** *"FHI Grounds Unit 1. Retired 1971. Has not moved
  since. Neither has the paperwork."*
- **MOW-E.** *"FHI Autonomous Mower Unit E. Units A through D are not
  discussed."*
- **The beginners' clinic.** Day 1's memo explains the short carries.
- **The 1958 scorecard.** The last treasure. It's the first time the game
  says out loud that Ball No. 1 was lost on Hole 1, two venues before the
  player meets it.

**New PA lines** (rare, by the round-2 rules):

| id | Trigger | Rule | Line |
| --- | --- | --- | --- |
| `mower` | MOW-E's first lane ever | once | "Corporate has deployed an autonomous mower. It has been trained on your movements." |
| `water` | The Club reveal, after `club` | each promotion to the Club (big) | "The water is back on. The creek is now a department." |
| `treasure` | The first treasure banked | once | "An item has been recovered from the pond. Corporate will be keeping it in a glass case. Corporate keeps everything in a glass case." |
