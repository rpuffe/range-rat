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

A first playable slice, solo and local only. One shift runs from opening to
sunset. Customers on ten mats hit balls onto the range. You walk out, pick
them up by hand (your pocket holds 3), and drop them in the bucket stand for
cash. The shared multiplayer range, upgrades and saves come next.

## Controls

| | Keyboard and mouse | Controller |
| --- | --- | --- |
| Walk | WASD | Left stick |
| Look | Mouse (click to capture), or the arrow keys | Right stick |
| Pick up / drop in bucket | E, Space or click | Ⓐ |
| Pause | Esc | ☰ |

## Layout

| Path | What |
| --- | --- |
| `main.go` | Static server for `web/` (embedded) and `/healthz`. |
| `web/index.html` | The page: title card, HUD, pause, shift report. |
| `web/js/main.js` | The game. |
| `web/js/sky.js` | The golden-hour sky and sun, copied from Golden Hour Golf and re-keyed to the time of day in a shift. |
| `web/js/pad.js` | Controller support, copied from Golden Hour Golf. |
| `web/lib/` | Three.js (vendored, since the CSP allows same-origin scripts only). |
| `tools/dev-server.mjs` | A Node static server for machines without Go or Docker. |

## Running it locally

With Go:

```sh
WEB_DIR=web go run .
```

Without Go (Node only):

```sh
node tools/dev-server.mjs 8080
```

Then open `http://localhost:8080`. Add `?debug` to the URL to get
`window.rr` (player, balls and a few functions) in the console.

Before pushing, run `make preflight` (it needs Docker, yq and Trivy).
