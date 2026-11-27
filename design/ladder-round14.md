# Round 14 — the lead's headless ladder (§4.1 step 3)

1P / 2P / 4P × seeds 7 / 11 / 23, `BUY=1 TOURNEY=1 WHISTLE=aim POACH=1`, Muni day 1 → endless day 5, through the
real `Crew` (`server/crew.mjs`). Measured on the working tree at `53946ef` plus the uncommitted round-14 edits on
2026-11-27 (it is not a clean commit, so treat the numbers as "this candidate"). About 30 minutes of wall time in all.
Nothing was trimmed: every size and every seed ran.

## How it was run

- **Driver:** `scripts/bots/ladder14.mjs` (a new file). It chains `muni.mjs → mid.mjs (FIGHT=55) → late11.mjs (JOB=1
  STOPV=99 ENDLESS=5)` with `START_FILE`/`SNAP_FILE` hand-offs, the same way `make-presets.mjs` does. It also preloads
  a hook into each bot process that wraps `CallTally.endShift`. The hook adds the bell's cash, the promotion fee, the
  card, the venue at the bell, and the longest no-call stretch of each shift to the shared calls tally. No game, bot
  or test file was edited.
- **Caps:** twice `make-presets.mjs`' caps (`0:16,1:20,2:12,3:12,4:12,5:8`), so a slow crew can be told apart from a
  stuck one. Shifts over make-presets' own caps are marked "(cap N)" in the tables. Where a 1P chain hit even the
  doubled cap, I continued the same crew from its last morning snap with no cap (`midcont`, `late2`) to see whether
  it ever gets through. It always did.
- **Time:** "shift-min" is sim minutes inside shifts (the CallTally clock). "With lobby" adds the bots' own lobby
  allowance: muni 0 s, mid 30 s and late11 40 s per shift, plus 36.4 s for the ending report's hold (see finding 3).
