const test = require('node:test');
const assert = require('node:assert/strict');
const { FinancialReadinessService } = require('../src/modules/payment_profile/FinancialReadinessService');

function prisma({ provisional = 0, tables = true } = {}) {
  return {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('to_regclass')) return [{ receipts: tables, refunds: tables, costs: tables }];
      if (sql.includes('COUNT(*)::int')) return [{ count: provisional }];
      return [];
    },
  };
}

test('financial readiness is READY only when mandatory and operational checks are confirmed', async () => {
  const service = new FinancialReadinessService({ prisma: prisma(), paymentAdapter: { isConfigured: () => true, isReceiptConfigured: () => true }, env: { YOOKASSA_PAYMENT_WEBHOOK_VERIFIED: 'true', YOOKASSA_REFUND_WEBHOOK_VERIFIED: 'true', EMAIL_DELIVERY_VERIFIED: 'true', YOOKASSA_SETTLEMENT_REGISTRY_ENABLED: 'true' } });
  const result = await service.get();
  assert.equal(result.status, 'READY');
  assert.equal(result.policy.customerPaymentSurchargeEnabled, false);
  assert.equal(result.policy.automaticRefundFeeDeductionEnabled, false);
});

test('missing payment credentials or webhook blocks financial launch', async () => {
  const service = new FinancialReadinessService({ prisma: prisma(), paymentAdapter: { isConfigured: () => false, isReceiptConfigured: () => false }, env: {} });
  const result = await service.get();
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.checks.some((item) => item.code === 'YOOKASSA_CREDENTIALS' && item.status === 'BLOCKED'), true);
  assert.equal(result.checks.some((item) => item.code === 'PAYMENT_WEBHOOK' && item.status === 'BLOCKED'), true);
});

test('pending registry reconciliation degrades but does not falsify provider cost total', async () => {
  const service = new FinancialReadinessService({ prisma: prisma({ provisional: 3 }), paymentAdapter: { isConfigured: () => true, isReceiptConfigured: () => true }, env: { YOOKASSA_PAYMENT_WEBHOOK_VERIFIED: 'true', YOOKASSA_REFUND_WEBHOOK_VERIFIED: 'true', EMAIL_DELIVERY_VERIFIED: 'true', YOOKASSA_SETTLEMENT_REGISTRY_ENABLED: 'true' } });
  const result = await service.get();
  assert.equal(result.status, 'DEGRADED');
  assert.equal(result.checks.find((item) => item.code === 'PROVISIONAL_PROVIDER_COSTS').count, 3);
});
