'use strict';
const express = require('express');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { ApiError } = require('../../platform/errors/ApiError');

const CHANNELS = new Set(['MINIAPP', 'WEB']);

function failure(code, message, statusCode) {
  return new ApiError({ code, message, statusCode, source: 'payment' });
}

function safeReturnUrl(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 2048) {
    throw failure('PAYMENT_RETURN_URL_INVALID', 'A valid return URL is required.', 400);
  }
  let url;
  try { url = new URL(raw); } catch { throw failure('PAYMENT_RETURN_URL_INVALID', 'Invalid return URL.', 400); }
  if (url.protocol !== 'https:' || url.username || url.password ||
      !(url.hostname === 'utimoshi.ru' || url.hostname.endsWith('.utimoshi.ru'))) {
    throw failure('PAYMENT_RETURN_URL_INVALID', 'Return URL must use an approved secure origin.', 400);
  }
  return url.toString();
}

function data(result) {
  return {
    data: { type: 'payment', id: result.payment?.id || null, attributes: {
      status: result.status || result.payment?.status || 'PENDING',
      user_state: result.userState || 'PENDING',
      confirmation_url: result.confirmationUrl || result.payment?.confirmationUrl || null,
      order_id: result.payment?.orderId || null,
    } },
  };
}

function createCustomerPaymentRouter({ authCoreService, paymentRepository, paymentCheckoutService }) {
  const router = express.Router();
  // Explicitly unavailable terminal endpoint; it must never bypass terminal/machine authentication.
  const unavailable = (_req, res) => res.status(503).json({ error: {
    code: 'PAYMENT_CHECKOUT_NOT_AVAILABLE', message: 'Terminal checkout is disabled in this API.',
  } });
  router.post('/terminal/checkout', unavailable);
  router.get('/terminal/:paymentId/status', unavailable);
  router.get('/terminal/methods', (_req, res) => res.json({ data: { attributes: { methods: [
    { id: 'sbp', available: false, reason_code: 'PAYMENT_CHECKOUT_NOT_AVAILABLE' },
    { id: 'pos', available: false, reason_code: 'TERMINAL_POS_NOT_CONFIGURED' },
  ] } } }));

  router.use(createCustomerAuthenticator(authCoreService));
  router.post('/orders/:orderId', async (req, res, next) => {
    try {
      const customerId = req.securityContext.subject_id;
      const channel = String(req.body?.channel || '').toUpperCase();
      if (!CHANNELS.has(channel)) throw failure('PAYMENT_CHANNEL_INVALID', 'Unsupported customer payment channel.', 400);
      const prisma = paymentRepository.prisma;
      const order = await prisma.order.findFirst({ where: { id: req.params.orderId, customerId } });
      const flow = await prisma.saleFlow.findFirst({ where: { orderId: req.params.orderId, customerId } });
      if (!order || !flow) throw failure('PAYMENT_ORDER_NOT_FOUND', 'Order was not found.', 404);
      if (!paymentCheckoutService) throw failure('PAYMENT_CHECKOUT_NOT_AVAILABLE', 'Payment checkout unavailable.', 503);
      const result = await paymentCheckoutService.initiate({
        organizationId: flow.organizationId, saleFlowId: flow.flowId,
        orderId: order.id, channel,
        provider: 'YOOKASSA', method: req.body?.method || 'sbp',
        returnUrl: safeReturnUrl(req.body?.returnUrl),
        idempotencyKey: String(req.get('Idempotency-Key') || '').trim() || null,
      }, { actorType: 'CUSTOMER', actorId: customerId, correlationId: req.correlationId });
      res.status(201).json(data(result));
    } catch (error) { next(error); }
  });
  router.get('/orders/:orderId/status', async (req, res, next) => {
    try {
      const customerId = req.securityContext.subject_id;
      const payment = await paymentRepository.prisma.payment.findFirst({
        where: { orderId: req.params.orderId, customerId },
      });
      if (!payment) throw failure('PAYMENT_ORDER_NOT_FOUND', 'Order was not found.', 404);
      if (!paymentCheckoutService) throw failure('PAYMENT_CHECKOUT_NOT_AVAILABLE', 'Payment checkout unavailable.', 503);
      const result = await paymentCheckoutService.refreshPayment({
        organizationId: payment.organizationId, paymentId: payment.id,
      }, { actorType: 'CUSTOMER', actorId: customerId, correlationId: req.correlationId });
      res.json(data(result));
    } catch (error) { next(error); }
  });
  return router;
}

module.exports = { createCustomerPaymentRouter, safeReturnUrl };
