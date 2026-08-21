const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseStartPayload,
  TelegramAdapter,
  MaxAdapter,
  BotGateway,
  BotOnboardingService,
  buildWelcomeMessage,
  buildMainMenu,
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

test('referral start gets referral-specific welcome text', () => {
  const welcome = buildWelcomeMessage(parseStartPayload('ref_AB7K3M'));
  assert.equal(welcome.kind, 'referral');
  assert.match(welcome.title, /Клуб Тимоши/);
});

test('machine start routes Mini App to the originating machine', () => {
  const menu = buildMainMenu({ miniAppUrl: 'https://app.utimoshi.ru', machineId: 'VM-041' });
  assert.equal(menu[0].type, 'open_mini_app');
  assert.equal(menu[0].url, 'https://app.utimoshi.ru?machine_id=VM-041');
});

test('onboarding requires phone verification for a newly resolved Telegram customer', async () => {
  const onboarding = new BotOnboardingService({
    customerService: {
      async resolveOrCreateTelegramCustomer() {
        return {
          created: true,
          customer: { id: 'customer-1', phone: null, phoneVerifiedAt: null },
        };
      },
    },
    miniAppUrl: 'https://app.utimoshi.ru',
  });

  const result = await onboarding.start({
    channel: 'telegram',
    externalUserId: '1001',
    profile: { firstName: 'Guest' },
    context: parseStartPayload('ref_AB7K3M'),
    metadata: { updateId: 12 },
  });

  assert.equal(result.stage, 'phone_verification_required');
  assert.equal(result.requiresPhoneVerification, true);
  assert.equal(result.subscriptionOffer, null);
  assert.equal(result.menu.length, 0);
});

test('verified customer receives optional channel subscriptions and personal menu', async () => {
  const onboarding = new BotOnboardingService({
    customerService: {
      async resolveOrCreateTelegramCustomer() {
        return {
          created: false,
          customer: { id: 'customer-1', phone: '+79990000000', phoneVerifiedAt: new Date() },
        };
      },
    },
    miniAppUrl: 'https://app.utimoshi.ru',
    telegramChannelUrl: 'https://t.me/example',
    maxChannelUrl: 'https://max.ru/example',
  });

  const result = await onboarding.start({
    channel: 'telegram',
    externalUserId: '1001',
    profile: {},
    context: parseStartPayload('m_VM-041'),
    metadata: {},
  });

  assert.equal(result.stage, 'verified');
  assert.equal(result.requiresPhoneVerification, false);
  assert.equal(result.subscriptionOffer.optional, true);
  assert.equal(result.subscriptionOffer.actions.length, 3);
  assert.equal(result.menu[0].url, 'https://app.utimoshi.ru?machine_id=VM-041');
});

test('BotGateway can attach onboarding result without channel-specific business logic', async () => {
  const gateway = new BotGateway({
    onboardingService: {
      async start(session) {
        return { stage: 'phone_verification_required', welcomeKind: session.context.source };
      },
    },
  });

  const result = await gateway.handleStart({
    channel: 'max',
    externalUserId: '2002',
    payload: 'm_VM-041',
  });

  assert.equal(result.onboarding.stage, 'phone_verification_required');
  assert.equal(result.onboarding.welcomeKind, 'machine_qr');
});
