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

## Council round 6 build

- **#6 The Upper Deck orders** (builder D). From Tiered on, a lounger orders every 30 s of working shift time (20 s
  once the deck is amber at 4 Drinks): WOOO, and they hold their mug high. One order is open at a time, for 20 s. A
  good or perfect beer while it's open pays a bar tab of **10 × BV** (an unordered beer still pays 5 × BV) and +1
  Drink, as before. An unfilled order lapses quietly. Sobering is slower: −1 Drink every **60 s** (was 30). Drinks
  still rise only from beer the crew pours. A crew that fills every order with no food has its first incident at
  ~275 s; one hot dog each time it turns amber keeps it under all shift. While an order is open, the kitchen's BEER
  card glows gold with a 20 s timer ring, which also shows on the pour screen. The deck hint now fires on the
  first order: "Fill their orders. Six beers: someone falls." Rules are in `deck.js` (`stepDeck` returns
  `{ sobered, order, expired }`, plus `fillOrder`). Events are `deckOrder {seat}` and `deckTab {order: true}`, and
  the snapshot has `mods.deck.order {seat, left}`.
- **#7 The one-text pack** (builder D). Only your own banks float over you (`payfloat.js`). Helpers, drones, the
  night crew, gutters, the tether and a driverless cart roll into one "+$1,240 · 31" over the stand every 2 s.
  Another Rat's bank shows only as a feed line in their colour, and only when it's ≥ 20 balls. The endless Board
  replaces BALLS OUTSTANDING with TODAY $X · RECORD $Y (from `snapshot().pace`). The report's promotion panel
  (`promopanel.js`) shows the stamps from the first one and the franchise fee only from 2 (or once ready).
- **#10 Day-2 suggestions** (builder D). On the Muni's day 2, each online Rat is dealt one different line, round
  the crew: hose the mats, the far field, the stand, then the washer crank (or "the shop: get a washer" without
  one). The line shows in the checklist's slot with the checklist's yellow arrow. A late joiner gets the next in
  the pool. A line clears once that Rat has done it, or after 45 s of working time (counted from 10 s in, after
  the memo). Nothing rewards it. The day-1 checklist keeps precedence: while an unfinished checklist is up,
  nothing is dealt, and the client waits for "You know the job" to pass. The rules are in `nudge.js`, dealt by a
  venue-0 module, `server/venues/nudge.mjs` (no `crew.mjs` lines), and sent as `mods.nudge {playerId: id}`. Hints
  also wait while your line is up.

- **The Muni stamps are earned (#1).** `quotaQ` has a floor of 0.3 from day 2 (0.30 / 0.30 / 0.30 / 0.35 / 0.40,
  still capped at 0.8 × (ceiling − 1)), so day 2 asks Upkeep 1.30. A seeded 4P day 2 with no hosing ends at 1.17
  (miss); hosing every fixture once in the morning ends at 1.37 (hit). Day 1's tomorrow line is "Tomorrow: a target.
  Hose before the bell."
- **The venue gauge decides the stamp (#2).** From Tiered on, the review needs Upkeep ≥ target *and* the venue gauge
  ≥ `QUOTA_KPI` (0.5, `sim.js`). The Muni and the Club have no gauge, so their rule and quota entry are byte-identical.
  `CUP_FULL` is 30 (15 balls in cups is the line). The quota entry (report and event) gains `gauge`, `gaugeOk`, and on
  a gauge miss `why`, a ≤ 8-word line from `GAUGE_MISS` in `web/js/rally.js` ("Missed: the bowls were full." …). The
  ending shift still has no review.
- **The Closing Bell, server half (#3).** `web/js/rally.js` is pure: `shortfall({ value, quota, kpi, fixtures, venue,
  endless })` returns one `RALLY_LINES` line: the gauge first (under 0.5), then, if Upkeep is under target, the term
  costing most (the dirtiest fixture: mats, sign or stand; fries under 0.5; pond under 0.6), else "On target. Hold it
  till the bell." Endless and review-less days give null. The `lastcall` event carries it as `need`; the client plays
  the horn and toasts it once the PA card and memo are clear, and holds the report card 2 s for the stamp.
- **Square balls jam the reels (#8).** `cartPickup` refuses `kind === 'square'` and the client reel scan skips them;
  walkers, teenagers and drones still fetch them. `KIND_W.square = 2`, `pickKind`'s square threshold is 0.15 (about
  14.5% at the Muni on days 5–6, 10.5% from day 7 once splitters take their share, 5% at the Club and up). Blurb:
  "Worth ×2. The reels can't take it." The Club seam golden was re-recorded for this.
- **Target Greens you can see and hit (#4).** `web/js/aim.js` is pure: `predictRest({ bay, yaw, pitch, power }, world)`
  runs a scratch ball through `swingLaunch` → `advanceBall` one fixed step at a time (the server's exact sequence; it
  matches `Crew.swing`'s rest spot, null if the ball drifts down the creek). `createAimer` re-predicts at most 10 Hz
  (5 Hz on the low tier) and only when power moves > 0.01 or aim > 0.5°. The Tiered view draws a 1.2 m ground ring
  in your colour (the bowl's colour, brighter, while it sits within the crew lip) whenever you stand at a crew bay with
  balls: the backswing's power while you wind up, your last swing's power (0.7 before the first) otherwise; main.js
  feeds the views' new `aim(input|null)` hook each frame. Each bowl's pin is 10 m × 0.25 m with a 2.6 m flag facing the
  midpoint of both bays (`flagNormal`, pinned in `signs.test.mjs`); the flag's canvas (64 px, 32 on low) shows that
  cup's count and only redraws when it changes, going red at `cupWarn()` = CUP_FULL × (1 − QUOTA_KPI) / 3 (5 today).
  One additive `InstancedMesh` raises a 30 m light pillar over all three pins. The forgiving lip: `TARGET.LIP = 1.5`
  and `inBowl(x, z, bowls, pad)`; `onRest` pads only crew balls during the shift, so customers still cup inside r.
  Measured: a predict costs ~0.1 ms median, 0.4 ms worst (≤ 1,560 steps) on the dev PC; the Edge number is for the
  playtest.
- **The Closing Bell, client half (#3).** Pure rules in `web/js/closingbell.js` (`crossing`, `gaugeRed`, `stampFor`,
  `BELL`). The Board flashes its target bar green for 0.4 s when BV crosses the target (`SFX.cash` ding via the
  Board's `onCross`) and amber when it falls back, at most once every 3 s and only while a shift is live. The fourth
  (venue) gauge has a white tick at 50% and fills red while under it during Last Call. At the bell: `SFX.bell()` (a
  synthesised two-strike bronze bell), then 0.45 s later `board.stamp()`: the one centre element, APPROVED in red ink
  with `SFX.jackpot` and confetti over the Board (160 points, 60 on low), or DENIED in grey with `SFX.trombone()` and
  the server's `why` (≤ 8 words) under it, for 1.5 s; the Board wears the stamp too. The report card waits 2 s.
  Confetti is `web/js/confetti.js`: one pooled `THREE.Points` (400 slots, a ring buffer) shared through
  `sharedConfetti(scene)`, ticked once a frame by main.js; the huddle (#5) bursts into the same pool.
- **The huddle beat (#5, builder C).** When the carrier of Ball No. 1 reaches the stand (`atStand`), `lastBucket.phase`
  becomes `'huddle'` (`crew.mjs` `stepHuddle`, run from `stepLastBucket`). There is one ring slot per online Rat
  within `HUDDLE_R` (8 m). Every Rat holds Use (Ⓐ / Space / click, sent as `{t:'hold', on}` while inside the ring).
  While every slot is in the ring and held, a 3.0 s sweep (`HUDDLE_HOLD`) fills, and at 3.0 s `depositOne` banks,
  crediting the carrier as before. These reset the sweep: any release, a Rat leaving the ring, a join, a leave or a
  disconnect (the slot list changed). A Rat who is down doesn't count as holding. A Rat idle for 60 s counts as present
  *and* holding. A knockdown of the carrier drops the ball (`dropOne` → `'down'`). The carrier leaving the ring or going
  offline returns the phase to `'carried'`. The self-heal also covers `'huddle'`. The bucket button alone no longer banks.
  The snapshot's `lastBucket` adds `sweep, slots, in, held` during the huddle. The banner reads "HOLD Ⓐ TOGETHER · 3 / 4"
  (SPACE on a keyboard), and the bottom prompt clears. The ring (`web/js/huddle.js`) is one `InstancedMesh` of 48 arc
  ticks plus 48 gold sweep ticks (1 draw call). The sweep runs on locally between snapshots (`huddlerules.js`
  `sweepNow`). The bank fires two 160-point confetti cannons into the shared pool (80 each on low) and a synthesised
  crowd roar (noise burst, then the bed held ~4 s). Then the $∞ finale plays.
  Gary: during his warning and drive, the same ring shows with no hold. A slot fills inside 8 m, his verdict's
  unchanged rule. The snapshot's `gary.to` names his next stop, and the Board counts "GARY 3", "GARY 3 · 2",
  "GARY 3 · 2 · 1" on his last leg (`garyCountdown`). On a huddle verdict he salutes: his hat lifts and an arm
  rises (~1.2 s, new hat and arm on `buildGary`), with a 60-point puff. If the huddle isn't full, he just leaves
  as before. Tests: `test/ending.test.mjs` (the softlock set: joins, leaves, disconnects, AFK, a real ball hitting
  the carrier, walking out, release at 2.9 s, solo, self-heal), `test/huddle.test.mjs` (the pure rules) and
  `test/round2.test.mjs` (the Gary flag is unchanged by the ring).
- **Scuba you can follow from the dock (#9, builder C).** The pure bits are in `web/js/scubafollow.js`.
  - **Boil:** every diver gets a surface boil: 8 procedural bubbles rising and popping in a 0.6 m ring. It's one
    `Points` on the pond root, so it shows from the shore, using the bubble shader with the spray's long fade.
    main.js passes the divers from each snapshot (`scuba.setMates`).
  - **Bag:** on `sent`, a wireframe net bag climbs a line from the diver to where the line is tied off by the
    hose, over 1.6 s (`bagAt`), with a splash ring where it breaks the surface.
  - **Glints:** while diving, sunk lead and gold within 6 m and inside the torch cone (0.5 rad, the dive light's
    angle) twinkle with the treasure's GLINT shader. The selection is `pickGlints`, at most 20, refreshed at
    10 Hz. They are off on the low tier.
  - **Case:** on a treasure `banked` event, its Lost & Found slot spins three turns with a pop for 2 s under a
    10-point sparkle (`caseSpin`, `scuba.reveal`).
  - Cost: +2 draw calls near the pond (boil, glints), plus the bag and line only while a bag rises.

## Playthrough 2 fixes (A)

Playtester A's findings 1–5, 7–12, 14, 15 and idea 5 (design/playtest-round2.md). The Last Call rally now names the
biggest Upkeep loss by its real cost (0.5 × mud / 12 per fixture, the mats summed as one group, against the sign, the
stand, fries and the pond), and re-checks once 30 s into Last Call (`RALLY_RECHECK`), posting a second line on the
existing `rally` event if the crew is still short; client rally retries drop after the bell. Gary never knocks down a
Rat inside the huddle ring on any leg, and the Board's GARY 3 · 2 · 1 runs from when he leaves the mats (the server
sends `eta`/`span`; ~5 s at the Muni, ~15 s at the Club). The record PA is gone (the report's "Crew record!" line
says it, never over the stamp). Day-2 nudges skip what a Rat already does (the host who hosed gets "far") and none is
dealt in Last Call. The report says "Run over", the verdict toast is "Gary approves. +N commendations.", hosing a
fixture clean credits `hosed` in the ledger, and with all stamps but short cash the promotion panel says "Fee: $X
short". The report card pads for its pinned bar and hides the crew list; the wand prompt shows in full for 3 s, then
"Click spray"; the day-1 lobby says "Pick up balls. Bank them." Tests: test/playtest2a.test.mjs.

## Council round 7 build

**#1 Linked gutters (builder 2).** At Tiered the gutters no longer drain on their own: with them bought, a crew
TARGET drains all three cups to the shooter at gear x1 (still one TARGET: Hustle +0.25, one `stats.targets`, one
`'target'` signal; the event carries `all: true` and the total `n`). Without gutters a TARGET flushes its own cup.
From the Stadium on (venue > `GUTTERS.LINKED_VENUE` 2) they drain 1 ball/s a cup as before. Pure rules
`drainsAll(up, venue)` / `guttersDrain(up, venue)` in web/js/tiered.js; the row reads "Linked pipes under every
green. A TARGET drains all three cups." The view THUNKs the glass A, B, C 0.15 s apart, counts every flag down to 0,
and the shooter's toast is "TARGET! Every cup drained." Re-run (4P idle, real rule): nobody shoots 0.00 at the bell;
one TARGET at 380 s 0.63-0.87; no gutters 0.00-0.47.

**#2 The landing marker (builder 2).** Round 6's 1.2 m ground ring is now a camera-facing disc sprite, 28 px on a
1080-line screen whatever the distance (`sizeAttenuation: false`, `markerScale(fov)`), drawn on top with a 3 px dark
outline in your colour, plus a 6 m additive beam (0.12 m, 40%) through it; inside a bowl's lip both take the flag's
colour and pulse 1.0-1.25 at 2 Hz. Pure `markerState()` in web/js/aim.js decides: visible while winding up (power >
0.05), for 1.5 s after release, then at the bay at your last power; never before your first swing at this venue. The
view reads a release from your pocket dropping at a bay (main.js is untouched). Low tier: the disc only.

**#8 The Upper Deck's rounds (builder 2).** Orders stay open 30 s (was 20), so with orders 30 s apart the next seat
orders as one lapses. From 3 Drinks every third order of the shift is a ROUND (`order.round`): one good pour fills it
for +2 Drinks and a 25 x BV tab, so at 4 Drinks a filled round is a fall. An ignored round lapses quietly. The fine is
50 x BV (was 100). The kitchen's BEER card adds "ROUND x2" in gold under the timer ring; two loungers raise their mugs
with a double WOOO. The hint is "Fill their orders. Rounds count double." Re-run (4P idle, pour 24 s, real rule):
careless (fills all, rounds too, no food) 14/14 filled, 3 rounds, 2 incidents, tab 34-38% and fines 21-23% of an idle
shift; careful (hot dog at amber) 12/14, 0 incidents, tab 30-33%; waving rounds off with no food: 0 incidents, 23-25%.

**#10.1 The fee line leads (builder 4).** With every stamp in and the fee unpaid, the report opens with
`feeHeadline` (promopanel.js): "3 stamps. $895 short." (4 words), a gold line above the report's columns (round2.js
puts it in its own `#fee-head` element, since main.js owns `#report-body`). Nothing at 0-2 stamps, when the fee is
covered, or once the crew is ready to sign (the button leads then). The panel's "Fee: $X short" note stays.

