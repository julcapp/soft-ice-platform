#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { YooKassaDailyReconciliationService } = require('../src/modules/payment_profile/YooKassaDailyReconciliationService');
const { YandexImapYooKassaReportIngestor } = require('../src/modules/payment_profile/YandexImapYooKassaReportIngestor');

async function main() {
  const prisma = new PrismaClient();
  try {
    const reconciliation = new YooKassaDailyReconciliationService({ prisma });
    const ingestor = new YandexImapYooKassaReportIngestor({ reportReconciliationService: reconciliation });
    const result = await ingestor.run();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (result.status === 'BLOCKED') process.exitCode = 2;
    else if (result.status === 'DEGRADED') process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('YooKassa Yandex IMAP import failed', { code: error.code || error.message });
  process.exitCode = 1;
});
