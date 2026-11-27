# Fun Council, round 14: close the gaps, then stop building

This is the record of Range Rat's fourteenth Fun Council (2026-11-27). **It is the last build loop.** One review-only
scorecard loop follows it, and no build follows that. The council worked from:
- build `097c941`: council round 13 built (`cee02b3`), plus the MOW-E hotfix (`mowe.tick` back out of a comment, with
  `test/maincalls.test.mjs` as a guard);
- playtest round 9 (`design/playtest-round9-A.md`, `-B.md` and `-C.md`, with shots in `design/shots/pt9-*`);
- the scorecard's Round 9 section (overall **6.7**: A 6.2, B 6.8, C 7.1);
- `council-round13.md`, and `game-design.md` where needed.

Rounds 1–13 still apply wherever this record doesn't change them. Where they disagree, this record wins.

**This round's job.**
- Get to **Overall ≥ 7.2 with no metric under 6.5 in any slice**.
- Do it mostly with **fixes**. The few new features are small, reuse shipped code, and each fills a measured dead
  stretch.
- **Ship nothing that can regress silently.** A one-character merge slip cost A's slice 0.8 points last round. This
  round's gates (§2, item 0) are worth as much as any feature.

**The owner's firm calls (unchanged, binding):**
- keep looping to raise quality; the reviewers' scorecard is the judge;
- MOW-E is "a big deal, like a boss moment";
- Gary and Ball No. 1 are the heart; Site 13 and Dimples are the comedy;
- one centre text at a time, ~8 words; it works on a pad; it never drops full screen;
- it scales for 1–4 players (balanced for 4), and every upgrade is crew-wide;
- "pick the more fun and easier option for a casual crew of 4".

**The council** (the same seats as rounds 5–13; ties go to the chair):

| Seat | Lens |
| --- | --- |
| **Game Designer** (G, chair) | Moment-to-moment fun; does each venue play differently? |
| **Systems/Economy Designer** (E) | Prices, payouts, pacing |
| **Multiplayer/Co-op Designer** (M) | 1–4 Rats, roles, solo |
| **Level Designer** (L) | Readable spaces, lanes, sight lines |
| **Technical Director** (T) | Server-authoritative, zero deps, hot files, Xbox frame time |
| **Casual Crew of 4** (C) | Four friends on a sofa, some on Xbox pads in Edge |
| **QA Lead** (Q) | Bugs, dead ends, softlocks; nothing counts until it's reproduced |

**Code read** (at `097c941`):
- `server/crew.mjs`: `startShift`'s memo push (~l.1186–1196), `readyUp` (~l.750), the ready timer in `tick`
  (~l.2408–2409), `buyPoach`/`buy` (~l.575–604), `stepGary`'s warn gate (~l.1728), `stepMowe`…`moweLose`
  (~l.1811–1970), `endShift` (~l.2459), `tomorrowText` (~l.2750);
- `web/js/sim.js`: `memoSecond`, `CLOCK_IN`/`clockInSpot`, `shopDay`, `GARY`;
- `web/js/tourney.js` and `server/venues/tourney.mjs` (the flight, claim and bank pattern);
- `server/venues/poach.mjs`, `web/js/owner.js` (`POACH`, `rivalBell`), `web/js/landmarks.js`;
- `web/js/mowe.js` (`BOSS.PROMO_AT`, `BOSS_LINES`), `web/js/stadium.js` (`STRETCH`);
- `web/js/caserules.js` (`CASE`), `web/js/bubbleclamp.js`, `web/js/views/garycameo.js`;
- `web/js/nudge.js` (Gary's checklist lines), `web/js/rally.js` (Tiered's bowls read);
- `main.js`: the event switch (~l.689–875), the knockdown toast (~l.866), the checklist gate (~l.1668–1753), the
  spawn placement (~l.938), the per-frame ticks (~l.2143–2152), Gary's bubble (~l.2197).

**What the council ran:** nothing new. Every number below is a tester's or is read from the code. Each item names the
measurement its builder takes before merging.

---

## 1. Diagnosis

### 1.1 Where 6.7 really stands

Round 9 has two different stories in it.

1. **B and C are close to the bar.** C's slice is the best yet (7.1). B rose to 6.8. Text load is 7.5 in every slice,
   and Decision density met 6.5 in both. Neither slice has a metric under 6.5. What holds them back is a list of
   specific, reproducible misses, nearly all Small:
   - a line the player never sees ("It took the bunting.");
   - a purchase that does nothing where it's bought (the Members' Bell rung 0 times in 9 runs);
   - an event nobody announces or scores (the Tournament);
   - a spawn inside Gary;
   - a poach that's invisible and decides the race.
2. **A's slice fell on one bug, and the bug is fixed.** A estimates ~7.0 with MOW-E visible. That puts the round at
   about **(7.0 + 6.8 + 7.1) / 3 ≈ 6.97**.

So the shortest path is **not** a big new system. It is about +0.25 overall, taken from the cells that are at or under
6.5.

### 1.2 The cells that block the bar (after the hotfix)

| Slice | Under 6.5 | At 6.5 (one bad finding drops it) | What moves them |
| --- | --- | --- | --- |
| **A** (Muni → Club boss) | Decision density 5.5, Clarity 6, Look 6, Polish ~6 (4.5 with the bug) | Pacing, Co-op, Meaningful | **The Gold Rush** (Muni day 3 and Club day 2), Gary's one line at a time, the mowed line once, cash pops off the centre, the Club spawn |
| **B** (Club d4 → Stadium d1) | — | Clarity, Pacing, Meaningful, Polish, One more shift, Decision density | **Happy Hour** at Tiered, the solo Tiered fix, a Bell you can ring where you buy it, the Tournament announced and scored |
| **C** (Stadium → endless) | — | Meaningful, Polish, Decision density | The crash's punchline, the endless spawn, the poach (tuned and visible), the star lines, landmarks that arrive in time |

