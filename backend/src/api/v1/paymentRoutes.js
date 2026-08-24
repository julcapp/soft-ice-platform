'use strict';

const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { getPrismaClient } = require('../../common/database');
const { PaymentRepository, PaymentOrchestrator, YooKassaPaymentAdapter } = require('../../modules/payment');
const { FiftiethPurchaseGiftResolver } = require('../../modules/promotion_engine');

function resolvePaymentOrchestrator(dependencies = {}) {
  if (dependencies.paymentOrchestrator) return dependencies.paymentOrchestrator;
  if (!dependencies.orderRuntime) {
    const error = new Error('Order runtime is not configured for payments.');
    error.code = 'PAYMENT_ORDER_RUNTIME_UNAVAILABLE';
    error.statusCode = 503;
    error.source = 'payment';
    throw error;
  }
  const prisma = dependencies.prisma || getPrismaClient();
  const giftResolver = dependencies.giftRewardResolver || new FiftiethPurchaseGiftResolver({ prisma });
  return new PaymentOrchestrator({
    repository: new PaymentRepository(prisma),
    adapter: dependencies.yooKassaPaymentAdapter || new YooKassaPaymentAdapter(),
    orderRuntime: dependencies.orderRuntime,
    fiftiethPurchaseGiftResolver: giftResolver,
  });
}

function createPaymentRouter(dependencies = {}) {
  const router = express.Router();
  let orchestrator = dependencies.paymentOrchestrator || null;
  const getOrchestrator = () => {
    if (!orchestrator) orchestrator = resolvePaymentOrchestrator(dependencies);
    return orchestrator;
  };

  router.post('/yookassa/webhook', asyncHandler(async (req, res) => {
    await getOrchestrator().handleWebhook(req.body, {
      correlationId: req.correlationId,
      sourceIp: req.ip,
    });
    return res.status(200).end();
  }));

  const authenticateCustomer = createCustomerAuthenticator(dependencies.authCoreService);
  router.post('/orders/:orderId', authenticateCustomer, asyncHandler(async (req, res) => {
    const attempt = await getOrchestrator().startPayment({
      orderId: req.params.orderId,
      customerId: req.securityContext.subject_id,
      method: req.body?.method || 'sbp',
      returnUrl: req.body?.returnUrl,
      idempotencyKey: req.get('Idempotency-Key') || null,
    });
    return sendData(res, req, attempt, 201);
  }));

  return router;
}

module.exports = { createPaymentRouter, resolvePaymentOrchestrator };
