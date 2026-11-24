# Fun Council, round 6: the playtesters' ideas, and what makes each day land

This is the record of Range Rat's sixth Fun Council (2026-11-24, the afternoon after the full-game playtest).
Rounds 1–5 still bind wherever this record doesn't change them. Where they disagree, this record wins.

**The owner's firm calls (unchanged, binding):** multiplayer first (up to 6, balanced for 4, no assigned roles;
suggestions and nudges are fine) · one day = one shift · knockdowns when a ball hits you · scuba should be fancy · no
named balls · rare PA lines, big events only · the kitchen serves fries, hot dogs and beer · at Tiered, overserving
beer makes a lounger fall off the top deck · the shop opens any time · Xbox controller, Xbox Edge as the performance
floor · every feature "actually worth it and meaningful" · **one text element in the middle of the screen at a time,
about 8 words** · for decisions, the more fun and easier option for a casual crew of 4.

**The council (same seats as round 5).**

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

**What the council read and ran:**
- `design/playtest-round1-ideas.md` (the three playtesters' ideas, asked for by this council), the last three sections
  of `game-design.md` (the two owner playtests, sign orientation, and the full-game agent playtest), and round 5.
- The code: `sim.js` (`quotaQ`, `venueQuotaF`, `VENUE_RULES`, `SHOP`, `pickKind`, `ballValue`), `crew.mjs`
  (`endShift`, `depositOne`, `stepLastBucket`, `serve`, `cartPickup`, `tick`), `server/venues/*.mjs`, `tiered.js`,
  `deck.js`, `stadium.js`, `county.js`, `orbit.js`, `board.js`, `ending.js`, `swing.js`, `views/tiered.js`, and the
  event handling in `main.js`.
- Three headless scripts that run the real `Crew` and edit no game code (scratchpad `council6/`):
  - **`muni.mjs`**: a 4P (and solo) Muni crew on days 2–5, with nobody hosing, one hoser for the first 90 s, one hoser
    for only the last 60 s, or one hoser all day (0.08 mud/s, 3 s walking between fixtures). It reads Upkeep at the bell.
  - **`idle.mjs`**: a 4P crew that stands at the stand all shift at every venue, with a fry conveyor, the industrial
    washer, wide reels, four teenagers and the blimp, but no venue automation. It reads Upkeep and the venue gauge.
  - **`kpi.mjs`**: the same idle crew, with 0 and 4 teenagers, over three seeds. It reads the gauge's raw count at the
    bell (balls in cups, Crowd Sentiment, strays, debris).

---

## 0. What the numbers say before any idea is judged

These four findings decide most of the verdicts below.

**F1 · The Muni stamps on days 2 and 3 are free** (Playtester A's flattest moment, reproduced).
- Morning mud leaves Upkeep at **1.28** at the opening bell. With nobody hosing, it drifts to **1.21–1.23** by the
  bell.
- The day-2 target is Upkeep 1.15 and the day-3 target 1.20. Bank one ball and the stamp is yours.
- Any hosing at all makes 1.36–1.49: 90 s in the morning gives 1.39, the last 60 s alone gives 1.42, all day 1.49.

**F2 · From Tiered on, the venue gauge never decides a stamp, and an idle crew passes Tiered's quota.**
- The idle 4P crew (conveyor, washer, helpers) reaches Upkeep **2.10** at Tiered's bell, against targets of 1.70, 1.80
  and 1.90. **All three Tiered stamps are free.**
- At the Stadium and the County it reaches 1.81–1.83: free on the first stamp, missed on the third.
- The four gauges each add 0.5 to Upkeep, and the fry conveyor plus the pond carry the quota alone. So Bay Utilization,
  Crowd Sentiment, Zoning and Orbital Debris are each worth **at most 0.5 of Upkeep**, never a pass or fail.

**F3 · What the gauge reads at the bell when nobody does the venue's chore:**

| Venue | Idle, 4 teenagers | Idle, no teenagers | With its automation |
| --- | --- | --- | --- |
| Tiered: balls in cups (Bay Util = 1 − n/40) | 17–19 (0.53–0.57) | 30–37 (0.07–0.22) | ~0 (gutters drain 1/s per cup) |
| Stadium: Crowd Sentiment | 0.16–0.20 | 0.00 | needs laps: no automation, the second cart helps |
| County: strays (Zoning = 1 − n/30) | 34–43 (0.00) | 51–54 (0.00) | drones clear them |
| Orbital: debris (1 − n/30), saved across days | 22–25 on day 1, ~50 by day 2 (cap 60) | 23–30 | the tether clears 52 a shift against ~55 new |

**F4 · Late automation is bought because it's cheap, not because it matters** (round 5 §3, still true after the ×2
pass). Income is customer-bound, so the second cart, the drones and the tether add almost no cash. **Their only real
job is to hold a gauge that nothing grades.** Fix F2 and F4 fixes itself: the automation becomes the way to secure the
stamp.

---

## 1. The playtesters' ideas: verdicts

**Adopt** = build as proposed · **Adapt** = build the council's version · **Reject** = no, with the reason.
"→ #n" points at the build list (§2).

### Playtester A (the first night to the Club)

| # | Idea | Verdict | Why, and the seats that mattered |
| --- | --- | --- | --- |
| A1 | Quota is "bank N balls AND BV $X" | **Reject** (→ #1, #2 instead) | Two targets means two numbers on screen. **C:** "we'd read one and forget the other." **E:** picking is already paid by cash and fees, and the quota already needs one ball banked. A's real complaint is F1, and #1 fixes it with no new number. From Tiered on, the second condition is the venue gauge (#2), which is a chore rather than a counter |
| A2 | Live BV-against-target dial on the Board, with a sting when it crosses | **Adapt** (→ #3) | The Board already draws BV ÷ target as a bar (`board.js` "TARGET" row). Add the sting only: a green flash and a ding when the bar crosses the mark, amber when it falls back. **L:** the Board faces the crew's path, so it's in-world and not centre-screen text |
| A3 | A "last 60 s rally" | **Adopt** (→ #3) | **G:** the highest fun per effort here. Every day gets a climax, and it's also how the crew learns what #1 and #2 ask of them. Last Call already exists from day 2 (`LAST_CALL`); it only announces glow balls |
| A4 | Gary as a crew event: 3-2-1, big ✓/✗, a salute | **Adapt** (→ #5) | The ✓/✗ floats and sounds already exist (`main.js` `check`). Build the huddle ring and the salute, shared with Ball No. 1's huddle, so one piece of code makes both best-and-flattest moments land. The 3-2-1 goes on the Board banner (`st.gary`), not the screen |
| A5 | Day-2 "jobs board" for 4 | **Adapt** (→ #10) | Firm call: no assigned roles, but nudges are fine. So: one different *suggestion* a Rat, as one line with the existing yellow world arrow, on the Muni's day 2 only. No board and no list. **M:** a late joiner gets one too |
| A-cut | Hide stamp and fee vocabulary before day 2; stamps once earned; fee at 2 stamps | **Mostly done; adopt the rest** (→ #7) | The promotion panel already hides until the first stamp. Adopt "the fee line appears at 2 stamps" (XS) |
| A-sq | Square ball: give it a decision, or cut it | **Adapt** (→ #8) | Today it is "doesn't roll", which does nothing. The decision: **the reels can't take it, and it's worth ×2.** The driver leaves them; walkers and teenagers want them. Fewer of them, so it stays a treat |
| A-hat | Hard hats keep your pocket and block grime | **Reject** | The spill is the knockdown joke ("a full bucket goes everywhere"), and grime is what gives the wand its `self` and crewmate targets. Hard hats already earn their place: they're the $35 day-1 buy that teaches the shop |
| A-cart | A cheap "rusty cart" at the Muni, or unlock at the Club | **Reject** | The day-3 cart is the Muni's big moment, and round 5 measured the Muni on target. Cart unloads already feed the washer's hopper |
| A-htc | Hit a parked cart from a bay for a small Hustle | **Reject** | It undoes the co-op trick (the driver lines up broadside). The aiming toy comes at Tiered (#4) |

### Playtester B (the Club and Tiered)

| # | Idea | Verdict | Why |
| --- | --- | --- | --- |
| B1 | Target Greens you can see and hit: tall neon pin, landing arc, more forgiving | **Adopt** (→ #4) | It's Tiered's flattest moment. From the bay, the pin is a 0.12 m wide, 4 m tall stick 54–150 m away. "Aiming" is Tiered's new verb in round 4's table, and you can't aim at what you can't see. **T:** the landing preview runs the shared `advanceBall`, so it's exact and cheap |
| B2 | The Upper Deck drifts on its own (loungers order every 40–60 s) | **Adapt** (→ #6) | Firm call: the fall must come from the crew *overserving beer*. So the loungers **order**, but only a poured beer raises Drinks. The pull is that an order pays a tab worth having. Today the tab is 5×BV, about 0.4% of a shift, which is why careful crews never pour |
| B3 | Kitchen tickets (fries, hot dog, beer) replace the stock drain | **Reject for now** | It rebuilds Fry Satisfaction, a quarter of Upkeep, and is M with economy risk. #6 gives the kitchen visible beer tickets, and Gary's hot dog is already a ticket. Revisit if the kitchen still feels like a leak after #6 |
| B4 | Scuba even cooler: glints, treasure reveal, a bubble trail for the pumper, the bag rising | **Adapt** (→ #9) | Firm call: fancy. Treasure glints exist (`scuba.js` `glints`). Build the co-op parts: the pumper on the dock sees where the diver is and sees the bag come up. Add a lead and gold glint in the torch cone |
| B5 | Gutters you can watch; "Cups 3 · 0 · 5" on the Board | **Adapt** (→ #4) | The glass ring and the THUNK exist. Put each cup's count on its own pin flag in the world, not on the Board. The Board keeps one gauge, which now has a 50% mark (#2) |
| B-cut | Stacked floating cash popups | **Adopt** (→ #7) | Only your own banks float over you. Helpers, the washer, gutters, drones and the tether roll into one float at the stand every 2 s |

### Playtester C (Stadium → County → Orbital → the Last Bucket → endless)

| # | Idea | Verdict | Why |
| --- | --- | --- | --- |
| C1 | Late automation multiplies something (cart ×2 pings, drones +25%, tether weight 5) | **Adapt** (→ #2) | Three bespoke multipliers are three more rules to explain. One rule does it: **the gauge decides the stamp**, and each venue's automation holds its gauge. Gutters, drones and the tether become "buy this to stop worrying about the stamp", which is a decision with a visible payoff (the gauge pinned at 100%, and up to +21% BV at the bell, F2) |
| C2 | The venue KPI is a stamp condition (≥ 50% at the bell) | **Adopt** (→ #2) | Exactly F2. **E:** it's the only change here that fixes four venues and four shop rows at once. **C:** "half full" is one mark on a gauge we already have |
| C3 | Stretch the Orbital to a 3-stamp finale (~3,500 balls) | **Reject** | 1,958 is the founder's year (`ONE_YEAR`). The memo, Ball No. 1 and the end card all hang on it. Two shifts (~15 min) at 4P and three solo is the right length for a victory lap. The finale's weight comes from the huddle beat (#5), not from more shifts. Under #2, the EVA also decides the Orbital's stamp bonus |
| C4 | Endless: "buy Site 12 back" (paint, statue, more field, gold cart) | **Defer** (§3) | It's a new system (M) for the post-ending audience. Sketched in §3 for round 7 |
| C5 | Jumbotron 2× and above the roofline; a real 3 s knockdown replay | **Defer the size (S); reject the replay** | The replay needs a second render pass into a texture every frame, which is the one thing Edge on Xbox can't afford. Raising and scaling the screen is a `signs.js` row plus its facing test: next round's polish |
| C-cut | "Balls Outstanding" in endless is meaningless; show today against the record | **Adopt** (→ #7) | In endless the Board's count is replaced by TODAY $X / RECORD $Y |
| C-flat | Banking Ball No. 1 is a solo errand | **Adopt** (→ #5) | The whole crew holds Ⓐ together at the stand, a ring fills, then confetti and a roar |

---

## 2. The build list (ranked)

Ranked by fun per effort, flattest moments first. **XS** < 1 hour · **S** an evening · **M** two evenings.
**Core** = edits `crew.mjs`, `main.js` or `sim.js` (merge hotspots). Every item adds its tests to `node --test test/`
(549 today) and updates `game-design.md` in the same commit.

**The one-text rule, as every item applies it:** centre-screen text only goes through the existing queue (PA card,
then memo, then toast or hint, `main.js` "One text element at a time"). No item adds a second simultaneous centre
element, and every new line is ≤ 8 words. World-space signals (the Board, pins, rings, confetti) carry the rest.

**Xbox:** every new mesh is one draw call or merges into one, particles are a single `THREE.Points` with a pooled
buffer, nothing renders to a texture, and the low tier (`perf.js` `profileFor`) drops what's marked "low: off".

---

### #1 · The Muni stamps are earned (XS, core: one line in `sim.js`)

**Behaviour.** The Muni quota gets a floor of 0.3 from day 2:
`quotaQ(day, ceiling) = min(max(0.3, q_old), 0.8 × (ceiling − 1))`.
- Targets go from 0.15 / 0.20 / 0.30 / 0.35 / 0.40 (days 2–6) to **0.30 / 0.30 / 0.30 / 0.35 / 0.40**.
- Upkeep target on day 2: **1.30**. The `muni.mjs` results at the bell (4P): idle 1.23 ✗, a 90 s morning hose 1.39 ✓,
  hosing only the last 60 s 1.42 ✓. Solo: idle 1.27 ✗, a morning hose 1.42 ✓.
- Day 1's "Tomorrow" line becomes **"Tomorrow: a target. Hose before the bell."** (7 words, `tomorrowText`).

**Why it's safe (E).** The Muni promotion is fee-gated ($5,500 at 4P against $6–7k a shift), so a crew that hoses loses
no time. A crew that never hoses misses a day-2 stamp, and #3 tells them why in the last minute. The day-1 checklist
already teaches the wand on the sign.

**Files.** `web/js/sim.js` (`quotaQ`), `server/crew.mjs` (`tomorrowText`, one string).

**Tests.** `test/council.test.mjs`: re-pin the `quotaQ` row (0.3, 0.3, 0.3, 0.35, then 0.4 capped). New: a seeded 4P
Muni day 2 with no hosing misses (upkeep < 1.30), and with every fixture hosed once it hits. `seam.test.mjs`: the Club
fingerprint is unchanged (venue 1 uses `venueQuotaF`). If the Muni golden moves, re-record it and say why in the commit.

**One text / Xbox.** No new UI. Zero cost.

---

### #2 · The venue gauge decides the stamp (S, core)

**Behaviour.**
- From Tiered on (venues 2–5), the bell's review passes only if **Upkeep ≥ the target *and* the venue gauge ≥ 0.50**.
  New constant `QUOTA_KPI = 0.5` in `sim.js`.
- The Muni and the Club have no gauge (`kpi()` is null), so they're unchanged.
- The ending shift still skips the review.
- **Tiered:** `CUP_FULL` goes from 40 to **30**. Today an idle crew with four teenagers sits at 0.53–0.57 at the bell,
  which is a free pass. At 30 it's ≈ 0.40: one TARGET, one cup run, or the gutters passes it.
- The report's quota entry gains `gauge: 0.43, gaugeOk: false`. The miss line names it in ≤ 8 words: "Missed: the
  bowls were full." / "Missed: the crowd was bored." / "Missed: strays in the Yards." / "Missed: too much debris
  overhead."
- **The Board:** the fourth gauge gets a white tick at 50%. Below the tick during Last Call, its fill turns red.

**What each venue now asks (from F3).**

| Venue | Pass needs at the bell | By hand | Automation that holds it |
| --- | --- | --- | --- |
| Tiered | ≤ 15 balls in cups | 1–2 TARGETs (a TARGET flushes the whole cup), or empty Bowl C | Gutters ($50k base) |
| Stadium | Crowd ≥ 0.50 (decays 0.50 over a shift) | 5 laps (+0.1 each, ~10 s a lap), or pings on the Track (+0.16) | The second cart frees a lapper |
| County | ≤ 15 strays | one Yards walk with a push picker (holds 60) | Drones |
| Orbital | ≤ 15 debris | one or two EVA trips (bag 10–40) | The tether winch, plus the EVA (it clears ~52 against ~55 new) |

**E's check.**
- A crew that buys its venue's automation (each row 0.1–0.5 of a shift at 4P after the ×2 pass) passes every gauge, so
  the 4P ladder keeps round 5's pace: Last Bucket at ~150 min.
- A crew that ignores both the chore and the shop loses a shift a miss, but #3 names the fix 60 s before the bell.
- Holding the gauge at 1.0 instead of the idle 0.15 is up to **+0.43 Upkeep, about +20% BV at the bell**, so the buy is
  visible on the Board's big number too.

**Seat views.**
- **G:** "the four venues finally *play* differently for the stamp."
- **C:** "fine, as long as the game tells us in time" (that's #3).
- **Q:** at the Orbital the stamp only pays the 15% bonus (there's no next venue). Keep the rule uniform anyway.

**Files.** `web/js/sim.js` (`QUOTA_KPI`), `server/crew.mjs` (`endShift`'s `hit`, the report fields), `web/js/tiered.js`
(`CUP_FULL`), `web/js/board.js` (the tick and the red fill), `web/js/main.js` (the miss line), `web/js/round2.js` (the
report line).

**Tests.** `test/round2.test.mjs` or a new `test/gauge.test.mjs`:
- At venue 2, Upkeep over the target with the gauge at 0.49 gives no stamp; at 0.50 it gives one.
- At venues 0 and 1 the stamp rule is byte-identical (the seam goldens hold).
- The report carries `gauge` and `gaugeOk`.
- The ending shift has no review.

`test/tiered.test.mjs`: `bayUtil(15) === 0.5`, `bayUtil(30) === 0`.

**One text / Xbox.** The miss reason replaces the existing miss toast (one line). The Board tick costs one canvas
redraw. No frame cost.

---

### #3 · The Closing Bell: a rally every day (S, core-light)

**Behaviour.** From day 2, at every venue, when Last Call starts (the last 60 s):
1. **Horn** (`SFX.horn`), and the Board banner flips to LAST CALL (it already does).
2. **One centre line, ≤ 8 words, naming the single biggest shortfall.** The server picks it (`lastcall` event gains
   `need`) with a new pure `shortfall(state)`. Checks in order:
   - The gauge is under 0.5 (from #2): "Bowls are full. Shoot or empty them!" · "The crowd is bored. Lap the Track!" ·
     "Strays in the Yards. Go get them!" · "Debris overhead. Ride the Lift!"
   - Upkeep is under the target: name the worst term. Dirtiest fixture: "Hose the mats before the bell!" / "The sign is
     filthy. Hose it!" Fries under 0.5: "Fries are low. Cook!" Pond under 0.6: "The pond is murky. Dive!"
   - Everything is on target: "On target. Hold it till the bell."
   - Endless: no line (the horn only). Day 1: no Last Call, as today.
3. **The Board sting (A2):** whenever BV crosses the target mark, a 0.4 s green flash on the target bar and a `cash`
   ding. Falling back under it: an amber flash. At most once every 3 s, so drift can't strobe it.
4. **The bell:** a synthesised bell, then a **rubber stamp** in the centre for 1.5 s: "APPROVED" (red ink, with
   confetti at the Board and `SFX.jackpot`) or "DENIED" (grey, with a two-note trombone). Only then does the report card
   open (the client holds it 2 s).
5. **Cut:** the Last Call glow-ball toast (the glow ball keeps its debut memo) and the long quota-hit/miss toasts. The
   stamp replaces them, and the report carries the numbers.

**Files.**
- New `web/js/rally.js`: pure `shortfall({ value, quota, kpi, fixtures, fries, pond, venue, endless })` and the
  `RALLY_LINES` table. It imports `sim.js` only.
- `server/crew.mjs`: `tick`'s `lastcall` push gains `need: shortfall(...)`.
- `web/js/main.js`: the `lastcall` and `quota` cases, plus the 2 s report hold in `showPhase`.
- `web/js/board.js`: the crossing flash and the stamp draw.
- `web/js/sfx.js`: `bell()` and `trombone()`, synthesised like `horn`.
- Confetti: the shared pool from #5. If #5 isn't merged yet, build it here.

**Tests.** New `test/rally.test.mjs`:
- Only the gauge short → the venue's line.
- Only the mats dirty → the mats line.
- All met → the on-target line.
- Endless → null.
- Every line is ≤ 8 words.
- The `lastcall` event carries `need` and fires once a shift.
- No `lastcall` on day 1.

**One text / Xbox.**
- The rally line goes through the toast queue and waits for a PA card or a memo.
- The stamp is the single centre element at the bell, and the report waits for it.
- Board flashes are canvas redraws. Confetti is ≤ 160 points for 2 s (low tier: 60).

---

### #4 · Target Greens you can see and hit (M, mostly leaf)

**Behaviour.**
1. **The landing ring** (venues 2+, at a crew bay with balls in your pocket).
   - A ground ring (1.2 m radius, 0.15 m wide, your colour, 50% opacity) marks where a **PURE** strike rests: your
     current yaw and pitch, and the power of your current backswing. Before you wind up, it uses your last swing's
     power (default 0.7), so you can aim by looking before you swing.
   - It turns the bowl's flag colour while its centre is inside a bowl.
   - Computed with the shared physics: a scratch ball from `swingLaunch` → `advanceBall` to rest, no curve. It
     recomputes at most 10 times a second and only when power moves by more than 0.01 or the aim by more than 0.5°.
   - A slack or sliced strike still misses, so the skill stays in the swing.
2. **Pins you can see from the bay.** Each bowl's pin becomes 10 m tall and 0.25 m thick, with a flag at the top.
   - A soft additive light pillar rises 30 m in the flag's colour (the gold-ball beacon's material), so all three bowls
     read from both bays at 54–150 m.
   - **The flag shows that cup's count** (B5): a 64×64 canvas, redrawn only when the count changes, red at ≥ 5. This is
     where "Bowl C's full" is read now that it decides the stamp (#2).
3. **A forgiving lip:** a **crew** ball that rests within `r + 1.5 m` of a bowl is a TARGET. Customer balls still cup
   only inside `r`, so Bay Utilization and the cups are unchanged.

**Why (G, C).** B's flattest moment, and Tiered's verb. Under #2 a TARGET is also the fun way to pass the gauge: it
flushes a whole cup. So the shooting gallery becomes the crew's rally move at the bell. **E:** a TARGET banks the cup at
gear ×1 plus Hustle +0.25 (capped ×2 with pings). More TARGETs mean more Hustle; the cap is unchanged.

**Files.**
- New `web/js/aim.js`: pure `predictRest(launch, world)`, which imports `sim.js`. It's a leaf: `sim.js` never imports
  it, so there's no cycle.
- `web/js/tiered.js`: `TARGET.LIP = 1.5`, and a `pad` argument on `inBowl`.
- `server/venues/tiered.mjs`: `onRest` uses the pad for crew balls only.
- `web/js/views/tiered.js`: the pillar, the taller pin, the flag canvas, the ring mesh, and an `aim(launch|null)` hook.
- `web/js/main.js`: one call per frame passes the swing state and aim to the views' `aim` hook while `atBay(me)`.

**Tests.**
- New `test/aim.test.mjs`: `predictRest` equals the server's real rest spot for the same launch (run `Crew.swing` with
  a fixed yaw, pitch and power; within 0.05 m); it is deterministic; it returns null for power 0.
- `test/tiered.test.mjs`: a crew ball at `r + 1.4` is a TARGET; a customer ball at `r + 0.5` doesn't cup; a crew ball at
  `r + 1.6` doesn't count.
- `test/signs.test.mjs`: the flag faces both bays (dot > 0.5).

**One text / Xbox.**
- No text: the ring, pillars and flags are all world-space. The TARGET toast stays as it is.
- Cost: 3 pillars + 3 flags + 1 ring, about 7 draw calls (merge the pillars into one `InstancedMesh`).
- `predictRest` is ≤ 1,500 fixed steps at 120 Hz, at most 10 times a second: well under 0.3 ms. Low tier: the pillars
  stay, the flag canvas drops to 32×32.

---

### #5 · The huddle beat: Ball No. 1, and Gary (M, core)

**Behaviour.** One shared piece, used twice.

- **The huddle ring.** A ring of slots painted round the stand at `HUDDLE_R` (8 m), one slot per online Rat. A slot
  fills with the Rat's colour while they're inside the ring. Idle Rats count as present, as today: idle 60 s
  (`HUDDLE_IDLE_MS`).
- **Ball No. 1 (C's flattest moment).**
  - When the carrier reaches the stand, `lastBucket.phase` becomes `'huddle'`.
  - Every present Rat **holds Use (Ⓐ / Space / click)**. While every slot is full *and* held, a gold sweep fills the
    ring over **3.0 s**. Any release or exit resets the sweep. Idle-present Rats count as holding.
  - At 3.0 s, `depositOne` runs: **two confetti cannons** at the stand (160 points each, 2.5 s), a **crowd roar** (noise
    burst, then the crowd bed at full for 4 s), then the existing `$∞` finale and end card.
  - Solo: hold 3 s alone. It's still a beat.
  - The banner reads **"HOLD Ⓐ TOGETHER · 3 / 4"** (it replaces "EVERYONE TO THE STAND · n / of" once the carrier is at
    the stand).
- **Gary (A4).**
  - During his 45 s warning, the same ring shows (no hold needed), so the crew *sees* the huddle forming.
  - As he leaves his last stop, the Board banner counts **GARY 3 · 2 · 1**.
  - If the huddle is full when he reaches the stand: Gary salutes (his hat lifts and an arm rises, 1 s, on the
    `buildGary` mesh), a small confetti puff (60 points), and the existing "+2" verdict.
  - Not full: he just writes on his clipboard.

**Files.**
- New `web/js/huddle.js`: the ring view (one `InstancedMesh` of slot arcs) and the confetti pool (one `Points`, pooled,
  shared with #3).
- `server/crew.mjs`: the `'huddle'` phase, a `{t:'hold', on}` input, the 3 s timer in `stepLastBucket`, and a
  `holding` flag in the snapshot.
- `web/js/round2.js`: routes Use to `hold` at the stand during the huddle, and the banner text.
- `web/js/ending.js`: the banner string.
- `web/js/main.js`: Gary's salute pose and the Board countdown string.

**Tests.** `test/ending.test.mjs`:
- No bank before 3.0 s of everyone holding.
- A release at 2.9 s resets the sweep.
- An idle Rat counts.
- A Rat who joins mid-sweep adds a slot and resets it.
- A Rat who leaves mid-sweep removes their slot.
- A knockdown of the carrier during the huddle drops Ball No. 1 (the existing `dropOne`) and returns the phase to
  `'down'`.
- Solo banks after 3 s.
- The self-heal still recovers a lost ball.

`test/round2.test.mjs`: the Gary huddle flag is unchanged by the ring.

**One text / Xbox.**
- One banner (it already exists) and no new centre text. The salute and confetti are world-space.
- Ring: 1 draw call. Confetti: 1 draw call, ≤ 320 points for 2.5 s. Low tier: half the points.

---

### #6 · The Upper Deck orders (S, leaf: the deck module)

**Behaviour.** From Tiered on (`DECK.FROM_VENUE`), the loungers **order**.
- **When they order.** Every **30 s** of working shift time a lounger raises a mug and shouts WOOO. At Drinks ≥ 4
  (amber), every **20 s**: they're getting loud.
- **The order.** One open order at a time, lasting **20 s**.
- **Filling it.** A good or perfect beer while the order is open pays a **bar tab of 10 × BV** (an unordered beer still
  pays 5 × BV) and +1 Drink, as today.
- **An unfilled order** expires quietly: no penalty, because it's easy.
- **Sobering up is slower:** −1 Drink every **60 s** (it was 30), so an order-filling crew climbs.
  - It reaches 4 at ~4 min and 6 at ~5 min.
  - **One hot dog (−2) at amber keeps it under.** Food is the cook's release valve, exactly as B asked.
- **The firm call holds:** Drinks only rise when the crew pours beer, so every fall is the crew overserving.

**E's numbers (Tiered, 4P).**
- ≈ 17 orders a shift if all filled: 170 × BV, about **+13%** on a ~1,300 × BV shift.
- The fine is 100 × BV, so one fall costs about 10 orders.
- A careful cook (beer for orders, a hot dog at amber) earns about +13% and has no falls. A careless one breaks about
  even and gets the joke.
- Solo gets the same orders on a smaller shift (≈ +20%). That's fine ("easier").
- The stamps still gate the 4P pace, so it doesn't change the ladder.

**Files.**
- `web/js/deck.js`: `DECK.ORDER_SECS 30`, `ORDER_LOUD_SECS 20`, `ORDER_OPEN 20`, `ORDER_TAB 10`, `SOBER_SECS 60`, and
  `stepDeck`, which returns an `order` flag.
- `server/venues/deck.mjs`: the order state, the tab on a filled order, a `deckOrder {seat}` event, and the snapshot
  field `order: {seat, left}`.
- `web/js/views/deck.js`: a mug raised at the ordering seat, and WOOO on the order.
- `web/js/kitchen.js`: the BEER card glows gold with a 20 s timer ring while an order is open.
- The first-order hint (the existing deck hint key) becomes **"Fill their orders. Six beers: someone falls."**

**Tests.** `test/deck.test.mjs`:
- Orders every 30 s, and every 20 s at ≥ 4.
- A filled order pays 10 × BV, an unordered beer 5 × BV.
- Expiry has no penalty.
- 60 s sober-up.
- A crew filling every order with no food has an incident between 270 and 330 s. With one hot dog at amber, none in
  420 s.
- Orders only while `crew.working()`.

**One text / Xbox.** No centre text beyond the one-time hint chip. The mug raise reuses the lounger rig. Zero extra draw
calls.

---

### #7 · The one-text pack (XS, leaf plus small core touches)

1. **Cash floats** (B-cut): only *your* banks float over you.
   - Helpers, the washer, gutters, drones and the tether roll into one float over the stand every 2 s
     ("+$1,240 · 31").
   - Other Rats' banks don't float. They're in their colour on the feed only if large (≥ 20 balls).
   - Files: `main.js` `floatPay` and `cash`.
2. **Endless Board** (C-cut): replace the Balls Outstanding count with **TODAY $X / RECORD $Y**
   (`board.js`, `snapshot().pace`).
3. **The fee line at 2 stamps** (A-cut): the report's promotion panel shows stamps from the first one and the fee only
   from 2 (`round2.js`).
4. **The quota toasts**: removed, as #3 does. If #3 slips, shorten them to "Stamp! Quota hit." / "Missed. Corporate is
   disappointed."

**Tests.**
- `test/round2.test.mjs` or `test/onboarding.test.mjs`: the panel shows no fee at 1 stamp and the fee at 2.
- A pure `boardRows(state)` helper in `board.js`, if one is extracted: endless returns no outstanding row.

**One text / Xbox.** Fewer floats on screen: a small win on Xbox (fewer canvas sprites).

---

### #8 · Square balls jam the reels (S, core)

**Behaviour.**
- The cart's reels **can't take square balls** (they jam; the reels pass over them).
- They're worth **×2** (`KIND_W.square = 2`). They still don't roll, which is the joke: they sit exactly where they
  land.
- Walkers, teenagers and drones pick them up.
- **Fewer of them:** `pickKind`'s square threshold goes from 0.28 to 0.15.
  - The Muni from day 5: about 14% of shots (it was 27%).
  - The Club and up: about 5% (it was 18%).
- The blurb becomes **"Worth ×2. The reels can't take it."**

**Why (A, C).** It gives walkers a reason to exist once the cart arrives, without assigning anyone: the driver shouts
"squares by the Red flag!" **E:** income within ±3%, because the ×2 offsets the reels missing them, and the teenagers
fetch most of them.

**Files.** `web/js/sim.js` (`KIND_W`, `pickKind`, `KIND_BLURB`), `server/crew.mjs` (`cartPickup`: refuse
`kind === 'square'`), `web/js/main.js` (the client reel scan skips squares, so it doesn't ask).

**Tests.** `test/kinds.test.mjs`:
- `cartPickup` refuses a square; `pickup` takes it; it banks at weight 2.
- The square share over 10,000 seeded draws is 13–15% (Muni, day 7) and 4–6% (Club).

`test/seam.test.mjs`: the goldens run day 5 at the Muni and the Club, so expect them to move. Re-record them and say
why in the commit.

**One text / Xbox.** The debut memo already exists. No cost.

---

### #9 · Scuba you can follow from the dock (S, leaf)

**Behaviour.**
1. **A surface boil over every diver**, drawn for everyone: 8 bubbles rising and popping in a 0.6 m ring at the surface
   above them, from the existing bubble pool. The pumper sees where their diver is.
2. **The bag rises:** when a diver sends the bag up, a net-bag mesh climbs the line from the diver to the dock over the
   send time, with a splash at the top. Everyone sees it.
3. **Lead and gold glint in your torch:** sunk lead and gold balls within 6 m and inside the torch cone twinkle (the
   treasure's `GLINT` shader, max 20 points). They aren't drawn outside the cone.
4. **The treasure reveal:** when a treasure is banked, its slot in the Lost & Found case spins it for 2 s under a
   sparkle (`animateCase`).

**Files.** `web/js/scuba.js` (`setMates(divers)`, the bag tween, the glint points, the case spin), `web/js/main.js`
(passes the mates' diving positions from the snapshot).

**Tests.** `test/scuba.test.mjs`: the pure glint selector picks only balls inside the cone and range (≤ 20); the bag
tween's start and end positions.

**One text / Xbox.** No text. +2 draw calls (boil points, glint points), and only near the pond. Low tier: glints off.

---

### #10 · Day-2 suggestions (S, core-light)

**Behaviour.**
- On the Muni's day 2 only, after the memo, each online Rat gets **one different suggestion** as a single line, with the
  existing yellow world arrow over the place.
- The pool depends on what the crew owns, dealt round the crew so 4 Rats get 4 different ones (more than 4 Rats repeat
  from the top):
  - "Try hosing the mats." (the wand)
  - "Try picking the far field." (Yellow flag)
  - "Try banking at the stand." (the stand)
  - "Try the ball washer crank." (only if owned) / "Try the shop: get a washer." (if not)
- The line goes when you've done it once, or after 45 s. A late joiner on day 2 gets the next one in the pool.
- **No roles:** nothing checks or rewards it.

**Files.** `server/crew.mjs` (`startShift`: deal `p.nudge` on day 2 at venue 0; `join` deals one), `web/js/main.js`
(reuses the checklist's arrow and line).

**Tests.** `test/onboarding.test.mjs`:
- 4 Rats get 4 different nudges.
- The washer nudge depends on `up.washer`.
- None on day 3 or at the Club.
- A late joiner gets one.
- Completion clears it.

**One text / Xbox.** One line, through the checklist slot, which already waits for the memo and the PA card. The arrow
already exists.

---

### Who runs what

| Agent | Items | Owns | Notes |
| --- | --- | --- | --- |
| **A** (core, serial) | #1 → #2 → #3 (server half) → #8 | `sim.js`, `crew.mjs`, `tiered.js` constants | The rules first, because #3's shortfall reads #2's gauge |
| **B** (views) | #4, then #3 (client half: Board flash, stamp, SFX) | `aim.js`, `views/tiered.js`, `tiered.mjs` `onRest`, `board.js`, `sfx.js` | Rebase on A for `CUP_FULL` |
| **C** (moments) | #5, then #9 | `huddle.js`, `ending.js`, `round2.js`, `scuba.js` | #5 touches `crew.mjs` `stepLastBucket` only: coordinate with A |
| **D** (small) | #6, #7, #10 | `deck.js`, `deck.mjs`, `views/deck.js`, `kitchen.js`; `main.js` `floatPay` | #10's `crew.mjs` lines go after A |

**Order of merge:** A's #1 and #2 land first (with #3, they're one feature: *the bell matters*). Then #4 and #5 in
parallel, then the rest.

**About four evenings of agent work.** Every agent's done line: `node --test test/` green, `make preflight` green (in
WSL), and `game-design.md` updated in the same commit.

**Votes on the list:** G yes · E yes (#2 is the economy fix round 5 wanted) · M yes (wants #5's join/leave tests
first) · L yes · T yes (if #4's predictor is benchmarked on the Edge low tier) · C yes ("#3 and #4 are the ones we'll
feel") · Q yes (#5's softlock tests before merge). **7–0.**

---

## 3. What to cut, defer, or leave alone

**Cut in this round (folded into the items above):**
- The Last Call glow-ball toast (#3). The glow ball keeps its debut memo; the board banner says LAST CALL.
- The long quota hit and miss toasts (#3's stamp, and the report, carry them).
- Other Rats' floating cash popups (#7).
- Balls Outstanding on the endless Board (#7).
- Square-ball frequency: 27% → 14% at the Muni, 18% → 5% from the Club (#8).

**Deferred to round 7 (sketched, so nobody re-litigates them):**
- **Endless: "Buy Site 12 back"** (C4). One crew row, minVenue 6 (endless), three tiers at about 1, 2.5 and 5 endless
  shifts of income:
  1. *Crew colours*: the stand, the Board frame and the carts repaint in the crew's colours.
  2. *A second blimp*: customers swing 25% more often, the only thing that raises supply, so the record becomes
     beatable.
  3. *The statue*: a bronze Rat holding Ball No. 1 by the stand, with the crew's names.

  It's a new system and only matters after ~2.5 hours, so it waits for a real crew to reach endless.
- **The Jumbotron 2× and above the roofline** (C5, S): a `signs.js` row and its facing test. **The knockdown replay is
  rejected:** it needs a render to texture every frame, which costs too much on Xbox.
- **Kitchen tickets** (B3): revisit only if #6 doesn't make the shed feel busy.

**Rejected outright (reasons in §1):** the dual quota (A1), the hard hat changes, the Muni rusty cart, the parked-cart
target, and the 3,500-ball Orbital.

**Left alone on purpose:** `PROMO_STAMPS` (3), the Club-and-up quota curve (`venueQuotaF`), every fee and shop price
(the ×2 pass and the playtest cuts stand), and the knockdown rules.

---

## 4. What the next playtest must check

A real 4P night (two on Xbox pads in Edge) and one solo run, with `?pace` and `?perf` on. Paste the numbers into round 7.

1. **The bell (#1–#3).**
   - Muni day 2: did someone hose *before* being told? How many day-2/3 stamps were missed, and why? Goal: 0–1 missed,
     with every miss followed by a hit the next day.
   - Did each rally line point at the right thing? Did the crew act on it in under 15 s? Record the `need` field and
     what they did.
   - Screenshots at Last Call and at the bell: **at most one centre text element in every frame.**
2. **The gauge stamp (#2).** Per venue, the gauge at each bell, and every stamp missed on the gauge. Did the crew buy
   gutters, drones or the tether *because of the stamp*? Ask them. Pace target unchanged: 4P Last Bucket at 150–165 min,
   and no venue taking more than 4 shifts.
3. **Target Greens (#4).**
   - Minutes from arriving at Tiered to the first TARGET (goal < 2 min of trying).
   - TARGETs a shift (goal ≥ 3 for a crew that tries).
   - Do the pillars read from both bays on a TV at 3 m? Does the ring ever disagree with where a pure ball rests?
4. **The huddle (#5).** Seconds from the carrier reaching the stand to the bank. Did all four hold together? Did anyone
   get stuck, including an AFK Rat, a mid-sweep join, or a ball hitting the carrier? Gary's salute: did the crew notice?
5. **The deck (#6).** Orders filled, incidents a shift (goal: 0–1 for a careful cook, 1–3 for a careless one), and the
   tab's share of income (goal 10–15%).
6. **Squares (#8).** Did the driver call squares out, and did someone go for them? Any "why won't the cart take it"
   confusion after the debut memo?
7. **Scuba (#9).** Could the dock pumper point at their diver? Did anyone watch the bag come up?
8. **Day 2 (#10).** In the first two minutes of day 2, did the four Rats spread across four jobs?
9. **Xbox Edge, low tier.** Frame p95 ≤ 20 ms at Tiered (pillars, ring, flags), at the stand during the huddle
   (confetti), and in the pond with a mate diving (boil, glints). This also fills the README's still-empty perf table.
10. **Regression:** `node --test test/` green, `make preflight` green, and 60 minutes with no console errors.
