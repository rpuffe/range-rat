# Owner playtest 3 (console): the buildable spec

This is the build spec for the owner's third playtest (2026-11-24, on PC and on Xbox in Edge, on the merged layout
build at 34b7ff0). It folds in the owner's notes and their follow-ups (a)–(i), and it follows **Fun Council round 9**
(`design/council-round9.md`) wherever the council decided. Where this spec goes further than the council, or differs
from it, the section says so and gives the numbers. Rounds 1–9 still bind wherever this spec doesn't change them.

**The owner's firm calls (binding):** multiplayer first (up to 6, balanced for 4, no assigned roles) · one day = one
shift · a ball that hits you knocks you down · scuba is fancy · no named balls · rare PA lines · the kitchen serves
fries, hot dogs and beer · the Tiered beer fall · the shop is open any time · Xbox controller, with Xbox Edge as the
performance floor · every feature is worth it · **one centre text at a time, about 8 words** · where the owner leaves
a choice open, pick what's more fun and easier for a casual crew of 4.

**Contents.** §0 the numbers · §1 Ball Value (the owner's most important point) · §2 the end of the day · §3 mats
overnight and the morning bucket job · §4 the early game and "Open every bay" · §5 upgrades (the pressure washer, crew
gear, shoes, the cart) · §6 Gary (introduction, schedule, chat, the huddle reward) · §7 controls and sound · §8 every
new line of text · §9 who builds what · §10 what the next playtest checks.

**The scripts.** Everything in §0 was measured headless with node against the real `Crew` (customers, mats, mud,
refusals, helpers, Gary all real). The scripts live in the scratchpad's `op3/`:

| Script | What it measures |
| --- | --- |
| `early.mjs` | Balls hit onto the field per minute in the first 2 minutes of a Muni shift, 4P and solo, days 2–6, seeds 1–6, nobody hosing |
| `buckets.mjs` | Buckets taken per minute, when the first basket bucket is needed, balls (and glow) per shift, and the end of the day's supply |
| `cart.mjs` | A greedy cart bot (straight lines, optimistic) on a real Muni shift: balls the cart banks at 300/600 vs 150/300 capacity |
| `ladder.mjs` (built by `mkladder.mjs`) | The round-8 whole-ladder bot with this spec's rules as env toggles; `runall.sh` gives the day of promotion to the Club for 1, 2 and 4 Rats, both buying policies (spend everything / save for the fee), seeds 7, 11, 23 |

They edit no game code. Rule variants run on a **patched scratch copy** of the layout worktree (`op3/rr/`, made by
`patch.mjs` and `patch2.mjs`, each rule behind an `OP3_*` env var). Main's playthrough-4 fixes (1929066) don't touch
any rule measured here, except solo Gary's two-mat inspection, which the ladder doesn't model.

---

## 0. What the numbers say

**M1 · Morning mud is what makes the early shift slow.** Today `morningMud` puts 5 random mats at 0.95 every morning,
over the 0.9 refusal line. About 4 of 10 mats sit idle until someone hoses them, and their customers wait 25 s, refuse
and leave again and again.

| Muni days 2–6, no ads, nobody hosing | 4P balls / min (first 2 min) | Solo | Refusals in the first 2 min (4P / solo) |
| --- | --- | --- | --- |
| Today | **44.0** (37.5–53) | **28.0** (16–38.5) | 8.3 / 4.7 |
| Mats keep their mud overnight, capped at 0.6 (council 9) | **76.7** (+74%) | **45.8** (+64%) | 0 / 0 |
| …and "Open every bay" (solo sees 10 mats, not 6) | – | **79.8** (+185%) | 0 |

**M2 · The day of promotion, before and after.** "Club after day N" means the Club opens on day N + 1. "Never" = no
promotion within 12–15 shifts (the bot doesn't hose enough to stamp under morning mud).

| Rule set (`runall.sh`) | Solo, spend / save | 2P, spend / save | 4P, spend / save |
| --- | --- | --- | --- |
| Today | never / never | never / never | 5 5 5 / 4 4 5 |
| **This spec** (council 9's shapes: mats ≤ 0.6, cleanup minute ×3, crew gear, "Open every bay", washer row, bucket job) | **5 5 5 / 5 5 5** | **4 4 5 / 4 4 4** | **5 5 5 / 4 4 4** |
| …with the one price (§1.4) | 5 5 5 / 4 4 4 | 4 4 4 / 4 4 4 | 5 5 5 / 5 5 5 (*) |
| …and a $2,000 Club fee | 5 5 5 / 4 4 4 | 4 4 4 / 4 4 4 | 5 5 5 / 4 4 4 |

(*) Noise at the fee line: seed 7 ends day 4 at $5,393 against a $5,500 fee, and $5,642 without the one price. The
one price is neutral at the Muni (day 2 +7%, day 4 −8%, both inside the run-to-run spread). The 4P "spend" bot stays
at day 5 under every rule because it buys the cart on day 3. The **Club fee stays $2,500** (council 9 §1.4); the
$2,000 row is the fallback if the playtest's 4P crews still need 6 shifts.

Day-by-day Muni income at 4P, seed 7 (today → this spec): day 1 $382 → $355, day 2 $1,684 → $1,759, day 3 $3,857 →
$4,604, day 4 $4,137 → $4,701. Solo: $57 → $62, $264 → $408, $647 → $2,681 (it stamps now). Day 1 dips 7% because
the crew saves $44 for one crew tube before its first upgrade, where four Rats each bought a $20 one.

**M3 · Buckets.** With mats that keep their mud, every open mat seats an early bird at 0:00 (10 at 4P, 6 solo). The
first customer who needs the basket arrives at 101 s (no ads) or 60 s (the blimp). Demand runs 0–4 buckets a minute
with no ads and peaks at **7.5–7.7 a minute** at 4P with the blimp, in waves, because the early birds' buckets run out
together. A 12-bucket basket plus the Club's machine (6 a minute) covers every wave.

**M4 · The cleanup minute costs ~10% of the customers' balls.** Muni day 5, mats ≤ 0.2, nobody picking:

| 4P, no ads | Balls a shift (value, glow) |
| --- | --- |
| Today (Last Call 60 s ×1.5) | 547 (736, 100 glow) |
| Glow from 1:30 at ×2, customers out at 1:00 | 473 (619, 64) |
| **Glow from 1:30 at ×3, customers out at 1:00** | **494 (661, 85)** |

Solo with the blimp: 649 (866) → 586 (780) at ×3. Council 9's `endday.mjs` found −6–8%. Both agree ×3 keeps the
dusk's glow and costs a tenth of the supply, which an active crew wins back by picking in a minute with no balls in
the air.

**M5 · Halving the cart's hopper costs nothing at the Muni.** `cart.mjs`, 4P, 4 seeds:

| Hopper | No ads: balls banked (unloads) | Blimp: balls banked (unloads) |
| --- | --- | --- |
| Caged 300 → **150** | 358 (3) → **359 (5)** | 609 (5) → **629 (6)** |
| Wide reels 600 → **300** | 376 (3) → **366 (4)** | 691 (4) → **693 (5)** |

The cart spends its shift chasing balls, not waiting to unload, so a half hopper just means 1–2 more trips to the
return. **No price changes.** The bot drives straight lines (it ignores the creek), so it flatters both sizes alike.

**M6 · Ball Value in numbers.** At the Muni, BV = $ a ball × (1 + 0.5 × how clean the grounds are), and the grounds
are 12 fixtures (the sign, the return, 10 mats). One filthy fixture costs `rate × 0.5 / 12` a ball: **$0.04** before
the washer, $0.05 with the one price, $0.10 with the hand washer. That's the floating "+$0.04 a ball" the owner asked
for, and it's true.

---

## 1. Ball Value in one look (the owner's most important point)

The owner: *"My ball value is not very clear for why that is, or why that's the mechanic… or the thing that's
pass-fail. All I see is a ball value, a plus something per second, and an upkeep is something else."*

**Decision (council 9 item 1, adopted in full): one big price, one bar, one target tick.** The Board's strip prints
`+$rate/s` and `UPKEEP −$upkeep/s`, which is a labelling bug: Rate is dollars a ball, not a second, and Upkeep is a
multiplier, not a cost (council 9 N1). The design underneath is already the owner's idea. The fix is presentation,
plus one simplification (§1.4) so the popups add up.

### 1.1 The Board (`web/js/board.js`)

Top to bottom, on the 1024 × 512 canvas:

1. **The big number: "$2.62 A BALL"** (`boardMoney(value)` + " A BALL"), where value = BV × Hustle × Gary's Seal
   (§6.4). It's what one ball pays right now. The small grey label "BALL VALUE" over it becomes **"EACH BALL PAYS"**.
   Hustle keeps its green "×1.25 HUSTLE" chip on the right. Gary's Seal adds a gold "×1.25 GARY" chip under it.
2. **The bar.** One bar replaces the old TARGET bar. At the Muni it's labelled **CLEAN**, from the Club **UPKEEP**
   (council 9's word). Its fill is `(upkeep − 1) / (ceiling − 1)`, which is the grounds' cleanliness at the Muni and
   the average of the unlocked gauges from the Club. It's printed as a percentage: **"CLEAN 62%"**.
3. **The target tick.** A red tick on the bar at `q / (ceiling − 1)`, labelled **"TARGET 60%"**. The Muni reads
   60% on days 2–4, 70% on day 5 and 80% from day 6. From the Club: 35% on venue day 1, 40%, 45%, 50%, then +2.5% a day
   to 70%. The round-6 crossing flash fires when the fill crosses the tick (the same event as BV crossing the dollar
   target).
4. **The why line**, under the bar, in the strip's old place: **"Clean grounds pay up to +50%"** at the Muni, **"Each
   gauge pays up to +50%"** from the Club. Both are 6 words or fewer.
5. **The fixture pips** (new, under the why line, at the Muni and the Club): one square pip each for the sign, the
   return and each mat in play, left to right as you see them from the return. Green at mud ≤ 0.34 (Gary's pass mark),
   amber up to 0.6, brown above. They're the "row of clean or dirty icons that light up per fixture" the owner
   suggested. They answer "what do I hose?" from across the yard. Labels: "SIGN", "RETURN", "MATS" in 15 px under
   their groups. From Tiered on, the pips give way to the fourth gauge row (there is no room, and the venue gauge
   matters more).
6. **The gauge column** (right) is unchanged, except CURB APPEAL becomes **GROUNDS**. The venue gauge keeps its white
   50% tick and its red fill in the rush, because it decides the stamp.
7. **BALLS OUTSTANDING** and the banner are unchanged. **Endless:** no target, so the bar shows without a tick, and
   the endless TODAY/YESTERDAY block is unchanged.

The redraw key gains the bar's percentage (whole %) and the pips' colours, so the canvas redraws only when one changes.

### 1.2 The HUD, the memo, the hint, the report

- **HUD line** (`main.js hud()`, built by a pure `bvLine()` in a new `web/js/bvtext.js` so node can test it):
  **"$2.62 a ball · 62% clean · need 60%"** (Muni), **"$30 a ball · 48% upkeep · need 40%"** (Club and up),
  **"$19,240 a ball · today $3.1M"** (endless). The "gear ×1.25 ✦" part of `round2.js hudLine()` goes (§1.4), and so
  does "BV". "PROMOTION READY" and "LAST CALL" stay.
- **The memo** (`crew.mjs memoText`): **"Today: 60% clean by the bell."** (6 words). The memo's `target` field
  carries the percentage. On a Gary day: **"Gary visits today. 60% clean by the bell."** (8 words, §6.2).
- **The day-2 hint** (`settings.js HINTS.bv`): **"A ball pays more the cleaner it is."** (8 words, both kb and pad).
- **The report** (`main.js showPhase`): "QUOTA HIT · BV $2.62 / $2.50" becomes **"QUOTA HIT · Clean 64% · needed 60%"**
  (Club and up: "Upkeep 41% · needed 40%"). The bonus and the gauge row are unchanged. Playthrough 4's green-when-passed
  colouring moves to the percentage.

### 1.3 Show what moves it, in the world

- **"+$0.05 a ball" over a fixture** when your spray makes it Spotless. The server's `spotless` event gains `gain`:
  `cents(value.rate × hustle × seal × 0.5 × washFrom / FIXTURES.length)`, where `washFrom` is the fixture's mud when the
  current hosing run on it began (`this.washFrom[id]`, set on the first wash after it was last Spotless, cleared on
  Spotless). The client floats it with `board.floatText` over the fixture, green, for the hoser only (others see the
  pip turn green). It is world text, not centre text. Under $0.01, no float.
- **The bank popup reads "8 × $2.62"** (`payfloat.js` + `main.js floatPay`), using the event's `per` (cash now ÷ balls).
  With a washer holding part of it: **"8 × $1.31 + wash"**, the "+ wash" in the washer's blue. Muddy boots (grime > 0):
  "8 × $2.10 · muddy boots". The roll-up over the return keeps "+$1,240 · 31".

### 1.4 The one price (this spec's addition; the council didn't rule on it)

Today a ball's pay is BV × Hustle × a hidden gear factor: **×1.25 for a clean Rat** (`gearGrimeFactor(0)`), ×1.0 to
×1.25 for the cart by its mud, and ×1 for teenagers, drones, the night crew, gutters and the tether. Grime only comes
from knockdowns, so almost every Rat bank pays 25% more than the Board says, and "8 × $2.62" would never add up.

**Decision: fold the clean-kit 25% into the price, so a clean carrier gets exactly the Board's number.**
- `ballValue`: rate × **`SIM.CLEAN_KIT` 1.25**. BV, the target and the Board all read 25% higher (the Muni's day-1
  "$1.25 A BALL"). Targets are judged as Upkeep, so the stamps are unchanged.
- `gearGrimeFactor(g)` = `1 − 0.2 × g / 3` (1.0 clean → 0.8 at 3 layers). `cartGearOf(c)` = `1 − 0.2 × mud` (0.8
  filthy). For a Rat and the cart the money is identical to today.
- Teenagers, drones, the night crew, gutters and the tether **now pay the full price: +25%** for automation. That's
  the only money change, and it lands where the owner wants help (M2: neutral to slightly positive at the Muni).
- Text: the cart's Spotless toast becomes "Spotless! The cart pays full price again." (7 words).
- If the owner prefers not to touch the money: drop §1.4 and keep the popup as "8 balls · +$26.20". The Board is
  unaffected either way.

**Files.** `web/js/board.js`, new `web/js/bvtext.js` (pure: `bvLine`, `targetPct`, `pipColour`, `popupLine`),
`web/js/payfloat.js`, `web/js/main.js` (hud, floatPay, the report row, the spotless float), `web/js/round2.js`
(`hudLine` loses gear), `web/js/sim.js` (`CLEAN_KIT`, `gearGrimeFactor`, `cartGearOf`), `server/crew.mjs`
(`memoText`, the `spotless` gain, `washFrom`), `web/js/settings.js` (the bv hint).

**Tests.**
- `test/bvtext.test.mjs` (new): the Muni day-2 target prints 60%, day 5 70%, day 6 80%; the Club's venue day 1 prints
  35%; `bvLine` for the Muni, the Club and endless; `popupLine` with and without a washer and with grime; a pip at
  0.34 is green, 0.35 amber, 0.61 brown.
- `test/sim.test.mjs`: with `CLEAN_KIT`, a clean Rat's `payFor` equals n × value; a grime-3 Rat's is 0.8 × that; the
  stamps of a seeded 4P Muni days 2–5 are unchanged by the fold.
- `test/economy.test.mjs`: a helper's bank is 1.25 × today's.
- `test/words.test.mjs`: the memo, the hint, the cart toast.
- `test/seam.test.mjs`: the fingerprints move with the price (re-record; one cause: put `CLEAN_KIT` back to 1 and the
  old cash comes out).

**Effort.** S (the Board and HUD), XS (the fold).

**One text / Xbox.** No new centre text: the Board and the floats are world text, the HUD line is the edge. The pips
are canvas pixels on the existing texture; the redraw stays at most ~10 Hz and only on a change. No new draw calls.

---

## 2. The day's rhythm at the end: glow at 1:30, customers out at 1:00, a cleanup minute

**Decision (council 9 item 2 and Q3, adopted):**
- `LAST_CALL = { SECS: 90, FROM_DAY: 2, SWING: 3 }` and a new **`CLEANUP` 60**. From T−90, customers hit glow balls at
  ×3 for 30 s. At **T−60** every customer finishes the ball in the air and walks out through the gate on the existing
  'closed' leave route (`stepMat` with `open: false`). No customer ball is launched after T−60. Glow balls stay worth ×2.
- **Mats stop scuffing at T−60** (there's nobody on them), so hosing in the last minute sticks. `UPKEEP_MARGIN` drops
  to 0 for the cleanup deal, because nothing scuffs after it.
- **The live count.** From 1:00, the walk-off's "N left out there" label shows on the top edge and counts down as the
  crew picks: the cleanup minute's scoreboard. The walk-off shows the final number as today.
- Day 1 (training, 240 s) has neither Last Call nor the cleanup minute, as today.

**The timeline, per venue** (the clock shows time left):

| Clock | Muni · Club · County | Tiered | Stadium | Orbital |
| --- | --- | --- | --- | --- |
| 2:00 | – | – | Two-Minute Warning (ALERT, rally, `RALLY_AT` 120 unchanged) | – |
| 1:30 | **Last Call:** horn, glow ×3, the rally (dealt) | **The Glow Rush:** cups ×2, rally "Glow rush! Shoot before they leave!" | Last Call horn, no line | Last Call horn, the debris line if short |
| 1:00 | Customers walk out. **The cleanup deal** if short (re-check, margin 0); live count | **Bowls judged** (the purple bar freezes with a padlock tick); the cleanup deal for Upkeep | Fans stay, laps count; "Keep lapping!" if short | Orbit shots stop with the customers; debris stops growing |
| 0:00 | The bell, the stamp, the walk-off | Same | Bell (the 120 s mean ends here) | Bell; `SKY_HOLD_SECS` 90 unchanged |

- **The rally** moves with Last Call to T−90. The 30 s re-check becomes the cleanup deal at T−60. That's still two
  lines in the last 90 s, as today in the last 60. `dealJobs` gains a **'pick'** job, "Grab the last balls!" (4 words),
  when the live count is over 30.
- **Tiered** reads `kpi` for the review at T−60 ("the last customer out reads the bowls"; `tiered.mjs` stores
  `kpiAtClose`, and `mods.kpi()` returns it after T−60). Miss line: "Missed: the bowls were full at 1:00." (7 words).
  "Saved by Cy's TARGET at 1:04." (`savedLine`) keeps working. Council 9 N5: a TARGET at 1:05 passes 6/6, at 1:15 3/6.
- **The Stadium.** The crowd is fans, not customers, so the gauge runs to the bell and a cleanup lap counts.
- **The bell, Gary, the walk-off** are untouched. Gary inspects at 43% of the shift, far from the end.
- **Endless** runs the same rule. The cleanup minute is where effort beats yesterday.

**Files.** `web/js/sim.js` (`LAST_CALL`, `CLEANUP`), `server/crew.mjs` (`lastCall()`, a new `closing()`, `tick`'s
customer and scuff loop, the rally timing), `web/js/customers.js` (nothing new: 'closed' already exists),
`server/venues/tiered.mjs` (`kpiAtClose`), `web/js/tiered.js` / `views/tiered.js` (the padlock tick),
`web/js/rally.js` (the lines, 'pick', margin 0 at T−60), `web/js/duskview.js` (the live count from 1:00).

**Tests.**
- `test/crew.test.mjs`: no customer ball after T−60; glow from T−90; swing gap ÷3 in the rush; mats don't scuff after
  T−60; every customer is 'leave' by T−60 + `LEAVE_HOLD`.
- `test/tiered.test.mjs`: the review reads the T−60 gauge; a TARGET at T−50 doesn't change the stamp; a seeded 4P
  shift with a TARGET at T−65 passes, with none fails.
- `test/rally.test.mjs`: the rally at T−90, the re-check at T−60 with margin 0, 'pick' over 30 balls; the Stadium
  warning still at T−120.
- `test/words.test.mjs`: the new lines. Re-run council 9's `endday.mjs` on the real rule: within ±1 seed of N5.

**Effort.** S, core-light.

**One text / Xbox.** The rally and the cleanup deal are the existing dealt ALERT. The live count is top-edge DOM. Glow
balls use the existing glow material. No new draw calls.

---

## 3. Mats overnight, and the morning job: stock the bucket basket

### 3.1 Mats keep their mud overnight (council 9 item 3, adopted)

- `morningMud` keeps each mat's mud, **capped at `MAT_NIGHT_CAP` 0.6** ("the night crew knocks the worst off"). The
  sign (0.9) and the return (0.5) still get their morning mud: they're Gary's stops and a quick morning hose. Day 1
  still starts with clean mats. The 5 random 0.95 mats are gone.
- **Mats get dirty only during the day:** 0.006 a customer swing (×0.5 under covered bays), never in the cleanup
  minute. A mat hosed in the cleanup minute opens clean, which is exactly what the owner asked for.
- Fixtures go in the save (`fixtures`, optional key). An old save without it loads with today's morning.
- **Covered bays'** blurb becomes "Mats scuff half as fast. The members approve." It is the Club amenities row's only
  tier now (§5.1).
- M1: +74% balls in the first two minutes at 4P, +64% solo, 0 morning refusals. A forgetful crew gets 2–8 refusals
  late in the shift (council 9 N4), which is the mid-shift bite round 8 couldn't find.

### 3.2 Customers pick a clean mat (owner note c; council 9 item 13, adopted)

- Today each open mat calls its own next customer, so the customer heads to that mat however muddy it is. Now an
  arriving customer **picks among the free open mats** (no incoming customer, free or about to be), weighted
  **1 − mud**, and a mat at ≥ 0.9 weighs 0.
- A customer heads for a ≥ 0.9 mat (and waits there, as today) **only when every free open mat is ≥ 0.9**. Otherwise
  the muddy bay just stays empty, which you can see from the return.
- The supply is unchanged: each free mat still triggers one arrival, and only the destination is chosen.
- `customers.js` gains a pure `pickMat(mats, i, ctx)` used by `stepMat`'s arrival block, with the RNG from `ctx`. The
  coordinator's suggested weights (1 under 0.5, 0.15 when muddy) were replaced by the council's 1 − mud: same intent,
  one formula.
- **The seam goldens move** (`test/seam.test.mjs`): the RNG draws and which mat each customer takes both change. Re-record
  with one cause: with `pickMat` returning the triggering mat, the old fingerprints come out.

### 3.3 The bucket basket (owner note 3; council 9 item 3, adopted with the details filled in)

**The rule.**
- **The basket** by the red BUCKETS dispenser (`layout.js BASKET`) **starts every morning empty** ("the night crew
  doesn't do buckets") and holds **12**. Its heap of blue buckets is the readout (one `InstancedMesh`, 12 slots).
- **Early birds bring their own buckets**, so every open bay is busy at 0:00. The basket feeds the second wave, which
  starts at 1:00–1:40 into the shift (M3). That's a soft morning deadline, not a dead first minute.
- **Filling:** a Rat stands at the dispenser's side (`layout.js FILL_POINT`, 1.2 m east of the dispenser, so they
  never stand in the customers' spot) and **holds Ⓐ** (Click / Space): 30 balls rattle in over **1.5 s** and the bucket
  drops into the basket. Keep holding to fill the next. The dispenser has **two chutes**, so two Rats fill at once.
  A third Rat gets the prompt "Both chutes busy" (3 words).
- **Where the balls come from: the silo, which never runs dry.** Fairway Holdings has 4 billion of them. The silo's
  fill drops a little for each bucket and rises with each bank (cosmetic: `silo = clamp(400 + banked − 30 × filled)`).
  The owner's other option, banked balls only, was rejected: day 1 would open with nothing to fill from, and a short
  silo would starve the customers who make the money, which can softlock a struggling crew.
- **If nobody fills:** a customer who reaches an empty basket waits there (the mud wait reused: 25 s, arms crossed,
  facing the machine), then leaves. The same `refuse` event fires, with `why: 'nobucket'`. Feed line: "No buckets. A
  customer left." Their mat stays free for the next arrival. Nothing else breaks: the shift just runs out of customers
  as the early birds finish.
- **Prompts** (bottom, never centre): "Hold Ⓐ: fill a bucket" (5 words; "Hold Click" on a mouse) · "Basket full" when
  it holds 12.
- The server owns `this.basket = { n, fill: { ratId: secs } }`, snapshot `basket: n`. `customers.js` takes a
  `takeBucket()` callback in `ctx` and stays pure.

**How it scales by venue.** Bucket demand is the same at every venue (same 10 mats), so the job doesn't grow; the
machine takes it over, and the morning keeps its beat through the empty basket and the morning deal (§3.4).

| Where | Bucket | Basket | Who fills |
| --- | --- | --- | --- |
| Muni | 30 balls | 12 | the crew, by hand |
| Club and up | 40 balls | 12 | **Bucket machine** (crew row, Club, **$400 base**, ≈ $880 at 4P): **1 bucket every 10 s** into the basket. It covers any steady state (peak 7.7 a minute at 4P with the blimp, buffered by 12) but not the empty morning, so someone still fills the first few |
| Stadium and up | 40 | 12 | the same machine; its top look is "a bucket vending wall the size of a building" (cosmetic, same rate) |

**The shop row** (`sim.js SHOP`, new id `bucket`, `minVenue: 1`): "Bucket machine": "Fills a bucket every 10 s. It
hums. Nobody knows the tune." One tier. At the Muni it's hidden, like every Club row.

### 3.4 The morning deal: something to do at 0:00 once automation exists (council 9 Q1, adopted)

Every morning, at every venue, the server deals each Rat one opening line from what is actually short, nearest first.
It reuses the day-2 deal (`server/venues/nudge.mjs`, `web/js/nudge.js`), sits in the nudge slot, and clears when done
or after 45 s. Day 1's checklist still takes precedence.

| Where | The pool (only what's short is dealt) |
| --- | --- |
| Muni | "Fill the bucket basket!" (no machine) · the sign · the return · a mat over 0.3 |
| Club | adds "Fries went cold. Peel!" · "The pond's full. Dive!" |
| Tiered | adds "The deck's open. Pour the first round!" |
| Stadium | "Crowd's cold. Lap the Ping Track!" |
| County | "Strays in the Yards. Sweep them!" |
| Orbital | "Debris overnight. Ride the Lift!" |

With the machine bought, "Fill the bucket basket!" is still dealt on the empty morning (the machine needs 2 minutes to
fill 12), then never again that day. When automation removes a line (machine, conveyor, truck, drones, tether), it
just isn't dealt. A 4-Rat crew always splits at 0:00, the mirror of the Last Call deal.

**Files.** `server/crew.mjs` (`morningMud`, the save's `fixtures`, `basket`, the `fill` input, the snapshot),
`web/js/customers.js` (`pickMat`, the bucket wait), `web/js/layout.js` (`FILL_POINT`, basket slots),
`web/js/ballreturn.js` (the basket's buckets, the chute animation), `web/js/sim.js` (`MAT_NIGHT_CAP`, the `bucket`
row, covered bays' blurb), `server/venues/nudge.mjs` + `web/js/nudge.js` (the morning deal), `web/js/main.js` (the
prompt, Ⓐ at the dispenser).

**Tests.**
- `test/customers.test.mjs`: `pickMat` never picks a ≥ 0.9 mat while a cleaner free mat exists; picks one when all
  are ≥ 0.9; a customer at an empty basket waits 25 s then refuses with `why: 'nobucket'`; one bucket in the basket
  lets exactly one through.
- `test/crew.test.mjs`: mats keep their mud overnight, capped at 0.6; the sign is 0.9 and the return 0.5 each morning;
  day 1's mats are 0; fixtures survive `toSave` / load; the basket is 0 every morning; a 1.5 s hold fills one; a third
  filler is refused; the machine adds one every 10 s up to 12.
- `test/dealt.test.mjs`: the morning deal gives 4 different lines to 4 Rats at the Muni day 3 with a dirty sign and
  an empty basket; the Stadium deals the lap line; no basket line with the machine after the basket reaches 12.
- `test/layout.test.mjs`: `FILL_POINT` is within reach of the dispenser and 1 m or more from `BASKET_POINT`.
- `test/seam.test.mjs`: re-record (the mats' morning, `pickMat` and the basket; one cause each).

**Effort.** M (the basket, the machine and the deal), XS (mats), XS (`pickMat`).

**One text / Xbox.** The deal and the prompts are the nudge slot and the bottom line. The basket is one
`InstancedMesh` (12 slots, +1 draw call), the dispenser's chute animation reuses the pipe-ball pool.

---

## 4. The early game, and "Open every bay" (owner note 4 and follow-up e)

The owner: *"Day 6 and still on the basic round"*, and later *"we absolutely need to be able to add more bays in as an
upgrade through the first section, or be able to hit more balls, because I'm having a hard time getting to the next
level."*

**What's slow, from the numbers.** Not the cart, and not the fee (M2: a $2,000 fee moves only one case). It's the
morning mud (M1: four idle bays every morning at 4P) and, for a small crew, `activeMats` (4 + 2 × Rats: a solo Rat sees
6 of 10 mats, a pair 8). Together with two minutes of hosing a day, that's the "basic round" feeling (council 9 N6).

**Decision.** Keep the cart's pace. The levers, all measured in M1–M2:
1. **Mats keep their mud overnight** (§3.1): +74% balls in the first two minutes at 4P, +64% solo.
2. **"Open every bay"** (council 9 item 10): a Muni crew row from **day 2**, **$40 base**, one tier: every mat is in
   play whatever the crew size. Solo +74% on top (45.8 → 79.8 balls a minute), 2P +28%. At 4+ Rats every mat is already
   open, so the row hides. Blurb: "Every bay open, however many of you there are." From the Club on, small crews keep
   `activeMats(N)` (council 9: the stamps set the pace there). The shop shows the row as owned at the Muni and doesn't
   list it at the Club.
3. **Crew-wide carrying gear** (§5.2): a 4P crew pays $759, not $1,380.
4. **Customers prefer clean mats** (§3.2) and **the pressure washer row** (§5.1) cut hosing time.
5. **Rejected with numbers:** a "First Call" opening rush (+6–15%, but it drains the new basket and adds a horn next to
   the PA welcome; council 9) and full early-bird buckets (+0–3%).

**Result (M2):** solo reaches the Club after day 5 (today: never within 12 shifts), 2P after day 4–5 (never), 4P after
day 4 when it saves for the fee and day 5 when it buys the cart early (today 4–5 and 5). Goal for the playtest: 4P in
4–5 shifts, solo in ≤ 6.

**Files.** `web/js/sim.js` (`activeMats(players, up, venue)`, the `bays` row with `minDay: 2`, `maxVenue: 0`,
`shopShows` hides it at 4+ Rats), `server/crew.mjs` (pass `up` and venue to every `activeMats` call: the customer loop,
`openMats`, Gary's mats stop, `muddiestMats`).

**Tests.** `test/shop.test.mjs`: the row shows at the Muni from day 2 for 1–3 Rats, hides at 4, never shows at the Club;
`activeMats(1, {bays: 1}, 0)` is 10 and `activeMats(1, {bays: 1}, 1)` is 6. `test/pacing.test.mjs`: a seeded solo Muni
with the row bought on day 2 hits ≥ 70 balls a minute in the first two minutes of day 3.

**Effort.** XS.

**One text / Xbox.** None.

---

## 5. Upgrades

### 5.1 The pressure washer gets its own row (council 9 item 5, adopted)

A crew row, **Pressure washer** (`sim.js SHOP`, id `wand`), right after the Ball washer row:

| Tier | Where | Base price (×2.2 at 4P) | What it does |
| --- | --- | --- | --- |
| Garden-hose nozzle | – | – | Today's wand: 0.08 mud a second on a fixture (×1.6), 7 m reach |
| **Fan nozzle** | Muni day 2 | **$40** ($88) | Cleans **×1.5**. "A wider spray. Same tiny engine." |
| **Turbo nozzle** | Muni day 4 | **$150** ($330) | Cleans **×2** and reaches **9 m**. Moved here from Club amenities. "Corporate approved this nozzle after a brief incident." |
| **Foam cannon** | Tiered | **$20,000** ($44,000) | Cleans ×2, and **every fixture in a 2 m cone** at once: sweep a row of mats in one pass |
| **The power-washing truck** | Stadium | **$300,000** ($660,000) | The cart gets a hose: whoever drives sprays every fixture within 3 m it passes, at ×2. Hosing becomes driving. Built later (M) |

- `perks.turbo` becomes **`perks.washRate`** `[1, 1.5, 2, 2, 2]`, **`perks.washReach`** `[7, 7, 9, 9, 9]`,
  `perks.foam` (tier ≥ 3), `perks.truck` (tier 4). `crew.wash()` uses them. Spraying a crewmate's boots and the cart
  use the same rate.
- Numbers (council 9): a day's Muni hosing is 100–140 s at ×1, 64–95 s at ×1.5, 48–72 s at ×2.
- **Club amenities** keep one tier: Covered bays ($8,000).
- **Save migration** (`cleanUpgrades`): `amen` 1 (the turbo) → `wand` 2, `amen` 0; `amen` 2 → `wand` 2, `amen` 1.
- The foam cannon draws its cone with the existing spray points (no new mesh); the truck's hose reuses the wand's spray
  from a nozzle on the cart's cage.

### 5.2 Movement speed and carrying capacity for every player (council 9 item 6, adopted)

- **Shoes are already a crew row** (`up.shoes`, `perks.walk`). Only the words change: the row is **"Crew shoes"**
  ("Everyone walks 15% faster", 30%, 45%).
- **Carrying gear becomes one crew row**, "Crew carrying gear", at the catalog price × the crew scale: **tube $20,
  bucket $75, push picker $250 base** ($44 / $165 / $550 at 4P). One purchase upgrades every Rat, late joiners too.
  A 4P crew pays $759 instead of 4 × $345 = $1,380 (council 9 N7). Solo pays the same as today.
  - `personal: true` goes from the row; `up.gear`; `gearPerks(up.gear)` for everyone (`p.gear` stays on the wire as a
    copy, so views and the HUD don't change).
  - Today a new Rat at the Club gets a free bucket (tier 2). That becomes a floor: at venue ≥ 1, `up.gear` ≥ 2.
  - Teenagers still use "the crew's gear, up to a bucket".
  - **Existing saves:** `up.gear = max(up.gear ?? 0, …Object.values(gearByName))`, so nobody loses gear. `gearByName`
    is read for that one migration and no longer written.
  - The "Buy something" checklist step names the real cheapest price, which may now be the $44 tube.
- **Dive gear stays personal** (council 9: scuba is fancy, and only one or two dive at a time). M's dissent is recorded
  there.
- **Hard hats:** left alone (the owner's call).

### 5.3 The cart carries half (owner follow-up g; council 9 item 12, adopted)

- `cartCap` `[0, 300, 600, 600]` → **`[0, 150, 300, 300]`** (the caged cart, the wide reels, the second cart). Blurbs:
  "Holds 150" and "holds 300".
- **The hopper empties over 1.5 s** at the return (a tipping animation on the cart; the bank lands at the end), so a
  trip costs driving, not waiting.
- **The jackpot clamps at the cap:** it hoovers balls within 15 m only until the hopper is full; the rest stay on the
  ground.
- **Prices unchanged:** M5 shows the cart banks the same balls a shift with half the hopper (358 → 359 caged, 376 →
  366 wide; 1–2 more unloads). E re-runs the 4P ladder after merge: Club → Stadium must stay within +1 shift.

**Files (5.1–5.3).** `web/js/sim.js` (the `wand`, `gear`, `shoes`, `amen`, `cart` rows and `perks`), `server/crew.mjs`
(`wash`, `buy`, `cleanUpgrades`/`cleanGear` migration, `join` gear floor, `unloadCart` timing, `ping` jackpot clamp),
`web/js/main.js` (`gp` from `up.gear`; the spray reach), the wand/foam/truck visuals in `web/js/washer.js` or a new
`web/js/views/truck.js`.

**Tests.** `test/shop.test.mjs`: the wand row's tiers, days and venues; amenities has one tier; gear is crew-priced
(×2.2 at 4P) and one buy lifts every Rat; a late joiner gets the crew tier. `test/sim.test.mjs`: `washRate` and
`washReach` per tier. `test/crew.test.mjs`: the amen→wand and gearByName→up.gear migrations; a foam spray cleans two
mats 1.5 m apart at once; the cart stops scooping at 150; the jackpot never overfills; an unload banks after 1.5 s.

**Effort.** S (the wand row, without the truck), XS (gear and shoes), XS (the cart), M (the truck, later).

**One text / Xbox.** Shop rows and blurbs only. The foam cone reuses the spray points; the truck is a later item.

---

## 6. Gary from Regional: who he is, when he comes, and why the crew should care

### 6.1 Introduce him (owner follow-up d; council 9 item 14, adopted with a nameplate)

- **The eve:** the day-3 report's tomorrow line is **"Tomorrow: Gary from Regional. Clean, then huddle."** (7 words;
  it was 13).
- **The morning of his first visit (Muni day 4):** the memo is "Gary visits today. 60% clean by the bell." (§6.2).
- **The drive-by, at 0:20 on that day, once ever:** Gary's white cart rolls in at the gate, loops past the return, he
  lifts his clipboard at the crew, and he drives out. With it, the **once-ever PA card: "Gary. Regional Manager. He has
  a clipboard."** (7 words; the voice can say more). The memo waits for the card, as every memo does. `voiced` gains
  `garyIntro`.
- **A nameplate over his cart** (world sprite, like the floats): "GARY · REGIONAL MANAGER" on his first visit day,
  "GARY" after. Every later line just says "Gary".
- The warning ALERT stays "Gary's coming: clean up, then huddle." (playthrough 4).

### 6.2 He doesn't come every day (owner follow-up i; this spec's call)

- **The schedule:** his first visit is Muni day 4 (the intro day). After each visit, the next one is **2 days later,
  or 3 with a 1-in-3 chance** (seeded from the crew's RNG), so he comes every 2–3 days, about 4 days in 10. A visit
  that falls on a venue's first day (the reveal) slips to its second day. No visits in endless, as today.
- `this.garyDay` (the global day of the next visit) is saved. An old save without it gets `garyDay = day` (from day 4),
  so nobody loses their next inspection.
- **The crew knows in the morning:** on a visit day the memo is **"Gary visits today. 60% clean by the bell."** (8
  words). On the eve the report's tomorrow line is **"Tomorrow: Gary visits. Clean, then huddle."** (6 words). The
  Board's banner reads **"GARY VISITS TODAY"** until his warning takes over with the countdown. On other days nothing
  mentions him.
- **Why every 2–3 days:** a daily Gary is a chore, and the owner wants a plannable event. To keep the rewards paying
  with fewer visits, **a passed visit with a full huddle earns 3 commendations** (was 2; cap 10), a pass without it 1.
  At about 4 visits in 10 days, a crew that huddles reaches the cap around Club day 4–5 (today Club day 3). The Seal
  (§6.4) pays on every visit day, cap or no cap.
- Gary's visit time (43% of the shift), the solo warning (60 s, two mats) and the stop list are unchanged.

### 6.3 Stall him by chatting (owner follow-up f; council 9 item 11, adopted)

The owner asked for interact (E / Ⓧ) and a 15 s cap. **The council chose Ⓐ and a 12 s budget shared with the cart
pings; this spec follows the council.** Ⓧ is the return's bank button, and Gary's stand stop is right behind the Board,
where Ⓧ banks.

- **Who and when:** a Rat within **2.5 m** of Gary **while he's parked** (at a stop, at his warning spot, or at the
  stand) **holds Ⓐ** (Click / Space). His pause grows while they hold. Within 2.5 m of Gary, Ⓐ chats before it picks up.
- **The budget:** **12 s a visit, shared** with round 8's cart pings (each still 3 s). `GARY.STALL_BUDGET` 12;
  `g.stalled` counts both. A ping past the budget is the old "DING. Gary has noted your enthusiasm."
- **The trade:** the chatter can't hose or carry while chatting. That's why it's a crew trick: one talks, three clean.
  Solo can chat, but nobody cleans, which is honest.
- **It ends** when the chatter lets go, walks out of 2.5 m, is knocked down, the budget runs out, or Gary isn't
  parked. When it ends he waits 1 s ("Right, then.") before he moves, and he never runs over the Rat he was talking to.
- **The dealt line for extras:** "Keep Gary talking: hold Ⓐ!" (5 words) while he's parked, and "Stall Gary: ping his
  cart!" while he drives. The owner's "Go chat with Gary!" is the same line; the council's version names the button.
- **The exchange (no centre text):** the bottom prompt is "Hold Ⓐ: chat to Gary". Gary answers in a **world speech
  bubble** over his cart that cycles three-word bits every 2 s while you hold: "…the 1987 audit…", "…my boat, mostly…",
  "…lovely mats, really…", "…Regional has concerns…", "…anyway, the clipboard…". The chatter's own line, as their
  feed line: "You asked Gary about his boat." A 12 s chat is six bits. No PA, no centre text.
- The verdict ignores stalls. The huddle ring and "Gary never runs over the huddle" are unchanged.

### 6.4 A real reward for a full huddle: Gary's Seal (owner follow-up h; this spec's call)

Today a full huddle only doubles commendations, which cap at 10 by about Club day 3, so after that it pays nothing.

- **The rule:** when Gary's verdict is a pass (≤ 1 failed stop) **and every online Rat is in the huddle ring**, the crew
  gets **Gary's Seal: every ball pays ×1.25 until the bell.** It's a separate factor (`this.seal = 1.25`, reset each
  morning), so it stacks with Hustle and ignores the Hustle cap, and it doesn't touch Upkeep, so the review is
  unaffected. Commendations still count (§6.2).
- **Why this and not cash:** it shows on the one number the crew reads (§1.1: "$3.28 A BALL" with a gold "×1.25 GARY"
  chip), it scales with the venue for free, and it never caps. It lands at ~60% of the shift, so it rides over Last Call
  and the cleanup minute: about **+10% of a visit day's income** (the Seal covers ~38% of the day's banks).
- **The line:** the verdict ALERT on a sealed huddle is **"Gary approves! ×1.25 a ball till the bell."** (8 words).
  A pass without a full huddle keeps "Gary approves. +1 commendation." The report gains a row: **"Gary's Seal: +$1,240"**
  (the extra the Seal paid, `stats.sealCash`). Gary salutes, as today.

**Files.** `web/js/sim.js` (`GARY.STALL_BUDGET`, `CHAT_R` 2.5, `SEAL` 1.25, `GAP`), `server/crew.mjs` (`stepGary`: the
intro drive-by, `garyDay`, the chat, the shared budget, the Seal and `sealCash`; `valueNow` × seal; `startShift`'s memo;
`tomorrowText`; the save), `web/js/nudge.js` + `server/venues/nudge.mjs` (the parked/driving extras' lines),
`web/js/pa.js` (`garyIntro`), the Gary view in `main.js` (the nameplate, the bubble, the drive-by route),
`web/js/board.js` (the chip, the banner), `web/js/round2.js` (the report row).

**Tests.**
- `test/garystall.test.mjs`: holding Ⓐ within 2.5 m while he's parked adds pause; 12 s of chat, then nothing; a ping
  after 10 s of chat adds 2 s, not 3; chat while he drives does nothing; the chat ends on a knockdown; he never runs
  over the chatter.
- `test/round2.test.mjs`: the intro drive-by fires once ever on day 4 at 0:20 with the PA; the day-3 tomorrow line;
  visits on day 4, then 2–3 days apart over 30 seeded days; never on a venue's day 1; the visit memo and the eve line;
  an old save gets `garyDay`.
- `test/onboarding.test.mjs`: a passed full-huddle verdict sets the Seal, value × 1.25, Upkeep unchanged, 3
  commendations; a pass without the huddle: no Seal, 1; the Seal resets each morning; `sealCash` adds up.
- `test/words.test.mjs`: every new line.

**Effort.** S (the intro and the schedule), S (the chat), XS (the Seal).

**One text / Xbox.** The intro PA is the one centre item, and the memo waits for it. The bubble and the nameplate are
world sprites (+2 draw calls near Gary, only while he's on site). The Seal's line replaces the verdict ALERT, never
stacks on it.

---

## 7. Controls and sound

### 7.1 Spray on Right Trigger (owner note 6; council 9 item 7, adopted)

- **While you hold the wand, RT sprays** (`pad.rt` > 0.35 starts, < 0.2 stops; analog, no hysteresis glitches).
- **Ⓐ with the wand picks up a ball in reach, and sprays otherwise**, so muscle memory still works and Ⓐ is never
  wasted. The mouse is unchanged (hold Click to spray).
- **Clashes, checked:** RT is the cart's throttle. `board()` does **not** drop the wand today, so add `p.wand = false`
  there (the wand goes back on its reel when you climb in), and RT is then only ever one thing at a time. RT is the power swing at a crew bay, but `canSwing()` gains `!me.wand`
  (you can't swing holding a pressure washer). RT zooms the CCTV, and CCTV mode ignores spray. The kitchen's RT pour
  can't happen with the wand (`openKitchen` needs `!me.wand`).
- **Prompt:** "RT spray · Ⓐ pick up · Ⓧ put it back" for 3 s after grabbing, then "RT spray" (the round-2 shape).
  The day-1 checklist's "Spray the sign · hold Ⓐ" becomes "Spray the sign · hold RT" on a pad.

### 7.2 Sprint on L3, like Call of Duty (owner follow-up b; council 9 item 7, adopted)

- `pad.pressed[BTN.LS]` sets `padSprint` (it lasts until you stop or run out, as today). `BTN.RS` is freed.
- **Clashes, checked:** L3 (button 10) is bound nowhere today: not in menus, the kitchen (buttons 0, 1, 7, 14, 15),
  the swing (right stick, RT, Ⓑ), the CCTV (triggers) or the venue views. Pressing L3 while pushing the stick is the
  natural sprint gesture. `pad.js`'s comment "or the stick clicked in" for the power swing is stale (`swing.js` reads RT
  only); fix the comment.
- **Text:** the HUD store hint becomes `<span class="gp">click L</span> sprint`; the pad sprint tip becomes
  **"Click the left stick to sprint. Costs stamina."** (8 words); the title card's pad line is unchanged.

### 7.3 Every menu works on a pad, and nothing kicks you out of full screen (owner follow-up a)

The owner: the end-of-day report and the shop don't work on a controller, and opening the shop releases the mouse and
kicks the player out of full screen.

**Why `navTargets` / `navPick` fail on these cards** (from reading the code; Q reproduces each on Xbox Edge):
1. **The report destroys focus every second.** `round2.js renderReport` rebuilds `#report-extra` (the Sign button and
   the panels) whenever its key changes, and the key includes `c.readyIn`, which ticks every second during the Ready
   countdown, and `c.cash`. A focused Sign button is destroyed. The next Ⓐ falls into `pollPad`'s
   `focusFirst(root)` and clicks **the first focusable in the card: the overnight shop's first Buy button.** A pad
   player who presses Ⓐ to sign can buy an upgrade instead.
2. **Nothing is focused when the report or the lobby opens.** `showPhase` never calls `focusFirst` for them (only
   `toggleStore`, `pause` and `openSettings` do). The first Ⓐ therefore focuses and clicks in one press, which is again
   the first Buy button.
3. **The shop opens on View (⧉) as well as D-pad ↑,** and closes on View, Menu or Ⓑ. Xbox Edge may claim View and
   Menu for its own UI (prime suspect for "kicked out of full screen"; Q to confirm on the console).
4. **Opening a card calls `document.exitPointerLock()`** (shop, pause, kitchen, report). On a pad there is nothing to
   unlock, and on Xbox Edge releasing the lock shows the system cursor ("it releases the mouse").

**The fix.**
- **One focus rule** (`main.js`): whenever a card becomes the `menuRoot()` (report, Ready / Next, signing, lobby,
  pause, settings, shop, end card), focus its **primary button**: the report's Next / Ready, the lobby's Open the range,
  the pause card's Back to work, the shop's first affordable Buy, the settings' first row. A `data-primary` attribute
  marks it. `focusFirst` prefers `[data-primary]`.
- **Focus survives re-renders.** Before `renderReport` (and `renderShop`, `renderLobby`) replaces HTML, remember the
  focused element's `id` or `data-buy`; after, refocus it, or the primary if it's gone. `readyIn` moves out of the
  report's key into a text-only update of `#next`, so the countdown never rebuilds the panels.
- **Ⓐ never clicks a button that wasn't already focused.** If nothing in the card has focus, the first Ⓐ only focuses
  the primary.
- **Bindings on every card:** D-pad and left stick move focus (the existing `navPick`, first step 0.28 s, repeat
  0.12 s); **Ⓐ presses**; **Ⓑ closes or goes back** (shop → game, settings → pause, pause → game; on the report and
  the lobby Ⓑ does nothing, because there is nowhere to go back to; on the report Ⓨ toggles Ready as a shortcut); a
  focused slider takes left/right as today. The shop opens on **D-pad ↑ only** (View is dropped) and closes on Ⓑ or
  D-pad ↑ again.
- **Pointer lock:** track the last input device (`lastInput = 'pad' | 'mouse'`, set by `pollPad` activity and mouse
  events). Opening a card calls `exitPointerLock()` **only when `lastInput === 'mouse'` and
  `document.pointerLockElement` is the canvas**. On a pad the lock (if any) is left alone, and closing the card never
  calls `requestPointerLock` either (`lockMouse()` only on a real mouse click).
- **Full screen:** the game **never calls `document.exitFullscreen()`** (it doesn't today; a test keeps it that way).
  Chromium doesn't count gamepad input as a user gesture for `requestFullscreen`, so the game can't put you back once
  you're out: it must never take you out. Q's suspect list on Xbox Edge: View/Menu (item 3 above), pointer-lock
  release (item 4), the lobby's text inputs (they open the system keyboard), `location.reload()` on Leave, and the
  share link's clipboard write. A `?padlog` overlay (bottom-left, debug only) prints each pad button, the menu root, the
  focused element, `document.fullscreenElement` and `pointerLockElement` on every change, so the culprit shows itself.

### 7.4 The cart's engine (owner note 6; council 9 item 8, adopted with the owner's saturation and glide)

`sfx.js cartEngine` (council 9 N9: one sawtooth from 110 to 440 Hz through a lowpass opening to 2,000 Hz; at top
speed that's a bright A4 buzz) becomes:
- **Two square waves an octave apart**, detuned ±4 cents, at **70 → 160 Hz** (idle to top speed). Squares have no even
  harmonics, so they read as a motor, not a reed.
- **A lowpass at 400 → 900 Hz** (Q 0.7), so the top end never opens.
- **Gentle saturation:** a `WaveShaper` with a tanh curve (drive 1.5) after the filter: warmth, not fuzz.
- **A "putt" tremolo** at 12 → 28 Hz with speed (an LFO on a gain, depth 0.25).
- **Tyres:** the shared noise buffer through a band-pass at 250 Hz (Q 1), gain 0 → 0.012 with speed.
- **Smooth glide:** every parameter moves with `setTargetAtTime(…, 0.25)` (was 0.08), so throttle stabs slur.
- **Top speed sits at 90% of the gain ceiling** (gain 0.012 + 0.028 × speed). Turbo (×1.6) doesn't raise the pitch:
  `engine.set()` takes speed ÷ the base `vmax`, clamped to 1.

**Files (7).** `web/js/pad.js` (comment), `web/js/main.js` (sole owner: `pollPad`, `pressAct`, `canSwing`, the
prompts, focus rules, `lastInput`, `?padlog`), `web/js/round2.js` (the report's re-render key and focus restore),
`web/index.html` (the store hint, `data-primary`), `web/js/settings.js` (the sprint tip, the settings' primary),
`web/js/sfx.js` (`cartEngine`), `server/crew.mjs` (`board()` drops the wand).

**Tests.** `test/pad.test.mjs` (new, pure): a fake pad snapshot through a small `padBindings(pad, state)` returns
sprint on L3, not R3; spray on RT only with the wand; no spray while driving or in CCTV. `test/menu.test.mjs` (new,
with a tiny DOM stub like `say.test.mjs`): the focus rule picks `[data-primary]`; a re-render keeps the focused
`data-buy`; Ⓐ with nothing focused focuses and doesn't click. A grep test: no `exitFullscreen` anywhere in `web/js`.
`test/audiomix.test.mjs`: the engine's frequency at speed 1 is ≤ 160 Hz and its filter ≤ 900 Hz.
`test/words.test.mjs`: the sprint tip.

**Effort.** XS (RT, L3), S (menus and focus), XS (the engine).

**One text / Xbox.** No new centre text. Everything here is for Xbox Edge: the pad never unlocks the pointer, the game
never leaves full screen, the menus work end to end on a pad. The engine is Web Audio nodes (no draws).

---

## 8. Every new line of text

Every centre line goes through `say()` and is in `test/words.test.mjs`. Everything else is the edge, the nudge slot,
the bottom prompt, the feed or the world.

| Line | Words | Where |
| --- | --- | --- |
| Gary. Regional Manager. He has a clipboard. | 7 | PA caption, once ever (centre) |
| Gary approves! ×1.25 a ball till the bell. | 8 | ALERT, a sealed huddle (centre) |
| Glow rush! Shoot before they leave! | 6 | Tiered's rally (centre ALERT) |
| Missed: the bowls were full at 1:00. | 7 | Tiered's DENIED line (the stamp) |
| Grab the last balls! | 4 | The cleanup deal (centre ALERT, dealt) |
| Today: 60% clean by the bell. | 6 | Memo |
| Gary visits today. 60% clean by the bell. | 8 | Memo, a visit day |
| A ball pays more the cleaner it is. | 8 | TIP (day 2) |
| Spotless! The cart pays full price again. | 7 | TOAST |
| Tomorrow: Gary from Regional. Clean, then huddle. | 7 | Report (day 3) |
| Tomorrow: Gary visits. Clean, then huddle. | 6 | Report (a visit's eve) |
| Saved by Cy's TARGET at 1:04. | 6 | Report |
| Clean 64% · needed 60% / Upkeep 41% · needed 40% | – | Report row |
| Gary's Seal: +$1,240 | – | Report row |
| Fill the bucket basket! · Fries went cold. Peel! · The pond's full. Dive! · The deck's open. Pour the first round! · Crowd's cold. Lap the Ping Track! · Strays in the Yards. Sweep them! · Debris overnight. Ride the Lift! | ≤ 7 each | The morning deal (nudge slot) |
| Keep Gary talking: hold Ⓐ! | 5 | Gary's extras, parked (nudge slot) |
| Hold Ⓐ: fill a bucket · Basket full · Both chutes busy · Hold Ⓐ: chat to Gary · RT spray | ≤ 5 | Bottom prompt |
| Click the left stick to sprint. Costs stamina. | 8 | TIP (pad) |
| No buckets. A customer left. · You asked Gary about his boat. | – | Feed |
| $2.62 A BALL · EACH BALL PAYS · CLEAN 62% · TARGET 60% · Clean grounds pay up to +50% · Each gauge pays up to +50% · GARY VISITS TODAY · N left out there | – | The Board, the top edge (world / edge) |

---

## 9. Who builds what

Four builders, about four evenings of agent work in total. File ownership: only the owner of a file edits it; anyone
else hands their lines to the owner. Every builder adds their tests to `node --test test/`, runs `make preflight` (in
WSL), and updates `game-design.md` in the same commit.

| Builder | Items, in order | Owns (only they edit) | Hands to another owner |
| --- | --- | --- | --- |
| **1 · The Board and the money** | §1.1–1.4, then §6.4's display | `web/js/board.js`, new `web/js/bvtext.js`, `web/js/payfloat.js`, `web/js/round2.js` | `CLEAN_KIT` and the gear factors → builder 3 (`sim.js`); the HUD line, `floatPay`, the report row, the spotless float → builder 4 (`main.js`), as calls into `bvtext.js`; `memoText`, `spotless.gain` → builder 2 (`crew.mjs`) |
| **2 · The day: end, night and morning** | §2 → §3.1 → §3.2 → §3.3 → §3.4 | **`server/crew.mjs` first lock** (`tick`, `lastCall`, `closing`, `startShift`, `morningMud`, the basket, the save's `fixtures`), `web/js/customers.js`, `web/js/layout.js`, `web/js/ballreturn.js`, `server/venues/tiered.mjs`, `web/js/tiered.js`, `web/js/views/tiered.js`, `web/js/rally.js`, `web/js/duskview.js`, `server/venues/nudge.mjs` | `LAST_CALL`, `CLEANUP`, `MAT_NIGHT_CAP`, the `bucket` row → builder 3; the fill prompt and Ⓐ at the dispenser → builder 4; the morning-deal lines in `nudge.js` → builder 4 |
| **3 · The shop and the economy** | §4 → §5.2 → §5.1 → §5.3, then re-run M2 and the 4P ladder | **`web/js/sim.js`** (sole owner: `SHOP`, `perks`, `activeMats`, every constant), `web/js/washer.js`, new `web/js/views/truck.js` (later); `server/crew.mjs` second (`buy`, `cleanUpgrades`/`cleanGear` migration, `join`'s floor, `wash`, `unloadCart`, `ping`'s clamp) **after builder 2 merges** | the spray reach and `gp` from `up.gear` → builder 4 |
| **4 · Gary, the pad and the sound** | §7.1 → §7.2 → §7.3 → §7.4 → §6.1 → §6.2 → §6.3 | **`web/js/main.js`** (sole owner), `web/js/pad.js`, `web/js/sfx.js`, `web/index.html`, `web/js/settings.js`, `web/js/nudge.js`, `web/js/pa.js`; `server/crew.mjs` third (`stepGary`, `garyDay`, the chat, the Seal, `tomorrowText`, `board()` drops the wand) **after builder 3 merges** | the Gary constants → builder 3; the Seal chip and banner → builder 1 |

**Order of merge.**
1. Builder 4's §7 (leaf plus `main.js`) and builder 1's §1.1–1.2 (leaf), in parallel: no shared files.
2. Builder 2's §2 and §3 (`crew.mjs` first), with builder 3's constants landed in `sim.js` first (an XS commit).
3. Builder 3's §4–§5 (`crew.mjs` second). Then builder 1's §1.4 (the fold, through builder 3's `sim.js`).
4. Builder 4's §6 (`crew.mjs` third), then builder 1's Seal display.

**Done lines.** Builder 2: `endday.mjs` (council 9) within ±1 seed of N5, and `buckets.mjs` on the real rule.
Builder 3: `runall.sh` against main on the real rule, in the commit message, within one day of M2's "this spec" row
at every crew size; the 4P Club → Stadium within +1 shift of today. Builder 1: `test/seam.test.mjs` re-recorded with
one named cause per change. Builder 4: the `?padlog` walk on an Xbox pad through every card, in the commit message.

---

## 10. What the next playtest checks

A real 4P night (two on Xbox pads in Edge) and one solo run, `?pace` and `?perf` on. Goals: Clarity ≥ 7.5, Pacing ≥ 7,
Fun ≥ 7.

1. **Ball Value (the owner's question).** Ask a new player after day 2, with no hints: "What does a ball pay, what makes
   it pay more, and what does today want?" Goal: all three answered from the Board in one look. Did anyone notice the
   "+$0.05 a ball" floats and the green pips? Does "8 × $2.62" match the Board?
2. **The cleanup minute.** The live count at 1:00 and at the bell; did anyone run for the last glow balls? Tiered: when
   the last TARGET landed vs 1:00, and how often it passed (goal: 4P crews that shoot in the rush pass ≥ 80%, and it
   can still fail).
3. **Mats and customers.** Refusals a shift (goal: 0 in the morning, a few mid-shift for a forgetful crew); do
   customers visibly skip the muddy bays?
4. **The morning.** Seconds to the first filled bucket; customers who left an empty basket (goal ≤ 1 a shift at 4P);
   four different morning lines at 4P at every venue; with the machine, is the morning still a beat?
5. **Muni pace.** Shifts to the Club at 1P, 2P and 4P (goals: 4–5 at 4P, ≤ 6 solo). Did the solo player buy "Open every
   bay"? At the Club, does a solo player notice the extra bays closing (council 9 keeps them Muni-only; if it reads as a
   bug, keep the row on after promotion)?
6. **Upgrades.** When the fan and turbo nozzles were bought; hose seconds a day; did a 4P crew notice one gear purchase
   lifting everyone? Any old save that lost gear is a blocker.
7. **Gary.** Was the drive-by intro noticed, and did the crew know who he was at his first warning? Visit days (expect
   ~4 in 10); chat stalls used per visit (0–12 s); verdicts passed (≥ 75% from day 5 at 4P); Seals earned; did the crew
   plan its morning around the "Gary visits today" memo?
8. **The cart.** Trips to the return a shift (expect 4–6), and Club → Stadium shifts at 4P (≤ +1).
9. **Xbox Edge.** Sprint on L3, spray on RT; the report (Sign, Ready, Next), the shop, the lobby, pause and settings
   end to end on a pad with no accidental purchase; **never out of full screen** (run `?padlog` and screenshot it if it
   happens); the engine at full throttle ("still whiny?"); p95 ≤ 20 ms at the basket with 12 buckets and at Gary with
   his bubble up.
10. **One text.** Screenshots at 1:30, 1:00 and the bell, Gary's intro and his sealed verdict, and the morning deal.
    Never more than one centre element.
11. **Regression.** `node --test test/` green, `make preflight` green in WSL, 60 minutes with no console errors.
