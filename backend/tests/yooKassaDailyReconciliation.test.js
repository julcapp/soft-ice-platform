const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, normalizePaymentRow, normalizeRefundRow, YooKassaDailyReconciliationService } = require('../src/modules/payment_profile/YooKassaDailyReconciliationService');

test('parses YooKassa payment CSV with commission and VAT fields', () => {
  const rows = parseCsv('Идентификатор платежа;Сумма платежа;Сумма за вычетом комиссии и НДС;Сумма комиссии без НДС;НДС с комиссии\npay_1;100.00;96.34;3.00;0.66');
  const row = normalizePaymentRow(rows[0]);
  assert.deepEqual(row, { paymentId: 'pay_1', grossAmountRub: 100, netAmountRub: 96.34, commissionRub: 3, commissionVatRub: 0.66, providerCostRub: 3.66, paymentMethod: null });
});

test('parses YooKassa refund CSV', () => {
  const rows = parseCsv('Идентификатор возврата;Идентификатор платежа;Сумма возврата\nref_1;pay_1;40.00');
  assert.deepEqual(normalizeRefundRow(rows[0]), { refundId: 'ref_1', paymentId: 'pay_1', refundAmountRub: 40 });
});

test('payment report finalizes provider cost and reports clean reconciliation', async () => {
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('YooKassaDailyReport') && sql.includes('fileHash')) return [];
      if (sql.includes('PaymentProviderCost')) return [{ id: 'pc1', grossAmountRub: 100, netIncomeRub: 96.34 }];
      return [];
    },
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const service = new YooKassaDailyReconciliationService({ prisma, clock: () => new Date('2026-08-23T05:00:00Z') });
  const result = await service.importCsv({
    reportType: 'PAYMENTS', reportDate: '2026-08-22', fileName: 'yoomoney-payments.csv',
    csvText: 'Идентификатор платежа;Сумма платежа;Сумма за вычетом комиссии и НДС;Сумма комиссии без НДС;НДС с комиссии\npay_1;100.00;96.34;3.00;0.66',
  });
  assert.equal(result.status, 'RECONCILED');
  assert.equal(result.matched, 1);
  assert.equal(result.issues.length, 0);
  assert.equal(executed.some((args) => String(args[0]).includes("reconciliationStatus\"='FINAL'")), true);
});

test('missing local payment becomes a critical reconciliation issue', async () => {
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('YooKassaDailyReport') && sql.includes('fileHash')) return [];
      if (sql.includes('PaymentProviderCost')) return [];
      return [];
    },
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const service = new YooKassaDailyReconciliationService({ prisma });
  const result = await service.importCsv({ reportType: 'PAYMENTS', reportDate: '2026-08-22', csvText: 'Идентификатор платежа;Сумма платежа;Сумма за вычетом комиссии и НДС;Сумма комиссии без НДС;НДС с комиссии\npay_missing;100;96.34;3;0.66' });
  assert.equal(result.status, 'RECONCILED_WITH_ISSUES');
  assert.equal(result.missingLocal, 1);
  assert.equal(result.issues[0].severity, 'CRITICAL');
  assert.equal(executed.some((args) => String(args[0]).includes('YooKassaReconciliationIssue')), true);
});
