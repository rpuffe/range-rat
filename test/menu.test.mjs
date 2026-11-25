// Owner playtest 3 §7.3: every card works on a pad (web/js/menufocus.js), on a tiny element stub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { primaryOf, focusMemo, focusRestore, menuA, MENU_A_GRACE } from '../web/js/menufocus.js';

const el = (tagName, attrs = {}) => ({
  tagName, id: attrs.id ?? '', dataset: attrs.buy ? { buy: attrs.buy } : {},
  getAttribute: n => (n in attrs ? String(attrs[n]) : null),
});
const root = kids => ({ id: 'report', contains: x => kids.includes(x) });

test('the focus rule picks [data-primary]', () => {
  const buy = el('BUTTON', { buy: 'picker' }), sign = el('BUTTON', { id: 'sign-btn' }), next = el('BUTTON', { id: 'next', 'data-primary': '' });
  assert.equal(primaryOf([sign, buy, next], 'report'), next);
});

test("the shop's primary is its first affordable Buy; otherwise the first target", () => {
  const a = el('BUTTON', { buy: 'picker' }), close = el('BUTTON', { id: 'store-close' });
  assert.equal(primaryOf([a, close], 'store'), a);
  assert.equal(primaryOf([close], 'store'), close);
  assert.equal(primaryOf([], 'store'), null);
});

test('a re-render keeps the focused data-buy', () => {
  const old = el('BUTTON', { buy: 'shoes' }), r = root([old]);
  const memo = focusMemo(old, r);
  assert.deepEqual(memo, { buy: 'shoes' });
  const fresh = [el('BUTTON', { buy: 'picker' }), el('BUTTON', { buy: 'shoes' }), el('BUTTON', { id: 'next', 'data-primary': '' })];
  assert.equal(focusRestore(memo, fresh, 'report', ['picker', 'shoes']), fresh[1]);
});

test('a Buy that is gone hands focus to the next Buy along, never to Next shift', () => {
  const next = el('BUTTON', { id: 'next', 'data-primary': '' }), cart = el('BUTTON', { buy: 'cart' }), picker = el('BUTTON', { buy: 'picker' });
  assert.equal(focusRestore({ buy: 'shoes' }, [picker, cart, next], 'report', ['picker', 'shoes', 'cart']), cart);
  assert.equal(focusRestore({ buy: 'cart' }, [picker, next], 'report', ['picker', 'shoes', 'cart']), picker);
  assert.equal(focusRestore({ buy: 'cart' }, [next], 'report', ['cart']), null, 'no Buy left: nothing focused (the next Ⓐ only focuses Next)');
});

test('an id survives a re-render (the Sign button)', () => {
  const sign = el('BUTTON', { id: 'sign-btn' }), next = el('BUTTON', { id: 'next', 'data-primary': '' });
  assert.equal(focusRestore({ id: 'sign-btn' }, [sign, next], 'report'), sign);
  assert.equal(focusRestore({ id: 'sign-btn' }, [next], 'report'), next);
  assert.equal(focusMemo(sign, root([])), null, 'focus outside the card is not remembered');
  assert.equal(focusRestore(null, [next]), null);
});

test('Ⓐ with nothing focused focuses and does not click; a fresh card ignores it for a moment', () => {
  const b = el('BUTTON', { id: 'next' }), inp = el('INPUT', { id: 'name' });
  assert.equal(menuA({ focused: null, sinceOpen: 5 }), 'focus');
  assert.equal(menuA({ focused: b, sinceOpen: 5 }), 'click');
  assert.equal(menuA({ focused: inp, sinceOpen: 5 }), 'input');
  assert.equal(menuA({ focused: b, sinceOpen: MENU_A_GRACE / 2 }), 'wait');
});
