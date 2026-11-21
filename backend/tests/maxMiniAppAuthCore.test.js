const test = require('node:test');
const assert = require('node:assert/strict');

const { AuthCoreService } = require('../src/platform/security/AuthCoreService');

test('MAX Mini App session authenticates only an already linked customer', async () => {
  const calls = [];
  const audits = [];
  const now = new Date('2026-11-02T10:00:00.000Z');
  const service = new AuthCoreService({
    authSessionRepository: {
      createCustomerSession: async (input) => {
        calls.push(input);
        return { id: 'session-1', ...input, createdAt: now };
      },
    },
    customerRuntime: {
      resolveExistingMaxCustomer: async (identity, context) => {
        assert.equal(identity.subjectHash, 'max-subject-hash');
        assert.equal(context.sourceChannel, 'max_mini_app');
        return { customer: { id: 'customer-1', status: 'active' }, created: false };
      },
    },
    clubAccountRuntime: {
      ensureAccountForCustomer: async () => ({ clubAccount: { id: 'club-1' } }),
    },
    auditRepository: { record: async (event) => audits.push(event) },
    idempotencyService: null,
    maxVerifier: () => ({
      subjectHash: 'max-subject-hash',
      authDate: 1793613600,
      user: { id: '388292358', firstName: 'Александр', username: 'alex' },
    }),
    tokenFactory: () => 'access-token-1',
    clock: () => now,
    accessTokenTtlSeconds: 900,
  });

  const result = await service.createMaxMiniAppSession(
    { max_init_data: 'signed-data', source_channel: 'max_mini_app' },
    { correlationId: 'corr-1', idempotencyKey: null },
  );

  assert.equal(result.customer.id, 'customer-1');
  assert.equal(result.accessToken, 'access-token-1');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].authMethod, 'max_init_data');
  assert.equal(calls[0].consumerType, 'max_mini_app');
  assert.equal(audits[0].reasonCode, 'max_mini_app_session_created');
});

test('MAX Mini App session propagates MAX_IDENTITY_NOT_LINKED without creating customer', async () => {
  let createdSession = false;
  const service = new AuthCoreService({
    authSessionRepository: {
      createCustomerSession: async () => { createdSession = true; throw new Error('must not create'); },
    },
    customerRuntime: {
      resolveExistingMaxCustomer: async () => {
        const error = new Error('MAX account is not linked.');
        error.code = 'MAX_IDENTITY_NOT_LINKED';
        error.statusCode = 403;
        throw error;
      },
    },
    clubAccountRuntime: { ensureAccountForCustomer: async () => ({ clubAccount: null }) },
    auditRepository: { record: async () => {} },
    idempotencyService: null,
    maxVerifier: () => ({ subjectHash: 'max-subject-hash', authDate: 1793613600, user: { id: '388292358' } }),
    tokenFactory: () => 'never',
  });

  await assert.rejects(
    () => service.createMaxMiniAppSession(
      { max_init_data: 'signed-data', source_channel: 'max_mini_app' },
      { correlationId: 'corr-2', idempotencyKey: null },
    ),
    (error) => error.code === 'MAX_IDENTITY_NOT_LINKED',
  );
  assert.equal(createdSession, false);
});
