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
    const challenge = await photoSubmissionIntakeService.getActiveChallenge(req.securityContext.customer_id, { correlationId: req.correlationId });
    return sendData(res, req, challenge);
  }));

  router.post('/me/challenges/:photoChallengeId/photo',
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }),
    asyncHandler(async (req, res) => {
      const result = await photoSubmissionIntakeService.submit({
        customerId: req.securityContext.customer_id,
        photoChallengeId: req.params.photoChallengeId,
        buffer: req.body,
        mimeType: req.get('Content-Type'),
        captureCode: req.get('X-Photo-Capture-Code'),
        correlationId: req.correlationId,
      });
      return sendData(res, req, result, 202);
    }),
  );

  return router;
}

function createAdminPhotoVerificationRouter({ photoVerificationAdminService, photoManualReviewService, adminAuth = {} }) {
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

  router.get('/reviews', asyncHandler(async (req, res) => {
    const rows = await photoManualReviewService.list(req.securityContext, { limit: req.query.limit });
    return sendData(res, req, rows);
  }));

  router.get('/reviews/:photoChallengeId', asyncHandler(async (req, res) => {
    return sendData(res, req, await photoManualReviewService.get(req.securityContext, req.params.photoChallengeId));
  }));

  router.get('/reviews/:photoChallengeId/preview', asyncHandler(async (req, res) => {
    const preview = await photoManualReviewService.getPreview(req.securityContext, req.params.photoChallengeId);
    const lower = String(preview.storageKey || '').toLowerCase();
    const contentType = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
    res.set('Cache-Control', 'private, no-store');
    res.type(contentType);
    return res.send(preview.buffer);
  }));

  router.post('/reviews/:photoChallengeId/decision', asyncHandler(async (req, res) => {
    const result = await photoManualReviewService.decide(req.securityContext, req.params.photoChallengeId, {
      action: req.body?.action,
      reason: req.body?.reason,
      correlationId: req.correlationId,
    });
    return sendData(res, req, result);
  }));

  return router;
}

module.exports = { createPhotoVerificationRouter, createAdminPhotoVerificationRouter };
