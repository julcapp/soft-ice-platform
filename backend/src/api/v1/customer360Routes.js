const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createCustomer360Router({ customer360Runtime, authCoreService }) {
  const router = express.Router();
  router.use(createCustomerAuthenticator(authCoreService));
  router.get('/me', asyncHandler(async (req, res) => sendData(res, req, await customer360Runtime.getProfile(req.securityContext.customer_id))));
  router.get('/me/timeline', asyncHandler(async (req, res) => sendData(res, req, await customer360Runtime.getTimeline(req.securityContext.customer_id, req.query))));
  router.put('/me/preferences/:category/:key', asyncHandler(async (req, res) => sendData(res, req, await customer360Runtime.setPreference(req.securityContext.customer_id, {
    ...req.body, category: req.params.category, key: req.params.key, source: 'EXPLICIT',
  }, { actorId: req.securityContext.customer_id, correlationId: req.correlationId }))));
  return router;
}

function createAdminCustomer360Router({ customer360Runtime, adminAuth = {} }) {
  const router = express.Router();
  router.use(createAdminAuthenticator(adminAuth));
  router.get('/customers/:customerId', asyncHandler(async (req, res) => sendData(res, req, await customer360Runtime.getProfile(req.params.customerId))));
  router.get('/customers/:customerId/timeline', asyncHandler(async (req, res) => sendData(res, req, await customer360Runtime.getTimeline(req.params.customerId, req.query))));
  return router;
}

module.exports = { createCustomer360Router, createAdminCustomer360Router };
