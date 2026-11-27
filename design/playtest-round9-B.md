# Playtest round 9, tester B: Club day 4 → Tiered → Stadium day 1

Build `cee02b3`. Preview `rr-play-b` (:8095), now stopped.

**How I played**
- **Bots.** `scripts/bots/mid.mjs` from the `club4` preset (`START_FILE`, the `.save` unwrapped), through Tiered to the Stadium promotion. Runs at 1P, 2P and 4P, seeds 7, 11 and 23:
  - **full:** `TOURNEY=1 WHISTLE=aim BUY=1` (9 runs);
  - **4P comparisons:** `TOURNEY=0`, `BUY=0` and `WHISTLE=0` (9 runs).
- **Stadium day 1.** The same 9 full runs again with `SNAP_FILE`. Each one's last morning snap went into `late11.mjs` (`MAXS=1 BUY=1 WHISTLE=aim`).
- **Calls a minute.** Every number is `calls.mjs`, pooled by crew size, with the full column first and `r8` in brackets.
- **Browser, solo, `?debug`.**
  - Skip ahead → `club4`: I bought the Members' Bell, played Club day 4 to the bell, signed, then opened Tiered day 1.
  - Two dev crews via `/api/dev/crew`: `tiered1` with the Tap Wall, and `stadium1` with the fireworks. I logged every centre-zone element every 200 ms, plus `__centre.overlaps`.
  - **The pane was shared and fought me.** It was hidden for long spells (`__centre.skipped` 5,223 against 210 samples), ran at **1.5 fps** when fronted, and twice flipped to a 2× crop. So I could not walk to the bell or the tap wall. Visual claims below are limited to what I saw.
- **Shots** (in `design/shots/`):
  - `pt9-B-club4-spawn-pillar.jpg`
  - `pt9-B-club4-flight2-cctv.jpg`
  - `pt9-B-tiered1-spawn-tape-card.jpg`
  - `pt9-B-tiered-deck-tapwall-unseen.jpg`
  - `pt9-B-stadium1-spawn.jpg`

## 1. Findings

