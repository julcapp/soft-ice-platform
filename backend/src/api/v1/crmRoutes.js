const express = require('express');
const { ApiError } = require('../../platform/errors/ApiError');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createCRMRouter({ crmRuntime, adminAuth = {} }) {
  const router = express.Router();
  router.use(createAdminAuthenticator(adminAuth));
  const context = (req) => ({
    actorId: req.securityContext.subject_id,
    authMethod: req.securityContext.auth_method,
    correlationId: req.correlationId,
    idempotencyKey: req.get('Idempotency-Key') || null,
  });

  router.post('/customers/:customerId/account-actions', asyncHandler(async (req, res) => {
    if (req.securityContext.auth_method === 'development_header' || !req.securityContext.roles?.includes('PLATFORM_OWNER')) throw new ApiError({ statusCode: 403, code: 'CUSTOMER_ACCOUNT_ACTION_DENIED', message: 'Управление учётными записями доступно владельцу платформы.' });
    sendData(res, req, await crmRuntime.manageAccount(req.params.customerId, req.body, context(req)));
  }));

  router.get('/dashboard', asyncHandler(async (req, res) => sendData(res, req, await crmRuntime.getDashboard())));
  router.get('/customers', asyncHandler(async (req, res) => sendData(res, req, await crmRuntime.listCustomers(req.query))));
  router.get('/customers/:customerId', asyncHandler(async (req, res) => sendData(res, req, await crmRuntime.getCustomerCard(req.params.customerId))));
  router.patch('/customers/:customerId', asyncHandler(async (req, res) => sendData(res, req, await crmRuntime.updateCustomerCard(req.params.customerId, req.body, context(req)))));
  router.post('/customers/:customerId/top-ups', asyncHandler(async (req, res) => sendData(res, req, await crmRuntime.topUp(req.params.customerId, req.body, context(req)), 201)));
  router.post('/customers/:customerId/segments/:segmentId', asyncHandler(async (req, res) => sendData(res, req, await crmRuntime.assignSegment(req.params.customerId, req.params.segmentId, req.body, context(req)), 201)));
  router.post('/customers/:customerId/notifications', asyncHandler(async (req, res) => sendData(res, req, await crmRuntime.queueNotification(req.params.customerId, req.body, context(req)), 201)));
  router.post('/campaigns', asyncHandler(async (req, res) => sendData(res, req, await crmRuntime.createCampaign(req.body, context(req)), 201)));
  return router;
}

module.exports = { createCRMRouter };
