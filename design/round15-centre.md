# Council round 13, builder 3 ("centre"): one centre text at the source, spawns, Gary in the Lift

Items 2 (with 8.1, 8.2's grace, 8.12 and 8.13's nag), 6 and 7b of `design/council-round13.md`.

## What I built

### 2a · `web/js/centre.js`: one arbiter, one ladder (landed first; main was messaged)

- **The ladder** (`PRI`):
  - 0: story card, note, epilogue, end card;
  - 1: stamps and ALERTs;
  - 2: PA;
  - 3: memo;
  - 4: tips and the checklist;
  - 5: toasts.
- **The API:** `createCentre({ now, eligible, onDrop })` gives `request({ id, pri, text, minSecs, secs, maxWait, ttl, hold, idle, resume, force })`, which returns a ticket. It also gives `up()`, `busy(pri)`, `release(id)`, `update()` and `quiet`.
- **The rules:**
  - Only one item draws.
  - A higher priority snaps a lower one out in 150 ms. A `resume` item (a PA card or a memo) goes back to the front of the queue with the time it had left. A PA comes back as its caption only, with no chime or voice.
  - A PA waits at most 6 s while it could show. After that its caption goes to the feed (`createSay({ feed })`).
  - `maxWait: 0` never queues. A tip fires only after 2 s of quiet (`quietFor`), or later.
  - The outgoing fade finishes before the next item starts.
  - `hold` stays until it is released (the story card, the end card).
  - `idle` is a standing line that draws only while nothing else is up or waiting, and steps aside for anything (the checklist).
- **`say.js` runs on it.**
  - `createSayModel` is now a thin client of `createCentre`. The bell lock, the Deck Cam hold, the story gate and the memo settle are its `eligible` rule.
  - The story card's turn is a priority-0 held claim.
  - The kind order changed to the ladder: ALERT now outranks and snaps a PA or memo.
  - The adapter exposes `sayer.centre` (request/release/up/busy/quietFor) and `sayer.clearOthers`.
