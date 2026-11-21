const crypto = require('crypto');
const { ApiError } = require('../errors/ApiError');

const ROLE_PERMISSIONS = Object.freeze({
  PLATFORM_OWNER: ['admin:*'],
  ADMIN: ['admin:dashboard:read', 'admin:organization:read', 'admin:organization:manage', 'admin:inventory:read', 'admin:inventory:manage', 'admin:machine:read', 'admin:machine:manage', 'admin:maintenance:read', 'admin:maintenance:manage', 'admin:customer:read', 'admin:customer:manage', 'admin:event:read', 'admin:event:manage', 'admin:payment:read', 'admin:payment:manage', 'admin:outbox:read', 'admin:outbox:manage', 'admin:video:read', 'admin:video:manage', 'admin:gift:read', 'admin:gift:manage'],
  ACCESS_ADMINISTRATOR: ['admin:access:read', 'admin:access:manage', 'admin:session:revoke'],
  AUDITOR: ['admin:audit:read'],
  FINANCE_RECONCILIATION: ['admin:payment:read', 'admin:outbox:read'],
});

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const fail = (statusCode, code, message) => new ApiError({ statusCode, code, message, source: 'security' });

class AdministratorSecurityRepository {
  constructor(prisma) { this.prisma = prisma; }
  async lockAuthorization(tx) {
    // Includes absent permission rows: row locks alone cannot fence a new DENY.
    // A fixed table order also serializes concurrent revokes without lock upgrades.
    await tx.$executeRaw`LOCK TABLE "Administrator", "AdministratorPermissionBinding", "AdministratorRoleBinding", "AdministratorSession", "OrganizationMember" IN SHARE ROW EXCLUSIVE MODE`;
  }
  findAdministrator(id) { return this.prisma.administrator.findUnique({ where: { id }, include: { member: true, roleBindings: { where: { revokedAt: null } }, permissionBindings: { where: { revokedAt: null } } } }); }
  findSessionByHash(accessTokenHash) { return this.prisma.administratorSession.findUnique({ where: { accessTokenHash }, include: { administrator: { include: { member: true, roleBindings: { where: { revokedAt: null } }, permissionBindings: { where: { revokedAt: null } } } } } }); }
  findSessionById(id, tx = this.prisma) { return tx.administratorSession.findUnique({ where: { id }, include: { administrator: { include: { member: true, roleBindings: { where: { revokedAt: null } }, permissionBindings: { where: { revokedAt: null } } } } } }); }
  createSession(data, tx = this.prisma) { return tx.administratorSession.create({ data }); }
  revokeSession(id, organizationId, now, tx = this.prisma) { return tx.administratorSession.updateMany({ where: { id, organizationId, status: 'ACTIVE', revokedAt: null }, data: { status: 'REVOKED', revokedAt: now } }); }
  touchSession(id, now) { return this.prisma.administratorSession.update({ where: { id }, data: { lastSeenAt: now } }); }
}

