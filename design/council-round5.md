# Fun Council, round 5: the final readiness audit

This is the record of Range Rat's fifth Fun Council (November 2026). Rounds 1–4 still bind wherever this record
doesn't change them. Where they disagree, this record wins.

**The owner's goal (binding):** *"Essentially done."* That means a fully working, pretty automation game that's
fun and not too hard, where every feature is worth it and means something. The owner's firm calls from round 4
are unchanged.

**The council.**

| Seat | Lens |
| --- | --- |
| **Game Designer** (G, chair) | Moment-to-moment fun; does each venue play differently? |
| **Systems/Economy Designer** (E) | Prices, quotas, fees, income per shift, pacing |
| **Multiplayer/Co-op Designer** (M) | Join, leave, rejoin, six players, solo |
| **Level Designer** (L) | Readable spaces, one map rule per venue |
| **Technical Director** (T) | Server-authoritative, zero deps, core vs new files, Xbox frame time |
| **Casual Crew of 4** (C) | Four friends on a sofa, some on Xbox pads in Edge |
| **QA Lead** (Q, new) | Reads the code for bugs, dead ends and softlocks; nothing counts until it's reproduced |

Ties go to the chair.

**What the council read and ran:**
- Round 4 §1 and §5, `game-design.md` (every round-4 section), and the README.
- The code: `crew.mjs`; `server/venues/*.mjs`; `sim.js`, `map.js`, `dive.js`, `deck.js`, `tiered.js`,
  `stadium.js`, `county.js`, `orbit.js`, `customers.js`, `mowe.js` and `menu.js`; `main.js`, `round2.js`,
  `views/*.js`, `board.js`, `settings.js` and `perf.js`.
- `node --test test/`: **513 of 513 pass**.
- Two scratch scripts that run the real `Crew` and edit no game code:
  - **The ladder sim**, a scripted crew playing lobby → Last Bucket. Customers, quotas, Gary, MOW-E, helpers,
    drones, gutters, the tether, the deck and the washer are all the real code. The Rats themselves are scripted.
  - **The repros** for §2.1.

**State at the start of the round:** every item on round 4's build list is built (commits `3d6f5d8` → `ef643b5`).

---

## 1. The 1.0 checklist: verdict per item

✅ done · ◐ done with a defect or unverified · ☐ not done. "R4" is round 4's score.

### A. The ladder is real

| Item | R4 | Now | Evidence |
| --- | --- | --- | --- |
| Promotion, franchise, reveal, write-offs, titles | ✅ | ✅ | `promote()`, `VENUE_RULES`, `revealCards` (the second memo card is `howto`) |
| The Last Bucket, end card, endless | ✅ | **◐** | Built, but it has **two reproduced softlocks** (§2.1, Q1 and Q2) |
| Each venue has its full seven | ◐ | ✅ | Tiered: bowls, Bay Utilization, cups, Target Practice, deck, gutters. Stadium: Track, Sentiment, laps, second cart. County: Yards, slice, Zoning, drones. Orbital: Lift, orbit shots, EVA, tether. Each is a module behind `server/venues/index.mjs` |
| Endless has a target | ☐ | **◐** | `snapshot().pace` and the Board's RECORD PACE work, but the record to beat includes Ball No. 1's payout, so the line can't be beaten (§2.1, Q3) |

### B. Every feature earns its place

| Item | R4 | Now | Evidence |
| --- | --- | --- | --- |
| Round 3's cuts done, no dead paths | ◐ | ✅ | The wand's `'self'` target is wired (`crew.mjs:549`). One stale comment is left (`crew.mjs:801`, "overserving, later") |
| Every station names its verb and payoff | ◐ | ✅ | The wand prompt names all six targets (`main.js` `hud()`); the Lift, cups and kitchen mugs have prompts |
| Every shop row changes something visible in one shift | ✅ | ✅ | True. But from Tiered on, every row costs 0.1–0.2 of a shift and gets bought on arrival (§3) |
| Nothing the player is told about is impossible | ◐ | ✅ | Gary checks active mats only (`crew.mjs:1099`) |

