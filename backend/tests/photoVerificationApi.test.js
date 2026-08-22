const test = require('node:test');
const assert = require('node:assert/strict');

const { createPhotoVerificationRouter, createAdminPhotoVerificationRouter } = require('../src/api/v1/photoVerificationRoutes');
const { attachPhotoVerificationRuntime } = require('../src/photoVerificationRuntime');

function routeSignatures(router) {
  return router.stack.filter((layer) => layer.route).map((layer) => ({ path: layer.route.path, methods: Object.keys(layer.route.methods).filter((method) => layer.route.methods[method]).sort() }));
}

test('customer photo verification router exposes own history and camera challenge endpoints', () => {
  const router = createPhotoVerificationRouter({ photoPublicationReadModel: { listForCustomer: async () => [] }, photoSubmissionIntakeService: {}, authCoreService: {} });
  assert.deepEqual(routeSignatures(router), [
    { path: '/me/publications', methods: ['get'] },
    { path: '/me/challenges/active', methods: ['get'] },
    { path: '/me/challenges/:photoChallengeId/photo', methods: ['post'] },
  ]);
});

test('admin photo verification router exposes settings, recommendations, application, review and recovery endpoints', () => {
  const router = createAdminPhotoVerificationRouter({
    photoVerificationAdminService: {}, photoManualReviewService: {}, photoVerificationMetricsService: {},
    photoAiRecommendationJournalService: {}, photoAiRecommendationApplicationService: {}, adminAuth: {},
  });
  assert.deepEqual(routeSignatures(router), [
    { path: '/settings', methods: ['get'] },
    { path: '/settings', methods: ['patch'] },
    { path: '/metrics', methods: ['get'] },
    { path: '/recommendations/evaluate', methods: ['post'] },
    { path: '/recommendations/history', methods: ['get'] },
    { path: '/recommendations/:recommendationKey/viewed', methods: ['post'] },
    { path: '/recommendations/:recommendationKey/decision', methods: ['post'] },
    { path: '/recommendations/:recommendationKey/prepare-change', methods: ['post'] },
    { path: '/recommendation-changes/:preparationId/apply', methods: ['post'] },
    { path: '/reviews', methods: ['get'] },
    { path: '/reviews/:photoChallengeId', methods: ['get'] },
    { path: '/reviews/:photoChallengeId/preview', methods: ['get'] },
    { path: '/reviews/:photoChallengeId/decision', methods: ['post'] },
    { path: '/operations', methods: ['get'] },
    { path: '/operations/:photoChallengeId/retry', methods: ['post'] },
  ]);
});

test('composition root attaches shared repository-backed photo services', () => {
  const result = attachPhotoVerificationRuntime({}, { prisma: {} });
  assert.ok(result.photoVerificationRepository);
  assert.ok(result.photoVerificationAdminService);
  assert.ok(result.photoManualReviewService);
  assert.ok(result.photoVerificationMetricsService);
  assert.ok(result.photoAiRecommendationJournalService);
  assert.ok(result.photoAiRecommendationApplicationService);
  assert.equal(result.photoAiRecommendationApplicationService.metricsService, result.photoVerificationMetricsService);
  assert.equal(result.photoAiRecommendationApplicationService.journalService, result.photoAiRecommendationJournalService);
  assert.equal(result.photoAiRecommendationApplicationService.adminService, result.photoVerificationAdminService);
});

test('composition root preserves explicitly injected recommendation application service', () => {
  const applicationService = { custom: true };
  const result = attachPhotoVerificationRuntime({ photoAiRecommendationApplicationService: applicationService }, { prisma: {} });
  assert.equal(result.photoAiRecommendationApplicationService, applicationService);
});
