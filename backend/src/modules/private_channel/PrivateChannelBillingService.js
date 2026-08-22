const { randomUUID } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

class PrivateChannelBillingService {
  constructor({ prisma, clock = () => new Date() }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
    this.clock = clock;
  }

  async getPlan(planCode = 'PRIVATE_TELEGRAM_MONTHLY') {
    const rows = await this.prisma.$queryRawUnsafe('SELECT * FROM "PrivateChannelPlan" WHERE "code" = $1 LIMIT 1', String(planCode));
    const plan = rows[0];
    if (!plan) throw new ApiError({ statusCode: 404, code: 'PRIVATE_CHANNEL_PLAN_NOT_FOUND', message: 'Тариф не найден.' });
    return plan;
  }

  async getCustomerSubscription(customerId) {
    const rows = await this.prisma.$queryRawUnsafe('SELECT s.*, p."code" AS "planCode", p."name" AS "planName", p."priceRub", p."billingPeriodDays", p."isActive" AS "planIsActive" FROM "PrivateChannelSubscription" s JOIN "PrivateChannelPlan" p ON p."id"=s."planId" WHERE s."customerId"=$1 ORDER BY s."createdAt" DESC LIMIT 1', customerId);
    return rows[0] || null;
  }

  async subscribe(customerId, request = {}) {
    const plan = await this.getPlan(request.planCode);
    if (!plan.isActive) throw validation('PRIVATE_CHANNEL_PLAN_NOT_ACTIVE', 'Тариф приватного канала пока не активирован.');
    const recurringRequested = request.recurringEnabled === true;
    const consentVersion = recurringRequested ? String(request.recurringConsentVersion || '') : null;
    if (recurringRequested && !consentVersion) throw validation('PRIVATE_CHANNEL_RECURRING_CONSENT_REQUIRED', 'Для автопродления требуется явное согласие пользователя.');

    const id = randomUUID();
    const consentAt = recurringRequested ? this.clock() : null;
    await this.prisma.$executeRawUnsafe(
      'INSERT INTO "PrivateChannelSubscription" ("id","customerId","planId","status","recurringEnabled","recurringConsentAt","recurringConsentVersion","providerPaymentMethodRef","updatedAt") VALUES ($1,$2,$3,\'PENDING\',FALSE,$4,$5,NULL,CURRENT_TIMESTAMP)',
      id, customerId, plan.id, consentAt, consentVersion,
    );
    return { id, customerId, planCode: plan.code, status: 'PENDING', recurringRequested, recurringEnabled: false, recurringConsentAt: consentAt, recurringConsentVersion: consentVersion };
  }

