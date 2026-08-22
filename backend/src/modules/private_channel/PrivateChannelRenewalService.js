const { createHash, randomUUID } = require('crypto');

class PrivateChannelRenewalService {
  constructor({ prisma, paymentAdapter, clock = () => new Date(), graceHours = Number(process.env.PRIVATE_CHANNEL_GRACE_HOURS || 72) }) {
    if (!prisma) throw new Error('prisma is required');
    if (!paymentAdapter) throw new Error('paymentAdapter is required');
    this.prisma = prisma;
    this.paymentAdapter = paymentAdapter;
    this.clock = clock;
    this.graceHours = Number.isFinite(graceHours) && graceHours >= 0 ? graceHours : 72;
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
    const periodEnd = new Date(subscription.currentPeriodEnd);
    const idempotencyKey = renewalKey(subscription.id, periodEnd);
    const existing = await this.prisma.$queryRawUnsafe('SELECT * FROM "PrivateChannelRenewalAttempt" WHERE "idempotencyKey"=$1 LIMIT 1', idempotencyKey);
    if (existing[0]) return { ...existing[0], idempotentReplay: true };

    const id = randomUUID();
    const now = this.clock();
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO "PrivateChannelRenewalAttempt" ("id","subscriptionId","customerId","planCode","periodEnd","provider","status","idempotencyKey","attemptedAt","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,\'YOOKASSA\',\'PROCESSING\',$6,$7,$7,$7)',
      id, subscription.id, subscription.customerId, subscription.planCode, periodEnd, idempotencyKey, now,
    );

    try {
      const payment = await this.paymentAdapter.createRecurringPayment({ subscription, plan: subscription, idempotencyKey });
      await this.prisma.$executeRawUnsafe(
        'UPDATE "PrivateChannelRenewalAttempt" SET "status"=\'AWAITING_WEBHOOK\', "providerPaymentId"=$2, "updatedAt"=$3 WHERE "id"=$1',
        id, payment.providerPaymentId || null, now,
      );
      return { id, subscriptionId: subscription.id, planCode: subscription.planCode, status: 'AWAITING_WEBHOOK', providerPaymentId: payment.providerPaymentId || null, idempotencyKey };
    } catch (error) {
      const graceUntil = new Date(periodEnd.getTime() + this.graceHours * 60 * 60 * 1000);
      await this.prisma.$executeRawUnsafe(
        'UPDATE "PrivateChannelRenewalAttempt" SET "status"=\'FAILED\', "failureCode"=$2, "failureMessage"=$3, "resolvedAt"=$4, "updatedAt"=$4 WHERE "id"=$1',
        id, String(error.code || 'RENEWAL_FAILED').slice(0, 120), String(error.message || 'Renewal failed').slice(0, 500), now,
      );
      return { id, subscriptionId: subscription.id, planCode: subscription.planCode, status: 'FAILED', graceUntil, errorCode: error.code || 'RENEWAL_FAILED' };
    }
  }

  async markPaid(providerPaymentId) {
    if (!providerPaymentId) return { changed: false };
    const now = this.clock();
    const affected = await this.prisma.$executeRawUnsafe(
      'UPDATE "PrivateChannelRenewalAttempt" SET "status"=\'PAID\', "resolvedAt"=$2, "failureCode"=NULL, "failureMessage"=NULL, "updatedAt"=$2 WHERE "providerPaymentId"=$1 AND "status" IN (\'PROCESSING\',\'AWAITING_WEBHOOK\',\'FAILED\')',
      providerPaymentId, now,
    );
    return { changed: Number(affected) > 0, providerPaymentId, resolvedAt: now };
  }

  async listRecovery({ limit = 100 } = {}) {
    const now = this.clock();
    const graceCutoff = new Date(now.getTime() - this.graceHours * 60 * 60 * 1000);
    return this.prisma.$queryRawUnsafe(
      `SELECT a.*, s."currentPeriodEnd", s."recurringEnabled", s."cancelAtPeriodEnd"
       FROM "PrivateChannelRenewalAttempt" a
       JOIN "PrivateChannelSubscription" s ON s."id"=a."subscriptionId"
       WHERE a."status"='FAILED' AND a."periodEnd" <= $1
       ORDER BY a."periodEnd" ASC
       LIMIT $2`,
      graceCutoff, Math.min(Math.max(Number(limit) || 100, 1), 500),
    );
  }
}

function renewalKey(subscriptionId, periodEnd) {
  return `renew:${createHash('sha256').update(`${subscriptionId}:${new Date(periodEnd).toISOString()}`).digest('hex').slice(0, 48)}`;
}

module.exports = { PrivateChannelRenewalService, renewalKey };
