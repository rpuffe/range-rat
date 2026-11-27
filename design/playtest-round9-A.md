# Playtest round 9, playtester A: a new crew's first night (Muni day 1 → the Club day-3 MOW-E boss, lost and won)

Build cee02b3. Preview `rr-play-a` (:8094, `?debug`).

**How I played**
- **Browser, solo, a real new crew.** I played Muni days 1–4 in full: the cold open, the checklist, the washer buy, the day-2
  target, the day-3 gold, and Gary's day-4 visit (failed, 3 problems). Then I used Skip ahead → Range Club day 1 (the
  promotion reveal).
- **The boss.** I loaded a Club day-3 save (club1 + 2 days) through `POST /api/dev/crew`.
  - Day 3: I ignored MOW-E and **lost**.
  - The next morning I played the **rematch** and **won** with the wand and the plug.
- **A second new crew.** I cleared the `rangerat.hints.v1` key and replayed Muni day 1 into day 2, just for the tips.
  The first crew's profile had all 20 tips marked seen by earlier testers on this origin.
- **How my Rat moved.** The shared pane was hidden all session, so rAF ran at 0 fps even with my tab fronted. Two
  workarounds:
  - I swapped `requestAnimationFrame` for a 40 ms `setTimeout`, so the client ran at ~25 fps hidden.
  - An in-page script moved my Rat. It walked at 0.95 × walk speed and sent `act`/`interact`/`crank`/`fill`/`wash`
    itself. To spray, it called `rr.pressAct()`.
- **Logging.** A 100 ms DOM poller logged every change of text and class on the centre elements, with the shift clock.
  - CSS transitions freeze in a hidden pane, so opacity can't be trusted (see the artefacts note).
  - `window.__centre` read **0 overlaps, but over only 4 samples and 0 painted frames**. In a hidden pane it proves
    nothing. My own log is the evidence below.
- **Headless.**
  - `muni.mjs` at 1P (`chat prep`) / 2P / 4P × seeds 7 / 11 / 23, with `CALLS_JSON`.
  - `mid.mjs` from the `club1` preset (`START_FILE`, `FIGHT=55`) at 1P / 4P × 3 seeds.
  - `boss.mjs all` and `SOFA=1 boss.mjs all`.
  - A tiny `tomorrowText` probe (Club day 2 → the boss eve).

**Shots** (`design/shots/`):
- `pt9-A-cold-open.jpg`
- `pt9-A-day1-report.jpg`
- `pt9-A-muni-day3.jpg`
- `pt9-A-club-reveal.jpg`
- `pt9-A-club-spawn.jpg`
- `pt9-A-boss-warn.jpg`
- `pt9-A-boss-invisible.jpg`
- `pt9-A-boss-mowed.jpg`
- `pt9-A-rematch-hosing-nothing.jpg`
- `pt9-A-boss-loss-report.jpg`

## 1. Findings

