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

test('customer photo verification router exposes own publication history only', () => {
  const router = createPhotoVerificationRouter({
    photoPublicationReadModel: { listForCustomer: async () => [] },
    authCoreService: {},
  });

  assert.deepEqual(routeSignatures(router), [
    { path: '/me/publications', methods: ['get'] },
  ]);
});

test('admin photo verification router exposes settings read and patch endpoints', () => {
  const router = createAdminPhotoVerificationRouter({
    photoVerificationAdminService: {},
    adminAuth: {},
  });

  assert.deepEqual(routeSignatures(router), [
    { path: '/settings', methods: ['get'] },
    { path: '/settings', methods: ['patch'] },
  ]);
});

test('composition root attaches shared repository-backed photo services', () => {
  const fakePrisma = {};
  const dependencies = {};
  const result = attachPhotoVerificationRuntime(dependencies, { prisma: fakePrisma });

  assert.equal(result, dependencies);
  assert.ok(result.photoVerificationRepository);
  assert.ok(result.photoVerificationAdminService);
  assert.ok(result.photoPublicationReadModel);
  assert.equal(result.photoVerificationAdminService.repository, result.photoVerificationRepository);
  assert.equal(result.photoPublicationReadModel.repository, result.photoVerificationRepository);
});

test('composition root preserves explicitly injected photo services', () => {
  const adminService = { custom: true };
  const readModel = { custom: true };
  const dependencies = {
    photoVerificationAdminService: adminService,
    photoPublicationReadModel: readModel,
  };

  const result = attachPhotoVerificationRuntime(dependencies, { prisma: {} });
  assert.equal(result.photoVerificationAdminService, adminService);
  assert.equal(result.photoPublicationReadModel, readModel);
});
