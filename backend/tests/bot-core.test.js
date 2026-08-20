const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseStartPayload,
  TelegramAdapter,
  MaxAdapter,
  BotGateway,
} = require('../src/modules/bot_core');

test('parseStartPayload resolves referral context', () => {
  assert.deepEqual(parseStartPayload('ref_AB7K3M'), {
    source: 'referral',
    raw: 'ref_AB7K3M',
    referralCode: 'AB7K3M',
    machineId: null,
    campaignId: null,
    partnerId: null,
  });
});

test('parseStartPayload resolves machine QR context', () => {
  const context = parseStartPayload('m_VM-041');
  assert.equal(context.source, 'machine_qr');
  assert.equal(context.machineId, 'VM-041');
});

test('TelegramAdapter normalizes /start payload', () => {
  const adapter = new TelegramAdapter();
  const inbound = adapter.normalizeInbound({
    update_id: 12,
    message: {
      text: '/start ref_AB7K3M',
      from: { id: 1001, username: 'guest', first_name: 'Guest' },
      chat: { id: 1001 },
    },
  });

  assert.equal(inbound.channel, 'telegram');
  assert.equal(inbound.externalUserId, '1001');
  assert.equal(inbound.payload, 'ref_AB7K3M');
});

test('MaxAdapter normalizes start context without exposing business logic', () => {
  const adapter = new MaxAdapter();
  const inbound = adapter.normalizeInbound({
    sender: { user_id: 2002, first_name: 'Guest' },
    message: { body: { text: '/start m_VM-041' } },
  });

  assert.equal(inbound.channel, 'max');
  assert.equal(inbound.externalUserId, '2002');
  assert.equal(inbound.payload, 'm_VM-041');
});

test('BotGateway publishes normalized start event', async () => {
  const events = [];
  const gateway = new BotGateway({
    eventCenter: {
      async publish(event) {
        events.push(event);
      },
    },
  });

  const result = await gateway.handleStart({
    channel: 'telegram',
    externalUserId: '1001',
    payload: 'campaign_summer26',
  });

  assert.equal(result.context.source, 'campaign');
  assert.equal(result.context.campaignId, 'summer26');
  assert.equal(events.length, 1);
  assert.equal(events[0].type, 'BOT_START_RECEIVED');
});
