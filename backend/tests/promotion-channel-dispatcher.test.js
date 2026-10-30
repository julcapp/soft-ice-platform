'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PromotionChannelWebhookDispatcher, createPromotionDispatchersFromEnv } = require('../src/modules/promotion_engine/PromotionChannelWebhookDispatcher');

test('dispatcher sends server-to-server payload with bearer token', async () => {
  let request;
  const dispatcher = new PromotionChannelWebhookDispatcher({
    url: 'https://bot-gateway.example/promo', token: 'secret',
    fetchImpl: async (url, options) => { request = { url, options }; return { ok: true, status: 202, json: async () => ({ delivery_id: 'd1' }) }; },
  });
  const result = await dispatcher.send({
    channel: 'TELEGRAM', message: 'hello', startsAt: new Date('2026-08-25T14:00:00Z'), endsAt: new Date('2026-08-25T16:00:00Z'),
    campaign: { id: 'c1', currentVersion: { id: 'v1' } },
  });
  assert.equal(request.url, 'https://bot-gateway.example/promo');
  assert.equal(request.options.headers.Authorization, 'Bearer secret');
  const body = JSON.parse(request.options.body);
  assert.equal(body.event, 'promotion.pre_notification');
  assert.equal(body.channel, 'TELEGRAM');
  assert.equal(result.deliveryId, 'd1');
});

test('env factory creates only configured channel dispatchers', () => {
  const dispatchers = createPromotionDispatchersFromEnv({ PROMOTION_TELEGRAM_DISPATCH_URL: 'https://gateway/tg', PROMOTION_TELEGRAM_DISPATCH_TOKEN: 'x' });
  assert.ok(dispatchers.TELEGRAM);
  assert.equal(dispatchers.MAX, undefined);
  assert.equal(dispatchers.VK, undefined);
});
