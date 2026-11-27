# Playtest round 10, reviewer C: two friends and the stress test (2P)

Build `f5a95a7` (the release candidate). Played 2026-11-27, about 2 h 50 min of wall time.

**Verdict: Overall 6.8 (first hour 6.6 · middle 7.0 · late game 6.6). My run does NOT meet the §4.3 ship bar.**

| §4.3 item | My run | |
|---|---|---|
| 1. Overall ≥ 7.0, no metric < 6.5 | 6.8. Decision density is 5.5 in the first hour and Polish is 5.0 in the late game | ✗ |
| 2. No Critical / High | **One High:** a rejoin during the ending report softlocks the crew (#1) | ✗ |
| 3. `__centre.overlaps` = 0 | 0 text-on-text in the first hour and the late game. **The middle has ≥ 9 Gary-bubble overlaps** (#3). The raw counter is never 0, because pay floats count; smoke treats those as a warning only | ✗ |
| 4. Every crew size reaches the ending | 2P reaches it on 2 new seeds as well (5 and 13), at 2:14 and 2:28 shift-time. I banked the Last Bucket in the client too | ✓ |
| 5. Perf: p95 ≤ 20 ms with the CPU ×6 | Fails at all five points by 3.5–20× (§3) | ✗ |

**What I can speak to:** 2P pacing and calls from Muni day 1 to endless day 5; the late game and endless; Site 13's week and the poach (headless); quit and rejoin at the five moments (browser and headless); save → restore; perf.

**What I can't:**
- **I didn't hand-play the whole game on a real pad.** The browser seats were scripted pickers. Each ran a small in-page autoplayer: nearest ball, Ⓐ pickup, walk it to the return, Ball No. 1 first. I used my own pad shim (`navigator.getGamepads`) for Ⓐ / Ⓨ / Menu. Ⓐ readied the lobby, and the HUD switched to pad glyphs (`D-pad ↑ store · click L sprint`). So Fun, Co-op and Decision density are partly judgement over the bot numbers.
- **What I didn't see in the browser:** the Muni Gold Rush, and a real Promotion Day rejoin. The Promotion Day rejoin was covered headless only (§4). The Stretch's rockets need answered requests, which my pickers never answered.

**How I played:**
- **Headless:** `ladder14.mjs chain 2 <seed>` on seeds 5 and 13, which the lead didn't run, with `BUY=1 TOURNEY=1 WHISTLE=aim POACH=1 EVENTS=1`. Muni day 1 → endless day 5.
- **Client:**
  - My own server on :8731 (RR_DEV=1). Seat 1 ran in a fronted headful Edge (CDP :9731, own profile). Seat 2 ran in a second Edge (:9732, own profile), so its JavaScript didn't share seat 1's renderer.
  - Each moment started from my 2P chain's own morning snaps (seed 13).
  - Frame rate: ≥ 52 fps fronted every time (unthrottled p95 18.1–18.5 ms, vsync-bound), so the visual claims are verified.
- **Scripts:** `scripts/bots/pt10c-*.mjs`. `pt10c-moment.mjs` runs a moment, its perf and its rejoins. `pt10c-restore.mjs` is the headless quit and save → restore. `pt10c-endrejoin.mjs` is the #1 repro.

---

## 1. Scores

| Metric | Whole | First hour | Middle | Late → endless | Why (whole game) |
|---|---|---|---|---|---|
| Fun | 7.0 | 6.5 | 7.5 | 7.0 | The boss, the Tournament, Happy Hour and the crash all land as events. Muni days 1–2 and endless mid-shift are flat. |
| Clarity | 7.0 | 7.0 | 7.0 | 7.0 | The ALERTs are short and alone. A rejoin mid-boss is told "Pick up balls" (#5), and a rejoin at the ending shows nothing at all (#1). |
| Text load | 7.5 | 7.5 | 7.0 | 8.0 | The epilogue, the bank and the endless morning are one at a time (0 overlaps). Gary's bubble sits on the todo on his Club visit (#3). |
| Pacing | 7.0 | 6.0 | 7.0 | 7.5 | 2P runs 4 / 6 / 4–6 / 2 / 2 / 2 shifts. Muni has 240 s and 231 s gaps with no call. The 2P Club waits a day for Gary's seal (#6). |
| Co-op | 6.5 | 6.5 | 7.0 | 6.5 | Two Rats can't cover the Tournament's 4-ball flight (the caddie took all 4) or the Stretch. The bank's "WAITING: YOU +1" is a great 2P beat. |
| Meaningful features | 7.0 | 7.0 | 7.0 | 6.5 | The Bell rings at the Club and Tiered (5 of 6 and 7 of 8 owned shifts). The fireworks and the inspector are bought a venue late at 2P (#7). |
| Look & feel | 7.5 | 7.5 | 7.5 | 7.5 | The Stretch beams, MOW-E 2.0's stamp and the "Site 12 is yours" card look good. |
| Polish | 5.5 | 7.0 | 6.5 | 5.0 | The ending-rejoin softlock (#1), ×6 frame times of 70–400 ms (#2), and a 1.1 s hitch on the first endless morning. |
| One more shift | 7.0 | 6.5 | 7.5 | 7.0 | Pull at the Club and the Stadium. In endless, Site 13's week holds now (3 of 4 beaten; the poach acquired 0 and 1 times). |
| Decision density | 6.5 | 5.5 | 7.0 | 6.5 | Muni offers 0.79–0.83 calls a minute. From Tiered on it's 2.2–4.3, but endless is mostly deck orders. |
| **Overall** | **6.8** | **6.6** | **7.0** | **6.6** | A strong middle. A first hour with long quiet minutes. A late game whose best minute can be lost to a reconnect. |

---

## 2. Findings

| # | Sev | Finding | Repro / evidence |
|---|---|---|---|
| 1 | **High** | **A rejoin during the ending report softlocks the crew.** Ending reports hide `#report` (`main.js` l.1435: "the ending has its own card"), and the end card is built only from the live ending events. So a seat that reconnects after the bank gets no end card, no report and no Ready. Ⓐ, Ⓨ, Space and Enter do nothing. Ready only comes from the report or the end card, and the server waits for a Ready. **If every seat reconnects in that window, the crew is stuck** until it has been empty for 10 min (`UNLOAD_MS`), saved and rejoined. That covers a solo reload, Wi-Fi blips on both seats, or the Xbox app suspending. Seen twice: the 2P crew XBRC sat in `report` for 7+ min, and the solo repro for 90+ s. | `pt10c-endrejoin.mjs`: `lastbucket` solo → Ball No. 1 home → end card up → reload. `pt10-C-endrejoin-before.jpg` shows "Site 12 is yours" with "Clock in tomorrow". `pt10-C-endrejoin-after.jpg` shows the bare stand, no UI. The log reads `{"phase":"report", "endcard":false, "report":false}` after the rejoin, after A, Y, Space and Enter, and again 90 s later. |
| 2 | High (ship bar 5) | **Perf with the CPU ×6 misses p95 ≤ 20 ms everywhere, by 3.5–20×** (§3). Unthrottled, the main thread costs **6.8 ms a frame** at the Club (CDP `Performance.getMetrics`: TaskDuration 6.8, Script 5.7). ×6 makes that ~41 ms, so the bar needs ≤ 3.3 ms of JavaScript a frame. Graphics Low doesn't fix it: the p50 halves (35 → 18 ms), but the p95 stays 70–250 ms. This bar can't be met by tuning the renderer. Either the bar's throttle is wrong for this machine, or the sim/view JavaScript needs a big cut. | `pt10c-moment.mjs` PERF lines, `pt10c-cost.mjs`. |
| 3 | Med | **Gary's in-world bubble overlaps the todo on his Club visit** ("Mind the pond. Things sink." over "↑ Gary checks the mats. Hose them!"). It also overlaps the toast "BONK…" and the hint "Press C for Corporate CCTV.". That's ≥ 6 episodes on seat 1 and ≥ 3 on seat 2 on Club day 4 (a Tournament + Gary day). The 0d widened counter catches it, but smoke has no Gary day, so the lead never saw it. | `__centre.log` (tourney run), e.g. `todo (1.00): ↑ Gary checks the mats. Hose them! \| gary-bubble (1.00): Mind the pond. Things sink.` **No shot:** my sampler logged it, but the screenshot fired at the flight. |
| 4 | Med | **Save → restore duplicates the shift's earnings and can drop the crash.** Mid-shift saves (every 60 s while dirty, and on unload) write `day` = today with the **mid-shift cash**, and a restore replays the day from its morning. So the earnings before the quit are kept and earned again: Club boss day morning $6.1k → save $10.2k → the day is replayed from $10.2k. On Promotion Day, the mid-crash save already has `mowe.encore: true`, so **the restored Promotion Day has no MOW-E 2.0**. It is otherwise safe: all five moments restore and reach the bell, except the bank, which restarts Ball No. 1 falling. | `pt10c-restore.mjs` (§4). |
| 5 | Low–Med | **A rejoin mid-event gets "Joined day 16, 4:00 left. Pick up balls."** That came during MOW-E 2.0's fight; mid-flight and mid-Happy Hour it's the same. The ALERT isn't replayed (`sayer` opens with nothing queued), so the returning Rat isn't told a boss or a flight is on. | promo, tourney and happy logs. |
| 6 | Low–Med | **2P Club: 6 shifts on both seeds.** The fee was done by Club day 5, and Gary's seal came on day 6. The card sat at "4 of 5 done · 1 to go" on day 9. The lead's 2P seeds had 4–5. | ladder `mid.out`, seeds 5 / 13. |
| 7 | Low–Med | **Landmarks 3 and 4 still come a venue late at 2P** (round 9 #6). Fireworks: bought on day 18–20 **at the County**. The inspector: **at the Orbital**. So the 2P Stadium never has its fireworks, and the County never has its second inspection. | `[landmarks] bought: d18 v4 tier 3 … d19 v5 tier 4` (seed 13), and the same on seed 5. |
| 8 | Low | **A 1.1 s freeze on the first endless morning** (unthrottled worst frame 1115 ms, p95 35.5 ms at T+25, by the case). It looks like a first-render shader compile for the endless set. | endless1 PERF line. |
| 9 | Low | **Hints from earlier venues fire mid-boss on a fresh profile.** At the Stadium crash: "Red box on the dock: E feeds balls.", "Snack shed open!", "New cart! F gets in. W/S drives." At the Stadium: "Gutters linked…". They're TIPs, quiet-gated, but they all fire in the boss minute. | promo log T200–T230. |
| 10 | Info | **The Stadium crash is fixed for a losing crew:** `MOW-E 2.0 WINS` at T242, then "MOW-E got away. For now." at T244, alone. That's round 9 #1. The Stretch moved after it, to T272. The report row reads "took the bunting". **Endless spawn:** no giant bubble now, but Gary stands dead centre of seat 1's first frame, holding a bucket (`pt10-C-endless1-moment.jpg`). | promo log; shot. |

**Softlocks and dead ends:** #1 only. Every other quit and rejoin restored: seat 2 then seat 1, each away 8–12 s, mid-boss, mid-flight, mid-Happy Hour, on the crash day, and mid-ending for one seat. In each case the seat came back on the same seat, in the same shift, with the moment still live.

**Centre lines over 8 words:** none in play. The sampler flagged only the hint "Pink souvenir balls: carry them to the crowd rail." (9) and the toast "Under the pond. Grab balls before your air runs out." (10).

---

## 3. Perf: `?perf` p95 with the CPU throttled ×6 (Emulation.setCPUThrottlingRate)

Seat 1 was fronted at 1280×800 CSS (2518×1352 render on High, 1259×676 on Low). The window is the 5 s overlay plus my own rAF sampler over 8 s.

| Point (2P) | Unthrottled p95 | ×6 Auto/High p95 (p50) | ×6 Low p95 (p50) | ×4 Low p95 | Bar ≤ 20 |
|---|---|---|---|---|---|
| The Stretch, with fireworks owned (rockets not triggered) | 18.1 | **108.4** (54.1) | 106.6 (18.5) | 54.2 | ✗ |
| Boss phase 2 (Club day 3, hunt) | 18.2 | **72.3** (35.5) | 106.0 (35.7) | 71.7 | ✗ |
| A Tournament flight (Club day 4) | 18.1 | **70.4** (35.5) | 71.2 (18.0) | 36.1 | ✗ |
| Happy Hour (Tiered) | 18.3 | **71.8** (35.1) | — | — | ✗ |
| The return with Ball No. 1 → the bank | 18.2 | **409.2** (53.4) | 250.3 (53.6) | 266.8 | ✗ |
| The return with the case (endless day 1) | 35.5 (one 1.1 s hitch) | **158.7** (36.2) | 197.3 (18.1) | 71.3 | ✗ |

---

## 4. Quit, rejoin and save → restore (2P)

| Moment | Live: both seats quit for 30 s (headless) | In the browser: seat 2, then seat 1 quit and rejoin | Save → restore (headless) |
|---|---|---|---|
| Mid-boss (Club day 3, hunt) | The shift and the hunt run on without anyone online | ✓ Same seat, the hunt still live | ✓ The boss comes back, reaches the bell. Cash duplicated (#4) |
| Mid-Tournament | ✓ | ✓ (the flight's 30 s ran out while away) | ✓ The flights come back |
| Mid-Happy Hour | ✓ | ✓ | ✓ |
| Mid-bank (Ball No. 1) | The bank stays paused, Ball No. 1 waits | ✓ Seat 1 reloaded mid-carry, and the bank completed with 0 overlaps. **✗ A rejoin after the bank → #1** | ✓ Ball No. 1 falls again |
| Promotion Day (mid-crash) | ✓ | ✓ on the crash day (Stadium day 2; that crew's Promotion Day was day 3, browser not run) | ✓ It restores as Promotion Day, but **without the crash** (#4) |

---

## 5. What everyone records

**`__centre.overlaps`** (text on text; pay floats left out, as smoke does; raw in brackets):

| Stretch | Seat 1 | Seat 2 |
|---|---|---|
| First hour: Muni day 1, Club day 3 boss | 0 (raw 0 / 4) | 0 (1) |
| Middle: Club day 4 Tournament + Gary | **≥ 6 (9)**, #3 | **≥ 3 (15)** |
| Middle: Tiered Happy Hour + Gary | 0 (13) | 0 (14) |
| Late: the Stadium crash | 0 (9) | 0 (7) |
| Late: the bank → the end card | 0 (0) | 0 (0) |
| Late: endless day 1 | 0 (0) | 0 (0) |

**Longest gap with no call** (2P bots, seeds 5 / 13):
- Muni: day 1 **240 s**, day 2 **231 s**, day 3 120–196 s.
- Club: day 1 **209 / 247 s**, then ≤ 146 s.
- Tiered: ≤ 60 s. Stadium: ≤ 55 s. County: ≤ 60 s. Orbital: ≤ 100 s. Endless: ≤ 100 s.

So the 3-minute target fails on Muni days 1–2 and Club day 1, as in the lead's ladder.

**The 2P ladder** (shifts at Muni / Club / Tiered / Stadium / County / Orbital, then calls a minute offered / answered):

| Seed | Shifts | Ending | Muni | Club | Tiered | Stadium | County | Orbital | Endless |
|---|---|---|---|---|---|---|---|---|---|
| 5 | 4 / 6 / 6 / 2 / 2 / 2 | 148 shift-min | 0.79 / 0.38 | 1.45 / 0.76 | 3.16 / 0.95 | 4.33 / 2.91 | 2.70 / 2.34 | 2.54 / 1.95 | 2.24 / 1.96 |
| 13 | 4 / 6 / 4 / 2 / 2 / 2 | 134 shift-min | 0.83 / 0.42 | 1.47 / 0.74 | 3.06 / 1.17 | 4.11 / 2.84 | 3.19 / 2.48 | 2.55 / 1.95 | 2.38 / 2.16 |

**Site 13's week and the poach** (2P, endless days 1–5):
- Seed 13: beat Site 13 on 3 of 4 days. 2 poaches ($13M, $14M), acquired once.
- Seed 5: 1 poach ($14M), wins 3 of 4, not acquired.
- The price is now "a quarter of yesterday's bank, more for each poach this week". The poach no longer makes the race a formality: round 9 had it acquired by day 3 in 9 of 9.
- The Hustle and the race read on the report.

**Best and dead minutes:**

| Stretch | Best minute | Dead minute |
|---|---|---|
| First hour | Club day 3, "MOW-E updated itself. Please stand back." → "MOW-E is loose!" → the red stamp | Muni day 1 after the first bank: 240 s with no call |
| Middle | Happy Hour: "Happy Hour! Drinks, and fetch the greens!" alone, with the neon beams; the report row "Happy Hour: 0 pours, 1 of 2 greens · +$5,318" | Club day 4's "Gary checks the mats" wait while Gary's bubble sits on the todo |
| Late | The bank: "BALL NO. 1 · HOME · 0/2 · WAITING: YOU +1" (`pt10-C-bank-moment.jpg`), then "Site 12 is yours" | Endless mid-shift: deck orders, the basket and the washer |

**"One more shift?"**
- **After the first boss: yes.** "Tomorrow: MOW-E's rematch. Grab a wand early." is the best eve line.
- **After leaving the Club: yes.** Tiered's Happy Hour and the deck pull at once.
- **At endless day 3: a soft yes.** At 2P the race isn't decided by a purchase any more. But money only waits for the next Owners' tier, and the shift is mostly deck orders.

**The heart through-line:**
- **Gary's thread reads as one story at 2P:** "That tape is not me. Watch your bays." (Tiered day 2) → the crash → "Gary loosens his tie. He grabs a bucket." Then he stands at the return with his bucket on endless day 1.
- **The ending:** "Site 12 is yours · Balls Outstanding: 0." lands. Unless you reconnect (#1).
- **Site 13 and Dimples:**
  - "Site 13 reports 140% Bay Utilization." / "Corporate did not know that was possible." is funny and short.
  - Dimples's "He finally makes eye contact" is the best epilogue card.
  - Neither crowds Gary.

---

## 6. My top 5 for the owner

1. **Rebuild the ending on a rejoin.**
   - When `welcome.report?.ending` is set, re-create the end card. Or show the report panel with Ready.
   - As a fallback, let any seat's Ⓐ / Ⓨ / Space ready on an ending report with nothing open.
   - Add a smoke beat: reload at the end card, then assert Ready is reachable and endless day 1 starts.
2. **Decide the perf bar against the real cost.**
   - Profile the 6.8 ms/frame of script at the Club. Start with per-frame view ticks for off-screen venue modules, the 250+ customers and balls, and the centre and perf samplers.
   - Target ≤ 4 ms on High, so ×6 lands near 25 ms.
   - Otherwise, restate the bar as ×4 on Low (today 36–71 ms; the Tournament is closest).
3. **Gary's bubble yields to the centre zone.** Fade or raise it while a todo, toast or hint is up, the way the name plates fade. Add a Club Gary day (club4-2p) to smoke's bank-style overlap gate.
4. **Saves keep the morning.**
   - Mid-shift saves should write the morning's cash and `mowe` (keep `day` as today, cash as at clock-in), so a restore replays the day without duplicating it.
   - Or save the live shift and resume it.
   - Either way, a restored Promotion Day keeps its crash.
5. **Fill Muni days 1–2 and Club day 1 for 2–4P.** One mid-shift call in the 240 s gap. Day 2 could get the Gold Rush's van at small scale (1 ball), and Club day 1 a pond "first dive" call. Also price landmarks 3 and 4 inside a 2P venue's surplus, so the fireworks reach the Stadium.
