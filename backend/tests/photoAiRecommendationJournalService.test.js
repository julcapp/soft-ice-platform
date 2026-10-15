const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoAiRecommendationJournalService } = require('../src/modules/photo_verification/PhotoAiRecommendationJournalService');

const admin = { roles: ['ADMIN'], userId: 'admin-1' };
const now = new Date('2026-08-22T15:00:00.000Z');

test('evaluate records appeared recommendation and returns journal state', async () => {
  let queryCount = 0;
  const writes = [];
  const prisma = {
    async $queryRaw() {
      queryCount += 1;
      if (queryCount === 1) return [];
      return [{ recommendationKey: '7d:review_auto_approve_threshold', action: 'appeared', decision: 'active', actorId: 'admin-1', metadata: {}, occurredAt: now }];
    },
    async $executeRaw(strings, ...values) { writes.push({ strings, values }); return 1; },
  };
  const metricsService = { getSnapshot: async () => ({
    generatedAt: now.toISOString(), period: { key: '7d', startAt: now.toISOString(), endAt: now.toISOString() },
    recommendations: [{ id: 'review_auto_approve_threshold', severity: 'high', title: 'Проверить порог', evidence: { count: 3 } }],
  }) };
  const service = new PhotoAiRecommendationJournalService({ prisma, metricsService, clock: () => now });
  const result = await service.evaluate(admin, { period: '7d' });
  assert.equal(writes.length, 1);
  assert.equal(result.recommendations[0].recommendationKey, '7d:review_auto_approve_threshold');
  assert.equal(result.recommendations[0].journal.active, true);
});

test('accept decision is audit-only and explicitly records settingsApplied false', async () => {
  const writes = [];
  const prisma = {
    async $executeRaw(strings, ...values) { writes.push({ strings, values }); return 1; },
    async $queryRaw() { return [{ recommendationKey: '7d:review_auto_approve_threshold', action: 'decision', decision: 'accept', actorId: 'admin-1', metadata: { advisoryOnly: true, settingsApplied: false }, occurredAt: now }]; },
  };
  const metricsService = { getSnapshot: async () => ({ recommendations: [] }) };
  const service = new PhotoAiRecommendationJournalService({ prisma, metricsService, clock: () => now });
  const state = await service.decide(admin, '7d:review_auto_approve_threshold', { decision: 'accept', comment: 'проверить на тестовой выборке' });
  assert.equal(writes.length, 1);
  const serialized = JSON.stringify(writes[0].values);
  assert.match(serialized, /settingsApplied/);
  assert.match(serialized, /false/);
  assert.equal(state.decision, 'accept');
});

test('deferUntil must be in the future', async () => {
  const service = new PhotoAiRecommendationJournalService({
    prisma: { $executeRaw: async () => 1, $queryRaw: async () => [] },
    metricsService: { getSnapshot: async () => ({ recommendations: [] }) },
    clock: () => now,
  });
  await assert.rejects(
    () => service.decide(admin, '7d:quality_stable_no_action', { decision: 'defer', deferUntil: '2026-08-22T14:00:00Z' }),
    (error) => error.code === 'PHOTO_AI_RECOMMENDATION_DEFER_UNTIL_INVALID',
  );
});

test('recommendation journal requires admin role', async () => {
  const service = new PhotoAiRecommendationJournalService({
    prisma: { $executeRaw: async () => 1, $queryRaw: async () => [] },
    metricsService: { getSnapshot: async () => ({ recommendations: [] }) },
  });
  await assert.rejects(() => service.history({ roles: ['USER'] }), (error) => error.code === 'PHOTO_VERIFICATION_ADMIN_PERMISSION_DENIED');
});