### C. The map

| Item | R4 | Now | Evidence |
| --- | --- | --- | --- |
| The Muni field is Dimple Creek | ✅ | ✅ | |
| Each venue adds exactly one map rule | ◐ | ✅ | `MAP.BOWLS`, `TRACK`, `YARDS` plus `KERB_X`, `LIFT`. Each is venue-gated, and `seam.test.mjs` pins venues 0–1 as unchanged |
| Every landmark is a callout | ◐ | ✅ | MOW-E's lanes are named; Bowl A–C, the Track, the Turn, Yard 1–4, the Gnome and the Lift are in `LANDMARKS` |

### D. The first hour

| Item | R4 | Now | Evidence |
| --- | --- | --- | --- |
| Day 1 ≤ 4 min, teaches pick, bank, Board, shop, wand | ✅ | ✅ | |
| Days 1–8 each add 1–2 things | ◐ | ◐ | `?pace` exists (`pace.js`), but no real night has been logged |
| The Club at minutes 30–42 (4P) and 35–45 (solo) | ☐ | **◐** | Sim: **4P at 42–50 min, on target. Solo at 50–65 min, late** (§3). Modelled, not measured |

### E. Multiplayer

| Item | R4 | Now | Evidence |
| --- | --- | --- | --- |
| 4 jobs from day 3; ≥ 3 regroups a shift | ✅ | ✅ | |
| Solo automates every chore by its venue's day 3 | ◐ | ✅ | Self-rinse, gutters, drones and the tether. Solo hits every quota from the Club on in the sim |
| Late join, reconnect, 6 players, resume after deploy | ◐ | ✅ | Mid-shift join toast (`main.js:986`), `?c=` link, lobby roster. The edge cases are in §2.2 |
| Customers come and go, refuse filthy mats | ◐ | ✅ | Morning mud is 0.95, so the `wait` state fires at the opening |

### F. Controller and TV

| Item | R4 | Now | Evidence |
| --- | --- | --- | --- |
| Every verb works on the pad | ◐ | **◐** | The dock and washer cranks latch. **The Lift's O₂ crank doesn't latch, and circling the right stick also spins the camera** (§2.3) |
| Settings | ✅ | ✅ | Text size, reduce motion and Graphics were added |
| First-time hints | ✅ | ◐ | All eight are built, in their own chip. **The deck hint shows twice** (§2.4) |
| HUD on one line; toasts prioritised | ✅ | ✅ | |
| Text big enough on a TV | ☐ | ✅ | Text size 100/125/150% |

### G. Feel and performance

| Item | R4 | Now | Evidence |
| --- | --- | --- | --- |
| Diving looks like a highlight | ✅ | ✅ | |
| Diving (and the EVA) plays like one | ◐ | ◐ | Built and tested; never played by four people |
| Xbox ≤ 20 ms a frame, measured | ☐ | **☐** | `perf.js`, the levers and the fixtures are built. **The README's numbers table still reads `_todo_`** |
| Audio mix pass | ◐ | ✅ | Ducking, the low-pass, and the crowd following Sentiment. Unverified on TV speakers |

### H. Quality

| Item | R4 | Now | Evidence |
| --- | --- | --- | --- |
| Tests for every rule | ✅ | ✅ | 513 tests; every venue module has a suite |
| Save v3; v2 migrates | ✅ | ✅ | Plus `save.mods`, with orphan keys carried through |
| `make preflight` green; no console errors in 60 min | ☐ | **☐** | Not run this round (preflight runs in WSL). Unverified |
| `game-design.md` and README current | ◐ | ◐ | `game-design.md` is current. **The README's "Status" section is still stale:** "Next: the potato line, more ball types, the first promotion", and the shop "open before the first shift and overnight" |

