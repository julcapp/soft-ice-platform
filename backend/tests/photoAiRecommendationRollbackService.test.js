const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoAiRecommendationRollbackService } = require('../src/modules/photo_verification/PhotoAiRecommendationRollbackService');

const admin = { roles: ['ADMIN'], userId: 'admin-1' };
const applicationPreparationId = '11111111-1111-4111-8111-111111111111';

function prismaForPrepare({ currentMode = 'manual_only' } = {}) {
  const writes = [];
  return {
    writes,
    async $queryRaw(strings) {
      const sql = strings.join(' ');
      if (sql.includes("action\" = 'applied'")) return [{ recommendationKey: '7d:high_disagreement_review_mode', metadata: { preparationId: applicationPreparationId, before: { mode: 'ai_assisted' }, after: { mode: 'manual_only' } } }];
      return [];
    },
    async $executeRaw(strings, ...values) { writes.push({ sql: strings.join(' '), values }); return 1; },
  };
}

test('prepare rollback produces explicit reverse diff and does not change settings', async () => {
  const prisma = prismaForPrepare();
  let updates = 0;
  const adminService = {
    getSettings: async () => ({ mode: 'manual_only', approvalThreshold: 0.93 }),
    updateSettings: async () => { updates += 1; },
  };
  const service = new PhotoAiRecommendationRollbackService({ prisma, adminService, clock: () => new Date('2026-08-22T15:30:00Z') });
  const result = await service.prepare(admin, applicationPreparationId);
  assert.deepEqual(result.before, { mode: 'manual_only' });
  assert.deepEqual(result.patch, { mode: 'ai_assisted' });
  assert.deepEqual(result.after, { mode: 'ai_assisted' });
  assert.equal(result.requiresConfirmation, true);
  assert.equal(updates, 0);
  assert.equal(prisma.writes.length, 1);
});

test('prepare rollback blocks when settings changed after original application', async () => {
  const prisma = prismaForPrepare();
  const adminService = { getSettings: async () => ({ mode: 'disabled' }) };
  const service = new PhotoAiRecommendationRollbackService({ prisma, adminService });
  await assert.rejects(() => service.prepare(admin, applicationPreparationId), (error) => error.code === 'PHOTO_AI_RECOMMENDATION_ROLLBACK_SETTINGS_CHANGED' && error.statusCode === 409);
  assert.equal(prisma.writes.length, 0);
});

test('rollback requires an already applied recommendation change', async () => {
  const prisma = { $queryRaw: async () => [], $executeRaw: async () => 1 };
  const service = new PhotoAiRecommendationRollbackService({ prisma, adminService: { getSettings: async () => ({}) } });
  await assert.rejects(() => service.prepare(admin, applicationPreparationId), (error) => error.code === 'PHOTO_AI_RECOMMENDATION_APPLICATION_NOT_FOUND' && error.statusCode === 404);
});
