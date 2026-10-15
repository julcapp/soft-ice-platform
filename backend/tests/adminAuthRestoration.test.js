const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/main');
const { AdminAuthService, hashPassword, verifyPassword } = require('../src/platform/security/AdminAuthService');

test('password verification rejects incorrect and malformed hashes', async () => {
  const hash = await hashPassword('test-password-42');
  assert.equal(await verifyPassword('test-password-42', hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
  assert.equal(await verifyPassword('test-password-42', 'invalid'), false);
});

test('sessions load current roles and reject revoked or disabled accounts', async () => {
  let rows = [{ id: 'session', adminUserId: 'admin', roles: ['SERVICE_SPECIALIST'], userStatus: 'ACTIVE', organizationMemberId: 'member' }];
  const service = new AdminAuthService({ prisma: {
    $queryRawUnsafe: async () => rows,
    $executeRawUnsafe: async () => 1,
  }});
  assert.equal((await service.authenticate('token')).organization_member_id, 'member');
  rows[0].roles = [];
  assert.deepEqual((await service.authenticate('token')).roles, []);
  rows[0].userStatus = 'DISABLED';
  await assert.rejects(service.authenticate('token'), { code: 'ADMIN_AUTHENTICATION_REQUIRED' });
  rows = [];
  await assert.rejects(service.authenticate('token'), { code: 'ADMIN_AUTHENTICATION_REQUIRED' });
});

test('restored login and me routes use bearer authentication', async () => {
  const context = { subject_type: 'administrator', subject_id: 'admin', roles: ['PLATFORM_OWNER'] };
  const service = {
    login: async ({ login }) => ({ token: 'valid-token', user: { login } }),
    authenticate: async (token) => {
      if (token !== 'valid-token') {
        const { ApiError } = require('../src/platform/errors/ApiError');
        throw new ApiError({ statusCode: 401, code: 'ADMIN_AUTHENTICATION_REQUIRED', message: 'Требуется вход.' });
      }
      return context;
    },
  };
  const server = createApp({ dependencies: {}, adminAuthService: service }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1/admin/auth`;
  try {
    const login = await fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ login: 'julcapp', password: 'fixture' }) });
    assert.equal(login.status, 200);
    assert.equal((await login.json()).data.token, 'valid-token');
    assert.equal((await fetch(`${base}/me`, { headers: { 'X-Admin-Role': 'PLATFORM_OWNER' } })).status, 401);
    const me = await fetch(`${base}/me`, { headers: { Authorization: 'Bearer valid-token' } });
    assert.equal(me.status, 200);
    assert.deepEqual((await me.json()).data.roles, ['PLATFORM_OWNER']);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
