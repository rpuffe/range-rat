# 🐀 Range Rat

A co-op incremental game set on a golf driving range, for the browser. Pick up
one ball by hand, then work your way up to a fleet of picker carts, and keep
going until the range is absurd. Up to 6 players share one range, and it works
on an Xbox controller in Edge.

Deployed on [flightdeck](./CLAUDE.md): dev at
`https://range-rat-dev.fd.robertpuffe.com`, prod at
`https://range-rat.fd.robertpuffe.com`.

The design lives in [design/game-design.md](design/game-design.md).

## Status

**The shared range works.**
- **Crews:** start one, or join with a 4-letter code. Up to 6 players, who see
  each other with name tags.
- **The shift:** anyone opens the range. Customers hit balls (more crew, more
  customers). Anyone picks up by hand, up to 3 in a pocket, and drops them at
  the bucket stand for the crew's cash.
- **Knockdowns:** a customer's ball knocks a player flat and spills their
  pocket.
- **End of day:** the shift ends in a report for everyone, then anyone starts
  the next day.
- **Saves:** day, cash, totals and upgrades save to S3, so a crew can come
  back to their range.
- **The upgrade shop:** open before the first shift and overnight, with one
  shared wallet:
  - carrying gear: tube, then bucket, then a push picker that scoops up
    whatever you walk over
  - hired helpers, who walk the field and bank balls on their own
  - a ball washer, advertising, shoes, and hard hats

- **The picker cart:** a shared, caged cart anyone can drive, with a chase
  camera. Its gang reels scoop up whatever they roll over, and it unloads
  itself at the bucket stand. The cage keeps the driver safe, and the cart
  runs over anyone in the way.
- **Hit the Cart:** from the orange crew bays, hit the balls you're carrying
  at the cart while someone drives it. A ball that rings the cage pays the
  crew a prize: a jackpot that hoovers up nearby balls, a turbo, or a price
  multiplier for the rest of the day.
- **Sound effects,** made in the browser with no audio files.

- **The story (fun council round 1):** you're Range Rats working for Fairway
  Holdings International, and Corporate pays per ball. The **Board** on the
  stand shows Ball Value (BV = Rate × Upkeep), the KPI dials, today's target,
  Balls Outstanding, and a silo filling with today's balls.
- **Upkeep jobs raise BV:**
  - power-wash the sign, the stand and the mats (Curb Appeal)
  - dive the pond for sunk balls (Pond Clarity)
  - keep the cart clean (×1.25 on its loads)
- **Each day:**
  - a Corporate memo with a quota (from day 2), checked in the review at the bell, where hits earn stamps and titles
  - **Last Call** glow balls (×2) in the final minute, from day 2
  - **Gary from Regional's** inspection (from day 3): clean ahead of his route, then huddle at the stand for double commendations
  - lead balls (×3) that sink into the pond (from day 4)
- **Shop and movement:** the shop opens any time (Tab / D-pad up), you can
  sprint (Shift / click R), and carrying gear is personal.

Next: the potato line (Fry Satisfaction), more ball types, the first promotion.

## Controls

| | Keyboard and mouse | Xbox controller |
| --- | --- | --- |
| Walk | WASD | Left stick |
| Look | Mouse (click to capture), or the arrow keys | Right stick |
| Sprint | Shift | Click the right stick |
| Pick up | Left click or Space | Ⓐ |
| Swing at a crew bay (the real swing, with power) | Hold left click or Space, drag back and flick through | Hold Ⓐ, then pull the right stick back and push through |
| Bucket stand and ball washer (drop balls, grab or stow the wand) | E | Ⓧ |
| Spray the cart (holding the wand) | Hold left click or Space | Hold Ⓐ |
| Get in / out of the cart (a second cart at the Stadium) | F | Ⓨ |
| Drive the cart | W/S throttle, A/D steer | RT/LT throttle, left stick steer |
| Shop (any time; the range keeps going) | Tab | D-pad up |
| CCTV (the security cameras) | C | D-pad down |
| Crank the washer or the dock and Lift air pump | Hold and circle the mouse | Tap Ⓐ at the handle to latch it, then circle either stick; Ⓐ or Ⓑ lets go |
| Pause (Settings, Leave crew) | Esc | ☰ |
| Menus | Tab and Enter | D-pad or left stick, Ⓐ, Ⓑ |

Settings (volumes, PA voice or captions, look sensitivity and invert Y, text
size, reduce motion, Graphics) live behind the pause card and are saved in the
browser. Add `?pace` to the URL to record a per-shift pace log (see below).

## The venues

Promotion (review stamps plus a fee, at the overnight report) moves the crew up
a venue. Each adds a map change, a Board gauge, a chore and a toy; the hub (the
stand, the washer, the shed, the dock) never moves.

| Venue | What it adds |
| --- | --- |
| Muni Range | The start: the pond, the fry shed, the washer, Gary from Regional. |
| Range Club | The kitchen and the Club's second gear; Upkeep matters. |
| Tiered Entertainment Range | Target Greens (cups to empty), Bay Utilization, and the Upper Deck: beer pays a bar tab, six drinks in a row is an incident, a fine, and a lounger falling off. |
| Stadium Range | The Ping Track, Crowd Sentiment, and a second cart to race it. |
| County Range | The Yards (the right net comes down), Zoning Compliance, drones. |
| Orbital Range | The Lift, orbit shots, the EVA to collect Orbital Debris, and the tether winch. |

