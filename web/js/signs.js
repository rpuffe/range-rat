// Every text- or picture-bearing surface in the 3D world, as plain numbers: where it is, which way its readable
// face points, and where a player actually stands to read it. No THREE, no DOM, so test/signs.test.mjs can check
// that every sign is readable from each of its approach points, at every venue it exists in.
//
// Conventions (three.js): a PlaneGeometry's front face looks down its local +z, so a mesh with rotation.y = yaw
// faces { x: sin(yaw), z: cos(yaw) } (yawOf/facing below). A text plane is readable only from its front: seen from
// behind, a DoubleSide plane shows its text mirrored. So a sign that must read from both sides has TWO entries here
// and two single-sided planes in the scene (like the Board), never one DoubleSide plane.
//
// The builders read their yaw (and, where practical, their position) from this table, and tag each mesh with
// tagSign(mesh, id). `?signs` (signsdebug.js) then compares every tagged mesh's world normal with the table.
import { SIM, MATS, WASHER, FRIES, FIXTURE_BY_ID, POND, BANK } from './sim.js';
import { MAP } from './map.js';

export const yawOf = n => Math.atan2(n.x, n.z);
export const facing = yaw => ({ x: Math.sin(yaw), y: 0, z: Math.cos(yaw) });
const unit = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return { x: x / l, y: y / l, z: z / l }; };
const toward = (from, to) => unit(to.x - from.x, 0, to.z - from.z);
const EYE = 1.6;
const at = (x, z, y = EYE) => ({ x, y, z });
const flip = n => ({ x: -n.x, y: -n.y, z: -n.z });

// ---- the places players stand ----------------------------------------------------------------------------------
export const VIEWERS = {
  spawn: at(SIM.SPAWN.x, SIM.SPAWN.z),             // where a Rat drops in (main.js `me`)
  standFront: at(SIM.STAND.x, SIM.STAND.z - 1),    // in front of the ball return (owner layout), where everyone banks
  teeCentre: at(0, 0.5),                          // the middle of the mat line
  mat1: at(MATS[0].x, 0.5), mat10: at(MATS[9].x, 0.5),
  walkway: at(-3, 4),                             // just inside the gate
  path: at(12, 5.5),                              // the customers' path along the yard (scenery.js ENTRANCE.path)
  lotPath: at(-3, 28),                            // outside: the path from the lot to the gate
  reveal: { x: 20, y: 6, z: 22 },                 // the promotion reveal camera (round2.js REVEAL_POS)
  fieldBack: at(BANK.x, -40),                     // out on the range, turned round to the yard
  fieldMid: at(0, -20),
  kerbLeft: at(MAP.FIELD.xMin, -30),
  track: at(MAP.TRACK.x, MAP.TRACK.z),
  redFlag: at(MAP.FLAGS[0].x, MAP.FLAGS[0].z),
};

// ---- fixed placements the builders share ------------------------------------------------------------------------
export const BOARD_YAW = 35 * Math.PI / 180;   // the Board over the stand, turned toward the gate and the path
export const WASHER_YAW = Math.PI;   // the washer's front (window, drum, UNWASHED board) faces the field (-z)
const SHED_Z = FRIES.SHED.z + 2.25;  // main.js shedSign: the hut's centre (its counter side faces -z)
const GATE = { x: -3, z: 9.5 };      // mirrors scenery.js ENTRANCE.gate
const YARDAGE = [[100, -91.4], [150, -137.2], [200, -182.9]];   // scenery.js: yardage signs on the left net
const NORTH = { x: 0, y: 0, z: 1 }, SOUTH = { x: 0, y: 0, z: -1 };   // +z faces the road, -z faces the field

