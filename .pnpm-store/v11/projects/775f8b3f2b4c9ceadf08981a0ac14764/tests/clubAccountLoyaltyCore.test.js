const assert = require('assert/strict');
const { test } = require('node:test');

const { createApp } = require('../src/main');
const { createTelegramInitData } = require('./helpers/createTelegramInitData');
const { createTestDependencies } = require('./helpers/createTestDependencies');

test('Club Account top-up credits immutable loyalty ledger and recalculates balance', async (t) => {
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
  });

  const initialAccountResponse = await fetch(`${baseUrl}/api/v1/club-account/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(initialAccountResponse.status, 200);
  const initialAccountPayload = await initialAccountResponse.json();
  assert.equal(initialAccountPayload.data.attributes.customer_id, customerId);
  assert.equal(initialAccountPayload.data.attributes.status, 'active');
  assert.equal(initialAccountPayload.data.attributes.available_balance, 0);
  assert.equal(initialAccountPayload.data.attributes.projection_version, 0);

  const topUpResponse = await fetch(`${baseUrl}/api/v1/club-account/top-up`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': 'club-top-up-test-001',
    },
    body: JSON.stringify({
      amount: 150,
      currency: 'RUB',
      reason: 'initial_club_deposit',
      reference_entity: {
        type: 'test_case',
        id: 'club_account_loyalty_core_credit',
      },
    }),
  });

  assert.equal(topUpResponse.status, 201);
  const topUpPayload = await topUpResponse.json();
  assert.equal(topUpPayload.data.type, 'club_account_top_up');
  assert.equal(topUpPayload.data.attributes.status, 'credited');
  assert.equal(topUpPayload.data.attributes.amount, 150);
  assert.equal(topUpPayload.data.attributes.balance_after, 150);
  assert.equal(topUpPayload.data.attributes.transaction.direction, 'credit');
  assert.equal(topUpPayload.data.attributes.transaction.reason, 'initial_club_deposit');
  assert.equal(
    topUpPayload.data.attributes.transaction.reference_entity.type,
    'test_case',
  );

  const accountResponse = await fetch(`${baseUrl}/api/v1/club-account/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(accountResponse.status, 200);
  const accountPayload = await accountResponse.json();
  assert.equal(accountPayload.data.attributes.available_balance, 150);
  assert.equal(accountPayload.data.attributes.reserved_balance, 0);
  assert.equal(accountPayload.data.attributes.total_balance, 150);
  assert.equal(accountPayload.data.attributes.low_balance_state, 'ok');
  assert.equal(accountPayload.data.attributes.projection_version, 1);
  assert.equal(
    accountPayload.data.attributes.last_transaction_id,
    topUpPayload.data.attributes.transaction.club_account_transaction_id,
  );

  const calculatedAfterCredit = await dependencies.clubAccountRuntime.calculateOwnBalance(
    customerId,
  );
  assert.deepEqual(calculatedAfterCredit, {
    available_balance: 150,
    reserved_balance: 0,
    total_balance: 150,
  });

  const debitResult = await dependencies.clubAccountRuntime.debitOwnAccount(
    customerId,
    {
      amount: 40,
      currency: 'RUB',
      reason: 'test_ledger_debit',
      referenceEntityType: 'test_case',
      referenceEntityId: 'club_account_loyalty_core_debit',
    },
    {
      actorType: 'system',
      actorId: 'test_runner',
      correlationId: 'corr_test_ledger_debit',
      idempotencyKey: 'club-debit-test-001',
    },
  );

  assert.equal(debitResult.transaction.direction, 'debit');
  assert.equal(debitResult.transaction.amountRub, 40);
  assert.equal(debitResult.transaction.balanceAfterRub, 110);

  const calculatedAfterDebit = await dependencies.clubAccountRuntime.calculateOwnBalance(
    customerId,
  );
  assert.deepEqual(calculatedAfterDebit, {
    available_balance: 110,
    reserved_balance: 0,
    total_balance: 110,
  });

  const historyResponse = await fetch(`${baseUrl}/api/v1/club-account/history`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  assert.equal(historyResponse.status, 200);
  const historyPayload = await historyResponse.json();
  assert.equal(historyPayload.data.length, 2);
  assert.deepEqual(
    historyPayload.data.map((entry) => entry.attributes.direction).sort(),
    ['credit', 'debit'],
  );
  assert.deepEqual(
    historyPayload.data.map((entry) => entry.attributes.reason).sort(),
    ['initial_club_deposit', 'test_ledger_debit'],
  );
});

test('Club Account endpoints reject unauthorized access', async (t) => {
  const dependencies = createTestDependencies({ botToken: '123456:test_bot_token' });
  const app = createApp({ dependencies });
  const server = await listen(app);

  t.after(() => {
    server.close();
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const accountResponse = await fetch(`${baseUrl}/api/v1/club-account/me`);
  assert.equal(accountResponse.status, 401);

  const historyResponse = await fetch(`${baseUrl}/api/v1/club-account/history`);
  assert.equal(historyResponse.status, 401);

  const topUpResponse = await fetch(`${baseUrl}/api/v1/club-account/top-up`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: 100,
      currency: 'RUB',
    }),
  });
  assert.equal(topUpResponse.status, 401);
});

async function createAuthenticatedCustomer({ baseUrl, botToken }) {
  const telegramInitData = createTelegramInitData({
    botToken,
    user: {
      id: 778001,
      first_name: 'Club',
      last_name: 'Member',
      username: 'club_member',
      language_code: 'ru',
    },
    authDate: Math.floor(Date.now() / 1000),
  });

  const authResponse = await fetch(`${baseUrl}/api/v1/auth/telegram-mini-app/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': 'club-account-loyalty-core-session',
    },
    body: JSON.stringify({
      telegram_init_data: telegramInitData,
      source_channel: 'telegram_mini_app',
      client_request_id: 'club_account_loyalty_core_session',
    }),
  });

  assert.equal(authResponse.status, 201);
  const authPayload = await authResponse.json();

  return {
    accessToken: authPayload.data.attributes.access_token,
    customerId: authPayload.data.attributes.customer_id,
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}