class AdministratorSecurityService {
  constructor({ prisma, repository = new AdministratorSecurityRepository(prisma), clock = () => new Date(), tokenFactory = () => crypto.randomBytes(32).toString('base64url'), sessionTtlSeconds = 3600 }) {
    this.prisma = prisma; this.repository = repository; this.clock = clock; this.tokenFactory = tokenFactory; this.sessionTtlSeconds = sessionTtlSeconds;
  }
  permissions(administrator) {
    const permissions = new Set();
    for (const binding of administrator.roleBindings || []) for (const permission of ROLE_PERMISSIONS[binding.role] || []) permissions.add(permission);
    for (const binding of administrator.permissionBindings || []) if (binding.effect === 'ALLOW') permissions.add(binding.permission);
    return [...permissions];
  }
  hasPermission(administrator, permission) {
    const bindings = administrator.permissionBindings || [];
    if (bindings.some((binding) => binding.effect === 'DENY' && (binding.permission === permission || binding.permission === 'admin:*'))) return false;
    const permissions = this.permissions(administrator);
    return permissions.includes('admin:*') || permissions.includes(permission);
  }
  async createSession({ administratorId, authenticationMethod, authenticationMetadata = {}, correlationId }) {
    if (!authenticationMethod || authenticationMethod === 'development_header') throw fail(401, 'ADMIN_AUTHENTICATION_METHOD_NOT_ALLOWED', 'Production administrator authentication is required.');
    const administrator = await this.repository.findAdministrator(administratorId);
    this.assertAdministrator(administrator);
    const token = this.tokenFactory(); const now = this.clock(); const expiresAt = new Date(now.getTime() + this.sessionTtlSeconds * 1000);
    const safeMetadata = sanitize(authenticationMetadata);
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await this.repository.createSession({ administratorId, organizationId: administrator.organizationId, accessTokenHash: hashToken(token), authenticationMethod, authenticationMetadata: safeMetadata, expiresAt }, tx);
      await tx.auditEvent.create({ data: auditData({ eventType: 'administrator.session.created', administrator, sessionId: created.id, action: 'CREATE_SESSION', decision: 'ALLOW', correlationId }) });
      await tx.transactionalOutboxEvent.create({ data: outboxData({ eventType: 'AdministratorSessionCreated', aggregateId: administratorId, organizationId: administrator.organizationId, correlationId, idempotencyKey: `admin-session:${created.id}`, payload: { administratorId, sessionId: created.id, organizationId: administrator.organizationId, expiresAt } }) });
      return created;
    });
    return { token, session: publicSession(session) };
  }
  async validateToken(token, { requiredPermission, organizationId } = {}) {
    if (!token) throw fail(401, 'ADMIN_AUTHENTICATION_REQUIRED', 'Administrator authentication is required.');
    const session = await this.repository.findSessionByHash(hashToken(token)); const now = this.clock();
    if (!session || session.status !== 'ACTIVE' || session.revokedAt || session.expiresAt <= now) throw fail(401, 'ADMIN_SESSION_INVALID', 'Administrator session is invalid, expired, or revoked.');
    const administrator = session.administrator; this.assertAdministrator(administrator);
    if (session.organizationId !== administrator.organizationId || (organizationId && organizationId !== session.organizationId)) return this.deny(administrator, session, 'ADMIN_TENANT_SCOPE_DENIED', 'Requested organization is outside the authenticated session scope.');
    const permissions = this.permissions(administrator);
    if (requiredPermission && !this.hasPermission(administrator, requiredPermission)) return this.deny(administrator, session, 'ADMIN_PERMISSION_DENIED', 'Required administrator permission is not granted.', requiredPermission);
    await this.repository.touchSession(session.id, now);
    return { subject_type: 'administrator', subject_id: administrator.id, administratorId: administrator.id, memberId: administrator.memberId, organizationId: session.organizationId, organization_id: session.organizationId, roles: (administrator.roleBindings || []).map((x) => x.role), permissions, sessionId: session.id, auth_method: session.authenticationMethod };
  }
  async deny(administrator, session, code, message, requiredPermission) {
    await this.prisma.auditEvent.create({ data: { eventType: 'administrator.authorization.denied', subjectType: 'administrator', subjectId: administrator.id, targetType: 'permission', targetId: requiredPermission || null, action: 'AUTHORIZE', decision: 'DENY', reasonCode: code, authMethod: session.authenticationMethod, organizationId: administrator.organizationId, sessionId: session.id, metadata: requiredPermission ? { requiredPermission } : undefined } });
    throw fail(403, code, message);
  }
  assertAdministrator(administrator) {
    if (!administrator || administrator.status !== 'ACTIVE') throw fail(403, 'ADMINISTRATOR_DISABLED', 'Administrator is disabled or revoked.');
    if (!administrator.member || administrator.member.status !== 'ACTIVE' || administrator.member.organizationId !== administrator.organizationId) throw fail(403, 'ADMIN_MEMBERSHIP_INACTIVE', 'Active organization membership is required.');
  }
  async revokeSession({ sessionId, actor, correlationId }) {
    if (!actor?.sessionId || !actor.administratorId) throw fail(401, 'ADMIN_AUTHENTICATION_REQUIRED', 'Administrator authentication is required.');
    return this.prisma.$transaction(async (tx) => {
      await this.repository.lockAuthorization(tx);
      const authoritativeActor = await this.repository.findSessionById(actor.sessionId, tx);
      this.assertActiveSession(authoritativeActor, this.clock());
      this.assertAdministrator(authoritativeActor.administrator);
      if (authoritativeActor.administratorId !== actor.administratorId) throw fail(401, 'ADMIN_SESSION_INVALID', 'Authenticated administrator does not own this session.');
      if (authoritativeActor.organizationId !== actor.organizationId || authoritativeActor.organizationId !== authoritativeActor.administrator.organizationId) throw fail(403, 'ADMIN_TENANT_SCOPE_DENIED', 'Requested organization is outside the authenticated session scope.');
      const target = await this.repository.findSessionById(sessionId, tx);
      if (!target || target.organizationId !== authoritativeActor.organizationId) throw fail(404, 'ADMIN_SESSION_NOT_FOUND', 'Administrator session was not found.');
      const now = this.clock();
      this.assertActiveSession(authoritativeActor, now);
      if (!this.hasPermission(authoritativeActor.administrator, 'admin:session:revoke')) throw fail(403, 'ADMIN_PERMISSION_DENIED', 'Required administrator permission is not granted.');
      const result = await this.repository.revokeSession(sessionId, authoritativeActor.organizationId, now, tx);
      if (result.count !== 1) throw fail(409, 'ADMIN_SESSION_ALREADY_REVOKED', 'Administrator session is already revoked or unknown.');
      await tx.auditEvent.create({ data: { eventType: 'administrator.session.revoked', subjectType: 'administrator', subjectId: authoritativeActor.administratorId, targetType: 'administrator_session', targetId: sessionId, action: 'REVOKE_SESSION', decision: 'ALLOW', authMethod: authoritativeActor.authenticationMethod, correlationId, organizationId: authoritativeActor.organizationId, sessionId: authoritativeActor.id } });
      await tx.transactionalOutboxEvent.create({ data: outboxData({ eventType: 'AdministratorSessionRevoked', aggregateId: sessionId, organizationId: authoritativeActor.organizationId, correlationId, idempotencyKey: `admin-session-revoke:${sessionId}`, payload: { sessionId, organizationId: authoritativeActor.organizationId, revokedAt: now } }) });
      return { sessionId, revokedAt: now };
    }, { isolationLevel: 'ReadCommitted' });
  }
  assertActiveSession(session, now) {
    if (!session || session.status !== 'ACTIVE' || session.revokedAt || session.expiresAt <= now) throw fail(401, 'ADMIN_SESSION_INVALID', 'Administrator session is invalid, expired, or revoked.');
  }
}