**The score: 22 ✅, 8 ◐, 2 ☐ (32 rows).** The ☐s are measurements, not code. The ◐s that matter are the three
Last Bucket and endless bugs (§2.1) and the Lift crank on the pad.

---

## 2. QA: bugs, softlocks, dead ends

Severity: **P0** blocks the ending or locks the crew · **P1** is wrong in normal play · **P2** is an edge case or
cosmetic. "Repro" means a scratch script ran it against the real `Crew`.

### 2.1 The ending (P0 and P1, all reproduced)

**Q1 · P0 · Ball No. 1 is deleted if the Last Bucket starts at the bell.** Repro output: *"next morning: phase
shift, Ball No. 1 still exists: false, paused() true … 60 s later the shift clock moved 0.0 s."*

- **What happens:** at the Orbital, `countDown()` (`crew.mjs:264`) starts the Last Bucket on whatever bank
  reaches 1. At the bell, `endShift()` banks the helpers, the tube, the line, the cart hoppers, the drones
  (`county.mjs` `endShift`) and the EVA bags (`orbit.mjs` `land(…, atBell)`). So the countdown often crosses 1
  **during the report**. Then:
  1. `stepLastBucket` spawns Ball No. 1 while the report card is up. The client can't pick it up: the report is a
     menu, so `playing()` is false.
  2. Ready Up runs `startShift()`, whose night-crew sweep (`crew.mjs:728`, `if (!b.sunk)`) deletes Ball No. 1.
  3. `lastBucket` stays `{phase: 'down', id: <deleted>}` and `paused()` is true for ever. The clock never runs,
     no customers come, and there's nothing to bank.
- **Recovery:** only when everyone leaves for 10 minutes (`UNLOAD_MS`), the crew reloads, and `lastBucket` isn't
  saved.
- **Likelihood:** the bell bank is often 100–700 of a 4P crew's ~1,100 balls a shift, so roughly a 10–40% chance
  per crew. In the sim the crossing landed mid-shift (day 20, 338 s in) only because the sim banks instantly; real
  carts and drones hold their balls until they unload.
- **Fix (S, `crew.mjs`):**
  1. In `startShift`, keep `kind === 'one'` balls in the sweep.
  2. Make `stepLastBucket` self-healing. If `lastBucket.phase` is `'down'` and neither `balls.get(lb.id)` exists nor
     any Rat has `p.one`, go back to `{phase: 'falling', t: 3}`. That also covers Q6 and any future lost-ball path.
  3. Optionally, defer the start: if `phase !== 'shift'`, set `lastBucketDue` and begin it after the next
     morning's reveal.
  - **Test:** bank the last balls in `endShift`, Ready Up, and assert Ball No. 1 exists and the shift can end.

**Q2 · P0 · A Rat on the EVA when the Last Bucket starts is stuck in orbit, and nobody can bank Ball No. 1.**
Repro output: *"B tries to walk to the stand: at -44.0 5.0 … rider {ph: 'down', t: 0} … A deposits Ball No. 1:
false."*

- **What happens:**
  1. `paused()` is true for the whole Last Bucket. `orbit.mjs` `tick` does `if (crew.paused()) continue;`, so a
     rider's ride (up, out or down) never advances.
  2. The `clamp` hook pins them to the car or the disc at (−44, 5).
  3. `depositOne` (`crew.mjs:1131`) needs **every online Rat** within 8 m of the stand.
- **Recovery:** the astronaut closes their tab for 60 s (`GRACE_MS`). The EVA is the Orbital's chore, so someone
  being up there at the moment is likely.
- **Fix (XS, `orbit.mjs`):** change the guard to `if (crew.paused() && !crew.lastBucket) continue;`. When
  `crew.lastBucket` first appears, set every rider who isn't already riding down to `'down'` (keep the bag; it
  banks on landing). That brings them home in 5 s.
- **Test:** a rider who is `'out'` when the bucket begins lands within 6 s, and `depositOne` succeeds.