  async recordPayment(request = {}) {
    const subscriptionId = String(request.subscriptionId || '');
    const idempotencyKey = String(request.idempotencyKey || '');
    if (!subscriptionId || !idempotencyKey) throw validation('PRIVATE_CHANNEL_PAYMENT_INVALID', 'Нужны subscriptionId и idempotencyKey.');
    const rows = await this.prisma.$queryRawUnsafe('SELECT s.*, p."priceRub", p."billingPeriodDays" FROM "PrivateChannelSubscription" s JOIN "PrivateChannelPlan" p ON p."id"=s."planId" WHERE s."id"=$1 LIMIT 1', subscriptionId);
    const subscription = rows[0];
    if (!subscription) throw new ApiError({ statusCode: 404, code: 'PRIVATE_CHANNEL_SUBSCRIPTION_NOT_FOUND', message: 'Подписка не найдена.' });

    const existing = await this.prisma.$queryRawUnsafe('SELECT * FROM "PrivateChannelPayment" WHERE "idempotencyKey"=$1 LIMIT 1', idempotencyKey);
    if (existing[0]) return { ...existing[0], idempotentReplay: true };

    const paidAt = this.clock();
    const periodStart = subscription.currentPeriodEnd && new Date(subscription.currentPeriodEnd) > paidAt ? new Date(subscription.currentPeriodEnd) : paidAt;
    const periodEnd = new Date(periodStart); periodEnd.setUTCDate(periodEnd.getUTCDate() + Number(subscription.billingPeriodDays || 30));
    const paymentId = randomUUID();
    const kind = subscription.status === 'ACTIVE' ? 'RENEWAL' : 'INITIAL';
    const amountRub = Number(request.amountRub ?? subscription.priceRub);
    if (!(amountRub > 0)) throw validation('PRIVATE_CHANNEL_PAYMENT_AMOUNT_INVALID', 'Сумма платежа должна быть положительной.');
    const paymentMethodRef = request.providerPaymentMethodRef ? String(request.providerPaymentMethodRef) : null;
    const recurringEnabled = Boolean(subscription.recurringConsentAt && subscription.recurringConsentVersion && paymentMethodRef);

    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('INSERT INTO "PrivateChannelPayment" ("id","subscriptionId","customerId","provider","providerPaymentId","paymentKind","amountRub","status","periodStart","periodEnd","idempotencyKey","paidAt") VALUES ($1,$2,$3,$4,$5,$6,$7,\'PAID\',$8,$9,$10,$11)', paymentId, subscriptionId, subscription.customerId, String(request.provider || 'YOOKASSA'), request.providerPaymentId || null, kind, amountRub, periodStart, periodEnd, idempotencyKey, paidAt);
      await tx.$executeRawUnsafe('UPDATE "PrivateChannelSubscription" SET "status"=\'ACTIVE\', "currentPeriodStart"=$2, "currentPeriodEnd"=$3, "providerPaymentMethodRef"=COALESCE($4,"providerPaymentMethodRef"), "recurringEnabled"=$5, "cancelAtPeriodEnd"=FALSE, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', subscriptionId, periodStart, periodEnd, paymentMethodRef, recurringEnabled);
    });
    return { id: paymentId, subscriptionId, paymentKind: kind, amountRub, status: 'PAID', periodStart, periodEnd, paidAt, recurringEnabled, providerPaymentMethodRef: paymentMethodRef };
  }

  async cancel(customerId, subscriptionId, { atPeriodEnd = true } = {}) {
    const rows = await this.prisma.$queryRawUnsafe('SELECT * FROM "PrivateChannelSubscription" WHERE "id"=$1 AND "customerId"=$2 LIMIT 1', subscriptionId, customerId);
    if (!rows[0]) throw new ApiError({ statusCode: 404, code: 'PRIVATE_CHANNEL_SUBSCRIPTION_NOT_FOUND', message: 'Подписка не найдена.' });
    if (atPeriodEnd) {
      await this.prisma.$executeRawUnsafe('UPDATE "PrivateChannelSubscription" SET "cancelAtPeriodEnd"=TRUE, "recurringEnabled"=FALSE, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', subscriptionId);
      return { id: subscriptionId, status: rows[0].status, cancelAtPeriodEnd: true, recurringEnabled: false };
    }
    const cancelledAt = this.clock();
    await this.prisma.$executeRawUnsafe('UPDATE "PrivateChannelSubscription" SET "status"=\'CANCELLED\', "cancelledAt"=$2, "recurringEnabled"=FALSE, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1', subscriptionId, cancelledAt);
    return { id: subscriptionId, status: 'CANCELLED', cancelledAt, recurringEnabled: false };
  }

  async stats({ from, toExclusive, forecastDays = 30 }) {
    const now = this.clock();
    const forecastTo = new Date(now); forecastTo.setUTCDate(forecastTo.getUTCDate() + forecastDays);
    const [subscriberRows, paymentRows, forecastRows] = await Promise.all([
      this.prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count FROM "PrivateChannelSubscription" WHERE "status"=\'ACTIVE\' AND ("currentPeriodEnd" IS NULL OR "currentPeriodEnd">$1)', now),
      this.prisma.$queryRawUnsafe('SELECT COUNT(*)::int AS count, COALESCE(SUM("amountRub"),0)::float8 AS revenue FROM "PrivateChannelPayment" WHERE "status"=\'PAID\' AND "paidAt">=$1 AND "paidAt"<$2', from, toExclusive),
      this.prisma.$queryRawUnsafe('SELECT COALESCE(SUM(p."priceRub"),0)::float8 AS forecast FROM "PrivateChannelSubscription" s JOIN "PrivateChannelPlan" p ON p."id"=s."planId" WHERE s."status"=\'ACTIVE\' AND s."recurringEnabled"=TRUE AND s."cancelAtPeriodEnd"=FALSE AND s."currentPeriodEnd">=$1 AND s."currentPeriodEnd"<$2', now, forecastTo),
    ]);
    return { subscribers: Number(subscriberRows[0]?.count || 0), paidPaymentsInPeriod: Number(paymentRows[0]?.count || 0), paidAmountRubInPeriod: Number(paymentRows[0]?.revenue || 0), forecastNext30DaysRub: Number(forecastRows[0]?.forecast || 0), status: 'READY' };
  }
}

function validation(code, message) { return new ApiError({ statusCode: 400, code, message, source: 'runtime' }); }
module.exports = { PrivateChannelBillingService };
