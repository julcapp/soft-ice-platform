const { TelegramBotApiClient } = require('./TelegramBotApiClient');

function createBotClientsFromEnv(env = process.env, options = {}) {
  const clients = {};

  if (env.TELEGRAM_TEST_BOT_TOKEN) {
    clients.telegram = new TelegramBotApiClient({
      token: env.TELEGRAM_TEST_BOT_TOKEN,
      apiBaseUrl: env.TELEGRAM_BOT_API_BASE_URL || 'https://api.telegram.org',
      fetchImpl: options.fetchImpl || globalThis.fetch,
    });
  }

  return clients;
}

function hasConfiguredBotClients(clients = {}) {
  return Boolean(clients.telegram || clients.max);
}

module.exports = { createBotClientsFromEnv, hasConfiguredBotClients };