**Q3 · P1 · The endless RECORD PACE can't be beaten.** Repro output: *"record cash 11183771.26 = 1958 x BV?
11176636."*

- **What happens:** `depositOne` adds `ONE_YEAR × BV` to `stats.cash`, then `endShift(true)` sets
  `records.cash = stats.cash` (`crew.mjs:1335`). The day of the Last Bucket becomes the record, and its target is
  1,958 × BV above a normal shift: about **2–3 shifts' income at 4P and 5–6 solo**.
- **The result:** the round-4 endless target (item 12) is dead on arrival.
- **Fix (XS):** keep the payout out of the record. Either skip the record check when `ending`, or compare
  `stats.cash − pay`. Add a test.

**Q4 · P1 · The franchise signature can be wiped by Ready Up.**

- **What happens:** Ready Up starts the next shift 20 s after the *first* Rat clocks in (`crew.mjs:1274`), and
  `startShift` clears `signed`.
- **On night one:** one person mashes Ⓐ on "Clock in" and the other three have 20 s to find and press "Sign".
  The promotion slips a whole shift. No stamps are lost, but it reads as a bug ("we had the money!").
- **Fix (XS, `crew.mjs` `readyUp`/`tick`):** while `promoInfo().ready` and not every online Rat has signed, hold
  the 20 s timer. Show "Waiting for signatures (2 of 4)" in `round2.js`. Alternative: "Clock in" also signs.

**Q5 · P2 · A cart or Gary can knock a floating astronaut down.**

- **What happens:** the run-over checks (`crew.mjs:503`, `crew.mjs:1032`) use the rider's ground `x, z` inside
  the 11 m disc round (−44, 5). A cart driving within 1.3 m of that spot "runs over" a Rat who is 120 m up. That
  triggers `reel()`, and the bag goes back into orbit.
- **Fix (XS):** skip anyone `crew.mods.state('orbit')?.riders.has(o.id)`, or give the seam a `knockable` veto.

**Q6 · P2 · Ball No. 1 dropped in the pond can't be picked up.**

- **What happens:**
  1. A carrier can walk into the pond without diving (`stepPond`: `wet = … && !p.one`).
  2. If they're knocked flat there, or time out (`removePlayer`), Ball No. 1 drops at rest in the pond.
  3. Anyone who walks in to fetch it is `diving`, and `pickup` refuses divers (`crew.mjs:348`). The client's
     `nearestBall` also hides non-sunk balls from divers.
- **Fix:** Q1's self-heal doesn't cover this, because the ball still exists. Have `knockDown` and `removePlayer`
  drop Ball No. 1 at the dock when `inPond(spot)` (XS).

**Q7 · P2 · `removePlayer` loses a carried treasure** (`crew.mjs:1297`). The treasure is neither re-sunk nor
banked. **Fix:** call `this.dropTreasure(p, true)` first (XS).

### 2.2 Multiplayer edge cases (audited, mostly fine)

| Case | Verdict |
| --- | --- |
| Join mid-shift | ✅ Placed by the stand, gets the New Hire Kit, the toast says what to do |
| Join during the Last Bucket | ✅ They spawn within 8 m of the stand, so the huddle still completes |
| Join during the franchise signing | ✅ They must sign too. The fee re-scales with the online count, which is correct |
| Leave while driving | ✅ The cart is freed after 5 s (`DRIVER_GRACE_MS`) |
| Leave while diving | ✅ Air drains, they gasp and pop up on the dock, the bag spills back into the pond |
| Leave on the Lift | ✅ `reel()`, ride down, land. ✗ during the Last Bucket (Q2) |
| Leave carrying Ball No. 1 | ◐ It drops after 60 s, but `lastBucket.phase` stays `'carried'` with a dead `by`. Harmless once Q1's self-heal lands; still drops in the pond (Q6) |
| Host leaves | ✅ There is no host: the server owns the crew, and any Rat can open the range or clock in |
| Reconnect within 60 s | ✅ Same seat. After 60 s you rejoin by name, gear and dive gear come back, the pocket is spilled |
| Server restart mid-shift | ◐ `toSave` keeps that day's cash and replays the day, but `venueDay` is incremented again at the replayed `startShift`, so the quota and MOW-E schedule skip a step (P2) |
| Fee dodge | P2, won't-fix: fees and crew rows price by `onlineCount()` at the moment of purchase or signing, so three Rats closing their tabs makes everything 55% cheaper. A casual crew never finds it |

