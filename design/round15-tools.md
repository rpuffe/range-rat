# Council round 13, builder 4 ("tools"): item 0 (bots, presets, one calls ruler) and item 8 (the fixes pack)

## Item 0: bots and presets, landed first

| Part | What | Files |
| --- | --- | --- |
| 0a | `mid.mjs` uses `'fed'` (4 sites). It also gets B's `FIGHT=secs` boss shortcut (the crew stands still for that long in the Club fight, then tames MOW-E), the calls tally, the policy hooks and the caps. | `scripts/bots/mid.mjs` |
| 0b | `late11.mjs` is in the repo. It's builder 2's round-12 copy, cleaned up (relative imports, `START_FILE`/`SNAP_FILE` via `snap.mjs`, the morning and `lb` snaps). **Pings by hand:** while the pings goal is owed, the pinger is any free Rat (at 2P+ anyone off the lapped cart), and a lapper keeps a cart moving to ping. `late.mjs` is now a 6-line wrapper (`STOPV=99 JOB=1` by default), so old command lines still work. | `scripts/bots/late11.mjs`, `late.mjs` |
| 0c | Shift caps: `SHIFT_CAPS` / `snap.mjs capCheck` (Muni 8, Club 10, Tiered 6, Stadium 6, County 6, Orbital 4). Over a cap the bot prints `CAP stuck at Stadium on requests 0/6 after 6 shifts` and exits 1. `make-presets.mjs` then prints "FAILED, nothing written" and exits 1. Every preset is picked and checked before the first write. Options: `--out DIR` (a dry run), `--only id,id`, `--keep` (keeps the bots' logs). | `scripts/make-presets.mjs`, `scripts/bots/snap.mjs`, `muni.mjs` |
| 0d | New presets **`club4`** (the morning of Club day 4, MOW-E tame; checked) and **`stadiumPromo`** (the Stadium's Promotion Day, `encore` unplayed; checked). A crew that clears the Stadium's card in order never gets a Promotion Day. If the main run has none, the same Stadium-day-1 crew replays the Stadium under up to 8 other bot seeds (`STOPV=4`) until one does. Both are written from seed 7. The other 8 presets are untouched: the lead regenerates them. | `server/presets/club4.json`, `stadiumPromo.json`, `web/js/skip.js` (2 rows) |
| 0e | `calls.mjs`, the one ruler (§1.4). `CallTally.step(crew, dt)` / `endShift` / `print`. `CALLS_JSON=f` appends one line a shift. `node scripts/bots/calls.mjs a.jsonl b.jsonl` prints the pooled table (time-weighted). It always adds a **"Club d4+"** row and an **`r8`** column (round 8's kinds). A module marks its own calls with `call: '<kind>'` on any event. Imported by muni, mid, late11 and pt7c-endless. `boss.mjs` is builder 1's: it needs the same 3 lines. | `scripts/bots/calls.mjs` |
| 0f | `policies.mjs`: `TOURNEY=1` → `policy/tourney.mjs`, `WHISTLE=<any but 0>` → `whistle.mjs`, `BUY=1` → `landmarks.mjs`, `POACH=1` → `poach.mjs`, `POLICY=a,b`. A file's default export is `make(ctx, value)`, returning optional hooks: `shiftStart`, `step(dt)` → the Rats it moved, `buy`, `shiftEnd(report)` → fields, `summary`. ctx is `{ bot, crew, rats, N, DT, now, walkTo(p, x, z), log }`. A flag whose file is missing exits 1. Wired into mid and late11. | `scripts/bots/policies.mjs` |

### Measurements (item 0's Verify)

- **`make-presets.mjs` at 4P, seeds 7 / 11 / 23: all three wrote all 10 presets with no cap hit** (`--out` to the
  scratchpad). Club 5 / 6 / 4 shifts, Tiered 3, Stadium 2–3. Seeds 7 and 11 got `stadiumPromo` on the first replay seed
  (`late11-1007`, `-1011`); seed 23 got it directly.
- **`mid.mjs` 1P from `club1` leaves the Club in 8 / 5 / 7 shifts** (seeds 7 / 11 / 23): ≤ 8 at all three.
- **The ruler** (`mid.mjs` from `club1`; 4P with `FIGHT=55`, 1P ignoring the boss; seeds 7 / 11 / 23 pooled):

| Venue | Players | Calls a minute (§1.4) | r8 (round 8's kinds) | Round 8 (B) |
| --- | --- | --- | --- | --- |
| Club | 4P | 0.92 (0.57–1.43) | **0.78** | 0.72 |
| Club d4+ | 4P | 0.79 | 0.67 | 0.69 |
| Club | 1P | 0.92 | 0.76 | 0.76–0.82 |
| Club d4+ | 1P | 0.87 | 0.69 | — |
| Tiered | 4P | 2.73 (deck orders: one per 30 s) | 2.64 | 3.2 (raw) |

  - **On round 8's kinds the ruler reads 0.78 at 4P, within ±0.1 of B's 0.72, so it carries over from round 8.**
  - §1.4's full definition reads +0.14 higher. It adds two kinds B didn't count: Gary's visit warn (B counted the drive-by
    wave instead) and every boss phase (B counted the warn only).
  - **Builder 2's ≥ 1.0 / ≥ 1.5 targets are on the full definition.** On that ruler today's Club d4+ is 0.79 (4P) and
    0.87 (1P). The lead should judge item 1 on the full column and quote `r8` beside it.
  - The deck order's 30 s merge still gives ~10 a shift at Tiered (B's "orders as one job" was 1 a shift).

## Item 8: the fixes pack

| # | Fix | Where | Test |
| --- | --- | --- | --- |
| 8.2 | Next shift shows pressed at once (dimmed and scaled for 1 s). A second press inside that is the same press. | `web/js/readygate.js` (new, pure), `main.js` (the `#next` handler) | `fixes13` 8.2 |
| 8.3 | Ready ignores Ⓐ/Space/Enter for 1.5 s after any card closes (`#story-card.on`, `#endcard`, sampled every 100 ms). A key press must have gone **down** after the card, so a held Space's key-up never readies. Mouse clicks always count; the pad's Ⓐ is edge-triggered already. | same | `fixes13` 8.3; browser: held Space through a card → 0 starts; a fresh press after 1.7 s → 1; an instant second press → still 1 |
| 8.4 | An open buy goal's ✦ shows the reward at the BV after the buy lands. `goals.js withBuyPay` sets `r.pay` on the wire rows, and `cardHtml` shows it. Day 1's washer goal showed +$28.80 and paid +$57.60; now it shows $57.60. | `goals.js`; `crew.mjs goalWire` (1 line, outside my regions) | `fixes13` 8.4 (live crew: shown == paid) |
| 8.5 | `mins()`: under 60 s reads "under a minute"; "1 minute" is 60–119 s (floor, not ceil). The deal reads "under a minute more fed". | `goals.js`; two expectations in `test/goals.test.mjs` moved (105 s left is now "1 more minute") | `fixes13` 8.5 |
| 8.6 | When Gary starts his leg to the stand, every online Rat over 40 m from the return, or diving, is called: the feed line "Huddle! Pip, surface!" / "Huddle! Pip +1, back to the return!" and a 3 s screen-edge chevron toward the return for the called Rat. At the stand he waits up to 10 s more while a Rat is still diving. | `huddlerules.js` (`huddleCalls`, `huddleLine`, `huddleHolds`), `web/js/edgechev.js` (new), `crew.mjs stepGary` (2 lines, outside my regions), `main.js` (one event case) | `fixes13` 8.6 |
| 8.7 | Stadium lobby line: "Answer souvenir requests. Keep the crowd happy." | `sim.js LOBBY_TAGLINE` | `fixes13` 8.7 |
| 8.8 | The endless report puts the three contracts first, as compact rows, so 2★/3★ sit above the fold. A long report value ("(missed washer bonus $491,350)") wraps inside its column (`#report-body p > b { min-width: 0 }`). | `recap.js` | browser shot `c13-tools-endless-contracts.jpg` |
| 8.9 | 3★ "Nobody knocked flat" → "At most 1 knockdown" (`GOALS_BY_STARS[3]` upright n 0 → 1). | `today.js` | `fixes13` 8.9 |
| 8.10 | `rivalBell(..., this.poachDay === this.day)`: a poached win counts 2 of the week. | `crew.mjs endShift` records block | builder 2's `owner.test.mjs` covers `rivalBell` |

**8.9's band** (`pt7c-endless.mjs` from `endless`, `PICK=2` always takes the 3★, 7 contract days × seeds 7 / 11 / 23):
- **4P: 8 of 21 met (38 %)**, in the 25–40 % band. Upright days: 7 of 10.
- **1P: 1 of 21 (5 %).** The 1P bot isn't knockdown-aware (3–15 knockdowns a day), so 1P is below the band with this bot.

### Hand-offs taken
- **`sim.js`:**
  - `SHOP` lists `LANDMARK_ROW` and `POACH_ROW`;
  - `perks().landmark`;
  - `nextPrice` returns null for a `repeat: 'day'` row (the poach is priced off yesterday by `owner.js poachPrice`, not by
    a tier).
- **`bvtext.js kpiNoteOf`:**
  - `MEMBERS' TOURNAMENT · ●●○ · 0:22` (`tourneyLine(mods.tourney)`);
  - the inspection label reads `ins.who`, giving "INSPECTOR (EX-SITE 13) · FAR LEFT · 0:45".
- **Memo lines:** `crew.memoNote` (round 12's hook) is already the `note` slot. Builder 2's modules set it in their
  `startShift` (the Tournament memo, the inspector memo). No change was needed.
- **8.10:** the records line.

### Goldens and tests
- **`node --test test/`: 1242 / 1242 pass** at my last run. **Seam goldens did not move** (`seam.test.mjs` 20 / 20). My
  game changes don't touch physics, the cart grid, BV or the Muni.
  - 8.6 adds one event (`huddleCall`) at a Gary visit, plus a wait only while someone dives.
  - `perks()` gains a `landmark` field, but the BV fingerprint stringifies `ballValue`, not `perks`.
- New tests: `test/calls.test.mjs` (6), `test/fixes13.test.mjs` (7).

## Open issues
- **The ruler moved by +0.14 at the Club** (Gary's visit and the boss phases). The table above shows both columns.
- **`stadiumPromo` needs a replay seed at 2 of 3 seeds.** That's honest (a real crew's save), but it shows that a
  Promotion Day at the Stadium is rare at 4P: the Stadium card's requests goal is usually last, not the reviews.
- **8.6's chevron is my own `edgechev.js`.** Builder 1 ended up exposing `ctx.chevron` to venue views. The lead could swap
  mine for it to keep one chevron.
- **Poach shop row:** `nextPrice` can't know yesterday's bank, so the generic shop shows no price for it. Builder 2
  needs a snapshot price (e.g. `crew.poachPrice`) and a line in the shop renderer, or the row can't be bought from the
  UI.
- **Builder 1's HUD whistle icon (`bvLine`) never arrived** as a hand-off; nothing was done.
- **Member balls must carry `call: 'member'`** on their landing event, or `calls.mjs` won't count them (builder 2).
- **Mid-run failures from other builders' half-done work** (builder 1's `tomorrowText` and the `pacing11` Promotion Day
  Gary check) cleared by my final run.
- Preview: I added `SHIFT_SECS=40` to `rr-play-a` for the report check, then restored `launch.json`. The server is stopped.
