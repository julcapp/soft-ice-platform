const assert = require('assert/strict');
const { test } = require('node:test');

const { createApp } = require('../src/main');
const { CONSENT_SOURCE_CHANNELS, CONSENT_TYPES } = require('../src/modules/consent/ConsentEntity');
const { createTelegramInitData } = require('./helpers/createTelegramInitData');
const { createTestDependencies } = require('./helpers/createTestDependencies');

test('Consent Privacy Core exposes the approved legal vocabularies', () => {
  assert.deepEqual(CONSENT_TYPES, ['PERSONAL_DATA', 'MARKETING', 'ADVERTISING', 'PARTNER_OFFERS', 'PHOTO_USAGE']);
  assert.deepEqual(CONSENT_SOURCE_CHANNELS, ['TELEGRAM', 'MINI_APP', 'MACHINE', 'WEBSITE']);
});

test('customer can append and read timestamped consent history', async (t) => {
  const fixture = await createFixture(t);
  for (const [index, consentType] of CONSENT_TYPES.entries()) {
    const response = await fetch(`${fixture.baseUrl}/api/v1/customers/me/consents`, {
      method: 'POST', headers: fixture.headers,
      body: JSON.stringify({
        consent_type: consentType,
        is_granted: consentType !== 'ADVERTISING',
        source_channel: CONSENT_SOURCE_CHANNELS[index % CONSENT_SOURCE_CHANNELS.length],
        decision_id: `consent-decision-${index}`,
        document_type: 'privacy_notice',
        document_version: '1.0',
      }),
    });
    assert.equal(response.status, 201);
  }

  const response = await fetch(`${fixture.baseUrl}/api/v1/customers/me/consents`, { headers: fixture.authHeader });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.data.length, 5);
  assert.equal(payload.data[0].attributes.consented_at, '2026-07-13T12:00:00.000Z');
  assert.equal(payload.data.find(({ attributes }) => attributes.consent_type === 'ADVERTISING').attributes.is_granted, false);
});

test('consent validation rejects unknown types and channels', async (t) => {
  const fixture = await createFixture(t);
  const unauthorized = await fetch(`${fixture.baseUrl}/api/v1/customers/me/consents`);
  assert.equal(unauthorized.status, 401);
  const response = await fetch(`${fixture.baseUrl}/api/v1/customers/me/consents`, {
    method: 'POST', headers: fixture.headers,
    body: JSON.stringify({ consent_type: 'TRACKING', is_granted: true, source_channel: 'CRM' }),
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'VALIDATION_FAILED');
});

test('consent decision IDs are idempotent and cannot be reused with different facts', async (t) => {
  const fixture = await createFixture(t);
  const decision = { consent_type: 'MARKETING', is_granted: true, source_channel: 'TELEGRAM', decision_id: 'stable-1' };
  const first = await post(fixture, decision);
  const duplicate = await post(fixture, decision);
  const conflict = await post(fixture, { ...decision, is_granted: false });
  assert.equal(first.status, 201);
  assert.equal(duplicate.status, 200);
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).error.code, 'CONSENT_DECISION_CONFLICT');
});

async function createFixture(t) {
  const botToken = '123456:test_bot_token';
  const dependencies = createTestDependencies({ botToken });
  const server = await new Promise((resolve) => {
    const active = createApp({ dependencies }).listen(0, '127.0.0.1', () => resolve(active));
  });
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const initData = createTelegramInitData({
    botToken, user: { id: 990001, first_name: 'Consent' }, authDate: Math.floor(Date.now() / 1000),
  });
  const auth = await fetch(`${baseUrl}/api/v1/auth/telegram-mini-app/sessions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_init_data: initData, source_channel: 'telegram_mini_app' }),
  });
  const token = (await auth.json()).data.attributes.access_token;
  return {
    baseUrl,
    authHeader: { Authorization: `Bearer ${token}` },
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  };
}

function post(fixture, body) {
  return fetch(`${fixture.baseUrl}/api/v1/customers/me/consents`, {
    method: 'POST', headers: fixture.headers, body: JSON.stringify(body),
  });
}
