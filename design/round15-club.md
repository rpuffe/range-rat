# Council round 13 — builder 2 ("club"): the Members' Tournament, Range landmarks, the inspector's place

Brief: `design/council-round13.md` items 1, 4 and 7a. All the numbers below come from `scripts/bots/calls.mjs` (builder
4's shared tally) and the `policy/*.mjs` hooks, at 4P unless marked. The bot runs used the `club4`, `club1`,
`stadium1` and `endless` presets.

## What I built

### 1 · The Members' Tournament
- **When.** From Club day 4 (`CLUB_DAY.tourney = 4`). Never on a boss day (a rematch keeps the day), never on Promotion
  Day, never in endless.
- **Two flights a shift.**
  - Flight 1 is at T-5:00 (shiftT 120).
  - Flight 2 is written at T-2:30 (shiftT 270), but Last Call rings at 270. It dodges 20 s early, so it really fires at
    shiftT 250 (T-2:50). `flightTimes` dodges any deal within 20 s: early first, late if early clashes too.
- **The balls.**
  - 2 a flight at 1–2P, 3 at 3–4P, 4 at 5–6P.
  - The land balls alternate left and right of centre, 60–140 m out. They keep 9 m clear of the creek, clear of the
    pond, the Rock and the Tractor, and 16 m from each other.
  - At 3P and up, the last ball of each flight drops in the pond.
  - The spots come from `hash32(day, venueDay, 'm', flight, j, k)`, so there is no RNG draw.
  - A ball comes in as a lofted drop from its tee's direction, aimed to come to rest on its spot. The test shows it
    rests within 2.5 m.
- **Picking one up.** A member's ball is `b.hands`: only a Rat can take it, never a helper, the cart, a drone or
  MOW-E's eat. `take()` puts it in the Rat's hands, outside the pocket, and its clock stops.
  - A diver who lifts the pond ball gets it moved from the dive bag into their hands.
  - A Rat who is knocked flat drops it back on the grass, on the clock again for at least 12 s.
- **Banking.** Reaching any return banks it for **×45 Ball Value**. The pay changed from the council's ×25; see the
  numbers below.
- **The caddie cart.** A ball still on the grass after 30 s is taken by the members' caddie cart: a `gone` event with
  `by: 'caddie'`, a kazoo, and a feed line. There is no penalty.
- **A clean flight** (every ball in the flight banked) fires once: the feed line "Clean flight! The members are
  appalled.", a chime, and a `ctx.dimples?.('doff')` hook for the Board.
- **The view** (`views/tourney.js`):
  - 3 people.js members at the covered bays nearest the clubhouse: navy blazers, one in the Site 13 jacket. They swing
    as each flight tees off.
  - A navy-and-gold banded beam over each ball, shrinking with its clock. It is one InstancedMesh, built once.
  - For the last 6 s of a ball's clock, a white caddie cart hums out from (44, 8), then drives home. Body and canopy are
    two InstancedMeshes.
  - The carry prompt reads "Member's ball ×N → a return".
- **Text.**
  - One centre ALERT a flight, through `ctx.say` (so it goes through `centre.js`): "Members' Tournament! Grab their
    balls first!" or "Second flight! Grab the members' balls!".
  - The Board line is `MEMBERS' TOURNAMENT · ●●○ · 0:22` (`tourneyLine`). Builder 4 wired it into `bvtext.js`.
  - On the first Tournament morning, the memo note is "Members' Tournament today. Site 13 entered anyway." It is set in
    the module's `startShift`, before the memo push, and only if the note slot is empty.
- **Calls.** The flight event carries `call: 'member', n`, so `calls.mjs` counts one call a ball.
- **MOW-E.** `crew.mods.signal('member', { id })` banks a member ball as MOW-E's. This is the hook for builder 1's
  aimed whistle.

### 4 · Range landmarks
- **The row.** `LANDMARK_ROW` in `landmarks.js`. Builder 4 lists it in `SHOP`.
- **The tiers.** One a venue, bought in order. Base prices are scaled ×2.2 at 4P.

| Tier | Base → 4P | What it does |
| --- | --- | --- |
| The Members' Bell | $15k → $33k | Ⓐ at the post rings a bonus flight, once a shift, T-6:00..T-1:30, never with a flight out (`tourney.mjs` `input`). At later venues it rings for the Stretch and the inspection, and at the bank. |
| The dimpl Tap Wall | $200k → $440k | Every third deck order pours itself. It is paid as an order, and no drink is added, so the deck never gets drunker from it (`deck.mjs` `tapWall`). |
| Stretch fireworks | $5M → $11M | The Stretch lights one more section: 3 at 1–2P, 4 at 3P+. Four sections is one whole side plus the other side's nearest. Each answer fires a rocket over its stand. All answered is a **GRAND SLAM**: +0.10 crowd, a volley, and `stats.grandSlams` (`stadium.mjs`). |
| Site 13's inspector | $20M → $44M | A second Inspection Hour at T-5:30: 45 s, ×4 in his patch. His figure wears the Site 13 jacket, and the Board label is `INSPECTOR (EX-SITE 13)` (`who`). The first morning after buying it, the memo note is "Site 13's inspector works for us now." |
| A star named Gary | $60M → $132M | GARY in a 5×7 dot font, as one `Points` draw, over the Lift. In endless it hangs over the glass case. |

- **The look** (`views/landmarks.js`). The bell (post and cup), the tap wall (panel and a cycling neon bar), the racks
  (one InstancedMesh), the sparks (one `Points`, 4 bursts of 40) and the star are all built once and shown by tier.

### 4b · Poach a Site 13 regular (endless)
- **The rules** are in `owner.js`: `POACH`, `POACH_ROW`, `poachPrice`, `poachTarget`, and `rivalBell(..., poached)`.
- **Buying it.** `crew.buyPoach`, the only new `buy()` shape. It costs 25 % of yesterday's bank, once a day. Bought
  overnight, it counts for tomorrow.
- **The day itself** runs in the new `server/venues/poach.mjs`:
  - their regulars hit from their own bay, worth +7 % of the day's customer balls. The shots come from their own
    `mulberry32`, so there is no crew RNG draw;
  - Site 13's live target drops 5 %;
  - the feed says "Site 13 lost a regular. To you.".
- **The week.**
  - A poached win counts 2 of the "4 of 7". Builder 4's records line passes the flag.
  - **The 4th win now clinches the week at once.** I added this: without it the acquisition can never land before the
    week's 7th day, so the council's "acquired by endless day 5" could not happen.
- **The shop.** `s.mods.poach.price` carries today's price (null once it's bought), and `renderShop` reads it. The row
  shows "🔒 Tomorrow" after a buy.

