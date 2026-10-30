#!/usr/bin/env node
const { PrismaClient } = require('@prisma/client');
const { YooKassaPrivateChannelPaymentAdapter } = require('../src/modules/private_channel/YooKassaPrivateChannelPaymentAdapter');
const { TelegramPrivateChannelAccessAdapter } = require('../src/modules/private_channel/TelegramPrivateChannelAccessAdapter');
const { MaxPrivateChannelAccessAdapter } = require('../src/modules/private_channel/MaxPrivateChannelAccessAdapter');
const { PrivateChannelAccessService } = require('../src/modules/private_channel/PrivateChannelAccessService');
const { PrivateChannelRenewalService } = require('../src/modules/private_channel/PrivateChannelRenewalService');
const { PrivateChannelRecoveryService } = require('../src/modules/private_channel/PrivateChannelRecoveryService');

async function main() {
  if (process.env.PRIVATE_CHANNEL_RENEWALS_ENABLED !== 'true') {
    console.log(JSON.stringify({ status: 'disabled', reason: 'PRIVATE_CHANNEL_RENEWALS_ENABLED is not true' }));
    return;
  }
  const prisma = new PrismaClient();
  try {
    const paymentAdapter = new YooKassaPrivateChannelPaymentAdapter();
    if (!paymentAdapter.isConfigured()) throw new Error('YooKassa is not configured.');
    const renewalService = new PrivateChannelRenewalService({ prisma, paymentAdapter });
    const accessService = new PrivateChannelAccessService({ prisma, adapters: {
      TELEGRAM: new TelegramPrivateChannelAccessAdapter(),
      MAX: new MaxPrivateChannelAccessAdapter(),
    } });
    const recoveryService = new PrivateChannelRecoveryService({ prisma, renewalService, accessService });
    const results = await renewalService.processDue({ limit: Number(process.env.PRIVATE_CHANNEL_RENEWAL_BATCH_SIZE || 100) });
    for (const result of results) await recoveryService.syncAttempt(result);
    const expiry = await recoveryService.expireExhaustedAccess({ limit: Number(process.env.PRIVATE_CHANNEL_RENEWAL_BATCH_SIZE || 100) });
    const summary = results.reduce((acc, item) => {
      acc.total += 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, { total: 0 });
    console.log(JSON.stringify({ status: 'completed', summary, expiredAccessSubscriptions: expiry.length }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ status: 'failed', code: error.code || null, message: error.message }));
  process.exitCode = 1;
});
