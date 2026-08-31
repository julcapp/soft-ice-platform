'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BotActionRouter,
  BotGiftActionService,
  TelegramRenderer,
  MaxRenderer,
  buildGiftAcceptAction,
  parseGiftAction,
} = require('../src/modules/bot_core');

function fixture({ gifts = [], acceptError = null } = {}) {
  const calls = [];
  const giftTransferRuntime = {
    listOwn: async (customerId) => {
      calls.push(['listOwn', customerId]);
      return gifts;
    },
    accept: async (customerId, giftId, context) => {
      calls.push(['accept', customerId, giftId, context]);
      if (acceptError) throw acceptError;
      return { id: giftId, recipientCustomerId: customerId, status: 'ACCEPTED' };
    },
  };
  const service = new BotGiftActionService({
    giftTransferRuntime,
    miniAppUrl: 'https://app.utimoshi.ru',
    logger: { warn() {} },
  });
  const router = new BotActionRouter({
    customerExperienceService: {
      buildMainMenuView: async () => ({ title: 'menu' }),
    },
    giftActionService: service,
  });
  return { calls, service, router };
}

test('gift action codec accepts only bounded gift identifiers', () => {
  const action = buildGiftAcceptAction('gift_123e4567-e89b-12d3-a456-426614174000');
  assert.equal(action, 'gift_accept:gift_123e4567-e89b-12d3-a456-426614174000');
  assert.deepEqual(parseGiftAction(action), {
    kind: 'gift_accept',
    giftId: 'gift_123e4567-e89b-12d3-a456-426614174000',
  });
  assert.equal(parseGiftAction('gift_accept:../../foreign'), null);
  assert.throws(() => buildGiftAcceptAction('foreign-gift'), /Valid giftId/);
});

test('gifts view exposes only gifts received by the authenticated customer', async () => {
  const { router, calls } = fixture({
    gifts: [
      { id: 'gift_received-1', recipientCustomerId: 'customer-1', status: 'AVAILABLE', createdAt: '2026-08-31T10:00:00Z', metadata: { senderName: 'Александр' } },
      { id: 'gift_sent-1', recipientCustomerId: 'customer-2', status: 'AVAILABLE', createdAt: '2026-08-31T09:00:00Z' },
      { id: 'gift_cancelled-1', recipientCustomerId: 'customer-1', status: 'CANCELLED', createdAt: '2026-08-31T08:00:00Z' },
    ],
  });

  const view = await router.route({ action: 'gifts', customerId: 'customer-1', channel: 'telegram' });

  assert.equal(calls[0][0], 'listOwn');
  assert.match(view.text, /Можно принять: 1/);
  assert.equal(view.actions[0].action, 'gift_accept:gift_received-1');
  assert.match(view.actions[0].label, /Александр/);
  assert.equal(view.actions.some((action) => action.action?.includes('gift_sent-1')), false);
});

test('gift acceptance is recipient-bound and returns Telegram disabled state after success', async () => {
  const { router, calls } = fixture();
  const action = buildGiftAcceptAction('gift_123e4567-e89b-12d3-a456-426614174000');

  const view = await router.route({
    action,
    customerId: 'customer-1',
    channel: 'telegram',
    context: { correlationId: 'corr-1' },
  });

  assert.deepEqual(calls[0].slice(0, 3), [
    'accept',
    'customer-1',
    'gift_123e4567-e89b-12d3-a456-426614174000',
  ]);
  assert.equal(calls[0][3].sourceChannel, 'bot_telegram');

  const rendered = new TelegramRenderer({ features: { disabledButtons: true } }).renderView(view);
  assert.deepEqual(rendered.reply_markup.inline_keyboard[0][0], {
    text: 'Подарок принят',
    disabled: {},
  });
  assert.equal(rendered.delivery, null);
});

test('MAX success view removes repeat acceptance action', async () => {
  const { router } = fixture();
  const view = await router.route({
    action: buildGiftAcceptAction('gift_123e4567-e89b-12d3-a456-426614174000'),
    customerId: 'customer-1',
    channel: 'max',
  });
  const rendered = new MaxRenderer().renderView(view);
  const payloads = rendered.attachments[0].payload.buttons.flat().map((button) => button.payload).filter(Boolean);
  assert.equal(payloads.some((payload) => payload.startsWith('action:gift_accept:')), false);
});

test('unauthenticated callback never reaches GiftTransferRuntime', async () => {
  const { router, calls } = fixture();
  const view = await router.route({
    action: buildGiftAcceptAction('gift_123e4567-e89b-12d3-a456-426614174000'),
    customerId: null,
    channel: 'telegram',
  });
  assert.equal(calls.length, 0);
  assert.match(view.text, /завершите вход/);
});

test('expected domain rejection is converted to a safe customer view', async () => {
  const error = Object.assign(new Error('internal details'), { code: 'RESOURCE_NOT_FOUND', statusCode: 404 });
  const { router } = fixture({ acceptError: error });
  const view = await router.route({
    action: buildGiftAcceptAction('gift_123e4567-e89b-12d3-a456-426614174000'),
    customerId: 'customer-1',
    channel: 'telegram',
  });
  assert.equal(view.title, 'Подарок недоступен');
  assert.doesNotMatch(view.text, /internal details/);
});
