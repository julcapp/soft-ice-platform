const test = require('node:test');
const assert = require('node:assert/strict');
const { savePickupCodeIssue } = require('../src/modules/order/PickupCodeJournal');

test('code rotation records customer history and Mini App availability in the same transaction', async () => {
  const calls = [], now = new Date('2026-10-14T10:00:00Z');
  const tx = { $queryRawUnsafe: async () => calls.push('lock'),
    order: { findFirst: async () => ({ activePickupCodeHash: 'previous' }), update: async () => calls.push('update') },
    payment: { findFirst: async () => ({ status: 'SUCCEEDED' }) }, saleFlow: { findFirst: async () => ({ currentState: 'PAID' }) },
    customerTimelineEvent: { create: async ({ data }) => { calls.push('timeline'); assert.equal(data.eventType, 'PICKUP_CODE_REISSUED'); assert.equal(data.metadata.previousCodeInvalidated, true); assert.equal(JSON.stringify(data).includes('secret-hash'), false); } },
    $executeRawUnsafe: async (sql, ...args) => { calls.push('message'); assert.equal(JSON.stringify(args).includes('secret-hash'), false); assert.equal(sql.includes('DELIVERED'), false); },
  };
  const result = await savePickupCodeIssue({ prisma: { $transaction: fn => fn(tx) }, customerId: 'buyer', order: { id: 'order', machineId: 'machine' }, codeHash: 'secret-hash', now, codeExpiresAt: new Date(now.getTime() + 300000), orderExpiresAt: new Date(now.getTime() + 3600000) });
  assert.deepEqual(calls, ['lock', 'update', 'timeline', 'message', 'message', 'message']);
  assert.ok(result.issuanceId); assert.ok(result.messageId);
});

test('a concurrently completed order cannot issue a code or journal message', async () => {
  let changed = false;
  const tx = { $queryRawUnsafe: async () => [], order: { findFirst: async () => null, update: async () => { changed = true; } } };
  await assert.rejects(savePickupCodeIssue({ prisma: { $transaction: fn => fn(tx) }, customerId: 'buyer', order: { id: 'order' }, now: new Date(), orderExpiresAt: new Date() }), { code: 'PICKUP_ORDER_NOT_AVAILABLE' });
  assert.equal(changed, false);
});
