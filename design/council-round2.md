# Fun Council, round 2: Promotions, the PA, and the Last Bucket

This is the record of Range Rat's second Fun Council (November 2026). It keeps
round 1's format and the same five judges. Round 1
(`design/council-round1.md`) stays binding wherever this record doesn't
change it, and where the two disagree this one wins.

**What the owner set for this round (binding):**
- Everything still on the agreed list gets built tonight:
  - promotion and the venue ladder;
  - the Last Bucket ending and endless mode;
  - voice lines;
  - the CCTV overview camera;
  - gear grime;
  - the New Hire Kit;
  - a **ball washing station** that a Rat physically works (added mid-round).
- Ball types are already being built exactly as round 1 §4.7 placed them.
  They aren't re-litigated here, except to flag real problems (§1.2).
- No API keys or secrets tonight, and the CSP is same-origin.
- Up to three S-sized gap fillers for a satisfying first 60 minutes with four
  players.
- Plan the next phase: customer models and animations.

**The rule for agreed features (unchanged):** an agreed feature can't be
vetoed. The vote only decides the build order. Gap fillers can be vetoed.

---

## 1. Where the build stands

### 1.1 What's live on dev tonight

- Personal gear, with the shop open any time (Tab / D-pad up).
- Sprint (Shift / click R), which lasts longer with better shoes.
- BV = Rate × Upkeep, with three KPIs feeding Upkeep:
  - Curb Appeal (wash the sign, the stand and the mats);
  - Pond Clarity;
  - Fry Satisfaction.
- The cart's gear factor, and Hustle (+0.25 a ping, max ×2).
- The Board, with the silo and the float text.
- The memo, the quota, stamps and titles.
- Last Call with glow balls.
- Gary's walkthrough and the huddle.
- Pond diving with lead balls and Buddy Air.
- The potato line: snack shed, peeler, conveyor.
- Ball types (commit `b1e0a70`): square, gold, foam, splitter and bouncy,
  with `debut` events and `debuts` in the save.
- `venue` is already read from and written to the save, and
  `ballValue({venue})` already looks up `VENUES[venue].rate`.

### 1.2 Warnings about the current build

These are things the council found while reading `sim.js` and `crew.mjs`.

**Fix before the Club (they get worse ×5):**

1. **The quota can be bought.**
   - The target is fixed at the morning's Rate × (1 + q).
   - Because the shop is now open mid-shift, a crew that buys the electric
     washer at 3:00 raises Rate, and BV sails past the target.
   - **Fix:** judge the quota on Upkeep, not dollars: hit when
     `v.bv / v.rate ≥ 1 + q`. The Board's red line is drawn at
     `liveRate × (1 + q)`, so it moves with purchases.
   - Store `quota.q` and stop trusting `quota.target`.
   - Same file, three lines.
2. **Balls Outstanding is derived from totals.** The snapshot computes it as
   `BALLS_OUTSTANDING − totals.deposited − today`, so write-offs (§4.1) have
   nowhere to live.
   - **Fix:** add a saved `outstanding` field.
   - Migrate old saves as `BALLS_OUTSTANDING − totals.deposited`.
   - Decrement it in `bank()`.
3. **`title()` reads `stamps`.** Promotion spends stamps (§4.1), so titles
   would fall back to "Range Rat" the morning after a promotion.
   - **Fix:** the title comes from the venue (§4.1 table).
   - Lifetime stamps go in `totals.stamps`.

**Ball types (no re-litigating, just holes):**

4. **The splitter only splits for hands.**
   - `pickup()` spills two extra balls.
   - `cartPickup()`, the jackpot hoover, helpers and `pondPickup()` bank it
     as one ball of weight 1, so the split is lost.
   - **Fix:** in those paths, load 3 and add `w` 3. The cart can't spill at
     its own reels without the balls being re-scooped instantly, so the
     loaded count is the honest version.
