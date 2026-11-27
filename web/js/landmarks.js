// Council round 13 #4 (builder 2): Range landmarks, one thing worth buying at every venue. Pure: no THREE, no DOM, and
// DELIBERATELY no sim.js import (sim.js appends LANDMARK_ROW to SHOP, the DRONES_ROW / OWNER_ROW rule: a cycle otherwise).
//
// One crew row, one tier per venue, bought in order (the Club's before the Tiered one). Each is a visible build that
// stays at every later venue, like the bays, and most of them add a call:
//   1 Club     The Members' Bell     ring it (Ⓐ) for a bonus Tournament flight, once a shift, T-6:00..T-1:30
//   2 Tiered   The dimpl Tap Wall    every third deck order pours itself
//   3 Stadium  Stretch fireworks     the Stretch lights one more section; all answered: GRAND SLAM (+0.10 crowd)
//   4 County   Site 13's inspector   a second Inspection Hour at T-5:30 (45 s, ×4 in his patch)
//   5 Orbital  A star named Gary     five stars spelling GARY over the Lift (nothing in play: it's the heart)
// Prices are base × priceScale (4P ×2.2), as for every crew row. Council round 13 §4a (E): the Club and Tiered tiers fit
// inside the 4P surplus at the venue's last bell, so buying one never delays the promotion there.
export const LANDMARK = { BELL: 1, TAP: 2, FIREWORKS: 3, INSPECTOR: 4, STAR: 5 };

export const LANDMARK_ROW = {
  id: 'landmark', title: 'Range landmarks', minVenue: 1, club: 'tourney', tiers: [
    { name: 'No landmarks', desc: 'The range is a range. Corporate likes it that way.' },
    { name: "The Members' Bell", cost: 15_000, minVenue: 1, club: 'tourney', desc: 'A brass bell by the return. Ring it (Ⓐ) for a bonus Tournament flight, once a shift. Later it rings for the big moments.' },
    { name: 'The dimpl Tap Wall', cost: 200_000, minVenue: 2, desc: 'A neon tap wall on the deck. Every third deck order pours itself, so the cook can step away.' },
    { name: 'Stretch fireworks', cost: 5_000_000, minVenue: 3, desc: 'Launch racks on the stand roof. The Stretch lights one more section, and every answer fires a rocket. All of them: GRAND SLAM.' },
    { name: "Site 13's inspector", cost: 20_000_000, minVenue: 4, desc: 'On retainer, still in their jacket. A second Inspection Hour at T-5:30: 45 s, ×4 in his patch.' },
    { name: 'A star named Gary', cost: 60_000_000, minVenue: 5, desc: 'Five stars spelling GARY over the Lift. It does nothing. It is for Gary.' },
  ],
};
export const landmarkTier = up => Math.max(0, Math.min(LANDMARK_ROW.tiers.length - 1, (up?.landmark ?? 0) | 0));
export const hasLandmark = (up, tier) => landmarkTier(up) >= tier;

// ---- 1. the Members' Bell -----------------------------------------------------------------------------------------
// A brass bell on a post by the return. At the Club, Ⓐ within R rings a bonus flight, once a shift, while the shift has
// FROM..TO s left and no flight is out. At later venues it rings itself (sound only) for the venue's peak and at the bank.
export const BELL = { POST: { x: 21.5, z: 6.6 }, R: 2.2, FROM: 360, TO: 90 };
export const atBell = p => !!p && Math.hypot(p.x - BELL.POST.x, p.z - BELL.POST.z) <= BELL.R;
// Can the bell be rung now? left: seconds to the bell; rung: already rung this shift; live: a flight is out.
export const bellOpen = ({ left, rung = false, live = false, venue = 1, endless = false }) =>
  venue === 1 && !endless && !rung && !live && left <= BELL.FROM && left >= BELL.TO;
export const BELL_PROMPT = 'Ⓐ: ring the Members\' Bell';          // 4 words + the glyph
export const BELL_WAIT = 'The bell rings once a shift.';         // 6 words (the prompt after it's rung)

// ---- 2. the dimpl Tap Wall ----------------------------------------------------------------------------------------
// Every EVERY-th deck order (the 3rd, 6th, ...) pours itself the moment it's placed: paid as a served beer.
export const TAP = { EVERY: 3 };
export const tapPours = k => (k | 0) > 0 && (k | 0) % TAP.EVERY === 0;   // k: the shift's order count, 1-based
export const TAP_TICKET = 'TAP WALL GOT IT';

// ---- 3. Stretch fireworks -----------------------------------------------------------------------------------------
// The Stretch lights EXTRA more section (3 at 1-2P, 4 at 3P+). Each answered section fires a rocket over its stand; all
// answered is a GRAND SLAM: a volley and +SLAM crowd. Later venues: a volley at the bank.
export const FIREWORKS = { EXTRA: 1, SLAM: 0.10 };
export const GRAND_SLAM = 'GRAND SLAM!';   // the jumbotron and the feed

// ---- 4. Site 13's inspector, on retainer --------------------------------------------------------------------------
// A second Inspection Hour at T-5:30 (AT s left), SECS long, ×PAY in his patch (the first stays at T-3:30, ×3).
export const INSPECT2 = { AT: 330, SECS: 45, PAY: 4, LATEST: 260 };
export const inspect2Due = ({ left, done = false }) => !done && left <= INSPECT2.AT && left > INSPECT2.LATEST;
export const INSPECTOR_LABEL = 'INSPECTOR (EX-SITE 13)';
export const INSPECTOR_MEMO = "Site 13's inspector works for us now.";   // 7 words (builder 4's memo note slot)

// ---- 5. a star named Gary ----------------------------------------------------------------------------------------
export const STAR = { x: -44, y: 150, z: 5 };                     // over the Lift (MAP.LIFT), above the car's 120 m
export const STAR_LINE = "A star. Named Gary. I'll allow it.";    // Gary's next bubble (7 words)
export const STAR_PLAQUE = 'A star named Gary';                    // endless: the glass case's plaque line

// ---- the money check (council round 13 §4 verify, the bots) --------------------------------------------------------
// "Nothing worth buying": no unbought, unlocked tier anywhere costs ≤ SHIFTS shifts of income.
export const WORTH_SHIFTS = 2;
export const worthBuying = (price, shiftIncome) => price != null && shiftIncome > 0 && price <= WORTH_SHIFTS * shiftIncome;
