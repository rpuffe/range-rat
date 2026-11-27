# Playtest round 10, reviewer B: the solo night (1P)

**Verdict: Overall 6.6 (first hour 6.6 · middle 6.6 · late 6.6). My run does not meet the §4.3 bar:** Pacing (6.0) and
Decision density (6.0) are under 6.5 for the whole game, and `__centre.overlaps` was not 0 (all of it pay floats
against a centre line, none text on text). I found **no Critical or High**. The solo crew reaches the ending, and the
end card had 0 overlaps.

**The lead's question: is Gary a solo wall? No. It's a bot limit.** I played his inspections by hand in the real
client. I passed the Muni huddle and the Club Seal **on the first visit both times**, with half the 90 s solo warning
to spare. Details are in §4.

**What I can speak to:**
- every 1P shape: the 90 s Gary warning, the 45 s Tournament clock and the pair, the solo ending, the endless spawn;
- first-timer clarity on Muni day 1, with the hints cleared;
- 1P pacing, from the ladder plus my own timings.

**What I can't:**
- **I did not play the whole game in one sitting.** At 1P that's 4:31–8:49 (the ladder). I played the key solo
  beats in the real client and took the long stretches from the ladder.
- **Pad:** I used keyboard events into the real client, with no pad emulation.
- **Throttled perf:** not measured.
- **Solo Tiered, Happy Hour and the Stadium:** not played in the browser (I ran out of budget).

## How I played

**My own stack.** My own server (:18741, `RR_DEV=1`) and my own headful Edge (CDP :19741, its own `--user-data-dir`).
The scripts are `scripts/bots/pt10b-drv.mjs` (the driver), `pt10b-watch.mjs` (a hang watchdog), `pt10b-cdp1.mjs` and
`pt10b-pause.mjs`.

**Input.** The Rat moved only through key events into the client's own listeners: WASD, the arrows, Space, E and Tab.
Steering read the Rat's position, the way a player reads the screen. The policy was a "human routine":
- read the centre line;
- during Gary's warning, hose his stops that look dirty;
- then stand in the ring.

**Frame rate.** p50 17.8 ms, p95 18.1–18.6 ms (≈ 55 fps) in every shot. So every visual claim is verified.

**The runs:**

| Run | What | Result |
|---|---|---|
| New crew, hints cleared | Muni day 1, the whole shift | The checklist taught the loop. The buy step was left undone (my fault). |
| `muni.mjs 1 7`, its day-4 morning snap (a real 1P save) | Muni day 4, Gary's first visit | **Huddle passed, first try** ("Gary approves! ×1.25"). |
| `club4-1p` (Club day 4, a Gary + Tournament day) | The whole shift | **Seal on the first visit. Members' balls 4 of 4.** Card done. |
| `county1`, solo | County day 1 opening | Gary didn't come that day (my `garyDay` tweak didn't take), so no human County pass. See §4. |
| `late11.mjs 1 7` from `county1` (headless, solo) | The County | **Pass on Gary's first visit (1 fail: the cart). Promoted in 2 shifts.** |
| `lastbucket`, solo | The bank → end card → endless day 1 | Banked. **0 overlaps** through the end card. Endless day 1 opened. |

**Two incidents, both mine, not the game's:**
1. **The ports.** My first driver start found C's Edge already on :9731 and attached to it for a moment. It sent
   `Page.enable` and `bringToFront` to C's tab, with no navigation and no input. After that the driver refuses any busy
   port.
2. **The scratchpad is shared** between reviewers. A `gary.js` there was overwritten both ways. Mine now live in
   `scratchpad/pt10b/`.

**A page hang I chased for 30 min was my own pilot.** The page hung twice: the renderer at 100 %, the GPU idle, and
the page dead until a reload. The watchdog's stack was my `hose()` → `kd('Space')`. My Gary loop could resolve `hose()`
with no macrotask yield, which is an endless microtask loop. Hosing the sign through Gary's warning without that loop
never hung. This is not a game bug.

## 1. Scores (1P)

