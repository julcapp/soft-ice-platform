'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { PromotionValidationService } = require('../src/modules/promotion_engine/PromotionValidationService');

function happyHour(overrides = {}) {
  const base = {
    code: 'HAPPY_HOUR',
    name: 'Час выгоды',
    status: 'DRAFT',
    version: {
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
        { dayOfWeek: 2, startTime: '17:00', endTime: '19:00', isEnabled: true },
      ],
      targets: [{ targetType: 'ALL_MACHINES', targetId: null }],
      audiences: [{ audienceType: 'ALL' }],
      channels: [
        { channel: 'TERMINAL', enabled: true, countdownEnabled: true },
        { channel: 'WEB', enabled: true, countdownEnabled: true },
        { channel: 'MINI_APP', enabled: true, countdownEnabled: true },
        { channel: 'TELEGRAM', enabled: true, countdownEnabled: true },
        { channel: 'MAX', enabled: true, countdownEnabled: true },
        { channel: 'VK', enabled: true, countdownEnabled: true },
      ],
      rules: [
        { ruleType: 'BONUS_PAYMENT', value: 'FORBIDDEN' },
        { ruleType: 'THIRD_PARTY_TRANSFER', value: 'FORBIDDEN' },
        { ruleType: 'MONEY_DISCOUNT_STACKING', value: 'FORBIDDEN' },
        { ruleType: 'GIFT_COMPATIBILITY', value: 'PAID_ITEMS_ONLY' },
      ],
    },
  };

  return {
    ...base,
    ...overrides,
    version: {
      ...base.version,
      ...(overrides.version || {}),
    },
  };
}

test('valid HAPPY_HOUR draft becomes READY', () => {
  const result = new PromotionValidationService().validateCampaign(happyHour());
  assert.equal(result.valid, true);
  assert.equal(result.nextStatus, 'READY');
  assert.deepEqual(result.errors, []);
});

test('HAPPY_HOUR requires 20 percent discount', () => {
  const result = new PromotionValidationService().validateCampaign(happyHour({ version: { benefitValue: 15 } }));
  assert.equal(result.valid, false);
  assert.equal(result.nextStatus, 'VALIDATION_FAILED');
  assert.ok(result.errors.some((entry) => entry.code === 'HAPPY_HOUR_DISCOUNT_MUST_BE_20'));
});

test('HAPPY_HOUR requires countdown in every enabled channel', () => {
  const campaign = happyHour();
  campaign.version.channels[3].countdownEnabled = false;
  const result = new PromotionValidationService().validateCampaign(campaign);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === 'HAPPY_HOUR_COUNTDOWN_REQUIRED'));
});

test('HAPPY_HOUR rejects partial bonus payment rule', () => {
  const campaign = happyHour();
  campaign.version.rules[0].value = 'ALLOWED';
  const result = new PromotionValidationService().validateCampaign(campaign);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === 'HAPPY_HOUR_REQUIRED_RULE_MISSING'));
});

test('HAPPY_HOUR rejects third-party transfer', () => {
  const campaign = happyHour();
  campaign.version.rules[1].value = 'ALLOWED';
  const result = new PromotionValidationService().validateCampaign(campaign);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.path === 'version.rules.THIRD_PARTY_TRANSFER'));
});

test('overlapping schedule windows fail validation', () => {
  const campaign = happyHour();
  campaign.version.schedules.push({ dayOfWeek: 1, startTime: '10:30', endTime: '12:00', isEnabled: true });
  const result = new PromotionValidationService().validateCampaign(campaign);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === 'OVERLAPPING_SCHEDULE_WINDOWS'));
});

test('non ALL_MACHINES target requires targetId', () => {
  const campaign = happyHour();
  campaign.version.targets = [{ targetType: 'MACHINE' }];
  const result = new PromotionValidationService().validateCampaign(campaign);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((entry) => entry.code === 'TARGET_ID_REQUIRED'));
});
