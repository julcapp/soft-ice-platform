'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MaxBotApiClient } = require('../src/modules/bot_core/MaxBotApiClient');

test('MAX client follows official POST /messages user_id contract', async () => {
  const calls = [];
  const client = new MaxBotApiClient({
    token: 'max-secret',
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), options, body: JSON.parse(options.body) });
      return { ok: true, status: 200, async json() { return { message: { mid: 'm-1' } }; } };
    },
  });
  await client.sendMessage({ userId: '67890', text: 'Подарок', notify: true });
  assert.equal(calls[0].url, 'https://platform-api2.max.ru/messages?user_id=67890');
  assert.equal(calls[0].options.headers.Authorization, 'max-secret');
  assert.deepEqual(calls[0].body, { text: 'Подарок', notify: true });
  assert.equal(calls[0].url.includes('max-secret'), false);
});

test('MAX client rejects a missing or non-numeric destination before network', async () => {
  const client = new MaxBotApiClient({ token: 'max-secret', fetchImpl: async () => { throw new Error('must not run'); } });
  assert.throws(() => client.sendMessage({ userId: 'not-an-id', text: 'Подарок' }), /destination/);
});
