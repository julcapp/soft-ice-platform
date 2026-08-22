const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createPhotoVerificationRouter({ photoPublicationReadModel, photoSubmissionIntakeService, authCoreService }) {
  const router = express.Router();
  router.use(createCustomerAuthenticator(authCoreService));

  router.get('/me/publications', asyncHandler(async (req, res) => {
    const rows = await photoPublicationReadModel.listForCustomer(req.securityContext.customer_id);
    return sendData(res, req, rows);
  }));

  router.get('/me/challenges/active', asyncHandler(async (req, res) => {
    const challenge = await photoSubmissionIntakeService.getActiveChallenge(req.securityContext.customer_id);
    return sendData(res, req, challenge);
  }));

  router.post(
    '/me/challenges/:photoChallengeId/photo',
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }),
    asyncHandler(async (req, res) => {
      const result = await photoSubmissionIntakeService.submit({
        customerId: req.securityContext.customer_id,
        photoChallengeId: req.params.photoChallengeId,
        buffer: req.body,
        mimeType: req.get('Content-Type'),
        correlationId: req.correlationId,
      });
      return sendData(res, req, result, 202);
    }),
  );

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
