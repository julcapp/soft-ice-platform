const test = require('node:test');
const assert = require('node:assert/strict');

const { ExolveSmsClient, normalizeDestination } = require('../src/modules/bot_core/ExolveSmsClient');
const { createBotClientsFromEnv } = require('../src/modules/bot_core/createBotClientsFromEnv');

test('normalizes Russian phone for Exolve destination', () => {
  assert.equal(normalizeDestination('+7 903 955-70-50'), '79039557050');
  assert.equal(normalizeDestination('79039557050'), '79039557050');
  assert.equal(normalizeDestination('+1 555 123 4567'), null);
});

test('Exolve client sends bearer-authenticated JSON without leaking api key into body', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ message_id: 'msg_1' }),
    };
  };
  const client = new ExolveSmsClient({
    apiKey: 'secret-api-key',
    sender: '79990000000',
    apiBaseUrl: 'https://api.exolve.ru',
    fetchImpl,
    requestTimeoutMs: 1000,
  });
  const result = await client.sendMessage({ to: '+7 903 955-70-50', text: 'Тест' });
  assert.equal(result.messageId, 'msg_1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://api.exolve.ru/messaging/v1/SendSMS');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer secret-api-key');
  const body = JSON.parse(calls[0].options.body);
  assert.deepEqual(body, { number: '79990000000', destination: '79039557050', text: 'Тест' });
  assert.equal(calls[0].options.body.includes('secret-api-key'), false);
});

test('createBotClientsFromEnv wires Exolve only when key and sender are configured', () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ message_id: 'x' }) });
  const clients = createBotClientsFromEnv({
    NODE_ENV: 'development',
    EXOLVE_API_KEY: 'key',
    EXOLVE_SMS_SENDER: 'sender',
  }, { fetchImpl, requestTimeoutMs: 1000 });
  assert.ok(clients.sms instanceof ExolveSmsClient);

  const withoutSender = createBotClientsFromEnv({
    NODE_ENV: 'development',
    EXOLVE_API_KEY: 'key',
  }, { fetchImpl, requestTimeoutMs: 1000 });
  assert.equal(withoutSender.sms, undefined);
});
