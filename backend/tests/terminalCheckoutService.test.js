const test = require('node:test');
const assert = require('node:assert/strict');
const { TerminalCheckoutService } = require('../src/modules/payment/TerminalCheckoutService');

function fixture() {
  const calls = { order: null, flow: null, reserve: null, payment: null, quoteConsumed: null, contactUpdate: null };
  const now = new Date('2026-10-08T03:00:00.000Z');
  const quote = {
    id: 'quote-1',
    customerId: null,
    machineId: 'TEST-MACHINE-001',
    channel: 'TERMINAL',
    currency: 'RUB',
    baseAmount: 120,
    promotionDiscountAmount: 25,
    finalAmount: 95,
    lockedUntil: new Date('2026-10-08T03:05:00.000Z'),
    consumedAt: null,
    orderId: null,
    items: [
      { sku: 'ice_cream', quantity: 1 },
      { sku: 'topping_none', quantity: 1 },
      { sku: 'sprinkle_none', quantity: 1 },
    ],
  };
  const tx = {
    pricingQuote: { findUnique: async () => ({ ...quote, snapshot: { items: quote.items } }) },
    customer: { findUnique: async () => null },
    order: {
      create: async ({ data }) => {
        calls.order = data;
        return { id: 'order-1', ...data };
      },
    },
    saleFlow: {
      create: async ({ data }) => {
        calls.flow = data;
        return { id: 'flow-row-1', ...data };
      },
    },
    unverifiedPurchaseContact: {
      findFirst: async () => ({ id: 'contact-1', orderId: null }),
      updateMany: async ({ where, data }) => {
        calls.contactUpdate = { where, data };
        return { count: 1 };
      },
    },
    transactionalOutboxEvent: { create: async ({ data }) => ({ id: 'outbox-1', ...data }) },
  };
  const prisma = {
    $transaction: async (fn) => fn(tx),
    order: { findUnique: async () => ({ id: 'order-1', amount: 95 }) },
    saleFlow: { findUnique: async () => ({ orderId: 'order-1', flowId: calls.flow?.flowId, machineId: 'TEST-MACHINE-001', organizationId: 'org-1' }) },
    payment: {
      findFirst: async () => null,
      findUnique: async () => null,
    },
  };
  const pricingRepository = {
    getQuote: async () => ({ ...quote }),
    consumeQuote: async (id, consumedAt, orderId, options) => {
      calls.quoteConsumed = { id, consumedAt, orderId, options };
      return { ...quote, orderId, consumedAt };
    },
  };
  const catalogService = {
    resolveInventoryRecipe: async (skus) => {
      assert.deepEqual(skus, ['ice_cream', 'topping_none', 'sprinkle_none']);
      return [{ inventoryItemId: 'mix-1', ingredientType: 'MIX', unit: 'gram', quantity: 75 }];
    },
  };
  const organizationContext = { resolveByMachine: async () => ({ organizationId: 'org-1', locationId: 'loc-1' }) };
  const inventory = {
    checkAndReserve: async (request, options) => {
      calls.reserve = { request, options };
      return { available: true, reservationId: 'reservation-1' };
    },
  };
  const paymentCheckoutService = {
    initiate: async (request) => {
      calls.payment = request;
      return {
        payment: { id: 'payment-1', orderId: 'order-1', amount: 95, currency: 'RUB', status: 'PENDING', confirmationUrl: 'https://yookassa.test/pay/1' },
        status: 'PENDING',
        userState: 'PENDING',
        confirmationUrl: 'https://yookassa.test/pay/1',
      };
    },
    refreshPayment: async () => { throw new Error('not expected'); },
  };
  const paymentService = {};
  const buyerTokenService = {
    verify: () => ({ kind: 'UNVERIFIED', id: 'contact-1', machineId: 'TEST-MACHINE-001' }),
  };
  return {
    calls, prisma, pricingRepository, catalogService, organizationContext, inventory,
    paymentCheckoutService, paymentService, buyerTokenService,
    service: new TerminalCheckoutService({
      prisma, pricingRepository, catalogService, organizationContext, inventory,
      paymentCheckoutService, paymentService, buyerTokenService,
      clock: () => now,
    }),
  };
}

