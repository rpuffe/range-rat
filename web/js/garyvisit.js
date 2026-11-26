// Gary from Regional, owner playtest 3 §6: the drive-by intro, the schedule, the chat and the Seal's line.
// Pure (no DOM, no three): server/crew.mjs runs the rules, main.js draws the nameplate and the bubble.
import { GARY, mulberry32 } from './sim.js';

// ---- §6.1 the drive-by: Muni day 4 at 0:20, once ever --------------------------------------------------------
// He rolls in at the gate, loops past the return, lifts his clipboard at the crew (the 'wave' leg), and drives out.
export const GARY_INTRO = Object.freeze({
  DAY: 4, VENUE: 0, AT: 20, SPEED: 6, WAVE: 1.5,   // seconds into the shift; m/s; seconds of clipboard at the return
  ROUTE: Object.freeze([{ x: 60, z: 14 }, { x: 40, z: 9 }, { x: 31, z: 5.5, wave: true }, { x: 34, z: 14 }, { x: 60, z: 14 }]),
});
export const introDue = ({ day, venue, endless, shiftT, voiced }) =>
  !endless && venue === GARY_INTRO.VENUE && day === GARY_INTRO.DAY && shiftT >= GARY_INTRO.AT && !voiced;
export const newIntro = () => ({ leg: 1, x: GARY_INTRO.ROUTE[0].x, z: GARY_INTRO.ROUTE[0].z, yaw: Math.PI / 2, wave: 0, done: false });
// One step along the route. Returns 'wave' on the frame he starts waving, 'done' when he's out the gate, else null.
export function stepIntro(it, dt) {
  if (it.done) return null;
  if (it.wave > 0) { it.wave = Math.max(0, it.wave - dt); return null; }
  const to = GARY_INTRO.ROUTE[it.leg];
  const dx = to.x - it.x, dz = to.z - it.z, d = Math.hypot(dx, dz), step = GARY_INTRO.SPEED * dt;
  if (d > step) { it.x += dx / d * step; it.z += dz / d * step; it.yaw = Math.atan2(-dx, -dz); return null; }
  it.x = to.x; it.z = to.z; it.leg++;
  if (it.leg >= GARY_INTRO.ROUTE.length) { it.done = true; return 'done'; }
  if (to.wave) { it.wave = GARY_INTRO.WAVE; return 'wave'; }
  return null;
}

// ---- §6.2 the schedule ------------------------------------------------------------------------------------------
// The next visit after one on `day`: 2 days later, or 3 with a 1-in-3 chance. The draw is seeded from the crew's
// seed and the day (its own stream, so the shift's rng sequence, and every seeded golden, is untouched).
export function garyNext(day, seed = 1) {
  const r = mulberry32(((seed | 0) ^ Math.imul(day | 0, 0x9e3779b1)) >>> 0)();
  return day + (r < GARY.GAP_LONG_P ? GARY.GAP_LONG : GARY.GAP);
}
// The morning's check: a missed visit (a day he couldn't come) comes today; one on a venue's first day (a promotion's
// reveal morning) slips to its second. An old save with no garyDay gets today (from day 4).
// Council round 11 #1 (builder 1): the boss owns its day. A visit due on a boss morning (MOW-E at the Club, MOW-E 2.0 at
// the Stadium) slips to the next day, as one on a reveal morning does.
export const bossSlip = (garyDay, day, boss = false) => (boss && garyDay === day ? day + 1 : garyDay);
export function garyMorning(garyDay, day, reveal = false) {
  let g = garyDay == null ? Math.max(day, GARY.FROM_DAY) : garyDay;
  if (g < day) g = day;
  if (g === day && reveal) g = day + 1;
  return g;
}

// ---- §6.3 chatting -------------------------------------------------------------------------------------------------
// Parked: sitting at a stop. (Through the warning he waits at the gate, past the fence where no Rat can reach
// CHAT_R, so the warning keeps "ping his cart": pings there still count.)
export const garyParked = g => !!g && g.phase === 'drive' && (g.pause ?? 0) > 0;
// Seconds of stall left this visit (chat and cart pings share GARY.STALL_BUDGET).
export const stallRoom = g => Math.max(0, GARY.STALL_BUDGET - (g?.stalled ?? 0));
// A cart ping's stall: GARY.STALL, clamped to what's left of the budget (a ping after 10 s of chat adds 2 s).
export const pingStall = g => Math.min(GARY.STALL, stallRoom(g));

// One server step of the chat. rats: [{ id, x, z, held, down }] (held: Ⓐ / Click / Space held). Holding within
// CHAT_R of a parked Gary keeps him parked (his pause grows by dt) until the budget runs out. When the chat ends he
// waits CHAT_RESUME s ("Right, then."). g.spare: the Rats he talked to (he never runs them over). Returns events.
export function stepChat(g, rats, dt) {
  const ev = [];
  if (!g) return ev;
  const room = stallRoom(g), cur = g.chat?.by;
  const ok = r => r.held && !(r.down > 0) && Math.hypot(r.x - g.x, r.z - g.z) <= GARY.CHAT_R;
  const who = garyParked(g) && room > 0 ? rats.find(r => r.id === cur && ok(r)) ?? rats.find(ok) ?? null : null;
  if (who) {
    const add = Math.min(dt, room);
    g.stalled = (g.stalled ?? 0) + add;
    g.pause = Math.max(0, g.pause ?? 0) + add;
    if (cur !== who.id) {
      if (cur) ev.push({ t: 'garyChat', by: cur, on: false });
      g.chat = { by: who.id, t: 0 };
      if (!(g.spare ?? []).includes(who.id)) g.spare = [...(g.spare ?? []), who.id];
      ev.push({ t: 'garyChat', by: who.id, on: true });
    }
    g.chat.t += add;
  } else if (g.chat) {
    ev.push({ t: 'garyChat', by: g.chat.by, on: false });
    g.chat = null;
    g.pause = Math.max(g.pause ?? 0, GARY.CHAT_RESUME);
  }
  return ev;
}

// What Gary says while you hold (a world bubble, not centre text): a three-word bit every 2 s, then "Right, then."
export const CHAT_BITS = ['…the 1987 audit…', '…my boat, mostly…', '…lovely mats, really…', '…Regional has concerns…', '…anyway, the clipboard…'];
export const CHAT_BIT_SECS = 2;
export const CHAT_END = 'Right, then.';
export const chatBit = t => CHAT_BITS[Math.floor(Math.max(0, t) / CHAT_BIT_SECS) % CHAT_BITS.length];
export const CHAT_FEED = 'You asked Gary about his boat.';

// ---- §6.1 the nameplate, §6.4 the Seal's line ------------------------------------------------------------------------
export const garyPlate = first => (first ? 'GARY · REGIONAL MANAGER' : 'GARY');
export const SEAL_LINE = 'Gary approves! ×1.25 a ball till the bell.';
// The verdict's commendations: a pass with the full huddle 3, without 1, never past the cap.
export const commendFor = ({ pass, huddle, have }) => (pass ? Math.max(0, Math.min(GARY.COMMEND_CAP - have, huddle ? GARY.COMMEND_HUDDLE : GARY.COMMEND_PASS)) : 0);
