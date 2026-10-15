'use strict';

const { TelegramBotApiClient } = require('../src/modules/bot_core/TelegramBotApiClient');
const { MaxBotApiClient } = require('../src/modules/bot_core/MaxBotApiClient');

const CONFIRMATION = 'YES_TEST_RECIPIENT';

async function main(env = process.env, dependencies = {}) {
  validateEnvironment(env);
  const channel = env.GIFT_NOTIFICATION_SMOKE_CHANNEL.toLowerCase();
  const write = dependencies.write || ((value) => process.stdout.write(`${value}\n`));
  const result = channel === 'telegram'
    ? await sendTelegram(env, dependencies.telegramClient)
    : await sendMax(env, dependencies.maxClient);
  const summary = { ok: true, channel, providerAccepted: Boolean(result), production: false };
  write(JSON.stringify(summary));
  return summary;
}

function validateEnvironment(env) {
  if (env.NODE_ENV === 'production') throw smokeError('PRODUCTION_SMOKE_FORBIDDEN');
  if (env.GIFT_NOTIFICATION_SMOKE_CONFIRM !== CONFIRMATION) throw smokeError('TEST_RECIPIENT_CONFIRMATION_REQUIRED');
  const channel = String(env.GIFT_NOTIFICATION_SMOKE_CHANNEL || '').toLowerCase();
  if (!['telegram', 'max'].includes(channel)) throw smokeError('SMOKE_CHANNEL_INVALID');
  if (channel === 'telegram') {
    required(env.TELEGRAM_TEST_BOT_TOKEN, 'TELEGRAM_TEST_BOT_TOKEN_REQUIRED');
    required(positiveIntegerId(env.TELEGRAM_TEST_RECIPIENT_ID), 'TELEGRAM_TEST_RECIPIENT_ID_INVALID');
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_TEST_BOT_TOKEN === env.TELEGRAM_BOT_TOKEN) throw smokeError('TELEGRAM_TEST_TOKEN_MUST_DIFFER');
  } else {
    required(env.MAX_TEST_BOT_TOKEN, 'MAX_TEST_BOT_TOKEN_REQUIRED');
    required(positiveIntegerId(env.MAX_TEST_RECIPIENT_ID), 'MAX_TEST_RECIPIENT_ID_INVALID');
    required(testMiniAppUrl(env.GIFT_NOTIFICATION_SMOKE_MINI_APP_URL), 'GIFT_NOTIFICATION_SMOKE_MINI_APP_URL_INVALID');
    if (env.MAX_BOT_TOKEN && env.MAX_TEST_BOT_TOKEN === env.MAX_BOT_TOKEN) throw smokeError('MAX_TEST_TOKEN_MUST_DIFFER');
  }
}

async function sendTelegram(env, injectedClient) {
  const client = injectedClient || new TelegramBotApiClient({
    token: env.TELEGRAM_TEST_BOT_TOKEN,
    apiBaseUrl: env.TELEGRAM_BOT_API_BASE_URL || 'https://api.telegram.org',
  });
  const replyMarkup = { inline_keyboard: [[{ text: 'Тест завершён', disabled: {} }]] };
  if (env.TELEGRAM_GIFT_SMOKE_RICH_MESSAGE === 'true') {
    return client.sendRichMessage(positiveIntegerId(env.TELEGRAM_TEST_RECIPIENT_ID), {
      markdown: '**Тестовое приглашение «У Тимоши» 🎁**\n\nЭто проверка тестового бота. Настоящий подарок не создан.',
    }, { reply_markup: replyMarkup });
  }
  return client.sendMessage(
    positiveIntegerId(env.TELEGRAM_TEST_RECIPIENT_ID),
    'Тестовое приглашение «У Тимоши» 🎁\n\nЭто проверка тестового бота. Настоящий подарок не создан.',
    { reply_markup: replyMarkup },
  );
}

async function sendMax(env, injectedClient) {
  const client = injectedClient || new MaxBotApiClient({
    token: env.MAX_TEST_BOT_TOKEN,
    apiBaseUrl: env.MAX_API_BASE_URL || 'https://platform-api2.max.ru',
  });
  return client.sendMessage({
    userId: positiveIntegerId(env.MAX_TEST_RECIPIENT_ID),
    text: 'Тестовое приглашение «У Тимоши» 🎁\n\nЭто проверка тестового бота. Настоящий подарок не создан.',
    attachments: [{ type: 'inline_keyboard', payload: { buttons: [[{ type: 'link', text: 'Открыть тестовый Mini App', url: testMiniAppUrl(env.GIFT_NOTIFICATION_SMOKE_MINI_APP_URL) }]] } }],
  });
}

function positiveIntegerId(value) { const normalized = String(value || ''); return /^[1-9]\d{0,19}$/.test(normalized) ? normalized : null; }
function testMiniAppUrl(value) {
  try {
    const url = new URL(String(value || ''));
    const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol === 'https:' && hostname !== 'app.utimoshi.ru' ? url.toString() : null;
  } catch {
    return null;
  }
}
function required(value, code) { if (!value) throw smokeError(code); }
function smokeError(code) { return Object.assign(new Error(code), { code }); }

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.code || 'GIFT_NOTIFICATION_PROVIDER_SMOKE_FAILED'}\n`);
    process.exit(1);
  });
}

module.exports = { CONFIRMATION, positiveIntegerId, testMiniAppUrl, main, sendMax, sendTelegram, validateEnvironment };
