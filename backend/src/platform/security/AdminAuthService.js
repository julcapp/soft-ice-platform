const crypto = require('crypto');
const { promisify } = require('util');
const { ApiError } = require('../errors/ApiError');
const { sha256 } = require('./hash');

const scrypt = promisify(crypto.scrypt);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

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
  constructor({ prisma, auditRepository, securityDelivery = null, otpSecret = process.env.ADMIN_SECURITY_OTP_SECRET, clock = () => new Date(), tokenFactory = () => crypto.randomBytes(32).toString('base64url'), otpFactory = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0') }) {
    this.prisma = prisma;
    this.audit = auditRepository;
    this.securityDelivery = securityDelivery;
    this.otpSecret = otpSecret || null;
    this.clock = clock;
    this.tokenFactory = tokenFactory;
    this.otpFactory = otpFactory;
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

  async getSecurityProfile(securityContext) {
    const rows = await this.prisma.$queryRawUnsafe('SELECT "email","emailVerifiedAt","maxUserId","maxVerifiedAt","passwordChangedAt" FROM "AdminUser" WHERE "id"=$1::uuid LIMIT 1', securityContext.subject_id);
    const user = rows[0] || {};
    return {
      passwordChangedAt: user.passwordChangedAt || null,
      channels: {
        MAX: { configured: Boolean(user.maxUserId), verified: Boolean(user.maxVerifiedAt), destination: maskMax(user.maxUserId) },
        EMAIL: { configured: Boolean(user.email), verified: Boolean(user.emailVerifiedAt), destination: maskEmail(user.email) },
      },
    };
  }

  async requestPasswordChange(securityContext, { currentPassword, newPassword, channel }, context = {}) {
    const normalizedChannel = String(channel || '').toUpperCase();
    if (!['MAX', 'EMAIL'].includes(normalizedChannel)) throw badRequest('ADMIN_SECURITY_CHANNEL_INVALID', 'Выберите MAX или электронную почту.');
    if (String(newPassword || '').length < 6 || String(newPassword || '').length > 12) throw badRequest('ADMIN_PASSWORD_POLICY', 'Пароль должен содержать от 6 до 12 символов.');
    if (!currentPassword) throw badRequest('ADMIN_CURRENT_PASSWORD_REQUIRED', 'Введите текущий пароль.');
    if (!this.otpSecret) throw securityUnavailable('Секрет одноразовых кодов не настроен на сервере.');
    if (!this.securityDelivery) throw securityUnavailable('Доставка кодов подтверждения не настроена.');

    const rows = await this.prisma.$queryRawUnsafe('SELECT * FROM "AdminUser" WHERE "id"=$1::uuid LIMIT 1', securityContext.subject_id);
    const user = rows[0];
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      await this.auditSecurity('Admin.PasswordChangeRejected', securityContext, context, 'password_change_request', 'deny', 'current_password_invalid');
      throw badRequest('ADMIN_CURRENT_PASSWORD_INVALID', 'Текущий пароль указан неверно.');
    }
    if (await verifyPassword(newPassword, user.passwordHash)) throw badRequest('ADMIN_PASSWORD_UNCHANGED', 'Новый пароль должен отличаться от текущего.');

    const destination = normalizedChannel === 'MAX' ? user.maxUserId : user.email;
    const verifiedAt = normalizedChannel === 'MAX' ? user.maxVerifiedAt : user.emailVerifiedAt;
    if (!destination || !verifiedAt) throw badRequest('ADMIN_SECURITY_CHANNEL_NOT_VERIFIED', 'Выбранный канал не привязан или не подтверждён.');

    await this.prisma.$executeRawUnsafe('UPDATE "AdminSecurityChallenge" SET "consumedAt"=NOW() WHERE "adminUserId"=$1::uuid AND "purpose"=\'PASSWORD_CHANGE\' AND "consumedAt" IS NULL', securityContext.subject_id);
    const code = this.otpFactory();
    const challengeId = crypto.randomUUID();
    const codeHash = otpHash(this.otpSecret, challengeId, code);
    const newPasswordHash = await hashPassword(newPassword);
    const expiresAt = new Date(this.clock().getTime() + OTP_TTL_MS);
    await this.prisma.$executeRawUnsafe('INSERT INTO "AdminSecurityChallenge" ("id","adminUserId","sessionId","purpose","channel","destination","codeHash","newPasswordHash","maxAttempts","expiresAt") VALUES ($1::uuid,$2::uuid,$3::uuid,\'PASSWORD_CHANGE\',$4,$5,$6,$7,$8,$9)', challengeId, securityContext.subject_id, securityContext.session_id, normalizedChannel, destination, codeHash, newPasswordHash, OTP_MAX_ATTEMPTS, expiresAt);

    try {
      await this.securityDelivery.send({ channel: normalizedChannel, destination, code });
    } catch (error) {
      await this.prisma.$executeRawUnsafe('UPDATE "AdminSecurityChallenge" SET "consumedAt"=NOW() WHERE "id"=$1::uuid', challengeId);
      await this.auditSecurity('Admin.PasswordChangeCodeDeliveryFailed', securityContext, context, 'password_change_request', 'deny', 'otp_delivery_failed', { channel: normalizedChannel });
      throw securityUnavailable('Не удалось отправить код подтверждения. Проверьте настройки выбранного канала.');
    }

    await this.auditSecurity('Admin.PasswordChangeCodeSent', securityContext, context, 'password_change_request', 'success', 'otp_sent', { channel: normalizedChannel });
    return { challengeId, channel: normalizedChannel, destination: normalizedChannel === 'MAX' ? maskMax(destination) : maskEmail(destination), expiresAt, maxAttempts: OTP_MAX_ATTEMPTS };
  }

  async confirmPasswordChange(securityContext, { challengeId, code }, context = {}) {
    if (!this.otpSecret) throw securityUnavailable('Секрет одноразовых кодов не настроен на сервере.');
    const rows = await this.prisma.$queryRawUnsafe('SELECT * FROM "AdminSecurityChallenge" WHERE "id"=$1::uuid AND "adminUserId"=$2::uuid AND "sessionId"=$3::uuid AND "purpose"=\'PASSWORD_CHANGE\' LIMIT 1', challengeId, securityContext.subject_id, securityContext.session_id);
    const challenge = rows[0];
    if (!challenge || challenge.consumedAt) throw badRequest('ADMIN_OTP_INVALID', 'Запрос смены пароля недействителен или уже завершён.');
    if (new Date(challenge.expiresAt) <= this.clock()) {
      await this.prisma.$executeRawUnsafe('UPDATE "AdminSecurityChallenge" SET "consumedAt"=NOW() WHERE "id"=$1::uuid', challenge.id);
      throw badRequest('ADMIN_OTP_EXPIRED', 'Срок действия кода истёк. Запросите новый код.');
    }
    if (Number(challenge.attempts) >= Number(challenge.maxAttempts)) throw badRequest('ADMIN_OTP_ATTEMPTS_EXCEEDED', 'Лимит попыток исчерпан. Запросите новый код.');

    const actualHash = otpHash(this.otpSecret, challenge.id, String(code || '').trim());
    const valid = safeEqualHex(actualHash, challenge.codeHash);
    if (!valid) {
      const nextAttempts = Number(challenge.attempts) + 1;
      await this.prisma.$executeRawUnsafe('UPDATE "AdminSecurityChallenge" SET "attempts"=$2, "consumedAt"=CASE WHEN $2 >= "maxAttempts" THEN NOW() ELSE NULL END WHERE "id"=$1::uuid', challenge.id, nextAttempts);
      await this.auditSecurity('Admin.PasswordChangeCodeRejected', securityContext, context, 'password_change_confirm', 'deny', 'otp_invalid', { attempts: nextAttempts });
      throw badRequest('ADMIN_OTP_INVALID', nextAttempts >= Number(challenge.maxAttempts) ? 'Лимит попыток исчерпан. Запросите новый код.' : 'Неверный код подтверждения.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('UPDATE "AdminUser" SET "passwordHash"=$2, "passwordChangedAt"=NOW(), "failedLoginCount"=0, "lockedUntil"=NULL, "updatedAt"=NOW() WHERE "id"=$1::uuid', securityContext.subject_id, challenge.newPasswordHash);
      await tx.$executeRawUnsafe('UPDATE "AdminSecurityChallenge" SET "consumedAt"=NOW(), "attempts"="attempts"+1 WHERE "id"=$1::uuid', challenge.id);
      await tx.$executeRawUnsafe(`UPDATE "AdminSession" SET "revokedAt"=NOW(), "revokedReason"='password_changed' WHERE "adminUserId"=$1::uuid AND "id"<>$2::uuid AND "revokedAt" IS NULL`, securityContext.subject_id, securityContext.session_id);
    });
    await this.auditSecurity('Admin.PasswordChanged', securityContext, context, 'password_change_confirm', 'success', 'otp_verified', { channel: challenge.channel });
    return { changed: true, otherSessionsRevoked: true };
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
    return this.prisma.auditEvent.findMany({ where: { subjectId: securityContext.subject_id }, orderBy: { occurredAt: 'desc' }, take: 100 });
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

  async auditSecurity(eventType, securityContext, context, action, decision, reasonCode, metadata = {}) {
    await this.audit.record({ eventType, subjectType: 'administrator', subjectId: securityContext.subject_id, targetType: 'AdminUser', targetId: securityContext.subject_id, action, decision, reasonCode, authMethod: securityContext.auth_method, sourceChannel: 'admin_console', correlationId: context.correlationId, metadata: { ...metadata, ip_address: context.ipAddress || null, user_agent: context.userAgent || null } });
  }

  async recordLoginAudit(user, success, { ipAddress, userAgent, correlationId, sessionId, reasonCode }) {
    await this.audit.record({ eventType: success ? 'Admin.LoginSucceeded' : 'Admin.LoginFailed', subjectType: 'administrator', subjectId: user?.id || null, targetType: 'AdminSession', targetId: sessionId || null, action: 'authenticate', decision: success ? 'success' : 'deny', reasonCode, authMethod: 'password', sourceChannel: 'admin_console', correlationId, metadata: { login: user?.login || null, ip_address: ipAddress || null, user_agent: userAgent || null } });
  }
}

function otpHash(secret, challengeId, code) { return crypto.createHmac('sha256', secret).update(`${challengeId}:${code}`).digest('hex'); }
function safeEqualHex(left, right) { try { const a = Buffer.from(String(left), 'hex'); const b = Buffer.from(String(right), 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); } catch { return false; } }
function maskEmail(value) { if (!value || !String(value).includes('@')) return null; const [name, domain] = String(value).split('@'); return `${name.slice(0, 2)}***@${domain}`; }
function maskMax(value) { if (!value) return null; const text = String(value); return text.length <= 4 ? '****' : `${'*'.repeat(Math.max(4, text.length - 4))}${text.slice(-4)}`; }
function presentUser(user) { return { id: user.id, login: user.login, displayName: user.displayName, roles: user.roles || [], status: user.status }; }
function invalidCredentials() { return new ApiError({ statusCode: 401, code: 'ADMIN_INVALID_CREDENTIALS', message: 'Неверный логин или пароль.', source: 'api' }); }
function authRequired() { return new ApiError({ statusCode: 401, code: 'ADMIN_AUTHENTICATION_REQUIRED', message: 'Требуется вход администратора.', source: 'api' }); }
function badRequest(code, message) { return new ApiError({ statusCode: 400, code, message, source: 'api' }); }
function securityUnavailable(message) { return new ApiError({ statusCode: 503, code: 'ADMIN_SECURITY_DELIVERY_UNAVAILABLE', message, source: 'api' }); }

module.exports = { AdminAuthService, hashPassword, verifyPassword, SESSION_TTL_MS, OTP_TTL_MS, OTP_MAX_ATTEMPTS };