**#9 Endless: the Owner's projects (builder 4).** `web/js/owner.js` (pure; no sim.js import, the GUTTERS_ROW rule) holds
`OWNER_ROW`, a crew row with `endless: true`: `shopShows`/`nextPrice` take an `endless` argument and hide such a row
everywhere else. Tiers at base (x2.2 at 4P): Crew colours $25M, the Owner's Hustle $60M, the statue $150M. Crew
colours: `views/owner.js` paints a striped band (one stripe a Rat, join order, vertex colour, one merged mesh) round the
stand, under the Board (and tints its frame and posts) and round every cart. The Owner's Hustle: `maxMult(up, endless)`
is the Hustle cap for pings (crew.mjs) and TARGETs (tiered.mjs): x3 in endless with tier 2, x2 everywhere else. The
statue: a bronze Rat holding Ball No. 1 east of the stand (one merged mesh, ~1.9k triangles) and a name plate (off on the
low tier), with a once-ever PA ("A statue. Of you. Reluctantly."). The Board (C4): in endless it shows TODAY at 64 px
in whole dollars, the RECORD on the right, and a bar from $0 to the record with a pale tick at the record's own pace;
the bar turns green and flashes (the round 6 crossing flash) when today passes the tick. The pace reads
`records.curve`: the record shift's cumulative cash at 14 checkpoints (every 30 s; crew.mjs samples every shift,
`finishCurve` ends it on the day's cash), interpolated by `paceAt`; a record without a valid curve falls back to
linear. Re-run (council7/endless2.mjs, 4P, everything bought, idle): $22.4M a shift, so the tiers take 2.5, 5.9 and
14.8 idle shifts (23 cumulative; ~0.85 / 2 / 5 at the active $65M the spec assumed). The idle record curve sits far
below linear early ($0.5M vs $3.2M at 60 s, $3.7M vs $6.4M at 120 s), which is the lie C4 named. A Hustle held at the
cap all shift: x2 $41.4M, x3 $62.1M (+50%), the ceiling on what the Owner's Hustle adds.

**#5 Clear the sky (builder 1).** No review at the Orbital: `startShift` sets no quota at venue 5, and the memo is the
countdown ("Today: bring them home. 1,123 to go."); the reveal's how-to is "The Lift is open. Keep the sky clear."
When Balls Outstanding reaches 1, `beginLastBucket` checks Orbital Debris: over `ORBIT.SKY_CLEAR` (15) the phase is
`'sky'`. `paused()` treats `'sky'` as live (the clock, the Lift and the tether run), `launchMod` sends no orbit shots
while a Last Bucket is on, and the riders-home rule skips `'sky'`; at 15 or fewer `stepLastBucket` drops the ball and
anyone still up rides down. The bell during `'sky'` is a plain report; the next morning reopens the gate. The banner
(Last Bucket line and the Board, via the newest venue view's `banner()`) reads "CLEAR THE SKY · 23 UP" (pieces above
15), and Ball No. 1 glints gold over the Lift (one additive mesh). The Last Call line at venue 5 without a quota is the
debris line or nothing. Re-run (council7/orbit7real.mjs, ideal bots, debris 58): two riders on twin tanks 16 s in
`'sky'`, one scooter 23 s, solo on a mask 62 s, solo + tether 47 s; a tether crew at 7 never sees the gate; nobody
riding holds it to the bell (no softlock: anyone can ride).

**#6 The County (builder 1).** From venue 4, teenagers skip strays in `stepHelpers` (drones, carts and Rats still take
them); the tier-1 helpers line gains "They don't do lawns. There's a dog." `SLICE.CHANCE` 0.40 → 0.15: 4.5% of 2,000
seeded shots land in the Yards. Re-run (council7/county2.mjs 0.15, 4P, four teenagers): a tidy crew that never visits
the Yards ends at 30–43 strays (0.00, fail); one push-picker run at Last Call 4–7 (0.77–0.87); two drones 0–3
(0.90–1.00).

**#7 The Two-Minute Warning (builder 1).** The Stadium's graded gauge (the Board, Upkeep, the bell) is the mean of the
last 120 s of live sentiment, sampled once a second (`pushSample` / `windowMean`, the mean so far before 120 s); the
jumbotron, bob and ambience keep the live `s`, and the snapshot carries both `s` and `k`. `RALLY_AT = { 3: 120 }`:
from the Stadium's day 2 the `lastcall` event (horn + rally, `warning: true`) fires at T−120, read off the live crowd
minus 0.1; Last Call's rules still start at T−60 with no second line (the 30 s re-check still runs). The Board shows
TWO-MINUTE WARNING (snapshot `mods.stadium.w`) until LAST CALL takes it. Re-run (council7/stadium7real.mjs, 4P):
no laps 0.25–0.27; 60 s of laps at Last Call 0.37–0.39 (fail); 60 s right after the warning 0.63–0.64 (pass); the
whole last 2 min 0.74–0.75; a 30 s stint every 2 min 0.88–0.93; a second cart lapping all shift 0.99.

