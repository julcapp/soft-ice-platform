const test = require('node:test');
const assert = require('node:assert/strict');

const { AdminSecurityDelivery } = require('../src/platform/security/AdminSecurityDelivery');

test('admin MAX security delivery never falls back to customer MAX_BOT_TOKEN', async () => {
  let providerCalls = 0;
  const delivery = new AdminSecurityDelivery({
    env: {
      NODE_ENV: 'production',
      MAX_BOT_TOKEN: 'customer-bot-token-must-not-be-used',
      MAX_API_BASE_URL: 'https://platform-api2.max.ru',
    },
    fetchImpl: async () => {
      providerCalls += 1;
      return { ok: true, json: async () => ({}) };
    },
    messageJournal: null,
  });

  await assert.rejects(
    () => delivery.sendMax('12345', '654321'),
    /MAX security channel is not configured/,
  );
  assert.equal(providerCalls, 0);
});

test('admin MAX security delivery uses dedicated ADMIN_SECURITY_MAX_BOT_TOKEN', async () => {
  const authorizations = [];
  const delivery = new AdminSecurityDelivery({
    env: {
      NODE_ENV: 'production',
      ADMIN_SECURITY_MAX_BOT_TOKEN: 'dedicated-security-token',
      MAX_BOT_TOKEN: 'customer-token',
      MAX_API_BASE_URL: 'https://platform-api2.max.ru',
    },
    fetchImpl: async (_url, options) => {
      authorizations.push(options.headers.Authorization);
      return { ok: true, json: async () => ({ ok: true }) };
    },
    messageJournal: null,
  });

  await delivery.sendMax('12345', '654321');
  assert.deepEqual(authorizations, ['dedicated-security-token']);
});