| Metric | Whole game | First hour | Middle | Late | Why (whole game) |
|---|---|---|---|---|---|
| Fun | **7** | 6.5 | 7 | 7 | The solo Tournament is a real sprint (4 of 4, 3–16 s to reach each ball). A first-visit Seal feels earned. Muni day 1 is quiet. |
| Clarity | **6.5** | 7 | 6.5 | 6.5 | Day 1's checklist is excellent. Gary's warning names one stop at a time, never which two mats he'll check. "Hose it!" lingers after the stop already passes. |
| Text load | **7** | 7.5 | 7.5 | 6.5 | One centre text, the cards short. The County memo is 14 words. Pay floats cross the centre line in the field. |
| Pacing | **6.0** | 6 | 5.5 | 6.5 | 1P is 4:31–8:49 to the ending (ladder), against ~2:00 at 4P. Solo Tiered is 9–14 shifts on reviews alone. Muni day 1 has 240 s without a call. |
| Co-op (1P scaling) | **6.5** | 6.5 | 7 | 6 | The 1P shapes work: 90 s Gary, his two mats, the 45 s clock and the pair, "BALL NO. 1 → THE RETURN". 1P Stadium answers 9 of 72 requests (ladder). |
| Meaningful features | **6.5** | 6.5 | 7 | 6.5 | The Tournament and the Seal pay solo (+$10,078 and +$3,468 on a $35.9k day). Late cash runs far past fees with nothing to spend it on. |
| Look & feel | **7** | 6.5 | 7 | 7 | The beams, the RETURN 3 tube, the end card over the giant ball. The endless spawn faces the snack shed with a post in the middle of the frame. |
| Polish | **6.5** | 7 | 6.5 | 6.5 | No softlock, and no lost save in my runs. A stale Gary line, the County memo, the endless spawn post. |
| One more shift | **6.5** | 7 | 6 | 6.5 | After the first boss: yes. After the Club: yes, on that day. Solo Tiered's review grind is a "no". Endless day 1 is breezy. |
| Decision density | **6.0** | 5.5 | 6.5 | 6.5 | Muni at 0.8 calls a minute, and ~75 s of standing in Gary's ring after hosing. The Club's flights and the County's hazards are dense. |
| **Overall** | **6.6** | **6.6** | **6.6** | **6.6** | The solo game is fair and readable now. It is just long and quiet in two places. |

## 2. Findings

| # | Sev | Finding | Repro | Evidence |
|---|---|---|---|---|
| 1 | **Med (tooling, not game)** | **The 1P Gary "wall" is the bot.** `muni.mjs`'s warning routine hoses the dirtiest fixture by a distance score, never his stops in order. It cleaned the sign only after he had checked it, and never touched his two named mats or the cart. | `node scripts/bots/muni.mjs 1 7`, the GARY line | Day 4 check: sign 0.56, mats 0.42–0.44, cart 1.00 → 3 fails. On days 5–14 it is 3–4 fails every day. My hand routine: pass at the Muni and the Club, first visit. |
| 2 | Med | **Solo Tiered's review grind** (from the ladder, not replayed): 9–14 shifts with `reviews` stuck at 2/3 and $3–4.8M banked. | `design/ladder-round14.md` 1P rows | 2b step 3 (`reviews` 2 at 1P) was conditional, and the median is still > 5. This is now the one real 1P sag. |
| 3 | Med | **Gary's solo warning doesn't say which two mats he checks.** The arrow points at *your nearest* mat (`nudgeTarget('hose')`), and `gary.mats` isn't on the wire. | Muni day 4, solo | It didn't bite me (every mat was under 0.34 at the warn), but on a muddy day a first-timer can hose the wrong two. |
| 4 | Low–Med | **~75 s standing in the ring.** Solo, the hosing takes 15–50 s of the 90 s warning, then he drives his route. | Club day 4 | The hosing ran T+17 to T+50 of the warn; he gave his verdict at t308, so I waited t231 → t308 with nothing to do. This is the dead minute of the middle. |
| 5 | Low | **"Gary checks the return. Hose it!" lingers** while the return already passes (0.12–0.16, under the 0.34 pass line). | Club day 4 | The line repeated at t274 and t304 while I stood there. It clears only at Spotless 0.1. |
| 6 | Low | **The County memo is 14 words.** | County day 1 | "Today: 35% clean. Zoning over half. NEW: the Yards. Spray green hazards, then bag." (`sim.js` l.599). 6.10 trimmed the Stadium's but not this one. |
| 7 | Low | **Pay floats in the centre box** count as overlaps in the widened `__centre`. | County day 1 near the return; endless day 1 | 15 in the first 182 s at the County, 5 in 75 s of endless. Every one was a helper/washer float ("+$4,953 · washer") against a todo, hint or toast. 0 were text on text. `pt10-B-endless-payfloat-overlap.jpg`: the float is gone within a frame; the toast reads fine. |
| 8 | Low | **The endless day-1 spawn** (solo, slot 0) faces the snack shed with a pole through the middle of the frame. The memo card sits over it. | `lastbucket` → bank → Clock in | `pt10-B-endless1-spawn.jpg`. 6.3 aims spawns down-range. This one isn't. |
| 9 | Low | **"Clock in tomorrow" ignored a real Space** pressed early in the end card's hold. | End card | A Space press in the hold didn't register. The button worked later. This is by design (6.7), but nothing shows the hold to a solo player. |

