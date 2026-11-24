# Range Rat — game design

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
