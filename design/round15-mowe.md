# Council round 13, builder 1 ("mowe"): MOW-E's loss is a beat, MOW-E 2.0 crashes Promotion Day, the aimed whistle

Items 3 and 5 of `design/council-round13.md`. The owner's call: MOW-E is "a big deal, like a boss moment". Losing is
now a story beat too, not a silent feed line.

## What I built

### 3a · The loss, told
- **The stamp.** A lost fight gets the TAMED stamp's twin: **MOW-E WINS**, solid red with cream text, tilted the other
  way, for 2 s (`say('STAMP')`, so it goes through `centre.js` at priority 1). The encore's twin reads **MOW-E 2.0 WINS**.
- **Then one line** (`say('ALERT')`, queued behind the stamp):
  - "MOW-E got away. Rematch tomorrow." only when it's true (`rematchNext`): not the second loss, not the encore, and
    the card can't be signed or turn into Promotion Day by tomorrow (`promoNear`: every goal but the reviews and the fee
    done, the reviews ≤ 2 short, the fee ≥ 60 % saved);
  - otherwise "MOW-E got away. For now.", which is never false.
- **The retreat.** MOW-E drives home with the catcher bag rattling. The shed's roller door is up while it drives, and
  slams down behind it (`SFX.slam`: a thud, a clang, a rattle).
- **The Board.** `MOW-E 1 · CREW 0` once the 30 s `MOW-E WINS · REMATCH NEXT CLUB DAY` banner ends, for the rest of the
  day. The next morning's update bar takes over until the rematch.
- **A fight the bell beats** is now settled in `endShift` before the report reads it, so the report always has the row.
- **The report** has a MOW-E row above the review stamp, won or lost (`moweRow`):
  `MOW-E: got away · kept 20 balls · rematch tomorrow` / `MOW-E: tamed · 18 balls · 4 gold`.

### 3b · `tomorrowText` knows about MOW-E
- A new last argument, `mowe` (`moweEve(bossDay(tomorrow), st)`), comes after the "card ready" line and **ahead of
  Gary's**:
  - the boss eve: "Tomorrow: MOW-E finishes its update.";
  - the rematch eve: "Tomorrow: MOW-E's rematch. Wands at the bell.".
- A Promotion Day's line still replaces it at the bell, so the crash stays a surprise.

