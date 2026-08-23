const test = require('node:test');
const assert = require('node:assert/strict');
const { MaxPrivateChannelAccessAdapter } = require('../src/modules/private_channel/MaxPrivateChannelAccessAdapter');
const { PrivateChannelAccessService } = require('../src/modules/private_channel/PrivateChannelAccessService');
const { planCodeToChannel, normalizeChannel } = require('../src/api/v1/privateChannelRoutes');

test('MAX private channel adapter releases configured invite only after access service grant', async () => {
  const adapter = new MaxPrivateChannelAccessAdapter({ accessToken: 'token', chatId: '-42', inviteLink: 'https://max.ru/join/private-test' });
  assert.equal(adapter.isConfigured(), true);
  const access = await adapter.createAccess({ customerId: 'c1', validUntil: new Date('2026-09-23T00:00:00Z') });
  assert.equal(access.inviteLink, 'https://max.ru/join/private-test');
  assert.equal(access.providerChatRef, '-42');
  assert.equal(access.deliveryMode, 'PRIVATE_CHANNEL_INVITE_LINK');
});

test('private access service keeps Telegram and MAX grants isolated by channel type', async () => {
  const calls = [];
  const prisma = {
    $queryRawUnsafe: async () => [],
    $executeRawUnsafe: async (...args) => { calls.push(args); return 1; },
  };
  const max = { isConfigured: () => true, createAccess: async () => ({ inviteLink: 'https://max.ru/join/x', providerChatRef: '-77', deliveryMode: 'PRIVATE_CHANNEL_INVITE_LINK' }) };
  const telegram = { isConfigured: () => true, createAccess: async () => ({ inviteLink: 'https://t.me/+x', providerChatRef: '-88' }) };
  const service = new PrivateChannelAccessService({ prisma, adapters: { MAX: max, TELEGRAM: telegram }, clock: () => new Date('2026-08-23T00:00:00Z') });
  const result = await service.grantForPaidPeriod({ subscriptionId: 's-max', customerId: 'c1', channelType: 'MAX', validFrom: new Date('2026-08-23T00:00:00Z'), validUntil: new Date('2026-09-22T00:00:00Z') });
  assert.equal(result.channelType, 'MAX');
  assert.equal(result.inviteLink, 'https://max.ru/join/x');
  assert.equal(calls.some((entry) => entry.includes('MAX')), true);
});

test('plan/channel mapping supports only Telegram and MAX', () => {
  assert.equal(planCodeToChannel('PRIVATE_TELEGRAM_MONTHLY'), 'TELEGRAM');
  assert.equal(planCodeToChannel('PRIVATE_MAX_MONTHLY'), 'MAX');
  assert.equal(normalizeChannel('max'), 'MAX');
  assert.throws(() => normalizeChannel('VK'), (error) => error.code === 'PRIVATE_CHANNEL_TYPE_INVALID');
});
