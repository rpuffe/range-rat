# Range Rat — game design

> **Round 1 of the fun council** (design/council-round1.md) sets the story (Range Rats, Fairway Holdings, Ball Value) and replaces the stars below with Ball Value and the daily quota. Where this doc and the council record disagree, the council record wins.

A co-op incremental game set on a golf driving range. You start by picking up
one ball by hand. You end up running a range so big it needs its own weather.

This is the source of truth for design decisions. When a decision changes,
update this file in the same commit.

## Pillars

1. **Multiplayer first.** Up to 6 players share one range, and balance is
   tuned for 4. Solo has to work, but it's never the target.
2. **No assignments.** Nobody gets a role. Everyone does whatever job they
   want, and the crew chooses what to automate. Automation is how a crew
   covers jobs nobody wants to do.
3. **Monotonous, then absurd.** Every job starts tedious and by hand. Every
   job, even peeling potatoes, can be automated to a ridiculous scale.
4. **Controller first.** Everything works on an Xbox controller in Edge on
   Xbox, from the sofa: menus driven by the stick, and text big enough to read
   on a TV. Mouse, keyboard and touch work too.
5. **Rare, loud moments.** No running commentary. A short, absurd voice line
   plays only for big events (see below).

## A shift is a day

- One shift runs from opening to sunset, about 6–8 minutes. The sun really
  moves across the sky, and the last minutes have dusk lighting.
- Customers arrive, buy buckets and hit balls onto the range. The crew keeps
  up: picking up, washing, refilling buckets, feeding people.
- **End-of-shift report:** cash earned, balls collected, buckets sold, cart
  hits, dives, knockdowns, potatoes peeled.
- **Overnight:** the crew spends from a shared wallet in the upgrade shop.
  Range expansions are built overnight and shown off the next morning.

## The economy loop

Customers hit the balls you collect. Collecting lets you sell buckets, bucket
sales bring in more customers, and more customers put more balls on the field.
The bottleneck keeps moving: picking up → washing → bucket machine → bays →
the clubhouse → parking.

## Progression: what's the goal?

Two numbers matter:

- **Cash** pays for everything: tools, automation, machines, expansions.
- **Range Rating** (stars) is how happy customers are: short bucket lines,
  clean balls, a clean range, food in the clubhouse. It's earned per shift.
  **An expansion needs both cash and a star rating**, so the side jobs
  (power washing, potatoes, pond diving) matter. Rich but filthy doesn't
  unlock the next venue.

**Venue tiers.** Each one is a bigger field, a new look, new customers, new
problems:

1. **Muni Range.** Ten mats, a pond, a shed. Everything by hand.
2. **Range Club.** Covered bays, a clubhouse kitchen, the first picker cart.
3. **Tiered Entertainment Range.** Multi-level bays, target greens, ball
   return gutters, night shifts.
4. **Stadium Range.** Thousands of bays, a fleet of carts, the jumbotron.
5. **County Range.** The field spans the county. Conveyors, vacuums, drones.
6. **Orbital Range.** Customers drive balls into low orbit, and you collect
   them up a ball space elevator.

The goal is to reach the Orbital Range and collect the **Last Bucket** (an
ending). After that it's endless: the field keeps growing and the numbers
keep going up.

**The tool ladder (picking up balls):** hands (pocket of 3) → ball-retriever
tube → range bucket → rolling wire-cage push picker → caged cart with gang
reels → wider gangs and a second cart → self-driving carts → a fleet →
conveyors and sloped gutters → vacuums → drones → orbital.

**Automation:** every job in the crew's list can be bought out, one level at
a time (a helper, then a machine, then a factory). Upgrade costs scale with
how many crew are playing, so balance holds at 4.

## The upgrade shop (built)

The shop is open before the first shift and overnight, never mid-shift.
Anyone can buy from the crew's one wallet, and everyone sees a toast for each
purchase. Prices scale with crew size (×1 solo, ×2.2 for four). The catalog
lives in `web/js/sim.js` (`SHOP`, `perks`).

