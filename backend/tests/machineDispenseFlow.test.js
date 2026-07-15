const assert = require('assert/strict');
const { test } = require('node:test');

const { createApp } = require('../src/main');
const { createTelegramInitData } = require('./helpers/createTelegramInitData');
const { createTestDependencies } = require('./helpers/createTestDependencies');

test('paid order creates a dispense request and command', async (t) => {
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
    telegramUserId: 780001,
    idempotencyKey: 'machine-flow-session-request',
  });
  const machineId = await registerMachine({
    baseUrl,
    accessToken,
    machineCode: 'machine_dispense_001',
    idempotencyKey: 'machine-register-request',
  });
  const orderId = await createOrder({
    baseUrl,
    accessToken,
    amount: 160,
    idempotencyKey: 'machine-order-request',
  });

  const result = await dependencies.orderRuntime.confirmPayment(orderId, {
    customerId,
    correlationId: 'corr_machine_dispense_requested',
    causationId: 'test_payment_confirmation',
    actorType: 'system',
    actorId: 'test_payment_runtime',
    sourceChannel: 'test',
  });

  assert.equal(result.order.status, 'PAID');
  assert.equal(result.machineDispenseIntegration.applied, true);
  assert.equal(result.machineDispenseIntegration.created, true);
  assert.equal(result.machineDispenseIntegration.machine_id, machineId);
  assert.equal(result.machineDispenseIntegration.state, 'REQUESTED');

  const dispenseResponse = await fetch(`${baseUrl}/api/v1/orders/${orderId}/dispense`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(dispenseResponse.status, 200);
  const dispensePayload = await dispenseResponse.json();
  assert.equal(dispensePayload.data.type, 'dispense_request');
  assert.equal(dispensePayload.data.attributes.order_id, orderId);
  assert.equal(dispensePayload.data.attributes.machine_id, machineId);
  assert.equal(dispensePayload.data.attributes.state, 'REQUESTED');
  assert.equal(
    dispensePayload.data.attributes.command.payload.command_type,
    'DispenseCommand',
  );
  assert.equal(dispensePayload.data.attributes.command.payload.order_id, orderId);

  const events = dependencies.domainEventPublisher.getPublishedEvents({
    name: 'MachineDispenseRequested',
    aggregateId: dispensePayload.data.id,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].canonicalName, 'Machines.DispenseRequested');
  assert.equal(events[0].payload.to_state, 'REQUESTED');
});

test('machine receives dispense command and emits started event', async (t) => {
  const setup = await createPaidDispenseSetup(t, {
    telegramUserId: 780002,
    machineCode: 'machine_dispense_002',
    sessionKey: 'machine-flow-session-start',
  });

  const started = await setup.dependencies.machineRuntime.receiveDispenseCommand(
    setup.dispenseRequestId,
    {
      correlationId: 'corr_machine_dispense_started',
      actorType: 'machine',
      actorId: setup.machineId,
      sourceChannel: 'test_machine_runtime',
    },
  );

  assert.equal(started.changed, true);
  assert.equal(started.dispenseRequest.state, 'STARTED');
  assert.equal(started.dispenseRequest.startedAt.toISOString(), setup.now.toISOString());

  const events = setup.dependencies.domainEventPublisher.getPublishedEvents({
    name: 'DispenseStarted',
    aggregateId: setup.dispenseRequestId,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].canonicalName, 'Machines.DispenseStarted');
  assert.equal(events[0].payload.to_state, 'STARTED');
});

test('completed dispense updates state and emits completed event', async (t) => {
  const setup = await createPaidDispenseSetup(t, {
    telegramUserId: 780003,
    machineCode: 'machine_dispense_003',
    sessionKey: 'machine-flow-session-complete',
  });

  await setup.dependencies.machineRuntime.receiveDispenseCommand(
    setup.dispenseRequestId,
    {
      correlationId: 'corr_machine_dispense_start_before_complete',
      actorType: 'machine',
      actorId: setup.machineId,
    },
  );

  const completed = await setup.dependencies.machineRuntime.completeDispense(
    setup.dispenseRequestId,
    {
      correlationId: 'corr_machine_dispense_completed',
      actorType: 'machine',
      actorId: setup.machineId,
    },
  );

  assert.equal(completed.changed, true);
  assert.equal(completed.dispenseRequest.state, 'COMPLETED');
  assert.equal(completed.dispenseRequest.completedAt.toISOString(), setup.now.toISOString());

  const events = setup.dependencies.domainEventPublisher.getPublishedEvents({
    name: 'DispenseCompleted',
    aggregateId: setup.dispenseRequestId,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].canonicalName, 'Machines.DispenseCompleted');
  assert.equal(events[0].payload.to_state, 'COMPLETED');
});

