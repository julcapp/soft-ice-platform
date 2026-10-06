const express = require('express');
const crypto = require('node:crypto');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createPaymentWebhookRouter({ paymentService }) {
  const router = express.Router();
  router.post('/:provider', async (req, res, next) => { try {
    const received = await paymentService.receiveWebhook({
      provider: String(req.params.provider).toUpperCase(),
      headers: req.headers,
      rawBody: req.rawBody,
      body: req.body,
    });
    res.status(received.duplicate ? 200 : 202).json({
      data: { accepted: true, duplicate: received.duplicate, inboxId: received.inbox.id },
    });
  } catch (error) { next(error); } });
  return router;
}

function createPaymentRouter({ paymentRepository, paymentCheckoutService, adminAuth = {} }) {
  const router = express.Router();
  router.use(createAdminAuthenticator(adminAuth));

  const scope = (req) => {
    const roles = req.securityContext.roles || [];
    const platform = roles.includes('PLATFORM_OWNER');
    const trusted = req.securityContext.organization_id
      || (req.securityContext.auth_method === 'development_header' ? req.get('X-Organization-Id') : null);
    const requested = req.query.organizationId || req.get('X-Organization-Id') || null;
    if (!platform && (!trusted || (requested && requested !== trusted))) throw forbidden();
    return { platform, organizationId: platform ? requested : trusted };
  };

  router.get('/', async (req, res, next) => { try {
    const tenant = scope(req);
    const items = await paymentRepository.list(req.query, tenant);
    const data = [];
    for (const item of items) data.push(await presentWithEconomics(paymentRepository.prisma, item));
    res.json({ data });
  } catch (error) { next(error); } });

  router.get('/:id', async (req, res, next) => { try {
    const tenant = scope(req);
    const item = tenant.organizationId
      ? await paymentRepository.getById(tenant.organizationId, req.params.id)
      : await paymentRepository.prisma.payment.findUnique({
        where: { id: req.params.id },
        include: { refunds: true, reconciliationItems: true },
      });
    if (!item) return res.status(404).json({ error: { code: 'PAYMENT_NOT_FOUND', message: 'Платёж не найден.' } });
    res.json({ data: await presentWithEconomics(paymentRepository.prisma, item) });
  } catch (error) { next(error); } });

  router.post('/:id/refunds', async (req, res, next) => { try {
    if (!paymentCheckoutService) throw unavailable('PAYMENT_CHECKOUT_NOT_AVAILABLE', 'Платёжный runtime недоступен.');
    const tenant = scope(req);
    if (!tenant.organizationId) throw forbidden();
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim()
      || 'admin-refund:' + req.params.id + ':' + crypto.randomUUID();
    const result = await paymentCheckoutService.submitRefund({
      organizationId: tenant.organizationId,
      paymentId: req.params.id,
      idempotencyKey,
      amount: req.body?.amount,
      reason: String(req.body?.reason || 'Возврат платежа').slice(0, 500),
    }, {
      actorType: 'ADMIN',
      actorId: req.securityContext.subject_id || req.securityContext.admin_user_id || null,
      correlationId: req.correlationId,
    });
    res.status(202).json({ data: presentRefund(result.refund), meta: { verified: Boolean(result.verified) } });
  } catch (error) { next(error); } });

  router.post('/refunds/:refundId/refresh', async (req, res, next) => { try {
    if (!paymentCheckoutService) throw unavailable('PAYMENT_CHECKOUT_NOT_AVAILABLE', 'Платёжный runtime недоступен.');
    const tenant = scope(req);
    if (!tenant.organizationId) throw forbidden();
    const result = await paymentCheckoutService.refreshRefund({
      organizationId: tenant.organizationId,
      refundId: req.params.refundId,
    }, {
      actorType: 'ADMIN',
      actorId: req.securityContext.subject_id || req.securityContext.admin_user_id || null,
      correlationId: req.correlationId,
    });
    res.json({ data: presentRefund(result.refund), meta: { verified: Boolean(result.verified) } });
  } catch (error) { next(error); } });

  return router;
}

