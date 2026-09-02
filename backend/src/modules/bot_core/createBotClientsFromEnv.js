const { TelegramBotApiClient } = require('./TelegramBotApiClient');
const { MaxBotApiClient } = require('./MaxBotApiClient');

function createBotClientsFromEnv(env = process.env, options = {}) {
  const clients = {};

  const telegramToken = env.NODE_ENV === 'production'
    ? env.TELEGRAM_BOT_TOKEN
    : env.TELEGRAM_TEST_BOT_TOKEN;
  if (telegramToken) {
    clients.telegram = new TelegramBotApiClient({
      token: telegramToken,
      apiBaseUrl: env.TELEGRAM_BOT_API_BASE_URL || 'https://api.telegram.org',
      fetchImpl: options.fetchImpl || globalThis.fetch,
      features: {
        richMessages: enabled(env.TELEGRAM_RICH_MESSAGES_ENABLED),
        ephemeralMessages: enabled(env.TELEGRAM_EPHEMERAL_MESSAGES_ENABLED),
        disabledButtons: enabled(env.TELEGRAM_DISABLED_BUTTONS_ENABLED),
      },
    });
  }

  const maxToken = env.NODE_ENV === 'production'
    ? env.MAX_BOT_TOKEN
    : env.MAX_TEST_BOT_TOKEN;
  if (maxToken) {
    clients.max = new MaxBotApiClient({
      token: maxToken,
      apiBaseUrl: env.MAX_API_BASE_URL || 'https://platform-api2.max.ru',
      fetchImpl: options.fetchImpl || globalThis.fetch,
    });
  }

  return clients;
}

function enabled(value) {
  return String(value || '').toLowerCase() === 'true';
}

function hasConfiguredBotClients(clients = {}) {
  return Boolean(clients.telegram || clients.max);
}

module.exports = { createBotClientsFromEnv, hasConfiguredBotClients, enabled };
