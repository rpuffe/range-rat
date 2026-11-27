# Round 16 build, builder 1 ("mowe"): council round 14 item 4, the crash day untangled

Brief: `design/council-round14.md` item 4 (+ 6.14). Built on the shared checkout at `097c941` plus the other builders'
work in progress. Nothing committed (the lead commits).

## What I built

| # | Change | Where |
| --- | --- | --- |
| 4a | **The crash at T−6:00**: `BOSS.PROMO_AT` 180/420 → **60/420**. The fight (15 s warn + 100 s cap) ends at shiftT 175 (T−4:05). The Board's update bar follows `bossAt`, so it runs to 60 s on its own. | `web/js/mowe.js` |
| 4b | **Gary waits 8 s after the fight**: new `bossSettled(s, secs = BOSS.SETTLE = 8)` (no live boss and `s.t ≥ 8` in the outro; `s.t` already counts up from 0 in `tamed`/`fled`, so no new `fledAt` stamp was needed). `stepGary`'s warn gate `!bossLive(this.mower)` → `bossSettled(this.mower)`. Every boss day, the Club rematch included. | `mowe.js`; `crew.mjs` l.1728 (one clause) + the import line (l.37, one token) |
| 4b | **The loss line held**: it already queues at ALERT (priority 1) straight after the red STAMP (which drops the low queue first), 3.5 s ≥ the new `BOSS.LOST_SECS` 3. A PA (2) or a toast (5) can't snap it. The fix that was missing: **the stamp now leaves in one step** (no 0.2 s opacity fade), so the line never draws over a fading stamp (pt9-C logged `toast 0.32 + mowe-stamp 1.00`). centre.js has no `after:` option today; queue order gives the same result. | `web/js/mower.js` `stamp()` |
| 4c | **The crowd waits out the boss**: decay was already held by `bossLive`. New: while the boss is live, **no souvenir request lights and a lit one's clock holds** (a request missed mid-fight cost −0.06 crowd: the only thing still draining it, found by the new test). Client: "THE CROWD IS BORED" and both boo lines are muted from the warn to the stamp (`fightMuted`), with **one feed line after**: "Booed: N customers walked out during the fight." (own line: main.js's 2c summary isn't reachable from a view). | `server/venues/stadium.mjs` `requests()`; `web/js/views/stadium.js` |
| 4d | **The mowed line once a fight**: `mowedLine(st, t)`: first knockdown "Mowed. It was trained on your movements." (7), then "Mowed again!" at most once per 20 s (`BOSS.MOWED_GAP`), else nothing. State reset on the warn. | `mowe.js`; `main.js` knockdown case (mower branch split out) + `moweMowed` beside `moweSaid` + the reset in `moweEvent` |
| 4e | **Employee of the Shift needs > 0 banked.** The rule lives in `crew.mjs` `ledger()`, not `awards.js` (awards.js's night awards already needed > 0): dropped the `key === 'banked' ||` exemption. | `crew.mjs` l.2581 (one clause, **outside my region**) |
| 4e | **The rematch eve**: "Tomorrow: MOW-E's rematch. Grab a wand early." (7) | `mowe.js` |
| 4e | **The pet's sofa share**: see the measurement below. | — |

## Measurements

**Crash-day order** (`test/boss.test.mjs` `crashDay`, 4 idle seats, seeds 3/7/11; and `late11.mjs` from
`stadiumPromo`, 4P, seeds 7/11/23, `EVENTS=1`):

| seed | crash warn | fight ends | Gary's warn | Stretch | promoted |
| --- | --- | --- | --- | --- | --- |
| late11 7 | T60 | T175 (lost) | T183 | T210, 3/3 sections offered | yes (gauge 0.87) |
| late11 11 | T60 | T175 | T183 | T210, 3/3 offered | yes (0.91) |
| late11 23 | T60 | T175 | T183 | T210, 3/3 offered | yes (0.92) |

- **Crash days where the Stretch runs whole after the fight: 3 of 3** (round 9: 0 of 6). Working crews promoted 3 of 3.
  Stadium length unchanged (the promo preset is the Stadium's 2nd shift; promoted on it: 2 shifts).
- **The loss line alone** (scratch replay of `stadiumPromo`, idle, 1P and 4P × seeds 7/11/23, fed through say.js the way
  main.js feeds it): every run is stamp 175.2–177.2 → **"MOW-E 2.0 left. It took the bunting." 177.5–181.0, 3.5 s
  alone** → 2.4 s of nothing → "Gary's coming: clean up, then huddle." at 183.4 → the Stretch ALERT at 210.1. 0
  overlaps. (Builder 4's `textload.mjs` doesn't feed mower/gary events, so this is my own replay.)
- **Boss win rates unchanged**: `boss.mjs all`, this tree vs a `git archive HEAD` copy: 30 wins / 6 losses in both, the
  same outcome on every policy × seed row (fight times move ±10 s from other builders' field changes).
- **Sofa share** (4e): the pet's share of banked, `SOFA=1 WHISTLE=aim NS=3,4 boss.mjs pet` (seeds 7/11/23): **3P median
  4.0 % (max 5.3 %), 4P median 4.1 % (max 5.9 %)**, under 12 %, so **the whistle strip `CAP` stays 30** (the brief's
  condition isn't met). For the record, the boss *fight's* payout share on a sofa field (`SOFA=1 boss.mjs all`) is
  Club 4P 10.7–19.1 % (median 15.3 %) and Stadium 4P 5.5–8.6 %; the whistle cap can't move that (no whistle on a boss
  day) and the council froze fight tuning, so I left it.

## Browser check (rr-notes, `stadiumPromo` loaded through `POST /api/dev/crew`, 1 seat)

- **The pane was hidden, not fronted** (`tabs_context`: "The Browser pane is currently hidden"), so the page ran at
  **1 fps** with throttled timers. `tabs_select` fronts the tab but can't show the pane. **The lead should take the
  fronted shots** (the loss line alone, Gary ≥ 5 s later; the club3 mowed line).
- **MOW-E is visible and moving through the whole fight**: I hooked `THREE.Object3D.prototype.updateMatrixWorld` (the
  page's own `three` module) to find the `mower` group and logged it every 2 s: `visible: true` from the warn on, and
  it moved (−33.8,−11.7) → (−22.6,−15.1) → (−2.0,−41.1) → (14.9,−42.9) → (−16.3,−49.2) → … → (24.6,−6.0) (hunting the
  idle Rat at the spawn from the box edge), then out through the stands to (−69.3,−64.6) and `visible: false` once
  gone. So `mowe.tick` is live and drives the mesh.
- Shot: `design/shots/c14-mowe-crash-stamp.jpg` (the red "MOW-E 2.0 WINS" stamp on the crash day). At 1 fps the client
  ran ~2 min behind the server's say timers, so the hidden-pane centre log can't confirm the line's timing; the replay
  above does.
- **Nothing else of mine is dead**: builder 4's comment lint regex over all my files (`mowe.js`, `mower.js`, `sfx.js`,
  `awards.js`, `stadium.mjs`, `stadium.js`, `views/stadium.js`, the boss bots, `policy/whistle.mjs`): 0 hits. Every
  `mowe.*` API call in `main.js` is live (`update`, `setPost`, `tick` l.2157, `event`, `stamp`, `setTargets`,
  `cooling`); every optional `SFX.x?.()` / `engine?.cough?.()` the boss calls exists in `sfx.js`. Only `mowe.hunted` is
  unused outside `mower.js` (a getter, harmless).

## Files touched

- Mine: `web/js/mowe.js`, `web/js/mower.js`, `server/venues/stadium.mjs`, `web/js/views/stadium.js`, `test/boss.test.mjs`.
- Hot files, my regions: `server/crew.mjs` `stepGary`'s warn clause; `web/js/main.js` the knockdown case's mower
  branch, the boss-prompt block (`moweMowed`, its reset on the warn) and the `mowe.js` import line (+`mowedLine`).
- **Outside my ownership (minimal):** `server/crew.mjs` l.37 import (+`bossSettled`) and `ledger()`'s one clause (the
  Employee fix lives there, not in `awards.js`); `test/round2.test.mjs` (builder 3's): the "Employee is always given out"
  assertions flipped to the new rule (+1 assertion that 1 banked still wins it); `test/words.test.mjs` (appended my
  block); `design/game-design.md` (appended my section).

## Tests added

`test/boss.test.mjs`: the crash day at 3 seeds (warn at 60 s, fight ends ≤ 175 s, Gary ≥ 8 s after, the Stretch after
the fight, the order); the crowd never falls mid-fight (idle 2P); `bossSettled` (live, < 8 s, ≥ 8 s) and a Club loss
holding Gary 8 s; `mowedLine` (first, the 20 s gap, the repeat, the reset); Employee needs > 0 and the eve string. The
round-13 crash test now expects 60 s. `test/words.test.mjs`: the mowed lines and the eve.

## Goldens

`test/seam.test.mjs` passes unchanged (20/20): the seam runs don't reach a Stadium Promotion Day or an encore with a
souvenir request lit. Expected moves for the lead's re-record: the Stadium Promotion Day (the crash at T−6:00, Gary 8 s
after) and any Stadium encore day (requests hold during the fight).

## Suite

`node --test test/`: 1296 tests, 1292 pass. The 4 failures are not mine and were moving while I ran: `goldrush.test.mjs`
(builder 2, in progress), the Tap Wall in `landmarks.test.mjs` (deck, builder 2), `skip.test.mjs`'s missing
`server/presets/muni3.json` (builder 4's presets), and a transient `maincalls` failure that passes on re-run.

## Open issues

- The fronted-browser shots (loss line alone, Gary ≥ 5 s later; club3 mowed once then "Mowed again!") for the lead.
- The boo summary is its own feed line, not folded into 2c's "N customers left during the fight." (that counter lives
  in `main.js`'s `createFightMute`; a view can't reach it). Two feed lines at most after a fight.
- Spec said "5 s of nothing" before Gary; the real gap is ~2.4 s (stamp 2 s + line 3.5 s + 0.3 s fade = 5.8 s of the 8).
  Raise `BOSS.SETTLE` to ~11 if the lead wants the full 5 s.
