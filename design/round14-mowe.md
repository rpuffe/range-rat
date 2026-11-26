# Round 14, builder 1 (MOW-E): council round 12 items 1 and 5

Builder 1's notes for council round 12 (`design/council-round12.md`, items 1 and 5, plus 9.10 and 9.11, and builder 3's
Gary hand-off). The owner's call was that MOW-E should be "a big deal, like a boss moment". Every number below comes from
`scripts/bots/boss.mjs` (seeds 7 / 11 / 23 / 31 / 41 / 53) or from one solo browser fight on the `rr-notes` preview.

## What I built

### Item 1: MOW-E at 4P

**1a. Your own hit meter** (`mowe.js` `hoseBoss`). The shared vent is gone.
- Each Rat has their own meter. You fill it with `meterSecs` of spray, divided by `washRate`, and twice as fast while
  MOW-E is stalled.
- A full meter is your hit: one pip, credited to you. Then your nozzle cools for 8 s (`COOL_ME`). While it cools, your
  spray sputters grey, plays a hiss (`SFX.sputter`), and does nothing.
- **Crossfire:** while another Rat is also spraying the grille (within `CROSS_WIN` 0.4 s, to allow for the client's
  250 ms wash flush), your meter fills ×1.25.
- After any hit, nobody's meter fills for 1.0 s (`STAGGER_ALL`).
- A meter drains 0.5/s after 1 s without spray, **but only in the harvest**. See the deviations below for why.
- The bolt fires at most once every 8 s (`BOLT_COOL`).
- **What you see:**
  - an SVG ring around your crosshair fills with your meter. It turns grey and empties over the 8 s cool (`mower.js`,
    `meterTick`).
  - the grille's glow follows the fullest live meter, and pulses above 75 %.
- **Snapshot:** `meters: { id: [fill, coolingSecs] }` and `full`.

