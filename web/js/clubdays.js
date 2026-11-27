// Round 11 (expert #5): stagger the Club, one idea a day (the owner's own rule, which works so well at the Muni).
// Pure, imports nothing (map.js, creekdive.js, mowe.js, sim.js and crew.mjs all read it).
//   Club day 1: the kitchen and FED (the snack shed opens with the promotion), the square ball.
//   Club day 2: the pond fills (the water, the dock, the buddy pump, lead balls, the first treasure), the gold ball.
//   Club day 3: the creek dive, the Back return, MOW-E (council round 11: the day belongs to MOW-E's boss fight).
//   Club day 4: the super-bouncy ball and the splitter (council round 11 #3; the splitter stays global day 7 elsewhere).
// Before its day a thing is simply not there yet: the pond is the Muni's mud flat, the creek runs but won't take a
// diver, the Back return's tier is locked ("Club day 3"), MOW-E stays in his shed, and the kind isn't hit.
// Only the Club staggers: from Tiered on (and in endless) everything is open, as before. `vday` is the venue day
// (crew.venueDay: 1 on the first Club shift). A world with no vday (an old snapshot, a test) is fully open.
export const CLUB_DAY = {
  pond: 2, pump: 2, treasure: 2, lead: 2, gold: 2,
  creekDive: 3, back: 3, mower: 3,
  bouncy: 4, splitter: 4,
  tourney: 4,   // council round 13 #1: the Members' Tournament (tourney.js), and the Members' Bell landmark (landmarks.js)
  square: 1,
};
export const CLUB = 1;   // the venue index

// Is `what` open at this venue and venue day? (vday null/undefined: open.)
export function clubOpen(what, venue, vday) {
  if ((venue ?? 0) !== CLUB || vday == null) return true;
  return vday >= (CLUB_DAY[what] ?? 1);
}
// The same, from a world object ({ venue, vday }: crew.world() and main.js world()).
export const clubOpenAt = (what, world) => clubOpen(what, world?.venue ?? 0, world?.vday);
// The world's vday field: only at the Club and never in endless (so nothing else moves).
export const worldVday = (venue, venueDay, endless = false) => ((venue ?? 0) === CLUB && !endless ? Math.max(1, venueDay | 0) : undefined);
// The lock label for a Club tier not open yet: "Club day 3".
export const clubDayLabel = what => `Club day ${CLUB_DAY[what] ?? 1}`;
