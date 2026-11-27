# Council round 14, builder 3 ("tourney"): the Bell, the Tournament's announcement and score, the County patch, the poach

Brief (the lead's re-split of `council-round14.md`):
- 3a: the Bell's lobby and price;
- 3b: the Tournament's first-morning line, report row and eve line, the flight timing around Gary's window, and the
  solo clock and pair;
- 3c: the second County inspection's patch only;
- item 5: the poach, all of it.

I built on builder 4's item-0 hooks: `reportRows`, `crew.memoEvent` and `shopVday`.

## What was built

### 3a · The Members' Bell
- **Price:** $15k → **$10k base** ($22k at 4P). The description now reads "Ring it for a bonus round, once a shift."
- **`bellOpen` admits venue 2,** so at Tiered the bell rings builder 2's bonus Happy Hour.
  - New `BELL_VENUES = [1, 2]`.
  - New `bellStateOf(s)`: the bell's wire state from `s.mods.tourney.bell` (Club) or `s.mods.happyhour.bell` (Tiered).
    Builder 2's snapshot already uses the same shape.
- **`views/landmarks.js`:** the Ⓐ prompt and use work at the Club and Tiered. The swing also plays on Happy Hour's
  `{ t: 'happy', phase: 'bell' }`.
- **`tourney.mjs` `input`** now returns false off the Club. Without that, the Tournament module (active from venue 1)
  would have eaten the Tiered ring and launched a bonus flight at Tiered.
- **The lobby:** `crew.mjs` `buy()` passes `shopVday(phase, venueDay)` (builder 4's ask). The bell is on sale in the
  Club day-4 lobby at $10,000. Checked in the browser.
- **The bot policy** (`policy/landmarks.mjs`) uses `shopVday`, rings the bell when it's open at the Club or Tiered, and
  reports "bell rung in N of M owned Club/Tiered shifts".

### 3b · The Tournament: announced, scored, fair to a solo Rat
- **The memo:** the first Tournament morning sets `crew.memoEvent = TOURNEY_MEMO` (it was `memoNote`, which always
  lost to the kinds line). In the browser, the Club day-4 memo shows "Gary visits today. 50% clean by the bell." /
  "Members' Tournament today. Site 13 entered anyway." (shot `c14-tourney-club4-memo.jpg`).
- **The eve line:** `TOURNEY_EVE_LINE` "Tomorrow: the Members' Tournament. Bring friends." (6 words).
  - `tourneyEveDue` and `tourneyEve(crew)` (exported from `server/venues/tourney.mjs`) return it on the night before
    any Tournament day, until the crew has had one.
  - **Handed to builder 4** for `tomorrowText`: after the MOW-E branch, before Gary's.
- **The report row:** the module's `reportRows` returns "Members' balls 3 of 4" with `cash`, or "The caddie took all
  4. Kazoo." (`tourneyRow`).
- **Gary's window:** `flightTimes(secs, deals, gary)`.
  - On a Gary day, a flight inside warn..warn+120 s (`garyWindow(secs, GARY.AT)`) moves to the nearer edge ± 5 s.
  - It then dodges the deals without going back inside the window.
  - Club Gary day: flights at **120 / 320 s** (T−5:00 and T−1:40, clear of Last Call at 270 and the cleanup at 300).
  - Off a Gary day: unchanged at 120 / 270 or 250.
- **Solo:**
  - `TOURNEY.SECS_1P` is 45 s (`ballSecs(n)`). The flight event's `secs` carries it.
  - The second ball lands **16–30 m from the first** (`PAIR_1P`, hash `'m1'`, kept 60–140 m out).
  - 2P+ spots are unchanged.

### 3c · The County's second inspection
- `county.js` `secondPatch(hazards, first, h)`:
  - it takes the busiest hazard ≥ 22.5 m (`PATCH2.APART`) from the first patch;
  - with none there, it takes one of six anchors on the hose's ground, from `hash32(day, vday, 'insp', 2)`, skipping
    any anchor near the first.
- `county.mjs` keeps `st.patch1`, the first visit of the shift (the retainer's T−5:30 one, when owned).
- No RNG draw.

### 5a · The poach, tuned
- `owner.js` `POACH.DOUBLE_PER_WEEK: 1` and `RISE: 1.5`.
- `rivalBell`: only the week's first poached **win** counts double (`rival.dbl`). A poached loss keeps the double.
  `result.double` marks the day.
- `poachPrice({ ..., weekPoaches })`: 25 % × 1.5^k of yesterday's bank (25 / 37.5 / 56 %). `k` defaults to
  `records.rival.pw`.
- `dbl` and `pw` reset with the week (at acquisition too). `cleanRival` keeps both.
- `crew.mjs` `buyPoach` passes `weekPoaches` and bumps `records.rival.pw`.
- Fastest acquisition: the double plus two wins, on the 3rd race day. Never twice in 5 days.
- `policy/poach.mjs` buys only while the week's double is unused ("worth it"). `POACH=every` keeps the old policy.

### 5b · Visible
- **The regulars:** `views/owner.js` builds three `people.js` figures in Site 13 red (`POACH_CARD.RED`) at `POACH_BAY`
  (22, −0.4), shown only while `s.mods.poach.on` in a shift (`regularsShown`).
  - The front one swings on each of their bay's launches (a spawn event at the bay), then they rotate.
  - Built on the first poach day only. They share materials and allocate nothing per frame.
  - Shot: `c14-tourney-regulars.jpg`.
- **The card:**
  - `server/venues/poach.mjs` calls `crew.pa('poach', { big: true })` at shiftT ≥ 9 s, after the memo has had its turn.
  - **`pa.js` gets one `PA_LINES.poach` entry** (I don't own `pa.js`; this is a one-line edit). A raw
    `ctx.say('PA', text)` draws nothing, because a PA item needs pa.js's `show`/`hide`.
  - Browser: memo for 7 s, a gap, then "Site 13 lost a regular. To you." alone (shot `c14-tourney-poach-card.jpg`).
- **The report row:** "Poached a regular · Site 13 −5 %" (the poach module's `reportRows`).
- **The shop:** the snapshot carries `dbl: 1` while the double is unused. `poachShopTag(mine)` gives "Counts double
  today". The SHOP order and the tag's placement in `main.js` are **handed to builder 4** (the poach row already lists
  near the top in endless).
- **Handed to builder 4:** the Board's SITE 13 tick with the red "−5 %".

### 5c · The three lines, wired (`wired.test` PENDING emptied)
- **`STAR_LINE`:**
  - buying tier 5 shows `STAR_CARD` "Gary: 'A star. Named Gary. I'll allow it.'" (8 words) as an ALERT.
    A PA-kind item has no drawer, as above.
  - On the first endless morning with the star owned, `views/garycameo.js` `stand(spot, { star })` shows his star
    bubble for 5 s before "Where do these go, boss?" (`views/orbit.js` passes `star`).
- **`STAR_PLAQUE`:** `caserules.js` `plaqueLines(c, { star })` ends with "A star named Gary". `views/glasscase.js`
  passes it and tightens the line step to 38 px when there are 5 lines.
- **The star in frame:** `round2.js`'s case shot tilts its look-at up to the star (y 34) for 2 s (`starTiltWeight`,
  `STAR_TILT.AT 1.6`, up 0.6 / hold 0.8 / down 0.6), inside the shot's 7.5 s floor.
- **`HUSTLE_HINT`:** a poach-module report row, once ever (`crew.voiced` 'hustlehint', saved), the first time a Hustle
  contract day beats Site 13.
- **Builder 4's hand-off:** `garycameo.js` calls `clampBubbleSize` on whichever bubble is showing.

## Measurements

**Bell and Tournament** (`mid.mjs` from `club4`, 1P / 2P / 4P × seeds 7 / 11 / 23, `TOURNEY=1`, `BUY=1` vs `BUY=0`):

| Measure | Target | Result |
| --- | --- | --- |
| Owned Club/Tiered shifts in which the bell is rung | ≥ 80 % | **34 of 38 (89 %)**; 9 of 9 runs bought it, 8 of 9 at the Club or Tiered |
| Member balls banked, 1P | ≥ 50 % | **14 of 26 (54 %)** over both batches (6/14 `BUY=1`, 8/12 `BUY=0`); round 9: 2 of 12 |
| Club length, `BUY=1` vs `BUY=0` | equal | 1/1/1 vs 1/1/1 (1P); 1/1/1 vs 1/1/1 (2P); 2/1/2 vs 2/1/2 (4P) |
| Tiered length, `BUY=1` vs `BUY=0` | equal | 3/7/4 vs 3/8/3 (1P); **6/5/6 vs 11/12/10 (2P, `BUY=1` shorter: the bell's bonus Happy Hour and the Tap Wall)**; 3/3/3 vs 3/3/3 (4P) |

The `club4` preset is a 4P save, so each 1P/2P run sees only 1 Tournament day. The 1P figure is a small sample.

**The poach** (`late11.mjs` from `endless`, 6 endless days = Owners' days 1–6, `POLICY=pt9c-rival`, 1P / 4P × 3
seeds):

| Measure | Target | Result |
| --- | --- | --- |
| Acquired by Owners' day 5, `POACH=1` | 2–3 of 3, median day ≥ 4 | **1P 2 of 3 (days 5, 5); 4P 3 of 3 (days 4, 5, 4)** |
| Acquired twice by day 5, `POACH=1` | 0 of 3 | **0 of 6** |
| Beat rate, `POACH=0` | 45–65 % | 1P 8/15 (53 %), 4P 10/15 (67 %): unchanged by this item (round 9: 53–67 %) |
| Poaches a week, `POACH=1` ("worth it") | 1–2 | 1–2 a week (2 / 1 / 3 over two weeks at 1P; 2 / 2 / 2 at 4P). `POACH=every`: 5 in 5 days, and the price climbed $17M → $29M → $43M, then reset with the new week |

**Browser** (`rr-play-c`, fronted). The pane ran at about 1–5 fps while ~15 bot processes ran (mine and the other
builders'), so these shots are valid as frames but **not** as ≥ 20 fps checks. The lead should retake them fronted on
a quiet machine.
- `c14-tourney-poach-card.jpg`: the PA card alone after the memo, on a poach morning.
- `c14-tourney-regulars.jpg`: the red-jacketed regulars at their bay, one mid-swing.
- `c14-tourney-club4-memo.jpg`: the Club day-4 memo with the Tournament line. The shop listed "Range landmarks …
  $10,000" in that lobby.

## Tests
- New `test/round16tourney.test.mjs` (17 tests):
  - the bell's price, venues, lobby and `bellStateOf`; Tiered doesn't fly a flight;
  - the Gary window (with and without deals); the solo clock in a crew; the solo pair;
  - the memo event in a real crew; the report rows; the eve line;
  - the second patch (pure, and two visits in a County crew);
  - the double, the price ladder and `buyPoach`'s `pw`;
  - the regulars gate, the shop tag, the poach rows and the Hustle hint once;
  - the PA card after 9 s; the snapshot's `dbl`;
  - the star card, the plaque and the tilt.
- Updated:
  - `test/tourney.test.mjs`: the solo pair replaces "both sides" at 1P; flight 2's time is read from the module (day
    12 is a Gary day).
  - `test/landmarks.test.mjs`: $22k at 4P; Tiered rings.
  - `test/owner.test.mjs`: the double-once rule.
  - `test/words.test.mjs`: builder 3's block.
  - `test/wired.test.mjs`: PENDING emptied (builder 4's ask).
- Full suite: **1309 / 1311 pass.** The two failures are not mine:
  - `fixes13` "8.4: a buy goal's ✦…" expects the reward without builder 4's new "≈" (6.12);
  - the Tap Wall test failed once mid-run while builder 2's `deck.mjs` was half-done, and passes on rerun.

## Goldens
`test/seam.test.mjs` passed in my full run, so nothing I changed moved the seam fingerprints. Moves expected after the
merge:
- Club day 4+ at 1P (the pair spots, the 45 s clock);
- Club Gary days (flight 2's time);
- the County with the inspector retained (the second patch);
- endless with a poach (the `pa` event, and `pw`/`dbl` in the save).

## Files touched
- **Owned:**
  - `web/js/landmarks.js`, `views/landmarks.js`;
  - `web/js/tourney.js`, `server/venues/tourney.mjs`;
  - `web/js/county.js`, `server/venues/county.mjs`;
  - `web/js/owner.js`, `server/venues/poach.mjs`, `views/owner.js`;
  - `web/js/caserules.js`, `views/glasscase.js`, `views/garycameo.js`, `views/orbit.js`, `web/js/round2.js`;
  - `scripts/bots/policy/landmarks.mjs`, `policy/poach.mjs`;
  - the tests above;
  - `design/game-design.md` (appended section), this file, 3 shots.
- **`server/crew.mjs`:** `buyPoach` (3 lines) and `buy()`'s `nextPrice` vday plus the `shopVday` import.
- **Outside my files:** `web/js/pa.js`, one `PA_LINES.poach` entry. `main.js` is untouched.

## Open issues / hand-offs
1. **Builder 4, `tomorrowText`:** call `tourneyEve(this)` (from `./venues/tourney.mjs`) after the MOW-E line, before
   Gary's.
2. **Builder 4, `main.js` shop:** the poach row first in endless, with `poachShopTag(crew.mods?.poach)` beside its
   price. **Board:** the SITE 13 "−5 %" tick on the `poach` event.
3. **The views' ctx has no `centre` or `centreBusy`** (only round2's ctx has them). A view can't see what's on the
   centre, which is why the poach card went server-side.
4. **Not in my brief, left alone:**
   - 3c's fireworks at the County, the Orbital audit and the fireworks/inspector price cuts;
   - 3b's caddie feed merge (`views/tourney.js`).
   - `views/tourney.js`'s beam shrink still divides by `TOURNEY.SECS` (30), so a solo ball's beam stays full size for
     its first 15 s. That's cosmetic.
5. **The shots were taken at 1–5 fps** (shared CPU), so the lead should retake them fronted.
