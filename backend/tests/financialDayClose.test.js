const test = require('node:test');
const assert = require('node:assert/strict');
const { FinancialDayCloseService } = require('../src/modules/payment_profile/FinancialDayCloseService');

test('financial day closes only when both registries and expectations are clean', async () => {
  let call = 0;
  const prisma = { $queryRawUnsafe: async () => {
    call += 1;
    if (call === 1) return [
      { reportType: 'PAYMENTS', status: 'RECONCILED', grossAmountRub: 100, netAmountRub: 96.34, commissionRub: 3, commissionVatRub: 0.66, rowsTotal: 1, rowsMatched: 1, rowsMissingLocal: 0, rowsMismatch: 0, importedAt: new Date('2026-08-23T01:00:00Z') },
      { reportType: 'REFUNDS', status: 'RECONCILED', refundAmountRub: 20, rowsTotal: 1, rowsMatched: 1, rowsMissingLocal: 0, rowsMismatch: 0, importedAt: new Date('2026-08-23T01:05:00Z') },
    ];
    if (call === 2) return [{ reportType: 'PAYMENTS', status: 'RECEIVED' }, { reportType: 'REFUNDS', status: 'RECEIVED' }];
    return [];
  }};
  const result = await new FinancialDayCloseService({ prisma }).getDay('2026-08-22');
  assert.equal(result.status, 'CLOSED');
  assert.equal(result.statusLabel, 'ЗАКРЫТ');
  assert.equal(result.totals.processorCostTotalRub, 3.66);
  assert.equal(result.totals.netCashAfterRefundsRub, 76.34);
});

test('financial day requires review when registry or reconciliation is incomplete', async () => {
  let call = 0;
  const prisma = { $queryRawUnsafe: async () => {
    call += 1;
    if (call === 1) return [{ reportType: 'PAYMENTS', status: 'RECONCILED_WITH_ISSUES', grossAmountRub: 100, netAmountRub: 96 }];
    if (call === 2) return [{ reportType: 'PAYMENTS', status: 'RECEIVED' }, { reportType: 'REFUNDS', status: 'MISSING' }];
    return [{ id: 'issue1', severity: 'CRITICAL', status: 'OPEN' }];
  }};
  const result = await new FinancialDayCloseService({ prisma }).getDay('2026-08-22');
  assert.equal(result.status, 'REVIEW_REQUIRED');
  assert.equal(result.reconciliation.openIssues, 1);
  assert.equal(result.checks.refundsReportReceived, false);
});
