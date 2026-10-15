const { TelegramBotApiClient } = require('./TelegramBotApiClient');
const { MaxBotApiClient } = require('./MaxBotApiClient');

function createBotClientsFromEnv(env = process.env, options = {}) {
  const clients = {};
  const requestTimeoutMs = options.requestTimeoutMs || positiveInteger(env.BOT_PROVIDER_TIMEOUT_MS, 15000, 'BOT_PROVIDER_TIMEOUT_MS');

  const telegramToken = env.NODE_ENV === 'production'
    ? env.TELEGRAM_BOT_TOKEN
    : env.TELEGRAM_TEST_BOT_TOKEN;
  if (telegramToken) {
    clients.telegram = new TelegramBotApiClient({
      token: telegramToken,
      apiBaseUrl: env.TELEGRAM_BOT_API_BASE_URL || 'https://api.telegram.org',
      fetchImpl: options.fetchImpl || globalThis.fetch,
      requestTimeoutMs,
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
      requestTimeoutMs,
    });
  }

  return clients;
}

function positiveInteger(value, fallback, name) {
  const parsed = Number(value === undefined || value === '' ? fallback : value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

function enabled(value) {
  return String(value || '').toLowerCase() === 'true';
}

function hasConfiguredBotClients(clients = {}) {
  return Boolean(clients.telegram || clients.max);
}

module.exports = { createBotClientsFromEnv, hasConfiguredBotClients, enabled, positiveInteger };