| # | Finding | Repro / evidence | Severity |
|---|---|---|---|
| 1 | **The Members' Bell is never rung.** Its only in-play perk lives at the Club, but crews buy it at Tiered. | The bell goes on sale from Club day 4. From `club4`, a 4P crew has **1–2 Club shifts left** (1 / 2 / 2) and is saving for the $110k fee.<br>In all 9 `BUY=1` runs the policy bought tier 1 **at Tiered** in 8 (d10–d12) and at the Club once (1P s23, after the money for the fee was in). **Bell rung: 0 in 9 runs.**<br>At Tiered it rings for sound only, so in practice it is a $15–33k toll before the Tap Wall. | **High (design)** |
| 2 | **The first Tournament morning never announces it.** | The Club day 4 memo, in the browser and in all 9 bot runs, reads "Gary visits today. 50% clean by the bell. NEW: bouncy balls ×1.5 and splitters."<br>The `TOURNEY_MEMO` note ("Members' Tournament today. Site 13 entered anyway.") never shows. Day 4 already carries Gary and two debuts. | Med |
| 3 | **Flight 2's ALERT shares a 40 s window with three other centre items, and I never saw it.** | `club4`, solo. Around T−3:00 to T−2:20 come:<br>"Gary's coming: clean up, then huddle.";<br>flight 2 (dodged to T−2:50);<br>"Gary is inspecting. Stay out of his way.";<br>"Grab the last balls!".<br>The sampler (200 ms, tab fronted) never caught "Second flight! Grab the members' balls!" above 0.3 opacity. At T−2:46 `#toast` held that text at opacity 0, with the beams up (shot).<br>**Caveat:** the pane ran at 1.5 fps. This needs a clean recheck. `__centre.overlaps` was 0 throughout. | Low–Med (recheck) |
| 4 | **The landmark row is hidden in the Club day 4 lobby.** | `club4`, then Shop before "Open the range": there's no "Range landmarks" row (`vday` is still 3 overnight).<br>It appears once the shift starts ("Next: The Members' Bell $15,000"). Bouncy and splitter, the other day-4 rows, behave the same.<br>A crew can't plan the bell over breakfast. | Low–Med |
| 5 | **The Tournament leaves no trace in the report.** | Club day 4 solo: 4 member balls, all to the caddie. The report shows "+$15,754, 260 balls banked by hired help", with no Tournament row and no "0 of 4".<br>The feed has "The caddie cart took one. Kazoo." twice in one row. | Low–Med |
| 6 | **At 1P the Tournament is mostly the caddie's.** | Member balls banked, `TOURNEY=1`:<br>**1P 2 of 12** (0 / 1 / 1 of 4), **2P 7 of 12**, **4P 16 of 30** (3/6, 6/12, 7/12). Clean flights: 0 / 1 / 2.<br>A solo Rat can reach one ball in 30 s: they're 60–140 m out, and the second is ≥ 16 m from the first. | Med |
| 7 | **The calls ruler counts member balls whether anyone goes or not.** | 4P Club d4+: `TOURNEY=0` reads **1.60** and `TOURNEY=1` **1.57**.<br>Member balls are 6 of ~11 calls a shift (0.86 a minute). Take them out and the fee days sit at ~0.7, round 8's number.<br>The ruler proves the calls are *offered*, not that the Tournament is a peak. | Low (tooling) |
| 8 | **Solo Tiered is now the long sag.** | **Tiered shifts:** 1P **5 / 7 / 9**, 2P 5 / 5 / 6, 4P 3 / 3 / 3.<br>**1P s23:** the fee was done on day 5, but `reviews 0/3` and `orders 4/10` sat for 4 days. Six of nine days missed the target with "Missed: the bowls were full at 2:30.", for $90–150k a day.<br>That's 75 min from Club day 4 to the Stadium (4P: 38 min). Some of it is the solo bot, but the card asks one Rat to cook, shoot greens and clear bowls. | Med–High |
| 9 | **Spawn views.** | **Club day 4:** a grey pillar fills the right third and the covered roof the top-right (`pt9-B-club4-spawn-pillar.jpg`). Better than round 8's half-ceiling.<br>**Tiered day 1 (`KUXS`):** framed by deck pillars, with sky visible.<br>**Tiered (dev crew) and Stadium:** clean, looking down the field. | Low (look) |
| 10 | **The Tap Wall can't be seen from the ground.** | The `tiered1` crew with tier 2. From the return and the path, the deck shows only its dark underside (`pt9-B-tiered-deck-tapwall-unseen.jpg`). The wall is at deck height (y 3).<br>I couldn't climb at 1.5 fps, so this is unconfirmed from the deck. | Low |
| 11 | **The `club4` preset is a 4P save.** At 1P and 2P the fee is already in hand. | $51,817 cash against a $50k fee at 1P ($70k at 2P). The HUD says "CARD DONE" on arrival.<br>A solo or 2P tester sees exactly one Tournament day before signing. | Low (tooling) |

**Owner rules:**
- **One centre text:** `__centre.overlaps` was 0 at the Club, Tiered and the Stadium. Read it with the hidden-pane caveat: 210 samples, 5,223 skipped.
- **~8 words:** held, except the Stadium memo at 11 ("Today: 35% clean. Crowd over half. NEW: the Ping Track. Keep the crowd happy.").
- **Pad:** the bell prompt is "Ⓐ: ring the Members' Bell". The shop text shows the Ⓐ glyph on keyboard too.
- **Full screen:** nothing dropped it.
- **1–4 scaling:** see finding 6 (the Tournament) and finding 8 (Tiered).

## 2. The numbers

**Calls a minute** (`calls.mjs`, pooled, full / r8):

| Venue | 1P | 2P | 4P | Bar |
|---|---|---|---|---|
| Club d4+ | **1.43** (1.29) | **1.38** (1.24) | **1.57** (1.46) | ≥ 1.0 / ≥ 1.5 ✓ |
| Club d4+, `TOURNEY=0` | — | — | 1.60 (1.52) | see finding 7 |
| Tiered | 2.36 (2.25) | 3.05 (2.88) | 2.80 (2.69) | ✓ on paper |
| Tiered without deck orders | **0.93** | 1.62 | **1.37** | ✗ at 4P |
| Stadium day 1 | 3.99 (3.71) | 3.99 (3.52) | 4.46 (4.08) | ✓ |

**Does Tiered need a peak? Yes, a small one.**
- Its number is the deck-order stream: 10 a shift at every crew size, one standing job for the cook.
- Take it out and the rest of the crew sees 0.93 calls a minute at 1P and 1.37 at 4P: under the bar, and the same shape as round 8's Club.
- At 4P Tiered is only 3 shifts, so it's tolerable. At 1P it is 5–9 shifts and the sag of the game.

