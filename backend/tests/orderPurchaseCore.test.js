const assert = require('assert/strict');
const { test } = require('node:test');

const { createApp } = require('../src/main');
const { createTelegramInitData } = require('./helpers/createTelegramInitData');
const { createTestDependencies } = require('./helpers/createTestDependencies');

test('customer creates an order through protected API', async (t) => {
  const botToken = '123456:test_bot_token';
  const dependencies = createTestDependencies({ botToken });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { accessToken, customerId } = await createAuthenticatedCustomer({
    baseUrl,
    botToken,
    telegramUserId: 779001,
    idempotencyKey: 'order-core-session-create',
  });

  const response = await fetch(`${baseUrl}/api/v1/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'order-create-test-001',
    },
    body: JSON.stringify({
      amount: 150,
      currency: 'RUB',
    }),
  });

  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.data.type, 'order');
  assert.equal(payload.data.attributes.customer_id, customerId);
  assert.equal(payload.data.attributes.status, 'PAYMENT_PENDING');
  assert.equal(payload.data.attributes.amount, 150);
  assert.equal(payload.data.attributes.currency, 'RUB');

  const events = dependencies.domainEventPublisher.getPublishedEvents({
    name: 'OrderCreated',
    aggregateId: payload.data.id,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].canonicalName, 'Orders.Created');
});

test('order endpoints reject unauthorized requests', async (t) => {
  const dependencies = createTestDependencies({ botToken: '123456:test_bot_token' });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const createResponse = await fetch(`${baseUrl}/api/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: 150,
      currency: 'RUB',
    }),
  });
  assert.equal(createResponse.status, 401);

  const readResponse = await fetch(`${baseUrl}/api/v1/orders/order_test_1`);
  assert.equal(readResponse.status, 401);

  const historyResponse = await fetch(`${baseUrl}/api/v1/customer/orders`);
  assert.equal(historyResponse.status, 401);
});

test('payment confirmation changes order state and generates OrderPaid event', async (t) => {
  const botToken = '123456:test_bot_token';
  const dependencies = createTestDependencies({ botToken });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { accessToken, customerId } = await createAuthenticatedCustomer({
    baseUrl,
    botToken,
    telegramUserId: 779002,
    idempotencyKey: 'order-core-session-payment',
  });
  const orderId = await createOrder({
    baseUrl,
    accessToken,
    amount: 170,
    idempotencyKey: 'order-create-test-002',
  });

  const result = await dependencies.orderRuntime.confirmPayment(orderId, {
    customerId,
    correlationId: 'corr_order_payment_confirmed',
    causationId: 'test_payment_confirmation',
    actorType: 'system',
    actorId: 'test_payment_runtime',
    sourceChannel: 'test',
  });

  assert.equal(result.changed, true);
  assert.equal(result.order.status, 'PAID');
  assert.equal(result.clubAccountIntegration.service, 'ClubAccountService');
  assert.equal(result.clubAccountIntegration.applied, false);
  assert.deepEqual(result.clubAccountIntegration.future_capabilities, [
    'bonus_accrual',
    'deposit_usage',
    'loyalty_rules',
  ]);

  const events = dependencies.domainEventPublisher.getPublishedEvents({
    name: 'OrderPaid',
    aggregateId: orderId,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].canonicalName, 'Orders.PaymentConfirmed');
  assert.equal(events[0].payload.to_status, 'PAID');
  assert.equal(events[0].payload.amount, 170);

  const readResponse = await fetch(`${baseUrl}/api/v1/orders/${orderId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  assert.equal(readResponse.status, 200);
  const readPayload = await readResponse.json();
  assert.equal(readPayload.data.attributes.status, 'PAID');
});

test('customer order history is returned for current customer', async (t) => {
  const botToken = '123456:test_bot_token';
  const dependencies = createTestDependencies({ botToken });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { accessToken, customerId } = await createAuthenticatedCustomer({
    baseUrl,
    botToken,
    telegramUserId: 779003,
    idempotencyKey: 'order-core-session-history',
  });
  const firstOrderId = await createOrder({
    baseUrl,
    accessToken,
    amount: 150,
    idempotencyKey: 'order-create-test-003',
  });
  const secondOrderId = await createOrder({
    baseUrl,
    accessToken,
    amount: 180,
    idempotencyKey: 'order-create-test-004',
  });

  const response = await fetch(`${baseUrl}/api/v1/customer/orders`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.length, 2);
  assert.deepEqual(
    payload.data.map((order) => order.id).sort(),
    [firstOrderId, secondOrderId].sort(),
  );
  assert.deepEqual(
    [...new Set(payload.data.map((order) => order.attributes.customer_id))],
    [customerId],
  );
  assert.deepEqual(
    payload.data.map((order) => order.attributes.status).sort(),
    ['PAYMENT_PENDING', 'PAYMENT_PENDING'],
  );
});

async function createAuthenticatedCustomer({
  baseUrl,
  botToken,
  telegramUserId,
  idempotencyKey,
}) {
  const telegramInitData = createTelegramInitData({
    botToken,
    user: {
      id: telegramUserId,
      first_name: 'Order',
      last_name: 'Customer',
      username: `order_customer_${telegramUserId}`,
      language_code: 'ru',
    },
    authDate: Math.floor(Date.now() / 1000),
  });

  const authResponse = await fetch(`${baseUrl}/api/v1/auth/telegram-mini-app/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      telegram_init_data: telegramInitData,
      source_channel: 'telegram_mini_app',
      client_request_id: idempotencyKey,
    }),
  });

  assert.equal(authResponse.status, 201);
  const authPayload = await authResponse.json();

  return {
    accessToken: authPayload.data.attributes.access_token,
    customerId: authPayload.data.attributes.customer_id,
  };
}

async function createOrder({ baseUrl, accessToken, amount, idempotencyKey }) {
  const response = await fetch(`${baseUrl}/api/v1/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      amount,
      currency: 'RUB',
    }),
  });

  assert.equal(response.status, 201);
  const payload = await response.json();

  return payload.data.id;
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}