Per-venue rules, numbers and files: [design/game-design.md](design/game-design.md#round-4-summary).

## The map: Dimple Creek

The range is built around Dimple Creek: the pond (dry ground at the Muni until
the creek runs), the Deep End dock for diving, the bucket stand and the big
Board. The pond's balls sink; the Muni's pond is drained at first.

## Diving and the EVA

Buy dive gear at the shop, then dive the pond from the dock: a buddy cranks the
air pump (latch it on the pad) while you walk the bottom for sunk balls and
treasure. At the Orbital the same system goes to space: ride the Lift, float in
a disc round the car on a tank of air, grab debris and ride it down, with a
buddy cranking the O2. The tether winch automates it.

## Pace log

Add `?pace` to the URL (it works on any crew). At every shift report it
records day, venue, session minutes, cash, balls banked, review stamps, the
KPIs at the bell, incidents and debris in `sessionStorage` (it never throws if
storage is blocked). The pause card then shows **Copy pace log**, which copies
tab-separated rows for a spreadsheet. Code: `web/js/pace.js`.

## How it fits together

The server owns everything players could fight over: balls, pockets, cash and
the shift clock. Browsers own their own walking and looking. The ball physics
is one module (`web/js/sim.js`) that both run, so flights look smooth in the
browser while the server decides where every ball really is.

| Path | What |
| --- | --- |
| `server/server.mjs` | HTTP: static files, `/healthz`, the crew API, the 20 Hz tick, saves. |
| `server/crew.mjs` | One crew's range: players, balls, pick-ups, deposits, knockdowns, shifts. |
| `server/store.mjs`, `server/s3.mjs` | Saves: S3 (a small signed client, no SDK) or in memory. |
| `web/js/sim.js` | Shared physics and rules constants. |
| `web/js/main.js` | The game client. |
| `web/js/net.js` | Join, stream (server-sent events), send inputs. |
| `web/js/sky.js`, `web/js/pad.js` | The sky and controller support, from Golden Hour Golf. |
| `web/lib/` | Three.js (vendored, since the CSP allows same-origin scripts only). |
| `test/` | `node --test` suites: physics, crew rules, SigV4, and the server end to end. |

**API:**

| Request | Body | Returns |
| --- | --- | --- |
| `POST /api/crew` | `{name}` | `{code, p, k}`: a new crew, with you on it |
| `POST /api/crew/:code/join` | `{name, p?, k?}` | `{code, p, k}`: joins, or rejoins with an old `p`/`k` |
| `GET /api/crew/:code/stream?p=&k=` | | Server-sent events: one `welcome`, then `tick`s at 10 Hz |
| `POST /api/crew/:code/input` | `{p, k, x, z, yaw, a: [{t: 'pickup', ball} \| {t: 'deposit'} \| {t: 'start'} \| {t: 'buy', id}]}` | `{denied: [ballIds]}` |

## Running it locally

There are zero npm dependencies. You need Node 20 or newer.

```sh
node server/server.mjs                 # http://localhost:8080
SHIFT_SECS=90 node server/server.mjs   # short days, for testing
DEV_START_CASH=500 node server/server.mjs  # new crews start with cash, to try the shop
./test.sh                              # or: node --test test/
```

Open a second browser tab to be a second player. Add `?debug` to the URL to
get `window.rr` (your player, the balls, crew state) in the console.

## Performance

Target on the owner's Xbox (Edge, 4K TV): average frame at most 16.7 ms and
**p95 at most 20 ms**, over a 7-minute shift with 4 players, 14 customers, 800
balls and the Stadium crowd.

**Graphics setting** (Settings > Graphics): Auto (Low on Xbox, High elsewhere;
Auto also steps down by itself if p95 stays over 22 ms for 10 s, up to three
times: render scale 0.85, shadows off, 6 customers, with a toast), High, or Low.
Low: pixel ratio 1 and at most 1080 rows rendered (CSS-scaled up), a 1024 shadow
map refreshed every 2nd frame with only the sun and fixtures casting, 8 full
customers within 30 m, no scuba light shafts, half the silt and kelp, venue
neon and stadium crowd animated at 20 Hz. Scenery density (`lowDetail`) is
chosen at page load; the rest changes live.

**Measuring.** Add `?perf` to the URL for the overlay (P toggles it): frame ms
average, p50, p95 and worst over 5 s, draw calls, triangles, heap where the
browser reports it, and a `[perf]` console line every 10 s. To get to a heavy
venue quickly, run the server with `RR_DEV=1` (never in the manifest) and load a
fixture from `tools/fixtures/` (`muni-day3`, `club-day2`, `stadium`):

```sh
RR_DEV=1 node server/server.mjs
curl -s -XPOST localhost:8080/api/dev/crew -H 'Content-Type: application/json' -d '{"fixture":"stadium","name":"Perf"}'
# -> {code,p,k}; join that code from the lobby with ?perf in the URL
```

Method: Stadium fixture, 4 clients, a full 7-minute shift, read p95 from the
overlay at the end of each minute; once with Graphics High, once with Auto.

| Device | Graphics | avg ms | p95 ms | worst ms | calls | tris |
| --- | --- | --- | --- | --- | --- | --- |
| Desktop Chrome (reference) | High | _todo_ | _todo_ | _todo_ | _todo_ | _todo_ |
| Xbox, Edge, 4K TV | Auto (Low) | _todo_ | _todo_ | _todo_ | _todo_ | _todo_ |
| Xbox, Edge, 4K TV | High | _todo_ | _todo_ | _todo_ | _todo_ | _todo_ |

Before pushing, run `make preflight` (it needs Docker, yq and Trivy).
