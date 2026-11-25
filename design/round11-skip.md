# Round 11: skip ahead (test)

The owner asked to playtest later levels without playing the whole game first. On dev and localhost, the title card now has
**Skip ahead (test)**. It starts a NEW crew at a later point of the game. The crew starts from a save that a bot crew made
by playing the real game.

## How the owner uses it (Xbox, Edge, dev)

1. Open `https://range-rat-dev.fd.robertpuffe.com`. Prod has no button, and the server refuses the request there.
2. Type a name, or leave it blank.
3. D-pad down to **Skip ahead (test)** under *Start a crew*. Press Ⓐ to focus it, then Ⓐ again to open the list.
   Focus moves to the first starting point.
4. Use the D-pad to pick a starting point, then press Ⓐ. You land in the lobby of a new crew. The crew has its own
   code, and a yellow **TEST CREW** tag shows in the lobby, on the HUD next to the crew code, and on the report.
5. Friends join with the code as usual. The preset was made for 4 Rats, but a crew of 1 to 4 works: the morning prints
   the goal card for the Rats who are online. Press **Open the range**.

It never touches an existing save. Each pick makes a new code, and the old crew stays where it was. A test crew is saved
like any other, so its code can be rejoined later.

Starting points: Muni day 4 (Gary), Range Club day 1, Tiered day 1, the Stadium day 1, the County day 1, the Orbital
day 1, the Last Bucket (finale), and endless.

## How it works

- **Host gate** (`web/js/skip.js` `skipHostOk`, shared by both sides). It allows `localhost`, `127.0.0.1` and `[::1]` on
  any port, plus any host containing `-dev.`. It refuses everything else, including `range-rat.fd.robertpuffe.com`.
  - The title card checks `location.host`.
  - The server checks the request's `Host` header. On any other host, `GET /api/skip` and `POST /api/skip` return 404.
  - No manifest or env change was needed, because flightdeck has no per-environment config. The prod load balancer
    routes by host, so a request that reaches the prod service carries the prod host.
