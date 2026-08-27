const { TelegramBotApiClient } = require('./TelegramBotApiClient');

function createBotClientsFromEnv(env = process.env, options = {}) {
  const clients = {};

  if (env.TELEGRAM_TEST_BOT_TOKEN) {
    clients.telegram = new TelegramBotApiClient({
      token: env.TELEGRAM_TEST_BOT_TOKEN,
      apiBaseUrl: env.TELEGRAM_BOT_API_BASE_URL || 'https://api.telegram.org',
      fetchImpl: options.fetchImpl || globalThis.fetch,
      features: {
        richMessages: enabled(env.TELEGRAM_RICH_MESSAGES_ENABLED),
        ephemeralMessages: enabled(env.TELEGRAM_EPHEMERAL_MESSAGES_ENABLED),
        disabledButtons: enabled(env.TELEGRAM_DISABLED_BUTTONS_ENABLED),
      },
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
