# Council round 11, builder 1 ("mowe"): MOW-E Goes Rogue, the tame pet, MOW-E 2.0

The owner's call: "make the mower a big deal, like a boss moment". Brief: `council-round11.md` §2 and §3 item 1.
This is built on `84f3fad` plus the other three builders' work in progress. Nothing is committed: the lead commits.

## What I built

**The boss: a pure phase machine in `web/js/mowe.js`.** `bossDay`, `bossDue`, `newBoss`, `stepBoss`, `hoseBoss`,
`bossSnap`, `bossBoard`, `bossPayout`, `crewHP`, `huntSpeed`, `richest`, `cleanMowe`, and the `BOSS` constants. The
legacy daily pass (`stepMower`) is still there for its tests and for `BOSS.ON = 0`.

| Phase | What happens | One centre text |
| --- | --- | --- |
| **warn** (15 s) | It waits in the shed. The door rattles, the three near lanes get red-and-white stripes, the beeps speed up (every 2.0 s → 0.4 s), the Board counts down `MOW-E · ROGUE · 0:15`. Customer balls can't flatten a Rat from now to the end of the fight (`lookUntil`). | the PA caption "MOW-E updated itself. Please stand back." |
| **harvest** (to half HP, or 40 s) | It bursts out of the shed, then heads for the **richest spot** in its arena (the most resting balls within 6 m, re-picked every 4 s), eating every resting ball within 3 m into its catcher (30 at most). With nothing to eat, it runs the near-lane serpentine. | "MOW-E is loose! Block it. Hose its back!" |
| **hunt** (to HP 0) | It revs for 3 s and turns on the crew. Then it hunts the nearest Rat on foot (never a driver, a diver, a Rat aloft, or one flattened in the last 5 s). It re-aims every 3 s and turns at 120°/s, so a sidestep works. A red scan line runs to its target, and the target's screen edge pulses red with a beep. If it catches a Rat (1.3 m, solo 1.0 m), it knocks them down and up to 12 balls from their pocket go into its catcher. | "Now it hunts. Lead it into a cart!" |
| **plug** | It chokes: black smoke, an amber beacon, a ring at its back. Hold Ⓐ / Space / Click in the ring. The pull takes 2.4 s ÷ min(3, holders). If nobody holds for 10 s, it reboots at 1 HP with 15 s more on the clock. | "Pull the plug! Hold Ⓐ at its back!" (keyboard: "Space") |
| **tamed** | The win. It limps into the pond and sinks, then the PA plays the pond line. | the STAMP **MOW-E TAMED** (3 s), then the PA caption "MOW-E is in a better place. The pond." |
| **fled** | The loss: the 100 s cap runs out, or the bell rings mid-fight. It drives home to the shed. | none: the feed says "MOW-E kept 17 balls." |

**Hurting it.** Spray its back with the wand: from more than 110° off its nose, within reach + 1.2 m. One hit costs
2.0 s of spray ÷ the nozzle's `washRate`, and several hosers add up. A cart within 3 m in front of it stalls it for
6 s, and spray counts double while it's stalled. Then it shoves the cart 4 m aside: three honks, +0.4 mud, and that
cart can't block it again for 8 s.

