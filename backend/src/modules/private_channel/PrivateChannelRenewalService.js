const { createHash, randomUUID } = require('crypto');

class PrivateChannelRenewalService {
  constructor({
    prisma,
    paymentAdapter,
    clock = () => new Date(),
    graceHours = Number(process.env.PRIVATE_CHANNEL_GRACE_HOURS || 72),
    maxAttempts = Number(process.env.PRIVATE_CHANNEL_RENEWAL_MAX_ATTEMPTS || 3),
    retryHours = parseRetryHours(process.env.PRIVATE_CHANNEL_RENEWAL_RETRY_HOURS || '6,24'),
  }) {
    if (!prisma) throw new Error('prisma is required');
    if (!paymentAdapter) throw new Error('paymentAdapter is required');
    this.prisma = prisma;
    this.paymentAdapter = paymentAdapter;
    this.clock = clock;
    this.graceHours = Number.isFinite(graceHours) && graceHours >= 0 ? graceHours : 72;
    this.maxAttempts = Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3;
    this.retryHours = retryHours.length ? retryHours : [6, 24];
  }

  async listDue({ limit = 100 } = {}) {
    const now = this.clock();
    return this.prisma.$queryRawUnsafe(
      `SELECT s.*, p."code" AS "planCode", p."name" AS "planName", p."priceRub", p."billingPeriodDays"
       FROM "PrivateChannelSubscription" s
       JOIN "PrivateChannelPlan" p ON p."id"=s."planId"
       WHERE s."status"='ACTIVE'
         AND s."recurringEnabled"=TRUE
         AND s."cancelAtPeriodEnd"=FALSE
         AND s."providerPaymentMethodRef" IS NOT NULL
         AND s."currentPeriodEnd" IS NOT NULL
         AND s."currentPeriodEnd" <= $1
       ORDER BY s."currentPeriodEnd" ASC
       LIMIT $2`,
      now, Math.min(Math.max(Number(limit) || 100, 1), 500),
    );
  }

  async processDue({ limit = 100 } = {}) {
    const rows = await this.listDue({ limit });
    const results = [];
    for (const subscription of rows) results.push(await this.processOne(subscription));
    return results;
  }

