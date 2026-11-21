'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { QuotedOrderService } = require('../src/modules/order/QuotedOrderService');

function paidQuote(overrides = {}) {
  return {
    id: 'quote-1', customerId: 'customer-1', machineId: 'machine-1', currency: 'RUB',
    finalAmount: 200, baseAmount: 250, giftAmount: 0, promotionDiscountAmount: 50,
    paymentRequired: true, transferAllowed: false, partialBonusPaymentAllowed: false,
    snapshotId: 'snapshot-1', channel: 'MINI_APP', lockedUntil: new Date(Date.now() + 300000),
    ...overrides,
  };
}

test('paid order uses quote final amount and consumes quote with order id', async () => {
  let createdRequest;
  let consumed;
  const pricingEngineService = {
    getValidQuote: async () => paidQuote(),
    consumeQuote: async (quoteId, options) => { consumed = { quoteId, ...options }; return {}; },
  };
  const orderRuntime = {
    createOrder: async (customerId, request) => { createdRequest = request; return { order: { id: 'order-1', customerId, status: 'PAYMENT_PENDING', amount: request.amount } }; },
    cancelOrder: async () => { throw new Error('must not cancel'); },
  };
  const service = new QuotedOrderService({ orderRuntime, pricingEngineService });
  const result = await service.createOrder('customer-1', { quoteId: 'quote-1' });
  assert.equal(createdRequest.amount, 200);
  assert.deepEqual(consumed, { quoteId: 'quote-1', orderId: 'order-1' });
  assert.equal(result.pricing.paymentRequired, true);
  assert.equal(result.pricing.transferAllowed, false);
});

test('customer cannot use another customer quote', async () => {
  const service = new QuotedOrderService({
    orderRuntime: {},
    pricingEngineService: { getValidQuote: async () => paidQuote({ customerId: 'other-customer' }) },
  });
  await assert.rejects(() => service.createOrder('customer-1', { quoteId: 'quote-1' }), (error) => error.code === 'PRICING_QUOTE_CUSTOMER_MISMATCH');
});

test('zero amount quote bypasses external payment and confirms order internally', async () => {
  let consumed;
  const orderRepository = { create: async ({ customerId, amount }) => ({ id: 'order-free', customerId, amount, currency: 'RUB', status: 'PAYMENT_PENDING' }) };
  const orderService = {
    orderRepository,
    publishOrderEvent: async () => ({ id: 'event-created' }),
    recordAudit: async () => null,
  };
  const orderRuntime = {
    orderService,
    confirmPayment: async (id) => ({ order: { id, customerId: 'customer-1', amount: 0, status: 'PAID' }, changed: true }),
    cancelOrder: async () => null,
  };
  const pricingEngineService = {
    getValidQuote: async () => paidQuote({ finalAmount: 0, baseAmount: 250, giftAmount: 250, promotionDiscountAmount: 0, paymentRequired: false }),
    consumeQuote: async (quoteId, options) => { consumed = { quoteId, ...options }; return {}; },
  };
  const service = new QuotedOrderService({ orderRuntime, pricingEngineService });
  const result = await service.createOrder('customer-1', { quoteId: 'quote-1' });
  assert.equal(result.order.status, 'PAID');
  assert.equal(result.paymentBypassed, true);
  assert.equal(result.pricing.finalAmount, 0);
  assert.deepEqual(consumed, { quoteId: 'quote-1', orderId: 'order-free' });
});
