const test = require('node:test');
const assert = require('node:assert/strict');
const { PrivateChannelRecoveryService } = require('../src/modules/private_channel/PrivateChannelRecoveryService');

const clock = () => new Date('2026-08-23T00:00:00Z');

test('EXHAUSTED recovery never triggers an extra automatic charge', async () => {
  let renewalCalls = 0;
  const prisma = {
    $queryRawUnsafe: async () => [{ id: 'a1', status: 'EXHAUSTED', subscriptionId: 's1', customerId: 'c1', planCode: 'PRIVATE_MAX_MONTHLY' }],
  };
  const service = new PrivateChannelRecoveryService({ prisma, renewalService: { processOne: async () => { renewalCalls += 1; } }, clock });
  await assert.rejects(() => service.retry('a1'), (error) => error.code === 'PRIVATE_CHANNEL_RENEWAL_CUSTOMER_ACTION_REQUIRED');
  assert.equal(renewalCalls, 0);
});

test('FAILED recovery respects nextRetryAt before calling YooKassa flow', async () => {
  let renewalCalls = 0;
  const prisma = {
    $queryRawUnsafe: async () => [{ id: 'a1', status: 'FAILED', subscriptionId: 's1', customerId: 'c1', nextRetryAt: new Date('2026-08-23T06:00:00Z') }],
  };
  const service = new PrivateChannelRecoveryService({ prisma, renewalService: { processOne: async () => { renewalCalls += 1; } }, clock });
  await assert.rejects(() => service.retry('a1'), (error) => error.code === 'PRIVATE_CHANNEL_RENEWAL_RETRY_NOT_DUE');
  assert.equal(renewalCalls, 0);
});

test('failed renewal creates significant in-app notification once', async () => {
  const writes = [];
  let query = 0;
  const prisma = {
    $queryRawUnsafe: async () => {
      query += 1;
      if (query === 1) return [{ id: 'a1', subscriptionId: 's1', customerId: 'c1', channelType: 'MAX', status: 'FAILED', attemptCount: 1, graceUntil: new Date('2026-08-26T00:00:00Z') }];
      return [];
    },
    $executeRawUnsafe: async (...args) => { writes.push(args); return 1; },
  };
  const service = new PrivateChannelRecoveryService({ prisma, renewalService: {}, clock });
  await service.syncAttempt({ id: 'a1', status: 'FAILED' });
  assert.equal(writes.length, 1);
  assert.match(writes[0][0], /CustomerNotification/);
  assert.match(writes[0][0], /significant/);
});

test('expired access processing delegates only EXHAUSTED subscriptions to access service', async () => {
  const calls = [];
  const prisma = { $queryRawUnsafe: async () => [{ subscriptionId: 's1', channelType: 'TELEGRAM' }, { subscriptionId: 's2', channelType: 'MAX' }] };
  const accessService = { expireSubscriptionAccess: async (input) => { calls.push(input); return input; } };
  const service = new PrivateChannelRecoveryService({ prisma, renewalService: {}, accessService, clock });
  const result = await service.expireExhaustedAccess();
  assert.equal(result.length, 2);
  assert.deepEqual(calls, [{ subscriptionId: 's1', channelType: 'TELEGRAM' }, { subscriptionId: 's2', channelType: 'MAX' }]);
});