function sanitize(value) {
  const forbidden = /password|token|secret|authorization|cookie|credential|api.?key/i;
  if (Array.isArray(value)) return value.slice(0, 100).map(sanitize);
  if (!value || typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 256) : value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !forbidden.test(key)).map(([key, item]) => [key, sanitize(item)]));
}
function auditData({ eventType, administrator, sessionId, action, decision, correlationId }) { return { eventType, subjectType: 'administrator', subjectId: administrator.id, targetType: 'administrator_session', targetId: sessionId, action, decision, authMethod: 'verified_external_identity', correlationId, organizationId: administrator.organizationId, sessionId }; }
function outboxData({ eventType, aggregateId, organizationId, correlationId, idempotencyKey, payload }) { const now = new Date(); return { eventId: crypto.randomUUID(), eventType, eventVersion: 1, aggregateType: 'administrator_security', aggregateId, organizationId, correlationId, idempotencyKey, payload, occurredAt: now, availableAt: now }; }
function publicSession(session) { return { id: session.id, administratorId: session.administratorId, organizationId: session.organizationId, createdAt: session.createdAt, expiresAt: session.expiresAt, revokedAt: session.revokedAt }; }

module.exports = { AdministratorSecurityRepository, AdministratorSecurityService, ROLE_PERMISSIONS, hashToken };
