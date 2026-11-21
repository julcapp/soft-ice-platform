const test = require('node:test');
const assert = require('node:assert/strict');
const { CrmDirectMessageSender } = require('../src/modules/crm/CrmDirectMessageSender');

test('Telegram queued delivery becomes SENT after provider acknowledgement', async () => {
  let query = 0;
  const executed = [];
  const prisma = {
    $queryRawUnsafe: async () => {
      query += 1;
      if (query === 1) return [{ id: 'd1', customerId: 'c1', channel: 'TELEGRAM', body: 'test', status: 'QUEUED', createdAt: new Date() }];
      if (query === 2) return [{ externalUserId: '123', isVerified: true, status: 'ACTIVE' }];
      return [];
    },
    $executeRawUnsafe: async (...args) => { executed.push(args); return 1; },
  };
  const fetchImpl = async (url, options) => ({ ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 77 } }) });
  const result = await new CrmDirectMessageSender({ prisma, fetchImpl, telegramToken: 'token' }).run();
  assert.equal(result.sent, 1);
  assert.equal(result.results[0].providerMessageId, '77');
  assert.ok(executed.some((call) => String(call[0]).includes(`status"='SENT`)));
});

test('MAX uses platform-api2 and Authorization header', async () => {
  let query = 0;
  const calls = [];
  const prisma = {
    $queryRawUnsafe: async () => {
      query += 1;
      if (query === 1) return [{ id: 'd2', customerId: 'c2', channel: 'MAX', body: 'alert', status: 'QUEUED', createdAt: new Date() }];
      return [{ externalUserId: '555', isVerified: true, status: 'ACTIVE' }];
    },
    $executeRawUnsafe: async () => 1,
  };
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ message: { body: { mid: 'm-1' } } }) };
  };
  const result = await new CrmDirectMessageSender({ prisma, fetchImpl, maxToken: 'max-secret' }).run();
  assert.equal(result.sent, 1);
  assert.match(calls[0].url, /^https:\/\/platform-api2\.max\.ru\/messages\?user_id=555/);
  assert.equal(calls[0].options.headers.Authorization, 'max-secret');
});

test('provider failure becomes FAILED and does not claim delivery', async () => {
  let query = 0;
  const prisma = {
    $queryRawUnsafe: async () => {
      query += 1;
      if (query === 1) return [{ id: 'd3', customerId: 'c3', channel: 'TELEGRAM', body: 'test', status: 'QUEUED', createdAt: new Date() }];
      return [{ externalUserId: '999', isVerified: true }];
    },
    $executeRawUnsafe: async () => 1,
  };
  const fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ ok: false, description: 'bot was blocked by the user' }) });
  const result = await new CrmDirectMessageSender({ prisma, fetchImpl, telegramToken: 'token' }).run();
  assert.equal(result.failed, 1);
  assert.equal(result.results[0].status, 'FAILED');
});
