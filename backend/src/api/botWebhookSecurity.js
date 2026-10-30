const crypto = require('node:crypto');

function createBotWebhookVerifier({ telegramSecret = null, maxSecret = null } = {}) {
  return function verify(channel, headers = {}) {
    const normalized = normalizeHeaders(headers);
    if (channel === 'telegram') {
      return verifySecret(telegramSecret, normalized['x-telegram-bot-api-secret-token']);
    }
    if (channel === 'max') {
      return verifySecret(maxSecret, normalized['x-max-bot-api-secret']);
    }
    return false;
  };
}

function verifySecret(expected, actual) {
  if (!expected) return true;
  if (!actual) return false;
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(actual));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function normalizeHeaders(headers) {
  return Object.fromEntries(Object.entries(headers || {}).map(([key, value]) => [String(key).toLowerCase(), value]));
}

module.exports = { createBotWebhookVerifier, verifySecret, normalizeHeaders };
