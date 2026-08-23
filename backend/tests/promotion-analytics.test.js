'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PromotionAnalyticsService } = require('../src/modules/promotion_engine/PromotionAnalyticsService');

test('delivery receipt stores actual delivered count separately from dispatch acceptance', async () => {
  let created;
  const service = new PromotionAnalyticsService({
    prisma: { promotionEvent: { create: async ({ data }) => { created = data; return { id: 'e1', ...data }; } } },
    clock: () => new Date('2026-08-25T14:00:30Z'),
  });
  await service.ingestDeliveryReceipt({ campaignId: 'c1', promotionVersionId: 'v1', channel: 'TELEGRAM', deliveryId: 'd1', deliveredCount: 120, sourceEvent: 'promotion.started' });
  assert.equal(created.eventType, 'CHANNEL_DELIVERED');
  assert.equal(created.newValue.deliveredCount, 120);
  assert.equal(created.metadata.funnelEvent, 'DELIVERED');
});

test('channel funnel calculates delivery, CTR and purchase conversion', async () => {
  const rows = [
    { eventType: 'START_NOTIFICATION_SENT', newValue: { channel: 'TELEGRAM' }, metadata: {} },
    { eventType: 'CHANNEL_DELIVERED', newValue: { channel: 'TELEGRAM', deliveredCount: 100 }, metadata: {} },
    { eventType: 'CHANNEL_OPENED', newValue: { channel: 'TELEGRAM' }, metadata: {} },
    { eventType: 'CHANNEL_OPENED', newValue: { channel: 'TELEGRAM' }, metadata: {} },
    { eventType: 'CHANNEL_CLICKED', newValue: { channel: 'TELEGRAM' }, metadata: {} },
    { eventType: 'CHANNEL_PURCHASE', newValue: { channel: 'TELEGRAM' }, metadata: {} },
  ];
  const service = new PromotionAnalyticsService({ prisma: { promotionEvent: { findMany: async () => rows } } });
  const funnel = await service.getFunnel({ campaignId: 'c1', promotionVersionId: 'v1' });
  const telegram = funnel.channels.TELEGRAM;
  assert.equal(telegram.dispatchAccepted, 1);
  assert.equal(telegram.delivered, 100);
  assert.equal(telegram.opened, 2);
  assert.equal(telegram.clicked, 1);
  assert.equal(telegram.purchase, 1);
  assert.equal(telegram.ctr, 0.01);
  assert.equal(telegram.purchaseConversion, 0.01);
  assert.equal(telegram.clickToPurchase, 1);
});
