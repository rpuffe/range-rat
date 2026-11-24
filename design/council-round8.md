# Fun Council, round 8: go for fun before the last playthrough

This is the record of Range Rat's eighth Fun Council (2026-11-24, after playthrough 3 on build f43665a, with the
playthrough 3 fixes at 8181c12). Rounds 1–7 still bind wherever this record doesn't change them. Where they disagree,
this record wins. **This is the last council before playthrough 4, the final playthrough.** Every item here is meant to
be low-risk and quick to verify.

**The owner's firm calls (unchanged, binding):** multiplayer first (up to 6, balanced for 4, no assigned roles;
suggestions and nudges are fine) · one day = one shift · knockdowns when a ball hits you · scuba should be fancy · no
named balls · rare PA lines, big events only · the kitchen serves fries, hot dogs and beer · at Tiered, overserving
beer makes a lounger fall off the top deck · the shop opens any time · Xbox controller, Xbox Edge as the performance
floor · every feature "actually worth it and meaningful" · one text element in the middle of the screen at a time,
about 8 words · for decisions, the more fun and easier option for a casual crew of 4.

**The council (same seats as rounds 5–7).**

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

**The brief.** Fun has sat at 6.0 → 6.3 → 6.3 for three rounds while Text load (4.0 → 7.0), Clarity and Polish
climbed. The plumbing is done. This round spends its whole budget on fun: the moments where the crew yells, laughs or
races the clock. Every item had to answer "what moment does this make?" before it got a number.

**What the council read and ran:**
- `design/playtest-round3.md` (three fresh playtesters on the round-7 build, with "Ideas for council 8"),
  `design/scorecard.md` rounds 1–3, and the last sections of `game-design.md` (council round 7's build and the
  playthrough 3 fixes).
- The code: `server/venues/tiered.mjs`, `deck.mjs`, `orbit.mjs`, `nudge.mjs`; `web/js/tiered.js`, `deck.js`,
  `orbit.js`, `dive.js`, `owner.js`, `nudge.js`, `rally.js`, `customers.js`, `views/tiered.js`, `views/orbit.js`,
  `board.js`, `round2.js`; and in `server/crew.mjs`: `stepGary`, `garyEta`, `inspect`, the ball loop's Gary-cart hit
  ("enthusiasm"), `beginLastBucket`, `stepLastBucket`, `depositOne`, `endShift` (records), `tick` (Last Call, glow).