Read across the rows:
- **Polish** is the weakest number on the card (5.8 average). Two reasons: one shipped regression, and a long tail of
  small things in every slice (a repeated line, the blinking checklist, "Employee of the Shift" on $0, lines defined
  but never wired, a spawn in Gary's face).
- **Decision density's** last real hole is the **first hour**. That's where a new crew decides whether to keep
  playing. Muni day 3 is **0.43 calls a minute**, with zero centre items from 210 s to 420 s in A's log. Club days 1–2
  are **0.85–1.0 at 4P**, against a bar of 1.5.
- **Tiered** is on the bar only because of the deck orders: 0.93 a minute (1P) and 1.37 (4P) without them. Solo, it
  is **5–9 shifts** long.

### 1.3 The shortest path to ≥ 7.2

Four moves, in order of points per hour:

1. **Make silent regressions impossible** (item 0).
   - Widen the live-call guard into a lint: no statement after a `//` on the same line, in the hot files.
   - Before the review loop, a fronted-browser smoke run of the five beats that need a live client.
   - *Why first:* the review loop has no build after it. One more `mowe.tick` costs a slice ~0.8 and can't be fixed.
2. **Fill the first hour's dead air with one reused grammar: the Gold Rush** (item 1).
   - **What it is:** gold balls under beams, each on a clock, with Site 13's cart as the rival. It is the
     Tournament's shipped pattern, moved to the day the gold arrives.
   - **Where:** Muni day 3 (the deferred mini-call), and again on Club day 2, where the Club's gold arrives and the
     pond opens.
   - **What it lifts:** A's Decision density (5.5 → 6.5+) and Fun. It also teaches the Tournament two venues early.
3. **Give Tiered its small peak, and let the Bell ring it** (items 2–3).
   - Happy Hour, with the Bell ringing a bonus one.
   - The solo Tiered fix: 1P shifts from 5–9 down to ≤ 5.
   - The Tournament announced in the memo and scored on the report.
   - *What it lifts:* B's Pacing, Meaningful features, Decision density and Clarity.
4. **The polish sweep** (items 4–6). Every overlap and bug on the brief's list, each with a test or a shot:
   - the crash's punchline;
   - Gary on day 4;
   - the endless spawn and the giant bubble;
   - the bank's overlaps;
   - the final report cut short;
   - the landmarks a venue late;
   - the poach.

   *What it lifts:* Polish and Clarity in every slice, C's Meaningful features, and A's Look & feel.

**The arithmetic the council expects** (each slice's overall, after this round):

| Slice | R9 | After the hotfix (A's estimate) | Target | Moves it most |
| --- | --- | --- | --- | --- |
| A | 6.2 | ~7.0 | **7.2** | Gold Rush (DD +1.0), Gary one line (Clarity +0.5), Polish sweep (+1.0), Club spawn (Look +0.5) |
| B | 6.8 | 6.8 | **7.2** | Happy Hour + Bell (DD, MF +0.5), solo Tiered (Pacing +0.5), Tournament memo/row (Clarity +0.5) |
| C | 7.1 | 7.1 | **7.4** | Crash punchline + endless spawn (Polish +0.5, Look +0.5), poach + landmarks (MF +0.5) |
| **Avg** | 6.7 | ~6.97 | **≥ 7.2** | |

> G: "We're not short of ideas. We're short of finish. Every item this round has to show up on a screenshot."

> Q: "And every item ships with the check that would have caught round 9's bug. A reviewer can't score a boss they
> can't see."

### 1.4 What this round does not do

- **No new venue systems, no new economy rows, no new story beats.** The three new mini-events (Gold Rush, Happy Hour
  and the optional Coach Party) reuse the Tournament's module pattern, the beacon instance path and the caddie cart's
  view.
- **No retuning of fights, fees or cards**, except where a number below says so.
- **The ruler stays `calls.mjs`.** B #7's caution is right: the ruler counts calls *offered*. Item 0 adds an
  "answered" column so the final loop can tell a peak from noise. No bar changes.

---

## 2. Build this (ranked)

Ranked by points per effort for a casual crew of 4, with the owner's calls first.
- **Sizes:** **XS** < 1 hour · **S** an evening · **M** two evenings.
- **Every item:**
  - adds its tests to `node --test test/`;
  - runs `make preflight` (WSL);
  - appends its section to `game-design.md` in the same commit.
- **No new RNG draws** in anything at the Muni or the Club. Use `hash32(day, venueDay, tag)`. Expected golden moves are
  named per item. The lead re-records the goldens once, after the merge.
- **Every new centre line:**
  - is ≤ 8 words, with a `test/words.test.mjs` entry;
  - goes through `centre.js` (`ctx.say` in a view, `say()` in `main.js`). Nobody writes to the centre directly.
- **Every browser check is taken with the pane fronted, at ≥ 20 fps** (read `?perf`). Round 9's checks ran at 0–1.5 fps
  in a hidden pane, and their visual claims were unverifiable. If the pane can't be fronted, the builder says so in the
  commit message and the lead takes the shot.
- **Every new mini-event** tags its events with `call:` so `calls.mjs` counts it, as the Tournament does
  (`call: 'member'`).

| # | Item | Size | Builder |
| --- | --- | --- | --- |
| 0 | The no-silent-regression gates, the hooks, the "answered" ruler | S | 4 (merges first) |
| 1 | The Gold Rush: Muni day 3 and Club day 2 | S–M | 2 |
| 2 | Happy Hour on the deck, and the solo Tiered fix | S–M | 2 |
| 3 | The Bell rings where you buy it; the Tournament announced and scored; landmarks on time | S | 3 (3a, 3c), 2 (3b), 4 (the hooks) |
| 4 | MOW-E 2.0's punchline lands: the crash day untangled; the boss leftovers | S | 1 |
| 5 | The poach: tuned, visible, and the three story lines wired | S | 3 |
| 6 | The polish pack: overlaps, spawns, Gary's one line, the final report | S–M | 4 (rows marked → go to their owner) |
| 7 | *(Optional, slips first)* The Coach Party on Club day 1 | S | 2 |

**If the night runs short:**
- items 0, 1, 4 and 6 ship;
- item 2 ships Happy Hour first, then the solo fix;
- item 3 ships 3b (the Tournament memo and row) first;
- item 7 is the first to slip, then item 6's Low rows.

---

### 0 · The no-silent-regression gates, the hooks, the "answered" ruler — S · builder 4

*A #1 (the critical bug), B #7 (the ruler), B #11 (the presets), C #12 (the counter's zone). The review loop can't fix
anything, so this round's job is to make it impossible to ship a frozen boss, an unwired line or a blind counter.*

**0a. The lint behind the guard.**
- `test/maincalls.test.mjs` keeps its list (`mowe.tick(`, `mowe.update(`, `board.tick(`, `confetti.tick(`,
  `kitchen.tick(`) and adds: `views.update(`, `hinter.tick(`, `sayer.`/`centre.` tick, `payfloat` roller tick, and
  every `*.tick(` that was live at `097c941`. The test builds that list once from the file at `097c941`, and it fails
  if any call on the list is no longer live.
- **New: `test/nocodeincomments.test.mjs`.** In `web/js/main.js`, `server/crew.mjs` and `server/venues/index.mjs`, no
  line may have a `//` comment that ends in a call statement (`/\/\/.*\b[\w.]+\([^)]*\);\s*$/`).
  - That is exactly the shape of round 9's bug: "…setPost(…);   // round 13 #5a: … lanyard mowe.tick(dt, sceneT, me);".
  - `index.mjs` l.46–47 has two stacked comments on one import line. Tidy them while you're there.
- **New: `test/wired.test.mjs`.** Every exported `*_LINE`, `*_PLAQUE`, `*_HINT` and `*_MEMO` string constant in
  `web/js/` must be imported somewhere other than the file that defines it. This catches C #5's three dead lines and
  any new ones. An allow-list holds deliberate exceptions, each with a reason.

**0b. The module hooks this round's items need** (in `server/venues/index.mjs`'s contract, plus `crew.mjs`):
- **`reportRows(crew, st) -> [{ text, cash? }]`**: rows shown above the goals on today's report, at most 2 from
  modules, after the MOW-E row. `endShift` collects them into `report.rows`, and `recap.js` draws them. Users: the
  Tournament (3b), the Gold Rush (1), Happy Hour (2), the poach and the Hustle hint (5).
- **`memoSecond({ event })`**: a new slot that **beats `fresh`** (the NEW kind line). The kinds it pushes out go to
  `lost`, so they float "NEW ×1.5" on their first hit (the existing `toldKinds` path). It is set by `crew.memoEvent`,
  a one-morning field that modules write in `startShift`. `startShift` calls `mods.call('startShift')` (~l.1176)
  before the memo is built (~l.1191), so a module's write lands the same morning.
  - **Why:** B #2's root cause. `TOURNEY_MEMO` is written into `memoNote`, the flavour slot, and the day-4 kinds line
    (`fresh`) always wins it. `memoNote` is then cleared, so the line never shows on any day.
- **`shopVday(phase, vday)`** in `sim.js`: the venue day the shop sells for. That is `vday + 1` in `'report'` **and
  `'lobby'`**. In the lobby, `day` is already the coming day but `venueDay` isn't (it increments in `startShift`).
  This is the cause of B #4, where the landmark row is hidden in the lobby. `buy()` (b3's line) and the client's shop
  list both use it.

**0c. The ruler gets an "answered" column.**
- `calls.mjs` prints `offered / answered` a minute.
- **A call is answered** when a Rat reaches its place or takes its prize before it lapses: a member or gold ball taken,
  a section answered, an order poured, the inspector met.
- The bars stay on *offered* (continuity). The review loop reads both.

**0d. Presets and the counter.**
- **Presets.** `make-presets.mjs` writes per-size copies of the round-9 mid presets: `club4-1p`, `club4-2p` and
  `tiered1-1p` (B #11: `club4` is a 4P save, so a solo tester arrives with "CARD DONE"). New presets: `muni3` (the
  morning of Muni day 3), `club2` and `lastbucket-4p`.
- **The counter.** `window.__centre` adds Gary's bubble (any world-text sprite whose screen box overlaps
  `CENTRE.ZONE`) and the pay floats to its zone (C #12), so "0 overlaps" means the screen, not just the DOM.

**0e. The smoke run** (`scripts/smoke.mjs`, new, run by the lead before the review loop; see §4.1).
- **What it does:** it drives one headful browser seat through five scripted beats and asserts on the live client:
  1. the Club day-3 boss: the `mower` root moves ≥ 10 m in 20 s;
  2. Muni day 3's Gold Rush: beams up, and the ALERT is the only centre item;
  3. a Tiered Happy Hour;
  4. the Stadium crash: the loss line is shown ≥ 2.5 s;
  5. the bank to the endcard: `__centre.overlaps === 0`, and the endcard is up ≥ 10 s.
- It exits 1 on any failed assertion.

**Files:** `test/maincalls.test.mjs`, new `test/nocodeincomments.test.mjs` and `test/wired.test.mjs`,
`server/venues/index.mjs` (the hook doc and the comment tidy), `scripts/bots/calls.mjs`, `scripts/make-presets.mjs`,
`server/presets/*.json`, new `scripts/smoke.mjs`, `web/js/sim.js` (`memoSecond`, `shopVday`), `web/js/recap.js`
(rows), `web/js/centrewatch.js` (the zone).
- **`crew.mjs`:** `startShift`'s memo push (~l.1186–1196: `event: this.memoEvent`, cleared with the others) and
  `endShift`'s report object (~l.2459+: `rows`).

**Verify:**
- **The lint is red on round 9:** reverting `097c941`'s `main.js` hunk fails both `maincalls` and `nocodeincomments`.
- **`wired.test.mjs` is red at `097c941`** on `STAR_LINE`, `STAR_PLAQUE` and `HUSTLE_HINT`. Item 5 turns it green.
- **`memoSecond` tests:** `{ event, kindNew }` gives `line: event, lost: kindNew`; with no `event`, nothing changes.
  The seam goldens don't move: no current caller sets `event`.
- **`calls.mjs`** reproduces round 9's B and C 4P figures (±0.1) from the same seeds.

---

### 1 · The Gold Rush: Muni day 3 and Club day 2 — S–M · builder 2

*A §3 ("zero centre items and zero calls" from 210 s to 420 s on Muni day 3), A's idea 2, the brief's first
priority, and council 13 §3's "first candidate". The first gold arrives with no moment attached. Give it one, in the
grammar the Club's Tournament already uses.*

**When.**
- **Muni day 3** (`venue 0`, `day 3`, not endless), at **T−2:45** (shiftT 255 on the 420 s shift). That's after
  round 12's `DAY3` mats nudge (at 0.5, 210 s), so the two never share a minute.
- **Club day 2** (`venue 1`, `venueDay 2`: the Club's gold day, `CLUB_DAY.gold`, and the pond's first day), at
  **T−3:00** (shiftT 240). It dodges a Last Call deal by ±20 s, using `flightTimes`'s rule.
- Never on a boss day, a Gary day, a Promotion Day or a reveal morning.

**What happens.**
- **Site 13's delivery van backs up to the fence** and dumps a crate of gold balls over it. They land on the field,
  each under **a short gold beam** (the beacon instance path, with the member beam's shrink).
  - **How many, by crew size:** **2 at 1P, 3 at 2–3P, 4 at 4P** (5–6P: 4).
  - **Where they land:** spots from `hash32(day, vday, 'rush', j, k)`, 45–110 m out, alternating sides.
    - **At 1P, the second ball is within 30 m of the first**, so one Rat can take both.
    - **At the Club, at 3P+, one ball lands in the pond** (a diver's job on the pond's first day).
- **The clock.** Each ball has **30 s at 2P+ and 40 s at 1P**.
- **The rival.** When the clock runs out, **Site 13's cart** claims the ball. It is the caddie cart's view, recoloured
  in Site 13 red with a "13" on the canopy. It hums out from the gate and back.
  - The feed line, merged per wave: **"Site 13 took one. For research."** / "Site 13 took 2. For research."
- **The pay.** They're ordinary gold balls (×10, `KIND_W.gold`), carried in hands like member balls (`b.hands`) and
  banked at any return. There's no new pay rule, so the economy holds: a full wave is 20–40 ball-weights. E checks
  its share of Muni day 3's income in the bot table and wants it under 10 %.
- **Every ball banked:** the chime, and the feed line "Clean sweep. Site 13 is furious." Dimples's monocle stays a
  Club joke, so at the Muni he just faces the van.

**What you see and hear.**
- **One centre ALERT:** **"Gold Rush! Beat Site 13's cart!"** (5 words).
- **The Board:** `GOLD RUSH · ●●○ · 0:22`.
- **The sound:** a van reversing beep, then a golf-clap per landing.
- **The report row** (item 0's hook): **"Gold Rush: 3 of 4 · +$214"** or **"Site 13 took all 4. For research."**
- **The eve line** (`tomorrowText`, the day-3 branch, b4's function): "Tomorrow: the first gold balls. Worth ten."
  becomes **"Tomorrow: a Gold Rush. Gold balls, worth ten."** (8).

**The decision this creates.**
- **Muni at 4P:** "you two left, we two right". It's the first time a Muni crew splits on purpose.
- **Muni solo:** two near balls, so the call is "drop the hose, go now".
- **Club at 3P+:** someone dives for the pond ball on the day the pond opens.
- It rehearses the Tournament (beams, a clock, a rival cart, carry to a return) two venues before it matters.

**Why it's fun.**
- The first gold ball becomes an event, not a memo line.
- Site 13 gets its first on-screen gag in the first half hour: "For research."
- The game's flattest working day gets a sprint.

C: "Wait, they're *dumping* gold on us? Go go go!"

**Files** (all new, or b2-owned):
- new `web/js/goldrush.js`: `RUSH = { MUNI: { DAY: 3, AT: 255 }, CLUB: { VDAY: 2, AT: 240 }, SECS: 30, SECS_1P: 40,
  N: [2, 3, 3, 4, 4, 4], NEAR: 45, FAR: 110, PAIR_1P: 30, POND_FROM: 3 }`, `rushSpots`, the lines;
- new `server/venues/goldrush.mjs` (`venue: 0`; it checks venue 0/1 itself);
- new `web/js/views/goldrush.js` (the van, the beams, the red cart: it imports the caddie cart's builder from
  `views/tourney.js`, with no copy);
- `scripts/bots/policy/goldrush.mjs`;
- `test/goldrush.test.mjs`.
- **Reuse, not refactor:** `goldrush.mjs` *imports* `memberSpots`-style helpers and `dropShot` from `tourney.js`.
  `tourney.mjs` itself is not refactored this round; it's shipped and tested.

**Hand-offs:**
- one line in `server/venues/index.mjs` and one in `views/index.js` → b4 (item 0's file);
- the eve line → b4 (`tomorrowText`);
- the Board line → b4 (`board.js`).

**Expected golden moves:** Muni day 3 onward (ball ids). **Muni days 1–2 and Club day 1 must not move.**

**Verify:**
- **`test/goldrush.test.mjs`:**
  - it fires only on Muni day 3 and Club day 2 (not boss, Gary, promo or reveal days);
  - it fires at 255 / 240 s, with the deal dodge;
  - N and the clock by crew size;
  - at 1P the pair is ≤ 30 m apart;
  - the pond ball at the Club at 3P+;
  - a claim at the clock's end;
  - no RNG draw (the Muni day 1–2 seam golden is unchanged);
  - the `call: 'gold'` tag.
- **Bot** (`muni.mjs` from `muni3`, and `mid.mjs` from `club1`, 1P / 2P / 4P × seeds 7 / 11 / 23):

  | Measure | Target | Round 9 |
  | --- | --- | --- |
  | Muni day 3 calls a minute, offered | **≥ 0.8 at 1P, ≥ 1.1 at 4P** | 0.43 / 0.71 |
  | Muni whole venue, offered | ≥ 0.7 / ≥ 0.8 | 0.58 / 0.65 |
  | Club day 2 calls a minute, 4P | **≥ 1.4** | 1.00 |
  | Rush balls answered (taken), `POLICY` on | ≥ 60 % at 1P, ≥ 75 % at 4P | — |
  | Muni / Club length | **unchanged** (Muni 4 at 4P, 5 at 1P) | — |

- **Browser** (`muni3`, solo, fronted), with shots:
  - the van and the beams, with the ALERT alone in the centre;
  - the red cart claiming a ball;
  - the report row.

---

### 2 · Happy Hour on the deck, and the solo Tiered fix — S–M · builder 2

*B #8, B's ideas 2 and 3, the brief. Tiered's number is the cook's deck-order stream. Off the deck, the crew sees 0.93
calls a minute at 1P and 1.37 at 4P. Solo, Tiered is the game's long sag: 5 / 7 / 9 shifts, waiting on a third review.*

**2a. Happy Hour** (Tiered only, `venue 2`, not endless; every Tiered shift except Promotion Day).
- **When:** **T−4:00** (shiftT 180), for **60 s**. That's ahead of the T−3:00 bowls rally, so the shift escalates:
  Happy Hour, then the bowls, then Last Call.
- **The deck:** the order queue **fills at once** (`DECK` queue max 3: the head plus two). Each Happy Hour order pays
  **×1.5** `ORDER_TAB`.
- **The loungers' balls.** The loungers chip their own balls onto the target greens and want them back.
  - **How many:** **1 at 1P, 2 at 2P, 3 at 3P+**, each on a different target green (the greens module's `TARGET`).
  - Each sits under **a neon beam** (Tiered's neon, on the beacon path), with a **30 s clock** (40 s at 1P).
  - Carried in hands to a return, each pays **×20 Ball Value**. Lapsed: the feed line "The lounger shrugs.
    Experiential." There's no rival cart: dimpl doesn't compete, it shrugs.
- **One centre ALERT:** **"Happy Hour! Drinks, and fetch the greens!"** (6).
- **The Board:** `HAPPY HOUR · ORDERS 3 · ●●○ · 0:41` (orders open, then balls out).
- **The report row:** **"Happy Hour: 3 pours, 2 of 3 greens · +$41k"**.
- **Why it's fun:**
  - It pulls the non-cook Rats into the deck's story, with a burst for the cook.
  - At 4P it's the split "two on greens, one carries, one pours".
  - It reuses the member-ball code, the deck queue and the greens' targets.

**2b. The solo Tiered fix.** Do the steps in order, and stop when the bar below passes.
1. **The bowls read scales by crew size.**
   - `rally.js`'s Tiered bowls check at Last Call passes when the bowls hold **≤ 50 % of their load at the rally's
     start at 1P, and ≤ 25 % at 2P**. 3P+ keep "empty".
   - The rally line is unchanged. The miss line "Missed: the bowls were full at 2:30." still fires on a real miss.
   - **Why:** in 6 of 9 solo days the target was missed on the bowls alone, with the fee long paid.
2. **Happy Hour's orders count toward the card's `orders` goal**, as any order does. At 1P, B's s23 sat on "orders
   4/10" for 4 days; three orders at once in a 60 s window moves that.
3. **Only if 1P Tiered still runs > 5 shifts median:** Tiered's `reviews` goal is **2 at 1P** (`CARDS[2]` gets a
   per-size `n`, `[2, 3, 3, 3]`), as the Stadium and the County already ask for 2.

**Files:**
- new `web/js/happyhour.js` (`HAPPY = { AT: 180, SECS: 60, ORDER_X: 1.5, BALL_PAY: 20, BALL_SECS: 30, BALL_SECS_1P:
  40, N: [1, 2, 3, 3, 3, 3] }`);
- new `server/venues/happyhour.mjs` (`venue: 2`);
- new `web/js/views/happyhour.js`;
- `server/venues/deck.mjs` and `web/js/deck.js` (the queue fill and the ×1.5, b2's this round);
- `web/js/rally.js` (the bowls threshold);
- `web/js/goals.js`, the Tiered `reviews` per-size `n` only (step 3), handed from b4, who owns `goals.js`;
- `scripts/bots/policy/happyhour.mjs`, `test/happyhour.test.mjs`, `test/rally.test.mjs` (the bowls threshold).

**Hand-offs:** the index lines, the Board line and the step-3 card line → b4.

**Verify:**
- **`test/happyhour.test.mjs`:**
  - it fires at 180 s for 60 s, not on Promotion Day;
  - the queue fills to 3 at once, and each pays ×1.5;
  - N greens by crew size, one per distinct target green;
  - the clock and ×20 on bank;
  - the `call:` tags;
  - the Bell's bonus (3a) can't start inside a live Happy Hour.
- **Bot** (`mid.mjs` from `club4-1p`/`-2p`/`club4`, through Tiered, 1P / 2P / 4P × 3 seeds, `BUY=1`):

  | Measure | Target | Round 9 |
  | --- | --- | --- |
  | Tiered calls a minute without deck orders | **≥ 1.0 at 1P, ≥ 1.5 at 4P** | 0.93 / 1.37 |
  | Tiered shifts, 1P | **≤ 5 median, max 6** | 5 / 7 / 9 |
  | Tiered shifts, 2P / 4P | ≤ 5 / **3 (never longer)** | 5–6 / 3 |
  | Happy Hour share of a Tiered day's income, 4P | 8–15 % | — |
  | Tiered bell cash against the fee, 4P | still ≥ the fee (no new shift) | $1.33–1.57M / $1.32M |

- **Browser** (`tiered1`, solo, fronted): shots of the ALERT alone with the beams on the greens, of the deck's three
  tickets, and of the report row.

---

### 3 · The Bell rings where you buy it; the Tournament announced and scored; landmarks on time — S · builder 3 (3a, 3c), builder 2 (3b), builder 4 (the hooks)

*B #1, #2, #4, #5, #6; C #6, #10. Each landmark and the Tournament are built and work. What's missing is a crew
getting to use them, and to know about them.*

**3a. The Members' Bell rings for a peak at the Club and at Tiered** — builder 3 (the rules), builder 2 (the
rings).
- **Today:** it's bought at Tiered in 8 of 9 runs, where it rings for sound only. Rung 0 times in 9 runs.
- **The fix:** the bell rings for **the venue's peak, once a shift**, at the two venues where crews actually own it.
  - **At the Club** (from Club day 4), as now: a bonus Tournament flight.
  - **At Tiered: a bonus Happy Hour** (item 2a), T−6:00 to T−1:30, never inside a live one. The ALERT: **"Bonus
    round! The bell has spoken."** (6).
  - From the Stadium on: sound only, as now.
- **It's visible in the Club day-4 lobby** (item 0's `shopVday`), so a crew can plan it over breakfast.
- **Price:** $15k → **$10k base** ($22k at 4P). Club day 4's last-bell surplus at 4P is $3.7–24k, so the bell fits
  more often while the Club's length holds. At Tiered it's small change.
- **Files:**
  - b3: `web/js/landmarks.js` (`bellOpen` admits `venue 2`, the price, the desc "Ring it for a bonus round, once a
    shift."), `web/js/views/landmarks.js` (the bell's post also stands at Tiered, by the return);
  - b2: `server/venues/happyhour.mjs` (the ring starts a bonus Happy Hour; it imports `bellOpen` and `atBell`).

**3b. The Tournament: announced, scored, and fair to a solo Rat** — builder 2.
- **Announced.**
  - The first Tournament morning sets **`crew.memoEvent = TOURNEY_MEMO`** (item 0's slot) instead of `memoNote`. Its
    memo reads "Gary visits today. 50% clean by the bell." / **"Members' Tournament today. Site 13 entered
    anyway."**
  - The bouncy ball and the splitter float "NEW ×1.5" on their first hit (`lost`). B #2.
  - The eve line on the night before the first Tournament day: **"Tomorrow: the Members' Tournament. Bring
    friends."** (6). It's handed to b4's `tomorrowText` and sits after the MOW-E branch, before Gary's.
- **Scored.** A `reportRows` row: **"Members' balls 3 of 4 · +$7,363"**, or **"The caddie took all 4. Kazoo."** (B #5).
- **The caddie's feed merges** within 3 s: "The caddie cart took two. Kazoo." (B §3's stutter).
- **Flight 2 is never buried** (B #3).
  - On a Gary day, `flightTimes` also dodges **Gary's window**: from his warn (`GARY.AT` of the shift) to warn + 120 s.
  - A flight inside the window moves to its nearer edge ± 5 s. On a Club Gary day that puts flight 2 at about T−1:45.
- **Solo** (B #6: 2 of 12 member balls banked at 1P).
  - At 1P a ball's clock is **45 s** (`TOURNEY.SECS_1P`).
  - The second ball of a flight lands **within 30 m of the first** (the Gold Rush's pair rule).
- **Files:** `web/js/tourney.js`, `server/venues/tourney.mjs`, `web/js/views/tourney.js` (the feed merge), and
  `test/tourney.test.mjs`.
- **Expected golden moves:** Club day 4+ only.

**3c. Landmark tiers 3 and 4 work in the venue after theirs too** — builder 3.
- **Today:** C #6. In 9 of 9 `BUY=1` runs the County's second inspection never fired at the County. 4P bought "Site
  13's inspector" at the Orbital. 4P bought the fireworks for the crash Promotion Day, where the Stretch ran 0–2 of
  3–4.
- **The council picks the carry-over** over a deep price cut. It's sure to work, and it keeps the Orbital's ≤ $100M
  check.
  - **The fireworks also fire at the County.** Each hazard bagged in Inspection Hour fires a rocket over the Yard.
    All bagged: **GRAND SLAM** (the same volley) and **50 Ball Values** to the crew. It reuses the racks' rocket
    sprite, so there's no new mesh.
  - **The inspector on retainer also works the Orbital.** At T−3:30 he audits one debris drop: a white beam over
    one piece of debris, worth **×4** if it's winched in within 45 s. ALERT: **"Inspector's audit! That debris pays
    ×4."** (6).
  - **A modest price cut, so 1P/2P buy in their own venue:** the fireworks $5M → **$3.5M base**; the inspector $20M →
    **$14M base**.
- **The second County inspection picks a different patch** from the first (C #10). It uses
  `hash32(day, vday, 'insp', 2)`, and if that matches the first patch, it takes the next patch.
- **Files:** `web/js/landmarks.js`, `server/venues/county.mjs` + `web/js/county.js` + `web/js/views/county.js` (the
  rockets, the patch rule), `server/venues/orbit.mjs` + `web/js/orbit.js` + `views/orbit.js` (the audit),
  `scripts/bots/policy/landmarks.mjs`, `test/landmarks.test.mjs`, `test/county.test.mjs`, `test/orbit.test.mjs`.
  - b3 owns `county.*` and `orbit.*` this round. `stadium.*` goes to b1 (item 4).

**Verify (3a–3c):**
- **Tests:**
  - `bellOpen` at venue 2;
  - the bonus Happy Hour once a shift;
  - the bell is visible in the lobby (`shopVday`);
  - `memoEvent` on the first Tournament day only;
  - the report row texts are ≤ 8 words before the number;
  - flight 2 is clear of Gary's window;
  - the 1P clock and pair;
  - the County rockets and GRAND SLAM;
  - the Orbital audit once a shift, only when owned;
  - the second patch ≠ the first.
- **Bot** (the ladder, 1P / 2P / 4P × 3 seeds, `BUY=1 TOURNEY=1`):

  | Measure | Target | Round 9 |
  | --- | --- | --- |
  | Shifts with the bell owned at the Club or Tiered in which it's rung | **≥ 80 %** | 0 of 9 runs |
  | Member balls banked, 1P | **≥ 50 %** | 2 of 12 |
  | Runs where tier 3's perk fires at least once after purchase | **9 of 9** | 1P/2P only |
  | Runs where tier 4's perk fires at least once after purchase | **9 of 9** | 0 of 9 at the County |
  | Club / Tiered length, `BUY=1` vs `BUY=0` | **equal** | equal |
  | Orbital last-bell cash, 4P `BUY=1` | ≤ $100M | $75–82M |

- **Browser:** a shot of the Club day-4 memo with the Tournament line, of the report row, of the bell rung at Tiered
  with one ALERT, and of the County GRAND SLAM.

---

### 4 · MOW-E 2.0's punchline lands: the crash day untangled; the boss leftovers — S · builder 1

*C #1, #8, #11; A #2, #7, #10, #11. The owner's boss moment. On Promotion Day the crash's loss line is eaten by Gary's
warn 0.1 s later, the Stretch runs inside the fight, and the crowd decays while the crew is busy with the boss. In the
Club fight, the mowed line nags five times.*

**4a. Move the crash earlier, so the day has three peaks, one at a time.**
- **The crash warns at T−6:00** (`BOSS.PROMO_AT: 180/420 → 60/420`), right after the morning (≤ 28 s).
- **The fight's 115 s timeout ends it by T−4:05.**
- **Then Gary's warn** (`GARY.AT` 0.43 ≈ T−4:00, held by `bossLive`) and **the Stretch at T−3:30**, as on any
  Promotion Day.
- The crash day becomes **crash → Gary → Stretch → bell**: three peaks at their own times. The fireworks a 4P crew
  bought on Stadium day 1 get their Stretch.
- The Board's update bar runs to the new `PROMO_AT`. The PA "MOW-E heard about the ceremony." is unchanged.

**4b. The punchline owns its 3 seconds.**
- **On the server:** Gary's warn also waits for **`bossSettled(mower, 8)`**. That's true once the boss isn't live and
  ≥ 8 s have passed since it fled or was tamed. It's one condition at `stepGary`'s warn gate (~l.1728), and it applies
  on every boss day, so the Club's rematch gets it too.
- **On the client:** the loss line (`lostLine(...)`, every variant) is queued at **priority 1 with `after: 'stamp'`**,
  `minSecs: 3`. A Gary toast (priority 5) or PA (2) can't take its slot.
- **The result:** "MOW-E WINS" (red stamp) → "MOW-E 2.0 left. It took the bunting." → 5 s of nothing → "Gary's coming:
  clean up, then huddle."

**4c. The boss owns the Stadium's lines too, and the crowd waits** (C #8, #11).
- From the warn to the stamp (`bossOwnsScreen`), the Stadium's crowd **doesn't decay** (`server/venues/stadium.mjs`'s
  crowd step reads `bossLive`).
- During the same window, "The crowd is bored. Lap the Track!" and "Booed. A customer walked out." are muted,
  folded into 2c's one summary feed line after the stamp.
- **Why:** a 115 s boss in the middle of a gauge day shouldn't cost the promotion. An idle crew still loses the crowd
  before and after the fight.

**4d. The mowed line, once a fight** (A #2: 5 times in 35 s).
- **The first knockdown by MOW-E in a fight:** **"Mowed. It was trained on your movements."** (7 words; it was 9).
- **After that:** **"Mowed again!"** (2), at most once per 20 s. Otherwise nothing: the screen-edge flash and the
  sound carry it.
- It's in the knockdown case (`main.js` ~l.866, the `'mower'` branch only).

**4e. Small leftovers.**
- **"Employee of the Shift" needs > 0 banked** (A #7, `awards.js`). On a $0 shift the line is skipped.
- **The rematch eve:** "Tomorrow: MOW-E's rematch. Wands at the bell." → **"Tomorrow: MOW-E's rematch. Grab a wand
  early."** (7; A #10). It's `mowe.js`'s eve string.
- **The pet's sofa share** (A #11: `SOFA=1` 4P 13–22 %): at 3P+, the whistle's strip `CAP` drops **30 → 24**, only if
  `SOFA=1 boss.mjs` still has a 4P median over 12 % after 4a. Otherwise leave it.

**Files:**
- `web/js/mowe.js` (`PROMO_AT`, `bossSettled`, the lines, the eve string), `web/js/mower.js`, `web/js/awards.js`;
- `server/venues/stadium.mjs` + `web/js/stadium.js` (the crowd hold and the mute; b1 owns both this round);
- `scripts/bots/boss.mjs`, `pt7a-boss.mjs`, `test/boss.test.mjs`.
- **`crew.mjs`:** the `stepGary` warn condition (~l.1728, one clause), and `stepMowe`…`moweLose` (~l.1811–1970) if
  `bossSettled` needs a `fledAt` stamp.
- **`main.js`:**
  - the knockdown case's `'mower'` branch (~l.866);
  - the loss-line `say` call in the mower cases (~l.735–741);
  - the boss prompts (~l.1218–1231), untouched unless needed.

**Verify:**
- **`test/boss.test.mjs`:**
  - the crash warns at 60 s, and the fight ends ≤ 175 s into the shift;
  - Gary's warn is ≥ 8 s after `fled` on a crash day and on a Club loss;
  - the Stretch fires on a crash day after the fight;
  - the crowd is frozen during the fight;
  - the mowed line's first and repeat texts, and the 20 s gap;
  - Employee needs > 0.
- **`textload.mjs`** (`stadiumPromo`, 1P / 4P × 3 seeds): the loss line has **≥ 2.5 s alone**, 0 overlaps.
- **Bot** (`late11.mjs` from `stadiumPromo`, 4P × 3 seeds, and the ladder):

  | Measure | Target | Round 9 |
  | --- | --- | --- |
  | Crash days where the Stretch runs whole (all sections offered after the fight) | **3 of 3** | 0 of 6 clean |
  | Working crews promoted on the crash day | 3 of 3 (unchanged) | 3 of 3 |
  | Stadium length, 4P | 2 shifts (unchanged) | 2 |
  | Boss win rates | unchanged | met |

- **Browser** (`stadiumPromo`, 4 seats, idle, fronted): a shot of "MOW-E 2.0 left. It took the bunting." alone in the
  centre, then one of Gary's warn ≥ 5 s later. And (`club3`) a solo loss with the mowed line shown once, then "Mowed
  again!".

---

### 5 · The poach: tuned, visible, and the three story lines wired — S · builder 3

*C #3, #4, #5. The poach is too strong (two poached wins acquire Site 13, and it repeats) and invisible (no event
handler, no figures, and the shop row is below the fold). Three lines were built and never wired. Two of them are the
Orbital's "heart" purchase.*

**5a. Tune: one double a week, a rising price.**
- **A poached win counts double once per rival week** (`POACH.DOUBLE_PER_WEEK: 1`). Any further poached win in the
  same week counts 1, like a plain win.
  - The fastest possible acquisition is then a double plus two wins: **day 3**. The median for a crew that poaches is
    about day 4.
  - Since a new week starts at acquisition, a second acquisition needs a fresh 3+ days, so **never twice in 5 days**.
- **The price rises within a week:** 25 % of yesterday's bank, **× 1.5 for each poach already made this week** (25 %,
  37.5 %, 56 %). A second poach is a real "spend or save".
- **Files:** `web/js/owner.js` (`POACH`, `poachPrice({ ..., weekPoaches })`, `rivalBell`'s double), and
  `test/owner.test.mjs`.
- **`crew.mjs`:** `buyPoach` (~l.575–583) passes the week's count.

**5b. Make it visible.**
- **The regulars are on the range.** On a poach day, **three `people.js` figures in Site 13 red jackets** stand at
  `REG_BAY` (x 22), swinging on the poach module's launches. The view is `views/owner.js`, shown while
  `s.mods.poach.on`.
- **They're announced.** The `poach` event is picked up in the view (`ctx.say`):
  - **a priority-2 PA-style card after the memo:** "Site 13 lost a regular. To you." (7);
  - **the Board:** `SITE 13 (est.)` ticks down once, with a red "−5 %" for 3 s.
- **The row is easy to find.** In endless, the shop lists **"Poach a Site 13 regular" first**, above the fold
  (`sim.js` SHOP order → b4), with today's price and "Counts double today" when the week's double is still unused.
- **The report row** (item 0's hook): **"Poached a regular · Site 13 −5 %"**.

**5c. The three lines, wired** (item 0's `wired.test.mjs` goes green).
- **`STAR_LINE`** ("A star. Named Gary. I'll allow it."):
  - when tier 5 is bought, the next centre item after the buy is Gary's line as a priority-2 card, "Gary: 'A star.
    Named Gary. I'll allow it.'". That's 8 words with his name, and it's spoken by the view on the `buy` event;
  - on the first endless morning, his cameo bubble at the case says it once before "Where do these go, boss?"
    (`views/garycameo.js`).
- **`STAR_PLAQUE`** ("A star named Gary"): `caserules.js` `plaqueLines` adds it as the case's last line when the star
  is owned.
- **The star in frame:** the endless case shot (`round2.js`, the epilogue's case cue) tilts up **2 s** to the star
  over the case (y 34), then back. One cue on the existing `cue` path.
- **`HUSTLE_HINT`** ("Hustle days beat Site 13."): a report row, once ever (a `voiced` key), the first time a Hustle
  contract day beats Site 13. It's the poach module's `reportRows`, so it needs no edit to `recap.js`.

**Files:** `web/js/owner.js`, `server/venues/poach.mjs`, `web/js/views/owner.js`, `web/js/views/landmarks.js` (the
star line on buy), `web/js/views/garycameo.js`, `web/js/caserules.js`, `web/js/views/glasscase.js`,
`web/js/round2.js` (b3 owns it this round), `scripts/bots/policy/poach.mjs`, `test/owner.test.mjs`,
`test/landmarks.test.mjs`, `test/round2.test.mjs`.
- **`crew.mjs`:** `buyPoach` only.

**Hand-offs:** the SHOP order line and the Board tick → b4.

**Verify:**
- **Tests:**
  - one double a week;
  - the ×1.5 price ladder;
  - the regulars shown only on a poach day;
  - the `poach` event gives one centre card;
  - `plaqueLines` has the star when owned;
  - the Hustle hint fires once;
  - `wired.test.mjs` is green.
- **Bot** (`pt7c-endless.mjs` from `endless`, Owners' days 2–6, 1P / 4P × 3 seeds, `POACH=0/1`):

  | Measure | Target | Round 9 |
  | --- | --- | --- |
  | Acquired by Owners' day 5, `POACH=1` | **2–3 of 3, median day ≥ 4** | 3 of 3 by day 3 |
  | Acquired twice by day 5, `POACH=1` | **0 of 3** | 1–3 of 3 |
  | Beat rate, `POACH=0` | 45–65 % (unchanged) | 53–67 % |
  | Poaches a week, `POACH=1` policy that buys when "worth it" | 1–2 (not every day) | every day |

- **Browser** (`lastbucket` → endless day 2 with a poach, fronted), with shots:
  - the three red jackets at the bay;
  - the card alone;
  - the case plaque with "A star named Gary" (an Orbital save with tier 5);
  - Gary's star line.

---

### 6 · The polish pack: overlaps, spawns, Gary's one line, the final report — S–M · builder 4 (rows marked → go to their owner)

*Every remaining overlap and bug from round 9, each with a test or a shot. Polish averages 5.8 and Clarity 6.5; these
are the cheapest points on the card.*

| # | Fix | From | Detail | Owner, file |
| --- | --- | --- | --- | --- |
| 6.1 | **Rat 1 spawns inside Gary and the case** | C #2 | Endless uses its own row, **`ENDLESS_XS: [29.4, 30.6, 31.8, 33.0, 34.2, 35.4]`**. Slot 0 was 1 m from `CASE` (24.4, 5.0). A test: every endless slot is ≥ 3 m from `CASE` and from the cameo's spot, and clear of the washer's handles and the MOW-E post (31.5, 1.2: L checks the 31.8 slot, 2.8 m off). | b4, `sim.js` `CLOCK_IN` |
| 6.2 | **The giant bubble** | C #2 | `bubbleclamp.js` gains `clampBubbleSize(sprite, camera)`: the bubble's screen height is ≤ **9 % of the viewport**, and it fades to 0 inside **2.5 m**, like the name plates. Called by `main.js` (Gary's bubble ~l.2197) and, as a one-line hand-off, by `views/garycameo.js` (b3). | b4 (+ one line → b3) |
| 6.3 | **The Club spawn faces the walkway** | A #4, B #9 | `clockInSpot` returns a **`yaw` aimed down-range** (at (0, −80)) for venues ≥ 1. `crew.mjs`'s clock-in uses `c.yaw ?? 0`, one token in `startShift`'s loop (~l.1150, b4's line). The pitch ease is unchanged. Pixel pass: field ≥ 50 % of the first frame at the Club, Tiered and endless. | b4, `sim.js`, `spawnlook.js` |
| 6.4 | **Gary's day-4 checklist churn** | A #3 | **One Gary line at a time.** While he's at a stop, only that stop's line ("Gary checks the mats. Hose them!"), held ≥ 4 s. "Keep Gary talking: hold Ⓐ!" and "Stall Gary: ping his cart!" show **once, after the first failed check**, never within 6 s of another Gary line. "Gary is inspecting. Stay out of his way." shows only if it can hold 3 s; otherwise it's skipped (it was up < 1 s). | b4, `nudge.js`, `server/venues/nudge.mjs`, `main.js` `'gary'`/`'check'` cases (~l.779–796) |
| 6.5 | **The checklist blinks on every cash pop** | A #5 | Your own cash pops draw **by the cash HUD (top left), counting up**, and never claim the centre (`payRoute` → `'hud'` for `me`). The checklist then has no pri-5 rival on day 1. | b4, `payfloat.js`, `main.js` payfloat roller |
| 6.6 | **The bank's two overlaps, and the pops behind the note** | C #7 | `ending-flash` (`$∞`) and the bank PA go through `centre.js`: the flash is a priority-0 follow `after` the note card; the bank PA waits for the endcard to close, or goes to the feed. Pay floats are **hidden at once** (opacity 0, no transition) while a priority 0–1 item is up. | b4, `ending.js`, `payfloat.js` |
| 6.7 | **Anyone's Ready cuts the final report short** | C #9 | On the **ending report** only: Ready presses don't start the countdown until the endcard has been up **10 s** (`ENDCARD_HOLD`), and the countdown is **30 s**. The server knows the hold as `endShift(ending)` time + `ending.js`'s exported `ENDCARD_AT` (the cinematic's length) + 10 s. Before then, presses are recorded (the "3 / 4 ready" count shows) but `readyAt` isn't set, and all-ready doesn't start the shift. A normal report is unchanged. | b4, `crew.mjs` `readyUp` (~l.750) and the ready timer (~l.2408–2409), `ending.js` |
| 6.8 | **The day-4 memo slot** | B #2 | Item 0's `memoEvent` slot. b2 sets it (3b). | b4 (slot), b2 (use) |
| 6.9 | **"Goals for Range Club"** | A #8 | It becomes **"To reach the Range Club"** (and "To reach Tiered", and so on). | b4, `recap.js`/`dayend.js` |
| 6.10 | **The Stadium memo runs 11 words** | B (owner rules) | "Today: 35% clean. Crowd over half. NEW: the Ping Track." The "Keep the crowd happy." tail goes, since the Board's gauge says it. | b4, `sim.js` memo lines |
| 6.11 | **"Lowered graphics" every ~14 s** | A (artefacts) | `perf.js`'s auto-lower toast fires **once a session**, and the auto-lower steps at most once per 60 s. Check on a throttled CPU. | b4, `perf.js` |
| 6.12 | **The washer goal shows more than it pays** | A #9 | The ✦ reward on the report reads "≈ +$56", with the tilde, because the BV moves before the buy. The real fix (pay what was shown) moves the economy goldens, so it's left alone. | b4, `goals.js` |
| 6.13 | **The Board labels for this round's events** | items 1, 2, 5 | `GOLD RUSH`, `HAPPY HOUR`, and the poach tick. | b4, `board.js` |
| 6.14 | **The mowed line, Employee on $0, "Wands at the bell"** | A #2, #7, #10 | In item 4d/4e. | → b1 |
| 6.15 | **The Tournament's caddie feed double, flight 2 buried** | B #3, §3 | In item 3b. | → b2 |

**Verify:**
- **Unit tests** for 6.1 (the slot distances), 6.2 (the size cap and the fade, with a fake camera), 6.3 (the yaw at
  each venue), 6.4 (the line order and holds, scripted), 6.5 (`payRoute` for `me` → `'hud'`), 6.6 (the follow
  ordering in `centre.js`), 6.7 (early presses on the ending report don't start the countdown; a normal report is
  unchanged), 6.9 and 6.10 (`words.test.mjs`).
- **`textload.mjs`** over every morning and every event window of the game, 1P / 4P × 3 seeds: **0 overlaps**,
  including the new Gold Rush, Happy Hour, poach and Gary-day windows.
- **Browser** (fronted, `?debug`, with the widened `__centre` zone from 0d):
  - `lastbucket` → bank → endcard → endless day 1, idle at the spawn: **0 overlaps**, the endcard up ≥ 10 s with a
    seat pressing Ready early, and a shot of the first endless frame with Gary at the case at normal size;
  - a new solo crew on Muni day 1 (with `rangerat.hints.v1` cleared): the checklist never blinks across five banks;
  - Muni day 4 solo: one Gary line at a time (a log of the centre over the inspection);
  - shots of the Club, Tiered and endless spawns.

---

### 7 · *(Optional, slips first)* The Coach Party on Club day 1 — S · builder 2

*A's idea 3. Club day 1 at 4P is 0.85 calls a minute. With the Gold Rush on day 2, day 1 is the Club's last low
cell. It's the reveal day, so this item is optional, and it's built only once items 1–2 have passed their checks.*

- **When:** Club day 1 at **T−3:30** (shiftT 210), for **60 s**.
- **What happens:** a coach pulls up, and every bay is taken.
  - For 60 s, customer balls run at **×2** (the poach module's extra-launch pattern from the occupied mats).
  - **The bucket basket draws ×2**, and the fry demand ×1.5.
  - The calls come from the ruler's existing kinds (basket < 25 %, fries < 30 %, mats > 50 % dirty). This is a co-op
    ask, not another ball to chase.
- **One ALERT:** **"Coach party! Buckets and fries, now!"** (6).
- **The report row:** "Coach party: 0 left without a bucket." / "Coach party: 3 walked out."
- **Files:** new `server/venues/coach.mjs` and `web/js/coach.js`, a small `views/coach.js` (the coach at the gate),
  `test/coach.test.mjs`.
- **Verify:** 4P Club day 1 calls **≥ 1.3** offered. The Club's length is unchanged. 1P is unaffected beyond a busier
  minute (×2 balls is still within what the solo bot handles).

---

### Votes

- **G yes:** "One grammar, beams plus a clock plus a rival, now runs from Muni day 3 to the Club's back half. A new crew
  learns it on the day the gold arrives."
- **E yes:** "No new pay rules at the Muni: the Rush balls are ordinary gold. The Happy Hour and landmark numbers are
  checked against the fee at every venue's last bell. The Orbital stays under $100M."
- **M yes:** "Every new event has a 1P shape: a pair within 30 m, and a 40–45 s clock. The 4P shape is a four-way split
  with a diver."
- **L yes:** "I sign off the endless row against the case, the washer and the post, and the down-range yaw at all
  six venues."
- **T yes:** "Three small modules on the shipped pattern, the beacon path for every beam, and no refactor of
  `tourney.mjs`. The lint and `wired.test` close the bug class that cost us round 9."
- **C yes:** "Site 13 dumping gold over our fence, then stealing it back 'for research', is the best gag we've had."
- **Q yes:** "Item 0 first, the smoke run before the review, and every check fronted at ≥ 20 fps. Last round's visual
  claims were taken at 1 fps."

**7–0.**

---

## 2a. Who builds what

Four builders.
- **Only a file's owner edits it.** Anyone else hands their lines to the owner.
- The two hot files are split **by region**, below. Line numbers are at `097c941`. If a merge has moved a region, find
  it by its name.
- **Nobody edits outside their region.**

| Builder | Items, in order | Owns (only they edit) | `server/crew.mjs` region | `web/js/main.js` region | Hands to another owner |
| --- | --- | --- | --- | --- | --- |
| **1 · MOW-E and the crash** | #4 (+ 6.14) | `mowe.js`, `mower.js`, `sfx.js`, `awards.js`, `server/venues/stadium.mjs`, `stadium.js`, `views/stadium.js`, `scripts/bots/boss.mjs`, `pt7a-boss.mjs`, `policy/whistle.mjs`, `test/boss.test.mjs` | **`stepGary`'s warn condition** (~l.1728, one clause); **`stepMowe`…`moweLose`** (~l.1811–1970) | the mower event cases (~l.735–741: the loss line's `say`); **the knockdown case's `'mower'` branch** (~l.866); the boss prompts (~l.1218–1231) if needed | — |
| **2 · Peaks** | #1 → #2 → 3b → #7 (+ 6.15) | new `goldrush.js`, `server/venues/goldrush.mjs`, `views/goldrush.js`, `happyhour.js`, `server/venues/happyhour.mjs`, `views/happyhour.js`, `coach.js`, `server/venues/coach.mjs`, `views/coach.js`; `tourney.js`, `server/venues/tourney.mjs`, `views/tourney.js`; `deck.js`, `server/venues/deck.mjs`; `rally.js`; `policy/goldrush.mjs`, `policy/happyhour.mjs`, `policy/tourney.mjs`; `test/goldrush.test.mjs`, `test/happyhour.test.mjs`, `test/tourney.test.mjs`, `test/rally.test.mjs`, `test/coach.test.mjs` | **none** | **none** (the views register through `views/index.js` → b4) | the index lines, Board lines, eve lines (`tomorrowText`) and the Tiered card's per-size `n` → b4 |
| **3 · Economy and story** | 3a → 3c → #5 | `landmarks.js`, `views/landmarks.js`; `owner.js`, `server/venues/poach.mjs`, `views/owner.js`; `county.js`, `server/venues/county.mjs`, `views/county.js`; `orbit.js`, `server/venues/orbit.mjs`, `views/orbit.js`; `caserules.js`, `views/glasscase.js`, `views/garycameo.js`, `round2.js`; `policy/landmarks.mjs`, `policy/poach.mjs`; `test/landmarks.test.mjs`, `test/owner.test.mjs`, `test/county.test.mjs`, `test/orbit.test.mjs`, `test/round2.test.mjs` | **`buyPoach`** (~l.575–583); the `nextPrice(...)` call in **`buy()`** (~l.589: `shopVday`) | **none** | the SHOP order and Board tick → b4 |
| **4 · Gates, hooks and polish** | **#0 (first)** → #6 (**last**) | `scripts/bots/*` (except the boss bots and `policy/*`), `calls.mjs`, `textload.mjs`, `make-presets.mjs`, new `smoke.mjs`, `server/presets/*.json`; `server/venues/index.mjs`, `views/index.js`; `sim.js`, `board.js`, `goals.js`, `recap.js`, `dayend.js`, `ending.js`, `perf.js`, `payfloat.js`, `bubbleclamp.js`, `spawnlook.js`, `centre.js`, `centrewatch.js`, `nudge.js`, `server/venues/nudge.mjs`; `test/maincalls.test.mjs`, new `test/nocodeincomments.test.mjs`, `test/wired.test.mjs`, `test/centre.test.mjs`, `test/say.test.mjs` | **`startShift`**: the memo push (~l.1186–1196) and the clock-in loop's yaw (~l.1150); **`readyUp`** (~l.750); the **ready timer** in `tick` (~l.2408–2409); **`endShift`'s report object** (~l.2459+: `rows`); **`tomorrowText`** (~l.2750) | the `'gary'`/`'check'` cases (~l.779–796); the checklist gate (~l.1668–1753); the payfloat roller; the spawn placement (~l.938); Gary's bubble (~l.2197); the per-frame ticks (~l.2143–2152: the lint keeps them live) | — |

**Merge order.**
1. **Builder 4's item 0** lands first, on its own: the lint, `wired.test` (red on purpose, with the allow-list
   naming the three lines item 5 wires), the hooks (`reportRows`, `memoEvent`, `shopVday`), the ruler column, the
   presets and the counter zone. No game behaviour changes, and the goldens don't move.
2. **The modules, in parallel, on top:** builder 2's new modules and builder 3's landmark, poach and story files.
   Neither touches `main.js`, and their `crew.mjs` footprints are disjoint (b3: `buyPoach`/`buy`; b2: none).
3. **The hot files: builder 3 → builder 1 → builder 4.**
   - Builder 3's `crew.mjs` footprint is two lines.
   - Builder 1's is one `stepGary` clause and `stepMowe`; in `main.js`, two cases.
   - **Builder 4's item 6 goes last.** It owns the centre's sweep, so it catches every new line from builders 1–3 in
     `textload` and the `__centre` counter, on the finished build.
4. **The lead:**
   - re-records the seam goldens once. Expected moves: Muni day 3+ (the Gold Rush's ids), Club day 1 (only if item 7
     shipped), Club day 2+, Tiered (Happy Hour), the Stadium's Promotion Day (the crash at T−6:00), the County and
     Orbital with a landmark owned, endless with a poach. **Muni days 1–2 must not move.**
   - regenerates the presets with item 0's script;
   - runs **`scripts/smoke.mjs`** headful and fronted; it must exit 0 (§4.1);
   - runs `make preflight`.

**Shared tests:** `test/words.test.mjs` takes everyone's new lines. Append only, one block per builder; the lead
resolves conflicts there.

**Done lines** (each in the commit message):
- **Builder 1:** the crash day order (crash → Gary → Stretch) at 3 seeds; the loss line alone ≥ 2.5 s; boss win rates
  unchanged.
- **Builder 2:** Muni day 3 ≥ 0.8 / ≥ 1.1 calls a minute; Club day 2 4P ≥ 1.4; Tiered off-deck ≥ 1.0 / ≥ 1.5; 1P
  Tiered ≤ 5 shifts median; member balls 1P ≥ 50 %.
- **Builder 3:** the bell rung in ≥ 80 % of owned Club/Tiered shifts; tiers 3–4 fire in 9 of 9; the poach table;
  `wired.test` green.
- **Builder 4:** the lint red on round 9 and green now; `textload` 0 overlaps on every window; the browser checks in
  6's verify; the smoke run green.

---

## 3. Deferred (and why)

This is the last build loop, so "deferred" means **left for the owner after the review**, not "next round".

- **Endless days 3+ mid-shift** (C's dead minute). Item 5 makes the poach a weekly bet rather than a formality, and the
  Gold Rush and Happy Hour don't run in endless. A real endless peak ("Greatest Hits" theme days, or a MOW-E rematch
  in endless) is still the best long-term idea, and still an L.
- **The deck orders as the Tiered ruler's bulk** (B #7). Item 0's "answered" column measures it honestly. No
  redesign.
- **The Tap Wall seen from the ground** (B #10). It's unconfirmed from the deck (B couldn't climb at 1.5 fps). The
  review loop checks it fronted. If it's still unseen there, it's a note for the owner.
- **Muni day 4's busy morning** (A #6: 3 cards + memo + PA in ~25 s, one at a time). It reads one at a time, so it's
  left alone. 6.4 calms the inspection itself.
- **The washer reward paid as shown** (A #9). It needs the BV locked at the report, which moves the economy goldens.
  6.12 adds the "≈" instead.
- **The pet's whistle share at 1P** (B: 27–33 % against ≥ 40 %). The pet is small now (8–9.5 % of balls), which was
  the point. The 1P bot's whistle policy is the likelier cause.
- **The boss build-up camera nudge**, **Gary as a fifth Rat in endless**, and **"Previously on Range Rat"**: deferred
  again for the same reasons as round 13 (control loss on a pad; the story pass; the review judges whether it's
  needed).
- **A real 4P browser boss fight.** It's still a tooling gap. The owner's sofa is the test.

**Left alone on purpose:**
- the venue fees and cards, except Tiered's 1P `reviews` (2b step 3, conditional);
- the boss's HP table and fight rules;
- the note at the huddle, the bank, the epilogue and every story line not named above;
- the Stretch, Inspection Hour and the Tournament's ×45 pay.

---

## 4. The final review-only loop

**No council and no build follow it.** Every finding is logged for the owner, not fixed. The loop's card is the
verdict.

### 4.1 Before the reviewers start (the lead)

1. **The release candidate:** `make preflight` is green, `node --test test/` is green, the goldens are re-recorded and
   the presets are regenerated.
2. **`scripts/smoke.mjs` exits 0** on a headful, fronted browser at ≥ 20 fps. It checks:
   - the boss moves;
   - the Gold Rush ALERT is alone;
   - Happy Hour fires;
   - the crash's loss line is shown ≥ 2.5 s;
   - the bank and endcard have 0 overlaps and the endcard is up ≥ 10 s.

   If smoke fails, the candidate isn't reviewed. It goes back to the builder whose beat failed, and that is the only
   fix allowed before the review.
3. **The whole ladder, headless, by the lead:** 1P / 2P / 4P × seeds 7 / 11 / 23, with `BUY=1 TOURNEY=1 WHISTLE=aim
   POACH=1`, from Muni day 1 to endless day 5. The lead publishes the time to the ending, the shifts per venue,
   calls a minute (offered and answered) per venue, and cash against the fee at each venue's last bell, so reviewers
   score fun, not arithmetic.

### 4.2 What the three reviewers play, end to end

Every reviewer plays **the whole game in one sitting**, from a **new crew with `rangerat.hints.v1` cleared**. They play
in **their own fronted browser window** (not a shared pane), at **≥ 20 fps** read from `?perf`, and at least half the
session **on a pad** (Xbox pad in Edge, or the pad emulation). Any visual claim taken under 20 fps is marked
unverified.

| Reviewer | Crew | Plays | Owns the verdict on |
| --- | --- | --- | --- |
| **A · The sofa crew** | **4P**: the reviewer on seat 1, plus `seats.mjs` and bots for three seats | Muni day 1 → the ending → endless day 3. **Lose the first boss on purpose, then win the rematch.** | The owner's target crew. Co-op splits: the Gold Rush, the Tournament, Happy Hour, the Stretch, the bank's "HOLD SPACE TOGETHER". The crash day. The final report with seats readying early. |
| **B · The solo night** | **1P** | Muni day 1 → the ending (the longest path: 1P Tiered and the 1P ladder) → endless day 2 | Pacing and "one more shift" for the slowest crew. Every 1P shape (the 40–45 s clocks, the pairs, the solo hunt line, Gary's one line). Clarity for a first-timer. |
| **C · Two friends and the stress test** | **2P** (two windows or seats) | Muni day 1 → endless day 5, with Site 13's week and a poach | The late game and endless. Then **quit and rejoin** mid-boss, mid-Tournament, mid-Happy Hour, mid-bank and on Promotion Day (every save restores). Perf with the CPU throttled ×6 (`?perf` p95). |

**Everyone records:**
- the ten metrics, for the **whole game** and **per stretch** (the first hour: Muni → the first boss; the middle: Club
  day 4 → the Stadium; the late game: the Stadium → endless), so "no metric under 6.5" is checked where it can hide;
- `__centre.overlaps` at the end of each stretch (with the widened zone), and a shot of every overlap with both texts;
- the longest gap with no call (target: none over 3 minutes of play at any venue);
- softlocks and dead ends (target: none), and any centre line over 8 words;
- the best minute and the dead minute of each stretch;
- **"one more shift?"** at three points: after the first boss, after leaving the Club, and at endless day 3;
- the heart through-line. Does Gary's thread land as one story (the clipboard → "I raked this pond once" → the 1987
  tape → "I was a Range Rat" → the Lift → the star → the case)? Does Ball No. 1's ending land after two hours? Do Site
  13 ("for research") and Dimples stay funny without crowding it?

### 4.3 The ship bar

**Ship it to the sofa** when **all** of these hold:
1. **Overall ≥ 7.0** (the average of the three whole-game scores), with **no metric under 6.5** in any reviewer's
   whole-game card **or** any stretch;
2. **no Critical or High finding open.** That means:
   - no softlock or lost save;
   - nothing invisible that the game asks you to act on;
   - no centre line nobody can read;
3. **`__centre.overlaps` = 0** in every stretch of every run;
4. **every crew size reaches the ending:** 1P, 2P and 4P, in the lead's ladder and in the reviewers' runs;
5. **perf:** `?perf` p95 ≤ 20 ms with the CPU throttled, at the Stretch with fireworks, boss phase 2, a Tournament
   flight, Happy Hour, and the return with the case.

**The target is Overall ≥ 7.2**, this round's goal. Between 7.0 and 7.2, the game ships, and the findings go to the
owner as a ranked list for any later work.

**Below the bar** (Overall < 7.0, any metric < 6.5, or any Critical/High), the owner decides between:
- shipping as is;
- **a hotfix-only pass**: the named Critical/High findings only, each with its test, then one smoke run. There is no
  new council and no new features.

> G (closing): "After this, the sofa is the scorecard."
