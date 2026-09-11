const crypto = require('crypto');
const { promisify } = require('util');
const { ApiError } = require('../errors/ApiError');
const { sha256 } = require('./hash');

const scrypt = promisify(crypto.scrypt);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = await scrypt(String(password), salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [scheme, salt, expectedHex] = String(encoded || '').split('$');
  if (scheme !== 'scrypt' || !salt || !expectedHex) return false;
  const derived = await scrypt(String(password), salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = Buffer.from(derived);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

class AdminAuthService {
  constructor({ prisma, auditRepository, clock = () => new Date(), tokenFactory = () => crypto.randomBytes(32).toString('base64url') }) {
    this.prisma = prisma;
    this.audit = auditRepository;
    this.clock = clock;
    this.tokenFactory = tokenFactory;
  }

  async login({ login, password, ipAddress, userAgent, correlationId }) {
    const normalizedLogin = String(login || '').trim().toLowerCase();
    if (!normalizedLogin || !password) throw invalidCredentials();
    const rows = await this.prisma.$queryRawUnsafe('SELECT * FROM "AdminUser" WHERE lower("login") = $1 LIMIT 1', normalizedLogin);
    const user = rows[0];
    const now = this.clock();
    if (!user || user.status !== 'ACTIVE' || (user.lockedUntil && new Date(user.lockedUntil) > now)) {
      await this.recordLoginAudit(user, false, { ipAddress, userAgent, correlationId, reasonCode: user?.lockedUntil ? 'admin_locked' : 'invalid_credentials' });
      throw invalidCredentials();
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      const next = Number(user.failedLoginCount || 0) + 1;
      const lockedUntil = next >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_MS) : null;
      await this.prisma.$executeRawUnsafe('UPDATE "AdminUser" SET "failedLoginCount"=$2, "lockedUntil"=$3, "updatedAt"=NOW() WHERE "id"=$1::uuid', user.id, next, lockedUntil);
      await this.recordLoginAudit(user, false, { ipAddress, userAgent, correlationId, reasonCode: lockedUntil ? 'admin_locked_after_failures' : 'invalid_credentials' });
      throw invalidCredentials();
    }
    const token = this.tokenFactory();
    const tokenHash = sha256(token);
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const sessions = await this.prisma.$queryRawUnsafe('INSERT INTO "AdminSession" ("adminUserId","tokenHash","ipAddress","userAgent","expiresAt") VALUES ($1::uuid,$2,$3,$4,$5) RETURNING *', user.id, tokenHash, ipAddress || null, userAgent || null, expiresAt);
    await this.prisma.$executeRawUnsafe('UPDATE "AdminUser" SET "failedLoginCount"=0, "lockedUntil"=NULL, "lastLoginAt"=NOW(), "updatedAt"=NOW() WHERE "id"=$1::uuid', user.id);
    await this.recordLoginAudit(user, true, { ipAddress, userAgent, correlationId, sessionId: sessions[0].id, reasonCode: 'admin_login_success' });
    return { token, expiresAt, user: presentUser(user) };
  }

  async authenticate(token, { correlationId } = {}) {
    if (!token) throw authRequired();
    const rows = await this.prisma.$queryRawUnsafe(`SELECT s.*, u."login", u."displayName", u."roles", u."status" AS "userStatus" FROM "AdminSession" s JOIN "AdminUser" u ON u."id"=s."adminUserId" WHERE s."tokenHash"=$1 AND s."revokedAt" IS NULL AND s."expiresAt">NOW() LIMIT 1`, sha256(token));
    const row = rows[0];
    if (!row || row.userStatus !== 'ACTIVE') throw authRequired();
    await this.prisma.$executeRawUnsafe('UPDATE "AdminSession" SET "lastSeenAt"=NOW() WHERE "id"=$1::uuid', row.id);
    return { subject_type: 'administrator', subject_id: row.adminUserId, session_id: row.id, roles: row.roles || [], auth_method: 'password', display_name: row.displayName, login: row.login, correlation_id: correlationId || null };
  }

  async listSessions(securityContext) {
    const rows = await this.prisma.$queryRawUnsafe(`SELECT "id","ipAddress","userAgent","createdAt","lastSeenAt","expiresAt","revokedAt","revokedReason" FROM "AdminSession" WHERE "adminUserId"=$1::uuid ORDER BY "createdAt" DESC LIMIT 50`, securityContext.subject_id);
    return rows.map((row) => ({ ...row, current: row.id === securityContext.session_id }));
  }

  async revokeOtherSessions(securityContext, context = {}) {
    await this.prisma.$executeRawUnsafe(`UPDATE "AdminSession" SET "revokedAt"=NOW(), "revokedReason"='owner_revoke_others' WHERE "adminUserId"=$1::uuid AND "id"<>$2::uuid AND "revokedAt" IS NULL`, securityContext.subject_id, securityContext.session_id);
    await this.audit.record({ eventType: 'Admin.OtherSessionsRevoked', subjectType: 'administrator', subjectId: securityContext.subject_id, targetType: 'AdminSession', targetId: securityContext.session_id, action: 'revoke_other_sessions', decision: 'success', reasonCode: 'owner_requested', authMethod: securityContext.auth_method, sourceChannel: 'admin_console', correlationId: context.correlationId, metadata: { ip_address: context.ipAddress || null, user_agent: context.userAgent || null } });
  }

  async listAuditEvents(securityContext) {
    const rows = await this.prisma.auditEvent.findMany({
      where: { subjectId: securityContext.subject_id },
      orderBy: { occurredAt: 'desc' },
      take: 100,
    });
    return rows;
  }

  async logout(token, context = {}) {
    if (!token) return;
    const hash = sha256(token);
    const rows = await this.prisma.$queryRawUnsafe('SELECT s.*, u."login", u."displayName", u."roles" FROM "AdminSession" s JOIN "AdminUser" u ON u."id"=s."adminUserId" WHERE s."tokenHash"=$1 LIMIT 1', hash);
    const row = rows[0];
    if (!row) return;
    await this.prisma.$executeRawUnsafe('UPDATE "AdminSession" SET "revokedAt"=NOW(), "revokedReason"=$2 WHERE "id"=$1::uuid AND "revokedAt" IS NULL', row.id, 'logout');
    await this.audit.record({ eventType: 'Admin.SessionRevoked', subjectType: 'administrator', subjectId: row.adminUserId, targetType: 'AdminSession', targetId: row.id, action: 'logout', decision: 'success', reasonCode: 'admin_logout', authMethod: 'password', sourceChannel: 'admin_console', correlationId: context.correlationId, metadata: { ip_address: context.ipAddress || null, user_agent: context.userAgent || null } });
  }

  async recordLoginAudit(user, success, { ipAddress, userAgent, correlationId, sessionId, reasonCode }) {
    await this.audit.record({ eventType: success ? 'Admin.LoginSucceeded' : 'Admin.LoginFailed', subjectType: 'administrator', subjectId: user?.id || null, targetType: 'AdminSession', targetId: sessionId || null, action: 'authenticate', decision: success ? 'success' : 'deny', reasonCode, authMethod: 'password', sourceChannel: 'admin_console', correlationId, metadata: { login: user?.login || null, ip_address: ipAddress || null, user_agent: userAgent || null } });
  }
}

function presentUser(user) { return { id: user.id, login: user.login, displayName: user.displayName, roles: user.roles || [], status: user.status }; }
function invalidCredentials() { return new ApiError({ statusCode: 401, code: 'ADMIN_INVALID_CREDENTIALS', message: 'Неверный логин или пароль.', source: 'api' }); }
function authRequired() { return new ApiError({ statusCode: 401, code: 'ADMIN_AUTHENTICATION_REQUIRED', message: 'Требуется вход администратора.', source: 'api' }); }

module.exports = { AdminAuthService, hashPassword, verifyPassword, SESSION_TTL_MS };
