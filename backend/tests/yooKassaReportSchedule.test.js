const test = require('node:test');
const assert = require('node:assert/strict');
const { YooKassaReportScheduleService, moscowYesterday } = require('../src/modules/payment_profile/YooKassaReportScheduleService');

test('moscowYesterday follows YooKassa financial day', () => {
  assert.equal(moscowYesterday(new Date('2026-08-23T06:00:00Z')), '2026-08-22');
});

test('scheduled check marks missing reports after Moscow deadline', async () => {
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('YooKassaDailyReport')) return [];
      if (sql.includes('YooKassaReportExpectation')) return [];
      return [];
    },
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const service = new YooKassaReportScheduleService({
    prisma,
    ingestor: { run: async () => ({ status: 'READY', processed: 0 }) },
    clock: () => new Date('2026-08-23T08:00:00Z'),
    config: { YOOKASSA_REPORT_EXPECTED_BY_MSK_HOUR: '10' },
  });
  const result = await service.run();
  assert.equal(result.status, 'DEGRADED');
  assert.deepEqual(result.missing.map((item) => item.reportType).sort(), ['PAYMENTS', 'REFUNDS']);
  assert.equal(executed.length, 2);
});

test('scheduled check stays READY when both daily reports exist', async () => {
  const prisma = {
    $queryRawUnsafe: async (sql) => {
      if (sql.includes('YooKassaDailyReport')) return [{ id: 'report_1', status: 'RECONCILED' }];
      if (sql.includes('YooKassaReportExpectation')) return [{ id: 'expect_1', status: 'EXPECTED' }];
      return [];
    },
    $executeRawUnsafe: async () => 1,
  };
  const service = new YooKassaReportScheduleService({
    prisma,
    ingestor: { run: async () => ({ status: 'READY', processed: 2 }) },
    clock: () => new Date('2026-08-23T08:00:00Z'),
  });
  const result = await service.run();
  assert.equal(result.status, 'READY');
  assert.equal(result.missing.length, 0);
});
