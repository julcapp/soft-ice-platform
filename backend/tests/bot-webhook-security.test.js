const test = require('node:test');
const assert = require('node:assert/strict');
const { createBotWebhookVerifier } = require('../src/api/botWebhookSecurity');
const { createBotWebhookHandlers } = require('../src/api/botWebhookHandlers');

test('Telegram webhook secret header is verified case-insensitively', () => {
  const verify = createBotWebhookVerifier({ telegramSecret: 'tg-secret' });
  assert.equal(verify('telegram', { 'X-Telegram-Bot-Api-Secret-Token': 'tg-secret' }), true);
  assert.equal(verify('telegram', { 'x-telegram-bot-api-secret-token': 'wrong' }), false);
});

test('MAX webhook secret header is verified', () => {
  const verify = createBotWebhookVerifier({ maxSecret: 'max-secret' });
  assert.equal(verify('max', { 'X-Max-Bot-Api-Secret': 'max-secret' }), true);
  assert.equal(verify('max', {}), false);
});

test('webhook handler rejects invalid secret before runtime processing', async () => {
  let called = false;
  const handlers = createBotWebhookHandlers({
    botRuntime: { handle: async () => { called = true; } },
    verifyWebhook: createBotWebhookVerifier({ telegramSecret: 'expected' }),
    logger: { error() {} },
  });
  const response = await handlers.handleTelegram({ headers: { 'x-telegram-bot-api-secret-token': 'wrong' }, body: {} }, null);
  assert.equal(response.statusCode, 401);
  assert.equal(called, false);
});
