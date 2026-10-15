const { test } = require('node:test');
const assert = require('node:assert/strict');
const { CRMService } = require('../src/modules/crm/CRMService');
const { assertCustomerAccess, effectiveCustomerStatus } = require('../src/modules/customer/CustomerAccessPolicy');
const now = new Date('2026-10-12T00:00:00Z');
function fixture() {
  const customer = { id: 'c1', name: 'Анна', status: 'active', orders: [], deletedAt: null };
  const audits = [];
  const service = new CRMService({ clock: () => now, repository: { findCustomer: async () => customer, mutateAccount: async (id, data, event) => { Object.assign(customer, data); audits.push(event); } } });
  return { service, customer, audits };
}
test('temporary block denies access until exact expiry and permanent block has no expiry', () => {
  const row = { status: 'blocked', blockedUntil: new Date(now.getTime() + 1) };
  assert.throws(() => assertCustomerAccess(row, now), { code: 'CUSTOMER_ACCOUNT_BLOCKED' });
  assert.doesNotThrow(() => assertCustomerAccess(row, row.blockedUntil));
  assert.equal(effectiveCustomerStatus(row, row.blockedUntil), 'active');
  assert.throws(() => assertCustomerAccess({ status: 'blocked' }, now), { code: 'CUSTOMER_ACCOUNT_BLOCKED' });
  assert.throws(() => assertCustomerAccess({ status: 'active', deletedAt: now }, now), { code: 'CUSTOMER_ACCOUNT_DELETED' });
});
test('account changes validate reason, future date and explicit deletion confirmation', async () => {
  const { service, customer, audits } = fixture();
  for (const body of [{ action: 'block' }, { action: 'block', reason: 'Проверка', until: now }, { action: 'delete', reason: 'Тест' }, { action: 'unknown' }]) await assert.rejects(() => service.manageAccount('c1', body, { actorId: 'owner' }), { code: 'CUSTOMER_ACCOUNT_ACTION_INVALID' });
  assert.equal(audits.length, 0);
  await service.manageAccount('c1', { action: 'block', reason: 'Тест', until: '2026-10-13T00:00:00Z' }, { actorId: 'owner' });
  assert.equal(customer.status, 'blocked'); assert.equal(audits[0].subjectId, 'owner');
  await service.manageAccount('c1', { action: 'unblock', reason: 'Проверка завершена' }, { actorId: 'owner' });
  assert.equal(customer.status, 'active');
  await service.manageAccount('c1', { action: 'delete', reason: 'Тест', confirmCustomerId: 'c1' }, { actorId: 'owner' });
  assert.equal(customer.status, 'deleted'); assert.deepEqual(customer.orders, []);
  await assert.rejects(() => service.manageAccount('c1', { action: 'unblock', reason: 'Тест' }), { code: 'CUSTOMER_ACCOUNT_ACTION_INVALID' });
});
test('profile edit cannot overwrite phone/email/status through supplied extra fields', async () => {
  const { service, customer } = fixture();
  await service.manageAccount('c1', { action: 'edit', name: 'Мария', email: 'unverified@example.org', status: 'deleted' }, { actorId: 'owner' });
  assert.equal(customer.name, 'Мария'); assert.equal(customer.email, undefined); assert.equal(customer.status, 'active');
});
