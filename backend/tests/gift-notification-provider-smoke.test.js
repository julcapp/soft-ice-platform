'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { main, validateEnvironment } = require('../scripts/smoke-test-gift-notification-provider');

const telegramEnv = {
  NODE_ENV: 'test',
  GIFT_NOTIFICATION_SMOKE_CONFIRM: 'YES_TEST_RECIPIENT',
  GIFT_NOTIFICATION_SMOKE_CHANNEL: 'telegram',
  TELEGRAM_TEST_BOT_TOKEN: 'test-token',
  TELEGRAM_TEST_RECIPIENT_ID: '123456',
};

test('provider smoke refuses production and token reuse', () => {
  assert.throws(() => validateEnvironment({ ...telegramEnv, NODE_ENV: 'production' }), /PRODUCTION_SMOKE_FORBIDDEN/);
  assert.throws(() => validateEnvironment({ ...telegramEnv, TELEGRAM_BOT_TOKEN: 'test-token' }), /TELEGRAM_TEST_TOKEN_MUST_DIFFER/);
});

test('provider smoke requires explicit test recipient confirmation', () => {
  assert.throws(() => validateEnvironment({ ...telegramEnv, GIFT_NOTIFICATION_SMOKE_CONFIRM: 'NO' }), /TEST_RECIPIENT_CONFIRMATION_REQUIRED/);
  assert.throws(() => validateEnvironment({ ...telegramEnv, TELEGRAM_TEST_RECIPIENT_ID: 'group-name' }), /TELEGRAM_TEST_RECIPIENT_ID_INVALID/);
});

test('Telegram smoke sends a non-production message with a disabled button', async () => {
  const calls = [];
  const output = [];
  const result = await main(telegramEnv, {
    telegramClient: { async sendMessage(...args) { calls.push(args); return { message_id: 1 }; } },
    write: (value) => output.push(value),
  });
  assert.equal(result.ok, true);
  assert.equal(calls[0][0], '123456');
  assert.deepEqual(calls[0][2].reply_markup.inline_keyboard[0][0].disabled, {});
  assert.equal(calls[0][1].includes('Настоящий подарок не создан'), true);
  assert.equal(output[0].includes('123456'), false);
});

test('Telegram rich smoke uses Bot API 10.3 rich message explicitly', async () => {
  const calls = [];
  await main({ ...telegramEnv, TELEGRAM_GIFT_SMOKE_RICH_MESSAGE: 'true' }, {
    telegramClient: { async sendRichMessage(...args) { calls.push(args); return { message_id: 2 }; } },
    write: () => {},
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1].markdown.includes('Тестовое приглашение'), true);
});

test('MAX smoke uses only the configured test user id', async () => {
  const calls = [];
  await main({
    NODE_ENV: 'test',
    GIFT_NOTIFICATION_SMOKE_CONFIRM: 'YES_TEST_RECIPIENT',
    GIFT_NOTIFICATION_SMOKE_CHANNEL: 'max',
    MAX_TEST_BOT_TOKEN: 'max-test-token',
    MAX_TEST_RECIPIENT_ID: '987654',
  }, {
    maxClient: { async sendMessage(value) { calls.push(value); return { message: { mid: '1' } }; } },
    write: () => {},
  });
  assert.equal(calls[0].userId, '987654');
  assert.equal(calls[0].text.includes('Настоящий подарок не создан'), true);
});
