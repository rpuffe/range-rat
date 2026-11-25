# Round 11, builder "range": the owner's ball-return, bucket and hopper notes

## What I built

### 1. The Far return and its pneumatic tube
- **Row** `returns`, tier 1, is now **"The Far return"**:
  - **$3,000 base** (was $150) and Muni **day 4** (was day 3). The row also hides until day 4.
  - Blurb: "A second return across the creek. A shiny tube on stilts whooshes your balls home. THUNK."
- **Tier 2, the Back return**, is now **$12,000 base** (was $1,500). It stays at the Club.
  - Builder "feel" may add its Club-day-3 stagger (`minVenueDay`) to this tier.
- **Where they are** (`layout.js FIELD_RETURNS`):
  - The Far return is at **(44, −130)**: across the outflow creek, just past the Stones, 137 m from the bank.
  - The Back return stays at (−6, −128) by Blue. That's also across the creek, so the two are consistent.
  - Both clear the bowls, the pond, the creek (by more than HW + 5), the Track, every MOW-E lane and the Tractor.
- **The tube** (`layout.js TUBE_TRUNK / TUBE_BRANCH / tubeRoute`; drawn in `ballreturn.js createFieldReturns`):
  - It's a big clear tube (r 0.3 m) and shiny (Phong, shininess 140).
  - It has chrome bands every 2.6 m, with every third band a fat brass flange.
  - Galvanised posts stand under it every 9 m. No post stands in the creek.
  - **The trunk's route:**
    - It rises out of the Far return's lid.
    - It runs north along x = 50 at 3.8 m. That keeps it clear of the Track, the bowls and the County kerb.
    - It swings west over the hub and drops into the top of the main return's bin.
  - **The Back return's branch** runs east along z −124 and joins the trunk at `TUBE_JOIN`.
  - The old buried pipe and its collar are gone. A chrome collar sits on each lid.
  - The returns' plate now reads "FHI · BALLS IN · WHOOSH".
- **Batches you can see:**
  - A pocket fed in sends a train of 4–12 balls (n/4 + 3) along the whole route.
  - The train arrives in 5.6 s, just before the server's THUNK at 6 s (`dive.js TUBE.DELAY`).
  - The `tube` event now carries `n`, so the train's length follows the pocket.
- **Sound:** a new module, `web/js/tubesfx.js`, plugs into `sfx.js`'s bus (`audioHandle`).
  - There's a rising whoosh with a suction pop at the send, and a falling whoosh as the train lands over the hub.
  - Both fall off with distance: full inside 6 m, silent past 90 m (`tubeGain`).
- The cart and the teenagers still never use the returns. Drones still bank at the nearest one.

### 2. Automated bucket filling
- **What existed:** row `bucket` with a single tier, the Club's Bucket machine (10 s, $400). It was hidden at the Muni.
- **Now:** a row **`filler`** ("Bucket filler") from **Muni day 2**:
  - Tier 1, "Old bucket filler": **$50 base, one bucket every 20 s** (`BUCKETS.SLOW_SECS`).
  - Tier 2, "Bucket machine": $400 at the Club, every 10 s.
  - `sim.js machineSecs(tier)` gives the seconds.
  - `basket.js stepBasket`'s `machine` option now takes seconds. `true` still means 10 s.