## 3. What §4.2 asks everyone to record

**`__centre.overlaps` per stretch** (widened zone):

| Stretch | Overlaps | What |
|---|---|---|
| First hour (Muni days 1 and 4) | Not read: the page reloaded with each crew | — |
| Middle (Club day 4, a whole shift) | Not read: the page reloaded with each crew | — |
| Late: the County, first 182 s | 15 | All pay float + text |
| Late: the Last Bucket → end card | **0** | — |
| Late: endless day 1, first ~5 min | 5 + 1 | All pay float + text (shot) |

**The longest gap with no call** (from the ladder, 1P):
- Muni: 240 s (day 1).
- The Club: 191–207 s (one shift a chain).
- From Tiered on: none over 70 s.

My Club day 4 had none over ~60 s: the flights at t120 and t320, plus Gary.

**Softlocks and dead ends:** none. Every solo inspection I played passed on the first visit, and the solo bank reached
the end card and endless.

**Centre lines over 8 words:**
- the County memo (14);
- the Club day-4 memo, "Gary visits today. 50% clean by the bell. Members' Tournament today." (11);
- the Corporate PA, "Gary. Regional Manager. He has a clipboard." (7), is fine.

**The best and the dead minute of each stretch:**
- **The first hour.** Best: the Muni day-4 pass, with the sign, six mats and the return hosed in 15 s, then "Gary
  approves! ×1.25 a ball". Dead: Muni day 1, T−3:00 to the bell, picking with no call.
- **The middle.** Best: flight 1 on Club day 4. Ball one was 113 m out and reached in 16 s; ball two was 50 m off with
  ~10 s left, and I banked both at RETURN 3 (`pt10-B-club-member.jpg`). Dead: the ~75 s in Gary's ring (finding 4),
  and solo Tiered's review days (ladder).
- **The late game.** Best: the end card: "Site 12 is yours… Solo · 1 ball · $66,039,228… Balls Outstanding: 0." over
  the 1958 ball (`pt10-B-ending-solo-endcard.jpg`). Dead: endless day 1's first minute, "Today's target: whatever."
  (funny once) and nothing to aim for.

**One more shift?**
- **After the first boss:** yes. The day-4 Seal lands, and the card is 3 of 5.
- **After leaving the Club:** yes on the Club's last day ("Card done! Sign for Tiered.", `pt10-B-club4-report-solo.jpg`).
  But knowing 9–14 solo Tiered shifts follow, I'd stop at "Good place to stop".
- **Endless day 3:** not reached in the browser. Endless day 1 is a pleasant lap, with no new pull.

**The heart through-line (what I saw):**
- the clipboard PA on Muni day 4;
- the County opening's Gary card, "I was a Range Rat. Here. 1987.", which lands;
- Ball No. 1's note, "Whoever finds this: the range is yours.";
- endless day 1, "Gary loosens his tie. He grabs a bucket.", then "Dimples is retiring. He finally makes eye contact."