**1b. HP by crew size** (`BOSS.HP_BY_N`, `BOSS.METER_BY_N`; this changes the council's table, see below).

| Crew | HP | Meter (s) | Hunt speed (m/s) |
| --- | --- | --- | --- |
| 1P | 3 | 2 | 4.0 |
| 2P | 4 | 2 | 4.2 |
| 3P | 9 | 3 | 4.4 |
| 4P | **12** | **4** | 4.6 |
| 5P | 13 | 4 | 4.8 |
| 6P | 14 | 4 | 5.0 |

The encore still adds +1 HP and +10 % speed. The rematch still takes −1 HP.

**1c. The plug as a tug-of-war.**
- At HP 0, MOW-E crawls home at 1 m/s. It turns toward the shed at 25°/s and drags the ring, which stays at its back.
- **The bar** fills at (holders ÷ crew online) ÷ 3 s.
- **The yank:** every 1.5 s it lurches 0.5 m. Each yank costs −0.06 of the bar unless at least half the crew is holding.
- With nobody holding, the bar drains 0.1/s. The 10 s idle reboot stays.
- **Walking:** a Rat holding Ⓐ walks at 2 m/s (`main.js` movement cap; `BOSS.HOLD_WALK`).
- **The Board:** `PULL! ■■□□`.
- **Sound:** a rope creak that rises in pitch with the bar, plus a louder one on each yank (`SFX.creak`). The ring jerks
  on a yank. The bass is out, as before, and the heartbeat speeds from 144 up to 200 BPM as the bar fills
  (`bossTempo(phase, pull)`).

### Item 5: the build-up, the payoff, eating, the pet

**5a. The build-up.**
- **The update bar:** from the bell to the warn, the snapshot's `mower` is `{ kind: 'update', pct }`, and the Board
  reads `MOW-E UPDATE ▓▓▓░ 64 %` (`updateSnap`, `updateBoard`).
- **The stripes:** the near lanes' red stripes show all morning, pulsing slowly.
- **The warn:** three amber pulses, 2 s apart, on the screen edge that faces the shed (DOM, no draw call).
- **The drone:** the boss loop's low drone (`BOSS_LOOP` `warn`, 96 BPM) starts under the beeps.
- **The memo line** is builder 4's: `MEMO_LINES.moweUpdate`, wired in the memo push. On mornings with a NEW kinds line,
  that line outranks it.

**5b. The payoff where the crew is.**
- **The fountain:** on TAMED the catcher bursts at the plug ring. Every eaten ball comes out as a `range` ball with
  `mowe: true` and `mul` = 2 × the average weight it ate. They are spread on the golden angle (no RNG), land 1.5–4 m out,
  and come to rest.
- **The gold:** the gold balls (one per Rat) land within 6 m of the ring.
- **Nobody gets flattened:** `lookUntil` is held for 4 s, so the fountain can't knock anyone down.
- **The bell:** `moweBell()` banks any leftover MOW-E balls at ×1 before the review, so they never count as "left out
  there".
- **The limp:** MOW-E limps to the pond at max(6 m/s, distance ÷ 8.5 s). The pond event and its PA now fire **on the
  splash**: ≤ 10 s after the stamp from any corner of the arena (tested from four corners).
- **The chevron:** each Rat gets a 2 s screen-edge chevron pointing at MOW-E, starting as the stamp ends.

**5c. Eating.**
- MOW-E eats the nearest ball every 0.6 s (`EAT_EVERY`).
- It slows to ×0.35 while there's something to eat in reach (`GRAZE`). That gives the hosers a window, and the cart a
  target.

**5d. The pet.**
- **Passes:** three a shift, at 20 %, 45 % and 70 %.
- **Where it goes:** each pass goes to `richest()` inside `TAME.BOX`, never the pond. It drives 25 m either side of the
  spot, gathering ±4 m, at most 25 balls a pass, then banks at the nearest return.
- **The whistle:** a MOW-E post sits by the return at (31.5, 1.2): a white post with an FHI plate, 4 small meshes, shown
  on pet days. Ⓐ/Space there gives the prompt "Ⓐ: whistle for MOW-E". Once a shift, it sends a bonus pass now, or right
  after the pass that's already out.
- **The Board** says `MOW-E · ON HIS WAY`.
- **The bonus pass** doesn't use up a scheduled one.
- **Snapshot:** `moweWhistle` (0 = no pet today, 1 = ready, 2 = used).

### Fixes and hand-offs

- **9.10:** in the fight, customer balls never flatten a helper (`moweLookUntil`). This touches one line in the
  customer-ball loop.
- **9.11:** `MOW-E WINS · REMATCH NEXT CLUB DAY`.
- **Builder 3's Gary hand-off:**
  - a Club win sets `moweSt.beat`, which persists in the save;
  - Gary's next Club verdict clears it and carries `moweWon: true`;
  - the snapshot exposes `moweBeat`;
  - `main.js`'s verdict feed calls `garyBye(venue, won)`.
- **For builder 2:** `sfx.js` now has `SFX.organ()` (the Stretch riff, `ORGAN_RIFF`) and `SFX.chant()` (the first-request
  chant, `CHANT`).
- **9.12, required per builder 4:**
  - **The cause:** builder 4 traced the Stadium's "black squares with grey discs" to MOW-E's plug smoke. The confetti
    points had no texture.
  - **The fix:** a tinted `confetti.burst` (the smoke) now goes to its own small pool. That pool is 120 points of soft
    round puffs: an alpha-edged 64 px canvas sprite, transparent, 0.7 m. The puffs rise and slow instead of falling
    like paper.
  - **Untouched:** the paper confetti pool. The smoke pool costs +1 draw call, and only while smoke is alive.
  - **Not checked in the browser.**

## Deviations from the council's numbers (and why)

1. **HP 7 at 4P was too short. I made it 12 HP with a 4 s meter.**
   - With per-Rat meters, the crew's damage scales with its size, so the council's 3/4/6/7 table with a 2 s meter gave
     4P fights of 26–35 s against a 50–70 s target.
   - Longer cools barely helped: 4 s meter + 10 s cool gave 35–47 s, and 2 s meter + 16 s cool gave 31–46 s. The 4 Rats
     all hit in the first round, so the fight only lasts about `HP ÷ 4` cool cycles.
   - The sweep is below. With 12 HP each Rat lands about 3 hits, which is what "every hoser lands hits" wants.
2. **Meter decay only in the harvest.**
   - With decay in the hunt, `1p-chase` lost its first fight: one hit in 100 s. A solo Rat is always the hunted one and
     only gets bursts of spray between dodges.
   - The council's reason for decay ("no banking a meter across a bolt") only applies to the harvest, where MOW-E bolts.
3. **Grazing** (×0.35 speed while eating) is new. It was my attempt at 5c. It didn't move the eaten numbers (see the
   open issues).
