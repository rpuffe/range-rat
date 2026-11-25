# Round 11, builder "feel": picking juice, the Club stagger, stations, the Orbital, the price stack

Built from `design/expert-review-pacing.md` #4, #5, #7, #10a and "simplify the price stack".
`node --test test/`: 1,029 pass, 3 fail (the three seam GOLDEN fingerprints, see "Goldens" below).
New tests: `test/feel.test.mjs` (17 tests).

## 1. The sweep (expert #4)

- **New `web/js/sweep.js`.** Pure counter `stepSweep` (pickups within `SWEEP.GAP` = 1.2 s build ×N), shared by the
  client and the server, plus `createSweep()`: one absolutely positioned `<div id="sweep">` in `#hud`, by the
  crosshair (down and right of the dot). It shows from ×3, pops on each step and fades over 0.6 s when the sweep
  ends. Its text is written only when N changes; while live it writes no styles per frame. It takes no focus, so
  the pad and full screen are unaffected.
- **Sound** (`sfx.js sweepTick`): a 45 ms triangle blip at volume 0.03. It is silent below ×5, then climbs a
  semitone a step from 660 Hz and caps 20 semitones up. A cart scoop of 8 plays at most 3 blips.
- **Clean sweep:** the server keeps its own count (`crew.sweepStep`, called from foot pickups and driven-cart
  pickups). Crossing ×25 emits `{t:'sweep'}`, and the client shows the TOAST "Clean sweep! +1% Hustle." (others
  get a feed line). The bonus is +0.01 Hustle for the shift, within the existing Hustle cap, at most
  `SWEEP.BONUS_MAX` = 5 a shift, once per sweep. The client never claims it.
- **Bank rattle** (`sfx.js rattle`): any bank of 20 or more balls (a pocket or a cart unload; not helpers or the
  machine) adds 5–14 ball clicks and a bin thud. They get louder up to 150 balls. The pipe roll was already there.
- Wired in `main.js`: `grab()` (foot and pond grabs), `driveCart()` (the reels), `frame()` (the fade), and
  `feelEvent()` in `onEvent`.
- I checked it in the browser (rr-notes, 8098): the ×N sits just below and right of the crosshair, and the page
  loads clean.

## 2. The Club, one idea a day (expert #5)

- **New `web/js/clubdays.js`** (imports nothing): `CLUB_DAY` and `clubOpen(what, venue, vday)`. Only the Club
  staggers. From Tiered on, in endless, or with no vday (old snapshots, tests), everything is open.
  - **Club day 1:** the kitchen and FED (the shed opens with the promotion), and the square ball.
  - **Club day 2:** the pond fills: water, dock, buddy pump, lead balls, the Pond works row and the first treasure.
    The gold ball arrives the same day.
  - **Club day 3:** the creek dive (and creek snags), the Back return (tier locked "Club day 3"), MOW-E, and the
    super-bouncy ball.
- **The world carries the Club day:** `crew.world()` and main.js `world()` now return `{ venue, vday }`.
  - `vday` is set only at the Club and never in endless.
  - `map.js`: before day 2 the pond is the Muni's mud flat; snags start only once divers can reach them.
  - `creekdive.js creekOpen` and `mowe.js mowerDue` read the day too.
  - `crew.pondOpen()` follows it. The gauge, lead, treasure, sinking and the dock all key off `pondOpen`.
  - On day 1 an in-branch drift that would sink in the dry pond rests at the Delta instead.
- **Kinds:** `pickKind(day, venue, rng, vday)` takes one rng draw as before. At the Club, square comes on day 1, gold
  on day 2 and bouncy on day 3. The Muni is unchanged.
- **Shop:** `shopShows`, `tierLock` and `nextPrice` take an optional trailing `vday`. A row or tier with
  `club: '<key>'` waits for its Club day. Callers: crew.mjs `buy`, main.js `renderShop` and `cheapest`.
  - The Back return tier is `club: 'back'`. That is one line in builder "range"'s row: I added the key only.
  - `POND_ROW` (dive.js) is `club: 'pond'`.