5. **A gasp turns the bag into range balls.** `stepPond` re-sinks a gasping
   diver's bag as `sinkNew('range')`, so lead (×3) and gold (×10) balls come
   back as ×1.
   - **Fix:** keep a `bagKinds` list (it's at most 10 entries).

**Smaller things:**

6. **Gear is keyed by display name** (`gearByName`). Retype your name and
   you're a new hire; two Rats with the same name share gear. The New Hire
   Kit (§4.5) makes this mostly harmless. Note it and move on.
7. **`priceScale` counts players who left in the last 60 seconds**
   (`players.size` includes the grace window). It's a minute of ×2.2 prices
   after someone drops. Use `onlineCount()` for pricing.
8. **The docs have drifted:**
   - `game-design.md` still says stars and an overnight-only shop.
   - The README's "Next:" line is stale.
   - The README's controls table is missing sprint, the shop key and
     washing fixtures.

   Round 1's note 8 still stands: fix these in the same commit as the
   promotion.
9. **Peeling is hold-to-peel, not stick rotation** (round 1's Z3). That's
   fine for now. The ball washer's crank (§4.4) introduces the
   rotate-the-stick input. If it plays well, give the peeler the same input
   later.

---

## 2. The council

### 2.1 Agreed items on the ballot (order only, no vetoes)

| # | Item | Agreed by |
| --- | --- | --- |
| A | Promotion and the Club (with the crew vote) | owner |
| B | The ball washer station | owner (mid-round) |
| C | The Corporate PA (voice lines) | owner |
| D | Gear grime + Hose a Friend | owner (round 1 model) |
| E | New Hire Kit | owner, round 1 rider |
| F | CCTV overview | owner |
| G | Later venues, lean | owner |
| H | The Last Bucket + endless | owner |

### 2.2 Gap pitches: five pitchers, ten pitches

The same five personas as round 1. Each pitched two S-sized ideas for "the
first 60 minutes with four players."

**Incremental / idle designer**
- **I1 · Crew Records.** Best shift and best BV, kept in the save, with a
  record line on the report. The record-shift voice line needs this anyway.
- **I2 · The Next Goal strip.** A permanent line on the Board:
  `STAMPS ●●○ · CLUB FEE $5,500`.

**Co-op chaos designer**
- **C1 · Ready Up.** At the report, the next shift starts when every online
  Rat is ready, or 20 s after the first one. Today any one Rat can start
  the day while the other three are still reading.
- **C2 · Two-handed crank.** The ball washer has a handle on each side, and
  two Rats can crank together.

**Cozy job-sim designer**
- **Z1 · The Lost and Found shelf.** Junk from the pond on a shelf by the
  stand.
- **Z2 · Employee of the Shift.** Each Rat's own line in the report, plus one
  absurd award each.

**Comedy / absurdist writer**
- **W1 · Dimples on the Range** (round 1's W2, back again).
- **W2 · The franchise agreement.** Promotion needs every online Rat to sign.
  "Sign here, here and here."

**Live-ops / retention designer**
- **L1 · Personal Ledger.** The same idea as Z2.
- **L2 · Session bookmark.** The report says "Club in 1 stamp" so a crew
  quitting knows where they'll pick up.

### 2.3 Merging

- **Into the promotion spec (agreed, not on the ballot):**
  - I2 The Next Goal strip and L2 Session bookmark. Promotion isn't legible
    without them.
  - W2 The franchise agreement. It is the crew vote.
- **Into the ball washer:** C2 Two-handed crank.
- **Merged together:** Z2 Employee of the Shift and L1 Personal Ledger.

That leaves five gap items on the ballot: Crew Records, Ready Up, Employee
of the Shift (+ Ledger), the Lost and Found shelf, and Dimples on the Range.

### 2.4 Judging

| Judge | Lens |
| --- | --- |
| **Fun Expert (chair)** (F) | Moment-to-moment fun, and the pacing of the incremental curve |
| Technical Director (T) | Buildable *well* tonight: Three.js, server-authoritative, zero npm dependencies |
| Player Advocate (P) | Clarity on a TV with an Xbox pad, the first session, readability with 4 players |
| Story Keeper (S) | Does it serve the Range Rats, Corporate and the ball-value story? |
| Co-op Advocate (C) | Does it create moments between players, and give 4 people a reason to split up and regroup? |

**Scores (1–5):**

| # | Item | F | T | P | S | C | Sum |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | Promotion and the Club | 5 | 3 | 4 | 5 | 5 | **22** |
| B | The ball washer station | 5 | 4 | 4 | 4 | 4 | 21 |
| C | The Corporate PA | 4 | 5 | 4 | 5 | 3 | 21 |
| D | Gear grime + Hose a Friend | 3 | 4 | 3 | 3 | 5 | 18 |
| E | New Hire Kit | 2 | 5 | 5 | 3 | 4 | 19 |
| F | CCTV overview | 3 | 4 | 3 | 4 | 4 | 18 |
| G | Later venues, lean | 4 | 3 | 3 | 5 | 3 | 18 |
| H | The Last Bucket + endless | 5 | 3 | 4 | 5 | 4 | 21 |
| 1 | Crew Records | 3 | 5 | 4 | 3 | 3 | 18 |
| 2 | Ready Up | 3 | 5 | 5 | 2 | 5 | 20 |
| 3 | Employee of the Shift + Ledger | 4 | 5 | 4 | 4 | 3 | 20 |
| 4 | Lost and Found shelf | 2 | 4 | 2 | 4 | 2 | 14 |
| 5 | Dimples on the Range | 3 | 3 | 3 | 5 | 3 | 17 |

### 2.5 Picks and vetoes

**Fun Expert (chair).**
1. **Promotion.** The ×5 morning is the biggest feeling in an incremental:
   the whole Muni shop becomes pocket change, and the crew goes on a spree.
2. **The ball washer.** A crank that pays out a ding per ball is a slot
   machine you build yourself.
3. **The Last Bucket.**
4. **The PA.**
5. **Employee of the Shift.**

*Veto:* **Lost and Found shelf.** Cosmetic, and nobody looks at a shelf
mid-shift.

**Technical Director.**
1. **The PA.** One table and one module, and it hooks onto events that
   already exist (`debut`, `verdict`, `ping`).
2. **New Hire Kit.** Five lines.
3. **Ready Up.** It shares the vote code with the franchise agreement.
4. **Promotion.**
5. **Crew Records.**

*Warnings:*
- The Last Bucket is only testable with a dev venue override. Ship
  `DEV_VENUE=5` with it.
- The second cart is an M refactor (`this.cart` is singular in about 20
  places), so it doesn't go with CCTV tonight (§4.6).

*Veto:* **Dimples on the Range.** A wandering NPC with its own hit rules and
an HR memo is a second Gary. One Gary.

**Player Advocate.**
1. **Promotion.** It needs the Next Goal strip, or the stamps mean nothing
   from the sofa.
2. **Ready Up.** A four-player crew on a TV must not lose the report to the
   fastest thumb.
3. **New Hire Kit.**
4. **The ball washer.** One verb, one place, an obvious payout.
5. **The PA**, but only with captions. Every line has to read with the
   sound off.

*Veto:* none.

**Story Keeper.**
1. **The Last Bucket.** It is the story's punchline.
2. **Promotion.** Titles change. The work doesn't.
3. **The PA.** Corporate finally has a voice, and it's a text-to-speech
   robot.
4. **Later venues, lean.**
5. **Employee of the Shift.** Corporate's awards are its best jokes.

*Veto:* none.

**Co-op Advocate.**
1. **Promotion.** Everyone signs, and everyone sees the reveal together.
2. **Gear grime.** Hose a Friend finally has a reason.
3. **Ready Up.**
4. **The ball washer.** One Rat cranks while three feed it.
5. **CCTV.** One Rat on the monitors calling out piles is a real job.

*Veto:* none.

### 2.6 Tally

Rank points are 5 for 1st down to 1 for 5th. Agreed items can't be vetoed.

| Item | Picked by | Rank pts | Score sum | Vetoed by |
| --- | --- | --- | --- | --- |
| **Promotion and the Club** | F, T, P, S, C | **21** | 22 | — (agreed) |
| **The PA** | F, T, P, S | **11** | 21 | — (agreed) |
| **Ready Up** | T, P, C | **10** | 20 | — |
| **The ball washer** | F, P, C | 8 | 21 | — (agreed) |
| **The Last Bucket** | F, S | 8 | 21 | — (agreed) |
| **New Hire Kit** | T, P | 7 | 19 | — (agreed) |
| Gear grime + Hose a Friend | C | 4 | 18 | — (agreed) |
| **Employee of the Shift + Ledger** | F, S | 2 | 20 | — |
| Later venues, lean | S | 2 | 18 | — (agreed) |
| **Crew Records** | T | 1 | 18 | — |
| CCTV overview | C | 1 | 18 | — (agreed) |
| Lost and Found shelf | — | 0 | 14 | F |
| Dimples on the Range | — | 0 | 17 | T |

**The washer–Last Bucket tie** is level on rank points (8) and on score sum
(21). It breaks on the chair's ballot, which ranks the washer 2nd and the
Last Bucket 3rd.

**Gap fillers adopted:**
- Ready Up (10 points);
- Employee of the Shift + Ledger (2 points, score sum 20);
- Crew Records (1 point, but the record-shift voice line needs it, and it's
  XS).

**Gap fillers out:** the Lost and Found shelf and Dimples on the Range, one
veto each.

### 2.7 Decision: tonight's build order

The vote sets priority. The build order then bends to dependencies:
- the fixes come first;
- the PA comes before anything that speaks;
- the vote code comes with Promotion, and Ready Up reuses it.

Sizes as in round 1: **XS** is under an hour, **S** is an evening, **M** is one or two sessions.

| # | Item | Size | Why here |
| --- | --- | --- | --- |
| 0 | Pre-promotion fixes (§1.2 items 1–3, 4–5 if time) | XS | Promotion multiplies every bug by 5 |
| 1 | **The Corporate PA** (§4.3) | S | Everything after this speaks |
| 2 | **Promotion and the Club** (§4.1) | M | Top of the vote; the 60-minute session's climax |
| 3 | **The ball washer station** (§4.4) | M | Wins the tie with the Last Bucket; it changes the bank flow, so land it before the economy is tuned |
| 4 | **New Hire Kit** (§4.5) | XS | Five lines |
| 5 | **Ready Up** (§5.1) | XS | Reuses the vote from #2 |
| 6 | **Gear grime + Hose a Friend** (§4.7) | S | Needs the wand raycast that already exists |
| 7 | **Employee of the Shift + Ledger** (§5.2) | S | Report-only |
| 8 | **Crew Records** (§5.3) | XS | Feeds the record-shift voice line |
| 9 | **CCTV overview** (§4.6) | S | Unlocked by the Club, so it lands after #2 |
| 10 | **Later venues, reveal-only** (§4.2) | S | Rate, reveal, write-off, a COMING SOON dial |
| 11 | **The Last Bucket + endless** (§4.8) | M | Not reachable in play for about 3 hours, so it ships last, behind `DEV_VENUE=5` |

**If the night runs short, cut from the bottom.** Items 0–5 alone make the
first 60 minutes complete.

---

## 3. Story additions

**Corporate gets a voice: the PA.**
- Fairway Holdings has installed a public-address system at every site.
- It speaks in a flat text-to-speech voice, after a three-tone chime.
- It is never mean, and it never says more than two sentences.
- The robot voice is the joke, not a compromise. When a recorded set
  arrives (§4.3), it plays the same character.

**Venue titles.** Titles change. The work doesn't.

| Venue | The Rats' title |
| --- | --- |
| Muni Range | Range Rat (Range Rat II at 3 stamps) |
| Range Club | Club Retrieval Associate |
| Tiered Entertainment Range | Experiential Retrieval Lead |
| Stadium Range | Retrieval Athlete |
| County Range | County Ball Commissioner |
| Orbital Range | Orbital Retrieval Officer |
| Under New Management (endless) | Owner (all of them) |

**The franchise agreement.** Promotion isn't a purchase, it's a contract,
and every Rat on shift signs it. Corporate needs it in triplicate, or in
quadruplicate for a crew of four.

---

## 4. The agreed items, specced

### 4.1 Promotion and the Club · M

#### What "Request Promotion" does tonight

**The row.**
- It's a new row at the top of the shop, `promote`. It's a crew item, but it
  isn't in `SHOP`: it has its own handler.
- It shows from day 2, so the goal is visible early.

**What it says:**

| State | Row text |
| --- | --- |
| Short of stamps | `Request Promotion: Range Club · stamps ●●○ · fee $5,500` (greyed) |
| 3 stamps, not enough cash | `… fee $5,500 · you have $4,210` (greyed) |
| Ready, mid-shift | `Ready: sign at the end of the shift` (greyed: a promotion never happens mid-shift, see §1.2 item 1) |
| Ready, at the report | **`Sign the franchise agreement (1 of 4 signed)`** |

**Requirements:**
- 3 review stamps earned at this venue;
- the franchise fee, which is a crew price (× `priceScale(online)`);
- `phase === 'report'`.

**The franchise agreement (the crew vote).**
- Each online Rat presses Ⓐ on the row to sign, and presses again to
  unsign.
- Signatures show as names on the row and as a ✍ by each name in the
  roster.
- When every online Rat has signed, the server checks the stamps and the
  fee, then executes the promotion.
- Solo, it's one press.
- A Rat who goes offline is dropped from the count, so they can't block it.

**Executing it** (`promote()` in `crew.mjs`, in the report phase):
1. Take the fee from the wallet: `cash −= fee`.
2. Set `stamps = 0` and add the stamps to `totals.stamps`.
3. Do the venue's bookkeeping:
   - `venue++`;
   - `venueDay = 0`;
   - `outstanding −= WRITE_OFF[venue]`;
   - `pendingReveal = venue`.
4. Apply the venue's free grant. For the Club: if `up.shed` is 0, set it to
   1. The members expect fries, so the shed reopens on Corporate.
5. Save immediately.
6. Emit `{t:'promoted', venue, fee, writeOff}`.

The report card then stamps **PROMOTED** in red over the review stamps.

**The reveal (the next morning).**
- `startShift()` sees `pendingReveal` and emits `{t:'reveal', venue}`.
- It holds the clock for 6 s: `revealT = 6`. While that's above 0,
  `shiftT` doesn't advance and the mats don't fire.
- The client plays a scripted 6 s sequence. It's skippable with Ⓐ, and the
  input is locked otherwise.

| t | What happens |
| --- | --- |
| 0.0 s | The PA chime plays. The camera lerps from the player's eye to a fixed shot of the sign and the stand from (20, 6, 22). |
| 1.0 s | The sign flips, split-flap style: `MUNI RANGE` becomes `RANGE CLUB · Members & Guests`. |
| 2.0 s | The Board's Rate digits flip $1 → $5 (or $3 → $15 with the electric washer). BV flips with them. |
| 3.0 s | **Balls Outstanding** rolls down by the write-off. The memo card reads: *"1,200,000,000 balls have been reclassified as members' property."* |
| 3.5 s | The voice line plays (§6), captioned. |
| 6.0 s | The camera returns, the clock starts, and the toast reads: *"Day 7 · Range Club · you are a Club Retrieval Associate."* |

**What changes at the Club, visibly:**
- The sign texture becomes *RANGE CLUB · a Fairway Holdings property ·
  Members & Guests*.
- A long green awning goes over the mat line: one box roof on 6 posts
  (`covered bays`). White dividers go between the mats.
- The shed gets a sign reading **KITCHEN** (the same shed, a new board).
- Two club flags go on the stand.
- The capsule customers get polo colours: a fixed pastel palette instead of
  the HSL rainbow.
- The Board's header reads *RANGE CLUB · SITE 12*.

**What changes at the Club, mechanically:**

| Change | Value |
| --- | --- |
| Venue rate | $1 → **$5** (`VENUES[1].rate`, already in `sim.js`) |
| Fry Satisfaction | Always on: the shed is granted free if it wasn't bought |
| Members eat more | `FRIES.EAT_EVERY` 8 → **5** swings per basket |
| Bouncy balls | On (already gated on `venue ≥ 1` in `pickKind`) |
| Gary | Adds a **kitchen** stop at the shed before the stand: it passes with fries stock ≥ 50% |
| Quota | Restarts on the venue schedule (below) |
| CCTV | Installed free (§4.6) |
| New shop row | **Club amenities** (below), plus the industrial ball washer tier (§4.4) |

**The Club amenities row** (a crew item, × `priceScale`; it shows only at
venue ≥ 1):

| Tier | Solo price | What it does |
| --- | --- | --- |
| Turbo nozzle | $3,000 | Wand cleaning ×2, reach 7 → 9 m. *"Corporate approved this nozzle after a brief incident."* |
| Covered bays | $8,000 | Mats take no morning mud, and swing scuffs are halved. *"The members do not like to see dirt. Or you."* |

**What's kept and what resets.** This is not a prestige reset: the Player
Advocate's round-1 veto of Franchise Pins stands.

| Kept | Reset or spent |
| --- | --- |
| Cash, minus the fee | Stamps (spent; lifetime count kept in `totals.stamps`) |
| Every upgrade, all personal gear, helpers, the cart | The quota schedule (restarts at venue day 1) |
| Commendations (Gary keeps notes) | Balls Outstanding (written down) |
| Pond sunk balls, fries stock, debuts, totals, the day counter | The title (it becomes the venue's) |

**The venue quota schedule.**
- At the Muni, the quota stays exactly as built: `quotaQ(day, ceiling)`.
- At venue 1 and up, q is a share of the headroom:
  `q = (ceiling − 1) × f`. f by venue day is 0.45, 0.50, 0.55, 0.60, then
  +0.025 a day, up to 0.80.
- At the Club the ceiling is ×2.5 (Curb, Pond and Fries all on), so day 1
  asks for Upkeep ≥ ×1.675. A crew that kept the Muni tidy hits that.
- New field: `venueDay`, saved.

**Franchise fees** (solo, × `priceScale`). These are tuning targets: about 3
shifts of solo income at the venue before.

| To | Fee | Stamps | Write-off | Write-off memo |
| --- | --- | --- | --- | --- |
| Range Club | $2,500 | 3 | 1,200,000,000 | "…reclassified as members' property." |
| Tiered Entertainment Range | $40,000 | 3 | 1,500,000,000 | "…reclassified as *experiential*." |
| Stadium Range | $200,000 | 3 | 800,000,000 | "…sold to fans as souvenirs." |
| County Range | $1,000,000 | 3 | 712,000,000 | "…reclassified as the county." |
| Orbital Range | $5,000,000 | 3 | everything but 1,958 | "Earth has been fully retrieved. 1,958 balls remain. They are all in orbit." |

The Orbital write-off sets `outstanding = 1958` exactly, whatever was left.
1,958 is the year Ball No. 1 was hit.

**The Next Goal strip.** The Board's bottom line, from day 2:
- `NEXT: RANGE CLUB · STAMPS ●●○ · FEE $5,500`;
- once the crew qualifies: `PROMOTION READY · SIGN AT THE BELL`.

The report ends with the session bookmark: *"Range Club: 1 stamp to go."*

**Server data:**
- **State:**
  - `venue`, `venueDay` and `outstanding`;
  - `signed: Set<playerId>`, cleared when the phase changes;
  - `pendingReveal`;
  - `revealT`.
- **Save:**
  - `venue` (already saved);
  - `venueDay`, `outstanding` and `pendingReveal`;
  - `totals.stamps`.
- **Input:** `{t:'sign', on}`.
- **Events:**
  - `{t:'sign', by, on, n, of}`;
  - `{t:'promoted', venue, fee, writeOff}`;
  - `{t:'reveal', venue}`;
  - `{t:'pa', id:'club'}`.
- **Snapshot:**
  - `venue` and `venueDay`;
  - `promo: {next, fee, stamps, need, ready, signed: [ids]}`;
  - `outstanding` (now stored).
- **Shared:** `VENUE_RULES[venue]` in `sim.js`, holding `fee`, `writeOff`,
  `title`, `eatEvery`, `garyStops`, `grant` and `rowId`. Everything above
  reads from that one table.

**Client:**
- the sign's canvas texture redrawn per venue (`paintSign(venue)`);
- the awning, dividers, kitchen board and flags, built hidden at load and
  shown at `venue ≥ 1`;
- the reveal camera, as a lerp between two fixed poses;
- the Board's split-flap on the sign.

**Playtest check:**
- In a 4-player session, the promotion lands between minutes 40 and 50.
- All four sign within 20 s of the button lighting up, and at least one
  player reads the fee out loud before signing.
- The morning after, the crew buys at least three things inside the first
  minute (the spree).
- Nobody asks "what changed?": the reveal answered it.

### 4.2 The later venues

**The pattern.** Each later venue adds the same seven things:
1. a rate jump;
2. one new KPI dial (+0.5 on the Upkeep ceiling) with one chore;
3. one toy (a shop row whose first tier automates the new chore);
4. a re-dress;
5. a write-off;
6. a title;
7. a voice line.

What's kept and what resets is identical to the Club. The whole ladder is
the same map, re-dressed: Site 12 is promoted, not abandoned. Nobody has to
learn a new range, and a 4-player crew never splits across scenes.

#### The lean but real version of each tier

| Venue | Rate | New KPI (dial) | Its chore | Toy (shop row) | Re-dress |
| --- | --- | --- | --- | --- | --- |
| **Tiered Entertainment Range** | $25 | **Bay Utilization**: time-averaged share of open mats with a customer swinging. Needs real customers (§7). | Keep mats clean (customers refuse filthy mats), keep fries up, and keep the queue fed | **Second picker cart** $60k, then **ball return gutters** $150k (the mats never wait for a customer) | Second deck: a raised platform behind the mats with 10 more bays, neon trim on the awning, three coloured target greens at 60, 100 and 140 m |
| **Stadium Range** | $100 | **Crowd Sentiment**: decays 1%/s toward 30%. +15% per PING, +25% per jackpot, +10% per gold ball banked, +5% per knockdown (*"Corporate notes the crowd enjoys this"*), +20% for a passed Gary inspection | Entertain: Hit the Cart becomes a KPI job, not just Hustle | **T-shirt cannon** $300k (+1% sentiment a second while staffed at a crew bay), then **third cart** $600k | Grandstands down both sides with an instanced crowd that bobs and stands up on a PING; the Board scaled ×3 on a tower (the jumbotron) |
| **County Range** | $500 | **Zoning Compliance**: `1 − strays/30`, the pond formula again | Customers hit 40% harder with more spray, so about 10% of balls land in **residential strips** past the fence lines (\|x\| > 120 or z < −260). Walk out and fetch them; vehicles aren't allowed in residential | **Drones** $1.5M: helper code with flight, ×3 speed, never knocked down, strays first | Picket fences and mailboxes along the strips, a COUNTY LINE sign, FHI flags on everything |
| **Orbital Range** | $2,500 | **Orbital Debris**: `1 − debris/30`. Debris is balls in a ring around the elevator platform | **EVA**: the pond's dive code, re-skinned. Step into the elevator car at the stand, and the view goes to black sky, stars and an Earth glow below. Air becomes oxygen, and Buddy Air becomes a crewmate on the winch | **Orbital net** $8M (EVA bag 10 → 40), then **orbital vacuum** $20M | A space elevator (a cylinder into the sky) beside the stand, the sky.js night palette all day, and the Board reading in kilometres |

**Each tier in a 4-player session:**
- **Tiered.** The second cart means two drivers and two Rats pinging.
  That's the fleet the CCTV was built for, so the "First fleet" voice line
  fires here.
- **Stadium.** It hands the "show-off" player a KPI.
- **County.** It sends one Rat on long walks, the way the pond takes a diver.
- **Orbital.** It's diving again, which the crew already knows how to
  share.

Each tier has one job that pulls one person away. That's the round-1 shape:
split up, then regroup at the stand.

**Ceilings:** Muni and Club ×2.5, Tiered ×3.0, Stadium ×3.5, County ×4.0,
Orbital ×4.5. That's round 1's curve.

#### Scoped down tonight: reveal-only tiers (item 10, S)

Each tier gets:
- its row in `VENUE_RULES` (fee, write-off, title);
- the rate;
- the reveal, reusing the Club's sequence with the new sign text and the
  new line;
- its re-dress, as one or two primitive groups only:
  - Tiered: the raised deck box and neon strips;
  - Stadium: two grandstand boxes and the tall Board;
  - County: fence lines;
  - Orbital: the elevator cylinder and the night sky;
- its new KPI on the Board as a dark dial reading **COMING SOON —
  Corporate**. A locked KPI counts 0, which the round-1 Board already
  supports.

The ceiling only grows as the dials light up, so the quota stays fair (it
reads the unlocked ceiling). The toys and the KPI logic are the next
session's work. Build Bay Utilization only after the customer phase.

**Playtest check (reveal-only):** with `DEV_VENUE=n` for each n, the reveal
plays, the Rate is right, the dial is dark, and the quota is hittable on
venue day 1.

### 4.3 The Corporate PA (voice lines) · S

**Decision: a synthesized PA chime, an on-screen caption, and the browser's
`speechSynthesis`**, with a slot for a recorded set later.

**Why this one:**
- **It works tonight with no key and no network**:
  - the chime is Web Audio, which `sfx.js` already does;
  - the captions are DOM;
  - `speechSynthesis` uses the OS's voices, and the page CSP doesn't govern
    it.
- **The robot is the character.** A flat, slightly wrong TTS voice *is*
  Corporate. Recorded clips would sound like a person, and Corporate isn't
  one.
- **The captions carry it when TTS can't**:
  - when a device has no voices (some Xbox builds return an empty
    `getVoices()`);
  - when the player is muted;
  - on a TV with the sound low.

  The Player Advocate's rule is that every line must work as text alone.
- **The ElevenLabs set drops in later without code changes.** The CSP's
  `default-src 'self'` already allows same-origin audio.
  - Files go in `web/audio/pa/<id>.mp3`, listed in
    `web/audio/pa/index.json`.
  - When a line's id is listed, the client plays the file instead of TTS.
  - Generate the files offline and commit them. Never fetch them from a
    third party at runtime.

**How it sounds:**
1. A 60 ms bandpass mic-click.
2. A three-tone chime (G5, E5, C5, 180 ms each, triangle wave, through a
   short feedback delay so it rings like a tannoy).
3. The line: `rate 0.92, pitch 0.85, volume 0.9`.
4. A closing mic-click.

The SFX bus ducks to 40% while the voice speaks.

**Voice pick:**
- First, an English `localService` voice whose name matches
  `/David|Mark|George|Daniel|Guy|Alex/`.
- Failing that, any English local voice, then any English voice.
- With no voices after `voiceschanged` plus 1 s, it's captions only.

**Caption:**
- Top-centre, with the Dimples seal on the left.
- Text at 4.5vh (TV-readable), in quotes.
- It stays up for `max(3 s, 0.38 s × words + 1 s)`.

**Rules:**
- **The server picks the moment and the client speaks it.**
  - The server sends `{t:'pa', id}`, and every client speaks the same line
    at the same moment.
  - The text lives in one table, `PA_LINES` in `sim.js`, so ids are all
    that crosses the wire.
- **Rarity:**
  - "Once" lines are kept in a saved set, `voiced`.
  - "Repeatable" lines have their own throttle (below).
  - At most **3 PA lines per shift**, not counting venue reveals and the
    ending.
  - At least **20 s between lines**. A line that would land inside the gap
    is dropped, not queued, unless it's a venue or ending line.
- **Settings:** the pause menu gets *Corporate PA: Voice + captions /
  Captions only*, stored in localStorage behind a try/catch.
- **Chrome and Edge quirks:**
  - Call `speechSynthesis.cancel()` before each `speak()`.
  - Lines stay under 15 s, because long utterances get cut off.
  - Speak only after the first user gesture, which `SFX.unlock()` already
    waits for.

The script is in §6.

**Server data:**
- **State:** `voiced: Set` (saved), `paShift` (a count) and `paAt` (a
  timestamp).
- **Helper:** `this.pa(id)` applies the rules and pushes `{t:'pa', id}`.

**Client:** `web/js/pa.js`, with `say(id)`, the voice pick, the caption
element and the duck.

**Playtest check:**
- Sound off, a new player can repeat the gist of the last PA line.
- Sound on, at least one player laughs at the first line.
- Over a full 7-minute shift, no player can name more than 3 lines from it.
  If they can, the throttle is wrong.

### 4.4 The ball washer station · M

**The decision: banked balls pay the muddy price now, and the washer pays the
rest as you wash them.**

**The math:**
- Rate stays `venue rate × (1 + washer tier) × (1 + 0.05 × commendations)`.
- BV on the Board doesn't change.
- The quota doesn't change.
- What changes is **when** the washer's share arrives.

**At the bank**, for any deposit (by hand, by a helper or by the cart):
1. Work out the full pay exactly as today: `P = payFor(w, v, gear)`.
2. With washer tier 0, pay `P` and you're done (no machine, no change).
3. Otherwise, pay `now = P / k.price` (the muddy price) immediately.
4. Add the rest, `P − now`, to the hopper's **credit**:
   - `hopper.n += n`;
   - `hopper.credit += P − now`.
5. The balls go into the hopper as dirty balls.

**Washing x balls** pays `credit × x / hopper.n`, then takes x off the count
and the same amount off the credit.

**At the bell,** the night crew washes **half** of whatever's left, at half
pay. The rest is trucked away dirty and its credit is lost. The report shows
*"Left unwashed: 38 balls · $76 of premium."*

This is exactly the old pay when every ball is washed. Hustle and Gear are
locked in when you bank, so washing later can't be gamed.

**Why this option and not the supply chain:**
- **The money is right there.** Every crank turn is a ding and a coin, and
  the float over the deposit says *"+$8 now · +$16 waiting in the washer."*
  That line is the tutorial.
- **It doesn't depend on unbuilt work.** The supply chain ("washing tops up
  the bucket stand for customers") needs the customer phase. It's adopted as
  phase 2 in §7.3: washed balls become the stand's bucket stock.
- **The cost is honest.** The washer used to be a passive buy, and now part
  of it is a job. That bends round 1's "chores only raise pay" rule a little,
  but never below the no-washer price. The electric tier makes most of it
  passive again.

**The station.**
- Where: `WASHER = {x: 21.5, z: 6, REACH: 1.8}` in `sim.js`. That's 4.5 m
  left of the stand, clear of crew bay 1 at (23, 0) and the wash pad at
  (36, 3).
- What it is: the classic range pedestal washer. A green FHI post with a
  box top, a brush drum, a crank handle **on each side**, a funnel hopper of
  dirty balls on top, and a clear chute running down to the stand's bucket.
- It's called the *ball washer* everywhere in the UI. The wand station
  stays the *pressure washer*, so the two never collide in a prompt.

**Cranking, the minigame.**
- **Stand at a handle and hold Ⓐ.** This engages the crank: the view
  locks, and the right stick now turns the handle.
  - Rotate the stick in circles (either direction): 1 ball per turn, up to
    **2.5 turns a second**.
  - Hold Ⓐ without rotating: a slow crank at 1 ball a second. That's the
    accessibility path, and the same hold the peeler uses.
- **Mouse:** hold left click and circle the mouse.
  - Accumulate a virtual point from the pointer-lock `movementX/Y`, clamped
    to a 60 px radius.
  - Count the change in its angle as turns.
- **Keyboard or touch:** hold to slow crank.
- **Two handles:**
  - Two Rats can crank at once, and the throughput adds up.
  - Each handle is claimed by whoever is nearest it and holding Ⓐ.
  - That's C2, the two-handed crank: four players can make it a moment.
- **The feel:**
  - a ratchet tick every quarter turn;
  - a *clunk* and a coin chime for each ball that drops;
  - a ball rolling down the chute into the stand's bucket;
  - suds puffing at the drum;
  - a floating "+$X" every 5 balls (batched, so it doesn't spam);
  - the handle visibly spinning at the cranker's speed for everyone;
  - a short rumble every 10 balls (`vibrationActuator`, guarded).

**The shop tiers** (the existing `washer` item, re-described; the Rate math
is unchanged):

| Tier | Solo price | Rate factor | Washing |
| --- | --- | --- | --- |
| No washer | — | ×1 | No hopper: banking pays everything, as today |
| **Hand-crank washer** | $40 | ×2 | By hand only: 2.5 a second per cranker |
| **Electric washer** | $160 | ×3 | Washes **1 ball a second on its own**, all shift, and cranking adds 2.5 a second per cranker on top ("turbo") |
| **Industrial ball wash** (venue ≥ 1) | $6,000 | ×3 (unchanged) | **5 balls a second on its own.** Throughput only, so the Rate math stays put. *"A ball car wash. It has a name. The name is Brent."* |

The industrial tier is new, and it's a third tier on the existing item. It's
hidden until the Club, so the Muni ladder looks the same as today.

**Solo vs 4 players:**
- **Solo.** A Rat banks about 85–420 balls a shift.
  - With the hand crank (days 2–3), that's 30–60 s of cranking a shift: a
    ritual on the way back from banking.
  - The electric washer washes about 420 balls a shift on its own, which
    covers a solo player almost entirely.
- **Four players.** The crew banks about 900 balls a shift. The electric
  washer covers about 420 of those, so someone has to crank for 3–4
  minutes, or the crew loses the premium on the rest.
  - That's a real station for one Rat, and the crank becomes the job that
    one person takes.
  - At Last Call, the crew splits three ways: glow balls, the quota, and a
    full hopper.
  - The industrial tier at the Club buys that job out, which is pillar 3:
    monotonous, then automated.
- **The cart.** A cart unload of 300 balls lands in the hopper all at once.
  That's the big moment for two cranks.

**Server data:**
- **Shared (`sim.js`):** `WASHER`, `washerPerks(tier)` returning
  `{auto: balls/s, crank: 2.5}`, and `CRANK_MAX = 2.5`.
- **State:** `hopper = {n, credit}` and `crankers = {L: id|null, R: id|null}`.
  The hopper isn't saved, because the bell always empties it.
- **Input:** `{t:'crank', side, turns}`, every 250 ms.
  - The server clamps it to `CRANK_MAX × dt` per player.
  - It counts only if the player is within reach of that handle.
  - Fractional balls carry over.
- **Events**, batched every 0.5 s:
  - `{t:'washed', n, cash, by}`;
  - `{t:'hopper', n}` when the count changes by 10 or more.
  - `cash` events gain `credit` (the deferred part).
- **Snapshot:** `washer: {n, credit, auto, L, R, rateL, rateR}`.
- **Report:** `washed`, `unwashed` and `lostPremium`.

**Client:**
- **The machine:** a post, the box, the drum and two handles that rotate
  by turns.
- **The hopper heap:** an `InstancedMesh` of brown balls. Up to 80 are
  visible, and the heap's height grows with n.
- **The chute:** 10 pooled white balls animated along a curve, one per
  washed ball.
- **Effects:** suds particles, and the crank SFX made from `sfx.js`'s
  `burst` and `tone`.
- **The Board:** a line reading `UNWASHED 142 · $284`, which turns amber
  above 100.

**Playtest check:**
- Solo with the hand crank, a first-time player cranks within their first
  shift after buying it, without being told. The "+$16 waiting" float
  should do it.
- 10 s of fast cranking gives about 25 dings, and the player says it felt
  good, or like a slot machine.
- In a 4-player session with the electric washer, someone cranks while
  another Rat banks on at least half of shifts, and two Rats crank together
  at least once in the session.
- On days 3–6 at four players, balls unwashed at the bell are under 25% of
  the balls banked.

### 4.5 New Hire Kit · XS

**Confirmed, with one tweak: the kit grows with the range.**

**Who gets it:** a Rat who joins when `day > 1` and has no `gearByName`
entry. That covers a late joiner or a renamed Rat.

**What they get:**
- a **tube** (gear 1) at the Muni;
- a **range bucket** (gear 2) from the Club on, because a tube at ×5 Rate
  strands nobody, but it looks like a joke next to three push pickers.

The kit is free, and it's recorded in `gearByName` at once.

**The toast:** *"New Hire Kit: a hand-me-down tube from the lost and found.
It's sticky."* At the Club and above, the kit is *"a bucket with someone
else's name on it."*

**Server data:** in `join()`:
`if (day > 1 && !(name in gearByName)) p.gear = gearByName[name] = venue ≥ 1 ? 2 : 1`,
plus the event `{t:'kit', id, level}`.

**Client:** the toast.

**Playtest check:** someone who joins on day 4 banks their first load within
60 s of joining.

### 4.6 CCTV overview · S

**Decision: unlock it with the Club, not with a second cart.**
- A second cart is an M refactor: `this.cart` is singular through boarding,
  driving, pickup, pings, Gary, washing and the snapshot.
- Tying a cheap S camera to that delays both for no gain.
- The Club is where the field gets busy enough for an overview to earn its
  keep.
- The second cart becomes the Tiered tier's toy (§4.2), and it gets the
  "First fleet" voice line.

**In the story:** the Club reveal installs it. *"For your safety, Corporate
has installed cameras."*

**What it's for:**
- One Rat on the monitors can see the whole range and **flag** spots for the
  crew.
- That's a real co-op job: "pile behind the yellow flag!"
- It also shows each fixture's mud, so the watcher can call the chores.

**How it works with a pad:**

| Input | Pad | Keyboard / mouse |
| --- | --- | --- |
| Open or close CCTV | **D-pad down** (it's free outside menus) | **C** |
| Next / previous feed | **RB / LB**, or D-pad right / left | **Q / E** while in CCTV, or the mouse wheel with Shift |
| Pan the feed (±35° yaw, ±15° pitch) | Right stick | Mouse |
| Zoom (FOV 60° → 25°) | RT / LT | Mouse wheel |
| **Flag it** at the reticle | **Ⓐ** | Left click |
| Leave | Ⓑ, or D-pad down again | C or Esc |

**The feeds:**
- **CAM 1 · STAND MAST:** from (26, 18, 14), looking down the range.
- **CAM 2 · POND:** from (−30, 10, −58), looking at the pond.
- **CAM 3 · FAR FIELD:** from (0, 22, −265), looking back at the mats.

**In CCTV:**
- Your Rat stands where you left them, and they're still on the range.
  - A customer's ball can knock you flat, which drops you out of CCTV with
    *"You were watching the monitors."*
  - You can't open CCTV while driving or diving.
- Mates' name tags render at double size, with a ring in their colour.
- Every fixture with mud above Gary's line (0.34) gets a red ✗ marker.
- Gary's route shows while he's on site.
- Other Rats see a small camera glyph on your name tag: *on the monitors*.

**Flag it:**
- It raycasts from the feed camera through the reticle to the ground plane
  (y = 0), clamped to the field.
- The server relays a marker: a 3 m Dimples flag with a pulsing ring, in the
  flagger's colour. Everyone sees it for 10 s, with the float text
  *"LOOK HERE · <name>"*.
- One live flag per Rat, with a 2 s cooldown.

**The look:** a CSS overlay, with no post-processing pass.
- Scanlines (a repeating linear gradient) and a vignette.
- The top-left reads `CAM 1 · SITE 12 · DAY 7 · 14:32:07 ● REC`, ticking in
  shift time.
- A CSS filter on the canvas: `saturate(0.35) contrast(1.15)`. If it costs
  frames on Xbox, drop the filter and keep the overlay.

**Server data:**
- **Input:** `{t:'mark', x, z}`, validated in the field, one per Rat, at
  most one every 2 s.
- **Events:** `{t:'mark', by, x, z}`.
- **Snapshot:** `players[].cctv` (a boolean, reported by the client and
  only used for the tag).
- **The unlock:** `venue ≥ 1`. Nothing else is stored.

**Client:**
- `cctv = {on, feed, yaw, pitch, fov}`;
- the three fixed camera poses;
- the overlay, the markers, and the first-open PA line (`cctv`, once).

**Playtest check:**
- In a 4-player session at the Club, someone opens CCTV unprompted within
  two shifts.
- At least one flag leads a crewmate to a pile.
- Nobody gets stuck in CCTV: Ⓑ always leaves.

### 4.7 Gear grime + Hose a Friend · S

**Yes.** On its own the gear factor is small. It's in because it gives Hose
a Friend a reason, and round 1's playtest check ("someone hoses a crewmate
unprompted") can't pass without one.

**The rules** (round 1's model, adjusted for the gear ladder):
- `p.grime` is a layer count from 0 to 3. Every Rat starts each morning at
  0 (the locker room).
- +1 layer for each knockdown of any kind: a ball, the cart, or Gary. You
  landed in the mud.
- +1 layer for every **four loads** picked up: 12 balls bare-handed, 32
  with a tube, 100 with a bucket, 240 with a push picker. A per-load count
  keeps the rate the same whichever gear you have. Round 1's flat "per 30
  balls" would bury a push picker in a minute.
- `Gear = 1 + 0.25 × (1 − grime/3)` applies to your own hand deposits.
  Helpers stay ×1, and the cart keeps its own factor.
- A clean Rat earns ×1.25 over today's build. That's a raise, so nothing
  drops below today.

**How to wash your own gear:**
1. **Hose a Friend.** A crewmate holding the wand sprays you, and you lose
   1 layer per 0.5 s on target. The spray also shoves you 0.5 m away from
   them (no knockdown), and you hear a splash and see *"Hosed by Sam."*
2. **The spigot.** Stand at the wash pad (`WASH.STATION`) without the wand
   and hold Ⓐ: 1 layer per 2 s. Solo players use this.
3. Diving doesn't clean you. *"The pond is not that kind of water."*

**Seeing it:**
- Your first-person gear model browns by a third per layer (it lerps the
  material toward `MUD`).
- Mates' name tags carry three grime dots: ●●○.
- The HUD reads `Gear ×1.17`.
- The deposit float shows "✦ clean" at grime 0, as round 1 specced.

**Server data:**
- **State:** `p.grime` and `p.loadsSince` (both in the snapshot).
- **Input:**
  - `wash` gains `target: 'p:<id>'`;
  - the server checks that the sprayer holds the wand and that the target
    is within `WASH.RANGE + 1.5`.
  - The new `{t:'rinse', secs}` is for the spigot.
- **Events:**
  - `{t:'hosed', id, by, dx, dz}`. The target's own client applies the
    shove, because position is client-owned.
  - `{t:'grime', id, v}` when a layer is gained or lost.
- **Pay:** `bank()` takes the carrier's gear for player deposits.

**Client:**
- add mates to the wand's spray raycast (it already tests the cart and the
  fixtures);
- the shove;
- the tint, the dots and the HUD line.

**Playtest check:**
- In a 4-player session, someone hoses a crewmate unprompted by shift 3.
- Players line up at the wand at least once.
- Solo, the player uses the spigot at least once by day 4.

### 4.8 The Last Bucket and endless mode · M

#### The trigger

- At the Orbital Range, `outstanding` starts at exactly **1,958** (the
  write-off in §4.1).
- Every ball banked counts it down, as it always has.
- Banking can never take it below **1**: a deposit that would is clamped.
- **When it reaches 1, the Last Bucket begins.** It's checked in `bank()`
  and fires once.

A 4-player crew banks about 900 balls a shift, so that's the third shift at
Orbital. Solo, it's about the fifth.

#### The moment

1. **The range goes quiet.**
   - The server sets `lastBucket = {phase: 'falling'}`.
   - The shift clock pauses: *"Corporate has paused the sun."* The sky
     freezes at its current light.
   - The mats stop firing, and Gary parks wherever he is.
   - The Board flips to `BALLS OUTSTANDING: 1`.
   - The PA plays the `one` line.
2. **Ball No. 1 comes home.**
   - About 3 s later, a ball of kind `one` spawns at y = 120. It falls in a
     6 s arc to a spot 90–120 m out, with |x| < 40 and away from the pond.
   - The client draws it 3× normal size, white-gold and emissive, with a
     fading trail. It reads *FHI · 1958* on its texture.
   - It lands with a thump and a camera shake for everyone.
3. **Someone picks it up**, by hand only.
   - The cart's reels, the push picker's scoop, the jackpot and the helpers
     all skip kind `one`.
   - It rides outside the pocket (`p.one = true`), so whatever else you
     carry is kept.
   - The carrier walks at ×0.7, can't sprint, board the cart or dive.
   - If the carrier is knocked down, it drops at their feet. It doesn't fly.
     Crew bays still work, so friends *can* knock you flat on the way in.
     That's allowed, and it's funny.
4. **The Last Bucket is a huddle.**
   - The carrier can deposit only when **every online Rat is within 8 m of
     the stand**.
   - Until then, the Board reads `EVERYONE TO THE STAND · 2 / 4`, and the
     deposit is refused with that line as a toast.
   - Solo, it's just the walk home.
5. **Banked:**
   - `outstanding` flaps to **0**.
   - The BV digits scramble for 1.5 s and settle on **$∞ / BALL**.
   - The PA plays the `last` line.
   - The final memo card appears. It's the one memo allowed past 25 words:

     > *"There are no more balls. Fairway Holdings International no longer
     > requires a driving range. Effective immediately, Site 12 belongs to
     > the Range Rats. Every Ball Mattered.™ — Dimples"*

   - The floodlights shut off one by one, and the silo glows.
   - The pay for Ball No. 1 is `1958 × BV`. The float shows "+$∞".
6. **The end card,** a full-screen report with each Rat's name:
   - days worked, total balls banked across the run, commendations,
     knockdowns and quotas hit;
   - the line *"Balls Outstanding: 0."*
   - The button is **Clock in tomorrow**, a crew vote that reuses Ready Up.

#### Endless mode ("Under New Management")

- **The next morning:**
  - The sign reads **UNDER NEW MANAGEMENT · Range Rats LLC**.
  - The Board's header reads *RANGE RATS LLC · Office of Ball Value (us)*.
  - Titles become "Owner."
- **Balls Outstanding is now a live count:** +1 for every customer ball hit,
  −1 for every ball banked.
  - The first customer swing of the day sets it to **1**, and the PA plays
    the `endless` line.
  - That's the closing joke: the job never ends.
- **No Corporate.**
  - Gary doesn't come. His white cart sits parked by the sign with a FOR
    SALE flag. Once customers exist (§7), he's a customer at mat 0, in a
    polo.
  - No quota and no stamps. The Board's red line becomes **the crew's
    record shift pace** (Crew Records, §5.3), so every shift still has a
    target: beat yourselves.
- **Memos keep coming, written by the Rats.** They're random, from a short
  table, for example:
  - *"Today's target: whatever. — the Rats"*;
  - *"Reminder: we are Corporate now. Please do not tell us."*
- **Everything else carries on** at the Orbital rate: Last Call, the
  economy, the shop and the KPIs.

**Server data:**
- **State:** `lastBucket: {phase: 'falling' | 'down' | 'carried', id, by}`
  and `endless` (saved).
- **Clamps:** `outstanding` is clamped at 1 while `venue === 5 && !endless`.
- **Events:**
  - `{t:'lastbucket', phase}`;
  - `{t:'pa', id: 'one' | 'last' | 'endless'}`;
  - `{t:'ending', stats}`.
- **Testing:** the dev env `DEV_VENUE=5`, `DEV_OUTSTANDING=30`.

**Client:**
- the Ball No. 1 mesh and trail;
- the huddle counter on the Board;
- the $∞ flap;
- the final memo, the end card, and the endless sign and Board.

**Playtest check** (with `DEV_VENUE=5`, `DEV_OUTSTANDING=30`, 4 players):
- When the ball lands, all four run toward it.
- The carrier waits at the stand while the others jog in.
- At least one crewmate tries to knock the carrier over.
- Someone says "one more shift" after the end card.

---

## 5. Gap fillers (adopted)

### 5.1 Ready Up · XS

**The rule:** at the report, the next shift starts:
- when every online Rat has pressed **Ready**; or
- 20 s after the first Rat pressed it.

Solo, it starts at once. The button reads `Ready (2 / 4) · starting in 14`.

**Server data:**
- The `start` input becomes a vote, using the same set code as `signed`:
  `ready: Set`.
- On the first ready it sets `readyAt`, and the tick starts the shift at
  20 s.
- Event: `{t:'ready', n, of, t}`.
- Opening the range from the lobby stays instant.

**Playtest check:** in a 4-player session, nobody complains that the shift
started without them.

### 5.2 Employee of the Shift + Personal Ledger · S

**The ledger.** The report gains one line per Rat, in their colour:

> *Sam · banked 212 · $1,140 · hosed 2 · knocked flat 3*

**The awards.** Each Rat on shift gets one, chosen from the table below.
Every award line ends in *— Corporate*.
- At most one award per Rat.
- When two Rats qualify for the same award, the higher stat wins it.
- A Rat with no match gets the fallback award.

| Award | Who gets it |
| --- | --- |
| Most Horizontal Associate | the most knockdowns |
| Employee of the Shift | the most banked (always given out) |
| Department of Wet | the most time diving |
| Fry Laureate | the most baskets peeled |
| Crank Operator of the Shift | the most balls washed |
| Hydration Officer | hosed the most crewmates |
| Enthusiasm (Noted) | the most pings |
| Present | the fallback, for anyone else |

**Server data:** per-player shift stats on `p.shift` (`banked`, `cash`,
`knockdowns`, `dived`, `peeled`, `washed`, `hosed`, `pings`), reset at
`startShift` and copied into `report.ledger`.

**Client:** the report gets the ledger lines and the award lines.

**Playtest check:** in a 4-player session, someone reads another player's
award out loud.

### 5.3 Crew Records · XS

**What's kept:** `records = {cash, banked, bv, day}`, in the save.
- At the bell, a new best **cash** shift (from day 3 on) plays the `record`
  PA line.
- The report shows *"Crew record! Best shift: $6,410 (was $5,980)."*

**Where else it's used:** endless mode's red line (§4.8) reads
`records.cash`.

**Playtest check:** the record line fires one to three times in a 60-minute
session. More than that, and the "from day 3" floor is too low.

---

## 6. The voice-line script

Every line plays with the chime and a caption.

- **Once** means once per crew, ever (the saved `voiced` set).
- Every line except the venue and ending lines counts against the 3-a-shift
  cap and the 20 s gap.

| id | Trigger | Rule | Line |
| --- | --- | --- | --- |
| `welcome` | The crew's first shift ever, 3 s after the memo | once | "Good morning, Range Rats. Corporate pays per ball. Corporate is always counting." |
| `glow` | `debut` of glow (the first Last Call) | once | "Last call. The balls are now glowing. This is a lighting decision, not a medical one." |
| `square` | `debut` of square | once | "Corporate has introduced a square ball. It does not roll. Neither does Corporate." |
| `gold` | `debut` of gold | once | "A gold ball has been hit. It belongs to Corporate. You may hold it briefly." |
| `lead` | `debut` of lead | once | "Corporate has sourced a heavier ball. The pond is now a department." |
| `foam` | `debut` of foam | once | "Corporate has introduced a foam ball. It is worth half as much and goes wherever it likes." |
| `splitter` | `debut` of splitter | once | "A ball has divided into three. Corporate considers this growth." |
| `bouncy` | `debut` of bouncy (the Club) | once | "The members have requested a livelier ball. Please do not chase it. It can tell." |
| `gary` | Gary's first warning ever | once | "Gary from Regional is on site. Look busy. Then be busy." |
| `huddle` | A commendation with a full huddle | the first time, then 1 in 3 | "Gary from Regional is satisfied. Gary has never been satisfied." |
| `cart` | The first cart is bought | once | "Corporate has issued you a vehicle. Corporate has not issued you a license." |
| `jackpot` | A PING jackpot | the first time, then 1 in 4, max once a shift | "A jackpot has occurred. Please do not get used to this." |
| `record` | A record shift at the bell (from day 3) | each time | "A record shift. Congratulations. This is now the baseline." |
| `club` | The Range Club reveal | each promotion | "Congratulations on your promotion to the Range Club. Your duties and parking are unchanged." |
| `cctv` | The first time anyone opens CCTV | once | "For your safety, Corporate has installed cameras. For Corporate's safety, they were always there." |
| `tiered` | The Tiered reveal | each promotion | "Corporate has discovered the word experiential. Please be experiential." |
| `fleet` | The second cart is bought (Tiered) | once | "You now operate more carts than Corporate has parking. That is a you problem." |
| `stadium` | The Stadium reveal | each promotion | "Your Ball Value is now on a jumbotron. Please wave. Please keep picking up." |
| `county` | The County reveal | each promotion | "Fairway Holdings has acquired the county. Please do not hit the county." |
| `orbital` | The Orbital reveal | each promotion | "Earth has been fully retrieved. Please look up." |
| `one` | `outstanding` reaches 1 | once | "Balls Outstanding: one. Ball Number One is coming home." |
| `last` | The Last Bucket is banked | once | "There are no more balls. Corporate has no further use for a range. Every ball mattered." |
| `endless` | The first customer ball in endless mode | once | "Balls Outstanding: one. This announcement was not approved by anyone." |

**One change from round 1:** the Club line drops "pay". The Board shows
×5 at the same moment, and a Corporate claim that pay is unchanged would
read as a bug, not a joke.

---

## 7. Next phase: the public (customers, models and animation)

### 7.1 The decision

**Customers are server-simulated, and the client animates them.**
- The server owns each customer's lifecycle, but only as a state machine
  with timestamps. It never streams positions.
- The paths are deterministic polylines from waypoints in `sim.js`. Server
  and client compute the same position from `(state, t0, path)`.

**Why not client-side cosmetic:**
- Which mat a customer takes, when they swing and when they leave all change
  the ball supply. They have to agree for four players.
- Today's balls already spawn on the server, so the swing that launches one
  has to be the server's swing.

### 7.2 The lifecycle

The shared waypoints:
- `ENTRANCE` at (52, 14), by Gary's start;
- `QUEUE` slots in a line at (30 + 1.2k, 9);
- the `STAND` counter;
- the mats;
- `EXIT` at (52, 18).

| State | What happens | Duration |
| --- | --- | --- |
| `arrive` | Walks from the entrance to the next queue slot | the path ÷ 1.3 m/s |
| `queue` | Idles in line, shuffling forward when the slot ahead frees up | until a mat is free |
| `buy` | At the counter, buys a bucket. The stand pops a bucket and a **sale** chime plays | 2 s |
| `walk` | Walks to the cleanest free mat, bucket in hand | the path ÷ 1.3 m/s |
| `mat` | Sets the bucket down and addresses the ball. Each swing launches a ball on the existing per-mat timer, until the bucket is empty | `bucket × swing gap` |
| `refuse` | Walking up to a mat with mud ≥ 0.95, they **sulk** for 2 s, then pick another mat or go back to the queue | 2 s |
| `leave` | Walks to the exit with the empty bucket, then despawns | the path ÷ 1.3 m/s |

**The bucket:** 30 balls at the Muni, and 50 at the Club and above (members
buy larges).

**Opening:** the shift opens with every open mat already taken (the early
birds), and a replacement queues ahead of time. That keeps a mat idle for at
most about 12 s, so round 1's supply estimates (0.75 balls a second solo,
1.25 at four players) hold. If they drift, tune the swing gap ×0.95.

### 7.3 How it ties into the economy

- **`activeMats(players)` becomes mat capacity**, the number of mats open
  for customers, with the same numbers as today (6 solo, 8 with two, 10
  with three or more).
- **Advertising keeps its swing-gap multiplier**, so ball supply and balance
  don't move. It also sets the **arrival rate**, so the queue length grows
  with ads: 0–1 people by word of mouth, up to 4 with the blimp. A visible
  line *is* the advertising working.
- **Buckets sold** is a report stat, and it pays nothing. In the story, the
  bucket revenue goes to Corporate: you're paid per ball returned.
- **Curb Appeal becomes visible.**
  - Customers choose the cleanest free mat and refuse a filthy one (with
    the sulk).
  - A dirty range now *looks* like lost business, not just a dial.
  - Mud ≥ 0.95 means morning mud (0.85) closes a mat within about 2 minutes
    if nobody washes it. That gives mat washing a visible reason.
- **Fries:**
  - Customers keep eating one basket every `EAT_EVERY` swings.
  - With the stock at 0, a customer at a mat sulks once every 30 s
    (cosmetic).
  - A basket mesh appears on the mat while the stock is above 0.
- **Phase 2, the supply chain** (the washer option deferred from §4.4):
  - Washed balls become the stand's **bucket stock**, and each morning
    starts with 300 from the night crew.
  - With stock below a bucket, the Board shows **SOLD OUT**, and the queue
    waits.
  - It only bites when the crew is behind: this is the design doc's
    "collecting lets you sell buckets" loop, at last.
  - Build it after the customers are stable.
- **Bay Utilization (Tiered)** is the time-averaged share of open mats with
  a swinging customer. This phase makes that KPI possible. It falls when
  mats are filthy, when the queue is empty (not enough ads), and in phase 2
  when the stand is sold out.

### 7.4 Server and client split

**Server:**
- **State:**
  - `customers: Map<id, {id, look, st, mat, t0, swings, path}>`, about 18
    at most;
  - each mat gains `cust` and `swingIn`.
- **Events:**
  - `{t:'cust', id, st, mat, look, t0}` on every state change;
  - `{t:'sale', id}`;
  - `{t:'refuse', id, mat}`;
  - `spawn` events gain `cust`.
- **Snapshot:**
  - `cust: [[id, st, mat, look, t0], …]`, compact, for joiners;
  - `mats: [{c, n}]`, where `n` is the seconds to the next swing (0.1 s
    precision).

**Shared (`sim.js`):** `CUST` (the waypoints, the walking speed, the bucket
sizes) and `custPos(c, t)`, which interpolates the polyline.

**Client:**
- **Placing customers:** each frame, it places them from `custPos`, using
  its estimate of server time (`shiftT` plus the local dt).
- **The swing:** it starts the swing animation when the snapshot's
  `swingIn` drops below the time to impact.
  - Impact is at 0.55 × 1.6 s = 0.88 s into the swing.
  - The ball appears on its `spawn` event.
  - Both arrive with the same latency, so they line up.

**v1 interactions** (cosmetic only):
- A customer flinches when a crew ball passes within 1 m, and says
  "Sorry!" (float text).
- Gary honks at customers.
- Carts and Gary pass through customers. Customers never knock anyone over.

### 7.5 Models and animation: reuse golfers.js

**Decision: reuse it.** Copy `golf/web/js/golfers.js` into
`range-rat/web/js/golfers.js` verbatim, with a header naming the golf commit
it came from.
- It imports `'three'`, which Range Rat's import map already resolves.
- It's procedural primitives only, with no asset files.
- It exports `buildGolfer(id, tint)`, `animateGolfer(g, t, {mode, k,
  speed})`, `golferAddress(g, ball, target)` and `GOLFER_IMPACT` (0.55).
- That covers every customer animation needed.

**The minimal animation set:**

| Customer moment | golfers.js mode |
| --- | --- |
| Walking (arrive, walk, leave) | `run` at `speed` 1.4–2.0: a slow stride. Parent a small bucket mesh to `userData.handL`; the club rides in the right hand already |
| Waiting in the queue, or between swings | `idle` |
| The swing | `swing`, with `k` going 0 → 1 over 1.6 s. Place them with `golferAddress(g, {x: mat.x, y: 0, z: −0.4}, target)`, aimed along the shot's direction |
| A refused mat, or no fries | `sulk` |
| A PING within 20 m, a gold ball, or the Last Bucket | `cheer` |

**The builders:** use four of them (`pro`, `birdie`, `kid`, `bogey`), with a
random muted tint for each customer.
- Keep the **mascot** builder out of the customer pool. It's a big golf
  ball, so save it for a future Dimples.
- **Story Keeper's condition:** customers are anonymous members of the
  public. golf's names and blurbs (`GOLFERS`) are never shown. It's code
  reuse, which `game-design.md` allows, but add golfers.js to that
  document's list of reused golf code.
- **Player Advocate's condition:** customer tints stay muted (saturation
  ≤ 0.35), so the Rats' saturated colours and name tags still pop on a TV.

**The performance budget (the Technical Director's condition):**
- Each figure is roughly 35–50 meshes. That's fine for golf's 4–6 players,
  but about 18 customers could add 700–900 draw calls.
  - **Cap: 14 full golfers.** That's 10 mats plus 4 in the queue.
  - Anyone over the cap (arrivals and leavers) is a lite figure: a capsule
    body, a sphere head and a bob.
- **Shadows:** `castShadow = false` on every customer mesh, with a dark
  blob-shadow disc under each instead.
- **Animation rate:** animate every frame within 50 m of the camera, and
  every third frame beyond that.
- **Measure on the Xbox.** If the frame time goes over 20 ms with 14
  figures, drop the cap to 10 (mats only) and make the queue lite.

**The size:** **L** overall. That's:
- the server state machine (S);
- the port and the props (S);
- the paths and animation timing (M);
- tuning supply back to round 1's numbers (S).

**Playtest check:**
- A first-time player watches a customer walk in, buy, swing and leave, and
  can explain where the balls come from.
- In a 4-player session, someone washes a mat *because a customer sulked at
  it*.
- Frame time on the Xbox stays under 20 ms with 14 customers.

---

## 8. Pacing, updated

**What moves the round-1 curve:**
- **The quota fix** (§1.2 item 1). Washer purchases no longer satisfy the
  quota, so stamps take honest upkeep. Round 1's target of a 70–85% hit
  rate on days 2–5 stands.
- **The ball washer.**
  - Hand-crank days (2–3) pay a little later, not less, if the crew cranks.
  - Four-player crews lose about 10–20% of the washer premium until they
    learn the crank or buy the electric washer.
  - Net effect: about −5% on days 2–4, and about 0 from the electric washer
    on.
- **Gear grime.** Clean Rats earn ×1.25 on hand deposits, so days 1–3
  (hand-dominated) earn about +10–15%. This roughly cancels the washer's
  early dip.
- **The promotion** replaces round 1's "Club fee is the next goal" with a
  real step change.

**The first 60 minutes, 4 players** (a shift is about 7 minutes of play plus
about 45 s of report and shop):

| Minute | Day | What happens |
| --- | --- | --- |
| 0 | 1 | The PA's `welcome`. Hands, the Board, a muddy sign. Tubes bought at the first report. Ready Up. |
| 8 | 2 | The first quota and Last Call (the `glow` line). The hand-crank washer: "+$X waiting" teaches the crank. The Next Goal strip appears. |
| 16 | 3 | The first Gary (the `gary` line), square and gold balls. Someone is hosed. The first record shift. |
| 23 | 4 | Lead balls and the pond. The cart. The electric washer. Employee of the Shift is being read out loud. |
| 31 | 5 | Usually the third stamp. Fee $5,500, with about $5–7k earned. |
| 39 | 5 or 6 (the report) | **The franchise agreement:** all four sign. |
| 40 | 6 or 7 | **The Club reveal.** The ×5 morning and the spree: the industrial ball wash, covered bays, everything at the Muni. Bouncy balls, the `cctv` line. |
| 47–60 | 7–8 | Club days 1–2. Splitters (day 7). CCTV flags. Quota on the venue schedule. |

The session ends mid-Club with *"Tiered Entertainment Range: 2 stamps to
go"* on the report. That's the next session's hook.

**Solo:** the Club on day 6 or 7 ($2,500, with about $2.6k a shift by day 5).

**The ladder across sessions** (tuning targets):

| Session | Venues | Shifts |
| --- | --- | --- |
| 1 (60 min) | Muni → Club | ~8 |
| 2 (60 min) | Club → Tiered → Stadium (first fleet) | ~8 |
| 3 (60–75 min) | Stadium → County → Orbital → **the Last Bucket** | ~9 |

**Fees:** each fee is about 3 shifts of solo income at the venue before.
Four players earn about 2.5× solo and pay ×2.2, so they're gated by stamps
(3 shifts a venue), not cash. That keeps solo and co-op on the same clock.

**Upkeep ceiling by venue:** ×2.5, ×2.5, ×3.0, ×3.5, ×4.0, ×4.5, once each
dial is live. Reveal-only tiers stay at their unlocked ceiling until their
KPI ships.

---

## 9. Notes for the build (the council's concerns)

1. **One table, `VENUE_RULES`, in `sim.js`.** It holds the fee, the
   write-off, the title, the reveal text, the PA id, `eatEvery`, the Gary
   stops, the free grant and the shop row for each venue. Everything in
   §4.1–4.2 reads from it, so later tiers are data, not code.
2. **Promotion only in the report phase.** Never let Rate jump mid-shift.
3. **The vote set is one utility.** The franchise signatures, Ready Up and
   "Clock in tomorrow" share it: `this.votes[name] = Set`, counted against
   `onlineCount()` and cleared when the phase changes.
4. **PA ids, not text, on the wire.** Text lives in `sim.js` `PA_LINES`.
5. **The washer's credit is fixed at bank time.** It locks in Hustle, Gear
   and Upkeep. Never re-price the hopper later, or players will learn to
   bank dirty and wash under a better multiplier.
6. **Kind `one` is excluded from every bulk pickup path:** reels, scoop,
   jackpot, helpers and spill.
7. **Dev switches:**
   - `DEV_VENUE` and `DEV_OUTSTANDING`;
   - `DEV_STAMPS` (start with stamps);
   - the existing `DEV_START_CASH` and `SHIFT_SECS`.

   Add tests in `test/` for:
   - promotion bookkeeping (fee, stamps, write-off, grant);
   - the washer's split pay (the total equals the old pay when everything
     is washed);
   - the quota-on-Upkeep fix;
   - the Last Bucket clamp.
8. **Docs in the same commits.**
   - `game-design.md`:
     - ball value and the quota, replacing the stars;
     - the shop open any time;
     - the washer station;
     - the venue rules;
     - golfers.js in the reused-code list.
   - README: the controls (sprint, shop, CCTV, crank) and the status.
