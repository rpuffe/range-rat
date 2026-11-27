# Playtest round 8, tester B: the Club and Tiered (plus the whole game at 4P, headless)

Build `966eace`. Preview `rr-play-b` (:8095), now stopped.

**How I played**
- **Bots.** `scripts/bots/pt8b-mid.mjs` is new and mine. It is `mid.mjs` plus:
  - a calls-a-minute tally;
  - `FIGHT=55`, which stands the crew still for 55 s of the Club boss and then tames it (the measured 4P fight is 49–67 s), so a crew that wins on Club day 3 can be measured;
  - `WHISTLE=90`, where a Rat whistles at the post at T−1:30;
  - a pet ball tally;
  - a snapshot of the shop at every bell.
  - It also fixes the bot's stale `'hotdogs'` goal id (now `'fed'`); without that fix, the solo bot sat 30 shifts at the Club on "fed 179/180".
- **Runs.** From `club1`, at 1P, 2P and 4P, seeds 7, 11 and 23, in two modes. That's 18 runs and 170 shifts:
  - **W:** wins the boss and whistles;
  - **I:** ignores the boss, as `mid.mjs` does, and never whistles.
- **Calls.** A "call" is a moment that asks someone to go somewhere: a treasure appears, Gary arrives, a deck order, a deck fall, a Last Call or rally deal, the boss warning, a fixture crossing 50 % dirty, fries under 30 %, a customer waiting, or the whistle being ready. Repeats of the same kind within 5–30 s count once.
- **Whole game, 4P headless, seeds 7, 11 and 23.** I chained the bots: `muni.mjs` → `mid.mjs` → (see finding 1) builder 2's `late11.mjs` with `ENDLESS=2 STOPV=99`.
- **Text load.** `textload.mjs` at 1P and 4P.
- **Browser.** Club day 1 from "Skip ahead", a Club day-4 save with the pet tame (via `/api/dev/crew`), and Skip ahead → Tiered day 1. All solo; I logged the centre text, the feed and the mower state.
  - The pane kept flipping to a 2× top-left crop, and twice it was hidden by other tabs.
- **Shots** (in `design/shots/`):
  - `pt8-B-club-spawn-roof.jpg`
  - `pt8-B-whistle-post.jpg`
  - `pt8-B-tiered-promo-card-slab.jpg`
  - `pt8-B-tiered-board-deck.jpg`

## 1. Findings

