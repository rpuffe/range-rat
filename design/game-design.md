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

## Stadium (venue 3, round 4 item 7): the Ping Track and Crowd Sentiment

Built as a venue module: `web/js/stadium.js` (pure: `CROWD` constants, `gateAt`, `stepLap`, `stepSentiment`, `pingDelta`),
`server/venues/stadium.mjs` (`tick`, `ping`, `knockDown`, `signal('target')`, `kpi`, `snapshot` `{s, laps, knocks}`),
`web/js/views/stadium.js` (the Track paint, the jumbotron canvas, the crowd bob and wave, ambience), `test/stadium.test.mjs`.
- **Crowd Sentiment** (the Board's fourth gauge here): 0.5 each morning, -0.0025/s while the clock runs. A paid ping +0.08
  (+0.16 with the cart on the Track, jackpot +0.10 on top); a lap +0.06; a Tiered TARGET! (signal `'target'`) +0.06; a
  knockdown +0.02, the first 10 a shift (the rest still trigger KNOCKDOWN CAM). Nothing is saved: it resets each shift.
- **Laps:** read off the driven cart's pose. The Track's four quadrant gates (0 E, 1 S, 2 W, 3 N, by angle on the ellipse,
  counted within 1.5 m of the paint) must be visited in order, either direction (fixed by the second gate), inside 25 s.
  The fourth gate then starts the next lap, so a steady driver banks a lap every 3 quarter-turns of travel. Skipping across
  the oval restarts; a wobble back over a line is ignored; a parked cart resets it. Server event `{t: 'crowd', kind:
  'ping' | 'lap' | 'knock'}` feeds the view.
- **View:** the bob is `0.1 + 0.5 s` (set on `venues.crowdBob`), pulsing in a wave above 0.9 and flat below 0.25 with a
  toast "THE CROWD IS BORED"; ambience `crowd` is `0.2 + 0.8 s` during a shift; the jumbotron plane takes a 512 x 300 canvas
  (CROWD heart %, PING! name for 3 s, KNOCKDOWN CAM name, n TODAY for 5 s). The Track is a painted ribbon at y 0.04.
- **Not built:** the second cart (the fleet, item 10). The wave pulses the whole crowd together rather than rolling per seat
  (venues.js owns the matrices).

## Tiered Entertainment Range (venue 2, round 4 item 4): the Target Greens

Files: `web/js/tiered.js` (pure: `inBowl`, `cupSpot`, `bayUtil`, `TARGET`, `GUTTERS_ROW`; imports only `map.js`),
`server/venues/tiered.mjs`, `web/js/views/tiered.js`, `test/tiered.test.mjs`. The Upper Deck is a separate module.
- **The cup rule.** On rest (`onRest`), a ball inside a bowl's `r` (strictly less) is moved to `cupSpot(id, bowl)`
  (a hash scatter inside the cup radius), gets `b.cup = bowl.id`, and `{t:'cup', id, bowl, x, z}` goes out. The client
  rolls it there at 4 m/s. Cupped balls are ordinary resting balls: pickers and helpers take them. `b.cup` is cleared
  and re-evaluated whenever the ball rests again.
- **Bay Utilization** = `bayUtil(cupBalls)` = `1 - n/40`, recounted every 0.25 s (balls leave cups by being picked up)
  and stored; `kpi()` returns the stored value. Only graded at venue 2.
- **TARGET.** A *crew* ball (`b.by` is a player) resting in a bowl during the shift flushes that cup plus itself to the
  shooter at gear x1 (`bank(n, id, null, w, 1)`), then Hustle +0.25 (capped at `CART.MAX_MULT`), `stats.targets`,
  `p.shift.targets` (award: Bullseye (Noted)), event `{t:'target', by, bowl, n, mult}` and a `'target'` signal for the
  Stadium crowd. The pin strobes 3 s on the client. Outside the shift a crew ball just cups.
- **Gutters** (`GUTTERS_ROW`, crew row, `minVenue` 2, $100,000 base): each cup drains 1 ball/s (oldest first) while the
  shift runs, banked as `bank(n, 'gutter', 'gutter', w, 1)` with a `{t:'gutter'}` event (THUNK). No burst after an
  empty cup: the accumulator is capped at 1 s.
- **Snapshot** `s.mods.tiered = {cups: [A, B, C], util}`; no save key.
- **Not done / needs core:** the TARGET PA line (a `pa.js` entry) and the Board's KPI row text come from core;
  `main.js` has no `cup` handling (the view tweens `ctx.balls()` entries itself).

## The County (venue 4), round 4 build item 8

Files: `web/js/county.js` (pure: `SLICE`, `strayCount`, `zoning`, `yardAt`, `DRONES_ROW`, `droneCount`, `droneTarget`, `droneStep`; no `sim.js`
import), `server/venues/county.mjs` (`launchMod` slice, the stray count, `stepDrones`), `web/js/views/county.js` (lawns, kerb, picket
fences with gates, mailboxes, the Gnome, the pool, "Yard N" signs, drones; hides the right grandstand and moves `ctx.rightNet` to x 96.5),
`test/county.test.mjs`.

- **The slice.** 40% of customer shots (not the pond's lead balls) get `curve` 1.0-2.0, bending right. The doc's 0.6-1.4 puts only ~6% of
  shots past the kerb; 1.0-2.0 gives ~12% (pinned at 8-18% by 2,000 seeded shots). Venues 0-3 have no slice.
- **Zoning Compliance** = `1 - strays / 30`, strays = resting balls (not Ball No. 1) at x > 64.5, recomputed every 0.5 s; the module's `kpi`.
- **Drones** (`drones` crew row, `minVenue` 4: two drones $1.2M, four $3M base). State lives in the module (`st.drones`), not in `crew.helpers`,
  so nothing can knock them down. 10 m/s at y 6, strays first then the nearest ball, 25 carried, dip to y 1 to grab, bank at the stand (`kind: 'helper'`,
  so `stats.helped` counts them); they bank at the bell. Snapshot `s.mods.county = { strays, kpi, drones: [{id, x, y, z, yaw, n}] }`. The PA line
  `drones` is voiced once-ever on first purchase. The view cheers (jackpot sound) on the `buy` event for `drones`.
- Not built: the buzz that pitches up when loaded (no audio hook in the view ctx), and the Yards chore (a push picker on foot is a core change).

## The Upper Deck (round 4, build item 5)

Tiered's overserving toy. Files: `web/js/deck.js` (pure `DECK`, `stepDeck`, `serveEffect`, `applyServe`, `landingSpot`, `fallPose`, `bannerFor`),
`server/venues/deck.mjs` (module `deck`, venue 2), `web/js/views/deck.js` (loungers), the mug meter in `kitchen.js`, tests in `test/deck.test.mjs`.

- **Rule.** `st.deck.drinks` 0..6, reset each morning. Beer (good or perfect) +1 and pays a bar tab of 5 x BV (`deckTab` event); every 30 s of shift
  time -1 (only while `crew.working()`); hot dog -2, fries -1, burnt serves change nothing. At 6: **incident**.
- **Incident.** Next seat round robin falls: `deckFall {seat, x, z, by, fine}`. Fine 100 x BV via `payCash` (never below $0; `stats.deckFines` is what
  was actually taken), drinks to 2, `stats.incidents++`, `p.shift.lastOrders++` (award *Last Orders*), PA `deck` (once ever, big), any Rat or helper
  within 1.5 m of (seat x, 1.0) gets `knockDown(p, 'customer')`. If Gary is on site (warn or drive) his kitchen stop fails (`inspect` veto, this shift).
- **Save.** One key, `save.mods.deck = { last }`: the day of the last incident (new saves start at the current day). Snapshot `s.mods.deck = { drinks, last, today }`.
- **View.** Four loungers at x -14, -6, 6, 14 (y 3, z 2.4) with a mug; sway amplitude drinks / 6; from 4 drinks one shouts WOOO every 6 s (synthesised
  voice plus a sprite). On `deckFall` the lounger leans, falls 3 m in 1.4 s with a half spin (arms up), lies 3 s under a star swirl, walks out left,
  and 20 s after the fall a new one climbs the stairs from x -27.5. First beer at Tiered shows the hint toast once (localStorage). The Board slogan is
  the view's `banner()`: "DAYS WITHOUT AN INCIDENT: N" (red and 0 on an incident day), so `board.js` needed no change. `reportLines` adds
  "Upper Deck incidents: N · fine $X".
- **Kitchen.** `createKitchen({ state })` reads `state().mods.deck.drinks`: six mugs on the beer card (and over the pour stages), gold, amber at 4
  ("The deck is getting loud"), red at 5 ("CUT THEM OFF").
- Not built: a ball-return (gutters) or hosing a lounger (cut by the council). The loungers' mugs are a fixed prop, not in the hand rig.

## Round 4: the Orbital (venue 5, build item 9): the Lift, orbit shots, the EVA, the tether

Built to council-round4.md §3.4 (the full EVA, not the "Orbital lite" fallback). Files: `web/js/orbit.js` (pure; imports `dive.js` and
`map.js`, never `sim.js`: `ORBIT`, `LIFT`, `debrisSpot`, `nearestDebris`, `rideHeight`, `spaceness`, `clampDisc`, `evaStep`, `TETHER_ROW`),
`server/venues/orbit.mjs` (module `orbit`, venue 5), `web/js/views/orbit.js`, `createEva()` at the end of `web/js/scuba.js`, and `test/orbit.test.mjs`.

- **Orbit shots.** `launchMod` turns 5% of customer shots (never a lead ball) into `{vx: 0, vz: 0, vy: 70, orbit: true}`. Each tick, an `orbit`
  ball above y 150 is deleted (`gone`) and gets the next debris id (a saved `Set`, cap 60; past the cap a shot just leaves). Save key
  `mods.orbit = {d: [ids], n: nextId}`; the snapshot is `{d, r, p, w}`. **Orbital Debris** = `1 − debris / 30` (`kpi`).
- **Debris geometry.** `debrisSpot(id)` is relative to the top of the Lift: angle `id × 2.39996`, radius `3 + (id mod 7) × 1.2`, height ±1.5 m. Static
  and never streamed, so the server can check a grab against the player's reported position (2D distance, 2.2 m plus 0.3 m of lag slack).
- **Inputs** (`input` hook): `{t:'lift'}` (within 2.4 m of the car, during a shift; 5 s up), `{t:'grab'}` (the nearest id in reach; bag capped by the
  **dive tier's** bag 10/15/25/40), `{t:'ridedown'}` (5 s), `{t:'orbpump', turns, held}` (a buddy within 3.4 m of the car, not riding: the pond's
  `pumpGain` rules, capped at two pumpers). The `clamp` hook pins a rider to the car on the ride and to an 11 m disc while floating.
- **Air.** `evaStep` is `airStep` from `dive.js` with the Lift's position, so there is no Deep End drain. Out of air (or knocked flat, or
  disconnected): `{t:'reel'}`, the bag returns to orbit with the same ids, and you ride down. Down: the bag lands in the pocket at weight 3 a ball
  (`KIND_W.debris`); at the bell a rider still out is brought down and the bag banks directly.
- **The tether winch** (`TETHER_ROW`, crew row `tether`, $6,000,000): every 8 s of a working shift, the lowest debris id is cleared and banked at
  weight 3 as `by: 'tether'` (a `winch` event).
- **View.** Ⓧ on the platform rides up; the car follows the highest rider (`venues.parts.carY`), the camera climbs 1.7 to 120 m, the sky (the
  shared uniforms in `sky.js`) fades to space, 3,000 stars and a Milky Way band come in, an Earth limb with an atmosphere shell curves the
  horizon, and the fog is pushed out. First-person gear on the camera is hidden for the trip. In the EVA you drift (WASD / stick, with inertia),
  Ⓐ grabs, a tether line of 26 little cylinders runs to the car, and `amb()` turns on the ambience low-pass for the hush. `createEva()` (scuba.js)
  adds the visor, breath fog, a pulsing red edge under 25% O₂, an O₂ gauge, synthesised breathing (faster with exertion and panic) and a low-air
  beep. A buddy cranks by tapping Ⓐ / clicking (a held trickle) or circling the right stick (whole turns); the dock's mouse crank in `round2.js`
  is not wired to the Lift.
- **PA.** `eva`, once, on the first ride: "A Range Rat has left the atmosphere. Corporate will hold their locker."
- **Known limits.** Other Rats' bodies stay at ground level (the walker is drawn at `y = 0` by `main.js`) while someone floats; only the car is
  seen rising. The car has one height, so two riders at different stages share the highest. Not seen yet in a real four-player playtest.

## The fleet (round 4, build item 10): the second cart

- **Buying it.** The `cart` row's tier 3, *A second cart*: `minVenue: 3`, $300,000 base ($660k at 4P). It has the wide reels (cap 600). The
  first cart keeps (31, 10); the second parks at `CART.PARK2` (35, 10) and returns there each morning. The `fleet` PA line plays once on purchase.
- **Server.** `crew.cart` became `crew.carts[]` (`perks.carts`: 0, 1, 1, 2 by tier). `crew.cart` stays as an alias for one release: a getter
  for `carts[0]` (and a setter, for old tests), so venue modules and old code keep working. Each cart has its own driver, reels, hopper, mud,
  boost and pings: `board` takes the nearest free cart within reach, `cartOf(p)` is the one a Rat drives, a ball rings whichever cage it passes
  through (the `ping` event carries `cart: i`), and each hopper auto-unloads at the stand and banks at its own Gear (`cartGearOf`, the `cash`
  event carries `cart: i`). The Board's `cartGear` still reads the first cart.
- **Chores.** Gary's cart stop checks the muddier cart. MOW-E stops and honks for any cart (`stepMower`'s `carts`). The wand's target `'cart'`
  is still the first cart; `'cart1'` is the second (and the `spotless` event says which).
