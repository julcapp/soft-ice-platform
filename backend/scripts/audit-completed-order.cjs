'use strict';
const { PrismaClient } = require('@prisma/client');
const { auditCompletedOrder } = require('../src/modules/club_account/CompletedOrderAudit');
const prisma = new PrismaClient();
auditCompletedOrder(prisma, process.argv[2]).then(report => {
  console.log(JSON.stringify(report, null, 2));
  if (!report.consistent) process.exitCode = 2;
}).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