- **Presets** are in `server/presets/<id>.json` as `{ id, label, made, bot, players: 4, save }`. They are real
  `toSave()` output, captured from the bot crew:
  - upgrades, cash, Balls Outstanding, treasures (`lostFound`), totals, records, reviews and the goal card;
  - commendations, `voiced` and `debuts` (so old PA lines and ball debuts don't replay);
  - the venue modules' `mods`, fixtures and the fryer.
- **Apply** (`server/skip.mjs`, `POST /api/skip {name, preset}`):
  1. `presetSave` clones the save, sets `code` and `test: true`, and unprints the goal card (`scale`/`crew` set to null).
  2. `server.mjs` stores the save under a new code with `store.save`, then loads it with `loadCrew`, like any rejoin.
     So the Crew constructor's cleaning and migrations (v4 to v5, migrateShop, cleanCard) all apply. If rows change,
     the migration handles the presets the same way it handles old saves.
  3. At the first morning, `printGoals` reprints the unprinted card for the crew online (`printOver` keeps its counts
     and ticks). That is how one 4P preset serves 1 to 4 Rats.
- **Crew size and dive gear.** Personal dive gear is stored by name. The presets store the bot crew's best dive level
  under the default names "Rat 1" to "Rat 4". When anyone else joins a test crew, `testJoin` gives them that level. It
  runs on the skip route and on the normal join route, and does nothing on a real crew.
- **`test: true`**:
  - `Crew` reads it with `save.test === true` and writes it in `toSave()`, so it survives every save and reload.
  - `snapshot()` carries `test: true` only on a test crew, so normal crews' snapshots and the seam goldens are unchanged.
  - The client sets `body.test-crew` from the welcome message, and CSS shows the `.test-tag` spans.
- **Tips** (`tipsFor(save)`). The response lists the first-time tips that a crew at that point would already have seen:
  - always: the onboarding tips;
  - for anything the crew owns: crank, shed, cart, tube/dive, gutters, drones;
  - by venue: CCTV and the creek from Tiered on, the deck from the Stadium on, the Lift after the Orbital's first day.

  What is new at the starting point stays unseen. For example, Club day 1 still teaches the creek and CCTV, and Orbital
  day 1 still teaches the Lift. The client adds the list to the hint store (`hinter.markSeen`, settings.js). This
  persists in that browser, just as if the player had played up to that point.

## Regenerating the presets (the lead, after round 11's other builders finish)

    node scripts/make-presets.mjs [seed]      # about 70 s; 4 Rats, seed 7

The script chains three bots in `scripts/bots/`. They are the expert review's ladder scripts, copied with repo-relative
imports and two hooks from `snap.mjs`.

1. `muni.mjs` plays from a fresh crew to the Club promotion.
2. `mid.mjs` plays from that exact end state to the Stadium.
3. `late.mjs` plays from there through the County, the Orbital and the Last Bucket, into endless.

Each bot snaps `crew.toSave()` every morning, and `late.mjs` also snaps the moment the Last Bucket begins. The script
chooses one snap per starting point:

| Starting point | Snap used |
|---|---|
| Muni day 4 | The morning of day 4 |
| Club day 1 | The Muni bot's end, after signing |
| Tiered, Stadium, County, Orbital day 1 | The first morning at each venue |
| Last Bucket | The mid-shift snap. Outstanding is 1, so the next shift opens straight into the finale |
| Endless | The first endless morning |

If a bot never reaches a point, the script fails loudly. Rerun it whenever upgrades, prices or cards change. The test
then checks that every preset still loads.

The presets were generated mid-round, while the other builders were still editing (seed 7, 4P, 2026-11-25):

| preset | day | venue / vd | cash | Balls Outstanding | treasures |
|---|---|---|---|---|---|
| muni4 | 4 | 0 / 3 | $1,489 | 4.21 B | 0 |
| club1 | 6 | 1 / 0 | $3,591 | 3.01 B | 0 |
| tiered1 | 11 | 2 / 0 | $7,582 | 1.51 B | 4 |
| stadium1 | 14 | 3 / 0 | $155,398 | 713 M | 6 |
| county1 | 19 | 4 / 0 | $1.66 M | 1.37 M | 6 |
| orbital1 | 24 | 5 / 0 | $3.78 M | 1,958 | 6 |
| lastbucket | 29 | 5 / 6 | $210.5 M | 1 | 6 |
| endless | 30 | 5 / 6 (endless) | $29.2 M | 0 | 6 |

Bot run times: muni 16 s, mid 21 s, late 30 s.

## Files

New:
- `web/js/skip.js`: the host gate, `PRESETS`, `tipsFor` and the title-card DOM.
- `server/skip.mjs`: `loadPreset`, `presetSave` and `testJoin`.
- `server/presets/*.json`: 8 presets.
- `scripts/make-presets.mjs`.
- `scripts/bots/{snap,classify,muni,mid,late}.mjs`.
- `test/skip.test.mjs`.

Touched:
- `server/server.mjs`: the `/api/skip` route, and `testJoin` on join.
- `server/crew.mjs`: three lines for the `test` flag in the constructor, `toSave` and `snapshot`.
- `web/index.html`: the skip box on the title card, three `.test-tag` spans and their CSS.
- `web/js/main.js`: the import, `enter('skip', id)`, `markSeen`, `initSkip` and the `test-crew` body class.
- `web/js/net.js`: `skipCrew`.
- `web/js/settings.js`: `hinter.markSeen`.

The old local-only `DEV_*` env vars and the `RR_DEV` fixture route are untouched.

## Tests (test/skip.test.mjs)

- **Host gate.** localhost, 127.0.0.1, [::1] and `-dev.` hosts are allowed, with ports and in any case. Prod, look-alikes
  (`localhost.evil.com`, `dev.range-rat…`), empty values and oversized values are refused.
- **Every preset.** Each one goes through MemoryStore save and load into `new Crew`, with 1, 2 and 4 Rats. The test
  checks:
  - the venue, the endless flag and `test`;
  - that every Rat gets dive gear from Tiered on;
  - that the shift starts and the card prints for the actual crew size;
  - that 4 s of ticks run without error, and that `toSave()` and `snapshot()` keep `test`;
  - for the Last Bucket preset, that the finale begins on the first shift.
- **A real crew is untouched.** There is no `test` key, `testJoin` does nothing, and only a literal `true` marks a test
  crew.
- **Tips.** Old things are marked seen and new things are not, and every id is a real `HINTS` id.
- **HTTP on a real server.** The prod Host gets 404 for both GET and POST. The dev and localhost Hosts each make a new
  crew with a different code, and a friend can join it. An unknown preset gets 404.

I checked the flow in the preview on localhost:8091:
1. The title card showed the button and the list of 8 starting points.
2. Picking the Stadium opened a TEST CREW lobby at the Stadium.
3. After Open the range, the HUD showed Day 14 with $155,398 and the TEST CREW tag.
4. The console had no errors, and the hint store held the expected tips.

## Open issues

- **Regenerate the presets** with `node scripts/make-presets.mjs` once the other round-11 builders are done. The
  current presets come from mid-round code. Some bot runs ended oddly: the Last Bucket preset has $210 M because the bot
  banked a long Orbital. The bots play the game as it stands, so their pacing follows whatever the round's changes do.
- If a round changes the game enough that a bot never reaches a venue, `make-presets` fails, and the bot needs a fix in
  `scripts/bots/`.
- Persisting seen tips means that browser won't show those tips again for a real new crew. That fits the owner's Xbox.
  Settings has no tip reset, so a shared family browser would need its site data cleared (the `rangerat.hints.v1` key).
- The test crew is a normal save in the dev bucket. Nothing cleans old test crews up, but they are small and only on dev.