test('failed dispense stores safe reason and blocks completion', async (t) => {
  const setup = await createPaidDispenseSetup(t, {
    telegramUserId: 780004,
    machineCode: 'machine_dispense_004',
    sessionKey: 'machine-flow-session-fail',
  });

  await setup.dependencies.machineRuntime.receiveDispenseCommand(
    setup.dispenseRequestId,
    {
      correlationId: 'corr_machine_dispense_start_before_fail',
      actorType: 'machine',
      actorId: setup.machineId,
    },
  );

  const failed = await setup.dependencies.machineRuntime.failDispense(
    setup.dispenseRequestId,
    'MACHINE_DISPENSING_FAILED',
    {
      correlationId: 'corr_machine_dispense_failed',
      actorType: 'machine',
      actorId: setup.machineId,
    },
  );

  assert.equal(failed.changed, true);
  assert.equal(failed.dispenseRequest.state, 'FAILED');
  assert.equal(failed.dispenseRequest.failureReason, 'MACHINE_DISPENSING_FAILED');
  assert.equal(failed.dispenseRequest.failedAt.toISOString(), setup.now.toISOString());

  await assert.rejects(
    () =>
      setup.dependencies.machineRuntime.completeDispense(setup.dispenseRequestId, {
        correlationId: 'corr_machine_complete_failed_request',
        actorType: 'machine',
        actorId: setup.machineId,
      }),
    {
      code: 'DISPENSE_COMPLETION_NOT_ALLOWED',
    },
  );

  const events = setup.dependencies.domainEventPublisher.getPublishedEvents({
    name: 'DispenseFailed',
    aggregateId: setup.dispenseRequestId,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].canonicalName, 'Machines.DispenseFailed');
  assert.equal(events[0].payload.to_state, 'FAILED');
  assert.equal(events[0].payload.state_reason, 'MACHINE_DISPENSING_FAILED');
});

test('machine and dispense endpoints reject unauthorized access', async (t) => {
  const dependencies = createTestDependencies({ botToken: '123456:test_bot_token' });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const registerResponse = await fetch(`${baseUrl}/api/v1/machines/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      machine_code: 'machine_unauthorized',
      name: 'Unauthorized Machine',
      status: 'ONLINE',
    }),
  });
  assert.equal(registerResponse.status, 401);

  const machineResponse = await fetch(`${baseUrl}/api/v1/machines/machine_test_1`);
  assert.equal(machineResponse.status, 401);

  const dispenseResponse = await fetch(
    `${baseUrl}/api/v1/orders/order_test_1/dispense`,
  );
  assert.equal(dispenseResponse.status, 401);
});

async function createPaidDispenseSetup(t, { telegramUserId, machineCode, sessionKey }) {
  const now = new Date('2026-07-13T12:00:00.000Z');
  const botToken = '123456:test_bot_token';
  const dependencies = createTestDependencies({ botToken, now });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const { accessToken, customerId } = await createAuthenticatedCustomer({
    baseUrl,
    botToken,
    telegramUserId,
    idempotencyKey: sessionKey,
  });
  const machineId = await registerMachine({
    baseUrl,
    accessToken,
    machineCode,
    idempotencyKey: `${sessionKey}-machine`,
  });
  const orderId = await createOrder({
    baseUrl,
    accessToken,
    amount: 170,
    idempotencyKey: `${sessionKey}-order`,
  });
  const paid = await dependencies.orderRuntime.confirmPayment(orderId, {
    customerId,
    correlationId: `${sessionKey}-corr-paid`,
    causationId: 'test_payment_confirmation',
    actorType: 'system',
    actorId: 'test_payment_runtime',
    sourceChannel: 'test',
  });

  return {
    accessToken,
    baseUrl,
    customerId,
    dependencies,
    dispenseRequestId: paid.machineDispenseIntegration.dispense_request_id,
    machineId,
    now,
    orderId,
  };
}

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
      first_name: 'Machine',
      last_name: 'Customer',
      username: `machine_customer_${telegramUserId}`,
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

async function registerMachine({
  baseUrl,
  accessToken,
  machineCode,
  idempotencyKey,
}) {
  const response = await fetch(`${baseUrl}/api/v1/machines/register`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({
      machine_code: machineCode,
      name: 'MVP Test Machine',
      location: 'Test location',
      status: 'ONLINE',
    }),
  });

  assert.equal(response.status, 201);
  const payload = await response.json();

  return payload.data.id;
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