**Two pacing rules I added** (they are not in the council's text; the bots needed them, see the numbers below):
- **The vent.** After a hit the grille shuts for 6 s, plus 2 s for each Rat past the first (8 / 10 / 12 s at 2P / 3P / 4P).
  Spray during the vent lands and does nothing. The grille glows red when it's open and goes dark while it vents.
  That means at most one pip per stall.
- **The bolt and the rage.** A hit in the harvest makes it bolt at 5.5 m/s for 2.5 s, so the hosers have to catch
  it again. When the hunt starts (or after a reboot) it revs in place for 3 s and turns to face the crew.

**When.**
- Club venue day 3 at 30 % of the shift.
- The rematch comes on the next Club day, with HP −1. Two losses and MOW-E is tamed anyway.
- MOW-E 2.0 comes on the first Stadium day ≥ 2: HP +1, speeds +10 %, Board `MOW-E 2.0 VS SITE 12 · ■■■■■`. It runs
  once, win or lose, and a win also tames him.
- Never in endless, and never on Promotion Day (the fight moves to the next eligible day).
- On a boss morning Gary slips a day (`garyvisit.js bossSlip`) and no Today modifier is dealt (`today.js todayFor`'s
  `boss`).
- The cap is shortened on short (dev) shifts, so the fight always ends before the bell. A bell mid-fight counts as a
  loss, so the crew is never stuck.

**The table by crew size** (§2.3):

| Crew | HP | Hunt speed |
| --- | --- | --- |
| 1P | 3 | 4.0 m/s |
| 2P | 3 | 4.2 m/s |
| 3P | 4 | 4.4 m/s |
| 4P | 4 | 4.6 m/s |
| 5–6P | 5 | 4.8 / 5.0 m/s |

The harvest runs at 3.5 m/s at every crew size.

**The win's payout (retuned).**
- The catcher, eaten ×2, banked as crew balls.
- One gold ball a Rat ("everyone grabs one", at most 5). They arc onto the grass in front of the return.
- Corporate's bounty: **10 × BV** (the council had 100).
- +1 commendation, and the night's **MOW-E Wrangler** award goes to the Rat with the most hits (`awards.js`).
- The next morning's memo line is "MOW-E sends his regards." On a loss it's "MOW-E is Employee of the Month."; after
  the second loss, "MOW-E's warranty expired. He's yours now." Builder 4's `memoSecond` reads `crew.moweMemo`, and the
  line rides in the save.

Why I retuned the payout: a 4P Club day-3 shift is only ~575 ball-weights in the bots. Five gold balls (×10 each)
plus 100 × BV alone came to ~26 % of the shift, against the council's 8–12 %.

**The pet** (`newTame` / `stepTame`):
- From the day after the win (or after the second loss), at every venue but endless: two passes a shift, at 25 % and
  60 %.
- On each pass it takes the richest of the six old lanes, gathers resting balls within ±3 m as it passes, and drives
  to the nearest owned return to bank them as helper balls.
- It stops 2.7 m short of any Rat or helper and beeps. After 6 s it creeps past, so a Rat standing still can't park it
  for ever. It never knocks anyone down.
- The Board shows `MOW-E · BRINGING 12 HOME`, and it wears a white flag.
- An old save past the Club loads untamed and gets no pet. The encore at the Stadium can still tame him.

**The save:** `mowe: { tame, lost, encore, memo? }`, one line in load and one in save. An old save loads untamed.

**The view** (`web/js/mower.js`, all built once, no per-frame allocation):
- on the mower: the catcher bag (scale 0.4 → 1.2 with eaten / 30), the emissive grille, the headlights and the
  red/amber beacon;
- the three striped near lanes (one InstancedMesh, the build-up only), the scan line (one Line, the hunt only) and the
  plug ring (one InstancedMesh of ticks with a gold sweep, the plug only): +1 draw call at a time while a boss is live;
- the shed door, the sink (nose-first), smoke puffs from the shared confetti pool with a new `tint` option, the red
  screen edge (a DOM element), and the MOW-E TAMED stamp (its own element in the bell stamp's style).

**Sound** (`web/js/sfx.js`):
- `moweEngine`: two detuned saws at 50 → 120 Hz, a lowpass 300 → 800 Hz, tanh 2.5, gain 0.03 / (1 + d / 15). It idles
  at 45 Hz with a rattle when stalled, coughs on a hit, and glides to 20 Hz on the unplug.
- `bossLoop`: a square bass on A–C–E–G and noise hats in eighths at 112 / 128 / 144 BPM (harvest / hunt / plug). At the
  plug the bass drops out for a heartbeat kick. It runs on a 50 ms look-ahead scheduler on the ducked SFX bus. It stops
  dead on a win and fades on a loss.
- `gurgle` for the pond, and the speeding build-up beeps (`horn('mower')`).

**The client** (`main.js`, my regions only):
- the `mower` / `honk` cases plus `moweHit` / `moweShove` / `moweTarget` / `moweBank`;
- the Board banner (`moweBoard`);
- the spray-target picker learns `'mower'`;
- the plug hold (Ⓐ / Space / Click in the ring, sent as `{ t: 'hold' }`, the huddle's hold);
- the bottom prompts "Hold Ⓐ: pull the plug" and "Get behind it: hose the grille" (shown when you hose its nose);
- each phase line is said once per fight under one say key, and is forgotten when the stamp shows.

## The numbers: `scripts/bots/boss.mjs` (new)

**The bot.**
- It starts from a Club day-3 snap (`club1` two days on) or from Stadium day 2 (`stadium1`, already tamed).
- Rats walk at real speed and sprint on stamina, pick up and bank balls outside the fight, and drive through
  `crew.input`, so the server's clamps and run-over rules apply.
- Hands are human-ish: a Rat notices the build-up 4 s late and holds the grille in the crosshair 1.5 s of every 2.5 s.
  `PERFECT=1` removes both, for an upper bound.
- Run it with `node scripts/bots/boss.mjs all`, or `POLICY [seed] [club|stadium] [days]`.

**Club day 3**, 10 seeds per policy (7, 11, 23 + 7 more):

| Policy | Wins (target) | Fight, s (target) | Eaten | Knockdowns | Payout / shift income |
| --- | --- | --- | --- | --- | --- |
| `4p-roles` | **10/10** (100 %) | 44–47, med 45 (45–75) | 1–30, med 30 | 0–4, med 2 | 8.6–19.8 %, med 17.6 % |
| `4p-swarm` | **10/10** (≥ 90 %) | 44–46 (≤ 90) | 6–30, med 30 | 1–3 | 10.1–20.3 %, med 19.1 % |
| `3p` | 10/10 | 41–43 | 8–30, med 18 | 1–3 | med 13.8 % |
| `2p` | **9/10** (≥ 85 %) | 41–47 | 0–27, med 3 | 0–1 | med 7 % |
| `1p-cart` | **10/10** (≥ 85 %) | 50–62, med 54 | 2–30, med 7 | 0–1 | med 8.2 % |
| `1p-chase` | **10/10** (≥ 60 %) | 44–76, med 63 | 0–23, med 3 | 0 | med 5.2 % |

**`idle`**, 4 days at 4P and 1P, seeds 7 / 11 / 23: every run goes the same way.
- Day 3: a loss (6–30 eaten).
- Day 4: the rematch, also a loss, so he's tamed.
- Days 5–6: tame passes.
- No softlock, and no fight ever ran past the bell.

**MOW-E 2.0 at the Stadium**, 6 seeds:

| Policy | Wins | Fight, s |
| --- | --- | --- |
| `4p-roles` | 6/6 | 58–67 |
| `4p-swarm` | 6/6 | 57–61 |
| `2p` | 6/6 | 41–60 |
| `1p-cart` | 6/6 | 50–73 |
| `1p-chase` | 6/6 | 46–73 |

The payout there is 3–10 % of a Stadium shift.

**Tame-pass balls per shift:** 6–23 (two passes), 4P and 1P. This is **under** the council's 30–80. See the open
issues.

**How the tuning got here.** The council's rules as written made an 8 s fight: three hosers took 4 HP in 3 s. With
human hands and no vent the fight was still 22–27 s, and the near lanes held 1–10 balls (the crew clears them first),
so nothing got eaten. The vent, the bolt, the rage and the "richest spot" harvest bring the 4P fight to 45 s with a
real eat-or-block choice. Solo stays at 50–76 s and is still a sure win for a careful player.

## The browser (rr-notes, :8098)

I played three real (non-test) crews made from the Club day-3 save through `POST /api/dev/crew`. My Rat was driven by
an in-page script through `window.rr` (?debug), using the same hold, wash and wand actions the pad sends. The fights
were solo: I couldn't seat four Rats in one pane.

| Shot | What it shows | Centre items |
| --- | --- | --- |
| `design/shots/c11-mowe-buildup.jpg` | the build-up PA card | one |
| `design/shots/c11-mowe-hunt.jpg` | the red screen-edge pulse; MOW-E alongside, its scan line, the grille | none |
| `design/shots/c11-mowe-mowed.jpg` | the hunt's knockdown, with the catcher bag | one: "MOW-E mowed you. It has been trained on your movements." |
| `design/shots/c11-mowe-plug.jpg` | the plug ring, the black smoke, the amber beacon | one: the plug line |
| `design/shots/c11-mowe-tamed.jpg` | the STAMP; the feed says "MOW-E's catcher: 6 balls home." | one |
| `design/shots/c11-mowe-pond.jpg` | MOW-E sinking by the dock | none |

The pond PA card ("MOW-E is in a better place. The pond.") played after it. The "loose" line showed once.

**Bug found and fixed in the browser:** the plug line could still be up behind the STAMP. Phase lines now share one
say key, and the stamp `forget`s it.

**Not done in the browser:**
- a cart stall (I couldn't drive the cart from the page script; it's covered by the unit tests and the bots: 2–4
  stalls a fight);
- a 4P browser fight (covered headless only);
- `?perf` p95 in phase 2. The pane was hidden, so rAF timing read 0.0 / 120 ms. That is not a measurement, and it needs
  a fronted pane or the Xbox. The overlay showed 168–488 draw calls depending on the view (488 looking at the return
  at the win).

## Tests

`test/boss.test.mjs` (new, 20 tests):
- the HP and speed table, and the rematch and encore modifiers;
- when it runs (Club day 3, the rematch, the encore, never on Promotion Day or in endless);
- Gary's slip and no Today on a boss morning;
- the build-up, and that the arena is inside the hose;
- a hit costs 2.0 s ÷ washRate from the rear arc, adds up across hosers, and is halved while stalled;
- the vent, the stagger and the bolt;
- the 6 s stall, the 4 m shove and the 8 s cooldown;
- phase 2 at half HP or 40 s;
- the hunt's target rules and the 3 s re-aim;
- the 5 s knock immunity;
- eating, the catcher cap, and "richest";
- the plug's 2.4 s ÷ min(3, holders), and the 10 s reboot;
- the cap, the flight home, the pond, and the Board lines;
- the win's payout in a real crew;
- the loss, the rematch at HP −1, and the warranty tame;
- the bell mid-fight is a loss;
- the tame pass (gathers, banks, stops short and beeps) and a tamed crew's passes;
- an old save loads untamed, and the save round-trips;
- every new centre line is ≤ 8 words, the award, and the engine and loop helpers.

Changed: `test/round2.test.mjs`, one line in `makeCrew`. A Club test crew "past the stagger" (venue day 3+) is now
also past MOW-E (`mowe: { tame: true }`), so a boss morning doesn't slip that file's Gary-day test.

**The suite:** 1120 pass. 3 fail, all of them the seam goldens (below).

## The seam goldens: they moved, as the council expected

I didn't re-record them. Cause: the boss (and, after it, the tame pass) on the Club golden's day 3, through its
eating, its RNG-free motion and its snapshot. I checked this on a clean `HEAD` copy with only my changes applied:
- with `BOSS.ON = 0`, every golden passes (the old fingerprints come out);
- with `BOSS.ON = 1`, only the Club fingerprints move, and the Muni's doesn't.

In the shared checkout, the other builders' changes move them too, so the lead re-records once.

## Files touched

- **Mine:**
  - `web/js/mowe.js`, `web/js/mower.js`, `web/js/sfx.js`, `web/js/pa.js` (`rogue`, `rogue2`, `pond`), `web/js/awards.js`,
    `web/js/garyvisit.js` (`bossSlip`), `web/js/today.js` (`boss`);
  - new `scripts/bots/boss.mjs` and `test/boss.test.mjs`.
- **`server/crew.mjs`, my regions:**
  - the imports;
  - `moweSt` / `moweMemo` in load and `mowe` in save;
  - the `'mower'` branch in `wash()`;
  - the whole `stepMowe` region (`bossToday`, `moweStart`, `stepBossFight`, `moweHose`, `moweWin`, `moweLose`,
    `stepTamePass`, `stepMoweLegacy`);
  - the snapshot's `mower:` (now `moweSnap`).
- **Outside my regions, kept as small as I could:**
  - `crew.mjs` `startShift`: one line after the Promotion Day line (`bossSlip`);
  - `dealToday`: `boss:` added to the `todayFor` call;
  - `web/js/confetti.js`: a `tint` option on `burst` (two lines);
  - `test/round2.test.mjs`: one line;
  - `design/game-design.md`: a section appended.
- **`web/js/main.js`, my regions:** the `mower` / `honk` cases, the Board banner, the spray picker, the plug hold and
  prompts. The confetti import also gained `confettiCount`.

## Hand-offs

- **Builder 2** (`story.js`):
  - `midDue` should take a `boss` flag. `crew.bossToday()` is truthy on a boss morning, and MOW-E 2.0 can fall on the
    Stadium's mid-beat day 2.
  - Gary's next Club sign-off after a win, "Saw the mower. Off the record: nice." (a `GARY_BYE` override). Not built.
- **Builder 3** (`stadium.mjs`), the crowd hook:
  - no drain while `bossLive(crew.mower)`;
  - +0.08 per hit (diff `crew.mower.hits`, or listen for `moweHit`);
  - 1.0 on `{ t: 'mower', phase: 'tamed', encore: true }`.
  - "It eats souvenirs too" is **not** built: `eatable` skips every `hands` ball, so his module's souvenirs are safe.
- **Builder 4:**
  - `crew.moweMemo` already feeds `memoSecond`.
  - For 8.5, the basket line should stand down while `bossLive(crew.mower)`.
  - The Board banner uses ■ and □: please check the jumbotron font draws them.

## Open issues

1. **The pet is under target:** 6–23 balls a shift against 30–80. Bot crews clear the old lanes first. Options: let
   the pass seek the richest spot (as the harvest does), or a third pass. I left the council's ±3 m lane.
2. **The payout share runs above the council's 8–12 % at 4P** (median ~18 %, up to ~20 %). That happens when the
   catcher fills, which is the "let it eat, win big" choice. The base win (nothing eaten) is ~8.6 %. The catcher cap of
   30 keeps it below a quarter of a shift. If it should be lower, lower `BOSS.CATCHER` or `PAYX`.
3. **The vent and the rage are my additions.** Without them a 4P fight lasts 8–27 s. Playtest whether 12 s at 4P
   feels like waiting. In the hunt the vent is not idle, since it keeps hunting.
4. **A shoved cart that someone is driving drifts back** to the driver's reported pose. A parked cart stays shoved.
5. **Smoke from the confetti pool reads as paper squares up close.** The puffs are small and few; a soft sprite would
   look better.
6. **Pre-existing:** the bottom prompt ("Click spray") showed under a centre ALERT in two shots. That's `hud()`'s prompt
   gate, not this change.
7. **Gary's schedule:** on the idle runs the boss slip put Gary on Club days 5 and 6 back to back (the missed-visit
   rule). This is A #8 (deferred).
