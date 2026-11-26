# Round 14 build, builder 3 ("ending"): the ending on camera, contracts you can win, Site 13

Council round 12 items **#3**, **#6** and **#8** (`design/council-round12.md`), plus fixes 9.13, 9.15 and 9.17.
Everything is in; item 8 (the first cut) shipped too.

## What I built

### #3 The ending, on camera
- **3a. Ball No. 1's gold beam.** `huddlerules.js` `oneBeam` / `oneBeamScale` / `ONE_BEAM`, drawn in `main.js`'s
  beacon pass as the first instance of the gold-ball beacon (no new draw call):
  - while `lastBucket.phase === 'down'`: 25 m tall (9 m × 2.8), radius × 2, pulsing ±12 % at 0.5 Hz;
  - while carried (and in the huddle): a 4 m pillar at 2 m over the carrier, drawn where *I* see that Rat.
  - **The Target Greens' pillars hide** while Ball No. 1 is down, carried or in the huddle (`targetBeamsHidden`,
    one line in `views/tiered.js`).
  - The banner is **"BALL NO. 1 DOWN · follow the gold beam"** (8 words; segments 15 and 20 characters). The council's
    "BALL NO. 1 IS DOWN · follow the gold beam" is 9 words, so "IS" went.
- **3b. The crack, framed** (`round2.js`, pure rules in new `caserules.js` `HUSH` / `hushWeight`):
  - from the bank until the note's beat ends, every Rat within 15 m of the return eases (0.8 s) to look at the
    hopper lip from 1 m further back and 0.3 m higher; it lets go over 0.8 s. A look-at after the camera is placed:
    walking still works.
  - `r2.hushing` hides the carried bucket / wand / picker in `main.js` (one condition on the gear-visibility line).
  - The crack is lifted to y 1.9, scaled ×2.2 so it reads at 6 m, and turned so its open side faces *this* Rat's
    camera (`ending.crack(x, y, z, yaw)`); the slow spin became a ±0.12 rad sway.
  - The note card draws high (`story.js` note card `pos: 'high'`, `storycard.js` `.high { top: 3% }`).
