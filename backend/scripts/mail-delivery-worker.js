#!/usr/bin/env node
const { getPrismaClient, disconnectDatabase } = require('../src/common/database');
const { EmailDeliveryWorker } = require('../src/modules/mail_delivery/EmailDeliveryWorker');
const { SmtpTransport } = require('../src/modules/mail_delivery/SmtpTransport');

const pollIntervalMs = Math.max(1000, Number(process.env.MAIL_POLL_INTERVAL_MS || 5000));
const once = process.argv.includes('--once');
let stopping = false;

async function main() {
  const prisma = getPrismaClient();
  const transport = new SmtpTransport();
  if (!transport.isConfigured()) {
    throw new Error('Mail delivery SMTP is not configured. Check /etc/softice/mail-delivery.env.');
  }

  const worker = new EmailDeliveryWorker({ prisma, transport });

  if (once) {
    const result = await worker.runOnce();
    console.log(JSON.stringify({ event: 'mail.delivery.run', ...result }));
    return;
  }

  while (!stopping) {
    try {
      const result = await worker.runOnce();
      if (result.checked > 0) {
        console.log(JSON.stringify({ event: 'mail.delivery.run', ...result }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        event: 'mail.delivery.worker.error',
        code: error?.code || 'MAIL_WORKER_ERROR',
        message: error?.message || String(error),
      }));
    }
    if (!stopping) await sleep(pollIntervalMs);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stop(signal) {
  stopping = true;
  console.log(JSON.stringify({ event: 'mail.delivery.worker.stopping', signal }));
}

process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));

main()
  .catch((error) => {
    console.error(JSON.stringify({
      event: 'mail.delivery.worker.fatal',
      code: error?.code || 'MAIL_WORKER_FATAL',
      message: error?.message || String(error),
    }));
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await disconnectDatabase(); } catch {}
  });