| # | Finding | Repro / evidence | Severity |
|---|---|---|---|
| 1 | **`make-presets.mjs` is broken. `late.mjs` never leaves the Stadium.** It never delivers souvenirs, and round 14 put `requests` on the Stadium card. | The make-presets chain at 4P, seeds 7, 11 and 23: **80 Stadium shifts each, `requests:0/6`**, ending with $406–418M cash. A preset regeneration would throw at `county1`. Builder 2's `late11.mjs` (JOB=1) clears it in 2 shifts. | High (tooling) |
| 2 | **Nothing worth buying from Club day 3 to the end.** The shop holds only the fee. | Shop snapshot at every bell, all 18 runs:<br>**Club day 3–4:** the last real item (pond 2, $33k at 4P) goes; after that `next[]` is empty.<br>**What's left:** 4 sub-$3.3k tiers the bot never takes (shoes, ads, helpers, cart). For comparison, Tiered pays $500–700k a shift.<br>**4P cash at each venue's last bell** (seed 7): Club $122k against a $110k fee; Tiered $1.9M against $1.32M; Stadium $10.9M against $6.6M; County $65M against $27.5M; Orbital **$258M**, with no fee at all. | High (design) |
| 3 | **Club days 4–5 are dead time.** The card is done except the fee. | Treasures and reviews are done by **Club day 3 in 18 of 18 runs**.<br>**At 4P:** the fee lands on day 4–5 (income $40–60k a shift against $110k). So days 4–5 have no goal but "earn". Calls at day 4 and later: **0.69–0.78 a minute**.<br>**The new thing those days:** the tame pet, which needs nothing from you. | Med–High |
| 4 | **The Club is under the decision bar at every size.** | Club calls a minute, mean (min–max):<br>1P **0.76–0.82** (0.57–1.43);<br>2P **0.82–0.85**;<br>4P **0.72** (0.57–1.14).<br>The bar is ≥ 1 at 1P and ≥ 1.5 at 4P. A shift is 2 deals, 1 wash, 0–2 treasures, 0–2 fry dips and the whistle. | Med–High |
| 5 | **Tiered's calls are one repeating job.** | **14 deck orders a shift at every crew size**, so 2.8–3.3 calls a minute.<br>Counting the orders as one standing job ("the cook camps the shed"): **1P 0.78–0.83, 2P 1.0, 4P 1.3–1.4**.<br>Tiered is always **3 shifts at 4P**: orders and the fee are done by day 2, and day 3 is a Promotion Day for the third review. | Med |
| 6 | **The tame pet is a big passive income, and the whistle is not a decision.** | **Pet balls a shift:**<br>with the whistle, **84–100** (the 25-ball cap × 4 passes);<br>without, **62–75**;<br>the same at 1P and 4P. That's **12–26 % of all balls banked** (council target: 30–60 balls).<br>Builder 1's 4P median of 9 came from a bot that vacuums the field; a crew that leaves balls out feeds the pet to its cap.<br>**The whistle** is "+25 balls, any time, once". There's no wrong moment and no trade-off. | Med (design) |
| 7 | **The whistle can't be discovered, and gives no feedback when used.** | **Discovery:** no memo, tip or feed line mentions it. The memo after the win says only "MOW-E sends his regards."<br>**The prompt** "Space: whistle for MOW-E" shows only within 2.2 m of a plain white post by the return.<br>**After pressing:** the prompt vanishes and a 2-note sound plays. "MOW-E · ON HIS WAY" is on the far Board only.<br>**When the pet banks:** a `scoop` sound only. No feed line credits MOW-E. | Med |
| 8 | **Spawn views are half ceiling at the Club and Tiered.** | **Club day 1:** the covered bay's dark-green roof fills the top third of the view (`pt8-B-club-spawn-roof.jpg`).<br>**Tiered day 1:** the deck's grey underside fills the top ~45 %, with a lamp post dead centre (`pt8-B-tiered-promo-card-slab.jpg`).<br>This is the Stadium "slab" again, at the earlier venues. | Med (look) |
| 9 | **Losing the boss costs the crew two Club days.** | Mode I: Club days 3 and 4 are both boss days (100 s fights, then fled). MOW-E's warranty tames him after the second loss.<br>The pet starts on day 5. By then the card is usually done. | Low–Med |
| 10 | **One second left reads as a minute.** | The solo `mid.mjs` run: the card shows `fed:179/180`, and the tomorrow line says "1 more minute fed for Tiered." `goals.js` `mins()` rounds up. | Low |
| 11 | **A diver can miss Gary's huddle, and nothing calls them up.** | `mid.mjs` crews lost the seal on 0-fail verdicts with one Rat at 94 m in the pond. This took the Club to 8–10 shifts in 4 of 9 I-runs. The cause is the bot, but nothing on screen pulls a diver up for the huddle. | Low (bot) |

**Owner rules:**
- **One centre text:** held. `textload` found 0 overlaps in 21 mornings, and 0 mornings with two memos. In the browser, the only centre items were the story card, then the memo.
- **~8 words:** held. Club promo 21.8 s, Club mid 17.3 s, Tiered promo 22.8 s, Tiered mid 17.3 s.
- **Pad:** the whistle uses the Use prompt (Ⓐ on a pad).
- **Full screen:** nothing dropped it.
- **Scaling 1–4:** the deck order count and the pet are flat across crew sizes. The Club's calls a minute are flat too, so the Club doesn't get busier at 4P.

**Regressions (early game):**
- The memo folding holds: one memo a morning.
- The PA-idle rule holds: no PA overlap.
- The boss fires on the third Club shift in all runs.
- The spawn moves put the camera under roofs (finding 8).