  async processOne(subscription) {
    const now = this.clock();
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const graceUntil = new Date(periodEnd.getTime() + this.graceHours * 60 * 60 * 1000);
    const rows = await this.prisma.$queryRawUnsafe(
      'SELECT * FROM "PrivateChannelRenewalAttempt" WHERE "subscriptionId"=$1 AND "periodEnd"=$2 LIMIT 1',
      subscription.id, periodEnd,
    );
    let cycle = rows[0] || null;

    if (cycle?.status === 'PAID' || cycle?.status === 'AWAITING_WEBHOOK' || cycle?.status === 'PROCESSING' || cycle?.status === 'EXHAUSTED') {
      return { ...cycle, idempotentReplay: true };
    }
    if (cycle?.status === 'FAILED' && cycle.nextRetryAt && new Date(cycle.nextRetryAt) > now) {
      return { ...cycle, deferred: true };
    }
    if (now >= graceUntil || Number(cycle?.attemptCount || 0) >= this.maxAttempts) {
      if (cycle && cycle.status !== 'EXHAUSTED') {
        await this.prisma.$executeRawUnsafe(
          'UPDATE "PrivateChannelRenewalAttempt" SET "status"=\'EXHAUSTED\', "nextRetryAt"=NULL, "graceUntil"=$2, "resolvedAt"=$3, "updatedAt"=$3 WHERE "id"=$1',
          cycle.id, graceUntil, now,
        );
      }
      return { ...(cycle || {}), subscriptionId: subscription.id, planCode: subscription.planCode, status: 'EXHAUSTED', graceUntil };
    }

    const attemptCount = Number(cycle?.attemptCount || 0) + 1;
    const idempotencyKey = renewalKey(subscription.id, periodEnd, attemptCount);
    const id = cycle?.id || randomUUID();
    if (!cycle) {
      await this.prisma.$executeRawUnsafe(
        'INSERT INTO "PrivateChannelRenewalAttempt" ("id","subscriptionId","customerId","planCode","periodEnd","provider","status","attemptCount","idempotencyKey","attemptedAt","graceUntil","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,\'YOOKASSA\',\'PROCESSING\',$6,$7,$8,$9,$8,$8)',
        id, subscription.id, subscription.customerId, subscription.planCode, periodEnd, attemptCount, idempotencyKey, now, graceUntil,
      );
    } else {
      await this.prisma.$executeRawUnsafe(
        'UPDATE "PrivateChannelRenewalAttempt" SET "status"=\'PROCESSING\', "attemptCount"=$2, "idempotencyKey"=$3, "providerPaymentId"=NULL, "failureCode"=NULL, "failureMessage"=NULL, "attemptedAt"=$4, "nextRetryAt"=NULL, "graceUntil"=$5, "resolvedAt"=NULL, "updatedAt"=$4 WHERE "id"=$1',
        id, attemptCount, idempotencyKey, now, graceUntil,
      );
    }

    try {
      const payment = await this.paymentAdapter.createRecurringPayment({ subscription, plan: subscription, idempotencyKey });
      await this.prisma.$executeRawUnsafe(
        'UPDATE "PrivateChannelRenewalAttempt" SET "status"=\'AWAITING_WEBHOOK\', "providerPaymentId"=$2, "updatedAt"=$3 WHERE "id"=$1',
        id, payment.providerPaymentId || null, now,
      );
      return { id, subscriptionId: subscription.id, planCode: subscription.planCode, status: 'AWAITING_WEBHOOK', attemptCount, providerPaymentId: payment.providerPaymentId || null, idempotencyKey, graceUntil };
    } catch (error) {
      const retryDelayHours = this.retryHours[Math.min(attemptCount - 1, this.retryHours.length - 1)];
      const candidateRetryAt = new Date(now.getTime() + retryDelayHours * 60 * 60 * 1000);
      const canRetry = attemptCount < this.maxAttempts && candidateRetryAt < graceUntil;
      const nextRetryAt = canRetry ? candidateRetryAt : null;
      const status = canRetry ? 'FAILED' : 'EXHAUSTED';
      await this.prisma.$executeRawUnsafe(
        'UPDATE "PrivateChannelRenewalAttempt" SET "status"=$2, "failureCode"=$3, "failureMessage"=$4, "nextRetryAt"=$5, "graceUntil"=$6, "resolvedAt"=$7, "updatedAt"=$7 WHERE "id"=$1',
        id, status, String(error.code || 'RENEWAL_FAILED').slice(0, 120), String(error.message || 'Renewal failed').slice(0, 500), nextRetryAt, graceUntil, now,
      );
      return { id, subscriptionId: subscription.id, planCode: subscription.planCode, status, attemptCount, nextRetryAt, graceUntil, errorCode: error.code || 'RENEWAL_FAILED' };
    }
  }

  async markPaid(providerPaymentId) {
    if (!providerPaymentId) return { changed: false };
    const now = this.clock();
    const affected = await this.prisma.$executeRawUnsafe(
      'UPDATE "PrivateChannelRenewalAttempt" SET "status"=\'PAID\', "resolvedAt"=$2, "nextRetryAt"=NULL, "failureCode"=NULL, "failureMessage"=NULL, "updatedAt"=$2 WHERE "providerPaymentId"=$1 AND "status" IN (\'PROCESSING\',\'AWAITING_WEBHOOK\',\'FAILED\')',
      providerPaymentId, now,
    );
    return { changed: Number(affected) > 0, providerPaymentId, resolvedAt: now };
  }

  async listRecovery({ limit = 100 } = {}) {
    const now = this.clock();
    return this.prisma.$queryRawUnsafe(
      `SELECT a.*, s."currentPeriodEnd", s."recurringEnabled", s."cancelAtPeriodEnd"
       FROM "PrivateChannelRenewalAttempt" a
       JOIN "PrivateChannelSubscription" s ON s."id"=a."subscriptionId"
       WHERE a."status" IN ('FAILED','EXHAUSTED')
         AND (a."graceUntil" IS NULL OR a."graceUntil" <= $1 OR a."status"='EXHAUSTED')
       ORDER BY a."periodEnd" ASC
       LIMIT $2`,
      now, Math.min(Math.max(Number(limit) || 100, 1), 500),
    );
  }
}

function renewalKey(subscriptionId, periodEnd, attempt = 1) {
  const hash = createHash('sha256').update(`${subscriptionId}:${new Date(periodEnd).toISOString()}:${attempt}`).digest('hex').slice(0, 44);
  return `renew:${attempt}:${hash}`;
}
function parseRetryHours(value) {
  return String(value || '').split(',').map((item) => Number(item.trim())).filter((item) => Number.isFinite(item) && item > 0);
}

module.exports = { PrivateChannelRenewalService, renewalKey, parseRetryHours };
