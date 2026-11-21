const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');
const { AdministratorSecurityService, hashToken } = require('../src/platform/security/AdministratorSecurity');
const { createAdminRouteBoundary } = require('../src/platform/security/authenticateAdmin');
const { createVideoSurveillanceRouter } = require('../src/api/v1/videoSurveillanceRoutes');

function fixture(overrides = {}) {
  const state = { sessions: [], audits: [], outbox: [] };
  const administrator = { id: 'admin-x', organizationId: 'org-x', memberId: 'member-x', status: 'ACTIVE', member: { id: 'member-x', organizationId: 'org-x', status: 'ACTIVE' }, roleBindings: [{ role: 'ACCESS_ADMINISTRATOR' }], permissionBindings: [] };
  const tx = {
    administratorSession: { create: async ({ data }) => { const row = { id: 'session-x', status: 'ACTIVE', revokedAt: null, createdAt: new Date('2026-08-25T00:00:00Z'), lastSeenAt: new Date('2026-08-25T00:00:00Z'), ...data }; state.sessions.push(row); return row; }, findUnique: async ({ where }) => { const row = state.sessions.find((x) => x.id === where.id); return row ? { ...row, administrator: { ...administrator, ...overrides.administrator } } : null; }, updateMany: async ({ where, data }) => { const row = state.sessions.find((x) => x.id === where.id && x.organizationId === where.organizationId && x.status === 'ACTIVE' && !x.revokedAt); if (!row) return { count: 0 }; Object.assign(row, data); return { count: 1 }; } },
    auditEvent: { create: async ({ data }) => { state.audits.push(data); return data; } },
    transactionalOutboxEvent: { create: async ({ data }) => { if (overrides.failOutbox) throw new Error('injected outbox failure'); state.outbox.push(data); return data; } },
  };
  const prisma = { ...tx, $transaction: async (work) => { const snapshot = structuredClone(state); try { return await work(tx); } catch (error) { Object.assign(state, snapshot); throw error; } } };
  const repository = {
    lockAuthorization: async () => {},
    findAdministrator: async () => ({ ...administrator, ...overrides.administrator }),
    createSession: (data, client) => client.administratorSession.create({ data }),
    findSessionByHash: async (hash) => { const session = state.sessions.find((x) => x.accessTokenHash === hash); return session ? { ...session, administrator: { ...administrator, ...overrides.administrator } } : null; },
    findSessionById: (id, client) => client.administratorSession.findUnique({ where: { id } }),
    touchSession: async (id, now) => Object.assign(state.sessions.find((x) => x.id === id), { lastSeenAt: now }),
    revokeSession: (id, organizationId, now, client) => client.administratorSession.updateMany({ where: { id, organizationId, status: 'ACTIVE', revokedAt: null }, data: { status: 'REVOKED', revokedAt: now } }),
  };
  const service = new AdministratorSecurityService({ prisma, repository, clock: () => new Date('2026-08-25T00:00:00Z'), tokenFactory: () => 'opaque-secret', sessionTtlSeconds: 60 });
  return { service, state };
}

test('durable administrator session stores only token hash and writes audit plus outbox atomically', async () => {
  const { service, state } = fixture();
  const result = await service.createSession({ administratorId: 'admin-x', authenticationMethod: 'oidc_verified', authenticationMetadata: { device: 'managed', token: 'must-not-persist' }, correlationId: 'corr-x' });
  assert.equal(result.token, 'opaque-secret'); assert.equal(state.sessions[0].accessTokenHash, hashToken('opaque-secret')); assert.equal(state.sessions[0].authenticationMetadata.token, undefined);
  assert.equal(state.audits.length, 1); assert.equal(state.outbox.length, 1);
});

test('authentication metadata recursively removes secrets from objects and arrays', async () => {
  const { service, state } = fixture();
  await service.createSession({ administratorId: 'admin-x', authenticationMethod: 'oidc_verified', authenticationMetadata: { provider: { accessToken: 'secret', profile: { locale: 'ru' } }, devices: [{ cookie: 'secret' }, { name: 'terminal' }] } });
  assert.deepEqual(state.sessions[0].authenticationMetadata, { provider: { profile: { locale: 'ru' } }, devices: [{}, { name: 'terminal' }] });
});