- **3c. Gary in the Lift.** On the Orbital promotion morning the reveal holds after the sign and moves (1.5 s) to a
  Lift shot when the `promo:5` beat's first card shows: 15 m off the car, the camera climbing 0.6 m per metre of car,
  looking at the roof. It releases on card 3 (or the beat's end), capped at 22 s; if the beat never comes (seen) it
  ends as before. Gary rides at ×1.3 (`garycameo.js` `RIDE_SCALE`).
- **3d. The glass case** (new `views/glasscase.js`, registered in `views/index.js`; rules in `caserules.js`):
  - at (STAND − 2.6, STAND + 3.2): a plinth whose front is the canvas plaque, the two gold halves (one InstancedMesh),
    and a glass box. **3 draw calls**: the plinth's other faces sample a wood corner of the plaque canvas.
  - The plaque: "BALL No. 1 · 1958–2026 · FOUND BY", the crew's names (the carrier first), and the newest four lines
    "Day N · $91.2M": the day that opens the Owners' book and every Owners' record after it.
  - Server (`crew.mjs`): `depositOne` builds `glassCase` from the online crew; `endShift`'s records block adds lines;
    saved as `glassCase`, in the snapshot as `glassCase`. An old endless save with no case builds one from the crew's
    names on its next morning.
  - The first endless morning's reveal ends on Gary beside the case (camera at case + (−5.5, 2.0, −0.6)), Gary facing
    that camera and the crew (`CAMEO.FACE −1.45`; C #11: his back was to them). It releases on the epilogue's second
    card. `firstOwnerDay` in the snapshot re-stands Gary at the return on a rejoin (`views/orbit.js`).

### #6 Endless contracts you can see and win (`today.js`)
- **6a. One count for "left".** `endShift`'s report `left` is now `ballsLeft()` (it was `balls.size`, which counted
  sunk, creek and cup balls); the contract settles on `report.left`; the Spotless bonus already used `ballsLeft()`.
  The dusk line reading the server's `left` is builder 4's 9.9.
- **6b. Goals by tier** (`GOALS_BY_STARS`), set from bot measurements (below):

  | Stars | Goal pool |
  | --- | --- |
  | 1★ | Bank yesterday × 0.85 · at most 6 knockdowns · Spotless at the bell |
  | 2★ | Bank yesterday × 1.0 · at most 2 knockdowns · Reach ×2 Hustle |
  | 3★ | Bank yesterday × 1.1 · nobody knocked flat · Hit ×3 Hustle by T−2:00 |

  - **The "left" percentiles collapsed.** With the one count, an attentive bot ends **every** endless shift at
    0 left (72 bells: 12 shifts × 1P/4P × 3 seeds), so P75 = P40 = P10 = 0. "Left" stays only as the 1★'s "Spotless at
    the bell"; in the 2★/3★ pools it would be free. (Round 7's 35–90 "left" was `balls.size`.)
  - **The Hustle reaches ×3** in endless only with the Owner's Hustle tier; a crew without it is offered ×2 by
    T−2:00 at 3★ (`contractsFor`'s `hustleCap`). **T−3:00 was too hard** (×3 needs 8 'mult' prizes of 0.3: ~27 pings
    by 240 s): 3★ hustle met 0 of 4 at T−3:00 at 6 pings/min; T−2:00 brought 3★ into its band.
- **6c. Seen all shift.** The snapshot's `contract` carries `state` (`live` / `met` / `lost`) and `so`
  (`contractLive`): "1 SO FAR", "$41.8M SO FAR", "7 OUT NOW", "×1.5 NOW". Met only when it can't be undone, lost
  only when it can't come back. A `contractLost` event fires once; `views/glasscase.js` feeds "Contract lost.".
  Builder 4 draws the Board line and the memo's "Contract: …" (their hooks were already in).
- **6d. Cosmetics** at 3, 8, 13, … 48 stars (`PER_UNLOCK 5`, `FIRST 3`).

### #8 Site 13, the live endless rival (`owner.js`)
- `rivalTarget`: from the Owners' day 2, **F × the mean of the last 3 Owners' days**, ±6 % from a hash of the day.
  `rivalPace` puts it on yesterday's curve (linear if there is none). `rivalBell` books the day; 4 of 7 (days 2–8,
  9–15, …) acquires; week 2 on uses F2.
- **F is 1.00 and F2 1.04, not the council's 1.04 / 1.08.** Endless income is flat day to day once the Owner's
  projects are bought; at 1.04 the bot beat Site 13 on 36 % of days and won 1 week in 18 runs.
- The snapshot's `rival` (`{ cash, est: true }`, builder 4's Board line) and `site13` (times acquired: the sign
  repaint and the jacket). The first time you pass them after they led (from T+1:00): `{ t: 'rival', passed }`, the feed
  "Passed Site 13." and `board.flash()`.
- The report's headline is "Site 13 revised its estimate." / "Site 13 sends a fruit basket."; rows: their number, the
  week ("Site 13 this week: 3 of 5 won (4 of 7 acquires).") and yesterday's line (`round2.js`).
