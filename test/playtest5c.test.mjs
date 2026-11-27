// Playthrough 5, the client half (Builder C): the report's Sign gate, the labels, the shop's order and goal tags, the
// empty-basket alarm, Gary's sign stop in chat reach, and the Deck Cam's hold over a PA card already up.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { promoPanelHtml, nextGate, goalShopIds, shopSort } from '../web/js/promopanel.js';
import { signedMoney, targetStamp } from '../web/js/bvtext.js';
import { emptyBasketRat, withBasketAlarm } from '../web/js/tips.js';
import { createSayModel } from '../web/js/say.js';
import { GARY, SIM } from '../web/js/sim.js';

const promo = (ready = true) => ({ next: 'Tiered', fee: 9000, ready, signed: [], done: ready ? 5 : 3, of: 5 });

test('A1: a done, unsigned card: Sign is the primary, Next waits ("Sign to move up"), "Not yet" frees it', () => {
  const h = promoPanelHtml(promo(), { goals: { rows: [] }, signed: false, signedN: 0, onlineN: 1 });
  assert.match(h, /<button id="sign-btn" data-primary>Sign the franchise agreement/);
  assert.match(h, /id="notyet-btn"/);
  assert.deepEqual(nextGate(promo(), {}), { text: 'Sign to move up' });
  assert.equal(nextGate(promo(), { declined: true }), null, 'Not yet: Ready as usual');
  assert.equal(nextGate(promo(), { signed: true }), null, 'signed: Ready waits on the others (the server holds it)');
  assert.equal(nextGate(promo(), { promotedTo: 'Tiered' }), null);
  assert.equal(nextGate(promo(false), {}), null, 'card not done: Next as usual');
  const signed = promoPanelHtml(promo(), { goals: { rows: [] }, signed: true, signedN: 1, onlineN: 2 });
  assert.doesNotMatch(signed, /data-primary|notyet-btn/);
  assert.doesNotMatch(promoPanelHtml(promo(), { goals: { rows: [] }, declined: true }), /notyet-btn/);
});

test('B10: the card heading names the venue it is for: "To reach Tiered" (round 14 6.9)', () => {
  assert.match(promoPanelHtml(promo(false), { goals: { rows: [] } }), /<h3>To reach Tiered<\/h3>/);
});

test('B7 / A4: "−$3,800" (not "+$-3,800"), and the stamp says DAILY TARGET', () => {
  assert.equal(signedMoney(-3800), '−$3,800');
  assert.equal(signedMoney(1200), '+$1,200');
  assert.equal(signedMoney(0), '+$0');
  assert.equal(targetStamp({ hit: true }), 'DAILY TARGET HIT');
  assert.equal(targetStamp({ hit: false }), 'DAILY TARGET MISSED');
  assert.equal(targetStamp({ hit: false, idle: true }), 'DAILY TARGET MISSED: nothing was banked');
});

test('C10: the shop sorts maxed rows last (endless Owner rows still first); open buy goals tag their row', () => {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'tether' }, { id: 'own', endless: true }];
  const maxed = it => it.id === 'a' || it.id === 'b';
  assert.deepEqual(shopSort(items, { maxed }).map(i => i.id), ['tether', 'own', 'a', 'b']);
  assert.deepEqual(shopSort(items, { maxed, endless: true }).map(i => i.id), ['own', 'tether', 'a', 'b']);
  const rows = [{ id: 'tether', done: false }, { id: 'gutters', done: true }, { id: 'bank', done: false }];
  assert.deepEqual([...goalShopIds(rows)], ['tether']);
});

test('A5: the basket runs dry mid-day: the nearest able Rat is re-dealt the basket (over a morning line, never Gary)', () => {
  const at = { x: 23, z: 8 };
  const players = [
    { id: 'a', online: true, x: 0, z: 0 },
    { id: 'b', online: true, x: 22, z: 8, diving: true },
    { id: 'c', online: true, x: 20, z: 5 },
    { id: 'd', online: false, x: 23, z: 8 },
  ];
  const c = { phase: 'shift', basket: 0, players };
  assert.equal(emptyBasketRat(c, true, at), 'c');
  assert.equal(emptyBasketRat(c, false, at), null, 'empty since the morning: the morning deal has it');
  assert.equal(emptyBasketRat({ ...c, basket: 3 }, true, at), null);
  assert.equal(emptyBasketRat({ ...c, phase: 'report' }, true, at), null);
  assert.equal(withBasketAlarm(null, true), 'am:basket');
  assert.equal(withBasketAlarm('am:goal:bank:300', true), 'am:basket');
  assert.equal(withBasketAlarm('gary:sign', true), 'gary:sign');
  assert.equal(withBasketAlarm('am:sign', false), 'am:sign');
});

test("A7: Gary's sign stop is within chat reach of the field's edge (a Rat can't pass z 9)", () => {
  const stop = GARY.STOPS.find(s => s.id === 'sign');
  assert.ok(Math.abs(stop.z - SIM.FIELD.zMax) <= GARY.CHAT_R - 0.5, `${stop.z - SIM.FIELD.zMax} m from the fence`);
});

test('B3: the Deck Cam sends a PA card already up back to the queue; it shows again after the cut', () => {
  let t = 0;
  const m = createSayModel({ now: () => t });
  m.say('PA', 'Corporate reminds you.', { secs: 4 });
  assert.equal(m.update()?.kind, 'PA');
  t = 1; m.hold(2);
  assert.equal(m.update(), null, 'nothing over the fall');
  t = 2.5; assert.equal(m.update(), null);
  t = 3.4; assert.equal(m.update()?.kind, 'PA', 'after the cut');
});
