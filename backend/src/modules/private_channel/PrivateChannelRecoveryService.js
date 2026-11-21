const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

class PrivateChannelRecoveryService {
  constructor({ prisma, renewalService, accessService = null, crmRuntime = null, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    if (!renewalService) throw new Error('renewalService is required');
    this.prisma = prisma;
    this.renewalService = renewalService;
    this.accessService = accessService;
    this.crmRuntime = crmRuntime;
    this.clock = clock;
  }

  async getCustomerRecovery(customerId, planCode) {
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT a."id",a."status",a."attemptCount",a."nextRetryAt",a."graceUntil",a."failureCode",a."failureMessage",a."periodEnd",a."updatedAt"
       FROM "PrivateChannelRenewalAttempt" a
       JOIN "PrivateChannelSubscription" s ON s."id"=a."subscriptionId"
       JOIN "PrivateChannelPlan" p ON p."id"=s."planId"
       WHERE s."customerId"=$1 AND p."code"=$2
       ORDER BY a."updatedAt" DESC LIMIT 1`,
      customerId, planCode,
    );
    return rows[0] || null;
  }

  async syncAttempt(result) {
    if (!result || !['FAILED', 'EXHAUSTED'].includes(String(result.status))) return result;
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT a.*, p."channelType", p."name" AS "planName"
       FROM "PrivateChannelRenewalAttempt" a
       JOIN "PrivateChannelSubscription" s ON s."id"=a."subscriptionId"
       JOIN "PrivateChannelPlan" p ON p."id"=s."planId"
       WHERE a."id"=$1 LIMIT 1`,
      result.id,
    );
    const attempt = rows[0];
    if (!attempt) return result;
    await this.#ensureCustomerNotification(attempt);
    return result;
  }

  async listQueue({ limit = 100 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return this.prisma.$queryRawUnsafe(
      `SELECT a.*, s."status" AS "subscriptionStatus", s."currentPeriodEnd", s."recurringEnabled", s."cancelAtPeriodEnd",
              p."channelType", p."name" AS "planName", p."priceRub",
              c."name" AS "customerName", c."phone" AS "customerPhone", c."email" AS "customerEmail"
       FROM "PrivateChannelRenewalAttempt" a
       JOIN "PrivateChannelSubscription" s ON s."id"=a."subscriptionId"
       JOIN "PrivateChannelPlan" p ON p."id"=s."planId"
       JOIN "Customer" c ON c."id"=a."customerId"
       WHERE a."status" IN ('FAILED','EXHAUSTED')
       ORDER BY CASE WHEN a."status"='EXHAUSTED' THEN 0 ELSE 1 END, COALESCE(a."graceUntil",a."periodEnd") ASC
       LIMIT $1`,
      safeLimit,
    );
  }

  async retry(attemptId) {
    const now = this.clock();
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT a.*, s.*, p."code" AS "planCode", p."name" AS "planName", p."priceRub", p."billingPeriodDays"
       FROM "PrivateChannelRenewalAttempt" a
       JOIN "PrivateChannelSubscription" s ON s."id"=a."subscriptionId"
       JOIN "PrivateChannelPlan" p ON p."id"=s."planId"
       WHERE a."id"=$1 LIMIT 1`,
      attemptId,
    );
    const row = rows[0];
    if (!row) throw new ApiError({ statusCode: 404, code: 'PRIVATE_CHANNEL_RENEWAL_ATTEMPT_NOT_FOUND', message: 'Попытка продления не найдена.' });
    if (row.status === 'EXHAUSTED') throw new ApiError({ statusCode: 409, code: 'PRIVATE_CHANNEL_RENEWAL_CUSTOMER_ACTION_REQUIRED', message: 'Лимит автопродления исчерпан. Требуется новое действие пользователя/новая оплата.' });
    if (row.nextRetryAt && new Date(row.nextRetryAt) > now) throw new ApiError({ statusCode: 409, code: 'PRIVATE_CHANNEL_RENEWAL_RETRY_NOT_DUE', message: 'Следующая безопасная попытка ещё не наступила.' });
    const result = await this.renewalService.processOne(row);
    await this.syncAttempt(result);
    return result;
  }

  async expireExhaustedAccess({ limit = 100 } = {}) {
    if (!this.accessService?.expireSubscriptionAccess) return [];
    const now = this.clock();
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT DISTINCT a."subscriptionId", p."channelType"
       FROM "PrivateChannelRenewalAttempt" a
       JOIN "PrivateChannelSubscription" s ON s."id"=a."subscriptionId"
       JOIN "PrivateChannelPlan" p ON p."id"=s."planId"
       WHERE a."status"='EXHAUSTED' AND a."graceUntil" IS NOT NULL AND a."graceUntil" <= $1
       ORDER BY a."subscriptionId" LIMIT $2`,
      now, Math.min(Math.max(Number(limit) || 100, 1), 500),
    );
    const results = [];
    for (const row of rows) {
      results.push(await this.accessService.expireSubscriptionAccess({ subscriptionId: row.subscriptionId, channelType: row.channelType }));
    }
    return results;
  }

