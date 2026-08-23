const test = require('node:test');
const assert = require('node:assert/strict');
const { FinancialReadinessService } = require('../src/modules/payment_profile/FinancialReadinessService');

function prisma({ provisional = 0, openIssues = 0, tables = true } = {}) {
  return {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('to_regclass')) return [{ receipts: tables, refunds: tables, costs: tables, daily_reports: tables, reconciliation_issues: tables }];
      if (sql.includes('YooKassaReconciliationIssue')) return [{ count: openIssues }];
      if (sql.includes('PaymentProviderCost')) return [{ count: provisional }];
      return [];
    },
  };
}

const readyEnv = {
  YOOKASSA_PAYMENT_WEBHOOK_VERIFIED: 'true',
  YOOKASSA_REFUND_WEBHOOK_VERIFIED: 'true',
  EMAIL_DELIVERY_VERIFIED: 'true',
  YOOKASSA_SETTLEMENT_REGISTRY_ENABLED: 'true',
  YOOKASSA_REPORT_IMAP_USER: 'julcapp@yandex.ru',
  YOOKASSA_REPORT_IMAP_APP_PASSWORD: 'app-password',
  YOOKASSA_REPORT_IMAP_FOLDER: 'юкасса отчеты',
};

test('financial readiness is READY only when mandatory and operational checks are confirmed', async () => {
  const service = new FinancialReadinessService({ prisma: prisma(), paymentAdapter: { isConfigured: () => true, isReceiptConfigured: () => true }, env: readyEnv });
  const result = await service.get();
  assert.equal(result.status, 'READY');
  assert.equal(result.policy.customerPaymentSurchargeEnabled, false);
  assert.equal(result.policy.automaticRefundFeeDeductionEnabled, false);
  assert.equal(result.checks.find((item) => item.code === 'YOOKASSA_REPORT_IMAP').status, 'READY');
});

test('missing payment credentials or webhook blocks financial launch', async () => {
  const service = new FinancialReadinessService({ prisma: prisma(), paymentAdapter: { isConfigured: () => false, isReceiptConfigured: () => false }, env: {} });
  const result = await service.get();
  assert.equal(result.status, 'BLOCKED');
  assert.equal(result.checks.some((item) => item.code === 'YOOKASSA_CREDENTIALS' && item.status === 'BLOCKED'), true);
  assert.equal(result.checks.some((item) => item.code === 'PAYMENT_WEBHOOK' && item.status === 'BLOCKED'), true);
});

test('pending registry reconciliation degrades but does not falsify provider cost total', async () => {
  const service = new FinancialReadinessService({ prisma: prisma({ provisional: 3 }), paymentAdapter: { isConfigured: () => true, isReceiptConfigured: () => true }, env: readyEnv });
  const result = await service.get();
  assert.equal(result.status, 'DEGRADED');
  assert.equal(result.checks.find((item) => item.code === 'PROVISIONAL_PROVIDER_COSTS').count, 3);
});

test('open reconciliation issues degrade readiness', async () => {
  const service = new FinancialReadinessService({ prisma: prisma({ openIssues: 2 }), paymentAdapter: { isConfigured: () => true, isReceiptConfigured: () => true }, env: readyEnv });
  const result = await service.get();
  assert.equal(result.status, 'DEGRADED');
  assert.equal(result.checks.find((item) => item.code === 'OPEN_RECONCILIATION_ISSUES').count, 2);
});
