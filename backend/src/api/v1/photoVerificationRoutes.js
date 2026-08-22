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

function createAdminPhotoVerificationRouter({ photoVerificationAdminService, photoManualReviewService, photoVerificationMetricsService, photoAiRecommendationJournalService, photoAiRecommendationApplicationService, photoAiRecommendationRollbackService, photoAiRecommendationApplicationHistoryService, adminAuth = {} }) {
  const router = express.Router();
  router.use(createAdminAuthenticator(adminAuth));
  router.get('/settings', asyncHandler(async (req, res) => sendData(res, req, await photoVerificationAdminService.getSettings(req.securityContext, req.query.scope || 'default'))));
  router.patch('/settings', asyncHandler(async (req, res) => sendData(res, req, await photoVerificationAdminService.updateSettings(req.securityContext, req.body || {}, req.query.scope || 'default'))));
  router.get('/metrics', asyncHandler(async (req, res) => sendData(res, req, await photoVerificationMetricsService.getSnapshot(req.securityContext, { period: req.query.period }))));
  router.post('/recommendations/evaluate', asyncHandler(async (req, res) => sendData(res, req, await photoAiRecommendationJournalService.evaluate(req.securityContext, { period: req.body?.period || req.query.period || '7d', correlationId: req.correlationId }))));
  router.get('/recommendations/history', asyncHandler(async (req, res) => sendData(res, req, await photoAiRecommendationJournalService.history(req.securityContext, { period: req.query.period || '7d', limit: req.query.limit }))));
  router.post('/recommendations/:recommendationKey/viewed', asyncHandler(async (req, res) => sendData(res, req, await photoAiRecommendationJournalService.markViewed(req.securityContext, req.params.recommendationKey, { correlationId: req.correlationId }))));
  router.post('/recommendations/:recommendationKey/decision', asyncHandler(async (req, res) => sendData(res, req, await photoAiRecommendationJournalService.decide(req.securityContext, req.params.recommendationKey, { decision: req.body?.decision, comment: req.body?.comment, deferUntil: req.body?.deferUntil, correlationId: req.correlationId }))));
  router.get('/recommendation-changes/history', asyncHandler(async (req, res) => sendData(res, req, await photoAiRecommendationApplicationHistoryService.list(req.securityContext, { limit: req.query.limit }))));
  router.post('/recommendations/:recommendationKey/prepare-change', asyncHandler(async (req, res) => sendData(res, req, await photoAiRecommendationApplicationService.prepare(req.securityContext, req.params.recommendationKey, { correlationId: req.correlationId }))));
  router.post('/recommendation-changes/:preparationId/apply', asyncHandler(async (req, res) => sendData(res, req, await photoAiRecommendationApplicationService.apply(req.securityContext, req.params.preparationId, { correlationId: req.correlationId }))));
  router.post('/recommendation-changes/:preparationId/prepare-rollback', asyncHandler(async (req, res) => sendData(res, req, await photoAiRecommendationRollbackService.prepare(req.securityContext, req.params.preparationId, { correlationId: req.correlationId }))));
  router.post('/recommendation-rollbacks/:rollbackId/apply', asyncHandler(async (req, res) => sendData(res, req, await photoAiRecommendationRollbackService.apply(req.securityContext, req.params.rollbackId, { correlationId: req.correlationId }))));
  router.get('/reviews', asyncHandler(async (req, res) => sendData(res, req, await photoManualReviewService.list(req.securityContext, { limit: req.query.limit }))));
  router.get('/reviews/:photoChallengeId', asyncHandler(async (req, res) => sendData(res, req, await photoManualReviewService.get(req.securityContext, req.params.photoChallengeId))));
  router.get('/reviews/:photoChallengeId/preview', asyncHandler(async (req, res) => { const preview = await photoManualReviewService.getPreview(req.securityContext, req.params.photoChallengeId); const lower = String(preview.storageKey || '').toLowerCase(); res.set('Cache-Control', 'private, no-store'); res.type(lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg'); return res.send(preview.buffer); }));
  router.post('/reviews/:photoChallengeId/decision', asyncHandler(async (req, res) => sendData(res, req, await photoManualReviewService.decide(req.securityContext, req.params.photoChallengeId, { action: req.body?.action, reason: req.body?.reason, correlationId: req.correlationId }))));
  router.get('/operations', asyncHandler(async (req, res) => sendData(res, req, await photoManualReviewService.listOperationalIssues(req.securityContext, { limit: req.query.limit }))));
  router.post('/operations/:photoChallengeId/retry', asyncHandler(async (req, res) => sendData(res, req, await photoManualReviewService.retryOperationalIssue(req.securityContext, req.params.photoChallengeId, { correlationId: req.correlationId }))));
  return router;
}
module.exports = { createPhotoVerificationRouter, createAdminPhotoVerificationRouter };
