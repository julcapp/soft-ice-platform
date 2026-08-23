const { randomUUID } = require('crypto');

class AdminOperationsEscalationDeliveryService {
  constructor({ prisma, specialistDirectory, ownerUserId = process.env.OPERATIONS_PLATFORM_OWNER_USER_ID || null, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    if (!specialistDirectory) throw new Error('specialistDirectory is required');
    this.prisma = prisma;
    this.specialistDirectory = specialistDirectory;
    this.ownerUserId = ownerUserId;
    this.clock = clock;
  }

  async run({ limit = 100 } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 300);
    const escalations = await this.prisma.$queryRawUnsafe(
      `SELECT e."id",e."workItemId",e."level",e."recipientSubject",e."recipientDisplayName",e."reason",e."status",e."createdAt",
              w."notificationKey",w."title",w."message",w."deepLink",w."severity",w."assigneeDisplayName"
       FROM "AdminOperationsEscalation" e JOIN "AdminOperationsWorkItem" w ON w."id"=e."workItemId"
       WHERE e."status"='OPEN' ORDER BY e."createdAt" ASC LIMIT $1`, safeLimit,
    );
    const results = [];
    for (const escalation of escalations) results.push(await this.#process(escalation));
    return {
      checked: escalations.length,
      queued: results.reduce((sum, item) => sum + item.queued, 0),
      blocked: results.reduce((sum, item) => sum + item.blocked, 0),
      failed: results.reduce((sum, item) => sum + item.failed, 0),
      results,
    };
  }

  async #process(escalation) {
    const recipientCustomerId = await this.#recipientCustomerId(escalation.recipientSubject);
    if (!recipientCustomerId) {
      await this.#record(escalation.id, 'SYSTEM', null, 'BLOCKED', 'RECIPIENT_NOT_LINKED', 'Получатель эскалации не связан с platform user.');
      return { escalationId: escalation.id, queued: 0, blocked: 1, failed: 0 };
    }
    const channels = await this.#eligibleChannels(recipientCustomerId);
    if (!channels.length) {
      await this.#record(escalation.id, 'SYSTEM', recipientCustomerId, 'BLOCKED', 'NO_VERIFIED_CHANNEL', 'Нет подтверждённого активного Telegram/MAX канала для служебной эскалации.');
      return { escalationId: escalation.id, queued: 0, blocked: 1, failed: 0 };
    }
    let queued = 0; let failed = 0;
    for (const channel of channels) {
      try {
        const crmDeliveryId = await this.#queueCrm(escalation, recipientCustomerId, channel);
        await this.#record(escalation.id, channel, recipientCustomerId, 'QUEUED', null, null, crmDeliveryId);
        queued += 1;
      } catch (error) {
        await this.#record(escalation.id, channel, recipientCustomerId, 'FAILED', error.code || 'QUEUE_FAILED', error.message || 'Не удалось поставить эскалацию в очередь.');
        failed += 1;
      }
    }
    return { escalationId: escalation.id, queued, blocked: 0, failed };
  }

  async #recipientCustomerId(subject) {
    const value = String(subject || '').trim();
    if (!value) return null;
    if (value === 'role:PLATFORM_OWNER') return this.ownerUserId || null;
    if (value.startsWith('organization-member:')) {
      const profile = await this.specialistDirectory.getBySubject(value);
      return profile?.platformUserId || null;
    }
    return value;
  }

  async #eligibleChannels(customerId) {
    const [subscriptions, profiles, customerRows] = await Promise.all([
      this.prisma.$queryRawUnsafe(`SELECT "channelType" FROM "CustomerChannelSubscription" WHERE "customerId"=$1 AND "isSubscribed"=TRUE AND UPPER("channelType") IN ('TELEGRAM','MAX')`, customerId),
      this.prisma.$queryRawUnsafe(`SELECT "channelType","externalUserId","isVerified","status" FROM "CustomerExternalProfile" WHERE "customerId"=$1 AND UPPER("channelType") IN ('TELEGRAM','MAX')`, customerId),
      this.prisma.$queryRawUnsafe(`SELECT "telegramId" FROM "Customer" WHERE "id"=$1 LIMIT 1`, customerId),
    ]);
    const active = new Set(subscriptions.map((row) => String(row.channelType).toUpperCase()));
    const verified = new Set(profiles.filter((row) => row.isVerified && row.externalUserId).map((row) => String(row.channelType).toUpperCase()));
    if (customerRows[0]?.telegramId) verified.add('TELEGRAM');
    return ['TELEGRAM', 'MAX'].filter((channel) => active.has(channel) && verified.has(channel));
  }

  async #queueCrm(escalation, customerId, channel) {
    const idempotencyKey = `ops-escalation:${escalation.id}:${channel}`;
    const existing = await this.prisma.$queryRawUnsafe(`SELECT "id" FROM "CrmNotificationDelivery" WHERE "idempotencyKey"=$1 LIMIT 1`, idempotencyKey);
    if (existing[0]) return existing[0].id;
    const id = randomUUID();
    const now = this.clock();
    const body = [`Эскалация L${escalation.level}: ${escalation.title}`, escalation.message, escalation.reason, escalation.deepLink ? `Раздел: ${escalation.deepLink}` : null].filter(Boolean).join('\n');
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "CrmNotificationDelivery" ("id","customerId","channel","subject","body","status","idempotencyKey","correlationId","createdBy","createdAt") VALUES ($1,$2,$3,$4,$5,'QUEUED',$6,$7,'operations-escalation',$8)`,
      id, customerId, channel, `У Тимоши · эскалация L${escalation.level}`, body, idempotencyKey, escalation.id, now,
    );
    return id;
  }

  async #record(escalationId, channel, recipientCustomerId, status, failureCode, failureMessage, crmDeliveryId = null) {
    const now = this.clock();
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO "AdminOperationsEscalationDelivery" ("id","escalationId","recipientCustomerId","channel","status","crmDeliveryId","failureCode","failureMessage","attemptCount","lastAttemptAt","queuedAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9,CASE WHEN $5='QUEUED' THEN $9 ELSE NULL END,$9,$9) ON CONFLICT ("escalationId","channel") DO UPDATE SET "recipientCustomerId"=EXCLUDED."recipientCustomerId","status"=EXCLUDED."status","crmDeliveryId"=COALESCE(EXCLUDED."crmDeliveryId","AdminOperationsEscalationDelivery"."crmDeliveryId"),"failureCode"=EXCLUDED."failureCode","failureMessage"=EXCLUDED."failureMessage","attemptCount"="AdminOperationsEscalationDelivery"."attemptCount"+1,"lastAttemptAt"=EXCLUDED."lastAttemptAt","queuedAt"=COALESCE("AdminOperationsEscalationDelivery"."queuedAt",EXCLUDED."queuedAt"),"updatedAt"=EXCLUDED."updatedAt"`,
      randomUUID(), escalationId, recipientCustomerId, channel, status, crmDeliveryId, failureCode, failureMessage, now,
    );
  }
}

module.exports = { AdminOperationsEscalationDeliveryService };