| # | Sev | Finding | Repro / evidence |
|---|---|---|---|
| 1 | **Critical** | **MOW-E is invisible, and so is everything it draws per frame.** In `cee02b3`, `mowe.tick(dt, sceneT, me)` was swallowed into a comment at `web/js/main.js:2151`: `…setPost(…);   // round 13 #5a: … lanyard mowe.tick(dt, sceneT, me);`. `git log -L` shows it was live in 966eace. Without `tick`, nothing in `mower.js` ever sets `root.position`, so the boss mesh sits at the world origin and never moves. Also dead: the blades, the beacon, the warn beeps, the amber shed-side pulses, the red hunt edge and its dodge side (3e), the rev puff, the plug creak, the engine sound, the post-tame chevron, the **shed door slam on a loss (3a)**, and the **whistle post** (`post.visible` is only set in `tick`, so the aimed whistle of item 5 has no visible post). The tame pet on Club days 4+ is stuck at the origin too. | Club day-3 save, solo. I stood 3.6–11.6 m from `crew.mower` facing it, in harvest and in hunt: empty grass (`boss-invisible`, `rematch-hosing-nothing`). The scene's `mower` group read `pos 0,0` while the snapshot read (−11.7, −35.4). I was then "mowed" 5 times in 40 s by nothing (`boss-mowed`). **Fix:** move `mowe.tick(dt, sceneT, me);` back in front of the `//`. The suite can't see this (`main.js` isn't unit-tested) and the boss bots are headless. Builder 1's browser check predates builder 3's `main.js` sweep. |
| 2 | High | **The same mowed line repeats every ~9 s.** "MOW-E mowed you. It has been trained on your movements." (9 words) showed 5 times in a row at 187 / 196 / 205 / 213 / 222. It's funny once; on the fifth time it's a nag, and it's over 8 words. With #1 fixed it will fire less often, but it should still be once a fight, then a short "Mowed again!". | Loss run, a solo Rat idle in the hunt. |
| 3 | Medium | **Gary's day-4 inspection stacks three instructions in 13 s.** "Gary is inspecting. Stay out of his way." was up for under 1 s (shown and hidden in the same poll second, 276). Then the checklist went "Gary checks the mats. Hose them!" (277) → "Keep Gary talking: hold Click!" (286) → "Stall Gary: ping his cart!" (289) → the verdict (295). Each line is fine; together they read as conflicting orders for a solo player. | Muni day 4, solo, mats ~0.6 mud. |
| 4 | Medium | **The Club spawn faces the walkway, not the range.** At −0.28 pitch you see the path, the gate and the bay partitions, with the field as a sliver at the right (`club-spawn`). No roof, which fixes round 8's complaint, but the first frame still isn't the venue. | Skip ahead → Club day 1, the first frame after the reveal cards. |
| 5 | Medium | **The checklist line blinks off on every cash pop.** The checklist is an idle claim, so each "+$5.40" toast takes the centre for ~2 s and the line vanishes (229 → 231, 165 → 168, 179 → 181…). On day 1 that's every bank. It reads as the line flickering. Suggestion: draw cash pops off-centre (by the cash HUD) and don't let them claim the centre. | Muni day 1, any bank. |
| 6 | Low | **The Gary drive-by PA and the day-4 story card arrive back to back** ("Gary. Regional Manager. He has a clipboard." and "Site 13 doubled you. Be more Site 13."). They were one at a time, but it's 3 cards + memo + PA inside ~25 s. | Muni day 4 morning. |
| 7 | Low | **The ledger names "Employee of the Shift" with 0 banked and $0** (Club day 3 loss, solo). | Loss report shot. |
| 8 | Low | **"Goals for Range Club" on the Muni report** reads as goals *at* the Club, not *to reach* it. "To reach the Range Club" would be clearer for a first-night crew. | Day-1 report shot. |
| 9 | Low | **The washer goal pays less than it showed:** the report showed ✦ +$56.96, and the buy mid-day 2 paid +$53.44. The BV moved between the two (8.4 fixes it only at the buy moment). | Muni day 1 report → buy on day 2. |
| 10 | Low | **"Wands at the bell."** (rematch eve): new players read "the bell" as the end of the shift. "Wands ready at T−5" or "Wands out early" would be clearer. | Loss report. |
| 11 | Low (data) | **The pet's payout share is still high on a sofa field.** `SOFA=1 boss.mjs`: 4P 13–22 % (roles 17.7–22.4 %), 3P 15–17 %, 2P 7–17 %. The target is 8–12 %. Without SOFA it's 8–15 % at 4P. | `boss-sofa.log`. |

**Checked and fine:**
- **Tips are not regressed.** With a cleared hints key, a new crew got "Full. The ball return pays per ball" (187 s), "Land a crew ball on a green: Hustle." (210 s) and "Hold Shift to sprint" (225 s) on day 1, after the checklist. On day 2 it got "Tab opens the shop" (103 s). Each showed for 3 s with nothing else centred.
  - A tip waits behind the day-2 nudges ("Fill the bucket basket!", "Try picking the far field."), as `tipsAllowed` intends.
  - A tester whose profile already has `rangerat.hints.v1` full will see almost no tips. Clear it before judging tips.
- **One centre text at a time.** Across ~40 minutes of my log, no two of story / PA / memo / tip / checklist / toast
  were shown in the same poll. Every handover went hide-then-show.
- **The loss beat works in text:** MOW-E WINS stamp (241) → feed "MOW-E kept 30 balls." → "MOW-E got away. Rematch tomorrow." (243) → report row `MOW-E: got away · kept 30 balls · rematch tomorrow` → "Tomorrow: MOW-E's rematch. Wands at the bell." The win row reads `MOW-E: tamed · 5 balls · 1 gold`.
  - The boss eve reads "Tomorrow: MOW-E finishes its update." at 1P and 4P (probe).
- **The boss's centre stayed clean.** No basket nag or customer-left feed between the warn and the stamp. The plug prompt appeared only in the plug phase.

**Artefacts, not bugs:**
- A hidden pane freezes CSS transitions. Stamps ("APPROVED", "MOW-E WINS", "DENIED") hung at 0.16–0.88 opacity behind later screens until the next screenshot repainted. Their `style.opacity` was 0.
- "Lowered graphics to keep it smooth" fired every ~14 s. That's my 25 fps rAF shim. It's still worth checking that it fires once, not repeatedly, on a slow Xbox.

## 2. The story

| Beat | Landed? | Notes |
|---|---|---|
| Cold open (3 cards + PA, ~18 s) | Yes | "Every ball hit since 1958 is outstanding." and "Site 13 is already ahead of you. Somehow." set the tone in 15 words. The clock runs under the cards (3:57 → 3:41 before the first input), which is fine on a 4-minute day 1. |
| Day 2: the photo | **Best beat** | "✦ Found behind the shed: a photo, 1958." / "The founder, mid-swing. The ball never landed." / "Site 13 doubled you. Be more Site 13." It's touching then funny in 10 s, before the memo. |
| Day-2 memo | OK | "Today: 60% clean by the bell. Corporate has sent a teenager to help." That's 13 words, so it's long for the slot, but it's the memo. |
| Day 3: gold | Quiet | Only the memo line "NEW: gold balls. ×10. Dimples watches." There's no moment when the first gold lands. |
| Day 4: Gary | Yes, a bit busy | "Gary. Regional Manager. He has a clipboard." is great. The inspection's line churn is finding #3. "Gary: 'Noted. Everything is noted.'" in the feed is perfect. |
| The Club reveal | Yes | The PA "Promoted to the Range Club. Parking unchanged.", then Gary's "The Club. I raked this pond once.", "Site 13 made the Club last week.", "Dimples now wears a monocle. For the members." Four funny lines, readable, about 12 s (`club-reveal`). |
| The boss PA and lines | Text yes, picture **no** | "MOW-E updated itself. Please stand back." and "MOW-E is in a better place. The pond." both land. But with #1 the fight has no picture, so the beat is a toast story. |
| The loss beat | Text yes | "MOW-E got away. Rematch tomorrow." and the report row make a cliffhanger. Its visual half (the drive home, the door slam) is dead (#1). |

**Not seen:**
- The Club day-2 treasures and Gary's Club lines (I skipped Club day 2 with the save).
- The Tournament and the whistle (outside my stretch, and invisible anyway, #1).

## 3. The fun in my stretch

- **The best minute:** the rematch hunt. It's "Step aside, then hose its back!" → "Pull the plug! Hold Space at its back!" → MOW-E TAMED → "catcher burst: 5 balls, ×1.5 each" → the pond PA, 30 s end to end at hp 2. Even blind, the rhythm (dodge, hose, plug) is the best structure in the first hour.
  - **But today the boss is not the high point. It's the low point.** You're hunted and mowed by nothing, and a parked mower sits at the origin. Fix #1 and it's the high point again. The bots still say the fight is right: 4P 51–69 s, 1P 52–84 s, all wins.
- **The dead minute:** Muni day 3, T−3:30 to the bell.
  - From 210 s to 420 s my log has **zero centre items and zero calls**, only "BONK" knockdowns.
  - The bots agree that day 3 is the Muni's flattest day after day 1:

| Muni, calls a minute (full / r8) | d1 | d2 | d3 | d4 | d5 | Whole Muni |
|---|---|---|---|---|---|---|
| 1P (chat prep) | 0.25 / 0.25 | 0.50 / 0.50 | **0.43 / 0.43** | 0.76 / 0.43 | 0.81 / 0.57 | **0.58** / 0.45 (15 shifts, 5 a seed) |
| 2P | 0.25 | 0.50 | **0.57 / 0.43** | 1.00 / 0.43 | 0.57 | **0.62** / 0.42 (4–5 shifts) |
| 4P | 0.25 | 0.50 | **0.71 / 0.43** | 0.95 / 0.43 | — | **0.65** / 0.42 (4 shifts) |

- **Club** (`mid.mjs` from `club1`, `FIGHT=55`):

| Club, calls a minute (full / r8) | d1 | d2 | d3 (boss) | d4+ | Whole Club | Shifts at the Club |
|---|---|---|---|---|---|---|
| 1P | 0.99 / 0.99 | 0.95 / 0.81 | 1.33 / 1.05 | 1.33 / 1.19 | **1.21 / 1.07** | 4–9 |
| 4P | 0.85 / 0.85 | 1.00 / 0.81 | 1.19 / 0.90 | 1.80 / 1.69 | **1.29 / 1.15** | 4–5 |

**Read.**
- **The Muni is well under the bar.** At 0.58–0.65 full and 0.42–0.45 r8, it's lower than round 8's "jobs" ~0.8, and that
  was a different ruler.
- **The Club's days 1–2 at 4P are the next weakest cells.** They sit at 0.85–1.0, against the 1.5 bar.
- **The Tournament did its job on d4+.** 1.80 at 4P.
- **A Muni day-3 mini-call is the right next candidate.** Day 3 is the quietest working day, and the first gold balls
  arrive with no moment attached.

**Shifts per venue.**
- Muni: 4 shifts at 4P, 4–5 at 2P, 5 at 1P with prep (all seeds promote).
- Club: 4–5 at 4P, 4–9 at 1P.
- The boss arrives about 40–47 minutes in (unchanged from round 8).

## 4. Top 5 improvement ideas (ranked)

1. **Restore `mowe.tick` and add a guard.** It's one line, then a test that greps `main.js` for a live (uncommented)
   `mowe.tick(` call, or a headless check that the scene's `mower` root moves during a fight.
   - *Fun:* it gives back the owner's "big deal" boss moment, the loss-beat door slam, the dodge edge and the whistle
     post in one move.
2. **The Muni day-3 "Gold Rush" mini-call** (the council's candidate):
   - At T−3:00 on Muni day 3, three gold balls land together, each under a short gold beam with a 25 s clock.
   - Dimples's "the members' caddie" is the Muni's own scavenger, a gull that takes an unclaimed one.
   - One ALERT: "Gold on the field! Beat the gull!" (7 words).
   - 1–2P get 2 balls, 3–4P get 3, and one lands across the creek.
   - *Fun:* it fills the dead minute, teaches "×10 is worth a run" on the day gold arrives, and rehearses the Club
     Tournament's grammar early.
   - *Build:* it's the Tournament's `tourney.mjs` pattern with Muni spots, on `hash32` with no RNG.
3. **"Rush hour" on Club days 1–2:** at T−4:00, a coach party fills every bay for 60 s.
   - The basket drains fast and the fryer drops, so "two to the dispenser, one to the fryer, one hoses" becomes a real
     4P split.
   - *Fun:* it takes the 0.85–1.0 cells toward 1.5, and it's a co-op ask, not another ball to chase.
4. **Cash pops off the centre.**
   - Draw "+$5.40" at the cash HUD (top left), counting up. Keep the centre for words.
   - *Fun/clarity:* the day-1 checklist stops blinking on every bank (finding #5), and solo players notice their
     earnings where the number lives.
5. **One Gary line at a time on inspection day.**
   - Make the checklist show only the current Gary check ("Gary's at the mats. Hose them!"). Fold talk and ping into
     one optional hint after the first failed check.
   - *Fun:* a first-time solo player knows what to do during the most dramatic Muni minute.

## 5. Scores

| Metric | Score | Why |
|---|---|---|
| Fun | 6 | The Muni and the Club reveal are charming, but the first hour's peak (the boss) is broken: you're hunted by nothing. It would be 7.5 with #1 fixed. |
| Clarity | 6 | Gary's line churn, "Wands at the bell", and an invisible boss telling you to "hose its back". The checklist and nudges are good. |
| Text load | 7.5 | One centre item at a time, held throughout. The memos run long (13 words), and the mowed line repeats ×5. |
| Pacing | 6.5 | Muni day 3's last 3.5 minutes are empty. The Club arrives at ~45 minutes, as before. |
| Co-op | 6.5 | From the bots, the Muni and Club days 1–2 calls are flat across crew size (0.25–1.0), and only the boss and d4+ scale. |
| Meaningful features | 6.5 | The washer, crank and filler loop is meaningful. The aimed whistle can't be used without its post (#1). |
| Look & feel | 6 | The photo and the reveal look great. The Club spawn faces the path, and the boss mesh is frozen at the origin. |
| Polish | 4.5 | A commented-out core call shipped. The repeated mowed line, the blinking checklist, and "Employee" with $0. |
| One more shift | 7 | "Rematch tomorrow" plus the report row is a real hook. |
| Decision density | 5.5 | The Muni at 0.58–0.65 calls a minute, and Club d1–2 at 0.85–1.0. Only the boss and the Tournament reach the bar. |
| **Overall** | **6.2** | The text and story work is the best yet. The boss regression drags the first night under round 8's 6.8. With #1 fixed I'd expect about 7.0. |
