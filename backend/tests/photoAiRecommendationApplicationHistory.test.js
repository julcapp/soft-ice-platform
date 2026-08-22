const test = require('node:test');
const assert = require('node:assert/strict');
const { PhotoAiRecommendationApplicationHistoryService } = require('../src/modules/photo_verification/PhotoAiRecommendationApplicationHistoryService');

const admin = { role: 'ADMIN', subject: 'ops-admin' };

function prismaWith({ applications = [], rollbackEventsByPreparation = {} }) {
  let call = 0;
  return {
    async $queryRaw() {
      call += 1;
      if (call === 1) return applications;
      const application = applications[Math.floor((call - 2) / 1)];
      const preparationId = application?.metadata?.preparationId;
      return rollbackEventsByPreparation[preparationId] || [];
    },
  };
}

test('history marks rollback available when current settings still equal applied state', async () => {
  const applications = [{ id: 'evt-1', recommendationKey: '7d:review_auto_approve_threshold', actorId: 'a1', correlationId: 'c1', occurredAt: new Date('2026-08-22T10:00:00Z'), metadata: { preparationId: '11111111-1111-1111-1111-111111111111', before: { approvalThreshold: 0.9 }, patch: { approvalThreshold: 0.93 }, after: { approvalThreshold: 0.93 } } }];
  const service = new PhotoAiRecommendationApplicationHistoryService({ prisma: prismaWith({ applications }), adminService: { getSettings: async () => ({ approvalThreshold: 0.93 }) } });
  const [item] = await service.list(admin);
  assert.equal(item.rollbackAvailable, true);
  assert.equal(item.rolledBack, false);
  assert.equal(item.rollbackBlockedReason, null);
});

test('history marks rollback blocked when settings changed after application', async () => {
  const applications = [{ id: 'evt-2', recommendationKey: '7d:high_disagreement_review_mode', actorId: 'a1', occurredAt: new Date(), metadata: { preparationId: '22222222-2222-2222-2222-222222222222', before: { mode: 'ai_assisted' }, patch: { mode: 'manual_only' }, after: { mode: 'manual_only' } } }];
  const service = new PhotoAiRecommendationApplicationHistoryService({ prisma: prismaWith({ applications }), adminService: { getSettings: async () => ({ mode: 'disabled' }) } });
  const [item] = await service.list(admin);
  assert.equal(item.rollbackAvailable, false);
  assert.equal(item.rollbackBlockedReason, 'settings_changed_after_application');
});

test('history marks application already rolled back', async () => {
  const preparationId = '33333333-3333-3333-3333-333333333333';
  const applications = [{ id: 'evt-3', recommendationKey: '7d:review_auto_approve_threshold', actorId: 'a1', occurredAt: new Date(), metadata: { preparationId, before: { approvalThreshold: 0.9 }, patch: { approvalThreshold: 0.93 }, after: { approvalThreshold: 0.93 } } }];
  const rollbackEventsByPreparation = { [preparationId]: [{ action: 'rolled_back', metadata: { rollbackId: 'rb-1' }, occurredAt: new Date('2026-08-22T11:00:00Z'), actorId: 'a2' }] };
  const service = new PhotoAiRecommendationApplicationHistoryService({ prisma: prismaWith({ applications, rollbackEventsByPreparation }), adminService: { getSettings: async () => ({ approvalThreshold: 0.9 }) } });
  const [item] = await service.list(admin);
  assert.equal(item.rolledBack, true);
  assert.equal(item.rollbackAvailable, false);
  assert.equal(item.rollbackBlockedReason, 'already_rolled_back');
  assert.equal(item.rolledBackBy, 'a2');
});