### 2.3 Controller gaps

1. **The Lift O₂ crank (P1).**
   - `views/orbit.js` `_crank` reads the right stick for turns. `main.js` `pollPad` also applies the right stick
     to the look, because `r2.capturing()` is false at the Lift.
   - So a pad buddy's camera spins while they crank, and there's no latch: a tap of Ⓐ gives a 1.2 s *held
     trickle* (+0.5 s of air a second, less than the drain).
   - The README says the Lift latches like the dock. **Fix (S):** reuse `round2.js`'s latch for the Lift. A tap
     of Ⓐ at the platform latches, either stick cranks, look and walk freeze, and Ⓐ or Ⓑ lets go. That takes a
     view hook (`capturing()` while latched) plus a branch in `round2.js` `press`.
2. Everything else is mapped: grab and ride down (Ⓐ and Ⓧ), the kitchen (`stepPad`), the swing, CCTV, the shop,
   pause and the end card.

### 2.4 Small defects (XS each)

- `views/orbit.js:167` reads `r?.stats?.debris`, but the report is flat (`{...this.stats}`), so
  **"Debris retrieved" never shows**. Use `r?.debris`.
- The deck hint fires twice: `views/deck.js:101` toasts it (key `rr.hint.deck`) and the hinter's `deck` hint
  shows it in the chip. Delete the view's copy.
- Gary's `check` float shows "✓ kitchen" in lower case: the `names` map at `main.js:573` has no `kitchen`.
- The Stadium report line ("The crowd: x% ♥") still prints at the County and the Orbital, where the crowd isn't
  graded. Gate it on `venue === 3`.
- `crew.mjs:801`'s comment "(overserving, later)" is stale.
- Floating Rats are drawn walking on the grass round the Lift for everyone else (known limit in `game-design.md`).
  That's cosmetic, but it's the first thing a second player sees. **S:** a view hook for a mate's y.

### 2.5 Unreachable or dead content

Nothing is unreachable. Every shop row has a venue it opens at, every PA id exists in `pa.js` (`deck`, `fleet`,
`drones`, `eva`), and every hint has a condition that can fire. **But from the Club on, money is nearly dead
content.** See §3.

---

## 3. Economy sim: results and tuning

**The method** (`ladder.mjs`, a scratch script):
- A real `Crew`, ticked at 0.1 s, with seed 7.
- Rats bank resting balls at a gear rate: 0.12, 0.25, 0.5 and 0.9 balls a second on foot; 3 and 4.5 for the cart
  driver.
- They share their time out across chores: the wand (dirtiest fixture first), the cook (beer, beer, hot dog from
  Tiered, a hot dog when the mugs reach 4), diving, cup runs, Yards walks, laps and EVA trips.
- They buy from a sensible priority list as soon as they can afford it, then sign and clock in.
- "Skill 0.5" halves every pick rate.

| Run | Club | Tiered | Stadium | County | Orbital | **Last Bucket** | Shifts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4P, skill 1 | 42 min | 65 | 88 | 111 | 134 | **149 min** | 20 |
| 4P, skill 0.5 | 50 | 73 | 96 | 119 | 142 | **156 min** | 21 |
| Solo, skill 1 | 50 | 73 | 96 | 119 | 142 | **165 min** | 22 |
| Solo, skill 0.5 | 65 | 88 | 111 | 134 | 157 | **182 min** | 25 |

