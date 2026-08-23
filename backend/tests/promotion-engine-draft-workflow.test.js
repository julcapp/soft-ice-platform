'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PromotionService } = require('../src/modules/promotion_engine/PromotionService');

function validCampaign() {
  return {
    id: 'campaign-1',
    code: 'HAPPY_HOUR',
    name: 'Час выгоды',
    status: 'DRAFT',
    currentVersion: {
      id: 'version-1',
      version: 1,
      benefitType: 'PERCENT_DISCOUNT',
      benefitValue: 20,
      stackingMode: 'BEST_PRICE',
      priceLockSeconds: 300,
      timezone: 'Europe/Moscow',
      approvalPolicy: 'SINGLE_APPROVAL',
      budgetAction: 'STOP',
      schedules: [
        { dayOfWeek: 1, startTime: '09:00', endTime: '11:00', isEnabled: true },
      ],
      targets: [{ targetType: 'ALL_MACHINES', targetId: null }],
      audiences: [{ audienceType: 'ALL' }],
      channels: [
        { channel: 'TERMINAL', enabled: true, countdownEnabled: true },
        { channel: 'MINI_APP', enabled: true, countdownEnabled: true },
      ],
      rules: [
        { ruleType: 'BONUS_PAYMENT', value: 'FORBIDDEN' },
        { ruleType: 'THIRD_PARTY_TRANSFER', value: 'FORBIDDEN' },
        { ruleType: 'MONEY_DISCOUNT_STACKING', value: 'FORBIDDEN' },
        { ruleType: 'GIFT_COMPATIBILITY', value: 'PAID_ITEMS_ONLY' },
      ],
    },
  };
}

test('createDraft delegates to repository after basic input validation', async () => {
  let received;
  const repository = {
    async createDraft(input) {
      received = input;
      return { id: 'campaign-1', status: 'DRAFT' };
    },
  };
  const service = new PromotionService({ repository });
  const input = {
    code: 'HAPPY_HOUR',
    name: 'Час выгоды',
    createdBy: 'admin-1',
    version: { benefitType: 'PERCENT_DISCOUNT' },
  };

  const result = await service.createDraft(input);
  assert.equal(result.status, 'DRAFT');
  assert.equal(received, input);
});

test('valid draft transitions to READY', async () => {
  const calls = [];
  const repository = {
    async getCampaignById() {
      return validCampaign();
    },
    async updateCampaignStatus(payload) {
      calls.push(payload);
      return { status: payload.status };
    },
  };
  const service = new PromotionService({ repository });

  const result = await service.validateDraft({ campaignId: 'campaign-1', actorId: 'manager-1' });

  assert.equal(result.status, 'READY');
  assert.equal(result.validation.valid, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 'READY');
  assert.equal(calls[0].actorId, 'manager-1');
});

test('invalid draft transitions to VALIDATION_FAILED', async () => {
  const campaign = validCampaign();
  campaign.currentVersion.benefitValue = 15;

  const calls = [];
  const repository = {
    async getCampaignById() {
      return campaign;
    },
    async updateCampaignStatus(payload) {
      calls.push(payload);
      return { status: payload.status };
    },
  };
  const service = new PromotionService({ repository });

  const result = await service.validateDraft({ campaignId: 'campaign-1' });

  assert.equal(result.status, 'VALIDATION_FAILED');
  assert.equal(result.validation.valid, false);
  assert.ok(result.validation.errors.some((item) => item.code === 'HAPPY_HOUR_DISCOUNT_MUST_BE_20'));
  assert.equal(calls[0].status, 'VALIDATION_FAILED');
});

test('active campaign cannot be revalidated as draft', async () => {
  const campaign = validCampaign();
  campaign.status = 'ACTIVE';

  const repository = {
    async getCampaignById() {
      return campaign;
    },
    async updateCampaignStatus() {
      throw new Error('must not be called');
    },
  };
  const service = new PromotionService({ repository });

  await assert.rejects(
    () => service.validateDraft({ campaignId: 'campaign-1' }),
    (error) => error.code === 'PROMOTION_STATUS_NOT_VALIDATABLE'
  );
});
