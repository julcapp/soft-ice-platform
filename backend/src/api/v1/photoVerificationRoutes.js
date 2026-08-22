const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createPhotoVerificationRouter({ photoPublicationReadModel, authCoreService }) {
  const router = express.Router();
  router.use(createCustomerAuthenticator(authCoreService));

  router.get('/me/publications', asyncHandler(async (req, res) => {
    const rows = await photoPublicationReadModel.listForCustomer(req.securityContext.customer_id);
    return sendData(res, req, rows);
  }));

  return router;
}

function createAdminPhotoVerificationRouter({ photoVerificationAdminService, adminAuth = {} }) {
  const router = express.Router();
  router.use(createAdminAuthenticator(adminAuth));

  router.get('/settings', asyncHandler(async (req, res) => {
    const scopeKey = req.query.scope || 'default';
    return sendData(res, req, await photoVerificationAdminService.getSettings(req.securityContext, scopeKey));
  }));

  router.patch('/settings', asyncHandler(async (req, res) => {
    const scopeKey = req.query.scope || 'default';
    return sendData(res, req, await photoVerificationAdminService.updateSettings(req.securityContext, req.body || {}, scopeKey));
  }));

  return router;
}

module.exports = { createPhotoVerificationRouter, createAdminPhotoVerificationRouter };
