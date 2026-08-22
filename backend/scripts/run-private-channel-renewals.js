#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { YooKassaPrivateChannelPaymentAdapter } = require('../src/modules/private_channel/YooKassaPrivateChannelPaymentAdapter');
const { PrivateChannelRenewalService } = require('../src/modules/private_channel/PrivateChannelRenewalService');

async function main() {
  if (process.env.PRIVATE_CHANNEL_RENEWALS_ENABLED !== 'true') {
    console.log(JSON.stringify({ status: 'disabled', reason: 'PRIVATE_CHANNEL_RENEWALS_ENABLED is not true' }));
    return;
  }
  const prisma = new PrismaClient();
  try {
    const paymentAdapter = new YooKassaPrivateChannelPaymentAdapter();
    if (!paymentAdapter.isConfigured()) throw new Error('YooKassa is not configured.');
    const service = new PrivateChannelRenewalService({ prisma, paymentAdapter });
    const results = await service.processDue({ limit: Number(process.env.PRIVATE_CHANNEL_RENEWAL_BATCH_SIZE || 100) });
    const summary = results.reduce((acc, item) => {
      acc.total += 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, { total: 0 });
    console.log(JSON.stringify({ status: 'completed', summary }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'failed', code: error.code || null, message: error.message }));
  process.exitCode = 1;
});
