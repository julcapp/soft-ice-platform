const test = require('node:test');
const assert = require('node:assert/strict');
const { FinancialOpsAlertService, buildAlerts } = require('../src/modules/payment_profile/FinancialOpsAlertService');

test('builds concrete alerts for missing reports and reconciliation issues', () => {
  const alerts = buildAlerts({
    reportDate: '2026-08-22', status: 'REVIEW_REQUIRED',
    checks: { paymentsReportReceived: false, refundsReportReceived: true },
    reports: { payments: {}, refunds: { reconciliationStatus: 'RECONCILED_WITH_ISSUES' } },
    reconciliation: { openIssues: 2, criticalIssues: 1 },
  });
  assert.deepEqual(alerts.map((item) => item.alertType).sort(), ['MISSING_PAYMENTS_REPORT', 'OPEN_RECONCILIATION_ISSUES', 'REFUNDS_RECONCILIATION_ISSUE']);
  assert.equal(alerts.every((item) => item.alertKey.startsWith('yookassa:2026-08-22:')), true);
});

test('closed financial day resolves existing open alerts and creates no new alert', async () => {
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async (sql) => String(sql).includes('reportDate') ? [{ id: 'a1', alertKey: 'yookassa:2026-08-22:MISSING_PAYMENTS_REPORT' }] : [],
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const service = new FinancialOpsAlertService({ prisma, clock: () => new Date('2026-08-23T02:15:00Z') });
  const result = await service.syncForDay({ reportDate: '2026-08-22', status: 'CLOSED' });
  assert.equal(result.open, 0);
  assert.equal(executed.some((args) => String(args[0]).includes("'RESOLVED'")), true);
});

test('repeated problem refreshes existing alert instead of inserting duplicate', async () => {
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (String(sql).includes('alertKey')) return [{ id: 'existing-alert', alertKey: 'yookassa:2026-08-22:MISSING_PAYMENTS_REPORT' }];
      if (String(sql).includes('reportDate')) return [{ id: 'existing-alert', alertKey: 'yookassa:2026-08-22:MISSING_PAYMENTS_REPORT' }];
      return [];
    },
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const service = new FinancialOpsAlertService({ prisma });
  await service.syncForDay({
    reportDate: '2026-08-22', status: 'REVIEW_REQUIRED',
    checks: { paymentsReportReceived: false, refundsReportReceived: true },
    reports: { payments: {}, refunds: { reconciliationStatus: 'RECONCILED' } },
    reconciliation: { openIssues: 0, criticalIssues: 0 },
  });
  assert.equal(executed.some((args) => String(args[0]).startsWith('UPDATE "FinancialOpsAlert"')), true);
  assert.equal(executed.some((args) => String(args[0]).startsWith('INSERT INTO "FinancialOpsAlert"')), false);
});
