# Round 11: builder "bays" (Build more bays)

The owner's note: "With the everyday open, we should legitimately add more bays instead of just keeping a few of them
closed and empty and really not understanding why golfers aren't on those ones. If we keep bays one through five
closed, or make them invisible, then we add them when we upgrade."

## What changed

1. **Only built bays exist.** A bay that isn't built has no mat, no number, no worn patch, no Club divider, no mud,
   and nobody walks to it. The snapshot's `nMats` is now "the bays that exist today" (`crew.openBays()`: built, plus
   League Night's two from builder "today"), and everything draws, washes, targets and counts from it:
   - client: mats and numbers (main.js, via the new `bayline.js`), the worn patches in front of each mat (props.js:
     they sit at the tail of the dirt InstancedMesh, so `count` hides the unbuilt ones), the mud shader and its
     "came clean" glint (props.js), the Club's dividers and a new wing awning (venues.js `parts.setBays`), the hose aim
     (main.js), the yellow-arrow "hose the nearest mat" (nudge.js), the Board's pips (already `nMats`; pips shrink
     past 10 so 16 fit);
   - server: an unbuilt bay holds no mud (`syncBayFixtures`: on the opening bell and whenever the count changes in a
     shift, e.g. a Rat leaves), it can't be hosed (`wash()` refuses), and a new-wing bay is a Curb fixture only while
     built. Gary, Upkeep, the rally, the tips, the morning deal, the day-3 nudge and the CCTV markers read the same
     fixtures, so none of them can point at a bay that isn't there.
2. **"Open every bay" is gone; "Build more bays" (`up.build`) replaces it**, a crew row shown at every crew size:

   | Tier | Name | Cost (solo; ×2.2 at 4P) | When |
   | --- | --- | --- | --- |
   | 1 | Two new bays | $50 ($110) | Muni day 2 |
   | 2 | Two more bays | $250 ($550) | Muni day 3 |
   | 3 | The new wing | $4,000 ($8,800) | Range Club on |

   Bays built (base unchanged: 6 solo, 8 for two, 10 for three or more):

   | Tier | 1P | 2P | 3P | 4P |
   | --- | --- | --- | --- | --- |
   | 0 | 6 | 8 | 10 | 10 |
   | 1 | 8 | 10 | 12 | 12 |
   | 2 | 10 | 12 | 14 | 14 |
   | 3 | 12 | 14 | 16 | 16 |

   Upper Deck (Tiered on): 2 a Rat, +2 a tier, 6 at most (solo 2/4/6/6 by tier).
3. **The new wing.** Mats 11–16 sit west of the left crew bay at x −28, −32 … −48, 4 m apart like the old line.
   Checked clear of the crew bay (−23), the Tiered stairs (−25..−19.6, z 2.5..5.5: wing customers now walk the
   walkway to x −21 before cutting to the gate), the Lift (−44, 5), the mower shed (−58, 4) and the side nets (±64).
   The Club awning gets a wing extension sized to the bays built. The hose grew 60 → 86 m so it reaches mat 16 from
   the wash station (x 36).
4. **Built overnight / at once.** A bought tier's bays appear immediately (or next morning when bought overnight).
   For their first shift they look fresh: brighter turf and a gold number (bayline.js). One first-time TIP (once per
   browser, through the hinter): "New bays built. More golfers, more mud." with the arrow on the newest bay. It fires
   only on a live tier rise, never for a migrated save.
5. **Carry-over and migration.** Bays are concrete: `up.build` carries to every venue. An old save with
   `up.bays = 1` loads as `up.build = 2` (`migrateBays` in `cleanUpgrades`): solo 10, 2P 12, 3P+ 14, all six upper
   bays: nobody loses a bay. `up.bays` is dropped.

## Measurements

Customer balls a minute in the first two minutes (3 seeds, helpers 1, basket kept stocked;
scratchpad `bays-pace.mjs`):

| Crew | Tier 0 | Tier 1 | Tier 2 | Tier 3 |
| --- | --- | --- | --- | --- |
| 1P Muni | 45.3 (6 bays) | 59.3 (8) | 75.7 (10) | 92.0 (12) |
| 4P Muni | 75.7 (10) | 92.0 (12) | 106.3 (14) | 119.0 (16) |
| 4P Club | 75.3 (10) | 89.7 (12) | 107.5 (14) | 121.7 (16) |

About +15 balls a minute (~+100 a shift) per tier. At Muni BV (~$1.5–1.8) a tier is worth ~$150 a shift if picked:
tier 1 pays back in under a shift, tier 2 in 1–2 shifts. At the Club (BV ~$12) tier 3 is worth ~$1,000+ a shift
solo, so $4,000 is a real mid-game choice. Balance doesn't move unless a crew buys: base counts, Curb's twelve slots
and the RNG draws for a ten-bay crew are unchanged.

## Seam goldens

The three crewRun goldens fail in the current tree, but **not because of this work**: a copy of the tree with the
wing removed (`WING_X = []`, hose 60) gives the identical actual fingerprints (`dee0fab1`, `b2f72eff`, `dee0fab1`).
`MATS` stays the old ten (the landings fly from it); the wing draws no RNG and adds no Curb slot unless built.

## Files

- New: `web/js/bays.js` (pure rules: the line, the row, counts, migration, fixture sync), `web/js/bayline.js`
  (client visibility + fresh look), `test/bays.test.mjs` (11 tests).
- `web/js/sim.js`: `LINE`, `activeMats`/`activeUpper` from bays.js, `BUILD_ROW` replaces the bays row,
  `perks().build`, FIXTURES over LINE, `WASH.HOSE` 86.
- `server/crew.mjs`: migration in `cleanUpgrades`, mats over LINE (no RNG for the wing), `morningMud` skips unbuilt
  wing bays, `curbSlots`/`syncBays`, wash refuses unbuilt bays, `openBays` capped at the line, snapshot `nMats` =
  `openBays()`.
- `web/js/customers.js`: the line for routes and the swing cue; upper bays now indices 16–21; wing walk-out.
- `web/js/main.js`, `props.js`, `venues.js`, `signs.js`, `nudge.js`, `tips.js`, `settings.js`, `board.js`: as above.
- Tests updated: `shop.test.mjs` (the row), `onboarding.test.mjs` (row id), `council.test.mjs` (FIXTURES 18,
  hose 86), `shop3.test.mjs` (foam test builds the bays it sprays), `tiered.test.mjs` (wire is the 16-bay line).

## Screenshots (design/shots/)

- `bays-before-1p.jpg`: before, solo: 6 golfers and 4 empty, closed mats.
- `bays-after-1p.jpg`: after, solo, nothing built: six bays, nothing else.
- `bays-after-1p-built.jpg`: solo, tier 1 bought live: bays 7–8 appear with the fresh turf.
- `bays-after-4p-muni-tier1.jpg`: 4P, tier 1: twelve bays, the wing's first two west of the crew bay.
- `bays-after-4p-club-wing.jpg`, `bays-after-4p-club-line.jpg`: 4P at the Club, tier 3: all sixteen, dividers and
  the wing awning.

## Open issues

- League Night (builder "today") opens two extra bays for the day; they now appear for that day (nMats is
  `openBays()`), wing bays included past ten. Their mud syncs like any bay.
- A crew that shrinks mid-shift loses those bays at once (customers leave 'closed', the mud goes). Intended.
- During the overnight report a bought tier shows its mats at once, but its Curb slot joins at the next opening bell.
- I briefly navigated tab-8 (builder "range"'s 8099 preview) by mistake and cleared its session seat; its crew can
  rejoin by code from the lobby.
