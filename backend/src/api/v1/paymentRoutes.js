'use strict';

const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');

function createPaymentRouter(dependencies = {}) {
  const router = express.Router();
  const checkout = dependencies.paymentCheckoutService;
  const terminalCheckout = dependencies.terminalCheckoutService;
  const repository = dependencies.paymentRepository;
  const authCoreService = dependencies.authCoreService;

  if (terminalCheckout) {
    router.post('/terminal/checkout', asyncHandler(async (req, res) => {
      const machineId = String(req.body?.machineId || req.body?.machine_id || '').trim();
      const quoteId = String(req.body?.quoteId || req.body?.quote_id || '').trim();
      const purchaseToken = req.body?.purchaseToken || req.body?.purchase_token || null;
      const idempotencyKey = String(req.get('Idempotency-Key') || '').trim() || `terminal:${machineId}:${quoteId}`;
      const result = await terminalCheckout.initiate({
        machineId,
        quoteId,
        purchaseToken,
        method: req.body?.method || 'sbp',
        idempotencyKey,
      }, { correlationId: req.correlationId });
      sendData(res, req, terminalPresent(result), result.userState === 'SUCCESS' ? 200 : 201);
    }));

    router.get('/terminal/:paymentId/status', asyncHandler(async (req, res) => {
      const machineId = String(req.query?.machineId || req.query?.machine_id || '').trim();
      const result = await terminalCheckout.status({ paymentId: req.params.paymentId, machineId }, { correlationId: req.correlationId });
      sendData(res, req, terminalPresent(result));
    }));
  }

  if (!terminalCheckout) {
    router.post('/terminal/checkout', (req, res, next) => next(unavailable()));
    router.get('/terminal/:paymentId/status', (req, res, next) => next(unavailable()));
  }

  if (!checkout || !repository || !authCoreService) {
    router.use((req, res, next) => next(unavailable()));
    return router;
  }

  const authenticateCustomer = createCustomerAuthenticator(authCoreService);

  router.post('/orders/:orderId', authenticateCustomer, asyncHandler(async (req, res) => {
    const customerId = req.securityContext.subject_id;
    const order = await repository.prisma.order.findFirst({
      where: { id: req.params.orderId, customerId },
    });
    if (!order) throw notFound();

    const flow = await repository.prisma.saleFlow.findFirst({
      where: { orderId: order.id, customerId },
    });
    if (!flow) throw conflict('PAYMENT_SALE_FLOW_NOT_FOUND', 'Для заказа отсутствует платёжный контур.');

    const channel = clientChannel(req.body?.channel);
    const idempotencyKey = String(req.get('Idempotency-Key') || '').trim()
      || `checkout:${flow.flowId}:${channel}`;

    const result = await checkout.initiate({
      organizationId: flow.organizationId,
      orderId: order.id,
      saleFlowId: flow.flowId,
      provider: 'YOOKASSA',
      idempotencyKey,
      method: paymentMethod(req.body?.method),
      returnUrl: req.body?.returnUrl,
      channel,
      description: req.body?.description || null,
    }, {
      actorType: 'CUSTOMER',
      actorId: customerId,
      correlationId: req.correlationId,
    });

    sendData(res, req, present(result), result.duplicate ? 200 : 201);
  }));

  router.get('/orders/:orderId/status', authenticateCustomer, asyncHandler(async (req, res) => {
    const customerId = req.securityContext.subject_id;
    const payment = await repository.prisma.payment.findFirst({
      where: { orderId: req.params.orderId, customerId },
    });
    if (!payment) throw notFound();

    const result = await checkout.refreshPayment({
      organizationId: payment.organizationId,
      paymentId: payment.id,
    }, {
      actorType: 'CUSTOMER',
      actorId: customerId,
      correlationId: req.correlationId,
    });

    sendData(res, req, present(result));
  }));

  router.get('/:paymentId/status', authenticateCustomer, asyncHandler(async (req, res) => {
    const customerId = req.securityContext.subject_id;
    const payment = await repository.prisma.payment.findFirst({
      where: { id: req.params.paymentId, customerId },
    });
    if (!payment) throw notFound();

    const result = await checkout.refreshPayment({
      organizationId: payment.organizationId,
      paymentId: payment.id,
    }, {
      actorType: 'CUSTOMER',
      actorId: customerId,
      correlationId: req.correlationId,
    });

    sendData(res, req, present(result));
  }));

  return router;
}

function terminalPresent(result) {
  return {
    type: 'terminal_payment_checkout',
    id: result.paymentId || null,
    attributes: {
      order_id: result.orderId || null,
      machine_id: result.machineId || null,
      status: result.status || null,
      user_state: result.userState || 'PENDING',
      amount: result.amount ?? null,
      currency: result.currency || 'RUB',
      confirmation_url: result.confirmationUrl || null,
      failure_code: result.failureCode || null,
      succeeded_at: result.succeededAt || null,
      fulfillment_state: result.fulfillmentState || 'WAITING',
    },
  };
}

function present(result) {
  const payment = result?.payment || {};
  return {
    type: 'payment_checkout',
    id: payment.id || null,
    attributes: {
      order_id: payment.orderId || null,
      status: result?.status || payment.status || null,
      user_state: result?.userState || userState(payment.status),
      amount: payment.amount == null ? null : String(payment.amount),
      currency: payment.currency || 'RUB',
      channel: payment.channel || null,
      payment_method: payment.paymentMethodType || null,
      confirmation_url: result?.confirmationUrl || payment.confirmationUrl || null,
      provider_status: payment.providerStatus || null,
      failure_code: payment.failureCode || null,
      succeeded_at: payment.succeededAt || null,
      failed_at: payment.failedAt || null,
      canceled_at: payment.canceledAt || null,
    },
  };
}

function clientChannel(value) {
  const channel = String(value || '').toUpperCase();
  if (!['WEB', 'MINIAPP'].includes(channel)) {
    throw conflict('PAYMENT_CHANNEL_INVALID', 'Для пользовательской оплаты разрешены WEB или MINIAPP.', 400);
  }
  return channel;
}

function paymentMethod(value) {
  const method = String(value || 'sbp').toLowerCase();
  if (!['sbp', 'bank_card'].includes(method)) {
    throw conflict('PAYMENT_METHOD_INVALID', 'Способ оплаты не поддерживается.', 400);
  }
  return method;
}

function userState(status) {
  if (status === 'SUCCEEDED') return 'SUCCESS';
  if (['FAILED', 'CANCELED'].includes(status)) return 'ERROR';
  if (status === 'REFUNDED') return 'REFUNDED';
  return 'PENDING';
}

function notFound() {
  return Object.assign(new Error('Платёж или заказ не найден.'), {
    code: 'PAYMENT_NOT_FOUND',
    statusCode: 404,
    source: 'payment',
  });
}

function conflict(code, message, statusCode = 409) {
  return Object.assign(new Error(message), { code, statusCode, source: 'payment' });
}

function unavailable() {
  return Object.assign(new Error('Платёжный runtime недоступен.'), {
    code: 'PAYMENT_CHECKOUT_NOT_AVAILABLE',
    statusCode: 503,
    source: 'payment',
  });
}

module.exports = { createPaymentRouter };