### 7a · The inspector's place
- **The words.**
  - `inspectWhere(x, z)` gives side by thirds of the field (±21 m) and depth from the mats (near is z ≥ -60), e.g.
    `NEAR MIDDLE`. (11.3, −42.2) maps to "NEAR MIDDLE".
  - The ALERT is `inspectAlertAt`: "Inspector at the far left Yard!".
  - The Board label is `INSPECTION · FAR LEFT · 0:45`.
- **The look** (`views/county.js`):
  - a white clipboard-beam over him that narrows as his visit runs out;
  - `ctx.chevron(x, z, 3)` (builder 4's edge chevron, wired into the views ctx);
  - at 1P, a 2 s camera ease of up to 15° toward him. It is added after `main.js` places the camera and never consumes
    the camera, so control stays with the player.

## The numbers

### Item 1: calls a minute (calls.mjs; the r8-definition column in brackets)

| Measure | Target | Result |
| --- | --- | --- |
| Club days 4+, 1P (`club4`, 5 seeds) | ≥ 1.0 | **1.34** (r8 1.20) |
| Club days 4+, 2P (3 seeds) | — | **1.38–1.57** (r8 1.24–1.43) |
| Club days 4+, 4P (`club4`, 5 seeds) | ≥ 1.5 | **1.60–1.65** (r8 1.48–1.57). Builder 4's baseline before the Tournament: 0.79. |
| Club days 4+, 4P (`club1` whole runs) | ≥ 1.5 | 1.52–1.64 |
| Whole Club, 1P (`club1`) | ≥ 1.0 | **1.14** (r8 0.98) |
| Whole Club, 4P (`club1`) | ≥ 1.3 | **1.19–1.26** (r8 1.00–1.05): **just under**, because days 1–3 are untouched |

### Item 1: money and length

| Measure | Target | Result |
| --- | --- | --- |
| Member balls banked, 4P, bot | 4–6 of 6 | **3 of 6** (2–5). The bot runs every free Rat at once and walks each ball home. A crew that splits does better. |
| Tournament share of a Tournament day's income, 4P | 15–25 % | ×25: 2–7 % (with the washer share uncounted). ×35: median 13 %. ×50: median 16 % (12–25 %). **I set ×45**: the final run measures a **4P median of 14.4 % (11–23 %)**, 1P 16 % (13–18 %) and 2P 13 %. A crew banking 5 of 6 lands at ~24 %. |
| Club length, 4P (`club1`, seeds 7 / 11 / 23) | ≤ round 8, never longer | TOURNEY=0: 5 / 4 / 7. TOURNEY=1: 5 / 4 / 6. **Equal or shorter.** |
| Club length, 1P | — | TOURNEY=0: 8 / 5 / 7. TOURNEY=1: 8 / 5 / 6. |
| TOURNEY=0 vs TOURNEY=1, day income (×45) | the ignorer loses ≥ 10 % | **1P: +15 %** (28.2k vs 32.6k). **4P: +1 %** (52.2k vs 52.6k): **not met.** The 4P bot's chase pulls all four Rats off their jobs. |

- **The seam goldens did not move.** `test/seam.test.mjs` passes 20 of 20, and Club days 1–3 make no draws.

### Item 4: the money table (late11.mjs, `stadium1` to endless day 6, seeds 7 / 11 / 23)

| Measure | Target | Result |
| --- | --- | --- |
| Shifts with nothing worth buying | 0 | **0** in every BUY=1 run, from the Club (`club1`) to endless day 6 |
| Club / Tiered length, BUY=1 vs BUY=0 | equal | 5/3, 4/3, 6/3 against 5/3, 4/3, 6/3. **Equal.** |
| Stadium / County / Orbital length, BUY=1 | ≤ +1 each | **2 / 2 / 2**, the same as BUY=0. This is the policy that keeps the fee. |
| The same, BUY=eager (buy at once from the Stadium) | — | Stadium 3–4 and County 2–3. That is +1 to +2, which is over the bar, so I don't recommend it. |
| Orbital last-bell cash, BUY=1 | ≤ $100M | **$70M / $72M / $84M.** With BUY=eager: $96–122M. |
| Statue by the endless day | 4–7 | Not reached in 6 endless days. The bot bought the Owner's Hustle; the 4P statue is $660M. |

### Item 4b: the poach (late11.mjs from the `endless` preset, 6 endless days, seeds 7 / 11 / 23 / 31 / 41 / 53)

| Measure | Target | Result |
| --- | --- | --- |
| Site 13 acquired, POACH=1 | ≥ 1 of 3 runs by endless day 5 | **6 of 6 runs.** 3 of them acquired twice inside 6 days. |
| Site 13 beat rate, POACH=0 | 45–65 % | The per-day race isn't changed. The clinch only ends a won week early. |

- **This may be too easy.** −5 % on the target plus +7 % balls is about a 12 % swing, and the bot poached every day. I
  logged it as an open issue.

### Browser (rr-play-b, solo, `?debug`)

| Check | Result |
| --- | --- |
| `club4` | Flight 1 at 5:00 and flight 2 at 2:50. The toast observer read "Second flight! Grab the members' balls!". There were two beams, and the caddie carts came out at the end of the clock. `__centre.overlaps` = 0. |
| `county1` | At 3:30 the toast read "Inspector at the near middle Yard!". The beam and patch were up, with the feed line under them. `__centre.overlaps` = 0. |

Shots:
- `design/shots/c13-club-flight2-beams.jpg`
- `design/shots/c13-club-caddie-carts.jpg`
- `design/shots/c13-club-inspector-beam.jpg`

I didn't take the 3-seat run (`seats.mjs`) or a shot of each landmark built.

## Files

**New:**
- `web/js/tourney.js`, `server/venues/tourney.mjs`, `web/js/views/tourney.js`
- `web/js/landmarks.js`, `web/js/views/landmarks.js`
- `server/venues/poach.mjs`
- `scripts/bots/policy/tourney.mjs`, `policy/landmarks.mjs` (BUY=1 keeps the fee; BUY=eager), `policy/poach.mjs`
- `test/tourney.test.mjs` (13 tests), `test/landmarks.test.mjs` (8)

**Edited (mine):**
- `web/js/clubdays.js` (`tourney: 4`)
- `server/venues/index.mjs` (+tourney, +poach)
- `server/venues/deck.mjs` (the tap wall)
- `web/js/stadium.js` (`stretchSections(..., extra)`, the four-section alert)
- `server/venues/stadium.mjs` (the fireworks, GRAND SLAM)
- `web/js/county.js` (`inspectWhere(x, z)`, `inspectAlertAt`, `WHERE`, `inspectHaz`)
- `server/venues/county.mjs` (the second inspection, `where`, `who`, the retainer memo, `toSave`)
- `web/js/views/county.js` (the beam, the Site 13 figure, the chevron, the 1P nudge)
- `web/js/owner.js` (`POACH`, the poach-aware and clinching `rivalBell`)
- `test/late11.test.mjs` (`where` now names the place, plus an inspectWhere test)
- `test/owner.test.mjs` (the poach blocks)
- `test/words.test.mjs` (the b2 block)
- `design/game-design.md` (a new section)

**Outside my list (small, flagged):**
- `server/crew.mjs`: the `buy()` poach branch and `buyPoach` (my region), and one import name.
- `web/js/views/index.js`: two lines.
- `web/js/views/souvreq.js`: `MAXLIT 3 → 4`.
- `web/js/main.js`: the coordinator asked for the shop renderer's poach price (2 lines plus the render key). I also
  added `chevron` to the views ctx (1 line).

## Hand-offs still open
- **b1 `sfx.js`:** `SFX.clap()` (the polite golf-clap) and `SFX.kazoo()`. The view falls back to `scoop` and
  `trombone`.
- **b1 / b4:** Gary's star bubble, `STAR_LINE` "A star. Named Gary. I'll allow it.", once after tier 5 is bought.
- **b3 `caserules.js`:** the plaque line `STAR_PLAQUE`.
- **b4 `board.js`:** `ctx.dimples('doff')` on a clean flight; the views ctx has no `dimples` yet, so it's a no-op.
- **b1 mower:** on a whistle strip that covers a `kind: 'member'` ball, call `crew.mods.signal('member', { id })`.
  `eatable()` already skips `b.hands`.

## Open issues
1. **TOURNEY=0 vs 1 at 4P is about even.** The cause is bot play: it banks 3 of 6 and pulls every Rat. Playtest round 9
   should check whether a real 4P crew splits the flight. ×45 is the knob.
2. **Whole-Club 4P calls are 1.19–1.26 against a 1.3 target.** Days 4+ clear 1.5, but days 1–3 are untouched.
3. **The poach may be too strong:** acquired in 6 of 6 runs, sometimes twice in 6 days. If playtest agrees, the clinch
   could need 4 real wins, or the cut could drop to 3 %.
4. **The pond ball's diver path is tested only by the code path.** Bots rarely get to it inside 30 s.
5. **The Members' Bell can't be loaded from a save** until the `LANDMARK_ROW` is in SHOP (it is now). The landmark tests
   set `crew.up.landmark` on the live crew.
6. **A shared-scratchpad slip.** I appended to and then restored another builder's `scratchpad/dbg2.mjs`, and I
   overwrote `scratchpad/dbg.mjs` and `t1.mjs` early on. My later files are in `scratchpad/b2/`.
