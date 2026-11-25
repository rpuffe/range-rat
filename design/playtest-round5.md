# Playthrough 5 (2026-11-25, build ffdb7ad: owner console playtest + council round 10)

## Playtester B — the Club and Tiered (the mid-game)

**Scores:** Fun 7 · Clarity 7.5 · Text load 6.5 · Pacing 7 · Co-op 7 · Meaningful 7 · Look & feel 7.5 ·
Polish 6.5 · One more shift 7 · **Overall 7**.

**Verdict:** for a 4-Rat crew the mid-game is no longer boring; close to done. The goal card names each
day's job (Club: dogs → treasures → Gary's Seal; Tiered: TARGETs and gutters → deck orders); the menu says
what food pays; the creek ride and the first Deck Cam are good moments. Two weak spots: the last day at
each venue is empty (every feature goal is done by day 2; "Hit the daily target" never fails at the Club),
and 2P stalls badly if nobody camps the kitchen. The one change: make the last goal land on venue day 3
with some risk.

**Best:** the first Deck Cam (a golfer tumbling head-first off the rail). **Flattest:** Club day 4 at 4P,
a whole shift to save the last $12k.

**Findings:**
1. 2P stalls on the cook goals (naive 2P: Club 7–10 shifts, Tiered 6–9; goal-aware 3–4 / 3). Fix: deal
   "Deck order! Pour a beer!" when an order goal is open; the next goal's count in the 2P morning deal.
2. Dead final day at each venue; a 4th Club shift at 4P only for the fee.
3. Bug: a memo and a PA card on screen together (Club morning); a PA card during a Deck Cam.
4. The repeat Deck Cam (1.8 s) shows the deck underside, not the fall; a lower customer fills a third.
5. FED caps after 3 perfect dogs but the goal asks for 30 (4P): teaches spamming dogs.
6. A Club flag (venues.js:94-98) covers the Board's price and FED chip.
7. Bug: a negative day reads "+$-3,800".
8. Bug: beer pays in the lobby (serve has no phase check).
9. HUD shows $0 after a mid-shift rejoin until cash changes.
10. The card heading names the next venue ("The goal card: Tiered…" at the Club) → "Goals for Tiered".
11. Careless pouring has no ceiling (11–14 falls, income ≤ $0); a careful crew never sees the Deck Cam.
12. The kitchen's SERVED card doesn't show the payoff (it's a float behind the overlay).

**Pace (bots play the card):** 4P Club 4 / Tiered 3 (53 min); solo 3/3 (45); goal-aware 2P 3–4/3.
**Ideas:** risk on the last day (S); deal pour lines (S); re-cut the repeat Deck Cam (S); FED goal as
uptime (S); payoff on the SERVED card (XS). Cut: the hot dog count goal as it is.

## Playtester C — Stadium → County → Orbital → the ending → endless

**Scores:** Fun 6.5 · Clarity 7 · Text load 7 · Pacing 6 · Co-op 6.5 · Meaningful 6 · Look & feel 7.5 ·
Polish 5.5 · One more shift 6 · **Overall 6.5**.

**Verdict:** close to done; the finale is the game's best moment and autopilot + pinging gives the
Stadium a real job. But Gary chasing a moving autopilot cart can stall the solo County for days, two late
goals (laps, debris) tick for things the crew didn't do, and late gauges and fees put no pressure on
anyone. The one change: make every late venue's third day matter (a goal that only lands on day 3, a
gauge that can fail).

**Best:** the sky clears, "BALL NO. 1 IS DOWN · follow the beam". **Flattest:** County day 3, card 4/5
with only an unfailable "hit the target" left.

**Findings:**
1. Bug: Gary chases a moving autopilot cart (his cart stop is re-aimed every tick at the muddiest cart);
   some shifts no verdict at all; solo County Gary pass on venue day 5–7.
2. Bug: autopilot laps count toward "Drive 20 laps" (the card ticks with 0 driven laps).
3. Bug: the Orbital debris goal is force-ticked when the sky clears ("24 debris" toast with 0 brought
   down); winched debris doesn't count, so the goal can't progress.
4. "Drones, here!" changes nothing (drones already take strays first) and is taught nowhere.
5. The autopilot cart stays at mud 1.0, pays the ×0.8 gear factor, always fails Gary's cart check.
6. Two autopilot carts lap in lockstep 0.1 m apart; the second cart's route passes the return and a
   Rat standing there halts it.
7. Day 3 at the Stadium and County is empty; 8. the 1.5× late fees never bind at 4P.
9. Harvest mode resets each morning; 10. the record PA before the ending card; the shop lists maxed rows
   first (the tether buried); "HOLD SPACE TOGETHER · 0/1" solo.

**Pace:** 4P Stadium 3 / County 3 / Orbital 2, ~2 h 18 min to the Last Bucket. 0 late DENIEDs in ~40 shifts.

## Playtester A — a new crew to the Range Club

**Scores:** Fun 6.5 · Clarity 7.5 · Text load 7 · Pacing 7 · Co-op 7 · Meaningful 7 · Look & feel 7.5 ·
Polish 6.5 · One more shift 7 · **Overall 7**.

**Verdict:** close to done. The goal card answers "how do I get promoted?" in one look; 4P reaches the Club
in 4–5 shifts, solo 5; dirt, the basket and Gary's intro feel physical. The one blocker: the focused "Next
shift" skips the promotion (solo, or a pad crew). The one change: "Clock out early" once the card is done.

**Best:** holding at the dispenser while the bucket stack grows, then Gary rolling past with his nameplate.
**Flattest:** day 5 after "CARD DONE": 3–5 minutes of waiting for the bell.

**Findings:** (1) Bug: "Next shift" stays primary on a done card and readyUp starts the shift with an
unsigned promotion (solo/pad lose a day); (2) the huddle goal ticks silently under a failed verdict;
(3) dead time after the card is done; (4) "QUOTA HIT" vs "daily target"; (5) an empty basket mid-day barely
signals (no basket: the Club on day 10); (6) the promotion report keeps the old balance; (7) Gary's sign
stop out of chat reach, bubble clipped; (8) neon-lime near ground from 1:30; (9) stale "Full" prompt in the
walk-off, toast over the report footer, stale-code error; (10) solo target ramps by calendar day;
(11) "Open every bay" marginal (solo +10%).