// from/to: the venues (0..5) a sign exists at; endless: true when it shows only in endless; venue 6 = endless.
export const SIGNS = [
  // The road sign (Curb Appeal fixture): one face to the field, one to the road and the promotion reveal.
  { id: 'road.field', file: 'main.js', pos: { x: FIXTURE_BY_ID.sign.x, y: 2, z: FIXTURE_BY_ID.sign.z }, normal: SOUTH,
    viewers: ['spawn', at(FIXTURE_BY_ID.sign.x, 4), 'fieldBack'] },
  { id: 'road.road', file: 'main.js', pos: { x: FIXTURE_BY_ID.sign.x, y: 2, z: FIXTURE_BY_ID.sign.z }, normal: NORTH,
    viewers: ['reveal', 'lotPath'] },
  // The entrance arch: FAIRWAY HOLDINGS · MUNI RANGE both ways.
  { id: 'arch.out', file: 'scenery.js', pos: { x: GATE.x, y: 5.45, z: GATE.z + 0.16 }, normal: NORTH, viewers: ['lotPath'] },
  { id: 'arch.in', file: 'scenery.js', pos: { x: GATE.x, y: 5.45, z: GATE.z - 0.16 }, normal: SOUTH, viewers: ['walkway', 'teeCentre'] },
  // The Board over the stand (DAYS WITHOUT AN INCIDENT and the slogans ride its banner).
  // Turned 35° toward the gate (playtest: it was edge-on to anyone walking the path from the lot); it
  // now also reads far better from the middle of the mat line.
  // Owner layout: the Board stays at the bank (BANK, the old stand spot) and reads from the ball return in front.
  { id: 'board.front', file: 'board.js', pos: { x: BANK.x, y: 5, z: BANK.z + 1.26 }, normal: facing(BOARD_YAW), viewers: ['reveal'] },
  { id: 'board.back', file: 'board.js', pos: { x: BANK.x, y: 5, z: BANK.z + 1.14 }, normal: facing(BOARD_YAW + Math.PI),
    viewers: ['spawn', 'standFront', 'fieldBack', 'path', 'teeCentre'] },
  // The ball washer, on the pipe between the return and the bank (owner layout): BALL WASHER angled toward the
  // drop-in spot and the return, a back face for anyone behind it, and the UNWASHED board on the front of the post.
  { id: 'washer.sign', file: 'washer.js', pos: { x: WASHER.x, y: 2.3, z: WASHER.z }, normal: facing(Math.PI + 0.55),
    viewers: ['spawn', 'standFront', 'fieldMid'] },
  { id: 'washer.sign.back', file: 'washer.js', pos: { x: WASHER.x, y: 2.3, z: WASHER.z }, normal: flip(facing(Math.PI + 0.55)),
    viewers: [at(WASHER.x, 8.8)] },
  { id: 'washer.board', file: 'washer.js', pos: { x: WASHER.x, y: 0.85, z: WASHER.z - 0.19 }, normal: facing(WASHER_YAW),
    viewers: ['standFront', at(WASHER.x + 1, WASHER.z - 2.8)] },
  // The snack shed and, from the Club, its KITCHEN board under the eave.
  { id: 'shed.sign', file: 'main.js', pos: { x: FRIES.SHED.x, y: 2.15, z: SHED_Z - 1.22 }, normal: SOUTH,
    viewers: [at(FRIES.SHED.x, FRIES.SHED.z), at(FRIES.SHED.x - 4, 0)] },
  { id: 'kitchen', file: 'venues.js', from: 1, pos: { x: FRIES.SHED.x, y: 2.65, z: SHED_Z - 1.75 }, normal: SOUTH,
    viewers: [at(FRIES.SHED.x, FRIES.SHED.z - 2), at(FRIES.SHED.x - 4, 0)] },
  // Mat numbers, flat on each mat's back edge: read from behind the mat, top of the digit toward the range.
  ...MATS.map(m => ({ id: `mat.${m.i + 1}`, file: 'main.js', pos: { x: m.x, y: 0.045, z: 0.62 }, normal: { x: 0, y: 1, z: 0 },
    up: SOUTH, viewers: [at(m.x, 2)] })),
  // Yardage boards on the left net, turned to the mat line.
  ...YARDAGE.map(([yd, z]) => {
    const pos = { x: MAP.NETS.side * -1 + 1, y: 2.3, z };
    return { id: `yardage.${yd}`, file: 'scenery.js', pos, normal: toward(pos, { x: 0, z: 0 }), viewers: ['teeCentre', 'mat1', 'mat10', 'spawn'] };
  }),
  // POND · CLOSED FOR SYNERGY, on the near shore, Muni only.
  { id: 'pond', file: 'terrain.js', to: 0, pos: { x: MAP.SIGN.x, y: 2.1, z: MAP.SIGN.z }, normal: NORTH, viewers: ['teeCentre', 'redFlag'] },
  // The LOST & FOUND plaque on the glass case by the pond (scuba.js), from the Club: read walking down from the yard.
  { id: 'lostfound', file: 'scuba.js', from: 1, pos: { x: POND.DOCK.x + 3.4, y: 0.25, z: POND.DOCK.z + 1.2 + 0.35 }, normal: NORTH,
    viewers: [at(POND.DOCK.x + 3.4, POND.DOCK.z + 6.5), at(0, -50)] },
  // The Stadium jumbotron, behind the stand.
  { id: 'jumbo', file: 'venues.js', from: 3, pos: { x: BANK.x, y: 12.8, z: 14 - 0.31 }, normal: SOUTH,
    viewers: ['standFront', 'track', 'fieldBack'] },
  // COUNTY LINE, out past the left kerb.
  { id: 'county', file: 'venues.js', from: 4, pos: { x: -118.9, y: 2.6, z: -30 }, normal: { x: 1, y: 0, z: 0 },
    viewers: ['kerbLeft', at(0, 4)] },
  // Endless: FOR SALE by the road sign.
  { id: 'forsale', file: 'venues.js', endless: true, pos: { x: 10, y: 1.3, z: 11 }, normal: SOUTH, viewers: ['spawn', at(10, 4)] },
];
export const SIGN_BY_ID = Object.fromEntries(SIGNS.map(s => [s.id, s]));