**#10.2 The huddle waits less (builder 1).** `HUDDLE_IDLE_MS` 60 s → 20 s (split from `GRACE_MS`), in the Last Bucket
huddle and now in Gary's ring too. A carrier offline for `DRIVER_GRACE_MS` (5 s) drops Ball No. 1 where they stood
(`dropOne`, phase `'down'`), so anyone can carry it; a reconnect inside 5 s keeps it.

**#3 One centre-text queue (builder 3).** New `web/js/say.js`: a pure model (`createSayModel`, node-tested in
`test/say.test.mjs`) and a DOM adapter. Kinds by priority STAMP > PA > MEMO > ALERT > TOAST > TIP; one item visible,
≥ 1.2 s each, 0.3 s gaps; TOAST lives 3 s in the queue, ALERT 15 s, TIP 60 s (and only after 2 s of quiet); a MEMO
settles 0.6 s so a PA a tick later goes first; the same `key` updates in place (fries, cash, rally, Gary). The bell
lock (`bell()` at `quota`, `report()` when the card opens, `open()` on the next phase) drops alerts/toasts/tips and
holds PA/MEMO. `textBusy`, `toastQuiet`, the memo queue, the hint chip timer and every 400 ms retry are gone; `toast`
and `showMemo` are thin `say()` wrappers, and pa.js lost its own queue (its card is a PA item via `enqueue`).
`PA_LINES` are `{ line, caption }` (captions ≤ 8 words; the voice reads the line). The record PA plays only in endless;
review days say "Record shift!" on the report. `test/words.test.mjs` scans every `say(` literal. `?debug`:
`rr.say` (queue, `dropped`), and a console warning for any non-memo line over 8 words.

**#4 Dealt jobs (builder 3).** `rally.js` `shortfalls()` ranks the gauge (when short) then every Upkeep term ≥ 0.01
(the biggest always, when under target); its head is `shortfall()`. `dealJobs()` gives the biggest job the ⌈N/2⌉
nearest Rats, then the nearest undealt Rat to each other job, round again. `lastcall`/`rally` carry `needs` (+ `need`);
the 30 s re-check re-deals. Gary's warning (nudge.mjs, every venue) deals one failing stop per Rat, nearest first,
extras on the mats; a passing stop clears its line and all clear at his first stop; late joiners get one. Muni day 3:
"Keep the mats clean." at half-shift to the Rat nearest the mats if their mud > 0.3. Measured (council7/dealt.mjs,
4P spread, nobody hosing, 5 seeds): Last Call 3 distinct lines at the Muni, Tiered and Stadium; on target (1 line) at
the Club and County; Gary 3 distinct stops at the Muni, 4 from the Club on.

## Playthrough 3 fixes (playtester C)

The Stadium's Two-Minute Warning now fires from the venue's day 1 (after the reveal); day 1 was always DENIED without
it. The T-30 re-check at the Stadium reads the live crowd less the margin (`recheckNeeds`); live fine but the graded
2-minute mean still short says "Keep lapping!". The report labels the two numbers "Crowd (last 2 min)" and "Crowd now".
A sky gate still up at the bell holds the clock at 0:00 (Lift and tether keep working) for up to 90 s
(`SKY_HOLD_SECS`); cleared inside the hold, Ball No. 1 falls and the huddle banks on the held clock, so the finale
is one beat; past the cap the bell rings as before (no softlock when nobody rides). "Ride the Lift" hides while Ball
No. 1 falls, is down, carried or in the huddle. The Board's BV flaps in $10 steps from $10,000. The huddle banner is one
line ("ALL TO THE STAND · n / N", nowrap). The Orbital memo is "Today: clear the sky. N to bring home."; a full EVA bag
prompts "Bag full · E Ride down". The Owner's projects row heads the endless shop.

## Playthrough 3 fixes (A)

Gary's lines clear only once the stop is Spotless (`GARY_SPOTLESS` 0.1, `inspectBase(id, clean)`), not at the 0.34
pass mark; during the warning a Rat with no line takes a failing stop nobody holds (`redealGary`), so a stop that
scuffs back is dealt again and a solo Rat works down the list. The GARY 3 · 2 · 1 is the last `GARY_COUNT` (5) s of
his route at every venue, cart or not. The rally says "On target" only with `UPKEEP_MARGIN` (0.06) of Upkeep to spare
(Last Call and the 30 s re-check both use it; the review itself doesn't). The re-check passes the last deal as `prev`
to `dealJobs`: each Rat keeps a line whose job is still short, and only new jobs are dealt. "Record shift!" shows in
endless only. The report scrolls inside `.split`, which ends above the Next bar; the fee headline sits below the
pocket dots and the panel drops its "Fee: $X short" note while it shows; no PROMOTED toast over the report. Shorter
text: "NEW: the GOLD BALL. Worth ×10. Dimples watches.", "Your gear is caked. Hose your boots.", and on day 5 with
stamps and fee in hand "Tomorrow: sign at the bell for the Club."

## Council round 8 build

**#1 The Glow Rush (builder 1).** At Tiered a glow ball resting in a cup counts 2 towards the cup count and Bay
Utilization (`RUSH = { GLOW_CUP: 2, VENUE: 2 }`, `cupWeight(b, venue)` in `web/js/tiered.js`; `recount` in
`tiered.mjs` uses it). Glow balls only spawn in Last Call, so this is Last Call's rule with no clock check; a TARGET
still banks real balls, and from the Stadium on a glow ball counts 1. The flags show the doubled count. The rally reads
Tiered's gauge 0.5 ahead (`RALLY_MARGIN[2]`), so the bowls job is dealt almost every bell: "Glow rush! Cups fill
double. Shoot late!"; the miss line is "Missed: the glow rush filled the bowls." Real rule, 4P late gear (`tiered4.mjs`):
nobody shooting 0.00; one TARGET at T-50 passes 2 of 6 seeds, T-30 5 of 6, T-15 6 of 6 (0.53-0.93); solo T-15 6 of 6.

**dealJobs: a new job is never dealt to nobody (builder 1).** When every Rat keeps its line at the 30 s re-check and a
new job opens (the gauge going short), the nearest Rat on a doubled-up job takes it (the lowest-ranked such job), else
the holder of the lowest-ranked job, if the new job outranks it. A new job below every held one stays undealt, as in a
fresh deal with more jobs than Rats.

**#5 Liability escalates (builder 1).** The k-th fall of a shift costs `DECK.FINE` x BV x min(2^(k-1), `FINE_CAP` 4):
50, 100, 200, 200 x BV (`fineFor(bv, k)`). `st.falls` resets each morning; the `deckFall` event carries `k`. From the
2nd fall everyone, the cook too, gets the feed line "Liability: -$16,400 (2nd fall today)." (views/deck.js); the PA card
stays once-ever. Real rule (`deck3.mjs`, 4P, seeds 1-3): careful 0 falls, +47-54%; greedy 2 falls (50 + 100 x BV),
+10-11%; reckless 13 falls, -93 to -94% (the cash floor caps the later fines).

**#6 The small pack (builder 1).** The marker's beam is cut (`AIM.BEAM_*` gone; one draw call less at a crew bay; the
disc stays). "Saved by a TARGET": in Last Call at Tiered, a TARGET that lifts Bay Utilization from under 0.5 to 0.5 or
over records `saved = { by, name, left }` in the tiered module (a later save replaces it, a dip under 0.5 at the
next quarter-second recount clears it). It rides the module snapshot until the next morning, and the tiered
view's report lines show "Saved by Cy's TARGET at 0:12." on a stamped bell (`savedLine` in `tiered.js`).

**#2 · Gary goes further (builder 2).** No stop is ever dealt twice at Gary's warning: `dealGary` pairs one Rat per
failing stop, nearest first, and every extra Rat gets `gary:stall` ("Stall Gary: ping his cart!") while anything
fails, else `gary:meet` ("All clean. Meet Gary at the stand!"; `meet`, because `gary:stand` is already the
hose-the-stand line). A Rat whose stop goes Spotless takes the next unheld failing stop (`redealGary`), else stall/meet.
At his first stop the stop lines clear as before, but stall/meet lines stay up through the whole drive (stall while a
stop still ahead fails, else meet) until the verdict. The stall: while he drives, a crew ball (`b.by`) on his cart adds
`GARY.STALL` 3 s to `g.pause`, at most `GARY.STALLS` 3 a visit (`g.stalls`); the `enthusiasm` event carries
`stall: 1..3`. The shooter's toast is "Gary stalled! He's taking notes." (`GARY_STALLED`), others get a feed line, and
his arm comes up as a clipboard for the 3 s. The Board's count includes it via `garyEta`. Nothing checks who did what;
the verdict is unchanged by stalls. Tests: `test/garystall.test.mjs`, `dealt`, `playtest3a`, `words`.

**#4 · Everyone up the Lift (builder 2).** The platform crank is gone: the `orbpump` input is swallowed, `st.pump`,
`crankGain`/`maxGain`, the snapshot's `p` and the "Tap Ⓐ to crank their oxygen" prompt are removed. EVA air is the
dive tier's tank (it never ran short); the pond's buddy pump is untouched. The venue-5 sky line is "Debris overhead.
Everyone up the Lift!", dealt to every Rat (one job). `sky.mjs` on the real rule: 4 riders (2 twin + 2 mask) 16 s,
four masks 27 s, 2P masks 35 s, solo 62 s. Tests: `orbit` (orbpump ignored, four ride at once), `ending` (four on
masks clear the sky, Ball No. 1 falls).