- **Measured** with the expert's `mid.mjs` (Club day 1 to the Stadium), the debut log now reads:
  - **Club day 1:** kitchen, square.
  - **Club day 2:** pond, lead, gold, the keys treasure, the Pond works buy.
  - **Club day 3:** bouncy, the Back return buy, MOW-E, the trophy under the Cart Bridge.

  The Club card lands at every crew size:

  | Crew | Club shifts (seeds) | Expert's runs |
  |---|---|---|
  | 4P | 4 (seed 7) | 5 |
  | 2P | 5, 5, 8 (seeds 7, 11, 23) | 5–6 |
  | 1P | 4 (seed 7) | 3 |

  The 2P seed-23 run spent its extra shifts on Gary's Seal: the bot never washes the cart, so his cart stop fails.
  With the mud rule off, that seed takes 6.

## 3. Stations never make you wait (expert #7)

- **Deck orders queue** (`deck.js`):
  - Up to `DECK.QUEUE` = 3 orders are open at once: the head `d.order` plus `d.queue`, each on its own timer.
  - A new order no longer waits for the last one to be filled. A fill takes the oldest.
  - `stepDeck` returns `raised` (the new order).
  - The snapshot adds `queue` (count) and `cold`.
- **Pour ahead:**
  - With no order open, a good beer served with `ahead` goes on the bar as a cold mug: `DECK.COLD_MAX` = 2 mugs,
    each cold for `COLD_SECS` = 30 s.
  - The next order takes it at once (`coldFill` in deck.mjs `tick`). That pays the full order tab, counts toward
    "Fill N deck orders" and `stats.deckOrders`, and credits the Rat who poured it.
  - A mug that goes warm is poured away: no tab, no drink.
  - The kitchen sends `ahead: true` only when the deck exists, no order is open and the bar has room. Its BEER card
    shows "POUR AHEAD · n/2 COLD", or "+N WAITING" while orders queue.
  - A server `serve` without `ahead` (old clients, tests) is an unordered beer as before. This kept every deck
    balance test meaningful.
- **Order timers:** they stay 30 s, not the 20 s the expert wrote, because the council measured a human cook at
  ~24 s a fill. The deck's drink limits (6, the fines, the rounds) are unchanged.
- **"Fill N deck orders" counts any Rat's pour:** it already counted every `deckTab` with `order`, and cold fills
  now emit one too.
- **The warm tray** (new `web/js/tray.js`):
  - A hot dog that would be wasted, because FED is already at the cap, goes on the shed's tray (2 max, 150 s
    before it goes cold).
  - Once FED has room for it, any Rat who walks past the shed window carries it out: FED rises as if served,
    `{t:'tray'}` fires, and the shooter sees a toast.
  - So a cook can prep ahead and leave, and a 2P crew keeps "Keep the crew fed" ticking without camping.
  - The kitchen's HOT DOG card shows "SPARES → TRAY n/2".
- **Creek breath** (`creekdive.js breathMul`): after a creek dive, air refills ×3 while you walk or wade at more
  than 0.6 m/s, and at the normal land rate while you stand. Pond divers are unchanged.

## 4. The Orbital: 2 full shifts plus the finale (expert #10a)

- At the Orbital, only debris brought down counts toward Balls Outstanding ("They are all in orbit"). Ground balls
  pay as usual but don't count. Each piece counts `DEBRIS_BALLS` = 10, or 15 for a solo crew.
  - The EVA landing and the tether winch call `crew.countDebris`.
  - The Last Bucket still begins when the count reaches 1: mid-shift at once, or at the bell the next morning
    (the old rule).
- `ORBIT.SHOT` is 0.05 → 0.10 (the sky has to supply about 200 pieces).
- **Measured** with the expert's `late.mjs` (Stadium day 1 to the Last Bucket). Every run below ends the same way:
  two full Orbital shifts, then the Last Bucket opens on the third morning and is banked about 2.3 min in.

  | Crew (seed) | Balls Outstanding at 1:00 left, shift 1 | At 1:00 left, shift 2 |
  |---|---|---|
  | 4P (7) | 1,048 | 128 |
  | 4P (11) | 1,248 | 408 |
  | 4P (23) | 1,168 | 318 |
  | 2P (7) | 1,108 | 278 |
  | 2P (11) | 1,238 | 388 |
  | 1P (7) | 1,058 | 83 |
  | 1P (11) | 1,013 | 23 |

  - The Orbital adds about 7 minutes. Before, it was 1 shift and the Last Bucket ~100 s into shift 2.
  - Shot-rate tuning: 0.15 ended 4P runs early in shift 2.
  - The finale triggers every time.

## 5. The price stack: grime folded into the Clean % (expert, an owner firm call)

