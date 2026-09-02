const test = require('node:test');
const assert = require('node:assert/strict');

const { TelegramBotApiClient } = require('../src/modules/bot_core/TelegramBotApiClient');
const { BotTransportSender } = require('../src/modules/bot_core/BotTransportSender');
const { createBotClientsFromEnv } = require('../src/modules/bot_core/createBotClientsFromEnv');

function fakeTelegramFetch(calls, result = { message_id: 1 }) {
  return async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    return {
      ok: true,
      status: 200,
      async json() { return { ok: true, result }; },
    };
  };
}

test('TelegramBotApiClient sends rendered message through Bot API contract', async () => {
  const calls = [];
  const client = new TelegramBotApiClient({ token: 'test-token', fetchImpl: fakeTelegramFetch(calls) });

  await client.sendMessage(123, 'Привет', { reply_markup: { inline_keyboard: [] } });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.telegram.org/bottest-token/sendMessage');
  assert.deepEqual(calls[0].body, {
    chat_id: 123,
    text: 'Привет',
    reply_markup: { inline_keyboard: [] },
  });
});

test('BotTransportSender passes resolved Telegram chatId to Bot API client', async () => {
  const calls = [];
  const client = new TelegramBotApiClient({ token: 'test-token', fetchImpl: fakeTelegramFetch(calls) });
  const sender = new BotTransportSender({ telegramClient: client });

  await sender.send({
    channel: 'telegram',
    destination: { chatId: '572898079', callbackQueryId: null },
    rendered: { text: 'Тест', reply_markup: { inline_keyboard: [] } },
  });

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, {
    chat_id: '572898079',
    text: 'Тест',
    reply_markup: { inline_keyboard: [] },
  });
});

test('TelegramBotApiClient configures webhook with secret token', async () => {
  const calls = [];
  const client = new TelegramBotApiClient({ token: 'test-token', fetchImpl: fakeTelegramFetch(calls, true) });

  const result = await client.setWebhook({
    url: 'https://test.example/webhooks/telegram',
    secretToken: 'Secret_123',
    dropPendingUpdates: true,
  });

  assert.equal(result, true);
  assert.equal(calls[0].body.url, 'https://test.example/webhooks/telegram');
  assert.equal(calls[0].body.secret_token, 'Secret_123');
  assert.deepEqual(calls[0].body.allowed_updates, ['message', 'callback_query']);
  assert.equal(calls[0].body.drop_pending_updates, true);
});

test('bot env factory uses only isolated test token and ignores existing Mini App bot token', () => {
  const fetchImpl = async () => { throw new Error('network should not be called'); };
  const withoutTestToken = createBotClientsFromEnv({ TELEGRAM_BOT_TOKEN: 'existing-production-token' }, { fetchImpl });
  assert.equal(withoutTestToken.telegram, undefined);

  const withTestToken = createBotClientsFromEnv({
    TELEGRAM_BOT_TOKEN: 'existing-production-token',
    TELEGRAM_TEST_BOT_TOKEN: 'isolated-test-token',
  }, { fetchImpl });
  assert.ok(withTestToken.telegram);
  assert.equal(withTestToken.telegram.token, 'isolated-test-token');
});

test('TelegramBotApiClient surfaces Bot API errors without leaking token into message', async () => {
  const client = new TelegramBotApiClient({
    token: 'super-secret-token',
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      async json() { return { ok: false, description: 'Unauthorized' }; },
    }),
  });

  await assert.rejects(
    () => client.getMe(),
    (error) => {
      assert.match(error.message, /Unauthorized/);
      assert.doesNotMatch(error.message, /super-secret-token/);
      return true;
    },
  );
});
