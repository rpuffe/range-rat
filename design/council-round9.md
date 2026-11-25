# Fun Council, round 9: the owner's ideas, early game and late game

This is the record of Range Rat's ninth Fun Council (2026-11-24). It follows playthrough 4, the final scored round
(overall 6.8), and the owner's console playtest on PC and Xbox. The layout (the ball return, the washer on the pipe,
the bank) is merged into main at 34b7ff0. Rounds 1–8 still bind wherever this record doesn't change them. Where they
disagree, this record wins.

**This round has one job.** The owner asked: *"Some of my other prior ideas, can we send summaries of that to the Fun
Council and see what they think about ways to adjust that to better fit the game and early game and late game?"* The
agenda is `design/owner-ideas.md`, plus five items the owner added mid-round (§1, items 10–14). The council gives every
idea the benefit of the doubt. It adapts ideas and doesn't reject them. Where an idea fights an existing system, the
council changes the idea's shape, not its intent.

**The owner's firm calls (unchanged, binding):** multiplayer first (up to 6, balanced for 4, no assigned roles) · one
day = one shift · a ball that hits you knocks you down · scuba is fancy · no named balls · rare PA lines · the kitchen
serves fries, hot dogs and beer · the Tiered beer fall · the shop is open any time · Xbox controller, with Xbox Edge as
the performance floor · every feature is worth it · one centre text at a time, about 8 words · choose what's more fun
and easier for a casual crew of 4.

