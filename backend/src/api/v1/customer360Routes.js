const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createCustomer360Router({ customer360Runtime, authCoreService }) {
  const router = express.Router();
  router.use(createCustomerAuthenticator(authCoreService));
  router.get('/me', asyncHandler(async (req, res) => sendData(res, req, await customer360Runtime.getProfile(req.securityContext.customer_id))));
  router.get('/me/timeline', asyncHandler(async (req, res) => sendData(res, req, await customer360Runtime.getTimeline(req.securityContext.customer_id, req.query))));
  router.put('/me/preferences/:category/:key', asyncHandler(async (req, res) => sendData(res, req, await customer360Runtime.setPreference(req.securityContext.customer_id, { ...req.body, category: req.params.category, key: req.params.key, source: 'EXPLICIT' }, { actorId: req.securityContext.customer_id, correlationId: req.correlationId }))));
  return router;
}

function createAdminCustomer360Router({ customer360Runtime, customerPaymentProfileService, paymentOperationsService, adminAuth = {} }) {
  const router = express.Router();
  router.use(createAdminAuthenticator(adminAuth));
  router.get('/customers/:customerId', asyncHandler(async (req, res) => sendData(res, req, await customer360Runtime.getProfile(req.params.customerId))));
  router.get('/customers/:customerId/timeline', asyncHandler(async (req, res) => sendData(res, req, await customer360Runtime.getTimeline(req.params.customerId, req.query))));
  router.get('/customers/:customerId/payment-profile', asyncHandler(async (req, res) => sendData(res, req, await customerPaymentProfileService.get(req.params.customerId))));
  router.post('/customers/:customerId/refunds', asyncHandler(async (req, res) => sendData(res, req, await paymentOperationsService.createRefund({
    customerId: req.params.customerId,
    sourceType: req.body?.sourceType,
    sourcePaymentId: req.body?.sourcePaymentId,
    amountRub: req.body?.amountRub,
    reason: req.body?.reason,
    actorId: req.securityContext?.subject_id || 'admin',
    idempotencyKey: req.get('Idempotency-Key') || undefined,
  }), 201)));
  return router;
}

module.exports = { createCustomer360Router, createAdminCustomer360Router };
