const { getPrismaClient, disconnectDatabase } = require('../src/common/database');
const {
  MailDeliveryWorker,
  PrismaMailDeliveryRepository,
} = require('../src/modules/mail_delivery/MailDeliveryWorker');
const { sendSmtpTlsMail } = require('../src/platform/mail/SmtpMailTransport');

function requiredEnv(name, env = process.env) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function numberEnv(name, fallback, env = process.env) {
  const value = Number(env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const env = process.env;
  const prisma = getPrismaClient();

  const smtp = {
    host: requiredEnv('MAIL_SMTP_HOST', env),
    port: numberEnv('MAIL_SMTP_PORT', 465, env),
    user: requiredEnv('MAIL_SMTP_USER', env),
    password: requiredEnv('MAIL_SMTP_PASSWORD', env),
    from: requiredEnv('MAIL_SMTP_FROM', env),
    replyTo: String(env.MAIL_REPLY_TO || '').trim() || null,
  };

  const pollIntervalMs = numberEnv('MAIL_POLL_INTERVAL_MS', 10_000, env);
  const worker = new MailDeliveryWorker({
    repository: new PrismaMailDeliveryRepository(prisma),
    sendMail: ({ to, subject, body }) => sendSmtpTlsMail({
      ...smtp,
      to,
      subject,
      body,
    }),
    batchSize: numberEnv('MAIL_BATCH_SIZE', 20, env),
    maxAttempts: numberEnv('MAIL_MAX_ATTEMPTS', 5, env),
    staleSendingMs: numberEnv('MAIL_STALE_SENDING_MS', 5 * 60 * 1000, env),
    logger: console,
  });

  let stopping = false;
  const stop = (signal) => {
    console.log(JSON.stringify({
      event: 'mail.worker.stop.requested',
      signal,
      timestamp: new Date().toISOString(),
    }));
    stopping = true;
  };

  process.once('SIGTERM', () => stop('SIGTERM'));
  process.once('SIGINT', () => stop('SIGINT'));

  console.log(JSON.stringify({
    event: 'mail.worker.started',
    smtp_host: smtp.host,
    smtp_port: smtp.port,
    smtp_user: smtp.user,
    smtp_from: smtp.from,
    reply_to: smtp.replyTo,
    poll_interval_ms: pollIntervalMs,
    timestamp: new Date().toISOString(),
  }));

  try {
    while (!stopping) {
      try {
        const stats = await worker.runOnce();
        if (stats.scanned || stats.sent || stats.failed) {
          console.log(JSON.stringify({
            event: 'mail.worker.cycle',
            ...stats,
            timestamp: new Date().toISOString(),
          }));
        }
      } catch (error) {
        console.error(JSON.stringify({
          event: 'mail.worker.cycle.failed',
          error: String(error?.message || error),
          timestamp: new Date().toISOString(),
        }));
      }

      if (!stopping) await sleep(pollIntervalMs);
    }
  } finally {
    await disconnectDatabase();
    console.log(JSON.stringify({
      event: 'mail.worker.stopped',
      timestamp: new Date().toISOString(),
    }));
  }
}

main().catch(async (error) => {
  console.error(JSON.stringify({
    event: 'mail.worker.fatal',
    error: String(error?.message || error),
    timestamp: new Date().toISOString(),
  }));
  try { await disconnectDatabase(); } catch {}
  process.exit(1);
});