Median income per shift (4P, skill 1) against the fee to the next venue at 4P:

| Venue | Rate | BV at the bell | Banked/shift | Income/shift | Next fee (4P) | Fee ÷ income | Round 4's estimate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Muni (days 4–6) | ×1 | $6–8 | ~1,000 | $6–7k | $5,500 | 0.9 | — |
| Club | ×5 | $52–56 | ~1,100 | $90k | $88k | **1.0** | 3.5 |
| Tiered | ×25 | $280–300 | ~1,100 | $560k | $440k | **0.8** | 3.0 |
| Stadium | ×100 | $1,050 | ~1,100 | $2.0M | $2.2M | **1.1** | 3.7 |
| County | ×500 | $5,600 | ~1,100 | $10.8M | $11M | **1.0** | 3.7 |
| Orbital | ×2,500 | $28–29k | ~1,100 | $57–98M | — | — | — |

Solo: $32k, $265k, $960k, $6.3M and $34M a shift, against base fees of $40k, $200k, $1M and $5M (0.8–1.25
shifts each).

### What the numbers say

1. **The Muni and the Club are on target.**
   - 4P reaches the Club at minutes 42–50 (target 34–42; the slow end is fine).
   - At the Muni the $5,500 fee is the real gate, as designed.
2. **From the Club on, the fee never gates.**
   - Every venue takes exactly **3 shifts**, the three review stamps, in every run, at both skill levels.
   - At each promotion the crew holds 2–4× the fee.
   - Income is supply-limited, not labour-limited. At 4P the cart, four helpers and the drones clear what about
     1,100 customer shots leave, so halving the pick rate costs one shift in total.
   - Round 4's table guessed 760 banked and BV ×1.0. The code pays ×1.5 for 10 commendations and ×1.25 for a clean
     Rat's gear, and banks about 1,100 balls.
3. **The late shop is decoration.**
   - Each automation row (gutters $110k, second cart $330k, drones $1.32M and $3.3M, tether $6.6M at 4P) costs
     **0.1–0.25 of a shift**, against round 4's rule of 0.5–1. All of them were bought within minutes of arriving.
   - From the Stadium on the crew ends with $38M, $86M, then **$184M unspent**.
   - The tether gets bought on day 1 at the Orbital, which lasts only **2 shifts at 4P** (1,958 balls at ~1,100 a
     shift).
4. **Solo is as fast as 4P.** Solo fees are ×1 and solo income is about 0.6 of 4P's, so solo is relatively richer,
   and stamps gate both. The 1.0 definition wanted 4P in "about three 60-minute sessions" and solo in "about
   four". The sim gives 4P **2.5 sessions** and solo **2.75–3**.
5. **The quota is never missed after the Club**, even with the Stadium crowd at 0.67 at the bell. That's fine for
   "not too hard"; it's the stamps, not the quota, that set the pace.
6. **No incidents in the sim.** A cook who follows the mugs never tips the deck. Good: the joke is avoidable, and
   only spam is punished.

### Tuning recommendation (E proposes; adopted 5–2, T and C against)

**The late-ladder price pass: ×3 on fees and automation from Tiered on.** The Muni and the Club are untouched (they
measure on target).

| Thing | Now (base) | Proposed (base) | At 4P | Shifts of 4P income |
| --- | --- | --- | --- | --- |
| Fee to the Stadium | $200k | **$600k** | $1.32M | 2.4 of Tiered's |
| Fee to the County | $1M | **$3M** | $6.6M | 3.3 of the Stadium's |
| Fee to the Orbital | $5M | **$15M** | $33M | 3.0 of the County's |
| Gutters | $50k | **$150k** | $330k | 0.6 |
| Second cart (cart tier 3) | $150k | **$450k** | $990k | 0.5 |
| Drones, 2 / 4 | $600k / $1.5M | **$1.8M / $4.5M** | $4M / $9.9M | 0.4 / 0.9 |
| Tether winch | $3M | **$9M** | $19.8M | 0.35 of the Orbital's |
| Dive scooter (personal) | $40k | **$120k** | $120k | 0.2 |
| Fee to Tiered | $40k | **$100k** | $220k | 2.4 of the Club's |