- **Save migration:** an old save's `up.bucket ≥ 1` becomes `up.filler = 2` (`crew.mjs migrateShop`). No save version bump.
- **The snapshot** carries `machT` (0..1, the filler's current bucket), or null with no filler.
- **Making it obvious:**
  - A bolt-on machine sits on the dispenser's west side: grey and battered at tier 1, safety yellow at tier 2.
  - It has a motor drum, a spout and a green lamp.
  - A bucket sits under the spout and visibly fills: a heap of balls grows with `machT`, and balls dribble from the spout.
  - The box shakes while it works: a wheeze at tier 1, a hum at tier 2.
  - When the bucket is done, it hops onto the rack.

### 3. The bucket animation
- **The rack** (`layout.js RACK / BASKET_SLOTS`):
  - 12 real slots in 2 rows of 6, 0.4 m apart. A bucket is 0.34 m across, so no two touch and none stack.
  - They sit on a slatted pallet, with each slot's ring painted on it.
  - Slot 0 is the one nearest the dispenser.
- **One InstancedMesh draws every range bucket.** A second InstancedMesh draws the ball heaps, which scale with the fill. The buckets drawn:
  - the rack's buckets (full);
  - the bucket under each Rat chute, which fills over `FILL_SECS` while the chute's stream falls into it;
  - the filler's bucket;
  - a bucket at every playing bay. It sits beside the golfer and **empties as they hit** (fill = `left / bucketFor(venue)`).
- **Bays:** buckets are drawn only for lower mats in `st: 'playing'` that exist in `MATS` (the "bays" builder's note). Upper bays are untouched.
- **Customers:** they carry the bucket in and set it down at the mat.
  - `customers.js custPos` now returns `carry: false` while playing, so the bay's bucket is the one you see.
- **Colour:** the range bucket is blue everywhere. `people.js BUCKET` went from orange-red to the rack's blue, so the bucket in hand, on the rack and at the bay all match.

### 4. The hopper counts in plain words
A new pure module, `web/js/hoppertext.js`, unit-tested.
- **The washer's front board** was "UNWASHED 34 · $68". It's now two lines: **"34 DIRTY BALLS" / "WAITING TO WASH · +$68"**.
  - An empty hopper reads "HOPPER EMPTY / BANK BALLS TO WASH".
  - The board still turns amber over 100.
  - The heap of dirty balls in the funnel was already there; it stays the visible pile.
- **The crank prompt** (`round2.js`):
  - **"Hold E: crank 34 balls clean (+$68)"**.
  - While cranking: "Cranking… 5 balls still dirty".
- **The dispenser window** (`props.js`):
  - It read "IN HOPPER 0420". That number came from the field's ball count, so it meant nothing.
  - It now reads **"SILO 0432 BALLS"**, the silo supply, with the balls behind its glass at that level.
- **The cart** already read "Cart 18 / 150" on the HUD, the owner's own example, so it's unchanged.

### 5. One physical story: return → pipe → washer → silo → machine → basket → customer
- **Balls in the return pipe are dirty:**
  - brown on the riser into the washer;
  - muddy tan on the direct pipe, before the crew owns the washer.
- **Washed balls are white.** They run down the washer's chute, then **drop inside the clear silo** to its fill level (`washer.js silo()`). Balls from the direct pipe do the same.
- **The silo shows the supply** (`basket.js siloFill`). This one number now feeds:
  - the Board's silo;
  - the dispenser window;
  - the level the chutes drop to.
  - It starts at `SILO_START` 720, two baskets' worth (was 400). It never reads below `SILO_RESERVE` 30, so the dispenser is never "empty" while it still dispenses.
  - It rises with every bank and falls 30 balls for every bucket filled.
- **A clear feed pipe** runs from the silo's foot, low behind the Board, up the dispenser's back and into its glass dome.
  - Balls run along it whenever a chute or the filler is filling. That shows the silo feeding the machine and the basket.

## Numbers
| | Before | After |
| --- | --- | --- |
| Far return (tier 1) | $150, Muni day 3, (10, −62) | **$3,000**, Muni day 4, **(44, −130)** across the creek |
| Back return (tier 2) | $1,500, Club | **$12,000**, Club, (−6, −128) |
| Auto filler | Club only, $400, 10 s | **Muni day 2, $50, 20 s**; Club $400, 10 s |
| Silo supply at the morning | 400 (floor 0) | 720 (floor 30) |
| Tube | buried | r 0.3 m, 3.8 m up on posts, ~170 m trunk + ~55 m branch, 5.6 s whoosh |

**Where the prices land.** I used the expert's bot logs (`scratchpad/expert/out`), crew-scaled ×1, ×1.4 and ×2.2:

| | Muni income a shift (days 3–5) | Muni fee | Club income a shift | Far return | Back return |
| --- | --- | --- | --- | --- | --- |
| 1P | ~$1.5–1.8k | | ~$24–32k | $3,000: about 2 Muni shifts, or ~12% of a Club shift | $12,000: ~45% of a Club shift |
| 2P | ~$2.3–2.6k | | ~$19–32k | $4,200: competes with the fee; bought late Muni only by a crew that lingers | $16,800: ~70% of a shift |
| 4P | ~$4.1–4.4k | $5,500 | ~$35–60k | $6,600: more than a Muni shift and the fee comes first, so it lands early at the Club (~13% of a shift) | $26,400: ~half a shift |

So a crew buys the Far return late in the Muni or at the Club, never on day 3, which is what the owner asked for. The **filler** is $50 at 1P and $110 at 4P, a token buy on Muni day 2. A bucket every 20 s is 3 a minute. The 4P peak demand is ~7.7 a minute with the blimp (owner-playtest-3), so the crew still fills by hand at the Muni.

**Draw calls**
- Field returns: +2 when owned (the clear tube, the batch balls).
- The hub:
  - +1 always (the feed pipe);
  - +1 for the heaps InstancedMesh;
  - +1 for the filler machine once bought.
- Everything with many objects is instanced, and nothing allocates per frame.

## Files touched
- **Mine:**
  - `web/js/layout.js`: returns, tube routes, rack, fill buckets, filler, silo level, feed pipe.
  - `web/js/ballreturn.js`: rewritten.
  - `web/js/basket.js`: machine seconds, `machineProgress`, `SILO_START` / `SILO_RESERVE`.
  - `web/js/washer.js`: the board, the silo drop, and a fix for the first chute ball, which never showed.
  - New: `web/js/hoppertext.js`, `web/js/tubesfx.js`, `test/range11.test.mjs`.
- **Shared, small edits:**
  - `web/js/sim.js`: the `returns` row, the `filler` row (replaces `bucket`), `BUCKETS.SLOW_SECS`, `machineSecs`.
  - `server/crew.mjs`:
    - `migrateShop`: bucket → filler;
    - `stepBasket` gets `machineSecs(up.filler)`;
    - the snapshot carries `machT`;
    - the `tube` event carries `n`.
  - `web/js/main.js`:
    - the `siloFill` import;
    - `whoosh` on the tube event;
    - `bucketIn` on the bucket event;
    - the Board's silo reads `siloFill`;
    - `ballReturn.machine / bays / silo`;
    - `fieldReturns.tick(dt, camera.position)`;
    - `fieldReturns` added to `window.rr` under `?debug`.
  - `web/js/round2.js`: the crank prompt via hoppertext, `washer.silo()`.
  - `web/js/props.js`: the dispenser window reads the silo supply.
  - `web/js/customers.js`: `carry: false` while playing.
  - `web/js/people.js`: bucket colour.
- **Tests updated:**
  - `test/layout.test.mjs`: the new spot. The §C distances to Bowls A and B are gone.
  - `test/returns.test.mjs`: the prices.
  - `test/onboarding.test.mjs`: day 2 shows `filler`.
  - `test/op3day.test.mjs`: `siloFill` 760, and the reserve.

## Tests
`test/range11.test.mjs` adds 9 tests:
1. Both returns are across the creek and over 120 m out.
2. The tube runs from the lids, overhead (≥ 3.3 m) everywhere in the field, inside the nets and clear of the kerb, into the bin top. The branch joins the trunk, and the whoosh is under 6 s.
3. The filler row's prices, days and lock.
4. `stepBasket` at 20 s, `machineProgress`, and `true` still meaning 10 s.
5. The save migration.
6. The rack: 12 slots, no overlap, none stacked, clear of the basket, the customers' spot, the dispenser and the filler bucket. The chute buckets sit by the Rat.
7. The silo level is monotonic and capped. The feed pipe runs from the silo skin into the dome.
8. The hopper text.
9. A playing customer has set the bucket down.

## Goldens
**My changes do not move the seam goldens.** I checked this on a clean `git archive HEAD` copy with only my sim and server changes applied: `test/seam.test.mjs` passes 20 / 20 there.

On the shared checkout, the three GOLDEN crew-run tests fail. That comes from other builders' work in progress (the end-of-day and bays changes).

The full suite on the shared checkout was 1004 pass / 9 fail at my last run. None of the 9 are mine:
- one goals test ("a fresh crew prints the Muni card");
- the three goldens;
- the Two-Minute Warning;
- four Last Call / TARGET tests.

## Screenshots (the rr-dusk preview, a dev save with the returns, filler and washer bought)
- `design/shots/r11-range-tube-far.jpg`: the tube on posts with brass flanges; the Far return and the Back branch.
- `design/shots/r11-range-tube-hub.jpg`: the trunk swinging over the hub and down into the return.
- `design/shots/r11-range-rack-filler.jpg`: the rack with four full buckets, the filler filling its bucket, the Rat chute's stream.
- `design/shots/r11-range-chute-feed.jpg`: a Rat filling; balls in the feed pipe from the silo.
- `design/shots/r11-range-bay-buckets.jpg`: bay buckets emptying (mat 1 nearly full, mat 2 low).
- `design/shots/r11-range-silo-washer.jpg`: dirty balls riding into the washer, the silo's fill, the tube's end at the return.

## Open issues
- **Customers walk out holding a bucket that still looks full.** `people.js`'s bucket mesh has balls baked in. An "empty bucket" carry kind needs a small `crowd.js` change, and `crowd.js` is builder "late"'s file.
- **The tube's posts have no collision.** At x = 50 the cart can drive through one. They're thin, and adding collision would move the cart-grid golden.
- **`props.js` still hangs its static blue bucket under the dispenser's front chute.** That bucket is decoration and doesn't fill. It sits apart from the filler's bucket on the west side and the Rat chutes' buckets on the east side.
- **The filler fills when Today's "Ball Shortage" applies.** It respects `basketMax` (builder "today"'s cap of 6), but the client still treats 12 as full when it decides whether the filler's bucket is "busy". The only effect is cosmetic: an empty bucket waits under the spout.
- **The morning job "Fill the bucket basket!" is dealt even when a filler is owned.** That's still right: the filler only runs during the shift and is slow. I left `morning.js` alone for builder "today"'s memo line.