- **The policy flags reach mid and late11 only.** `muni.mjs` loads no policies, so at Muni `BUY/TOURNEY/WHISTLE/POACH`
  do nothing, and the Gold Rush gold calls are never answered there (the bot doesn't chase them).
- **Substitutes, labelled:**
  - **1P Muni:** `muni.mjs` at 1P never passes Gary's huddle. That held on all three seeds: 14 days each, the
    `huddle:0/1` goal never done, Gary failing 3 or 4 of his 4 checks every day although the bot huddles. So every 1P
    chain starts from the **same-seed 4P crew's Club day 1**, which is what `make-presets.mjs` does. The 1P Muni rows
    below are therefore the 4P Muni's.
  - **2P Muni:** the 2P bot passes Muni itself on every seed (4–5 shifts). No substitute was needed.
  - I tried the presets `tiered1-1p` (seed 7) and `club4-1p` (seed 23) as alternatives too. Both got through Tiered,
    in 3 and 8 shifts. They are not used in the tables.

## Reach the ending (Last Bucket banked) and endless day 5

| Crew | seed 7 | seed 11 | seed 23 |
|---|---|---|---|
| **1P** | yes¹: 4:47 shift / 5:08 lobby · stalled at Tiered at the cap (reviews 2/3, 12 shifts), got through on Tiered shift 14 | yes¹: 4:11 / 4:31 · Tiered 12, County 9 | yes¹: 8:09 / 8:49 · stalled at Club at the cap (seal 0/1, 20 shifts), then at County (pass 0/1, 12 shifts), got through after 31 County shifts |
| **2P** | yes: 1:59 / 2:08 | yes: 2:08 / 2:17 | yes: 2:08 / 2:17 |
| **4P** | yes: 1:53 / 2:01 | yes: 2:00 / 2:08 | yes: 1:53 / 2:01 |

¹ Muni was played by the 4P crew (the substitute above). Every chain then played 5 endless shifts (endless day 5).
That only happened after the ending-hold workaround (finding 3).

**No game softlock was found.** Every stall is one of two things. Either the solo bot can't pass Gary's inspection
(Muni huddle, Club seal, County pass), or the 1P Tiered `reviews` goal takes a very long time. In both cases the same
crew got through when allowed more shifts. The known "2P mid chain stalls at Tiered" did **not** happen this time:
2P cleared Tiered in 3–5 shifts on every seed.

## Summary per crew size (min / median / max over the seeds)

| Size | Reached ending | Shift-min to ending | h:mm with lobby | Muni | Club | Tiered | Stadium | County | Orbital |
|---|---|---|---|---|---|---|---|---|---|
| 1P | 3/3 (Muni = 4P sub) | 251 / **287** / 489 | 4:31 / **5:08** / 8:49 | 4 / 4 / 4 (sub) | 4 / 13 / 20 | 9 / 12 / 14 | 4 / 5 / 6 | 5 / 9 / 31 | 2 / 2 / 2 |
| 2P | 3/3 | 119 / **128** / 128 | 2:08 / **2:17** / 2:17 | 4 / 4 / 5 | 4 / 4 / 5 | 3 / 4 / 5 | 2 / 2 / 2 | 2 / 2 / 2 | 2 / 2 / 2 |
| 4P | 3/3 | 113 / **113** / 120 | 2:01 / **2:01** / 2:08 | 4 / 4 / 4 | 4 / 4 / 5 | 3 / 3 / 3 | 2 / 2 / 2 | 2 / 2 / 2 | 2 / 2 / 2 |

(The venue columns are shifts per venue. The h:mm column includes the bots' lobby time.)

## What reviewers should know

1. **1P is the long road, and the wall is Gary.** The solo bots fail Gary's inspection again and again:
   - the Muni huddle never, at 14/14 days on all three seeds;
   - the Club seal: 2, 13 and 20 shifts;
   - the County pass: 5, 9 and 31 shifts.

   They fail it because one Rat can't keep the sign, the mats and the stand hosed before he arrives (3–4 fails a
   visit). A human may well do better, but Reviewer B (solo) should time Gary's visits. A solo crew that misses the
   inspection has nothing to do except replay the day.
2. **1P Tiered is 9–14 shifts against a cap of 6.** Targets, orders and gutters are done by Tiered day 3. Then
   `reviews` (the daily target hit 3×) creeps to 2/3, and the card only closes on a Promotion Day. Meanwhile the cash
   runs past the fee by 5–8× (a $3–4.8M bank against $600k). That is many shifts with the card stuck on one row and
   money with no use.
3. **The ending report's new Ready hold (round 14 6.7) breaks the bots, not the game.** After the Last Bucket,
   `late11.mjs` calls `readyUp` on a report that holds Ready for 36.4 s (`endingReadyFrom`). The bot never ticks the
   report phase, so every "endless shift" came back as 0 s, with the day stuck and no calls. The server's tick does
   start the countdown once the hold ends, so a real crew is fine. For this ladder the hook ends the hold when Ready
   is pressed, and the time is counted as 36.4 s of lobby. **Every bot that plays past the ending (late11,
   pt7c-endless, make-presets' `endless` chain) needs to tick through the report.**
4. **Muni is quiet.** Calls run 0.7–0.9 offered a minute and about 0.35 answered, at every crew size. Two thirds of
   Muni shifts (7/12 at 4P, 9/13 at 2P) have a **stretch over 3 min with no call**. Day 1 is the worst: a 4-min
   shift with one wash call at 0:00 and then 240 s of nothing.
5. **The Club has the other >3 min gaps.** Every chain has one Club shift with a 190–250 s no-call stretch: one of
   13 shifts at 2P and 4P, three of 37 at 1P. Calls there run 1.3–1.6 a minute. From Tiered on, no shift at any size
   has a gap over 90 s.
6. **Calls a minute by venue (offered / answered, all seeds pooled):**
   - **4P:** Muni 0.82/0.36, Club 1.39/0.66, Tiered 3.32/2.26, Stadium 4.70/3.59, County 2.51/2.22, Orbital 2.64/2.44,
     Endless 2.11/1.97.
   - **1P:** the solo crew is offered about as much but answers about half as much: Stadium 3.75/1.05, County
     3.13/1.25, Tiered 2.59/1.24. Most unanswered calls are deck orders and Stadium requests (1P Stadium answered 9
     of 72 requests).
   - `deal` and `gold` calls are never answered at any venue: neither has an answer tag in `calls.mjs`, and the muni
     bot doesn't chase gold. So "answered" under-reads Muni and the Club.
7. **Money.** At 2P and 4P the cash at each last bell is 1.0–1.8× the fee at Muni, the Club and Tiered, so the fee is
   what the crew is waiting on. From the Stadium on it is 1.5–2.6× (Stadium $6.8–17M against $4.2–6.6M; County
   $32–66M against $17.5–27.5M). At 1P the fee is never the blocker after Muni: Club $75k–801k against $50k, County
   $97–359M against $12.5M.
8. **Stadium, County and Orbital are a flat 2 + 2 + 2 shifts at 2P and 4P on every seed.** Every 4P Stadium
   (3/3), one 4P Tiered and one 2P Stadium promoted on a Promotion Day. The Tournament runs on 1–2 Club days a chain. The
   Members' Bell was rung in most of the shifts it was owned. POACH poached 1–2 times a chain and acquired 1 regular
   in 6 of the 9 chains.

## Reproduce

```
node scripts/bots/ladder14.mjs chain <1|2|4> <seed> --out DIR     # one chain (run all nine in parallel: about 4 min)
node scripts/bots/ladder14.mjs late  <n> <seed> --out DIR         # redo the Stadium→endless leg from the chain's snaps
LADDER_CAPS=0:40,1:40,2:40,3:40,4:40,5:40 node scripts/bots/ladder14.mjs leg <n> <seed> <tag> <mid|late11> <start.json|preset.json> --out DIR
LADDER14_ENDHOLD=0 ...                                            # turn off the ending-hold workaround (shows the 0 s endless)
```

## Per chain

"PD" means the crew was promoted at that bell on a Promotion Day. The cash shown is then before the fee (the cash
after the bell plus the old fee). Orbital and endless have no fee.

### 1P · seed 7

Legs: muni4p → mid → midcont → late (muni4p = the 4P crew's Muni, substitute)

Ending: **yes** — 287 shift-min (4:47), 5:08 with lobby · endless shifts: 5

| Venue | Shifts | Shift-min | Offered/min | Answered/min | Longest no-call stretch | Shifts with a >3 min gap | Cash at last bell | Fee | Card at last bell |
|---|--:|--:|--:|--:|--:|--:|--:|--:|---|
| Muni (4P sub) | 4 | 24 | 0.79 | 0.33 | 240 s | 3 | $9,522 | $5,500 | bank+ washer+ huddle+ reviews+ fee+ |
| Club | 13 (cap 10) | 91 | 1.56 | 0.67 | 191 s | 1 | $435,363 | $50,000 | fed+ treasures+ seal+ reviews+ fee+ |
| Tiered | 14 (cap 6) | 98 | 2.60 | 1.19 | 60 s | 0 | $4.80M (PD) | $600,000 | promoted on Promotion Day |
| Stadium | 4 | 28 | 3.70 | 1.03 | 40 s | 0 | $3.29M | $3.00M | requests+ pings+ cart2+ reviews+ fee+ |
| County | 5 | 35 | 2.82 | 1.23 | 60 s | 0 | $38.68M | $12.50M | strays+ drones+ pass+ reviews+ fee+ |
| Orbital | 2 | 10 | 2.57 | 1.29 | 60 s | 0 | $98.30M | — |  |
| Endless | 5 | 35 | 2.13 | 1.16 | 60 s | 0 | $191.76M | — |  |

### 1P · seed 11

Legs: muni4p → mid → late (muni4p = the 4P crew's Muni, substitute)

Ending: **yes** — 251 shift-min (4:11), 4:31 with lobby · endless shifts: 5

| Venue | Shifts | Shift-min | Offered/min | Answered/min | Longest no-call stretch | Shifts with a >3 min gap | Cash at last bell | Fee | Card at last bell |
|---|--:|--:|--:|--:|--:|--:|--:|--:|---|
| Muni (4P sub) | 4 | 24 | 0.79 | 0.33 | 240 s | 2 | $9,844 | $5,500 | bank+ washer+ huddle+ reviews+ fee+ |
| Club | 4 | 28 | 1.53 | 0.75 | 190 s | 1 | $74,551 | $50,000 | fed+ treasures+ seal+ reviews+ fee+ |
| Tiered | 12 (cap 6) | 84 | 2.45 | 1.28 | 60 s | 0 | $4.60M (PD) | $600,000 | promoted on Promotion Day |
| Stadium | 6 | 42 | 3.75 | 1.02 | 40 s | 0 | $6.04M | $3.00M | requests+ pings+ cart2+ reviews+ fee+ |
| County | 9 (cap 6) | 63 | 2.93 | 1.24 | 60 s | 0 | $96.81M | $12.50M | strays+ drones+ pass+ reviews+ fee+ |
| Orbital | 2 | 10 | 3.05 | 1.83 | 60 s | 0 | $154.57M | — |  |
| Endless | 5 | 35 | 2.50 | 1.76 | 60 s | 0 | $255.82M | — |  |

### 1P · seed 23

Legs: muni4p → mid → midcont → late → late2 (muni4p = the 4P crew's Muni, substitute)

Ending: **yes** — 489 shift-min (8:09), 8:49 with lobby · endless shifts: 5

| Venue | Shifts | Shift-min | Offered/min | Answered/min | Longest no-call stretch | Shifts with a >3 min gap | Cash at last bell | Fee | Card at last bell |
|---|--:|--:|--:|--:|--:|--:|--:|--:|---|
| Muni (4P sub) | 4 | 24 | 0.88 | 0.42 | 240 s | 2 | $8,771 | $5,500 | bank+ washer+ huddle+ reviews+ fee+ |
| Club | 20 (cap 10) | 140 | 1.59 | 0.72 | 207 s | 1 | $801,422 | $50,000 | fed+ treasures+ seal+ reviews+ fee+ |
| Tiered | 9 (cap 6) | 63 | 2.76 | 1.24 | 60 s | 0 | $3.05M (PD) | $600,000 | promoted on Promotion Day |
| Stadium | 5 | 35 | 3.79 | 1.11 | 40 s | 0 | $3.46M | $3.00M | requests+ pings+ cart2+ reviews+ fee+ |
| County | 31 (cap 6) | 217 | 3.23 | 1.26 | 60 s | 0 | $358.54M | $12.50M | strays+ drones+ pass+ reviews+ fee+ |
| Orbital | 2 | 9 | 2.16 | 0.65 | 70 s | 0 | $405.89M | — |  |
| Endless | 5 | 35 | 2.33 | 1.36 | 60 s | 0 | $207.55M | — |  |

### 2P · seed 7

Legs: muni → mid → late

Ending: **yes** — 119 shift-min (1:59), 2:08 with lobby · endless shifts: 5

| Venue | Shifts | Shift-min | Offered/min | Answered/min | Longest no-call stretch | Shifts with a >3 min gap | Cash at last bell | Fee | Card at last bell |
|---|--:|--:|--:|--:|--:|--:|--:|--:|---|
| Muni | 4 | 24 | 0.83 | 0.42 | 240 s | 3 | $4,592 | $3,500 | bank+ washer+ huddle+ reviews+ fee+ |
| Club | 5 | 35 | 1.57 | 0.83 | 249 s | 1 | $100,776 | $70,000 | fed+ treasures+ seal+ reviews+ fee+ |
| Tiered | 3 | 21 | 3.13 | 1.09 | 45 s | 0 | $1.22M | $840,000 | targets+ orders+ gutters+ reviews+ fee+ |
| Stadium | 2 | 14 | 4.40 | 2.91 | 40 s | 0 | $6.82M | $4.20M | requests+ pings+ cart2+ reviews+ fee+ |
| County | 2 | 14 | 2.70 | 2.13 | 60 s | 0 | $32.33M | $17.50M | strays+ drones+ pass+ reviews+ fee+ |
| Orbital | 2 | 11 | 2.85 | 2.11 | 60 s | 0 | $83.20M | — |  |
| Endless | 5 | 35 | 2.33 | 2.04 | 60 s | 0 | $181.22M | — |  |

### 2P · seed 11

Legs: muni → mid → late

Ending: **yes** — 128 shift-min (2:08), 2:17 with lobby · endless shifts: 5

| Venue | Shifts | Shift-min | Offered/min | Answered/min | Longest no-call stretch | Shifts with a >3 min gap | Cash at last bell | Fee | Card at last bell |
|---|--:|--:|--:|--:|--:|--:|--:|--:|---|
| Muni | 5 | 31 | 0.71 | 0.32 | 240 s | 3 | $3,914 | $3,500 | bank+ washer+ huddle+ reviews+ fee+ |
| Club | 4 | 28 | 1.14 | 0.57 | 247 s | 1 | $79,394 | $70,000 | fed+ treasures+ seal+ reviews+ fee+ |
| Tiered | 4 | 28 | 2.88 | 1.10 | 60 s | 0 | $1.53M | $840,000 | targets+ orders+ gutters+ reviews+ fee+ |
| Stadium | 2 | 14 | 3.97 | 2.77 | 40 s | 0 | $8.48M | $4.20M | requests+ pings+ cart2+ reviews+ fee+ |
| County | 2 | 14 | 2.91 | 2.27 | 60 s | 0 | $34.55M | $17.50M | strays+ drones+ pass+ reviews+ fee+ |
| Orbital | 2 | 13 | 3.16 | 2.37 | 63 s | 0 | $90.03M | — |  |
| Endless | 5 | 35 | 2.30 | 2.02 | 60 s | 0 | $220.63M | — |  |

### 2P · seed 23

Legs: muni → mid → late

Ending: **yes** — 128 shift-min (2:08), 2:17 with lobby · endless shifts: 5

| Venue | Shifts | Shift-min | Offered/min | Answered/min | Longest no-call stretch | Shifts with a >3 min gap | Cash at last bell | Fee | Card at last bell |
|---|--:|--:|--:|--:|--:|--:|--:|--:|---|
| Muni | 4 | 24 | 0.67 | 0.25 | 240 s | 3 | $5,026 | $3,500 | bank+ washer+ huddle+ reviews+ fee+ |
| Club | 4 | 28 | 1.25 | 0.64 | 201 s | 1 | $83,896 | $70,000 | fed+ treasures+ seal+ reviews+ fee+ |
| Tiered | 5 | 35 | 3.65 | 1.37 | 60 s | 0 | $1.39M | $840,000 | targets+ orders+ gutters+ reviews+ fee+ |
| Stadium | 2 | 14 | 4.61 | 3.48 | 55 s | 0 | $9.63M (PD) | $4.20M | promoted on Promotion Day |
| County | 2 | 14 | 2.55 | 2.20 | 60 s | 0 | $32.66M | $17.50M | strays+ drones+ pass+ reviews+ fee+ |
| Orbital | 2 | 12 | 2.82 | 2.17 | 68 s | 0 | $95.81M | — |  |
| Endless | 5 | 35 | 2.10 | 1.82 | 60 s | 0 | $208.96M | — |  |

### 4P · seed 7

Legs: muni → mid → late

Ending: **yes** — 113 shift-min (1:53), 2:01 with lobby · endless shifts: 5

| Venue | Shifts | Shift-min | Offered/min | Answered/min | Longest no-call stretch | Shifts with a >3 min gap | Cash at last bell | Fee | Card at last bell |
|---|--:|--:|--:|--:|--:|--:|--:|--:|---|
| Muni | 4 | 24 | 0.79 | 0.33 | 240 s | 3 | $9,522 | $5,500 | bank+ washer+ huddle+ reviews+ fee+ |
| Club | 4 | 28 | 1.57 | 0.78 | 205 s | 1 | $110,984 | $110,000 | fed+ treasures+ seal+ reviews+ fee+ |
| Tiered | 3 | 21 | 3.74 | 2.46 | 60 s | 0 | $1.57M | $1.32M | targets+ orders+ gutters+ reviews+ fee+ |
| Stadium | 2 | 14 | 4.54 | 3.19 | 55 s | 0 | $13.10M (PD) | $6.60M | promoted on Promotion Day |
| County | 2 | 14 | 2.62 | 2.20 | 60 s | 0 | $56.13M | $27.50M | strays+ drones+ pass+ reviews+ fee+ |
| Orbital | 2 | 11 | 2.42 | 2.24 | 64 s | 0 | $206.20M | — |  |
| Endless | 5 | 35 | 2.13 | 1.99 | 60 s | 0 | $189.65M | — |  |

### 4P · seed 11

Legs: muni → mid → late

Ending: **yes** — 120 shift-min (2:00), 2:08 with lobby · endless shifts: 5

| Venue | Shifts | Shift-min | Offered/min | Answered/min | Longest no-call stretch | Shifts with a >3 min gap | Cash at last bell | Fee | Card at last bell |
|---|--:|--:|--:|--:|--:|--:|--:|--:|---|
| Muni | 4 | 24 | 0.79 | 0.33 | 240 s | 2 | $9,844 | $5,500 | bank+ washer+ huddle+ reviews+ fee+ |
| Club | 5 | 35 | 1.34 | 0.63 | 205 s | 1 | $127,697 | $110,000 | fed+ treasures+ seal+ reviews+ fee+ |
| Tiered | 3 | 21 | 2.94 | 1.94 | 60 s | 0 | $1.73M | $1.32M | targets+ orders+ gutters+ reviews+ fee+ |
| Stadium | 2 | 14 | 4.68 | 3.55 | 55 s | 0 | $11.08M (PD) | $6.60M | promoted on Promotion Day |
| County | 2 | 14 | 2.34 | 2.13 | 60 s | 0 | $61.64M | $27.50M | strays+ drones+ pass+ reviews+ fee+ |
| Orbital | 2 | 11 | 2.48 | 2.39 | 71 s | 0 | $208.54M | — |  |
| Endless | 5 | 35 | 2.02 | 1.87 | 60 s | 0 | $190.30M | — |  |

### 4P · seed 23

Legs: muni → mid → late

Ending: **yes** — 113 shift-min (1:53), 2:01 with lobby · endless shifts: 5

| Venue | Shifts | Shift-min | Offered/min | Answered/min | Longest no-call stretch | Shifts with a >3 min gap | Cash at last bell | Fee | Card at last bell |
|---|--:|--:|--:|--:|--:|--:|--:|--:|---|
| Muni | 4 | 24 | 0.88 | 0.42 | 240 s | 2 | $8,771 | $5,500 | bank+ washer+ huddle+ reviews+ fee+ |
| Club | 4 | 28 | 1.28 | 0.57 | 204 s | 1 | $117,745 | $110,000 | fed+ treasures+ seal+ reviews+ fee+ |
| Tiered | 3 | 21 | 3.27 | 2.37 | 60 s | 0 | $1.70M (PD) | $1.32M | promoted on Promotion Day |
| Stadium | 2 | 14 | 4.89 | 4.04 | 55 s | 0 | $17.13M (PD) | $6.60M | promoted on Promotion Day |
| County | 2 | 14 | 2.55 | 2.34 | 60 s | 0 | $66.01M | $27.50M | strays+ drones+ pass+ reviews+ fee+ |
| Orbital | 2 | 12 | 3.01 | 2.67 | 90 s | 0 | $89.55M | — |  |
| Endless | 5 | 35 | 2.19 | 2.04 | 60 s | 0 | $180.91M | — |  |

## Summary per crew size (as generated; same numbers as above)

| Size | Reached ending | Shift-min to ending | h:mm with lobby | Muni shifts | Club shifts | Tiered shifts | Stadium shifts | County shifts | Orbital shifts |
|---|---|---|---|---|---|---|---|---|---|
| 1P | 3/3 | 251 / 287 / 489 | 4:31 / 5:08 / 8:49 | 4 / 4 / 4 | 4 / 13 / 20 | 9 / 12 / 14 | 4 / 5 / 6 | 5 / 9 / 31 | 2 / 2 / 2 |
| 2P | 3/3 | 119 / 128 / 128 | 2:08 / 2:17 / 2:17 | 4 / 4 / 5 | 4 / 4 / 5 | 3 / 4 / 5 | 2 / 2 / 2 | 2 / 2 / 2 | 2 / 2 / 2 |
| 4P | 3/3 | 113 / 113 / 120 | 2:01 / 2:01 / 2:08 | 4 / 4 / 4 | 4 / 4 / 5 | 3 / 3 / 3 | 2 / 2 / 2 | 2 / 2 / 2 | 2 / 2 / 2 |

## Calls a minute per venue, pooled over the seeds (offered / answered; longest no-call stretch in any shift)

| Venue | 1P | 2P | 4P |
|---|---|---|---|
| Muni (1P = 4P sub) | 0.82 / 0.36 · 240 s · 7/12 shifts >3 min | 0.73 / 0.33 · 240 s · 9/13 shifts >3 min | 0.82 / 0.36 · 240 s · 7/12 shifts >3 min |
| Club | 1.57 / 0.71 · 207 s · 3/37 shifts >3 min | 1.34 / 0.69 · 249 s · 3/13 shifts >3 min | 1.39 / 0.66 · 205 s · 3/13 shifts >3 min |
| Tiered | 2.59 / 1.24 · 60 s · 0/35 shifts >3 min | 3.26 / 1.21 · 60 s · 0/12 shifts >3 min | 3.32 / 2.26 · 60 s · 0/9 shifts >3 min |
| Stadium | 3.75 / 1.05 · 40 s · 0/15 shifts >3 min | 4.33 / 3.05 · 55 s · 0/6 shifts >3 min | 4.70 / 3.59 · 55 s · 0/6 shifts >3 min |
| County | 3.13 / 1.25 · 60 s · 0/45 shifts >3 min | 2.72 / 2.20 · 60 s · 0/6 shifts >3 min | 2.51 / 2.22 · 60 s · 0/6 shifts >3 min |
| Orbital | 2.60 / 1.27 · 70 s · 0/6 shifts >3 min | 2.95 / 2.22 · 68 s · 0/6 shifts >3 min | 2.64 / 2.44 · 90 s · 0/6 shifts >3 min |
| Endless | 2.32 / 1.43 · 60 s · 0/15 shifts >3 min | 2.24 / 1.96 · 60 s · 0/15 shifts >3 min | 2.11 / 1.97 · 60 s · 0/15 shifts >3 min |

## What the calls are (offered, all seeds pooled, per crew size)

- 1P Muni: deal 18, basket 14/14, wash 12/12, gold 12, gary 3
- 1P Club: member 164/66, deal 74, wash 51/49, treasure 35/34, whistle 31/29, gary 30, gold 9, boss 9, fries 5/5
- 1P Tiered: deckOrder 367/212, deal 70, wash 59/31, lounger 53, whistle 35/30, gary 20, basket 17/17, treasure 14/13
- 1P Stadium: deckOrder 150/60, request 72/9, wash 44, basket 37/37, stretch 33, deal 30, whistle 15/5, boss 9, gary 5
- 1P County: deckOrder 450/180, wash 125/52, basket 120/120, deal 120, inspector 81/15, whistle 45/28, gary 42, treasure 3
- 1P Orbital: deckOrder 37/14, wash 14/8, basket 13/12, whistle 6/3, deal 5, treasure 1
- 1P Endless: deckOrder 149/70, basket 46/46, wash 20/20, deal 15, fries 15/15
- 2P Muni: deal 20, wash 13/13, basket 13/13, gold 9, gary 3
- 2P Club: wash 26/22, deal 26, member 18/13, treasure 15/15, gold 9, boss 9, whistle 7/7, fries 6/6, gary 6
- 2P Tiered: deckOrder 124/39, lounger 44, wash 28/13, deal 24, treasure 14/12, fries 14/14, whistle 12/12, basket 12/12, gary 3
- 2P Stadium: deckOrder 60/50, request 33/18, fries 20/20, basket 19/19, stretch 12/7, deal 12, wash 9/9, boss 9, whistle 6/6, treasure 2, gary 1
- 2P County: deckOrder 60/54, basket 21/21, deal 12, whistle 6/6, wash 6/6, inspector 6/6, gary 3, treasure 1
- 2P Orbital: deckOrder 45/29, basket 26/24, fries 16/16, whistle 6/5, wash 6/6, deal 5, gary 2
- 2P Endless: deckOrder 147/132, basket 60/60, wash 15/15, deal 15
- 4P Muni: deal 18, basket 14/14, wash 12/12, gold 12, gary 3
- 4P Club: deal 26, member 24/14, wash 21/18, gold 12, treasure 9/9, boss 9, fries 8/8, gary 7, whistle 7/7, basket 4/4
- 4P Tiered: deckOrder 91/84, lounger 39, fries 27/27, deal 18, wash 12/12, whistle 9/9, basket 8/8, gary 3, treasure 3/3
- 4P Stadium: deckOrder 60/58, request 42/29, basket 21/21, fries 19/19, stretch 19/13, deal 12, boss 9, whistle 6/6, wash 6/6, gary 3, treasure 2
- 4P County: deckOrder 60/60, basket 17/17, deal 7, whistle 6/6, wash 6/6, inspector 6/5, gary 3, treasure 1
- 4P Orbital: deckOrder 42/41, fries 20/20, basket 11/10, whistle 6/6, wash 6/6, deal 3, gary 2
- 4P Endless: deckOrder 148/148, basket 37/37, wash 15/15, deal 15, fries 8/8

## The 1P Muni bot (muni.mjs at 1P, all seeds)

- seed 7: 14 shifts (94 shift-min), never promoted; last bell day 14: cash $15,863 vs fee $2,500, card `bank+ washer+ huddle:0/1 reviews+ fee+`; calls 0.98 / 0.55 a min
- seed 11: 14 shifts (94 shift-min), never promoted; last bell day 14: cash $16,661 vs fee $2,500, card `bank+ washer+ huddle:0/1 reviews+ fee+`; calls 0.98 / 0.55 a min
- seed 23: 14 shifts (94 shift-min), never promoted; last bell day 14: cash $15,260 vs fee $2,500, card `bank+ washer+ huddle:0/1 reviews+ fee+`; calls 0.99 / 0.56 a min