**Length and money** (cash at each venue's last bell, against the fee):

| Crew | Club shifts (from `club4`) | Club bell / fee | Tiered shifts | Tiered bell / fee | Stadium d1 income | Stadium d1 cash / fee |
|---|---|---|---|---|---|---|
| 1P | 1 / 1 / 1 | $50.0–61.7k / $50k | 5 / 7 / 9 | $1.27–1.89M / $0.6M | $0.7–1.8M | $1.8–2.8M / $3.0M |
| 2P | 1 / 1 / 1 | $77.6–82.1k / $70k | 5 / 5 / 6 | $1.66–2.37M / $0.84M | $3.3–5.9M | $4.2–7.6M / $4.2M |
| 4P | 1 / 2 / 2 | $113.7–134.0k / $110k | 3 / 3 / 3 | $1.33–1.57M / $1.32M | $6.7–10.8M | $7.4–12.3M / $6.6M |

- **4P is right on the council's plan.** Club and Tiered surplus sit just over the fee.
- **The money jump is steep: ×11–18 in one bell**, from Tiered's ~$0.6M a shift (4P) to Stadium day 1's $6.7–10.8M. The 4P fee is paid on Stadium day 1, and the $11M fireworks are affordable on day 2.
- **Solo Tiered banks 2–3× its fee** while it waits on reviews: money is not its problem.
- **`BUY=1` vs `BUY=0`:** Tiered length is equal (3 / 3 / 3). Cash at the Stadium promotion is $0.25M against $0.72M at s11; the Tap Wall ate it, as intended.
- **Shifts with nothing worth buying: 0 in all 9 `BUY=1` runs.** ✓

**The Tournament's pay** (4P):
- **Club day 4 income, `TOURNEY=1` vs `0`:** $54.9k / $43.3k / $44.9k against $36.2k / $29.5k / $48.8k. The mean is **+25 %**.
- **Club day 5:** level ($56.5k / $73.3k against $60.2k / $68.3k).
- **Seed 7 promoted a day earlier with the Tournament** (1 Club shift against 2).
- **Share of a Tournament day's income:** 4P 12.6–21.3 %; 2P 10.5–17.4 %; 1P 0–6.7 %.

**The pet** (`WHISTLE=aim`):
- 33–49 pet balls a shift, **8–9.5 % of banked** (round 8: 12–26 %). Smaller, as asked.
- **The whistle's share:** 4P 39–49 %, 2P 43–51 %, 1P **27–33 %**. The 1P bot misses the ≥ 40 % target.
- **Whistled at a member ball:** 1–2 a run. **Members fetched by MOW-E:** 0–2 a run.
- In the browser I never took the whistle (I couldn't reach the post at 1.5 fps), so the feed lines are unverified.

## 3. The story

| Beat | Seen | Verdict |
|---|---|---|
| Club day 4 memo | "Gary visits today. 50% clean by the bell. NEW: bouncy balls ×1.5 and splitters." | Reads fine. Missing the Tournament line (finding 2). |
| Gary at the bell | "Gary: “Saw the mower. Off the record: nice.”" | **Lands.** A warm callback to the boss, in the feed, not in your face. |
| CCTV PA | "Cameras installed. They were always there." | Funny. Once-ever, on the first C press. |
| Caddie cart | "The caddie cart took one. Kazoo." | Good rival flavour. Two in one row reads as a stutter; "took two" would fix it. |
| Tiered opening | PA "Please be experiential." → card "Corporate archive: Ball Retrieval Training, 1987." → "The Rat on the tape looks like Gary." → "Dimples is now dimpl. Lowercase. Experiential." → memo | **The best three cards in my stretch.** Short, one idea each, mystery then joke. Total ~14 s; it didn't block play (the helpers were already working). |
| Stadium opening | "The jumbotron plays a 1958 newsreel. By mistake." → Gary "Nice jumbotron. Don’t get a big head." → "Site 13 sells tickets to its jumbotron." | Good rhythm. Gary's line is the warm one. |

- **Never seen:**
  - "Clean flight! The members are appalled." (no clean flight in the browser);
  - the bell's ALERT (I couldn't walk to the post);
  - "TAP WALL GOT IT" (the bot's orders, not mine);
  - the whistle feed;
  - "MOW-E sends his regards", which is on the boss-win morning, before my stretch.

## 4. Fun in my stretch

- **The best minute.** Tiered's first 30 s: the tape cards, "dimpl", the neon beams on the greens and $299 a ball.
  - At 4P, also the Tournament flight: on the CCTV, four gold beams spread left and right over the field (`pt9-B-club4-flight2-cctv.jpg`). It looks like an event.
- **The dead minute.**
  - **Solo:** Tiered days 3–7, waiting on a third review with the fee long paid.
  - **4P:** the Tournament day *between* flights. T−7:00 to T−5:00 and T−4:30 to T−3:00 are the old fee-only Club.

## 5. Top 5 improvement ideas (ranked)

1. **Move the Members' Bell to Club day 1, or make it ring at every venue's peak.**
   - Option A: sell the bell from the day the Tournament is first *announced*, and let it ring a bonus flight from Club day 4.
   - Option B, better: the bell **rings in a bonus round of the venue's peak everywhere**:
     - a bonus flight at the Club;
     - a "deck rush" at Tiered (see idea 2);
     - a fifth Stretch section at the Stadium.
   - **Why it's fun:** today it's bought where it does nothing (0 rings in 9 runs). A bell you ring is a crew moment: "Ring it now, we're all out here!"
2. **A Tiered peak: "Happy Hour on the deck" at T−4:00, 60 s.**
   - Three deck orders at once.
   - Plus a "lounger wants a ball off the green" call on each target green: lit, with a 30 s clock, ×20 BV, banked like member balls.
   - **Why it's fun:** it pulls the non-cook Rats into the deck's story (aim at greens or carry), and gives the 1P/4P crew a 1.5+ minute. It reuses the member-ball code.
3. **Fix solo Tiered's sag.** At 1P, either:
   - reviews count a daily-target hit *or* a cleared Happy Hour; or
   - the "bowls full at 2:30" read waits for the bowls to be under half, not empty.
   - **Why it's fun:** 1P Tiered is 5–9 shifts against 3 at 4P. The solo player waits days on one goal with $1M+ in the bank, which is the opposite of "one more shift".
4. **Make the Tournament visible before and after.**
   - Give the day-4 memo its line: let the Tournament take the NEW slot, and push bouncy/splitter to their own feed tip.
   - Add a report row: "Members' balls 3 of 4 · +$7,363", or "The caddie took 4. Kazoo."
   - **Why it's fun:** the payoff (and the caddie's comedy) needs a scoreboard, and a crew should walk out knowing "the members are playing today".
5. **Solo Tournament: 1 ball a flight with a 45 s clock at 1P,** and the caddie cart visible from the ball's landing.
   - **Why it's fun:** today the solo player banks 17 % and mostly watches a kazoo. One reachable ball is a sprint you can win: a race against the cart, not a lottery.

## 6. Scores (Club day 4 → Stadium day 1)

| Metric | Score | Why |
|---|---|---|
| Fun | **7** | The Tournament gives the Club's tail a real event at 2P+. Tiered's opening is a delight. Solo Tiered drags. |
| Clarity | **6.5** | Beams and the Board read well. The Tournament isn't announced in the memo, flight 2's ALERT gets lost in a busy 40 s, and the report forgets it. |
| Text load | **7.5** | 0 overlaps. The opening card runs are 3 cards plus a memo, short. One 11-word memo. |
| Pacing | **6.5** | 4P is tight (38 min Club d4 → Stadium). 1P Tiered at 5–9 shifts is the game's longest sag. |
| Co-op | **7** | The 4P split on member balls is real (16 of 30 banked). The deck cook stays a solo job. |
| Meaningful features | **6.5** | The Tournament adds +25 % on Club day 4 and shortened the Club once. The bell does nothing in practice. The Tap Wall arrives on Tiered's last day. |
| Look & feel | **7** | Gold beams over the field and Tiered's neon greens. Club spawn still has a pillar. Tap Wall unseen from the ground. |
| Polish | **6.5** | The landmark row is hidden in the lobby, the caddie feed double, and the memo slot clash. |
| One more shift | **6.5** | Strong at 4P (the Stadium jump ×11–18 is a rush). Weak in the solo Tiered middle. |
| Decision density | **6.5** | Club d4+ is 1.4–1.6 a minute on the ruler, but ~0.86 of that is member balls you can ignore. Tiered off the deck is 0.9–1.4. |
| **Overall** | **6.8** | A clear step up for the Club's tail (B was 6.5). The bell and solo Tiered keep it under 7.2. |
