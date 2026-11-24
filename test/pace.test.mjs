// The pace log (council round 4, build item 11): record shape, TSV, and the shell with a throwing store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRecord, append, toText, createPace, COLUMNS, MAX_RECORDS } from '../web/js/pace.js';

const report = { day: 4, venue: 5, title: 'Orbital Retrieval Officer', cash: 1234.567, deposited: 321, incidents: 2, quota: { hit: true, stamps: 7 } };
const ctx = { minutes: 41.234, value: { bv: 1.5, rate: 1.2, upkeep: 0.9, hustle: 1, curb: 1, kpi: 0.8 }, debris: 6 };

test('makeRecord has the spec shape', () => {
  const r = makeRecord(report, ctx);
  assert.deepEqual([r.day, r.venue, r.minutes, r.cash, r.banked, r.stamps, r.incidents, r.debris], [4, 5, 41.23, 1234.57, 321, 7, 2, 6]);
  assert.equal(r.kpi.venue, 0.8); assert.equal(r.quotaHit, true);
});
test('makeRecord tolerates a bare report', () => {
  const r = makeRecord({}, {});
  assert.equal(r.cash, 0); assert.equal(r.quotaHit, null); assert.equal(r.debris, null); assert.equal(r.kpi.venue, null);
});
test('append caps and toText has a header plus a row each', () => {
  let l = []; for (let i = 0; i < MAX_RECORDS + 5; i++) l = append(l, makeRecord({ day: i }));
  assert.equal(l.length, MAX_RECORDS); assert.equal(l[0].day, 5);
  const lines = toText([makeRecord(report, ctx)]).split('\n');
  assert.equal(lines.length, 2); assert.equal(lines[0].split('\t').length, COLUMNS.length); assert.equal(lines[1].split('\t').length, COLUMNS.length);
});
test('shell: only with ?pace, stores, and survives a throwing store', () => {
  const store = new Map(), good = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(createPace({ search: '', storage: good }).record(report), null);
  const p = createPace({ search: '?pace', storage: good }); p.record(report, ctx); p.record(report, ctx);
  assert.equal(p.list().length, 2); assert.equal(JSON.parse(store.get('rr.pace')).length, 2);
  const bad = { getItem() { throw new Error('no'); }, setItem() { throw new Error('no'); } };
  const q = createPace({ search: '?pace', storage: bad }); q.record(report, ctx);
  assert.equal(q.list().length, 1);
});
test('shell: copy reports failure instead of throwing', async () => {
  const p = createPace({ search: '?pace', clipboard: { writeText: async () => { throw new Error('denied'); } } });
  assert.equal(await p.copy(), false);
  let got; assert.equal(await createPace({ search: '?pace', clipboard: { writeText: async t => { got = t; } } }).copy(), true); assert.ok(got.startsWith('day\t'));
});
