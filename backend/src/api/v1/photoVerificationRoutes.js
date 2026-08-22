const express = require('express');
const { asyncHandler, sendData } = require('../../platform/http/apiResponse');
const { createCustomerAuthenticator } = require('../../platform/security/authenticateCustomer');
const { createAdminAuthenticator } = require('../../platform/security/authenticateAdmin');

function createPhotoVerificationRouter({ photoPublicationReadModel, photoSubmissionIntakeService, authCoreService }) {
  const router = express.Router();
  router.use(createCustomerAuthenticator(authCoreService));
  router.get('/me/publications', asyncHandler(async (req, res) => sendData(res, req, await photoPublicationReadModel.listForCustomer(req.securityContext.customer_id))));
  router.get('/me/challenges/active', asyncHandler(async (req, res) => sendData(res, req, await photoSubmissionIntakeService.getActiveChallenge(req.securityContext.customer_id, { correlationId: req.correlationId }))));
  router.post('/me/challenges/:photoChallengeId/photo', express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }), asyncHandler(async (req, res) => sendData(res, req, await photoSubmissionIntakeService.submit({ customerId: req.securityContext.customer_id, photoChallengeId: req.params.photoChallengeId, buffer: req.body, mimeType: req.get('Content-Type'), captureCode: req.get('X-Photo-Capture-Code'), correlationId: req.correlationId }), 202)));
  return router;
}

function createAdminPhotoVerificationRouter({ photoVerificationAdminService, photoManualReviewService, photoVerificationMetricsService, adminAuth = {} }) {
  const router = express.Router();
  router.use(createAdminAuthenticator(adminAuth));
  router.get('/settings', asyncHandler(async (req, res) => sendData(res, req, await photoVerificationAdminService.getSettings(req.securityContext, req.query.scope || 'default'))));
  router.patch('/settings', asyncHandler(async (req, res) => sendData(res, req, await photoVerificationAdminService.updateSettings(req.securityContext, req.body || {}, req.query.scope || 'default'))));
  router.get('/metrics', asyncHandler(async (req, res) => sendData(res, req, await photoVerificationMetricsService.getSnapshot(req.securityContext, { period: req.query.period }))));
  router.get('/reviews', asyncHandler(async (req, res) => sendData(res, req, await photoManualReviewService.list(req.securityContext, { limit: req.query.limit }))));
  router.get('/reviews/:photoChallengeId', asyncHandler(async (req, res) => sendData(res, req, await photoManualReviewService.get(req.securityContext, req.params.photoChallengeId))));
  router.get('/reviews/:photoChallengeId/preview', asyncHandler(async (req, res) => {
    const preview = await photoManualReviewService.getPreview(req.securityContext, req.params.photoChallengeId);
    const lower = String(preview.storageKey || '').toLowerCase();
    res.set('Cache-Control', 'private, no-store'); res.type(lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg'); return res.send(preview.buffer);
  }));
  router.post('/reviews/:photoChallengeId/decision', asyncHandler(async (req, res) => sendData(res, req, await photoManualReviewService.decide(req.securityContext, req.params.photoChallengeId, { action: req.body?.action, reason: req.body?.reason, correlationId: req.correlationId }))));
  router.get('/operations', asyncHandler(async (req, res) => sendData(res, req, await photoManualReviewService.listOperationalIssues(req.securityContext, { limit: req.query.limit }))));
  router.post('/operations/:photoChallengeId/retry', asyncHandler(async (req, res) => sendData(res, req, await photoManualReviewService.retryOperationalIssue(req.securityContext, req.params.photoChallengeId, { correlationId: req.correlationId }))));
  return router;
}

module.exports = { createPhotoVerificationRouter, createAdminPhotoVerificationRouter };
