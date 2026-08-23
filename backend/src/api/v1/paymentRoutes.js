'use strict';

const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { getPrismaClient } = require('../../common/database');
const { PaymentRepository, PaymentOrchestrator, YooKassaPaymentAdapter } = require('../../modules/payment');
const { FiftiethPurchaseGiftResolver } = require('../../modules/promotion_engine');

function resolvePaymentOrchestrator(dependencies = {}) {
  if (dependencies.paymentOrchestrator) return dependencies.paymentOrchestrator;
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
  const orchestrator = resolvePaymentOrchestrator(dependencies);

  router.post('/yookassa/webhook', asyncHandler(async (req, res) => {
    await orchestrator.handleWebhook(req.body, {
      correlationId: req.correlationId,
      sourceIp: req.ip,
    });
    return res.status(200).end();
  }));

  const authenticateCustomer = createCustomerAuthenticator(dependencies.authCoreService);
  router.post('/orders/:orderId', authenticateCustomer, asyncHandler(async (req, res) => {
    const attempt = await orchestrator.startPayment({
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