4. **The pet's sweep:** `RUN` 25 m and `HALF` 4 m, so 1P reaches 30–60.

**The 4P sweep** (4p-swarm and 4p-roles, seeds 7 and 11; fight length in seconds):

| HP 4P | Meter | Cool | Fight (s) |
| --- | --- | --- | --- |
| 7 | 2 | 8 | 26–35 |
| 7 | 3 | 12 | 33–42 |
| 7 | 4 | 10 | 35–47 |
| 10 | 3 | 10 | 43–55 |
| 12 | 3 | 10 | 49–61 |
| 12 | 3.5 | 8 | 49–62 |
| **12** | **4** | **8** | **49–67 (shipped)** |

## Measurements

These are from `boss.mjs` at the Club on day 3, seeds 7 / 11 / 23 / 31 / 41 / 53, with the standard bot crew. Every
fight was won (36 of 36).

| Measure | Target | Round 7 | Now |
| --- | --- | --- | --- |
| 4P fight, burst → tamed | 50–70 s | 43–45 s | swarm 49–57 (median 51.5); roles 52–67 (median 59) |
| 3P / 2P fight | 50–70 / 45–70 s | — | 55–69 / 47–65 |
| 1P fight | 45–75 s | — | cart 45–62; chase 51–72, plus one 94 (seed 31) |
| Solo, `PERFECT=1` | ≥ 38 s | 32 s | 46–60 |
| Hoser time spraying a cooled nozzle | ≤ 15 % | 45–67 % | 1–7 % (the bot notices its grey ring 1 s into a cool) |
| Spray that counts | ≥ 25 % | 4–7 % | 55–89 % |
| Every Rat lands ≥ 1 hit, 4P | ≥ 5 of 6 | 0 of 6 | swarm **6 of 6** (hits 3/3/3/3 or 4/3/3/2); roles: 3 hosers 4/4/4, the driver 0 (the bot's driver never leaves the cart) |
| Plug, 4P swarm, all holding | 3–5 s | 0.8–1.0 s | 3.2–3.3 s; ring dragged 3.7–5.6 m |
| Win rates | met | met | 100 % for every policy |
| Payout share, 4P (median) | ≤ 14 % | 17.6–19.1 % | swarm 11.1 %, roles 9.9 % (3P 13.5 %) |
| Eaten, roles vs swarm (median) | ≥ 8 apart | none | swarm 8.5, roles 4.5: **4 apart, missed** |
| Pet, balls a shift, whistle at T−90 | 30–60 | 6–10 | 1P 31–49 (median 37); 4P 3–26 (median 9); 4P with `SOFA=1` 13–50 (median 22) |
| Stadium encore, 4P | — | — | 51–74 s (13 HP) |
| Stadium encore, 1P | — | — | 58–90 s |

**New bot options** (`boss.mjs`):
- `SOFA=1`: before the fight, Rats pick up only half the time, so the field holds balls the way a human crew's does.
  The standard bot crew leaves about one resting ball near the arena at the burst.
- `WHISTLE=90`: Rat0 walks to the post and whistles at T−90.
- Per-fight tallies: `sprayT`, `coolT`, `countT`, `hoseT`, `by`, `plugLen`, `drag`, `ateHarvest`.
- The payout now counts the fountain at ×2, at the bounty's per-weight price.
- `pt7a-boss.mjs`: its "vent" tally now counts your own cooling.

## Browser (`rr-notes`, solo, a Club day-3 save via `POST /api/dev/crew`)

- **Update bar:** the morning snapshot is `{kind:'update', pct}` and ticks up. The near lanes' stripes are in frame at
  the warn.
- **The fight:** a solo Rat driven by `window.rr` won in about 25 s. The meter ring fills around the crosshair. The red
  hunt edge and the grille glow both show.
- **Shot `design/shots/c12-mowe-meter.jpg`:** the meter ring mid-fill around the crosshair during the hunt, with the red
  edge. No centre text.
- **The stamp:** MOW-E TAMED showed as the only centre element.
- **The fountain:** its 12–15 balls were on the grass around the ring. MOW-E was sinking at the pond within ~6 s.
- **Shot `design/shots/c12-mowe-fountain.jpg`** (a second fight): taken just after the stamp. A gold ball and a MOW-E
  ball are in the air at the ring, the stamp is the only centre element, and the feed reads "MOW-E's catcher burst: 1
  balls, ×2 each." (this fight's catcher held one ball). The solo plug lasted 3 s, too quick to catch a dragged-ring
  shot; the bots measured a 3.7–5.6 m drag.
- **The pane:** it was reported hidden, which is shared with other builders. I re-sent `link.move` and the wash acts
  from a timer, as tester A did.
- `?perf` p95 in phase 2 was **not measured**, because the pane was hidden.

## Tests

- `test/boss.test.mjs`: 26 tests, all passing. New or rewritten tests cover:
  - the HP and meter tables;
  - per-Rat meters and cooling, crossfire, decay, the stagger and the bolt cooldown;
  - eating one ball per 0.6 s;
  - the plug at 4/4, 3/4 and 2/4 holders and solo;
  - the crawl, the drag and the yank;
  - a lone holder winning in 15–26 s;
  - the drain and the reboot;
  - the splash ≤ 10 s after the stamp from four corners;
  - the fountain within 8 m, gold within 6 m, nobody flattened, the bell banking leftovers;
  - three pet passes, the richest spot, keeping out of the pond, the 25 cap;
  - the whistle (once a shift, only at the post, the bonus pass not using up a scheduled one);
  - the update bar;
  - 9.10 and 9.11;
  - builder 3's `moweBeat`.
- `test/words.test.mjs`: a builder-1 block, appended.
- The full suite: 1171 of 1171 passed before the 9.12 and `SFX.chant` work. `boss.test.mjs` has 27 tests since then. The seam goldens did **not** move in my run, since the boss only runs from Club
  day 3.

## Files touched

- **Mine:** `web/js/mowe.js`, `web/js/mower.js`, `web/js/sfx.js`, `web/js/confetti.js` (smoke only), `scripts/bots/boss.mjs`, `scripts/bots/pt7a-boss.mjs`,
  `test/boss.test.mjs`.
- **Shared:** `test/words.test.mjs` (an appended block).
- **`server/crew.mjs`:**
  - in my regions: `stepMowe`, `stepBossFight`, `moweWin`, the new `moweBell`, `whistleState` and `moweWhistle`, the
    import line, the snapshot (`mower` plus the `moweWhistle` / `moweBeat` line), and the `whistle` act beside `hold`;
  - **outside my regions, one line each:**
    - the customer-ball helper check (9.10, as briefed);
    - `this.moweBell()` before `mods.call('endShift')`;
    - the verdict event's `moweWon` (builder 3's hand-off).