- **The Stadium.** Laps are read off every driven cart (`st.lapBy[i]`; `st.lap` is the first cart's), so two drivers can race the Track.
- **Wire and save.** The snapshot carries `carts: [...]` plus the legacy `cart` (`carts[0]`). No save field: the row's tier is the fleet, so a
  v3 save with one cart loads unchanged.
- **Client.** `cartViews[]` (mesh, reels, mud, flash, and its own drawn `pose`; `cartPose` is still the first one's). You drive whichever cart
  you boarded; the others ease to the server.

## Round 4 summary

The one place to see round 4 whole; the per-venue sections above hold the rules, numbers and files.
Source: `design/council-round4.md` (§3.5 the side-by-side, §5 the build items).

| | Tiered | Stadium | County | Orbital |
| --- | --- | --- | --- | --- |
| Map change | 3 Target Greens (cups) | The Ping Track | The right net comes down: the Yards | The Lift |
| Live KPI | Bay Utilization | Crowd Sentiment | Zoning Compliance | Orbital Debris |
| Chore | Empty the cups | Keep the show going | Walk the Yards | EVA: collect the debris |
| Toy | Target Practice, the Upper Deck | The second cart | Drones | The ride, Ball No. 1 |
| Automation | Gutters | The fleet | Drones | The tether winch |
| New verb | Aiming | Lapping | Leaving the field | Floating |
| PA (once) | `overserved` | `fleet` | `drones` | `eva` |

- **Upper Deck rules** (Tiered): drinks 0..6, reset each morning; beer +1 and pays a bar tab, 30 s of shift time -1, hot dog -2, fries -1; at 6 an incident (a lounger falls, a fine, drinks back to 2, Gary's kitchen stop fails). Full detail: [The Upper Deck](#the-upper-deck-round-4-build-item-5).
- **Venue seam**: how venues plug in is [Round 4 venue seam](#round-4-venue-seam-build-item-3-how-to-add-a-venue-module).
- **Venues**: [Tiered](#tiered-entertainment-range-venue-2-round-4-item-4-the-target-greens), [Stadium](#stadium-venue-3-round-4-item-7-the-ping-track-and-crowd-sentiment), [County](#the-county-venue-4-round-4-build-item-8), [Orbital](#round-4-the-orbital-venue-5-build-item-9-the-lift-orbit-shots-the-eva-the-tether), [the fleet](#the-fleet-round-4-build-item-10-the-second-cart).
- **Measuring**: `?pace` records the per-shift pace log (item 11); `?perf` the frame overlay (item 6). See the README.

## Round 5 price decision (x2 from Tiered on)

Council round 5 (design/council-round5.md, section 3) found that from the Club on the fee never gated anything
(every venue took exactly the 3 review stamps) and the late shop rows cost 0.1-0.25 of a shift. It proposed x3.
The owner delegated the call; **x2** won as the more fun, easier option for a casual crew of 4. The Muni and the
Club are untouched.

| Thing | Before (base) | After (base) |
| --- | --- | --- |
| Fee into Tiered / Stadium / County / Orbital | $40k / $200k / $1M / $5M | $80k / $400k / $2M / $10M |
| Gutters | $50k | $100k |
| Second cart (cart tier 3) | $150k | $300k |
| Drones, 2 / 4 | $600k / $1.5M | $1.2M / $3M |
| Tether winch | $3M | $6M |
| Dive scooter (personal) | $40k | $80k |

Fees and shop prices scale with crew size at 4P (about x2.2). Sim (`ladder.mjs`, seed 7, skill 1), minutes at each
promotion, Tiered / Stadium / County / Orbital, then the Last Bucket:

- **4P**: before 65 / 88 / 111 / 134, Last Bucket 149 min, 20 shifts. After: identical (65 / 88 / 111 / 134, 149,
  20 shifts). The stamps still set the pace at 4P; the fee is now 1.0-1.3 shifts of income instead of 0.8-1.1 and
  the crew banks less spare cash. Cash at the Orbital bell: $38.2M before, $30.3M after. End cash: $184M before,
  $158M after. The crew now buys the late automation on arrival less often with change to spare, which is the
  point: it is a decision, not a formality.
- **Solo**: before 73 / 96 / 119 / 142, Last Bucket 165 min, 22 shifts. After: 80 / 104 / 127 / 150, Last Bucket
  173 min, 23 shifts. The $80k Tiered fee costs one extra Club shift (4 instead of 3), then the rest keep their 3.
  Solo is about 8 minutes longer overall.

The reason for x2 over x3: the climb stays at the same length for a 4-person crew, and a solo Rat adds about one
shift, so no crew gets stuck, while the late shop stops being free. Quotas and `PROMO_STAMPS` are unchanged.

## Owner playtest (2026-11-24): the first-night ramp

The owner asked how a new crew learns the game. Calls made (pick the easier, more fun option for 4):

- **Day 1 checklist.** At the Muni on day 1, a shared panel under the HUD lists four jobs: pick up
  10 balls, drop them in the bucket stand, wash the sign, buy something in the shop. It ticks off
  when *anyone* on the crew does each one (server `todoWire()`, snapshot `todo`), plays a ping and a
  feed line, says "Training done. Corporate is unimpressed." and goes away. No checklist after day 1.
- **The shop grows by day** (`shopShows`, `minDay`). Day 1: carrying gear, teenagers, shoes, hard
  hats. Day 2: the ball washer and ads. Day 3: the picker cart. Rows for later venues are hidden
  entirely, not shown locked. The overnight shop shops for tomorrow (`shopDay`).
- **The kitchen waits for the Range Club.** The snack shed row is `minVenue: 1`; at the Muni the shed
  stays boarded ("It reopens at the Range Club."). Promotion to the Club still opens it for free.
  The Muni's Upkeep ceiling is 1.5 (no fries), and its targets already cap at 0.8 × (ceiling − 1).
- **A free teenager on day 2.** Corporate sends one (or one more, up to four) at the start of day 2,
  so every crew sees automation early; the memo and the feed say so. More are in the shop.

## Owner playtest (2026-11-24, round 2): one idea at a time

The owner: "too many signs and stuff to read all at once... clearly communicate with less text."
Rule from here on: **never more than one text element in the middle of the screen**, about 8 words
each, and show, don't tell.

- **Lobby:** the crew code, the share link, the roster, one line ("Pick up balls. Bank them. Hit
  the target.") and Open. No shop on day 1 at the Muni (there is no money yet); the HUD is hidden
  behind the lobby.
- **Day 1 opens with the PA welcome only.** The day-1 memo still fires but is `quiet` (no card);
  there is no "range is open" toast on any day.
- **The checklist is one step at a time** (pick up a ball → bank 3 at the stand → grab the pressure
  washer → spray the sign → buy something), with dots for progress, a yellow arrow in the world over
  the target (the nearest ball, the stand, the washer, the sign; it grows with distance) and a
  compass arrow in the panel. "Picked up!" / "Banked!" / "Spotless!" / "Bought!" toast as each ticks.
  The BV line and the store hint are hidden until they matter.
- **Ordering:** the memo waits for the PA card (and settles 0.6 s, so a PA line in the same tick goes
  first); the checklist and the hints wait for both. Toasts last 4 s at most, on real time.
- **Memos are one line** ("Today: Ball Value $1.15 by the closing bell.") with the joke as small
  `flavor` underneath; the duplicate TARGET line is dropped when the text has the amount.
- **Ball Value** is explained once, by a hint, on day 2 when its line first appears.
- **Shorter everything:** the title controls line, the wand prompt, the late-join toast, the
  overnight report (one big "+$X" with the balls banked; zero lines hidden), the Gary and promotion
  "tomorrow" lines.

## Sign orientation and station detail (owner playtest, 2026-11-24)

- **Signs:** `web/js/signs.js` is the table of every readable sign (position, facing, venues, approach
  points); builders take their yaw from it. `test/signs.test.mjs` asserts dot(facing, toViewer) > 0.5
  from every approach point at every venue. `?signs` draws each sign's facing in the browser and warns
  about meshes that disagree or text planes not in the table. Fixed: the ball washer faced the fence
  (now turned π, handles remapped), its sign is angled to the path, the road sign was one mirrored
  double-sided plane, yardage boards were edge-on, the KITCHEN board sat inside the roof, the
  Jumbotron faced away.
- **Station props** (`web/js/props.js`, `web/js/detail.js`): a real pressure washer (wheels, engine,
  hose reel, gauge, holstered wand, puddle) with mist, wet sheen and drips; the ball washer's plate,
  bolts, grips, bubbles and Brent's roller brushes; a bucket dispenser with a lit header and ball
  window; burlap SPUDS sack, fryer glow and steam at the shed; cart reels that roll and a mud band;
  MOW-E details. Ground noise, mowing stripes, worn dirt, green rings, contact shadows, billboard
  clouds, a warmer light. All scaled by the perf.js tier (`detailFor`); `?noprops` turns it off.
  Known gap: props read the tier at load, so an Auto step-down mid-session applies after a reload.

## Full-game agent playtest (2026-11-24): fixes and economy calls

Three agents played the whole game (Muni→Club; Club+Tiered; Stadium→ending→endless), headless bots
for pace and the browser for feel. Fixed:

- **Ending:** the end card sat under the overnight report (its button unclickable); the report now
  hides on the ending shift and the card is above it. The Rat who carries Ball No. 1 is credited on
  the end card. A Rat idle for a minute counts as at the huddle (one AFK Rat stalled it for ever).
  One persistent banner says where Ball No. 1 is and who the stand is waiting for; "Pick up Ball No. 1"
  prompt; the final memo is one line.
- **Out of air** now moves the diver's own view to the dock (it stayed underwater client-side).
- **Targets at the Club and up climb with stamps earned**, not days served, until the crew holds its
  three (a struggling crew was pushed out of reach for ever).
- **One text at a time, again:** the deck fall is the PA card only; the memo waits a beat after the PA
  card; the prompt hides while the PA card speaks; no hints while aloft on the Orbital; no duplicate
  huddle toast; the washer's cash popup rolls up every 2 s.
- **The Board** shows whole dollars from $100 up, so cents of drift no longer restart the split-flap.
- **CCTV** keyboard hints and a first camera that looks at the mats; **shop prices** use the Rats
  online (the server's count), print with commas, and a lock names its venue; **report** shows
  unwashed balls and the lost premium; endless HUD shows today vs pace.

Economy calls (the owner: pick the more fun, easier option for a casual 4):
- **Tiered fee $80k → $50k base.** The physical bot sat 7–9 Club shifts at 4P earning it while its
  stamps were done by day 3.
- **Gutters $100k → $50k, dive scooter $80k → $40k:** neither paid back before the Stadium.
- **Crowd Sentiment decays half as fast (0.0012/s) and a lap is worth +0.1**, so lapping the cart
  visibly moves the crowd.
- **The fry conveyor drops two baskets**, so a 4-Rat Club can keep the fries up.

Left for a council round (bigger design): late automation (second cart, drones, tether) adds no
income because supply is customer-bound; endless has nothing to buy; Target Greens are too hard to
see and hit; the Tiered deck never fires for a careful crew; the venue KPIs never decide a stamp.
- **Playtest A (first night):** Gary now inspects on **day 4** (day 3 already brings the first target
  and gold) and never runs over the huddle on his way to the stand; his warning is one short line
  after the PA card. An unfinished day-1 checklist **carries into day 2**; day-1 mats start clean
  (no refusals while training); the buy step names the real cheapest price. The memo with a target
  says **"Clean up: Ball Value $X"** (the target is met by cleaning). The stand reach is 3.5 m. The
  overnight report hides the promotion panel until the first stamp, says "Promoted!" after signing,
  keeps "Next shift" pinned on screen, and its shop shows names and prices only. Hints wait for
  toasts. Golden fingerprints re-recorded for the day-1 mats and the stand reach.
