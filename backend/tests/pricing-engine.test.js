'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PricingEngineService } = require('../src/modules/promotion_engine/PricingEngineService');

function promotion() {
  return {
    id: 'promo-1',
    currentVersion: {
      id: 'promo-v1',
      benefitType: 'PERCENT_DISCOUNT',
      benefitValue: 20,
      priceLockSeconds: 300,
      rules: [
        { ruleType: 'BONUS_PAYMENT', value: 'FORBIDDEN' },
        { ruleType: 'THIRD_PARTY_TRANSFER', value: 'FORBIDDEN' },
        { ruleType: 'MONEY_DISCOUNT_STACKING', value: 'FORBIDDEN' },
      ],
    },
  };
}

function fixture({ giftItemIds = [], activePromotion = promotion(), reserveResult = { reserved: true } } = {}) {
  let saved;
  const repository = {
    saveQuote: async (quote) => { saved = quote; return quote; },
    replaceQuotePricing: async (id, quote) => { saved = { ...quote, id }; return saved; },
    getQuote: async () => saved,
    getQuoteByOrderId: async () => saved,
    consumeQuote: async (id, consumedAt) => ({ ...saved, id, consumedAt }),
  };
  const gift = giftItemIds.length
    ? { giftItemIds, eligible: true, itemId: giftItemIds[0], purchaseOrdinal: 50 }
    : { giftItemIds: [], eligible: false };
  const service = new PricingEngineService({
    repository,
    promotionResolver: { resolve: async () => activePromotion },
    giftResolver: {
      resolve: async () => gift,
      reserve: async () => reserveResult,
      consume: async () => null,
      completePurchase: async () => null,
    },
    clock: () => new Date('2026-08-23T10:00:00Z'),
  });
  return { service, repository };
}

test('Happy Hour applies 20% only to paid items after gift', async () => {
  const { service } = fixture({ giftItemIds: ['ice'] });
  const quote = await service.createQuote({
    customerId: 'c1', machineId: 'm1', channel: 'TERMINAL',
    items: [
      { id: 'ice', name: 'Мороженое', unitPrice: 250 },
      { id: 'topping', name: 'Топпинг', unitPrice: 50 },
      { id: 'addon', name: 'Добавка', unitPrice: 40 },
    ],
  });
  assert.equal(quote.baseAmount, 340);
  assert.equal(quote.giftAmount, 250);
  assert.equal(quote.promotionDiscountAmount, 18);
  assert.equal(quote.finalAmount, 72);
  assert.equal(quote.items[0].finalAmount, 0);
  assert.equal(quote.partialBonusPaymentAllowed, false);
  assert.equal(quote.transferAllowed, false);
  assert.equal(quote.paymentRequired, true);
  assert.equal(quote.lockedUntil.toISOString(), '2026-08-23T10:05:00.000Z');
});

test('fully gifted order bypasses payment', async () => {
  const { service } = fixture({ giftItemIds: ['ice'] });
  const quote = await service.createQuote({ customerId: 'c1', machineId: 'm1', channel: 'TERMINAL', items: [{ id: 'ice', unitPrice: 250 }] });
  assert.equal(quote.finalAmount, 0);
  assert.equal(quote.paymentRequired, false);
});

test('gift reservation conflict reprices quote without gift', async () => {
  const { service } = fixture({ giftItemIds: ['ice'], reserveResult: { reserved: false, reason: 'GIFT_ALREADY_RESERVED' } });
  const quote = await service.createQuote({
    customerId: 'c1', machineId: 'm1', channel: 'TERMINAL',
    items: [{ id: 'ice', unitPrice: 250 }],
  });
  assert.equal(quote.giftAmount, 0);
  assert.equal(quote.promotionDiscountAmount, 50);
  assert.equal(quote.finalAmount, 200);
  assert.equal(quote.paymentRequired, true);
  assert.equal(quote.rules.giftPurchaseOrdinal, null);
});

test('without active promotion price remains ordinary and transfer stays allowed', async () => {
  const { service } = fixture({ activePromotion: null });
  const quote = await service.createQuote({ machineId: 'm1', channel: 'WEB', items: [{ id: 'ice', unitPrice: 250 }] });
  assert.equal(quote.finalAmount, 250);
  assert.equal(quote.promotionDiscountAmount, 0);
  assert.equal(quote.partialBonusPaymentAllowed, true);
  assert.equal(quote.transferAllowed, true);
});

test('expired quote cannot be consumed', async () => {
  const store = { quote: null };
  const clock = (() => {
    let now = new Date('2026-08-23T10:00:00Z');
    const fn = () => now;
    fn.advance = () => { now = new Date('2026-08-23T10:06:00Z'); };
    return fn;
  })();
  const service = new PricingEngineService({
    repository: {
      saveQuote: async (q) => { store.quote = q; return q; },
      replaceQuotePricing: async (id, q) => { store.quote = { ...q, id }; return store.quote; },
      getQuote: async () => store.quote,
      consumeQuote: async () => store.quote,
    },
    promotionResolver: { resolve: async () => promotion() },
    clock,
  });
  const quote = await service.createQuote({ machineId: 'm1', channel: 'TERMINAL', items: [{ id: 'ice', unitPrice: 250 }] });
  clock.advance();
  await assert.rejects(() => service.consumeQuote(quote.id), (error) => error.code === 'PRICING_QUOTE_EXPIRED');
});