## 2. The whole game, 4P headless (Muni day 1 → endless day 2)

Minutes count shift time plus the bots' 30–40 s between shifts (the Muni's 4 minutes exclude gaps).

| Venue | Seed 7 | Seed 11 | Seed 23 | Gate |
|---|---|---|---|---|
| Muni | 4 shifts · 24 min | 4 · 24 | 4 · 24 | fee |
| Club | 6 · 45 | 5 · 38 | 9 · 68 | seal (the bot's diver misses huddles) |
| Tiered | 3 · 23 | 3 · 22 | 3 · 22 | the third review |
| Stadium | 2 · 15 | 2 · 15 | 2 · 15 | fee |
| County | 2 · 16 | 2 · 16 | 2 · 16 | the card |
| Orbital → Last Bucket | 2 · 12 | 2 · 13 | 2 · 12 | — |
| **To the ending** | **135 min** | **128 min** | **157 min** | |
| Endless days 1–2 | 2 · 16 | 2 · 16 | 2 · 16 | — |

- **For a human crew that huddles,** the Club is 4–5 shifts (fee-gated; see the W runs), so the ending comes at about **2 h 05–2 h 15**.
- **The middle (Club + Tiered) is 45–50 % of the game's time.** The late four venues together take 43 min.
- **Where the cash piles up:**

| Venue | Income a shift (4P) | Its fee |
|---|---|---|
| Club | $40–60k | $110k |
| Tiered | $0.5–0.7M (×12) | $1.32M |
| Stadium | $7–9M | $6.6M |
| County | $24–33M | $27.5M |
| Orbital | $84M, then $125M | none |

  - From Tiered on, the fee is the only thing to spend on.
  - From the Stadium on, one shift covers the next fee.
  - The Orbital ends with **$250–265M unspendable**. Endless spends some on the owner tiers, and still keeps $63–79M after day 1.
- **Calls a minute, 4P, by venue:**

| Venue | Calls a minute |
|---|---|
| Club | 0.72 |
| Tiered | 3.2 (1.4 counting orders as one job) |
| Stadium | 1.57 |
| County | 2.1–3.7 |

  **The early middle is now the quietest part of the game.**

## 3. The story (Club and Tiered)

- **Club promo** (browser, `textload`):
  - PA "Promoted to the Range Club. Parking unchanged." → GARY "The Club. I raked this pond once." → "Site 13 made the Club last week." → "Dimples now wears a monocle. For the members." → memo at 16.8 s.
  - It lands. The Gary card is warm. The monocle is the best Dimples gag before "dimpl".
- **Club mid** (Club day 2, the same morning as Gary's first visit and "NEW: lead balls"):
  - "Club minutes, 1958: the founder's ball, still airborne." This is weak: it restates the Muni photo.
  - "Don't dive the north end. Just don't." This works as a hook. It pays off when the trophy reads "Engraved: GARY", but nothing points the crew at it.
  - "Site 13's fries are crispier. We checked." Good, and on-theme for the kitchen.
- **Tiered promo** (browser, card styling fine, "Space next · Esc skip"):
  - "Corporate archive: Ball Retrieval Training, 1987." / "The Rat on the tape looks like Gary." / "Dimples is now dimpl. Lowercase. Experiential." The strongest middle beat: the heart and the joke in 13 s.
- **Tiered mid:**
  - "That tape is not me. Watch your bays." is a perfect Gary denial.
  - "Site 13 reports 140% Bay Utilization." / "Corporate did not know that was possible." is a funny pair.
- **Never seen:**
  - Gary's Club sign-off after the win ("moweWon"): no browser Gary day.
  - The Tiered Gary lines.
- **The real gap:** after Club day 2 there is no story until Tiered. The quiet Club days 4–5 have nothing to read. They're where a small beat would do most.

## 4. Best minute / dead minute

- **Best:**
  - The Tiered opening minute: the 1987 tape card, then "Deck order! Pour a beer!" at 0:30, the target beams and $323 a ball.
  - At 4P a crew splits naturally: cook, shooter, diver and picker.
  - The boss on Club day 3 (A's stretch) is the Club's peak.
- **Dead:**
  - Club day 4 or 5 at any size. The card reads "4 of 5 done · 1 to go" (the fee), the shop is empty, and the pet does its 4 passes by itself.
  - The only decisions are the two Last Call deals and a wash.
  - That's two 7-minute shifts with ~0.7 calls a minute.

## 5. Top 5 improvement ideas (ranked)

1. **Give the Club's back half a goal: "MOW-E's chores".**
   - Club days 4+ get one card row: "Pet's work: 150 balls".
   - The whistle becomes **aimed**: MOW-E mows a 10 m strip centred where the whistler stands, not the richest spot.
   - Lower `TAME.CAP` to 15, so the pet is a tool you point, not a 20 % income.
   - Why it's fun: it turns the pet into a "who goes to stand where the balls are" call every shift.
   - Cost: S, in `mowe.js` (`newTame` target), the goals row and the cap.
2. **Something to buy at Tiered and later: the cash sinks council.**
   - Add one aspirational tier per venue at ~1.5 shifts of income. Some candidates: a deck bar upgrade (an auto-pour, ×1.2 orders), a second pond pump, a "MOW-E paint job" cosmetic, the statue fund.
   - Why it's fun: this answers "is there something worth buying?" Right now the answer from Club day 3 is no, and money becomes a score.
   - Cost: M, prices only plus 2–3 items. Tune once against the table in §2.
3. **Make the Club's quiet days a choice.**
   - Once a crew's card has only the fee left, Club day 4+ offers a **Members' Tournament**. At T−3:30 three members tee off for 60 s, and each lands a ball that pays ×10 if a Rat gets it before the cart.
   - It works like the Stretch, at the Club.
   - Why it's fun: it lifts the Club to ≥ 1 call a minute and gives every size a 4-way split ("you take the far one").
   - Cost: S–M; reuse the Stretch and request code.
4. **Fix the spawn ceilings at the Club and Tiered.** Spawn the Rat 3 m in front of the roof line, facing the field, or raise the pitch.
   - Why it's fun: the first look at a new venue should be the venue, not a roof.
   - Cost: XS (spawn position and yaw).
5. **The whistle, told.**
   - The memo after the win: "MOW-E sends his regards. Whistle at the post."
   - The feed: "Pip whistled. MOW-E's on his way." and "MOW-E brought 25 home."
   - A small MOW-E icon on the HUD while the whistle is ready.
   - Why it's fun: you can't love a pet you never notice.
   - Cost: XS.
   - Plus the tooling fix: teach `late.mjs` to deliver souvenirs (or switch `make-presets.mjs` to `late11.mjs`). Otherwise no preset can be regenerated.

## 6. Scores

| Metric | Score | Why |
|---|---|---|
| Fun | 6.5 | The Tiered open and the boss are good. Club days 4–5 coast. |
| Clarity | 7 | The memo and todo lines are short and right ("Deck order! Pour a beer!"). The whistle is invisible. |
| Text load | 8 | 0 overlaps, mornings ≤ 22.8 s, one memo each. |
| Pacing | 6 | The Club is 4–5 shifts, two of them fee-only. Tiered is a fixed 3. The middle is ~half the game. |
| Co-op | 7 | The cook, shooter, diver and picker split works at 4P. The pet needs no one. |
| Meaningful features | 6 | The pet earns 12–26 % for no input. Nothing in the shop after Club day 3. Deck orders are a single camping job. |
| Look & feel | 6.5 | The Board, beams and deck read well. Both spawns look at a ceiling. |
| Polish | 6.5 | The whistle gives no feedback, "1 more minute" for 1 s, and the preset tooling is broken. |
| One more shift | 6.5 | The Tiered and Gary beats pull you on. The Club's empty days push back. |
| Decision density | 5 | Club 0.7 calls a minute at every size. Tiered 1.4 at 4P with the orders as one job. |
| **Overall** | **6.5** | A strong story middle and a fine Tiered, held back by the Club's fee days and an economy with nothing to buy. |
