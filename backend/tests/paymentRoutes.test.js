const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const { attachCorrelationId, sendError } = require('../src/platform/http/apiResponse');
const { createPaymentRouter } = require('../src/api/v1/paymentRoutes');

async function serverFor({ order = null, flow = null, payment = null, checkout = null } = {}) {
  const app = express();
  app.use(express.json());
  app.use(attachCorrelationId);

  const repository = {
    prisma: {
      order: {
        findFirst: async ({ where }) => order && order.id === where.id && order.customerId === where.customerId ? order : null,
      },
      saleFlow: {
        findFirst: async ({ where }) => flow && flow.orderId === where.orderId && flow.customerId === where.customerId ? flow : null,
      },
      payment: {
        findFirst: async ({ where }) => {
          if (!payment) return null;
          if (where.id && payment.id !== where.id) return null;
          if (where.orderId && payment.orderId !== where.orderId) return null;
          if (where.customerId && payment.customerId !== where.customerId) return null;
          return payment;
        },
      },
    },
  };

  const paymentCheckoutService = checkout || {
    initiate: async (request) => ({
      payment: {
        id: 'pay-1', orderId: request.orderId, amount: '95.00', currency: 'RUB',
        channel: request.channel, status: 'PENDING', confirmationUrl: 'https://yookassa.test/confirm',
      },
      status: 'PENDING', userState: 'PENDING',
      confirmationUrl: 'https://yookassa.test/confirm', duplicate: false,
    }),
    refreshPayment: async ({ paymentId }) => ({
      payment: { ...payment, id: paymentId, status: 'SUCCEEDED', providerStatus: 'succeeded', succeededAt: new Date('2026-10-06T10:00:00Z') },
      status: 'SUCCEEDED', userState: 'SUCCESS',
    }),
  };

  app.use('/api/v1/payments', createPaymentRouter({
    authCoreService: { authenticateAccessToken: async () => ({ subject_id: 'customer-1' }) },
    paymentRepository: repository,
    paymentCheckoutService,
  }));
  app.use((error, req, res, next) => sendError(res, req, error));
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}

const auth = { Authorization: 'Bearer test', 'Content-Type': 'application/json' };

test('customer checkout uses authoritative sale flow scope and MINIAPP channel', async (t) => {
  let captured;
  const server = await serverFor({
    order: { id: 'order-1', customerId: 'customer-1' },
    flow: { flowId: 'flow-1', orderId: 'order-1', customerId: 'customer-1', organizationId: 'org-1' },
    checkout: {
      initiate: async (request) => {
        captured = request;
        return {
          payment: { id: 'pay-1', orderId: 'order-1', amount: '95.00', currency: 'RUB', channel: request.channel, status: 'PENDING' },
          status: 'PENDING', userState: 'PENDING', confirmationUrl: 'https://yookassa.test/pay', duplicate: false,
        };
      },
    },
  });
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/payments/orders/order-1`, {
    method: 'POST',
    headers: { ...auth, 'Idempotency-Key': 'idem-1' },
    body: JSON.stringify({
      channel: 'MINIAPP',
      method: 'sbp',
      returnUrl: 'https://miniapp.utimoshi.ru/?mode=payment-return&orderId=order-1',
    }),
  });

  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.data.attributes.user_state, 'PENDING');
  assert.equal(payload.data.attributes.confirmation_url, 'https://yookassa.test/pay');
  assert.equal(captured.organizationId, 'org-1');
  assert.equal(captured.saleFlowId, 'flow-1');
  assert.equal(captured.channel, 'MINIAPP');
  assert.equal(captured.idempotencyKey, 'idem-1');
});

test('customer checkout never accepts TERMINAL through customer endpoint', async (t) => {
  const server = await serverFor({
    order: { id: 'order-1', customerId: 'customer-1' },
    flow: { flowId: 'flow-1', orderId: 'order-1', customerId: 'customer-1', organizationId: 'org-1' },
  });
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/payments/orders/order-1`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      channel: 'TERMINAL',
      method: 'sbp',
      returnUrl: 'https://display.utimoshi.ru/',
    }),
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'PAYMENT_CHANNEL_INVALID');
});

test('customer cannot initiate payment for another customer order', async (t) => {
  const server = await serverFor({
    order: { id: 'order-1', customerId: 'customer-2' },
    flow: { flowId: 'flow-1', orderId: 'order-1', customerId: 'customer-2', organizationId: 'org-1' },
  });
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/payments/orders/order-1`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      channel: 'WEB',
      method: 'sbp',
      returnUrl: 'https://utimoshi.ru/payment/return?orderId=order-1',
    }),
  });

  assert.equal(response.status, 404);
});

test('return screen refreshes provider state by order id before showing success', async (t) => {
  let refreshed;
  const server = await serverFor({
    payment: { id: 'pay-1', orderId: 'order-1', customerId: 'customer-1', organizationId: 'org-1', amount: '95.00', currency: 'RUB', channel: 'MINIAPP' },
    checkout: {
      refreshPayment: async (request) => {
        refreshed = request;
        return {
          payment: { id: 'pay-1', orderId: 'order-1', amount: '95.00', currency: 'RUB', channel: 'MINIAPP', status: 'SUCCEEDED', providerStatus: 'succeeded' },
          status: 'SUCCEEDED', userState: 'SUCCESS',
        };
      },
    },
  });
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/payments/orders/order-1/status`, {
    headers: { Authorization: 'Bearer test' },
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.attributes.user_state, 'SUCCESS');
  assert.deepEqual(refreshed, { organizationId: 'org-1', paymentId: 'pay-1' });
});

test('disabled terminal checkout and status return explicit availability error', async (t) => {
 const server = await serverFor();
 t.after(() => server.close());
 const base = `http://127.0.0.1:${server.address().port}/api/v1/payments/terminal`;
 for (const [url, options] of [[`${base}/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }], [`${base}/pay-1/status?machineId=test`, {}]]) {
  const response = await fetch(url, options);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error.code, 'PAYMENT_CHECKOUT_NOT_AVAILABLE');
 }
});

test('terminal methods expose disabled SBP and unconfigured physical POS without starting checkout', async (t) => {
 const server = await serverFor(); t.after(() => server.close());
 const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/payments/terminal/methods?machineId=test`);
 assert.equal(response.status, 200);
 assert.deepEqual((await response.json()).data.attributes.methods, [
  { id: 'sbp', available: false, reason_code: 'PAYMENT_CHECKOUT_NOT_AVAILABLE' },
  { id: 'pos', available: false, reason_code: 'TERMINAL_POS_NOT_CONFIGURED' },
 ]);
});
