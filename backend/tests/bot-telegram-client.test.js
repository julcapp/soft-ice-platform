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

test('TelegramBotApiClient sends Bot API 10.3 rich message payload', async () => {
  const calls = [];
  const client = new TelegramBotApiClient({
    token: 'test-token',
    fetchImpl: fakeTelegramFetch(calls),
    features: { richMessages: true },
  });
  const richMessage = { markdown: '**Спасибо за добро!**' };

  await client.sendRichMessage(123, richMessage, { reply_markup: { inline_keyboard: [] } });

  assert.equal(calls[0].url, 'https://api.telegram.org/bottest-token/sendRichMessage');
  assert.deepEqual(calls[0].body, {
    chat_id: 123,
    rich_message: richMessage,
    reply_markup: { inline_keyboard: [] },
  });
});

test('TelegramBotApiClient enforces the official InputRichMessage one-content-field contract', () => {
  const client = new TelegramBotApiClient({ token: 'test-token', fetchImpl: fakeTelegramFetch([]) });
  assert.throws(
    () => client.sendRichMessage(123, { markdown: '**Текст**', html: '<b>Текст</b>' }),
    /exactly one of html, markdown or blocks/,
  );
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

test('BotTransportSender uses rich message only behind feature flag and keeps text fallback', async () => {
  const richCalls = [];
  const richClient = new TelegramBotApiClient({
    token: 'test-token',
    fetchImpl: fakeTelegramFetch(richCalls),
    features: { richMessages: true },
  });
  const rendered = {
    text: 'Обычная версия',
    rich_message: { markdown: '**Расширенная версия**' },
    reply_markup: { inline_keyboard: [] },
  };
  await new BotTransportSender({ telegramClient: richClient }).send({
    channel: 'telegram', destination: { chatId: '10' }, rendered,
  });
  assert.match(richCalls[0].url, /sendRichMessage$/);

  const fallbackCalls = [];
  const fallbackClient = new TelegramBotApiClient({ token: 'test-token', fetchImpl: fakeTelegramFetch(fallbackCalls) });
  await new BotTransportSender({ telegramClient: fallbackClient }).send({
    channel: 'telegram', destination: { chatId: '10' }, rendered,
  });
  assert.match(fallbackCalls[0].url, /sendMessage$/);
  assert.equal(fallbackCalls[0].body.text, 'Обычная версия');
});

test('ephemeral confirmation is opt-in, recipient-bound and never used for critical content', async () => {
  const calls = [];
  const client = new TelegramBotApiClient({
    token: 'test-token',
    fetchImpl: fakeTelegramFetch(calls),
    features: { ephemeralMessages: true },
  });
  const sender = new BotTransportSender({ telegramClient: client });

  await sender.send({
    channel: 'telegram',
    destination: { chatId: '20', userId: '10', callbackQueryId: 'cb-1' },
    rendered: {
      text: 'Спасибо отправлено',
      reply_markup: { inline_keyboard: [] },
      delivery: { mode: 'ephemeral', critical: false, replaceCallbackQueryMessage: true },
    },
  });
  assert.deepEqual(calls[1].body.ephemeral_message_parameters, {
    receiver_user_id: 10,
    callback_query_id: 'cb-1',
    replace_callback_query_message: true,
  });

  await sender.send({
    channel: 'telegram',
    destination: { chatId: '20', userId: '10' },
    rendered: {
      text: 'Код получения: 123456',
      reply_markup: { inline_keyboard: [] },
      delivery: { mode: 'ephemeral', critical: true },
    },
  });
  assert.equal(calls[2].body.ephemeral_message_parameters, undefined);
  assert.equal(calls[2].body.text, 'Код получения: 123456');
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

test('bot env factory isolates test credentials and uses production credentials only in production', () => {
  const fetchImpl = async () => { throw new Error('network should not be called'); };
  const withoutTestToken = createBotClientsFromEnv({ TELEGRAM_BOT_TOKEN: 'existing-production-token' }, { fetchImpl });
  assert.equal(withoutTestToken.telegram, undefined);

  const withTestToken = createBotClientsFromEnv({
    TELEGRAM_BOT_TOKEN: 'existing-production-token',
    TELEGRAM_TEST_BOT_TOKEN: 'isolated-test-token',
  }, { fetchImpl });
  assert.ok(withTestToken.telegram);
  assert.equal(withTestToken.telegram.token, 'isolated-test-token');
  assert.deepEqual(withTestToken.telegram.features, {
    richMessages: false,
    ephemeralMessages: false,
    disabledButtons: false,
  });

  const withBotApi103 = createBotClientsFromEnv({
    TELEGRAM_TEST_BOT_TOKEN: 'isolated-test-token',
    TELEGRAM_RICH_MESSAGES_ENABLED: 'true',
    TELEGRAM_EPHEMERAL_MESSAGES_ENABLED: 'TRUE',
    TELEGRAM_DISABLED_BUTTONS_ENABLED: 'true',
  }, { fetchImpl });
  assert.deepEqual(withBotApi103.telegram.features, {
    richMessages: true,
    ephemeralMessages: true,
    disabledButtons: true,
  });

  const production = createBotClientsFromEnv({
    NODE_ENV: 'production',
    TELEGRAM_BOT_TOKEN: 'production-token',
    TELEGRAM_TEST_BOT_TOKEN: 'isolated-test-token',
    MAX_BOT_TOKEN: 'max-production-token',
    MAX_TEST_BOT_TOKEN: 'max-test-token',
  }, { fetchImpl });
  assert.equal(production.telegram.token, 'production-token');
  assert.equal(production.max.token, 'max-production-token');
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
