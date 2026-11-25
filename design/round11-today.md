# Round 11 · builder "today": Corporate's Today, endless contracts, the night recap

Expert review #3 (daily modifiers), #10b (endless contracts), #8 (the end-of-night recap and awards) and §7.7 (a
decision-density metric).

## What I built

### 1. Corporate's "Today" (expert #3)

From Muni day 5 (the global day), each morning's memo deals one modifier. The memo's small-type slot shows
`TODAY · <line>` instead of the joke, and the Board shows one blue pill, `TODAY · WINDY`, to the right of EACH BALL PAYS.
Nothing else is added: no toast, no PA, no tip. The shift report gets one line saying how it went.

| Modifier | Memo line (≤ 8 words) | What it does (existing systems only) |
| --- | --- | --- |
| Windy | Windy today. Light balls drift. | Customer shots get the crew swing's hook/slice `curve`: ±0.32 on light balls, ±0.12 on lead/square/gold; one direction for the day |
| Rain | Rain today. Double mud, early glow. | Mats scuff ×2, the stand dusts ×2 (and opens ×2 muddier); range balls turn glow from 45% of the shift before the bell (Last Call's own glow is T-2:30) |
| League Night | Every bay swings faster. / From Tiered: Fast swings, double deck orders. | Lower bays' swing gap ×0.85; from Tiered the deck's order clock (`deck.orderT`) runs ×2 (the queue cap still holds) |
| Junior Clinic | Junior Clinic. Short shots, balls near the mats. | Every other bay hits `launch(..., { beginner })` (×0.7 speed) and swings ×1.3 slower |
| Celebrity at Bay N | A celebrity at Bay N. Pays ×3. Duck. | That bay's balls carry `mul: 3` (×3 pay through every pickup path), aim at the nearest Rat out on the field, and swing half as often |
| Ball Shortage | Ball Shortage. The basket holds six. | `basket.cap = 6` (basket.js `basketMax`); the morning deal's basket line reads the cap |
| Night Range | Night Range. Glow balls all day. | Range balls are glow balls all shift, paying ×1.1 (`mul: 0.55` on a ×2 glow; Last Call's glows keep ×2); the sky holds at dusk and the floodlights stay on |

Rules:
- None on a Gary day, on Promotion Day (`isPromotionDay` from builder "pacing"'s web/js/promoday.js, imported
  directly: it was there), on a venue's reveal morning, or at the Orbital (no review there). Not in endless (that's
  the contracts).
- Fits the venue: no Junior Clinic at the Stadium or the County.
- Deterministic: `hash32(code, seed)` × the day. Never the same modifier two days running.
- The pick runs after `pickKind`, so the seeded RNG draws never change (`todayKind` maps the drawn kind;
  `todayShot` adjusts the shot after the venue's `launchMod`). No RNG draw anywhere in today.js.

### 2. Endless contracts (#10b)

- At every endless report the crew sees **Tomorrow's contract**: three offers, one each of ★, ★★ and ★★★, three
  different modifiers, each with a goal: bank $X (×0.85 / ×1.0 / ×1.15 of yesterday), at most N knockdowns
  (6 / 2 / 0), or at most N balls left at the bell (40 / 12 / 0). Any Rat picks (a `<button>` per offer, so the pad's
  D-pad + Ⓐ works); the last pick stands; nobody picking takes the first.
- The next morning deals the picked contract's modifier (memo line, Board pill). At the bell a met contract adds its
  stars to a lifetime count (save key `stars`); the report says "Contract met: +2 ★ (23 total)".
- The Board's endless panel shows `★ 23 STARS` between TODAY and YESTERDAY.
- Every 10 stars unlocks a cosmetic (10 in all, to 100 ★): teal / black / gold / tour-white caps, pink / navy / lime
  vests, gold / fire-engine / midnight cart paint. Cheap recolours only: the staff cap and the vest are vertex colours
  in people.js (one new `vest` option, the staff cap may take a colour), the cart paint recolours the hood.
- **The locker** sits on the overnight report: one button per part (Hat / Vest / Cart), each cycles standard → each
  unlocked option → standard. Hats and vests are per Rat (by name, like dive gear); the cart paint is crew-wide. The
  server refuses anything not unlocked (and a tampered save's paint).

### 3. The night recap and awards (#8)

- The server keeps a night per session: every bell adds each Rat's shift counters (by name) into it, plus balls,
  cash, knockdowns, deck falls and treasures. New per-Rat counters: `picked`, `dealt` (knockdowns dealt with a crew
  ball), `gary` (seconds chatting to Gary), `treasures`.
- Every report carries `night` (awards.js `nightCard`): minutes played (from the session's first morning), balls,
  knockdowns, deck falls, treasures, and one award per Rat, greedy and never twice: Most Knockdowns Dealt, Fry Lord,
  Deepest Diver, Talked to Gary the Longest, Most Sprayed (things hosed clean, mates included), Treasure Hunter, Sweep
  King, Most Horizontal, Crank Champion, Bucket Brigade, Cart Magnet, Banker of the Night; anyone left "Showed Up".
- **At every promotion report** (card done, or promoted) a **Good place to stop** button opens the night card. It's a
  full-screen `.card` (#recapcard), a menu root for the pad (main.js `menuRoot`), closed by its primary button, Ⓑ or
  Esc. No pointer lock or full-screen calls.
- The card is saved (`night`). When a saved crew comes back, the welcome carries it as **Previously on Range Rat**
  plus the next goal (the goal strip's NEXT line), once per page, never over a shift in progress, dismissed with Ⓐ.
  After this session's first bell the save holds tonight's card instead.

### 4. Scorecard

`design/scorecard.md`: a **Decision density** metric line ("In the last minute, did I choose something?").

## Measurements: income within ±15%

Harness: the expert's Muni bot (`scratchpad/expert/muni.mjs`), shopping off, one shift from a fixed day-6 Muni save
(gear 2, washer 2, wand 1, ads 2, shoes 2, helpers 2, cart 1; no Gary), each modifier forced on, seeds 1–5, mean
earned. First pass, then tuned:

| Modifier | 4P first | 2P first | **4P final** | **2P final** | Tuning |
| --- | --- | --- | --- | --- | --- |
| (none) | $2,816 | $1,844 | — | — | |
| Windy | −5.6% | −0.8% | **−5.6%** | **−0.8%** | |
| Rain | +14.4% | +20.2% | **+6.5%** | **+9.8%** | glow from 55% → 45% of the shift |
| League Night | +11.3% | +13.9% | **+7.6%** | **+13.8%** | swing gap ×0.8 → ×0.85 (2P is picking-bound) |
| Junior Clinic | +5.2% | +29.9% | **−4.5%** | **+3.3%** | every other bay, and those swing ×1.3 slower |
| Celebrity | +16.7% | +28.5% | **+4.1%** | **+10.9%** | the celebrity's bay swings half as often |
| Ball Shortage | −1.3% | +2.9% | **−1.3%** | **+2.9%** | |
| Night Range | +5.4% | +6.2% | **+5.4%** | **+6.2%** | a night glow pays ×1.1 (not ×2) |

All inside ±15% at the Muni, 2P and 4P. Not measured: the Club and later (the bot there is the expert's much bigger
mid/late bots); League Night's deck orders were checked by a unit test (the clock runs ×2), not by income.

## Files touched

- New: `web/js/today.js` (rules, contracts, cosmetics), `web/js/awards.js` (night counters, awards, the card),
  `web/js/recap.js` (the report panel, the night card, Previously on), `test/today.test.mjs`, this file.
- `server/crew.mjs`: imports; constructor state (today, contracts, stars, looks, cart paint, previously, night);
  `dealToday` / `contractOffers` / `contractInput` / `lookInput` / `settleToday` / `nightNow` / `fieldRats` /
  `todayCount`; the launch lines in `tick` (kind, junior, `todayShot`, the swing gap factor, rain on the scuff and the
  dust); `ballMul` in the four pickup paths (hand, cart scoop, the jackpot scoop, helpers); dealt / Gary-chat / treasure /
  picked counters; the memo's `today`; snapshot (`today`, `stars`, `offers`/`pick`, `contract`, `cartPaint`, each
  player's `look`); `welcome.previously`; `toSave` (`stars`, `looks`, `cartPaint`, `night`); `basketFor` reads
  `basketMax`. `openBays()` is mine but builder "range" now uses it for the built line, so it just returns
  `activeMats` (League Night no longer adds bays: an unbuilt bay doesn't exist).
- `web/js/basket.js`: `basketMax(b)` (b.cap or BUCKETS.BASKET) in the three cap checks.
- `web/js/morning.js` + `server/venues/nudge.mjs`: the basket line reads `basketCap`.
- `web/js/board.js`: the TODAY pill (`state.today`), `★ N STARS` on the endless panel (`state.stars`).
- `web/js/main.js`: recap wiring (create, `render` per snapshot, `welcome`, menu root, Ⓑ), the memo's Today line, the
  Board state, Night Range's sky and floods, mates rebuilt on a new look, the cart hood's paint.
- `web/js/people.js`: `vest` option and a recolourable staff cap.
- `design/scorecard.md`: the Decision density line.

## Tests added

`test/today.test.mjs` (15): the pick rules (days, Gary/promo/reveal/Orbital/endless, determinism, no repeats, venue
fit), the words (≤ 8-word memo lines, chips, report lines), every effect helper, contracts (three offers, stars 1–3,
distinct, cleaning, met/missed), cosmetics (unlock steps, the locker cycle, `canWear`, cleaning), awards (one each, no
duplicates, Showed Up), the night card (rows, round-trip), and the server: Today dealt from day 5 with memo/chip/report
line and the night card in every report; none on a Gary day; Ball Shortage's basket; ×3 pay through pickup; a crew
ball's knockdown counts as dealt; the endless contract loop (offers, pick, junk ignored, the morning deals it, stars at
the bell); cosmetics locked/unlocked, saved and restored, "Previously on" in the welcome until the first bell; League
Night's deck clock ×2.

## Goldens and other tests

- The seam goldens fail right now, but **not because of this work**: the fingerprints are identical with Today forced
  off (a preload that nulls `dealToday`) and on. Other builders moved them.
- With Today forced off vs on, the full suite's failures are the same set (33 at my last run, all in other builders'
  in-progress areas: the pond/creek/treasure, the Two-Minute Warning, kpiAtClose, the Club quota, debuts...), except my
  two server tests that need Today on.
- One of my tests briefly failed on another builder's half-done `sweepLive` in `pickup()`; it passed on the next run.

## Open issues

- Builder "pacing"'s PROMOTION DAY chip: my TODAY pill sits right of EACH BALL PAYS; the two never show together (no
  Today on Promotion Day), so that spot can be shared.
- No rain visuals (the chip and the memo say it); Night Range reuses the dusk sky and the Last Call floods.
- The celebrity has no special avatar: Bay N is named in the memo and the chip.
- Cosmetics aren't drawn on your own first-person Rat or the dusk walk-off's stand-ins (mates and carts only).
- Contracts are judged on the bell's numbers. A ★★★ "Spotless at the bell" with a big crew is a real ask, as intended.
- Balance was measured at the Muni only. Later venues ride the same multipliers. Check League Night at Tiered (deck
  orders ×2 with the new queue) in the lead's playtest.
- Not checked in a browser (no preview allowed in this brief): the pill's layout, the night card, the locker and the
  Previously card need a look on the pad.
