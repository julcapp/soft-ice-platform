const test = require('node:test');
const assert = require('node:assert/strict');
const { PaymentOperationsService } = require('../src/modules/payment_profile/PaymentOperationsService');

function fixture({ alreadyReturned = 0, existingRefund = null, providerStatus = 'succeeded' } = {}) {
  const executed = [];
  const notifications = [];
  let refundCalls = 0;
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('FROM "PrivateChannelPayment"')) return [{ id: 'pp1', customerId: 'c1', amountRub: 100, provider: 'YOOKASSA', providerPaymentId: 'pay1', subscriptionId: 's1', status: 'PAID' }];
      if (sql.includes('COALESCE(SUM("amountRub"')) return [{ total: alreadyReturned }];
      if (sql.includes('WHERE "idempotencyKey"')) return existingRefund ? [existingRefund] : [];
      if (sql.includes('FROM "PaymentReceipt"')) return [];
      if (sql.includes('WHERE "providerRefundId"')) return [{ id: 'r1', customerId: 'c1', sourceType: 'PRIVATE_CHANNEL', sourcePaymentId: 'pp1', subscriptionId: 's1', provider: 'YOOKASSA', amountRub: 40 }];
      return [];
    },
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const paymentAdapter = {
    createRefund: async () => { refundCalls += 1; return { id: 'refund-provider-1', status: providerStatus, receipt_registration: 'succeeded' }; },
    getRefund: async () => ({ id: 'refund-provider-1', status: 'succeeded', receipt_registration: 'succeeded', amount: { value: '40.00' } }),
  };
  const customerProfileCommunicationService = { createSystemNotification: async (_customerId, notification) => { notifications.push(notification); } };
  return { service: new PaymentOperationsService({ prisma, paymentAdapter, customerProfileCommunicationService, clock: () => new Date('2026-08-23T00:00:00Z') }), executed, notifications, getRefundCalls: () => refundCalls };
}

test('creates partial refund, records receipt state and significant notification', async () => {
  const f = fixture({ alreadyReturned: 20 });
  const result = await f.service.createRefund({ customerId: 'c1', sourceType: 'PRIVATE_CHANNEL', sourcePaymentId: 'pp1', amountRub: 40, reason: 'Частичный возврат', idempotencyKey: 'refund-key-1' });
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(result.remainingAfterRub, 40);
  assert.equal(f.getRefundCalls(), 1);
  assert.equal(f.executed.some((args) => String(args[0]).includes('INSERT INTO "PaymentRefund"')), true);
  assert.equal(f.executed.some((args) => String(args[0]).includes('INSERT INTO "PaymentReceipt"')), true);
  assert.equal(f.notifications.some((item) => item.type === 'PAYMENT_REFUND_SUCCEEDED' && item.significant), true);
});

test('rejects refund greater than remaining amount before provider call', async () => {
  const f = fixture({ alreadyReturned: 80 });
  await assert.rejects(() => f.service.createRefund({ customerId: 'c1', sourceType: 'PRIVATE_CHANNEL', sourcePaymentId: 'pp1', amountRub: 30, reason: 'Too much' }), (error) => error.code === 'PAYMENT_REFUND_EXCEEDS_REMAINING');
  assert.equal(f.getRefundCalls(), 0);
});

test('idempotent refund replay does not call provider twice', async () => {
  const f = fixture({ existingRefund: { id: 'existing', status: 'PENDING', idempotencyKey: 'same-key' } });
  const result = await f.service.createRefund({ customerId: 'c1', sourceType: 'PRIVATE_CHANNEL', sourcePaymentId: 'pp1', amountRub: 40, reason: 'Retry', idempotencyKey: 'same-key' });
  assert.equal(result.idempotentReplay, true);
  assert.equal(f.getRefundCalls(), 0);
});

test('authoritative refund webhook marks tracked refund succeeded', async () => {
  const f = fixture();
  const result = await f.service.handleRefundSucceeded('refund-provider-1');
  assert.equal(result.handled, true);
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(f.executed.some((args) => String(args[0]).includes("SET \"status\"='SUCCEEDED'")), true);
});
