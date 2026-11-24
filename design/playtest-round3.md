# Playthrough 3 (2026-11-24, build f43665a): reports for council round 8

## Playtester B — the Club and Tiered

**Scores:** Fun 6.5 · Clarity 7 · Text load 7 · Pacing 6 · Co-op 6 · Meaningful 6 · Look & feel 7 ·
Polish 6 · One more shift 6.5 · **Overall 6.5**. "Round 7 fixed Tiered's two big holes. What's left:
Tiered is too safe, and a few text-order bugs."

**Best:** Last Call 0:12, "Bowls are full", one swing at Bowl A flushed 18 balls, 0.40 → 1.00, APPROVED.
**Flattest:** the dealt Gary warning: "Gary checks the cart. Hose it!" on all four screens.

**Findings (✓ = fixed after this round):**
1. **Design:** Tiered can't fail once anyone shoots (7 configurations, all 3 shifts; gauge 0.57–1.00).
2. ✓ The cash toast comes before the TARGET toast (2.5–2.8 s late; dropped at the bell).
3. Gary's dealt warning gives all 4 Rats the same stop ~90% of the time.
4. ✓ The gauge-slip rally isn't dealt.
5. ✓ A teenager's name tag fills a third of the screen up close.
6. ✓ The bay prompt is 11 words.
7. ✓ Cents in money over $100 (report, toasts, HUD).
8. The Club still has 1–2 shifts of saving the fee at 4P.
9. **Design:** the deck fine is cash-neutral for a reckless cook (4–5 falls a shift, still +profit).
10. Solo reaches the Stadium as fast as 4P (stamps gate both).

**Checks:** linked gutters keep the gallery alive (dedicated shooter 32–90 TARGETs a shift with gutters,
Last-Call-only 3–30, solo 0–11). The marker disc reads at 55 m and 143 m; the beam is invisible at 143 m.
First TARGET < 1 min in the browser (goal < 2 min). Deck: careful cook 0 falls, tab ~9% of a working
crew's income (the 17–34% was idle-crew income) — no imbalance. One centre item in every sampled frame.
Last Call deals 3 different jobs at 4P.

**Pace:** Club day 1 → Stadium 53–60 min (4P and solo); nobody shooting: 120 min.

**Ideas for council 8**
1. Make Tiered able to fail: a linked flush drains only cups ≥ the shooter's cup, or Last Call's cup
   fill ×2 (S).
2. TARGET first with the cash folded in ("TARGET! Every cup drained · +$3,293"); "Saved by a TARGET at
   0:02" in the report (XS).
3. Deal Gary's lines with no duplicates; extra Rats get nothing or "Keep picking" (S).
4. A fall really costs: resets Hustle to ×1, fails Gary's kitchen stop for the day (S).
5. Round money over $100 everywhere (XS).
- **Cut:** the marker's beam (invisible; the disc does all the work).

## Playtester C — Stadium → County → Orbital → the ending → endless

**Scores:** Fun 6.5 · Clarity 6.5 · Text load 7 · Pacing 6 · Co-op 6.5 · Meaningful 6 · Look & feel 7.5 ·
Polish 6.5 · One more shift 5.5 · **Overall 6.5**. "The late game finally has jobs. Stadium day 1 and the
endless curve hold it back."

**Best:** the solo sky clear: two rides, the gold banner ticking down, the auto ride-down as Ball No. 1
falls, then the statue by the stand in endless.
**Flattest:** the 4P no-tether finale: the bell rings 3 pieces short, a filler report, 20 s of EVA next
morning.

**Findings (✓ = fixed after this round):**
1. ✓ Stadium day 1 is always DENIED (the Two-Minute Warning needed venueDay ≥ 2); every crew spends 4
   shifts there.
2. ✓ The T-30 re-check reads the graded mean, so it says "bored" to Rats already lapping at 100% live.
3. ✓ The 4P sky gate opens with < 50 s left; the bell rings mid-clear and the finale slides to a morning.
4. **Design:** endless tiers 1 and 2 are affordable on the ending's report; the statue after 2–5 shifts.
5. **Design:** the endless record freezes after the first shift.
6. ✓ "E Ride the Lift" shows while Ball No. 1 is down or carried.
7. ✓ The Board BV scrambles in endless (BV ~$19k moves every 1–2 s).
8. ✓ The huddle banner wraps "1 / 1"; ✓ cents on the HUD; the report's graded vs live crowd unlabelled.
9. ✓ The Orbital memo doesn't mention the sky; ✓ "Grab debris (25/25)" when the bag is full.
10. ✓ The Owner's projects row sits mid-list in the endless shop.

