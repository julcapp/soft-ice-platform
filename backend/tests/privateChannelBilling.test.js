const test = require('node:test');
const assert = require('node:assert/strict');
const { PrivateChannelBillingService } = require('../src/modules/private_channel/PrivateChannelBillingService');

const clock = () => new Date('2026-08-22T16:00:00Z');

test('recurring request requires consent and stays disabled before first successful saved-method payment', async () => {
  const prisma = {
    $queryRawUnsafe: async () => [{ id: 'plan-1', code: 'PRIVATE_TELEGRAM_MONTHLY', isActive: true }],
    $executeRawUnsafe: async () => 1,
  };
  const service = new PrivateChannelBillingService({ prisma, clock });
  await assert.rejects(() => service.subscribe('c1', { recurringEnabled: true }), (error) => error.code === 'PRIVATE_CHANNEL_RECURRING_CONSENT_REQUIRED');
  const result = await service.subscribe('c1', { recurringEnabled: true, recurringConsentVersion: 'v1' });
  assert.equal(result.recurringRequested, true);
  assert.equal(result.recurringEnabled, false);
  assert.equal(result.status, 'PENDING');
  assert.equal(result.recurringConsentAt.toISOString(), '2026-08-22T16:00:00.000Z');
});

test('successful payment enables recurring only when consent and saved provider method both exist', async () => {
  let query = 0;
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async () => {
      query += 1;
      if (query === 1) return [{ id: 's1', customerId: 'c1', status: 'PENDING', recurringConsentAt: new Date('2026-08-22T15:59:00Z'), recurringConsentVersion: 'v1', currentPeriodEnd: null, priceRub: 99, billingPeriodDays: 30 }];
      return [];
    },
    $transaction: async (work) => work({ $executeRawUnsafe: async (...args) => { executed.push(args); return 1; } }),
  };
  const service = new PrivateChannelBillingService({ prisma, clock });
  const result = await service.recordPayment({ subscriptionId: 's1', idempotencyKey: 'pay-1', providerPaymentMethodRef: 'pm-1', providerPaymentId: 'p-1', amountRub: 99 });
  assert.equal(result.recurringEnabled, true);
  assert.equal(result.providerPaymentMethodRef, 'pm-1');
  assert.equal(executed.length, 2);
});

test('inactive plan cannot silently start paid subscription', async () => {
  const prisma = { $queryRawUnsafe: async () => [{ id: 'plan-1', code: 'PRIVATE_TELEGRAM_MONTHLY', isActive: false }] };
  const service = new PrivateChannelBillingService({ prisma, clock });
  await assert.rejects(() => service.subscribe('c1', {}), (error) => error.code === 'PRIVATE_CHANNEL_PLAN_NOT_ACTIVE');
});

test('billing stats provide subscriber count, paid revenue and renewal forecast', async () => {
  let call = 0;
  const prisma = {
    $queryRawUnsafe: async () => {
      call += 1;
      if (call === 1) return [{ count: 4 }];
      if (call === 2) return [{ count: 3, revenue: 297 }];
      return [{ forecast: 396 }];
    },
  };
  const service = new PrivateChannelBillingService({ prisma, clock });
  const result = await service.stats({ from: new Date('2026-08-01T00:00:00Z'), toExclusive: new Date('2026-08-23T00:00:00Z') });
  assert.deepEqual(result, { subscribers: 4, paidPaymentsInPeriod: 3, paidAmountRubInPeriod: 297, forecastNext30DaysRub: 396, status: 'READY' });
});
