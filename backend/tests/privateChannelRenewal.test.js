const test = require('node:test');
const assert = require('node:assert/strict');
const { PrivateChannelRenewalService, renewalKey } = require('../src/modules/private_channel/PrivateChannelRenewalService');

const clock = () => new Date('2026-08-23T00:00:00Z');
const subscription = {
  id: 'sub-1', customerId: 'c1', planCode: 'PRIVATE_MAX_MONTHLY', planName: 'MAX', priceRub: 99,
  billingPeriodDays: 30, currentPeriodEnd: new Date('2026-08-23T00:00:00Z'), providerPaymentMethodRef: 'pm-1',
};

test('renewal key is deterministic per attempt and changes for retries', () => {
  assert.equal(renewalKey('s1', '2026-08-23T00:00:00Z'), renewalKey('s1', new Date('2026-08-23T00:00:00Z')));
  assert.notEqual(renewalKey('s1', '2026-08-23T00:00:00Z', 1), renewalKey('s1', '2026-08-23T00:00:00Z', 2));
});

test('successful renewal attempt is created once and awaits authoritative webhook', async () => {
  const writes = [];
  const prisma = {
    $queryRawUnsafe: async () => [],
    $executeRawUnsafe: async (...args) => { writes.push(args); return 1; },
  };
  const paymentAdapter = { createRecurringPayment: async ({ idempotencyKey }) => ({ providerPaymentId: 'pay-1', status: 'pending', idempotencyKey }) };
  const service = new PrivateChannelRenewalService({ prisma, paymentAdapter, clock });
  const result = await service.processOne(subscription);
  assert.equal(result.status, 'AWAITING_WEBHOOK');
  assert.equal(result.providerPaymentId, 'pay-1');
  assert.equal(result.attemptCount, 1);
  assert.equal(writes.length, 2);
});

test('failed renewal schedules bounded retry inside grace period without extending paid period', async () => {
  const writes = [];
  const prisma = {
    $queryRawUnsafe: async () => [],
    $executeRawUnsafe: async (...args) => { writes.push(args); return 1; },
  };
  const error = Object.assign(new Error('declined'), { code: 'YOOKASSA_DECLINED' });
  const paymentAdapter = { createRecurringPayment: async () => { throw error; } };
  const service = new PrivateChannelRenewalService({ prisma, paymentAdapter, clock, graceHours: 72, retryHours: [6, 24], maxAttempts: 3 });
  const result = await service.processOne(subscription);
  assert.equal(result.status, 'FAILED');
  assert.equal(result.errorCode, 'YOOKASSA_DECLINED');
  assert.equal(result.nextRetryAt.toISOString(), '2026-08-23T06:00:00.000Z');
  assert.equal(result.graceUntil.toISOString(), '2026-08-26T00:00:00.000Z');
  assert.equal(writes.length, 2);
});

test('failed cycle before retry deadline is deferred and creates no second charge', async () => {
  let paymentCalls = 0;
  const prisma = {
    $queryRawUnsafe: async () => [{ id: 'attempt-1', status: 'FAILED', attemptCount: 1, nextRetryAt: new Date('2026-08-23T06:00:00Z') }],
    $executeRawUnsafe: async () => 1,
  };
  const paymentAdapter = { createRecurringPayment: async () => { paymentCalls += 1; } };
  const service = new PrivateChannelRenewalService({ prisma, paymentAdapter, clock });
  const result = await service.processOne(subscription);
  assert.equal(result.deferred, true);
  assert.equal(paymentCalls, 0);
});

test('existing awaiting webhook cycle is idempotent and never creates a second charge', async () => {
  let paymentCalls = 0;
  const prisma = {
    $queryRawUnsafe: async () => [{ id: 'attempt-1', status: 'AWAITING_WEBHOOK' }],
    $executeRawUnsafe: async () => 1,
  };
  const paymentAdapter = { createRecurringPayment: async () => { paymentCalls += 1; } };
  const service = new PrivateChannelRenewalService({ prisma, paymentAdapter, clock });
  const result = await service.processOne(subscription);
  assert.equal(result.idempotentReplay, true);
  assert.equal(paymentCalls, 0);
});

test('YooKassa succeeded webhook resolves matching renewal cycle', async () => {
  const writes = [];
  const prisma = {
    $executeRawUnsafe: async (...args) => { writes.push(args); return 1; },
  };
  const service = new PrivateChannelRenewalService({ prisma, paymentAdapter: {}, clock });
  const result = await service.markPaid('pay-1');
  assert.equal(result.changed, true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].includes('pay-1'), true);
});
