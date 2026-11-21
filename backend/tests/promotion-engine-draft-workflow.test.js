'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PromotionService } = require('../src/modules/promotion_engine/PromotionService');

function baseVersion(overrides = {}) {
  return {
    id: 'version-1', campaignId: 'campaign-1', version: 1, status: 'DRAFT', createdBy: 'admin-1', createdAt: new Date(),
    benefitType: 'PERCENT_DISCOUNT', benefitValue: 20, stackingMode: 'BEST_PRICE', priceLockSeconds: 300,
    timezone: 'Europe/Moscow', approvalPolicy: 'SINGLE_APPROVAL', budgetAction: 'STOP',
    schedules: [{ dayOfWeek: 1, startTime: '09:00', endTime: '11:00', isEnabled: true }],
    targets: [{ targetType: 'ALL_MACHINES', targetId: null }], audiences: [{ audienceType: 'ALL' }],
    channels: [{ channel: 'TERMINAL', enabled: true, countdownEnabled: true }, { channel: 'MINI_APP', enabled: true, countdownEnabled: true }],
    rules: [
      { ruleType: 'PARTIAL_BONUS_PAYMENT', value: 'FORBIDDEN' }, { ruleType: 'TRANSFER_TO_THIRD_PARTY', value: 'FORBIDDEN' },
      { ruleType: 'MONEY_DISCOUNT_STACKING', value: 'FORBIDDEN' }, { ruleType: 'GIFT_COMPATIBILITY', value: 'PAID_ITEMS_ONLY' },
    ],
    ...overrides,
  };
}
function validCampaign(overrides = {}) {
  return { id: 'campaign-1', code: 'HAPPY_HOUR', name: 'Час выгоды', status: 'DRAFT', currentVersionId: 'version-1', effectiveVersionId: null, effectiveVersion: null, currentVersion: baseVersion(), ...overrides };
}

test('createDraft delegates to repository after basic input validation', async () => {
  let received; const repository = { async createDraft(input) { received = input; return { id: 'campaign-1', status: 'DRAFT' }; } };
  const service = new PromotionService({ repository }); const input = { code: 'HAPPY_HOUR', name: 'Час выгоды', createdBy: 'admin-1', version: { benefitType: 'PERCENT_DISCOUNT' } };
  const result = await service.createDraft(input); assert.equal(result.status, 'DRAFT'); assert.equal(received, input);
});

test('valid draft transitions working version to READY', async () => {
  const calls = []; const repository = { async getCampaignById() { return validCampaign(); }, async updateCampaignStatus(payload) { calls.push(payload); } };
  const result = await new PromotionService({ repository }).validateDraft({ campaignId: 'campaign-1', actorId: 'manager-1' });
  assert.equal(result.status, 'READY'); assert.equal(result.validation.valid, true); assert.equal(calls[0].actorId, 'manager-1');
});

test('invalid draft transitions working version to VALIDATION_FAILED', async () => {
  const campaign = validCampaign(); campaign.currentVersion.benefitValue = 15; const calls = [];
  const repository = { async getCampaignById() { return campaign; }, async updateCampaignStatus(payload) { calls.push(payload); } };
  const result = await new PromotionService({ repository }).validateDraft({ campaignId: 'campaign-1' });
  assert.equal(result.status, 'VALIDATION_FAILED'); assert.ok(result.validation.errors.some((item) => item.code === 'HAPPY_HOUR_DISCOUNT_MUST_BE_20'));
});

test('active serving campaign cannot revalidate an ACTIVE working version', async () => {
  const active = baseVersion({ id: 'v1', status: 'ACTIVE' });
  const campaign = validCampaign({ status: 'ACTIVE', currentVersionId: 'v1', effectiveVersionId: 'v1', currentVersion: active, effectiveVersion: active });
  const service = new PromotionService({ repository: { async getCampaignById() { return campaign; } } });
  await assert.rejects(() => service.validateDraft({ campaignId: 'campaign-1' }), (error) => error.code === 'PROMOTION_STATUS_NOT_VALIDATABLE');
});

test('VALIDATION_FAILED working version may be edited in place', async () => {
  const campaign = validCampaign({ currentVersion: baseVersion({ status: 'VALIDATION_FAILED' }) }); let received;
  const repository = { async getCampaignById() { return campaign; }, async updateDraft(payload) { received = payload; return { ...campaign, currentVersion: { ...campaign.currentVersion, status: 'DRAFT' } }; } };
  const result = await new PromotionService({ repository }).updateDraft({ campaignId: 'campaign-1', patch: { name: 'Час выгоды — вечер' }, actorId: 'marketer-1' });
  assert.equal(result.currentVersion.status, 'DRAFT'); assert.equal(received.actorId, 'marketer-1');
});

test('READY working version cannot be edited in place', async () => {
  const campaign = validCampaign({ currentVersion: baseVersion({ status: 'READY' }) });
  await assert.rejects(() => new PromotionService({ repository: { async getCampaignById() { return campaign; } } }).updateDraft({ campaignId: 'campaign-1', patch: { name: 'Новая' }, actorId: 'marketer-1' }), (error) => error.code === 'PROMOTION_DRAFT_EDIT_FORBIDDEN');
});

test('campaign code is immutable after creation', async () => {
  await assert.rejects(() => new PromotionService({ repository: { async getCampaignById() { return validCampaign(); } } }).updateDraft({ campaignId: 'campaign-1', patch: { code: 'OTHER' }, actorId: 'marketer-1' }), (error) => error.code === 'PROMOTION_CODE_IMMUTABLE');
});

test('P-12: new version is cloned from effective version while campaign remains operationally ACTIVE', async () => {
  const effectiveVersion = baseVersion({ id: 'v1', status: 'ACTIVE', benefitValue: 20 });
  const campaign = validCampaign({ status: 'ACTIVE', currentVersionId: 'v1', effectiveVersionId: 'v1', currentVersion: effectiveVersion, effectiveVersion });
  let received;
  const repository = {
    async getCampaignById() { return campaign; },
    async createVersion(payload) { received = payload; return { ...campaign, status: 'ACTIVE', currentVersionId: 'v2', currentVersion: { ...payload.version, id: 'v2', version: 2, status: 'DRAFT' } }; },
  };
  const result = await new PromotionService({ repository }).createVersion({ campaignId: 'campaign-1', version: { benefitValue: 15 }, actorId: 'manager-1' });
  assert.equal(result.status, 'ACTIVE'); assert.equal(result.currentVersion.status, 'DRAFT'); assert.equal(result.effectiveVersion.id, 'v1');
  assert.equal(received.version.benefitValue, 15); assert.deepEqual(received.version.channels, effectiveVersion.channels); assert.equal(received.actorId, 'manager-1');
});