**#3 · Endless: race yesterday, own the paint, earn the projects (builder 3).** Every endless bell (not the ending's
shift, never a review day) writes `records.yesterday = { cash, curve }` and `records.streak` (+1 on a beat, else 0;
`owner.js raceYesterday`, the record standing in before there is a yesterday). The snapshot's `pace` races
`yesterdayPace(records)`: `record` is yesterday's cash, `vs: 'yesterday'|'record'`, `best` the all-time record. The
endless Board reads YESTERDAY $X with a small BEST $Y under it (RECORD on an old save). The report's headline in
endless is `streakLine`: "Beat yesterday · 4 in a row." / "Beat yesterday." / "Short of yesterday by $2.1M." (the
"Record shift!" note and PA stay). Ball No. 1 sets `up.owner` to 1 (the colours are the deed); an endless save with 0
lifts on load; tier 1 costs 0 with "Site 12 is yours. It's in your colours now." The Owner's Hustle is $120M, the statue
$300M (×2.2 at 4P). `endless.mjs` on the real rule (`council8/endless-real.mjs`): beat yesterday 4/9 idle, 5/9 with
varying effort, max streak 3; 4P Hustle after 1 shift, statue after 8; solo 2 and 9. Tests: `owner`.

## Owner notes (stations, tips, mats, spray)

- **Stations appear when they matter.** The ball washer (machine, sign, handles, chute, props, UNWASHED board, its contact shadow and worn dirt) is not in the world until the crew owns the Ball washer row; the snack shed (and the Club's KITCHEN board) not until it opens. A mid-game purchase pops it in (a 0.7 s overshoot scale) with a confetti puff. `web/js/stations.js` toggles `.visible` only on a change; props.js drives it. The "boarded up" prompt no longer shows for a shed that isn't there.
- **First-time tips for new things** (settings.js, 8 words or fewer, keyboard and pad): a muddy mat near you or one a customer refuses (`mud`), the washer (`crank`, now also on purchase), the shed, the cart, dive gear (`dive`, also on purchase), the pond tube, the gutters and the Lift. `web/js/tips.js` builds their context and points the day-1 yellow arrow at the thing for 10 s. Fixed on the way: the hinter's `venue/pad/show` had slipped into a code comment, so every hint was marked seen and never shown.
- **Mats.** Mud is a generated field (splotches, footprints, smears; `web/js/mud.js`) drawn in each mat's own shader, shown where the mat's mud is above a per-texel threshold, so it breaks up and washes off in patches. Where your spray lands a tiny per-mat memory makes streaks wash first; the mat goes dark and glints while wet, splashes bounce off it, and a sparkle marks it clean. Overlay on every tier (no new draw calls); streaks, wet sheen and splashes are off on Low.
- **Spray from the nozzle.** Droplets, mist and the jet cone leave the wand's `nozzleTip` and fly to where the crosshair lands. Crewmates' spray now shows too, from their wand's nozzle, while the server says they're washing (`players[].spray`).

## End of the day: the walk-off

Owner note: "a smoother end of the day... zoom out overhead to see how many balls we missed, or watch the people walk away." Both, as one ~5.5 s beat between the bell's stamp and the report card (`web/js/dusk.js` rules, `web/js/duskview.js` drawing, `test/dusk.test.mjs`). After the stamp's 2 s hold the camera lifts out of first person (3 s, cubic ease in-out, the height leading so it clears the nets) to a high three-quarter view (y 105, behind the stand, looking down the range). Your own body stays where you stood, then follows the crew. Every ball still out there (not picked, not sunk in the pond, not Ball No. 1) glows: one additive Points, one draw call; High pulses up to 1500, Low/Xbox shows up to 500 without the pulse (detail.js tier). The count sits on the top edge ("142 left out there"), not in the centre, because say() owns the centre and the bell lock drops toasts. Every Rat in view and every hired teenager turns and walks through the gate (scenery.js ENTRANCE) to the car park, as stand-in figures. The real avatars are only hidden, never moved, so the next clock-in has nothing stale to undo. The view holds behind the report card and resets at the next shift. Any key, click or fresh pad press skips straight to the card. Reduce Motion: no camera move, a 2.2 s dim and the count. The ending's own finale and a rejoin into the report skip it; endless runs it (no stamp, so it starts at the bell). A timer opens the card on time even when rAF stalls.

## Playthrough 4 fixes

From design/playtest-round4.md, the three testers' Findings (tests: test/playtest4.test.mjs, plus updated dealt, garystall and round2 tests).

- **Ball No. 1 and a full pocket (C1).** `act()` asks `actpick.js` first: Ball No. 1 in reach is grabbed before the "Full" check (it rides outside the pocket; the server already allowed it).
- **A held bell with the sky still up (C2)** reports "Tomorrow: clear the sky. Ball No. 1 waits."
- **One centre text in the finale and the first endless morning (C3, C4).** The last PA card waits for the `$∞ / BALL` digits to fade (`ending.finale(stats, afterFlash)`), then queues through say(). The endless PA now plays at the reveal and is the morning's one text, with no "Under New Management." memo card on top: "Under New Management. Approved by nobody." It no longer says "Balls Outstanding: one".
- **The dusk overhead (C5, C7).** The Orbital view hides the Lift tower and its lights while the dusk camera is up (`ctx.dusking`), and the "N left out there" label never draws over an open report or end card.
- **"Walk it home" (C6)** leaves once the huddle banner is up (`say.forget('one')`).
- **The report (B8, A20).** On a gauge miss the BV figure is green when BV itself passed, and the gauge row carries the red. The unwashed row reads "Unwashed at the bell: N (missed washer bonus $X)".
- **The entrance arch (B9)** names the current venue (Range Rats LLC in endless). It is repainted with the road sign and shrinks long names to fit.
- **Mud (B10).** Above 0.55 the mud spreads into the gaps between the splotches (`mudSpread`, mirrored in the shader), so a mat at 0.8 is about 90% covered. It still washes off in patches. The spray's impact mist is a thin ring blown outward, so the patch shows through it.
- **A live "SAVED!" (B11).** A Last Call TARGET that lifts Tiered's gauge over the line sends `tieredsave`. Its toast replaces the shooter's TARGET toast.
- **Gary's lines are true for the whole visit (A12–A14, A17).** A ping while he's parked in the warning stalls him (the notes bank up for the drive, 3 a visit in all). A stop line clears only once he has inspected that stop. A Rat's stall/meet line switches only after the other has been wanted for 3 s (`GARY_LINE_HOLD`), and "meet" is shown only when nobody holds a stop line. The ALERTs read "Gary's coming: clean up, then huddle." and, with stall lines up, "Gary's driving. Ping him or huddle."
- **Tips (A15, A16, A19).** The hinter's gate is `tipsAllowed` (tips.js): a finished checklist on a carried-over day no longer silences tips. A purchase's tip jumps the queue and the gap (`hinter.bought`, `BOUGHT_HINT`), and the buy toast is 1.4 s, so the tip lands about 3 s later with its arrow. The shop, sprint and bv tips are 8 words or fewer and show only on the Muni's days 1–2. A purchase makes one toast ("You bought: X"; the checklist's "Bought!" is dropped).
- **Solo Gary (A18).** Solo, the warning is 60 s and he inspects only the two muddiest mats in play, named when the warning starts (`gary.mats`).

## Layout: the ball return, the washer and the bank

Owner note: "the ball return closer to the range, then the balls are returned to the bank/tube thing. Then when we buy the ball washer the washer is between the return and the bank tube thing. Then customers get the balls from a basket by the machine."

**Decision (the fun, easy reading for a casual crew of 4): one physical chain you can see, and one place to bank.** You drop balls at the **ball return**, a bin at the yard edge by the mat line (`SIM.STAND` 27, 1.8, just past the right crew bay). A clear pipe runs from its back to the **bank**: the Board and its glass silo, which stay where the old stand was (`BANK` 26, 6; the silo is `SILO`). Every bank (Rats, teenagers, drones, the cart, the pond tube) sends a few balls rolling down the pipe. Before the washer is bought the pipe runs straight to the silo; once the crew owns the Ball washer row it pops in **on the pipe** (`WASHER` 27.5, 3.8, a handle either side of the pipe), the pipe climbs into its hopper, and its chute carries the washed balls on to the silo: return → washer → bank. The rules (muddy price now, the premium in the hopper until cranked) are unchanged. Why the return and not a bigger walk: Rats come back off the field, so the bank point now sits on their way in instead of 6 m into the yard, and the cart unloads by driving up from the field.

