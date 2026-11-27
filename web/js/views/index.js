// The venue seam, client side (council round 4, §3.0 and build item 3).
//
// Each venue module's look and feel lives in web/js/views/<id>.js and is plugged in with ONE line here.
// main.js calls the registered views; a view never edits main.js. The contract is in design/game-design.md
// ("How to add a venue module"); the short version:
//
//   export default {
//     id: 'tiered',            // the same id as the server module: s.mods[id] is its snapshot
//     venue: 2,                // active from this venue up (endless counts as 5)
//     create(ctx) {            // once, the first time the crew is at venue >= this one; build meshes here
//       return {               // the instance: every method optional
//         show(on),                         // the crew's venue moved across this view's line (hide / unhide)
//         onSnapshot(s, mine),              // every server tick; mine = s.mods?.[id]
//         onEvent(e),                       // every server event (before main.js's own handling)
//         tick(dt, t),                      // every frame, after the camera is placed (t: scene seconds)
//         prompt(btn, ibtn) -> string|null  // the HUD prompt, ahead of the generic ones (btn: use, ibtn: E/Ⓧ)
//         use() -> true                     // the use button (click / Space / Ⓐ) was pressed; true = consumed
//         interact() -> true                // the bucket button (E / Ⓧ); true = consumed
//         clamp(me) -> true                 // you placed my walker this frame (else clampToField runs)
//         speedMul(me) -> number|null       // walking speed multiplier here (null = the usual wade rule)
//         capturing() -> true               // freeze walking (a ride, a cutscene)
//         camera(cam, dt) -> true           // you placed the camera this frame (after main.js did)
//         banner(s) -> string | {text, bg, fg} | null   // the Board's slogan when there's no Last Call / Gary
//         amb(s) -> { crowd?, ... }         // ambience overrides (e.g. the Stadium's crowd level)
//         reportLines(r) -> [string]        // plain-text lines for the shift report card
//         aim(input|null)                   // every frame: {bay, yaw, pitch, power, color, world} at a crew bay with balls
//       };
//     },
//   };
//
// ctx (built in main.js): { scene, camera, me, crew(), balls(), act(msg), toast(text, secs), say(kind, text, opts) (say.js: the one centre slot; toast is say('TOAST')), feed(text),
//   showMemo(text, target, secs), board, SFX, nameOf(id), pad(), keys, world(), playing(), driving(),
//   cartPose, cartViews, terrain, sky, rightNet, rightPoles, venues (venues.js parts: deck, stands, crowd, crowdBob, jumbo, car, carY) }.
// Full contract: design/game-design.md, "Round 4 venue seam".

import { createViews as run } from './registry.js';

// ---- the production list: one import and one entry per venue view (wave C) -------------------------------------
import tiered from './tiered.js';
//
import deck from './deck.js';
//
import stadium from './stadium.js';
//
import county from './county.js';
//
import orbit from './orbit.js';
//
import owner from './owner.js';
import glasscase from './glasscase.js';   // council round 12 #3d (builder 3): Ball No. 1 in a glass case by the return
import tourney from './tourney.js';
import landmarks from './landmarks.js';   // council round 13 #4 (builder 2): the Range landmarks   // council round 13 #1 (builder 2): the Members' Tournament
import greens from './greens.js';   // council round 10 #6: the landing marker at every venue, ON THE GREEN!   // endless (round 7 #9): crew colours and the statue

export const VIEWS = [
  tiered,
  //
  deck,
  //
  stadium,
  //
  county,
  //
  orbit,
  //
  owner,
  //
  glasscase,
  //
  greens,
  //
  tourney,
  //
  landmarks,
];

// main.js: createViews(ctx) runs the list above (views/registry.js has the runner; tests use it directly).
export const createViews = (ctx, views = VIEWS) => run(ctx, views);