| Item | Tiers (solo price) |
| --- | --- |
| Carrying gear | Bare hands (3) → retriever tube $20 (8, longer reach) → range bucket $75 (25) → push picker $250 (60, scoops up whatever you walk over) |
| Hired help | One to four teenagers: $60, $150, $400, $1000. Each one walks to the nearest unclaimed ball, fills up with the crew's gear (up to a bucket), and banks at the stand. They get knocked down too. At closing they turn in what they carry. |
| Ball washer | $1 a ball → $2 ($40) → $3 ($160) |
| Advertising | Customers hit 25% / 55% / 100% more balls ($30 / $90 / $250) |
| Shoes | Walk 15% / 30% / 45% faster ($15 / $45 / $120) |
| Hard hats | Knockdowns last 1 s instead of 2.2 ($35) |

| Picker cart | Caged picker cart $600 (holds 300, 2.4 m reels, 9 m/s) → wide gang reels $1500 (holds 600, 4.2 m, 11 m/s) |

Still to come: range expansions (cash plus stars), and the side jobs.

## The cart and Hit the Cart (built)

- There's one cart per crew, parked by the stand, and whoever climbs in
  drives (E / Ⓨ). It gets a chase camera.
- The reels scoop up resting balls in their lane, and the hopper unloads
  itself within reach of the bucket stand.
- The cage makes the driver immune to ball hits. Driving faster than 3 m/s
  through someone on foot knocks them flat.
- Each morning a driverless cart goes back to its parking spot. At closing
  its load is banked.
- **Crew bays** are two orange mats beside the customers. Hold use to wind
  up (a full second is a full swing), aim with your view (looking up lofts
  it), and release.
  - You hit balls from your own pocket, so swinging never creates money.
  - Your own swing can't hit you.
  - There's a 0.8 s cooldown between swings.
- A crew ball that rings the cage while someone drives is a **PING** and pays
  the whole crew one prize:
  - jackpot (40%): every resting ball within 15 m goes into the hopper
  - turbo (30%): ×1.6 cart speed for 20 s
  - multiplier (30%): ball price +1×, up to ×3, for the rest of the day
- A customer's ball, or a ball off an empty cart, just goes ping.

**Controls are split so nothing guesses:**
- Use (left click / Space / Ⓐ) picks up, or swings at a bay.
- Bucket is E / Ⓧ.
- Cart is E / Ⓨ.

## Jobs (anyone, anytime)

| Job | By hand | Absurd endgame |
| --- | --- | --- |
| **Picking up** | One ball at a time | A drone swarm, and the orbital elevator |
| **Washing** | Crank the ball washer | A ball car wash, run like a factory line |
| **Pro shop** | Fill buckets, take payment | A bucket vending wall the size of a building |
| **Diving** | Scuba in the pond: short dives, limited air, murky water | A pond-draining submarine (it's still a pond) |
| **Power washing** | Mud on the cart, the mats, the deck, the sign | A power-washing truck. Mud spawns at random after rain shifts and costs stars until it's clean |
| **Clubhouse kitchen** | Peel potatoes one by one | A potato peeler, then a fry conveyor, then a potato farm |

**Diving** is a small part of the game, but big enough to be one person's job
at times. Lead balls always end up in the pond, so if nobody dives, the pond
fills up and the stars drop.

## Getting hit

- **A player on foot who gets hit by a ball is knocked flat.** They ragdoll,
  stay down for about 2 seconds, and **spill whatever they're carrying**. A
  full bucket goes everywhere.
- The cart's cage protects whoever is driving. Upgrades can include a hard hat
  (it shortens the knockdown and gets a funny sound effect).
- Customers occasionally hit players by accident. Friends at a bay can do it
  on purpose. It's counted as **Knockdowns** in the shift report.

## Hit the Cart (minigame)

- Any player can step into a bay and hit balls at the picker cart.
- The cage has lit targets on it. A hit is a loud **PING** and pays the whole
  crew:
  - a jackpot that sucks in every ball nearby
  - a cart speed boost
  - a multiplier for the rest of the shift
- Since the reward is shared, the driver wants to be hit and lines up
  broadside. It's a co-op trick shot, not a fight. (Hitting players on foot
  instead is the same mechanic and is very much allowed.)

## Ball types

