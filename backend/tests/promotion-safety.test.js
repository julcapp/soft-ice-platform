'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { PromotionSafetyService } = require('../src/modules/promotion_engine/PromotionSafetyService');
const { PromotionService } = require('../src/modules/promotion_engine/PromotionService');

function campaign(overrides = {}) {
  return {
    id: 'promo-1',
    status: 'ACTIVE',
    currentVersion: {
      id: 'version-1',
      benefitType: 'PERCENT_DISCOUNT',
      benefitValue: 20,
      approvalPolicy: 'NONE',
      budgetAmount: 1000,
      budgetAction: 'STOP',
      maxApplications: 100,
      minimumFinalPrice: 100,
      ...overrides,
    },
  };
}

test('safety evaluator pauses when observed price is below configured floor', async () => {
  const repository = { getUsageSummary: async () => ({ applications: 5, discountAmount: 100, baseAmount: 1000, finalAmount: 900, minimumObservedFinalAmount: 180 }) };
  const safety = new PromotionSafetyService({ repository });
  const result = await safety.evaluate({ campaign: campaign(), observedFinalPrice: 90 });
  assert.equal(result.safe, false);
  assert.equal(result.recommendedStatus, 'PAUSED_BY_SAFETY');
  assert.ok(result.issues.some((item) => item.code === 'PROMOTION_MINIMUM_PRICE_BREACH'));
});

test('budget STOP produces PAUSED_BY_BUDGET', async () => {
  const repository = { getUsageSummary: async () => ({ applications: 20, discountAmount: 1000, baseAmount: 5000, finalAmount: 4000, minimumObservedFinalAmount: 150 }) };
  const safety = new PromotionSafetyService({ repository });
  const result = await safety.evaluate({ campaign: campaign() });
  assert.equal(result.safe, false);
  assert.equal(result.recommendedStatus, 'PAUSED_BY_BUDGET');
});

test('budget NOTIFY_ONLY creates warning without automatic pause recommendation', async () => {
  const repository = { getUsageSummary: async () => ({ applications: 20, discountAmount: 1200, baseAmount: 5000, finalAmount: 3800, minimumObservedFinalAmount: 150 }) };
  const safety = new PromotionSafetyService({ repository });
  const result = await safety.evaluate({ campaign: campaign({ budgetAction: 'NOTIFY_ONLY' }) });
  assert.equal(result.safe, true);
  assert.equal(result.recommendedStatus, 'ACTIVE');
  assert.ok(result.issues.some((item) => item.severity === 'WARNING'));
});

test('service automatically pauses ACTIVE campaign on critical safety failure', async () => {
  const transitions = [];
  const repository = {
    getCampaignById: async () => campaign(),
    getUsageSummary: async () => ({ applications: 5, discountAmount: 100, baseAmount: 1000, finalAmount: 900, minimumObservedFinalAmount: 180 }),
    transitionStatus: async (payload) => { transitions.push(payload); return { status: payload.status }; },
    recordEvent: async () => ({}),
  };
  const service = new PromotionService({ repository });
  const result = await service.evaluateSafety({ campaignId: 'promo-1', observedDiscountPercent: 25 });
  assert.equal(result.campaignStatus, 'PAUSED_BY_SAFETY');
  assert.equal(transitions[0].status, 'PAUSED_BY_SAFETY');
  assert.equal(transitions[0].eventType, 'SAFETY_AUTO_PAUSED');
});

test('Emergency Stop requires a reason and moves campaign to PAUSED_BY_SAFETY', async () => {
  const transitions = [];
  const repository = {
    getCampaignById: async () => campaign(),
    transitionStatus: async (payload) => { transitions.push(payload); return { status: payload.status }; },
  };
  const service = new PromotionService({ repository, safetyService: { evaluate: async () => ({ safe: true, issues: [] }) } });
  await assert.rejects(() => service.emergencyStop({ campaignId: 'promo-1', actorId: 'admin-1', reason: '' }), (error) => error.code === 'PROMOTION_EMERGENCY_STOP_REASON_REQUIRED');
  await service.emergencyStop({ campaignId: 'promo-1', actorId: 'admin-1', reason: 'Pricing anomaly' });
  assert.equal(transitions[0].status, 'PAUSED_BY_SAFETY');
  assert.equal(transitions[0].eventType, 'EMERGENCY_STOP');
});

test('ordinary resume cannot bypass safety pause', async () => {
  const paused = campaign();
  paused.status = 'PAUSED_BY_SAFETY';
  const repository = { getCampaignById: async () => paused };
  const service = new PromotionService({ repository, safetyService: { evaluate: async () => ({ safe: true, issues: [] }) } });
  await assert.rejects(() => service.resume({ campaignId: 'promo-1', actorId: 'admin-1' }), (error) => error.code === 'PROMOTION_SAFETY_OVERRIDE_REQUIRED');
});
