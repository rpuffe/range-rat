# Round 14 (council round 12), builder 4 "look": notes

Items 4 (the slab, the floodlights, one centre text), 7e (the gauges named), 9 (the fixes pack), and the Board and memo
hand-off hooks for builders 1–3. Merge order for the hot files: builder 4 first.

## Hand-off hooks (landed first; use them without editing builder 4's files)

**Memo lines** (`server/crew.mjs` memo push; `web/js/sim.js` `memoSecond`, `MEMO_LINES`, `contractMemo`):
- **Builder 1:** the boss morning's second line is automatic: `mowe: this.moweMemo ?? (this.bossToday() ? MEMO_LINES.moweUpdate : null)`
  ("MOW-E is downloading an update."). Your own `this.moweMemo` still wins when set. Seen in textload: Stadium #2 (the
  encore) shows it.
- **Builder 2:** after a clean inspection set `crew.memoNote = <line>` (`MEMO_LINES.inspector` or your `INSPECT_MEMO`). It
  takes the flavour's slot next morning only, and is cleared after the memo.
- **Builder 3:** the endless contract line is automatic ("Contract: at most 2 knockdowns.", from `today.js goalText`, so
  new goal kinds follow as long as `goalText` knows them). For Site 13's week set `crew.memoNews =
  MEMO_LINES.acquired` / `MEMO_LINES.rivalBack`; it beats everything for one morning.
- Priority: news > contract > Today > NEW (venue, kinds) > MOW-E > note > flavour. The contract shows as the line itself
  (not "TODAY · …"). The flavour's rng draw still happens every morning (goldens).

**Board** (`web/js/board.js`, `web/js/bvtext.js`; wired in `main.js` `board.update`):
- **Builder 3, the contract (6c):** add to the snapshot's `contract` (shift phase) `so` (a number → "· 1 SO FAR", or a
  short string) and `state: 'live' | 'met' | 'lost'`. The endless panel draws `★★☆ AT MOST 2 KNOCKDOWNS · 1 SO FAR`
  centred; `met` → `★★☆ MET` in gold; `lost` → grey and struck through. The lifetime stars move beside TODAY.
- **Builder 3, Site 13 (8):** `rival: { cash }` in the snapshot (endless) → `SITE 13 $41.8M (est.)` under the crew's
  total (`est: false` drops "(est.)"). "Passed Site 13." → `ctx.board.flash(true)` (the crossing flash, once).
- **Builder 2, the Stretch (2c):** `mods.stadium` snapshot `stretch: { secs: ['A','C','F'] or 'ACF', t }` →
  `SEVENTH-INNING STRETCH · A C F · 0:25`. **Inspection (7a):** `mods.county` `inspect: { yard, t }` →
  `INSPECTION · YARD 2 · 0:45`. Both outrank the everyday note.
- **Builder 2, LEGEND (2d):** in `views/stadium.js` on a lit delivery (`e.kind === 'souv' && e.req`):
  `ctx.board?.shout?.(\`${name} · LEGEND · SECTION ${e.req}\`, 3)`: a gold band across the Board for 3 s.

**say.js (4c):** `sayer.paIdle` and `sayer.whenPaIdle(cap = 2)` (a Promise, resolves `true` when idle or `false` at the
cap). round2.js's ctx has it as `ctx.whenPaIdle`.

## Hand-offs still open (one or two lines each, in files I don't own)

- **→ b3, `round2.js` ~l.198 (the end card, C #7):** `(bank?.done ?? Promise.resolve()).then(() => ctx.whenPaIdle?.(2)).then(() => showEndCard(e.report))`.
- **→ b3, `round2.js` ~l.103 (the $∞ flash's fade under the PA):** `pa.say('last')` fires as the flash starts its 0.6 s
  CSS fade; queue it 600 ms later (or call `afterFlash` from `ending.js` after the fade).
- **→ b3, `round2.js` ~l.342 (9.6, B #10):** the "Day N · venue · you are a …" toast. Every reveal morning now has a
  story beat, so drop the toast (its words are on the sign). textload still simulates it at +6 s, and it is
  dropped by its 3 s TTL in practice (it never showed in any browser run tonight).
- **→ b3, `round2.js` (4d):** the Stadium reveal camera (REVEAL_POS 20, 6, 22) passes the jumbotron's left post
  (x 20.6, z 14): a vertical bar through the middle of the reveal. The post is steel-grey now, not black, but the pose
  could face the Board for card 1 (the newsreel) and clear the post.
- **→ b3, `views/garycameo.js` (9.5, C #6, the bubble "Where do these go, boss?"):** the bubble in C's shot is the cameo's
  own sprite, not main.js's. One line in its tick, with the camera:
  `bubble.position.y = clampBubbleY(2.35, { x: root.position.x, z: root.position.z, half: bubble.scale.y / 2 }, camera, v)`
  (`web/js/bubbleclamp.js`, scratch `v` a Vector3). main.js's Gary-at-the-gate bubble uses it already.
- **→ b1, `confetti.js` (4b):** A's "floodlight black squares with grey discs" are MOW-E's plug smoke. The Stadium has no
  floodlight meshes (the floods are SpotLights only); the squares are the shared confetti `Points` (no `map`: square
  points) tinted `BLACK 0x3a3a3a` / `SMOKE 0x8a8a8a` by `mower.js` in the plug phase. That is 9.12 (smoke as a soft
  round sprite); please treat it as not optional, since it is the round-7 "black squares".

## What I built

**4a, the black slab** (`venues.js`, `sim.js`, one line in `crew.mjs` startShift):
1. The decking material glows (`emissive 0x2a2218`, one material, no new draw call). The back wall is mid grey with a
   little emissive (it faces the sun's shade). The Club awning gets a little green emissive too, since from below it read
   as black. The jumbotron frame is steel, not `0x2a2d33`.
2. **The late clock-in.** From the Stadium on (and endless) the crew clocks in at `CLOCK_IN.LATE_XS` = x 24.6, 25.8,
   29.4, 30.6, 31.8, 33.0 at z 4 (`sim.js clockInSpot`). That is past the Club awning's end (x 23.5) and either side of
   the washer and its handles (x 26.1–28.9). The deck's corner is ≥ 59° off a Rat facing the field. The council's "4 m
   toward +z" would have put the Rats behind the deck looking through its legs (the underside stays visible from z 8),
   and the browser showed that the old slot 0 (x 18) was under *both* canopies. So the row moves along x instead. The
   Muni, the Club and Tiered keep the old row (no golden moves).
3. **The cutaway:** while the camera is under the deck (|x| < 20.5, z 1.5–6.5, y < 2.75) the floor fades to 35 %
   (`DECK_CUT`), set in the floor mesh's own `onBeforeRender`: no main.js hook, two compares a frame.

**4b, the floodlights:** none to fix (see the b1 hand-off above). I traced the console flood instead:
`THREE.Quaternion.setFromEuler unknown order` came from `ballreturn.js` (`_e` was a `Vector3`, so every frame warned and
the bucket's tilt never applied). It is now an `Euler`.

**4c, one centre text** (`say.js`, `pa.js`, `sim.js`, one guard in `crew.mjs`):
- A story card that wants the turn while a PA card has > 2 s left snaps the PA card off. Its caption goes back to the
  front of the queue flagged `resumed`: pa.js shows the caption again after the card, without the chime or the voice. A
  PA card with ≤ 2 s left, or a PA line already queued, still goes first.
- While the card holds the turn, the model hands back anything non-stamp that is visible, and the DOM adapter forces
  `#pa-card` and `#memo` off every sync. That covers A #6 whatever path showed them.
- The "PA idle" signal (above) is for the end card.
- The Stadium's reveal PA is cut (`VENUE_RULES[3].pa = null`; `crew.mjs` skips a null). The Club's reveal PA is
  "Promoted. Range Club. Parking unchanged." and `MIN_SHOW_MS` is 3.4 s (was 4).

**7e** (`bvtext.js`, `index.html`, main.js HUD strip): "Today: 35% clean. Crowd over half." / "… Zoning over half.". The
HUD ends "· crowd 82%" / "· Zoning 62%" in `#value-gauge`, red under 50 %. It writes to the DOM only on change. The
`need 35%` stays.

**9, the fixes pack:**
- 9.1: the `endless` preset has `endlessFresh` (and no offers or owners' book). `crew.mjs` now saves and loads
  `endlessFresh` (and arms `endlessArmed` with it), which also fixes a real reload between the bank and the first
  endless morning. `make-presets.mjs` writes it.
- 9.2: `textload.mjs` adds an overlap column (a non-stamp say item up while a story card is up), the whole shift on boss,
  Stadium and County days (`FULL=1` for every morning), an ALERT count and an epilogue flag. It also reads pa.js's
  `MIN_SHOW_MS`.
- 9.3: the Orbital's NEW line is "NEW: the Lift. Ride it to the sky." The first line keeps "1,958 to bring home."
- 9.4: the checklist and nudge slot stay down while any centre text shows *or waits* (say.js `pending`, the story card's
  next beat), and for 1 s after (`morning.js checkGate`).
- 9.5: main.js's Gary bubble is clamped under 70 % of the screen (`bubbleclamp.js`). The cameo bubble is a b3 hand-off.
- 9.7: Club day 1 is 21.8 s (was 24.8).
- 9.8: every memo flavour is ≤ 8 words. They moved to `sim.js` (`MEMO_FLAVORS`, `RAT_MEMOS`, `MEMO_DAY_FLAVOR`).
- 9.9: the dusk's "N left out there" reads the server's `left`: the snapshot's while closing, and the report's at the
  walk-off. `outThere` is the fallback only.
- Extra: `bvtext.js debrisHomeText` had lost its regex escapes ("+1000 balls home"). Fixed.

## Measurements

**textload** (`node scripts/bots/textload.mjs 7,11,23 4` and `… 1`), 63 watched windows at each size:

| | 4P | 1P | Target |
| --- | --- | --- | --- |
| Overlaps (two centre items at once) | **0** | **0** | 0 |
| Promotion mornings, max | 24.0 s, 3 items | 24.0 s, 3 items | ≤ 28 s, ≤ 3 |
| Club day 1 | **21.8 s** (was 24.8) | 21.8 s | ≤ 22 s |
| First endless morning | 24.7 s, epilogue 3 of 3 | 24.7 s, 3 of 3 | ≤ 28 s |
| Mornings with two memos | 0 | 0 | 0 |

The Stadium, County and boss days are watched for the whole shift. Their ALERT count is 0, because builder 2's Stretch
and inspection ALERTs are said client-side and textload replays server events only.

**Browser** (rr-play-a, a pixel pass over a canvas readback: "black" is max channel < 20, "dark" is < 45):

| Spot | Black | Dark |
| --- | --- | --- |
| Stadium spawn (24.6, 4), facing the field | 0 % | 1.1 % |
| Stadium mat 5 (2, 1.2) | 0.8 % | 2.5 % |
| Stadium under the deck (2, 4), cutaway | 0.4 % | 1.2 % |
| Stadium old slot 0 (18, 4) | 0 % | 0.6 % |
| Orbital spawn (24.6, 4) | 0.6 % | 2.3 % |
| Orbital mat 5 | 0.1 % | 3.5 % |
| Orbital under the deck | 0 % | 1.0 % |
| Orbital spawn facing the Lift (−x) | 0.6 % | 2.7 % |

Before the fix, A's shot had the top ~37 % black. The deck underside is 0 % of the frame at the new spawns.

**Centre text in the browser** (DOM sampled every 200 ms): Stadium day 1, the Orbital promotion and the first endless
morning (epilogue → PA → memo) all ran strictly one at a time, with 0 overlaps.

Shots: `design/shots/c12-look-stadium-spawn.jpg`, `c12-look-stadium-mat10.jpg` (the old slot under both canopies: green
and wood, no black), `c12-look-orbital-deckline.jpg`.

## Files touched

- **Mine:** `web/js/venues.js`, `say.js`, `pa.js`, `board.js`, `bvtext.js`, `sim.js`, `morning.js`, `index.html`,
  `server/presets/endless.json`, `scripts/bots/textload.mjs`, `scripts/make-presets.mjs`, new `web/js/bubbleclamp.js`,
  new `test/look12.test.mjs`, and a block appended to `test/words.test.mjs`.
- **`server/crew.mjs`** (my regions): the memo push (the hooks) and `MEMOS` (now from sim.js). **Outside my regions, a
  line each:**
  - the sim.js import line;
  - a `today.js goalText` import;
  - the clock-in line in `startShift` (`clockInSpot`), which is the "one-line hand-off to the lead";
  - the reveal PA guard (`if (VENUE_RULES[v].pa)`);
  - `endlessFresh` in load and save.
- **`web/js/main.js`** (my regions):
  - the HUD strip (`#value-main` / `#value-gauge`);
  - `textBusy` and the checklist gate;
  - Gary's bubble;
  - the dusk queue's `left`;
  - `board.update`'s `contract` and `rival`.

  **Outside, a line each:** imports, `whenPaIdle` in round2's ctx.
- **Unowned:** `web/js/ballreturn.js` (one line, the Euler) and `web/js/duskview.js` (9.9, as the council named it).
- `test/round2.test.mjs`: "every later venue has its reveal line" now expects no Stadium PA (the council's cut).
- `design/game-design.md`: the section appended.

## Tests

- `test/look12.test.mjs` (14):
  - the story card snaps a long PA and resumes it;
  - a short or queued PA goes first;
  - nothing shows under the card;
  - `whenPaIdle`'s 2 s cap;
  - the checklist gate;
  - the memo priority and contract line;
  - the 7e memo and HUD;
  - the Board's lines;
  - the late clock-in, geometrically and in a crew;
  - the Orbital line;
  - the flavours;
  - the endless preset (plays the epilogue, no contract, spent after the morning);
  - the contract memo;
  - the bubble clamp.
- `words.test.mjs`: the hooks, the flavours, the venue lines and the NEW lines.

**Seam goldens:** they did not move with my changes. The clock-in move, the memo text and the reveal PA guard only touch
venues ≥ 3, and `memoFlavor` still makes its one draw.

## Open issues

- **The Lift from the spawn.** Facing the Lift (−x) from any spawn at z 4, you look straight down the deck's length,
  and the deck's end and back wall hide the car at rest. The 400 m tower is above the frame. The car shows once it
  rises, or from the mats (z < 2). Builder 3's reveal now ends on the Lift, which is where the crew sees it. A fix
  would need the deck to stop short of the Lift's line, or a clock-in in front of the mats. That is a Level Designer
  call.
- **The Club awning** still fills the top third of the view from under it (the old slot 0, the mats at x ≥ 14). It is
  green and lit now, not black. The council's ≤ 10 % rule is about the deck, and that is 0 % at the new spawns.
- **The browser pane** was hidden for parts of the session (shared with other builders), so rAF stalled. I took every
  pixel pass inside a rAF callback, and the screenshots with the tab fronted.
