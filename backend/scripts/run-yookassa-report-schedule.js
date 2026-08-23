#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { YooKassaDailyReconciliationService } = require('../src/modules/payment_profile/YooKassaDailyReconciliationService');
const { YandexImapYooKassaReportIngestor } = require('../src/modules/payment_profile/YandexImapYooKassaReportIngestor');
const { YooKassaReportScheduleService } = require('../src/modules/payment_profile/YooKassaReportScheduleService');
const { FinancialDayCloseService } = require('../src/modules/payment_profile/FinancialDayCloseService');
const { FinancialOpsAlertService } = require('../src/modules/payment_profile/FinancialOpsAlertService');

async function main() {
  const prisma = new PrismaClient();
  try {
    const reconciliation = new YooKassaDailyReconciliationService({ prisma });
    const ingestor = new YandexImapYooKassaReportIngestor({ reportReconciliationService: reconciliation });
    const financialDayCloseService = new FinancialDayCloseService({ prisma });
    const financialOpsAlertService = new FinancialOpsAlertService({ prisma });
    const scheduler = new YooKassaReportScheduleService({ prisma, ingestor, financialDayCloseService, financialOpsAlertService });
    const result = await scheduler.run();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status === 'BLOCKED') process.exitCode = 2;
    else if (result.status === 'DEGRADED') process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('YooKassa scheduled report check failed', { code: error.code || error.message });
  process.exitCode = 1;
});
