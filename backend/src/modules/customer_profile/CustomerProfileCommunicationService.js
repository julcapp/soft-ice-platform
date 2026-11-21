const crypto = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PROFILE_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const MARKETING_RULES_VERSION = 'marketing-email-v1';
const MARKETING_RULES_URL = '/legal/marketing-email-rules.html';

class CustomerProfileCommunicationService {
  constructor({ prisma, crmRuntime = null, clock = () => new Date(), tokenTtlMs = EMAIL_VERIFICATION_TTL_MS, profilePromptCooldownMs = PROFILE_PROMPT_COOLDOWN_MS }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma; this.crmRuntime = crmRuntime; this.clock = clock; this.tokenTtlMs = tokenTtlMs; this.profilePromptCooldownMs = profilePromptCooldownMs;
  }

  async getProfileState(customerId) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, name: true, phone: true, birthday: true, email: true } });
    if (!customer) throw notFound();
    const [verificationRows, consentRows, unreadRows] = await Promise.all([
      this.prisma.$queryRaw`SELECT "email", "status", "expiresAt", "verifiedAt" FROM "CustomerEmailVerification" WHERE "customerId" = ${customerId} ORDER BY "createdAt" DESC LIMIT 1`,
      this.prisma.$queryRaw`SELECT "isGranted", "rulesVersion", "rulesUrl", "grantedAt", "revokedAt", "createdAt" FROM "CustomerCommunicationConsent" WHERE "customerId" = ${customerId} AND "consentType" = 'MARKETING_EMAIL' ORDER BY "createdAt" DESC LIMIT 1`,
      this.prisma.$queryRaw`SELECT COUNT(*)::int AS count FROM "CustomerNotification" WHERE "customerId" = ${customerId} AND "readAt" IS NULL`,
    ]);
    return { customer, completion: { birthdayMissing: !customer.birthday, emailMissing: !customer.email }, emailVerification: verificationRows?.[0] || null, marketingConsent: consentRows?.[0] || null, unreadNotifications: Number(unreadRows?.[0]?.count || 0), rules: { version: MARKETING_RULES_VERSION, url: MARKETING_RULES_URL } };
  }

  async ensureProfilePrompts(customerId) {
    const state = await this.getProfileState(customerId);
    if (state.completion.birthdayMissing) await this.#ensureNotification(customerId, { type: 'PROFILE_BIRTHDAY_MISSING', title: 'Добавьте дату рождения', body: 'Укажите дату рождения в профиле — в день рождения мы сможем подготовить для вас подарок.', actionType: 'OPEN_PROFILE_BIRTHDAY', significant: false });
    if (state.completion.emailMissing) await this.#ensureNotification(customerId, { type: 'PROFILE_EMAIL_MISSING', title: 'Добавьте электронную почту', body: 'Укажите электронную почту для электронных чеков и сервисных сообщений. Рассылки будут отправляться только при отдельном согласии.', actionType: 'OPEN_PROFILE_EMAIL', significant: true });
    return this.getProfileState(customerId);
  }

  async createSystemNotification(customerId, notification = {}) {
    if (!notification.type || !notification.title || !notification.body) throw validation('CUSTOMER_NOTIFICATION_INVALID', 'type, title and body are required.');
    return this.#ensureNotification(customerId, { ...notification, significant: Boolean(notification.significant) }, true);
  }

  async updateProfile(customerId, input = {}) {
    const data = {};
    if (Object.hasOwn(input, 'birthday')) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.birthday || ''))) throw validation('CUSTOMER_BIRTHDAY_INVALID', 'birthday must use YYYY-MM-DD.'); const birthday = new Date(`${input.birthday}T00:00:00.000Z`); if (Number.isNaN(birthday.getTime()) || birthday > this.clock()) throw validation('CUSTOMER_BIRTHDAY_INVALID', 'birthday is invalid.'); data.birthday = birthday; }
    if (Object.hasOwn(input, 'email')) { const email = normalizeEmail(input.email); if (!email) throw validation('CUSTOMER_EMAIL_INVALID', 'email is invalid.'); data.email = email; }
    if (!Object.keys(data).length) throw validation('CUSTOMER_PROFILE_PATCH_EMPTY', 'No supported profile fields were provided.');
    return this.prisma.customer.update({ where: { id: customerId }, data, select: { id: true, birthday: true, email: true } });
  }

  async requestEmailVerification(customerId, emailInput) {
    const email = normalizeEmail(emailInput); if (!email) throw validation('CUSTOMER_EMAIL_INVALID', 'email is invalid.');
    const token = crypto.randomBytes(32).toString('base64url'); const tokenHash = sha256(token); const now = this.clock(); const expiresAt = new Date(now.getTime() + this.tokenTtlMs); const id = crypto.randomUUID();
    await this.prisma.$executeRaw`UPDATE "CustomerEmailVerification" SET "status" = 'SUPERSEDED', "consumedAt" = ${now} WHERE "customerId" = ${customerId} AND "status" = 'PENDING'`;
    await this.prisma.$executeRaw`INSERT INTO "CustomerEmailVerification" ("id","customerId","email","tokenHash","status","expiresAt","createdAt") VALUES (${id},${customerId},${email},${tokenHash},'PENDING',${expiresAt},${now})`;
    await this.prisma.customer.update({ where: { id: customerId }, data: { email } });
    await this.#ensureNotification(customerId, { type: 'EMAIL_VERIFICATION_PENDING', title: 'Подтвердите электронную почту', body: 'Мы отправили ссылку подтверждения. Ссылка действует 24 часа.', actionType: 'VERIFY_EMAIL', significant: false }, true);
    return { email, token, expiresAt };
  }

  async confirmEmailVerification(token) {
    const tokenHash = sha256(String(token || '')); const now = this.clock();
    const rows = await this.prisma.$queryRaw`SELECT "id","customerId","email","status","expiresAt" FROM "CustomerEmailVerification" WHERE "tokenHash" = ${tokenHash} LIMIT 1`; const row = rows?.[0];
    if (!row) throw validation('EMAIL_VERIFICATION_TOKEN_INVALID', 'Verification token is invalid.'); if (row.status !== 'PENDING') throw validation('EMAIL_VERIFICATION_TOKEN_USED', 'Verification token is no longer active.');
    if (new Date(row.expiresAt) <= now) { await this.prisma.$executeRaw`UPDATE "CustomerEmailVerification" SET "status"='EXPIRED', "consumedAt"=${now} WHERE "id"=${row.id}`; throw validation('EMAIL_VERIFICATION_TOKEN_EXPIRED', 'Verification token has expired.'); }
    await this.prisma.$transaction(async (tx) => { await tx.$executeRaw`UPDATE "CustomerEmailVerification" SET "status"='VERIFIED', "verifiedAt"=${now}, "consumedAt"=${now} WHERE "id"=${row.id}`; await tx.customer.update({ where: { id: row.customerId }, data: { email: row.email } }); });
    await this.#ensureNotification(row.customerId, { type: 'EMAIL_VERIFIED', title: 'Электронная почта подтверждена', body: 'Теперь на подтверждённый адрес можно отправлять электронные чеки и значимые сервисные сообщения.', significant: false }, true);
    return { verified: true, customerId: row.customerId, email: row.email, verifiedAt: now };
  }

  async recordMarketingConsent(customerId, input = {}, context = {}) {
    if (typeof input.isGranted !== 'boolean') throw validation('MARKETING_CONSENT_REQUIRED', 'isGranted must be boolean.'); const rulesVersion = String(input.rulesVersion || MARKETING_RULES_VERSION); if (rulesVersion !== MARKETING_RULES_VERSION) throw validation('MARKETING_RULES_VERSION_STALE', 'Marketing rules version is stale.');
    const now = this.clock(); const id = crypto.randomUUID(); const grantedAt = input.isGranted ? now : null; const revokedAt = input.isGranted ? null : now;
    await this.prisma.$executeRaw`INSERT INTO "CustomerCommunicationConsent" ("id","customerId","consentType","isGranted","rulesVersion","rulesUrl","sourceChannel","correlationId","grantedAt","revokedAt","createdAt") VALUES (${id},${customerId},'MARKETING_EMAIL',${input.isGranted},${rulesVersion},${MARKETING_RULES_URL},${String(context.sourceChannel || 'MINI_APP')},${context.correlationId || null},${grantedAt},${revokedAt},${now})`;
    return { id, customerId, isGranted: input.isGranted, rulesVersion, rulesUrl: MARKETING_RULES_URL, grantedAt, revokedAt, createdAt: now };
  }

  async listNotifications(customerId, { limit = 50 } = {}) { const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100); return this.prisma.$queryRaw`SELECT "id","type","title","body","importance","actionType","actionPayload","significant","createdAt","readAt" FROM "CustomerNotification" WHERE "customerId"=${customerId} ORDER BY "createdAt" DESC LIMIT ${safeLimit}`; }
  async markNotificationRead(customerId, notificationId) { const now = this.clock(); const affected = await this.prisma.$executeRaw`UPDATE "CustomerNotification" SET "readAt"=${now} WHERE "id"=${notificationId} AND "customerId"=${customerId} AND "readAt" IS NULL`; return { notificationId, readAt: now, changed: Number(affected) > 0 }; }

  async #ensureNotification(customerId, notification, force = false) {
    const now = this.clock();
    if (!force) { const cutoff = new Date(now.getTime() - this.profilePromptCooldownMs); const existing = await this.prisma.$queryRaw`SELECT "id" FROM "CustomerNotification" WHERE "customerId"=${customerId} AND "type"=${notification.type} AND ("readAt" IS NULL OR "createdAt">=${cutoff}) ORDER BY "createdAt" DESC LIMIT 1`; if (existing?.length) return existing[0]; }
    const id = crypto.randomUUID(); await this.prisma.$executeRaw`INSERT INTO "CustomerNotification" ("id","customerId","type","title","body","importance","actionType","actionPayload","significant","createdAt") VALUES (${id},${customerId},${notification.type},${notification.title},${notification.body},${notification.importance || 'NORMAL'},${notification.actionType || null},${notification.actionPayload || null},${Boolean(notification.significant)},${now})`;
    if (notification.significant) await this.#queueVerifiedEmail(customerId, id, notification); return { id };
  }

  async #queueVerifiedEmail(customerId, notificationId, notification) {
    if (!this.crmRuntime?.queueNotification) return; const verifiedRows = await this.prisma.$queryRaw`SELECT "email" FROM "CustomerEmailVerification" WHERE "customerId"=${customerId} AND "status"='VERIFIED' ORDER BY "verifiedAt" DESC LIMIT 1`; if (!verifiedRows?.[0]?.email) return;
    await this.crmRuntime.queueNotification(customerId, { channel: 'EMAIL', subject: notification.title, body: notification.body }, { actorId: 'system', authMethod: 'system', correlationId: `customer-notification:${notificationId}`, idempotencyKey: `customer-notification-email:${notificationId}` });
  }
}

function normalizeEmail(value) { const email = String(value || '').trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null; }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function validation(code, message) { return new ApiError({ statusCode: 400, code, message, source: 'platform_service' }); }
function notFound() { return new ApiError({ statusCode: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Customer was not found.', source: 'platform_service' }); }
module.exports = { CustomerProfileCommunicationService, EMAIL_VERIFICATION_TTL_MS, PROFILE_PROMPT_COOLDOWN_MS, MARKETING_RULES_VERSION, MARKETING_RULES_URL };