**The expected effect:**
- Fee and stamps bind at about the same time (3 shifts), so buying automation now costs about one shift of the
  climb. That's a real decision, which is what makes a shop row "meaningful".
- Estimated 4P Last Bucket: about 160–170 min (closer to 180). Solo: about 175–200 min. Weaker crews take 3–4
  shifts a venue, which is still "not too hard", because quotas stay easy.
- **The Technical Director's dissent:** tests pin some prices, so this is "data-only" plus test updates.
- **The Casual seat's dissent:** "the money going up is the fun". The answer is that the numbers still go up ×4–5
  per venue; they just matter again.
- **The owner decides.** If declined, nothing breaks; the late shop just stays a formality.

**Not recommended:** changing `PROMO_STAMPS` or the quota curve. Three shifts a venue is about 24 minutes, which
is enough to see each venue's toy and chore. Solo pacing past the Muni is left alone. Instead, measure the solo
Muni (sim: 50–65 min against a 35–45 target) with `?pace` before touching it. The sim's solo wand share is a
guess.

---

## 4. Fun: what isn't pulling its weight

| Feature | Verdict | Why |
| --- | --- | --- |
| The Upper Deck and overserving | **Keep** | The signature joke; avoidable by reading the mugs; the fine stings without blocking |
| Target Practice and the cups | **Keep** | Solo's first Hustle source; "Bowl B's full" is a callout |
| Gutters | **Tweak** (§3 price) | At $110k it's an auto-buy, so the cup chore lasts only half a shift |
| The Ping Track and Crowd Sentiment | **Keep**; **tweak** the report line (§2.4) | Laps keep the crowd up solo; the second cart has a reason |
| Crowd Sentiment after the Stadium | **Tweak** | It ticks on and prints a report line where it no longer counts. Show it at venue 3 only |
| The Yards and the slice | **Keep** | The only on-foot chore in the late game; drones automate it |
| Drones | **Keep**, **tweak** the price | Auto-bought today, so the Yards chore never happens at 4P |
| The EVA | **Keep** | The fancy the owner asked for; fix Q2 and the pad crank, and it's the best minute in the game |
| The tether winch | **Tweak** (price) or accept as the "I'm done" button | At the Orbital, cash has no use: there's no fee, and the tether is the last row |
| The Orbital's economy | **Accept for 1.0** | A 2–3 shift victory lap whose real goal is a ball count (1,958). Cash and Orbital Debris only feed BV, which feeds nothing. Post-1.0 idea: each debris retrieved counts as 10 balls toward Balls Outstanding, so the EVA races the countdown |
| Endless | **Keep**, fix Q3 | Without the fix its one target is unbeatable |
| Review stamps as the pacing metronome | **Keep** | Predictable and "not too hard"; the price pass makes cash co-gate |

---

## 5. The final punch list (ranked)

Sizes: **XS** < 1 hour · **S** an evening. **Core** means it edits `crew.mjs`, `main.js` or `sim.js` (merge
hotspots). **New-file/leaf** means it doesn't.

