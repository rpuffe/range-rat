# Playthrough 2 (2026-11-24, build d66602a): reports for council round 7

## Playtester B — the Club and Tiered

**Scores:** Fun 6.5 · Clarity 5 · Text load 5 · Pacing 7 · Co-op 6 · Meaningful 6 · Look & feel 7 ·
Polish 5.5 · One more shift 6.5 · **Overall 6**. "Round 6 gave Tiered a real goal; gutters plus an
invisible ring take it back."

**Best:** Last Call with Bowl C at 12: one TARGET flushed it (gauge 0.43 → 0.80), the cups refilled to
0.50 by 0:13, a second TARGET saved it, the bell stamped APPROVED at 73%.
**Flattest:** Tiered days 2–3 after gutters: gauge 1.0 all day, cups 0/0/0, no reason to stand at a bay.

**Findings (bugs fixed after this round are marked ✓):**
1. ✓ The diver's body is drawn standing on the pond surface for other players (main.js mates loop).
2. The landing ring is effectively invisible from the bays (27×0.9 px at Bowl A, 9×0.1 px at C).
3. ✓ The Last Call line says "On target" from the gauge at the start of Last Call; the ×1.5 swing rush
   then fills the cups (avg −0.25 gauge, ~8 balls) and the stamp is DENIED (6 of 9 "On target" bells).
4. **Design:** gutters make the gauge automatic: after buying them (Tiered day 1) TARGETs are 0 every
   shift, gauge 1.0 at every bell. Without gutters and no shooter: 13 Tiered shifts; with a shooter 5;
   with gutters 3.
5. ✓ Shots from the east bay hit teenagers walking to the stand (30% of Bowl A shots).
6. ✓ The Tiered bay prompt says "aim at the cart".
7. ✓ Last Call stacked the glow-ball memo, the swing prompt and the rally toast.
8. Deck orders: 20 s is shorter than a human pour (10–14 s plus the walk): 9–12 of 14 filled; a
   careless order-only cook never reaches amber, so incidents are 0 (goal 1–3).
9. ✓ TARGET toast: "TARGET! Bowl B: 1 balls flushed. Hustle x1.25" → short.
10. ✓ Shed prompt "Click Open the kitchen".

**Numbers:** ring vs rest for a pure strike: 0.000 m median (every miss was a teenager). Human-noise
TARGET rate 56–92% per bay/bowl. Dedicated shooter pre-gutters 4–24 TARGETs a shift; solo 2–6; after
gutters 0. Deck tab share 5–13% at human pour speed. Club no longer a grind: 4 shifts at 4P, cash at the
Tiered promotion $110–124k vs the $110k fee. Pace from Club day 1 to the Stadium: 53–68 min at 4P.

**Ideas for council 7**
1. A ring you can see at 50–150 m: a vertical marker at the predicted rest (a short pillar or billboard
   dot in your colour, turning the bowl's colour when it would score) (S).
2. Gutters stop being an off switch: drain slowly (0.2/s per cup, so Last Call still fills them), or pay
   the stand at a discount while a TARGET flush pays a premium (S).
3. The Last Call line forecasts the rush; re-fire one line when the gauge crosses the tick (XS).
4. The bay prompt names the greens; one queue for memo and rally (XS).
5. Deck orders a human can fill and overdo: 30 s windows; a "round for the deck" (double beer, 25×BV,
   +2 drinks) so a careless cook can make someone fall (S).
- **Cut:** the default-power ground ring before your first swing (0.7 lands ~150 m out).
- Not worth it: the dive scooter (no visible payback).

## Playtester C — Stadium → County → Orbital → the Last Bucket → endless

**Scores:** Fun 6.5 · Clarity 7 · Text load 5 · Pacing 6.5 · Co-op 6 · Meaningful 5.5 · Look & feel 7.5 ·
Polish 6 · One more shift 5 · **Overall 6**. "A clear step up in the late game. The finale's text and
endless are what hold it back."

**Best:** the County bell: a horn at sunset, "Strays in the Yards. Go get them!", a grey DENIED with
"Missed: strays in the Yards." One line, obvious what to do tomorrow.
**Flattest:** endless: three shifts at $63–67M, one record broken by $0.8M, nothing to buy.

**Findings (✓ = fixed after this round):**
1. ✓ The finale stacks the memo, a PA card and $∞ (ending.js writes the memo directly; `pa('last')`).
2. ✓ PA cards never wait for a memo (pa.js).
3. ✓ A Stadium "lap" was 3/4 of the oval (four gate sightings = three quarter-turns).
4. **Design:** the Stadium gauge is a pure last-minute chore: 0.08–0.27 at Last Call for everyone, one
   cart lapping 60 s takes it to 0.76–0.90. The second cart is never needed.
5. **Design:** the County gauge depends on how clean the main field is: a tidy crew passes free (the
   teenagers walk into the Yards); a slow crew without drones missed 52 shifts running.
6. ✓ Money unformatted on the end card ("1 balls · $55212917.54"), the Board, BV cents in the report.
7. ✓ The Last Bucket banner and the prompt say the same thing.
8. ✓ The DENIED stamp lingers as a watermark behind the report.
9. A carrier who disconnects holds Ball No. 1 for 60 s; an AFK Rat holds the huddle up to 60 s.
10. "Clock in tomorrow" skips the ending day's report (by design now).

**Huddle:** 3.0 s from the carrier reaching the stand to the bank (4P, 6P, solo); 13 attacks, no
softlocks (AFK 12.7 s, mid-sweep join 4.6 s, knockdown 6.5 s, disconnect-for-good: back after 60 s).

**Gauge at the bell (4P normal):** Tiered 1.00 ×3 · Stadium 0.74–0.80 · County 0.90–0.97 · Orbital
0.90. Rally-only crew: Stadium 0.76–0.90 (0.08 at Last Call), County 0.87–0.90, Orbital 0.00 (missed;
only the 15% bonus). Second cart: never needed. Drones: only for slow crews. Tether: protects a bonus
that doesn't matter.

**Pace (4P):** Last Bucket 142 min (fast) – 168 min (slow, no automation); no venue over 4 shifts.
Cash at each promotion ~2× the fee. Endless $63–67M a shift, flat.

**Ideas for council 7**
1. The finale one text at a time (S).
2. Laps worth less after 3 a minute, or the Stadium gauge is the average of the last 2 minutes, so a
   lapper exists during the shift and the second cart earns its place (S).
3. The Orbital stamp should matter, or drop the review there; e.g. debris left at the ending shows on
   the end card ("Orbit: 3 pieces of Corporate still up there") (S).
4. Endless Board: TODAY big, the target as a bar, commas, no cents; pace on the record's own banking
   curve (XS).
5. "Buy Site 12 back" in endless (M).
- **Cut:** the second cart as a Stadium buy, unless idea 2 lands.
