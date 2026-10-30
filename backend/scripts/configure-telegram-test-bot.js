const crypto = require('node:crypto');
const { TelegramBotApiClient } = require('../src/modules/bot_core/TelegramBotApiClient');

async function main(env = process.env) {
  const token = env.TELEGRAM_TEST_BOT_TOKEN;
  const existingToken = env.TELEGRAM_BOT_TOKEN;
  const webhookUrl = env.TELEGRAM_TEST_WEBHOOK_URL;
  const secretToken = env.TELEGRAM_WEBHOOK_SECRET;

  if (!token) throw new Error('TELEGRAM_TEST_BOT_TOKEN is required.');
  if (existingToken && token === existingToken) {
    throw new Error('Refusing to configure webhook: TELEGRAM_TEST_BOT_TOKEN must differ from TELEGRAM_BOT_TOKEN.');
  }
  if (!webhookUrl || !/^https:\/\//i.test(webhookUrl)) {
    throw new Error('TELEGRAM_TEST_WEBHOOK_URL must be an HTTPS URL.');
  }
  if (!secretToken) throw new Error('TELEGRAM_WEBHOOK_SECRET is required.');
  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secretToken)) {
    throw new Error('TELEGRAM_WEBHOOK_SECRET must contain only A-Z, a-z, 0-9, _ and - (1..256 chars).');
  }

  const client = new TelegramBotApiClient({
    token,
    apiBaseUrl: env.TELEGRAM_BOT_API_BASE_URL || 'https://api.telegram.org',
  });

  const bot = await client.getMe();
  await client.setWebhook({
    url: webhookUrl,
    secretToken,
    allowedUpdates: ['message', 'callback_query'],
    dropPendingUpdates: env.TELEGRAM_TEST_DROP_PENDING_UPDATES === 'true',
  });
  const webhook = await client.getWebhookInfo();

  const tokenFingerprint = crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
  console.log(JSON.stringify({
    ok: true,
    bot: { id: bot.id, username: bot.username, firstName: bot.first_name },
    webhook: {
      url: webhook.url,
      pendingUpdateCount: webhook.pending_update_count,
      lastErrorDate: webhook.last_error_date || null,
      lastErrorMessage: webhook.last_error_message || null,
    },
    tokenFingerprint,
  }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = { main };