| # | Item | Size | Files | Kind |
| --- | --- | --- | --- | --- |
| 1 | **Ending fix pack:** Q1 (keep Ball No. 1 at the morning sweep; self-healing `stepLastBucket`), Q2 (riders ride down during the Last Bucket), Q3 (the record excludes Ball No. 1's payout), Q5 (riders can't be run over), Q6 (Ball No. 1 never drops in the pond), Q7 (re-sink a leaver's treasure). A test for each | **S** | `crew.mjs`, `server/venues/orbit.mjs`, `test/round2.test.mjs`, `test/orbit.test.mjs` | **core** |
| 2 | **The franchise hold** (Q4): Ready Up waits while the promotion is ready and unsigned; the report shows "Waiting for signatures (n of m)" | XS | `crew.mjs` (`readyUp`, `tick`), `round2.js` | **core** (do with 1) |
| 3 | **The Lift crank on the pad:** latch, freeze look while latched, either stick cranks, Ⓐ or Ⓑ lets go | S | `views/orbit.js`, `round2.js` (latch reuse) | leaf |
| 4 | **The XS pack:** the orbit report line (`r.debris`), the deck hint toast removed, Gary's `kitchen` label, the Stadium report line at venue 3 only, the stale comment | XS | `views/orbit.js`, `views/deck.js`, `views/stadium.js`, `main.js:573` (one line), `crew.mjs:801` (a comment) | leaf, plus 2 one-liners in core |
| 5 | **The late-ladder price pass** (§3), *if the owner approves* | S | `sim.js` (`VENUE_RULES` fees, cart tier 3), `tiered.js`, `county.js`, `orbit.js`, `dive.js`, the tests that pin prices | data in `sim.js` |
| 6 | **README:** rewrite the stale "Status" section to match round 4 | XS | `README.md` | new-file-like |
| 7 | **Measurements (owner, not code):** the Xbox perf table (Stadium fixture, 4 clients), `make preflight` green, a 60-min console-clean run, one real 4P night and one solo night with `?pace`, pasted into the next council | S (play time) | `README.md` numbers | — |
| 8 | *(Polish, optional for 1.0)* Floating Rats drawn at their ride height for mates (a view hook for a mate's y) | S | `main.js` (mate draw), `views/orbit.js` | core-light |

**Who runs in parallel:**
- **Agent A:** items 1, 2 and the two core one-liners of 4, serially. It owns `crew.mjs` and `server/venues/orbit.mjs`.
- **Agent B:** item 3 and the leaf part of 4. It owns `views/*.js` and `round2.js`, so it can run alongside A.
- **Agent C:** item 5, after the owner's yes. It owns `sim.js`'s data and the row files, alongside A and B. Rebase
  on A if `test/round2.test.mjs` collides.
- **Agent D:** item 6, at any time.
- **Item 7** is the owner's to do, after 1–5 merge.
- **Item 8:** after A, only if time allows.
- **The critical path:** A, then the owner's playtest (item 7). About two evenings of agent work plus one evening
  of play.

**Every agent's done line:** `node --test test/` and `make preflight` are green, the repro from §2.1 becomes a
test, and `game-design.md` is updated in the same commit.

---

## 6. Is it "essentially done"?

**Yes, after items 1–4 and 6 land (items 5 and 8 are the owner's call), with item 7 measured.** Every venue has
its map rule, KPI, chore, toy and automation. The seam is clean, 513 tests pass, and nothing on screen is a dead
end, except the ending's two softlocks, which is exactly where a crew that played for three hours can least
afford one. Fix those, and the game runs lobby → Last Bucket → endless for 4P in about 2.5 hours and for solo in
about 3, with no dev switches.

**Votes:** G yes · E yes (wants item 5) · M yes · L yes · T yes (after item 7's Xbox numbers) · C yes (after item
3) · Q yes (after item 1). **7–0, conditional on the punch list.**

**Explicitly post-1.0:**
- Split-screen on one Xbox.
- Touch controls (until verified on a phone).
- The heightfield, the Lookout Knoll and the Quarry.
- The yellow submarine.
- Intercepting drifting balls.
- The customer queue and QR codes in the lobby.
- Orbit debris counting toward Balls Outstanding (§4).
- The drone buzz that pitches up when loaded.
- Hosing a lounger (cut).
- The per-seat stadium wave.
- A money sink for endless (cosmetic hats, the Board's paint).
- Fixing the fee-dodge (§2.2).