### 3c · MOW-E 2.0 crashes Promotion Day
- `bossDay` returns `'encore'` on a Stadium Promotion Day (venue day ≥ 2) with the encore unplayed.
  - **A change from the brief:** it doesn't need a tame MOW-E, because the encore never did. The 4P ladder bot's crews
    reach the Stadium untamed (the bot doesn't fight at the Club). With the tame check, 2 of 3 seeds still missed the
    sequel.
- **The warn comes at T−4:00.** `BOSS.PROMO_AT` is 180 / 420 of the shift (`bossAt`). The update bar runs to it, and
  the Board reads `PROMOTION DAY · MOW-E 2.0 UPDATE ▓▓░`.
- **The PA:** `pa.js` `crash`, captioned "MOW-E heard about the ceremony." (one line in builder 3's file).
- **Gary's mid beat** (`mid:3`) plays on the crash morning if it hasn't played (`midDue`). Gary is no longer slipped off
  the day (`bossSlip` skips Promotion Day), so he still rides along and inspects.
- **A win** pays as the encore does and stamps **MOW-E 2.0 TAMED**.
- **A loss** leaves through the left stands (`BOSS.STANDS_EXIT`, no door slam): "MOW-E 2.0 left. It took the
  bunting." It doesn't touch `promoDay`. `encore` is set either way.

### 3d · The payout trim
- The fountain pays **×1.5** (`BOSS.PAYX`, exported as `BURST_MULT`).
- 4P medians were still 14 % at ×1.5, so I took the brief's fallback: **the catcher holds 24 at 3P+**
  (`BOSS.CATCHER_3P`); 1P and 2P keep 30.
- The gold and the bounty are unchanged.

### 3e · Teach the sidestep
- **The hunt line:** a crew of 1–2 gets "Step aside, then hose its back!" (`BOSS_LINES.huntSolo`). 3P+ keep "Lead it
  into a cart!".
- **The dodge edge:** the first hunt of each fight, the hunted Rat's red edge is a gradient on **one side only**: the
  side to step toward (`sidestep(s, p)`, perpendicular to its heading, toward the side the Rat is already on). After
  that it's the old all-round pulse.
- **The rev puff:** `bossSnap.rev` is true in the last 0.5 s before each 3 s re-aim. The client puffs two black smoke
  sprites and coughs the engine.

### 3f · The leftovers
- `bossOwnsScreen(mower)` (warn → stamp) is exported for builder 3.
- `moweYank` (the plug's creak and the ring's jerk) and `moweWhistle` events were never reaching `mower.js`. They're
  wired now.
- **Handed off:** the "MOW-E is loose!" toast in the PA-card style. It's still a `say('ALERT')`, which `centre.js`
  already ranks at priority 1, but its look is `say.js`'s (builder 3).

### 5 · The aimed whistle
- **Taking it.** Ⓐ at the MOW-E post takes the whistle (prompt "Ⓐ: take MOW-E's whistle").
  - One Rat carries it (`whistleCarrier()`). Picking up still works, and a carrier who leaves puts it back.
  - `moweWhistle` gains state **3 = carried**, plus `moweWhistleBy` in the snapshot.
  - Mates see it on the carrier's lanyard (one small mesh that shares the post's geometry and material). The post's
    whistle hides while it's away.
- **Blowing it.** Out in the field, 20 m or more from the nearest return (`canBlow`), with no ball in reach and no wand
  in hand, Ⓐ blows it (prompt "Ⓐ: whistle MOW-E here").
  - The spot is the **server's own position** for the Rat. An `x, z` sent with the act is ignored (tested).
- **The pass.** MOW-E drives from the shed to the strip's far end, then mows `whistleStrip(at, ret)`: 10 m wide, 30 m
  long, through the spot toward the return. It takes up to 30 (`WHISTLE.CAP`) and banks at the nearest return.
  - If a pass is already out, the whistle queues (with its spot) behind it.
  - **Member balls** (builder 2's Tournament) inside the strip are handed to `crew.mods.signal('member', { id })`, and
    `tourney.mjs` banks them ×25 as MOW-E's.
- **Once a shift.** It doesn't use up a scheduled pass.
- **Smaller passes:** two a shift, at 30 % and 65 %, of **12** each (`TAME.AT`, `TAME.CAP`).
- **Told and credited:**
  - the feed: "Pip has the whistle." → "Pip whistled. MOW-E's on his way." → "MOW-E brought 28 home.";
  - the memo after the win: "MOW-E sends his regards. Whistle at the post.". It's `BOSS_LINES.regards`, so there's no
    hand-off.
- **Handed off:** the HUD icon → builder 4. It reads `crew.moweWhistle`: 1 on the post, 3 carried (dim), 2 used (gone).

## Measurements

### Item 3: the boss table (`SEEDS=7,11,23,31,41,53 node scripts/bots/boss.mjs all`)

Shares are the payout over the shift's income, at ×1.5 with the 24 cap at 3P+.

| Policy | Win rate | Club share (6 seeds, sorted) | Median | Target |
| --- | --- | --- | --- | --- |
| 4p-roles | 6/6 | 8.5 8.6 13.3 13.3 14.0 14.4 | **13.3 %** | 9–12 % (max 14) |
| 4p-swarm | 6/6 | 8.6 9.7 9.7 13.1 13.7 15.0 | **11.4 %** | 9–12 % |
| 3p | 6/6 | 7.7 9.1 9.5 11.0 12.3 12.6 | **10.3 %** | 9–12 % |
| 2p | 6/6 | 5.9–10.7 | 6.8 % | — |
| 1p-cart | 6/6 | 4.7–7.6 | 6.6 % | — |
| 1p-chase | 6/6 | 3.8–7.4 | 4.8 % | — |
| Stadium encore, 4p / 1p | 24 / 24 | 4.1–7.0 | — | — |

- Round 8 was 12–21 % at 3P/4P.
- 3P and 4P-swarm are now in the band. **4P-roles is not:** median 13.3 %, max 15 %.
- The floor (bounty and 4 gold, with nothing eaten) is ~8.5 %. A full catcher of 24 adds ~5 points, so a 4P crew that
  lets it eat sits at 13–14 %.
- Every win-rate target holds (100 % in every policy). Fights run 50–71 s at 4P.

### Item 3: the crash (`POLICY=moweobs STOPV=4 node scripts/bots/late11.mjs 4 <seed>`, 4P, from the ladder)

| Seed | Met MOW-E 2.0 | How | `story:mid:3` | Stadium shifts |
| --- | --- | --- | --- | --- |
| 7 | yes | the encore, day 15 (venue day 2) | yes | 2 |
| 11 | yes | **the crash**, day 15 Promotion Day, warn at 180 s | yes | 2 |
| 23 | yes | **the crash**, day 15 Promotion Day, warn at 180 s | yes | 2 |

- **3 of 3** meet MOW-E 2.0 (round 8: 1 of 3), and 3 of 3 see `mid:3`. The Stadium is unchanged at 2 shifts.
- The ladder bot ignores the boss, so those were losses, and the promotion still went through on both crash runs.
- From builder 4's `stadiumPromo` preset with `boss.mjs` 4p-roles (seeds 7 / 11 / 23): the crash warns at 180 s, the
  crew wins 3 of 3, and the share is 6.7–7.7 %. The report row reads `MOW-E 2.0: tamed · 24 balls · 4 gold`.

### Item 5: the pet table (`WHISTLE=0|post|aim node scripts/bots/boss.mjs pet`)

From builder 4's `club4` preset, 2 pet days × seeds 7 / 11 / 23, with N Rats doing the day job.

| Crew | Never whistled: pet/shift (share) | `post`: pet/shift | `aim`: pet/shift | `aim`: whistle share | `aim`: pet share of banked, median (max) |
| --- | --- | --- | --- | --- | --- |
| 1P | 21.3 (3.9 %) | 23.3 | **48.5** | 58 % | **9.2 % (10.3)** |
| 2P | 17.7 (2.6 %) | 17.8 | 37.8 | 48 % | 6.5 % (6.9) |
| 3P | 19.8 (2.4 %) | 23.3 | 30.0 | 48 % | 4.2 % (6.1) |
| 4P | 12.7 (1.4 %) | 8.2 | 25.8 | 58 % | 3.7 % (4.6) |

- **The lazy whistler** (`post`: blow it 22 m out, no aim) gets ~nothing from it. The aim is the value.
- **Targets met:**
  - pet balls a shift with `aim`, 30–55, at 1P–3P (4P's bot crew vacuums the field);
  - never whistled, 18–24, at 1P–3P;
  - the whistle's share, ≥ 40 %, everywhere.
- **The pet's share of balls banked** (target ≤ 8 %) holds at 2P–4P but **not at 1P: 9.2 % median**.
- `mid.mjs` from `club4` (`WHISTLE=aim`, 1P, seeds 7 / 11 / 23) agrees:
  - 42–51 pet balls a shift;
  - a whistle share of 43–53 %;
  - a pet share of 10.4–12.0 % (median).
- `mid.mjs` 4P, `WHISTLE=aim` + `TOURNEY=1` (member fetches): see "Member fetches" below.

### Member fetches
- `mid.mjs` from `club4`, 4P, `WHISTLE=aim TOURNEY=1`, seeds 7 / 11 / 23:

  | | Seed 7 | Seed 11 | Seed 23 |
  | --- | --- | --- | --- |
  | Pet balls a shift | 46.5 | 36.0 | 41.5 |
  | Whistle share | 48 % | 33 % | 42 % |
  | Pet share of banked (median) | 8.8 % | 5.3 % | 9.2 % |
  | Whistles aimed at a member's ball | 0 | 0 | 1 |

  The policy takes the whistle early on Tournament days and blows it at a member's ball when one is out.
- At 1P (`WHISTLE=aim TOURNEY=1`, same seeds): 44–54 pet balls a shift, a whistle share of 45–56 %, a pet share of
  10.2–12.7 %, and 0 member whistles.
- **The target is missed** (≥ 1 member ball a shift in ≥ half the shifts). Two things beat MOW-E:
  - a member ball has 30 s on its clock, and MOW-E starts from the shed (x −58), so it reaches the strip in ~10–20 s;
  - builder 2's `TOURNEY=1` Rats grab the balls first.
- The fetch itself works: `crew.mods.signal('member', { id })`, unit-tested.

## Browser (`rr-notes`, a Club day-3 save loaded with `POST /api/dev/crew`, solo, lost on purpose)

- **The centre sequence**, from a 250 ms DOM poll of every centre element:

  | Shift s | Centre |
  | --- | --- |
  | 126 | the PA "MOW-E updated itself. Please stand back." |
  | 143 | "MOW-E is loose! Block it. Hose its back!" |
  | 184 | "Step aside, then hose its back!" (the solo hunt line) |
  | 241 | the **MOW-E WINS** stamp |
  | 243 | "MOW-E got away. Rematch tomorrow." |

  **One centre element at a time throughout.** The `window.__centre` counter isn't in the build yet (builder 3's
  `main.js` sweep goes last).
- **The report:** `MOW-E: got away · kept 20 balls · rematch tomorrow`, then the review stamp, then "Tomorrow: MOW-E's
  rematch. Wands at the bell."
- **Shots:**
  - `design/shots/c13-mowe-loss-stamp.jpg`: the red stamp, held on screen for the capture;
  - `design/shots/c13-mowe-loss-report.jpg`: the report's MOW-E row and its Tomorrow line.
- **Not shot** (see the open issues): the shed door, the crash warn, and the whistle carried and mowed. The pane was
  hidden, and a second dev crew stalled in the lobby under the bot load.

## Files touched
- **Mine:**
  - `web/js/mowe.js`;
  - `web/js/mower.js`;
  - `web/js/sfx.js` (`slam`);
  - `web/js/story.js` (`midDue`);
  - `scripts/bots/boss.mjs`: `pet` mode, `SEEDS`, the whistle policy, `clubDay4Tame` from `club4`, and `D.banked` /
    `D.mowe`;
  - new `scripts/bots/policy/whistle.mjs`;
  - new `scripts/bots/policy/moweobs.mjs` (watch-only; `POLICY=moweobs` with any bot);
  - `test/boss.test.mjs`.
- **`server/crew.mjs`, my regions:**
  - the imports line;
  - `stepMowe`: the whistle queue carries a spot, and it's cleared at the bell;
  - `moweStart` (the crash);
  - `moweWin` and `moweLose` (the report row, the rematch line, `lostN`);
  - `whistleState`, `whistleCarrier`, `moweWhistle` (take / blow);
  - `stepTamePass` (the member signal; `moweBank.whistle`);
  - `endShift`: the bell-beaten loss and the report's `mowe` entry;
  - `tomorrowText` and its call.
- **`server/crew.mjs`, outside my regions (small):**
  - the snapshot line: `updateSnap(…, isPromotionDay(this))` and `moweWhistleBy`;
  - `startShift`'s `bossSlip` line (my round-11 line): it doesn't slip Gary on Promotion Day.
- **`web/js/main.js`, my regions:**
  - the mowe imports and a `layout.js` `nearestReturn` import;
  - the mower event cases (`moweYank`, `moweWhistle`, `moweBank`);
  - `moweEvent` (the loss stamp and line, the solo hunt line, the crash stamps, the whistle feed);
  - `canBlowWhistle` and the Ⓐ press;
  - the prompt line;
  - `mowe.setPost(…)`.
- **`web/js/main.js`, outside my regions:** one line in the report body for the MOW-E row.
- **Other owners' files (one line each):**
  - `web/js/pa.js` (b3): the `crash` PA line;
  - `test/words.test.mjs`: my append-only block;
  - `test/goalcard.test.mjs`: two saves get `mowe: { tame: true }`, so their Club day 2 → 3 bell isn't MOW-E's eve.
    Their expected Gary and card lines are unchanged.
- **`design/game-design.md`:** the round-13 builder-1 section.

## Tests
- **`test/boss.test.mjs`, now 37 tests (one more for the lead's calls, below):**
  - **round 12's, updated:** ×1.5, passes at 30 / 65 % of 12, the whistle's take then blow, one carrier, no blow within
    20 m, server-positioned, once a shift;
  - **new, the whistle:** the strip's geometry and its 30 cap (only balls inside the strip); a member ball fetched only
    inside the strip;
  - **new, the loss path:** the stamp and line; "Rematch tomorrow" true for tomorrow's `bossDay`; the Board's
    scoreline; the report row; the rematch-eve Tomorrow line; the `promoNear` hedge; a bell-beaten fight still writes
    the row; `tomorrowText` on the boss eve (in a crew) and the rematch eve;
  - **new, the crash:** `bossDay` 'encore' on a Stadium Promotion Day and null after; the 180 s warn (179 not, 180
    yes); the `crash` PA; a crash loss sets `encore` and keeps Promotion Day; `mid:3` on the crash morning;
  - **new, the trims and the tell:** the catcher at 24 for 3P+; the dodge side perpendicular to the heading and toward
    the Rat's side; `bossOwnsScreen`; the rev flag;
  - **new, the words:** every new line ≤ 8 words.
- **`test/words.test.mjs`:** builder 1's round-13 block.
- **The seam goldens did not move** (`test/seam.test.mjs` 20/20).
  - The changes run only on boss and pet days, and nothing new draws RNG.
  - The Club boss days aren't in the seam runs, or are BOSS.ON-gated.
- **`node --test test/`:** **1246 / 1246 pass** (the start was 1172, before every builder's additions).

## The lead's calls, applied after the first report

Kept as they were:
- the crash needs no tame MOW-E;
- the 4P-roles payout (13.3 % median): the gold and the bounty are the trophy.

Changed:
1. **The 1P strip holds 14.** `WHISTLE.CAP_1P`, via `whistleCap(n)`; 2P+ keep 30.
   - I tried 20 first. With it, 1P `mid.mjs` still ran 8.3–9.3 %.
2. **The whistle pass sets out from the MOW-E post** (by the return), not the shed.
   - A member ball in the strip now counts once the mowing is within 8 m of it (`WHISTLE.MEMBER_AHEAD`).
   - Without that, the whistler standing on the ball parks MOW-E (it stops short of a Rat), and the caddie took it.
   - Traced in a crew: a member ball 90 m out, whistled at 125 s, was banked as MOW-E's at 145 s ($2,262, ×25). The
     caddie came at 150 s.
3. **On the crash day, Gary's warn waits until the fight is over.** `stepGary` doesn't start him while
   `bossLive(mower)`. It's one condition in crew.mjs's Gary region, a small edit outside mine.
   - Test, solo and idle, so the fight runs to its 100 s cap: the warn comes after the fight ends, and his verdict still
     lands before the bell.
- **The whistle bot** (`policy/whistle.mjs`):
  - on Tournament days it takes the whistle early;
  - it walks to a spot 12 m short of the nearest member ball, on the ball's line to its return;
  - it re-picks if the ball goes;
  - it counts the member balls MOW-E actually fetched.

**Re-measured** (`mid.mjs` from `club4`, `WHISTLE=aim TOURNEY=1`; and `boss.mjs pet`, 1P):

| | Seed 7 | Seed 11 | Seed 23 | Target |
| --- | --- | --- | --- | --- |
| 1P pet share of banked, median (`mid.mjs`) | 6.7 % | 7.4 % | 9.0 % | ≤ 8 % |
| 1P pet balls a shift | 30.2 | 30.6 | 36.4 | 30–55 |
| 1P whistle share of the pet's take | 21 % | 22 % | 34 % | ≥ 40 % |
| 4P member balls MOW-E fetched (Tournament-day shifts with ≥ 1) | 1 of 1 | 1 of 1 (2 balls) | 0 of 1 | ≥ half |
| 1P member balls fetched | 0 of 1 | 0 of 1 | 0 of 1 | ≥ half |

- `boss.mjs pet` at 1P (Club days only, 3 seeds × 2 days): pet share 4.6 % median (max 5.1 %), 26 pet balls a shift.
- **The 1P share now sits at ≤ 8 % in 2 of 3 seeds.** Seed 23 banks less (~400 a shift) and stays at 9 %.
- **The cost: the whistle's share at 1P drops below 40 %.** The two scheduled passes (24) now outweigh a 14-ball
  strip. That's the trade the call asked for.
- **Member fetches:**
  - **4P: 2 of 3** Tournament-day shifts, which meets "≥ 1 a shift in ≥ half";
  - **1P: 0 of 3.** A solo whistler walking 60–140 m out can't beat the 30 s clock on foot.
- The 4P pet share is 8.8–9.8 % median in `mid.mjs`. That wasn't in this call.
- **Suite:** `node --test test/` **1246 / 1246** after these changes. The seam goldens are unchanged.

## Open issues
1. **4P-roles payout, 13.3 % median.** Kept by the lead's call.
2. **The 1P pet:**
   - the share is ≤ 8 % in 2 of 3 seeds (9 % in one);
   - the whistle's share at 1P is now 21–34 %, under the ≥ 40 % target, because of the 14 cap.
3. **Member fetches at 1P are 0** (a walking whistler vs a 30 s clock). 4P meets the target.
4. **The browser shots I couldn't take:**
   - the shed door slam;
   - the `stadiumPromo` crash warn with one centre element;
   - the whistle carried, and MOW-E mowing the strip.

   The code is unit-tested and bot-measured, but a playtester should take them.
5. **`promoNear` is a heuristic.** In any unsure case the loss line says "For now", and the report's Tomorrow line
   (computed at the bell) is authoritative.