| Ball | What it does |
| --- | --- |
| Range ball | The baseline. |
| Foam practice ball | Light, and it blows around in the wind. |
| Lead ball | Always ends up in the pond. Work for the diver. |
| Super-bouncy ball | Bounces away from whatever's chasing it. |
| Square ball | Doesn't roll. Easy money. |
| Gold ball | Rare and worth a lot. |
| Glow ball | Only shows up at dusk: a rush at the end of the shift. |
| Splitter | Breaks into three when you pick it up. More balls, more money. |

## Voice lines

Short and absurd, only for:
- a range expansion reveal
- a new venue tier
- the first cart, the first fleet
- a ball type showing up for the first time
- a record shift
- a cart jackpot

## Cameras

Three only, and each player picks their own:
- **First-person** on foot.
- **Chase cam** while driving.
- **Overview**, unlocked late, for running a fleet.

## Multiplayer and saves

- **One shared range.** The server holds the only copy of the game state
  (balls, customers, pockets, cash, the shift clock). Browsers send what their
  player does and draw what the server says. This is different from golf,
  where each browser simulated its own shots and the server just passed
  messages along.
  - A player's own position is theirs to report, clamped by the server to a
    plausible walking speed. Pick-ups, deposits, knockdowns and the clock are
    the server's call.
  - Ball physics lives in one shared module (`web/js/sim.js`) with fixed
    steps. The server runs it for real, and browsers run the same code so
    flights look smooth between ticks. The server's word wins when a ball
    comes to rest.
  - The server simulates at 20 Hz and streams to browsers at 10 Hz over
    server-sent events. Browsers post their position and actions about 15
    times a second.
- Crews join with a 4-letter code (no I or O, because codes get read aloud).
  Max 6 players. A reload rejoins as the same player. A second tab is a
  second player.
- **Saves:** a crew's day, cash and totals are saved to S3
  (`saves/<CODE>.json`) when the crew is made, at the end of every shift,
  every minute while something changed, when the crew goes idle, and on
  shutdown. Coming back with the code resumes on the next day. The manifest
  sets `storage: s3-retained`, so saves survive a stack teardown and deploys
  run stop-then-start. A deploy ends live shifts, but the crews come back
  from their saves.
- Each morning starts on a clean field (the night crew picked up). Balls on
  the field aren't saved.

## Not in scope

- Anything from Golden Hour Golf's design (geese, Old Tom, the commentator).
  Only golf's client code is reused: the sky and lighting, controller
  support, Three.js. The server is new, and it's Node rather than golf's Go,
  so the physics is one module shared by server and browser.
- Named balls.
- Greenskeeper (the mowing game) is a separate future project.

## Open questions

- Inside jokes: which ones besides power washing and potatoes?
- How long a shift really is, after a playtest.

## Tuning decisions (play-test, 2026-11-24)

- **Pond Clarity is gentler.** Clarity is `1 − sunk / 80` (the council had /30),
  and the Club-and-up quota is `q = (ceiling − 1) × f` with f = 0.35, 0.40, 0.45,
  0.50, then +0.025 a day up to 0.70 (the council had 0.45 → 0.80). Why: in a
  play-test the pond fell to 30% within minutes and dragged Ball Value under the
  target. A casual crew of 4 that skips the pond for a shift should still make
  quota with clean fixtures and fries; diving is a bonus, not a tax.
