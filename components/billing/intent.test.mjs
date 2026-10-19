import { test } from 'node:test';
import assert from 'node:assert/strict';
import { financialIntent, createFinancialIntentStore, restoreFinancialFields } from './intent.ts';

function fakeStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
test('ambiguous retries retain their UUID until an edited intent or confirmed success', () => {
  const first = financialIntent(null, { amount: 500 });
  assert.match(first.key, /^[0-9a-f-]{36}$/);
  assert.equal(financialIntent(first, { amount: 500 }).key, first.key);
  assert.notEqual(financialIntent(first, { amount: 600 }).key, first.key);
  assert.notEqual(financialIntent(null, { amount: 500 }).key, first.key);
});
test('new store/component instance restores the full unresolved three-month invoice and same command', () => {
  const storage = fakeStorage();
  const payload = { gymId: 'gym-1', months: 3, paid: true, mode: 'WAVE', reference: 'received-123' };
  const original = createFinancialIntentStore(storage, new Map()).begin('invoice:gym-1', payload);
  const reopened = createFinancialIntentStore(storage, new Map());
  const restored = reopened.read('invoice:gym-1');
  assert.deepEqual(restored.payload, payload);
  assert.deepEqual(restoreFinancialFields(restored), { months: '3', paid: true, mode: 'WAVE', reference: 'received-123', amount: '', paidAt: '' });
  assert.equal(reopened.begin('invoice:gym-1', restored.payload).key, original.key);
  reopened.clear('invoice:gym-1');
  assert.equal(createFinancialIntentStore(storage, new Map()).read('invoice:gym-1'), null);
  assert.notEqual(reopened.begin('invoice:gym-1', payload).key, original.key);
});
test('partial payment amount, method, reference and exact timestamp survive reload without a new UUID', () => {
  const storage = fakeStorage();
  const payload = { amountFcfa: 1500, mode: 'ORANGE_MONEY', reference: 'mobile-9', paidAt: '2026-10-17T12:34:56.123Z' };
  const first = createFinancialIntentStore(storage, new Map()).begin('payment:invoice-1', payload);
  const reopened = createFinancialIntentStore(storage, new Map());
  const restored = reopened.read('payment:invoice-1');
  const fields = restoreFinancialFields(restored);
  assert.equal(fields.amount, '1500'); assert.equal(fields.mode, 'ORANGE_MONEY');
  assert.equal(fields.reference, 'mobile-9');
  assert.equal(new Date(fields.paidAt).toISOString(), payload.paidAt);
  assert.equal(reopened.begin('payment:invoice-1', restored.payload).key, first.key);
  assert.deepEqual(reopened.read('payment:invoice-1').payload, payload);
});
test('unavailable browser storage uses shared memory and explicit editing creates a new command', () => {
  const unavailable = { getItem() { throw Error('unavailable'); }, setItem() { throw Error('unavailable'); }, removeItem() { throw Error('unavailable'); } };
  const memory = new Map();
  const first = createFinancialIntentStore(unavailable, memory).begin('invoice:gym-1', { months: 3, paid: false });
  const reopened = createFinancialIntentStore(unavailable, memory);
  assert.equal(reopened.read('invoice:gym-1').key, first.key);
  assert.equal(restoreFinancialFields(reopened.read('invoice:gym-1')).paid, false);
  reopened.clear('invoice:gym-1');
  assert.notEqual(reopened.begin('invoice:gym-1', { months: 3, paid: false }).key, first.key);
});