// Is the sign in the world at this venue (0..5; 6 = endless, which is venue 5 plus endless extras)?
export function signActive(sign, venue) {
  const endless = venue >= 6, v = Math.min(5, venue);
  if (sign.endless && !endless) return false;
  return v >= (sign.from ?? 0) && v <= (sign.to ?? 5);
}
export const signsAt = venue => SIGNS.filter(s => signActive(s, venue));
export const viewerPoint = v => typeof v === 'string' ? VIEWERS[v] : v;

// Can a player at `viewer` read `sign`? Front face toward them with dot(normal, toViewer) > minDot (0.5: within
// 60 degrees of square-on; less is edge-on, below 0 is the back, i.e. mirrored or invisible). A flat sign also
// needs its text's top pointing away from the viewer, or it reads upside down.
export function readable(sign, viewer, { minDot = 0.5 } = {}) {
  const p = viewerPoint(viewer), n = sign.normal;
  const d = unit(p.x - sign.pos.x, p.y - sign.pos.y, p.z - sign.pos.z);
  const dot = n.x * d.x + n.y * d.y + n.z * d.z;
  if (dot <= 0) return { ok: false, dot, why: 'back' };
  if (dot <= minDot) return { ok: false, dot, why: 'oblique' };
  if (sign.up && Math.abs(n.y) > 0.9) {
    const hx = sign.pos.x - p.x, hz = sign.pos.z - p.z;
    if (hx * sign.up.x + hz * sign.up.z <= 0) return { ok: false, dot, why: 'upside-down' };
  }
  return { ok: true, dot, why: '' };
}

// Tag a mesh as the sign `id` (the debug view checks it). `normal` is the mesh's local readable normal when its
// geometry is not a plain +z-facing plane (e.g. a plane rotated flat in the geometry: { x: 0, y: 1, z: 0 }).
export function tagSign(mesh, id, normal) {
  mesh.userData.sign = id;
  if (normal) mesh.userData.signNormal = normal;
  return mesh;
}
