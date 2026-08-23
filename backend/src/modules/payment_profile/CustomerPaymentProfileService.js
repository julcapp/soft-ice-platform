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

    const [payments, privatePayments, subscriptions, receipts, refunds, providerCosts] = await Promise.all([
      this.prisma.$queryRawUnsafe(
        `SELECT "id","clubTopupId","amountRub","currency","provider","providerPaymentId","providerStatus","status","description","metadata","createdAt","confirmedAt","canceledAt"
         FROM "Payment" WHERE "customerId"=$1 ORDER BY "createdAt" DESC LIMIT 100`,
        customerId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT pp."id",pp."amountRub",pp."provider",pp."providerPaymentId",pp."paymentKind",pp."paymentMethodType",pp."status",pp."periodStart",pp."periodEnd",pp."paidAt",pp."failedAt",pp."createdAt",
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
      this.prisma.$queryRawUnsafe(
        `SELECT "id","paymentSourceType","paymentSourceId","orderId","subscriptionId","provider","providerReceiptId","receiptType","status","amountRub","currency",
                "fiscalDocumentNumber","fiscalDriveNumber","fiscalSign","receiptUrl","customerEmail","issuedAt","createdAt"
         FROM "PaymentReceipt" WHERE "customerId"=$1 ORDER BY "createdAt" DESC LIMIT 100`,
        customerId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "id","paymentSourceType","paymentSourceId","orderId","subscriptionId","provider","providerRefundId","status","amountRub","currency","reason","requestedAt","succeededAt","failedAt","createdAt"
         FROM "PaymentRefund" WHERE "customerId"=$1 ORDER BY "createdAt" DESC LIMIT 100`,
        customerId,
      ),
      this.prisma.$queryRawUnsafe(
        `SELECT "paymentSourceType","paymentSourceId","grossAmountRub","netSettlementRub","processorCostTotalRub","processorCommissionRub","processorCommissionVatRub","commissionRatePct","calculationSource","isFinal"
         FROM "PaymentProviderCost" WHERE "customerId"=$1 ORDER BY "occurredAt" DESC LIMIT 100`,
        customerId,
      ),
    ]);

    const costMap = new Map(providerCosts.map((row) => [`${String(row.paymentSourceType).toUpperCase()}:${row.paymentSourceId}`, paymentEconomics(row)]));

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
        linkedEntity: resolvePlatformPaymentLink(row),
        provider: String(row.provider || 'UNKNOWN').toUpperCase(),
        providerPaymentRef: maskReference(row.providerPaymentId),
        kind: 'ONE_TIME',
        paymentMethodType: normalizePaymentMethodType(row.metadata?.payment_method?.type || row.metadata?.paymentMethodType || null),
        amountRub: Number(row.amountRub || 0),
        currency: row.currency || 'RUB',
        status: String(row.status || row.providerStatus || 'UNKNOWN').toUpperCase(),
        description: row.description || null,
        economics: costMap.get(`PAYMENT:${row.id}`) || null,
        occurredAt: row.confirmedAt || row.canceledAt || row.createdAt,
      })),
      ...privatePayments.map((row) => ({
        id: `private:${row.id}`,
        source: 'PRIVATE_CHANNEL',
        paymentId: row.id,
        subscriptionId: row.subscriptionId,
        linkedEntity: { type: 'PRIVATE_CHANNEL_SUBSCRIPTION', id: row.subscriptionId },
        channelType: row.channelType,
        planCode: row.planCode,
        provider: String(row.provider || 'YOOKASSA').toUpperCase(),
        providerPaymentRef: maskReference(row.providerPaymentId),
        kind: row.paymentKind || 'UNKNOWN',
        paymentMethodType: normalizePaymentMethodType(row.paymentMethodType),
        amountRub: Number(row.amountRub || 0),
        currency: 'RUB',
        status: String(row.status || 'UNKNOWN').toUpperCase(),
        economics: costMap.get(`PRIVATE_CHANNEL:${row.id}`) || null,
        periodStart: row.periodStart,
        periodEnd: row.periodEnd,
        occurredAt: row.paidAt || row.failedAt || row.createdAt,
      })),
    ].sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0));

    const receiptHistory = receipts.map((row) => ({
      id: row.id,
      sourceType: row.paymentSourceType,
      sourceId: row.paymentSourceId,
      linkedEntity: linkedEntity(row.orderId, row.subscriptionId),
      provider: String(row.provider || 'UNKNOWN').toUpperCase(),
      providerReceiptRef: maskReference(row.providerReceiptId),
      receiptType: row.receiptType,
      status: String(row.status || 'UNKNOWN').toUpperCase(),
      amountRub: Number(row.amountRub || 0),
      currency: row.currency || 'RUB',
      fiscalDocumentNumber: row.fiscalDocumentNumber || null,
      fiscalDriveNumber: row.fiscalDriveNumber ? maskReference(row.fiscalDriveNumber) : null,
      fiscalSign: row.fiscalSign ? maskReference(row.fiscalSign) : null,
      receiptUrl: row.receiptUrl || null,
      customerEmail: maskEmail(row.customerEmail),
      issuedAt: row.issuedAt,
      createdAt: row.createdAt,
    }));

    const refundHistory = refunds.map((row) => ({
      id: row.id,
      sourceType: row.paymentSourceType,
      sourceId: row.paymentSourceId,
      linkedEntity: linkedEntity(row.orderId, row.subscriptionId),
      provider: String(row.provider || 'UNKNOWN').toUpperCase(),
      providerRefundRef: maskReference(row.providerRefundId),
      status: String(row.status || 'UNKNOWN').toUpperCase(),
      amountRub: Number(row.amountRub || 0),
      currency: row.currency || 'RUB',
      reason: row.reason || null,
      requestedAt: row.requestedAt,
      succeededAt: row.succeededAt,
      failedAt: row.failedAt,
      createdAt: row.createdAt,
    }));

    return {
      customerId,
      paymentMethods: [...methodsByFingerprint.values()],
      recurringSubscriptions,
      paymentHistory: history,
      receiptHistory,
      refundHistory,
      security: {
        cardCredentialsStored: false,
        fullProviderPaymentMethodReferenceExposed: false,
        fullFiscalDeviceIdentifiersExposed: false,
        note: 'PAN/CVV, full provider payment method references and full fiscal-device identifiers are not exposed in the admin UI.',
      },
    };
  }
}

function paymentEconomics(row) {
  return {
    grossAmountRub: Number(row.grossAmountRub || 0),
    providerCostTotalRub: Number(row.processorCostTotalRub || 0),
    providerCommissionRub: row.processorCommissionRub == null ? null : Number(row.processorCommissionRub),
    providerCommissionVatRub: row.processorCommissionVatRub == null ? null : Number(row.processorCommissionVatRub),
    commissionRatePct: row.commissionRatePct == null ? null : Number(row.commissionRatePct),
    netSettlementRub: Number(row.netSettlementRub || 0),
    calculationSource: row.calculationSource,
    isFinal: Boolean(row.isFinal),
  };
}
function resolvePlatformPaymentLink(row) {
  const metadata = row.metadata || {};
  if (metadata.orderId || metadata.order_id) return { type: 'ORDER', id: metadata.orderId || metadata.order_id };
  if (row.clubTopupId) return { type: 'CLUB_TOPUP', id: row.clubTopupId };
  return null;
}
function linkedEntity(orderId, subscriptionId) {
  if (orderId) return { type: 'ORDER', id: orderId };
  if (subscriptionId) return { type: 'PRIVATE_CHANNEL_SUBSCRIPTION', id: subscriptionId };
  return null;
}
function normalizePaymentMethodType(value) {
  const type = String(value || '').trim().toUpperCase();
  if (!type) return 'UNKNOWN';
  if (['SBP', 'SBERBANK', 'TINKOFF_BANK', 'MOBILE_BALANCE'].includes(type)) return type;
  if (['BANK_CARD', 'CARD'].includes(type)) return 'BANK_CARD';
  if (['CLUB_BALANCE', 'INTERNAL_BALANCE'].includes(type)) return 'CLUB_BALANCE';
  return type;
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
function maskEmail(value) {
  const email = String(value || '');
  const [local, domain] = email.split('@');
  if (!local || !domain) return null;
  return `${local.slice(0, 2)}•••@${domain}`;
}

module.exports = { CustomerPaymentProfileService, maskReference, safePaymentMethod, normalizePaymentMethodType, maskEmail, paymentEconomics };