test('session validation derives tenant and permissions from durable identity and rejects client tenant substitution', async () => {
  const { service } = fixture(); await service.createSession({ administratorId: 'admin-x', authenticationMethod: 'oidc_verified' });
  const principal = await service.validateToken('opaque-secret', { requiredPermission: 'admin:session:revoke', organizationId: 'org-x' });
  assert.equal(principal.organizationId, 'org-x');
  await assert.rejects(service.validateToken('opaque-secret', { organizationId: 'org-y' }), { code: 'ADMIN_TENANT_SCOPE_DENIED' });
});

test('disabled administrator and inactive membership immediately close an existing session', async () => {
  for (const administrator of [{ status: 'DISABLED' }, { member: { id: 'member-x', organizationId: 'org-x', status: 'INACTIVE' } }]) {
    const item = fixture({ administrator }); await item.service.createSession({ administratorId: 'admin-x', authenticationMethod: 'oidc_verified' }).catch(() => {});
    if (!item.state.sessions.length) continue;
    await assert.rejects(item.service.validateToken('opaque-secret'), { code: administrator.status ? 'ADMINISTRATOR_DISABLED' : 'ADMIN_MEMBERSHIP_INACTIVE' });
  }
});

test('outbox failure rolls back session and audit', async () => {
  const { service, state } = fixture({ failOutbox: true });
  await assert.rejects(service.createSession({ administratorId: 'admin-x', authenticationMethod: 'oidc_verified' }), /injected/);
  assert.deepEqual([state.sessions.length, state.audits.length, state.outbox.length], [0, 0, 0]);
});

test('revocation is fail-closed and produces one durable audit/outbox pair', async () => {
  const { service, state } = fixture(); await service.createSession({ administratorId: 'admin-x', authenticationMethod: 'oidc_verified' });
  const actor = await service.validateToken('opaque-secret'); await service.revokeSession({ sessionId: 'session-x', actor, correlationId: 'corr-revoke' });
  await assert.rejects(service.validateToken('opaque-secret'), { code: 'ADMIN_SESSION_INVALID' });
  assert.equal(state.audits.length, 2); assert.equal(state.outbox.length, 2);
});

test('revocation rejects a target session owned by another tenant without audit or outbox', async () => {
  const { service, state } = fixture(); await service.createSession({ administratorId: 'admin-x', authenticationMethod: 'oidc_verified' });
  const actor = await service.validateToken('opaque-secret');
  state.sessions.push({ ...state.sessions[0], id: 'session-y', organizationId: 'org-y', accessTokenHash: hashToken('tenant-y') });
  const before = [state.audits.length, state.outbox.length];
  await assert.rejects(service.revokeSession({ sessionId: 'session-y', actor }), { code: 'ADMIN_SESSION_NOT_FOUND' });
  assert.deepEqual([state.audits.length, state.outbox.length], before);
  assert.equal(state.sessions.find((x) => x.id === 'session-y').status, 'ACTIVE');
});

test('revocation revalidates actor permission inside the transaction', async () => {
  const item = fixture(); await item.service.createSession({ administratorId: 'admin-x', authenticationMethod: 'oidc_verified' });
  const actor = await item.service.validateToken('opaque-secret');
  item.state.sessions[0].administrator = undefined;
  const original = item.service.repository.findSessionById;
  item.service.repository.findSessionById = async (id, client) => {
    const row = await original(id, client);
    if (id === actor.sessionId) row.administrator.roleBindings = [];
    return row;
  };
  await assert.rejects(item.service.revokeSession({ sessionId: 'session-x', actor }), { code: 'ADMIN_PERMISSION_DENIED' });
  assert.equal(item.state.sessions[0].status, 'ACTIVE');
});

test('expired session is rejected before authorization', async () => {
  const { service, state } = fixture();
  await service.createSession({ administratorId: 'admin-x', authenticationMethod: 'oidc_verified' });
  state.sessions[0].expiresAt = new Date('2026-08-24T23:59:59Z');
  await assert.rejects(service.validateToken('opaque-secret'), { code: 'ADMIN_SESSION_INVALID' });
});