- **"The stand" means the return.** The code keeps its names (`SIM.STAND`, `atStand`, the `stand` Curb Appeal fixture, the `gary:stand` hose line) so the venue seam is untouched, but every line players read says "the return" or "the ball return" (the stencil, toasts, prompts, tips, nudges, the rally, Ball No. 1's banner, the shop blurbs). The huddle ring (Gary's and the Last Bucket's, `HUDDLE_R` 8) is round the return. Gary still pulls up behind the Board (his stop is unchanged, 8.3 m from the return, outside the ring), so he looks at the crew over the Board, and his GARY 3 · 2 · 1 timing is the same. The Board reads from the return (signs.js `standFront` is in front of it).
- **Customers** walk gate → the basket by the red BUCKETS dispenser → their mat (`layout.js BASKET_POINT`; the paved path now ends there). The basket is a wire basket heaped with balls and a stack of blue buckets. They face the machine while they grab.
- **Positions kept:** Rats still clock in at (23, 2) (`SIM.SPAWN`); teenagers wait beside the return on the field side. The cart park, the wash pad, the shed, the Upper Deck, the Jumbotron, the CCTV masts and the day-1 arrow targets are clear (the arrow's "bank" target follows `SIM.STAND`). A cart on the wash pad is now within unloading reach, so washing the cart also banks its load.
- **Cost:** the pipe is one draw call (the straight and the riser pipes swap visibility), the rolling balls one InstancedMesh hidden when idle (pool from detail.js `pipeBalls`: 24 High, 8 Low), the basket one merged mesh.
- **Files:** `web/js/layout.js` (the numbers, unit-tested in `test/layout.test.mjs`), `web/js/ballreturn.js` (the pipe, rolling balls and basket), sim.js, washer.js, stations.js, signs.js, customers.js, scenery.js, props.js, main.js, round2.js, crew.mjs and the line files.
- **Goldens:** `test/seam.test.mjs`'s whole-crew fingerprints were re-recorded, one cause each, checked by putting each change back: the Muni run moves only with the customers' walk to the basket (a longer walk shifts their timing), the Club run only with the bank point (its two teenagers bank at the return). With both put back the old fingerprints come out exactly.

## Owner playtest 3 build

**Builder 4, §7.1 spray on RT.** While you hold the wand, RT sprays (on above 0.35, off below 0.2: `padbind.js padBindings`); on a pad Ⓐ with the wand picks up a ball in reach and sprays otherwise (`wandA`). The mouse is unchanged. RT never sprays while driving (the throttle) or in the CCTV (the zoom); `canSwing` gains `!me.wand`, so RT at a bay with the wand is never the power swing. The pad prompt is "RT spray · Ⓐ pick up · Ⓧ put it back" for 3 s, then "RT spray"; the day-1 checklist reads "Spray the sign · hold RT" on a pad. (`board()` dropping the wand is in crew.mjs, with §6.)

**Builder 4, §7.2 sprint on L3.** `pad.pressed[BTN.LS]` sets the sprint (it lasts until you stop or run out); R3 is free. The store hint reads "click L sprint" and the pad tip "Click the left stick to sprint. Costs stamina." pad.js's stale power-swing comment is fixed (swing.js reads RT only).

**Builder 4, §7.3 every card on a pad.** New pure `menufocus.js`: a card that becomes the menu root focuses its primary (`data-primary` on Open the range, Next / Ready, Back to work, the first settings slider; the shop's first affordable Buy); Ⓐ with nothing focused only focuses the primary; Ⓐ is ignored for 0.5 s after a card opens (a Ⓐ mashed at the bell can't press Next); a re-rendered shop refocuses the same Buy, else the next one along, else nothing (never Next). The report's Ready countdown now only rewrites #next's text (`readyIn` left the re-render key) and a rebuilt panel refocuses the Sign button by id. Ⓑ closes the shop, settings → pause, pause → game; Ⓨ toggles Ready on the report with 2+ Rats; the shop opens on D-pad ↑ only and closes on Ⓑ or ↑ at the top of its list (View is dropped everywhere). The pointer lock is released only when the last input was the mouse/keyboard and the canvas holds it, and never re-requested after a pad close. The game never calls exitFullscreen (test/pad.test.mjs scans web/js). `?padlog` (padlog.js) prints pad buttons, the menu root, the focus, full screen and pointer lock on every change.

**Builder 4, §7.4 the cart engine.** sfx.js `cartEngine`: two detuned square waves an octave apart at 70 → 160 Hz, a lowpass 400 → 900 Hz (Q 0.7), a tanh WaveShaper (drive 1.5), a 12 → 28 Hz putt tremolo (depth 0.25), tyre noise band-passed at 250 Hz, every parameter gliding at 0.25 s, gain 0.012 + 0.028 × speed. main.js passes speed ÷ the base cart speed, clamped, so turbo never raises the pitch (`engineParams` is tested in audiomix).

**Builder 1, §1.1 the Board.** One big price, "$2.62 A BALL" under EACH BALL PAYS (BV × Hustle × Gary's Seal), with the green ×HUSTLE chip and a gold ×GARY chip under it. One bar replaces the old TARGET bar: CLEAN at the Muni, UPKEEP from the Club, filled to (Upkeep − 1) / (ceiling − 1) and printed as a whole %, with a red tick and "TARGET 60%" at q / (ceiling − 1) (Muni days 2–4 60%, day 5 70%, day 6+ 80%; the Club 35, 40, 45, 50, then +2.5 a day). The round-6 crossing flash lights this bar. Under it the why line ("Clean grounds pay up to +50%" / "Each gauge pays up to +50%") and, at the Muni and the Club, one pip per fixture in play (SIGN, RETURN, then the open mats; green ≤ 0.34, amber ≤ 0.6, brown above). CURB APPEAL reads GROUNDS. The redraw key carries the price, the bar's %, the tick's % and the pip colours, so the canvas redraws only on a change. Every word and number comes from the pure `web/js/bvtext.js`; the snapshot gained `nMats`, `garyToday` and `seal` for it.

**Builder 1, §1.2 the HUD, memo, hint and report.** HUD: "$2.62 a ball · 62% clean · need 60%" (`bvLine`); the gear part of `round2.js hudLine` is gone. The memo is "Today: 60% clean by the bell." (a Gary day: "Gary visits today. 60% clean by the bell."), and the memo event's `target` is that whole %. Day-2 hint: "A ball pays more the cleaner it is." The report row reads "QUOTA HIT · Clean 64% · needed 60%" (the quota event carries `clean`, `need` and `venue`; `reviewPcts` never prints a miss as 60% / 60%). The review is judged on Upkeep (`upkeepMet`, also the rally's `upkeepOk`) with the half-cent slack the old BV / Rate check had, so the fold moves no stamp.

**Builder 1, §1.3 the floats.** A fixture hosed Spotless floats "+$0.05 a ball" over it for the hoser (`spotless.gain`, from the mud the hosing run began at: `crew.washFrom`). Your bank popup reads "8 × $2.62", with "+ wash" in the washer's blue and "· muddy boots" when grimy (`board.floatText` takes coloured segments).

**Builder 1, §1.4 the one price.** `SIM.CLEAN_KIT` 1.25 is in the Rate; `gearGrimeFactor` = 1 − 0.2 × grime / 3 and `cartGearOf` = 1 − 0.2 × mud. A clean Rat or cart pays exactly the Board (BV now rounds to cents on the ×1.25 rate, so a bank can differ from before by a cent); helpers, drones, the night crew, gutters and the tether pay +25%. Anything priced "× BV" (deck fines and tabs, finder fees, Ball No. 1) rises 25% with it. The cart's Spotless toast: "Spotless! The cart pays full price again."

**Builder 1, §6.4 the Seal's display.** The Board's gold ×GARY chip reads the snapshot's `seal` (else `value.seal`), the big price includes it, and the report gains "Gary's Seal: +$1,240" from `report.sealCash`. The banner reads GARY VISITS TODAY on a Gary day (`crew.garyToday()`, which follows builder 4's `garyDay` when present) until his warning takes over.

**§4 The early game: "Open every bay" (builder 3).** A crew row, `bays` ($40 base, from Muni day 2, `maxCrew: 3` so it hides at 4+ Rats, where every mat is open anyway). `activeMats(players, up)` puts all ten mats in play when `up.bays` is owned. Main-session call over the spec: it carries over to every venue, so a solo or small crew keeps its bays after promotion (the row stays listed, owned or buyable, at every venue for 1–3 Rats). Real rule, first two minutes of a Muni shift (mats at 0.3, nobody hosing or filling): 4P 74.6 balls a minute, solo 44.1, solo with every bay 74.6. The ladder bot on the real rule (seeds 7, 11, 23): solo reaches the Club after day 5 (spend) / 4 (save), 2P 5 / 4, 4P 5 / 4; with the bays carried over, solo and 2P reach Tiered 3 shifts after the Club. Tests: `test/shop.test.mjs`, `test/shop3.test.mjs`.

**§5.1 The pressure washer row (builder 3).** `wand`, right after the ball washer: Fan nozzle (Muni day 2, $40, cleans ×1.5), Turbo nozzle (Muni day 4, $150, ×2 and 9 m, moved from Club amenities), Foam cannon (Tiered, $20,000: every fixture within `WASH.FOAM_R` 2 m of the spray line, out to the reach, is cleaned at the same time, `crew.foamCone`). `perks.turbo` became `washRate` / `washReach` / `foam` / `truck`. A tier can carry its own Muni `minDay` (`tierLock`; the shop shows "🔒 Day 4"). The power-washing truck is not in the shop yet (a later build). Club amenities keep one tier, Covered bays ("Mats scuff half as fast. The members approve."). Saves before v4 migrate: amen 1 → wand 2, amen 2 → wand 2 + amen 1. The save is v4.

**§5.2 Crew carrying gear and crew shoes (builder 3).** Carrying gear is a crew row (`up.gear`, "Crew carrying gear", $20 / $75 / $250 × the crew scale: $759 at 4P instead of $1,380). One buy lifts every Rat and late joiners; `p.gear` stays on the wire as a copy. From the Club `up.gear` is at least 2 (the old New Hire Kit's bucket as a floor); the Muni's free tube for late joiners is gone, and so is the `kit` event. An old save's gear by name lifts the crew to the best anyone had (nobody loses gear); `gearByName` is read for that migration only. Shoes keep their crew row, renamed "Crew shoes". Dive gear stays personal.

**§5.3 The cart carries half (builder 3).** `cartCap` is 150 / 300 / 300. At the return the hopper tips for `CART.UNLOAD_SECS` 1.5 s (a `tip` event, `tip` on the cart's wire while it lasts, no scooping meanwhile), then the bank lands; the bell still banks at once. The jackpot clamps at the cap and leaves the rest on the ground. On the real rule the 4P ladder goes Club → Stadium in 6 shifts, the same as before the change (HEAD: 6).

**§2 The end of the day (builder 2).** `LAST_CALL` is 90 s at ×3 and `CLEANUP` 60: from T−90 customers hit glow balls three times as often; at T−60 (`crew.closing()`) every customer finishes the ball in the air and walks out on the 'closed' route, no customer ball is launched and the mats stop scuffing. A shift shorter than LAST_CALL + CLEANUP (a dev override) has no cleanup minute; day 1 has neither. The rally moved with Last Call (`rallyAt` defaults to `LAST_CALL.SECS`; the Stadium still warns at T−120). The 30 s re-check is now the cleanup deal at T−60: Upkeep margin 0 (nothing scuffs after it) and, over `RALLY_PICK` 30 balls out there, "Grab the last balls!" (`pick`, dealt last, or to everyone when on target). Tiered stores `kpiAtClose` at T−60 and the review reads it ("the last customer out reads the bowls"; snapshot `judged`); its lines are "Glow rush! Shoot before they leave!" and "Missed: the bowls were full at 1:00.", and a save only counts before 1:00. From 1:00 the walk-off's "N left out there" shows live on the top edge (`duskview.js`; snapshot `closing`, `left`). Real rule (council 9's `endday.mjs`, basket kept stocked): Tiered 4P with a TARGET at 1:05 passes 6/6, at 1:15 3/6, at 0:50 or none 0/6 (N5 exactly); Muni day 5 4P idle 767 balls (138 glow), none after T−60. The padlock on the Board's purple bar is builder 1's (`mods.tiered.judged`).

**§3.1 Mats overnight (builder 2).** `morningMud` keeps each mat's mud capped at `MAT_NIGHT_CAP` 0.6; the sign (0.9) and the return (0.5) still get theirs; the 5 random 0.95 mats are gone, and covered bays no longer skip it (they halve the scuffing). The save carries `fixtures` (optional); an old save without it opens with clean mats. Day 1 still starts clean.

**§3.2 Customers pick a clean mat (builder 2).** `customers.js pickMat`: an arrival picks among the free open mats (no incoming customer, free or about to be) weighted 1 − mud, a mat at ≥ 0.9 weighing 0. With no clean free mat, a muddy trigger calls nobody while any open mat is clean (busy): the muddy bay stays empty, which you can see from the return. Only when every open mat is that muddy does the customer head for it and wait (the 25 s refusal, as before). This spec said "the supply is unchanged"; a muddy bay that kept calling would fill last and refuse anyway, so it now costs its share of customers instead, which is the bite.

**§3.3 The bucket basket (builder 2).** New pure `basket.js`. The basket starts every morning empty and holds `BUCKETS.BASKET` 12, drawn as one InstancedMesh of 12 blue buckets beside it (`layout.js BASKET_SLOTS`, +1 draw call), with chute balls from the pipe-ball pool while someone fills. A Rat at `FILL_POINT` (1.2 m east of the dispenser) holds Use (`{t:'fill', on}`): a bucket every 1.5 s, two chutes, a third gets `fillbusy`; prompts "Hold Ⓐ: fill a bucket", "Basket n/12" while filling, "Basket full", "Both chutes busy". A customer reaching an empty basket waits there 25 s (arms crossed, `inc.wb`), then leaves (`refuse`, `why: 'nobucket'`, feed "No buckets. A customer left."); early birds bring their own. The Bucket machine (`up.bucket`, Club) adds one every 10 s. Day 1's training basket is bottomless (the checklist doesn't teach it). Snapshot `basket`, `filling`, `filled`. Real rule (`buckets.mjs`, Muni day 5): the first basket bucket is needed at 100 s (4P, no ads) / 69 s (ads 2); demand peaks at 4.2 a minute (no ads) and 6.0 (ads 2); a crew that never fills loses 47 customers a shift at 4P (28 solo) and banks 200 balls instead of 491.

**§3.4 The morning deal (builder 2).** New pure `morning.js`, dealt from `server/venues/nudge.mjs` every morning from day 2 at every venue (day 1's checklist first): each online Rat one line from what is short, nearest (Rat, job) pair first, more Rats going round again; it clears when done or 45 s of working time after NUDGE.WAIT. The pool: "Fill the bucket basket!", the sign, the return, "Keep the mats clean." (a mat over 0.3); the Club adds "Fries went cold. Peel!" and "The pond's full. Dive!"; Tiered "The deck's open. Pour the first round!"; the Stadium "Crowd's cold. Lap the Ping Track!", the County "Strays in the Yards. Sweep them!", the Orbital "Debris overnight. Ride the Lift!". Nudge ids `am:<job>` (nudge.js `nudgeLine` / `nudgeTarget` read them). On Muni day 2 the day-2 suggestion follows once a Rat's morning line clears.

**Builder 4, §6.1 introduce Gary.** At 0:20 on Muni day 4, once ever, Gary's white cart rolls in at the gate, loops past the return (lifting his clipboard at the crew), and drives out (`garyvisit.js` `GARY_INTRO`, stepped by crew.mjs `stepGaryIntro`, wired as `garyIntro`), with the once-ever PA card "Gary. Regional Manager. He has a clipboard." (`PA_LINES.garyIntro`). His nameplate is a world sprite: "GARY · REGIONAL MANAGER" on Muni day 4, "GARY" after. The day-3 tomorrow line is "Tomorrow: Gary from Regional. Clean, then huddle." He now shows at the gate through his warning too.

**Builder 4, §6.2 the schedule.** `crew.garyDay` (saved) is the next visit: Muni day 4, then `garyNext`: 2 days later, or 3 with a 1-in-3 chance, drawn from the crew seed and the day on its own stream (so the shift rng and the goldens are untouched). Each morning `garyMorning` brings a missed visit to today and slips one on a promotion's reveal morning a day; an old save without it gets today (from day 4). The memo, the Board banner (builder 1, via `garyToday()`) and the eve line "Tomorrow: Gary visits. Clean, then huddle." follow it. A pass with the full huddle earns 3 commendations, without 1 (`commendFor`, cap 10). The Orbital still gets visits on schedule; endless none.

**Builder 4, §6.3 chatting.** Hold Ⓐ / Click / Space within 2.5 m of Gary while he sits at a stop: his pause holds (`stepChat`), out of a 12 s budget a visit shared with cart pings (`pingStall`: a ping after 10 s of chat adds 2 s). It ends on letting go, walking off, a knockdown, the budget, or him moving off; then he waits 1 s, and never runs over a Rat he talked to (`g.spare`). Prompt "Hold Ⓐ: chat to Gary", a world bubble cycling his three-word bits every 2 s then "Right, then.", and the chatter's feed line "You asked Gary about his boat.". The dealt stall line reads "Keep Gary talking: hold Ⓐ!" while he's parked (`garyExtra`, client-side, so the server still deals `gary:stall`). Departure from the spec: the warning does not count as parked, because he waits at the gate past the fence, about 5 m from the nearest spot a Rat can stand; pings still stall him there. The sign stop is also out of reach (z clamps at 9); the mats, cart and return stops are reachable.

**Builder 4, §6.4 Gary's Seal.** A pass (≤ 1 failed stop) with every online Rat in the ring sets `crew.seal = 1.25` until the bell (reset each morning): `valueNow()` carries `seal` while sealed, `bank()` pays gear × seal (past the Hustle cap, Upkeep untouched), and `stats.sealCash` adds up the extra for builder 1's report row. The verdict event carries `seal` and its ALERT is "Gary approves! ×1.25 a ball till the bell." (replacing the verdict line). Climbing into a cart puts the wand back (`board()`, §7.1).

**Builder 4, the folded overnight shop (owner request).** The report's and the lobby's shop now sit collapsed behind a Shop button beside Next / Open the range (`setShopOpen` in main.js, `.shop.collapsed` in index.html). The card opens on Ready / Next with the shop folded; Ⓐ on Shop opens it, again or Ⓑ folds it (focus returns to the button). The in-shift store (Tab / D-pad ↑) is unchanged. Builder 3's hand-offs: the spray reach reads `perks.washReach` (7 m, 9 m turbo), the foam cannon sprays a wide white cone (main.js droplets, props.js cone ×2.4), and the cart's hopper hangs on a hinge and tips over the 1.5 s `cart.tip`.

## Council round 10 build

**Builder 3, the sim.js constants.** `FED = { GOOD 0.05, PERFECT 0.10, MAX 1.25, DECAY 0.05, EVERY 20 }`; `VENUE_RULES[1–5].eatEvery` 8; `UPPER_BAYS` 6 and `activeUpper(N, up) = min(6, 2N)` (all 6 with "Open every bay"); the late fees ×1.5 (Stadium $600k, County $3M, Orbital $15M); the `returns` crew row (the Field return $150, Muni day 3; the Back return $1,500, Club) as `perks.returns`; the cart row's Autopilot tier ($250k, Stadium, `perks.autopilot`; the one tier cheaper than the one before it, on purpose); `CREEK_DIVE` (dive.js, re-exported by sim.js); the shed blurb "Reopens the shed. Fries raise what every ball pays."

**Builder 3, #2 food that pays.** A hot dog adds no fry baskets (`FRIES_YIELD.hotdog` 0); it FEDs the crew instead (`web/js/food.js`, pure): good +0.05, perfect +0.10, ×1.25 cap, −0.05 every 20 s of working time (the cleanup minute counts), reset each morning; Gary's dog gives none. `crew.fedSt`; `valueNow().fed` while fed; `bank()` pays × fed like the Seal (Upkeep never sees it); `stats.fedCash` (the report's "Hot dogs: +$X") and `stats.dogs`; the snapshot's `fedRing` (0..1 to the next loss) for the Board chip. The kitchen's cards print the live payoff (`menuPayoff`): "+$1.41 A BALL" (a 3-basket serve, limited by the room left in the fryer), "+5% EVERY BALL", "$N TAB" (`tabFor` on the open order). The `served` event carries `float` ("+$1.41 a ball", "+10% a ball") for a world-text float over the shed. The Club's dusk (`rally.js clubDuskJobs`): on target, the rally deals "Fries for the bell!" (fryer under half), "Glow in the creek! Dive!" (5+ glow snags, dealt at their centroid), "Grab the last balls!" (30+) and any short fixture's hose line; "On target. Hold it till the bell." only when none applies. Measured (`food.mjs` on the real rule, 4P, seeds 1–4): Club peeler, a cook on fries $35,181 vs $27,988 picking (fryer 83%); Club conveyor, a cook on dogs $44,846 vs $36,327 (FED ×1.22 mean); Tiered conveyor dogs +26% (with builder 2's upper bays in).

**Builder 3, #5 the creek dive.** `web/js/creekdive.js` (pure): 2 s in running creek water (`map.inCreekWater`, off the bridges) ducks you under (`creekStep`), walking out of the channel (`inCreekChannel`, bridges included) surfaces you, the in-branch hands you to the pond dive; `applyCurrent` is the 0.8 m/s current for the client's own movement; `bankSpot` is where a gasp lands you. crew.mjs: `p.creekDiving` rides on `p.diving` (one dive state for pond and creek); air drains ×0.5 with no pump; a creek gasp spills the bag back onto the bed (`snagNew`) and pops you up on the bank. Snags (`map.js`): from the Club, 1 in 3 range balls and every gold and glow ball snag at `s* = s0 + hash(id) × (end − s0)` (`snagS`), rest on the bed at `CREEK_DIVE.BED` (`snagSpot`), `b.creek` (never `sunk`, never cupped, never picked on foot, by cart, teenager, drone or MOW-E), and glint in the torch (`pickGlints`); the drift event carries `snag`, and a `snag` event places it; `SNAG.ON = 0` restores the old Club golden (re-recorded `dc37044f`, was `a1dfbc50`). The trophy (`TREASURE[1]`) lies under the Cart Bridge (`treasureSpotFor`). `terrain.js` gains the trench (bed + two walls, one mesh) and DoubleSide water, plus `setFlags(on)` for Tiered's one-flag greens; `scuba.tick` takes `creek` (clear teal, 9 m fog); the creek tip fires near the water from the Club. Measured (`creek.mjs` on the real rule): 47 snags a Club shift (21.5 glow), 33.5 at Tiered.

**Builder 4, #7 the yard pack (§B, §C).** `mud.js` gained the surface variant: `mudSurface(w, h, seed)` maps a quad's local (u, v) onto the shared field at the mats' texel size, and `surfaceThreshold` / `surfaceAlpha` drop the threshold by `SURF.LOW` (0.18) toward the bottom edge, so a standing surface is muddier low down and washes there last, and is spotless at the server's CLEAN line (`test/mud.test.mjs`). `props.js` lays two decal meshes over what main.js built: one quad pair on the road sign's two faces, and one merged mesh over the return's front face, its hopper lip and the lower half of the pipe's first 3 m (rebuilt if the pipe re-routes through the washer). They use the mats' shader maths with `uMud` = `fixtures.sign` / `fixtures.stand`, are hidden while spotless (+2 draw calls at the yard only), and my jet streaks their clean memory where it lands (Low skips the streaks). The old flat brown tint stays at 0.3 under the decals. The field returns: `layout.js` `FIELD_RETURNS` (the Field return at (10, −62), tier 1; the Back return at (−6, −128), tier 2), `atFieldReturn` and `nearestReturn`; `ballreturn.js` `createFieldReturns` draws the owned ones as one merged mesh (the red FHI box, taller, a RETURN 2 / RETURN 3 plate, the feed mouth, the grey pneumatic pipe elbowing into the ground), +1 draw call, rebuilt only when the tier changes. Ⓧ on foot at one sends your pocket (and any treasure) into the same tube queue as the pond's: `feedTube` takes any owned return, and the THUNK banks at the main return 6 s later through the washer. Teenagers and the cart never use them; drones do (#8). Prompt: "Ⓧ Send them home". `return2.mjs` on the real rule: Muni d4 100 → 41 m mean walk (51% within 30 m); Club vd2 99 → 47 m with the Field return, 28 m with both (67% within 30 m).

**Builder 4, #4 the Deck Cam, client half, and the creek camera.** New pure `web/js/deckcam.js` (`cutPlan`, `skips`, `cutAt`, `shotFor`; `test/deckcam.test.mjs`). On `deckFall` main.js cuts the main camera to (x + 3.5, 1.4, −2.5) looking at (x, 2.2, 1.8) for 2.6 s (1.8 s from the shift's 2nd fall), with DOM letterbox bars (8%) and "DECK CAM · Ⓑ skip" (keyboard: "any key skips") at the bottom-left edge; the next frame puts the camera back. Left out: driving, diving, the Lift/EVA (`views.capturing()`), menus, knocked down, and the new setting "Deck replays: on / off"; the cook gets the 1.8 s cut when they close the kitchen within 5 s. Movement input is ignored during it; any key, click or pad press, or a stick pushed past 0.5 (one already held must come back first), skips it. `ctx.deckCam` lets `views/deck.js` read `on` (to play the drop at ×0.4) and call `bonk()` to cut back on the BONK. say.js gained `hold(secs)`: a queued PA card or memo waits for the cut, and `hold(0)` on skip lets it go. Creek diving: `under = wetPond(me) || creekDiving(me)`, the eye at `CREEK_DIVE.BED + EYE`, fog far 9 m tinted `waterLook(1).fog`, swim speed as in the pond, and builder 3's `creekdive.js applyCurrent` moves you on the client as on the server (`me.creek` from the snapshot; `scuba.tick` gets `creek`; the creek dive goes through the pond's fog save/restore). The pause menu shows the venue's goal card (`goals.js cardHtml`) above its buttons, live while paused.

**Builder 4, one text (main session).** say.js's DOM adapter keeps a set of what is physically up and takes everything else down before anything new shows, and a render that throws no longer leaves a card behind, so a memo never shares the screen with a PA card, or the reverse (`test/say.test.mjs`).

**Builder 4, #8 late automation you play with (§D).** New pure `web/js/autopilot.js`. With the cart row's tier 4 (Autopilot, the Stadium on), every undriven cart drives itself during the shift (`stadium.mjs`): it laps the Ping Track at ×0.6 the cart's speed (× the Track's 1.3), and its laps count at half (+0.03 crowd, `autoLaps`, a `crowd` lap event with `auto: true`). A crew ping on it pays every prize and +0.08 (`crew.mjs ping` accepts `c.auto`). Hold Ⓨ / F 0.6 s at it to switch lap ↔ harvest (a tap still climbs in): harvesting, it drives to the nearest ball it can reach in a straight line (skipping ones past the creek or pond for 12 s), scoops what passes under its reels, and tips at the main return when full. It stops while anyone on foot is within 3.2 m, so you can always climb in. Drone dispatch (`county.mjs`): on foot at the County with drones, hold Ⓨ / F 0.6 s, "Drones, here!": a 20 m zone at you for 30 s, a thin ring on the ground (1 draw call while it lasts); `droneTarget` takes balls in the zone first, then strays, then the nearest, and each drone re-aims once. Drones now bank at the nearest return: at a field return their load goes into the pipe (banked 6 s later as helper balls). Tests: `test/autopilot.test.mjs`, `test/returns.test.mjs`. The power-washing truck was not built this round.

**Builder 1, #1 the goal card.** The review stamps are gone: every venue from the Muni to the County prints one card of five goals (`web/js/goals.js`, pure: `CARDS`, `crewScale`, `printCard`, `rowsOf`, `nextGoal`, `goalLine`, `rewardFor`, `migrateV4`, `cardDone`, plus the strip, headline, tomorrow and deal lines), and the crew signs at the report only when all five are done. The last goal is the live fee (ticks with the cash, un-ticks below it); one is "Hit the daily target N×" (2 at the Muni, 3 from the Club; APPROVED and its 15% bonus are unchanged); the other three are feature goals that pay 50 × BV once each, with one toast ("Goal done! 30 hot dogs. +$1,450") and a ping. Counts are printed on the venue's first morning for the crew online then (solo ×0.4 … 6P ×1.4, rounded up) and never move; treasures (2), the good days and "every Rat rides the Lift" don't scale. `crew.mjs` keeps `this.goals` and `this.reviews` (the quota curve reads `reviews < 3`), counts each goal at its site (`bank`, purchases at `buy`, the review at `endShift`, Gary's huddle / Seal / pass at the verdict) or off the events other code already pushes (`goalScan`: hot dogs served — Gary's counts —, treasures banked, TARGETs, deck orders and rounds, laps, paid pings, debris landed, Lift riders, County strays swept), and `promoInfo().ready` is `cardDone`. While a treasure goal is open the morning's 50% roll always lands (same single RNG draw); while a Gary goal is open after his visit he comes back the next day ("Gary will be back tomorrow."). The Orbital card is the Last Bucket's four steps: Ball No. 1 waits in the 'sky' phase until the Lift, the debris and the tether are done too (the debris goal is met if the sky has nothing left to bring down, and "every Rat" means every Rat still here if the crew shrank). Save v5: `stamps` → `reviews`, `goals` saved; a v4 save migrates to its venue's card (review count `min(N, stamps)`, owned rows tick, counts at 0, Gary and treasure open) and **a v4 save with 3+ stamps is grandfathered** (everything but the live fee done), as is an Orbital save already at Ball No. 1. The ending's quotas line reads total reviews. UI: the Board's goal strip (five pips, "3 OF 5 GOALS", "NEXT: 18 MORE HOT DOGS"; "THE LAST BUCKET 2 OF 4" at the Orbital) takes the left half of BALLS OUTSTANDING; the report's promo panel is the card (rows with a tick or a count and the reward, today's lit), headlined "3 of 5 done · 2 to go" / "Card done! Sign for Tiered."; the tomorrow line reads "Tomorrow: two goals left for Tiered."; the HUD's PROMOTION READY is CARD DONE; the morning deal gives one Rat the jobs leave over "Goal: 12 more hot dogs." (the open feature goal nearest done, `am:goal:<id>:<left>`). DEV_STAMPS 3+ hands a dev crew a done card.

**Builder 1, the Board halves of #2 and "clean" everywhere.** The Board's fry gauge reads FRIES 14/20 (baskets in the fryer), and a FED chip (×1.20, orange, with a thin ring emptying toward the next 5% loss: `state.fed`, `state.fedLeft`) joins Hustle and Gary's Seal down the price's right (three at once sit tighter). `bvtext.js` carries the food's words for the kitchen and the floats (`friesGain`, `friesCard` "FRIES · +$1.41 A BALL", `dogCard`, `beerCard`, `fedFloat`, `tabFloat`, `friesLabel`, `fedRow`), `priceOf` multiplies `v.fed`, and the HUD line gains "· ×1.2 fed". The bar's word is CLEAN at every venue (it was UPKEEP from the Club): the Board, the HUD, the memo and the report row all say "clean". Measured: the 4P ladder bot with the real card as its promotion rule (feature goals it cannot play ticked on venue day 2) starts the Orbital at 127 min, 5/3/3/3/3 shifts (seeds 7/11/23), as today; 2P 134 min (one seed 150, from 7 Tiered shifts).

**Builder 2, #3: six upper bays, and the deck you can see.** From Tiered the Upper Deck's six middle bays (x −10…10, above mats 2–7) seat customers: `crew.mats` indices 10–15 (`customers.js` `UPPER`, `UPPER_MATS`), the same `stepMat` customer with a 3D route up the stairs from x −27.5 (a bucket from the bar at the top of the stairs: no basket, no mud, no scuff, never lead, never an orbit shot). They hit from (x, 3.1, 2.6), under the low rail's bar. `activeUpper(N)` = min(6, 2N) opens bays from the middle out (solo: the two centre bays); "Open every bay" opens all six. No RNG is drawn for them before Tiered, and the wire carries them only from Tiered, so the Muni and the Club goldens are untouched. `CUP_FULL` = 30 + 2 × the upper bays in play (`cupFull`: 42 at 4P, 38 at 2P, 34 solo), sent as `mods.tiered.full` for the flags' red line. The deck's Drinks count is split as `d.mugs[6]` (always summing to Drinks): an order goes to its seat, an unordered beer to the drunkest, food and sobering come off the drunkest, and the drunkest falls (ties round robin from the last faller), leaving their bay at once (`fellOff`, the bay empty 20 s). Crowd figures stand at their y, sway 0.2 × min(1, mugs/3), and spray wider (aim × (1 + 0.15 × mugs)). `views/deck.js` draws the empty steins on each ledge (one InstancedMesh of 36), the beer line (cable from the shed's roof, a pooled mug that zips up in 1.5 s and slides the rail at 20 m/s), the tab float over the seat (world text, gold for an order, red-gold for a round), hiccups at 3+ mugs (not on the low tier), WOOO and the order sign. Measured on the real rule (`upper.mjs` PICK=2, 4P, 6 seeds): 1,686 balls a shift (was ~1,030), income $415k; Bay Utilization at CUP_FULL 42 passes 2/6 with no TARGET, 5/6 with one at T−75, 6/6 at T−65 (`rushShift` in tiered.test: T−65 6/6).

**Builder 2, #4: the Deck Cam's server and view halves.** On a fall, deck.mjs sets `crew.lookUntil` = now + 3 s (Rats on foot can't be knocked down by a ball) and pushes every customer's next swing back 3 s. `views/deck.js` plays the lean at ×1 and the drop at `DECKCAM.SLOW` (×0.4) while `ctx.deckCam.on`, and calls `ctx.deckCam.bonk()` on the BONK; the faller wears the bay customer's look.

**Builder 2, #6: one flag per green, and "on the green".** The Tiered pin stands at the green's centre (where the cup and the landmark flag are) and the Tiered view hides terrain.js's landmark pole and pennant (`setFlags`) while it is up. At the Muni and the Club a crew ball that comes to rest inside a green's `r` is "ON THE GREEN!" (world text over the flag, the pennant waves): Hustle +0.1 under the shared cap, five a shift (`web/js/greens.js`, `server/venues/greens.mjs`); at Tiered the same ball is a TARGET. The landing marker moved to `views/greens.js` and shows at the crew bays at every venue (the green's colour inside a green before Tiered, the TARGET lip from Tiered). First-time tip at a crew bay: "Land a crew ball on a green: Hustle."

## Playthrough 5 fixes

The fix pass for design/playtest-round5.md, in two halves built at once (server and rules; client and screens). Server and rules (`test/playtest5.test.mjs`):

**Clock out early (all three testers).** Once the venue's card is done (`promoInfo().ready`), any Rat can call the bell: the input `{t:'clockout', on}` (held: `on: false` takes the vote back). When every online Rat holds it (solo: at once) the bell rings now through the normal path (review, stamp, report); the event `clockedout {early}` and `report.early` carry the seconds saved. The snapshot's `clockOut` is `{n, of}` while it is allowed (null otherwise) and each player row carries `clockOut: true` while holding. A card that goes undone (a purchase drops the fee) clears the votes.

**A1: no more promotion skip.** Ready never starts the next day while the card is done and the promotion unsigned: it waits for the signatures, or for the crew's explicit `{t:'notyet'}` (any one Rat; snapshot `notYet` at that report; the card stays done, so tomorrow asks again). The old 120 s hold no longer starts the day over an unsigned card: after it, once at least one Rat has signed, the signers carry the promotion (an idle Rat can't stall it); with no signature it keeps waiting.

**C1: Gary and the autopilot cart.** His cart stop picks the cart once at the leg's start and inspects that cart; an autopilot cart he is heading for (or parked at) waits (`garyHolds`), and a cart a Rat keeps driving about is inspected wherever Gary is after 30 s. Every visit reaches a verdict.

**Honest goals.** Autopilot laps don't count toward "Drive N laps" (C2). The Orbital debris goal counts winched pieces too and is never force-ticked; once the sky stops refilling (the Last Bucket is on) its need is capped at what was brought down plus what is still up (and in riders' bags) (C3). The Muni's Gary goal is "Pass Gary with a huddle" (a pass, fails ≤ 1, with the full huddle; solo passes) (A2). The Club's dog-count goal is now "Keep the crew fed for 3 minutes": working seconds with FED up, not scaled (B5; goal id `fed`, kind `secs`, shown as m:ss; an old card's done `hotdogs` carries over as done).

**B1: pour lines.** While a deck order is open and the card's order goal is open, the Rat nearest the kitchen is dealt "Deck order! Pour a beer!" (nudge id `order`). At 2P the morning deal always gives one Rat the card goal ("Goal: 2 more minutes fed.").

**Autopilot.** An autopilot cart rinses at the return (mud → 0 each tip); a lapping one at mud 0.5 drives in to rinse (C5). With autopilot, the second cart starts on the Track half a lap from the first, and a lapping cart's route to the Track swings round the return's stop radius (C6). Each cart's mode (harvest) carries over the night (C9).

**C4: "Drones, here!".** The zone already outranks strays everywhere (pinned by test, by the mats and in a bowl); it is now taught: a one-time tip when drones are bought ("Drones! Hold Ⓨ on foot: "Drones, here!"").

**Small items.** Serving needs a shift (B8); no record PA on the ending shift (C10); at the Muni the daily target holds at day 4's while the review goal is open (A10).

### Playthrough 5 fixes: the client and screens

**Clock out early (the client half).** While the snapshot offers `clockOut`, a small right-edge HUD button reads "Card done · clock out (Ⓨ hold / hold F)". Holding Ⓨ / F away from a cart for 0.6 s sends `{t:'clockout', on:true}` (a stray tap never rings the bell); letting go sends `on:false`. While held it reads "Clocking out · 2 / 4 holding"; other Rats' votes go to the feed. It outranks "Drones, here!" on Ⓨ while offered. A free mouse can hold the button itself.

**A1: Sign first.** On a done, unsigned card the report's primary (and focus) is "Sign the franchise agreement"; Next is disabled and reads "Sign to move up", with a quiet "Not yet: one more day here" (`{t:'notyet'}`) beside Sign that frees it (promopanel.js `nextGate`).

**Text (B3, A9).** A memo and the PA card never share the screen (the say adapter takes the other down whatever its own show/hide did). The Deck Cam sends a PA card or memo already up back to the front of the queue; it shows after the cut. The "left out there" pill steps aside for the bell's stamp, a memo and the cleanup minute's rally line. The prompt is empty outside a shift (no stale "Full" in the walk-off). With the report open a toast sits in the card's top gutter, not over Next. A goal's line is an ALERT queued just after the tick, so it waits behind Gary's verdict.

**The repeat Deck Cam (B4).** The short cut (a repeat, or the cook's) plays the lean ×3 and the drop at 0.65 (the BONK lands at ~1.7 s, inside 1.8 s), from higher and further back (x + 2, 3.4, −4.5) down at (x, 1.6, 1.6): over the bay customers' heads, the drop in the middle of the frame. The first cut is unchanged.

**Labels.** "−$3,800" (B7); DAILY TARGET HIT / MISSED (A4); "Goals for Tiered" (B10); the SERVED card prints the serve's payoff from the server's float, beer its tab (B12); a promotion's report shows the bank after the fee (A6); solo, the huddle banner is just "HOLD SPACE" (C10).

**A5: the empty basket.** When the basket runs dry after holding buckets that shift, an orange beacon blinks on the dispenser and the nearest able Rat is re-dealt "Fill the bucket basket!" (over a morning or goal line, never over Gary's lines).

**Gary (A7).** His sign stop moved to (16.8, 10.6), beside the sign's right post and 1.6 m from the fence, inside the 2.5 m chat reach (at z 13 no Rat could reach him). In chat his bubble drops toward eye level (at most ~29° above level, down to 2.3 m) so it isn't clipped at the top of the screen, and his nameplate hides while it shows.

**Look.** The Last Call floodlights no longer decay with distance: 0.7 each (it was 420 with decay, ~6× the sun on the near grass: the neon lime from 1:30) (A8). The Club's two flags stand 4.6 m out along the Board's width, behind its face, flying outward (B6). The HUD cash is set from every snapshot, so a rejoin shows it at once (B9). A stale code on the title says "That crew has closed. Start a new one?", clears the code and focuses Start a crew.

**The shop.** Maxed rows sort last (endless's Owner rows still first); a row an open buy goal names wears "✦ GOAL".
