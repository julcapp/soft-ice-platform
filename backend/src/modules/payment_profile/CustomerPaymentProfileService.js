const { createHash } = require('crypto');
const { ApiError } = require('../../platform/errors/ApiError');

class CustomerPaymentProfileService {
  constructor({ prisma }) {
    if (!prisma) throw new Error('prisma is required');
    this.prisma = prisma;
  }

  async get(customerId) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
    if (!customer) throw new ApiError({ statusCode: 404, code: 'CUSTOMER_NOT_FOUND', message: 'Customer was not found.', source: 'payment_profile' });

    const [payments, privatePayments, subscriptions] = await Promise.all([
      this.prisma.$queryRawUnsafe(
        `SELECT "id","amountRub","currency","provider","providerPaymentId","providerStatus","status","description","createdAt","confirmedAt","canceledAt"
         FROM "Payment" WHERE "customerId"=$1 ORDER BY "createdAt" DESC LIMIT 100`,
        customerId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT pp."id",pp."amountRub",pp."provider",pp."providerPaymentId",pp."paymentKind",pp."status",pp."periodStart",pp."periodEnd",pp."paidAt",pp."failedAt",pp."createdAt",
                s."id" AS "subscriptionId",p."code" AS "planCode",p."channelType"
         FROM "PrivateChannelPayment" pp
         JOIN "PrivateChannelSubscription" s ON s."id"=pp."subscriptionId"
         JOIN "PrivateChannelPlan" p ON p."id"=s."planId"
         WHERE pp."customerId"=$1 ORDER BY pp."createdAt" DESC LIMIT 100`,
        customerId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT s."id",s."status",s."currentPeriodStart",s."currentPeriodEnd",s."recurringEnabled",s."recurringConsentAt",s."recurringConsentVersion",
                s."providerPaymentMethodRef",s."cancelAtPeriodEnd",s."cancelledAt",s."createdAt",s."updatedAt",
                p."code" AS "planCode",p."name" AS "planName",p."channelType",p."priceRub",p."billingPeriodDays"
         FROM "PrivateChannelSubscription" s
         JOIN "PrivateChannelPlan" p ON p."id"=s."planId"
         WHERE s."customerId"=$1 ORDER BY s."createdAt" DESC`,
        customerId,
      ),
    ]);

    const recurringSubscriptions = subscriptions.map((row) => ({
      id: row.id,
      planCode: row.planCode,
      planName: row.planName,
      channelType: row.channelType,
      status: row.status,
      priceRub: Number(row.priceRub || 0),
      billingPeriodDays: Number(row.billingPeriodDays || 0),
      currentPeriodStart: row.currentPeriodStart,
      currentPeriodEnd: row.currentPeriodEnd,
      recurringEnabled: Boolean(row.recurringEnabled),
      cancelAtPeriodEnd: Boolean(row.cancelAtPeriodEnd),
      cancelledAt: row.cancelledAt,
      recurringConsent: row.recurringConsentAt ? {
        grantedAt: row.recurringConsentAt,
        version: row.recurringConsentVersion,
        hasSavedPaymentMethod: Boolean(row.providerPaymentMethodRef),
      } : null,
      paymentMethod: row.providerPaymentMethodRef ? safePaymentMethod(row.providerPaymentMethodRef, 'YOOKASSA') : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));

    const methodsByFingerprint = new Map();
    for (const item of recurringSubscriptions) {
      if (item.paymentMethod) methodsByFingerprint.set(item.paymentMethod.fingerprint, item.paymentMethod);
    }

    const history = [
      ...payments.map((row) => ({
        id: `payment:${row.id}`,
        source: 'PAYMENT',
        paymentId: row.id,
        provider: String(row.provider || 'UNKNOWN').toUpperCase(),
        providerPaymentRef: maskReference(row.providerPaymentId),
        kind: 'ONE_TIME',
        amountRub: Number(row.amountRub || 0),
        currency: row.currency || 'RUB',
        status: String(row.status || row.providerStatus || 'UNKNOWN').toUpperCase(),
        description: row.description || null,
        occurredAt: row.confirmedAt || row.canceledAt || row.createdAt,
      })),
      ...privatePayments.map((row) => ({
        id: `private:${row.id}`,
        source: 'PRIVATE_CHANNEL',
        paymentId: row.id,
        subscriptionId: row.subscriptionId,
        channelType: row.channelType,
        planCode: row.planCode,
        provider: String(row.provider || 'YOOKASSA').toUpperCase(),
        providerPaymentRef: maskReference(row.providerPaymentId),
        kind: row.paymentKind || 'UNKNOWN',
        amountRub: Number(row.amountRub || 0),
        currency: 'RUB',
        status: String(row.status || 'UNKNOWN').toUpperCase(),
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        occurredAt: row.paidAt || row.failedAt || row.createdAt,
      })),
    ].sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0));

    return {
      customerId,
      paymentMethods: [...methodsByFingerprint.values()],
      recurringSubscriptions,
      paymentHistory: history,
      security: {
        cardCredentialsStored: false,
        fullProviderPaymentMethodReferenceExposed: false,
        note: 'PAN/CVV and full provider payment method references are not exposed in the admin UI.',
      },
    };
  }
}

function safePaymentMethod(reference, provider) {
  const value = String(reference || '');
  return {
    provider,
    type: 'SAVED_PROVIDER_METHOD',
    maskedReference: maskReference(value),
    fingerprint: createHash('sha256').update(`${provider}:${value}`).digest('hex').slice(0, 16),
  };
}

function maskReference(value) {
  const text = String(value || '');
  if (!text) return null;
  if (text.length <= 8) return `${text.slice(0, 2)}••••${text.slice(-2)}`;
  return `${text.slice(0, 4)}••••••${text.slice(-4)}`;
}

module.exports = { CustomerPaymentProfileService, maskReference, safePaymentMethod };
