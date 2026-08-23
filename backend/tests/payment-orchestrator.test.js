const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PaymentOrchestrator } = require('../src/modules/payment/PaymentOrchestrator');

function fixture() {
  const order = { id: 'order-1', customerId: 'customer-1', machineId: 'machine-1', status: 'PAYMENT_PENDING', amount: 72, currency: 'RUB' };
  let providerAttached = null;
  let confirmed = 0;
  let completed = 0;
  const repository = {
    createAttempt: async (input) => ({ id: 'attempt-1', ...input }),
    attachProviderPayment: async (id, payment) => { providerAttached = payment; return { id, providerPaymentId: payment.id, confirmationUrl: payment.confirmation.confirmation_url }; },
    findByOrderId: async () => [],
    findByProviderPaymentId: async () => ({ id: 'attempt-1', orderId: 'order-1', amount: 72, currency: 'RUB' }),
    markSucceeded: async () => ({}),
    markCancelled: async () => ({}),
  };
  const adapter = {
    createPayment: async ({ orderId, amount, method }) => ({ id: 'yk-1', status: 'pending', confirmation: { confirmation_url: 'https://pay.example/1' }, metadata: { order_id: orderId }, amount: { value: String(amount), currency: 'RUB' }, payment_method: { type: method } }),
    getPayment: async () => ({ id: 'yk-1', status: 'succeeded', paid: true, amount: { value: '72.00', currency: 'RUB' }, metadata: { order_id: 'order-1' } }),
  };
  const orderRuntime = {
    orderService: { orderRepository: { findById: async () => order } },
    confirmPayment: async () => { confirmed += 1; return { order: { ...order, status: 'PAID' }, changed: true }; },
  };
  const gift = { completePurchase: async () => { completed += 1; } };
  return { service: new PaymentOrchestrator({ repository, adapter, orderRuntime, fiftiethPurchaseGiftResolver: gift }), stats: () => ({ providerAttached, confirmed, completed }) };
}

test('SBP payment is created from server order amount', async () => {
  const { service, stats } = fixture();
  const attempt = await service.startPayment({ orderId: 'order-1', customerId: 'customer-1', method: 'sbp', returnUrl: 'https://app.example/payment-return', idempotencyKey: 'idem-1' });
  assert.equal(attempt.providerPaymentId, 'yk-1');
  assert.equal(stats().providerAttached.metadata.order_id, 'order-1');
});

test('payment.succeeded webhook is reverified before confirming order and reward counter', async () => {
  const { service, stats } = fixture();
  const result = await service.handleWebhook({ type: 'notification', event: 'payment.succeeded', object: { id: 'yk-1', status: 'succeeded' } });
  assert.equal(result.status, 'SUCCEEDED');
  assert.equal(stats().confirmed, 1);
  assert.equal(stats().completed, 1);
});

test('verified amount mismatch blocks payment confirmation', async () => {
  const { service, stats } = fixture();
  service.adapter.getPayment = async () => ({ id: 'yk-1', status: 'succeeded', paid: true, amount: { value: '1.00', currency: 'RUB' }, metadata: { order_id: 'order-1' } });
  await assert.rejects(
    () => service.handleWebhook({ type: 'notification', event: 'payment.succeeded', object: { id: 'yk-1' } }),
    (error) => error.code === 'YOOKASSA_AMOUNT_MISMATCH',
  );
  assert.equal(stats().confirmed, 0);
});