**The council (same seats as rounds 5–8).**

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
- `design/owner-ideas.md`, `design/scorecard.md` (four rounds; 5.5 → 6.8), `design/playtest-round4.md`, and the last
  sections of `game-design.md` (council round 8's build, the owner notes, the walk-off, the layout).
- The layout branch: `web/js/layout.js`, the "Layout" section, and in `server/crew.mjs`: `valueNow`, `bank`,
  `morningMud`, `startShift`, `tick` (customers, Last Call, glow, scuff), plus `web/js/sim.js` (`ballValue`, `SHOP`,
  `perks`, `quotaQ`, `venueQuotaF`, `LAST_CALL`, `GARY`, `activeMats`), `web/js/customers.js`, `web/js/board.js`
  (the Board's strip), `web/js/main.js` (the HUD line, pad bindings, `menuRoot`), `web/js/sfx.js` (`cartEngine`),
  `server/venues/tiered.mjs`, `stadium.mjs`, `orbit.mjs`, `county.mjs`.
- **`design/owner-playtest-3.md` did not exist yet** in either repo when this record was written. §2 is therefore
  written as "what the spec must say". The design lead can check the draft against it.
- Headless node scripts against the real `Crew` from the layout worktree. They live in the scratchpad's `council9/`,
  with harness `h.mjs`. They edit no game code: rule variants are emulated from outside, by mutating an exported
  constant, restoring fixtures after `startShift`, or pushing every mat's next swing past the bell.
  - **`flow.mjs`**: balls per minute, balls on the field at 15/30/60/120 s, and buckets taken, by venue (Muni, Club,
    Stadium), crew size (1/2/4) and ads (0/3).
  - **`opening.mjs`**: "fill the bays sooner" variants at the Muni (full early-bird buckets, a First Call at ×1.5 and
    ×2, every mat open for small crews), seeds 1–5.
  - **`mats.mjs`, `mats2.mjs`**: Muni days 2–8 back to back. Today's morning mud vs mats that keep their mud overnight
    (uncapped, and capped at 0.6 / 0.5). Three hose policies.
  - **`endday.mjs`**: the owner's end of the day (glow from 1:30, customers out at 1:00, a cleanup minute) at the Muni,
    the Club and Tiered, with Last Call swing ×1.5/×2/×3.
  - **`bv.mjs`**: what the Board prints today vs a one-look reading, and every review target as a percentage.
  - **`ladder.mjs`**: the op3 ladder bot with two env knobs (`FEE1`, `WASHK`), for the Muni pace.

---

## 0. What the numbers say before any idea is judged

**N1 · The Board prints a multiplier as a cost.** `board.js` draws `+${money(st.rate)}/s` and
`UPKEEP -${money(st.upkeep)}/s`. Rate is dollars per ball *before* Upkeep, not per second. Upkeep is a multiplier
(1.0–3.0), not a cost.

| State | BV | The Board's strip today | What it actually means |
| --- | --- | --- | --- |
| Muni day 3, hand washer, grounds 62% clean | $2.62 | "+$2.00/s · UPKEEP −$1.31/s" | $2.00 a ball × 1.31 |
| Club day 2, electric washer, fries 40%, pond 90% | $30.00 | "+$15.00/s · UPKEEP −$2.00/s" | $15.00 × 2.00 |
| Tiered, Brent, cups 60% | $286.88 | "+$112.50/s · UPKEEP −$2.55/s" | $112.50 × 2.55 |

That is word for word what the owner reported: "a ball value, a plus something per second, and an upkeep is something
else". It is a labelling bug, not a design problem. **The design is already the owner's idea.** At the Muni, BV is
literally `$/ball × (1 + 0.5 × how clean the grounds are)`. From the Club on, `(Upkeep − 1) / (ceiling − 1)` is
exactly **the average of the unlocked gauges**. So every review target is one percentage:

| Where | Review target as a percentage of the Upkeep bar |
| --- | --- |
| Muni (grounds only) | day 2–4 **60%** · day 5 **70%** · day 6+ **80%** clean |
| Club and up (average of the gauges) | venue day 1 **35%** · 2 **40%** · 3 **45%** · 4 **50%** · then +2.5% a day up to 70% |

**N2 · The bays are already full at 0:00. The field is what's thin.** Early birds sit down at the opening with a
35–100% bucket, but balls pile up slowly. Balls resting on the field at 60 s are 10 (solo), 25 (2P) and 39 (4P) with no
ads. A Muni shift's supply is 161–201 balls solo, 255–274 at 2P and 326–393 at 4P, and the blimp roughly doubles it.
The "fill the bays sooner" variants, measured over the whole shift:

| Muni day 3, no ads | Solo | 2P | 4P |
| --- | --- | --- | --- |
| Early birds hold a full bucket | 0% | +3% | +3% |
| First Call ×1.5 for the first 60 s | +7% | +8% | +6% |
| First Call ×2 for 60 s | +12% | +15% | +12% |
| **Every mat open (10), whatever the crew size** | **+63%** | **+28%** | (already 10) |

`activeMats` is 4 + 2 × Rats, so a solo Rat sees 6 mats and a pair sees 8. That is the "basic round" feeling.

**N3 · Buckets: about 2–4 a minute, at every venue.** Every venue has the same 10 mats, so bucket demand doesn't grow
with the venue. At 4P a shift takes 7–10 early-bird buckets plus 10–11 more with no ads, or 20–23 with the blimp. The
first re-buy comes at 47 s (blimp) to 164 s (no ads). It comes in waves of up to 4–5 per 30 s, because the early
birds' buckets run out together. The walk from the gate past the basket to a mat takes 35–63 s at `CUST.WALK` 1.3 m/s.

**N4 · Mats that keep their mud overnight save hose time and morning refusals. Uncapped, they spiral.**

| Muni days 2–8, 4P | Hose time a day (hosing only to hit the target) | Morning refusals | Nobody hoses |
| --- | --- | --- | --- |
| Today (5 random mats at 0.95 each morning) | 96–200 s | 3–5 a day | 14–30 refusals a day; cash $207–284 |
| Mats keep their mud, no cap | 96–143 s | 0 | mean mud 0.82 on day 3 and 1.00 from day 4; 28–49 refusals; cash −25–35% |
| **Mats keep their mud, capped at 0.6 overnight** | **96–143 s** | **0** | **2–8 refusals, late in the shift**; cash $231–307 (≥ today's neglect) |
| Capped at 0.5 | 96–143 s | 0 | 0 refusals (mats sit at 0.91–0.95, under the line) |

At 2P: 83–182 s → 83–126 s. Solo: 68–144 s → 68–106 s. **Hosing is the Muni's real gate for a small crew.** It is
about two minutes of one Rat's seven-minute shift. That is ~30% of a solo shift.

**N5 · The cleanup minute costs some balls, and it takes Tiered's teeth unless the bowls are judged at 1:00.** Last
Call is moved to T−90…T−60, and from T−60 no new customer balls come.

| Idle 4P, mean of 4 seeds | Balls a shift (glow) | Resting at T−60 → at the bell |
| --- | --- | --- |
| Muni d5, today (Last Call 60 s ×1.5) | 500 (86) | 321 → 389 |
| Muni, cleanup, rush ×1.5 / ×2 / **×3** | 422 (46) / 435 (59) / **460 (80)** | 330 / 341 / 360, flat after |
| Club late gear, today | 1,168 (193) | 508 → 625 |
| Club, cleanup ×1.5 / ×2 / **×3** | 1,003 / 1,038 / **1,093 (196)** | flat after T−60 |

At ×3 the rush keeps today's glow count and costs 6–8% of the supply. An active crew wins much of that back by
picking in a minute with no balls in the air.

Tiered (late gear, gutters, 6 seeds). Bay Utilization at the bell, or read at T−60, with one crew TARGET:

| Rule | No TARGET | TARGET at T−75 | T−65 | T−50 | T−30 | T−15 |
| --- | --- | --- | --- | --- | --- | --- |
| Today, 4P | 0/6 | – | – | 4/6 | 5/6 | 6/6 |
| Cleanup, judged at the bell, 4P (any rush) | 0/6 | 5–6/6 | 6/6 | **6/6 (1.00)** | **6/6** | **6/6** |
| **Cleanup ×3, judged at T−60, 4P** | 0/6 | **3/6** | **6/6** | – | – | – |
| Cleanup ×2, judged at T−60, 4P | 0/6 | 5/6 | 6/6 | – | – | – |
| Cleanup ×3, judged at T−60, solo | 0/6 | 3/6 | 6/6 | – | – | – |

Judged at the bell, any TARGET after the customers leave scores 1.00. That is round 3's "can't fail once anyone
shoots", back again. Judged at 1:00 ("the last customer out reads the bowls"), the buzzer-beater moves to 1:00 and is
as sharp as today's.

**N6 · Muni pace: the stamps set the floor, and hosing sets it for small crews.** The fastest Muni is 4 shifts (day 1
training, then three stamp days). The op3 ladder bot at 4P promotes after day 5 (34 min) whether the Club fee is
$2,500 or $1,500 base: its spending, not the fee, holds it. The bot as shipped never stamps at 2P or solo, because it
hoses 0.3 × N/4 of its time. With that hose share doubled, all three crew sizes promote on day 5. The owner's "day 6
and still on my very basic round" is what a 1–2-Rat crew gets from N2 (6–8 mats) plus N4 (two minutes of hosing a day).

**N7 · One crew row for carrying gear is cheaper for a crew.** Gear is personal at catalog price. A 4P crew pays
4 × ($20 + $75 + $250) = **$1,380**. One crew row at the ×2.2 crew scale costs **$759**, saving $621. That is 1.5–2
early Muni shifts of income ($300–450 a shift with one teenager). **Shoes are already a crew row** (`up.shoes`), so
half of the owner's idea 6 is already true.

**N8 · Cart capacity against a shift.** The caged cart (300) holds 38–47% of a 4P Muni shift's balls with the blimp
(640–786). The wide reels (600) hold 51% of a late Club shift (1,168). Halved, those are 19–23% and 26%.

**N9 · The whine is the synth.** `cartEngine` is one sawtooth from 110 to 440 Hz, through a lowpass that opens from
600 to 2,000 Hz at full throttle. At top speed that is a bright A4 buzz.

---

## 1. The owner's ideas: verdicts, early and late

**Adopt** = build as proposed · **Adapt** = build the council's version · **In place** = already true or built.
"→ #n" points at the build list (§3). Early = the Muni and the Club. Late = Tiered → the Stadium → the County → the
Orbital → endless.

### 1 · Ball Value isn't clear (the owner's most important) — **Adopt, as one bar** (→ #1)

- **Early.** The idea fits perfectly. It's already the rule (N1). What's broken is the Board saying it wrong. A new
  player needs three things in one look: what a ball pays, what raises it, and what the day asks for.
- **Late.** The KPI gauges stay. They become the segments of one bar, and the venue gauge keeps its own white 50%
  tick, which decides the stamp.
- **Adjustment (one look).**
  - The Board's big number reads **"$2.62 A BALL"**.
  - Under it is one bar, **UPKEEP 62%**, with a red tick at the target, **"TARGET 60%"**. At the Muni the bar is
    labelled **CLEAN**, because it is only the grounds.
  - The broken strip ("+$/s", "UPKEEP −$/s") goes. In its place: **"Clean grounds pay up to +50%"** at the Muni, and
    "Each gauge pays up to +50%" from the Club on.
  - The gauge column stays as it is (CURB APPEAL becomes **GROUNDS**). The bar is their average, so filling any gauge
    visibly fills the bar.
  - The HUD line: "$2.62 a ball · 62% clean · need 60%".
  - The memo: "Today: 60% clean by the bell." (6 words) instead of "Clean up: Ball Value $1.30".
  - The day-2 `bv` hint: "A ball pays more the cleaner it is." (8 words).
- **Why a percentage, not dollars.** E: a mid-shift washer buy raises BV and the dollar target together, which reads
  as "the target moved". A percentage never moves. It also tells the truth that the review is about cleaning, which
  the owner named.
- **Conflicts.**
  - The Closing Bell's crossing flash keeps working: crossing the tick is the same event.
  - `GAUGE_MISS` lines are unchanged.
  - The report's "BV under target" line becomes "Clean 54% · needed 60%".
  - No centre text is added.
  - Endless: the bar still shows. Its target is null, so the endless Board is unchanged.

### 2 · The end of the day: glow from 1:30, customers out at 1:00, a cleanup minute — **Adapt** (→ #2)

- **Early.** A great fit. The last minute has no balls in the air, so it's safe to run onto the field: a dash for the
  last glowing balls. Hosing in it is final, because mats stop scuffing when customers stop. That fixes the
  "On target, then DENIED" family for good: `UPKEEP_MARGIN` exists only because of Last Call's ×1.5 scuff.
- **Late.** It fits with two adjustments (N5).
- **Adjustments.**
  - **The rush is ×3 for 30 s** (`LAST_CALL` = { SECS: 90, SWING: 3 }, customers out at `CLEANUP` 60). That keeps
    today's glow count (80 vs 86) for −6–8% of supply. ×1.5 halves the glow, which is the dusk's best picture.
  - **Glow balls stay worth ×2**, so the rush still pays.
  - **The "N left out there" count goes live** on the top edge from 1:00 (the walk-off's count, earlier). It counts
    down as the crew picks: the cleanup minute's scoreboard, with no centre text. The walk-off then shows the final
    number.
  - **Customers walk out** through the gate on their existing 'closed' leave route.
- **Conflicts and fixes.**
  - **Closing Bell and rally.** The rally moves with Last Call to **T−90**. The 30 s re-check becomes the **cleanup
    deal at T−60**, using `UPKEEP_MARGIN` 0 (nothing scuffs after it). That is still two lines in the last 90 s, as
    today in the last 60.
  - **Glow Rush (Tiered).** Judged at the bell, it dies (N5). **Bay Utilization is judged when the last customer
    leaves, at 1:00**: "no customers, no bays to use". The Board's purple bar freezes with a padlock tick at 1:00.
    ×3 rush, cups ×2: a TARGET at 1:15 passes 3/6, one at 1:05 passes 6/6 (4P and solo). That is today's
    buzzer-beater moved to 1:00.
    - Rally line: **"Glow rush! Shoot before they leave!"** (6 words).
    - Miss line: "Missed: the bowls were full at 1:00." (7 words).
    - "Saved by Cy's TARGET at 1:04."
    - C dissents: "just keep Tiered open to the bell, it's the night venue". Outvoted 5–2 (L with C): one end-of-day
      rule everywhere is easier to learn, and the T−60 read is one sentence.
  - **The Stadium.** The Two-Minute Warning stays at **T−120**, now 30 s before Last Call. The crowd is fans, not
    customers, so it stays through cleanup, and the graded 120 s window still ends at the bell. A cleanup lap counts.
    The order is 2:00 warning (ALERT) → 1:30 horn (no line) → 1:00 re-check only if short.
  - **Gary** (at 43% of the shift) is untouched.
  - **Dealt jobs.** `dealJobs` is unchanged; it gains a 'pick' job ("Grab the last balls!", 5 words) when the live
    count is over 30.
  - **The dusk walk-off** starts at the bell as today, with the customers already gone.
  - **The huddle and the Orbital.** Orbit shots stop with the customers, so debris stops growing at 1:00. The sky gate
    and `SKY_HOLD_SECS` are unchanged.
  - **Endless.** Same rule. The cleanup minute is where effort beats yesterday (C's late-game ask).
  - **Knockdowns.** Crew bays still swing in cleanup, so a mate can still floor you.
  - **Xbox.** Nothing new to draw: glow balls already use the glow material.

### 3 · Mats persist overnight; the morning becomes "fill buckets"; later an auto bucket filler — **Adapt** (→ #3, #4)

- **Mats, early.**
  - **Mats keep their mud overnight, capped at 0.6** ("the night crew knocks the worst off"). There are no morning
    refusals, and the morning saves ~25–60 s of hosing (N4).
  - A neglected mat refuses customers *mid-shift* (2–8 a shift). That is the mid-shift mud bite that round 8 couldn't
    get without doubling the scuff (its A5). Uncapped, a crew that forgets spirals to 28–49 refusals and −25–35% cash
    by day 4. Too mean for a casual crew.
  - The sign (0.9) and the return (0.5) still get their morning mud. They are Gary's stops and a quick morning hose.
- **Mats, late.**
  - **Covered bays** (Club amenities) become "Mats scuff half as fast" ("no morning mud" means nothing now). Under
    persistence that's ~2 shifts between hoses. Still worth it.
  - Gary's mats stop is unchanged.
  - Day 1 still starts with clean mats.
- **The bucket job, early.**
  - **The basket** by the red dispenser (the layout's `BASKET`) is **empty every morning**. "The night crew doesn't do
    buckets."
  - A Rat **holds Ⓐ at the dispenser for 1.5 s** to fill one bucket: 30 balls rattle in, and it drops in the basket.
    The basket holds 12, and the heap of blue buckets is the readout.
  - **Early birds keep their own buckets**, so the bays stay full at 0:00 (idea 4). The basket feeds the second wave,
    which arrives at 0:47–2:44 (N3). That is a soft morning deadline, not a dead first minute.
  - A customer who finds the basket empty waits there. This reuses the mud wait: 25 s, then they leave, and the same
    `refuse` event fires.
  - The ball supply is unlimited (the silo never runs dry), so the job is about labour, never scarcity, and can never
    softlock.
  - The demand is 18–30 buckets a 4P shift (N3), so the job is ~20 s of one Rat's morning plus a top-up every couple
    of minutes.
- **The auto bucket filler, late.**
  - A crew row at the **Club**: **"Bucket machine"** at **$400 base** (≈ $880 at 4P), **1 bucket every 10 s**
    (6 a minute). That covers any steady state (peak ~5 per 30 s), but not the morning's empty basket and first wave.
    So the morning keeps a beat at every venue, which is the owner's point.
  - Its top look at the Stadium is the jobs table's own absurd endgame: "a bucket vending wall the size of a
    building" (cosmetic, same rate).
- **Conflicts.**
  - Day-2 nudges and Gary's lines share the nudge slot. The morning deal (Q2 below) goes there too, never in the
    centre.
  - The basket's buckets are one `InstancedMesh` (12 slots).
  - The layout's chain gains its last link: return → washer → bank → dispenser → basket → customers → field →
    return. **That is the economy loop from the design doc, standing in the yard.**

### 4 · The early game feels slow — **Adapt** (→ #3, #5)

- **Early.** The owner is right for a 1–2-Rat crew (N6). The cart's pace stays. The levers are the ones the numbers
  found:
  - **every mat open at the Muni** (+28% 2P, +63% solo);
  - **mats that keep their mud** (−25–60 s of hosing a day);
  - **crew-wide carrying gear** (−$621 at 4P);
  - **customers who prefer clean mats** (item 13).
- **Late.** Untouched. From the Club on, the stamps set the pace (4P 141–142 min to the Last Bucket).
- **Rejected with numbers:**
  - First Call (×1.5 or ×2 for the opening minute): +6–15%. It drains the new basket in the first minute and adds an
    opening horn next to the PA welcome and the memo.
  - Full early-bird buckets: +0–3%.
- **Not changed:** the Club fee. The bot's Muni pace didn't move at $1,500 base (N6). Check it in playtest first.

### 5 · Upgrade the pressure washer — **Adopt, as its own row** (→ #6)

- **Early.** The wand is the Muni's core job (N4: 100–140 s a day), and today its only upgrade (the turbo nozzle) is
  a Club amenity at $3,000. A new crew row, **Pressure washer**:
  - Muni day 2: **Fan nozzle** $40, cleans ×1.5.
  - Muni day 4: **Turbo nozzle** $150, ×2 and 9 m reach. It moves here from Club amenities, which keep covered bays.
- **Late.**
  - Tiered: **Foam cannon** $20k, cleans every fixture in a 2 m cone at once (sweep a row of mats).
  - Stadium: **the power-washing truck** $300k, from the design doc's own jobs table. The cart gets a hose: whoever
    drives sprays the fixture it passes. Hosing becomes driving, which is the late-game way.
- **Numbers.** A day's Muni hosing at ×1.5 is 64–95 s. At ×2 it is 48–72 s.
- **Conflicts.**
  - `perks.turbo` becomes `perks.washRate`.
  - The wand prompt is unchanged.
  - The truck is one more reason to drive. The cage still protects the driver.

### 6 · Movement speed and carry capacity for every player — **Adopt** (→ #5)

- **Early.** Shoes already apply to every player (N7). **Carrying gear becomes one crew row** at the ×2.2 crew scale:
  tube $20, bucket $75, push picker $250 base. Everyone, late joiners too, carries the crew's tier.
- **Late.** Teenagers already use "the crew's gear (up to a bucket)", so nothing changes there.
- **Conflicts.**
  - Existing saves take the crew row as the **highest** `gearByName` level, so nobody loses gear.
  - Today a new Rat at the Club gets a free bucket (tier 2); that becomes a floor on the crew row.
  - **Dive gear stays personal**, because scuba is fancy and only one or two dive at a time. M dissents ("one rule:
    everything is the crew's") and is outvoted 6–1. Revisit if the owner wants it.

### 7 · Controls: spray on RT, sprint on L3, report and shop fully on a pad, never leave full screen — **Adopt** (→ #8)

- **Sprint moves from R3 to L3.** `BTN.LS` is unbound on foot. R3 is freed.
- **RT sprays while you hold the wand.** Ⓐ still works. RT is throttle while driving and the power-swing modifier at a
  crew bay, and neither can happen while you hold the wand, so there's no clash.
  - The prompt: "RT spray" (2 words).
- **Report and shop.** `menuRoot` already covers `report` and `store`. Q must walk every button on an Xbox pad: the
  report's shop rows, Next, the promotion Sign, and B to close.
- **Full screen.** Chromium doesn't count gamepad input as a user gesture for `requestFullscreen`, so the game can't
  put you back once you're out. It must never take you out. Suspects, for Q to reproduce on Xbox Edge:
  - the lobby's text inputs (they open the system keyboard);
  - `location.reload()` on Leave;
  - the share link's clipboard write.

### 8 · The cart's engine at full throttle is whiny — **Adopt** (→ #8)

- `cartEngine` (N9) becomes:
  - two detuned square waves, an octave apart, at **70 → 160 Hz**;
  - a lowpass **400 → 900 Hz**;
  - a 12–28 Hz "putt" tremolo that rises with speed;
  - a quiet band-passed noise layer for the tyres;
  - and **top speed sits 10% under max gain**.
- Turbo (×1.6) doesn't raise the pitch further: clamp to the base `vmax`.
- Zero cost on Edge (Web Audio nodes, no draws).

### 9 · Hard hats — **In place; left alone**

$35, a 1 s knockdown and a BONK. They work, and the owner hasn't tested them. Not on the list.

### Layout · The ball return, the pipe, the washer, the bank, the basket — **In place (merged); extend** (→ #4)

- **Early.** It teaches the loop by sight.
- **Late.** It's where the bucket machine and the bucket wall go. That's the only extension.
- **Conflicts.** The code still says "stand" (`SIM.STAND`, `atStand`, `gary:stand`). Every new line must say "the
  return".

### 10 · More bays as a Muni upgrade, or another way to hit more balls (the owner is struggling to level up) — **Adapt** (→ #5)

- **Early.** The owner is struggling because a 1–2-Rat crew sees 6–8 of the 10 mats (N2).
  - **"Open every bay"** is a Muni crew row from day 2 at **$40 base**. It seats all 10 mats whatever the crew size:
    **+63% balls solo, +28% at 2P**.
  - At 4+ Rats every mat is already open, so the row hides. The "another way" for a full crew is the advertising row,
    which already doubles swings (blimp).
  - Muni only, where the fee and the supply bind.
- **Late.** From the Club on, small crews keep `activeMats(N)`. The stamps set the pace there, and solo already
  reaches the Last Bucket (150–151 min).
- **Why not new mats beyond 10.** The crew bays sit at x ±23, right past the last mat (x ±18). L says new mats need a
  new mat line. That's a level change for no 4P gain.

### 11 · Stall Gary by chatting: one Rat holds interact at Gary while the others clean — **Adopt** (→ #7)

- **Early.** This fixes playtester A's top complaint: "Stall Gary" was dealt during the warning, when pinging a
  parked Gary does nothing.
- **Late.** C wanted late Gary visits to have a stake. Chatting makes him a crew moment at every venue.
- **Rule.**
  - A Rat within 2.5 m of Gary, while he is parked at a stop, his warning spot or the stand, **holds Ⓐ** (or E).
  - His pause grows while they hold, out of **one shared stall budget of 12 s a visit**, shared with round 8's cart
    pings (which keep their 3 s each).
  - The chatter can't hose or carry while chatting. That is the trade, and it's why it's a crew trick, not a free
    win.
  - Solo can chat, but nobody cleans, so it's pointless, which is honest.
- **The dealt line for extras** becomes "Keep Gary talking: hold Ⓐ!" (5 words) while he's parked, and "Stall Gary:
  ping his cart!" while he drives. Each line is true for the whole leg it's dealt on (A's ask, playtest 4).
- **Text.** The bottom prompt: "Hold Ⓐ: chat to Gary". Gary's side is a world speech bubble that cycles three-word
  bits ("…the 1987 audit…"). No PA, no centre text.
- **Q.** The chat ends if Gary leaves, the chatter is knocked down, or they walk away. The verdict is unchanged by
  stalls. The huddle ring and "Gary never runs over the huddle" are unchanged.

### 12 · Halve the cart's capacity on every tier — **Adopt** (→ #8)

- `cartCap` 300/600/600 → **150/300/300**.
- **Early.** A $600 cart that swallows 38–47% of a Muni shift in one load (N8) skips the walk-and-bank loop the layout
  just made visible. Halved, it's 4–5 trips to the return a shift. Each trip passes the crew bays (Hit the Cart) and
  the return's pipe show.
- **Late.** The wide reels hold 26% of a late Club shift. The second cart and the drones still carry the late field.
- **Adjustments.**
  - The hopper empties in 1.5 s at the return, so a trip costs driving, not waiting.
  - The jackpot ping clamps at the cap. Q to confirm it overflows nothing.
  - "Hopper full: drive to the ball return" is already the prompt.
- **E** re-runs the 4P ladder: the Club → Stadium pace must stay within +1 shift.

### 13 · Customers pick a random open mat, weighted toward clean ones — **Adopt** (→ #3)

- **Early.** "Show, don't tell." The muddy mat stays empty while the clean ones fill.
  - Weight = 1 − mud, and a mat at ≥ 0.9 weighs 0.
  - A customer waits at a mud line only when every free mat is ≥ 0.9.
  - With N4's cap, this turns refusals into **empty bays**, which you can see from the return.
- **Late.** Covered bays make it moot, which is fine.
- **Conflicts.**
  - At 4P every open mat is usually taken, so the weighting bites when mats free up.
  - "Every bay open" (item 10) and the 'wait' state still work.
  - Gary's mats stop reads the mats' mud, not who's on them.

### 14 · Introduce Gary as the Regional Manager before his first visit — **Adopt** (→ #7)

- **Early.**
  - **Day 4, at 0:20**, Gary's cart rolls in at the gate, he lifts his clipboard at the crew, and he drives out.
  - It comes with a **once-ever PA card**: **"Gary. Regional Manager. He has a clipboard."** (7 words). A first is a
    big event, so it fits the rare-PA call.
  - The memo waits for the card, as every memo does.
- **Fix on the way.** Day 3's tomorrow line is 13 words ("Tomorrow: Gary from Regional inspects. Clean everything,
  then huddle at the return."). It becomes **"Tomorrow: Gary from Regional. Clean, then huddle."** (7 words).
- **Late.** Nothing new.

---

## 1b. The three questions

**Q1 · Does the morning bucket job scale into the late game? What is the morning at the Stadium or the Orbital?**

On its own, no. Bucket demand is the same at every venue (N3), so the bucket machine ends it at the Club. The morning
keeps a beat through two things:

1. **The empty-basket morning survives automation.** The machine (6 a minute) takes the steady state, never the
   opening. Someone always fills the first few.
2. **The morning deal.** Every day, at every venue, the server deals each Rat one opening line from what is actually
   short, nearest first. It reuses the day-2 nudge code (`nudge.mjs`), sits in the nudge slot, and clears when done
   or after 45 s.

   | Where | What the morning deal draws from |
   | --- | --- |
   | Muni | "Fill the bucket basket!", the sign, the return, a mat over 0.3 |
   | Club | adds "Fries went cold. Peel!" (fries halve overnight, already) and "The pond's full. Dive!" |
   | Tiered | adds "The deck's open. Pour the first round!" (the first order) |
   | **Stadium** | **"Crowd's cold. Lap the Ping Track!"** (the crowd starts at 0.5 and decays; the gauge is live in BV, so a morning lap is ~+10% pay all morning) |
   | County | "Strays in the Yards. Sweep them!" |
   | **Orbital** | **"Debris overnight. Ride the Lift!"** (debris is saved overnight and is live in BV and the sky gate) |

   When automation removes a line (machine, conveyor, truck, drones, tether), that line just isn't dealt, and the
   venue's line takes the slot. A 4-Rat crew always splits at 0:00. That is the mirror of the Last Call deal, and the
   co-op moment the owner is after.

**Q2 · How should Ball Value be simplified so a new player gets it in one look, without losing the late-game KPI
gauges?** One big "$ A BALL", one bar (UPKEEP %, the average of the gauges; CLEAN at the Muni) with the target as a
percentage tick, and the gauges as its parts. The broken "+$/s · UPKEEP −$/s" strip is deleted (N1, item 1). The late
gauges keep their rows, and the venue gauge keeps its own 50% tick, which decides the stamp.

**Q3 · With the cleanup minute, where do Tiered's Glow Rush and the Stadium warning sit now?**

| Clock | Muni / Club / County | Tiered | Stadium |
| --- | --- | --- | --- |
| 2:00 | – | – | Two-Minute Warning (ALERT), unchanged |
| 1:30 | Last Call: horn, glow, ×3, the rally | **The Glow Rush** (cups ×2), rally "Glow rush! Shoot before they leave!" | Last Call horn, no line |
| 1:00 | Customers walk out; the cleanup deal if short; live "N left out there" | **Bowls judged** (padlock tick); the cleanup deal for Upkeep | Fans stay; laps still count; "Keep lapping!" if short |
| 0:00 | Bell, stamp, walk-off | Bell, stamp, walk-off | Bell (the 120 s mean ends here), stamp, walk-off |

---

## 2. What the owner-playtest-3 spec must say

The draft didn't exist when this was written. These are the council's requirements for it, numbered so the design
lead can tick them off.

1. **Ball Value (item 1).** Delete `board.js`'s "+rate/s" and "UPKEEP −upkeep/s" strip. The target shows as a
   percentage of the Upkeep bar, `q / (ceiling − 1)`. The Muni's bar is labelled CLEAN. The HUD line, the memo and
   the bv hint use the numbers in item 1. Test: the Muni day-2 target prints 60%, and the Club venue day 1 prints 35%.
2. **The cleanup minute (item 2).**
   - `LAST_CALL` = { SECS: 90, SWING: 3 }, plus a new `CLEANUP` 60. Customers leave at T−60; balls in the air still
     land.
   - Tiered reads `kpi` for the review at T−60.
   - The rally fires at T−90, and the re-check is at T−60 with margin 0.
   - The Stadium's `RALLY_AT` 120 is unchanged.
   - Re-run `endday.mjs` on the real rule. It must reproduce N5's table within ±1 seed.
3. **Mats overnight (item 3).** `morningMud` keeps each mat's mud, capped at `MAT_NIGHT_CAP` 0.6. Day 1 still starts
   clean. Covered bays' blurb becomes "Mats scuff half as fast."
4. **The basket (item 3).**
   - Empty each morning, holds 12, 1.5 s hold at the dispenser.
   - Early birds keep their buckets.
   - An empty basket reuses the mud wait (25 s, then refuse).
   - The silo is unlimited.
   - Bucket machine: Club, $400 base, 1 every 10 s.
   - The spec must name the prompt ("Hold Ⓐ: fill a bucket", 5 words) and keep it out of the centre.
5. **The morning deal (Q1).** Extend `nudge.mjs`'s day-2 deal to every morning with the pools in Q1. The checklist
   still takes precedence on day 1.
6. **Every bay open (item 10)** and **customers prefer clean mats (item 13)**, both Muni-tested at 1P and 2P.
7. **Crew gear (item 6).** Saves migrate to the highest personal level. Dive gear stays personal.
8. **Gary (items 11 and 14).** The chat stall shares a 12 s budget with pings. The day-4 intro is a once-ever PA. The
   day-3 tomorrow line is 7 words.
9. **Controls and sound (items 7 and 8).** L3 sprint, RT spray, the fullscreen suspect list, and the engine retune
   in item 8's numbers.
10. **Cart (item 12).** Halve `cartCap`, a 1.5 s unload, and a jackpot clamp. Re-run the 4P ladder.
11. **Words.** Every new `say()` line ≤ 8 words in `test/words.test.mjs`. The spec must list them all: the Gary PA
    caption, the rally and miss lines, the deal lines, the prompts.

---

## 3. Build this (ranked)

Ranked by fun per effort, for a casual crew of 4. **XS** < 1 hour · **S** an evening · **M** two evenings. **Core** =
edits `crew.mjs`, `main.js` or `sim.js`. Every item adds its tests to `node --test test/` and updates `game-design.md`
in the same commit.

| # | Item | Size | Why first |
| --- | --- | --- | --- |
| **1** | **Ball Value in one look**: delete the bad strip, one UPKEEP/CLEAN bar with a % target, the HUD, memo and hint (item 1, Q2) | S, `board.js`, `main.js` HUD line | The owner's most important. A label bug is costing understanding in every shift. |
| **2** | **The cleanup minute**: a 30 s ×3 glow rush, customers out at 1:00, a live "N left out there", the rally at 1:30 and the cleanup deal at 1:00; Tiered judged at 1:00 (item 2, Q3) | S, core (`tick`, `lastCall`), `tiered.mjs`, `rally.js` | The owner's end of the day, a new dash-for-the-last-balls moment, and the end of "On target, then DENIED". Keeps the Glow Rush's teeth (N5). |
| **3** | **Mats keep their mud (cap 0.6), and customers prefer clean mats** (items 3 and 13) | XS–S, `morningMud`, `customers.js` | Mud finally bites mid-shift without doubling the scuff. 0 morning refusals. Empty bays show the mess. |
| **4** | **The bucket basket, the bucket machine and the morning deal** (item 3, Q1) | M, core-light (`customers.js`, `nudge.mjs`, a basket view, a shop row) | The owner's morning job, and a 4-Rat split at 0:00 at every venue, early and late. |
| **5** | **The small-crew Muni lift**: "Open every bay" ($40, 1–3 Rats) and crew-wide carrying gear (items 10, 6, 4) | S, `sim.js` `SHOP`/`activeMats`, the save migration | +28–63% balls for the owner's own crew size; −$621 for a 4P crew. |
| **6** | **The Pressure washer row**: fan ×1.5, turbo ×2 (moved from amenities), foam cannon, the power-washing truck (item 5) | S (truck: M, later) | Upgrades the Muni's core job. The truck is the late game's hose. |
| **7** | **Gary: the day-4 introduction and the chat stall** (items 14 and 11) | S, `stepGary`, `nudge.js`, the Gary view | A's top ask (every Gary line true), C's ask (late Gary is a crew moment), and the Regional Manager gets a proper entrance. |
| **8** | **The pad-and-cart pack**: L3 sprint, RT spray, the fullscreen hunt, the engine retune, and the cart capacity halved (items 7, 8, 12) | XS each | The owner's console notes, all small. The cart cap needs a ladder re-run. |

**One text:**
- New centre text is the Gary PA caption, the Tiered rally and miss lines, and the "pick" deal line.
- Everything else is the nudge slot, the bottom prompt, the top edge or world text.
- No item stacks a second centre element.

**Xbox:** about 2 draw calls added in total: the basket `InstancedMesh` and Gary's speech bubble sprite. The live count
is DOM. The engine is Web Audio. The `?perf` p95 budget stays ≤ 20 ms on Edge.

**Votes:**
- G yes.
- E yes ("#2's ×3 and #5's prices are the money changes, all measured; re-run the ladder after #8's cart").
- M yes (dissent on dive gear recorded).
- L yes (dissent on the Tiered T−60 read recorded).
- T yes ("#4 is the only M; the rest are leaf or a few core lines").
- C yes on all ("#2's lock at 1:00: we'll see").
- Q yes ("the fullscreen hunt and the jackpot clamp before merge").

**7–0 on the list; 5–2 on the Tiered T−60 read.**

### Cut or rejected (so nobody re-litigates them)

- **First Call** (an opening rush at ×1.5/×2): +6–15% of balls, but it drains the new basket in the first minute and
  stacks a horn on the PA welcome (N2).
- **Full early-bird buckets**: +0–3% (N2).
- **Judging Tiered's bowls at the bell under the cleanup minute**: any TARGET after 1:00 scores 1.00 (N5).
- **A cleanup rush at ×1.5**: halves the dusk's glow balls (86 → 46).
- **Mats keep their mud uncapped**: 28–49 refusals and −25–35% cash by day 4 for a forgetful crew (N4).
- **New mats beyond 10**: they need a new mat line; the crew bays sit at x ±23.
- **Dive gear as a crew row**: deferred (item 6).
- **A Club fee cut**: no pace change in the bot at $1,500 base (N6); look again after playtest.

**Left alone on purpose:** the quota curves (they're simply shown as percentages), `QUOTA_KPI`, `CUP_FULL`, the
Glow Rush's ×2 cup weight, the Stadium's 120 s window, every venue fee, Gary's schedule (day 4, 43%), the deck's
fines, hard hats, and the endless prices.

---

## 4. What the next playtest must check

1. **Ball Value.** Ask a new player after day 2, with no hints: "What makes a ball pay more, and what does today
   want?" Goal: both answered in one sentence.
2. **The cleanup minute.**
   - The live count at 1:00 and at the bell.
   - Did anyone run for the last balls?
   - Tiered: when the last TARGET landed vs 1:00, and how often it passed. Goal: 4P crews that shoot in the rush pass
     ≥ 80%, and it can still fail.
3. **Mats.** Refusals a shift (goal 0 in the morning, a few mid-shift for a forgetful crew), and hose time a day.
4. **The morning.** Seconds to the first filled bucket, customers who left an empty basket (goal ≤ 1 a shift at 4P),
   and the morning deal: four different lines at 4P, every venue.
5. **Muni pace.** Shifts to the Club at 1P, 2P and 4P. Goals: 4–5 at 4P, ≤ 6 solo.
6. **Gary.** Chat stalls used, verdicts passed (≥ 75% from day 5 at 4P), and whether the day-4 intro was noticed.
7. **Cart.** Trips to the return a shift, and Club → Stadium shifts at 4P (≤ +1).
8. **Xbox Edge.** Sprint on L3, spray on RT, the report and shop on a pad end to end, never out of full screen, the
   engine at full throttle (ask: "still whiny?"), and p95 ≤ 20 ms at the basket with 12 buckets.
9. **One text.** Screenshots at 1:30, 1:00 and the bell, at Gary's intro, and at the morning deal. Never more than one
   centre element.
