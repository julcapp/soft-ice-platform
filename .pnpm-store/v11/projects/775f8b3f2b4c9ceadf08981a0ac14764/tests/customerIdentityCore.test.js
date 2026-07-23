const assert = require('assert/strict');
const { test } = require('node:test');

const { createApp } = require('../src/main');
const { createTelegramInitData } = require('./helpers/createTelegramInitData');
const { createTestDependencies } = require('./helpers/createTestDependencies');

test('verified phone becomes the primary customer identifier', async (t) => {
  const fixture = await createCustomerFixture(t, {
    identityProviders: [{
      provider: 'phone',
      async verify({ phone, verificationToken }) {
        assert.equal(verificationToken, 'otp-proof-001');
        return { phone, verifiedAt: new Date('2026-07-21T08:00:00.000Z'), verificationMethod: 'test_phone_otp' };
      },
    }],
  });

  const response = await fetch(`${fixture.baseUrl}/api/v1/customers/me/phone-verifications`, {
    method: 'POST', headers: fixture.headers,
    body: JSON.stringify({ phone: '8 (913) 000-00-01', verification_token: 'otp-proof-001' }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.attributes.phone, '+79130000001');
  assert.equal(payload.data.attributes.phone_verified, true);
  assert.equal(payload.data.attributes.primary_identifier, 'phone');
  assert.equal(payload.data.attributes.telegram_linked, true);
});

test('customer identities expose safe provider bindings and placeholders fail closed', async (t) => {
  const fixture = await createCustomerFixture(t);
  const response = await fetch(`${fixture.baseUrl}/api/v1/customers/me/identities`, { headers: { Authorization: fixture.headers.Authorization } });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].attributes.provider, 'telegram');
  assert.equal(Object.prototype.hasOwnProperty.call(payload.data[0].attributes, 'external_subject_hash'), false);

  await assert.rejects(
    fixture.dependencies.customerRuntime.linkVerifiedExternalIdentity('customer_test_1', 'sber_id', { token: 'placeholder' }, { sourceChannel: 'test' }),
    (error) => error.code === 'IDENTITY_PROVIDER_UNAVAILABLE' && error.statusCode === 503,
  );
  await assert.rejects(
    fixture.dependencies.customerRuntime.linkVerifiedExternalIdentity('customer_test_1', 'max', { token: 'placeholder' }, { sourceChannel: 'test' }),
    (error) => error.code === 'IDENTITY_PROVIDER_UNAVAILABLE' && error.statusCode === 503,
  );
});

test('consent decisions are stored as immutable idempotent records', async (t) => {
  const fixture = await createCustomerFixture(t);
  const decision = {
    consent_type: 'PERSONAL_DATA', is_granted: true,
    document_type: 'privacy_policy', document_version: '1.0',
    document_title: 'Privacy Policy', decision_id: 'decision-test-001', source_channel: 'MINI_APP',
  };
  const first = await fetch(`${fixture.baseUrl}/api/v1/customers/me/consent-decisions`, {
    method: 'POST', headers: fixture.headers, body: JSON.stringify(decision),
  });
  const duplicate = await fetch(`${fixture.baseUrl}/api/v1/customers/me/consent-decisions`, {
    method: 'POST', headers: fixture.headers, body: JSON.stringify(decision),
  });
  assert.equal(first.status, 201);
  assert.equal(duplicate.status, 200);
  const list = await fetch(`${fixture.baseUrl}/api/v1/customers/me/consent-decisions`, { headers: { Authorization: fixture.headers.Authorization } });
  const payload = await list.json();
  assert.equal(payload.data.length, 1);
  assert.equal(payload.data[0].attributes.document_version, '1.0');
  assert.equal(payload.data[0].attributes.is_granted, true);
});

test('customer identity endpoints require authentication and phone verifier configuration', async (t) => {
  const fixture = await createCustomerFixture(t);
  const unauthorized = await fetch(`${fixture.baseUrl}/api/v1/customers/me/identities`);
  assert.equal(unauthorized.status, 401);

  const unavailable = await fetch(`${fixture.baseUrl}/api/v1/customers/me/phone-verifications`, {
    method: 'POST', headers: fixture.headers,
    body: JSON.stringify({ phone: '+79130000001', verification_token: 'proof' }),
  });
  assert.equal(unavailable.status, 503);
  const payload = await unavailable.json();
  assert.equal(payload.error.code, 'IDENTITY_PROVIDER_UNAVAILABLE');
});

async function createCustomerFixture(t, { identityProviders = [] } = {}) {
  const botToken = '123456:test_bot_token';
  const dependencies = createTestDependencies({ botToken, identityProviders });
  const server = await listen(createApp({ dependencies }));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const telegramInitData = createTelegramInitData({
    botToken, user: { id: 880001, first_name: 'Identity', username: 'identity_test' },
    authDate: Math.floor(Date.now() / 1000),
  });
  const auth = await fetch(`${baseUrl}/api/v1/auth/telegram-mini-app/sessions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_init_data: telegramInitData, source_channel: 'telegram_mini_app' }),
  });
  assert.equal(auth.status, 201);
  const authPayload = await auth.json();
  return {
    baseUrl, dependencies,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authPayload.data.attributes.access_token}` },
  };
}

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
  });
}