- **Already in hand, not re-planned here:** every finding marked ✓ in the playtest (8181c12), and playtester A's bugs
  1–6, 9, 10 and 12, which a builder is fixing now in the working tree (`crew.mjs`, `nudge.mjs`, `nudge.js`,
  `rally.js`, `round2.js`, `promopanel.js`, `sim.js`, `huddlerules.js` are mid-edit). That covers A's ideas 1–4 and
  the Gary-line, countdown, "On target" margin, re-check reshuffle, report-bar and long-line fixes. The working tree
  already shows the "Record shift!" line limited to endless (`round2.js`, playthrough 3 #5).
- Seven headless scripts against the real `Crew` (scratchpad `council8/`, harness `h.mjs` copied from round 7). They
  edit no game code: rule variants are emulated from outside (extra resting balls through the real `tiered.onRest`,
  fines recomputed from the real `deckFines`, a mutated constant, or a held `crew.mult`). **They ran on the working tree
  mid-edit**, so treat ±0.05 as noise; the bug builder's changes don't touch any rule measured here.
  - **`tiered.mjs`, `tiered2.mjs`, `tiered3.mjs`**: Tiered, 1P/2P/4P/6P, four teenagers, LATE gear, gutters bought,
    seeds 1–6. Bay Utilization at the bell by when a TARGET lands, today and with Last Call's cups filling ×2 and ×3,
    plus B's "downhill" rule (a TARGET drains its bowl and every nearer one).
  - **`deck.mjs`, `deck2.mjs`**: the Upper Deck, 4P, a cook at the shed: careful (hot dog at amber, waves rounds off at
    amber), greedy (fills every order and round at once, no food), reckless (greedy plus an unordered beer every 10 s).
    Net cash against the same seed with a cook who never pours. Fines today (flat 50 × BV) and escalating.
  - **`muni.mjs`**: Muni days 2–5, 4P and solo: the dirtiest active mat at 25/50/75/100% of the shift, waits and
    refusals, cleaned at the opening or not.
  - **`sky.mjs`**: the sky gate (58 debris, no tether) with two riders, all four riding, masks only, 2P and solo.
  - **`endless.mjs`**: ten idle 4P endless shifts and ten with effort varying (Hustle held at 1.0–2.0): how often a
    shift beats yesterday vs the all-time record; and shifts to each Owner's tier, today and proposed, from C's
    measured 4P and solo numbers.

---

## 0. What the numbers say before any idea is judged

**N1 · Tiered is "one TARGET in the last two minutes", and a shooter at Last Call takes several.** An idle 4P crew
fails every bell (cups 13–26 / 5–13 / 13–24, gauge 0.00). Today, one TARGET at T−50 passes 6 of 6 (0.50–0.83), at
T−90 3 of 5 fail, at T−150 4 of 5 fail. B's "can't fail once anyone shoots" is the Last-Call shooter: 3–30 TARGETs a
shift, so the last one always lands inside the safe window. The gauge isn't broken; it has no *late* pressure.

| Rule (4P, one TARGET at…) | T−50 | T−30 | T−15 | T−50 and T−20 |
| --- | --- | --- | --- | --- |
| Today (×1) | 0.50–0.83 (6/6 pass) | – | – | – |
| **Last Call cups fill ×2** | 0.00–0.63 (2/6 pass) | 0.33–0.80 (5/6) | **0.53–0.93 (6/6)** | 0.47–0.87 (4/6) |
| Last Call cups fill ×3 | 0.00–0.23 (0/6) | 0.00–0.73 (3/6, T−25) | 0.60–1.00 (6/6, T−10) | 0.20–0.80 (2/6) |
| B's "downhill" (A drains A, C drains all), T−30 | A: 0.00–0.07 · B: 0.00–0.37 · C: 0.67–0.93 | | | |

- ×2 turns the gauge into a buzzer-beater: the TARGET that counts lands in the last ~30 s. Solo ×2: T−50 fails 4 of
  6 (0.33–0.67), T−30 and T−15 pass 6 of 6 (0.60–0.93). 6P matches 4P (the mats cap at 4P's count).
- ×3 is a coin flip even for a crew shooting every 15 s (0.20–0.90). Too mean.
- "Downhill" makes Bowl C the only shot that matters (it fills fastest: 13–24 balls), and makes A, the beginner's
  green, worthless for the stamp. That's less fun for a casual crew, not more.

**N2 · The deck already favours care; a fall just doesn't *feel* like it costs.** Net cash vs a cook who never pours
(idle 4P crew, ~$47–57k a shift):

| Cook | Falls | Net today (50 × BV flat) | Net with escalation (50 / 100 / 200 / 200 × BV) |
| --- | --- | --- | --- |
| Careful (hot dog at amber) | 0 | **+47–54%** | +47–54% |
| Greedy (every order and round, no food) | 2 | +23–26% | **+10–11%** |
| Reckless (greedy + a beer every 10 s) | 13 | −62 to −69% | far negative |

The first fine is ~$7–10k (50 × BV). B's 4–5-fall cook sits between greedy and reckless: with escalation those falls
cost 750 × BV instead of 250 × BV, three times as much. The first fall stays the cheap joke the firm call wants.

**N3 · Muni mud never bites mid-shift.** Mats hosed at the opening reach only **0.47–0.53** by the bell (4P and
solo); a customer refuses at 0.9 (`CUST.REFUSE_MUD`). Mats left dirty from the night refuse 15–16 customers and cost
~20% of the shift's cash ($737 vs $915 on day 2 at 4P), but that's a morning job, not a mid-shift one. Making mud bite
mid-shift needs about twice the scuff, which round 7 already refused for the casual crew (N4 there).

**N4 · The sky gate is a ride, not an air problem.** With ideal bots and 58 debris: two riders on twin tanks clear it
in 16 s; all four riding (two twin, two masks) 16 s; four masks 27 s; 2P on masks 35 s; solo on a mask 62 s. Real
crews took 44–49 s (C). **No case ever ran short of air**: a bag fills (10/25/40) long before a 20/70 s tank empties,
and riders ride down when it's full. The platform crank adds nothing at any crew size. C's "pumping never mattered" is
reproduced.

**N5 · The endless record freezes because endless income is a plateau.** Ten idle 4P shifts: $20.8–23.3M, a new
record 1 time in 9. With effort varying from shift to shift (Hustle 1.0–2.0): $22.7–45.4M, a new record 2 times in 9,
both in the first three shifts. **Beating yesterday** happens 4/9 (idle) and 5/9 (varying): a fresh, winnable race
every morning. Prices: C's 4P ending report holds ~$200M (the $117M payout plus savings), and an active endless shift
banks ~$65M (~$100M with the Owner's Hustle at ×3). Today that buys tiers 1 and 2 on the ending's report (shift 0) and
the statue at shift 4.

---

## 1. The playtesters' ideas: verdicts

**Adopt** = build as proposed · **Adapt** = build the council's version · **Reject** = no, with the reason ·
**In hand** = already fixed or being fixed. "→ #n" points at the build list (§2).

### Playtester A (a new crew to the Range Club)

| # | Idea | Verdict | Why, and the seats that mattered |
| --- | --- | --- | --- |
| A1 | Gary lines stay up until Spotless; re-dealt if a stop fails again | **In hand** | A's bug 1 (the working tree's `GARY_SPOTLESS` 0.1 and `redealGary`). #2 builds on it |
| A2 | A 5 s countdown from the last stop before the stand | **In hand** | A's bug 2 (`GARY_COUNT` 5) |
| A3 | An Upkeep margin on "On target" | **In hand** | A's bug 3 |
| A4 | Keep each Rat's job at the 30 s re-check | **In hand** | A's bug 4 |
| A5 | One reason to hose mid-shift at 4P (a refused customer costs real Upkeep or cash) | **Reject the rule; the reason is Gary** (→ #2) | N3: a clean morning's mats never pass 0.53, so a refusal rule never fires mid-shift without doubling the scuff, which makes the casual crew's Muni harder for everyone. The Muni's mid-shift beat is Gary from day 4, and the Muni is 4–5 shifts (24–31 min at 4P); days 2 and 3 already have the dealt nudges and the day-3 mats line. **G:** "make Gary the reason, and make Gary better." #2 does that at every venue |
| A-cut | The Record line on review days (endless only) | **In hand; agreed** | The working tree's `round2.js` already shows it only in endless (playthrough 3 #5) |

### Playtester B (the Club and Tiered)

| # | Idea | Verdict | Why |
| --- | --- | --- | --- |
| B1 | Make Tiered able to fail: a linked flush drains only cups ≥ the shooter's, or Last Call's cup fill ×2 | **Adopt ×2, as the Glow Rush** (→ #1) | N1. ×2 makes the TARGET that counts the one in the last ~30 s: B's best moment (0:12, 0.40 → 1.00) becomes the venue's design. "Downhill" turns Bowl A into a dud and Bowl C into a chore; ×3 fails crews who did everything right. Last Call's customer balls are already all glow balls, so the rule is "a glow ball fills a cup twice" and the cups visibly light up at dusk. **C** (dissent, recorded): "harder is not more fun." Outvoted 6–1: one TARGET in the last 30 s is easy (first TARGET came in under 1 min) and the rally deals the job |
| B2 | TARGET first with the cash folded in; "Saved by a TARGET at 0:02" in the report | **In hand ✓ / Adopt** (→ #6) | The toast is fixed (8181c12). The report line celebrates exactly the moment #1 creates |
| B3 | Deal Gary's lines with no duplicates; extras get nothing or "Keep picking" | **Adapt** (→ #2) | One Rat per failing stop. Extras get a job that matters: stall Gary with a ball off his cart, or, when every stop is clean, meet him at the stand (the huddle doubles the commendation). "Keep picking" is a non-line |
| B4 | A fall really costs: resets Hustle to ×1, fails Gary's kitchen stop for the day | **Adapt: the fine escalates** (→ #5) | N2. **E:** the careful cook already earns twice the greedy one; what's missing is a sting on the *second* fall. A Hustle reset punishes the shooter for the cook's choice (×3 in endless makes it brutal) and is invisible to the cook. A day-long kitchen fail would deal Gary lines nobody can fix. **C:** "the first fall is the joke; the third is a lawsuit." |
| B5 | Round money over $100 everywhere | **In hand ✓** | 8181c12 (`money()` rounds from $100) |
| B-cut | The marker's beam | **Cut** (→ #6) | Invisible at 143 m (B); the disc does all the work. −1 draw call on Edge |

### Playtester C (Stadium → County → Orbital → the ending → endless)

| # | Idea | Verdict | Why |
| --- | --- | --- | --- |
| C1 | Two-Minute Warning from Stadium day 1 | **In hand ✓** | 8181c12 |
| C2 | Hold the clock in 'sky' at the bell | **In hand ✓** | 8181c12 (`SKY_HOLD_SECS` 90) |
| C3 | "Keep lapping!" re-check; label the report's crowd numbers | **In hand ✓** | 8181c12 |
| C4 | Endless: price tiers against the payout (tier 1 a shift after, statue 6–8 shifts); a weekly record or "best this week" | **Adapt** (→ #3) | N5. **The Board races yesterday**, not the frozen record: a coin flip each morning that effort tips. A streak counts the mornings in a row. Crew colours stop being a purchase and become the deed: Site 12 is painted in your colours the morning after the Last Bucket. The Owner's Hustle $60M → $120M base, the statue $150M → $300M: at 4P the Hustle comes 1 shift after the ending and the statue 8 (solo 2 and 9). "Best this week" was rejected: beating a rolling max is ~1 in 6 for a plateaued crew |
| C5 | Make the pump matter in the sky: shorter EVA air, or debris that drifts unless a buddy cranks | **Reject; cut the crank instead** (→ #4) | N4. Air never binds, and making it bind (halving EVA air) puts two Rats on a handle 120 m below the fun. **C:** "everyone in space for the finale is the better picture." **M:** the Lift has no rider cap, and every Rat has at least a mask (10 a bag): four riders clear 45 pieces in one trip. The finale's co-op shape becomes "everyone up, everyone down, everyone to the stand" |
| C-cut | The pumper role at the sky gate, or the Crew colours tier | **Both cut** (→ #3, #4) | The crank goes from the Lift. Crew colours stays as art, but as the ownership reward, not a $55M line on the ending's report |

### The brief's named drags, and where each lands

| Drag | Lands in |
| --- | --- |
| Tiered can't fail once anyone shoots | #1, the Glow Rush |
| The deck fine is cash-neutral for a reckless cook | #5, Liability escalates |
| The Muni stamp is a pure Last Call chore | Rejected as a rule (N3); #2 makes Gary the mid-shift beat |
| Endless tiers bought on the ending's report; the record freezes | #3 |
| Pumping is pointless in the sky gate | #4, cut |
| Gary's warning could go further | #2 |

---

## 2. The build list (ranked)

Ranked by fun per effort. **XS** < 1 hour · **S** an evening · **M** two evenings. **Core** = edits `crew.mjs`,
`main.js` or `sim.js`. Every item adds its tests to `node --test test/` and updates `game-design.md` in the same commit.
**Nothing starts until the A-bug branch merges** (it is mid-edit in `crew.mjs`, `nudge.*`, `rally.js`, `round2.js`,
`sim.js`).

**One text:** every new centre string goes through `say()` with a kind, and is ≤ 8 words (`test/words.test.mjs` scans
`say(` literals; add every new constant line to its list). Nudge-slot lines (top-left), the feed, the Board, the
banner and flags are edge or world text.
**Xbox:** no item adds a mesh; #6 removes one draw call. The `?perf` p95 budget stays ≤ 20 ms on Edge.

---

### #1 · The Glow Rush: Tiered's cups fill twice as fast in Last Call (XS, leaf; one rally line)

**The moment.** Last Call at Tiered: the lights come on, the cups glow and climb, and the TARGET that saves the stamp
is the one that lands at 0:15. A shooter who stops early watches the flags go red.

**Behaviour.**
- At Tiered (the venue with `drainsAll`, venue 2), **a customer glow ball resting in a cup counts 2** towards the cup
  count and Bay Utilization. Glow balls only spawn in Last Call (`crew.mjs` tick: `lastCall ? 'glow'`), so this is a
  Last Call rule with no clock check. `TARGET`/`RUSH` constant: `RUSH = { GLOW_CUP: 2, VENUE: 2 }` in `web/js/tiered.js`.
- The flush still banks real balls (`ballCount`), not the doubled count. Crew balls never cup (they're TARGETs).
- From the Stadium on, unchanged (no graded Bay Utilization there).
- The flags show the doubled count (they read `st.cups`), and a glow ball in a cup keeps its glow material, so the
  bowls light up at dusk with no new mesh.
- **The rally.** At Tiered, `RALLY_MARGIN[2]` 0.25 → **0.5**, so Last Call deals the bowls job almost every bell
  (the gauge forecast is short unless the cups are near empty). `RALLY_LINES[2]` becomes **"Glow rush! Cups fill
  double. Shoot late!"** (7 words). `GAUGE_MISS[2]` becomes "Missed: the glow rush filled the bowls." (7 words).
- `LAST_CALL.FROM_DAY` is global day 2 and a crew reaches Tiered around day 9, so every Tiered shift has the rush.

**Numbers (tiered3.mjs, real onRest, ×2 emulated).** One TARGET at T−15: 4P 0.53–0.93, solo 0.73–0.93 (6/6 pass
both). At T−50: 4P 2/6 pass, solo 2/6. Nobody shooting: 0.00 as today. A Last-Call shooter (3–30 TARGETs a shift,
B) passes if they keep shooting to the bell.

**Files.** `web/js/tiered.js` (`RUSH`, pure `cupWeight(b, venue)`), `server/venues/tiered.mjs` (`recount` uses
`cupWeight`), `web/js/rally.js` (`RALLY_MARGIN[2]`, `RALLY_LINES[2]`, `GAUGE_MISS[2]`; after the A-bug merge).

**Tests.** `test/tiered.test.mjs`:
- A resting customer glow ball in Bowl A counts 2; a range ball counts 1; a splitter 3.
- At venue 3 a glow ball counts 1.
- A TARGET on a cup holding 4 glow balls banks 4 balls (+ the shooter's), not 8.
- Seeded 4P shift with ×2: one TARGET at T−15 ends ≥ 0.5 on seeds 1–3; one at T−50 ends < 0.5 on at least 2 of seeds
  1–6 (pins the rule's teeth).
`test/rally.test.mjs`: the Tiered Last Call line is the glow-rush line at a forecast of 0.6; `test/words.test.mjs`
picks up both lines.

**One text / Xbox.** The rally is the existing dealt `ALERT`. No meshes, no new draws.

---

### #2 · Gary goes further: every Rat a different job, and you can stall him (S, core-light)

**The moment.** Gary's warning: Di hoses the sign, Cy the mats, you're on the cart, and Al, with no stop left, runs to
a bay and pings Gary's cart twice. He stops, takes notes, and the mats come clean with a second to spare.

**Behaviour.**
1. **No duplicate stops** (B3). `dealGary` deals one Rat per failing stop, nearest pair first (as today). **Extras no
   longer double up on the mats.** Each extra Rat gets:
   - **`gary:stall`** "Stall Gary: ping his cart!" (5 words), when at least one stop is failing; or
   - **`gary:stand`** "All clean. Meet Gary at the stand!" (7 words), when nothing is failing (every Rat, then). A
     full huddle at the stand doubles the commendation (existing rule), so this is the reward line.
   - A Rat whose stop goes Spotless takes the next unheld failing stop (A-bug `redealGary`), else `gary:stall`.
2. **The stall.** While Gary drives (`g.phase === 'drive'`), a crew ball that hits his cart (the existing "enthusiasm"
   branch in the ball loop) also **stops him for `GARY.STALL` 3 s, at most `GARY.STALLS` 3 times a visit** (`g.stalls`).
   He's "taking notes": `g.pause += 3`. A customer ball notes nothing (needs `b.by`). It works on every leg,
   including the stand leg; the huddle-ring and run-over rules are unchanged. The Board's GARY 3·2·1 already counts
   `g.pause` in `garyEta`.
   - The `enthusiasm` event gains `stall: k` (1–3, absent past the cap).
   - The shooter's toast: **"Gary stalled! He's taking notes."** (5 words, `TOAST`). Past the cap the old line stays.
     Others get the feed line "Al stalled Gary. He's taking notes."
   - The view raises Gary's clipboard arm (the salute rig from round 6) for the 3 s.
3. **Nothing rewards or checks** who did what; the stall costs nothing. **E:** it's free and capped at +9 s.

**Numbers.** Gary's drive from his warning spot to the stand is ~30 s at the Muni by the route's lengths (46 m, 17 m
and the cart leg at 5 m/s, plus 3 s a stop) and ~40 s from the Club (the kitchen leg); +9 s is a quarter of it. At the round-7 hose rate (0.08 mud/s), 9 s is 0.72 mud: one filthy fixture from
1.0 to under `GARY.CLEAN` 0.34. That's exactly the margin by which A's crews failed. Playthrough 3 saw 50 Gary-cart
hits in one bot run without trying, so a backwards punch from a bay reaches his route (Q to confirm from both bays).

**Seat views.**
- **M:** "four Rats, four different lines, every time. That's the crew moment B and A both named, finished."
- **C:** "pelting the inspector so your mate can finish hosing is the most us thing in the game."
- **Q:** the stall never blocks: it only adds `pause`, is capped, and is ignored outside 'drive'. A Rat knocked down
  by Gary while stalled: unchanged (he isn't moving). A late joiner gets `gary:stall` or a free stop.
- **L:** both crew bays face the field; Gary's route runs behind them, 10–15 m from the east bay. Turning round to hit
  backwards is the trick. Nothing on the map changes.

**Files.** `web/js/sim.js` (`GARY.STALL 3`, `GARY.STALLS 3`), `server/crew.mjs` (the enthusiasm branch: stall,
`g.stalls`, the event field; `stepGary` init `stalls: 0`), `web/js/nudge.js` (`dealGary` extras, `GARY_TEXT.stall`,
`GARY_TEXT.stand`), `server/venues/nudge.mjs` (deal `gary:stand` when `failingStops` is empty), `web/js/main.js` (the
`enthusiasm` toast/feed with `stall`), the Gary view (clipboard arm; where `buildGary` lives).

**Tests.**
- `test/dealt.test.mjs`: 4 Rats, 1 failing stop → 1 stop line + 3 `gary:stall`; 4 Rats, 0 failing → 4 `gary:stand`;
  4 Rats, 4 failing → 4 different stops; 6 Rats, 2 failing → 2 + 4 stall; solo with 3 failing → the nearest stop
  (unchanged A-bug rule).
- `test/round2.test.mjs` (or `onboarding`): a crew ball hitting Gary's cart in 'drive' adds 3 s of pause and
  `stall: 1`; the fourth hit adds none; a hit in 'warn' does nothing; a customer ball does nothing; `garyEta` grows
  by 3 s after a stall; the verdict is unchanged by stalls.
- `test/words.test.mjs`: the two new lines and the toast.

**One text / Xbox.** Lines in the nudge slot; one `TOAST` for the shooter. No meshes.

---

### #3 · Endless: race yesterday, own the paint, earn the projects (S–M, mostly leaf)

**The moment.** Every endless morning the Board asks one question, "beat yesterday?", and the crew can answer it by
playing the toys. The report says "Beat yesterday · 4 in a row".

**Behaviour.**
1. **The Board races yesterday.** At every endless bell, `records.yesterday = { cash, curve }` (the shift's cash and its
   14-point curve, `finishCurve`). The snapshot's `pace` reads `yesterday` when present (`paceAt` takes any
   `{ cash, curve }`), else the record as today. The endless Board's bar runs from $0 to yesterday with the pace tick on
   yesterday's curve; the right-hand number reads **YESTERDAY $X**; the all-time **BEST $Y** moves to a small line
   under it. The green crossing flash is unchanged.
2. **The streak.** `records.streak`: +1 for an endless shift that beats yesterday, else 0. The report's first line in
   endless: **"Beat yesterday · 4 in a row."** (6 words) or **"Short of yesterday by $2.1M."** (5 words). The
   all-time record keeps its rare PA and its "Record shift!" line.
3. **Crew colours become the deed.** When Ball No. 1 banks (`depositOne`), `up.owner = max(up.owner, 1)`: the stand,
   Board and carts repaint in the crew's stripes on the first endless morning. A save already in endless with
   `owner` 0 is lifted on load. The row's tier 1 keeps its index (no save migration) with cost 0 and "Site 12 is
   yours. It's in your colours now." so the shop's next tier is the Owner's Hustle.
4. **Prices** (base, ×2.2 at 4P): **the Owner's Hustle $60M → $120M**, **the statue $150M → $300M**.

**Numbers (endless.mjs).** Beat yesterday: 4/9 idle, 5/9 with varying effort; new all-time record 1/9 and 2/9. 4P
(C's numbers: ~$200M on the ending's report, ~$65M a shift, ~$100M with ×3): the Hustle after **1** endless shift,
the statue after **8**. Solo (~$85M, ~$28M a shift, ~$45M with ×3): 2 and 9. Today: 0, 0 and 4.

**Files.** `web/js/owner.js` (`OWNER_ROW` tier 1 cost 0 and copy, prices, `streakLine`, `yesterdayPace`),
`server/crew.mjs` (`endShift`: `records.yesterday`, `records.streak`; `depositOne`: the deed; the constructor's
load-lift; snapshot `pace` reads yesterday), `web/js/board.js` (`drawEndless` labels), `web/js/round2.js` (the
endless report line), `web/js/sim.js` only if `shopShows` needs the cost-0 tier hidden (it shouldn't: tier 1 is owned).

**Tests.** `test/owner.test.mjs`:
- After `depositOne`, `up.owner` is 1 and `hasPaint` is true; an endless save with `owner` 0 loads as 1.
- `nextPrice('owner', {owner: 1}, 4, …, true)` is $264M; tier 2 → $660M.
- Two endless shifts: `records.yesterday.cash` is the second; `streak` counts up on a beat and resets on a miss;
  review days never write `yesterday` or `streak`.
- `pace.record` is yesterday's cash when present, the record's otherwise; an old save with no `yesterday` works.
- The report line's words ≤ 8.
`test/shop.test.mjs`: still no owner row outside endless.

**One text / Xbox.** One report line; the Board is in-world. Paint was already one merged mesh.

---

### #4 · Everyone up the Lift: cut the platform crank (S, leaf)

**The moment.** "CLEAR THE SKY · 30 UP": all four Rats pile into the Lift, grab in space, ride down together as Ball
No. 1 falls, and run for the stand.

**Behaviour.**
- **The crank goes.** The `orbpump` input, `st.pump`, the O2 gain in `orbit.mjs` tick, `crankGain`/`maxGain` in
  `orbit.js`, the "Tap Ⓐ to crank their oxygen" prompt in `views/orbit.js`, and the snapshot's `p` field. EVA air is
  the dive tier's tank, as now without a pumper (N4: it never ran short). The pond's buddy pump is untouched.
- **The sky line is everyone's.** The venue-5 Last Call line becomes **"Debris overhead. Everyone up the Lift!"** (6
  words), dealt as the same line to every Rat (one job: `dealJobs` gives all Rats the top job when it's the only one).
- The reveal's how-to is unchanged ("The Lift is open. Keep the sky clear.").

**Numbers (sky.mjs).** All four riding (two twin tanks, two masks): 16 s; four masks: 27 s; 2P masks: 35 s; solo:
62 s. Riders never ran out of air with or without a pumper.

**Files.** `server/venues/orbit.mjs`, `web/js/orbit.js`, `web/js/views/orbit.js`, `web/js/rally.js` (`RALLY_LINES[5]`,
after #1's rally edit), `game-design.md` (the Orbital section).

**Tests.** `test/orbit.test.mjs`: delete "a buddy on the platform cranks the O2"; add "an `orbpump` input is ignored
and changes no rider's air"; add "four Rats can ride at once". `test/ending.test.mjs`: the sky gate with four riders
on masks clears and Ball No. 1 falls. `test/words.test.mjs`: the new line.

**One text / Xbox.** One fewer prompt. Fewer per-frame checks at the Lift.

---

### #5 · Liability escalates: each fall in a shift costs double (XS, leaf)

**The moment.** The first lounger off the deck is a laugh and $8k. The second is $16k and someone grabs a hot dog.
The third is $32k and the cook gets yelled at.

**Behaviour.**
- The k-th incident of a shift costs **`DECK.FINE` × BV × min(2^(k−1), `DECK.FINE_CAP` 4)**: 50, 100, 200, 200 × BV.
  `st.falls` counts per shift and resets in `startShift`.
- The `deckFall` event gains `k`; the feed line names it: "Liability: −$16,400 (2nd fall today)." The PA card stays
  once-ever, as now. No new centre text.
- Kitchen stop: unchanged (fails only on a fall during his visit). A day-long fail was rejected (§1, B4).

**Numbers (deck2.mjs).** Careful +47–54% (no change); greedy, 2 falls, +23–26% → **+10–11%**; a 4–5-fall cook pays
550–750 × BV instead of 200–250 × BV, net negative.

**Files.** `web/js/deck.js` (`FINE_CAP`, `fineFor(bv, k)`), `server/venues/deck.mjs` (`st.falls`, pass `k`, the event
field), `web/js/main.js` (the `deckFall` feed text, through builder 2, who owns `main.js`).

**Tests.** `test/deck.test.mjs`: fines 50/100/200/200 × BV for falls 1–4 in a shift; `falls` resets each morning; the
seeded greedy cook (fills everything, no food) ends a shift with ≥ 2 falls and fines ≥ 150 × BV.

**One text / Xbox.** Feed only. None.

---

### #6 · The small pack (XS)

1. **Cut the marker's beam** (B-cut). `views/tiered.js` loses the beam mesh and material; `aim.js` loses
   `BEAM_H`/`BEAM_W`/`BEAM_OPACITY`; `markerState` is unchanged. Test: `test/aim.test.mjs` drops beam expectations.
   **−1 draw call** at a crew bay.
2. **"Saved by a TARGET"** (B2). In Last Call, a TARGET that lifts Bay Utilization from < 0.5 to ≥ 0.5 records
   `st.saved = { by, left }` (seconds left); a later dip under 0.5 clears it, another save replaces it. On a stamped
   bell the report reads **"Saved by Cy's TARGET at 0:12."** (6 words). Files: `server/venues/tiered.mjs` (`saved`,
   `endShift` copies it into the module's report field), `web/js/round2.js` (the line). Test: `test/tiered.test.mjs`
   — a seeded bell with the gauge at 0.3 and a TARGET at T−12 carries `saved.left` 12; with no late TARGET, none.

---

**Votes on the list:** G yes · E yes ("#3 and #5 are the only money changes, both measured") · M yes (wants #2's
6-Rat deal tested first) · L yes · T yes ("one item adds core lines, and it's ten of them") · C yes on all but #1's
difficulty ("we'll see in playthrough 4"; outvoted 6–1, recorded) · Q yes (#2's stall cap and #4's orbpump-ignored
test before merge). **7–0 on the list, 6–1 on #1.**

---

## 3. Cuts

**Cut in this round:**
- **The marker's beam** (#6.1). The disc stays.
- **The platform crank at the Lift** (#4): the pumper role at the sky gate, the O2 gain, its prompt and input.
- **Crew colours as a purchase** (#3): it becomes the deed, granted when Ball No. 1 banks.
- **The Record line on review days**: already endless-only in the working tree (playthrough 3 #5); agreed, nothing
  more to build.
- **Extras doubling up on the mats at Gary's warning** (#2).

**Rejected with numbers (so nobody re-litigates them):**
- **"Downhill" linked flush** (B1a): Bowl A's TARGET leaves 0.00–0.07; only Bowl C passes (0.67–0.93). It punishes the
  easy green.
- **Last Call cups ×3**: fails a crew shooting every 15 s on 1 seed in 6 and passes a single T−50 shot on 0 in 6.
- **A refused customer costs Upkeep or cash mid-shift** (A5): mud on a clean morning peaks at 0.47–0.53 against a 0.9
  refusal line; it would need ~2× scuff.
- **A fall resets Hustle** (B4a): it punishes the shooter for the cook, invisibly to the cook.
- **Halved EVA air so the crank matters** (C5a): two Rats on a handle, none in space.
- **"Best this week"** (C4b): a plateaued crew beats a rolling 5-shift max ~1 day in 6.

**Left alone on purpose:** the quota curves, `QUOTA_KPI`, `CUP_FULL`, every venue fee, Gary's schedule (day 4, 43%,
45 s), `SKY_CLEAR` 15 and `SKY_HOLD_SECS` 90, the deck's order timings and round rules, the tether price, every price
outside the Owner's projects.

---

## 4. What playthrough 4 must check

The final playthrough: a real 4P night (two on Xbox pads in Edge), one solo run, `?pace` and `?perf` on, the
playthrough 3 bots re-run on the new build, numbers into the scorecard. **Goals: Fun ≥ 7.0, Co-op ≥ 7.0, One more
shift ≥ 6.5 for C's slice, Text load holds ≥ 7.0.**

1. **The Glow Rush (#1).**
   - Every Tiered bell: when the last TARGET landed (seconds left), the gauge at the bell, stamped or not.
   - Goal: 4P crews that shoot through Last Call pass ≥ 80%; a crew that stops shooting before T−30 fails sometimes
     (it must be *able* to fail). Solo passes with one TARGET in the last 30 s.
   - Tiered shifts at 4P stay ≤ 4 (Club → Stadium ≤ 70 min).
   - Did anyone yell at the bell? Ask. "Saved by…" lines a shift.
2. **Gary (#2).**
   - At each warning: lines dealt (goal: no duplicate stop, ever, at 4P), where each Rat went in the first 10 s, stalls
     used (0–3), verdicts passed (goal ≥ 75% from day 5 at 4P, ≥ 50% solo).
   - Can a Rat hit Gary's cart from both bays on every leg? Any knockdown or softlock around a stalled Gary is a
     blocker.
   - Ask: did the stall read as a trick, not a role?
3. **Endless (#3).** Shifts to the Owner's Hustle and the statue (goal 1 and 6–9 at 4P), streak lengths, how often
   the crew beat yesterday (expect ~half), and whether the paint showed on the first endless morning. C's "one more
   shift" score is the verdict.
4. **The Lift (#4).** Riders during 'sky' (goal: ≥ 3 at 4P), seconds in 'sky' (≤ 60 s at 4P, ≤ 120 s solo), no
   crank prompt anywhere, no air run-outs. Any stall is a blocker.
5. **The deck (#5).** Falls a shift by cook style (careful 0–1, greedy ~2), and whether the second fall's line was
   noticed.
6. **The pace ladder.** 4P Last Bucket 140–170 min, solo ≤ 185 min; re-run `ladder.mjs`.
7. **Xbox Edge, low tier.** Frame p95 ≤ 20 ms at a Tiered bay winding up (disc only now), at the Lift with four riders,
   and at Gary's stand leg with a ball in the air.
8. **One text.** Screenshots at every Last Call, Gary stall, bell, the finale and an endless report. Never more than
   one centre element.
9. **Regression:** `node --test test/` green, `make preflight` green in WSL, 60 minutes with no console errors.

---

## 5. Who runs what

Three builders, starting **after the A-bug branch merges** (it owns `crew.mjs`, `nudge.mjs`, `nudge.js`, `rally.js`,
`round2.js`, `promopanel.js`, `sim.js` and `huddlerules.js` until then). About three evenings of agent work in total.

| Builder | Items, in order | Owns (only they edit) | Touches, after the owner merges |
| --- | --- | --- | --- |
| **1 · Tiered and the deck (leaf)** | #1 → #5 → #6.1 → #6.2 | `web/js/tiered.js`, `server/venues/tiered.mjs`, `web/js/views/tiered.js`, `web/js/aim.js`, `web/js/deck.js`, `server/venues/deck.mjs`, **`web/js/rally.js`** (#1's Tiered lines first) | `round2.js` (#6.2's line) after builder 3's #3; the `deckFall` feed text in `main.js` handed to builder 2 |
| **2 · Gary and the Lift (core-light)** | #2 → #4 | **`web/js/main.js`** (sole owner), `web/js/nudge.js`, `server/venues/nudge.mjs`, the Gary view, `server/venues/orbit.mjs`, `web/js/orbit.js`, `web/js/views/orbit.js`; **first lock on `server/crew.mjs`** (the ball loop's Gary branch, `stepGary` init) and `web/js/sim.js` (`GARY.STALL`, `GARY.STALLS`) | `rally.js` (`RALLY_LINES[5]`) after builder 1's #1 |
| **3 · Endless and the report** | #3 | `web/js/owner.js`, `web/js/views/owner.js`, `web/js/board.js`, **`web/js/round2.js`** | `server/crew.mjs` (`endShift` records, `depositOne`, the constructor's load-lift, snapshot `pace`) **after builder 2's #2 merges** |

**Order of merge:**
1. Builder 1's #1 and builder 2's #2 (no shared files; `rally.js` is builder 1's, `crew.mjs` builder 2's).
2. Builder 3's #3 (`crew.mjs` second), builder 1's #5 and #6.1, builder 2's #4 (`rally.js` venue-5 line).
3. Builder 1's #6.2 (`round2.js`, after #3).

**Every builder's done line:** `node --test test/` green, `make preflight` green (in WSL), `game-design.md` updated in
the same commit, and the scratchpad's `council8/` script for their item re-run against the real rule (not the
emulation), with its numbers in the commit message: `tiered3.mjs` for #1, `deck2.mjs` for #5, `sky.mjs` for #4,
`endless.mjs` for #3. #2 has no economy script; its commit message carries the dealt-lines and stall test results.