- **The pond waits for the Range Club** (owner's call): no pond, no lead balls and
  no Pond Clarity dial at the Muni.

## Council round 3 (2026-11-24): the cuts, Dimple Creek, the Deep End

Source: `design/council-round3.md`. What changed in the build:

- **Cut:** the foam ball, the spigot (look down with the wand to hose your own
  boots), hold-to-peel, the old hold-to-swing meter, grime from every 4 loads
  (grime now comes only from knockdowns), other Rats' cash/board/fries toasts.
  Other Rats' news goes to a quiet 3-line feed on the left.
- **Fixes:** the pressure washer works without a cart (wash the sign and mats on
  day 1); the drained pond at the Muni is dry ground, not water.
- **HUD:** one line, `BV · target · gear`. The KPIs live on the Board.
- **Pacing:** day 1 is 4 minutes, day 2 is 6, then 7. Day 1 is a beginners'
  clinic (carries ×0.7). Every shift starts with the crew clocked in at the yard.
  The square ball debuts on day 5. A one-time nudge points at the shop at $20.
- **Customers** walk in at the gate, grab a bucket at the stand, hit it from a
  mat (30 balls, 50 at the Club and up), and walk out. A mat at mud ≥ 0.9 is
  refused: the customer sulks and leaves, and the mat stays empty for 30 s.
- **MOW-E** (Club and up, from its second day): at 25% of the shift a mower
  warns for 12 s, then drives one lane, raking balls into a tidy row 2.4 m
  behind and flattening any Rat in the way. Award: *Mown Down (Twice)*.
- **The kitchen menu grows by venue:** fries at the Muni, hot dogs at the Club,
  beer at Tiered. Serve a hot dog while Gary is on site and his kitchen check
  passes. Beers served are still counted for the Tiered overserving penalty.
- **Gold balls** get a beacon. Hitting Gary's cart rings it: *Gary has noted
  your enthusiasm.*
- **The map is Dimple Creek** (`web/js/map.js` rules, `web/js/terrain.js` view):
  a netted field x ±64, z to −190; a diagonal creek through the pond, crossed by
  the Plank, the Cart Bridge (the only cart crossing) and the Stones; dry gravel
  that traps balls at the Muni, running water from the Club that floats balls to
  the Delta (into the pond) or the Grate; landmarks for callouts (Red, Yellow and
  Blue flags, Dimples Rock, the Old Tractor).
- **Scuba v2** (`web/js/dive.js`): the Deep End where lead and gold sink, a
  personal dive-gear ladder, crank-to-pump air from the dock, send the bag up the
  line and haul it, 12 treasures for the Lost & Found case, the ball tube.

## Round 4 fix pack (build item 1)

- **Pad latch.** On a pad, tap Ⓐ at the washer handle or the dock pump to latch it on; either stick circles the crank (the harder-pushed one feeds it), movement is frozen while you hold it, and a second tap of Ⓐ or Ⓑ lets go. The mouse stays hold-and-circle; "hold without rotating" is still the slow trickle.
- **Wand.** Looking down (pitch < -1.0) with grime now sends target `'self'` (it was never wired on the client); the prompt names every target: sign, mats, stand, cart, a crewmate, boots.
- **Customers.** Morning mud is 0.95. A customer who reaches a mat at >= 0.9 mud (or the early bird at the opening) now *waits* on the walkway (`wait` state) and is seated once the mat is under 0.6; after 25 s they refuse and sulk as before. Feed: "A customer is waiting for a clean mat (Mat 4)." Mats are numbered 1-10 on their back edge. The Club bucket is 40.
- **Gary** counts only the mats in play (`activeMats`).
- **MOW-E.** Lanes are [-24, -36, -120, -156, -166, -178] (the Short Grass, Short of Red, the Tractor, the Rock, the Long Grass, the Back Net), clear of the rock, tractor and Tiered bowls. The Board and toast name the lane; two orange-and-white cones mark it at x +-64 during the warning.
- **Shop hint** fires at cash >= $20 (hinter `cash` context); the old `nudged` toast in `hud()` is gone. The 1958 scorecard needs venue 4.

## Round 4 venue seam (build item 3): how to add a venue module

The seam is built once in the core files so that each venue (council-round4.md §3.1–3.4) is **new files only**.
Nothing changes at the Muni or the Club: `test/seam.test.mjs` pins golden fingerprints (landings, `cartBlocked`,
`clampToField`, BV, and a whole seeded crew) recorded before the seam existed.

**What a venue build touches (and nothing else in the core):**
1. `server/venues/<id>.mjs` (new) and **one** import + **one** entry in `server/venues/index.mjs` (`MODULES`).
2. `web/js/views/<id>.js` (new) and **one** import + **one** entry in `web/js/views/index.js` (`VIEWS`).
3. Pure shared rules in `web/js/<id>.js` (new; testable in node, no THREE). If it holds a shop row, it must import
   nothing from `sim.js` (the `dive.js` rule: a cycle is a TDZ crash). Then uncomment **its own** pre-written
   import and `SHOP` line in `sim.js` (`GUTTERS_ROW`, `DRONES_ROW`, `TETHER_ROW`).
4. Its own `test/<id>.test.mjs`. Plus the files §5.2 assigns (`kitchen.js` to the deck, `scuba.js` to the
   Orbital, one-line `pa.js` adds).

The commented slots in both registries (and in `sim.js`) are pre-written in venue order with a blank comment line
between them, so parallel builds edit different lines. Uncomment yours; don't reorder or reformat the others.

**Server module** (`export default {...}`; every hook optional; `st` is what `init` returned, `{}` without it):

| Hook | Signature | When |
| --- | --- | --- |
| `id` | `'tiered'` | unique, `/^[a-z][a-z0-9]{0,15}$/`; also its save key and its `s.mods` key |
| `venue` | `2` | active at this venue **and every later one** (the bowls stay at the Stadium) |
| `init` | `(crew, saved) -> st` | once, at the end of the `Crew` constructor; `saved` is your last `toSave` or `undefined` (validate it) |
| `startShift` | `(crew, st)` | each morning after the reset (balls cleared, Rats placed, mud), before the quota is set |
| `tick` | `(crew, st, dt)` | every server tick, any phase; `crew.working()` means "the shift clock is running" |
| `endShift` | `(crew, st, ending)` | at the bell, after helpers, cart and tube bank, before the quota and the report |
| `serve` | `(crew, st, p, {item, quality, n})` | after a kitchen serve went through (`n` = fry baskets it made) |
| `ping` | `(crew, st, b, {prize, n, cart})` | a **paid** ping only: a crew ball (`b.by`) on a driven cart, during the shift |
| `knockDown` | `(crew, st, p, by)` | anyone (a Rat, or a helper: `p.helper`) knocked flat; `by` is `'cart'`, `'gary'`, `'mower'`, yours, or null (a ball) |
| `input` | `(crew, st, p, a) -> true` | an action type `crew.input` doesn't know (`{t: 'lift'}`); return `true` if it was yours |
| `launchMod` | `(crew, st, shot, {mat, kind, lead}) -> shot` | every customer shot before it spawns; return a new shot or mutate it (`shot.curve` is the slice) |
| `onRest` | `(crew, st, b)` | a ball came to rest (flight physics, or the end of a creek drift), after its `'rest'` event; move or delete it and emit your own event |
| `clamp` | `(crew, st, p) -> true` | replaces `clampToField(p, world)` for a walker you placed yourself (the EVA) |
| `inspect` | `(crew, st, stopId) -> false` | veto one of Gary's stops (`'kitchen'` during an incident) |
| `signal` | `(crew, st, name, data)` | messages between modules: send with `crew.mods.signal('target', {...})` |
| `awards` | `(crew, st) -> [[title, shiftKey]]` | extra ledger awards, keyed on a counter you keep in `p.shift[shiftKey]` |
| `kpi` | `(crew, st) -> 0..1 or null` | this venue's Board gauge. Read **only** when `module.venue === crew.venue`; it is called often, so return a stored number |
| `snapshot` | `(crew, st) -> json` | every tick, as `s.mods[id]` (keep it small) |
| `toSave` | `(crew, st) -> json or undefined` | kept as `save.mods[id]`: the module's one save key |

Unknown hook names throw (`checkModule`), so a typo fails the tests. Modules below their venue get only `init`.
Keys in `save.mods` for modules a build doesn't have are carried through untouched.

**Crew helpers for modules:** `crew.working()`, `crew.world()`, `crew.venue`, `crew.rng` (seeded: use it, never
`Math.random`), `crew.events.push({t: ...})` (your own event types), `crew.bank(n, by, kind, w, gear)` (balls to
the stand at today's BV; `gear` 1 is "at gear ×1"), `crew.payCash(amount, by)` (a tab or a fine; never below $0;
returns the change; emit your own event), `crew.addBall(spec)`, `crew.balls` (delete, then push `{t: 'gone', id}`),
`crew.knockDown(p, by)`, `crew.pa(id, {once: true, big: true})` (`big` skips the per-shift cap: once-ever lines),
`crew.mult` with `CART.MAX_MULT` and `CART.MULT_STEP` (Hustle), `crew.stats.<x>` (summed into totals and the report),
`p.shift.<x>` (the ledger), `crew.mods.state(id)` (another module's state; read-only by convention).

**The fourth gauge.** `ballValue({..., kpi})` adds `0.5 × kpi` to Upkeep and `upkeepCeiling({..., kpi})` gains the
slot (3.0 with all four; the quota scales with it). From Tiered on, the Board shows a fourth row labelled
`VENUE_RULES[v].kpi` (BAY UTILIZATION, CROWD SENTIMENT, ZONING COMPLIANCE, ORBITAL DEBRIS) at 44 px; until the
venue's module exists it reads COMING SOON and the ceiling stays 2.5. `VENUE_RULES[v].howto` is the reveal's second
memo card (`revealCards`).

**World geometry (`map.js`; every rule checks the venue, so 0–1 are identical):** `MAP.BOWLS` (A, B, C;
`BOWLS_FROM` 2); `MAP.TRACK` with `onTrack(x, z, pad)`, `trackDist(x, z)` and `cartSpeedAt(x, z, world)` (×1.3 on
it from venue 3); `MAP.YARDS` (fences, mailboxes, the Gnome, the pool, `NET_X` 96.5; from 4); `MAP.KERB_X` 64.5
(`kerbBlocked`, inside `cartBlocked`); `MAP.LIFT` (−44, 5; r 1.3; `TOP` 120; a cart obstacle at 5).
`fieldFor(world)` is the walkers' box (x to 96 from the County); `netsFor(world)` is `{left, right, back}` and
`netClamp(b, world)` / `ballFeatures(b, world)` use it; `clampToField(p, world)` is called with the world everywhere;
carts stay in `MAP.FIELD` (`keepInField`). Landmarks for the new places (Bowl A–C, the Track, the Turn, Yard 1–4,
the Gnome, the Lift) are already in `MAP.LANDMARKS` with their `minVenue`.

**Client view** (`web/js/views/<id>.js`): `export default { id, venue, create(ctx) { return instance; } }`. `create`
runs once, the first time the crew is at `venue` or later (endless counts as 5); build meshes there. Instance
methods, all optional: `show(on)` (the crew's venue crossed your line), `onSnapshot(s, mine)` (`mine` is
`s.mods?.[id]`), `onEvent(e)` (every server event), `tick(dt, t)` (each frame, after the camera is placed),
`prompt(btn, ibtn) -> string` (ahead of the generic prompts), `use() -> true` (click, Space, Ⓐ), `interact() -> true`
(E, Ⓧ), `clamp(me) -> true`, `speedMul(me) -> number`, `capturing() -> true` (freeze walking),
`camera(cam, dt) -> true`, `banner(s) -> string or {text, bg, fg}` (the Board's slogan when there's no Last Call or
Gary), `amb(s) -> {crowd, ...}` (ambience overrides), `reportLines(r) -> [string]`. The first non-null answer wins,
in `VIEWS` order. `ctx` is `{ scene, camera, me, board, SFX, keys, terrain, sky, rightNet (the scenery's right side
net mesh), cartPose, world(), nameOf, toast, feed, showMemo, venues (venues.js parts: deck, stands.left/right,
crowd[], crowdBob, jumbo, car, carY, debris, groups), crew(), balls(), pad(), act(msg), playing(), driving() }`.
Send your own actions with `ctx.act({t: 'lift'})`. The kitchen gets `state()` (the live snapshot) for the mug meter.

**venues.js, done here:** the Tiered deck is x ±20 (stairs x −25 to −20; `parts.deck`); the Stadium stands are
`parts.stands.left` and `.right` (the County view hides the right one); the Orbital Lift stands at `MAP.LIFT` and
its car rests on the platform at `parts.carY` (the Orbital view raises it); `jumbo` and `crowd` are exposed.

**Tests:** a module's own test builds a crew with `new Crew(code, save, { modules: [mine], seed, now })`; see the
dummy module in `test/seam.test.mjs` (it is never in `MODULES`). Views can be tested through
`web/js/views/registry.js` (`createViews(ctx, [view])`) if their `create` avoids THREE.