Each is short and in order. Solo, Ball No. 1's ending lands, though after 4.5–9 hours rather than 2. Site 13 ("FHI has
acquired Site 13… Their numbers were, it turns out, estimates.") stays a joke beside Gary, not on top of him.

## 4. Gary at 1P: the bot or the wall?

**It's the bot.** The evidence:

**1. My hand play passes on the first visit.**

*Muni day 4 (a real 1P save from `muni.mjs 1 7`):*
- The warn came at t181 and he drove off at t271.
- At the warn: the sign 0.48–0.50, the return 0.56–0.61, the mats 0.10–0.31, the cart 0.
- I hosed the sign, every mat over 0.28 and the return: about 15 s of hosing.
- I stood in the ring. The verdict at t303: **pass with huddle**, ×1.25, and the card's "Pass Gary with a huddle"
  ticked.

*Club day 4 (`club4-1p`):*
- Warn t181. I hosed the sign, mats 0–11 and the return from t198 to t231 (33 s); the kitchen passed on full fries.
- In the ring until t308: **the Seal**, +$3,468, the card goal ticked, and the card done.

**2. The solo bot's own checks show why it fails.**
- At the Muni it hoses by a distance-weighted "dirtiest" score, not his route. It hoses the sign only once he is at the
  sign, which is too late.
- The mats and the cart are never touched: 3–4 fails a visit on every day of 14.
- Headless from `county1`, the solo `late11` passed the County on his first visit (1 fail, the cart) and promoted in 2
  shifts. So the ladder's 5–31 County shifts belong to the bot's own 1P state and policy, not to the inspection's rules.

**3. The solo rules are generous.** A solo player has:
- a 90 s warning;
- only his two muddiest mats checked;
- the sign and cart starting at the pass line on a solo Gary morning;
- 1 fail allowed;
- an idle Rat counting as in the ring after 20 s.

**What's real:**
- the clarity gap (finding 3): he names a stop at a time, never which two mats;
- the idle wait after a fast clean (finding 4).

**What it means for the ladder:** the 1P times are pessimistic at the Muni, the Club and the County. A human solo crew
would skip the 4P-substitute Muni and the 13–20 Club shifts. **Solo Tiered's reviews (finding 2) are the only 1P
stall left that a person can't hose away.**

## 5. Top 5 for the owner

1. **1P Tiered: take the conditional 2b step 3.** `reviews` 2 at 1P (`CARDS[2]` `n: [2, 3, 3, 3]`), or count a cleared
   Happy Hour as a review. The ladder's 9–14 solo shifts with $3–4.8M banked is the last real 1P sag.
2. **Fix the solo bots' Gary routine before trusting 1P ladder times.**
   - During the warn, hose `gary.mats`, the sign, the cart and the return, in his route order.
   - Then huddle.
   - In `muni.mjs` and `mid.mjs`, and in `late11.mjs` for the cart.
   - Expect the 1P Muni to stop needing the 4P substitute, and the Club and County shifts to fall.
3. **Solo Gary: name his two mats.** Put `gary.mats` on the wire, and point the "Gary checks the mats" arrow (and a
   small marker) at those two, not at the mat nearest you.
4. **Fill the ring wait.** Once every stop passes, the solo line could be "All clean. Meet Gary at the return!" plus
   "Stall Gary: ping his cart!" to bring him sooner. Or start his drive when all stops pass, so you don't stand there
   for 75 s.
5. **Trim the centre text that's left.**
   - The County memo to ≤ 9 words ("Today: 35% clean. Zoning over half. NEW: the Yards.").
   - Clear a Gary stop line at his pass line (0.34), not only at Spotless.
   - Hide helper and washer pay floats while a todo/toast is up, so `__centre.overlaps` reads 0.

**Shots** (`design/shots/`):
- `pt10-B-d1-todo.jpg` (the day-1 checklist and arrow);
- `pt10-B-club-member.jpg` (a member's ball to RETURN 3);
- `pt10-B-club4-report-solo.jpg` (4 of 4, the Seal, the card done);
- `pt10-B-ending-solo-endcard.jpg`;
- `pt10-B-endless1-spawn.jpg`;
- `pt10-B-endless-payfloat-overlap.jpg`.