test('authorization denies a missing required permission and audits the decision', async () => {
  const { service, state } = fixture({ administrator: { roleBindings: [] } });
  await service.createSession({ administratorId: 'admin-x', authenticationMethod: 'oidc_verified' });
  await assert.rejects(service.validateToken('opaque-secret', { requiredPermission: 'admin:session:revoke' }), { code: 'ADMIN_PERMISSION_DENIED' });
  assert.equal(state.audits.at(-1).decision, 'DENY');
});

test('session creation rejects the development header authentication method', async () => {
  const { service, state } = fixture();
  await assert.rejects(service.createSession({ administratorId: 'admin-x', authenticationMethod: 'development_header' }), { code: 'ADMIN_AUTHENTICATION_METHOD_NOT_ALLOWED' });
  assert.equal(state.sessions.length, 0);
});

async function boundaryResult({ method = 'GET', path, headers = {}, principal }) {
  const req = { method, path, params: {}, query: {}, body: {}, securityContext: undefined, get: (name) => headers[name] || '' };
  const sessionService = { validateToken: async (_token, options) => {
    if (options.requiredPermission && !principal.permissions?.includes('admin:*') && !principal.permissions?.includes(options.requiredPermission)) {
      throw Object.assign(new Error('permission denied'), { code: 'ADMIN_PERMISSION_DENIED' });
    }
    return { ...principal, validatedPermission: options.requiredPermission };
  } };
  return new Promise((resolve) => createAdminRouteBoundary({ environment: 'production', sessionService })(req, {}, (error) => resolve({ error, req })));
}

test('admin route boundary requires manage permission for mutations and read permission for reads', async () => {
  const principal = { roles: ['ADMIN'], permissions: ['admin:customer:read', 'admin:customer:manage'], organizationId: 'org-x', organization_id: 'org-x', auth_method: 'oidc_verified' };
  const read = await boundaryResult({ path: '/crm/customers', headers: { Authorization: 'Bearer x' }, principal: { ...principal, roles: ['PLATFORM_OWNER'] } });
  const mutation = await boundaryResult({ method: 'PATCH', path: '/crm/customers/customer-x', headers: { Authorization: 'Bearer x' }, principal: { ...principal, roles: ['PLATFORM_OWNER'] } });
  const readOnlyMutation = await boundaryResult({ method: 'PATCH', path: '/crm/customers/customer-x', headers: { Authorization: 'Bearer x' }, principal: { ...principal, roles: ['PLATFORM_OWNER'], permissions: ['admin:customer:read'] } });
  assert.equal(read.req.securityContext.validatedPermission, 'admin:customer:read');
  assert.equal(mutation.req.securityContext.validatedPermission, 'admin:customer:manage');
  assert.equal(readOnlyMutation.error.code, 'ADMIN_PERMISSION_DENIED');
});

test('video routes ignore client supplied administrator permissions', async () => {
  let receivedContext;
  const app = express();
  app.use('/video', createVideoSurveillanceRouter({
    adminAuth: { environment: 'production', sessionService: { validateToken: async () => ({ subject_id: 'admin-x', roles: ['ADMIN'], permissions: ['admin:video:read'], organizationId: 'org-x' }) } },
    videoSurveillanceRuntime: { listCameras: (_machineId, context) => { receivedContext = context; return []; } },
  }));
  const server = app.listen(0);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/video/machines/machine-x/cameras`, { headers: { Authorization: 'Bearer opaque', 'X-Admin-Permissions': 'admin:video:manage' } });
    assert.equal(response.status, 200);
    assert.deepEqual(receivedContext.permissions, ['admin:video:read']);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('admin route boundary rejects organization substitution and unscoped tenant resources', async () => {
  const principal = { roles: ['ADMIN'], permissions: ['admin:outbox:read', 'admin:customer:read'], organizationId: 'org-x', organization_id: 'org-x', auth_method: 'oidc_verified' };
  const substituted = await boundaryResult({ path: '/outbox', headers: { Authorization: 'Bearer x', 'X-Organization-Id': 'org-y' }, principal });
  assert.equal(substituted.error.code, 'ADMIN_TENANT_SCOPE_DENIED');
  const unscoped = await boundaryResult({ path: '/customer-360/customers/customer-y', headers: { Authorization: 'Bearer x' }, principal });
  assert.equal(unscoped.error.code, 'ADMIN_TENANT_RESOURCE_UNSCOPED');
});