- **Pay:** a ball pays BV × Hustle × Gary's Seal × FED, whoever carries it. The gear factor is gone from `bank()`,
  cart unloads and field-return feeds. The "· muddy boots" bank-popup chip is gone (`popupLine` returns
  `boots: false`).
- **Clean %:** "muddy boots make you dirtier, not cheaper". `crew.curb()` now adds `bvtext.js bootsMud()` to the
  fixtures' mud: the crew's mean grime (as 0..1) plus half the fleet's mean cart mud.
  - A whole crew caked counts as one fully muddy fixture (Curb −1/12 at the Muni, about −4% on every ball).
  - Clean gear changes nothing.
  - Gary's stops never see it.
  - The grime toasts now say so ("Caked boots drag Clean % down. Hose them.").
- **The first cut didn't work.** It muddied the ball-return fixture instead. With `mid.mjs` at 2P, crews that never
  hose their boots then failed Gary's return stop and stalled his Seal:
  - 7 extra Club shifts (seed 7);
  - 25 extra Club shifts (seed 11), even with the mud capped under his pass mark, because the stand's own creep
    tipped it over.

  The Clean % version takes 5 shifts on both seeds.
- **Ball Value stays legible in one look:** price, Clean %, Hustle, the Seal and FED, with no per-carrier factor.

## Files touched

- **New:** `web/js/sweep.js`, `web/js/tray.js`, `web/js/clubdays.js`, `test/feel.test.mjs`.
- **Mine:**
  - `web/js/sfx.js`
  - `web/js/bvtext.js`
  - `web/js/orbit.js`
  - `server/venues/orbit.mjs`
  - `web/js/deck.js`
  - `server/venues/deck.mjs`
  - `web/js/kitchen.js`
  - `web/js/creekdive.js`
- **Shared, small edits:**
  - `server/crew.mjs`:
    - pricing: `bank`, `curb`, `unloadCart`, `feedTube`;
    - the Orbital: `countDown`/`countDebris`;
    - the sweep: `sweepStep` (and the calls in `pickup`/`cartPickup`);
    - the tray: `stepTray`, the serve hook, the snapshot `tray`;
    - the creek: `breathMul` in the pond/creek step;
    - the Club stagger: `world`, `pondOpen`, the drift sink, `pickKind`'s vday, `buy`'s vday;
    - plus `ahead` passed to the module `serve`.
  - `web/js/sim.js`: `shopShows`, `tierLock`, `nextPrice`, `pickKind`; the Back return's `club` key.
  - `web/js/main.js`: imports, `world()`, the shop's vday, `grab`/`driveCart`/`frame` hooks, `feelEvent`,
    `onServe` ahead.
  - `web/js/map.js` (the pond, snags), `web/js/mowe.js`, `web/js/dive.js` (POND_ROW `club`).
  - `web/js/round2.js`: the grime toast text.
- **Tests updated for the new rules:**
  - pricing: `bvtext`, `economy`, `council`, `round2`, `cart`;
  - the Orbital: `ending`, `round2` (Last Bucket), `orbit`;
  - the deck: `deck` (the late-cook bot tracks each queued order's own open time);
  - the Club stagger: `mower`, `goalcard` (the forced treasure starts at Club day 2), `seam` (one non-golden
    ceiling assert at Club day 2);
  - the `kinds`, `round2` and `scuba` factories default a Club crew to venueDay 3 (past the stagger).

## Goldens

All three seam fingerprints are off. I didn't re-record them. Measured with a copy of the seam's `crewRun`:

- **The Muni run** (47588632 → dee0fab1) was moved by other builders: zeroing my mud rule changes nothing there.
- **My `bootsMud`** (grime counted in the Clean %) moves the Club run: d9cdf16f with it off, bf02d702 with it on.
  Same for the snags-off run: b2f72eff off, f7d12899 on.
- **My other Club changes** are neutral at `CLUB_SAVE` (Club day 3, everything open).

## Open issues

- The pond dive's server pickups don't feed the server sweep: no bonus from pond grabs, though the client still
  shows ×N.
- The cold-mug and tray toasts are shooter-only. No 3D mug on the bar; the kitchen card carries the state.
- No bot plays pour-ahead or the tray yet, so their effect on 2P Tiered (orders: 10–22 shifts at Tiered for the
  naive 2P bot, as in the expert's runs) is unmeasured.
- A save mid-way through Club day 1 loads with the pond dry and the dive gear unused until day 2. That is
  intended, but worth a line in the owner notes.