async function presentWithEconomics(prisma, value) {
  const [economics, saleContext] = await Promise.all([loadEconomics(prisma, value), loadSaleContext(prisma, value)]);
  return {
    id: value.id,
    orderId: value.orderId,
    saleFlowId: value.saleFlowId,
    customerId: value.customerId,
    organizationId: value.organizationId,
    provider: value.provider,
    status: value.status,
    amount: String(value.amount),
    currency: value.currency,
    channel: value.channel || saleContext?.channel || null,
    machineId: saleContext?.machineId || null,
    locationId: saleContext?.locationId || null,
    paymentMethodType: value.paymentMethodType || null,
    providerStatus: value.providerStatus || null,
    providerReference: value.providerPaymentId,
    confirmationUrl: value.confirmationUrl || null,
    failureCode: value.failureCode || null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    pendingAt: value.pendingAt,
    succeededAt: value.succeededAt,
    failedAt: value.failedAt,
    canceledAt: value.canceledAt,
    refundedAt: value.refundedAt,
    reconciliationStatus: value.reconciliationItems?.some((x) => ['OPEN', 'MANUAL_REVIEW'].includes(x.status))
      ? 'ТРЕБУЕТ ПРОВЕРКИ'
      : 'РАСХОЖДЕНИЙ НЕТ',
    economics,
    refundSummary: summarizeRefunds(value),
    refunds: (value.refunds || []).map(presentRefund),
  };
}

async function loadSaleContext(prisma, payment) {
  if (!payment.saleFlowId) return null;
  const flow = await prisma.saleFlow.findFirst({
    where: { flowId: payment.saleFlowId, organizationId: payment.organizationId },
    select: { machineId: true, locationId: true, metadata: true },
  });
  return {
    machineId: flow?.machineId || null,
    locationId: flow?.locationId || null,
    channel: flow?.metadata?.channel || null,
  };
}

async function loadEconomics(prisma, payment) {
  const gross = Number(payment.amount || 0);
  const income = payment.incomeAmount == null ? null : Number(payment.incomeAmount);
  const provisionalCost = income == null ? null : round(gross - income);
  try {
    const rows = await prisma.$queryRawUnsafe(
      'SELECT "grossAmountRub","netSettlementRub","processorCostTotalRub","processorCommissionRub","processorCommissionVatRub","commissionRatePct","calculationSource","isFinal" FROM "PaymentProviderCost" WHERE "paymentSourceType"=$1 AND "paymentSourceId"=$2 LIMIT 1',
      'PAYMENT',
      payment.id,
    );
    const row = rows[0];
    if (row) {
      return {
        grossAmountRub: Number(row.grossAmountRub || gross),
        netSettlementRub: row.netSettlementRub == null ? null : Number(row.netSettlementRub),
        providerCostTotalRub: row.processorCostTotalRub == null ? null : Number(row.processorCostTotalRub),
        providerCommissionRub: row.processorCommissionRub == null ? null : Number(row.processorCommissionRub),
        providerCommissionVatRub: row.processorCommissionVatRub == null ? null : Number(row.processorCommissionVatRub),
        commissionRatePct: row.commissionRatePct == null ? null : Number(row.commissionRatePct),
        source: row.calculationSource || null,
        final: Boolean(row.isFinal),
      };
    }
  } catch (_) {
    // Financial profile tables can be unavailable before their migration; checkout remains functional.
  }
  return {
    grossAmountRub: gross,
    netSettlementRub: income,
    providerCostTotalRub: provisionalCost,
    providerCommissionRub: null,
    providerCommissionVatRub: null,
    commissionRatePct: null,
    source: income == null ? null : 'PAYMENT_API_INCOME_AMOUNT',
    final: false,
  };
}

function summarizeRefunds(payment) {
  const refunds = payment.refunds || [];
  const succeeded = refunds.filter((item) => item.status === 'SUCCEEDED')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const pending = refunds.filter((item) => ['REQUESTED', 'PENDING'].includes(item.status))
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const gross = Number(payment.amount || 0);
  return {
    succeededAmount: round(succeeded),
    pendingAmount: round(pending),
    availableAmount: round(Math.max(0, gross - succeeded - pending)),
    hasPending: pending > 0,
    refundable: ['SUCCEEDED', 'REFUND_PENDING'].includes(payment.status) && gross - succeeded - pending > 0,
  };
}

function presentRefund(value) {
  if (!value) return null;
  return {
    id: value.id,
    paymentId: value.paymentId,
    providerRefundId: value.providerRefundId || null,
    status: value.status,
    amount: String(value.amount),
    currency: value.currency,
    reason: value.reason,
    failureCode: value.failureCode || null,
    requestedAt: value.requestedAt,
    pendingAt: value.pendingAt,
    succeededAt: value.succeededAt,
    failedAt: value.failedAt,
    createdAt: value.createdAt,
  };
}

function round(value) { return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100; }
function forbidden() { return Object.assign(new Error('Tenant scope обязателен.'), { code: 'PAYMENT_TENANT_SCOPE_REQUIRED', statusCode: 403 }); }
function unavailable(code, message) { return Object.assign(new Error(message), { code, statusCode: 503 }); }

module.exports = { createPaymentRouter, createPaymentWebhookRouter };