- A won week: `crew.memoNews = MEMO_LINES.acquired` (builder 4's slot); the second day of a new week:
  `MEMO_LINES.rivalBack`. The **Site 13 jacket** (`RIVAL_LOOK`, vest) unlocks with the first acquisition (`canWear`'s
  `rival` flag; the locker and `recap.js`).
- Saved inside `records.rival = { week, wins, days, last, acquired }`; banking Ball No. 1 clears it with the rest of
  the Owners' book.

### Fixes
- **9.13** `mid:3` plays on the Stadium encore morning (`midDue`: the boss blocks only away from venue 3), reworded
  GARY "Saw that lap. Don't tell Regional."
- **9.15** `story.js` `GARY_BYE_MOWE` and `garyBye(venue, moweWon)`. **Not wired**: the caller (main.js ~l.787, the
  verdict feed) needs a "MOW-E beaten since Gary's last Club visit" flag from the server (builder 1's `moweSt`).
- **9.17** The endless report reads "Owners' record! $X (was $Y)." for `record.owner`.
- **9.14** is 3d's end pose.

## Measurements

### The ending (browser, `lastbucket` preset, solo, rr-play-c)
- **The beam from the stand:** visible the moment Ball No. 1 lands, the only beam on the range (`design/shots/c12-ending-beam.jpg`).
  At ~125 m the 25 m beam stands ~60 px above the horizon at 800 × 600.
- **The hush:** the camera centred the hopper lip, no carried gear, the halves glowing gold mid-frame and the note card
  in the top band (`design/shots/c12-ending-hush-note.jpg`). One centre element.
- **The pane was hidden for the whole session** (other builders' tabs held it), so rAF ran at ~1 fps and `main.js`'s
  0.05 s dt cap made the reveals run at ~5 % speed. So I checked the two reveal shots by projecting the exact poses
  with the page's own camera settings (fov 70, 800 × 600) and by raycasting against the live scene:
  - **Lift shot:** Gary is **67, 67, 66, 65, 61, 57 px** tall at ride t = 3.5, 4, 5, 6, 7, 8 s (card 2 is t 4–8). No
    mesh between the camera and the car's roof at any height.
  - **Case shot:** Gary 129 px tall at x 330, the case top-to-base 122 px at x 471, plaque in frame, nothing in the way.
  - `?perf` at the return was **not measured** (hidden pane).
- `garycameo` facing: confirmed from a frame that his forward is (sin θ, cos θ); −1.45 faces the case shot and −x.

### Contracts and Site 13 (`pt7c-endless.mjs`, from the `lastbucket` preset: the bank, then 9 Owners' days; day 1 is
the epilogue morning with no contract or race, so 8 contract days and 8 race days a run; 1P and 4P × seeds 7/11/23;
`PICK` = the tier taken every day; `PINGH=6`, the attentive bot pings the autopilot cart 6 a minute on a Hustle day)

| Tier | Met (1P) | Met (4P) | All | Band |
| --- | --- | --- | --- | --- |
| 1★ (`PICK=0`) | 17 / 24 | 22 / 24 | **39 / 48 = 81 %** | 80–90 % |
| 2★ (`PICK=1`) | 13 / 24 | 18 / 24 | **31 / 48 = 65 %** | 50–65 % |
| 3★ (`PICK=2`) | 5 / 24 | 9 / 24 | **14 / 48 = 29 %** | 25–40 % |

- By goal (all runs): 1★ Spotless 18 / 18, 1★ cash 12 / 16, 1★ knockdowns 9 / 14; 2★ hustle 22 / 22, 2★ knockdowns 6 / 14, 2★ cash 3 / 12; 3★ hustle 9 / 14, 3★ nobody
  flattened 3 / 20, 3★ cash 2 / 14. The bot's solo Rat is knocked down 2–11 times a shift, so 1P upright goals are
  harder than they will be for a careful human.
- **First cosmetic, 4P picking 2★:** endless day 3, 4, 3 (2 of 3 runs by day 3). Day 1 has no contract, so day 3
  needs both of the first two 2★ met.
- **Site 13:** beaten on **73 / 144 days = 51 %** (target 45–65 %); a week won in 1 of 3 runs at every
  size and pick (4P `PICK=0` and `PICK=1`: 2 of 3).
- The report's `left` equals `ballsLeft()` at every bell (and so the Spotless bonus and the contract); the dusk line is
  builder 4's.

## Files touched
- **Mine:** `web/js/huddlerules.js`, `ending.js`, `round2.js`, `story.js`, `storycard.js`, `today.js`, `recap.js`,
  `owner.js`, `views/orbit.js`, `views/garycameo.js`; new `web/js/caserules.js`, `web/js/views/glasscase.js`;
  `scripts/bots/pt7c-endless.mjs` (Hustle pinging, tier/kind tallies, the Site 13 tally).
- **`server/crew.mjs` (my regions):** the Today/contracts region (`contractOffers`' `hustleCap`, `contractStats`,
  `stepContract`, `rivalNow`, `stepRival`, `dealToday`'s resets and Site 13 target, `settleToday`); `endShift`'s report
  `left` and records block (case lines, Site 13's bell, `report.rival`); `depositOne` (the case, `rival` cleared); the
  epilogue lines (`firstOwnerDay`, an old save's case); the snapshot (`contract` live, `glassCase`, `firstOwnerDay`,
  `rival`, `site13`); the save (`glassCase`). **Outside my regions, small:** two import lines; one load line each for
  `glassCase` and `records.rival`; one line in `tick()` (`this.stepContract()`); the locker's `canWear` gets the
  jacket flag.
- **`web/js/main.js` (my regions):** the beacon pass (Ball No. 1's beam), the gear hide (`r2.hushing`); the
  huddlerules import line.
- **Not mine, one line each:** `web/js/views/tiered.js` (hide the Target pillars), `web/js/views/index.js` (register
  the glass case).
- **Tests:** new `test/round14ending.test.mjs` (13 tests); `test/today.test.mjs` (the 3/8/13 ladder);
  `test/huddle.test.mjs` (the banner text); a builder-3 block in `test/words.test.mjs`.

## Goldens
My changes should not move them: everything is endless-, Orbital- or Stadium-only, the report's `left` changed only
in value where sunk/cup balls existed, and nothing draws RNG. **The goldens did not move.** The last full run:
**1168 / 1168 pass** (`node --test test/`, with every builder's work in the checkout at that moment). Earlier runs had
failures in other builders' half-done work (`boss.test.mjs`, `playtest3a` #716, `round2.test`'s reveal line), all
gone by the end.

## Hand-offs and open issues
1. (Fixed by builder 2 before the end.) During my browser checks `views/county.js` threw on every snapshot, which
   stopped every later view's `onSnapshot`; I worked around it inside my page only. Worth knowing: one throwing view
   stops the whole views runner (`registry.js` `sync` has no try/catch).
2. **Builder 4:** the PA card "No more balls. Every ball mattered." was still up under the epilogue's memo card on the
   first endless morning (the say.js PA-idle signal, 4c). The `site13` snapshot count is there for the fence-sign
   repaint (`signs.js`).
3. **9.15 wiring** (above): one server flag and one argument in `main.js`'s verdict feed.
4. **Fronted-pane checks still owed:** the Lift shot and the case shot in real time, `?perf` p95 at the return with the
   case, and the note's Ⓐ on a pad.
5. The Board's "SITE 13 $… (est.)" reads $0 for the first minute when yesterday's curve starts flat; it is linear when
   there's no curve at all.

## Builder 4's hand-offs (done after the main report)
- **4c, the end card and the last PA** (`round2.js`): the last PA line now plays 600 ms after the $∞ digits fade
  (`BANK_PA_GAP`), and the end card waits on `ctx.whenPaIdle(2)` after the finale, so no PA card sits under it.
- **9.6**: the late "Day N · venue · you are a…" toast at the reveal's end is gone.
- **4d, the Stadium reveal**: it now goes straight to a Board shot from the field side, (19, 5.5, 6) looking at (26, 5.2,
  7.2), held while the newsreel card (promo:3's first) is up; the second card releases it (14 s fallback if the beat was
  seen). Chosen by a grid search over camera positions projected at fov 70, 800 × 600: the Board is ~285 px wide and the
  Stadium jumbotron's three posts (x 20.6 / 26 / 31.4, z 14) all stay out of the middle band x 250–550; the old pose
  (20, 6, 22) put the left post at x ≈ 500. A raycast on a live `stadium1` crew found nothing between that camera and
  the Board's corners, and nothing within 3 m of the camera.
- **9.5, Gary's bubble at the return** (`views/garycameo.js`): its height goes through builder 4's
  `clampBubbleY` (`bubbleclamp.js`) every frame it's shown; `views/orbit.js` passes `ctx.camera` to `cameo.tick`.
- Suite after these: **1172 / 1172 pass**.