**§4 numbers:** Stadium graded mean day 1 0.17–0.37 (fail), days 2–4 0.56–0.73; second cart +7% income,
pays back in ~4.5 shifts (nice, not needed). County: do-nothing 0.00, two dealt walkers 0.80–1.00 (9/9),
one walker ~half fail, drones 0.93–1.00. Orbital: 4P sky 44–49 s with 60 debris; solo 66 s; tether 0 s;
no softlock; pumping never mattered. Huddle: AFK 23.0 s, carrier closes tab → dropped after 5 s.
One text: bells, finale and sky one centre element each.

**Pace:** 4P Last Bucket 141–152 min (no drones, one walker: 158–188). Stadium 4 shifts every time.

**Ideas for council 8**
1. Two-Minute Warning from Stadium day 1 (XS). ✓ done as a bug fix.
2. Hold the clock in 'sky' at the bell (S). ✓ done as a bug fix (capped).
3. A live Stadium re-check line, "Keep lapping!"; label the report's two crowd numbers (XS).
4. Endless: price tiers against the ending payout (tier 1 a shift after, statue 6–8 shifts); a weekly
   record or "best this week" so the chase never freezes (S).
5. Make the pump matter in the sky: shorter EVA air, or debris drifting out of reach unless a buddy
   cranks (S).
- **Cut:** the pumper role at the sky gate as tuned, or the Crew colours tier.

## Playtester A — a new crew to the Range Club

**Scores:** Fun 6 · Clarity 6.5 · Text load 7 · Pacing 6 · Co-op 6.5 · Meaningful 6 · Look & feel 7 ·
Polish 6 · One more shift 6.5 · **Overall 6.5**. "The plumbing fix landed; the remaining issues are rules
tuning." **0 frames with two centre messages** across days 1–5 and the Club morning.

**Best:** the day-2 Last Call deal: mats for me, the sign for Cy, the stand for Di, three ways with no talking.
**Flattest:** day 4: we followed Gary's lines, they vanished, "Gary found 3 problems."

**Findings:**
1. A Gary line clears at the pass threshold (0.34), the stop scuffs back and fails: following the lines
   literally passed Gary 0 of 12; hosing to < 0.1 passed 16 of 16.
2. With a cart, the GARY 3·2·1 lasts 11–67 s (the cart leg comes after the mats).
3. "On target" then DENIED: no Upkeep margin for Last Call's ×1.5 scuff (4P 6 of 31, solo 2 of 31).
4. The 30 s re-check reshuffles everyone's job by position (sign ↔ stand).
5. "Record shift! (was $0)" on day 3, next to QUOTA MISSED.
6. The report's bottom bar still covers the shop's rows; "PROMOTED" toast over the Next button.
7. The dark Club roof fills the top third at the Club spawn.
8. Gary's arrival: one centre message but five texts on screen.
9. The fee shortfall is said twice (headline and panel); the headline sits over the Board's dots.
10. Long lines: the gold-ball debut memo (13 words), "Caked in mud (×1.00)", the day-5 tomorrow line
    when stamps and fee are in hand.
11. The day-3 mats line is easy to miss (fine).
12. Solo Gary is near-impossible (0 of 18): one line names one of three failing stops.

**Checks:** dealt Last Call: 3 different lines in 16 of 32 bells (the rest "On target" for all); Rats in
3–4 places 10 s later in 31 of 32. Gary deals 3 different stops 15 of 16. Following the dealt rally lines
won 24 of 24 stamps (4P), 31 of 33 solo. Gary never ran over the ring (0 of 64). Fee headline shows.

**Pace:** 4P 4 shifts (24 min) with one hoser all day, 5 (31 min) dealt-only; solo 5–6 (31–38 min);
idle never promotes.

**Ideas for council 8**
1. Gary lines stay up until "Spotless", re-dealt if a stop fails again during the warning (S).
2. A 5 s countdown from the last stop before the stand (XS).
3. An Upkeep margin on "On target" (XS).
4. Keep each Rat's job at the 30 s re-check; re-deal only what changed (XS).
5. One reason to hose mid-shift at 4P (a refused customer costs real Upkeep or cash) (S).
- **Cut:** the Record line on review days (endless only).
