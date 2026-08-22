const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createPhotoVerificationRouter,
  createAdminPhotoVerificationRouter,
} = require('../src/api/v1/photoVerificationRoutes');
const { attachPhotoVerificationRuntime } = require('../src/photoVerificationRuntime');

function routeSignatures(router) {
  return router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods).filter((method) => layer.route.methods[method]).sort(),
    }));
}

test('customer photo verification router exposes own history and camera challenge endpoints', () => {
  const router = createPhotoVerificationRouter({
    photoPublicationReadModel: { listForCustomer: async () => [] },
    photoSubmissionIntakeService: {},
    authCoreService: {},
  });

  assert.deepEqual(routeSignatures(router), [
    { path: '/me/publications', methods: ['get'] },
    { path: '/me/challenges/active', methods: ['get'] },
    { path: '/me/challenges/:photoChallengeId/photo', methods: ['post'] },
  ]);
});

test('admin photo verification router exposes settings and manual review endpoints', () => {
  const router = createAdminPhotoVerificationRouter({
    photoVerificationAdminService: {},
    photoManualReviewService: {},
    adminAuth: {},
  });

  assert.deepEqual(routeSignatures(router), [
    { path: '/settings', methods: ['get'] },
    { path: '/settings', methods: ['patch'] },
    { path: '/reviews', methods: ['get'] },
    { path: '/reviews/:photoChallengeId', methods: ['get'] },
    { path: '/reviews/:photoChallengeId/preview', methods: ['get'] },
    { path: '/reviews/:photoChallengeId/decision', methods: ['post'] },
  ]);
});

test('composition root attaches shared repository-backed photo services', () => {
  const fakePrisma = {};
  const dependencies = {};
  const result = attachPhotoVerificationRuntime(dependencies, { prisma: fakePrisma });

  assert.equal(result, dependencies);
  assert.ok(result.photoVerificationRepository);
  assert.ok(result.photoVerificationAdminService);
  assert.ok(result.photoManualReviewService);
  assert.ok(result.photoPublicationReadModel);
  assert.ok(result.photoCaptureChallengeService);
  assert.ok(result.photoRewardEngine);
  assert.equal(result.photoVerificationAdminService.repository, result.photoVerificationRepository);
  assert.equal(result.photoManualReviewService.repository, result.photoVerificationRepository);
  assert.equal(result.photoPublicationReadModel.repository, result.photoVerificationRepository);
});

test('composition root preserves explicitly injected photo services', () => {
  const adminService = { custom: true };
  const manualReviewService = { custom: true };
  const readModel = { custom: true };
  const captureService = { custom: true };
  const dependencies = {
    photoVerificationAdminService: adminService,
    photoManualReviewService: manualReviewService,
    photoPublicationReadModel: readModel,
    photoCaptureChallengeService: captureService,
  };

  const result = attachPhotoVerificationRuntime(dependencies, { prisma: {} });
  assert.equal(result.photoVerificationAdminService, adminService);
  assert.equal(result.photoManualReviewService, manualReviewService);
  assert.equal(result.photoPublicationReadModel, readModel);
  assert.equal(result.photoCaptureChallengeService, captureService);
});
