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
- **Saves:** day, cash and totals save to S3, so a crew can come back to
  their range.

Next: the upgrade shop, the tool ladder, and the side jobs.

## Controls

| | Keyboard and mouse | Controller |
| --- | --- | --- |
| Walk | WASD | Left stick |
| Look | Mouse (click to capture), or the arrow keys | Right stick |
| Pick up / drop in bucket | E, Space or click | Ⓐ |
| Pause | Esc | ☰ |
| Menus | Tab and Enter | D-pad or left stick, Ⓐ, Ⓑ |

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
| `POST /api/crew/:code/input` | `{p, k, x, z, yaw, a: [{t: 'pickup', ball} \| {t: 'deposit'} \| {t: 'start'}]}` | `{denied: [ballIds]}` |

## Running it locally

There are zero npm dependencies. You need Node 20 or newer.

```sh
node server/server.mjs                 # http://localhost:8080
SHIFT_SECS=90 node server/server.mjs   # short days, for testing
./test.sh                              # or: node --test test/
```

Open a second browser tab to be a second player. Add `?debug` to the URL to
get `window.rr` (your player, the balls, crew state) in the console.

Before pushing, run `make preflight` (it needs Docker, yq and Trivy).
