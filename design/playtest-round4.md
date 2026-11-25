# Playthrough 4 (2026-11-24, build ff770cf) — the final scored round

## Playtester C — Stadium → County → Orbital → the ending → endless

**Scores:** Fun 7 · Clarity 7 · Text load 7 · Pacing 7.5 · Co-op 7 · Meaningful 6 · Look & feel 7.5 ·
Polish 6.5 · One more shift 6 · **Overall 7**.

**Verdict:** essentially done for a casual crew of 4. The ladder is on pace (4P 141–142 min, solo
150–151), the Stadium is 3 shifts, the sky gate is a fast all-hands beat (4 riders 41–59 s) with no
softlock, and the finale flows into ownership. What holds it back: the late game's two "reasons to
care" — Gary (no stake past the commendation cap) and beating yesterday (decided by noise for a steady
crew). The one change: give each endless shift and late Gary visit a stake the crew can clearly win.

**Best:** the view from the top of the Lift, the last pieces, the auto ride-down, Ball No. 1 falling.
**Flattest:** "Short of yesterday by $74K" after an identical shift.

**Findings:**
1. Bug: a full pocket blocks picking up Ball No. 1 client-side (main.js `act()` checks pocket-full
   first); sky riders land with a full bag and must walk ~120 m to bank first.
2. Gary from the Stadium on has no stake (commendations capped by ~Club day 3).
3. "Beat yesterday" is a coin flip for a steady crew (margins 0.1–5%).
4. Owner tiers: solo buys the Hustle on the ending's report; an active 4P crew gets the statue in 4.
5. A missed-sky report reads as filler ("Tomorrow: more balls").
6. The finale ($∞ + PA card) and the first endless morning (memo + PA card) stack two centre texts.
7. The Lift shaft cuts across the walk-off camera at the Orbital.
8. "You have Ball No. 1. Walk it home." lingers under the huddle banner; teenager tags stack at the
   stand; "23 left out there" clipped under the endless headline.

**Ideas:** Ball No. 1 ignores a full pocket (S); Gary pays cash past the cap (S); a 2% tie band on
"beat yesterday" plus a named reason (S); "Tomorrow: clear the sky." after a held bell (XS); owner prices
(solo Hustle ×1.5, statue $400M base) (XS). Cut: Gary from the Stadium on unless he gets a stake.

## Playtester B — the Club and Tiered

**Scores:** Fun 7 · Clarity 7 · Text load 7 · Pacing 7 · Co-op 6.5 · Meaningful 7 · Look & feel 7.5 ·
Polish 6.5 · One more shift 7 · **Overall 7**.

**Verdict:** close to done. Tiered now has the tension it lacked (idle fails, stopping early sometimes
fails, shooting to the bell passes, the reason always named); the deck fine bites; stations, tips, spray
and the walk-off make the place physical. What holds Fun at ~7 is the Club: 4–5 shifts of "On target"
bells while saving the fee. The one change: a Club Last Call rush with its own job (e.g. gold balls mud
the mats double, so someone hoses at dusk).

**Best:** solo Last Call at dusk, "Glow rush! Shoot late!", cup C 12 → 20, DENIED stamped over 300
glowing balls with "Missed: the glow rush filled the bowls."
**Flattest:** every Club Last Call: "On target. Hold it till the bell." to all four, four days running.

**Glow Rush (real rule, 10 seeds):** one TARGET at T−50 passes 2/10 (4P), T−30 8/10, T−15 10/10; nobody
shooting 0/10. Escalating fine: reckless cook loses 27–53% of income (round 3: ~10%), still never negative.

**Findings:** pre-Last-Call shooting is irrelevant at Tiered; the Club's Last Call never deals a job; the
BV figure shows red under QUOTA MISSED when the gauge was the miss; the entrance arch says MUNI RANGE at
every venue; "300 left out there" draws over the report card; a 0.95 mat looks half-muddy and the mist
hides the patch washing; solo can pass Tiered without shooting on ~1/3 of bells.

**Ideas:** pre-Last-Call shooting matters (slow drain or a TARGET floor) (S); a Club Last Call job (S);
Club fee ~$80k at 4P (XS); a live "SAVED!" toast (XS); mud severity reads (S).

## Playtester A — a new crew to the Range Club

**Scores:** Fun 6.5 · Clarity 6.5 · Text load 6.5 · Pacing 6.5 · Co-op 7 · Meaningful 6.5 · Look & feel 7.5 ·
Polish 6.5 · One more shift 6.5 · **Overall 6.5**.

**Verdict:** essentially done: 4–5 shifts, every quota stamped (64/64 at 4P), Gary passes 88% when someone
pings his cart and never with a duplicated stop; the new stations, mud and end-of-day beat feel physical
and earned. What holds Fun at ~6.5 is Gary's instructions: a "Stall Gary" line during the warning when
stalling is impossible, lines flipping between stall and meet, stop lines vanishing at his first stop.
The one change: make every Gary line true for the whole visit.

**Best:** the bell lifting into the overhead, a field of glowing balls, "95 left out there", a tap to the card.
**Flattest:** solo Gary: the mats line vanished at his first stop, "stall him", "Gary found 3 problems."

**Findings:** stall dealt during the warning (pings ignored while parked); stop lines cleared at Gary's
first stop while still failing; stall/meet lines flip 5–32 times a visit; no tips on a carried-over day 2
(the hinter gates on `!crew.todo`); a morning tip stream (two tips over 8 words) and the bought item's tip
41 s late; "Stay out of his way" vs "Stall Gary"; solo Gary ~0–12%; two purchase toasts; "Gary in 45 s"
shown at 39 s; the wand prompt 14 words; "Unwashed −$200" reads as a loss.

**Checks:** stations hidden until bought; each tip once; mud washes off in patches (0.95 → 0 in ~6 s);
the jet leaves the nozzle; end-of-day card at 7.1 s, a skip in 50 ms, the morning restores everything,
the "left out there" count matches exactly.
