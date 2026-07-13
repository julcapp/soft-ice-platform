const assert = require('assert/strict');
const { test } = require('node:test');

const { createApp } = require('../src/main');
const { createTelegramInitData } = require('./helpers/createTelegramInitData');
const { createTestDependencies } = require('./helpers/createTestDependencies');

test('Telegram Mini App session creates customer and Club Account', async (t) => {
  const botToken = '123456:test_bot_token';
  const dependencies = createTestDependencies({ botToken });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const telegramInitData = createTelegramInitData({
    botToken,
    user: {
      id: 777001,
      first_name: 'Alex',
      last_name: 'Ilyin',
      username: 'utimoshi',
      language_code: 'ru',
    },
    authDate: Math.floor(Date.now() / 1000),
  });

  const authResponse = await fetch(`${baseUrl}/api/v1/auth/telegram-mini-app/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'test-telegram-session-001',
      'X-Correlation-ID': 'corr_test_registration_flow',
    },
    body: JSON.stringify({
      telegram_init_data: telegramInitData,
      source_channel: 'telegram_mini_app',
      client_request_id: 'client_request_001',
    }),
  });

  assert.equal(authResponse.status, 201);
  const authPayload = await authResponse.json();
  assert.equal(authPayload.data.type, 'auth_session');
  assert.equal(authPayload.data.attributes.identity_type, 'customer');
  assert.equal(authPayload.data.attributes.token_type, 'Bearer');
  assert.match(authPayload.data.attributes.customer_id, /^customer_test_/);
  assert.match(authPayload.data.attributes.access_token, /^test_access_token_/);

  const accessToken = authPayload.data.attributes.access_token;

  const customerResponse = await fetch(`${baseUrl}/api/v1/customers/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  assert.equal(customerResponse.status, 200);
  const customerPayload = await customerResponse.json();
  assert.equal(customerPayload.data.attributes.customer_id, 'customer_test_1');
  assert.equal(customerPayload.data.attributes.display_name, 'Alex Ilyin');
  assert.equal(customerPayload.data.attributes.status, 'active');
  assert.equal(customerPayload.data.attributes.telegram_linked, true);
  assert.equal(customerPayload.data.attributes.club_membership_status, 'active');

  const clubResponse = await fetch(`${baseUrl}/api/v1/club-accounts/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  assert.equal(clubResponse.status, 200);
  const clubPayload = await clubResponse.json();
  assert.equal(clubPayload.data.attributes.customer_id, 'customer_test_1');
  assert.equal(clubPayload.data.attributes.status, 'active');
  assert.equal(clubPayload.data.attributes.currency, 'RUB');
  assert.equal(clubPayload.data.attributes.available_balance, 0);
  assert.equal(clubPayload.data.attributes.reserved_balance, 0);
  assert.equal(clubPayload.data.attributes.low_balance_state, 'below_minimum');
});

test('Compatibility endpoints create Telegram session and return current customer', async (t) => {
  const botToken = '123456:test_bot_token';
  const dependencies = createTestDependencies({ botToken });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const telegramInitData = createTelegramInitData({
    botToken,
    user: {
      id: 777101,
      first_name: 'Compat',
      last_name: 'Customer',
      username: 'compat_customer',
    },
    authDate: Math.floor(Date.now() / 1000),
  });

  const authResponse = await fetch(`${baseUrl}/api/auth/telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'test-telegram-compat-session-001',
    },
    body: JSON.stringify({
      initData: telegramInitData,
      clientRequestId: 'client_request_compat_001',
    }),
  });

  assert.equal(authResponse.status, 201);
  const authPayload = await authResponse.json();
  assert.equal(authPayload.data.type, 'auth_session');
  assert.equal(authPayload.data.attributes.customer_id, 'customer_test_1');
  assert.match(authPayload.data.attributes.access_token, /^test_access_token_/);

  const customerResponse = await fetch(`${baseUrl}/api/customer/me`, {
    headers: {
      Authorization: `Bearer ${authPayload.data.attributes.access_token}`,
    },
  });

  assert.equal(customerResponse.status, 200);
  const customerPayload = await customerResponse.json();
  assert.equal(customerPayload.data.type, 'customer_profile');
  assert.equal(customerPayload.data.attributes.customer_id, 'customer_test_1');
  assert.equal(customerPayload.data.attributes.display_name, 'Compat Customer');
  assert.equal(customerPayload.data.attributes.telegram_linked, true);
});

test('Telegram Mini App bootstrap returns safe customer startup projection', async (t) => {
  const botToken = '123456:test_bot_token';
  const dependencies = createTestDependencies({ botToken });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const telegramInitData = createTelegramInitData({
    botToken,
    user: {
      id: 777002,
      first_name: 'Tim',
      username: 'tim_test',
    },
    authDate: Math.floor(Date.now() / 1000),
  });

  const authResponse = await fetch(`${baseUrl}/api/v1/auth/telegram-mini-app/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      telegram_init_data: telegramInitData,
      source_channel: 'telegram_mini_app',
    }),
  });
  const authPayload = await authResponse.json();
  const accessToken = authPayload.data.attributes.access_token;

  const bootstrapResponse = await fetch(
    `${baseUrl}/api/v1/telegram/mini-app/bootstrap`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  assert.equal(bootstrapResponse.status, 200);
  const bootstrapPayload = await bootstrapResponse.json();
  assert.equal(bootstrapPayload.data.type, 'telegram_mini_app_bootstrap');
  assert.equal(bootstrapPayload.data.attributes.customer.customer_id, 'customer_test_1');
  assert.equal(bootstrapPayload.data.attributes.club_account.customer_id, 'customer_test_1');
  assert.equal(bootstrapPayload.data.attributes.feature_flags.payments_enabled, false);
  assert.equal(bootstrapPayload.data.attributes.feature_flags.machine_dispatch_enabled, false);
  assert.equal(bootstrapPayload.data.attributes.customer.telegram_linked, true);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      bootstrapPayload.data.attributes.customer,
      'telegram_init_data',
    ),
    false,
  );
});

test('Telegram Mini App session rejects invalid init data', async (t) => {
  const botToken = '123456:test_bot_token';
  const dependencies = createTestDependencies({ botToken });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/v1/auth/telegram-mini-app/sessions`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        telegram_init_data: 'auth_date=1&hash=bad',
        source_channel: 'telegram_mini_app',
      }),
    },
  );

  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.equal(payload.error.code, 'AUTHENTICATION_INVALID');
});

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}