- **`web/js/main.js`:**
  - the mowe import, `canWhistle`, the tamed feed line, `pressAct`, the prompt and `mowe.setPost`;
  - the spray colour line in `updateSpray`, the plug walk cap in the movement speed line, and the verdict feed line
    (builder 3's hand-off).

## Open issues

1. **Eating doesn't make blocking matter yet.**
   - The arena (z −6…−56) is nearly empty when MOW-E bursts: about 1 resting ball near it with the standard bot, and a
     richest spot of n = 2–3 with `SOFA=1`.
   - So the harvest eats 0–8 balls. The catcher fills from flattened Rats' pockets in the hunt instead (12 a
     knockdown).
   - The roles-vs-swarm gap is 4 balls, against a target of 8, and it's noise.
   - **The real lever is knockdowns:** a cart decoy means fewer pockets spilled. To make the harvest matter, the next
     loop could widen the arena toward the pond, or let MOW-E eat from the near lanes' windrow. That's a council call.
2. **The pet at 4P is field-limited.** Four Rats vacuum the field, so it brings 3–26 balls a shift (median 9) with the
   standard bot, and 13–50 (median 22) with a sofa crew. 1P meets the target.
3. **HP 12 at 4P makes a long pip row** on the Board: `MOW-E · ■■■■■■■■■■■■ · ATE 12`. Builder 4 may want a compact
   form, such as `■×12`.
4. **The 4P browser fight and `?perf`** weren't measured. The pane was hidden, and there's no 4-seat browser crew.
5. **The MOW-E post is 4 draw calls** on pet days. It could be merged into one mesh.
6. **One 94 s 1p-chase fight** (seed 31) ran past the 75 s target.