test('terminal checkout creates order strictly from authoritative quote and links unverified buyer', async () => {
  const f = fixture();
  const result = await f.service.initiate({
    machineId: 'TEST-MACHINE-001',
    quoteId: 'quote-1',
    purchaseToken: 'signed-token',
    method: 'sbp',
    idempotencyKey: 'click-1',
  }, { correlationId: 'corr-1' });

  assert.equal(result.userState, 'PENDING');
  assert.equal(result.confirmationUrl, 'https://yookassa.test/pay/1');
  assert.equal(f.calls.order.amount, 95);
  assert.equal(f.calls.order.customerId, null);
  assert.equal(f.calls.order.status, 'PAYMENT_PENDING');
  assert.equal(f.calls.flow.currentState, 'AWAITING_PAYMENT');
  assert.equal(f.calls.flow.metadata.unverifiedContactId, 'contact-1');
  assert.equal(f.calls.reserve.request.orderId, 'order-1');
  assert.equal(f.calls.reserve.options.transactionClient, f.calls.quoteConsumed.options.transactionClient);
  assert.equal(f.calls.quoteConsumed.orderId, 'order-1');
  assert.equal(f.calls.payment.channel, 'TERMINAL');
  assert.equal(f.calls.payment.method, 'sbp');
  assert.equal(f.calls.payment.orderId, 'order-1');
  assert.equal('amount' in f.calls.payment, false);
});

test('terminal status refresh is machine-scoped and provider-authoritative', async () => {
  const f = fixture();
  f.prisma.payment.findUnique = async () => ({
    id: 'payment-1',
    organizationId: 'org-1',
    orderId: 'order-1',
    amount: 95,
    currency: 'RUB',
    status: 'PENDING',
    provider: 'YOOKASSA',
    channel: 'TERMINAL',
    confirmationUrl: 'https://yookassa.test/pay/1',
    saleFlow: { machineId: 'TEST-MACHINE-001' },
  });
  f.paymentCheckoutService.refreshPayment = async ({ organizationId, paymentId }) => {
    assert.equal(organizationId, 'org-1');
    assert.equal(paymentId, 'payment-1');
    return {
      payment: {
        id: 'payment-1', orderId: 'order-1', amount: 95, currency: 'RUB',
        status: 'SUCCEEDED', confirmationUrl: 'https://yookassa.test/pay/1',
        succeededAt: new Date('2026-10-08T03:01:00.000Z'),
      },
      status: 'SUCCEEDED',
      userState: 'SUCCESS',
    };
  };

  const result = await f.service.status({ machineId: 'TEST-MACHINE-001', paymentId: 'payment-1' });
  assert.equal(result.userState, 'SUCCESS');
  await assert.rejects(
    () => f.service.status({ machineId: 'OTHER', paymentId: 'payment-1' }),
    (error) => error.code === 'TERMINAL_PAYMENT_NOT_FOUND',
  );
});

test('payment success exposes completion only from same-machine authoritative sale flow', async () => {
 const f = fixture();
 const payment = { id: 'pay-1', orderId: 'order-1', amount: 95, currency: 'RUB', status: 'SUCCEEDED' };
 for (const [flow, expected] of [
  [{ machineId: 'TEST-MACHINE-001', currentState: 'FULFILLMENT_AUTHORIZED' }, 'WAITING'],
  [{ machineId: 'TEST-MACHINE-001', currentState: 'COMPLETED' }, 'COMPLETED'],
  [{ machineId: 'OTHER', currentState: 'COMPLETED' }, 'WAITING'],
  [{ machineId: 'TEST-MACHINE-001', currentState: 'REFUND_REQUIRED' }, 'ATTENTION_REQUIRED'],
  [{ machineId: 'TEST-MACHINE-001', recoveryStatus: 'NEEDS_RECONCILIATION' }, 'ATTENTION_REQUIRED'],
 ]) {
  f.prisma.saleFlow.findUnique = async () => flow;
  const result = await f.service.present({ payment }, 'TEST-MACHINE-001');
  assert.equal(result.fulfillmentState, expected);
  assert.equal(result.userState, 'SUCCESS');
 }
});

test('POS selection is rejected before quote consumption, order or inventory creation', async () => {
 const f = fixture();
 await assert.rejects(f.service.initiate({ machineId: 'TEST-MACHINE-001', quoteId: 'quote-1', method: 'pos', idempotencyKey: 'pos-1' }), { code: 'TERMINAL_POS_NOT_CONFIGURED' });
 assert.equal(f.calls.order, null); assert.equal(f.calls.reserve, null); assert.equal(f.calls.payment, null);
});