- **One frame, one element, at any frame rate.** The browser checks ran at ~0.4 fps (a hidden pane), and three new rules came out of them:
  - A fade counts as over only after 2 painted frames.
  - A snapped element gets its transition back only after two painted frames.
  - Before any item draws (a say item, the story card's first frame, the checklist line), every other centre element that is logically off but still fading goes in one step (`clearOthers`).
- **Every writer is routed through it:**
  - `say.js` (PA, MEMO, STAMP, ALERT, TOAST, TIP);
  - `storycard.js`, through say's gate (a centre claim);
  - the checklist gate in `main.js` (an idle claim, `checkUp`);
  - tips: `hinter.tick` is gated on `sayer.centre.quietFor()`;
  - the boss lines: say ALERT/STAMP, as builder 1 left them;
  - the end card: `round2.js` holds a priority-0 claim while it is up.
  - `textBusy()` is now `sayer.centre.busy(PRI.MEMO) || storyCard.up`.
  - The ambient prompt also hides under a story card.
- **The sweep of the other builders' new lines:**
  - Builder 2's Tournament ALERT goes through `ctx.say` (so through centre).
  - Builder 1's loss stamp and loss line go through `say`.
  - No new direct DOM writers to the centre zone were found. `ending.js` only reads `#memo`.

### 2b · The clutter

- **Cash pops** (`payfloat.js` `createPayMerge`, wired in `main.js` `floatPay`):
  - one source's pops within 1.5 s merge into one float, "+$51.98 ×7" (a single pop keeps its own line);
  - at most 2 are up at once;
  - none while a priority 0–1 item, the hush or a story card holds the centre. This applies to the machinery roll-up too.
- **Name plates** (Rats, helpers, Gary's plate and bubble) are hidden within 15 m of the return during the hush, the note and the epilogue. This is one pass in `main.js`, with `plateFade` in `centrehooks.js`.
- **Gary's cameo bubble** ("Where do these go, boss?") waits for the epilogue's cards. This is a 2-line edit in `views/orbit.js`, which isn't my file (see below).
- **The washer tip** ("The washer hopper is empty. Bank some balls.", the crank prompt in `round2.js`) shows only when all of these hold:
  - the hopper has been empty for ≥ 30 s of shift time;
  - balls are out;
  - nothing at priority 0–3 is up or queued;
  - the crew has banked fewer than 1,000 balls lifetime (`BALLS_OUTSTANDING − outstanding`).

  The rule is `washerTipOk`.

### 2c · The boss owns the screen

- **From the warn to the stamp** (`fightMuted`, built on builder 1's `bossOwnsScreen`), three feeds are muted: the checklist's basket nag, the "No buckets. A customer left." / mat-refusal feed, and the free-helper feed.
- **After the fight**, one line is added: "3 customers left during the fight." (`createFightMute`).
- **The plug prompt** needs `phase === 'plug'` even while `plugging` is still latched. It no longer comes back after the stamp.

### 2e · Count the real screen

- **`web/js/centrewatch.js`** sets up `window.__centre` in `?debug`. It samples `CENTRE.ZONE` every 100 ms:
  - the zone: story-card, pa-card, memo, hint, todo, toast, bell-stamp, mowe-stamp, endcard, ending-flash;
  - only painted frames count: with no frame since the last sample, the screen shows nothing new.
- **What it records:** overlap frames (two or more elements at effective opacity > 0.3), the overlap episodes (`overlaps`), and a log of both texts for each episode.
- **`scripts/bots/textload.mjs`** (mine this round) runs the client's `say.js`, so it now runs `centre.js`. It also watches the whole shift on Tournament days (the Club from day 4) and on the Last Bucket.

### 8.1, 8.2

- **8.1:** an unfinished `sign` step no longer mutes the empty-basket alarm (`tips.js` `emptyBasketRat`). On a checklist day, `main.js` shows "↑ Fill the bucket basket!" as the checklist's line, with the arrow.
- **8.2:** the first card of a beat ignores presses for 1.2 s (1.8 s for the photo card). This is `storycard.js` `CARD_GRACE`, and it covers Ⓑ/Esc skips too.

### 6 · Spawns that look at the venue, not a roof

1. **`CLOCK_IN.LATE_FROM: 3 → 1`.** The Club and Tiered clock in on the late row; the Muni is unchanged.
2. **The spawn pitch eases from −0.2 to −0.28** over the first 1.5 s of a shift at venues ≥ 1 (`web/js/spawnlook.js`). Before this round the shift started at pitch 0.
   - The ease is added to the pitch each frame, so the stick and the mouse still count.
3. **The Tiered deck cutaway** now starts 4 m out from the deck's footprint (`venues.js` `DECK_NEAR`).
4. **The lamp post:** not needed. No post sits in the centre 20 % at any slot (see the measurements).

### 7b · Gary in the Lift, on one clock

- **`web/js/revealclock.js`** is the reveal's timeline, pure:
  - `revealStep(r, now)` runs on wall-clock seconds since the reveal began, so a slow frame jumps the camera and never lags;
  - `revealStory` holds the card-driven shot rules;
  - `cueReady` tells whether the camera has reached a cue's pose.
- **`round2.js`** now uses it, and exports `cueReady`.
- **`storycard.js`:** a card that names a cue waits, hidden and with its clock frozen, until the camera is at that pose. The cues come from `CARD_CUES` or `card.cue`:
  - promo:5 card 2 → 'lift';
  - the epilogue's card 1 → 'case'.

  It waits 3 s at most, and the camera already waits on the card's end. The same rule covers every reveal.
- **`onStory`** is a new option, a node-testable twin of the 'rr-story' event. Cards are now announced even when there is no DOM.

## Tests added

- **`test/centre.test.mjs`** (17 tests):
  - the ladder;
  - only one item draws;
  - higher snaps lower in 150 ms, and a PA resumes with the time it had left;
  - non-resumables are dropped;
  - a tip never queues;
  - the fade finishes before the next item;
  - PA maxWait 6 s goes to the feed, and the bell lock doesn't count as waiting;
  - `busy(pri)`;
  - held and idle claims;
  - in-place ids and the forced stamp;
  - `overlapOf`;
  - the washer tip gate;
  - pop merging, the 2-float cap and hidden pops;
  - the boss mute and its summary;
  - the plate fade;
  - 8.1;
  - 8.2.
- **`test/say.test.mjs`:** updated for the ladder (KINDS order, ALERT before PA) and the never-queue tip.
- **`test/round2.test.mjs`:** 7b. With a fake clock at 1 fps and at 60 fps, "Gary rides the Lift" is up while the camera is within 30 m of the Lift. A cued card waits for at most CUE_WAIT, and with no reveal it never waits.
- **`test/spawn13.test.mjs`:** `clockInSpot(1|2, k)` is outside the awning and the deck, off the washer, and outside the MOW-E post's reach, for k = 0..5. The pitch ease is −0.2 → −0.28 over 1.5 s and never at the Muni.
- **`test/look12.test.mjs`:** one assertion updated (Tiered now uses the late row).
- **`test/words.test.mjs`:** a builder 3 block (the fight summary, the basket line).

**Suite:** 1246 of 1246 pass at my last full run.

**Seam goldens:** `test/seam.test.mjs` passed unchanged. The Club spawn row moved, but the Club seam golden didn't (the lead should still check this at re-record).

## Measurements

### `textload.mjs`

Seeds 7 / 11 / 23 at 1P and at 4P, every morning plus the whole shift on boss, Stretch, Inspection, Tournament and Last Bucket days:

| Measure | 1P | 4P | Target |
| --- | --- | --- | --- |
| Overlaps | 0 in 63 windows | 0 in 63 windows | 0 |
| Promotion mornings | max 24 s, ≤ 3 items | max 24 s, ≤ 3 items | ≤ 28 s |
| Club days 1–4 | max 21.8 s | max 21.8 s | ≤ 22 s |
| First endless morning | 24.7 s, epilogue 3 of 3 | 24.7 s, epilogue 3 of 3 | — |

### Browser

- **The pane:** tab `rr-play-c` was fronted with `?debug` at 1024×640.
- **Paint rate:** the Browser pane stayed hidden (shared by four builders), so the page painted at ~0.4 fps. That is a harder test than a real screen.

`__centre.overlaps` at the end of each run:

| Run | Final code | Earlier code |
| --- | --- | --- |
| `orbital1` promotion morning (PA → promo:5's three cards → memo) | **0** (40 painted samples) | 2 (PA fading under card 1; card 3 fading under the memo). Fixed by the painted-frame rules and `clearOthers`. |
| First endless morning (`endless`: PA, epilogue cards, Gary at the case, memo) | **0** (2 runs) | — |
| Boss fight (`club3`: a club1 save at venue day 2, loaded through `POST /api/dev/crew`; warn → harvest → hunt → loss → +30 s) | **0** through the whole fight | 1, just after the loss: the "↑ Fill the bucket basket!" checklist line came up while "MOW-E got away. Rematch tomorrow." was still fading (0.4 fps). Fixed: the checklist's first frame now calls `clearOthers`. |

During the fight there was no basket line, and the plug prompt never showed outside the plug phase. The re-run on the final code is noted under open issues.

### The spawn pixel pass

`web/js/pixpass.js` renders the scene with an override shader that marks geometry above eye height within 25 m, then reads it back at 256×160.

- **All five spawns** (Club day 1, Tiered day 1, Stadium, County, Orbital), **all six slots**, at the eased pitch −0.28: roof or underside ≤ **6.5 %** of the frame. Slot by slot:
  - x 24.6: 6.5 %;
  - x 25.8: 4.5–6.5 %;
  - x 29.4: 0–5.3 %;
  - x 30.6: 0–2.4 %;
  - x 31.8: 0–0.6 %;
  - x 33.0: 0–0.8 %.
- **At −0.2** it is ≤ 9.5 %.
- **At the old pitch 0** it is 13–17 % from Tiered on, so the ease is what passes the check.
- **The centre 20 %:** no post. What sits within 8 m there is the washer (slot 25.8) and the crew's hired helpers standing at the late row (slots 29.4–31.8). The helpers are people, not static.

## Files touched

- **New:**
  - `web/js/centre.js`, `centrewatch.js`, `centrehooks.js`, `spawnlook.js`, `revealclock.js`, `pixpass.js`;
  - `test/centre.test.mjs`, `test/spawn13.test.mjs`;
  - `design/shots/c13-centre-lift.jpg`, `c13-centre-fight.jpg`, `c13-centre-case.jpg`.
- **Mine:**
  - `web/js/say.js`, `storycard.js`, `tips.js`, `payfloat.js`, `round2.js`, `venues.js`;
  - `sim.js` (the `CLOCK_IN` block only);
  - `scripts/bots/textload.mjs`;
  - `test/say.test.mjs`, `test/round2.test.mjs`.
- **`main.js`, my regions:**
  - the imports;
  - the sayer and storyCard construction (feed, `__centre`, `cueReady`);
  - the payfloat roller and merge;
  - the spawn pitch at clock-in, plus one line in the frame's camera step;
  - `textBusy` and the checklist gate (`checkUp`, 8.1's basket line, the fight mute and summary);
  - the hinter gate;
  - the ambient prompt;
  - the plates pass;
  - the setupRound2 ctx (`centre`, `centreBusy`).
- **Outside my regions (kept minimal):**
  - `main.js` event cases `freehelper` / `refuse`: a mute condition each (2c);
  - `main.js` prompt list: the plug prompt's `plugging` now also needs `phase === 'plug'` (2c, builder 1's region; one token);
  - `web/js/views/orbit.js`: the cameo bubble waits for the story card (3 lines; 2d's endless leak);
  - `test/look12.test.mjs`: one assertion (LATE_FROM);
  - `design/game-design.md`: my section appended;
  - `test/words.test.mjs`: my block appended.

## Open issues

- **The boss re-run on the final code** never got to watch the end of the fight. It read 0 overlaps over 179 painted samples, but the hidden pane stopped painting altogether from the harvest phase on, so the loss and the +30 s after it weren't sampled. The first run was clean through the whole fight. Its one post-fight overlap is fixed in code, but that fix hasn't been checked on a painting screen. **The three runs need repeating with the pane visible.**
- **The hired helpers** clock in standing directly in front of the late row (slots 29.4–31.8). They fill a third of the centre 20 % at spawn. They're people, not posts, but they block the first look; worth moving the helpers' clock-in row.
- **Gary's cameo spot** on the first endless morning is 0.5 m in front of slot 0, so the player's first frame after the case shot is his back. It's worth nudging `CAMEO.SPOT` or the slot.
- **The bell's stamp still skips a story card** (the existing round-12 rule). On the ladder the story card is 0 and the stamp is 1. I kept the bell's preemption because the bell ends the shift.
- **The checklist is an idle claim.** In practice it yields to toasts too, as the checklist gate did before. That is stricter than "tips and checklist at 4".