  async #ensureCustomerNotification(attempt) {
    const status = String(attempt.status);
    const type = status === 'EXHAUSTED' ? 'PRIVATE_CHANNEL_RENEWAL_EXHAUSTED' : 'PRIVATE_CHANNEL_RENEWAL_FAILED';
    const existing = await this.prisma.$queryRawUnsafe(
      `SELECT "id" FROM "CustomerNotification"
       WHERE "customerId"=$1 AND "type"=$2 AND "actionPayload" @> $3::jsonb
       LIMIT 1`,
      attempt.customerId, type, JSON.stringify({ renewalAttemptId: attempt.id, attemptCount: Number(attempt.attemptCount || 0) }),
    );
    if (existing[0]) return existing[0];
    const now = this.clock();
    const channelLabel = String(attempt.channelType).toUpperCase() === 'MAX' ? 'MAX' : 'Telegram';
    const graceText = attempt.graceUntil ? new Date(attempt.graceUntil).toLocaleString('ru-RU', { timeZone: 'UTC' }) : null;
    const notification = status === 'EXHAUSTED'
      ? { title: `Не удалось продлить приватный канал ${channelLabel}`, body: `Автопродление не выполнено после всех разрешённых попыток.${graceText ? ` Льготный период действует до ${graceText} UTC.` : ''} Откройте подписку, чтобы выбрать дальнейшее действие.`, importance: 'HIGH' }
      : { title: `Проблема с автопродлением ${channelLabel}`, body: `Автоматический платёж не прошёл. Мы повторим попытку безопасно.${graceText ? ` Доступ сохраняется в рамках льготного периода до ${graceText} UTC.` : ''}`, importance: 'WARNING' };
    const id = randomUUID();
    const payload = { renewalAttemptId: attempt.id, subscriptionId: attempt.subscriptionId, channelType: attempt.channelType, status, attemptCount: Number(attempt.attemptCount || 0), nextRetryAt: attempt.nextRetryAt || null, graceUntil: attempt.graceUntil || null };
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "CustomerNotification" ("id","customerId","type","title","body","importance","actionType","actionPayload","significant","createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,'OPEN_PRIVATE_CHANNEL',$7::jsonb,TRUE,$8)`,
      id, attempt.customerId, type, notification.title, notification.body, notification.importance, JSON.stringify(payload), now,
    );
    await this.#queueVerifiedEmail(attempt.customerId, id, notification);
    return { id };
  }

  async #queueVerifiedEmail(customerId, notificationId, notification) {
    if (!this.crmRuntime?.queueNotification) return;
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT "email" FROM "CustomerEmailVerification" WHERE "customerId"=$1 AND "status"='VERIFIED' ORDER BY "verifiedAt" DESC LIMIT 1`,
      customerId,
    );
    if (!rows[0]?.email) return;
    await this.crmRuntime.queueNotification(customerId, { channel: 'EMAIL', subject: notification.title, body: notification.body }, {
      actorId: 'system', authMethod: 'system', correlationId: `private-channel-renewal:${notificationId}`, idempotencyKey: `private-channel-renewal-email:${notificationId}`,
    });
  }
}

module.exports = { PrivateChannelRecoveryService };
